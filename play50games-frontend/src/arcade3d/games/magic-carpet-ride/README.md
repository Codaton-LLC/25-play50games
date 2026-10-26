# Magic Carpet Ride

Owner: cursor. Slug: `magic-carpet-ride`. Order 47. Status `dev`. Collection `adventure`. Points. Difficulty 2. One rail, five level configs. Spec: `.handoff/C-47-magic-carpet-ride/spec.md`.

## Rules

The carpet rides a smooth open spline (`createPath`, `smooth: true`) of length `level.length`. It advances at `level.speed`, or `speed × 1.5` while boosting. `moveX` / `moveY` slide it inside a window of ±4 m sideways and ±2.5 m up and down, at most 5 m/s, eased by `spring` (stiffness 42, critical damping). Up on the stick is up (`moveY` of −1), on keyboard and touch, because both devices write the same `InputState`.

Boost drains stamina at 30/s from 100 and flies at 1.5×. At 0, a 1.00 s lock blocks boost. Stamina refills at 12/s whenever you are not boosting, including during the lock, so a held Boost becomes a 3.33 s burst, then 0.4 s pulses. A cloud hit (level 3 only) multiplies speed by 0.7 for 1.1 s and scores +0.

Rings: 8 / 12 / 16 / 20 / 25 along the route, each offset inside the window. A ring pays +50 once when the carpet crosses its plane within 1.2 m of the centre (ring radius 1.5 minus the carpet half-width 0.3). A wider cross does not pay and does not cost a life. Stars sit on the lines between rings and pay +30 once inside 0.7 m. Both pay once.

Rocks sit in the window, at least 6 m from every ring and off that ring's line. The first `movers` of them drift on a sine (period 3 s, amplitude 1.5 m) from level 3. A hit inside 1.15 m, outside a 1.0 s mercy, spends a life (3) and snaps the offset to the path centre. Level 3's obstacles are clouds: they only slow. The first rock is past 55 m, so three lives cannot end before 4 s.

At the end of the route the run wins when rings passed ≥ quota and stars taken ≥ quota, else `end("lose")`. The miss line names what was short. Lives at 0 and the shell clock are the other endings. Timeup is the shell's.

Score, all integers: +50 per ring, +30 per star, and on a win only +4 per full second left (`4 * floor(timeLeftMs / 1000)`). Object ceiling `Bobj = 50 * rings + 30 * stars`.

## Levels

Same flight. Length, speed, counts, clock and the core lighting preset change. Fog is `[background, 22, fogFar]`.

| L | Title | Length | Speed | Rings | Quota | Stars | Quota | Rocks | Movers | Clock | Light |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Desert Village | 420 | 9 | 8 | 6 | 8 | 5 | 3 | 0 | 120 s | day `#fde68a` |
| 2 | Canyon | 600 | 10 | 12 | 9 | 12 | 8 | 6 | 0 | 150 s | sunset `#fb923c` |
| 3 | Cloud Kingdom | 780 | 10.5 | 16 | 12 | 15 | 10 | 8 | 4 | 180 s | day `#e0f2fe` |
| 4 | Night City | 880 | 11 | 20 | 15 | 18 | 12 | 10 | 6 | 180 s | night `#1e1b4b` |
| 5 | Floating Palace | 1100 | 11.5 | 25 | 19 | 22 | 15 | 14 | 8 | 240 s | sunset `#7c2d12` |

## Controls

WASD / arrows steer. Hold Space to boost. Touch: joystick, Jump label "Boost". Scheme `flight`. The same window, 5 m/s ease, 30/s drain, 12/s refill and 1.00 s lock run on both devices (`rules.test.ts`). The shell owns pause. Stat chips: Rings, Stars, Boost 0–100. `resultDelayMs` 900.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000`. `unitLabel: "pts"`, `display: "int"`.

The sketch put the earliest win at a stamina time M (40 / 55 / 70 / 80 / 100 s) and pps 8 / 7 / 7 / 5 / 6. A held Boost refills during the lock, so the oracle finishes sooner and those pps lines reject a full clear. The proof uses the measured finish. `base` stays `Bobj`. pps is the smallest integer that still covers that finish with a few seconds of slack. `maxScore` is about 4% over the measured clear. Level 5 `maxScore` 2650 is under 3300 and under `3 × 1000`.

`base + pps × seconds` at the measured best win (`rules.test.ts`, through `createArcadeStore` + `advanceRunClock`):

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 640 | 39.80 s | 960 | 640 + 9 × 39.80 = 998 | 1000 | 96.0% |
| 2 | 960 | 51.53 s | 1322 | 960 + 8 × 51.53 = 1372 | 1420 | 93.1% |
| 3 | 1250 | 64.03 s | 1710 | 1250 + 8 × 64.03 = 1762 | 1780 | 96.1% |
| 4 | 1540 | 69.00 s | 1954 | 1540 + 8 × 69.00 = 2092 | 2060 | 94.9% |
| 5 | 1910 | 82.80 s | 2538 | 1910 + 9 × 82.80 = 2655 | 2650 | 95.8% |

Level 1's 39.80 s leaves 80 full seconds (`320 + 640 = 960`). A hypothetical 37 s clear would score 972, and `640 + 9 × 37 = 973` still accepts it. The oracle did not beat 39.8 s.

Proof: per level, 8 seeds at 30 Hz and 60 Hz for an oracle (full stick, boost held), a human-paced bot (stick capped at 0.85, boost after 0.2 s), an idle bot and a spam bot, plus one oracle at 144 Hz. Idle scores 0 and does not win. Spam and every oracle stay inside the limits, and `capScore` is a no-op on those runs. Oracle wins all 16 of the 30/60 Hz runs on every level. Every best is at least 90% of that level's `maxScore`. Layout: 200 seeds × 5 levels, deterministic, path length matches, every rock stays 6 m from every ring even at a mover's closest height. Decor (not the palace past the finish) sits at least 6 m off the path.

## Look

One palette in `looks.ts`. Sand `#fcd34d`, rooftops `#c2410c`, rings `#fbbf24`, accent `#a78bfa`. Lighting and background come from the level. Chase camera: 5 m behind the carpet, 1.8 m above, pitch 12° down, yaw aimed 10 m along the path, no roll. `EyeRig` + `useEyeShift` (`shift: true`) keeps the lane off the HUD and the cookie banner. The carpet banks with `bank` and the cloth ripples with `hover`.

The rider is a `HumanoidModel` stand-in (`RiderFigure`, seated, scarf and cloth) until `charCarpetRider.glb` is measured. The sit is `turnBone` on the hips' legs and `aimArm` forward; a win lifts the arms. `applyLift` is off so the cushion stays put. Rings, stars and obstacles are instanced pools. Level 3 obstacles are clouds. Decor (rooftops, mesas, lanterns, far clouds, the palace) is outside the flight window or past the arch. The ground is one unit plane scaled under the carpet, so the frame does not open onto a void. Boost leaves a sparkle trail.

## Known issues

- `charCarpetRider` has no measured landmarks and `scale` 1. The sit angles are for the stand-in proportions. Claude's assets PR measures the GLB, sets landmarks and the scale that keeps a 1.72 m standing height, and checks the seated fit.
- Every url under `/models/3d/magic-carpet-ride/` is unlisted, so the fallbacks draw. Ready files are named in `assets.spec.json`, including `floatingRockV3.glb`. Leave `desertRooftop.glb`, `floatingPalace.glb`, `floatingRock.glb`, `floatingRockV2.glb` and `hero.glb`.
- The oracle on level 2's best seed still misses one star (1322 vs a full 1352). The limit uses that measured clear.
- No thumbnail yet: `meta.thumbnail` is `null` until `/images/3d/magic-carpet-ride.webp` lands.

## Status

Playable on primitives. `status: "dev"`. Score limits are proposed in `meta.ts` and `rules.ts` (`PROPOSED_LEVEL_LIMITS`). Claude copies them into `arcade-games.json` at the gate. Do not enable the game.
