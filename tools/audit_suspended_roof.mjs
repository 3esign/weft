// Sample nominal coverage, independent of the pitch field. This does not predict deposited sag.
import fs from 'node:fs';
import path from 'node:path';
const input=path.resolve(process.argv[2]),G=JSON.parse(fs.readFileSync(input,'utf8')),S=G.summary;
const dense=G.layers.filter(l=>l.phase==='crown-grid').slice(-2),polygon=dense.at(-1).contours[0].pts;
const buckets=new Map(),radius=S.args.bead/2;
for(const L of dense)for(const raw of L.paths)for(let i=1;i<raw.pts.length;i++){
 const a=raw.pts[i-1],b=raw.pts[i],seg=[...a,...b];for(let x=Math.floor(Math.min(a[0],b[0])-radius);x<=Math.floor(Math.max(a[0],b[0])+radius);x++)for(let y=Math.floor(Math.min(a[1],b[1])-radius);y<=Math.floor(Math.max(a[1],b[1])+radius);y++){const key=x+','+y;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(seg);}
}
function inside(x,y){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
let samples=0,uncovered=0;const examples=[];const lo=[Math.min(...polygon.map(p=>p[0])),Math.min(...polygon.map(p=>p[1]))],hi=[Math.max(...polygon.map(p=>p[0])),Math.max(...polygon.map(p=>p[1]))];
for(let x=lo[0]+.071;x<hi[0];x+=.2)for(let y=lo[1]+.113;y<hi[1];y+=.2){if(!inside(x,y))continue;samples++;const hit=(buckets.get(Math.floor(x)+','+Math.floor(y))||[]).some(([ax,ay,bx,by])=>{const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy,t=l2?Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/l2)):0;return Math.hypot(x-ax-t*dx,y-ay-t*dy)<=radius+.0001;});if(!hit){uncovered++;if(examples.length<8)examples.push([+x.toFixed(3),+y.toFixed(3)]);}}
const result={PASS:uncovered===0,samples,uncovered,examples,sampleSpacing_mm:.2,scope:'Projection of the final two dense fill paths, sampled inside the crown centreline polygon at nominal bead width. The surrounding rim lies outside this interior domain. This is a digital coverage sample, not watertightness or physical closure evidence.'};
fs.writeFileSync(path.join(path.dirname(input),'ROOF_COVERAGE.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({name:S.name,...result}));if(uncovered)process.exitCode=1;
