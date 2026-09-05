#!/usr/bin/env python3
"""P2 · "Penjač" — the act of climbing, in WEFT's own language. For the Creality Ender-3 V4.

Not a portrait: a body reading upward as a load path. Feet on the plate become legs, the legs merge
into a core that TRAVERSES side to side as it rises (a climber shifts weight, never goes straight up),
and out of that core arms reach in turn — alternating around the figure — each one leaving the body
almost horizontally, extending, and closing in a gripping knob. The top narrows and closes the same way.

--legs 3 (the default) starts from a tripod: two front feet merge first, the bracing leg joins higher,
so the figure has TWO staged merge events instead of one, and the triangle between the three legs is a
real hole that dies as they converge. A tripod also cannot rock on the plate.

Everything the piece is made of is a rule the compiler already owes us:
  * merges (legs → hips) and splits (core → arm) as contour-tree events;
  * lateral motion tested against the support cone every layer — the traverse and the reaches are the test;
  * death closure: any contour with no successor on the next layer is closed with a filled spiral
    membrane on its last layer — the rule the D5 dome crown was missing;
  * hole closure (from the P0 2×2 tangle) for the openings between limbs;
  * a first layer that is ONE connected piece: each foot's annular brim, joined by thin ribs, with the
    holes between them left open. Šuma printed with every column on its own island; this does not.
  * wall width w(z) breathing on its own period and clamped by the layer's OWN thinnest place (measured
    on the mask, not guessed from nominal radii), and grammar/tab rhythm banded by what the body is doing.

WEFT-01 (2026-09-02): nothing here reports and continues. Every check that can fail exits non-zero.

usage: python climber_geometry.py --legs 3 --H 168 --out /tmp/climber3.json
"""
import json, math, sys, argparse
import numpy as np
from scipy import ndimage
from skimage import measure
from scipy.spatial import cKDTree

ap = argparse.ArgumentParser()
ap.add_argument('--legs', type=int, default=3, choices=(2,3))
ap.add_argument('--H', type=float, default=168.0)
ap.add_argument('--lh', type=float, default=0.20)
ap.add_argument('--e', type=float, default=1.0)
ap.add_argument('--bead', type=float, default=0.42)
ap.add_argument('--w0', type=float, default=3.2)      # wall width, thin (stretch)
ap.add_argument('--w1', type=float, default=9.0)      # wall width, thick (bearing load)
ap.add_argument('--K', type=int, default=10)          # welds per strand turn — few = long runs
ap.add_argument('--res', type=float, default=0.28)
ap.add_argument('--foundation', type=float, default=7.0)
ap.add_argument('--rib', type=float, default=2.6)     # width of the ribs that join the brims
ap.add_argument('--maxbridge', type=float, default=12.0)
ap.add_argument('--plate', type=float, nargs=2, default=[220.0,220.0])
ap.add_argument('--out', default='/tmp/climber.json')
ap.add_argument('--allow-fail', action='store_true', help='write the file even if a check fails (diagnosis only)')
args = ap.parse_args()

H, LH = args.H, args.lh
N = int(round(H/LH))
W_MAX, W_MIN = max(args.w0,args.w1), min(args.w0,args.w1)
def sm(t): t=max(0.0,min(1.0,t)); return t*t*(3-2*t)
# The physical floor of the wall: two chord rails plus a bead of daylight between them, and a tab
# long enough to hook. Below this there is no lattice, only a line. The solver never chooses the
# floor for effect — it descends towards it only where the body is too thin to carry more, and if
# even the floor will not fit, the layer is refused rather than fudged.
W_FLOOR = 0.9       # the emission floor: two rails still a bead apart, the thinnest real wall
W_DESIGN = 1.8      # the wall the BODY is shaped for — rho comes from this, so the shape of the
                    # figure does not change every time the emission floor is touched
TAB_FLOOR = 0.4
# How far the wall may change from one layer to the next. A chord rail sits w/2 off the centreline,
# so a step of D in w moves the rail D/2 sideways — and a rail that moves further than the bead is
# a rail resting on air. The gate found this the hard way: where the solver dropped the wall from
# 9.5 mm to a single thread in one layer, 119 mm of chord above it was floating.
W_RATE = 0.24       # the rail moves dw/2 + dtab sideways; that shares one bead's budget with the
TAB_RATE = 0.08     # motion of the body itself, so it gets the smaller half
def lerp(a,b,t): return (a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t)

# ---------------- the wall, and everything derived from it ----------------
def wall_nominal(z):
    """the breathing wall, before the layer's own geometry gets a say. Two periods that do not
       divide each other, so the rhythm never reads as a repeat."""
    t=z/H
    a=(args.w0+args.w1)/2 + (args.w1-args.w0)/2*math.sin(2*math.pi*2.0*t - math.pi/2)
    return a + (args.w1-args.w0)*0.13*math.sin(2*math.pi*5.0*t + 1.1)

# RHO: the imagined circle at every corner — the smallest turn the thread can make without the wall
# overlapping itself. It has to be chosen BEFORE the wall, because the mask must exist before the
# wall can be measured on it, and that is a trap: sizing it from the widest wall the band might ask
# for makes the body itself obey the widest wall. Measured consequence — every arm disc thinner than
# rho was clamped up to rho and then dropped by the filter that excludes discs at rho, so a 46 mm
# limb became one blob at 42 % of its reach, and it ended in open air.
#
# So rho is sized from the MINIMUM wall instead. The body then keeps the shape it was designed with,
# and the wall negotiates down, per layer, wherever the body is too thin to carry more. Shape first,
# thickness second — the other way round is how a figure quietly loses its hands.
# What the thread must keep between itself and itself on one layer. The app measures this on the
# FILLETED, resampled path it actually emits; this file measures it on the ideal offsets. The two
# differ by a couple of tenths at a sharp neck, so the design target carries that as slack — a
# pre-check that lands exactly on the post-check's threshold will lose, every time.
RAIL_MIN = args.bead*0.95 + 0.45
RHO_MORPH = W_DESIGN/2 + TAB_FLOOR + args.bead + 0.3
def RHO_at(z):  return RHO_MORPH
def CAP_at(z):  return W_FLOOR/2 + TAB_FLOOR + RHO_MORPH + 1.5
RHO_MAX = RHO_MORPH

# ---------------- the body ----------------
if args.legs == 3:
    # a leaning tripod: two front feet, one bracing leg further out and behind
    FEET  = [(30.0*math.cos(math.radians(a)), 30.0*math.sin(math.radians(a))) for a in (205.0, 335.0)]
    FEET += [(35.0*math.cos(math.radians(80.0)), 35.0*math.sin(math.radians(80.0)))]
    Z_M1 = 0.24*H          # the two front legs merge
    Z_M2 = 0.42*H          # the bracing leg joins
else:
    FEET = [(-27.0,-9.45), (27.0,9.45)]
    Z_M1 = Z_M2 = 0.36*H
Z_HEAD = 0.93*H
PAIR   = ((FEET[0][0]+FEET[1][0])/2.0, (FEET[0][1]+FEET[1][1])/2.0)

def core_xy(z):
    """The traverse — the core's centre moves; this is the climb, and it is the support test.
    How fast it may move is not a matter of composition. A chord rail that steps sideways further
    than the tab of the layer below reaches has nothing under it at all, and the whole of that arc
    becomes one long bridge. Amplitude and frequency here are chosen so that the fastest point of
    the sway stays inside that budget."""
    t=z/H
    return (18.0*math.sin(2*math.pi*0.80*t) * sm(z/(0.28*H)),
             6.0*math.sin(2*math.pi*1.60*t) * sm(z/(0.28*H)))

def core_r(z):
    t=z/H
    base = 11.0 - 3.2*sm((z-Z_M2)/(H-Z_M2))                  # tapers from hips to head
    r = base + 1.7*math.sin(2*math.pi*3.0*t)                 # breathing
    # nothing thinner than the wall's own turn radius survives the opening — clamp, or the body
    # silently disappears and its cap is left floating (measured on the first climber run)
    return max(RHO_MAX+0.7, r)

# reaches, alternating around the figure; (z_start, height, plan angle deg, reach mm, r_start, r_end)
if args.legs == 3:
    # reach / band height is what sets how fast the limb grows sideways: reach/(0.40*dz) mm per mm
    # of height. Kept under ~1.3 so a rail never outruns the tab under it.
    ARMS=[(0.40*H, 0.185*H,   25.0, 26.0, 7.6, 4.8),
          (0.58*H, 0.185*H,  170.0, 22.0, 7.2, 4.6),
          (0.76*H, 0.185*H,  295.0, 28.0, 7.8, 5.0)]
else:
    ARMS=[(0.40*H, 0.115*H,   28.0, 38.0, 7.5, 4.6),
          (0.55*H, 0.115*H,  168.0, 34.0, 7.0, 4.4),
          (0.68*H, 0.115*H,  300.0, 40.0, 7.5, 4.6),
          (0.79*H, 0.100*H,   95.0, 30.0, 6.5, 4.4)]

def leg_r(z, i):
    return 8.6 + 1.3*math.sin(2*math.pi*3.0*z/H + i*2.1)

def parts_at(z):
    """[(x, y, r)] — the solid discs whose union is the body at this height.
       Only discs that can actually survive the opening are returned: a disc thinner than the
       layer's own turn radius is not geometry, it is a phantom that skews every statistic
       derived from `parts_at` (audit F4/F13)."""
    cx,cy = core_xy(z); out=[]
    rmin = RHO_at(z)+0.4
    if args.legs == 3:
        if z < Z_M1:                                   # three separate legs
            for i,f in enumerate(FEET[:2]):
                out.append((*lerp(f, PAIR, sm(z/Z_M1)), leg_r(z,i)))
            out.append((*lerp(FEET[2], core_xy(Z_M2), sm(z/Z_M2)), leg_r(z,2)))
        elif z < Z_M2:                                 # the front pair is one limb; the bracer still apart
            f = sm((z-Z_M1)/(Z_M2-Z_M1))
            rp = 0.5*(leg_r(z,0)+leg_r(z,1)) + 2.2*f
            out.append((*lerp(PAIR, (cx,cy), f), rp))
            out.append((*lerp(FEET[2], core_xy(Z_M2), sm(z/Z_M2)), leg_r(z,2)))
    else:
        if z < Z_M1:
            for i,f in enumerate(FEET):
                out.append((*lerp(f, (cx,cy), sm(z/Z_M1)), leg_r(z,i)))
    if z >= Z_M2*0.86:                                 # the core
        rr = core_r(z)
        if z > Z_HEAD:
            # The head closes deliberately, and it closes ALL THE WAY to the top layer: a taper that
            # drops below the smallest disc the opening keeps simply deletes the body mid-air, and
            # what is left behind reads to the contour tree as a component appearing out of nothing.
            # It ends one layer above the floor and the death closure puts the membrane on it.
            #
            # It also has to START where the core actually is, not at a constant. A band boundary
            # that hands over to a different formula is a step, and a 3 mm step in the radius is
            # 16 mm of chord over air — the third time today that a seam between two rules, rather
            # than either rule itself, was the fault.
            r0 = core_r(Z_HEAD)
            rr = r0 + ((rmin+0.12)-r0)*sm((z-Z_HEAD)/(H-Z_HEAD))
        # ...and it GROWS out of the merging legs rather than appearing. An 11 mm disc switched on
        # in one layer is 40 mm of contour with nothing underneath it — the same mistake as the arm
        # shoulder, at the other end of the body.
        if z < Z_M2:
            rr = rmin + (rr-rmin)*sm((z-Z_M2*0.86)/(Z_M2*0.14))
        if rr > rmin: out.append((cx,cy,rr))
    for (z0,dz,ang,reach,ra,rb) in ARMS:               # the reaches
        if z0 <= z < z0+dz:
            # out, hold, and back in. A reach that simply STOPS leaves a 40 mm limb ending in open
            # air on one layer — nothing above it, and no component death to notice, because the arm
            # is part of the body. The support check only ever asked "is there something under me";
            # it never asked "is there something over me". Withdrawing the arm into the body is both
            # the honest geometry and the truer gesture: a climber reaches, holds, and pulls in.
            # Reach out over the first 45 % of the band, hold through the grip, then pull in over
            # the last third. The pull has to be as slow as the reach: a 46 mm limb withdrawn in a
            # few layers moves the contour 15 mm sideways in 0.2 mm of height, which is not a step,
            # it is a jump — the support check caught exactly that at 14.6 mm.
            u  = (z-z0)/dz
            f  = sm(min(1.0,u/0.40)) * (1.0 - sm(max(0.0,(u-0.55)/0.45)))
            L  = reach*f; a = math.radians(ang)
            # An arm is a LIMB, not a ball on a stick. Sampling it along its length keeps the union
            # continuous and stops it pinching where the tip pulls away from the body: a pinch is a
            # neck too thin for even the minimum wall, and the layer then has to be refused.
            # A limb is a chain of discs, and the spacing is not a matter of taste: consecutive
            # discs have to overlap by more than the wall is wide, or the union pinches between two
            # samples and the layer is refused for a neck that exists only because the limb was
            # sampled too coarsely. The step therefore follows the thinnest radius in the chain.
            # The root also carries a shoulder — a limb leaving a body is thicker where it leaves.
            # The THICKNESS has to fade with the reach as well, not just the length. It did not,
            # and the consequence was invisible until the gate: a retracted arm still contributed a
            # 9.9 mm shoulder blob sitting on the core, so the body carried a lump that appeared and
            # vanished in one layer — a 5.8 mm collapse of the contour, and a whole web layer above
            # it in the air. An arm that is not reaching is not there.
            fade = sm(min(1.0, f/0.22))
            rtip = max(rb, rmin)
            nseg = max(4, int(math.ceil(L / max(2.0, 0.5*rtip))))
            for k_ in range(1, nseg+1):
                t = k_/nseg
                r = (ra + (rb-ra)*f*t) * (1.0 + 0.45*(1.0-t)**1.4) * fade
                out.append((cx+L*t*math.cos(a), cy+L*t*math.sin(a), max(r, rmin)))
    return [p for p in out if p[2] >= rmin - 1e-9]     # clamped TO rmin still counts: > rmin deleted it

def phase_at(z):
    """what the body is doing here -> grammar + tab length + a name (the rhythm bands)"""
    for i,(z0,dz,ang,reach,ra,rb) in enumerate(ARMS):
        if z0 <= z < z0+dz:
            u=(z-z0)/dz
            if u < 0.40:  return ('diagonal',1.4,f'reach{i+1}')   # going out
            if u < 0.55:  return ('perp',0.8,  f'grip{i+1}')      # holding
            return ('eight',1.2, f'pull{i+1}')                    # knit stitch while pulling in
    if z > Z_HEAD:   return ('sine',1.2,'head')
    if z < Z_M1:     return ('staple',1.0,'legs')
    if z < Z_M2:     return ('eight',1.2,'hips')       # loop stitch where the legs come together
    band = int((z-Z_M2)/(0.08*H)) % 3
    return [('staple',1.0,'core-run'),('sine',1.2,'core-wave'),('eight',1.2,'core-knit')][band]

# ---------------- raster ----------------
lim = 0.0
for k in range(N+1):
    for (x,y,r) in parts_at(k*LH): lim=max(lim, math.hypot(x,y)+r)
lim += W_MAX/2 + args.foundation + args.rib + 6
res=args.res
gx=np.arange(-lim,lim,res); gy=np.arange(-lim,lim,res)
X,Y=np.meshgrid(gx,gy)
print(f'raster {len(gx)}x{len(gy)} px, half-extent {lim:.1f} mm, {N} layers, legs={args.legs}', file=sys.stderr)
PX_MM2 = res*res
MIN_AREA = 2.0            # the same floor contours_of uses: below it there is no contour, so no wall

def mask_at(z):
    f=np.full(X.shape,1e9)
    for (cx,cy,r) in parts_at(z): f=np.minimum(f, np.hypot(X-cx,Y-cy)-r)
    inside=f<=0; rp=RHO_at(z)/res
    dil=ndimage.distance_transform_edt(~inside)<=rp
    m=ndimage.distance_transform_edt(dil)>rp                 # closing: necks filleted at RHO(z)
    er=ndimage.distance_transform_edt(m)>rp
    m=ndimage.distance_transform_edt(~er)<=rp                # opening: convex cusps at RHO(z) too
    return m

def spiral(cx,cy,rr,pitch):
    """A filled Archimedean spiral. It is self-supporting because each turn lands beside the one
       just laid, so the span the material has to cross is the PITCH, not the diameter — provided
       the pitch really is under a bead, which is what the caller has to check."""
    turns=max(0.75, rr/pitch); m=max(48,int(math.ceil(turns*64))); pts=[]
    for i in range(m+1):
        t=i/m; a=-math.pi+t*turns*2*math.pi; rad=rr-rr*t
        pts.append([round(cx+rad*math.cos(a),3), round(cy+rad*math.sin(a),3)])
    return pts

def contours_of(sdf, mask):
    out=[]
    for c in measure.find_contours(sdf,0.0):
        pts=np.stack([gx[0]+c[:,1]*res, gy[0]+c[:,0]*res],axis=1)
        if np.hypot(*(pts[0]-pts[-1]))>res*2: continue
        x,y=pts[:,0],pts[:,1]; area=0.5*np.sum(x*np.roll(y,-1)-np.roll(x,-1)*y)
        if abs(area)<MIN_AREA: continue
        if area<0: pts=pts[::-1]
        # orientation from several probes, not one: a single noisy normal inverts every tab on the
        # ring into solid material (audit F17)
        votes=0
        for frac in (0.17,0.33,0.5,0.67,0.83):
            i=int(len(pts)*frac)%len(pts)
            t=pts[(i+1)%len(pts)]-pts[i-1]; nr=np.array([t[1],-t[0]]); nr/=np.hypot(*nr)+1e-12
            q=pts[i]+nr*1.0; col=int(round((q[0]-gx[0])/res)); row=int(round((q[1]-gy[0])/res))
            if 0<=row<mask.shape[0] and 0<=col<mask.shape[1] and bool(mask[row,col]): votes+=1
        if votes>=3: pts=pts[::-1]
        out.append(pts)
    return out

def resample(pts, step=0.7):
    p=np.array(pts); d=np.hypot(*np.diff(np.vstack([p,p[:1]]),axis=0).T); L=d.sum()
    n=max(12,int(math.ceil(L/step))); s=np.concatenate([[0],np.cumsum(d)])
    t=np.linspace(0,L,n,endpoint=False); q=np.vstack([p,p[:1]])
    r=np.stack([np.interp(t,s,q[:,0]),np.interp(t,s,q[:,1])],axis=1)
    r=(np.roll(r,1,axis=0)+r+np.roll(r,-1,axis=0))/3.0
    seg=np.hypot(*(np.roll(r,-1,axis=0)-r).T)
    return r, float(seg.sum()), np.concatenate([[0.0],np.cumsum(seg)])

def normals(q):
    nx=np.roll(q,-1,axis=0); pv=np.roll(q,1,axis=0)
    tx=nx[:,0]-pv[:,0]; ty=nx[:,1]-pv[:,1]; l=np.hypot(tx,ty); l[l==0]=1
    return np.stack([ty/l,-tx/l],axis=1)

def curv_at(q,cum,L,us,d=1.5):
    """|curvature| at each weld column, measured the same way the app measures it: the angle between
       the contour normals a short way either side, over that arc."""
    n=len(q); out=[]
    for u in us:
        a=(u-d)%L; b=(u+d)%L
        ia=int(np.searchsorted(cum[:-1],a))%n; ib=int(np.searchsorted(cum[:-1],b))%n
        ta=q[(ia+1)%n]-q[ia-1]; tb=q[(ib+1)%n]-q[ib-1]
        na=np.array([ta[1],-ta[0]]); nb=np.array([tb[1],-tb[0]])
        na/=np.hypot(*na)+1e-12; nb/=np.hypot(*nb)+1e-12
        c=float(np.clip(na@nb,-1,1)); out.append(math.acos(c)/(2*d))
    return np.array(out)

def reach_bound(us,kk,L,bead):
    """The largest wall+tab reach at which every weld column can still carry a rung.

       A staple's half-step D can never exceed 0.45 of the gap to the next column (or the staples
       collide), and on the inside of a corner the legs converge by (1 - reach*k). Both together:
                     0.45 * gap_i * (1 - reach*k_i) >= bead
       gives a closed-form ceiling on reach at every column. The tightest column sets the layer.
       This is the negotiation the first climber never made: it chose a 9.2 mm wall on a limb whose
       corners could not turn it, and paid with rungs dropped in silence."""
    if len(us)<2: return 1e9
    n=len(us); best=1e9
    for i in range(n):
        g=(us[(i+1)%n]-us[i])%L
        if g<=1e-6: return 0.0
        k=kk[i]
        if k<1e-4: continue
        num=1.0-bead/(0.45*g)
        if num<=0: return 0.0
        best=min(best,num/k)
    return best

def nodes_for(q,cum,L,z,K):
    """weld columns on each part's own angular grid, mapped onto the (possibly merged) curve.
       K is per layer and only ever doubles — dyadic refinement keeps the columns registered."""
    pts_=parts_at(z)
    if not pts_: return [],K,1.0
    cen=[(p[0],p[1]) for p in pts_]; rad=[p[2] for p in pts_]
    d=np.stack([np.hypot(q[:,0]-c[0],q[:,1]-c[1])/max(r,0.1) for c,r in zip(cen,rad)],axis=1)
    own=np.argmin(d,axis=1); n=len(q); us=[]
    p0=2*math.pi*float(np.mean(rad))/K
    start=0
    for i in range(n):
        if own[i]!=own[i-1]: start=i; break
    idx=[(start+i)%n for i in range(n)]
    ang=lambda i,c: math.atan2(q[i][1]-cen[c][1], q[i][0]-cen[c][0])
    for k in range(n):
        i=idx[k]; j=idx[(k+1)%n]; c=int(own[i])
        if own[j]!=c: continue
        dth=2*math.pi/K
        th0=ang(i,c); th1=ang(j,c); dd=th1-th0
        if dd>math.pi: dd-=2*math.pi
        if dd<-math.pi: dd+=2*math.pi
        if abs(dd)<1e-9: continue
        g0=math.floor((th0/dth)-0.5); g1=math.floor((th1/dth)-0.5)
        for g in range(min(g0,g1)+1, max(g0,g1)+1):
            tg=(g+0.5)*dth
            while tg-th0>math.pi: tg-=2*math.pi
            while tg-th0<-math.pi: tg+=2*math.pi
            f=(tg-th0)/dd
            if 0<=f<=1:
                u=cum[i]+f*((cum[j]-cum[i]) if j>i else (L-cum[i]+cum[j])); us.append(u%L)
    us=sorted(us); filled=[]
    for k,u in enumerate(us):
        filled.append(u)
        if len(us)>1:
            gap=(us[(k+1)%len(us)]-u)%L
            if gap>1.6*p0:
                cnt=int(gap//p0)
                for t in range(1,cnt): filled.append((u+gap*t/cnt)%L)
    filled=sorted(filled); MINSP=max(2.4,0.7*p0); keep=[]
    for u in filled:
        if not keep or u-keep[-1]>=MINSP: keep.append(u)
    if len(keep)>1 and (L-keep[-1]+keep[0])<MINSP: keep.pop()
    return keep, K, p0

# ---------------- the first layer: one connected piece, with holes between the feet ----------------
def build_foundation(z0, w0_):
    """Each foot gets its annular brim; the brims are joined by thin ribs along the edges of the
       foot polygon. The result is ONE connected region with real openings between the feet —
       Šuma printed with every column on its own island, and this is the answer to that."""
    body=np.full(X.shape,1e9)
    for (cx,cy,r) in parts_at(z0): body=np.minimum(body, np.hypot(X-cx,Y-cy)-r)
    band=(body>=-(w0_/2+0.2)) & (body<=w0_/2+args.foundation)      # the brim ring, per foot
    feet=[(p[0],p[1]) for p in parts_at(z0)]
    ribs=np.zeros(X.shape,bool)
    edges=[]
    if len(feet)>=2:
        order=list(range(len(feet)))
        edges=[(order[i],order[(i+1)%len(feet)]) for i in range(len(feet))] if len(feet)>2 else [(0,1)]
        for i,j in edges:
            ax,ay=feet[i]; bx,by=feet[j]
            dx,dy=bx-ax,by-ay; L2=dx*dx+dy*dy
            t=np.clip(((X-ax)*dx+(Y-ay)*dy)/max(L2,1e-9),0,1)
            ribs |= (np.hypot(X-(ax+t*dx), Y-(ay+t*dy)) <= args.rib/2)
    found=band|ribs
    lab,nl=ndimage.label(found, structure=np.ones((3,3),bool))
    holes=ndimage.binary_fill_holes(found)&~found
    _,nh=ndimage.label(holes)
    # trace it as one continuous thread: concentric level sets of the region's own SDF
    bs=(ndimage.distance_transform_edt(~found)-ndimage.distance_transform_edt(found))*res
    pitch=(args.bead+0.06)*0.82; rings=[]; lvl=-pitch*0.5
    while True:
        cl_=measure.find_contours(bs,lvl)
        if not cl_: break
        for c in cl_:
            p=np.stack([gx[0]+c[:,1]*res, gy[0]+c[:,0]*res],axis=1)
            if len(p)>6: rings.append(p)
        lvl-=pitch
    paths=[]; path=[]; cur=None
    for rg in rings:
        if cur is not None:
            d=np.hypot(rg[:,0]-cur[0],rg[:,1]-cur[1]); si=int(np.argmin(d))
            if d[si]>3.0: paths.append([[round(x,3),round(y,3)] for x,y in path[::2]]); path=[]
            rg=np.roll(rg,-si,axis=0)
        path.extend(rg.tolist()); cur=rg[-1]
    if path: paths.append([[round(x,3),round(y,3)] for x,y in path[::2]])
    if paths:                                        # greedy nearest-endpoint tour: fewest travels
        rest=paths[1:]; tour=[paths[0]]
        while rest:
            e=tour[-1][-1]
            j=min(range(len(rest)),key=lambda i:min(math.hypot(rest[i][0][0]-e[0],rest[i][0][1]-e[1]),
                                                    math.hypot(rest[i][-1][0]-e[0],rest[i][-1][1]-e[1])))
            q=rest.pop(j)
            if math.hypot(q[-1][0]-e[0],q[-1][1]-e[1])<math.hypot(q[0][0]-e[0],q[0][1]-e[1]): q=q[::-1]
            tour.append(q)
        paths=tour
    return {'zBot':0,'zTop':round(LH,4),'paths':paths,'rings':len(rings),
            'kind':'annular brims joined by ribs','islands':int(nl),'openings':int(nh),
            'ribWidth_mm':args.rib,'ribs':len(edges)}, found

# ---------------- run ----------------
layers=[]; events=[]; shifts=[]; caps_all=[]; rail_worst=[]; open_ends=[]; rail_steps=[]
prev_lab=None; prev_pts=None; prev_holes=0; first=None; found_mask=None; CAPPED=set()
K_used=[]; tip_worst=[]
cur_mask = mask_at(LH/2)
for k in range(N):
    zb=k*LH; zc=zb+LH/2
    nxt_mask = mask_at(zc+LH) if k+1<N else np.zeros_like(cur_mask)
    m = cur_mask.copy()
    web,tab,phase = phase_at(zc)
    caps=[]
    # --- hole closure: a hole too small to be walled is capped and filled above ---
    fill=ndimage.binary_fill_holes(m); holes=fill&~m
    hl,nh=ndimage.label(holes)
    if nh>prev_holes and k: events.append({'z':round(zc,2),'type':'hole-birth','count':int(nh-prev_holes)})
    prev_holes=nh
    for hid in range(1,nh+1):
        hm=hl==hid; dist=ndimage.distance_transform_edt(hm)*res; r_ins=float(dist.max())
        if r_ins < args.bead:
            m=m|hm; continue          # a hole narrower than one bead is raster noise, not an opening
        if r_ins<CAP_at(zc):
            m=m|hm
            iy,ix=np.unravel_index(np.argmax(dist),dist.shape)
            # keyed by plan position AND height band: the same mm at a different height is a
            # different hole on a figure whose centre is periodic in z (audit F11)
            key=('hole',round(float(gx[0]+ix*res)),round(float(gy[0]+iy*res)),int(zc//8))
            if key not in CAPPED:
                CAPPED.add(key)
                caps.append({'kind':'hole','pts':spiral(gx[0]+ix*res,gy[0]+iy*res,r_ins+0.5,args.bead*0.82),
                             'pitch_mm':round(args.bead*0.82,3),'r_mm':round(r_ins+0.5,2),
                             'c':[float(gx[0]+ix*res),float(gy[0]+iy*res)],
                             'span_mm':round(2*(r_ins+0.5),2),
                             'process':'single-layer-inward-spiral/climber-v1',
                             'physicalStatus':'experimental','evidence':None})
    # --- the wall this layer can actually carry: measured on THIS layer's own mask ---
    lab,nl=ndimage.label(m)
    if nl:
        rin=[float((ndimage.distance_transform_edt(lab==cid)*res).max()) for cid in range(1,nl+1)]
        w_geo=2*(min(rin)-args.e-args.bead-0.15)
    else:
        w_geo=W_MAX
    w=max(W_FLOOR, min(wall_nominal(zc), w_geo))
    # --- DEATH CLOSURE: a component with no successor on the next layer is capped here.
    #     "Successor" means a successor that will itself carry a wall — a single overlapping
    #     pixel is not a successor, it is a rounding error (audit F8). ---
    if nl:
        nlab,_=ndimage.label(nxt_mask)
        for cid in range(1,nl+1):
            cm=lab==cid
            if (cm.sum()*PX_MM2) < MIN_AREA: continue          # no wall here either way
            if nlab.max():
                surv=(nlab[cm]>0)
                if surv.sum()*PX_MM2 >= MIN_AREA: continue     # it really does continue upward
            dist=ndimage.distance_transform_edt(cm)*res; r_ins=float(dist.max())
            iy,ix=np.unravel_index(np.argmax(dist),dist.shape)
            caps.append({'kind':'death','pts':spiral(gx[0]+ix*res,gy[0]+iy*res,max(1.0,r_ins),args.bead*0.82),
                         'pitch_mm':round(args.bead*0.82,3),'r_mm':round(max(1.0,r_ins),2),
                         'c':[float(gx[0]+ix*res),float(gy[0]+iy*res)],
                         'span_mm':round(2*max(1.0,r_ins),2),
                         'process':'single-layer-inward-spiral/climber-v1',
                         'physicalStatus':'experimental','evidence':None})
            events.append({'z':round(zc,2),'type':'death-cap','r_mm':round(r_ins,2)})
    # --- OPEN ENDS: material with nothing above it. The mirror of the support check, which only
    #     ever asked whether something was underneath. A lobe that ends here and is wider than the
    #     wall that covers it is an open tube — the D5 crown, one level down. ---
    if nl:
        endm = m & ~nxt_mask
        el,ne = ndimage.label(endm)
        for eid in range(1,ne+1):
            em = el==eid
            if em.sum()*PX_MM2 < MIN_AREA: continue
            ed = ndimage.distance_transform_edt(em)*res
            r_end = float(ed.max())
            if r_end <= w/2 + tab + args.bead: continue      # the wall itself covers it
            iy,ix = np.unravel_index(np.argmax(ed),ed.shape)
            ex,ey = float(gx[0]+ix*res), float(gy[0]+iy*res)
            if any(math.hypot(c['c'][0]-ex,c['c'][1]-ey) <= c['r_mm'] and c['r_mm'] >= r_end-0.6
                   for c in caps): continue                  # a membrane on this layer already closes it
            open_ends.append({'z':round(zc,2),'r_mm':round(r_end,2),'area_mm2':round(em.sum()*PX_MM2,1),
                              'at':[round(ex,1),round(ey,1)]})
    # --- contour tree ---
    if prev_lab is None:
        for i in range(1,nl+1): events.append({'z':round(zc,2),'type':'birth','id':i,'onFoundation':None})
    else:
        pn=prev_lab.max(); ov=np.zeros((pn+1,nl+1),dtype=int); both=(lab>0)&(prev_lab>0)
        np.add.at(ov,(prev_lab[both],lab[both]),1)
        for c in range(1,nl+1):
            par=[p for p in range(1,pn+1) if ov[p,c]*PX_MM2>=MIN_AREA]
            if not par: events.append({'z':round(zc,2),'type':'birth','id':c,'IN_AIR':True})
            elif len(par)>1: events.append({'z':round(zc,2),'type':'merge','id':c,'from':par})
        for p in range(1,pn+1):
            kids=[c for c in range(1,nl+1) if ov[p,c]*PX_MM2>=MIN_AREA]
            if not kids: events.append({'z':round(zc,2),'type':'death','id':p})
            elif len(kids)>1: events.append({'z':round(zc,2),'type':'split','id':p,'to':kids})
    prev_lab=lab
    sdf=(ndimage.distance_transform_edt(~m)-ndimage.distance_transform_edt(m))*res
    lay={'k':k,'zBot':round(zb,4),'zTop':round(zb+LH,4),'w':round(w,3),'web':web,'tab':tab,
         'phase':phase,'contours':[]}
    if k==0:
        first, found_mask = build_foundation(LH/2, w)
        # F15: assert, don't declare. Every layer-0 component has to sit on the foundation.
        onf=[bool((found_mask&(lab==cid)).sum()*PX_MM2 >= MIN_AREA) for cid in range(1,nl+1)]
        for i,ok in enumerate(onf,1):
            for e in events:
                if e.get('type')=='birth' and e.get('id')==i and e['z']==round(zc,2): e['onFoundation']=ok
        first['componentsOnFoundation']=onf
    # The inward rung tips must not meet in the middle of a thin limb. Measuring that needs the
    # contour and its weld columns, so the wall and tab are SOLVED here, not guessed: both are pulled
    # down together (keeping the rhythm as long as possible) until the tips clear 2 beads. This is
    # what the nominal-radius clamp of the first climber could not see (140 crowded layers, worst
    # 0.04 mm) — the phantom-disc statistic it used never touched the emitted contour.
    TIP_FLOOR=2*args.bead
    def wof(s):  return W_FLOOR+s*(w-W_FLOOR)
    def tof(s):  return TAB_FLOOR+s*(tab-TAB_FLOOR)
    def offs(s): return wof(s)/2 + tof(s)
    def tipgap(q,nr,idx,off):
        tips=q[idx]-nr[idx]*off
        d,_=cKDTree(tips).query(tips,k=2); return float(d[:,1].min())
    def railgap(q,nr,cum,L,ww,tt):
        """How close the thread comes to itself on one layer, at every lateral offset it uses:
        the outer rail (+w/2), the inner rail (-w/2), and the deepest point a web reaches, which is
        the far leg of a rung at -(w/2+tab). Where the body is thinner than that plus a bead — a
        narrow neck between two merging limbs, the rounded tip of an arm — the thread meets the
        thread coming the other way and the two fuse into a blob.

        The morphological closing does not prevent this: it fillets the CORNER of a neck, it does
        not make the neck WIDE. Pairs closer than (w + 2·tab + 2) mm apart along the contour are the
        wall's own thickness and are skipped — the same exclusion the app's overlap detector uses,
        applied here before anything is emitted instead of after."""
        n=len(q)
        if n<12: return 1e9
        # every lateral offset the thread uses on this layer: both chord rails, and both extremes a
        # web reaches — a perp run sits a tab OUTSIDE the rail, a staple rung reaches a tab INSIDE
        pts=np.vstack([q+nr*(ww/2.0), q-nr*(ww/2.0),
                       q+nr*(ww/2.0+tt), q-nr*(ww/2.0+tt)])
        arc=np.concatenate([cum[:n]]*4)
        skipmm=ww+2*tt+2.0
        t=cKDTree(pts); d,j=t.query(pts,k=min(18,len(pts)))
        da=np.abs(arc[:,None]-arc[j]); da=np.minimum(da,L-da)
        far=da>=skipmm
        return float(np.min(np.where(far,d,np.inf))) if far.any() else 1e9
    ALLOW = w/2 + tab              # provisional; replaced once the layer's contours are solved
    built=[]; reach_cap=1e9
    for c in contours_of(sdf,m):
        q,L,cum=resample(c); nr=normals(q)
        # density follows the geometry, not a constant: a contour that shifted a long way since the
        # layer below is overhanging and gets twice the welds. Doubling only — dyadic refinement is
        # what keeps the weld columns registered from layer to layer.
        # A chord rail above is supported only where the web below ran on THAT rail, so the arc it
        # must cross with nothing under it is one weld gap. K therefore cannot be a constant: on a
        # big contour, K=10 leaves an 11.6 mm gap and the chord above bridges 12-18 mm against a
        # 12 mm limit. K is raised (dyadically, so the columns stay registered) until the gap is
        # comfortably inside maxBridge, and raised again where the layer overhangs most.
        GAP_TARGET = 0.42*args.maxbridge
        need = L/max(GAP_TARGET,1e-6)
        Kl = args.K
        while Kl < need and Kl < 16*args.K: Kl *= 2
        if prev_pts is not None:
            d,_=cKDTree(prev_pts).query(q); step=float(d.max())
            if step > 0.55*(W_FLOOR/2+TAB_FLOOR): Kl=2*Kl
        us,Keff,p0=nodes_for(q,cum,L,zc,Kl); K_used.append(Kl)
        # A thick wall needs room to turn. If the columns are too close together for the wall this
        # band asks for, the honest move is FEWER columns (dyadic: drop every other one, so the rest
        # stay registered) — longer runs and a thicker wall, which is what the band wanted anyway.
        # Coarsening stops at maxBridge: a rail may never run further than that between crossings.
        # Whatever the columns came out as — mapped across a merge, thinned by MINSP — no gap may
        # be left that the chord above cannot cross. A chord rail is supported only where the web
        # below ran on THAT rail, and the web alternates rails at every crossing, so the arc it has
        # to hold up is one weld gap. Split anything wider.
        #
        # An earlier version did the opposite here: it HALVED the columns where a band asked for a
        # thick wall, because a wide gap admits a thicker wall (0.45*gap*(1-reach*k) >= bead). That
        # trade is the wrong way round. A thick wall with sparse welds puts the rail above it in the
        # air, and the gate measures the air. Support wins; the wall takes what is left.
        # A TRUSS MEMBER IS A BRIDGE. staple and perp run ON the rails and cross at a constant u, so
        # their runs stack on the material below. diagonal, sine and eight cross the middle of the
        # band, where a chord layer has nothing at all — the member is in the air from one rail to
        # the other, and its length is sqrt(gap^2 + (w+2*tab)^2). That bounds the WALL in those
        # bands, not just the weld spacing. Found by the gate as 12-23 mm bridges in every reach.
        if web in ('diagonal','sine','eight'):
            reach_cap=min(reach_cap, 0.34*args.maxbridge)     # w + 2*tab = 2*reach <= 0.68*maxBridge
        if len(us)>1:
            cap=0.45*args.maxbridge
            if web in ('diagonal','sine','eight'):
                span=2*min(reach_cap, wall_nominal(zc)/2+tab)
                # never below the node floor: crowding the columns to satisfy a bridge is a trade
                # that just moves the failure from one check to the other
                cap=min(cap, max(2.6, math.sqrt(max(1.0,(0.85*args.maxbridge)**2 - span*span))))
            out2=[]
            for i2 in range(len(us)):
                u0=us[i2]; g=(us[(i2+1)%len(us)]-u0)%L
                out2.append(u0)
                if g>cap:
                    n2=int(math.ceil(g/cap))
                    for t2 in range(1,n2): out2.append((u0+g*t2/n2)%L)
            us=sorted(set(round(v,4) for v in out2))
        if len(us)>3:
            reach_cap=min(reach_cap, reach_bound(us, curv_at(q,cum,L,us), L, args.bead))
        idx=np.searchsorted(np.array(cum[:-1]),np.array(us))%len(q) if len(us)>1 else None
        built.append((q,nr,cum,L,us,Kl,idx))
    # one scale for the whole layer: the wall does not change halfway round a figure
    s=1.0; single=False
    def ok(sv):
        if offs(sv) > reach_cap: return False
        if min((tipgap(b[0],b[1],b[6],offs(sv)) for b in built if b[6] is not None),
               default=1e9) < TIP_FLOOR: return False
        return min((railgap(b[0],b[1],b[2],b[3],wof(sv),tof(sv)) for b in built),
                   default=1e9) >= RAIL_MIN
    if built:
        if not ok(1.0):
            lo,hi=0.0,1.0
            for _ in range(16):
                mid=(lo+hi)/2
                if ok(mid): lo=mid
                else: hi=mid
            s=lo
            # Even the floor will not fit: at the instant two limbs fuse, the neck is a sliver. The
            # lattice then degenerates to what it is made of — ONE thread on the centreline. Nothing
            # can touch itself, the rails below and above sit half a floor-wall away, and the piece
            # keeps its topology. This is the bottom of the wall, declared, not an exemption.
            if not ok(0.0): single=True; s=0.0
    # round DOWN, never to nearest: rounding up by half a micron is enough to push the solved tip
    # gap back under the floor, and a check that its own rounding can defeat is not a check
    w=math.floor((W_FLOOR+s*(w-W_FLOOR))*1000)/1000; tab=math.floor((TAB_FLOOR+s*(tab-TAB_FLOOR))*1000)/1000
    lay['w']=w; lay['tab']=tab; lay['wScale']=round(s,3); lay['reachCap']=round(min(reach_cap,999),3)
    if single: lay['single']=True
    rg=min((railgap(b[0],b[1],b[2],b[3],w,tab) for b in built), default=1e9)
    if rg<1e8:
        lay['railGap']=round(rg,3)
        if not single: rail_worst.append((round(zc,2),round(rg,3)))
    # WEFT-05. The cone was w/2 + tab, and that is right for the INNER rail — it lands inside the
    # band the layer below already occupies. The OUTER rail has no such luxury: the furthest thing
    # under it is the tab of the layer below, reaching tab beyond its own contour. So the contour may
    # move at most a tab (plus half a bead of overlap) per layer before the outer rail is over air.
    # The old, generous number let the arms grow sideways at 1.2 mm a layer, and the gate found the
    # result: 14 mm of rail bridging nothing at all.
    ALLOW = tab + args.bead/2
    for (q,nr,cum,L,us,Kl,idx) in built:
        qq=np.vstack([q,q[:1]]); nn=np.vstack([nr,nr[:1]])
        rec={'pts':[[round(x,3),round(y,3)] for x,y in qq],'nrm':[[round(x,4),round(y,4)] for x,y in nn],
             'cum':[round(v,4) for v in cum],'total':round(L,4),'nodes':[round(u,4) for u in us],'K':Kl}
        if idx is not None: rec['minTipGap']=round(tipgap(q,nr,idx,w/2+tab),3)
        if len(us)>1:
            rec['maxNodeGap']=round(max((us[(i+1)%len(us)]-us[i])%L for i in range(len(us))),3)
        lay['contours'].append(rec)
    tp=[c['minTipGap'] for c in lay['contours'] if 'minTipGap' in c]
    if tp: lay['minTipGap']=min(tp); tip_worst.append((round(zc,2),min(tp)))
    # a cap belongs to a layer that has a wall: a cap alone is a disc in mid-air (WEFT-01)
    if caps and lay['contours']:
        lay['caps']=caps; caps_all.extend([(round(zc,2),c) for c in caps])
    cur_pts=np.vstack([np.array(c['pts']) for c in lay['contours']]) if lay['contours'] else None
    if cur_pts is not None:
        if prev_pts is not None:
            d,_=cKDTree(prev_pts).query(cur_pts)
            lay['maxStep']=round(float(d.max()),3); lay['allow']=round(ALLOW,3)
            shifts.append((round(zc,2),lay['maxStep'],round(ALLOW,3)))
            # WEFT-07: what actually has to land on something is the RAIL, and it moves by the
            # contour step PLUS half the change in wall PLUS the change in tab. The thing under it
            # is the tab of the layer below. This is the condition the gate measures; check it here
            # so the geometry refuses first, in the units the design can act on.
        prev_pts=cur_pts          # F9: a contour-less layer must not erase the support reference
    layers.append(lay)
    cur_mask = nxt_mask
    if k%100==0: print(f'  layer {k}/{N} z={zc:.1f} {phase:10s} contours={len(lay["contours"])} '
                       f'w={w:.1f} K={K_used[-1] if K_used else 0}', file=sys.stderr)

# trim the empty tail: nothing above the last wall
last=max((i for i,l in enumerate(layers) if l['contours']), default=-1)
layers=layers[:last+1]

# ---------------- rate-limit the wall (WEFT-04) ----------------
# Each layer solved its own largest admissible wall. Those are ceilings, and a profile of ceilings
# is not a wall: it can drop 8 mm in one layer where the body pinches, and every rail above the drop
# then starts in mid-air. Take the largest profile that never changes faster than W_RATE per layer —
# min-propagated forwards and backwards, so the taper starts early enough — and only ever reduce.
# Reducing is always safe: every constraint the solve tested (tip crowding, self-approach, the reach
# a corner can turn) is monotone in wall+tab.
wl=[l['w'] for l in layers]; tl=[l['tab'] for l in layers]
for arr,rate,floor in ((wl,W_RATE,W_FLOOR),(tl,TAB_RATE,TAB_FLOOR)):
    for i in range(1,len(arr)):        arr[i]=min(arr[i], arr[i-1]+rate)
    for i in range(len(arr)-2,-1,-1):  arr[i]=min(arr[i], arr[i+1]+rate)
    for i in range(len(arr)):          arr[i]=max(floor, math.floor(arr[i]*1000)/1000)
wall_steps=[]
for i,l in enumerate(layers):
    l['wCeil']=l['w']; l['w']=wl[i]; l['tab']=tl[i]
    if i: wall_steps.append((l['zBot'], round(abs(wl[i]-wl[i-1])/2 + abs(tl[i]-tl[i-1]), 3)))
# the metrics the solve reported were computed at the ceiling; restate them at what is emitted
for l in layers:
    off=l['w']/2+l['tab']
    for c in l['contours']:
        if not c['nodes'] or len(c['nodes'])<2: continue
        q=np.array(c['pts'][:-1]); nr=np.array(c['nrm'][:-1]); cum=np.array(c['cum'][:-1]); L=c['total']
        idx=np.searchsorted(cum,np.array(c['nodes']))%len(q)
        tips=q[idx]-nr[idx]*off
        d,_=cKDTree(tips).query(tips,k=2); c['minTipGap']=round(float(d[:,1].min()),3)
    tp=[c['minTipGap'] for c in l['contours'] if 'minTipGap' in c]
    if tp: l['minTipGap']=min(tp)
tip_worst=[(l['zBot'],l['minTipGap']) for l in layers if 'minTipGap' in l]

# WEFT-07. What has to land on something is the RAIL, and it moves by the contour step plus half the
# change in wall plus the change in tab. What is under it is the TAB of the layer below, which reaches
# tab beyond that contour — and only at the weld columns, so what matters is not the worst point but
# the longest CONTIGUOUS arc with nothing under it. A merge lifts a short neck over the gap it is
# closing: a legitimate bridge. A limb growing sideways lifts a long arc: not. Measured here, after
# the wall has been rate-limited, in the units the design can act on.
for i in range(1,len(layers)):
    cur, prv = layers[i], layers[i-1]
    if not cur['contours'] or not prv['contours']: continue
    pts_prev=np.vstack([np.array(c['pts'][:-1]) for c in prv['contours']])
    tree=cKDTree(pts_prev)
    allow_prev=prv['tab']+args.bead/2
    extra=abs(cur['w']-prv['w'])/2 + abs(cur['tab']-prv['tab'])
    worst=0.0
    for c in cur['contours']:
        qq=np.array(c['pts'][:-1]); cum=np.array(c['cum'][:-1]); Lc=c['total']
        dd,_=tree.query(qq)
        over=(dd+extra)>allow_prev
        if not over.any(): continue
        if over.all(): worst=max(worst,Lc); continue
        idx=np.where(~over)[0]
        gaps=np.diff(np.concatenate([idx,[idx[0]+len(qq)]]))
        j=int(np.argmax(gaps))
        a0=cum[idx[j]]; a1=cum[(idx[j]+int(gaps[j]))%len(qq)]
        worst=max(worst,(a1-a0)%Lc)
    cur['overAir_mm']=round(worst,2)
    rail_steps.append((cur['zBot'], round(worst,2), round(allow_prev,3)))

# ---------------- checks that REFUSE (WEFT-01: a report is not a check) ----------------
bb=[1e9,1e9,-1e9,-1e9]
def eat(p):
    bb[0]=min(bb[0],p[0]); bb[1]=min(bb[1],p[1]); bb[2]=max(bb[2],p[0]); bb[3]=max(bb[3],p[1])
for l in layers:
    for c in l['contours']:
        for p in c['pts']: eat(p)
    for c in l.get('caps',[]):
        for p in c['pts']: eat(p)
if first:
    for pth in first['paths']:
        for p in pth: eat(p)

violations=[]
step_bad=[t for t in shifts if t[1] > max(t[2], args.maxbridge)]
if step_bad: violations.append(f'{len(step_bad)} layers step further than both the cone and maxBridge '
                              f'(worst {max(t[1] for t in step_bad):.2f} mm at z={max(step_bad,key=lambda t:t[1])[0]})')
# a filled spiral bridges its PITCH, not its diameter; what would make it invalid is a pitch that
# leaves a gap between turns, or a membrane so large that accumulated sag beats the weld
cap_bad=[(z,c) for z,c in caps_all if c['pitch_mm'] > args.bead or c['r_mm'] > 3*args.maxbridge]
if cap_bad: violations.append(f'{len(cap_bad)} cap membranes are not self-supporting '
                              f'(worst pitch {max(c["pitch_mm"] for _,c in cap_bad):.2f} mm / '
                              f'radius {max(c["r_mm"] for _,c in cap_bad):.1f} mm at z={cap_bad[0][0]})')
gap_bad=[(l['zBot'],c['maxNodeGap']) for l in layers for c in l['contours']
         if c.get('maxNodeGap',0) > 0.75*args.maxbridge]
if gap_bad: violations.append(f'{len(gap_bad)} contours leave more than maxBridge between weld columns '
                              f'(worst {max(g for _,g in gap_bad):.1f} mm at z={gap_bad[0][0]})')
move_bad=[t for t in rail_steps if t[1] > args.maxbridge]
if move_bad: violations.append(f'{len(move_bad)} layers leave an arc longer than maxBridge with nothing '
                               f'under it (worst {max(t[1] for t in move_bad):.1f} mm at '
                               f'z={max(move_bad,key=lambda t:t[1])[0]})')
step_bad2=[t for t in wall_steps if t[1] > args.bead]
if step_bad2: violations.append(f'{len(step_bad2)} layers move a chord rail more than one bead sideways '
                                f'(worst {max(v for _,v in step_bad2):.2f} mm at z={max(step_bad2,key=lambda t:t[1])[0]})')
rail_bad=[t for t in rail_worst if t[1] < RAIL_MIN-1e-6]
if rail_bad: violations.append(f'{len(rail_bad)} layers let the thread come within {RAIL_MIN:.2f} mm '
                              f'of itself on one layer (worst {min(t[1] for t in rail_bad):.3f} mm '
                              f'at z={min(rail_bad,key=lambda t:t[1])[0]})')
tip_bad=[t for t in tip_worst if t[1] < 2*args.bead - 0.01]   # 10 um of measurement tolerance
if tip_bad: violations.append(f'{len(tip_bad)} layers crowd rung tips below {2*args.bead:.2f} mm '
                              f'(worst {min(t[1] for t in tip_bad):.3f} mm at z={min(tip_bad,key=lambda t:t[1])[0]})')
oe=[o for o in open_ends if o['r_mm']>0]
if oe: violations.append(f'{len(oe)} layers end material with nothing above it and no closure '
                         f'(worst radius {max(o["r_mm"] for o in oe):.1f} mm at z={max(oe,key=lambda o:o["r_mm"])["z"]})')
air=[e for e in events if e.get('IN_AIR')]
if air: violations.append(f'{len(air)} components are born in mid-air (first at z={air[0]["z"]})')
if first:
    if first['islands']!=1:
        violations.append(f'first layer is {first["islands"]} separate islands — the brims must be joined')
    if first['openings']<1:
        violations.append('first layer is a solid slab — the brims must leave openings between the feet')
    if not all(first['componentsOnFoundation']):
        violations.append('a first-layer component does not sit on the foundation')
else:
    violations.append('no foundation was generated')
size=[round(bb[2]-bb[0]+W_MAX,1), round(bb[3]-bb[1]+W_MAX,1),
      round(max((l['zTop'] for l in layers), default=0),1)]
if size[0]>args.plate[0]-16 or size[1]>args.plate[1]-16:
    violations.append(f'{size[0]}x{size[1]} mm does not fit the {args.plate[0]:.0f}x{args.plate[1]:.0f} plate')

cc=[[l['zBot'],len(l['contours'])] for i,l in enumerate(layers) if i==0 or len(l['contours'])!=len(layers[i-1]['contours'])]
summary={'N':len(layers),'H':H,'legs':args.legs,'args':vars(args),
  'RHO_note':'per layer: w_nominal(z)/2 + e + bead + 0.3','RHO_max':round(RHO_MAX,2),
  'contourCounts':cc,'events':events,
  'phases':[[l['zBot'],l['phase'],l['web'],l['tab'],l['w']] for i,l in enumerate(layers) if i==0 or l['phase']!=layers[i-1]['phase']],
  'singleThread':{'layers':[l['zBot'] for l in layers if l.get('single')],
    'why':'the neck at that instant is a sliver: one thread on the centreline instead of two rails'},
  'railMotion':{'rule':'longest contiguous arc whose distance to the layer below exceeds '
                        'tab(below) + bead/2 — the bridge the rail actually has to make',
    'limit_mm':args.maxbridge,'worst':sorted(rail_steps,key=lambda t:-t[1])[:6],
    'violations':len(move_bad)},
  'wallRate':{'limit_mm_per_layer':W_RATE,'worst_rail_step_mm':max((v for _,v in wall_steps),default=0),
    'note':'a rail moves (dw/2 + dtab) sideways per layer; over a bead it lands on air'},
  'nodeDensity':{'K':args.K,'doubledLayers':int(sum(1 for v in K_used if v>args.K)),'contours':len(K_used),
    'maxNodeGap_mm':max((c['maxNodeGap'] for l in layers for c in l['contours'] if 'maxNodeGap' in c),default=0),
    'note':'columns are doubled dyadically until the weld gap is inside maxBridge; the wall then takes what the corners allow'},
  'supportCheck':{'rule':'each layer steps within its OWN cone (w(z)/2 + tab(z)) or bridges <= maxBridge',
    'maxStep_mm':max((t[1] for t in shifts),default=None),
    'worst':sorted(shifts,key=lambda t:-t[1])[:8],
    'bridges':len([t for t in shifts if t[2] < t[1] <= args.maxbridge]),
    'violations':step_bad},
  'tipCrowding':{'floor_mm':round(2*args.bead,3),'worst':sorted(tip_worst,key=lambda t:t[1])[:6],
    'violations':len(tip_bad)},
  'railSelfApproach':{'floor_mm':round(RAIL_MIN,3),'appFloor_mm':round(args.bead*0.95,3),'worst':sorted(rail_worst,key=lambda t:t[1])[:6],
    'violations':len(rail_bad)},
  'openEnds':{'rule':'material with no successor, wider than the wall that would cover it',
    'count':len(open_ends),'worst':sorted(open_ends,key=lambda o:-o['r_mm'])[:6]},
  'caps':{'death':len([e for e in events if e['type']=='death-cap']),
          'hole':sum(1 for _,c in caps_all if c['kind']=='hole'),
          'maxRadius_mm':max([c['r_mm'] for _,c in caps_all],default=0),
          'pitch_mm':max([c['pitch_mm'] for _,c in caps_all],default=0),'notSelfSupporting':len(cap_bad)},
  'foundation':{k:v for k,v in (first or {}).items() if k!='paths'},
  'wallWidth':{'nominal':[args.w0,args.w1],'emitted_min':min((l['w'] for l in layers),default=None),
    'emitted_max':max((l['w'] for l in layers),default=None),
    'note':'clamped per layer by the largest circle that fits in THIS layer mask'},
  'bbox_mm':[round(v,2) for v in bb],'size_mm':size,'violations':violations}

if violations and not args.allow_fail:
    print('REFUSED — the geometry did not pass its own checks:', file=sys.stderr)
    for v in violations: print('  * '+v, file=sys.stderr)
    json.dump({'summary':summary,'foundation':first,'layers':[]},open(args.out+'.rejected','w'))
    sys.exit(1)

json.dump({'summary':summary,'foundation':first,'layers':layers},open(args.out,'w'))
print(json.dumps({k:v for k,v in summary.items() if k not in ('events','args','phases')})[:1900])
print('PHASES', [(p[0],p[1],p[2]) for p in summary['phases']])
