// LIRA: four roots become two arches, a seat and an open lyre-shaped back.
// A printable sculpture, not a load-certified seat. Existing WEFT gates remain unchanged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
export const root=[path.resolve(here,'../..'),path.resolve(here,'../../../..','!Projekti/weft')].find(p=>fs.existsSync(path.join(p,'core/weft_field_geometry.mjs')));
const {VARIANTS,generateField,sdRoundRect2,smin,profileAt}=await import(pathToFileURL(path.join(root,'core/weft_field_geometry.mjs')));
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const ease=t=>{t=clamp(t);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
export const LIRA={
 title:'LIRA',H:216,speed:36,
 concept:'four round roots join as two lateral arches, open into a saddle and rise as a split lyre back; the thread is visible on every side',
 bbox(H){const s=H/216;return [-63*s,-63*s,63*s,72*s];},
 field(x,y,z,H){
  const s=H/216;x/=s;y/=s;z/=s;
  const r=mix(11.6,9.8,ease(z/20));
  const cy=mix(33,5,ease((z-16)/49));
  const cx=mix(34,7,ease((z-42)/30));
  let legs=1e4;
  for(const sx of [-1,1])for(const sy of [-1,1])legs=smin(legs,Math.hypot(x-sx*cx,y-sy*cy)-r,4);
  legs=Math.max(legs,z-112);
  const st=ease((z-76)/36);
  const seat=Math.max(sdRoundRect2(x,y,mix(16,56,st),mix(10,51,st),8),74-z,z-118);
  let f=smin(legs,seat,3);
  const [offset,halfW,halfT,by]=profileAt(z,[
   [106,21,27,8.5,40],[123,22,24,8.5,41],
   [150,30,18,8.0,44],[177,31,18,7.7,47],
   [204,21,24,7.7,50],[216,19,23,7.7,50.5]
  ]);
  let back=1e4;
  for(const sx of [-1,1])back=smin(back,sdRoundRect2(x-sx*offset,y-by,halfW,halfT,5),2.5);
  back=Math.max(back,106-z,z-216);
  return smin(f,back,2)*s;
 },
 planAt(k,z,zf,ctx){
  const zz=z/(ctx.H/216),growth=ease((zz-2)/13),seat=zz>=76&&zz<118;
  const landing=ease((zz-113)/2)*(1-ease((zz-121)/3));
  const spacing=k<4?(k===0?.50:.85):mix(mix(.85,seat?2.25:2.45,growth),.88,landing);
  const amp=k<4?0:mix(mix(0,seat?.62:.56,growth),.34,landing);
  const tag=zz<2?'root-base':zz<16?'root-transition':zz<65?'paired-arches':zz<76?'arch-junction':seat?(zz>113?'saddle-landing':'saddle'):zz<135?'back-root':zz<190?'lyre-window':'crown';
  const sine=zz>139&&zz<183&&(k%3!==2);
  return {kind:sine?'sine':'lines',spacing,angle:sine?(k%2?45:135):45*(k%4),
   ...(sine?{sine:{amp:.50,lambda:7.2}}:{}),tag,
   weave:{m:.22,amp,gap:mix(.55,.68,growth),lobes:24,dphi:.10},plain:[.50,.85,1.20]};
 }
};
VARIANTS.lira=LIRA;
export function build(kmax){
 const r=generateField({variant:'lira',machine:'a2l',name:'LIRA_A2L',H:LIRA.H,kmax,report:true,dphi:.10});
 r.summary.args.bridgeSpeed=16;
 r.summary.args.speed=LIRA.speed;
 const stem=kmax?'probe':'LIRA_A2L';
 fs.writeFileSync(path.join(here,stem+'_summary.json'),JSON.stringify(r.summary,null,2));
 fs.writeFileSync(path.join(here,stem+'_plan.json'),JSON.stringify(r.plan));
 if(r.violations.length){console.error(JSON.stringify(r.violations,null,2));process.exitCode=1;return r;}
 fs.writeFileSync(path.join(here,stem+'_geometry.json'),JSON.stringify(r.payload));
 fs.writeFileSync(path.join(here,stem+'_program.svg'),r.svg());
 console.log(JSON.stringify({state:'GEOMETRY_READY',size:r.summary.size_mm,layers:r.summary.totalLayers,field:r.summary.field}));
 return r;
}
if(process.argv[1]&&fs.realpathSync(process.argv[1])===fs.realpathSync(fileURLToPath(import.meta.url)))build(process.argv.includes('--probe')?80:undefined);
