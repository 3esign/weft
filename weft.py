#!/usr/bin/env python3
"""WEFT — one command from a design to a file a printer will accept, or nothing at all.

    python weft.py machines
    python weft.py build climber --machine a2l --H 240 --out specimens/<folder> --name <name>
    python weft.py check FILE.gcode --machine a2l

Why this exists: the sequence used to be three commands with a dozen flags, and the flags carried
numbers that are not free parameters at all. `bead` and `layer height` are properties of a CALIBRATED
PRINTER; every geometry rule in WEFT — the turn radius rho, the rung-tip floor, self-approach, the
weld gap, the bridge budget — is derived from them. Typing them by hand is how a model built for a
0.45 mm bead gets sent to a machine whose bead nobody has ever measured. `machines.json` owns those
numbers now, and says for each one whether it was measured in plastic or assumed.

The chain is: geometry -> builder -> gate -> package. **Every step refuses.** A non-zero exit
anywhere stops the run, and nothing that failed is left behind for someone to print by accident.
"""
import argparse, json, os, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
MACHINES = json.load(open(os.path.join(HERE, 'machines.json'), encoding='utf-8'))
# The builder is model-agnostic: it reads the geometry file's own summary and layers, so every model
# that emits the same shape of JSON can share it.
MODELS = {
    'climber': {'geometry': 'climber_geometry.py', 'builder': 'make_climber.mjs',
                'extra': ['--legs', '--H', '--K', '--w0', '--w1', '--foundation', '--rib', '--maxbridge']},
    'vase':    {'geometry': 'vase_geometry.py', 'builder': 'make_climber.mjs',
                'extra': ['--turns', '--H', '--K', '--w0', '--w1', '--foundation', '--rib', '--maxbridge']},
    'paired':  {'geometry': 'paired_sculpture_geometry.py', 'builder': 'make_climber.mjs',
                'extra': ['--variant', '--turns', '--H', '--K', '--w0', '--w1', '--foundation', '--maxbridge']},
    'aero':    {'geometry': 'aero_tower_geometry.py', 'builder': 'make_climber.mjs',
                'extra': ['--variant', '--turns', '--H', '--K', '--w0', '--w1', '--foundation', '--maxbridge']},
    # 2026-09-05: the two big sculptures. Analytic surface -> level-2 layers with OPEN arcs (windows), typed
    # bridge paths (the woven iris crown) and a breathing wall; built by make_suma.mjs, which knows those
    # primitives. Their lintels are declared experiments over the evidenced bridge, so the build needs
    # --allow-experimental-bridge and is gated twice (see make_suma.mjs).
    'sculpture': {'geometry': 'sculpture_geometry.py', 'builder': 'make_suma.mjs',
                  'extra': ['--variant', '--turns', '--H', '--K', '--R', '--maxbridge', '--lintels', '--fins',
                            '--fin-rate', '--relief']},
}


def die(msg, code=1):
    print(f'\n  REFUSED: {msg}\n', file=sys.stderr)
    sys.exit(code)


def run(cmd, what, env=None):
    print(f'\n=== {what} ===\n$ ' + ' '.join(cmd), flush=True)
    t = time.time()
    r = subprocess.run(cmd, cwd=HERE, env=env)
    print(f'--- {what}: exit {r.returncode} after {time.time()-t:.0f} s', flush=True)
    if r.returncode != 0:
        die(f'{what} did not pass its own checks. Nothing was written.', r.returncode)


def cmd_machines(a):
    for mid, m in MACHINES.items():
        if mid.startswith('_'):
            continue
        warn = '' if m['beadSource'] == 'measured' else '   <-- ASSUMED, not measured'
        print(f"{mid:8} {m['label']:24} {m['plate'][0]}x{m['plate'][1]}x{m['maxZ']} mm   "
              f"bead {m['bead']} / layer {m['lh']}{warn}")
        print(f"         {m['beadEvidence']}")


def cmd_build(a):
    if a.machine not in MACHINES or a.machine.startswith('_'):
        die(f'unknown machine {a.machine!r}; try: python weft.py machines')
    m = MACHINES[a.machine]
    if a.model not in MODELS:
        die(f'unknown model {a.model!r}; known: {", ".join(MODELS)}')
    mod = MODELS[a.model]
    out = os.path.abspath(a.out)
    os.makedirs(out, exist_ok=True)
    name = a.name or f'{a.model}_{a.machine}'
    geo = os.path.join(out, f'{name}_geometry.json')

    if m['beadSource'] != 'measured':
        print('\n' + '!' * 78)
        print(f"!  {m['label']}: bead {m['bead']} mm is ASSUMED, not measured.")
        print(f"!  {m['beadEvidence']}")
        print('!  Everything below is derived from that number. Calibrate before you trust it.')
        print('!' * 78)
        if not a.i_know_the_bead_is_a_guess:
            die('pass --i-know-the-bead-is-a-guess to build anyway, or measure the bead first')

    # 1. geometry (levels 1-2): topology, weld columns, the wall the body can carry
    g = [sys.executable, mod['geometry'],
         '--bead', str(m['bead']), '--lh', str(m['lh']),
         '--plate', str(m['plate'][0]), str(m['plate'][1]), '--out', geo]
    for flag in mod['extra']:
        v = getattr(a, flag.lstrip('-').replace('-', '_'), None)
        if v is not None:
            g += [flag, str(v)]
    run(g, 'geometry')

    # 2. the builder (level 3): the thread, the STL, the G-code. Refuses on a bad weave,
    #    runs the gate on the finished G-code, and deletes anything the gate rejects.
    b = ['node', mod['builder'], '--geo', geo, '--name', name, '--out', out,
         '--machine', a.machine, '--bx', str(m['plate'][0]), '--by', str(m['plate'][1]),
         '--head', m['start'], '--foot', m['end']]
    if a.nostl:
        b.append('--nostl')
    if a.allow_experimental_membrane:
        b.append('--allow-experimental-membrane')
    if a.allow_experimental_bridge:
        if mod['builder'] != 'make_suma.mjs':
            die('--allow-experimental-bridge is only understood by make_suma.mjs (the double-gated builder)')
        b.append('--allow-experimental-bridge')
    if os.environ.get('WEFT_CHROMIUM'):
        pass
    builder_env = os.environ.copy()
    builder_env['WEFT_PYTHON'] = sys.executable
    run(b, 'builder + gate', env=builder_env)

    gcode = os.path.join(out, f'{name}.gcode')
    if not os.path.exists(gcode):
        # make_suma.mjs names its file <name>_routeB.gcode (the Suma convention); accept it
        alt = os.path.join(out, f'{name}_routeB.gcode')
        if os.path.exists(alt):
            gcode = alt
        else:
            die('the builder produced no G-code')

    # 3a. tell the truth in the first ten lines. The harvested start blocks carry the statistics of
    #     the print they were harvested from, so every object built on them announced somebody else's
    #     time, weight, layer count and height to the machine. The Suma 4x4 - 4.7 h, 57 mm, 237 layers -
    #     told the printer 1d 1h, 186 g, 583 layers, 139.9 mm, for the whole print.
    run([sys.executable, os.path.join(HERE, 'fix_header.py'), gcode], 'rewrite the header')

    # 3. package for the machine that has to read it
    shipped = [os.path.basename(gcode)]
    if m['route'] == 'bambu3mf':
        tpl = os.path.join(HERE, m['containerTemplate'])
        if not os.path.exists(tpl):
            die(f"container template missing: {m['containerTemplate']} — a Bambu .gcode.3mf can only "
                f"be built from one of Semir's own exports")
        three = os.path.join(out, f'{name}.gcode.3mf')
        run([sys.executable, 'pack_bambu_3mf.py', '--gcode', gcode, '--template', tpl, '--out', three],
            'pack .gcode.3mf')
        shipped.append(os.path.basename(three))

    # 4. the manifest: what was built, from which numbers, and on whose authority
    man = {
        'name': name, 'model': a.model, 'built': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'machine': {'id': a.machine, **{k: m[k] for k in
                    ('label', 'plate', 'maxZ', 'bead', 'beadSource', 'beadEvidence', 'lh',
                     'firstLayerBead', 'temp', 'bed', 'start', 'end', 'route')}},
        'geometry': os.path.basename(geo),
        'shipped': shipped,
        'gate': f'{name}_gate.json',
        'report': f'{name}_report.json',
        'outcome': 'NOT PRINTED — fill this in after the print, with photographs',
    }
    json.dump(man, open(os.path.join(out, 'manifest.json'), 'w'), indent=1)
    print(f'\n=== done ===\n{out}\n  ' + '\n  '.join(shipped) + '\n  manifest.json')
    if m['beadSource'] != 'measured':
        print(f"\n  Remember: this was built on an ASSUMED bead of {m['bead']} mm.")


def cmd_check(a):
    m = MACHINES.get(a.machine)
    if not m:
        die(f'unknown machine {a.machine!r}')
    run([sys.executable, 'check_gcode.py', os.path.abspath(a.gcode),
         '--bead', str(m['bead']), '--maxislands', '1'] + (['--dump', a.dump] if a.dump else []),
        'gate')
    print('\n  gate passed')


ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
sub = ap.add_subparsers(dest='cmd', required=True)

p = sub.add_parser('machines', help='list the printers and say which numbers are measured')
p.set_defaults(fn=cmd_machines)

p = sub.add_parser('build', help='geometry -> builder -> gate -> package, refusing at every step')
p.add_argument('model', choices=sorted(MODELS))
p.add_argument('--machine', required=True)
p.add_argument('--out', required=True)
p.add_argument('--name', default=None)
p.add_argument('--nostl', action='store_true')
p.add_argument('--i-know-the-bead-is-a-guess', action='store_true',
               help='build for a machine whose bead has never been measured')
p.add_argument('--allow-experimental-membrane', action='store_true',
               help='emit a cap whose exact process/span has not yet been physically qualified')
p.add_argument('--allow-experimental-bridge', action='store_true',
               help='declare a bridge ceiling above the evidenced 16 mm (make_suma.mjs only); the build is then '
                    'gated at the declared ceiling AND at 16 mm, where every finding must fall in a declared zone')
for f in ('--legs', '--variant', '--turns', '--H', '--K', '--R', '--w0', '--w1', '--foundation', '--rib', '--maxbridge',
          '--lintels', '--fins', '--fin-rate', '--relief'):
    p.add_argument(f, default=None)
p.set_defaults(fn=cmd_build)

p = sub.add_parser('check', help='run the gate on any finished G-code')
p.add_argument('gcode')
p.add_argument('--machine', required=True)
p.add_argument('--dump', default=None, help='render the worst layers to this PNG')
p.set_defaults(fn=cmd_check)

a = ap.parse_args()
a.fn(a)
