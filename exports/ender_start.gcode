; ============================================================
; WEFT Route B · Creality Ender-3 V4 (Creality OS / Klipper)
; start block follows printllm/profiles/v4_config.ini and the
; lessons in printllm/docs/calibration.md (bed mesh, accel, SCV)
; ============================================================
M140 S0
M104 S0
START_PRINT EXTRUDER_TEMP={TEMP} BED_TEMP={BED}
T0
M104 S{TEMP}
BED_MESH_PROFILE LOAD=default
SET_VELOCITY_LIMIT ACCEL=2000 ACCEL_TO_DECEL=1000 SQUARE_CORNER_VELOCITY=2
M204 S2000
G90
M83
G92 E0
G1 Z3 F600
G1 X20 Y2 F15000
G1 Z0.3 F1200
G1 X100 E10 F900
G1 X130 E2 F1500
G1 X150 E0 F3000
G92 E0
; purge line at Y=2, not Y=-1: a slicer counts a negative Y as leaving the bed and refuses the file
; ---- WEFT toolpath ----
