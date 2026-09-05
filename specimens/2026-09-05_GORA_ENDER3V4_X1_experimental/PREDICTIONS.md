# PREDICTIONS — GORA Ender-3 V4 X1 (written 2026-09-05, before any print)

The Ender's bead (0.42 mm) is ASSUMED; the C1 calibration has never been printed. Every prediction below
carries that uncertainty on top of its own. LIMIT16 on this machine (2026-09-04) is the only evidence base.

| # | instrument | prediction | confidence | evidence |
|---|---|---|---|---|
| 1 | Foundation (rounded square, 8 rings + 48 spokes, one island) | holds; the Ender's bed adhesion was fine on LIMIT16 and the Vrtlog | medium-high | LIMIT16 Ender, Vrtlog |
| 2 | Body (staple → perp → sine, then staple through the windows, eight → diagonal above, staple to the crown); K 96 (sine 192) | prints at full height; the assumed bead shows as slightly open or slightly over-fused rungs (Vrtlog implied 0.446–0.463 mm at 0.20 layers) | medium | Vrtlog full height on the same assumption |
| 3 | Twist 0.2 turns (twisted rounded square) | prints; the corners spiral cleanly; the 0.115 mm/layer tangential move is far inside the reach | high | LIMIT16 leans L17 marginal on the Ender — but this is not a lean, the section moves 0.06 mm/layer inward |
| 4 | Windows 20 / 30 / 40 / 50 mm on the four faces, z 39–84 | jambs clean; the 20 mm control lintel holds with no visible sag | medium-high | LIMIT16 B16 continuous on the Ender |
| 5 | Lintel 30 | sag ≤ 3 mm | medium | B16 + the Ender's slower bridge speed (15 mm/s) |
| 6 | Lintel 40 | sag 3–6 mm, possibly one strand down | low-medium | extrapolation |
| 7 | Lintel 50 | likely partial failure (a hanging rail); the body recovers on the jambs within ~15 layers | low | extrapolation; the Ender degraded earlier than the A2L on every LIMIT16 instrument |
| 8 | Horns 20 / 30 / 40 / 50 (0.8 mm/layer) on the four faces, z 104–170 | 20 and 30 print with droop ≤ 3 mm; 40 droops or curls; 50 is the most likely loss — the Ender's cantilevers showed threads and curl from 1.8 mm | low-medium | LIMIT16 Ender C18–C45 |
| 9 | Crown approach (square shrinking to a 31 mm rounded hole, tabs 1.3 mm) | prints; the Vrtlog's mouth flare printed on this machine | medium | Vrtlog |
| 10 | Crown iris v1 (first free span 26.4 mm, later ≤ 12.4 mm) | first chords sag but hold; the star closes with 4–7 mm openings | low-medium | LIMIT16 Ender bridges to 16 mm |
| 11 | Overall | completes in 14–20 h; stands; the twisted square reads as a tent/bell rather than a pyramid because the faces breathe | medium | — |

Falsifiers of the design: a failure below z 39, or the assumed bead producing an under-fused wall that
separates at a window jamb. If the latter happens, GORA becomes the argument for printing C1 first.
