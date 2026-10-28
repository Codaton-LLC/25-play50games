# Camera views (`core/camera`)

The player picks how the game is seen: the game's classic fitted camera, a chase camera, a front
camera, a high top view, or the free orbit camera from Menu 2 (drag, two fingers, pinch). A visible
📷 button and the C key cycle the views. Adoption is opt-in per game; a game that does not adopt it
is exactly as before.

| File | What |
|---|---|
| `orbit.ts` | free orbit state (ported from `menu2/camera`): yaw, pitch (-5°..80°), zoom, smoothing, recenter, auto-follow |
| `orbitCollision.ts` | sphere cast against boxes: the camera pulls in front of a wall (ported) |
| `orbitGestures.ts` | input router: mouse drag, one / two fingers, pinch, wheel, turn keys (ported; keys are an option) |
| `cameraPrefs.ts` | stored prefs (`play50games_3d_camera`: hint seen, free-view auto-follow, last view per game) behind a never-throwing adapter, and the live signals (📷 presses, the current view for the button) |
| `views.ts` | pure: view ids, framing per subject, cycle order, follow rules per steering, pose blending |
| `CameraViews.tsx` | `useCameraViews(...)` inside the Scene: writes the camera in the non-default views, returns `yaw()` for the rules |
| `CameraViewButton.tsx` | the 📷 button, the view's name after a switch and the one-time hint, in the game's Hud |
| `orbit.test.ts`, `views.test.ts` | state, follow stability, blending, keys vs. core keys, prefs |

Core never imports `menu2/`. Menu 2 can later import these files instead of its own copies; note the
one difference: core's turn keys are Q/Z left and X right, because C cycles the views here (Menu 2's
first version also turned right with C). A game can pass its own `orbitKeys`.

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Next view (default → chase → front → top → free → default) | **C** (or **T**), or click 📷 | tap 📷 (right side, above Jump / Action) |
| Look around (switches to the free view from wherever the camera is) | drag on the canvas, left or right button | one finger on empty canvas, or two fingers |
| Tilt | drag up / down; **R** up, **F** down | drag up / down |
| Turn | drag; **Q / Z** left, **X** right | drag sideways |
| Zoom (any view but default) | mouse wheel | pinch |
| Recenter the free view behind the hero | **V** | (cycle to the next view) |
| Move | WASD / arrows, unchanged | joystick, unchanged |

- The 📷 tooltip names the key: "Change view (C): Chase view, next Front view".
- None of C, T, Q, Z, X, R, F, V is a core game key (WASD, arrows, Space, E, Enter, digits) or a shell
  key (Esc, P): `orbit.test.ts` checks it. A game that uses one of them passes `keys` (cycle) or
  `orbitKeys` (turn) to `useCameraViews`.
- Input counts only while a run can be seen moving: `countdown`, `playing` and the result delay. The
  start card, the pause menu and the result screen ignore it.
- The joystick and buttons carry `data-arcade-controls`: a finger on them never turns the camera. The
  📷 button is a touch control and a safe-area panel, so fitted views keep clear of it.
- First run ever: the hint "📷 / C: change view; drag to look around" (touch: "📷: change view; drag to
  look around") shows once for up to 7 s, then never again (stored by `cameraPrefs`, never by a game).
- The last view is remembered per game (`cameraPrefs` `views[slug]`), and a Retry or a new visit starts
  in it.

## Views

| View | Camera | Movement yaw passed to the rules |
|---|---|---|
| `default` | the game's own CameraRig, untouched | exactly `defaultYaw` (the fitted yaw), as before |
| `chase` | behind. `steering: "vehicle"`: locked behind the heading. `"camera"`: drifts behind the travel (never swings round when the hero turns towards the camera) | the drawn camera's yaw |
| `front` | in front, looking back. Vehicle: locked to the heading. Camera-steered: set when chosen, then holds its yaw (it follows the hero, it does not turn) | the drawn camera's yaw |
| `top` | high (76°), at the default view's yaw | the default yaw: screen-relative input as before |
| `free` | the Menu 2 orbit; auto-follow after 2.5 s idle (player pref) | the drawn camera's yaw |

- Switches blend in 0.65 s round the hero (yaw the short way, pitch, distance, look point, lens shift),
  so chase → front swings past the hero's side, never through it.
- Camera collision: with `solids`, the chase, front and free views pull the camera in front of the
  first box between the hero and the camera (in at once, out slowly). `VIEW_COLLISION`: a box the ray
  meets within 1 m of the pivot is beside the hero (a wall it leans on, a parked van) and does not
  count, and the camera stays at least 2.2 m out, so it never ends up inside the hero's head. The top
  view looks down past every wall and ignores the solids.
- The cookie banner: non-default views lift the picture above it with the same lens shift as the
  Menu 2 orbit. The default view keeps the game's own fitted shift.

### Why the yaw comes in the input (fairness)

The rules already take `yaw` in their per-frame input and turn the stick with core
`inputToWorld(moveX, moveY, yaw)`. The Scene now passes `cam.yaw()` instead of `view.yaw`. In the
default view that is the same number, so nothing changes. In the other views "up" is "away from the
camera on screen". Turning the stick keeps its length, so speed and score limits hold for any yaw. Bots
and proofs pass their own yaw (0 or the fitted one) and are unchanged. Views never change rules,
timing or scoring, and the leaderboard is unaffected. Vehicle steering (`steering: "vehicle"`, e.g.
the scooter's left / right = turn) ignores the yaw entirely.

## How it shares the camera with the game's CameraRig

The game keeps its `<CameraRig>`. Each frame:

1. `FRAME_PRIORITY.camera - 0.005`: if the hook wrote the camera last frame, it puts back the rig's
   own pose and lens.
2. `FRAME_PRIORITY.camera`: CameraRig eases from its own last pose, as always.
3. `FRAME_PRIORITY.camera + 0.005`: the hook reads the rig's pose (the "default" pose), steps the
   current view, blends, clips against the solids and writes the camera. In the settled default view it
   writes nothing.

So the rig never eases from a pose it did not write, and a switch back to `default` lands exactly on
the rig. Poses and visuals (`pose`, `visuals`) see the drawn camera.

## Adoption guide

For a game that already passes a camera yaw in its step input (most Menu 1 3D games):

1. **Scene**: after `useFittedView` and the run are created:

   ```tsx
   import { useCameraViews } from "@/arcade3d/core/camera/CameraViews";

   const cam = useCameraViews({
      slug: "my-game",
      subject: "character",   // or "vehicle" (framing: farther, higher look point)
      steering: "camera",     // "vehicle" when left / right steer the vehicle itself
      defaultYaw: view.yaw,
      target: (o) => { o.x = h.x; o.y = 1.1; o.z = h.z; o.heading = h.yaw; o.vx = h.vx; o.vz = h.vz; },
      solids: (out) => fillBoxes(out),        // optional: AABB slots (256), return the count
      framing: { top: { distance: 13 } },     // optional per-view overrides (pitch, distance, lookUp)
      views: ["default", "chase", "top"],     // optional: fewer views
   });
   ```

   The "default" view is whatever camera the game already draws at `FRAME_PRIORITY.camera`: a
   `<CameraRig>` or a `<ChaseRig>` (core `chaseCamera.ts`, mars-rover-mission). A game whose own
   camera is already a chase camera can drop `"chase"` from `views`.
   `target.y` is the pivot height (the chest, about 1.1 m for a person). `heading` follows the
   convention forward = (sin, cos), the one `Math.atan2(vx, vz)` gives.
2. **Rules input**: pass `yaw: cam.yaw()` where the Scene passed `view.yaw` (or call
   `inputToWorld(moveX, moveY, cam.yaw(), dir)`). Leave `rules.ts`, bots and proofs alone. A game that
   maps the stick in screen space without a yaw (a fixed top-down game) keeps `view.yaw`, or offers only
   `["default", "top"]`.
3. **Hud**: render `<CameraViewButton />` (from `@/arcade3d/core/camera/CameraViewButton`). Simplest:
   rename the game's Hud to `GameHud` and export `() => <><CameraViewButton /><GameHud /></>`. If the
   game's HUD sits in the bottom-right corner, pass `style={{ bottom: "..." }}` to move the button.
4. **Keys**: check the game's own keys. If it uses C or T, pass `keys={["KeyV"]}`-style alternatives
   (and `orbitKeys` if it uses Q, Z, X, R, F or V).
5. **Things tuned to the default camera**: labels leaned back by the fitted pitch, fog distances fitted
   to `view.distance`, culling by the fitted view. Check them in each view (fog: override `top`'s
   distance so it stays out of the murk).
6. **Check**: tsc, the game's tests and proofs (they do not change), a headless playtest of every view at
   1280 × 800 and 390 × 844 with the cookie banner open, a two-finger rotate (CDP `Input.dispatchTouchEvent`),
   0 console errors.

Adopted: train-station-rush, postman-3d, hotel-bellboy-rush, pizza-kitchen-3d (character, camera
steering), submarine-treasure-dive (vehicle framing, camera steering), burger-delivery-scooter (vehicle,
vehicle steering); batch 1 (2026-10-28): taxi-rush-3d, farm-tractor-challenge, mars-rover-mission,
magic-carpet-ride (vehicles, vehicle steering), cat-vs-robot-vacuum, dog-park-fetch (characters, camera
steering), wizard-potion-lab, haunted-mansion-keys; batch 2 (2026-10-28): firefighter-rescue, beach-lifeguard (characters, camera steering), aquarium-cleaner, bee-garden, toy-store-night-shift (characters, camera steering).

## Cost

Two small frame callbacks, no allocation per frame, no extra draw calls; with solids one slab test per
box per frame.
