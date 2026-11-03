# STOLICA — A2L, pure-weft/v2 (2026-10-03)

The chair from `specimens/2026-10-02_stolica_A1`, packaged for the **Bambu Lab A2L**. Same body, same
toolpath: the A1's verified geometry (`STOLICA_A2L_geometry.json`, SHA-256
`c409222d63b1a72e89c900a04a5db8a63e5ac29d99769da76e0abb64d4f5aef8`, byte-identical to
`2026-10-02_stolica_A1/STOLICA_geometry.json`) re-centred on the A2L's 330 × 320 plate and wrapped in the
A2L's start/end blocks and project settings. 82.3 × 89.2 × 169.9 mm, 708 layers, 756.7 m of thread,
93.1 g, 12h 57m on the container's estimate.

## Why the A1 geometry and not a fresh one

A fresh `weft_field_geometry.mjs --variant stolica --machine a2l` (the generator after the four fixes of the
SOKOL pass) was built first and **failed the gate**: two cantilevers of 3.63 mm and 3.18 mm at z 2.4 and
3.6, where the feet start to weave, against a 3 mm limit. It was not shipped; its files are parked in
`_to_delete/2026-10-03_stolica_A2L_newgen_gatefail/`. The A1 geometry passed the same gate, and the A1 and
A2L run the same bead (0.45) and layer (0.24), so it is the right body for this machine too.

## Evidence

| what | result |
|---|---|
| `check_gcode` gate S1 (`--maxislands 4`: four feet on the first layer, as on the A1) | PASS — 0 problems, 1 834 835 points, 709 layers |
| the layered gate S2–S8 / ORDER | S2 INFO · S3 PASS · S4 PASS · S5 INFO · S7 INFO · S8 WARN · ORDER N/A — **0 findings** |
| the same gate re-run inside the container | PASS (1 834 835 points) |
| `tools/check_pure_weft.mjs` | **0 walls** in 1198 body runs, 756.7 m |
| container metadata | `printer_model = Bambu Lab A2L`, `Bambu Lab A2L 0.4 nozzle`, plate 330 × 320, bed 55 °C, A2L start/end blocks |

## Rebuild

```
node weft.mjs build --geo specimens/2026-10-03_stolica_A2L/STOLICA_A2L_geometry.json --machine a2l \
  --out specimens/2026-10-03_stolica_A2L --name STOLICA_A2L --maxislands 4 --nostl --end-z-from-template
```

| shipped | sha256 |
|---|---|
| `STOLICA_A2L.gcode.3mf` | `65bc6bb9dbedde0e6b13db8836502c28b5a7eee2c1255ae38fc4df0df8e6d9bc` |
| `STOLICA_A2L.gcode` (not committed) | `7508018e69fc1cccfc2de2bb5f6990322c94f30af01c7780910f22c8fff9af23` |

Outcome: **NOT PRINTED.** Fill this in after the print, with photographs.

## Dopuna: fotografije prijavljenog pada stolice

Četiri fotografije su povezane u [dopuni analize](../../docs/STOLICA_FAIL_2026-10.md). Vizuelni pregled i pripadnost konkretnoj verziji nisu potvrđeni. Ovaj zapis ne menja istorijski ishod ovog specimena bez dokaza.
