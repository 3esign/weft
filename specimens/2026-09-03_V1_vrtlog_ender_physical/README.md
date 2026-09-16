# V1 · "Vrtlog" — a vessel that is also a ruler · Creality Ender-3 V4

Three strands orbit a core and twist as they rise. Where the core is fat they are one lobed vessel;
where it thins and the orbit opens they come apart into three, and the openings between them are real
eyes; where the orbit closes again they touch each other and fuse, and only then does a core grow back
inside material that already exists. **Split, hole birth, hole death and merge all fall out of two
continuous curves — nothing is switched on at a boundary**, because a seam between two rules is where
this compiler broke every single time it broke yesterday.

    90 × 86.9 × 130.4 mm (130.4 is the HEIGHT) · 650 geometry layers, 1272 emitted paths
    225 m of thread · 23 049 welds · ~2.5 h kinematic (expect 4-5 h)
    gate: 0 problems over 270 141 checked points · first layer: 1 island, 5 openings

## It is a measuring instrument

Six bands, each at a height you can point at afterwards. If it fails, **the height of the failure says
which limit was real** — which is the whole reason the extremes are in a known order.

| height | band | grammar | what it puts under test |
|---|---|---|---|
| 0 – 21 mm | foot | **staple** | the wall at its floor — 0.9 mm, two rails a bead apart. Never printed this thin. |
| 21 – 39 | belly | **perp** | square wave; the core lets go of the strands here — a pinch, the fastest the contour ever moves |
| 39 – 73 | eyes | **diagonal** | truss members over an opening body. Never printed. Yesterday's WEFT-06 moved their dwell onto the rails; this is the first plastic that will say whether that was right. |
| 73 – 91 | knot | **eight** | the loop stitch, through the three-way merge. Never printed at all. |
| 91 – 109 | neck | **sine** | the wave at the tightest curvature in the piece |
| 109 – 130 | mouth | **staple**, long tabs | an outward flare — the motion that broke the climber's arms |

Three of the five grammars (**diagonal, sine, eight**) have never touched plastic. The wall sweeps
0.9 → 6.1 mm and 309 layers were thinned by the solver against their own geometry.

**Three membranes**: the core's death at z ≈ 42 lays a 19 mm filled spiral — the floor of the vessel,
and by far the largest membrane WEFT has ever attempted; a hole cap at z ≈ 93; and the rim at the top.

## Print notes

* **Send the G-code as it is.** Route B, WEFT's own toolpath, Klipper start/end blocks. 215 °C / 60 °C.
* No brim in the slicer — the foundation is the brim.
* **The bead is a guess.** This was built at 0.42 mm because that is what `machines.json` holds for this
  machine, and that number has never been measured. The manifest says so. If C1 comes back different,
  this file should be rebuilt before it is trusted for anything but looking at.

## What to photograph

The floor membrane at z ≈ 42 seen through an eye · each of the three eyes · the three-way fuse at
z ≈ 92 · the four band changes, where one grammar hands over to the next · the mouth · and above all
**anything that failed, with its height**.

## Rebuild

    python weft.py build vase --machine ender --H 130 --turns 0.72 \
           --out specimens/<folder> --name V1_vrtlog_ender --i-know-the-bead-is-a-guess

The twist is the limit that sets `--turns`: at 0.9 the gate found 12.4 mm of chord over air in the
eyes band, and at 0.72 it finds none. That number is a measurement of the material, not a preference.
