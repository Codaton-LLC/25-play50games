# Obstacle Race

Owner: Claude. Slug: `obstacle-race`. Game 10 of the 3D Arcade: the only time trial with a course, checkpoints and respawns. **This file is the design.** The rules (`rules.ts`, `rules.test.ts`, the proof below) and the playable scene (`Scene.tsx`, `Primitives.tsx`, `camera.ts` + `camera.test.ts`, `assets.ts`, `index.tsx`, the thumbnail) are built; the status stays `"soon"` until the time-game HUD core change (Known issues). The Rapier debris layer missed its cut line in the build PR, so this build loads no Rapier at all (`physics: false`) and the debris is a follow-up (Physics, "Cut line"). The limits in `meta.ts` are correct as they are (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. Unchanged by the build except `thumbnail` (`/images/3d/obstacle-race.webp`, 640 × 360, rendered from the game). |
| `index.tsx` | The `GameDefinition`: Scene, assets, `physics: false` (the debris layer missed its cut line; `true` returns with it), no `durationMs` (the rules own the 300 s cap, so the shell shows "Played" counting up), camera, environment, `touchControls: ["joystick", "jump"]`, `hudStats`, instructions, `resultDelayMs`, `finalScore` (rules.ts: the exact finish ms). |
| `camera.ts` | The follow-camera constants (`FOLLOW_X`, `LAG`, `FOCUS`, the `PORTRAIT` / `LANDSCAPE` views, `viewFor`) and `followPoint`. Pure. |
| `rules.ts` | Everything that decides the outcome: the fixed course as data, the integer-ms clock and its 300 s cap, kinematic movement with closed-form jumps, collisions, the moving obstacles as functions of rules time, the bar knock, checkpoints, falls and respawns, the finish, the proof constants. Pure: no three.js, React, DOM, Rapier, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`: the golden constants, course checks, movement, obstacles, checkpoints, the minimum-time proof driven through the real store clock, and "nothing flows back" from the debris layer. |
| `camera.test.ts` | The fit table below, from core `fitView` with the fixture rects; the runner, every section's full width and the next landing target inside the window. |
| `Scene.tsx` | The frame loop: maps input, calls `step`, reports events to the store (`end("timeup")` included), keeps the follow point, places the fitted follow camera (and cuts it on a respawn), draws the run. |
| `Primitives.tsx` | Course look: pads, bridges, pillars, the sweeper disc, hub and bar, the blocks, the beam, the water, checkpoint gates, the stand-in runner and the stand-in arch. |
| `debrisPose.ts` | **Follow-up (not in this build).** The pure part of the debris layer: `debrisPose(run, stepping, sink)`, from a read-only `run` and whether Rapier steps this frame (phase `"playing"`), the pose of the runner capsule, the bar, the blocks and the beam, and whether each one moves or teleports this frame. Writes into a sink, never into `run`; no Rapier import. |
| `Debris.tsx` | **Follow-up (not in this build).** The Rapier layer: foam cubes the runner can kick into the pool. Feeds `debrisPose.ts`'s poses to the bodies. The only file that imports `@react-three/rapier`. Never read by the rules. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the one model only this game generates (the finish arch). |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, pure `rules.ts` with tests that prove the limits through `advanceRunClock` and `playedFrameDt`, the run state made once in `useState`, one `useRunFrame` that calls `rules.ts` and then the store, visuals in `useFrame` with `useGameTime()`, the `useFittedView` + `CameraRig` block, `<Model fallback>` for models. Games never import each other.
- **This game adds five patterns** (copy, never import):
  1. **A distance proof for a time game.** A cap on forward progress per rules ms, plus a respawn that never lands ahead of where the runner already was, gives a minimum finish time from the course length alone. No obstacle has to be part of the proof.
  2. **Fixed 1 ms steps with closed-form jumps.** The arc depends only on the ms since take-off, so a jump is the same at 30, 60 or 144 fps.
  3. **The exact finish ms.** The rules record the ms in which the finish happened; the Scene publishes it with `setStat("finishMs")` before `end("win")`, and `finalScore` submits it, so the frame rate never costs a player time.
  4. **Rapier for looks only** (designed; the layer is a follow-up, see "Cut line"). Physics bodies are posed from the rules every frame and nothing flows back. A jump in a pose (a respawn, a run start, a pose set while Rapier is paused) is a teleport, never a swept kinematic move.
  5. **A fitted window around a follow point.** `useFittedView` fits a box *relative to* the followed point, with the camera's lag as `focus`, so the fit holds anywhere on a 126 m course.
- **Do not copy:** the playground primitives, the debris, the runner tumble. They are decoration for this game.

## Concept

The Play50 Runner sprints over an inflatable obstacle course floating on a pool. Jump a spinning sweeper bar, hop five rising platforms, ride sliding blocks across a gap, keep your balance on a rocking beam, and run under the finish arch. Falling into the pool (or being knocked off by the bar) sends you back to the last checkpoint, and the clock keeps running. Your finish time is your score. The course is the same every run, so times are comparable and you can learn it. The look is the Play50 vinyl-toy style on a sunny pool, accent `#6366f1` (the checkpoint gates and the runner's ring).

## Controls

Matches `meta.ts` (`scheme: "platformer"`): "WASD to move, Space to jump" and "Joystick + Jump button".

- **Keyboard.** WASD or the arrows run (core `moveX` / `moveY`; a diagonal is normalised, not faster). Space jumps (`jumpPressed`). Esc or P pauses (GameShell).
- **Touch.** The joystick (bottom left, analog: half a push is half the speed) runs, the Jump button (bottom right, 72 px) jumps. `touchControls: ["joystick", "jump"]` as in the stub. No swipes or taps.
- **Direction.** The camera never turns (yaw 0 on every screen), so up is always forward along the course: `inputToWorld(moveX, moveY, 0)`.
- **Jump.** One press, one jump: a held Space or Jump button never jumps again. A press up to 120 ms before landing is kept and jumps on landing (buffer); a press up to 100 ms after walking off an edge still jumps (coyote time). No double jump and no variable height.

## Physics: kinematic rules, Rapier for looks (decision)

The design question was (A) Rapier bodies for the runner and the obstacles, with the course layout and checkpoints in `rules.ts`, or (B) kinematic movement in `rules.ts`, with Rapier only for looks. **This game uses (B).** For a time game the anti-cheat question is "can any input finish faster than the server's 15 s floor?", and that has to be proven from the rules. With (A) the answer would depend on the solver and on the frame rate:

| | (A) Rapier runner | (B) kinematic rules (chosen) |
|---|---|---|
| **Clock.** The proof needs motion only for counted play time. | Core `PhysicsGate` renders `<Physics paused={phase !== "playing"}>` with Rapier's defaults (checked in `@react-three/rapier` 1.5.0): a fixed 1/60 s step with its own accumulator, fed by R3F's raw frame delta clamped to **0.5 s**. The run clock counts at most **50 ms** per frame. A device at 5 fps (or a CPU throttle) simulates 200 ms per frame while `elapsedMs` grows by 50, so the runner covers 4× the course per counted second. A 0.5 s hitch is 10×. Pause also starts and stops on a React render, not on the clock's frame. | `useRunFrame` hands the rules exactly the counted play time. The rules turn it into whole ms (carried remainder) and step 1 ms at a time, so motion never runs ahead of `elapsedMs`. |
| **Frame order.** | Rapier's `useFrame` has no priority (0, the visuals slot), so it steps after `CameraRig` (−0.25): the camera follows last frame's body, and meshes are interpolated between steps. | Simulation (−0.5) before camera and visuals, as in every game. |
| **Determinism and fairness.** | Contacts, friction and kinematic pushes depend on the step size and contact order, so 60 Hz and 120 Hz players get different runs from the same input. A kinematic bar hitting a dynamic runner hands it the bar's speed (6.5 m/s at the tip), in any direction, forward included. Rapier's cross-platform determinism needs its separate enhanced-determinism build; the installed `@dimforge/rapier3d-compat` 0.14.0 is the standard one. | Fixed 1 ms steps, closed-form arcs, obstacles as pure functions of rules ms. The same frames and inputs give the same run, bit for bit. Every push is a rule with a bound. |
| **Testability.** | Vitest would need the WASM, and the proof would rest on the solver (character-controller snapping, contact launches). | Plain functions: 50,000 random steps in one test, and a proof whose every step is a test. |
| **Mid phones.** | The compat package inlines its WASM: `rapier.es.js` is 2.06 MB, **767 KB gzipped** (measured), plus WASM start-up. A dynamic runner would make it required. | The rules cost under 0.1 ms per frame (at most 50 steps × about 25 boxes). Rapier becomes optional. |

**Rapier's part (the catalog's "Rapier physics").** `physics: true` loads it for one layer, `Debris.tsx`:

- 4 stacks of 6 foam cubes (0.45 m) at the edges of the start pad and the three checkpoint pads, away from the spawn line. The runner can kick them over and into the pool. One `<InstancedRigidBodies>` (24 cubes, one draw call); a cube below −2.2 m sinks out of sight and sleeps.
- Every solid of the course is mirrored as a fixed collider, built from the same `COURSE` data the rules use. The bar, the blocks and the beam are kinematic bodies posed every frame from the rules functions, so a cube on the disc gets swept into the pool. The runner is a kinematic capsule posed from `run` after each step: it pushes cubes and is never pushed.
- **Teleports are placed, not swept.** `setNextKinematicTranslation` / `setNextKinematicRotation` turn a pose change into a velocity for the next step, so a jump in the pose would launch every cube it touches. A respawn moves the runner up to about 25 m (water to the checkpoint line), and while Rapier is paused (core `PhysicsGate`: every phase but `"playing"`) the Scene keeps turning the bar for looks, so the first step after "Go" would sweep it from the pose Rapier last stepped (the 3 s countdown turns it 3.3 rad, all in one 1/60 s step). `debrisPose.ts` therefore marks a pose as a **teleport**, written with `setTranslation(…, true)` / `setRotation(…, true)` (no swept velocity), on mount, whenever `run.respawns` changes, in every frame where Rapier does not step (phase not `"playing"`), and whenever a body would move more than 1 m in one frame (a guard). Only an ordinary step uses `setNextKinematic*`.
- **Nothing flows back.** The rules never import Rapier, and the Scene never writes a Rapier result into `run`. This is proven in vitest, not in the browser (frame times vary between headless runs, so two browser runs of one key script never give the same `finishMs`, with or without Rapier): a source check that `@react-three/rapier` and `@dimforge` appear only in `Debris.tsx` (not in `rules.ts`, `debrisPose.ts` or `Scene.tsx`, and `Scene.tsx` never calls a body's `translation()`, `linvel()` or `rotation()`); and one fixed frame list replayed through `step()` twice, once with `debrisPose` writing into a recording stub sink after every frame and once without it, ending in deep-equal run states, with `run` deep-equal before and after every `debrisPose` call.
- **Cut line.** The build PR measures the layer on a mid-phone profile (Chrome, 4× CPU throttle, Fast 4G): Rapier's step under 1 ms per frame, and "ready" no more than **0.5 s** later than without it. `PhysicsGate` suspends the Scene until the chunk (767 KB gzipped) has loaded and its WASM has started, so the start screen waits for 24 decorative cubes. That is worth half a second at most. If either measurement fails, the game ships with `physics: false` and without `Debris` (no chunk, no cost), and the debris returns in its own follow-up PR once the measurement passes. Rules, proof, camera and leaderboard are the same either way.
- **Measured in the build PR (2026-10-06): it failed, so this build ships `physics: false`.** A measurement build with `physics: true` and a representative layer (24 cubes in one `<InstancedRigidBodies>`, the pads, bridges and platforms as fixed cuboid colliders) against the shipped build, production `next start`, headless Chrome over CDP, cold cache, 1280 × 800, "ready" = the store's first `"ready"` after navigation:
  - **4× CPU:** median 6.90 s with Rapier (9 loads, 5.28–10.98 s) against 5.19–6.29 s without (median of two batches of 8 and 5 loads), so **+0.6 s or more**. The sampling profiler shows why it cannot pass: the two Rapier chunks (`@dimforge/rapier3d-compat`, 2.0 MB decoded, and `@react-three/rapier`, 25 KB) alone take **270–300 ms** of main-thread JS before "ready", native parse and WASM compile ("(program)") about **+0.3–0.4 s** more, and the main thread was busy 6.8 s instead of 4.7–4.9 s in the paired runs.
  - **4× CPU + Fast 4G:** median 8.19 s with Rapier against 6.86 s without (5 loads each): **+1.3 s**; the 2 MB chunk shares the link with three.js.
  - Without Rapier the chunk is never requested (checked in every playtest below). The follow-up needs a core change first (the README "Known issues" `PhysicsGate` candidate: a decorative mode with its own Suspense, so the start screen never waits for looks), then `debrisPose.ts`, `Debris.tsx` and their "nothing flows back" tests as designed here.
- **No ragdoll.** The shared runner has no concept art yet, a ragdoll needs a rigged skeleton with about ten bodies and joints, and a fall lasts under 1.5 s before the respawn cut. A scripted tumble (spin, flailing limbs on the primitive) reads the same on a phone.

## Constants

1 world unit = 1 m. Forward is −z; **progress** p = −z. All of these live in `rules.ts` and are pinned by a golden test.

| Name | Value |
|---|---|
| Rules time | whole ms (`simMs`), fixed **1 ms steps**, at most 50 per frame (`useRunFrame` dt ≤ 1/20 s). The fraction is carried to the next frame. |
| Runner | circle radius 0.35 in x/z, height 1.5 (feet to head), drawn 1.5 tall. Starts at x = 0, feet y = 0, p = 0, facing forward, at rest, in state **run** (the countdown is the start freeze; `SPAWN_MS` applies to respawns only). |
| Run speed | `V_RUN` **6.0 m/s** at full stick; the stick is analog. Acceleration 40 m/s² on the ground (also braking), 20 m/s² in the air. From rest, full speed takes 150 ms and 0.453 m (1 ms steps: ease, then move). |
| Jump | gravity `G` 25 m/s², `V_JUMP` 8.5 m/s, closed form `y = y0 + 8.5·t − 12.5·t²`: apex **1.445 m** at 340 ms, **680 ms** in the air on the flat. |
| Coyote / buffer | 100 ms / 120 ms, inclusive. Gravity runs from the walk-off ms, so a coyote jump starts from the fall's current height (`y0` at most 0.125 m below the top). |
| Support grace | `FOOT` 0.2: the runner stands on a top while its centre is within 0.2 m outside the top's edge. |
| Carry | grounded on a block: the block's own Δx each ms; on the beam: the slide. In the air the take-off carry is kept (launch carry). **x only, never z.** |
| Sweeper | disc radius 6, top 0. Hub radius 0.7, 1.6 tall, solid, not a support. One bar through the hub: arms out to 5.9, 0.35 thick, 0.25–0.70 m above the disc. ω 1.1 rad/s (period 5712 ms), angle `ω · simMs / 1000`, along ±x at 0. |
| Knock | a bar hit flings the runner off the disc: vx = 12 m/s away from x = 0 (+x at x = 0), vy = 8, vz = 0, no collisions, no input. The sideways part stops (vx = 0) in the first ms in which the runner's circle overlaps no top any more (the disc, the bridges): \|x\| ≤ 6 + 0.35 = **6.35**, reached within 529 ms, before the feet are back at the top's height (640 ms). The runner then drops straight into the pool, in view (Scene and camera). |
| Blocks | 5 slabs, 2.4 (x) × 2.2 (z) × 0.6, top 0. x = 2.4 · (2s − 1) with s = smoothstep of a triangle wave (`u = frac(t / 4000 + φ)`, `w = 1 − |2u − 1|`, `s = w²(3 − 2w)`), phases φ = 0, ½, ¼, ¾, ½. Top speed 3.6 m/s, smooth turns, no trig. |
| Beam | 20 × 1.0, top 0. Slide `v = 1.8 · (2s − 1)` m/s along x, the same wave with period 3200 ms. Drawn tilting ±10° in phase. |
| Kill plane | feet below `KILL_Y` −1.5: the runner is lost. Water drawn at −2.0. |
| Lost / spawn | `LOST_MS` 600 in the water, then a respawn at the active checkpoint and `SPAWN_MS` 300 frozen. The clock keeps running. |
| Run limit | `DURATION_MS` 300000 (= `timeBaseMs`), owned by the rules: the ms that brings `simMs` to 300000 moves nothing and reports `timeup`; the Scene calls `end("timeup")`, unranked. The definition has no `durationMs`. |
| Bound | `MIN_FINISH_MS` = ceil(116 / 0.006) = **19334** (proof). |

## The course

Fixed: the same geometry and the same obstacle timeline (from `simMs` 0 at "Go") in every run.

| Part | p (from–to) | x | Top | Notes |
|---|---|---|---|---|
| Start pad | −4 – 8 | ±4 | 0 | start line and checkpoint 0 at p 0 (the spawn), one cube stack |
| Bridge A | 8 – 13 | ±1.5 | 0 | runs 1 m into the disc (no sliver at its corners) |
| Sweeper disc | 12 – 24 | radius 6 around (0, p 18) | 0 | hub and bar |
| Bridge B | 23 – 28 | ±1.5 | 0 | |
| CP1 pad | 28 – 34 | ±3 | 0 | line p **29**, gate, cube stack |
| J1 | 36.4 – 38.8 | 0 ± 1.2 | 0.5 | jump platforms: 2.4 × 2.4 tops on pillars down to the water |
| J2 | 41.2 – 43.6 | −1.3 ± 1.2 | 1.0 | |
| J3 | 46.2 – 48.6 | +0.5 ± 1.2 | 1.5 | |
| J4 | 51.2 – 53.6 | +1.5 ± 1.2 | 1.0 | |
| J5 | 56.2 – 58.6 | 0 ± 1.2 | 0.5 | |
| CP2 pad | 61 – 67 | ±3 | 0 | line p **62** |
| B1 … B5 | 68.6–70.8, 72.4–74.6, 76.2–78.4, 80.0–82.2, 83.8–86.0 | slide ±2.4, half-width 1.2 | 0 | moving blocks over the pit, 1.6 m gaps |
| CP3 pad | 87.6 – 93.6 | ±3 | 0 | line p **88.6** |
| Balance beam | 93.6 – 113.6 | ±0.5 | 0 | rocks and slides the runner sideways |
| Finish pad | 113.6 – 122 | ±4 | 0 | **finish line p 116** under the arch (posts radius 0.4 at x ±3.6, solid) |

Top view, forward up the page (as on screen):

```
p 122   +--------+
p 116   |==ARCH==|   finish line
p 113.6 +--+  +--+
           |  |      balance beam, 20 m x 1.0, slides you sideways
p  93.6 +--+  +--+
        |  CP3   |   line p 88.6
p  87.6 +--------+
         <-[B5]->    moving blocks 2.4 x 2.2, slide x +-2.4, period 4 s
         <-[B4]->    gaps 1.6
         <-[B3]->
         <-[B2]->
         <-[B1]->
p  67   +--------+
        |  CP2   |   line p 62
p  61   +--------+
            [J5]     0.5   jump platforms on pillars
               [J4]  1.0
           [J3]      1.5
        [J2]         1.0
            [J1]     0.5
p  34   +--------+
        |  CP1   |   line p 29
p  28   +--+  +--+
         .-'  '-.
        /  ===   \   sweeper disc r 6, hub r 0.7, bar 5.9 each way, 1.1 rad/s
        \  =o=   /
         '-.  .-'
p   8   +--+  +--+
        | START  |   start line p 0 (spawn)
p  -4   +--------+
```

Every gap and every move has room to spare (`V_RUN` × the time to land at that rise, a plain jump from the top's height without coyote run-on: the reach a player can count on; minimum travel = the gap minus both 0.2 m edge graces; neighbouring platforms overlap in x, so the shortest jump is straight forward). The skip check below uses the opposite, the most the rules allow:

| Jump | Gap | Rise | Time to land | Reach at full speed | Minimum travel | Share of the reach |
|---|---|---|---|---|---|---|
| CP1 → J1, J1 → J2 | 2.4 | +0.5 | 615 ms | 3.69 m | 2.0 | 54 % |
| J2 → J3 | 2.6 | +0.5 | 615 ms | 3.69 m | 2.2 | 60 % |
| J3 → J4, J4 → J5 | 2.6 | −0.5 | 734 ms | 4.41 m | 2.2 | 50 % |
| J5 → CP2 | 2.4 | −0.5 | 734 ms | 4.41 m | 2.0 | 45 % |
| CP2 → B1, B → B, B5 → CP3 | 1.6 | 0 | 680 ms | 4.08 m | 1.2 | 29 % |

- **Blocks never force a wait.** In the worst instant two neighbouring blocks are 4.8 m apart (centres, opposite ends). Landing needs the centre within 1.4 of the target's centre, so the runner needs 3.4 m sideways and 1.2 m forward in 680 ms: 5.3 m/s, under 6. Waiting for a better moment is a choice, not a rule. A runner standing on a block reaches at most 0.55 m past its front edge, and the next row is 1.6 m away, so a sliding block never touches a runner on the block behind it.
- **The bar can be jumped wherever it is fast enough.** Feet stay above its 0.70 m top for 488 ms of a jump (96–584 ms after take-off). The bar takes `(0.35 + 0.7) / (1.1 · r)` to pass a runner at radius r: 477 ms at r = 2, 318 ms at 3, 162 ms at the tip. Inside r ≈ 1.96 it is too slow to clear, so the line past the hub is at |x| ≥ 2 (or between two sweeps). These times are for a runner standing still. The bar turns counterclockwise seen from above, so a runner passing the hub on its **left** (x < 0) meets the arm head-on and the passage is shorter. On the right, past p ≈ 19, the runner circles the hub more slowly than the bar, so the arm can stay over it for longer than a jump lasts. The speedrun bot was knocked there and takes the left side (rules.test.ts).
- **The beam can always be held.** The slide is at most 1.8 m/s; countering it at full stick still leaves 5.7 m/s forward.
- **No section can be skipped.** The longest forward reach of a jump, edge to edge, counts everything the rules allow: the 0.2 m support grace at take-off, up to 1 ms of motion at the walk-off (the walk-off ms is the first whole ms past the grace, so the centre can be 0.206 m past the edge), a full 100 ms of coyote run-on (+0.6 m at 6 m/s), the flight from the coyote fall's height, up to 1 ms at the landing (the landing ms is the first whole ms below the top), and the 0.2 m grace at the landing:

  `reach(dy) = 0.2 + 0.006 + V_RUN · 0.1 + V_RUN · t_land(dy, y0 = −½ · G · 0.1²) + 0.006 + 0.2`, where `t_land` solves `y0 + 8.5·t − 12.5·t² = dy` on the way down and `dy` is the target top minus the take-off top. The reach grows with the coyote time, so 100 ms is the worst case. Carry (blocks, beam, launch carry) is x only, so it never adds forward reach. This is a true bound for the real step, not an estimate: rules.test.ts presses jump on every ms from 300 ms before a walk-off to the last coyote ms, at every rise a skip pair uses, and the longest landing comes within 3–9 mm of `reach(dy)` and never past it. (Without the two whole ms the formula fell up to 9 mm short.)

  | Skip (a support to the one after the next) | Distance in p | dy | Reach | Margin |
  |---|---|---|---|---|
  | CP1 → J2, J1 → J3 | 7.2, 7.4 | +1.0 | 4.01 m | ≥ 3.19 |
  | bridge B → J1 (over CP1) | 8.4 | +0.5 | 4.59 m | 3.81 |
  | J2 → J4 | 7.6 | 0 | 5.00 m | 2.6 |
  | J3 → J5, J4 → CP2 | 7.6, 7.4 | −1.0 | 5.64 m | ≥ 1.76 |
  | J5 → B1 (over CP2) | 10.0 | −0.5 | 5.34 m | 4.66 |
  | CP2 → B2, B1 → B3, B2 → B4, B3 → B5, B4 → CP3 | 5.4 | 0 | **5.00 m** | **0.40** |
  | B5 → beam (over CP3) | 7.6 | 0 | 5.00 m | 2.6 |
  | bridge A → bridge B (over the disc) | 10.0 | 0 | 5.00 m | 5.0 |
  | CP3 → finish (over the beam) | 20.0 | 0 | 5.00 m | 15.0 |

  The tightest skips are the 5.4 m ones between supports at the same height: a flat reach of 5.00 m (5.002) leaves 0.40 m. The largest reach anywhere, a 1.5 m drop, is 5.90 m, but no skip pair has a drop of more than 1.0 m, and the drop pairs are at least 7.4 m apart. The beam (20 m) is only crossed on foot, and every run lands on the disc at least once (10 m between the bridges). So every obstacle must be passed, in order. Side walls are not needed: the pool beside the course is the wall, and the proof below needs neither walls nor this paragraph.

## Rules

### One step

`step(run, dtMs, input)` runs once per `useRunFrame`, with `dtMs = dt · 1000`. `input` is one object per run (`createStepInput()`), rewritten every frame: `moveX`, `moveZ` (the stick mapped with `inputToWorld(…, 0)`, length at most 1) and `jumpPressed`. A step with dtMs ≤ 0 or NaN does nothing.

1. **Clock.** Add `dtMs` to the carried remainder, take its whole ms (at most 50), keep the fraction in [0, 1). `simMs` therefore never runs ahead of the store's `elapsedMs` and lags it by under 1 ms (as warehouse-rush). A jump press is latched once per frame (it starts the 120 ms buffer at the frame's first ms).
2. **Each ms**, `simMs += 1`. **Cap first:** if `simMs` is now `DURATION_MS` (300000), the ms moves nothing, `events.timeup` is set, and this and every later step do nothing (as after the finish). So the last ms that can move or finish is 299999, and a finish in an earlier ms of the same frame stops the step before the cap is reached. (warehouse-rush's `advanceClock` caps its clock at `DURATION_MS` and reports `"timeup"` the same way; here the cap is checked per ms, so the earlier ms of that frame still run.) Otherwise the obstacles move to their place at `simMs`, then the runner's state acts:
   - **run:**
     1. carry: on a block, add the block's Δx for this ms; on the beam, add the slide;
     2. jump if a press is buffered and the runner is grounded or within coyote time: `vy = 8.5`, airborne, launch carry = this ms's carry;
     3. ease the input velocity towards `V_RUN · stick` (40 or 20 m/s²) and cap it at 6 m/s;
     4. move x/z by input velocity + carry;
     5. vertical: airborne `y` from the closed form; a **landing** is a descending crossing of a support's top (feet at or above it before, below it after) with the centre over it (`FOOT` grace); grounded with no support under the centre any more = walked off (airborne with vy = 0 from this ms, so gravity runs; coyote starts);
     6. **side collisions:** circle against every solid whose span overlaps the runner's (feet below its top, head above its bottom): pads, bridges, pillars, blocks, beam, the hub and the arch posts are pushed out of (`resolveSphereAabb`, circles for the disc's rim, the hub and the posts);
     7. **progress guard:** the step without its carry (input plus push-outs) is scaled back to at most 6 mm. Carry has no z part, so **p moves at most 6 mm per ms**. If the trimmed position would end inside a static solid, the runner keeps last ms's position instead (it was valid, and not moving passes the guard). *Inside* means the vertical spans overlap and the runner's core, its `FOOT` circle, overlaps the solid: a push-out of more than 0.35 − 0.2 = 0.15 m would be needed. The ledge band does not count. A walk-off always leaves the runner's circle overlapping the edge by under 0.15 m, and from there the guarded push slides it off at 6 mm per ms (the coyote reach test runs exactly that). An overlap with a block that the trim leaves (at most one ms of block motion, 3.6 mm) is resolved by the next ms. The guard only bites on rare corner grazes (a block's front corner sliding into an airborne runner adds a fraction of a mm forward), but without it the proof would need an allowance;
     8. **bar:** feet below 0.70 over the disc and the circle overlapping the bar's rectangle (in the bar's rotating frame) = knocked;
     9. feet below `KILL_Y` = lost;
     10. **checkpoint:** grounded on the next checkpoint's pad with p ≥ its line activates it (in order only: k + 1 after k);
     11. **finish:** grounded on the finish pad with p ≥ 116 and checkpoint 3 active = finished, `finishMs = simMs`, once. Later steps do nothing.
   - **knocked:** the fling (x and y only, ghost), no input. The sideways part stops in the first ms in which the circle overlaps no top (disc or bridge); y keeps the closed form. Feet below `KILL_Y` = lost (792 ms after the hit). The fling clears every top before it comes down: \|x\| reaches 6.35, the most it needs, within 6.35 / 12 = 529 ms, and the feet are back at the top's height only at 640 ms. z never changes, and \|x\| never exceeds 6.35, so the camera keeps the splash in view.
   - **lost:** no motion (the Scene sinks the runner with a splash). After `LOST_MS`: respawn at (0, top, p = line) of the active checkpoint, velocity and carry 0, grounded, state spawn.
   - **spawn:** no motion, no input, for `SPAWN_MS`; then run.

The step reports what happened in `run.events`, one object reset at the start of every step: `jumped`, `landed`, `checkpoint` (index or −1), `knocked`, `lost`, `respawned`, `finished`, `timeup`. The Scene calls `end("win")` on `finished` (after `setStat("finishMs")`) and `end("timeup")` on `timeup`. The run keeps `simMs`, `finishMs`, the active checkpoint and the ms it was activated (`checkpointMs`), `respawns`, `maxP` (the furthest p reached, for tests) and `groundY` (the top of the last support, for the camera). `createRun(course = COURSE)` makes everything once; nothing is allocated after it. Taking the course as data lets the tests run a flattened course (Test plan).

### Obstacles

Pure functions of rules ms: `barAngle(ms)`, `blockX(k, ms)`, `beamSlide(ms)`. The Scene draws them from the same functions. During the countdown it feeds them `−countdownMs`, so the bar is already turning and arrives at its "Go" pose exactly at "Go". After the end it feeds `simMs` plus the game time since the end (`useGameTime().now`, which keeps running through the result delay and behind the panel), so nothing freezes under the arch. That is visual only: the rules timeline is 0 at "Go" in every run. Only the bar uses trigonometry (`Math.sin` / `Math.cos`), and a last-bit difference between JavaScript engines changes nothing a player could see. The blocks and the beam use polynomials only.

### Checkpoints, falls and respawns

- Checkpoint 0 is the start line. Checkpoint k (1..3) activates when the runner is **grounded** on its pad with p ≥ its line: crossing the line in the air does nothing until the landing. Out-of-order activation is impossible (and the rule checks it anyway).
- The respawn spot is **on the line** (x = 0), never past it, so a respawn never puts the runner ahead of the point where it activated that checkpoint (proof step 3).
- Falling (feet below −1.5) or a bar knock costs about 1.2–1.7 s of dead time (the fall: 0.35 s off a pad, 0.49 s off J3, 0.79 s after a knock; then 600 ms in the water and 300 ms of spawn) plus the run back from the checkpoint. The clock never stops for it. The worst place to fall is the beam's end: back to p 88.6, 25 m to run again.

### Fixed course (decision)

One fixed course, no seeded variants:

1. **The leaderboard ranks times.** Seeded variants of equal length would have equal *bounds* but not equal difficulty: block phases, platform offsets and the bar's timing decide real times. Luck would enter the ranking. One course with one timeline from "Go" gives every player the same race.
2. **A time trial is learned.** The route past the hub, the bar timing and the block rhythm are the skill. A new layout each run would turn practice into guessing.
3. **One course is one proof.** Every jump in the table above is pinned by a test against these exact numbers. Variants would need a validator and a generator proof for every seed.
4. **Same frames and inputs, same run.** There is no seed, so `rules.ts` has no RNG at all, and the Scene never calls `randomSeed()`. A later run-token or replay check (Phase 5) could re-simulate a submitted input log.

Variety, if wanted later, is a second course with its own slug and leaderboard, never seeds inside this one.

## Scoring

This is a **time game**: `kind: "time"`, `timeBaseMs` 300000, `maxScore` 30000, duration 15000–300000 ms, `base` 0, `maxPointsPerSec` 0, display `"time"`. The server computes `score = max(0, floor((300000 − duration_ms) / 10))`, and GameShell's `normalizeRun` computes the same. The game never calls `addScore` or `setScore`. Only `end("win")` is ranked (`isRankedRun`): a time-up and a quit show their result with status `unranked`, score 0, nothing saved or sent.

| Finish time | Score |
|---|---|
| 19.334 s (the proof bound, unreachable) | 28066 |
| 19.408 s (a flat course, straight line from rest) | 28059 |
| 28.000 s | 27200 |
| 45.000 s | 25500 |
| 1:30.000 | 21000 |
| 4:59.990 | 1 |

**The finish time is the finish ms, not the frame.** GameShell's default duration is `elapsedMs` at the end of the frame in which the finish happened, up to 50 ms late (17 ms at 60 fps, 33 at 30). At a 10 ms score resolution that would rank 120 Hz players ahead of 30 Hz players with the same run. So:

```ts
// Scene, in the step that finishes:
setStat("finishMs", run.finishMs);
end("win");

// index.tsx:
finalScore: (s) => ({
   score: s.score,
   durationMs: s.endReason === "win" && (s.stats.finishMs ?? 0) > 0 ? s.stats.finishMs : s.elapsedMs,
}),
```

`finishMs` is a whole number of rules ms, at most `elapsedMs` (step 1 of the proof). The stat is not in `hudStats`, so it is never shown, and `beginRun` clears it with every other stat.

### Server limits and why they hold (the proof)

The server accepts a time run only if `15000 ≤ duration_ms ≤ 300000` (its score follows from the duration). So every ranked run must take at least 15 s, for any input and any frame rate. The proof assumes a perfect player and ignores every obstacle: it uses only the course length and the speed cap.

1. **Clock.** `useRunFrame` hands the game exactly the play time `RunClock` counted in that frame, including the rest of the frame in which the countdown ends (core); pause stops both. The rules turn it into whole ms with a carried remainder, so after any frame `simMs ≤ elapsedMs < simMs + 1`. Every ms of motion is a counted ms.
2. **Forward speed.** In the run state p changes by at most `V_RUN · 1 ms` = **6 mm per ms**: the input velocity is capped at 6 m/s; carry (blocks, beam, launch carry) has no z part; a jump changes only `vy`; and the progress guard caps the non-carry step, push-outs included. Knocked: vz = 0. Lost and spawn: no motion.
3. **No teleport forward.** The only place the rules set a position is a respawn, to p = `line_k` of the active checkpoint k, and k was activated with the runner grounded at p ≥ `line_k`.
4. **Checkpoints, by induction.** Let `a_k` be the ms when checkpoint k activates (`a_0` = 0, `line_0` = 0). Before `a_k`, the runner's last placement (start or respawn) was at some ms s ≥ `a_j`, at p = `line_j` with j < k. From s to `a_k` it was only in spawn and run (a knock or a fall ends in another placement), so `line_k − line_j ≤ 0.006 · (a_k − s)`. With `a_j ≥ line_j / 0.006`: **`a_k ≥ line_k / 0.006`**. The finish is the same argument with line 116 and j ≤ 3.

| Event | Line p | Earliest ms |
|---|---|---|
| Checkpoint 1 | 29 | 4834 |
| Checkpoint 2 | 62 | 10334 |
| Checkpoint 3 | 88.6 | 14767 |
| **Finish** | **116** | **19334** (`MIN_FINISH_MS`) |

5. **Submitted duration.** `finalScore` submits `finishMs` (a whole number, so `normalizeRun`'s rounding leaves it), with `19334 ≤ finishMs ≤ elapsedMs`. The rules cap their own clock: the ms that brings `simMs` to 300000 moves nothing and ends the step with `timeup` (One step, 2), so a finish happens at `simMs ≤ 299999`. Thus **19334 ≤ duration_ms ≤ 299999**, inside 15000–300000, and the score is at most `floor(280666 / 10)` = **28066 ≤ 30000**. (The store has no `durationMs`, so it never ends the run on its own; `end` is idempotent, and after `finished` or `timeup` the step does nothing.)
6. **Non-wins.** The time-up (the rules' `timeup` at `simMs` 300000, for idle or lost runs; the Scene calls `end("timeup")`) and quit are unranked and never sent.
7. **Margin.** The bound is 4.33 s (29 %) above the server's floor, and it is a straight line at full speed from the first ms through the hub, across every gap without waiting. It is tight up to the 150 ms acceleration ramp: from rest, full speed is reached after 0.453 m instead of 0.9 m, so even a flat course takes 19408 ms (Test plan). Real wins are far slower (next section). The rounding the server sees cannot lower it: the duration is a whole number of ms already.

**The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.** Optional, for the assets + limits PR (the user decides): raise `minDurationMs` to 19000. An honest client can never go below 19334, so the server would then reject forged sub-19 s claims too. The golden test ties it: `MIN_FINISH_MS ≥ minDurationMs + 300`, so a later speed or course change that breaks it fails the build.

### What real play will score (measured)

The speedrun bot in `rules.test.ts` runs the real `step` with lookahead jumps. It passes the hub on its left, takes timed bar jumps, jumps to each platform at the first frame that lands well, waits on the edge for the blocks, and corrects the beam's slide. It finishes without a fall in **22.45 s at 60 fps** (pinned ± 0.5 s; score 27754). It takes 22.45 s at 144 fps and 20.60 s at 30 fps, because frame timing changes how long it waits for the blocks. The straight line from rest is 19.4 s. The bot's 20.60 s at 30 fps is about what frame-perfect jumps and block timing can do, so a very good human run is about 21–24 s (score about 27600–27900). A first good run with one or two falls takes 45–70 s. Every fall costs 1.2–1.7 s plus the way back.

## Scene and camera

- **Follow camera, no yaw.** The course runs up the screen on every device (`yaws: [0]`), so up on the stick is always forward. The camera follows a point `F` that the Scene updates in `useRunFrame` after the step, in every state (run, knocked, lost, spawn), except between a respawn and the cut:
  - `F.x = 0.3 · runner.x` (`FOLLOW_X`: the camera drifts with the runner, the course around it stays in view; why 0.3 below);
  - `F.y = run.groundY`, the top of the last support (the camera rises a step when the runner lands higher; it does not bob with jumps, and it holds while knocked or falling);
  - `F.z = runner.z`.

  While knocked, `F` keeps following at `FOLLOW_X` (the fling moves it sideways at 0.3 · 12 = 3.6 m/s, and z not at all), and the fling stops sideways at \|x\| ≤ 6.35, so the player sees the runner fly off and splash into the pool. While lost the runner does not move, so neither does `F`. On a respawn the camera **cuts** to the checkpoint: the `CameraRig` is keyed by `run.respawns` (a follow rig snaps on mount, core), during the 300 ms spawn freeze. A small component compares `run.respawns` in a `useFrame` and sets its key state only when it changed, so React renders once per respawn, never per frame. **F holds until the cut:** from the respawn step until the rig keyed with the new count has mounted, the Scene does not update `F`, so the outgoing rig (still easing towards `F` for the one to three frames React takes) never sees the checkpoint and cannot swoop about 25 m towards it. The new rig's wrapper writes the new `F` in a layout effect, which runs before the rig's own mount effect snaps the camera to it; from then on `F` follows as above.
  - **Built (Scene.tsx `FollowCamera`):** the key change is set with R3F's `flushSync` from a `useFrame` at priority −0.4 (after the simulation, before `CameraRig` at −0.25), so the new rig mounts, `F` is written and the rig snaps (its mount effect is flushed with the synchronous commit) all in the frame of the respawn. Without it a frame could run between React's commit and the rig's passive mount effect: the new rig's `useFrame` would then turn the camera towards its unset look point (the origin), a one-frame flash looking back down the course.
  - **The outgoing rig runs once more in the cut frame** (found in review): R3F 8 runs a frame's callbacks from the subscriber list as it was when the frame began, so the unmounted rig's `useFrame` (−0.25) still turns the camera towards its own look point near the fall, 15–20 m ahead. That frame showed the course pitched up to the sky with the runner's feet at or below the bottom edge (direction y −0.21 to −0.51 instead of −0.64 / −0.71), on every knock or fall. A re-aim at −0.2 (after every rig, before the visuals) looks at `F` again in that frame, which is the new rig's snap (`followFraction` 1, no `bounds`). The position and the lens shift need nothing: the old rig eases the position towards `F` + offset, where the snap already put it, and sets its full shift again after its cleanup cleared it.
  - Measured in the browser (a recorder at `gl.render`, so every value is the one drawn; 76 respawns over three runs, knocks and falls, cuts of 1.9–20.6 m): every cut lands in the respawn's frame, the largest camera step in the 30 frames before and after a cut is 0.06 m, and in every one of those frames, the cut frame included, the camera direction and the lens shift equal their values at rest (largest change 0). The earlier check (direction z ≤ −0.71 only) could not see the pitch.
- **A fitted window around F.** `useFittedView` is translation-invariant, so `area` is a box relative to `F` at the origin: the runner (its body, a jump's apex 2.95 m above the ground), the course around it and the course ahead. Two module-level views, picked by aspect (a rotation refits):

```ts
const FOLLOW_X = 0.3;
const LAG: AABB = { min: { x: -0.45, y: -0.5, z: -0.8 }, max: { x: 0.45, y: 0.5, z: 0.8 } };
const FOCUS = followFocus({ lookAt: [0, 0, 0], reach: LAG, fraction: 1 });
const PORTRAIT = {             // width < height
   area: { min: { x: -4.8, y: -1, z: -22 }, max: { x: 4.8, y: 3, z: 0.5 } },
   pitch: (45 * Math.PI) / 180, fov: 60,
   yaws: [0], focus: FOCUS, margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 8, shift: true,
};
const LANDSCAPE = {            // width >= height
   area: { min: { x: -4.8, y: -1, z: -11 }, max: { x: 4.8, y: 3, z: 0.5 } },
   pitch: (40 * Math.PI) / 180, fov: 50,
   yaws: [0], focus: FOCUS, margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 8, shift: true,
};
// <CameraRig key={cut} camera={{ position: view.offset, lookAt: [0, 0, 0], fov: VIEW.fov }} follow={F}
//    followFraction={1} offset={view.offset} shift={view.shift} damping={8} />
```

- **Why `FOLLOW_X` 0.3 and ±4.8 m.** The window shows `F.x ± 4.8`, and the runner sits at `0.7 · x` from F. Two needs pull against each other:
  - **Every section's full width and the next landing target.** For a lane of half-width W (the runner's centre up to W + 0.2 with the edge grace), the whole lane is in the window only if `area.x ≥ W + FOLLOW_X · (W + 0.2)`. The widest lane with a moving target is the block lane: blocks slide ±2.4 with half-width 1.2, so W = 3.6, and the next block (opposite phase, 1.4–6.2 m ahead of the runner) can be anywhere in it: 3.6 + 0.3 · 3.8 = **4.74**. With the earlier `FOLLOW_X` 0.6 and ±3.2 this held only for W ≤ 1.93: a runner at the outer edge of a block at its +2.4 end (x 3.8) put the next block's near-left corner at about x −10 px of 375 in portrait (off-screen).
  - **The runner's body everywhere.** `(1 − FOLLOW_X) · |x| + 0.35 ≤ area.x`: on the disc's rim (x 6.2) 4.69, at the knock's splash (x 6.35) **4.795**.

  The larger of the two, `max(3.6 + 3.8 · f, 6.55 − 6.2 · f)`, is smallest at f ≈ 0.295: `FOLLOW_X` 0.3 with `area.x` ±4.8 meets both. The start and finish pads (±4) and the disc (±6) are wider than a window that keeps the runner readable; on them the window holds the runner, the hub (±0.7) on the disc and the arch opening (±3.2) on the finish pad. Ahead, the next landing target ends at most 7.6 m in front of the runner (a jump platform's far edge), inside `area.min.z` (−11 / −22), and at most 0.5 m above `F.y`. Behind, the box needs only the runner's 0.35 m radius, so `area.max.z` is 0.5 (it was 2; trimming it brings the camera closer, below).
- **Lag in the fit.** `CameraRig` eases with damping 8, so it trails a target moving at v by at most v / 8. F moves forward at most 6 m/s (0.75 m) and sideways at most 0.3 · 12 = 3.6 m/s while knocked (0.45 m; running on a block, 0.3 · (6 + 3.6) = 2.9 m/s); `groundY` steps by at most 0.5 m per landing. `LAG` covers these, and `focus` is its corners, so the window stays on screen while the camera catches up. On screen, checked for this README from every corner of `LAG`: with the runner at x 3.8 on a block, the block lane's far-left edge (x −3.6, 1.4–6.2 m ahead) is at x ≥ 33 px of 375 in portrait; the splash (x 6.35 ± 0.35, water at −2, below the box) is at x ≤ 356 of 375 in portrait and ≤ 1159 of 1280 on the laptop.
- **Fitted views** (core `fitView`, run for this README; the same inputs as the core fixtures: shell HUD groups `{10, 10, 218, 52}` and `{w − 104, 10, w − 10, 54}`, joystick 132 px and Jump 72 px at 20 px from the bottom corners, both lifted by the cookie banner, the banner as an obstruction). "Window" is the window box on screen with the camera at rest; "gaps" are the closest px from its outline to the HUD, the joystick and Jump at rest. "Binds" is what stops the fit from coming closer, with the camera at the worst corner of `LAG` (2 % margins; 8 px padding for the rects). "Depth" is px per m along the course at the runner's feet. `camera.test.ts` pins the table (±0.5 px).

| Screen (CSS px) | Pitch / fov | Distance | Lens shift | Window on screen | Runner | Ground px/m at the runner / far edge | Depth at the feet | A 2.6 m gap 4 m ahead | Gaps HUD / joystick / Jump | Binds |
|---|---|---|---|---|---|---|---|---|---|---|
| 375 × 812 | 45° / 60° | 23.90 m | (0, −0.013) | x 30–345, y 78–442 | 32.7 px tall, feet at y 411 | 29.4 / 17.8 (22 m ahead) | 20.8 px/m | 40 px | 24 / 218 / 278 | both side margins |
| 375 × 812, 162 px banner | 45° / 60° | 23.90 m | (0, −0.013) | x 30–345, y 78–442 | 32.7 px | 29.4 / 17.8 | 20.8 px/m | 40 px | 24 / 56 / 116 | both side margins (the banner costs nothing) |
| 812 × 375 | 40° / 50° | 9.63 m | (0.109, −0.381) | x 187–714, y 25–303 | 53.3 px, feet at (450, 259) | 41.7 / 22.3 (11 m ahead) | 26.9 px/m | 35 px | 54 / 81 / 74 | the joystick and Jump |
| 812 × 375, 83 px banner | 40° / 50° | 12.59 m | (0, −0.176) | x 218–594, y 23–254 | 39.7 px | 31.9 / 19.1 | 20.5 px/m | 31 px | 54 / 66 / 138 | the top margin and the banner |
| 1280 × 800 (no touch controls) | 40° / 50° | 10.58 m | (0, −0.308) | x 142–1138, y 52–609 | 102.6 px, feet at (640, 523) | 81.1 / 45.1 | 52.2 px/m | 71 px | 130 / – / – | both side margins |

  Portrait is bound by the width: 9.6 m of course plus the 0.9 m lag across 375 px. The banner only moves the picture there (the same distance with and without it). It looks 22 m ahead (3.7 s at full speed), and the runner stands at mid-screen (feet at y 411 of 812). **The price of the full block lane is the portrait runner's size:** 39.6 → 32.7 px tall and 25 → 20.8 px of depth per m at its feet, so the 0.2 m edge grace is about 4 px on a phone (the `BlobShadow` on the support is the cue that matters, below). Trimming `area.max.z` from 2 to 0.5 won back 1.5 px of it (31.2 px with the old depth), and the banner row is now better than before (31.4 → 32.7 px). The phone in landscape is bound by the touch controls and looks 11 m ahead; the laptop by the width. The lag box costs about 23 px of each side in portrait (the window at rest stops at x 30 / 345, the margins are at 7.5 / 367.5): that is the price of a fit that holds while the camera catches up. Fixed `camera` for the first frame (`index.tsx`): the 1280 × 800 offset, `position: [0, 6.80, 8.10]`, `fov: 50`, `lookAt: [0, 0, 0]`; the Scene's rig takes over on mount.
- **Frame order** needs no care: `useRunFrame` runs before `CameraRig` and every `useFrame` (core).
- **Reading jumps.** The runner's `BlobShadow` (core) sits on the highest support under its centre (`groundBelow(x, z, ms)` in the rules, the blocks at their current x), or on the water. It is the main depth cue for a jump. A soft indigo ring under the feet marks the runner from far away.
- **Looks only** (`useFrame`, `useGameTime()`): run cycle by distance, jump and landing squash, arms out and wobbling on the beam, flailing tumble when knocked or falling, splash and ripples, the checkpoint gate lighting up (green, flag pop) on activation, the runner cheering under the arch through the result delay (`resultDelayMs: 1200`). Water: one plane with a scrolling canvas texture. Environment: background and fog `#bae6fd`, fog 45–110 m, `lighting: "day"`.
- **Draw calls (measured in the build PR): 46–59** (estimate was about 45): pad bodies, tops and rims, platform slabs, cushions and pillars, rails and painted lines (one instanced mesh each), the lane-rope floats (one), the disc, its rim, the hub, the bar (four), the five blocks (one `<DynamicInstanced>`, one vertex-coloured mesh), the beam (two), the water and deck, the gates (posts instanced, a banner and a flag each), the arch (four), the stand-in runner (25 parts), its blob shadow and marker ring, the splash and spawn effects (drawn only while they play). About 72–74k triangles, 47 geometries, 5 textures, 10 programs. Far under 150, no shadow maps.
- **Every shader compiles when the Scene mounts** (`gl.compile(scene, camera)` in a layout effect, about 8 ms behind the start panel or the countdown; a remount finds the programs cached). three.js builds a program the first time its object is drawn, and the gate banners and flags and the finish checker are out of view at the start: on a first visit they compiled mid-run, a 40–140 ms frame during the block and jump timing or at the first respawn (found in review). Measured: 10 programs before "Go" (8 before the fix), no frame over 50 ms in any run since.

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` (character; its concept art is still pending) | `assets/shared.spec.json` | the player | own stand-in, as office-escape's: hoodie, round head with a headband, capsule limbs swung in code |
| finishArch | **this game** `models/3d/obstacle-race/finishArch.glb` (generated in group A; **not used**, below) | `./assets.spec.json` | the goal | always the primitive: two red inflatable legs on the rules' posts, a yellow top tube, a checkered banner (canvas texture) |
| pads, bridges, pillars, platforms, disc, hub, bar, blocks, beam, water, gates, foam cubes | primitives in code | none | the course | (always primitives) |

- **Generate only the finish arch.** It is the course's landmark: in view for most of the beam and through the result delay, and the one shape where a model clearly beats stacked primitives. One text-to-3D prop, `Gen-2.5-Low`, `qualityOverride` 3000, one attempt: 1 generation, about 0.5 credit at the plan's rate. The spend is approved by the user in chat first. Obstacles stay primitives: their collision is in the rules, and their exact size has to match it.
- **Universe `shared-cast`, seed 5050**, not a new `playground` universe: the arch stands next to the shared runner and nothing else is generated, so it should match the runner's set (tower-climb's flag made the same choice). The prompt follows the `skills.md` formula and asks for "about twice as wide as it is tall and thin from front to back", because Rodin normalises the size and only the proportions survive. "No text" keeps a FINISH lettering off the banner.
- **Size:** 8.0 m wide (it spans the finish pad), 4.2 m tall, 0.8 m deep, standing on y = 0, facing +z (towards the runner). Collision is the two post circles in the rules (radius 0.4 at x ±3.6, 6.4 m clear between them), never the mesh, so the drawn legs must stand on them.
- **The group A arch does not fit (review of the build PR, 2026-10-06).** `finishArch.glb` (main 1acca9c, listed in `core/modelManifest.ts`) came out as a deep double arch, 1.85 × 1.36 × 1.90: two inverted-U tubes 1.3 m apart front to back, joined at the ground, with the legs at |x| 0.44–0.78 (centre 0.61). Its opening is about half its width, against the rules' 80 %. No `scale` / `stretch` fits it: legs centred on the posts are 2 m thick (the runner sinks 0.6 m into them before a post stops it) with the feet about 1.5 m out over the pool; scaled to the 8 m outline, the legs stand at |x| 1.9–3.4, where the runner runs through them. Drawn at scale 1, the branch's `<Model>` would have shown an arch smaller than the runner, with two invisible posts on the pad. So the Scene draws `FinishArchPrimitive` (sized from `ARCH`), `ASSETS` has no `finishArch`, and the GLB is never requested. **A regeneration is optional** (user approval, one text-to-3D prop): the prompt needs "one single arch, one thin tube, legs at the outer tenth of its width, nothing behind it". It comes back as a `finishArch` entry in `assets.ts` (scale / stretch / yOffset from the measured bounds, so the legs stand on x ±3.6 and the top reaches 4.2) and `<Model asset={ASSETS.finishArch} fallback={<FinishArchPrimitive />}>` in the Scene.
- **Runner:** `{ ...SHARED_ASSETS.runner, rotationY: Math.PI }` (it runs towards −z), scaled to 1.5 m in the assets PR. Until the GLB exists and is listed in `core/modelManifest.ts`, the stand-in shows and no `.glb` is requested. A GLB without clips is animated on the root in code (as office-escape); if it looks wrong, `assets.ts` keeps the stand-in (one line).

```ts
export const ASSETS = {
   runner: { ...SHARED_ASSETS.runner, rotationY: Math.PI },
   // no finishArch: the group A GLB does not fit the rules' posts (above), the Scene draws FinishArchPrimitive
} satisfies Record<string, ModelAsset>;
```

## HUD

- **Shell HUD:** Score, **Played** and `hudStats: [{ key: "checkpoint", label: "Checkpoint", max: 3 }]` ("Checkpoint 2/3"). The definition sets no `durationMs`, so the store has no `timeLeftMs` and GameShell shows "Played", counting **up** from `elapsedMs` (whole seconds): exactly the race clock, with no core change. The 300 s limit lives in the rules instead (One step, 2), which end the run with `"timeup"` as GameShell's own timer would. The store clears stats when a run starts and the chip shows 0 until set, so no run-start hand-off is needed. The Scene calls `setStat("checkpoint", k)` on each activation. No custom HUD panel.
- **Core gap (a blocker for `"live"`):** the shell's Score chip is always 0 for a time game (the score follows from the duration only after the run). Core change (Claude, a core PR before this game goes live): for `scoring.kind === "time"`, hide the Score chip. Until then the game is playable with a Score of 0 on screen.
- **Sounds:** `"jump"` on take-off, `"pickup"` on a checkpoint, `"hit"` on a knock or a fall; GameShell plays `"win"` on the finish and `"lose"` on the time-up (any end but a win).

`index.tsx` (as built; `physics` was `true` in the design and returns with the debris follow-up):

```ts
const definition: GameDefinition = {
   slug: "obstacle-race",
   Scene,
   assets: ASSETS,
   physics: false,                // the debris layer missed its cut line (Physics); rules never touch Rapier
   // no durationMs: the shell shows "Played" counting up; rules.ts ends the run at 300000 ms ("timeup")
   // first frame only: Scene's CameraRig (core useFittedView) takes over on mount
   camera: { position: [0, 6.8, 8.1], fov: 50, lookAt: [0, 0, 0] },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 45, 110], lighting: "day" },
   touchControls: ["joystick", "jump"],
   hudStats: [{ key: STAT.checkpoint, label: "Checkpoint", max: 3 }],
   // three lines of two rows each on a phone (the controls box already lists the keys), so Play
   // clears the cookie banner at 375 x 812 as in the other games
   instructions: [
      "Race to the finish arch. Your finish time is your score.",
      "Jump the bar, hop the platforms, ride the blocks, cross the beam.",
      "A fall sends you back to the last checkpoint. The clock runs on.",
   ],
   resultDelayMs: 1200,
   // rules.ts finalScore: a win submits stats.finishMs (published before end("win")), else elapsedMs
   finalScore,
};
```

## Edge cases

- **Pause** (Esc, P, tab hidden, blur) stops `useRunFrame`, the rules clock and every obstacle with it (they are functions of `simMs`), and Rapier (core). A runner paused mid-jump resumes the same arc; one paused on a block resumes on the same spot of it.
- **Countdown:** the runner stands on the start line; `useRunFrame` does not run, so presses are dropped; the obstacles animate into their "Go" pose.
- **Finish and time-up on the same frame:** the rules decide by ms. A finish in an ms up to 299999 stops the step first (a win); otherwise the ms that brings `simMs` to 300000 is the time-up. The store has no timer of its own, so nothing ends the run before `useRunFrame` runs. Deterministic.
- **Finish while the frame continues:** the step stops at the finishing ms; nothing after it moves.
- **Landing on the finish pad past the line from a jump:** finishes on the landing ms (the finish needs grounded).
- **Knock in the air:** a jump that comes down onto the bar (feet below 0.70) is a hit too. Standing on the bar or the hub is impossible (not supports; the hub is 1.6 tall, above the apex).
- **A block slides into an airborne runner:** pushed out sideways (or backwards from its back face); a forward push from a block's front corner counts against the 6 mm guard.
- **Walking off the beam or a pad:** coyote time applies, then the fall; below −1.5 the runner is lost.
- **Two checkpoint lines in one frame:** impossible (the lines are at least 26 m apart, a frame moves the runner at most 0.3 m), and activation is in order anyway.
- **Resize or rotation mid-run:** the view switches between the portrait and landscape constants and refits; yaw stays 0, so controls never change. The rules do not depend on the view.
- **Retry and restart** remount the Scene: a fresh `createRun()`, the same course and the same timeline from "Go". Strict mode's double `useState` initializer is harmless.
- **Missing or broken GLB:** its primitive (`<Model fallback>`). Collision never depends on a model.
- **Rapier chunk fails to load:** GameShell's stage error (core). With the cut line's `physics: false`, the game has no chunk at all.

## Test plan

`rules.test.ts` (vitest):

- **Constants (golden).** Every number in "Constants" and the course table, plus the derived ones recomputed from the tuning numbers: apex 1.445 and 340 ms, airtime 680 ms, the jump table (time to land, reach, share), the bar's 488 ms window and its 1.96 m inner radius, the knock's sideways stop at 6.35 m within 529 ms (before 640 ms), the block top speed 3.6 m/s, the ramp (150 ms, 0.453 m), the skip table's reaches (4.01 / 4.59 / 5.00 / 5.34 / 5.64 m, and 5.90 m for a 1.5 m drop), each including the two whole ms, `MIN_FINISH_MS` 19334 and each checkpoint's earliest ms. `MIN_FINISH_MS ≥ minDurationMs + 300`, and the scoring limits equal `meta.ts`. A change to a speed, a gap or a line without updating the proof fails.
- **Course.** Parts in p order without holes on the walking path (bridges overlap the disc); all joins at equal heights; every checkpoint line and the finish line inside their pads; the spawn on the start line. Every jump in the table has share ≤ 0.65 of its reach. For every pair of supports with one support between them (computed from `COURSE`, not from the table), the distance in p is greater than that pair's `reach(dy)` from "No section can be skipped" (coyote run-on, coyote fall and both graces included), and the 5.4 m same-height pairs keep a margin ≥ 0.39 m (0.398). The pillars are pinned box by box (the platform's centre ± 0.4, from the water to the slab). The free paths exist (a bot walks each section).
- **Movement.**
  - Top speed exactly 6 m/s; a diagonal is not faster; half a stick is half the speed; acceleration and braking as listed. A stick longer than 1 is normalised before the easing: turning at speed (where the cap cannot hide it), (2, 0) eases exactly like (1, 0) and (1, −1) like the unit diagonal.
  - Jump apex and airtime identical at 1, 4, 16.7, 33 and 50 ms frames (1 ms steps). Coyote at 99 / 100 / 101 ms, buffer at 119 / 120 / 121 ms; a held press never jumps twice; no jump in the air. A coyote jump uses up the coyote window: no press later in it jumps again (the double jump the skip bound rules out). A coyote jump at 100 ms starts at `y0` = −0.125 relative to the top, and a bot that walks off a flat edge at full speed and jumps at the last coyote ms has its centre cross the top's height 4.79 m (± 0.01) past the edge, within the skip table's flat reach of 5.00 m with the landing grace. **The skip bound is checked from the real step:** at every rise a skip pair uses (−1, −0.5, 0, +0.5, +1), a jump is pressed on each of the 401 ms from 300 ms before the walk-off to the last coyote ms, and the longest landing lies within `reach(dy)` and within 2 cm of it.
  - A landing only from above; the centre 0.20 past an edge stands, 0.21 falls.
  - On a block the runner keeps its spot on the block exactly, every ms; launch carry stays constant in the air; the beam's slide moves a standing runner by the formula. Running at full stick on the beam or a block, every ms p gains exactly 6 mm and x exactly the carry: the guard caps the non-carry step and never trims the carry.
  - Pushed out of pillars, the hub and the arch posts, and slides along them. Off the disc's rim and steering back under it: pushed out to radius 6.35, never inside the disc, then lost.
  - 50,000 random ms (random stick, jump mashing, random positions and states along the course, all obstacle phases): p never moves more than 6 mm in one ms, a respawn never sets p above `maxP`, nothing ever ends inside a static solid. "Inside" is checked by a test-local oracle (its own box and circle distances), not by `insideStatic`, so a weaker `insideStatic` cannot weaken the check. `insideStatic` itself is pinned: the `FOOT` threshold against a top's edge and the disc's rim (0.19 inside, 0.21 not), the strict span (feet at the top, head under the slab), and blocks never count.
  - **The guard is needed:** a pinned corner graze (an airborne runner at full forward speed, a block's front corner sliding into it from the side) moves p by more than 6 mm in that ms without the guard (the test runs the same resolution with the guard off). With the guard its step is exactly 6 mm long, and p moves less than that because the push also goes sideways. A pinned trim against a pillar's corner keeps last ms's position, and so does one against a support (the head in J1's slab, the centre 0.05 m inside its back edge or 0.15 m outside it), for all 334 ms until the head drops below the slab.
- **Obstacles.** Golden positions of the bar, every block and the beam at fixed ms (including negative ms for the countdown visuals). The bar hits at feet 0.699 and not at 0.700; tangency of the circle counts. A timed jump at r = 3 clears it; a standing runner is knocked. The knock never touches the disc again (ghost), z stays the same, and the runner is lost 792 ms later. Knocks from every spot the bar can hit (a grid over the disc and the bridge overlaps): the sideways fling goes away from x = 0 (towards +x from exactly 0) and stops at the first ms clear of every top, \|x\| ≤ 6.35 always, and the feet are still above the top's height at that ms.
- **Checkpoints and respawns.**
  - Activation needs grounded on the pad with p ≥ the line: an airborne crossing does nothing until the landing; landing deep on the pad activates.
  - Activated exactly at the line, the respawn p equals the line (a mutation that respawns at the pad's centre fails: it would be ahead of the activation point).
  - Teleporting the runner onto CP2's pad with CP1 inactive activates nothing; onto the finish pad without CP3 does not finish.
  - Lost 600 ms, spawn 300 ms, exact; input ignored in both; `simMs` keeps counting.
  - The Scene's hand-off: the `STAT` keys are `"checkpoint"` (the `hudStats` key) and `"finishMs"`; `groundY` (the camera's `F.y`) rises to 1.5 on a landing on J3, holds through a fall, and drops to CP1's top on the respawn.
- **Finish.** Once; `finishMs` is the ms of the landing or the crossing; later steps change nothing.
- **Proof.**
  - The real store (`createArcadeStore`), driven with `advanceRunClock` and `playedFrameDt` through countdowns that end mid-frame, pauses, resumes and frames from 4 to 300 ms: no untimed step, `simMs ≤ elapsedMs < simMs + 1` after every frame.
  - **The bound is tight up to the 150 ms acceleration ramp, and loose for the course:** on a flattened course (`createRun(FLAT)`: one 126 m pad, no obstacles, the same lines) a straight-line bot at full stick from the first ms (the run starts in state run, at rest) reaches each line at `N = 150 + ceil((line − 0.453) / 0.006)`: CP1 **4908**, CP2 **10408**, CP3 **14842**, the finish **19408** (pinned exactly: these were simulated for this README with the real step order, ease then move, in floats). Each is ≥ the table's earliest ms (4834 / 10334 / 14767 / 19334); the 74 ms between them is the ramp (150 ms from rest to 6 m/s cover 0.453 m instead of 0.9 m). `MIN_FINISH_MS` stays 19334, the conservative proof constant. On the real course no bot or random input finishes before 19334, and every checkpoint respects its earliest ms.
  - A **speedrun bot** (scripted route past the hub, timed jumps, block riding, beam correction, the real `step` at 60 fps) finishes; its time is pinned (± 0.5 s) from its first run and replaces the estimate above. It also finishes at 30 and 144 fps, above the bound. At every frame rate the supports it stands on are every support of the course in order (bridges excepted): the mandatory sections, checked empirically as well as by distance.
  - `finalScore` with the bot's final store state: `durationMs` = `finishMs` ≤ `elapsedMs`, `normalizeRun` gives `computeTimeScore`, the duration lies in 15000–300000 and the score is at most 28066. (Not `withinServerLimits`: its points-per-second check is a points game's rule, and a time game's rate is 0.)
  - **The rules' cap.** An idle runner's step reports `timeup` at exactly `simMs` 300000, with no motion in that ms; every later step does nothing. A run set up to finish at ms 299999 is a win with `finishMs` 299999; one that would finish at ms 300000 is a time-up. Through the store (no `durationMs`): the Scene's `end("timeup")` gives `endReason` `"timeup"`, and `isRankedRun` is false for it and for quit.
- **Determinism.** Two runs with the same frame list and inputs end in deep-equal run states and event sequences. `rules.ts` imports nothing but `core/math`, `core/collision` and types (a source check: no three.js, React, Rapier).
- **Nothing flows back from the debris** (with the debris follow-up; not in this build) (instead of a browser comparison, which frame-time jitter makes unrepeatable). A source check: `@react-three/rapier` and `@dimforge` appear only in `Debris.tsx`; `rules.ts`, `debrisPose.ts` and `Scene.tsx` never import them, and `Scene.tsx` never calls a body's `translation()`, `linvel()` or `rotation()`. One fixed frame list (with a knock, a fall, a respawn and the finish) replayed through `step()` twice, once calling `debrisPose(run, stepping, sink)` with a recording stub sink after every frame and once without: deep-equal run states and event sequences, and `run` deep-equal before and after every `debrisPose` call. The same replay checks the teleports: the stub sees a teleport for the capsule on the first frame and on every `run.respawns` change, a teleport for every body in frames replayed with `stepping` false (as outside `"playing"`), and a swept move only when the body moves at most 1 m.

`camera.test.ts`: the fit table rows from core `fitView` (±0.5 px). The window holds, relative to `F` with `FOLLOW_X` (so from every focus corner, as `fitView` guarantees for `area`): every lane's full width, from every runner x on it, with the next landing target (bridges ±1.5, checkpoint pads ±3, the jump platforms and the next one, the block lane ±3.6 with every block at every phase, the beam ±0.5); the runner's body everywhere (the disc's rim, the start and finish pads, the knock's stop at 6.35); the hub on the disc and the arch opening on the finish pad. A mutation back to `FOLLOW_X` 0.6 or `area.x` ±3.2 fails the block-lane case. The lag box ≥ v / 8 for the maximum speeds (6 m/s forward, 3.6 m/s sideways for `F`, the 0.5 m `groundY` step).

The generic parts are tested in `core/`: the clock and frame order (`frameLoop.test.ts`, `useArcadeStore.test.ts`), the fit, the lens shift and `followFocus` (`view.test.ts`, `useFittedView.test.ts`), the manifest (`modelManifest.test.ts`), the scores and `isRankedRun` (`scores.test.ts`).

Browser (production build with the flags on and the API mock, headless Chrome over CDP, network log on):

- **Desktop 1280 × 800, keyboard:** start, countdown (the runner stays put with W held; the bar turns), a bar knock (the runner flies off and splashes in view, respawn at the start, the camera holds and then cuts with no swoop, the clock running), CP1, a deliberate fall from J3 (respawn at CP1), CP2, the blocks, CP3, the beam, the finish. The HUD shows "Played" counting up and "Checkpoint k/3". The result shows `finishMs` formatted, the local best stores it as the duration, the score equals the formula.
- **Pause** 2 s mid-jump and while riding a block: no drift, the obstacles freeze and resume in place.
- **375 × 812 and 812 × 375 with touch emulation** (joystick + Jump), with and without the cookie banner: the fit matches the table (±2 px); the window stays clear of the HUD, the joystick and Jump; a full run with touch only.
- **Physics on** (with the debris follow-up; this build has `physics: false`) (the equality with physics off is proven in vitest, above; two browser runs of one key script never match, because frame times vary): a full run completes with `physics: true`. The bot walks into a cube stack from a standstill, straight forward at full stick: while it walks through, `run.x` never changes and p follows the flat-course ramp of its own `simMs` exactly (both frame-independent), and the cubes fly. In the frames after a respawn and after "Go", with cubes placed on the spawn line and on the disc, no cube is faster than 13 m/s (twice the bar tip's 6.5 m/s; a swept 25 m respawn would launch one at about 1500 m/s): the teleport rule.
- **Checks:** draw calls ≤ 150 and 60 fps on desktop and in phone emulation; the Rapier chunk is fetched once, no `.glb` request (the runner is not listed yet, the arch is never a model: Assets); `renderer.info.memory` constant over a run; the cut-line measurements (Rapier step time under 1 ms; time to "ready" with and without the chunk, at most 0.5 s apart on the 4× CPU / Fast 4G profile).

**Browser results of the build PR** (2026-10-06; `next build` + `next start` with `NEXT_PUBLIC_ARCADE_ENABLED`, `_API_MOCK` and `_LEADERBOARD` on; headless Chrome over CDP, GPU NVIDIA GTX 1660 Ti through ANGLE / D3D11; the three.js renderer read through the `__THREE_DEVTOOLS__` hook, the store and the run through the React DevTools hook). A route bot runs in the page (bundled from `rules.ts`, the route and lookahead jumps of the `rules.test.ts` speedrun bot, steering in 8 directions at full deflection) and only writes what it wants; the harness turns that into real CDP key events (desktop) or touch events on the joystick and the Jump button (phones). Every check passed:

| Run | Input | Course | Finish (rules ms) | Respawns | Result after the end | Run 2 (Retry) |
|---|---|---|---|---|---|---|
| 1280 × 800 | keyboard (WASD, Space) | a planned bar knock (respawn on the start line), a planned fall off J3 (respawn on CP1), CP1–CP3 in order, pause mid-jump | 44934 | 5 | 1.18 s | 25091 ms, 1 respawn |
| 375 × 812, dpr 2 | touch only | a planned fall off CP1's side, pause mid-jump, the rest by the bot | 98257 (44458 in a second session) | 13 | 1.32 s | 44781 ms, 5 respawns |
| 812 × 375, dpr 2 | touch only | a planned fall off J3, a fall off the beam (respawn on CP3), pause mid-jump | 50760 | 6 | 1.32 s | 39376 ms, 4 respawns |

- **Every run:** the runner stays on the start line during the countdown with the stick held, while the bar turns (obstacle ms −2.8 s → −1.9 s); `finishMs` ≥ 19334, ≤ `elapsedMs` and within a frame of it; HUD stats "Checkpoint 3/3" and `finishMs`; checkpoints in order; the local best stores `floor((300000 − finishMs) / 10)` with `finishMs` as the duration, and the result shows it ("Played 0:44.93"); the result panel appears after the 1.2 s delay; Retry starts a fresh run (`runId` + 1, checkpoint 0, no respawns) that also finishes; `renderer.info.memory` is the same after run 1 and run 2 (47 geometries, 5 textures, 10 programs); no `.glb` request, no Rapier chunk request, no console error or warning.
- **Pause** 2 s mid-jump (feet 0.23–0.51 m up): `x`, `y`, `z`, `simMs`, the obstacle ms and `elapsedMs` unchanged; Resume continues in place.
- **Fit** (camera at rest on the start line, the live camera's projection): 1280 × 800 feet (640.0, 523.1), runner 102.6 px, window x 142–1138, y 52–609; 375 × 812 feet (187.5, 411.2), 32.7 px, window x 30–345, y 78–442, the same with the cookie banner open; 812 × 375 feet (450.6, 258.8), 53.3 px, window x 187–714, y 25–303; with the banner x 218–594, y 23–254, 39.7 px. All within 0.5 px of the table. The window stays clear of the HUD, the joystick and Jump, and the banner.
- **Camera cuts:** 24 respawns over the three runs (knocks, falls, cuts of 2.0–22.4 m): each cut lands in the respawn's frame, no camera step larger than 0.06 m in the 30 frames before or after it, the camera always looks forward and never passes the runner. (This check missed the cut frame's pitch: review fixes below.)
- **Time-up** (1280 × 800 and 375 × 812): idle until the rules' cap: `endReason` `"timeup"`, `simMs` 300000, `elapsedMs` 300009.7 and 300004.9 (the end of that frame), "Time's up!" with "Finish the course to set a time. This run was not saved.", nothing in local storage, no score POST.
- **Performance:** 46–59 draw calls, 72–74k triangles; 58–60 fps on every viewport (the headless frame rate); with the CPU throttled 4× and no bot in the page, 49–58 fps on 1280 × 800 and 812 × 375, 42 fps on 375 × 812 at dpr 1.75 (the samples show three.js's render loop, no game function, at the top). Time to "ready" from navigation (no throttle) 1.7–3.0 s (one 6.8 s load on a busy machine).
- **Not covered by the browser:** the debris layer (not built), the runner GLB (not generated yet).
- **For the next touch harness:** in CDP touch emulation a point left out of a later `touchMove` is never released (the Jump button stays held, so only the first press jumps), and `touchEnd` releases every point; press Jump with a `touchStart` next to the held joystick, then `touchEnd` and put the joystick finger back. Touch moves are rAF-aligned: one joystick dispatch in flight at a time, or the input queue backs up and frames stall.

**Browser results of the review fixes** (2026-10-06, the branch rebased on main with group A's `finishArch.glb` listed; the same setup, a fresh Chrome profile per run, so the shader cache is cold). The harness now also records the camera direction and the lens shift at `gl.render`, every frame over 50 ms while playing, the programs at "Go", and whether Play is clickable and clear of the cookie banner on the first screen (no scrolling). Every check passed:

| Run | Input | Respawns (run 1) | Finish (rules ms) | Run 2 (Retry) | Programs at "Go" | Frames over 50 ms | Play / banner top |
|---|---|---|---|---|---|---|---|
| 1280 × 800 | keyboard, a planned knock and a fall off J3, pause mid-jump | 3 | 36930 | 24955 ms | 10 | 0 | y 479–527 / no banner |
| 375 × 812 with the cookie banner, dpr 1.75 | touch only, a planned fall off CP1, pause mid-jump | 46 (the bot's touch timing on B2) | 207186 | 44730 ms | 10 | 0 | y 565–613 / 650 |
| 812 × 375, dpr 1.75 | touch only, a planned fall off J3, pause mid-jump | 27 | 133186 | 50712 ms | 10 | 0 | y 163–211 / no banner |

- **Camera cuts:** in all 76, the cut frame's direction and lens shift equal the values at rest (largest change 0); the largest camera step around a cut is 0.06 m. **The checks fail without the fixes:** a probe build without the re-aim and without `gl.compile` (812 × 375, 27 respawns) drew every cut frame pitched up (direction y −0.21 to −0.34 against −0.64, change 0.35–0.49), had 8 programs at "Go", and a 117 ms frame at the first respawn.
- **Unchanged:** the fit at rest (1280 × 800 feet (640.0, 523.1), 102.6 px; 812 × 375 (450.6, 258.8), 53.3 px; 375 × 812 window x 30–345, y 78–442 with the banner open), 53–57 draw calls, about 74k triangles, 60 fps, the same renderer memory after run 1 and run 2 (47 geometries, 5 textures, 10 programs), pause without drift, the result 1.2–1.45 s after the end, the local best equal to the formula, no Rapier chunk, **no `.glb` request** (the arch is never a model). Time-up (1280 × 800, idle): `"timeup"` at `simMs` 300000, "Time's up!", unranked, nothing stored, no POST.
- **Console:** only two failed requests to `http://localhost/wp-json/play50/v1/auth/status` per load (the review worktree has no `.env.local`, so the site's auth check has no WordPress to ask); nothing from the game.
- **Play and the banner, every built game** (first visit, no consent stored): at 375 × 812 the banner's top is at y 650, and Play is at 565–613 here (668–716 before, under the banner), 544–592 in robot-collector, 594–642 in office-escape and warehouse-rush; at 390 × 844 at 565–613 against 682. At 360 × 740 (banner top 557) Play sits under the banner in all four games (Known issues).

## Known issues and core gaps

- **Time-game HUD (blocker for `"live"`).** The shell shows a Score chip that is always 0 for a time game (HUD above). Core change before release: hide it for `scoring.kind === "time"`. The race clock needs no core change (no `durationMs`: "Played" counts up, and the rules own the 300 s cap).
- **`PhysicsGate` is built for looks, not rules.** It pauses Rapier in every phase but `"playing"`, so debris freezes during the countdown and the result delay; it steps on R3F's raw delta (clamped 0.5 s) at the visuals priority; and the Scene suspends until the Rapier chunk is loaded, so the start screen waits for a decorative layer (hence the 0.5 s cut line). While it is paused, kinematic poses must be teleports (the debris layer handles this, Physics). Fine for this game's debris, a dead end for any rules physics. Core candidate: a decorative mode (its own Suspense, stepping until `isResultShown`).
- **No core channel for an exact finish time.** The game passes it through `setStat("finishMs")` and `finalScore`. Core candidate: `end("win", { durationMs })` for time games.
- **No camera cut in `CameraRig`.** The game keys the rig by the respawn count, holds `F` until the new rig has mounted and mounts it with R3F `flushSync` from a `useFrame` (Scene and camera), because the rig snaps in a passive effect and its first `useFrame` can run before it, looking at its unset look point. The unmounted rig still runs once in that frame (R3F 8 iterates the frame's subscriber list as it was when the frame began), so the Scene re-aims at −0.2. Core candidate: a `snapKey` prop that snaps in the same frame (and a rig whose look point starts at its first target), with the rig staying mounted, so no outgoing rig runs at all.
- **No core shader warm-up.** Each game's programs compile the first time an object is drawn, so anything out of the first view stalls a frame when it comes into view on a first visit. This game compiles its scene in a layout effect (Scene and camera). Core candidate: `gl.compile(scene, camera)` in `ShellStage` after the Scene mounts, for every game.
- **Time-up result panel (core `format.ts` / UI kit `ResultPanel`, seen here).** The unranked "Time's up!" panel shows a large "5:00.00", `formatScore(0, scoring, 300000)`, which reads like a race time, and with no best yet "Best 0 time" (`formatScore(0, scoring, null)` falls through to the unit label "time"). For the core / K2 owners: for `display: "time"`, show "–" (or no Best line) without a duration, and no time headline for an unranked time-game run.
- **The cookie banner covers Play at 360 × 740 in every built game** (core: the start panel or the banner). At 375 × 812 this game's Play (y 565–613) clears the banner (top 650), as robot-collector's, office-escape's and warehouse-rush's do; its instructions were cut to three two-row lines for that (they were the longest of the ten and covered Play).
- **Core `<DynamicInstanced parts>` throws on unmount** (found here; no game used the `parts` form before). Its `PartMesh` renders `<instancedMesh dispose={null}>`, which R3F applies as a property (`mesh.dispose = null`, its opt-out from disposal), and its layout cleanup then calls `mesh.dispose()`: "TypeError: e.dispose is not a function" on every Scene unmount (start, retry, exit), with the same path behind `<DynamicInstancedModel fallbackParts>`. This game uses the children form instead (the blocks are one merged, vertex-coloured geometry; the splash drops a plain sphere). Core fix: drop `mesh.dispose()` from that cleanup (R3F frees the buffers with the mesh) or call `InstancedMesh.prototype.dispose.call(mesh)`.
- **No Rapier debris yet** (Physics, "Cut line": it failed the 0.5 s "ready" budget). Needs the `PhysicsGate` decorative mode above first.
- **The runner's concept art is pending.** Until the shared runner exists, the stand-in runs the whole game. The group A arch does not fit the posts and is not used (Assets); a regenerated arch is optional and independent of the runner.
- **Forged submissions.** The proof covers honest clients: none can finish under 19334 ms. A forged POST can still claim any duration from 15000 ms; that is Phase 5 (run tokens). The optional `minDurationMs` 19000 above shrinks the gap. A fixed, seedless course makes a server-side replay of an input log possible later.
- **Catalog.** `skills.md` lists this game's universe as `playground` and its obstacles as "Rapier colliders". This design uses `shared-cast` / 5050 and primitives with rules collision (Rapier only mirrors them for the debris). Claude updates the catalog in the assets PR; this branch edits only this folder.
- **Inherited from the core:** the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll, so the camera eases to its new fit up to a second after the banner opens or closes.
