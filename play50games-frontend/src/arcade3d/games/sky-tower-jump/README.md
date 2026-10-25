# Sky Tower Jump (Menu 2, game 01): the vertical slice

Owner: Claude. Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). This is the
one level the user signs off before the 50 Color Roll Heroes games are built (menu name
"Color Roll Heroes", pending the DPMA/EUIPO check)
(CLAUDE.md "Menu 2 quality bar"; spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_SHELL_NINJAS_FULL.md`
GAME 01; target: `docs/master-plan/menu2-targets/sky-tower-jump.webp`).

**Level 1 "Training Sky" is fully built. Levels 2-5 are PLACEHOLDERS:** the same course with harder
constants only (`levels.ts`: faster and longer moving blocks, narrower islands); their own layouts,
hazards (wind, storms, the infinite tower) and looks come after the sign-off.

## Concept and controls

Climb a sky tower of floating islands as Riko, the red armoured hero who rolls into a ball: jump from island to island,
ride moving stone blocks, cross plank bridges, launch off blue bounce pads, light the checkpoint
beacons and reach the sky gate at the top (60 m). Golden orbs take 0.4 s off your time each. A fall
costs time and sends you back to the last beacon.

- Keyboard: WASD / arrows move (screen-relative: up = away from the camera), Space jumps.
- Touch: the core joystick + Jump button. **The same timing for both** (decision 7): one jump press
  event (`jumpPressed`), the same 130 ms buffer and 100 ms coyote time, no device-specific help.
- Hero abilities (Dash, Double Jump, Shield, Magnet, Phase) are not in the slice (known gap below).

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, status `dev` |
| `index.tsx` | the GameDefinition: `intro: true`, `clockChip: false`, `finalScore`, five LevelSpecs |
| `levels.ts` | the five level configs (L2-5 placeholders) |
| `rules.ts` | pure rules: the course, the ms clock, movement, collisions, movers, pads, checkpoints, falls, orbs, the finish, the lower bound and `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, and `?autoplay=1` on preview builds for screenshots) |
| `camera.ts` | the follow camera goal, the play pose, the intro keyframes (pure) |
| `Armadillo.tsx` | the hero's code stand-in (armadillo/pangolin, Riko red plates, glowing lines, helmet + visor) behind the `ASSETS.hero` slot |
| `look.ts` | palette, canvas textures (clouds, glows, waterfall, pad arrow), the billboard shader |
| `World.tsx` | sky, cloud sea and banks, background islands and castles, waterfalls, motes, rock roots |
| `Course.tsx` | the playable course drawn from the rules' data: islands, checkpoints + beacons + beams, movers, bridges, pads + glows, gate + portal, orbs + halos, ladders |
| `Hero.tsx` | the hero: the `ASSETS.hero` slot (stand-in until the Hyper3D GLB exists), its pose per frame, blob shadow |
| `Scene.tsx` | simulation (useRunFrame), juice, follow camera, the intro camera and the hero's drop |
| `Hud.tsx` / `Hud.module.css` | the concept-style HUD: orbs, height, title banner, run clock |
| `rules.test.ts`, `assets.test.ts` | rules, proof, bots, models, definition, camera |

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
- **Orbs:** 18 (14 on jump arcs, 4 on the bridges), picked up within 0.95 m of the hero's middle;
  each takes `ORB.bonusMs` 400 ms off the submitted time.
- **Finish:** standing on the goal platform (60 m). **Cap:** at 90 000 ms of play the run ends
  "timeup" (unranked), the plan's 90 s timer.
- The seed (`createRun(seed, level)`) only places decor: the course is the same race for everyone
  (a time leaderboard must not depend on luck; the same reasoning as obstacle-race's fixed course).

### The course (level 1)

29 supports (`COURSE_ROWS`): the 7 x 7 start, 18 islands, 4 moving blocks (2.2 / 1.8 / 2.0 / 1.4 m
travel, 3.2-4 s periods), 2 plank bridges (6 m), 3 checkpoints at 9.4, 23.4 and 37.6 m, 3 bounce pads
(6.6 m rises), the 8 x 7 goal at 60 m with the sky gate. Every normal step rises 1.8-2.2 m (at least
0.8 m under the apex) and every gap is under 2.8 m (`rules.test.ts`): a training level.

## Scoring

A **time game**: `kind: "time"`, `timeBaseMs` 90 000, duration 11 500-90 000 ms, display `"time"`. The
server computes `score = floor((90000 − duration_ms) / 10)`. The submitted duration is
`finishMs − 400 · orbs` (`finalScore`, `runTimeMs`): the exact finish ms the Scene publishes with
`setStat("finishMs")` before `end("win")` (never the frame's end), minus the orb bonus. Only a win is
ranked (`isRankedRun`). The HUD clock shows the same number live.

### Server limits and why they hold (the proof)

The server accepts a time run only if `11500 ≤ duration_ms ≤ 90000`, for every level.

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
5. **Least finish.** Dijkstra over the 29 platforms with those edges (`minArrivalMs`) gives the least
   ms to stand on each; the goal: **19 237.6 ms** (`minFinishMs`; checkpoints at 3 853, 7 994,
   12 113 ms). Every route (falls and respawns included) is a chain of such edges.
6. **Least duration.** At most 18 orbs, 400 ms each: `19 237.6 − 7 200` = **12 037.6 ms**
   (`minDurationMsOf`). Levels 2-5 have the same tops and gaps (faster movers only lower the
   horizontal bound, and the vertical bound decides every edge), so the same 12 037.6 ms.
7. **Limits.** `minDurationMs` 11 500 = the bound less 4.5 % (rounded down to 100 ms);
   `maxScore` = `floor((90000 − 11500) / 10)` = **7 850**; `maxDurationMs` = the 90 s cap (a finish
   happens at `simMs ≤ 89 999`). `PROPOSED_LEVEL_LIMITS` holds them; `rules.test.ts` recomputes the
   bound and checks the margin (3-6 %) and that meta.ts matches; `registry.sync.test.ts` checks
   `arcade-games.json`.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: look-ahead jumps at the first frame that lands, waits for movers, walks onto pads) | level 1: finish 23 135 / 22 935 / 22 880 ms at 30 / 60 / 144 fps, 17 orbs, no falls → **16.3 / 16.1 / 16.1 s** submitted (score ≈ 7 386). Levels 2-5: 16.5-18.0 s, all wins at every frame rate |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | "timeup" at exactly 90 000 ms, unranked, nothing sent |
| 200 spam bots (random stick, jump mashing, 4-50 ms frames) | no win under 11 500 ms; most never finish |

The bound (12.0 s) is 74 % of the best bot time (16.1 s): it ignores ground time and the zig-zag of
the route, so the floor is safe rather than tight; the bot's best is within 1.4 x of the limit. A
good human run is probably 25-40 s with most orbs.

## Levels

| Level | Title (plan) | Built | Config |
|---|---|---|---|
| 1 | Training Sky | **yes** | the slice |
| 2 | Cloud Steps | placeholder | travel x1.2, period x0.9, islands x0.95 |
| 3 | Moving Platforms | placeholder | travel x1.35, period x0.8, islands x0.9 |
| 4 | Storm Heights | placeholder | travel x1.4, period x0.75, islands x0.85 |
| 5 | Infinite Tower | placeholder | travel x1.4, period x0.72, islands x0.8 |

The islands joined by a bridge keep their size (the bridge must reach them). Limits per level are
proven the same way (step 6) and identical. Clear: a win (time game).

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
`ASSETS.hero` is the slot for the Hyper3D hero GLB (`armadilloHero`, being generated); its url is
not in the model manifest yet, so nothing is fetched and `Hero.tsx` draws the **code stand-in**
`Armadillo.tsx`, modelled on the user's approved concept (`%USERPROFILE%\.play50\concepts\groupB\B01-armadillo-hero.png`,
never committed): Riko red overlapping plates from the crown down the back to a plated tail, glowing
orange seams between them, red shoulder and knee pads with glowing edges, an open red helmet with a
clear brim visor and headphones, tan skin and muzzle, a charcoal suit, a leather belt with a metal
buckle. 1.45 m tall (a little taller than the 1.2 m collider so it reads at play size). The old
turtle GLBs (`m2Hero*`, `turtleNinja`) are not used.

It is jointed in code (hips, legs, shoulders, arms, head, tail groups) and posed every frame
(`stepHeroPose`, pure): run stride with arm swing, bob and lean, a tuck at the jump apex, **curled
into its ball of plates** on bounce pads, in the intro drop and when falling (spinning with its
speed), landing squash, a pop-in on respawn, arms up with a hop and a spin at the gate. When the
Hyper3D GLB lands: add its url to the manifest, set `scale` = 1.45 / its height, and drive it through
the core auto-rig if it is a clean T-pose (the ball curl then stays a code part).

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

The hero stand-in is baked into about 20 merged meshes (`buildArmadilloShapes`, tested); every
repeated prop is instanced (`InstancedModel`, `DynamicInstancedModel` for movers and coins, one
billboard field per cloud layer). These runs include the autoplay bot's look-ahead (a 2 s simulation
copy per grounded frame), which a real player does not pay. No per-frame allocation in the frame loops
(scratch objects only).

## Known gaps vs the concept (for the sign-off)

1. **The hero is a code stand-in** (rounded shapes, jointed in code) until the Hyper3D armadillo
   GLB exists; it reads as the concept's silhouette at play size but not its sculpted detail.
2. **No hero choice and no abilities** (Dash, Double Jump, Shield, Magnet, Phase): only Riko (red).
3. **Rock roots** under the islands are low-poly code rock, flatter than the concept's sculpted cliffs.
4. **No real shadows** (blob shadow only); the concept's soft contact shadows are not there.
5. **Clouds are billboards** (soft but flat when the camera passes close); no volumetric clouds.
6. Levels 2-5 are placeholders on the level 1 course.
7. The HUD has no ability buttons (concept: Dash / Jump buttons); the touch Jump is the core button.
8. **No hero select screen** (the concept board's "choose your hero" row); the five colours are a
   material change (`HERO_COLORS.plate` / `plateDark`) once abilities exist.
9. The shared `menu2/scoreOrb.glb` is no longer drawn here (the gold star coin matches the concept's
   coins); it stays in the manifest for the other Menu 2 games.

## Test plan

`rules.test.ts` (26): course shape and comfort, determinism across seeds, jump apex and landing,
buffer, the per-ms speed bound on every level, movers, falls/respawn timing, finalScore, the lower
bound pieces, the limits per level, the honest bot on every level at 30/60/144 fps, the idle bot,
200 spam bots, the honest bot through the real store with ragged frames.
`assets.test.ts` (29): every GLB listed, on disk, in budget (the shared coin included), `GLB_SIZE`
equal to the real meshes and their walkable tops, the empty hero slot (`m2ArmadilloHero`, never
fetched until it exists), the baked stand-in (at most 22 meshes, feet on 0, 1.45 m tall), the
definition's levels and intro, the intro ending on the follow camera's pose.
