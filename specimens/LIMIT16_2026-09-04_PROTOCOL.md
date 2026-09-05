# LIMIT16 — zajednički protokol

Ovo nisu ukrasne torture table. To su dva ista merna jezika na dve mašine:
isti raspored i iste fizičke dužine, ali mašinski sloj, bead, početak/kraj i
koordinate pripadaju konkretnom profilu.

Fizička serija je završena; trenutna odluka je u
[LIMIT16_2026-09-04_RESULTS.md](LIMIT16_2026-09-04_RESULTS.md).

Tabla je 4 × 4, približno 180 × 180 × 9,6 mm. Red 1 je pozadi na ploči i gore
na mapi. Južni zarezi označavaju kolonu 1–4, zapadni zarezi red 1–4.

| Ćelija | Instrument | Šta izoluje | Čitanje posle štampe |
|---:|---|---|---|
| 01 | B04 | most 4 mm, kontrola | donja linija i ulegnuće |
| 02 | B08 | most 8 mm | ulegnuće i razdvajanje niti |
| 03 | B12 | most 12 mm, stara granica | prva vidljiva degradacija |
| 04 | B16 | most 16 mm, namerno proširenje | početak neuspeha |
| 05 | C08 | konzola 0,8 mm | uvijanje vrha |
| 06 | C18 | konzola 1,8 mm | pomeraj vrha |
| 07 | C30 | konzola 3,0 mm, stara granica | uvijanje / kontakt mlaznice |
| 08 | C45 | konzola 4,5 mm, namerno proširenje | preživljavanje i uvijanje |
| 09 | W34 | uska putanja 0,34 mm | kontinuitet i izmerena širina |
| 10 | WNM | nominalni bead: A2L 0,45 / Ender 0,42 mm | referentna širina |
| 11 | W66 | široka putanja 0,66 mm | greben, prepunjavanje, širina |
| 12 | LONG | oko 360 mm bez retrakcije, 24 obrta | drift protoka i gomilanje u uglu |
| 13 | L17 | izvorni WEFT nagib oko 17° | profil i varovi |
| 14 | L32 | izvorni WEFT nagib oko 32° | prvi degradirani sloj |
| 15 | MEM | membrana 18 mm, jedan sloj | spajanje zavoja i zatvaranje centra |
| 16 | MIX | tri tela završavaju na 1/3, 2/3 i punoj visini | globalni Z i terminalni spojevi |

## Kako se štampa

1. Ne skalirati, ne pomerati i ne ponovo seći finalni G-code.
2. Otvoriti finalni fajl u odgovarajućem programu i pregledati svih 40 (A2L)
   ili 48 (Ender) modelskih Z nivoa.
3. Pratiti celu prvu ravninu. Ona mora ostati jedna povezana mreža.
4. Ostati blizu poslednjeg sloja: tada nastaju mostovi i konzole. Prekinuti ako
   se odvojeni ili uvijeni vrh približi mlaznici.

## Minimalni povratni podatak

- jedna fotografija cele table odozgo;
- jedan niski bočni snimak redova 1, 2 i 4;
- fotografija naličja mostova;
- šublerom širine ćelija 09, 10 i 11;
- filament, temperatura prostorije i svaka ručna intervencija;
- za svaku ćeliju: uspela / granična / pukla, uz jednu rečenicu gde je počelo.

Za sledeću seriju fotografisati i:

- celu tablu sa vidljivim prednjim rubom štampača i oba klastera zareza;
- svaki most odozdo uz milimetarsku skalu i jedan niski bočni kadar;
- širinske kupone dok su još vezani za jasno vidljiv ID 09/10/11;
- filament, temperaturu prostorije i svaku ručnu intervenciju;
- ako postoji, izvoz printer-history zapisa koji vezuje posao za artefakt.

Gate potvrđuje da je svaka namerna vazdušna deonica unutar deklarisanog
eksperimentalnog plafona (16,2 mm most; 4,8 mm konzola). To nije predviđanje da
će ekstrem fizički uspeti — upravo to tabla meri.

Ćelija 15 je koristila proces
`single-layer-inward-spiral/limit16-18mm-v1`. Fizički je **FAILED** na obe
mašine. Postojeći finalni fajlovi ostaju istorijski neizmenjeni, ali isti
identitet procesa više ne sme da se izgradi; zastavica
`--allow-experimental-membrane` ne može da poništi fizički neuspeh. Svaki novi
pokušaj membrane mora dobiti nov, verzionisan identitet.
