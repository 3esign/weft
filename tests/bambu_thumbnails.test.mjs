import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {deflateSync} from 'node:zlib';
import {makeBambuThumbnails,decodePng,encodeRgbaPng,auditBambuThumbnails} from '../core/weft_bambu_thumbnails.mjs';
import {packBambu3mf,zipRead,zipWrite} from '../core/weft_build.mjs';

// Safe reproduction of the *installed upstream* C++ destination arithmetic,
// bbs_3mf.cpp v02.07.01.62:6732–6760. No actual out-of-bounds native write.
export function nativeSmallThumbnailBounds(width,height){
  const sw=Math.trunc(width/128),sh=Math.trunc(height/128);let outside=0,maxPixel=-1;
  if(!sw||!sh)return {outside:null,zeroStride:true};
  for(let i=0;i<sh*128;i+=sh)for(let j=0;j<sw*128;j+=sw){
    const pixel=Math.trunc(i/sw)*128+Math.trunc(j/sh);
    maxPixel=Math.max(maxPixel,pixel);if(pixel>=128*128)outside++;
  }
  return {outside,maxPixel,allocatedPixels:128*128};
}
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'weft-bambu-thumbnail-'));
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
try{
  check('reported 1400x1600 reproduces native out-of-bounds destination',()=>assert(nativeSmallThumbnailBounds(1400,1600).outside>0));
  const rgb=Buffer.alloc(14*16*4);for(let i=0;i<rgb.length;i+=4){rgb[i]=80;rgb[i+1]=140;rgb[i+2]=210;rgb[i+3]=255;}
  const image=encodeRgbaPng(14,16,rgb),thumbs=makeBambuThumbnails(image),entries=Object.entries(thumbs).map(([name,data])=>({name,data}));
  check('correct square RGBA slots and native bounds',()=>{
    const audit=auditBambuThumbnails(entries);assert.equal(audit.PASS,true,JSON.stringify(audit));
    for(const im of audit.images){assert.equal(im.width,im.name.endsWith('_small.png')?128:512);assert.equal(nativeSmallThumbnailBounds(im.width,im.height).outside,0);}
  });
  check('portrait framing remains complete with transparent side margins',()=>{
    const x=decodePng(thumbs['Metadata/plate_1.png']);assert.equal(x.rgba[3],0);
    assert.deepEqual([...x.rgba.subarray((256*512+256)*4,(256*512+256)*4+4)],[80,140,210,255]);
  });
  check('real RGB screenshot decoder and normalizer',()=>{
    const p=path.join(root,'specimens/2026-09-19_RAZMAK_A2L_H4_experimental/RAZMAK_A2L_H4_preview.png');
    const b=fs.readFileSync(p);const im=decodePng(b);assert.deepEqual([im.width,im.height,im.colorType],[1400,1600,2]);
    const fixed=makeBambuThumbnails(b);assert(auditBambuThumbnails(Object.entries(fixed).map(([name,data])=>({name,data}))).PASS);
  });
  check('corrupt PNG is refused',()=>{const b=Buffer.from(image);b[40]^=1;assert.throws(()=>makeBambuThumbnails(b),/CRC/);});
  check('missing slot and rectangular inherited image are refused',()=>{
    assert(!auditBambuThumbnails(entries.slice(1)).PASS);
    assert(!auditBambuThumbnails(entries.map(e=>({...e,data:image}))).PASS);
  });
  // Independent PNG fixture encoder exercises all decoder row filters, RGB and tRNS.
  const crc=b=>{let c=0xffffffff;for(const v of b){c^=v;for(let k=0;k<8;k++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}return(c^0xffffffff)>>>0;};
  const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);b.writeUInt32BE(crc(b.subarray(4,-4)),b.length-4);return b;};
  for(let filter=0;filter<=4;filter++)check('decode RGB row filter '+filter,()=>{
    const w=3,h=2,stride=w*3,pixels=Buffer.from([10,20,30,70,80,90,130,140,150,19,39,59,79,99,119,139,159,179]),raw=Buffer.alloc((stride+1)*h);
    for(let y=0;y<h;y++){raw[y*(stride+1)]=filter;for(let x=0;x<stride;x++){
      const a=x>=3?pixels[y*stride+x-3]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=3?pixels[(y-1)*stride+x-3]:0,p=a+b-c;
      const ds=[Math.abs(p-a),Math.abs(p-b),Math.abs(p-c)],pred=[0,a,b,Math.floor((a+b)/2),[a,b,c][ds.indexOf(Math.min(...ds))]][filter];
      raw[y*(stride+1)+1+x]=(pixels[y*stride+x]-pred+256)%256;
    }}
    const ih=Buffer.alloc(13);ih.writeUInt32BE(w);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=2;
    const png=Buffer.concat([image.subarray(0,8),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
    const decoded=decodePng(png);for(let i=0;i<w*h;i++)assert.deepEqual([...decoded.rgba.subarray(i*4,i*4+4)],[...pixels.subarray(i*3,i*3+3),255]);
  });
  const template=path.join(root,'specimens/2026-09-02_P0_suma_4x4_v2_physical/P0_suma_4x4_v2.gcode.3mf'),out=path.join(tmp,'output.3mf'),thumb=path.join(tmp,'report.png');fs.writeFileSync(thumb,image);
  check('shared packer normalizes before writing',()=>{
    packBambu3mf('G90\nM83\nG1 X15 Y15 Z0.24 F600\nG1 X25 Y15 E1\n',template,out,{thumb});
    assert(auditBambuThumbnails(zipRead(fs.readFileSync(out))).PASS);
  });
  check('inherited bad template refuses without replacing an existing output',()=>{
    const bad=path.join(tmp,'bad-template.3mf');fs.writeFileSync(bad,zipWrite(zipRead(fs.readFileSync(out)).map(e=>e.name==='Metadata/plate_1.png'?{...e,data:image}:e)));
    fs.writeFileSync(out,'sentinel');assert.throws(()=>packBambu3mf('G1 X20 Y20 E1\n',bad,out),/package refused/);assert.equal(fs.readFileSync(out,'utf8'),'sentinel');
  });
  console.log(JSON.stringify({PASS:true,checks:passed,reported:nativeSmallThumbnailBounds(1400,1600),fixed:nativeSmallThumbnailBounds(512,512)}));
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
