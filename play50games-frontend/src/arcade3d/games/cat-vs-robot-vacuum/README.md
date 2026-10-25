# Cat vs Robot Vacuum

Owner: kimi. Slug: `cat-vs-robot-vacuum`. Order 36. Status `dev`. Collection `adventure`. Points. Difficulty 1. One hall, five level configs. Spec: `docs/menu1-new/specs-31-40.md` §36.

## Rules

Walk the cat through the house, collect every treat, and curl up on the bed to finish. Robot vacuums patrol a loop down the middle of the hall. A hit costs a life and sends the cat back to the bed. A hop is a short i-frame, not a climb. Three lives. A partial run ranks; only a win clears the level (no `clearScore`).

- Layout: one hall along +z, x in [−2.4, 2.4]. Rooms are six metres long and alternate bays left and right. Furniture and clutter sit only in the side bays, so the centre lane (|x| ≤ 1.0) is always open.
- Room 0 has the bed (the home pad, a 1.0 m radius around its centre). Rooms 1 and up take a sofa, a bookshelf and a table in turn.
- Treats: 8 to 25 spots, at least 1.5 m apart, never inside furniture or clutter, at least 2 m from the start and 1.5 m from the bed. Toys: 1 to 3 spots, the same spacing rule. `rules.test.ts` floods 40 seeds per level to check that every treat, toy and the bed is reachable.
- Cat: on-foot mover, radius 0.28, top speed 4.2, accel 22, brake 28. Pickups collect at 0.5 m from the cat's centre, the same on every device.
- Hop: `jumpPressed` starts a 0.45 s hop (i-frames: the vacuum overlap is ignored). The next hop waits 0.3 s after the last one ends, so hops cannot chain into permanent i-frames.
- Mercy: 0.80 s after a hit, the cat is safe and blinks.
- Vacuums: radius 0.36, patrol the four-corner loop at `patrolSpeed` (`stepPatrol` from `core/ai`). Level 1 never chases. From level 2, a vacuum within `chaseRange` with a clear sight line (`hasLineOfSightXZ`, furniture and clutter block it) chases at `chaseSpeed` for at most 4 s, then investigates the last seen point and returns to the loop. No chase in the first 3 s of a run. Vacuums spawn at the far corners, heading away from the start.
- Streak: a treat within 4.0 s of the previous one extends the streak. A treat is 30 points, plus 5 per step of streak, capped at +15 (45 at the cap). A toy is 20 points and does not extend the streak.
- Win: every treat collected and the cat on the bed. Score: +4 per full second left on the shell clock.

## Levels

| L | Title | Rooms | Treats | Toys | Vacuums | Patrol / chase speed | Chase range | Clutter | Clock | Light |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---|
| 1 | Living Room | 2 | 8 | 1 | 1 | 1.4 / – | 0 | 0 | 90 s | day |
| 2 | Kitchen | 3 | 12 | 1 | 1 | 1.8 / 2.4 | 6 | 0 | 120 s | indoor |
| 3 | Bedroom | 4 | 16 | 2 | 2 | 1.8 / 2.6 | 7 | 0 | 150 s | indoor |
| 4 | Kids Room | 5 | 20 | 2 | 2 | 2.1 / 3.0 | 8 | 4 | 150 s | day |
| 5 | Whole House | 6 | 25 | 3 | 3 | 2.2 / 3.2 | 8 | 6 | 180 s | night |

The cat's tint is the level's `tint` (the mesh is a creature, so it takes the tint). The background and fog come from the level.

## Controls

WASD / arrows move. Space hops. Touch: joystick and Hop. Scheme `joystick`. The same hop, mercy and pickup constants run on both devices. No action button. The shell owns pause. `clockChip` stays on. HUD: a "Hop ready" pill (`data-arcade-safe-area`). Stat chip: Treats (`treats`, max = the level's treat count). `resultDelayMs` 900.

## Server limits

`base = 45 × treats + 20 × toys` (the most a clear can score before the time bonus). `maxDurationMs` is the level clock. `minDurationMs` 4000. `unitLabel` "pts", `display` "int".

The sketch in the spec used `maxPointsPerSec` 18 / 16 / 14 / 10 / 9. The honest bot's fastest clears need more, because the +4 per second bonus makes a fast clear worth far more than the sketch assumed. The limits below replace the sketch. Each is checked by `rules.test.ts` (honest bot, 8 seeds at 60 Hz, plus seed 1 at 30 and 144 Hz; idle and spam bots).

| L | maxScore | base | maxPointsPerSec | maxDurationMs |
|---|---:|---:|---:|---:|
| 1 | 700 | 380 | 46 | 90 000 |
| 2 | 970 | 560 | 23 | 120 000 |
| 3 | 1270 | 760 | 30 | 150 000 |
| 4 | 1410 | 940 | 17 | 150 000 |
| 5 | 1730 | 1185 | 13 | 180 000 |

Level 5 `maxScore` 1730 is under `3 × 700`. The honest bot's best win on each level is at least 90 % of its `maxScore` (asserted in the test).

`meta.ts` and `rules.ts` `PROPOSED_LEVEL_LIMITS` carry the same five, and `levels.test.ts` checks that they match. Claude copies them into `arcade-games.json` at the gate. The bot is a proof of the limits, not a balance study: it uses a dodge rule (steer away from a chasing vacuum within 1.8 m) and a hop when a vacuum is within 1.3 m. Without the dodge rule it could not win levels 3 to 5.

## Look

One palette in `looks.ts`. Floor `#e7e5e4`, walls `#d6d3d1`, accent `#fb923c`. Decor is built at unit size and scaled per spot. Vacuum `#94a3b8` with a glowing sensor ring. The cat's tint is the level's tint. Camera: follow, pitch 55°, yaws `[0, π/2]`, fov 46, `followFocus` fraction 0.45, `shift: true`.

Primitives (`Primitives.tsx`) are bevelled `RoundedBoxGeometry` stand-ins with two or three tones. The treat is a glazed puck with a brighter core. The toy is a yarn ball with a ring. The vacuum is a disc, a dome and a glowing ring. Furniture falls back to two bevelled boxes per piece (body and top).

## Models

Every url is `/models/3d/cat-vs-robot-vacuum/<id>.glb`, unlisted in `modelManifest.ts`, so the fallbacks draw and no request is made.

| Asset id | File | Used as |
|---|---|---|
| `cat` | `cat.glb` | the cat (`<Model tint>`; not humanoid, not auto-rigged) |
| `robotVacuum` | `robotVacuum.glb` | vacuums (`<DynamicInstancedModel>`) |
| `catTreat` | `catTreat.glb` | treats (one dynamic pool) |
| `catToy` | `catToy.glb` | toys (one dynamic pool) |
| `catBox` | `catBox.glb` | clutter (`<InstancedModel>`) |
| `sofa`, `bed`, `table`, `bookshelf` | shared ready files | furniture (`<InstancedModel>`) |

Not used: `catTree.glb` (the spec says adopt `catTreeR.glb`, which is not in this game yet). `EXPANSION_ASSETS.vacuum` is a backpack and is not used.

Still needed from Hyper3D (`docs/menu1-new/hyper3d-needed.md`): `catTreatFish` (regen: a flat blob), `catToyPlush` (regen: a cartoon mouse with a face), `bookshelfFull` (shared, regen: shelves mostly empty).

## What Claude registers at the gate

1. `src/arcade3d/types.ts`: `cat-vs-robot-vacuum` is already in `ARCADE_SLUGS`. No change.
2. `src/arcade3d/loaders.ts` and `registry.ts`: the stub is already registered on main. No change unless the stub changes.
3. `play50games-backend/play50games/includes/arcade-games.json`: copy the five limits above (level 1 is the top-level `scoring`). `enabled: false` until the go-live.
4. Copy the GLBs listed above to `public/models/3d/cat-vs-robot-vacuum/`, list them in `modelManifest.ts`, and set each asset's `scale`, `stretch` and `yOffset` from the measured bounds in `assets.ts`. Treats and toys sit at 0.12 and 0.15 m above the floor and are sized for pickups at 0.5 m.
5. `public/images/3d/cat-vs-robot-vacuum.webp` (thumbnail) is not built yet. `meta.thumbnail` is `null`.

## Known issues

- The GLB scales are placeholders (the fallback sizes), until the assets PR measures the models.
- The honest bot is a test tool: it wins every level, but its dodge rule is much better than a human's. The limits are generous to humans and must be re-proven if the balance changes.
- Clutter (levels 4 and 5) sits only in the free bay of rooms 1 and up, so it can never block the lane or the bed.
- No hop cooldown beyond the 0.3 s gap. Holding Space does not chain hops.
- The vacuums do not avoid furniture while patrolling the lane; the lane is always open, so they never need to.
