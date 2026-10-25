# Haunted Mansion Keys

Game 39 · time · difficulty 2 · adventure · owner antigravity (built by Antigravity, gated by Claude 2026-10-25).
Spec: `docs/menu1-new/specs-31-40.md` §39.

A grid of 6 × 5 m rooms. Find each coloured key (tint plus shape), open its door, and reach the exit room.
Hold Use (E / Enter / touch Use) for 0.20 s within 1.2 m to take a key, open a door or pull the lever. The
finishing time is the score: `max(0, floor((timeBaseMs − durationMs) / 10))`, ranked on a win only.

## Rules (`rules.ts`, pure and seeded)

- A random backbone from room (0,0) to the far corner, split into `keys + 1` wings; the other rooms join a
  neighbouring wing. Rooms of one wing share open doorways; one locked door joins wing i to wing i+1; the last
  one is the exit door. Every other wall between wings is solid.
- **Key i lies in wing i**, in the room of that wing farthest (through its open doors) from where the wing is
  entered, on a seeded furniture slot: key 0 on the chest, the others on a pedestal. So a key is always
  reachable before its door and always behind the previous one.
- **Lever (L3+)**: in a start-wing room; it opens one extra door between the two closest wings that share a
  wall (one locked door skipped, two where the grid allows nothing closer: about 1 seed in 7). The level is
  solvable with the lever unused (flood fill, 200 seeds per level).
- **Armour (L4–L5)**: `stepPatrol` along the far half of the backbone at `armourSpeed`; a touch outside the
  0.80 s mercy costs a life and puts the detective back at the room's entrance. 3 lives.
- **Furniture** (solid): a table or chair on free slots, a grandfather clock and a bookshelf against the back
  wall of the first row. Slots sit off every doorway lane (tested).
- Movement: on-foot, top speed 4.4, exponential accel / brake (the same speed curve at 30, 60 and 144 Hz:
  the helper's linear `min(1, k·dt)` gave 30 Hz a faster start, now fixed). Every timing (the 0.20 s windup,
  the 0.80 s mercy) is play time and the same for keyboard and touch (one `action` field).

## Levels

| L | Title | Grid | Keys | Lever | Armour | Timer = timeBaseMs | Lives | minDurationMs | maxScore | Oracle best | Honest finish |
|---|---|---|---:|---|---|---:|---|---:|---:|---:|---:|
| 1 | Entrance Hall | 3 × 1 | 2 | – | – | 180 s | – | 1400 | 17860 | 2433 ms | 200/200 |
| 2 | Library | 3 × 2 | 3 | – | – | 210 s | – | 4100 | 20590 | 5133 ms | 200/200 |
| 3 | Bedrooms | 4 × 2 | 3 | yes | – | 240 s | – | 3000 | 23700 | 4067 ms | 200/200 |
| 4 | Basement | 5 × 2 | 4 | yes | 1.6 m/s | 240 s | 3 | 5000 | 23500 | 6033 ms | 200/200 |
| 5 | Grand Mansion Escape | 4 × 3 | 5 | yes | 1.9 m/s | 300 s | 3 | 6800 | 29320 | 8067 ms | 200/200 |

L5 maxScore / L1 = 1.64 (≤ 3). Every level's maxScore ≥ L1's. Lighting: L1–L2 indoor, L3–L5 night, closer fog.

## Server limits and why they hold

Time game: `base 0`, `maxPointsPerSec 0`, `maxDurationMs = timeBaseMs = durationMs`; the server recomputes the
score from the duration, so the only bound to prove per level is **minDurationMs, the fastest legal finish**.

- Lower bound: the oracle bot (`testing/bots.ts`): plans on a 0.25 m grid round every wall, closed door and
  piece of furniture with a 3 cm margin (corners cut), holds Use the whole way (a windup starts the instant a
  target is in reach), and is run twice per seed, with and without the lever (skipping every locked door the
  shortcut bypasses); the faster win counts. Swept over 200 seeds × 30 / 60 / 144 Hz per level (offline;
  results in the table).
- `minDurationMs = floor100(min(best − 1 s, 0.85 × best))`; `maxScore = floor((timeBaseMs − minDurationMs) / 10)`.
- `rules.levels-N.test.ts` pins each level's fastest sweep seeds plus 15 more at all three rates: no oracle
  win under `minDurationMs`, the score equals `computeTimeScore`, and the best win stays within the margin
  (the limit is not loose). The honest bot (85 % speed, stops to hold Use, backs away from the armour, never
  uses the lever) finishes ≥ 99 % of 200 seeds (random frame lengths on a third); idle never finishes
  (timeup, unranked); input spam never wins under the limit.
- Mutation probes (gate, 2026-10-25): ignoring the level's keys, cols, rows, lever, armour, armour speed,
  lives, time base or timer, placing keys in room 0, leaving the shortcut's wall solid, or picking any wing
  gap each fail a test.

## Look

- Cutaway walls: the back (z = 0) exterior wall is full height (paintings, clocks and shelves stand against
  it), every other wall is 1.0 m, and doors are drawn 1.5 m tall, so the camera (north, pitch 58°) always sees
  the 1.80 m detective. Oak plank floor, gravel apron and dark grounds past the fog (no void at the edges).
- Close follow camera: a 10.4 × 8.8 m window round the aim (a room and a half), clamped to the house.
- Key: one tinted `skeletonKey` pool plus a floating shape plate per key; each locked door carries its key's
  shape plate on both faces. The exit ring glows once the exit door is open.

## Models (adopted 2026-10-25, fits in `assets.ts`, checked in `assets.test.ts`)

`charDetective` (auto-rig, `DETECTIVE_LANDMARKS` from the estimate, `detective.test.ts`: feet, hands, rigid
head, the coat's skirt weights), `skeletonKey`, `mansionDoor`, `wallLeverV2` (on a code post with a code
handle that flips), `grandfatherClock`, `paintingFrame`, `armourStand`; shared `woodenChair`, `table`,
`bookshelf`; `EXPANSION_ASSETS.chest`. Skipped: `wallLever.glb`, `haunted-mansion-keys/hero.glb`, and the new
`wallLeverArm.glb` (not adopted: the spec names V2; decide after a look).

## Known issues / for the playtest

- The landmarks are the heuristic estimate: check the posed detective (hat, coat hem in the walk, arms).
- Orientation of the door, clock, shelf, painting and lever GLBs (assumed to face +z) is unverified in a
  browser; the door's frame depth is squashed to 0.22 m.
- Rodin's key GLB is upright; it spins on its pedestal.
- About 1 seed in 7 on L3–L5 gets a two-wing shortcut (the lever skips two keys); the limits include it.
