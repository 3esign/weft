// 2026-09-19 intentionally adds only these preview comments to historical bytes.
// The historical specimen is immutable. Do not normalize motion or other metadata.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function legacyPreviewBytes(text){
 let scoped=false;
 return text.split('\n').filter(line=>{
  if(line==='; WEFT_STARTUP_PREVIEW_BEGIN'){scoped=true;return false;}
  if(line==='; WEFT_STARTUP_PREVIEW_END'){scoped=false;return false;}
  if(scoped&&(line==='; WIPE_START'||line==='; WIPE_END'))return false;
  if(/^; WEFT_FIRST_LAYER_V1 Z=[\d.]+ H=[\d.]+$/.test(line))return false;
  return true;
 }).join('\n');
}
export function assertLegacyHeaderHasNoWipes(ref){
 assert.doesNotMatch(ref.slice(0,ref.indexOf('; WEFT first layer:')),/^; WIPE_(START|END)$/m,'this historical fixture must not contain native wipe comments: extend comparison explicitly if it does');
}
export function matchingMember(old,newEntry,currentEntries){
 if(!newEntry)return false;
 if(old.name==='Metadata/plate_1.gcode')return legacyPreviewBytes(newEntry.data.toString())===old.data.toString();
 if(old.name==='Metadata/plate_1.gcode.md5')return newEntry.data.toString().trim().toLowerCase()===createHash('md5').update(currentEntries.find(e=>e.name==='Metadata/plate_1.gcode').data).digest('hex');
 return old.data.equals(newEntry.data);
}
