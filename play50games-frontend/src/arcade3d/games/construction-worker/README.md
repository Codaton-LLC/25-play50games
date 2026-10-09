# Construction Worker

Owner: Cursor. Slug: `construction-worker`. Adventure game 9 (order 19), complexity 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §9. Gate G0. Units: metres, seconds; x east, z south, y up. Every "Changed from spec" line says what and why. P-15 watch-out: swing energy never grows.

## Concept

A toy building site in daylight. The player runs the tower crane: read the next blueprint step, pick that material from the yard, and swing the hook over the glowing slot. The hook is a damped pendulum, so the drop is a timing skill. The worker (the shared runner in a procedural hard hat) stands by the mast and cheers each finished floor. Three buildings on one plot, then the clock. Accent `#fbbf24`.

## Controls

`meta.ts` stays as the stub: `scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`. No `touchLabels`. No `durationMs`.

- `keyboard`: "A / D rotate, W / S trolley, Space drop, 1-5 pick a pile" (unchanged). Arrows hit the same axes as WASD.
- `touch`: "Joystick, Action to drop, tap a pile" (unchanged).
- `moveX` rotates the jib (D / right = +). `moveY` drives the trolley (W / up = −1 = radius out). Drop is `jumpPressed || actionPressed`, and only while a piece is carried and the trolley is inside the drop gate (a press outside it is ignored, not a miss). While nothing is carried, Action over a pile is a pick (below). Piles: `digit` 1–5, a pile `tap` (release, not `tapDown`), or Action while the hook is over a pile. `digit` 6–9 is ignored. Esc / P pause (shell).

## Rules

Numbers live in `rules.ts` and are proved in `rules.test.ts`. Crane and pendulum integrate only inside `fixedStep` (`createFixedStep(1/120)`). `playedFrameDt` ≤ 1/20 s, so a frame is at most 6 steps.

- **Site:** the fitted wedge, x ∈ [−8, 8], z ∈ [−2, 12] (16 × 14). Changed from spec (30 × 24): the phone fit needs this box to keep the ok band ≥ 6 px. Mast at the origin, angle 0 facing +z. Start trolley `(angle 0, radius 4.5)`.
- **Crane:** polar `(angle, radius)`. Radius ∈ [4.5, **9.6**]. Angle ∈ [−0.60, 0.60]. Changed from radius 11: a 0.35 rad swing is 1.9 m, and r 11 plus that swing left the wedge. Slots are at 9.5, so 9.6 still centres a drop, and the hook stays inside x ±8 and z ≤ 12. Max |ω| 0.9 rad/s, angular accel 1.8 rad/s². Trolley max 2.5 m/s, accel 5 m/s². Jib at y = 10. A step never exceeds `0.9 · dt` rad or `2.5 · dt` metres.
- **Pickup:** the pile whose 0.45 m disc contains the hook xz is the candidate (centres 1.05 m apart for the close pair, 2.10 m for the wide pair; 0.45 + 0.45 = 0.90 < 1.05, so the discs do not overlap). Key 1–5, a pile tap, or Action while the hook is over a pile: the right pile starts a dwell; the wrong pile is refused at once. A correct key with the hook over no pile, or over a different pile, is ignored (not armed). The dwell is 0.25 s and must hold all three the whole time — trolley r ≤ **7.8**, hook inside that disc, bob horizontal speed < 0.15 m/s — or it restarts from zero. The proof counts on that 0.25 s; it cannot be skipped. A wrong key while carrying, or during the 1 s lock, is ignored and costs no extra second (spam must not burn the clock under the 9 s floor). No `|swing| < 0.1` test. On a phone the close piles are about 17 px apart in portrait and 10 px in landscape, so hovering plus Action is the primary touch path and the taps are secondary.
- **Wrong pile:** on that key, tap or Action, immediately. No piece, no stability loss, `timeLeft −= 1`, pick/drop locked for 1 s. The clock keeps ticking during the lock.
- **Slots:** four xz points at radius 9.5, angles −0.45, −0.15, 0.15, 0.45. Floor step 0.75. House 2 floors (8: 2/2/2/1/1), shop 3 (12: 3/3/3/2/1), tower 4 (16: 4/4/4/3/1) of slab/pillar/wall/window/roof. Changed from spec: all three use these same four points, not three plots. A finished building stays through the 1.2 s cheer. During the cheer, picks are allowed and drops are ignored; then the pieces leave and the next building starts at y = 0. Stability resets to 100. Tower top is y = 3. The seed picks `windowStyle` and `roofStyle` only.
- **Drop:** accepted only at trolley r ≥ **8.9** (house, shop) or ≥ **9.02** (tower). 9.02 is the tower ok edge: slot r 9.5 minus the tower ok band 0.48. A press inside the gate does nothing. The landing point is hook xz plus (trolley velocity, including the jib's tangential `ω · r`, plus `5.5` times the pendulum's angular velocity) times `sqrt(2 · (hookBottomY − slotTopY) / 9.81)`. The rating is the horizontal distance from that point to the slot centre: perfect < 0.15, good < 0.35, ok < 0.6, else a miss (same step retries, piece leaves the hook). Tower bands × 0.8 (0.12 / 0.28 / 0.48).
- **Hook:** the pendulum bob is the cable end. At rest the bob is at y = 4.5 (jib 10 − length 5.5); a swing raises it (`10 − 5.5 · cos`). The 1.2 m hook block sits above the bob, bottom flush with it (rest y 4.5..5.7). The carried piece hangs below the bob, top flush, height ≤ 0.70, so its bottom is ≥ 3.8 at rest. Slot tops are ≤ 3, so the piece clears the tower's top floor by ≥ 0.8 m, and a swing only adds clearance. The mast is at r 0 and the trolley never comes inside r 4.5, so the hook and the piece do not meet the crane. `hookBottomY` in the fall is the piece bottom.
- **Pendulum:** `stepPendulum2D`, `{ length: 5.5, gravity: 9.81, damping: 0.55 }` (ζ ≈ 0.21, ω0 ≈ 1.336). Pivot acceleration is trolley linear accel, plus jib tangential, plus centripetal. **Centripetal is inward** (the pivot accelerates toward the mast), so the hook swings out. Wind adds after that. The xz vector is scaled down to **2.0 m/s²** if longer (`a/g ≤ 0.20`). A sustained 2.0 step overshoots to about 0.31 rad, under the clamp; 2.5 would reach about 0.39 and fire the clamp in normal play. The cap does not change the haul, so the proof is unchanged. After both axes, if the angle **magnitude** exceeds 0.35 rad, both axes scale down to 0.35 and the outward angular speed is zeroed. Magnitude, not per axis (a diagonal would otherwise reach 0.49). It is only the linear-model safety.
- **Wind:** from the first tower piece, every 7 s for 1.0 s, +3 m/s² on +x, then the 2.0 cap. Coarse pointers use damping 1.4. Tests use 0.55.
- **Stability:** 100 per building. Perfect / good / ok / miss = 0 / −3 / −6 / −12. The 9th miss collapses. Changed from spec (0 / −5 / −10 / −15) so all-ok leaves 52 / 28 / 4 and a novice is not forced to 0.
- **Clock:** 150 s in `rules.ts`. No `durationMs`. `end("timeup")` when `timeLeft` hits 0: at most 150 s of play, sooner by every counted wrong pile.

## Scoring

`points = 100 | 60 | 30 | 0`. `+500` when a building's last placed piece leaves stability > 0. A miss never places. On `end("win")` only, `+5 · floor(timeLeft)`. No streak points.

### Server limits and why they hold (the proof)

| | provisional (`meta.ts`, unchanged here) | decided |
|---|---|---|
| `maxScore` | 9000 | **5800** |
| duration | 20000–152000 ms | **9000–152000 ms** |
| `base` / `max_pps` | 9000 / 9000 | **0 / 150** |

Pickup only at r ≤ 7.8, drop only at r ≥ 8.9. The gap is 1.1 m. At 2.5 m/s a leg is 0.44 s. Out, back and the 0.25 s dwell are **1.13 s** a piece. The opening 4.5 → 7.8 is 0.88 s extra, once: `t(k) = 0.88 + 1.13 · k`. Angle travel only adds time (a pile-to-slot turn can be ~0.9 rad); the bound ignores it. The tower's 9.02 gate is a longer haul; the ceiling uses 1.1 m for every piece.

1. **House.** k = 8, t = 9.92 s, score = **1300**. `150 · 9.92 = 1488 ≥ 1300`, and `150 · 9 = 1350 ≥ 1300`.
2. **Win.** k = 36, t = 41.56 s, `floor(150 − 41.56) = 108`, score = 3600 + 1500 + 540 = **5640**. `150 · 41.56 = 6234 ≥ 5640`. Shop at k = 20 is 3000 at 23.5 s.
3. **Cap.** 5800 is 160 above 5640. `base` is 0. `capScore` is a no-op on a legal run.
4. **Collapse.** `t(9) = 11.05 s`. `minDurationMs` 9000 is under it. A lose or a time-up has no time bonus (≤ 4500).

The store bot cruises to the pile, holds the dwell, and drops only when the guide is perfect and the trolley is inside the gate (`simulateRun` at 60 fps, 20 fps and random 4–50 ms). The 0.15 m/s dwell is the swing dying, so that bot does not clear 36 pieces inside 150 s: `t(36) = 41.56` is a travel floor that ignores settle. It still finishes the house inside the 9.9 s / 1300 bounds (slower, score ≤ 1300), then times out at 150 s with score > 1000 and ≤ 5640. `withinServerLimits` passes and `capScore` is a no-op. An idle run scores 0.

## Run end

- `end("win")` when the tower's last placed piece leaves stability > 0, time bonus included. `resultDelayMs: 1100`.
- `end("lose")` when stability hits ≤ 0. No bonuses.
- `end("timeup")` when `timeLeft` hits 0. Same frame as a drop: the clock is applied first.

## Scene and camera

One sentence: the wedge has to be large enough to read the hook and the ok band on a phone. `useFittedView({ area: x −8..8, y 0..4.5, z −2..12, pitch: 40°, yaws: [0.6, 0.6 + π/2], margin: { top: 0.10, bottom: 0.08, left: 0.02, right: 0.02 }, padding: 8, shift: true, fov: 42 })`. Portrait yaw 0.6; a short wide phone uses `0.6 + π/2`. Look-at y is `0.35 · roofHeight` (roof ≤ 3). `<CameraRig follow={that point} followFraction={1} offset shift damping={6}>`. The jib above y 4.5 may leave the frame.

| | px/m | hook 1.2 m | slot 1.2 m | worker 1.56 m | ok 0.6 m | perfect 0.15 m |
|---|---|---|---|---|---|---|
| 390 × 844, banner open | 16 | 19 | 19 | 24 | 9 | 2 |
| 844 × 390, banner open | 10 | 12 | 12 | 16 | 6 | 1.5 |

- **Worker** at (3.2, 0, −1), `SHARED_ASSETS.runner` scale 0.825 (1.556 m), `applyLift={false}`, group y = `bodyLift × 0.825`. `idlePose`, `pointPose` (`aimArm`) while carrying, `cheerPose` for 1.2 s. Hard hat on `attach={{ head }}`.
- Guide: gold `#fbbf24` when the predicted landing is inside perfect, mint `#6ee7b7` inside ok, slate outside, plus a blob under the piece. The perfect band is 1.5–2 px, so the gold tier is how it reads. Slot frame is emissive, not a light.
- `environment: { background: "#e7e5e4", fog: ["#e7e5e4", 100, 160], lighting: "day" }`. Changed from 28 / 55: the portrait fit sits about 65 m out, so fog that starts at 28 m hid the site, the worker and the hook. Van at (−5.4, 0, 1.0), yaw π/2 (long axis east), about 5.5 m clear of the mast base, inside the wedge.

## Core helpers used

`GameDefinition` (`resultDelayMs`, no `durationMs`, `touchControls`, `hudStats` for time / stability / building / swing amplitude, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`moveX`, `moveY`, `jumpPressed`, `actionPressed`, `digit`, `tap`), `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setStat`, `end`), `stepPendulum2D`, `createFixedStep`, `fixedStep`, `createRng`, `rngNext`, `randomSeed`, `withinServerLimits`, `capScore`, `simulateRun` / `fixedFrames` / `randomFrames` (tests), `<HumanoidModel attach={{ head }}>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `bodyLift`, `RUNNER_LANDMARKS`, `Fence`, `useFx`, `useCanvasTexture`, `<Instanced>`, `<DynamicInstanced>`, `BlobShadow`, `useQuality`, `SHARED_ASSETS.runner` / `crate`, `REUSED_ASSETS.pallet` / `van`, `playSfx`, `startLoop`. Not used: Rapier, `core/path`, `core/ai`, `Trail`.

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

`meta.ts` (scoring unchanged until Claude's limits PR) · `index.tsx` · `rules.ts` · `rules.test.ts` · `poses.ts` · `assets.ts` + tests · `Scene.tsx` · `Crane.tsx` · `Site.tsx` · `Pieces.tsx` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail and the thumbs input belong to the build.

## Test plan

`rules.test.ts` ≤ ~600 lines. 20 seeds × three frame modes: styles do not move slots.

- **Pins:** gates 7.8 / 8.9 / 9.02, pickup radius 0.45, accel cap 2.0, radius max 9.6.
- **Dwell:** breaks and restarts if r, disc or bob speed fails; a wrong key while carrying or locked costs 0 s; a correct key off the pile does not arm.
- **Energy:** E does not grow at zero pivot accel. The 2.0 cap holds for a full-speed jib start (raw `ω²r` and `α · r` exceed it) and that start stays under 0.35 rad.
- **Landing:** the rating uses the predicted point, not the hook xz. Tower drop opens at 9.02. A miss retries the same step.
- **Stability and score:** all-ok 52 / 28 / 4; 9th miss collapses; `t(8) = 9.92` / 1300; `t(36) = 41.56` / 5640; `t(9) = 11.05`; store bot as above; idle times out at 150 s with score 0.
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
- Limits are maxScore 5800, duration 9000–152000 ms, base 0, pps 150. Claude writes them into `meta.ts` and `arcade-games.json` at merge. This branch does not.

No open design question remains.

## Status

Playable. `status` stays `"dev"`. Thumbnail stays null.

```
HANDOFF P-15 construction-worker
branch: cursor/game-construction-worker
status: dev (unchanged)
scoring: unchanged, 5800 / 9000–152000 ms / base 0 / pps 150
fog: 100–160 (was 28–55; the portrait camera is ~65 m out and the old fog hid the site)
proof: t(8)=9.92 s score 1300; t(36)=41.56 s score 5640 is a haul floor. A perfect-seeking store bot settles the 0.15 m/s dwell and times out at 150 s with score > 1000 and ≤ 5640, house ≤ 1300 at ≥ 9.9 s. withinServerLimits holds. capScore is a no-op. Idle score 0.
checks: next build with PREVIEW passed; tsc via that build; vitest (game tests re-run, full suite 1676 earlier); gamecheck and tools/perf are not in this worktree.
play: keyboard moves the crane (swing chip left 0). Touch controls and the open cookie banner at 390×844 and 844×390. Hook, slot ring, worker and piles stay above the banner.
```
