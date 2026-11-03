// LIRA preview: reveal the chair through its actual deposition paths, one cut at a time.
// Instrument + editorial field. No display mesh, invented fabric, autoplay, shadows or glow.
// Paths are literal input segments; optional layer sampling is declared on screen and in receipt.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const argv=process.argv.slice(2);
const opt=(key,fallback)=>{const i=argv.indexOf('--'+key);return i<0?fallback:argv[i+1];};
const input=path.resolve(argv.find(v=>!v.startsWith('--'))||path.join(here,'LIRA_A2L_geometry.json'));
const out=path.resolve(opt('out',path.dirname(input)));
let root;
for(let p=here;;p=path.dirname(p)){
  for(const candidate of [p,path.join(p,'!Projekti','weft')]){
    if(fs.existsSync(path.join(candidate,'core','weft_field_geometry.mjs'))){root=candidate;break;}
  }
  if(root||path.dirname(p)===p)break;
}
if(!root)throw Error('WEFT repository was not found above this script.');
const raw=fs.readFileSync(input),D=JSON.parse(raw),S=D.summary;
if(!S||!D.layers?.length)throw Error('Expected WEFT field geometry with summary and layers.');
const bead=Number(S.args.bead),lh=Number(S.args.lh);
const maxLayers=Number(opt('max-layers','320'));
if(!Number.isInteger(maxLayers)||maxLayers<1)throw Error('--max-layers must be a positive integer.');
const stride=Math.max(1,Math.ceil(D.layers.length/maxLayers));
const selected=D.layers.filter((l,i)=>i%stride===0||i===D.layers.length-1);
const hash=crypto.createHash('sha256').update(raw).digest('hex');
let count=0,totalSegments=0,x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
for(const layer of D.layers)for(const p of layer.paths||[]){
  totalSegments+=Math.max(0,p.pts.length-1);
  for(const q of p.pts){x0=Math.min(x0,q[0]);x1=Math.max(x1,q[0]);y0=Math.min(y0,q[1]);y1=Math.max(y1,q[1]);}
}
for(const layer of selected)for(const p of layer.paths||[])count+=Math.max(0,p.pts.length-1);
const start=new Float32Array(count*3),end=new Float32Array(count*3),width=new Float32Array(count);
let n=0;
for(const layer of selected)for(const p of layer.paths||[])for(let i=1;i<p.pts.length;i++){
  const a=p.pts[i-1],b=p.pts[i];
  // Three.js Y is up; printer +Y points away from the chair's front.
  start.set([a[0],layer.zTop,a[1]],n*3);end.set([b[0],layer.zTop,b[1]],n*3);
  width[n]=(p.bead||bead)/2;n++;
}
const to64=a=>Buffer.from(a.buffer,a.byteOffset,a.byteLength).toString('base64');
const name=String(S.name||'LIRA_A2L').replace(/[^A-Za-z0-9_-]/g,'_');
const title=String(S.title||'LIRA');
const meta={name,title,input:path.basename(input),sha256:hash,bead,lh,
  size:S.size_mm,layers:D.layers.length,shown:selected.length,stride,segments:count,totalSegments,
  sourceLayers:selected.map(l=>l.k),height:D.layers.at(-1).zTop,thread:S.field?.fillLength_m,
  bounds:[x0,y0,x1,y1],machine:S.machineLabel||S.machine,
  source:'Generated nominal deposition paths; final G-code and physical print require separate checks.'};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const three=fs.readFileSync(path.join(root,'vendor','three.min.js'),'utf8');
const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · WEFT / Path study</title>
<style>
:root{--paper:#eeebe4;--ink:#292e2c;--muted:#5c625e;--line:#c9c7be;--copper:#965a38}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--paper);color:var(--ink);font-family:Arial,Helvetica,sans-serif}button,input{font:inherit}button{cursor:pointer;color:inherit;border:1px solid var(--line);background:transparent;min-height:44px;padding:9px 15px}button:hover{border-color:var(--ink)}button[aria-pressed=true]{color:var(--paper);background:var(--ink);border-color:var(--ink)}button:focus-visible,input:focus-visible,canvas:focus-visible,a:focus-visible{outline:3px solid var(--copper);outline-offset:4px}main{min-height:100vh;display:grid;grid-template-columns:290px minmax(0,1fr);padding:42px 40px 24px;gap:24px}aside{display:flex;flex-direction:column;min-width:0;z-index:2}.eyebrow{font-size:11px;letter-spacing:.12em;font-weight:700;line-height:1.7}.date{margin:0 0 56px;color:var(--muted)}h1{font-size:94px;font-weight:400;letter-spacing:-.065em;line-height:.94;margin:0 0 20px}.subtitle{font-size:19px;line-height:1.35;max-width:235px;margin:0 0 30px}.rule{height:1px;background:var(--line);width:64px;margin:0 0 25px}.abstract{font-size:14px;line-height:1.65;margin:0;max-width:237px;color:var(--muted)}dl{margin:35px 0 0;display:grid;grid-template-columns:1fr;gap:18px}dt{font-size:10px;text-transform:uppercase;letter-spacing:.10em;color:var(--muted);margin:0 0 5px}dd{margin:0;font-size:16px;line-height:1.35;font-variant-numeric:tabular-nums}.provenance{margin-top:auto;padding-top:40px;font-size:11px;line-height:1.6;color:var(--muted);max-width:245px}.provenance b{color:var(--ink);font-weight:400}.stage{display:flex;flex-direction:column;min-width:0;min-height:0}.stage-top{display:flex;justify-content:space-between;gap:12px;font-size:11px;letter-spacing:.045em;line-height:1.5;border-bottom:1px solid var(--line);padding-bottom:12px}.stage-top span:last-child{color:var(--muted)}.viewport{position:relative;flex:1;min-height:590px}canvas{width:100%;height:100%;position:absolute;display:block;touch-action:none;cursor:grab}canvas:active{cursor:grabbing}.orientation{position:absolute;left:20px;bottom:18px;color:var(--muted);font-size:11px;line-height:1.5;pointer-events:none}.view-name{position:absolute;right:0;bottom:18px;color:var(--muted);font-size:11px}.toolbar{border-top:1px solid var(--line);padding:15px 0 0;display:flex;align-items:center;gap:18px;flex-wrap:wrap}.views{display:flex;gap:5px}.slice{display:flex;align-items:center;gap:12px;flex:1;min-width:220px;font-size:12px}.slice input{width:100%;min-width:70px;accent-color:var(--copper)}.slice output{white-space:nowrap;min-width:92px;text-align:right;font-variant-numeric:tabular-nums}.bottom{display:flex;justify-content:space-between;gap:20px;font-size:10px;line-height:1.5;color:var(--muted);padding-top:13px}.bottom span:first-child{max-width:420px}#error{display:none;position:absolute;inset:20%;font-size:18px;line-height:1.6;color:#823c21}body.thumbnail main{display:block;padding:0;min-height:100vh}body.thumbnail aside,body.thumbnail .stage-top,body.thumbnail .toolbar,body.thumbnail .bottom,body.thumbnail .orientation,body.thumbnail .view-name{display:none}body.thumbnail .stage,body.thumbnail .viewport{height:100vh;min-height:0}body.capture .orientation{opacity:.75}@media(max-width:900px){main{grid-template-columns:220px minmax(0,1fr);padding:28px 24px 20px;gap:10px}h1{font-size:74px}.subtitle{font-size:17px}.viewport{min-height:560px}.views{gap:3px}button{padding:9px 10px}.toolbar{gap:10px}.date{margin-bottom:42px}}@media(max-width:650px){main{display:flex;flex-direction:column;padding:24px 20px;gap:24px}aside{display:grid;grid-template-columns:1fr 1fr;gap:12px 22px}.eyebrow{grid-column:1/-1}.date{display:none}h1{font-size:74px;margin:0;grid-column:1}.subtitle{font-size:16px;margin:0;grid-column:2;align-self:center}.rule,.abstract{display:none}dl{grid-column:1/-1;margin:8px 0 0;grid-template-columns:repeat(3,1fr);gap:12px}dt{font-size:9px}dd{font-size:13px}.provenance{grid-column:1/-1;margin:0;padding:0;max-width:none;font-size:10px}.stage{min-height:560px}.viewport{height:440px;min-height:440px}.stage-top{font-size:10px}.toolbar{justify-content:space-between}.views{width:100%;justify-content:space-between}.views button{flex:1}.slice{min-width:100%}.bottom{font-size:10px}.orientation{left:0}body.thumbnail .viewport{height:100vh;min-height:100vh}}
</style></head><body>
<main><aside><div class="eyebrow">WEFT / PATH STUDY<br><span class="date">04 OCT 2026 · A2L</span></div><div style="height:42px" class="date"></div>
<h1>${escape(title)}</h1><p class="subtitle">A chair sculpture<br>drawn in woven paths.</p><div class="rule"></div><p class="abstract">Four roots become paired arches, a seat and a back that opens into light.</p>
<dl><div><dt>Design envelope</dt><dd>${S.size_mm.map(v=>Number(v).toFixed(1)).join(' × ')}<br>mm</dd></div><div><dt>Nominal deposition</dt><dd>${meta.layers} layers / ${lh.toFixed(2)} mm</dd></div><div><dt>Machine</dt><dd>${escape(meta.machine)}<br>${bead.toFixed(2)} mm bead</dd></div></dl>
<p class="provenance"><b>Generated path geometry.</b><br>No surface has been invented between the threads. This view does not certify a print or the strength of a chair.</p></aside>
<section class="stage" aria-label="Interactive chair path viewer"><div class="stage-top"><span>01 / THE THREAD IS THE FORM</span><span id="sampling"></span></div><div class="viewport"><canvas id="canvas" tabindex="0" aria-label="3D chair paths. Arrow keys rotate. Plus and minus zoom. Home resets. Keys 1 to 4 change views."></canvas><div class="orientation">DRAG TO ROTATE · SCROLL TO ZOOM<br>1–4 VIEWS · ARROWS ORBIT · HOME RESET</div><div class="view-name" id="view-name">ISOMETRIC</div><p id="error" role="alert"></p></div>
<div class="toolbar"><nav class="views" aria-label="Camera views"><button type="button" data-view="iso" aria-pressed="true">3D</button><button type="button" data-view="front" aria-pressed="false">Front</button><button type="button" data-view="side" aria-pressed="false">Side</button><button type="button" data-view="top" aria-pressed="false">Top</button></nav><label class="slice">Cut<input id="cut" aria-label="Highest visible model layer" type="range" min="1" max="${meta.layers}" value="${meta.layers}" step="1"><output id="cut-value"></output></label></div>
<div class="bottom"><span id="path-note"></span><span>LOCAL / OFFLINE<br>${hash.slice(0,12)}</span></div></section></main>
<script>${three}</script><script>
const M=${JSON.stringify(meta)};
function floats(s){const raw=atob(s),b=new Uint8Array(raw.length);for(let i=0;i<raw.length;i++)b[i]=raw.charCodeAt(i);return new Float32Array(b.buffer);}
const A=floats('${to64(start)}'),B=floats('${to64(end)}'),R=floats('${to64(width)}');
const $=id=>document.getElementById(id),canvas=$('canvas');
$('sampling').textContent=M.shown===M.layers?'ALL '+M.layers+' LAYERS':M.shown+' / '+M.layers+' LAYERS SHOWN';
$('path-note').textContent=M.segments.toLocaleString('en-US')+' literal path segments. '+(M.stride===1?'All generated layers.':'One layer in '+M.stride+', plus the last; no interpolated paths.')+' Nominal bead-width strokes; no plastic deformation.';
try{
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0xeeebe4,1);
const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera();
const geo=new THREE.InstancedBufferGeometry();
geo.setAttribute('position',new THREE.Float32BufferAttribute([-1,0,0,1,0,0,-1,1,0,1,0,0,1,1,0,-1,1,0],3));
geo.setAttribute('aStart',new THREE.InstancedBufferAttribute(A,3));geo.setAttribute('aEnd',new THREE.InstancedBufferAttribute(B,3));geo.setAttribute('aRadius',new THREE.InstancedBufferAttribute(R,1));geo.instanceCount=M.segments;
const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,uniforms:{cut:{value:M.height+.01},color:{value:new THREE.Color(0xa66a46)}},
vertexShader:'attribute vec3 aStart;attribute vec3 aEnd;attribute float aRadius;varying float edge;varying float sourceZ;void main(){vec4 a=modelViewMatrix*vec4(aStart,1.0);vec4 b=modelViewMatrix*vec4(aEnd,1.0);vec2 d=b.xy-a.xy;float len=max(length(d),0.000001);vec2 normal=vec2(-d.y,d.x)/len;vec4 p=mix(a,b,position.y);p.xy+=normal*position.x*aRadius;edge=position.x;sourceZ=aStart.y;gl_Position=projectionMatrix*p;}',
fragmentShader:'uniform float cut;uniform vec3 color;varying float edge;varying float sourceZ;void main(){if(sourceZ>cut)discard;float shade=0.46+0.54*sqrt(max(0.0,1.0-edge*edge));gl_FragColor=vec4(color*shade,1.0);}'});
const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;scene.add(mesh);
const cx=(M.bounds[0]+M.bounds[2])/2,cz=(M.bounds[1]+M.bounds[3])/2;
const dx=M.bounds[2]-M.bounds[0],dz=M.bounds[3]-M.bounds[1];
const ground=new THREE.BufferGeometry(),marks=[];const margin=6;
for(const [sx,sz] of [[-1,-1],[-1,1],[1,-1],[1,1]]){const x=cx+sx*(dx/2+margin),z=cz+sz*(dz/2+margin);marks.push(x,-.35,z,x-sx*5,-.35,z,x,-.35,z,x,-.35,z-sz*5);}
ground.setAttribute('position',new THREE.Float32BufferAttribute(marks,3));const datum=new THREE.LineSegments(ground,new THREE.LineBasicMaterial({color:0xb1b2a9}));scene.add(datum);
let yaw=.64,pitch=.24,zoom=1,view='iso',cut=M.layers;
const target=new THREE.Vector3(cx,M.height*.50,cz);
function draw(){const box=canvas.parentElement.getBoundingClientRect(),w=Math.max(1,box.width),h=Math.max(1,box.height);renderer.setSize(w,h,false);
  const range=view==='top'?Math.max(dx,dz)*1.30:Math.max(M.height*1.20,Math.max(dx,dz)*1.04);const aspect=w/h;
  let span=range/zoom;if(view!=='top')span=Math.max(span,(Math.max(dx,dz)*1.36)/aspect/zoom);else span=Math.max(span,Math.max(dx,dz)*1.30/aspect/zoom);
  camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.near=.1;camera.far=2500;camera.updateProjectionMatrix();camera.up.set(0,1,0);
  camera.position.set(target.x+700*Math.sin(yaw)*Math.cos(pitch),target.y+700*Math.sin(pitch),target.z-700*Math.cos(yaw)*Math.cos(pitch));camera.lookAt(target);material.uniforms.cut.value=cut*M.lh+.001;renderer.render(scene,camera);
  $('cut-value').textContent=(cut*M.lh).toFixed(2)+' mm';window.__ready=true;window.__viewState={view,cut,yaw,pitch,zoom,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
window.setView=(next)=>{view=next;yaw=next==='side'?Math.PI/2:next==='iso'?.64:0;pitch=next==='top'?Math.PI/2-.00001:next==='iso'?.24:0;zoom=1;$('view-name').textContent=next==='iso'?'ISOMETRIC':next.toUpperCase();document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===next)));draw();};
window.setCut=(k)=>{cut=Math.max(1,Math.min(M.layers,Math.round(k)));$('cut').value=cut;draw();};
window.setThumbnail=()=>{document.body.classList.add('thumbnail');datum.visible=false;window.setView('iso');};
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>window.setView(b.dataset.view));$('cut').oninput=e=>window.setCut(+e.target.value);
let drag=null;canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.006;pitch=Math.max(-1.3,Math.min(1.52,pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];view='orbit';$('view-name').textContent='ORBIT';document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed','false'));draw();});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.45,Math.min(5,zoom*Math.exp(-e.deltaY*.001)));draw();},{passive:false});
canvas.addEventListener('keydown',e=>{let used=true;if(e.key==='ArrowLeft')yaw-=.12;else if(e.key==='ArrowRight')yaw+=.12;else if(e.key==='ArrowUp')pitch=Math.min(1.52,pitch+.12);else if(e.key==='ArrowDown')pitch=Math.max(-1.3,pitch-.12);else if(e.key==='+'||e.key==='=')zoom=Math.min(5,zoom*1.15);else if(e.key==='-')zoom=Math.max(.45,zoom/1.15);else if(e.key==='Home')window.setView('iso');else if('1234'.includes(e.key))window.setView(['iso','front','side','top'][+e.key-1]);else used=false;if(used){e.preventDefault();draw();}});
window.addEventListener('resize',draw);new ResizeObserver(draw).observe(canvas.parentElement);draw();window.__previewMeta=M;
}catch(e){$('error').style.display='block';$('error').textContent='The interactive view needs WebGL. Static PNG views accompany this file. '+e.message;window.__previewError=String(e);}
</script></body></html>`;
fs.mkdirSync(out,{recursive:true});
const htmlPath=path.join(out,'preview.html');fs.writeFileSync(htmlPath,html);
if(argv.includes('--html-only')){console.log(JSON.stringify({html:htmlPath,...meta}));process.exit(0);}
const candidates=[root,path.resolve(root,'../..'),process.env.WEFT_NODE_MODULES,
  path.join(os.homedir(),'.cache','codex-runtimes','codex-primary-runtime','dependencies','node','node_modules')].filter(Boolean);
let chromium,playwrightPath;
for(const p of candidates){try{const req=createRequire(path.join(p,'package.json'));playwrightPath=req.resolve('playwright');({chromium}=req('playwright'));break;}catch{}}
if(!chromium)throw Error('Existing Playwright not found. Set WEFT_NODE_MODULES to its containing node_modules. HTML was written.');
const executable=process.env.WEFT_CHROMIUM||[
  path.join(process.env.PROGRAMFILES||'', 'Google','Chrome','Application','chrome.exe'),
  path.join(process.env['PROGRAMFILES(X86)']||'', 'Microsoft','Edge','Application','msedge.exe')
].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,...(executable?{executablePath:executable}:{}),args:['--allow-file-access-from-files','--enable-webgl','--ignore-gpu-blocklist']});
const errors=[],files=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1});
  page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(pathToFileURL(htmlPath).href,{timeout:120000});
  await page.waitForFunction(()=>window.__ready||window.__previewError,{timeout:120000});
  const browserError=await page.evaluate(()=>window.__previewError);if(browserError)throw Error(browserError);
  await page.evaluate(()=>document.body.classList.add('capture'));
  for(const [mode,suffix] of [['iso','preview'],['front','front'],['side','side'],['top','top']]){
    await page.evaluate(mode=>window.setView(mode),mode);
    const file=path.join(out,name+'_'+suffix+'.png');await page.screenshot({path:file});files.push(file);
  }
  // Exercise the actual user controls and ensure the DOM remains inside narrow screens.
  await page.locator('#cut').fill(String(Math.max(1,Math.floor(meta.layers/2))));
  await page.locator('#cut').dispatchEvent('input');
  const half=await page.evaluate(()=>window.__viewState.cut);if(half!==Math.max(1,Math.floor(meta.layers/2)))throw Error('Layer cut did not follow input.');
  await page.locator('#canvas').focus();await page.keyboard.press('Home');await page.keyboard.press('ArrowRight');
  const keyboard=await page.evaluate(()=>window.__viewState.yaw);if(Math.abs(keyboard-.76)>.0001)throw Error('Keyboard orbit did not update camera.');
  await page.evaluate(()=>window.setCut(window.__previewMeta.layers));
  await page.setViewportSize({width:390,height:844});
  const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.getElementById('canvas').getBoundingClientRect().width}));
  if(mobile.scroll>mobile.width+1)throw Error('Preview overflows mobile viewport: '+JSON.stringify(mobile));
  await page.screenshot({path:path.join(out,name+'_mobile.png'),fullPage:true});
  await page.setViewportSize({width:512,height:512});await page.evaluate(()=>window.setThumbnail());
  const thumbnail=path.join(out,'thumbnail.png');await page.screenshot({path:thumbnail});files.push(thumbnail);
  if(errors.length)throw Error(errors.join('\n'));
  const receipt={...meta,html:htmlPath,files,playwrightPath,executable:executable||'bundled Chromium',browserErrors:errors,
    qa:{layerCut:true,keyboardOrbit:true,mobile},honestVerdict:{sentence:'The chair is revealed by its real generated deposition paths.',falseClaims:'None; software geometry and physical outcome are explicitly separate.',removed:'No display mesh, invented skin, shadows, bloom or automatic movement.',hierarchy:'Chair, title, controls and provenance.',motion:'Only direct user camera and layer-cut changes.',bareScreen:'Only geometry, flat color and typography.',access:'Keyboard, visible focus, no autoplay, offline assets and tested mobile width; requires WebGL.'}};
  fs.writeFileSync(path.join(out,'preview_receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));
}finally{await browser.close();}
