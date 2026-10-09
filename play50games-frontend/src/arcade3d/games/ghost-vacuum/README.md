# Ghost Vacuum

Owner: Codex (reassigned 2026-10-09). Slug: `ghost-vacuum`. Adventure game 8, complexity 3. G0 design, no implementation. Spec: 03 §8; assets: 05 §E.4. Units: metres, seconds; x east, z south, y up. Proposed departures require approval before build.

## Concept

Explore five rooms of a cute toy mansion, reveal giggling ghosts in shaking furniture, stun them with a flashlight and track their sideways tug while vacuuming. Catch twelve before the 120 s clock. Accent `#a78bfa`; ghosts have rounded bodies and friendly faces, never horror imagery.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Vacuum" }`.

- `keyboard`: "WASD / arrows to move, mouse to aim; hold E, Enter or Space to vacuum".
- `touch`: "Joystick to move and aim, hold Vacuum to catch stunned ghosts".
- `moveX/moveY` through `inputToWorld` with fitted yaw; normalized to magnitude ≤1. `pointer` projects onto floor y=0 only for a fine pointer after real canvas pointer movement; until then facing follows nonzero movement and retains its last direction when stopped. Ignore pointer events over HUD/controls. No tap or drag action.
- Hold is `action || jump` (E/Enter/touch Action and Space respectively). Flashlight is always on. Esc/P/hidden-tab pause belongs to shell. Changed from spec: include arrows and Enter because core already maps these controls.
- Coarse-pointer assist, fixed at run start: while holding, aim toward nearest eligible stunned/pulling ghost within 4 m and 45° of movement-facing; ties lower id. Turn at ≤180°/s, retain manual movement. Same 12° capture cone and timing; no instant captures. Without an eligible target, retain movement-facing.

## Rules

Pure seeded `rules.ts`; named groups `MANSION`, `HUNTER`, `GHOST`, `LIGHT`, `PULL`, `SCHEDULE`, `SCORE`. No Rapier. One run callback consumes full played dt using core `substep` ≤1/120 s; split at release/timer/capture boundaries, never discard frame remainder.

- **Mansion:** bounds x[-14,14], z[-10,10]. Hall x[-3,3], full z; library x[-14,-3], z[-10,0]; study x[-14,-3], z[0,10]; kitchen x[3,14], z[-10,0]; ballroom x[3,14], z[0,10]. Walls thickness 0.2, height 2.4. Four permanently open doorways width 2 at x=±3,z=±5. No locked doors. Start (0,8), yaw π (north).
- **Hunter:** r0.4, speed4, acceleration20, brake24, turning rate14/s; normalize diagonal input, clamp inside radius-inset bounds, resolve furniture/walls with `resolveSphereAabb`, and cap final displacement to4·dt. Vacuum does not slow walking; cosmetic tug never moves hunter or changes scoring range.
- **Layout:** each side room has desk footprint1.6×0.8 centred at (±10,±7) and chair0.6×0.6 at (±10,±5.5); library has4 books on its desk. Room assignment of release slots is a seeded permutation cycling through four rooms, never hall. Host is the desk. Ghost pop position is host centre shifted2 m toward hall. Every host/pop reachable on0.25 grid with0.4 clearance; fixed geometry guarantees it, no rejection generator. Decorations have no collision.
- **Release schedule:** ids0–2 at0;3–4 at20;5 at30 (gold);6–7 at40;8–10 at60 (id8 gold,9–10 big);11 at90 (gold). Exactly12 unique ghosts, no replacement after capture. Active cap3 before40,6 thereafter; released surplus waits FIFO until a slot frees. Gold is300 points, ordinary/big100. No expiry/despawn or stealing awards.
- **Ghost states:** pending → hidden → wandering/fleeing → stunned → pulling → caught; broken pulls return to wandering. Hidden ghosts pop when hunter distance to host ≤3; continuous furniture shake/shimmer signals them. Once revealed, no re-hiding before60; from60, an unlit wandering ghost within0.6 of a vacant host may hide after8 s continuously unlit, resetting that timer on light. One ghost per host; additional hidden slots use their pop position visibly instead of stacking inside a desk.
- **Movement:** wander/flee desired speed ordinary0.8/1.2 before60,1.0/1.5 from60; gold1.2/1.8; big0.6/0.9. `wander` jitter0.8 rad/√s, `flee` when lit, acceleration capped4 and velocity capped at type flee speed. Ghosts ignore furniture but not walls: circle r0.4 (big0.5), radius-inset room clamp, no doorway crossing. Bob ±0.08 at1 Hz is cosmetic. Stable id order and caller-owned RNG/scratch outputs. On a room edge, remove outward velocity and reflect wander heading; stunned/hidden/caught ghosts do not steer. Initial exposed velocity is zero, wander angle is seeded uniform[0,2π).
- **Stun:** cone half-angle25°, range6 measured from hunter centre in XZ, inclusive, plus wall-only `hasLineOfSightXZ`. Furniture never blocks light/pull. Continuous light0.4 (big0.8) stuns for2 s; losing light before threshold resets exposure. Light cannot accumulate during hidden/pulling/caught states. Stunned ghosts stop immediately (velocity zero); expiry returns to wandering with zero exposure. Continuous light must restun it.
- **Pull:** hold plus stunned target inside12°/4 m cone and wall LOS starts progress0. Snapshot the ghost XZ position; interpolate from it toward current hunter centre over1 s of valid held/cone time, with the perpendicular defined by the initial hunter-to-ghost vector (coincident: hunter right). The hand nozzle affects rendering only; rules never read rig transforms. Lateral tug offset0.25·sin(4π·progress + seeded phase), phase uniform[0,2π). Clamp logical pull position into its room. Capture at progress1 exactly; range/cone uses current logical position. Pulling suspends the stun expiry.
- **Break:** invalid cone/range/LOS accumulates grace; >0.3 continuous seconds breaks and clears progress/exposure; ≤0.3 pauses progress and freezes logical pull position, re-entry clears grace. Releasing hold breaks immediately. All eligible ghosts pull concurrently, each with independent progress/grace; no retarget transfer. Coincident ghost/hunter is in cone by core contract.
- **Pull session/combo:** a session lasts while hold is continuously down and at least one pull remains active. Empty active set ends it after that step's simultaneous captures; a new pull while hold stays down starts a fresh session. First capture +0 combo, each subsequent +50; captures sorted by id. Broken ghosts earn nothing; caught ids never score twice. This prevents carrying a combo across empty rooms.
- **Clock/order:** shell `durationMs: 120000`; store clock first; rules advance the played interval [elapsed-dt, elapsed] with an internal cursor, splitting exactly at release times (never backdating a newly released ghost into the frame), then releases/reveals, movement, light, pulls, captures, score/end. No score on shell timeout frame. No exposure and pull progress on the same ghost in the same time slice: allocate threshold-crossing remainder to pull, never double count. Exact-boundary stun expiry precedes a new pull; capture precedes session closure.
- Changed from spec: finite release slots and explicit golden times30/60/90 replace approximate spawns, preventing unbounded farming and making duration proof possible. This forces the earliest clear after90 s instead of the speculative60 s lower duration. Changed from spec: room-confined ghosts and optional re-hiding only when unlit replace undefined room swapping, preserving wall/LOS fairness. All movement/assist/grace/session numbers above resolve unspecified tuning.

## Scoring

`score = 100·caught + 200·goldCaught + 50·extraInSessions + (won ? 10·floor(max(0,120-tWin)) : 0)`. Each session with k captures contributes max(0,k−1) extras. Use `addScore` once per capture, then `setScore` to reconciled total and `end("win")` on twelfth capture; no `finalScore` override. HUD Ghosts x/12 and time (shell), pull progress on each ghost; capture popup includes base and combo award.

### Server limits and why they hold (the proof)

02 §C.4 provisional: max3500, duration10–122 s; rate fields not specified there. Propose paired frontend/backend limits **maxScore2630, minDurationMs91000, maxDurationMs122000, base2350, maxPps10**. Claude updates owned backend/metadata during build only after proof passes; enabled remains false until go-live.

1. There are12 captures,3 golden: base≤1200+600=1800. Across sessions extras≤11, hence capture total≤2350 at every prefix. Each id pays once, big ghosts add no other bonus; there are no survival/hint/stun awards.
2. Ghost11 cannot leave pending before90 s and cannot be lit while pending/hidden. Its ordinary0.4 s exposure and1 s valid pull are sequential. Thus any win has t≥91.4 s even with instant reveal, perfect aim and zero travel. Delayed admission, real4 m/s hunter travel, ghost flee speeds, acceleration and wall routes only increase t; no relocation/combo can evade this bound. This is a conservative physical lower bound, not a claim that91.4 is attainable.
3. Time bonus≤10·floor(28.6)=280; total≤2630. For wins t≥91.4,2350+10t≥3264, safely above2630. Before win every score prefix≤2350, hence≤2350+10t for all t≥0. Timeout≤2350 at120 s. Every submitted win≥91400 ms or timeout120000 ms fits91–122 s; no early lose exists. Pause/countdown/result delay excluded by real store clock.
4. Prove inequalities for every legal state/event, pin constants by literal value, then run legal steering/aim/hold bots through `simulateRun(createArcadeStore())`, `advanceRunClock`/`playedFrameDt`, checking every prefix and terminal `withinServerLimits`, with unchanged `capScore`. Record best/worst duration/score and admitted schedule. Bots must use actual movement/AI/cones/LOS, never teleport/freeze ghosts or bypass exposure.
5. Conservative max need not be attained; use reachable keyboard and coarse-pointer wins as feasibility witnesses. Limits/bot measurements are pending; if witnesses fail, revise schedule/layout openly before approval, never weaken rules inside bots.

## Run end

- `end("win")` immediately after twelfth capture and final bonus. `resultDelayMs: 1600`, capture/confetti and runner cheer visible, no further scoring.
- Shell `"timeup"` at120 s, retains earned points, no bonus; deadline wins ties. No `"lose"`, health or failure penalty. Shell owns phases, submission, Retry/Exit and persistence.

## Scene and camera

- Follow top-down pitch62°, yaws[0], fov45, `shift: true`, padding8 CSS px, margin0.04 each side. `useFittedView` fits a local moving area x/z±4 about origin, y[0,2.4]; `CameraRig` full follow hunter, damping4. Full follow uses origin-local fit (as the approved template), so `followFocus` is unnecessary; no partial-follow range. One yaw keeps screen-relative controls and cutaway stable. Choose follow because a whole28×20 floor makes0.8 m ghosts unreadable on phones. Offscreen revealed ghosts and hidden shaking hosts use fixed-length `TargetMarkers`; pending/caught slots hidden.
- Fit must include every measured safe rectangle: shell HUD, game HUD, joystick and72 px Vacuum at sides, cookie banner/home inset. At390×844 and844×390 banner on/off require clear projected runner and active-target longest dimension≥24 CSS px; local8 m window requires≥30 px/m for0.8 m ghosts. Select largest safe 2D rectangle considering side controls rather than making each a full-width band; shrink window down to6×6 if needed. Fit tests include the runner and each target in the capture cone at its current height; full bodies must clear all safe rectangles and be ≥24 px. Offscreen light-only targets use ≥24 px edge arrows; shrinking the window may move targets offscreen, never exempt an onscreen target from the clearance test. No measurement claimed until build; insufficient safe area blocks acceptance and goes to Claude.
- Near-camera walls drawn at0.35 m cutaway height; others at2.4 with fade opacity0.15 when they occlude hunter/active target. Cosmetic fade never alters LOS/collision. Wallpaper purple `#4c1d95`/`#3b0764`, floor `#78350f`, ghost `#e0e7ff` rim `#a78bfa`, gold `#fde047`. `environment.lighting: "night"`, background `#1e1b4b`; one kit flashlight spot mounted once, disabled on low tier (cone still visible).
- Runner `HumanoidModel` with `RUNNER_LANDMARKS`, `useHumanoidPose`, `walkStride`/`bodyLift`, game-local `aimArm`/`turnBone` pose, soles within0.01 of floor. Backpack chest attachment is the back anchor; rotate the imported pack by π so the canister faces away from the runner, positioning its measured back surface at that anchor. The actual imported mesh has unwanted long straps despite the original recipe: fit/rotate the existing mesh first, with no GLB edit or regeneration; strap/body clearance is an explicit visual gate. Aim torso follows flashlight, hand nozzle stays forward; cap cosmetic arm relative yaw±60°, turn body for larger angles. Procedural hose routes behind/right of torso from transformed `EXPANSION_GLB_POINTS.vacuumHose`, never through body; reuse curve/vertex buffers.
- Flashlight ground sector at y0.04, floor outlines at0.03; pull rings billboard above ghost top by0.15, score text above it by0.3. All overlays depthWrite=false and visibly ABOVE their marked surface; no coplanar ring. Cone visual matches rules25°/6; narrow suction outline12°/4. Cute faces remain visible when stunned (solid body plus star icon).

## Core helpers used

Verified on local `origin/main`: `core/ai` (`wander`, `flee`, `inViewCone`, `hasLineOfSightXZ`), `HumanoidModel attach`/rig (`useHumanoidPose`, `walkStride`, `bodyLift`, `aimArm`, `turnBone`), `core/kit Flashlight`, `core/audio startLoop`/`playSfx`, `core/fx useFx`, `night` lighting, `core/hud TargetMarkers`, `useQuality`/`scaledCount`, test-only `core/testing/botHarness` (`createGrid`, `freeGrid`, `followPath`, `steer`, `simulateRun`, `fixedFrames`, `randomFrames`). Also existing runtime `GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `inputToWorld`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore`, `substep`, `resolveSphereAabb`, `createRng`/`rngNext`, `turnTowards`, `Model`, `InstancedModel`, `Instanced`, `BlobShadow`, `useCanvasTexture`, `withinServerLimits`/`capScore`. No generic helpers copied into game; local room generation/pull state/pose/hose are game mechanics.

## Assets

No generation or credits. Owned manifest records existing vacuum recipe only; shared/reused assets excluded. Fit by measured sizes, never guessed GLB coordinates.

| id (05 §E.4) | class / source | target / budget | fallback |
|---|---|---|---|
| vacuum | A, `EXPANSION_ASSETS.vacuum`, ghost-vacuum/vacuum.glb |0.55 tall,≤3k tris,512 texture,300k bytes target |rounded canister/gauges, same back/hose anchors |
| hunter = runner | D, `SHARED_ASSETS.runner` |1.56 tall,r0.4, existing rig |posed primitive hunter and pack (attachments absent on GLB fallback) |
| desk, chair | D, `SHARED_ASSETS.desk/chair` |desk1.6 wide,chair0.6 wide; footprints above |boxes/legs |
| book, door | D, `REUSED_ASSETS.book/door` (escape-room) |book0.25 tall,door2.2 tall; decorative jambs keep2 m opening |book box/open frame |
| ghosts | B, instanced lathe/wobble/fresnel |ordinary/gold0.8 tall,big1.0,<500 tris each,6 visible max |same code, no shader wobble on low |
| hose/nozzle, rooms, decorations, flashlight | B, procedural/core kit |hose radius0.035,12 segments×6 sides; nozzle0.25 long; candelabras0.6,clocks0.4,paintings0.8×0.6 |code |

## Files

Future build: `meta.ts` · `index.tsx` · `rules.ts` · `rules.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Mansion.tsx` (rooms/instanced props/cutaway) · `Ghosts.tsx` (fixed pool/shader/progress) · `poses.ts` + `poses.test.ts` · `Vacuum.tsx` (pack/hose/nozzle/fallback) · `Hud.tsx` + `Hud.module.css` (existing CSS vars/safe registration) · `assets.spec.json` · `README.md` · thumbnail `public/images/3d/ghost-vacuum.webp` · `tools/thumbs/inputs/ghost-vacuum.mjs`. This task writes only README/asset spec plus requested handoff; no classic imports or core changes.

## Test plan

`rules.test.ts` <~600 lines, whole game test set <60 s; aggregate per-tick invariants and assert per run, no thousands of matcher objects. Generic path/run harness stays core.

- Literal pins for every tuning group, layout/doorway footprints, all release times/types, clocks, scoring and limits.256 deterministic seeds validate room assignment/reachability/hosts/no ghost duplicates and fixed fallback geometry. Same seed, input and frame schedule produces identical state/events; varied frame schedules must preserve bounds and timing gates, not identical wander trajectories. Pause/over immutable, frame remainder retained.
- Movement diagonal/caps/wall corners/swept contacts;20,000 steps bounded4·dt. Ghost type speeds/acceleration, wall containment, furniture phasing, hide8 s/reset/occupancy, reveal3 m, cap3→6 and FIFO admissions. All release boundaries including pending last ghost after90.
- Light25°/6 m and pull12°/4 m inclusive edges, wall tangency blocks, furniture does not; exposure0.399/0.4 and big0.799/0.8, reset on interruption, expiry2 s, no same-slice double counting. Pull0.999/1, grace0.3 allowed/>0.3 breaks, release clears, re-entry resets, sinusoid extremes/room clamp, assist45°/180° per second and tie ids.
- Concurrent captures/id order, first/extra awards, partial break/session closure, held-through-empty new session, no repeat awards; gold300/big100; time-bonus floor boundaries. Twelfth win, no lose, deadline wins tie, timeout retention and result delay excluded.
- Analytical finite/prefix/duration bounds above, pending ghost cannot score early, legal bots use real speeds. Full-knowledge path/aim bot200 seeds split60 fps/20 fps/random4–50 ms across keyboard/coarse modes; require every seeded run wins. Spam bot200 seeds and idle fixtures verify timeout/no bound violations. Record extremal durations/scores and unchanged capScore; if runtime budget exceeds60 s reduce redundant frame combinations, retain200 seeds/bot and edge proofs.
- Asset/pose tests: real0.55/1.56 fits and hose socket transform, backpack within0.01 of back through walk/aim/cheer, nozzle/hose outside torso at extreme angles, soles within0.01; fallback anchors. Browser later: common03 ready/countdown/pause/tab/over/Retry/Exit, keyboard/two-thumb completion, screenshots1280×800/390×844/844×390 with banner on/off,24 px projection and every safe rect, above-surface overlays, missing GLBs and muted/reduced-motion parity; Retry×10 geometry counts flat.

## Performance

Target **≤55 draw calls**, game hard cap60/platform150; target≤150k tris, mid-phone p95≤33 ms. Budget room/floor/wall6, runner/pack≤8, props≤12, ghost body/face2, hose/nozzle2, flashlight2, progress/markers/shadows4, decorations4, fx≤5, score sprites≤2 =47;8 reserved for imported mesh splits. Ghost bodies remain one instanced call; the second is shared face/star/crown detail. Changed from spec: two ghost calls instead of one because non-colour state icons and cute faces must remain readable; total stays within55. Low tier removes decorative shimmer/wobble/spot light only, never gameplay targets or cone.

Fixed6 ghost slots,12 marker slots, shared room textures/materials, reusable vectors/matrices/curve buffers; no per-frame resource allocation, string building or React renders. Cache audio set-options, substep callbacks and RNG callbacks once; capture labels allocate only on events, simultaneous popups aggregate to two sprites. Warm sparkle/puff/confetti/score pools; suction cosmetic particles capped48, capture sparkle18, score sprites≤2 simultaneously. Dispose mount-owned resources. No bloom/shadow maps; ghost additive pool avoids per-ghost transparency sorting. Measure worst6 ghosts and all effects,30/60/90/120 s resource counts and Retry×10; estimates are not measurements.

## Audio

`startLoop("vacuum", {volume:0})` on play; reused `.set({pitch:0.8+0.8·maxPullProgress,volume:held ? 0.35 : 0})`; `startLoop("ambient", {volume:0.08})` drone. Restart handles after shell pause/mute stop on resume/unmute, never stack. Panned `playSfx("pop", {pitch:1.5,volume:0.15,pan})` giggle per reveal, `zap` stun, `pickup` capture, `combo` extra, `hit` break at0.15. Pan=clamped camera-relative bearing sine. Shell win/timeup cues; visual information survives mute.

## Accessibility

Furniture shake plus persistent shimmer/host icon, visible cone, star icon when stunned, progress ring, gold crown and big double-outline, counts and numeric timer; never colour/sound alone. Reduced motion removes decorative shake/wobble/particles/flicker, retains steady outlines and real ghost travel/tug. Vacuum target72 CSS px, HUD text≥14 px with existing CSS variables/CSS Modules and registered safe rectangles. Aim assist is disclosed; keyboard-only movement-facing remains playable. Cute, smiling ghosts require user playtest approval.

## Risks and open questions

- Claude/user: approve finite timed schedule (earliest clear91.4 s), room confinement/re-hide/session/assist semantics and paired proposed limits2630/91–122 s/2350+10t. No implementation or server change until approved.
- Claude build review: actual safe-area fit≥24 px with landscape side controls/banner, legal bot wins under120, imported mesh splits≤55 target, pose/hose clearance. These are acceptance gates, not completed measurements.
- Changed from spec: books, open door leaves and decorations have no collision because desks/chairs and walls already define navigable room obstacles; hidden slots beyond the single host appear exposed because stacking shakes would conceal targets. Changed from spec: single-host re-hide replaces swapping hosts because this fixed layout has one host per room; no inter-room ghost travel.
- Snapshot verification uses cached `origin/main`, no network refresh; no listed dependency missing there. User: approve cute ghost look at playtest. No asset generation requested.

## Status
