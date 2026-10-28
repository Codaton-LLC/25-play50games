# Rooftop Roll Climb (Menu 2, game 02)

Owner: Cursor (Menu 2 super-game upgrade by Claude). Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`).
Design card: `docs/menu2-super/world-1-ember-heights.md` "2 Rooftop Roll Climb" (branch `claude/m2-super-plan`), World 1 Ember Heights.
The hero is the shared Color Roll Heroes armadillo (`m2HeroRiko.glb`; the other four colours are their own GLBs).

## Concept and controls

**Curl into a ball on slanted roofs to bank speed, then spend it on huge leaps up a zigzag city skyline.**
Each block of the city is a landing deck, a fire-escape climb to its top deck, and a slanted tin roof that falls
away to a lip over the street. Lean downhill on the roof and the hero curls into a ball that rolls faster and
faster; jump at the lip and the banked speed carries the leap across the street to the next, higher block, which
faces the other way (the switchback). A plain run-and-jump does not clear a street.

- Keyboard: WASD / arrows move, **camera-relative** (up = away from the camera), Space jumps, E or Enter is the hero power.
  Camera: drag the view (left or right mouse button), wheel zooms, Q / Z and C / X turn, R / F tilt, V recenters (menu2/camera).
- Touch: the core joystick + Jump + Power; one finger on empty canvas or two fingers turn the camera, pinch zooms, the round
  button recenters. **The same timing for both** (decision 7): one jump press and one action press, the same 130 ms buffer and
  100 ms coyote time.
- The hero picker (menu2/heroes `HeroPicker`) on the start card, the pause menu and the result screen preselects the World 1
  lead, **Riko**, or the player's own last pick in this game. A run keeps the hero it started with.

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms with the fraction carried: every arc depends only on the ms
since take-off, the same at 30, 60 or 144 fps. `StepInput.yaw` (the orbit camera's drawn yaw) turns the stick inside the rules
(core `inputToWorld`); bots and tests leave it 0. Turning keeps the stick's length, so every speed bound below holds for any yaw.

- **Hero:** a vertical cylinder (radius 0.32, height 1.2), feet at y. Stick velocity eased towards `V_RUN` 6.5 m/s (accel 50 on
  the ground, 32 in the air, 36 on a wet flat roof). Gravity 30, jump 14 m/s (apex 3.27 m), 130 ms buffer, 100 ms coyote time.
- **Slope momentum (the signature).** On a slanted roof (grade 0.3, about 17°), leaning downhill (`moveX · dir > 0.5`) curls the
  hero into a ball (`Hero.curled`). The ball accelerates downhill at the slope's `accel` (6.5 m/s² on L1, up to 8 on L5; rain-wet
  tin 1.5×, and on wet tin you cannot uncurl), the stick only steers across, up to `V_ROLL_MAX` 13 m/s. A jump keeps the
  horizontal speed: a leap off the lip covers about 9-12 m against about 6 m from a run (`rules.test.ts` "the signature").
  Curled on a flat roof the ball bleeds 4 m/s²; uncurled above `V_RUN` it brakes at 22 m/s² (13 → 6.5 in 0.3 s). A landing on
  a flat roof thumps the ball back to running speed; L1's chained slope and L5's ramps keep the roll (`keep`).
- **Banked leap:** a take-off from a slope at 10 m/s or more is a flow link (once per slope); at 9 m/s or more it is a rolled
  leap (`Hero.rolled`: the FOV push and the ember trail).
- **Roofs:** rectangles; a slope's surface falls along x (`surfaceY`). Landing = the feet cross a surface downwards with the centre
  over it (grown by `FOOT` 0.15). Touching roofs at the same height are walkable seams (a top deck and its slope's high edge).
- **Gondolas (L2, L4) and crane slabs (L3, L5):** mid-street landing pads on a smooth triangle wave (2.4 s / 3.2 s); a grounded hero
  is carried by the mover's own per-ms step.
- **Blinking roofs (L3, L5):** period 2800 ms, gone 28 % of the cycle; a landing grips 1600 ms.
- **Chimney updrafts (L4, L5):** a chimney cap beside the climb launches the hero up to the block's top deck (a vertical shortcut).
- **Spark arcs (L4, L5):** a neon sign's arc across a slope's roll line on a 2.8 s cycle; shield and phase ignore it.
- **Checkpoint lamps** every second deck; **falls** 7 m under the last top: 900 ms out of view, then 600 ms frozen on the lamp.
- **Coins:** within 0.95 m of the hero's middle (4.2 m with Zuno's magnet); 400 ms off the submitted time each.
- **Hero powers** (E / Enter / Power). Riko Dash: 280 ms at 12.5 m/s, or 3 m/s over a banked roll up to `V_TOP` 15.5 m/s (the card's
  burst), then 15 s; it smashes cracked skylights. Nami Double Jump: a flutter (at most 3.25 m/s across) whose apex never passes the
  flight's, then 10 s. Kiro Shield 2.5 s, Zuno Magnet 2.5 s, Vexa Phase 1.2 s (through ghost billboards), then 20 s each.
- **Finish:** standing on the helipad; on L5 (solo) Ashback's defeat is the finish. The level timer ends the run unranked.

## Levels (design card)

| Level | Title | Timer | Blocks | What it adds |
|---|---|---|---:|---|
| 1 | Low Roofs | 90 s | 5 | a 7 m street only a rolled leap clears (a low catch roof under the first one, so a short leap can retry), the switchback, two chained slopes (roll off the lip onto the next one curled) to the helipad |
| 2 | Office Roofs | 120 s | 6 | window-cleaner gondolas slide mid-street (2.4 s): time the roll so the leap meets one |
| 3 | Moving Rooftops | 150 s | 7 | crane-swung slabs (3.2 s), rain-wet tin slopes (1.5× the roll, no braking), a blinking deck |
| 4 | Night Skyline | 180 s | 7 | chimney updrafts, neon spark arcs on a 2.8 s cycle, night look |
| 5 | High-Rise Climb | 240 s | 7 | everything, then **Ashback, the Shadow Armadillo** on the helipad arena |

**Ashback** (`m2ShadowArmadillo`, `progression.ts ASHBACK`, menu2/boss): the arena is a half-pipe (deck, ramp, pad, ramp, deck).
Every attack ends with him open at the foot of the ramp on your side: roll down it into him, curled and fast, for a hit.
P1 Race (2 hits, ≥ 9 m/s): he kicks a water tank across the pad (1 s telegraph, a 1 s rolling hazard). P2 Grey paint (2 hits,
≥ 10 m/s): he sprays your ramp grey (no roll speed on it) and stands at its foot. P3 Helipad duel (3 hits): a 2.5 s telegraph,
a curled ram across the pad, then he is stunned at your foot. Slow-mo finish; he flees down the mountain. The boss adds no score.
Local multiplayer plays the arena as a plain finish on the pad.

## Stars, flow, secrets (Menu 2 systems)

- **Stars** (menu2/stars): clear; every coin; the submitted time at or under the target (about 1.5× the honest bot: 29 / 37 / 40 /
  42 / 83 s); the no-hit badge. `levelEnd.ts` records them in menu2/progress.
- **Flow meter** (menu2/combo): each coin, each first landing on a roof and each slope's first banked leap is a link within 1.2 s
  (the card's 0.6 s is shorter than a rolled leap's flight), +0.25 per link, up to ×2. The bonus comes off the submitted time and is
  bounded in the proof (`comboSpecOf`).
- **Secrets** (menu2/secrets, no score): L1 water-tower sticker (Nami's ledge 8 m past a deck), gutter shard (Zuno's magnet, out
  over the street beside a slope), skylight shard (Riko's dash smashes the cracked skylight); L2 ghost-billboard shard (Vexa),
  water-tower sticker; L3 the red shard on a crane hook over a street (a perfect rolled leap), skylight sticker; L4 neon shard inside
  a live arc (Kiro), billboard shard, gutter sticker; L5 skylight, water-tower and neon.

## Scoring

A **time game**: `score = floor((timeBaseMs − duration_ms) / 10)`, recomputed by the server. The submitted duration is
`finishMs − 400 · coins − flow bonus` (`runTimeMs`). Only a win is ranked; multiplayer runs never are.

### Server limits and why they hold

1. **Clock.** `simMs ≤ elapsedMs`, `finishMs ≤ elapsedMs`.
2. **Height only grows in flight.** An arc starts at `V_JUMP`, 0 (walk-off, head bump), an updraft's launch, or Nami's capped
   second jump. A landing sets y to a surface just crossed downwards.
3. **Speed caps, by construction.** The rules clamp the hero every ms (`capAt`): on a support the speed is at most
   `sqrt(vIn² + 2 · accel · (d − dMin))` (the roll from the uphill-most point stood on, `d` downhill), never above `V_ROLL_MAX`;
   `vIn` is `V_RUN` everywhere except `keep` slopes and the arena (`V_ROLL_MAX`). In the air at most the take-off's cap (the stick
   may still reach `V_RUN`), Nami's flutter `V_FLUTTER`; a dash at most `V_TOP` for 281 ms.
4. **Flights.** From a node to a support's slice at most `reachMax` away: `vh` times the longest flight, where a jump's flight with the
   coyote walk-off first is `coyoteJumpS` (closed form: the walk-off drops the jump's start, the maximum is at `c = R / √2`), an updraft
   adds its own arc, Nami's flutter its own, a dash 2.53 m. The least time is `max(gap / vh, the rise's arc for dy > 0, the free fall
   from rest for a drop)`.
5. **Least finish.** Dijkstra over (support, slope slice, entry slice, boundary) nodes: rolling across a slice costs its width at the
   faster end's cap, so the bound cannot teleport along a slope. Riko's and Nami's powered flights are layers of the graph, with at
   least `(k − 1)` cooldowns for `k` powered flights (`minArrivalMs`). L5 adds Ashback's least defeat time (`bossMinMs`: every hit on
   the first ms of every open window) to the first stand on the arena.
6. **Least duration.** The least finish minus every coin and the most flow bonus (`minDurationMsOf`):

   | Level | Least finish | Coins | Flow max | Least duration |
   |---|---:|---:|---:|---:|
   | 1 Low Roofs | 15 894 ms | 8 | 1 010 ms | 11 684 ms |
   | 2 Office Roofs | 19 951 ms | 6 | 1 030 ms | 16 521 ms |
   | 3 Moving Rooftops | 22 847 ms | 9 | 1 260 ms | 17 987 ms |
   | 4 Night Skyline | 22 035 ms | 9 | 1 320 ms | 17 115 ms |
   | 5 High-Rise Climb | 45 930 ms | 11 | 1 540 ms | 39 990 ms |

7. **Limits.** `proposeLimits` takes the least duration less about 2.5 %, rounded down to 100 ms (inside 94-100 % of it; the bound
   already covers every hero, so the margin only absorbs rounding). `maxScore = floor((timeBaseMs − minDurationMs) / 10)`.

   | Level | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
   |---|---:|---:|---:|---:|
   | 1 | 11 300 | 90 000 | 90 000 | 7 870 |
   | 2 | 16 100 | 120 000 | 120 000 | 10 390 |
   | 3 | 17 500 | 150 000 | 150 000 | 13 250 |
   | 4 | 16 600 | 180 000 | 180 000 | 16 340 |
   | 5 | 38 900 | 240 000 | 240 000 | 20 110 |

   Every level is worth at least level 1's 7 870; level 5's 20 110 is 2.56× (the cap is 3×). `meta.ts` and `arcade-games.json`
   ship this table; `rules.test.ts` pins it; `registry.sync.test.ts` checks the JSON against meta.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`, never uses the hero power) | Wins every level at 30, 60 and 144 fps. Submitted (30 / 60 / 144): L1 **18.498 / 18.920 / 18.982 s** (≥ 90.2 % of max), L2 **24.442 / 24.363 / 24.413 s** (92 %), L3 **27.136 / 26.221 / 26.199 s** (92.7 %), L4 **27.511 / 27.497 / 27.498 s** (93.3 %), L5 **54.913 / 54.943 / 54.864 s** with Ashback beaten (92 %) |
| Honest bot with each hero, power mashed (`proof.test.ts`) | never under the floor or over the clock on any level at 30/60/144 Hz |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | "timeup" at exactly the level timer, unranked |
| Spam bots (200 on L1; 60 per level with powers and random camera yaw) | no win under the floor |
| Mutation probes | one block fewer or one climb step fewer per block falls outside the limits window; no two levels share a row |

How the honest bot plays: it climbs the steps with the first jump that lands; from the last step it rehearses the skilled line (skip
the top deck and leap straight onto the slope's upper half) and takes it only when it beats the ordinary route; it leans downhill on
the roll line (where the coin is), jumps a little before the lip (or rolls off it onto L1's chained slope), waits for gondolas, crane
slabs, arcs and blinking decks by rehearsing the descent; and in Ashback's arena it sets off down its ramp as soon as a rehearsed
roll meets him while he is open.

## Tests

`rules.test.ts` (skyline, slope momentum, jumps and falls, the bound, the limits, the bots), `proof.test.ts` (every hero's power at
30/60/144 Hz, idle and spam on every level, mutation probes), `layouts.test.ts` (it plays differently from Lava Pillar Jump and Sky
Tower Jump), `progression.test.ts` (stars, flow bound, secrets and their gates, Ashback), plus the UI tests listed below.

UI tests: `orbit.test.ts` (bot unchanged at yaw 0, camera-relative stick, intro ends on the orbit's first pose, Riko preselected),
`multiplayer.test.ts`, `hero.test.ts` (menu2/heroAnim motion: curl, rolled leap), `assets.test.ts` (every GLB fitted to its real
mesh, the sloped roof's ridge and lip on each slope, Ashback's height), `look.test.ts`, `livePick.test.ts`, `powers.test.ts`.

## Files and look

| File | What |
|---|---|
| `levels.ts`, `roofs.ts` | the five level specs and the generated skylines (blocks, slopes, streets, movers, chimneys, arcs, secrets, the L5 arena) |
| `rules.ts`, `bot.ts`, `progression.ts` | pure rules + the proof, the honest bot, stars / combo / secrets / Ashback config |
| `levelEnd.ts`, `StarResult.tsx` | stars, no-hit and secrets into menu2/progress; the star screen on the result card |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 1-4 players (versus race, co-op with shared coins, checkpoints and ally powers; L5 is a plain finish on the pad) |
| `Scene.tsx`, `sceneJuice.ts`, `camera.ts` | simulation, menu2/juice (dust and kick on landing, ember trail at ≥ 10 m/s, +8° FOV in a rolled leap, banked-leap and skylight bursts, Ashback's hits and slow-mo defeat), the menu2 orbit camera, the intro |
| `Course.tsx`, `World.tsx` | roofs (`m2RooftopBlock`), slanted tin roofs (`m2SlopedRoofI`, a bevelled code wedge with a lip as fallback; wet tin darker and glossy), gondolas and crane slabs, chimney updrafts, neon arcs, skylights, ghost billboards, water towers, neon strips that relight red once landed on, Ashback (`m2ShadowArmadillo`, tank, grey paint) |
| `Hero.tsx` | the picked hero through menu2/heroAnim (ball-roll while curled, dash, double jump), blob shadow on slopes |
| `Hud.tsx` | shared HeroPicker, OrbitHud, roll-speed meter (red at banking speed), flow meter, Ashback's bar |

Known gaps: not yet looked at on screen (the slope GLB's stretch, Ashback's facing and scale, the paint decal); Ashback shows the
shared health bar with phase marks, not a distance meter; water tanks rolling down slopes outside the arena and a landing-shadow
preview while curled are not drawn; climb steps are separate narrow buildings rather than a fire escape.
