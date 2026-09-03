# MERA — a plate of sixteen instruments

Semir, 2026-09-03: *"napravi nekoliko 16 samplova različitih malih oblika koji staju na A2L površinu…
neke ekstremne testove, pliće, gde će se videti šta se dešava unutra… i za Ender i za Bambu."*

The right instrument for someone who cannot stand next to the printer. Not a sculpture — **sixteen
separate questions on one plate**, each one shallow and open at the top so a photograph taken afterwards
shows the inside, each one changing a number that WEFT currently guesses.

## Why this replaces Rešeto
`CHALLENGE_2026-09-03.md` part 3 proposed one sculpture full of hole-death events. A plate is strictly
better: sixteen answers instead of one, each isolated so a failure names its own cause, at a fifth of
the print time, and photographable in a single pass after the fact.

## Form
Each tile is an **open cup** — footprint ≤ 42 mm, height ≤ 26 mm, no roof — on a 4 × 4 grid.
A2L 330 × 320 at 60 mm pitch (240 × 240). Ender 220 × 220 at 50 mm pitch (200 × 200), same tiles.
Every tile carries its number embossed in the brim so a photograph identifies itself.

## The sixteen

### Row 1 — the four numbers the gate refuses on, all of them guesses
| # | name | what varies | what it decides |
|---|---|---|---|
| M01 | **Most I** | windows spanning 10 / 16 / 22 mm, stacked | `maxbridge`, per machine — currently a flat 12 mm that refused 864 chord runs on the Šuma which then printed |
| M02 | **Most II** | windows spanning 28 / 34 / 40 mm | the far end of the same ladder — the Šuma's longest was 70 mm |
| M03 | **Konzola** | six free-ended spurs, 2 / 3 / 4 / 6 / 8 / 10 mm | `--maxcantilever`, currently a guessed 3 mm |
| M04 | **Korak** | the wall jumps outward 1 / 2 / 3 / 4 / 5 / 6 mm in one layer | how far a contour may stray from the material below — the gate's `allow`, guessed at 0.6 |

### Row 2 — the weave's own limits
| # | name | what varies | what it decides |
|---|---|---|---|
| M05 | **Gustina** | rung spacing 1 / 2 / 3 / 5 / 8 / 12 mm | where cloth becomes loose thread. The Vrtlog runs 3–8 mm and photographs as netting |
| M06 | **Vrh** | rung-tip gap 1.5 / 1.2 / 0.9 / 0.6 / 0.4 / 0.2 mm | the tip-crowding floor (0.9) that fired 8× on the Šuma and showed **nothing** in the plastic |
| M07 | **Bead** | two walls, commanded gap 0.00 / 0.10 / 0.20 / 0.30 / 0.40 / 0.50 mm | **the Ender's real bead, read by eye.** The first band where a slit opens names it. No caliper — his reads to 0.1 and the C1 steps are 0.04 |
| M08 | **Nagib** | wall leaning 10 / 20 / 30 / 40 / 50 / 60° off vertical | the overhang the weave carries unaided |

### Row 3 — membranes: every open question, four per tile, all at one height so one photo answers it
| # | name | what varies | what it decides |
|---|---|---|---|
| M09 | **Jezgro** | spiral stopped at core radius 0.0 / 0.6 / 1.2 / 2.0 mm, each closed with one stroke | **is the slit at the centre of every one of the Šuma's 21 membranes geometric or kinematic** |
| M10 | **Oslonac** | outer turn anchored 100 / 75 / 50 / 25 % | `--minanchor`, my guess of 0.5. The Vrtlog's three membranes measure 0.72 / 0.67 / 0.74 and this decides whether that is acceptable |
| M11 | **Oblik** | circle, peanut, crescent, isthmus — capped by the rim-following membrane written today | whether the fix works on the four shapes that broke the old rule |
| M12 | **Raspon** | discs Ø 6 / 12 / 18 / 24 mm, fully anchored | how large a self-supporting membrane can be |

### Row 4 — grammar, seam, machine
| # | name | what it shows |
|---|---|---|
| M13 | **staple · perp** | the two proven grammars side by side at one scale |
| M14 | **diagonal · sine** | two of the three never printed until the Vrtlog, here at a readable size |
| M15 | **eight · šav** | the third, plus the contour's closing seam pinned at a known angle so the scar is findable |
| M16 | **Nit** | two towers 30 mm apart with a forced alternation every layer — **count the strands.** Calibrates the travel metric that says Šuma 15.4 %, Vrtlog 13.2 %, Penjač 6.9 % |

## What comes back
One photograph per tile, from above, plus one raking-light side view of rows 1 and 2. Sixteen answers.
Six of them go straight into `machines.json` and `check_gcode.py` as measured numbers replacing guesses.

## Honest limits
- The Ender plate is built on the assumed 0.42 bead, so **M07 measures the number the rest of that plate
  was built with.** That is circular for the other fifteen tiles and it has to be said: the Ender plate is
  a first pass, and if M07 comes back far from 0.42 it gets rebuilt.
- Tiles M01–M04 and M08 are pure contour geometry; M05, M06 and M13–M15 need the builder to accept a
  weave grammar **per contour** rather than per build. That change comes first.
