# PREDICTIONS — ZIGURAT VRTLOG · Ender-3 V4 · X1 (written 2026-09-17, before any print)

The Ender's bead (0.42 mm) is ASSUMED; C1 has never been printed on it. GORA (191 mm, 583 m) printed to
completion on this machine on that assumption, with lintels 30/40/50 held and the iris closed; LIMIT16 gave
16 mm continuous. Every prediction carries the assumed bead on top of its own uncertainty.

Three concentric rounded-square tubes (172.6 / 112.2 / 51.8 mm centreline), each ending 34 mm above the one
outside it, terraces over 30.2 mm gaps, a Hilbert roof on the top. Sine grammar throughout, K 48 visible
(24 hidden); a 1.4 mm wave climbs each tier helically (four waves round, 24 mm rise); the base tier stands
square, the middle tier is wrung an eighth of a turn (45°) over 34 mm, the top wrung back an eighth; four
8 mm horns on the top tube's corners at z 83–88.

| # | instrument | prediction | confidence | evidence |
|---|---|---|---|---|
| 1 | Foundation — three tubes, rings + spokes, ribs across the gaps, the 2x2 floor cross; 6 mm brim; one island | holds; the Ender's bed held GORA (152 x 154) and the Vrtlog; 189 mm is new for it | medium | GORA, Vrtlog, LIMIT16 Ender |
| 2 | Tier 1 (sine, K 48, wave 1.4 mm, no twist), z 0–34 | prints; the climbing wave reads as a diagonal ripple | medium-high | GORA sine band; Vrtlog |
| 3 | Hidden tubes 2 and 3 inside tier 1 (staple K 24); tube 3 stands rotated 45° inside tube 2 from the bed up | print; the rotated inner square shows through as a moiré | medium-high | — |
| 4 | Terrace 1 (z 34, gap 30.2): two radial layers (76 chords, side 30.3, corner diagonals 47.8), two diamond layers, two fine | side chords hold (GORA held 30); the 48 mm corner diagonals are the risk on this machine — expect sag 5–10 mm, possibly one strand down at a corner | low-medium | GORA lintel 50 held on this machine, 40 held; bridge speed 15 mm/s |
| 5 | Tier 2 (sine, K 48, 45° twist over 34 mm — 0.40 mm/layer at the corners), z 34–68 | prints; the wrung square is the most visible thing on the object; the corners lean 0.4 mm/layer, half the horn rate that printed on GORA | medium | GORA twist; GORA horns 0.8 mm/layer |
| 6 | Terrace 2 (z 68, gap 30.2, 50 radial chords) on a rim rotated 45° and an inner tube rotated the same | as terrace 1 | as 4 | as 4 |
| 7 | Tier 3 (sine, K 48, wrung back 45° over 34 mm), z 68–102, with the four 8 mm corner horns at z 83–88 | prints; the horns are small (8 mm, 0.8 mm/layer, gentle flanks) and read as knuckles on the corners; fraying at the tips possible (OBLAK 50 mm horn frayed, 30/40 did not) | medium-high | OBLAK/GORA horns |
| 8 | Roof — `crown-woven-grid/v1`, Hilbert 2x2 (first span 49.0, two X then two Y), 4x4 (24.5 → 12.2), 8x8 (12.2 → 6.1), 16x16 (6.1 → 3.1); 12 layers, 2.4 mm | the first centre chord (49 mm) sags 4–8 mm; the 4x4 lines land on it below the plane; from 8x8 on every span is inside the qualified 16 mm; the roof closes as a dish with 3 mm openings | low-medium | GORA iris (26 mm first span) closed cleanly on this machine; a 49 mm single chord on the Ender has not been printed |
| 9 | Travels — 573 jumps inside the object, ≤ 32 mm | strings inside, not structural | high | GORA/OBLAK |
| 10 | Overall | completes; stands; ~0.73 km thread, ~32 m filament, ~95 g; GORA's 583 m took ≤ 21 h → expect ~26–30 h; reads as a wrung ziggurat | medium | GORA |

Falsifiers: an under-fused wall (assumed bead) separating at a terrace landing — the argument for printing C1
first, again; the terrace-1 corner diagonals all dropping (then the terrace idea needs a corner post before
the diagonal, not a longer declared ceiling). The roof's sag is the measurement.
