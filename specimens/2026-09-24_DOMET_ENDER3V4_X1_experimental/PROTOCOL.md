# DOMET_ENDER3V4_X1 — reproducible build

Run from the WEFT repository root with the installed Node; no added dependencies, no Python.

```
node core/weft_domet_geometry.mjs --machine ender --allow-assumed-bead --wall-mm 10 \
     --out DOMET_ENDER3V4_X1_geometry.json --svg DOMET_ENDER3V4_X1_preview.svg
node weft.mjs build --geo DOMET_ENDER3V4_X1_geometry.json --machine ender --out <a fresh folder> \
     --name DOMET_ENDER3V4_X1 --i-know-the-bead-is-a-guess --allow-experimental-bridge
```

The chain refuses at every step: geometry → thread → G-code with the machine's harvested start/end blocks →
the gate on the final G-code → header rewritten from the file's own moves → package → manifest. A build that
fails the gate leaves nothing printable behind.

`--allow-experimental-bridge` is required and is an explicit admission: the declared ceiling is 60 mm, which is
the chain's maximum, and the evidenced ceiling is 16.2 mm. The second gate at 16.2 mm must report **zero**
findings outside a declared terrace; a finding in a wall is a design error, not an experiment.

Use a fresh output folder for any revision. Never overwrite a frozen delivery receipt; the chain refuses to.

Physical recording: follow PREDICTIONS.md. Keep the exact printed file and its hash, the material and batch,
any speed or temperature override, the start and end time, and the layer or Z of any interruption. Update
outcomes.md and the specimen ledger when evidence arrives.

Honest verdict: this protocol reproduces digital artifacts. It does not launch a printer and claims no specimen.
