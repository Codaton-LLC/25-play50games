# Museum Guard

Owner: Cursor. Slug: `museum-guard`. Adventure game 2 (order 12), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §2. Gate G0 (design); the build fills `Status`. Units: metres, seconds; yaw 0 looks along +z, y up. Every "Changed from spec" line says what and why.

## Concept

A round gallery at night. The guard stands in the middle and sweeps a flashlight. Statues sneak off their pedestals only outside the beam; holding the beam sends one home. A radar and a panned scuttle say what is behind you. Dawn is 90 s. Three alarms and the run is over. Accent `#c4b5fd`.

## Controls

`meta.ts` will say: `scheme: "look"`, `touchControls: ["action"]`, `touchLabels: { action: "Flash" }`, `input: { drag: true }`.

- `keyboard`: "Drag the mouse, or hold A / D or the arrows, to turn; Space or E flashes". Changed from spec: a button-drag plus arrows, because a free mouse is not an `InputState` field.
- `touch`: "Drag to turn, Flash to burst" (the button reads Flash).
- Turn: held `moveX` at π rad/s. Not `stepAimKeys`: that helper snaps to a grid and waits 0.25 s. A canvas drag uses `followRelativeDrag` on yaw only (`min`/`max` ±Infinity, `dragGain = π / 140`, then wrap to (−π, π]); while it returns true the keys do not turn. `drag: true` so a look-drag is never a swipe. Flash on `actionPressed || jumpPressed`, one press. Esc / P pause (shell). `hudStats`: alarms (max 3) and flash cooldown.

## Rules

Numbers live in `rules.ts` (`RING`, `BEAM`, `FLASH`, `TYPES`, `PHASES`, `SCORE`) and are proved in `rules.test.ts`. One `useRunFrame`: input, then exhibits, then the clock.

- **Ring** (`RING`): 8 pedestals at r = 6, angles `(k + 0.5) · π/4`. Door at angle π, on the wall. Threshold point r = 5.2 at that angle (0.8 m inward of the ring). Guard circle r = 0.45 at the origin. An exhibit's centre stays at r ≥ 5.2, so it never meets the guard. Start yaw 0 (looking +z, door behind).
- **Roster:** 2 knight, 2 robot, 2 penguin, 2 dino. Seeded pedestal shuffle. Changed from spec: no bust and a fixed 8, because that GLB does not exist and the robot already hops at 0.8 m/s. Dino sneaks only from t ≥ 30. Pedestal top y = 0.8 (`PEDESTAL_TOP(0.8)`), width 0.8.
- **Path:** shortest arc on r = 6 toward the door's angle, then straight in to the threshold. Shortest path is 6 · π/8 + 0.8 = **3.156 m**. A dino is never seated on a pedestal whose path is under 4 m.
- **Types** (`TYPES`): knight 0.6 m/s, robot 0.8, penguin 1.0, dino 1.2. Penguin keeps its velocity for 0.4 s after the beam first hits, then stops. Circles: 0.35 / 0.28 / 0.25 / 0.45. These are rules radii, not mesh bounds.
- **Phases** (`PHASES`): 0–30 s, 30–60 s, 60–90 s. Speed ×1 / ×1.15 / ×1.25. Movers at once ≤ 2 / 3 / 3. Starts ≤ 6 / 7 / 8 (21 max). Min gap 4.2 / 3.6 / 3.2 s. First start ≥ 3.0 s. Changed from spec: at most 3 movers, not 4, because a fourth at the late speed is not recoverable after a 0.2 s reaction plus a half-turn.
- **Director:** when the gap has elapsed and a slot is free, start the still exhibit whose path is legal and whose bearing is outside the beam, preferring the one furthest from the door. At most one mover with path < 5 m. If every legal pedestal is inside the beam, wait up to 2 s, then start the furthest anyway. The choice reads the beam yaw at that frame (deterministic).
- **Beam** (`BEAM`): half-angle 16° / 14° / 12°, range 9. Coarse pointers ×1.2, clamped at 17°. `inViewCone` (inclusive edges). In the cone → frozen at once; continuously in the cone ≥ 0.7 s → returning at 3 m/s along the path home, and it finishes even if the beam leaves. Leaving during the 0.7 s resets the hold and it sneaks again. Changed from spec: 16/14/12 instead of 22 narrowing to 15, because at fov 70 a 390×844 phone's horizontal half-fov is about 18°, so 22° would freeze statues off the sides of the screen.
- **Flash** (`FLASH`): half-angle 45° (90° cone), 1.2 s, cooldown 10 s. While it lasts, anything in that cone counts as in the beam even after you turn. A press during cooldown is ignored.
- **Alarm:** centre within 0.45 m of the threshold while sneaking consumes one alarm and the exhibit is back on its pedestal, still. At 0 alarms, `end("lose")`.
- **Clock:** `durationMs: 90000`. The shell counts it down.

## Scoring

`runScore(seconds, returns, alarms, survived) = 5 · floor(seconds) + 50 · returns + (survived ? 150 · alarms : 0)`. Live: `addScore(5)` on each whole second, `addScore(50)` when a return reaches its pedestal. `setStat("alarms", n)`. `finalScore(state)` adds `150 * state.stats.alarms` only when `endReason === "timeup"`. A lose pays no dawn bonus. Maximum 5 · 90 + 50 · 21 + 150 · 3 = **1950**.

### Server limits and why they hold (the proof)

| | provisional (`meta.ts`, 02 §C.4) | proposed (Claude's limits PR; not this branch) |
|---|---|---|
| `maxScore` | 3900 | **2050** |
| duration | 10000–92000 ms | **10000–92000 ms** |
| `base` / `max_pps` | 3900 / 3900 | **0 / 25** |

`meta.ts` stays provisional until that PR. Proof plan: pure steps on one `fixedFrames(1000/60)` schedule per seed, then `simulateRun` for the store path:

1. **Starts:** ≤ 6 / 7 / 8, gaps 4.2 / 3.6 / 3.2, none before 3.0 s, no dino before 30 s, ≤ one short path (< 5 m) at a time, ≤ the phase's mover cap.
2. **Speed:** a step never exceeds `base · phase · dt`, except the penguin's 0.4 s coast at the speed it had. Returning is 3 m/s. r ≥ 5.2 always.
3. **Cone:** frozen on the inclusive edge, not 0.01° outside; the 0.7 s hold resets if the beam leaves; flash covers 45° for 1.2 s and then the cooldown rejects a press.
4. **Earliest lose:** three short penguins (3.156 m at 1.0 m/s) started at 3.0, 7.2 and 11.4 s escape at 6.16, 10.36 and **14.56 s**. Travel 3.16 s is under the 4.2 s gap, so the one-short rule does not delay this chain. 10000 ms is 4.5 s under 14.56 s. A long path only loses later.
5. **Dawn:** 21 returns + 3 alarms = 1950 at 90 s (21.7 pts/s). First legal return is at 3.7 s and scores 65 (17.6 pts/s). Every prefix stays ≤ 25 pts/s and ≤ 1950. `capScore` is a no-op. 2050 is 100 over the ceiling. Idle lose is the 14.56 s case with a small score, still inside the window.
6. **Human bot:** reaction 0.22 s (inside 0.15–0.25), turn at π rad/s toward the mover with the least time left, hold until returning, flash when two movers would arrive within 2.2 s and one is inside 45°. Worst catch, phase 3: a short penguin at 1.25 m/s, 157° off the start yaw, meets the beam with about 1.3 m of path left after its 0.4 s coast. Phase 1 leaves about 1.9 s. Keyboard and touch (140 px = 180°) each win ≥ 50 % of 30 seeds at 60 fps. A perfect sweeper on 10 seeds survives and scores ≤ 1950. Five more seeds use `randomFrames` (4–50 ms) for the limit only.

## Run end

- `"timeup"` by the shell at 90 s if alarms ≥ 1. That is the win (ranked). Dawn bonus via `finalScore`. `resultDelayMs: 1100`.
- `end("lose")` on the frame the third alarm is spent. Ranked, no dawn bonus. Same delay, so the red pulse is seen.
- A threshold cross on the frame the clock hits 0 is a timeup (the clock is applied first) and does not spend the alarm.

## Scene and camera

The mechanic is not seeing the whole ring, so the eye stays put. `useFittedView` fits the lit wedge only, and the returned distance is not a dolly. Area x [−2.2, 2.2], y [0, 2.4], z [0, 6.5] (16° at r = 6, knight head on the 0.8 plinth). `pitch` −8°, `yaws: [0]` (the fit never turns the gallery; the beam is the yaw). Look-at is 4 m along the beam at y = 1.04. Eye (0, 1.6, 0), fov 70. `<CameraRig follow={that point} followFraction={1}>` with the offset rewritten each frame so the camera stays on the eye. `shift: true`, padding 8, margin `{ top: 0.08, bottom: 0.06, left: 0.02, right: 0.02 }`. `looks.test.ts` runs `fitView` with the banner rect and the radar's `data-arcade-safe-area` (a corner box, not a full-width band). The Action button is not a band. Statue bob uses `useGameTime`.

Planned projection (not a measurement; the build replaces this after screenshots). Vertical px/m ≈ height / (2 · depth · tan 35°):

| | px/m near r = 4 | px/m far r = 6 | knight 1.6 far | penguin 0.8 far | beam ≥ |
|---|---|---|---|---|---|
| 390 × 844 | 151 | 100 | 161 px | 80 px | 24 px |
| 844 × 390 | 70 | 46 | 74 px | 37 px | 24 px |

`environment: { background: "#1e1b4b", fog: ["#1e1b4b", 18, 28], lighting: "night" }`. The spot is the kit `<Flashlight>` (mounted once, `light` on; the kit drops the light on the low tier). Beam mesh at y = 0.03, `depthWrite: false`. Freeze ring at y = 0.04. Both sit above the floor.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `finalScore`, `input.drag`, `touchControls`, `touchLabels`, `hudStats` for alarms and flash cooldown, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`moveX`, `drag`, `actionPressed`, `jumpPressed`), `followRelativeDrag` (`core/aim`), `useFittedView` + `fitView` + `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setStat`, `end`), `inViewCone` (`core/ai`), `hop` / `waddle` (`core/motion`), `withinServerLimits` / `capScore`, `simulateRun` / `fixedFrames` / `randomFrames` (`core/testing/botHarness`), `<Model material>` / `<HumanoidModel material>`, `idlePose`, `bodyLift`, `<Flashlight>` / `<Pedestal>` (`core/kit`), `<TargetMarkers>` (one arrow for the mover with the least time left, only while it is off-screen), `useFx` (`burst` sparks on a freeze, `shake` on an alarm), `useQuality` + `scaledCount`, `playSfx` / `startLoop`. Not used: Rapier, `core/path`, `Trail`. The schedule and the ring path are game-local.

## Assets

No generation. Nothing in this folder is loaded. Fits in `assets.ts` come from the core size constants and are rechecked on the real mesh in `assets.test.ts`. `REUSED_GLB_SIZE` is not on `origin/main`.

| id | class / source | drawn | rules | fallback |
|---|---|---|---|---|
| knight | C `EXPANSION_CHARACTERS.knight`, `material: "stone"`, `<HumanoidModel>` | 1.6 m (`1.6 / 1.884`) | r 0.35 | capsule |
| robot | D `SHARED_ASSETS.robot`, `material: "gold"`, `<HumanoidModel>` | 1.2 m (scale 1.2/1.72; collector records the mesh at 1.72, remeasured here) | r 0.28 | capsule |
| penguin | C `EXPANSION_ASSETS.penguin`, `material: "bronze"` | 0.8 m (the asset's own scale) | r 0.25 | capsule |
| dino | C `EXPANSION_ASSETS.dino`, `material: "bone"` | 1.1 long, 0.8 tall (the asset's own scale) | r 0.45 | capsule |
| door | D `REUSED_ASSETS.door` | 2.1 m tall; scale from the mesh at build | none | box |
| bench | D `REUSED_ASSETS.bench` | decor, clean-city's GLB, rechecked | none | box |
| procedural | B: floor, wall, skylight, instanced pedestals, painting atlas, two lathe vases, velvet-rope posts, beam cone, freeze ring | | | |

Knight and robot are humanoids (`KNIGHT_LANDMARKS`, `ROBOT_LANDMARKS`): `idlePose`, `bodyLift`, soles on the pedestal within 1 cm, never a T-pose. A sneak bobs the group with `hop`. Penguin and dino are not humanoids: `<Model>` plus `waddle` / a slide offset. Changed from spec: those two use `HumanoidModel`, because they are rigged and a static mesh would be a T-pose. `tint` is one of three cached colours (still none, sneaking `#fb7185`, frozen `#6ee7b7`), swapped on a state change. Bench and dust motes hide on the low tier. The bust is catalog E; `assets.spec.json` records its recipe and does not authorize a generation, and the build does not load it.

## Files

`meta.ts` · `index.tsx` · `rules.ts` · `rules.test.ts` · `looks.ts` · `looks.test.ts` · `poses.ts` · `poses.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Gallery.tsx` · `Hud.tsx` + `Hud.module.css` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail later, via `tools/thumbs`.

## Test plan

`rules.test.ts` under ~600 lines and under ~60 s. One frame schedule per seed. Pins are literals (`BEAM` half-angles, 0.7, 3.156, 21, 1950, 14.56).

- **Cone and hold:** inclusive edge freezes; 0.01° outside does not; hold resets; penguin coasts 0.4 s then stops; return finishes after the beam leaves; flash 45° / 1.2 s / 10 s cooldown.
- **Director:** caps, gaps, first start ≥ 3, no early dino, one short path, determinism for a fixed yaw trace.
- **Body:** r ≥ 5.2 for 20,000 steps; three short penguins with no input lose at 14.56 s, not before.
- **Score:** `runScore`; every prefix ≤ 25 pts/s and ≤ 1950; `withinServerLimits`; `capScore` unchanged. Perfect bot (10 seeds, 60 fps) survives at ≤ 1950. Human bot (30 seeds, 60 fps) wins ≥ 50 % on keyboard and on the touch gain. Five jitter seeds stay inside the limits.
- `assets.test.ts`: drawn heights on the real meshes (1.6 / 1.2 / 0.8 / dino 1.1 long). `poses.test.ts`: knight and robot soles within 1 cm, arms down. `looks.test.ts`: far penguin ≥ 24 CSS px at 390×844 and 844×390 with the banner rect in `fitView`.

## Performance

Target **36** draw calls (spec ≈ 40), cap **50**. Room 3, pedestals 1 (instanced; not eight `<Pedestal>`), paintings 1, vases 1, rope 2, door 1, bench 1, statues 8, beam 1, blobs 1, fx ≤ 2. One spot light, mounted with the scene. `useFx().warm("sparkle")` on mount; a freeze calls `burst("sparkle")`. No per-frame allocation: one scratch cone query, a fixed array of 8, the drag aim object created once.

## Audio

`startLoop("ambient", { volume: 0.2 })` in a `useEffect` on `[phase, muted]`, cleared on cleanup, so pause and mute can start it again. Scuttle `playSfx("click", { pan: sin(bearing), pitch })` at most every 0.5 s per mover. Freeze `"chime"`, return `"whoosh"`, alarm `"alarm"`, dawn `"chime"` at pitch 1.4.

## Accessibility

Radar shapes (square, circle, triangle, diamond), not colour alone; sneaking is an outline, frozen is a fill. Panned scuttle. Coarse beam +20 % up to 17°. Flash is the safety valve and its cooldown is a number, not only a colour. HUD text `#f8fafc` on `rgba(15, 23, 42, 0.92)`. The radar is a 132 px box, left 12 px, bottom clear of the banner, `data-arcade-safe-area`, below the shell chips on both 390×844 and 844×390. `fx.shake` honours reduced motion.

## Risks and open questions

Decisions already made, so a build can start: narrower beam, mover cap 3, no bust, eye camera with no dolly, limits 2050 / 0 / 25. The px table is a projection, not a screenshot. Door and bench scales are measured at build time because `REUSED_GLB_SIZE` is absent. The shell plays its lose sting on any end that is not `"win"` (`GameShell`); dawn stays `"timeup"`, as the spec requires, so that sting plays over the dawn chime. `playedFrameDt` lives in `core/frameLoop`, and `simulateRun` is what the store bots call.

## Status

Design only. `status` stays `"dev"`. No thumbnail.
