# OBLAK A2L X1 — physical outcome (read 8 September 2026)

Evidence: seven photographs by Semir (Galaxy S23 FE; EXIF 6 September 12:19–12:20 and 9 September 00:09–00:10 local),
received in the Cowork chat on 8 September and archived unchanged with SHA-256 in `photos/2026-09-08_semir/manifest.json`.
Read by: `svemir-claude-fable-cowork` — every frame opened at full resolution; nothing below is quoted from anyone
else's reading. Artifact: `OBLAK_A2L_X1.gcode.3mf` (raw G-code SHA-256 `3ef59d06…`, re-verified against `manifest.json`
in the cloud the same day). Binding of photographs to artifact: colour (black body on green first layers), the A2L in frame,
and the unique geometry (three horns, three windows, woven-iris crown); no printer-history receipt.

**Headline: OBLAK printed to full height (190.8 mm, 795 Z levels) on the A2L and stands on the plate.** Every instrument
declared over the evidence — lintels 30/40/50 mm, horns 30/40/50 mm, the woven-iris crown — was executed; none brought the body
down. The two degradations are at the crown approach and at the tip of the 50 mm horn; the strings in the windows are travel,
not deposition.

## Answers to `PREDICTIONS.md` (written 5 September, never rewritten)

| # | instrument | prediction (confidence) | what the photographs show | verdict |
|---|---|---|---|---|
| 1 | Foundation, 30° outward foot | holds; foot prints clean (high) | green foundation and the black foot ring on it; the leaning lower hemisphere is complete and smooth (01, 07) | **confirmed** |
| 2 | Body to the equator, five grammar bands | prints; no dropped layers (medium-high) | full body, no dropped layer, no seam step; the bands read as texture changes; the perp band is not separable in these frames | **confirmed** (band-by-band not resolved) |
| 3 | Breathing wall | invisible at arm's length (medium) | the three lobes are legible in the overhead outline (07); the thickness modulation itself is not resolvable | not resolvable |
| 4 | Twist 0.35 — helical weld columns | prints without seam drift; helices from 1 m (medium) | the diagonal stripes over the whole body *are* the weld columns as helices (01, 02); no seam drift | **confirmed** |
| 5 | Windows: jambs, racetrack ends | jambs clean; rounded vertical edge (medium-high) | the arc ends stack into a clean edge (05); strings hang from the jambs into the opening (see *Travel*) | **confirmed**; strings are travel |
| 6 | Lintel 30 mm | holds, sag ≤ 2 mm (medium) | flat top over the opening, the ring above sits on both jambs (01, 07) | **held**; sag not measured |
| 7 | Lintel 40 mm | holds, sag 2–5 mm, possible dropped strand (low-medium) | no hanging rail in any frame | **held**, better than predicted; sag not measured |
| 8 | Lintel 50 mm | sags 5–10 mm or one rail breaks (low) | no hanging rail, no broken chord visible (01, 07) | **held**, better than predicted; sag not measured |
| 9 | Horn 30 mm | prints, tip droop ≤ 3 mm (medium) | crisp horn, tip sharp (02) | **confirmed**; droop not measured |
| 10 | Horn 40 mm | droop 3–8 mm, possible curl (low-medium) | crisp horn (01, 07) | **confirmed**, better than predicted |
| 11 | Horn 50 mm | the likely failure: droop > 8 mm or a curled flank the nozzle catches (low) | the horn reached full projection; over the last ~10 mm the crest of web loops at the tip has separated into a frayed comb (06); no curl, no collision, body untouched | **degraded, not lost** — failure mode was fraying of the tip crest, not droop |
| 12 | Crown approach (rings stepping in on tabs) | prints as on the D5 (medium-high) | the rings are tidy until roughly r ≈ 25–30 mm, then visibly wavy: rungs loop, rails wander between tab tips, the rim under the iris is irregular (04, 05) | **not as predicted** — this is the weak link |
| 13 | Crown iris v1 (six chord layers over the 35.7 mm hole) | first chords sag 3–8 mm but hold; disc closes as a woven star with ~5–8 mm openings; if it fails, sagged chords, not a tangle (low-medium) | the chords are straight and taut, no visible sag, no tangle; they cross as a star but the openings between them are larger than predicted (estimated 10–15 mm), because the outer chords lie on the wavy rim of #12 | **partly confirmed** — the primitive works; the rim it needs was not sound |
| 14 | Overall | completes in 20–30 h; stands; woven surface legible from 2 m (medium) | complete; on the plate on 6 September 12:19 and still on 9 September 00:10; surface legible; duration not recorded (build file 5 September 02:33 Z → finished before 6 September 12:19) | **confirmed** except duration |

Falsifiers named in the predictions — a body failure below z 80, or a lintel pulling the ring above off its jambs — did not occur.

## Measured from the printed file (not from the photographs)

**Travel through the void.** In the window band (z 80–125.3) the single thread is cut at every window on every layer and
the nozzle jumps: 412 travel moves ≥ 20 mm, 45.6 m of travel in total, every one with a 0.8 mm retraction and a 0.4 mm
z-hop. 242 of them are jamb-to-jamb jumps across a window (25–65 mm); **169 are 150–300 mm** — the return from the last
arc of one layer to the first arc of the next, straight across the interior of the sphere. The strings in the openings
(05) and the fringe at the jambs are these travels. The gate does not see them by definition (it judges deposition only).
The fix is in the compiler, not on the printer: start each layer where the previous ended (removes the 169 long jumps,
≈ 34 m of the 45.6 m) and order the arcs so consecutive arcs share a window.

**Crown approach.** From z 182.2 to 189.4 the inner rail steps inward per chord layer by 0.93, 0.99, 1.08, 1.15, 1.24,
1.34, 1.46, 1.59, 1.71, 1.86, 1.99, 2.16, 2.38, 2.68 and 3.11 mm (wall depth 1.8 mm, K 24 near the hole). The web layer
between two chord layers puts its inner tab tips on the *next* rail, so the last rings rest on 24 tabs of 2–3 mm
cantilever, 5–6 mm apart. Every one of those tabs is inside the gate's 4.8 mm cantilever rule; the photographs put the
onset of visible waviness where the step passes roughly 1.7–2 mm. (GORA's approach steps 0.11 mm per chord layer and its
rim is clean — see its `outcomes.md`.) A crown-approach rule of the form *inward step per chord layer ≤ ~1.5 mm at K 24,
or K held at 48 until the hole* is the candidate; it needs one instrumented plate to become a number.

## Not measured
Lintel sag (no frame from below with a scale), horn droop, mass, crown-hole and opening diameters, print duration,
removal survival, filament and room temperature. The object was on the plate at the time of the last photograph.

## What this changes in the record
- `README.md` in this folder and `SCULPTURES_2026-09-05.md` say "NOT PRINTED"; that was true on 5 September and is not
  true since 6 September. This file is the answer; the folder keeps its name until Semir renames it `_physical`
  (`PROTOCOL.md`, "after printing").
- `evidence/SPECIMEN_LEDGER.md` gains a row (OBLAK, A2L, route B via 3MF, 6 September).
- For the gate: three phenomena outside its domain were observed at once on one object and none was catastrophic —
  travel strings, tab-supported ring waviness, horn-tip fraying. They are process findings, and they are the reason the
  paper's PASS must be read as *geometric support*, exactly as the membrane contract already says.

## Honest verdict
Checked: seven frames opened at full resolution; SHA-256 of the archived copies; SHA-256 of the printed G-code against the
manifest; the travel and crown numbers recomputed from that G-code in the cloud. Concluded, not measured: "held" for the
lintels means no hanging rail is visible from the outside and from above — sag is unknown; the crown openings and the
onset radius of waviness are estimated by eye from two frames. Not seen: the underside of any lintel, the horn tips from
the side with a scale, the object off the plate. Not done: the `_physical` rename (Semir's protocol step).
