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
- The start card (`StartCard`) opens scrolled to the top, title first. Its Play button sits in a sticky bar: on a short screen (a landscape phone, a portrait phone under the banner) Play stays pinned to the bottom of the card while the rest scrolls, and to its top once the top 10 below it is scrolled up, so Play is always on screen; where everything fits it sits in place, before the top 10. A scroll container's padding keeps a sticky bar that far off its edge (Chrome, measured: 30 px padding, bar stuck 30 px in), so the card has no top or bottom padding: a `::before` box stands in for the top one and the bar (or the top 10) supplies the bottom one.
- First focus goes through `FocusButton` / `focusWithoutScroll` (`overlayFocus.ts`), never `autoFocus`: a plain `focus()` scrolls the overlay to the button (a landscape phone opened the start card ~300 px down). `ShellOverlays.test.ts` fails on `autoFocus` or a bare `.focus()` anywhere under `core/` (`render/` and `rig/` included); `overlayFocus.test.ts` checks that `FocusButton` focuses its own button once, after mounting, with `preventScroll`.
- Short screens (`max-height: 520px`): a tighter card, only this device's control row, and the pause / error buttons in one row.
- The result: ResultPanel (`ui/`) lays its own overlay over `.resultWrap`, which ends above the banner (and the safe-area insets). Like the shell's panels, the overlay never scrolls: the card is at most as tall as the free area (`max-height: 100%`) and scrolls inside itself, and its actions (Log in or Save, Retry, Exit) sit in an opaque sticky bar pinned to the card's bottom edge while their place is further down and to its top edge once the top 10 is scrolled up. So they are on view and tappable on every screen, never under the banner (before: at 740 × 360 with the banner open, Exit spanned y 269–313 and the banner began at 275, its centre hit the banner; in portrait the card ran 214 px under the banner at 360 × 740). Top and bottom padding are `::before` / `::after` boxes for the sticky reason above. On short screens (`max-height: 520px`) the spacing is tighter and the score smaller, and on short, wide ones (`and min-width: 560px`) the card is wider (34rem) and the buttons share one row, so at 740 × 360 with the banner open the title, score and message still show above the pinned buttons. Elsewhere, where everything fits, every button sits exactly where it sat before (measured: 0 px moved). The wheel over the backdrop scrolls the card (`scrollPanelFromBackdrop`, now in `overlayScroll.ts`, re-exported by `ShellOverlays.tsx`). Checked in headless Chrome at 360 × 740, 390 × 844, 740 × 360, 844 × 390, 1280 × 720 and 1280 × 800, banner open and closed, guest (Log in), logged in (synced) and Save states, win and lose, robot-collector and escape-room: every action's centre hits the action, at the top of the card and scrolled to its end.
- The HUD (`HudChips` in `ShellOverlays.tsx`): score, time (`Time` counting down with a `durationMs`, else `Played`), lives and the game's `hudStats`. Time games (`meta.scoring.kind === "time"`: escape-room, obstacle-race) have no score chip (`hudShowsScore`): they rank the finish time and their store score stays 0, so a "Score 0" beside the running clock read as a broken score. Points games are unchanged.
- Focus order: the HUD is laid out (hidden) in every phase, but nothing hidden is tabbable, so the start card's Play is the first focus (then its back link). The HUD's `HudButtons` (`ShellOverlays.tsx`): Mute whenever the HUD is up; Pause only while the run can be paused (`isPausable(phase)` in `frameLoop.ts`: `"countdown"` or `"playing"`, the same rule as the store's `pause()` and Esc / P). On the start card, while paused (the overlay has Resume), during the result delay, on the result screen and behind the context-lost overlay Pause is `visibility: hidden` and disabled, keeping its slot so the HUD's measured rect never changes. The touch Jump / Action buttons are pointer-only (`tabIndex={-1}`), so a run's tab order is Mute, Pause.
- WebGL context loss (`ShellStage` `webglcontextlost`): the run pauses, the frameloop stops and the "The 3D view stopped" overlay offers "Tap to reload" (focused). It stays up even if the browser restores the context (the run is not resumed). Leaving a game logs one `THREE.WebGLRenderer: Context Lost.`: that is R3F disposing the renderer (`forceContextLoss`), not a loss. Checked 2026-10-07 with `WEBGL_lose_context` mid-run (lose, then restore) on 390 × 844, 360 × 740, 844 × 390 and 1280 × 800, banner open and closed: overlay every time, the reload back to the start card; a 390 × 844 ↔ 844 × 390 rotation mid-run lost nothing.

## Sound

`playSfx(name, opts?)` (`audio.ts`) plays short synthesized effects; mute is remembered per device (`play50games_3d_muted`, the HUD's Mute). The AudioContext is created (or resumed after the browser suspended it) only inside a real user gesture: `initAudio()` (GameShell) listens for `pointerup`, `click`, `keydown` and `touchend`, and `isAudioGesture` lets through only trusted events while `navigator.userActivation.isActive` (without that API: any trusted event but Esc). So the console has no autoplay warnings, also for Esc before Play or script-dispatched events (before: 1 and 11–12 warnings, and Esc first lost the first countdown beep). Before the first gesture `playSfx` is a silent no-op; Play itself is that gesture, so the countdown beeps play.

Cues: `pickup`, `hit`, `jump`, `win`, `lose`, `countdown`, `go`, `whoosh`, `splash`, `thud`, `chime`, `combo`, `buzz`, `boom`, `click`, `pop`, `zap`, `alarm` — every one under 0.6 s, synthesized (no audio files). `opts` is optional and backwards compatible: `pitch` (0.5–2) multiplies frequencies, `pan` (−1..1) plays through a `StereoPannerNode`, `volume` (0–1) scales the level.

Loops for ongoing sounds (engines, water, machinery): `startLoop(name, opts?)` with `engine`, `rotor`, `vacuum`, `belt`, `surf`, `bubbling`, `slide`, `thrust`, `hum`, `ambient`. It returns a handle whose `set({ pitch, volume, pan })` ramps over 60 ms (no clicks); a loop started before the first gesture is a silent handle that starts when audio unlocks, and mute silences it at once through the master gain. At most 4 loops sound at once — starting a 5th stops the oldest. `stopAllLoops()` stops every loop; the shell stops every loop on pause, mute, run end and unmount (wired in P-03).

```ts
import { playSfx, startLoop, stopAllLoops } from "@/arcade3d/core/audio";

playSfx("pickup");                              // as before
playSfx("combo", { pitch: 1.2, pan: 0.4 });     // brighter, panned right
const engine = startLoop("engine", { volume: 0.6 });
engine.set({ pitch: 1.5 });                     // rev up: 60 ms ramp, no click
const surf = startLoop("surf");                 // waves under a boat level
surf.set({ pan: -0.3, volume: 0.4 });
surf.stop();                                    // 60 ms fade out
stopAllLoops();                                 // the shell: pause, run end, unmount
```

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
| Projectile aiming and prediction | `solveLaunch`, `launchForTime`, `stepProjectile`, `trajectoryPoints`, `landingPoint` | `ballistics.ts` |
| Arc-length paths and conveyor junctions | `createPath`, `pointAt`, `tangentAt`, `nearestS`, `advance`, `createPathGraph` | `path.ts` |
| Whole-body offsets and damped springs | `hop`, `waddle`, `hover`, `bank`, `spring`, `squashStretch` | `motion.ts` |
| Blades, landers and suspended loads | `circleSegmentXZ`, `resolveCircleSegmentXZ`, `substep`, `stepRigidBody2D`, `stepPendulum` | `kinematics.ts` |
| Steering forces | `seek`, `arrive`, `flee`, `wander`, `separate` | `ai/steering.ts` (barrel: `ai/index.ts`) |
| Horizontal sight checks | `inViewCone`, `hasLineOfSightXZ` | `ai/vision.ts` |
| Patrol and investigation | `stepPatrol`, `investigate` | `ai/patrol.ts` |

## Camera fit and the safe area

- `useFittedView` finds the closest camera that keeps `area` on screen from every `focus` point. It stays inside `margin` and out from under everything in `useSafeArea()`:
  - `hud`: the shell HUD, plus every element of the game's own `definition.Hud` marked `data-arcade-safe-area` (for example an inventory panel);
  - `controls`: the touch controls, including the joystick's lift above the cookie banner;
  - `obstructions`: the cookie banner strip while it is open, or the home-indicator inset when that is taller;
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
- **The walk** keeps its stance knee straight and folds the knee only in the swing (the thigh lifts with it, so the foot clears the floor); both legs are straight at the long stride, where the planted foot hands over to the other. The soles stay flat (`levelFoot`). The thighs sweep at a nearly even pace, so the planted foot stays put when the phase advances by **`walkStride(amount, landmarks)`** (GLB units, two steps; × the asset's scale for metres; 0 at amount 0, so clamp it). **`gaitPhaseStep(amount, landmarks, scale, speed, dt, maxCadence?, minStride?)`** is that phase step in one call (rad: distance over the stride × 2π, the stride never under `minStride`, default `MIN_GAIT_STRIDE` 0.1 m, and never so short the legs beat more than `maxCadence` strides a second; 0 at speed 0); a game wraps it in a function of its own constants and tests that (`games/robot-collector/gait.ts`, `games/food-catcher/poses.ts`). The cap only bites where the walk's own stride is too short for the speed, so map the speed to the amount so it does not bite at walking speeds (food-catcher: amount = speed / 5 m/s for its short-legged v2 chef, not over its 9 m/s top). A run (amount 0.5 → 0.9) reaches with a bent front knee and flies with its legs apart.
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
| food-catcher | chef (v2: 1.869 tall; tunic skirt: skirt weights) | 0.975 → 1.82 | `games/food-catcher/poses.ts`: `idlePose` still, `walkPose` by distance / `walkStride` (amount = speed / 5 m/s, cadence capped (4/s) above about 5 m/s), turned towards the way it runs by its eased speed / 0.5 m/s of a quarter turn, the lean in the spine, a reach on a catch through the forearms-forward carry (`catchReach`); stands on the worktop (y 0.05); `applyLift={false}` |
| penalty-hero | striker (v2: 1.876 tall) | 0.93 → 1.745 | `games/penalty-hero/strikerMotion.ts` + `poses.ts`: the idle, a stride of `walkPose` over the run-up with `kickPose`'s backswing in its last quarter, the follow-through over the flight, then the kick leg down and four steps back to the start spot (`plantLeg` IK on both legs, planted feet held); lean in the spine; targets eased at 25/s |
| penalty-hero | keeper (v2: 1.8155 tall) | 1.02 → 1.85 | `keeperReadyPose` (crouch, gloves out, breathing; the group's sway shifts its weight over planted feet, two-bone leg IK, and its knees bounce) blended into `keeperDivePose(side, row)` by the dive progress (`reachPose` + `jumpPose` legs + a spine bend); a quarter of each head turn (`KEEPER_HEAD_TURN`, the beard stays on the face); the group leaps and rolls (`layout.ts` `keeperDivePlacement`, every dive above the grass on the real mesh) |
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

Closed in P-03 (core v3): Esc / P no longer act behind the "Rotate your device" overlay, and the bottom safe-area inset is reported ("Safe area: the bottom inset" below). Still open: the cookie banner is found by a 1 s poll.

## Ballistics helper

Pure metre/second coordinates, +Y up; gravity is a nonnegative downward acceleration and wind is constant XZ acceleration. `solveLaunch` solves both arcs including wind and returns null for unreachable/coincident targets and non-finite gravity or speed. `launchForTime` requires finite positive time; pass a Vec3Like output to avoid allocation (input/output aliasing works). `stepProjectile` mutates state using semi-implicit Euler. Prediction samples use the continuous closed form, so Euler playback has timestep error. `trajectoryPoints` includes the initial point and final ground contact, bounds writes to buffer capacity, and returns points written (zero for non-finite count). `landingPoint(proj, params, groundY?, out?)` computes impact time and wind position in closed form in constant time; null means no future ground hit. Grounded upward launches predict their next landing; grounded downward or buried projectiles land immediately. Allocate state and buffers once.

```ts
import { launchForTime, stepProjectile, trajectoryPoints, landingPoint } from "./ballistics";
const from = { x: 0, y: 1, z: 0 }, to = { x: 8, y: 0, z: 0 };
const params = { gravity: 9.81, wind: { x: 1, z: 0 } };
const velocity = { x: 0, y: 0, z: 0 };
launchForTime(from, to, 2, params, velocity);
const projectile = { ...from, vx: velocity.x, vy: velocity.y, vz: velocity.z };
const buffer = new Float32Array(90), landing = { x: 0, y: 0, z: 0 };
const count = trajectoryPoints(projectile, params, 30, 0.1, buffer);
landingPoint(projectile, params, 0, landing);
stepProjectile(projectile, 1 / 120, params); // repeat per simulation step
```

## Testing helpers: botHarness

`core/testing/botHarness.ts` is for vitest only (`botHarness.test.ts` fails if runtime code imports it); pure, no three.js or React. Score-limit bots (the arcade-score-limits skill asks for 200+ seeds per bot) reuse it instead of copying a path finder: `createGrid({ cell, halfX, halfZ })`, `freeGrid(grid, walkable)` (the game's own rule per node), `findPath` (Dijkstra, 8 neighbours, no cut corners; `[]` when walled off), `nearestFree`, `followPath` + `steer` (unit direction along the path, then straight at the goal), and `simulateRun(store, { durationMs, lives?, frame, step })`, which configures, starts and drives a fresh store exactly like the canvas (`advanceRunClock`, then `step(playedFrameDt, elapsedMs / 1000, store)` while playing) until the phase is `"over"`. `fixedFrames(ms)` / `randomFrames(seed, min?, max?)` make the frame lengths. `games/treasure-island/rules.test.ts` uses all of it.

```ts
const grid = createGrid({ cell: 0.25, halfX: 16, halfZ: 13 });
const free = freeGrid(grid, (x, z) => insideArena(x, z) && clearance(level, x, z) >= RADIUS + 0.1);
const follower = followPath(grid, free, p.x, p.z, goal.x, goal.z);
const end = simulateRun(createArcadeStore(), { durationMs: DURATION_MS, frame: randomFrames(seed), step: (dt, time, store) => {
   steer(grid, follower, p.x, p.z, input); // writes input.dirX / input.dirZ
   stepGame(run, input, dt, time);           // the game's pure step + its store calls (addScore, end("win"))
} });
expect(withinServerLimits(end.score, end.elapsedMs)).toBe(true);
```

## Path helper

`createPath` copies control points and builds a Float64 arc-length table once. Open polylines clamp; closed polylines wrap both positive and negative distances. `smooth` selects uniform Catmull-Rom with `samples` intervals per segment (default 16); point/tangent queries operate on the sampled polyline. At a joint, tangent is the outgoing segment (incoming at an open endpoint); duplicate open endpoints use the last nonzero tangent; entirely coincident paths have zero tangent. Non-finite point distances select the start. Distances use all three axes. Empty paths are rejected; singleton paths stay fixed. `advance(state, ds)` mutates `{ path, s, position, overflow? }` without allocation, writing signed unconsumed open-path distance to `overflow`. `nearestS` chooses the first nearest segment on ties. `createPathGraph(segments, junctions)` copies outgoing index lists; `next(segment, choice)` returns null for unavailable choices. Junction lists have one row per segment. `advanceGraph(state, graph, choose, ds)` carries forward overflow into connected paths; `choose(endingSegmentIndex)` returns an outgoing path index. Missing links, reverse travel and zero-length cycles retain overflow. Riders retain optional `segment` identity, initialized with `indexOf` once when omitted; set it when entering a graph externally. Invalid junction entries are skipped using `choiceCount(segment)` to bound the row scan; legacy graphs without it stop at the first null.

```ts
import { createPath, advance, tangentAt, nearestS, createPathGraph } from "./path";
const points = [{ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 2 }];
const path = createPath(points, { closed: true, smooth: true, samples: 24 });
const rider = { path, s: 0, position: { x: 0, y: 0, z: 0 } };
const tangent = { x: 0, y: 0, z: 0 };
advance(rider, 2 / 60);
tangentAt(path, rider.s, tangent);
const closest = nearestS(path, rider.position);
const graph = createPathGraph([path], [[0]]);
const nextSegment = graph.next(0, 0); // 0; an absent choice returns null
```

## Motion helper

BodyOffset is `{ y, roll, yaw, squash }`: vertical displacement, radians, and vertical scale (1 at rest). Every motion helper resets all fields and fills the required output. Hop/waddle phase is radians; hover time is seconds. `bank` maps lateral acceleration to roll with a gravity reference of 9.81 and clamps to maxRoll. `spring` exactly solves a unit-mass linear spring for a constant target each step; stiffness and damping are nonnegative, or damping = -1 selects critical damping. It mutates `{ x, v }` and returns x; non-finite or nonpositive dt leaves state unchanged. `squashStretch(verticalScale, out)` fills positive volume-preserving XYZ scale. Compose offsets in the game when desired.

```ts
import { hop, waddle, hover, bank, spring, squashStretch } from "./motion";
const offset = { y: 0, roll: 0, yaw: 0, squash: 1 };
const scale = { x: 1, y: 1, z: 1 };
const suspension = { x: 0, v: 0 };
hop(Math.PI / 3, 0.4, offset);
squashStretch(offset.squash, scale);
waddle(0.5, 0.1, offset); // replaces the previous offset
hover(2, 0.05, offset);
const roll = bank(3, 0.4);
spring(suspension, 0.2, 40, -1, 1 / 60);
```

## Kinematics helper

XZ circles use `{ x, z, vx, vz, radius }`; segments use endpoints a/b and optional pivot, omega, vx/vz. `circleSegmentXZ` returns a contact or null; reuse SegmentContact output. `resolveCircleSegmentXZ` pushes out and reflects relative incoming velocity, clamping restitution to [0,1]. The fourth argument is nonnegative Coulomb `mu`: tangential speed decreases by at most mu times the applied normal velocity change, without reversing direction. Rotation about +Y follows vx = omega * relativeZ, vz = -omega * relativeX; moving walls can transfer energy. `rotateSegmentXZ` rotates endpoints in place. Contacts are discrete: use sufficiently small steps to avoid tunneling. `substep(dt, maxStep, fn)` consumes all dt in equal steps no larger than maxStep, returning step count; cache fn. Use `createFixedStep(step)` once and `fixedStep(clock, dt, fn)` (step is stored at initialization; the legacy four-argument form still works) per frame for frame-rate independence: fractional time carries forward; at most eight whole steps run per call, dropping excess whole steps. Invalid dt/step runs no steps. Keep the step constant and cache fn. `substep` provides only a per-call size bound. Lander `stepRigidBody2D` uses semi-implicit Euler, radians, unit mass/inertia defaults, angle 0 thrust along +Y, positive angle towards -X. Pendulum `stepPendulum` is an exact damped small-angle model with `{ x: angle, v: angularSpeed }`, positive length/gravity, damping in inverse seconds. `stepPendulum2D` applies independent X/Z swing axes driven by pivot acceleration; it is a linear approximation, not a spherical pendulum.

```ts
import { circleSegmentXZ, resolveCircleSegmentXZ, createFixedStep, fixedStep, stepRigidBody2D } from "./kinematics";
const ball = { x: 0.1, z: 0, vx: -1, vz: 0, radius: 0.2 };
const wall = { a: { x: 0, z: -2 }, b: { x: 0, z: 2 } };
const hit = { x: 0, z: 0, nx: 0, nz: 0, depth: 0, vx: 0, vz: 0 };
if (circleSegmentXZ(ball, wall, hit)) resolveCircleSegmentXZ(ball, hit, 0.8, 0.1);
const lander = { x: 0, y: 2, angle: 0, vx: 0, vy: 0, omega: 0 };
const forces = { thrust: 10, torque: 0, gravity: 9.81 };
const integrate = (dt: number) => stepRigidBody2D(lander, dt, forces);
const clock = createFixedStep(1 / 120); // initialize once
fixedStep(clock, 1 / 30, 1 / 120, integrate);
// Keep integrate, forces and hit for subsequent frames.
```

## AI steering helper

All AI functions are re-exported by `ai/index.ts`. Agent is `{ x, y, z, vx, vy, vz, yaw }`; AI yaw 0 faces +Z, positive yaw faces +X. Seek/arrive/flee fill a required Vec3 output with desired velocity minus current velocity, an acceleration with a one-second response time. Arrive scales desired speed inside slowRadius. `wander` takes caller-owned angle state, rng, speed, angular jitter in radians/sqrt(second), dt and output; jitter scales by sqrt(dt) for consistent random-walk variance; it only changes the angle state. `separate` returns capped inverse-distance repulsion, ignores self by identity, and uses deterministic golden-angle pair directions for coincident neighbors, avoiding three-agent cancellation. Pass the same ordered list including both agents/self for opposing coincident-pair forces. Combine and clamp forces in the game. Never alias steering output to agent or a neighbor position.

```ts
import { seek, arrive, flee, wander, separate } from "./ai";
import { createRng } from "./math";
const agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
const target = { x: 4, y: 0, z: 2 }, force = { x: 0, y: 0, z: 0 };
const wanderState = { angle: 0 }, rng = createRng(42);
seek(agent, target, 2, force);
arrive(agent, target, 2, 1, force);
flee(agent, target, 2, force);
wander(agent, wanderState, rng, 2, 0.8, 1 / 60, force);
separate(agent, [target], 1, 2, force); // keep neighbor array between frames
```

## AI vision helper

`inViewCone` uses horizontal range and yaw, ignoring height; range and angular boundaries are inclusive, and coincident points are visible. Half angles at least PI see all directions. Box reuses collision.ts AABB `{ min: Vec3Like, max: Vec3Like }`; sight tests only X/Z. `hasLineOfSightXZ` checks the whole closed segment, so starting inside a box or touching a corner blocks sight. Non-finite sight endpoints fail closed even without blockers. Both helpers allocate nothing.

```ts
import { inViewCone, hasLineOfSightXZ, type Box } from "./ai";
const origin = { x: 0, y: 1, z: 0 };
const target = { x: 2, y: 1, z: 3 };
const yaw = 0, halfAngle = Math.PI / 4, range = 8;
const blockers: Box[] = [{ min: { x: 4, y: 0, z: 1 }, max: { x: 5, y: 2, z: 2 } }];
const inCone = inViewCone(origin, yaw, halfAngle, range, target);
const clear = hasLineOfSightXZ(origin, target, blockers);
const visible = inCone && clear;
if (visible) { /* game decides whether to investigate */ }
// Reuse blockers and vector objects; these queries never mutate them.
```

## AI patrol helper

PatrolState retains index (next route waypoint), wait seconds, mode and caller-owned target; optional lookPhase/lookYaw preserve deterministic waiting motion. `stepPatrol` moves Agent directly along the route's sampled waypoints at constant speed, updating its velocity and yaw. It loops waypoints even on an open route (last to first); use closed routes for a continuous circuit. PatrolOptions supplies speed plus optional wait, investigateWait, lookAngle radians and lookSpeed radians/sec. `investigate(state, point)` copies the target, keeps the route index, and cancels waiting. After inspecting it, the agent returns to the nearest point of its route and resumes the saved waypoint. A return target can cut across the world; games must handle obstacles. State.target must be a separate object from agent/route points. No per-step allocation.

```ts
import { stepPatrol, investigate, type PatrolState } from "./ai";
import { createPath } from "./path";
const route = createPath([{ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 0 }], { closed: true });
const agent = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, yaw: 0 };
const state: PatrolState = { index: 1, wait: 0, mode: "patrol", target: { x: 0, y: 0, z: 0 } };
const options = { speed: 2, wait: 0.5, investigateWait: 1 };
stepPatrol(agent, state, route, 1 / 60, options);
const noise = { x: 2, y: 0, z: 3 };
investigate(state, noise);
stepPatrol(agent, state, route, 1 / 60, options); // repeat until patrol resumes
```

## Effects: `core/fx` (bursts, score popups, shake, trail)

ShellStage wraps every run's Scene in `<FxLayer>`, so a Scene calls `useFx()` and nothing else. A layer that is never used draws nothing: a kind's pool (one `InstancedMesh`, one draw call for all its particles) mounts on its first burst, the 8 score sprites (one draw call each while shown) on the first `score()`. Kinds: `sparkle`, `puff`, `splash`, `debris`, `confetti`, `smoke`, `sparks`, `snow` (`BURST_STYLES` in `fx/bursts.ts`). Counts are scaled by `useQuality().particles`; nothing allocates per emit or per frame after a kind's first use (call `fx.warm(...)` on mount to build the pools before play, so the first use does not hitch). Effects run on `useGameTime()`: frozen while paused, gone on the next run. `fx.shake(amount)` (0..1; the same as `useCameraShake()(amount)`) adds a decaying offset along the camera's right / up after every `CameraRig` (priority camera + 0.05) and takes it off before the next frame's rigs (gameTime + 0.05), so it works with a static camera and with follow rigs; it does nothing when the player prefers reduced motion. Score text uses one canvas texture per sprite slot, redrawn only when the slot's text changes. `<Trail>` is a camera-facing ribbon behind a ref or a live point: one draw call, tapering and fading, shrinking when the target stops.

```tsx
import { Trail, useFx } from "../../core/fx";
const fx = useFx();
useEffect(() => fx.warm("sparkle", "score"), [fx]);
useRunFrame(() => {
   if (!run.justPicked) return;
   fx.burst("sparkle", run.player, 18);                 // any {x, y, z}
   fx.score(run.player, "+100", { color: "#fde68a" });
   fx.shake(0.15);
});
<Trail target={ballRef} length={24} width={0.2} color="#fde68a" />
```

## Quality tiers: `core/quality.ts`

`useQuality()` → `{ tier, particles, decor, water, maxDpr }`. The tier comes from drei `PerformanceMonitor` declines (counted by ShellStage, never forgotten during a visit) and the pointer: `high` = desktop, no declines (particles 1, decor 1, water "full"); `mid` = a coarse pointer or 1 decline (0.7, 0.8, "reduced"); `low` = 2+ declines (0.4, 0.5, "flat"). Pure: `tierFor({ declines, coarsePointer })`, `qualityFor`, `scaledCount(count, factor)`. ShellStage's resolution is unchanged (1.75, 1 after a slow period); `maxDpr` (1.75 / 1.5 / 1) is the plan's cap and informational for now. Outside the canvas (a DOM Hud) it reads `high`. Cosmetic counts only, never in `rules.ts`.

```tsx
import { scaledCount, useQuality } from "../../core/quality";
const { decor, tier } = useQuality();
const rocks = ROCK_SPOTS.slice(0, scaledCount(ROCK_SPOTS.length, decor));
<InstancedModel asset={ASSETS.rock} spots={rocks} />
{tier !== "low" && <SnowFall count={600} />}
```

## Perf probe: `core/perfProbe.tsx` (`?perf=1`)

Open a game with `?perf=1` (e.g. `/3d/robot-collector?perf=1`): ShellStage mounts the probe (the URL is read once; never otherwise). `window.__arcadePerf` = `{ calls, maxCalls, triangles, geometries, textures, programs, frames, samples, p50, p95, max }`: calls / triangles of the last rendered frame (read at the start of the next frame, before anything draws, so always a whole frame), `maxCalls` since the stage mounted, live GPU objects, and the frame times (ms) of the last 600 unpaused frames (`perfStats.ts` ring buffer, no allocation per frame, percentiles twice a second). A small read-only overlay sits top left (`pointer-events: none`). Checked on all ten games (docs/arcade-expansion/perf-baseline-p03.md): `calls` equals an independent per-animation-frame count of WebGL draw calls (robot-collector 17).

```js
// DevTools console, or a CDP script (tools/perf)
const p = window.__arcadePerf;
console.log(p.calls, p.maxCalls, p.triangles, p.geometries, p.p95);
```

## Environment: `core/env`

Small, disposable pieces, one draw call each, no per-frame allocation. `<SkyDome top bottom offset exponent>`: a gradient sphere, never fogged, following the camera. `<Starfield count seed size upperOnly>`: one seeded `THREE.Points`. `<SnowFall count area center speed size>`: falling `Points`, the drawn count scaled by `useQuality().particles`. `<Water size position color deep foam amplitude wavelength speed foamEdge opacity>`: vertex waves, a fresnel-ish colour, foam on the crests and an optional edge band (a shoreline); the waves follow `useQuality().water` (full; reduced = fewer vertices and 60 % height; flat = one quad), fog works, visual only (rules keep their own flat water height). Render them inside the Scene (SnowFall and Water use the game clock).

```tsx
import { SkyDome, SnowFall, Starfield, Water } from "../../core/env";
<SkyDome top="#1e3a8a" bottom="#fdba74" />
<Water size={[60, 60]} position={[0, -0.3, 0]} amplitude={0.2} foamEdge={0.04} />
<Starfield count={900} seed={7} />                // space
<SnowFall count={700} area={[40, 16, 40]} />      // snow
```

## Lighting presets

`environment.lighting` (`LightingPreset` in `types.ts`): `day`, `indoor`, `night`, plus `sunset` (a warm, low sun from the side, a purple ground bounce), `snow` (bright, cool, soft) and `space` (one hard white sun, almost no fill). Each is an ambient + hemisphere + one directional light, like the first three; no shadows.

```ts
environment: { background: "#1e1b4b", fog: ["#1e1b4b", 30, 90], lighting: "sunset" },
// a snow world: { background: "#e2e8f0", lighting: "snow" }; space: { background: "#020617", lighting: "space" }
```

## Touch button labels

`GameDefinition.touchLabels?: { jump?: string; action?: string }` sets the text (and accessible name) of the touch Jump / Action buttons; default "Jump" / "Action" (`touchButtonLabels` in `TouchControls.tsx`). Keep them to one short word: the button is a 72 px circle.

```ts
touchControls: ["joystick", "action", "jump"],
touchLabels: { action: "Throw", jump: "Duck" },
```

## Loop control: `core/loopControl.ts`

Looping sounds stop when a run pauses or ends, when the player mutes and when the game closes. GameShell calls `stopShellLoops()` at those moments (`loopsStopOn(prev, next)`: entering "paused" or "over"; the mute toggle; unmount). The audio module registers its stopper once (`registerLoopStopper(stopAllLoops)` at the end of `audio.ts`). Games never call these.

```ts
import { registerLoopStopper, stopShellLoops } from "./loopControl";
const unregister = registerLoopStopper(stopAllLoops);   // audio.ts, once
stopShellLoops();                                       // GameShell: pause, mute, over, unmount
```

## Safe area: the bottom inset

`useSafeArea()` also reports `insetBottom` (CSS px of `env(safe-area-inset-bottom)`, measured with a hidden fixed probe on every resize and rotation), and the `obstructions` strip covers the taller of the cookie banner and that inset (`bottomCover(banner, inset)`), so `useFittedView` keeps content clear of the home indicator on phones without a home button. It is 0 on desktop, so desktop fits are unchanged. `insetBottom` is optional in `SafeArea` (layouts built by hand in tests stay valid).

```ts
const inset = useSafeArea((area) => area.insetBottom ?? 0);   // e.g. lift a bottom marker
```

Esc / P (`pauseKeyAction` in `frameLoop.ts`) do nothing while the "Rotate your device" overlay is up: the run stays paused until the phone is turned back (before, Esc resumed it behind the overlay).

## Aim drag, keyboard aim and digit keys (`input.tsx`)

`GameDefinition.input = { drag: true }` opts a game in to the aim drag ("pull back to shoot"). Then a canvas drag fills `useInput().current.drag` (`AimDrag`): `active` while held (from the press), `start` / `current` (pointer coordinates, -1..1, y up), `power` = drag length / `AIM_DRAG_FULL_PX` (160 px) clamped to 1, `angle` = the screen angle (rad, y up, 0 = right) of start - current, and on the frame after the release `released` (one frame, with the final values) and `cancelled` (the release ended under `AIM_DRAG_MIN_PX`, 16 px, from the start, or the pointer was cancelled: no shot). In such a game a drag is **never** a swipe (no `swipe`, no `pressed` from the pointer); `tapDown` still starts every gesture and a press without travel is still a `tap`. In drag mode the canvas captures the pointer (`setPointerCapture`), so a mouse drag that leaves the canvas keeps reporting; `current` may then lie outside -1..1, and the release point is `current` in the released frame (power and angle are measured there). Edge cases: a short press gives a `tap` **and** a `cancelled` release on the same frame (act on one); a press during the countdown carries into play as an `active` drag (its `tapDown` is dropped by the phase change); a release while paused is dropped (the pause clears pending events), so the drag simply ends without a shot. Without the opt-in nothing changes: `drag` stays idle, no pointer is captured, and swipes and taps behave exactly as before. `digit` is 1–9 for one frame on a new keydown of Digit1–9 / Numpad1–9 (pile, upgrade and slot choices), else null; it is latched like every one-frame event. `drag` and `digit` are always present on the ref; they are optional in `InputState` only so inputs built by hand in older tests still type-check (`useInput()` returns `LiveInputState`, where they are required).

**Keyboard aim fallback** (every aim-drag game needs one): the arrows / WASD / joystick aim and Space (or the touch Jump) fires. `stepKeyboardAim(aim, input.current, dt, { turnRate, powerRate, minAngle, maxAngle, minPower })` turns `aim.angle` with `moveX` (right = clockwise) and sets `aim.power` with `moveY` (up = more); fire on `jumpPressed` exactly as on `drag.released`.

```ts
// definition: input: { drag: true }, touchControls: ["tap"]
const aim = useRef({ angle: Math.PI / 2, power: 0.5 });
useRunFrame((_, dt) => {
   const { drag, jumpPressed, digit } = input.current;
   if (drag.active) { aim.current.angle = drag.angle; aim.current.power = drag.power; }
   else stepKeyboardAim(aim.current, input.current, dt);
   if ((drag.released && !drag.cancelled) || jumpPressed) shoot(run, aim.current.angle, aim.current.power);
   if (digit) pickPile(run, digit - 1);
});
```

## Trajectory preview: `render/TrajectoryDots`

`<TrajectoryDots projectile params count step groundY fraction radius endScale color opacity endOpacity visible>`: dots along `ballistics.trajectoryPoints` (one `InstancedMesh`, one draw call, no allocation per frame). `projectile` (`{ x, y, z, vx, vy, vz }`) and `params` are read every frame, so mutate them in place; `null` or `visible={false}` hides the dots. The arc stops on `groundY` (the last dot on the ground) or after `count` dots; the dots fade from `opacity` to `endOpacity` and shrink to `endScale` over the dots `fraction` allows (`shownDots(count, fraction)`), so a partial preview fades out fully. `fraction` (0..1) shows only the start of the arc (a hint, not the landing spot). Pure helpers: `dotOpacity`, `shownDots`.

```tsx
const shot = useMemo(() => ({ x: 0, y: 1, z: 0, vx: 0, vy: 0, vz: 0 }), []);
useRunFrame(() => aimShot(shot, aim.current));                  // writes shot.vx / vy / vz
<TrajectoryDots projectile={shot} params={BALLISTICS} fraction={0.5} visible={aiming} />
```

## Material looks and tints (`materials.ts`)

`ModelAsset.material` draws a GLB with another look: `"stone" | "bronze" | "gold" | "bone"` (`MATERIAL_PRESETS`) or `{ color, roughness?, metalness?, emissive? }`. Every mesh gets ONE shared `MeshStandardMaterial` per look (no textures, so a statue reads as one material), in `<Model>`, `<InstancedModel>`, `<DynamicInstancedModel>` and `<HumanoidModel>`. `<Model tint>` / `<HumanoidModel tint>` multiply the GLB's colours: one cached clone per GLB material and tint (textures shared); a tint on an override multiplies its colour. Per-copy tint in a moving pool: `update(i, matrix, color)` gets `color` white on every call; set it (`color.copy(PREBUILT)`, no allocation) and that copy's colours (GLB parts or stand-in pieces) are multiplied through `instanceColor`; a pool whose update never sets it writes no colours, so existing two-argument callers are unchanged. Pass `tinted` on a pool that tints (`<DynamicInstancedModel tinted>` / `<DynamicInstanced tinted>`): its instance colours are allocated white at mount, so the first tint does not recompile the shader mid-run. **Cache and disposal:** every look lives in one page-wide `MATERIAL_CACHE`, counted by the mounted models that use it; when the last one unmounts, the look is disposed after the commit (a microtask), so a Retry that remounts the scene keeps it. Keys are pure (`overrideKey`, `tintKey`). A metal preset is part-rough because the arcade's lights have no environment map. The fallback primitive is never tinted.

```tsx
export const GOLD_ROBOT: ModelAsset = { ...SHARED_ASSETS.robot, id: "robotGold", material: "gold" };
<Model asset={STATUE} position={[0, PEDESTAL_TOP(1), 0]} />          // an asset with material: "stone"
<HumanoidModel asset={KNIGHT} pose={pose} tint="#fca5a5" />
<DynamicInstancedModel asset={ASSETS.suitcase} count={40}
   update={(i, m, color) => { const b = run.bags[i]; if (!b.on) return false; m.makeTranslation(b.x, 0, b.z); color.copy(FLIGHT[b.flight]); }} />
```

## Attachments: `<HumanoidModel attach>` (`rig/attachments.ts`)

`attach={{ head, chest, handL, handR }}` mounts elements on anchors measured once per character from its mesh and landmarks: `head` = the top of the head (head bone), `chest` = the back halfway between the chest joint and the shoulders, at the back surface (chest bone), `handL` / `handR` = the centre of each hand (lower-arm bone; the hand rides the forearm). The children are in the HumanoidModel group's units (the asset's scale is undone on the anchor; keep a character's scale uniform) and in the bone's T-pose frame: +y up, +z forward as it stands in the T-pose; for a hand the arm runs along +x (handL) / -x (handR) to the fingertips. They follow the bones through the scene graph (no per-frame work, no allocation) and are drawn on the rigged GLB only, never on the fallback. Checked on the real runner (`attachments.test.ts`): a hat, a tool in each hand and a pack on the back stay within 1 cm of the mesh through walk, run, carry, cheer and reach. Pure: `measureAnchors(cloud, landmarks)`, `anchorOffset`; three: `createAnchorGroup(rig, name, scale)`.

```tsx
<HumanoidModel asset={EXPLORER} pose={pose}
   attach={{ head: <ExplorerHat />, chest: <VacuumPack />, handR: <Wrench /> }} />
// ExplorerHat: origin on the crown, brim in xz. A tool for handR: its handle across the palm, along -x.
```

## Kit: `core/kit`

Procedural props shared by several games (06 §F.3). Small, disposable, few draw calls each.

- `<Conveyor path width speed tile lift color stripe frame>`: a belt strip along a `Path` with a scrolling chevron texture; it moves `speed` m per second of **play time**, exactly like riders `advance`d by `speed * dt` in `useRunFrame` (still during countdown, pause and result). 2 draw calls.
- `<Fence path spacing height rails postSize railSize color railColor>`: posts every `spacing` m (both ends; a closed path closes the ring) and straight rails between them, instanced: 2 draw calls for any length (`fenceSpots`, pure).
- `<Flashlight ref halfAngle range height color opacity light intensity>`: the group stands on the guard's feet with `rotation.y = yaw`; the lit floor sector and the additive beam are exactly `ai/vision` `inViewCone(origin, yaw, halfAngle, range, p)` (`fanPoints`, tested). `light` adds a SpotLight, decided once at mount and skipped on the "low" tier. Mounting or unmounting a Flashlight with a light mid-run changes the scene's spot-light count, which recompiles every lit material (a hitch): mount all flashlights with the scene and keep them (hide one with `visible={false}` on its parent only if you accept the same recompile, or pass `light={false}`).
- `<Pedestal width height color trim>`: one merged mesh; the exhibit stands at `PEDESTAL_TOP(height)`.
- `<Gem size color spin bob glow phase>`: a flat-shaded icosahedron with an emissive glow and bright edges (edges skipped on "low"), spinning on the game clock.
- `<Parcel size color tape label>`: a cardboard box with a tape band and a label; parcels of one look share one canvas texture and material (counted, disposed with the last one). Origin = bottom centre.

```tsx
import { Conveyor, Fence, Flashlight, Gem, Parcel, Pedestal, PEDESTAL_TOP } from "../../core/kit";
<Conveyor path={BELT} width={1.2} speed={run.beltSpeed} />
<Fence path={PEN} spacing={1.6} height={1.1} />
<Flashlight ref={torch} halfAngle={GUARD_FOV / 2} range={GUARD_RANGE} />   // rules: inViewCone(..., GUARD_FOV / 2, GUARD_RANGE, ...)
<Pedestal position={[2, 0, 0]} /> <Gem position={[2, PEDESTAL_TOP(1) + 0.4, 0]} />
<Parcel position={[0, 0, 3]} size={[0.5, 0.35, 0.4]} />
```

## HUD: target markers and the timing ring (`core/hud`)

`<TargetMarkers targets color size margin>` (inside the Scene): DOM arrows at the edge of the screen pointing to world targets that are off screen, behind the camera, or under the HUD, kept inside the safe area (`useSafeArea`: below the top HUD band, above the touch controls, the cookie banner and the home indicator). It projects with the scene's camera every frame and moves plain DOM nodes (no React render per frame); `targets` (`{ x, y, z, hidden?, color? }`) are read every frame; keep the array's length fixed. Arrows show only while playing or paused. Pure and tested: `markerBounds(area, margin)`, `placeMarker(ndcX, ndcY, behind, width, height, bounds, out)` (`hud/markerPlacement.ts`).

`<TimingRing source value zones size perfectShare label …>` (plain DOM SVG, for `definition.Hud`): a needle over target arcs. `source()` is polled on every animation frame and only the needle's transform changes. Positions are fractions of a turn clockwise from the top. The game grades with the same pure math (`hud/timingMath.ts`: `needlePosition(t, period, "loop" | "pingpong")`, `judgeTiming(pos, zones, perfectShare)` → `"perfect" | "good" | "miss"`, `inZone`, `zoneProgress`, `arcPath`), so drawing and grading agree.

```tsx
<TargetMarkers targets={run.drops} color="#fbbf24" />                       // in the Scene
const ZONES = [{ start: 0.62, end: 0.74 }];
useRunFrame(() => { needle.current = needlePosition(time.play, 1.6); if (input.current.jumpPressed) grade(judgeTiming(needle.current, ZONES)); });
<TimingRing source={() => needle.current} zones={ZONES} label="SPACE" />     // in definition.Hud
```

### Adoption (P-05)

Nothing here changes an existing game: the aim drag is opt-in per definition, `digit` is new, `update`'s third argument and `tint` / `material` / `attach` are optional, and the kit and HUD pieces mount only where a game renders them. The new games adopt them as they land: aim-drag games (pirate-cannons, mini-golf, castle-defender, snowball-battle) set `input: { drag: true }` + `stepKeyboardAim` + `<TrajectoryDots>`; museum-guard uses `material` statues, `<Pedestal>` and `<Flashlight>` with its `inViewCone` rules; luggage-rush and robot-factory `<Conveyor>` + per-copy tint; zoo-escape, construction-worker and knight-arena `<Fence>`; treasure-island, construction-worker, snowball-battle, knight-arena and space-repair dress the runner with `attach`; delivery-drone `<Parcel>` + `<TargetMarkers>`; space-repair `<TimingRing>`; treasure-island `<Gem>`. Pile, upgrade and slot choices read `digit` (with a tap for touch).
