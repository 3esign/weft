# Stolica — fotografije prijavljenog pada

> **Ispravka, 2026-10-04:** sva četiri fajla su sada vizuelno otvorena. Nijedan ne prikazuje stolicu ni štampu. Istorijski opis ispod je pogrešno povezivanje slika; detalji su u dopuni na kraju.

Semir je prijavio pad stolice i zatražio dopunu postojeće analize. Ove četiri fotografije već su prikupljene; postojanje i veličine provereni su u ovom nastavku.

| Fotografija (izolovano u `C:\Svemir\data\karantin-slika\weft-stolica-pad-lazne-slike\`) | Bajtovi | Status |
|---|---:|---|
| `pad_a.jpg` | 82747 | Uklonjeno iz javnog stabla (mobilni skrinšot, nije stolica) |
| `pad_b.jpg` | 68030 | Uklonjeno iz javnog stabla (mobilni skrinšot, nije stolica) |
| `pad_c.jpg` | 59607 | Uklonjeno iz javnog stabla (mobilni skrinšot, nije stolica) |
| `pad_d.jpg` | 61704 | Uklonjeno iz javnog stabla (mobilni skrinšot, nije stolica) |

## Granice dokaza

Slike nisu vizuelno pregledane u ovom nastavku. Nije potvrđeno da li prikazuju A1 ili A2L, niti koji G-code, štampač ili sloj pada. Zato istorijski status A2L „NOT PRINTED” nije prepisan tvrdnjom da je baš A2L pao. Ne zaključivati iz naziva fotografija da je uzrok most, adhezija, kolizija ili ekstrudiranje.

Postojeće analize: [A1](../specimens/2026-10-02_stolica_A1/README.md), [A2L](../specimens/2026-10-03_stolica_A2L/README.md), [PROJECT_STATE](../PROJECT_STATE.md).

## Nastavak bez nagađanja

1. Vizuelno otvoriti sve četiri fotografije i opisati vidljivo odvojeno od hipoteza.
2. Povezati fotografije sa konkretnim manifestom/G-code-om i profilom. Ako identitet nije dostupan, ostaviti ga nepoznatim.
3. Utvrditi prvi oštećen sloj, smer pada i stanje podloge; uporediti sa putanjom tog sloja i prethodnim osloncem.
4. Menjati samo parametar koji odgovara dokazu; prvo kratki uzorak kritičnog regiona, zatim pun build. Ne smanjivati gate da bi fizički neuspeh postao formalni prolaz.


## Ispravka dokaza — 2026-10-04

Sve četiri kopije i sva četiri izvornika trenutno prisutna u .codex-remote-attachments pregledani su pomoću view_image:

| Fajl | Neposredno vidljivo |
|---|---|
| pad_a.jpg | Mobilni snimak objave Pump.fun o Holder Rewards/Cashback. |
| pad_b.jpg | Android prikaz aktivnih aplikacija; Svemir chat sa porukom CLI bridge failed: CLI returned no output. |
| pad_c.jpg | Svemir chat u mobilnom pregledaču; neuspešna pretraga i zahtev za PI-WEFT pretpaper. |
| pad_d.jpg | Svemir chat u mobilnom pregledaču; greška nevažećeg direktorijuma i timeout CLI mosta. |

Nema vidljivog predmeta, štampača, podloge, filamenta ili fizičkog oštećenja. Slike ne dokazuju nijedan uzrok pada.

Lokalna sesija c1791026760849sqo9/events.jsonl beleži korisnikov zahtev za slike pada 2026-10-03T17:40:16.624Z, pa pogrešnu tvrdnju asistenta u 18:17:49.410Z da su četiri JPG-a iz .codex-remote-attachments slike stolice. U korisničkim porukama te pregledane sesije nema nepraznog niza images. Kopiranje i veličina fajla nisu provera sadržaja. Ograničena pretraga nije dokaz da prave fotografije ne postoje drugde.

Nepoznati ostaju štampač A1/A2L, konkretni G-code/3MF, profil, filament i prvi oštećeni sloj. A2L istorijski NOT PRINTED ostaje neprepisan.

### Odvojeni digitalni dokazi

- Isporučeni A2L paket koristi staru A1 geometriju, prema manifestu istu po SHA-256. Sačuvani S1 i S3/S4 prolaze; to nije potvrda fizičke štampe.
- Novije generisanje je odbijeno: gate u _to_delete/2026-10-03_stolica_A2L_newgen_gatefail/ beleži cantilever 3,63 i 3,18 mm na z = 2,4 i 3,6 mm, protiv granice 3 mm. To dokazuje ranjiv prelaz stopala u tkanje u odbačenoj geometriji; ne dokazuje uzrok prijavljenog fizičkog pada.
- Sačuvani STOLICA_A2L_report.json sadrži 125.963 unintendedOverlaps. To je signal za proveru samopreseka i ponovljenih prolaza, ne broj fizičkih kolizija: tkanje ima namerne preseke.
- S5 je INFO, S7 INFO, S8 WARN. Geometrijski PASS ne meri adheziju, čvrstoću zavara, naslagu materijala ni dinamičku stabilnost visokog modela.

### Minimalni fizički ogled

Za novu stolicu proveriti prelaz gustog stopala u tkanje bez popuštanja gate-a: ukršteni donji slojevi i postepeno uvođenje amplitude. Mali ogled je prvih 12 mm sa sve četiri stope na istim XY koordinatama i istim redosledom putanja, materijalom i profilom kao pun model. Izvesti pravilan završni blok štampača; ne preseći sirovi G-code nasred toka. Fotografisati na podlozi i zabeležiti prvi sloj podignute ili povučene niti. Uspeh potvrđuje samo donji prelaz, ne spajanje nogu, sedište ili naslon.

**Honest verdict:** sadržaj osam fajlova, navedena sesija i sačuvani izveštaji su pregledani. Potvrđeni su pogrešno povezane slike i digitalni pad nove geometrije pri dnu. Fizički uzrok pada i identitet štampanog paketa nisu potvrđeni. Novi fizički ogled nije pokrenut.

## Korigovani status naslona · 2026-10-04

Semir potvrđuje da se srušio naslon; zakrivljene noge su namerne. Tačan fizički izvršeni fajl i Z otkaza nisu potvrđeni. **HOLD za punu fizičku kvalifikaciju LIRE:** stopalni kupon od 19,2 mm ne kvalifikuje naslon. Pre punog fizičkog pokušaja potrebni su kupon korena naslona i provera razdvajanja/ponovnog spajanja, sa očuvanim procesom i projektovanom bazom. Nijedna štampa nije pokrenuta.

Novi dosije sa stvarnim putanjama: [status naslona](../private-studio/knowledge/chair/CHAIR_STATUS.md). Naslon STOLICA počinje na Z88,32 mm; nestanak centralnog ostrva sedišta na 90,72 mm je drugi događaj. Poboljšanje LIRA spoja jeste digitalno, ne dokaz fizičkog uspeha.
