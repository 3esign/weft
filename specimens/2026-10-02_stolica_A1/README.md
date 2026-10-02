# STOLICA — A1, pure-weft/v2 (2026-10-02)

A chair that begins as **four separate round feet**, merges into one seat, and continues upward as a
back. 82.3 x 89.2 x 169.9 mm (two thirds of the A1's 256 mm Z), 708 layers, 756.7 m of thread,
75.6 g, 2h36m on the machine's own estimate.

The body is a **field** `f(x,y,z) < 0`, not a radial star: every layer is the level set, extracted by
marching squares and split into however many islands that height happens to have. Four islands
becoming one is exactly what `pure-weft/v1` could not say.

A layer is **one continuous line per island**:

- **RIM** — two interlacing waves in antiphase, not an offset band. They close on each other once per
  lobe and open to `gap + 2A` (~2.5-3 mm) between, so the shell has real holes: porous on the
  outside as well as inside. The phase advances per layer, so no two layers stack their openings.
- **CORE** — one open interior pattern (lines / sine / spiral / density field), laid on the wavy
  curve the inner rim pass actually traces, so chords end on rim material and not in a hole.
- The rim hands over to the core along that same pass: "wall" pattern and "infill" pattern leave the
  nozzle as a single thread. Travel exists only between islands.

The feet print flat (`amp 0`) for bed adhesion; the weave ramps in over the first ten layers of any
new island.

## Evidence

| what | result |
|---|---|
| `check_gcode` gate (S1 + S2-S8/ORDER) | PASS — 0 floating, 0 long bridge, 0 cantilever, 1.83 M points checked |
| same gate re-run inside the container | PASS |
| `tools/check_pure_weft.mjs` | **0 closed body paths** — 1198 runs, 4 noted as filled runs, none a wall |
| `tests/field_weft.test.mjs` | OK — 354 layers, 4 feet -> 1 body, 24/270510 points pulled back in |
| Bambu Studio 2.07.01.62 | opens pre-sliced: Preview active, Print plate green, 24.96 m / 75.64 g, 708 layers |

Studio shows a "floating cantilever" warning against `STOLICA.stl`. That is its heuristic on the
**display mesh**; the toolpath is what prints and our own gate measures support point-by-point
against the layer below — 0 cantilever, worst free span 7.02 mm against a 12 mm allowance.

## Rebuild

```
node core/weft_field_geometry.mjs --variant stolica --machine a1 \
  --out specimens/2026-10-02_stolica_A1/STOLICA --svg specimens/2026-10-02_stolica_A1/STOLICA_program.svg \
  --allow-assumed-bead --report
```

| shipped | sha256 |
|---|---|
| `STOLICA.gcode.3mf` | `9550048af38d6b9f7296d22b25c23c801bdd90b04845516fe3e4888c15befc99` |
| `STOLICA.gcode` (not committed) | `f2cc093c567b0bd77b0cac6b861989e01a87b3eb91b7e1bf91b65c19a97dcf46` |

## Not measured

The A1 bead is still the **ASSUMED 0.45 mm** carried over from the A2L. Every millimetre here is
worth exactly what that number is worth. Run the C1 thin-wall test on the A1 and measure before
trusting the dimensions.

Outcome: **NOT PRINTED.** Fill this in after the print, with photographs.

## Rebuild note, added 2026-10-02 (the SOKOL pass)

Four defects in `core/weft_field_geometry.mjs` were found while building `2026-10-02_sokol_A1` and fixed
there. All four were latent in this chair, so **the rebuild command above no longer reproduces the two
SHA-256 above** — it produces a better body. The shipped container is unchanged and still gates clean; what
changed is the generator.

| fixed | what it was doing to this chair |
|---|---|
| the rim's seam is now placed at the maximum opening, and opened by construction if the section is locally too thin | layers 182, 187 and 188 (at half scale) had a rim that came home on itself within 0.14 mm and once within 0 — a closed loop, in a process whose whole premise is that there are none |
| the weave's amplitude is clamped to the room the section has, continuously, instead of flipping to a plain concentric rim | the flip jumped the innermost pass a whole pitch sideways between adjacent layers |
| an island keeps its identity when it has not changed (mutual nearest neighbour, centroid **and** perimeter) | every island in the layer lost its weave ramp whenever any island in that layer merged or split |
| a collapsing ring shallows its weave instead of falling back to a plain rim | a plain concentric rim on a dumbbell leaves a void at the waist |
| `tools/check_pure_weft.mjs` now unzips a container, and refuses a file it read no extrusion from | run against `STOLICA.gcode.3mf` it printed **"no closed body path"** after reading **0 runs** — a green verdict on an unread file. Re-run properly, the container reports 1198 body runs, 756.7 m, **0 walls**: the claim was true, the check was not |

`tests/field_weft.test.mjs` passes on the new generator and is what caught the closed rim. Rebuild and
re-gate before printing from a fresh build; the committed `STOLICA.gcode.3mf` is the verified artefact.

## Header note, added 2026-10-02 (the SOKOL pass)

`STOLICA.gcode` — the plain file for an SD card, not committed — carries the **template's** header:
167 layers, 7.20 g, max Z 40.04, for a 708-layer 170 mm chair. `fixHeader` split the file on `'\n'`
while the harvested A1 start block is CRLF, so every substitution missed in silence. The committed
`STOLICA.gcode.3mf` was never affected; the packer rewrites those fields itself. Fixed in
`core/weft_build.mjs`, guarded in `weft.mjs` (the header is read back off the disk and compared with
the moves), held by `tests/header_truth.test.mjs`. See `specimens/2026-10-02_sokol_A1/README.md`.

The copy on the two shelves (`data/lab/A1_puna_tela/`, `Downloads/A1_puna_tela/`) has had its header
repaired in place — same moves, six lines rewritten, +74 bytes — and now reads 708 layers, 93.59 g,
max Z 169.92. Its SHA-256 is therefore no longer the one recorded above:
`0cdfb568c8d6091d171f3087cda9dacc4e4ecde667cf749929c2398f8e626ac0`.
