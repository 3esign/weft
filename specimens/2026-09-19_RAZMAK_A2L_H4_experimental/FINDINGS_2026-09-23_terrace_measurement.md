# Finding, 2026-09-23 — the returning-hairpin terrace, measured, and where it breaks

Measured by `svemir-claude-fable-cowork` from the two geometry files delivered in these folders
(`OBRTAJ_ENDER_H7_geometry.json`, 1100 layers, 0.20 mm; `RAZMAK_A2L_H4_geometry.json`, 1291 layers, 0.24 mm).
Nothing already in these folders is changed by this file; the delivery receipts, gate verdicts and `outcomes.md`
stand as written.

New physical evidence exists as of today: Semir printed both. The Ender object (OBRTAJ) came out with its
horizontal terraces **flat**, which is the first time a WEFT object has carried a genuinely level floating
surface. The A2L object (RAZMAK) is printing with long, clean combs on its straight runs and **tangled nests**
where the return is longest, with the nozzle visibly dragging loosened strands. Both observations come from
photographs taken during and after the prints; they are not measured deflections.

## 1. The number that matters: free reach of the first terrace layer

A terrace's first layer is the only one with nothing above it to pin it down. For every outward tip of that
layer, the distance to the nearest point of the wall contour immediately below it was measured — the true
cantilever length of a returning hairpin at the moment it is laid.

| object | terrace | cells | min | median | p90 | max |
|---|---|---|---|---|---|---|
| OBRTAJ (Ender, 0.20 mm) — **flat** | terrace-1 | 124 | 6.6 | **18.1** | 24.3 | 25.3 |
| | terrace-2 | 104 | 4.8 | 8.4 | 16.5 | 18.2 |
| | terrace-3 | 80 | 5.4 | 8.7 | 18.1 | 27.1 |
| | terrace-4 | 80 | 4.4 | 6.9 | 8.9 | 9.3 |
| | terrace-5 | 72 | 5.3 | 7.3 | 11.0 | 15.2 |
| | terrace-6 | 56 | 5.3 | 7.3 | 9.2 | 9.3 |
| RAZMAK (A2L, 0.24 mm) — **nests** | terrace-1 | 140 | **20.1** | **28.6** | 36.5 | 38.6 |
| | terrace-2 | 128 | 5.6 | 10.8 | 40.5 | 41.8 |
| | terrace-3 | 60 | 5.9 | 9.1 | 11.6 | 11.8 |

All figures in millimetres, outward tips.

The two objects separate cleanly. On the Ender every terrace has a **minimum** reach of 4.4–6.6 mm and a median
of 7–18 mm: most tips are short, and the long ones sit between short ones that hold them. On the A2L's first
terrace **every single tip is at least 20.1 mm free**, and half of them exceed 28.6 mm. There is no short tip
anywhere on that terrace to carry its neighbours.

That is consistent with what the photographs show: the A2L's straight runs, where the reach is shortest, came
out as clean flat combs; the turns, where it is longest, went to nests. The failure is local, and it is local
to the longest returns.

So a first, honest bracket for the returning hairpin, pending a proper ladder test:

- **holds** at a median of 18 mm with a maximum of 25 mm, on the Ender at 0.20 mm and web speeds of 10–15 mm/s;
- **fails in places** at a median of 29 mm with a minimum of 20 mm, on the A2L at 0.24 mm and higher speed.

Two variables move together between the two machines (reach, and layer height plus speed), so this brackets the
limit rather than isolating it. The evidenced bridge ceiling remains 16.2 mm, and a hairpin is weaker than a
bridge of the same span, not stronger — see §4.

**The experiment this asks for** is cheap and would settle it: one object per machine, one wall, one terrace,
returns stepped at 8 / 12 / 16 / 20 / 24 / 28 / 32 / 36 mm around the perimeter in declared sectors, everything
else held fixed. The break appears as an angle on the object and can be read off with a ruler.

## 2. Twelve terrace layers contain two distinct paths, not twelve

For every terrace of **both** objects, layer *k* and layer *k+2* are point-for-point identical (maximum
deviation 0.000 mm; *k+4*, *k+6*, *k+8* likewise); layer *k* and *k+1* differ. Each 12-layer terrace is

```
A B A B A B A B A B A B
```

— two paths, each deposited **six times onto itself**. The six copies of A fuse into a bead column six layers
tall, and so do the six copies of B. This is the defect Semir identified on 2026-09-18 at layers 164/165 of
`ZIGURAT_TKANJE_A2L_X1` ("two identical layers stacked, which in WEFT should never happen"), at period two
instead of period one. It is why the teeth in the photographs read as tall thin blades rather than as a lattice.

`README.md` states the terraces "shift the return pattern by a quarter-cell between layers". A quarter-cell
shift would repeat at *k+4*. The emitted geometry repeats at *k+2*, a half-cell shift. Documentation and
geometry disagree; which is the intended design is not determined here.

## 3. Consecutive layers do cross, and the crossings reach the tips — but they are shallow

A and B are not parallel; they intersect. Measured on the first pair of each OBRTAJ terrace (all pairs inside
one terrace are identical, which follows from §2):

| terrace | crossings per pair | cells | median angle | 10th pct | below 10° |
|---|---|---|---|---|---|
| terrace-1 | 248 | 124 | 16.1° | 2.5° | 110 of 248 |
| terrace-2 | 208 | 104 | 53.2° | 6.4° | 46 of 208 |
| terrace-3 | 160 | 80 | 16.9° | 6.3° | 36 of 160 |
| terrace-4 | 160 | 80 | 29.4° | 11.3° | 9 of 160 |
| terrace-5 | 144 | 72 | 54.1° | 7.8° | 29 of 144 |
| terrace-6 | 112 | 56 | 22.4° | 10.6° | 6 of 112 |

Exactly two crossings per return cell everywhere. They span the full band: on terrace-1 they run from radius
54.6 to 94.1 mm, within **0.7 mm of the outer tip** and **0.1 mm of the inner tip**, against a band of
54.50–94.75 mm. The tips are tied by the neighbouring layer, which is better than the photographs alone suggest
and is a real part of why the Ender terraces stayed flat.

The weakness is the angle. A crossing at 2.5° is not a node; it is two beads lying alongside each other for
several millimetres and fusing into one thicker bead. About 44 % of terrace-1's crossings are below 10°.
Terraces 2 and 5, at medians of 53° and 54°, are the ones that behave as a woven plate.

Cell geometry, OBRTAJ terrace-1: 124 cells, 2.90° angular pitch, 3.78 mm arc pitch at mid radius, 7.809 m of
path in that one layer.

## 4. Two things the gate cannot see

1. **Coincident layers.** The gate checks whether deposited material has something beneath it. It does not check
   whether consecutive layers intersect, and it does not check whether layer *k+2* is a copy of layer *k*. Six
   coincident copies pass exactly as a six-layer weave would. (Recorded once already on 2026-09-18.)
2. **The returning loop.** A hairpin that leaves the wall, turns at a free tip and comes back has two supported
   endpoints, so the gate classifies the run as a bridge. Mechanically its two legs are a fraction of a
   millimetre apart and act as one cantilever folded in half — weaker than a bridge of the same span, not
   stronger. `README.md` states this plainly ("A returning free-tip loop can pass the bridge classification
   while remaining a mechanical cantilever challenge"); §1 turns it from a caveat into a measured failure.

Two checks would catch both, and neither needs new evidence: **a minimum crossing angle** (a count of
intersections passes a 2.5° smear; a floor of, say, 20° would not), and **a free-tip reach limit** that treats a
returning loop as a cantilever of its own length rather than as a bridge between its endpoints.

## 5. Where these objects sit relative to evidence

Both files pass their declared gate with zero problems, and both declare a **180 mm** ceiling; for comparison
`2026-09-18_ZIGURAT2_*_X2` declared 36 mm. At the evidenced 16.2 mm ceiling the complete reports record **2966
findings** (OBRTAJ) and **5943** (RAZMAK), all inside declared zones, against 8 and 2 for the X2 pair. Every one
is protocol-legal and openly recorded. The number is not an accusation; it is the distance from measured
evidence, and §1 is what that distance turned into on the plate.

Terrace findings fall with size, as expected: 1478, 235, 545, 582, 61, 60 for OBRTAJ terraces 1–6; 3360, 1232,
1342 for RAZMAK's three.

## 6. Cross-check of the reported quantities

- OBRTAJ: 1008.1 m of thread against 33.352 m of 1.75 mm filament → ratio 30.2. `ZIGURAT2_VRTLOG_ENDER3V4_X2`,
  measured from its printed G-code: 171.58 m against 5.632 m → 30.5. Two independent generators, the same
  deposition physics.
- 33.352 m of 1.75 mm filament = 80.2 cm³; at the stated 1.26 g/cm³, 101.1 g, as reported.
- Kinematic time scales with path: OBRTAJ is 5.87× the X2 Ender object's thread and ≥16.577 h against 2.93 h,
  a factor of 5.66.

## 7. What is worth carrying forward

Keep: the returning hairpin as the unit of a horizontal surface — it is the first thing in this project that
produced a level floating plane, and the Ender object proves it. Keep holding the footprint fixed for the whole
terrace, so the tread is a true plane and not a ramp. Keep tying the tips with the neighbouring layer.

Change: more than two distinct paths per terrace, so no line is laid twice on itself; a minimum crossing angle,
so a node is a node; and a reach limit, with short tips interleaved among long ones so that no terrace has a
*minimum* reach of 20 mm.

Honest verdict: §1–§3 and §6 are measurements of the delivered geometry files and can be reproduced from them.
The flat Ender terraces and the A2L nests are read from photographs, not from instruments: no deflection, bond
strength or mass has been measured, and the causal split between reach, layer height and speed is bracketed,
not isolated.
