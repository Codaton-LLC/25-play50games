# Warehouse Rush

Owner: Claude. Slug: `warehouse-rush`. Game 6 of the 3D Arcade: the first carry-and-drop game and the first game with an Action button. Status stays `"soon"` until the game is reviewed. **This file is the design.** `rules.ts` and `rules.test.ts` implement its rules and proof; `Scene.tsx`, `Primitives.tsx`, `Hud.tsx` and `assets.ts` build the playable game on them (browser results under "Test plan"). The limits in `meta.ts` were tightened on 2026-10-07 to the proven maximum plus one delivery (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. Only `thumbnail` changed with the build. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, `Hud`, assets, `durationMs: 60000`, camera, environment, `touchControls: ["joystick", "action"]`, `hudStats`, instructions, `finalScore` (safety net). |
| `rules.ts` | Everything that decides the outcome: the warehouse map, the seeded layout and streams, robot movement with the carry speed, pallets and refills, orders, Action handling, scoring, the proof constants. Pure: no three.js, React, DOM, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the fairness checks and the scoring-limit proof below. |
| `Scene.tsx` | The frame loop and the moving things: maps input with the view's yaw, calls `rules.ts`, makes the next run when the store starts it and publishes its first order (and again on mount), mirrors the run into the store, draws the robot, boxes, the order markers, the target zone and popups, places the static fitted camera. |
| `camera.ts` | The static fitted camera's settings (`PITCH`, `FOV`, `LOOK_AT`, `WAREHOUSE`, `VIEW`): plain data, shared by `Scene.tsx`, `index.tsx` and `marker.test.ts`. |
| `marker.ts` / `marker.test.ts` | The order markers (looks only, "Order markers"): which pallets show them, how high the arrow floats for the camera (`clearTipY`), its bounce and tuck, the floor frame's pulse / their vitest, which projects the markers through every fitted camera. Pure, no three.js. |
| `gait.ts` / `gait.test.ts` | The GLB robot's walk-cycle phase step (looks only): core `gaitPhaseStep` with the robot's landmarks, its 0.7 scale, a 0.1 m minimum stride and the 4-strides-a-second cap / its vitest. Pure, no three.js. |
| `Primitives.tsx` | Warehouse look: floor with the painted zone tiles (canvas texture, drawn per run), walls, the rack and pallet stand-ins (instanced parts), the box materials and stand-in, the robot stand-in, the lid letters, the popup textures and the order markers' arrow and frame textures. |
| `Hud.tsx` / `Hud.module.css` | The order panel ("BLUE box → Zone B"): a static fixed-size wrapper marked `data-arcade-safe-area`, the flash and shake on an inner pill. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the two props only this game generates. |

The thumbnail `public/images/3d/warehouse-rush.webp` (640 × 360, 17 KB) is captured from the game with `tools/thumbs` (1280 × 720 at 2×, the HUD hidden but laid out, zoomed 1.8× on the robot): the robot beside a box in the first seconds of a run, the order markers over the three yellow boxes of the order. The Open Graph card `public/images/og/3d/warehouse-rush.png` is rebuilt from it with `tools/og` (2026-10-08, with the order markers).

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, `rules.ts` as pure seeded functions with tests that prove the limits, the run state made once in `useState`, one `useRunFrame` that calls `rules.ts` and then the store, visuals in `useFrame` with `useGameTime()`, the `useFittedView` camera block and `<Model fallback>` / `<InstancedModel>` for models. Games never import each other.
- **This game adds three patterns** (copy, never import):
  1. **Action with a lock.** A press is resolved after the move of that step, and a pick or a drop freezes the robot for a fixed 250 ms of play. The lock is what makes a minimum cycle time provable.
  2. **A game HUD panel fed by numeric stats.** The Scene publishes `setStat("order", 0..3)` and friends when a run starts (in the store update that starts it, so the panel is filled from the first countdown frame) and then after every step that changes them; `Hud.tsx` maps the numbers to text. The element marked `data-arcade-safe-area` is a static wrapper with a fixed width and height: always mounted, never keyed, never transformed. The flash and the shake run on an inner element. So the camera fit never changes mid-run.
  3. **A recoloured shared GLB.** One `useModel` clone per box slot, with one cloned material per colour: the albedo map dropped (`map = null`), the normal and metal/roughness maps kept, `color` = the colour. A tint multiplied by the crate's wood texture cannot make a blue box (Assets). The core has no per-copy tint for GLB instances yet (Known issues).
- **Do not copy:** the warehouse primitives, the order markers and the popups. They are decoration for this game. (A camera-facing marker that must clear what it points at could use `marker.ts` `clearTipY` as a core helper; ask Claude to move it to the core first.)

## Concept

The teal robot from Robot Collector has a new job on the dispatch floor. Four pallets in the middle of a small warehouse hold coloured boxes. An order at the top of the screen says which box to bring where: "BLUE box → Zone B". Drive to a blue box, press Action to lift it, drive into Zone B (painted blue, with a big B) and press Action again. Right zone +50, wrong zone −20. The next order appears at once, and an empty pallet gets a new box 1.5 s later. The run lasts 60 seconds. The look is the Play50 vinyl-toy style in a warm warehouse, accent `#fb923c` (the rack uprights).

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
| Box | the shared crate, drawn 1.0 × 0.71 × 0.96 on a pallet (scale 0.53), 0.62 × 0.44 × 0.60 over the robot's head while carried (`CARRY_SCALE` 0.33, Scene). No collision of its own. |
| Reach | the robot's centre within **0.8** of the pallet's edge (`PICK_GAP`, core `distanceToBoxXZ`). Touching the pallet is 0.5, so driving up to it is enough. |
| Locks | pick `PICK_MS` 250, drop `DROP_MS` 250: the robot stands still and ignores input. |
| Refill | `REFILL_MS` 1500 after each delivery, on the pallet that has been empty longest. |
| Points | +50 right zone, −20 wrong zone, never below 0 (`POINTS`). |
| Step | whole ms, at most 50 per step (`MAX_STEP_MS`; `useRunFrame`'s dt is at most 1/20 s). |

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

- Every run has its own seed from `randomSeed()`. GameShell remounts the Scene (`key = runId`) on start, retry and restart; the run is made with `createRun(randomSeed())` the moment the store starts it (the outgoing Scene, "Publishing to the store") and the new Scene takes it over in its lazy `useState` initializer, or makes one there when none was prepared (the Scene of the loading and ready screens).
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

- An order is one colour: its box and its zone. `createRun` draws the first one, and the Scene publishes it in the store update that starts the run, so it is on the panel for the whole countdown ("One step"). Every delivery, right or wrong, draws the next one **in the same step**.
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

`step(run, dtMs, input)` runs once per `useRunFrame`, with `dtMs = dt · 1000`. `input` is one object per run (`createStepInput()`), rewritten every frame: `moveX` / `moveY` are the wanted direction on the floor in **world x / z**, already mapped by Scene with `inputToWorld(moveX, moveY, view.yaw)`, and `actionPressed` is the core's `actionPressed || jumpPressed`. A step with dtMs ≤ 0 (or NaN) does nothing.

1. **Clock:** `simMs` counts whole ms of play; the fraction is carried to the next step (`advanceClock`, as office-escape; a step counts at most 50 ms). So `simMs` never runs ahead of the store's `elapsedMs` and lags it by less than 1 ms. The step that reaches 60000 ends the run (`events.ended = "timeup"`) before anything else, as `RunClock` does. In the game that step never comes: the store ends the run first and `useRunFrame` does not run on that frame.
2. Land every due refill.
3. **Lock:** if `lockMs > 0`, then `lockMs = max(0, lockMs − stepMs)`, the velocity is set to 0, input and presses are ignored, and the step ends. A lock therefore covers whole steps: at least 250 ms of play without any movement.
4. **Move:** the robot-collector movement, with the top speed of the carry state (6 or 5). Racks and pallets push the robot out (`resolveSphereAabb`), the walls keep it in (`clampToBounds`), then the **speed guard** scales the step back so it never moves more than `speed · dt`, whatever the pushes did. The velocity is what really happened. The robot turns to face where it goes.
5. **Act** on a press (table above).

The step reports what happened in `run.events`, one object reset at the start of every step and returned by `step`: `picked` and `refused` (the pallet index, −1 for none), `delivered` (right zone), `wrong`, `zone` (the corner), `delta` (the real change of the score), `newOrder`, `refilled` (a bit per pallet that got a box) and `ended`. The run also keeps the counters the Scene's publish cache reads (`picks`, `drops` = all deliveries, `delivered` = right ones, `wrong`, `refusals`, `lastDelta`, `lastZone`) and the proof's split of play time (`movedMs`, `lockedMs`). The pallets, the refill queue (a ring of 4) and the events object are made once in `createRun`: nothing is allocated after it.

**Publishing to the store.** Scene keeps a cache of the values it last published and publishes in three places:

- **When the store starts a run** (start, retry, restart: a new `runId` in `"countdown"`). GameShell's `beginRun` clears the stats and bumps `runId` in one store update, and the R3F root remounts the Scene a task or more later. A publish from the new Scene's mount alone therefore lands 1–2 frames into the countdown (measured: "Get ready" for 37 ms after Play, 10 ms after a restart). So every Scene subscribes to the store, and on a new `runId` in `"countdown"` it makes that run (`createRun(randomSeed())`) and publishes `setStat("order", run.order)` and `setStat("carry", 0)` from inside that same store update, before React renders the countdown. The new Scene takes the prepared run over in its `useState` initializer (a module-level hand-off: one game is on screen at a time). The nested `setStat` calls run inside zustand's listener loop, which every other listener tolerates (GameShell's reacts to phase changes only).
- **On mount**, in a `useEffect`: the same two `setStat` calls (a no-op after the hand-off, `setStat` with the same value changes nothing), and it seeds the cache with them, score 0 and the zero counters. This covers the Scene of the loading and ready screens (`runId` 0, no hand-off), where a later `configure()` may clear the publish again; the game HUD is laid out hidden then. `useRunFrame` never runs before `"playing"`, but `setStat` is accepted in every phase except `"over"`. Strict mode runs the effects twice, which is harmless.
- **After each step**, only the values that differ from the cache: `setScore(run.score)`, `setStat("delivered", right)`, `setStat("order", colour)`, `setStat("carry", 0 | 1)`, `setStat("delta", last change)`, `setStat("drops", all deliveries)` (`delta` before `drops`: the panel keys its flash on `drops` and colours it from `delta`).

Scene never calls `addScore`, so the HUD can never drift from the rules. Sounds: pick `"pickup"`, right `"pickup"`, wrong `"hit"`.

### Fairness

- **Every layout is solvable.** The racks, pallet slots and zones are fixed shapes, and the free space for the robot's centre is one connected region in all 216 layouts (flood fill on a 0.1 grid). Every reach and every zone lies in it. With the invariant above, every order can be finished.
- **Every layout is about as hard as every other.** The 16 shortest pallet-to-zone legs (grid paths for the robot's centre around the racks and pallets) average **6.55–6.56** in all 9 pallet sets (shortest 2.2, longest 10.4, design prototype). The test measures them on a 0.1 m grid with 16 directions: 6.50–6.51, shortest 2.1 (= `MIN_LEG`), longest 10.3. The zone permutation only relabels the colours. The test pins the band 6.3–6.8 and a spread under 0.05 between the sets.
- **Orders add luck, within a band.** The order stream decides how far each order sends the robot. A perfect-play bot over 300 seeds (prototype, below) scores 800–1050 around a median of 900, that is 16–21 deliveries around 18 (−2 / +3). The test pins the spread **in deliveries**, the unit the score moves in (one delivery = 50 points, about 6 % of the median): the 1st–99th percentile within ± 3 deliveries of the median, and every one of 1000 seeds within ± 5. A band in percent ignores that step. With a median of 850, ± 20 % is 680–1020, so a single lucky seed with 21 deliveries (1050) would fail the test although nothing in the design changed. These bounds are design limits, not fitted to the bot's first run. If a later change breaks them, that change made the order luck worse, and the fix belongs in the rules (for example drawing orders from a shuffled bag of the 4 colours, limited to occupied pallets), never in a wider band.
- **Readable on a phone.** Every box has its zone letter on the lid and every zone has a big letter on the floor, so colour-blind players match letters. While the robot is empty-handed, a bold down arrow bounces over every box of the order colour and a frame pulses on the floor around its pallet, both in the order colour with a dark outline ("Order markers"); neither ever covers a box or its lid letter. While it carries, the border of the target zone pulses. The whole warehouse is always on screen (static camera, below).

## Scoring

| Event | Points |
|---|---|
| Right zone (zone colour = order) | +50 |
| Wrong zone | −20, never below 0 |

`score = right ? score + 50 : max(0, score − 20)` after each delivery. The score is always a multiple of 10. Examples: 14 right deliveries, then 2 wrong ones: 700 − 40 = **660**. Two wrong ones first, then 14 right: 0, 0, then **700** (the floor ate the penalties). The HUD shows Score and Delivered (right deliveries only). GameShell submits the store's score with `elapsedMs`, which is exactly 60000 at the time-up (core).

`index.tsx` sets `finalScore: (s) => ({ score: capScore(s.score, s.elapsedMs), durationMs: s.elapsedMs })`. That is `min(score, 1700, floor(29 · round(e) / 1000))`, the robot-collector safety net, and the tests prove it never changes a reachable score.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 1700, `base` 0, `maxPointsPerSec` 29, duration 57–63 s (tightened 2026-10-07 from 3000, 50/s and 5–75 s, which accepted 3000 against a true maximum of 1650). The server accepts a run only if:

- `score <= 1700`
- `57000 <= duration_ms <= 63000`
- `score * 1000 <= 29 * duration_ms`, that is, `score <= 29 · t` with t = duration_ms / 1000

1. **Duration.** A ranked run ends only on the clock: there are no lives and no win, and `end("quit")` is never ranked or sent. The clock ends the run with `elapsedMs` exactly 60000 (`play()` in `core/useArcadeStore.ts`), so every submission has `duration_ms = 60000`, inside 57000–63000 (± 5%), and the cap is min(1700, 29 · 60 = 1740) = 1700 = `maxScore`. So it is enough to show score ≤ 1700. The lever is `maxScore`; the duration window only pulls in around the one honest duration. (A fast honest start runs above 29 · t, for example 2 deliveries by 3.3 s, which is fine: only the 60 s submission is checked. If a later version ended runs early, the limits would have to be revisited.)
2. **Clock.** `useRunFrame` hands the game exactly the play time `RunClock` counted in that frame, including the rest of the frame in which the countdown ends (core). Pause stops both. Locks cover whole steps and the robot moves only in the other steps, so for any span of play, moving time + lock time ≤ the play time that passed (`movedMs + lockedMs ≤ simMs ≤ elapsedMs`; `simMs` is whole ms, so a bound below is also met to the whole ms).
3. **Speed.** The speed guard caps every step at 6 · dt empty-handed and 5 · dt carrying (the carry state is fixed during the move; a pick or a drop happens after the move). So driving a distance L takes at least L / 6 s, and at least L / 5 s with a box.
4. **Distances.** `MIN_LEG` = **2.1**: the closest any reach comes to any zone. A side pallet's edge is at \|x\| 3.6, its reach ends at 4.4, the zone starts at 6.5 (their z ranges overlap). Every other pallet-zone pair is farther apart. Obstacles only make real paths longer. From the start (0, 0): 2.0 to the reach of a middle pallet, 2.888 to the reach of a side pallet (to its corner at (2.4, 2.8), minus 0.8).
5. **One cycle ≥ 1270 ms** (`CYCLE_MIN_MS`). Take two deliveries at t_k and t_k+1. The grip is empty after t_k, so the box delivered at t_k+1 was picked after t_k, at some pallet P. There is exactly one such pick p: a carried box leaves the grip only by a delivery. In this order, and without overlap, the robot needs:
   - the drop lock after t_k: ≥ 250 ms, no movement;
   - a drive from inside zone Z_k (where it dropped) to the reach of P: ≥ 2.1 at ≤ 6 u/s, **≥ 350 ms** (detours and refused presses only add time);
   - the pick lock after p: ≥ 250 ms;
   - a drive with the box from the reach of P into zone Z_k+1: ≥ 2.1 at ≤ 5 u/s, **≥ 420 ms**.

   So t_k+1 − t_k ≥ 250 + 350 + 250 + 420 = **1270 ms**. Wrong deliveries need the same cycle, so the bound counts every delivery.
6. **First delivery ≥ 1151.3 ms** (`FIRST_DELIVERY_MIN_MS`). The same argument from the start, with p the one pick before the first delivery, at pallet P: a drive at ≤ 6 u/s from (0, 0) to the reach of P, then the pick lock, then the carry into a zone at ≤ 5 u/s. Over the pallets: a side pallet gives 2.888 / 6 + 0.25 + 2.1 / 5 = **1.1513 s**, a middle pallet 2.0 / 6 + 0.25 + 5.1 / 5 = 1.603 s.
   Steps 5 and 6 alone allow a delivery every 1.27 s, 47 by 60 s (2350). That bound ignores the refills, and its worst case needs a box back on the pallet just emptied, which honest play cannot get. Steps 7 and 8 take the refills into account.
7. **The refill lemma.** Picks and deliveries alternate. Every delivery schedules one refill, and refills land in due order (`landRefills`), each on the empty pallet with the oldest `emptiedAt`. By induction, **refill n lands on the pallet of pick n**, at the first step with `simMs ≥ t_n + 1500` (t_n = delivery n): when it lands, refills 1 … n − 1 are on the pallets of picks 1 … n − 1, so the empty pallets are those of picks n, n + 1, …, emptied in that order. The invariant boxes + pending = 4 means no refill is ever skipped. So **picking the same pallet twice in a row needs p_{n+1} ≥ t_n + 1500**. The test checks the lemma at every refill of 2000 runs, and a mutation that refills the newest empty pallet instead breaks it.
8. **The earliest delivery times** (`EARLIEST_DELIVERY_MS`). An exact shortest-path search over the state (zone corner of the last drop, last picked pallet), for each of the 9 pallet sets: the first delivery costs `startToReach / 6 + 0.25 + reachToZone / 5`, and each further cycle costs `pick = max(t + 0.25 + reachToZone(P, previous zone) / 6, P = last pallet ? t + 1.5 : −∞)`, then `t' = pick + 0.25 + reachToZone(P, next zone) / 5`. Colours, racks, acceleration and the other refills are left out, which can only make the times earlier, so each entry is a lower bound for any play, wrong deliveries included. The minimum over the sets (a test also recomputes the first 4 by brute force over every pick-and-zone sequence):

| Delivery k | Earliest time (bound) | Score at most |
|---|---|---|
| 1 | 1.151 s | 50 |
| 2 | 2.873 s | 100 |
| 3 | 4.667 s | 150 |
| 4 | 6.461 s | 200 |
| 10 | 17.222 s | 500 |
| 20 | 35.158 s | 1000 |
| 30 | 53.094 s | 1500 |
| 32 | 56.681 s | 1600 |
| 33 | 58.475 s | **1650** |
| 34 | 60.268 s | (after the time-up) |

   From the third delivery on, every cycle costs at least 1793.6 ms: the fastest sustained loop is a cross-rack alternation between the two side pallets on one x side and their zones (5.242 m empty, 2.1 m carrying); a fast same-zone cycle (1270 ms) followed by a middle-pallet cycle (2370 ms) gives about the same. The 34th delivery would come at ≥ 60.268 s, after the time-up, so every pallet set allows at most 33 deliveries: **score ≤ 1650** (`SCORE_BOUND`). The score is at most 50 · N(t): +50 adds 50 to both sides, and `max(0, s − 20)` never raises a score that is ≥ 0. The bound allows 150 by 5 s, 850 by 30 s, 1600 by 57 s and 1650 by 59 s. The sustained rate is at most 27.9 points/s; the steepest moment is the first delivery, 50 / 1.1513 = 43.4 points/s. Without the refill lemma the same search gives 2350, step 6's bound.
9. **The integer check** at `duration_ms` = 60000: 1650 · 1000 = 1,650,000 ≤ 1700 · 1000 and ≤ 29 · 60000 = 1,740,000. ✓ Inside the window the bound stays under the line at every t: by 57 s at most 1600 ≤ 1653, by 58.4745 s at most 1650 ≤ 1695, and the first 1700 would come only at 60.268 s.

Margins: `maxScore` 1700 is the proven 1650 plus one delivery (+3.0%). The bound is 268 ms (one cycle's slack) away from allowing a 34th delivery, and extremely improbable luck (repeated same-colour orders on the right pallets) is not excluded by the rules, so the limit does not go below 1650. An acceleration argument is not used: pushes from corner grazes can make a step longer than |v| · dt (the speed guard test shows it). The best a forger can post drops from 3000 to 1700, at a claimed 58621 ms or more (the 29/s line).

### What real play scores (design prototype)

A prototype of these rules (same map, streams and refills; shortest grid paths around the racks and pallets; each leg timed from rest with the real speeds and acceleration; both locks) played 300 seeds:

- **Perfect play** (always the order box with the fastest pick-and-carry route, no reaction time): 800–1050 points, median 900, that is 16–21 deliveries. The shortest real cycle was 1490 ms (bound 1270) and the earliest first delivery 1732 ms (bound 1151).
- **Human-like** (legs 25% slower, 0.3 s to react before each leg): 600–750.
- At least 2 pallets held a box after every delivery, as step "Pallets, boxes and refills" says.

Expect top human scores around 800–950. The test's path-following bot (real `stepRobot`, 60 fps) repeats the perfect-play check with the real rules: over 1000 seeds a median of **18 deliveries (900)**, 16–20 from the 1st to the 99th percentile, all seeds 15–21. Across 2000 runs of perfect, nearest-zone, wrong-zone, random and mashing bots at 144 / 60 / 30 fps and random steps, the shortest real cycle was 1448 ms (bound 1270) and the earliest first delivery 1828 ms (bound 1151). The forced-luck drill (Test plan: the best order every time) scores 1300–1450 (26–29 deliveries, cycles of about 2.1 s) over all 9 pallet sets and 4 frame patterns (bound 1650).

Measured for the 2026-10-07 limits (throwaway probes, deleted): honest seeds 0–9999 at 60 fps scored at most 22 deliveries = 1100 (seed 3433), mostly 17–18; the shortest real cycle was 1450 ms and the earliest first delivery 1850 ms. A forced-luck drill that rewrites only the colours of boxes already on pallets and the order (2–3 cycles ahead) scored at most 28 = 1400 over all 9 pallet sets at 144, 60 and 30 fps and random 1–50 ms steps. Across 10,000 honest bot runs, 2000 runs of random, mashing, nearest-zone and wrong-zone bots and 144 forced-luck runs, the refill lemma held at every landing and every delivery was at or after the earliest-time table. So `maxScore` 1700 is +21% over the drill and +55% over the best honest seed.

## Scene and camera

- **Static fitted camera.** The camera looks three-quarter top-down, tilted 56° (`PITCH`, as robot-collector), and does not follow the robot. Every zone letter and every box stay on screen and in the same place for the whole run. Its settings live in `camera.ts` (the order markers' test projects through them):

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
- **The lens shift holds across runs** (core): start, retry and restart remount the Scene and its `CameraRig`, and the new rig keeps the fitted shift however the remount is scheduled, so every run is framed as on the start screen.
- **Occlusion.** The near wall (0.9 m) hides 0.61 m of floor behind it, so the zone letters are painted at the tile centres, never at the wall. A rack (1.1 m) hides 0.74 m of floor behind it. In landscape that strip is z −1.19 to −0.45. In portrait (camera on the +x side) it is part of the rack gap (x 0.26–1.0) and the floor past the far rack (x −5.34 to −4.6). None of these strips holds a pallet or a zone. The robot (1.2 m) stays visible above both racks, and the player ring under it is drawn on top (`depthTest` off). Its draw order keeps it under the robot and the boxes: everything else draws first (`renderOrder` 0), then the ring (1), then the robot's and the boxes' meshes (2, depth tested), so the robot covers the ring's back half and a box beside it covers the ring, while a rack in front does not.
- **Frame order** needs no care: `useRunFrame` runs before `CameraRig` and every `useFrame` (core), so visuals always draw this frame's state.
- **Looks only** (`useFrame` with `useGameTime()`):
  - The robot walks: the static T-pose GLB is rigged in code (`core/rig`, `<HumanoidModel>`), its legs and arms follow a walk cycle whose amount eases to the speed (arms hanging and breathing when still) and whose phase advances by the distance driven over the walk's own stride (`walkStride(amount, ROBOT_LANDMARKS)` × 0.7: 0.56 m at a walk, 0.94 m at full speed), but never faster than 4 strides a second (`gait.ts` `warehousePhaseStep` on core `gaitPhaseStep`, as robot-collector does: `WAREHOUSE_MAX_CADENCE` 4, `WAREHOUSE_MIN_STRIDE` 0.1 m; `gait.test.ts`). This robot is small for its speed (1.2 m tall at up to 6 m/s): at the scene's walk amount (speed / 6) its own stride would need 5 to 6.4 strides a second at every speed, so the cap always holds the cadence at 4 and the planted foot slides about a quarter to a third of a step (24 % at a walk, 37 % at the 5 m/s carry speed and at 6 m/s). While it carries a box both arms go up beside the head, hands edge-on under the box's edges (`carryPose(1)` on the arms only, the legs keep walking; the shoulders shrug with the raised arms): they rise with the box during the pick lock (`LIFT_S`) and come down as it sinks into a zone (0.25 s). The fingertips reach about 1.21 m, 4 cm under the box's bottom at 1.25 m (the robot's arms are short); the box spot is unchanged.
  - The robot turns towards its heading. Its body group carries the rise over the planted foot (`fx.bob` = `bodyLift` × 0.7, lowest at a walk's long stride, a short flight at a run), so the flat soles never sink into the floor, and the carried box rides it. The walk leans its own spine; a whole-body lean about the feet would tip the soles into the floor. The stand-in (`RobotPrimitive`) keeps the old bob (`standInBob`) and lean with its speed (the scene sees it through a ref on its wrapper group). On a pick the box lifts from the pallet to the carry spot **over the robot's head** during the lock, shrinking from scale 0.53 to `CARRY_SCALE` 0.33 (0.62 × 0.44 × 0.60). On a drop it sinks straight down at the robot's position (same x, z and scale) into the zone tile (0.35 s).
  - **The carried box never clips.** The carry spot is centred on the robot (x, z offset 0) with the box's bottom at 1.25 m, just above the 1.2 m head. Its farthest corner is 0.43 m from the robot's centre, inside the 0.5 collision radius, so at any heading it stays out of the walls, the racks and the boxes on the pallets (it is above all of them anyway: walls 0.9, racks 1.1, pallet boxes 0.89). A box held in front of the robot at scale 0.53 would reach 1.1–1.2 m out and stick about 0.6 m through the walls in every zone corner (in landscape through the near wall, facing the camera). Its top at 1.69 m stays inside the fit: seen from the fitted cameras (20–25 m from the centre in landscape, about 40 m in portrait) it projects below the far top edge of `WAREHOUSE` (y 1.2 at the far wall). It would rise above that edge only for a camera closer than 17.3 m (landscape) or 26 m (portrait). Visual only: the collision radius stays 0.5 (no pop at pick time), and reach and zone tests use the robot's centre, so the rules and the proof do not change.
  - The order markers over the order boxes (a bouncing arrow and a pulsing floor frame, "Order markers" below), the pulsing border of the target zone (a square ring on the tile's edge), a sprite that rises and fades over the zone centre with the real change of the score (four small canvas textures: +50, −20, and −10 or ✗ when the floor at 0 cut the penalty), a refused box's shake (0.4 s), the refill pop-in (0.3 s; the starting boxes pop in one after another when the run's Scene mounts; a box's markers pop in with it, so none hangs over an empty pallet).
  - The lid letters and the floor letters read upright from the camera: the floor letters are painted turned by the view's yaw (the floor redraws when the yaw changes, which only a resize can do), and each lid letter turns by the yaw minus its box's turn.
  - A teal ring under the robot and a `BlobShadow` under it. The racks' and this run's pallets' contact shadows are baked into the floor texture (they never move during a run). No shadow maps.
  - **No first-use uploads mid-run.** All four popup textures, all four lid letters and the markers' arrow and frame textures are uploaded at mount (`gl.initTexture`), and the popup sprite and the target-zone ring are drawn once, invisible, on the first frame, so the first −20 or the first box of a new colour never compiles a shader or uploads a texture during play (`renderer.info.memory` is constant from 5 s to 55 s, Test plan). The markers are drawn from the countdown on (the first order's boxes pop in then), so their shaders compile before play.
- **Floor.** One canvas texture drawn once per run (`useCanvasTexture`, 960 × 576, 48 px/m), because the zone colours move per seed: concrete with slab joints and stains, contact shadows, the aisle lines, the pallet bay marks, the start pad and the four zone tiles (colour fill, hazard-striped border, big letter). One draw call for floor and zones.
- **Draw calls (measured):** **21–23** per frame at the build PR (desktop and phone emulation alike), about 25k triangles (robot GLB 18k, six crate clones 1.5k each): floor, slab, walls, trim, rack uprights / shelves / cartons, pallet slats / runners, up to 6 boxes and their lid letters, chevrons, robot, ring, shadow, target zone, popup. With the rack and pallet GLBs (group A) and the order markers (2026-10-08): **17–20** per frame, about 42k triangles; 18 at the start of a run with the old chevrons (one draw call), 19 with the markers (one for every arrow, one for every frame). Far under 150.

### Order markers

What the player looks for while empty-handed: which box to pick. The first marker was a 4-sided cone pointing down 0.8 m over the lid, the order colour 35 % towards white. From this high, steep camera a cone is seen nearly from above, so it read as a pale tilted square stuck on the box's far corner, not as an arrow (user report, 2026-10-08). It is replaced by two markers, both on every pallet `marked()` says (a box of the order colour, robot empty-handed), both in the order colour itself (unlit and not tone mapped: the colour of the order panel's border) with the dark navy outline of the lid letters and popups, so they read on the concrete and over the yellow aisle lines in all four colours:

- **The arrow.** A bold down arrow (shaft and head, white to light grey on a canvas texture that the material colour paints, the outline stays dark), 0.85 × 0.8 m, on a quad that always faces the camera: one `<DynamicInstanced>` for all four pallets, each copy composed from the camera's rotation, so it is one draw call. Its anchor is its tip, straight over the pallet's centre. It bounces up 0.12 m and taps down again every 0.8 s (`beat`, `useGameTime`, so it freezes while paused).
  - **It never covers the box or its lid letter.** From the steep camera the lid covers most of a box's height on screen, so a fixed height that clears the near row of a close camera floats far over the far row. `clearTipY` puts the tip, at the bottom of its bounce, `ARROW.gap` (0.12 m at the box, about 3 px on a phone and 6 px on desktop) above the box's highest point on screen, from the camera's position and axes, every frame (the fit eases when the banner opens or closes): a billboard's bottom edge is on screen where its tip is, and the tip's screen height (its slope `(p · up) / (p · forward)`) rises with its height, so the height has a closed form. The box's top corners are taken turned by the box's own turn and raised to the lid letter, which lies inside them. The tip floats 0.6–1.4 m over the lid in world space, highest over the near row of a close camera; on screen the gap is the same everywhere.
  - **It never covers another box** (the 0.85 × 0.8 size and the 0.12 m bounce are what keep it under the box behind it in a portrait column, the tightest case), and it stays inside the fitted warehouse, so the fit keeps it clear of the HUD, the controls and the banner. `marker.test.ts` projects all of this through every fitted camera.
  - **It tucks away while the robot stands in that pallet's reach** (the rules' own `inReach`: an Action there picks the box), shrinking into its tip over 0.15 s and coming back the same way. From the camera an arrow over the near row covers the floor just behind its box, which is where the robot stands to pick it from the aisle: with the box covering the robot's legs, the arrow would hide the rest of it. A marker that appears beside the robot (a refill landing in its reach) starts tucked away.
- **The floor frame.** A rounded square band 0.28 m wide around the pallet (outer half-size 1.0 m, over the pallet's white bay marks), dark edges and a white middle on a canvas texture that the material colour paints, one `<DynamicInstanced>` lying on the floor (y 0.018) for all four pallets. It is brightest and 5 % wider when the arrow taps down, 70 % opaque at the top of the bounce. It stays while the robot is in reach (it says "this one" when the arrow has tucked away), the box and the robot cover it where they stand on it, and the arrows draw after it (`renderOrder` 3).
- **When.** Only while the robot is empty-handed, as before: a pick hides both at once, the target zone's border takes over while it carries, and the next order's markers appear in the step that draws it. Both pop in with their box (the starting boxes during the countdown, every refill): box and arrow scale together about the pallet's top, so the arrow rises out of its box and none ever hangs over an empty pallet.
- **Cost.** Two draw calls while markers show (the chevrons were one), two 128 px canvas textures uploaded at mount, no allocation per frame (the tuck amounts are one `Float32Array`, the camera axes one object). `renderer.info.memory` stays at 15 geometries, 22 textures and 12 programs from the start of a run to its end.

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| robot | **shared** `models/3d/shared/robot.glb` (on `main`: 18k tris, 613 KB, static T-pose) | `assets/shared.spec.json` | the worker | own stand-in: teal capsule, dark visor with two eyes |
| crate | **shared** `models/3d/shared/crate.glb` (on `main`: 1.5k tris, 100 KB) | `assets/shared.spec.json` | the boxes, **recoloured per colour** (albedo map dropped) | box in the colour with a plank texture and the letter (canvas) |
| shelfRack | **this game** `models/3d/warehouse-rush/shelfRack.glb` | `./assets.spec.json` | the 2 racks | instanced parts: orange uprights, grey shelves, brown cartons |
| pallet | **this game** `models/3d/warehouse-rush/pallet.glb` | `./assets.spec.json` | the 4 pickup pallets | instanced parts: 3 top slats, 3 runners |
| floor, walls, zone tiles, order markers, popups, ring | primitives in code | none | – | (always primitives) |

- **Generate only the shelf rack and the pallet.** Both carry the look: the racks are the obstacles that shape every route, and the pallets mark where boxes come from (a painted square would not read as "pick up here"). Each is placed through `<InstancedModel>`, so the GLB costs one draw call per mesh for all copies. Two text-to-3D props, one attempt each: 2 generations, about 1 credit at 0.5 per generation. The robot and the crate already exist and are not generated again.
- **Universe `warehouse`, seed 5050,** like robot-collector's barrel and the shared crate, so the new props match the crate beside them. The prompts follow the `skills.md` formula (subject, style block, prop suffix). The rack prompt asks for "about four times as long as it is deep" because Rodin normalises the size and only the proportions survive. Its cartons are plain brown, so they never look like the coloured pickups.
- **Tier.** The spec keeps the CLI schema's prop tier (`Gen-2.5-Low`, `qualityOverride` 3000 / 1500) like the other specs. The generation itself runs through the Hyper3D MCP at Gen-2.5-Medium, as batch 1 did (shared crate and battery, robot-collector's barrel). The spend is approved by the user in chat first.
- **Scales come from the GLBs' measured bounds** (accessor min/max): the robot is 1.90 × 1.72 × 0.60 (T-pose, arms out), so `scale: 0.7` makes it 1.2 tall. The crate is 1.88 × 1.34 × 1.81, so `scale: 0.53` gives the 1.0 × 0.71 × 0.96 box on a pallet and the carry scale 0.33 the 0.62 × 0.44 × 0.60 box over the head. The rack and the pallet are scaled in the assets PR to 3.6 × 0.9 × 1.1 and 1.2 × 1.2 × 0.18. Collision never comes from a model: footprints are fixed in `rules.ts`.
- **Colour, not tint.** The crate GLB is one mesh with one material: a base-colour map, a normal map and a metal/roughness map (512 px webp each). The base colour averages sRGB (203, 128, 29), with blue at only 0.031 linear, so a tint multiplied by it cannot make a blue box. The first plan (`color` = the colour lightened 35 % × that map, plus 0.25 emissive) would have given, under the indoor lights with ACES (estimate): BLUE about (91, 97, 146), a slate grey; GREEN olive (hue 101° for 142°); RED and YELLOW both orange, next to the orange rack uprights. So:
  - `Boxes` makes 6 slots, each with its own `useModel(ASSETS.crate)` clone, and 4 cloned materials, one per colour: **`map = null`** (the albedo dropped), `normalMap` and the metal/roughness map kept for the plank detail, **`color` = the colour itself**, no emissive. They are set up before the first render, so no `needsUpdate` is needed.
  - Estimated lid colours with these materials: RED (218, 46, 39), YELLOW (215, 182, 45), GREEN (31, 175, 66), BLUE (31, 109, 180). Each is within 8° of its colour's hue at a saturation of about 0.7. Measured in the browser (lid pixels around the letter, desktop and phone emulation): RED (186–196, 28–53, 31–53), hue 359–0°; BLUE (21–23, 90–93, 162–165), 210–211° (6–7° off); YELLOW (185–203, 151–172, 23–53), 47–48° (3° off); GREEN (20–48, 151–170, 41–77), 134–135° (7–8° off). Saturation 0.54–0.78 everywhere.
  - A slot swaps `mesh.material` when its box changes colour. The game disposes of the 4 materials on unmount; the geometry and the textures belong to the loader cache. A letter decal (a small plane, 4 canvas textures) sits on each lid.
- `assets.ts` (it also exports `BOX`, the 1.0 × 0.71 × 0.96 box size the stand-in and the lid letter use):

```ts
export const ASSETS = {
   robot: { ...SHARED_ASSETS.robot, scale: 0.7 },
   crate: { ...SHARED_ASSETS.crate, scale: 0.53 },
   shelfRack: { id: "shelfRack", url: "/models/3d/warehouse-rush/shelfRack.glb", fallback: "box", fallbackColor: "#fb923c", budget: { ...PROP_BUDGET } },
   pallet: { id: "pallet", url: "/models/3d/warehouse-rush/pallet.glb", fallback: "box", fallbackColor: "#d6a46b", budget: { ...PROP_BUDGET } },
} satisfies Record<string, ModelAsset>;
```

- The robot and the crate are in `core/modelManifest.ts`, so they load from the first run (713 KB). The rack (183 KB) and the pallet (67 KB) are listed too since group A (2026-10-06). The rack GLB is turned a quarter and stretched to one 1.8 x 1.1 x 0.9 bay pair (`assets.ts`), two copies per rack (`Primitives.tsx` `RACK_MODEL_SPOTS`); the pallet is scaled to 1.2 x 0.18 x 1.2. The instanced primitives stay as the fallback.

## HUD

- **Shell HUD:** Score, Time (counting down from 1:00, highlighted under 10 s) and `hudStats: [{ key: "delivered", label: "Delivered" }]`. At 375 px it is one row, like robot-collector's (Score, Time, Batteries).
- **Order panel** (`Hud.tsx`). Two layers:
  - **The wrapper** is the one element marked `data-arcade-safe-area`: a fixed 260 × 44 px box (`width` and `height` set, `box-sizing: border-box`), always mounted, never keyed, never conditionally rendered, and never transformed or animated. Every safe-area measure therefore returns the same rect. This matters because the core tracker re-measures the game HUD on every child-list change inside it (an icon toggling, a keyed remount), and `getBoundingClientRect` includes transforms while `ResizeObserver` never reports them. A marked element caught mid-shake would leave a shifted rect in the fit, and the camera would refit or ease mid-run.
  - **The inner pill** carries everything that moves: a dark pill like the shell chips with a 2 px border in the order colour. A new `drops` value restarts a short flash on it (green on +50, red with a shake on a wrong zone). It may be keyed per delivery like office-escape's toast, because a remount inside the wrapper only re-measures the unchanged wrapper rect (the store ignores the same layout). Paused, the animation waits.
  - **Content**, one line, 14 px bold, `white-space: nowrap`: **BLUE box → Zone B**, then a 20 px box icon that fills with a ✓ while the robot carries the box. There is no colour square: the letter is in the text and the colour is in the border. The longest copy, "YELLOW box → Zone C", is 10.6 em (measured in Segoe UI bold), 148 px at 14 px. With 12 px padding on each side, an 8 px gap and the icon that is 200 px, 60 px inside the fixed 260 (221 px even at 16 px). The text box also gets `overflow: hidden; text-overflow: ellipsis` as a safety net. The panel never grows. (The first draft, "Deliver YELLOW box → Zone C" with a colour square, was 14.1 em of text and about 290 px in all, over 260.)
  - **Placement.** On screens 600 px wide or more it sits in the HUD row, its right edge 8 px left of the mute and pause buttons (112 px from the canvas edge), so it never meets the Score / Time / Delivered chips (they end at 218 px). Centred it would overlap them below 712 px, for example on a 667 × 375 phone. Narrower screens show it centred under the HUD row (top 62 px). These are the rects of the fit table above; the width stays 260, so the table and the 600 px threshold stand.
  - It reads `stats.order`, `stats.carry`, `stats.drops` and `stats.delta`. The wrapper is `role="status"` with `aria-live="polite"` and announces each new order in words (visually hidden text, "Deliver blue box to zone B"). The first order is on the panel from the first countdown frame (published in the store update that starts the run, "Publishing to the store"). "Get ready" shows only in the loading and ready frames, while the game HUD is laid out hidden.

`index.tsx`:

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
- **Countdown:** the robot stands on its start spot, the first order is already on the panel (published in the store update that starts the run), presses are dropped (no `useRunFrame` before "playing").
- **A press on the frame the clock runs out:** `RunClock` ends the run first, `useRunFrame` does not run, the drop does not count. Deterministic, never a double end.
- **A refill and a delivery in the same step:** the refill lands first (step 2), so the order draw already sees the new box.
- **Same frame:** E and Space give one action. Holding Action acts once (no auto-repeat).
- **Joystick held during a lock:** ignored. After the lock the robot starts from rest (30 u/s², top speed after 0.2 s).
- **Driving into a pallet to pick:** collisions keep the robot outside; reach is measured from its centre, so touching (0.5) is enough.
- **Wrong zone at 0 points:** the score stays 0, the popup shows ✗, the next order comes as usual.
- **Resize or rotation mid-run:** the yaw is picked again for the new size and the controls follow it at once (core). The rules do not depend on the view.
- **Retry and restart** remount the Scene (`key = runId`): new seed, new layout, new streams. Nothing carries over: the outgoing Scene makes the new run in the store update that starts it and publishes its first order there, before its first countdown frame; the new Scene takes that run over (and clears the hand-off on mount, so a later remount with the same `runId`, a stage-error retry, makes a fresh run). React strict mode calls the `useState` initializer twice; both calls take the same prepared run, which is harmless.
- **Missing or broken GLB:** its primitive (`<Model fallback>`, `<InstancedModel fallback>`; boxes: `useModel(...).failed`). Collision never depends on a model.

## Test plan

`rules.test.ts` (vitest):

- **Constants (golden).** Every number in "Constants" is pinned, and so are the derived ones: `MIN_LEG` 2.1, `CYCLE_MIN_MS` 1270, `FIRST_DELIVERY_MIN_MS` 1151.3 (±0.1), the earliest-time table (1151.3, 2873.3, 4666.9, 6460.5, …, 58474.5, 60268.1, then 1793.6 ms per delivery), `maxDeliveriesBy(60000)` = 33, `maxDeliveriesBy(5000)` = 3 and `SCORE_BOUND` 1650 (step 6 alone: 2350). The derived ones are also recomputed from the tuning numbers, and the first 4 table entries by brute force over every pick-and-zone sequence, so changing a speed, a lock, a slot, the reach or the refill delay without updating the proof fails. The scoring limits equal `meta.ts` (1700 at 60000 accepted, 1701, 56999 ms and 63001 ms rejected, the 29/s line from 58621 ms), and the bound stays under min(1700, 29 · t) from 57 s to 60 s.
- **Layouts.** `generateLayout` is deterministic per seed. 20,000 seeds reach all 216 layouts and every one passes `isValidLayout` (a permutation of the 4 colours, exactly 2 slots per row). `isValidLayout` rejects a repeated colour, 3 pallets in a row and a pallet off the slot grid. One connected free region (flood fill) holds every reach and every zone in all 216. The mean shortest pallet-to-zone leg lies in 6.3–6.8 for all 9 pallet sets. The reaches never overlap, and every zone is ≥ `MIN_LEG` from every reach. Golden draws for three seeds: the zone corners, the pallet slots and the first 12 box colours.
- **Streams.** The three streams are independent: the layout and the box colours are the same whatever the player does (a bot run and an idle run of one seed). Changing the order stream's seed changes no layout or box colour.
- **Movement.** Top speed exactly 6 empty and 5 carrying; diagonals are not faster; the stick is analog (half a stick = half the top speed); an input longer than 1 is normalised (a diagonal into a wall slides at 6 · √½); it accelerates from rest and brakes to a stop; it stops at racks, pallets and walls and slides along them. 20,000 random steps (random input, random dt, random carry state) never move more than the cap · dt, never enter a rack or a pallet, never leave the floor. The speed guard is needed: two pinned full-speed corner grazes (one empty, one carrying) are pushed more than 3 % past top · dt, and the guard trims each to exactly top · dt. dt ≤ 0 does nothing; a stopped robot keeps its heading.
- **Action.**
  - Pick only in reach: at exactly 0.8 from the pallet edge it picks, at 0.81 nothing happens. Only an order-coloured box can be picked; another colour is refused with no lock and no score.
  - Deliver only with the centre inside a zone: x = 6.5 delivers, x = 6.49 does nothing (both inside the z range).
  - The reach and zone edges are exact, as `MIN_LEG` assumes: 1e-6 past the 0.8 reach or a zone's inner edge does nothing.
  - A pick or a drop while moving stops the robot in that same step, and `lastZone` is the drop's corner.
  - Right zone +50; wrong zone −20; the floor: 10 → 0 with a change of −10, 0 → 0 with 0. The score is always a multiple of 10. Delivered counts right deliveries only.
  - Every delivery draws the next order in the same step. Presses during a lock are dropped. The step that brings `lockMs` to 0 does not move; the next one does. A carrying robot in reach of a pallet does nothing.
- **Refills.** A refill lands on the first step with `simMs ≥ delivery + 1500` and not one step earlier, on the pallet empty longest (ties: lower index), with the next box-stream colour, before that step's move and action. A refill due during a pick or drop lock lands on time (step 2 runs before the lock).
- **Invariants under random play** (2000 seeds × 60 s, random and mashing inputs, 144 / 60 / 30 fps and random 1–50 ms steps): boxes in play + pending refills = 4; pending ≤ 2; ≥ 2 occupied pallets at every order draw; a box of the order colour is always on a pallet or in the grip; no pallet ever holds two boxes; the carried box always has the order colour.
- **Proof.**
  - The real store (`createArcadeStore`), driven with `advanceRunClock` and `playedFrameDt` like robot-collector, through countdowns, pauses, resumes and frames from 4 to 300 ms: no untimed step, and moving time + lock time ≤ `elapsedMs`. A 0.4 ms frame that adds no whole ms never moves the robot (it moves only for counted ms).
  - Deliveries are always ≥ 1270 ms apart, the first is ≥ 1151.3 ms, and the k-th is at or after the earliest-time table, for the bots below and the random inputs above. Every refill lands on the pallet of the matching pick (the refill lemma).
  - A **forced-luck drill**: before the first pick and after each delivery the test rewrites only the colours of the boxes on pallets (and of a refill when it lands) and the order, choosing 3 cycles ahead over the path fields with the real refill timing, and the path bot drives. Over all 9 pallet sets at 4 frame patterns it scores 1300–1450 (asserted ≥ 1300, so it stays meaningful), never more than 1650, and every delivery is at or after the table. (The old worst-case drill put a box back on the pallet it had just emptied, which the refills never do, and scored about 2000.)
  - At every frame of every run: `score ≤ scoreBoundAt(simMs)` and `score ≤ 1650`. `withinServerLimits(score, 60000)` holds and `capScore` is a no-op for every final score.
  - An idle robot times out with 0 at exactly 60000 ms.
- **Fairness bot.** A path-following bot (grid shortest paths, the real `stepRobot`, 60 fps) plays 1000 fixed seeds: every order is finished, the 1st–99th percentile of its delivery counts lies within ± 3 of their median, and every seed within ± 5 (bands in deliveries, not percent: see Fairness). Its median is pinned too (± 1 delivery), from its first run: **18**, the prototype's number.

`marker.test.ts` (vitest, looks only): `marked` is true exactly for the boxes of the order colour while the robot is empty-handed, never for an empty pallet; the arrow tucks away exactly inside the rules' reach (`PICK_GAP` from the pallet's edge, not 0.01 beyond) and at no pallet from the start pad; the bounce stays between the clear height and the bounce height and taps down at t = 0, every 0.8 s; the pop-in scales the tip's height over the pallet with the box; the tuck takes `tuckS` and a paused frame (dt 0) changes nothing; the frame's opacity and swell stay in their band. Through the game's cameras (pitch 56°, fov 45, both yaws, distances 15–150 m: every fit lies in that range, the nearest is 15.3 m on a screen wide enough for the height to bind, and the portrait yaw only wins from about 24 m): at the bottom of its bounce the arrow stays above every box (any slot, turned 0 or ±0.09, at pop scales 0.25 to the 1.1 overshoot) and above its lid letter, with the gap at full size between 0.12 and 0.14 m at the box; the tip floats 0.6–1.4 m over the lid; at the top of its bounce the whole arrow stays inside the projected warehouse box (so never under the HUD, the controls or the banner the fit avoids); settled, it never covers the box on another pallet (the next one up a portrait column is the tightest); neighbouring frames never touch and each clears its pallet; a camera that does not look down keeps the arrow just over the lid. Mutation-probed (each fails a test): marking while carrying, marking every colour, ignoring the box's turn, no gap, the tip not scaled with the pop, the lid without its letter, a tuck that moves while paused, a 1.0 m tall arrow, a 0.3 m bounce, a reach that is not the rules', frames 1 m beyond the pallet.

`gait.test.ts` (vitest, looks only): standing still or for no time the phase does not advance; with the walk's full amount up to 3 m/s the stride is the walk's own × 0.7; a still pose (stride 0) steps by the 0.1 m minimum; at the scene's steady amount (speed / 6) from 0.5 to 6 m/s, the 5 m/s carry speed included, the cadence is exactly the cap's 4 strides a second and the stride at most 1.6 × the walk's own. Mutation-probed: the pose's amount at 0, no cadence cap, a cap of 5, no minimum stride, scale 1 and a doubled speed each fail a test.

The generic parts are tested in `core/`: the clock and the frame order (`frameLoop.test.ts`, `useArcadeStore.test.ts`), the fit, the lens shift and the yaw lock (`view.test.ts`, `useFittedView.test.ts`), `rngNext` (`math.test.ts`), the manifest and instanced models (`modelManifest.test.ts`, `assets.test.ts`).

Browser (production build with the flags on and the API mock, headless Chrome over CDP, network log on):

- **Desktop 1280 × 800, keyboard:** start, countdown (the order is shown, the robot does not move), 3 right deliveries, a refused pick at a wrong colour, 1 wrong zone (−20 on the panel and in the score), a 2 s pause with a refill pending (it lands 1.5 s of play after the delivery, not 1.5 s of wall time), then the time-up at 1:00. Score = the rules' formula for the deliveries made; duration 60000.
- **375 × 812 and 812 × 375 with touch emulation** (joystick + Action), with and without the cookie banner: the fit matches the table above within ±2 px; the floor stays clear of the panel, the joystick and the Action button; the order panel sits under the HUD row in portrait and in it in landscape.
- **Order panel:** the marked wrapper's rect is the same (±0.5 px) before, during and after a right-zone flash and a wrong-zone shake, and the safe-area store publishes no new layout during the run (no camera refit). The text box of "YELLOW box → Zone C" has `scrollWidth ≤ clientWidth` (one line, no clipping). The panel shows the first order on the first countdown frame after start, retry and restart.
- **Box colours:** the 4 box materials have `map === null` and `color` equal to their zone colour, with the normal map kept. The lid of each box (pixels read around its projected centre) averages within 15° of its zone colour's hue at an HSL saturation of 0.4 or more. A hue check alone would not be enough: the textured tint passes ± 20° for red, yellow and blue, and only the saturation (blue 0.23) and green's hue (41° off) catch it.
- **Carry:** with the robot pushed into each zone corner at 8 headings, the carried box's bounding box stays inside the floor (|x| ≤ 10, |z| ≤ 6) and above the walls.
- **Checks:** draw calls ≤ 150 and 60 fps on desktop and in phone emulation; requests only for `robot.glb` and `crate.glb` (no `shelfRack` / `pallet` request before the assets PR); `renderer.info.memory` constant from 5 s to 55 s.

**Results of the build PR** (2026-10-06; `next build` + `next start` with the three flags on, headless Chrome 154 over CDP, GPU NVIDIA GTX 1660 Ti through ANGLE / D3D11; the three.js renderer read through the `__THREE_DEVTOOLS__` hook). Five full runs, 25 checks each, all passed: 1280 × 800 keyboard (WASD, E and Space alternating), 375 × 812 and 812 × 375 with touch emulation (joystick drags and Action taps at the real controls, dpr 2), each phone size with and without the cookie banner.

- **Fit** (projected `WAREHOUSE` box against the live rects) reproduces the table: 1280 × 800 x 26–1254, y 154–695, 1100 / 796 px, gaps HUD 102 / panel 100. 375 × 812 x 8–367, y 210–642, 326 / 249 px (27.2 / 20.7 px/m), gaps 156 / 104 / 18 / 78. With the banner x 34–341, y 115–490, 279 / 220, gaps 61 / 9 / 8 / 68. 812 × 375 x 160–710, y 78–322, 493 / 361, gaps 34 / 24 / 8 / 10. With the banner x 175–637, y 62–273, 420 / 320, gaps 18 / 8 / 23 / 83. The fit on the start screen, during the countdown, all run and after a retry is the same; the camera never changed while playing.
- **Play:** the robot stays on its pad with W held through the countdown; a refused pick (no carry, no score, the box shakes 0.08–0.11 m); 9–10 right deliveries (+50, a new order, a green flash) and 1 wrong one (−20, a red flash and shake) per run; the final score equals the formula for the deliveries made (430–480) with duration 60000.
- **Timing:** the refill after a delivery landed 1507–1536 ms of play later with a 2.2 s pause in between (3.7 s of wall time); the time-up came at 60.0 s of play; the result panel appeared 800–817 ms after the end; the first order was on the panel on the first countdown frame after Play and after Retry (before the run hand-off: "Get ready" for 37 ms after Play, 10 ms after a restart).
- **Order panel:** the wrapper's rect never changed during a run (flashes and shakes included); "YELLOW box → Zone C" with the ✓ is 158 px in a 158 px text box (one line, no ellipsis).
- **First countdown frame, re-checked** (core lens fix, 2026-10-06; 1280 × 800, 375 × 812, 812 × 375; CDP mouse clicks, touch taps and scripted `element.click()`): on the first rendered frame with the countdown after Play, Retry and Pause → Restart the panel shows the new run's order, and no frame in between shows "Get ready". A probe that reads the DOM in the same script right after a scripted `click()` runs before React commits: it still sees the result screen (panel hidden) or, after Restart, the previous run's order. One microtask later the countdown and the new order are there together. Read on a frame, not synchronously after the click.
- **Lens shift across remounts** (same check, no game-side workaround): at 812 × 375 the camera's view offset (−28.75 px, the floor at x 160–710) and its projection matrix are identical on the start screen and in every countdown and run after Play, Retry and Restart; at 1280 × 800 and 375 × 812 the fit has no shift and stays the same too.
- **Carry:** in a zone corner, driving into the corner and along both walls, the carried box stayed inside |x| ≤ 9.9, |z| ≤ 5.9 with its bottom at 1.24 m or higher.
- **Box colours:** materials `map === null`, `color` = the zone colour, normal and metal/roughness maps kept; lid pixels in "Assets" (all within 8° at saturation ≥ 0.54).
- **Checks:** 21–23 draw calls and about 25k triangles per frame; 56 fps (headless Chrome's frame rate) on desktop and in phone emulation; `renderer.info.memory` 17 geometries, 14 textures, 10 programs at 5 s and at 55 s; the only `.glb` requests are `shared/robot.glb` and `shared/crate.glb`; no failed request, no console error or warning.

**Order markers, browser check** (2026-10-08; `next build` + `next start` with the three flags, headless Chrome 154 over CDP, ANGLE / D3D11; cookie banner open; a bot driving the real keyboard input along the aisles): 1280 × 800, 390 × 844 (touch emulation, dpr 3) and 812 × 375 (touch, dpr 2), 3–4 deliveries each, all four order colours across the runs. Every check passed: during the countdown one arrow and one frame per box of the first order; every arrow straight over a box of the order colour (tips 1.65–2.17 m); in the pallet's reach the arrow tucked away and the frame stayed, and the robot behind a near-row box showed whole; carrying, no arrow and no frame; after each delivery the next order's markers in its colour; paused, the arrows' matrices and the frames' opacity frozen, moving again after Resume. The arrows never touched a box, a lid letter or the box behind in a portrait column in any shot. 17–20 draw calls; `renderer.info.memory` 15 geometries, 22 textures, 12 programs at the start and the end of every run; no console error or warning.

## Known issues and core gaps

- **The time-up plays the "lose" jingle.** GameShell plays `"win"` only for `endReason === "win"`. Every Warehouse Rush run ends on the clock, so even a record ends on the sad sound (the title "Time's up!" is fine). Core candidate: a neutral time-up sound for points games without a win state, or `"win"` on a new best.
- **No per-copy tint for GLB instances.** `<DynamicInstancedModel>` and `<InstancedModel>` draw a GLB with its own material, and `InstancePart.colors` applies only to stand-in parts (one colour per piece, the same for every copy). The game therefore clones 4 materials and draws up to 6 boxes as separate meshes. That is cheap at this count. Core candidate: per-copy `instanceColor` for GLB parts, which would make all boxes one draw call.
- **No success or error sound in the core.** The game maps pick → `"pickup"`, right → `"pickup"`, wrong → `"hit"`. Core candidate: `"success"` / `"error"`.
- **Run-start stats need a hand-off.** The R3F root remounts the Scene a task or more after the store update that starts a run, so a Scene cannot publish run-start HUD stats in time from its own mount (1–2 frames of "Get ready"). The game prepares the next run in a store listener of the outgoing Scene (module-level hand-off, "Publishing to the store"). Core candidate: a GameDefinition hook that runs in `beginRun`'s store update (for example `onRunStart(runId)`), or a Scene mount that happens in the same task.
- **The robot GLB is a static T-pose** (no clips, not rigged). The core auto-rig animates it in code (walk cycle, flat feet on the floor, arms up under the carried box); the squash on pick and drop is code too. The carried box rides over its head, inside the collision radius (Scene and camera). The raised hands stop about 4 cm under the box: the robot's arms are too short to reach a box that clears its head.
- **The feet slide.** The cadence cap (4 strides a second, `gait.ts`) stretches the stride past the walk's own at every steady speed, so the planted foot slides about a quarter to a third of a step (24 % at a walk, 37 % at 5–6 m/s). Uncapped, the small robot's legs would blur at 5 to 6.4 strides a second.
- **Order luck.** Perfect play spreads 16–21 deliveries (800–1050) over seeds, −2 / +3 around the median of 18. That is accepted arcade luck. The test pins the spread in deliveries (± 3 for the 1st–99th percentile, ± 5 for every seed), so it cannot widen unnoticed. If it does, the fix is in the rules (a colour bag for the orders), not a wider band.
- **Inherited from the core:** the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll, so the camera eases to its new fit up to a second after the banner opens or closes.
