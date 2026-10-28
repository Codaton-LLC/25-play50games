# Taxi Rush 3D

Game 32 · points · difficulty 2 · collection skill · owner cursor (built by Cursor, gated and integrated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-31-40.md` §32.

Drive a cab on a street grid. Stop in the gold pad to pick a rider up, stop in the next pad to drop them off. Red lights and hard hits cost lives; every fare has a patience meter.

## Rules (`rules.ts`, pure and seeded)

- Street-vehicle integrator in fixed 1/120 s steps (`createFixedStep`), so 30 / 60 / 144 Hz drive the same: top speed 9, accel 12, brake 18, reverse 3, drag 0.4, steer 2.2 rad/s × `clamp(|v| / 2, 0.35, 1)`, throttle / brake dead zone 0.2, radius 1.15.
- Grid: 14 m blocks, 6 m streets, building boxes inset 0.4 m. Pads sit on the vertical streets' centres between junctions, ≥ 16 m apart.
- A stop completes after 0.50 s inside the pad (2.2 m) under 0.5 m/s, on any device.
- Patience starts at 1 when a fare appears and falls `patienceDrain` per second; at 0 the fare is missed (a life) and the next fare starts. No fare past the quota.
- Traffic: `traffic` cars on the one-way perimeter loop at `trafficSpeed`, stopping at their red lights, behind each other, and for a cab ahead of them going their way or stopped in their lane.
- Lights: `lights` junctions, north–south green 4 s / red 4 s, offset 1.7 s per light. Crossing a red stop line above 1 m/s spends a life.
- A wall or a car hit above 3 m/s spends a life and bounces the cab (−0.3 × speed); a slower touch only nudges. 0.8 s lock after a hit. Three lives.
- Score: +100 per drop-off, +60 if it stopped within 1.2 m of the pad centre, +40 if patience was still above 0.5; on the win +5 per full second left.

## Levels

| L | Title | Grid | Fares | Lights | Cars (speed) | Patience / s | Clock | Look | Limits (max / base / pps) |
|---|---|---|---:|---:|---|---:|---:|---|---|
| 1 | Quiet Neighborhood | 2 × 2 | 3 | 2 | 2 (3.5) | 0.012 | 120 s | day | 1075 / 600 / 15 |
| 2 | Downtown | 2 × 3 | 4 | 3 | 3 (4.0) | 0.014 | 150 s | day | 1390 / 800 / 15 |
| 3 | Shopping District | 3 × 3 | 5 | 4 | 5 (4.5) | 0.016 | 180 s | sunset | 1655 / 1000 / 11 |
| 4 | Night City | 3 × 3 | 6 | 5 | 6 (5.0) | 0.018 | 210 s | night | 1950 / 1200 / 10 |
| 5 | Rush Hour | 3 × 4 | 8 | 6 | 8 (5.5) | 0.020 | 250 s | sunset | 2400 / 1600 / 8 |

Gate change: the spec's clocks were 180 s (L4) and 210 s (L5). The careful-driver bot needed up to 179 s on L4 and did not finish 14 of 100 L5 seeds in 210 s, so L4 is 210 s and L5 250 s (the time per fare still falls level by level: 40 / 37.5 / 36 / 35 / 31.25 s). All levels `minDurationMs` 4000. Only a win clears a level.

## Server limits and why they hold (one proof per level)

| Source | Value | Bound |
|---|---|---|
| Drop-off | 100 (`DROP_POINTS`) | one per fare, `rides` fares |
| Close stop | 60 (`CLOSE_POINTS`) | once per drop-off |
| Calm fare | 40 (`CALM_POINTS`) | once per drop-off |
| Win bonus | 5 × floor(time left) (`TIME_POINTS`) | once, only on the win |

`Bobj = 200 × rides`. A run that loses or times out holds at most `Bobj = base`. A win at `t` holds at most `Bobj + 5 floor(D − t)`, largest at the earliest win `M`; the rate line holds for every `t ≥ M` when `pps ≥ 5 (D / M − 1)`. `M` = 0.8 × the fastest win of the oracle and the honest bot over 200 seeds each at 30 / 60 / 144 Hz (a better route than the bots' still fits). maxScore = peak + about 3 %.

| L | D (s) | fastest bot win (s) | M (s) | peak | maxScore | pps needed | pps | oracle best | best / max | honest wins |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 39.37 | 31.5 | 1040 | 1075 | 14.05 | 15 | 1000 | 93 % | 200 / 200 |
| 2 | 150 | 48.92 | 39.14 | 1350 | 1390 | 14.16 | 15 | 1305 | 94 % | 200 / 200 |
| 3 | 180 | 73.14 | 58.51 | 1605 | 1655 | 10.38 | 11 | 1530 | 92 % | 200 / 200 |
| 4 | 210 | 88.97 | 71.18 | 1890 | 1950 | 9.75 | 10 | 1805 | 93 % | 200 / 200 |
| 5 | 250 | 129.28 | 103.42 | 2330 | 2400 | 7.09 | 8 | 2200 | 92 % | 199 / 200 |

L5 / L1 = 2400 / 1075 = 2.23 (≤ 3). The helper's `finalScore` cap was removed: no score is clamped, the proof holds by itself.

Bots (`testing/bots.ts`, through `createArcadeStore` + `advanceRunClock` like the canvas): a junction-graph route (the perimeter loop one-way, with the traffic) driven by pure pursuit with a speed plan (corners at a turnable speed, walls and the last metres to the pad under the strike speed, red stop lines crossed under 1 m/s, under the strike speed near cars, behind cars going its way, passing oncoming cars on the inside of the street). The honest bot is the oracle with wider margins (corner 3.8 vs 4.2 m/s, braking 9 vs 11 m/s², pad approach 2.6 vs 2.9 m/s). `proof.level-N.test.ts` (one level per file): the arithmetic; honest bot ≥ 99 % clears over 200 seeds, inside the limits, never faster than `M`; the oracle inside the limits, best ≥ 90 % of maxScore; idle never clears and scores 0; stick spam inside the limits. Mutation probes on every level read in `rules.ts`, `index.tsx`, `meta.ts` and `looks.ts` fail the tests (`levels.test.ts` checks each level's grid, fares, lights, cars, traffic speed and patience drain).

## Look and models

All `menu1-taxi-rush-3d` GLBs are adopted (`public/models/3d/taxi-rush-3d/`: `taxiCab`, `townhouseBlock`, `cornerShop`, `busStop`) plus the shared ready `trafficLight` and `trafficCone` (`public/models/3d/shared/`) and the shared `travellerNpc` already on main. Fits are in `assets.ts` from the measured bounds (`GLB_SIZE`), checked on the real meshes (`assets.test.ts`):

- the cab 2.8 m long along +z (its collision circle 2.3 m), the rider 1.75 m (unrigged NPC, untinted, a hop on pickup), traffic = the pigeon-crossing car stretched to the rules' 3.10 × 1.40 m body, tinted per copy in one pool;
- the city: every block has 12 building cells flush inside the rules' building box (a corner cell on each corner, two along each side), all at most 3.2 m tall so a 48° camera never loses more than 3 m of street behind them. On the playable blocks two cells are Hyper3D GLBs (a corner shop and a townhouse; the first block a bus stop instead), plus a lamp and a courtyard tree; every other cell, and the whole ring of blocks round the grid, is a code box (12 triangles: three facade tones over one window texture, a slate roof cap). The GLB city pieces are fitted to 1 m and placed by their spot's scale (never scaled twice);
- triangle budget (playtest 2026-10-26: the first city drew 760k-1.44M triangles a frame): now 98k / 130k / 174k / 186k / 230k on L1-L5 with every decor copy drawn, pinned at <= 250k by `assets.test.ts` from the GLBs' own index counts x copies plus the code geometry. The GLBs are 1.5-3k triangles each (the traveller 18k) and are not re-optimized here, so the budget comes from fewer copies;
- the road: a dark-grey asphalt with a fine grain (canvas texture, never black; lighter under the night level's dim light), white centre dashes, zebra crossings on every approach of the playable junctions and white stop bars at the lit ones;
- two traffic-light poles per lit junction (the north–south and the east–west signal, a 0.15 m red / green bulb each), two cones on the other corners, the gold pad ring.

Camera: a chase camera (pitch 48°, yaw 0.35, 3 m look-ahead along the travel direction) that keeps an 18 × 18 m street window clear of the HUD and the stick (`useFittedView`, `shift`), aimed inside the grid. `<TargetMarkers>` on the active pad. HUD: the shell's chips (score, time, lives, Rides x / n, Fare 0–100).

## Known issues / playtest checks

- Facing of the GLBs is assumed +z (cab nose, shop and house fronts toward the street); check in the playtest.
- `travellerNpc` is photoreal with hands in pockets (spec: `passengerNpc` still needed).
- A head-on car that meets a cab stopped in its lane waits for it; the cab passes it on the inside of the street (the bots do the same).

## Camera views

Tap 📷 or press **C** (**T** also cycles): Classic (the existing fitted follow camera) / Front / Top / Free. A separate chase view is omitted because Classic already follows the vehicle. WASD / arrows and the joystick keep steering the vehicle in every view.

Drag on empty canvas (one or two fingers on touch) to orbit in Free; wheel / pinch zooms. Q / Z turn left, X turns right, R / F tilt, V recenters. No camera keys conflict with game controls. The core camera button stays at the bottom right, clear of the shell chips and joystick.

Both subject and steering are `vehicle`. Camera collision uses the existing building AABBs. Top distance is 20 m (below the 45 m fog start). No fitted-pitch labels or view-based scene culling need adjustment. Browser checks, including 390 × 844 with the cookie banner, are left to Claude.
