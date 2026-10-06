# Robot Collector

Owner: Claude. Slug: `robot-collector`. Game 1 of the 3D Arcade and the **reference game**. Copy this folder's structure, file split and this README's sections for every other game. Status stays `"soon"` until Release 1, when the game goes live together with the leaderboard.

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, assets, timer, camera, HUD stats, instructions. |
| `rules.ts` | Everything that decides the outcome: map, seeded layouts, movement, pickups, scoring. Pure, no three.js/React/DOM/`Math.random`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the scoring-limit proof below. |
| `Scene.tsx` | The frame loop, the camera and the moving things: feeds input + dt into `rules.ts`, draws the result, reports to the store. |
| `Primitives.tsx` | Warehouse-only look: floor, walls, crates, barrels, the stand-in robot and battery. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for models only this game generates. |

### What a new game copies from here

- **Copy:**
  - The file split above.
  - `meta.ts` and `index.tsx` as they are.
  - `rules.ts` as pure functions with a seed (`createRng` from `core/math`), plus tests that prove the scoring limits. Use `core/limits` and drive the real store with `advanceRunClock` and `playedFrameDt`, like `rules.test.ts`.
  - From `Scene.tsx`:
    - the run state, made once in `useState` (no setState in the loop);
    - one `useRunFrame` that calls `rules.ts` and then the store (`addScore`, `setStat`, `end`);
    - visuals that only read that state in `useFrame` and animate with `useGameTime()`;
    - the camera block: `VIEW` with `focus: followFocus(…)` and `shift: true`, `useFittedView(VIEW)`, `<CameraRig … followFraction offset shift>` with the same `LOOK_AT` and `FOLLOW`, and `inputToWorld(moveX, moveY, view.yaw)` from `core/math`;
    - `<Model asset fallback={<OwnPrimitive/>}>` for every model, and `<InstancedModel asset spots fallback={<Instanced …/>}>` for repeated props (the `Crates` / `Barrels` pattern at the end of `Primitives.tsx`).
- **Do not copy:** the rest of `Primitives.tsx` (canvas-drawn textures, the warehouse, the robot and battery stand-ins) or the battery pop, beam and ring effects. They are decoration for this game.
- **Everything generic comes from `core/`** (`core/README.md`): frame order, game time, camera fit and follow range, lens shift, safe area, input mapping, instanced props, blob shadows, canvas textures, seeded RNG, server limits. Games do not import from each other. If something generic is missing, ask Claude to add it to the core.

## Concept

A small teal robot drives around a compact warehouse and collects 10 glowing batteries before a 60-second clock runs out. The warehouse is a 24 × 16 floor with walls, crates and barrels. The batteries light up two at a time. When both are collected, the next pair pops up somewhere else. The game is about choosing the order and steering cleanly around the props. The look is the Play50 vinyl-toy style with accent `#7dd3fc`.

## Controls

Matches `meta.ts` (`scheme: "joystick"`).

- Keyboard: WASD or the arrow keys. Diagonals are not faster. Esc or P pauses (GameShell).
- Touch: the virtual joystick (bottom left). It is analog, so a small push drives slowly.
- Controls are **screen-relative**: up always means "away from the camera", also when a portrait phone turns the camera 90° (`inputToWorld` from `core/math.ts`, with the fitted view's yaw).
- Movement (`ROBOT` in `rules.ts`): top speed 5 units/s, acceleration 24 u/s², braking 30 u/s². The robot turns to face where it is going (`turnRate` 14/s, eased).

## Rules

- The run lasts 60 s of unpaused play (`durationMs: 60000`). GameShell runs the 3-2-1 countdown and the clock.
- 10 batteries come in 5 waves of 2 (`WAVE_SIZE`). Only the current wave is on the floor. When its second battery is collected, the next wave appears at once with a short pop-in.
- A battery is collected when the robot's circle (r = 0.5) touches the battery's circle (r = 0.3), that is, when the centres are within `PICKUP_REACH` = 0.8.
- The robot collides with the walls and with every crate and barrel (circle vs AABB, `core/collision.ts`). Barrels collide as squares, which shows as a gap of under 0.2 at their corners.
- All 10 collected: the run ends with `end("win")`. The clock reaches 0: GameShell ends it with `"timeup"`.
- Every run gets a new layout. Scene draws a random 32-bit seed (`randomSeed()`), and `generateLayout(seed)` turns it into 10 battery spots, so the same seed always gives the same layout. A layout must pass `isValidLayout`:
  - Batteries spawn on a 0.5-unit grid inside |x| ≤ 10.5, |z| ≤ 6.5, at least 1 unit from any prop. The test flood-fills the map to check that every spawn spot is reachable.
  - Spacing (`SPACING`): the first wave is ≥ 4 units from the start pad, the 2 batteries of a wave are ≥ 5 apart, and every battery is ≥ 8 from every battery of the previous wave.
  - Fairness band: the ideal route (centre to centre, best order, obstacles ignored) is 80–95 units, so no seed is much easier than another.
  - If 40 attempts cannot produce a valid layout, `FALLBACK_SPOTS` is used. It never happens for the 1000 seeds the tests try.

## Scoring

| Event | Points |
|---|---|
| Battery | +100 (`addScore`, live in the HUD) |
| Win (all 10) | + 10 per **full** second left: `10 * floor(timeLeftMs / 1000)` |
| Time up | no bonus: `100 * collected` (at most 900) |

The final score is `runScore(collected, won, timeLeftMs)`. The duration GameShell submits is `elapsedMs`, the store's default, so `finalScore` is not overridden. Examples: a win at 21.6 s gives 1000 + 380 = **1380**. 9 batteries at time-up give **900**.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 1600, `base` 600, `maxPointsPerSec` 120 and a duration of 5–75 s. The server accepts a run only if it passes every check below (`core/limits.ts` mirrors them):

- `score <= 1600`
- `5000 <= duration_ms <= 75000`
- `score * 1000 <= 600 * 1000 + 120 * duration_ms`, that is, `score <= 600 + 120 * t`

**Time up.** t = 60 s, so the cap is 600 + 7200 = 7800. The score is at most 900. ✓

**Win at time t.** The score is `1000 + 10 * floor(60 - t)`, which falls as t grows. The cap `600 + 120 t` rises. The two cross at t ≈ **7.67 s**: a win at 7.6 s (1520 points against a cap of 1512) would be rejected, and a win at 7.7 s (1520 against 1524) is accepted. So the level must make any win before about 7.7 s **physically impossible**. It does, with a margin of 1.49 s:

1. **Speed.** `stepRobot` never moves the robot more than `maxSpeed * dt` = 5 · dt in one step. After velocity, collision push-out and the wall clamp, it scales the step back if needed. The test drives 20,000 random steps with random dt and checks this.
2. **Clock.** Each frame, `RunClock` (`FRAME_PRIORITY.clock`, -1) counts the clamped frame delta into `elapsedMs` and records it as `frameMs`. `useRunFrame` (`FRAME_PRIORITY.simulation`, -0.5) then hands the game exactly that `frameMs` as dt. This includes the rest of the frame in which the countdown ends, which the core carries into `elapsedMs`. Pause stops both. So the robot's driving time is never more than `elapsedMs / 1000`. It is equal on a win, and on a time-up the last frame is counted but not driven. The test drives the real store (`createArcadeStore`) through `advanceRunClock` and `playedFrameDt`, the functions `RunClock` and `useRunFrame` use. It runs countdowns, pauses, resumes, restarts, wins and time-ups with frames from 4 to 300 ms, and checks that there are no untimed frames and that driving time ≤ `elapsedMs`. The simulated runs below use the same clock. The order (clock first) comes from the two priorities, and the test checks them.
3. **Distance.** To collect a battery, the robot's centre must come within R = 0.8 of it. A battery of wave w+1 does not exist until wave w is done, and at that moment the robot is within R of the battery it just took. With the spacing rules, the minimal route is:
   - Start to the first battery: ≥ 4 − 0.8 = 3.2.
   - Inside each wave: ≥ 5 − 1.6 = 3.4, five times, for 17.
   - Between waves: ≥ 8 − 1.6 = 6.4, four times, for 25.6.
   - Any route is therefore at least **45.8 units** long (`GUARANTEED_MIN_ROUTE`). Props only make it longer.
4. **Earliest win.** 45.8 / 5 = **9.16 s** (`fastestFinishMs`). The best possible score then is 1000 + 10 · 50 = **1500**. That is ≤ 1600 and ≤ 600 + 120 · 9.16 = 1699. Every later win scores less against a higher cap, so it passes too.
5. **Every seed.** `generateLayout` returns only layouts that pass `isValidLayout`, or the tested fallback. `isValidLayout` checks exactly the spacing used in step 3.

In practice the bound is far from tight. `shortestRoute(layout, PICKUP_REACH)`, the exact minimum over every collection order, is 65–80 units on real layouts, so the earliest win is about 13 s. The test's path-finding driver wins in 17–21 s (1380–1420 points). Expect top human scores around 1350–1450.

`capScore` still trims the final score to the server limit as a safety net. It rounds the duration exactly like GameShell does before submitting (`Math.round(elapsedMs)`), so its result always passes the server check. The tests check that it changes nothing for any reachable win. **The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.**

## Scene and camera

- The camera looks three-quarter top-down, tilted 56° (`PITCH` in `Scene.tsx`).
- `useFittedView` (core) finds the closest camera that keeps the whole warehouse, walls included, inside a safe screen area:
  - margins of 11% on top (room for the HUD), 7% at the bottom and 2% at the sides;
  - 8 px clear of the live HUD, the touch controls and the cookie banner from `useSafeArea()`.
- `shift: true` lets the fit move the picture on screen (a lens shift, `CameraRig shift`) instead of only moving the camera back. While the cookie banner is open, the warehouse moves up into the space between the HUD and the lifted joystick at full size, above the banner. When the banner opens or closes (detected within 1 s), the camera eases to the new fit.
- The fit tries two yaws and keeps the closer one. A landscape screen looks across the long side, and a portrait phone turns the camera 90° so that the 24-unit side runs up the screen. The yaw is picked once per screen size: the banner changes only the distance and the shift, never the yaw, so the controls keep their meaning mid-run.
- Fitted sizes (near edge of the floor, focus centred):
  - 375 × 812 portrait: 297 px wide. Its bottom edge is 221 px above the screen bottom; the joystick box ends at 160 px. With a 162 px banner: still 297 px, 361 px above the screen bottom (the lifted joystick box ends at 314 px).
  - 812 × 375 landscape: 512 px (63% of the width), moved right of the joystick. With an 83 px banner: 411 px, above the banner.
  - 915 × 412 landscape: 588 px. With an 83 px banner: 469 px.
  - 1280 × 800 desktop: 996 px.
- The camera follows the robot. `CameraRig` reads `run.robot` (`follow`) and looks 12% of the way from the floor centre (`LOOK_AT`) towards it (`followFraction`, `FOLLOW`), with damping 4. The view moves with the robot, but every battery stays on screen, because the fit's `focus` is `followFocus` of the same `LOOK_AT` and `FOLLOW` over the whole floor. The camera snaps into place when a run starts and eases into later changes of the fit.
- Frame order needs no care in this file. `useRunFrame` runs before `CameraRig` (`FRAME_PRIORITY.camera`) and every `useFrame` (core `FRAME_PRIORITY`), so the camera, `Robot` and `Batteries` always draw this frame's state, in any mount order.
- Looks only (`useFrame`, animated with `useGameTime()`):
  - The robot spins on a win. The stand-in (`RobotPrimitive`) bobs and leans with speed, its antenna wobbles, its chest meter glows brighter with every battery.
  - The robot GLB is a static T-pose; the core auto-rig (`core/rig`, `<HumanoidModel>`) gives it a skeleton in code. Its limbs follow a walk cycle whose amount eases to the speed (arms hanging and breathing when still, a walk, then a run with bent elbows and a short flight) and whose phase advances by the distance driven over the walk's own stride (`walkStride(amount, ROBOT_LANDMARKS)` × 1.4: about 1.1 m at a walk, 1.9 m at full speed, 2.7 strides a second), so the planted foot stays put. The body group carries the rise over the planted foot (`bodyLift` × 1.4; `applyLift={false}`), lowest at a walk's long stride, so the flat soles never sink into the floor; the walk leans its own spine (a whole-body lean about the feet would tip the soles into the floor). On a win both arms go up in a waving V while it spins and hops. `RobotPrimitive` (antenna, chest meter) is unchanged and still the fallback, with its old bob and lean (the scene sees it through a ref on its wrapper group). Looks only: rules, scoring and the camera are untouched.
  - Batteries pop in, bob and spin. They have a pulsing floor glow, a light beam (easy to spot on phones) and a ring flash on pickup.
  - A teal marker ring sits under the robot.
- No shadow maps. Each moving object gets a `BlobShadow` (core), and the static props have baked contact shadows in the floor texture (`useCanvasTexture`, core).
- Measured with primitives (production build, headless Chrome on a GTX 1660 Ti, 1280 × 800 and 375 × 812 / 812 × 375 touch emulation, with and without the banner): **28–29 draw calls**, 4.7k triangles, 2 textures, 60 fps. Walls, crates and barrels are instanced (`<Instanced>`, `<InstancedModel>`, core), so all crates are one draw call and all barrels four (side, lid, bottom, ridges). The battery meshes share geometries and materials.

## Assets

| Model | Source | Spec | Fallback until the GLB exists |
|---|---|---|---|
| robot | **shared** `models/3d/shared/robot.glb` (character, from concept art) | `assets/shared.spec.json` | Capsule body, round head, dark visor with two glowing eyes, wheels, antenna, chest meter |
| battery | **shared** `models/3d/shared/battery.glb` | `assets/shared.spec.json` | Emissive green cell, white label band, metal tip |
| crate | **shared** `models/3d/shared/crate.glb` | `assets/shared.spec.json` | Box with a canvas-drawn plank, frame and brace texture (instanced) |
| barrel | **this game** `models/3d/robot-collector/barrel.glb` | `./assets.spec.json` (universe `warehouse`, seed 5050, like the shared props) | Blue cylinder with two ridges and a lighter lid (instanced) |
| floor, walls, slab, start pad, glow, beams, rings | primitives in code | none | (always primitives) |

- The robot and the batteries are `<Model asset fallback={<RobotPrimitive/>}>`. The crates and barrels are `<InstancedModel asset spots fallback={<CrateBoxes/>}>` (core): instanced stand-ins now, and one `InstancedMesh` per GLB mesh once the GLB is listed. Dropping in a GLB needs no scene change and the draw calls do not grow with the number of props.
- A GLB is fetched only once its url is listed in `core/modelManifest.ts` (Claude's assets PR adds it with the file). Until then, the game makes **no `.glb` requests**.
- A GLB should face +z, stand on y = 0 and be about 1 unit tall. `scale`, `rotationY` and `yOffset` in `assets.ts` are adjusted in the assets PR.
- Collision never comes from a model. Footprints are fixed in `rules.ts` (`CRATE_SIZE` 1.2, `BARREL_RADIUS` 0.45, robot 0.5, battery 0.3).

## HUD

GameShell draws Score, Time (counting down from 1:00, highlighted under 10 s) and the `hudStats` entry **Batteries x/10** (`setStat("batteries", n)` on every pickup). The game has no custom HUD.

## Edge cases

- Pause (Esc, P, tab hidden, window blur) stops `useRunFrame`, the clock and `useGameTime()`. Visual animation freezes too.
- Pause and resume switch the R3F frameloop, and R3F resets `state.clock.elapsedTime` to 0 on every switch. Every animation therefore uses `useGameTime().now` (core), which restarts at 0 only when a new run mounts the Scene. A battery that popped in at t = 30 stays full size after a pause; the browser test checks this.
- The last battery and the end of the clock on the same frame: `RunClock` runs first and ends the run as `"timeup"`, so `useRunFrame` does not run and the battery is not collected (900). The result is deterministic, never a double end.
- On a win, `setScore` and `end("win")` run in the same callback, after the clock ticked for that frame, so `timeLeftMs` and `elapsedMs` match the submitted duration. `end()` is idempotent.
- Both batteries of a wave touched in one frame: impossible, since they are ≥ 5 apart. The next wave cannot be collected on the frame it appears: it is ≥ 8 away.
- Retry and restart remount the Scene (`key = runId`), which brings a new seed, robot, progress and game time. Nothing carries over.
- The cookie banner opening or closing mid-run refits the camera (distance and shift only), which eases to the new fit; the yaw and the controls stay as they are. Resizing or rotating the screen picks the yaw again, and the controls follow the new yaw at once.
- A missing GLB shows its primitive. A GLB that breaks while rendering falls back through `<Model>`'s error boundary.
- React strict mode (dev) double-creates the run state. That is harmless, because it lives in `useState`, not module scope.

## Test plan

`rules.test.ts` (vitest, about 3 s):

- **Layouts:**
  - deterministic per seed;
  - 1000 seeds plus 5 large ones are all valid;
  - the fallback is valid and unused;
  - `isValidLayout` rejects a missing battery, one too close to the start, one too close inside a wave and one too close across waves;
  - it also rejects a battery inside a crate in a layout that keeps every other rule (the same battery just in front of the crate is valid);
  - every spawn spot is reachable (flood fill);
  - `shortestRoute` equals brute force over all 32 collection orders.
- **Movement:**
  - reaches exactly top speed; diagonals are not faster;
  - starts from rest and brakes to a stop;
  - stops at crates and walls and slides along them;
  - 20,000 random steps never exceed top speed, never enter a prop and never leave the floor;
  - dt ≤ 0 is ignored; the robot turns to face where it goes.
- **Pickups:**
  - only the current wave counts;
  - the next wave arrives after both are collected;
  - the run is complete at 10 and nothing more is collected.
- **Scoring:**
  - battery points and the time bonus (full seconds only);
  - `withinServerLimits` and `capScore` with this game's limits.
- **Proof:**
  - the real store, driven with `advanceRunClock` and `playedFrameDt`, has no untimed frames, and driving time ≤ `elapsedMs` across countdowns that end mid-frame;
  - break-even ≈ 7.67 s;
  - `GUARANTEED_MIN_ROUTE` is 45.8, so the earliest win is 9.16 s;
  - every win from then to 60 s passes the limits, and `capScore` is a no-op;
  - every time-up score passes;
  - every seeded layout's own minimum completion passes;
  - simulated runs on the real store clock (60 fps and an uneven 73 fps) with a path-finding driver win, never beat the bound and pass the limits;
  - an idle robot times out with 0 at exactly 60000 ms.

The generic parts are tested in `core/`: clock carry-over, game time and frame order (`frameLoop.test.ts`, `useArcadeStore.test.ts`), the fit math, the lens shift and the follow range (`view.test.ts`), the yaw lock (`useFittedView.test.ts`), the manifest skip and instanced props (`modelManifest.test.ts`, `assets.test.ts`), `inputToWorld`, the RNG and the limits (`math.test.ts`).

Browser (production build with the flags on and the API mock, headless Chrome over CDP, network log on):

- **Steps:**
  - start screen, countdown (the camera does not move);
  - 3 batteries;
  - with the banner open: Accept it mid-run (the yaw must not change, the floor stays clear of the lowered joystick, the robot still drives);
  - a 2.5 s pause mid-run (the clock must not move, and the batteries on the floor must still be full size after resume);
  - all 10 collected, win screen;
  - then Retry, 3 collected, time up.
- **Screens:**
  - desktop 1280 × 800 with the keyboard;
  - 375 × 812 with touch emulation and the joystick, with and without the cookie banner;
  - 812 × 375 with and without the banner (the floor stays out of the lifted joystick's box and above the banner).
- **Checks:**
  - the score equals the formula for the store's `elapsedMs`, and the local best stores the rounded duration (for example, 1340 at 25.19 s on desktop and 1360 at 23.70 s on the portrait phone);
  - a time-up run is 300 for 3 batteries at exactly 1:00.00;
  - no `.glb` requests;
  - draw calls and fps as listed above.

## Known issues and core gaps

- The cookie banner is detected by a 1 s poll (core `useBottomObstruction`), so the camera eases to its new fit up to a second after the banner opens or closes.
- Core gaps: none open.
