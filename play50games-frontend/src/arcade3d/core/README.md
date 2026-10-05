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
| visuals | 0 | every plain `useFrame` (R3F default), then R3F renders |

- **Game logic goes in `useRunFrame((state, dt, time) => …)`.** It runs only while `"playing"`. `dt` (s, at most 1/20, always > 0) is exactly the play time the run clock counted in this frame. This includes the rest of the frame in which the countdown ends. The game never moves for time that `elapsedMs` does not include, so scoring proofs need no allowance for untimed frames. `time` is the run's play time in seconds.
- **Visuals animate with `useGameTime()`**: `now` (s since this run's Scene mounted; it advances in every phase except `"paused"`, at most 0.1 s per frame), `delta` (this frame's step, 0 while paused) and `play` (play seconds). **Never use `state.clock.elapsedTime`.** GameShell pauses by switching the R3F frameloop, and R3F resets that clock on every switch.
- **Order does not depend on mount order:** `useRunFrame` runs before `CameraRig` and every plain `useFrame`, so a visual always draws this frame's state with this frame's camera (billboards, screen projections and raycasts included).
- `useRunFrame(cb, { priority })` can change its place. The priority must lie in `(FRAME_PRIORITY.gameTime, 0]`, that is `(-0.75, 0]`. At -0.75 or below, the callback would read the previous frame's game time. A positive priority turns off R3F's automatic rendering. Above -0.25 it runs after the camera has moved. An out-of-range priority throws in development (`runFramePriority`).
- Pure versions for tests: `advanceRunClock(store, delta)` + `playedFrameDt(state)` drive `createArcadeStore()` exactly like the canvas does (`robot-collector/rules.test.ts`).

## Helpers

| Need | Use | File |
|---|---|---|
| Game loop, input | `useRunFrame`, `useInput` | `useRunFrame.ts`, `input.tsx` |
| Pause-safe animation time | `useGameTime` | `gameTime.tsx` |
| Screen-relative movement | `inputToWorld(moveX, moveY, cameraYaw, out?)` (up = away from the camera). Pure, so `rules.ts` may use it | `math.ts` (also re-exported by `view.ts` and `input.tsx`) |
| Camera that fits the arena | `useFittedView({ area, pitch, yaws?, focus?, margin?, padding?, shift?, fov?, avoid? })` → `{ yaw, distance, offset, shift }`; pure `fitView` | `useFittedView.ts`, `view.ts` |
| Follow camera | `<CameraRig follow={ref or {x,y,z}} followFraction bounds damping offset shift>`: snaps on mount and eases into later changes | `CameraRig.tsx` |
| Fit range of a follow camera | `followFocus({ lookAt, reach, fraction, bounds })` → `focus` points, from the same math as `CameraRig` (`followAim`) | `view.ts` |
| Where UI covers the canvas | `useSafeArea()` → `{ width, height, hud[], controls[], obstructions[] }` (px rects, live) | `safeArea.tsx` |
| Models | `<Model asset fallback={<MyPrimitive/>}>` (an element, not a component), `useModel`, `useModelFailed` (no clone), `SHARED_ASSETS` | `assets.tsx`, `sharedAssets.ts` |
| Repeated props | `<InstancedModel asset spots fallback={<Instanced spots>…</Instanced>}>`: one draw call per mesh for all copies, primitive or GLB | `assets.tsx`, `render/` |
| Which GLBs exist | `MODEL_MANIFEST` / `hasModel(url)`: unlisted urls are never fetched | `modelManifest.ts` |
| Static instancing by hand | `<Instanced spots>`, `useInstanceMatrices(meshRef, spots)`, `spotMatrix` | `render/` |
| Shadows | `<BlobShadow radius>` (no shadow maps) | `render/` |
| Drawn textures | `useCanvasTexture(w, h, draw)` | `render/` |
| Collision | `circlesOverlapXZ`, `resolveSphereAabb`, `clampToBounds`, `distanceToBoxXZ`, … | `collision.ts` |
| Seeded rules | `createRng(seed)`, `randomSeed()` (Scene only), `turnTowards` | `math.ts` |
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
- The yaw is picked from `yaws` once per canvas size. The banner opening or closing and HUD panels change only the distance and the shift, so the camera never turns 90° in the middle of a run, and `inputToWorld(…, view.yaw)` keeps its meaning.
- A follow camera: build `focus` with `followFocus` from the same `lookAt`, `followFraction` and `bounds` you give `CameraRig`.
- The fov is the canvas camera's (`definition.camera.fov`). If the Scene's `CameraRig` sets another fov, pass the same `fov` to `useFittedView`.

## Models and the manifest

`modelManifest.ts` lists every GLB under `public/models/3d`. `modelManifest.test.ts` fails when the list and the folder differ. A url that is not listed goes straight to its fallback: there is no request and no suspense. So a game written before its models exist makes no `.glb` requests. Claude's assets PRs commit the GLB and its manifest line together. Repeated props use `<InstancedModel>`, so a GLB drop keeps them instanced and needs no scene change.
