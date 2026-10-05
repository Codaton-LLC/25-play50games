# Tower Climb

Owner: Codex. Slug: `tower-climb`. Game 7 of the 3D Arcade. Accent `#06b6d4`. **Prep only:** this README and `assets.spec.json` are the design; the existing `meta.ts` and placeholder `index.tsx` stay unchanged, with status `"soon"`. Scene, rules and tests below are planned, not implemented.

| File | What it owns |
|---|---|
| `meta.ts` | Existing server-safe card data, `orientation: "any"`, platformer controls and scoring matching `arcade-games.json`. |
| `index.tsx` | Planned `GameDefinition`: Scene, assets, `durationMs: 1800000`, camera, joystick + jump, one height HUD stat; no lives. |
| `rules.ts` | Planned pure `createRun(seed)` and `step(state, dt, input)`: generator, kinematic physics, collision, integer-ms clock, platform states, coins and score. No React/three.js/DOM/`Math.random`. |
| `rules.test.ts` | Planned Vitest for reachability, coyote/buffer, determinism, pools and the scoring proof. |
| `Scene.tsx` | Planned mount seed and fixed pools, first-child Simulation, rendering, store reports and sound events. |
| `Primitives.tsx` | Planned tower, platforms, coins, checkpoint ledges, runner/flag fallbacks and blob shadows. |
| `camera.ts` | Planned monotonically rising camera and aspect-dependent fit between HUD and touch controls. |
| `assets.ts` / `assets.spec.json` | Planned runner/flag `ModelAsset`s / one flag generation request. |

### What a new game copies from here

- Use robot-collector on main as the structure template: the file split, pure seeded rules, server-safe metadata, `GameDefinition`, store reporting and tests proving the server limits. Games never import one another.
- Make state once in Scene's lazy `useState` initializer, render `<Simulation />` first, then camera and visuals. Simulation calls `useRunFrame` → `step(state, dt, input)` → store actions/events. Visual callbacks read the resulting state; they never advance it or call setState per frame.
- Reuse core `useRunFrame`, `useInput`, store, `useModel`, `Model`, audio and `useBottomObstruction`. Recheck `CLAUDE.md` and core before implementation: current main has no shared pause-safe game clock, simulation-priority option or free-screen camera fitter. Adopt those helpers if they arrive; otherwise use the local clock/order/fit contract below. Do not copy robot-collector's floating animation clock or its warehouse camera unchanged.
- Tower adds an analytic one-way platform jump, a reachable permanent route, optional collapsing detours, unique height-band coins and bounded recycled pools. Do not copy warehouse collision, battery effects, layouts or scoring. Generic rendering utilities may be copied locally only while absent from core.

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
| Runner collision / draw size | Foot point plus horizontal half-width 0.22; visual 1.0 m high, 0.44 wide, 0.40 deep |
| Ordinary platform | 1.4 wide × 0.6 deep × 0.16 thick; one-way top |
| Required height steps | 0.45, 0.50 or 0.55; consecutive base-centre shift ≤1.0 |
| Required platform base centres | x in [-1.0, 1.0], on a 0.1 grid |
| Moving platform | Horizontal only, ±0.20 m triangular travel, period 2000 ms, speed ≤0.40 m/s; no vertical lifts |
| Crumbling spur | 0.8 wide; 800 ms visible warning after first landing, then collision removed and visual falls with gravity 6 m/s², capped at 6 m/s |
| Checkpoint | Every 8 m / 16 required steps; permanent 4.4-wide ledge centred at x = 0 |
| Coin density / pickup | One unique coin at each positive 8 m band, radius 0.30; pickup reach 0.52 and feet-height gate described below |
| Height / coin points | 10 per whole metre of new maximum foot height / 25 per coin |
| Opening protected hold | 3050 ms of simulation time; feet stay on start ledge, no jump, falling or points |
| Rising bottom / look-ahead | `viewBottomY = maxHeight - 2.0`; fit up to `maxHeight + 4.0` |
| World play bounds | Runner centre x clamped to ±1.98, z = 0; camera guard box x = ±2.3, z = ±0.6 |
| Run cap / maximum frame | 1800000 ms shell duration / core `MAX_FRAME_DT = 0.05` s |
| Pools | 32 required platforms, 16 optional spurs, 4 coins, 4 flags, 8 decorative tower sections |

The opening hold is a short "Get ready — left/right, then Jump" introduction on a broad ledge. It also guarantees the server's 3 s minimum even if the player immediately falls after controls unlock. Horizontal practice is allowed on that ledge but cannot leave it; opening-hold motion awards nothing.

## Rules

### Seed, generation and recycled pools

- On each Scene mount, outside rules, the lazy initializer draws a fresh unsigned 32-bit seed with `crypto.getRandomValues(new Uint32Array(1))[0]`, then passes it to `createRun(seed)`. Retry/restart remount by `runId`. Strict Mode may evaluate the initializer twice; it has no external effects, and only committed state is used. Asset seed 5050 is unrelated to the gameplay seed.
- Rules use **mulberry32**. Integer weighted draws use `floor(rng() * totalWeight)` and cumulative integer weights. Required ordinary platforms use static:8, moving:2; checkpoints and the first two steps are always static. Optional-spur presence uses absent:1, present:1, subject to reachability. A separate stream `(seed ^ 0x9e3779b9) >>> 0` supplies decoration, so visual choices cannot alter physics.
- Each 8 m block has eight pairs of height steps. Uniformly choose a pair from (450, 550), (500, 500), (550, 450) mm: each pair totals 1000 mm, and the 16th platform is exactly the next checkpoint height. Choose each x from the grid candidates satisfying bounds and neighbour distance; at step 16 use x = 0. Since all base centres are within ±1.0, that final shift also satisfies the bound. A missing candidate uses the previous base centre; validation must still pass, with no retry-until-lucky loop.
- Precompute 451 blocks (7216 required descriptors, through 3608 m) on mount. This exceeds the proof's maximum reachable height plus look-ahead. All descriptors, optional slots, absolute IDs and phases are fixed for the seed. Rules take this seed; no random draws or layout allocations occur in the frame loop.
- An optional crumbling spur is at the same height as its required platform, with centre shift 1.2 m toward the opposite side of the tower. Admit it only when its centre is within ±1.2 and within 1.0 of the next required base centre; omit it otherwise. Never replace a required platform. The permanent platform at that height remains available before and after collapse. There is at most one spur per pair. Spurs offer an alternate approach position, not extra height or extra coins.
- Pools hold descriptors in the 10 m moving window `maxHeight - 4` through `maxHeight + 6`. Recycle only after a slot is below the loss boundary and is neither support nor a pending collision target. Write transforms/kind/absolute ID into existing slots; never remount/dispose geometry during play. Monotone descriptor cursors and coin IDs prevent respawning rewards. This window needs fewer than 32 required platforms and 16 spurs; 4 coins/flags cover its 8 m bands. Candidate collision data may extend beyond the visible column; render geometry clipped at its y bounds, and hide a flag until its full 0.8 m height fits. Detached/unused slots have no collision.

### Kinematic physics and reachability

No Rapier. Between events use the analytic arc `y(t) = y0 + 4t - 5t²`, `vy(t) = 4 - 10t`, horizontal input velocity capped as above. One-way collision accepts only a descending crossing of a platform top from above, with horizontal footprint overlap at the crossing time. Jumping through its underside never lands. Solve the crossing within each integration slice, use interpolated platform x, and choose the earliest valid support; ties use the absolute platform ID. Never snap feet upward beyond the analytic trajectory's maximum.

Physics consumes integer-ms slices no longer than 1 ms, with swept top crossings, not a discrete end-position overlap. Resolve the collision within a slice, finish its remaining motion once, and process a buffered launch only at an integer-ms boundary. Use absolute integer deadlines for coyote, buffer, warning and minimum launch interval. This avoids tunnelling and frame-size-dependent jump height; it does not mean rendering 1000 times a second.

**Every required next platform is reachable:** apex is `4² / (2 * 10) = 0.8`, 0.25 above the highest allowed rise. The descending arrival for rise d is `t(d) = (4 + sqrt(16 - 20d)) / 10`. For d in [0.45, 0.55], t is 0.623607–0.664575 s. Even when both platforms move to their worst extremes, centre separation is at most `1.0 + 0.2 + 0.2 = 1.4`. Available horizontal travel at the earliest landing is `3 * 0.623607 = 1.870820`, a **0.470820 m** margin. From the departure centre, a chosen constant velocity of at most `1.4 / 0.623607 = 2.245` reaches any arrival phase; keyboard players can move at full speed, then release. The platform's usable full-support half-width is `0.7 - 0.22 = 0.48`, covering 1 ms input discretization (≤0.0034 m). Reaching the centre is stronger than merely overlapping an edge.

Moving platforms stay at a fixed height, have no disappearance deadline, and can be waited on. Their full travel range is already in the proof. They carry horizontally, never boost a jump vertically. Optional spurs have the same next-centre bound after their admission check; returning to their permanent counterpart takes a same-height jump (0.8 s, 2.4 m horizontal reach, versus ≤1.4 m separation including motion). Their 800 ms warning exceeds the ≤665 ms next-platform flight. Collapse may punish waiting, but cannot erase the required route or its safe departure surface. Decorative falling motion has no collision after warning expiry.

### Simulation timing and frame order

**Every timer, physics motion, moving-platform phase, crumble warning/fall, coin spin, runner pose and rising camera anchor advances only from the simulation `useRunFrame` dt passed to `rules.ts step(state, dt, input)`.** No `setTimeout`, `performance.now`, `Date.now`, tween completion callbacks, independent visual delta or stored `state.clock.elapsedTime`.

Convert clamped seconds to ms with a carried fractional remainder: add `dt * 1000` to the remainder, take its whole milliseconds, keep the fraction in [0, 1), and increment integer `run.timeMs` by those whole ms. Do not round each frame or discard its fraction. The integer clock never runs ahead of cumulative dt and trails it by less than 1 ms. Advance physics and every animation from these same consumed ms; visual `useFrame` reads `timeMs`/state only. dt ≤0 or non-finite does nothing. Paused redraw/refit cannot consume the remainder.

Current `RunClock` is priority -1; `useRunFrame` is priority 0 without a priority option. Render Simulation as the first child, followed by the local camera writer and visuals, since same-priority callbacks follow mount order and children mount before parents. The shell clock/input latch run first. Simulation carries remaining time through the opening-hold/collapse/landing boundaries once; a jump edge is enqueued once per frame, never once per substep. Core helpers replacing this arrangement must preserve the ordering and conservative 50 ms countdown allowance.

### Height, coins and end

- `maxHeight` is the greatest foot y reached, measured from the start ledge y = 0. Use the analytic peak inside a slice too, not only its final y. Award +10 when each previously unawarded integer metre is crossed. Descending, landing, checkpoint visits and camera motion do not award height.
- The coin for band k has absolute ID k, eligibility height `8 * k`, and is drawn 0.5 m above that checkpoint at x = ±0.8. It can be collected only once, with feet at/above `8 * k`, the runner's pickup centre `(x, footY + 0.5, 0)` within 0.52 of its draw position, and `maxHeight >= 8 * k`. A big mesh/pickup radius cannot award the next band's coin early. At most `floor(maxHeight / 8)` coins can ever count; missed coins below the camera are lost. Checkpoints give no points.
- After physics/peak/coin events, set `viewBottomY = maxHeight - 2.0`. Camera anchor is exactly `maxHeight`, monotonically nondecreasing. Feet below that rising bottom end the run with `end("lose")`, once, after reporting that step's score/height. The boundary is the bottom of the fitted **play column**, independent of viewport, not a device-dependent screen ray. Draw a faint danger strip there and hide tower geometry below it.
- Shell time-up runs before Simulation and wins same-frame ties; there are no later pickups. GameShell owns submission with its default rounded `elapsedMs`, no `finalScore` duration override, API calls or game-local persistence. Coin sound is `playSfx("pickup")`; falling loss is `playSfx("hit")`, once each event.

## Scoring

| Event | Points |
|---|---|
| New maximum foot height | +10 per whole metre, `10 * floor(maxHeight)` in total |
| Unique coin | +25; at most one per 8 m band |
| Checkpoint, repeat height, fall or time-up | No bonus |

Raw score is `10 * floor(maxHeight) + 25 * collectedCoins`, integer `pts`. For example, 17.9 m and two coins gives 170 + 50 = **220**; dropping to 12 m and recovering to 17.9 adds nothing. No multiplier or time bonus.

### Server limits and why they hold (the proof)

Existing metadata and WP config stay unchanged: `kind: "points"`, `maxScore: 50000`, `base: 0`, `maxPointsPerSec: 100`, `minDurationMs: 3000`, `maxDurationMs: 1800000`, `unitLabel: "pts"`, `display: "int"`. Server checks integer score, `score <= 50000`, duration D in [3000, 1800000] ms and `score * 1000 <= 100 * D`.

1. **Clock, including the untimed countdown frame.** Shell and Simulation consume the same clamped dt. Exactly one countdown-to-playing frame can simulate without increasing shell `elapsedMs`, by at most 50 ms. Pause advances neither. Whole-ms simulation time is ≤ cumulative dt. Let D be GameShell's `Math.round(elapsedMs)` and t = D/1000; rounding down costs at most 0.5 ms. After the 3050 ms hold, climbing time U in seconds is therefore `U <= max(0, t - 2.9995)`. No terminal loss is allowed during the hold: the earliest loss has D ≥3000. Time-up is exactly D =1800000. Quit does not submit.
2. **Maximum climb rate for any input/seed.** A jump rises at most 0.8 m above its launch height. Consecutive accepted launches are at least 400 ms apart (the apex time); ordinary descending landings are later still, at least 623.607 ms. The explicit launch guard also covers coyote/buffer/collision rounding. With U seconds of climbing, there are at most `1 + U/0.4` launches. A launch starts no higher than the previous maximum; platforms provide no upward carry, spring boost or respawn. Thus `H = maxHeight <= 0.8 * (1 + U/0.4) = 0.8 + 2U`. Waiting, walking off or taking a collapsing spur cannot increase this bound.
3. **Coin density.** Collected coins q satisfy `q <= floor(H/8)`. Thus `S = 10 * floor(H) + 25q <= (10 + 25/8)H = 13.125H`. All points are zero during the opening hold. Every later score satisfies `S <= 26.25t - 68.236875 <= 100t` for t ≥3; the margin is at least **289.486875 points** at t =3 and grows thereafter. This covers prefixes, bursts of same-step awards, misses, idle input and every terminal fall, not just a perfect route. The integer server inequality follows by multiplying by 1000.
4. **Absolute cap cannot be reached early.** At t ≤1800, U ≤1797.0005, hence H ≤3594.801 m. Applying the discrete awards gives `S <= 10 * 3594 + 25 * floor(3594.801/8) = 35940 + 11225 = 47165`, **2835 below 50000**. Even the deliberately loose continuous bound stays below 47182. A run cannot reach 50000 before the 30-minute cap, or at that cap. No artificial early score cap is needed.
5. **Defensive submission cap.** Planned `capScore(raw, D)` returns `min(raw, 50000, floor(100 * D / 1000))`. Test that it is a no-op for every reachable terminal result; a clamp must not hide broken physics/density. The 50 ms allowance, 0.5 ms rounding and ms remainder are tested against the real store. An idle runner stays on the start checkpoint and times out at 1800000 ms with **0 points**.

## Scene and camera

Keep existing `orientation: "any"`: both required aspects fit. World play is the x/y plane; the toy tower sits behind it. Runner root z = 0, height 1.0. Required slabs extend to x ±1.9 including motion; checkpoint ledges to ±2.2. The guard box at anchor F = maxHeight is x = ±2.3, y = F-2..F+4, z = ±0.6, covering slab thickness, runner, flag and horizontal movement. Runner feet normally sit at y = F, so the next 4 m is visible above it.

Camera position `(3, F+3, 12)`, lookAt `(0, F+1, 0)`, near 0.1 / far 400. The slight side/elevated view shows slab tops; yaw never changes with aspect, preserving left/right. Set world position directly from F, with no independent camera-delta damping. It rises only when physics raises F and never follows a fall. Resize/refit changes projection, not F or the loss line. Do not use the core follow CameraRig's independent delta to advance this camera.

Local fit contract until a shared fitter exists:

1. Use CSS canvas width/height and live safe insets; reserve 72 px plus top inset for the one-row HUD. Read `useBottomObstruction()` from `core/TouchControls` for cookie/banner height. Joystick is 132 px at left/bottom 20; Jump is 72 px at right/bottom 20. Add 8 px clearance and safe insets to those boxes.
2. Evaluate free rectangles: full width with 16 px side margins **above both controls** (bottom reserve 160 + inset + obstruction), or the **central corridor between their boxes**, x = 160 + left inset through W-100-right inset, y = 72 + top inset through H-24-bottom inset-obstruction. Reject nonpositive rectangles. Prefer the fit with the larger projected platform width; fine-pointer desktops may use the larger rectangle with no touch boxes.
3. Transform the eight guard corners to camera space, `u = x / -z`, `v = y / -z`. For a candidate rect (L,T)..(W-R,H-B), pixel focal length `f = min((W-L-R)/(uMax-uMin), (H-T-B)/(vMax-vMin))`, vertical FOV `2 * atan(H/(2f))`. Centre with `setViewOffset(W,H,offsetX,offsetY,W,H)`, where `offsetX = W/2 + f*(uMin+uMax)/2 - (L+W-R)/2` and `offsetY = H/2 - f*(vMin+vMax)/2 - (T+H-B)/2`. Update matrices before rendering.
4. Check actual projected guard bounds against HUD/control rectangles and runner height ≥32 px / ordinary platform width ≥44 px. If an inset/obstruction/tiny window prevents that, pause through the store and show a local Hud hint to resize/clear the obstruction; require Resume after refit. Never silently hide the next ledge or change physics/loss bounds to fit a device.

**Measured projection checks** with installed Three.js `PerspectiveCamera`/`Vector3.project`, zero insets/obstruction, coarse-pointer boxes, F =0. These are mathematical checks of this design, not browser gameplay measurements; translation by F preserves the fit.

| Viewport | Chosen free rect (CSS px) | Vertical FOV; offset X / Y | Projected whole play column | Ordinary platform width / runner height |
|---|---|---|---|---|
| **375 × 812** | x 16..359, y 72..652 (above controls) | 50.057°; -0.341 / 48.400 px | x **16..359**, y **136.385..587.615** | **88.60–100.65 / 62.89–74.91 px** |
| **812 × 375** | x 160..712, y 72..351 (central corridor) | 38.452°; -30.211 / -21.280 px | x **329.960..542.040**, y **72..351** | **54.78–62.23 / 38.89–46.32 px** |

The table samples centres x = -1, 0, 1 and y-F = -1, 0, 3. Additional extreme checks at moving centres ±1.2 / platform heights -2..4 and runner centres ±1.98 / feet heights -2..0 give minimum platform width / runner height **86.92 / 62.20 px portrait**, **53.74 / 38.46 px landscape**, above the 44 /32 px acceptance limits. Portrait joystick occupies x 20..152, y 660..792; Jump x 283..355, y 720..792. Landscape joystick x 20..152, y 223..355; Jump x 720..792, y 283..355. The whole projected column clears each box and the HUD in both aspects. Live CSS, border boxes, notches and cookie obstruction are browser acceptance checks.

Rendering uses the fixed pools, shared geometries/materials and instanced platform/coin/tower primitives; flags reuse a shared prop geometry where possible. No shadow maps; blob shadows and contrasting top rims show landings. Coin spin, runner lean/jump pose, moving platforms and crumble warning blink read integer simulation time. Rigged shared-runner clips, if available, use simulation-derived clip time; rigid root lean and squash are the fallback, with no rigging prerequisite. Reduced motion reduces decoration, never physics or warning duration. Target ≤150 draw calls / 60 fps on a mid phone; runtime performance has not been measured.

## Assets

| Model | Source | Spec | Fallback / purpose |
|---|---|---|---|
| runner | **shared** `/models/3d/shared/runner.glb` | `assets/shared.spec.json`; not duplicated here | Hoodie capsule/head/sneakers, scaled to 1.0 m; physics unaffected by mesh/rig |
| checkpoint flag | This game `/models/3d/tower-climb/checkpoint-flag.glb` | `./assets.spec.json` | Short pole with yellow pennant; identifies the permanent rest ledge among moving/orange slabs |
| platforms, coins, tower, checkpoint ledges, danger strip | Code primitives | None | Contrasting boxes, gold discs/rings, repeated tower panels; collision lives in rules |
| spring pad | Omitted | None | No spring mechanic: vertical boosts would change jump reachability and score bounds |

Universe **`shared-cast`**, generation seed **5050**, matching the shared runner. Only the checkpoint flag adds a recognisable rest marker; one text-mode Gen-2.5-Low attempt, qualityOverride 1500, 512 px textures, ≤5000 tris /300000 bytes. GLB, Raw mesh, PBR. Floor pivot y =0; flag height 0.8 m including pole, no text/base/ground. Adjust scale/rotation/yOffset in the later assets PR. Collision never comes from its mesh.

No new character concept is needed: reuse the approved shared runner. Claude owns approved Rodin generation through the official MCP, import/optimization and GLBs; this prep spends no credits or reads keys. Estimated flag budget is one generation (0.5 credit at the plan's provisional rate, actual cost checked before approval). Spring omission removes one planned generation. `skills.md`/plan still list playground and both props; their catalog update belongs to Claude. This hand-off explicitly selects shared-cast/5050 and one useful prop.

## HUD

Exactly `hudStats: [{ key: "height", label: "Height" }]`; set height to `floor(maxHeight)` on a newly crossed metre, and explain metres in instructions. Shell Score / Time (30:00 countdown) / Height plus mute/pause stays one row. No lives, coins or checkpoint shell stats. A small planned `definition.Hud` may show opening guidance, checkpoint feedback and the fit-blocked hint; its text must not cover the fitted column or intercept controls. No extra permanent row. Announce checkpoints without colour alone.

## Edge cases

- Pause mid-jump freezes velocity, coyote/buffer deadlines, moving supports, camera anchor and integer remainder. Resume consumes only new simulation dt; no catch-up, duplicate jump edge or renderer-clock reset effect.
- Pause while standing on a warning platform preserves its remaining warning exactly; the visual cannot fall offscreen while collision stays behind. A resumed warning can expire only after its remaining simulation ms. A support's collapse at a jump boundary removes support first; an already valid coyote permission/buffer may still launch, once.
- Fast downward crossings use the swept top test. Touching an underside/side does not restore jump permission. A landing/buffer within one frame carries remaining time once, and the 400 ms launch guard always holds. Walking off does not create repeated coyote jumps.
- If a new peak raises the bottom past the runner after a fall, report earned score then lose once. No checkpoint teleport. Time-up takes precedence over same-frame collision/pickup; score and duration match the shell's ended state.
- Restart/retry rebuilds seed, descriptors, pools, deadlines, remainder, score and camera anchor; consumed coins never leak into the next run. Mount/suspense/loading time does not start rules time.
- Rotate/resize refits the same state, preserving left/right and loss height. A fit pause follows the same pause contract, including on fine pointers. Missing/broken runner or flag GLBs use local primitives via `useModel(asset).failed` / `Model` error boundary.

## Test plan

Planned `rules.test.ts` (Vitest, pure state/fake input; no sleeps):

- **1000 seeds**, plus uint32 extremes: same descriptors/phase/pool IDs for the same seed; all 451 blocks sum to exactly 8 m, steps within 0.45–0.55, all neighbour centre deltas ≤1.0, checkpoints fixed, no missing required link. Verify every link with the arc math at both moving endpoints, and drive a landing controller through every platform type/phase. Mutations exceeding rise/shift must fail validation. Validate admitted spurs and their return paths too.
- One-way/swept physics: upward pass-through, descending centre/edge landings, no upward snaps, fall tunnelling, boundary clamp, moving carry, no vertical boost. 1/16/33/50 ms and irregular clamped frames reproduce analytic apex/landing tolerances and never accept launches <400 ms apart.
- Coyote at 99/100/101 ms; buffer at 119/120/121 ms; held jump/no repeat; consume permission once, no midair rearm, buffered landing jump, simultaneous warning expiry/jump, dt ≤0/non-finite ignored. In each case use absolute ms deadlines, not frame counts.
- Integer-ms remainder at 60/120 Hz and mixed dt: no rounded-frame drift, clock ≤ cumulative dt with <1 ms lag. Pause adds no time/remainder/motion/animation; unpausing does not catch up. Split the 3050/800 ms deadlines exactly.
- Coins unique per absolute band ID, feet-height gate, missed/recycled coins never regenerate, revisiting height/checkpoint gives nothing. 17.9 m/two coins =220; opening hold and an idle 30-minute run score0. Validate coin density for every reachable prefix.
- Drive the real `createArcadeStore` in shell order through countdown, immediate fall after hold, pauses, restart and time-up. Exactly one untimed frame ≤50 ms, D≥3000 on every submitted loss, D=1800000 on time-up; rounding-down cases and the <1 ms remainder retain the proof. Enumerate metre/coin award thresholds and launch bounds across the duration window: all scores pass rate/max, terminal capScore is a no-op, theoretical maximum ≤47165, never 50000.
- Recycled-slot identities/geometry stay fixed across hundreds of blocks; no support/pending target recycled, active counts stay within pools, no allocations in step, no repeated score/sound/end event. Generator stream does not change when decoration is disabled.

**Browser acceptance plan (pending game implementation):** local production build with arcade enabled and API mock enabled; never production WordPress.

- Desktop 1280 ×800 keyboard, **375 ×812** touch and **812 ×375** touch, plus a real phone: ready → countdown → protected hold → climb static/moving ledges → collect coin → checkpoint → pause/resume → crumble → fall/result → Retry → Exit. Verify joystick x + Jump, single-row HUD, one loss/sound/submission. Run an idle time-up with a local simulated clock, not a production upload.
- Measure actual canvas projections and HUD/joystick/Jump boxes against the table; test every moving extreme and runner at both horizontal bounds, safe insets, cookie banner open/closed and midair rotation. Next ledges remain visible; failing-fit pause/hint/Resume works on coarse and fine pointers.
- Pause 2.5 s mid-ascent, near coyote/buffer expiry, while riding a moving slab and during crumble warning; tab-hide/blur and long raw frames. State/clip pose/remaining ms are unchanged on resume, with no catch-up or duplicate event.
- Observe monotonically rising camera and fixed world loss line through falls/resizes. Check raw score against mock-submitted rounded duration and the integer server inequality on early loss, long climb and time-up. Missing GLBs, reduced motion and context recovery remain playable.
- Confirm constant mesh/instance counts after many recycled blocks, no remount spikes, ≤150 draw calls, 60 fps target, control focus and no horizontal overflow. Screenshots/performance measurements remain pending.

## Known issues and core gaps

- This is a design/spec only; the placeholder is not playable. Physics, real-store proof tests, browser fit and performance checks must be built before status changes. Current metadata limits/orientation need no change.
- Core has no one-way kinematic platform helper; implement pure rules locally. No Rapier dependency or core edit is needed.
- Core lacks a pause-safe integer-ms game clock and explicit simulation-first priority; use the carried-remainder clock/first-child ordering above until shared helpers exist. R3F elapsed time is unsuitable. The countdown transition still permits one untimed ≤50 ms frame, explicitly included in the proof.
- CameraRig has no free-screen box fitter or monotone vertical bound and its follow easing uses separate visual dt. The local writer must own this camera after the shell's static setup. Core touch rects/safe-inset reporting are absent; use current CSS sizes plus existing `useBottomObstruction`, and recheck when core changes.
- `<Model>` has no custom fallback prop; a separate `useModel` failure check can clone unnecessarily, as the reference documents. Shared runner animation availability is optional; fallback rigid motion keeps the same simulation timing.
- Only the flag is requested, with the hand-off's shared-cast/5050 universe. Catalog updates, approved assets and missing-GLB 404 cleanup belong to Claude. No model/concept/metadata/core files are changed here.
