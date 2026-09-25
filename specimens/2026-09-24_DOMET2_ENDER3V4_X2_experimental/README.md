# DOMET2_ENDER3V4_X2 — corrected reissue

**Print `DOMET2_ENDER3V4_X2.gcode` from this folder.**

Supersedes `2026-09-24_DOMET2_ENDER3V4_X1_experimental`, which must not be printed.

---

## Why there is an X2

X1 was exported by a toolchain copy that was **older than the one committed in
this repository**. The working copy used for the X1 export was restored from a
17/18 September snapshot and was missing the first-layer contract added on
19 September (`docs/FIRST_LAYER_CONTRACT.md`). Every X1 file was therefore
emitted without the first-layer guard.

### What was wrong in X1 (this machine)

The Ender start block purges at **Z 0.300** before the model starts at
**Z 0.200**. Creality Print reads the first extruding move in the file as
"layer 1", so its preview built layer 1 out of the purge line and showed an
almost empty plate. The model's real first layer was present in the X1 file
the whole time — it just was not what the preview was drawing.

Running the repository's own first-layer audit over both files:

| file | audit | model first Z | preview first Z | first-layer segments |
|---|---|---|---|---|
| `DOMET2_ENDER3V4_X1.gcode` | **FAIL** — `PHANTOM_FIRST_PREVIEW_LAYER` | 0.200 | 0.300 | 1231 |
| `DOMET2_ENDER3V4_X2.gcode` | **PASS** | 0.200 | 0.200 | 1231 |

The segment count is identical in both files. Nothing was added to the model;
the purge was moved inside an explicit wipe region so the slicer stops counting
it as a layer.


### What changed in the emitted file

Two things, both in the header, nothing in the model body:

1. The startup purge is now wrapped in `; WIPE_START` … `; WIPE_END`, so a
   slicer preview does not treat it as the model's first layer.
2. The header declares `; WEFT_FIRST_LAYER_V1 Z=0.200 H=0.200`,
   naming the model's real first layer height so the declaration can be checked
   against the file rather than trusted.

The geometry is byte-for-byte the same design as X1. The terrace ladders, the
wall grammar, the seat rings and the reach schedule are unchanged, which is what
makes X1 and X2 comparable and what lets the X1 predictions stand.

### Gate results for this build

| check | result |
|---|---|
| support gate, declared ceiling | **PASS** — 0 problems over 573,704 points / 282 layers |
| first-layer audit | **PASS** — 1 island, model Z = preview Z = 0.200 |
| second gate at the evidenced 16.2 mm | 953 findings, **0 outside the declared zones** |
| Bambu package re-gate | n/a — plain G-code machine |

The second gate is not a failure. It is the deliberate re-run at the reach that
the 19 September specimens actually evidenced, and its job is to prove that every
finding falls inside a terrace that this design declared in advance. 0 outside
the declared zones is the result that matters.

### Build figures

| | |
|---|---|
| machine | Creality Ender-3 V4 |
| Z levels | 281 |
| max Z | 56.2 mm |
| thread path | 336.9 m |
| filament | 11,171.77 mm ≈ **33.86 g** |
| weld nodes | 13,453 |
| estimated time | 6 h 25 m 50 s (kinematic estimate, not the printer's own) |

Thread path and filament are two different measurements of the same run and must
not be compared to each other as if they were the same quantity. The thread path
is the distance the nozzle travels while extruding; the filament figure is the
length of 1.75 mm stock consumed. One draws into the other, so the thread path is
always the larger number.

---

## Design notes (unchanged from X1)

# DOMET2 · Creality Ender-3 V4

A test sculpture that is also **seven instruments**. One tower, one wall geometry, seven terraces — each a
ladder for one question that three different minds left open between 17 and 24 September 2026, and a closed
crown with a seven-lobed drawing on top. **Generated and digitally checked; NOT PRINTED.**
[Predictions and how to read it](PREDICTIONS.md) · [Rebuild protocol](PROTOCOL.md) · [Outcome](outcomes.md)

## The seven questions

| | what it asks | z, mm | layers | ladder across the eight 45° sectors | unit | findings at 16.2 mm |
|---|---|---|---|---|---|---|
| **T1** | chord march, outward — Gemini's corner bridging, no free tip anywhere | 5–7.8 | 14 | 6 / 9 / 12 / 15 / 18 / 21 / 25 / 30 | chord span mm | 98 |
| **T2** | speed ladder — reach and everything else fixed, only the feedrate changes | 12.8–15.2 | 12 | 6 / 8 / 10 / 12 / 15 / 20 / 26 / 34 | mm/s | 72 |
| **T3** | crossing-angle ladder — sector 0 deliberately stacks identical layers | 20.2–22.6 | 12 | 0 / 10 / 20 / 30 / 45 / 60 / 75 / 90 | deg between consecutive layers | 72 |
| **T4** | counterweight ladder — inward 16 mm everywhere, outward arm 0..26 mm | 27.6–30 | 12 | 0 / 3 / 6 / 9 / 12 / 16 / 20 / 26 | outward arm mm | 480 |
| **T5** | thickness ladder — how many woven layers a terrace actually needs | 35–38.6 | 18 | 2 / 3 / 4 / 6 / 8 / 10 / 14 / 18 | layers | 80 |
| **T6** | pitch ladder — how dense the comb must be | 43.6–46 | 12 | 2 / 2.5 / 3 / 4 / 5 / 6 / 8 / 10 | tooth pitch mm | 78 |
| **T7** | closing terrace — hairpins inward, ribbed, leaving the crown its hole | 51–53.4 | 12 | — | — | 64 |

Every ladder **ascends**, so a break reads as the angle at which the pattern stops working. Photograph each
terrace from a fixed side with a scale and record, per terrace, the sector of first curl and the sector where
the surface is lost.

## Where each question comes from

**T1 — chord march.** Gemini's family, built overnight 18–19 September in `weft/exports/zigurat3_test`:
*"layer k+1 is an octagon bridging the corners of layer k; layer k+2 is a square resting exactly on the
midpoints of those bridges."* Generalised here to a circle: M anchors, chords between them bulged outward so
their midpoints become the next layer's anchors, the whole sector entered and left by a radial jog from the
base ring. **There is no free tip anywhere** — every run is a bridge between two supported ends, which is why
its longest unsupported run is 23 mm where the hairpin terraces run to 41–53 mm. The ladder is the chord span,
6 to 30 mm, which brackets the only number this project actually trusts: the evidenced 16.2 mm.

**T2 — speed.** On 23 September the same hairpin method printed flat on the Ender and nested on the A2L. Reach,
layer height and speed all differed, so nothing was isolated. Here reach is 20 mm in every sector and only the
feedrate changes: 6, 8, 10, 12, 15, 20, 26, 34 mm/s, one machine, one layer height.

**T3 — crossing angle.** Semir found coincident stacked layers twice in one week — at layers 164/165 of
`ZIGURAT_TKANJE_A2L_X1`, and again in the 19 September terraces, where measurement gave a median crossing
angle of 16° with 44 % of crossings below 10°. Does a node have to be a node? Sector 0 **deliberately stacks
identical layers** and is the control; the others run 10° to 90°.

**T4 — counterweight.** Semir's own hypothesis, 19 September, in his words: *"da chords prepustamo vise sa obe
strane da sa jedne bude oslonac a sa spoljne kontra teg"*. It has never been tested. Every sector has the same
16 mm inward arm; the outward arm runs 0, 3, 6, 9, 12, 16, 20, 26 mm. If the counterweight is real, the inward
side sags less where the outward arm is longer.

**T5 — thickness.** Every terrace built so far is twelve layers because the first one was. Sectors here weave
for 2, 3, 4, 6, 8, 10, 14, 18 layers and then stop.

**T6 — pitch.** How dense must the comb be: tooth pitch 2 to 10 mm at a fixed 20 mm reach.

**T7 — closing terrace.** Hairpins inward, ribbed, until a 40 mm hole is left. Its last three layers lay a
continuous **seat ring** so the crown's line ends have something to land on; without it every second line end
fell into a gap between teeth.

**Crown.** A hierarchical woven grid 2-2-4-4-8-8-16-16 over that hole, first free span 22.5 mm, with the rim ring re-laid on
every layer — support comes only from the layer immediately below, so a ring left behind stops holding after
two layers. Then **a seven-lobed rose drawn as one continuous line**: the artistic pattern.

## Dimensions and process

Nominal envelope **138.3 × 134.7 × 56.2 mm**, 281 layers at 0.2 mm, cylinder radius 42 mm,
wall 5 mm between terraces. Nozzle 0.4 mm; bead 0.42 mm, ASSUMED — never bead-calibrated. Only the cylinder touches the bed; every
terrace is in mid-air.

Emitted: **NaN m of thread**, undefined welds, undefined paths. Header, recomputed from the file's own moves:
NaN m of 1.75 mm filament, **undefined g**, max Z undefined, **undefined** kinematic. Thread length and filament
feed are different quantities; the ratio here is about 30:1.

## Gates

Declared ceiling: bridge 60 mm (the chain's experimental maximum), cantilever 8 mm, **support tolerance
`allow` left at 0.6 mm**. That last number matters: the 19 September `zigurat3` exports passed only with
`allow` raised to **8 mm**, which is not a support test at all — thirteen times looser than normal. Three of
those files, gated normally, failed with 600 mm unsupported chord runs on the first roof layer. That is
recorded here, not repeated.

**Final G-code gate: PASS — 0 problems / 573740 points / 282 layers, first layer 1 island.**

At the evidenced 16.2 mm ceiling: **953 findings — the complete list, not the 400-item excerpt — and 0 outside the declared zones** —
terrace T1 98, terrace T2 72, terrace T3 72, terrace T4 480, terrace T5 80, terrace T6 78, terrace T7 64, crown 9.

Same-layer contacts: **11847**, all on typed terrace paths where a triangle wave meets its own base ring at
every cell, or where a sector path enters and leaves that ring. They are deliberate root welds, located in the
report, and no gate exemption hides them.

Honest verdict: dimensions, emitted planar layers, support gates and file identity were checked. Sag, bond
quality, the counterweight, the value of ribs and the effect of speed are exactly what this object exists to
measure and are unmeasured until it is printed.

