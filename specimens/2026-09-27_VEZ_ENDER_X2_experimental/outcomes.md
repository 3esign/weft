# VEZ_ENDER_X2 · fizički ishod · 2026-09-27

Status: **PRINTED 2026-09-27 na Creality Ender-3 V4** (losos/roze), proces `pre-tied-closed-corbel/v1`,
dometi 24/30/36 mm završeni. 12 sektora × 4 zuba = 48 konzola, po 2 sektora za svaku klasu dometa i
za svaki od dva razmaka vrha (2.4 / 3.2 mm).

| date | event | note |
|---|---|---|
| 2026-09-26 19:19–20:12 | built in session `c1790450370386uwpy` (codex gpt-6-astra + claude review) | V1 je odbijen posle nezavisne recenzije (`recovered/review-vez.md`): predvezivanje je dupliralo krakove u istom sloju (>500 mm ponovljenog kraka, G-3055). V2: vezuje samo staru granicu, bez radijalnog ponavljanja; travel-hop 0.4→1.2 mm na 803 prelaza; `vez-regression.test.mjs` 5/5 PASS. |
| 2026-09-26 22:45 | **OPENED IN CREALITY PRINT — machine evidence** | `debug_Sat_Sep_26_22_45_56_15528.log.0`: command line argument `...\c1790450370386uwpy\weft\VEZ_ENDER_X2\VEZ_ENDER_X2.gcode`. |
| 2026-09-27 08:30:58 | **SENT TO PRINTER — machine evidence** | `debug_Sun_Sep_27_08_29_33_9036.log.0`: `send_gcode` → 192.168.1.5, `uploadName: VEZ_ENDER_X2.gcode`. |
| 2026-09-27 12:44–12:47 | **PRINTED — 13 fotografija sa telefona** | `photos/2026-09-27_semir/`, SHA-256 paritet sa telefonom 13/13 (`manifest.json`). Nalaz ispod. |

**Izgubljeni artefakt:** sam `VEZ_ENDER_X2.gcode` (i generatorski izlaz uz njega) obrisan je iz sesijskog
foldera pre ove konsolidacije; postoji samo u logu slanja i na fotografijama. Rekonstruisani generator je u
`recovered/` (vidi `RECOVERY.md`); regenerisani fajl ne bi bio sertifikovan kao izvršeni bajt-za-bajt.
Lekcija: dokaz živi uz specimen u kičmi projekta, ne u sesijskom folderu.

Semir je identifikovao poslednjih 13 fotografija sa telefona kao odštampani `VEZ_ENDER_X2`. Svih 13 originalnih JPEG-ova je povučeno bez transformacije; lokalni SHA-256 odgovara telefonu 13/13. Spisak i heševi su u `manifest.json`.

## Ishod

- **Završetak: PASS (foto-dokaz).** Završna geometrija i završne poprečne veze su prisutne; pregled je saglasan sa svih 12 sektora i 48 zuba. Ovo nije prekinuta štampa.
- **Rascvetavanje / zahvat mlaznice: PASS sa sitnim ostacima.** Prethodna četkasta gnezda i pomereni gornji sloj nisu prisutni. Niti su uglavnom paralelne i registrovane. Postoje retki konci i nekoliko labavih unutrašnjih/kružnih veza, ali nema foto-dokaza globalnog pomeranja modela.
- **Domet: 24/30/36 mm klase su završene.** Sve tri projektovane klase dolaze do završnih veza u oba ponovljena polukruga. `36 mm` je projektni identitet, ne foto-merenje; nema lenjira ni merenja šublerom.
- **Ravnost: mešovito.** Veliki broj panela je koherentan i lokalno ravan. Najduža klasa pokazuje više luka, uvijanja i lokalnog talasanja od 24/30 mm.
- **Redak bubanj: dovoljan za štampu, slab za rukovanje.** Nema jasnog znaka odlepljivanja ili velikog XY pomeranja na fotografiji na podlozi. Posle skidanja centralni bubanj je veoma savitljiv, a nekoliko kružnih niti visi. Fotografije ne utvrđuju da li je lokalni prekid nastao tokom štampe, skidanja ili kasnijeg savijanja.

## Granica dokaza

Fotografije `20260927_124703.jpg`–`20260927_124720.jpg` prikazuju ručno pritiskanje, savijanje i kidanje. One dokazuju ponašanje pri rukovanju, ali se iz njih pukotine ne pripisuju štampaču. Za stanje pre destruktivnog rukovanja prvenstveno važe `124455`, `124509`, `124511` i `124518`.

## Honest verdict

Provereno: svih 13 originala, paritet heševa sa telefonom, završetak štampe i vidljiva morfologija niti. Zaključeno iz fotografija: glavni V2 cilj je uspeo — nema rascvetalog gnezda ni vidljivog pomeranja od mlaznice; 36 mm je ostvaren, ali je skloniji krivljenju. Nije provereno: stvarni milimetri, ugao/sag, temperatura, tok mašine, trenutak nastanka prekida i doprinos svake pojedinačne V2 izmene.