# Dog Park Fetch

Owner: kimi. Slug: `dog-park-fetch`. Order 41. Status `dev`. Collection `adventure`. Points. Difficulty 1. One fenced lawn, five level configs. Spec: `docs/menu1-new/specs-41-50.md` §41.

## Rules

You are the dog. The owner stands on a blanket at the south end of the lawn and throws one toy at a time. Run to the toy, pick it up and bring it back to the blanket. A frisbee caught in the air pays a bonus. There are no lives.

- Throws: `throws` per level. Every third throw (the first, the fourth, and so on) is a frisbee, so frisbees = ceil(throws / 3). The other throws are a ball or a stick, drawn from the seed. The whole plan (kinds, landing spots, flight times) is drawn when the run is made, so it does not depend on the player.
- Landing: uniform in `[throwMin, throwMax]` metres from the blanket, at a seeded angle. Every landing is inside the fence (1 m margin) and at least 1.5 m clear of every prop's edge. The first throw comes 0.8 s after the start, and the next throw comes 0.8 s after the last one is resolved (returned, or fetched by the owner). One throw is active at a time.
- Flight: a ball or stick flies `0.9 + 0.05 × distance` s. A frisbee flies 1.6 s with apex 1.5 m. A frisbee is catchable in its last 0.9 s, only while it is below 1.4 m, only while the dog leaps (`jumpPressed`, 0.45 s, 0.8 m arc), and only within 0.6 m of the dog's centre (`canCatch`, pure, tested at 1.39 m and 1.41 m).
- Pickup: a toy on the grass is picked up when the dog's centre is within 0.5 m of it. Only one toy is carried at a time.
- Delivery: a carried toy is returned when the dog's centre is within 1.5 m of the blanket centre.
- Mowers (L3 and up): a closed four-corner loop, `stepPatrol` at `mowerSpeed`. A hit (radius 0.6 + 0.32) drops the carried toy where the dog stands (it lies on the grass until picked up again, and pays nothing) and stuns the dog for 0.6 s. After a hit the dog is safe from mowers for 0.8 s (mercy).
- Patience (L4 and up): a throw left on the grass for more than `patienceS` is fetched by the owner: 0 points, and the next throw starts. Two timed-out throws on L4 and L5 end the run at once with `end("lose")`. On L1 to L3 nothing times out.
- Props: benches (solid circles, L1 and up), the fountain (solid circle, L2 and up), two trees (L3 and up). The dog and the throws keep clear of them.
- Score, all integers: +100 per toy returned, +40 if it was returned within 8.0 s of landing (or of a catch), +60 per frisbee caught, and on win +4 per full second left. Each throw's return pays once.
- Win: every throw resolved and at least `throws - 1` of them returned. Timeup: shell.

## Levels

| L | Title | Lawn (m) | Throws | Landing (m) | Mowers | Mower speed | Patience | Fountain | Light |
|---|---|---|---:|---|---:|---:|---:|---|---|
| 1 | Small Park | 20 × 16 | 4 | 6–10 | 0 | – | none | no | day |
| 2 | City Park | 26 × 20 | 6 | 7–13 | 0 | – | none | yes | day |
| 3 | Forest Park | 30 × 24 | 8 | 8–15 | 1 | 1.8 | none | yes | day |
| 4 | Beach Park | 32 × 26 | 10 | 8–16 | 1 | 2.2 | 14 s | yes | sunset |
| 5 | Dog Festival | 36 × 28 | 12 | 9–18 | 2 | 2.4 | 12 s | yes | day |

The dog's tint is the level's tint (L1 untinted). The owner is never tinted.

## Controls

WASD / arrows run. Space jumps (leap). Touch: joystick and Jump. Scheme `joystick`. The same leap length and catch window run on both devices. The shell owns pause. HUD: the shell's score and clock, plus the stat chip Fetched (max = throws). There is no custom HUD. `resultDelayMs` 900. The target arrow (`TargetMarkers`) points at the toy while it is out, and at the blanket while the dog carries it.

## Server limits

`base = 140 × throws + 60 × frisbees` (the objective ceiling). `maxDurationMs` is the level clock. `minDurationMs` 4000. `unitLabel` "pts", `display` "int".

The spec's sketch limits were far too tight for the honest bot, which clears every level. The limits below replace the sketch. Each is checked by `rules.test.ts`: the honest bot over 12 seeds at 60 Hz, plus seed 1 at 30 and 144 Hz; idle and spam bots; and the best honest win must be at least 90 % of `maxScore`.

| L | maxScore | base | maxPointsPerSec | maxDurationMs | best honest win (12 seeds) |
|---|---:|---:|---:|---:|---:|
| 1 | 890 | 680 | 10 | 90 000 | 840 |
| 2 | 1240 | 960 | 8 | 120 000 | 1176 |
| 3 | 1590 | 1300 | 5 | 150 000 | 1512 |
| 4 | 1820 | 1640 | 2 | 150 000 | 1732 |
| 5 | 2150 | 1920 | 2 | 180 000 | 2040 |

Level 5 `maxScore` 2150 is under `3 × 890`. `meta.ts` and `rules.ts` `PROPOSED_LEVEL_LIMITS` carry the same five, and `levels.test.ts` checks that they match. Claude copies them into `arcade-games.json` at the gate.

The honest bot is a proof of the limits, not a balance study. It walks the lawn with the grid path finder from `core/testing/botHarness`, runs at 90 % stick, leaps for a frisbee that is low and close, and steers away from a mower within 1.8 m (its only dodge). Its wins take about 20 s on L1 and 90 s on L5. The pps values are small (2 to 10) because the time bonus is small against these bases; the server line is set mostly by `base` and `maxScore`.

## Look

One palette in `looks.ts`. Lawn `#65a30d` with mowing stripes `#84cc16`. Blanket `#f59e0b`, the accent. Sand strip `#f2d7a6` on the sunset level (L4). Picket fence `#f5f5f4`. Camera: follow, pitch 55 degrees, yaws `[0, π/2]`, fov 46, `followFocus` fraction 0.6, look-ahead 2 m, `shift: true`.

Primitives (`Primitives.tsx`) are bevelled `RoundedBoxGeometry` stand-ins with two or three tones: the dog (body, legs, ears, tail, nose), the owner, the ride-on mower, a tennis ball with its seam, a fetch stick, and a flat frisbee with its rim.

## Models

Every url is `/models/3d/dog-park-fetch/<id>.glb`, unlisted in `modelManifest.ts`, so the fallbacks draw and no request is made.

| Asset id | File | Used as |
|---|---|---|
| `dog` | `dog.glb` | the dog (`<Model tint>`; creature, not auto-rigged) |
| `civilianNpc` | `civilianNpc.glb` | the owner (`<Model>`, untinted) |
| `tennisBall` | `tennisBall.glb` | a ball throw |
| `fetchStick` | `fetchStick.glb` | a stick throw |
| `frisbee` | `frisbee.glb` | a frisbee throw (flip it: the ledger reads it concave side up) |
| `lawnMower` | `lawnMower.glb` | mowers (L3 and up) |
| `parkFountain` | `parkFountain.glb` | the fountain (L2 and up) |
| `picketFence` | `picketFence.glb` | the fence (`<InstancedModel>`) |
| `bench` | shared `REUSED_ASSETS.bench` | benches |
| `leafyTree` | shared `EXPANSION_ASSETS.leafyTree` | trees (L3 and up) |

Not used: `agilityTunnel.glb` and `agilityHurdleR.glb` (L5 decor, not built). Still needed from Hyper3D (spec): `charDogOwner` (the owner is `civilianNpc` until it exists), `parkBush`, `dogHouseEmpty`, `festivalTent`.

## What Claude registers at the gate

1. `arcade-games.json`: copy the five limits above (level 1 is the top-level `scoring`). `enabled: false` until the go-live.
2. Copy the GLBs listed above to `public/models/3d/dog-park-fetch/`, list them in `modelManifest.ts`, and set each asset's `scale`, `stretch` and `yOffset` from the measured bounds in `assets.ts`.
3. `public/images/3d/dog-park-fetch.webp` (thumbnail) is not built yet. `meta.thumbnail` is `null`.

## Not built (spec items left out)

- Water beyond the fence on L4 (visual only): not drawn.
- Festival bunting and the tent on L5: not drawn.
- Tree shade on L3: the two trees are solid circles with no shade effect.
- Agility tunnel and hurdle (L5 decor): not drawn.
- The path strips (`#d6d3d1`): not drawn.
- The owner's hands-on-hips pose: the owner stands still and hops once per throw.
- A throw pose and a muzzle socket: the carried toy sits at a fixed point in front of the dog.

## Known issues

- Catches: the leap is a timer, not a physics arc, so the dog's height does not decide a catch; the toy's height does (`canCatch`).
- Frisbee flight is a fixed parabola (apex 1.5 m, 1.6 s). The seeded landing point is the only randomness in a throw.
- A mower drop leaves the toy where the dog stood. It can be dropped again, and the patience timer keeps running.
- The mowers' loop runs 2.5 m inside the fence, past the blanket on the south side, so a hit can happen while the dog drops off a toy on L3 and up.
- The benches are drawn at the bench GLB's size (1.8 by 0.8 m), but their collision is a circle of 0.5 m radius.
