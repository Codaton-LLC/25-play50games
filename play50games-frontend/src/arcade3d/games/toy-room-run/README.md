# Toy Room Run (Menu 2, game 18, World 4 Frost & Sweets)

Status: **dev** (`enabled: false` in `arcade-games.json`, registry order 76). Design card:
`docs/menu2-super/world-4-frost-and-sweets.md` "18 Toy Room Run". Lead hero Zuno (`DEFAULT_HERO`).

## The game

**Signature: ride the domino wave.** A giant playroom: desks and shelves high above the carpet, split by
gaps of 10 m or more that no jump crosses. Walk into the first piece of a chain (dominoes, books, keyboard
keys) and the wave runs along it at the chain's speed. Each piece falls flat as the wave reaches it, and the
pieces over a gap lie down as a bridge. A timed bridge slides off 1.8 s after its piece falls, so you
follow the wave across a step behind its front. A standing piece bounces you back out through the face you
hit. An empty slot stalls the wave until you push a spare piece in. A fork starts a second chain off a
parent piece. The wave also fires toy drums (stand on one as it is hit and it throws you onto the shelf),
starts race cars, and on level 5 drops books on Jack Wobble. The topple is a scripted timeline
(`fallAt[i] = start + s / speed`), never physics, so 30, 60 and 144 fps agree.

Controls: WASD / arrows (camera-relative), Space jumps, E / Enter is the hero power. On touch: joystick,
Jump, Power. Camera: the shared free orbit (`menu2/camera`): drag or two fingers, wheel or pinch, Q / C,
R / F, V.

## Levels

| | Name | Twist |
|---|---|---|
| 1 | Desk Start | Three beats: one push and an untimed line bridges the first gap; a 4 m/s line you follow over the next gap; a key chain that hits a toy drum, which throws you up onto the shelf over the last gap. |
| 2 | Book Bridge | Stalled chains: empty slots stop the wave until a spare is pushed in (Zuno's magnet pulls one from 5 m). The first fork: a short branch to the right (it stalls) or a longer one to the left. |
| 3 | Race Track | The wave starts toy race cars. Two cross the desk in front of you (dodge them); one waits on a long floor track: land on its roof for a ride. |
| 4 | Lights Out | Night: only fallen pieces glow, so you see the bridge but not the gap. Spinning tops wander and bump you. The wave runs at 9 m/s, faster than you, so stay close behind it. |
| 5 | Toybox Finale | Jack Wobble (below). Three toyboxes along the back, with a book chain from the middle to each box that re-arms 2.5 s after it falls, plus the giant book-stack line. |

Every level also has a cascade zone (toy-block towers that fall across it every 3.2 s), a cracked block
wall, a toy castle with a ghost doorway, a pencil ramp up to a high bookshelf ledge, hidden orbs under the
rug and four checkpoints.

## Hero roles (every level has all five)

- **Riko**: the dash (+6 m/s for 0.4 s, 3 charges a run) catches a lost wave and breaks the cracked block
  wall in front of a side nook. Its shard is inside.
- **Nami**: the second jump goes from the pencil ramp to the high bookshelf ledge (the orb route and the
  shelf shard).
- **Kiro**: the shield: block cascades and spinning tops do not knock him.
- **Zuno** (lead): the magnet: coin trails come out from under the rug, and a spare piece slides into its
  stalled slot from 5 m.
- **Vexa**: the phase takes her through the ghost doorway of the toy castle to its sticker.

## Boss: Jack Wobble (L5, `progression.ts` JACK, 6 HP)

`m2JackBoxBoss` in front of three code-built toyboxes with lids (`Boss.tsx`). His hits come only from the
chains, never from the hero.

1. **Whack** (3 hits): a lid rattles (1.6 s telegraph), he springs out of that box and sways there, dazed
   (3.2 s): start the book chain to that box so its last book drops on his spring.
2. **Throwback** (2 hits): he spits toy blocks that land on end as a new chain toward his box. Push it back
   at him while he is out (3.6 s).
3. **Bounce** (1 hit): he bounces round the room, slams down in front (a knock if you are within 3.6 m of
   the landing) and crouches there for 1.5 s: topple the giant book-stack line onto him.

## Score limits (time game)

Submitted duration = finish ms - 150 ms x orbs - flow bonus (`finalScore`). The server computes the
score `floor((timeBaseMs - duration) / 10)`.

The proof (`rules.ts` header, the "proof" section):

1. **The invariant.** At the end of every simulated ms, the hero's horizontal move is clamped to
   V_RUN / 1000 m (6.5 m/s) plus the speed of an active boost. Only two boosts exist: Riko's dash
   (3 charges x 0.4 s x 6 m/s = 7.2 m) and one ride per race car (the car's speed over V_RUN for its track).
   `boostBudgetMetres` sums them. Drum throws, bounces, knocks and collision pushes all go through the same
   clamp. `proof.test.ts` checks the clamp and the boost budget on every ms of random runs on all five
   levels.
2. A respawn always returns to a checkpoint already reached, so it never shortens the route.
3. Least travel = the straight line from the start to the finish minus the finish reach (2.5 m). Every desk,
   gap, shelf and wall only makes the real route longer.
4. Least finish = (least travel - boost budget) / V_RUN. Level 5 instead uses Jack's least defeat time
   (`bossMinMs`: every hit on the first ms of its window, 19.7 s). Level 5's travel is ignored.
5. Least duration = least finish - every orb (hidden ones included) x 150 ms - `comboMaxBonus` (each chain
   once, each gap once at the surf rate, each orb, each hit). minDurationMs = 95 % of it, floored to
   100 ms. maxScore = (timeBaseMs - minDurationMs) / 10.

| Level | timeBaseMs | least travel | boost budget | least finish | orbs | flow max | minDurationMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 Desk Start | 120000 | 121.5 m | 7.2 m | 17.6 s | 24 | 0.81 s | 12500 | 10750 |
| 2 Book Bridge | 150000 | 137.5 m | 7.2 m | 20.0 s | 34 | 1.14 s | 13100 | 13690 |
| 3 Race Track | 160000 | 155.5 m | 19.1 m | 21.0 s | 33 | 1.03 s | 14200 | 14580 |
| 4 Lights Out | 170000 | 163.5 m | 7.2 m | 24.0 s | 36 | 1.11 s | 16600 | 15340 |
| 5 Toybox Finale | 200000 | boss | - | 19.7 s | 15 | 0.71 s | 15900 | 18410 |

These rows are in `meta.ts` (via `PROPOSED_LEVEL_LIMITS`, kept equal to `proposeLimits` by test),
`arcade-games.json` and the `PINNED` table in `rules.test.ts`.

## What the bots reached

`bot.ts` plays like a careful player with no power. For each gap it picks the chain that bridges it
(fewest empty slots), walks into the root starter from behind, pushes a spare into a stalled slot, and
follows the wave a step behind its front. It walks round standing pieces to the drum, and on level 5 it
starts the right chain for each of Jack's windows. Submitted times at 60 fps (Zuno), with the share of
maxScore:

| Level | submitted | score / maxScore | main orbs |
|---|---:|---:|---:|
| 1 | 23.1 s | 90 % | 8 / 16 |
| 2 | 23.7 s | 92 % | 9 / 26 |
| 3 | 24.7 s | 93 % | 12 / 25 |
| 4 | 23.8 s | 95 % | 10 / 28 |
| 5 | 38.2 s | 88 % | 3 / 8 |

All levels win at 30, 60 and 144 fps, and none goes under the floor. Every hero clears every level with the
plain bot. With each hero's power mashed, and in 200 spam runs on L1 plus 30 on each level (random stick,
jump, power, frame times and hero), nothing beats the floor (`rules.test.ts`, `proof.test.ts`). An idle run
times out unranked.

## Stars, secrets, juice

- Stars (`menu2/stars`): clear the level, collect every main orb, and beat the target time (55, 75, 90, 105
  and 140 s). No-hit badge: never knocked by a cascade, a top, a car or Jack. Bounces off pieces don't
  count.
- Secrets (`menu2/secrets`): the castle sticker (Vexa), the wall shard (Riko), the shelf shard (Nami).
- Flow (`menu2/combo`): a chain started, a gap crossed (doubled when surfing within 3 m of the wave front),
  an orb, a hit on Jack. The link window is 2.5 s, x2 cap.

## Multiplayer (1-4, `multiplayer.ts`)

- **Versus**: each player rides only the waves they start (each run keeps its own topple timeline). Orbs
  are shared (first come). First to the toy chest wins.
- **Co-op**: one shared playroom. The chains, spares, drums, cars and walls are the same arrays for
  everyone, so one push sets a bridge for the team and Zuno's magnet fixes a stalled chain for all. Kiro's
  shield, Zuno's magnet and Vexa's phase cover the team.
- Multiplayer runs are never ranked.

## Models

`public/models/3d/toy-room-run/` holds m2ToyDomino, m2BookStack, m2KeyboardKeyV2, m2WindUpKey,
m2GiantPencil, m2ToyBlocks, m2SpinningTop, m2ToyDrum, m2ToyRaceCar, m2ToyCastleBg and m2JackBoxBoss. Two
models are reused by url: color-city-sprint's m2EnergyGem (orbs) and menu2's checkpointBeacon. The pieces
are drawn instanced (`Course.tsx`) with their standing and toppled matrices. The desks, shelves, carpet,
walls and toyboxes are code-built. `assets.test.ts` tests the fits against the measured meshes.

## Open issues

- Level 5 in multiplayer: each player fights their own Jack, and the camera shows player 1's.
- The bot never uses a power, so it takes about a third to a half of the main orbs. The "all orbs" star is
  proven reachable by the placement tests (`layouts.test.ts`), not by a bot run.
- At 144 fps the L5 bot misses some of Jack's windows and wins in 69 s (still inside the limits).
