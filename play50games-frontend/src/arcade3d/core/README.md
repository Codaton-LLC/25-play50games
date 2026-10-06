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
| Characters that walk (static T-pose GLBs) | `<HumanoidModel asset pose fallback>`, `useHumanoidPose(drive)`, `walkPose` / `idlePose` / `carryPose` / `cheerPose` / `jumpPose` / `reachPose`, `blendPoses` + `POSE_MASK`, `walkStride` (the phase's stride), `bodyLift` (the body's height over its planted foot) ("Characters: the auto-rig") | `rig/` |
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
   const stride = Math.max(0.1, walkStride(gait.amount, LEGS) * SCALE);   // m: the planted foot stays put
   gait.phase = wrapPhase(gait.phase + (v * time.delta / stride) * Math.PI * 2);
   walkPose(gait.phase, gait.amount, p);              // legs, arms, torso (amount 0 = standing)
   blendPoses(p, idlePose(time.now, scratch), 1 - Math.min(1, gait.amount * 5), p, POSE_MASK.upper); // a breath when still
   if (carrying) blendPoses(p, carryPose(1, scratch), 1, p, POSE_MASK.arms); // arms only
   gait.lift = bodyLift(p, LEGS) * SCALE;              // only if the game moves the model's group itself
});
<HumanoidModel asset={ASSETS.runner} pose={pose} fallback={<RunnerPrimitive />} />
```

- **Poses** (`rig/poses.ts`, pure, no allocation; every builder writes into `out` and returns it): `restPose` (the T-pose), `armsDownPose`, `idlePose(t)`, `walkPose(phase, amount)` (amount 0 = `armsDownPose` exactly, about 0.5 a walk, 1 a run; the left leg is forward at phase π/2 and phase + π is the mirror image), `carryPose(height)` (0 = holding something at the chest, 1 = overhead), `reachPose(side, height)` (1 = `REACH_TOP`, about 60° above level: clear of a head as wide as the robot's), `cheerPose(t)`, `jumpPose(tuck)` (in the air: `ground` 0), `aimArm(out, side, upper, fore, roll?)` to point an arm exactly (each segment turns the shortest way, so the shoulder never wrings), and `levelFoot(out, side, k?)` to keep a sole flat. `blendPoses(a, b, k, out, mask?)` (in place is fine; `POSE_MASK.arms / legs / upper / all`), `mirrorPose`, `copyPose`, `createPose`.
- **The walk** keeps its stance knee straight and folds the knee only in the swing (the thigh lifts with it, so the foot clears the floor); both legs are straight at the long stride, where the planted foot hands over to the other. The soles stay flat (`levelFoot`). The thighs sweep at a nearly even pace, so the planted foot stays put when the phase advances by **`walkStride(amount, landmarks)`** (GLB units, two steps; × the asset's scale for metres; 0 at amount 0, so clamp it). A run (amount 0.5 → 0.9) reaches with a bent front knee and flies with its legs apart.
- **Arm angles start from the hanging arm.** The rig lowers each upper arm by `pose.dropL` / `dropR` (0 = straight out, 1 = hanging at the character's own `armSpread`) before the pose's rotation, so one pose fits a slim runner and a bulky robot. `reachPose` and `aimArm` set the drop to 0 and aim from the T-pose, so their directions are exact.
- **The clavicles are the rig's** (`resolvePose`): an arm raised above level shrugs its clavicle by `CLAVICLE_SHARE` (0.55) of its elevation (up to `SHRUG_TOP`, 46°) and keeps its own direction, so the top of the shoulder rises with it instead of being crushed. A pose's own clavicle rotations are ignored.
- **The body's height:** `bodyLift(pose, landmarks)` (GLB units, `gait.ts`) = `pose.ground` × `groundLift` (the rise that puts the lower of the four sole points, heel and toe of each foot, on the floor: 0 for straight legs, negative at a walk's long stride, the legs' forward kinematics with the character's own landmarks) + `pose.lift` × the hip height. `ground` is 1 for standing and walking poses, 0 in a jump; a run lets go of it with its legs apart and adds a small `lift` (its flight). Any `ground` in 0..1 with `lift` ≥ 0 keeps the feet out of the floor. `<HumanoidModel>` raises the hips by it; pass `applyLift={false}` when the game moves the model's group itself, and add `bodyLift × scale` to that group (the robot games do, so the stand-in and a carried box move with it). `soleHeight(pose, landmarks, side)` gives one foot's height over the floor.
- **Frame order:** `<HumanoidModel>` copies the pose into its bones every frame at `FRAME_PRIORITY.visuals`. Write the pose before that: in a `useHumanoidPose` driver (`FRAME_PRIORITY.pose`, after `useRunFrame` and the camera; the driver may be a new function every render) or in `useRunFrame`. A plain `useFrame` that writes it may run after the copy (same priority) and show a frame late. A plain `useFrame` that **reads** what the driver computed (a gait phase, the lift) sees this frame's values.
- `<HumanoidModel>` props: `asset`, `pose?` (default arms down), `applyLift?` (default true), `fallback?` (an element, as for `<Model>`), `fallbackColor?`, group props and `children`. To tell whether the stand-in is showing (and give it its own bob or lean), wrap the fallback in a group with a ref: it is non-null only while the stand-in is mounted.
- The skinned meshes share the loaded geometry's attributes and materials (only `skinIndex` / `skinWeight` are new) and are **not frustum culled** (moving limbs change the bounds; one character is one draw call per GLB mesh). The template is built once per loaded GLB and set of landmarks (`humanoidTemplate`, cached by scene); every `<HumanoidModel>` clones its own bones (SkeletonUtils). The bind pose draws exactly where `<Model>` draws the static GLB (same `scale` / `stretch` / `rotationY` / `yOffset`).
- Lower level (core and tests): `estimateHumanoidLandmarks`, `computeSkinWeights`, `humanoidJoints`, `buildHumanoidTemplate`, `cloneHumanoid`, `applyHumanoidPose`, `disposeHumanoid` (a clone's bone textures; `useHumanoidRig` calls it when the clone unmounts, so the per-run Scene remount leaks nothing), `resolvePose`, `setBoneEuler`, `groundLift`, `useHumanoidRig` (`assets.tsx`).

### Landmarks, and measuring a character

`HumanoidLandmarks` (GLB units, the GLB root's space with the mesh node transforms applied, before `asset.scale`): `shoulderY`, `shoulderX`, `shoulderZ`, `armRadius`, `clavicleX`, `elbowX`, `wristX`, `armSpread` (rad from straight down), `crotchY`, `hipY`, `hipX`, `hipZ`, `kneeY`, `ankleY`, `toeZ`, `heelZ` (the sole's ends; the soles lie on y = 0), `legDepth`, `legOuterX` (the bare shins' half depth about `hipZ` and outer |x|: cloth beyond them is skirt-weighted), `hemY` (the lowest height where cloth bridges the legs; `crotchY` = none), `spineY`, `chestY`, `neckY`, `headY`, `spineZ`, and the blend half-widths `shoulderBlend`, `elbowBlend`, `hipBlend`, `kneeBlend`, `ankleBlend`, `crotchBlend`, `spineBlend`, `neckBlend`. `x` values are |x| (both sides).

`estimateHumanoidLandmarks(positions, explicit?)` finds them from the vertex cloud: the arm band from the forearms' heights, the shoulder half an arm radius outside the torso (where the |x| columns' vertical extent collapses to the arm's), the clavicle halfway in, wrists at 70 % of the way to the hand tips, elbows halfway, the crotch from where the middle-depth strip of the cloud parts into two legs (so an apron or a short skirt does not hide the gap), hips a little above it, knees halfway down, the feet from the bands deeper than halfway between the shins and the soles (the ankle a blend width above them, so a whole shoe is rigid), `hipZ` and the leg size from the bare shins, the hem from where something bridges the legs below the crotch, the neck at the narrowest height above the arms with the head joint at the top of that neck, the arm spread from the body's width below the shoulder. Explicit fields win one by one, and later estimates build on them.

**Each character's landmarks are committed explicitly** on its asset, so what ships never depends on the heuristics. The recipe, used for the robot (`ROBOT_LANDMARKS` in `sharedAssets.ts`, checked by `rig/robot.test.ts`):

1. Read the GLB's positions in the root's space (node transforms applied): a throwaway node script with `@gltf-transform` (`tools/hyper3d/node_modules`) or `rig/robotGlb.ts` (the tests' reader: it meshopt-decodes the POSITION and index accessors directly).
2. Run `estimateHumanoidLandmarks` on them for a starting set.
3. Look at it posed: bundle `core/rig` with esbuild into a scratch page (outside the repo) that loads the GLB with `GLTFLoader` + `MeshoptDecoder`, builds the template with `buildHumanoidTemplate(gltf.scene, { landmarks })` and renders rest, arms down, the walk at several phases (side view, with the floor), the carry, the cheer, a reach, front, side and close-up views. Tune the fields that look wrong (arms through the body: `armSpread` or `shoulderX`; a shoulder cap or a head bending with an arm: `shoulderX`, `armRadius`; a face or helmet bending: `headY` + `neckBlend` at the top of the neck; a shoe bending: `ankleY` above it; a torn knee or elbow: the joint or its blend).
4. Commit the full set on the asset and add a test like `robot.test.ts` (the committed set within a few cm of the estimate, hands clear of the hips with the arms down, the bind pose equal to the static GLB, the soles on the floor through a stride, the head rigid, the shoulders not crushed under a carry, the arms clear of the head).

### When `runner.glb` lands (office-escape and the other runner games)

`SHARED_ASSETS.runner` is `humanoid: {}` (no longer `rigged`: Rodin gives no skeleton), so the moment the GLB is in the manifest `<Model asset={ASSETS.runner}>` already stands it up with its arms down. office-escape still draws `RunnerPrimitive` until then and was not edited. Its own follow-up, in `games/office-escape/Scene.tsx` `Runner`:

- measure and commit the runner's landmarks (recipe above) in `SHARED_ASSETS.runner.humanoid.landmarks`;
- replace `<Model asset={ASSETS.runner} fallback={<RunnerPrimitive rig={rig} />} />` with `<HumanoidModel asset={ASSETS.runner} pose={pose} applyLift={false} fallback={<group ref={standIn}><RunnerPrimitive rig={rig} /></group>} />`, and give the body group `bodyLift(pose, landmarks) × scale` instead of its own per-stride bob while the GLB shows (`standIn.current === null`; keep the old bob, squash and lean for the stand-in). A whole-body lean about the feet would tip the soles into the floor: the walk leans its own spine;
- build `pose` with `useHumanoidPose`: `walkPose(phase, speed01, pose)` with the phase advanced by the distance run over `walkStride(speed01, landmarks) × scale` (the same convention: its left leg forward at π/2; the model is turned round with `rotationY: π`, and L stays the runner's own left; if the run is faster than the legs can step, cap the cadence as warehouse-rush does), the idle's upper body while standing, `jumpPose(tuck)` blended by its `fx.air` while airborne (its `ground` 0 lets the body leave the floor), `cheerPose(t)` on a win; for the crash, `aimArm` / `reachPose` or a blend towards a flailing pose. `RunnerPrimitive` keeps its own limb groups as the fallback.

### Limits

- **T-pose only.** Arms must be close to level (an A-pose of more than about 15° breaks the arm band), the model centred on x = 0 and facing +z. The pipeline (`tools/hyper3d` optimize) guarantees the rest.
- 17 bones: no fingers, no toes, no spine twist beyond the 3 trunk joints, no facial animation. A tail, a hood or a cape follows the nearest trunk bone.
- Cloth: an apron or a short skirt that bridges the legs above the knee hangs between them (skirt weights), but a leg swung far forward can poke through its hem, and a run twists it. A long coat or a dress (cloth below the knee) is not skirt-weighted: it stretches between the legs (`crotchBlend`).
- Feet: no IK. The soles stay flat and the lower one carries the body (`bodyLift`), so nothing sinks into the floor; at a walk a sole may skim the floor for a moment near the end of its swing. The planted foot does not slide at `walkStride`; a game that steps slower than that (a cadence cap) slides it.
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

- `games/office-escape/README.md` still describes the old behaviour: "Controls" (Touch: swipes "read on release"), "Collisions and the end of a run" (Hit: the panel mounts on the same frame and covers the tumble), "Runner animation" (crash and win "play behind the result panel"), and the two "Known issues and core gaps" entries "Swipes fire on release" and "The result panel hides the crash and the win". Both fixes are live for it already. Its "Edge cases" line "two lane events from keyboard and swipe both apply" (`readInput`: `lane2` from `swipe`) must change with any move to `pressed`.
- The pigeon-crossing design (`origin/codex/game-pigeon-crossing`, README "Controls" and its test plan) maps `input.swipe` to hops next to keyboard edges, with a one-slot queue, and asserts the lost sub-frame press as a documented limitation. With `pressed`, hops come from `pressed` alone (no `swipe` branch, or a swipe hops and queues a second hop), and that limitation is gone.

Still open: the bottom safe-area inset (`env(safe-area-inset-bottom)`) is not reported, and the cookie banner is found by a 1 s poll.
