# Pigeon Crossing

Owner: **Codex**. Slug: `pigeon-crossing`, game 4. Accent `#a78bfa`. **PREP ONLY:** this README and `assets.spec.json` specify the future implementation; existing `meta.ts`/`index.tsx` remain unchanged and `status: "soon"`. Scene, rules, tests, models and thumbnail are not implemented by this preparation branch.

| File | What it owns |
|---|---|
| `meta.ts` | Existing card/controls/scoring data, server-safe; numeric limits equal `arcade-games.json`. |
| `index.tsx` | Existing placeholder; planned `GameDefinition` with Scene, assets, camera, 30-minute cap and Level HUD stat. |
| `rules.ts` | Planned pure `createRun(seed)` / `step(state, dt, input)`: grid hops, one queued hop, seeded traffic, continuous collisions, progress and scoring. |
| `rules.test.ts` | Planned Vitest for traffic/fairness, input, collisions, phase timing and the scoring proof. |
| `Scene.tsx` | Planned random seed on mount, first-child Simulation, input adapter, store actions and visual state. |
| `Primitives.tsx` | Planned road/grass/curbs/markings, pigeon/vehicle fallbacks and blob shadows. |
| `camera.ts` | Planned three-quarter forward-scroll fit to the active lanes, HUD and touch-safe screen area. |
| `assets.ts` / `assets.spec.json` | Planned `ModelAsset` mappings / the four models this game generates. |

### What a new game copies from here

- Follow robot-collector on main: this file split and README sections, plain metadata, core `GameDefinition`, pure seeded rules and tests proving server limits. Never import another game's rules, scene or camera code.
- Create run state once in Scene's lazy `useState` initializer, then render `<Simulation />` **first** before visuals. It calls `useRunFrame` → `step(state, dt, input)` → store actions. Visuals read the state; no setState/allocations in the loop. Use `useInput`, core collision helpers, `useModel`/`Model`, `playSfx` and shell-owned submission.
- Apply the timing/seed contracts in `origin/cursor/game-penalty-hero`'s README: fresh uint32 per Scene mount, mulberry32 in pure rules, dt-only timers/animations and the single 50 ms untimed countdown-frame allowance. Asset seed is unrelated to gameplay seed.
- Recheck `CLAUDE.md` and `core/` before implementation. Current main has no shared pause-safe game clock, simulation-first priority option or free-screen camera-fit helper. Until provided, keep local `run.time`, first-child Simulation and the fit below; adopt the shared helpers when they exist instead of copying reference-game implementations.
- Do not copy warehouse layouts, textures, follow yaw, battery effects or scoring. Stadium/warehouse decorations have no role here. Copy a generic utility only when needed and still absent from core; fall back to street primitives when `useModel(asset).failed` is true.

## Concept

A brave vinyl-toy pigeon hops across traffic in seven columns. Read approaching cars/taxis/vans, wait on grass and commit to short crossings. Each far-side arrival starts another faster/denser level. V1 uses **road and grass only**: logs/water would introduce drifting support and a second failure model without improving the central traffic-reading challenge.

Survival continues until a vehicle hit, with a defined **30-minute run cap** to respect the server duration window. There is no short round timer, life system, invulnerability pickup or automatic forward movement. At the cap GameShell ends with `"timeup"`; a hit ends with `end("lose")`. Completing a level does not end the run.

## Controls

Matches existing metadata: scheme `"hop"`, "Arrows / WASD to hop", "Swipe or tap to hop". Planned `touchControls: ["swipe", "tap"]` needs no joystick/action buttons.

- Keyboard: one hop for a new threshold crossing of `moveX`/`moveY` beyond ±0.5. Neutral is [-0.5, 0.5]; holding a direction does **not** repeat. Update latches every simulation frame, including during a hop/start hold. A return through neutral rearms it; switching sign gives one new edge. Vertical wins simultaneous axis crossings; no diagonals. Up/`moveY < -0.5` moves forward, down backward, left/right one column.
- Touch: `input.swipe` up/down/left/right maps to the same grid hops. `input.tap` means **one forward hop**, irrespective of tap coordinates; tiles are not individual tap targets. A swipe wins if both swipe and tap are reported. Touch events originate on the canvas, not shell buttons/overlays.
- Read only `useInput().current`. At rest start one valid hop. During a hop store at most **one queued direction**; first pending edge wins, later events are discarded until it is consumed. The same edge cannot be used twice. No wall-clock input buffer or browser key-repeat handlers.
- Reject moves outside columns 0..6 or backward past the current level's start. Invalid moves earn nothing. On collision/end clear the queue; do not chain it after death or a level transition. A fresh edge is needed after the initial start hold; held keys do not auto-launch.
- Esc/P, hidden tab and blur pause through GameShell. Pause stops traffic and the mid-hop position too.

## Rules

World units are metres, +y up; forward advances a row along **-z**, cars move along ±x. Seven column centres are x = -4.8, -3.2, -1.6, 0, 1.6, 3.2, 4.8.

- Each level has **20 new rows** beyond its start: row 0 is safe; grass rows are **0, 3, 6, 9, 12, 15, 18, 20**. Other rows are roads: six two-road groups and the final single road. Row 20 is the far-side grass. Consecutive grass boundaries give somewhere safe to wait for every road group.
- Each accepted hop moves exactly one cell in **550 ms simulation time**, with linear ground x/z interpolation and a visual 0.25 m arc. Collision uses the ground position throughout: jumping is not invulnerability. No mid-hop steering, cancellation or shorter reduced-motion hop. Consume remaining dt across hop boundaries without double-counting; every new hop requires its own 550 ms before landing/points.
- Advance traffic and pigeon together and use continuous/swept collision over each substep, including takeoff, flight and landing. Pigeon footprint against vehicle AABB touching is a hit. Collision takes precedence over landing points/level completion on the same instant. Vehicles cannot tunnel between frame endpoints.
- Start each run with a **3050 ms protected grass preview**, counted as playing time: no hop, queue or collision before it expires. Traffic/visual time advances normally; show "Watch the gaps". This guarantees a ranked loss is not submitted below the 3000 ms server minimum after the untimed-frame allowance. The shell's 3-2-1 countdown is separate and not submitted time.
- A new furthest row reached **on a surviving landing** pays 10; backtracking/lateral hops or revisiting rows do not. A far-side landing pays that row's 10 plus **100 level bonus** once, then increments Level. The shared boundary grass is the next level's row 0 and pays no extra points. Block retreat into completed levels to prevent bonus farming.
- Levels occupy consecutive world rows (no teleport). Generate the next level's preview traffic before it enters the camera window, using the same absolute simulation time before/after activation; entering it cannot spawn a car suddenly. Reset only its local furthest-row mark, not the run clock/total progress. Keep a bounded lane/vehicle pool around the camera.
- Seed generation is in Scene on each mount: lazy `useState(() => createRun(crypto.getRandomValues(new Uint32Array(1))[0]))`. Rules take that seed as a parameter and use **mulberry32**; no `Math.random` or global random source inside rules. Derive each level's stream from `(seed ^ Math.imul(level, 0x9e3779b9)) >>> 0`, with a stable generation order. Integer vehicle-kind weights car:taxi:van = 4:2:1; phases/start offsets use integer milliseconds. Seed plus the same dt/input timeline reproduces traffic and collisions.

### Constants and traffic fairness

Let difficulty tier `d = min(level, 10)`, with level starting at 1. Levels 1–10 get faster/tighter; later levels retain the tested maximum rather than becoming impossible.

| Constant | Value / rule |
|---|---|
| Columns / column pitch | 7 / 1.60 m; playable x edges ±5.60 |
| Rows per level / lane width | 20 forward rows / 1.80 m along z; one level spans 36 m |
| Hop duration / visual height | **0.55 s** / 0.25 m; all directions, queued or not |
| Initial protected start | **3.05 s**; only once per run |
| Pigeon model / collision | About 1.0 m tall; ground AABB **0.56 x × 0.50 z** (half extents 0.28 / 0.25) |
| Car hit box / speed | **2.80 x × 1.15 z**; `min(8, 3.0 + 0.6*(d-1))` m/s |
| Taxi hit box / speed | **3.10 x × 1.20 z**; `min(8, 3.4 + 0.6*(d-1))` m/s |
| Van hit box / speed | **3.80 x × 1.30 z**; `min(8, 2.6 + 0.6*(d-1))` m/s |
| Bumper gap inside a pack | `g = 3.0 - 0.2*(d-1)` m, **3.0 down to 1.2** |
| Pack size per road/cycle | `1 + floor((d-1)/3)`, **1 up to 4** |
| Spawn headway | At least `(3.8 + g) / laneSpeed` seconds between pack members; no overlap |
| Traffic cycle / clear window | **12 s**, with the complete play width empty in phases **[9, 12)** of each road group's cycle |
| Spawn/despawn outside edge | Vehicle centre at x = ±`(5.6 + length/2 + 0.4)`, travelling across; never teleport through play |
| Gameplay cap | `definition.durationMs = 1800000`; no extra game timer |

Each two-road group shares one seeded cycle phase, while directions alternate. A lane has one seeded vehicle kind and constant tier speed. A pack's starting offset is drawn in integer ms from 0 through `floor(1000 * min(2, 9 - travelTime - (packSize-1)*headway))`, where `travelTime = 2*(5.6 + length/2 + 0.4)/speed`. This upper bound must be nonnegative and every member's trailing edge must be off the playable width by phase 9. No spawning in the clear window. Apply the same rule to the final single road.

**There is always a passable gap:** during the shared 3 s clear window, both roads are empty across **all seven columns**. From preceding grass, three forward hops reach the next grass in 1.65 s; even allowing a 0.35 s reaction plus three 0.05 s frame/input delays, this is **2.15 s**, leaving **0.85 s margin**. The final single-road crossing needs only two hops. Safe grass can be waited on indefinitely until this window repeats; future levels use the same guarantee. Seed can change appearance, direction and timing, never remove the window.

The generator validates pack spacing/exit deadlines and the shared-window invariant; a deterministic one-car-per-cycle fallback with start offset 0 preserves them if validation fails. Do not silently emit a blocked layout. Tests must additionally find a time-expanded path through every level and check continuous collision along its hops. Fairness guarantees an available route, not safety for a player who hops outside the gap or idles in the road.

### Simulation timing and frame order

All hop progress, start hold, vehicle displacement/spawns, gap phases and animation advance **only by dt from Simulation's `useRunFrame` → `step(state, dt, input)`**, with core `MAX_FRAME_DT = 0.05 s`. Keep `run.time` in rules and derive periodic traffic/visual phase from it. No `setTimeout`, `performance.now`, `Date.now`, tween completion callbacks, stored `state.clock.elapsedTime` or independent visual deltas. Renderer elapsed time resets on pause/resume.

Current core RunClock is priority -1; InputLatch runs before the game's priority-0 callbacks. Put Simulation first in the Scene child tree; visuals only read state in `useFrame`. Parent-level simulation would run after child visuals at the same priority. Camera focus also updates from current simulation state before its visual callback. Paused redraw/resize refits without advancing the hop or traffic. Adopt a core clock/priority helper if main gains one before implementation.

## Scoring

| Event | Points |
|---|---|
| First surviving landing on each new furthest row of the level | +10 |
| Far-side landing completes the 20-row level | +100 bonus, in addition to the final +10 |
| Revisiting / lateral / waiting / hit | 0 |

With completed levels k and current furthest row r in 0..19, raw score is **`300*k + 10*r`**. At the final landing normalize r = 0 and increment k in the same step. Highest-progress score does not decrease on retreat. Default final score/duration comes from store score / `Math.round(elapsedMs)`; GameShell submits. `end("lose")` is still ranked for this points game. Exit uses shell quit and does not submit.

### Server limits and why they hold (the proof)

Unchanged `meta.scoring` / WP limits: points, **50000** maximum, base **0**, **100 pts/s**, **3000–1800000 ms**, `pts`, integer display. We prove the raw score is already valid for **any play**, not merely a shortest successful route.

1. Let h be completed hops (including lateral/backward/repeated ones), and let **n = 20*k + r** be credited forward rows. A single hop advances at most one row and only landing awards progress, so h >= n. Every hop consumes >=0.55 s; the initial preview consumes 3.05 s. Pauses, waits, backtracking and queue gaps only add time. Thus simulation time s >= `3.05 + 0.55*n` whenever progress is awarded.
2. RunClock and Simulation use the same clamped delta. The countdown-to-playing frame can simulate without counting store time, at most **0.05 s once per run**. So submitted t satisfies **`t >= 3.00 + 0.55*n`**. Duration rounding does not weaken these bounds because 3050/550/50 are integer milliseconds. In particular a collision is enabled only after the protected preview, so every submitted loss is >=3000 ms; the shell cap clamps duration at exactly 1800000 ms.
3. Raw score S = `300*k + 10*r`. At the earliest permitted duration the rate cap is `100*t >= 300 + 55*n = 300 + 1100*k + 55*r`. Its margin over S is **`300 + 800*k + 45*r`**, always nonnegative. For n = 0, S = 0 even during preview; for the first credited row S = 10 at t >=3.55 s, giving cap 355 and margin 345. A completed first level has S = 300 at t >=14 s, cap 1400. Collision before a landing grants no extra points; bonuses never arrive before the 20th hop.
4. For all ranked runs t <=1800 s, use the one-frame allowance in the reverse direction: n <= `floor((1800 + 0.05 - 3.05)/0.55) = 3267`. Score is increasing in n, with k = 163 and r = 7 at that bound: **48970 pts**, below 50000 by **1030**. Real traffic and waits can only lower it. The final clock-timed-out frame may skip Simulation, which cannot increase this bound.
5. Earliest possible 50000: after 166 full levels and 19 rows the score is 49990; completing level 167 would jump to 50100. That requires **3340** credited hops and t >= `3 + 0.55*3340 = 1840 s`, **40 s after the 1800 s cap**. Hence no reachable run can hit/exceed 50000 before maxDurationMs. Neither a fast seeded gap sequence nor queued inputs can break this bound.

No score clamp is needed for reachable play. A defensive `capScore` helper would return `min(rawScore, 50000, floor(100 * Math.round(elapsedMs) / 1000))`; if added, `definition.finalScore` must return that score with the unchanged store duration, covering shell timeup too. Tests must show it is a **no-op** on reachable ranked losses/timeouts, rather than masking a faulty hop duration or bonus timing. Score/stat updates precede end; end is idempotent. At a cap/collision tie, core RunClock ends with timeup first, so the last frame cannot award points or overwrite the reason. No cap/metadata changes are needed.

## Scene and camera

Three-quarter view looking forward along -z, **55° pitch**, yaw 0, vertical FOV **45°**, near 0.1 / far 400. Forward on the keyboard/swipe stays forward on screen in both aspects; never rotate yaw by 90°. Follow longitudinal pigeon progress 1:1 (including mid-hop interpolation); keep camera x = 0 so all columns stay visible. Focus is `(0, 0, pigeon.z - 3.6)`; camera position = focus + `(0, R*sin(55°), R*cos(55°))`. Do not independently ease with wall/visual time. Levels join continuously rather than resetting camera/clock.

Fit the active play box **x = ±5.8, y = 0..1.5, z = pigeon.z -10.8 .. pigeon.z +3.6**: six rows ahead, two behind, full road width and tallest visible vehicle/hop. Further scenery may fade outside this window; lane logic/continuous collision does not depend on culling. Show ahead into the next board before the boundary grass.

Local `camera.ts` plan, until core provides a world-box/free-screen fit:

- Use actual CSS canvas size W/H. Reserve 16 px left/right plus safe insets, **72 px top** plus top inset for shell Score/Time/Level/mute/pause, **72 px bottom** plus bottom inset and existing `useBottomObstruction()` from `core/TouchControls` for hints/home/cookie area. Swipe/tap has no joystick or jump/action boxes; the clear central canvas is the gesture area. Tiles are visual guides, not tiny touch buttons.
- For each candidate R, transform all eight box corners into camera space: u = x/-z, v = y/-z. With `f = H/(2*tan(22.5°))`, require `2*f*max(abs(u)) <= W-L-Rpad` and `f*(vMax-vMin) <= H-T-B`. Bracket distance and binary-search the smallest passing R. Centre vertically in free space via `setViewOffset(W,H,0,offsetY,W,H)`, where `offsetY = H/2 - f*(vMax+vMin)/2 - (T+H-B)/2`; unequal side insets also need horizontal centring. Update matrices before input/rendering.
- Refit on aspect, safe inset and obstruction changes, including while paused; focus then uses frozen simulation position. Core CameraRig can place/follow the camera, but it does not yet supply this free-screen fit. Keep camera ownership/order explicit so shell/default CameraRig cannot overwrite the fitted projection.

**Projection measurements** with installed Three.js, this exact box/fit, pigeon z = 0, zero safe insets and no cookie banner (not browser gameplay measurements):

| Viewport | Distance R / camera position | view offsetY | Projected active-box bounds (CSS px) | Pigeon centre, y = 0.5 |
|---|---|---|---|---|
| **375 × 812** | **38.507**, (0, 31.543, 18.487) | 4.093 px | x **16..359**, y **241.93..570.07** | (187.5, 474.32) |
| **812 × 375** | **25.672**, (0, 21.029, 11.125) | 8.433 px | x **276.75..535.25**, y **72..303** | (406, 231.02) |

Both fits leave play lanes below the HUD and above bottom obstructions; retain metadata orientation `"any"`. Near/far grid widths are about 44.29/37.69 px portrait and 32.08/25.17 px landscape. They are **not tap targets**: any tap in the unobstructed gesture canvas hops forward, while swipes/keyboard choose direction. Actual overlay fit, safe insets and readability are browser acceptance checks, especially the compact landscape pigeon. If an obstruction leaves insufficient visible gesture space (minimum 160 px height), pause and show a clear-space hint through a future game-owned Hud; do not continue unseen traffic.

Looks only: rigid pigeon squash/lean/wing movement and the hop arc read phase progress; vehicles translate and wheels rotate from simulation distance, grass/curbs/markings are instanced primitives. No rigging/Rapier is needed. Collision footprints remain constants regardless of GLB appearance. Target <=150 draw calls, 60 fps on a mid phone; instancing/bounded pools and no per-frame allocations are implementation requirements, not measured performance claims.

## Assets

Universe **`street`**, fixed asset seed **5250** (not the fresh gameplay seed). All outputs target this game's folder; no shared models required.

| Model | Source | Spec | Fallback |
|---|---|---|---|
| pigeon | `/models/3d/pigeon-crossing/pigeon.glb` | Image, concept below, Gen-2.5-Medium, 18000, ×2 | Grey-blue rounded body/head, eyes, orange feet, flat wings |
| car | `/models/3d/pigeon-crossing/car.glb` | Text, Gen-2.5-Low, 2500, ×1 | Rounded red body/windows/wheels |
| taxi | `/models/3d/pigeon-crossing/taxi.glb` | Text, Gen-2.5-Low, 2500, ×1 | Yellow car with blank roof sign |
| van | `/models/3d/pigeon-crossing/van.glb` | Text, Gen-2.5-Low, 2500, ×1 | Boxy white body/windows/wheels |
| road, grass, curbs, markings, hop shadow | Code primitives | None | Always code |

Five generations estimated **2.5 credits** at 0.5 each; no generation or spend is part of prep. Claude handles approved asset work (Rodin MCP/import/optimization) after the user approves. Keep GLB/Raw/PBR/explicit seed conventions, never HighPack/Extreme-High. Pigeon cap: 20k tris, 1024 px, 1.5 MB; each vehicle: 5k, 512 px, 300 KB. Floor pivots and `assets.ts` scale/rotation map models to the stated world sizes; collision never comes from a mesh. Missing models use primitives without changing traffic.

### Prerequisite: pigeon ChatGPT concept

Attach the chosen Play50 toy-world style sheet, generate/approve this full concept, then pass its PNG to Claude as **`tools/hyper3d/concepts/pigeon-crossing-pigeon.png`**. No image is generated in this prep branch.

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of a chubby brave city pigeon mascot, oversized round head, big expressive friendly eyes, grey-blue feathers, smooth green-purple iridescent neck sheen, small rounded beak, chunky orange feet, bright vinyl-toy look, smooth rounded shapes, saturated colours, friendly cartoon proportions, simple clean materials, no outlines or fine texture noise. Bird T-pose with both wings spread straight out to the sides and feet slightly apart, full body including both wing tips and feet, single figure centered, plain light-grey background, no shadow, no road, vehicles or other props, no text, no logo, soft even studio lighting, 1024x1024.
```

Regenerate if wing tips/feet are cropped, extra objects appear or wings are not clearly spread. Rigid transforms animate the result; no skeleton/Mixamo dependency.

## HUD

Planned **`hudStats: [{ key: "level", label: "Level" }]`**, starting at 1 and incremented at each far-side landing. Shell owns Score, cap Time and Level plus mute/pause, one row. No lives or extra progress HUD chips. Optional game-owned unobtrusive start/clear-space hint uses the reserved bottom area, `pointer-events: none`, CSS Modules/existing vars. Results/bests show `pts`; do not submit scores directly.

## Edge cases

- Pause mid-hop freezes interpolation, queued direction and all cars/gap clocks. Resume continues that hop, with no jump from reset R3F elapsed time. Frozen resize just fits the camera.
- Hop into a car, or car crosses between frames: swept hit ends lose immediately; no landing award/bonus afterward. Air height does not make the bird immune. A queued move cannot rescue a dead pigeon.
- Initial preview ignores movement events, including a held key; it is playing time, unlike countdown. Idle start-grass run remains safe, scores 0 and reaches the 30-minute cap with timeup.
- Far-side grass cannot be hit; collision still precedes awards. Increment level/bonus exactly once, discard queue and preserve global time/physical boundary. Backtracking cannot replay completed levels or farm furthest-row points.
- A traffic cycle wrap despawns only off-board and starts a new pack off-board; never sweep a modulo teleport through the pigeon. The next level's already-visible traffic keeps its phase when activated.
- A hit before 3000 ms is impossible because preview locks the pigeon on protected grass. At the 30-minute collision tie, shell timeup has priority. Quit saves nothing; ranked losses/timeups retain earned points.
- Restart remounts Scene with fresh seed, state, weights/descriptors and queue. Strict Mode may initialize twice, with no shared mutable run data or paid effects. Cap/difficulty do not leak from the last run.

## Test plan

Planned `rules.test.ts` (pure tests; fake input/dt, no wall-clock sleeps):

- Seed determinism, uint32 extremes, multiple levels, stable per-level mixing and integer draws; traffic independent of frame count for the same simulation instants. Preview generation/activation gives identical positions.
- Every tier/type: pack count, speed caps, headways/bumper gaps, nonnegative start-offset limits, exit before phase 9, full 3 s empty window shared by both roads; randomized seeds plus validated fallback. Time-expanded search finds a continuously collision-free route through all 20 rows, including opposite directions/different speeds.
- Threshold edges, held keys/no auto-repeat, diagonal priority, swipe/tap priority, one queue slot, ignored extra events, invalid grid moves, no duplicate edge. 550 ms remains minimum for chained hops at 60/120 Hz and irregular raw dt clamped by core.
- Swept hits on takeoff/flight/landing, stationary road pigeon, touching boundary, cars passing between samples, grass safety, off-board despawn/period wrap, queue cleared on death. Equal-time collision wins over score.
- 10 for each new furthest row once, no lateral/revisit reward, one +100 on row 20, shared boundary not counted twice. All input histories satisfy h >= n and `score = 300*k + 10*r`.
- Real `createArcadeStore` driven in ShellStage order: countdown transition, pauses/resumes and retries; exactly one untimed frame <=50 ms. No submitted loss before 3000 ms; cap at 1800000; exhaustive progress bounds 0..3267 and random input timelines pass both server caps. Maximum bound **48970**; first hypothetical >=50000 at **1840 s**, unreachable before cap. `capScore` stays a no-op on reachable ranked results.
- Pause in preview/hop/quiet window cannot advance traffic or award progress. An idle grass run ends timeup/0. One end per run, no post-end mutation; reduced motion cannot shorten hops or alter collision rules.

**Browser acceptance plan (pending implementation):** local production build, arcade flag on and API mock on, never production WordPress.

- Desktop **1280 × 800** arrows/WASD, touch emulation **375 × 812** and **812 × 375**, plus one real phone: ready → countdown → protected preview → several hops → wait on grass → level 2 → hit/lose → Retry → Exit. Verify score/Level and default submitted duration. Both mobile aspects stay playable.
- Measure all active-box projected corners against actual HUD, safe insets and bottom/cookie overlays; no lane underneath them. At 375/812 compare with the projection table, verify compact landscape readability, tap-anywhere forward and four swipe directions. No browser scroll/zoom, accidental double input or keyboard auto-repeat.
- Pause 2.5 s mid-hop and mid-gap; hide/reveal and blur/focus, rotate/resize while paused. Pigeon/car positions and queued hop are unchanged on resume; next-frame collisions are neither skipped nor duplicated. Reduced motion preserves rules.
- Backtrack/revisit, hop directly into a vehicle, test final-row bonus and previewed next-board traffic continuity. Mock scores never exceed their duration budget. Accelerated pure tests cover 30-minute cap; browser checks cap handoff using a local test harness without production traffic.
- Missing GLBs render fallbacks; no horizontal overflow, focus/feedback accessible, one-row HUD, bounded meshes/textures, <=150 draw calls and 60 fps target on mid phone. Performance/screenshots are not yet measured.

## Known issues and core gaps

- Prep only: live gameplay, assets, thumbnail and browser tests remain pending; status stays soon. Camera numbers are projection checks, not runtime/performance evidence.
- Core lacks pause-safe animation time and simulation-first priority configuration; use local dt-only state and first-child Simulation until shared helpers exist. The <=50 ms countdown gap is explicitly in the proof.
- CameraRig lacks world-box fitting/free-screen bounds; local aspect fit currently required. Existing `useBottomObstruction` helps, but core could expose actual HUD/gesture/overlay rectangles and live safe insets. Large obstructions require a paused clear-space hint.
- Core collision helpers are overlap/resolution helpers; verify continuous sweep support before implementation. If absent, add a pure swept ground-AABB helper **inside this game**, never frame-end-only collision. A shared core enhancement belongs to Claude.
- `Model` lacks a custom fallback prop; explicit `useModel(...).failed` checks can clone twice. Vehicle instancing/extracted geometry must be assessed with actual GLBs before the draw-call target can be claimed.
- Fairness windows and tier saturation are intentional. Faster/denser progression stops at tier 10; raising limits, shortening hops, changing row count/bonus or removing preview invalidates the proof and needs fresh review.
