# LIMIT16 Ender-3 V4 v1 — fizički ishod

Datum dokaza: 2026-09-04. Operatorova identifikacija: žuta tabla, Creality
Ender-3 V4. Artefakt: EXPERIMENTAL_LIMIT16_ENDER3V4_ASSUMED_BEAD_v1.gcode,
SHA-256 E33CB4CA97F9C88812C89F0EF0E1DC504C93513905FFFD6409684E95A4022A2B.

| # | Instrument | Odluka | Opažanje | Foto-dokaz |
|---:|---|---|---|---|
| 01 | B04 | PASS* | kontinuitet vidljiv u kompletnoj tabli; naličje nije snimljeno | ENDER_C_04.jpg, ENDER_C_05.jpg |
| 02 | B08 | PASS* | tri približno ravne niti opstale | pregled + ENDER_A_02.jpg |
| 03 | B12 | PASS* | tri niti opstale; lokalno stringovanje kod sidra | pregled + ENDER_A_03.jpg |
| 04 | B16 | PASS* | tri pune niti vidljive odozgo | pregled + ENDER_A_04.jpg |
| 05 | C08 | PASS | koren i kratki vrh opstali bez jasnog uvijanja | kompletni pregled |
| 06 | C18 | GRANIČNA | telo opstalo uz fine putne niti | kompletni pregled |
| 07 | C30 | GRANIČNA | koren stoji; vrhovi su delom spojeni/uvijeni | kompletni pregled |
| 08 | C45 | GRANIČNA | slobodni kraj preživeo uz deformaciju | kompletni pregled |
| 09 | W34 | PASS* | zid je punom visinom neprekinut; dimenzija bez ID-a | ENDER_B_02.jpg, ENDER_B_03.jpg |
| 10 | WNM | PASS* | gladak, neprekinut zid; dimenzija bez ID-a | pregled |
| 11 | W66 | PASS* | neprekinut zid bez grubog prepunjavanja | pregled |
| 12 | LONG | PASS | kompletna putanja, bez velikog drifta ili ugaonih grudvi | ENDER_A_01.jpg |
| 13 | L17 | GRANIČNA | puna kruna/profil, uz labavije varove i niti | lokalni i kompletni pregled |
| 14 | L32 | GRANIČNA | puna kruna, gornji deo povučen ka centru | lokalni i kompletni pregled |
| 15 | MEM | **FAIL** | obod i deo diska postoje; dve velike otvorene zone i izolovana centralna spirala | ENDER_B_04.jpg, ENDER_B_05.jpg |
| 16 | MIX | GRANIČNA | sva tri završna Z nivoa postoje; terminali se razvlače i vise | ENDER_C_02.jpg, ENDER_C_03.jpg |

PASS* potvrđuje samo kontinuitet/profil koji se vidi. Bez fotografije
naličja nema kvalifikacije ulegnuća mostova.

## Širinska merenja

Tri očitanja sa fotografija šublera su približno {0,5; 0,5; 0,8} mm
(rezolucija instrumenta 0,1 mm; procenjena fotografska nesigurnost ±0,1 mm).
Kuponi nisu označeni 09/10/11. Verovatno je 0,8 mm W66, ali to ostaje samo
inferencija. Ender bead 0,42 mm u machines.json zato ostaje ASSUMED.

## Honest verdict

Provereno: 17 fotografija je arhivirano bez gubitka i vezano SHA-256
manifestom; kompletna tabla daje orijentaciju; MEM v1 nije zatvoren.
Zaključeno: gornji kontinuitet mosta opstaje do 16 mm, LONG je stabilan i
globalni Z raspored radi. Nije gledano: naličje, ulegnuće, lomni test, tačna
identifikacija širinskih kupona i printer-history receipt.

## Erratum (written into this file 2026-09-08; first found 2026-09-06 by the V2 research review)

The table above and `photos/2026-09-04_semir/manifest.json` bind cell 15 (MEM) to `ENDER_B_04.jpg` and
`ENDER_B_05.jpg`. Those two frames show the two woven cups of cells 13 and 14 (L17 upright, L32 leaning with loosened
webs), not the membrane. The MEM disc — rim, partial disc, isolated central spiral — is `ENDER_C_01.jpg` (manifest scope
"detail-batch-c"); the 4×4 overview `ENDER_C_04.jpg` fixes the layout (row 4: L17, L32, MEM, MIX). The V2 research
review of 6 September found this first (`paper/05_research_review/2026-09-06/v2/sources/PHOTO_LOCATOR_CORRECTION.json`,
noted in `STATE.md`) but the correction never reached this file; on 8 September `svemir-claude-fable-cowork` opened
every frame independently, confirmed it, and wrote it here. The verdicts (MEM FAIL, L17/L32 GRANIČNA) are unchanged;
nothing in the table above has been rewritten.
