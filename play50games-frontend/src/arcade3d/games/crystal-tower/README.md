# Crystal Tower (Menu 2, game 28, World 5 Neon Cosmos)

Status: **dev** (`enabled: false` in `arcade-games.json`, registry order 87). Design card:
`docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 28 — Crystal Tower" (memory +
vertical climb; World 5 "Neon Cosmos": neon, space, portals, crystals and mind games, `menu2/worldMap`).
Lead hero Vexa (`DEFAULT_HERO`).

## The game

**Signature: remember the colours, then climb and touch them in order.** A dark crystal spire over the
void of the cosmos, round pads spiralling up round it. Each tier has a sequence beacon on one pad and
one crystal per colour in play floating at the outer or inner edge of the pads above it. Stand in the
beacon's ring: it flashes a colour sequence (one colour every 650 ms, the matching crystal pulsing)
and you must stay in the ring to the end, else it is cancelled. Then climb and touch the tier's
crystals in that order. A wrong crystal shoves you back onto your pad and the sequence starts over
(step out of the ring and back in to see it again). A full sequence lights the next beacon up the
tower; the summit crystal ends the run once every tier is done. On level 5 the summit beacon wakes
Prism Shade, whose attacks are sequences of their own.

Everything is stepped in whole milliseconds, so 30, 60 and 144 fps agree. A crystal counts once per
visit: the moment it is within reach after you step into its rest reach (a bobbing one as it sinks
back down); its own bobbing never re-touches a standing hero.

Controls: WASD / arrows (camera-relative), Space jumps, E / Enter is the hero power. On touch: joystick,
Jump, Power. Camera: the shared free orbit (`menu2/camera`): drag or two fingers, wheel or pinch, Q / C,
R / F, V.

## Levels

| | Name | Twist |
|---|---|---|
| 1 | 3-Color Sequence | Three tiers of three colours on wide pads (r 2.1): the beacon pad, a pad with two crystals (out and in), a pad with one, a plain climbing pad. One shard storm on the last climb. |
| 2 | 4 Colors | A fourth colour; sequences of 3, 3, 4; sliding bridge pads between the tiers (the middle one carries the storm). |
| 3 | 5 Colors | All five colours over five tiers (sequences of 4); the beacon pad's inner edge holds the fifth crystal; glass pads (a third of the grip) and crumbling climbing pads. |
| 4 | Moving Crystals | Six tiers, sequences of 4 then 5, tighter gaps (36 deg, 2.2 m a step): every crystal bobs 1.9 m up out of reach and back (touch it as it sinks), spark drones patrol three stretches of the climb at head height, the climbing pads crumble and carry the storms. |
| 5 | Memory Tower | Four tiers with every hazard (a sliding bridge, glass, crumbling pads, bobbing crystals from tier 3, storms, two drone patrols), then the summit arena with Prism Shade (below): eight sequences in all. |

Every level also has a dark crystal wall in front of a side nook (Riko's shard), a void gate in front of
a second nook (Vexa's sticker), a sky ledge 4.4 m over a beacon pad (Nami's shard and two gems), hidden
gems in the crystal dust (Zuno), and a storm column (Kiro).

## Hero roles (every level has all five)

- **Riko**: the dash (+6 m/s for 0.4 s, 3 charges a run) crosses a wide gap and shatters the dark crystal
  wall in front of a side nook. Its shard is inside.
- **Nami**: the second jump goes up to the sky ledge (4.4 m over its pad: a plain jump tops out at 3.27 m).
- **Kiro**: the shield: shard storms, spark drones, the boss's shockwave and a wrong crystal's shove do not
  knock him (a wrong crystal still resets the sequence).
- **Zuno**: the magnet: gems from 6 m, the hidden gems rise out of the dust, and the NEXT crystal of the
  sequence (never a wrong one) is picked from 3 m, one crystal per activation.

A crystal you have just touched right stays safe for 3 s (`SAFE_MS`): touching it again, or a teammate
reaching it a moment later in co-op, is never a wrong.
- **Vexa** (lead): the phase takes her through the void gate of a side nook to its sticker.

## Boss: Prism Shade (L5, `progression.ts` PRISM, 4 HP)

`m2ShadowArmadillo` (the menu2 Shadow Plate) hovering over the arena's centre (`Boss.tsx`). Every attack
is a colour sequence: the telegraph IS the show (a prism over his crest and the matching rim crystal
take each colour), the attack is a shockwave ring across the arena (jump it) with the phase's trick,
and the vulnerable window is the time you have to touch his five rim crystals in order. A full sequence
in the window is the hit; a window that runs out brings a new sequence.

1. **Echo** (2 hits, five colours, 16 s): the shockwave shuffles the five crystals round the rim: track
   where yours went.
2. **Blackout** (1 hit, five colours, 16 s): the shockwave puts the crystals' colours out: remember where
   each one stood.
3. **Mirror** (1 hit, six colours, 18 s): the shockwave flips the order: touch them last to first.

## Score limits (time game)

Submitted duration = finish ms - 150 ms x gems - flow bonus (`finalScore`). The server computes the
score `floor((timeBaseMs - duration) / 10)`.

The proof (`rules.ts` header, the "proof" section):

1. **The invariant.** At the end of every simulated ms, the hero's horizontal move is clamped to
   V_RUN / 1000 m (6.5 m/s) plus the speed of an active boost. The only boost is Riko's dash
   (3 charges x 0.4 s x 6 m/s = 7.2 m, `boostBudgetMetres`); a sliding pad is slower than V_RUN, so a
   ride adds nothing. Knocks and shoves are slower than V_RUN too. `rules.test.ts` checks the clamp and the
   budget on every ms of random runs on all five levels.
2. **The shows are serial.** Show k starts with the hero inside beacon k's ring (BEACON_R 1.6 m), ends with
   the hero inside RING (1.9 m) of it (else it is cancelled), round k cannot end before show k ends, and
   beacon k+1 only arms after round k. A respawn goes back to a beacon already reached. The bot runs in
   `rules.test.ts` assert these on every show, round and the boss's waking.
3. Least travel = the straight lines start -> beacon 1 -> ... -> beacon n (-> summit), each end less the
   ring reach (and the summit's 2.2 m). Every pad, crystal and gap only makes the real route longer.
4. Least finish = every show (seqLen x 650 ms + 300 ms) + (least travel - dash budget) / V_RUN. Level 5
   adds Prism Shade's least defeat time (`bossMinMs`: every hit on the first ms of its window, 23.3 s).
5. Least duration = least finish - every gem (hidden ones included) x 150 ms - `comboMaxBonus` (each
   crystal of a tier's sequence once, each round, each beacon, each gem, each hit; the boss's own picks
   never link). minDurationMs = 95 % of it, floored to 100 ms. maxScore = (timeBaseMs - minDurationMs) / 10.

| Level | timeBaseMs | shows | least travel | least finish | gems | flow max | minDurationMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 3-Color Sequence | 90000 | 6.75 s | 32.5 m | 10.6 s | 16 | 0.91 s | 6900 | 8310 |
| 2 4 Colors | 120000 | 7.4 s | 32.8 m | 11.3 s | 19 | 1.01 s | 7000 | 11300 |
| 3 5 Colors | 150000 | 14.5 s | 55.8 m | 22.0 s | 22 | 1.59 s | 16200 | 13380 |
| 4 Moving Crystals | 180000 | 20.0 s | 64.0 m | 28.7 s | 25 | 2.00 s | 21800 | 15820 |
| 5 Memory Tower | 240000 | 12.9 s | 43.7 m | 41.7 s (+ boss) | 24 | 1.72 s | 34500 | 20550 |

These rows are in `meta.ts` (via `PROPOSED_LEVEL_LIMITS`, kept equal to `proposeLimits` by test),
`arcade-games.json` and the `PINNED` table in `rules.test.ts`.

## What the bots reached

`bot.ts` plays like a careful player with no power and a perfect memory: it stands still through the
show, climbs the route pad by pad (every crossing from the pad's middle, the jump when the next pad is
in reach, a lower pad by walking off the edge), waits out a storm or a crumbled pad, never jumps into
a drone's path, stands under a bobbing crystal until it sinks, and in Prism Shade's fight jumps his
shockwave and touches his crystals in the shown (or flipped) order. Submitted times at 60 fps (Vexa),
with the share of maxScore:

| Level | submitted | score / maxScore | gems |
|---|---:|---:|---:|
| 1 | 18.5 s | 86 % | 9 / 16 |
| 2 | 19.4 s | 89 % | 12 / 19 |
| 3 | 50.4 s | 74 % | 15 / 22 |
| 4 | 100.9 s | 50 % | 18 / 25 |
| 5 | 115.1 s | 61 % | 17 / 24 |

All levels win at 30, 60 and 144 fps with every hero, and none goes under the floor. Every main gem is
on the route. With each hero's power mashed, and in 200 spam runs on L1 plus 30 on each level (random
stick, jump, power, frame times and hero), nothing beats the floor (`rules.test.ts`, `proof.test.ts`).
An idle run times out unranked. The bot takes no wrong crystal and never falls; on L4 and L5 a drone
catches it once (a strike, no fall).

## Stars, secrets, juice

- Stars (`menu2/stars`): clear the level, collect every main gem, and beat the target time (50, 70, 95,
  120 and 150 s). No-hit badge: never knocked (a storm, a drone, the shockwave) and never a wrong crystal.
- Secrets (`menu2/secrets`): the void sticker (Vexa), the dark shard (Riko), the sky shard (Nami).
- Flow (`menu2/combo`): a right crystal, a round, a beacon reached, a gem, a hit on Prism Shade. The link
  window is 2.5 s, x2 cap.

## Multiplayer (1-4, `multiplayer.ts`)

- **Versus**: each player has their own beacons and sequences (the same ones, from the seed). Gems are
  shared (first come). First to the summit wins.
- **Co-op**: one shared tower: the tiers (shows, progress, rounds), the crystal visits, the crumbling pads
  and the broken walls are the same arrays for everyone, so one player's show is the team's and any
  player may touch the next crystal; the armed tier is kept equal across the runs. Kiro's shield,
  Zuno's magnet and Vexa's phase cover the team.
- Multiplayer runs are never ranked.

## Models

No new Hyper3D generation: every model is an existing GLB reused by url (`assets.ts`, all in the
manifest): spin-pole-climb's m2CircularPlatform (the pads, tinted by kind and placed per instance to
their radius), dragon-cave-rush's m2CrystalCluster (the crystals tinted their colour; the dark walls)
and m2HangingCrystal (the spire's growths, the storm shards), the menu2 checkpointBeacon (the beacons),
color-city-sprint's m2EnergyGem (gems) and m2FactoryDrone (drones), ice-peak-jumper's m2IceCrystal (the
summit crystal), cloud-hopper's m2SkyStar (far stars), the menu2 m2ShadowArmadillo (Prism Shade) and
the five menu2 heroes. The spire, rims, rings, the void gates' arch (menu2/props ArchWall) and the
nebulae are code. `assets.test.ts` tests the fits against the measured meshes.

## Open issues

- Level 5 in multiplayer: each player fights their own Prism Shade, and the camera shows player 1's.
- The bot never uses a power, so the three secrets are proven reachable by the placement tests
  (`layouts.test.ts`) and the hero-route tests (`rules.test.ts`), not by a bot run.
- On L4 the bot's share of maxScore is 50 %: the bobbing crystals cost waiting time the floor does not
  count (the floor is honest, not tight).
- Prism Shade is the menu2 shadow armadillo tinted violet; a dedicated dark-crystal boss GLB would suit
  the Neon Cosmos better (no credits were spent).

## Claude gate (browser playtest)

`next dev`, headless Chrome over CDP, the `?autoplay=1` bot playing L1 to L5 in one session through Next level, at 1280 x 800 (mouse drag + wheel orbit) and 390 x 844 (touch: two-finger orbit + pinch). Every level cleared, 0 console errors. Desktop: 18.5 / 22.2 / 45.4 / 97.1 / 113.7 s (all orbs, Prism Shade beaten); phone: 19.0 / 19.3 / 45.1 / 120.6 / 104.7 s (the bot's pace varies with frame timing).

Fixed in the gate: the spire was an 8-facet flat-shaded column that, up close, filled a third of the screen as one flat purple slab (now 16 glossy facets, a weaker glow); the pads and crystals were too dark (brighter hemisphere and key light on every level).

Open: at the start of a tier the beacon can stand between the camera and the hero for a moment (the orbit swings round as he moves); real-phone frame time not measured.
