# WEFT paper — verified references (2026-08-06)

All eight reference slots in `WEFT_draft.docx` were fact-checked against
publisher pages, DOIs and official documentation. Paste-ready citations
below, numbered as in the draft. Two prose corrections at the end.

## Verified citations

**[1] Mesh Mould** — the canonical citable paper is Hack & Lauer (Gramazio
and Kohler are the lab, not the authors of record):

> Hack, N., Lauer, W.V. (2014). Mesh-Mould: Robotically Fabricated Spatial
> Meshes as Reinforced Concrete Formwork. *Architectural Design* 84(3),
> 44–53. doi:10.1002/ad.1753

(Project: Gramazio Kohler Research, ETH Zürich, 2012–2014, with Sika;
patent WO/2015/034438. The 2014 paper covers exactly the polymer-lattice
formwork+reinforcement phase the draft cites.)

**[2] Branch Technology C-Fab** — no peer-reviewed paper exists; the
citable source is the patent:

> Boyd IV, R.P., Weller, C., DiSanto, A., Rees, M., Hilbert, B. Cellular
> Fabrication and Apparatus for Additive Manufacturing. US Patent
> 10,618,217 B2, granted 2020-04-14 (assignee Branch Technology Inc.).

**[3] Connected Fermat Spirals** — verified:

> Zhao, H., Gu, F., Huang, Q.-X., Garcia, J., Chen, Y., Tu, C., Benes, B.,
> Zhang, H., Cohen-Or, D., Chen, B. (2016). Connected Fermat Spirals for
> Layered Fabrication. *ACM Transactions on Graphics* 35(4) (Proc.
> SIGGRAPH 2016), Article 100, 1–10. doi:10.1145/2897824.2925958

**[4] CrossFill** — verified (journal, not a bare "SPM 2019"):

> Kuipers, T., Wu, J., Wang, C.C.L. (2019). CrossFill: Foam Structures
> with Graded Density for Continuous Material Extrusion. *Computer-Aided
> Design* 114, 37–50 (SPM 2019 special issue). doi:10.1016/j.cad.2019.05.003

**[5] FullControl** — verified, single author (no "et al."):

> Gleadall, A. (2021). FullControl GCode Designer: Open-source software
> for unconstrained design in additive manufacturing. *Additive
> Manufacturing* 46, 102109. doi:10.1016/j.addma.2021.102109

**[6] Arachne** — verified; year is 2020, US spelling "Modeling":

> Kuipers, T., Doubrovski, E.L., Wu, J., Wang, C.C.L. (2020). A Framework
> for Adaptive Width Control of Dense Contour-Parallel Toolpaths in Fused
> Deposition Modeling. *Computer-Aided Design* 128, 102907.
> doi:10.1016/j.cad.2020.102907

Lineage confirmed: Prusa's knowledge base and Bambu Lab's wall-generator
wiki page both cite this exact paper as the basis of their Arachne
perimeter generators (via Ultimaker's libArachne/CuraEngine). The draft's
claim that Bambu Studio/PrusaSlicer Arachne is based on this work is safe.

**[7] Curved/sinusoidal beads in 3DCP** — recommended selection:

> Gosselin, C., Duballet, R., Roux, Ph., Gaudillière, N., Dirrenberger, J.,
> Morel, Ph. (2016). Large-scale 3D printing of ultra-high performance
> concrete – a new processing route for architects and builders.
> *Materials & Design* 100, 102–109. doi:10.1016/j.matdes.2016.03.097

CAVEAT (honesty): Gosselin et al. demonstrate in-plane sinusoidal paths in
thin support-free UHPC walls and is the standard citation for curvilinear
3DCP toolpaths — but no well-cited paper states verbatim that "lateral
curvature braces the fresh bead against buckling." Either soften the
draft's sentence to "curvilinear deposition is established practice in
thin-wall 3DCP [7]" or pair with the buckling mechanics reference:

> Suiker, A.S.J., Wolfs, R.J.M., Lucas, S.M., Salet, T.A.M. (2020).
> Elastic buckling and plastic collapse during 3D concrete printing.
> *Cement and Concrete Research* 135, 106016.
> doi:10.1016/j.cemconres.2020.106016   (studies straight walls)

**[8] Graded-lattice transition-band failure** — recommended selection:

> Maskery, I., Aboulkhair, N.T., Aremu, A.O., Tuck, C.J., Ashcroft, I.A.,
> Wildman, R.D., Hague, R.J.M. (2016). A mechanical property evaluation of
> graded density Al-Si10-Mg lattice structures manufactured by selective
> laser melting. *Materials Science and Engineering: A* 670, 264–274.
> doi:10.1016/j.msea.2016.06.013

(Documents band-localized progressive collapse in density-graded lattices —
the exact parallel the draft draws. Alternative: Al-Saedi et al.,
*Materials & Design* 144 (2018) 32–44.)

## Prose corrections needed in the draft

1. **§3.8 / §7 workflow claim**: Bambu Studio has no
   "File → Import → Import Sliced File" path for external G-code. External
   .gcode is previewed by **dragging the file onto the Preview tab**
   (preview-only import). index.html and README are already corrected;
   the draft's §3.8 "harvested-header transport" text is fine, but any
   description of the import step should use the drag-onto-Preview wording.

2. **§4 fillet claim**: "worst interior turn 35° on the hardest case (a
   ≈141° corner...)" holds only without width modulation (measured 28.1°
   at amp=0). At amp≥2 the modulated-run/rung corners reach ~72° because
   uniform-t bezier sampling concentrates curvature mid-fillet
   (`tests/run_tests.mjs` T6/T6b). Recommended wording: state the 22.5°/
   segment design target, report ≤28° for the unmodulated grammars used in
   all planned experiments, and note the amp≥2 limitation as future work.

3. **§4 width-wave zeros**: measured 7.9e-14 mm, so claim "<10⁻¹²" rather
   than "<10⁻¹⁴".

4. **Hardware section (if added)**: the A2L is a bed-slinger (A1-style
   Cartesian, moving bed), not CoreXY-class as PROJECT_STATE previously
   said. Build volume 330×320×325 mm, open frame, 300 °C hotend / 80 °C
   bed, launched June 2026 — all verified against Bambu's official pages.
