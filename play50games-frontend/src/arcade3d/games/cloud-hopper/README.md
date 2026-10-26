# Cloud Hopper (Menu 2, game 05)

Owner: Cursor. Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`).
Spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` GAME 05.
Order 55 (54 is lava-pillar-jump on another branch). The five heroes are the shared Color Roll Heroes armadillos, each its own GLB (`menu2/heroModels.ts`). Colour on the picker is a swatch only.

## Concept and controls

Hop a rising helix of soft clouds as one of the five Color Roll Heroes (Riko by default). Bounce clouds launch you, some clouds drift as a chain, some fade after you land, and wind lanes push you sideways in the air. A rainbow arch marks each checkpoint and the goal. Golden stars take 0.4 s off your time each. A fall costs time and sends you back to the last arch.

The course is generated in `clouds.ts` (a breathing helix). It is not the sky-tower stair, the rooftop zigzag, or the flooded-ruins shaft. `layouts.test.ts` checks that every level's positions and limits differ from those three games.

- Keyboard: WASD / arrows move (screen-relative: up = away from the camera), Space jumps, E or Enter uses the hero power.
- Touch: the core joystick + Jump + a Power button (`touchLabels.action`). **The same timing for both** (decision 7): one jump press and one action press (`jumpPressed`, `actionPressed`), the same 130 ms buffer and 100 ms coyote time.
- Before the run, a hero row on the start card picks Riko (Dash), Nami (Double Jump), Kiro (Shield), Zuno (Magnet) or Vexa (Phase). The pick is the next run's option (`heroes.ts`).

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 55, status `dev`, owner `cursor` |
| `index.tsx` | the GameDefinition: `intro: true`, `clockChip: false`, `finalScore`, five LevelSpecs |
| `levels.ts` | the five level configs (one sky, five helix layouts) |
| `clouds.ts` | the helix generator: bounce clouds, drift chains, fade-after-land, wind lanes |
| `heroes.ts` | the five heroes, power durations, and the run-option pick |
| `rules.ts` | pure rules: the course, the ms clock, movement, bounce, drift, fade, wind, checkpoints, falls, stars, the finish, the lower bound and `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, and `?autoplay=1` on preview builds) |
| `camera.ts` | the follow camera goal, the play pose, the intro keyframes (pure) |
| `Armadillo.tsx` | the hero's code stand-in and the ball of plates it curls into |
| `look.ts` | pastel day palette and the pastel sunset look (levels 4 and 5) |
| `World.tsx` | sky, fog, distant puff clouds, the cloud castle |
| `Course.tsx` | clouds, feathers, rainbow arches, wind rings, stars |
| `Hero.tsx` | the shared hero GLB on the auto-rig, pose, curl ball, blob shadow |
| `Scene.tsx` | simulation, juice, follow camera, intro |
| `Hud.tsx` | stars, height, title, run clock |
| `rules.test.ts`, `proof.test.ts`, `layouts.test.ts`, `powers.test.ts`, `assets.test.ts`, `hero.test.ts`, `look.test.ts` | proof, powers, mesh fit, landmarks, dusk look |

## Rules

Units: 1 = 1 m; the helix winds around the origin, up is +y. The clock is whole ms with the fraction carried: every jump arc depends only on the ms since take-off, the same at 30, 60 or 144 fps.

- **Hero:** a vertical cylinder (radius 0.32, height 1.2), feet at y. Stick velocity eased towards `V_RUN` 6.5 m/s (accel 50 on the ground, 32 in the air). Gravity `G` 30; jump `V_JUMP` 14 m/s (apex `H_JUMP` 3.27 m). A bounce cloud launches at `V_BOUNCE` 22 m/s (apex about 8.07 m) when the feet are within `PAD_HALF` 0.8 m of the cloud's centre.
- **Clouds (supports):** rectangles on a helix. Landing = the feet cross a top downwards with the centre over it (grown by `FOOT` 0.15). Walking off starts a fall with 100 ms coyote time. A jump press is kept for 130 ms. Every step rises. Two ordinary rises are above a jump, and a bounce plus the next rise is above a bounce, so a cloud cannot be skipped.
- **Bounce clouds:** a feather on the cloud. They do not drift and they do not fade.
- **Drift chains** (levels 2 and 5): two clouds share a phase and a tangent and slide together. Checkpoints, the goal and bounce clouds stay still.
- **Fade** (levels 4 and 5): landing on a fade cloud starts a 2000 ms timer; then the cloud is gone. A respawn clears the timers, so a fall does not soft-lock the climb.
- **Wind lanes** (levels 3 and 5): a sideways push while airborne, inside a lane between clouds. The speed cap is still `V_RUN`. Shield and phase ignore it.
- **Sparks** (levels 4 and 5): a rim spark on some clouds. The centre is outside the radius. A grounded hero in a live spark falls. Shield and phase ignore it.
- **Checkpoints:** standing on one activates it (forward only). Start = checkpoint 0. A rainbow arch marks it. Arches do not move the sky.
- **Falls:** 7 m under the last top stood on is lost: 900 ms out of view, then 600 ms frozen on the checkpoint. The clock runs on.
- **Stars:** picked up within 0.95 m of the hero's middle (4.2 m while Zuno's magnet is up); each takes 400 ms off the submitted time.
- **Hero power** (E, Enter, or the Power button). Riko Dash: 280 ms at 12.5 m/s, then 15 s. Nami Double Jump: a second jump whose apex cannot pass the flight's existing apex, then 10 s. Kiro Shield: 2.5 s ignoring wind and sparks, then 20 s. Zuno Magnet: 2.5 s at the wider pickup, then 20 s. Vexa Phase: 1.2 s ignoring wind and sparks, then 20 s. None of them adds a vertical reach. A dash saves about 260 ms of the summed bound per use, and the floor still holds (`rules.test.ts`).
- **Finish:** standing on the goal cloud. The level's `durationMs` ends the run unranked (`timeup`). Only `end("win")` is ranked.

## Scoring

A **time game**: `kind: "time"`, display `"time"`. The server computes `score = floor((timeBaseMs − duration_ms) / 10)`.
The submitted duration is `finishMs − 400 · stars` (`runTimeMs`). Only a win is ranked. The game's own clock is the HUD (`clockChip: false`).

### Server limits and why they hold

1. **Clock.** `useRunFrame` hands the game the play time the run clock counted; the rules turn it into whole ms (`simMs ≤ elapsedMs`). `finishMs ≤ elapsedMs`.
2. **Height only grows in flight.** An arc starts at `V_JUMP`, `V_BOUNCE` or 0 (walk-off, head bump). Landing sets y to a top just crossed downwards. A respawn puts the hero on an earlier checkpoint.
3. **Horizontal speed.** In any ms the hero moves at most `(V_RUN + maxCarry) / 1000` m. Wind is clamped to `V_RUN`.
4. **Edge bound.** To stand on cloud b after a, the hero needs at least `max(gap(a, b) / (V_RUN + maxCarry), rise time)`. For a rise `dy > 0` the flight must pass its apex first. Ground time counts as 0.
5. **Least finish.** Dijkstra over the clouds (`minArrivalMs`) gives the least ms to stand on the goal (`minFinishMs`).
6. **Least duration.** At most every star, 400 ms each (`minDurationMsOf`).
7. **Limits.** `proposeLimits` leaves room for every dash that fits in the finish (about 280 ms each), rounded down to 100 ms, and never under 90 % of the least duration. `timeBaseMs` and `maxDurationMs` are the level timer. `maxScore = floor((timeBaseMs − minDurationMs) / 10)`.

   | Level | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
   |---|---:|---:|---:|---:|
   | 1 Soft Clouds | 7 100 | 90 000 | 90 000 | 8 290 |
   | 2 Moving Clouds | 9 700 | 120 000 | 120 000 | 11 030 |
   | 3 Wind Zone | 12 900 | 150 000 | 150 000 | 13 710 |
   | 4 Fading Clouds | 15 600 | 180 000 | 180 000 | 16 440 |
   | 5 Sky Sprint | 20 700 | 210 000 | 210 000 | 18 930 |

   Every level's maxScore is at least level 1's 8 290, and level 5's 18 930 is 2.28× that (the cap is 3×). `meta.ts` and `arcade-games.json` ship this table. `rules.test.ts` pins it and checks the dash floor. `registry.sync.test.ts` checks the JSON against meta.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: jumps at the first frame that lands, walks onto a bounce cloud, steers in the air; it does not use the hero power) | Wins on every level at 30, 60 and 144 fps. Submitted time stays under 2.2× that level's floor and at least 90 % of that level's maxScore. At 60 fps each level's score is above level 1's, and level 5 is under 3× level 1 |
| Honest bot, every hero, power mashed, 30/60/144 Hz | A finish never beats the floor or the clock (`proof.test.ts`) |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | "timeup" at exactly 90 000 ms on level 1, unranked, nothing sent |
| 200 spam bots (random stick, jump mashing, 4-50 ms frames) | no win under 7 100 ms on level 1 |

## Levels

| Level | Title | Timer | What it adds |
|---|---|---|---|
| 1 | Soft Clouds | 90 s | 12 clouds, 11 rises, goal at 33.6 m, bounce clouds, wide and still |
| 2 | Moving Clouds | 120 s | 16 clouds, 15 rises, goal at 45.4 m, drifting chains |
| 3 | Wind Zone | 150 s | 20 clouds, 19 rises, goal at 52.7 m, wind lanes |
| 4 | Fading Clouds | 180 s | 24 clouds, 23 rises, goal at 60 m, clouds that fade after a landing, rim sparks |
| 5 | Sky Sprint | 210 s | 30 clouds, 29 rises, goal at 89 m, drift, fade, wind and sparks together |

Clear: a win (time game). Level 5's timer is 210 s (the plan's best-time climb needs a cap).

## Models

Hyper3D props in `public/models/3d/cloud-hopper/`: `m2CloudPlatformV2` (the walkable cloud), `m2Feather` (bounce marker), `m2SkyStar`, `m2WindRing`, `m2RainbowBridge` (checkpoint and goal arches), `m2CloudCastleBg` (background only, off the climb; `m2StormCloud` is not drawn any more, its tan texture was not pastel). The heroes reuse `/models/3d/menu2/m2Hero{Riko,Nami,Kiro,Zuno,Vexa}.glb` through `heroModelAsset` (`hero.test.ts`). `assets.test.ts` fits every GLB to the real mesh bounds. `core/modelManifest.ts` lists the seven prop urls.
