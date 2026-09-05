import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import path from 'path'; import fs from 'fs';

const OUT = path.resolve('specimens/2026-08_D5_large_dome_pending');
fs.mkdirSync(OUT,{recursive:true});
const APP = path.resolve('index.html');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args:['--disable-background-timer-throttling','--disable-renderer-backgrounding']
});
const page = await browser.newPage({viewport:{width:1400,height:900}});
await page.goto(pathToFileURL(APP).href,{waitUntil:'domcontentloaded'});
await page.waitForFunction(()=>!document.getElementById('loading'),null,{timeout:20000});

const p = {
    "machine": "a1", "mode": "dome", "domeR": 75, "sweep": 360, "hFrac": 1, "capClose": true,
    "webType": "staple", "w": 5, "lambda": 18, "bead": 0.45, "lh": 0.24, "overshoot": 1,
    "dwell": 0.6, "jitter": 0, "flowBoost": 1.25, "speed": 30, "bridgeSpeed": 18, "temp": 215,
    "bed": 55, "fan": 100, "altPhase": true, "autoLOD": true, "minGap": 1.4, "amp": 0, "ampF": 1,
    "checkOv": true, "gradeLean": false, "cycle": ["chord","web"], "maxBridge": 12, "noz": 0.4,
    "firstLayerBead": 0.52, "firstLayerSpeed": 12, "adhesion": "foundation", "adhesionWidth": 8
};

const stats = await page.evaluate(async (cfg)=>{
    setMachine('a1');
    Object.assign(P, cfg);
    buildLayers();
    for(const L of layers){ const g=ribbon(L.pts,(L.bead||P.bead)/2,L.zBot,L.zTop); if(g) L.geo=g; }
    return true;
}, p);

const total = await page.evaluate(async ()=>{
    const parts=await buildSTLParts(); 
    window.__out=new Uint8Array(await new Blob(parts).arrayBuffer()); 
    return window.__out.length;
});
const out = path.join(OUT, 'D5_large_closed_dome_R75_lambda18_foundation.stl');
const fd = fs.openSync(out,'w'); const CH=1<<20;
for(let off=0; off<total; off+=CH){
    const b64 = await page.evaluate(([o,n])=>{
        const u=window.__out.subarray(o,o+n); let s='';
        for(let i=0;i<u.length;i+=8192) s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));
        return btoa(s);
    },[off,Math.min(CH,total-off)]);
    fs.writeSync(fd, Buffer.from(b64,'base64'));
}
fs.closeSync(fd);
await browser.close();
console.log('Saved', out);
