# Ultimate Color Trial (Menu 2, game 50, World 6 Prism Fortress)

Status: **dev** (`enabled: false` in `arcade-games.json`, registry order 100). Design card:
`docs/menu2-super/world-6-prism-fortress.md` "50 Ultimate Color Trial", the mixed-mechanic finale. No lead
hero: the picker opens on Riko (`DEFAULT_HERO`), the player's last pick is remembered.

## The game

**Signature: one corridor, every mechanic, in sections.** A 12 m wide neon corridor through the Prism
Fortress, cut into sections, each one trial from the 49 games before it:

- **Jump pads** over the void: round pads zigzag down the corridor one flat jump apart; some are raised
  (1.2 m), some slide sideways (2 m, 6 s).
- **Trial rings**: upright hoops to pass *in order* (the lit one is next; a wrong one does nothing). High
  rings (3 m) want a jump.
- **Colour doors**: a line of colour switches, then a row of three doors. Step on a switch to charge with
  its colour; only that colour's door lets you through. Two or three rows in a row in the later levels.
- **Laser runway**: beams sweep down the runway toward you at 3-4 m/s; jump them (a beam under 0.9 m
  passes under a hero in the air). A hit stuns and costs the no-hit badge.
- **Survival round**: step into the arena and rolling orbs circle its middle; the exit gate opens
  `surviveMs` after you stepped in. A knock stuns, never kills.
- **Energy core**: a capsule on one side, its receptor pedestal at the far end, orbs between. Touch it to
  carry it; a knock drops it where you stand; set it on the pedestal to open the exit.

Sections with a goal (rings, round, core) have an exit gate at their end that opens when the goal is done.
A fall into the void puts you back at the section's start line (a jump section: on the floor before it).
The run clock never pauses. Level 5 ends in the Chroma Sentinel's arena.

Controls: WASD / arrows (camera-relative), Space jumps, E / Enter is the hero power. On touch: joystick,
Jump, Power. Camera: the shared free orbit (`menu2/camera`): drag or two fingers, wheel or pinch, Q / C,
R / F, V recenters.

## Levels (`levels.ts`)

| | Name | Sections | Twist |
|---|---|---|---|
| 1 | Jump Trial | pads, 4 rings (a guard orb circling a side gem), 1 door row (3 colours) | The three basics, one each, with coach lines. |
| 2 | Runner Trial | sliding pads, laser runway (2 beams, 3 m/s), 5 rings (one high), 2 door rows (4 colours) | The first sliding pads, beams and a high ring. |
| 3 | Color Trial | 2 door rows (5 colours), 6 rings (2 high), raised pads, energy core (2 orbs), survival round (3 orbs, 8 s) | Five colours, the core and the round. |
| 4 | Mixed Trial | fast runway (3 beams, 4 m/s), tight sliding pads (r 1.55), 3 door rows, 7 rings (3 high), round (4 orbs, 10 s), core (3 orbs) | Everything, harder. |
| 5 | Grand Hero Trial | pads, runway, 6 rings, 2 door rows, round (12 s), core, then the Sentinel's arena | The finale: every section, then the boss. |

Every level also has a crystal wall nook (Riko), a void gate nook (Vexa), a sky ledge 4.4 m up (Nyla),
hidden gems off the trail (Zuno) and orbs to shrug off (Kiro).

## Hero roles (every level has all five)

- **Riko**: the dash (+6 m/s for 0.4 s, 3 charges a run) shatters the crystal wall in front of a side nook
  (its shard is inside) and catches a sliding pad.
- **Nyla**: the second jump reaches the sky ledge (a flat jump peaks at 3.27 m, the ledge is 4.4 m) and
  its shard, and makes the high rings easy.
- **Kiro**: the shield (3 s): beams and orbs do not knock him, so he keeps the core and the no-hit badge
  and walks through level 1's guard orb to its gem.
- **Zuno**: the magnet (4 s) pulls the gems in from 6 m and the energy core from 5 m (one core per
  activation).
- **Vexa**: the phase (1.8 s) takes her through the void gate of the other nook to its sticker.

## Boss: the Chroma Sentinel (L5, `progression.ts` SENTINEL, 6 HP)

`m2ChromaSentinelBoss` hovering over the far end of the arena, woken when you reach his beacon
(`m2BossBeacon`, 2.5 m) with every section done. His hits come from the level's own mechanics, never from
a plain touch. Each attack: telegraph 1.8 s (the beacon shows what he asks), sweep 1.2 s (the arena floor
lit; his orbs roll), then the window:

1. **Gates** (2 hits, 10 s windows): his beacon shows a colour: take it from its switch (three at the
   arena's start) and come through that colour's door in his row to touch him.
2. **Rings** (2 hits, 12 s): his three arena rings light up: pass them in order.
3. **Siege** (2 hits, 12 s): an energy core drops in the arena: carry it to his receptor.

One hit per window (`oneHitPerWindow`), 1.5 s transitions, 2.6 s defeat with the visual slow-mo. The
finish is under him: the run ends on his defeat.

## Score limits (time game)

A time game: the submitted duration is the finish ms minus 150 ms per gem and the flow bonus
(`runTimeMs`). The server's `min_duration_ms` is 95 % of a proven lower bound (`proposeLimits`,
`PROPOSED_LEVEL_LIMITS`, pinned in `rules.test.ts` and `arcade-games.json`); `time_base_ms` is the level's
timer, `max_score = (time_base - min_duration) / 10`.

**The bound** (`minFinishMs`): per ms the rules clamp horizontal travel to `V_RUN` 6.5 m/s plus an active
dash (`rules.test.ts` "invariant": checked over random inputs on every level, never more than
(6.5 + 6) / 1000 m per ms). The dash budget is 3 charges x 0.4 s x 6 m/s = 7.2 m (`boostBudgetMetres`);
sliding pads move slower than V_RUN and add nothing; a knockback moves the hero *back*. So the least time
to cover the corridor is `(travel - 7.2) / 6.5`, where `travel` (`travelMetres`) is the straight line from
the start to the finish's reach (level 5: to the beacon's wake radius) less the inside of every survival
arena, which is crossed during its wait. On top of that come the fixed, serial waits: every survival round
(`surviveMs` from the moment you step in; the exit stays shut until then) and on level 5 the Sentinel
(`bossMinMs` 23.5 s: intro 2.5 s + 6 windows each after 1.8 + 1.2 s + two 1.5 s transitions, every hit on
the first ms of its window). The least duration subtracts every gem (150 ms each) and the most flow bonus
(`comboMaxBonus` of the level's sources).

| Level | Travel (m) | Travel ms | Waits ms | Boss ms | Least finish ms | Gems x 150 + flow | Bound | min_duration | time_base | max_score |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 76.4 | 10646 | 0 | 0 | 10646 | 19 x 150 + 743 = 3593 | 7053 | 6700 | 100000 | 9330 |
| 2 | 125.4 | 18185 | 0 | 0 | 18185 | 23 x 150 + 963 = 4413 | 13772 | 13000 | 120000 | 10700 |
| 3 | 134.9 | 19646 | 8000 | 0 | 27646 | 27 x 150 + 1193 = 5243 | 22403 | 21200 | 150000 | 12880 |
| 4 | 198.6 | 29446 | 10000 | 0 | 39446 | 35 x 150 + 1513 = 6763 | 32683 | 31000 | 180000 | 14900 |
| 5 | 165.3 | 24323 | 12000 | 23500 | 59823 | 31 x 150 + 1653 = 6303 | 53520 | 50800 | 240000 | 18920 |

The table is `proposeLimits` on each course; `rules.test.ts` asserts every pinned row is within [95 % −
100 ms, 100 %] of its bound and equal to `arcade-games.json` through `meta.ts` (`registry.sync.test.ts`).
Mutation probes (`proof.test.ts`): a finish 20 % nearer, a 1 s round or a beacon 20 m nearer all drop the
bound out of the accepted window.

## What the bots reached

Honest bot (`bot.ts`: hops pads at the edge, lines up and jumps rings, takes the row's own switches, waits
out beams, holds the arena's corner, carries the core, plays the Sentinel's three phases), `botRun`:

| Level | 30 fps | 60 fps | 144 fps | Submitted (60 fps) | Gems | Knocks | Falls | min_duration |
|---|---|---|---|---|---|---|---|---|
| 1 | win 16.3 s | win 16.3 s | win 16.3 s | 14.4 s | 9/19 | 0 | 0 | 6.7 s |
| 2 | win 24.8 s | win 24.7 s | win 24.7 s | 22.3 s | 12/23 | 0 | 0 | 13.0 s |
| 3 | win 39.9 s | win 41.2 s | win 39.3 s | 38.6 s | 13/27 | 1-4 | 0 | 21.2 s |
| 4 | win 53.1 s | win 53.0 s | win 53.0 s | 49.2 s | 19/35 | 2 | 0 | 31.0 s |
| 5 | win 100.9 s | win 100.8 s | win 100.5 s | 98.2 s (six Sentinel hits) | 13/31 | 4-5 | 0 | 50.8 s |

All five heroes post the same times at 60 fps (the bot takes the one route; the powers are mashed in
`proof.test.ts`). The bot's finishes are 2-3x the floor: the floor is the straight-line sprint with
every wait, which no player reaches.

Every hero wins every level at 30, 60 and 144 fps with no fall (`rules.test.ts`, `proof.test.ts`), every
finish inside the limits. Power mashed, no hero ever beats the floor. Idle runs end `timeup` (unranked).
200 spam runs on level 1 and 30 on every level (random stick, jump and power, 4-50 ms frames, any hero)
never beat the floor.

## Playtest

Headless Chrome over CDP against `next dev -p 3330` (preview env, `?autoplay=1` = the honest bot), one
session per size through "Next level": **1280 x 800** and **390 x 844 (touch, DPR 2)**. Both won all five
levels (desktop 14.5 / 22.3 / 38.3 / 49.1 / 97.9 s, phone 14.5 / 22.3 / 38.3 / 49.1 / 98.1 s), the Sentinel's
three phases named in the HUD, **0 console errors or warnings** on both. The first desktop pass found a
per-frame throw (the start strip's colour band index was negative, `PAL[-1]`), which blanked the canvas:
fixed, both passes re-run clean. The orbit drag and wheel (two-finger turn on the phone) were exercised on
every level.

## Stars, secrets, juice

Three stars (`menu2/stars`): the win, every main gem, the level's target time (`starTargetMs`). Three
secrets per level (`SECRETS`): the void-gate sticker (Vexa), the crystal-wall shard (Riko), the sky shard
(Nyla). The flow meter (`COMBO`: 2.5 s window, +0.25 per link, cap x2) links rings, doors, sections, gems,
cores and boss hits. Juice (`Scene.tsx`): a chime per ring, the switch's colour burst, a door's whoosh, the
exit gate lifting, laser and orb knocks, the round's start, the core picked up and delivered, the
Sentinel's wake, sweeps, hits and his slow-mo tumble.

## Multiplayer (1-4, `multiplayer.ts`)

Co-op shares one corridor: sections done, rings, rows, rounds, cores and the broken wall are the team's
(one typed array for all seats). Versus gives each player their own; the gems are shared. Progress for the
chips is `section x 100 + %`. Unranked.

## Models (`assets.ts`)

From `p50-assets/hyper3d-new` (raw, optimised here) and `hyper3d-recovered`: m2ChromaSentinelBoss (the
boss, 4.6 m), m2BossBeacon (3.2 m), m2ColorSwitch (1.7 m across), m2TrialRing (placed per ring radius),
m2SpawnPad (the pads and checkpoints, per radius), m2RunwayPlatform (per slab), m2LaserEmitter (1.6 m),
m2CoreCapsule (1.1 m), m2OrbBlob (2.3 m = ORB_R x 2), m2FloatCrystalPedestal (2.4 m, the receptor).
Reused by url from color-city-sprint: m2ColorGateV2 (doors and exit gates, tinted) and m2EnergyGem.
`GLB_SIZE` is measured on the decoded meshes (`assets.test.ts`). No credits were spent; m2StoneMinion and
every ninja / turtle / shell asset are unused (tested).

## Open issues

- The Sentinel's sweep is drawn as the lit arena floor plus his rolling orbs; a dedicated sweep beam
  mesh would read better.
- The bot (and so the proof's "what the bots reached") does not collect the side gems or the secrets.
- Level 5's long run (about 100 s for the bot) has no mid-run checkpoint on the Sentinel: a fall in the
  arena respawns at the arena's start line, which is right.
