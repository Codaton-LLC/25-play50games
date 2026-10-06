# Penalty Hero

Owner: Cursor. Slug: `penalty-hero`. Accent `#f472b6`. Status stays `"soon"` until the game is reviewed and its models exist. **The game is playable** on primitives (striker, keeper, ball, goal, stadium); the striker and keeper GLBs drop in through `assets.ts`.

| File | What it owns |
|---|---|
| `meta.ts` | Card data, portrait orientation, thumbnail `/images/3d/penalty-hero.webp` and scoring limits. Plain data, server-safe; numeric limits match `arcade-games.json`. |
| `index.tsx` | `GameDefinition`: Scene, Hud, assets, camera (0, 4, 20) → (0, 1.22, 0), fov 40, `touchControls: ["tap"]`, one shell stat `shots` / 10, `finalScore` through `rules.finalScore`. No run timer or lives. |
| `rules.ts` | Pure seeded `createRun(seed)` and `step(state, dtMs, input)`: aim, accuracy, keeper draw, phases, outcomes and scoring, plus `zoneAt(x, y)` for goal-plane points and `aimPresses` (core `pressed` without swipes). No three.js/React/DOM/random source. |
| `rules.test.ts` | Vitest, including idle scoring, the duration/rate proof, shot targets, the limit cap, the zone mapping, keyboard presses and swipes through the core input controller, and a press judged where it landed (`tapDown`) against one judged on release (`tap`). |
| `Scene.tsx` | Mount seed (`randomSeed`), Simulation (`useRunFrame` → `step`; `tapDown` → ray → plane z = 0 → `zoneAt`; `pressed` → aim), store stats and sounds, `useFittedView` + `CameraRig`, visuals from phase progress and `useGameTime`. |
| `Primitives.tsx` | Stadium (canvas-texture pitch, crowd and boards), goal frame and net lines, code ball, striker and keeper fallbacks. The boards and the lowest crowd rows behind the net are dark and low-contrast, so they do not compete with the zones. |
| `Hud.tsx` / `Hud.module.css` | Goals/streak pill (below the shell HUD row, offset by the top safe-area inset), ten shot dots (✓ / ✕ plus colour) with the hint (lifted above the home indicator and the cookie banner), the aim deadline for the last 5 s (a large amber pill, red from 2 s, popping each second), GOAL / SAVED feedback (`aria-live="polite"`). The pill and the dots panel are `data-arcade-safe-area`. |
| `assets.ts` / `assets.spec.json` | Striker and keeper `ModelAsset`s / two character generation requests. No generated ball. |

### How the build maps to this design

- Store stats written by Scene: `shots` (shell HUD), `goals`, `streak`, `goalMask` (bit i = shot i scored), `feedback` (0 none, 1 goal, 2 saved, 3 wide, 4 timeout; cleared when the next aim starts) and `aimLeft` (whole seconds, only on change). `setScore` on every goal, `end("win")` on `ended`.
- Camera: core `useFittedView` replaces the local `camera.ts` below. The fit box is the goal guard box, pitch `atan2(2.78, 20)`, `shift: true`, and `minDistance` is the README camera distance, so the camera only ever moves further back than (0, 4, 20). The striker and ball are in front of the goal box and are not part of the fit.
- Reticle: a ring over the highlighted zone at `x = centre + r / 0.6 * 1.04 m`; the white band is the `abs(r) <= 0.25` window. The ring turns green inside it.
- Keeper: rolls 65° about the hip toward side columns, lifts for the top row and drops the hip for a low dive; returns during the last 60 % of the hold. Striker: lean and lunge (+0.3 x, -0.6 z) in the run-up, a kick tilt in the first 200 ms of flight, back in the hold.
- Input (core "Input events"): a touch or a click shoots on the **press** (`input.tapDown`), never on the release. The shot samples the reticle of the last rendered frame, which is what was on screen when the finger landed, and locks on the next frame. `input.tap` would wait for the release and judge the shot 100–350 ms late, which turned well-timed taps wide. Keyboard aim reads `input.pressed` (arrow / WASD keydowns, latched by core), so a key tapped between two frames still moves the highlight, and two keys in one frame move both axes. The end delay is core's default `resultDelayMs` (800 ms).

### What a new game copies from here

- Use robot-collector on main as the structure template: this file split, server-safe metadata, a `GameDefinition`, pure seeded rules and tests proving server limits. Reuse core `useRunFrame`, `useInput`, store, `Model` and audio contracts. Never import another game's code.
- Make run state once in a lazy Scene `useState` initializer; do not call setState in the frame loop. `<Simulation />` calls `useRunFrame` → `step(state, dt, input)` → store actions/sound events. Core runs every `useRunFrame` before the camera and every plain `useFrame`, whatever the mount order. Visual callbacks only render the resulting state; they do not advance time.
- Core supplies what this design once planned locally: `useGameTime` (pause-safe animation clock), `useFittedView` + `CameraRig shift` (free-screen fit around the HUD, the game HUD's marked panels and the cookie banner), `<Model fallback>`, and `tapDown` / `pressed` input events. Use them; check `core/README.md` before copying anything.
- Do not copy warehouse props/layouts, camera yaw/follow, battery effects or scoring. Characters use `<Model asset fallback={<Primitive />}>`. Copy a generic utility only if needed and still absent from core.

## Concept

Ten penalties into a goal split into six zones. Choose a zone and strike when its wobbling reticle is centred. Accurate shots beat the keeper unless it dives into that zone; imprecise shots can go wide. Consecutive goals earn bonus **points**, displayed as `pts`; goals are a separate count.

## Controls

`meta.controls.scheme` stays `"tap-target"`; the published primary lines remain "Arrow keys to aim, Space to shoot" and "Tap a target zone".

| | Left | Centre | Right |
|---|---|---|---|
| Top | top-left | top-centre | top-right |
| Bottom | bottom-left | bottom-centre | bottom-right |

- Read `useInput().current`. In AIM, every direction press in `input.pressed` (a new arrow / WASD keydown; auto-repeat and held keys do not count) moves the highlight **one zone**. Clamp at edges, no wrapping; start bottom-centre, `up` means the top row. Both axes apply in one frame (two keys between two frames move diagonally); opposite presses in one frame cancel. A press during run-up, flight or hold is dropped, never kept for the next shot. Core latches every press, so a key tapped and released between two frames is never lost (`moveX` / `moveY`, sampled once per frame, would miss it).
- **Swipes do not aim** (a decision of this review). Core sets `pressed[direction]` for every swipe, with `swipe` on the same frame, so `aimPresses` drops the swipe's direction. On touch the zone is picked by touching it, and every swipe starts with a press that may already have shot; a swipe that also moved the highlight would act twice. A key of the same direction pressed in the very frame a swipe fires is dropped with it (a keyboard and a finger at once).
- Space (`jumpPressed`) or E/Enter (`actionPressed`) shoots the highlighted zone. Apply aim movement before the shooting edge; accept one shot per frame, never held `jump`/`action` auto-repeat.
- Touch/click: on the press, `Raycaster.setFromCamera(input.tapDown, camera)` then `ray.intersectPlane()` onto **z = 0**, using a `Plane` with normal `(0, 0, 1)`. Convert the point to a zone; never intersect keeper, ball, net or GLB meshes. Outside-zone presses, a parallel ray or no intersection do nothing, including no timeout reset. A press on a zone selects it and shoots once, judged by the reticle on screen when the finger landed (the last rendered frame); holding the finger, dragging or releasing changes nothing. `input.tap` is not read: it fires on release, up to 350 ms later.
- Zone bounds: x = -3.66..3.66, split at -1.22 and 1.22; y = 0..2.44, split at 1.22. Internal boundaries belong to the right/upper zone; include outer goal edges. A locked shot ignores further aim/shoot input through run-up, flight and feedback. At the 20 s deadline, timeout takes precedence over a new shot. Esc/P, hidden tab and blur belong to shell pause.

## Rules and skill

- Scene draws a **new random 32-bit seed on each mount**, outside `rules.ts`: its lazy initializer uses `crypto.getRandomValues(new Uint32Array(1))[0]`, then `createRun(seed)`. Retry/restart remount by `runId`. Asset seed 5155 is only the generation seed, not the gameplay seed.
- PRNG: **mulberry32**. Keeper selection uses integer weights: six weights initially 2; draw `floor(random * sum(weights))`, then select by integer cumulative sums. After a manual shot its chosen zone gains +1, including wide shots. Timeouts neither reinforce a zone nor draw a keeper choice. Seed plus the same dt/input timeline reproduces every result.
- Skill: during AIM a reticle wobbles horizontally about the selected zone centre. Normalized offset `r = 0.6 * sin(2 * PI * aimSeconds / 1.2 + phase)`; the marked centre band **`abs(r) <= 0.25`** is accurate. Draw each shot's phase from a separate mulberry32 stream seeded with `(seed ^ 0x9e3779b9) >>> 0`, so reticle draws cannot change keeper draws. Waiting for the band and firing there affects the outcome, rather than only keeper luck.
- At shot lock, record accuracy, selected zone and keeper draw once. Accurate + a different keeper zone = GOAL; matching zone = SAVED. An off-centre shot goes wide: target x = ±4.16 (outside the post, sign from r), y = selected row centre. Every miss is **SAVED**, 0 points, streak reset; custom Hud may add "Wide" as a secondary explanation.
- AIM times out after **20 s of simulation dt**. It is a forced miss, never an auto-shot of the selected/default zone: SAVED, 0 points, streak = 0. It still consumes the same 1600 ms cycle before counting as completed. A wholly idle ten-shot run scores **0**, with 0 goals and streak.
- Exactly ten shots, no early end. Commit each outcome once at flight completion, then finish feedback. After the tenth hold call **`end("win")`** once, even after ten misses; the shell's existing title is **"You did it!"**. Report final score/stats before end in that callback. GameShell owns results/submission; no game API/localStorage writes.
- Goal sound: **`playSfx("pickup")`**. Save/wide/timeout: **`playSfx("hit")`**, once at resolution. Pause/resume cannot replay events.

### Simulation timing and frame order

**Every shot timer, the 20 s aim timeout, reticle and every animation advance only by dt from the game's simulation `useRunFrame` → `rules.ts step(state, dt, input)`.** dt is seconds, core-clamped to `MAX_FRAME_DT = 0.05`; `run.time += dt` and phase timers live in that step. No `setTimeout`, `performance.now`, tween callbacks, `Date.now`, independent visual delta or stored `state.clock.elapsedTime` for gameplay/animations. R3F resets its elapsed clock on pause/resume.

| Phase after a shot or timeout locks | Minimum simulation time |
|---|---|
| Run-up / striker lean and lunge | 700 ms |
| Ball flight / keeper dive | 500 ms |
| GOAL or SAVED hold | 400 ms |
| Full cycle, including shot 10 | **1600 ms** |

`step` consumes frame time once, carrying remaining dt across phase boundaries without skipping or double-counting phases. Accept at most one shooting edge; do not reuse it in the next AIM. Finish the tenth hold before ending. dt <= 0 makes no progress. Pause stops the simulation callback, freezing all visual state.

`core/ShellStage` latches input (priority -2) and ticks RunClock (-1) before game callbacks. `useRunFrame` runs at the simulation priority (-0.5), before `CameraRig` (-0.25) and every plain `useFrame` (0), whatever the mount order (`core/README.md` "Time and frame order"). Visuals render phase progress in `useFrame` and animate with `useGameTime`, including paused resizes, without advancing the run.

## Scoring

`meta.scoring`: `kind: "points"`, `display: "int"`, **`unitLabel: "pts"`**. Every other scoring value is unchanged:

| Limit | Value |
|---|---|
| `base` | 0 |
| `maxPointsPerSec` | 150 |
| `maxScore` | 1500 |
| `minDurationMs` | 10000 |
| `maxDurationMs` | 600000 |

First goal after a miss: +100. Each consecutive goal: +150 (100 plus 50 streak bonus). Every miss: 0 and reset streak. Perfect run: `100 + 9 * 150 = 1450 pts`. No time bonus.

### Server limits and why they hold (the proof)

Server checks: integer score in [0, 1500], duration in [10000, 600000] ms and `score * 1000 <= 150 * durationMs`.

1. All ten cycles, including timeouts and the final hold, consume at least 1600 ms each of **simulation useRunFrame dt**: 16000 ms total simulation. Wall clocks, renderer elapsed time and tween completions cannot shortcut that bound.
2. RunClock and Simulation use the same clamped delta. The design allowed for one untimed countdown-to-playing frame (<=50 ms), giving a **guaranteed submitted minimum of 15950 ms**. Core now counts every played frame in `elapsedMs` (no untimed frame, `useRunFrame` dt = store `frameMs`), so the real floor is 16000 ms and 15950 stays as conservative slack. Pause advances neither. Use GameShell's default duration, `Math.round(elapsedMs)`, not the animation clock.
3. Minimum-duration margin: **5950 ms**. Perfect score 1450 is 50 below the absolute cap. Rate cap at the bound: `150 * 15.95 = 2392.5 pts`, margin **942.5 pts**. Integer inequality: `1450000 <= 2392500`, margin 942500. Break-even for 1450 is about 9666.67 ms, below the guarantee.
4. Saves, wide shots and timeouts only remove points/break streaks, so every run <=1450. Waiting adds time, not points. Ten maximum waits plus cycles consume `10 * (20000 + 1600) = 216000` ms simulation; carrying remainder across boundaries and allowing one final frame gives submitted duration <=**216050 ms**, under 600000.
5. Reduced motion changes poses only; accuracy and phase durations stay identical. Pausing cannot complete a phase; skill cannot shorten the cycle. Idle runs score 0 at roughly 216 s and pass every limit.

Planned defensive `capScore` uses `min(rawScore, 1500, floor(150 * Math.round(elapsedMs) / 1000))` at submission. Prove it is a no-op for reachable completed runs rather than hiding a broken bound with a clamp.

## Scene and camera

World units are metres, +y up, goal plane z = 0; striker faces -z:

| Piece | Dimensions / position |
|---|---|
| Goal opening | **7.32 × 2.44**, x = ±3.66, y = 0..2.44; each zone 2.44 × 1.22 |
| Frame / net | 0.06-thick frame outside opening; primitive net extends to z = -1.5 |
| Spot / ball | **11 m** from goal at (0, 0, 11); ball radius 0.11, centre (0, 0.11, 11) |
| Striker | **1.75 m** high, root (-0.65, 0, 11.8), 0.70 wide × 0.60 deep; animated fit box x = -1.1..0.35, y = 0..1.85, z = 10.8..12.1 |
| Keeper | 1.85 m high, root (0, 0, -0.15), facing +z; dives toward zone centres |
| Camera | Fixed (0, 4, 20), lookAt (0, 1.22, 0); perspective near 0.1 / far 400; aspect-dependent FOV/view offset |

Fit the whole composition: goal guard box x = ±4.06, y = -0.40..2.84, z = 0; striker box above; ball box x = ±0.11, y = 0..0.22, z = 10.89..11.11. The goal's 0.40 m margin covers frame/net and rigid dive bounds. Keep striker motion inside its declared box. No ball/keeper camera follow.

Local `camera.ts` fit as designed before core had a free-screen helper (kept for the measurements; the build uses core `useFittedView`, which avoids the same HUD, panels and banner):

1. Use CSS canvas W/H; reserve left/right 16 px plus safe insets, **top 72 px** plus top inset for one-row shell HUD, **bottom 88 px** plus bottom inset and existing `useBottomObstruction()` from `core/TouchControls`. Refit on size/inset/obstruction changes. `touchControls: ["tap"]` has no joystick/action buttons; reserve bottom space for custom Hud, controls/home area anyway.
2. Transform all box corners to camera space: u = x / -z, v = y / -z. For symmetric side padding L/R, pixel focal length `f = min((W-L-R)/(2*max(abs(uMin),abs(uMax))), (H-T-B)/(vMax-vMin))`. Vertical FOV is `2 * atan(H/(2*f))` in degrees. W makes this aspect-dependent.
3. Centre vertically in free space with `setViewOffset(W,H,0,offsetY,W,H)`, where `offsetY = H/2 - f*(vMax+vMin)/2 - (T+H-B)/2`. Update camera matrices before tap projection. For unequal side insets also centre horizontally in the free rectangle. Resizing does not advance simulation.
4. Project each target quad to CSS pixels and check its narrower edge width and full height, not its decorative marker. If an obstruction leaves inadequate space, require portrait/clear the obstruction before playing rather than accept hidden or <44 px targets.

**Measured projection sizes**, using installed Three.js `PerspectiveCamera` and `Vector3.project` with the boxes/formulas above, zero safe insets and no cookie banner. These are mathematical projection checks, **not browser gameplay measurements**:

| Viewport | Vertical FOV / offsetY | Goal bounds in CSS px | Each bottom-row zone | Each top-row zone | Result |
|---|---|---|---|---|---|
| **375 × 812** | 51.404° / 118.850 px | x = 33.32..341.68, y = 236.25..337.21 | **101.09 × 50.06 px** | **101.93 × 50.90 px** | All six >=44 × 44, below HUD/above bottom overlays |
| **812 × 375** | 40.544° / 74.710 px | x = 313.21..498.79, y = 82.16..142.92 | **60.84 × 30.13 px** | **61.34 × 30.63 px** | Fails 44 px height with full composition fitted |

Therefore **`meta.orientation = "portrait"`**. On coarse pointers, landscape uses GameShell's rotate-device overlay and cannot start/continue shooting. Core's orientation gate does not apply to fine pointers: the planned game must also pause/block shooting when its measured target fit fails, with a custom-Hud hint to resize the desktop window or clear the obstruction, then require Resume after refitting. Enlarging only the landscape goal crops striker/spot; that is not this fit. Actual overlay/browser measurements, safe insets and cookie obstruction remain implementation acceptance checks; recompute before widening orientation support.

### Rigid animation plan

No rigging or skeletal clips. Character roots have floor pivots via `assets.ts`. During the 700 ms run-up, striker leans about x and lunges toward the ball (root moves at most +0.3 x / -0.6 z), within its animated fit box, then resets in the hold. During the **500 ms ball flight**, keeper translates toward the locked zone and rolls about z toward the dive (<=65 degrees; small roll for centre). Ease from normalized simulation phase progress; return to centre during the 400 ms hold. Ball arc/spin also uses that progress, never tween completion callbacks. Reduced motion uses restrained/stable poses but keeps durations, accuracy and a visible timing cue.

## Assets and prerequisite concept art

Before generation the user creates/approves these **two ChatGPT concepts**, attaching the chosen Play50 style sheet, and passes PNGs to Claude. Regenerate cropped hands/feet, extra objects or an incorrect T-pose. No paid generation is part of this review.

**Striker → `tools/hyper3d/concepts/penalty-hero-striker.png`:**

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of a friendly football striker mascot, bright blue kit with a clearly readable number 10 on the chest, chunky blue shorts, football boots, rounded vinyl-toy body, big expressive eyes, smooth rounded shapes, saturated colours, simple clean materials, no outlines or fine texture noise. T-pose with arms straight out to the sides and legs slightly apart, full body from head to feet, single figure centered, plain light-grey background, no shadow, no ball or other props, no text except the jersey number 10, no logo, soft even studio lighting, 1024x1024.
```

**Keeper → `tools/hyper3d/concepts/penalty-hero-keeper.png`:**

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of a friendly goalkeeper mascot, bright green kit, chunky green shorts, oversized goalkeeper gloves and football boots, rounded vinyl-toy body, big expressive eyes, smooth rounded shapes, saturated colours, simple clean materials, no outlines or fine texture noise. T-pose with arms straight out to the sides and legs slightly apart, full body including both gloves and feet, single figure centered, plain light-grey background, no shadow, no ball, goal or other props, no text, no logo, soft even studio lighting, 1024x1024.
```

| Model | Source | Spec | Fallback / rendering |
|---|---|---|---|
| striker | `/models/3d/penalty-hero/striker.glb`, this game | `assets.spec.json`, image concept above | Blue capsule/head/boots; rigid root animation |
| keeper | `/models/3d/penalty-hero/keeper.glb`, this game | `assets.spec.json`, image concept above | Green capsule/head/gloves; rigid translate/roll |
| ball | **Code primitive**, radius 0.11 | None | Sphere with simple black/white panels/materials, always code |
| goal frame/net, pitch, zones, reticle | Code primitives | None | Boxes/lines, plane and coloured markers |

Universe **`stadium`**, generation seed **5155**. Striker ×2 + keeper ×2 = four generations, estimated **2 credits** at 0.5 each. Removing the generated ball saves **0.5 credit**, previously 2.5. Character caps stay 20k tris / 1024 px / 1.5 MB. No skins needed. Claude handles approved concepts/models/generation/import/optimization; this branch touches neither GLBs nor concepts. Swap fallback/model in `assets.ts`, not rules or tap mapping.

## HUD

Exactly **one** shell `hudStat`: `{ key: "shots", label: "Shots", max: 10 }`, using completed shots 0..10. No lives or game countdown; shell Score / Played / Shots plus mute/pause stays one row at 375 px. Do not add Goals/Streak to `hudStats`. Score is points; results/bests use **`pts`**.

`definition.Hud` owns Goals, Streak, ten small bottom shot dots (pending/goal/miss plus text), reticle timing cue and GOAL/SAVED feedback. Reserve its height in the fit, use noninteractive `pointer-events: none`, and announce outcomes with `aria-live="polite"`; colour alone does not indicate results. Goals/streak may be store stats without being shell HUD stats.

Placement: the Goals/Streak pill sits at `env(safe-area-inset-top) + 4.4rem`, below the shell HUD row, which starts at the same inset (notch phones, `viewport-fit=cover`). The dots panel sits at `0.9rem + env(safe-area-inset-bottom) + var(--arcade-bottom-obstruction)`, the variable GameShell sets to the open cookie banner's height, so the banner never hides it (the touch controls use the same lift). The aim deadline shows the last 5 s of the 20 s as a large pill ("SHOOT! 4 s"), amber, then red from 2 s, popping once per second.

## Edge cases

- Pause/hidden tab freezes every timer and animation. Paused resize only reprojects state. The tenth hold resumes its remaining time before `end("win")`; end is idempotent. Zero-goal completion still uses the win title.
- Timeout outranks same-frame input. Outside taps do not prolong AIM. Held keys do not repeat. Score, weights, outcome and sound are committed once.
- Retry/restart clears phase, aim, streak, weights, score and seed. Strict Mode may initialize twice; there is no global run state or paid side effect.
- Rotation to landscape on coarse pointers invokes portrait gate and shell pause. On return, refit before shooting. Fine-pointer windows with an inadequate fit should also pause through the planned fit gate (not built). The fit already avoids the cookie banner (`useFittedView` obstructions); do not promise usable targets if an obstruction consumes required space.
- Missing/broken GLBs use primitives. Ball and tap regions do not depend on character geometry.

## Test plan

Planned `rules.test.ts` (Vitest, pure state/fake input, no wall-clock sleeps):

- Same seed/dt/input timeline reproduces results; uint32 extremes/multiple seeds, integer weighted draws, all zones reachable, exact +1/no timeout reinforcement, separate reticle stream.
- One zone per press, clamping at corners, diagonals in one frame, opposite presses cancel, Space/E edges, locked-phase presses dropped. Through the core input controller: a key tapped between two frames still moves, auto-repeat does not, a swipe does not aim, and a press (`tapDown`) is judged where it landed while a release (`tap`) 250 ms later goes wide. Deadline input cannot evade timeout.
- Accuracy inside/at/outside abs(r) = 0.25; goal versus keeper save; wide = SAVED/0/streak reset. dt = 0/reduced motion cannot change results.
- Streak 100/150/reset, perfect 1450, every other sequence <=1450. **Drive ten idle timeouts: 0 points, 0 goals, 0 streak, ten completed shots**, never auto-scoring the default zone.
- Every 700/500/400 ms phase, including final hold, at 60/120 Hz and irregular raw deltas clamped by core; carry remainder, no skipped cycle/reused edge/double resolution.
- Drive real `createArcadeStore` like ShellStage, RunClock first, through countdown/pause/resume/retry. Check the store and the run clock agree (no untimed frame since the core follow-up), submitted minimum **15950 ms** (real floor 16000 ms), maximum <=216050 ms, **942.5-point rate margin**, and `capScore` a no-op for completed runs.
- One `end("win")`, final score/stats before end, one pickup/hit event per result, no replay on resume. No renderer/wall-clock reads or `Math.random` in rules.

**Browser acceptance plan (pending Scene implementation):** local production build, arcade enabled and API mock enabled, never production WordPress.

- Desktop portrait 800 × 1000 keyboard, **375 × 812** touch emulation and one real portrait phone: ready → countdown → playing → pause/resume → ten shots → "You did it!" → Retry → idle ten-miss round (0 pts) → Exit. Check one-row shell HUD, custom stats/dots/feedback and exactly one sound per result.
- Project all six quads at 375 × 812 with real camera/canvas and overlay rects: >=44 × 44 CSS px, below HUD/above bottom Hud. Tap every zone/boundary/outside; tap over keeper/net and verify plane mapping. Compare to the measured projection table.
- At **812 × 375** with coarse-pointer emulation, rotate overlay blocks shots and pauses; return portrait and continue the same shot. Repeat on a fine-pointer desktop: the planned local fit gate pauses and shows the resize hint instead. Preserve the documented 30 px landscape failure rather than claim support. Test safe insets, cookie banner open/closed, resize/rotation mid-flight.
- Pause for 2.5 s separately in AIM, run-up, flight and final hold; hide/reveal and blur/focus. Resume identical reticle/ball/keeper progress, no extra timeout/shot/sound; test long-frame clamps and reduced motion.
- Mock submission score/duration matches proof; no-GLB fallback, focus/accessibility, no horizontal overflow, <=150 draw calls and 60 fps target on a mid phone. Runtime performance/screenshots are not yet measured.

## Known issues and core gaps

- Playable on primitives; striker/keeper GLBs pending. Projection measurements above check the earlier camera maths; the build uses core `useFittedView`.
- The fine-pointer fit gate (pause and a resize hint when a desktop window makes the zones smaller than 44 px) is not built. Coarse pointers still get GameShell's portrait gate.
- Only the goal box is fitted. The striker and the ball can sit under the bottom Hud panel on short desktop windows, and on phones while the cookie banner is open (the panel is lifted above the banner, over the penalty spot). The panel is translucent and the zones stay clear; fitting the spot too needs a second fit box (core `useFittedView` takes one).
- Full-composition landscape targets fail 44 px height; metadata enforces portrait. Landscape support needs a separately measured camera/composition redesign, not different scoring limits.
- GameShell enforces orientation only on coarse pointers. The planned fit gate must cover inadequate fine-pointer viewports/large bottom obstructions too.
- Swipes never aim (see Controls). A same-direction key press in the frame a swipe fires is dropped with the swipe; that needs a keyboard and a finger at once.
- Core open items that touch this game: the bottom safe-area inset is not reported to the fit, and the cookie banner is found by a 1 s poll, so the dots panel's lift can trail the banner by up to a second.
