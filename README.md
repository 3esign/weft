# WEFT — Continuous Lattice Toolpath Studio

> **2026-09-08 — runs without a browser and without a model.** `node weft.mjs build --preset <name> --machine a2l --out DIR`
> makes the thread, the G-code, runs the final-G-code gate, rewrites the header and packs the Bambu container with
> Node alone (`core/weft_core.js` is the engine the app itself loads; `core/weft_gate.js` is `check_gcode.py` in
> JavaScript). `index.html` runs the same gate before it offers a download. See `USAGE.md`.

Research software for a method of extrusion 3D printing in which walls are built as
**woven lattices**: a single continuous thread per layer, with structure arising from
discrete **weld nodes** where each layer's thread crosses the one below, rather than
from bulk material contact. Layer roles alternate by a grammar (chords / webs), with
phase-locked registration so weld columns stack vertically. The long-term target is
continuous-toolpath concrete printing; polymer is the research vehicle.

Author: Semir Poturak · poturaksemir@gmail.com

---

## Run locally (offline-capable)

Everything is a single static page with a vendored Three.js — **no internet, no
build step, no install required**:

1. Double-click `index.html`. That's it.

If your browser is strict about `file://` (rare), serve the folder instead:

```
python -m http.server 8000        # then open http://localhost:8000
# or:  npx serve .
```

Web fonts load from Google Fonts when online and degrade gracefully to system
fonts offline. All geometry, exports and OBJ import work offline.

## Folder layout

```
weft/
├── index.html          the entire application (WEFT phase 2)
├── vendor/three.min.js Three.js r128, vendored (byte-identical to npm three@0.128.0)
├── paper/              manuscript draft (docx) + verified reference list
├── specimens/          knowledge base: printed-specimen records (tracked in git)
├── tests/              headless verification harness (see Verification below)
├── exports/            STL / G-code outputs (gitignored)
└── README.md
```

## What the app does (short version)

- **Modeler**: plan-curve walls (click / insert-on-line / drag / right-click-delete
  editor), partial-to-full domes with spiral cap closure, OBJ import of open
  single-surface meshes, and a batch specimen-array mode for the Bambu A2L
  (330 mm bed) sweeping two parameters across a grid.
- **Pattern grammar**: editable layer cycle; web types **Diag** (truss),
  **Perp** (square wave offset beyond the chords), **Staple** (runs on the chords
  + symmetric overhang tabs), **Sine** (self-bracing), **8** (prolate-cycloid loop
  stitch — self-crossing cells that hook around the chord below).
- **Weld control**: overhang extension (e), apex dwell landings, seeded phase
  jitter, per-node flow boost in G-code, crossing-accurate node placement.
- **Density**: dyadic auto-LOD (knitting decreases — registration preserved
  through every decimation boundary) and an optional lean-graded density policy
  (spacing follows overhang demand instead of radius).
- **Checks**: same-layer overlap detection, web/chord span vs. max-bridge,
  min node gap, bed fit, STL size estimate, layer slider + loom navigator.
- **First layer**: independently stamped bead width and speed, plus dome-only
  built-in **brim** or **filled annular foundation**. The same support geometry
  is present in Route A STL and Route B G-code; crown closure uses filled,
  overlapping spiral turns and scales to large hemispheres.
- **Export**: thin-wall **STL** (Route A — slice normally in Bambu Studio;
  Arachne recovers each layer as one continuous bead) and native **G-code**
  (Route B — motion only; paste the start/end blocks harvested from any file
  Bambu Studio slices for your printer). Route B emits slicer-standard
  extrusion volume (stadium bead cross-section), true first-layer slowdown,
  part-fan on after layer 1, and retract + z-hop on hops between batch
  specimens (never inside an object — the thread stays continuous). Both
  exports are chunked/async with progress; paths are simplified
  (0.02–0.03 mm tolerance) before emission.

## Print safety workflow (A1 / A2L)

1. Calibrate: find the exact single-line width Arachne accepts for your nozzle;
   set it as bead width.
2. **Route A first**: export STL → open in Bambu Studio → slice → check the
   preview shows single continuous lines → print. Studio owns all
   machine-specific startup; there is nothing to break.
   When built-in adhesion is enabled, set elephant-foot compensation and XY
   contour compensation to 0 and do not add a second slicer brim.
3. **Route B**: slice any small object in Studio, copy everything before the
   first extruding move into WEFT's header field (and the end block into the
   footer). Export G-code → **drag the .gcode file onto Bambu Studio's
   Preview tab** (preview-only import; there is no File→Import menu entry for
   G-code) → **inspect the preview** → print. If Route A and Route B previews
   match, the emitter is sound.

## Verification

The geometric invariants (phase lock, width-wave registration, miter widths,
grammar dimensions, loop-stitch crossing counts, LOD/grading bands, E1 plate
reproducibility, G-code safety rules, STL orientation) run as a headless
suite against the real app:

```
npm install        # dev-only: playwright
npm test           # 56 checks, ~20 s on the current PC
```

The E1 plate in `specimens/` regenerates from the app bit-for-bit
(triangle count, bbox and coordinate checksum are asserted in the suite).
The large D5 R90 preset is separately locked by crown, foundation, bed-fit,
overlap, first-layer speed and first-layer bead assertions.

## Roadmap (honest)

Done: everything above, with the geometric verification now committed as a
reproducible test suite (`tests/`).
Pending (gated on first prints): weld-rigidity experiment (perp vs diag),
overshoot sweep, overhang-vs-density experiment, specimen manifest export,
structural frame solver with empirical joint stiffness, wall merging for
converging plans, conformal parameterization for tapered imports, lean grading
for imported meshes.

## Deploy

Static site. Push to GitHub, import in Vercel with framework preset **Other**,
no build command, no output directory. The `vendor/` folder deploys with it.
