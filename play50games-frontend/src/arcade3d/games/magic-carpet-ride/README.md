# Magic Carpet Ride

Menu 1 game 47. Slug `magic-carpet-ride`. Order 47. Status `dev`. Collection `adventure`. Points. Difficulty 2. Owner cursor (redesigned by Claude 2026-10-28 after the user's playtest: "the person flies but the objects don't fly; make it modern; use the GLBs to fly lower/higher/left/right, collect points").

A modern flying game: the carpet flies forward along a winding sky lane through five biomes; the player steers it freely up, down, left and right, flies through rings (a chain of rings is a combo), sweeps up coin arcs, reaches for gems, grabs rocket boosts and dodges flying obstacles. The goal is the floating palace at the end of the lane with the ring quota.

## Files

| File | What |
|---|---|
| `rules.ts` | Pure rules: `createRun(seed, level, levelId)`, `step(run, input, dt, timeLeftMs)` (a shared event), `syncStore(run, ev, store)` (exactly the Scene's store calls), the racing line `lineAt`, `obstacleClearance`, `PROPOSED_LEVEL_LIMITS`, `PROOF_MIN_WIN_S`. |
| `levels.ts` | The five `CarpetLevel` configs (biome, lane, rings and quota, coins, gems, boosts, flyers, clock, light), titles, tile lines. |
| `looks.ts` | Palette, the chase camera's constants, the biome looks, `decorSpots` (each biome's dressing, kept clear of the lane). |
| `assets.ts` | Every GLB with its measured bounds and fit (`assets.test.ts` checks them on the real meshes), `RIDER_LANDMARKS`. |
| `Scene.tsx` | One `useRunFrame` (step + syncStore + effects), the chase `EyeRig` (eased follow, lean into turns, boost fov), pools for rings, coins, gems, boosts and each flyer kind, the biome decor, the carpet (cloth wave) and the cross-legged rider. |
| `Hud.tsx` | Route progress to the palace, the combo pop, boost speed lines, the missed-quota line. |
| `testing/bots.ts`, `testing/limitProof.ts` | Test-only bots (oracle, greedy, idle, spam) through the real store and a pure twin for the 200-seed sweeps. |

## Rules

- **Flight.** The lane is a smooth spline (`core/path`) of the level's length; the carpet flies along it at the level's speed. Its cross-section is 12 m wide and 7 m tall (`CORR_X` 6, `CORR_Y` 3.5). The stick sets a drift velocity (8 m/s sideways, 6 m/s up and down at full stick) that the carpet eases to at 7/s; released, the drift stops and the carpet stays where it was left. The walls stop it. Right on the keys or the stick moves the carpet to the right of the screen and up flies up (a test projects the carpet through the Scene's chase camera). The carpet banks into the drift and pitches with the climb.
- **Rings** pay when the carpet crosses the ring's plane within 1.4 m of its centre (the drawn ring is 3.4 m across). Rings in a row build a chain: ring k of an unbroken chain pays 50 + 25 x min(k - 1, 4), so 50, 75, 100, 125, then 150. A ring passed by, or a hit, breaks the chain. No ring sits within 2.2 m of the lane's centre, so an idle carpet passes none.
- **Coins** (10) float in an arc in every gap between two rings, on the racing line. **Gems** (50) sit 2.0-2.8 m off the line in the gem gaps (every second gap). **Boosts** (a rocket) give 1.6 x speed for 2.5 s, with speed lines and a wider fov.
- **Obstacles** cost a life (3 lives), break the chain and give a 1.3 s mercy (the carpet blinks). Kinds and motion (`OBSTACLE_SPEC`): gulls, hawks and bats swing sideways (bats in a figure of eight) and beat their wings; balloons, hot-air balloons and sky lanterns bob up and down; rocks drift and tumble; the blimp drifts across, side on.
- **The racing line** (`lineAt`) runs through every ring, its lat straight between rings and its height along that gap's arc; the coins sit on it. Obstacles live only in the obstacle gaps (the odd ones, not the first) and every position each one can ever reach keeps its radius + the carpet's 0.55 m + 0.5 m clear of the line (`obstacleClearance`, 200 seeds x 5 levels in `rules.test.ts`). Gems sit alone in their gaps. So following the coins is always safe, a gem is a safe detour, and leaving the line among the flyers is the risk.
- **The end.** At the end of the lane the run wins with at least the ring quota (the result shows how many were missing otherwise). Lives at 0 and the shell clock are the other endings.
- **Score**, all integers: rings with their chain, coins, gems, and on a win `FINISH_BONUS` 200 + `LIFE_BONUS` 100 x lives left + 5 x the full seconds left on the clock.

## Levels

| L | Title | Biome | Length | Speed | Rings (quota) | Coins / arc | Gems | Boosts | Flyers | Kinds | Clock | Light |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---|
| 1 | Desert Dawn | town rooftops, towers, palms, pyramids | 540 | 13 | 10 (7) | 5 | 4 | 2 | 4 | gull, balloon | 75 s | day |
| 2 | Red Canyon | canyon walls (mesas) | 680 | 14 | 13 (9) | 5 | 5 | 3 | 7 | gull, rock | 85 s | sunset |
| 3 | Cloud Kingdom | clouds, sky islands | 820 | 15 | 16 (12) | 6 | 6 | 3 | 9 | balloon, hot-air balloon, gull | 95 s | day |
| 4 | Lantern Night | night town, lanterns, stars | 900 | 15.5 | 18 (13) | 6 | 7 | 4 | 11 | bat, sky lantern | 100 s | night |
| 5 | Sky Palace | islands, palaces | 1080 | 16 | 22 (16) | 6 | 8 | 4 | 14 | hawk, rock, blimp | 115 s | sunset |

A level clears only on a win (no `clearScore`). minDurationMs 4000 everywhere (no run can end sooner: the first obstacle sits in the second gap and three hits need two mercies).

## Server limits and why they hold

`Bobj` = `ringChainMax(rings)` + 10 x coins + 50 x gems: every object pays once, so before the finish a score never exceeds `Bobj`. A win adds at most `WIN_BONUS_MAX` 500 (200 + 3 x 100) + 5 x floor(D - t), largest at the earliest win M. So `base = Bobj`, `maxScore >= Bobj + 500 + 5 floor(D - M)` and `pps >= (500 + 5 (D - M)) / M`. M (`PROOF_MIN_WIN_S`) is 0.8 x the fastest win of the oracle and greedy bots over 200 seeds at 30 / 60 / 144 Hz; margins maxScore +3 %, pps +4 %, rounded up.

| L | Bobj | D | fastest win | M | peak | maxScore | pps | best bot | best / max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1900 | 75 | 38.55 | 30.84 | 2620 | 2700 | 25 | 2510 | 93 % |
| 2 | 2550 | 85 | 44.08 | 35.26 | 3295 | 3400 | 22 | 3160 | 93 % |
| 3 | 3350 | 95 | 50.17 | 40.13 | 4120 | 4250 | 20 | 3940 | 93 % |
| 4 | 3820 | 100 | 52.07 | 41.65 | 4610 | 4750 | 20 | 4395 | 93 % |
| 5 | 4710 | 115 | 61.50 | 49.20 | 5535 | 5710 | 18 | 5305 | 93 % |

L5 / L1 = 2.11. Tests (`limits.a/b.test.ts` via `testing/limitProof.ts`): every oracle, greedy, idle and spam run on 200 seeds is inside its level's limits with the cap a no-op; M <= 0.8 x the fastest win; the line covers B(t) for every t >= M; best >= 90 % of maxScore; the honest (greedy, racing line only) bot clears >= 99 % (it clears all 200); idle never clears; the store-driven bots (30 / 60 / 144 Hz and random frames) agree with the pure sweep. The old limits (stamina boost, stars) are gone with the old rules.

## Look

- **Camera:** a chase eye 6.4 m behind and 2.3 m above the carpet, following 80 % of its offset in the lane (eased), turned a little into the drift, leaning (rolling) into the turns with the carpet's bank (`EyeRig roll`), its fov widening 12° on a boost (`EyeRig fov` ref).
- **Rider:** `charCarpetRider` through the auto-rig, sitting cross-legged (core `sitPose(1, pose, 1)`), swaying with a slow breath, leaning into the turns and forward on a boost, looking into the turn; arms up on the win, a flail when hit. **Carpet:** `magicCarpet` (1.9 m wide, stretched 1.35 x long), its cloth rippling (core `patchClothWave`), bobbing; a sparkle trail behind it.
- **Flyers:** the gull, bat and hawk beat their wings in the vertex shader (core `DynamicInstancedModel flap`); everything that moves swings, bobs, tumbles or banks.
- **Biomes:** each level's dressing (`decorSpots`) lines the lane and stays out of it; the floating palace waits past the glowing finish gate on every level. Night adds stars and lantern halos.

## Models

Kept from the menu1 set: `charCarpetRider`, `magicCarpet`, `flyingRing` (drawn bright gold), `floatingRockV3` (now an obstacle, tumbling), `cloud`, `palaceTower`, `desertRooftopV2`, `canyonMesa`, `hangingLantern`, `floatingPalaceR`. Removed: `star.glb` (stars are gone). Adopted from the other ready folders (copied as optimized, in `core/modelManifest.ts`, LEDGER QA OK): `m2SeaGullDiver` (gull), `m2CaveBat` (bat), `m2StormHawkBoss` (hawk), `m2BalloonBunch`, `m2AirshipBg` (a hot-air balloon), `m2SmokeBlimpBoss` (blimp), `m2TempleLantern` (sky lantern), `m2GoldCoin`, `treasureGem` (tinted per copy), `rocketBooster` (boost), `m2SkyIslandCastle`, `m2SkyIslandWaterfall`, `m2WindmillIsland`, `m2StepPyramidBg`, plus clean-city's `palm`. No kite GLB exists in the ready sets, so there are no kites.

## Known issues

- The birds' flap bends a whole Rodin mesh: a gull's legs swing a little with its wings.
- On phones the flyers' character-budget meshes (15-18k tris) are drawn only within 150 m ahead; keep an eye on the frame time on a mid phone.
