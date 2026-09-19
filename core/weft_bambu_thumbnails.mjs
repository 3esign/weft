// Bambu Studio 2.7.1.62 mixes horizontal/vertical strides when re-exporting a
// small thumbnail. Rectangular input can write outside its 128x128 buffer.
// G-668: packaging uses bounded square PNGs, independently of the report image.
import {inflateSync,deflateSync} from 'node:zlib';

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const TABLE=Uint32Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?(n>>>1)^0xedb88320:n>>>1;return n>>>0;});
function crc(b){let c=0xffffffff;for(const v of b)c=(c>>>8)^TABLE[(c^v)&255];return (c^0xffffffff)>>>0;}
function fail(message){throw new Error('WEFT Bambu thumbnail: '+message);}
function chunks(bytes){
  if(!Buffer.isBuffer(bytes)||!bytes.subarray(0,8).equals(SIGNATURE))fail('expected PNG');
  const out=[];let p=8,ended=false;
  while(p<bytes.length){
    if(p+12>bytes.length)fail('truncated chunk');
    const n=bytes.readUInt32BE(p),end=p+12+n;
    if(end>bytes.length)fail('truncated chunk data');
    const type=bytes.toString('ascii',p+4,p+8),data=bytes.subarray(p+8,p+8+n);
    if(crc(bytes.subarray(p+4,p+8+n))!==bytes.readUInt32BE(p+8+n))fail('bad '+type+' CRC');
    out.push({type,data});p=end;
    if(type==='IEND'){if(n!==0||p!==bytes.length)fail('invalid PNG end');ended=true;break;}
  }
  if(!ended||out[0]?.type!=='IHDR'||out[0].data.length!==13||out.filter(c=>c.type==='IHDR').length!==1)fail('invalid PNG structure');
  return out;
}
function header(cs){
  const h=cs[0].data,width=h.readUInt32BE(0),height=h.readUInt32BE(4),depth=h[8],colorType=h[9];
  if(!width||!height||width*height>16_777_216)fail('image dimensions outside bounded decoder');
  if(depth!==8||![2,6].includes(colorType)||h[10]!==0||h[11]!==0||h[12]!==0)fail('use non-interlaced 8-bit RGB/RGBA PNG');
  return {width,height,depth,colorType};
}
export function pngInfo(bytes){return header(chunks(bytes));}
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
export function decodePng(bytes){
  const cs=chunks(bytes),info=header(cs),{width,height,colorType}=info,bpp=colorType===6?4:3,stride=width*bpp;
  for(const c of cs)if(!['IHDR','IDAT','IEND','PLTE'].includes(c.type)&&c.type[0]===c.type[0].toUpperCase())fail('unsupported critical chunk '+c.type);
  const ids=cs.filter(c=>c.type==='IDAT');if(!ids.length)fail('missing image data');
  const raw=inflateSync(Buffer.concat(ids.map(c=>c.data)),{maxOutputLength:(stride+1)*height});
  if(raw.length!==(stride+1)*height)fail('unexpected decompressed image length');
  const rgba=Buffer.alloc(width*height*4);let prev=Buffer.alloc(stride);
  const tr=cs.find(c=>c.type==='tRNS')?.data;
  if(tr&&(colorType!==2||tr.length!==6))fail('unsupported transparency chunk');
  for(let y=0;y<height;y++){
    const filter=raw[y*(stride+1)];if(filter>4)fail('unknown PNG filter');
    const row=Buffer.allocUnsafe(stride);
    for(let x=0;x<stride;x++){
      const a=x>=bpp?row[x-bpp]:0,b=prev[x],c=x>=bpp?prev[x-bpp]:0;
      row[x]=(raw[y*(stride+1)+1+x]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter])&255;
    }
    for(let x=0;x<width;x++){
      const i=x*bpp,j=(y*width+x)*4;rgba[j]=row[i];rgba[j+1]=row[i+1];rgba[j+2]=row[i+2];
      rgba[j+3]=bpp===4?row[i+3]:(tr&&row[i]===tr.readUInt16BE(0)&&row[i+1]===tr.readUInt16BE(2)&&row[i+2]===tr.readUInt16BE(4)?0:255);
    }
    prev=row;
  }
  return {...info,rgba};
}
function chunk(type,data){const t=Buffer.from(type),b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);t.copy(b,4);data.copy(b,8);b.writeUInt32BE(crc(Buffer.concat([t,data])),b.length-4);return b;}
export function encodeRgbaPng(width,height,rgba){
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||rgba.length!==width*height*4)fail('invalid RGBA buffer');
  const h=Buffer.alloc(13);h.writeUInt32BE(width);h.writeUInt32BE(height,4);h[8]=8;h[9]=6;
  const raw=Buffer.alloc(height*(1+width*4));
  for(let y=0;y<height;y++)rgba.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
  return Buffer.concat([SIGNATURE,chunk('IHDR',h),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
function square(image,size){
  const {width,height,rgba}=image,scale=Math.min(size/width,size/height),w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.round(height*scale));
  const left=Math.floor((size-w)/2),top=Math.floor((size-h)/2),dst=Buffer.alloc(size*size*4);
  // Area sampling in premultiplied alpha; preserve the complete report framing.
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const x0=x*width/w,x1=(x+1)*width/w,y0=y*height/h,y1=(y+1)*height/h,sums=[0,0,0];let alpha=0;
    for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++){
      const weight=(Math.min(x1,sx+1)-Math.max(x0,sx))*(Math.min(y1,sy+1)-Math.max(y0,sy)),i=(sy*width+sx)*4,a=rgba[i+3]*weight;
      alpha+=a;for(let k=0;k<3;k++)sums[k]+=rgba[i+k]*a;
    }
    const i=((y+top)*size+x+left)*4;for(let k=0;k<3;k++)dst[i+k]=alpha?Math.round(sums[k]/alpha):0;
    dst[i+3]=Math.round(alpha/((x1-x0)*(y1-y0)));
  }
  return encodeRgbaPng(size,size,dst);
}
export const BAMBU_THUMBNAIL_NAMES=['Metadata/plate_1.png','Metadata/plate_1_small.png','Metadata/plate_no_light_1.png','Metadata/top_1.png','Metadata/pick_1.png'];
export function makeBambuThumbnails(bytes){
  const image=decodePng(bytes),large=square(image,512),small=square(image,128);
  // Preserve the historical single-filament display-proxy convention. These
  // auxiliary images are not object-picking/inspection maps; cancellation stays off.
  return Object.fromEntries(BAMBU_THUMBNAIL_NAMES.map(n=>[n,n.endsWith('_small.png')?small:large]));
}
export function auditBambuThumbnails(entries){
  const issues=[],images=[];
  for(const name of BAMBU_THUMBNAIL_NAMES){
    const matches=entries.filter(e=>e.name===name);
    if(matches.length!==1){issues.push(name+': require exactly one image');continue;}
    try{
      const image=decodePng(matches[0].data),{width,height,depth,colorType}=image;images.push({name,width,height,depth,colorType});
      // Existing printed templates include 1000x1000 RGB. Equal strides are
      // safe in the native writer; keep those bytes. New overrides are 512 RGBA.
      if(width!==height||width<128||width>2048)issues.push(name+': require square dimensions (128..2048)');
    }catch(e){issues.push(name+': '+e.message);}
  }
  const main=images.find(x=>x.name==='Metadata/plate_1.png'),noLight=images.find(x=>x.name==='Metadata/plate_no_light_1.png');
  if(main&&noLight&&(main.width!==noLight.width||main.height!==noLight.height))issues.push('plate/no-light dimensions must agree');
  return {PASS:!issues.length,images,issues};
}
