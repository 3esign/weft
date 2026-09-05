# GORA · Ender-3 V4 · X1 — the twisted pyramid (2026-09-05)

**Status: NOT PRINTED. Experimental. Built on an ASSUMED bead (0.42 mm; C1 never printed).**
Pair of [OBLAK](../2026-09-05_OBLAK_A2L_X1_experimental/) — the same twelve instruments on a square base.

| | |
|---|---|
| file to print | `GORA_ENDER3V4_X1_routeB.gcode` (plain G-code, Klipper start block from printllm) — SHA-256 `aa7b687e957e85763814a93783be40c3b88d3ca1b39a611fb9efb643452075b5` |
| size | 151.5 × 153.7 × 191.2 mm on the 220 × 220 plate (margins 33–34 mm) |
| layers | 956 Z levels at 0.20 mm; 1429 emitted paths |
| thread | 583.2 m · 60506 weld nodes · kinematic lower bound 5.4 h (expect 2–3× in reality) |
| grammars (web layers) | {'staple': 581, 'perp': 28, 'sine': 29, 'eight': 24, 'diagonal': 19} |
| gate at the declared 60 mm | PASS — 0 floating, 0 long bridge, 0 cantilever, 63,753 legal bridges, first layer 1 island (`GORA_ENDER3V4_X1_gate.json`) |
| gate at the evidenced 16 mm | 10 findings, **all inside declared zones**: 8 lintel chords (both rails of the four windows, 21.9–55.7 mm) + 2 first-iris chords (23.3 mm) (`GORA_ENDER3V4_X1_gate_at_16mm.json`) |
| self-overlaps reported by the emitter | 115 (all on window-arc web layers at the arc ends, z 68–79; local double deposits at the jambs, not gate-relevant) |

## The body
Twisted rounded square: base 134 mm (half-side 67, corner 12), top 28 mm, 0.20 turns over 190 mm; faces breathe
concave/convex with height, a 6-fold ripple and a fine corrugation that fades toward the top; the wall depth
3.2 → 2.6 → 2.2 → 1.8 mm breathes with the four faces. Grammar bands: staple → perp → sine → staple → eight → diagonal → staple.

## The instruments (read them by height — the first failure names the limit)
- **Lintels** (flat window tops, chords over air) — 20 mm (measured chord 20.6) at azimuth 0°, 30 mm (measured chord 29.8) at azimuth 90°, 40 mm (measured chord 39.7) at azimuth 180°, 50 mm (measured chord 50.5) at azimuth 270°; all four lintels are laid in one chord layer at z 83.6 mm.
- **Horns** (hollow lattice lobes growing out at 0.8 mm/layer, then back) — 20 mm at 0° (z 104.4–115.2), 30 mm at 90° (z 117.8–133.8), 40 mm at 180° (z 131.2–152.0), 50 mm at 270° (z 144.4–170.4).
- **Crown** — `crown-woven-iris/v1` (experimental): the ring is followed to a 31.0 mm hole, then six layers of straight chords (first free span 26.4 mm, later ≤ 12.4 mm), each later layer resting on the crossings of the one below. Not the inward spiral that failed on both machines (LIMIT16 cell 15).
- **Twist** 0.2 turns; the weld columns are helices.

## Files
`GORA_ENDER3V4_X1_geometry.json` (level-2 layers: contours, open arcs, typed iris chords, foundation) ·
`*_report.json` (emitter report incl. `gateAtEvidencedCeiling`) · `*_gate.json` / `*_gate_at_16mm.json` ·
`*_preview.png|svg` · `manifest.json` (receipt) · `PREDICTIONS.md` (written before printing) ·
`PROTOCOL.md` (print + photograph + measure) · `build.log` · `_transfer/` (the chunks the file crossed the bridge in).

Rebuild: `python weft.py build sculpture --variant gora --machine ender --i-know-the-bead-is-a-guess --allow-experimental-bridge --out <dir> --name GORA_ENDER3V4_X1`
(needs Python 3 + numpy/scipy/scikit-image and Node + Playwright Chromium).
