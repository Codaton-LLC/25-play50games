# Sky Hook Swing (Menu 2, game 45, World 2 Sky & Sea): SWING

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 63. Built by Cursor
(`cursor/m2-sky-hook-swing`), gated and finished by Claude on 2026-10-28 against the approved card
(`docs/menu2-super/world-2-sky-and-sea.md` "45 Sky Hook Swing" on `claude/m2-super-plan`, framework
`00-framework.md`) on the menu2 shared systems.

## Concept and controls

Throw a hook at any grapple ring in range over the airship docks, reel the rope to change the swing,
and let go at the peak to fly to the next one. The rope is an analytic pendulum (gravity 30, rope
3-12 m, fixed 16 ms substeps, a speed cap), not a physics engine (the card's risk fix).

- Keyboard: WASD / arrows walk and aim; on the rope up reels in, down reels out, left / right turn the
  swing plane. Space jumps. E or Enter throws the hook, and releases it.
- Touch: joystick, Jump and **Hook** (the shared Action button). The ring Hook will take glows white
  (the card's auto-target fix for phones: a 35° cone round the stick, biased up, up to 14 m); the same
  windows on touch and keyboard (decision 7).
- Peak release: while the rope flashes green (climbing, past the bottom, faster than 5.2 m/s) a release
  leaves 25 % faster: a green burst, a 50 ms hit-stop and a FOV kick.
- Camera (menu2/camera, the shared free orbit): drag (either mouse button, two fingers, or one finger on
  empty canvas), wheel / pinch zooms, Q / C turn, R / F tilt, V recenters. It starts behind and to the
  left of the hero (a three-quarter view, `camera.ts SWING_ORBIT`), so a swing reads as an arc with depth;
  it pulls back on a big, fast arc. Movement and aim are camera-relative (`StepInput.yaw`).
- Hero choice: the shared picker on the start card, the pause menu and the result; Nami (W2's lead) is
  preselected.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: time game, five levels, collection `rollheroes`, order 63 |
| `index.tsx` | GameDefinition: intro, `clockChip: false`, `finalScore`, star result, `runPlayers`, a sky per level |
| `levels.ts` | names, clock caps, star targets |
| `course.ts` | the docks as composed beats (`Build`: gap, wall, chain of three, blade, ship) and the hero pockets |
| `rules.ts` | pure rules: pendulum, hook, reel, release, air, decks, blocks, hazards, pickups, boss, the reach bound, `PROPOSED_LEVEL_LIMITS`, `peekAim` |
| `heroes.ts`, `progression.ts` | powers and cooldowns; combo, stars, secrets, `GUST_GALLEON` (menu2/boss) |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `look.ts`, `textures.ts`, `Billboards.tsx` | palette and a sky / light per level; canvas textures; one-draw-call billboards |
| `World.tsx` | the sky dome and sun, the cloud sea, cloud banks, far islands and windmills, drifting airships, L4 wind streaks, L5 storm flashes |
| `Docks.tsx` | deck slabs, landing pad, beacons, the net, rings under balloons, windmill rotors, the drone, the rope and claw, the aim glow, orbs, secrets, crates, ghost hulls, spark and smoke lines |
| `Galleon.tsx` | level 5's Gust Galleon: hull, balloons, yardarms, turrets, cannonball, mast and sail, falling planks, the Tide Bell |
| `Hero.tsx` | the picked hero on menu2/heroAnim, the swing pose (hands up the rope, body along it, legs trailing) |
| `Scene.tsx`, `camera.ts` | simulation, juice, orbit camera, FOV kick and pull-back, intro |
| `Hud.tsx`, `MultiScene.tsx`, `MultiplayerHud.tsx`, `multiplayer.ts` | HUD; local 2-4 players |

## Levels (one dock course, five configurations)

Every level is a chain of beats at the spacing the swing was tuned on (a rest deck, a ring 9 m on and
9.5 m up, the next deck 23-28 m on), so the rhythm stays and only the twist changes.

1. **Single Swing** (gold morning): one ring over a safety net, a wall you reel in to clear, three rings
   in a row, then all three beats again to the landing pad.
2. **Double Swing** (high noon): chains of three rings with no deck between, only peak releases connect;
   swing islands are the rest stops.
3. **Moving Anchors** (hazy afternoon): rings hung under swaying airships and on turning windmill rotors.
4. **Long Gaps** (windy dusk, wind streaks): a crosswind, 26-28 m gaps, cracked rings that break 3 s after
   the hook (they stay broken until the next checkpoint or respawn).
5. **Sky Swing Master** (the storm ring, lightning): an approach, then **the Gust Galleon**:
   - Phase 1 Cannons: three turrets on storm rocks fire telegraphed shots (violet glow, then a cannonball);
     fly into a turret while it glows green (its window) to knock it off: 3 hits.
   - Phase 2 Drones: the drones cut the hull rings (the respawn moves up to the mast); hook the drone
     itself (a moving anchor) and swing into the mast: the sail tears.
   - Phase 3 Escape: the hull sinks and lists, its planks carry the falling rings (they sink 4 m and hang,
     never out of reach); swing up them and ring the Tide Bell on the pad (slow-mo).

### Hero roles (every level has all five pockets)

| Hero | Power | Pocket |
|---|---|---|
| Riko | dash out of a release, 6 m straight | a cracked crate stack on a side deck with orbs packed inside: only the dash breaks in |
| Nami | a second jump in the air | a high ledge beside a rest deck (over one jump, under two) with an orb loop |
| Kiro | shield 2.5 s | a spark line on an airship cable (level 5: cannon smoke) with orbs strung on it |
| Zuno | magnet 6 m | an orb string in the clouds under a swing's lowest point, out of reach of any hand |
| Vexa | phase 1.6 s | a ghost hull round a hidden inner deck (orbs and the sticker); she walks back out |

The pocket orbs are bonus orbs: the all-orbs star counts the main orbs only, so any hero earns every star.
`powers.test.ts` checks each pocket on each level through the rules.

Stars: clear, every main orb, a submitted time at or under 45 / 70 / 90 / 100 / 150 s. The no-hit badge
is the card's **sky chain**: no fall and no landing off a checkpoint.

Secrets (do not score): the compass shard by a ring beyond the normal hook range (L1, L2, L4, L5), the
inner-deck sticker in Vexa's hull (L1, L2, L3, L5), L3's loop shard past the last airship's sway, L4's
cable shard inside a spark line (Kiro), L5's loop shard behind the drone's circle.

## Scoring and the proof

Time game: `score = floor((timeBaseMs - duration) / 10)`, ranked only on a win. Submitted duration =
finish ms - 80 ms per orb - the flow meter's bonus (`runTimeMs`, `finalScore`).

1. **Clock:** the rules count whole ms (the fraction carried); `simMs <= elapsedMs`.
2. **The reach bound:** after every substep, and on a respawn, `clampReach` holds the hero's x at or
   under `startX + 22 m/s x t` (`V_X_CAP`, `reachX`). It is an average pace from the start, not a top
   speed: the fastest bot (Riko dashing out of every release) peaks at 16.8 m/s, and `proof.test.ts`
   pins every honest bot under 80 % of it, so the clamp never touches honest play. A spam test with random
   camera yaws and frame times checks the bound every step on every level.
3. **Least finish:** the pad's near edge minus the start's x (`span`) at 22 m/s. Level 5 also needs the
   Gust Galleon down: its machine (menu2/boss) is time-driven and takes hits only in its windows, so the
   least time to land all 5 hits at the first ms of each window is `bossMinMs` = 10 700 ms.
4. **Least duration:** less every orb (bonus orbs included) at 80 ms and the flow bound `comboMaxBonus`
   (each anchor 36 ms and each orb 24 ms once, x2 cap).
5. **Limits:** the bound x 0.95 rounded down to 100 ms; `timeBaseMs` = `maxDurationMs` = the clock cap.

| Level | Span (m) | Travel floor | Boss floor | Orbs (main) | Orb bonus | Flow bound | Least duration | minDurationMs | maxDurationMs | maxScore | Bot finish (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 150.6 | 6 846 | - | 31 (15) | 2 480 | 1 092 | 3 273 | 3 100 | 100 000 | 9 690 | 18 400-18 800 |
| 2 | 274.5 | 12 478 | - | 43 (27) | 3 440 | 1 776 | 7 261 | 6 800 | 140 000 | 13 320 | 29 300-33 200 |
| 3 | 170.6 | 7 755 | - | 31 (15) | 2 480 | 1 020 | 4 254 | 4 000 | 180 000 | 17 600 | 19 800-32 800 |
| 4 | 268.0 | 12 182 | - | 40 (21) | 3 200 | 1 380 | 7 601 | 7 200 | 200 000 | 19 280 | 36 000-65 400 |
| 5 | 159.0 | 7 228 | 10 700 | 29 (13) | 2 320 | 1 044 | 7 336 | 6 900 | 240 000 | 23 310 | 23 500-85 200 |

`meta.ts` and `arcade-games.json` carry `PROPOSED_LEVEL_LIMITS`; `registry.sync.test.ts` keeps them equal.
`proof.test.ts`: every hero wins every level with the plain bot and a mashed power; the honest bot through
the real store (`createArcadeStore`, `advanceRunClock`, ragged frames) is a ranked win on every level and
its normalized run is inside that level's row; 40 spam runs per level never beat the floor.

## Known issues

- The galleon hull, mast, sail, bell, rings, windmill rotors and net are code (deliberate, 2-3 tones);
  `m2GrappleHook` (NICE) is not generated, the claw is code.
- The drone GLB is 520 KB, so it uses the character byte budget.
- The bound is loose (a pace bound, not the route): the least duration is 15-30 % of an honest bot run.
