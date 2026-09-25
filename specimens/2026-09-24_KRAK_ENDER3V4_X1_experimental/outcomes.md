# KRAK_ENDER3V4_X1 — outcomes

Status: NOT YET PRINTED (built 2026-09-24).

| date | event | note |
|---|---|---|
| 2026-09-24 | built, both gates passed | 0 problems at the declared ceiling; 386 findings at 16.2 mm, all inside declared zones; K3 clean to 48 mm |

## 2026-09-25 — printed, stopped by Semir; the whole object left the plate

Status: **PRINTED / DESTROYED / EXPERIMENTAL.** Printed on the Creality Ender-3 V4 on 2026-09-24/25 and
**stopped by Semir** when the nozzle was dragging loosened thread; not run to the end, no machine log, stop
layer not recorded. Sixteen photographs (eight of this machine) are in `photos/`.

What the photographs show: the woven drum is intact and clean with the K1 fringe on it, but the whole object
left the plate — in the photographs it lies on the bed as three or four displaced ring stacks, each with its
own fringe, one above the other, and in Semir's hand as a drum with a loose fringe several centimetres deep.
Same driver as on the A2L (the K1 terrace), different weakest link (the plate). Predictions 1, 2, 4 and 5
were never tested; prediction 6 is confirmed as a gap.

The reading and what the gate learned: `FINDINGS_2026-09-25_photographs_and_layered_gate.md` in this folder.
Re-checked with the layered gate (`core/weft_gate_layers.js`): **refused** — S3 (K1 median free reach
above the 17.6 mm that held on OBRTAJ), S4 (extrusion over never-tied K1 tips, K2 over K1), ORDER
(undeclared layers on the declared risk band).

Honest verdict: a destroyed object read from photographs; the gate numbers are measured from the shipped
bytes; the stop layer, mass and deflection are not recorded.
