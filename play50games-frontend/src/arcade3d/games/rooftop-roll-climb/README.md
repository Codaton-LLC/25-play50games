# Rooftop Roll Climb (Menu 2, game 02)

Owner: Cursor. Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`).
Spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` GAME 02.
The hero is the shared Color Roll Heroes armadillo (`m2HeroRiko.glb`, the other four colours are a material tint).

## Concept and controls

Climb a stack of city rooftops as one of the five Color Roll Heroes (Riko by default). Jump from roof to roof,
ride sliding rooftops, wait out a blinking roof, cross icy decks, light the checkpoint lamps and reach the
helipad. Golden coins take 0.4 s off your time each. A fall costs time and sends you back to the last lamp.

The world is original city rooftops: water towers, AC units, antennas, unbranded colour-block billboards,
cranes and a distant skyline. The hero is a rolling armoured armadillo.

- Keyboard: WASD / arrows move (screen-relative: up = away from the camera), Space jumps, E or Enter uses the hero power.
- Touch: the core joystick + Jump + a Power button (`touchLabels.action`). **The same timing for both** (decision 7): one jump press
  and one action press (`jumpPressed`, `actionPressed`), the same 130 ms buffer and 100 ms coyote time.
- Before the run, a hero row on the start card picks Riko (Dash), Nami (Double Jump), Kiro (Shield), Zuno (Magnet) or Vexa (Phase). The pick is the next run's option (`heroes.ts`).

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 52, status `dev`, owner `cursor` |
| `index.tsx` | the GameDefinition: `intro: true`, `clockChip: false`, `finalScore`, five LevelSpecs |
| `levels.ts` | the five level configs (one city, five layouts) |
| `roofs.ts` | the generated layouts: rises, movers, blinking roofs, ice, antenna arcs |
| `heroes.ts` | the five heroes, power durations, and the run-option pick |
| `rules.ts` | pure rules: the course, the ms clock, movement, collisions, movers, grip, checkpoints, falls, coins, the finish, the lower bound and `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, and `?autoplay=1` on preview builds) |
| `camera.ts` | the follow camera goal, the play pose, the intro keyframes (pure) |
| `Armadillo.tsx` | the hero's code stand-in and the ball of plates it curls into |
| `look.ts` | day palette and the night look (levels 4 and 5) |
| `World.tsx` | sky, fog, distant towers, cranes, unbranded boards |
| `Course.tsx` | roofs, fans, solar racks, tanks, chimneys, antennas, movers, coins, sparks |
| `Hero.tsx` | `m2HeroRiko.glb` on the auto-rig, pose, curl ball, blob shadow |
| `Scene.tsx` | simulation, juice, follow camera, intro |
| `Hud.tsx` | orbs, height, title, run clock |
| `rules.test.ts`, `powers.test.ts`, `assets.test.ts`, `hero.test.ts`, `look.test.ts` | proof, powers, mesh fit, landmarks, night look |

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms with the fraction carried: every jump arc depends only on the ms since take-off, the same at 30, 60 or 144 fps.

- **Hero:** a vertical cylinder (radius 0.32, height 1.2), feet at y. Stick velocity eased towards `V_RUN` 6.5 m/s (accel 50 on the ground, 32 in the air, 36 on ice). Gravity `G` 30; jump `V_JUMP` 14 m/s (apex `H_JUMP` 3.27 m). There are no bounce pads.
- **Roofs (supports):** rectangles. Landing = the feet cross a top downwards with the centre over it (grown by `FOOT` 0.15). Walking off starts a fall with 100 ms coyote time. A jump press is kept for 130 ms.
- **Movers:** offset = travel · (2 · smoothstep(triangle(ms / period + phase)) − 1). A grounded hero is carried by the mover's own per-ms step.
- **Blinking roofs:** period 2800 ms, gone for 28 % of the cycle, neighbours half a cycle apart so two neighbours are never gone together. Checkpoints, the start, the goal and movers never blink. Landing starts a 1600 ms grip: the roof stays solid under the hero until the grip ends.
- **Ice:** accel 36. Slippery roofs are forced to at least 6.4 × 6.2 m. A roof is never both icy and moving, and never both icy and blinking.
- **Checkpoints:** standing on one activates it (forward only). Start = checkpoint 0.
- **Falls:** 7 m under the last top stood on is lost: 900 ms out of view, then 600 ms frozen on the checkpoint. The clock runs on.
- **Coins:** picked up within 0.95 m of the hero's middle (4.2 m while Zuno's magnet is up); each takes 400 ms off the submitted time.
- **Hero power** (E, Enter, or the Power button). Riko Dash: 280 ms at 12.5 m/s, then 15 s. Nami Double Jump: a second jump whose apex cannot pass the flight's existing apex, then 10 s. Kiro Shield: 2.5 s ignoring gusts and sparks, then 20 s. Zuno Magnet: 2.5 s at the wider pickup, then 20 s. Vexa Phase: 1.2 s ignoring gusts and sparks, then 20 s. None of them adds a vertical reach. A dash saves at most about 260 ms of the summed bound, and the floor still holds (`rules.test.ts`).
- **Wind** (levels 4 and 5): a sideways gust while airborne, peak 3.5 m/s², flipping every 2.8 s. The speed cap is still `V_RUN`. Shield and phase ignore it.
- **Sparks** (levels 4 and 5): an antenna arc on some rims. The centre is outside the radius. A grounded hero in a live arc falls. Shield and phase ignore it.
- **Finish:** standing on the goal roof. The level's `durationMs` ends the run unranked (`timeup`). Only `end("win")` is ranked.

## Scoring

A **time game**: `kind: "time"`, display `"time"`. The server computes `score = floor((timeBaseMs − duration_ms) / 10)`.
The submitted duration is `finishMs − 400 · coins` (`runTimeMs`). Only a win is ranked. The game's own clock is the HUD (`clockChip: false`).

### Server limits and why they hold

1. **Clock.** `useRunFrame` hands the game the play time the run clock counted; the rules turn it into whole ms (`simMs ≤ elapsedMs`). `finishMs ≤ elapsedMs`.
2. **Height only grows in flight.** An arc starts at `V_JUMP` or 0 (walk-off, head bump). Landing sets y to a top just crossed downwards. A respawn puts the hero on an earlier checkpoint.
3. **Horizontal speed.** In any ms the hero moves at most `(V_RUN + maxCarry) / 1000` m. Wind is clamped to `V_RUN`.
4. **Edge bound.** To stand on roof b after a, the hero needs at least `max(gap(a, b) / (V_RUN + maxCarry), rise time)`. For a rise `dy > 0` the flight must pass its apex first. Ground time counts as 0.
5. **Least finish.** Dijkstra over the roofs (`minArrivalMs`) gives the least ms to stand on the goal (`minFinishMs`).
6. **Least duration.** At most every coin, 400 ms each (`minDurationMsOf`):

   | Level | Least finish | Coins | Least duration |
   |---|---:|---:|---:|
   | 1 Low Roofs | 6 089 ms | 4 | 4 489 ms |
   | 2 Office Roofs | 9 309 ms | 6 | 6 909 ms |
   | 3 Moving Rooftops | 12 340 ms | 5 | 10 340 ms |
   | 4 Night Skyline | 15 370 ms | 7 | 12 570 ms |
   | 5 High-Rise Climb | 19 377 ms | 9 | 15 777 ms |

7. **Limits.** `proposeLimits` takes 92 % of the least duration, rounded down to 100 ms, and never under 90 % of it (a dash saves about 260 ms, which is more than 4.5 % of these short courses). `timeBaseMs` and `maxDurationMs` are the level timer. `maxScore = floor((timeBaseMs − minDurationMs) / 10)`.

   | Level | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
   |---|---:|---:|---:|---:|
   | 1 | 4 100 | 90 000 | 90 000 | 8 590 |
   | 2 | 6 300 | 120 000 | 120 000 | 11 370 |
   | 3 | 9 500 | 150 000 | 150 000 | 14 050 |
   | 4 | 11 500 | 180 000 | 180 000 | 16 850 |
   | 5 | 14 500 | 210 000 | 210 000 | 19 550 |

   Every level's maxScore is at least level 1's 8 590, and level 5's 19 550 is 2.28× that (the cap is 3×). `meta.ts` and `arcade-games.json` ship this table. `rules.test.ts` pins it and checks the dash floor. `registry.sync.test.ts` checks the JSON against meta.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: jumps at the first frame that lands, waits for movers and blinking roofs, walks only when two roofs actually overlap; it does not use the hero power) | Wins on every level at 30, 60 and 144 fps. Submitted times (30 / 60 / 144) and best score: level 1 **5.959 / 5.959 / 5.950 s**, 4 coins, score 8 405 (98 % of 8 590). Level 2 **8.711 / 8.628 / 8.607 s**, 6 coins, 11 139 (98 % of 11 370). Level 3 **13.439 / 12.939 / 12.895 s**, 13 710 (98 % of 14 050). Level 4 **16.736 / 16.770 / 17.160 s**, 16 326 (97 % of 16 850). Level 5 **21.943 / 22.260 / 22.232 s**, 18 805 (96 % of 19 550). Every clear is at least 90 % of that level's maxScore. At 60 fps each level's score is above level 1's, and level 5 is 2.2× level 1 |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | "timeup" at exactly 90 000 ms on level 1, unranked, nothing sent |
| 200 spam bots (random stick, jump mashing, 4-50 ms frames) | no win under 4 100 ms on level 1 |

## Levels

| Level | Title | Timer | What it adds |
|---|---|---|---|
| 1 | Low Roofs | 90 s | 10 roofs, 8 rises, goal at 16 m, wide and still |
| 2 | Office Roofs | 120 s | 14 roofs, 12 rises, goal at 22 m, sliding roofs |
| 3 | Moving Rooftops | 150 s | 18 roofs, 16 rises, goal at 30 m, more movers, blinking roofs, ice |
| 4 | Night Skyline | 180 s | 22 roofs, 20 rises, goal at 38 m, faster movers, wind, antenna sparks |
| 5 | High-Rise Climb | 210 s | 28 roofs, 25 rises, goal at 46 m, every hazard |

Clear: a win (time game). Level 5's timer is 210 s (the plan's best-time climb needs a cap).

## Models

Hyper3D props in `public/models/3d/rooftop-roll-climb/`: `m2RooftopBlock`, `m2RoofExhaustFan` (the AC), `m2RoofSolarRack`, `m2SkylineTower` (background only, off the climb). The hero reuses `/models/3d/menu2/m2HeroRiko.glb` at the same landmarks and scale as Sky Tower Jump (`hero.test.ts`). Coins reuse the shared coin. Water towers, chimneys, antennas, cranes and the billboards are code meshes (two or three tones, no letters). `assets.test.ts` fits every GLB to the real mesh bounds. `core/modelManifest.ts` lists the four prop urls.
