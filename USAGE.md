# WEFT — how to use it (read this before touching anything)

One command, and it refuses. If you find yourself typing `--bead`, you are already off the path.

    python weft.py machines
    python weft.py build climber --machine a2l --H 240 --legs 3 \
           --out specimens/2026-09-03_P2b_A2L_pending --name P2b_penjac_3_A2L
    python weft.py check FILE.gcode --machine a2l [--dump worst.png]

`check` also accepts a `.gcode.3mf` — it reads the machine's G-code out of the container. For G-code a
slicer wrote rather than WEFT (a Route A STL exported through Bambu Studio) add `--slicer-types`, which
reads the slicer's own `;TYPE:` feature comments as roles so a failure still names the feature.

## The one rule that this file exists to enforce

**`bead` and `layer height` are not design parameters. They are properties of a calibrated printer.**

Every geometry rule in WEFT is derived from them — the corner radius ρ, the rung-tip floor, the
self-approach limit, the weld-column spacing, the bridge budget, what counts as supported. Passing
them by hand is how a body shaped for a 0.45 mm bead gets sent to a machine whose bead nobody has
ever measured, and every check then passes against the wrong number.

`machines.json` owns them, and records for each machine whether the value was **measured in plastic**
or **assumed**. Building for an assumed bead requires `--i-know-the-bead-is-a-guess`, and the manifest
says so. Today: **A2L measured; A1 and the Ender assumed.**

## The chain, and where it refuses

| step | what it does | what stops it |
|---|---|---|
| 1 · geometry | `<model>_geometry.py`: topology, weld columns, caps, foundation, and the wall each layer can carry | exits non-zero on its own violations; writes `<out>.rejected` instead |
| 2 · builder | `make_<model>.mjs`: the thread, STL, G-code, thinning the layers that need it | refuses on a failed weave; **deletes** any output the gate rejects |
| 3 · gate | `check_gcode.py` on the FINAL G-code — nothing exempt | any FLOATING, LONG_BRIDGE, CANTILEVER, UNANCHORED_MEMBRANE, BAD_MEMBRANE, a first layer in pieces, or a generator whose declared anchoring disagrees with the measured one by more than 0.10 |
| 3a · header | `fix_header.py` rewrites the HEADER_BLOCK from the file's own moves | — (the harvested start blocks carry the statistics of the print they came from) |
| 4 · package | `.gcode.3mf` for Bambu, plain `.gcode` for Klipper | a missing container template |
| 5 · manifest | what was built, from which numbers, on whose authority, and `outcome: NOT PRINTED` | — |

A run that stops leaves nothing printable behind. That is the point.

## The regression fixture

`specimens/_regression/FIXTURE_bad_floating.gcode` is the P2 that shipped with five discs in mid-air.

    python weft.py check specimens/_regression/FIXTURE_bad_floating.gcode --machine ender

**It must fail.** A checker that cannot reproduce the bug it was written for is not evidence.

## Adding a machine

Add an entry to `machines.json`. `beadSource` is `measured` only if you can point at a printed
specimen at that bead. `start` and `end` are G-code blocks harvested from the machine's own slicer —
never hand-written. `route` is `bambu3mf` (needs `containerTemplate`, one of Semir's own exports) or
`gcode`. Until the browser emitter is generated directly from that registry, the same machine id and
bed dimensions must also exist in `index.html:MACHINES`; `tests/limit16.test.mjs` proves that
`setMachine('ender')` really changes the executable bed to 220 × 220 rather than merely changing a
manifest.

## Adding a model

Add an entry to `MODELS` in `weft.py`: a `<model>_geometry.py` that takes `--bead --lh --plate --out`
and exits non-zero on violation, and a `make_<model>.mjs` that takes `--geo --name --out --machine
--bx --by --head --foot` and runs the gate before it declares success. Anything that does not refuse
does not belong in the chain.

## Typed open paths and LIMIT16

A level-2 geometry layer may now contain `paths` beside `contours` and `caps`. Each path carries
`pts`, `role`, `tile`, `row`, `col`, optional `bead`/`speed`, and `closed`. Its Z is always
inherited from the containing layer; a path cannot create its own clock.

`bridge` and `cantilever` are structural roles, not labels. Their points must be no farther apart
than max(0.55 mm, 1.25 × machine bead), and the emitter preserves every one. The builder refuses a
sparser path because the final G-code gate otherwise sees two supported endpoints but cannot see the
air between them.

`limit16_geometry.py` is the reference mixed-primitive experiment. It emits the same 4 × 4 questions
for A2L and Ender while taking layer height, bead, first-layer bead and temperatures from
`machines.json`. The Ender output requires `--allow-assumed-bead` and stays explicitly
`EXPERIMENTAL` until cell 10 measures that printer.

## Membrane process contract

Geometric anchoring is necessary and not sufficient for a single-layer membrane. The small MERA plate
passed with four outer rims measured at 1.000, while the photographs most consistently show only one
mostly formed centre and three collapsed into loose filament. A hot strand beside another hot strand
is not the same support as material on the previous layer.

Every `caps[]` record must therefore carry:

- `process`: a versioned construction identity, for example
  `single-layer-inward-spiral/limit16-18mm-v1`;
- `physicalStatus`: `qualified`, `experimental`, or `failed`;
- `evidence`: required for `qualified`, pointing at a
  `weft.membrane-qualification.v1` JSON receipt inside the WEFT root (the path is resolved from
  this root, never from the caller's current directory).

A failed process is always refused. An experimental one is emitted only when the build command explicitly
contains `--allow-experimental-membrane`; the status and evidence are copied into the report. Missing
metadata is refused. LIMIT16 cell 15 is deliberately experimental; the old MERA spiral is recorded as
failed and cannot be silently rebuilt as printable.

The status belongs to the exact cap identity — construction version, geometry and `span_mm` — not to
every inward spiral forever. All current builders call the same `membrane_contract.mjs`; a raw
`paths[]` entry may not impersonate a cap. Existing manifests are immutable historical receipts.
For an already emitted artifact, read `membrane_process_status.json` and `outcomes.md` before its old
README/report/manifest. Climber, vase and legacy Suma caps are explicitly experimental until their own
version and span receive physical evidence.

A regular file with the word “success” is not qualification. The receipt schema is
`schemas/membrane-qualification.v1.schema.json`; the builder independently requires it to bind
the exact process, span and XY-path SHA-256 to machine id, bead, layer height and the SHA-256 of an
existing printed artifact, with an existing photo manifest. No current membrane has that receipt,
so none is silently `qualified`.

## What still has to be done by hand

* **C1 bead calibration** on any machine marked ASSUMED — a thin-wall test, measured with calipers,
  then edit `machines.json`.
* **`suma_geometry.py` and `make_parasol.mjs` are not in the chain yet.** They predate all of this.
  They have no per-layer ρ, no refusal, and have never seen the gate.
* **Printing, photographing, and filling in `outcome` in the manifest.** No amount of checking is
  evidence. See `../journal/2026-09-02_HANDOFF.md`.
