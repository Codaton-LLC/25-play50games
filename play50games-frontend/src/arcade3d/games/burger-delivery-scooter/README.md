# Burger Delivery Scooter

Game 33 (Menu 1), points, difficulty 2, collection skill, owner claude (built by Codex, gated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-31-40.md` §33. Status `dev` (hidden), `enabled: false` in `arcade-games.json`.

## Play

W / Up accelerates, S / Down brakes then reverses, A / D steers, Space or the touch Hop hops. Stop on the pink ring at the burger shop (south-west corner) to load an order (quality 100), ride to the green door ring and stop there; then back to the shop for the next one. A stop is 0.45 s under 0.5 m/s inside 1.1 m, the same for every input.

- Street-vehicle integrator (spec "Street vehicles"): top speed 11, accel 14, brake 16, reverse 2.5, steer 2.6 rad/s × turnScale `clamp(|speed| / 2, 0.35, 1)`, drag 0.35, radius 0.55, dead zone 0.2 on both axes, run through `createFixedStep(1/120)` so 30 / 60 / 144 Hz play the same (`rules.test.ts`). A standing scooter does not turn.
- Buildings are solid; the scooter slides along them, a head-on hit stops it (no quality cost).
- A barrier hit costs 12 quality at any speed and bounces the scooter (-0.3 × speed); a hop (0.40 s, 0.15 m visual lift) ignores barriers in its middle 0.20 s and costs nothing. Barriers stand 1.9 m off the x-street centre lines, so a scooter on the line passes them.
- Parked cars stand at the curb of the z streets (mid-block, clear of the centre line and every pad): a hit above 3 m/s costs 12 and bounces, a slower one only stops you.
- Wet patches (L4, L5) drain 4 / 5 quality per second while carrying; they cross the x streets mid-block and never touch a pad.
- Quality 0 = a miss: one life, quality back to 100, the same door stays and its order clock keeps running. Three misses lose.
- A delivery pays `floor(quality)` + 40 within 25 s of loading. The average counts successful drops only. All orders delivered at or above the level's quality line wins (+4 per full second left); under it loses at once. Partial scores rank; only a win clears.

## Levels

| L | Title | Grid | Orders | Barriers | Cars | Wet | Line | Clock | Light | maxScore | base | pps |
|---|---|---|---:|---:|---:|---|---:|---:|---|---:|---:|---:|
| 1 | Neighborhood | 2 × 2 | 3 | 2 | 0 | no | 80 | 120 s | day | 810 | 420 | 15 |
| 2 | City Center | 2 × 3 | 4 | 4 | 2 | no | 80 | 150 s | day | 1000 | 560 | 10 |
| 3 | Park District | 3 × 2 | 5 | 6 | 3 | no | 75 | 180 s | sunset | 1230 | 700 | 10 |
| 4 | Rainy City | 3 × 3 | 6 | 6 | 4 | 4 / s | 70 | 180 s | sunset | 1270 | 840 | 6 |
| 5 | Night Delivery | 3 × 3 | 8 | 8 | 6 | 5 / s | 70 | 210 s | night | 1580 | 1120 | 5 |

`minDurationMs` 4000 and `maxDurationMs` = the clock on every level. The seed shuffles the door order, the barrier lanes and the car slots; the doors are always the farthest intersections from the shop.

## Server limits and why they hold

Score sources (constants in `rules.ts`): each of the N order slots pays once, at most `floor(100) + 40 = 140` (a retried slot pays once: `limits.levels-4/5` wetRetry), so before a win the score is at most `140 N = base`. A win adds `4 × floor(D − t)`, largest at the earliest win.

Earliest win (`levels.test.ts` `levelBound`, recomputed on every run): the shortest route around the blocks grown by the scooter radius (visibility graph) from the shop to each door, `2 Σ d − max d` for the 2N − 1 legs, minus 2.2 m of pad radius per leg; over that distance at no more than 11 m/s, plus per leg the time to accelerate from 0.5 to 11 and brake back (`(10.5² / 22)(1/14 + 1/16)`, less 0.05 s), plus 0.45 s at each of the 2N stops. Corners, hazards and drag only add time. Bound and limits per level:

| L | earliest win ≥ | raw ≤ | maxScore | base + pps × t at the earliest win | oracle best (200 seeds) | greedy clears |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 26.75 s | 792 | 810 | 821 | ~772 (95 %) | 200 / 200 |
| 2 | 45.38 s | 976 | 1000 | 1014 | ~936 (94 %) | 200 / 200 |
| 3 | 53.83 s | 1204 | 1230 | 1238 | ~1160 (94 %) | 200 / 200 |
| 4 | 78.54 s | 1244 | 1270 | 1311 | ~1152 (91 %) | ≥ 198 / 200 |
| 5 | 100.11 s | 1556 | 1580 | 1621 | ~1435 (91 %) | ≥ 198 / 200 |

The margin over the bound is 1.5–2.5 % (rounded up to 10): the bound is already 8–10 % above what the oracle bot reaches, so a larger margin would make the limit loose. After the earliest win the bonus falls and `base + pps × t` rises. `capScore` is a no-op for every bot run.

Bots (`testing/bots.ts`, `limits.levels-N.test.ts`): oracle (corner speed 7, brake 15.5, early turn-in), greedy (a careful human: 9 m/s, corners at 3.2), idle and input spam, through `createArcadeStore` with the Scene's store calls at 30 / 60 / 144 Hz and random frames (12 seeds each), plus 200-seed sweeps on the rules alone (the fixed-step integrator makes them equal; `rules.test.ts`). Idle and spam never score or clear.

## Models

The ready `menu1-burger-delivery-scooter` GLBs, fitted from measured bounds (`assets.ts`, checked on the real meshes in `assets.test.ts`): rider `charScooterRider` 1.70 m through the core auto-rig (measured `RIDER_LANDMARKS`, `describeCharacter` checks), seated pose by `turnBone` on hips and knees and `aimArm` on the bars; `deliveryScooter` 1.80 m long; `deliveryBoxV2` 0.5 m on the rack; `burgerShopI` (the text-free shop; the spec's `burgerShop` has lettering) 5.6 m wide at its own proportions on the south-west corner of its block; `restaurantCounter`, `burgerBag`, `foodBoxV2` as counter dressing; `roadBarrier` fills the barrier rect; shared `trafficCone` beside each barrier. Core: `REUSED_ASSETS.car` (instance-tinted, fills the car rect), `lamp`, `bench`. Dressing is fitted to 1 m and sized once by its spot. The other blocks are low code-built town buildings (3.0 m: at the 50° chase pitch a wall hides 0.84 × its height of street, under the 3 m half street), a ring of them outside the city so the streets never end in a void.

## Known issues / for the playtest

- Facings were set from the bounds only (no render in the gate fork): check the scooter's nose (+z), the counter's front (turned to face the west street), the bench and the rider seated on the saddle (group offset -0.15 m; the seated pose is game-local, core has no `sitPose`).
- `deliveryBoxV2` is a rolling cooler and `restaurantCounter` carries "FASST" lettering (spec "still needed": `scooterDeliveryBox`, `restaurantCounterPlain`; the ledger's `scooterDeliveryBox` / `foodBoxClosed` regenerations were rejected).

## Clarity (2026-10-28, visual only)

`guide.ts` (pure, `guide.test.ts`) picks the goal: the pink shop while the box is empty, the active customer's door while carrying. Core `TargetBeacon`s: a pink "SHOP" pick arrow and ring, a green "DROP" drop-here ring on the door (the edge `TargetMarkers` arrow stays). The core `HintLine` (in `Hud.tsx`) says "Drive to the pink shop ring and stop on it", "Order 2 of 4: stop on the green ring (arrow), slowly". A bump pops "Bump! -12" and a ruined order "Burgers ruined! -1 life" (`useActionPop`, same 0.15 / 0.3 shakes); the bag hops from the shop counter into the scooter's box and, at the door, from the box onto the pad (`<Toss>`, 0.4 s). Rules, scoring and limits are unchanged.
