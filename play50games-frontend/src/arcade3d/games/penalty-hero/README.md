# Penalty Hero

Owner: Cursor. Slug: `penalty-hero`. Accent `#f472b6`. Status stays `"soon"` until the game is built and reviewed. **This is an implementation specification, not a working game:** `index.tsx` still renders `PlaceholderScene`; Scene, rules and game tests below are planned. This review changes only this README, `assets.spec.json` and `meta.ts`.

| File | What it owns |
|---|---|
| `meta.ts` | Card data, portrait orientation and scoring limits. Plain data, server-safe; numeric limits match `arcade-games.json`. |
| `index.tsx` | Planned `GameDefinition`: Scene, custom Hud, assets, camera, tap controls and one shell HUD stat; no whole-run countdown or lives. |
| `rules.ts` | Planned pure seeded `createRun(seed)` and `step(state, dt, input)`: aim, accuracy, keeper draw, phases, outcomes and scoring. No three.js/React/DOM/random source. |
| `rules.test.ts` | Planned Vitest, including idle scoring and the duration/rate proof. |
| `Scene.tsx` | Planned mount seed, goal-plane tap projection, first-child Simulation, visuals, store reports and sounds. |
| `Primitives.tsx` | Planned stadium, goal/net, code ball, character fallbacks, reticle and zones. |
| `camera.ts` | Planned aspect-dependent fit to world bounds and space between the HUD and bottom overlays. |
| `Hud.tsx` / `Hud.module.css` | Planned game-owned goals/streak, ten shot dots and GOAL/SAVED feedback. |
| `assets.ts` / `assets.spec.json` | Planned `ModelAsset`s / two character generation requests. No generated ball. |

### What a new game copies from here

- Use robot-collector on main as the structure template: this file split, server-safe metadata, a `GameDefinition`, pure seeded rules and tests proving server limits. Reuse core `useRunFrame`, `useInput`, store, `useModel`, `Model` and audio contracts. Never import another game's code.
- Make run state once in a lazy Scene `useState` initializer; do not call setState in the frame loop. Render `<Simulation />` **first**, before visuals. It calls `useRunFrame` → `step(state, dt, input)` → store actions/sound events. Visual callbacks only render the resulting state; they do not advance time.
- Check `CLAUDE.md` and `arcade3d/core` again before implementation. On the main revision merged for this review, there is no shared pause-safe game clock, simulation-first priority option or free-screen camera-fit helper. Until core supplies them, keep a local dt-driven `run.time`, first-child Simulation and the fit below. Adopt core helpers when available instead of copying robot-collector implementations.
- Do not copy warehouse props/layouts, camera yaw/follow, battery effects or scoring. Use `useModel(asset).failed` → stadium primitive, otherwise `<Model asset>`. Copy a generic utility only if needed and still absent from core.

## Concept

Ten penalties into a goal split into six zones. Choose a zone and strike when its wobbling reticle is centred. Accurate shots beat the keeper unless it dives into that zone; imprecise shots can go wide. Consecutive goals earn bonus **points**, displayed as `pts`; goals are a separate count.

## Controls

`meta.controls.scheme` stays `"tap-target"`; the published primary lines remain "Arrow keys to aim, Space to shoot" and "Tap a target zone".

| | Left | Centre | Right |
|---|---|---|---|
| Top | top-left | top-centre | top-right |
| Bottom | bottom-left | bottom-centre | bottom-right |

- Read `useInput().current`. In AIM, classify each axis as -1 below -0.5, +1 above +0.5, otherwise 0. Move the highlight **one zone on a threshold crossing** into a new nonzero direction; holding does not repeat. Clamp at edges, no wrapping; start bottom-centre, `moveY < 0` means up. If both axes cross together, horizontal wins and both latches update. Returning through the dead zone rearms. Track latches even in locked phases so a held key cannot move the next shot automatically.
- Space (`jumpPressed`) or E/Enter (`actionPressed`) shoots the highlighted zone. Apply aim movement before the shooting edge; accept one shot per frame, never held `jump`/`action` auto-repeat.
- Touch/click: `Raycaster.setFromCamera(input.tap, camera)` then `ray.intersectPlane()` onto **z = 0**, using a `Plane` with normal `(0, 0, 1)`. Convert the point to a zone; never intersect keeper, ball, net or GLB meshes. Outside-zone taps, a parallel ray or no intersection do nothing, including no timeout reset. Tap selects and shoots once; accuracy uses the reticle at that simulation instant.
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

`core/ShellStage` ticks RunClock at priority -1 and latches input before game callbacks. `useRunFrame` is priority 0 with no priority argument. Simulation must be the first visual-tree child: same-priority callbacks follow mount order, and children mount before parents. Do not simulate in the parent Scene after its visual children. Visuals render `run.time` and phase progress in `useFrame`, including paused resizes, without advancing them.

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
2. RunClock and Simulation use the same clamped delta. Currently the countdown-to-playing frame can simulate without incrementing store `elapsedMs`; it occurs once and is <=50 ms. Pause advances neither. Thus the **guaranteed submitted minimum is 15950 ms**, allowing for that untimed frame. Use GameShell's default duration, `Math.round(elapsedMs)`, not the animation clock. A new core clock/order helper must retain or strengthen this conservative bound.
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

Local `camera.ts` fit, until core supplies a free-screen helper:

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

## Edge cases

- Pause/hidden tab freezes every timer and animation. Paused resize only reprojects state. The tenth hold resumes its remaining time before `end("win")`; end is idempotent. Zero-goal completion still uses the win title.
- Timeout outranks same-frame input. Outside taps do not prolong AIM. Held keys do not repeat. Score, weights, outcome and sound are committed once.
- Retry/restart clears phase, latches, streak, weights, score and seed. Strict Mode may initialize twice; there is no global run state or paid side effect.
- Rotation to landscape on coarse pointers invokes portrait gate and shell pause. On return, refit before shooting. Fine-pointer windows with an inadequate fit also pause through the planned local fit gate. Include `useBottomObstruction` in the fit; do not promise usable targets if an obstruction consumes required space.
- Missing/broken GLBs use primitives. Ball and tap regions do not depend on character geometry.

## Test plan

Planned `rules.test.ts` (Vitest, pure state/fake input, no wall-clock sleeps):

- Same seed/dt/input timeline reproduces results; uint32 extremes/multiple seeds, integer weighted draws, all zones reachable, exact +1/no timeout reinforcement, separate reticle stream.
- Threshold-crossing aim, held axes/no repeats, dead-zone rearm, corners/diagonal priority, Space/E edges, locked-phase input ignored. Deadline input cannot evade timeout.
- Accuracy inside/at/outside abs(r) = 0.25; goal versus keeper save; wide = SAVED/0/streak reset. dt = 0/reduced motion cannot change results.
- Streak 100/150/reset, perfect 1450, every other sequence <=1450. **Drive ten idle timeouts: 0 points, 0 goals, 0 streak, ten completed shots**, never auto-scoring the default zone.
- Every 700/500/400 ms phase, including final hold, at 60/120 Hz and irregular raw deltas clamped by core; carry remainder, no skipped cycle/reused edge/double resolution.
- Drive real `createArcadeStore` like ShellStage, RunClock first, through countdown/pause/resume/retry. Check exactly one untimed frame <=50 ms, submitted minimum **15950 ms**, maximum <=216050 ms, **942.5-point rate margin**, and `capScore` a no-op for completed runs.
- One `end("win")`, final score/stats before end, one pickup/hit event per result, no replay on resume. No renderer/wall-clock reads or `Math.random` in rules.

**Browser acceptance plan (pending Scene implementation):** local production build, arcade enabled and API mock enabled, never production WordPress.

- Desktop portrait 800 × 1000 keyboard, **375 × 812** touch emulation and one real portrait phone: ready → countdown → playing → pause/resume → ten shots → "You did it!" → Retry → idle ten-miss round (0 pts) → Exit. Check one-row shell HUD, custom stats/dots/feedback and exactly one sound per result.
- Project all six quads at 375 × 812 with real camera/canvas and overlay rects: >=44 × 44 CSS px, below HUD/above bottom Hud. Tap every zone/boundary/outside; tap over keeper/net and verify plane mapping. Compare to the measured projection table.
- At **812 × 375** with coarse-pointer emulation, rotate overlay blocks shots and pauses; return portrait and continue the same shot. Repeat on a fine-pointer desktop: the planned local fit gate pauses and shows the resize hint instead. Preserve the documented 30 px landscape failure rather than claim support. Test safe insets, cookie banner open/closed, resize/rotation mid-flight.
- Pause for 2.5 s separately in AIM, run-up, flight and final hold; hide/reveal and blur/focus. Resume identical reticle/ball/keeper progress, no extra timeout/shot/sound; test long-frame clamps and reduced motion.
- Mock submission score/duration matches proof; no-GLB fallback, focus/accessibility, no horizontal overflow, <=150 draw calls and 60 fps target on a mid phone. Runtime performance/screenshots are not yet measured.

## Known issues and core gaps

- Route is still a placeholder; implementation/assets pending. Projection measurements check specified camera maths, not actual gameplay/overlays.
- Core lacks a pause-safe animation clock and simulation-priority option. Keep dt-only local clock/first-child Simulation until shared contracts exist, then use core. Do not blindly copy robot-collector clock code or R3F elapsed time.
- CameraRig has static/follow placement, no free-screen box fit. Proposed local fitter uses existing `useBottomObstruction`; core could supply fitting/overlay rects. Recheck core APIs before implementing.
- Countdown transition leaves <=50 ms untimed; proof accounts for it. Real-store timing tests must be added with the rules. A core fix could strengthen the bound.
- `<Model>` has no custom fallback prop; a separate `useModel` failure check can clone unnecessarily, as robot-collector documents. Keep it out of rules.
- Full-composition landscape targets fail 44 px height; metadata enforces portrait. Landscape support needs a separately measured camera/composition redesign, not different scoring limits.
- GameShell enforces orientation only on coarse pointers. The planned game's local fit gate must cover inadequate fine-pointer viewports/large bottom obstructions too; changing core is outside this review's scope.
