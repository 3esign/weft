# LIRA · Bambu A2L

Four roots become two arches, a saddle and an open lyre-shaped back.

The brief is a more ambitious WEFT chair sculpture, developed from the previous STOLICA and its reported print failure. Intended height: 216 mm. This is a scale sculpture; human seating strength is not claimed.

## Design decisions before generation

- Keep four generous circular bed contacts; introduce porosity over 13 mm instead of changing from dense base to full weave at once.
- Make the front/rear leg pairs merge before the lateral arches merge into a saddle.
- Split the back into two ribbons around a true window and rejoin them by gradual inward growth at the crown.
- Crossing core patterns and a woven rim remain one continuous open line per connected printable island where the geometry permits.
- Use the existing A2L profile (0.4 nozzle, 0.45 bead, 0.24 layer, 220/55 C) and unchanged gates. The profile calls bead measured based on earlier successful specimens; no new coupon measurement has been made in this task.
- Set actual sparse-path speed to 16 mm/s through bridgeSpeed (changing only nominal speed would not change sparse paths).
- Exclude decoration, rendered fabric, simulated sag, and claims of physical success from the preview. Show emitted paths.

## Measured output

| Item | LIRA A2L | Previous STOLICA A2L |
|---|---:|---:|
| Geometry envelope, mm | 112.2 × 109.9 × 216 | 82.3 × 89.2 × 169.92 |
| Layers | 900 | 708 |
| Topology | 4 → 2 → 1 → 2 → 1 | 4 → 1 |
| Generator-reported worst free span, mm | 3.37 | 7.02 |
| Lowest S7 carried fraction | 80.0% | 56.3% |
| S8 | WARN: 8 period-two layers | WARN: 1 period-two layer |
| Container material estimate | 180.9 g | 93.1 g |
| Container time estimate | 27 h 36 min | 12 h 57 min |

The columns report their respective artifact measurements; they do not prove a strength ratio. The new object is larger and uses more material. S8 is not silently removed: it reports repeated patterns, while zero layers are classified self-stacked. Physical success remains unobserved.

Full model S1: PASS, zero problems, 3,434,417 checked points. Layered gate: S2 INFO / S3 PASS / S4 PASS / S5 INFO / S7 INFO / S8 WARN / ORDER N/A, zero findings and no refusal. Final container re-read and identity/prefix checks are recorded in package/*_package_gate.json and audit.json. Only a successful audit and completed manifest permit delivery.

## Print files and first test

- package/LIRA_A2L.gcode.3mf — the complete pre-sliced chair sculpture.
- probe_package/LIRA_ROOT_A2L.gcode.3mf — its first 80 layers, height 19.2 mm, approximately 16.7 g and 2 h 02 min. The independent audit confirms equality of both geometry and executable prefix with the full model.

Open the .gcode.3mf as a project in Bambu Studio. It contains the authored toolpath; do not re-slice it as an ordinary mesh, because that replaces the WEFT path. The display model is not a manufacturing STL. The raw .gcode is included for inspection and established compatible workflows. Every manufacturing filename states A2L.

Use the root test to inspect adhesion and the gradual weave transition before committing to the complete print. A successful root test does not qualify the leg mergers, growing seat, back split or crown. Record the actual printer, filament, temperatures, exact filename and photographs taken before bed removal. No print was started by this task.

## Review

preview.html is an offline interactive view of literal generated path segments. For legibility it displays 301 of 900 layers (every third plus the last), with 1,186,990 segments; no skin is interpolated. Screenshots include isometric, front, side and top views. WebGL, keyboard, layer clipping and 390 px viewport checks are recorded in preview_receipt.json. This depicts nominal paths, not deformed extruded plastic.

ANALIZA.md contains the previous-chair review and evolution of WEFT. KNOWLEDGE.md records the two rejected design transitions and their corrections. The genuine physical cause of the previous reported chair failure remains unknown: the four pictures in its historical dossier were unrelated screenshots.

## Source

design.mjs registers a separate variant through the existing exported generator. It does not modify WEFT core or older specimens.

From this specimen folder:

```
node design.mjs --probe
node design.mjs
node ../../weft.mjs build --geo LIRA_A2L_geometry.json --machine a2l --out package --name LIRA_A2L --maxislands 4 --nostl --keep --end-z-from-template --thumb thumbnail.png
node ../../weft.mjs build --geo probe_geometry.json --machine a2l --out probe_package --name LIRA_ROOT_A2L --maxislands 4 --nostl --keep --end-z-from-template
node run-audit.mjs
```

No gate threshold is waived. The preview runtime can use the existing Playwright installation through WEFT_NODE_MODULES. An independent audit on 2026-10-04 passed: A2L identity, 900 model layers, footer Z 216.4, model bounds within the bed, identical raw/container body moves, and an exact 80-layer physical/machine-code prefix. See audit.json. Package SHA-256: `6f5654726674b5f25ee050db763219915e3a51f3236832167685989648fc11b5`.

## Honest verdict

Software-valid generated geometry and machine files; physically NOT PRINTED. No load certification or ergonomic validation. Machine-profile bead 0.45 mm is inherited from earlier A2L evidence. Inspect the trial print before trusting new process combinations. No claim is made that a larger, more expressive model is inherently stronger.

## Korigovani status naslona · 2026-10-04

Semir potvrđuje da se srušio naslon; zakrivljene noge su namerne. Tačan fizički izvršeni fajl i Z otkaza nisu potvrđeni. **HOLD za punu fizičku kvalifikaciju LIRE:** stopalni kupon od 19,2 mm ne kvalifikuje naslon. Pre punog fizičkog pokušaja potrebni su kupon korena naslona i provera razdvajanja/ponovnog spajanja, sa očuvanim procesom i projektovanom bazom. Nijedna štampa nije pokrenuta.

Novi dosije sa stvarnim putanjama: [status naslona](../../private-studio/knowledge/chair/CHAIR_STATUS.md). Naslon STOLICA počinje na Z88,32 mm; nestanak centralnog ostrva sedišta na 90,72 mm je drugi događaj. Poboljšanje LIRA spoja jeste digitalno, ne dokaz fizičkog uspeha.
