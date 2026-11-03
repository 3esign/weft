# 2026-11-03 · `KOCKA_REVERZ` — Single-Thread Revertible Hollow Cube Sculptures (Bambu 25×25 cm & Creality 15×15 cm)

Two finished, gate-verified **single-thread (`pure weft`)** hollow cube sculptures designed to maximize structural hollowness (`98.12%` and `98.79%` air), minimize point-weld count (`varovi`), combine decorative 3D facade reliefs with a morphing inner hollow pavilion sculpture, vary layer patterns across 5 structural registers, and allow the entire printed cube to be **unraveled back into one continuous single thread** from top to bottom.

---

## 1. Deliverables & Verification Summary

| Property | `KOCKA_REVERZ_ENDER_150` (Creality 15×15 cm) | `KOCKA_REVERZ_A2L_250` (Bambu 25×25 cm) |
|---|---|---|
| **Target Printer** | Creality Ender-3 V4 (`220 × 220 × 250 mm`) | Bambu Lab A2L (`340 × 320 × 340 mm`) |
| **Outer Cube Dimensions** | **`150.0 × 150.0 × 150.0 mm`** (`15 × 15 × 15 cm`) | **`250.0 × 250.0 × 249.6 mm`** (`25 × 25 × 25 cm`) |
| **Plate Bounding Box** | `[35.2, 35.2, 184.8, 184.8] mm` | `[40.3, 35.3, 289.7, 284.7] mm` |
| **Layer Height / Layers** | `0.20 mm` · **`750` layers** | `0.24 mm` · **`1,040` layers** |
| **Bead Width** | `0.42 mm` (`ASSUMED`) | `0.45 mm` (`measured`) |
| **Continuous Thread Length** | **`842.8 m`** (1 continuous helical strand) | **`1,968.2 m`** (1 continuous helical strand) |
| **Point-Welds (`varovi`) / Layer** | **`128` point-welds/layer** (`15` facade + `17` inner per quadrant) | **`204` point-welds/layer** (`24` facade + `27` inner per quadrant) |
| **Total Point-Welds (`varovi`)** | **`96,000`** point-crossings (`95,780` S1 bridges) | **`212,160`** point-crossings (`211,823` S1 bridges) |
| **Median Crossing Angle (`S8`)** | **`69.9°`** (`0` self-stacked, `0` A-B-A-B layers) | **`69.6°`** (`0` self-stacked, `0` A-B-A-B layers) |
| **Seam Gap (Unraveling Gap)** | `0.836 – 1.461 mm` (`0` closed loops) | `0.877 – 1.624 mm` (`0` closed loops) |
| **Inter-Layer Travel / Retractions** | **`0.0000 mm` travel** · **`0` body retractions** | **`0.0000 mm` travel** · **`0` body retractions** |
| **Net Filament Mass & Volume** | **`78.87 g`** (`26.44 m` of 1.75 mm filament · `63.6 cm³`) | **`233.5 g`** (`78.29 m` of 1.75 mm filament · `188.3 cm³`) |
| **Relative Density / Hollowness** | `1.88%` solid · **`98.12%` hollow** (`3,375 cm³` cube) | `1.21%` solid · **`98.79%` hollow** (`15,600 cm³` cube) |
| **Estimated Print Time** | **`12h 16m`** | **`26h 14m`** (`25h 05m` in 3MF header) |
| **Gate S1 (Support & Bridges)** | **`PASS`** (`2,175,909` pts · `0` floating · `0` long_bridge · `0` cantilever) | **`PASS`** (`4,851,147` pts · `0` floating · `0` long_bridge · `0` cantilever) |
| **Gate S2–S8 (Layered Veto)** | **`PASS / refuse=false`** (`0` findings · `S3=0` · `S4=0`) | **`PASS / refuse=false`** (`0` findings · `S3=0` · `S4=0`) |
| **`check_pure_weft.mjs`** | **`PASS`** (`750` open body runs · `WALLS 0` · `closed=0`) | **`PASS`** (`1,040` open body runs · `WALLS 0` · `closed=0`) |

---

## 2. Structural & Sculptural Architecture

1. **True Single-Thread Revertibility (`KOCKA_REVERZ`)**:
   - Every layer $k$ is an open $C_4$-symmetric path of $N - 2$ stations whose end point is anchored onto the support zone of layer $k-1$ (`<= 0.38 mm`) while keeping a `0.84 – 1.62 mm` horizontal seam gap from its own layer start.
   - Layer $k+1$ begins at the exact $(x, y)$ coordinate where layer $k$ ended (`maxInterLayerTravel = 0.0000 mm`), with **zero body retractions** (`bodyRetractions = 0`) and **zero closed rings**.
   - Becauseadjacent layers cross at a high median angle (`~69.8°`) only at discrete point-welds (`varovi`) and never fuse into parallel walls (`selfStackedLayers = 0`), pulling the top end of the thread peels one point-weld at a time around the helical seam without knots or ring locks.

2. **Five Distinct Layer-Weave Patterns Across Height $z_f \in [0, 1]$**:
   - **Band I ($z_f \in [0.00, 0.20]$) — `I-diagonal-truss`**: Sharp triangular truss wave $\frac{2}{\pi}\arcsin(\sin\theta)$ for rigid corner and foundation diagonal bracing.
   - **Band II ($z_f \in [0.20, 0.40]$) — `II-sine-mashrabiya`**: Harmonic sinusoidal lattice $\sin\theta$ creating a classical porous mashrabiya screen.
   - **Band III ($z_f \in [0.40, 0.60]$) — `III-staple-arcade`**: Flat-crested hyperbolic-tangent wave $\tanh(2.1\sin\theta)/\tanh(2.1)$ forming rectangular arcade cells.
   - **Band IV ($z_f \in [0.60, 0.80]$) — `IV-biharmonic-rosette`**: Double-crest biharmonic wave $(\sin\theta + 0.28\sin 3\theta)/0.94$ producing ornamental rosette pores.
   - **Band V ($z_f \in [0.80, 1.00]$) — `V-chevron-crown`**: Hybrid chevron crown wave locking the upper gallery and portal arches.
   - All five waveforms share identical zero-crossings at integer multiples of $\pi$ and blend smoothly across band transitions (`fade = 0.025`), preserving 100% point-weld registration across all layers.

3. **Decorative Outer Facade & Morphing Inner Hollow Pavilion**:
   - **Four Sculpted Ogee Portals**: Centered on the North, South, East, and West faces (`21 mm` wide on Ender 150, `35 mm` wide on Bambu 250), breathing smoothly over height to form lower ogee entry arches, a mid-height waisted gallery bridge, and upper lancet rose windows, while the 4 corner pilasters hold the exact `150 × 150 mm` and `250 × 250 mm` cube envelope.
   - **Three-Register Inward Facade Relief**: The 8 facade panels flanking the portals carry purely inward 3D relief (`0 – 4.6 mm` on Ender, `0 – 7.7 mm` on Bambu): pointed lancet niches below ($z_f \in [0.04, 0.38]$), concentric diamond-rose medallions in the middle ($z_f \in [0.34, 0.68]$), and triple-fluted triforium arcades at the crown ($z_f \in [0.66, 0.96]$).
   - **Inner Hollow Sculpture (`C_4` Pavilion)**: Through the 4 portals, the single thread weaves an internal hollow sculpture suspended inside the cube that morphs vertically through 4 forms:
     1. *Octagonal Star Pedestal* ($z_f \in [0.00, 0.22]$),
     2. *Swelling Hollow Geodesic Sphere* ($z_f \in [0.22, 0.54]$),
     3. *Fluted Hyperboloid Hourglass Waist* ($z_f \in [0.54, 0.78]$),
     4. *Crown Lotus Star-Vault* ($z_f \in [0.78, 1.00]$).

---

## 3. Files & SHA-256 Provenance

- **Generator**: [`build_kocka_reverz.mjs`](./build_kocka_reverz.mjs)
- **Summary JSON**: [`KOCKA_REVERZ_SUMMARY.json`](./KOCKA_REVERZ_SUMMARY.json)
- **Creality Ender-3 V4 (`150 × 150 × 150 mm`)**:
  - Specimen G-code: [`KOCKA_REVERZ_ENDER_150/KOCKA_REVERZ_ENDER_150.gcode`](./KOCKA_REVERZ_ENDER_150/KOCKA_REVERZ_ENDER_150.gcode) (`sha256: ea8612831d6afbc6e46c13600e39b170cfbf75f09db1b3c1cb0fda75d0b28931`)
  - Shelf copy: `ZA_STAMPU/CREALITY_Ender3V4/KOCKA_REVERZ_ENDER_150/KOCKA_REVERZ_ENDER_150.gcode`
- **Bambu Lab A2L (`250 × 250 × 249.6 mm`)**:
  - Specimen 3MF container: [`KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode.3mf`](./KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode.3mf) (`sha256: 8924e654e1bd19b4dabca61555a4a89905a867775c933a586903f80d7444e8d3`)
  - Specimen G-code: [`KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode`](./KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode) (`sha256: 3d93265650d4c46046ec1e75551967763fbff52c619d0f049285526b9fae0ea8`)
  - Shelf copy: `ZA_STAMPU/A2L_Bambu/KOCKA_REVERZ_A2L_250/KOCKA_REVERZ_A2L_250.gcode.3mf`
