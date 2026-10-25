# Bee Garden

Game 40 · points · difficulty 1 · collection skill · owner antigravity (built by Antigravity, gated and integrated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-31-40.md` §40.

Fly a bee in the horizontal plane (fixed 1.15 m) over one garden, drink the nectar off the flowers (carry up to 3) and bank it on the hive pad. Spider webs stun you and put your carry back on its flowers. Level 5 adds a sideways breeze.

## Controls and timing (one set for keyboard and touch)

- WASD / arrows or the joystick through `inputToWorld` (accel 16 m/s², top speed 6.5, drag 0.6/s with no input; with no input the bee also brakes at its accel). Radius 0.30.
- Hold Space or the touch Boost: 9.5 m/s while stamina > 0, 22 stamina/s. Releasing it, or reaching 0, locks boost for 1.00 s (also while still held). Refill 10/s while not boosting, cap 100. A web hit while boosting also starts the lock.
- Pickup and deposit are overlaps: a flower within 0.55 m of the bee's centre, the hive pad within 1.6 + 0.3 m.
- Webs: radius 0.65, a 0.50 s stun (no movement, no stamina change), the carry returns to the exact flowers it came from, 0 points, then 0.4 s to fly out of the web.
- Solid: branches (radius 0.5), the hive box (radius 0.7), the garden edge.
- Nothing in `TUNING` depends on the device (`rules.test.ts` "keyboard and touch").

## Levels

| L | Title | Garden | Nectar | Webs | Branches | Breeze | Clock | Look | Limits (max / base / pps) |
|---|---|---|---:|---:|---:|---|---:|---|---|
| 1 | Flower Garden | 18 × 14 | 10 | 0 | 2 | no | 120 s | day | 705 / 245 / 42 |
| 2 | Vegetable Garden | 22 × 16 | 15 | 2 | 4 | no | 150 s | day, vegetable planters | 930 / 375 / 31 |
| 3 | Greenhouse | 24 × 18 | 20 | 4 | 6 | no | 180 s | day, close milky fog (the glass), planters | 1140 / 490 / 25 |
| 4 | Forest Flowers | 28 × 20 | 25 | 6 | 8 | no | 180 s | sunset, tree line | 1225 / 620 / 16 |
| 5 | Giant Garden | 32 × 22 | 30 | 8 | 8 | 0.8 m/s² east | 210 s | day + fog, tree line, leaves lean in the wind | 1440 / 750 / 15 |

All levels: `minDurationMs` 4000, `maxDurationMs` = the clock. Only a win (every nectar banked) clears a level (no `clearScore`).

## Server limits and why they hold (one proof per level)

Score sources (`rules.ts`, all integers):

| Source | Value | Bound |
|---|---|---|
| Deposit | `20 × carried` (`pointsPerUnit`) | each flower holds one nectar and never refills after a deposit; a web returns nectar unscored |
| Full load | +15 when `carried === 3` (`bonusFullLoad`) | at most `floor(units / 3)` full loads |
| Win bonus | `4 × floor(timeLeft)` (`winBonusPerSecond`), once | only on the win |

So `Bobj = 20 units + 15 floor(units / 3)` = 245 / 375 / 490 / 620 / 750, and a run that ends at time `t` scores at most `Bobj` (timeup) or `Bobj + 4 floor(D − t)` (a win at `t`). With `base = Bobj`, the rate line holds for every win at `t ≥ M` when `pps ≥ 4 (D / M − 1)`; the peak is `Bobj + 4 floor(D − M)`.

`M` (the earliest win) comes from the bots, as the spec asks: the fastest win of the oracle and the greedy bot over 200 seeds each at 30 / 60 / 144 Hz, times 0.8 (a better route than the bots' still fits).

| L | D (s) | fastest bot win (s) | M = 0.8 × (s) | peak | maxScore (+3 %) | pps needed | pps | oracle best | best / max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 13.67 | 10.9 | 681 | 705 | 40.0 | 42 | 669 | 95 % |
| 2 | 150 | 22.30 | 17.84 | 903 | 930 | 29.6 | 31 | 883 | 95 % |
| 3 | 180 | 32.49 | 26.0 | 1106 | 1140 | 23.7 | 25 | 1078 | 95 % |
| 4 | 180 | 47.49 | 38.0 | 1188 | 1225 | 14.9 | 16 | 1148 | 94 % |
| 5 | 210 | 59.19 | 47.36 | 1398 | 1440 | 13.7 | 15 | 1350 | 94 % |

L5 / L1 = 1440 / 705 = 2.04 (≤ 3). The win score is capped to its level's limits in `rules.ts` as a safety net; the proof tests assert the cap never changes an honest run.

Tests (`proof.level-N.test.ts`, one level per file so they run in parallel; bots in `testing/bots.ts`): the proof's arithmetic; the greedy (careful human: wider margins, brakes for bends, boosts long legs) bot clears ≥ 99 % of 200 seeds per level (100 % measured) inside the limits; the oracle inside the limits, never faster than `M`, best ≥ 90 % of `maxScore`; idle never clears and scores 0 (200 seeds through the rules, 10 through the store); input spam and boost spam inside the limits. All bots run through `createArcadeStore` with `simulateRun`.

`rules.test.ts`: determinism, the generator on 300 seeds per level (counts, sizes, the hive pad and the 4.5 m south band free of hazards, flower spacing), a flood fill per level and seed (200) that every flower is reachable, every score event, webs, boost lock, drag, solids, breeze only on L5, per-level clock and win. `levels.test.ts`: declarations, per-level specs, monotone difficulty. `assets.test.ts`: every GLB's measured bounds and fit, decor spots. Mutation probes on every level read in `rules.ts`, `index.tsx`, `meta.ts` and `looks.ts` fail the tests.

## Look and models

All `menu1-bee-garden` GLBs are adopted (`public/models/3d/bee-garden/`, `branchV2` not `branch`), plus `shared/gardenMushroom.glb` as decor and `EXPANSION_ASSETS.leafyTree` (L4–L5 tree line). Fits are in `assets.ts` from the measured bounds (`GLB_SIZE`), checked on the real meshes:

- bee 0.8 m wingspan, centred on its flight point, tinted per level (creature mesh), `hover` + bank, a spin while stunned; the carry swings under it as up to three small nectar drops;
- hive 0.85 m (under the bee's lowest point, so it never hides the bee) inside its 0.7 m solid box; the pad is a ring + a soft disc;
- flowers 0.95 m (instanced per type), nectar orbs 0.3 m on the blooms at flight height with a pulsing additive glow (one pool each);
- branches stand upright (1.6 m, their leafy spread = the 1 m solid circle); webs 1.4 m wide across the flight height, with a ring on the ground showing the hazard circle;
- decor is fitted to 1 m and placed by its spot's scale (never scaled twice): big leaves (sway; lean east on L5), mushrooms, vegetable planters, watering cans, L4–L5 trees. Nothing stands inside the garden, decor south of it (the camera side) stays under 0.7 m, trees only north and well behind the sides (`assets.test.ts`).
- Ground: a 160 m lawn under the fog (no void), the garden as a mown, striped rectangle in a stone kerb, a soil bed under each flower. `SkyDome` per level.

Camera: a follow camera (pitch 55°, yaw 0, 2 m look-ahead along the velocity) that keeps a 9 × 11 m window (a phone in portrait fits its width; a wide screen sees most of the L1 garden) clear of the HUD and the controls (`useFittedView`, `shift`), aimed inside the garden. `<TargetMarkers>`: the hive while carrying, the nearest nectar while empty.

HUD: the shell's chips (score, time, Nectar x/3, Stamina x/100).

## Known issues

- `spiderWeb.glb` has patchy strands (spec: `spiderWebFrame` regeneration is on the still-needed list); the ground ring carries the hazard's footprint until then.
- The bee is one mesh: wings do not flap (spec: `hover` and bank carry the life).
