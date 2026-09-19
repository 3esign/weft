import assert from 'node:assert/strict';
import {generateSuspendedSteps} from '../core/weft_suspended_steps_geometry.mjs';

function simplify(p){const out=[p[0]];for(let i=1;i<p.length-1;i++){const a=out.at(-1),b=p[i],c=p[i+1],len=Math.hypot(c[0]-a[0],c[1]-a[1]);if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>len*.001)out.push(b);}out.push(p.at(-1));return out;}
function crossings(a,b){let hits=0;for(let i=1;i<a.length;i++)for(let j=1;j<b.length;j++){const p=a[i-1],q=a[i],r=b[j-1],s=b[j],dx=q[0]-p[0],dy=q[1]-p[1],ex=s[0]-r[0],ey=s[1]-r[1],det=dx*ey-dy*ex;if(Math.abs(det)<1e-8)continue;const u=((r[0]-p[0])*ey-(r[1]-p[1])*ex)/det,v=((r[0]-p[0])*dy-(r[1]-p[1])*dx)/det;if(u>.01&&u<.99&&v>.01&&v<.99)hits++;}return hits;}

assert.throws(()=>generateSuspendedSteps({machine:'ender'}),/allow-assumed/);
for(const machine of ['a2l','ender']){
 const G=generateSuspendedSteps({machine,allowAssumedBead:true}),S=G.summary,LH=S.args.lh;
 assert.equal(S.levels,machine==='a2l'?4:7);assert.equal(S.terraces.length,S.levels-1);
 assert.ok(S.H<=S.boundingContract.allowed_mm[2]);assert.ok(S.boundingContract.allowed_mm[2]-S.H<LH+.001);
 assert.equal(G.layers[0].contours.length,1);
 for(const p of G.foundation.paths.flat())assert.ok(Math.hypot(...p)>50,'foundation must leave the centre empty');
 for(let k=0;k<G.layers.length;k++){const l=G.layers[k];assert.equal(l.k,k);assert.ok(Math.abs(l.zBot-k*LH)<.0001);assert.ok(Math.abs(l.zTop-l.zBot-LH)<.0001);assert.ok(l.contours.length<=1,'no nested bed-founded tubes');}
 for(const t of S.terraces){
  const layers=G.layers.slice(t.k0,t.k1+1);for(const l of layers){assert.equal(l.contours.length,0,'no longitudinal terrace rails');assert.equal(l.paths.length,1);const pts=l.paths[0].pts;assert.ok(Math.hypot(pts[0][0]-pts.at(-1)[0],pts[0][1]-pts.at(-1)[1])<.001);for(let i=1;i<pts.length;i++)assert.ok(Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1])<.55);}
  assert.notDeepEqual(layers[0].paths[0].pts,layers[1].paths[0].pts,'adjacent layers must not duplicate the same radial paths');
  assert.deepEqual(layers[0].paths[0].pts,layers[2].paths[0].pts,'terrace does not shrink/migrate across its thickness');
  const n=crossings(simplify(layers[0].paths[0].pts),simplify(layers[1].paths[0].pts));assert.ok(n>20,'phase change must create actual interlayer crossings');
  console.log(machine,t.name,'crossings',n);
 }
 const grid=G.layers.filter(l=>l.phase==='crown-grid');assert.equal(grid.length,S.roof.gridLayers);assert.ok(S.roof.pitches.at(-1)<S.args.bead);assert.equal(G.layers.at(-1).phase,'crown-art');
 assert.equal(S.experiments.evidencedBridge_mm,16.2);assert.equal(S.args.allow,.6);assert.ok(S.experiments.zones.every(z=>z.z0>0&&z.z1-z.z0<12),'no full-volume experiment zone');
 console.log('PASS',machine,'horizontal terraces, crossed phases, hollow base, global Z, closed patterned roof and bounded experiment policy');
}
