# Color Door Sprint (Menu 2, game 46, World 1 Ember Heights): READ AND COMMIT

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). Built on 2026-10-28 to its
approved design card (`docs/menu2-super/world-1-ember-heights.md` "46 Color Door Sprint" on
`claude/m2-super-plan`, framework `00-framework.md`) on the menu2 shared systems, after the plate-surf and
rooftop-roll-climb references.

## Concept and controls

Sprint down Shadow Plates' Hall of Doors (an auto-run along -z). A door wall comes every 35-45 m; a rule
lamp hangs ahead of each one. Read it and commit to the one true door before the wall locks (0.6 s
before impact; a lane change after that does nothing). The true door surges you on (+3 m/s for 0.5 s) and
links the flow meter; a wrong door bounces you back (1.5 s) and breaks it.

The rules escalate by level: **match the colour** (L1), **match the chime** (L2: every colour has its
own chime; halfway the lamp dims), **NOT this colour** (L3: the lamp is crossed out), the **echo rule**
(L4: a ringed lamp hangs two walls early and shows the rule for the wall after next). Colour-blind fix
(the card): every colour also has a shape (red circle, blue triangle, green square, yellow diamond,
purple hexagon) on the doors, the lamp and the HUD's rule card, and a chime.

- Keyboard: A / D or left / right change lanes, Space or up jumps (floor bars), S or down rolls (low
  beams), E or Enter is the hero power (on level 5 it fires the red rush while it is charged).
- Touch: swipe left / right to change lanes, swipe up or Jump to jump, swipe down to roll, Power. One
  finger is the swipe, so the orbit camera turns with two fingers (`input={{ oneFinger: false }}`).
- Camera (menu2/camera): the shared free orbit camera; drag (mouse), two fingers, wheel / pinch, Q / Z
  and C / X turn, R / F tilt, V (or the round button) recenters. It starts behind the runner; lane
  presses are camera-relative inside the rules (`StepInput.yaw`, `laneDirection`: with the camera turned
  round, "right" on screen is world left). Bots and tests use yaw 0.
- Hero choice: the shared picker (menu2/heroes) on the start card, the pause menu and the result;
  `createHeroPick("color-door-sprint")` preselects **Riko** (World 1's lead, `defaultHeroFor`).

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 62, status `dev` |
| `index.tsx` | GameDefinition: `intro`, `clockChip: false`, swipe + Jump + Power, `finalScore`, `ResultExtra`, `runPlayers` |
| `levels.ts` | the five level configs: speed, lanes, walls, clock cap, star target, boss |
| `halls.ts` | the hall: lanes, the five door colours (shape, chime), each level's walls, lamps, orbs, bars, beams, pads, vents, side corridors, secrets |
| `heroes.ts` | the five heroes, this game's powers and cooldowns, `DEFAULT_HERO` (Riko) |
| `rules.ts` | pure rules: the per-run door roll, lanes, the lock, slides, judgement, jumps, rolls, the gates, Flicker and his arena, the bound, `PROPOSED_LEVEL_LIMITS` |
| `progression.ts` | combo, stars, secrets, `FLICKER` (menu2/boss) |
| `levelEnd.ts`, `StarResult.tsx` | stars, the no-hit badge (no wrong door), secrets and XP to menu2/progress |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players (menu2/multiplayer) |
| `Hero.tsx` | the picked hero's GLB on menu2/heroAnim (run, jump, Nami's flip, the roll ball, dash streak, auras, recoil, cheer) |
| `Course.tsx` | door walls, coloured / shut / cracked / ghost doors, glyphs, the upper row, lamps, floor arrows, orbs, bars, beams, vents, pads, secrets, the finish gate, Flicker |
| `World.tsx` | the ember sky, the hall's floor, the side walls, the lanterns, the galleries beyond |
| `look.ts` | the palette per level |
| `Scene.tsx` | simulation, menu2/juice, the orbit camera, the lamp chimes, speed lines, intro |
| `camera.ts` | orbit tuning, pivot, the intro shots and their end pose, the floor box |
| `Hud.tsx` | orbs, speed, true doors and streak, power, the red rush pips, flow meter, clock, the rule card, L1's coach line, Flicker's bar |

## Rules

Units: 1 = 1 m; the run goes along -z; lanes are 2.4 m wide, centred on x = 0. The clock is whole ms,
the fraction carried, one ms at a time (the same run at 30, 60 or 144 fps).

- **Speed:** the level's (10 / 12 / 14 / 16 / 18 m/s) plus the biggest boost up (the true door's surge
  +3 for 0.5 s, a speed pad +4 for 1 s, Riko's dash +5 for 0.45 s, the red rush +6 for 0.7 s, and in
  Flicker's phase 3 +1 per hit), **never past `vMax` = speed + 6**. A stumble (a floor bar not jumped, a
  low beam not rolled under, a flame vent, Flicker's fire) runs at 45 % for 0.7 s.
- **The doors** are rolled per run from its seed: match / sound walls get distinct colours, the rule's
  colour once (the true door); NOT walls get the rule's colour on every door but the true one. The
  geometry (where the walls, specials, orbs and hazards are) is fixed per level.
- **The lock:** within `v · 0.6 s` of a wall the lane is fixed. A sliding wall's doors shift one lane
  1.6 s before impact (1.0 s to react before the lock, never under the card's 0.9 s).
- **The judgement** at the wall's plane: the side corridor skips it; Nami's upper door (feet ≥ 2.25 m in
  its lane); a cracked door during Riko's dash (the side corridor); a ghost door during Vexa's phase; the
  true door; else wrong (Kiro's shield absorbs it: no bounce). A wrong door: 1.5 s bounce (knocked 3 m
  back), the flow and the streak reset, then the true door opens and the hero hops into its lane.
- **Finish:** past the finish line (level 5: once Flicker is down, at the gate that rises ahead of you,
  never past the static finish). The clock cap ends the run "timeup", unranked.

### Hero roles (the card)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | dash 0.45 s (6 s) | smashes a cracked fake door (always the wrong colour) into the hidden side corridor: 3 orbs, it skips the next 2 walls (every level; the shard on L1 and L3) |
| Nami | a second jump in the air (Jump or Power, 1.5 s) | the upper door row over the tall walls (L3-L5: a bonus orb lane, the sticker), the high orbs over the floor bars |
| Kiro | shield 3 s (20 s) | absorbs a wrong door, bars, beams, flame vents and Flicker's fire; the vents' bonus orbs |
| Zuno | magnet 4 s, reach 5 m (12 s) | the orb trails hidden in the corridor walls |
| Vexa | phase 2 s (10 s) | the ghost door (always right, a faint shimmer) and the colour shard behind it (every level) |

The gated orbs are **bonus**: the all-orbs star counts the main orbs only, so any hero earns every star.

## Scoring

A **time game**: `score = floor((timeBaseMs - duration_ms) / 10)`. The submitted duration is
`finishMs - 150 · orbs - comboMs` (`finalScore`, `runTimeMs`); only a win is ranked.

### Server limits and why they hold (the proof)

1. **Clock:** `simMs ≤ elapsedMs`, `finishMs ≤ elapsedMs` (whole ms, the fraction carried).
2. **The z guard:** every ms the rules move the hero towards -z by `speedNow / 1000 ≤ vMax / 1000` and
   nothing else moves it forward: lane changes and the side corridor are along x, a bounce moves it back.
   `rules.test.ts` and `orbit.test.ts` check it every ms against random input for every hero on every
   level and under random camera yaws.
3. **Least finish:** the hall's length at vMax, less 4 ms (`progressFloorMs`). Level 5 also needs
   Flicker down: he rises at the first ms the hero passes his start line, and his machine (menu2/boss)
   is time-driven with hits only in its windows, so he cannot be down before `bossMinMs` of his own ms
   after that (`bossFloorMs`). `minFinishMs` = the max of the two. The finish gate after his defeat
   never lies past the static finish line.
4. **Least duration:** less every orb (bonus orbs included) at 150 ms and the flow bound `comboMaxBonus`
   (each orb 30, each static wall's true pass 40, on level 5 the first 40 arena doors 40, x2 cap). The
   arena's walls keep coming while Flicker is up, so only the first `ARENA_LINKS` = 40 feed the meter and
   the arena has no orbs: the bound stays finite.
5. **Limits:** the bound less about 4.5 %, rounded down to 100 ms; `timeBaseMs` = `maxDurationMs` = the
   level's clock cap.

| Level | Length | vMax | Least finish | Orbs (main) | Flow bound | Least duration | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 Two Doors | 384 m | 16 | 23 996 | 42 (23) | 1 505 | 16 191 | 15 400 | 90 000 | 7 460 |
| 2 Three Doors | 452 m | 18 | 25 107 | 52 (29) | 1 885 | 15 422 | 14 700 | 110 000 | 9 530 |
| 3 Fake Door | 538 m | 20 | 26 896 | 70 (35) | 2 505 | 13 891 | 13 200 | 130 000 | 11 680 |
| 4 Fast Gates | 620 m | 22 | 28 178 | 82 (41) | 2 945 | 12 933 | 12 300 | 150 000 | 13 770 |
| 5 Door Sprint Master | 995 m | 24 | 41 454 | 30 (14) | 2 625 | 34 329 | 32 700 | 240 000 | 20 730 |

Level 5's boss floor (35 086 ms) is under its z floor, so the z floor binds. Every level's maxScore is
at least level 1's; level 5 is 2.78x. `meta.ts` and `arcade-games.json` ship this table;
`rules.test.ts` pins it; `registry.sync.test.ts` checks the JSON.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (Riko, no power: reads the next wall's true door once its lamp is in view, takes a main orb only when the true lane is still reachable before the lock, jumps bars, rolls under beams, keeps out of vents; on L5 fires the rush while Flicker is open and dodges his fire) | wins every level at 30 / 60 / 144 Hz with no wrong door: L1 32.4 s (5 757 / 7 460, 77 %, 23/23 main orbs), L2 30.5 s (7 945 / 9 530, 83 %, 29/29), L3 30.0 s (10 001 / 11 680, 86 %, 35/35), L4 29.3-29.5 s (about 12 050 / 13 770, 87 %, 38-39/41), L5 63.6-64.1 s (about 17 600 / 20 730, 85 %, Flicker down, 11-14/14) |
| Every hero, plain and with its power mashed (60 Hz; Riko 30 / 60 / 144) | every run clears; no finish under the floor (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Spam (200 on L1, 40 per level, any hero, random presses, yaws, power mashed, 4-50 ms frames) | no finish under the floor |
| Idle (no input) | still runs (an auto-runner), bounces off wrong doors, finishes slower than the bot |
| Random camera yaws | the z guard holds every ms (`orbit.test.ts`) |

Mutation probes: a level with a 30 % faster run speed falls out of its limits window; no level's row
matches another level's course or timer.

## Levels (the card)

| Level | Speed | Lanes | Walls | Cap | Twist |
|---|---:|---:|---:|---:|---|
| 1 Two Doors | 10 m/s | 2 | 8 | 90 s | three beats: one door open (the ghost / cracked one reads as shut), then two colours with the lamp's colour on the floor arrows, then the lamp alone, a bar and a beam, and speed pads after the last wall |
| 2 Three Doors | 12 m/s | 3 | 10 | 110 s | three lanes and the chimes; halfway the lamp dims (the sound rule): hear the chime; speed pads in one lane |
| 3 Fake Door | 14 m/s | 3 | 12 | 130 s | sliding doors, cracked fake doors (two side corridors), the NOT rule, Nami's upper doors, a dimmed sliding wall |
| 4 Fast Gates | 16 m/s | 5 | 14 | 150 s | the echo rule (a ringed lamp two walls early) on ten walls, 4-5 open doors, NOT, upper doors |
| 5 Door Sprint Master | 18 m/s | 4 | 5 + arena | 240 s | a warm-up with every rule once, then **Flicker** |

### Boss: Flicker, the Fire Spirit (level 5, menu2/boss `FLICKER`)

`m2FireSpirit` drawn x4 (7.6 m, over the door walls). He rises 25 m past the last warm-up wall and races
ahead of you (34 m), tinted the colour of the next wall's rule (his flame is the rule); his arena's walls
spawn ahead as you run, rolled in the phase they spawn in. While he is open he drops back to 17 m and a
gold ring burns under him; the HUD bar pulses. 8 hp, one hit per window, a hit-stop slow-mo on the finish
(visual only).
1. **Door Slam** (3 hits): a fire wave rolls in ahead of you (jump it). Every 4 true doors in a row
   charge the **red rush** (HUD pips); fire it (Power) while he is open to ram him.
2. **False Cues** (2 hits): the lamp flickers between colours; the true colour is held longest (600 ms
   against 200 ms) and it is the one that chimes; a low flame arc (roll under it); the rush again.
3. **Three Flames** (3 hits): he splits into three flames, each behind a coloured door; take the door that
   matches the lamp while he is open; each hit runs you 1 m/s faster; a lane of fire to leave. Slow-mo, the
   remaining doors roll open and the finish gate comes up ahead.

## Stars, flow, secrets, progress

- **Stars:** clear, every main orb, the target time (34 / 33 / 33 / 33 / 70 s, a little slower than the honest bot). **Badge:** no wrong door.
- **Flow:** 4.5 s window (a wall every 2-4.5 s), +0.25, x2 cap; orbs 30, true doors 40.
- **Secrets:** a colour shard behind every level's ghost door (Vexa); Riko's side-corridor shard (L1,
  L3); Nami's sticker in the upper door row (L3, L4, L5).
- **Progress:** `levelEndStats` -> `recordLevelResult` on a win and a time-up.

## Juice

Each true door rolls up like a shutter as you commit to it (after the lock), then bursts into red sparks
with its colour's chime climbing through the streak; a wrong door thuds (camera kick, shake, hit-stop,
grey dust) and flashes grey; every lamp chimes its colour as it comes into view and swings on its chain;
speed lines at 15 m/s and up; orb pops; smash / shield / ghost / upper-row popups; the red rush's burst;
Flicker's hits and his defeat.

## Local multiplayer (menu2/multiplayer, M1)

The card's "split vertical strips" became parallel corridors in one world (each player's hall side by
side, one shared camera framing all heroes; tablets and desktops only, phones stay solo). **Versus:** the
same seed, so every player meets the same doors and rules; first to the end, then the grace; the podium by
time. **Co-op** is the card's party **"Door Roulette"**: each player's true door is the door of their own
hero's colour (`RunOptions.roulette`; co-op heroes are unique), and Kiro's shield, Zuno's magnet and Vexa's
phase cover the whole team. Multiplayer runs are never ranked.

## Models

`public/models/3d/color-door-sprint/` (from OpenCode's leftover commit d3d50b80; sources in
`%USERPROFILE%\.play50\hyper3d\ready\menu2\color-door-sprint\` and `ready\menu2\shared\`): `m2DoorwayV2`
(the coloured doors, one bright steel look tinted per door), `m2SlidingDoor` (the shut doors),
`m2ArchWallV2` (the hall's side walls), `m2ArchCorridorBgV2` (the galleries beyond), `m2ChevronSpeedPad`,
`m2ScoreOrb`, `m2MineLanternPost` (the rule lamp, hung on a chain, and the wall sconces), `m2FireSpirit`
(Flicker, 18k triangles: the character budget). Code (menu2/props and this folder): the pillars and
lintels, the ember trim, the glyphs, the lamp's globe, the floor, the sky, the hazards, `ArchWall` +
`CheckpointPad` (the finish gate).

## Tests and playtest

- `rules.test.ts` (40), `proof.test.ts` (17), `orbit.test.ts` (6), `multiplayer.test.ts` (4),
  `hero.test.ts` (3), `assets.test.ts` (20): 90 green. `registry.sync.test.ts` "every slug in order"
  fails on this branch alone by design: order 62 leaves room for the other branches' games 58-61
  (it passes once they are merged).
- Headless Chrome playtest (2026-10-29) on `next dev -p 3311` (no production build: the machine had
  no RAM for one), `?autoplay=1`, all five levels at 1280 x 800 and 390 x 844, with a mouse drag /
  wheel orbit on desktop and a two-finger orbit on the phone, plus keyboard lane presses (desktop) and
  one-finger swipes (phone) on level 1 without the bot: every run cleared, 0 console errors. Frame:
  18-41 draw calls, 196-300k triangles (Flicker's three flames push level 5 to about 300k), p50
  16.7 ms. Screenshots: the session scratchpad `cds/shots*`.

## Open issues

- No production `next build` ran (RAM); `tsc` is clean, the dev server compiled and served it.
- Seen from straight to the side in a narrow hall the orbit camera is squeezed against the side wall
  (the hero stays in view, close up).
- A wall the hero has run through is hidden at once (the camera behind would otherwise look at its
  stone close up); a later polish could fade it.
- Speed lines are juice dust particles; real streak lines would need a shared VFX.
- `m2RuleLamp` (NICE) was not generated: the lamp is `m2MineLanternPost` hung on a chain with a code
  globe and glyph.
- No thumbnail yet (`public/images/3d/color-door-sprint.webp`, meta `thumbnail: null`).
- Multiplayer (parallel corridors, Door Roulette) is covered by unit tests only; no 2-4 player headless
  run was made.
