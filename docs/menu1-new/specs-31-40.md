# Menu 1 specs: games 31–40

Status: 2026-10-25. Branch `cursor/specs-menu1-31-40`. Spec only: no game code in this file.

Source: `docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md` games 31–40, the spec shape in `docs/arcade-expansion/03-game-specs-adventure.md`, the level contract in `docs/arcade-levels.md`, and `play50games-frontend/src/arcade3d/core/README.md`. Every tuning number is a starting point. The score-limit proof (arcade-score-limits skill, once per level) replaces the assumed earliest win with the oracle bot's best time and retunes `base`, `maxPointsPerSec` and `maxScore` by about 3–5 %. Keep level 5 `maxScore` ≤ 3 × level 1.

These are new games (master-plan 31–40). The 30 games already in `arcade3d/games/` stay as they are. `meta.order` is 31–40. `status: "dev"`. `orientation: "any"`. `difficulty` is in each section. `owner` is set when a build is assigned.

## How to build one

One agent, one game, one day, one folder `play50games-frontend/src/arcade3d/games/<slug>/**` plus `public/images/3d/<slug>.webp`. Level 1 is the game. Levels 2–5 are the same rules, the same controls and the same art, fed by `LEVELS` below. Read `core/README.md` and copy helpers from there. A game that needs a new core helper stops and asks Claude. It does not edit `arcade3d/core/**`, `types.ts`, `loaders.ts`, `registry.ts`, `public/models/3d/**` or `arcade-games.json`.

Runtime, same as the adventure specs:

- `GameDefinition` on GameShell. The scene ends a run with `end("win" | "lose" | "timeup")`. Shell owns countdown, pause, result panel, submit, Retry, Exit.
- One pure `createRun(seed, level)` and one `step(run, input, dt)` in `rules.ts`. Scene calls it from one `useRunFrame`. Visuals use `useGameTime()`. `dt` is play time (≤ 1/20 s).
- `randomSeed()` only in the Scene. Tests pass the seed in.
- Discrete presses read `jumpPressed` / `actionPressed` / `pressed`. Held spray, boost and brake read held `action` / `jump` / `moveY`. One action reads `tap` or `tapDown`, never both. These games use the held buttons and the axes, not canvas taps.
- Keyboard and touch share one set of timing constants (holds, stuns, i-frames, cooldowns, dead zones), counted in play-time `dt`. A coarse pointer gets no shorter hold and no longer invulnerability. Pickup radii are constants for every device.
- Fixed timers use `durationMs` on the level spec (shell clock, `"timeup"`). Penalties are stuns, lives, quality or speed. The clock never jumps, so `clockChip` stays on.
- Points games rank on win, lose and timeup. Only `end("win")` clears the level (`clearScore` omitted). Time games rank only on win (`base: 0`, `maxPointsPerSec: 0`, `display: "time"`).
- `physics` stays off. Movement, hits and scores are the pure step, so the limit proof does not depend on Rapier.
- `resultDelayMs: 900` so the cheer or the crash is on screen. `useFittedView` + `CameraRig` with `shift: true`.
- Characters listed under each game go through `<HumanoidModel>` + `useHumanoidPose` + `walkStride` / `bodyLift`. Measure landmarks from the GLB and pin the standing height (soles within 1 cm). Draw them untinted: these meshes carry a face, and a mesh tint recolours the face. Cat and bee are creatures (`<Model>` + `core/motion`), not the auto-rig.
- Ready GLBs live under `%USERPROFILE%\.play50\hyper3d\ready\` and are not in `modelManifest.ts` yet. Build against `<Model fallback>` (bevelled, two-tone). Claude's assets PR copies the GLB, adds the manifest line and the measured fit. Where a name and a `*V2` name both exist, adopt the V2 only. `<slug>/hero.glb` is an older mesh; adopt `menu1-<slug>/char*.glb`.
- Props already in core, import them, do not copy: `SHARED_ASSETS` (crate, desk, chair, coin), `REUSED_ASSETS` (door, lamp, bench, umbrella, palm, car, van), `EXPANSION_ASSETS` (cauldron, mushroom, suitcase, chest, leafyTree). `EXPANSION_ASSETS.vacuum` is a backpack. The cat's robot vacuum is `robotVacuum.glb`.
- Draw-call target is the number in each section, hard cap 150. 60 fps on the mid-phone perf profile. Pools and instancing mount with the scene (flat `geometries` across 10 Retries). Decor counts go through `useQuality()`.
- `rules.ts` exports `PROPOSED_LEVEL_LIMITS`. `meta.scoring` is level 1 and `meta.levels` repeats the five objects. Claude copies them into `arcade-games.json`.

Street vehicles (taxi, scooter, tractor) share one integrator in that game's `rules.ts`. `stepRigidBody2D` is a hovering lander (thrust along +Y). It is the wrong model for a ground vehicle; do not file a core request for a car helper.

- `yaw` 0 faces +z (same as `core/ai`). `moveY < -0.2` throttles (W and stick-up). `moveY > 0.2` brakes. Dead zone 0.2.
- `speed` integrates with accel, brake and a small drag, clamped to `[-reverse, maxSpeed]`. `yaw` changes by `moveX * steerRate * turnScale`, `turnScale = clamp(|speed| / 2, 0.35, 1)`.
- Position steps along the yaw. Run the integrator through `createFixedStep(1/120)` so 30 / 60 / 144 Hz bots match.
- Walls: `resolveSphereAabb`. Movers: `sweptAabbXZ` on the substep delta. A hit faster than the game's strike speed bounces `speed` to −0.3 of itself and spends a life. A slower hit only nudges.

On-foot games use the robot-collector mover: accel 22, brake 28, `inputToWorld(moveX, moveY, cameraYaw)`, `resolveSphereAabb`, radius in the game section. Gait phase advances by distance / `walkStride`.

Tests every game already owes, plus the ones under the game: same seed and inputs → same result; win and lose; every score event; flood-fill that every objective is reachable for 200 seeds; oracle / greedy / idle / input-spam bots through `createArcadeStore` at 30 / 60 / 144 Hz, 200 seeds, `withinServerLimits` against that level's rules; oracle reaches at least 90 % of `maxScore`; idle never clears. `definitionLevelProblems(meta, definition)` in the game's test.

### Claude gate before the folder compiles

`ARCADE_SLUGS` in `arcade3d/types.ts` lists 30 games, and `GAME_LOADERS` matches it. `ArcadeCollection` is `originals | adventure | skill`. Claude adds each slug (`status: "dev"`, `enabled: false`) to the slug list, `loaders.ts` and `arcade-games.json`, and decides the collection id. The build agent does not edit those files. Until the slug exists, the game's own vitest file imports the folder by path.

### Core gaps (all ten)

| Gap | What the game does |
|---|---|
| No wheeled-vehicle stepper | Game-local integrator above. `stepRigidBody2D` stays for landers. |
| No `sitPose` | Scooter rider and farmer: game-local hip/knee bend with `turnBone`, parented to the vehicle. If the legs stay straight through the seat, ask Claude for `sitPose`. The vehicle collision does not wait on it. |
| No room-occlusion camera | Follow `CameraRig` inside a bounds AABB. Haunted mansion does not get a camera that slides along walls. |
| No rain, hose physics or volumetric smoke | Gameplay rects. Look is `fx.smoke`, fog and a lighting preset. |
| No trailer joint | Tractor trailer is a damped point behind the hitch (`core/motion` `spring`). |
| No elevator or second floor | Bellboy floor is an integer. One corridor, signs change. |
| No per-bulb material | Traffic light is the GLB plus one emissive sphere. |
| No buoy GLB | Lifeguard alert is a two-tone torus. `rescueFloat.glb` is the carried prop. |
| Ready GLBs are outside the manifest | Fallbacks until Claude's assets PR. Names below are the files to import. |
| NPC GLBs have no measured landmarks | `civilianNpc`, `beachgoerNpc`, `travellerNpc` use `<Model>` and `waddle` / `hop`. They are not auto-rigged in this batch. |
| Face meshes | Humanoids untinted. Cat and bee may take the level tint. |

Shared ready files used below (one assets PR can land the set): `sofa.glb`, `bed.glb`, `cabinet.glb`, `woodenChair.glb`, `table.glb`, `bookshelf.glb`, `civilianNpc.glb`, `travellerNpc.glb`, `trafficLight.glb`, `trafficCone.glb`, `gardenMushroom.glb`. Also on disk and unused by these ten: `coral.glb`, `seaweed.glb`, `star.glb`, `picketFence.glb`.

---

## 31. Firefighter Rescue (`firefighter-rescue`)

**Order 31 · points · difficulty 2.** Enter one floor, put fires out, and walk one neighbour at a time to the exit sign. The plan's five buildings are five configurations of one corridor: rooms alternate left and right, 6 × 5 m, joined by a 3 m hall. A locked door is a fire sitting in that doorway. Hotel and warehouse are more rooms, night lighting and sliding debris, still one floor.

**Controls.** WASD / arrows move. Hold E or Enter to spray (`action`, 0.75 s inside 1.3 m of a fire; releasing or leaving resets the hold). Space hops (`jumpPressed`, 0.40 s). Core maps Space to jump and E / Enter to action, so the two never share a key. Touch: joystick, Action "Spray", Jump "Hop". `touchControls: ["joystick", "action", "jump"]`. Scheme `joystick`. The same 0.75 s hold, 0.40 s hop and 0.50 s debris stun run on both devices. Talking to a civilian is the same spray hold, shortened to 0.30 s, and only when a civilian is the nearest target inside 1.3 m.

**Core loop.** Read the smoke → hold spray on a fire → if a doorway clears, go through → stand by a civilian and press Spray (the same action, 0.30 s) to have them follow → walk them into the exit rect → the next civilian. One follower. A second talk does nothing while someone is following.

**rules.ts.** `createRun(seed, level)` builds the corridor, places fires, civilians, smoke discs and debris paths, and flood-fills every fire, civilian and the exit from the start. Step: on-foot mover (radius 0.38, top speed 4.6, × 0.65 inside a smoke disc), hop arc, spray hold, breath. A new hold targets the nearest fire or civilian inside 1.3 m; a hold already on a fire stays on that fire until it completes or cancels. Breath starts at 1, drains `breathDrain` per second in smoke, refills 0.25/s outside. At 0: `loseLife()`, that civilian snaps back to their chair, their clean flag dies, breath returns to 1. Civilian follow: `arrive` at 3.2 m/s, preferred gap 1.1 m. If their speed stays under 0.15 m/s for 1.2 s while you are more than 2 m away, place them on the nearest free point of the segment between you. Debris: a box on a 4 s path, 0.6 s of `fx.smoke` before it moves; a swept hit outside the hop spends a life and stuns 0.50 s. Score, all integers: +100 per fire, +150 when a civilian enters the exit, +50 if that civilian's breath never hit 0, and on win only +6 per full second left. Nothing respawns.

**End.** Win: every fire is out and every civilian is in the exit rect (`end("win")`). Lose: lives hit 0 (`end("lose")`, 3 lives). Timeup: shell clock. Partial score ranks and does not clear.

**Camera.** Follow, pitch 52°, `followFocus` over the corridor bounds, `shift: true`, look-ahead 1.5 m. Portrait yaw from `yaws`.

**HUD.** Shell score, time, lives. Stats: `Fires` (max = level), `Saved`, `Breath` 0–100. No second clock.

**Look.** Interior walls `#44403c`, floor `#292524`, ember `#f97316` on the active fire only. Lighting and background come from the level const. Firefighter 1.82 m, `charFirefighter.glb`, extinguisher on `handR` via `attach`, spray is `aimArm` forward plus `fx.smoke`. Cheer on win. Civilians: `civilianNpc.glb`, `waddle`, one `<DynamicInstancedModel>` if the mesh is one draw, otherwise five `<Model>`s (five is inside the budget).

**Hyper3D.** From `menu1-firefighter-rescue/`: `charFirefighter.glb`, `fireExtinguisher.glb`, `fireHydrant.glb`, `hoseReel.glb`, `fireTruck.glb` (parked outside the entrance on every level), `exitSignV2.glb` (leave `exitSign.glb`). Leave `firefighter-rescue/hero.glb`. Shared ready: `sofa.glb`, `bed.glb`, `cabinet.glb`, `woodenChair.glb`, `civilianNpc.glb`. Interior doors: `REUSED_ASSETS.door`. Fire and smoke are `fx`, not meshes.

**Draw calls.** About 45. Instanced furniture, one door mesh instanced, one character, civilian pool, truck and hydrant and hose as single models. Cap the proof at 70.

**Levels.** `levels.ts`:

```ts
export interface FireLevel {
   rooms: number;
   fires: number;
   civilians: number;
   smoke: number;
   blockedDoors: number;
   debris: number;
   breathDrain: number;
   durationMs: number;
   lighting: "indoor" | "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, FireLevel> = {
   1: { rooms: 2, fires: 2, civilians: 1, smoke: 1, blockedDoors: 0, debris: 0, breathDrain: 0.15, durationMs: 120_000, lighting: "indoor", background: "#292524" },
   2: { rooms: 3, fires: 4, civilians: 2, smoke: 2, blockedDoors: 1, debris: 0, breathDrain: 0.18, durationMs: 150_000, lighting: "day", background: "#44403c" },
   3: { rooms: 4, fires: 6, civilians: 3, smoke: 3, blockedDoors: 1, debris: 0, breathDrain: 0.22, durationMs: 180_000, lighting: "indoor", background: "#1c1917" },
   4: { rooms: 5, fires: 8, civilians: 4, smoke: 4, blockedDoors: 2, debris: 1, breathDrain: 0.28, durationMs: 180_000, lighting: "night", background: "#0c0a09" },
   5: { rooms: 6, fires: 10, civilians: 5, smoke: 5, blockedDoors: 2, debris: 2, breathDrain: 0.32, durationMs: 210_000, lighting: "sunset", background: "#291c14" },
};
```

Tile lines: 1 Small Apartment, "Two fires and one neighbour." 2 Family House, "A doorway stays shut until that fire is out." 3 Office, "Six fires, three people, one locked door." 4 Hotel, "Debris crosses the hall." 5 Warehouse, "Ten fires, two debris paths, thick smoke."

**Score-limit sketch.** Objective ceiling `Bobj = 100 * fires + 200 * civilians` (the +50 clean bonus is inside the 200). Speed bonus only on win: `6 * (durationS − M)`, M the assumed earliest win below. `base = Bobj`. `maxDurationMs = durationMs`. `minDurationMs = 4000` (a life can end early; the pps line rejects a full clear that fast). `unitLabel: "pts"`, `display: "int"`.

| L | title | Bobj | M (s) | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Apartment | 400 | 12 | 1048 | 400 | 60 | 1100 | 120000 |
| 2 | Family House | 800 | 22 | 1568 | 800 | 40 | 1650 | 150000 |
| 3 | Office | 1200 | 32 | 2088 | 1200 | 32 | 2200 | 180000 |
| 4 | Hotel | 1600 | 42 | 2428 | 1600 | 24 | 2550 | 180000 |
| 5 | Warehouse | 2000 | 55 | 2930 | 2000 | 20 | 3050 | 210000 |

Check: `base + pps * M ≥ peak`, and 3050 / 1100 ≤ 3. The proof replaces M with the oracle. If the real earliest win is sooner, the speed bonus grows: raise pps or lower the +6 rate until the inequality holds, and keep L5 `maxScore` ≤ 3300.

**Tests.** Breath reaching 0 resets only the active civilian. A blocked door is closed in the flood fill until its fire is out, and open after. Spray progress resets when `action` is false. Debris during the hop deals 0 lives.

**Risks.** The follower can stop in a doorway; the 1.2 s free-point rule is the fix and needs a test where a sofa blocks the gap. Five skinned civilians are five skeletons: if `char` draw calls push the frame over budget, instance a single unskinned `civilianNpc` mesh. Debris must use `sweptAabbXZ` or a fast box tunnels.

**Core gaps.** Smoke is a disc plus `fx.smoke`. Hose reel and extinguisher are meshes; the spray is not a simulated hose. No core follower: `arrive` plus the free-point rule lives in this `rules.ts`.

---

## 32. Taxi Rush 3D (`taxi-rush-3d`)

**Order 32 · points · difficulty 2.** Drive a cab on a small street grid, stop in a pad to pick up, stop in the destination pad to drop off. The grid is the whole city: blocks of buildings, 6 m streets between them. Level 1 is 2 × 2 blocks. Later levels add blocks, lights and cars. There is no taxi-driver GLB. The cab is the player.

**Controls.** WASD / arrows or the joystick: street-vehicle integrator. No Action button. A pad completes when `speed < 0.5` for 0.50 s inside it (play time, both devices). `touchControls: ["joystick"]`. Scheme `steer`. Strike speed 3 m/s. Top speed 9, accel 12, brake 18, reverse 3, steer 2.2 rad/s, radius 1.15, drag 0.4.

**Core loop.** A gold pad appears (and a `<TargetMarkers>` arrow when it is off screen) → stop in it → the rider hides and the destination pad lights → stop there → next fare. Fares after the quota do not spawn.

**rules.ts.** `blocksX`, `blocksZ`, `block` 14 m, street 6 m. Buildings are AABBs filling each block, inset 0.4 m. Pads sit on street centres, ≥ 16 m apart, never inside a building. `rides` fares, each a pair of pads. Patience starts at 1 and falls `patienceDrain` per second from the moment the fare appears; at 0 the fare is missed (`loseLife()`) and the next fare starts. Traffic: `traffic` cars on a seeded loop of street-centre waypoints, speed `trafficSpeed`, stopped while the light ahead is red. Lights: `lights` junctions, green 4.0 s / red 4.0 s, phase offset `i * 1.7` s. Running a red (crossing the stop line while red, speed > 1) spends a life. A swept hit on a car faster than 3 m/s spends a life. Score: +100 per drop-off, +60 if the stop finished within 1.2 m of the pad centre, +40 if patience was still above 0.5, and on win +5 per full second left.

**End.** Win: `rides` drop-offs. Lose: 3 lives. Timeup: shell. Partial score ranks, does not clear.

**Camera.** Chase, pitch 48°, look-ahead 3 m along velocity, `followFocus` bounds = the grid, `shift: true`.

**HUD.** Score, time, lives. Stat `Rides` and `Fare` 0–100 (the active patience). One off-screen arrow.

**Look.** Road `#334155`, sidewalk `#94a3b8`, building `#e7e5e4` / `#cbd5e1`, accent taxi yellow `#facc15`. L1 `day`, L2 `day`, L3 `sunset`, L4 `night`, L5 `sunset`. Sky dome from `core/env`. The light's bulb is a 0.15 m sphere, red `#ef4444` or green `#22c55e`, parked in front of `trafficLight.glb`. Passengers: `travellerNpc.glb` at the pad, hidden while riding, `hop` once on pickup. Untinted.

**Hyper3D.** `menu1-taxi-rush-3d/`: `taxiCab.glb` (player), `townhouseBlock.glb`, `cornerShop.glb`, `busStop.glb`. No character file, and none is required. Shared ready: `trafficLight.glb`, `trafficCone.glb`, `travellerNpc.glb`. Core: `REUSED_ASSETS.car` for the traffic pool (one `<DynamicInstancedModel>`, per-copy tint, `tinted`), `REUSED_ASSETS.lamp`, `REUSED_ASSETS.bench`. Cones mark the stop line.

**Draw calls.** About 40. Buildings instanced (two meshes), one car pool, one cab, instanced lamps and benches and cones, a handful of lights. Cap 65.

**Levels.**

```ts
export interface TaxiLevel {
   blocksX: number;
   blocksZ: number;
   rides: number;
   lights: number;
   traffic: number;
   trafficSpeed: number;
   patienceDrain: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, TaxiLevel> = {
   1: { blocksX: 2, blocksZ: 2, rides: 3, lights: 2, traffic: 2, trafficSpeed: 3.5, patienceDrain: 0.012, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { blocksX: 2, blocksZ: 3, rides: 4, lights: 3, traffic: 3, trafficSpeed: 4.0, patienceDrain: 0.014, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { blocksX: 3, blocksZ: 3, rides: 5, lights: 4, traffic: 5, trafficSpeed: 4.5, patienceDrain: 0.016, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { blocksX: 3, blocksZ: 3, rides: 6, lights: 5, traffic: 6, trafficSpeed: 5.0, patienceDrain: 0.018, durationMs: 180_000, lighting: "night", background: "#0f172a" },
   5: { blocksX: 3, blocksZ: 4, rides: 8, lights: 6, traffic: 8, trafficSpeed: 5.5, patienceDrain: 0.020, durationMs: 210_000, lighting: "sunset", background: "#7c2d12" },
};
```

Tile lines: 1 Quiet Neighborhood, "Three fares, two lights." 2 Downtown, "Longer blocks, tighter patience." 3 Shopping District, "Five fares and a busier street." 4 Night City, "Lights matter." 5 Rush Hour, "Eight fares, eight cars."

**Score-limit sketch.** `Bobj = 200 * rides` (+100 +60 +40). Speed bonus +5/s on win. Same duration columns as the firefighter table shape.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Quiet Neighborhood | 600 | 35 | 1025 | 600 | 15 | 1070 | 120000 |
| 2 | Downtown | 800 | 48 | 1310 | 800 | 13 | 1370 | 150000 |
| 3 | Shopping District | 1000 | 60 | 1600 | 1000 | 12 | 1670 | 180000 |
| 4 | Night City | 1200 | 75 | 1725 | 1200 | 10 | 1800 | 180000 |
| 5 | Rush Hour | 1600 | 100 | 2150 | 1600 | 8 | 2240 | 210000 |

`minDurationMs = 4000`. 2240 / 1070 ≤ 3.

**Tests.** A toggle of the light 1 ms before and after the stop line. Patience hits 0 exactly once per fare. No seventh fare spawns on L1 after three drop-offs. Cars never overlap a building on 200 seeds (their loop is the centreline).

**Risks.** Free steering in a 6 m street plus a 1.15 m radius is tight at corners: the building AABBs are inset and the corner is open (no pillar on the intersection). Traffic must be substepped or it tunnels the cab. Night level still draws the pad in `#facc15`; the bulb is a shape plus colour.

**Core gaps.** No driver character in the ready set, and the cab is the avatar on purpose. No traffic-light bulb inside the GLB. No street-grid helper in core (this game owns the grid; burger owns a smaller copy).

---

## 33. Burger Delivery Scooter (`burger-delivery-scooter`)

**Order 33 · points · difficulty 2.** A lighter street game than the taxi. One shop, a box on the back, a quality meter that falls when you hit things or cross a wet street. Hop the barriers. Completing the orders under the quality line does not clear the level.

**Controls.** Street-vehicle integrator. Top speed 11, accel 14, brake 16, reverse 2.5, steer 2.6 rad/s, radius 0.55, drag 0.35. `jumpPressed` hops for 0.40 s. During the middle 0.20 s a `roadBarrier` overlap is ignored. The hop does not change quality. Pad rule: `speed < 0.5` for 0.45 s, same on key and touch. `touchControls: ["joystick", "jump"]`, Jump label "Hop". Scheme `steer`.

**Core loop.** Stop at the counter → quality becomes 100 and a door pad lights → ride → stop in the pad before quality hits 0 → next order. The shop is fixed. Doors are pads on the street, not interiors.

**rules.ts.** Grid `blocksX × blocksZ`, block 12 m, street 6 m, one `burgerShop` block that is the counter. `orders` door pads, ≥ 14 m from the shop and each other. Quality starts at 100 when the order is accepted and falls by 12 on a strike-speed hit (barrier at any speed, car above 3 m/s) and by `wetDrain` per second inside a wet rect. At 0: miss, `loseLife()`, quality returns to 100, the same door stays (one slot, one score). Score on a delivery with quality > 0: `floor(quality)` plus 40 if the order clock (25 s of play time from accept) has not finished. Win score uses each slot once. Average is the mean of the successful delivery qualities. On win, +4 per full second left.

**End.** Win: `orders` successes and average ≥ `qualityMin`. Lose: 3 misses. Timeup with a short quota, or a full quota under `qualityMin`, is `end("lose")` when lives are already 0, otherwise `end("timeup")` if the clock ends first. A finished quota under the average ends `end("lose")` immediately so the player sees the miss. Partial score ranks. Only the win clears.

**Camera.** Chase, pitch 50°, look-ahead 2.5 m, `shift: true`.

**HUD.** Score, time, lives. Stats: `Orders`, `Quality` 0–100.

**Look.** Road `#475569`, shop trim `#fb7185`, bag `#fbbf24`. L1–L3 `day` / `sunset`, L4 wet streets and closer fog, L5 `night`. Rider: `charScooterRider.glb`, 1.70 m standing height, parented to `deliveryScooter.glb`, game-local seated pose (`turnBone` on hips and knees, hands on the bars with `aimArm`). The scooter is the collision body. Box: `deliveryBoxV2.glb` on the rear rack. A hop uses a 0.15 m visual lift; the rider pose stays seated.

**Hyper3D.** `menu1-burger-delivery-scooter/`: `charScooterRider.glb`, `deliveryScooter.glb`, `deliveryBoxV2.glb` (leave `deliveryBox.glb`), `burgerBag.glb`, `foodBoxV2.glb` (leave `foodBox.glb`), `restaurantCounter.glb`, `burgerShop.glb`, `roadBarrier.glb`. Leave `burger-delivery-scooter/hero.glb`. Shared ready: `trafficCone.glb`. Core: `REUSED_ASSETS.car` (parked, instanced, tinted), `lamp`, `bench`. Bags and food boxes are the counter dressing, instanced.

**Draw calls.** About 40. Cap 60.

**Levels.**

```ts
export interface BurgerLevel {
   blocksX: number;
   blocksZ: number;
   orders: number;
   barriers: number;
   traffic: number;
   wet: boolean;
   wetDrain: number;
   qualityMin: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, BurgerLevel> = {
   1: { blocksX: 2, blocksZ: 2, orders: 3, barriers: 2, traffic: 0, wet: false, wetDrain: 0, qualityMin: 80, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { blocksX: 2, blocksZ: 3, orders: 4, barriers: 4, traffic: 2, wet: false, wetDrain: 0, qualityMin: 80, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { blocksX: 3, blocksZ: 2, orders: 5, barriers: 6, traffic: 3, wet: false, wetDrain: 0, qualityMin: 75, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { blocksX: 3, blocksZ: 3, orders: 6, barriers: 6, traffic: 4, wet: true, wetDrain: 4, qualityMin: 70, durationMs: 180_000, lighting: "sunset", background: "#57534e" },
   5: { blocksX: 3, blocksZ: 3, orders: 8, barriers: 8, traffic: 6, wet: true, wetDrain: 5, qualityMin: 70, durationMs: 210_000, lighting: "night", background: "#0f172a" },
};
```

Tile lines: 1 Neighborhood, "Three drops, wide streets, keep quality at 80." 2 City Center, "Tighter corners and two cars." 3 Park District, "Hop the barriers." 4 Rainy City, "Wet streets pull quality down." 5 Night Delivery, "Eight orders, quality still 70."

**Score-limit sketch.** `Bobj = 140 * orders` (quality 100 + on-time 40). Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Neighborhood | 420 | 30 | 780 | 420 | 14 | 820 | 120000 |
| 2 | City Center | 560 | 42 | 992 | 560 | 13 | 1040 | 150000 |
| 3 | Park District | 700 | 55 | 1200 | 700 | 12 | 1250 | 180000 |
| 4 | Rainy City | 840 | 70 | 1280 | 840 | 9 | 1340 | 180000 |
| 5 | Night Delivery | 1120 | 90 | 1600 | 1120 | 8 | 1670 | 210000 |

`minDurationMs = 4000`. A retried slot scores once: the bot proof includes a retry and checks the slot did not pay twice.

**Tests.** Quality never leaves 0–100. A hop through a barrier costs 0 quality. Average uses successes only. Win fails when the average is one point under `qualityMin`.

**Risks.** The seated pose is the look risk (core gap). Wet rects must be visible (darker road patch), and they must not cover the shop pad or a door pad (generator rule). Parked cars are outside the street AABB.

**Core gaps.** `sitPose` (see the table). Rain is a wet rect and fog, not a particle system. No shared street helper with the taxi.

---

## 34. Beach Lifeguard (`beach-lifeguard`)

**Order 34 · points · difficulty 2.** A sand strip and a flat swim zone. Alerts pop in the water; you run, slow down in the water, grab, and bring them back to the dry sand. The jet ski is a speed pad with a mesh, on later levels only.

**Controls.** On-foot mover, radius 0.38, top speed 5.0 on sand and × 0.62 when `z < 0` (the shoreline). Grab is `actionPressed` within 1.2 m of the active swimmer. One grab at a time. Touch: joystick, Action "Grab". `touchControls: ["joystick", "action"]`. Scheme `joystick`. No jump. Water speed and the grab are the same constants on both devices.

**Core loop.** The tower is home. An alert rings (`playSfx("alarm")`) and a torus marks the swimmer → reach them and grab → walk back until `z ≥ 2` (safe sand) → the rescue counts → next alert. Alerts do not overlap.

**rules.ts.** Beach is one rectangle, width `width`, sand depth 14 m (`z` 0 to 14), water depth `water` (`z` 0 to −water). Start at the tower, `z = 8`. Swimmers spawn with `z` in `[−water + 2, −3]`, ≥ 6 m from each other in x, never inside a prop. Alert timer `alertS`. Expiry: `loseLife()`, swimmer and float reset, next alert. Carrying: speed × 0.85, float shown on `handR`. Score: +180 when they reach safe sand, +70 if the alert clock was still above half, and on win +5 per full second left. `rescues` alerts, no extras.

**End.** Win: `rescues` saved. Lose: 3 expired alerts. Timeup: shell.

**Camera.** Follow, pitch 50°, bounds the beach rect, `shift: true`. High enough that the next torus is visible before the arrow is needed. `<TargetMarkers>` for the active swimmer and, while carrying, for a point on the safe line.

**HUD.** Score, time, lives. Stats: `Saved`, `Alert` 0–100.

**Look.** Sand `#f2d7a6`, wet sand `#e7c98a`, water from `<Water>` (visual only; the rule is the z plane), accent `#fb7185`. L1–L3 `day`, L4 `sunset`, L5 `sunset` with fog nearer (storm). Lifeguard 1.82 m, `charLifeguard.glb`, `rescueFloat.glb` on `handR` while carrying and on the tower while not. Swimmers: `beachgoerNpc.glb`, bobbing with `hover`, hidden while carried. Jet ski: overlap plus `actionPressed` while not carrying mounts it; speed becomes 8.5 and `z` is clamped to the water; touching `z ≥ 0` dismounts. Mount is off unless `jetSki` is true.

**Hyper3D.** `menu1-beach-lifeguard/`: `charLifeguard.glb`, `lifeguardTower.glb`, `rescueFloat.glb`, `beachChair.glb`, `beachCooler.glb`, `beachgoerNpc.glb`, `beachHut.glb`, `sandcastle.glb`, `surfboardV2.glb` (leave `surfboard.glb`), `rescueJetSki.glb`. Leave `beach-lifeguard/hero.glb`. Core: `REUSED_ASSETS.umbrella`, `palm`. Chairs, boards, huts and umbrellas are instanced on the sand, outside the spawn x of every swimmer path (a straight line in z from the swimmer to the tower). The alert marker is a code torus, two-tone `#fb7185` / `#f8fafc`. No buoy file on disk.

**Draw calls.** About 35 plus one water. Cap 55.

**Levels.**

```ts
export interface BeachLevel {
   width: number;
   water: number;
   rescues: number;
   alertS: number;
   jetSki: boolean;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, BeachLevel> = {
   1: { width: 24, water: 12, rescues: 2, alertS: 40, jetSki: false, durationMs: 120_000, lighting: "day", background: "#7dd3fc", fogFar: 80 },
   2: { width: 32, water: 16, rescues: 3, alertS: 34, jetSki: false, durationMs: 150_000, lighting: "day", background: "#38bdf8", fogFar: 80 },
   3: { width: 40, water: 18, rescues: 4, alertS: 30, jetSki: false, durationMs: 180_000, lighting: "day", background: "#0ea5e9", fogFar: 70 },
   4: { width: 44, water: 20, rescues: 5, alertS: 28, jetSki: true, durationMs: 180_000, lighting: "sunset", background: "#fb923c", fogFar: 55 },
   5: { width: 48, water: 22, rescues: 6, alertS: 24, jetSki: true, durationMs: 210_000, lighting: "sunset", background: "#44403c", fogFar: 42 },
};
```

Tile lines: 1 Small Beach, "Two swimmers, a short swim." 2 Busy Beach, "Farther out." 3 Resort, "Four alerts, more chairs to run around." 4 Waterpark, "The jet ski is in the water." 5 Stormy Beach, "Six alerts, short clocks, low fog." Props stay on the sand on every level. L3 only adds chairs; it does not add a new map.

**Score-limit sketch.** `Bobj = 250 * rescues`. Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Beach | 500 | 25 | 975 | 500 | 21 | 1020 | 120000 |
| 2 | Busy Beach | 750 | 40 | 1300 | 750 | 16 | 1360 | 150000 |
| 3 | Resort | 1000 | 55 | 1625 | 1000 | 14 | 1690 | 180000 |
| 4 | Waterpark | 1250 | 70 | 1800 | 1250 | 10 | 1880 | 180000 |
| 5 | Stormy Beach | 1500 | 90 | 2100 | 1500 | 9 | 2190 | 210000 |

`minDurationMs = 4000`. The jet ski raises speed, which can only make M smaller: the proof uses the jet-ski bot on L4 and L5. 2190 / 1020 ≤ 3.

**Tests.** Grab range at 1.20 and 1.21 m. Water speed is exactly 0.62, including the frame you cross `z = 0`. An expired alert does not also score. Jet ski cannot mount on L1 (`jetSki: false`). Spawn points leave a straight sand corridor to the tower.

**Risks.** Swim is a speed change on a plane. A player who expects a dive will not get one; the torus and the slower gait sell it. Props must not sit on the return line (test: the segment from every swimmer to `(x, 2)` is free of AABBs).

**Core gaps.** No buoy GLB (code torus). No swimming volume. Storm is fog and `sunset`, not rain. `beachgoerNpc.glb` is unrigged.

---

## 35. Farm Tractor Challenge (`farm-tractor-challenge`)

**Order 35 · points · difficulty 2.** Drive the tractor, roll slowly into a hay bale to hitch it, and park in the barn bay. The trailer is a visual follower, not a joint. Orchard crates use the same hitch rule as hay. Mud is a slow rect.

**Controls.** Street-vehicle integrator with tractor numbers: top speed 6, accel 6, brake 10, reverse 2, steer 1.4 rad/s, radius 1.35, drag 0.8. Hitch when the tractor circle overlaps a free bale and `speed < 2`. A bale overlap at `speed ≥ 2` is a bump: the bale stays, `loseLife()`. Fence and gate posts bump at any speed above 0.8. `touchControls: ["joystick"]`. Scheme `steer`. Parking is `speed < 0.4` for 0.60 s inside the bay, play time, both devices.

**Core loop.** Bales for this trip are the ones with the trip's tint ring → hitch up to `balesPerTrip` (they snap into trailer slots) → drive through the gate → stop in the barn bay → the trip scores and the next bales arm. The gate is a gap; `farmGate.glb` is the posts on either side.

**rules.ts.** Field `width × depth`. Barn at the north edge, start at the south. Fence ring is the boundary. `trips` groups of `balesPerTrip` bales, placed ≥ 4 m apart on soil, never in mud, never in the bay. Trailer position is a `spring` toward a point 2.4 m behind the hitch. Slots are offsets on that point. Mud rects (`mud`) multiply accel and top speed by 0.55 while the tractor circle overlaps them. Score: +200 when a trip's bales are all in the bay and the park hold completes, +100 if that trip took no bump, and on win +4 per full second left. Lives are the bump budget (`lives` on the level spec).

**End.** Win: every trip parked. Lose: lives hit 0. Timeup: shell.

**Camera.** Chase, pitch 46°, look-ahead 3.5 m (the trailer must stay in frame), bounds the field, `shift: true`.

**HUD.** Score, time, lives (bumps left). Stat `Trips`.

**Look.** Grass `#84cc16`, soil `#a16207`, mud `#57534e`, barn `#b45309`, accent `#eab308`. L1–L2 `day`, L3 `sunset`, L4 `day` with grey fog, L5 `sunset`. Farmer: `charFarmer.glb`, 1.78 m, seated on `tractor.glb` with the same game-local sit as the scooter. The tractor is the collision. Trailer: `farmTrailer.glb` at the spring point. Scarecrow and trough and silo are decor outside the drivable soil. L3 swaps the hitch mesh to `appleCrate.glb` (same radius). Trees: `EXPANSION_ASSETS.leafyTree`, instanced, and they are solid AABBs.

**Hyper3D.** `menu1-farm-tractor-challenge/`: `charFarmer.glb`, `tractor.glb`, `farmTrailer.glb`, `hayBale.glb`, `appleCrate.glb`, `barn.glb`, `farmFence.glb`, `farmGate.glb`, `scarecrow.glb`, `grainSilo.glb`, `waterTrough.glb`. Leave `farm-tractor-challenge/hero.glb`. Fence pieces are `<InstancedModel>` along the boundary. Core crate is an extra prop by the barn, not the hitch object.

**Draw calls.** About 30. Cap 50. Hay is one dynamic pool (hidden once slotted, then shown on the trailer by the same pool).

**Levels.**

```ts
export interface FarmLevel {
   width: number;
   depth: number;
   trips: number;
   balesPerTrip: number;
   mud: number;
   trees: number;
   cargo: "hay" | "crate";
   durationMs: number;
   lives: number;
   lighting: "day" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, FarmLevel> = {
   1: { width: 28, depth: 22, trips: 2, balesPerTrip: 1, mud: 0, trees: 0, cargo: "hay", durationMs: 120_000, lives: 6, lighting: "day", background: "#bae6fd" },
   2: { width: 34, depth: 26, trips: 3, balesPerTrip: 2, mud: 0, trees: 0, cargo: "hay", durationMs: 150_000, lives: 6, lighting: "day", background: "#86efac" },
   3: { width: 36, depth: 28, trips: 4, balesPerTrip: 2, mud: 0, trees: 6, cargo: "crate", durationMs: 180_000, lives: 5, lighting: "sunset", background: "#fdba74" },
   4: { width: 40, depth: 30, trips: 5, balesPerTrip: 2, mud: 3, trees: 0, cargo: "hay", durationMs: 180_000, lives: 4, lighting: "day", background: "#a8a29e" },
   5: { width: 44, depth: 32, trips: 6, balesPerTrip: 2, mud: 4, trees: 8, cargo: "hay", durationMs: 210_000, lives: 4, lighting: "sunset", background: "#b45309" },
};
```

Tile lines: 1 Farm Yard, "Two bales, a wide yard." 2 Wheat Field, "Two bales on the trailer." 3 Orchard, "Crates, and the trees are solid." 4 Mud Farm, "Mud cuts speed, fewer bumps allowed." 5 Mega Farm, "Six trips, mud and trees." L2 is the first level with two slots. The hitch rule does not change.

**Score-limit sketch.** `Bobj = 300 * trips`. Speed bonus +4/s on win. Bumps add no points.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Farm Yard | 600 | 30 | 960 | 600 | 14 | 1000 | 120000 |
| 2 | Wheat Field | 900 | 42 | 1332 | 900 | 13 | 1390 | 150000 |
| 3 | Orchard | 1200 | 55 | 1700 | 1200 | 12 | 1770 | 180000 |
| 4 | Mud Farm | 1500 | 70 | 1940 | 1500 | 9 | 2020 | 180000 |
| 5 | Mega Farm | 1800 | 90 | 2280 | 1800 | 8 | 2380 | 210000 |

`minDurationMs = 4000`. Lives change per level (`lives` on the spec). 2380 / 1000 ≤ 3.

**Tests.** A bale at speed 1.9 hitches and at 2.0 bumps. Slots never exceed `balesPerTrip`. Mud does not contain a bale or the bay (200 seeds). The trailer spring does not move the tractor.

**Risks.** A physics trailer will eat the day and the proof. Keep the spring. Two-bale trips need slots that do not intersect the tractor mesh (place them behind the hitch, test distances). The seated farmer is the same `sitPose` gap as the scooter.

**Core gaps.** No trailer joint. No `sitPose`. Fence GLB replaces `core/kit` `<Fence>` for the look; the kit fence is an acceptable fallback if the GLB is still missing.

---

## 36. Cat vs Robot Vacuum (`cat-vs-robot-vacuum`)

**Order 36 · points · difficulty 1.** One cat, one floor, treats on the ground, robot vacuums that patrol and then chase. Furniture blocks the vacuum's sight and its body. The cat walks through the gaps. A hop is a short i-frame, not a climb.

**Controls.** On-foot mover, radius 0.28, top speed 4.2. `jumpPressed` hops 0.45 s and the vacuum overlap is ignored for those 0.45 s. Treats collect on overlap. No Action button. `touchControls: ["joystick", "jump"]`. Scheme `joystick`. Hop length, i-frames and the 0.80 s mercy after a hit are one set of constants.

**Core loop.** Gather the treats (the vacuum is on a visible path) → on later levels break its sight with the sofa → hop if it is on you → with the quota collected, stand on the bed pad to finish.

**rules.ts.** Rooms: `rooms` along one hall, same generator shape as the firefighter (one floor). Treats: `treats` spots on the floor, ≥ 1.5 m apart, not inside furniture. Toys: `toys` spots worth the same +20 extra, fixed count. Home pad is the bed in room 0. Vacuums: `vacuums` agents on a closed hall path, `stepPatrol` at `patrolSpeed`. On L1 `chaseRange` is 0 (patrol only). Later, if the cat is inside `chaseRange` and `hasLineOfSightXZ` past furniture boxes, `investigate` and seek at `chaseSpeed` for at most 4 s, then back to the path. Furniture blocks the vacuum circle. `clutter` small boxes (L4+) block the cat too. Overlap while not invulnerable: `loseLife()`, cat returns to the bed, vacuum returns to the path, 0.80 s mercy. Treats already taken stay taken. Score: +30 per treat, +5 extra per step of a streak when the next treat is within 4.0 s, streak bonus capped at +15, +20 per toy, and on win +4 per full second left. Win requires the quota and the home pad. Toys are bonus, not quota.

**End.** Win: every treat collected and the cat on the bed. Lose: 3 lives. Timeup: shell.

**Camera.** Follow, pitch 55°, bounds the floor, `shift: true`. Treats read from above; the pitch stays high on every level.

**HUD.** Score, time, lives. Stat `Treats`.

**Look.** Floor `#e7e5e4`, wall `#d6d3d1`, accent `#fb923c`. One cat tint per level (the mesh is a creature): L1 `#fb923c`, L2 `#9ca3af`, L3 `#57534e`, L4 `#fde68a`, L5 `#c4b5fd`. `<Model tint>`. Vacuum `#94a3b8` with a small emissive strip so it reads at a glance. L1 `day`, L2 `indoor`, L3 `indoor`, L4 `day`, L5 `night`. Vacuum loop: `startLoop("vacuum")`, pitch with its speed.

**Hyper3D.** `menu1-cat-vs-robot-vacuum/`: `cat.glb`, `robotVacuum.glb`, `catTreat.glb`, `catToy.glb`, `catBox.glb`, `catTree.glb`. No `hero.glb`. Shared ready: `sofa.glb`, `bed.glb`, `table.glb`, `woodenChair.glb`, `bookshelf.glb` (the shelf). Do not use `EXPANSION_ASSETS.vacuum` (that is a backpack). Treats are one dynamic pool. Furniture is instanced.

**Draw calls.** About 25. Cap 45. The cat is one unskinned model with `hop` / `waddle` from `core/motion`. It does not go through the auto-rig.

**Levels.**

```ts
export interface CatLevel {
   rooms: number;
   treats: number;
   toys: number;
   vacuums: number;
   patrolSpeed: number;
   chaseSpeed: number;
   chaseRange: number;
   clutter: number;
   tint: string;
   durationMs: number;
   lighting: "day" | "indoor" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, CatLevel> = {
   1: { rooms: 2, treats: 8, toys: 1, vacuums: 1, patrolSpeed: 1.4, chaseSpeed: 0, chaseRange: 0, clutter: 0, tint: "#fb923c", durationMs: 90_000, lighting: "day", background: "#fde68a" },
   2: { rooms: 3, treats: 12, toys: 1, vacuums: 1, patrolSpeed: 1.8, chaseSpeed: 2.4, chaseRange: 6, clutter: 0, tint: "#9ca3af", durationMs: 120_000, lighting: "indoor", background: "#e7e5e4" },
   3: { rooms: 4, treats: 16, toys: 2, vacuums: 2, patrolSpeed: 1.8, chaseSpeed: 2.6, chaseRange: 7, clutter: 0, tint: "#57534e", durationMs: 150_000, lighting: "indoor", background: "#d6d3d1" },
   4: { rooms: 5, treats: 20, toys: 2, vacuums: 2, patrolSpeed: 2.1, chaseSpeed: 3.0, chaseRange: 8, clutter: 4, tint: "#fde68a", durationMs: 150_000, lighting: "day", background: "#fbcfe8" },
   5: { rooms: 6, treats: 25, toys: 3, vacuums: 3, patrolSpeed: 2.2, chaseSpeed: 3.2, chaseRange: 8, clutter: 6, tint: "#c4b5fd", durationMs: 180_000, lighting: "night", background: "#1e1b4b" },
};
```

Tile lines: 1 Living Room, "Eight treats, one vacuum on a path." 2 Kitchen, "It can see you." 3 Bedroom, "Two vacuums." 4 Kids Room, "Boxes block you too." 5 Whole House, "Three vacuums, one floor."

**Score-limit sketch.** Treat ceiling is 45 each (30 + 15 streak). `Bobj = 45 * treats + 20 * toys`. Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Living Room | 380 | 18 | 668 | 380 | 18 | 700 | 90000 |
| 2 | Kitchen | 560 | 28 | 928 | 560 | 16 | 970 | 120000 |
| 3 | Bedroom | 760 | 40 | 1200 | 760 | 14 | 1250 | 150000 |
| 4 | Kids Room | 940 | 50 | 1340 | 940 | 10 | 1400 | 150000 |
| 5 | Whole House | 1185 | 65 | 1645 | 1185 | 9 | 1720 | 180000 |

`minDurationMs = 4000`. Lives 3 on every level. 1720 / 700 ≤ 3. The streak test uses a 4.0 s gap and a 4.01 s gap.

**Tests.** L1 chase range 0: a cat standing still off the path never gets hit. Sight is false when a sofa AABB cuts the segment. Hop overlap deals 0. Clutter blocks the cat and the vacuum. Home pad without the quota does not win.

**Risks.** A chase vacuum in a narrow hall can pin the cat. Furniture gaps are at least 1.2 m (generator test) so the 0.28 radius always has a way past. Three vacuums on L5 stay one instanced mesh.

**Core gaps.** The cat is not a humanoid; do not auto-rig `cat.glb`. Five "skins" are the five tints above, not a character menu (core has no skin picker). No jump-onto-mesh helper: the hop is an i-frame timer.

---

## 37. Hotel Bellboy Rush (`hotel-bellboy-rush`)

**Order 37 · points · difficulty 2.** One lobby corridor. Room doors line one wall. The elevator is a pad that changes which floor those doors are wearing. You push a trolley, and the suitcase on it is the core suitcase mesh.

**Controls.** On-foot mover, radius 0.4, top speed 4.0, × 0.85 while a bag is on the trolley. `actionPressed` within 1.3 m: take the next bag at the desk, call the elevator, or try the door you are facing. `touchControls: ["joystick", "action"]`, Action "Use". Scheme `joystick`. Elevator ride locks movement for 1.00 s of play time. That second is the same on key and button.

**Core loop.** Read the key card on the desk (a floor and a door index) → take the bag → if the door's floor is not the current floor, stand on the elevator pad and Use → when the signs flip, Use the matching door. Wrong door: the bag stays, `loseLife()`, 0.40 s stun.

**rules.ts.** Corridor 4 m wide and `doors * 3.2 + 6` m long. `doors` room doors on one side. `floors` is 1 on L1 (the elevator pad is dark and Use on it does nothing). From L2, Use on the pad spends 1.00 s and sets `floor` to the bag's floor (the only destination; you do not pick a floor). Door labels are `floor * 100 + index`, drawn with `useCanvasTexture`, redrawn when `floor` changes. Each bag is `{ floor, index }`, a solvable pair within `floors` and `doors`. One bag on the trolley. Score: +80 when the matching door takes the bag, +40 if that bag's 30 s clock is still above half, and on win +5 per full second left. Slots score once.

**End.** Win: `bags` correct deliveries. Lose: 3 wrong doors. Timeup: shell.

**Camera.** Follow, pitch 50°, bounds the corridor, `shift: true`. A fixed view of a long L5 corridor would shrink the door numbers below a readable size, so the camera follows even on L1.

**HUD.** Score, time, lives. Stats: `Bags`, `Floor`. The key card's number is also on the trolley as a small canvas plane (colour plus the digits).

**Look.** Walls `#44403c`, carpet `#7f1d1d`, brass `#d4a574`, accent `#fbbf24`. Lighting `indoor` on L1–L3, `sunset` on L4, `night` on L5. Bellboy 1.74 m, `charBellboy.glb`, `carryPose` while a bag is loaded, arms toward the trolley handle with `aimArm`. Trolley follows 1.1 m behind (same spring as the farm trailer, shorter). Suitcase sits on the trolley only while a bag is loaded. Guests: `travellerNpc.glb` by two doors, decor, unrigged, untinted.

**Hyper3D.** `menu1-hotel-bellboy-rush/`: `charBellboy.glb`, `bellboyTrolley.glb`, `elevatorDoorV2.glb` (leave `elevatorDoor.glb`), `hotelRoomDoor.glb`, `keyCard.glb`, `receptionDesk.glb`, `serviceBellV2.glb` (leave `serviceBell.glb`), `lobbyPlanter.glb`. Leave `hotel-bellboy-rush/hero.glb`. Core: `EXPANSION_ASSETS.suitcase` on the trolley. Shared ready: `sofa.glb`, `travellerNpc.glb`. Doors are one `<InstancedModel>` (the label plane is a second instanced card).

**Draw calls.** About 30. Cap 45.

**Levels.**

```ts
export interface HotelLevel {
   doors: number;
   floors: number;
   bags: number;
   durationMs: number;
   lighting: "indoor" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, HotelLevel> = {
   1: { doors: 4, floors: 1, bags: 3, durationMs: 120_000, lighting: "indoor", background: "#44403c" },
   2: { doors: 4, floors: 3, bags: 5, durationMs: 150_000, lighting: "indoor", background: "#44403c" },
   3: { doors: 5, floors: 3, bags: 7, durationMs: 180_000, lighting: "indoor", background: "#3f3f46" },
   4: { doors: 5, floors: 3, bags: 9, durationMs: 180_000, lighting: "sunset", background: "#292524" },
   5: { doors: 6, floors: 4, bags: 12, durationMs: 210_000, lighting: "night", background: "#1c1917" },
};
```

Tile lines: 1 Lobby Floor, "Three bags, the doors you can already see." 2 3-Floor Hotel, "The elevator changes the numbers." 3 Luxury Hotel, "Three floors, seven bags." 4 Business Hotel, "Same hall, a shorter clock." 5 Grand Hotel, "Twelve bags, four floors, one corridor."

**Score-limit sketch.** `Bobj = 120 * bags`. Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Lobby Floor | 360 | 28 | 820 | 360 | 18 | 860 | 120000 |
| 2 | 3-Floor Hotel | 600 | 45 | 1125 | 600 | 14 | 1170 | 150000 |
| 3 | Luxury Hotel | 840 | 60 | 1440 | 840 | 12 | 1500 | 180000 |
| 4 | Business Hotel | 1080 | 80 | 1580 | 1080 | 8 | 1650 | 180000 |
| 5 | Grand Hotel | 1440 | 110 | 1940 | 1440 | 6 | 2020 | 210000 |

`minDurationMs = 4000`. The 1.00 s ride is inside M. 2020 / 860 ≤ 3. Wrong-door spam adds no points (test).

**Tests.** L1 elevator Use does not change `floor`. A bag for floor 2 cannot score while `floor` is 1. After 1.00 s the label texture matches `floor`. The trolley spring does not push the bellboy through a door.

**Risks.** Players will look for stairs. The elevator lock and the number swap have to read in the first second (the doors' canvas digits are at least 0.4 m tall). L5's twelve bags on a 30 s personal clock is the pressure; the corridor length stays walkable (`doors * 3.2`).

**Core gaps.** No elevator actor and no second storey. Canvas digits are the floor. No `sitPose` involved: the bellboy walks.

---

## 38. Wizard Potion Lab (`wizard-potion-lab`)

**Order 38 · points · difficulty 2.** One round lab, a cauldron in the middle, ingredients on the shelves. You carry one thing at a time and add it only if it is the next step of a recipe. Later levels open a second recipe at the same time.

**Controls.** On-foot mover, radius 0.36, top speed 4.4. `actionPressed` within 1.2 m picks a shelf item up or, at the cauldron, tries to add what you carry. Putting down on the same shelf spot is the same button when you are closer to the shelf than to the cauldron. `touchControls: ["joystick", "action"]`, Action "Use". Scheme `joystick`. Wrong-add stun is 0.60 s, both devices. No jump.

**Core loop.** The HUD shows the next ingredient of each open recipe → pick that mesh up → stand at the cauldron and Use → the step clears, a puff plays, the next step lights. A wrong mesh stuns and returns to its shelf.

**rules.ts.** Lab radius `radius`. Shelf spots around the wall, one per ingredient type in play. Types, in order, mapped to meshes: mushroom, crystal, berry, flower, herb, bottle. A recipe is a seeded list of `steps` types, with no two identical types in a row. L1–L4: one list. L5 (`dual: true`): two lists; the cauldron accepts the carried item when it matches the head of either list. `recipes` lists, each of length `steps`. Carrying one. Wrong add: stun 0.60 s, item back to its spot, and `loseLife()` when `wrongCostsLife` is set. L3+ sets `wander` on one spot: that ingredient moves on a 3 m path and the pickup radius follows it. Score: +300 per finished recipe, +80 if that recipe took no wrong add, and on win +4 per full second left. A wrong add never scores.

**End.** Win: every recipe finished. Lose: lives hit 0, and only on levels with `wrongCostsLife` (L1 has no lives; a wrong add only stuns). Timeup: shell.

**Camera.** Follow, pitch 52°, bounds a square around the lab, `shift: true`. The cauldron stays near the middle of the shot.

**HUD.** Score and time. Lives from L2. A game `Hud` (marked `data-arcade-safe-area`) shows up to two rows of the remaining steps as coloured shapes (circle, square, triangle, diamond, star, drop), not colour alone. Stat `Carried` can stay off if the HUD row shows it.

**Look.** Floor `#312e81`, shelves `#44403c`, cauldron glow `#a78bfa`, accent `#c4b5fd`. L1 `indoor`, L2 `indoor`, L3 `night`, L4 `sunset`, L5 `night`. Wizard 1.70 m, `charWizard.glb`, untinted, `reachPose` replaced by a forward `aimArm` while adding to the pot. Cauldron: `EXPANSION_ASSETS.cauldron` (already measured, `CAULDRON_INNER_RADIUS_GLB`). A flat disc at the inner floor changes colour to the last accepted ingredient. `startLoop("bubbling")` while a recipe is open.

**Hyper3D.** `menu1-wizard-potion-lab/`: `charWizard.glb`, `alchemyTable.glb` (against the wall), `magicCrystal.glb`, `berryBunch.glb`, `magicFlower.glb`, `herbBundle.glb`, `potionBottle.glb`, `spellBook.glb` (on the table, decor), `candle.glb` (instanced), `crystalBall.glb` (decor on the table). Leave `wizard-potion-lab/hero.glb`. Mushroom: adopt `shared/gardenMushroom.glb`; until that PR, `EXPANSION_ASSETS.mushroom` is the fallback already in the manifest. Shelf: `shared/bookshelf.glb`, instanced. There is no cauldron in the wizard ready folder; use the core cauldron.

**Draw calls.** About 30. Cap 45. Ingredient types are six models, a few copies each, instanced per type.

**Levels.**

```ts
export interface WizardLevel {
   radius: number;
   recipes: number;
   steps: number;
   dual: boolean;
   wander: boolean;
   wrongCostsLife: boolean;
   durationMs: number;
   lives?: number;
   lighting: "indoor" | "night" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, WizardLevel> = {
   1: { radius: 7, recipes: 2, steps: 2, dual: false, wander: false, wrongCostsLife: false, durationMs: 120_000, lighting: "indoor", background: "#1e1b4b" },
   2: { radius: 8, recipes: 3, steps: 3, dual: false, wander: false, wrongCostsLife: true, durationMs: 150_000, lives: 3, lighting: "indoor", background: "#1e1b4b" },
   3: { radius: 9, recipes: 4, steps: 4, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "night", background: "#172554" },
   4: { radius: 10, recipes: 5, steps: 5, dual: false, wander: true, wrongCostsLife: true, durationMs: 180_000, lives: 3, lighting: "sunset", background: "#3b0764" },
   5: { radius: 11, recipes: 6, steps: 5, dual: true, wander: true, wrongCostsLife: true, durationMs: 210_000, lives: 3, lighting: "night", background: "#1e1b4b" },
};
```

Step counts follow the plan (2, 3, 4, 5, 5). Six shelf types, and a recipe may repeat a type when the two picks are not neighbours. Score is per finished recipe, so a longer list changes the earliest win, not the objective ceiling. Tile lines: 1 Beginner Lab, "Two short recipes." 2 Mushroom Lab, "A wrong bottle costs a life." 3 Crystal Lab, "One ingredient slides along the shelf." 4 Forest Lab, "Longer recipes, same room." 5 Master Wizard Lab, "Two recipes at once."

**Score-limit sketch.** `Bobj = 380 * recipes`. Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Beginner Lab | 760 | 28 | 1128 | 760 | 16 | 1180 | 120000 |
| 2 | Mushroom Lab | 1140 | 42 | 1572 | 1140 | 12 | 1640 | 150000 |
| 3 | Crystal Lab | 1520 | 55 | 2020 | 1520 | 11 | 2110 | 180000 |
| 4 | Forest Lab | 1900 | 75 | 2320 | 1900 | 8 | 2420 | 180000 |
| 5 | Master Wizard Lab | 2280 | 100 | 2720 | 2280 | 6 | 2830 | 210000 |

`minDurationMs = 4000` on L2–L5. L1 cannot `end("lose")`; its earliest end is the win or the clock, and `minDurationMs` stays 4000 so a fast win still submits. 2830 / 1180 ≤ 3.

**Tests.** The cauldron refuses an item that is not a current head, including on `dual` when it matches step 2 of a list. A wrong add returns the item and does not increment the recipe. L1 wrong add leaves lives untouched (no lives configured). Wander path stays inside the lab and outside the cauldron radius. Every recipe is makeable from the shelf set (200 seeds).

**Risks.** Two queues can accept the wrong list if the check is "any remaining step" instead of "the head". The HUD shapes have to match the shelf meshes one-to-one. The wandering mushroom must stay pickable (radius follows the mesh, test both).

**Core gaps.** No wizard cauldron file; the core cauldron covers it. No robe-colour picker, and the wizard is untinted so the face stays. Shelf GLB is shared ready `bookshelf.glb`.

---

## 39. Haunted Mansion Keys (`haunted-mansion-keys`)

**Order 39 · time · difficulty 2.** A one-floor grid of rooms. Find coloured keys, open the matching door, pull a lever when the level has one, and reach the exit. Faster clears score higher. The basement and the grand escape are the same grid with more rooms, darker light, and a patrolling suit of armour.

**Controls.** On-foot mover, radius 0.36, top speed 4.4. `actionPressed` within 1.2 m picks a key, tries a door, or pulls a lever (0.20 s windup, then it toggles). `touchControls: ["joystick", "action"]`, Action "Use". Scheme `joystick`. No jump. The windup is 0.20 s on both devices.

**Core loop.** The open wing shows a locked door with a shape plaque → the matching key is in a room you can already reach → pick it up → open that door → the new wing holds the next key or the exit. A lever, when the level has one, opens one extra door that the key chain also reaches (a shortcut, never the only path).

**rules.ts.** Grid `cols × rows` of 6 × 5 m rooms. Doors on shared edges. Seeded growth from room (0,0): each new room attaches to a reachable room. Keys: `keys` colours, each a tint plus a shape (circle, square, triangle, diamond, star). Lock the door into wing `i` and place key `i` in a room already reachable without that door. The exit door is the last lock, on the far room. `lever: true` adds one lever in a reachable room and one extra door that shortens the path; the flood fill must pass with the lever unused. Armour (`armour: true`): one `armourStand` agent, `stepPatrol` on the main corridor at `armourSpeed`. Touch outside a 0.80 s mercy: `loseLife()` and the detective returns to the entrance of the current room. Keys already held stay held. Score is the shell time formula, only on win: `max(0, floor((timeBaseMs − durationMs) / 10))`. The game does not add key bonuses. `timeBaseMs` equals the level timer.

**End.** Win: the exit door is open and the player is in the exit room (`end("win")`). Lose: lives hit 0 on L4–L5 (`end("lose")`, unranked). L1–L3 have no lives; the only failure is the clock (`timeup`, unranked). A win with 1 s left still ranks.

**Camera.** Follow, pitch 58°, closer `followFraction` so a room fills the view, bounds the whole grid, `shift: true`. This is the "room-aware" behaviour the core can do today: a nearer follow, not a camera that collides with walls.

**HUD.** Time game: the shell hides the score chip and shows the clock. Stat `Keys`. A small `Hud` (`data-arcade-safe-area`) draws the shapes you are holding. L4–L5 show lives.

**Look.** Walls `#292524`, floor `#1c1917`, moonlight accent `#c4b5fd`, door plaque in the key's tint plus the shape. L1 `indoor` and brighter (`#44403c` background) so the first grid reads. L2 `indoor`, L3 `night`, L4 `night` with closer fog, L5 `night`. Detective 1.80 m, `charDetective.glb`, untinted, cheer on the exit. Keys: one `skeletonKey.glb` pool, per-copy tint, and a tiny shape plate parented in code (a flat triangle / square / circle) so colour is never the only channel. Armour: `<Model>` of `armourStand.glb` slid along the path with a bob, not the auto-rig.

**Hyper3D.** `menu1-haunted-mansion-keys/`: `charDetective.glb`, `skeletonKey.glb`, `mansionDoor.glb`, `wallLeverV2.glb` (leave `wallLever.glb`), `grandfatherClock.glb` (decor), `paintingFrame.glb` (instanced), `armourStand.glb`. Leave `haunted-mansion-keys/hero.glb`. Shared ready: `woodenChair.glb`, `table.glb`, `bookshelf.glb`. Core: `EXPANSION_ASSETS.chest` as the prop a key sits on in one room. Clocks do not score.

**Draw calls.** About 40. Instanced doors, paintings, chairs. One key pool. One detective. Cap 60.

**Levels.**

```ts
export interface MansionLevel {
   cols: number;
   rows: number;
   keys: number;
   lever: boolean;
   armour: boolean;
   armourSpeed: number;
   durationMs: number;
   timeBaseMs: number;
   lives?: number;
   lighting: "indoor" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, MansionLevel> = {
   1: { cols: 3, rows: 1, keys: 2, lever: false, armour: false, armourSpeed: 0, durationMs: 180_000, timeBaseMs: 180_000, lighting: "indoor", background: "#44403c", fogFar: 40 },
   2: { cols: 3, rows: 2, keys: 3, lever: false, armour: false, armourSpeed: 0, durationMs: 210_000, timeBaseMs: 210_000, lighting: "indoor", background: "#3f3f46", fogFar: 36 },
   3: { cols: 4, rows: 2, keys: 3, lever: true, armour: false, armourSpeed: 0, durationMs: 240_000, timeBaseMs: 240_000, lighting: "night", background: "#1c1917", fogFar: 30 },
   4: { cols: 5, rows: 2, keys: 4, lever: true, armour: true, armourSpeed: 1.6, durationMs: 240_000, timeBaseMs: 240_000, lives: 3, lighting: "night", background: "#0c0a09", fogFar: 22 },
   5: { cols: 4, rows: 3, keys: 5, lever: true, armour: true, armourSpeed: 1.9, durationMs: 300_000, timeBaseMs: 300_000, lives: 3, lighting: "night", background: "#0c0a09", fogFar: 24 },
};
```

Room counts: 3, 6, 8, 10, 12. The plan's 3 / 5 / 7 / 9 / 12 is matched at the ends; L2–L4 use even grids so every room has a neighbour. Tile lines: 1 Entrance Hall, "Two keys in a straight line of rooms." 2 Library, "A second row of rooms." 3 Bedrooms, "A lever opens a shortcut." 4 Basement, "An armour walks the hall." 5 Grand Mansion Escape, "Twelve rooms, five keys."

**Score-limit sketch.** Time game. `base: 0`, `maxPointsPerSec: 0`, `unitLabel: "time"`, `display: "time"`. `maxDurationMs = timeBaseMs = durationMs`. `maxScore = floor((timeBaseMs − minDurationMs) / 10)`.

| L | title | minDurationMs | timeBaseMs | maxScore |
|---|---|---:|---:|---:|
| 1 | Entrance Hall | 8000 | 180000 | 17200 |
| 2 | Library | 14000 | 210000 | 19600 |
| 3 | Bedrooms | 20000 | 240000 | 22000 |
| 4 | Basement | 28000 | 240000 | 21200 |
| 5 | Grand Mansion Escape | 36000 | 300000 | 26400 |

26400 / 17200 ≤ 3. The proof sets `minDurationMs` to the oracle's fastest win minus 1 s, and sets `maxScore` to the formula at that new minimum. An oracle that wins in 6 s on L1 must move the L1 row together (min down, maxScore up) and the 3× check repeats.

**Tests.** 200 seeds: flood fill reaches the exit with the lever unused; every key's room is reachable before its door opens; no two keys share a shape. Armour overlap spends a life only when `armour` is true. A `timeup` submits nothing (`isRankedRun` is false). Grabbing keys in a different order still opens the chain.

**Risks.** An unsolvable seed is the failure mode; the placement rule (key behind you, lock ahead) is the whole puzzle, and the test is the gate. Twelve rooms on a phone depend on the close follow camera. The armour must not spawn on top of the player (path starts in the far half).

**Core gaps.** No camera collision. "Gentle collision avoidance" in the master plan is this follow camera. The detective is the face character (`charDetective.glb`); there is no separate explorer mesh in the ready folder. Armour is unrigged. No ghost mesh, and this design does not add one.

---

## 40. Bee Garden (`bee-garden`)

**Order 40 · points · difficulty 1.** Fly in the horizontal plane over one garden, pick nectar off flowers, and empty it at the hive. Altitude stays at 1.15 m. Boost spends stamina. Webs drop what you are carrying back onto the flowers. The plan's five gardens are one rectangle with more flowers, webs and a breeze.

**Controls.** XZ flight: `moveY` / `moveX` through `inputToWorld`, accel 16, top speed 6.5, drag 0.6, radius 0.30, height fixed. Held `jump` boosts to 9.5 while stamina > 0 and spends 22 stamina per second. Releasing, or hitting 0, starts a 1.00 s lock before boost works again. Stamina refills 10/s while boost is off, cap 100. `touchControls: ["joystick", "jump"]`, Jump "Boost". Scheme `flight`. The lock, the 22/s and the 10/s are the same on Space and on the button. Collect and deposit are overlaps, not buttons.

**Core loop.** Fly into a flower's nectar orb → it joins your carry (cap 3) → fly to the hive pad and overlap it → those units score and the carry empties. A web drops the carry back onto the flowers it came from (those orbs reappear, unscored).

**rules.ts.** Garden `width × depth`. Hive pad at the south, radius 1.6, clear of webs and branches (generator rule). Flowers: exactly `units` of them, types A/B/C in rotation, each holding one nectar. They do not respawn after a deposit. Carry list length ≤ 3. Deposit scores `20 * carried` plus 15 when `carried === 3`. A web overlap: stun 0.50 s, speed set to 0, carry returned to those flowers, no points. Branches are solid circles. L5 `breeze` adds a constant acceleration `(0.8, 0)` m/s² in world x, shown by leaf tilt. Score on win also adds +4 per full second left. Units deposit once, so the ceiling is closed.

**End.** Win: `units` deposited. There is no life counter. A web only delays. Timeup: shell, with whatever you already deposited.

**Camera.** Chase, pitch 55°, look-ahead 2 m, bounds the garden, `shift: true`. High enough to see flowers and the hive together on L1, following on the larger levels.

**HUD.** Score, time. Stats: `Nectar` (carried, max 3), `Stamina` 0–100. `<TargetMarkers>` on the hive while carrying, and on the nearest remaining flower while empty.

**Look.** Lawn `#65a30d`, soil beds `#a16207`, nectar `#fbbf24`, hive `#f59e0b`, accent `#fbbf24`. Bee tints (creature mesh): L1 `#fbbf24`, L2 `#93c5fd`, L3 `#f8fafc`, L4 `#a3e635`, L5 `#fcd34d`. `hover` + `bank` from `core/motion`. Wings stay as the GLB modelled them (one mesh, no cut-apart flap). L1–L3 `day`, L4 `sunset`, L5 `day` with fog. `startLoop("hum")`, pitch up while boosting. Sky dome.

**Hyper3D.** `menu1-bee-garden/`: `bee.glb`, `beehive.glb`, `flowerA.glb`, `flowerB.glb`, `flowerC.glb`, `nectarOrb.glb`, `bigLeaf.glb`, `branchV2.glb` (leave `branch.glb`), `spiderWeb.glb`, `vegetablePlanter.glb`, `wateringCan.glb`. No hero file. Mushroom obstacle: `shared/gardenMushroom.glb`, with `EXPANSION_ASSETS.mushroom` as the in-manifest fallback. L4–L5 may instance `EXPANSION_ASSETS.leafyTree` at half scale as decor outside the fly rect, `useQuality().decor`. Flowers and orbs are instanced per type. Webs are one instanced mesh.

**Draw calls.** About 25 plus the sky. Cap 40.

**Levels.**

```ts
export interface BeeLevel {
   width: number;
   depth: number;
   units: number;
   webs: number;
   branches: number;
   breeze: boolean;
   tint: string;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, BeeLevel> = {
   1: { width: 18, depth: 14, units: 10, webs: 0, branches: 2, breeze: false, tint: "#fbbf24", durationMs: 120_000, lighting: "day", background: "#7dd3fc" },
   2: { width: 22, depth: 16, units: 15, webs: 2, branches: 4, breeze: false, tint: "#93c5fd", durationMs: 150_000, lighting: "day", background: "#86efac" },
   3: { width: 24, depth: 18, units: 20, webs: 4, branches: 6, breeze: false, tint: "#f8fafc", durationMs: 180_000, lighting: "day", background: "#bbf7d0" },
   4: { width: 28, depth: 20, units: 25, webs: 6, branches: 8, breeze: false, tint: "#a3e635", durationMs: 180_000, lighting: "sunset", background: "#166534" },
   5: { width: 32, depth: 22, units: 30, webs: 8, branches: 8, breeze: true, tint: "#fcd34d", durationMs: 210_000, lighting: "day", background: "#14532d" },
};
```

Tile lines: 1 Flower Garden, "Ten nectar, no webs, learn the hive." 2 Vegetable Garden, "Webs drop your carry." 3 Greenhouse, "Same garden, more flowers, glass is fog and props." 4 Forest Flowers, "Longer flight, more webs." 5 Giant Garden, "A sideways breeze and thirty nectar." Greenhouse does not add an interior shell; planters and a closer fog are the glasshouse.

**Score-limit sketch.** Full loads pay the bonus. `loads = floor(units / 3)`. `Bobj = 20 * units + 15 * loads`. Speed bonus +4/s on win. Dropped nectar does not create a second payout.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Flower Garden | 245 | 30 | 605 | 245 | 14 | 630 | 120000 |
| 2 | Vegetable Garden | 375 | 42 | 807 | 375 | 12 | 840 | 150000 |
| 3 | Greenhouse | 490 | 55 | 990 | 490 | 11 | 1030 | 180000 |
| 4 | Forest Flowers | 620 | 70 | 1060 | 620 | 8 | 1110 | 180000 |
| 5 | Giant Garden | 750 | 90 | 1230 | 750 | 7 | 1280 | 210000 |

`minDurationMs = 4000`. No lives, so a 4 s run can only hold a few units; pps rejects a full deposit that early. 1280 / 630 ≤ 3.

**Tests.** Carry never exceeds 3. Deposit of 3 pays 75 and deposit of 1 pays 20. A web restores the same flower ids and pays 0. The hive pad contains no web or branch on 200 seeds. Breeze acceleration is 0 unless `breeze`. Boost lock lasts 1.00 s after stamina hits 0, including when the button is still held.

**Risks.** Free 3D flight would blow the day and the touch scheme. The fixed height is the game. Wings will not flap if the GLB is one mesh; `hover` and `bank` carry the life. L5 breeze can push a slow bee into a web every second: the web stun is 0.50 s, not a kill, and the hive stays clear so a full carry can always be walked in along the south edge (generator: a 3 m corridor from the south edge to the hive has no hazards).

**Core gaps.** No bee flight helper beyond the on-foot integrator with a locked y. `core/motion` `hover` and `bank` cover the body. No wing-flap helper, and this game does not split the mesh. No rain or wind volume: breeze is a constant acceleration in the step.

---

## Asset index

Ready folders checked 2026-10-25. "Adopt" is the file the assets PR should load. "Skip" stays on disk.

| Game | Ready folder | Adopt | Skip |
|---|---|---|---|
| firefighter-rescue | `menu1-firefighter-rescue/` plus `firefighter-rescue/hero.glb` | `charFirefighter.glb`, `fireExtinguisher.glb`, `fireHydrant.glb`, `hoseReel.glb`, `fireTruck.glb`, `exitSignV2.glb` | `exitSign.glb`, `hero.glb` |
| taxi-rush-3d | `menu1-taxi-rush-3d/` | `taxiCab.glb`, `townhouseBlock.glb`, `cornerShop.glb`, `busStop.glb` | — |
| burger-delivery-scooter | `menu1-burger-delivery-scooter/` plus `hero.glb` | `charScooterRider.glb`, `deliveryScooter.glb`, `deliveryBoxV2.glb`, `burgerBag.glb`, `foodBoxV2.glb`, `restaurantCounter.glb`, `burgerShop.glb`, `roadBarrier.glb` | `deliveryBox.glb`, `foodBox.glb`, `hero.glb` |
| beach-lifeguard | `menu1-beach-lifeguard/` plus `hero.glb` | `charLifeguard.glb`, `lifeguardTower.glb`, `rescueFloat.glb`, `beachChair.glb`, `beachCooler.glb`, `beachgoerNpc.glb`, `beachHut.glb`, `sandcastle.glb`, `surfboardV2.glb`, `rescueJetSki.glb` | `surfboard.glb`, `hero.glb` |
| farm-tractor-challenge | `menu1-farm-tractor-challenge/` plus `hero.glb` | `charFarmer.glb`, `tractor.glb`, `farmTrailer.glb`, `hayBale.glb`, `appleCrate.glb`, `barn.glb`, `farmFence.glb`, `farmGate.glb`, `scarecrow.glb`, `grainSilo.glb`, `waterTrough.glb` | `hero.glb` |
| cat-vs-robot-vacuum | `menu1-cat-vs-robot-vacuum/` | `cat.glb`, `robotVacuum.glb`, `catTreat.glb`, `catToy.glb`, `catBox.glb`, `catTree.glb` | — |
| hotel-bellboy-rush | `menu1-hotel-bellboy-rush/` plus `hero.glb` | `charBellboy.glb`, `bellboyTrolley.glb`, `elevatorDoorV2.glb`, `hotelRoomDoor.glb`, `keyCard.glb`, `receptionDesk.glb`, `serviceBellV2.glb`, `lobbyPlanter.glb` | `elevatorDoor.glb`, `serviceBell.glb`, `hero.glb` |
| wizard-potion-lab | `menu1-wizard-potion-lab/` plus `hero.glb` | `charWizard.glb`, `alchemyTable.glb`, `magicCrystal.glb`, `berryBunch.glb`, `magicFlower.glb`, `herbBundle.glb`, `potionBottle.glb`, `spellBook.glb`, `candle.glb`, `crystalBall.glb` | `hero.glb` |
| haunted-mansion-keys | `menu1-haunted-mansion-keys/` plus `hero.glb` | `charDetective.glb`, `skeletonKey.glb`, `mansionDoor.glb`, `wallLeverV2.glb`, `grandfatherClock.glb`, `paintingFrame.glb`, `armourStand.glb` | `wallLever.glb`, `hero.glb` |
| bee-garden | `menu1-bee-garden/` | `bee.glb`, `beehive.glb`, `flowerA.glb`, `flowerB.glb`, `flowerC.glb`, `nectarOrb.glb`, `bigLeaf.glb`, `branchV2.glb`, `spiderWeb.glb`, `vegetablePlanter.glb`, `wateringCan.glb` | `branch.glb` |

Auto-rig these humanoids after the assets PR measures them: firefighter, scooter rider, lifeguard, farmer, bellboy, wizard, detective. Cat, bee, civilians, beachgoers, travellers and the armour stay unskinned.

Core meshes these specs already count on: `REUSED_ASSETS.door`, `car`, `lamp`, `bench`, `umbrella`, `palm`; `EXPANSION_ASSETS.cauldron`, `mushroom`, `suitcase`, `chest`, `leafyTree`; `SHARED_ASSETS.crate`.
