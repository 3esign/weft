# RAZMAK — Send Print package revision

Open **RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf** directly in Bambu Studio and use the
normal printer-selection/send workflow. Do not reslice the reference STL.

This revision replaces the incompatible rectangular report thumbnails with square
512 x 512 RGBA images and a 128 x 128 small image. Only five PNG archive members
changed; the G-code payload and all other members are byte-identical to the prior
delivery. The first-layer correction is retained.

Package SHA-256:
`0f24dc839a2aaa0b057a66895cfa6e6853199debecb999a444e9bdcd5a9b4e08`

See `manifest.json` and `TESTS.json`. The native Send Print result is pending a
user retry. The original build receipt remains historical and does not certify
that the original rectangular thumbnails were compatible.

Honest verdict: digital package checks pass; actual app send and physical print
not confirmed. Experimental spans, physical uncertainties and predictions remain
as recorded in `../PREDICTIONS.md`.
