# Plate Surf (Menu 2, game 37, World 2 Sky & Sea): CARVE

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). Built on 2026-10-28 to its
approved design card (`docs/menu2-super/world-2-sky-and-sea.md` "37 Plate Surf" on `claude/m2-super-plan`,
framework `00-framework.md`) on the menu2 shared systems, after the cloud-hopper reference. The genre is
the card's **ocean wave surf** (not a downhill board slope); the core verb is **CARVE AND PUMP**.

## Concept and controls

Ride a giant rolling wave on a hero plate along a bay. Carve up and down its face: a hard down-carve
through the glowing sweet band pumps +1.5 m/s (up to 24 m/s). Stop pumping and you slow down, and the
curl behind you catches up. At the lip, Jump airs; hold a direction in the air for a trick (spin, flip,
grab): a landed trick links the flow meter and buys 1 s of curl buffer. Reach the lagoon (level 5: once
King Breaker is down, ring the Tide Bell on the beach).

- Keyboard: A / D (or left / right) carve down / up the face, S (or down) brakes, Space at the lip airs
  (hold a direction in the air for the trick: left / right spin, back flip, forward grab), E or Enter is
  the hero power.
- Touch: joystick (carve; in the air it picks the trick), Air (the Jump button) and Power. The same
  windows on touch and keyboard (decision 7). A pump buzzes the phone (`navigator.vibrate`, the card's
  risk fix) and the band glows brighter while a pump is armed.
- Camera (menu2/camera, the shared free orbit camera): drag (either mouse button, two fingers, or one
  finger on empty canvas), wheel / pinch zooms, Q / Z and C / X turn, R / F tilt, V (or the round touch
  button) recenters. It starts behind the rider and 20° out over the trough (`camera.ts SURF_ORBIT`), so
  the face rises on the right with the lip on top; the auto-follow swings back to that side; the wave's
  body and the sea are its solid boxes (`rules.ts waveBoxes`), so it never dives into the water.
- Movement is camera-relative inside the rules: the Scene writes the orbit's `viewYaw` into
  `StepInput.yaw` and `step()` turns the stick with core `inputToWorld`. Tricks read the raw stick, so a
  turned camera never changes which trick a direction is. Bots and tests use yaw 0.
- Hero choice: the shared picker (menu2/heroes `HeroPicker`) on the start card, the pause menu and the
  result; `createHeroPick("plate-surf")`: **Nami** (W2's lead) is preselected; the rules' own default
  (`DEFAULT_HERO`) is Nami too.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 56, status `dev` |
| `index.tsx` | GameDefinition: `intro`, `clockChip: false`, `finalScore`, `ResultExtra` (stars), `runPlayers` |
| `levels.ts` | the five level configs: length, wave height, curl speed, clock cap, star target, boss |
| `waves.ts` | the face's profile (`faceY`), the band, the lip, the side lanes, and each level's script |
| `heroes.ts` | the five heroes, this game's powers and cooldowns, `DEFAULT_HERO` |
| `rules.ts` | pure rules: carving, pumping, the curl, airs and tricks, hazards, lanes, checkpoints, the boss, the bound, `PROPOSED_LEVEL_LIMITS`, `waveBoxes` |
| `progression.ts` | combo, stars, secrets, `KING_BREAKER` (menu2/boss) |
| `levelEnd.ts`, `StarResult.tsx` | stars, the no-hit badge (never swallowed), secrets and XP to menu2/progress; the star screen |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players (menu2/multiplayer) |
| `Hero.tsx` | the picked hero's GLB on menu2/heroAnim with the surf stance and trick moves, the plate, its pump glow, the shadow |
| `Wave.tsx`, `waveLook.ts` | the sea, the wave's face, the curl's pitching lip, the sky (shaders) |
| `Course.tsx` | orbs, buoys, rocks, reef walls, ghost arches, gates, jellies, gulls, spray, beacons, secrets, the finish, King Breaker |
| `World.tsx` | the bay's cliffs, sea stacks, ledge arches and level 4's canyon walls |
| `look.ts` | the palette per level, the chalk-grey to colour restore, the hazard violet |
| `Scene.tsx` | simulation, menu2/juice, the orbit camera, the barrel light, intro |
| `camera.ts` | orbit tuning, pivot, travel, the intro shots and their end pose, the camera's solid boxes |
| `Hud.tsx` | orbs, speed meter, curl meter, hearts and distance, power, tricks, flow meter, clock, level 1's coach line, King Breaker's bar |

## Rules

Units: 1 = 1 m; the ride runs along -z; x is the horizontal distance across the face, from the trough
(x = 0) to the lip (x = 12, `FACE_W`); the face's height is a smoothstep up to the wave's height (6.5 m on
level 1, 8 m after). The clock is whole ms with the fraction carried, one ms at a time.

- **Speed along the wave** `v`: starts at 13 m/s, never under 9, never over 24 (`V_MAX`). The face's drag
  takes 2 % of it a second (none in the calm side lanes); pulling back brakes (6 m/s²).
- **Carving:** the stick steers across the face at up to 9 m/s (45 m/s²).
- **Pumping:** once above the band (x ≥ 6.96, armed), a down-carve that crosses the band's top and then
  its bottom (x 5.04) within 600 ms adds +1.5 m/s. A slower one is a miss ("carve harder"). One pump per
  climb.
- **The curl** starts 24 m behind you and chases at the level's speed (11 / 12 / 12.5 / 15 / 13 m/s; +2
  in level 5's barrel). It never falls more than 26 m behind (close enough to hear and, on a slip, to see). A landed trick pushes it back 1 s. Within
  0.8 m it swallows you: a heart and a respawn on the last checkpoint (13 m/s, the curl 26 m behind).
- **Airs:** Jump within 1.6 m of the crest launches at 9 m/s (apex 1.69 m, 0.75 s), G 24. In the air the
  stick picks the trick; held 320 ms it lands, landed short of that it is a bail (-4 m/s, the flow
  breaks).
- **Hazards:** rocks wipe you out (a heart, a respawn) unless you are above them; buoys slow you 3 m/s;
  jellies, diving gulls, the violet storm spray and King Breaker's attacks sting (-5 m/s, the flow breaks,
  0.9 s grace). Kiro's shield ignores the stings.
- **Hearts:** 3; each checkpoint gives one back; out of hearts ends the run "lose" (unranked).
- **Finish:** reaching the lagoon line. Level 5 holds you 30 m short of it until King Breaker is down.
  The clock cap (`durationMs`) ends the run "timeup", unranked.

### Hero roles (the card)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | dash carve 450 ms: +4 m/s (never past 24) and a sideways push (6 s) | breaks the cracked reef walls into the hidden lagoon lanes (bonus orbs; the reef shard on L2 and L5) |
| Nami | a second air in the air (1.5 s) | the spray ledges' orb rows 3.6 m over the crest by the cliff arches (one air peaks at 1.69 m); L4's cliff-cave shard |
| Kiro | shield 3 s (12 s) | rides straight through the violet storm spray over the lip (its bonus orbs), jellies, gulls and bubble mines |
| Zuno | magnet 4 s, reach 6 m (12 s) | the hidden orb trails in the trough's foam only show and come under it |
| Vexa | phase 2 s (12 s) | slips through the ghost rock arches into the calm inner lane (bonus orbs, the sticker on L1, L3, L5) |

Every level has all five. The gated orbs are **bonus**: the all-orbs star counts the main orbs only, so
any hero earns every star.

## Scoring

A **time game**: `score = floor((timeBaseMs − duration_ms) / 10)`. The submitted duration is
`finishMs − 250 · orbs − comboMs` (`finalScore`, `runTimeMs`); only a win is ranked.

### Server limits and why they hold (the proof)

1. **Clock:** `simMs ≤ elapsedMs`, `finishMs ≤ elapsedMs` (whole ms, the fraction carried).
2. **The z guard:** every ms, the rules move the hero towards -z by `min(v, V_MAX) / 1000` and nothing
   else moves it forward: carving, knocks, bounces and the spray push are along x, a respawn and level 5's
   hold move it back. `rules.test.ts` and `orbit.test.ts` check it every ms against random input for every
   hero on every level and under random camera yaws.
3. **Least finish:** the ride's length at 24 m/s, less 4 ms (`progressFloorMs`). Level 5 also needs King
   Breaker down: it rises at the first ms the rider passes 260 m (at least 260 m at 24 m/s), and its
   machine (menu2/boss) is time-driven with hits only in its windows, so it cannot be down before
   `bossMinMs` = 19 900 of its own ms after that (`bossFloorMs`). `minFinishMs = max` of the two.
4. **Least duration:** less every orb (bonus orbs included) at 250 ms and the flow bound `comboMaxBonus`
   (each orb 40, each gate's first pass 30, the first 24 landed tricks 30, x2 cap). Tricks are repeatable,
   so only the first `TRICK_LINKS` = 24 of a run feed the meter (the bound stays finite).
5. **Powers:** the dash is capped at V_MAX like everything else, so there is no separate dash floor.
6. **Limits:** the bound less about 4.5 %, rounded down to 100 ms; `timeBaseMs` = `maxDurationMs` = the
   level's clock cap.

| Level | Least finish | Orbs (main) | Flow bound | Least duration | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 Training Swell | 24 996 | 34 (16) | 2 005 | 14 491 | 13 800 | 120 000 | 10 620 |
| 2 Rocky Path | 33 329 | 49 (30) | 2 605 | 18 474 | 17 600 | 140 000 | 12 240 |
| 3 Jump Gates | 37 496 | 49 (31) | 2 935 | 22 311 | 21 300 | 160 000 | 13 870 |
| 4 Speed Canyon | 43 746 | 51 (30) | 2 685 | 28 311 | 27 000 | 180 000 | 15 300 |
| 5 Plate Surf Master | 58 329 | 46 (28) | 2 515 | 44 314 | 42 300 | 240 000 | 19 770 |

Level 5's boss floor (10 829 ms to its start line + 19 900 − 2) is under its z floor, so the z floor binds.
Every level's maxScore is at least level 1's; level 5 is 1.86x. `meta.ts` and `arcade-games.json` ship
this table; `rules.test.ts` pins it; `registry.sync.test.ts` checks the JSON.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (Nami, no power; pumps in rhythm, steers onto a main orb only when its pump would miss it, keeps a free line, airs at the lip with a held spin) | wins every level at 30 / 60 / 144 Hz, never swallowed: L1 9 320-9 324 (87.8 %), L2 10 373-10 687 (84.8-87.3 %), L3 12 303-12 328 (88.7-88.9 %), L4 13 620-13 805 (89.0-90.2 %), L5 17 603-17 608 (89.0-89.1 %, King Breaker beaten); every main orb on L1-L4, 22 / 28 on L5 |
| Every hero, plain and with its power mashed (60 Hz; Riko 30/60/144) | every plain run clears; no mashed finish beats the floor (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle | the curl takes every heart ("lose", unranked) on every level |
| Spam (200 on L1, 40 per level, any hero, random stick, Jump and power mashed, 4-50 ms frames) | no finish under the floor |
| Random camera yaws | the z guard holds every ms (`orbit.test.ts`) |

Mutation probes: a 15 % shorter level falls out of the limits window; no level's row matches another
level's course or timer.

## Levels (the card)

| Level | Length | Wave | Curl | Cap | Twist |
|---|---:|---:|---:|---:|---|
| 1 Training Swell | 600 m | 6.5 m | 11 m/s | 120 s | three beats: pump orbs on a small wave (the coach line names the move), a buoy line to carve round, then the lip opens for three air orbs and a first trick |
| 2 Rocky Path | 800 m | 8 m | 12 m/s | 140 s | rock gardens in the lanes: high line or low line (the main orbs on one, buoys on the other), then a slalom |
| 3 Jump Gates | 900 m | 8 m | 12.5 m/s | 160 s | eleven lip gates (m2NeutralRing) only an air reaches, an orb in each; jellies bobbing in the trough |
| 4 Speed Canyon | 1050 m | 8 m | 15 m/s | 180 s | sea cliffs close in (the trough becomes a rock shelf, the face narrows to x ≥ 3.2), diving gulls with shadow telegraphs, the cliff cave |
| 5 Plate Surf Master | 1400 m | 8 m | 13 m/s | 240 s | a warm-up, then **King Breaker** rides ahead of you to the beach |

The star targets are the card's: 50 / 65 / 75 / 85 / 120 s.

### Boss: King Breaker (level 5, menu2/boss `KING_BREAKER`)

`m2GiantCrabBoss` drawn 5.2 m wide. It rises once you pass 260 m and rides the wave ahead of you (20 m
lead); while it can be hit (3 s windows in phases 1-2) it slows to 10 m/s so you can catch it (miss the window and it trails just
behind you). Its eyes glow and the HUD bar pulses while it is open; it rears on the telegraph, slams on
the attack, flashes on a hit and rolls over on its defeat. 7 hp, one hit per window, a slow-mo-style
hit-stop on the finish (visual only).
1. **Claw** (3 hits): a 1.2 s violet shadow in your lane where you will be, then the slam (a sting). It
   rests on the lip: air off the lip onto its carapace.
2. **Bubbles** (3 hits): it burrows; bubble mines rise across the lower lanes ahead (ride the high line).
   When it surfaces on the lip, trick into its eye stalks at 16 m/s or more.
3. **Barrel** (1 hit): the wave barrels (the lip is thrown over you, the light turns teal, the curl runs
   2 m/s faster) and it blocks the face's middle, snapping its claws; carve into it at 17 m/s or more.
   Then ring the Tide Bell on the sand bar.

## Stars, flow, secrets, progress

- **Stars:** clear, every main orb, the target time. **Badge:** the card's no-hit bonus, never swallowed by
  the curl.
- **Flow:** 2 s window, +0.25, x2 cap; orbs 40, gates 30, tricks 30 (the first 24).
- **Secrets:** a **pearl shard** on every level in a hidden tube section (taken only at 21 m/s or more);
  Vexa's sticker in the calm lane (L1, L3, L5); Riko's reef shard in the lagoon (L2, L5); L4's cliff-cave
  shard only Nami's double air reaches.
- **Progress:** `levelEndStats` -> `recordLevelResult` on a win, a time-up and a lose.

## Juice

Spray fans off every carve (more at speed); a pump thrums (a low note rising with speed, the plate glows
in the hero's colour, a small +1.5 pop, a camera thump, a phone buzz); tricks pop icons only (↻ spin, ⇅
flip, ✋ grab); the curl roars louder and faster as it closes and the HUD's curl meter turns amber then
red; within 7 m of the curl (and in level 5's barrel) the light turns teal; spray streams off the curl's
lip; the colour of the bay returns from chalk grey as you take the main orbs (the World 2 intro).

## Local multiplayer (menu2/multiplayer, M1)

`multiplayer.ts`: N runs from the same seed on the same wave, sharing the orbs and the reef walls; each
rider has its own curl (a straggler is pulled in by its own). **Co-op:** shared checkpoints; Kiro's
shield, Zuno's magnet and Vexa's phase cover the team; **tandem pump**: riders side by side (within 5 m
along the wave) pick up 0.8 m/s² (capped at 24). The team clears when all are in the lagoon. **Versus:**
the leader gets no draft, a rider 2-14 m behind picks up 0.6 m/s²; first to the lagoon, then the grace;
the podium by time, then orbs and distance. `MultiScene.tsx`: one shared camera behind and above the
pack (30 m zoom limit, held on the leader in versus), player rings. Multiplayer runs are never ranked.

## Models

`public/models/3d/plate-surf/` (copied from `%USERPROFILE%\.play50\hyper3d\ready\menu2\`, already
optimized): `m2SurfPlateI` (the image-batch surf plate), `m2AquaOrb`, `m2MarkerBuoy`, `m2SeaRock`,
`m2SeaCliffBg`, `m2SeaGullDiver` (the card's NICE level 4 hazard), `m2GiantCrabBoss` and `m2SlimeBlob`
(from `shared/`), `m2NeutralRing` (from `ring-jump-challenge/`). The checkpoint beacon is menu2's shared
`checkpointBeacon`. Code: the sea, the wave, the curl, the sky (shaders), the ghost arches (menu2/props
ArchWall), the spray sheets, the secrets, the finish line, the sand bar and the Tide Bell.

## Open issues

- **Pump feel needs a human check.** A pump needs a carve from above the band (x ≥ 6.96) down through
  its bottom (x ≤ 5.04) inside 600 ms. A scripted keyboard test with fixed 0.85 s key holds, starting
  from the lip, pumped once in four tries: a player has to hold the carve until they pass the glow (the
  coach line and the band's armed glow say so). The user should play level 1 and judge it.
- The card's `surfStance` / `carveL` / `carveR` / `trick` clips are built here (`Hero.tsx`
  `surfStancePose`, `grabPose`, the spin / flip turns) from the shared pose helpers, with a copy of
  `useHeroAnimator`'s pipeline: they belong in `menu2/heroAnim` (a shared follow-up).
- The jellies are `m2SlimeBlob` with a glossy jelly-blue material, not translucent (core material
  overrides have no opacity). The model is 18k triangles, so only the jellies within 55 m are drawn.
- The co-op lip gates that need two riders airing at once are not built (co-op tandem pump and versus
  draft are).
- Each rider has its own curl in multiplayer; the wave draws the trailing rider's.
- No music stems per combo (shared audio has none yet); the curl's roar is repeated whoosh one-shots.
- Headless frame times: p50 16.7 ms everywhere, p95 21-41 ms (software-ish GPU under load from other
  agents); draw calls 13-33, triangles 107-298k at peak (level 4's canyon is the heaviest). A real mid
  phone check is still to do.
- No thumbnail yet (`public/images/3d/plate-surf.webp`, meta `thumbnail: null`).
