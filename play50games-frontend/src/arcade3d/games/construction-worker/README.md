# Construction Worker

Owner: Cursor. Slug: `construction-worker`. Adventure game 9 (order 19), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §9. Gate G0. Units: metres, seconds; x east, z south, y up. Every "Changed from spec" line says what and why. P-15 watch-out: swing energy never grows.

## Concept

A toy building site in daylight. The player runs the tower crane: read the next blueprint step, pick that material from the yard, and swing the hook over the glowing slot. The hook is a damped pendulum, so the drop is a timing skill. The worker (the shared runner in a procedural hard hat) stands in front of the piles and cheers each finished floor. Three buildings on one plot, then the clock. Accent `#fbbf24`.

## Controls

`scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`. No `touchLabels`. `durationMs` is `CLOCK_S * 1000` (240000).

- `keyboard`: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile" (unchanged). Arrows hit the same axes as WASD.
- `touch`: "Joystick, Action to drop, tap a pile" (unchanged).
- `moveX` rotates the jib (D / right = +). `moveY` drives the trolley (W / up = −1 = radius out). Drop is `jumpPressed || actionPressed`, and only while a piece is carried and the trolley is inside the drop gate (a press outside it is ignored, not a miss). While nothing is carried, Action over a pile is a pick (below). Piles: `digit` 1–5, a pile `tap` (release, not `tapDown`), or Action while the hook is over a pile. `digit` 6–9 is ignored. Esc / P pause (shell).

## Rules

Numbers live in `rules.ts` and are proved in `rules.test.ts`. Crane and pendulum integrate only inside `fixedStep` (`createFixedStep(1/120)`). `playedFrameDt` ≤ 1/20 s, so a frame is at most 6 steps.

- **Site:** the yard is still 16 × 14, but the camera fits the work zone only (below). Mast at the origin, angle 0 facing +z. Start trolley `(angle 0, radius 4.5)`.
- **Crane:** polar `(angle, radius)`. Radius ∈ [4.5, **9.6**]. Angle ∈ [−0.60, 0.60]. Changed from radius 11: a 0.35 rad swing is 1.9 m, and r 11 plus that swing left the wedge. Slots are at 9.5, so 9.6 still centres a drop, and the hook stays inside x ±8 and z ≤ 12. Max |ω| 0.9 rad/s, angular accel 1.8 rad/s². Trolley max 2.5 m/s, accel 5 m/s². Jib at y = 10. A step never exceeds `0.9 · dt` rad or `2.5 · dt` metres.
- **Pickup:** the pile whose 0.45 m disc contains the hook xz is the candidate (centres 1.05 m apart for the close pair, 2.10 m for the wide pair; 0.45 + 0.45 = 0.90 < 1.05, so the discs do not overlap). Key 1–5, a pile tap, or Action while the hook is over a pile: the right pile starts a dwell; the wrong pile is refused at once. A correct key with the hook over no pile, or over a different pile, is ignored (not armed). The dwell is 0.25 s and must hold all three the whole time — trolley r ≤ **7.8**, hook inside that disc, bob horizontal speed < 0.15 m/s — or it restarts from zero. The proof counts on that 0.25 s; it cannot be skipped. A wrong key while carrying, or during the 1 s lock, is ignored and costs no extra second (spam must not burn the clock under the 9 s floor). No `|swing| < 0.1` test. On a phone the close piles (1.05 m) are about 30 px apart in portrait and 23 px in landscape. Hovering plus Action is still the primary touch path.
- **Wrong pile:** on that key, tap or Action, immediately. No piece, no stability loss, `timeLeft −= 1`, pick/drop locked for 1 s. The clock keeps ticking during the lock.
- **Slots:** four xz points at radius 9.5, angles −0.45, −0.15, 0.15, 0.45. Floor step 0.75. House 2 floors (8: 2/2/2/1/1), shop 3 (12: 3/3/3/2/1), tower 4 (16: 4/4/4/3/1) of slab/pillar/wall/window/roof. Changed from spec: all three use these same four points, not three plots. A finished building stays through the 1.2 s cheer. During the cheer, picks are allowed and drops are ignored; then the pieces leave and the next building starts at y = 0. Stability resets to 100. Tower top is y = 3. The seed picks `windowStyle` and `roofStyle` only.
- **Drop:** accepted only at trolley r ≥ **8.9** (house, shop) or ≥ **9.02** (tower). 9.02 is the tower ok edge: slot r 9.5 minus the tower ok band 0.48. A press inside the gate does nothing. The landing point is hook xz plus (trolley velocity, including the jib's tangential `ω · r`, plus `5.5` times the pendulum's angular velocity) times `sqrt(2 · (hookBottomY − slotTopY) / 9.81)`. The rating is the horizontal distance from that point to the slot centre: perfect < 0.15, good < 0.35, ok < 0.6, else a miss (same step retries, piece leaves the hook). Tower bands × 0.8 (0.12 / 0.28 / 0.48).
- **Hook:** the pendulum bob is the cable end. At rest the bob is at y = 4.5 (jib 10 − length 5.5); a swing raises it (`10 − 5.5 · cos`). The 1.2 m hook block sits above the bob, bottom flush with it (rest y 4.5..5.7). The carried piece hangs below the bob, top flush, height ≤ 0.70, so its bottom is ≥ 3.8 at rest. Slot tops are ≤ 3, so the piece clears the tower's top floor by ≥ 0.8 m, and a swing only adds clearance. The mast is at r 0 and the trolley never comes inside r 4.5, so the hook and the piece do not meet the crane. `hookBottomY` in the fall is the piece bottom.
- **Pendulum:** `stepPendulum2D`, `{ length: 5.5, gravity: 9.81, damping: 0.55 }` (ζ ≈ 0.21, ω0 ≈ 1.336). Pivot acceleration is trolley linear accel, plus jib tangential, plus centripetal. **Centripetal is inward** (the pivot accelerates toward the mast), so the hook swings out. Wind adds after that. The xz vector is scaled down to **2.0 m/s²** if longer (`a/g ≤ 0.20`). A sustained 2.0 step overshoots to about 0.31 rad, under the clamp; 2.5 would reach about 0.39 and fire the clamp in normal play. The cap does not change the haul, so the proof is unchanged. After both axes, if the angle **magnitude** exceeds 0.35 rad, both axes scale down to 0.35 and the outward angular speed is zeroed. Magnitude, not per axis (a diagonal would otherwise reach 0.49). It is only the linear-model safety.
- **Wind:** from the first tower piece, every 7 s for 1.0 s, +3 m/s² on +x, then the 2.0 cap. Coarse pointers use damping 1.4. Tests use 0.55.
- **Stability:** 100 per building. Perfect / good / ok / miss = 0 / −3 / −6 / −12. The 9th miss collapses. Changed from spec (0 / −5 / −10 / −15) so all-ok leaves 52 / 28 / 4 and a novice is not forced to 0.
- **Clock:** 240 s (`CLOCK_S`). Changed from 150 (user, 2026-10-09): the 0.15 m/s dwell waits out the swing, so 36 pieces did not fit in 150 s. `durationMs` matches. `end("timeup")` when `timeLeft` hits 0, sooner by every counted wrong pile.

## Scoring

`points = 100 | 60 | 30 | 0`. `+500` when a building's last placed piece leaves stability > 0. A miss never places. On `end("win")` only, `+5 · floor(timeLeft)`. No streak points.

### Server limits and why they hold (the proof)

`meta.ts` scoring: **maxScore 6100**, **minDurationMs 9000**, **maxDurationMs 242000**, **base 0**, **maxPointsPerSec 150**.

Pickup only at r ≤ 7.8, drop only at r ≥ 8.9. The gap is 1.1 m. At 2.5 m/s a leg is 0.44 s. Out, back and the 0.25 s dwell are **1.13 s** a piece. The opening 4.5 → 7.8 is 0.88 s extra, once: `t(k) = 0.88 + 1.13 · k`. Angle travel only adds time; the bound ignores it. The tower's 9.02 gate is a longer haul; the ceiling uses 1.1 m for every piece.

1. **House.** k = 8, t = 9.92 s, score = **1300**. `150 · 9.92 = 1488 ≥ 1300`.
2. **Win.** k = 36, t = 41.56 s, `floor(240 − 41.56) = 198`, score = 3600 + 1500 + 5 · 198 = **6090**. `(5100 + 5 · floor(240 − t)) / t` at that instant is about 146.6 ≤ 150. Every earlier perfect prefix (k = 1..35, bonuses only for finished house and shop) stays ≤ 150 per second and ≤ 4500.
3. **Cap.** 6100 is 10 above 6090. `base` is 0. `capScore` is a no-op on a legal run.
4. **Collapse.** `t(9) = 11.05 s`. `minDurationMs` 9000 is under it. A lose or a time-up has no time bonus (35 · 100 + 2 · 500 = 4500).

A store-backed bot (`simulateRun`, seed 7, 60 fps) wins on both pointers. Fine: 236.9 s, score 4305. Coarse (damping 1.4): 222.8 s, score 3105. Both are past the 41.56 s floor and under 6090. The house is still ≥ 9.9 s and ≤ 1300. `withinServerLimits` passes and `capScore` is a no-op. An idle crane scores 0 at 240 s. 20 fps and 4–50 ms jitter stay inside the same cap. The honest win is slower than 90% of 6100: that bar needs a finish by about 162 s, and the dwell plus the haul is about 6.6 s a piece.

## Run end

- `end("win")` when the tower's last placed piece leaves stability > 0, time bonus included. `resultDelayMs: 1100`.
- `end("lose")` when stability hits ≤ 0. No bonuses.
- `end("timeup")` when `timeLeft` hits 0. Same frame as a drop: the clock is applied first.

## Scene and camera

The fit is the work zone, not the 16 × 14 yard: x −4.8..4.8, y 0..5.7, z 4.8..10.2. y 5.7 is the hook block at rest (4.5 + 1.2), so the block stays under the chips. The mast above that, and the empty ground in front of the piles, may leave the frame. Pitch 40°, fov 42, padding 8, shift, margin `{ top: 0.10, bottom: 0.08, left: 0.02, right: 0.02 }`. Portrait yaw 0.6; a short wide phone uses `0.6 + π/2`. Look-at `(0, 0.35 · roofHeight, 7.5)`.

| | px/m | hook 1.2 m | slot 1.2 m | worker 1.56 m | ok 0.6 m | perfect 0.15 m |
|---|---|---|---|---|---|---|
| 390 × 844, banner open | 29 | 35 | 35 | 46 | 18 | 4 |
| 844 × 390, banner open | 22 | 26 | 26 | 34 | 13 | 3 |

- **Worker** at (2.6, 0, 5.35), in front of the piles and inside the fit. `SHARED_ASSETS.runner` scale 0.825 (1.556 m), `applyLift={false}`, group y = `bodyLift × 0.825`. `idlePose`, `pointPose` (`aimArm`) while carrying, `cheerPose` for 1.2 s. Hard hat on `attach={{ head }}`.
- Guide: gold `#fbbf24` when the predicted landing is inside perfect, mint `#6ee7b7` inside ok, slate outside, plus a blob under the piece. The perfect band is 1.5–2 px, so the gold tier is how it reads. Slot frame is emissive, not a light.
- `environment: { background: "#e7e5e4", fog: ["#e7e5e4", 100, 160], lighting: "day" }`. Changed from 28 / 55: fog that starts at 28 m hid the site. The portrait fit is about 37 m out, so 100–160 stays clear. Van at (−5.4, 0, 1.0), yaw π/2, sits outside the fitted work zone.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `hudStats` for time / stability / building / swing amplitude, `environment`), `useRunFrame`, `useGameTime`, `useInput`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore`, `stepPendulum2D`, `createFixedStep`, `fixedStep`, `createRng`, `rngNext`, `withinServerLimits`, `capScore`, `simulateRun` / `fixedFrames` / `randomFrames` (tests), `<HumanoidModel>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `bodyLift`, `Fence` via `createPath` (`core/path`), `useFx`, `useCanvasTexture`, `<Instanced>`, `<DynamicInstanced>`, `BlobShadow`, `useQuality`, `SHARED_ASSETS.runner` / `crate`, `REUSED_ASSETS.pallet` / `van`, `playSfx`, `startLoop`, `useMuted`. Not used: Rapier, `core/ai`, `Trail`.

## Assets

No new generation. This game owns no GLB (`assets.spec.json` assets is empty). Cement mixer is out.

| id | class / source | target in game | fallback |
|---|---|---|---|
| worker | D runner 0.825 + B hat | 1.556 m | capsule + hat |
| pallet | D `REUSED_ASSETS.pallet` | 1.2 × 0.15 × 0.8 | box |
| crate | D `SHARED_ASSETS.crate`, ×4 | 0.8 cube | box |
| van | D `REUSED_ASSETS.van` | ~4.5 long, yaw π/2 | box |
| procedural | B: mast, jib, cable, 1.2 m hook block, piles, pieces, fence, ground, guide, slot, hat | | |

Van and extra crates drop out on the low tier. Worker, piles, pieces and crane stay.

## Files

`meta.ts` (scoring 6100 / 9000–242000 ms / base 0 / pps 150) · `index.tsx` · `rules.ts` · `rules.test.ts` · `poses.ts` · `assets.ts` + tests · `Scene.tsx` · `Crane.tsx` · `Site.tsx` · `Pieces.tsx` · `Primitives.tsx` · `Hud.tsx` · `looks.ts` · `assets.spec.json` · `README.md`. Thumbnail stays null until the webp exists.

## Test plan

`rules.test.ts` ≤ ~600 lines. 20 seeds × three frame modes: styles do not move slots.

- **Pins:** gates 7.8 / 8.9 / 9.02, pickup radius 0.45, accel cap 2.0, radius max 9.6.
- **Dwell:** breaks and restarts if r, disc or bob speed fails; a wrong key while carrying or locked costs 0 s; a correct key off the pile does not arm.
- **Energy:** E does not grow at zero pivot accel. The 2.0 cap holds for a full-speed jib start (raw `ω²r` and `α · r` exceed it) and that start stays under 0.35 rad.
- **Landing:** the rating uses the predicted point, not the hook xz. Tower drop opens at 9.02. A miss retries the same step.
- **Stability and score:** all-ok 52 / 28 / 4 and each building's +500; a placed good at stability 3 collapses; `t(8) = 9.92` / 1300; `t(36) = 41.56` / 6090; `t(9) = 11.05`; win pays `5 · floor(10.9)` = 50; cheer allows a pick and ignores a drop; store bot wins fine and coarse; idle times out at 240 s with score 0.
- **Visual:** soles and hat within 1 cm; worker height 1.556 m; the carried piece and the hook never intersect a building or the crane, including the tower's top floor.

## Performance

Target **40** draw calls, cap **50**. Lattice 2, cable + hook 2, five piece kinds 5, carried 1, piles 5, fence 2, ground 1, van 1, pallets 1, crates 1, worker 2 + hat 1, guide 1, slot 1, blob 1, fx ≤ 3 → about 32. `day` preset only. `fx.warm("sparkle", "puff", "confetti", "score")`.

`startLoop("engine", { volume: 0.3 })` while playing; pitch follows jib and trolley speed. Cable `click` at most every 0.4 s while `|angle| > 0.08`. Pickup: `playSfx("pickup")` and a sparkle. Landing `thud` by rating (perfect 1.3, good 1.1, ok 0.9); perfect also `chime`. A miss is `playSfx("hit")` plus a coral `#fb7185` flash on the slot, not a thud. Wrong pile `buzz`. Collapse `boom` and `fx.shake(0.6)`.

## Accessibility

Guide colour is three tiers (gold / mint / slate), not the 1.5–2 px perfect band. Swing amplitude (`5.5 · |angle|`, metres) is a HUD chip with time, stability and the building. "Steady crane" raises damping on a coarse pointer. Blueprint shows the piece name. Pile taps are secondary to Action. `fx.shake` honours reduced motion.

## Risks and open questions

### Decisions (user, 2026-10-09)

- Stability is 0 / −3 / −6 / −12. All-ok finishes.
- One plot, fixed slot order. The seed changes window and roof looks only.
- No cement mixer.
- More time: clock 240 s. 36 pieces and the stability rules stay. Touch damping 1.4 stays.
- Limits in `meta.ts`: maxScore 6100, duration 9000–242000 ms, base 0, pps 150. `arcade-games.json` is Claude's file; this branch does not edit it.

Open: the registry sync test compares `meta.scoring` to `arcade-games.json`, which still has 5800 / 152000 until Claude updates it.

## Status

Playable. `status` stays `"dev"`. Thumbnail stays null until `public/images/3d/construction-worker.webp` exists.

```
HANDOFF P-15-fix1 construction-worker
branch: cursor/game-construction-worker
status: dev
scoring: 6100 / 9000–242000 ms / base 0 / pps 150
clock: 240 s. Bot wins: fine 236.9 s score 4305; coarse 222.8 s score 3105.
proof: t(36)=41.56 s score 6090. House ≤ 1300 at ≥ 9.9 s. Lose/timeup ≤ 4500.
play: 390×844 and 844×390, cookie banner open. Blueprint is a dark pill under the chips. Worker, piles and the slot ring stay above the banner.
```
