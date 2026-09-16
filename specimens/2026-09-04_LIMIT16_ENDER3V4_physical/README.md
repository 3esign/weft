# LIMIT16 Ender-3 V4 v1

Finalni eksperimentalni fajl:
**EXPERIMENTAL_LIMIT16_ENDER3V4_ASSUMED_BEAD_v1.gcode**

Ovaj fajl je samo za registrovani profil **Creality Ender-3 V4 sa Creality
OS/Klipper makroima START_PRINT i END_PRINT**, PLA, 0,4 mm mlaznicu,
220 °C / 60 °C. Ne koristiti na drugom Creality modelu samo zato što nosi
isti brend. Ne skalirati, pomerati ili ponovo seći.

- model: 179,9 × 179,9 × 9,6 mm;
- 48 modelskih nivoa po 0,20 mm;
- procena: 50 min 49 s, 7,7 g;
- bbox na ploči: X 19,0–198,5 / Y 19,0–198,5 mm;
- jedna povezana prva ravnina;
- konačni G-code ima zamenjene temperature i rastućih 48 Z oznaka.

Mapa i način merenja su u
[zajedničkom protokolu](../LIMIT16_2026-09-04_PROTOCOL.md).
Fizički rezultat je u [outcomes.md](outcomes.md), a originalne fotografije i
heševi u [foto-manifestu](photos/2026-09-04_semir/manifest.json).

## Status membrane

Ćelija 15, `single-layer-inward-spiral/limit16-18mm-v1`, fizički nije zatvorila
centar: status joj je **FAILED**. Geometrijsko sidrenje 1.000 nije bilo fizička
kvalifikacija. Postojeći G-code ostaje istorijski neizmenjen; budući rebuild sa
ovim identitetom procesa mora biti odbijen, čak i uz
`--allow-experimental-membrane`. Sledeći pokušaj dobija novi identitet procesa.
Mašinski status je u
[membrane_process_status.json](membrane_process_status.json).

## Važna kvalifikacija

Ender bead 0,42 mm je u machines.json još označen kao **ASSUMED**. Ćelija 10
je zato istovremeno merenje tog broja. Ako stvarno izmerena širina odstupa,
rezultat table ostaje koristan, ali se bead prvo upisuje u profil pre sledeće
generacije.

## Honest verdict

Provereno: pređašnja geometrijska vrata i 17 fotografija fizičke table; gornji
kontinuitet mosta do 16 mm; LONG i globalni Z raspored; nedvosmislen neuspeh
MEM v1. Istorijski manifest i G-code nisu prepisani.

Nije provereno: naličje/ulegnuće mostova, mehanička čvrstoća, tačna veza
odvojenih kupona 09/10/11 sa očitanjima i printer-history receipt. Ender bead
0,42 mm ostaje ASSUMED.

SHA-256: **E33CB4CA97F9C88812C89F0EF0E1DC504C93513905FFFD6409684E95A4022A2B**
