# Specimen knowledge base

One folder per print job: `specimens/YYYY-MM-DD_shortname/` containing:

- `manifest.json` — the settings vector (schema below)
- `photos/` — fixed-rig photos, repeatable angles (tripod + turntable marks)
- `outcomes.md` — measured results per specimen

## manifest.json schema (per specimen / grid cell)

```json
{
  "date": "", "printer": "Bambu A2L", "nozzle_mm": 0.4, "material": "PLA",
  "grid": {"row": 0, "col": 0},
  "params": {
    "bead_mm": 0.45, "layer_mm": 0.24, "wall_span_mm": 5, "lambda_mm": 8,
    "web_type": "staple", "overhang_e_mm": 1.0, "dwell_mm": 0.6,
    "jitter": 0, "jitter_seed": 1337, "flow_boost": 1.25,
    "speed_mms": 30, "bridge_speed_mms": 18, "nozzle_C": 215, "bed_C": 55,
    "route": "A-stl | B-gcode"
  },
  "outcomes": {
    "survived_removal": null, "torsion_feel": "stiff|soft|failed",
    "failure_mode": "cohesive|adhesive|none", "bridge_sag_mm": null,
    "notes": ""
  }
}
```

Rules: never overwrite a manifest after printing; photograph before handling;
record the seed whenever jitter is nonzero.
