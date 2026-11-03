# Stolica → LIRA: analiza i odluka

2026-10-04. Izvori su lokalni artefakti, kod i sačuvani izveštaji WEFT-a. Status fizičke štampe ostaje odvojen od digitalnih provera.

## Šta je zapravo bila poslednja stolica

STOLICA_A2L od 2026-10-03 nije nova geometrijska iteracija: ona preuzima geometriju A1 stolice od 2026-10-02, centrira je na ploču A2L i pakuje u njen start/end kontejner. Geometrija je 82,3 × 89,2 × 169,92 mm, 708 slojeva. Sačuvani paket prolazi S1 i slojevite provere, ali S7 je informativan, a S8 upozorava. Najslabiji prijavljeni oslonac sloja je 56,3% na z86,88 mm, sa još346 slojeva iznad. Ovo je geometrijska metrika, ne merenje čvrstoće.

Sveže generisanje iste varijante posle promena za SOKOL nije prošlo: slobodni krajevi3,63 i3,18 mm na visinama2,4 i3,6 mm prelaze limit3 mm. To je konkretan ponovljiv digitalni problem u ranom prelazu stopala u tkanje. Ne dokazuje da je isti mehanizam izazvao korisnikov fizički pad.

## Greška u dokazima o padu

Četiri fajla pad_a–d u ranijem dosijeu vizuelno su pregledana, kao i njihovi izvornici. A prikazuje Pump.fun objavu, B/C/D snimke Svemira na telefonu. Nijedan ne prikazuje stolicu. Dosije docs/STOLICA_FAIL_2026-10.md je dopunjen ispravkom uz očuvanu istoriju.

Zato tačan neuspešni fajl, mašina, prvi oštećen sloj i fizički uzrok ostaju nepoznati. Iz samog broja „unintendedOverlaps” ne sledi kolizija: ta statistika uzorkuje bliske segmente i uključuje moguće namerne preseke. Isto tako, S5 outreach u aktuelnom kodu uključuje startup putanje, pa ga ne koristimo kao dokaz stabilnosti modela.

## Šta se u WEFT-u razvilo

1. Tkane konture i veze između susednih niti dobile su fizičke primere poput Šume i D5. Njihov uspeh važi za te predmete i procese.
2. Otvorene krune i horizontalne membrane pokazale su razliku između geometrijskog oslonca i preživljavanja otiska. KRAK je prolazio S1, ali padao fizički; zato su dodate provere slobodnih vrhova, budućih preleta i redosleda rizičnih delova.
3. Puna tela dobila su ispun kao program. Pure-weft/v1 uklanja zatvorenu kožu, ali je ograničen na jedan radijalni presek.
4. Pure-weft/v2 opisuje telo poljem: može imati više ostrva, spojeve i rupe. Stolica demonstrira četiri stopala koja prelaze u sedište i naslon.
5. SOKOL uvodi program po ostrvu i prostorno sidren talas, a otkriva probleme šava, naglih prelaza amplitude, identiteta ostrva i tankih spojeva. Ujedno su ispravljene provere koje su ZIP čitale kao tekst i zaglavlja koja nisu ažurirana zbog CRLF-a.
6. LIRA koristi tu sposobnost za složeniju promenu topologije4→2→1→2→1, ali uvodi postepen početak tkanja, gušći oslonac naslona i tačan donji probni uzorak. Novi oblik se mora proveriti zasebno; ne nasleđuje fizički uspeh starijih predmeta.

## Zašto LIRA

Jedna rečenica: četiri korena se udružuju u lukove i sedište, a naslon se otvara i ponovo spaja kao lira.

Izabrana je veća visina216 mm i otvor u naslonu koji stvarno menja presek i način štampe. Veći zahtev je u spojevima i ponovnom spajanju ostrva, ne u dodavanju ukrasa. Na ekranu nema izmišljene tkanine ili simulirane čvrstoće: prikazane su nominalne emitovane putanje.

Konkretne intervencije: široki koreni; amplituda raste kroz13 mm; ukrštene linije pri dnu; fiksan broj talasa na stopalu; sporiji fazni pomak; dve noge se spoje pre širenja sedišta; gušći prelaz u naslon; stvarna brzina sparse niti16 mm/s. Postojeći limiti kapije nisu povećani.

## Šta fizički proveriti

Prvo donji uzorak LIRA_ROOT_A2L: četiri stopala u istom rasporedu, sa identičnim prvih80 slojeva punog modela. Posmatrati z2–15 mm: da li se niti podižu, hvataju za diznu ili odvajaju od prethodnog sloja. Fotografisati pre skidanja s ploče, zabeležiti filament i tačan naziv fajla. Njegov uspeh pokriva samo donji prelaz.

Na punom modelu zasebno ostaju spojevi lukova, početak sedišta, prelaz u naslon i zatvaranje gornjeg otvora. Uspešna digitalna provera nije uspešan fizički otisak, niti dokaz nosivosti. Ovo je stona skulptura stolice, ne sedište za čoveka.

## Honest-verdict i kapija lepote

- Provereno: prethodna geometrija, profili, sačuvani gate izveštaji, kod prelaza i stvarni sadržaj osam JPG fajlova. Aktuelni build rezultat pripada README-u i audit.json.
- Zaključeno: postepeni prelazi i lokalni oslonac rešavaju navedene digitalne nedostatke; fizički rezultat se tek proverava.
- Nije provereno: stvarni otisak LIRE, njegov materijalni spoj, deformacija, dinamika mašine i nosivost; identitet prijavljenog starog pada.
- Rečenica je zapisana iznad. Status fizičke provere ostaje vidljiv; nema tvrdnje o već uspešnoj štampi.
- Izbačeni su ukrasi i glatka lažna koža. Hijerarhija: silueta → stvarna nit → mere/provere.
- Prikaz nema automatsku animaciju. Kretanje prati korisnikov pregled ugla ili sloja.
- Geometrija mora ostati čitljiva bez svetlosnih efekata; screenshot provera i njen ishod beleže se u preview izveštaju.
- Offline prikaz koristi lokalni kod, dugmad i klizač; stanje tastature i uskog ekrana proverava preview QA. Neproverene osobine se ne proglašavaju dostupnim.

## Korigovani status naslona · 2026-10-04

Semir potvrđuje da se srušio naslon; zakrivljene noge su namerne. Tačan fizički izvršeni fajl i Z otkaza nisu potvrđeni. **HOLD za punu fizičku kvalifikaciju LIRE:** stopalni kupon od 19,2 mm ne kvalifikuje naslon. Pre punog fizičkog pokušaja potrebni su kupon korena naslona i provera razdvajanja/ponovnog spajanja, sa očuvanim procesom i projektovanom bazom. Nijedna štampa nije pokrenuta.

Novi dosije sa stvarnim putanjama: [status naslona](../../private-studio/knowledge/chair/CHAIR_STATUS.md). Naslon STOLICA počinje na Z88,32 mm; nestanak centralnog ostrva sedišta na 90,72 mm je drugi događaj. Poboljšanje LIRA spoja jeste digitalno, ne dokaz fizičkog uspeha.
