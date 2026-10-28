# Cloud Hopper (Menu 2, game 05, World 2 Sky & Sea): GLIDE

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). Rebuilt on 2026-10-27 to its
approved design card (`docs/menu2-super/world-2-sky-and-sea.md` "5 Cloud Hopper", framework
`00-framework.md`), on the menu2 shared systems after the `sky-tower-jump` reference adoption. The old
rising helix (a vertical jumper like Sky Tower) is gone: the game now goes **across**, and its core verb
is **GLIDE**.

## Concept and controls

Cross a drifting cloud sea before sunset. Every cloud sinks as soon as you land and bursts into vapour
a few seconds later, so you keep moving. Feathers fill a glide meter; hold Jump in the air to glide.
Wind bands push gliders. The rainbow bridge at the far end is the goal (level 5: ring the Tide Bell
once Gloom Nimbus is down).

- Keyboard: WASD / arrows move, Space jumps (**hold it in the air to glide**), E or Enter uses the power.
- Touch: joystick + Jump (hold to glide) + Power. One jump press, one held Jump and one action press,
  the same timings on touch and keyboard (decision 7).
- Camera (menu2/camera, the shared free orbit camera): drag the view with either mouse button (or two
  fingers / one finger on empty canvas), wheel or pinch zooms, Q / Z and C / X turn, R / F tilt, V (or
  the round touch button) recenters behind the hero; after 2.5 s without camera input it swings gently
  behind the travel. It starts straight behind the run (`camera.ts CLOUD_ORBIT`: yaw 0, 26° pitch,
  6.4 m, 4-16 m zoom, farther on portrait), its pivot leads towards the next cloud on the route, and
  clouds and walls near it pull it in (`courseSolids`). The intro ends on its first pose (`playCamera`).
- Movement is camera-relative inside the rules: the Scene writes the orbit's `viewYaw` into
  `StepInput.yaw` and `step()` turns the stick with core `inputToWorld` (multiplayer: every player's
  input gets the shared camera's yaw). Bots and tests leave it 0, so every bot and proof result is
  unchanged (`orbit.test.ts`); turning keeps the stick's length, so the speed bounds hold for any yaw.
- Hero choice: the shared Menu 2 picker (menu2/heroes `HeroPicker`) on the start card, the pause menu
  and the result screen; `heroes.ts` uses `createHeroPick("cloud-hopper")`, so **Nami** (W2's lead) is
  preselected and the player's own last pick here is remembered. A run keeps the hero it started with.
  The rules' own default (`DEFAULT_HERO`, bots and proofs) is Nami too.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 55, status `dev` |
| `index.tsx` | GameDefinition: `intro`, `clockChip: false`, `finalScore`, `ResultExtra` (stars), `runPlayers` |
| `levels.ts` | the five level configs: length, sink speed and burst time, sunset (timer), star target, boss |
| `sea.ts` | the course builder and each level's script (README "Levels") |
| `heroes.ts` | the five heroes, this game's powers and cooldowns, `DEFAULT_HERO` |
| `rules.ts` | pure rules: movement, glide, sinking clouds, feathers, rings, wind, hazards, boss, the bound, `PROPOSED_LEVEL_LIMITS`, `solidBoxes` / `courseBoxes` |
| `progression.ts` | combo, stars, secrets, `GLOOM_NIMBUS` (menu2/boss) |
| `levelEnd.ts`, `StarResult.tsx` | stars, the streak badge, secrets and XP to menu2/progress; the star screen |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players (menu2/multiplayer) |
| `Hero.tsx` | the picked hero's GLB on menu2/heroAnim, the glide lean, blob shadow |
| `Scene.tsx` | simulation, menu2/juice, the orbit camera (menu2/camera), intro |
| `camera.ts` | orbit tuning, pivot, the intro shots and their end pose, the camera's solid boxes |
| `Course.tsx`, `World.tsx` | the clouds and everything on them; the sky (follows the camera), puffs, cloud banks, castle |
| `Hud.tsx` | orbs, distance, glide meter, power, streak, flow meter, clock, Gloom Nimbus's bar |

## Rules

Units: 1 = 1 m; forward is -z. The clock is whole ms with the fraction carried, one ms at a time.

- **Hero:** cylinder r 0.32, h 1.2. On foot `V_RUN` 6.5 m/s; jump `V_JUMP` 13 (apex 2.82 m, G 30).
- **Glide:** airborne, past the apex, Jump held and glide in the meter: forward speed eased to `V_GLIDE`
  7 m/s, falling exactly `GLIDE_FALL` 1.2 m/s; the meter drains 1 ms a ms. Letting go or an empty meter
  falls from there.
- **Feathers:** +1.5 s glide each (meter max 4.5 s, the card's cap: you must land to keep going); a taken
  feather comes back after 4 s. A respawn leaves at least 1.5 s in the meter.
- **Sinking clouds:** a landing starts the cloud's clock: it sinks (L1 0.3 m/s, then 0.6) and bursts after
  5 s (L1) / 3 s, re-forming 3.5 s later. Solid **anchor** clouds (checkpoints) never sink, one at
  least every 55-60 m (the card's risk fix); the start, the bridge and the hidden clouds never sink.
- **Centre landings:** a first landing within 0.8 m of a cloud's middle adds a streak point (a climbing
  chime); an off-centre first landing breaks it. 20 in a row = the badge.
- **Wind rings** add 1 s of glide. **Lift rings** (the dawn shard's updraft, level 3's secret ring) throw
  you straight up and top the meter up: vertical only.
- **Wind bands** (z slabs): felt in the air, in full while gliding, 40 % in a plain jump, never on a cloud
  or in a dash. Tail wind -7 m/s (a glide doubles), head wind +3.5 (a glide halves; head bands are
  hops only), crosswinds ±3 sideways.
- **Drift** (L2): clouds slide along x (1.6 m/s at most), never forward. **Pulse** clouds (L4): solid 60 %
  of every 0.75 s beat, 0.7 s of grip after a landing. **Thunderheads**: touching one is a hit. **Rim
  strikes** (L4) on the clouds beside a thunderhead.
- **Falls / hits:** 8 m under the last cloud, or a hazard: 900 ms lost + 600 ms on the anchor. The clouds
  re-form and the feathers come back. The clock runs on.
- **Finish:** standing on the rainbow bridge (level 5: only once Gloom Nimbus is down). The sunset
  (`durationMs`) ends the run "timeup", unranked.

### Hero roles (the card)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | air dash 500 ms at 12 m/s (6 m), costs 1 s glide, once a flight (8 s) | crashes through storm-cloud walls onto a storm shelf (bonus orbs; the storm shard on L2 and L5) |
| Nami | air jump at full `V_JUMP`, refreshed once per glide (2.5 s) | the sun shelf 4.2 m over a glide gap (bonus orbs) |
| Kiro | shield 2.5 s (15 s) | glides through thunderheads (an orb in one on every level; the thunder shard on L4), shrugs off strikes and hail |
| Zuno | magnet 2.5 s, reach 6 m (15 s) | pulls feathers and orbs in, and the rain column's hidden orbs only show and come under it |
| Vexa | phase 1.5 s (12 s) | slips through a one-way ghost veil onto the night path (bonus orbs, the night sticker) |

Every level has all five. The gated orbs are **bonus**: the all-orbs star counts the main orbs only,
so any hero earns every star.

## Scoring

A **time game**: `score = floor((timeBaseMs − duration_ms) / 10)`. The submitted duration is
`finishMs − 400 · orbs − comboMs` (`finalScore`, `runTimeMs`); only a win is ranked.

### Server limits and why they hold (the proof)

1. **Clock:** `simMs ≤ elapsedMs`, `finishMs ≤ elapsedMs` (whole ms, the fraction carried).
2. **The z guard:** every ms, the rules cap the hero's step towards -z at `vmaxZ(z)/1000`, z taken at the
   ms's start: `max(V_RUN, V_GLIDE + tail, V_RUN + 0.4 · tail)` in the band there (7 m/s with no wind),
   `V_DASH` in a dash. Nothing else moves you forward: drift is along x, lifts are vertical, a respawn
   goes back. `rules.test.ts` checks it every ms against 30 s of random input for every hero on every
   level.
3. **Least finish:** the run from `startZ` to the bridge's near edge, cut at every band edge, costs at
   least `length · 1000 / v − 4` ms per piece (4 ms for a step that overshoots into the next piece):
   `progressFloorMs`. Level 5 also needs Gloom Nimbus down; the boss machine (menu2/boss) is time-driven
   and hits land only in its vulnerable windows, so it cannot be down before `bossMinMs` = 17 700 ms
   (every window hit at its first ms). `minFinishMs = max` of the two.
4. **Least duration:** less every orb (bonus orbs included) at 400 ms and the flow bound
   `comboMaxBonus` (each orb 40, each first landing on a cloud 20, each first ring pass 30, x2 cap).
5. **Dash floor:** a dash is on 501 ms at 12 m/s where the floor counted at least 6.5: it saves at most
   424 ms; one per 8 s cooldown plus the first.
6. **Limits:** the bound less about 4.5 %, rounded down to 100 ms, never above the dash floor;
   `timeBaseMs` = `maxDurationMs` = the sunset.

| Level | Least finish | Orbs (main) | Flow bound | Least duration | Dash floor | minDurationMs | maxDurationMs | timeBaseMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 Soft Clouds | 35 475 | 28 (18) | 1 770 | 22 505 | 20 385 | 20 300 | 130 000 | 130 000 | 10 970 |
| 2 Moving Clouds | 41 975 | 28 (18) | 1 880 | 28 895 | 26 775 | 26 700 | 150 000 | 150 000 | 12 330 |
| 3 Wind Zone | 45 768 | 40 (30) | 2 480 | 27 288 | 24 745 | 24 700 | 180 000 | 180 000 | 15 530 |
| 4 Fading Clouds | 59 189 | 38 (27) | 2 560 | 41 429 | 38 240 | 38 200 | 210 000 | 210 000 | 17 180 |
| 5 Sky Sprint | 62 344 | 41 (31) | 2 820 | 43 124 | 39 733 | 39 700 | 240 000 | 240 000 | 20 030 |

Every level's maxScore is at least level 1's; level 5 is 1.83x. `meta.ts` and `arcade-games.json`
ship this table; `rules.test.ts` pins it; `registry.sync.test.ts` checks the JSON. (The old helix rows
were 7 100-20 700 ms / 8 290-18 930 points; the server still has those until the user uploads the JSON.)

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (Nami, no power; look-ahead jumps, glides only when a plain fall lands short, takes each cloud's orb and the feather before a glide gap) | wins every level at 30 / 60 / 144 Hz with no hit and every main orb: L1 10 036-10 039 (91.5 %), L2 11 319-11 324 (91.8 %), L3 14 206-14 216 (91.5 %), L4 15 943-15 945 (92.8 %), L5 18 269-18 431 (91.2-92.0 %, Gloom Nimbus beaten, 7 hits) |
| Every hero, plain and with its power mashed (60 Hz; Riko 30/60/144) | every plain run clears; no mashed finish beats the floor (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle | the sunset on every level ("timeup", unranked); on level 5 the chase keeps catching it |
| Spam (200 on L1, 40 per level, any hero, random stick, Jump mashed and held, power mashed, 4-50 ms frames) | no finish under the floor |

Mutation probes: a 15 % shorter level, or the same script in a tail wind everywhere, falls out of the
limits window; no level's row matches another level's course or timer.

## Levels (the card)

| Level | Length | Sunset | Twist |
|---|---:|---:|---|
| 1 Soft Clouds | 250 m | 130 s | three beats: big clouds 2 m apart, a feather before a 10 m gap, a wind ring a glide reaches; soft clouds (0.3 m/s, 5 s) |
| 2 Moving Clouds | 300 m | 150 s | clouds drift on lanes, so landings are planned |
| 3 Wind Zone | 360 m | 180 s | crosswinds, head winds that halve a glide, tail winds that double it (mid-air orbs on the downwind glides), the secret lift ring |
| 4 Fading Clouds | 420 m | 210 s | pulse clouds solid on the 0.75 s beat, thunderheads that strike the clouds beside them |
| 5 Sky Sprint | 480 m | 240 s | everything, with **Gloom Nimbus** |

The sunset star targets are the card's: 60 / 80 / 95 / 110 / 150 s (the honest bot: 30-57 s).

### Boss: Gloom Nimbus (level 5, menu2/boss `GLOOM_NIMBUS`)

Drawn as its own Hyper3D High model `m2GloomNimbusBoss` (15k tris, 0.6 MB, the character budget),
11 m wide (`assets.ts BOSS_SCALE`), with three eye glints that turn gold while it is open; it turns to
face the hero, leans back on the telegraph and in on the attack, recoils on a hit and rolls as it
sinks on its defeat. `m2StormCloud` at the same width is its fallback. 7 hp, three phases, one hit per open window, a slow-mo-style hit-stop on the
finish (visual only).
1. **Chase** (3 hits): it rolls after you at 5.2 m/s (a catch is a hit; each centre landing pushes it back
   2 m). Glide past its three lightning rods to charge shocks; each charge lands the moment it opens.
2. **Eyes** (3 hits): it rises in front. An eye ring opens ahead of you (it keeps 4 m ahead until it
   opens); fly through it while it is open. Hail falls where you stood when it telegraphed.
3. **Burst** (1 hit): its core opens the same way; then the Tide Bell on the bridge can ring.

## Stars, flow, secrets, progress

- **Stars:** clear, every main orb, the sunset target. **Badge:** a 20-landing centre streak (the card's
  no-hit bonus for this game).
- **Flow:** 2 s window, +0.25, x2 cap; orbs 40, first landings 20, first ring passes 30.
- **Secrets:** L1 dawn shard (a hidden cloud under a glide gap, a deep slow glide; a lift ring back up)
  and the night sticker (Vexa); L2 dawn + storm shard (Riko); L3 the updraft shard over the secret lift
  ring + night sticker; L4 dawn + thunder shard (Kiro); L5 dawn + storm + night.
- **Progress:** `levelEndStats` -> `recordLevelResult` on a win and a time-up.

## Local multiplayer (menu2/multiplayer, M1)

`multiplayer.ts`: N runs from the same seed sharing the sky: orbs, the clouds' sink clocks (the card's
versus mind game: a cloud one hero landed on is already sinking for the next), feathers and broken
walls. Co-op shares anchors and Kiro's shield, Zuno's magnet and Vexa's phase; the team clears when all
are on the bridge. Versus: first to the bridge, then the grace. `MultiScene.tsx` (shared camera, 30 m
zoom limit, player rings, a glide trail per player) and `MultiplayerHud.tsx` (button, join screen,
chips, podium). Multiplayer runs are never ranked.

## Camera solids (menu2/camera)

- `StepInput.yaw`: the orbit camera's yaw the stick is read against (0 = world space, bots and tests).
- `courseBoxes(course)` (the resting clouds and walls, static) and `solidBoxes(run, ms, out)` (clouds
  where they are now, gone ones left out, unbroken walls) as `{minX, maxX, minY, maxY, minZ, maxZ}`.

## Models

`public/models/3d/cloud-hopper/`: `m2CloudPlatformV2` (every cloud), `m2Feather`, `m2SkyStar` (the colour
orbs), `m2WindRing` (wind and lift rings), `m2RainbowBridge` (the bridge and the anchor arches),
`m2StormCloud` (thunderheads, storm walls, the boss fallback), `m2GloomNimbusBoss` (the level 5 boss), `m2CloudCastleBg`, and **`m2CloudBank`** (new
here, copied from the ready sky-tower-jump set: low banks under the run). `m2CloudPlatform` (v1) is not
used. The heroes are `menu2/heroModels`. Code: the sky dome, wind streaks, ghost veils, the bell, rods,
the eye ring, hail shadows, secret markers.

## Open issues

- **Not playtested in a browser** in this pass (no build, per the brief): the look, the camera on phones
  and the draw-call budget (about 25-35 expected: one per prop kind, one per storm wall) need the
  headless check.
- The card's co-op **piggyback** (land on an ally mid-glide to refresh glide) and the versus
  **straggler teleport** are not built.
- A respawn re-forms every cloud and returns every feather; in multiplayer that resets the shared sky
  for everyone.
- The boss GLB's eye glints are placed from its bounds, not from its drawn face: check them against
  the model in a browser.
- Music stems per combo and the sunset sky tint over time are not built (the HUD clock is the sun).
- Gloom Nimbus's "swallows clouds" and "sinks the last clouds, drops feathers" are flavour not built:
  the chase is a line behind you and the burst is a third ring.
