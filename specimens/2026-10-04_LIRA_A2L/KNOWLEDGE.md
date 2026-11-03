# Greske

- 2026-10-04: The previous chair failure dossier contained four unrelated phone screenshots, despite filenames saying pad_a–d. Cause: copying attachments without inspecting pixels or matching session provenance. Remedy: inspect each image and establish specimen/file identity before any causal claim. The corrected upstream dossier preserves the history.
- 2026-10-04, LIRA attempt01: a new seat field appeared at z73.92 while its 28×17 half-section exceeded the two supports; generator refused a31.3mm unsupported run/17.6mm free span. Remedy: converge the lateral roots to a continuous supported neck first, seed the seat inside16×10, flare over36mm. No gate relaxation.
- 2026-10-04, LIRA attempt01: sparse saddle-to-back transition at z114 produced a10.8mm run marginally above generator ceiling. Remedy: introduce a dense crossed landing band smoothly before the back separates, retain the same limits.

# Iskustva

- Sparse field paths are marked bridge. Actual speed is min(path.speed, bridgeSpeed), so changing variant.speed alone does not slow the woven body. LIRA explicitly uses16mm/s bridgeSpeed.
- Generator support metrics and final G-code gate measure different details. Both must pass; a visually plausible field is insufficient.
- The S5 outreach metric includes startup paths in current core. Do not cite it as model stability without a model-only measurement.

# Izvori

- Existing project: docs/STOLICA_FAIL_2026-10.md; specimens/2026-10-03_stolica_A2L/README.md; core/weft_field_geometry.mjs; core/weft_gate_layers.js; machines.json.

# Vestine

- Separate variant registration via exported VARIANTS and generateField. No core modifications.

# Odluke

- Preserve the original specimen and rejected attempt. Deliver a full model plus its first19.2mm prefix as a cheaper physical verification of the root transition. A prefix success does not establish upper-body performance.

## Dopuna 2026-10-04 — naslon
- Greska: ukupni pad površine preseka na 90,72 mm nije početak naslona; centralno ostrvo sedišta tada nestaje, a zadnji pojas postoji od 88,32 mm. Lek: meriti regione odvojeno i iz stvarnog ekstrudiranog Z.
- Iskustvo: stara tolerancija oslonca 0,825 mm može sakriti dug segment bez nominalnog preklopa niti 0,45 mm. Novi privatni studio dodaje zasebnu proveru nominalnog kontakta.
- Odluka: LIRA ostaje UNPRINTED; uspeh stopalnog kupona nije razlog da se naslon proglasi kvalifikovanim. Aktuelni dosije: ../../private-studio/knowledge/chair/CHAIR_STATUS.md.
