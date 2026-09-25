# DOMET_ENDER3V4_X1 — current outcome

**NOT PRINTED / EXPERIMENTAL.** Designed, generated and gate-checked 2026-09-24. No printer upload, physical
specimen or measured reach exists for this geometry.

The prior evidence that motivated it — `OBRTAJ_ENDER_H7` printing flat and `RAZMAK_A2L_H4` nesting and being
stopped — is recorded in those folders and in `FINDINGS_2026-09-23_terrace_measurement.md` beside them. Those
are photographs and geometry measurements of different objects, not of this one.

When printed, record the executed file and its checksum, machine and settings, completion or interruption, the
sector of first curl and of lost surface for each of the four terraces, calibrated side views before and after
the wall above each terrace, the underside after removal, and the measured mass.

Honest verdict: digital evidence only; the reach limit this object exists to measure is still unmeasured.

---

## 2026-09-24 — PRINTED on the Creality Ender-3 V4, completed

The print ran to the end and was not interrupted. Filament was changed part-way up: the
foundation and the first wall band are in a clear natural PLA, everything above is pink,
so the colour boundary is a visible height datum on the object.

**The terraces are not flat.** Every skirt is funnel-shaped: the outer edge falls away
from the wall. In close photographs the fringe reads as individual hanging hairpin
loops — the teardrop of each returning tip is separately visible, with stray single
strands drawn off the longest sectors and lying loose on the bed.

This is a different failure from `RAZMAK_A2L_H4`, which had to be stopped. Nothing here
tangled badly enough to threaten the machine, and nothing failed at the root: the seat
ring laid by the last wall layer did its job, and every terrace is attached along its
whole base. **All the failure is at the tip.**

Compare with `OBRTAJ_ENDER_H7`, printed from the same machine at the same layer height:
its fringe is a stiff vertical palisade of fused radial fins, and its terraces are flat.
The construction difference is that OBRTAJ's terrace contains two distinct paths, each
laid six times onto itself, while DOMET's ribbed terraces A, C and D contain twelve
distinct paths and nothing is ever laid onto itself. `FINDINGS_2026-09-23_terrace_
measurement.md` §2 called that repetition a defect. **The printed evidence says it is
what made OBRTAJ stiff.** Terrace B of this object is the one terrace that kept the
two-path scheme, so a direct A-versus-B comparison exists on a single specimen: same
reach ladder, same layer count, same machine, same run.

### Still to be read off this object

- **A versus B stiffness.** Terrace A is at z 10.0–12.4, terrace B at z 22.4–24.8. Same
  ladder 5→26 mm. If B is stiffer, the repetition is a feature.
- **Terrace D is an unplanned control.** It is at z 47.2–49.6 and holds a *constant*
  20 mm reach the whole way round; only the rib pitch varies. Terraces A and B vary the
  reach by 45 degree sector. If the disorder on D sits at the same bearing as the
  disorder on A and B, the reach is not what is driving it and the part-cooling airflow
  is — because the fan is always on the same side. If D's disorder instead sits where its
  ribs are widest, it is geometry.
- Sector 0 is found on the object by the **shortest** fringe; the ladder ascends
  5, 8, 11, 14, 17, 20, 23, 26 mm.

### Design flaw recorded against this object

The reach ladder is laid out around the azimuth, and so is the part-cooling airflow. The
two cannot be separated except through terrace D. The successor object, `KRAK`, prints
every rung twice at 180 degrees so that a machine effect shows as a difference between
twins.
