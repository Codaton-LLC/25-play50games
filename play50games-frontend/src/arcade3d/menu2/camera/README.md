# Menu 2 free orbit camera (`menu2/camera`)

The player turns the camera round the hero with the mouse, the keys or two fingers, and sees the hero
from behind, the front, the sides or from above. Movement is camera-relative, so turning the camera
never makes the controls feel wrong. Sky Tower Jump is the reference adoption (solo `Scene.tsx`,
`MultiScene.tsx`, `camera.ts`, `Hud.tsx`).

| File | What |
|---|---|
| `orbit.ts` | pure state: yaw (free 360°), pitch (-5°..80°), distance (zoom, clamped per game), smoothing, recenter, auto-follow |
| `orbitCollision.ts` | pure sphere cast (ray against boxes grown by the camera radius): the camera pulls in front of a platform or wall; a pivot inside a wall's margin (the hero against it) is cast against the wall itself; `collision.squeeze` lets a wall nearer than minDistance bring the camera up to it, `collision.liftTo` (`liftOrbitPitch`) raises a blocked view over the wall |
| `orbitGestures.ts` | pure input router: mouse drag, one / two fingers, pinch, wheel, camera keys; `applyOrbitInput` |
| `orbitPrefs.ts` | local prefs (`play50games_m2_camera`: hint seen, auto-follow) behind a never-throwing adapter, and the HUD → camera signals |
| `OrbitCamera.tsx` | `<OrbitCamera>` (driver + pose + collision + cookie-banner lens shift), `<OrbitDriver>` / `useOrbitDriver`, `useOrbitInput` |
| `OrbitHud.tsx` | the touch recenter button and the first-time hint |
| `orbit.test.ts` | state, camera-relative contract, collision, gestures, keys vs. every game / P2 key, prefs |

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Turn (yaw) | drag with the left **or** right mouse button on the canvas; **Q / Z** left, **C / X** right | **two fingers** dragged sideways; one finger dragged on empty canvas (not the joystick) |
| Tilt (pitch) | drag up / down; **R** tilts up (towards top-down), **F** tilts down (to just under the horizon) | two fingers (or one) dragged up / down |
| Zoom | mouse wheel | pinch |
| Recenter behind the hero | **V** | the round recenter button above Jump / Power |
| Move | WASD / arrows (up = away from the camera) | joystick, unchanged |

- E is the hero power (core `ACTION`), so turning uses Q/Z and C/X, not Q/E. None of the camera keys is a
  core game key (WASD, arrows, Space, E, Enter, digits), Esc / P (pause), or a multiplayer P2 key (arrows,
  Enter, Right-Ctrl, Right-Shift): `orbit.test.ts` checks it. They sit next to P1's WASD, so in local
  multiplayer they are P1's camera keys.
- A drag right swings the camera left round the hero (the world turns with the finger); a drag down raises
  the camera. Mouse dead zone 3 px, one-finger dead zone 10 px, so clicks and taps stay clicks and taps.
- The joystick and the Jump / Power buttons are their own elements: the orbit only listens on the canvas
  and skips anything inside `[data-arcade-controls]`, so a finger on the joystick is never stolen. With a
  thumb on the joystick, a second finger on the canvas turns the camera.
- Pointer capture on the canvas (a drag that leaves it keeps turning); the canvas wrapper is
  `touch-action: none` and the wheel calls `preventDefault`, so the page never scrolls; the right-button
  context menu is off on the canvas.
- Input counts only while the run can be turned: `countdown`, `playing`, and `over` (the result delay).
  The start card, the intro (a tap there skips it) and the pause menu ignore it, and nothing piles up.

## State (`orbit.ts`)

```ts
const orbit = createOrbit({ yaw: 0, pitch: 22 * DEG, distance: 7.2, minDistance: 4, maxDistance: 15 });
orbitRotate(orbit, dYaw, dPitch);   // manual: cancels a recenter, restarts the auto-follow delay
orbitZoom(orbit, 1.2);               // x distance, clamped
orbitRecenter(orbit, yawBehind(vx, vz)); // swing behind the travel (start pitch, zoom kept)
stepOrbit(orbit, dt, vx, vz);        // auto-follow + smoothing; orbit.viewYaw is what the camera draws
```

- Target (`yaw`, `pitch`, `distance`) is what input sets; the view (`viewYaw`, `viewPitch`, `viewDistance`)
  eases to it (`damping` 12/s, `recenterDamping` 6/s), the short way round across ±180°.
- **Auto-follow** (setting `autoFollow`, default ON; the player pref `orbitPrefs().autoFollow` can turn it
  off): after `autoFollowDelay` (2.5 s) without manual input, the yaw swings gently (`autoFollowRate`
  1.1/s at full speed, scaled from 1.5 to 5 m/s) behind the hero's travel. It never swings round when the
  hero runs towards the camera (only errors under 110°). Manual input always wins: any turn, zoom or held
  drag resets the delay at once.
- Yaw is the core's fitView camera yaw: the camera sits at pivot + (sin yaw, ·, cos yaw); yaw 0 looks
  along -z. `inputToWorld(moveX, moveY, orbit.viewYaw)` is the matching camera-relative stick.

## Adoption guide (a Menu 2 game)

1. **Rules: the yaw is input.** Add `yaw?: number` to the game's step input and turn the stick inside the
   rules with core `inputToWorld(moveX, moveZ, yaw)` (see Sky Tower Jump `rules.ts` `StepInput.yaw`). The
   Scene writes `input.yaw = orbit.viewYaw` each frame; bots and tests leave it 0, so every bot and proof
   result stays exactly as before (Sky Tower Jump `orbit.test.ts` proves it on all five levels). Turning
   keeps the stick's length, so speed-based limit proofs hold for any yaw. Never read the yaw from React
   state or the camera inside the rules.
2. **Scene:** one orbit per run, `useMemo(() => createOrbit(MY_ORBIT), [run])`, then

   ```tsx
   <OrbitCamera
      orbit={orbit}
      pivot={(out) => { if (falling) return false; out.x = h.x; out.y = h.y + 1.1; out.z = h.z; }}  // + lead
      travel={(out) => { out.x = h.vx; out.z = h.vz; }}   // auto-follow; omit = none
      solids={(boxes) => fillNearbyBoxes(boxes)}         // AABB[] (256 slots), return the count; omit = no collision
      lookUp={0.9} distanceScale={portrait ? 1.45 : 1} bounds={MAP_BOUNDS}
   />
   ```

   It replaces the game's follow camera (`CameraRig` or a hand-made one). `pivot` is the followFocus-style
   point: the hero plus any lead towards where it is going, clamped by `bounds`; return `false` to hold
   (a fall out of view). `bottomCover` (default on) keeps the cookie-banner lens shift the old follow
   cameras had. `input={{ oneFinger: false }}` for a game that reads canvas swipes or taps as moves (then
   only two fingers turn on touch); `input={false}` for no orbit input at all.
3. **Intro:** make the game's `playCamera` the orbit's first pose
   (`orbitPosition(pivot, settings.yaw, settings.pitch, settings.distance x distanceScale)`, looking at
   pivot + lookUp): the intro then ends exactly where the orbit starts (Sky Tower Jump `camera.ts`).
   The core intro writes the camera after the orbit while it runs, so nothing else is needed.
4. **Juice:** nothing to do. The orbit writes at `FRAME_PRIORITY.camera` from its own state; the juice
   kick / shake (`menu2/juice`) and core FxLayer's shake are added after it and taken off before it.
5. **HUD:** render `<OrbitHud />` (from `menu2/camera/OrbitHud`) in the game's Hud: the touch recenter
   button and the first-time hint ("Drag to look around" / "Two fingers to rotate", shown once, stored by
   `orbitPrefs`, never by the game).
6. **Multiplayer (one shared camera):** create one orbit per race, render `<OrbitDriver orbit={orbit}
   travel={groupVelocity} />` and pass `orbit` (and `solids`) to `SharedCamera`: it turns round the group's
   centre with the orbit's yaw / pitch, at the fitted group distance times the orbit's zoom. Every
   player's step input gets `yaw = orbit.viewYaw`. Mouse, two fingers or P1's camera keys turn it.
7. Tests: the bot-unchanged test at yaw 0, a turned-stick test, and the playCamera = first-pose test
   (copy Sky Tower Jump `orbit.test.ts`).

## Settings

There is no settings page in the shell yet, so the auto-follow toggle has no UI: `setOrbitAutoFollow(false)`
stores the player's choice (`play50games_m2_camera`) and the camera honours it on the next frame. A
game can also switch it off for itself with `createOrbit({ autoFollow: false })`.

## Cost

One slab test per solid box per frame (Sky Tower Jump passes the platforms within 22 m of the camera, a few
dozen), no allocation per frame, no extra draw calls.
