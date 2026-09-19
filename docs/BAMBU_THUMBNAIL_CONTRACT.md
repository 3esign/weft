# Bambu Send Print — G-668, 2026-09-19

Semir reports that RAZMAK opens in Bambu Studio, then the application exits after
confirming Send Print in the printer-selection dialog. Installed executable and
the encrypted-log header identify **02.07.01.62**. The Windows Application log,
WER folders and Studio log folder supplied no matching crash dump/stack trace.
Encrypted log bodies were not decoded, copied or uploaded.

## Reproduced compatibility fault

The delivered package used the report's **1400 x 1600 RGB PNG** in every thumbnail
slot. The installed-version source creates a 128 x 128 small thumbnail during
3MF re-export, deriving distinct horizontal and vertical strides. Its destination
index uses those strides in the opposite axes. For our image, the safe arithmetic
reproduction yields **2,688 out-of-range pixel writes**, reaching index **19,561**
in a **16,384-pixel** buffer. A 512 x 512 input yields zero out-of-range indices.

Primary sources, pinned to commit `42d319c6692fa8e64790fddf0cdaafd2a4254bcc`:

- [Native thumbnail writer, lines 6732–6760](https://github.com/bambulab/BambuStudio/blob/42d319c6692fa8e64790fddf0cdaafd2a4254bcc/src/libslic3r/Format/bbs_3mf.cpp#L6732-L6760).
- [Small-thumbnail constants](https://github.com/bambulab/BambuStudio/blob/42d319c6692fa8e64790fddf0cdaafd2a4254bcc/src/libslic3r/Format/bbs_3mf.hpp).
- [Send Print prepares G-code, then exports cloud configuration, lines 3085–3113](https://github.com/bambulab/BambuStudio/blob/42d319c6692fa8e64790fddf0cdaafd2a4254bcc/src/slic3r/GUI/SelectMachine.cpp#L3085-L3113).
- [Configuration export, lines 21820–21838](https://github.com/bambulab/BambuStudio/blob/42d319c6692fa8e64790fddf0cdaafd2a4254bcc/src/slic3r/GUI/Plater.cpp#L21820-L21838).

This is a reproducible unsafe operation and a strong explanation for the reported
timing. Without a crash dump or a native retry, it is not proof that this was the
only cause of the user's application exit. RGB alone is not the cause: the loader
checks for alpha, and existing printed 1000 x 1000 RGB templates are safe here.

## Shared packaging rule

`core/weft_bambu_thumbnails.mjs` decodes bounded, non-interlaced 8-bit RGB/RGBA PNGs
with CRC/length/filter checks. New `--thumb` images become aspect-preserving
512 x 512 RGBA thumbnails plus a genuine 128 x 128 small image. Report artwork
remains unchanged outside the package. Unsupported/corrupt images are refused.

All five final image slots must exist exactly once, decode, be square and between
128 and 2048 pixels. Plate/no-light dimensions must match. Safe historical square
RGB templates remain byte-identical: changing their channels or requiring an exact
128 multiple was unnecessarily strict and initially broke printed LIMIT16 parity.

`packBambu3mf` validates before writing, both with and without a replacement image.
The legacy `pack_bambu_3mf.py` command delegates its arguments to the shared Node
packer; it cannot bypass image or first-layer checks. Node is required for that
legacy entry point. `audit_suspended_steps.mjs` checks normalized image provenance
and compatibility, replacing its old “all images equal the report PNG” rule.

The existing single-filament display-proxy convention for top/pick/no-light slots
is retained. These are not semantic object-picking or inspection maps. Object
label/cancellation remains disabled in this specimen's inherited slice metadata.

## Revised delivery and verification

Use [RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf](../specimens/2026-09-19_RAZMAK_A2L_H4_experimental/SEND_PRINT_FIX/RAZMAK_A2L_H4_SEND_FIXED.gcode.3mf).
The original package and frozen delivery receipt remain unchanged.

The new [revision receipt](../specimens/2026-09-19_RAZMAK_A2L_H4_experimental/SEND_PRINT_FIX/manifest.json)
binds old/new hashes and proves that **only five PNG members changed**. Every byte
of the extracted 82,747,836-byte G-code payload, MD5, and every other member is
identical. The original independently gated payload therefore retains its exact
2,360,817-point gate result; no geometry check was inferred from a similar model.
The first-layer audit was rerun on the final extracted bytes: Z0.24, 3,522 segments.

`tests/bambu_thumbnails.test.mjs` reproduces the unsafe native index without
writing outside native memory; covers square output, framing, real RGB input,
PNG row filters 0–4, corrupt data, missing slots, inherited rectangular refusal,
and preservation of an existing output on failure. It is in `npm test`.
First-layer and printed LIMIT16 build/package parity also pass. A real Python
wrapper invocation produces a validated package. Receipts: `SEND_PRINT_FIX/TESTS.json`.

Honest verdict: package contents, safe index arithmetic and relevant regressions
verified. Actual Send Print, network transfer and a new Bambu print have not been
performed by the agent. The prior full-suite baseline remains 49/61 legacy;
the full suite was not rerun for this package-only correction.
