# Mars Rover Mission

Game 43 · points · difficulty 2 · collection adventure · owner antigravity (built by Antigravity, gated by Claude 2026-10-25; redesigned by Claude 2026-10-28). Spec: `docs/menu1-new/specs-41-50.md` §43.

**One mission per level, readable in 3 seconds.** The start card's line is the mission ("Mission: drill 3 crystal samples and bring them back to the lander."), the HUD's mission card ticks it off step by step, a light pillar stands over every objective, a chevron on the ground and the screen-edge arrows point to the next one with its distance, and the rover does the job itself when it stops in the ring: it drills, scans or repairs.

| L | Title | Mission | Hazards | Look |
|---|---|---|---|---|
| 1 | Landing Zone | drill 3 crystal samples (magicCrystal deposits), bring them to the lander | rocks, battery | day, low ridges, the sun and a moon |
| 2 | Rocky Plains | scan 4 signal beacons (beaconLight) | 12 rocks, battery | day, ridges, two moons |
| 3 | Mars Canyon | drill 5 crystals | sliding rocks down the cliff chutes, battery | blue Martian sunset, tall canyon walls, Earth as the evening star |
| 4 | Crater | repair 6 broken solar panels before the dust storm hits | the storm (the fog closes in with the clock, dust streaks), 2 crevasses, sliding rocks, the hungriest battery | storm sky, crater rim, headlights |
| 5 | Ancient Mars Site | scan 7 ancient beacons (m2RuinLanternPillar) | 3 crevasses, 4 sliding rocks, battery | night, Earth, Phobos and Deimos, stars, headlights, the great arch on the north ridge |

## Controls and camera

- A **chase camera** (core `ChaseRig` + pure `core/chaseCamera.ts`) sits behind the rover's heading and swings round after it, so **left on the stick or A / left arrow always turns the picture left** (`chaseCamera.test.ts`, `looks.test.ts`). It never dips under the terrain, widens the lens and pulls back on a portrait phone, and orbits the rover after a win.
- **Camera views** (core `useCameraViews`): 📷 or **C** cycles the view. The chase rig is the default, then Front, Top and Free (drag looks around; Q / Z and X turn, R / F tilt, V recenters). Left and right still turn the rover. The top view starts 12 m up so the rover stays out of the haze (L4's storm fog closes to 8–30 m; the other levels' fog starts at 24–34 m). Rocks, props, sliding rocks and the boundary ledges pull the camera in front of them.
- The street-vehicle integrator (`specs-31-40.md`) with the rover's numbers (`ROVER` in `rules.ts`): top speed 7, accel 7, brake 12, reverse 2.5 (S / down brakes, then reverses), steer 1.8 rad/s × `clamp(|speed| / 2, 0.35, 1)`, coasting drag 0.6/s, radius 1.1. Yaw 0 faces +z; right steers clockwise. Stick dead zone 0.2 on both axes. Fixed 1/120 s steps (at most 8 per frame): 30 / 60 / 144 Hz drive the same.
- Work a site: `|speed| < 0.5` for 1.00 s inside its ring (radius 1.8); stopped within 1.0 m of its centre (the inner target ring) pays the +60 "perfect stop". Charging: `|speed| < 0.5` on a pad (radius 2.2), +12/s. Win: every site done, then 0.6 s stopped on the base pad (radius 2.4) by the lander.
- Battery 100: drains 0.35/s plus 0.9 per metre × `drainScale`; at 0 the rover stalls (`lose`). Under 30 the HUD warns, a green pillar rises over every charger and the guide points to the nearest pad first.
- Rocks are solid circles (0.95): a hit above 3 m/s spends a life and bounces the speed to -0.3 of itself. **Props are solid** (`PROP_RADIUS`): each site's beacon / panel / ancient beacon 2.9 m north of its ring's centre, each charger's station and solar panel, and the lander beside the base pad; no damage, a bump above 2 m/s bounces the rover (-0.25). Sliding rocks (boulders, 0.85) come down a chute in the north cliff and roll south along their dust lane (they wrap): a hit (swept box) spends a life. **Crevasses**: a crack along a segment (half width 0.55); the rover's centre within 0.8 m of its axis falls in: a life (unless in the 1 s grace), and it is put back, stopped and facing away, on the last point it held 1.6 m clear of every crack. 3 lives. The plain's edges stop the rover, no damage.

## Levels (rules data)

| L | Plain | Sites | Chargers | Rocks | Sliding rocks (speed) | Crevasses | Drain | Clock | Limits (max / base / pps) |
|---|---|---:|---:|---:|---|---:|---:|---:|---|
| 1 | 40 × 32 | 3 | 1 | 6 | – | 0 | 0.8 | 120 s | 1115 / 540 / 48 |
| 2 | 46 × 36 | 4 | 1 | 12 | – | 0 | 0.9 | 150 s | 1435 / 720 / 45 |
| 3 | 50 × 40 | 5 | 2 | 12 | 2 (3.5) | 0 | 1.0 | 180 s | 1765 / 900 / 47 |
| 4 | 50 × 40 | 6 | 2 | 12 | 3 (4.0) | 2 | 1.15 | 180 s | 1895 / 1080 / 28 |
| 5 | 56 × 44 | 7 | 2 | 14 | 4 (4.5) | 3 | 1.1 | 240 s | 2355 / 1260 / 31 |

`minDurationMs` 4000, `maxDurationMs` = the clock. Only a win clears a level.

Generator (`createRun`, redrawn until every count is met; 300 seeds per level in the tests): the lander first, then boulder lanes (≥ 5 m apart, ≥ 4.85 m from the base's x, clear of the lander), sites (≥ 10 m apart, ≥ 7 m from the base, ≥ 3.4 m from every lane; a site's prop inside the plain, clear of the base and a rover's width from every other ring and prop), chargers beside the sites farthest from the base (4.5–7.5 m, their station and panel clear of rings, pads, lanes and props), rocks (≥ 3 m from every ring, a rover's width from every prop and each other), crevasses (a rover's width from every ring, pad, prop and rock, ≥ 4 m from the base, out of every lane). Energy rule: every site within `energyReach` of a charger; a charger within two reaches of the base, the chargers within two reaches of each other.

## Server limits and why they hold (one proof per level)

| Source | Value | Bound |
|---|---|---|
| Site | +120 (`BASE_SCAN_SCORE`) | each site pays once |
| Perfect stop | +60 (`CENTER_BONUS_SCORE`) within 1.0 m | once per site |
| Win bonus | +5 × full seconds left (`TIME_BONUS_PER_SEC`) | once, on the win |

`Bobj = 180 × sites`. A run ending at `t` scores at most `Bobj` (a loss or timeup) or `Bobj + 5 floor(D − t)` (a win). With `base = Bobj` the rate line holds for every win at `t ≥ M` when `pps ≥ 5 (D / M − 1)`; the peak is `Bobj + 5 floor(D − M)`. `M` = 0.8 × the fastest win of the oracle and the careful bot over 200 seeds each at 30 / 60 / 144 Hz (`PROOF_EARLIEST_WIN_S`). Re-derived 2026-10-28 for the redesign (solid props, crevasses, the new generator):

| L | D (s) | fastest bot win (s) | M (s) | peak | maxScore | pps needed | pps | best bot | best / max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 14.47 | 11.57 | 1080 | 1115 | 46.9 | 48 | 1065 | 95.5 % |
| 2 | 150 | 19.31 | 15.45 | 1390 | 1435 | 43.5 | 45 | 1370 | 95.5 % |
| 3 | 180 | 22.15 | 17.72 | 1710 | 1765 | 45.8 | 47 | 1685 | 95.5 % |
| 4 | 180 | 35.15 | 28.12 | 1835 | 1895 | 27.0 | 28 | 1800 | 95.0 % |
| 5 | 240 | 43.04 | 34.43 | 2285 | 2355 | 29.9 | 31 | 2240 | 95.1 % |

L5 / L1 = 2.11. The win score is capped to its level's limits in `rules.ts` as a safety net; the proof tests assert the cap never changes a bot run.

Bots (`testing/bots.ts`, through `createArcadeStore` + `simulateRun` + the same `frame()` the Scene runs): the careful bot (paths around rocks, props and crevasses with a margin, brakes for stops and bends, waits outside a lane while a sliding rock comes, sidesteps to the clear side, never follows a boulder down its lane faster than it, charges where the detour is shortest) clears 200/200 seeds on every level; the oracle (tighter margins, harder braking) stays inside the limits and reaches the best scores; idle never clears; input spam stays inside the limits and never clears. Files: `clears.level-N.test.ts` (careful) and `proof.level-N.test.ts` (arithmetic, oracle, idle, spam).

## Look and models

All ready GLBs, no new Hyper3D. From `menu1-mars-rover-mission`: the rover (2.4 m), sampleRock (solid rocks), marsBoulder (sliding rocks), beaconLight (L2 beacons, 2.6 m), groundSolarPanelV2 (L4 panels 1.7 m wide: slumped and twisted until repaired, then they swing upright; also each charger's panel), chargingStation, landingCapsule (the 4.2 m lander by the base pad), marsMesaRock (the boundary ledges), marsMesaTall (mesas on the plateau), the camp (marsBase, commsAntenna, researchCrate) and the auto-rigged astronaut beside the lander (idle, cheering the delivery). Adopted from other ready sets: `magicCrystal` (wizard-potion-lab: the crystal deposits, sunk as they are drilled), `auroraCrystal` (penguin-slide: the samples carried on the rover's deck), `m2RuinLanternPillar` (menu2 temple-gong-timing: the L5 ancient beacons) and `m2CaveTempleArch` (menu2 dragon-cave-rush: the L5 arch). The broken `ancientMarsRuin` stays out.

- **Rover feel** (`Rover.tsx`): the body rides a suspension spring (bumps with speed, squats on the throttle, dives on the brake), the whole rover tilts to the terrain's slope, code wheels (tread + hub, moving parts) sit over the GLB's own wheels (`ROVER_WHEELS`, measured on the mesh, `assets.test.ts`), roll with the distance and steer front and rear; a dust trail and tyre tracks follow it; headlights (two spot lights and a soft cone) on L4 and L5; it blinks through the hit grace.
- **Actions**: crystal sites: a drill lowers under the belly and spins, sparkles and dust puff, the deposit sinks, then the crystal flies in an arc onto the deck. Beacon / ancient beacon sites: a scanner beam from the mast head to the beacon's lamp. Panels: an orange repair beam with sparks, then the panel swings upright and its lamp turns green. A progress arc fills round the ring; a toast and "+120" / "+180 PERFECT" pop. Delivery: confetti and sparkle at the lander, its light flashes, the astronaut cheers, the camera orbits (2.4 s result delay).
- **Terrain** (`terrain.ts`, `Ground.tsx`): one height field: soft dunes on the plain (flat under every ring, pad, prop and crack), terraced cliffs beyond it (ridges, canyon walls, a crater rim), a chute in the north cliff above each sliding-rock lane, the plateau melting into the haze; a regolith tile with wind ripples and craters, vertex colours for crests, cliff faces and strata.
- **Sky** (`Sky.tsx`): the haze dome (its horizon colour is the fog's), the sun (blue-haloed at the L3 sunset), Earth, Phobos and Deimos, stars at night; L4's storm streaks thicken as its fog closes in (`fogAt`).
- **HUD** (`Hud.tsx`): the mission card (top left, a fixed `data-arcade-safe-area` box): the steps with ticks, the counter, "Next crystal · 34 m" or the action's progress bar; a low-battery banner; toasts. The shell chips keep score, time, lives, the mission counter and the battery.

## Known issues / for the playtest

- The rover GLB has four wheels (the ledger asked for six); the code wheels cover them.
- The headless playtests run without a GPU budget check on a real phone; the L5 night and L4 storm are the heaviest scenes (spot lights, storm streaks).
