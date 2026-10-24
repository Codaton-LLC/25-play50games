# Museum Guard

Owner: Cursor. Slug: `museum-guard`. Adventure game 2 (order 12), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §2. Gate G0 (design); the build fills `Status`. Units: metres, seconds; simulation yaw 0 looks along +z, y up. Every "Changed from spec" line says what and why.

## Concept

A round gallery at night. The guard stands in the middle and sweeps a flashlight. Statues sneak off their pedestals only outside the beam; holding the beam sends one home. Two exits sit on opposite sides, so staring at one lets the other leak. A radar and a panned scuttle say what is behind you. Dawn is 90 s. Three alarms and the run is over. Accent `#c4b5fd`.

## Controls

`meta.ts` will say: `scheme: "look"`, `touchControls: ["action"]`, `touchLabels: { action: "Flash" }`, `input: { drag: true }`.

- `keyboard`: "Move the mouse left or right, or hold A / D or the arrows, to turn; Space or E flashes".
- `touch`: "Drag to turn, Flash to burst" (the button reads Flash).
- Turn rate is at most π rad/s, keys, hover and touch together. Held `moveX` turns at π rad/s. Not `stepAimKeys`: that helper snaps to a grid and waits 0.25 s.
- Hover (fine pointers only, `useCoarsePointer()` false): `pointer` follows the mouse with no button held (`createCanvasPointers.move` calls `pointerMove` anyway). `|pointer.x| ≤ 0.15` is a dead zone. Outside it, turn at `sign(x) · π · (|x| − 0.15) / 0.85` rad/s. A fine pointer does not also turn from `drag`.
- Touch: `followRelativeDrag` on yaw only (`min`/`max` ±Infinity, `dragGain = π / 140`, then wrap to (−π, π]). The simulation then caps that yaw change at π rad/s (`π · dt` per frame). A finger faster than 140 px/s does not spin the guard any faster; a 140 px/s drag is exactly the cap. While the drag returns true the keys do not turn. `drag: true` so a look-drag is never a swipe. The touch human bot slews at 140 px/s, so it sits on this cap and cannot be out-turned by a quicker drag.
- Changed from spec: desktop mouse is this hover, not a button-drag. The spec's free mouse is `pointer.x`. Touch stays a drag because a finger has no hover.
- Flash on `actionPressed || jumpPressed`, one press. Esc / P pause (shell). `hudStats`: alarms (max 3), flash cooldown, and Dawn (seconds left, 90 → 0). The shell also draws Score and Played in that same top-left row (no `durationMs`, so the clock chip reads Played, not Time). Hiding Played is an open question.

## Rules

Numbers live in `rules.ts` (`RING`, `BEAM`, `FLASH`, `TYPES`, `PHASES`, `SCORE`) and are proved in `rules.test.ts`. One `useRunFrame`: input, then either the win step or the exhibits. No `durationMs` (see Run end). The run clock has already added this frame's time before the step.

- **Ring** (`RING`): 8 pedestals at r = 6, angles `(k + 0.5) · π/4`. Two exits at `+π/2` and `−π/2` (on the wall). Each threshold is the inner-lane point r = 5.2 at that exit's angle. Guard circle r = 0.45 at the origin. An exhibit's centre stays at r ≥ 5.2, so it never meets the guard. Start yaw 0 (looking +z). Both exits are 90° off that yaw, outside the 16° beam.
- **Exits:** a statue walks to the nearer exit (smallest absolute wrapped angle; a tie takes `+π/2`). The exits are π apart. The widest beam is 34° (coarse clamp 17°), and the flash is 90°, so neither cone can contain both thresholds. Changed from spec: one door let a stationary beam freeze every arrival (phase-3 12° covers 1.26 m of the old ring plus the 0.8 m inward step; a penguin coast is only 0.5 m) and farm +50.
- **Roster:** 2 knight, 2 robot, 2 penguin, 2 dino. Seeded pedestal shuffle. Changed from spec: no bust and a fixed 8, because that GLB is not loaded and the robot already hops at 0.8 m/s. Dino sneaks only from t ≥ 30, and never from a pedestal whose path is under 4 m. Pedestal top y = 0.8 (`PEDESTAL_TOP(0.8)`), square width 0.8 (inner face at r = 5.6).
- **Path:** step inward on the pedestal's ray from r = 6 to r = 5.2 (0.8 m), then the shorter arc at r = 5.2 to the exit angle. The arc is the inner lane: it does not pass through other pedestals (0.4 m clear of the inner face). Shortest arc is π/8, so the shortest path is 0.8 + 5.2 · π/8 = **2.842 m**. Longest arc is 3π/8, path **6.926 m**. Foot y (visual, same XZ length): 0.8 → 0 over the first 0.4 m of the inward step, y = 0 on the lane, and the return climbs 0 → 0.8 over the last 0.4 m into the pedestal centre. `hop` adds y ≥ 0 on the group.
- **Types** (`TYPES`): knight 0.6 m/s, robot 0.8, penguin 1.0, dino 1.2. Circles: 0.35 / 0.28 / 0.25 / 0.45. These are rules radii, not mesh bounds. Circles may overlap; nothing pushes exhibits apart.
- **Mover cap:** counts `sneaking` only, coast included. Frozen and returning do not count, so a hold does not block the next start. The gap still limits starts.
- **Phases** (`PHASES`): 0–30 s, 30–60 s, 60–90 s. Speed ×1 / ×1.15 / ×1.25. Sneaking at once ≤ 2 / 3 / 3. Starts ≤ 6 / 7 / 8 (21 max). Min gap 4.2 / 3.6 / 3.2 s. First start ≥ 3.0 s. Changed from spec: at most 3 movers, not 4, because a fourth at the late speed is not recoverable after a 0.2 s reaction plus a half-turn.
- **Director:** when the gap has elapsed and a slot is free, start the still exhibit whose path is legal and whose bearing is outside the beam. Prefer the one whose nearer exit is furthest from the beam yaw, then the longer path, then the lower pedestal index. At most one mover with path < 5 m (the four short pedestals are 2.842 m; the four long ones are 6.926 m). The choice reads the beam yaw at that frame (deterministic). There is no "wait, then start one inside the beam": a beam ≤ 17° cannot cover pedestals 45° apart, so that wait never fired. Changed from spec: the opposite-half-circle rising probability is this deterministic pick, so the schedule pins in tests and the next start is the exit the beam is not covering.
- **Beam** (`BEAM`): half-angle 16° / 14° / 12°, range 9. Coarse pointers ×1.2, clamped at 17°. `inViewCone` (inclusive edges). In the cone → frozen at once (penguin excepted); continuously in the cone ≥ 0.7 s → returning at 3 m/s along the path home, and it finishes even if the beam leaves. Leaving during the 0.7 s resets the hold and it sneaks again. Changed from spec: 16/14/12 instead of 22 narrowing to 15, because at fov 70 a 390×844 phone's horizontal half-fov is about 18°, so 22° would freeze statues off the sides of the screen.
- **Penguin coast:** on each new entry into the cone while sneaking, keep the current speed for 0.4 s (once per entry, not once per life). Those 0.4 s count toward the 0.7 s hold if the centre stays in the cone; then it stops and is frozen. If the coast carries the centre outside the cone, the hold resets at once and the coast still runs out its 0.4 s while sneaking. A later re-entry starts a new coast. A coast that comes within 0.45 m of a threshold alarms and the coast is cancelled.
- **Return bonus:** +50 only if path remaining was > `SCORE.returnMinM` (2 m) at the moment returning begins (after the coast). A save closer than that still sends it home and spends no alarm.
- **Flash** (`FLASH`): half-angle 45° (90° cone), 1.2 s, cooldown 10 s. The cone stays at the yaw of the press for the whole 1.2 s, and it counts as the beam even after you turn. A press during cooldown is ignored. Either cone (live beam or locked flash) is enough.
- **Alarm:** centre within 0.45 m of a threshold while sneaking consumes one alarm and the exhibit is back on its pedestal, still. At 0 alarms, `end("lose")`. On the shortest pedestal the point itself is 2.842 m along the path; the radius spends the alarm 0.45 m sooner.
- **Dawn check:** if the step begins with `elapsedMs ≥ 90000`, skip the exhibits (no same-frame alarm), award the new whole second, then the win in Run end. Otherwise move the exhibits and a third alarm can end the run.

## Scoring

`runScore(seconds, returns, alarms, survived) = 5 · min(90, floor(seconds)) + 50 · returns + (survived ? 150 · alarms : 0)`. `returns` counts paid returns only (caught with more than 2 m of path left). Live: `addScore(5)` on each whole second, `addScore(50)` when a paid return reaches its pedestal, `setStat("returns" | "alarms" | "dawn", …)`. `finalScore(state)` returns `runScore(min(90, floor(elapsedMs / 1000)), stats.returns, stats.alarms, endReason === "win")` and `durationMs: elapsedMs`. It replaces the store score (it does not add again). A lose pays no dawn bonus. On the win frame, `addScore(150 · alarms)` before `end("win")` so the HUD matches. Maximum 5 · 90 + 50 · 21 + 150 · 3 = **1950**.

### Server limits and why they hold (the proof)

| | provisional (`meta.ts`, 02 §C.4) | proposed (Claude's limits PR; not this branch) |
|---|---|---|
| `maxScore` | 3900 | **2050** |
| duration | 10000–92000 ms | **12000–92000 ms** |
| `base` / `max_pps` | 3900 / 3900 | **0 / 25** |

`meta.ts` stays provisional until that PR. The two exits changed the shortest path (was 3.156 m) and the earliest lose. The ceiling is still 1950, and 12000 ms is still under the earliest lose, so these limits do not move. Proof plan: pure steps on one `fixedFrames(1000/60)` schedule per seed, then `simulateRun` for the store path.

1. **Starts:** ≤ 6 / 7 / 8, gaps 4.2 / 3.6 / 3.2, none before 3.0 s, no dino before 30 s, ≤ one short path (< 5 m) at a time, ≤ the phase's sneaking cap. Frozen and returning are outside the cap.
2. **Speed:** a step never exceeds `base · phase · dt`, except the penguin's 0.4 s coast at the speed it had. Returning is 3 m/s. r ≥ 5.2 always. Overlap is allowed.
3. **Cone:** frozen on the inclusive edge, not 0.01° outside; the 0.7 s hold resets if the beam leaves; a coast that exits the cone resets the hold and keeps moving; flash stays on the pressed yaw, 45° / 1.2 s, then the cooldown rejects a press. Both exit thresholds are never inside one cone of half-angle ≤ 17° or 45°.
4. **Earliest lose:** a fixture of three short penguins (the game ships two) is forced to start at 3.0, 7.2 and 11.4 s and walk 2.842 m at 1.0 m/s with no turn input. The centre reaches the threshold point at 5.84, 10.04 and **14.24 s**. The 0.45 m radius spends the third alarm at **13.79 s**. That sneak lasts 2.39 s, under the 4.2 s gap, so the one-short rule does not delay the chain. 12000 ms is 1.8 s under 13.79 s. A long path (6.926 m) only loses later. The real director is not this fixture: with yaw left at 0 both exits are equally far, so it prefers longer paths, and that run also loses.
5. **Dawn:** 21 paid returns + 3 alarms = 1950 at 90 s (21.7 pts/s). A paid return needs the hold to finish with more than 2 m left, so the earliest is a knight frozen on its pedestal: start 3.0 + hold 0.7 = 3.7 s, score 65 (17.6 pts/s). Catching a short statue only inside the last 2 m pays 0. Every prefix stays ≤ 25 pts/s and ≤ 1950. `capScore` is a no-op. 2050 is 100 over the ceiling. The fixture lose scores 5 · 13 = 65. A real seed with no turning scores only the seconds until the third alarm.
6. **Human bot:** reaction 0.22 s (inside 0.15–0.25), turn at π rad/s toward the sneaking statue with the least time left, hold until returning, flash when two sneaks would arrive within 2.2 s and one is inside 45°. The worst turn is exit to exit, 157.5°, not 112.5° off the start yaw. A phase-3 penguin (1.25 m/s) on a short pedestal of the other exit, at the slow end of the reaction band (0.25 s): contact is 0.25 + (157.5 − 12) / 180 ≈ 1.06 s, because the 12° cone means the turn is 145.5°. It has covered ≈ 1.32 m by then; the 0.5 m coast leaves ≈ 1.0 m of path, 0.57 m outside the alarm radius, and inside the 2 m line, so that catch pays no +50. A 0.7 s hold still running on the first exit does not fit. Contact would land near 1.8 s and the coast would finish inside the alarm radius. Only the flash, or a spent alarm, covers that penguin. Keyboard, hover (`pointer.x` at ±1) and touch (a 140 px/s drag, the π rad/s cap) each win ≥ 50 % of 30 seeds at 60 fps. A perfect sweeper on 10 seeds survives with all 3 alarms and scores ≤ 1950. On every seed, a camp bot (yaw locked on `+π/2`, no flash) and a spin bot (yaw += π rad/s, no flash) lose before 40 s with 0 paid returns and score ≤ 200. The camp feeds the far exit. On seeds where both dinos sit on the short pedestals of one side (a dino never starts before 30 s, and never from a path under 4 m) its third alarm is about 24.6–26.4 s, so "before 25 s, score ≤ 120" does not hold. 5 × 39 = 195, and ≤ 200 covers a loss before 40 s. A spin never holds 0.7 s. Five more seeds use `randomFrames` (4–50 ms) for the limit only.

## Run end

**PROPOSED, user decision pending.** The spec says dawn is `"timeup"` and that timeup counts as survival. The shell's timeup title is "Time's up!", `playSfx("win")` runs only for `endReason === "win"` (otherwise the lose sting), and the shell spawns no confetti. `durationMs` also ends the run inside `tick`, before `useRunFrame`, so the frame that crosses 90 s never awards its +5. The build follows this proposal so those three are fixed:

- No `durationMs`. The Dawn HUD stat is the clock (`setStat("dawn", secondsLeft)`).
- On the first step that begins with `elapsedMs ≥ 90000` and alarms ≥ 1: award second 90, `addScore(150 · alarms)`, `fx.burst("confetti", { x: 0, y: 1.2, z: 2 })`, dawn chime, `end("win")`. Exhibits do not move on that step. `finalScore` uses `survived: true`. Ranked (points game). `resultDelayMs: 1100` so the confetti is seen. The shell then shows "You did it!" and plays the win sting over the dawn chime.
- `end("lose")` on the frame the third alarm is spent. Ranked, no dawn bonus, no confetti. Same delay, so the red pulse is seen.
- Seconds passed to `runScore` are capped at 90, so a frame that stops at 90050 ms does not pay a 91st second. `maxDurationMs` 92000 still covers that overshoot.

## Scene and camera

The mechanic is not seeing the whole ring, so the eye stays put. It does not use `fitView` or `CameraRig`: `fitView` searches a distance 1..500 and dollies, its pitch is height above the look-at (a negative pitch looks up), its yaw 0 sits the camera on +z looking toward −z, and its lens shift is valid only at the distance it picked. `CameraRig` damps at 5/s and lerps the look-at, so a turn of π rad/s trails the beam by about 36°, and a 180° drag swings that point through the camera.

Fixed eye. Position (0, 1.6, 0), fov 70, no pitch. The shell's `definition.camera` is `{ position: [0, 1.6, 0], lookAt: [0, 1.6, 1], fov: 70 }` until the rig's first frame. `<EyeRig yaw>` is the simulation yaw: 0 looks along +z, positive turns toward +x. The game passes that yaw through and does not add π. The flashlight group uses the same yaw (`rotation.y = yaw` faces +z, matching `inViewCone`).

This needs a core helper. The game must not implement it in its folder. Claude adds exactly:

- `fitEyeShift({ width, height, fov, eyeY, pitch?, band, margin?, avoid?, padding?, steps? })` in `core/view.ts` (pure). `band` is an AABB in the view frame: origin on the floor under the eye, +x right, +y up, +z forward, yaw removed. Returns `{ shift: [x, y], fits, overflow }`. No distance search. The shift does not depend on yaw.
- `useEyeShift` in `core/useEyeShift.ts`. Same arguments except `width` / `height`, plus `avoidHud` / `avoidControls` / `avoidObstructions`, each defaulting to true. Returns `EyeShift`. Same resize and safe-area contract as `useFittedView`: recomputes when the canvas or the safe area changes, never per frame.
- `<EyeRig position yaw pitch? fov? shift? shiftRate? turnRate? />` in `core/EyeRig.tsx`, at `FRAME_PRIORITY.camera` (−0.25), after `useRunFrame`. `yaw` is that simulation yaw (a number or `{ current: number }` read each frame). `turnRate` (rad/s) moves along the shortest arc; omitted means copy `yaw` (no trail). `shiftRate` defaults to 8/s. Never lerp a look-at point. Apply `shift` with the existing `stepLensShift` / `clearLensShift`. The game omits `pitch` and `turnRate`: the simulation already caps the turn at π rad/s, and a drag's yaw jump is applied as a rotation, not as a look-at swing. The game does not mutate the shift array.

`band` is the far lit slice that stays on screen: x [−1.5, 1.5], y [0, 2.4], z [5.0, 6.4]. At 390×844 that box is NDC y −0.46..+0.23 and x ≤ 0.93. The old box x [−2.2, 2.2], y [0, 2.4], z [0.4, 6.5] does not fit: the corner (±2.2, 0, 0.4) projects about 5.7 NDC below the screen, and x ±2.2 at z 5.2 is 22.9°, past the 17.9° portrait half-fov, so the shift would be meaningless. `useEyeShift({ band, fov: 70, eyeY: 1.6, margin: { top: 0.08, bottom: 0.06, left: 0.02, right: 0.02 }, padding: 8, avoid: [radar rect] })`. `looks.test.ts` pins `fits === true` at 390×844 and 844×390 with the cookie banner open (`avoid` carries that rect; the hook's `avoidObstructions` covers it in play). Statue bob uses `useGameTime`.

Planned projection of this fixed eye (not a measurement; the build replaces it after screenshots). Vertical px/m ≈ height / (2 · depth · tan 35°):

| | px/m near r = 4 | px/m far r = 6 | knight 1.6 far | penguin 0.8 far | beam ≥ |
|---|---|---|---|---|---|
| 390 × 844 | 151 | 100 | 161 px | 80 px | 24 px |
| 844 × 390 | 70 | 46 | 74 px | 37 px | 24 px |

`environment: { background: "#1e1b4b", fog: ["#1e1b4b", 18, 28], lighting: "night" }`. One live `<Flashlight>` (mounted with the scene, `light` on; the kit drops the light on the low tier). Its two meshes are the beam: the additive sheet and the floor sector. There is no separate beam mesh. The flash is a second `<Flashlight light={false} halfAngle={π/4} range={9}>`, mounted with the scene, `visible` for 1.2 s, `rotation.y` locked at the press yaw. `light={false}` keeps the spot count at one (mounting a light mid-run recompiles every lit material). The kit places the spot target at `range · 0.75` on the floor, so at 12° the knight's head (y 2.4 at r = 6, about 21° off that axis) is outside the spot. The floor sector shows the cone; the statue read is the emissive glow below, not the spot. Freeze rings are one instanced mesh at y = 0.04.

## Core helpers used

`GameDefinition` (`resultDelayMs`, `finalScore`, `input.drag`, `touchControls`, `touchLabels`, `hudStats`, `environment`; no `durationMs`), `useRunFrame`, `useGameTime`, `useInput` (`moveX`, `pointer`, `drag`, `actionPressed`, `jumpPressed`), `followRelativeDrag` (`core/aim`), `useCoarsePointer`, `EyeRig` + `useEyeShift` + `fitEyeShift` (core, to be added), `useSafeArea`, `useArcadeStore` (`addScore`, `setStat`, `end`), `inViewCone` (`core/ai`), `hop` / `waddle` (`core/motion`), `withinServerLimits` / `capScore`, `simulateRun` / `fixedFrames` / `randomFrames` (`core/testing/botHarness`), `<Model>` (material on the asset, `tint` unused), `<Flashlight>` / `<Pedestal>` (`core/kit`), `<InstancedModel>` (doors), `<TargetMarkers>` (one arrow for the sneaking statue with the least time left, only while it is off-screen), `useFx` (`burst("sparkle", position)` on a freeze, `burst("confetti", position)` on the win, `shake` on an alarm), `useQuality` + `scaledCount`, `playSfx` / `startLoop` / `useMuted`. Not used: `useFittedView`, `CameraRig`, `<HumanoidModel>`, Rapier, `core/path`, `Trail`. The schedule and the ring path are game-local.

## Assets

No generation. Nothing new in this folder is loaded. Fits in `assets.ts` come from the core size constants and are rechecked on the real mesh in `assets.test.ts`.

| id | class / source | drawn | rules | fallback |
|---|---|---|---|---|
| knight | C `{ ...EXPANSION_CHARACTERS.knight, id, material, scale: 1.6 / 1.884 }` | 1.6 m, `<Model>` + `hop` | r 0.35 | capsule |
| robot | D `{ ...SHARED_ASSETS.robot, id, material: "gold", scale: 1.2 / 1.72 }` | 1.2 m, `<Model>` + `hop` (mesh height 1.72) | r 0.28 | capsule |
| penguin | C `EXPANSION_ASSETS.penguin`, `material: "bronze"` | 0.8 m (the asset's own scale), `<Model>` + `waddle` | r 0.25 | capsule |
| dino | C `EXPANSION_ASSETS.dino`, `material: "bone"` | 1.1 long, 0.8 tall (the asset's own scale), `<Model>` + a slide offset | r 0.45 | capsule |
| door | D `REUSED_ASSETS.door`, ×2 instanced | 2.1 m, scale `2.1 / REUSED_GLB_SIZE.door.height` (1.8929) | none | box |
| bench | D `REUSED_ASSETS.bench` | decor; no `REUSED_GLB_SIZE` entry, so the scale is measured at build | none | box |

Each statue has its own asset object (unique `id`, shared url) so a state swap does not recolour the other copy. Still uses the preset (`"stone" | "gold" | "bronze" | "bone"`). Sneaking and frozen swap in a custom override with the preset's `color` / `roughness` / `metalness` and `emissive` `#fb7185` or `#6ee7b7`. There is no `<Model material>` prop, and no `tint`: a tint multiplies albedo, so coral on gold renders orange. Emissive keeps the statue colour and reads as the spec's glow. Swapped only when the state changes.

`<Model>` of a humanoid asset still draws a skinned copy: `HumanoidStill` in `core/assets.tsx` runs `useHumanoidRig` and stands with the arms down. Knight and robot are that copy plus `hop` on the group (four skinned meshes). This is not four fewer skinned rigs than `<HumanoidModel>`. What is skipped is the pose driver: no `useHumanoidPose`, no `poses.ts`. Changed from spec: the spec asked for no posed skeletons; a pose driver is not needed for a hop. Penguin and dino are not humanoids, so they are not skinned. Bench and dust motes hide on the low tier. The bust is catalog E; `assets.spec.json` records its recipe and does not authorize a generation, and the build does not load it.

## Files

`meta.ts` · `index.tsx` · `rules.ts` · `rules.test.ts` · `looks.ts` · `looks.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Gallery.tsx` · `Hud.tsx` + `Hud.module.css` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail later, via `tools/thumbs`.

## Test plan

`rules.test.ts` under ~600 lines and under ~60 s. One frame schedule per seed. Pins are literals (`BEAM` half-angles, 0.7, 2, 2.842, 6.926, 21, 1950, 13.79, 14.24).

- **Cone and hold:** inclusive edge freezes; 0.01° outside does not; hold resets; penguin coasts 0.4 s per entry then stops; a coast that leaves the cone resets the hold and keeps its speed; return finishes after the beam leaves; +50 only when remaining was > 2 m as returning began; flash locked at the press yaw, 45° / 1.2 s / 10 s cooldown; the two thresholds are never both inside one cone.
- **Director:** caps count sneaking only; gaps; first start ≥ 3; no early dino; one short path; determinism for a fixed yaw trace; no start-inside-the-beam fallback.
- **Body:** r ≥ 5.2 for 20,000 steps; the inner-lane samples miss every other pedestal square; the three-penguin fixture alarms at 13.79 s (point arrival 14.24 s), not before.
- **Score:** `runScore`; every prefix ≤ 25 pts/s and ≤ 1950; `withinServerLimits`; `capScore` unchanged. Perfect bot (10 seeds, 60 fps) survives with `alarms === 3` and score ≤ 1950. Human bot (30 seeds, 60 fps) wins ≥ 50 % on keyboard, on hover, and on the touch drag at 140 px/s. On every seed, camp and spin each `endReason === "lose"` before 40 s, 0 paid returns, score ≤ 200. Five jitter seeds stay inside the limits. The win step awards second 90 and the dawn bonus with no `durationMs`.
- `assets.test.ts`: drawn heights on the real meshes (1.6 / 1.2 / 0.8 / dino 1.1 long); door scale from `REUSED_GLB_SIZE.door`; knight and robot are `<Model>` assets (no game pose). `looks.test.ts`: far penguin ≥ 24 CSS px at 390×844 and 844×390. It calls `fitEyeShift` (not `fitView`) on the band x [−1.5, 1.5], y [0, 2.4], z [5.0, 6.4], with the cookie-banner rect in `avoid`, and pins `fits === true` at 390×844 and 844×390. The radar rect misses the shell HUD rects (the chip row and the buttons) and misses statues within the beam half-angle + 10° of the view axis. It does not require every pedestal at all 16 yaws to miss the radar: at the landscape half-fov of about ±56° a side pedestal reaches the top corners.

## Performance

Worst frame **27** draw calls (spec ≈ 40), cap **50**. The old "36" was this list mis-added.

| piece | calls |
|---|---|
| room (floor, wall, skylight) | 3 |
| pedestals, instanced | 1 |
| paintings | 1 |
| vases, instanced | 1 |
| rope (`<Fence>` kit) | 2 |
| doors, instanced | 1 |
| bench | 1 |
| statues (`<Model>`, one draw each) | 8 |
| live flashlight (sheet + floor sector) | 2 |
| flash cone (second flashlight, up for 1.2 s) | 2 |
| freeze rings, instanced | 1 |
| dust motes | 1 |
| blob shadows | 1 |
| fx | ≤ 2 |

One spot light, on the live flashlight only, mounted with the scene. `useFx().warm("sparkle", "confetti")` on mount; a freeze calls `burst("sparkle", position)` at that statue's centre. The win calls `burst("confetti", position)`. No per-frame allocation: one scratch cone query, a fixed array of 8, the drag aim object created once. Low tier hides bench and motes (25 during a flash) and the kit skips the spot.

## Audio

`startLoop("ambient", { volume: 0.2 })` only while `phase === "playing" && !muted`. The effect depends on `[phase, muted]`, stops the loop otherwise, and stops it on cleanup. Pause and mute must not start it. Scuttle `playSfx("click", { pan: sin(bearing), pitch })` at most every 0.5 s per sneaking statue. Freeze `"chime"`, return `"whoosh"`, alarm `"alarm"`, dawn `"chime"` at pitch 1.4 on the win frame (the shell adds its win sting).

## Accessibility

Radar shapes (square, circle, triangle, diamond), not colour alone; sneaking is an outline, frozen is a fill. Panned scuttle. Coarse beam +20 % up to 17°. Flash is the safety valve and its cooldown is a number, not only a colour. HUD text `#f8fafc` on `rgba(15, 23, 42, 0.92)`. Portrait radar: 132 px, left 12, bottom 12 above the banner, `data-arcade-safe-area`. Landscape (width > height): 96 px, left 12, top = the shell HUD bottom + 8. The chip row (Score, Played, Alarms, Flash, Dawn) is one row at about y 10–52 and about 350 px wide, so a radar at (12, 12) would sit on it; top 60 clears that row. `looks.test.ts` is the gate for both, banner open: the radar clears the beam band (statues within the beam half-angle + 10° of the view axis) and the shell HUD rects. `fx.shake` honours reduced motion.

## Risks and open questions

Decisions already made, so a build can start once the eye rig exists: narrower beam, mover cap 3, no bust, two exits, inner lane, +50 only beyond 2 m, hover on fine pointers, fixed eye, limits 2050 / 12000–92000 / 0 / 25. The px table is a projection, not a screenshot. Bench scale is measured at build time because `REUSED_GLB_SIZE` has the door and no bench. The spot misses the knight's head at 12°; the emissive glow is the statue read.

**PROPOSED, user decision pending:** dawn calls `end("win")` with no `durationMs`, as written in Run end. The build uses that. Restoring the spec's `"timeup"` brings back "Time's up!", the lose sting, no confetti, and a lost +5 on the last frame.

Open: the shell also shows a Played chip next to Dawn (Score, Played, Alarms, Flash, Dawn). Dawn already shows the clock. Claude may add a core option to hide Played; until that exists the landscape radar sits below the row.

Claude adds `fitEyeShift`, `useEyeShift` and `EyeRig` (signatures above) before the build. The game does not copy them into its folder. `playedFrameDt` lives in `core/frameLoop`, and `simulateRun` is what the store bots call.

## Status

TASK P-18-museum-guard | build museum-guard | branch cursor/game-museum-guard | allowed: play50games-frontend/src/arcade3d/games/museum-guard/**, play50games-frontend/public/images/3d/museum-guard.webp, tools/thumbs/inputs/museum-guard.mjs

### Files

- `rules.ts`, `rules.test.ts` — seeded sim, scoring, bots
- `looks.ts`, `looks.test.ts` — palette, eye band, radar rects
- `assets.ts`, `assets.test.ts` — GLB fits on the real meshes
- `Scene.tsx`, `Gallery.tsx`, `Primitives.tsx`, `Hud.tsx`, `Hud.module.css`
- `index.tsx`, `meta.ts` (controls text only; scoring and `status: "dev"` unchanged; thumbnail null)
- `tools/thumbs/inputs/museum-guard.mjs`
- `assets.spec.json` left as the bust recipe; the bust is not loaded

### Acceptance

- GameDefinition: Scene, Hud (`data-arcade-safe-area` radar), no `durationMs`, `clockChip: false`, `resultDelayMs: 1100`, `finalScore`, drag input, Flash label, night environment, eye camera.
- Dawn calls `end("win")` at 90 s on the rules clock. Three alarms call `end("lose")`. No `submitScore`, API, or localStorage.
- One `useRunFrame` steps the rules and the store. Visuals use `useGameTime()`. EyeRig yaw is a ref written each step.
- Knight and robot are `<Model>` of humanoid assets (arms down) plus `hop`. No `<HumanoidModel>`.
- `npx tsc --noEmit` passed. `npx vitest run src/arcade3d/games/museum-guard` passed: 25 tests, 9.3 s. `rules.test.ts` is 524 lines.
- Not playtested in a browser. This run was told not to build or start a server.

### Scoring and limits

`runScore = 5 * min(90, floor(seconds)) + 50 * returns + (win ? 150 * alarms : 0)`. Ceiling 1950 (450 time + 21 returns + 450 dawn). A loss pays no dawn bonus. Whole seconds follow `floor(elapsed)`, so the store matches `finalScore`.

`PROPOSED_LIMITS` (not written into `meta.ts`): maxScore 2050, minDurationMs 12000, maxDurationMs 92000, base 0, maxPointsPerSec 25. 1950 is 95.1% of 2050. The earliest designed loss is the penguin fixture at 13.79 s, so 12000 ms sits under it. `capScore` is a no-op on every bot run (`capScore(score) === score`).

### Bots

All through `simulateRun` and the real store, seeds 1..N, 60 fps unless noted. Reaction 0.22 s for the human; 0 for the sweeper.

- Perfect sweeper, 10 seeds, keys: every run wins with `alarms === 3`, score ≤ 1950, best ≥ 1845, `finalScore` equals the store, inside the limits.
- Human, 30 seeds, keys / hover / touch (drag capped at π rad/s): each mode wins at least 15, all inside the limits.
- Camp (yaw locked on +π/2) and spin (`moveX = 1`, no flash), 30 seeds: lose before 40 s, 0 paid returns, score ≤ 200.
- Idle and spam, 20 seeds: score < 1000 and inside the limits. Spam flashes every frame; the 10 s cooldown gates it.
- Five seeds at 30 fps, 144 fps, and `randomFrames`: inside the limits.

### Draw calls

Worst frame about 27, under the cap of 50, one spot light: room 3, pedestals 1, paintings 1, vases 1, rope 2, door 1, bench 1, statues 8, live beam 2, flash cone 2, freeze rings 1, shadows 1, motes 1, fx ≤ 2. Low tier drops the bench, the motes, and the spot. The lose pulse stays hidden while playing.

### Open questions

- Pedestals are one instanced mesh (plinth, column, cap, vertex colours) so the 27-call budget holds. The kit `Pedestal` is one mesh per copy. Cap height is `PEDESTAL_TOP(0.8)`.
- Bench scale is `2 / REUSED_GLB_SIZE.bench.width` (that size entry exists). Drawn width is 2 m.
- Robot scale is the design literal `1.2 / 1.72`. The mesh is 1.7152 tall, so the drawn height is about 1.197 m. The test allows `toBeCloseTo(1.2, 2)`.
- The spot still aims at `range * 0.75` on the floor, so a knight's head at 12° is outside it. Sneak and freeze read as emissive, not as the spot.
- The penguin pixel check is a projection (portrait > 60 CSS px, landscape > 30, both ≥ 24 at 6 m). Claude's screenshots replace it.
- The beam's half-angle is React state, updated only when the phase index changes (twice a run), because `<Flashlight>` rebuilds its geometry from the prop. That is the only `setState` from the frame loop.
- The shell does not remount the scene on Retry, so the run is recreated when `runId` changes rather than in a one-shot `useState`.

## Fix round 1 (2026-10-24)

1. Two exits at ±π/2; statues take the nearer one; neither cone covers both. +50 only when path remaining > 2 m as the return starts. On every seed, camp and spin lose before 25 s with no paid return and score ≤ 120.
2. Dropped `fitView` / `CameraRig`. Fixed eye (0, 1.6, 0), rotation `yaw + π` at `FRAME_PRIORITY.camera`, easing on the angle inside `EyeRig` (the game copies yaw, no look-at lerp). Lens shift from `fitEyeShift` / `useEyeShift`. Claude adds that API; the game does not.
3. **PROPOSED, user decision pending:** no `durationMs`, Dawn stat, `end("win")` at 90 s, `finalScore` from `runScore`. The build follows it.
4. Landscape radar is 96 px at the top-left. `looks.test.ts` projects every pedestal and path box over 16 yaws against that rect with the banner open.
5. Knight and robot are `<Model>` + `hop`. Material is spread onto the asset (`material: "stone"`, `scale: 1.6 / 1.884`). No `<HumanoidModel>`, no `poses.ts`.
6. Inner lane at r = 5.2. Shortest path 2.842 m, point arrival 14.24 s, alarm at 13.79 s. Limits stay 2050 / 12000 / 92000 / 0 / 25; the proof is redone above.
7. Hover on `pointer.x` for fine pointers (dead zone 0.15, at most π rad/s). The old "free mouse is not an input" line was wrong. Touch stays a drag.
8. Sneaking only counts toward the cap. Coast is once per cone entry; leaving the cone resets the hold and the coast finishes. Overlap is allowed. Flash yaw is locked, drawn by a second `<Flashlight light={false}>`. The impossible all-in-beam wait is removed. Step off and back is the 0.4 m foot-y ramp. Director change is now a "Changed from spec" line. The perfect bot must keep all 3 alarms.
9. The kit flashlight is the beam (2 draws) plus the flash cone (2). Freeze rings 1, motes 1. The list sums to 27, cap 50. The spot target stays `range · 0.75` on the floor (head unlit at 12°). Door scale uses `REUSED_GLB_SIZE.door`; the bench has no entry. The ambient loop starts only while playing and unmuted. State glow is `emissive`, not a multiplying tint.

## Fix round 2 (2026-10-24)

1. Eye band is x [−1.5, 1.5], y [0, 2.4], z [5.0, 6.4] (NDC y −0.46..+0.23, x ≤ 0.93 at 390×844). The old x [−2.2, 2.2], z [0.4, 6.5] box does not fit. `looks.test.ts` pins `fits === true` at 390×844 and 844×390 with the banner open. Core signatures match what Claude is adding: `fitEyeShift` → `{ shift, fits, overflow }`, `useEyeShift` → `EyeShift` (`avoidHud` / `avoidControls` / `avoidObstructions` default true), `<EyeRig yaw>` with 0 = +z and `shiftRate` default 8/s. `turnRate` omitted copies yaw.
2. Landscape radar is 96 px at left 12, top = HUD bottom + 8 (60 when the chips occupy y 10–52), clear of Score / Played / Alarms / Flash / Dawn. The looks test requires the radar to clear the beam band (statues within the beam half-angle + 10° of the view axis) and the shell HUD rects. It does not require every pedestal at 16 yaws to miss the radar.
3. Camp and spin lose before 40 s with 0 paid returns and score ≤ 200. Seeds with both dinos on one side's short pedestals alarm at about 24.6–26.4 s, so the round-1 bound (before 25 s, ≤ 120) does not hold.
4. The human bot's worst turn is exit-to-exit 157.5° (phase-3 penguin, contact ≈ 1.06 s, ≈ 1.0 m left after the coast, 0.57 m outside the alarm). A 0.7 s hold still running on the first exit does not fit; the flash or a spent alarm covers it.
5. Touch-drag yaw is capped at π rad/s, so the turn-rate claim and the touch human bot (140 px/s) are the same limit.
6. The freeze effect is `sparkle`, and `burst` takes a position. Played stays visible next to Dawn unless Claude adds a hide option (open question). Knight and robot `<Model>` draws are still skinned (`HumanoidStill`); the saving is the pose driver, not four rigs.

## Decisions (user, 2026-10-24)

The user approved this design and asked Claude to settle every open question with a modern, fair arcade feel in mind. These answers override the Open questions above; the build follows them.

- **Core (Claude adds before the builds):** a points game that ends on `"timeup"` with a score above 0 plays the win cue and confetti like a finish, not the lose sting; `GameDefinition.clockChip: false` hides the shell's Played chip for games that show their own clock.
- Dawn: `end("win")` at 90 s on the rules clock, no `durationMs` (as proposed).
- Played chip: hidden with the new core `clockChip: false`; the radar keeps its landscape spot below the row anyway.
- Everything listed as decided stays (narrow beam, mover cap 3, two exits, inner lane, +50 beyond 2 m, hover, EyeRig, limits 2050 / 12000-92000 / 0 / 25).
- Modern look: night museum with emissive statue glow, soft volumetric-looking beam cone, polished floor reflections faked with a darker gradient plane, subtle dust motes.
