# Weft: ulaz za modele

Za skulpturu -> stampu prvo procitaj `docs/MODEL_TO_PRINT.md` i poslednju relevantnu dopunu `PROJECT_STATE.md`.

## SOKOL: nastavi, ne pocinji ponovo

- Geometrija: `specimens/2026-10-03_sokol_ender/sokol_v2c_geometry.json`.
- Iz ovog direktorijuma: `node tools/finish_sokol.mjs status`.
- Ako build radi, ne pokreci duplikat. Istorijski PID nije dokaz.
- Ako nema aktivnog builda: `node tools/finish_sokol.mjs start`.
- Provera gotovog paketa: `node tools/finish_sokol.mjs verify`.
- Predaja vec zavrsenog spoljnog builda: `node tools/finish_sokol.mjs deliver` (posebna validacija; ne izmislja exit kod prethodnog procesa).
- Izlaz: `ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c/`.
- JSON, SVG ili OK geometry nisu finalni G-code. Ne zaobilazi gate. Ne izmisljaj STL/3MF.
- Ender bead 0.42 je ASSUMED, ne izmeren. Fizicka kompatibilnost i probna stampa ostaju odvojene provere.

## Stolica

Fotografije i granice dijagnoze: `docs/STOLICA_FAIL_2026-10.md`. Stari pad_a–d JPG su pregledani: pogrešno povezani snimci ekrana. Semir je potvrdio rušenje naslona i namerno zakrivljene noge. Tačan izvršeni fajl i Z otkaza ostaju nepoznati. Aktuelno poređenje je `private-studio/knowledge/chair/CHAIR_STATUS.md`; foot coupon ne kvalifikuje naslon.

## Efikasan rad

Proveri artefakte i procese pre generisanja. Sacuvaj postojece. Jezgro se ne menja iz daha. Razlikuj geometriju, finalni gate, profil, vizuelni pregled i fizicki test. Izvestaj: provereno, zakljuceno, nije gledano.

## Privatni lokalni studio · 2026-10-04

Za novu volumetrijsku granu prvo `private-studio/AGENTS.md`. Pokretanje `private-studio/POKRENI.vbs`. Folder je lokalno izuzet u .git/info/exclude. Nema objave, push-a ili prenosa ove implementacije u javni kod. Canonical je ovaj repo; PI/weft ostaje arhiva sa dokazima.
