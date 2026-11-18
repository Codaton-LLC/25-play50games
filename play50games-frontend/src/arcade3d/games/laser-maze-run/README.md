# Laser Maze Run (Menu 2, game 38, World 5 Neon Cosmos)

A precision maze through a vault of lasers, room by room: time the pulses, jump the beams, flip the switches.

- Lead hero: Vexa.
- Status `dev`, order 89, collection `rollheroes`, owner `claude`.
- A time game.
- Card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 38".

## Concept and controls

- **Free movement.** The hero walks at 5.5 m/s down a corridor of laser rooms (x across, ±4.5 m).
  - WASD / arrows or the stick move, relative to the camera.
  - Space or Jump jumps (apex 1.1 m).
  - E / Enter or Action presses a switch in reach (1.3 m). Away from a switch, the same key uses the hero power.
- **The laser zones.** Each room is one zone: the card's 3 zones on level 1, up to 8 on level 5.
  - Every room starts on a checkpoint pad.
  - A laser touch, a live floor tile or being crushed by a barrier is a hit: back to the pad, 0.7 s frozen, then 1.5 s of blinking.
  - Crossing a room without a hit is a flow link.
- **Lasers.**
  - **Low beams** (amber, 0.05–0.45 m): jump them.
  - **Full walls** (red, up to 1.7 m): find the gap, or wait until a pulsing wall goes dark.
  - **Sliding beams:** a low beam sliding along the floor of a room; jump it as it reaches you.
  - **Gates** (magenta): a switch drops its gate for a few seconds. On level 3 a switch can also turn the next gate on; on level 4 decoy switches wake a sweep.
- **Barriers.** Solid blocks sliding across a room; slip past on the open side.
- **Live floor tiles.** A touch on the ground is a hit.
- **Camera.** The shared Menu 2 orbit camera: drag or two fingers, wheel or pinch, Q / C / R / F, V to recenter. It looks down the corridor, high enough to read the next room.

## Files

| File | What |
|---|---|
| `levels.ts` | The five level configs: the card's target window (the run clock's cap), zones, star target, boss. |
| `course.ts` | The vault: rooms, lasers, switches, barriers, floors, orbs, secrets, the bot's plan, the arena (pure). |
| `rules.ts` | The pure, deterministic simulation (4 ms steps), the store hand-off, the limits and their proof. |
| `bot.ts` | The honest bot (tests and `?autoplay=1`), with optional hero routes. |
| `heroes.ts`, `progression.ts` | The hero roles, flow meter, stars, secrets and `VAULT_CORE`. |
| `assets.ts`, `look.ts` | The models with their measured sizes; the palette and the light per level. |
| `Vault.tsx` | Everything with a rule, drawn from windows round the hero. |
| `World.tsx` | The dark dome with its light grid, dust motes, lights. |
| `Hero.tsx`, `Core.tsx` | The hero; the Vault Core and its sweep. |
| `Scene.tsx`, `Juice.tsx`, `camera.ts` | The run, the input mapping, the juice, the camera, the intro. |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | The HUD (zone n/N, zaps, the switch prompt), the star screen, progress. |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | Local play for 2-4 players. |

## Hero roles (the card: every power stays available)

| Hero | Power | What it opens |
|---|---|---|
| Riko | Dash: x1.6 for 0.6 s, every 5 s | Dash-jumps the short live floors (4 m) to their orbs. |
| Nyla | A second jump in the air (2.25 m) | Clears a full wall without waiting; takes the high orbs and the high-beam sticker. |
| Kiro | Shield: 1.2 s, every 8 s | Soaks laser touches (not a cage), carries him across the live floors to their orbs. |
| Zuno | Magnet: 3 s, every 8 s | Pulls the orbs out of the laser cages from outside. |
| Vexa | Phase: 2.6 s, every 7 s | Passes through every beam, into the cages (the cage shard). |

## Levels

1. **Static Lasers** (3 rooms; target window 75 s, star 25 s): a low beam to jump, a wall with one gap, a gate and its switch.
2. **Moving Lasers** (4 rooms; 90 s, star 35 s): a pulsing wall, a sliding beam, a moving barrier, a gap and a pulse.
3. **Cross Grid** (5 rooms; 105 s, star 45 s): linked switches (the first opens gate A and closes gate B; the second opens B), sweeps, barriers, pulses.
4. **Fast Maze** (6 rooms; 120 s, star 55 s): shorter windows, two barriers in a row, a decoy switch that wakes a sweep, a 4 s gate.
5. **Laser Master** (8 rooms; 150 s, star 110 s): everything combined, then the arena (below).

### Boss: the Vault Core (`VAULT_CORE`, 6 hp)

It hovers at the far end of its arena. Each attack is telegraphed, then it sweeps a low beam across the whole arena towards you: jump it. While it is open (gold) a press on one of its three pylons overloads it (one hit per window). The exit beam stays on until it is down.

1. **Laser grid** (3 hits): open 2.6 s; the sweep takes 1.8 s.
2. **Overload** (2 hits): open 2.2 s; the sweep 1.6 s.
3. **Meltdown** (1 hit): the sweep 1.4 s.

## Stars, flow, secrets

- **Stars:** clear; every main orb (route orbs are extra); and the submitted time at or under the star target.
- **No-hit badge:** never touched a laser.
- **Flow meter:** a link within 3 s, +0.25 per link, capped at x2. An orb links 30 ms; a room crossed clean (and a core hit) links 120 ms.
- **Secrets:**
  - Level 1: the cage shard (Vexa) and the high-beam sticker (Nyla).
  - Levels 2, 3, 5: the cage shard.
  - Level 4: the cage shard and the high-beam sticker.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 100 ms per orb, minus the flow bonus. Only a win is ranked; the time base is the card's target window.

### Server limits and why they hold

The bound (`minFinishMs`, `minDurationMsOf` in `rules.ts`):

- **Speed.** Nothing moves the hero down the corridor faster than the walk, except Riko's dash (x1.6 for 0.6 s, at most once every 5 s from the first frame). So `d` metres take at least `leastRunMs(d) = (d / 5.5 - 0.36) / 1.072` s. Phase, jumps and shields only let a hero skip a wait, never go faster.
- **Level 5.** The core wakes as you enter its arena, and the exit beam stays on until its least defeat time (a hit in the first ms of every open window).
- **Bonuses.** From the floor we subtract:
  - every main orb, plus the largest route set one hero can reach (`ROUTES`: Riko dash + floor, Nyla high + dash + floor, Kiro floor + dash, Zuno and Vexa cage);
  - the most flow bonus the course can feed (`comboSpecOf`).
- **The limit.** The bound less 5 %, rounded down to 100 ms (`proposeLimits`), pinned in `rules.test.ts`.

| Level | min duration | time base | max score |
|---|---|---|---|
| 1 | 5 700 | 75 000 | 6 930 |
| 2 | 7 100 | 90 000 | 8 290 |
| 3 | 8 800 | 105 000 | 9 620 |
| 4 | 10 500 | 120 000 | 10 950 |
| 5 | 34 100 | 150 000 | 11 590 |

The guards in the tests:

- 30 s of random input for every hero never gets further than the dash allowance.
- 60 spam runs never beat the floor.
- Every hero with its power mashed never beats the floor.
- The honest bot wins through the real store with ragged frames: a ranked win inside the limits.

## What the bots reached

The honest bot (the plan, no routes) wins every level at 30, 60 and 144 fps, never zapped, with every main orb. Submitted times at 60 fps: about 8.2 / 12.2 / 15.0 / 18.1 / 47.3 s.

Every hero's bot with its own route wins every level and never beats the floor. Vexa takes the cage shard; Nyla takes the high sticker.

## Models

Only Hyper3D models that already existed; no credits were spent.

- The ready laser-maze-run set: emitter, floor tile, prism (the switches), security cam, the Vault Core, vault wall.
- The card's own objects from `ready/menu2/laser-maze-ninja`: checkpoint pad, laser frame (round every gate), moving barrier.
- The shared Menu 2 orb, beacon and hero GLBs.

The beams, their glow and the core's sweep are code.
