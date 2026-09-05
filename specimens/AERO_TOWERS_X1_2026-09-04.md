# RASEP / VEO — AERO TOWERS X1

Par istražuje isti parametarski jezik kroz dve različite kule. C3D logika definiše profilni niz, loft, uvrtanje, savijanje i polja konzola; WEFT taj intent prevodi u stvarne globalne Z slojeve, povezanu osnovu i naizmenične chord/web putanje.

| Eksperiment | Mašina | Skelet | Veličina | Rizik |
|---|---|---|---|---|
| RASEP | Bambu A2L | 5 rebara, +0,58 obrta, 5 krakova | 73,8 × 81,5 × 91,2 mm | 1,18× iznad konzervativnog oslonca |
| VEO | Ender-3 V4 | 4 rebra, −0,44 obrta, 4 vela | 67,9 × 74,8 × 78,0 mm | 1,24× iznad oslonca + ASSUMED bead |

Obe kule namerno imaju otvorenu krunu, mnogo prolaznih šupljina, bez kapova, bez slicer supporta i bez fizički palog LIMIT16 inward-spiral procesa. Efikasnost dolazi iz skeleta: približno 10,2 g za RASEP i 7,3 g za VEO.

## Honest verdict

Oba finalna mašinska fajla prolaze WEFT G-code kapiju, ali kapija dokazuje kontinuitet putanja, ne stabilnost visokih tankih krakova u stvarnoj dinamici štampača. Oba su namerno neizvesna; VEO je opasniji.
