# Obstacle Race

Owner: Claude. Slug: `obstacle-race`. Game 10 of the 3D Arcade: the only time trial with a course, checkpoints and respawns, and the only game that loads Rapier. **This file is the design.** It adds the design and `assets.spec.json` only: `meta.ts` and the stub `index.tsx` are unchanged, and the status stays `"soon"`. The build PR implements `rules.ts` and `rules.test.ts` first (the proof below), then the Scene. The limits in `meta.ts` are correct as they are (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. Unchanged by the build except `thumbnail`. |
| `index.tsx` | The `GameDefinition`: Scene, assets, `physics: true` (the debris layer only), `durationMs: 300000`, camera, environment, `touchControls: ["joystick", "jump"]`, `hudStats`, instructions, `resultDelayMs`, `finalScore` (the exact finish ms). |
| `rules.ts` | Everything that decides the outcome: the fixed course as data, the integer-ms clock, kinematic movement with closed-form jumps, collisions, the moving obstacles as functions of rules time, the bar knock, checkpoints, falls and respawns, the finish, the proof constants. Pure: no three.js, React, DOM, Rapier, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`: the golden constants, course checks, movement, obstacles, checkpoints, and the minimum-time proof driven through the real store clock. |
| `camera.test.ts` | The fit table below, from core `fitView` with the fixture rects, and the runner inside the window at every course width. |
| `Scene.tsx` | The frame loop: maps input, calls `step`, reports events to the store, keeps the follow point, places the fitted follow camera (and cuts it on a respawn), draws the run. |
| `Primitives.tsx` | Course look: pads, bridges, pillars, the sweeper disc, hub and bar, the blocks, the beam, the water, checkpoint gates, the stand-in runner and the stand-in arch. |
| `Debris.tsx` | The Rapier layer: foam cubes the runner can kick into the pool. Never read by the rules. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the one model only this game generates (the finish arch). |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, pure `rules.ts` with tests that prove the limits through `advanceRunClock` and `playedFrameDt`, the run state made once in `useState`, one `useRunFrame` that calls `rules.ts` and then the store, visuals in `useFrame` with `useGameTime()`, the `useFittedView` + `CameraRig` block, `<Model fallback>` for models. Games never import each other.
- **This game adds five patterns** (copy, never import):
  1. **A distance proof for a time game.** A cap on forward progress per rules ms, plus a respawn that never lands ahead of where the runner already was, gives a minimum finish time from the course length alone. No obstacle has to be part of the proof.
  2. **Fixed 1 ms steps with closed-form jumps.** The arc depends only on the ms since take-off, so a jump is the same at 30, 60 or 144 fps.
  3. **The exact finish ms.** The rules record the ms in which the finish happened; the Scene publishes it with `setStat("finishMs")` before `end("win")`, and `finalScore` submits it, so the frame rate never costs a player time.
  4. **Rapier for looks only.** Physics bodies are posed from the rules every frame and nothing flows back.
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
- **Nothing flows back.** The rules never import Rapier, and the Scene never writes a Rapier result into `run`. The browser test runs one scripted input with `physics: true` and with `physics: false` and requires the same `finishMs`.
- **Cut line.** The build PR measures the layer on a mid-phone profile (Chrome, 4× CPU throttle, Fast 4G): Rapier's step under 1 ms per frame, and "ready" no more than 1.5 s later than without it. If either fails, it ships with `physics: false` and without `Debris` (no chunk, no cost). Rules, proof, camera and leaderboard are the same either way.
- **No ragdoll.** The shared runner has no concept art yet, a ragdoll needs a rigged skeleton with about ten bodies and joints, and a fall lasts under 1.5 s before the respawn cut. A scripted tumble (spin, flailing limbs on the primitive) reads the same on a phone.

## Constants

1 world unit = 1 m. Forward is −z; **progress** p = −z. All of these live in `rules.ts` and are pinned by a golden test.

| Name | Value |
|---|---|
| Rules time | whole ms (`simMs`), fixed **1 ms steps**, at most 50 per frame (`useRunFrame` dt ≤ 1/20 s). The fraction is carried to the next frame. |
| Runner | circle radius 0.35 in x/z, height 1.5 (feet to head), drawn 1.5 tall. Spawns at x = 0, feet y = 0, p = 0, facing forward. |
| Run speed | `V_RUN` **6.0 m/s** at full stick; the stick is analog. Acceleration 40 m/s² on the ground (also braking), 20 m/s² in the air. |
| Jump | gravity `G` 25 m/s², `V_JUMP` 8.5 m/s, closed form `y = y0 + 8.5·t − 12.5·t²`: apex **1.445 m** at 340 ms, **680 ms** in the air on the flat. |
| Coyote / buffer | 100 ms / 120 ms, inclusive. |
| Support grace | `FOOT` 0.2: the runner stands on a top while its centre is within 0.2 m outside the top's edge. |
| Carry | grounded on a block: the block's own Δx each ms; on the beam: the slide. In the air the take-off carry is kept (launch carry). **x only, never z.** |
| Sweeper | disc radius 6, top 0. Hub radius 0.7, 1.6 tall, solid, not a support. One bar through the hub: arms out to 5.9, 0.35 thick, 0.25–0.70 m above the disc. ω 1.1 rad/s (period 5712 ms), angle `ω · simMs / 1000`, along ±x at 0. |
| Knock | a bar hit flings the runner off the disc: vx = 12 m/s away from x = 0 (+x at x = 0), vy = 8, vz = 0, no collisions, no input. |
| Blocks | 5 slabs, 2.4 (x) × 2.2 (z) × 0.6, top 0. x = 2.4 · (2s − 1) with s = smoothstep of a triangle wave (`u = frac(t / 4000 + φ)`, `w = 1 − |2u − 1|`, `s = w²(3 − 2w)`), phases φ = 0, ½, ¼, ¾, ½. Top speed 3.6 m/s, smooth turns, no trig. |
| Beam | 20 × 1.0, top 0. Slide `v = 1.8 · (2s − 1)` m/s along x, the same wave with period 3200 ms. Drawn tilting ±10° in phase. |
| Kill plane | feet below `KILL_Y` −1.5: the runner is lost. Water drawn at −2.0. |
| Lost / spawn | `LOST_MS` 600 in the water, then a respawn at the active checkpoint and `SPAWN_MS` 300 frozen. The clock keeps running. |
| Run limit | `DURATION_MS` 300000 (= `timeBaseMs`): GameShell's `"timeup"`, unranked. |
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

Every gap and every move has room to spare (`V_RUN` × the time to land at that rise; minimum travel = the gap minus both 0.2 m edge graces; neighbouring platforms overlap in x, so the shortest jump is straight forward):

| Jump | Gap | Rise | Time to land | Reach at full speed | Minimum travel | Share of the reach |
|---|---|---|---|---|---|---|
| CP1 → J1, J1 → J2 | 2.4 | +0.5 | 615 ms | 3.69 m | 2.0 | 54 % |
| J2 → J3 | 2.6 | +0.5 | 615 ms | 3.69 m | 2.2 | 60 % |
| J3 → J4, J4 → J5 | 2.6 | −0.5 | 734 ms | 4.41 m | 2.2 | 50 % |
| J5 → CP2 | 2.4 | −0.5 | 734 ms | 4.41 m | 2.0 | 45 % |
| CP2 → B1, B → B, B5 → CP3 | 1.6 | 0 | 680 ms | 4.08 m | 1.2 | 29 % |

- **Blocks never force a wait.** In the worst instant two neighbouring blocks are 4.8 m apart (centres, opposite ends). Landing needs the centre within 1.4 of the target's centre, so the runner needs 3.4 m sideways and 1.2 m forward in 680 ms: 5.3 m/s, under 6. Waiting for a better moment is a choice, not a rule. A runner standing on a block reaches at most 0.55 m past its front edge, and the next row is 1.6 m away, so a sliding block never touches a runner on the block behind it.
- **The bar can be jumped wherever it is fast enough.** Feet stay above its 0.70 m top for 488 ms of a jump (96–584 ms after take-off). The bar takes `(0.35 + 0.7) / (1.1 · r)` to pass a runner at radius r: 477 ms at r = 2, 318 ms at 3, 162 ms at the tip. Inside r ≈ 1.96 it is too slow to clear, so the line past the hub is at |x| ≥ 2 (or between two sweeps).
- **The beam can always be held.** The slide is at most 1.8 m/s; countering it at full stick still leaves 5.7 m/s forward.
- **No section can be skipped.** The longest jump the rules allow anywhere, a 1.5 m drop with both edge graces, covers 5.35 m. The shortest distance from any platform to the one after the next is 5.4 m (CP2 → B2, between blocks, B4 → CP3; 7.2–7.6 m among the jump platforms). The disc (12 m) and the beam (20 m) are only crossed on foot. So every obstacle must be passed, in order. Side walls are not needed: the pool beside the course is the wall, and the proof below needs neither walls nor this paragraph.

## Rules

### One step

`step(run, dtMs, input)` runs once per `useRunFrame`, with `dtMs = dt · 1000`. `input` is one object per run (`createStepInput()`), rewritten every frame: `moveX`, `moveZ` (the stick mapped with `inputToWorld(…, 0)`, length at most 1) and `jumpPressed`. A step with dtMs ≤ 0 or NaN does nothing.

1. **Clock.** Add `dtMs` to the carried remainder, take its whole ms (at most 50), keep the fraction in [0, 1). `simMs` therefore never runs ahead of the store's `elapsedMs` and lags it by under 1 ms (as warehouse-rush). A jump press is latched once per frame (it starts the 120 ms buffer at the frame's first ms).
2. **Each ms**, `simMs += 1`, the obstacles move to their place at `simMs`, then the runner's state acts:
   - **run:**
     1. carry: on a block, add the block's Δx for this ms; on the beam, add the slide;
     2. jump if a press is buffered and the runner is grounded or within coyote time: `vy = 8.5`, airborne, launch carry = this ms's carry;
     3. ease the input velocity towards `V_RUN · stick` (40 or 20 m/s²) and cap it at 6 m/s;
     4. move x/z by input velocity + carry;
     5. vertical: airborne `y` from the closed form; a **landing** is a descending crossing of a support's top (feet at or above it before, below it after) with the centre over it (`FOOT` grace); grounded with no support under the centre any more = walked off (coyote starts);
     6. **side collisions:** circle against every solid whose span overlaps the runner's (feet below its top, head above its bottom): pads, bridges, pillars, blocks, beam, the hub and the arch posts are pushed out of (`resolveSphereAabb`, circles for the disc's rim, the hub and the posts);
     7. **progress guard:** the step without its carry (input plus push-outs) is scaled back to at most 6 mm. Carry has no z part, so **p moves at most 6 mm per ms**. If the trimmed position would end inside a static solid, the runner keeps last ms's position instead (it was valid, and not moving passes the guard). An overlap with a block that the trim leaves (at most one ms of block motion, 3.6 mm) is resolved by the next ms. The guard only bites on rare corner grazes (a block's front corner sliding into an airborne runner adds a fraction of a mm forward), but without it the proof would need an allowance;
     8. **bar:** feet below 0.70 over the disc and the circle overlapping the bar's rectangle (in the bar's rotating frame) = knocked;
     9. feet below `KILL_Y` = lost;
     10. **checkpoint:** grounded on the next checkpoint's pad with p ≥ its line activates it (in order only: k + 1 after k);
     11. **finish:** grounded on the finish pad with p ≥ 116 and checkpoint 3 active = finished, `finishMs = simMs`, once. Later steps do nothing.
   - **knocked:** the fling (x and y only, ghost), no input. Feet below `KILL_Y` = lost. The fling clears the disc's edge before it comes down: |x| grows by 12 · 0.64 = 7.68 m before the feet are back at 0, past the 6 m rim, and z never changes.
   - **lost:** no motion (the Scene sinks the runner with a splash). After `LOST_MS`: respawn at (0, top, p = line) of the active checkpoint, velocity and carry 0, grounded, state spawn.
   - **spawn:** no motion, no input, for `SPAWN_MS`; then run.

The step reports what happened in `run.events`, one object reset at the start of every step: `jumped`, `landed`, `checkpoint` (index or −1), `knocked`, `lost`, `respawned`, `finished`. The run keeps `simMs`, `finishMs`, the active checkpoint, `respawns`, `maxP` (the furthest p reached, for tests) and `groundY` (the top of the last support, for the camera). `createRun(course = COURSE)` makes everything once; nothing is allocated after it. Taking the course as data lets the tests run a flattened course (Test plan).

### Obstacles

Pure functions of rules ms: `barAngle(ms)`, `blockX(k, ms)`, `beamSlide(ms)`. The Scene draws them from the same functions. During the countdown it feeds them `−countdownMs`, so the bar is already turning and arrives at its "Go" pose exactly at "Go". During the result delay it feeds `simMs + overMs`, so nothing freezes under the arch. That is visual only: the rules timeline is 0 at "Go" in every run. Only the bar uses trigonometry (`Math.sin` / `Math.cos`), and a last-bit difference between JavaScript engines changes nothing a player could see. The blocks and the beam use polynomials only.

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
| 19.334 s (the bound, unreachable with obstacles) | 28066 |
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

5. **Submitted duration.** `finalScore` submits `finishMs` (a whole number, so `normalizeRun`'s rounding leaves it), with `19334 ≤ finishMs ≤ elapsedMs`. `useRunFrame` runs only while the store is playing, and the store ends the run as `"timeup"` in the tick where `elapsedMs` reaches 300000, so a win has `elapsedMs < 300000`. Thus **19334 ≤ duration_ms ≤ 299999**, inside 15000–300000, and the score is at most `floor(280666 / 10)` = **28066 ≤ 30000**.
6. **Non-wins.** The time-up (300000 ms, idle or lost runs) and quit are unranked and never sent.
7. **Margin.** The bound is 4.33 s (29 %) above the server's floor, and it is a straight line at full speed through the hub, across every gap without waiting. Real wins are far slower (next section). The rounding the server sees cannot lower it: the duration is a whole number of ms already.

**The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.** Optional, for the assets + limits PR (the user decides): raise `minDurationMs` to 19000. An honest client can never go below 19334, so the server would then reject forged sub-19 s claims too. The golden test ties it: `MIN_FINISH_MS ≥ minDurationMs + 300`, so a later speed or course change that breaks it fails the build.

### What real play will score (design estimate)

Not measured yet; the build PR's speedrun bot replaces these numbers with its pinned time. The straight line is 19.3 s. The hub detour, a bar jump or a wait for a sweep (up to 2.9 s between sweeps of one spot), five platform jumps at full speed, five block jumps with some waiting, and the beam at about 5 m/s with corrections put a perfect run around **26–30 s** (score about 27000–27400). A first good run with one or two falls: 45–70 s. Every fall costs 1.2–1.7 s plus the way back.

## Scene and camera

- **Follow camera, no yaw.** The course runs up the screen on every device (`yaws: [0]`), so up on the stick is always forward. The camera follows a point `F` that the Scene updates in `useRunFrame` after the step, except while knocked or lost:
  - `F.x = 0.6 · runner.x` (`FOLLOW_X`: the camera drifts with the runner, the course centre stays in view);
  - `F.y = run.groundY`, the top of the last support (the camera rises a step when the runner lands higher; it does not bob with jumps);
  - `F.z = runner.z`.

  While knocked or lost `F` holds still: the player sees the runner fly into the pool. On a respawn the camera **cuts** to the checkpoint: the `CameraRig` is keyed by `run.respawns` (a follow rig snaps on mount, core), during the 300 ms spawn freeze. A small component compares `run.respawns` in a `useFrame` and sets its key state only when it changed, so React renders once per respawn, never per frame.
- **A fitted window around F.** `useFittedView` is translation-invariant, so `area` is a box relative to `F` at the origin: the runner (its body, a jump's apex 2.95 m above the ground), the course around it and the course ahead. Two module-level views, picked by aspect (a rotation refits):

```ts
const LAG: AABB = { min: { x: -0.75, y: -0.5, z: -0.8 }, max: { x: 0.75, y: 0.5, z: 0.8 } };
const FOCUS = followFocus({ lookAt: [0, 0, 0], reach: LAG, fraction: 1 });
const PORTRAIT = {             // width < height
   area: { min: { x: -3.2, y: -1, z: -22 }, max: { x: 3.2, y: 3, z: 2 } },
   pitch: (45 * Math.PI) / 180, fov: 60,
   yaws: [0], focus: FOCUS, margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 8, shift: true,
};
const LANDSCAPE = {            // width >= height
   area: { min: { x: -4, y: -1, z: -11 }, max: { x: 4, y: 3, z: 2 } },
   pitch: (40 * Math.PI) / 180, fov: 50,
   yaws: [0], focus: FOCUS, margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 8, shift: true,
};
// <CameraRig key={cut} camera={{ position: view.offset, lookAt: [0, 0, 0], fov: VIEW.fov }} follow={F}
//    followFraction={1} offset={view.offset} shift={view.shift} damping={8} />
```

- **Lag in the fit.** `CameraRig` eases with damping 8, so it trails a target moving at v by at most v / 8. F moves forward at most 6 m/s (0.75 m) and sideways at most 0.6 · (6 + 3.6) = 5.8 m/s (0.72 m); `groundY` steps by at most 0.5 m per landing. `LAG` covers these, and `focus` is its corners, so the window stays on screen while the camera catches up.
- **The runner stays inside the window.** Relative to F it sits at `0.4 · x`: at most 0.4 · 6.2 + 0.35 = 2.83 m from the centre on the disc (the widest part), inside ±3.2 (portrait) and ±4 (landscape).
- **Fitted views** (core `fitView`, run for this README; the same inputs as the core fixtures: shell HUD groups `{10, 10, 218, 52}` and `{w − 104, 10, w − 10, 54}`, joystick 132 px and Jump 72 px at 20 px from the bottom corners, both lifted by the cookie banner, the banner as an obstruction). "Window" is the window box on screen with the camera at rest; "gaps" are the closest px from its outline to the HUD, the joystick and Jump at rest. "Binds" is what stops the fit from coming closer, with the camera at the worst corner of `LAG` (2 % margins; 8 px padding for the rects). `camera.test.ts` pins the table (±0.5 px).

| Screen (CSS px) | Pitch / fov | Distance | Lens shift | Window on screen | Runner | Ground px/m at the runner / far edge | A 2.6 m gap 4 m ahead | Gaps HUD / joystick / Jump | Binds |
|---|---|---|---|---|---|---|---|---|---|
| 375 × 812 | 45° / 60° | 19.89 m | (0, −0.171) | x 50–325, y 102–553 | 39.6 px tall, feet at y 475 | 35.4 / 19.8 (22 m ahead) | 46 px | 50 / 107 / 167 | both side margins |
| 375 × 812, 162 px banner | 45° / 60° | 24.82 m | (0, 0.015) | x 82–293, y 75–462 | 31.4 px | 28.3 / 17.4 | 39 px | 23 / 36 / 96 | the HUD and the lifted joystick |
| 812 × 375 | 40° / 50° | 10.72 m | (0.108, −0.297) | x 229–671, y 25–327 | 47.4 px, feet at (450, 243) | 37.5 / 21.0 (11 m ahead) | 33 px | 92 / 84 / 107 | top and bottom margins |
| 812 × 375, 83 px banner | 40° / 50° | 14.92 m | (0, −0.054) | x 266–546, y 22–257 | 33.1 px | 27.0 / 17.2 | 28 px | 90 / 114 / 178 | the top margin and the banner |
| 1280 × 800 (no touch controls) | 40° / 50° | 11.03 m | (0, −0.276) | x 187–1094, y 52–684 | 98.0 px, feet at (640, 510) | 77.8 / 44.1 | 70 px | 181 / – / – | both side margins and the top margin |

  Portrait is bound by the width: 6.4 m of course plus the lag across 375 px. It looks 22 m ahead (3.7 s at full speed), and the lens shift puts the runner 58 % down the screen. The phone in landscape is bound by the height and looks 11 m ahead; the laptop by the width. The lag box costs about 40 px of each side in portrait (the window at rest stops at x 50 / 325, the margins are at 7.5 / 367.5): that is the price of a fit that holds while the camera catches up. Fixed `camera` for the first frame (`index.tsx`): the 1280 × 800 offset, `position: [0, 7.09, 8.45]`, `fov: 50`, `lookAt: [0, 0, 0]`; the Scene's rig takes over on mount.
- **Frame order** needs no care: `useRunFrame` runs before `CameraRig` and every `useFrame` (core).
- **Reading jumps.** The runner's `BlobShadow` (core) sits on the highest support under its centre (`groundBelow(x, z, ms)` in the rules, the blocks at their current x), or on the water. It is the main depth cue for a jump. A soft indigo ring under the feet marks the runner from far away.
- **Looks only** (`useFrame`, `useGameTime()`): run cycle by distance, jump and landing squash, arms out and wobbling on the beam, flailing tumble when knocked or falling, splash and ripples, the checkpoint gate lighting up (green, flag pop) on activation, the runner cheering under the arch through the result delay (`resultDelayMs: 1200`). Water: one plane with a scrolling canvas texture. Environment: background and fog `#bae6fd`, fog 45–110 m, `lighting: "day"`.
- **Draw calls (estimate, measured in the build PR):** about 45: pads and bridges, pillars and platform tops (instanced), disc, hub, bar, blocks (one `<DynamicInstanced>`), beam, water, checkpoint gates (instanced), arch, runner (about 20 parts as a primitive), two blob shadows, the debris (one). Far under 150, no shadow maps.

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` (character; its concept art is still pending) | `assets/shared.spec.json` | the player | own stand-in, as office-escape's: hoodie, round head with a headband, capsule limbs swung in code |
| finishArch | **this game** `models/3d/obstacle-race/finishArch.glb` | `./assets.spec.json` | the goal | two red inflatable legs, a yellow top tube, a checkered banner (canvas texture) |
| pads, bridges, pillars, platforms, disc, hub, bar, blocks, beam, water, gates, foam cubes | primitives in code | none | the course | (always primitives) |

- **Generate only the finish arch.** It is the course's landmark: in view for most of the beam and through the result delay, and the one shape where a model clearly beats stacked primitives. One text-to-3D prop, `Gen-2.5-Low`, `qualityOverride` 3000, one attempt: 1 generation, about 0.5 credit at the plan's rate. The spend is approved by the user in chat first. Obstacles stay primitives: their collision is in the rules, and their exact size has to match it.
- **Universe `shared-cast`, seed 5050**, not a new `playground` universe: the arch stands next to the shared runner and nothing else is generated, so it should match the runner's set (tower-climb's flag made the same choice). The prompt follows the `skills.md` formula and asks for "about twice as wide as it is tall and thin from front to back", because Rodin normalises the size and only the proportions survive. "No text" keeps a FINISH lettering off the banner.
- **Size:** 8.0 m wide (it spans the finish pad), 4.2 m tall, 0.8 m deep, standing on y = 0, facing +z (towards the runner). `assets.ts` sets `scale` / `yOffset` from the GLB's measured bounds in the assets PR. Collision is the two post circles in the rules (radius 0.4 at x ±3.6, 6.4 m clear between them), never the mesh.
- **Runner:** `{ ...SHARED_ASSETS.runner, rotationY: Math.PI }` (it runs towards −z), scaled to 1.5 m in the assets PR. Until the GLB exists and is listed in `core/modelManifest.ts`, the stand-in shows and no `.glb` is requested. A GLB without clips is animated on the root in code (as office-escape); if it looks wrong, `assets.ts` keeps the stand-in (one line).

```ts
export const ASSETS = {
   runner: { ...SHARED_ASSETS.runner, rotationY: Math.PI },
   finishArch: {
      id: "finishArch",
      url: "/models/3d/obstacle-race/finishArch.glb",
      fallback: "box",
      fallbackColor: "#ef4444",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
```

## HUD

- **Shell HUD:** Score, Time and `hudStats: [{ key: "checkpoint", label: "Checkpoint", max: 3 }]` ("Checkpoint 2/3"). The store clears stats when a run starts and the chip shows 0 until set, so no run-start hand-off is needed. The Scene calls `setStat("checkpoint", k)` on each activation. No custom HUD panel.
- **Core gap (a blocker for `"live"`):** for a time game the shell still shows Score (always 0 here) and, with `durationMs` set, Time counting **down** from 5:00. A race needs the elapsed time. Core change (Claude, a core PR before this game goes live): for `scoring.kind === "time"`, hide Score and show Time counting up, still ending the run at `durationMs`. Until then the game is playable with the 5:00 countdown.
- **Sounds:** `"jump"` on take-off, `"pickup"` on a checkpoint, `"hit"` on a knock or a fall; GameShell plays `"win"` on the finish and `"lose"` on the time-up.

`index.tsx`:

```ts
const definition: GameDefinition = {
   slug: "obstacle-race",
   Scene,
   assets: ASSETS,
   physics: true,                 // the Debris layer only; rules never touch Rapier
   durationMs: DURATION_MS,       // 300000: the time-up, unranked
   // first frame only: Scene's CameraRig (core useFittedView) takes over on mount
   camera: { position: [0, 7.09, 8.45], fov: 50, lookAt: [0, 0, 0] },
   environment: { background: "#bae6fd", fog: ["#bae6fd", 45, 110], lighting: "day" },
   touchControls: ["joystick", "jump"],
   hudStats: [{ key: "checkpoint", label: "Checkpoint", max: 3 }],
   instructions: [
      "Run to the finish arch as fast as you can: WASD or the joystick to run, Space or Jump to jump.",
      "Jump the spinning bar, hop the platforms, ride the sliding blocks, keep your balance on the beam.",
      "Fall in the pool and you restart at the last checkpoint. The clock keeps running.",
      "Your finish time is your score.",
   ],
   resultDelayMs: 1200,
   finalScore: (s) => ({
      score: s.score,
      durationMs: s.endReason === "win" && (s.stats.finishMs ?? 0) > 0 ? s.stats.finishMs : s.elapsedMs,
   }),
};
```

## Edge cases

- **Pause** (Esc, P, tab hidden, blur) stops `useRunFrame`, the rules clock and every obstacle with it (they are functions of `simMs`), and Rapier (core). A runner paused mid-jump resumes the same arc; one paused on a block resumes on the same spot of it.
- **Countdown:** the runner stands on the start line; `useRunFrame` does not run, so presses are dropped; the obstacles animate into their "Go" pose.
- **Finish and time-up on the same frame:** `RunClock` ends the run first, `useRunFrame` does not run, no win. Deterministic.
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

- **Constants (golden).** Every number in "Constants" and the course table, plus the derived ones recomputed from the tuning numbers: apex 1.445 and 340 ms, airtime 680 ms, the jump table (time to land, reach, share), the bar's 488 ms window and its 1.96 m inner radius, the knock's 7.68 m, the block top speed 3.6 m/s, `MIN_FINISH_MS` 19334 and each checkpoint's earliest ms. `MIN_FINISH_MS ≥ minDurationMs + 300`, and the scoring limits equal `meta.ts`. A change to a speed, a gap or a line without updating the proof fails.
- **Course.** Parts in p order without holes on the walking path (bridges overlap the disc); all joins at equal heights; every checkpoint line and the finish line inside their pads; the spawn on the start line. Every jump in the table has share ≤ 0.65 of its reach. Every skip distance > the longest jump (5.35 m). The free paths exist (a bot walks each section).
- **Movement.**
  - Top speed exactly 6 m/s; a diagonal is not faster; half a stick is half the speed; acceleration and braking as listed.
  - Jump apex and airtime identical at 1, 4, 16.7, 33 and 50 ms frames (1 ms steps). Coyote at 99 / 100 / 101 ms, buffer at 119 / 120 / 121 ms; a held press never jumps twice; no jump in the air.
  - A landing only from above; the centre 0.20 past an edge stands, 0.21 falls.
  - On a block the runner keeps its spot on the block exactly, every ms; launch carry stays constant in the air; the beam's slide moves a standing runner by the formula.
  - Pushed out of pillars, the hub and the arch posts, and slides along them.
  - 50,000 random ms (random stick, jump mashing, random positions and states along the course, all obstacle phases): p never moves more than 6 mm in one ms, a respawn never sets p above `maxP`, nothing ever ends inside a static solid.
  - **The guard is needed:** a pinned corner graze (an airborne runner at full forward speed, a block's front corner sliding into it from the side) moves p by more than 6 mm in that ms without the guard (the test runs the same resolution with the guard off) and by exactly 6 mm with it. A pinned trim against a pillar's corner keeps last ms's position.
- **Obstacles.** Golden positions of the bar, every block and the beam at fixed ms (including negative ms for the countdown visuals). The bar hits at feet 0.699 and not at 0.700; tangency of the circle counts. A timed jump at r = 3 clears it; a standing runner is knocked. The knock never touches the disc again (ghost), z stays the same, and the runner is lost 792 ms later.
- **Checkpoints and respawns.**
  - Activation needs grounded on the pad with p ≥ the line: an airborne crossing does nothing until the landing; landing deep on the pad activates.
  - Activated exactly at the line, the respawn p equals the line (a mutation that respawns at the pad's centre fails: it would be ahead of the activation point).
  - Teleporting the runner onto CP2's pad with CP1 inactive activates nothing; onto the finish pad without CP3 does not finish.
  - Lost 600 ms, spawn 300 ms, exact; input ignored in both; `simMs` keeps counting.
- **Finish.** Once; `finishMs` is the ms of the landing or the crossing; later steps change nothing.
- **Proof.**
  - The real store (`createArcadeStore`), driven with `advanceRunClock` and `playedFrameDt` through countdowns that end mid-frame, pauses, resumes and frames from 4 to 300 ms: no untimed step, `simMs ≤ elapsedMs < simMs + 1` after every frame.
  - **The bound is tight for the movement and loose for the course:** on a flattened course (`createRun(FLAT)`: one 126 m pad, no obstacles, the same lines) a straight-line bot at full stick reaches each line at exactly the table's ms (± 1) and finishes at 19334. On the real course no bot or random input finishes before 19334, and every checkpoint respects its earliest ms.
  - A **speedrun bot** (scripted route past the hub, timed jumps, block riding, beam correction, the real `step` at 60 fps) finishes; its time is pinned (± 0.5 s) from its first run and replaces the estimate above. It also finishes at 30 and 144 fps, above the bound.
  - `finalScore` with the bot's final store state: `durationMs` = `finishMs` ≤ `elapsedMs`, `normalizeRun` gives `computeTimeScore`, the duration lies in 15000–300000 and the score is at most 28066. (Not `withinServerLimits`: its points-per-second check is a points game's rule, and a time game's rate is 0.)
  - An idle runner times out with `"timeup"` at exactly 300000 ms; `isRankedRun` is false for it and for quit.
- **Determinism.** Two runs with the same frame list and inputs end in deep-equal run states and event sequences. `rules.ts` imports nothing but `core/math`, `core/collision` and types (a source check: no three.js, React, Rapier).

`camera.test.ts`: the fit table rows from core `fitView` (±0.5 px), the runner's body inside the window at every course width with `FOLLOW_X`, and the lag box ≥ v / 8 for the maximum speeds.

The generic parts are tested in `core/`: the clock and frame order (`frameLoop.test.ts`, `useArcadeStore.test.ts`), the fit, the lens shift and `followFocus` (`view.test.ts`, `useFittedView.test.ts`), the manifest (`modelManifest.test.ts`), the scores and `isRankedRun` (`scores.test.ts`).

Browser (production build with the flags on and the API mock, headless Chrome over CDP, network log on):

- **Desktop 1280 × 800, keyboard:** start, countdown (the runner stays put with W held; the bar turns), a bar knock (respawn at the start, camera cut, the clock running), CP1, a deliberate fall from J3 (respawn at CP1), CP2, the blocks, CP3, the beam, the finish. The result shows `finishMs` formatted, the local best stores it as the duration, the score equals the formula.
- **Pause** 2 s mid-jump and while riding a block: no drift, the obstacles freeze and resume in place.
- **375 × 812 and 812 × 375 with touch emulation** (joystick + Jump), with and without the cookie banner: the fit matches the table (±2 px); the window stays clear of the HUD, the joystick and Jump; a full run with touch only.
- **Physics on and off:** one scripted input, two builds of the definition (`physics: true` / `false`): the same `finishMs`. Kicked cubes never change the runner.
- **Checks:** draw calls ≤ 150 and 60 fps on desktop and in phone emulation; the Rapier chunk is fetched once, no `.glb` requests before the assets PR (none is listed); `renderer.info.memory` constant over a run; the cut-line measurements (Rapier step time, time to "ready" with and without the chunk).

## Known issues and core gaps

- **Time-game HUD (blocker for `"live"`).** The shell shows Score 0 and a 5:00 countdown for a time game (HUD above). Core change before release.
- **`PhysicsGate` is built for looks, not rules.** It pauses Rapier in every phase but `"playing"`, so debris freezes during the countdown and the result delay; it steps on R3F's raw delta (clamped 0.5 s) at the visuals priority; and the Scene suspends until the Rapier chunk is loaded, so the start screen waits for a decorative layer. Fine for this game's debris, a dead end for any rules physics. Core candidate: a decorative mode (its own Suspense, stepping until `isResultShown`).
- **No core channel for an exact finish time.** The game passes it through `setStat("finishMs")` and `finalScore`. Core candidate: `end("win", { durationMs })` for time games.
- **No camera cut in `CameraRig`.** The game keys the rig by the respawn count. Core candidate: a `snapKey` prop.
- **The runner's concept art is pending.** Until the shared runner exists, the stand-in runs the whole game. The arch can be generated independently.
- **Forged submissions.** The proof covers honest clients: none can finish under 19334 ms. A forged POST can still claim any duration from 15000 ms; that is Phase 5 (run tokens). The optional `minDurationMs` 19000 above shrinks the gap. A fixed, seedless course makes a server-side replay of an input log possible later.
- **Catalog.** `skills.md` lists this game's universe as `playground` and its obstacles as "Rapier colliders". This design uses `shared-cast` / 5050 and primitives with rules collision (Rapier only mirrors them for the debris). Claude updates the catalog in the assets PR; this branch edits only this folder.
- **Inherited from the core:** the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll, so the camera eases to its new fit up to a second after the banner opens or closes.
