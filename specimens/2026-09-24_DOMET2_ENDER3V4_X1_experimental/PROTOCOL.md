# DOMET2_ENDER3V4_X1 — reproducible build

Run from the WEFT repository root with the installed Node; no added dependencies, no Python.

```
node core/weft_domet2_geometry.mjs --machine ender --allow-assumed-bead \
     --out DOMET2_ENDER3V4_X1_geometry.json
node weft.mjs build --geo DOMET2_ENDER3V4_X1_geometry.json --machine ender --out <a fresh folder> \
     --name DOMET2_ENDER3V4_X1 --i-know-the-bead-is-a-guess --allow-experimental-bridge
```

`--allow-experimental-bridge` is an explicit admission: the declared ceiling is 60 mm, the chain's maximum,
and the evidenced ceiling is 16.2 mm. The support tolerance `allow` stays at its normal 0.6 mm and must not be
raised; raising it to 8 mm, as the 19 September exports did, turns the gate's support test off.

The second gate at 16.2 mm must report **zero** findings outside a declared terrace or the crown. A finding in
a wall is a design error, not an experiment.

Use a fresh output folder for any revision; the chain refuses to overwrite a frozen delivery receipt.

Physical recording: follow PREDICTIONS.md. Keep the executed file and its hash, material and batch, any speed
or temperature override — **note that T2 sets its own per-sector feedrates, so a global speed override on the
printer destroys that instrument** — the time history, and the layer or Z of any interruption.

Honest verdict: this protocol reproduces digital artifacts. It does not launch a printer and claims no specimen.
