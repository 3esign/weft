# LIMIT16 A2L v1

Finalni eksperimentalni fajl za merenje: **PRINT_LIMIT16_A2L_v1.gcode.3mf**

Otvoriti direktno u Bambu Studio kao već isečen G-code 3MF i koristiti
**Print plate**. Ne koristiti **Slice plate**, ne skalirati i ne pomerati.
Paket je za profil **Bambu Lab A2L**, PLA, 0,4 mm mlaznicu, 220 °C / 55 °C.

- model: 179,9 × 179,9 × 9,6 mm;
- 40 modelskih nivoa po 0,24 mm;
- procena paketa: 45 min 36 s, 7,7 g;
- jedna povezana prva ravnina;
- Bambu metadata: 40 CHANGE_LAYER, 40 Z_HEIGHT, 40 LAYER_HEIGHT;
- konačni paket je ponovo pročitan iz ZIP-a i prošao geometrijski final-artifact gate.

Mapa i način merenja su u
[zajedničkom protokolu](../LIMIT16_2026-09-04_PROTOCOL.md).
Fizički rezultat je u [outcomes.md](outcomes.md), a originalne fotografije i
heševi u [foto-manifestu](photos/2026-09-04_semir/manifest.json).

## Status membrane

Ćelija 15, `single-layer-inward-spiral/limit16-18mm-v1`, fizički nije zatvorila
centar: status joj je **FAILED**. Geometrijsko sidrenje 1.000 dokazivalo je samo
kontakt ruba. Postojeći G-code ostaje istorijski neizmenjen; svaki budući rebuild
sa ovim identitetom procesa mora biti odbijen, čak i uz
`--allow-experimental-membrane`. Sledeći pokušaj dobija novi identitet procesa.
Mašinski status je u
[membrane_process_status.json](membrane_process_status.json).

## Honest verdict

Provereno: pređašnja geometrijska vrata i 24 fotografije fizičke table; gornji
kontinuitet mosta do 16 mm; LONG i globalni Z raspored; nedvosmislen neuspeh
MEM v1. Istorijski manifest i G-code nisu prepisani.

Nije provereno: naličje/ulegnuće mostova, mehanička čvrstoća, tačna veza
odvojenih kupona 09/10/11 sa očitanjima i printer-history receipt.

SHA-256: **2C6EEAEDE913CB31290795E96A8254C3C41971A5891B40F9A5BCAB08589F41B6**
