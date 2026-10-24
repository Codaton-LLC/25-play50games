# Robot Factory Sorter

Owner: Antigravity (design) / Kimi (`meta.ts` stub owner). Slug: `robot-factory`. Skill game 2 (order 22), complexity 1, collection `skill`. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §12, catalog `docs/arcade-expansion/05-hyper3d-catalog.md` §E.4 (game 12). Designed on branch `antigravity/design-robot-factory` (Gate G0). Units: metres, seconds; x right (+x = belt travel), z towards camera (+z = front / scrap bin), y up. Every "Changed from spec" line says what and why.

## Concept

A bright, clean robot assembly bay where parts ride a conveyor belt from left to right past a robotic sorter claw. A blueprint screen behind the belt shows the next robot's required parts in order (`3 → 4 → 5` parts, colour- and shape-coded), while the sorter grabs matching parts onto the assembly cradle and scraps sparking faulty parts into the front bin. Each finished robot steps off the cradle, waves and walks out the exit door before the 90 s shift ends. Accent `#7dd3fc`.

## Controls

`meta.ts`: `scheme: "tap-target"`, `touchControls: ["tap", "swipe"]`.

- `keyboard`: `"Space to grab, S / Down to scrap, or click a part"` (unchanged from the stub).
- `touch`: `"Tap a part to grab, swipe down to scrap"` (unchanged from the stub).
- Input fields:
   - **Grab (`grabTriggered`):** `input.current.jumpPressed || input.current.actionPressed || input.current.tap !== null` (Space sets `jumpPressed`, E / Enter set `actionPressed`, a short canvas tap/click sets `tap` on release).
   - **Scrap (`scrapTriggered`):** `input.current.pressed.down` (S, Down arrow, or a downward canvas swipe — `core/input.ts` fires `pressed.down` mid-gesture at 30 px drag).
   - **Target selection (`selectTargetPart`):** keyboard grab or scrap acts on the grab-zone part (`s_equiv ∈ [1.90, 3.70]` m) closest to the claw centre `s = 2.80` m (`x = 0`, ties broken by larger `s_equiv`); a canvas tap (`input.current.tap`) projects each grab-zone part's world centre `(x, 0.98, z)` via `projectToNdc(world, camera)` and picks the nearest part within `TAP_NDC_RADIUS = 0.28` (falling back to closest-to-`s = 2.80` m if inside the grab zone).
   - Esc / P pause (shell).
- **Changed from spec:** the spec lists "`tapDown` to grab" alongside "`pressed.down` to scrap". Per `core/README.md` ("`tap` or `tapDown`"), `tapDown` fires on pointer-down at the start of every swipe, a frame or more before the downward swipe sets `pressed.down`, which would make swiping down to scrap a sparking part grab and install it on frame 1. Reading `input.current.tap` for pointer/touch grabs and `jumpPressed || actionPressed` for instant keyboard grabs keeps keyboard response zero-latency while letting downward swipes cleanly trigger `pressed.down`.

## Rules

All numbers live in `rules.ts` (`BELT`, `STREAM`, `BLUEPRINT`, `CLAW`, `SCORING`, `SHIFT`) and are proven in `rules.test.ts`.

- **Conveyors (`BELT`):**
   - `MAIN_BELT`: `createPath([{ x: -2.80, y: 0.75, z: 0.35 }, { x: 2.80, y: 0.75, z: 0.35 }])`, length `L_main = 5.60` m, belt width `0.80` m, travel +x.
   - **Grab zone:** arc-length `s ∈ [1.90, 3.70]` m on `MAIN_BELT` (`x ∈ [-0.90, +0.90]` m, width `1.80` m), centred at `s_claw = 2.80` m (`x = 0.00, z = 0.35`).
   - `FEEDER_BELT` (active from `t >= 60.0` s): `createPath([{ x: -2.60, y: 0.75, z: -0.55 }, { x: -1.20, y: 0.75, z: 0.35 }])`, length `L_feeder = 1.664` m (`sqrt(1.40² + 0.90²)`), merging into `MAIN_BELT` at `s_merge = 1.60` m (`x = -1.20` m, `0.30` m upstream of `GRAB_MIN = 1.90` m).
   - **Equivalent arc-length (`s_equiv`):** both belts advance at `v(robotsCompleted) · dt`, so a part at `s` on `FEEDER_BELT` has `s_equiv = s_merge - (L_feeder - s) = s - 0.064` m and hands off onto `MAIN_BELT` at `s = 1.60` m with invariant inter-part spacing under all belt speedups.
   - **Belt speed (`beltSpeed(r)`):** `v(0) = 1.45` m/s (first-robot assist); for `r >= 1` completed robots, `v(r) = min(2.60, 1.60 · 1.04^(r - 1))` m/s (cap `V_MAX = 2.60` m/s reached at `r = 14`).
- **Part taxonomy & blueprints (`BLUEPRINT`):**
   - **4 part kinds × 4 high-contrast colours:**
     - `head`: procedural `dome`, `box`, `antenna` (`0.45` m).
     - `torso`: `barrel` (`REUSED_ASSETS.barrel`, `0.50` m) or `crate` (`SHARED_ASSETS.crate`, `0.50` m).
     - `cell`: `battery` (`SHARED_ASSETS.battery`, `0.45` m).
     - `arm`: procedural `claw`, `wrench`, `drill` (`0.45` m).
     - Palette (paired with silhouette + blueprint icon): `sky` (`#7dd3fc`), `amber` (`#fbbf24`), `coral` (`#f87171`), `lime` (`#a3e635`).
   - **Blueprint progression (`blueprintSize(r)`):** robots `0–1` require `3` parts (`[torso, cell, head]`); robots `2–4` require `4` parts (`[torso, cell, head, arm]`); robots `5+` require `5` parts (`[torso, cell, head, arm, arm]`). Part steps are grabbed in strict left-to-right blueprint order (`stepIndex = 0 .. N - 1`).
- **Seeded stream generator (`STREAM`):**
   - Pool cap `MAX_PARTS_ON_BELT = 8`, minimum spacing `MIN_PART_GAP = 0.95` m (`|s_equiv(a) - s_equiv(b)| >= 0.95` m at spawn).
   - **Opening pre-placement (`t = 0`):** two non-faulty parts sit on `MAIN_BELT` at `s_1 = 0.72` m (matching robot 0 step 0; enters `GRAB_MIN = 1.90` m at `t = (1.90 - 0.72) / 1.45 = 0.8138` s) and `s_2 = 0.00` m (distractor; spacing `0.72` m pre-belt, all subsequent spawns use `s = 0` with `MIN_PART_GAP = 0.95` m).
   - **Needed-part cadence & `< 4 s` fairness guarantee:** for every needed part `m >= 2` (`1`-indexed), the stream spawns it on `MAIN_BELT` (`s = 0`) at `t_spawn(m) >= (m - 1) · 1.60` s (`MIN_NEEDED_SPAWN_PERIOD = 1.60` s, separated by 1–2 distractors/faults at `0.75–1.10` s intervals) and at most `MAX_NEEDED_GAP = 2.25` s after the previous needed part's spawn (or miss/fault loss). Even at the slowest belt speed `1.45` m/s, the part reaches `GRAB_MIN = 1.90` m within `1.90 / 1.45 = 1.310` s of spawn, so the player never waits more than `2.25 + 1.310 = 3.56` s (`<= 4.0` s) for the next required part to enter the grab zone.
   - **Faulty parts:** ~18 % of non-needed spawns are `faulty: true` (persistent `fx.sparks` + red hazard chevron + orange/red emissive pulse). First faulty part spawns at `t >= FIRST_FAULT_MIN_T = 2.60` s; faulty spawns are separated by `>= FAULT_MIN_INTERVAL = 3.50` s (`2.50` s after `t = 60` s when `FEEDER_BELT` activates). Thus the 3rd faulty part cannot spawn before `t = 2.60 + 2 · 3.50 = 9.60` s and cannot enter `GRAB_MIN = 1.90` m before `t = 9.60 + 1.90 / 2.60 = 10.331` s (`10.788` s at reachable `v <= 1.60` m/s).
- **Actions, lockout & strikes (`CLAW`):**
   - While `clawLockout > 0`, grab and scrap inputs are ignored (`clawLockout = max(0, clawLockout - dt)`).
   - **Grab (`grabTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Needed & non-faulty:** claw snaps to part (`0.14` s), lifts it to the assembly cradle `(1.35, 0.35, -0.45)`, increments `partsInstalled`, awards `partPoints(comboSteps) = 20 + 4 · min(5, comboSteps)`, then sets `comboSteps = min(5, comboSteps + 1)`. If this completes the blueprint (`stepIndex + 1 == N`), awards `ROBOT_BONUS = 200`, increments `robotsCompleted`, launches the `1.12` s robot walk-off to the exit door `(2.75, 0, -0.45)` while immediately loading the next blueprint (`0` s logic lockout).
     2. **Wrong kind/colour (non-faulty):** claw clanks, part bounces on the belt, `comboSteps = 0`, `clawLockout = 0.50` s (no strike).
     3. **Faulty part:** part short-circuits on the claw (`fx.burst` sparks + `fx.shake("md")`), `strikes += 1` (`loseLife()`), `comboSteps = 0`, `clawLockout = 0.50` s. At `strikes == 3`, the run ends immediately with `end("lose")`.
   - **Scrap (`scrapTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Faulty part:** sweeper arm knocks the part into the front scrap bin `(0.00, 0.20, 0.95)`, preserving `comboSteps` with `0` s lockout (`faultsScrapped += 1`).
     2. **Non-faulty part:** part is swept into the scrap bin, `comboSteps = 0`, `clawLockout = 0.50` s (no strike; if it was the needed part, a replacement spawns within `<= 2.25` s).
   - **Belt exit (`s_equiv > 3.70` m):**
     - An unscrapped **faulty** part leaving the grab zone (`s_equiv` crossing `3.70` m) triggers a belt-sensor zap: `comboSteps = 0` and `clawLockout = max(clawLockout, 0.50)` s (no strike).
     - An ungrabbed **needed** part crossing `3.70` m resets `comboSteps = 0` and schedules a replacement needed part within `<= 2.25` s.

## Scoring

Every score change is an integer event; `runScore` is the closed-form sum over `M` installed parts (with pre-grab combo step `c_i ∈ {0..5}`) and `R` completed robots:

`runScore(c_1..c_M, R) = sum_{i=1..M} (20 + 4 · c_i) + 200 · R`

With zero mistakes (`c_i = min(5, i - 1)`), the closed-form score after `M >= 5` installed parts and `R` completed robots is:

`perfectScore(M, R) = 40 · M - 40 + 200 · R` (for `0 <= M <= 5`: `20 · M + 2 · M · (M - 1) + 200 · R`).

Live: `addScore(20 + 4 · c_i)` on each installed part and `addScore(200)` on each completed robot (`setStat("Robots", robotsCompleted)`). On run end, `setScore(state.score)` and `end(outcome)` run in the same frame. `finalScore` is not overridden (`duration = elapsedMs`). Popups: `"+20"`..`"+40"` on parts and `"+200 ROBOT!"` on robot completion.

### Server limits and why they hold (the proof)

| | provisional (`meta.ts` / `arcade-games.json`) | proven tight limits (for go-live PR) |
|---|---|---|
| `maxScore` / `max_score` | 6000 | **4600** |
| duration (`minDurationMs`–`maxDurationMs`) | 10000–92000 ms | **10000–92000 ms** |
| `base` / `max_pps` (`maxPointsPerSec`) | 6000 / 6000 | **300 / 52** |

`meta.ts` and `arcade-games.json` are not in this task's allowed files, so the design holds with wide margin under the provisional `6000 / 10000–92000 / 6000 + 6000/s` today and proves the tight `4600 / 10000–92000 / 300 + 52/s` numbers for go-live:

1. **Clock:** `rules.ts` advances on `playedFrameDt` from `useRunFrame` and clamps the final step at `SHIFT_DURATION = 90.0` s (`elapsedMs = 90000` ms, well inside `maxDurationMs = 92000` ms).
2. **Earliest run end (`>= 10.331 s > 10000 ms`):** a run only ends before `90.0` s on a 3rd faulty-part strike. Because `FIRST_FAULT_MIN_T = 2.60` s, `FAULT_MIN_INTERVAL = 3.50` s (before 60 s), and faulty parts spawn at `s = 0` and must travel `GRAB_MIN = 1.90` m at `v <= V_MAX = 2.60` m/s (`v <= 1.60` m/s before 2 robots), the 3rd faulty part cannot enter the grab zone before `t_3 >= 2.60 + 2 · 3.50 + 1.90 / 2.60 = 10.331` s (`10.788` s at `v <= 1.60` m/s). Thus every legal or spam-lose run has `durationMs >= 10331 > 10000` ms (`331` ms / `788` ms safety margin).
3. **Needed-part arrival bound `M(t)`:** part `m = 1` is pre-placed at `s_1 = 0.72` m and reaches `GRAB_MIN = 1.90` m at `t_1 = (1.90 - 0.72) / 1.45 = 0.8138` s. Every subsequent needed part `m >= 2` spawns at `s = 0` at `t_spawn(m) >= (m - 1) · 1.60` s and travels `>= 1.90` m at `v <= 2.60` m/s (`>= 0.7308` s), so `t_grab(m) >= (m - 1) · 1.60 + 0.7308` s, giving `M(t) <= floor((t - 0.7308) / 1.60) + 1 <= (t + 0.8692) / 1.60`. At `t = 90.0` s, `M(90) <= floor(89.2692 / 1.60) + 1 = 56` parts.
4. **Completed-robot bound `R(M)`:** blueprints require `3, 3, 4, 4, 4, 5, 5, ...` parts (cumulative thresholds `3, 6, 10, 14, 18, 23, 28, 33, 38, 43, 48, 53, 58`). For every integer `M >= 0`, `5 · R(M) <= M + 7`, so `200 · R(M) <= 40 · M + 280`; at `M = 56`, `R(56) = 12` robots (`53 <= 56 < 58`).
5. **Maximum score & rate envelope:** at `t = 90.0` s (`M <= 56, R <= 12`), `score <= 40 · 56 - 40 + 200 · 12 = 2200 + 2400 = 4600` (`<= 4600` tight, `<= 6000` provisional). At any time `t >= 0`, `score(t) <= (40 · M(t) - 40) + (40 · M(t) + 280) = 80 · M(t) + 240 <= 80 · (t + 0.8692) / 1.60 + 240 = 50 · t + 283.46 < 300 + 52 · t`. Thus `capScore` is a no-op on every run.

## Run end

- **Shift clock (`SHIFT_DURATION = 90.0` s):** `durationMs` is **omitted** on `GameDefinition`; `rules.ts` runs the 90 s clock itself (displayed via HUD stat `"Time"`, `"90s"` → `"0s"`) so the final frame is never skipped by the shell's `"timeup"` short-circuit.
- **`end("win")` at `90.0` s when `robotsCompleted >= 5` (`WIN_QUOTA = 5`):** plays the win fanfare and shows the completed-robot count; `resultDelayMs: 1400` lets the last robot's walk-off and `cheerPose` finish.
- **`end("lose")`:** (a) immediately when the 3rd faulty part is grabbed (`strikes == 3`, `lives: 3` exhausted via `loseLife()`), or (b) at `90.0` s when `robotsCompleted < 5` (so an `idleBot` or a bot that misses the shift quota fails cleanly).
- **Changed from spec:** the spec sets `durationMs: 90000` with `"timeup"` as the normal end. In `core/`, `durationMs` ends the run with outcome `"timeup"` (which renders `"Time's up!"` + lose sting and skips `useRunFrame` on the expiring frame) and would let an `idleBot` finish without failing. Driving the 90 s shift timer in `rules.ts` and calling `end(robotsCompleted >= 5 ? "win" : "lose")` gives a real win state at quota `>= 5` and guarantees `idleBot` loses.

## Scene and camera

- **Fixed 3/4 view (`useFittedView` + static `<CameraRig>`):**
   - `useFittedView({ area: { min: { x: -3.0, y: 0, z: -1.1 }, max: { x: 3.0, y: 1.95, z: 1.3 } }, focus: [{ x: 0, y: 0.75, z: 0.1 }], pitch: 38 * DEG, yaws: [0], fov: 40, padding: 6, margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 }, shift: true })`.
   - `<CameraRig offset={view.offset} shift={view.shift} damping={5} />` (`camera.lookAt(0, 0.75, 0.1)`).
   - **Minimum on-screen sizes (`>= 24 CSS px` verified at `fov = 40°`, `pitch = 38°`):**

| Element | World size | `390 × 844` (`57.2 px/m`) | `844 × 390` banner open (`71.2 px/m`) | `1280 × 800` (`114.4 px/m`) |
|---|---|---|---|---|
| Smallest belt part (`head` / `cell` / `arm`) | `0.45 × 0.45 × 0.45 m` | **25.7 × 36.1 px** | **32.1 × 45.0 px** | 51.5 × 72.2 px |
| Torso part (`barrel` / `crate`) | `0.50 × 0.50 × 0.50 m` | **28.6 × 40.1 px** | **35.6 × 50.0 px** | 57.2 × 80.2 px |
| Sorter claw head | `0.55 × 0.50 × 0.55 m` | **31.5 × 38.6 px** | **39.2 × 48.1 px** | 62.9 × 77.2 px |
| Blueprint slot icon (×5) | `0.44 × 0.44 m` | **25.2 × 25.2 px** | **31.3 × 31.3 px** | 50.3 × 50.3 px |
| Assembled robot (`ASSETS.robot`) | `0.55 × 1.20 × 0.45 m` | **31.5 × 64.7 px** | **39.2 × 80.5 px** | 62.9 × 129.4 px |

- **Changed from spec:** camera pitch is `38°` with `fov: 40` and `area.x = ±3.0 m` (`5.60 m` main belt) instead of `45°` over an `8 m` belt, so a `0.45 m` part projects to `25.7 CSS px` wide (`>= 24 CSS px`) on a `390 × 844` portrait phone where an `8 m` belt only yields `~42 px/m` (`18.9 px`).
- **Visual language & lighting:** `environment: { background: "#0f172a", fog: ["#0f172a", 14, 32], lighting: "warehouse" }`. Floor grid in `#1e293b` with cyan grab-zone rails (`#7dd3fc`, pulsing emerald `#34d399` on grab and red `#f87171` during lockout).

## Core helpers used

`GameDefinition` (`lives: 3`, `resultDelayMs: 1400`, `touchControls: ["tap", "swipe"]`, `hudStats` Robots / Combo / Time, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`tap`, `pressed.down`, `jumpPressed`, `actionPressed`), `useFittedView` + `CameraRig`, `projectToNdc`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `loseLife`, `end`), `core/path` (`createPath`, `samplePath`), `core/kit` (`Conveyor`), `core/math` (`createRng`, `rngNext`, `randomSeed` in Scene only, `clamp`, `damp`), `core/limits` (`withinServerLimits`, `capScore`), `createArcadeStore` + `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`), `<Model fallback>`, `<DynamicInstancedModel tinted>`, `<DynamicInstanced tinted>`, `BlobShadow`, `useCanvasTexture` (blueprint screen header/ticks, floor hazard stripes), `SHARED_ASSETS` (`robot`, `battery`, `crate`) + `REUSED_ASSETS` (`barrel`, `door`) + `ROBOT_LANDMARKS`, rig (`<HumanoidModel tint>`, `useHumanoidPose`, `walkPose`, `idlePose`, `cheerPose`, `aimArm`, `turnBone`, `walkStride`, `bodyLift`, `BONE`), `core/fx` (`useFx`: `burst` sparks / puff / confetti, `sparks` continuous emitter, `score`, `shake`, `warm`), `useQuality`, perf probe `?perf=1`, P-06 audio (`playSfx`, `startLoop`). Nothing generic is built inside the game folder.

## Assets

Zero Class E assets (`05-hyper3d-catalog.md` §E.4 game 12: `0` dedicated GLBs). `assets.spec.json` has `"assets": []` (matching `clean-city/assets.spec.json`). Fits live in `assets.ts` and are verified on the real GLBs in `assets.test.ts`.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| assembled robot | D `SHARED_ASSETS.robot` (`<HumanoidModel tint>`) | `1.20 m` tall (`scale 0.698`) | cradle `(1.35, 0, -0.45)` → door `(2.75, 0, -0.45)` | box torso + head + limbs |
| torso (`barrel`) | D `REUSED_ASSETS.barrel`, `<DynamicInstancedModel tinted>` (max 8) | `0.50 × 0.50 × 0.50 m` | belt `s`, pick radius `0.26 m` | cylinder |
| torso (`crate`) | D `SHARED_ASSETS.crate`, `<DynamicInstancedModel tinted>` (max 8) | `0.50 × 0.50 × 0.50 m` | belt `s`, pick radius `0.26 m` | box |
| power cell (`battery`) | D `SHARED_ASSETS.battery`, `<DynamicInstancedModel tinted>` (max 8) | `0.45 × 0.45 × 0.45 m` | belt `s`, pick radius `0.25 m` | cylinder + cap |
| exit door | D `REUSED_ASSETS.door` (`REUSED_GLB_SIZE.door`) | `1.10 × 2.00 × 0.20 m` at `(2.85, 0, -0.45)` | decoration | box frame + slab |
| head parts (`dome`, `box`, `antenna`) | B procedural `<DynamicInstanced tinted>` (max 8 each) | `0.45 × 0.45 × 0.45 m` | belt `s`, pick radius `0.25 m` | (is code) |
| arm parts (`claw`, `wrench`, `drill`) | B procedural `<DynamicInstanced tinted>` (max 8 each) | `0.45 × 0.45 × 0.45 m` | belt `s`, pick radius `0.25 m` | (is code) |
| conveyors (`MAIN_BELT`, `FEEDER_BELT`) | B `core/kit` `<Conveyor>` | `5.60 × 0.80 m` & `1.66 × 0.65 m` | paths in `rules.ts` | (is code) |
| sorter claw, gantry, sweeper, cradle, scrap bin, blueprint screen | B procedural (`Bay.tsx`, `BlueprintBoard.tsx`) | gantry `y = 1.85 m`, claw `0.55 × 0.50 m`, screen `2.60 × 0.85 m` | grab zone `s ∈ [1.90, 3.70]` m | (is code) |

## Files

`meta.ts` (metadata, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (paths, stream generator, blueprints, grab/scrap/exit resolution, walk-off state, shift clock, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `robotWalkOffPose(t, out)` blending `walkPose` + `aimArm` wave, `cradleBuildPose(stepCount, out)`; tested in `poses.test.ts` via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits and bounding-box checks on the real GLBs) · `Scene.tsx` (single `useRunFrame`, camera, input tap/swipe dispatch, fx, audio) · `Bay.tsx` (`Conveyor` belts, overhead gantry + claw, sweeper arm, assembly cradle, scrap bin, exit door) · `PartsAndRobot.tsx` (`DynamicInstancedModel` / `DynamicInstanced` belt parts, cradle stack, rigged walking robot) · `BlueprintBoard.tsx` (back-wall blueprint screen, 5 slot silhouettes + checkmarks, strike LEDs) · `assets.spec.json` · `README.md` · `public/images/3d/robot-factory.webp` · `tools/thumbs/inputs/robot-factory.mjs`.

## Test plan

`rules.test.ts` ≤ 600 lines (K.4), behaviour over branches, using `core/testing/botHarness.ts`:

- **Tuning pins:** `BELT`, `STREAM`, `BLUEPRINT`, `CLAW`, `SCORING`, and `SHIFT` constants match their literal design values.
- **Stream & fairness (`< 4 s` rule):** deterministic per seed across 200 seeds; inter-part gap `>= 0.95 m` at spawn and across the `FEEDER_BELT → MAIN_BELT` merge at `s = 1.60 m`; needed part `m` always spawns at `t >= (m - 1) · 1.60` s and enters `GRAB_MIN = 1.90 m` within `<= 4.0` s of the previous needed part; 3rd faulty part never reaches `GRAB_MIN` before `10.33 s`.
- **Blueprint & actions:** `3 → 4 → 5` progression (`r = 0..1, 2..4, 5+`); grabbing the needed non-faulty part advances `stepIndex`, increments `comboSteps` (`20..40` pts), and at `stepIndex == N` awards `+200`, increments `robotsCompleted`, and starts the `1.12 s` walk-off with `0 s` lockout; grabbing a wrong part or scrapping a clean part resets `comboSteps = 0` and sets `clawLockout = 0.5 s`; grabbing a faulty part increments `strikes` (`3` strikes → `end("lose")`); scrapping a faulty part preserves `comboSteps` with `0 s` lockout; unscrapped faulty part exiting `s > 3.70 m` resets `comboSteps = 0` and sets `0.5 s` lockout without a strike.
- **Belt speed:** `beltSpeed(r)` is `1.45` at `r = 0`, `1.60 · 1.04^(r - 1)` for `r >= 1`, monotonic non-decreasing, capped at `2.60 m/s`.
- **Scoring + server-limit proof (4 bots × 200 seeds through `createArcadeStore()` + `simulateRun` at 60 fps, 20 fps, and random 4–50 ms frames):**
   1. `perfectBot` (grabs every needed part, scraps every faulty part): wins every seed with `robotsCompleted >= 8`, `score <= 4600`, `withinServerLimits` true (both provisional and tight `4600 / 10000–92000 / 300 + 52/s`), `capScore` is a no-op, deterministic on replay.
   2. `goodBot` (~85 % accuracy, occasional wrong grab): wins at `90000 ms`, passes `withinServerLimits`.
   3. `spamGrabBot` / `spamScrapBot` (spams grab or scrap every frame): `spamGrabBot` loses on 3 strikes at `durationMs >= 10331 ms`; `spamScrapBot` loses at `90000 ms` with `0` pts; both pass `withinServerLimits`.
   4. `idleBot` (no input): loses at `90000 ms` (`robotsCompleted = 0 < 5`, unscrapped faults only zap-lock the claw without strikes).
- `poses.test.ts` / `assets.test.ts`: robot soles within 1 cm of the floor during walk-off; wave hand stays in bounds; fitted sizes of `robot`, `barrel`, `crate`, `battery`, `door` match the table.

## Performance

Target **32** draw calls, cap **60**; triangles ≤ **45k** (cap 150k). Estimate: floor + grid 2, main + feeder `<Conveyor>` 4, gantry + claw + sweeper 4, cradle + scrap bin + exit door 4, blueprint board + 5 slot icons + strike LEDs 8, instanced GLB parts (`barrel`, `crate`, `battery`) 3, instanced procedural parts (`head` ×3, `arm` ×3) 6, cradle sub-assembly + walking `<HumanoidModel>` 3, blob shadows 1, fx pools (`sparks`, `puff`, `confetti`, `score`) 4 → **35–39 draw calls**. Lights: `warehouse` preset only. All pools warmed at mount (`fx.warm("sparks", "puff", "confetti", "score")`); zero per-frame allocations in `useRunFrame`. On `useQuality().tier === "low"`, background decor pillars hide and continuous spark emission halves rate while keeping the red hazard chevron on every faulty part.

## Audio

Designed against P-06 (`playSfx`, `startLoop`): `startLoop("conveyor", { volume: 0.22 })` during play (pitch `0.95 + 0.15 · (v - 1.45) / 1.15`); valid grab `"pickup"` (`pitch: 1.0 + 0.06 · comboSteps`); robot completed `"chime"` + `"powerup"`; wrong grab or clean-part scrap `"clank"` / `"hit"` at volume `0.45`; faulty grab strike `"zap"` + `"hit"`; faulty scrap `"whoosh"` + `"thud"`; belt-exit zap `"zap"` at volume `0.35`. Built before P-06 lands: uses existing `"pickup"`, `"hit"`, `"powerup"`, `"whoosh"` cues with a `TODO(P-06)` comment for `"conveyor"`, `"clank"`, and `"zap"`.

## Accessibility

Every part's role is redundant across **three channels**: (1) distinct 3D silhouette (`barrel`/`crate` torso, `battery` cell, `dome`/`box`/`antenna` head, `claw`/`wrench`/`drill` arm), (2) high-contrast colour (`#7dd3fc`, `#fbbf24`, `#f87171`, `#a3e635`), and (3) matching slot position + shape icon on the blueprint board (`1..5` left-to-right with checkmarks). Faulty parts combine a continuous spark emitter, an orange/red pulse, and a floating red `!` chevron badge (`>= 24 px`) so colour is never required alone. Keyboard (`Space` + `S`/`Down`) and touch/mouse (tap part + swipe down) have full parity; `fx.shake` respects `prefers-reduced-motion`.

## Risks and open questions

- **Open questions for Claude / user:**
   1. **Tight server limits in `meta.ts` and `arcade-games.json`:** `meta.ts` currently holds provisional limits (`maxScore: 6000`, `minDurationMs: 10000`, `maxDurationMs: 92000`, `base: 6000`, `maxPointsPerSec: 6000`). Should the build PR (P-29) tighten `meta.ts` to the proven `maxScore: 4600`, `minDurationMs: 10000`, `maxDurationMs: 92000`, `base: 300`, `maxPointsPerSec: 52` (with Claude mirroring `arcade-games.json` at go-live)?
   2. **Measured GLB size constants in `core/sharedAssets.ts`:** `core/sharedAssets.ts` exports `COIN_GLB_SIZE`, `EXPANSION_GLB_SIZE`, and `REUSED_GLB_SIZE.door`, while `robot`, `battery`, `crate`, and `REUSED_ASSETS.barrel` are fitted per-game in `assets.ts` and checked in `assets.test.ts`. Does Claude want to add `SHARED_GLB_SIZE` (`robot`, `battery`, `crate`) and `REUSED_GLB_SIZE.barrel` to `core/sharedAssets.ts`, or keep those fits local to `robot-factory/assets.ts`?
- **Resolved design risks:** (1) `tap` vs `tapDown` swipe conflict solved by reading `input.current.tap` + `jumpPressed || actionPressed` for grab and `pressed.down` for scrap; (2) `FEEDER_BELT` merge overlap solved by `s_equiv = s_merge - (L_feeder - s)` with `MIN_PART_GAP = 0.95 m`.

## Status

```text
HANDOFF P-14 (Gate G0 design)
Branch: antigravity/design-robot-factory
Files changed: play50games-frontend/src/arcade3d/games/robot-factory/README.md, play50games-frontend/src/arcade3d/games/robot-factory/assets.spec.json
Scoring formula: sum(20 + 4 * c_i) + 200 * R (perfect: 40 * M - 40 + 200 * R); proven limits 4600, 10.0-92.0 s, 300 + 52/s (provisional 6000, 10.0-92.0 s, 6000 + 6000/s).
Next gate: G0 review -> P-29 implementation.
```
