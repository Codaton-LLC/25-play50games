# Sky Tower Jump (Menu 2, game 01): the vertical slice

Owner: Claude. Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). This is the
one level the user signs off before the 50 Color Roll Heroes games are built (menu name
"Color Roll Heroes", pending the DPMA/EUIPO check)
(CLAUDE.md "Menu 2 quality bar"; spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md`
GAME 01; target: `docs/master-plan/menu2-targets/sky-tower-jump.webp`).

**All five levels are built.** Level 1 "Training Sky" is the hand-built course and its shipped limits
are unchanged. Levels 2-5 are generated towers (`tower.ts`) at the plan's heights: Cloud Steps 100 m,
Moving Platforms 150 m, Storm Heights 220 m (gusts and rim lightning), Infinite Tower 300 m.
`meta.ts` still publishes level 1's scoring row on every level so `registry.sync.test.ts` matches
`arcade-games.json`. The per-level proof is `PROPOSED_LEVEL_LIMITS`; Claude copies levels 2-5 into
meta and the JSON together.

## Concept and controls

Climb a sky tower of floating islands as one of the five Color Roll Heroes (Riko by default). Jump from island to island,
ride moving stone blocks, cross plank bridges, launch off blue bounce pads, light the checkpoint
beacons and reach the sky gate at the top. Golden orbs take 0.4 s off your time each. A fall
costs time and sends you back to the last beacon.

- Keyboard: WASD / arrows move (screen-relative: up = away from the camera), Space jumps, E or Enter uses the hero power.
- Touch: the core joystick + Jump + a Power button (`touchLabels.action`). **The same timing for both** (decision 7): one jump press
  and one action press (`jumpPressed`, `actionPressed`), the same 130 ms buffer and 100 ms coyote time, no device-specific help.
- Before the run, a hero row on the start card picks Riko (Dash), Nami (Double Jump), Kiro (Shield), Zuno (Magnet) or Vexa (Phase). The pick is the next run's option (`heroes.ts`), not localStorage.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, status `dev` |
| `index.tsx` | the GameDefinition: `intro: true`, `clockChip: false`, `finalScore`, five LevelSpecs |
| `levels.ts` | the five level configs (L1 hand-built; L2-5 tower specs) |
| `tower.ts` | the generated layouts: rises, movers, orbs, rim lightning |
| `heroes.ts` | the five heroes, power durations, and the run-option pick |
| `rules.ts` | pure rules: the course, the ms clock, movement, collisions, movers, pads, checkpoints, falls, orbs, the finish, the lower bound and `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, and `?autoplay=1` on preview builds for screenshots) |
| `camera.ts` | the follow camera goal, the play pose, the intro keyframes (pure) |
| `Armadillo.tsx` | the hero's code stand-in (fallback) and the ball of plates it curls into |
| `look.ts` | palette, canvas textures (clouds, glows, waterfall, pad arrow), the billboard shader |
| `World.tsx` | sky, cloud sea and banks, background islands and castles, waterfalls, motes, rock roots |
| `Course.tsx` | the playable course drawn from the rules' data: islands, checkpoints + beacons + beams, movers, bridges, pads + glows, gate + portal, orbs + halos, ladders |
| `Hero.tsx` | the hero: `m2HeroRiko.glb` on the auto-rig (stand-in fallback), its pose per frame, the curl ball, blob shadow |
| `Scene.tsx` | simulation (useRunFrame), juice, follow camera, the intro camera and the hero's drop |
| `Hud.tsx` / `Hud.module.css` | the concept-style HUD: orbs, height, title banner, run clock |
| `rules.test.ts`, `powers.test.ts`, `assets.test.ts` | rules, proof, bots, one test per power, models, definition, camera |

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms with the fraction carried (as
obstacle-race): every jump arc depends only on the ms since take-off, the same at 30, 60 or 144 fps.

- **Hero:** a vertical cylinder (radius 0.32, height 1.2), feet at y. Stick velocity eased towards
  `V_RUN` 6.5 m/s (accel 50 on the ground, 32 in the air). Gravity `G` 30; jump `V_JUMP` 14 m/s
  (apex `H_JUMP` 3.27 m after 467 ms); bounce pad `V_BOUNCE` 22 m/s (apex 8.07 m after 733 ms).
- **Platforms (supports):** rectangles (centre ± half sizes), 1.4 m deep colliders. Landing = the feet
  cross a top downwards with the centre over it (grown by `FOOT` 0.15). Walking off starts a fall with
  coyote time. The sides push the hero out; a rising head under a platform stops rising.
- **Movers:** offset = travel · (2 · smoothstep(triangle(ms / period + phase)) − 1), polynomials only.
  A grounded hero is carried by the mover's own per-ms step; a jump keeps the take-off carry.
- **Pads:** standing (or landing) inside the pad square (±0.8 m) launches at `V_BOUNCE` at once.
- **Checkpoints:** standing on a checkpoint platform activates it (forward only). Start = checkpoint 0.
- **Falls (the time penalty):** a fall 7 m under the last top stood on is lost: 900 ms out of view,
  then 600 ms frozen on the checkpoint's centre. The clock runs on, so a fall costs at least 1.5 s
  plus the fall and the climb back ("+fall time" pops up).
- **Orbs:** picked up within 0.95 m of the hero's middle (4.2 m while Zuno's magnet is up);
  each takes `ORB.bonusMs` 400 ms off the submitted time. Level 1 has 18.
- **Hero power** (E, Enter, or the Power button — one `actionPressed`, same ms on touch and keyboard).
  The cooldown starts when the power actually fires and is ready again at the start of every run.
  Riko Dash: 280 ms at 12.5 m/s, then 15 s. Nami Double Jump: a second jump in the air whose apex
  cannot pass the flight's existing apex (a ground jump's `H_JUMP`, or a bounce's `H_BOUNCE`), then 10 s;
  a press on the ground does not start the cooldown. Kiro Shield: 2.5 s ignoring gusts and lightning, then 20 s.
  Zuno Magnet: 2.5 s at the wider pickup, then 20 s. Vexa Phase: 1.2 s ignoring gusts and lightning, then 20 s.
  None of them adds a vertical reach or a speed the level 1 proof does not already allow (`V_DASH` is
  horizontal; `minFinishMs(COURSE, V_DASH)` stays at or above the 11 500 ms floor).
- **Wind** (levels 4 and 5): a sideways gust while airborne, peak 3.5 m/s², flipping every 2.8 s.
  The speed cap is still `V_RUN`, so a gust cannot beat the horizontal bound. Shield and phase ignore it.
- **Lightning** (levels 4 and 5): a rim strike on some islands. The centre is outside the radius.
  A grounded hero in the strike while it is live falls. Shield and phase ignore it.
- **Finish:** standing on the goal platform. **Cap:** the level's `durationMs` of play ends the run
  "timeup" (unranked). Level 1 is the plan's 90 s.
- The seed (`createRun(seed, level)`) only places decor: the course is the same race for everyone
  (a time leaderboard must not depend on luck; the same reasoning as obstacle-race's fixed course).

### The course (level 1)

29 supports (`COURSE_ROWS`): the 7 x 7 start, 18 islands, 4 moving blocks (2.2 / 1.8 / 2.0 / 1.4 m
travel, 3.2-4 s periods), 2 plank bridges (6 m), 3 checkpoints at 9.4, 23.4 and 37.6 m, 3 bounce pads
(6.6 m rises), the 8 x 7 goal at 60 m with the sky gate. Every normal step rises 1.8-2.2 m (at least
0.8 m under the apex) and every gap is under 2.8 m (`rules.test.ts`): a training level.

## Scoring

A **time game**: `kind: "time"`, display `"time"`. The server computes `score = floor((timeBaseMs − duration_ms) / 10)`.
What is shipped today, on every level, is level 1's row: `timeBaseMs` 90 000, duration 11 500-90 000 ms.
The submitted duration is
`finishMs − 400 · orbs` (`finalScore`, `runTimeMs`): the exact finish ms the Scene publishes with
`setStat("finishMs")` before `end("win")` (never the frame's end), minus the orb bonus. Only a win is
ranked (`isRankedRun`). The HUD clock shows the same number live. The game's own clock is the level
timer (`course.durationMs`), which is longer than 90 s on levels 2-5; until the JSON is updated, a
finish slower than 90 s on those levels would be rejected by the server.

### Server limits and why they hold (the proof)

Shipped today, the server accepts a time run only if `11500 ≤ duration_ms ≤ 90000`, for every level
(level 1's row). The table in step 7 is what to ship per level.

1. **Clock.** `useRunFrame` hands the game exactly the play time the run clock counted; the rules
   turn it into whole ms with a carried remainder (`simMs ≤ elapsedMs`). Every ms of motion is a
   counted ms; `finishMs ≤ elapsedMs`.
2. **Height only grows in flight.** y rises only inside an arc with positive speed, and an arc starts
   with speed `V_JUMP` (a jump from the ground or within coyote time, from at most the top stood on),
   `V_BOUNCE` (a pad) or 0 (walk-off, head bump). Landing sets y to a top it just crossed downwards;
   a respawn puts the hero on an earlier checkpoint. Carry is horizontal.
3. **Horizontal speed.** In any ms the hero moves at most `(V_RUN + maxCarry) / 1000` m: the stick
   speed is capped, the carry is a mover's own step (≤ its top speed, smoothstep's slope 1.5), and the
   progress guard caps the non-carry step (push-outs included). Tested every ms against 40 s of random
   input on every level.
4. **Edge bound.** To stand on platform b after standing on a, the hero needs at least
   `max(gap(a, b) / (V_RUN + maxCarry), rise time)`, where `gap` is the distance between the two stand
   rectangles (a mover's whole sweep, grown by `FOOT`) and, for a rise `dy > 0`, the flight must pass
   its apex before it can land: `V/G + sqrt(2 (H − dy) / G)` with `V` = `V_JUMP` (or `V_BOUNCE` from a
   pad platform), infinite when `dy ≥ H` (`edgeMinMs`). Ground time counts as 0.
5. **Least finish.** Dijkstra over the platforms with those edges (`minArrivalMs`) gives the least
   ms to stand on the goal (`minFinishMs`). Every route (falls and respawns included) is a chain of
   such edges. Level 1: **19 238 ms**.
6. **Least duration.** At most every orb, 400 ms each (`minDurationMsOf`):

   | Level | Least finish | Orbs | Least duration |
   |---|---:|---:|---:|
   | 1 Training Sky | 19 238 ms | 18 | 12 038 ms |
   | 2 Cloud Steps | 27 232 ms | 12 | 22 432 ms |
   | 3 Moving Platforms | 36 518 ms | 16 | 30 118 ms |
   | 4 Storm Heights | 46 747 ms | 15 | 40 747 ms |
   | 5 Infinite Tower | 69 521 ms | 21 | 61 121 ms |

7. **Limits.** Level 1 is unchanged: `minDurationMs` 11 500 (the bound less 4.5 %), `maxScore` 7 850,
   `timeBaseMs` and `maxDurationMs` 90 000. Levels 2-5 use the same formula (the bound less about
   4.5 %, rounded down to 100 ms, still inside 94-100 % of the bound) and the level's own timer as
   `timeBaseMs` / `maxDurationMs`. `PROPOSED_LEVEL_LIMITS`:

   | Level | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
   |---|---:|---:|---:|---:|
   | 1 | 11 500 | 90 000 | 90 000 | 7 850 |
   | 2 | 21 400 | 120 000 | 120 000 | 9 860 |
   | 3 | 28 700 | 150 000 | 150 000 | 12 130 |
   | 4 | 38 900 | 180 000 | 180 000 | 14 110 |
   | 5 | 58 300 | 240 000 | 240 000 | 18 170 |

   Every level's maxScore is at least level 1's 7 850, and level 5's 18 170 is 2.3× that (the cap
   asked for is about 3×). `meta.ts` and `arcade-games.json` still carry level 1's row on every
   level until Claude copies this table into both. `rules.test.ts` recomputes the bound and checks
   the margin; `registry.sync.test.ts` checks the JSON against meta.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: look-ahead jumps at the first frame that lands, waits for movers, walks onto pads; it does not use the hero power) | Wins on every level at 30, 60 and 144 fps, no falls. Submitted times and scores (`floor((timeBase − submitted) / 10)`): level 1 **16.3 / 16.1 / 16.1 s**, 17 orbs, scores 7 366 / 7 386 / 7 392 (94 % of 7 850). Level 2 **26.4 / 26.2 / 26.2 s**, 12 orbs, 9 357 / 9 376 / 9 385 (95 % of 9 860). Level 3 **35.3 / 34.9 / 34.8 s**, 15 orbs, 11 465 / 11 514 / 11 522 (95 % of 12 130). Level 4 **50.0 / 47.3 / 47.3 s**, 15 orbs, 13 003 / 13 268 / 13 269 (94 % of 14 110). Level 5 **71.6 / 70.0 / 69.8 s**, 21 orbs, 16 841 / 16 997 / 17 015 (93 % of 18 170). Each level's score is above level 1's, and level 5 is 2.3× level 1 |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | "timeup" at exactly 90 000 ms on level 1, unranked, nothing sent |
| 200 spam bots (random stick, jump mashing, 4-50 ms frames) | no win under 11 500 ms on level 1; most never finish |

The level 1 bound (12.0 s) is 75 % of the best bot time (16.1 s): it ignores ground time, so the floor
is safe rather than tight. The best bot on every level is inside 90-100 % of that level's maxScore.

## Levels

| Level | Title (plan) | Timer | What it adds |
|---|---|---|---|
| 1 | Training Sky | 90 s | the hand-built slice, goal at 60 m. Unchanged |
| 2 | Cloud Steps | 120 s | generated route to 100 m, 6 moving blocks |
| 3 | Moving Platforms | 150 s | route to 150 m, 7 moving blocks (more than level 2) |
| 4 | Storm Heights | 180 s | route to 220 m, gusts, lightning on 8 rims, 10 movers |
| 5 | Infinite Tower | 240 s | the long climb to 300 m, gusts, lightning on 12 rims, 10 movers |

Clear: a win (time game). Level 5's timer is 240 s (the plan's survival climb needs a cap; the honest
bot finishes in about 70 s). Moving blocks slide; they do not vanish.

## Look (README for the sign-off)

- **Layered world:** the playable route (Hyper3D islandA grass islands, skyPlatform checkpoint
  plazas, movingBlock stone blocks, plankBridge bridges, bouncePad pads, checkpointBeacon beacons,
  skyFortressGate at the top, the shared gold star coin (`SHARED_ASSETS.coin`) as the orbs, woodenLadder decor) plus non-colliding background
  islands (islandB/C/D, about 30, instanced), stoneTower castles on some of them and the big Sky
  Tower castle behind the gate, all fitted from measured GLB bounds (`GLB_SIZE`, tested).
- **Sky:** a three-stop gradient dome (not tone-mapped, so the blue stays vivid), a sea of soft
  billboard clouds below, cloud banks along the route, far clouds ringing the camera, fog
  (80-300 m) for depth, drifting light motes around the camera.
- **Lighting:** the core "day" preset plus a warm low key from the front right and a cool rim from
  behind; emissive accents: orb halos, pad glow + rising arrow, beacon beams (blue, gold once lit),
  the gate's portal.
- **VFX / juice:** core fx bursts (landing puffs, bounce sparks, orb sparkles, checkpoint confetti,
  win confetti), floating "-0.4 s" / "Checkpoint!" / "+fall time", camera shake on bounce, fall and
  the intro landing, synth sounds (jump, whoosh, pickup with rising pitch, chime, pop, thud).
  Waterfalls (scrolling shader strips + mist) fall from the big background islands.
- **Rock roots** under every playable island are code terrain (vertex-coloured strata), as the
  standing decisions allow for terrain.
- **Camera:** a smoothed follow from behind and above, looking past the hero and up towards the next
  platform; wider and higher on a portrait screen (fov 66, more height), so the next jump is always
  on screen; it holds still while the hero falls out of view.
- **Quality tiers:** desktop full; phones (`useQuality`: mid) get 80 % of the clouds and background
  islands and 70 % of the motes and burst particles. No shadow maps on any tier (a blob shadow).
- **HUD** after the concept: orb counter and height (left), a navy title banner with the gold level
  line and the run clock (top centre); the shell keeps Mute / Pause.

### Hero

CLAUDE.md decision 5 (redesigned 2026-10-25): an original armadillo/pangolin hero, **no eye mask, no
turtle, nothing TMNT-like**. The hero colour is on the shell plates, the armour and the glowing lines.
`ASSETS.hero` is **m2HeroRiko.glb** (the red Color Roll Heroes hero; static T-pose, no skeleton),
drawn through `<HumanoidModel>` with `RIKO_LANDMARKS` (`assets.ts`, measured 2026-10-25). Scale is
1.45 / its height (1.9035), so it stands **1.45 m** tall, feet on the ground (`bodyLift`). The mesh
is centred on its bounds (snout +z, tail −z), so the soles sit forward of the origin; Hero shifts
the rig back by the sole centre. The tail is not a limb: `hemY` sits under it and `legDepth` is the
shins only, so the tail tip is skirt-weighted to the hips and the spine (`hero.test.ts`).

The **code stand-in** `Armadillo.tsx` stays the fallback (Riko red plates, glowing seams, open
helmet and visor, tan muzzle, charcoal suit). The **ball of plates** is still that stand-in's
mesh (`ArmadilloBall`): bounce pads, the intro drop and a fall curl into it and spin with the
speed. Nami, Kiro, Zuno and Vexa reuse `m2HeroRiko.glb` with a white material and `HumanoidModel`
`tint` in that hero's colour (a stand-in until each hero has a mesh). The curl ball stays Riko red.
The old turtle GLBs (`m2Hero1/2/3`, `turtleNinja`) are not used.

Posed every frame (`stepHeroPose`, then the rig): `walkPose` on the rig's own stride (capped at
5 strides a second: at 6.5 m/s the own stride is 0.83 m, so the cap stretches it and the planted
foot slides about a third of the step), `jumpPose` in the air, `cheerPose` at the gate, bob and
lean, landing squash, a pop-in on respawn. The stand-in, while it is showing, still swings its
own joints from the same pose.

## Intro (core/intro, opted in)

`intro: true` in the definition. Cursor's opt-in core intro (`core/intro`, merged from
`cursor/core-game-intro`) is wired into the shell on this branch (`core/intro/ShellIntro.tsx`,
`GameShell`): Play on the start card mounts the intro instead of calling `start()`; the run stays in
"ready" (no clock, `elapsedMs` 0) until the intro is done, then the 3-2-1 countdown starts. The game
supplies the shots (`camera.ts introKeyframes`: an establishing shot of the gate and the Sky Tower,
then down past the checkpoints to the start) and drops the hero (curled into its ball) from 24 m onto the start platform
with a puff, sparkles, shake and a thud during the landing phase. Title "Sky Tower Jump" and
"Level 1 — Training Sky" in a navy banner; Skip button, any key or a tap skips; 7 s the first time per
level, 1.5 s afterwards (`localStorage play50games_3d_intro:sky-tower-jump:<level>`). Retry and Next
level start at once.

## Performance (production build, headless Chrome, 2026-10-25, `?autoplay=1&perf=1`, whole run incl. intro)

| | draw calls (last / max) | triangles | frame p50 / p95 / max (ms) |
|---|---|---|---|
| desktop 1280 x 800 | 39 / 68 | 218k | 16.7 / 16.8 / 33.5 |
| phone 390 x 844, 4x CPU throttle | 38 / 59 | 197k | 16.7 / 27.4 / 182 (the max is the intro -> run remount) |
| landscape phone 844 x 390 | 38 / 60 | 197k | 16.7 / 16.8 / 30.7 |

Those runs drew the code stand-in (about 20 merged meshes). With `m2HeroRiko.glb` the hero is one skinned mesh, plus the ball of plates while it is curled. The stand-in is baked into about 20 merged meshes (`buildArmadilloShapes`, tested) and is only the fallback; every
repeated prop is instanced (`InstancedModel`, `DynamicInstancedModel` for movers and coins, one
billboard field per cloud layer). These runs include the autoplay bot's look-ahead (a 2 s simulation
copy per grounded frame), which a real player does not pay. No per-frame allocation in the frame loops
(scratch objects only).

## Known gaps vs the concept (for the sign-off)

1. **The curl is still the code ball** (the GLB has no roll pose). The sculpted hero shows while
   it runs and jumps; bounce pads, falls and the intro drop swap in the ball of plates.
2. **The other four heroes are tints of Riko's mesh** (white material × the hero colour). Their own
   GLBs are not in this task.
3. **Rock roots** under the islands are low-poly code rock, flatter than the concept's sculpted cliffs.
4. **No real shadows** (blob shadow only); the concept's soft contact shadows are not there.
5. **Clouds are billboards** (soft but flat when the camera passes close); no volumetric clouds.
6. Moving blocks slide. They do not disappear or turn slippery (the plan's level 3 also mentions those).
7. The shared `menu2/scoreOrb.glb` is no longer drawn here (the gold star coin matches the concept's
   coins); it stays in the manifest for the other Menu 2 games.

## Test plan

`rules.test.ts`: course shape and comfort (every generated step is a jump or a bounce), determinism
across seeds, jump apex and landing, buffer, the per-ms speed bound on every level, movers,
falls/respawn timing, finalScore, the lower bound per level, the proposed limits, a dash not pulling
level 1 under 11 500 ms, the honest bot on every level at 30/60/144 fps (a clear, at least 90 % of
that level's maxScore, each level at least level 1's points, level 5 at most about 3×), the idle bot,
200 spam bots, the honest bot through the real store with ragged frames.
`powers.test.ts`: one test per power (distance or effect, the plan's cooldown, a jump press does not
fire it, touch and keyboard are the same `actionPressed`).
`assets.test.ts`: every GLB listed, on disk, in budget (the hero and the shared coin included),
`GLB_SIZE` equal to the real meshes and their walkable tops, the baked stand-in (at most 22
meshes, feet on 0, 1.45 m tall), the definition's levels, intro, and the Power button, the intro ending on the
follow camera's pose. `hero.test.ts`: Riko's landmarks, 1.45 m with feet on 0, the tail tip on
the hips and the spine.
