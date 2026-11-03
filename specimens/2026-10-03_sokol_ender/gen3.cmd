@echo off
cd /d "C:\Svemir\!Projekti\weft"
node core/weft_field_geometry.mjs --variant sokol --machine ender --name SOKOL_ENDER --H 185 --out specimens/2026-10-03_sokol_ender/out185 1>> specimens/2026-10-03_sokol_ender/gen3.log 2>&1
