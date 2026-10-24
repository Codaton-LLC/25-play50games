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
     - At `t = 0` (`m = 1`), needed part `1` (matching robot `0` step `0`) is pre-placed on `MAIN_BELT` at `s_1 = 0.72` m (entering `GRAB_MIN = 1.90` m at `t_1 = (1.90 - 0.72) / 1.45 = 0.8138` s) (build: no pre-placed distractor, it sat 0.72 m behind part 1, under the 0.95 m gap; the first non-needed part spawns on the lattice at 0.80 s).
     - Every needed-part slot `m >= 2` (`1`-indexed) spawns on `MAIN_BELT` (`s = 0`) on the fixed lattice `t_spawn(m) = (m - 1) · 1.60` s (`1.60, 3.20, ..., 88.00` s), with **exactly one** non-needed slot at `(m - 1) · 1.60 + 0.80` s (`0.80` s half-period = `>= 1.16` m `>= 0.95` m at `v >= 1.45` m/s; from `t >= 60` s the `+0.80` s non-needed slot alternates onto `FEEDER_BELT`).
     - If a needed part is missed (`s_equiv > 3.70` m) or scrapped, the very next lattice slot (`<= 1.60` s later) re-spawns that step's needed part instead of advancing the blueprint stream cursor. Even at the slowest belt speed `1.45` m/s (`1.90 / 1.45 = 1.310` s to `GRAB_MIN`), the player never waits more than `1.60 + 1.310 = 2.910` s (`< 4.0` s) for the next needed part to enter the grab zone.
   - **Non-needed part disjointness rule (preserves `M(t)`):** no non-needed part (clean distractor or faulty part) ever matches `(kind, colour)` of **any** step in the **current or next** blueprint (`r` or `r + 1`; at most `10` of the `16` `(kind, colour)` pairs are excluded). Thus a distractor or bounced wrong part can never become a valid needed part when `stepIndex` or `robotsCompleted` advances.
   - **Faulty parts:** ~18 % of non-needed slots spawn with `faulty: true` (throttled `fx.burst("sparks", pos, 4)` + red `!` chevron + orange/red emissive blink). First faulty part spawns at `t >= FIRST_FAULT_MIN_T = 2.60` s (earliest non-needed slot `t = 4.00` s or `2.40` s clamped to `>= 2.60` s); faulty spawns are separated by `>= FAULT_MIN_INTERVAL = 3.50` s (`2.50` s after `t = 60` s). Thus the 3rd faulty part cannot spawn before `t >= 2.60 + 2 · 3.50 = 9.60` s and cannot enter `GRAB_MIN = 1.90` m before `t >= 9.60 + 1.90 / 2.60 = 10.331` s (`10.788` s at `v <= 1.60` m/s).
- **Actions, lockout & strikes (`CLAW`):**
   - While `clawLockout > 0`, grab and scrap inputs are ignored (`clawLockout = max(0, clawLockout - dt)`).
   - **Grab (`grabTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Needed & non-faulty:** part is removed from the belt; the claw's `0.14` s lift to the assembly cradle `(1.35, 0.35, -0.45)` is **visual only (`0` s logic busy time)**. Increments `partsInstalled`, awards `partPoints(comboSteps) = 20 + 4 · min(5, comboSteps)`, then sets `comboSteps = min(5, comboSteps + 1)`. If this completes the blueprint (`stepIndex + 1 == N`), awards `ROBOT_BONUS = 200`, increments `robotsCompleted`, immediately activates the next blueprint (`0` s logic lockout), and starts the finished robot's `0.70` s walk-off from `(1.35, 0, -0.45)` to the exit door `(2.40, 0, -0.45)` — clearing the cradle footprint within `0.30` s and finishing at `0.70` s, before the next blueprint's first needed part can ever land (`>= 0.73` s after completion).
     2. **Wrong kind/colour (non-faulty):** claw clanks, part bounces on the belt, `comboSteps = 0`, blueprint step resets to `0` (`stepIndex = 0`), `clawLockout = WRONG_LOCKOUT = 1.00` s (no strike). **Decision (user, 2026-10-24): 1 s lockout** — wrong grab locks for 1.0 s and resets the blueprint step, ensuring blueprint-blind grabbers and spam bots cannot complete robots without needing a long lockout. See Open question 1.
     3. **Faulty part:** part short-circuits on the claw (`fx.burst("sparks", pos, 14)` + `fx.shake(0.3)`) and is **consumed (removed from the belt into the scrap bin, so one faulty part can never cause two strikes)**; `strikes += 1`, `comboSteps = 0`, `clawLockout = 0.50` s, and `loseLife()` is called once (at `3` strikes `loseLife()` reaches `0` lives and calls `end("lose")` automatically — `Scene.tsx` never calls `end("lose")` a second time).
   - **Scrap (`scrapTriggered`) with target part in `[1.90, 3.70]` m:**
     1. **Faulty part:** sweeper knocks the part off the belt into the front scrap bin `(0.00, 0.20, 0.95)`, preserving `comboSteps` with `0` s lockout (`faultsScrapped += 1`).
     2. **Non-faulty part:** part is swept into the scrap bin, `comboSteps = 0`, `clawLockout = SCRAP_LOCKOUT = 1.00` s (no strike; if it was the needed part, the next lattice slot `<= 1.60` s later replaces it).
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

## Levels

One bay, five shifts (`levels.ts`). Level 1 is the shift above, unchanged. A level clears on a win (the robot quota). The shell clock stays off (`clockChip: false`, no `durationMs`): each level's clock is `level.duration`. Lighting stays `indoor` on every level. `PROPOSED_LEVEL_LIMITS` in `rules.ts` is the proof; `meta.scoring` (level 1) stays the provisional 6000 set until Claude copies it. Levels 2-5 in `meta.ts` already use their proposed limits.

| Level | Plan name | What changes from the previous level | Quota | Clock | Ceiling `M`, `R`, score | Proposed limits |
|---|---|---|---|---|---|---|
| 1 | Basic Sort | today's game | 5 | 90 s | 56, 12, **4580** | 4750 / 10000–92000 / 300 + 52/s |
| 2 | Shape Sort | `v1` 1.60 → 1.75, growth 1.04 → 1.05, feeder at 45 s | 6 | 120 s | 75, 16, **6140** | 6370 / 10000–122000 / 300 + 52/s |
| 3 | Color + Shape | feeder at 35 s, faulty chance 0.18 → 0.22 | 7 | 120 s | 75, 16, **6140** | 6370 / 10000–122000 / 300 + 52/s |
| 4 | Fast Factory | plan sorter: `vMax` 2.6 → 3.0, fault gap 3.5 → 2.8 s | 9 | 120 s | 75, 16, **6140** | 6370 / 8500–122000 / 300 + 52/s |
| 5 | Overdrive | plan sorter: period 1.6 → 1.4 s, half 0.8 → 0.7, faulty chance 0.25 | 11 | 120 s | 86, 18, **6980** | 7260 / 8500–122000 / 300 + 60/s |

`M(t) = 0` before the first part reaches the zone, else `1 + floor((t - GRAB_MIN / vMax) / period)`. `5 R <= M + 7` still, so `B(t) <= 80 M(t) + 220`. With travel `T = 1.9 / vMax` and period `P`, `M(t) <= (t - T) / P + 1`, so `B(t) <= (80 / P) t + 300 - 80 T / P`.

- **L1** (above): `P = 1.6`, `vMax = 2.6`, `B <= 50 t + 264 <= 300 + 52 t`. Earliest loss `2.6 + 2 · 3.5 + 1.9 / 2.6 = 10.331 s`.
- **L2 and L3** keep `P` and `vMax`, so the same rate holds out to 120 s. `M(120) = 75`, `R = 16`, `perfectScore = 6140` (`96.4 %` of 6370). Feeder time and fault chance do not raise `M(t)`: a distractor still cannot match the current or next blueprint. Earliest loss stays 10.331 s.
- **L4** raises `vMax` to 3.0. Travel falls to `1.9 / 3 = 0.633 s`, and the rate constant rises to `50 t + 268.3`, still under `300 + 52 t` (checked every 10 ms). The extra speed does not reach a 76th part by 120 s, so the ceiling stays 6140. Earliest loss `2.6 + 2 · 2.8 + 1.9 / 3 = 8.833 s`, so `minDurationMs` is 8500 (333 ms under, inside 5 %).
- **L5** shortens the lattice to 1.4 s. `80 / 1.4 = 57.14`, and `B(t) <= 57.14 t + 263.8 <= 300 + 60 t` (60 is 5 % over 57.14). `M(120) = 86`, `R = 18`, `perfectScore = 6980` (`96.1 %` of 7260, and `6980 <= 3 · 4580`). `half · v0 = 0.7 · 1.45 = 1.015 >= 0.95`. Earliest loss is 8.833 s again (same fault gap and top speed as L4).

A missed part is replaced within `period + 1.9 / 1.45` s: 2.91 s on levels 1-4 and 2.71 s on level 5, both under 4 s. The grab zone is 1.8 m, so at 3.0 m/s a part dwells 0.60 s. `WRONG_LOCKOUT` stays 1.0 s on every level (the 2026-10-24 decision): 1.0 s still outlasts that dwell, so the backlog's 2.1 → 2.4 step is not applied.

**Plan sorter (levels 4-5), adapted to the built bay.** The plan's coloured bins, parallel stations and walking robot are not in the rules. The cradle is the match and the scrap bin is the reject; "sort N parts" is the robot quota (20 / 28 / 38 / 50 parts → 6 / 7 / 9 / 11 robots; level 1 stays 5). Plan timers of 150-210 s are cut to 120 s so the ceiling stays provable. Same assets, same input timing for touch and keyboard.

The oracle (30 seeds, 30 / 60 / 144 Hz) hits each ceiling exactly. A human-paced bot (200 seeds, the same 150-250 ms bot as level 1) won 200 / 200 on every level (mean 4452 / 6069 / 6064 / 6009 / 6754). Idle scored 0 and never cleared.

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

`meta.ts` (metadata, scoring, five level titles and limits) · `index.tsx` (`GameDefinition`, level specs) · `levels.ts` (the five shift configs) · `levels.test.ts` · `rules.ts` (paths, fixed-lattice stream generator, blueprints, grab/scrap/exit resolution, walk-off state, shift clock, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `robotWalkOffPose(t, out)` blending `walkPose` + `reachPose` wave, `cradleBuildPose(stepCount, out)`; tested in `poses.test.ts` via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits and bounding-box checks on the real GLBs) · `Scene.tsx` (single `useRunFrame`, camera, `tapDown` target lock + `tap` / `pressed.down` dispatch, fx, audio) · `Bay.tsx` (`Conveyor` belts, overhead gantry + claw, sweeper arm, assembly cradle, scrap bin, exit door) · `PartsAndRobot.tsx` (`DynamicInstancedModel` / `DynamicInstanced` belt parts, needed-part highlight ring, cradle stack, rigged walking robot) · `BlueprintBoard.tsx` (back-wall blueprint screen at `(0, 1.45, -0.95)`, 5 slot silhouettes + checkmarks, strike LEDs) · `assets.spec.json` · `README.md` · `public/images/3d/robot-factory.webp` · `tools/thumbs/inputs/robot-factory.mjs`.

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

## Build notes (P-18, 2026-10-24)

- Files: `rules.ts` (+ `syncStore`, the store calls Scene and the bot tests share), `look.ts` (claw / flyer / cradle looks, pure), `Scene.tsx`, `Bay.tsx` (static bay merged into one mesh, belts, all emissive strips and lamps in one instanced mesh, claw, sweeper, door), `Parts.tsx` (one pool per silhouette for belt, flyers and the cradle build; rings, "!" badges, belt shadows), `Robot.tsx`, `BlueprintBoard.tsx` (one canvas, redrawn on change), `partShapes.ts`, `palette.ts`, `poses.ts`, `assets.ts`; tests `rules.test.ts`, `assets.test.ts`, `poses.test.ts`.
- Changed from the design: wrong-grab lockout `1.00` s with blueprint step reset (Decision user, 2026-10-24: 1 s lockout); no pre-placed distractor (above); each `(kind, colour)` pair has one silhouette (`SHAPE_OF`), so the blueprint icon is the part; the walk-off uses `walkPose` amount 0.5 (0.75 lets the feet fly) with a 3.2 /s cadence cap; on a win the robot cheers beside the door; GLB torso / cell parts use a white satin shell (`PART_SHELL`) so the tint reads true.

## Status

```text
TASK P-18-robot-factory | build robot-factory | branch claude/game-robot-factory | allowed: play50games-frontend/src/arcade3d/games/robot-factory/**, play50games-frontend/public/images/3d/robot-factory.webp, tools/thumbs/inputs/robot-factory.mjs

Branch check: `git branch --show-current` = claude/game-robot-factory. Built by Claude (Kimi ran out of quota before writing code).

Files (all new unless noted), in play50games-frontend/src/arcade3d/games/robot-factory/:
- index.tsx (replaced the stub), rules.ts, rules.test.ts, assets.ts, assets.test.ts, poses.ts, poses.test.ts
- Scene.tsx, Bay.tsx, Parts.tsx, Robot.tsx, BlueprintBoard.tsx, look.ts, partShapes.ts, palette.ts
- README.md (build notes, open questions, Status); meta.ts and assets.spec.json unchanged
- tools/thumbs/inputs/robot-factory.mjs; thumbnail left null (no browser run)

Acceptance checklist:
- [x] GameDefinition: Scene, assets, lives 3, resultDelayMs 1400, clockChip false, no durationMs (own 90 s clock), camera, environment (indoor, fog 24-42), touchControls tap + swipe, hudStats Robots / Combo / Time, 3 instruction lines. No touch buttons, so no touchLabels.
- [x] rules.ts pure and seeded (rngNext only), every gameplay number there; PROPOSED_LIMITS exported; the store calls live in syncStore (shared by Scene and the bot tests).
- [x] Scene: run state via useState, one useRunFrame (input -> stepRun -> syncStore -> fx / sfx), visuals read the run in useFrame with useGameTime; no setState or allocation in frame callbacks (belt speed re-renders from the "robots" store stat); pools updated in the frame loop, no JSX map over run state.
- [x] Input: tapDown locks the grab-zone part within 28 CSS px (Vector3.project), tap grabs it, pressed.down (S / Down / swipe down) scraps it; Space / E / Enter grab the part nearest the claw. No double action.
- [x] Camera: useFittedView (README area, pitch 38 deg, yaw 0, shift) + static CameraRig at focus + offset.
- [x] Models: robot (HumanoidModel + useHumanoidPose, walkPose by stride + cadence cap, bodyLift on the group, wave via reachPose on the right arm, cheerPose on a win), barrel / crate / battery as tinted DynamicInstancedModel pools fitted from SHARED_GLB_SIZE / REUSED_GLB_SIZE.barrel, door from REUSED_GLB_SIZE.door; every one has a procedural fallback. Size tests on the real meshes (assets.test.ts) and soles-on-floor tests through the walk-off and the cheer (poses.test.ts, rigCharacter).
- [x] Look: one COLORS palette, SkyDome, rim-lit conveyors (emissive strips), grab-zone rails that flash green on a fit and pulse coral during a lockout, gantry beacons, cradle progress LEDs, door glow, sparks on every part fitted to the cradle, confetti + "+200 ROBOT!" per finished robot, camera shake on strikes, floating scores, eased claw dip / carry, sweeper, lifting exit door, "!" badges and blinking tint on faulty parts.
- [x] Audio: belt loop restarted on [phase, muted], pitch per belt speed; cues per event as in the README.
- [x] end("win" | "lose") only; no submitScore / API / localStorage. Status stays "dev"; meta.scoring unchanged (provisional).
- [x] `npx tsc --noEmit` clean; `npx vitest run src/arcade3d/games/robot-factory`: 3 files, 31 tests, all pass, about 42 s.
- [ ] Not run here (low-memory machine, by instruction): npm run build, dev server, browser playtest, screenshots, perf probe, tools/gamecheck, thumbnail capture.

Scoring and limit proof (README "Server limits and why they hold"):
- score = sum over installed parts of (20 + 4 * min(5, combo)) + 200 per robot; perfect = 40 M - 60 + 200 R (M >= 5).
- Only needed-lattice parts can be installed (distractors never share a (kind, colour) pair with the current or next blueprint: tested over 1,000 seeds), at most one per 1.60 s slot reaching the zone at <= 2.60 m/s: M(t) <= floor((t - 0.731) / 1.60) + 1, M(90) = 56; R(56) = 12; 5 R <= M + 7.
- B(t) <= 80 M(t) + 220 <= 50 t + 264 <= 300 + 52 t for every t (checked every 10 ms over 0-90 s); max 4580.
- Earliest end: 3 strikes need 3 distinct faulty parts (consumed on grab), the 3rd cannot reach the claw before 2.6 + 2 x 3.5 + 1.9 / 2.6 = 10.331 s.
- Proposed limits: maxScore 4750, minDurationMs 10000, maxDurationMs 92000, base 300, maxPointsPerSec 52 (provisional on main: 6000 / 10000-92000 / 6000 / 6000).

Bot results (real store via simulateRun = advanceRunClock + playedFrameDt):
- Oracle, 200 seeds (30 / 60 / 144 Hz fixed and random 4-50 ms frames): wins every seed, exactly 56 parts, 12 robots, 4580 (96.4 % of 4750), capScore a no-op.
- Human-like (reaction 150-250 ms, 8 % slow 400-600 ms, 6 % mis-aim onto a neighbour, 5 % of faults overlooked), 200 seeds: 200 / 200 wins, median 4520 (98.7 % of the oracle), mean 4452 (97.2 % of oracle; test bounds: >= 196 wins, mean > 60 %).
- Blueprint-blind (grabs every clean part, scraps every fault), 150 seeds: median 616 (13.4 %), max 696 (15.2 %), 0 / 150 wins; test bound <= 40 %.
- Spam grab (Space every frame), 200 seeds: median 220 (4.8 %), max 500 (10.9 %), 0 / 200 wins; mash (grab / scrap alternating): median 540 (11.8 %), max 1108 (24.2 %), 0 / 200 wins; spam scrap and idle: 0 points, lose. Every run ends >= 10.331 s and passes withinServerLimits.

Draw calls (estimate, not measured): sky 1, floor 1, static bay 1, belts 4, emissive lights 1, claw 3, sweeper 2, door 1, board 1, part pools 1 per shape on screen (usually 5-7 of 9), rings 1, badges 1, belt shadows 1, robot 2 while shown, fx pools 2-4, score sprites 1-3 => about 30-38 in play, worst case about 45 with all 9 shapes, the robot and 8 score popups at once (README target 40, hard cap 150). One extra light (a cyan point light over the belt).

Open questions:
1. WRONG_LOCKOUT: Resolved by Decision (user, 2026-10-24): 1 s lockout. Instead of a 2.10 s lockout, WRONG_LOCKOUT is 1.00 s, with a wrong grab resetting the blueprint step (`stepIndex = 0`) and bouncing the part back onto the belt. With this non-time penalty, blueprint-blind grabbers earn only median 616 pts (13.4 % of oracle, 0 wins), spam-grab earns median 220 pts (4.8 % of oracle, 0 wins), and mash earns median 540 pts (11.8 % of oracle, 0 wins), while human-like play achieves median 4520 pts (98.7 % of oracle, 200/200 wins).
2. The pre-placed distractor at s = 0.00 was dropped: it sat 0.72 m behind needed part 1, under the 0.95 m minimum gap. The first non-needed part now spawns on the lattice at 0.80 s.
3. Each (kind, colour) pair has exactly one silhouette (e.g. sky torso = barrel, amber torso = crate), so a part matching kind and colour also matches the blueprint icon's shape. The design allowed any variant per pair.
4. The human-like bot wins 100 % at about 98 % of the oracle: the ring under the wanted part makes the game easy for an attentive player. Fine for a "difficulty 1" skill game, or should the belt start faster?
5. Spam-grab survives the 90 s shift (5 robots) on about 8 % of seeds; faults are the only threat to it. Acceptable, or raise FAULTY_CHANCE / lower the quota pressure?
6. The robot cheers on the floor beside the door on a win (not on the cradle, where the next build's parts stand).
7. Needs Claude's playtest: the fit at 390 x 844 / 844 x 390 with the banner open (README's numbers, not re-measured), draw calls in ?perf=1, the thumbnail, and whether the GLB parts read well with the white satin shell + tint (the GLBs' own textures are replaced by PART_SHELL so the four colours read true).
No core change needed.
```

## Decisions (user, 2026-10-24)

The user approved this design and asked Claude to settle every open question with a modern, fair arcade feel in mind. These answers override the Open questions above; the build follows them.

- **Core (Claude adds before the builds):** a points game that ends on `"timeup"` with a score above 0 plays the win cue and confetti like a finish, not the lose sting; `GameDefinition.clockChip: false` hides the shell's Played chip for games that show their own clock.
- A: quota win on the game's own 90 s clock (`end("win")` at >= 5 robots, `end("lose")` below), Played chip hidden with core `clockChip: false`.
- B: Decision (user, 2026-10-24): 1 s lockout — after a wrong grab, robot-factory locks the claw for 1.0 s (`WRONG_LOCKOUT = 1.0`), resets combo, and resets blueprint `stepIndex = 0` (dropping the part back with hop bounce). This non-time penalty keeps blind/spam bots far below human players (blind max 696 pts / 0 wins vs human mean 4452 pts / 200 wins) while preserving the fast, responsive 1.0 s lockout feel. PROPOSED_LIMITS are unchanged (oracle score 4580, maxScore 4750, minDurationMs 10000, maxDurationMs 92000, base 300, maxPointsPerSec 52).
- C: Claude adds `SHARED_GLB_SIZE` (robot, battery, crate) and `REUSED_GLB_SIZE.barrel` to core/sharedAssets.ts before the build.
- Modern look: clean factory with rim-lit conveyors, emissive status lights, sparks on assembly, confetti on each finished robot.
