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
| `tap` | a short press (at most `TAP_MAX_PX`, `TAP_MAX_MS`) without travel, at the press position |

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

## Helpers

| Need | Use | File |
|---|---|---|
| Game loop, input | `useRunFrame`, `useInput` (events: "Input events" above) | `useRunFrame.ts`, `input.tsx` |
| Discrete moves | `input.current.pressed.left` etc. (keydown edges + swipes, never lost; swipes included, so do not also move on `swipe`) | `inputController.ts` |
| Crash / win animation before the result | `GameDefinition.resultDelayMs` (default 800) | `types.ts`, `GameShell.tsx` |
| Pause-safe animation time | `useGameTime` | `gameTime.tsx` |
| Screen-relative movement | `inputToWorld(moveX, moveY, cameraYaw, out?)` (up = away from the camera). Pure, so `rules.ts` may use it | `math.ts` (also re-exported by `view.ts` and `input.tsx`) |
| Camera that fits the arena | `useFittedView({ area, pitch, yaws?, focus?, margin?, padding?, shift?, fov?, avoid? })` → `{ yaw, distance, offset, shift }`; pure `fitView` | `useFittedView.ts`, `view.ts` |
| Follow camera | `<CameraRig follow={ref or {x,y,z}} followFraction bounds damping offset shift>`: snaps on mount and eases into later changes | `CameraRig.tsx` |
| Fit range of a follow camera | `followFocus({ lookAt, reach, fraction, bounds })` → `focus` points, from the same math as `CameraRig` (`followAim`) | `view.ts` |
| Where UI covers the canvas | `useSafeArea()` → `{ width, height, hud[], controls[], obstructions[] }` (px rects, live); `useSafeArea(selector, isEqual?)` re-renders only when the selection changes (`sameScreenRects` for rect lists) | `safeArea.tsx` |
| Models | `<Model asset fallback={<MyPrimitive/>}>` (an element, not a component), `useModel`, `useModelFailed` (no clone), `SHARED_ASSETS` | `assets.tsx`, `sharedAssets.ts` |
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
- The yaw is picked from `yaws` once per canvas size. The banner opening or closing and HUD panels change only the distance and the shift, so the camera never turns 90° in the middle of a run, and `inputToWorld(…, view.yaw)` keeps its meaning.
- A follow camera: build `focus` with `followFocus` from the same `lookAt`, `followFraction` and `bounds` you give `CameraRig`.
- The fov is the canvas camera's (`definition.camera.fov`). If the Scene's `CameraRig` sets another fov, pass the same `fov` to `useFittedView`.

- `useSafeArea(selector, isEqual?)`: a Scene that needs one number (a top inset, a control's top) re-renders only when that number changes, not every time a HUD chip grows with the score. A selector that builds an object needs an `isEqual` (`sameScreenRects` for rect lists, `shallow` from `"zustand/shallow"` for plain objects).

## Models and the manifest

`modelManifest.ts` lists every GLB under `public/models/3d`. `modelManifest.test.ts` fails when the list and the folder differ. A url that is not listed goes straight to its fallback: there is no request and no suspense. So a game written before its models exist makes no `.glb` requests. Claude's assets PRs commit the GLB and its manifest line together. Repeated props use `<InstancedModel>`, so a GLB drop keeps them instanced and needs no scene change.

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
