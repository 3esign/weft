# OBLAK · Bambu Lab A2L · X1 — the woven sphere (2026-09-05)

**Status: NOT PRINTED. Experimental (declared bridge ceiling 60 mm over the evidenced 16 mm).**
Pair of [GORA](../2026-09-05_GORA_ENDER3V4_X1_experimental/) — the same twelve instruments on the Ender's square base.

| | |
|---|---|
| **file to print** | `OBLAK_A2L_X1.gcode.3mf` (packed from Semir's own A2L container; thumbnail = the preview) — SHA-256 `df66e345088c1240c3e340441563e1bf534119fb46a60070dcd38872c41454fd` |
| raw G-code | `OBLAK_A2L_X1_routeB.gcode` — SHA-256 `3ef59d066c20b818d222e85b6720765490ac77139e72c0969a0d978bad1bce4e` (reassembled from `_transfer/`) |
| size | 274 × 264.5 × 190.8 mm on the 330 × 320 plate (margins 28–34 mm); the body stays inside a 28 cm envelope (max radius 139 mm) |
| layers | 795 Z levels at 0.24 mm; 1127 emitted paths |
| thread | 990.5 m · 73882 weld nodes · 43 m / 130 g filament · kinematic lower bound 9.17 h, packer 16 h, expect 20–30 h (D5: 26 h) |
| grammars (web layers) | {'staple': 406, 'perp': 36, 'sine': 35, 'eight': 28, 'diagonal': 23} |
| gate at the declared 60 mm | PASS — 0 floating, 0 long bridge, 0 cantilever, 84,196 legal bridges, first layer 1 island (`OBLAK_A2L_X1_gate.json`) |
| gate at the evidenced 16 mm | 10 findings, **all inside declared zones**: 6 lintel chords (both rails of the three windows: 27.5 / 32.8, 39.8 / 45.0, 50.4 / 52.4 mm) + 4 iris chords (28.4–28.9 mm first layer, 17.9 mm third layer) (`OBLAK_A2L_X1_gate_at_16mm.json`) |
| self-overlaps reported by the emitter | 321 (on window-arc web layers at the arc ends, z 94–125: local double deposits at the jambs; not gate-relevant) |

## The body
A sphere of nominal radius 127 mm cut where its wall leans 30° outward (the base ring sits on 10 foundation
rings + 48 spokes, one island), followed up to a 35.7 mm crown hole. Three lobes anchored to the twisting
material frame, a 5- and a 7-fold family that drift with height, a 24-fold corrugation that fades toward the
crown; twist 0.35 turns (the weld columns are helices, 0.354 mm tangential per layer at the widest);
wall depth 3.6 → 2.8 → 2.4 → 1.8 mm, breathing 25 % in phase with the three lobes (thick on the crest).
Grammar bands: staple → perp → sine → eight → diagonal → staple (perp with tab 0; sine/eight/diagonal at K 192).

## The instruments (read them by height — the first failure names the limit)
- **Lintels** (windows with flat tops; the first ring above is a chord over air): 30 mm (measured chord 28.9) at azimuth 30°, z 98.4–125.28, 40 mm (measured chord 41.0) at azimuth 150°, z 89.28–125.28, 50 mm (measured chord 49.7) at azimuth 270°, z 80.16–125.28.
- **Horns** (hollow lattice lobes growing out at 0.8 mm/layer, holding, and coming back): 30 mm at 90° (z 125.04–144.24), 40 mm at 210° (z 134.4–159.36), 50 mm at 330° (z 145.92–177.12). Max radius reached 136.6 mm.
- **Crown** — `crown-woven-iris/v1` (experimental): six layers of straight chords over the 35.7 mm hole, first free span 30.7 mm, later ≤ 18 mm, each later layer resting on the crossings of the one below; the ring is re-laid on every iris layer so every chord end has a rim under it. Not the inward spiral that failed on both machines.

## Files
`OBLAK_A2L_X1_geometry.json.gz` (level-2 truth, gzip) · `*_report.json` (emitter report incl. `gateAtEvidencedCeiling`) ·
`*_gate.json` / `*_gate_at_16mm.json` · `*_preview.png|svg` · `manifest.json` (receipt, SHA-256 of both files) ·
`PREDICTIONS.md` (before printing) · `PROTOCOL.md` (print, photograph, measure) · `build.log` · `_transfer/`.

Rebuild: `python weft.py build sculpture --variant oblak --machine a2l --allow-experimental-bridge --out <dir> --name OBLAK_A2L_X1`
