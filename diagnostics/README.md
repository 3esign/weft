# diagnostics — what the eye must confirm

## studio_preview_verdict.ps1 — is the container pre-sliced?

```
powershell -ExecutionPolicy Bypass -File diagnostics/studio_preview_verdict.ps1 `
  -f "<abs path to .gcode.3mf>" -out "<abs path to .png>"
```

Kills every running Bambu Studio, opens the file alone, clicks **Preview**, screenshots.

**Read the screenshot, not the Prepare tab.** A genuine Studio-exported `.gcode.3mf`
(`T1b_A1_sliced.3mf`, harvested from a real A1 print) opens on **Prepare** with
`Slice plate` green and `Print plate` greyed — exactly like ours. That is Studio's
normal landing state and it says nothing about whether a slice result exists.

The slice result lives in **Preview**: the `Slicing Result` panel fills in
(filament m / g, time estimate), the layer slider shows the real layer count, and
`Print plate` turns green. Verified 2026-10-02 on all three pure-weft A1 bodies
(100 / 83 / 125 layers) and on the genuine template as control (409 layers).
