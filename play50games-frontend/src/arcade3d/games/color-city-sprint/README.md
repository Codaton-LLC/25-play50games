# Color City Sprint (Menu 2, game 15, World 1 Ember Heights)

Status: **dev** (`enabled: false` in `arcade-games.json`, registry order 61). Design card:
`docs/menu2-super/world-1-ember-heights.md` "15 Color City Sprint". Lead hero Riko (`defaultHeroFor`).
Built by Claude on top of Cursor's unfinished branch (`cursor/m2-color-city-sprint`, 3337925c): the folder
layout and the Menu 2 wiring were kept; the city, the rules, the proof, the bot, the boss and the whole
visual layer were rewritten (Cursor's limit proof under-counted corner cuts, see "Score limits").

## The game

**Signature: route-making laps.** An open city of blocks between 6 m streets. One beacon is lit at a time
(a red light pillar over the roofs, an arrow on the ground, an arrow at the screen edge and a mini-map) and
you pick the line. When you reach it, every street you ran since the last beacon turns red. From lap 2 a
red street raises your top speed from 6.5 to 8.5 m/s (+30 %) and curls you into the ball; off the red the
ball coasts, bleeding 3 m/s². Lap 1's choices build lap 2's speed network. A chain of red streets, beacons
and gems feeds the flow meter (`menu2/combo`). Buildings start drained grey and flash back into colour as
the streets beside them turn red.

Controls: WASD / arrows (camera-relative), Space jumps, E / Enter is the hero power; touch joystick, Jump,
Power. Camera: the shared free orbit (`menu2/camera`): drag / two fingers, wheel / pinch, Q / C, R / F, V.

## Levels

| | Name | City | Twist |
|---|---|---|---|
| 1 | Red Block | 3 x 3 blocks, 2 laps, 4 beacons | three beats: a beacon straight down the avenue; a beacon behind a choice (the coned lot cuts the corner, the clear avenue goes round); lap 2 on your own red into the plaza. A parked bus and a ramp under the rail. |
| 2 | Bus Line | 4 x 3 | two buses loop their blocks every 9 s; ramps throw you onto their roofs; one beacon rides a bus (stand on its roof). Buses are solid at street level and shove you aside ("Honk!"). |
| 3 | Rush Hour | 5 x 5 | six colour gates at the crossings, 4 s green / 4 s red, the cross street green while yours is red (traffic lights with an amber warning); sludge and steam vents. |
| 4 | Night Neon | 5 x 5, 3 laps | night: only the streetlamps and your red lanes glow. The four beacons sit on one ring; paint every street of it and the perfect-loop sticker lights in the plaza. |
| 5 | Greyout Avenue | 5 x 5 | the boss (below). The beacons keep cycling and paint lanes; red counts from the start; Greyout Avenue is red and can never be swept. |

## Hero roles (every level has all five)

- **Riko**: the dash (V_RED for 0.5 s, never faster than a red lane) smashes the cracked hoarding of the
  construction site: the whole block opens as a diagonal cut. The site's shard is inside.
- **Nami**: the second jump. Off a ramp onto a bus roof (3.4 m, above a plain jump's 3.27 m), then only her
  second jump reaches the elevated rail (7.4 m): a fast deck (always 8.5 m/s) with two bonus gems and the
  rooftop sticker at its end.
- **Kiro**: the shield: sludge, steam vents and Greyout's drones neither slow nor knock him.
- **Zuno**: the magnet: storm drains and the plaza fountain give up hidden coin trails (3 gems each), and
  gems come from 6 m.
- **Vexa**: the phase: the ghost shop (purple glow, glass shop-fronts) lets her through its block (she stays
  passable until she is out); its shard is inside.

## Boss: Greyout, the Street Sweeper (L5, `progression.ts` GREYOUT, 7 HP)

`m2GreySweeperBoss` with code-built roof brush units, tank valves and headlights (`Boss.tsx`).

1. **Brushes** (3 hits): it drives to a stop beside a ramp, sweeping the red off every street it crosses,
   sweeps (touching it hurts), then parks with its front 1 m past the ramp's lip: run up the ramp and jump
   onto its roof brushes (feet 3.5 m or higher: a plain jump never gets there). Each hit stops the sweeping
   for 5 s.
2. **Valves** (2 hits): brushes broken, it drives to a stop on the avenue, sprays sludge behind it and drops
   two drone cones ahead, then parks: roll down the red avenue into its back valves (curled, so at red-lane
   speed, moving toward it).
3. **Ram** (2 hits): it hunts you along your own trail through the plaza (1.2 s behind, faster when it rams).
   A red gate holds it; in its open window it barges on, and a gate that is red on it slams it (it spins out).
   On the last hit the whole city repaints red (slow-mo is visual only).

## Score limits (time game)

Submitted duration = finish ms - 200 ms x gems - flow bonus (`finalScore`); the server computes the score
`floor((timeBaseMs - duration) / 10)`.

The proof (`rules.ts` header, `travelMetres`):

1. **The invariant.** At the end of every simulated ms the hero's horizontal move is clamped to
   V_RED / 1000 m, whatever moved it (stick, dash, a bus roof carrying it, a bus or the truck shoving it, a
   collision push). `rules.test.ts` checks it on every ms of random runs on all five levels.
2. Buildings are solid at every height (a jump never crosses one), and the hero's centre is kept HERO_R out
   of them. The proof grows each building by HERO_R - 0.3 m only (a margin for a push that is clamped).
   Lots, plazas, construction sites, ghost shops, cones, ramps, buses and gates are left out (free), which
   only lowers the bound.
3. A beacon is taken from up to its reach (1.6 m), so each leg is at least the shortest path round the
   buildings between the beacon centres minus both reaches (a visibility graph over the building corners,
   exact for axis-aligned boxes). A bus beacon is taken on its bus's roof within 2.6 m of the bus's centre,
   which runs its loop: the proof takes the best point on the loop (sampled every 0.5 m, the reach grown by
   0.25 m) through a small DP. Every lap, in order.
4. Least finish = least travel / V_RED. Level 5: Greyout's least defeat time (`bossMinMs`: every hit on the
   first ms of its window), travel ignored.
5. Least duration = least finish - every gem (incl. hidden coins) x 200 ms - `comboMaxBonus` (beacons
   (L5: the first 12), every street once, every gem, every hit). minDurationMs = 95 % of it, floored to 100 ms.

Cursor's earlier bound gave each corner turn 2.16 m of cut; the real cut round a block corner is up to
3.7 m, so its floor was not a lower bound. This one is.

| Level | timeBaseMs | least travel | minDurationMs | maxScore |
|---|---:|---:|---:|---:|
| 1 Red Block | 100000 | 190.2 m | 17100 | 8290 |
| 2 Bus Line | 130000 | 275.4 m | 26400 | 10360 |
| 3 Rush Hour | 160000 | 346.8 m | 32900 | 12710 |
| 4 Night Neon | 200000 | 395.2 m | 38700 | 16130 |
| 5 Greyout Avenue | 200000 | boss 33.2 s | 26100 | 17390 |

The same rows are in `meta.ts` (via `PROPOSED_LEVEL_LIMITS`), `arcade-games.json` and the pinned test.

## What the bots reached

`bot.ts` plays like a careful player with no power: a visibility-graph line round what is solid for it,
corner cuts, a wait for green, a timed ramp jump onto a moving bus, and all three boss phases. Submitted
times at 60 fps (Riko): L1 29.8 s, L2 58.8 s, L3 62.3 s, L4 56.1 s, L5 ~39 s; all at 30 / 60 / 144 fps win,
none under the floor, each at least 65 % of maxScore. With every hero's power mashed, 200 spam runs on L1
and 30 on each level, nothing beats the floor (`rules.test.ts`, `proof.test.ts`).

## Stars, secrets, juice

- Stars (`menu2/stars`): clear, every main gem (spread so no single lap line gets them all), target time
  (44 / 58 / 78 / 96 / 92 s). No-hit badge: never bumped, vented, struck.
- Secrets (`menu2/secrets`): the rooftop sticker (rail, Nami), the ghost-shop shard (Vexa), the hoarding
  shard (Riko); L4 the perfect loop instead of the hoarding shard.
- Juice (`menu2/juice`): red paint spray behind a ball on red, a speed ripple into a red lane, dust and a
  horn on bus-roof landings, a ramp kick, lap-split pops (`Lap 2 · 0:14.2`), "+3 red" on a beacon,
  buildings flashing back to colour, smash / phase bursts, Greyout's hits, "SLAM!", the final repaint.

## Multiplayer (1-4, `multiplayer.ts`)

- **Versus race**: each player's lanes are their own (drawn in their player colour) and only their own red
  boosts them; gems are shared; first home wins, the rest get the grace time.
- **Co-op relay**: one shared red network; beacon k is player (k mod n)'s to take (ringed in their colour);
  a beacon taken moves everyone on; Riko's smashed hoarding opens for all; shield, magnet and phase cover
  the team.
- One shared camera (`SharedCamera` with the orbit); multiplayer runs are never ranked.

## Models

`public/models/3d/color-city-sprint/`: m2PastelCityBg (the pastel rows, also the backdrop), m2CityBus,
m2StreetJumpRamp, m2ColorGateV2 (gates and the ghost shop-fronts), m2CityBarrier (the hoarding),
m2TrafficCone, m2EnergyGem, m2GreySweeperBoss, m2FactoryDrone (from ready/menu2/shared); reused by url:
rooftop-roll-climb's m2SkylineTower and m2RooftopBlock, menu2's checkpointBeacon, shared trafficLight.
m2ColorGate (the stone arch) is in the folder from Cursor's branch and unused here (it reads as fantasy, not
street). The fits (`assets.ts`) are tested against the measured meshes.

## Open issues

- Level 5 in multiplayer: each player fights their own Greyout; the camera shows player 1's truck.
- The daily seed that reorders beacons (card's risk fix) is not built: the order is fixed so the proof holds.
- `registry.sync.test.ts` "every slug in order" expects order = position: it passes once ring-jump (58),
  wind-tunnel (59) and roll-cannon (60) are in the slice; on this branch alone it fails by design.
