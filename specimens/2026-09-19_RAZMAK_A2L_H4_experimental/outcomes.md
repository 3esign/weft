# RAZMAK_A2L_H4 — current outcome

**NOT PRINTED / EXPERIMENTAL.** Digital design, final-file checks and predictions prepared 2026-09-19. No printer upload, physical specimen or measured sag exists for this new model in this record.

Prior X2 photographs motivate this test but are not photographs of this geometry. [Prediction record](PREDICTIONS.md) · [Delivery](README.md).

When printed, record the exact executed file/hash, machine and settings, completion or interruption, observed first-deformation height, calibrated before/after views, underside, material and any measured mass. Keep hypotheses separate from observations.

Honest verdict: digital evidence only; physical response unknown.

## 2026-09-19 — later operator report

Semir reports the Bambu package opens, but the application exits on every Send Print click. No new print is confirmed. Status: SEND BLOCKED / EXPERIMENTAL; package/application diagnosis in progress. Earlier dated digital receipt remains unchanged.

## 2026-09-19 — package revision prepared

The Send Print diagnostic identified an unsafe native thumbnail index for the original rectangular report image. Replacement: [RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf](SEND_PRINT_FIX/RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf). Only five PNG members changed; executable payload is byte-identical. Package and first-layer checks pass; actual send/print result is pending. See SEND_PRINT_FIX/manifest.json and ../../docs/BAMBU_THUMBNAIL_CONTRACT.md.

## 2026-09-19T12:12:07.435Z — operator confirms send succeeded

Semir confirms successful sending after the package correction ("poslato... bice zanimljivo.. javljam se", followed by "sve ok."). This confirms the operator-observed send workflow succeeded; print completion, physical result and exact executed-file checksum remain unverified. Status: SENT / EXPERIMENTAL; physical outcome pending. The preceding pending-send records remain dated history.

## 2026-09-23 — print started, then stopped by the operator at terrace 1

Status: **INTERRUPTED / EXPERIMENTAL**. Semir started this file on the Bambu A2L and stopped it during the
first terrace (nominal z 72–74.88 mm, print layers 301–312, about a quarter of the 309.84 mm height), because
the nozzle had begun dragging loosened strands and there was a real risk of a blob forming on the nozzle and
fouling the machine. Stopping was his call and the photographs support it.

What the photographs show, as observation rather than measurement: the terrace formed **as intended on the long
straight runs** — flat, evenly spaced returning hairpins with clean looped tips, lying horizontally in air — and
went to **tangled nests where the return is longest**, with loose strands lifted, curled and then dragged across
the surface by the nozzle. The failure is local, not general, and it is local to the longest returns.

Measured afterwards from the delivered geometry: `FINDINGS_2026-09-23_terrace_measurement.md` in this folder.
The first layer of terrace-1 has a free reach of **20.1 mm at its shortest tip** and a median of 28.6 mm, against
6.6 mm and 18.1 mm for the terrace of OBRTAJ that printed flat — no short tip anywhere on this terrace to carry
its neighbours. Terrace-2 reaches a p90 of 40.5 mm.

No mass, deflection or executed-file checksum was recorded, and the object was not completed. The earlier dated
receipts, the send-fix record and the digital gate verdicts stand unchanged.

Honest verdict: an interrupted print, stopped for machine safety. It yields one usable result — the returning
hairpin holds on the short runs of this machine and fails on the long ones — and it does not establish where
between 25 mm and 29 mm the limit sits, because layer height and speed differ from the run that held.
