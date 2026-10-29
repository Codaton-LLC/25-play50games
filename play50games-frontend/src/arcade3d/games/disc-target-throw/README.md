# Disc Target Throw (Menu 2, game 40, World 3 "Wild Temples")

A jungle-ruin training courtyard and a returning training disc. Hold Throw to aim where the camera
looks, push sideways to hook, let go: the disc flies 18 m, banks off carved stone for double and
triple points, and swings back to the throw spot, where you catch it for the combo. Lead hero Kiro
(World 3); the shared hero picker is on the start card, the pause menu and the result. Order 73,
status `dev`, owner claude. Design card: `docs/menu2-super/world-3-wild-temples.md` "40".

## Files

- `levels.ts` the five level rows (clock cap, par, the level's mechanic flags).
- `course.ts` the courtyard (`YARD` x -11..11, z -16..6), each level's targets, columns, walls
  (stone banks, wood stops, ghost walls), thorns, raft, monkeys and the boss spot; `targetPos`,
  `monkeyPos`, `raftX`.
- `rules.ts` pure deterministic rules (1 ms steps, `MAX_STEP_MS` 50): the throw, the flight
  (`flyMs`), hits, the return Bezier (`backPos`), catches, powers, the boss, the bound
  (`minFinishMs`, `maxScoreOf`, `proposeLimits`, `PROPOSED_LEVEL_LIMITS`).
- `heroes.ts` the five powers; `progression.ts` combo, stars, secrets, Mother Snapper.
- `bot.ts` an honest planner (tries 48 headings x 3 hooks from a spot grid through the rules' own
  `flyMs`, walks there, aims ~170 ms, lets go, stays for the catch, steps out of volleys).
- Scene: `Scene.tsx` (solo + `?autoplay=1` bot), `MultiScene.tsx`, `World.tsx`, `CourseView.tsx`,
  `Disc.tsx` (the shared code-built `TrainingDisc` prop, trail, aim dots, catch ring), `Boss.tsx`,
  `Hero.tsx`, `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts`.
- Tests: `rules.test.ts`, `proof.test.ts`, `assets.test.ts`, `multiplayer.test.ts`, `orbit.test.ts`.

## Rules

- Throw: hold Throw (Space / the Throw button) for at least `HOLD_MS` 150 ms; the hero stands while
  aiming. The heading is the camera's view (`yaw + pi`), the stick's x is the hook (up to 35 deg of
  bend over the flight). A shorter tap does nothing.
- Flight: 15 m/s, 18 m. Stone (walls, columns) banks it: a reflection and 15 % speed loss; a fourth
  contact or wood (the palisade) ends the outbound. Ghost walls stop it unless Vexa's phase is armed.
  Nami's lob flies over the palisade (y 2.3).
- Hits: at most 3 per throw; points are the target's base x the bank multiplier (x1, x2, x3 after
  0, 1, 2+ banks). Hay 100 (rail 150), idol 150, post 100, orb 50.
- Return: from wherever the outbound ends, 1 s on an arc back to the throw spot. On the spot (0.6 m)
  is a clean catch (+50 after a scoring throw, links the combo), 1.6 m a catch, farther a drop and a
  1.5 s fetch (the combo breaks).
- Clear: every required target down. Speed bonus 20 pts per second under par.

## Hero powers

| Hero | Power | Use here |
|---|---|---|
| Riko | Dash (+12 m/s, 350 ms) | reach the catch, catch reach +4 m while dashing |
| Nami | Lob throw | the next throw flies over the palisade |
| Kiro | Shield 3 s | blocks the thorn bursts and the volley |
| Zuno | Magnet 3 s | pulls the disc in from 3 m, always a clean catch |
| Vexa | Phase throw | the next throw passes ghost walls (the shrine shard) |

## Levels

1. Static Targets: 10 hay targets, posts, orbs, a palisade, a thorn zone over the best spot.
2. Moving Targets: targets slide on ruin rails.
3. Color Targets: green / gold / jade idols pay double in colour order; three in order in one throw is
   a Triple Glyph (+300).
4. Fast Combo: the hero throws from a drifting raft on the canal; monkeys snatch a returning disc
   (hit one with the disc first: +200 and stunned 6 s).
5. Accuracy Master: Mother Snapper (9 hp, 3 phases): Mouth (throw into the open mouth), Pods (bank
   into a glowing seed pod), Crown (two banks off the columns into her crown); thorn volleys down a
   red lane between the windows. The win is her defeat (+2000).

## Scoring and server limits (why they hold)

Points game; each level row is `proposeLimits(courseFor(level))`:

- `maxScore` = every target at its top value (x3, x2 more for idols in order) + every Triple Glyph +
  a catch bonus for every throw that can score + every monkey + the boss's hits and defeat +
  `comboMaxBonus` + the speed bonus at the least finish.
- `minDurationMs`: the least finish less ~4.5 %. Without the boss one disc needs at least
  `ceil(required / 3)` throws, each after 150 ms of aim and the 1 s return:
  `HOLD_MS + (throws - 1) * (returnMs + HOLD_MS)`. With the boss: her least defeat time (every
  window hit at its first ms, `bossMinMs`).
- `base` 0, `maxPointsPerSec = ceil(maxScore * 1000 / minDurationMs)`, `maxDurationMs` = the clock
  cap + 1 s.

| Level | maxScore | minDuration | maxDuration | pps |
|---|---|---|---|---|
| 1 | 14616 | 3400 | 151000 | 4299 |
| 2 | 12816 | 3400 | 161000 | 3770 |
| 3 | 27666 | 3400 | 171000 | 8138 |
| 4 | 14341 | 3400 | 181000 | 4218 |
| 5 | 15239 | 25000 | 241000 | 610 |

The lower bound is loose on purpose (it holds whatever the outbound does), so the rate is high; the
score cap does the work. `proof.test.ts`: every hero with its power mashed, 30 spam runs a level at
random frame times, and mutation probes (an extra target or a longer par lifts maxScore over the row).

Honest bot (seed 1, 60 fps, Kiro): L1 16.5 s / 4556, L2 17.2 s / 4917, L3 16.0 s / 10142,
L4 16.4 s / 3658, L5 41.2 s / 10071.

## Models (Hyper3D ready set, measured in `assets.test.ts`)

In `public/models/3d/disc-target-throw/`: m2HayBaleTarget, m2StoneIdolTarget, m2PalisadeWall,
m2ScoreMarkerPost, m2TrainingPavilionBg, plus m2StoneColumn (from wall-run-temple), m2RaftPlatform
(tightrope-path), m2SnapperPlant (jungle-vine-jump; Mother Snapper at 9.5 m) and m2JungleMonkey.
The orb is the shared menu2 scoreOrb, the heroes the shared menu2 hero GLBs, the disc the shared
code-built `TrainingDisc` prop. No turtle / ninja / shell files.

## Camera and controls

The shared Menu 2 orbit camera: mouse drag, Q / C, the wheel; two fingers turn, pinch zooms. Walking
is camera-relative (`inputToWorld`) and the aim is the camera's view, so the orbit starts behind the
hero looking north. Keyboard: WASD / arrows move, hold Space to aim (A / D hook), E / Enter power.
Touch: joystick, Throw (hold), Power.

## Multiplayer (local 2-4)

`multiplayer.ts`: the runs share the targets and the monkeys (the first disc to hit takes it),
co-op shields and magnets cover allies, versus ranks by points.

## Known issues / open

- The lower duration bound is throw-cycle based and loose (pps 3770-8138 on L1-L4).
- Thumbnail `public/images/3d/disc-target-throw.webp` captured from the preview playtest.
