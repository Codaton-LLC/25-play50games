# 3D Arcade core

Owned by Claude. Games import from here and never edit it. If a game needs something generic that is missing, ask Claude to add it here instead of writing it in the game folder (games do not import from each other). `games/robot-collector/` shows every helper in use.

## Time and frame order

| Step in every frame | Priority (`FRAME_PRIORITY`, `frameLoop.ts`) | What runs |
|---|---|---|
| input | -2 | `InputLatch` publishes this frame's `useInput()` state |
| clock | -1 | `RunClock`: countdown, `elapsedMs`, `timeLeftMs`, `"timeup"` |
| gameTime | -0.75 | advances `useGameTime()` |
| simulation | -0.5 | every `useRunFrame` (default) |
| camera | -0.25 | `CameraRig` follows the simulation's state |
| pose | -0.125 | `useHumanoidPose` drivers write character poses ("Characters: the auto-rig") |
| visuals | 0 | every plain `useFrame` (R3F default), `<HumanoidModel>` copies poses into its bones, then R3F renders |

- **Game logic goes in `useRunFrame((state, dt, time) => …)`.** It runs only while `"playing"`. `dt` (s, at most 1/20, always > 0) is exactly the play time the run clock counted in this frame. This includes the rest of the frame in which the countdown ends. The game never moves for time that `elapsedMs` does not include, so scoring proofs need no allowance for untimed frames. `time` is the run's play time in seconds.
- **Visuals animate with `useGameTime()`**: `now` (s since this run's Scene mounted; it advances in every phase except `"paused"`, at most 0.1 s per frame), `delta` (this frame's step, 0 while paused) and `play` (play seconds). **Never use `state.clock.elapsedTime`.** GameShell pauses by switching the R3F frameloop, and R3F resets that clock on every switch.
- **Order does not depend on mount order:** `useRunFrame` runs before `CameraRig` and every plain `useFrame`, so a visual always draws this frame's state with this frame's camera (billboards, screen projections and raycasts included).
- `useRunFrame(cb, { priority })` can change its place. The priority must lie in `(FRAME_PRIORITY.gameTime, 0]`, that is `(-0.75, 0]`. At -0.75 or below, the callback would read the previous frame's game time. A positive priority turns off R3F's automatic rendering. Above -0.25 it runs after the camera has moved. An out-of-range priority throws in development (`runFramePriority`).
- Pure versions for tests: `advanceRunClock(store, delta)` + `playedFrameDt(state)` drive `createArcadeStore()` exactly like the canvas does (`robot-collector/rules.test.ts`).

## After the run: the result delay

- When a run ends (`end("win" | "lose")` or `"timeup"`), GameShell submits the score **at once**, but the scene keeps rendering (and the HUD stays up) for `GameDefinition.resultDelayMs` before the result panel appears, so the crash or the win animation is seen. Default **800 ms** (`DEFAULT_RESULT_DELAY_MS`), `0` = the panel on the frame the run ends, at most 5000 (`RESULT_DELAY_MAX_MS`). `end("quit")` never waits.
- During the delay the phase is already `"over"`: `useRunFrame` no longer runs, score and stat changes are ignored, and `useGameTime().now` keeps going. Animate the end with visuals (`useFrame` + `useGameTime`), as before.
- GameShell hands the delay to the store with `configure({ durationMs, lives, resultDelayMs })` (resolved by `resultDelayFor`, kept in `config.resultDelayMs`). It is counted in rendered frames (the store's `overMs`, advanced by the run clock, each frame at most 50 ms), and the count stops at the delay, so the result screen causes no store update per frame. Pause cannot interrupt it (an ended run cannot be paused), and a hidden tab renders no frames, so the delay simply waits for the player to come back. Retry and Exit appear with the panel.
- Pure, for tests: `resultDelayFor(definition)` and `isResultShown(state)` (`frameLoop.ts`, reads `state.config.resultDelayMs`), driven with `advanceRunClock` on a store configured with `resultDelayMs` (`frameLoop.test.ts`).

## Shell overlays: start card, pause, result

- Every overlay (`ShellOverlays.tsx` `Overlay`: start, pause, error, rotate, context lost) keeps its panel inside the free area: the overlay's padding clears the notch and the cookie banner (`--arcade-bottom-obstruction`), and the panel is at most that tall (`max-height: 100%`) and scrolls inside itself. A button is never under the banner, and the panel's frame stays whole. The panel is `position: relative`, so absolutely positioned content (the top 10's visually hidden caption) scrolls and clips with it; otherwise it overflows the overlay, which then scrolls the whole card off its top. The overlay itself never scrolls, so the mouse wheel over the backdrop beside the panel scrolls the panel (`scrollPanelFromBackdrop`; a desktop start card with its top 10 is taller than the screen). On desktop the panel's thin scrollbar takes a few px of the card's width.
- The start card (`StartCard`) opens scrolled to the top, title first. Its Play button sits in a sticky bar: on a short screen (a landscape phone, a portrait phone under the banner) Play stays pinned to the bottom of the card while the rest scrolls; where everything fits it sits in place, before the top 10.
- First focus goes through `FocusButton` / `focusWithoutScroll` (`overlayFocus.ts`), never `autoFocus`: a plain `focus()` scrolls the overlay to the button (a landscape phone opened the start card ~300 px down). `ShellOverlays.test.ts` fails on `autoFocus` or a bare `.focus()` anywhere under `core/` (`render/` and `rig/` included); `overlayFocus.test.ts` checks that `FocusButton` focuses its own button once, after mounting, with `preventScroll`.
- Short screens (`max-height: 520px`): a tighter card, only this device's control row, and the pause / error buttons in one row.
- The result: ResultPanel (`ui/`) lays its own scrolling overlay over `.resultWrap`, which ends above the banner (and the safe-area insets).
- Focus order: the HUD is laid out (hidden) in every phase, but nothing hidden is tabbable, so the start card's Play is the first focus (then its back link). The HUD's `HudButtons` (`ShellOverlays.tsx`): Mute whenever the HUD is up; Pause only while the run can be paused (`isPausable(phase)` in `frameLoop.ts`: `"countdown"` or `"playing"`, the same rule as the store's `pause()` and Esc / P). On the start card, while paused (the overlay has Resume), during the result delay, on the result screen and behind the context-lost overlay Pause is `visibility: hidden` and disabled, keeping its slot so the HUD's measured rect never changes. The touch Jump / Action buttons are pointer-only (`tabIndex={-1}`), so a run's tab order is Mute, Pause.
- WebGL context loss (`ShellStage` `webglcontextlost`): the run pauses, the frameloop stops and the "The 3D view stopped" overlay offers "Tap to reload" (focused). It stays up even if the browser restores the context (the run is not resumed). Leaving a game logs one `THREE.WebGLRenderer: Context Lost.`: that is R3F disposing the renderer (`forceContextLoss`), not a loss. Checked 2026-10-07 with `WEBGL_lose_context` mid-run (lose, then restore) on 390 × 844, 360 × 740, 844 × 390 and 1280 × 800, banner open and closed: overlay every time, the reload back to the start card; a 390 × 844 ↔ 844 × 390 rotation mid-run lost nothing.

## Sound

`playSfx(name)` (`audio.ts`) plays short synthesized effects; mute is remembered per device (`play50games_3d_muted`, the HUD's Mute). The AudioContext is created (or resumed after the browser suspended it) only inside a real user gesture: `initAudio()` (GameShell) listens for `pointerup`, `click`, `keydown` and `touchend`, and `isAudioGesture` lets through only trusted events while `navigator.userActivation.isActive` (without that API: any trusted event but Esc). So the console has no autoplay warnings, also for Esc before Play or script-dispatched events (before: 1 and 11–12 warnings, and Esc first lost the first countdown beep). Before the first gesture `playSfx` is a silent no-op; Play itself is that gesture, so the countdown beeps play.

## Input events

`useInput().current` (read in `useRunFrame`) has held input and one-frame events. Held input (`moveX`, `moveY`, `jump`, `action`, `pointer`) is sampled once per frame. One-frame events are latched when they happen and published on the next frame, so **none is ever lost**, however short:

| Event | Set by |
|---|---|
| `jumpPressed`, `actionPressed` | a new Space / E / Enter keydown, a touch Jump / Action press |
| `pressed.left / right / up / down` | a new keydown of that arrow or WASD key (auto-repeat does not count), or a swipe that way |
| `swipe` | a quick drag on the canvas, by its dominant axis. It fires **while the finger is still moving**, as soon as it has travelled `SWIPE_MIN_PX` (30) within `SWIPE_MAX_MS` (700), once per gesture; a flick that no move event reported fires on release |
| `tap` | a short press (at most `TAP_MAX_PX`, `TAP_MAX_MS`) without travel, at the press position. Reported **on release** |
| `tapDown` | the canvas pointer going down (a finger touching the canvas, the main mouse button), at that position. Reported **on the press**, before the release and whatever the gesture becomes |

- Discrete moves (lane changes, grid hops) read `pressed` (keyboard and swipes in one place) instead of deriving edges from `moveX` / `moveY`: a key tapped and released between two frames never moves the axes, but it does set `pressed`. Two presses of one direction inside one frame (under about 16 ms) count once.
- **`pressed` already includes swipes.** A swipe sets `swipe` and `pressed[direction]` on the same frame. Handle a move from `pressed` only, and do not act on `swipe` for the same move, or every swipe moves twice (two lanes, or a hop plus a queued second hop). Read `swipe` only for meanings `pressed` does not carry. A game that switches from `moveX` / `moveY` edges to `pressed` drops its `swipe` handling for those moves in the same change.
- `pressed` is one object, mutated in place: read its fields, do not keep it.

```ts
useRunFrame(() => {
   const { pressed } = input.current;            // keys and swipes, one flag per press
   if (pressed.left) run.lane = Math.max(0, run.lane - 1);
   if (pressed.right) run.lane = Math.min(LANES - 1, run.lane + 1);
   if (pressed.up) jump(run);                    // no `input.current.swipe` branch for these moves
});
```

### `tap` or `tapDown`

| | `tap` | `tapDown` |
|---|---|---|
| When | on release, up to `TAP_MAX_MS` (350 ms) after the touch | on the frame after the finger lands |
| A drag, a swipe, a long hold | no `tap` | `tapDown` all the same (every gesture starts with one) |
| Use it for | select, inspect, confirm: a press that must not be a drag or a swipe (escape-room inspect, penalty-hero zones) | flap, shoot, whack, hit a target, start a charge (then `pointer.down` tells the hold), anything where a 100–350 ms wait on release feels late |

- **One action reads one of them.** A short press sets both: `tapDown` on the press, `tap` on the release, and on the same frame when both happen between two frames. Acting on both acts twice.
- **`tapDown` also starts every swipe.** A game that reads swipes (or `pressed`) and `tapDown` gets the `tapDown` first, a frame or more before the swipe is known. Use `tap` there, unless the press really should act before the swipe (for example "touch to start charging, swipe to aim").
- Both are in pointer coordinates (-1..1, y up, like R3F), so `Raycaster.setFromCamera(tapDown, camera)` works. `tapDown` is the press position, the same point a later `tap` reports.
- One canvas pointer at a time: the first pointer down on the canvas (for a mouse, only the main button). A second finger that lands while it is down reports no `tapDown`, `tap` or swipe. A pointer that starts on the touch controls (joystick, Jump, Action) is never the canvas pointer, so a tap beside a held joystick counts and a Jump press is `jumpPressed` only. Two presses inside one frame count once (the latest). The routing is the pure `createCanvasPointers` in `inputController.ts`.
- A phase change drops pending events, `tapDown` included. A finger that lands during the countdown reports no `tapDown` once play starts, but its release can still be a `tap`.

```ts
useRunFrame(() => {
   const { tapDown } = input.current;
   if (tapDown) whack(projectToBoard(tapDown, camera)); // on touch, not on release
});
```

## Helpers

| Need | Use | File |
|---|---|---|
| Game loop, input | `useRunFrame`, `useInput` (events: "Input events" above) | `useRunFrame.ts`, `input.tsx` |
| Discrete moves | `input.current.pressed.left` etc. (keydown edges + swipes, never lost; swipes included, so do not also move on `swipe`) | `inputController.ts` |
| Canvas presses | `input.current.tapDown` (on touch, every gesture) or `tap` (on release, short presses only); one of them per action ("`tap` or `tapDown`" above) | `inputController.ts` |
| Crash / win animation before the result | `GameDefinition.resultDelayMs` (default 800) | `types.ts`, `GameShell.tsx` |
| Pause-safe animation time | `useGameTime` | `gameTime.tsx` |
| Screen-relative movement | `inputToWorld(moveX, moveY, cameraYaw, out?)` (up = away from the camera). Pure, so `rules.ts` may use it | `math.ts` (also re-exported by `view.ts` and `input.tsx`) |
| Camera that fits the arena | `useFittedView({ area, pitch, yaws?, focus?, margin?, padding?, shift?, fov?, avoid? })` → `{ yaw, distance, offset, shift }`; pure `fitView` | `useFittedView.ts`, `view.ts` |
| Follow camera | `<CameraRig follow={ref or {x,y,z}} followFraction bounds damping offset shift>`: snaps on mount and eases into later changes | `CameraRig.tsx` |
| Fit range of a follow camera | `followFocus({ lookAt, reach, fraction, bounds })` → `focus` points, from the same math as `CameraRig` (`followAim`) | `view.ts` |
| Where UI covers the canvas | `useSafeArea()` → `{ width, height, hud[], controls[], obstructions[] }` (px rects, live); `useSafeArea(selector, isEqual?)` re-renders only when the selection changes (`sameScreenRects` for rect lists) | `safeArea.tsx` |
| Models | `<Model asset fallback={<MyPrimitive/>}>` (an element, not a component), `useModel`, `useModelFailed` (no clone), `SHARED_ASSETS` | `assets.tsx`, `sharedAssets.ts` |
| Characters that walk (static T-pose GLBs) | `<HumanoidModel asset pose fallback>`, `useHumanoidPose(drive)`, `walkPose` / `idlePose` / `carryPose` / `cheerPose` / `jumpPose` / `reachPose` / `flailPose`, `blendPoses` + `POSE_MASK`, `turnBone` (a lean on top of a pose), `walkStride` (the phase's stride) / `gaitPhaseStep` (the phase step, cadence-capped), `bodyLift` (the body's height over its planted foot), `footPoint` ("Characters: the auto-rig") | `rig/` |
| Repeated props | `<InstancedModel asset spots fallback={<Instanced spots>…</Instanced>}>`: one draw call per mesh for all copies, primitive or GLB | `assets.tsx`, `render/` |
| Moving pools (coins, obstacles, vehicles) | `<DynamicInstancedModel asset count update={(i, matrix) => …} fallbackParts?>`: one draw call per mesh for the whole pool, stand-in parts, primitive or GLB, placed every frame | `assets.tsx`, `render/` |
| Moving instancing by hand | `<DynamicInstanced count update parts?>` (or geometry + material children), pure `writeDynamicInstances` | `render/` |
| Which GLBs exist | `MODEL_MANIFEST` / `hasModel(url)`: unlisted urls are never fetched | `modelManifest.ts` |
| Static instancing by hand | `<Instanced spots>`, `useInstanceMatrices(meshRef, spots)`, `spotMatrix` | `render/` |
| Shadows | `<BlobShadow radius>` (no shadow maps) | `render/` |
| Drawn textures | `useCanvasTexture(w, h, draw)` | `render/` |
| Collision | `circlesOverlapXZ`, `resolveSphereAabb`, `clampToBounds`, `distanceToBoxXZ`, … | `collision.ts` |
| No tunnelling | `sweptAabbXZ(moving, delta, still, out?)` → time of impact 0..1 or null (touching counts; two movers: pass the relative delta) | `collision.ts` |
| Seeded rules | `createRng(seed)`, `randomSeed()` (Scene only), `turnTowards` | `math.ts` |
| Seeded fills without closures | `rngNext(state)` with `state = { s: seed }`: the same sequence as `createRng(seed)`, the state in your own scratch | `math.ts` |
| Points-game limits | `withinServerLimits(score, ms, rules)`, `capScore` | `limits.ts` |
| Store | `useArcadeStore` (`addScore`, `setStat`, `end`, …) | `useArcadeStore.ts` |

## Camera fit and the safe area

- `useFittedView` finds the closest camera that keeps `area` on screen from every `focus` point. It stays inside `margin` and out from under everything in `useSafeArea()`:
  - `hud`: the shell HUD, plus every element of the game's own `definition.Hud` marked `data-arcade-safe-area` (for example an inventory panel);
  - `controls`: the touch controls, including the joystick's lift above the cookie banner;
  - `obstructions`: the cookie banner strip while it is open;
  - its own `avoid` rects.
  `avoidHud`, `avoidControls` and `avoidObstructions` (all default true) switch the first three off.
- `shift: true` lets the fit also move the picture on screen with a lens shift. The camera does not turn. The arena then sits in the free space, for example between the HUD and a joystick the banner lifts, instead of shrinking around the screen centre. Pass `view.shift` to `CameraRig shift`.
- The lens shift survives Scene remounts (start, retry and restart remount the Scene and its `CameraRig`). The outgoing rig clears it in a layout cleanup, before the new rig's first frame, and every frame a rig checks that the camera still draws with its shift and writes it again if not (`stepLensShift` in `view.ts`; no write while it holds). A Scene needs no lens workaround. Removing `shift` (or the rig) clears the lens.
- The yaw is picked from `yaws` once per canvas size. The banner opening or closing and HUD panels change only the distance and the shift, so the camera never turns 90° in the middle of a run, and `inputToWorld(…, view.yaw)` keeps its meaning.
- A follow camera: build `focus` with `followFocus` from the same `lookAt`, `followFraction` and `bounds` you give `CameraRig`.
- The fov is the canvas camera's (`definition.camera.fov`). If the Scene's `CameraRig` sets another fov, pass the same `fov` to `useFittedView`.

- `useSafeArea(selector, isEqual?)`: a Scene that needs one number (a top inset, a control's top) re-renders only when that number changes, not every time a HUD chip grows with the score. A selector that builds an object needs an `isEqual` (`sameScreenRects` for rect lists, `shallow` from `"zustand/shallow"` for plain objects).

## Models and the manifest

`modelManifest.ts` lists every GLB under `public/models/3d`. `modelManifest.test.ts` fails when the list and the folder differ. A url that is not listed goes straight to its fallback: there is no request and no suspense. So a game written before its models exist makes no `.glb` requests. Claude's assets PRs commit the GLB and its manifest line together. Repeated props use `<InstancedModel>`, so a GLB drop keeps them instanced and needs no scene change.

## Characters: the auto-rig (`rig/`)

Hyper3D Rodin characters are **static meshes in T-pose**: arms straight out along ±x, facing +z, feet on y = 0, centred on x and z, no skeleton. The auto-rig builds the skeleton in code, so a character walks with its arms down and swinging instead of gliding along in a T. Concept images stay T-pose; the core brings the arms down and animates them.

- **Opt in on the asset:** `humanoid: { landmarks? }` on the `ModelAsset` (`SHARED_ASSETS.robot` and `runner` have it). `<Model>` then draws the character standing with its arms down (no animation, no frame callback). `<HumanoidModel>` animates it. Everything else about `<Model>` is unchanged (manifest, suspense, fallback, GameShell's cache clearing).
- **Bones** (17, `HUMANOID_BONES`, indices in `BONE`, parents first): `hips` (root) → `spine` → `chest` → `neck` → `head`; `chest` → `clavicleL` → `upperArmL` → `lowerArmL` (and R); `hips` → `upperLegL` → `lowerLegL` → `footL` (and R). Hands ride the lower arms. **L is the character's own left: it faces +z, so L is +x** (and in a game that turns the model round, `rotationY: π`, L is still the character's left).
- **Weights** (`computeSkinWeights`): arms are the vertices beyond the shoulder inside the arm band (only heights within `armRadius` of `shoulderY` count, so a head wider than the shoulders stays on the head); between the clavicle joint (`clavicleX`) and the shoulder, the clavicle; legs the vertices below the hips, split at x = 0 and blended across `crotchBlend`, with the feet below the ankle (`ankleY ± ankleBlend`: a shoe or a boot is rigid); the rest the trunk chain by height, the head from the top of the neck up (a helmet or a face never bends). **Cloth that bridges the legs** (an apron, a short skirt: below the crotch down to its hem `hemY`, further out than the bare shins' `legDepth` / `legOuterX`) is skirt-weighted: its L/R blend widens with the distance below the crotch (to about 50/50 at the hem) and it keeps a share of the hips that fades out down to the hem, so it hangs between the legs instead of stretching into a sheet. Every joint blends over its blend width; 4 influences per vertex, each row sums to 1.

### Driving a character

```tsx
const LEGS = ROBOT_LANDMARKS;                           // the character's committed landmarks
const SCALE = ASSETS.robot.scale ?? 1;
const [gait] = useState(() => ({ phase: 0, amount: 0, lift: 0 }));
const [scratch] = useState(createPose);
const pose = useHumanoidPose((p) => {               // FRAME_PRIORITY.pose: after the step and the camera
   const v = Math.hypot(run.vx, run.vz);              // this frame's state
   gait.amount += (Math.min(1, v / MAX_SPEED) - gait.amount) * (1 - Math.exp(-12 * time.delta));
   // the distance over the walk's own stride (the planted foot stays put), at most 4 strides a second
   gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, LEGS, SCALE, v, time.delta, 4));
   walkPose(gait.phase, gait.amount, p);              // legs, arms, torso (amount 0 = standing)
   blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper); // a breath when still
   if (carrying) blendPoses(p, carryPose(1, scratch), 1, p, POSE_MASK.arms); // arms only
   gait.lift = bodyLift(p, LEGS) * SCALE;              // only if the game moves the model's group itself
});
<HumanoidModel asset={ASSETS.runner} pose={pose} fallback={<RunnerPrimitive />} />
```

- **Poses** (`rig/poses.ts`, pure, no allocation; every builder writes into `out` and returns it): `restPose` (the T-pose), `armsDownPose`, `idlePose(t)`, `walkPose(phase, amount)` (amount 0 = `armsDownPose` exactly, about 0.5 a walk, 1 a run; the left leg is forward at phase π/2 and phase + π is the mirror image), `carryPose(height)` (0 = holding something at the chest, 1 = overhead), `reachPose(side, height)` (1 = `REACH_TOP`, about 60° above level: clear of a head as wide as the robot's), `cheerPose(t)`, `jumpPose(tuck)` (in the air: `ground` 0), `flailPose(t)` (knocked off its feet: arms up and waving, legs bent, in the air; the game's group tumbles), `aimArm(out, side, upper, fore, roll?)` to point an arm exactly (each segment turns the shortest way, so the shoulder never wrings), `levelFoot(out, side, k?)` to keep a sole flat, and `turnBone(out, bone, x, y, z)` to turn one bone further in its parent's frame on top of what the pose holds (a lean into a run on a walking spine, a slump of the head; a whole-body lean about the feet would tip the soles into the floor). `blendPoses(a, b, k, out, mask?)` (in place is fine; `POSE_MASK.arms / legs / upper / all`), `mirrorPose`, `copyPose`, `createPose`. A game's own poses (penalty-hero's kick, the keeper's ready stance and dive: `games/penalty-hero/poses.ts`) are built from these and `setBoneEuler` / `BONE`, pure and tested the same way.
- **The walk** keeps its stance knee straight and folds the knee only in the swing (the thigh lifts with it, so the foot clears the floor); both legs are straight at the long stride, where the planted foot hands over to the other. The soles stay flat (`levelFoot`). The thighs sweep at a nearly even pace, so the planted foot stays put when the phase advances by **`walkStride(amount, landmarks)`** (GLB units, two steps; × the asset's scale for metres; 0 at amount 0, so clamp it). **`gaitPhaseStep(amount, landmarks, scale, speed, dt, maxCadence?, minStride?)`** is that phase step in one call (rad: distance over the stride × 2π, the stride never under `minStride`, default `MIN_GAIT_STRIDE` 0.1 m, and never so short the legs beat more than `maxCadence` strides a second; 0 at speed 0); a game wraps it in a function of its own constants and tests that (`games/robot-collector/gait.ts`, `games/food-catcher/poses.ts`). The cap only bites where the walk's own stride is too short for the speed, so map the speed to the amount so it does not bite at walking speeds (food-catcher: amount = speed / 7.5 m/s, not over its 9 m/s top). A run (amount 0.5 → 0.9) reaches with a bent front knee and flies with its legs apart.
- **Arm angles start from the hanging arm.** The rig lowers each upper arm by `pose.dropL` / `dropR` (0 = straight out, 1 = hanging at the character's own `armSpread`) before the pose's rotation, so one pose fits a slim runner and a bulky robot. `reachPose` and `aimArm` set the drop to 0 and aim from the T-pose, so their directions are exact.
- **The clavicles are the rig's** (`resolvePose`): an arm raised above level shrugs its clavicle by `CLAVICLE_SHARE` (0.55) of its elevation (up to `SHRUG_TOP`, 46°) and keeps its own direction, so the top of the shoulder rises with it instead of being crushed. A pose's own clavicle rotations are ignored.
- **The body's height:** `bodyLift(pose, landmarks)` (GLB units, `gait.ts`) = `pose.ground` × `groundLift` (the rise that puts the lower of the four sole points, heel and toe of each foot, on the floor: 0 for straight legs, negative at a walk's long stride, the legs' forward kinematics with the character's own landmarks) + `pose.lift` × the hip height. `ground` is 1 for standing and walking poses, 0 in a jump; a run lets go of it with its legs apart and adds a small `lift` (its flight). Any `ground` in 0..1 with `lift` ≥ 0 keeps the feet out of the floor. `<HumanoidModel>` raises the hips by it; pass `applyLift={false}` when the game moves the model's group itself, and add `bodyLift × scale` to that group (the robot games do, so the stand-in and a carried box move with it). `soleHeight(pose, landmarks, side)` gives one foot's height over the floor, `footPoint(pose, landmarks, side, out?)` its ankle (x, y, z) and sole height before the lift (to check that a planted foot stays where it stood).
- **Blending an aimed arm with a hanging one passes the T-pose.** The hanging arm's drop and an aimed arm's rotation (`carryPose`, `aimArm`: drop 0) blend separately, so a blend from a hanging arm to an arm raised up and out (`carryPose(0.7)`) swings it out level on the way. Go through the forearms-forward carry first: blend `carryPose(height × w)` by `min(1, 3w)` with `w` the reach's weight (food-catcher `catchReach`; `chef.test.ts` checks the hands never pass 0.5 of the 0.9 T reach).
- **Frame order:** `<HumanoidModel>` copies the pose into its bones every frame at `FRAME_PRIORITY.visuals`. Write the pose before that: in a `useHumanoidPose` driver (`FRAME_PRIORITY.pose`, after `useRunFrame` and the camera; the driver may be a new function every render) or in `useRunFrame`. A plain `useFrame` that writes it may run after the copy (same priority) and show a frame late. A plain `useFrame` that **reads** what the driver computed (a gait phase, the lift) sees this frame's values.
- `<HumanoidModel>` props: `asset`, `pose?` (default arms down), `applyLift?` (default true), `fallback?` (an element, as for `<Model>`), `fallbackColor?`, group props and `children`. To tell whether the stand-in is showing (and give it its own bob or lean), wrap the fallback in a group with a ref: it is non-null only while the stand-in is mounted.
- The skinned meshes share the loaded geometry's attributes and materials (only `skinIndex` / `skinWeight` are new) and are **not frustum culled** (moving limbs change the bounds; one character is one draw call per GLB mesh). The template is built once per loaded GLB and set of landmarks (`humanoidTemplate`, cached by scene); every `<HumanoidModel>` clones its own bones (SkeletonUtils). The bind pose draws exactly where `<Model>` draws the static GLB (same `scale` / `stretch` / `rotationY` / `yOffset`).
- Lower level (core and tests): `estimateHumanoidLandmarks`, `computeSkinWeights`, `humanoidJoints`, `buildHumanoidTemplate`, `cloneHumanoid`, `applyHumanoidPose`, `disposeHumanoid` (a clone's bone textures; `useHumanoidRig` calls it when the clone unmounts, so the per-run Scene remount leaks nothing), `resolvePose`, `setBoneEuler`, `groundLift`, `useHumanoidRig` (`assets.tsx`).

### Landmarks, and measuring a character

`HumanoidLandmarks` (GLB units, the GLB root's space with the mesh node transforms applied, before `asset.scale`): `shoulderY`, `shoulderX`, `shoulderZ`, `armRadius`, `clavicleX`, `elbowX`, `wristX`, `armSpread` (rad from straight down), `crotchY`, `hipY`, `hipX`, `hipZ`, `kneeY`, `ankleY`, `toeZ`, `heelZ` (the sole's ends; the soles lie on y = 0), `legDepth`, `legOuterX` (the bare shins' half depth about `hipZ` and outer |x|: cloth beyond them is skirt-weighted), `hemY` (the lowest height where cloth bridges the legs; `crotchY` = none), `spineY`, `chestY`, `neckY`, `headY`, `spineZ`, and the blend half-widths `shoulderBlend`, `elbowBlend`, `hipBlend`, `kneeBlend`, `ankleBlend`, `crotchBlend`, `spineBlend`, `neckBlend`. `x` values are |x| (both sides).

`estimateHumanoidLandmarks(positions, explicit?)` finds them from the vertex cloud: the arm band from the forearms' heights, the shoulder half an arm radius outside the torso (where the |x| columns' vertical extent collapses to the arm's), the clavicle halfway in, wrists at 70 % of the way to the hand tips, elbows halfway, the crotch from where the middle-depth strip of the cloud parts into two legs (so an apron or a short skirt does not hide the gap), hips a little above it, knees halfway down, the feet from the bands deeper than halfway between the shins and the soles (the ankle a blend width above them, so a whole shoe is rigid), `hipZ` and the leg size from the bare shins, the hem from where something bridges the legs below the crotch, the neck at the narrowest height above the arms with the head joint at the top of that neck, the arm spread from the body's width below the shoulder. Explicit fields win one by one, and later estimates build on them.

**Each character's landmarks are committed explicitly** on its asset, so what ships never depends on the heuristics. The recipe, used for the robot (`ROBOT_LANDMARKS` in `sharedAssets.ts`, checked by `rig/robot.test.ts`) and the group B characters (`RUNNER_LANDMARKS` there, `CHEF_LANDMARKS` in `games/food-catcher/assets.ts`, `STRIKER_LANDMARKS` / `KEEPER_LANDMARKS` in `games/penalty-hero/assets.ts`):

1. Read the GLB's positions in the root's space (node transforms applied): a throwaway node script with `@gltf-transform` (`tools/hyper3d/node_modules`) or `rig/robotGlb.ts` `readCharacterGlb(url)` (the tests' reader: it meshopt-decodes the POSITION and index accessors directly; every Rodin character is one translated node with one mesh). A height profile of the cloud (per 2 cm band: max |x|, the innermost vertex of the middle-depth strip per side, the z range) shows the arm band, where the legs part, a hem, the neck and the shoes at a glance.
2. Run `estimateHumanoidLandmarks` on them for a starting set.
3. Look at it posed: bundle `core/rig` with esbuild into a scratch page (outside the repo) that loads the GLB with `GLTFLoader` + `MeshoptDecoder`, builds the template with `buildHumanoidTemplate(gltf.scene, { landmarks })` and renders rest, arms down, the walk at several phases (side view, with the floor), the carry, the cheer, a reach, front, side and close-up views. Tune the fields that look wrong (arms through the body: `armSpread` or `shoulderX`; a shoulder cap or a head bending with an arm: `shoulderX`, `armRadius`; a face or helmet bending: `headY` + `neckBlend` at the top of the neck; a shoe bending: `ankleY` above it; a torn knee or elbow: the joint or its blend).
4. Commit the full set on the asset and add a test with `rig/characterChecks.ts` `describeCharacter(name, spec)` (and `rigCharacter(asset)` → `{ glb, posed(pose, applyLift?) }`, the same CPU skinner for a game's own poses on the real mesh: food-catcher's catch, office-escape's crash) (`rig/runner.test.ts`, `games/food-catcher/chef.test.ts`, `games/penalty-hero/striker.test.ts` / `keeper.test.ts`; `robot.test.ts` is the hand-written original): the committed set within tolerance of the estimate (per-key overrides for what was set by eye, and `explicit` seeds for a field the heuristics lose on that mesh), the bind pose equal to the static GLB, the hands beside the hips with the arms down and nothing below the floor, the planted foot within 1 cm of the floor through a walk, the head rigid, and for cloth that bridges the legs (the chef's apron) its stretch under 2x over a walk cycle with a thigh poke-through reported.

What the heuristics got wrong on the group B characters, for the next one: a flat, decimated chest (the striker's) leaves the shoulder columns too sparse, so the shoulder lands at the neck (`shoulderX` 0.07 for 0.245) and the arm spread at its cap: set `shoulderX` by hand; close inner thighs (joggers) and the inner sides of shorts read as a hem bridging the legs: set `hemY = crotchY`; short or raglan sleeves wider than the forearm stay out as trunk when the arm drops: widen `armRadius` to cover them; shoes: `ankleY` above their top with a small blend. On the stylised v2 runner (a big head, a beard down to the hood's collar, no neck in sight) the narrowest bands above the arms are the beard and the mouth, so the estimate's head joint fell at the mouth: set `headY` at the top of the collar (`neckY` 2 blends below) so the face, glasses and beard turn as one; its thick sleeve (a stripe on top) also needed a wider `armRadius`. A Rodin T-pose whose arm span is its longest side is under 1.90 tall (the runner 1.886): derive each game's scale from the measured height.

### Adoption

| Game | Character | Scale (GLB height → m) | What drives the pose |
|---|---|---|---|
| robot-collector | shared robot (1.72 tall) | 0.82 → 1.4 | `walkPose` by distance / `walkStride` (`gait.ts` `robotPhaseStep`: cadence capped at 4/s), the idle's upper body when still, `cheerPose` on a win; `applyLift={false}`, the group carries `bodyLift` |
| warehouse-rush | shared robot | 0.7 → 1.2 | the same walk (cadence capped), `carryPose(1)` on the arms with the box |
| office-escape | shared runner (v2: 1.886 tall) | 0.825 → 1.556 | `walkPose` at the stand-in's stride phase (distance / 2.4 m), amount 0.85–1 with the speed; lean and lane roll in the spine (`turnBone`); `jumpPose` by the airborne blend; on the crash `crash.ts` `crashPose` (`flailPose`'s arms, the legs raised off the floor it lies on); `cheerPose` on the win; `applyLift={false}` |
| obstacle-race | shared runner | 0.795 → 1.5 | `walkPose` by ground covered / 1.7 m, amount with the speed; lean in the spine; `jumpPose` in the air; arms out (`aimArm`) on the beam; `flailPose` knocked or falling; `cheerPose`; a slump at time-up; `applyLift={false}` |
| food-catcher | chef (apron: skirt weights) | 0.96 → 1.82 | `games/food-catcher/poses.ts`: `idlePose` still, `walkPose` by distance / `walkStride` (amount = speed / 7.5 m/s, cadence capped above about 4 m/s) with the model turned to face the way it runs and the lean in the spine, a reach on a catch through the forearms-forward carry (`catchReach`); `applyLift={false}` |
| penalty-hero | striker | 0.92 → 1.75 | `games/penalty-hero/poses.ts`: the idle, a stride of `walkPose` over the run-up with `kickPose`'s backswing in its last quarter, the follow-through over the flight, back to the idle; lean in the spine; targets eased at 25/s |
| penalty-hero | keeper | 0.98 → 1.85 | `keeperReadyPose` (crouch, gloves out, breathing; the group's sway shifts its weight over planted feet, two-bone leg IK, and its knees bounce) blended into `keeperDivePose(side, row)` by the dive progress (`reachPose` + `jumpPose` legs + a spine bend); the group leaps and rolls |
| pigeon-crossing | pigeon (not humanoid) | 0.658 × [0.86, 1, 1] → 1.25 | a plain `<Model>`: the group's hop squash, bob and crash flatten |

Every stand-in primitive stays as the `fallback` with its old animation (the Scene sees it through a ref on its wrapper group).

### Limits

- **T-pose only.** Arms must be close to level (an A-pose of more than about 15° breaks the arm band), the model centred on x = 0 and facing +z. The pipeline (`tools/hyper3d` optimize) guarantees the rest.
- 17 bones: no fingers, no toes, no spine twist beyond the 3 trunk joints, no facial animation. A tail, a hood or a cape follows the nearest trunk bone.
- Cloth: an apron or a short skirt that bridges the legs above the knee hangs between them (skirt weights), but a leg swung far forward can poke through its hem, and a run twists it. A long coat or a dress (cloth below the knee) is not skirt-weighted: it stretches between the legs (`crotchBlend`).
- Feet: no IK in the core. The soles stay flat and the lower one carries the body (`bodyLift`), so nothing sinks into the floor; at a walk a sole may skim the floor for a moment near the end of its swing. The planted foot does not slide at `walkStride`; a game that steps slower than that (a cadence cap) slides it. A game that moves a standing character's group without stepping must plant the feet itself (penalty-hero `keeperReadyPose`: two-bone IK from the legs' landmarks), or the character glides.
- Linear blend skinning: a joint bent far (a knee past 120°, an arm far above level) loses volume. The poses stay inside that; an arm raised well above level (a cheer, a high reach) still creases the top of the shoulder a little, less than a carry's thanks to the shrug.
- Not for props or pools (`<InstancedModel>` / `<DynamicInstancedModel>` treat a humanoid asset as a static mesh), and not for GLBs with a real skeleton (`rigged`; a skinned GLB gets no auto-rig).
- The pigeon is not a humanoid: it stays a solid hopping bird.

## Moving pools: `<DynamicInstancedModel>`

For a fixed pool whose copies move every frame (office-escape coins and obstacles, pigeon-crossing vehicles):

```tsx
const placeCar = (i: number, m: Matrix4) => {          // every copy, every frame (FRAME_PRIORITY.visuals)
   const car = run.cars[i];
   if (!car.active) return false;                       // hidden: not drawn
   m.compose(V.set(car.x, 0, car.z), car.facing, ONE);   // arrives as the identity; module-level scratch only
};
<DynamicInstancedModel asset={ASSETS.car} count={run.cars.length} update={placeCar} fallbackParts={carParts} />
```

- `update` runs once per copy per frame, whatever the number of meshes, after `useRunFrame` and the camera. It writes the copy's placement (its feet, like `<Model position>`); the GLB's `scale` / `rotationY` / `yOffset` and mesh transforms are applied inside it. Shown copies are packed, so hidden pool slots cost nothing. No allocation; it may be a new function every render.
- While the GLB is missing or broken (or rigged): `fallbackParts` (one `InstancedMesh` per part, with several `locals` pieces and piece `colors` per copy, e.g. a desk's top and legs in one draw call), or else the asset's primitive. Both are placed by the same `update`, so a GLB drop needs no scene change. The parts are yours: build them once and dispose of them.
- There is no `fallback` element (unlike `<Model>` and `<InstancedModel>`): an element would be drawn once where it stands, not as a moving pool. Express the stand-in as `fallbackParts`.
- Not frustum culled (a moving pool has no fixed bounds). Keep `count` fixed: a change rebuilds the meshes.

## Closed core gaps (follow-up 2)

Games recorded these in their READMEs. The core has them now. Two of them apply to **every game automatically**, with no game change: the result delay and mid-gesture swipes. The rest need adoption in the game (`pressed`, `sweptAabbXZ`, `rngNext`, `<DynamicInstancedModel>`, the `useSafeArea` selector). No game was edited here.

| Gap | Now | Adoption | Recorded by |
|---|---|---|---|
| The result panel hides the crash and the win | `resultDelayMs` (default 800 ms) | on for every game; set `resultDelayMs` only to change the length (0 = old behaviour) | office-escape |
| Swipes fire on release | swipes fire mid-gesture at 30 px | on for every game | office-escape |
| Arrow taps between two frames are lost | `input.pressed` | game change. `pressed` already includes swipes: move from `pressed` only and drop the `swipe` handling for the same moves, or every swipe moves twice | office-escape, pigeon-crossing |
| No swept ground-box test | `sweptAabbXZ` | game change | pigeon-crossing |
| `createRng` needs a closure per stream | `rngNext({ s })` | game change | pigeon-crossing |
| `<InstancedModel>` is static | `<DynamicInstancedModel>` / `<DynamicInstanced>` | game change | office-escape (local `InstancedProp`), pigeon-crossing |
| `useSafeArea()` has no selector | `useSafeArea(selector, isEqual?)` | game change | office-escape |

Stale game notes, left for each game's own follow-up PR (this branch edits no game):

- `games/office-escape/README.md` is current for both (2026-10-07: `resultDelayMs: 900` for the fall and the bounce, swipes mid-gesture). Its "Edge cases" line "two lane events from keyboard and swipe both apply" (`readInput`: `lane2` from `swipe`) must change with any move to `pressed`.
- The pigeon-crossing design (`origin/codex/game-pigeon-crossing`, README "Controls" and its test plan) maps `input.swipe` to hops next to keyboard edges, with a one-slot queue, and asserts the lost sub-frame press as a documented limitation. With `pressed`, hops come from `pressed` alone (no `swipe` branch, or a swipe hops and queues a second hop), and that limitation is gone.

Still open: the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll.
