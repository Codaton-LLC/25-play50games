# Postman 3D

Game 50 · points · difficulty 2 · collection skill · owner claude (built by Codex, gated by Claude 2026-10-26). Spec: `docs/menu1-new/specs-41-50.md` §50.

Walk a small neighbourhood with a mailbag. Each item on today's list shows a house number and its colour; letters go in that house's mailbox, parcels to its front door (one parcel in the hands at a time). An empty bag means a trip back to the post office counter. Later streets add yard dogs, traffic and three lives.

## Controls and timing (one set for keyboard and touch)

- WASD / arrows or the joystick through `inputToWorld`; the robot-collector on-foot mover: accel 22 m/s², brake 28 m/s², top 4.6 m/s, × 0.85 with a parcel. Radius 0.38.
- E / Enter or the touch Deliver (`actionPressed`, one per press) within 1.2 m: the nearest mailbox or door, or the post-office counter (refill).
- A wrong mailbox / door: 0.40 s stun, the item stays in the bag. A dog: 0.60 s stun, 0.80 s mercy, no life. A car (L4–L5): a life and a 0.60 s stun. Cars stop before the zebra while the postman is on it.
- Nothing in the rules depends on the device (`rules.test.ts` "keyboard and touch").

## Rules

`rules.ts` (pure, seeded): `streets` streets 20 m apart, `housesPerStreet` houses on both sides (8 m apart; solid 5 × 3 m), mailbox 4 m off the street centre, door 3 m behind it. The seed picks which houses get mail (a seeded subset kept in route order, so following the list is a sane serpentine route), the colours, the dog yards (never the first stop's) and the car starts. Letters come first in the list, then parcels. The bag holds `bagCap` letters; a refill tops it up and takes one parcel if the hands are free.

Score: +100 per delivery, +40 if it was the next item on the list, and on the win +5 per full second left. Each item pays once. Win: every item delivered. Lose: lives 0 (L4–L5). Timeup: the shell clock.

`syncStore` writes score / Delivered / Bag only when they change, a life on the frame it is lost, and the end.

## Levels

| L | Title | Streets × houses | Letters + parcels | Bag | Dogs | Traffic | Markers | Clock | Lives | Look | Limits (max / base / pps) |
|---|---|---|---|---:|---:|---|---|---:|---|---|---|
| 1 | Small Street | 1 × 6 | 4 + 0 | 4 | 0 | — | yes | 120 s | — | day | 1165 / 560 / 115 |
| 2 | Neighborhood | 2 × 6 | 4 + 2 | 4 | 0 | — | yes | 150 s | — | day | 1545 / 840 / 38 |
| 3 | Village | 2 × 8 | 6 + 2 | 6 | 2 | — | no | 180 s | — | sunset | 1965 / 1120 / 36 |
| 4 | City District | 3 × 8 | 7 + 3 | 4 | 2 | 3 cars, 4.0 m/s | no | 180 s | 3 | day | 2105 / 1400 / 13 |
| 5 | Holiday Rush | 3 × 10 | 10 + 4 | 5 | 3 | 4 cars, 4.5 m/s | no | 210 s | 3 | night, holiday lights and trees | 2655 / 1960 / 8 |

All levels: `minDurationMs` 4000, `maxDurationMs` = the clock. Only a win clears a level (no `clearScore`).

## Server limits and why they hold (one proof per level)

Score sources (`rules.ts`): a delivery 100 (`PAY`), +40 in list order (`ROUTE_BONUS`), each item once, so `Bobj = 140 × items` (560 / 840 / 1120 / 1400 / 1960); the win bonus `5 × floor(D − t)` (`WIN_PER_SECOND`), once. A run ending at t scores at most `Bobj` (no win) or `Bobj + 5 floor(D − t)` (a win at t). With `base = Bobj` the rate line holds for every win at t ≥ M when `pps ≥ 5 (D / M − 1)`; the peak is `Bobj + 5 floor(D − M)`.

M (the earliest win) is 0.8 × the fastest win of the oracle (crosses roads anywhere the lane is clear, tight margins) and the careful bot (crosses straight over at the zebra or an alley, wider margins, waits for a clear lane) over 200 seeds each at 30 / 60 / 144 Hz.

| L | D (s) | fastest bot win (s) | M (s) | peak | maxScore (+3 %) | pps needed | pps | oracle best | best / max | careful bot clears |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 6.54 | 5.23 | 1130 | 1165 | 109.7 | 115 | 1125 | 97 % | 200 / 200 |
| 2 | 150 | 22.43 | 17.95 | 1500 | 1545 | 36.8 | 38 | 1475 | 95 % | 200 / 200 |
| 3 | 180 | 28.23 | 22.59 | 1905 | 1965 | 34.8 | 36 | 1875 | 95 % | 200 / 200 |
| 4 | 180 | 64.22 | 51.37 | 2040 | 2105 | 12.5 | 13 | 1975 | 94 % | 200 / 200 |
| 5 | 210 | 108.45 | 86.76 | 2575 | 2655 | 7.1 | 8 | 2465 | 93 % | 200 / 200 |

L5 / L1 = 2655 / 1165 = 2.28 (≤ 3). Codex's limits (pps 50–110 on every level) were far looser; the spec's sketch (M 28–100 s) was too tight for L1–L3 (the oracle wins L1 in 6.5 s).

Tests: `proof.level-N.test.ts` (the arithmetic, the careful bot ≥ 99 % clears on 200 seeds and never faster than M, idle on 200 seeds through the rules and 5 through the store, input and Deliver spam) and `oracle.level-N.test.ts` (the oracle on 200 seeds inside the limits, never faster than M, best ≥ 90 % of maxScore); bots in `testing/bots.ts`, all through `createArcadeStore` + `simulateRun`. `rules.test.ts`: determinism, the generator on 200 seeds per level, every scoring event, refill, dogs, cars, the zebra, the mover, fairness, the camera sightline over the bungalows. `levels.test.ts`: declarations, per-level specs, monotone difficulty, every level read. `assets.test.ts`: every GLB's bounds and fit, decor, the fog at the fitted camera distance on 390 × 844 and 1280 × 800. `postman.test.ts`: the auto-rig checks on the real mesh. Mutation probes on every level read in `rules.ts`, `index.tsx`, `meta.ts` and `looks.ts` fail the tests.

## Look and models

Adopted from `menu1-postman-3d/` (all fitted from measured bounds, `assets.test.ts`): `charPostman` (1.78 m, core auto-rig with `POSTMAN_LANDMARKS`, walk on `gaitPhaseStep`, reach on Deliver, carry with a parcel, cheer on the win; mailbag on the hip through `attach`), `houseA/B/C` (5 × 3 m, instanced per type and row: two storeys, 3.6 m, on the north row; 1.95 m bungalows on the camera side so the camera sees over them to their doors), `mailbox` (1.1 m), `postOffice` (4.2 × 2.5 × 3.4 m), `postVan` (4 m, solid), `streetLampVictorian` (3 m, lit at night), `bicycle` and `holidayTree` (decor fitted to 1 m, placed by spot scale; the trees on L5 only), `letter` (the delivery puff asset). Shared: `picketFence` (front yards, 0.6 m), `trafficLight` (L4–L5 at the zebra), `dog` (menu1-dog-park-fetch, `shared/dog.glb`, tinted per yard, `hop`). Core: kit `<Parcel>`, `REUSED_ASSETS.door`, `bench`, `car` (one pool). Skipped: `postman-3d/hero.glb`.

Camera: a follow camera at 66° pitch (steeper than the spec's 52°, so no bungalow hides the postman at a south-row door: `rules.test.ts` "sightline"), 2 m look-ahead, a 12 × 12 m window kept clear of the HUD and the controls (`shift`). The fog starts past that window at whatever distance the camera was fitted to (`fogFor`). House plates are one canvas atlas on one non-indexed mesh, leaned back to face the camera, 0.9 × 0.75 m. Ground: a 300 m lawn under the fog, roads with dashes, pavements and kerbs, front paths, the zebra.

HUD: the shell's chips (score, time, lives on L4–L5, Delivered, Bag) and the game's route panel (next three items: number, colour, letter / parcel). `<TargetMarkers>` and a ground ring on the next address on L1–L2 only.

## Known issues

- Front-yard fences are visual only (low, 0.6 m): the postman walks through them.
- The holiday lights are emissive spheres along the house fronts (the spec's emissive strings).
- The spec still lists `holidayTree` as needed; it is in the ready folder now and adopted.
