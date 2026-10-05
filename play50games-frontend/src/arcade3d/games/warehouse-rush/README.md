# Warehouse Rush

Owner: Claude. Slug: `warehouse-rush`. Game 6 of the 3D Arcade: the first carry-and-drop game and the first game with an Action button. Status stays `"soon"` until the game is built and reviewed. **This file is the design. There is no scene or rules code yet.** `meta.ts` and the `index.tsx` stub are already on `main`. This prep adds only this README and `assets.spec.json`. The limits in `meta.ts` are correct as they are (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. On `main`, unchanged. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, `Hud`, assets, `durationMs: 60000`, camera, environment, `touchControls: ["joystick", "action"]`, `hudStats`, instructions, `finalScore` (safety net). Stub today. |
| `rules.ts` | Everything that decides the outcome: the warehouse map, the seeded layout and streams, robot movement with the carry speed, pallets and refills, orders, Action handling, scoring, the proof constants. Pure: no three.js, React, DOM, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the fairness checks and the scoring-limit proof below. |
| `Scene.tsx` | The frame loop and the moving things: maps input with the view's yaw, calls `rules.ts`, mirrors the run into the store, draws the robot, boxes, chevrons and popups, places the static fitted camera. |
| `Primitives.tsx` | Warehouse look: floor with the painted zone tiles (canvas texture, drawn per run), walls, the rack and pallet stand-ins (instanced parts), the box stand-in, the robot stand-in, chevrons and popup sprites. |
| `Hud.tsx` / `Hud.module.css` | The order panel ("Deliver BLUE box → Zone B"), marked `data-arcade-safe-area`. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the two props only this game generates. |

The build PR also adds the thumbnail `public/images/3d/warehouse-rush.webp` (640 × 360, rendered from the game).

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, `rules.ts` as pure seeded functions with tests that prove the limits, the run state made once in `useState`, one `useRunFrame` that calls `rules.ts` and then the store, visuals in `useFrame` with `useGameTime()`, the `useFittedView` camera block and `<Model fallback>` / `<InstancedModel>` for models. Games never import each other.
- **This game adds three patterns** (copy, never import):
  1. **Action with a lock.** A press is resolved after the move of that step, and a pick or a drop freezes the robot for a fixed 250 ms of play. The lock is what makes a minimum cycle time provable.
  2. **A game HUD panel fed by numeric stats.** The Scene writes `setStat("order", 0..3)` and friends; `Hud.tsx` maps the numbers to text. The panel has a fixed size and is always mounted, so the camera fit never changes mid-run.
  3. **A tinted shared GLB.** One `useModel` clone per box slot, with one cloned material per colour (same texture, tinted). The core has no per-copy tint for GLB instances yet (Known issues).
- **Do not copy:** the warehouse primitives, the chevrons and the popups. They are decoration for this game.

## Concept

The teal robot from Robot Collector has a new job on the dispatch floor. Four pallets in the middle of a small warehouse hold coloured boxes. An order at the top of the screen says which box to bring where: "Deliver BLUE box → Zone B". Drive to a blue box, press Action to lift it, drive into Zone B (painted blue, with a big B) and press Action again. Right zone +50, wrong zone −20. The next order appears at once, and an empty pallet gets a new box 1.5 s later. The run lasts 60 seconds. The look is the Play50 vinyl-toy style in a warm warehouse, accent `#fb923c` (the rack uprights).

## Controls

Matches `meta.ts` (`scheme: "joystick"`): "WASD to move, E / Space to pick up and drop" and "Joystick + Action button".

- **Keyboard.** WASD or the arrows drive (core `moveX` / `moveY`; diagonals are not faster). E, Enter or Space is Action: the game reads `actionPressed || jumpPressed`, so Space (the core's jump key) works too. Esc or P pauses (GameShell).
- **Touch.** The virtual joystick (bottom left, analog) drives, the Action button (bottom right, 72 px) acts. `touchControls: ["joystick", "action"]`. There is no Jump button and no swipe handling.
- **Screen-relative.** Up always means "away from the camera", also when a portrait phone turns the camera 90° (`inputToWorld(moveX, moveY, view.yaw)` from `core/math`, as robot-collector).
- **One press, one action.** `actionPressed` / `jumpPressed` are one-frame events from a new keydown or a new touch press (auto-repeat does not count, core). E and Space in the same frame give one action. A press during a lock is dropped, not buffered (nothing could use it: the robot cannot reach another pallet or zone during a 250 ms lock).

## Constants

1 world unit = 1 m. All of them live in `rules.ts` and are pinned by a golden test.

| Name | Value |
|---|---|
| Run | 60 s of play (`DURATION_MS` 60000). Only the clock ends a run (`"timeup"`). No lives, no win. |
| Floor | 20 × 12 (`ARENA` halfX 10, halfZ 6). Walls 0.4 thick and 0.9 high, outside the floor. The robot's centre stays in \|x\| ≤ 9.5, \|z\| ≤ 5.5. |
| Robot | radius 0.5. Top speed **6 u/s empty, 5 u/s carrying** (`ROBOT.speed`, `ROBOT.carrySpeed`). Accel 30 u/s², brake 36 u/s², `turnRate` 14/s. Starts at (0, 0), facing the camera. |
| Colours | 0 RED `#ef4444` = zone **A**, 1 BLUE `#3b82f6` = **B**, 2 YELLOW `#facc15` = **C**, 3 GREEN `#22c55e` = **D**. The letter belongs to the colour, so "Zone B" is always the blue zone; where it lies changes per run. |
| Zones | 4 corner squares of 3.5 × 3.5: \|x\| 6.5–10, \|z\| 2.5–6. A drop counts when the robot's **centre** is inside (inclusive), which leaves a 3 × 3 square for the centre. |
| Racks | 2 shelf racks across the middle: centres (±2.8, 0), footprint 3.6 × 0.9 (x 1.0–4.6 on each side), height 1.1. The 2.0-wide gap between them (\|x\| < 1) is where the robot starts. Solid. |
| Pallet slots | 6: x ∈ {−3, 0, 3}, z ∈ {−3.4, +3.4}. Each run uses **2 per row** (4 pallets). Index order: row z = −3.4 first, x ascending. |
| Pallet | 1.2 × 1.2 footprint, 0.18 high, solid (`PALLET_HALF` 0.6). Holds at most one box. |
| Box | the shared crate, drawn 1.0 × 0.71 × 0.96, sitting on the pallet. No collision of its own. |
| Reach | the robot's centre within **0.8** of the pallet's edge (`PICK_GAP`, core `distanceToBoxXZ`). Touching the pallet is 0.5, so driving up to it is enough. |
| Locks | pick `PICK_MS` 250, drop `DROP_MS` 250: the robot stands still and ignores input. |
| Refill | `REFILL_MS` 1500 after each delivery, on the pallet that has been empty longest. |
| Points | +50 right zone, −20 wrong zone, never below 0 (`POINTS`). |

Clearances: neighbouring pallets in a row are 1.8 apart edge to edge and the two reaches need 1.6, so **at most one pallet is ever in reach**. Every zone is at least 2.1 from every reach (`MIN_LEG`, proof step 4), so a pick and a drop are never possible at the same spot. The narrowest passages are the 1.8 between pallets, the 2.0 behind a pallet (z 4.0 to the wall at 6.0) and the 2.0 rack gap, all wider than the robot (1.0).

## The warehouse

Landscape view (the camera is below the picture, at +z). `P` = pallet slot (4 of the 6 are used), `R` = robot start.

```
z = -6    +-----------+---------------------------------------+-----------+
          |           |                                       |           |
          |  zone     |     P            P            P       |   zone    |  pallets z = -3.4, x = -3 / 0 / 3
z = -2.5  +-----------+                                       +-----------+
          |              [====rack====]  R  [====rack====]                |  racks z = 0, |x| 1.0 .. 4.6
z = +2.5  +-----------+                                       +-----------+
          |  zone     |     P            P            P       |   zone    |  pallets z = +3.4
          |           |                                       |           |
z = +6    +-----------+---------------------------------------+-----------+
        x = -10     -6.5                                     6.5         10
```

Going from one half to the other means passing the racks: through the middle gap or around their outer ends (open floor from \|x\| 4.6 to the side walls between the zones). So the nearest box of the ordered colour is not always the fastest one, which is the routing choice the game is about.

## Rules

### Seeds and streams

- Scene draws a new seed with `randomSeed()` in its lazy `useState` initializer. GameShell remounts the Scene (`key = runId`) on start, retry and restart, so every run has its own seed.
- `createRun(seed)` keeps three `rngNext` states (core `math.ts`, the closure-free mulberry32) in the run object:
  - **layout** `{ s: seed }`: the zone permutation (Fisher–Yates, 3 draws: which colour sits in which corner), then for each row the one slot it leaves out (2 draws). 24 × 9 = **216 layouts**.
  - **boxes** `{ s: (seed ^ 0x9e3779b9) >>> 0 }`: the colours of the 4 starting boxes (pallets in index order), then one draw per refill. Colour = `floor(r · 4)`.
  - **orders** `{ s: (seed ^ 0x85ebca6b) >>> 0 }`: one draw per order (below).
- The same seed and the same inputs always give the same run. The layout and the sequence of box colours never depend on the player. Orders depend only on which pallets are occupied at each draw.

### Pallets, boxes and refills

- At the start all 4 pallets hold a box. From then on **boxes in play (on pallets or in the grip) + pending refills = 4**, always: a pick moves a box from a pallet to the grip, a delivery turns it into a pending refill, a refill puts a new box on a pallet.
- A delivery schedules a refill at `simMs + 1500`. It lands on the first step whose `simMs` reaches that time, before the robot moves in that step, on the empty pallet with the oldest `emptiedAt` (ties: lower index), with the next colour from the box stream. An empty pallet always exists then: empty pallets = carried + pending ≥ 1.
- **At most 2 refills are ever pending.** Deliveries are at least 1270 ms apart (proof step 5), so a 1500 ms window holds at most 2. Right after a delivery the grip is empty, so **at least 2 pallets hold a box** at every order draw.
- The new box pops in on its pallet (scale 0 → 1 over 0.3 s, visual only). It can be picked from the step it lands.

### Orders

- An order is one colour: its box and its zone. `createRun` draws the first one (it is on screen during the countdown). Every delivery, right or wrong, draws the next one **in the same step**.
- A draw takes the occupied pallets in index order and picks the k-th, `k = floor(r · occupied)`. So the ordered box exists at the moment of the draw, and a colour on two pallets is twice as likely.
- **The order is always reachable.** From the draw to the next delivery a box of the order colour is on a pallet or in the grip: only order-coloured boxes can be picked (next table), a box leaves the grip only by a delivery (which draws a new order), and refills add boxes but never remove one.

### Action

Action = `actionPressed || jumpPressed`. It is handled after the move of the step, at the robot's new position. At most one row applies (one pallet in reach at most, zones far from every reach).

| The robot | Where | What happens |
|---|---|---|
| empty-handed | in reach of a pallet whose box has the order colour | **Pick.** The box goes to the grip, the pallet is empty (`emptiedAt = simMs`), lock 250 ms. |
| empty-handed | in reach of a pallet with another colour | **Refused.** That box shakes ("Not on the order"). No lock, no score, no sound. |
| carrying | centre inside a zone | **Deliver.** Zone colour = order: +50, else −20 (floor 0). The box is consumed, a refill is scheduled, the next order is drawn, lock 250 ms. |
| any | anywhere else | Nothing. |

There is no dropping on the floor and no putting a box back: the carried box is always the ordered one, so the only decision left is the zone. That keeps the card's promise ("Right box, right zone"): the wrong box costs the drive to it, the wrong zone costs 20 points.

### One step

`step(run, dirX, dirZ, press, dtSeconds)` runs once per `useRunFrame`. Scene passes the input already mapped with `inputToWorld(moveX, moveY, view.yaw)`. A step with dt ≤ 0 does nothing.

1. `simMs += dt · 1000`.
2. Land every due refill.
3. **Lock:** if `lockMs > 0`, then `lockMs = max(0, lockMs − dt · 1000)`, the velocity is set to 0, input and presses are ignored, and the step ends. A lock therefore covers whole steps: at least 250 ms of play without any movement.
4. **Move:** the robot-collector movement, with the top speed of the carry state (6 or 5). Racks and pallets push the robot out (`resolveSphereAabb`), the walls keep it in (`clampToBounds`), then the **speed guard** scales the step back so it never moves more than `speed · dt`, whatever the pushes did. The velocity is what really happened. The robot turns to face where it goes.
5. **Act** on a press (table above).

The step reports what happened through counters on the run (picks, deliveries, right ones, wrong ones, refusals, the last change of the score, the zone). Nothing is allocated. After the step, Scene mirrors the run into the store only when a value changed: `setScore(run.score)`, `setStat("delivered", right)`, `setStat("order", colour)`, `setStat("carry", 0 | 1)`, `setStat("drops", all deliveries)`, `setStat("delta", last change)`. Scene never calls `addScore`, so the HUD can never drift from the rules. Sounds: pick `"jump"`, right `"pickup"`, wrong `"hit"`.

### Fairness

- **Every layout is solvable.** The racks, pallet slots and zones are fixed shapes, and the free space for the robot's centre is one connected region in all 216 layouts (flood fill on a 0.1 grid). Every reach and every zone lies in it. With the invariant above, every order can be finished.
- **Every layout is about as hard as every other.** The 16 shortest pallet-to-zone legs (grid paths for the robot's centre around the racks and pallets) average **6.55–6.56** in all 9 pallet sets (shortest 2.2, longest 10.4, design prototype). The zone permutation only relabels the colours. The test pins the band 6.3–6.8.
- **Orders add luck, within a band.** The order stream decides how far each order sends the robot. A perfect-play bot over 300 seeds (prototype, below) scores 800–1050 around a median of 900, that is −11% / +17%. The test pins the spread (every one of 1000 seeds within 20% of the median) so a later change cannot make some seeds much easier unnoticed.
- **Readable on a phone.** Every box has its zone letter on the lid and every zone has a big letter on the floor, so colour-blind players match letters. While the robot is empty-handed, a bobbing chevron stands over every box of the order colour. While it carries, the border of the target zone pulses. The whole warehouse is always on screen (static camera, below).

## Scoring

| Event | Points |
|---|---|
| Right zone (zone colour = order) | +50 |
| Wrong zone | −20, never below 0 |

`score = right ? score + 50 : max(0, score − 20)` after each delivery. The score is always a multiple of 10. Examples: 14 right deliveries, then 2 wrong ones: 700 − 40 = **660**. Two wrong ones first, then 14 right: 0, 0, then **700** (the floor ate the penalties). The HUD shows Score and Delivered (right deliveries only). GameShell submits the store's score with `elapsedMs`, which is exactly 60000 at the time-up (core).

`index.tsx` sets `finalScore: (s) => ({ score: capScore(s.score, s.elapsedMs), durationMs: s.elapsedMs })`. That is `min(score, 3000, floor(50 · round(e) / 1000))`, the robot-collector safety net, and the tests prove it never changes a reachable score.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 3000, `base` 0, `maxPointsPerSec` 50, duration 5–75 s. The server accepts a run only if:

- `score <= 3000`
- `5000 <= duration_ms <= 75000`
- `score * 1000 <= 50 * duration_ms`, that is, `score <= 50 · t` with t = duration_ms / 1000

1. **Duration.** A ranked run ends only on the clock: there are no lives and no win, and `end("quit")` is never ranked or sent. The clock ends the run with `elapsedMs` exactly 60000 (`play()` in `core/useArcadeStore.ts`), so every submission has `duration_ms = 60000`, inside 5000–75000, and the cap is 50 · 60 = 3000 = `maxScore`. So it is enough to show score ≤ 3000. The steps below show more: **score ≤ 50 · t at every moment t of play**, so the limits would still hold if a later version ended runs early (from 5 s on).
2. **Clock.** `useRunFrame` hands the game exactly the play time `RunClock` counted in that frame, including the rest of the frame in which the countdown ends (core). Pause stops both. Locks cover whole steps and the robot moves only in the other steps, so for any span of play, moving time + lock time ≤ the play time that passed.
3. **Speed.** The speed guard caps every step at 6 · dt empty-handed and 5 · dt carrying (the carry state is fixed during the move; a pick or a drop happens after the move). So driving a distance L takes at least L / 6 s, and at least L / 5 s with a box.
4. **Distances.** `MIN_LEG` = **2.1**: the closest any reach comes to any zone. A side pallet's edge is at \|x\| 3.6, its reach ends at 4.4, the zone starts at 6.5 (their z ranges overlap). Every other pallet-zone pair is farther apart. Obstacles only make real paths longer. From the start (0, 0): 2.0 to the reach of a middle pallet, 2.888 to the reach of a side pallet (to its corner at (2.4, 2.8), minus 0.8).
5. **One cycle ≥ 1270 ms** (`CYCLE_MIN_MS`). Take two deliveries at t_k and t_k+1. The grip is empty after t_k, so the box delivered at t_k+1 was picked after t_k, at some pallet P. There is exactly one such pick p: a carried box leaves the grip only by a delivery. In this order, and without overlap, the robot needs:
   - the drop lock after t_k: ≥ 250 ms, no movement;
   - a drive from inside zone Z_k (where it dropped) to the reach of P: ≥ 2.1 at ≤ 6 u/s, **≥ 350 ms** (detours and refused presses only add time);
   - the pick lock after p: ≥ 250 ms;
   - a drive with the box from the reach of P into zone Z_k+1: ≥ 2.1 at ≤ 5 u/s, **≥ 420 ms**.

   So t_k+1 − t_k ≥ 250 + 350 + 250 + 420 = **1270 ms**. Wrong deliveries need the same cycle, so the bound counts every delivery.
6. **First delivery ≥ 1151.3 ms** (`FIRST_DELIVERY_MIN_MS`). The same argument from the start, with p the one pick before the first delivery, at pallet P: a drive at ≤ 6 u/s from (0, 0) to the reach of P, then the pick lock, then the carry into a zone at ≤ 5 u/s. Over the pallets: a side pallet gives 2.888 / 6 + 0.25 + 2.1 / 5 = **1.1513 s**, a middle pallet 2.0 / 6 + 0.25 + 5.1 / 5 = 1.603 s.
7. **The bound.** The k-th delivery comes at t ≥ 1.1513 + 1.27 · (k − 1) s, so N(t), the number of deliveries by t, is at most `1 + floor((t − 1.1513) / 1.27)` (0 before 1.1513 s). The score is at most 50 · N(t): +50 adds 50 to both sides, and `max(0, s − 20)` never raises a score that is ≥ 0. Earliest possible score against the cap:

| Delivery k | Earliest time (bound) | Score at most | Cap floor(50 · t) |
|---|---|---|---|
| 1 | 1.151 s | 50 | 57 |
| 2 | 2.421 s | 100 | 121 |
| 4 | 4.961 s | 200 | 248 |
| 5 | 6.231 s | 250 | 311 |
| 10 | 12.581 s | 500 | 629 |
| 20 | 25.281 s | 1000 | 1264 |
| 40 | 50.681 s | 2000 | 2534 |
| 47 | 59.571 s | **2350** | 2978 |

   The 48th delivery would come at ≥ 60.84 s, after the time-up. So **score ≤ 2350** (`SCORE_BOUND`), under `maxScore` 3000. The rate 50 · N(t) / t is largest at the first possible delivery, 50 / 1.1513 = **43.4 points/s**, and falls towards 50 / 1.27 = 39.4 points/s. It stays under 50 at every t. By 5 s at most 4 deliveries (200 points) are possible.
8. **The integer check** at `duration_ms` = 60000: 2350 · 1000 = 2,350,000 ≤ 50 · 60000 = 3,000,000. ✓

**The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.** They leave room: a 3000 cap with base 0 and 50/s fits a 60 s game whose bound is 2350.

### What real play scores (design prototype)

A prototype of these rules (same map, streams and refills; shortest grid paths around the racks and pallets; each leg timed from rest with the real speeds and acceleration; both locks) played 300 seeds:

- **Perfect play** (always the order box with the fastest pick-and-carry route, no reaction time): 800–1050 points, median 900, that is 16–21 deliveries. The shortest real cycle was 1490 ms (bound 1270) and the earliest first delivery 1732 ms (bound 1151).
- **Human-like** (legs 25% slower, 0.3 s to react before each leg): 600–750.
- At least 2 pallets held a box after every delivery, as step "Pallets, boxes and refills" says.

Expect top human scores around 800–950. The test's path-following bot (real `stepRobot`, 60 fps) repeats the perfect-play check with the real rules.

## Scene and camera

- **Static fitted camera.** The camera looks three-quarter top-down, tilted 56° (`PITCH`, as robot-collector), and does not follow the robot. Every zone letter and every box stay on screen and in the same place for the whole run.

```ts
const PITCH = (56 * Math.PI) / 180;
const LOOK_AT: [number, number, number] = [0, 0, 0];
/** floor + walls; y up to 1.2 covers the racks (1.1) and the robot (1.2) */
const WAREHOUSE: AABB = { min: { x: -10.4, y: 0, z: -6.4 }, max: { x: 10.4, y: 1.2, z: 6.4 } };
const VIEW: FittedViewOptions = {
   area: WAREHOUSE,
   pitch: PITCH,
   yaws: [0, Math.PI / 2],          // a portrait phone turns the camera so the 20 m side runs up the screen
   focus: [{ x: 0, y: 0, z: 0 }],   // static: no followFocus
   margin: { top: 0.02, bottom: 0.03, left: 0.02, right: 0.02 },
   padding: 8,                      // px kept clear of the HUD, the order panel, the joystick, Action and the banner
   shift: true,                     // lens shift: the floor may sit off-centre in the free space
};
// <CameraRig camera={{ position: view.offset, lookAt: LOOK_AT }} offset={view.offset} shift={view.shift} />
```

- **Fitted views.** Computed with core `fitView` and these rects: the shell HUD groups as in the core fixtures (`{10, 10, 218, 52}` and `{w − 104, 10, w − 10, 54}`), the order panel 260 × 44 (in the HUD row at `{w − 372, 10, w − 112, 54}` on screens 600 px wide or more, centred under it at top 62 px below that), the joystick 132 px and the Action button 72 px, 20 px from the bottom corners (both lifted by the cookie banner). fov 45. Gaps are the closest distance in px from the floor-and-walls outline to each rect (the HUD column is the nearer of the two groups); 8 is the padding binding.

| Screen (CSS px) | Yaw | Floor + walls on screen | Near / far floor edge | 1.0 box near / far | Gap to HUD / panel / joystick / Action |
|---|---|---|---|---|---|
| 375 × 812 | 90° | x 8–367, y 210–642 | 326 px (27.2 px/m) / 249 px (20.7) | 27 / 21 px | 156 / 104 / 18 / 78 |
| 375 × 812, 162 px banner | 90° | x 34–341, y 115–490 (shifted up) | 279 (23.2) / 220 (18.4) | 23 / 18 | 61 / 9 / 8 / 68, banner 160 |
| 390 × 844 | 90° | x 8–382, y 218–667 | 339 (28.3) / 259 (21.6) | 28 / 22 | 164 / 112 / 25 / 85 |
| 812 × 375 | 0° | x 160–710, y 78–322 (shifted right of the joystick) | 493 (24.7) / 361 (18.1) | 24 / 18 | 34 / 24 / 8 / 10 |
| 812 × 375, 83 px banner | 0° | x 175–637, y 62–273 | 420 (21.0) / 320 (16.0) | 21 / 16 | 20 / 8 / 23 / 83, banner 19 |
| 667 × 375 | 0° | x 169–631, y 62–273 | 420 (21.0) / 320 (16.0) | 21 / 16 | 8 / 8 / 17 / 10 |
| 915 × 412 | 0° | x 160–812, y 74–360 | 582 (29.1) / 418 (20.9) | 29 / 21 | 49 / 20 / 8 / 11 |
| 1280 × 800 (no touch controls) | 0° | x 26–1254, y 154–695 | 1100 (55.0) / 796 (39.8) | 54 / 40 | 102 / 100 / – / – |

  Portrait is bound by the width (the 12 m side plus walls across 359 px). The near edge's 27.2 px/m is within about 3% of the most a 375 px screen can give it (28.1), so only a narrower warehouse would make the boxes bigger. The zone letters are 2.2 m tall on the floor, 35–60 px on phones. The browser test measures these with the live rects (±2 px).
- **The yaw is locked per canvas size** (core): the banner changes only the distance and the shift, so the controls never turn mid-run.
- **Occlusion.** The near wall (0.9 m) hides 0.61 m of floor behind it, so the zone letters are painted at the tile centres, never at the wall. A rack (1.1 m) hides 0.74 m of floor behind it. In landscape that strip is z −1.19 to −0.45. In portrait (camera on the +x side) it is part of the rack gap (x 0.26–1.0) and the floor past the far rack (x −5.34 to −4.6). None of these strips holds a pallet or a zone. The robot (1.2 m) stays visible above both racks, and the player ring under it is drawn on top (`depthTest` off).
- **Frame order** needs no care: `useRunFrame` runs before `CameraRig` and every `useFrame` (core), so visuals always draw this frame's state.
- **Looks only** (`useFrame` with `useGameTime()`):
  - The robot bobs and leans with its speed and turns towards its heading. On a pick the box lifts from the pallet to the carry spot (in front of the robot, chest height) during the lock; on a drop it slides down into the zone and sinks (0.35 s).
  - Chevrons over the order boxes (one `<DynamicInstanced>`), the pulsing border of the target zone, a sprite that rises and fades over the zone with the real change of the score (four small canvas textures: +50, −20, and −10 or ✗ when the floor at 0 cut the penalty), a refused box's shake, the refill pop-in.
  - A teal ring under the robot, `BlobShadow`s under the robot and the boxes. No shadow maps.
- **Floor.** One canvas texture drawn once per run (`useCanvasTexture`), because the zone colours move per seed: concrete, lane paint, and the four zone tiles (colour fill, hazard-striped border, big letter). One draw call for floor and zones.
- **Draw calls (estimate, to be measured):** floor 1, walls and trim 2, target-zone border 1, racks 1–3, pallets 1–2, boxes up to 6 (4 pallets, the carried one, one sinking) plus 6 lid letters, chevrons 1, robot 1, ring 1, shadows 2, popup 1: **about 25–30**, far under 150. Under 60k triangles with every GLB in (robot 18k, six boxes 9k, racks and pallets at most 30k).

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| robot | **shared** `models/3d/shared/robot.glb` (on `main`: 18k tris, 613 KB, static T-pose) | `assets/shared.spec.json` | the worker | own stand-in: teal capsule, dark visor with two eyes |
| crate | **shared** `models/3d/shared/crate.glb` (on `main`: 1.5k tris, 100 KB) | `assets/shared.spec.json` | the boxes, **tinted per colour** | box in the colour with a plank texture and the letter (canvas) |
| shelfRack | **this game** `models/3d/warehouse-rush/shelfRack.glb` | `./assets.spec.json` | the 2 racks | instanced parts: orange uprights, grey shelves, brown cartons |
| pallet | **this game** `models/3d/warehouse-rush/pallet.glb` | `./assets.spec.json` | the 4 pickup pallets | instanced parts: 3 top slats, 3 runners |
| floor, walls, zone tiles, chevrons, popups, ring | primitives in code | none | – | (always primitives) |

- **Generate only the shelf rack and the pallet.** Both carry the look: the racks are the obstacles that shape every route, and the pallets mark where boxes come from (a painted square would not read as "pick up here"). Each is placed through `<InstancedModel>`, so the GLB costs one draw call per mesh for all copies. Two text-to-3D props, one attempt each: 2 generations, about 1 credit at 0.5 per generation. The robot and the crate already exist and are not generated again.
- **Universe `warehouse`, seed 5050,** like robot-collector's barrel and the shared crate, so the new props match the crate beside them. The prompts follow the `skills.md` formula (subject, style block, prop suffix). The rack prompt asks for "about four times as long as it is deep" because Rodin normalises the size and only the proportions survive. Its cartons are plain brown, so they never look like the coloured pickups.
- **Tier.** The spec keeps the CLI schema's prop tier (`Gen-2.5-Low`, `qualityOverride` 3000 / 1500) like the other specs. The generation itself runs through the Hyper3D MCP at Gen-2.5-Medium, as batch 1 did (shared crate and battery, robot-collector's barrel). The spend is approved by the user in chat first.
- **Scales come from the GLBs' measured bounds** (accessor min/max): the robot is 1.90 × 1.72 × 0.60 (T-pose, arms out), so `scale: 0.7` makes it 1.2 tall. The crate is 1.88 × 1.34 × 1.81, so `scale: 0.53` gives the 1.0 × 0.71 × 0.96 box. The rack and the pallet are scaled in the assets PR to 3.6 × 0.9 × 1.1 and 1.2 × 1.2 × 0.18. Collision never comes from a model: footprints are fixed in `rules.ts`.
- **Tint.** The crate GLB is one mesh with one textured material. `Boxes` makes 6 slots, each with its own `useModel(ASSETS.crate)` clone, and 4 cloned materials (one per colour: the same texture, `color` = the colour lightened 35% towards white, `emissive` = the colour at 0.25). A slot swaps `mesh.material` when its box changes colour. The game disposes of the 4 materials on unmount; the geometry and the texture belong to the loader cache. A letter decal (a small plane, 4 canvas textures) sits on each lid.
- `assets.ts` (planned):

```ts
export const ASSETS = {
   robot: { ...SHARED_ASSETS.robot, scale: 0.7 },
   crate: { ...SHARED_ASSETS.crate, scale: 0.53 },
   shelfRack: { id: "shelfRack", url: "/models/3d/warehouse-rush/shelfRack.glb", fallback: "box", fallbackColor: "#fb923c", budget: { ...PROP_BUDGET } },
   pallet: { id: "pallet", url: "/models/3d/warehouse-rush/pallet.glb", fallback: "box", fallbackColor: "#d6a46b", budget: { ...PROP_BUDGET } },
} satisfies Record<string, ModelAsset>;
```

- The robot and the crate are in `core/modelManifest.ts`, so they load from the first run (713 KB). The rack and the pallet are never fetched until the assets PR lists them; until then their instanced primitives show.

## HUD

- **Shell HUD:** Score, Time (counting down from 1:00, highlighted under 10 s) and `hudStats: [{ key: "delivered", label: "Delivered" }]`. At 375 px it is one row, like robot-collector's (Score, Time, Batteries).
- **Order panel** (`Hud.tsx`, one element marked `data-arcade-safe-area`): 260 × 44 px, a dark pill like the shell chips with a border in the order colour. Left: a square in the colour with the letter. Middle: **Deliver BLUE box → Zone B**. Right: a small box icon, filled with a ✓ while the robot carries the box. On screens 600 px wide or more it sits in the HUD row, its right edge 8 px left of the mute and pause buttons (112 px from the canvas edge), so it never meets the Score / Time / Delivered chips (they end at 218 px). Centred it would overlap them below 712 px, for example on a 667 × 375 phone. Narrower screens show it centred under the HUD row (top 62 px). It reads `stats.order`, `stats.carry`, `stats.drops` and `stats.delta`. A new `drops` value restarts a short flash (green on +50, red with a shake on a wrong zone), keyed like office-escape's notice; paused, the animation waits. The panel is `role="status"` with `aria-live="polite"` and announces each new order ("Deliver blue box to zone B"). It is always mounted with a fixed size, so the camera fit never changes when an order changes. Before the first order is published it shows "Get ready".

Planned `index.tsx`:

```ts
const definition: GameDefinition = {
   slug: "warehouse-rush",
   Scene,
   Hud: OrderHud,
   assets: ASSETS,
   durationMs: DURATION_MS,
   // first frame only: Scene's CameraRig (core useFittedView) fits the warehouse, clear of the HUD,
   // the order panel, the joystick and the Action button
   camera: { position: [0, 17.3, 11.7], fov: 45, lookAt: [0, 0, 0] },
   environment: { background: "#0b1220", lighting: "indoor" },
   touchControls: ["joystick", "action"],
   hudStats: [{ key: "delivered", label: "Delivered" }],
   instructions: [
      "Read the order at the top: a box colour and its zone.",
      "Drive to a box of that colour and press Action (E or Space) to lift it.",
      "Drive into its zone and press Action again: +50. Wrong zone: -20.",
      "One box at a time. You have 60 seconds.",
   ],
   finalScore: (s) => ({ score: capScore(s.score, s.elapsedMs), durationMs: s.elapsedMs }),
};
```

`resultDelayMs` stays at the core default (800 ms): the last drop and the robot stay on screen before the result.

## Edge cases

- **Pause** (Esc, P, tab hidden, window blur) stops `useRunFrame`, the clock and `useGameTime()`. `simMs`, the lock and the refill timers stop with them, so a refill due in 0.4 s is still 0.4 s away after a resume.
- **Countdown:** the robot stands on its start spot, the first order is already on the panel, presses are dropped (no `useRunFrame` before "playing").
- **A press on the frame the clock runs out:** `RunClock` ends the run first, `useRunFrame` does not run, the drop does not count. Deterministic, never a double end.
- **A refill and a delivery in the same step:** the refill lands first (step 2), so the order draw already sees the new box.
- **Same frame:** E and Space give one action. Holding Action acts once (no auto-repeat).
- **Joystick held during a lock:** ignored. After the lock the robot starts from rest (30 u/s², top speed after 0.2 s).
- **Driving into a pallet to pick:** collisions keep the robot outside; reach is measured from its centre, so touching (0.5) is enough.
- **Wrong zone at 0 points:** the score stays 0, the popup shows ✗, the next order comes as usual.
- **Resize or rotation mid-run:** the yaw is picked again for the new size and the controls follow it at once (core). The rules do not depend on the view.
- **Retry and restart** remount the Scene (`key = runId`): new seed, new layout, new streams. Nothing carries over. React strict mode double-creates the run in `useState`, which is harmless.
- **Missing or broken GLB:** its primitive (`<Model fallback>`, `<InstancedModel fallback>`; boxes: `useModel(...).failed`). Collision never depends on a model.

## Test plan

`rules.test.ts` (vitest):

- **Constants (golden).** Every number in "Constants" is pinned, and so are the derived ones: `MIN_LEG` 2.1, `CYCLE_MIN_MS` 1270, `FIRST_DELIVERY_MIN_MS` 1151.3 (±0.1), `SCORE_BOUND` 2350. The derived ones are also recomputed from the tuning numbers, so changing a speed, a lock, a slot or the reach without updating the proof fails. The scoring limits equal `meta.ts`.
- **Layouts.** `generateLayout` is deterministic per seed. 20,000 seeds reach all 216 layouts and every one passes `isValidLayout` (a permutation of the 4 colours, exactly 2 slots per row). `isValidLayout` rejects a repeated colour, 3 pallets in a row and a pallet off the slot grid. One connected free region (flood fill) holds every reach and every zone in all 216. The mean shortest pallet-to-zone leg lies in 6.3–6.8 for all 9 pallet sets. The reaches never overlap, and every zone is ≥ `MIN_LEG` from every reach. Golden draws for three seeds: the zone corners, the pallet slots and the first 12 box colours.
- **Streams.** The three streams are independent: the layout and the box colours are the same whatever the player does (a bot run and an idle run of one seed). Changing the order stream's seed changes no layout or box colour.
- **Movement.** Top speed exactly 6 empty and 5 carrying; diagonals are not faster; it accelerates from rest and brakes to a stop; it stops at racks, pallets and walls and slides along them. 20,000 random steps (random input, random dt, random carry state) never move more than the cap · dt, never enter a rack or a pallet, never leave the floor. dt ≤ 0 does nothing.
- **Action.**
  - Pick only in reach: at exactly 0.8 from the pallet edge it picks, at 0.81 nothing happens. Only an order-coloured box can be picked; another colour is refused with no lock and no score.
  - Deliver only with the centre inside a zone: x = 6.5 delivers, x = 6.49 does nothing (both inside the z range).
  - Right zone +50; wrong zone −20; the floor: 10 → 0 with a change of −10, 0 → 0 with 0. The score is always a multiple of 10. Delivered counts right deliveries only.
  - Every delivery draws the next order in the same step. Presses during a lock are dropped. The step that brings `lockMs` to 0 does not move; the next one does. A carrying robot in reach of a pallet does nothing.
- **Refills.** A refill lands on the first step with `simMs ≥ delivery + 1500` and not one step earlier, on the pallet empty longest (ties: lower index), with the next box-stream colour, before that step's move and action.
- **Invariants under random play** (2000 seeds × 60 s, random and mashing inputs, 144 / 60 / 30 fps and random 1–50 ms steps): boxes in play + pending refills = 4; pending ≤ 2; ≥ 2 occupied pallets at every order draw; a box of the order colour is always on a pallet or in the grip; no pallet ever holds two boxes; the carried box always has the order colour.
- **Proof.**
  - The real store (`createArcadeStore`), driven with `advanceRunClock` and `playedFrameDt` like robot-collector, through countdowns, pauses, resumes and frames from 4 to 300 ms: no untimed step, and moving time + lock time ≤ `elapsedMs`.
  - Deliveries are always ≥ 1270 ms apart and the first is ≥ 1151.3 ms, for the bots below and the random inputs above.
  - A **worst-case drill**: after each delivery the test rewrites the run (a plain object) so that the order's box is on a side pallet and its zone is the corner beside that pallet, and a straight-line bot drives at full speed. Its cycles stay ≥ 1270 ms and its 60 s score ≤ 2350.
  - At every frame of every run: `score ≤ 50 · elapsedMs / 1000`, `score ≤ 3000`, and `capScore` is a no-op. `withinServerLimits(score, 60000)` holds for every final score.
  - An idle robot times out with 0 at exactly 60000 ms.
- **Fairness bot.** A path-following bot (grid shortest paths, the real `stepRobot`, 60 fps) plays 1000 seeds: every order is finished, and every score lies within 20% of the median. Its median is pinned too (±5%), from its first run; it should come out a little under the prototype's 900, because the real robot slows in corners.

The generic parts are tested in `core/`: the clock and the frame order (`frameLoop.test.ts`, `useArcadeStore.test.ts`), the fit, the lens shift and the yaw lock (`view.test.ts`, `useFittedView.test.ts`), `rngNext` (`math.test.ts`), the manifest and instanced models (`modelManifest.test.ts`, `assets.test.ts`).

Browser (production build with the flags on and the API mock, headless Chrome over CDP, network log on):

- **Desktop 1280 × 800, keyboard:** start, countdown (the order is shown, the robot does not move), 3 right deliveries, a refused pick at a wrong colour, 1 wrong zone (−20 on the panel and in the score), a 2 s pause with a refill pending (it lands 1.5 s of play after the delivery, not 1.5 s of wall time), then the time-up at 1:00. Score = the rules' formula for the deliveries made; duration 60000.
- **375 × 812 and 812 × 375 with touch emulation** (joystick + Action), with and without the cookie banner: the fit matches the table above within ±2 px; the floor stays clear of the panel, the joystick and the Action button; the order panel sits under the HUD row in portrait and in it in landscape.
- **Checks:** draw calls ≤ 150 and 60 fps on desktop and in phone emulation; requests only for `robot.glb` and `crate.glb` (no `shelfRack` / `pallet` request before the assets PR); `renderer.info.memory` constant from 5 s to 55 s.

## Known issues and core gaps

- **The time-up plays the "lose" jingle.** GameShell plays `"win"` only for `endReason === "win"`. Every Warehouse Rush run ends on the clock, so even a record ends on the sad sound (the title "Time's up!" is fine). Core candidate: a neutral time-up sound for points games without a win state, or `"win"` on a new best.
- **No per-copy tint for GLB instances.** `<DynamicInstancedModel>` and `<InstancedModel>` draw a GLB with its own material, and `InstancePart.colors` applies only to stand-in parts (one colour per piece, the same for every copy). The game therefore clones 4 materials and draws up to 6 boxes as separate meshes. That is cheap at this count. Core candidate: per-copy `instanceColor` for GLB parts, which would make all boxes one draw call.
- **No success or error sound in the core.** The game maps pick → `"jump"`, right → `"pickup"`, wrong → `"hit"`. Core candidate: `"success"` / `"error"`.
- **The robot GLB is a static T-pose** (no clips, not rigged). The carried box floats in front of it, between the outstretched arms, and the body motion is code (bob, lean, a squash on pick and drop).
- **Order luck.** Perfect play spreads 800–1050 over seeds (−11% / +17% around the median). That is accepted arcade luck. The test pins the spread so it cannot widen unnoticed.
- **Inherited from the core:** the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll, so the camera eases to its new fit up to a second after the banner opens or closes.
- The `index.tsx` stub's two instruction lines are placeholders. The planned four lines are above.
