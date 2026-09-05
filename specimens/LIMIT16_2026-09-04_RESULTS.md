# LIMIT16 — fizički rezultati, 2026-09-04

Ovo je trenutna odluka zasnovana na dve fizičke table istog rasporeda. Zelenu
tablu je operator identifikovao kao Bambu Lab A2L, a žutu kao Creality
Ender-3 V4. Istorijski manifest.json fajlovi ostaju neizmenjeni; oni čuvaju
stanje u trenutku izrade G-code-a.

| Mašina | Istorijski artefakt | SHA-256 | Foto-dokaz |
|---|---|---|---|
| Bambu Lab A2L | PRINT_LIMIT16_A2L_v1.gcode.3mf | 2C6EEAEDE913CB31290795E96A8254C3C41971A5891B40F9A5BCAB08589F41B6 | [24 fotografije](2026-09-04_LIMIT16_A2L_physical/photos/2026-09-04_semir/manifest.json) |
| Creality Ender-3 V4 | EXPERIMENTAL_LIMIT16_ENDER3V4_ASSUMED_BEAD_v1.gcode | E33CB4CA97F9C88812C89F0EF0E1DC504C93513905FFFD6409684E95A4022A2B | [17 fotografija](2026-09-04_LIMIT16_ENDER3V4_physical/photos/2026-09-04_semir/manifest.json) |

Veza slike–artefakt počiva na Semirovoj identifikaciji mašine, boji, potpunom
4 × 4 rasporedu i jedinstvenoj geometriji ćelija. Nije dostavljen izvoz istorije
štampača koji bi kriptografski vezao svaki posao za navedeni SHA-256.

## Rezultat po ćelijama

PASS* znači da je dokazan kontinuitet odozgo, ali ne i donje ulegnuće,
čvrstoća ili dimenziona tolerancija. GRANIČNA znači da je telo opstalo uz
vidljivu degradaciju ili nepotpun foto-dokaz.

| # | Instrument | A2L | Ender-3 V4 | Zajedničko čitanje |
|---:|---|---|---|---|
| 01 | B04 | PASS* | PASS* | most je neprekinut odozgo |
| 02 | B08 | PASS* | PASS* | tri niti preživele |
| 03 | B12 | PASS* | PASS* | tri niti preživele |
| 04 | B16 | PASS* | PASS* | kontinuitet do 16 mm; naličje nije snimljeno |
| 05 | C08 | NEODREĐENO | PASS | A2L vrh nije pouzdano razlučiv; Ender čist |
| 06 | C18 | PASS | GRANIČNA | A2L vrh opstao; Ender ima tanke niti |
| 07 | C30 | GRANIČNA | GRANIČNA | delimično uvijanje/spajanje vrhova |
| 08 | C45 | GRANIČNA | GRANIČNA | slobodni krajevi opstaju uz pomeraj i uvijanje |
| 09 | W34 | NEODREĐENO | PASS* | zidovi stoje, ali merenja nisu vezana za ID ćelije |
| 10 | WNM | PASS* | PASS* | nominalni zidovi su neprekinuti; širina nije kvalifikovana |
| 11 | W66 | PASS* | PASS* | široki zidovi su neprekinuti; lokalni deblji šav |
| 12 | LONG | PASS | PASS | oko 360 mm i 24 obrta bez vidljivog progresivnog gomilanja |
| 13 | L17 | PASS | GRANIČNA | puni profil opstao; Ender ima labavije varove/niti |
| 14 | L32 | GRANIČNA | GRANIČNA | puna visina, ali sektor je povučen ka centru |
| 15 | MEM | **FAIL** | **FAIL** | single-layer-inward-spiral/limit16-18mm-v1 nije zatvorio centar |
| 16 | MIX | GRANIČNA | GRANIČNA | sva tri planirana završna Z nivoa rade; završni spojevi su nečisti |

Detaljna opažanja ostaju u [A2L outcomes](2026-09-04_LIMIT16_A2L_physical/outcomes.md)
i [Ender outcomes](2026-09-04_LIMIT16_ENDER3V4_physical/outcomes.md).

## Očitanja šublera

Šubler je označen na 0,1 mm. Zbog ugla i paralakse fotografije, razumno je
čitati približno ±0,1 mm:

- A2L: neuređen skup {0,6; 0,6; 0,6} mm;
- Ender-3 V4: neuređen skup {0,5; 0,5; 0,8} mm.

Kuponi su mereni odvojeni od table bez trajne oznake 09/10/11, zato nijedno
očitavanje nije pouzdano vezano za W34, WNM ili W66. Pretpostavka da je Ender
0,8 mm kupon W66 jeste verovatna, ali nije dokaz. machines.json se zato ne
menja: A2L ostaje na ranije kalibrisanih 0,45 mm, a Ender 0,42 mm ostaje
ASSUMED do označenog ponovljenog merenja.

## Primljena štamparska inteligencija

- Obe mašine nose gornji kontinuitet mosta kroz 16 mm. To još nije granica
  ulegnuća: potreban je snimak naličja sa skalom.
- Na A2L je C18 opstao, C08 nije razlučiv, a vidljiva degradacija počinje na
  C30. Ender je čist na 0,8 mm, a od 1,8 mm pokazuje niti i sve veće uvijanje.
- LONG je uspeo na obe mašine i može postati jeftin regresioni sentinel.
- L17/L32 preživljavaju punu visinu; L32 već menja oblik, pa je između njih
  korisna zona za sledeću finu seriju.
- MIX potvrđuje globalni Z raspored i tri nezavisna završetka; problem ostaje
  kvalitet terminalnih spojeva, ne planiranje visine.
- Tanke niti između ćelija su putno stringovanje/retrakcija. One nisu deo
  namerne topologije instrumenata.
- MEM v1 je fizički pao na obe mašine: A2L ima veliki polumesec bez ispune i
  podignutu unutrašnju spiralu; Ender ima dve velike otvorene zone i izolovanu
  centralnu spiralu. Geometrijski kontakt sa obodom nije dokaz zatvaranja.

## Sledeća merna tabla

1. BRIDGE2: 16/20/24/28 mm, naličje uz milimetarsku skalu i niski bočni kadar.
2. CANTILEVER2: gušći koraci između 1,8 i 4,5 mm, bočni kadar na istoj visini.
3. WIDTH2: pet ponavljanja po širini, trajni ID pre odvajanja i tri merenja
   duž svakog zida; po mogućnosti mikrometar.
4. MEM2: novi identiteti procesa, odvojeno poređani — ravni raster
   obod–obod, naizmenična dvostruka mreža, višeslojni unutrašnji korbel i
   radijalna lepeza — na rasponima 12/18/24 mm.
5. TRAVEL1: mala tabla za temperaturu, retrakciju i putanje preko praznog
   prostora; stringovanje ne mešati sa nosivošću ćelije.
6. LEAN2: 17/24/32/38° sa standardnim bočnim kadrom.

Isti MEM v1 ne treba ponavljati niti ga dozvoliti zastavicom. Sledeća membrana
mora imati novi, verzionisan identitet procesa.

## Honest verdict

Provereno: 41 jedinstvena fotografija je kopirana i SHA-256 proverena; obe
kompletne table su orijentisane po rasporedu; ćelija 15 je na obe mašine
nedvosmislen fizički neuspeh; istorijski G-code heševi ostali su nepromenjeni.

Zaključeno iz fotografija: kontinuitet odozgo, opstajanje profila i vidljive
deformacije. Nije provereno: naličje i ulegnuće mostova, mehanička čvrstoća,
tačna veza tri odvojena širinska kupona sa ćelijama, filament, temperatura
prostorije, ručne intervencije ni hash iz istorije samog štampača.
