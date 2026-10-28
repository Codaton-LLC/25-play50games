# Pizza Kitchen 3D

Game 45 · points · difficulty 2 · skill · owner claude (built by Codex, gated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-41-50.md` §45.

One open kitchen. A ticket shows the pizza: Use the dough, then sauce, cheese and each topping in ticket order, slide it into an oven, take it out while the ring is green and serve it at the hatch (L5: box it first).

## Controls and rules

- On-foot mover (robot-collector): top speed 4.2 m/s, accel 22, brake 28, radius 0.36, on a 2 m working strip in front of the counter (`rules.ts` `TUNING`).
- Camera (`looks.ts`): pitch 60°, fitted to a window of the kitchen strip (6.75 stations wide, 4.25 on a portrait screen) that pans along the row with the cook and never past its ends; L1-L2 fit whole on wide screens. Fog starts 90 m out, behind any fitted camera (`camera.test.ts`).
- `actionPressed` (E / Enter / touch Use) works the nearest station within 1.2 m of the cook. 0.22 s between Uses and a 0.50 s stun for a wrong ingredient, the same on every device (the rules count play time only).
- A wrong or out-of-order ingredient spoils the pizza (start again from the dough). Bake `bakeS`, then a golden window `goldenS`; the first 1.5 s of it is a perfect bake; after it the pizza is burnt (binned, the ticket stays open).
- Score: +150 served, +50 perfect bake, +30 fresh (served before half the ticket's patience; tickets without patience are always fresh), on win +4 per full second left. A ticket pays once.
- Win: every ticket served or expired. L4-L5: one expired ticket is allowed; a second ends the run with `lose`. Timeup: the shell clock (`durationMs` per level).

## Levels

| L | Title | Orders | Toppings (types / max) | Parallel | Ovens | Bake / golden s | Patience s | Box | Clock | Light |
|---|---|---:|---|---:|---:|---|---:|---|---:|---|
| 1 | Cheese Pizza | 3 | 0 / 0 | 1 | 1 | 5 / 5 | - | - | 120 s | indoor |
| 2 | Two Toppings | 4 | 2 / 2 | 1 | 1 | 5 / 4 | - | - | 150 s | indoor |
| 3 | Restaurant Rush | 6 | 3 / 2 | 2 | 2 | 6 / 4 | - | - | 180 s | indoor |
| 4 | Multiple Orders | 8 | 4 / 2 | 2 | 2 | 6 / 3.5 | 45 | - | 180 s | sunset |
| 5 | Master Pizza Night | 10 | 5 / 2 | 2 | 2 | 6 / 3 | 40 | yes | 210 s | night |

A level clears on a win only (no `clearScore`).

## Server limits and why they hold

Score sources (constants in `rules.ts`): 230 per ticket at most (150 + 50 + 30), once per ticket, so `Bobj = 230 × orders`; the win bonus `4 × floor(D − t)` is the only time term and is largest at the earliest win `M`. So `B(t) ≤ Bobj` before a win and `Bobj + 4 (D − t)` at a win at `t ≥ M`:

- `base = Bobj`, `maxScore ≥ Bobj + 4 (D − M)`, `maxPointsPerSec ≥ 4 (D − M) / M` (then `Bobj + 4 (D − t) ≤ base + pps × t` for every `t ≥ M`).
- `M` = 0.8 × the fastest win of the two oracle bots (`testing/bots.ts`: presses on the 0.22 s cooldown, take-out on the first golden frame (`oracleTight`) or inside the perfect window (`oracle`); 200 seeds each at 30 / 60 / 144 Hz). It is never below the hard floor `ceil(orders / ovens) × bakeS` (each oven bakes one pizza at a time). Margin about 3 %, rounded up.

| L | Bobj | D s | oracle fastest s | M s | peak | base | pps | maxScore | oracle best | honest clears |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 690 | 120 | 23.9 | 19.1 | 1094 | 690 | 22 | 1130 | 1074 (95 %) | 200 / 200 |
| 2 | 920 | 150 | 37.7 | 30.1 | 1400 | 920 | 16 | 1440 | 1368 (95 %) | 200 / 200 |
| 3 | 1380 | 180 | 48.1 | 38.5 | 1946 | 1380 | 15 | 2000 | 1904 (95 %) | 200 / 200 |
| 4 | 1840 | 180 | 65.8 | 52.6 | 2350 | 1840 | 10 | 2420 | 2296 (95 %) | 200 / 200 |
| 5 | 2300 | 210 | 97.6 | 78.1 | 2828 | 2300 | 7 | 2900 | 2718 (94 %) | 200 / 200 |

`minDurationMs = 4000` on every level; `maxDurationMs` = the level clock. L5 / L1 = 2900 / 1130 = 2.57 (≤ 3). Tests: `rules.levels-<n>.test.ts` (bound, oracles inside every limit with `capScore` a no-op, best ≥ 90 %, never faster than 1.24 M) and `clears.levels-<n>.test.ts` (the honest cook: 0.30 s between presses, 0.18 s reaction; ≥ 99 % clears inside the limits, both ovens used on L3-L5; idle never clears or scores; spam stays inside). `levels.test.ts` fails if a rule stops reading any level field (mutation-probed).

## Models

Ready Hyper3D GLBs in `public/models/3d/pizza-kitchen-3d/` (fits in `assets.ts`, checked on the real meshes in `assets.test.ts`): `prepCounterR` (worktop 0.95 m, one per station, stretched to meet at 1.6 m), `pizzaOven` (1.5 m wide on the floor, one per oven), `sauceBowl`, `cheeseBowl`, `mushroomBowlR`, `oliveBowl` (0.5 m), `pepperoni`, `tomato`, `onion` (on the pizza, and as piles in steel bowls), `pizzaBase` (0.6 m), `pizzaPeelCleanT`, `pizzaBoxClosed`. Left out: `mushroomBowl`, `prepCounter`, `pizzaPeel`, `pizzaBox`, `pizzaBoxV2`. Core: the food-catcher chef (`REUSED_ASSETS.chef`, 1.82 m, auto-rig: walk by `walkStride`, reach on Use, carry with the peel, cheer on a win), the clean-city bin (0.8 m), the shared crate.

## Known issues

- Playtest 2026-10-25 fixes: the shared crate (drawn unscaled, 1.9 m, on the open floor) is now a 0.7 m flour crate with two pizza boxes at the hatch end of the row; the bin stands at the dough end; the empty floor in front is gone (2 m strip); the L5 fog no longer washes a phone's view.

- The counter GLB has a thin shelf frame above the worktop; check in play that it does not hide a bowl from the fixed camera.
- The oven GLB's mouth direction is assumed to face the cook (+z); the code glow disc sits in front of it.
