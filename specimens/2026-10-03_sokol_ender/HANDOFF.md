# SOKOL V2c — pouzdan nastavak

Provereno u ovom radu:
- Postojeca geometrija: sokol_v2c_geometry.json. Ne generisati ponovo.
- v2c_package/SOKOL_V2_ENDER.gcode: 120164432 bajta.
- S1 gate: PASS=true, problem_count=0.
- Zavrsni slojeviti gate i manifest jos nisu potvrdjeni. G-code zato NIJE odobren za stampu.
- Postojeci build PID 29288; nadzor PID 9936. PID proveriti uz CommandLine jer se moze ponovo dodeliti.
- finish_status.json belezi EXTERNAL_BUILD_RUNNING. Nadzor ceka postojeci build, proverava oba gate-a i manifest, zatim kopira validan paket i SHA256 u ZA_STAMPU/CREALITY_Ender3V4/SOKOL_V2c. Posle sest sati bez zavrsetka belezi BLOCKED, ne pokrece duplikat.

## Sledeci korak (iz korena weft projekta)
```
node tools/finish_sokol.mjs status
```
Ako je DELIVERED:
```
node tools/finish_sokol.mjs verify
```
Ako je build zavrsen i manifest postoji, a automatska predaja nije izvrsena:
```
node tools/finish_sokol.mjs deliver
```
Ne pokretati start dok postoji ziv nadzor ili build. Ne brisati lock naslepo. Stari izlazi ostaju sacuvani.

## Pre fizicke stampe
Proveriti stvarni model Endera, filament, temperature i start/end komande. Profil koristi pretpostavljeni bead 0.42 mm; C1 kalibracija nije potvrđena. Softverski prolaz nije dokaz fizicke uspesnosti. Prepoznatljivost sokola takodje nije vizuelno potvrđena.

## Ulaz za buduce modele
AGENTS.md → docs/MODEL_TO_PRINT.md → ovaj fajl → finish_status.json i manifest/gate fajlovi.
Fotografije stolice i ogranicenja zakljucaka: docs/STOLICA_FAIL_2026-10.md. Povezano u PROJECT_STATE.md i README-ovima stolice.
