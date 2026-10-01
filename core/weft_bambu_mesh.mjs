/* WEFT Bambu display mesh — the container must show the body it carries (2026-10-01).

   packBambu3mf reused Semir's harvested container wholesale, so every shipped 3MF opened in
   Bambu Studio showing the TEMPLATE's mesh (the T1b diagonal tower wall) instead of the body
   in plate_1.gcode: three different bodies, three identical curved walls on screen. The G-code
   payload was always correct; the picture lied. This module builds an honest display mesh and
   an honest top-view thumbnail from the build's own geometry, so what Studio shows is what
   the machine will print.

   loftFromGeometry(geo)  — lofts the closed per-layer perimeter rings (paths[0], role "wall")
                            into a watertight silhouette mesh: resampled rings, side quads,
                            centroid-fan caps. Centered on origin, z in [-H/2, +H/2], matching
                            the Bambu convention (build item lifts it by H/2).
   objectModelXml(loft)   — the mesh as a 3MF object model, same skeleton as Studio writes.
   topViewPng(geo, size)  — all toolpaths seen from above, layer-shaded, as a PNG buffer
                            (fed to makeBambuThumbnails so the plate preview is the body too). */
import { encodeRgbaPng } from './weft_bambu_thumbnails.mjs';

function fail(message){ throw new Error('WEFT Bambu mesh: ' + message); }

function perimeterOf(layer){
  /* pure-weft layers print no closed loop at all; they carry the section ring as `silhouette` */
  if(layer.silhouette && layer.silhouette.length >= 8) return layer.silhouette;
  for(const p of layer.paths || []){
    const pts = p.pts; if(!pts || pts.length < 8) continue;
    const a = pts[0], b = pts[pts.length - 1];
    if(Math.hypot(a[0] - b[0], a[1] - b[1]) < 1.0) return pts;
  }
  fail('a layer has no closed perimeter path to loft');
}

/* resample a closed ring to n points by arc length, counter-clockwise, 4-decimal grid */
function resampleRing(pts, n){
  let area = 0;
  for(let i = 0; i < pts.length - 1; i++) area += pts[i][0] * pts[i + 1][1] - pts[i + 1][0] * pts[i][1];
  const src = area < 0 ? [...pts].reverse() : pts;
  const cum = [0];
  for(let i = 1; i < src.length; i++) cum.push(cum[i - 1] + Math.hypot(src[i][0] - src[i - 1][0], src[i][1] - src[i - 1][1]));
  const total = cum[cum.length - 1]; if(total < 1e-6) fail('degenerate perimeter ring');
  const out = []; let j = 0;
  for(let k = 0; k < n; k++){
    const t = total * k / n;
    while(j < src.length - 2 && cum[j + 1] < t) j++;
    const seg = cum[j + 1] - cum[j], f = seg > 1e-12 ? (t - cum[j]) / seg : 0;
    out.push([Math.round((src[j][0] + (src[j + 1][0] - src[j][0]) * f) * 1e4) / 1e4,
              Math.round((src[j][1] + (src[j + 1][1] - src[j][1]) * f) * 1e4) / 1e4]);
  }
  return out;
}

/* rotate ring start to sit nearest the previous ring's start, so the loft does not twist */
function alignRing(ring, prev){
  if(!prev) return ring;
  let best = 0, bestD = Infinity;
  for(let i = 0; i < ring.length; i++){
    const d = Math.hypot(ring[i][0] - prev[0][0], ring[i][1] - prev[0][1]);
    if(d < bestD){ bestD = d; best = i; }
  }
  return best === 0 ? ring : ring.slice(best).concat(ring.slice(0, best));
}

export function loftFromGeometry(geo, o = {}){
  const n = o.ringPoints ?? 120;
  const layers = geo.layers; if(!layers || !layers.length) fail('geometry has no layers');
  const H = geo.summary && geo.summary.H || layers[layers.length - 1].zTop;
  const zs = [layers[0].zBot ?? 0, ...layers.map(L => L.zTop)];
  const rings = []; let prev = null;
  for(let k = 0; k < layers.length; k++){
    const ring = alignRing(resampleRing(perimeterOf(layers[k]), n), prev);
    if(k === 0) rings.push(ring);           // bottom of the first layer reuses its perimeter
    rings.push(ring); prev = ring;
  }
  const zc = z => Math.round((z - H / 2) * 1e4) / 1e4;
  const vertices = [], triangles = [];
  for(let r = 0; r < rings.length; r++) for(const p of rings[r]) vertices.push([p[0], p[1], zc(zs[r])]);
  const at = (r, i) => r * n + i % n;
  for(let r = 0; r < rings.length - 1; r++) for(let i = 0; i < n; i++){
    triangles.push([at(r, i), at(r, i + 1), at(r + 1, i + 1)]);
    triangles.push([at(r, i), at(r + 1, i + 1), at(r + 1, i)]);
  }
  for(const [r, up] of [[0, false], [rings.length - 1, true]]){
    const ring = rings[r], c = vertices.length;
    vertices.push([Math.round(ring.reduce((s, p) => s + p[0], 0) / n * 1e4) / 1e4,
                   Math.round(ring.reduce((s, p) => s + p[1], 0) / n * 1e4) / 1e4, zc(zs[r])]);
    for(let i = 0; i < n; i++) triangles.push(up ? [c, at(r, i), at(r, i + 1)] : [c, at(r, i + 1), at(r, i)]);
  }
  return { vertices, triangles, H, faceCount: triangles.length };
}

export function objectModelXml(loft, o = {}){
  const uuid = o.uuid || '00010000-81cb-4c03-9d28-80fed5dfa1dc';
  const v = loft.vertices.map(p => `     <vertex x="${p[0]}" y="${p[1]}" z="${p[2]}"/>`).join('\n');
  const t = loft.triangles.map(f => `     <triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
 <metadata name="BambuStudio:3mfVersion">1</metadata>
 <resources>
  <object id="1" p:UUID="${uuid}" type="model">
   <mesh>
    <vertices>
${v}
    </vertices>
    <triangles>
${t}
    </triangles>
   </mesh>
  </object>
 </resources>
 <build/>
</model>`;
}

/* every toolpath seen from above, shaded dark-to-light by height, on a transparent square */
export function topViewPng(geo, size = 512){
  const layers = geo.layers; if(!layers || !layers.length) fail('geometry has no layers');
  let minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
  for(const L of layers) for(const p of L.paths || []) for(const q of p.pts){
    if(q[0] < minx) minx = q[0]; if(q[0] > maxx) maxx = q[0];
    if(q[1] < miny) miny = q[1]; if(q[1] > maxy) maxy = q[1];
  }
  const span = Math.max(maxx - minx, maxy - miny) || 1, margin = size * 0.06;
  const s = (size - 2 * margin) / span;
  const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
  const px = x => Math.round(size / 2 + (x - cx) * s), py = y => Math.round(size / 2 - (y - cy) * s);
  const img = Buffer.alloc(size * size * 4);
  const put = (x, y, rgb) => {
    if(x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4; img[i] = rgb[0]; img[i + 1] = rgb[1]; img[i + 2] = rgb[2]; img[i + 3] = 255;
  };
  for(let k = 0; k < layers.length; k++){
    const f = layers.length > 1 ? k / (layers.length - 1) : 1;
    const rgb = [Math.round(18 + 30 * f), Math.round(92 + 130 * f), Math.round(40 + 55 * f)];
    for(const p of layers[k].paths || []){
      const pts = p.pts;
      for(let i = 1; i < pts.length; i++){
        let x0 = px(pts[i - 1][0]), y0 = py(pts[i - 1][1]);
        const x1 = px(pts[i][0]), y1 = py(pts[i][1]);
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx + dy;
        for(;;){
          put(x0, y0, rgb); put(x0 + 1, y0, rgb); put(x0, y0 + 1, rgb);
          if(x0 === x1 && y0 === y1) break;
          const e2 = 2 * err;
          if(e2 >= dy){ err += dy; x0 += sx; }
          if(e2 <= dx){ err += dx; y0 += sy; }
        }
      }
    }
  }
  return encodeRgbaPng(size, size, img);
}
