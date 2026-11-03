@echo off
cd /d "C:\Svemir\!Projekti\weft"
node core/weft_field_geometry.mjs --variant sokol --machine ender --name SOKOL_ENDER --H 170 --allow-assumed-bead --out "specimens\2026-10-03_sokol_ender\SOKOL_ENDER.gcode" --svg "specimens\2026-10-03_sokol_ender\SOKOL_ENDER.svg" --report > "specimens\2026-10-03_sokol_ender\gen2.out.log" 2> "specimens\2026-10-03_sokol_ender\gen2.err.log"
echo EXITCODE=%ERRORLEVEL% >> "specimens\2026-10-03_sokol_ender\gen2.out.log"
