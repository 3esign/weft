# SOKOL — A2L, pure-weft/v2 (2026-10-03)

The perched peregrine from `specimens/2026-10-02_sokol_A1`, built for the **Bambu Lab A2L** at the same
size. The geometry was generated fresh for the A2L and came out the same body as the A1's (same thread,
same runs, same worst spans), because both machines run a 0.45 mm bead at 0.24 mm layers. 88.5 × 85.4 ×
187.9 mm, 783 layers, 1141.0 m of thread, 142.5 g, 18h 49m on the container's estimate.

The A2L's bead is **measured**, so on this machine the millimetres stand on a real number.

The enlarged SOKOL (H 280 on the A2L) mentioned on the shelf earlier was never built; this is the
A1-size bird on the A2L.

## Evidence

| what | result |
|---|---|
| the generator's own refusals | none — worst free span 7.17 mm, worst valley run 9.01 mm against a 12 mm allowance |
| `check_gcode` gate S1 | PASS — 0 problems, 2 739 915 points, 784 layers, 1 island on the first layer |
| the layered gate S2–S8 / ORDER | S2 INFO · S3 PASS · S4 PASS · S5 INFO · S7 INFO · S8 WARN · ORDER N/A — **0 findings** |
| the same gate re-run inside the container | PASS (2 739 915 points) |
| `tools/check_pure_weft.mjs` | **0 walls** in 2031 body runs, 1141.0 m |
| container metadata | `printer_model = Bambu Lab A2L`, `Bambu Lab A2L 0.4 nozzle`, plate 330 × 320, bed 55 °C, A2L start/end blocks |

## Rebuild

```
node core/weft_field_geometry.mjs --variant sokol --machine a2l --name SOKOL_A2L \
  --out specimens/2026-10-03_sokol_A2L/SOKOL_A2L_geometry.json \
  --svg specimens/2026-10-03_sokol_A2L/SOKOL_A2L_program.svg --report
node weft.mjs build --geo specimens/2026-10-03_sokol_A2L/SOKOL_A2L_geometry.json --machine a2l \
  --out specimens/2026-10-03_sokol_A2L --name SOKOL_A2L --end-z-from-template
```

| shipped | sha256 |
|---|---|
| `SOKOL_A2L.gcode.3mf` | `6ad53a26beb3f7fb775c57ce755694bc2e72d0d63e2bf9622adfc18e78c977fe` |
| `SOKOL_A2L.gcode` (not committed) | `7e7dd2cec45f53958e48326cfb6236ddb7f1497d7234203d676f3e1732fd35e2` |

The geometry (55 MB), the display mesh (340 MB) and the raw G-code (99 MB) are not committed; the two
commands above rebuild them.

Outcome: **NOT PRINTED.** Fill this in after the print, with photographs.
