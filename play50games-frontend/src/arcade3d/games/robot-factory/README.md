# Robot Factory Sorter

Owner: Antigravity (design) / Kimi (`meta.ts` stub owner). Slug: `robot-factory`. Skill game 2 (order 22), complexity 2, collection `skill`. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §12, catalog `docs/arcade-expansion/05-hyper3d-catalog.md` §E.4 (game 12). Designed on branch `antigravity/design-robot-factory` (Gate G0). Units: metres, seconds; x right (+x = belt travel), z towards camera (+z = front / scrap bin), y up. Every "Changed from spec" line says what and why.

## Concept

A bright, clean robot assembly bay where parts ride a conveyor belt from left to right past a robotic sorter claw. A blueprint screen behind the belt shows the next robot's required parts in order (`3 → 4 → 5` parts, colour- and shape-coded), while the sorter grabs matching parts onto the assembly cradle and scraps sparking faulty parts into the front bin. Each finished robot steps off the cradle, waves and walks out the exit door before the 90 s shift ends. Accent `#7dd3fc`.

## Controls

`meta.ts`: `scheme: "tap-target"`, `touchControls: ["tap", "swipe"]`.

- `keyboard`: `"Space to grab, S / Down to scrap, or click a part"` (unchanged from the stub).
- `touch`: `"Tap a part to grab, swipe down to scrap"` (unchanged from the stub).
- Input & target selection (`selectTargetPart`):
   - **Pointer press (`input.current.tapDown`):** on pointer-down (before any travel), `Scene.tsx` projects each grab-zone part's world centre `(x, 0.98, z)` to canvas CSS px via a scratch `Vector3.project(camera)` and stores `pressedPartId` for the nearest grab-zone part (`s_equiv ∈ [1.90, 3.70]` m) within `TAP_HIT_RADIUS_PX = 28` CSS px (`56` CSS px diameter `>= 44` CSS px target; falling back to the part closest to the claw centre `s = 2.80` m if the press lands inside the grab zone's screen box). It does **not** act on `tapDown`.
   - **Grab (`grabTriggered`):** `input.current.jumpPressed || input.current.actionPressed || input.current.tap !== null`. On `tap`, acts on `pressedPartId` (if still in `[1.90, 3.70]` m, else closest to `s = 2.80` m) and clears `pressedPartId`; on keyboard `Space` (`jumpPressed`) or `E`/`Enter` (`actionPressed`), acts on the grab-zone part closest to `s = 2.80` m (`x = 0`, ties broken by larger `s_equiv`).
   - **Scrap (`scrapTriggered`):** `input.current.pressed.down` (`S`, `Down` arrow, or a downward swipe on the grab zone; `core/inputController.ts` commits `pressed.down` mid-gesture at `30` px). If `pressedPartId` is set and still in `[1.90, 3.70]` m, scraps `pressedPartId` and clears it; otherwise scraps the grab-zone part closest to `s = 2.80` m.
   - Esc / P pause (shell).
- **Changed from spec:** the spec lists "`tapDown` to grab" and "swipe down on the grab zone to scrap (`pressed.down`)". Because `tapDown` fires on pointer-down at the start of every swipe (before `pressed.down`) and `tap` fires on release up to `350` ms later (when a part at `2.60` m/s has moved `~0.91` m / `~52` px in portrait), we lock `pressedPartId` on `tapDown` with a `28` CSS px hit radius, then fire grab on `tap` and scrap on `pressed.down` for that locked part (with closest-to-claw fallback for keyboard `Space`/`S`/`Down` or a swipe starting elsewhere on the grab zone).

## Rules

All numbers live in `rules.ts` (`BELT`, `STREAM`, `BLUEPRINT`, `CLAW`, `SCORING`, `SHIFT`) and are proven in `rules.test.ts`.

- **Conveyors (`BELT`):**
   - `MAIN_BELT`: `createPath([{ x: -2.80, y: 0.75, z: 0.35 }, { x: 2.80, y: 0.75, z: 0.35 }])`, length `L_main = 5.60` m, belt width `0.80` m, travel +x, advanced via `advance(rider, ds)` / `pointAt(path, s, out)`.
   - **Grab zone:** arc-length `s ∈ [1.90, 3.70]` m on `MAIN_BELT` (`x ∈ [-0.90, +0.90]` m, width `1.80` m), centred at `s_claw = 2.80` m (`x = 0.00, z = 0.35`).
   - `FEEDER_BELT` (active from `t >= 60.0` s): `createPath([{ x: -2.60, y: 0.75, z: -0.55 }, { x: -1.20, y: 0.75, z: 0.35 }])`, length `L_feeder = 1.664` m (`sqrt(1.40² + 0.90²)`), merging into `MAIN_BELT` at `s_merge = 1.60` m (`x = -1.20` m, `0.30` m upstream of `GRAB_MIN = 1.90` m).
   - **Equivalent arc-length (`s_equiv`):** both belts advance at `v(robotsCompleted) · dt`, so a part at `s` on `FEEDER_BELT` has `s_equiv = s_merge - (L_feeder - s) = s - 0.064` m and hands off onto `MAIN_BELT` at `s = 1.60` m with invariant inter-part spacing under all belt speedups.
   - **Belt speed (`beltSpeed(r)`):** `v(0) = 1.45` m/s (first-robot assist); for `r >= 1` completed robots, `v(r) = min(2.60, 1.60 · 1.04^(r - 1))` m/s (cap `V_MAX = 2.60` m/s reached at `r = 14`).
- **Part taxonomy & blueprints (`BLUEPRINT`):**
   - **4 part kinds × 4 high-contrast colours (16 `(kind, colour)` pairs):**
     - `head`: procedural `dome`, `box`, `antenna` (`0.45` m).
     - `torso`: `barrel` (`REUSED_ASSETS.barrel`, `0.50` m) or `crate` (`SHARED_ASSETS.crate`, `0.50` m).
     - `cell`: `battery` (`SHARED_ASSETS.battery`, `0.45` m).
     - `arm`: procedural `claw`, `wrench`, `drill` (`0.45` m).
     - Palette (paired with silhouette + blueprint icon): `sky` (`#7dd3fc`), `amber` (`#fbbf24`), `coral` (`#f87171`), `lime` (`#a3e635`).
   - **Blueprint progression (`blueprintSize(r)`):** robots `0–1` require `3` parts (`[torso, cell, head]`); robots `2–4` require `4` parts (`[torso, cell, head, arm]`); robots `5+` require `5` parts (`[torso, cell, head, arm, arm]`). Part steps are grabbed in strict left-to-right blueprint order (`stepIndex = 0 .. N - 1`).
- **Seeded stream generator (`STREAM`):**
   - Pool cap `MAX_PARTS_ON_BELT = 8`, minimum spacing `MIN_PART_GAP = 0.95` m (`|s_equiv(a) - s_equiv(b)| >= 0.95` m at spawn).
   - **Fixed needed-part lattice (`NEEDED_SPAWN_PERIOD = 1.60` s) & `< 4 s` fairness guarantee:**
     - At `t = 0` (`m = 1`), needed part `1` (matching robot `0` step `0`) is pre-placed on `MAIN_BELT` at `s_1 = 0.72` m (entering `GRAB_MIN = 1.90` m at `t_1 = (1.90 - 0.72) / 1.45 = 0.8138` s) and one non-needed distractor is pre-placed at `s_2 = 0.00` m.
     - Every needed-part slot `m >= 2` (`1`-indexed) spawns on `MAIN_BELT` (`s = 0`) on the fixed lattice `t_spawn(m) = (m - 1) · 1.60` s (`1.60, 3.20, ..., 88.00` s), with **exactly one** non-needed slot at `(m - 1) · 1.60 + 0.80` s (`0.80` s half-period = `>= 1.16` m `>= 0.95` m at `v >= 1.45` m/s; from `t >= 60` s the `+0.80` s non-needed slot alternates onto `FEEDER_BELT`).
     - If a needed part is missed (`s_equiv > 3.70` m) or scrapped, the very next lattice slot (`<= 1.60` s later) re-spawns that step's needed part instead of advancing the blueprint stream cursor. Even at the slowest belt speed `1.45` m/s (`1.90 / 1.45 = 1.310` s to `GRAB_MIN`), the player never waits more than `1.60 + 1.310 = 2.910` s (`< 4.0` s) for the next needed part to enter the grab zone.
   - **Non-needed part disjointness rule (preserves `M(t)`):** no non-needed part (clean distractor or faulty part) ever matches `(kind, colour)` of **any** step in the **current or next** blueprint (`r` or `r + 1`; at most `10` of the `16` `(kind, colour)` pairs are excluded). Thus a distractor or bounced wrong part can never become a valid needed part when `stepIndex` or `robotsCompleted` advances.
   - **Faulty parts:** ~18 % of non-needed slots spawn with `faulty: true` (throttled `fx.burst("sparks", pos, 4)` + red `!` chevron + orange/red emissive blink). First faulty part spawns at `t >= FIRST_FAULT_MIN_T = 2.60` s (earliest non-needed slot `t = 4.00` s or `2.40` s clamped to `>= 2.60` s); faulty spawns are separated by `>= FAULT_MIN_INTERVAL = 3.50` s (`2.50` s after `t = 60` s). Thus the 3rd faulty part cannot spawn before `t >= 2.60 + 2 · 3.50 = 9.60` s and cannot enter `GRAB_MIN = 1.90` m before `t >= 9.60 + 1.90 / 2.60 = 10.331` s (`10.788` s at `v <= 1.60` m/s).
- **Actions, lockout & strikes (`CLAW`):**
   - While `clawLockout > 0`, grab and scrap inputs are ignored (`clawLockout = max(0, clawLockout - dt)`).
   - **Grab (`grabTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Needed & non-faulty:** part is removed from the belt; the claw's `0.14` s lift to the assembly cradle `(1.35, 0.35, -0.45)` is **visual only (`0` s logic busy time)**. Increments `partsInstalled`, awards `partPoints(comboSteps) = 20 + 4 · min(5, comboSteps)`, then sets `comboSteps = min(5, comboSteps + 1)`. If this completes the blueprint (`stepIndex + 1 == N`), awards `ROBOT_BONUS = 200`, increments `robotsCompleted`, immediately activates the next blueprint (`0` s logic lockout), and starts the finished robot's `0.70` s walk-off from `(1.35, 0, -0.45)` to the exit door `(2.40, 0, -0.45)` — clearing the cradle footprint within `0.30` s and finishing at `0.70` s, before the next blueprint's first needed part can ever land (`>= 0.73` s after completion).
     2. **Wrong kind/colour (non-faulty):** claw clanks, part bounces on the belt, `comboSteps = 0`, `clawLockout = WRONG_LOCKOUT = 1.00` s (no strike; `1.00` s exceeds both the `0.80` s lattice half-period and the `0.73` s high-speed dwell so a blueprint-blind bot misses needed parts).
     3. **Faulty part:** part short-circuits on the claw (`fx.burst("sparks", pos, 14)` + `fx.shake(0.3)`) and is **consumed (removed from the belt into the scrap bin, so one faulty part can never cause two strikes)**; `strikes += 1`, `comboSteps = 0`, `clawLockout = 0.50` s, and `loseLife()` is called once (at `3` strikes `loseLife()` reaches `0` lives and calls `end("lose")` automatically — `Scene.tsx` never calls `end("lose")` a second time).
   - **Scrap (`scrapTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Faulty part:** sweeper knocks the part off the belt into the front scrap bin `(0.00, 0.20, 0.95)`, preserving `comboSteps` with `0` s lockout (`faultsScrapped += 1`).
     2. **Non-faulty part:** part is swept into the scrap bin, `comboSteps = 0`, `clawLockout = WRONG_LOCKOUT = 1.00` s (no strike; if it was the needed part, the next lattice slot `<= 1.60` s later replaces it).
   - **Belt exit (`s_equiv > 3.70` m):**
     - An unscrapped **faulty** part crossing `3.70` m triggers a belt-sensor zap: `comboSteps = 0` and `clawLockout = max(clawLockout, 0.50)` s (no strike).
     - An ungrabbed **needed** part crossing `3.70` m resets `comboSteps = 0` and is replaced at the next needed-part lattice slot (`<= 1.60` s).

## Scoring

Every score change is an integer event; `runScore` is the closed-form sum over `M` installed parts (with pre-grab combo step `c_i ∈ {0..5}`) and `R` completed robots:

`runScore(c_1..c_M, R) = sum_{i=1..M} (20 + 4 · c_i) + 200 · R`

With zero mistakes (`c_i = min(5, i - 1)`, where the first 5 parts give `20 + 24 + 28 + 32 + 36 = 140 = 40 · 5 - 60`), the closed-form score for `M >= 5` installed parts and `R` completed robots is:

`perfectScore(M, R) = 40 · M - 60 + 200 · R` (for `0 <= M <= 5`: `20 · M + 2 · M · (M - 1) + 200 · R`).

Live: `addScore(20 + 4 · c_i)` on each installed part and `addScore(200)` on each completed robot (`setStat("Robots", robotsCompleted)`). On run end, `setScore(state.score)` and `end(outcome)` run in the same frame (`loseLife()` on a 3rd strike). `finalScore` is not overridden (`duration = elapsedMs`). Popups: `"+20"`..`"+40"` on parts and `"+200 ROBOT!"` on robot completion.

### Server limits and why they hold (the proof)

| Limit | Provisional (`meta.ts` / `arcade-games.json`) | Proven bound | Proposed tight limits (Claude sets at go-live) | Margin |
|---|---|---|---|---|
| `maxScore` / `max_score` | 6000 | **4580** (`M = 56, R = 12`) | **4750** | +170 pts (+3.7 %) |
| `minDurationMs` / `min_duration_ms` | 10000 ms | **10331 ms** (10788 ms at `v <= 1.60`) | **10000 ms** | 331 ms (788 ms) |
| `maxDurationMs` / `max_duration_ms` | 92000 ms | **90000 ms** (`SHIFT_DURATION`) | **92000 ms** | +2000 ms |
| `base` | 6000 | **264** (`B(t) <= 50t + 263.5`) | **300** | +36 pts |
| `maxPointsPerSec` / `max_pps` | 6000 | **50 / s** | **52 / s** | +2 / s (+4.0 %) |

`meta.ts` and `arcade-games.json` are outside this task's allowed files; the design holds under the provisional limits today and proposes the tight limits above for Claude's go-live PR:

1. **Clock:** `rules.ts` advances on `playedFrameDt` from `useRunFrame` and clamps the final step at `SHIFT_DURATION = 90.0` s (`elapsedMs = 90000` ms `<= 92000` ms).
2. **Earliest run end (`>= 10.331 s > 10000 ms`):** a run only ends before `90.0` s on a 3rd faulty-part strike, and each grabbed faulty part is **consumed** into the scrap bin (so 3 strikes require 3 distinct faulty parts). With `FIRST_FAULT_MIN_T = 2.60` s, `FAULT_MIN_INTERVAL = 3.50` s (before 60 s), and `GRAB_MIN = 1.90` m travel from `s = 0` at `v <= V_MAX = 2.60` m/s (`v <= 1.60` m/s before 2 robots), the 3rd faulty part cannot enter the grab zone before `t_3 >= 2.60 + 2 · 3.50 + 1.90 / 2.60 = 10.331` s (`10.788` s at `v <= 1.60` m/s).
3. **Needed-part arrival bound `M(t)`:** because non-needed parts never match any step of the current or next blueprint, only needed-part lattice spawns can be installed. Part `m = 1` reaches `GRAB_MIN = 1.90` m at `t_1 = (1.90 - 0.72) / 1.45 = 0.8138` s; every needed part `m >= 2` spawns at `s = 0` at `t_spawn(m) >= (m - 1) · 1.60` s and travels `>= 1.90` m at `v <= 2.60` m/s (`>= 0.7308` s), so `t_grab(m) >= (m - 1) · 1.60 + 0.7308` s and `M(t) <= floor((t - 0.7308) / 1.60) + 1 <= (t + 0.8692) / 1.60`. At `t = 90.0` s, `M(90) = floor(89.2692 / 1.60) + 1 = 56` parts (`m = 56` spawns at `88.00` s and reaches `GRAB_MIN` at `88.7308` s).
4. **Completed-robot bound `R(M)`:** blueprints require `3, 3, 4, 4, 4, 5, 5, ...` parts (cumulative thresholds `3, 6, 10, 14, 18, 23, 28, 33, 38, 43, 48, 53, 58`). For every `M >= 0`, `5 · R(M) <= M + 7`, so `200 · R(M) <= 40 · M + 280`; at `M = 56`, `R(56) = 12` robots (`53 <= 56 < 58`).
5. **Maximum score & rate envelope `B(t)`:** at `t = 90.0` s (`M = 56, R = 12`), `perfectBot` reaches the exact bound `score = 40 · 56 - 60 + 200 · 12 = 2180 + 2400 = 4580` (`96.4 %` of `maxScore = 4750`, `>= 90 %`). At any time `t >= 0`, `B(t) <= (40 · M(t) - 60) + (40 · M(t) + 280) = 80 · M(t) + 220 <= 80 · (t + 0.8692) / 1.60 + 220 = 50 · t + 263.46 < 50 · t + 264 <= 300 + 52 · t`. Thus `capScore` is a no-op on every run.

## Run end

- **Shift clock (`SHIFT_DURATION = 90.0` s):** `durationMs` is **omitted** on `GameDefinition`; `rules.ts` runs the 90 s clock itself (HUD stat `"Time"`, `"90s"` → `"0s"`) and ends at `90.0` s with `end("win")` when `robotsCompleted >= 5` (`WIN_QUOTA = 5`, `resultDelayMs: 1400` for the final walk-off + `cheerPose`) or `end("lose")` when `robotsCompleted < 5`. Grabbing a 3rd faulty part ends immediately with `"lose"` via `loseLife()`.
- **Changed from spec:** the spec uses `durationMs: 90000` (`"timeup"`). Driving the 90 s timer in `rules.ts` with a `WIN_QUOTA = 5` gives a win fanfare for active play while making `idleBot` / `spamScrapBot` fail with `"lose"` (see Open question A on whether to keep quota win or switch to `durationMs: 90000` `"timeup"`).

## Scene and camera

- **Fixed 3/4 view (`useFittedView` + static `<CameraRig>`):**
   - `definition.camera`: `{ position: [0, 7.2, 8.5], fov: 40, lookAt: [0, 0.75, 0.1] }`.
   - `useFittedView({ area: { min: { x: -3.0, y: 0, z: -1.1 }, max: { x: 3.0, y: 1.95, z: 1.3 } }, focus: [{ x: 0, y: 0.75, z: 0.1 }], pitch: 38 * DEG, yaws: [0], fov: 40, padding: 6, margin: { top: 0.02, bottom: 0.02, left: 0.02, right: 0.02 }, shift: true })`.
   - `<CameraRig camera={definition.camera} offset={view.offset} shift={view.shift} damping={5} />`.
   - **Verified `fitView` on-screen sizes (`>= 24 CSS px` at every viewport, no HUD/control overlap):**

| Element | World size | `390 × 844` (`fitView` dist `20.3 m`) | `844 × 390` banner open | `1280 × 800` |
|---|---|---|---|---|
| Smallest belt part (`head` / `cell` / `arm`) | `0.45 × 0.45 × 0.45 m` | **26.6 × 36.7 px** | **37.8 × 50.5 px** | 51.5 × 72.2 px |
| Torso part (`barrel` / `crate`) | `0.50 × 0.50 × 0.50 m` | **29.6 × 40.8 px** | **42.0 × 56.1 px** | 57.2 × 80.2 px |
| Sorter claw head | `0.55 × 0.50 × 0.55 m` | **32.5 × 39.2 px** | **46.2 × 54.0 px** | 62.9 × 77.2 px |
| Blueprint slot icon (×5) | `0.44 × 0.44 m` | **26.0 × 26.0 px** | **37.0 × 37.0 px** | 50.3 × 50.3 px |
| Assembled robot (`ASSETS.robot`) | `0.55 × 1.20 × 0.45 m` | **32.5 × 65.8 px** | **46.2 × 90.5 px** | 62.9 × 129.4 px |

- **Visual language & lighting:** `environment: { background: "#0f172a", fog: ["#0f172a", 24, 42], lighting: "indoor" }` (`fog` starts at `24 m`, beyond the `20.3 m` portrait `fitView` distance so the bay and belt are never fog-tinted). Floor grid in `#1e293b` with cyan grab-zone rails (`#7dd3fc`, emerald `#34d399` on grab, coral `#f87171` during lockout).
- **Changed from spec:** (1) `yaws: [0]` only instead of landscape + portrait yaws, because the belt runs along `x` between the back-wall blueprint board (`z = -0.95`) and front scrap bin (`z = 0.95`), and `yaw = 0` with `pitch = 38°`, `fov = 40°` over a `5.60 m` belt already gives `26.6 × 36.7 px` per `0.45 m` part on a `390 × 844` portrait phone; (2) steam vents dropped (`core/fx` provides `burst` pools `"sparks"`, `"puff"`, `"confetti"`, `"score"` rather than a continuous steam emitter).

## Core helpers used

`GameDefinition` (`lives: 3`, `resultDelayMs: 1400`, `touchControls: ["tap", "swipe"]`, `hudStats` Robots / Combo / Time, `camera`, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`tapDown`, `tap`, `pressed.down`, `jumpPressed`, `actionPressed`), `useFittedView` + `CameraRig`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `loseLife`, `end`), `core/path` (`createPath`, `pointAt`, `advance`), `core/kit` (`Conveyor`), `core/math` (`createRng`, `rngNext`, `randomSeed` in Scene only, `clamp`, `damp`), `core/limits` (`withinServerLimits`, `capScore`), `createArcadeStore` + `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`), `<Model fallback>`, `<DynamicInstancedModel tinted>`, `<DynamicInstanced tinted>`, `BlobShadow`, `useCanvasTexture`, `SHARED_ASSETS` (`robot`, `battery`, `crate`) + `REUSED_ASSETS` (`barrel`, `door`) + `ROBOT_LANDMARKS`, rig (`<HumanoidModel tint>`, `useHumanoidPose`, `walkPose`, `idlePose`, `cheerPose`, `reachPose`, `walkStride`, `bodyLift`), `core/fx` (`useFx`: `burst` sparks / puff / confetti, `score`, `shake`, `warm`), `useQuality`, perf probe `?perf=1`, `core/audio` (`playSfx`, `startLoop`). Nothing generic is built inside the game folder.

## Assets

Zero Class E assets (`05-hyper3d-catalog.md` §E.4 game 12: `0` dedicated GLBs). `assets.spec.json` has `"assets": []`. Fits live in `assets.ts` and are verified on the real GLBs in `assets.test.ts`; every prop stays inside `area` (`x ∈ [-3.0, 3.0]`, `y ∈ [0, 1.95]`, `z ∈ [-1.1, 1.3]`).

| id | class / source | target in game & position (inside `area`) | rules footprint | fallback |
|---|---|---|---|---|
| assembled robot | D `SHARED_ASSETS.robot` (`<HumanoidModel tint>`) | `1.20 m` tall (`scale 0.698`) | cradle `(1.35, 0, -0.45)` → door `(2.40, 0, -0.45)` | box torso + head + limbs |
| torso (`barrel`) | D `REUSED_ASSETS.barrel`, `<DynamicInstancedModel tinted>` (max 8) | `0.50 × 0.50 × 0.50 m` | belt `s`, hit radius `28 CSS px` | cylinder |
| torso (`crate`) | D `SHARED_ASSETS.crate`, `<DynamicInstancedModel tinted>` (max 8) | `0.50 × 0.50 × 0.50 m` | belt `s`, hit radius `28 CSS px` | box |
| power cell (`battery`) | D `SHARED_ASSETS.battery`, `<DynamicInstancedModel tinted>` (max 8) | `0.45 × 0.45 × 0.45 m` | belt `s`, hit radius `28 CSS px` | cylinder + cap |
| exit door | D `REUSED_ASSETS.door` (`REUSED_GLB_SIZE.door`) | `1.00 × 1.85 × 0.20 m` at `(2.40, 0, -0.45)` (`x ≤ 2.90, y ≤ 1.85`) | walk-off target `(2.40, 0, -0.45)` | box frame + slab |
| head parts (`dome`, `box`, `antenna`) | B procedural `<DynamicInstanced tinted>` (max 8 each) | `0.45 × 0.45 × 0.45 m` | belt `s`, hit radius `28 CSS px` | (is code) |
| arm parts (`claw`, `wrench`, `drill`) | B procedural `<DynamicInstanced tinted>` (max 8 each) | `0.45 × 0.45 × 0.45 m` | belt `s`, hit radius `28 CSS px` | (is code) |
| conveyors (`MAIN_BELT`, `FEEDER_BELT`) | B `core/kit` `<Conveyor>` | `5.60 × 0.80 m` & `1.66 × 0.65 m` | paths in `rules.ts` | (is code) |
| blueprint screen, gantry, claw, sweeper, cradle, bin | B procedural (`Bay.tsx`, `BlueprintBoard.tsx`) | screen `2.60 × 0.85 m` at `(0, 1.45, -0.95)` (`x ∈ [-1.30, 1.30], y ∈ [1.025, 1.875]`), gantry `y = 1.85 m`, claw `0.55 × 0.50 m` | grab zone `s ∈ [1.90, 3.70]` m | (is code) |

## Files

`meta.ts` (metadata, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (paths, fixed-lattice stream generator, blueprints, grab/scrap/exit resolution, walk-off state, shift clock, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `robotWalkOffPose(t, out)` blending `walkPose` + `reachPose` wave, `cradleBuildPose(stepCount, out)`; tested in `poses.test.ts` via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits and bounding-box checks on the real GLBs) · `Scene.tsx` (single `useRunFrame`, camera, `tapDown` target lock + `tap` / `pressed.down` dispatch, fx, audio) · `Bay.tsx` (`Conveyor` belts, overhead gantry + claw, sweeper arm, assembly cradle, scrap bin, exit door) · `PartsAndRobot.tsx` (`DynamicInstancedModel` / `DynamicInstanced` belt parts, needed-part highlight ring, cradle stack, rigged walking robot) · `BlueprintBoard.tsx` (back-wall blueprint screen at `(0, 1.45, -0.95)`, 5 slot silhouettes + checkmarks, strike LEDs) · `assets.spec.json` · `README.md` · `public/images/3d/robot-factory.webp` · `tools/thumbs/inputs/robot-factory.mjs`.

## Test plan

`rules.test.ts` ≤ 600 lines (K.4), whole file `< 60 s`, behaviour over branches, using `core/testing/botHarness.ts`:

- **Tuning pins:** `BELT`, `STREAM`, `BLUEPRINT`, `CLAW`, `SCORING`, and `SHIFT` constants match their literal design values.
- **Stream & fairness across 1,000 seeds:** deterministic per seed; needed part `m` spawns on the fixed `(m - 1) · 1.60` s lattice with one non-needed slot at `+0.80` s; a missed/scrapped needed part is replaced at the next lattice slot so the next needed part enters `GRAB_MIN = 1.90 m` within `<= 4.0` s (`<= 2.91 s`); **no non-needed part ever matches any step `(kind, colour)` of the current or next blueprint**; inter-part gap `>= 0.95 m` at spawn and across the `60 s` `FEEDER_BELT` merge; 3rd faulty part never reaches `GRAB_MIN` before `10.331 s`.
- **Blueprint, actions & double-strike consumption test:** `3 → 4 → 5` progression; valid grab has `0 s` logic lockout, awards `20 + 4 · c_i`, and on the final step awards `+200` and finishes the `0.70 s` walk-off before the next blueprint's first part can land (`>= 0.73 s`); wrong grab or clean scrap resets `comboSteps = 0` and sets `clawLockout = 1.00 s`; **grabbing a faulty part consumes it from the belt (cannot be grabbed twice, so 3 strikes require 3 distinct faulty parts and `durationMs >= 10331 ms`)**; scrapping a faulty part preserves `comboSteps` with `0 s` lockout.
- **Scoring + server-limit proof (5 bots × 200 seeds through `createArcadeStore()` + `simulateRun` at 30 / 60 / 144 Hz + `randomFrames(seed, 4, 50)`):**
   1. `perfectBot`: wins every seed with `M = 56, R = 12, score = 4580 >= 0.90 * 4750` (`96.4 %` of proposed `maxScore`), `withinServerLimits` true (provisional and proposed `4750 / 10000–92000 / 300 + 52/s`), `capScore` is a no-op, frame-rate invariant.
   2. `goodBot` (~85 % accuracy): wins at `90000 ms`, passes `withinServerLimits`.
   3. `blindBot` (blueprint-blind: grabs every non-faulty part, scraps every faulty part): `1.00 s` wrong-grab lockout holds it to `<= 50 %` of `perfectBot` (or fails the 5-robot quota) across all 200 seeds.
   4. `spamGrabBot` / `spamScrapBot`: `spamGrabBot` loses on 3 distinct faulty parts at `durationMs >= 10331 ms`; `spamScrapBot` loses at `90000 ms` with `0` pts; both pass `withinServerLimits`.
   5. `idleBot`: loses at `90000 ms` (`robotsCompleted = 0 < 5`).
- `poses.test.ts` / `assets.test.ts`: robot soles within 1 cm of the floor during walk-off; `reachPose` wave stays in bounds; fitted sizes of `robot`, `barrel`, `crate`, `battery`, `door` match the table.

## Performance

Target **≤ 40** draw calls (spec §12.18; hard cap 150); triangles ≤ **45k** (cap 150k). Estimate: floor + grid 2, main + feeder `<Conveyor>` 4, gantry + claw + sweeper 4, cradle + scrap bin + exit door 4, blueprint board + 5 slot icons + strike LEDs 8, instanced GLB parts (`barrel`, `crate`, `battery`) 3, instanced procedural parts (`head` ×3, `arm` ×3) 6, needed-part highlight + cradle sub-assembly + walking `<HumanoidModel>` 3, blob shadows 1, fx pools (`sparks`, `puff`, `confetti`, `score`) 4 → **35–39 draw calls (≤ 40)**. Lights: `indoor` preset only. Pools warmed at mount (`fx.warm("sparks", "puff", "confetti", "score")`); zero per-frame allocations in `useRunFrame`. On `useQuality().tier === "low"`, background decor pillars hide and throttled faulty-part spark bursts halve rate (`0.36 s` vs `0.18 s`) while keeping the red `!` chevron and blink.

## Audio

Uses `core/audio` (`playSfx`, `startLoop`): `startLoop("belt", { volume: 0.22 })` during play (retuned via `loop.set({ pitch: 0.95 + 0.15 * (v - 1.45) / 1.15 })`); valid grab `playSfx("pickup", { pitch: 1.0 + 0.06 * comboSteps })` + `"click"` on cradle snap; robot completed `playSfx("chime")` + `playSfx("combo")`; wrong grab or clean-part scrap `playSfx("buzz")` + `playSfx("thud", { volume: 0.45 })`; faulty grab strike `playSfx("zap")` + `playSfx("hit")`; faulty scrap `playSfx("whoosh")` + `playSfx("thud")`; belt-exit zap `playSfx("zap", { volume: 0.35 })`.

## Accessibility

Every part's role is redundant across **three channels**: (1) distinct 3D silhouette (`barrel`/`crate` torso, `battery` cell, `dome`/`box`/`antenna` head, `claw`/`wrench`/`drill` arm), (2) high-contrast colour (`#7dd3fc`, `#fbbf24`, `#f87171`, `#a3e635`), and (3) matching slot position + shape icon on the blueprint board (`1..5` left-to-right with checkmarks). **The currently needed part is highlighted on the belt** with a pulsing cyan selection ring under the part (`#7dd3fc`). Faulty parts combine throttled `"sparks"` bursts, an orange/red blink, and a floating red `!` chevron badge (`>= 24 px`). Slower first robot (`1.45` m/s). Keyboard (`Space` + `S`/`Down`) and touch/mouse (`tapDown`/`tap` + swipe down) have full parity; `fx.shake` respects `prefers-reduced-motion`.

## Risks and open questions

- **Open questions (user / Claude decisions — not decided here):**
   1. **A — Quota win vs spec's `timeup`:** keep the game's own 90 s clock with `end("win")` at `robotsCompleted >= 5` and `end("lose")` below 5 (note: without `durationMs`, GameShell shows a `"Played"` chip next to the game's `"Time"` HUD stat), or use `durationMs: 90000` with `"timeup"` as the normal end (like `dino-egg-rescue`)?
   2. **B — Wrong-grab penalty strength:** is the `1.00 s` `clawLockout` (+ `comboSteps = 0`) on a wrong grab / clean scrap sufficient alone, or should wrong grabs also carry a stronger penalty?
   3. **C — Measured GLB size constants:** add `SHARED_GLB_SIZE` (`robot`, `battery`, `crate`) and `REUSED_GLB_SIZE.barrel` to `core/sharedAssets.ts`, or keep those fits local in `robot-factory/assets.ts`?

## Status

```text
HANDOFF P-14 (Gate G0 design)
Branch: antigravity/design-robot-factory
Files changed: play50games-frontend/src/arcade3d/games/robot-factory/README.md, play50games-frontend/src/arcade3d/games/robot-factory/assets.spec.json
Scoring formula: sum(20 + 4 * c_i) + 200 * R (perfect: 40 * M - 60 + 200 * R); proven max 4580; proposed limits 4750, 10.0-92.0 s, 300 + 52/s (provisional 6000, 10.0-92.0 s, 6000 + 6000/s).
Next gate: G0 review -> P-29 implementation.
```

## Fix round 1 (2026-10-24)

1. **Faulty part consumed on strike:** grabbing a faulty part removes it from the belt into the scrap bin so one part can never cause multiple strikes; added test that 3 strikes require 3 distinct faulty parts (`>= 10.331 s`).
2. **Fixed needed-part lattice (`1.60 s`):** needed part `m` spawns at `(m - 1) · 1.60 s` with one non-needed slot at `+0.80 s` and missed/scrapped replacement at the next lattice slot (`<= 1.60 s`, `< 4 s` rule holds), so `perfectBot` installs all 56 parts (`12` robots, `4580` pts = `96.4 %` of `4750`).
3. **Non-needed part disjointness:** no non-needed part ever matches any step `(kind, colour)` of the current or next blueprint (tested across 1,000 seeds), preserving `M(t)`.
4. **Wrong-grab lockout `1.00 s` & `blindBot`:** increased wrong-grab / clean-scrap lockout to `1.00 s` and added `blindBot` test (`<= 50 %` of `perfectBot` or fails quota over 200 seeds).
5. **Closed-form proof & proposed limits:** fixed `perfectScore(M, R) = 40 · M - 60 + 200 · R` (`M >= 5`), max `2180 + 2400 = 4580`, `B(t) <= 80 · M(t) + 220 <= 50 · t + 264 <= 300 + 52 · t`, proposed tight limits `4750 / 10000–92000 / 300 + 52/s` with margin table.
6. **`tapDown` target lock & CSS px radius:** target part is locked on `tapDown` within `28 CSS px` (`56 px >= 44 px`), grabbed on `tap`, and scrapped on `pressed.down` for that locked part.
7. **Portrait fog, core APIs, audio, bounds, walk-off, spec diffs & open questions:** moved fog start to `[24, 42]` (beyond `20.3 m` portrait `fitView`); fixed `lighting: "indoor"`, `fx.shake(0.3)`, throttled `fx.burst("sparks", ...)`, `Vector3.project(camera)`, `pointAt`/`advance`, `CameraRig camera={definition.camera}`, single `loseLife()` end, `startLoop("belt")` + valid `playSfx` cues; placed exit door `(2.40, 0, -0.45)` and blueprint screen `(0, 1.45, -0.95)` inside `area`; `0.70 s` walk-off clears cradle before `0.73 s` with visual-only claw lift; added `<= 40` draw-call target, belt needed-part highlight, 30/60/144 Hz + random bot tests (`< 60 s`), and open questions A/B/C.
