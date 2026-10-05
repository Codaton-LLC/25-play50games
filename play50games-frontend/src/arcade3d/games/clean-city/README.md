# Clean the City

Owner: Cursor. Slug: `clean-city`. Game 8 of the 3D Arcade. Status stays `"soon"` until the game itself is built. This file is the design. No scene or rules code yet. `meta.ts` and the `index.tsx` stub already exist and are not part of this prep.

The mechanic is the robot-collector one: walk, touch an item, it is collected. Movement, the speed guard, circle-vs-AABB collision and the camera fit are copied from that game. This folder does not import it.

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. Already on `main`. Do not change the limits. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, assets, `durationMs: 240000`, camera, `hudStats`, instructions. Stub today. |
| `rules.ts` | Map configs, seeded litter, movement, pickups, scoring. Pure, no three.js/React/DOM/`Math.random`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the scoring-limit proof below. |
| `Scene.tsx` | The frame loop: input + dt into `rules.ts`, draws the result, reports to the store. Draws the run seed once on mount. |
| `Primitives.tsx` | Park, city and beach look: ground, paths, buildings, benches, bins, lamps, palms, umbrellas, and the stand-in runner and litter. |
| `camera.ts` | Fits the follow camera to the screen (HUD on top, joystick bottom left). |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the two props only this game generates. |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split; `rules.ts` as pure functions with a seed and a speed guard; from `Scene.tsx`, the run state made once in `useState` (no setState in the loop), a `<Simulation>` component rendered **first** that runs `useRunFrame` → `rules.ts` → store calls (`addScore`, `setStat`, `end`), visuals that only read that state in `useFrame` and animate with `run.time`, and `useModel(asset).failed` → primitive, else `<Model asset>`. Copy `fitView` only until the core has it. Games do not import each other.
- **This game adds one pattern:** three maps in a single run, chosen from config (same rules, different ground and obstacles). A later multi-map game can copy that pattern. It still does not import this folder.
- **Do not copy:** the park, city and beach primitives, or the litter pop. They are decoration for this game.

## Concept

The Play50 runner walks three outdoor maps in one run: a park, a city block and a beach. Each map has 20 pieces of litter. Collect all 20 and the next map loads. Collect all 60 before the clock runs out and the run is a win. The clock is one 240 s timer for the whole run, not a timer per map. Faster clears earn a time bonus. The look is the Play50 vinyl-toy style with accent `#4ade80`.

## Controls

Matches `meta.ts` (`scheme: "joystick"`).

- Keyboard: WASD or the arrow keys. Diagonals are not faster. Esc or P pauses (GameShell).
- Touch: the virtual joystick (bottom left). It is analog, so a small push walks slowly.
- Controls are **screen-relative**: up always means "away from the camera", even when a portrait phone turns the camera 90° (`inputToWorld` in `rules.ts`, same rule as robot-collector).
- Movement (`RUNNER` in `rules.ts`), the same shape as robot-collector's `ROBOT`: top speed 5 units/s, acceleration 24 u/s², braking 30 u/s². The runner turns to face where it is going (`turnRate` 14/s, eased).

## Constants

| Name | Value |
|---|---|
| Walk speed | 5 units/s |
| Acceleration / braking | 24 u/s² / 30 u/s² |
| Turn rate | 14 /s |
| Runner radius | 0.5 |
| Litter radius | 0.3 |
| Pickup reach | 0.8 (the two radii) |
| Pair spacing | 5.4 between any two litter centres on the same map |
| Start spacing | 4.0 from the start pad to every litter centre |
| Prop spacing | 1.0 from a litter centre to any obstacle |
| Floor | 28 × 28 (centre box \|x\| ≤ 14, \|z\| ≤ 14) |
| Start pad | `(0, -12)` on every map |
| Items | 20 per map, 3 maps, 60 in the run |
| Clock | 240 s (`durationMs: 240000`) |

`stepRunner` never moves the runner more than `5 * dt` in one step. After velocity, collision push-out and the wall clamp, it scales the step back if needed. The same guard is what the proof relies on.

## Rules

- The run lasts 240 s of unpaused play. GameShell runs the 3-2-1 countdown and the clock. The clock and the walker both advance by the simulation frame dt. Nothing reads the wall clock, and nothing stores `state.clock.elapsedTime`.
- Three maps, in order: `park`, `city`, `beach`. The configs differ in ground colour, paths and obstacles. The litter rules are the same.
- All 20 pieces on the current map are on the ground from the moment that map loads. The next map's pieces do not exist yet.
- A piece is collected when the runner's circle (r = 0.5) touches the litter's circle (r = 0.3): the centres are within 0.8.
- The runner collides with the boundary and with every obstacle (circle vs AABB, or circle vs circle, `core/collision.ts`). Paths are painted on the ground and do not collide.
- Map clear: the 20th pickup ends the map. The runner is placed on the next map's start pad with zero velocity. Pickups are not tested again on that frame. Map 3's 20th pickup ends the run with `end("win")`.
- The clock reaches 0: GameShell ends the run with `"timeup"`.
- Every run gets a new layout. Scene draws one random 32-bit seed on mount (`useState`, so strict mode does not draw two). `rules.ts` derives three layout seeds from it and builds each map with `generateLayout(seed, mapId)`. The same run seed always gives the same three layouts.
- A layout must pass `isValidLayout`:
  - Litter sits on a 0.5-unit grid inside the floor, at least 1.0 from any obstacle and at least 4.0 from the start pad. Any two centres on that map are at least 5.4 apart. The test flood-fills the map and checks that every spot is reachable from the start pad.
  - Obstacles are fixed by the map config, not by the seed. They leave corridors at least 2.2 wide (the runner is 1.0 across).
  - If 40 attempts cannot produce a valid layout, `FALLBACK_SPOTS` for that map is used. The fallback passes the same checks.
- Kinds, five of each, shuffled by the layout seed: bottle, paper bag, tin can, banana.

### Obstacles per map

All of these are code primitives. Footprints are the collision sizes.

| Map | Obstacles |
|---|---|
| park | 3 benches, AABB 2.4 × 0.8. 2 trees, circle r = 0.7. 1 bin, square 0.7. |
| city | 4 buildings, AABB 3.2 × 3.2. 4 lamps, circle r = 0.3. 2 bins, square 0.7. |
| beach | 4 palm trunks, circle r = 0.6. 3 umbrella poles, circle r = 0.25 (the canopy is visual and does not collide). 1 bin, square 0.7. |

## Scoring

| Event | Points |
|---|---|
| Litter | +50 (`addScore`, live in the HUD). 60 pieces = 3000. |
| Win (all 3 maps) | + 10 per **full** second left: `10 * floor(timeLeftMs / 1000)` |
| Time up | no bonus: `50 * collected` (at most 59 pieces, 2950) |

The final score is `runScore(collected, won, timeLeftMs)`. The duration GameShell submits is `elapsedMs`, the store's default, so `finalScore` is not overridden. Examples: a win at 45.19 s leaves 194 full seconds, so 3000 + 1940 = **4940**. A win at 90 s leaves 150 s, so 3000 + 1500 = **4500**. 40 pieces at time-up score **2000**.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 6000, `base` 1000, `maxPointsPerSec` 100, duration 10–900 s. The server accepts a run only if it passes every check below:

- `score <= 6000`
- `10000 <= duration_ms <= 900000`
- `score * 1000 <= 1000 * 1000 + 100 * duration_ms`, that is, `score <= 1000 + 100 * t`

**Max score, any play.** A win's bonus is at most `10 * 240 = 2400` (the whole clock still on the board), so the score is at most 3000 + 2400 = **5400**. A time-up is at most 2950. Both are ≤ 6000. ✓

**Time up.** t = 240 s, so the rate cap is 1000 + 24000 = 25000. The score is at most 2950. The submitted duration is 240000 ms, inside 10–900 s. ✓

**Win at time t.** The score is `3000 + 10 * floor(240 - t)`. It falls as t grows. The cap `1000 + 100 t` rises. They meet at **t = 40 s**: 3000 + 10 × 200 = 5000 against a cap of 5000. A win at 39.9 s is still in that bonus bucket (5000 points) against a cap of 4990, and the server would reject it. So any win before 40 s has to be **physically impossible**. It is, with 5.19 s to spare:

1. **Speed.** `stepRunner` never moves the runner more than `maxSpeed * dt` = 5 · dt in one step. The test drives 20,000 random steps with random dt and checks this.
2. **Clock.** One run has one countdown. `RunClock` (priority -1) and `useRunFrame` (priority 0) both use `clampFrameDt(delta)` of the same frame. The clock misses only the frame where the countdown turns into "playing" (≤ `MAX_FRAME_DT` = 0.05 s). Pause stops both. Map changes happen while the run is already playing, so that frame is timed. Driving time is at most `elapsedMs / 1000 + 0.05`.
3. **Distance.** To collect a piece, the runner's centre must come within R = 0.8 of it. With the spacing rules, and the runner put back on the start pad when a map loads (it does not walk between maps), the minimal route is:
   - Start pad to the first piece of a map: ≥ 4.0 − 0.8 = 3.2.
   - Between two pieces: ≥ 5.4 − 1.6 = 3.8. Nineteen of those is 72.2.
   - One map is at least 3.2 + 72.2 = **75.4** units. Three maps are at least **226.2** units (`GUARANTEED_MIN_ROUTE`). Obstacles only make it longer. Two pieces 5.4 apart cannot be touched from one spot, because 5.4 > 1.6.
4. **Earliest win.** 226.2 / 5 − 0.05 = **45.19 s** (`fastestFinishMs` = 45190). Time left is 240000 − 45190 = 194810 ms, which is 194 full seconds. The best possible score is 3000 + 10 × 194 = **4940**. That is ≤ 6000 and ≤ 1000 + 100 × 45.19 = 5519 (579 points of room, 5.19 s past the 40 s line). The integer check is `4940 * 1000 = 4,940,000 <= 1,000,000 + 100 * 45190 = 5,519,000`. Every later win scores less against a higher cap.
5. **Any earlier pickup.** For k < 60 there is no time bonus, so the score is `50 * k`. The earliest moment k pieces can have been collected uses the same legs, and the rate cap is above that score. The tightest of those is the first piece: route 3.2, t = 0.59 s, score 50 against a cap of 1059. The win in step 4 is the tight case. A submitted run is only a win or a time-up (quit does not submit), and both are inside the duration window: a win is at least 45190 ms, a time-up is 240000 ms.
6. **Every seed.** `generateLayout` returns only layouts that pass `isValidLayout`, or the tested fallback. `isValidLayout` checks exactly the spacing used in step 3.

`capScore` still trims the final score to the server limit as a safety net. It rounds the duration the way GameShell does before submitting (`Math.round(elapsedMs)`). The tests check that it changes nothing for any reachable win or time-up. **The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.**

### Why 240 s

The shortest legal clear is 45.19 s of straight lines. A real seed walks around benches and buildings, so a clean run is longer than that, on the order of a minute or more. 240 s is 80 s a map: enough to cross the 28-unit floor several times while looking for the last piece, and short enough that the bonus still matters (a 90 s clear is 4500, a 3-minute clear is 3600, and timing out scores at most 2950). 240 s sits inside the 900 s maximum. A per-map clock would reset the bonus and break the single duration the server checks, so the timer is one clock for all three maps.

## Scene and camera

- The camera looks three-quarter top-down, tilted 56° (`PITCH`), and follows a focus point 12% of the way from the floor centre to the runner (`FOLLOW`), with damping 4. Same approach as robot-collector's `camera.ts`. Copy it. Do not import it.
- `fitView` keeps the whole 28 × 28 floor, boundary included, inside a safe screen area: below the HUD, and on touch screens out of the joystick's box. The joystick is checked in px, not as a share of the screen: 132 px joystick + 20 px gap + 8 px of air, plus the safe-area insets. The fit tries yaw 0 and yaw 90° and keeps the closer camera. The floor is square, so both yaws frame the same footprint. Portrait still turns the view when that yaw sits further above the joystick.
- Acceptance, not a guessed pixel size: at 375 × 812 and at 812 × 375 the projected floor lies inside that safe area, and its bottom edge is above the joystick box (the box ends 160 px from the bottom, plus insets). Resizing or rotating refits. The controls follow the new yaw at once.
- Frame order: `<Simulation>` is the Scene's first child, so its `useRunFrame` step runs before the camera and the meshes. Visuals use `run.time`, advanced by the frame delta (at most 0.1 s), never `state.clock.elapsedTime`.
- No shadow maps. Moving things get a blob shadow. Litter and repeated props are instanced.
- Draw-call budget is the arcade one: ≤ 150, with 60 fps as the target. Instancing litter, benches, trees and buildings is how this stays near the reference game's range. Measure it when the scene exists. Do not treat a guess as a measurement.

## Assets

| Model | Source | Spec | Fallback until the GLB exists |
|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` | `assets/shared.spec.json` | Capsule body, hoodie, headband. Not in this spec. |
| bottle | **this game** | `./assets.spec.json` | Green crushed bottle |
| paper bag | **this game** | `./assets.spec.json` | Brown crumpled bag |
| tin can | **shared** | `assets/shared.spec.json` | Crushed can. Not in this spec. |
| banana | **shared** | `assets/shared.spec.json` | Yellow banana. Not in this spec. |
| ground, paths, benches, bins, lamps, buildings, palms, umbrellas, start pad | primitives in code | none | (always primitives) |

Generate only the bottle and the paper bag (universe `city`, seed 5158). They are the two litter shapes that are not already in the shared set. The runner, the tin can and the banana are reused, so they are not listed in this spec.

Bench, bin, lamp, building, palm and umbrella stay primitives. At this camera they read as a box, a cylinder, a pole, a block, a trunk with a sphere, and a cone on a pole. They are scenery, not pickups, and generating them would spend credits on meshes the rules never need. The beach still reads as a beach from the sand tint, the palm blobs and the umbrella cones.

- Five of each litter kind on every map. Swapping a GLB is an `assets.ts` change, not a scene change.
- A GLB should face +z, stand on y = 0 and be about 1 unit tall for the runner, and about 0.4 for a piece of litter. `scale`, `rotationY` and `yOffset` are adjusted in the assets PR.
- Collision never comes from a model. Footprints are the constants above.

## HUD

GameShell draws Score, Time (counting down from 4:00) and `hudStats`:

- `[{ key: "items", label: "Litter", max: 20 }, { key: "map", label: "Map", max: 3 }]`

`setStat("items", n)` on every pickup, reset to 0 when the next map loads. `setStat("map", 1 | 2 | 3)` when that map loads. The game has no custom HUD. The shell already shows score, time and these two stats.

## Edge cases

- Pause (Esc, P, tab hidden, window blur) stops `useRunFrame` and the clock. Visual animation freezes too, because it is driven by `run.time`.
- Pause and resume reset R3F's `state.clock.elapsedTime`. Visuals never read it. `run.time` only moves by the frame delta.
- Map transition and the 20th pickup are the same frame: score the pickup, swap the map, park the runner on the new start pad, and do not collect anything else that frame. The nearest new piece is at least 3.2 away, and one frame moves at most 5 × 0.05 = 0.25, so it cannot be reached on the next frame either without walking.
- The 20th piece of map 3 and the end of the clock on the same frame: `RunClock` runs first and ends the run as `"timeup"`, so that piece is not collected (at most 2950). `end()` is idempotent.
- On a win, `setScore` and `end("win")` run in the same callback, after the clock ticked for that frame, so `timeLeftMs` and `elapsedMs` match the submitted duration.
- Retry and restart remount the Scene (`key = runId`), which draws a new seed and clears the map index, the litter and the score. Nothing carries over.
- A missing GLB shows its primitive.

## Test plan

`rules.test.ts` (vitest):

- Layouts: deterministic per run seed and map id; 1000 seeds are valid on all three maps or use the fallback; the fallback is valid; `isValidLayout` rejects a pair closer than 5.4, a piece closer than 4.0 to the start, a piece inside an obstacle, and an unreachable spot; every accepted spot is reachable (flood fill).
- Movement: reaches exactly top speed; diagonals are not faster; brakes to a stop; stops at a building and a bench and slides along them; 20,000 random steps never exceed 5 · dt, never enter an obstacle and never leave the floor.
- Pickups: only the current map's 20 count; the 20th loads the next map and does not collect on that frame; map 3's 20th completes the run; nothing is collected twice.
- Scoring: 50 per piece; the time bonus uses full seconds only; a 90 s win is 4500; time-up with 40 pieces is 2000; `withinServerLimits` matches the server formula; `capScore` is a no-op on reachable results.
- Proof: `GUARANTEED_MIN_ROUTE` is 226.2 and the earliest win is 45190 ms; the 40 s line is the break-even (5000 against 5000, and 39.9 s fails); every win from 45.19 s to 240 s passes both limits; every time-up score passes; every seeded layout's own minimum completion is at least 45190 ms and passes; an idle runner times out with 0.

Browser (when the scene exists; production build, flags on with the API mock):

- Steps: start, countdown, pause and resume, clear map 1, confirm map 2 loaded with Litter at 0 and Map at 2, pause 2 s on map 2 (litter still full size after resume), then time-up. A second run clears all three maps and wins.
- Desktop 1280 × 800 with the keyboard. 375 × 812 and 812 × 375 with touch emulation and the joystick. On both phones the floor stays out of the HUD and out of the joystick box.
- Checks: the win score equals `3000 + 10 * floor(timeLeftMs / 1000)` for the submitted duration; a time-up equals `50 * collected` at 4:00.

## Known issues and core gaps

- This prep does not build the game. `meta.ts` limits stay as they are. The proof shows those limits are already wide enough.
- `skills.md` and plan §4 still list universe `street` and Hyper3D generations for the bin, bench, palm, umbrella and lamp. This spec uses universe `city` and generates only the bottle and the paper bag. The scenery is primitives on purpose. The catalog update belongs to Claude.
- The core gaps this game will hit are the ones robot-collector already recorded, and the copies live in this folder until the core has them:
  - `<Model>` has no `fallback` prop, so the scene asks `useModel(asset).failed` and draws its own primitive.
  - `CameraRig` has no "fit this box above the HUD and the joystick" option. `camera.ts` is the copy of `fitView`.
  - The core does not report the joystick's screen rect. The fit copies 132 + 20 + 8 px from `TouchControls.module.css` and reads safe-area insets with a probe.
  - R3F resets `state.clock.elapsedTime` on pause and resume. Visuals use `run.time`.
  - Frame order depends on `<Simulation>` mounting first.
  - The countdown handoff frame is untimed (at most 0.05 s). The proof allows for that one frame per run.
  - Input is screen-relative only after `inputToWorld`.
- Until the two GLBs exist, each load requests those files, gets a 404, and shows the primitives. The shared runner, tin can and banana 404 the same way until their GLBs exist.
