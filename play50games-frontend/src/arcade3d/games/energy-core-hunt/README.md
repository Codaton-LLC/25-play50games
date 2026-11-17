# Energy Core Hunt (Menu 2, game 29, World 5 Neon Cosmos)

A third-person mission arena. Fill the order: take exactly the coloured energy cores it asks for, then leave through the core gate.

- Lead hero: Vexa.
- Status `dev`, order 96, collection `rollheroes`, owner `claude`.
- A time game.
- Card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 29".

## Concept and controls

- **Free movement.** The hero walks freely round a square reactor arena at 6 m/s.
  - WASD / arrows or the stick move, relative to the camera.
  - Space or Jump jumps.
  - E / Enter or Action opens a sealed capsule in reach (1.6 m); away from one, it uses the hero power.
- **The order.** The HUD's chips ask for so many cores of each colour: the card's 6 cores in 2 colours on level 1, up to 20 in 5 colours on level 5.
  - Cores drop into the arena in **waves**. Each core takes 1 s to land and can't be taken while it falls.
  - The next wave drops as soon as this wave's share of the order is in.
  - Walking into a wanted core takes it.
  - A core of a colour that is already full, or a flickering decoy, is a **wrong pick**: a jolt, 0.8 s stunned, a hit.
- **The gate.** When the order is complete, the core gate at the north edge opens. Walk in to finish.
- **Camera.** The shared Menu 2 orbit camera, looking north over the arena: drag or two fingers, wheel or pinch, Q / C / R / F, V to recenter.

## Files

| File | What |
|---|---|
| `levels.ts` | The five level configs: the card's timer, arena size, colours, cores, core life, star target, boss. |
| `course.ts` | The arena: the waves and the order, crates, tesla coils, orbs, secrets, the Core Sprite (pure). |
| `rules.ts` | The pure, deterministic simulation (4 ms steps), the store hand-off, the limits and their proof. |
| `bot.ts` | The honest bot (tests and `?autoplay=1`), with optional hero routes. |
| `heroes.ts`, `progression.ts` | The hero roles, flow meter, stars, secrets and `CORE_SPRITE`. |
| `assets.ts`, `look.ts` | The models with their measured sizes; the core colours, the palette and the light per level. |
| `Arena.tsx` | The floor and reactor columns, crates, cores (dropping, fading, orbiting, capsules), decoys, teslas, the gate, orbs, secrets. |
| `World.tsx` | The hall: a dark dome with a light grid, dust motes, lights. |
| `Hero.tsx`, `Sprite.tsx` | The hero; the Core Sprite, the cores it holds and its shock ring. |
| `Scene.tsx`, `Juice.tsx`, `camera.ts` | The run, the input mapping, the juice, the camera, the intro. |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | The HUD (the order chips, waves, the gate and capsule prompts), the star screen, progress. |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | Local play for 2-4 players. |

## Hero roles (the card: every power, tuned so none skips the order)

| Hero | Power | What it opens |
|---|---|---|
| Riko | Dash: x1.6 for 0.6 s, every 5 s | Speed across the arena. |
| Nami | A second jump in the air | The orbs and the sticker high beside the crate stacks. |
| Kiro | Shield: 1.2 s, every 8 s | Shrugs off tesla sparks and the Core Sprite's shock ring. |
| Zuno | Magnet: 3 s, every 8 s | Pulls in the golden orbs, including the crate ring's from outside; never the cores. |
| Vexa | Phase: 2.6 s, every 7 s | Walks through crates, into the closed crate ring (its orbs, the shard). |

## Levels

1. **Simple Hunt** (2 colours, 6 cores; 60 s, star 15 s). Wave 1 asks for red only, and the blue core next to it is not wanted yet: the primary interaction.
2. **Mixed Colors** (3 colours, 9 cores; 75 s, star 20 s). New rule: a core left too long (9 s) fades and drops again across the arena.
3. **Larger Arena** (4 colours, 12 cores; 90 s, star 28 s). Moving and hidden targets: cores circling their pylons, cores sealed in capsules (Action opens them).
4. **Moving Cores** (5 colours, 15 cores; 105 s, star 35 s). Shorter windows (6.5 s), flickering decoy cores over a dark ring, and two tesla coils sparking on a rhythm.
5. **Core Master** (5 colours, 20 cores; 120 s, star 60 s). Four dense waves of 4, then the boss (below).

### Boss: the Core Sprite (`CORE_SPRITE`, 4 hp)

It wakes once the last wave is in, holding the order's last four cores, which circle it. It hops to a new spot as each telegraph begins, rears up and slams. A shock ring then rolls out across the floor: jump it. While it is dazed (gold), touch it: a core comes loose and counts toward the order.

1. **Hopping:** 2 hits.
2. **Rushing:** 1 hit.
3. **Overcharge:** 1 hit.

## Stars, flow, secrets

- **Stars:** clear; every main orb (the route orbs are extra); and the submitted time at or under the star target.
- **No-hit badge:** no wrong pick, no zap, no shock.
- **Flow meter:** a link within 3 s, +0.25 per link, capped at x2. An orb links 30 ms; a core of the order links 90 ms.
- **Secrets:**
  - Levels 1 and 4: the crate-ring shard (Vexa) and the crate-top sticker (Nami).
  - Levels 2, 3, 5: the crate-ring shard.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 100 ms per orb, minus the flow bonus. Only a win is ranked; the time base is the card's timer.

### Server limits and why they hold

The bound (`waveMinMs`, `minFinishMs`, `minDurationMsOf` in `rules.ts`):

- **Waves.** A wave drops only once the one before is in, and its cores take `DROP_MS` (1 s) to land. The hero must then touch as many of its cores as the wave asks for. Any two of them are at least the wave's closest spacing apart, counting both fading spots and the orbit circles, less the 1 m pick-up reach at each end. That walk is costed at the walk speed with Riko's dash allowance.
- **Level 5.** It adds the Core Sprite's least defeat time (a hit in the first ms of every dazed window); it wakes only once the last wave is in.
- **Bonuses.** From the floor we subtract:
  - every main orb, plus the largest route set one hero can reach (`ROUTES`);
  - the most flow bonus the order can feed.
- **The limit.** The bound less 5 %, rounded down to 100 ms (`proposeLimits`), pinned in `rules.test.ts`.

The guards in the tests:

- 60 spam runs never beat the floor.
- Every hero with its power mashed never beats the floor.
- The honest bot wins through the real store with ragged frames: a ranked win inside the limits.

## What the bots reached

The honest bot (no routes, the one `?autoplay=1` uses) wins every level at 30, 60 and 144 fps:

- with exactly the order;
- with every main orb;
- never hit.

Submitted times at 60 fps: about 5.8 / 6.2 / 12.2 / 13.2 / 32.1 s.

Every hero's bot with its own route wins every level and never beats the floor. Vexa takes the ring shard; Nami takes the crate-top sticker.

## Models

Only Hyper3D models that already existed; no credits were spent.

- The ready energy-core-hunt set: energy core (tinted per colour at runtime), arena crate, core gate (and V2), core capsule, core pylon, tesla coil, reactor columns, and the Core Sprite (the boss).
- The shared Menu 2 orb, beacon and hero GLBs.

The new boss GLBs in `p50-assets/hyper3d-new` are unoptimized (7.6–10 MB each), and none of them is this game's, so none is used.
