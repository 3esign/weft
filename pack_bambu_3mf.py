#!/usr/bin/env python3
"""Wrap a WEFT Route-B G-code into a Bambu Studio .gcode.3mf so Studio / Handy / the printer can load it.

A real Bambu export of the same machine+profile is used as the container template; everything structural
(project_settings.config, model_settings.config, rels, content types) is copied verbatim, and only the parts
that describe THIS print are replaced: the G-code itself, its MD5, the HEADER_BLOCK numbers, the plate bbox,
the slice_info estimates and the thumbnails.

It also does two things the WEFT emitter does not:
  * appends `; EXECUTABLE_BLOCK_END` (the printer's block parser wants the pair closed), and
  * injects `M73 P<percent> R<minutes>` at every layer, so the machine shows real progress and remaining time
    instead of sitting at 0 % for hours.

usage: python pack_bambu_3mf.py --gcode X.gcode --template REAL.gcode.3mf --out Y.gcode.3mf
                                --name Y.stl [--thumb top.png] [--layer-height 0.24]
"""
import argparse, hashlib, io, math, re, shutil, zipfile, os

ap = argparse.ArgumentParser()
ap.add_argument('--gcode', required=True)
ap.add_argument('--template', required=True)
ap.add_argument('--out', required=True)
ap.add_argument('--name', default='weft.stl')
ap.add_argument('--thumb', default=None)          # PNG used for all thumbnail slots
ap.add_argument('--layer-height', type=float, default=0.24)
ap.add_argument('--density', type=float, default=1.26)
ap.add_argument('--accel-fudge', type=float, default=1.10)
a = ap.parse_args()

FIL_AREA = math.pi * (1.75/2)**2      # mm^2

# ---------------- read + analyse the gcode ----------------
src = open(a.gcode, 'r', encoding='utf-8', errors='replace').read().split('\n')

x=y=z=0.0; f=1800.0
minx=miny=1e9; maxx=maxy=-1e9; maxz=0.0
e_total=0.0; t_total=0.0; first_layer_t=0.0
zs=set(); layer_idx=[]                      # (line index, z) of every "; layer N" marker
seen_first_move=False
num=re.compile(r'([XYZEF])(-?\d*\.?\d+)')
for i,l in enumerate(src):
    if l.startswith('; layer '):
        layer_idx.append(i); continue
    if not (l.startswith('G0') or l.startswith('G1')): continue
    d = dict(num.findall(l))
    nx = float(d['X']) if 'X' in d else x
    ny = float(d['Y']) if 'Y' in d else y
    nz = float(d['Z']) if 'Z' in d else z
    if 'F' in d: f = float(d['F'])
    de = float(d['E']) if 'E' in d else 0.0
    dist = math.hypot(nx-x, ny-y)
    if dist < 1e-9: dist = abs(nz-z)
    if dist < 1e-9 and de: dist = abs(de)*2.0            # pure retract/prime: rough
    dt = dist/(max(f,1.0)/60.0)
    t_total += dt
    if de > 0:
        e_total += de
        if nx < minx: minx = nx
        if nx > maxx: maxx = nx
        if ny < miny: miny = ny
        if ny > maxy: maxy = ny
        if nz <= a.layer_height*1.01 + 1e-6: first_layer_t += dt
        zs.add(round(nz,3)); maxz = max(maxz, nz)
    x,y,z = nx,ny,nz

t_total *= a.accel_fudge
n_layers = len(zs) if zs else 1
vol_cm3 = e_total*FIL_AREA/1000.0
weight_g = vol_cm3*a.density
def hms(t):
    t=int(round(t)); h=t//3600; m=(t%3600)//60; s=t%60
    return (f"{h}h {m}m {s}s" if h else f"{m}m {s}s")

# ---------------- patch the header + close the block + inject M73 ----------------
def set_hdr(lines, key, value):
    pat = re.compile(r'^; '+re.escape(key)+r'\s*:')
    for i,l in enumerate(lines):
        if pat.match(l): lines[i] = f"; {key}: {value}"; return
set_hdr(src,'model printing time', f"{hms(t_total)}; total estimated time: {hms(t_total*1.01)}")
set_hdr(src,'total layer number', n_layers)
set_hdr(src,'total filament length [mm] ', f"{e_total:.2f}")
set_hdr(src,'total filament volume [cm^3] ', f"{vol_cm3:.2f}")
set_hdr(src,'total filament weight [g] ', f"{weight_g:.2f}")
set_hdr(src,'max_z_height', f"{maxz:.2f}")

# M73 per layer: progress by extruded filament so far (closest thing to real progress)
per_layer_e = []
acc=0.0; li=0
for i,l in enumerate(src):
    if l.startswith('; layer '): per_layer_e.append((i,acc)); continue
    if (l.startswith('G1')) and ' E' in l:
        m=re.search(r'E(-?\d*\.?\d+)', l)
        if m:
            v=float(m.group(1))
            if v>0: acc+=v
out=[]; k=0
for i,l in enumerate(src):
    if k < len(per_layer_e) and per_layer_e[k][0]==i:
        frac = per_layer_e[k][1]/e_total if e_total else 0.0
        out.append(f"M73 P{int(frac*100)} R{int(round(t_total*(1-frac)/60))}")
        k+=1
    out.append(l)
gtxt = '\n'.join(out).rstrip('\n')
if 'EXECUTABLE_BLOCK_END' not in gtxt:
    gtxt += '\n; EXECUTABLE_BLOCK_END\n'
gbytes = gtxt.encode('utf-8')
md5 = hashlib.md5(gbytes).hexdigest().upper()

# ---------------- rebuild the container ----------------
tpl = zipfile.ZipFile(a.template)
thumb = open(a.thumb,'rb').read() if a.thumb else None
bbox = [round(minx,5), round(miny,5), round(maxx,5), round(maxy,5)]
area = round((maxx-minx)*(maxy-miny), 4)

plate_json = ('{"bbox_all":[%s],"bbox_objects":[{"area":%s,"bbox":[%s],"id":1,"layer_height":%s,"name":"%s"}],'
  '"bed_type":"textured_plate","filament_colors":["#FFFFFF"],"filament_ids":[0],"first_extruder":0,'
  '"first_layer_time":%s,"is_seq_print":false,"nozzle_diameter":0.4000000059604645,"version":2}') % (
  ','.join(str(v) for v in bbox), area, ','.join(str(v) for v in bbox), a.layer_height, a.name, round(first_layer_t,4))

si = tpl.read('Metadata/slice_info.config').decode('utf-8')
si = re.sub(r'(key="prediction" value=")\d+(")', lambda m: m.group(1)+str(int(round(t_total)))+m.group(2), si)
si = re.sub(r'(key="weight" value=")[\d.]+(")', lambda m: m.group(1)+f"{weight_g:.2f}"+m.group(2), si)
si = re.sub(r'(key="first_layer_time" value=")[\d.]+(")', lambda m: m.group(1)+f"{first_layer_t:.6f}"+m.group(2), si)
si = re.sub(r'(<object identify_id="\d+" name=")[^"]*(")', lambda m: m.group(1)+a.name+m.group(2), si)
si = re.sub(r'(used_m=")[\d.]+(")', lambda m: m.group(1)+f"{e_total/1000:.2f}"+m.group(2), si)
si = re.sub(r'(used_g=")[\d.]+(")', lambda m: m.group(1)+f"{weight_g:.2f}"+m.group(2), si)
si = re.sub(r'(layer_ranges=")[^"]*(")', lambda m: m.group(1)+f"0 {n_layers-1}"+m.group(2), si)

REPL = {'Metadata/plate_1.gcode': gbytes,
        'Metadata/plate_1.gcode.md5': md5.encode(),
        'Metadata/plate_1.json': plate_json.encode(),
        'Metadata/slice_info.config': si.encode()}
if thumb:
    for n in ['Metadata/plate_1.png','Metadata/plate_1_small.png','Metadata/plate_no_light_1.png',
              'Metadata/top_1.png','Metadata/pick_1.png']:
        REPL[n]=thumb

with zipfile.ZipFile(a.out,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as zo:
    for info in tpl.infolist():
        data = REPL.get(info.filename, tpl.read(info.filename))
        zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
        zi.compress_type = zipfile.ZIP_STORED if info.filename.endswith('.png') else zipfile.ZIP_DEFLATED
        zo.writestr(zi, data)

print(f"{a.out}\n  layers {n_layers}  maxZ {maxz:.2f} mm  filament {e_total/1000:.2f} m / {weight_g:.1f} g"
      f"\n  bbox {bbox}  first layer {first_layer_t/60:.1f} min  estimate {hms(t_total)}\n  md5 {md5}"
      f"\n  size {os.path.getsize(a.out)/1e6:.1f} MB")
