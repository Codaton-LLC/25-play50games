# Wind Tunnel Escape (Menu 2, game 41, World 2 Sky & Sea): REDIRECT

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). Built to its approved
design card (`docs/menu2-super/world-2-sky-and-sea.md` "41 Wind Tunnel Escape", framework
`00-framework.md`) on the menu2 shared systems, after the `cloud-hopper` reference. Codex started it
(`codex/m2-wind-tunnel-escape`: level names, a one-template fan sketch, the GLBs, the boss idea); Claude
rebuilt the rules on room templates and wrote the scene, the camera, the HUD, multiplayer and the proofs.

## Concept and controls

Turn the fans of a storm tunnel to send the wind where you need it, then ride your own currents out
before the violet storm front catches up. Each room is a small routing puzzle; the currents chain across
gaps, up shafts and round corners to the exit (level 5: the Gale Engine, then the Tide Bell in the open
sky).

- Keyboard: WASD / arrows move, Space jumps, **E / Enter next to a fan: a tap turns it 90° clockwise (seen
  from above), a hold (450 ms) switches it off / on; a vent switches on a tap.** Away from any fan, E is
  the hero power. Touch: joystick, Jump, and the **Fan / Power** button (the same tap / hold timing,
  decision 7). A prompt over the controls says what Action does next to the fan in reach.
- A current carries you on its own (7 m/s, no jumping needed). You steer a little inside it (2.6 m/s),
  never out of its side (the card's "steer within the current"); you drop out at its end. Up-currents
  (vents) lift you and hold you under their top: steer off onto the ledge. Riding, the hero curls into the
  armoured ball and tumbles with the wind (the Color Roll signature move).
- Camera (menu2/camera): drag / two fingers orbit, wheel / pinch zoom, Q / C turn, R / F tilt, V recenters;
  movement is camera-relative (`StepInput.yaw`). The tunnel's walls, ledges and lifts are its collision
  boxes. The intro flies from the exit back over the roofless rooms to the start.
- Hero choice: the shared Menu 2 picker on the start card, the pause menu and the result; **Nami** (W2's
  lead, `defaultHeroFor`) is preselected; the player's own last pick here is remembered.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 56, status `dev` |
| `index.tsx` | GameDefinition: `intro`, `clockChip: false`, `finalScore`, `ResultExtra` (stars), `runPlayers`, per-level dusk |
| `levels.ts` | the five level configs: timer, star target, the storm (room it wakes in, distance, speed), boss |
| `tunnel.ts` | the course model, the room templates (VENT, BRIDGE, CHAIN, CORNER, LIFT, arena, exit, sky), the hero kits, the five level scripts, the bot plan per room |
| `rules.ts` | pure rules: 2 ms substeps, currents, collisions, the z guard, fans / vents / lifts / rails / auto fans, hazards, storm, boss, the bound, `PROPOSED_LEVEL_LIMITS`, `solidBoxes`, `groundUnder` |
| `heroes.ts`, `progression.ts` | the five heroes and powers; combo, stars, secrets, `GALE_ENGINE`, `ESCAPE` |
| `levelEnd.ts`, `StarResult.tsx` | stars, the no-storm badge, secrets and XP to menu2/progress; the star screen |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players (menu2/multiplayer) on ONE shared tunnel world |
| `Hero.tsx`, `Armadillo.tsx` | the picked hero's GLB on menu2/heroAnim (ball while riding, lean into the push), the stand-in |
| `Scene.tsx`, `camera.ts` | simulation, juice, wind sound, orbit camera, intro |
| `World.tsx`, `Course.tsx`, `look.ts` | the storm sky, tube rings and fan towers; every tunnel piece; the palette and the panel shader |
| `Hud.tsx` | orbs, hearts, room, power, flow, clock, storm distance, fan prompt, hint, Gale Engine bar, escape countdown |

## Rules

Units: 1 = 1 m; forward is -z. The clock is whole 2 ms substeps (the fraction carried), so a run is the
same at 30, 60 or 144 fps.

- **Hero:** box 0.7 × 1.3 m; on foot 6.5 m/s; jump 11 m/s (2.0 m up, 4.8 m far). Hearts 3, refilled at
  each room's checkpoint.
- **Fans:** four compass directions (`n e s w`), a tap = the next one clockwise; the current is off for
  the 280 ms the head turns. A held Action switches the fan off / on. The current is a 1.5 m-radius
  column from the grille along the direction, 14 m long (boss fans 20-26), cut 0.6 m before the first
  wall on its axis (so a rider at a wall drops out). **Vents** blow up (radius 1.3); a tap switches them.
- **Crossing currents add as vectors** (horizontal sum capped at 9.9 m/s): where two cross you curve
  (level 2's corner); a crosswind across a bridge blows you into the wall.
- **Lifts** (`m2FanLiftPlatform`): the platform rides its vent, 3 m/s, up while on, down while off.
- **Rail fans** dwell 3 s at each end and slide 1.8 s between; only the far end lines up with the
  doorway past the gap. **Auto fans** turn themselves every 3 s (not turnable). **Drones** swing across a
  current; a touch is a hit.
- **Hits:** a shock vent, a drone, the Gale Engine's blast or intake: a heart, a knock-back, 1.2 s of
  invulnerability. Out of hearts, or a fall 7 m under the room: 900 ms down + 600 ms back at the latest
  checkpoint that is not ahead of where you went down (a respawn never moves you forwards).
- **The storm front** wakes in its level's room behind you and creeps forward; it **waits while you are in
  a fan-setup room that is not solved yet** (the card's risk fix) and after 20 s there a gold ghost shows
  the setup. Inside it you lose a heart 0.4 s in, then every second. A respawn pushes it 12 m behind you.
- **Finish:** standing in the exit (level 5: past the Gale Engine's gate, at the Tide Bell). The level's
  timer ends the run "timeup", unranked.

### Hero roles (the card; every level has all five, all on bonus orbs)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | dash 300 ms at 12 m/s (5 s) | breaks a cracked vent cover (`m2FlyingCrate`): its vent blows him up through two orbs (a jump from the cover's top cannot reach them) |
| Nami | a second jump in the air, **also out of a current mid-ride** (no cooldown, once per flight) | the 3.5 m shelves (a plain jump makes 2 m) and their orbs |
| Kiro | shield 3 s (9 s) | crosses the static-shock vents and takes their orbs; drones and the blast do not hurt him |
| Zuno | magnet 3 s, 7 m reach (9 s) | pulls orbs hung where no current goes, 6 m off the route he rides |
| Vexa | phase 1.6 s (7 s) | through the ghost fan housing into the maintenance duct (two orbs, the sticker), whose vent lifts her back in on the upper floor: a quiet shortcut |

Any hero can finish every level (proof.test.ts: every hero, plain). The all-orbs star counts the main
orbs only.

## Levels

| Level | Rooms | Timer | Twist |
|---|---|---|---|
| 1 Gentle Wind | updraft, bridge, up-and-across, exit | 120 s | the card's three beats: ride a vent already blowing; turn one fan across an 11 m gap; switch a vent and turn the upper fan (up, then across). The storm wakes only in the third room, slowly |
| 2 Cross Wind | crosswind bridge, vent, crossing currents, up-and-across, exit | 150 s | a crosswind across the bridge throws you into the wall (switch it off / turn it); two crossing currents add up and curve you onto an island by the wall |
| 3 Vertical Lift | vent, fan lift (9 m), fan lift + top bridge (8 m), up-and-across, exit | 180 s | a 30 m shaft: vents move the lift platforms with you on them |
| 4 Moving Fans | rail fan, auto fan, up-and-across with a drone, bridge with a drone, up-and-across, exit | 210 s | ride the rail fan from its far dwell through the doorway; step into the auto fan just as it turns forward; time the drones' swing |
| 5 Storm Tunnel | vent, **Gale Engine arena**, 4 escape rooms, open sky | 300 s | everything, the boss, then the escape |

Star targets (the card): 60 / 90 / 110 / 130 / 180 s. **No-hit badge** (the card's): never touch the
storm front.

### Boss: the Gale Engine (level 5, menu2/boss `GALE_ENGINE`, 6 hp)

`m2GaleEngineBoss` (Hyper3D, 15k tris, 0.8 MB, the character budget) fills the arena's end, 13 m wide,
its intake facing you; a shutter closes behind you as it wakes.
1. **Blow back** (3 hits): it telegraphs (it swells, an alarm), then blasts the middle lane (|x| < 4.2) for
   1.7 s, throwing you back (a heart). Turn the three side fans to face its intake: every side fan aimed
   and blowing when the intake opens sends its own blast back (1 hit), and jams (spent).
2. **Jam the core** (3 hits): it opens its core and pulls you towards the intake (it bites). Three flying
   crates drop onto three vents; switch a vent on (the crate floats up into the high fan's line) and turn
   the high fan behind it forward: the current carries the crate into the intake. Each crate in lands a
   hit at the next open window.
3. **Escape** (after the defeat, `ESCAPE`): the engine collapses (slow-mo on the visuals only), its gate
   opens, the storm surges at 3.6 m/s and the HUD counts the card's 25 s; four fan rooms, then ring the Tide
   Bell in the open sky.

## Scoring

A **time game**: `score = floor((timeBaseMs − duration_ms) / 10)`. The submitted duration is
`finishMs − 200 · orbs − comboMs` (`finalScore`, `runTimeMs`); only a win is ranked; multiplayer is never
ranked.

### Server limits and why they hold (the proof)

1. **Clock:** `finishMs ≤ elapsedMs` (whole 2 ms substeps, the fraction carried).
2. **The z guard:** every substep the rules cap the hero's step towards -z at `V_ZMAX` = 7.5 m/s (a dash:
   `V_DASH` 12), after every current, push, lift and collision. Respawns only move backwards (+z).
   `rules.test.ts` checks it every substep against 24 s of random input for every hero on every level.
3. **Least finish:** `(startZ − goalNearZ) · 1000 / V_ZMAX − 2` ms. Level 5: the arena's entry, then the
   Gale Engine's least done time (`bossMinMs` = 28 100 ms: every window hit the ms it opens), then the
   gate's front to the bell.
4. **Least duration:** less every orb (bonus included) at 200 ms and the flow bound `comboMaxBonus` (each
   orb 40, each checkpoint 60, each setup 80, x2 cap). Turning a fan is never a link.
5. **Dash floor:** each dash saves at most 302 ms · (12 − 7.5) / 7.5; one per 5 s cooldown plus the first.
6. **Limits:** the bound less about 4.5 %, rounded down to 100 ms, never above the dash floor.

| Level | z travel (m) | Least finish | Orbs (main) | Flow | Least duration | Dash floor | minDurationMs | timeBase | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 Gentle Wind | 104.8 | 13 971 | 20 (10) | 1 260 | 8 711 | 8 168 | 8 100 | 120 000 | 11 190 |
| 2 Cross Wind | 150.8 | 20 105 | 24 (14) | 1 560 | 13 745 | 13 020 | 13 000 | 150 000 | 13 700 |
| 3 Vertical Lift | 148.8 | 19 838 | 24 (14) | 1 560 | 13 478 | 12 754 | 12 700 | 180 000 | 16 730 |
| 4 Moving Fans | 180.8 | 24 105 | 26 (16) | 1 780 | 17 125 | 16 219 | 16 200 | 210 000 | 19 380 |
| 5 Storm Tunnel | 28.0 + 138.7 | 50 316 | 29 (19) | 2 040 | 42 476 | 41 571 | 40 500 | 300 000 | 25 950 |

`meta.ts` and `arcade-games.json` ship this table; `rules.test.ts` pins it; `registry.sync.test.ts`
checks the JSON. Level 5 is worth 2.3x level 1.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (Nami, the plan in tunnel.ts, no power) | wins every level at 30 / 60 / 144 Hz with every main orb: 60 Hz submitted 18.2 / 38.4 / 30.1 / 47.2 / 60.9 s = 91 / 81 / 90 / 84 / 92 % of maxScore |
| Every hero, plain and with its power mashed (Riko at 30/60/144) | every plain run clears; no mashed finish beats the floor (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle | the timer ("timeup", unranked) |
| Spam (60 on L1, 25 per level: random stick, Jump and Action mashed and held, 4-50 ms frames) | no finish under the floor |
| Two / three bots, co-op and versus, levels 1 and 5 | co-op clears (and beats the Gale Engine), versus ranks a winner (`multiplayer.test.ts`) |

Mutation probes: another level's course or timer never reproduces a row; a goal 25 m nearer would be
rejected; a 20 % shorter timer gives another row.

## Stars, flow, secrets, progress

- **Stars:** clear, every main orb, the time target. **Badge:** never touched the storm front.
- **Flow:** 3 s window, +0.25, x2 cap (orbs, checkpoints, a room's setup coming right).
- **Secrets:** the **gust shard** at the end of a current no exit needs (turn the upper fan backwards: it
  carries you back over the start floor, 7 m up); the **duct sticker** (Vexa); the **anemometer shard**
  (turn a fan into the anemometer post: it spins up and a hidden vent opens under the shard). L1 gust +
  sticker, L2 anemometer + sticker, L3 gust + anemometer, L4 gust + sticker, L5 all three.
- **Progress:** `levelEndStats` -> `recordLevelResult` on a win and a time-up.

## Local multiplayer (menu2/multiplayer, M1)

`multiplayer.ts`: N runs from the same seed on **one shared tunnel world**: a fan one player turns is
turned for all (the card's co-op: one turns, one rides), the orbs, covers, lifts, storm and Gale Engine
are shared; the first unfinished run moves the world. Co-op shares checkpoints and Kiro's shield, Zuno's
magnet and Vexa's phase; the team clears when all are out. Versus: first out wins, then the grace (a
rival's fans are yours to turn against them). `MultiScene.tsx` (shared camera, 24 m zoom limit, player
rings) and `MultiplayerHud.tsx` (button, join screen, chips, podium). Phones stay single player.

## Models

`public/models/3d/wind-tunnel-escape/`: `m2WindFan` (every turnable fan; hub on the current's axis),
`m2AirVent` (vents), `m2FanLiftPlatform` (lifts), `m2FlyingCrate` (Riko's covers, the boss's crates),
`m2AnemometerPost`, `m2WindTubeBg` (the great rings round each room), `m2WindFanTower` (copied from the
ready sky-tower-jump set: towers outside the walls), `m2FactoryDrone` (copied from ready/menu2/shared: the
patrol drones), `m2GaleEngineBoss` (the level 5 boss). The orb, the checkpoint beacon are the shared
Menu 2 `scoreOrb` / `checkpointBeacon`. Code: the tunnel blocks (one panel shader, world-space panels,
light strips, hazard edges), the rotors, the current streaks and vent columns, ghost housings, shock
arcs, the storm front, the hint ghost, the Tide Bell, the boss core.

## Open issues

- The card's crates that ride or block a current on levels 2-4 are not built: flying crates appear as
  Riko's covers and in the boss fight only.
- The card's co-op "fans that two heroes must hold at once" and the versus "mirrored tunnels" are not
  built (one shared tunnel; rivals can turn each other's fans).
- Two players tapping the same fan in the same frame turn it twice (bots in tests start apart).
- The fan GLB is one mesh: the head cannot pitch, so every fan is horizontal and up-currents come from
  vents. The rotor is code.
- Music stems per combo are not built (the wind loop rises while riding).
