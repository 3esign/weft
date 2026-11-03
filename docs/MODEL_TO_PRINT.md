# Od modela do fajla za stampu

## SOKOL: nastavi postojece, ne pocinji ponovo
Iz `C:/Svemir/!Projekti/weft`:

```sh
node tools/finish_sokol.mjs status
node tools/finish_sokol.mjs verify
```

Postojeci input: `specimens/2026-10-03_sokol_ender/sokol_v2c_geometry.json`.
Izvor varijante: `C:/Svemir/data/brain/scratch/sv_sokol_v4_build.mjs`.
Build izlaz: `specimens/2026-10-03_sokol_ender/v2c_package/`.
Predaja: `ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c/`.

Ako status pokazuje aktivan build, NE pokretati drugi niti ponavljati generator. Ako je proces zavrsen i verify prolazi:

```sh
node tools/finish_sokol.mjs deliver
```

`deliver` odbija aktivan build i nevalidan paket. Za preuzet spoljasnji build exit ostaje null (nepoznat); to nije tvrdnja da je build zavrsio sa exit=0. Ako nema aktivnog procesa i paket nije validan, prvo procitati logove i dokumentovati razlog. Tek zatim `node tools/finish_sokol.mjs start`: odvojeni nadzorni proces belezi izlazni kod i automatski predaje uspesan paket. Zivi lock ne uklanjati; mrtav lock premestiti u `_to_delete/` nakon provere PID-a.

## Pravila za svaki naredni model
1. Procitaj AGENTS.md, poslednji korisnikov feedback i PROJECT_STATE.md. Inventar samo direktorijuma zadatka: input, log, PID, manifest, G-code. Razgovor nije dokaz.
2. Odvoji kreativnu formu od tehnicke validnosti. Za sokola proveri bocnu siluetu, kukasti kljun, glavu, krila/rep i poroznost srca. Bez prikaza ne tvrdi da je prepoznatljiv.
3. Validan geometry JSON znaci preskoci generator. Paket koji vec postoji prvo proveri, ne gradi ponovo. Jedna hipoteza, lokalna sonda, tek zatim pun run; bez nasumicnih visina i popustanja gate-a.
4. Varijantu sacuvaj odvojeno; funkcije se gube pri JSON kloniranju. Jezgro ne prepisuj. Sacuvaj input i parametre.
5. Kanonski build: `node weft.mjs build --geo FILE --machine ID --out NOVI_DIR --name NAME --nostl --keep`. ASSUMED bead trazi eksplicitno `--i-know-the-bead-is-a-guess`; dozvola nije kalibracija. STL/3MF ne obecavaj ako nisu proizvedeni.
6. Predaja zahteva manifest za tacnu masinu, neprazan G-code, S1 PASS i nula problema, layered refuse=false i prazan refusedBy, proverene izlazne fajlove i SHA256. Fail/nulti fajl nikada ne ide u ZA_STAMPU kao spreman.
7. Proveri stvarni model stampaca, dimenzije, filament, temperature i start/end komande. Profil `ender` ovde je imenovan Creality Ender-3 V4; kompatibilnost sa korisnikovim uredjajem i bead 0.42 mm nisu fizicki potvrdjeni. Softverski gate nije dokaz uspesne stampe ni nosivosti stolice.

## Statusi
GEOMETRY_READY -> BUILD_RUNNING / EXTERNAL_BUILD_RUNNING -> BUILD_OK -> DELIVERED.
BLOCKED sadrzi konkretan razlog, log i sledecu komandu. DELIVERED oznacava provereni softverski paket, ne fizicku stampu. Belezi vreme, PID, input, exit (ili null), gate i putanju. Ne trazi od korisnika jos jedno 'nastavi' samo da bi proverio vec pokrenuti posao.

## Trenutna blokada
Pri poslednjoj proveri ovog rada `SOKOL_V2_ENDER.gcode` je 0 bajtova i manifest nedostaje. Nije spreman za stampu. Novo stanje proveravati alatima, ne preuzimati ovaj snimak kao trajnu istinu.
Fotografije stolice: [STOLICA_FAIL_2026-10.md](STOLICA_FAIL_2026-10.md). Uzrok pada nije vizuelno potvrdjen.
