# Neon Cube Jump (Menu 2, game 7, World 5 "Neon Cosmos")

Neon cubes float over a violet void in two sets: A (square glyph) and B (triangle). Only one set is
solid; the other is a wireframe hologram you fall through. **Every jump flips the field on takeoff**, so
every jump lands on the other set. Lead hero Vexa (World 5); the shared hero picker is on the start
card, the pause menu and the result. Order 83, status `dev`, owner claude, a **time** game. Design
card: scratchpad `m2b/w5-neon-cosmos.md` "7 Neon Cube Jump".

## Files

- `levels.ts` the five level rows; `course.ts` the cube fields (grid cell (i, j, h): a 2 m cube at
  x = 2i, z = -2j, top 2h), orbs, coins, ghost walls, drones, the parity shard, Nami's ledge, the bot's
  route and Flipframe's arena.
- `rules.ts` pure deterministic rules (1 ms steps, `MAX_STEP_MS` 50): the run, the jump and the flip,
  landing and walking off, rails, rogue clocks, lasers, drones, the void and the checkpoint, powers,
  pickups, secrets, Flipframe, the bound (`vBound`, `minFinishMs`, `maxBonusMs`, `proposeLimits`).
- `bot.ts` an honest player: it follows the route and reads what a player sees before each jump (the
  set the jump makes solid, rogue clocks, moving cubes, drones), and plans each hop in the arena.
- Scene: `Scene.tsx` (the flip ripple, `?autoplay=1`), `MultiScene.tsx`, `World.tsx` (void, grid,
  neon city, ringed planet, stars), `FieldView.tsx` (solid GLB cubes, wireframe holograms, glyphs,
  pads, beacons, lasers, drones, orbs, coins, secrets, the landing preview), `Boss.tsx`, `Hero.tsx`,
  `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` (the flip panel), `StarResult.tsx`, `levelEnd.ts`.
- Tests: `rules.test.ts`, `proof.test.ts`, `assets.test.ts`, `multiplayer.test.ts`, `orbit.test.ts`.

## Rules

- Run 6 m/s (camera-relative stick); a jump clears 2.6 m (one cube up) and carries 4-5.6 m (two cubes
  across). Jumping flips A / B on takeoff; walking or rolling off an edge does not. Coyote 90 ms,
  buffer 110 ms.
- Neutral cubes (start, checkpoints, the goal, the arena floor) are always solid; rogue ring cubes keep
  their own 1.6 s clock; B cubes on rails slide at 2 m/s only while solid (a hologram freezes: park
  it); laser walls and sentry drones belong to a set and only bite while it is solid.
- The void, a live laser or an active drone send you back to the last checkpoint, with the field as it
  was there and the jump parity reset.

## Hero powers (E / Enter / Power)

| Hero | Power |
|---|---|
| Riko | air dash: 4 m in 0.2 s, no flip (cooldown 1.2 s) |
| Nami | her second jump in the air flips again: she lands on the set she left (the same-set ledge) |
| Kiro | shield 1.5 s: stand in a live laser, shrug off a drone or a stomp |
| Zuno | magnet 3 s: the coin trails hidden inside the cubes, from 5 m |
| Vexa | phase 0.6 s: holograms hold her; ghost walls let her through (two per level) |

## Levels

1. Static Grid: B holograms ahead (jump and they turn solid), the A cube behind that vanishes on
   your next jump, a six-cube A / B staircase.
2. Moving Cubes: B cubes on rails, moving only while solid.
3. Blink Grid: rogue ring cubes on their own 1.6 s clock; Nami's same-set ledge sticker.
4. Laser Grid: set lasers and sentry drones; Kiro's laser route.
5. Neon Overdrive: Flipframe (7 hp), a 3 x 3 giant of cubes round its core (m2FlipframeCore on a
   sentry drone). P1: it stomps the set it shows (and the floor): be on the other set (3 dodges crack
   it). P2: its core drops onto a hologram cube: jump so it turns solid and land on it (3 hits). P3
   Overdrive: the field flips by itself every 1.2 s too: climb the tower to the core (1 hit).

Secrets: the parity shard (taken only after an even number of jumps since the checkpoint), two Vexa
ghost-wall crystals (level 3: one, and Nami's ledge). Stars: clear, all 12 orbs, target time; the no-hit
badge counts falls, lasers, drones and stomps.

## Scoring and server limits (why they hold)

A time game: the submitted time is the finish less 0.15 s an orb, 0.08 s a coin and the flow bonus
(each cube's first landing, chained within 1.5 s; Flipframe's hits). Each level row is
`proposeLimits(courseFor(level))`:

- the least finish: the straight line on the plane from the start to the goal (level 5: to
  Flipframe's wake line, plus its least defeat time, `bossMinMs`) at `vBound` = 6 m/s run + 3 m/s
  (Riko's dash averages 2.33 m/s more at most, with margin for the rare push out of a cube that turned
  solid) + 2 m/s rail carry on level 2;
- less the most bonus (every orb and coin, `comboMaxBonus` over every cube once and every hit);
- less 6 %, to the 100 ms below; `maxScore = floor((timeBase - min) / 10)`.

| Level | min (ms) | max (ms) | maxScore |
|---|---|---|---|
| 1 | 2100 | 150000 | 14790 |
| 2 | 1500 | 180000 | 17850 |
| 3 | 2100 | 200000 | 19790 |
| 4 | 2100 | 220000 | 21790 |
| 5 | 12500 | 300000 | 28750 |

The straight-line floor is loose by design (it holds whatever route a player finds); the bonus is
small. `proof.test.ts`: every hero with its power mashed, spam at random frame times, mutation probes.

Honest bot (seed 1, 60 fps): L1 10.1 s, L2 18.4 s (one fall), L3 11.6 s, L4 11.8 s, L5 33.1 s
(Flipframe down), every hero.

## Models

`public/models/3d/neon-cube-jump/`: m2NeonCube, m2EnergyPad, m2LaserWall, m2DigitalCoin,
m2NeonSentryDrone, m2NeonCityBg, m2FlipframeCore (the boss core, 804 KB, character budget). Shared
from `menu2/`: checkpointBeacon, scoreOrb, the five heroes. Not used from the ready set:
m2LaserWallV2, m2NeonSentryDroneV2 / V2I, m2NeonSpikeBlock / V2, m2NeonWedgeRamp. The card's
m2RingedPlanetBg is not in the ready set: the ringed planet is drawn in code. The hologram look is a
code wireframe.

## Multiplayer (local 2-4)

Co-op shares the flip bus (anyone's jump flips everyone: `NeonRun.pendingFlips`); versus keeps each
player's own flip state and ranks by finish time.

## Known issues / open

- Energy pads are drawn on the neutral cubes but no level uses a launch pad (the card's "free jump").
- The co-op "Hold!" ping and the party mode are not built.
- No thumbnail yet (`meta.thumbnail: null`).
