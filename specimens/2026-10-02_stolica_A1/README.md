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
