import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),PI=path.resolve(root,'..'),dossier=path.join(PI,'paper/03_experiments/2026-09-19_zigurat_horizontal_weft');
const evidence=path.join(dossier,'first_layer_incident');fs.mkdirSync(evidence,{recursive:true});
const sources=[['C:/Users/treed/AppData/Local/Temp/codex-clipboard-383cd052-701d-4a44-8db2-95bcefa5c748.png','01_reported_purge_preview_Z030.png'],['C:/Users/treed/AppData/Local/Temp/codex-clipboard-4cc3c406-5c7b-4e11-9dfb-e950e7a01a4c.png','02_reported_model_base_Z020.png']];
const rows=[];for(const [src,name] of sources){const b=fs.readFileSync(src),sha256=crypto.createHash('sha256').update(b).digest('hex'),out=path.join(evidence,name);if(fs.existsSync(out)&&!fs.readFileSync(out).equals(b))throw Error('evidence collision');if(!fs.existsSync(out))fs.writeFileSync(out,b);rows.push({file:name,source:src,sha256,bytes:b.length,provenance:'Semir user attachment, 2026-09-19; unedited screenshot of the old Ender preview'});}
const manifest=path.join(evidence,'manifest.json');if(!fs.existsSync(manifest))fs.writeFileSync(manifest,JSON.stringify({date:'2026-09-19',files:rows,meaning:'Original user screenshots, not photographs of a physical print or of the corrected file.'},null,2));
fs.writeFileSync(path.join(dossier,'FIRST_LAYER_FIX.md'),`# First-layer incident · 2026-09-19

Semir reported that the delivered Ender preview appeared to have an empty first layer. His two unedited screenshots are retained with hashes in [the evidence manifest](first_layer_incident/manifest.json).

The old file contains two startup purge segments at Z0.30 before 2,531 model-base extrusion segments at Z0.20. The latter form the intended perimeter frame; the interior is intentionally open. The preview displayed the two heights as separate layers. This did not establish that the physical foundation was absent, but it exposed a missing export invariant.

The global WEFT correction classifies startup as preparation/wipe, restores the model role and validates actual initial model extrusion. The Ender replacement is **OBRTAJ_ENDER_H7_FIRST_LAYER_FIXED.gcode**; the original was open and locked in Creality Print and must be treated as superseded. Both files' command hashes are identical, so purge, movement and extrusion are unchanged. The Bambu base was already at Z0.24; its export and container now carry the same shared guard.

![Literal first-layer paths](first-layer-paths.png)

This drawing is generated from corrected G-code XY extrusion coordinates, not from a nominal model and not from a native slicer screenshot. [Interactive browser-sized drawing](first-layer-paths.html).

- [Ender correction receipt](../../../weft/specimens/2026-09-19_OBRTAJ_ENDER_H7_experimental/FIRST_LAYER_REPAIR.json)
- [Bambu correction receipt](../../../weft/specimens/2026-09-19_RAZMAK_A2L_H4_experimental/FIRST_LAYER_REPAIR.json)
- [Global contract, implementation, source links and regression coverage](../../../weft/docs/FIRST_LAYER_CONTRACT.md)

The new regressions reproduce Z0.30 followed by Z0.20 and reject it; they also reject empty, hidden, raised and misnumbered first model layers. Header/body printer commands remain identical. Support gates are rerun on corrected file bytes and the packed Bambu payload is independently checked.

Honest verdict: file structure, actual base paths and first-layer guard are checked in software. Creality source was inspected to verify its preview-layer construction. The installed slicer GUI was not controlled or reopened, and no physical print was initiated. Sag, weld quality and mechanical behaviour remain experimental.
`);
console.log(path.join(dossier,'FIRST_LAYER_FIX.md'));
