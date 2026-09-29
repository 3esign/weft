# VEZ_ENDER_X2 — recovery record (2026-09-30)

The VEZ experiment was built and documented entirely inside the session folder
`C:\Svemir\data\sessions\c1790450370386uwpy\weft\` (26–27.09.2026, codex `gpt-6-astra` building,
a claude mind reviewing). By 2026-09-30 most of those files were gone from disk — only the
13 print photographs, the X1 iteration G-codes and a runtime copy of the weft core survived there.

## What was recovered, and how

Source: the Codex rollout transcripts (full `apply_patch` payloads), replayed patch-by-patch:

- `.codex/sessions/2026/09/26/rollout-2026-09-26T21-23-22-01a0df2c-….jsonl`
- `.codex/sessions/2026/09/26/rollout-2026-09-26T21-32-41-01a0df34-….jsonl`
- `.codex/sessions/2026/09/27/rollout-2026-09-27T13-14-18-01a0e292-….jsonl`

Recovered into `recovered/` (final replayed versions, NOT byte-certified against the deleted originals):

| file | what it is |
|---|---|
| `generate-vez.mjs` | the V2 generator, `pre-tied-closed-corbel/v1` (12 sectors × 4 teeth, reaches 24/30/36 mm, tip arcs 2.4/3.2 mm, ties only the old frontier — no radial replay) |
| `finalize-vez.mjs` | gate + packaging pipeline used for the specimen |
| `vez-regression.test.mjs` | positive control: V1 really had >500 mm of repeated strand lap, V2 has none (was 5/5 PASS in session) |
| `review-vez.md` | the independent read-only review that refused V1 |
| `G-3055.md` | the lesson: pre-tying must not replay full-reach teeth in the same layer |

Recovered directly (not reconstructions):

- `photos/2026-09-27_semir/` — 13 camera originals, SHA-256 parity with the phone 13/13 (`manifest.json`)
- `iterations/01_before_overlap_review/` — VEZ_A2L_X1 and VEZ_ENDER_X1 G-code + geometry (V1, pre-review)
- `manifest.json`, `outcomes.md` body — written by the session itself

## What is lost

- `VEZ_ENDER_X2.gcode` — the exact bytes sent to the printer (Creality log
  `debug_Sun_Sep_27_08_29_33_9036.log.0`, send 2026-09-27 08:30:58 → 192.168.1.5). No copy found on
  C:, in `_to_delete/`, or in the session folder. Regenerating from `recovered/generate-vez.mjs` is
  possible but the output would be labelled REGENERATED, never the executed original.
- `KNOWLEDGE.md` / `LOG.md` / `photo-observations.md` of the session — only fragments survive in the
  rollouts; the load-bearing lessons are carried in `review-vez.md`, `G-3055.md` and this record.

## The lesson (goes with G-3055's sibling)

Evidence written only into a session folder dies with the session's hygiene cycle. A specimen's
photographs, manifests, outcomes and generator belong in `weft/specimens/<specimen>/` in the same
breath they are produced. This recovery took a rollout archaeology pass that will not always be possible.
