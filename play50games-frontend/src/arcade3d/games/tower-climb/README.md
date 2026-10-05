# Tower Climb

Owner: Codex. Slug: `tower-climb`. Game 7 of the 3D Arcade. Accent `#06b6d4`. **Prep only:** this README and `assets.spec.json` are the design; `meta.ts` selects `orientation: "portrait"`, and the placeholder remains `"soon"`. Scene, rules and tests below are planned, not implemented. Engine contracts follow `core/README.md` and the refactored `games/robot-collector/` on main.

| File | What it owns |
|---|---|
| `meta.ts` | Server-safe card data, `orientation: "portrait"`, platformer controls and unchanged scoring matching `arcade-games.json`. |
| `index.tsx` | Planned `GameDefinition`: Scene, assets, `durationMs: 1800000`, camera, joystick + jump, one height HUD stat; no lives. |
| `rules.ts` | Planned pure `createRun(seed)` and `step(state, dt, input)`: generator, kinematic physics, collision, integer-ms clock, platform states, coins and score. No React/three.js/DOM/`Math.random`. |
| `rules.test.ts` | Planned Vitest for reachability, coyote/buffer, determinism, pools and the scoring proof. |
| `Scene.tsx` | Planned mount seed and fixed pools, default-priority `useRunFrame`, core camera fit/follow, rendering, store reports and sound events. |
| `Primitives.tsx` | Planned tower, platforms, coins, checkpoint ledges, runner/flag fallbacks and blob shadows. |
| `assets.ts` / `assets.spec.json` | Planned runner/flag `ModelAsset`s / one flag generation request. |

### What a new game copies from here

- Use robot-collector on main as the structure template: the file split, pure seeded rules, server-safe metadata, `GameDefinition`, store reporting and tests proving the server limits. Games never import one another.
- Make state once in Scene's lazy `useState` initializer with `createRun(randomSeed())`. One default-priority `useRunFrame` calls `step(state, dt, input)` and reports store actions/events. Visual callbacks read the resulting state; no per-frame React state. Core priorities guarantee simulation before camera and visuals regardless of mount order; no first-child Simulation convention is needed.
- Reuse `useGameTime`, `useInput`, store, audio, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea`, `<Model fallback={...}>`, `<InstancedModel>`, `SHARED_ASSETS`, `core/render`, `core/math` and `core/limits`. Generic helpers belong in core; ask Claude if another is needed. No local clock hook, camera fitter, safe-area measurement or score-cap function.
- Tower adds an analytic one-way platform jump, a carried-remainder integer-ms rules clock, a reachable permanent route, optional collapsing detours, unique height-band coins and bounded recycled pools. Do not copy warehouse collision, battery effects, layouts or camera numbers. Rules timing belongs to gameplay; purely decorative animation uses the core visual clock.

## Concept

The shared Play50 runner climbs a bright toy tower. Static and horizontally moving platforms form a permanent route; orange crumbling side platforms offer different launch positions. Every 8 m, a broad flagged checkpoint provides a safe place to stop and a coin to collect. Height earns points once, so dropping and climbing the same ledges cannot farm score.

The camera rises with the highest position reached and never follows a fall downward. Falling through the bottom of its play column ends with `end("lose")`. Checkpoints are rest ledges, **not respawns**: no lives, teleports or height reset. That preserves the climbing risk and one simple height/clock proof. The tower continues until a fall or the shell's 30-minute cap (`"timeup"`); there is no finish bonus or `"win"`.

## Controls

Matches existing `meta.controls.scheme: "platformer"`, keyboard "Left / right to move, Space to jump", touch "Joystick + Jump button".

- Left/right arrows or A/D set `input.moveX`; clamp to [-1, 1]. Ignore moveY, tap, swipe and action. Motion is on the x/y plane at z = 0; right is +x on both aspects.
- Space / the touch Jump button uses the one-frame `jumpPressed` edge. Held jump never auto-jumps and there is no variable-height jump or double jump. The joystick's x component is analog.
- Ground and air both set horizontal velocity to `3 * moveX` m/s immediately (air-control multiplier 1.0); releasing stops horizontal input motion. A moving support adds its horizontal carry only while grounded. Esc/P, hidden tab and blur use shell pause.
- A jump press is buffered for 120 ms of simulation time. Walking off a ledge leaves 100 ms of coyote time. The first accepted jump consumes both buffer and the single grounded/coyote permission; that permission rearms only on a valid descending landing. Track edges during the opening hold, but discard them at its end so held Space cannot launch automatically.

## Constants

World units are metres. Heights/collision coordinates use metres; generation samples heights in integer millimetres.

| Name | Value / invariant |
|---|---|
| Gravity / jump velocity | 10 m/s² downward / +4 m/s |
| Jump apex / time to apex | 0.8 m / 400 ms |
| Horizontal speed / air control | 3 m/s / 1.0 |
| Minimum interval between accepted launches | 400 ms; no platform/buffer/coyote path can bypass it |
| Coyote / jump buffer | 100 / 120 ms, inclusive deadline |
| Runner collision / draw size | Foot point plus horizontal half-width 0.22; visual 0.55 m high, 0.44 wide, 0.40 deep, floor-pivoted in `assets.ts` |
| Ordinary platform | 1.4 wide × 0.6 deep × 0.16 thick; one-way top |
| Required height steps | 0.45, 0.50 or 0.55; consecutive base-centre shift ≤1.0 |
| Required platform base centres | x in [-1.0, 1.0], on a 0.1 grid |
| Moving platform | Horizontal only, ±0.20 m triangular travel, period 2000 ms, speed ≤0.40 m/s; no vertical lifts |
| Crumbling spur | 0.8 wide, only beside a static required platform; centre shift 1.2 m to side `-sign(x)` (seeded left/right when x = 0); 800 ms warning, then collision removed and visual falls with gravity 6 m/s², capped at 6 m/s |
| Checkpoint | Every 8 m / 16 required steps; permanent 4.4-wide ledge centred at x = 0 |
| Coin density / pickup | One unique coin at each positive 8 m band, radius 0.30; pickup reach 0.52 and feet-height gate described below |
| Height / coin points | 10 per whole metre of new maximum foot height / 25 per coin |
| Opening protected hold | 350 ms of simulation time; feet stay on start ledge, no jump, falling or points |
| Earliest loss result | 3000 ms of integer simulation time; an earlier fall latches failure and waits without further motion or awards |
| Rising bottom / look-ahead | `viewBottomY = maxHeight - 2.0`; fit up to `maxHeight + 4.0` |
| World play bounds | Runner centre x clamped to ±1.98, z = 0; camera guard box x = ±2.3, z = ±0.6 |
| Run cap / maximum frame | 1800000 ms shell duration / core `MAX_FRAME_DT = 0.05` s |
| Pools | 32 required platforms, 16 optional spurs, 4 coins, 4 flags, 8 decorative tower sections |

The 350 ms hold is a brief "Left/right, then Jump" introduction on a broad ledge. Horizontal practice is allowed but cannot leave it or award points. After unlock, play starts immediately. To meet the server's 3 s minimum, a fall before `run.timeMs >= 3000` sets `pendingLose`, clears jump permission/buffer and freezes gameplay state/awards; only the simulation clock continues until the loss result is allowed. This records the failure when it happens and adds no recovery or invulnerability. Pause freezes that wait too.

## Rules

### Seed, generation and recycled pools

- On each Scene mount, outside rules, the lazy initializer draws a fresh unsigned 32-bit seed with core `randomSeed()`, then passes it to `createRun(seed)`. Retry/restart remount by `runId`. Strict Mode may evaluate the initializer twice; it has no external effects, and only committed state is used. Asset seed 5050 is unrelated to the gameplay seed.
- Rules use core `createRng(seed)`, **mulberry32**. Integer weighted draws use `floor(rng() * totalWeight)` and cumulative integer weights. Required ordinary platforms use static:8, moving:2; checkpoints and the first two steps are always static. Optional-spur presence uses absent:1, present:1, subject to reachability. A separate stream `(seed ^ 0x9e3779b9) >>> 0` supplies decoration, so visual choices cannot alter physics.
- Each 8 m block has eight pairs of height steps. Uniformly choose a pair from (450, 550), (500, 500), (550, 450) mm: each pair totals 1000 mm, and the 16th platform is exactly the next checkpoint height. Choose each x from the grid candidates satisfying bounds and neighbour distance; at step 16 use x = 0. Since all base centres are within ±1.0, that final shift also satisfies the bound. A missing candidate uses the previous base centre; validation must still pass, with no retry-until-lucky loop.
- Precompute 451 blocks (7216 required descriptors, through 3608 m) on mount. This exceeds the proof's maximum reachable height plus look-ahead. Reward/flag descriptors are needed only for reachable bands 1..450; the last checkpoint is a guard beyond the play window, so its props need no extra next block. All descriptors, optional slots, absolute IDs and phases are fixed for the seed. Rules take this seed; no random draws or layout allocations occur in the frame loop.
- An optional crumbling spur is at the same height as an **ordinary static** required platform, never a moving platform or checkpoint. Set `side = -sign(x)`; at x = 0 draw left/right with seeded integer weights 1:1. Its centre is `x + side * 1.2`. Admit only when within ±1.2 and within 1.0 of the next required base centre; otherwise omit it. Static attachment guarantees a physical gap `1.2 - (1.4/2 + 0.8/2) = 0.10 m`, without moving-platform travel closing it. Never replace a required platform. There is at most one spur per pair; it offers another launch position, no extra height or coin.
- Generate the next block's step 1 before placing the checkpoint's coin/flag. Choose the side opposite that step's base x (seeded integer choice if x = 0): coin x = `side * 1.50`, flag x = `side * 1.90`. Coin radius is 0.30; flag's full visible x half-width is at most 0.20 including its pennant. Reserve the first slab's full possible x-range `[nextX - 0.90, nextX + 0.90]` (0.70 half-width + 0.20 travel), even when static. For nextX ≥0 and side = -1, the coin occupies [-1.80, -1.20] and flag [-2.10, -1.70], both left of the slab's minimum ≥-0.90; mirror for nextX <0. This gives at least 0.30 m coin clearance and 0.80 m flag clearance for every seed. Both stay on the 4.4 m checkpoint ledge, away from the next block's first slab. Validate these ranges, not just prop centres.
- Pools hold descriptors in the 10 m moving window `maxHeight - 4` through `maxHeight + 6`. Recycle only after a slot is below the loss boundary and is neither support nor a pending collision target. Write transforms/kind/absolute ID into existing slots; never remount/dispose geometry during play. Monotone descriptor cursors and coin IDs prevent respawning rewards. This window needs fewer than 32 required platforms and 16 spurs; 4 coins/flags cover its 8 m bands. Candidate collision data may extend beyond the visible column; render geometry clipped at its y bounds, and hide a flag until its full 0.8 m height fits. Detached/unused slots have no collision.

### Kinematic physics and reachability

No Rapier. Between events use the analytic arc `y(t) = y0 + 4t - 5t²`, `vy(t) = 4 - 10t`, horizontal input velocity capped as above. One-way collision accepts only a descending crossing of a platform top from above, with horizontal footprint overlap at the crossing time. Jumping through its underside never lands. Solve the crossing within each integration slice, use interpolated platform x, and choose the earliest valid support; ties use the absolute platform ID. Never snap feet upward beyond the analytic trajectory's maximum.

Physics consumes integer-ms slices no longer than 1 ms, with swept top crossings, not a discrete end-position overlap. Resolve the collision within a slice, finish its remaining motion once, and process a buffered launch only at an integer-ms boundary. Use absolute integer deadlines for coyote, buffer, warning and minimum launch interval. This avoids tunnelling and frame-size-dependent jump height; it does not mean rendering 1000 times a second.

**Every required next platform is reachable:** apex is `4² / (2 * 10) = 0.8`, 0.25 above the highest allowed rise. The descending arrival for rise d is `t(d) = (4 + sqrt(16 - 20d)) / 10`. For d in [0.45, 0.55], t is 0.623607–0.664575 s. Even when both platforms move to their worst extremes, centre separation is at most `1.0 + 0.2 + 0.2 = 1.4`. Available horizontal travel at the earliest landing is `3 * 0.623607 = 1.870820`, a **0.470820 m** margin. From the departure centre, a chosen constant velocity of at most `1.4 / 0.623607 = 2.245` reaches any arrival phase; keyboard players can move at full speed, then release. The platform's usable full-support half-width is `0.7 - 0.22 = 0.48`, covering 1 ms input discretization (≤0.0034 m). Reaching the centre is stronger than merely overlapping an edge.

Moving platforms stay at a fixed height, have no disappearance deadline, and can be waited on. Their full travel range is already in the proof. They carry horizontally, never boost a jump vertically. An admitted spur is at most `1.0 + 0.2 = 1.2 m` from the next required centre including its motion; returning to its static counterpart is a same-height jump (0.8 s, 2.4 m horizontal reach versus 1.2 m separation). Its 800 ms warning exceeds the ≤665 ms next-platform flight. Collapse may punish waiting, but cannot erase the required route or its safe departure surface. Falling visuals have no collision after warning expiry.

### Simulation timing and frame order

**Every gameplay timer, physics motion, moving-platform phase, crumble warning/fall, pending-loss wait and rising camera anchor advances only from the simulation `useRunFrame` dt passed to `rules.ts step(state, dt, input)`.** `dt` is in seconds, exactly the store's `frameMs / 1000`, at most 0.05. The countdown transition includes only its counted residual play time. No `setTimeout`, `performance.now`, `Date.now`, tween completion callbacks or stored `state.clock.elapsedTime`.

Convert seconds to ms with a carried fractional remainder: add `dt * 1000` to the remainder, take its whole milliseconds, keep the fraction in [0, 1), and increment integer `run.timeMs` by those whole ms. Do not round each frame or discard its fraction. This rules clock never runs ahead of cumulative counted play dt and trails it by less than 1 ms. Advance physics and gameplay deadlines from these consumed ms. dt ≤0 or non-finite does nothing. A jump edge is enqueued once per frame, never per substep; carry remaining time through hold/collapse/landing boundaries once. Paused redraw/refit cannot consume the remainder.

Use default-priority `useRunFrame`, without an override. `FRAME_PRIORITY` orders input (-2) → run clock (-1) → game time (-0.75) → simulation (-0.5) → CameraRig (-0.25) → plain `useFrame` visuals (0). This holds regardless of child/mount order. Pure tests drive the same order with `advanceRunClock(store, delta)` and `playedFrameDt(store.getState())`.

Visual callbacks use core `useGameTime()`: coin spin/ambient bobbing use `now`, decorative easing uses `delta` (0 paused), and play-bound animation/optional runner clips use `play` or the current rules pose. `now` also advances outside playing, so it must never trigger a launch, collapse, pickup or end. Runner root, moving slabs, warning progress and falling debris read rules state; visual easing cannot change collisions or finish a gameplay event. No visual callback advances rules. CameraRig handles visual easing after the monotone simulation anchor has updated.

### Height, coins and end

- `maxHeight` is the greatest foot y reached, measured from the start ledge y = 0. Use the analytic peak inside a slice too, not only its final y. Award +10 when each previously unawarded integer metre is crossed. Descending, landing, checkpoint visits and camera motion do not award height.
- The coin for band k has absolute ID k, eligibility height `8 * k`, and is drawn 0.30 m above that checkpoint at x = ±1.50, on the side chosen above. It can be collected only once, with feet at/above `8 * k`, the runner's pickup centre `(x, footY + 0.275, 0)` within 0.52 of its draw position, and `maxHeight >= 8 * k`. A big mesh/pickup radius cannot award the next band's coin early. At most `floor(maxHeight / 8)` coins can ever count; missed coins below the camera are lost. Checkpoints give no points.
- After physics/peak/coin events, set `viewBottomY = maxHeight - 2.0`. The simulation camera anchor F = `maxHeight` never decreases. A descending feet crossing below that bottom latches loss once, after reporting score/height up to the crossing; stop further gameplay at that event, including the rest of the frame. If `run.timeMs < 3000`, advance only the integer clock until 3000 before `end("lose")`; otherwise end immediately. The boundary is the bottom of the fitted **play column**, independent of viewport, not a device-dependent screen ray. Draw a faint danger strip there and hide tower geometry below it.
- Report score changes with imported core `capScore(rawScore, store.elapsedMs, towerClimbMeta.scoring)` as a safety net; the proof requires it to leave every reachable score unchanged. Shell time-up runs before Simulation and wins same-frame ties, with no later pickups; the store already holds the capped score from its latest award. GameShell submits the store score and default rounded `elapsedMs`; no `finalScore` override, API calls or game-local persistence. Coin sound is `playSfx("pickup")`; falling loss is `playSfx("hit")`, once each event.

## Scoring

| Event | Points |
|---|---|
| New maximum foot height | +10 per whole metre, `10 * floor(maxHeight)` in total |
| Unique coin | +25; at most one per 8 m band |
| Checkpoint, repeat height, fall or time-up | No bonus |

Raw score is `10 * floor(maxHeight) + 25 * collectedCoins`, integer `pts`. For example, 17.9 m and two coins gives 170 + 50 = **220**; dropping to 12 m and recovering to 17.9 adds nothing. No multiplier or time bonus.

### Server limits and why they hold (the proof)

Existing metadata and WP config stay unchanged: `kind: "points"`, `maxScore: 50000`, `base: 0`, `maxPointsPerSec: 100`, `minDurationMs: 3000`, `maxDurationMs: 1800000`, `unitLabel: "pts"`, `display: "int"`. Server checks integer score, `score <= 50000`, duration D in [3000, 1800000] ms and `score * 1000 <= 100 * D`.

1. **Counted clock and short start.** `dt = frameMs / 1000` includes the counted play remainder of the countdown-transition frame: there is no untimed simulation frame. Pause advances neither clock. Integer rules time is ≤ cumulative counted dt. Let D be GameShell's `Math.round(elapsedMs)` and t = D/1000; rounding down costs at most 0.5 ms. Retain **50 ms only as conservative slack**, not a core behaviour or test premise. After the 350 ms hold, climbing time U is bounded by `U <= max(0, t + 0.0505 - 0.350) = max(0, t - 0.2995)`. Actual core timing has the tighter bound `max(0, t - 0.3495)`. An early fall freezes awards and defers its result until integer rules time ≥3000, which implies submitted D ≥3000. Time-up has D =1800000. Quit does not submit.
2. **Maximum climb rate for any input/seed.** A jump rises at most 0.8 m above its launch height. Consecutive accepted launches are at least 400 ms apart (the apex time); ordinary descending landings are later still, at least 623.607 ms. The explicit launch guard also covers coyote/buffer/collision rounding. With U seconds of climbing, there are at most `1 + U/0.4` launches. A launch starts no higher than the previous maximum; platforms provide no upward carry, spring boost or respawn. Thus `H = maxHeight <= 0.8 * (1 + U/0.4) = 0.8 + 2U`. Waiting, walking off or taking a collapsing spur cannot increase this bound.
3. **Coin density and rate for every prefix.** Collected coins q satisfy `q <= floor(H/8)`. Thus `S = 10 * floor(H) + 25q <= (10 + 25/8)H = 13.125H`. During the hold S =0. Thereafter t ≥0.3495, so `S <= 13.125 * (0.8 + 2 * (t - 0.2995)) = 26.25t + 2.638125 <= 100t`; the margin is `73.75t - 2.638125`, positive already at unlock. At the earliest submitted loss t =3, the margin is at least **218.611875 points** and grows thereafter. Frozen early-loss scores stay valid as their duration increases. This covers every input/seed, same-step awards, idle input and terminal result. Multiply by 1000 for the integer server inequality.
4. **Absolute cap with the 350 ms hold.** At t ≤1800, U ≤1799.7005, hence H ≤3600.201 m. Discrete awards give `S <= 10 * 3600 + 25 * floor(3600.201/8) = 36000 + 11250 = 47250`, **2750 below 50000**. The loose continuous bound is 47252.638125. A run cannot reach 50000 before the 30-minute cap, or at that cap. The precomputed 3608 m route exceeds this H plus the 6 m pool look-ahead (3606.201 m).
5. **Core safety net and terminal duration.** Import `capScore(score, durationMs, rules)` and `withinServerLimits(score, durationMs, rules)` from `core/limits.ts`; pass raw store `elapsedMs`, which those helpers round like GameShell. No local cap implementation or `finalScore` override. Tests require the cap to be a no-op on every reachable award/terminal result and every terminal result to pass `withinServerLimits`; a clamp must not hide broken physics/density. Exercise countdown carry, duration rounding and carried rules remainder against the real store. The proof's extra 50 ms remains slack only. An idle runner stays on the start checkpoint and times out at 1800000 ms with **0 points**.

## Scene and camera

Set `meta.orientation: "portrait"`. This is client-only and changes no WP scoring value: the shell owns its rotate overlay and pause behaviour on coarse landscape devices. Fine-pointer landscape windows still use the fitter. There is no game-local landscape/size pause gate or fit-blocked Resume hint.

World play is the x/y plane; the tower sits behind it. Runner root z = 0, visual height **0.55 m**, floor pivot unchanged; ordinary slabs are only 0.45–0.55 m apart. Scale the shared runner and its primitive to the same visible size in `assets.ts`/fallback, keeping the 0.44 m collision footprint independent of the mesh. Checkpoint coin and flag sit on the side away from the next block's step 1 and outside its entire x-range, as proven above. Required slabs extend to x ±1.9 including motion, checkpoint ledges to ±2.2. The guard at anchor F = maxHeight is x = ±2.3, y = F-2..F+4, z = ±0.6. Clip render geometry at the column's y bounds and keep complete flags/coins within them. Runner feet normally sit at y = F, with the next 4 m visible above.

Use the core fit/follow contract, with module-level constants rather than a `camera.ts` or local projection solver:

1. `AREA = { min: { x: -2.3, y: -2, z: -0.6 }, max: { x: 2.3, y: 4, z: 0.6 } }`, expressed relative to F. Fixed yaw `atan(3/12) = 0.244979 rad` (14.036°); pitch `atan(2/sqrt(153)) = 0.160303 rad` (9.185°). Vertical FOV 45°, near 0.1 / far 400. Left/right stays +x/-x; the fixed yaw never changes with aspect or a banner.
2. `useFittedView({ area: AREA, pitch: PITCH, yaws: [YAW], focus: FOCUS, margin: { top: 0.02, right: 0.02, bottom: 0.02, left: 0.02 }, padding: 8, shift: true, fov: 45 })`. It reads live `useSafeArea()` HUD/control/obstruction rectangles itself; also use `useSafeArea` for projection acceptance checks. Keep avoidance defaults on. Do not reproduce CSS rectangles/insets or read `useBottomObstruction` in game code. Any game HUD panel is marked `data-arcade-safe-area`.
3. Allocate one live follow point `(0, F+1, 0)`, updated by rules. Render `<CameraRig camera={{ position: view.offset, lookAt: [0, 1, 0], fov: 45 }} follow={run.cameraTarget} followFraction={1} offset={view.offset} shift={view.shift} damping={8} />`. It follows after simulation. F is monotone and never follows the falling runner; fixed-fit camera aim/position rises toward that target, while resize may adjust its offset/lens without changing F or the loss line.
4. Include follow lag in the fit. Maximum upward target speed is 4 m/s, so damping 8 has ≤0.50 m lag (each frame's `dF <= 4 * dt`; the exponential update bounds residual lag by 4/8, and camera delta is at least the counted simulation dt). In coordinates relative to F, camera aim therefore lies from `(0, 0.5, 0)` through `(0, 1, 0)`. Build `FOCUS = followFocus({ lookAt: [0, 1, 0], reach: { min: { x: 0, y: 0.5, z: 0 }, max: { x: 0, y: 1, z: 0 } }, fraction: 1 })`. The same follow math is used by CameraRig; translating AREA and this aim range by F preserves fit for any tower height. Browser tests also cover the core rig's eased refits when safe areas change.

**Measured core projection checks** using the current pure `fitView`, `setLensShift` and installed Three.js `Vector3.project`, F =0. Nominal snapshot inputs: HUD x =0..W, y =0..64; zero insets/banner; joystick 132 px at left/bottom 20; Jump 72 px at right/bottom 20; avoidance padding 8 px. These rectangles are measurement inputs only; runtime uses `useSafeArea`. The table covers both aim endpoints, moving-platform centres ±1.2 at relative heights -2..4, and runner centres ±1.98 with feet -2..0. Values are mathematical design checks, not browser gameplay measurements.

| Viewport | Fitted distance; offset x/y/z (m) | Lens shift x/y (NDC) | Projected whole column (CSS px) | Minimum ordinary platform width / 0.55 m runner height |
|---|---|---|---|---|
| **375 × 812** | 13.502; 3.233 / 2.155 / 12.931 | 0.001776 / 0 | x **7.500..367.500**, y **134.518..645.683** | **91.44 / 35.85 px** |
| **812 × 375** | 11.032; 2.641 / 1.761 / 10.566 | 0.000578 / -0.229294 | x **303.274..508.726**, y **72.000..367.500** | **50.85 / 19.85 px** |

Portrait joystick occupies x 20..152, y 660..792; Jump x 283..355, y 720..792. Landscape joystick occupies x 20..152, y 223..355; Jump x 720..792, y 283..355. Both projected columns avoid the padded controls/HUD. Portrait exceeds the 44 px platform /32 px runner acceptance targets; landscape runner readability does not, so coarse devices use the shell's portrait rotate overlay. The landscape row is a fit diagnostic, not permission for touch landscape play or a local pause trigger. Fine-pointer landscape renders with the same core fit (no touch rectangles), while live insets, banners and UI panels are browser checks.

Rendering uses fixed pools and shared geometries/materials. Use core `Instanced`/`spotMatrix` for primitives and `BlobShadow` for contact shadows; no shadow maps. Moving platform/coin instance matrices are written in plain `useFrame` with scratch objects allocated once, reading rules and `useGameTime`. `useInstanceMatrices`/`InstancedModel` write on spot-array changes, not every frame: checkpoint flags are static between rare slot-recycling events, so update their stable-count spot snapshot only on those events, outside `step`, without remounting geometry or per-frame React state. Shared runner uses `<Model asset={ASSETS.runner} fallback={<RunnerPrimitive/>} />`; repeated flags use `<InstancedModel asset={ASSETS.flag} spots={...} fallback={<FlagInstances/>} />` with instanced primitives. Optional clips use `useModel` only when needed; rigid lean/squash works without a rig. Core `MODEL_MANIFEST` / `hasModel` sends unlisted URLs straight to fallbacks with no request/suspense. Claude's assets PR adds a GLB and its manifest entry together. Reduced motion reduces decoration, never physics/warning duration. Target ≤150 draw calls /60 fps on a mid phone; runtime performance is pending.

## Assets

| Model | Source | Spec | Fallback / purpose |
|---|---|---|---|
| runner | **shared** `/models/3d/shared/runner.glb` | `assets/shared.spec.json`; not duplicated here | `<Model fallback>` hoodie/head/sneakers, scaled to 0.55 m visible height; physics unaffected by mesh/rig |
| checkpoint flag | This game `/models/3d/tower-climb/checkpoint-flag.glb` | `./assets.spec.json` | Short pole with yellow pennant; identifies the permanent rest ledge among moving/orange slabs |
| platforms, coins, tower, checkpoint ledges, danger strip | Code primitives | None | Contrasting boxes, gold discs/rings, repeated tower panels; collision lives in rules |
| spring pad | Omitted | None | No spring mechanic: vertical boosts would change jump reachability and score bounds |

Universe **`shared-cast`**, generation seed **5050**, matching the shared runner. `assets.spec.json` is unchanged. Only the checkpoint flag adds a recognisable rest marker; one text-mode Gen-2.5-Low attempt, qualityOverride 1500, 512 px textures, ≤5000 tris /300000 bytes. GLB, Raw mesh, PBR. Floor pivot y =0; flag height 0.8 m including pole, visible x half-width ≤0.20 m including pennant, no text/base/ground. Tune `scale`/`rotationY`/`yOffset` in `assets.ts` against loaded bounds to meet height/clearance; fallbacks match. Collision never comes from its mesh.

No new character concept is needed: reuse the approved shared runner. Claude owns approved Rodin generation through the official MCP, import/optimization and GLBs; this prep spends no credits or reads keys. Estimated flag budget is one generation (0.5 credit at the plan's provisional rate, actual cost checked before approval). Spring omission removes one planned generation. `skills.md`/plan still list playground and both props; their catalog update belongs to Claude. This hand-off explicitly selects shared-cast/5050 and one useful prop.

## HUD

Exactly `hudStats: [{ key: "height", label: "Height" }]`; initialize height to 0 on Scene mount, update `floor(maxHeight)` on a newly crossed metre, and explain metres in instructions. Shell Score / Time (30:00 countdown) / Height plus mute/pause stays one row. No lives, coins or checkpoint shell stats. A small planned `definition.Hud` may show the 350 ms guidance, checkpoint feedback and an early-fall message while awaiting the 3 s result; mark its panel `data-arcade-safe-area` so core fits around it. It must not intercept controls. No fit-blocked hint, landscape gate or extra permanent row. Announce checkpoints without colour alone.

## Edge cases

- Pause mid-jump freezes velocity, coyote/buffer deadlines, moving supports, camera anchor and integer remainder. Resume consumes only new simulation dt; no catch-up, duplicate jump edge or renderer-clock reset effect.
- Pause while standing on a warning platform preserves its remaining warning exactly; the visual cannot fall offscreen while collision stays behind. A resumed warning can expire only after its remaining simulation ms. A support's collapse at a jump boundary removes support first; an already valid coyote permission/buffer may still launch, once.
- Fast downward crossings use the swept top test. Touching an underside/side does not restore jump permission. A landing/buffer within one frame carries remaining time once, and the 400 ms launch guard always holds. Walking off does not create repeated coyote jumps.
- If a new peak raises the bottom past the runner after a fall, report earned score then latch loss once. Before 3000 ms, freeze gameplay/awards and wait using only simulation time; pause/restart honours the pending state. No checkpoint teleport or recovery during that wait. Time-up takes precedence over same-frame collision/pickup; score and duration match the shell's ended state.
- Restart/retry rebuilds seed, descriptors, pools, deadlines, remainder, score and camera anchor; consumed coins never leak into the next run. Mount/suspense/loading time does not start rules time.
- Rotate/resize refits the same state, preserving left/right and loss height. Only the shell's coarse portrait policy owns orientation pause/overlay; fine-pointer landscape has no game-local gate. Unlisted/broken runner or flag GLBs use explicit `Model`/`InstancedModel` fallback elements, with no separate clone/failure-check component.

## Test plan

Planned `rules.test.ts` (Vitest, pure state/fake input; no sleeps):

- **1000 seeds**, plus uint32 extremes: same descriptors/phase/pool IDs for the same seed; all 451 blocks sum to exactly 8 m, steps within 0.45–0.55, all neighbour centre deltas ≤1.0, checkpoints fixed, no missing required link. Verify every link with the arc math at both moving endpoints, and drive a landing controller through every platform type/phase. Mutations exceeding rise/shift must fail validation. Validate admitted spurs/return paths, static-only attachment, 0.10 m minimum gap, `-sign(x)` side and both seeded x =0 choices. Verify every checkpoint coin/flag lies opposite the next block's step 1, outside its full slab range, including visible extents/travel.
- One-way/swept physics: upward pass-through, descending centre/edge landings, no upward snaps, fall tunnelling, boundary clamp, moving carry, no vertical boost. 1/16/33/50 ms and irregular clamped frames reproduce analytic apex/landing tolerances and never accept launches <400 ms apart.
- Coyote at 99/100/101 ms; buffer at 119/120/121 ms; held jump/no repeat; consume permission once, no midair rearm, buffered landing jump, simultaneous warning expiry/jump, dt ≤0/non-finite ignored. In each case use absolute ms deadlines, not frame counts.
- Integer-ms remainder at 60/120 Hz and mixed dt: no rounded-frame drift, clock ≤ cumulative counted dt with <1 ms lag. Pause adds no time/remainder/motion; unpausing does not catch up. Split 350/800/3000 ms deadlines exactly; discard jump edges at hold unlock. An early fall latches failure, clears buffer and freezes score/physics; result waits to 3000, with no recovery/repeated event.
- Coins unique per absolute band ID, feet-height gate, missed/recycled coins never regenerate, revisiting height/checkpoint gives nothing. 17.9 m/two coins =220; opening hold and an idle 30-minute run score0. Validate coin density for every reachable prefix.
- Drive real `createArcadeStore` with `advanceRunClock` → `playedFrameDt` → `step` through countdown carry, immediate fall after the 350 ms hold, pending-loss pause/restart and time-up. Sum simulated dt ≤ counted `elapsedMs`; test counted residual play time rather than an untimed-frame assumption. D≥3000 on every submitted loss, D=1800000 on time-up; rounding/remainder retain the proof. Enumerate metre/coin thresholds and launch bounds across the duration window: every reachable award leaves core `capScore` unchanged; terminal results pass core `withinServerLimits`; theoretical maximum ≤47250, never 50000. A before-3 s prefix is not a submitted result and need not pass the helper's minimum-duration check.
- Recycled-slot identities/geometry stay fixed across hundreds of blocks; no support/pending target recycled, active counts stay within pools, no allocations in step, no repeated score/sound/end event. Generator stream does not change when decoration is disabled.
- Core integration: simulation precedes camera/visuals regardless of component order; pause freezes `useGameTime` visual animation while gameplay still uses only counted dt. Core already tests these generic contracts in `frameLoop.test.ts`; add Tower-specific pose/deadline checks. Pure `fitView` + matching follow-focus endpoints keeps the column clear of safe rectangles, fixed yaw, lag ≤0.50 m and monotone fixed-fit follow target. Test updated portrait projection sizes and prop/runner visible bounds using core helpers; keep the Tower rules-clock remainder tests above without duplicating a generic clock hook, fitter or limit function.

**Browser acceptance plan (pending game implementation):** local production build with arcade enabled and API mock enabled; never production WordPress.

- Desktop 1280 ×800 keyboard, **375 ×812** touch and a real phone: ready → countdown → 350 ms hold → climb static/moving ledges → collect coin → checkpoint → pause/resume → crumble → fall/result → Retry → Exit. At **812 ×375** coarse landscape verify the shell rotate overlay, frozen simulation and normal Resume flow after returning to portrait; also test a fine-pointer window at that size with no local gate. Verify joystick x + Jump, one-row HUD, one loss/sound/submission and early-fall wait to 3 s. Run idle time-up with a local simulated clock, never a production upload.
- Measure canvas projections against live `useSafeArea` HUD/joystick/Jump/banner rectangles and the nominal table. Test moving extremes, follow lag, both horizontal bounds, safe insets, banners open/closed and midair rotation/refit. Portrait runner height ≥32 px / platform width ≥44 px; required column clears actual UI. Verify 0.55 m runner and opposite-side coin/flag remain visible below the next slab, with no prop overlap. Eased core refit must be checked in the browser; any shared fit bug goes to Claude instead of a local solver/pause gate.
- Pause 2.5 s mid-ascent, near coyote/buffer expiry, while riding a moving slab and during crumble warning; tab-hide/blur and long raw frames. State/clip pose/remaining ms are unchanged on resume, with no catch-up or duplicate event.
- Observe monotone camera follow at fixed fit and an unchanged world loss line through falls/resizes. Check raw score against mock-submitted rounded duration and the integer server inequality on early loss, long climb and time-up. Unlisted GLBs generate no network requests; listed load failures use custom fallbacks. Reduced motion and context recovery remain playable.
- Confirm constant mesh/instance counts after many recycled blocks, no remount spikes, ≤150 draw calls, 60 fps target, control focus and no horizontal overflow. Screenshots/performance measurements remain pending.

## Known issues and core gaps

- This is a design/spec only; the placeholder is not playable. Physics, real-store proof tests, browser fit and performance checks must be built before status changes. This update changes only the README and metadata orientation; scoring and asset JSON are unchanged.
- Tower's analytic one-way platform physics and integer gameplay deadlines belong in pure rules. Reuse existing core hooks/helpers; request any additional generic helper from Claude rather than copying an engine into the game. No Rapier/core edit is needed.
- Shared runner animation availability is optional. Its later assets calibration must achieve the 0.55 m visual height, and the flag must meet the ≤0.20 m visible half-width/clearance. Fallbacks use the same dimensions; animations never drive physics.
- Browser measurements of notches, marked custom HUD panels and CameraRig's eased resize/banner refits remain pending. Core's cookie-obstruction measurement polls about once per second; test that transient as in the reference. Coarse landscape uses the shell rotate overlay; no game-local hard pause gate.
- Only the flag is requested, with shared-cast/5050. Catalog updates and approved GLB + `modelManifest` entries belong to Claude. Manifest-gated fallbacks already cover unlisted models without 404s; no new core gap is assumed.
