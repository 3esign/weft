# DOMET2 · Bambu Lab

A test sculpture that is also **seven instruments**. One tower, one wall geometry, seven terraces — each a
ladder for one question that three different minds left open between 17 and 24 September 2026, and a closed
crown with a seven-lobed drawing on top. **Generated and digitally checked; NOT PRINTED.**
[Predictions and how to read it](PREDICTIONS.md) · [Rebuild protocol](PROTOCOL.md) · [Outcome](outcomes.md)

## The seven questions

| | what it asks | z, mm | layers | ladder across the eight 45° sectors | unit | findings at 16.2 mm |
|---|---|---|---|---|---|---|
| **T1** | chord march, outward — Gemini's corner bridging, no free tip anywhere | 5.04–8.4 | 14 | 6 / 9 / 12 / 15 / 18 / 21 / 25 / 30 | chord span mm | 92 |
| **T2** | speed ladder — reach and everything else fixed, only the feedrate changes | 13.44–16.32 | 12 | 6 / 8 / 10 / 12 / 15 / 20 / 26 / 34 | mm/s | 72 |
| **T3** | crossing-angle ladder — sector 0 deliberately stacks identical layers | 21.36–24.24 | 12 | 0 / 10 / 20 / 30 / 45 / 60 / 75 / 90 | deg between consecutive layers | 72 |
| **T4** | counterweight ladder — inward 16 mm everywhere, outward arm 0..26 mm | 29.28–32.16 | 12 | 0 / 3 / 6 / 9 / 12 / 16 / 20 / 26 | outward arm mm | 480 |
| **T5** | thickness ladder — how many woven layers a terrace actually needs | 37.2–41.52 | 18 | 2 / 3 / 4 / 6 / 8 / 10 / 14 / 18 | layers | 79 |
| **T6** | pitch ladder — how dense the comb must be | 46.56–49.44 | 12 | 2 / 2.5 / 3 / 4 / 5 / 6 / 8 / 10 | tooth pitch mm | 78 |
| **T7** | closing terrace — hairpins inward, ribbed, leaving the crown its hole | 54.48–57.36 | 12 | — | — | 64 |

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

Nominal envelope **138.3 × 134.7 × 60.72 mm**, 253 layers at 0.24 mm, cylinder radius 42 mm,
wall 5.04 mm between terraces. Nozzle 0.4 mm; bead 0.45 mm, measured. Only the cylinder touches the bed; every
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

**Final G-code gate: PASS — 0 problems / 562509 points / 254 layers, first layer 1 island.**
The packed 3MF was re-read and re-gated: PASS.

At the evidenced 16.2 mm ceiling: **946 findings — the complete list, not the 400-item excerpt — and 0 outside the declared zones** —
terrace T1 92, terrace T2 72, terrace T3 72, terrace T4 480, terrace T5 79, terrace T6 78, terrace T7 64, crown 9.

Same-layer contacts: **12710**, all on typed terrace paths where a triangle wave meets its own base ring at
every cell, or where a sector path enters and leaves that ring. They are deliberate root welds, located in the
report, and no gate exemption hides them.

Honest verdict: dimensions, emitted planar layers, support gates and file identity were checked. Sag, bond
quality, the counterweight, the value of ribs and the effect of speed are exactly what this object exists to
measure and are unmeasured until it is printed.
