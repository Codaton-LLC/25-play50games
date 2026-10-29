# Tightrope Path (Menu 2, game 47, World 3 "Wild Temples")

Cross a misty jungle gorge on planks, narrow beams and sagging ropes, a long balance pole in your
hands. Every step tips the lean needle; push the stick against it. Lead hero Kiro (World 3); the
shared hero picker is on the start card, the pause menu and the result. Order 74, status `dev`,
owner claude, a **time** game. Design card: `docs/menu2-super/world-3-wild-temples.md` "47".

## Files

- `levels.ts` the five level rows (clock cap, target time, the level's twist flags).
- `course.ts` the walk: a chain of links (pillar tops, plank bridges, beams, ropes with a 0.4 m sag,
  rotating beams, Riko's cracked dash ropes, Vexa's ghost planks), joined end to start or across a
  jump gap; gusts, sandbags, orbs (main and high), Zuno's coins, the shard, the bird rope, the joust.
  `linkPoint`, `mainRoute`.
- `rules.ts` pure deterministic rules (1 ms steps, `MAX_STEP_MS` 50): walking, the needle, wobble and
  fall, jumps, elements, powers, secrets, Umbra, the bound (`minReachMs`, `minFinishMs`,
  `maxBonusMs`, `proposeLimits`, `PROPOSED_LEVEL_LIMITS`).
- `heroes.ts`, `progression.ts` (combo, stars, secrets, Umbra), `bot.ts` (an honest player).
- Scene: `Scene.tsx`, `MultiScene.tsx`, `World.tsx` (sky, river, rafts, cliffs, mist), `PathView.tsx`,
  `Boss.tsx`, `Hero.tsx` (lean and pole), `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` (the lean
  meter), `StarResult.tsx`, `levelEnd.ts`.
- Tests: `rules.test.ts`, `proof.test.ts`, `assets.test.ts`, `multiplayer.test.ts`, `orbit.test.ts`.

## Rules

- The stick is camera-relative: its part along the link walks (1.6 m/s; held forward 0.6 s it
  sprints at 3 m/s), its part across pushes the needle (1.5 per s at full stick). Pillar tops are
  safe (3 m/s, the needle settles) and are checkpoints.
- The needle drifts: `rate * (0.9 * lean + 0.45 * wander) + forces`, with the rate per element (plank
  0.22, beam 0.5, rope 0.7, spin 0.55, dash 0.7, ghost 0.18) times 0.35 standing, 3 sprinting, 0.5
  crouched (Action held: no walking). Past 100 % the hero wobbles (no walking); still past it 0.5 s
  later he falls and comes back on the last pillar 1.1 s later.
- Jump (Space): a hop of at least 2.4 m/s, 0.63 s in the air; the walk stops at a gap's edge, so a jump
  from there clears it. A landing kicks the needle by a fixed +-30 % (seeded per level and link).
  Landing in a gap is a fall.
- Gusts: 1 s of telegraph (leaves and mist streaks), then 1.5 s of push at 0.4 per s (60 %).
  Sandbags cross the walk twice per 2.5 s: standing in reach, a 70 % kick and a 0.35 s stagger;
  crouched, they pass over. Rotating beams push 0.35 per s their way; L3 ropes sway.

## Hero powers (Action's press; holding it crouches)

| Hero | Power |
|---|---|
| Riko | on a cracked dash rope's first 1.2 m: dash across it in 0.4 s, the needle frozen |
| Nami | a second jump in the air: the high orbs over the gaps |
| Kiro | shield 3 s: no drift, no kicks (and covers the team in co-op) |
| Zuno | magnet 3 s: pulls the coin arcs out of the mist within 4 m |
| Vexa | phase 6 s: leaving a ghost pillar she takes the ghost bridge to the shard |

## Levels

1. Wide Beams: plank, beam, rope with a gentle gust, a jump between beams, plank (6 elements).
2. Narrow Beams: gusts; the first dash rope.
3. Moving Beams: sandbags and swaying ropes.
4. Rotating Path: rotating beams, night fog (8 m of sight), lookout-tower torches.
5. Balance Master: Umbra's joust (6 hp): P1 on a rope, crouch to ride his stomps, jump to stomp back
   while he wobbles; P2 on a beam, his cut strands make the needle drift 1.6x, shove (Action) within
   1.8 m while his needle tips; P3 on a rotating beam, crouch his plates, stay upright 10 s, then shove.
   The win is his defeat (a slow-mo glide off into the mist).

Secrets: Steady Hands (never past 50 %), the ghost bridge shard (Vexa), the bird (crouch still 5 s
on the tower's rope). Stars: clear, all main orbs, the target time; the "never wobbled" badge.
Combo: clean elements (no wobble), each element once.

## Scoring and server limits (why they hold)

A time game: the submitted time is the finish less 0.2 s a main orb, 0.3 s a high orb, 0.1 s a coin
and the flow bonus. Each level row is `proposeLimits(courseFor(level))`:

- the least finish: the shortest route on the link graph (the main walk or a ghost bridge) at
  `V_MAX` 3 m/s (nothing moves the hero forward faster: walk, sprint, pillar, a hop's forward speed),
  Riko's dash ropes counted at 0.4 s; level 5 adds Umbra's least defeat time (`bossMinMs`, every
  window hit at its first ms) to reaching the joust;
- less the most bonus (`maxBonusMs`: every orb, high orb and coin, and `comboMaxBonus`);
- less 6 %, rounded down to 100 ms: `minDurationMs`; `maxScore = floor((timeBase - min) / 10)`.

`proof.test.ts`: every hero with its power mashed, spam at random frame times, mutation probes.

## Models

`public/models/3d/tightrope-path/`: m2BalanceBeam, m2BalancePole, m2LookoutTower, m2RaftPlatform,
m2RockPillarBg, m2SwingSandbag. Shared from `menu2/`: plankBridge, checkpointBeacon,
m2ShadowArmadillo (Umbra) and scoreOrb. No turtle / ninja / shell files.

## Bots (seed 1, 60 fps; finish / submitted time)

L1 22.6-24.4 s, L2 32.2-38.0 s, L3 44.3-50.3 s, L4 42.0-47.8 s, L5 45.4-47.3 s (Umbra down) for the
five heroes, 0 falls; every hero clears every level at 30 / 60 / 144 fps (`rules.test.ts`,
`proof.test.ts`). Limits rows (min / max duration ms, maxScore): L1 13900 / 150000 / 13610,
L2 15900 / 200000 / 18410, L3 19400 / 240000 / 22060, L4 20100 / 280000 / 25990,
L5 20400 / 360000 / 33960.

## Playtest (headless Chrome over CDP, next dev :3323, `?autoplay=1`, unlock-all)

All five levels at 1280 x 800 and 390 x 844 with a two-finger orbit on the phone; 0 console errors.
Fixed from it: the hero faced the camera (the heading was applied twice); the lean meter sat on the
phone's Crouch button (now above the buttons, the button reads "Duck"); towers moved out of the
camera's way; level 4's night got a warm lamp over the hero and a little less fog. The headless
renderer is slow (the bot is ~6 s into a level after 70 s), so Umbra's joust was checked in the
rules tests, not on screen.

## Known issues / open

- The card's hidden canopy shortcut behind the bird is not built: the bird gives the sticker only.
- The rafts on the river are scenery (the card's "rest spots" sit 14 m below the walk).
- Multiplayer: co-op shares the rope's sway; versus races on the same path (not split screens).
