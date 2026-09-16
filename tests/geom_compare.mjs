#!/usr/bin/env node
/* tests/geom_compare.mjs — compare two WEFT level-2 geometry JSON files (weft.geometry.v1 style:
 * summary / foundation / layers[] with contours[] {pts, nrm, cum, total, nodes, Keff}).
 *
 *   node tests/geom_compare.mjs A_geometry.json B_geometry.json [--tol 0.02] [--summary-only]
 *
 * Measures, per layer and overall:
 *   - layer count, per-layer contour count (exact),
 *   - per-contour symmetric Hausdorff distance between the `pts` polylines (every point of one
 *     polyline against every segment of the other, both ways; contours are matched greedily by
 *     centroid so that a different contour order does not count as a geometric difference),
 *   - node counts (exact, per matched contour) and node positions: every node parameter u is
 *     placed on its own contour (through the file's `cum`, the app's convention) and compared
 *     with the nearest node of the matched contour, both ways,
 *   - summary keys, event list (type sequence and z to 1e-6), foundation path count and the
 *     per-path Hausdorff distance (paths matched by index, they are a tour).
 * PASS requires every exact check to hold and every distance to be <= --tol (mm).
 * No dependencies. Exported as compareGeometry(a, b, opts) for the parity test.
 */
import fs from 'fs';
import { fileURLToPath } from 'url';

const EVENT_Z_TOL = 1e-6;

function segDist(px, py, ax, ay, bx, by){
  const vx = bx - ax, vy = by - ay, wx = px - ax, wy = py - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? (wx * vx + wy * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return Math.sqrt(dx * dx + dy * dy);
}
/** max over points of P of the distance to the polyline Q (its segments), with a bounding-box
 *  prefilter per segment so a 400 x 400 pair stays cheap. */
function directedHausdorff(P, Q, closed){
  const nq = Q.length; if(nq === 0 || P.length === 0) return NaN;
  const segs = closed && nq > 1 ? nq : nq - 1;   // a closed contour already repeats its first point; treat generically
  let worst = 0;
  for(const p of P){
    let best = Infinity;
    for(let i = 0; i < Math.max(1, segs); i++){
      const a = Q[i], b = Q[(i + 1) % nq];
      // cheap reject: the segment's bbox is farther than the current best
      const minx = Math.min(a[0], b[0]) - best, maxx = Math.max(a[0], b[0]) + best;
      if(p[0] < minx || p[0] > maxx) continue;
      const miny = Math.min(a[1], b[1]) - best, maxy = Math.max(a[1], b[1]) + best;
      if(p[1] < miny || p[1] > maxy) continue;
      const d = segDist(p[0], p[1], a[0], a[1], b[0], b[1]);
      if(d < best) best = d;
    }
    if(best > worst) worst = best;
  }
  return worst;
}
export function hausdorff(P, Q, closed = true){ return Math.max(directedHausdorff(P, Q, closed), directedHausdorff(Q, P, closed)); }

function centroid(pts){ let x = 0, y = 0; for(const p of pts){ x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; }
/** Greedy matching of contours by centroid distance; returns pairs [ia, ib] and the unmatched indices. */
function matchContours(A, B){
  const ca = A.map(c => centroid(c.pts)), cb = B.map(c => centroid(c.pts));
  const pairs = []; const usedB = new Set();
  const cand = [];
  for(let i = 0; i < A.length; i++) for(let j = 0; j < B.length; j++) cand.push([Math.hypot(ca[i][0] - cb[j][0], ca[i][1] - cb[j][1]), i, j]);
  cand.sort((p, q) => p[0] - q[0]);
  const usedA = new Set();
  for(const [, i, j] of cand){ if(usedA.has(i) || usedB.has(j)) continue; usedA.add(i); usedB.add(j); pairs.push([i, j]); }
  return { pairs, unmatchedA: A.map((_, i) => i).filter(i => !usedA.has(i)), unmatchedB: B.map((_, j) => j).filter(j => !usedB.has(j)) };
}
/** Position of arc-length parameter u on a contour: through the file's own cum when present. */
function nodePositions(c){
  const pts = c.pts; const n = pts.length;
  let cum = c.cum && c.cum.length === n ? c.cum : null;
  if(!cum){ cum = [0]; for(let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
  const L = cum[n - 1];
  return (c.nodes || []).map(u => {
    let v = L > 0 ? ((u % L) + L) % L : 0;
    let lo = 0, hi = n - 1;
    while(hi - lo > 1){ const mid = (lo + hi) >> 1; if(cum[mid] <= v) lo = mid; else hi = mid; }
    const a = pts[lo], b = pts[Math.min(hi, n - 1)]; const span = cum[hi] - cum[lo];
    const t = span > 0 ? (v - cum[lo]) / span : 0;
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  });
}
function nodeSetDistance(P, Q){
  if(P.length === 0 && Q.length === 0) return 0;
  if(P.length === 0 || Q.length === 0) return Infinity;
  const one = (P, Q) => { let worst = 0; for(const p of P){ let best = Infinity; for(const q of Q){ const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if(d < best) best = d; } if(best > worst) worst = best; } return worst; };
  return Math.max(one(P, Q), one(Q, P));
}

/** Compare geometry objects a and b. Returns { pass, tol, layers:[...], overall:{...}, problems:[...] }. */
export function compareGeometry(a, b, opts = {}){
  const tol = opts.tol != null ? opts.tol : 0.02;
  const problems = [];
  const out = { tol, layers: [], overall: { maxHausdorff: 0, maxNodeDist: 0, maxFoundationHausdorff: 0, layersA: a.layers.length, layersB: b.layers.length }, problems, pass: false };
  if(a.layers.length !== b.layers.length) problems.push(`layer count ${a.layers.length} vs ${b.layers.length}`);
  const nl = Math.min(a.layers.length, b.layers.length);
  for(let k = 0; k < nl; k++){
    const la = a.layers[k], lb = b.layers[k];
    const rec = { k, z: la.zBot, contoursA: la.contours.length, contoursB: lb.contours.length, maxHausdorff: 0, maxNodeDist: 0, nodesA: 0, nodesB: 0, nodeCountMismatch: false, nodeGrid: [] };
    if(la.contours.length !== lb.contours.length) problems.push(`layer ${k}: contour count ${la.contours.length} vs ${lb.contours.length}`);
    const { pairs, unmatchedA, unmatchedB } = matchContours(la.contours, lb.contours);
    for(const [i, j] of pairs){
      const ca = la.contours[i], cb = lb.contours[j];
      const h = hausdorff(ca.pts, cb.pts, true);
      if(h > rec.maxHausdorff) rec.maxHausdorff = h;
      const na = (ca.nodes || []).length, nb = (cb.nodes || []).length;
      rec.nodesA += na; rec.nodesB += nb;
      if(na !== nb){ rec.nodeCountMismatch = true; problems.push(`layer ${k}: contour ${i}/${j} node count ${na} vs ${nb}`); }
      const nd = nodeSetDistance(nodePositions(ca), nodePositions(cb));
      if(nd > rec.maxNodeDist) rec.maxNodeDist = nd;
      if((ca.Keff != null || cb.Keff != null) && ca.Keff !== cb.Keff) problems.push(`layer ${k}: contour ${i}/${j} Keff ${ca.Keff} vs ${cb.Keff}`);
    }
    if(unmatchedA.length || unmatchedB.length){ rec.maxHausdorff = Infinity; }
    for(const i of unmatchedA) rec.nodesA += (la.contours[i].nodes || []).length;
    for(const j of unmatchedB) rec.nodesB += (lb.contours[j].nodes || []).length;
    if(rec.maxHausdorff > out.overall.maxHausdorff) out.overall.maxHausdorff = rec.maxHausdorff;
    if(rec.maxNodeDist > out.overall.maxNodeDist) out.overall.maxNodeDist = rec.maxNodeDist;
    delete rec.nodeGrid;
    out.layers.push(rec);
  }
  // summary
  const ka = Object.keys(a.summary || {}), kb = Object.keys(b.summary || {});
  const missing = ka.filter(k => !kb.includes(k)), extra = kb.filter(k => !ka.includes(k));
  out.overall.summaryKeysA = ka; out.overall.summaryKeysB = kb;
  if(missing.length || extra.length) problems.push(`summary keys differ: missing in B [${missing}] extra in B [${extra}]`);
  const ea = (a.summary && a.summary.events) || [], eb = (b.summary && b.summary.events) || [];
  out.overall.eventsA = ea.length; out.overall.eventsB = eb.length;
  if(ea.length !== eb.length) problems.push(`event count ${ea.length} vs ${eb.length}`);
  let maxEventDz = 0;
  for(let i = 0; i < Math.min(ea.length, eb.length); i++){
    if(ea[i].type !== eb[i].type) problems.push(`event ${i}: type ${ea[i].type} vs ${eb[i].type}`);
    const dz = Math.abs((+ea[i].z) - (+eb[i].z)); if(dz > maxEventDz) maxEventDz = dz;
    if(!(dz <= EVENT_Z_TOL)) problems.push(`event ${i} (${ea[i].type}): z ${ea[i].z} vs ${eb[i].z}`);
  }
  out.overall.maxEventDz = maxEventDz;
  // foundation
  const fa = a.foundation, fb = b.foundation;
  if(!!fa !== !!fb) problems.push(`foundation present ${!!fa} vs ${!!fb}`);
  if(fa && fb){
    const pa = fa.paths || [], pb = fb.paths || [];
    out.overall.foundationPathsA = pa.length; out.overall.foundationPathsB = pb.length;
    if(pa.length !== pb.length) problems.push(`foundation path count ${pa.length} vs ${pb.length}`);
    for(let i = 0; i < Math.min(pa.length, pb.length); i++){
      const h = hausdorff(pa[i], pb[i], false);
      if(h > out.overall.maxFoundationHausdorff) out.overall.maxFoundationHausdorff = h;
    }
    if(pa.length !== pb.length) out.overall.maxFoundationHausdorff = Infinity;
  }
  const worstDist = Math.max(out.overall.maxHausdorff, out.overall.maxNodeDist, out.overall.maxFoundationHausdorff);
  if(!(worstDist <= tol)) problems.push(`max distance ${worstDist} mm > tol ${tol} mm`);
  out.pass = problems.length === 0;
  return out;
}

export function formatReport(r, summaryOnly = false){
  const lines = [];
  if(!summaryOnly){
    lines.push('layer   zBot    contours  hausdorff_mm  nodes     nodeDist_mm');
    for(const l of r.layers) lines.push(`${String(l.k).padStart(5)} ${l.z.toFixed(2).padStart(7)}  ${String(l.contoursA + '/' + l.contoursB).padEnd(8)}  ${l.maxHausdorff.toFixed(4).padStart(12)}  ${String(l.nodesA + '/' + l.nodesB).padEnd(9)} ${l.maxNodeDist.toFixed(4).padStart(11)}${l.nodeCountMismatch ? '  NODE COUNT MISMATCH' : ''}`);
  }
  const o = r.overall;
  lines.push(`layers ${o.layersA} vs ${o.layersB}; contour count mismatches ${r.layers.filter(l => l.contoursA !== l.contoursB).length}; node count mismatches ${r.layers.filter(l => l.nodeCountMismatch).length}`);
  lines.push(`max contour Hausdorff ${o.maxHausdorff.toFixed(4)} mm; max node distance ${o.maxNodeDist.toFixed(4)} mm; max foundation path Hausdorff ${o.maxFoundationHausdorff.toFixed(4)} mm (paths ${o.foundationPathsA} vs ${o.foundationPathsB})`);
  lines.push(`events ${o.eventsA} vs ${o.eventsB}, max |dz| ${o.maxEventDz}; summary keys ${o.summaryKeysA.length} vs ${o.summaryKeysB.length}`);
  if(r.problems.length){ lines.push(`problems (${r.problems.length}):`); for(const p of r.problems.slice(0, 40)) lines.push('  ' + p); if(r.problems.length > 40) lines.push(`  ... ${r.problems.length - 40} more`); }
  lines.push(`${r.pass ? 'PASS' : 'FAIL'} (tol ${r.tol} mm)`);
  return lines.join('\n');
}

function main(argv){
  const files = argv.filter(x => !x.startsWith('--'));
  const opt = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
  if(files.length < 2){ console.error('usage: node tests/geom_compare.mjs A.json B.json [--tol mm] [--summary-only]'); process.exit(2); }
  const a = JSON.parse(fs.readFileSync(files[0], 'utf8')), b = JSON.parse(fs.readFileSync(files[1], 'utf8'));
  const r = compareGeometry(a, b, { tol: +opt('tol', 0.02) });
  console.log(formatReport(r, argv.includes('--summary-only')));
  process.exit(r.pass ? 0 : 1);
}
if(process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) main(process.argv.slice(2));
