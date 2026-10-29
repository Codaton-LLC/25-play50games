# Jungle Vine Jump (Menu 2, game 8, World 3 Wild Temples): CLIMB THE SWING

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 68. Built to its
approved design card (`docs/menu2-super/world-3-wild-temples.md` "8 Jungle Vine Jump") on the menu2
shared systems, structured like temple-lantern-jump (W3) and zipline-rush (the hang pose).

## Concept and controls

Climb a giant jungle tree by swinging on vines. A vine is a pendulum whose length is the live control:
touch one in the air and the hands grab it; **Up / Down slides the grip** from 1.5 m to 6 m under the
anchor (a short grip swings fast, period about 1.6 s, in a small arc; a long one slow, about 3.2 s, with
more reach); **Left / Right in time with the swing pumps it**, up to 75 degrees; **Jump lets go** along
the swing's tangent. Pulling in at the bottom of the arc speeds the swing up (the angular momentum
L² w is kept through a grip change, like a real swing pump); sliding down at the top reaches further.
Off the vines it is a platformer: walk, jump, land on branches and leaves.

- Keyboard: on a vine Up / Down grip, Left / Right pump, Space lets go; on a branch WASD / arrows move
  (camera-relative), Space jumps; **E / Enter** fires the hero power.
- Touch: joystick (up / down grip, left / right pump) + Jump + Power. Same timings on touch and keyboard.
- Camera (menu2/camera, the shared orbit): drag / two fingers turn, wheel / pinch zoom, Q/C turn, R/F
  tilt, V recentre. Left alone, the orbit eases round to a **side view of the swing** (outside the
  route's ring, looking in at the trunk): its auto-follow is fed the inward direction instead of the
  travel, so a swing always reads left to right. Left / Right maps onto the swing the way it looks on
  screen (`pumpSense`), at any yaw. The camera rolls up to 4 degrees with the swing.
- Hero: the shared picker (start card, pause, result). **Kiro** (W3's lead) is preselected.

## Files

| File | What |
|---|---|
| `meta.ts`, `index.tsx` | plain data (time game, five levels, order 68), the GameDefinition (intro, star screen, runPlayers) |
| `levels.ts`, `course.ts` | per-level beats; the deterministic route generator (a ring of radius 16 m round the trunk: platforms, stairs, vines, nets, orbs, emeralds, snappers, monkeys, the hollow, the canopy, the arena) |
| `rules.ts` | pure rules: fixed 1000/120 ms sub-steps, latched presses, the variable-length pendulum, the catch, the platformer, dry vines, arches, pods, snappers, powers, the King, secrets, limits |
| `bound.ts` | the score proof: the climb floor and the King's least defeat time |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `heroes.ts`, `progression.ts`, `levelEnd.ts`, `StarResult.tsx` | heroes; combo, stars, secrets, the King; progress; the star screen |
| `Scene.tsx`, `CourseView.tsx`, `World.tsx`, `Howler.tsx`, `Hero.tsx`, `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` | the scene, the climb, the tree, the boss, the hero, the orbit, the palette, the models, the HUD |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players |

## Levels

| # | Name | Top | Vines | New |
|---|---|---|---|---|
| 1 | Green Start | 37 m | 13 | the card's three lessons: one vine over a safe leaf; two vines far apart (slide down to reach); a vine-to-vine catch over a net leaf. Target 75 s |
| 2 | Branch Climb | 43 m | 16 | branches bob ±0.6 m (period 3 s) and every second vine's anchor with them |
| 3 | Swinging Vines | 61 m | 26 | dry brown vines snap 2.5 s after the grab (back after 5 s); snapper plants bite on a 2 s beat beside the landing branches |
| 4 | Ruins | 74 m | 32 | arch vines hang from mossy stone arches that lean with your swing (the anchor slides up to 0.8 m); three monkeys throw fruit pods (a pod knocks you off the vine) |
| 5 | Canopy Peak | 49 m + arena | 24 | bobbing branches, dry vines, arches, snappers, two monkeys; the Howler King in the crown |

Every vine swings in the vertical plane that points at the next stop on the route; the route's ring is
wide (16 m) so a plane turns only about 25 degrees from one vine to the next. A dry vine is never the
first after a platform (course.test.ts). Nets catch falls on level 1; a fall elsewhere returns you to
the last platform. Levels 1-2 draw the dotted release arc while hanging (removed from level 3, the card).

### Boss: the Howler King (level 5)
m2JungleMonkey at 3x in ash grey with dark shoulder plates. The arena is a wide branch in the crown with
the fight vine over its near edge and the King's own vine past its far edge. Only a hit at 7 m/s or more
counts (one a window).
- P1 "Swing into his perch" (2 hits): he throws 3-pod volleys at you; his perch is on the fight vine's
  arc at 45 degrees, so a full swing at a 4 m grip passes through it at 9 m/s.
- P2 "Release straight into him" (2 hits): his roar drops the fight vine for 2 s; then he hangs over the
  arena: release from a big swing into him.
- P3 "Meet him at the bottom, faster" (2 hits): he swings on his vine opposite you (55 degrees, 70 in his
  attack, when touching him knocks you off); meet him faster than he is (a short grip swings faster),
  slow-mo finish.

### Hero roles (all bonus, never required)
Riko dashes in the air after a release (+9 m/s impulse along the flight); Nami double jumps to the high
canopy leaf (its emeralds); Kiro's shield (3 s) blocks pods, bites and the King's swing; Zuno's magnet
(3 s, 6 m) pulls emeralds and orbs; Vexa phases through the ghost-root wall into the trunk hollow (the
shard). Emerald trails sit beside two swings, in the hollow and on the canopy leaf.

## Scoring

A time game. The submitted time = finish ms - 100 ms per orb - the combo bonus (catches 15 ms each
vine's first, orbs 20 ms, emeralds 10 ms, King hits 40 ms, x2 cap; a vine-to-vine catch within 1.2 s of
the release chains). Score = `floor((timeBaseMs - time) / 10)`. A loss, the time cap or quitting is
unranked.

| Level | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---|---|---|
| 1 | 900 | 200000 | 19910 |
| 2 | 1200 | 240000 | 23880 |
| 3 | 2000 | 280000 | 27800 |
| 4 | 2500 | 320000 | 31750 |
| 5 | 21400 | 400000 | 37860 |

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)
No hero ever rises faster than `V_RISE_MAX` = the full 75 degree swing at the 6 m grip at its fastest
(`sqrt(2 g 6 (1 - cos 75°))` = 14.3 m/s, kept by the energy cap at every grip) + the grip pulled in
(3 m/s) + a bobbing anchor (1.26 m/s) = 18.6 m/s; a jump (9.4), Nami's second jump, Riko's dash
(vy ≤ 2) and a knock (3) are slower. A respawn only returns to a platform already stood on. So a climb
to a goal H m up takes at least H / V_RISE_MAX. Level 5 adds the King's least defeat time
(`bossMinMs`: a perfect hitter in the first ms of every vulnerable window, 21.5 s). The row is that floor
less the largest bonus (5 orbs + the combo at x2 on every counted event), less 6 %, rounded to 100 ms.
Tests: the pinned rows equal `proposeLimits`; random players of every hero never rise above the
`V_RISE_MAX` line; the bot wins every level at 30, 60 and 144 fps with all 5 orbs inside the limits;
idle times out unranked; a ragged-frame bot run through the real store submits a ranked score inside the
limits. Every level is worth at least level 1's points; level 5 under 3x.

## Secrets, stars, progress
Per level three secrets (`progression.ts` SECRETS): "Monkey Bars" (ten vine-to-vine catches without
touching a platform), Vexa's shard in the trunk hollow, and the hidden emerald vine (it glows only when
you hang at the full 6 m grip). Three stars: clear, all orbs, target time (`starSpecFor`); the no-fall
badge. Recorded through the shared progress adapter (`levelEnd.ts`).

## Local multiplayer (menu2/multiplayer, M1)
2-4 heroes climb the same tree; snapped vines, orbs and emeralds are shared. Co-op: two heroes on one
vine add their pumps (x1.5 each extra rider), shield / magnet / phase cover the team, the team clears
when all are through. Versus: a rival on your vine makes it heavy (x0.75 pumps); first to the top wins,
the others get the grace. A hero 10 m under the highest is sent back. Multiplayer runs are never ranked.

## Open issues
- Model look and placement are judged from headless screenshots only; a real-phone pass is pending.
- The King is the shared monkey at 3x with an ash tint and code-built shoulder plates (no dedicated mesh).
- The card's co-op "tandem launch" canopy (one pumps, the other rides) is not built: co-op pumps add up.
- Kiro's thorn-burst and spore-cloud short routes from the card are not built: his shield covers pods,
  bites and the King instead.
