# Construction Worker

Owner: Cursor. Slug: `construction-worker`. Adventure game 9 (order 19), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §9. Gate G0. Units: metres, seconds; x east, z south, y up. Every "Changed from spec" line says what and why. P-15 watch-out: swing energy never grows.

## Concept

A toy building site in daylight. The player runs the tower crane: read the next blueprint step, pick that material from the yard, and swing the hook over the glowing slot. The hook is a damped pendulum, so the drop is a timing skill. The worker (the shared runner in a procedural hard hat) stands by the mast and cheers each finished floor. Three buildings, then the clock. Accent `#fbbf24`.

## Controls

`meta.ts` stays as the stub: `scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`. No `touchLabels` (the Action button keeps the word Action, which is what the touch string says). No `durationMs` (the clock can lose a second; Rules).

- `keyboard`: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile" (unchanged). Arrow keys hit the same axes because `useInput` maps arrows and WASD together.
- `touch`: "Joystick, Action to drop, tap a pile" (unchanged).
- Input: `moveX` rotates the jib (D / right = +, A / left = −). `moveY` drives the trolley (W / up = −1 = radius out, S / down = in). Drop on `jumpPressed || actionPressed` (Space is `jump`, the Action button is `action`); one drop per press. Piles: `digit` 1–5, or `tap` (release, not `tapDown`) on a pile. `digit` 6–9 is ignored. A tap inside two pile boxes picks the nearer centre. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`SITE`, `CRANE`, `PENDULUM`, `DROP`, `STABLE`, `SCORE`, `WIND`, `CLOCK`) and are proven in `rules.test.ts`. The crane and the pendulum integrate only inside `fixedStep` (`createFixedStep(1/120)` once). `playedFrameDt` is at most 1/20 s, so a frame is at most 6 steps and never hits the 8-step discard.

- **Site** (`SITE`): ground x ∈ [−15, 15], z ∈ [−12, 12] (30 × 24). Crane mast at the origin, angle 0 facing +z. Start trolley `(angle 0, radius 4.5)`.
- **Crane** (`CRANE`): polar `(angle, radius)`. Radius ∈ [4.5, 11]. Max |ω| 0.9 rad/s, angular accel 1.8 rad/s². Trolley max 2.5 m/s, accel 5 m/s². Jib at y = 10, length 12 (mast plus jib reads about 14). Angle and radius change together; a step never exceeds `0.9 · dt` rad or `2.5 · dt` metres (the speed cap is the travel bound; accel only makes real runs slower).
- **Piles:** five, at radius 7, angles −0.45, −0.15, 0, 0.15, 0.45 (slab, pillar, wall, window, roof, keys 1–5). Pickup: the hook is within 0.8 m of that pile's centre, `|swing|` < 0.1 rad on both axes, trolley speed < 0.15 m/s, and that dwell lasts 0.25 s. A wrong kind is refused: no piece, no stability loss, `timeLeft −= 1`, and pick/drop inputs lock for that same 1 s (the clock cannot be burned faster than play time). A carried piece blocks another pick.
- **Slots:** four xz points at radius 9.5, angles −0.45, −0.15, 0.15, 0.45, stacked in y. Floor step 0.75: house 2 floors (8), shop 3 (12), tower 4 (16). Counts per building: house 2/2/2/1/1, shop 3/3/3/2/1, tower 4/4/4/3/1 of slab/pillar/wall/window/roof. Piece footprint 1.2. Neighbours are 0.3 rad apart (2.85 m at radius 9.5). Tower top is y = 3, hook rest is y = 4.5, so the jib stays clear. The seed picks `windowStyle` and `roofStyle` (0 or 1) for the mesh only. Changed from spec: variants do not move slots or reshuffle the order, because every haul is then exactly 2.5 m of radius.
- **Pendulum** (`PENDULUM`): `stepPendulum2D`, `{ length: 5.5, gravity: 9.81, damping: 0.55 }`. Pivot acceleration is the trolley's and the jib's horizontal acceleration, plus wind. Small-angle offset ≈ `5.5 · angle`. After each step, `|angle|` clamps to 0.35 rad and an outward angular speed is zeroed. Changed from spec: the core helper is the linear small-angle model, so a larger swing would leave that model; the clamp only removes energy.
- **Wind** (`WIND`): from the first tower piece, a gust every 7 s lasting 1.0 s adds 3 m/s² along +x to the pivot acceleration. Coarse pointers use damping 1.4 instead of 0.55 (the assist). The Scene passes the damping in; tests use 0.55.
- **Drop** (`DROP`): release adds the swing's horizontal velocity to the trolley's. Fall time is `sqrt(2 · height / 9.81)` down to the slot top (looks; the crane may already move). Landing offset is the horizontal distance from the slot centre. Perfect < 0.15, good < 0.35, ok < 0.6, else a miss (bounces, same step retries, piece leaves the hook). Tower multiplies the three bands by 0.8 (0.12 / 0.28 / 0.48).
- **Stability** (`STABLE`): 100 at the start of each building. Perfect / good / ok / miss = 0 / −3 / −6 / −12. At ≤ 0 the building collapses. Changed from spec (0 / −5 / −10 / −15): 12 and 16 ok placements at −10 exceed 100, and the spec's own DoD says a novice finishing on ok must not be forced to 0. All-ok leaves 52 / 28 / 4.
- **Clock** (`CLOCK`): 150 s in `rules.ts`, shown as a HUD stat. No `durationMs`. `end("timeup")` when `timeLeft` hits 0. Play time and `timeLeft` stay in step, including the 1 s wrong-pile lock.

## Scoring

`points(rating) = 100 | 60 | 30 | 0`. `+500` when a building's last placed piece leaves stability > 0. A miss never places, so it never completes a building. On `end("win")` only, `+5 · floor(timeLeft)`. Live `addScore` for the piece and the building; the time bonus is added in the same callback as `end("win")`. No streak points (a perfect streak only raises the chime pitch).

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, still in `meta.ts`) | proposed (Claude applies; this branch does not edit `meta.ts`) |
|---|---|---|
| `maxScore` | 9000 | **5600** |
| duration | 20000–152000 ms | **15000–152000 ms** |
| `base` / `max_pps` | 9000 / 9000 | **0 / 80** |

The provisional 20 s floor would reject a legal collapse (below). The ceiling ignores dwell and accel (both only add time):

1. **Speed.** `stepCrane` never moves more than `0.9 · dt` rad or `2.5 · dt` metres (random steps, random dt).
2. **Haul.** Piles sit at radius 7, every slot at radius 9.5, the trolley starts at 4.5. Every approach and every haul is ≥ 2.5 / 2.5 = **1 s**, and a miss or a place empties the hook, so each of the 36 pieces pays both legs. 36 · 2 = **72 s** before a win. `floor(150 − 72) = 78` s left → 5100 + 5 · 78 = **5490**. Angle travel can only add time (the closest pile and slot share an angle).
3. **Dwell.** The real pickup waits 0.25 s, so a run that uses `stepRun` takes ≥ 72 + 36 · 0.25 = **81 s** and scores ≤ 5100 + 5 · 69 = **5445**. The limits use 5490 so a shorter dwell later still fits.
4. **Chord.** `80 · 72 = 5760 ≥ 5490`. Later wins score less (the bonus shrinks) while the chord grows. `capScore` is a no-op on every legal run. `maxScore` 5600 sits 110 above 5490.
5. **Collapse.** Miss −12, so the 9th miss ends the run. That is ≥ 18 s. `minDurationMs` 15000 is 3 s under it. A time-up is exactly 150 s of play (≤ 152 s). A lose or a time-up has no time bonus, so it scores ≤ 35 · 100 + 2 · 500 = 4500.

The store bot (oracle: correct pile, centre the trolley, drop at swing angle 0) goes through `simulateRun` at 60 fps, 20 fps and random 4–50 ms frames. It must win at ≥ 81 s with score ≤ 5445 and pass `withinServerLimits`.

## Run end

- `end("win")` on the frame the tower's last placed piece leaves stability > 0, time bonus included. `resultDelayMs: 1100` (cheer, or the collapse).
- `end("lose")` when stability hits ≤ 0 after a drop. The piece is shown in the collapse. No building bonus, no time bonus.
- `end("timeup")` when the game clock hits 0 (the shell is not given `durationMs`). Points already scored stand.
- Same frame as the clock running out: the clock is applied before the drop resolves, so it is a time-up.

## Scene and camera

- **Fixed 3/4, pitch 40°, with a slight lift as the roof grows.** One sentence: the whole yard and the tower have to stay readable, and the hook only borrows a little of the frame as it rises. `useFittedView({ area: x −16..16, y 0..12, z −13..13, pitch: 40°, yaws: [0.6, 0.6 + π/2], margin: { top: 0.10, bottom: 0.08, left: 0.02, right: 0.02 }, padding: 8, shift: true, fov: 42 })`. Look-at xz is the site centre; look-at y is `0.35 · roofHeight`. `<CameraRig follow={that point} followFraction={1} offset shift damping={6}>`. The follow point is what makes ShellStage's static rig lose: a rig with no follow never moves the camera again after its mount effect. Changed from a purely static camera for that reason; the point itself only moves up.
- **Worker** at (3.2, 0, −1), yaw toward +z, `SHARED_ASSETS.runner` scale 0.825 (1.556 m), `applyLift={false}`, group y = `bodyLift × 0.825`. `idlePose` while waiting, a game-local `pointPose` (`aimArm` forward) while a piece is on the hook, `cheerPose` for 1.2 s when a building completes. Hard hat on `attach={{ head }}` (crown + brim, yellow `#fbbf24`); the stand-in wears its own.
- Guide: a vertical line from the hook to the ground, mint `#6ee7b7` when the horizontal offset is inside the ok band, slate otherwise, plus a blob under the carried piece. Slot: emissive frame, not a light.
- `environment: { background: "#e7e5e4", fog: ["#e7e5e4", 40, 80], lighting: "day" }`.

## Core helpers used

`GameDefinition` (`resultDelayMs`, no `durationMs`, `touchControls`, `hudStats` for time / stability / building, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`moveX`, `moveY`, `jumpPressed`, `actionPressed`, `digit`, `tap`), `useFittedView`, `CameraRig`, `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setStat`, `end`), `core/kinematics` (`stepPendulum2D`, `createFixedStep`, `fixedStep`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`; tests only), rig (`<HumanoidModel attach={{ head }}>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `bodyLift`, `RUNNER_LANDMARKS`), `core/kit` `Fence`, `core/fx` (`useFx`: `burst` sparkle / puff / confetti, `score`, `shake`, `warm`), `useCanvasTexture` (brick, concrete), `<Instanced>` / `<DynamicInstanced>`, `BlobShadow`, `useQuality` + `scaledCount`, `SHARED_ASSETS.runner` / `SHARED_ASSETS.crate`, `REUSED_ASSETS.pallet` / `REUSED_ASSETS.van`, P-06 `playSfx` / `startLoop`. Not used: Rapier, `core/path`, `core/ai`, `Trail`. The polar crane step is game-local; the pendulum is not reimplemented.

## Assets

No new generation. This game owns no GLB. `assets.spec.json` is an empty `assets` list. The catalog's cement mixer is class E, priority P3, and is out of this build.

| id | class / source | target in game | fallback |
|---|---|---|---|
| worker | D `SHARED_ASSETS.runner` 0.825 + B hat on `attach.head` | 1.556 m | capsule + hat |
| pallet | D `REUSED_ASSETS.pallet`, instanced under the five piles | fitted to a 1.2 × 0.15 × 0.8 footprint | box |
| crate | D `SHARED_ASSETS.crate`, instanced, 4 in the yard | 0.8 cube | box |
| van | D `REUSED_ASSETS.van`, parked at (12, 0, −8), decor | ~4.5 long, outside the swing | box |
| procedural | B: mast and jib (instanced lattice), cable, hook, five piles, slabs, pillars, brick walls (`useCanvasTexture`), glass windows, roofs, fence (`Fence`), ground, guide line, slot frame, hard hat | | |

Fits are measured in `assets.ts` from the GLB bounds. Van and extra crates drop out when `useQuality().decor` scales them to 0; the worker stays (the cheer is the win read). Piles, pieces and the crane stay at every tier.

## Files

`meta.ts` (data; scoring unchanged until Claude's limits PR) · `index.tsx` (`GameDefinition`) · `rules.ts` (crane, pendulum step, pickup, drop, stability, clock, score; pure, seeded) · `rules.test.ts` · `poses.ts` (`pointPose`, blend into `cheerPose`; `poses.test.ts` on the real runner) · `assets.ts` + `assets.test.ts` · `Scene.tsx` (one `useRunFrame`, camera, worker, fx, audio) · `Crane.tsx` · `Site.tsx` (ground, fence, van, pallets, crates, piles) · `Pieces.tsx` (instanced placed pieces, the carried piece, the guide) · `Primitives.tsx` (stand-ins, hat) · `assets.spec.json` · `README.md`. Thumbnail and `tools/thumbs/inputs/construction-worker.mjs` belong to the build, not this gate.

## Test plan

`rules.test.ts` ≤ ~600 lines. The layout is fixed, so the proof does not need 200 random islands; 20 seeds × three frame modes checks that style variants do not move slots.

- **Pins:** `CRANE`, `PENDULUM`, `DROP`, `STABLE`, `CLOCK` equal their literals.
- **Energy:** with pivot acceleration 0, `E = Σ (½ v² + ½ (g/L) angle²)` after `stepPendulum2D` is ≤ E before, at dt 1/60, 1/20 and random 4–50 ms, clamped and unclamped. A scripted accel through `fixedStep` matches a 120 Hz reference within 1e-4 at those three frame sizes (energy does not grow from the frame rate). A gust or a trolley accel may raise E; a zero-accel tail then decays.
- **Ratings:** just inside / just outside 0.15, 0.35, 0.6, and the tower's 0.8 bands. A miss retries the same step.
- **Stability:** all-ok leaves 52 / 28 / 4; the 9th miss collapses; a wrong pile changes neither stability nor the carried piece and subtracts 1 s.
- **Slots:** every blueprint slot is one of the four radius-9.5 points; both style seeds keep the same positions; the tower top is y = 3.
- **Speed and score:** the speed cap; the 72 s / 5490 ceiling; the dwell bot on the real store (≥ 81 s, ≤ 5445, `withinServerLimits`, `capScore` unchanged) at 60 fps, 20 fps and random frames; an idle crane times out at 150 s with score 0; spam input stays inside the limits.
- `poses.test.ts`: soles within 1 cm in idle, point and cheer; the hat within 1 cm of the head anchor. `assets.test.ts`: worker height 1.556 m on the real mesh.

## Performance

Target **40** draw calls, cap **50** (the spec's estimate is ≈ 45; the hard cap is 150). Lattice 2, cable + hook 2, five piece kinds instanced 5, carried piece 1, piles 5, fence 2, ground 1, van 1, pallets 1, crates 1, worker 2 + hat 1, guide 1, slot 1, blob 1, fx ≤ 3, one score sprite → about 32. Lights: the `day` preset only. `fx.warm("sparkle", "puff", "confetti", "score")` on mount. No per-frame allocation. The build writes `?perf=1` back here.

## Audio

P-06 is on main. `startLoop("engine", { volume: 0.3 })` while playing; `set({ pitch })` from jib and trolley speed (the shell stops it on pause, over and mute). Cable: `playSfx("click", { pitch: 0.6, volume: 0.2 })` at most every 0.4 s while `|angle| > 0.08`. Landing `playSfx("thud", { pitch })` by rating (perfect 1.3, good 1.1, ok 0.9, miss 0.7); perfect also `playSfx("chime", { pitch: 1 + 0.08 · min(streak, 5) })`. Wrong pile `playSfx("buzz")`. Collapse `playSfx("boom")` plus `fx.shake(0.6)`. Win and lose stingers stay with the shell.

## Accessibility

The guide line is a shape, not only a colour: mint inside the ok band, slate outside, and the swing's amplitude is a HUD chip. "Steady crane" raises damping on a coarse pointer. Piles are chosen by key 1–5 or by a tap whose box is at least 64 px (nearest centre wins when boxes overlap). The blueprint chip shows the piece name, not a colour alone. `fx.shake` honours reduced motion (core).

## Risks and open questions

- Decisions taken here: stability 0/−3/−6/−12 so all-ok finishes; slots fixed so the haul is ≥ 1 s; swing clamped at 0.35 rad because `stepPendulum2D` is linear; no cement mixer; min duration 15 s so a fast collapse still submits; the camera follows a point that only rises, so the shell rig cannot pin `definition.camera`.
- Pile centres are 2.4 m apart. On a phone their 64 px boxes can overlap; nearest-wins is the rule, and the build checks it at 390 × 844.
- The 72 s ceiling omits dwell on purpose. The store bot uses the real 0.25 s dwell and must come in slower.
- Open for Claude: apply **5600 / 15000–152000 / base 0 / pps 80** to `meta.ts` and `arcade-games.json` in the limits PR. Nothing else blocks the build.

## Status

Not built. `status` stays `"dev"`.
