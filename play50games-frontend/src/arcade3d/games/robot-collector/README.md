# Robot Collector

Owner: Claude. Slug: `robot-collector`. Game 1 of the 3D Arcade and the **reference game**: copy this folder's structure, file split and this README's sections for every other game. Status stays `"soon"` until Release 1 (it goes live together with the leaderboard).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, assets, timer, camera, HUD stats, instructions. |
| `rules.ts` | Everything that decides the outcome: map, seeded layouts, movement, pickups, scoring. Pure, no three.js/React/DOM/`Math.random`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the scoring-limit proof below. |
| `Scene.tsx` | The frame loop and the moving things: feeds input + dt into `rules.ts`, draws the result, reports to the store. |
| `Primitives.tsx` | Warehouse-only look: floor, walls, crates, barrels, the stand-in robot and battery. |
| `camera.ts` | Fits the follow camera to the screen (HUD on top, joystick bottom left). |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for models only this game generates. |

### What a new game copies from here

- **Copy:** the file split above; `meta.ts` and `index.tsx` as they are; `rules.ts` as pure functions with a seed, plus tests that prove the scoring limits; and from `Scene.tsx`: the run state made once in `useState` (no setState in the loop), a `<Simulation>` component rendered **first** that runs `useRunFrame` → `rules.ts` → store calls (`addScore`, `setStat`, `end`), visuals that only read that state in `useFrame` and animate with `run.time`, and `useModel(asset).failed` → primitive, else `<Model asset>`.
- **Do not copy:** `Primitives.tsx` (canvas-drawn textures, warehouse props, the robot and battery stand-ins) and the battery pop, beam and ring effects. They are decoration for this game.
- **Copy only until the core has them:** `useInstanceMatrices`, `useCanvasTexture`, `BlobShadow` (in `Primitives.tsx`) and `fitView` (`camera.ts`). They are game-independent and listed under "Known issues and core gaps" for the core to adopt. Copy the one you need; never import it from this folder (games do not import from each other).

## Concept

A small teal robot drives around a compact warehouse (a 24 × 16 floor with walls, crates and barrels) and collects 10 glowing batteries before a 60-second clock runs out. The batteries light up two at a time. When both are collected, the next pair pops up somewhere else. The game is about choosing the order and steering cleanly around the props. The look is the Play50 vinyl-toy style with accent `#7dd3fc`.

## Controls

Matches `meta.ts` (`scheme: "joystick"`).

- Keyboard: WASD or the arrow keys. Diagonals are not faster. Esc or P pauses (GameShell).
- Touch: the virtual joystick (bottom left). It is analog, so a small push drives slowly.
- Controls are **screen-relative**: up always means "away from the camera", even when a portrait phone turns the camera 90° (`inputToWorld` in `rules.ts`).
- Movement (`ROBOT` in `rules.ts`): top speed 5 units/s, acceleration 24 u/s², braking 30 u/s². The robot turns to face where it is going (`turnRate` 14/s, eased).

## Rules

- The run lasts 60 s of unpaused play (`durationMs: 60000`). GameShell runs the 3-2-1 countdown and the clock.
- 10 batteries come in 5 waves of 2 (`WAVE_SIZE`). Only the current wave is on the floor. When its second battery is collected, the next wave appears at once with a short pop-in.
- A battery is collected when the robot's circle (r = 0.5) touches the battery's circle (r = 0.3): the centres are within `PICKUP_REACH` = 0.8.
- The robot collides with the walls and with every crate and barrel (circle vs AABB, `core/collision.ts`). Barrels collide as squares, which shows as a gap of under 0.2 at their corners.
- All 10 collected: the run ends with `end("win")`. The clock reaches 0: GameShell ends it with `"timeup"`.
- Every run gets a new layout. Scene draws a random 32-bit seed and `generateLayout(seed)` turns it into 10 battery spots, so the same seed always gives the same layout. A layout must pass `isValidLayout`:
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

The final score is `runScore(collected, won, timeLeftMs)`. The duration GameShell submits is `elapsedMs`, the store's default, so `finalScore` is not overridden. Examples: a win at 21.6 s gives 1000 + 380 = **1380**; 9 batteries at time-up give **900**.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 1600, `base` 600, `maxPointsPerSec` 120, duration 5–75 s. The server accepts a run only if it passes every check below:

- `score <= 1600`
- `5000 <= duration_ms <= 75000`
- `score * 1000 <= 600 * 1000 + 120 * duration_ms`, that is, `score <= 600 + 120 * t`

**Time up.** t = 60 s, so the cap is 600 + 7200 = 7800. The score is at most 900. ✓

**Win at time t.** The score is `1000 + 10 * floor(60 - t)`, which falls as t grows. The cap `600 + 120 t` rises. The two cross at t ≈ **7.67 s**: a win at 7.6 s (1520 points against a cap of 1512) would be rejected, and a win at 7.7 s (1520 against 1524) is accepted. So the level must make any win before about 7.7 s **physically impossible**. It does, with a margin of 1.4 s:

1. **Speed.** `stepRobot` never moves the robot more than `maxSpeed * dt` = 5 · dt in one step. After velocity, collision push-out and the wall clamp, it scales the step back if needed. The test drives 20,000 random steps with random dt and checks this.
2. **Clock.** `RunClock` (priority -1) and `useRunFrame` (priority 0) both use `clampFrameDt(delta)` of the same frame. The clock counts every moving frame except one: the frame where the countdown turns into "playing" (≤ `MAX_FRAME_DT` = 0.05 s; see Known issues). Pause stops both. So the robot's driving time is at most `elapsedMs / 1000 + 0.05`. The test drives the real store (`createArcadeStore`) frame by frame the way `ShellStage` does, through countdowns, pauses, resumes, restarts, wins and time-ups with frames up to 300 ms, and checks exactly this: one untimed frame per run, at most 0.05 s. The frame order itself (clock before game) comes from the priorities in `core/ShellStage.tsx`, which the test cannot see.
3. **Distance.** To collect a battery, the robot's centre must come within R = 0.8 of it. A battery of wave w+1 does not exist until wave w is done, and at that moment the robot is within R of the battery it just took. With the spacing rules, the minimal route is:
   - Start to the first battery: ≥ 4 − 0.8 = 3.2.
   - Inside each wave: ≥ 5 − 1.6 = 3.4, five times, for 17.
   - Between waves: ≥ 8 − 1.6 = 6.4, four times, for 25.6.
   - Any route is therefore at least **45.8 units** long (`GUARANTEED_MIN_ROUTE`). Props only make it longer.
4. **Earliest win.** 45.8 / 5 − 0.05 = **9.11 s** (`fastestFinishMs`). The best possible score then is 1000 + 10 · 50 = **1500**. That is ≤ 1600 and ≤ 600 + 120 · 9.11 = 1693. Every later win scores less against a higher cap, so it passes too.
5. **Every seed.** `generateLayout` returns only layouts that pass `isValidLayout`, or the tested fallback. `isValidLayout` checks exactly the spacing used in step 3.

In practice the bound is far from tight. `shortestRoute(layout, PICKUP_REACH)`, the exact minimum over every collection order, is 65–80 units on real layouts, so the earliest win is about 13 s. The test's path-finding driver wins in 17–21 s (1380–1420 points). Expect top human scores around 1350–1450.

`capScore` still trims the final score to the server limit as a safety net. It rounds the duration exactly like GameShell does before submitting (`Math.round(elapsedMs)`), so its result always passes the server check. The tests check that it changes nothing for any reachable win. **The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.**

## Scene and camera

- The camera looks three-quarter top-down, tilted 56° (`PITCH`). `fitView` (`camera.ts`) finds the closest camera that keeps the whole warehouse, walls included, inside a safe screen area: below the HUD, and on touch screens out of the joystick's box. The joystick has a fixed size in px, so its box is checked in px, not as a share of the screen: 132 px joystick + 20 px gap (`core/TouchControls.module.css`) + 8 px of air, plus the safe-area insets (notch, home bar). The fit tries two yaws and keeps the closer one. A landscape screen looks across the long side, and a portrait phone turns the camera 90° so the 24-unit side runs up the screen.
- Fitted sizes (near edge of the floor, focus centred): 375 × 812 portrait about 300 px wide, its bottom edge 221 px above the screen bottom (the joystick box ends at 160 px); 812 × 375 landscape 403 px, 50% of the width (340 px when the joystick was treated as the bottom 20% of the screen); 915 × 412 landscape 484 px; 1280 × 800 desktop 996 px.
- The camera follows the robot: `CameraRig` follows a focus point placed 12% of the way from the floor centre to the robot (`FOLLOW`), with damping 4. The view moves with the robot, but every battery stays on screen. The fit already allows for the focus moving.
- Frame order: `<Simulation>` is the Scene's first child, so its `useRunFrame` step and the camera focus update run before `CameraRig`, `Robot` and `Batteries` in every frame. **The simulation component must be rendered before any component that draws its state.** R3F runs same-priority `useFrame` callbacks in mount order, and children mount before their parent, so a step in `Scene` itself would run after all of them and every visual would show the previous frame.
- Looks only (`useFrame`): the robot bobs and leans with speed, its antenna wobbles, its chest meter glows brighter with every battery, and it spins on a win. Batteries pop in, bob and spin, and have a pulsing floor glow, a light beam (easy to spot on phones) and a ring flash on pickup. There is a teal marker ring under the robot.
- No shadow maps. Each moving object gets a blob shadow, and the static props have baked contact shadows in the floor texture.
- Measured with primitives: **28–36 draw calls**, about 5k triangles, 2 textures, 60 fps (desktop GTX 1660 Ti, 1280 × 800, and 375 × 812 touch emulation). Crates and barrels are `InstancedMesh`es, so all crates are one draw call and all barrels four (side, lid, bottom, ridges). The battery meshes share geometries and materials.

## Assets

| Model | Source | Spec | Fallback until the GLB exists |
|---|---|---|---|
| robot | **shared** `models/3d/shared/robot.glb` (character, from concept art) | `assets/shared.spec.json` | Capsule body, round head, dark visor with two glowing eyes, wheels, antenna, chest meter |
| battery | **shared** `models/3d/shared/battery.glb` | `assets/shared.spec.json` | Emissive green cell, white label band, metal tip |
| crate | **shared** `models/3d/shared/crate.glb` | `assets/shared.spec.json` | Box with a canvas-drawn plank, frame and brace texture (instanced) |
| barrel | **this game** `models/3d/robot-collector/barrel.glb` | `./assets.spec.json` (universe `warehouse`, seed 5050, like the shared props) | Blue cylinder with two ridges and a lighter lid (instanced) |
| floor, walls, slab, start pad, glow, beams, rings | primitives in code | none | (always primitives) |

- `Scene.tsx` (robot, batteries) and `Primitives.tsx` (crates, barrels) ask `useModel(asset).failed` and draw either the primitive or `<Model asset>`. Dropping in a GLB needs no scene change.
- A GLB should face +z, stand on y = 0 and be about 1 unit tall. `scale`, `rotationY` and `yOffset` in `assets.ts` are adjusted in the assets PR.
- Collision never comes from a model. Footprints are fixed in `rules.ts` (`CRATE_SIZE` 1.2, `BARREL_RADIUS` 0.45, robot 0.5, battery 0.3).

## HUD

GameShell draws Score, Time (counting down from 1:00, highlighted under 10 s) and `hudStats` **Batteries x/10** (`setStat("batteries", n)` on every pickup). The game has no custom HUD.

## Edge cases

- Pause (Esc, P, tab hidden, window blur) stops `useRunFrame` and the clock. Visual animation freezes too, because the canvas only redraws on demand while paused.
- Pause and resume switch the R3F frameloop, and R3F resets `state.clock.elapsedTime` to 0 on every switch. **Never store `state.clock.elapsedTime` values across frames**: a battery that popped in at t = 30 would stay invisible until the restarted clock reached 30 again. Visuals use `run.time` instead, a per-run animation clock that `Simulation` advances by the frame delta (at most 0.1 s per frame).
- The last battery and the end of the clock on the same frame: `RunClock` runs first and ends the run as `"timeup"`, so the battery is not collected (900). The result is deterministic, never a double end.
- On a win, `setScore` and `end("win")` run in the same callback, after the clock ticked for that frame, so `timeLeftMs` and `elapsedMs` match the submitted duration. `end()` is idempotent.
- Both batteries of a wave touched in one frame: impossible, since they are ≥ 5 apart. The next wave cannot be collected on the frame it appears: it is ≥ 8 away.
- Retry and restart remount the Scene (`key = runId`), which brings a new seed, robot and progress. Nothing carries over.
- Resizing or rotating mid-run refits the camera. The yaw may flip between landscape and portrait, and the controls follow the new yaw at once.
- A missing GLB shows its primitive. A GLB that breaks while rendering falls back through `<Model>`'s error boundary.
- React strict mode (dev) double-creates the run state. That is harmless: it lives in `useState`, not module scope.

## Test plan

`rules.test.ts` (vitest, about 3 s):

- Layouts: deterministic per seed; 1000 seeds plus 5 large ones are all valid; the fallback is valid and unused; `isValidLayout` rejects a missing battery, one too close to the start, one too close inside a wave and one too close across waves, and a battery inside a crate in a layout that keeps every other rule (the same battery just in front of the crate is valid); every spawn spot is reachable (flood fill); `shortestRoute` equals brute force over all 32 collection orders.
- Movement: reaches exactly top speed; diagonals are not faster; starts from rest and brakes to a stop; stops at crates and walls and slides along them; 20,000 random steps never exceed top speed, never enter a prop and never leave the floor; dt ≤ 0 is ignored; turning takes the short way; screen-to-world mapping holds for both yaws.
- Pickups: only the current wave counts; the next wave arrives after both; the run is complete at 10 and nothing more is collected.
- Scoring: battery points and the time bonus (full seconds only); `withinServerLimits` matches the server formula; `capScore`, including a fractional duration that rounds down (7608.49 ms).
- Proof: the real store, driven like `ShellStage`, has exactly one untimed frame per run, at most `MAX_FRAME_DT`; break-even ≈ 7.67 s; `GUARANTEED_MIN_ROUTE` is 45.8, so the earliest win is 9.11 s; every win from then to 60 s passes the limits and `capScore` is a no-op; every time-up score passes; every seeded layout's own minimum completion passes; simulated 60 fps runs with a path-finding driver win, never beat the bound and pass the limits; an idle robot times out with 0.

Browser (production build, flags on with the API mock, headless Chrome over CDP):

- Steps: start screen, countdown, pause and resume, 3 batteries, a 2.5 s pause mid-run (the batteries on the floor must still be full size after resume), all 10 collected, win screen; then Retry, 3 collected, time up.
- Desktop 1280 × 800 with the keyboard; 375 × 812 and 812 × 375 with touch emulation and the joystick (the floor stays out of the joystick box in landscape).
- Checks: the score equals the formula for the submitted duration (for example, 1400 at 19.66 s on desktop, 1340 at 25.14 s on the portrait phone, 1330 at 26.83 s in landscape); a time-up run is 300 for 3 batteries at 1:00.00; draw calls and fps as listed above.

## Known issues and core gaps

- `<Model>` has no `fallback` prop, so the game asks `useModel(asset).failed` and draws its own primitive. That extra `useModel` call also clones the GLB once for nothing.
- `CameraRig` follows its target 1:1 and has no bounds. The game passes it a focus proxy (a group moved part of the way towards the robot). When its config changes (resize), it jumps to `config.position` and then eases back. Core candidate: a CameraRig option that fits a box into the free screen area (what `fitView` in `camera.ts` does), and a follow fraction.
- The core does not say where the touch controls are. `camera.ts` copies the joystick size from `core/TouchControls.module.css` and reads the safe-area insets with a hidden probe element. A core hook that returns the controls' screen rect, updated live, would replace both and would also fix the cookie banner case below.
- R3F resets `state.clock.elapsedTime` whenever GameShell switches the frameloop (pause, resume). Every game needs a pause-safe animation clock; this one keeps `run.time`. Core candidate: such a clock from the core.
- Frame order depends on mount order (see "Scene and camera"). Core candidate: `useRunFrame` subscribing at a priority between `RunClock` (-1) and 0, for example -0.5, so the simulation runs before the visuals wherever it is mounted. Negative priorities keep R3F's automatic rendering; positive ones turn it off.
- Game-independent helpers each game would otherwise copy: `useInstanceMatrices` (a static `InstancedMesh` from a list of spots), `useCanvasTexture` (a CanvasTexture drawn once and disposed), `BlobShadow` (all in `Primitives.tsx`) and `fitView` (`camera.ts`). Candidates for `core/`.
- Input is screen-relative only. A game whose camera is not looking along -z has to convert it itself (`inputToWorld`).
- The core does not time the frame where the countdown turns into "playing": `useRunFrame` moves the robot, but `tick` adds nothing to `elapsedMs`. That frame is at most 50 ms, and the proof allows for it (`UNTIMED_MOVE_S`). A core fix would carry the rest of the countdown frame into `elapsedMs`.
- `useCoarsePointer` lives in `core/TouchControls.tsx`. The game imports it from there to know whether the joystick is shown. While the cookie banner is open, the joystick moves up and can overlap the lower part of the floor (the fit does not track the banner).
- Until the GLBs exist, each game load requests 4 missing `.glb` files (404s, then the primitives show).
