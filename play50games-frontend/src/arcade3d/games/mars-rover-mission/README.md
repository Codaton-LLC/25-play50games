# Mars Rover Mission

Game 43 · points · difficulty 2 · collection adventure · owner antigravity (built by Antigravity, gated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-41-50.md` §43.

Drive a rover across one red plain: stop inside each beacon ring to scan a sample, recharge on a charger pad when the battery runs low, then park on the base pad. Later levels add more rocks, rolling boulders, a hungrier battery, a dust storm (L4) and a night under the stars (L5).

## Controls and timing (one set for keyboard and touch)

- The street-vehicle integrator (`specs-31-40.md`) with the rover's numbers (`ROVER` in `rules.ts`): top speed 7, accel 7, brake 12, reverse 2.5 (S / down brakes, then reverses), steer 1.8 rad/s × `clamp(|speed| / 2, 0.35, 1)`, coasting drag 0.6/s, radius 1.1. Yaw 0 faces +z; right steers clockwise. Stick dead zone 0.2 on both axes, rescaled (a held key = a full stick).
- The integrator runs in fixed 1/120 s steps (at most 8 per frame), so 30 / 60 / 144 Hz drive the same (`rules.test.ts`).
- Scan: `|speed| < 0.5` for 1.00 s inside a ring (radius 1.8); stopped within 1.0 m of its centre pays the bonus. Charging: `|speed| < 0.5` on a pad (radius 2.2), +12/s. Win: every site scanned, then 0.6 s stopped on the base pad (radius 2.4).
- Battery 100: drains 0.35/s plus 0.9 per metre × `drainScale`; at 0 the rover stalls (`lose`).
- Rocks are solid circles (0.95): a hit above 3 m/s spends a life and bounces the speed to -0.3 of itself; slower, a nudge. Boulders (0.85) roll south down straight lanes at `boulderSpeed` (they wrap at the south wall and rise again at the north wall): a hit (swept box test, no tunnelling at 30 Hz) spends a life. 1 s of grace after a hit. 3 lives. The walls stop the rover, no damage.

## Levels

| L | Title | Plain | Sites | Chargers | Rocks | Boulders (speed) | Drain | Clock | Look | Limits (max / base / pps) |
|---|---|---|---:|---:|---:|---|---:|---:|---|---|
| 1 | Landing Zone | 40 × 32 | 3 | 1 | 6 | – | 0.8 | 120 s | day, landing capsule | 1115 / 540 / 49 |
| 2 | Rocky Plains | 46 × 36 | 4 | 1 | 12 | – | 0.9 | 150 s | day | 1440 / 720 / 48 |
| 3 | Mars Canyon | 50 × 40 | 5 | 2 | 12 | 2 (3.5) | 1.0 | 180 s | sunset | 1765 / 900 / 47 |
| 4 | Crater | 50 × 40 | 6 | 2 | 14 | 3 (4.0) | 1.15 | 180 s | sunset, dust storm (the shortest fog, 18 m deep) | 1905 / 1080 / 31 |
| 5 | Ancient Mars Site | 56 × 44 | 7 | 2 | 16 | 4 (4.5) | 1.1 | 240 s | space, stars | 2365 / 1260 / 33 |

`minDurationMs` 4000 on every level, `maxDurationMs` = the clock. Only a win clears a level (no `clearScore`).

Generator (`createRun`, redrawn until every count is met, tests on 300 seeds per level): boulder lanes first (≥ 5 m apart, ≥ 4.85 m from the base's x), then sites (≥ 10 m apart, ≥ 7 m from the base, ≥ 3.4 m from every lane, so a rover parked within 1 m of a centre is never in a boulder's way), chargers beside the sites farthest from the base (4.5–7.5 m away, ≥ 10 m apart, clear of lanes), rocks (≥ 3 m from every ring, clear of pads, the base and the lanes, and far enough apart that the rover always fits between two). Energy rule: every site lies within `energyReach` (a there-and-back at 1.35 × the straight line on 85 % of a battery) of a charger, a charger lies within two reaches of the base and the chargers within two reaches of each other.

## Server limits and why they hold (one proof per level)

| Source | Value | Bound |
|---|---|---|
| Scan | +120 (`BASE_SCAN_SCORE`) | each site pays once |
| Centre bonus | +60 (`CENTER_BONUS_SCORE`) within 1.0 m | once per site |
| Win bonus | +5 × full seconds left (`TIME_BONUS_PER_SEC`) | once, on the win |

`Bobj = 180 × sites` = 540 / 720 / 900 / 1080 / 1260. A run that ends at `t` scores at most `Bobj` (a loss or timeup) or `Bobj + 5 floor(D − t)` (a win at `t`). With `base = Bobj` the rate line holds for every win at `t ≥ M` when `pps ≥ 5 (D / M − 1)`; the peak is `Bobj + 5 floor(D − M)`. `M` is 0.8 × the fastest win of the oracle and the careful bot over 200 seeds each at 30 / 60 / 144 Hz (`PROOF_EARLIEST_WIN_S`).

| L | D (s) | fastest bot win (s) | M (s) | peak | maxScore (+3 %) | pps needed | pps | best bot | best / max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 120 | 14.28 | 11.42 | 1080 | 1115 | 47.5 | 49 | 1065 | 95.5 % |
| 2 | 150 | 18.17 | 14.53 | 1395 | 1440 | 46.6 | 48 | 1375 | 95.5 % |
| 3 | 180 | 22.33 | 17.87 | 1710 | 1765 | 45.4 | 47 | 1685 | 95.5 % |
| 4 | 180 | 32.55 | 26.04 | 1845 | 1905 | 29.6 | 31 | 1815 | 95.3 % |
| 5 | 240 | 40.57 | 32.46 | 2295 | 2365 | 32.0 | 33 | 2255 | 95.3 % |

L5 / L1 = 2.12. The win score is capped to its level's limits in `rules.ts` as a safety net (only a win faster than `M` would reach it); the proof tests assert the cap never changes a bot run.

Bots (`testing/bots.ts`, through `createArcadeStore` + `simulateRun` + the same `frame()` the Scene runs): the careful bot (a human-like driver: path around rocks with a margin, brakes for the stop and for bends, waits outside a lane while a boulder comes, sidesteps out of a lane, charges where the detour is shortest) clears 200/200 (L1–L3), 199/200 (L4), 198/200 (L5) of 200 seeds; the oracle (tighter margins, harder braking) is inside the limits and reaches the best scores; idle never clears (200 seeds through the rules, 5 through the store); input spam stays inside the limits and never clears. Files: `clears.level-N.test.ts` (careful) and `proof.level-N.test.ts` (arithmetic, oracle, idle, spam), ten files so they run in parallel. Mutation probes on every level read in `rules.ts`, `index.tsx`, `meta.ts` and `looks.ts` fail the tests.

## Look and models

The ready `menu1-mars-rover-mission` GLBs (ledger OK) are adopted under `public/models/3d/mars-rover-mission/`, fitted from their measured bounds (`assets.ts` `GLB_SIZE`, `assets.test.ts` on the real meshes): the rover 2.4 m long (inside its 1.1 m circle; the body bobs on a `spring`, the wheels are not split), solid rocks (`sampleRock`, as wide as their 0.95 m circle), the sample (0.45 m: waiting in each ring, lifting while it scans, then in the tray), boulders (`marsBoulder`, centred so the pool spins them, rising out of the ground at a lane's north end), beacons 3 m tall at each ring's north edge, the charging station and a solar panel at each pad's north edge, the boundary of low `marsMesaRock` slabs (the south one 0.5 m high, on the camera's side), distant `marsMesaTall` mesas north, east and west, and a base camp south of the south wall (habitat, antenna, crates, the L1 landing capsule) where the astronaut stands — auto-rigged with measured `ASTRONAUT_LANDMARKS` (`astronaut.test.ts`), idle, cheering on a win. Decor is fitted to 1 m and placed by its spot's scale. Skipped: `marsRoverV2` (thin mast parts), `groundSolarPanel` (V2 used), `ancientMarsRuin` (ledger: nine free-standing pillars with no base), `canyonMesa` (the new `marsMesaTall` is the skyline).

Ground: a 400 m rust / ochre regolith plane (`#b4532a` / `#c2703d` / `#8a3b1e`; a 1024 px canvas tile of 16 m: soft dunes, dust grain, pebbles, small rimmed craters) under the fog, and a faint, narrow dust trail (1.1 m, 16 %) down each boulder lane.

Fog follows the fitted camera (`fogRange`, playtest fix: the spec's L4 6 / 28 fog turned a portrait phone flat orange): it starts past the aim (camera distance + half the window, never nearer than the level's minimum) and keeps the level's depth, L4's dust storm the shortest (18 m against 40–60). Dust-coloured fog per level (`FOG_COLOR`). `looks.test.ts` checks every level at 390 × 844 and 1280 × 800. Sky dome per level; L5 a dark sky with stars. Rings and pads are one tinted pool each (scan rings orange → yellow while holding → green; pads light while charging); the base pad's rim lights once every site is scanned.

Camera: a follow camera (pitch 46°, yaw 0, 3.5 m look-ahead along the velocity) keeping a 13 × 12 m window clear of the HUD and the joystick (`useFittedView`, `shift`), aimed inside the plain. `<TargetMarkers>`: the next site, then the base; a green arrow to the nearest charger while the battery is under 30. HUD: the shell's chips (score, time, lives, Samples x/sites, Battery). The helper's custom battery panel was removed (it repeated the Battery chip).

## Known issues / for the playtest

- Facing: the rover drives along its GLB z (its long axis) with the nose at +z: the mesh's dense instrument end is +z and the mast stands aft of centre (`assets.test.ts`); its footprint is nearly square (1.97 × 2.4 m), so it can read square-on mid-turn. The astronaut faces +z (the camera).
- The beacons and the station/panel at each ring's and pad's north edge are not solid: the rover can drive through their thin legs.
- The astronaut's landmarks are the core estimate with the hem and the head joint set from the height profile; check the helmet and arms in the cheer.
- `ancientMarsRuin` is broken in the ledger: L5 has no "ancient site" landmark yet.
