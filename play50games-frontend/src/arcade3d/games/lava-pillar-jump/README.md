# Lava Pillar Jump (Menu 2, game 04, World 1 finale)

Owner: Cursor (built), Claude (super-game upgrade, 2026-10-27). Status: **dev** (preview builds only, `enabled: false`). Order 54.
Design card: `docs/menu2-super/world-1-ember-heights.md` "4 Lava Pillar Jump" (branch `claude/m2-super-plan`), framework `00-framework.md`.
Heroes: the shared Color Roll Heroes, each its own GLB (`menu2/heroModels.ts`), animated by `menu2/heroAnim`.

## Hook and signature mechanic

Out-climb a lava tide that surges on the volcano's heartbeat, on basalt pillars that heat under your feet and crumble if you linger, and ride the geysers that fire on each surge.

- **Heartbeat surges:** the lava rises steadily (0.18 / 0.28 / 0.40 / 0.50 / 0.60 m/s) and on every beat surges +1.2 m over 1.5 s, then ebbs over 1.5 s. Beats every 6 s (L1), 5 s (L2, L3), 4 s (L4, L5); the first at one beat in. The 1 s before each beat is the telegraph (`surgeTelegraph`, pure): the lava and its light glow up, a low kick drum hits, the camera kicks and the FOV breathes in; on the beat the camera shakes and the FOV opens with the surge.
- **Hot-foot:** a top heats while stood on (`heatAt`): orange at 1.2 s, white at 2.4 s (it flickers), crumbles at 3.0 s and re-forms 4 s later; it cools back to 0 over 4 s once left (steam puffs off a hot top you leave). A magma slug's top (L4, L5) heats twice as fast. The start, crystals, the goal and vent pillars never heat.
- **Geyser vents** (`m2LavaGeyserVent`): a vent fires only during the first 800 ms after a beat (`ventOpen`), launching the hero standing in its 2 x 2 m centre at `V_VENT` = 14·√2 m/s, twice a jump's height (apex 6.53 m), curled into the ball, with a spark column, a whoosh and a 140 ms visual hang at the apex. Each level has at least one vent climb (a step 4.2-4.4 m tall that no jump makes). Kiro's shield rides any vent off the beat. L3's secret vent fires only on every third beat.
- No beat inputs and no scoring on the beat: the beat is only a hazard and a lift you plan around (the card's "not a rhythm game" fix).
- Controls: move, Jump, Power. The same timing on touch and keyboard (130 ms buffer, 100 ms coyote).

Kept from the prototype: the S-sweep across the cavern (`pillarXZ`, ±4 to 6.5 m, 0.5-0.6 rad per pillar, uneven rises), sliding basalt bridges, sinking orange shelves, glassy shelves, falling rocks, crystals as checkpoints, embers taking 400 ms off, "lava covers the checkpoint, so the run ends".

## Levels

| Level | Title | Timer | Course (route pillars, beat, twist) |
|---|---|---|---|
| 1 | Warm Cavern | 90 s | 10 wide pillars to 16 m, beat 6 s. Three beats: the first top glows under you (heat), the first surge with a wide margin (crystals every 3 pillars), one vent on the beat to the exit ledge |
| 2 | Pillar Field | 120 s | 14 pillars to 24 m, beat 5 s; basalt bridges slide on the heartbeat (one leg per beat, starting on it); two vent climbs |
| 3 | Falling Rocks | 150 s | 18 pillars to 32 m, beat 5 s; every surge shakes rocks loose 350-590 ms after it (dark shadow markers from the telegraph until they land); glassy, blinking and sinking shelves; the third-beat vent |
| 4 | Fast Lava | 180 s | 22 narrower pillars to 40 m, beat 4 s; magma slugs (2x heat), heat gusts, rocks, movers, two vent climbs |
| 5 | Volcano Core | 240 s | 16 pillars to 28 m (beat 4 s, slugs, rocks, movers, a vent climb), then Kalder's arena: a ring of 6 pillars (radius 7.5 m) round the golem; the lava's rise is capped 3.2 m under the ring |

## Level 5 boss: Kalder, the Magma Golem

`progression.ts KALDER` (menu2/boss `BossConfig`, `bossProblems` empty), stepped by rules ms in `rules.ts tick()` from the first landing in the ring. The model is the ready `m2MagmaGolemBoss.glb` (copied from `~/.play50/hyper3d/ready/menu2/shared/`, manifest line `/models/3d/menu2/m2MagmaGolemBoss.glb`, 18 000 tris, 465 KB, `CHARACTER_BUDGET`), drawn 9.6 m tall standing in the lava at the ring's centre (`GOLEM_HEIGHT`, `GOLEM_SINK`; `assets.test.ts` checks the bounds, the budget, that he stays inside the ring's inner edge and that there is body at every hit zone's height).

Six hits, three phases (one hit per open window; a hit throws the hero back onto the nearest ring vent at ≤ 6.5 m/s, no steering until the landing):

| Phase | Hits | What he does | How you hit |
|---|---:|---|---|
| P1 Heartbeat slams | 3 | telegraph 1.0 s (rears up), slam 0.6 s = a surge and the ring vents fire, open 2.2 s | ride a ring vent onto his shoulders (zone 4.4 m over the ring, three grey crust plates, one breaking per hit) |
| P2 Pillar tear | 2 | vents quiet, he hunches forward, the lava stands high (+1.2 m, no ebb) | jump onto the glowing cracks of his back (zone 2.0 m up) and be on it when he opens |
| P3 Heart surge | 1 | the biggest surge (+2.0 m), the vents fire, his heart glows white | ride a vent up and drop into the heart (zone 4.8 m up) |

A hit flashes him (hit-stop 90 ms, kick, shake); the defeat is the finish (`finishMs` = the defeat ms), with the boss's visual-only slow-mo (`bossTimeScale` on his animation clock, a 140 ms hit-stop) as he sinks into the lava. The HUD shows `<BossHealthBar>` (name, phase, hp, phase marks, open pulse, flash) once the fight runs. The arena's lava never reaches the ring (`progression.test.ts`). The boss adds no score: his least fight time is part of the level's least finish.

## Hero roles (any hero clears every level; the gates are secrets)

- **Riko:** dash through the cracked basalt cap on a mid-route pillar (the chimney shard; taken only while dashing).
- **Nami:** the overhang sticker over a gap, caught only in a double jump's flight.
- **Kiro:** the shard in a vent's spray column (only while shielded); the shield also rides any vent off the beat.
- **Zuno:** the lava shard low beside a pillar, 3 m out: only the magnet reaches it from the edge.
- **Vexa:** the shard in a ghost obsidian wall at a pillar's edge (purple-outlined), taken only while phasing.

## Stars, flow, secrets, progress (menu2 systems)

- **Stars** (`menu2/stars`): clear, every ember, and the submitted time at or under 17 / 15 / 21 / 35 / 56 s (about 1.5x the honest bot). No-hit = no fall, rock or lava. The run also counts `crumbles` (the card's "no crumbled pillar" bonus is published as the `crumbles` stat; the star screen has no slot for a second badge yet).
- **Flow** (`menu2/combo`): a link within 2 s, +0.25 per link, x2 cap; each ember (40 ms) and the first landing on each support (20 ms). A fall breaks it. The bonus comes off the submitted time; `<ComboMeter>` in the HUD.
- **Secrets** (`menu2/secrets`, 2-3 per level): L1 chimney (Riko), lava shard (Zuno), overhang sticker (Nami); L2 obsidian (Vexa), spray (Kiro); L3 third-beat shard (over the every-third-beat vent, at its launch height; any hero), chimney, lava shard; L4 obsidian, spray, overhang; L5 spray, obsidian, the core sticker over Kalder's head on a slam geyser's line. No score.
- **Progress** (`menu2/progress`): `levelEnd.ts levelEndStats` on a win (before `end("win")`), a time-up and a lava loss; `StarResult.tsx` is `GameDefinition.ResultExtra`.

## Rules (units: 1 = 1 m, forward is -z, up is +y; whole-ms clock, the same at 30, 60 and 144 fps)

Hero cylinder r 0.32 h 1.2; run 6.5 m/s; gravity 30; jump 14 m/s (apex 3.27 m); vent 19.8 m/s (apex 6.53 m). Pillars are rectangles, 1.4 m deep colliders; landing crosses a top downwards with the centre over it (grown by 0.15). A fall 7 m under the last top, or feet in the lava, costs 900 + 600 ms and respawns on the last crystal; if the lava covers that crystal the run ends `"lose"` (unranked). Sinking shelves drop 3.6 s after you land; blinking pillars hold 1.6 s under you. Rocks hit only a grounded hero at the rim (the centre is outside); shield and phase ignore them and the heat gusts. Powers: Riko dash 280 ms at 12.5 m/s (15 s), Nami double jump capped at the flight's apex (10 s), Kiro shield 2.5 s (20 s), Zuno magnet 2.5 s reach 4.2 (20 s), Vexa phase 1.2 s (20 s).

Camera-relative input: `StepInput.yaw` is the orbit camera's drawn yaw; `step()` turns the stick with core `inputToWorld(moveX, moveZ, yaw)` (NaN / Infinity count as 0). Bots and tests leave it 0, so every bot and proof result is unchanged (`orbit.test.ts` checks the honest bot on all five levels, and random-yaw spam against the floor: turning keeps the stick's length).

## Scoring and the proof

A **time game**: `score = floor((timeBaseMs − duration_ms) / 10)`. Submitted duration = `finishMs − 400 · embers − flow bonus` (`finalScore`, `runTimeMs`). Only a win is ranked.

1. **Clock:** `simMs ≤ elapsedMs`, `finishMs ≤ elapsedMs`.
2. **Height only grows in flight:** an arc starts at `V_JUMP`, `V_VENT` (a vent pillar) or 0; Nami's double jump never passes the flight's apex; landing sets y to a top crossed downwards; Kalder's throw is a jump's arc from his zone.
3. **Horizontal speed** ≤ `(V_RUN + maxCarry) / 1000` m per ms (the throw is ≤ V_RUN; wind is clamped).
4. **Edge bound** `edgeMinMs`: `max(gap / (V_RUN + maxCarry), rise time)`, the rise time the faster of a jump and (from a vent pillar) the vent's launch. A vent is taken as open at any ms, which covers the beat and Kiro's off-beat ride. Heat, crumbles, sinking and blinking only remove supports, and the lava only ends runs, so they never lower the bound. Boss zones are nodes too.
5. **Least finish:** Dijkstra (`minArrivalMs`) to the goal; level 5: the least arrival on a ring pillar plus `bossMinMs(KALDER)` = 15 900 ms (the boss machine stepped 1 ms at a time with a hit on the first ms of every open window).
6. **Least duration** `minDurationMsOf`: minus every ember and `comboMaxBonus(comboSpecOf(course))`.
7. **Limits** `proposeLimits`: 92 % of the bound rounded down to 100 ms, never under 90 % of it, and never above Riko's dashed floor (`dashFloorMs`).

| Level | Least finish | Embers | Least duration | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|
| 1 Warm Cavern | 5 383 | 4 | 3 493 | 3 200 | 90 000 | 8 680 |
| 2 Pillar Field | 5 749 | 6 | 2 899 | 2 600 | 120 000 | 11 740 |
| 3 Falling Rocks | 9 784 | 5 | 7 294 | 6 700 | 150 000 | 14 330 |
| 4 Fast Lava | 13 176 | 7 | 9 726 | 8 900 | 180 000 | 17 110 |
| 5 Volcano Core | 24 172 | 7 | 20 682 | 19 000 | 240 000 | 22 100 |

Level 2's floor is under level 1's: its two vent climbs are each a big skip for a vent taken at once (Kiro). Every level's maxScore is at least level 1's; level 5 is 2.55x (cap 3x). `meta.ts` and `arcade-games.json` ship this table; `rules.test.ts` pins it.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: look-ahead jumps, waits on a vent for the beat, never uses the power; in the arena it waits on a ring vent for the slam, steers the flight onto the zone, jumps onto his back in P2) | wins every level at 30 / 60 / 144 Hz, Kalder down every time. Submitted: L1 11.18 / 11.18 / 11.18 s (90.8 % of max), L2 9.95 / 9.94 / 9.93 s (93.7 %), L3 13.56 s (95.2 %), L4 23.03 / 23.03 / 23.47 s (91.5-91.7 %), L5 37.22 / 37.66 / 37.63 s (91.6-91.8 %). The waits for the beat on the vent climbs are outside the bound, which is why the bot is 3-4x the floor and still over 90 % |
| Honest bot with each power mashed, every level, 30/60/144 | never under the floor (`proof.test.ts`) |
| Idle | swallowed by a surge before the clock (`"lose"`, unranked) |
| Spam (random stick, jump and power mashing, random frame times) | never under the floor on any level |

## Camera and hero choice (menu2/camera, menu2/heroes)

- **Free orbit camera** (`menu2/camera`, `Scene.tsx` `LavaCamera`): drag (left or right mouse button, or one finger on the empty canvas / two fingers) to turn and tilt, wheel or pinch to zoom, Q / Z and C / X turn, R / F tilt, V (or the touch recenter button) swings back behind the hero; after 2.5 s without input it follows the travel. Tuning `camera.ts LAVA_ORBIT` (pitch 24 deg, 7.4 m, zoom 4-16 m, farther on portrait). The pivot is the hero's chest led a third of the way to the next pillar, in Kalder's ring towards the golem; it holds while the hero falls out of view. The pillars (`courseSolids`, from `rules.ts solidBoxes`: movers where they are, blinking / sunk / crumbled pillars and inactive boss zones left out, 8 m of basalt under each top) pull the camera in. The heartbeat's FOV breath (+6 deg in a vent flight) stays, in its own frame callback (the orbit never sets the FOV). The intro ends on the orbit's first pose (`playCamera`). Multiplayer: one orbit for the group (`OrbitDriver` + `SharedCamera orbit`), every player's stick relative to it. `Hud.tsx` renders `OrbitHud` (recenter button, first-time hint).
- **Hero choice** (`menu2/heroes`): `heroes.ts` is `createHeroPick("lava-pillar-jump")`, so the preselected hero is the player's own last pick here, else W1's lead, Riko. The shared `HeroPicker` shows on the start card (with the 2-4 players button), the pause menu and the result screen, hidden in multiplayer. The pick is the next run's option: a running Scene keeps the hero its run started with. The rules' own default (bots, proofs) is still Riko.

## Multiplayer (menu2/multiplayer, M1 local, 2-4 players)

`multiplayer.ts` (pure, `multiplayer.test.ts`): N runs from the same seed, stepped together; one lava tide for all (a function of rules time); embers shared. **Co-op:** shared crystals (a fallen hero respawns on the highest crystal any friend lit), Kiro's shield, Zuno's magnet and Vexa's phase cover the team, the team clears when every hero is on top. **Versus race:** first to the goal wins (15 s grace); on level 5 each hero fights its own Kalder and the first to bring him down wins. `MultiScene.tsx` draws one animated hero per player with a coloured ring and the shared camera; the heartbeat's drum plays once. `MultiplayerHud.tsx`: the 2-4 players button, the join screen, the chips and the podium. Multiplayer runs never reach the solo board (`runPlayers`).

## Files

`meta.ts`, `index.tsx` (`ResultExtra`, `runPlayers`), `levels.ts`, `pillars.ts` (route, vents, slugs, arena), `rules.ts` (rules, surge, heat, vents, boss, proof, `solidBoxes`), `progression.ts` (combo, stars, secrets, KALDER), `levelEnd.ts`, `StarResult.tsx`, `bot.ts`, `heroes.ts` / `powers.ts`, `Hero.tsx` (`writeHeroMotion` + `AnimatedHero`), `Armadillo.tsx` (stand-in), `Scene.tsx`, `sceneJuice.ts` (heartbeat / vent / crumble / boss juice, boss stats), `Course.tsx` (pillars, heat glow, vent columns, lava + light, rocks + shadows, secrets, golem), `World.tsx`, `camera.ts`, `look.ts`, `Hud.tsx`, `MultiScene.tsx`, `MultiplayerHud.tsx`, `multiplayer.ts`.
Tests: `rules.test.ts`, `proof.test.ts`, `heartbeat.test.ts` (surge, telegraph, heat, vents, rocks), `progression.test.ts` (stars, flow bound, secret gates, Kalder), `layouts.test.ts` (the sweep, not Rooftop's zigzag), `multiplayer.test.ts`, `powers.test.ts`, `hero.test.ts`, `assets.test.ts`, `look.test.ts`, `livePick.test.ts`, `orbit.test.ts` (camera-relative input, first pose, solids, preselected hero).

## Models

`public/models/3d/lava-pillar-jump/`: `m2BasaltPillar`, `m2CollapsePlatform`, `m2BasaltBridge`, `m2LavaRock`, `m2Ember`, `m2MagmaSlug` (now on the slug tops), `m2LavaGeyserVent` (now on every vent pillar, plus decor), `m2VolcanoBg`. Shared: `menu2/m2MagmaGolemBoss.glb` (Kalder), the five heroes. Code meshes: crystals, the lava, heat glow, spark columns, rock shadows, crust plates, back cracks, the heart, secret markers, the ghost obsidian wall and the cracked cap.

## Open

- Twin co-op vents (both pressed on the beat for a mega-launch) and the party "Last Above Lava" arena are not built.
- `m2FireSpirit` ambient spirits and `m2ObsidianCheckpoint` (NICE) are not used; crystals stay code meshes.
- The golem is a static GLB: his rear, slam, hunch and sink are whole-body transforms, no rig.
- The "no crumbled pillar" bonus is a stat, not a star-screen badge (StarScreen has one bonus slot: no-hit).
- No browser playtest in this branch (visuals typed and unit-tested only).
