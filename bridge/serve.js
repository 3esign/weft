/* WEFT bridge — serves the app and puts local CLI models behind it.
   node bridge/serve.js   →   http://127.0.0.1:8787

   Why a server at all: index.html is a file:// page and a browser cannot spawn
   a process. Serving the folder from here makes the app same-origin with the
   API, so the picker is a plain fetch and no CORS or extension is involved.

   The contract, and the whole point of the experiment: the model proposes
   PARAMETERS, never geometry. WEFT builds them, the compiler answers with a
   verdict, and an invalid answer goes back with the errors attached. Every
   exchange is written to bridge/log/ — that log IS the paper's dataset. */
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { discover, ask } from './cli.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const LOG  = path.join(HERE, 'log');
const PORT = +(process.env.WEFT_PORT || 8787);
fs.mkdirSync(LOG, { recursive: true });

const SCHEMA = `{
  "machine": "a2l" | "a1",
  "mode": "wall" | "dome" | "batch",
  "plan": [{"x":mm,"y":mm}, ...],   // wall only: the plan curve, >=2 points, bed-centred
  "wallH": mm (1..300),             // wall height
  "domeR": mm (10..160), "sweep": deg (10..360), "hFrac": 0.1..1,   // dome only
  "webType": "diagonal" | "perp" | "staple" | "sine" | "eight",
  "cycle": ["chord","web"],         // layer role cycle
  "w": mm (2..40),                  // wall span, chord to chord
  "lambda": mm (3..40),             // node spacing (weld column pitch)
  "overshoot": mm (0..6),           // overhang extension e past both chords
  "dwell": mm (0..3),               // flat landing at diagonal apexes
  "bead": mm (0.2..1.2), "lh": mm (0.08..0.4), "noz": mm (0.2..0.8),
  "amp": mm (0..8), "ampF": int (0..8),      // wall-width breathing wave
  "jitter": 0..1, "flowBoost": 1..2,
  "autoLOD": bool, "minGap": mm, "gradeLean": bool, "lambdaS": mm,
  "maxBridge": mm, "speed": mm/s, "bridgeSpeed": mm/s,
  "temp": C, "bed": C, "fan": %,
  "grid": 2..6, "sweepX": "lambda"|"overshoot"|"w"|"web"|"speed"|"bead", "sweepY": same, "specW": mm, "specH": mm  // batch only
}`;

const METHOD = `WEFT prints a wall as a woven lattice, not a solid. Each layer is ONE continuous
thread. Layer roles alternate by the cycle: a "chord" layer prints both flange lines as a closed
ring, a "web" layer prints one crossing pattern between them. Structure comes from WELD NODES where
a fresh thread crosses the cooled thread below, so the design levers are node spacing (lambda),
overhang extension (overshoot, which pushes crossings past both chords and turns a tangential kiss
into a squished crossing), web grammar, and wall span (w).

Web grammars: diagonal = truss, members axial, needs no moment-capable joints. perp = Vierendeel
frame, shear passes through joint bending, its offset runs are lambda/2 bridges. staple = runs sit
ON the chords, fully supported, each crossing a hairpin staple. sine = smooth wave, curvature braces
the fresh bead. eight = loop stitch, deliberately self-crossing, hooks mechanically around the chord
below.

Hard physical rules: weld nodes must stay at least 2.2 bead widths apart; unsupported spans above
maxBridge droop; bead must be a single extrusion for the nozzle (roughly 1.0-1.5x nozzle diameter);
layer height must stay well under the bead or there is no squish and no weld; the object must fit
the plate.`;

function buildPrompt({ brief, params, report, attempt }) {
  const repair = report && !report.valid;
  return `You are designing for WEFT, a woven-lattice toolpath synthesiser.

${METHOD}

Parameter schema (values outside these ranges are rejected):
${SCHEMA}

${repair ? `Your previous parameters were REJECTED by the compiler. Fix them.

Errors:
${report.errors.map(e => '  - ' + e).join('\n')}
${report.warnings.length ? 'Warnings:\n' + report.warnings.map(w => '  - ' + w).join('\n') : ''}

Measured result of your previous attempt:
${JSON.stringify({ size_mm: report.size_mm, layers: report.layers, weldNodes: report.weldNodes,
  minNodeGap_mm: report.minNodeGap_mm, nodeGapFloor_mm: report.nodeGapFloor_mm,
  maxWebSpan_mm: report.maxWebSpan_mm, overlaps: report.overlaps, estPrint_min: report.estPrint_min }, null, 1)}

Previous parameters:
${JSON.stringify(params, null, 1)}
` : `Current parameters (change only what the brief requires):
${JSON.stringify(params, null, 1)}
`}
DESIGN BRIEF: ${brief}

Answer with ONE JSON object of parameters and nothing else — no prose, no markdown fence, no
explanation. Include only the keys you are setting. Attempt ${attempt}.`;
}

/* Models wrap JSON in prose or fences no matter how firmly you ask. Recover the
   object rather than failing the run — but record what was recovered, because
   "needed extraction" is itself a result worth reporting in the paper. */
function extractJSON(text) {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidates = [];
  if (fence) candidates.push(fence[1]);
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first >= 0 && last > first) candidates.push(text.slice(first, last + 1));
  candidates.push(text);
  for (const c of candidates) {
    try { const o = JSON.parse(c.trim()); if (o && typeof o === 'object' && !Array.isArray(o)) return { ok: true, obj: o, clean: c.trim() === text.trim() }; } catch {}
  }
  return { ok: false };
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.css': 'text/css', '.stl': 'model/stl', '.gcode': 'text/plain',
  '.png': 'image/png', '.md': 'text/markdown; charset=utf-8' };

function send(res, code, body, type = 'application/json') {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}
const readBody = req => new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/weft/providers') return send(res, 200, { providers: discover() });

  if (url.pathname === '/weft/ask' && req.method === 'POST') {
    const b = await readBody(req);
    if (!b.brief) return send(res, 400, { error: 'brief is required' });
    const prompt = buildPrompt({ brief: b.brief, params: b.params || {}, report: b.report, attempt: b.attempt || 1 });
    const t0 = Date.now();
    const r = await ask({ provider: b.provider, model: b.model, prompt });
    if (!r.ok) return send(res, 200, { ok: false, error: r.error, attempts: r.attempts, ms: Date.now() - t0 });
    const j = extractJSON(r.text);
    return send(res, 200, { ok: true, params: j.ok ? j.obj : null, cleanJSON: !!j.clean,
      parseFailed: !j.ok, raw: r.text, strategy: r.strategy, provider: r.provider, model: r.model,
      version: r.version, ms: Date.now() - t0, prompt });
  }

  /* one file per design run: brief, every attempt, every verdict, final params */
  if (url.pathname === '/weft/log' && req.method === 'POST') {
    const b = await readBody(req);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const name = `${stamp}_${(b.provider || 'none')}_${(b.model || 'auto')}.json`;
    fs.writeFileSync(path.join(LOG, name), JSON.stringify(b, null, 2));
    return send(res, 200, { ok: true, file: `bridge/log/${name}` });
  }

  if (url.pathname === '/weft/runs') {
    const files = fs.readdirSync(LOG).filter(f => f.endsWith('.json')).sort();
    return send(res, 200, { runs: files.map(f => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(LOG, f), 'utf8')).summary || {} })) });
  }

  // static
  let p = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const abs = path.join(ROOT, p);
  if (!abs.startsWith(ROOT)) return send(res, 403, 'nope', 'text/plain');
  if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return send(res, 404, 'not found', 'text/plain');
  send(res, 200, fs.readFileSync(abs), MIME[path.extname(abs)] || 'application/octet-stream');
});

server.listen(PORT, '127.0.0.1', () => {
  const provs = discover();
  console.log(`\nWEFT bridge on http://127.0.0.1:${PORT}   (serving ${ROOT})`);
  for (const p of provs) console.log(`  ${p.available ? '✓' : '·'} ${p.label.padEnd(20)} ${p.available ? p.version : 'not found'}`);
  console.log(`\nOpen http://127.0.0.1:${PORT} — the Design-by-language panel appears when this server is up.`);
  console.log(`Design runs are logged to bridge/log/.\n`);
});
