# Tiny Escape Room

Owner: Codex (design and rules), scene by Cursor. Slug: `escape-room`. Game 9 of the 3D Arcade. **Playable, status `"soon"`.** Codex's design and reviewed `rules.ts` / `rules.test.ts` are on main; the scene branch adds the files below and edits `index.tsx` (the full `GameDefinition`) and `meta.ts` (control texts and the thumbnail only; scoring and status unchanged).

| File | What it owns |
|---|---|
| `meta.ts` | Server-safe card data and scoring equal to `arcade-games.json`; `orientation: "any"`, status `"soon"`. |
| `index.tsx` | `GameDefinition`: Scene, Hud, assets, `durationMs: 600000`, fixed camera, the Found stat and instructions. |
| `rules.ts` | Pure seeded layout, collision, movement, inspect states, checklist and win condition; no React, three.js, DOM or `Math.random`. |
| `rules.test.ts` | Determinism, reachability, interaction boundaries and the minimum-duration proof, driven through the real core clock. |
| `Scene.tsx` | Draws the run seed, translates input into reusable rule input, calls `step(state, dt, input)` in `useRunFrame`, reports events and renders state: badge, runner, ground marker. |
| `Primitives.tsx` | This room's cutaway shell, desk drawer, under-desk box, cupboards, loot, door and the primitive runner; rigid opening parts posed from the rules' timers. |
| `cupboard.ts` | The open cupboard shell (walls, shelf, outward door; the roof leaves the graph while it opens). |
| `desk.ts` | Drawer and under-desk box sizes and their slide/lid poses: both come out past the desk top's edge before the loot shows. |
| `marker.ts` | `groundRingScale`: the runner's floor ring sized so its smaller screen extent is 24 CSS px. |
| `picker.ts` | Badge size on screen (`screenSpriteSize`) and the billboard hit test for taps. |
| `standIn.ts` | The primitive runner's limb directions from the shared humanoid pose, and which arm reaches a target. |
| `look.test.ts` / `picker.test.ts` / `standIn.test.ts` | Camera rays to opened loot (cupboards, drawer, under-desk box) and the 24 px marker / badge picking / stand-in cheer, reach and walk. |
| `Hud.tsx` / `Hud.module.css` | Three-item checklist and inspect progress; CSS Modules and existing CSS variables, lifted over the cookie banner. |
| `assets.ts` / `assets.spec.json` | Shared and local `ModelAsset` declarations / the three props this game proposes generating. |

### What a new game copies from here

- Copy the reference game's file split and pure `createRun(seed)` / `step(state, dt, input)` approach, not its warehouse art or pickup scoring. Games import generic helpers from `core/`, never another game's implementation.
- Use `createRng(seed)` (mulberry32) from `core/math.ts`, a single mutable run state made on Scene mount, and one simulation callback. Reuse `inputToWorld`, collision helpers, `useRunFrame`, `useGameTime`, `useFittedView`, `useSafeArea`, `CameraRig`, `Model` and `InstancedModel` from the current core.
- Copy the proof style and clock tests from `robot-collector/rules.test.ts`: exercise `createArcadeStore`, `advanceRunClock` and `playedFrameDt`, not an invented wall clock. Read the reviewed `penalty-hero`, `clean-city` and `office-escape` READMEs on main for per-run seeds, integer clocks, fixed pools and game-specific tests. The current core README takes precedence over older gap lists in those designs.
- For a **time** game, use the shell's `normalizeRun` / `computeTimeScore` and `isRankedRun` path in `core/scores.ts`. `core/limits.ts` supplies `capScore` / `withinServerLimits` for points games; their points-per-second inequality is not this game's rule. Do not copy a local cap, item points or a `finalScore` override.

## Concept

A small, roofless office contains four searchable stations and a locked back door. The shared runner must find exactly **three items: Key, Book and Battery**, then inspect the door to escape. Each item is inside a different container. The fourth container is empty. Opening a container reveals its contents; a separate inspection picks up the item. Familiar shapes and a bright yellow accent (`#eab308`) make the search readable without written clues on models.

One room ships first. Extra office/lab/spaceship variants add no mechanic, so there is no lab console in the spec. Seeded container positions and item assignments provide variation while retaining the same solvable geometry and duration bound. The start screen explains: “Open containers, take all three items, then open the door. Faster escapes rank higher.”

## Controls

The existing card uses `scheme: "point-and-move"`: WASD movement / click to inspect, joystick / tap on touch. The implementation also accepts the core's arrow keys and `actionPressed` from **E or Enter**.

- Normalize diagonals, then call `inputToWorld(moveX, moveY, view.yaw, state.direction)` with reusable output. With a fixed 30° camera yaw, up is away from the camera and right is screen-right. No point-to-walk or automatic pathfinding.
- Click/tap inspects the highlighted object only when its logical anchor is within 1.0 m. Clicking a distant container does nothing. Swipes are not an inspect command.
- E/Enter inspects the nearest eligible object in reach; equal squared distances use the fixed station ID. Held keys do not repeat actions. The core records action presses between frames; do not add another keyboard listener.
- During an inspection the runner stops immediately. Busy-state taps/keys are dropped, not queued. Completing an opening does not reuse the press to take its contents: a fresh action is required.
- Esc/P, tab visibility and pause/resume belong to GameShell. No game-owned pause gate or landscape gate.

## Constants

All world distances are metres; gameplay times are integer milliseconds.

| Constant | Planned value / invariant |
|---|---|
| Floor / player bounds | 12 × 10; `x ∈ [-6, 6]`, `z ∈ [-5, 5]`; runner centre `|x| ≤ 5.65`, `|z| ≤ 4.65`. |
| Runner | Circle radius 0.35, visible height 1.4; start `(0, 0, 4)`. Add a 24 CSS px location marker for small landscape views. |
| Movement | Maximum 1.8 m/s, acceleration 6 m/s², braking 8 m/s². Final displacement, including collision correction, never exceeds `1.8 * dt`. |
| Station anchors | `(-4, -3)`, `(4, -3)`, `(-4, 3)`, `(4, 3)` in x/z; each coordinate jitter is -0.25, 0 or +0.25. |
| Station bodies | Centre at `(anchor.x + sign(anchor.x) * 1.0, anchor.z)`; collision footprint 1.2 × 1.4, visual height ≤ 1.4. |
| Furniture | Two shared desks at stations 0/2; primitive cupboards at 1/3; two shared chairs at `(±5, 0)` with 0.8 × 0.8 collision footprints. |
| Door | Logical anchor `(0, 0, -4.2)`; leaf at `(0, 0, -4.85)`, size 1.4 × 2.0 × 0.12; primitive frame height 2.1. |
| Inspect reach | 1.0 m in x/z from runner centre to the station/door anchor; model bounds do not change reach. |
| Container opening | 1100 ms; rigid drawer slide, cupboard hinge, or the under-desk box sliding out past the desk top's edge and then lifting its lid. Collision footprints stay fixed. |
| Item retrieval | 900 ms, separate fresh inspection after the container is open. |
| Door action | 600 ms unlocking + 1200 ms leaf opening = 1800 ms; allowed only with all three items. |
| Run limit | 600000 ms of unpaused play, matching `timeBaseMs` and the existing maximum duration. |
| Fixed pools | 4 station records / moving parts, 3 loot records, 1 door, 1 runner, 2 desks, 2 chairs and the fixed room shell. No spawning during play. |
| Camera | Vertical FOV 45°, pitch 55°, fixed yaw 30°, fixed focus `(0, 0.5, 0)`, near 0.1 / far 200. |

## Rules

### Seeded layout and solvability

Scene calls `randomSeed()` from `core/math.ts` once per mounted run, outside `rules.ts`. `createRun(seed)` takes that unsigned 32-bit seed; restarting remounts Scene and draws a new one. The spec's seed 5050 styles generated models and is independent of gameplay randomness.

`generateLayout(seed)` uses `createRng(seed)` (mulberry32). Fill four preallocated station records in fixed ID order with the coordinate jitter above. Each jitter has integer weights **1:1:1**, using `floor(rng() * 3)`. Shuffle `[key, book, battery, empty]` with integer Fisher–Yates indices and assign one entry per station. No weighted floating thresholds or unseeded choices. Cosmetic choices use a separate seeded stream, so adding decoration cannot change the item permutation.

Station 0 is a desk drawer, 1 a cupboard, 2 a box under a desk and 3 a cupboard. Desks, cupboards and their contents fit the same collision envelope. The searchable anchor is on the centre-facing side, rather than inside the furniture. At its worst position the nearest body face is 0.4 m from the anchor, leaving 0.05 m beyond the runner's radius. Loot appears on the opened tray/shelf; it is never loose on the floor and cannot be collected by walking over it.

`isValidLayout` verifies the bounds, three distinct item-bearing stations, clear start/door/anchors, visual envelopes and the connected route. The jitter construction needs no rejection loop: every combination is valid. If validation detects a programming error, fill the same slots with the tested zero-jitter fallback and assignment `[key, book, battery, empty]`; never start an invalid run or retry indefinitely.

**Constructive solvability:** every station body is outside `|x| < 4.15`, and every chair is outside `|x| < 4.6`. Inflating them by the runner's 0.35 m radius leaves the central `|x| ≤ 3.4` corridor clear. From the start, move along x = 0 to a station's z, then horizontally to its anchor and back. At that z the chair at z = 0 cannot block the path. Repeat for all required stations, then move along x = 0 to the door. All anchors are walkable, reachable within the room bounds and inside their inspect radius. Opening panels never changes these collision footprints. This works for every permutation/jitter, including the fallback. A centre-route construction is at most 53.2 m of walking, leaving ample time for acceleration and the 7.8 s of required actions within 600 s.

### Movement and collision

Use the reference game's simple circle-versus-AABB movement with the core collision helpers, not Rapier. Normalize the input, integrate bounded velocity, resolve furniture and clamp to the floor. Then cap the **net** step from the old position to `maxSpeed * dt`; a collision push-out must not accelerate the runner. If that shortened position is still blocked, restore the previous valid position. Do not teleport, snap to an inspect anchor or move the player with an opening drawer. These invariants are essential to the duration proof.

### Inspect states and checklist

Each station has `CLOSED → OPENING → OPEN → RETRIEVING → COLLECTED` states; the empty station stops at `OPEN`. Store an item bitmask and `found` count 0–3. The shared battery, key and book are visual children of their container; hidden/open/collected visibility follows the state.

1. With no action running, validate the chosen station/door ID and reach at the start of the simulation callback. An accepted action zeroes velocity and locks movement before any movement for that frame. An invalid/out-of-reach action has no effect on movement.
2. Inspecting a closed container takes 1100 ms and reveals its item, or “Empty”. A fresh inspect on an open filled container takes 900 ms and collects once. Already collected/empty-open containers do not restart timers or increase `found`.
3. While opening/retrieving/unlocking, ignore all new inspect edges. Movement remains locked for the action; after completion it resumes on the next frame. No overlapping timers, queued inspections or auto-collection.
4. Inspecting the door with missing items shows “Find all three items” and charges no unlocking progress. Once the bitmask is complete and the door is in reach, a fresh inspection runs unlocking and opening for 1800 ms. Only the completed door action emits `end("win")`, once.
5. At 600000 ms GameShell ends `"timeup"` before a late game callback; a door completion tied with time-up cannot turn that run into a win. Quit/time-up produce no ranked escape.

### Raycast/tap mapping

Use the core's normalized `input.tap`. Do not raycast the walls, floor, furniture, runner, net-like decoration or GLB mesh hierarchy. Inspection uses a camera-facing **44 × 44 CSS px badge** above the in-reach object's floor anchor (badge height 1.2 m); a dim anchor ring can identify other stations without making them clickable. The container footprint and badge size do not affect the 1.0 m logical proximity radius. The stations/door have disjoint reach circles, so at most one badge is actionable.

Reuse one `Raycaster`, plane, hit point and camera-right/up vectors. Set the ray from `input.tap` and the most recently rendered camera, intersect only the eligible badge's billboard plane, reject intersections behind the camera and test its local square bounds. This ignores intervening walls by design while still requiring proximity. Avoid `intersectObjects()` and its allocated hit arrays. The same transform is used for the visible badge and hit plane, including lens shift. On pointer-up the game inspects the displayed candidate, never a hidden item inside an unopened container.

For a perspective camera, the badge's world side is `44 * 2 * depth * tan(fov / 2) / canvasHeight`, with depth measured along the camera direction; its projection remains 44 CSS px at either aspect/DPR. The runner's 24 px location marker is a ring flat on the floor, so that method would draw it too small (17–20 px measured); `groundRingScale` (`marker.ts`) instead sizes it from its ground projection, so the ring's smaller screen extent is 24 CSS px. Candidate highlight, badge and keyboard selection all use the same distance/eligibility test. A drag used for the joystick, an off-badge tap or a distant tap cannot inspect.

### Simulation clock and frame order

The current core order is input **-2**, counted run clock **-1**, game-time **-0.75**, `useRunFrame` simulation **-0.5** (default), CameraRig **-0.25**, then visual `useFrame` **0**. Mount order is irrelevant. Do not use priority 0 for simulation or make a second simulation loop.

Each `useRunFrame` supplies `dt = frameMs / 1000`, including the counted remainder of the countdown-transition frame. Carry fractional milliseconds in the run: add `dt * 1000` to the remainder, consume its whole milliseconds and retain the fraction. Advance the integer `simMs`, bounded movement and all opening/retrieval/door timers only by those consumed milliseconds. Use at most 1 ms slices inside `step` to handle movement/collision and timer boundaries; consume an input edge once per frame, not once per slice. Reject non-finite/negative dt. The carried clock never runs ahead of total counted `frameMs`; do not truncate each frame independently or force a minimum 1 ms step.

Rules decide when an action finishes. Visual opening progress reads its rules timer; use rigid hinge/slide transforms, never a tween callback to collect or end. `useGameTime().now` / `.delta` may animate decorative glows and ease poses, and `.play` follows elapsed play time. They cannot advance gameplay timers. No `setTimeout`, `Date.now`, `performance.now` or stored R3F `state.clock.elapsedTime`. Pause freezes movement and each panel at its exact progress; inspect events during pause are not carried into resume.

## Scoring

This is a **TIME game**. The existing metadata/API contract is `kind: "time"`, `timeBaseMs: 600000`, `maxScore: 60000`, `minDurationMs: 15000`, `maxDurationMs: 600000`, `base: 0`, `maxPointsPerSec: 0`, display/unit label `"time"`. Do not apply the points-game rate inequality with those zero fields.

The server computes `score = max(0, floor((600000 - durationMs) / 10))`. The shell uses `elapsedMs`, rounds the submitted duration in `normalizeRun`, computes the same formula and clamps to the metadata maximum. Items add **no points**. Show elapsed/remaining time and Found in the shell; fastest escape is the result, not an item score. Do not override `finalScore`, call an API or save scores from this game. Only `end("win")` is ranked through `isRankedRun`; lose/time-up/quit are unranked and cannot improve a best or add a leaderboard play.

| Submitted winning duration | Computed score |
|---|---|
| 15300 ms (conservative earliest bound) | 58470 |
| 30000 ms | 57000 |
| 45678 ms | 55432 |
| 60000 ms | 54000 |
| 599990 ms | 1 |

An idle run ends at 600000 ms with `"timeup"`, an unranked result with score 0; it does not fabricate an escape at the time base.

### Server limits and why they hold (the proof)

The proof assumes a speedrunner knows the seed, skips the empty container, chooses the best order and holds perfect movement. Ignoring obstacles only makes the lower bound faster.

1. **Speed:** after diagonal normalization, velocity integration, collision correction and floor clamping, the net displacement is at most 1.8 m per simulated second. Inspection freezes movement. Acceleration/braking and furniture can only lengthen a route.
2. **Clock:** core counts every playable frame, including the countdown-transition remainder, before simulation. The carried-remainder integer-ms clock can lag by less than 1 ms and never lead. Thus simulated play is no longer than `elapsedMs`; there is no untimed-frame assumption or wall-clock contribution. Pause changes neither clock nor motion. Submitted duration is the shell's rounded elapsed time.
3. **Distance:** jitter leaves each required station at `|x| ≥ 3.75`. From start x = 0 to the first station's radius-1 reach circle requires at least **2.75 m**. Any three corners form an L: to visit all three, two centre-to-centre legs total at least a horizontal **7.5 m** plus a vertical **5.5 m**. A diagonal leg is longer than either leg it could replace. Subtracting the two reach radii on each leg gives **13.0 - 4.0 = 9.0 m** between required stations. The last required station to the door's reach circle needs at least **3.75 - 2.0 = 1.75 m**. Any order therefore requires at least **13.5 m** of actual walking. Opening containers in advance, revisiting or taking the empty station cannot shorten this necessary route.
4. **Actions:** three openings and three pickups take `3 * (1100 + 900) = 6000 ms`; the door adds 1800 ms. All are serial, movement-locked and require fresh input. Locked-door inspections cannot precharge its timer. The non-walking time is at least **7800 ms**.
5. **Earliest win:** `13.5 / 1.8 * 1000 + 7800 = 15300 ms`. The minimum is **300 ms above** the server's 15000 ms. Rounding cannot lower it below 15300 integer ms: elapsed time is at least 15300 before rounding. No artificial start hold or final-duration clamp is needed.
6. **Score and maximum duration:** the fastest possible win yields at most **58470 ≤ 60000**. The formula decreases for every later win. The core's 600000 ms time-up prevents a winning duration above the upper bound, and non-wins are unranked. Consequently every ranked run satisfies both duration limits and the score cap. A 50 ms stress-frame variation only delays actions within counted time; it is not free time deducted from this proof.

## Scene and camera

Scene.tsx is the playable room. It uses the fit below with no follow camera. The room is a roofless cutaway: floor 12 × 10, back wall up to 1.2 m, low front/side kerbs, desks/cupboards ≤ 1.4 m and door/frame ≤ 2.1 m. Furniture and drawers stay inside the physical guard box **x ±6.2, y -0.15…2.3, z ±5.2** through every rigid transform. Runner position/collision belongs to rules; its walk lean, turns and shadow only visualize it. No GLB animation is required for opening containers or the door.

Call `useFittedView({ area: ROOM_BOX, pitch: 55° in radians, yaws: [30° in radians], focus: [ROOM_FOCUS], margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 }, padding: 24, shift: true, fov: 45 })` with module-level objects. Use `CameraRig` with `camera.position = ROOM_FOCUS + view.offset`, `lookAt = ROOM_FOCUS`, FOV 45 and `shift={view.shift}`. This fixed camera has **no follow**; no local fitter or per-frame camera solve. The hook refits distance/lens shift on resize and safe-area changes while the single yaw keeps controls stable.

`useSafeArea` supplies the actual HUD, joystick, marked game checklist and cookie-banner rectangles. Place the optional checklist bottom-right, at most 174 × 36 CSS px, 20 px from the edge plus existing safe-area/bottom-obstruction variables; mark it `data-arcade-safe-area`. It shows three short item labels/checks or the current inspect progress/message in the same footprint. Do not manually duplicate shell safe-area measurements in game code.

The table uses **the current pure `fitView`**, not browser measurements. Its reproducible snapshots have a full-width 64 px HUD; a 132 × 132 joystick with left/bottom inset 20 px; the 174 × 36 checklist with right/bottom inset 20 px; and no device safe-area inset. Banner snapshots lift both bottom panels by the banner height (162 px portrait / 83 px landscape) and add the banner as an obstruction. Actual `useSafeArea` measurements replace these snapshots at runtime.

| Canvas / banner | Fit distance (m) | Lens shift NDC (x, y) | Physical room projection x / y (CSS px) | Station inspect badges (44 × 44 px) occupy x / y |
|---|---:|---|---|---|
| 375 × 812 / closed | 44.886 | (0.0178, 0) | 7.5…367.5 / 257.0…563.6 | 50.4…329.2 / 291.5…514.1 |
| 812 × 375 / closed | 24.840 | (0.0131, -0.1015) | 251.4…560.6 / 88.0…348.8 | 288.7…530.7 / 110.2…305.5 |
| 375 × 812 / 162 px | 44.886 | (0.0178, 0.1918) | 7.5…367.5 / 179.1…485.7 | 50.4…329.2 / 213.6…436.2 |
| 812 × 375 / 83 px | 35.823 | (0.0061, 0.0688) | 300.9…511.1 / 89.7…268.0 | 317.6…497.8 / 99.7…247.5 |

Project all guard corners, each station's jitter extrema and the separate door badge; all physical room points and actionable badge rectangles must clear the live HUD/joystick/checklist/banner, not merely the canvas edges. A 44 px badge can extend beyond the physical guard projection, so test its complete pixel rectangle separately. Retain the existing `orientation: "any"`: both supplied aspects have usable inspect targets. The runner's 24 px location marker preserves legibility in the banner-open landscape fit. These are math acceptance targets. Headless Chrome playtests at 1280 × 800 and at 375 × 812 with touch emulation (keyboard, joystick and taps, banner open) checked the live fit, the checklist above the banner, the badge taps, the 24 px marker and the opened loot of every station.

## Assets

`assets.spec.json` uses `slug: "escape-room"`, `universe: "shared-cast"`, seed **5050** and three text-mode props: **key (quality 1500), book (2000), door leaf (2500)**. All use `Gen-2.5-Low`, one attempt, a 5000-triangle / 300000-byte budget and 512 px textures. Every prompt includes the complete shared style block and prop suffix from `skills.md`.

- Reuse `SHARED_ASSETS.runner`, `.battery`, `.desk` and `.chair` with this game's scale/offset declarations in `assets.ts`; generate no duplicate character or furniture. The runner uses the already approved shared concept, so this game needs no new character concept PNG.
- Room shell, walls, floor, shelves, drawer panels, cupboard doors, under-desk box, door frame/keypad, rings, badges and checklist icons are code primitives. The door GLB is one rigid leaf: `assets.ts` fits it to 1.4 × 2.0 × 0.12 m and offsets its floor-centred model beneath a hinge group. The primitive frame is stationary; the leaf rotates during its final 1200 ms.
- Use `<Model asset fallback={<OwnPrimitive/>}>` for runner/loot/door and `<InstancedModel asset spots fallback={<Instanced .../>}>` for repeated static desks/chairs. Keep spot arrays stable for the run. Dynamic primitive panels mutate their existing transforms; do not regenerate instance arrays per frame.
- The current `modelManifest` determines whether a GLB is requested. The shared battery is listed on main; unlisted runner/furniture/local props immediately use fallbacks without 404 requests. Claude adds optimized files and manifest entries together; a game branch edits neither. Fit models to the documented visual/collision envelopes, never derive gameplay reach from a replacement mesh.
- Prerequisite for implementation: Claude reviews these designs/specs and confirms shared-model availability. Any paid generation is Claude/user-owned through the official Rodin MCP workflow; no credits, API keys or real smoke/gen calls are used here. Import/optimize may be tested with the CLI's `--mock` fixtures. Generated props use GLB, Raw mesh mode, PBR and explicit seed 5050, never HighPack/Extreme-High.

Three proposed generations are approximately **1.5 credits** at the existing 0.5/generation estimate; this is a planning estimate, not an approved spend or measured MCP cost. The lab console is deliberately omitted from this one-office design. Actual consumption and approval belong to the asset hand-off.

## HUD and store events

`hudStats: [{ key: "found", label: "Found", max: 3 }]` is the **only** shell stat, keeping its row compact alongside the time display. Set `setStat("found", 0)` once on Scene mount, then `setStat("found", n)` only on a completed first pickup. The optional `definition.Hud` checklist shows Key / Book / Battery checks and opening progress or a locked/empty message within one reserved panel.

Report rule events with fixed flags/IDs, not newly allocated event arrays: one pickup emits its sound `"pickup"`, one stat update and hides that loot; failed/locked inspection changes the existing message field only; door completion emits `end("win")` once. No item `addScore`, `setScore` loop, storage, leaderboard request or custom result submission. React updates occur at discrete events, never each simulation/visual frame.

## Allocation and edge cases

Allocate run state, four station/box records, three loot records, fixed wall/chair boxes, bitmasks, movement scratch and the picker/visual scratch once on mount. Generator and validation run before play and fill the fixed records. `step` mutates scalars/slots; no `map`, `filter`, `sort`, object spreads, new arrays/vectors, closures or temporary event collections inside the frame loop. Draw one room without recycled spawning; visibility toggles keep collected meshes and panels mounted. Reuse core geometry/material/instancing helpers rather than rebuilding them.

- **Pause during opening:** progress, player, elapsed time and win condition freeze; resume continues the same action, with no new random draw or automatic extra inspect.
- **Inspect while moving:** validate current reach, zero velocity, then lock. A remote tap does not stop the runner. If the player crosses the reach boundary during a frame, only the next eligible action can inspect; nothing snaps them into range.
- **Boundary or collision push:** final displacement cap and blocked-position rollback apply even when already touching a prop/wall. No radius loophole, diagonal boost or passage through a body.
- **Repeated inputs:** holding E/Enter, rapid taps during an action and inspecting a collected item cannot collect twice or overlap timers. Taps ignored while busy are not replayed after it opens.
- **Empty station / locked door:** show feedback without changing checklist, item assignment or required timer totals. Missing items never partially unlock the exit.
- **Time-up during door action:** core wins the ordering race; no late win callback, best update or ranked score.
- **Restart:** fresh seed/state and Found 0; all panels close and loot resets. Old rule events, pointer candidates and opening transforms cannot leak into the new run.
- **Missing/failed model, rotation or banner:** primitives keep every mechanic solvable; live fit repositions the camera without reseeding, changing reach, speeding timers or blocking landscape play.

## Test plan

### `rules.test.ts`

1. Follow the reference's pure-function/Vitest style. Same seed yields identical station jitter and item permutation; 1000 unsigned seeds plus 0, 5050 and `0xffffffff` have exactly one of each item and one empty station. Invalid layout exercises the explicit zero-jitter fallback.
2. For all 1000 layouts, inflate collision boxes by 0.35 m and flood-fill free centres on a 0.25 m grid from the start; reach every station and the door. A scripted axis-route bot opens/takes three items and opens the exit before time-up, including each container type and each item permutation. Verify moving panels never alter the route.
3. Enumerate all six required-item orders for every layout. Subtract reach radii from start/centre legs/door legs, assert route lower bound ≥ 13.5 m and earliest completion ≥ 15300 ms. Adversarial inputs may choose any inspect order, open early, revisit and attempt locked-door precharging; none win before the analytic bound. Test 20,000 movement steps against `1.8 * simulatedDt`, including diagonals, corners and collision correction.
4. Drive the real `createArcadeStore`, `advanceRunClock` and `playedFrameDt` across countdown transitions, 4–300 ms raw frames, fractional-ms frames, pauses, wins, time-ups and restarts. Assert consumed integer play ms never exceed counted `elapsedMs` and remainder stays in [0, 1); no lost per-frame fractions, forced 1 ms step or uncounted movement. Compare 60 Hz / 144 Hz action completion within one counted frame. There is no test expecting an untimed countdown frame.
5. Assert exact action totals 1100 / 900 / 1800 ms with serial movement locks; fresh-edge requirement, empty containers, wrong/collected IDs, busy-edge drop, range 0.999/1.0/1.001 m and nearest-ID selection. Found initializes once, updates exactly three times, and a completed door emits win once.
6. Check `computeTimeScore`, `normalizeRun` and `isRankedRun` against the table, rounding boundaries and `maxScore: 60000`; every generated winning route stays within 15000–600000 ms. An idle run and door completion at time-up are unranked, score 0 and cause no best/save/submit. Do not apply points-only `withinServerLimits` with a time game's zero rate.
7. Fixed pool lengths/identities remain unchanged after 600 s, all interactions and restart cleanup. Step preserves the seed and required layout; generation never occurs during a frame. Assert pause freezes each action and elapsed movement, and restart clears events/stat/message/picker state.

### Camera/picker tests and browser plan

- Pure camera tests call the core `fitView` for each table snapshot, then project the full physical guard, every station jitter extremum, door badge and runner marker. Assert targets ≥ 44 × 44 CSS px, runner marker ≥ 24 px, positive depth and no overlap with HUD, joystick, checklist or banner. Match the displayed transform and picker plane at both DPR 1 and 2.
- Test ray/badge hits, near edges, outside corners, behind/parallel rays, unreachable objects and hidden loot. Placing a wall or furniture mesh between ray and badge must not intercept the inspect; proximity still rejects a far-side object. After a refit, ray hits the badge at its displayed screen location. No allocated raycast hit array.
- At **375 × 812 portrait and 812 × 375 landscape**, play `/3d/escape-room` with keyboard and emulated touch; repeat with banner open/closed and device safe-area insets. Measure complete room/target rectangles against the actual `useSafeArea` result, capture screenshots, and verify 44 px taps and the 24 px runner marker. Confirm the one-row shell HUD and checklist never cover an item/door target.
- Complete all three container types, empty inspection, pickup and door sequence. Test WASD/arrows, E/Enter, click, joystick and taps; held E does not repeat, joystick drag does not inspect, busy taps do not carry over. Test collision edges and missing GLBs/manifest entries with primitives.
- Ready → countdown → playing → pause/resume during each animation → over → retry/exit; also hide/show the tab, resize/rotate and toggle the banner during play. Check Found resets, a new seed is used and the same active action survives pause without a jump.
- Verify a win uses the shell's time formula and fastest duration display; idle/time-up/quit leave the previous best intact and submit nothing. Test only local development/staging allowed by the project, never the production WordPress site. Observe the ≤150 draw-call budget and 60 fps target on a real phone; profile no steady per-frame allocations.

## Known issues and core gaps

- The scene is playable and status stays `"soon"`. The camera table is still the math target for `fitView`; the live fit uses `useSafeArea` on top of those same options. Rules and `rules.test.ts` belong to Codex and were not edited here.
- Inspect uses `input.tap` (release, not a drag), never `tapDown`. A missed tap passes an invalid target so it does not fall through to the E / Enter nearest-object key.
- The runner is `<HumanoidModel asset={SHARED_ASSETS.runner}>`. `runner.glb` is not in the manifest, so `PrimitiveRunner` shows and points each arm and leg along its rig bone from the same pose (`standIn.ts`; L = the runner's left = +x, as in the rig): idle, a walk whose stride matches the speed, a reach with the arm on the target's side while opening or inspecting, and both arms up in a waving V on the win. Listing the GLB swaps the body without a scene change, and the rig reaches with the same arm. Its joints still use the robot's landmarks until the runner is measured. Key, book and door are primitive fallbacks until their GLBs exist. Desk, chair and battery use the shared models.
- Opened loot is always in the camera's view: the cupboard roof leaves the graph while it opens (its door swings outward), the drawer slides out past the desk's edge, and the under-desk box slides out from under the desk top first and only then lifts its lid on the back edge, behind the loot (`desk.ts`; `look.test.ts` casts rays from both fitted cameras over every jitter, with the desk as a solid box up to its 0.54 m top). The 44 px badge of an opened, filled container (the "take" badge) turns see-through (`BADGE_LOOK`, `badgeShowsLoot` in `picker.ts`): at about 20 px per metre on a phone it is wider than the whole station, and the loot sits right under it.
- Still open in the core: the cookie banner is found by a 1 s poll, and `env(safe-area-inset-bottom)` is not reported. The live fit uses `useSafeArea`, so a banner or inset change can lag; that measurement stays in `core/`.
- Desk, chair and battery GLBs are on main and scaled in `assets.ts`. Key, book and the door leaf are still primitives. Mesh size never changes reach or collisions. Measured draw calls (`renderer.info.render.calls`, desktop and phone): 36 in the furnished room, 39 with a container open.
- The catalogue's older escape-room row calls the universe `office` and proposes a console. This requested spec uses `shared-cast` seed 5050 and omits the console for the single office. Claude can reconcile the owned catalogue during the asset review; this branch does not edit `skills.md`, the scoring metadata, API rules or core files (`meta.ts` only gets its control texts and thumbnail).
