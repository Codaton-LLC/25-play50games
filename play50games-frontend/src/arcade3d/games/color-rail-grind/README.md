# Color Rail Grind (Menu 2, game 35)

World 4 "Frost and Sweets" (yellow), lead hero Zuno. Design card:
`docs/menu2-super/world-4-frost-and-sweets.md` "35 Color Rail Grind" (branch `claude/m2-super-plan`).
Status `dev`, order 79, a **time** game.

**Core verb: SWITCH-ROUTING.** The hero grinds the Sugarfrost Workshop's toy train line on its own along
-z. Left / Right hop to an adjacent parallel rail (0.35 s; only where one runs), Up jumps (gaps, grind
rings), Down crouches (+3 m/s downhill). A track switch ahead lights up 1.5 s before it: the Switch
press (E / Enter while one is lit, or a tap on the view) throws it, and the hero (or a toy train)
passing it takes its branch: an orb branch, a shortcut, a dead end with a buffer stop, a hero gate.
Branches curve away from the grid, so only a switch reaches them. Nothing is fatal: a buffer stop
costs 3 s, a missed gap 2 s on the hook.

## Files

| File | What |
|---|---|
| `levels.ts` | the five levels' numbers (speed, clock, star time, main orbs, boss) |
| `network.ts` | each level's hand-written script and the builder: rail pieces per lane (ends: open, gap, buffer, merge), switches and branches (orb, dead end, shortcut, Riko's barrier spur, Vexa's ghost spur, level 2's caboose), Nami's high rails, Zuno's loop, Riko's long gap, Kiro's icicle tunnels, rings, orbs, downhill stretches, level 4's trains |
| `rules.ts` | the pure, deterministic run (1 ms steps), the bound and `PROPOSED_LEVEL_LIMITS` |
| `progression.ts` | the flow combo, the stars, the secrets, the Clockwork Express's `BossConfig` |
| `bot.ts` | the honest bot (tests and `?autoplay=1` on preview builds) |
| `heroes.ts` | the five heroes and their roles here; Zuno preselected |
| `multiplayer.ts` | 2-4 local players on ONE switch board (versus sabotage, co-op routing) |
| `Scene.tsx`, `World.tsx`, `Course.tsx`, `Hero.tsx`, `camera.ts` | the scene, the valley, the line, the hero, the orbit camera and the intro |
| `Hud.tsx`, `StarResult.tsx`, `MultiplayerHud.tsx`, `MultiScene.tsx` | the HUD (switch card, mini-map), the star screen, multiplayer |

## Rules

- **Switches:** the lit switch is the first on the hero's predicted path (the switches as they stand)
  within 1.5 s; a switch thrown less than 0.6 s ago is skipped, so a quick second press throws the switch
  after it (level 2's golden caboose: two switches in a second). A press after that throws it back. One
  Action press throws the lit switch, else fires the hero power; a tap on the view always throws the
  switch. Audio ticks while one is lit (the card's fix for missed switches).
- **Frozen switches (level 3):** a press on the rail clunks; a press in the air stomps it (the hero
  slams down). Frozen rails are 20 % faster and have no crouch.
- **Ends:** a buffer stop bonks the hero for 3 s and puts it back on its grid rail; a merge carries it
  back into its neighbour; a side rail that stops always merges. A gap must be jumped (gaps are about a
  third of the speed long); a missed one drops the hero into the hook, which carries it to the nearest
  rail ahead in at least 2 s and never faster than the level's speed.
- **Hero roles (the card):** Riko's dash in the air clears the 11 m broken rail (a jump covers about
  9.5 m) and breaks a side spur's wooden barrier (else a bump: 1.5 s); Nami's double jump lands on the
  high rails (+3 m/s, bonus orbs); Kiro's shield crosses an icicle tunnel (judged on the way in; else a
  stumble); Zuno's magnet takes him round the loop (+6 m/s and a shard) and pulls the coin trails out of
  the snowbanks; Vexa's phase goes through the ghost door to the hidden spur (else a bump).
- **Toy trains (level 4):** they wait until the hero is 90 m off, then drive the line at 8-9 m/s and
  follow the switches too: thrown into a dead end they crash at its buffer stop; a hero catching one on
  its rail is bumped (1.5 s) unless it jumps it or hops.
- **Relight:** the share of the run spent grinding the rails; 90 %+ takes 1.5 s off. The rail lanterns
  relight gold behind the hero.

## Levels (the card)

| Level | Speed | Twist |
|---|---|---|
| 1 Station Yard | 12 m/s | three beats: hop for the rings; a first switch (orb branch or plain line, both safe); a ring jump over a gap |
| 2 Village Loop | 13 m/s | dead ends with buffer stops; the mini-map of the next two switches; the golden caboose |
| 3 Ice Bridge | 13 m/s x1.2 | frozen rails, frozen switches (jump-stomp), no crouch |
| 4 Night Express | 15 m/s | toy trains on the network |
| 5 Runaway Express | 16 m/s | the Clockwork Express |

## The Clockwork Express (level 5)

`m2ClockworkTrainBoss` x2.85 on its own rail (lane 3), through `menu2/boss`, 9 hp. The arena spawns a
section every 45 m ahead while it is up.
- **Route it** (3 hits): it runs 32 m ahead; its switches light up as it comes; thrown, it takes the
  buffer spur and crashes.
- **Wagon drop** (3 hits): it uncouples a toy wagon back at the hero along its rail (hop or jump);
  grind through the arena's rings to charge.
- **Roof** (3 hits): it runs beside the hero; a launch ramp throws the hero onto its roof; stomp the
  wind-up key (jump and land) between its steam puffs (a puff on a standing hero blows it off).
A crash, a ring or a stomp queues a hit that lands while it is open (one a window). Slow-mo as the key
spins out; the station arch stands 45 m ahead.

## Scoring

A time game: the submitted time is the finish minus 0.15 s per orb (main and bonus), 0.1 s per ring,
1.5 s for a 90 %+ relight and the flow bonus (`runTimeMs`). `finalScore` sends it; the server computes
`(timeBaseMs - time) / 10`.

## Server limits and why they hold

- **The z guard:** every ms moves the hero at most vMax / 1000 m towards -z, vMax = speed x 1.2 (frozen
  rails, level 3 only) + 6 (the boost cap: crouch, high rails, shortcuts, the loop; never stacked past
  it). Hops are along x, a bonk stops the hero, the hook moves it at most the level's speed, and on the
  Express's roof it moves with the Express, whose chase is capped at vMax. Tested every ms with mashed
  powers.
- **Level 5:** the boss machine's least defeat time after the boss start (every open window hit at its
  first ms).
- **Bonus:** every orb and every ring (level 5: plus 20 capped arena rings), the relight bonus, and
  `comboMaxBonus` over every orb, ring and switch.
- **minDurationMs** = the bound less about 4.5 %, rounded down to 100 ms.

| Level | minDurationMs | max / base ms | maxScore |
|---|---:|---:|---:|
| 1 | 22000 | 120000 | 9800 |
| 2 | 25600 | 150000 | 12440 |
| 3 | 17700 | 170000 | 15230 |
| 4 | 26000 | 180000 | 15400 |
| 5 | 24900 | 260000 | 23510 |

Meta, `arcade-games.json` (dev, `enabled: false`) and the pinned test move together.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (reads the lit switch, takes orb branches and shortcuts, never a dead end, a hero gate only with the power ready; diverts a train into a dead end first; stomps frozen switches; hops for orbs and rings; jumps gaps; crouches downhill) | wins every level with every hero at 30 / 60 / 144 Hz, no fall; Zuno takes every main orb on all five levels; submitted about 42 / 51 / 36 / 50 / 62 s (L1-L5), 79-82 % of maxScore |
| Every hero with its power mashed | no finish under the floor (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked win inside the limits, the score from the time |
| Spam (40 per level, any hero, random hops, jumps, switches, power, yaws, 4-50 ms frames) | no finish under the floor |
| Idle (no input) | still finishes level 1, slower than the bot |

Mutation probes: a 30 % faster level falls out of its window; no level's row matches another's course.

## Stars, flow, secrets

- **Stars:** clear; every main orb (25 / 30 / 35 / 40 / 35; bonus orbs sit behind hero gates and dead
  ends); the card's target time (60 / 80 / 95 / 105 / 150 s). The badge: no bonk and no fall.
- **Secrets:** Vexa's hidden spur shard (every level), Zuno's loop shard (every level), level 2's golden
  caboose sticker (two switches in a second; its spur skips the lane-3 branch's orbs, so the caboose and
  all orbs are two runs).

## Multiplayer (1-4)

Parallel copies of the line, one shared camera, ONE switch board: a switch one hero throws is thrown for
every corridor (the card's versus sabotage). Co-op shares the board and the ally powers. Never ranked.

## Models

`public/models/3d/color-rail-grind/`: `m2RailSegmentV2` (the rails), `m2RailSegment`, `m2RailSwitch`
(lever box), `m2RailJunction` (frog), `m2RailJunctionV2` (buffer stop), `m2RailLaunchRamp`,
`m2GrindRing`, `m2SupportPillar`, `m2ElevatedRailBg`, `m2ClockworkTrainBoss` (15k triangles, the
character budget), `m2ToyTrainWagon` (today's), and `m2SnowPine`, `m2SnowCabinBg` copied from
ready/menu2/snow-slide-dash (the card's village; snow-slide-dash is not in the slice yet). `m2Icicle`
is ice-peak-jumper's, by its manifest line. The card's `m2ToyBlocks` barrier does not exist in the ready
folders: Riko's barrier is code-built planks. Code parts: the far rails, the lanterns, the loop, the
icicle frames, the ghost door, the arrows and lit rings, the station arch, the steam.

## Tests and playtest

- `rules.test.ts`, `proof.test.ts`, `orbit.test.ts`, `multiplayer.test.ts`, `hero.test.ts`,
  `assets.test.ts`: 91 green (2026-10-29); `registry.sync`, `modelManifest`, `ShellOverlays` green with
  the game registered (order 79); `tsc` clean.
- Headless Chrome on `next dev -p 3311`, `?autoplay=1`: all five levels at 1280 x 800 (mouse drag /
  wheel orbit) and levels 1, 3 and 5 at 390 x 844 (two-finger orbit): every run reached the result card
  (L5 phone 1:02.54 with the loop shard), 0 console errors, 13-27 draw calls, 157-300k triangles, p50
  16.7 ms when the machine was quiet (33 ms while other agents' builds shared it).

## Open issues

- No production `next build` ran.
- The far rails are plain beams (the GLB rail is drawn within 70 m); at a distance the grid reads thin.
- The card's `m2ToyBlocks` barrier does not exist; Riko's barrier is code-built planks.
- `m2SnowPine` and `m2SnowCabinBg` are copied here from ready/snow-slide-dash (that game is not in the
  slice yet); when it lands, one copy can go.
- No thumbnail yet. Multiplayer is covered by unit tests only.
