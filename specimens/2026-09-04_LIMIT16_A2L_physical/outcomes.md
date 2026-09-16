# LIMIT16 A2L v1 — fizički ishod

Datum dokaza: 2026-09-04. Operatorova identifikacija: zelena tabla, Bambu Lab
A2L. Artefakt: PRINT_LIMIT16_A2L_v1.gcode.3mf, SHA-256
2C6EEAEDE913CB31290795E96A8254C3C41971A5891B40F9A5BCAB08589F41B6.

| # | Instrument | Odluka | Opažanje | Glavni kadar |
|---:|---|---|---|---|
| 01 | B04 | PASS* | tri ravne, neprekinute niti; naličje nije snimljeno | A2L_C_03.jpg |
| 02 | B08 | PASS* | tri niti opstale i razdvojene | A2L_C_04.jpg |
| 03 | B12 | PASS* | tri niti opstale; bez vidljivog prekida odozgo | A2L_C_05.jpg |
| 04 | B16 | PASS* | kontinuitet opstao; tanke putne niti, ulegnuće nepoznato | A2L_D_01.jpg |
| 05 | C08 | NEODREĐENO | vrlo kratak vrh se na fotografiji stapa sa korenom | A2L_D_02.jpg |
| 06 | C18 | PASS | kratki vrh je prisutan | A2L_D_03.jpg |
| 07 | C30 | GRANIČNA | koren je pun; najmanje jedan vrh opstao, ostali se mešaju sa nitima | A2L_D_04.jpg |
| 08 | C45 | GRANIČNA | slobodni krajevi opstali, ali su pomereni/uvijeni | A2L_D_05.jpg |
| 09 | W34 | NEODREĐENO | zid je delom isečen iz kadra; odvojeno merenje nema ID | A2L_OVERVIEW_01.jpg |
| 10 | WNM | PASS* | pun, neprekinut cilindar; mali šav; širina nije vezana za kupon | A2L_C_02.jpg |
| 11 | W66 | PASS* | pun, neprekinut cilindar; lokalno deblji šav | A2L_B_04.jpg |
| 12 | LONG | PASS | kompletna harmonika, bez jasnog progresivnog gomilanja | A2L_B_05.jpg, A2L_C_01.jpg |
| 13 | L17 | PASS | puna visina i čitljiv profil; otvoreni prozori su namerna topologija | A2L_A_01.jpg |
| 14 | L32 | GRANIČNA | puna visina, jedan sektor uvučen, varovi neujednačeniji | A2L_A_02.jpg, A2L_A_03.jpg |
| 15 | MEM | **FAIL** | obodni prsten postoji, ali veliki polumesec ostaje otvoren; unutrašnja spirala je podignuta | A2L_A_04.jpg, A2L_A_05.jpg |
| 16 | MIX | GRANIČNA | sva tri planirana Z završetka postoje; terminali imaju niti i uvijanje | A2L_B_01.jpg–A2L_B_03.jpg |

PASS* potvrđuje samo ono što se vidi odozgo. Rezultat mosta ne sadrži merenje
ulegnuća niti čvrstoće.

## Širinska merenja

Tri očitanja sa fotografija šublera su približno {0,6; 0,6; 0,6} mm
(rezolucija instrumenta 0,1 mm; procenjena fotografska nesigurnost ±0,1 mm).
Odvojeni kuponi nisu označeni kao ćelija 09, 10 ili 11, pa ovaj skup nije nova
kalibracija bead-a i ne menja machines.json.

## Honest verdict

Provereno: 24 fotografije su arhivirane bez gubitka i vezane SHA-256
manifestom; kompletna tabla i svi instrumenti imaju bar jedan kadar; MEM v1
nije zatvoren. Zaključeno: A2L nosi gornji kontinuitet mosta do 16 mm; C18 je
opstao, C08 nije razlučiv, a degradacija je vidljiva od C30. Nije gledano:
naličje, merenje ulegnuća, lomni test,
tačna identifikacija širinskih kupona i printer-history receipt.
