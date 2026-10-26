# Menu 1 specs: games 41–50

Status: 2026-10-25. Spec only: no game code in this file. Same shape and the same rules as `specs-31-40.md`; read its "How to build one", the street-vehicle integrator and the on-foot mover first. Everything there applies here unless a section says otherwise.

Source: `docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md` games 41–50, the level contract in `docs/arcade-levels.md`, and `play50games-frontend/src/arcade3d/core/README.md`. Every tuning number is a starting point. The score-limit proof (arcade-score-limits skill, once per level) replaces the assumed earliest win `M` with the oracle bot's best time and retunes `base`, `maxPointsPerSec` and `maxScore` by about 3–5 %. Keep level 5 `maxScore` ≤ 3 × level 1.

These are new games (master-plan 41–50). `meta.order` is 41–50. `status: "dev"`. `orientation: "any"`. The slugs, a stub folder (`meta.ts` + `index.tsx` with the core `PlaceholderScene`), the loader and a disabled `arcade-games.json` entry with placeholder limits already exist (`claude/menu1-scaffold`, 2026-10-25). The build replaces the stub's two files, keeps the slug, the order, the collection and the owner, and puts its proven five-level limits in `meta.ts` (`PROPOSED_LEVEL_LIMITS` in `rules.ts`); Claude copies them into `arcade-games.json` at merge.

## Owners (games 31–50)

The user's decision (2026-10-25): finish Menu 1 before Menu 2. Four builders, five games each. Codex builds none of these.

| # | Game | Slug | Collection | Owner |
|---|---|---|---|---|
| 31 | Firefighter Rescue | `firefighter-rescue` | adventure | cursor (built, merged as dev) |
| 32 | Taxi Rush 3D | `taxi-rush-3d` | skill | cursor (in progress) |
| 33 | Burger Delivery Scooter | `burger-delivery-scooter` | skill | claude |
| 34 | Beach Lifeguard | `beach-lifeguard` | adventure | antigravity |
| 35 | Farm Tractor Challenge | `farm-tractor-challenge` | skill | kimi |
| 36 | Cat vs Robot Vacuum | `cat-vs-robot-vacuum` | adventure | kimi |
| 37 | Hotel Bellboy Rush | `hotel-bellboy-rush` | skill | claude |
| 38 | Wizard Potion Lab | `wizard-potion-lab` | skill | cursor |
| 39 | Haunted Mansion Keys | `haunted-mansion-keys` | adventure | antigravity |
| 40 | Bee Garden | `bee-garden` | skill | antigravity (in progress) |
| 41 | Dog Park Fetch | `dog-park-fetch` | adventure | kimi |
| 42 | Submarine Treasure Dive | `submarine-treasure-dive` | adventure | cursor |
| 43 | Mars Rover Mission | `mars-rover-mission` | adventure | antigravity |
| 44 | Train Station Rush | `train-station-rush` | skill | claude |
| 45 | Pizza Kitchen 3D | `pizza-kitchen-3d` | skill | claude |
| 46 | Jungle Bridge Run | `jungle-bridge-run` | adventure | antigravity |
| 47 | Magic Carpet Ride | `magic-carpet-ride` | adventure | cursor |
| 48 | Toy Store Night Shift | `toy-store-night-shift` | skill | kimi |
| 49 | Aquarium Cleaner | `aquarium-cleaner` | adventure | kimi |
| 50 | Postman 3D | `postman-3d` | skill | claude |

Collections follow the expansion split (10 adventure, 10 skill): adventure = explore and rescue, skill = drive, sort and serve. `registry.test.ts` pins the 5 / 5 / 5 / 5 split; a reassignment changes the meta owner and that test together.

## How to build one

One agent, one game, one day, one folder `play50games-frontend/src/arcade3d/games/<slug>/**` plus `public/images/3d/<slug>.webp`. Everything in `specs-31-40.md` "How to build one" holds: `createRun(seed, level)` + `step(run, input, dt)` in a pure `rules.ts`, one `useRunFrame`, `useGameTime` for visuals, the same timing constants on keyboard and touch, `durationMs` on the level spec, `physics` off, `resultDelayMs: 900`, `useFittedView` + `CameraRig` with `shift: true`, characters through `<HumanoidModel>` untinted, creatures as `<Model>` + `core/motion`, ready GLBs behind `<Model fallback>` until Claude's assets PR, a draw-call target per section (hard cap 150), and the standard test set (determinism, win and lose, every score event, reachability for 200 seeds, oracle / greedy / idle / spam bots at 30 / 60 / 144 Hz through `createArcadeStore`, `withinServerLimits`, oracle ≥ 90 % of `maxScore`, idle never clears, `definitionLevelProblems`).

Extra rules for these ten:

- The slug is already in `ARCADE_SLUGS`, so no cast and no test import by path: import the folder normally.
- `thumbnail` stays `null` until the webp lands; the OG card comes with it (`tools/og` already knows the title).
- Underwater games (submarine, aquarium) are XZ games with a fixed height, like the bee. Depth is a two-value state (cruise / low), not free 3D flight.
- Characters ready for the auto-rig (clean T-pose per the ledger): `charDiver`, `charAstronaut`, `charExplorer`, `charNightGuard`, `charPostman`, `charStationWorker`, `charCarpetRider`. `dog.glb` is a creature (`<Model>`, `hop` / `waddle`), never the auto-rig. `toyRobot.glb` is not a T-pose (arms down): a `<Model>` hazard, not rigged. `travellerNpc.glb` and `civilianNpc.glb` are not T-pose and look photoreal: unrigged decor at most (see "Hyper3D still needed").
- Where a name and an `R` (regenerated) or `V2` version both exist, the asset index below says which one to adopt. `<slug>/hero.glb` folders are older meshes; adopt `menu1-<slug>/char*.glb`.

### Core gaps (all ten)

| Gap | What the game does |
|---|---|
| No `sitPose` | Carpet rider and (decor) astronaut in the rover: game-local hip / knee bend with `turnBone`, as the scooter rider in 33. Ask Claude for `sitPose` if the legs stay straight. |
| No swim pose | The diver walks the tank floor in lead boots (walk gait at 0.6 × speed, spine pitched forward with `turnBone`), and a float is a `jumpPose` arc. |
| No lane-runner helper | Jungle keeps its own lane / jump / slide state in `rules.ts`, like obstacle-race. |
| No rail-flight helper | Carpet rides a `core/path` spline with a bounded offset window; `advance` + `tangentAt` are enough. |
| No follower helper | Train passengers use the firefighter rule (`arrive` + the 1.2 s free-point rule) in their own `rules.ts`. |
| No throw / owner animation | The owner is an unrigged `<Model>` with a `hop` on each throw; the toy flies on a `core/ballistics` arc. |
| No category-sign mesh | Shelves, platforms and addresses carry canvas plates (`useCanvasTexture`): a colour plus a shape plus a digit, never colour alone. |
| Ready GLBs are outside the manifest | Fallbacks until Claude's assets PR. Names below are the files to import. |

---

## 41. Dog Park Fetch (`dog-park-fetch`)

**Order 41 · points · difficulty 1 · adventure · owner kimi.** You are the dog. The owner stands on a picnic blanket and throws one toy at a time; you chase it, pick it up and bring it back. A frisbee caught in the air pays a bonus. The plan's five parks are one fenced lawn with more throws, wider throws, a mower that patrols, and a short patience on the later levels.

**Controls.** On-foot mover, radius 0.32, top speed 6.0 (dogs are quick), accel 26, brake 30. `jumpPressed` leaps 0.45 s (arc 0.8 m). A toy on the ground is picked up on overlap; a frisbee in flight is caught when the dog overlaps it during a leap and the frisbee is below 1.4 m. Drop-off is an overlap with the blanket pad. No Action button. `touchControls: ["joystick", "jump"]`, Jump label "Jump". Scheme `joystick`. Leap length and the catch window are one set of constants on both devices.

**Core loop.** The owner hops and throws (`core/ballistics` arc, seeded landing point) → a `<TargetMarkers>` arrow points at the toy while it is off screen → run, pick it up (or leap and catch a frisbee) → bring it to the blanket → the next throw starts 0.8 s later.

**rules.ts.** Lawn `width × depth`, fenced. Blanket pad radius 1.5 at the south centre. `throws` toys in a seeded order of ball / stick / frisbee; every third throw is a frisbee (`frisbees = ceil(throws / 3)`). Landing points ≥ 6 m from the blanket, ≥ 1.5 m from props, inside the fence. Frisbee flight 1.6 s; the catch window is its last 0.9 s. Mower (`mowers` on L3+): a closed `stepPatrol` path at `mowerSpeed`; overlap outside a 0.80 s mercy drops the carried toy where you stand and stuns 0.60 s (no lives). Patience (`patienceS`, L4+): a throw left more than `patienceS` on the ground is fetched by the owner (0 points, next throw). Score, all integers: +100 per toy returned, +40 if it came back within 8.0 s of landing, +60 per frisbee caught in the air, and on win +4 per full second left. Each throw pays once.

**End.** Win: every throw resolved and at least `throws − 1` of them returned by the dog (`end("win")`). Lose: none (no lives). Timeup: shell. On L4–L5 a run where two throws timed out can no longer win: `end("lose")` at once so the player sees why.

**Camera.** Follow, pitch 55°, look-ahead 2 m, `followFocus` over the lawn, `shift: true`. L1 fits the whole lawn.

**HUD.** Score, time. Stats: `Fetched` (max = throws), `Combo` hidden. One `<TargetMarkers>` arrow on the toy, then on the blanket while carrying.

**Look.** Lawn `#65a30d` with mowing stripes, paths `#d6d3d1`, blanket `#f59e0b`, accent `#f59e0b`. L1–L2 `day`, L3 `day` with tree shade, L4 `sunset` (beach park: sand strip `#f2d7a6` along the south, `<Water>` beyond the fence, visual only), L5 `day` with bunting and fog. Dog `dog.glb`, one tint per level is allowed (creature): L1 untinted, L2 `#fde68a`, L3 `#78716c`, L4 `#f8fafc`, L5 `#fb923c`. `hop` while running, `bank` on turns. The carried toy is parented to the muzzle point. Owner: `shared/civilianNpc.glb` as an unrigged `<Model>` (it stands with hands on hips) with a `hop` per throw, until `charDogOwner` exists.

**Hyper3D.** `menu1-dog-park-fetch/`: `dog.glb` (player), `tennisBall.glb`, `frisbee.glb` (flip it: the ledger reads it concave side up), `fetchStick.glb`, `parkFountain.glb` (solid circle, centre of L2+), `agilityTunnel.glb` (L5 decor, solid AABB), `agilityHurdleR.glb` (leave `agilityHurdle.glb`, a dog is baked onto its bar; L5 decor, leap over it for +0). Leave `dogHouse.glb` and `dogHouseR.glb` (both have a dog baked in) and `dogBone.glb` / `dogBoneV2.glb` (cross biscuits). Shared ready: `picketFence.glb` (instanced along the fence path; the kit `<Fence>` is the fallback), `civilianNpc.glb` (owner). Core: `REUSED_ASSETS.bench`, `EXPANSION_ASSETS.leafyTree` (solid circles), `REUSED_ASSETS.umbrella` (L4).

**Hyper3D still needed.** `charDogOwner` (image-to-3D, T-pose, the thrower), `parkBush` (the plan's bush; until then leafyTree at 0.4 scale), `dogHouseEmpty` (the R regeneration still has a dog in the door), `lawnMower` (the L3+ patrol hazard; until then a two-tone bevelled box), `festivalTent` (L5 dressing).

**Draw calls.** About 30. Toys are three single models (one in play at a time), fence and trees instanced. Cap 50.

**Levels.**

```ts
export interface DogLevel {
   width: number;
   depth: number;
   throws: number;
   throwMin: number;
   throwMax: number;
   mowers: number;
   mowerSpeed: number;
   patienceS: number; // 0 = the owner waits forever
   tint: string | null;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
}

export const LEVELS: Record<LevelId, DogLevel> = {
   1: { width: 20, depth: 16, throws: 4, throwMin: 6, throwMax: 10, mowers: 0, mowerSpeed: 0, patienceS: 0, tint: null, durationMs: 90_000, lighting: "day", background: "#bae6fd" },
   2: { width: 26, depth: 20, throws: 6, throwMin: 7, throwMax: 13, mowers: 0, mowerSpeed: 0, patienceS: 0, tint: "#fde68a", durationMs: 120_000, lighting: "day", background: "#7dd3fc" },
   3: { width: 30, depth: 24, throws: 8, throwMin: 8, throwMax: 15, mowers: 1, mowerSpeed: 1.8, patienceS: 0, tint: "#78716c", durationMs: 150_000, lighting: "day", background: "#86efac" },
   4: { width: 32, depth: 26, throws: 10, throwMin: 8, throwMax: 16, mowers: 1, mowerSpeed: 2.2, patienceS: 14, tint: "#f8fafc", durationMs: 150_000, lighting: "sunset", background: "#fdba74" },
   5: { width: 36, depth: 28, throws: 12, throwMin: 9, throwMax: 18, mowers: 2, mowerSpeed: 2.4, patienceS: 12, tint: "#fb923c", durationMs: 180_000, lighting: "day", background: "#fde68a" },
};
```

Tile lines: 1 Small Park, "Four throws, learn the blanket." 2 City Park, "Longer throws around the fountain." 3 Forest Park, "Mind the mower." 4 Beach Park, "Fetch it before the owner does." 5 Dog Festival, "Twelve throws, two mowers."

**Score-limit sketch.** `Bobj = 140 * throws + 60 * frisbees` (`frisbees = ceil(throws / 3)`). Speed bonus +4/s on win. `peak = Bobj + 4 * (durationS − M)`. `base = Bobj`, `pps = ceil((peak − base) / M)`, `maxScore ≈ peak + 4 %`. `minDurationMs = 4000`. `unitLabel: "pts"`, `display: "int"`.

| L | title | Bobj | M (s) | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Park | 680 | 22 | 952 | 680 | 13 | 1000 | 90000 |
| 2 | City Park | 960 | 34 | 1304 | 960 | 11 | 1360 | 120000 |
| 3 | Forest Park | 1300 | 48 | 1708 | 1300 | 9 | 1780 | 150000 |
| 4 | Beach Park | 1640 | 60 | 2000 | 1640 | 6 | 2080 | 150000 |
| 5 | Dog Festival | 1920 | 75 | 2340 | 1920 | 6 | 2440 | 180000 |

2440 / 1000 ≤ 3. The throws arrive one at a time, so `M` is bounded below by the flight times plus the runs: the proof's oracle must wait for each throw, never pre-run to a landing point it cannot know (the seed is in the run, not in the bot).

**Tests.** A frisbee caught at 1.39 m pays the bonus, at 1.41 m it does not. The mower drop puts the toy on the floor at the dog and pays nothing. A timed-out throw pays 0 and the next one starts. L1–L3 never time out (`patienceS: 0`). Landing points never inside a prop or outside the fence (200 seeds).

**Risks.** A throw that lands behind the fountain hides from the camera: the arrow plus a landing ring (code torus) is the fix. The dog at 6 m/s outruns a phone camera on L5: keep `followFraction` high. Five tints on a creature mesh are fine; never tint the owner.

**Core gaps.** No throw pose (the owner hops). No muzzle socket (a fixed offset in the dog's local space). No skin picker (tints per level).

---

## 42. Submarine Treasure Dive (`submarine-treasure-dive`)

**Order 42 · points · difficulty 2 · adventure · owner cursor.** Pilot a mini submarine over a reef. Sonar points at the treasure. Hold Dive to sink to the sea floor and scoop it up, then rise and carry on. Every treasure collected, go back to the dock. The battery drains all the time and faster while diving; a full battery is the clock you actually play against.

**Controls.** XZ flight like the bee: `moveY` / `moveX` through `inputToWorld`, accel 9, top speed 5.5, drag 0.9, radius 0.9. Hold `action` (E / Enter, touch "Dive"): the sub sinks from cruise height 3.0 m to floor height 0.8 m over 0.60 s and rises back over 0.60 s on release. Treasure collects on overlap only while the sub is below 1.2 m. Rocks, coral heads and the wreck are solid circles / AABBs at every height; arches (`rockArch`) are solid only while the sub is low (it passes over them at cruise). `touchControls: ["joystick", "action"]`, Action label "Dive". Scheme `flight`. Sink and rise times are the same on both devices.

**Core loop.** Read the sonar arrow → fly over the treasure → hold Dive, scoop it → release → next arrow. With the quota on board, the arrow points at the dock → overlap the dock pad (any height) to win.

**rules.ts.** Sea floor `width × depth`, dock pad radius 2.0 at the south. `treasures` items (chest, amphora, pearl shell, coin pile in rotation), ≥ 6 m apart, clear of solids by 1.5 m. `rocks` solid circles, `coral` solid circles (radius 1.0). Battery 100, drains `drain` per second at cruise and `2 × drain` while low; at 0 the sub loses power: `end("lose")`. Hazards (`jellies` on L3+): jellyfish on `stepPatrol` loops at `jellySpeed`; overlap outside a 0.80 s mercy costs 8 battery and pushes the sub 1.5 m back along its velocity. A solid hit above 3 m/s costs 4 battery. Current (L4+): a constant `(current, 0)` m/s² push in world x, shown by drifting particles. Score: +150 per treasure, +50 if no bump or jelly since the previous pickup, and on win +5 per full second left. Treasures do not respawn.

**End.** Win: every treasure on board and the sub on the dock pad. Lose: battery 0. Timeup: shell. No lives counter.

**Camera.** Chase, pitch 55°, look-ahead 2.5 m along velocity, `followFocus` over the floor, `shift: true`. The camera does not dip with the sub; the sub's shadow blob (`BlobShadow`) on the floor reads the height.

**HUD.** Score, time. Stats: `Treasure` (max = level), `Battery` 0–100. `<TargetMarkers>` on the nearest treasure, then the dock. A sonar ring (code torus, expanding every 2 s from the sub) is the look of the ping.

**Look.** Sand floor `#e7c98a`, water fog `#0e7490` (fog near 8, far `fogFar`), accent `#22d3ee`. Lighting `day` on L1–L2, `sunset` (warm shaft) on L3, `night` on L4–L5 with the sub's headlight as an emissive cone (no spot light). `startLoop("hum")` pitched by speed, bubbles from `fx` while diving. Fish schools: `tropicalFish.glb` from the aquarium folder, one `<DynamicInstancedModel>` circling, visual only.

**Hyper3D.** `menu1-submarine-treasure-dive/`: `miniSubmarine.glb` (player), `amphora.glb`, `anchor.glb` (decor, solid), `pearlShellV2.glb` (leave `pearlShell.glb`), `rockArch.glb`, `ruinColumn.glb` (lay it on its side in code, `rotation`), `shipwreckHull.glb` / `shipwreckHullR.glb` as the L3 wreck only if the user accepts an upright hull (otherwise the stand-in, see below). Shared ready: `coral.glb` / `coralV2.glb` and `seaweed.glb` are broken shard meshes; do not adopt them. From `menu1-aquarium-cleaner/`: `tropicalFish.glb`, `aquariumRock.glb` (reef rocks). Core: `EXPANSION_ASSETS.chest`, `SHARED_ASSETS.coin` (coin pile = three coins), `EXPANSION_ASSETS.rock`, `EXPANSION_ASSETS.fish` (second school).

**Hyper3D still needed.** `coralBranch` (rounded branching coral, shared with 49), `seaweedKelp` (wavy kelp strand, shared with 49), `shipwreckSideways` (a broken hull lying on its side; both versions are upright rowboats), `subDock` (the base pad structure), `jellyfish` (the L3+ hazard creature).

**Draw calls.** About 35. Reef instanced, one fish pool, treasures one model each (≤ 8). Cap 55.

**Levels.**

```ts
export interface SubLevel {
   width: number;
   depth: number;
   treasures: number;
   rocks: number;
   coral: number;
   jellies: number;
   jellySpeed: number;
   current: number;
   drain: number; // battery per second at cruise
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, SubLevel> = {
   1: { width: 30, depth: 26, treasures: 3, rocks: 4, coral: 4, jellies: 0, jellySpeed: 0, current: 0, drain: 0.55, durationMs: 120_000, lighting: "day", background: "#0891b2", fogFar: 40 },
   2: { width: 36, depth: 30, treasures: 4, rocks: 6, coral: 8, jellies: 0, jellySpeed: 0, current: 0, drain: 0.55, durationMs: 150_000, lighting: "day", background: "#0e7490", fogFar: 36 },
   3: { width: 40, depth: 34, treasures: 5, rocks: 6, coral: 8, jellies: 3, jellySpeed: 1.2, current: 0, drain: 0.5, durationMs: 180_000, lighting: "sunset", background: "#155e75", fogFar: 32 },
   4: { width: 44, depth: 36, treasures: 6, rocks: 8, coral: 10, jellies: 4, jellySpeed: 1.4, current: 0.5, drain: 0.6, durationMs: 180_000, lighting: "night", background: "#164e63", fogFar: 26 },
   5: { width: 48, depth: 40, treasures: 8, rocks: 10, coral: 12, jellies: 6, jellySpeed: 1.6, current: 0.6, drain: 0.45, durationMs: 240_000, lighting: "night", background: "#083344", fogFar: 24 },
};
```

Tile lines: 1 Shallow Reef, "Three treasures, a full battery." 2 Coral Reef, "Coral everywhere: steer around it." 3 Sunken Ship, "Jellyfish drift between the wrecks." 4 Deep Cave, "Dark water and a current." 5 Ancient Ruins, "Eight treasures, one battery."

**Score-limit sketch.** `Bobj = 200 * treasures`. Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Shallow Reef | 600 | 30 | 1050 | 600 | 15 | 1100 | 120000 |
| 2 | Coral Reef | 800 | 42 | 1340 | 800 | 13 | 1400 | 150000 |
| 3 | Sunken Ship | 1000 | 55 | 1625 | 1000 | 12 | 1690 | 180000 |
| 4 | Deep Cave | 1200 | 70 | 1750 | 1200 | 8 | 1820 | 180000 |
| 5 | Ancient Ruins | 1600 | 95 | 2325 | 1600 | 8 | 2420 | 240000 |

`minDurationMs = 4000` (a battery death can come early only on purpose, and pps rejects a full clear that fast). 2420 / 1100 ≤ 3. The battery must allow the oracle route with margin: the proof also checks that the oracle wins with ≥ 15 % battery on every level (the drain numbers above are the tuning knob, not the limits).

**Tests.** No pickup above 1.2 m. The arch blocks only when low. Battery drains exactly twice as fast while low. A jelly hit costs 8 battery once per mercy window. The dock does not win before the quota. Treasures never inside solids (200 seeds).

**Risks.** Free 3D flight is out of scope; the two-height state is the game. Underwater fog can hide the sonar target: the arrow is the guide, the fog is the mood. The wreck GLB may never read right; a bevelled two-tone hull stand-in is acceptable.

**Core gaps.** No underwater post-process (fog + tint). No headlight cone helper (an emissive cone mesh, additive). No current volume (a constant acceleration in the step).

---

## 43. Mars Rover Mission (`mars-rover-mission`)

**Order 43 · points · difficulty 2 · adventure · owner antigravity.** Drive a rover across one red plain. Stop inside each scan ring to take a sample, recharge at the solar charger when you need it, and drive back to the base. Later levels add canyon walls, rolling boulders and a hungrier battery.

**Controls.** Street-vehicle integrator (`specs-31-40.md`) with rover numbers: top speed 7, accel 7, brake 12, reverse 2.5, steer 1.8 rad/s, radius 1.1, drag 0.6. A scan completes when `speed < 0.5` for 1.00 s inside a site ring (radius 1.8). A charge happens while `speed < 0.5` inside a charger pad (+12 battery per second). `touchControls: ["joystick"]`. Scheme `steer`. Hold times are play time, both devices.

**Core loop.** Sites show as beacons (`beaconLight`) with a ring → drive in, stop, hold → the sample rock lifts into the rover's tray → next site. Battery low → detour to a charger. All sites scanned → the base pad lights → stop on it to win.

**rules.ts.** Plain `width × depth` bounded by mesa walls. Base pad at the south. `sites` rings, ≥ 10 m apart, ≥ 3 m from solids. `chargers` pads. Battery 100: drains 0.35/s idle plus 0.9 per metre driven × `drainScale`; at 0 the rover stalls: `end("lose")`. `rocks` solid circles; a hit above 3 m/s spends a life (3 lives) and bounces `speed` to −0.3 of itself. L3+: `boulders` rolling boulders on straight seeded lanes, speed `boulderSpeed`, `sweptAabbXZ` against the rover; a hit spends a life. L4: dust storm, fog closer and the beacons' rings are the only guide (markers stay on). Score: +120 per scan, +60 if the rover stopped within 1.0 m of the ring centre, and on win +5 per full second left. Each site pays once.

**End.** Win: every site scanned and the rover parked on the base pad (`speed < 0.5` for 0.6 s). Lose: battery 0 or lives 0. Timeup: shell.

**Camera.** Chase, pitch 46°, look-ahead 3.5 m along velocity, bounds the plain, `shift: true`.

**HUD.** Score, time, lives. Stats: `Samples` (max = sites), `Battery` 0–100. `<TargetMarkers>` on the nearest unscanned site, then the base; a second, dimmer arrow on the nearest charger when the battery is below 30.

**Look.** Ground `#c2410c` with darker tracks, sky dome `#fdba74` → `#7c2d12`, accent `#f97316`. L1 `day`, L2 `day`, L3 `sunset`, L4 `sunset` with fog near 6 / far 28 (dust), L5 `space` (thin air, black sky, `<Starfield>`). The astronaut stands at the base and cheers on a win (`charAstronaut`, auto-rig, `cheerPose`); she is decor, not the driver. The rover's wheels turn in code if the GLB splits them; otherwise the body bobs on `spring` suspension.

**Hyper3D.** `menu1-mars-rover-mission/`: `marsRover.glb` (player; it has four wheels, the ledger accepts it; leave `marsRoverV2.glb`, also four wheels with thin mast parts), `marsBase.glb`, `commsAntenna.glb`, `groundSolarPanelV2.glb` (leave `groundSolarPanel.glb`; the charger dressing), `chargingStation.glb` (the charger pad), `sampleRock.glb` (the sample, also scattered solid rocks at 1.5 × scale), `beaconLight.glb` (one per site), `researchCrate.glb` (base decor), `landingCapsule.glb` (L1 start decor), `charAstronaut.glb`. `marsMesaRock.glb` reads as a low wall: use it as the boundary wall pieces, not as mesas. From `menu1-magic-carpet-ride/`: `canyonMesa.glb` tinted `#9a3412` for the distant mesas. Core: `EXPANSION_ASSETS.rock` tinted for boulders.

**Hyper3D still needed.** `marsBoulder` (a round boulder that reads as rolling), `ancientMarsRuin` (the L5 "ancient site" landmark: weathered alien pillars), `marsMesaTall` (a flat-topped mesa for the skyline if the tinted canyon mesa looks too desert).

**Draw calls.** About 35. Rocks instanced, boulders one dynamic pool, beacons instanced. Cap 55.

**Levels.**

```ts
export interface MarsLevel {
   width: number;
   depth: number;
   sites: number;
   chargers: number;
   rocks: number;
   boulders: number;
   boulderSpeed: number;
   drainScale: number;
   durationMs: number;
   lighting: "day" | "sunset" | "space";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, MarsLevel> = {
   1: { width: 40, depth: 32, sites: 3, chargers: 1, rocks: 6, boulders: 0, boulderSpeed: 0, drainScale: 0.8, durationMs: 120_000, lighting: "day", background: "#fdba74", fogFar: 80 },
   2: { width: 46, depth: 36, sites: 4, chargers: 1, rocks: 12, boulders: 0, boulderSpeed: 0, drainScale: 0.9, durationMs: 150_000, lighting: "day", background: "#fb923c", fogFar: 80 },
   3: { width: 50, depth: 40, sites: 5, chargers: 2, rocks: 12, boulders: 2, boulderSpeed: 3.5, drainScale: 1.0, durationMs: 180_000, lighting: "sunset", background: "#c2410c", fogFar: 60 },
   4: { width: 50, depth: 40, sites: 6, chargers: 2, rocks: 14, boulders: 3, boulderSpeed: 4.0, drainScale: 1.15, durationMs: 180_000, lighting: "sunset", background: "#9a3412", fogFar: 28 },
   5: { width: 56, depth: 44, sites: 7, chargers: 2, rocks: 16, boulders: 4, boulderSpeed: 4.5, drainScale: 1.1, durationMs: 240_000, lighting: "space", background: "#0c0a09", fogFar: 90 },
};
```

Tile lines: 1 Landing Zone, "Three sites near the capsule." 2 Rocky Plains, "Rocks everywhere: slow down." 3 Mars Canyon, "Boulders roll down the canyon." 4 Crater, "Dust storm: follow the beacons." 5 Ancient Mars Site, "Seven sites under the stars."

**Score-limit sketch.** `Bobj = 180 * sites`. Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Landing Zone | 540 | 32 | 980 | 540 | 14 | 1020 | 120000 |
| 2 | Rocky Plains | 720 | 45 | 1245 | 720 | 12 | 1300 | 150000 |
| 3 | Mars Canyon | 900 | 58 | 1510 | 900 | 11 | 1580 | 180000 |
| 4 | Crater | 1080 | 72 | 1620 | 1080 | 8 | 1690 | 180000 |
| 5 | Ancient Mars Site | 1260 | 90 | 2010 | 1260 | 9 | 2100 | 240000 |

`minDurationMs = 4000`. 2100 / 1020 ≤ 3. The oracle route must stay solvable on battery: the proof checks a charger-aware oracle wins every level for 200 seeds (the generator places a charger within reach of the farthest site).

**Tests.** A scan at speed 0.49 for 1.00 s completes, at 0.51 it does not. Leaving the ring resets the hold. Charging only while stopped. Battery 0 ends with `"lose"` once. A boulder hit uses `sweptAabbXZ` (a 30 Hz bot does not tunnel). Each site pays once.

**Risks.** The battery can make a seed unwinnable: the generator rule and the oracle test are the gate. Free driving on a wide plain can feel empty: rocks are the texture, and the beacons must be tall enough to read from across the map.

**Core gaps.** No wheel-spin helper (only if the GLB splits wheels). No dust particle volume (fog + `fx` puffs behind the wheels).

---

## 44. Train Station Rush (`train-station-rush`)

**Order 44 · points · difficulty 2 · skill · owner claude.** You are the station worker. Bags and passengers turn up at the entrance with a coloured platform tag. Carry the bag, or walk the passenger, to the right platform before that train pulls out. Trains come in on a timetable you can read off the station clock.

**Controls.** On-foot mover, radius 0.38, top speed 4.6, × 0.80 while carrying a bag. `actionPressed` within 1.2 m: take the bag at the entrance, talk to a passenger (they follow), or hand over at a platform's boarding pad. `touchControls: ["joystick", "action"]`, Action label "Use". Scheme `joystick`. No jump. One bag or one follower at a time.

**Core loop.** A task card appears at the entrance (bag or passenger, platform colour + shape + number) → take it → walk to the platform → Use on the boarding pad → the train swallows it, a chime plays → next task. Trains arrive, wait `dwellS`, and leave; a task for a train that left is missed.

**rules.ts.** Concourse 10 m deep across the top, `platforms` platforms below it, each 3 m wide with a track between pairs, boarding pads in the middle of each platform. Tasks: `tasks` in a seeded queue, each `{ kind: "bag" | "passenger", platform }`; at most `parallel` tasks are open at the entrance at once (L1 1, L4+ 2). Timetable: each open task's train arrives at the platform `arriveS` after the task opens and leaves `dwellS` later; the leave time is the task's deadline. Passengers follow with `arrive` at 3.0 m/s, gap 1.0 m, and the 1.2 s free-point rule from the firefighter. Crowd NPCs (`crowd`, L3+) wander on the concourse (`wander` + `separate`) as solid circles. A missed task: `loseLife()` (3 lives) and the next task opens. Wrong platform: Use does nothing but a buzz (no stun, no cost). Score: +100 per delivery, +50 if more than half of that train's dwell was left, and on win +5 per full second left. Each task pays once.

**End.** Win: every task delivered or missed with lives left, and at least `tasks − 1` delivered. Lose: lives 0. Timeup: shell.

**Camera.** Fixed-ish follow, pitch 58°, `followFocus` with a wide reach so two platforms are always in view, bounds the station, `shift: true`.

**HUD.** Score, time, lives. Stats: `Delivered` (max = tasks). A game `Hud` (`data-arcade-safe-area`) lists the open tasks with platform shape + number and a shrinking bar for each train's dwell.

**Look.** Platform `#cbd5e1`, edge strip `#facc15`, track bed `#57534e`, accent `#38bdf8`. Platform colours: blue circle, green square, orange triangle, purple diamond, red star, teal drop. L1 `day`, L2 `day`, L3 `indoor` (canopy roof), L4 `sunset`, L5 `night`. Worker 1.78 m, `charStationWorker.glb`, untinted, `carryPose` with the bag. Trains: `trainCarV2.glb` cars (two per train) behind a locomotive stand-in, sliding in on the track with `spring` easing. Passengers: unrigged `<Model>` with `waddle` until `passengerNpc` exists.

**Hyper3D.** `menu1-train-station-rush/`: `charStationWorker.glb`, `trainCarV2.glb` (leave `trainCar.glb`, tram proportions), `platformCanopy.glb` (benches baked in; usable), `platformSign.glb` (one per platform, canvas plate on its face), `stationBench.glb` (instanced), `stationClock.glb` (the timetable's face), `stationTrolley.glb` (decor; the bag rides in your hands), `backpack.glb` (a task bag type), `ticketMachine.glb` (decor at the entrance; text-like marks, keep it in the background). Leave `locomotive.glb` (a whole multi-car train set) and `train-station-rush/hero.glb`. Core: `EXPANSION_ASSETS.suitcase` (the other bag type), `REUSED_ASSETS.bench`, `REUSED_ASSETS.lamp`.

**Hyper3D still needed.** `locomotiveFront` (one engine car to lead each train), `passengerNpc` (a stylised, T-pose-free standing passenger; `travellerNpc.glb` is photoreal with hands in pockets; shared with 32 and 37), `ticketMachineClean` (no text-like marks).

**Draw calls.** About 40. Platforms instanced, train cars one dynamic pool, passengers one pool. Cap 60.

**Levels.**

```ts
export interface StationLevel {
   platforms: number;
   tasks: number;
   passengerShare: number; // 0..1 of tasks that are passengers
   parallel: number;
   arriveS: number;
   dwellS: number;
   crowd: number;
   durationMs: number;
   lighting: "day" | "indoor" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, StationLevel> = {
   1: { platforms: 2, tasks: 4, passengerShare: 0, parallel: 1, arriveS: 4, dwellS: 22, crowd: 0, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { platforms: 4, tasks: 6, passengerShare: 0.34, parallel: 1, arriveS: 4, dwellS: 22, crowd: 0, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { platforms: 4, tasks: 8, passengerShare: 0.4, parallel: 1, arriveS: 3, dwellS: 20, crowd: 6, durationMs: 180_000, lighting: "indoor", background: "#475569" },
   4: { platforms: 4, tasks: 10, passengerShare: 0.4, parallel: 2, arriveS: 3, dwellS: 24, crowd: 8, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   5: { platforms: 6, tasks: 12, passengerShare: 0.5, parallel: 2, arriveS: 3, dwellS: 22, crowd: 10, durationMs: 210_000, lighting: "night", background: "#0f172a" },
};
```

Tile lines: 1 2 Platforms, "Four bags, two trains at a time." 2 4 Platforms, "Some travellers need walking to the train." 3 Central Station, "A crowd on the concourse." 4 Rush Hour, "Two tasks open at once." 5 Mega Station, "Six platforms, twelve departures."

**Score-limit sketch.** `Bobj = 150 * tasks`. Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2 Platforms | 600 | 30 | 1050 | 600 | 15 | 1100 | 120000 |
| 2 | 4 Platforms | 900 | 48 | 1410 | 900 | 11 | 1470 | 150000 |
| 3 | Central Station | 1200 | 65 | 1775 | 1200 | 9 | 1850 | 180000 |
| 4 | Rush Hour | 1500 | 80 | 2000 | 1500 | 7 | 2080 | 180000 |
| 5 | Mega Station | 1800 | 100 | 2350 | 1800 | 6 | 2450 | 210000 |

`minDurationMs = 4000`. 2450 / 1100 ≤ 3. Tasks open on a queue (the next opens when one resolves), so `M` is the sum of the walks; the arrival delay `arriveS` is part of it.

**Tests.** A bag handed to the wrong platform does not score and does not cost a life. A task resolves exactly once (delivered or missed). The follower never stops inside a track bed (free-point rule test with a crowd NPC in the gap). `parallel: 1` never shows two open tasks. Every platform pad is reachable (200 seeds).

**Risks.** Players read colour first: the shape + number plate is mandatory on the task card, the sign and the pad. A follower plus a crowd can deadlock in a doorway; the free-point rule is the fix and needs a test. Two trains sliding in at once on L5 is the perf peak: one car pool.

**Core gaps.** No timetable UI (game `Hud`). No train actor (a sliding pool). No follower helper (local, like firefighter).

---

## 45. Pizza Kitchen 3D (`pizza-kitchen-3d`)

**Order 45 · points · difficulty 2 · skill · owner claude.** One open kitchen. A ticket shows the pizza: sauce, cheese, toppings. Build it on the prep counter in that order, slide it into the oven, take it out while it is golden and serve it. Later levels run two ovens and two tickets.

**Controls.** On-foot mover, radius 0.36, top speed 4.2. `actionPressed` within 1.2 m of a station: dough station (lay a base on the counter), a bowl (add that ingredient to the pizza on the counter), oven (put in / take out), serve hatch (serve), box (L5: box it before serving). `touchControls: ["joystick", "action"]`, Action label "Use". Scheme `joystick`. No jump. A wrong ingredient stun is 0.50 s, both devices.

**Core loop.** Read the ticket → Use the dough → Use sauce, cheese, then each topping in ticket order → Use the oven (the pizza leaves the counter) → wait for the golden window → Use the oven again → Use the hatch → next ticket. A wrong ingredient spoils the pizza (it goes in the bin, start again from dough).

**rules.ts.** Kitchen `width × depth` with a counter line along the back: dough, sauce, cheese, `toppingTypes` topping bowls, then the oven(s), the box station (L5) and the hatch. `orders` tickets, seeded; each ticket = sauce + cheese + 0–2 toppings from the types in play (L1 no toppings: a cheese pizza). At most `parallel` tickets open (L3+ 2). Ovens: `ovens` slots; bake `bakeS`, then a golden window `goldenS`, then burnt (a burnt pizza is binned on take-out, ticket stays open). Ticket patience (`patienceS`, L4+): an expired ticket leaves (no points, no life). Score: +150 per correct pizza served, +50 if taken out in the first 1.5 s of the golden window ("perfect bake"), +30 if the ticket's patience was above half when served, and on win +4 per full second left. A ticket pays once. Spoiled and burnt pizzas pay 0.

**End.** Win: every ticket served (expired tickets on L4–L5 count against the quota: `orders − expired ≥ quota` with `quota = orders − 1`). Lose: none on L1–L3 (time only); on L4–L5, when the quota can no longer be met, `end("lose")` at once. Timeup: shell.

**Camera.** Fixed, pitch 60°, the whole kitchen in view (`useFittedView` area = the kitchen), `shift: true`. No follow: the room is small.

**HUD.** Score, time. Stat `Served`. A game `Hud` (`data-arcade-safe-area`) shows the open tickets as rows of ingredient icons (shape + colour), the next step highlighted, and each oven's bake ring (core `TimingRing`, zones = the golden window, `judgeTiming` grades the take-out).

**Look.** Tiles `#f5f5f4`, counter wood `#a16207`, oven glow `#f97316`, accent `#ef4444`. L1–L2 `indoor`, L3 `indoor` with warmer light, L4 `sunset` (window light), L5 `night` with the oven glow as the key accent. Chef: `REUSED_ASSETS.chef` (the food-catcher chef, `CHEF_LANDMARKS`, 1.82 m), untinted, `reachPose` toward the counter on each Use, `carryPose` with the peel while carrying to the oven. The pizza on the counter is layered discs in code over `pizzaBase.glb` (sauce disc, cheese disc, topping instances), so the build reads at a glance.

**Hyper3D.** `menu1-pizza-kitchen-3d/`: `pizzaBase.glb`, `sauceBowl.glb`, `cheeseBowl.glb`, `mushroomBowlR.glb` (leave `mushroomBowl.glb`, no bowl), `oliveBowl.glb`, `pepperoni.glb` (the topping instance and, in a bowl stand-in, the bowl's pile), `tomato.glb`, `onion.glb`, `pizzaOven.glb` (one per oven), `pizzaPeel.glb` (a flat paddle with a painted pizza: usable in the hand), `prepCounterR.glb` (leave `prepCounter.glb`, a display case; instanced along the back wall). Leave `pizzaBox.glb` and `pizzaBoxV2.glb` (both open with a pizza showing) until the L5 box station has a closed box. Core: `REUSED_ASSETS.chef`, `REUSED_ASSETS.bin` (the spoil bin), `SHARED_ASSETS.crate` (flour sacks stand-in).

**Hyper3D still needed.** `pizzaBoxClosed` (a closed, flat pizza box for the L5 box station and the hatch stack), `pizzaPeelClean` (a plain wooden peel without the painted pizza, so the carried pizza is the real one).

**Draw calls.** About 35. Bowls one model each, toppings instanced per type, ovens instanced. Cap 50.

**Levels.**

```ts
export interface PizzaLevel {
   orders: number;
   toppingTypes: number; // 0..5 from pepperoni, mushroom, olive, tomato, onion
   maxToppings: number;
   parallel: number;
   ovens: number;
   bakeS: number;
   goldenS: number;
   patienceS: number; // 0 = tickets wait
   boxStep: boolean;
   durationMs: number;
   lighting: "indoor" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, PizzaLevel> = {
   1: { orders: 3, toppingTypes: 0, maxToppings: 0, parallel: 1, ovens: 1, bakeS: 5, goldenS: 5, patienceS: 0, boxStep: false, durationMs: 120_000, lighting: "indoor", background: "#fef3c7" },
   2: { orders: 4, toppingTypes: 2, maxToppings: 2, parallel: 1, ovens: 1, bakeS: 5, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 150_000, lighting: "indoor", background: "#fde68a" },
   3: { orders: 6, toppingTypes: 3, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 4, patienceS: 0, boxStep: false, durationMs: 180_000, lighting: "indoor", background: "#fdba74" },
   4: { orders: 8, toppingTypes: 4, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3.5, patienceS: 45, boxStep: false, durationMs: 180_000, lighting: "sunset", background: "#fb923c" },
   5: { orders: 10, toppingTypes: 5, maxToppings: 2, parallel: 2, ovens: 2, bakeS: 6, goldenS: 3, patienceS: 40, boxStep: true, durationMs: 210_000, lighting: "night", background: "#431407" },
};
```

Tile lines: 1 Cheese Pizza, "Sauce, cheese, oven, serve." 2 Two Toppings, "Toppings in ticket order." 3 Restaurant Rush, "Two ovens, two tickets." 4 Multiple Orders, "Tickets do not wait forever." 5 Master Pizza Night, "Box it before it goes out."

**Score-limit sketch.** `Bobj = 230 * orders` (150 + 50 + 30). Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Cheese Pizza | 690 | 40 | 1010 | 690 | 8 | 1060 | 120000 |
| 2 | Two Toppings | 920 | 55 | 1300 | 920 | 7 | 1360 | 150000 |
| 3 | Restaurant Rush | 1380 | 75 | 1800 | 1380 | 6 | 1880 | 180000 |
| 4 | Multiple Orders | 1840 | 95 | 2180 | 1840 | 4 | 2270 | 180000 |
| 5 | Master Pizza Night | 2300 | 120 | 2660 | 2300 | 3 | 2770 | 210000 |

`minDurationMs = 4000`. 2770 / 1060 ≤ 3. The bake time is a hard floor on `M` (`orders × bakeS / ovens` plus walking); the oracle must use both ovens on L3+.

**Tests.** A topping out of ticket order spoils the pizza. Take-out at the first frame of the golden window is perfect, at +1.5 s it is not. Burnt pays 0 and leaves the ticket open. Two ovens bake independently. L1 tickets have no toppings. Patience expiry pays 0 once.

**Risks.** A pure order-entry game can feel like a menu: the walk between bowls is the game, so bowls are spaced 1.6 m apart and the counter is long. Two tickets on one counter: there is one pizza on the counter at a time (a second needs the first in the oven), which keeps the rule simple.

**Core gaps.** No ingredient-snapping helper (code discs and instances). The chef is the shared food-catcher chef: no new pizza-chef character.

---

## 46. Jungle Bridge Run (`jungle-bridge-run`)

**Order 46 · points · difficulty 2 · adventure · owner antigravity.** A forward runner through the jungle on three lanes: rope bridges, log crossings, gaps to jump and vines to slide under. Collect gems on the way. Each obstacle section is a checkpoint; falling costs a life and puts you back at the section start.

**Controls.** Auto-run forward at `speed`. Lane change: `pressed.left` / `pressed.right` (A / D, arrows, swipes), 0.18 s per lane. Jump: `jumpPressed` or swipe up (0.55 s, arc 1.3 m). Slide: `pressed.down` or swipe down (0.60 s, hitbox height 0.6). `touchControls: []` (swipes on the canvas; `pressed` already includes swipes, never read `swipe` too). Scheme `runner`. One set of timings on both devices.

**Core loop.** Read the section ahead → change lane, jump the gap, slide under the vine, hop the rolling log → grab gems on the line → pass the section gate (a ruin gate) → next section → the finish.

**rules.ts.** Track = `sections` sections of 24 m, each built from a seeded pattern list: `gap` (a lane set missing for 3 m: jump), `vine` (a low bar across 1–2 lanes: slide), `log` (a rolling log crossing lanes at `logSpeed`: jump or change lane), `bridge` (only one lane has planks for 8 m: be on it), `pillar` (a solid block on one lane: change lane). Every section has at least one clear line through it (generator rule, tested). Gems: `gemsPerSection` per section on the clear line or a riskier one. Falling into a gap or hitting an obstacle: `loseLife()` (3 lives), respawn at the section start after 0.8 s, gems of that section already taken stay taken. L4+: `speed` up and less spacing; L5 adds `lava` vents (timed: a lane is blocked for 1.2 s every 3 s). Score: +100 per section cleared, +20 per gem, and on win +6 per full second left. Each gem pays once.

**End.** Win: the finish line. Lose: lives 0. Timeup: shell (`durationMs` is generous; the clock is a ceiling, not the target).

**Camera.** Behind and above, pitch 28°, look-ahead 8 m, no roll, `CameraRig` follow on z only (x fixed to the track centre so lanes do not swim), `shift: true`.

**HUD.** Score, time, lives. Stats: `Section` (n of sections), `Gems`.

**Look.** Planks `#a16207`, moss `#4d7c0f`, water far below `#0e7490` (`<Water>` 12 m down), accent `#22c55e`. L1 `day`, L2 `day`, L3 `day` with the waterfall backdrop and spray `fx`, L4 `sunset` (temple), L5 `sunset` with red fog and lava glow. Explorer 1.76 m, `charExplorer.glb`, untinted, `walkPose` at 1 (run), `jumpPose` on a jump, a slide is a low lean (`turnBone` on the spine), `flailPose` on a fall, `cheerPose` at the finish. Gems: core kit `<Gem>`.

**Hyper3D.** `menu1-jungle-bridge-run/`: `charExplorer.glb`, `woodenBridge.glb` (the plank lane; rails read as a rustic fence, fine), `ropeBridge.glb` (the L2 bridge sections), `jungleRock.glb` (instanced edge dressing), `templePillarV2.glb` (leave `templePillar.glb`, a carved panel; the pillar obstacle), `waterfallCliff.glb` (L3 backdrop), `ruinGateR.glb` (leave `ruinGate.glb`, its passage is blocked; the section gates). `jungleLog.glb` is two parallel logs: usable as static log crossings, not as the rolling log. `hangingVine.glb` is a shard curtain: background only. `junglePlant.glb` sits in a white pot: do not use it in the jungle. Core: kit `<Gem>`, `EXPANSION_ASSETS.leafyTree` (instanced canopy), `EXPANSION_ASSETS.rock`.

**Hyper3D still needed.** `jungleLogSingle` (one round log that reads as rolling), `hangingVineV2` (a twisted rope vine with leaves, the slide-under bar), `jungleFern` (a wild fern / broad-leaf plant without a pot, instanced), `volcanoBackdrop` (an L5 skyline volcano with a glowing crater).

**Draw calls.** About 45. Track pieces instanced per type, gems one pool. Cap 70.

**Levels.**

```ts
export interface JungleLevel {
   sections: number;
   speed: number;
   gemsPerSection: number;
   patterns: ReadonlyArray<"gap" | "vine" | "log" | "bridge" | "pillar" | "lava">;
   logSpeed: number;
   durationMs: number;
   lighting: "day" | "sunset";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, JungleLevel> = {
   1: { sections: 3, speed: 6.0, gemsPerSection: 3, patterns: ["gap", "pillar"], logSpeed: 0, durationMs: 75_000, lighting: "day", background: "#86efac", fogFar: 70 },
   2: { sections: 5, speed: 6.5, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine"], logSpeed: 0, durationMs: 90_000, lighting: "day", background: "#4ade80", fogFar: 60 },
   3: { sections: 7, speed: 7.0, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log"], logSpeed: 2.5, durationMs: 110_000, lighting: "day", background: "#22c55e", fogFar: 55 },
   4: { sections: 9, speed: 7.8, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log"], logSpeed: 3.2, durationMs: 120_000, lighting: "sunset", background: "#a16207", fogFar: 45 },
   5: { sections: 12, speed: 8.4, gemsPerSection: 3, patterns: ["gap", "pillar", "bridge", "vine", "log", "lava"], logSpeed: 3.6, durationMs: 120_000, lighting: "sunset", background: "#7f1d1d", fogFar: 40 },
};
```

Tile lines: 1 Jungle Path, "Three sections, wide gaps." 2 Rope Bridges, "Only one lane has planks." 3 Waterfall, "Logs roll across the path." 4 Ancient Temple, "Faster, closer." 5 Volcano Jungle, "Twelve sections and lava vents."

**Score-limit sketch.** `Bobj = 100 * sections + 20 * gems` (`gems = 3 * sections`). Speed bonus +6/s on win. `M` is bounded below by `sections * 24 / speed` (the run cannot go faster than the track); the proof replaces it with the oracle's finish time, which includes the jump arcs.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Jungle Path | 480 | 30 | 750 | 480 | 9 | 780 | 75000 |
| 2 | Rope Bridges | 800 | 42 | 1088 | 800 | 7 | 1140 | 90000 |
| 3 | Waterfall | 1120 | 55 | 1450 | 1120 | 6 | 1510 | 110000 |
| 4 | Ancient Temple | 1440 | 62 | 1788 | 1440 | 6 | 1860 | 120000 |
| 5 | Volcano Jungle | 1920 | 70 | 2220 | 1920 | 5 | 2310 | 120000 |

`minDurationMs = 4000`. 2310 / 780 = 2.96 ≤ 3: tight. If the proof raises L5, lower the L5 speed bonus to +5/s rather than breaking the 3× rule. The auto-run makes the earliest finish almost fixed: `M` from the formula above is close to the oracle (L1 3 × 24 / 6 = 12 s of track plus the run-in; the table's 30 s includes the section gates' 1.5 s pause; the proof will lower `M` and raise pps).

**Tests.** Every section has a clear line (200 seeds, all patterns). Slide clears a vine, a jump does not; a jump clears a gap, a slide does not. A fall respawns at the section start and keeps that section's gems. Lane change during a jump is allowed and takes the same 0.18 s. Lava blocks only during its window.

**Risks.** A swipe-only touch scheme must feel instant: `pressed` from swipes fires mid-gesture (core). The 0.18 s lane change and the 3 m gap at 8.4 m/s leave 0.36 s to read: keep L5 patterns spaced at least 10 m. Rope bridge look vs collision: the plank lane is the rule, the mesh is dressing.

**Core gaps.** No lane-runner helper (local, like obstacle-race). No slide pose (spine lean with `turnBone`).

---

## 47. Magic Carpet Ride (`magic-carpet-ride`)

**Order 47 · points · difficulty 2 · adventure · owner cursor.** A rail flight. The carpet glides along a winding route over a desert town, a canyon, clouds, a night city and a floating palace. You steer within a window around the route: through rings, onto stars, around floating rocks and towers. Boost to finish sooner; reach the end with enough rings and stars to clear.

**Controls.** The carpet advances along a `core/path` spline at `speed`. `moveX` / `moveY` move the carpet inside a window around the path: ±4 m sideways, ±2.5 m up and down, offset speed 5 m/s with an ease (`spring`). Hold `jump` (Space, touch "Boost") to fly at `speed × 1.5` while stamina > 0 (30 per second, refills 12/s, a 1.00 s lock at 0, same as the bee). `touchControls: ["joystick", "jump"]`, Jump label "Boost". Scheme `flight`. Up on the stick is up (no inversion), on both devices.

**Core loop.** Line up with the next ring → pass through it (+50, a chime, a sparkle) → drift onto the stars between rings → dodge the rock or tower in the window → the finish arch at the end of the route.

**rules.ts.** Route: a seeded closed-to-open spline through `rings` ring positions (each ring at an offset inside the window), total length `length` m. A ring is passed when the carpet crosses the ring's plane within 1.2 m of its centre (ring radius 1.5 minus the carpet's half-width). Stars: `stars` placed on the lines between rings, collected on overlap (radius 0.7). Obstacles: `rocks` floating rocks / towers placed in the window, never on a ring's line and never within 6 m of a ring (generator rule); a hit outside a 1.0 s mercy spends a life (3 lives) and knocks the offset back to the path centre. L3+: `movers` rocks drift up and down on a sine (period 3 s, amplitude 1.5 m). Score: +50 per ring, +30 per star, and on win +4 per full second left. A ring and a star pay once.

**End.** At the finish: win when `ringsPassed ≥ ringQuota` and `starsTaken ≥ starQuota`, else `end("lose")` (the result shows what was missing). Lose: lives 0. Timeup: shell.

**Camera.** Chase on the path tangent, 5 m behind and 1.8 m above the carpet, pitch 12° down, look-ahead 10 m along the path, no roll (the carpet banks, the camera does not), `shift: true`.

**HUD.** Score, time, lives. Stats: `Rings` (passed / quota), `Stars` (taken / quota), `Boost` 0–100. The next ring has a soft glow; missed rings dim.

**Look.** Desert `#fcd34d` sand, rooftop terracotta `#c2410c`, rings gold `#fbbf24`, accent `#a78bfa`. L1 `day`, L2 `sunset` (canyon), L3 `day` with white fog (clouds), L4 `night` with hanging lanterns lit (emissive), L5 `sunset` with the floating palace ahead. Rider 1.72 m, `charCarpetRider.glb`, untinted, seated cross-legged with a game-local sit (`turnBone` hips / knees), arms forward with `aimArm`, `bank` from `core/motion` on the carpet body, a `hover` ripple on the carpet mesh. Trail `fx` while boosting.

**Hyper3D.** `menu1-magic-carpet-ride/`: `charCarpetRider.glb`, `magicCarpet.glb`, `flyingRing.glb` (instanced), `palaceTower.glb` (the tower obstacle and L5 skyline), `desertRooftopV2.glb` (leave `desertRooftop.glb`; the town below, instanced), `cloud.glb` (instanced, L3 obstacles that only slow: +0, no life), `hangingLantern.glb` (L4 dressing between towers), `canyonMesa.glb` (L2 walls, outside the window), `floatingPalaceR.glb` (leave `floatingPalace.glb`, a shard mess; the L5 finish). Leave `floatingRock.glb` and `floatingRockV2.glb` (both have the spike on top, not a pointed underside) until a regeneration; the floating-rock obstacle is a bevelled two-tone stand-in until then. Shared ready: `star.glb`. Leave `magic-carpet-ride/hero.glb`.

**Hyper3D still needed.** `floatingRockV3` (a flat-topped rock with a pointed underside, the main obstacle).

**Draw calls.** About 40. Rings, stars, rooftops and clouds instanced. Cap 60.

**Levels.**

```ts
export interface CarpetLevel {
   length: number;
   speed: number;
   rings: number;
   ringQuota: number;
   stars: number;
   starQuota: number;
   rocks: number;
   movers: number;
   durationMs: number;
   lighting: "day" | "sunset" | "night";
   background: string;
   fogFar: number;
}

export const LEVELS: Record<LevelId, CarpetLevel> = {
   1: { length: 420, speed: 9, rings: 8, ringQuota: 6, stars: 8, starQuota: 5, rocks: 3, movers: 0, durationMs: 120_000, lighting: "day", background: "#fde68a", fogFar: 120 },
   2: { length: 600, speed: 10, rings: 12, ringQuota: 9, stars: 12, starQuota: 8, rocks: 6, movers: 0, durationMs: 150_000, lighting: "sunset", background: "#fb923c", fogFar: 110 },
   3: { length: 780, speed: 10.5, rings: 16, ringQuota: 12, stars: 15, starQuota: 10, rocks: 8, movers: 4, durationMs: 180_000, lighting: "day", background: "#e0f2fe", fogFar: 70 },
   4: { length: 880, speed: 11, rings: 20, ringQuota: 15, stars: 18, starQuota: 12, rocks: 10, movers: 6, durationMs: 180_000, lighting: "night", background: "#1e1b4b", fogFar: 80 },
   5: { length: 1100, speed: 11.5, rings: 25, ringQuota: 19, stars: 22, starQuota: 15, rocks: 14, movers: 8, durationMs: 240_000, lighting: "sunset", background: "#7c2d12", fogFar: 100 },
};
```

Tile lines: 1 Desert Village, "Eight rings over the rooftops." 2 Canyon, "Tighter turns between the walls." 3 Cloud Kingdom, "Rocks drift up and down." 4 Night City, "Lanterns light the way." 5 Floating Palace, "Twenty-five rings to the palace."

**Score-limit sketch.** `Bobj = 50 * rings + 30 * stars` (every ring and every star placed). Speed bonus +4/s on win. `M` = `length / (speed × 1.5)` with full boost, longer in practice (stamina): the proof's oracle boosts whenever it can.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Desert Village | 640 | 40 | 960 | 640 | 8 | 1000 | 120000 |
| 2 | Canyon | 960 | 55 | 1340 | 960 | 7 | 1400 | 150000 |
| 3 | Cloud Kingdom | 1250 | 70 | 1690 | 1250 | 7 | 1760 | 180000 |
| 4 | Night City | 1540 | 80 | 1940 | 1540 | 5 | 2020 | 180000 |
| 5 | Floating Palace | 1910 | 100 | 2470 | 1910 | 6 | 2570 | 240000 |

`minDurationMs = 4000` (a crash run can end early). 2570 / 1000 ≤ 3. The route length sets a hard floor on the run time: check the L1 floor (420 / 13.5 ≈ 31 s) against `M` in the proof.

**Tests.** A ring crossed at 1.19 m from the centre counts, at 1.21 m it does not. Crossing a ring's plane outside the ring does not count and does not cost a life. Finish without the quota is `"lose"`, with it `"win"`. Obstacles never within 6 m of a ring (200 seeds). Boost lock lasts 1.00 s.

**Risks.** Rail flight can feel like a ride with no control: the window must be wide enough that missing a ring is the player's fault and the rocks sit inside it. Motion comfort: no camera roll, no sudden drops; the spline is smoothed (`smooth: true`). The seated rider is the `sitPose` gap.

**Core gaps.** No rail-flight helper (`core/path` + a local window). No `sitPose`. No ring helper (plane-crossing test in `rules.ts`).

---

## 48. Toy Store Night Shift (`toy-store-night-shift`)

**Order 48 · points · difficulty 2 · skill · owner kimi.** After closing, the store is a mess. The night guard picks up each scattered toy and puts it back on the shelf with its sign: bears with bears, cars with cars. Wind-up toys roll the aisles and knock the toy out of your hands.

The plan's player is a toy robot. `toyRobot.glb` is not a T-pose (arms hang down), so it cannot go through the auto-rig. The player is the night guard (`charNightGuard`, clean T-pose), and the toy robots become the wind-up hazards. Flag this to the user at the gate if they want the robot as the hero (that needs a T-pose regeneration).

**Controls.** On-foot mover, radius 0.38, top speed 4.4, × 0.9 while carrying. `actionPressed` within 1.2 m: pick up the nearest toy (one at a time; L4+ two, stacked), or drop at the shelf you face. `touchControls: ["joystick", "action"]`, Action label "Use". Scheme `joystick`. No jump. Wrong-shelf stun 0.50 s, both devices.

**Core loop.** Find a toy (the guard's torch cone and a `<TargetMarkers>` arrow on the nearest one) → pick it up → read the shelf signs (shape + colour + toy icon) → drop it on the match → next.

**rules.ts.** Store `aisles` aisles of shelves (each shelf 4 m, solid AABB), categories `categories` from teddy / car / airplane / ball / blocks / train / robot, one shelf per category (L3+ two shelves per category, either is right). `toys` toys on the floor, ≥ 1.5 m apart, never inside a shelf, mixed categories. Carry cap `carry` (1, or 2 on L4+: drop puts the top one; a wrong top blocks the other). Wind-up hazards (`windups`): toy robots and toy cars on `stepPatrol` loops in the aisles at `windupSpeed`; overlap outside a 0.80 s mercy drops the carried toys on the floor where you stand (no lives). Wrong shelf: the toy falls back to the floor at the shelf, 0.50 s stun. Score: +80 per toy placed right, +20 if no wrong drop happened since the previous right one, and on win +4 per full second left. A toy pays once.

**End.** Win: every toy on its shelf. Lose: none (no lives). Timeup: shell.

**Camera.** Follow, pitch 58°, `followFocus` with the aisle bounds, `shift: true`. The shelves are low enough (1.6 m) that the floor between aisles stays in view at this pitch.

**HUD.** Score, time. Stats: `Shelved` (max = toys), `Carrying`. The carried toy's category icon shows over the guard's head as a canvas plate.

**Look.** Floor `#e2e8f0` tiles, shelf `#f472b6` / `#60a5fa` trims per category, accent `#f472b6`. Night: L1–L2 `indoor` with the store lights half on, L3 `night` (warehouse), L4 `indoor` (mega store), L5 `night` with only the torch and the emergency strips. Guard 1.80 m, `charNightGuard.glb`, untinted, `carryPose`, a core kit `<Flashlight light={false}>` on the guard (the lit floor sector, no spot light). Wind-ups: `toyRobot.glb` as a `<Model>` with a `waddle`, `toyCar.glb` with a `hop`.

**Hyper3D.** `menu1-toy-store-night-shift/`: `charNightGuard.glb`, `teddyBear.glb`, `toyCar.glb`, `toyAirplane.glb`, `toyBall.glb`, `toyTrain.glb`, `toyRobotProp.glb` (the robot category toy), `toyRobot.glb` (the wind-up hazard, unrigged), `toyShelf.glb` (small toys are baked onto its shelves; usable until the empty shelf exists), `toyBlocks.glb` (has A / B letters on its faces; the blocks category), `toyBin.glb` (filled with gem shapes; decor at most). Core: `SHARED_ASSETS.crate` (warehouse level), `EXPANSION_ASSETS.cart` (decor in the aisles, solid), kit `<Flashlight>`.

**Hyper3D still needed.** `toyShelfEmpty` (an empty toy-store shelf unit, so the sorted toys are the ones on it), `toyBlocksPlain` (a stack of four blocks without letters), `toyBinPlush` (a bin full of plush toys, decor).

**Draw calls.** About 40. Shelves instanced, toys instanced per category, wind-ups one pool per mesh. Cap 60.

**Levels.**

```ts
export interface ToyLevel {
   aisles: number;
   categories: number;
   shelvesPerCategory: number;
   toys: number;
   carry: 1 | 2;
   windups: number;
   windupSpeed: number;
   durationMs: number;
   lighting: "indoor" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, ToyLevel> = {
   1: { aisles: 2, categories: 3, shelvesPerCategory: 1, toys: 5, carry: 1, windups: 0, windupSpeed: 0, durationMs: 120_000, lighting: "indoor", background: "#fce7f3" },
   2: { aisles: 3, categories: 4, shelvesPerCategory: 1, toys: 8, carry: 1, windups: 1, windupSpeed: 1.4, durationMs: 150_000, lighting: "indoor", background: "#fbcfe8" },
   3: { aisles: 4, categories: 5, shelvesPerCategory: 2, toys: 10, carry: 1, windups: 2, windupSpeed: 1.6, durationMs: 180_000, lighting: "night", background: "#1e293b" },
   4: { aisles: 4, categories: 6, shelvesPerCategory: 2, toys: 14, carry: 2, windups: 3, windupSpeed: 1.8, durationMs: 180_000, lighting: "indoor", background: "#f9a8d4" },
   5: { aisles: 5, categories: 7, shelvesPerCategory: 2, toys: 18, carry: 2, windups: 4, windupSpeed: 2.0, durationMs: 210_000, lighting: "night", background: "#0f172a" },
};
```

Tile lines: 1 Toy Shelf, "Five toys, three shelves." 2 Store Floor, "A wind-up robot is loose." 3 Warehouse, "Two shelves for each kind." 4 Mega Toy Store, "Carry two at once." 5 Toy Chaos, "Eighteen toys, four wind-ups, lights out."

**Score-limit sketch.** `Bobj = 100 * toys`. Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Toy Shelf | 500 | 30 | 860 | 500 | 12 | 900 | 120000 |
| 2 | Store Floor | 800 | 45 | 1220 | 800 | 10 | 1270 | 150000 |
| 3 | Warehouse | 1000 | 58 | 1488 | 1000 | 9 | 1550 | 180000 |
| 4 | Mega Toy Store | 1400 | 75 | 1820 | 1400 | 6 | 1900 | 180000 |
| 5 | Toy Chaos | 1800 | 95 | 2260 | 1800 | 5 | 2360 | 210000 |

`minDurationMs = 4000`. 2360 / 900 ≤ 3. Carry 2 on L4–L5 lowers `M`: the proof's oracle carries pairs.

**Tests.** A wrong drop pays 0, stuns 0.50 s and leaves the toy at the shelf. The clean bonus resets on a wrong drop. Carry never exceeds `carry`. A wind-up hit drops every carried toy and pays 0. Every toy and every shelf front is reachable (200 seeds; aisles ≥ 1.4 m wide).

**Risks.** Colour-only signs fail on night levels: the icon plate (toy silhouette + shape) is mandatory. Baked toys on `toyShelf.glb` confuse the read until the empty shelf exists; tint them down or accept until then.

**Core gaps.** No sign / plate mesh (canvas plates). The plan's robot hero needs a T-pose regeneration (not in this design).

---

## 49. Aquarium Cleaner (`aquarium-cleaner`)

**Order 49 · points · difficulty 2 · adventure · owner kimi.** A diver walks the floor of a giant aquarium in lead boots. The task list: scrub the algae patches on the glass, pick up the trash and drop it in the basket, and check each filter machine. Air runs down; refill it in the bubble column. Later tanks add a patrolling shark and a current.

**Controls.** On-foot mover, radius 0.38, top speed 3.0 (water drag), accel 12. Hold `action` (E / Enter, touch "Work") for 1.00 s within 1.2 m of an algae patch or 1.50 s at a filter machine; releasing or leaving resets the hold. Trash collects on overlap (carry up to 3) and empties on overlap with the basket. `jumpPressed` floats up 0.9 s (arc 1.8 m): high algae patches can only be scrubbed while floating above 1.0 m (the hold pauses while you are too low). `touchControls: ["joystick", "action", "jump"]`, Action "Work", Jump "Float". Scheme `joystick`. Holds and the float are the same constants on both devices.

**Core loop.** Read the list → walk to a task (marker on the nearest open one) → hold Work, or pick up trash → refill air in the bubble column when it gets low → tick the list → the exit hatch opens when the list is done → stand on it to win.

**rules.ts.** Tank `width × depth`, glass on three sides (algae patches sit on the glass, some at 2 m height on L2+), rocks and the castle as solids. Tasks: `algae` patches, `trash` items (each binned item is one task), `filters` machines; `tasks = algae + trash + filters`. Air 100, drains `airDrain` per second, ×1.5 while working; the bubble column (radius 1.2) refills 25/s. At 0: `loseLife()` (3 lives), respawn at the entry with full air, carried trash drops where you were. Shark (`sharks`, L3+): `stepPatrol` along the tank at `sharkSpeed`, a 1.0 m overlap outside the 0.80 s mercy costs 30 air and pushes you 1.5 m. Current (L5): constant `(0.5, 0)` m/s² in world x. Score: +120 per task, +30 if that task finished with air above 50, and on win +4 per full second left. Each task pays once.

**End.** Win: every task done and the diver on the exit hatch. Lose: lives 0. Timeup: shell.

**Camera.** Follow, pitch 50° (lower than most so the glass and the high algae read), bounds the tank, `shift: true`.

**HUD.** Score, time, lives. Stats: `Tasks` (done / total), `Air` 0–100. A game `Hud` (`data-arcade-safe-area`) shows the task list with icons (scrub, trash, gear) and ticks.

**Look.** Sand `#f5deb3`, water fog `#0f766e`, glass edge `#99f6e4` (a thin emissive frame), algae patches `#4d7c0f` decals that fade as the hold fills, accent `#2dd4bf`. L1–L2 `day`, L3 `indoor` (a tunnel ceiling), L4 `day`, L5 `night` with blue emissive accents. Diver 1.78 m, `charDiver.glb`, untinted, slow walk (`walkPose` 0.4, stride from `walkStride` at 0.6 × speed), spine pitched 10° forward, `jumpPose` on a float, `reachPose` toward the patch while scrubbing, scrubber in `handR` via `attach`. Bubbles `fx` from the helmet every 1.5 s. Fish: `tropicalFish.glb` schools, visual only.

**Hyper3D.** `menu1-aquarium-cleaner/`: `charDiver.glb` (no air tank on the mesh), `aquariumScrubber.glb` (in the hand), `plasticBottle.glb` (trash), `tropicalFish.glb` (schools), `aquariumCastle.glb` (the centre-piece, solid), `aquariumRock.glb` (solid, instanced). Leave `filterMachine.glb` / `filterMachineV2.glb` (wrong objects: a green tank, a water cooler) and `bubbleStation.glb` / `bubbleStationV2.glb` (glass domes, no air hose); the filter is a bevelled two-tone machine stand-in and the bubble column is a code column of `fx` bubbles over a ring. Shared ready: `coral.glb`, `coralV2.glb`, `seaweed.glb` are broken shard meshes; do not adopt. Leave `aquarium-cleaner/hero.glb`. Core: `SHARED_ASSETS.tinCan` (trash), `REUSED_ASSETS.bottle` (trash), `EXPANSION_ASSETS.fish`, `EXPANSION_ASSETS.crab` (decor on the sand).

**Hyper3D still needed.** `filterMachineV3` (a chunky aquarium filter unit with pipes and a gauge), `bubbleStationV3` (an air-stone base with a hose, the bubble column's foot), `scubaTank` (a back tank to `attach` on the diver), `shark` (the L3+ patrol creature, friendly-stylised), `trashBasket` (the mesh basket by the entry), plus the shared `coralBranch` and `seaweedKelp` (see 42).

**Draw calls.** About 40. Rocks, coral and seaweed instanced, fish pools, trash one pool. Cap 60.

**Levels.**

```ts
export interface AquariumLevel {
   width: number;
   depth: number;
   algae: number;
   highAlgae: number; // of the algae patches, how many need a float
   trash: number;
   filters: number;
   airDrain: number;
   sharks: number;
   sharkSpeed: number;
   current: boolean;
   durationMs: number;
   lighting: "day" | "indoor" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, AquariumLevel> = {
   1: { width: 16, depth: 12, algae: 1, highAlgae: 0, trash: 1, filters: 1, airDrain: 1.2, sharks: 0, sharkSpeed: 0, current: false, durationMs: 120_000, lighting: "day", background: "#5eead4" },
   2: { width: 20, depth: 14, algae: 2, highAlgae: 1, trash: 1, filters: 1, airDrain: 1.3, sharks: 0, sharkSpeed: 0, current: false, durationMs: 150_000, lighting: "day", background: "#2dd4bf" },
   3: { width: 24, depth: 14, algae: 2, highAlgae: 1, trash: 2, filters: 1, airDrain: 1.4, sharks: 1, sharkSpeed: 1.6, current: false, durationMs: 180_000, lighting: "indoor", background: "#115e59" },
   4: { width: 26, depth: 18, algae: 2, highAlgae: 1, trash: 2, filters: 2, airDrain: 1.5, sharks: 1, sharkSpeed: 1.9, current: false, durationMs: 180_000, lighting: "day", background: "#0d9488" },
   5: { width: 30, depth: 20, algae: 3, highAlgae: 2, trash: 3, filters: 2, airDrain: 1.5, sharks: 2, sharkSpeed: 2.0, current: true, durationMs: 210_000, lighting: "night", background: "#042f2e" },
};
```

Task counts 3, 4, 5, 6, 8 (the plan's). Tile lines: 1 Small Tank, "Scrub, pick up, check the filter." 2 Tropical Tank, "One patch is high: float up." 3 Shark Tunnel, "Keep clear of the shark." 4 Giant Aquarium, "Two filters to check." 5 Deep Sea Exhibit, "Eight tasks, a current, two sharks."

**Score-limit sketch.** `Bobj = 150 * tasks`. Speed bonus +4/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Tank | 450 | 30 | 810 | 450 | 12 | 850 | 120000 |
| 2 | Tropical Tank | 600 | 42 | 1032 | 600 | 11 | 1080 | 150000 |
| 3 | Shark Tunnel | 750 | 55 | 1250 | 750 | 10 | 1300 | 180000 |
| 4 | Giant Aquarium | 900 | 68 | 1348 | 900 | 7 | 1410 | 180000 |
| 5 | Deep Sea Exhibit | 1200 | 90 | 1680 | 1200 | 6 | 1750 | 210000 |

`minDurationMs = 4000`. 1750 / 850 ≤ 3. The air bonus is inside `Bobj` (+30 each); the oracle refills before a task when air is near half so it earns every bonus.

**Tests.** A high patch does not progress while the diver is below 1.0 m. Releasing Work resets the hold. Air 0 costs one life and drops the carried trash. A shark hit costs 30 air once per mercy. The exit does not win before the list is done. Every task reachable, high patches reachable with a float from the floor (200 seeds).

**Risks.** "Swim" without swimming: the lead-boot walk and the float must read as underwater (bubbles, slow gait, fog). A shark in a narrow tank can pin the diver: the patrol loops leave a 2 m lane. The diver has no tank on the mesh; until `scubaTank` exists a code cylinder on the back reads fine.

**Core gaps.** No swim pose (see the table). No glass shader (an emissive frame and a slight fog tint). Algae decal fade is a material opacity in code.

---

## 50. Postman 3D (`postman-3d`)

**Order 50 · points · difficulty 2 · skill · owner claude.** Walk a small neighbourhood with a mailbag. Each letter shows a house number and its colour; deliver at that house's mailbox. Parcels go to the front door and you can carry only one. Later streets add a barking dog, traffic, and a bag that needs a refill at the post office.

**Controls.** On-foot mover, radius 0.38, top speed 4.6, × 0.85 while carrying a parcel. `actionPressed` within 1.2 m: deliver the top letter at a mailbox, the parcel at a front door, or refill at the post-office counter. `touchControls: ["joystick", "action"]`, Action label "Deliver". Scheme `joystick`. No jump. Wrong-address stun 0.40 s, both devices.

**Core loop.** Read the next item on the list (number + colour + letter / parcel icon) → find the house (house plates, a marker on L1–L2 only) → Deliver → the next item. Bag empty with items left → back to the post office to refill.

**rules.ts.** Streets: `streets` straight streets in a grid, houses on both sides (`houseA` / `B` / `C` in rotation, each with a number plate and a colour), mailbox at each front path, door 3 m behind it. Items: `letters` + `parcels` in a seeded list order; the bag holds `bagCap` letters; a parcel is carried in the hands (one at a time, picked up at the post office). Delivering in list order pays the route bonus; any order is allowed. Dog (`dogs`, L3+): a yard dog runs out along a short leash path when you pass within 4 m, overlap outside a 0.80 s mercy stuns 0.60 s (no life). Traffic (`traffic`, L4+): cars on the street loop (`REUSED_ASSETS.car`), a swept hit spends a life (3 lives) and stuns 0.60 s. Wrong mailbox: 0.40 s stun, the letter stays in the bag. Score: +100 per delivery, +40 if it was the next item in list order, and on win +5 per full second left. Each item pays once.

**End.** Win: every item delivered. Lose: lives 0 (L4–L5 only; L1–L3 have no lives). Timeup: shell.

**Camera.** Follow, pitch 52°, look-ahead 2 m, bounds the neighbourhood, `shift: true`. House plates face the street and are at least 0.35 m tall so they read on a phone.

**HUD.** Score, time; lives on L4–L5. Stats: `Delivered` (max = items), `Bag`. A game `Hud` (`data-arcade-safe-area`) shows the next three items as number + colour chips with a letter / parcel icon. `<TargetMarkers>` on the next address on L1–L2 only (the later levels make you read the street).

**Look.** Road `#64748b`, pavement `#cbd5e1`, lawns `#86efac`, accent `#ef4444`. L1–L2 `day`, L3 `sunset`, L4 `day`, L5 `night` with Victorian lamps lit and holiday lights (emissive strings in code). Postman 1.78 m, `charPostman.glb`, untinted, `walkPose`, `reachPose` toward the mailbox on Deliver, `carryPose` with a parcel, mailbag on the hip via `attach`. Dog: `dog.glb` from `menu1-dog-park-fetch/` as a `<Model>` with a `hop`, tinted per yard.

**Hyper3D.** `menu1-postman-3d/`: `charPostman.glb`, `letter.glb` (the delivery puff and the bag top), `mailbag.glb` (on the hip), `mailbox.glb` (instanced, one per house), `houseA.glb`, `houseB.glb`, `houseC.glb` (instanced per type), `postOffice.glb` (the refill point), `postVan.glb` (parked by the post office, solid), `streetLampVictorian.glb` (instanced), `bicycle.glb` (parked decor; thin spokes, keep it near the camera's far side). Shared ready: `picketFence.glb` (front yards, instanced), `trafficLight.glb` (L4–L5 junctions). From `menu1-dog-park-fetch/`: `dog.glb`. Core: kit `<Parcel>` (parcels), `REUSED_ASSETS.door` (front doors, instanced), `REUSED_ASSETS.bench`, `REUSED_ASSETS.car` (traffic pool). Leave `postman-3d/hero.glb`.

**Hyper3D still needed.** `holidayTree` (a decorated tree for the L5 holiday rush street; until then emissive light strings on the existing houses).

**Draw calls.** About 40. Houses instanced per type (3), mailboxes, doors, fences and lamps instanced, one car pool. Cap 60.

**Levels.**

```ts
export interface PostLevel {
   streets: number;
   housesPerStreet: number;
   letters: number;
   parcels: number;
   bagCap: number;
   dogs: number;
   traffic: number;
   trafficSpeed: number;
   markers: boolean;
   durationMs: number;
   lives?: number;
   lighting: "day" | "sunset" | "night";
   background: string;
}

export const LEVELS: Record<LevelId, PostLevel> = {
   1: { streets: 1, housesPerStreet: 6, letters: 4, parcels: 0, bagCap: 4, dogs: 0, traffic: 0, trafficSpeed: 0, markers: true, durationMs: 120_000, lighting: "day", background: "#bae6fd" },
   2: { streets: 2, housesPerStreet: 6, letters: 4, parcels: 2, bagCap: 4, dogs: 0, traffic: 0, trafficSpeed: 0, markers: true, durationMs: 150_000, lighting: "day", background: "#7dd3fc" },
   3: { streets: 2, housesPerStreet: 8, letters: 6, parcels: 2, bagCap: 6, dogs: 2, traffic: 0, trafficSpeed: 0, markers: false, durationMs: 180_000, lighting: "sunset", background: "#fdba74" },
   4: { streets: 3, housesPerStreet: 8, letters: 7, parcels: 3, bagCap: 4, dogs: 2, traffic: 3, trafficSpeed: 4.0, markers: false, durationMs: 180_000, lives: 3, lighting: "day", background: "#93c5fd" },
   5: { streets: 3, housesPerStreet: 10, letters: 10, parcels: 4, bagCap: 5, dogs: 3, traffic: 4, trafficSpeed: 4.5, markers: false, durationMs: 210_000, lives: 3, lighting: "night", background: "#0f172a" },
};
```

Item counts 4, 6, 8, 10, 14 (the plan's). Tile lines: 1 Small Street, "Four letters, one street." 2 Neighborhood, "Parcels go to the door." 3 Village, "Find the numbers yourself. Mind the dogs." 4 City District, "Traffic, and a refill halfway." 5 Holiday Rush, "Fourteen deliveries after dark."

**Score-limit sketch.** `Bobj = 140 * items` (`items = letters + parcels`). Speed bonus +5/s on win.

| L | title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Street | 560 | 28 | 1020 | 560 | 17 | 1070 | 120000 |
| 2 | Neighborhood | 840 | 42 | 1380 | 840 | 13 | 1440 | 150000 |
| 3 | Village | 1120 | 58 | 1730 | 1120 | 11 | 1800 | 180000 |
| 4 | City District | 1400 | 72 | 1940 | 1400 | 8 | 2020 | 180000 |
| 5 | Holiday Rush | 1960 | 100 | 2510 | 1960 | 6 | 2620 | 210000 |

`minDurationMs = 4000`. 2620 / 1070 ≤ 3. The route bonus is only earned in list order: the oracle delivers in list order, and the proof checks that the list order is never much longer than the shortest tour (the generator orders the list along the street so a sane route earns it).

**Tests.** A wrong mailbox stuns 0.40 s and keeps the letter. A parcel can only go to a door, a letter only to a mailbox. The bag never exceeds `bagCap`; the refill puts back at most `bagCap`. Out-of-order delivery pays 100, in order 140. L1–L3 have no lives (a car never spawns there). Every mailbox and door reachable (200 seeds).

**Risks.** Reading house numbers on a phone is the core skill and the risk: plate size and contrast are tested in a 390 × 844 playtest. Traffic on a narrow street can feel unfair: cars stop at crossings (zebra rects) when the postman is on them.

**Core gaps.** No address-plate helper (canvas plates). No vehicle-yield rule in core (local).

---

## Asset index

Ready folders checked 2026-10-25 against `%USERPROFILE%\.play50\hyper3d\archive2\LEDGER.md`. "Adopt" is the file the assets PR should load. "Skip" stays on disk.

| Game | Ready folder | Adopt | Skip |
|---|---|---|---|
| dog-park-fetch | `menu1-dog-park-fetch/` | `dog.glb`, `tennisBall.glb`, `frisbee.glb`, `fetchStick.glb`, `parkFountain.glb`, `agilityTunnel.glb`, `agilityHurdleR.glb` | `agilityHurdle.glb`, `dogHouse.glb`, `dogHouseR.glb`, `dogBone.glb`, `dogBoneV2.glb` |
| submarine-treasure-dive | `menu1-submarine-treasure-dive/` | `miniSubmarine.glb`, `amphora.glb`, `anchor.glb`, `pearlShellV2.glb`, `rockArch.glb`, `ruinColumn.glb` | `pearlShell.glb`, `shipwreckHull.glb`, `shipwreckHullR.glb` (unless the user accepts an upright hull) |
| mars-rover-mission | `menu1-mars-rover-mission/` | `marsRover.glb`, `marsBase.glb`, `commsAntenna.glb`, `groundSolarPanelV2.glb`, `chargingStation.glb`, `sampleRock.glb`, `beaconLight.glb`, `researchCrate.glb`, `landingCapsule.glb`, `marsMesaRock.glb` (as wall pieces), `charAstronaut.glb` | `marsRoverV2.glb`, `groundSolarPanel.glb` |
| train-station-rush | `menu1-train-station-rush/` plus `hero.glb` | `charStationWorker.glb`, `trainCarV2.glb`, `platformCanopy.glb`, `platformSign.glb`, `stationBench.glb`, `stationClock.glb`, `stationTrolley.glb`, `backpack.glb`, `ticketMachine.glb` | `trainCar.glb`, `locomotive.glb`, `hero.glb` |
| pizza-kitchen-3d | `menu1-pizza-kitchen-3d/` | `pizzaBase.glb`, `sauceBowl.glb`, `cheeseBowl.glb`, `mushroomBowlR.glb`, `oliveBowl.glb`, `pepperoni.glb`, `tomato.glb`, `onion.glb`, `pizzaOven.glb`, `pizzaPeel.glb`, `prepCounterR.glb` | `mushroomBowl.glb`, `prepCounter.glb`, `pizzaBox.glb`, `pizzaBoxV2.glb` |
| jungle-bridge-run | `menu1-jungle-bridge-run/` | `charExplorer.glb`, `woodenBridge.glb`, `ropeBridge.glb`, `jungleRock.glb`, `templePillarV2.glb`, `waterfallCliff.glb`, `ruinGateR.glb`, `jungleLog.glb` (static crossings) | `templePillar.glb`, `ruinGate.glb`, `junglePlant.glb`, `hangingVine.glb` (background only) |
| magic-carpet-ride | `menu1-magic-carpet-ride/` plus `hero.glb` | `charCarpetRider.glb`, `magicCarpet.glb`, `flyingRing.glb`, `palaceTower.glb`, `desertRooftopV2.glb`, `cloud.glb`, `hangingLantern.glb`, `canyonMesa.glb`, `floatingPalaceR.glb` | `desertRooftop.glb`, `floatingPalace.glb`, `floatingRock.glb`, `floatingRockV2.glb`, `hero.glb` |
| toy-store-night-shift | `menu1-toy-store-night-shift/` | `charNightGuard.glb`, `teddyBear.glb`, `toyCar.glb`, `toyAirplane.glb`, `toyBall.glb`, `toyTrain.glb`, `toyRobotProp.glb`, `toyRobot.glb` (hazard), `toyShelf.glb`, `toyBlocks.glb` | `toyBin.glb` (decor at most) |
| aquarium-cleaner | `menu1-aquarium-cleaner/` plus `hero.glb` | `charDiver.glb`, `aquariumScrubber.glb`, `plasticBottle.glb`, `tropicalFish.glb`, `aquariumCastle.glb`, `aquariumRock.glb` | `filterMachine.glb`, `filterMachineV2.glb`, `bubbleStation.glb`, `bubbleStationV2.glb`, `hero.glb` |
| postman-3d | `menu1-postman-3d/` plus `hero.glb` | `charPostman.glb`, `letter.glb`, `mailbag.glb`, `mailbox.glb`, `houseA.glb`, `houseB.glb`, `houseC.glb`, `postOffice.glb`, `postVan.glb`, `streetLampVictorian.glb`, `bicycle.glb` | `hero.glb` |

Shared ready files these ten use: `picketFence.glb` (41, 50), `trafficLight.glb` (50), `civilianNpc.glb` (41, owner stand-in), `star.glb` (47). Do not adopt `coral.glb`, `coralV2.glb` or `seaweed.glb` (broken shard meshes). Cross-folder reuse: `tropicalFish.glb` and `aquariumRock.glb` (49 → 42), `canyonMesa.glb` (47 → 43), `dog.glb` (41 → 50).

Auto-rig these humanoids after the assets PR measures them: station worker, explorer, carpet rider (seated), night guard, diver, postman, astronaut (decor). The dog, the toy robot, the owner stand-in and the passengers stay unskinned. The pizza chef is the already-rigged `REUSED_ASSETS.chef`.

Core meshes these specs count on: `REUSED_ASSETS.bench`, `umbrella`, `door`, `car`, `lamp`, `bin`, `bottle`, `chef`; `EXPANSION_ASSETS.leafyTree`, `chest`, `rock`, `fish`, `suitcase`, `cart`, `crab`; `SHARED_ASSETS.coin`, `crate`, `tinCan`; kit `<Gem>`, `<Parcel>`, `<Flashlight>`, `<Fence>`.

The union of every "Hyper3D still needed" list (games 31–50) is `docs/menu1-new/hyper3d-needed.md`.
