# Delivery Drone

Owner: Codex. Slug: `delivery-drone`. Adventure game 5, complexity 3. Approved design implemented in P-15; runtime acceptance awaits Claude's validation round. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §5; assets: 05 §E.4. Units: metres, seconds; x east, z south, y up. Gameplay tuning lives in pure `rules.ts` and its tests.

## Concept

Fly a white-and-blue toy drone over a miniature city, collect a parcel at the central depot, follow a rooftop beacon and release the swinging load onto its pad. Inertia and a two-axis winch make lining up the drop the skill. Battery is both clock and delivery reward. Accent `#38bdf8`; twelve deliveries form a complete route.

## Controls

`meta.ts`: `scheme: "flight"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Drop" }`.

- `keyboard`: "WASD / arrows to fly, Space, E or Enter to drop".
- `touch`: "Joystick to fly, tap Drop to release a parcel; hover at the depot to reload".
- `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)`; normalize magnitude to ≤1. Drop reads `actionPressed || jumpPressed`, once on the first simulation step of that frame; held buttons do not repeat. Enter is accepted because core maps it to Action. Esc/P and hidden-tab pause belong to the shell.
- Changed from spec: omit optional Jump boost because Space already drops and boost would require a second touch flight control. Automatic altitude and pickup need no extra finger; the joystick alone flies, with Drop needed only for release.

## Rules

All constants are named groups (`CITY`, `DRONE`, `WINCH`, `PARCEL`, `BATTERY`, `ROUTE`, `WIND`, `PIGEON`) in `rules.ts`. No Rapier: scoring depends on deterministic movement and analytic impact geometry.

- **City:** bounds x/z ±30; 8×8 cells, pitch 7.5. Building footprint 5×5, centred in its cell, roofs at 2, 5 or 8. Central four cells are an open depot/park; depot at (0,0), pickup disc r 1.5. Eight seeded towers replace non-target buildings, height 16, footprint 5×5. Buildings/pads have no random collision derived from GLBs. Drone centre clamps to ±29.5.
- **Route:** twelve distinct ordinary roofs, pads r 1.25, at roof centre. Four targets in each distance band from depot: [10,18), [18,25), [25,35]; seeded order within each band. No tower/pigeon path within 3 of depot or a pad. Drone-clear flood fill at 0.5 grid resolution, clearance 1.0, verifies each target reachable around tower footprints; 32 candidate attempts, then a literal validated fallback. One active target; failed drops retain it. Twelve successful deliveries finish the route. Fragile parcels are deliveries 9–12 (determined by completed count, not pickup attempts).
- **Drone:** radius 0.5, start centre (0,3,0), horizontal velocity zero. Desired acceleration = 10×normalized input minus (10/9)×velocity (drag ≈1.11 s⁻¹); integrate and cap speed at 9 m/s; terminal speed is 9, 95% reached in 2.70 s. Acceleration driving the winch is the actual velocity change divided by dt, vector capped at 10 (impacts do not inject unlimited swing). Facing eases at 10/s toward velocity when speed >0.2. `bank` max roll 0.35 rad, cosmetic `hover` amplitude 0.04.
- **Altitude:** pivot is the drone's logical position; target y = highest ordinary roof intersecting an XZ square ±1.0 beneath the drone +3, or 3 over streets. Cruise ceiling 11. Critically damped `spring`, stiffness 36, targets upward at least 1 m ahead along velocity. After easing, clamp y ≥ roof+2.6 so the 2 m winch and 0.4 m-high parcel never enter that roof while attached. Downward motion remains eased. Towers are walls at every flight height. The clearance square covers parcel reach 2×0.35+0.2=0.9 m per axis, including diagonal swing; route clearance uses the same square. Sweep the attached 0.4 cube against walls: first contact destroys/detaches it as a miss, resets swing and requires reload; no award/recharge/extra battery damage. Drone tower damage remains independently throttled. Changed from spec: explicit clearance clamp prevents an eased climb carrying a parcel through a roof; no manual altitude.
- **Tower contact:** swept drone AABB against radius-expanded tower footprints, then `resolveSphereAabb`; reflect inward normal velocity at restitution 0.2, retain tangential velocity. Battery −3 on contact entry, with a GLOBAL 1 s damage cooldown including corner/multi-tower contacts. Start invulnerable for 1 s. Resting against a wall never repeats damage without separation ≥0.1 and re-entry; world-boundary clamps cost no battery.
- **Pickup:** only with neither attached nor falling parcel. Within depot r 1.5 and horizontal speed ≤0.5, accumulate 4 s continuous hovering; leaving or speeding up resets to zero. On completion attach a fresh parcel with zero swing; pickup clock starts then. Battery drains during loading. No inventory queue; no reload while a drop is unresolved. Changed from spec: a visible 4 s loading ring sets a measurable service cadence and prevents unlimited depot awards.
- **Winch:** `stepPendulum2D`, length 2, gravity 9.81, damping 1.2 s⁻¹; steady mode damping 2.4. Feed 0.35×actual capped pivot acceleration into the pendulum: steady angle at full acceleration is 0.35×10/9.81≈0.357 rad, with forcing decaying as flight speed rises. Clamp each axis angle to ±0.35 rad and angular speed to ±1.5 rad/s; at an outward angle clamp zero that axis's outward speed. Use the same small-angle mapping everywhere: parcel top x/z = pivot +2×angles, y = pivotY−2; centre is top−0.2. Drop centre velocity = pivot velocity +2×angular speed in XZ, pivot vertical speed in Y. The line anchors to `EXPANSION_GLB_POINTS` hook, with body fitted so that anchor equals logical pivot; visual bob/bank never changes release physics.
- **Drop:** one falling parcel, gravity 9.81, no aerodynamic wind after release. Snapshot release position/velocity/time; analytic flight position, with `landingPoint` for horizontal roof/ground planes and swept AABB tests for side faces. Earliest physical contact wins (ties: lower building index, ground last). Parcel is a point for flight collision, drawn 0.4 cube; contact refers to bottom centre (centre y−0.2). Target pad hit if first surface is its roof and distance d ≤1.25; all other surfaces/boundaries are a miss. At d=1.25 precision is 0; `precision = clamp(floor(100×(1−d/1.25)),0,100)`.
- **Delivery:** fragile precision <40 breaks, grants neither score nor recharge; precision ≥40 succeeds. Ordinary pad hits always succeed. Express +50 when impact time−pickup time ≤10 s (inclusive; user decision 2026-10-09, was 15 s). Success +12 battery capped at 100, marks that target complete exactly once. Failure destroys the parcel and requires another depot visit. Fall lifetime at most 5 s; if still unresolved it is a miss. Initial battery 100; drain exactly 1/s during all played time; warn on downward crossing of 20, re-arm only above 25.
- **Pigeons:** 2 before 60 s, 4 from 60 s, 6 from 120 s; seeded closed `createPath` loops, altitude 4–10, speed 3, collision radius 0.3 vs drone r 0.5. Relative swept XZ collision plus |dy|≤0.6 forces a release only while carrying; no battery penalty. One contact cannot release twice; re-arm after separation 0.2. Paths exist from start and later birds activate at their play-time positions. Cars/taxis/vans are cosmetic street traffic at 4/5/3 m/s.
- **Wind:** from 60 s, two seeded 8×8 zones on streets, outside depot radius 3; visible arrows/streaks. Constant horizontal acceleration magnitude 1.5 per zone, directions selected from ±x/±z; overlapping forces add before the acceleration/speed caps. Zone edges use inclusive minimum/exclusive maximum. These forces drive pivot acceleration and swing, not falling parcels.
- **Clock/order:** no `durationMs` (battery changes). Consume the entire `useRunFrame` played dt using core `substep` ≤1/120 s; split at battery expiry, contact, landing, loading and 180 s boundary so awards cannot resurrect an expired battery. Process expiry/ceiling before simultaneous contacts/awards; tower damage before delivery; otherwise delivery before loading. Score updates precede `end`. No rules or animation time advances during pause/over.
- Changed from spec: twelve single-use successes and a hard 180 s ceiling replace potentially endless recharged play, making finite score/duration limits possible. Planning estimates: expert 130–150 s; novice successful run 155–175 s with few misses (unpractised players may time out); idle expires at 100 s. Use `substep`, not `fixedStep`, because its eight-step overload drop could lose played battery time.

- **Timing check:** still-air v(t)=9×(1−exp(−t/0.9)), displacement=9×[t−0.9×(1−exp(−t/0.9))]; 35 m takes ≈4.79 s before braking. Neutral braking 9→0.5 takes ≈2.60 s and 7.65 m; brake early. A 35 m outbound leg with 2–4 s alignment/settling and ≤1 s fall takes about 8–10 s after pickup, at the edge of the 10 s express window (loading excluded); detours/wind can lose express. Representative expert budget: ≤600 m legal travel /9 =66.7 s cruise +25–35 s acceleration/alignment +48 s loading ≈140–150 s; fall overlaps return flight. Analytical estimates, not bot results: P-15 must demonstrate legal wins well before 180 s and record novice/expert timings across bands.

## Scoring

`runScore = sum(150 + precision + (express ? 50 : 0))` over successful deliveries only. No points for pickup, flight, misses, broken parcels or remaining battery. Live `addScore` once per landing event; final `setScore(runScore)` is an idempotent reconciliation, never an extra award. At most 12×300 = **3600**; no win/time bonus. HUD: Battery %, Deliveries x/12, target distance rounded to metres, and Loading progress/Fragile when applicable.

### Server limits and why they hold (the proof)

Approved provisional limits, applied to `meta.ts` in P-15: **maxScore 3600; duration 20000–182000 ms; base 300; max_pps 75**. Claude owns the matching `arcade-games.json` update at merge. Standalone fix1 bot checks retain these limits; full Vitest validation belongs to Claude.

1. For n awards, n distinct parcels needed ≥4n s loading, non-overlapping and entirely in played time. Thus n≤floor(t/4), score≤300n≤75t≤300+75t, including every partial/live score. Travel/fall only tighten this bound; input spam cannot bypass loading or consume one parcel twice.
2. Globally throttled damage count ≤1+floor(t) and continuous drain t imply B≥100−t−3(1+floor(t))≥97−4t, before nonnegative recharge. Consequently any battery loss requires t≥24.25 s, safely above 20 s. Grace and entry-only contacts tighten the bound. Win requires ≥48 s loading; ceiling is exactly 180 s. All terminal reasons lie within 20–182 s, with 2 s upper transport margin.
3. Twelve unique target completions prove maxScore 3600 for all seeds, retries, steady modes and frame partitions; the generator cannot create extra targets. Equality need not be physically achievable; this is an intentionally conservative maximum, not a measured oracle score.
4. Fix1 preserves all inequalities: flight/swing/camera/chunks/rotors add no awards; attached-wall misses only remove awards, add no damage and cannot shorten the loss bound. Loading remains 4 s, count twelve, ceiling 180 s. Keep limits pending bots; do not tighten from timing estimates.
5. Through `createArcadeStore` + `simulateRun`, run expert/novice route bots on 48 seeds per controller/damping combination (32 at 60 fps, 8 at 20 fps, 8 random 4–50 ms), and idle/spam/collision bots on 32 seeds per control/damping combination (24 at 20 fps, 8 random frames); include 300 ms raw-frame stalls/countdown/pauses via clock tests. Oracle uses legal movement, loading, pendulum and release; pathfinding around towers and analytic impact timing grant knowledge, never teleportation or immunity. Assert `withinServerLimits` and `capScore` no-op on all terminal results; record best/worst durations, score and reasons. Both damping modes, fragile attempts, perfect zero-distance fixtures, idle 100 s expiry and adversarial corner-contact loss included. No bot measurements claimed before build.

## Run end

- `end("lose")` when battery reaches 0, including drain or tower damage; falling parcels grant nothing after that instant.
- `end("win")` on the twelfth successful landing, after its score/recharge. Changed from spec: route completion is a win so no dead target or endless depot farming follows it.
- `end("timeup")` at 180 played seconds if still playing; no remaining-battery bonus. Battery expiry at the same time takes `"lose"` precedence; a landing on expiry/ceiling is not awarded.
- `resultDelayMs: 1200`; route win has sparkle/confetti, loss descends cosmetically with stopped rotors. Rules/score stay frozen during result delay; shell owns submission, Retry and Exit.

## Scene and camera

- High follow view, `useFittedView` local area x/z ±6 in portrait, x ±10/z ±4 in landscape, y −3..3 relative to the pivot, pitch **60°**, `yaws: [0]`, `fov: 45`, `padding: 1`, `shift: true`, margins top 0.10/bottom 0.08/left/right 0.03. `followFocus` uses lookAt origin, reach x/z ±2, fraction 1, bounds x/z ±30; `<CameraRig>` follows the pivot plus velocity look-ahead (velocity×0.22, capped length 2), fraction 1, damping 5, matching bounds and fit offset/shift. Translate the fit's local window with the follow target; never fit the whole 60 m city.
- One yaw preserves screen-relative controls and makes rooftops/swing readable without camera turns; high pitch reveals pads, while bounded look-ahead shows upcoming towers. Changed from spec: yaw stays north-facing instead of rotating with flight, avoiding steering/camera feedback on touch. If portrait needs more room, fit distance changes rather than yaw.
- Environment background `"#dbeafe"`, lighting `"day"`; game-local fog of matching colour uses current fitted distance d: near=d+10, far=d+40 (or larger), updated on resize/safe-area fit changes; no fixed 22–48. `SkyDome` matching horizon. Changed from spec: use the existing fixed day preset rather than a bespoke day→sunset light blend; this avoids a generic lighting system inside the game. Warm window colours suggest late afternoon.
- Occlusion choice: retain opaque tower silhouettes; draw drone + cable + attached/falling parcel a second time after city geometry with `depthTest: false`, `depthWrite: false`, explicit render order. Batch simplified drone silhouette in one call and cable/outlined parcel in one call (~2 extra calls), sharing exact world transforms; no building fade. At 60° a 16 m tower still hides ≈9.2 m of street; pitch alone is insufficient. Use a high-contrast parcel outline in that batched geometry.
- Phone fit: coarse pointers or canvases narrower than 600 px / shorter than 500 px use x/z +/-3.5 m in portrait, x +/-6 / z +/-2.25 m in landscape, y +/-2 m, padding 0.5 CSS px. Desktop fit stays unchanged. HUD, controls and banner avoidance remain enabled. Nearby target pads remain in the fitted window; distant targets retain beacon/arrow guidance. Arrow hides at horizontal distance <=3 m.
- Math uses actual `fitView`, fov 45 degrees, illustrative full-width safe bands. Pivot px/m = height / (2 * tan(22.5 degrees) * fitted distance). Parcel model/collider remains 0.4 m; depth-independent outline is 0.6 m. Claude re-measures actual safe rectangles and depth variation.

| viewport / assumed safe bands | distance | px/m | drone 0.9 m | parcel outline 0.6 m | pad diameter 2.5 m |
|---|---:|---:|---:|---:|---:|
| 390x844, safe y=180..580 | 35.052 m | 29.07 | 26.16 px | 17.44 px | 72.66 px |
| 844x390, safe y=80..300 | 21.080 m | 22.33 | 20.10 px | 13.40 px | 55.83 px |

- Building colours `#e2e8f0` / `#cbd5e1` / `#94a3b8`, roofs `#64748b`, pad/beacon `#38bdf8`. Tower tops have coral hazard stripes. Drop prediction shows a dashed landing cross and r1.25 pad ring; parcel's vertical shadow remains distinct from the ballistic cross. Mint plus checkmark when prediction meets a valid pad/fragile threshold. Beacon and `TargetMarkers` target pad while carrying/falling, depot while empty/loading.

## Core helpers used

`GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `inputToWorld`, `useFittedView`, `followFocus`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`); collision `sweptAabbXZ`, `resolveSphereAabb`, `clampToBounds`; math `createRng`, `rngNext`, `turnTowards` (`randomSeed` Scene only); ballistics `landingPoint` (analytic playback avoids `stepProjectile` Euler/prediction mismatch); kinematics `substep`, `stepPendulum2D`; path `createPath`, `advance`, `pointAt`, `tangentAt`; motion `bank`, `hover`, `spring`; rendering `Model`, `Instanced`, `InstancedModel`, `DynamicInstancedModel`, `BlobShadow`, `useCanvasTexture`; kit `Parcel`; HUD `TargetMarkers`; env `SkyDome`; fx `useFx` (`warm`, `burst`, `score`, `shake`); quality `useQuality`, `scaledCount`; audio `startLoop`, `playSfx`; limits `withinServerLimits`, `capScore`; test-only `createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`, `createGrid`, `freeGrid`, `followPath`, `steer`. Generic pendulum, paths, pools, camera fit and bot harness stay in core; local code owns city validity, flight rules and surface-impact selection only.

## Assets

| id / source | class | fit / budget | use and fallback |
|---|---|---|---|
| `drone` / `EXPANSION_ASSETS.drone`, delivery-drone/drone.glb | A, owned, already imported | 0.9 wide; ≤5k tris, 512 texture, ≤300k bytes target | `EXPANSION_GLB_POINTS` hook; white rounded body/guards primitive fallback with same anchor; 4 procedural rotor discs placed from core `DRONE_ROTORS_GLB` |
| `car`, `taxi`, `van` / `REUSED_ASSETS` | D | 1.6 / 1.6 / 2 long, existing budgets | 4 each in paths; instanced rounded boxes on failure; no flight collision |
| `pigeon` / `REUSED_ASSETS.pigeon` | D | 0.6 wingspan, existing budget | ≤6 hazard birds; body/wing primitives retain collision/readability |
| `crate` / `SHARED_ASSETS.crate` | D (05 classification) | 0.8 cube, existing budget | 4 depot crates, decoration; box fallback |
| `leafyTree` / `EXPANSION_ASSETS.leafyTree` | C | 3 high, existing shared budget | 4 park trees; trunk/crown primitives, cosmetic only |
| parcels, buildings, roofs, pads, beacons | B | parcel 0.4 cube; dimensions in Rules | core `Parcel`, batched boxes/planes, atlas windows/tape; no generation |

Transform all `DRONE_ROTORS_GLB` centres through the same drone fit/body transform including fallback; never guess arm positions. Rotors r0.12, line radius0.015, landing overlays 0.06 above logical roofs (cap top 0.035; cap-derived clearance 0.025), depot ring 0.02 above ground. Hook fit/parcel bottom-centre conversion tested against real GLB. Only drone belongs in `assets.spec.json`; it records the existing catalog recipe, never authorizes another generation. No shared/reused asset entries, raw files or manifest edits.

## Files

`meta.ts` (data/limits) · `index.tsx` (`GameDefinition`) · `rules.ts` (seeded city/route, flight, altitude, swing, loading/drop, battery, events/score; pure) · `rules.test.ts` + `bots.test.ts` · `assets.ts` + `assets.test.ts` (real GLB fits/hook) · `Scene.tsx` (one run loop, store events, camera, audio/fx) · `camera.tsx` (fit/fog) · `City.tsx` (16 chunks, instanced traffic/birds/props) · `Drone.tsx` (body, rotors, cable, parcel and visibility overlay) · `Hud.tsx` + `Hud.module.css` · `Primitives.tsx` · existing `assets.spec.json` · `README.md` · `tools/thumbs/inputs/delivery-drone.mjs`. Thumbnail remains null pending capture. Administrative handoff: `.handoff/P-15-drone/HANDOFF.md`.

## Test plan

`rules.test.ts` ≤~600 lines, target 500; core modules already tested, so cover game behaviour and proofs rather than copy helper tests.

- Pin literal tuning; deterministic city/route on 1,000 seeds; all bands, twelve unique ordinary-roof pads, depot/hazard clearances, tower routes, 32-attempt rejection and fallback validity. Reject one fixture per validity rule.
- Flight: diagonal cap, inertia/drag, wind cap, boundaries, sweep at 9 m/s, roof ascent/descent/load clearance at ±1.0 including diagonal swing, attached-wall destruction without duplicate awards/damage, corner contact throttle, entry re-arm and grace. Both steering methods use the same rule input; no physics immunity.
- Pendulum: zero forcing energy `0.5×(vX²+vZ²+9.81/2×(angleX²+angleZ²))` non-increasing over 60 s at 1/120, both damping modes; vX/vZ here are angular speeds in rad/s, not flight velocity. 180 s worst alternating acceleration remains finite/in clamps. Validate release position/velocity, reset and outward clamp energy loss. Measure peak/final energy and per-axis seconds/fraction on the angle clamp in P-15 for normal routes and adversarial alternating input, both modes; not just NaN absence.
- Drops: exact centre/rim/outside, side-wall first contact, lower roof vs target, upward/downward initial velocity, two-axis swing, analytic impact and preview agreement; 5 s timeout. Fragile 39/40, express 10/10.001, one award, missed target retry, forced pigeon release and simultaneous inputs.
- Battery: cap100, +12 only on success, drain while loading/falling, warning re-arm, pause/over unchanged; expiry/landing/tower/ceiling ties, 12th completion and all reasons. Frame partitions at 60/20 fps/random yield same loading/clock accounting; analytic crossing fixtures use ≤1e−6 tolerance.
- Score/proofs: all event values and finite/rate/duration inequalities above; real-store 16-seed expert/novice and 16-seed idle/spam/collision bots, aggregate invariant checks per run for runtime. Test both steady modes and raw long-frame clock behaviour; reset seed/state/pools on Retry.
- `assets.test.ts`: actual drone width/hook/DRONE_ROTORS_GLB rotor placement, fallback alignment, parcel line ending at top and bottom contact-plane conversion; shared fits/collider independence. No humanoids.
- Build later: common 03 criteria; keyboard and 390×844 touch, Esc/P/tab, over/Retry/Exit, banner open/closed; screenshots 1280×800, 390×844, 844×390. Swing, arrows, pad prediction, fragile label readable; no z-fighting. npm build, tsc, vitest, gamecheck and thumbnail are build-stage checks, not executed for this design task.

## Performance

Target **≤70 draw calls**, hard game cap **80**, platform cap150. Budget: 16 always-mounted 2×2-cell chunks (one merged opaque city/detail mesh each), ground/streets2, drone≤4, rotors1, parcel/tether≤3, pads/beacon/overlay≤5, vehicles≤9, birds≤3, trees/crates≤4, sky1, blob shadows1, wind1, fx pools2, score sprites≤2, visibility pass2 =56; reserve14 for real GLB mesh splits. No dynamic lights/shadow maps; day preset only. Keep ≤150k rendered tris target; simplify cosmetic meshes if measured imported splits exceed reserve.

Exactly 16 prebuilt chunks cover all 64 cells. Keep every chunk mounted/drawn with three.js frustum culling and correct bounds including 16 m towers; no manual 5×5 visibility or distance masking. Worst-case city budget is 16 calls even when all chunks intersect the frustum. Distance-relative fog handles fade; active target marker remains. Hazards/colliders remain simulated for the whole city; culling never alters rules. P-15 chunking check: crossing every cell edge and fast diagonal travel must keep calls≤70 target/80 cap, no visibility hole within the fitted window and no geometry/texture churn. If boundary cell coverage fails in portrait, reduce cosmetic per-cell parts rather than remove collision buildings.

Preallocate 12 traffic, 6 birds, 12 pads, 1 attached/falling parcel, 4 crates/trees, 32 wind streaks; reuse line/overlay buffers, path states and scratch outputs. Warm sparkle/puff/score once; ≤2 active score sprites, rotor wash ≤5 bursts/s. No per-frame React state, texture creation or path rebuilding; HUD values write only on change. Quality cuts traffic/trees/streaks/particles only, never birds, towers, pads or swing. Dispose mount-owned resources. At 30/60/120/180 s and Retry×10, GPU counts flat after warmup; retained heap has no upward trend at equal GC checkpoints. Record mid-phone p95 and worst calls with all effects; all measurements pending.

## Audio

`startLoop("rotor", { volume: 0.25 })` on each entry to playing; `.set({ pitch: 0.8+0.6×speed/9, volume: 0.25+0.1×speed/9 })` as speed changes (≥0.02 delta). Shell stops on pause/over/mute; recreate on resume/unmute while playing, never stack handles. Pickup/winch `click`, release `whoosh`, landing `thud`, successful delivery `pickup` + `chime`, broken/missed parcel or tower `hit`, low battery `alarm` at crossing only. Win/lose cue belongs to shell. Visual feedback communicates every event without sound.

## Accessibility

Beacon, numeric distance and off-screen arrow guide the route. Predictive cross/checkmark, pad ring and fragile threshold text supplement colour; parcel shadow plus visible cable show swing. Battery number/bar and low-battery outline; loading ring/countdown; Drop target72 px. Read `matchMedia("(pointer: coarse)").matches` once at Scene mount into rules state: automatic steady on coarse pointers, normal damping otherwise, fixed per run with no setting/checkbox or associated HUD CSS. Bots explicitly construct both states; both share limits. Recommendation remains subject to user decision. Reduced motion disables bank/bob/wash/streak animation and shake, but retains true cable swing and landing cross as essential gameplay. HUD uses CSS Modules and existing variables; no globals edits.

## Risks and open questions

### Decisions (user, 2026-10-09)

- Approved: the spec departures (no boost, 12 deliveries win, 180 s ceiling, 4 s depot loading, fixed north camera, day lighting); steady winch automatic on coarse-pointer screens with no setting; top speed 9 m/s via drag 10/9; limits 3600 / 20000–182000 ms / base 300 + 75/s now, tightened after the bots run.

- Risks: roof clamps can jerk the line; P-15 verifies anchor/clearance, visibility overlay, actual mesh splits and phone sizing. Reachability, novice/expert estimates and clamp occupancy require seeded measurements; none claimed here.
- Express window: DECIDED by the user 2026-10-09: 10 s (was 15 s; 2,303 bot deliveries were all express at 15 s, slowest 11.8 s). With 10 s the expert route bot still gets express on 249 of 256 deliveries per variant (the far band loses 7); humans lose it on long legs and detours. The limits are unchanged: the proof (score <= 300 per delivery, n <= t/4) does not depend on the window.
- Runtime validation remains with Claude.

## Status

```text
TASK P-15 | build delivery-drone | branch codex/game-delivery-drone | allowed: play50games-frontend/src/arcade3d/games/delivery-drone/**, play50games-frontend/public/images/3d/delivery-drone.webp, tools/thumbs/inputs/delivery-drone.mjs
HANDOFF P-15
State: implementation written; status dev; Common Definition of Done pending Claude runtime validation.
Branch: codex/game-delivery-drone verified; no branch creation/switch, commit or push.
Files: delivery-drone/** (rules, scene, camera, city, drone, HUD, assets, tests, README, meta/index); tools/thumbs/inputs/delivery-drone.mjs; explicitly authorized administrative HANDOFF.
Checks passed: npx tsc --noEmit (exit 0); git status --porcelain scope check; forbidden source import/API/time/randomness scan.
Checks deferred by task sandbox instructions: npm run build; npx vitest run; gamecheck; keyboard/touch browser playtests; perf capture; thumbnail capture.
Written tests: 1,000 layout seeds; scoring/flight/loading/drop/battery/terminal fixtures; real GLB fits; real-store bots through botHarness.
Fix1 bot counts: expert/novice, 48 seeds each in both damping modes (32 at 60 fps, 8 at 20 fps, 8 random frames), 192 route runs total. Idle/spam/collision, 32 seeds each in both damping modes (24 at 20 fps, 8 random frames), 192 survival runs total. Coarse survival frames retain the legal 50 ms clock cap and the rules substeps. Assertions retain legal wins <160 s expert / <175 s novice and best expert score >=3240.
Bot reports: terminal reasons, score/duration extrema, per-distance-band delivery times, substep cable clamp seconds/fractions per axis, peak/final energy. No measured values claimed.
Scoring: sum(150 + precision + express 50), successful pads only; fragile requires precision >=40; express <=10 s; twelve single-use awards, no terminal bonus.
Limits: max 3600; duration 20000–182000 ms; base 300; 75 points/s. Proof: n parcels require 4n s loading, score <=300n<=75t; twelve awards cap 3600; battery >=97-4t gives loss >=24.25 s; win >=48 s; ceiling 180 s.
Evidence: screenshots 1280x800 / 390x844 banner open / 844x390 and tools/perf JSON are pending; thumbnail null.
Acceptance [x]: folder implementation; pure seeded rules/core helpers; keyboard/touch bindings in code; dev status; approved meta limits; TypeScript.
Acceptance [ ]: executed tests/build/gamecheck; legal bot timing and score proof measurements; three-size playtests; real model fit results; fallback playtest; <=70 target / <=80 cap calls; mid-phone p95; Retry x10 GPU/heap stability; screenshot/perf evidence.
Known limitations: full Vitest game-suite duration remains pending Claude; standalone checks do not measure Vitest overhead. Vehicle fits and phone readability require actual validation. Server catalog pairing belongs to Claude's merge.
Open questions: Claude, run the deferred checks, retain bot JSON logs, pair the approved server limits, and send any failures for the fix round. No user design questions remain.
Safety: no production calls, network, Hyper3D credits, generated assets, dependencies, protected-file edits, secrets, commit or push.
```

### P-15-fix1 validation

- Fixed mesh bounds by using the existing meshopt-aware `readCharacterGlb` helper in Node; catalog keys `drone.width` and `leafyTree.height` are correct. Standalone decoded fits: drone 0.90002 m, car 1.60001 m, taxi 1.59290 m, van 1.99358 m, pigeon 0.60054 m, crate 0.79989 m, tree 3.00005 m. Cable-origin float assertion uses `toBeCloseTo`.
- Wall fixture now overlaps the parcel by 0.05 m while the drone stays clear, instead of relying on exact tangency at 0.9 m. Standalone check passed detachment/miss, no falling parcel or drone hit, and drain-only battery. Production wall rules unchanged; the test also checks no repeat miss or score next frame.
- Final bot counts: 192 route runs (48 seeds per expert/novice and damping combination: 32 at 60 fps, 8 at 20 fps, 8 random); 192 survival runs (32 seeds per idle/spam/collision and damping combination: 24 at 20 fps, 8 random). All per-run terminal limits and score-cap no-op assertions remain, with per-frame rate checks. The 1,000-layout-seed test and algebraic limit proof remain unchanged.
- Measured cost on this sandbox: standalone Node/TypeScript-transpiled real-store workloads, using Node assertions rather than Vitest: route 34.81 s, final survival 12.61 s, sum 47.42 s (separate measurements, not full suite timing). Route wins: expert normal 47/48, novice normal 47/48, expert steady 48/48, novice steady 48/48; best expert scores 3501/3506, fastest expert wins 143.15/140.05 s. All checked terminal limits/rates and timing/score thresholds passed. Claude's original Vitest measurement was 140 s bots / 141 s whole game set. Full final Vitest cost and the under-60 s target remain to be measured by Claude; no final Vitest timing is claimed.
- `npx tsc --noEmit` passed. `npm run build` attempted and blocked by sandbox worker creation (`spawn EPERM`). Vitest intentionally deferred per task instructions. No commit, push, branch switch, production access or protected-file edits.
### P-15-fix2 status

- Current counts supersede fix1: 64 route runs, 16 seeds per expert/novice and damping combination (10 at 60 fps, 4 at 20 fps, 2 random); 96 survival runs, 16 seeds per idle/spam/collision and damping combination (14 at legal 50 ms clock cap, 2 random). Terminal limit, per-frame rate, score-cap no-op, win timing and best-score assertions remain. Layout validation still covers 1,000 seeds; algebraic proof unchanged.
- Claude measured fix1 route bots ~116 s and survival bots ~57 s (~120 s wall). Fix2 cuts route runs by two thirds and survival runs by half, with fewer fine/random frames. Claude measures final whole delivery-drone Vitest cost; under ~60 s is the acceptance target, not a claimed result.
- Named cap dimensions derive all rooftop overlays; clearance test added. Pickup tests cover the 7/8 boundary. Same-seed pickup runs compare steady swing. Actual landing fixtures distinguish pickup/release clocks in both directions; reverse fixture deliberately separates timestamps beyond chronological play to catch the wrong clock.
- Standalone Node assertions passed pickup, steady and both express fixtures. Late swing peaks: normal 0.0491414 rad, steady 0.0264285 rad. Local TypeScript check passed. Build/Vitest/screenshots deferred to Claude.
- Portrait estimates exceed drone 24 px and outlined parcel 12 px under stated bands. Actual banner/HUD/control rectangles require Claude measurement.
