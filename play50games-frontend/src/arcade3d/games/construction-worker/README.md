# Construction Worker

Owner: Cursor. Slug: `construction-worker`. Adventure game 9 (order 19), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §9. Gate G0. Units: metres, seconds; x east, z south, y up. Every "Changed from spec" line says what and why. P-15 watch-out: swing energy never grows.

## Concept

A toy building site in daylight. The player runs the tower crane: read the next blueprint step, pick that material from the yard, and swing the hook over the glowing slot. The hook is a damped pendulum, so the drop is a timing skill. The worker (the shared runner in a procedural hard hat) stands by the mast and cheers each finished floor. Three buildings on one plot, then the clock. Accent `#fbbf24`.

## Controls

`meta.ts` stays as the stub: `scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`. No `touchLabels`. No `durationMs` (a wrong pile takes a second off the clock; Rules).

- `keyboard`: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile" (unchanged). Arrows hit the same axes as WASD.
- `touch`: "Joystick, Action to drop, tap a pile" (unchanged).
- Input: `moveX` rotates the jib (D / right = +). `moveY` drives the trolley (W / up = −1 = radius out). Drop on `jumpPressed || actionPressed`, and only when the trolley is inside the drop gate (a press outside it is ignored, not a miss). Piles: `digit` 1–5, or `tap` (release, not `tapDown`). `digit` 6–9 is ignored. Two boxes: the nearer centre wins. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`SITE`, `CRANE`, `PENDULUM`, `DROP`, `STABLE`, `SCORE`, `WIND`, `CLOCK`) and are proven in `rules.test.ts`. The crane and the pendulum integrate only inside `fixedStep` (`createFixedStep(1/120)` once). `playedFrameDt` is at most 1/20 s, so a frame is at most 6 steps and never hits the 8-step discard.

- **Site:** ground of the fitted wedge, x ∈ [−8, 8], z ∈ [−2, 12]. Mast at the origin, angle 0 facing +z. Start trolley `(angle 0, radius 4.5)`.
- **Crane:** polar `(angle, radius)`. Radius ∈ [4.5, 11]. Angle ∈ [−0.70, 0.70] (the yard arc; the jib does not spin a full circle). Max |ω| 0.9 rad/s, angular accel 1.8 rad/s². Trolley max 2.5 m/s, accel 5 m/s². Jib at y = 10. A step never exceeds `0.9 · dt` rad or `2.5 · dt` metres.
- **Piles:** five, at radius 7, angles −0.45, −0.15, 0, 0.15, 0.45 (slab, pillar, wall, window, roof, keys 1–5). Chord 1.05 m between the 0.15 rad pairs and 2.10 m between the 0.30 rad pairs. Pickup radius is **0.45 m** (0.45 + 0.45 = 0.90 < 1.05, so the discs do not overlap). Changed from the 0.8 m radius, which overlapped the close pair. A pickup starts only when the trolley radius is ≤ **7.8**, the hook is inside that 0.45 m disc, and trolley speed < 0.15 m/s; the dwell is 0.25 s. No swing test on pickup. A carried piece blocks another pick.
- **Wrong pile:** refused on the key or the tap, immediately, not at the end of a dwell. No piece, no stability loss, `timeLeft −= 1`, and pick/drop lock for 1 s. The clock keeps ticking during that lock, so the wrong pile costs about 2 s of clock and 1 s of play.
- **Slots:** four xz points at radius 9.5, angles −0.45, −0.15, 0.15, 0.45. The blueprint walks them in angle order and wraps, so a step is 0.30 rad (0.33 s at 0.9 rad/s), which hides inside the 0.44 s radius leg. Floor step 0.75. House 2 floors (8 pieces: 2/2/2/1/1), shop 3 (12: 3/3/3/2/1), tower 4 (16: 4/4/4/3/1) of slab/pillar/wall/window/roof. Changed from spec: all three buildings use these same four points, not three plots in a row, so every haul has the same radius gate. A finished building stays through the 1.2 s cheer, then its pieces leave and the next building starts again at y = 0 on the same points. Stability resets to 100. Tower top is y = 3. The seed picks `windowStyle` and `roofStyle` (0 or 1) for the mesh only.
- **Drop gate (trolley, not the hook):** a drop is accepted only at trolley radius ≥ **8.9** (house and shop) or ≥ **8.98** (tower). Inside that radius the press does nothing. Release adds the swing's horizontal velocity to the trolley's. Fall time is `sqrt(2 · height / 9.81)` (looks; the crane may already move). Landing offset is the horizontal distance from the slot centre. Perfect < 0.15, good < 0.35, ok < 0.6, else a miss (bounces, same step retries, piece leaves the hook). Tower multiplies the three bands by 0.8 (0.12 / 0.28 / 0.48).
- **Pendulum:** `stepPendulum2D`, `{ length: 5.5, gravity: 9.81, damping: 0.55 }`. The pivot acceleration is the trolley's linear accel, plus the jib's tangential accel, plus centripetal `ω² · r` along the radius, plus wind. **Centripetal is included.** That xz vector is then scaled down to **2.5 m/s²** if it is longer (`a/g ≤ 0.25`, so the driven equilibrium is ≤ 0.25 rad). Changed from feeding the raw jib accel (1.8 rad/s² · 9.5 m ≈ 17 m/s², equilibrium ≈ 1.7 rad), which sat on the clamp at every start and stop. After both axes, if the angle's **magnitude** exceeds 0.35 rad, both axes scale down to 0.35 and the outward angular speed (along the angle vector) is zeroed. The clamp is on the magnitude, not per axis: per axis would let a diagonal reach 0.49 rad. It is a safety for the linear model, not the resting state. Small-angle offset ≈ `5.5 · angle`.
- **Wind:** from the first tower piece, a gust every 7 s lasting 1.0 s adds 3 m/s² along +x, then the 2.5 m/s² cap still applies. Coarse pointers use damping 1.4 instead of 0.55. Tests use 0.55.
- **Stability:** 100 at the start of each building. Perfect / good / ok / miss = 0 / −3 / −6 / −12. At ≤ 0 the building collapses (9th miss). Changed from spec (0 / −5 / −10 / −15): 12 and 16 ok placements at −10 exceed 100, and the DoD says a novice finishing on ok must not be forced to 0. All-ok leaves 52 / 28 / 4.
- **Playability:** damping stays 0.55. A 0.35 rad swing takes ~4.6 s to fall under 0.1 rad, which over 36 pickups would pass 150 s. Changed from the previous draft: pickup does **not** require `|swing| < 0.1`. The settle wait is not on the haul. The drop is still the timing skill.
- **Clock:** 150 s in `rules.ts`, a HUD stat. No `durationMs`. `end("timeup")` when `timeLeft` hits 0. That is at most 150 s of play, and sooner by every wrong pile. It is not exactly 150 s.

## Scoring

`points(rating) = 100 | 60 | 30 | 0`. `+500` when a building's last placed piece leaves stability > 0. A miss never places. On `end("win")` only, `+5 · floor(timeLeft)`. Live `addScore` for the piece and the building; the time bonus is in the same callback as `end("win")`. No streak points (a perfect streak only raises the chime pitch).

### Server limits and why they hold (the proof)

| | provisional (`meta.ts`, unchanged here) | proposed |
|---|---|---|
| `maxScore` | 9000 | **5800** |
| duration | 20000–152000 ms | **9000–152000 ms** |
| `base` / `max_pps` | 9000 / 9000 | **0 / 150** |

The gates are on the trolley, so the hook and the throw cannot shorten the haul. Pickup only at r ≤ 7.8, drop only at r ≥ 8.9. The gap is 1.1 m. At 2.5 m/s that leg is 0.44 s. Out and back plus the 0.25 s dwell is **1.13 s** a piece. The opening 4.5 → 7.8 is 1.32 s, which is 0.88 s more than one return leg, paid once: `t(k) = 0.88 + 1.13 · k`. Angle steps are 0.30 rad and hide inside the leg. Tower's 8.98 gate is a longer haul; the ceiling uses 1.1 m for every piece.

1. **House alone.** k = 8, t = 9.92 s, score = 800 + 500 = **1300** (no time bonus). 1300 / 9.92 = 131 pts/s. `150 · 9.92 = 1488 ≥ 1300`, and `150 · 9 = 1350 ≥ 1300`.
2. **Win.** k = 36, t = 41.56 s. `floor(150 − 41.56) = 108` s left → 3600 + 1500 + 5 · 108 = **5640**. 5640 / 41.56 = 136 pts/s. `150 · 41.56 = 6234 ≥ 5640`. Shop's bonus at k = 20 is 3000 points at 23.5 s (128 pts/s), under the same chord.
3. **Cap.** `maxScore` 5800 is 160 above 5640. `capScore` is a no-op on every legal run. `base` is 0 because the house burst is what sets pps, not a flat base.
4. **Collapse.** Nine misses: `t(9) = 11.05 s`. `minDurationMs` 9000 is under that. A time-up is ≤ 150 s of play (≤ 152 s). A lose or a time-up has no time bonus, so it scores ≤ 35 · 100 + 2 · 500 = 4500.

The store bot (correct pile, trolley on the 7.8 / 8.9 gates, drop at swing angle 0) goes through `simulateRun` at 60 fps, 20 fps and random 4–50 ms frames. It must win at ≥ 41.5 s with score ≤ 5640, and the house must be ≤ 1300 at ≥ 9.9 s. Both pass `withinServerLimits`.

## Run end

- `end("win")` on the frame the tower's last placed piece leaves stability > 0, time bonus included. `resultDelayMs: 1100`.
- `end("lose")` when stability hits ≤ 0 after a drop. No building bonus, no time bonus.
- `end("timeup")` when `timeLeft` hits 0. The shell has no `durationMs`. Points already scored stand. Same frame as a drop: the clock is applied first, so it is a time-up.

## Scene and camera

The fit is the yard wedge, not the 30 × 24 site. One sentence: the crane's working reach has to be large enough to read the hook and the ok band on a phone. `useFittedView({ area: x −8..8, y 0..4.5, z −2..12, pitch: 40°, yaws: [0.6, 0.6 + π/2], margin: { top: 0.10, bottom: 0.08, left: 0.02, right: 0.02 }, padding: 8, shift: true, fov: 42 })`. Portrait uses yaw 0.6; the short wide phone uses `0.6 + π/2`. Look-at xz is the wedge centre; look-at y is `0.35 · roofHeight` (roof ≤ 3). `<CameraRig follow={that point} followFraction={1} offset shift damping={6}>`, so ShellStage's static rig cannot pin `definition.camera`. The jib above y 4.5 may leave the top of the frame. The hook block is drawn **1.2 m** tall so it clears 12 px where the ok band clears 6 px.

Projected with the banner open (390 × 844 cover 162 px, 844 × 390 cover 83 px):

| | px/m | hook 1.2 m | slot 1.2 m | worker 1.56 m | ok 0.6 m | perfect 0.15 m |
|---|---|---|---|---|---|---|
| 390 × 844 | 16 | 19 | 19 | 24 | 9 | 2 |
| 844 × 390 | 10 | 12 | 12 | 16 | 6 | 1.5 |

- **Worker** at (3.2, 0, −1), yaw toward +z, `SHARED_ASSETS.runner` scale 0.825 (1.556 m), `applyLift={false}`, group y = `bodyLift × 0.825`. `idlePose`, a game-local `pointPose` (`aimArm`) while a piece is on the hook, `cheerPose` for 1.2 s when a building completes. Hard hat on `attach={{ head }}` (`#fbbf24`).
- Guide line, mint `#6ee7b7` inside the ok band, slate outside, plus a blob under the carried piece. Slot: emissive frame, not a light.
- `environment: { background: "#e7e5e4", fog: ["#e7e5e4", 28, 55], lighting: "day" }`. The van sits behind the mast at (0, 0, −1.5), inside the wedge and outside the pickup discs.

## Core helpers used

`GameDefinition` (`resultDelayMs`, no `durationMs`, `touchControls`, `hudStats` for time / stability / building / swing amplitude, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`moveX`, `moveY`, `jumpPressed`, `actionPressed`, `digit`, `tap`), `useFittedView`, `CameraRig`, `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setStat`, `end`), `core/kinematics` (`stepPendulum2D`, `createFixedStep`, `fixedStep`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`; tests only), rig (`<HumanoidModel attach={{ head }}>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `bodyLift`, `RUNNER_LANDMARKS`), `core/kit` `Fence`, `core/fx` (`burst` sparkle / puff / confetti, `score`, `shake`, `warm`), `useCanvasTexture`, `<Instanced>` / `<DynamicInstanced>`, `BlobShadow`, `useQuality` + `scaledCount`, `SHARED_ASSETS.runner` / `SHARED_ASSETS.crate`, `REUSED_ASSETS.pallet` / `REUSED_ASSETS.van`, P-06 `playSfx` / `startLoop`. Not used: Rapier, `core/path`, `core/ai`, `Trail`. The polar crane step is game-local; the pendulum is not reimplemented.

## Assets

No new generation. This game owns no GLB. `assets.spec.json` has an empty `assets` list. The catalog cement mixer (class E, P3) is out.

| id | class / source | target in game | fallback |
|---|---|---|---|
| worker | D `SHARED_ASSETS.runner` 0.825 + B hat on `attach.head` | 1.556 m | capsule + hat |
| pallet | D `REUSED_ASSETS.pallet`, instanced under the five piles | 1.2 × 0.15 × 0.8 | box |
| crate | D `SHARED_ASSETS.crate`, instanced, 4 in the yard | 0.8 cube | box |
| van | D `REUSED_ASSETS.van`, behind the mast | ~4.5 long | box |
| procedural | B: mast and jib, cable, 1.2 m hook block, five piles, pieces, fence, ground, guide, slot frame, hard hat | | |

Van and extra crates drop out when `useQuality().decor` scales them to 0. The worker, piles, pieces and crane stay at every tier.

## Files

`meta.ts` (scoring unchanged until Claude's limits PR) · `index.tsx` · `rules.ts` · `rules.test.ts` · `poses.ts` (`pointPose`; `poses.test.ts`) · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Crane.tsx` · `Site.tsx` · `Pieces.tsx` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail and the thumbs input belong to the build.

## Test plan

`rules.test.ts` ≤ ~600 lines. 20 seeds × three frame modes: style variants do not move slots.

- **Pins:** `CRANE`, `PENDULUM`, `DROP`, `STABLE`, `CLOCK`, the 7.8 / 8.9 / 8.98 gates, pickup radius 0.45.
- **Energy:** with pivot acceleration 0, E after `stepPendulum2D` is ≤ E before. A scripted accel through `fixedStep` matches a 120 Hz reference within 1e-4. The 2.5 m/s² cap holds for a full-speed start (raw `ω²r` and `α · r` would exceed it). Magnitude clamp: a diagonal does not pass 0.35.
- **Ratings and gates:** bands, including the tower's 0.8. A drop at r 8.89 does nothing; at 8.9 it resolves. Tower drop opens at 8.98. A miss retries the same step. Pickup discs of the 1.05 m pair do not overlap.
- **Stability:** all-ok leaves 52 / 28 / 4; the 9th miss collapses; a wrong key refuses at once, subtracts 1 s, and does not start a dwell.
- **Score:** `t(8) = 9.92` and 1300; `t(36) = 41.56` and 5640; `t(9)` collapse = 11.05; `withinServerLimits` and `capScore` on the store bot at 60 fps, 20 fps and random frames. An idle crane times out at 150 s with score 0.
- `poses.test.ts`: soles within 1 cm; the hat within 1 cm of the head. `assets.test.ts`: worker height 1.556 m.

## Performance

Target **40** draw calls, cap **50** (the spec's estimate is ≈ 45; the hard cap is 150). Lattice 2, cable + hook 2, five piece kinds 5, carried 1, piles 5, fence 2, ground 1, van 1, pallets 1, crates 1, worker 2 + hat 1, guide 1, slot 1, blob 1, fx ≤ 3 → about 32. Lights: the `day` preset only. `fx.warm("sparkle", "puff", "confetti", "score")` on mount. No per-frame allocation.

`startLoop("engine", { volume: 0.3 })` while playing; `set({ pitch })` from jib and trolley speed. Cable: `playSfx("click", { pitch: 0.6, volume: 0.2 })` at most every 0.4 s while `|angle| > 0.08`. Landing `thud` by rating (perfect 1.3, good 1.1, ok 0.9, miss 0.7); perfect also `chime`. Wrong pile `buzz`. Collapse `boom` plus `fx.shake(0.6)`.

## Accessibility

The guide line is a shape and a colour. The swing amplitude (metres, `5.5 · |angle|`) is a HUD chip next to time, stability and the building. "Steady crane" raises damping on a coarse pointer. Pile boxes are at least 64 px; the 1.05 m pair can still overlap on a phone, and the nearer centre wins. The blueprint chip shows the piece name. `fx.shake` honours reduced motion.

## Risks and open questions

- **Stability 0 / −3 / −6 / −12** instead of the spec's 0 / −5 / −10 / −15, so all-ok finishes (52 / 28 / 4). Recommend accept.
- **One plot, fixed slot order, seed changes looks only** (`windowStyle`, `roofStyle`). A finished building stays for the cheer, then the plot clears and the next building starts at y = 0 on the same four points. Recommend accept.
- **Cement mixer out** (no GLB this game owns). Recommend accept.
- **Limits, now that the proof is redone:** `maxScore` 5800, duration 9000–152000 ms, base 0, pps 150. The old 72 s / 5490 / pps 80 figure counted a 2.5 m haul the trolley gates do not require, and a 15 s floor the 11 s collapse can beat. Recommend accept. Claude applies them; this branch does not edit `meta.ts`.
- Pickup no longer waits for the swing to die. If a playtest still cannot finish on ok, the next lever is damping 1.0, not a pickup gate.

## Status

Not built. `status` stays `"dev"`.
