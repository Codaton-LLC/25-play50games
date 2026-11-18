# Crystal Cave Switch (Menu 2, game 44, World 5 "Neon Cosmos")

A crystal cave of linked rooms over a violet chasm. Each room's gate opens when its crystal switches
are struck in the order its beacon shows. Lead hero Vexa (World 5); the shared hero picker is on the
start card, the pause menu and the result. Order 90, status `dev`, owner claude, a **time** game.
Design card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 44 — Crystal Cave
Switch" (a colour-switch puzzle, 2-6 linked objectives, 75-150 s targets); the Hollow Prism (World 5's
guardian) is the level 5 boss.

## Files

- `levels.ts` the five level rows; `course.ts` the rooms (12 x 10 m floors, a north wall of rock with
  a gate in the middle, a crystal bridge to the next room), crystals, beacons, ledges and boulder steps,
  the moving slab, Vexa's ghost alcoves, Nyla's high pillar, orbs, the goal pad, the Prism's arena and
  the bot's route.
- `rules.ts` pure deterministic rules (1 ms steps): running, jumping, landing on boxes, striking
  crystals, the room sequences (order, decoys, timers), gates, the slab, the chasm and the room
  entrances, powers, secrets, the Hollow Prism, the bound (`minPathM`, `minFinishMs`, `maxBonusMs`,
  `proposeLimits`).
- `bot.ts` an honest player: it follows the route (the crystals in each beacon's order), jumps onto the
  ledges, rides the slab, and in the arena steps out of the beam's lane and strikes the code.
- Scene: `Scene.tsx`, `MultiScene.tsx`, `World.tsx` (the cavern), `CaveView.tsx`, `Boss.tsx`,
  `Hero.tsx`, `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` (the sequence panel), `StarResult.tsx`,
  `levelEnd.ts`.
- Tests: `rules.test.ts`, `proof.test.ts`, `assets.test.ts`, `multiplayer.test.ts`, `orbit.test.ts`.

## Rules

- Run 6 m/s (camera-relative stick), jump 2.6 m. Action beside a crystal (1.6 m) strikes it; away from
  one it fires the hero power.
- Colours read by shape too: ruby triangle, sapphire square, emerald diamond, topaz circle.
- The right crystal lights and the beacon's next glyph pulses; a wrong crystal or a decoy (L4+) resets
  the room. Timed rooms (L4+): once the first crystal is struck the sequence must finish in time.
- A fall into the chasm puts you back at the room's entrance; what you lit stays lit.

## Hero powers

| Hero | Power |
|---|---|
| Riko | dash: 4 m in 0.2 s, ground or air (cooldown 1.2 s) |
| Nyla | double jump: the high crystal on its pillar (a sticker) |
| Kiro | shield 1.5 s: the Prism's beam passes him |
| Zuno | magnet 3 s: strikes crystals from 4 m |
| Vexa | phase 0.6 s: through the ghost wall to the alcove crystal (a shard) |

## Levels

1. Two Crystals: two rooms, long windows.
2. Three Sequence: three rooms; a moving slab carries you to a crystal island.
3. Hidden Crystal: four rooms; crystals on ledges (a boulder step up) glow only when you are near.
4. Timed Sequence: five rooms; sequence timers and decoys.
5. Crystal Master: three rooms combining everything, then the Hollow Prism (6 hp): its tell paints a
   lane toward you and the beam burns it (step out, or Kiro's shield); while its core is open it shows
   a colour code over itself: strike the arena's corner crystals in that order (P1 one colour x3, P2
   two x2, P3 three: the finish).

Secrets: Flawless (no wrong crystal all level), Vexa's ghost alcove crystal, Nyla's high crystal.

## Scoring and server limits (why they hold)

The submitted time is the finish less 0.15 s an orb and the flow bonus (each crystal's first right
strike chained within 5 s; each Prism hit). Each level row is `proposeLimits(courseFor(level))`:

- the least path: through every room's crystals in order (each struck from Zuno's 4 m reach) and its
  gate, to the goal (level 5: to the Prism's wake line), straight lines between them; at `vBound`
  = 6 m/s + 3 m/s (Riko's dash averages 2.33 m/s more at most) + 2 m/s where a slab moves; level 5 adds
  the Prism's least defeat time (`bossMinMs`);
- less the most bonus; less 6 %, to the 100 ms below; `maxScore = floor((timeBase - min) / 10)`.

| Level | min (ms) | max (ms) | maxScore |
|---|---|---|---|
| 1 | 600 | 180000 | 17940 |
| 2 | 1700 | 210000 | 20830 |
| 3 | 2800 | 240000 | 23720 |
| 4 | 4000 | 270000 | 26600 |
| 5 | 14800 | 360000 | 34520 |

The floor is loose by design (it holds for every hero, Zuno's long reach included).

Honest bot (seed 1, 60 fps, every hero): L1 8.8 s, L2 24.5 s, L3 21.2 s, L4 26.4 s, L5 61.3 s (the
Prism down), no falls, no wrong crystals.

## Models

`public/models/3d/crystal-cave-switch/`: m2CrystalSwitch, m2CaveGate, m2CrystalBeaconPillar,
m2CaveSlabPlatform, m2CrystalSlabBridge, m2CaveBoulder, m2GrottoWallBg, m2HollowPrismBoss (699 KB,
character budget). The orb is the shared scoreOrb. Not used: m2GrottoWallBgV2.

## Multiplayer (local 2-4)

Co-op shares the rooms (anyone's strike lights the crystal for the team); versus keeps each player's
own rooms and ranks by finish time.

## Known issues / open

- No thumbnail yet (`meta.thumbnail: null`).
