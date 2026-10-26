# Lava Pillar Jump (Menu 2, game 04)

Owner: Cursor. Status: **dev** (preview builds only, `enabled: false`). Order 54 (53 is left for Flooded Ruins Escape).
Spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` GAME 04.
Heroes: the shared Color Roll Heroes, each its own GLB (`menu2/heroModels.ts`). The picker colour is a swatch only.

## Concept and controls

Climb basalt pillars in a volcanic cavern as one of Riko, Nami, Kiro, Zuno or Vexa. Lava rises from below the start shelf. Sliding pillars carry you, blinking pillars vanish, orange shelves sink after you land, pale shelves are glassy, and rocks fall on some rims. Embers take 0.4 s off your time. A fall costs time and returns you to the last crystal. If the lava covers that crystal, the run ends unranked.

- Keyboard: WASD / arrows move (up = away from the camera), Space jumps, E or Enter uses the hero power.
- Touch: joystick + Jump + Power. The same timing for both: one jump press and one action press, 130 ms buffer, 100 ms coyote time.
- The start card picks the hero. The pick is the next run's option (`heroes.ts`, `powers.ts`).

## Files

| File | What |
|---|---|
| `meta.ts` | time game, five levels, `rollheroes`, order 54, status `dev`, owner `cursor` |
| `index.tsx` | GameDefinition: `intro: true`, `clockChip: false`, `finalScore` |
| `levels.ts` | five configs of one cavern |
| `pillars.ts` | generated pillars, movers, blink, ice, collapse, rocks |
| `powers.ts` | dash / shield / magnet / phase durations |
| `heroes.ts` | the five heroes and the run-option pick |
| `rules.ts` | pure rules, lava, collapse, the lower bound, `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | honest bot (tests, and `?autoplay=1` on preview builds) |
| `Scene.tsx` | simulation, follow camera, intro, juice |
| `Course.tsx` / `World.tsx` | pillars, embers, lava, volcano walls, crystals |
| `rules.test.ts`, `proof.test.ts`, `powers.test.ts`, `assets.test.ts` | proof, powers, mesh fit |

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms. A jump arc depends only on the ms since take-off, the same at 30, 60 and 144 fps.

- **Hero:** cylinder radius 0.32, height 1.2. Run 6.5 m/s. Gravity 30. Jump 14 m/s (apex 3.27 m). No bounce pads.
- **Pillars:** rectangles. Landing crosses a top downwards, centre over it (grown by 0.15 m).
- **Lava:** starts at y = -4.5, just under the start shelf, and rises (0.18 / 0.28 / 0.42 / 0.60 / 0.80 m/s). Feet in the lava respawn on the last crystal if it is still above the lava, otherwise the run ends `"lose"` (unranked). Standing still on the start shelf is swallowed before the clock.
- **Collapse:** after 3.6 s standing on a sinking shelf it drops. Checkpoints, the start, the goal, movers, blinking shelves and glassy shelves do not sink. The height bound uses the original tops.
- **Rocks:** on some rims. The centre is outside the radius. Shield and phase ignore them. A dash is horizontal and cannot add reach. Nami's second jump cannot pass the flight's existing apex.
- **Finish:** stand on the goal. The level timer ends the run `"timeup"` (unranked). Only `end("win")` is ranked.

## Scoring

A **time game**. The server computes `score = floor((timeBaseMs − duration_ms) / 10)`. The submitted duration is `finishMs − 400 · embers`.

| Level | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
|---|---:|---:|---:|---:|
| 1 Warm Cavern | 4 100 | 90 000 | 90 000 | 8 590 |
| 2 Pillar Field | 4 800 | 120 000 | 120 000 | 11 520 |
| 3 Falling Rocks | 8 500 | 150 000 | 150 000 | 14 150 |
| 4 Fast Lava | 10 600 | 180 000 | 180 000 | 16 940 |
| 5 Volcano Core | 11 600 | 210 000 | 210 000 | 19 840 |

Every level's maxScore is at least level 1's 8 590. Level 5's 19 840 is 2.31× that (the cap is 3×). `rules.test.ts` and `proof.test.ts` run the honest bot at 30, 60 and 144 fps: each clear is at least 90% of that level's maxScore, every level scores at least level 1, idle never wins, and a dash cannot beat the floor.

## Levels

| Level | Title | Timer | Course |
|---|---|---|---|
| 1 | Warm Cavern | 90 s | 10 uneven basalt pillars on a wide S-sweep, 8 rises to 16 m, wide and still; lava 0.18 m/s |
| 2 | Pillar Field | 120 s | 14 pillars, a wider sweep, 12 rises to 22 m, sliding pillars; lava 0.28 m/s |
| 3 | Falling Rocks | 150 s | 18 pillars, a second faster swing on the sweep, blinking, glassy and sinking tops, falling rocks; lava 0.42 m/s |
| 4 | Fast Lava | 180 s | 22 narrower pillars, heat gusts, rocks, movers; lava 0.60 m/s |
| 5 | Volcano Core | 210 s | 28 pillars to 46 m, every hazard; lava 0.80 m/s |

The route is generated in `pillars.ts` (`pillarXZ`): a sweep of ±4 to ±6.5 m across the cavern at 0.5 to 0.6 rad per pillar, with a faster swing riding on it from level 3, and every rise 0.7x to 1.3x the even share (`layouts.test.ts`). It is not Rooftop Roll Climb's zigzag.

## Models

Hyper3D props in `public/models/3d/lava-pillar-jump/`: `m2BasaltPillar`, `m2CollapsePlatform`, `m2BasaltBridge` (sliding shelves), `m2LavaRock`, `m2Ember`, `m2MagmaSlug` (rim hazard), `m2LavaGeyserVent` and `m2VolcanoBg` (off the route). Heroes reuse `/models/3d/menu2/m2Hero{Riko,Nami,Kiro,Zuno,Vexa}.glb`. Crystals and the lava surface are code meshes. `assets.test.ts` fits every GLB to the real mesh. `core/modelManifest.ts` lists the eight prop urls.
