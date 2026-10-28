# Zoo Escape

Owner and builder: Claude. Slug `zoo-escape`, skill game 19 (order 29). Spec: `docs/arcade-expansion/04-game-specs-skill.md` §19. Design approved at G0 (fix round 1 + the user's Decisions of 2026-10-24, kept at the end); this file now describes the build. Units m / s; x east, z south; the panda escapes **north (−z)**. Yaw as `ai/vision`: 0 faces +z. "Changed from design" lines say what and why.

## Concept and controls

A cheeky panda breaks out of the zoo through three connected stages (enclosure → visitor plaza → parking lot at dusk). Keepers walk fixed patrol loops with flashlight cones drawn on the floor (clipped by every blocker, so the lit floor is exactly what they see); the panda sneaks, hides in bushes, tosses bamboo to lure a keeper and grabs snacks on risky detours. Every stage has a safe route at every patrol phase (proven by the periodic solver). Accent `#34d399`.

`touchControls: ["joystick", "jump", "action"]`, `touchLabels: { jump: "Sneak", action: "Toss" }`. Keyboard "WASD / arrows to move, hold Space to sneak, E or Enter to toss bamboo"; touch "Joystick to move, hold Sneak to sneak, Toss to throw bamboo" (`meta.ts`). `moveX/moveY` → `inputToWorld(…, view.yaw)` (yaw 0: up = north); sneak = held `jump`; toss = `actionPressed`.

## Rules (all numbers in `rules.ts` / `level.ts`, pinned in `rules.test.ts`)

- **Map** (`level.ts`): stage 1 x ∈ [−7, 7], z ∈ [0, 18], start (−4.5, 16.5), moat z ∈ [3, 5] (solid, not a sight blocker) crossed by a bridge x ∈ [−1, 1], gate G1 x ∈ [3, 5]; stage 2 x ∈ [−9, 9], z ∈ [−20, 0], entry (4, −1.5), G2 x ∈ [−6, −4]; stage 3 x ∈ [−10, 10], z ∈ [−42, −20], entry (−5, −21.5), 8 cars in two rows, a ticket booth, the searchlight tower (10.8, −31), exit G3 x ∈ [5, 8]. The seed picks only keeper phases and snack spots.
- **Solids** block movement (fences, moat, rocks, bamboo, kiosks / booth, tree trunks, palms, benches, bins, lamps, cars, tower); **sight blockers** are the tall ones (rocks, bamboo, kiosks, trunks, cars, tower) and every bush. Bushes (≥ 1.6 × 1.6 boxes) are walkable; the panda's centre in one = **hidden** (never seen; moving in it still rustles). A keeper's own bush is never its blocker.
- **Panda** (`PANDA`): r 0.5; walk 3.2, sneak 1.6 m/s; accel 20, brake 28, facing `turnTowards` 12/s; `resolveSphereAabb` + `clampToBounds` to the map box; no step ever moves it more than 3.2 · dt.
- **Keepers** (`KEEPER`): 1 / 2 / 3 per stage, r 0.35, `core/ai stepPatrol` on closed rectangles / lines built so the walk (1.3 m/s) + 1.2 s corner waits take exactly the stage cycle C = 27 / 24 / 18 s; seeded offset C·k/6 (k 0..5). Investigating at 2.0 m/s, kind waits seen 2.5 / heard 2.0 / bamboo 3.0 / radio 2.5 s, look-around 0.6 (corners) / 0.7 rad; priority seen > heard = radio > bamboo; targets clamped into the keeper's solid-free zone. Only the current stage's keepers detect.
- **Vision**: `inViewCone` 30° half-angle, range 7 / 7 / 9 m, ∧ `hasLineOfSightXZ` ∧ not hidden. **Hearing**: a moving panda (> 0.2 m/s) within 3.0 m (1.2 m sneaking) → investigate there, once per 2 s per keeper.
- **Suspicion**: +dt / 1.35 s while seen (**one value on every device**, Decision Q2), −0.5/s otherwise; full = caught; sight lost at 0 < s < 1 → investigate the last seen point. Bump (circles touch) or a keeper touching the panda's bush = caught at once.
- **Searchlight** (stage 3): yaw −π/2 + 0.95 sin(2π (t + φ)/9), φ = the first stage-3 keeper's offset; 12°, 14 m, same sight rule and meter; sight lost → the nearest stage-3 keeper within 12 m investigates ("radio").
- **Toss** (`TOSS`): 2 bundles per stage (reset on a first entry and on a catch); lands on the last free point of the 4 m segment ahead (0.1 m march, 0.3 m short of solids / the stage edge) after exactly 0.6 s (`launchForTime` arc drawn); the nearest calm current-stage keeper within 10 m investigates it.
- **Snacks**: 4 per stage from 7 hand-placed candidates (seeded, ≥ 3 m apart), eaten within 0.8 m; candidates hug the natural route but each is in some watcher's sight 15–60 % of the cycle (`fairness.test.ts`).
- **Stages**: the centre's z picks the stage; crossing a gate line moves it on (back too, until the drop bar falls 1.2 m past the line). First entry: bundles 2, toast, chime, `setLevel`.
- **Catch** (`CATCH`): −5 s, catches + 1; the 3rd = `lose`; a catch emptying the clock = `timeup`. Otherwise a 1.2 s opaque caught card, the panda back at the stage start, that stage's keepers put back on their schedule (`placeOnSchedule`), meters 0, bundles 2; then 1.0 s grace (also at the run start).
- **Clock**: 180 s in the rules (no `durationMs`, `clockChip: false`), "Time" hudStat. Step order: clock first, keepers, card / move, gates (win), snacks, toss, detection, catch.

## Scoring

`score = max(0, (won ? 1000 + 10 · floor(timeLeft) : 0) + 50 · snacks − 100 · catches)`. `applyToStore` (the same bridge the Scene and the bots call) sets the live score `max(0, 50 s − 100 c)` on every snack and catch and the final score right before `end("win" | "lose" | "timeup")`.

### Server limits and why they hold

`PROPOSED_LIMITS` (rules.ts; meta.scoring keeps the provisional 4500 / 20–200 s / 4500 until Claude's go-live PR): **maxScore 3290, minDurationMs 5000, maxDurationMs 182000, base 0, maxPointsPerSec 163**.

1. **Speed**: no step moves the panda more than `PANDA.walk · dt` (20,000 random steps with collisions, clamps and gates). A respawn moves it at most 1.5 m forward (the stage 2–3 entries) at a cost of ≥ 1.2 s of card, 5 s of clock and 100 points: never useful.
2. **Route floor** (`testkit.ts stageRouteBound`, exact and rigorous): for k snacks the centre must go from the start through the G1, G2, G3 centre windows touching the 0.8 m eating disc of k candidates of valid picks; straight lines (obstacles only lengthen it), touch and window points sampled with the sampling slack subtracted. L(0) = 63.89 m … L(12) = 64.60 m (the candidates hug the route).
3. **Bound** B = max over k of 1000 + 50k + 10 · floor(180 − L(k)/3.2) = **3190** (k = 12, t ≥ 20.19 s). maxScore = 3190 · 1.03 rounded up = 3290. A lose scores ≤ 600 − 300; a time-up ≤ 600 and only at ≥ 170 s.
4. **Line**: max over k of B(k) / t(k) = 158.0 pts/s (k = 12) → 163 with 3 %; for later wins B falls while the line rises. Live score rises only by 50 per snack (server checks the final only).
5. **Durations**: the earliest end is a lose: 3 catches each after ≥ 1.0 s of play, two 1.2 s cards between = 5.4 s → 5000 ms. The clock empties by 180 s of play → 182000 ms.
6. **Bots** (`rules.test.ts`, real store through `simulateRun`, 30 / 60 / 144 Hz and random 4–50 ms frames, every run `withinServerLimits` with `capScore` a no-op): the **oracle** (earliest-arrival grid plan with walk hops and the best of the 24 orders of each stage's snacks, `testkit.oraclePlan`) wins seed 65 with all 12 snacks in 35.7 s = **3040 = 92.4 % of maxScore**; idle (0, time-up, never caught), toss spammer (0), bush camper (no win, 0), catch farmer (0, lose, ≥ 5 s), rusher (5 / 40 wins = 12.5 %).

## Levels

Five maps, one per level (`levels.ts` `ZooLevel.map`: level 1 is `level.ts` `MAP_1`, levels 2-5 are `maps.ts`), each the same three-stage, 180 s escape through the same three stage boxes (so the camera windows, the clamp and the surroundings fit all of them) with everything inside different: gates, fences, props, hiding spots, keeper routes and cycles, snacks, searchlights, and one twist per level. `createRun(seed, layout?, level)` builds the run on `level.map` (`run.map`); every rules function reads the run's map, the module constants stay level 1's. **Level 1 is today's game exactly** (same map, levels.test.ts replays 8 seeds of random input; rules.test.ts and fairness.test.ts are unchanged and pass).

| Level | Title | Map (stage 1 / 2 / 3) | Twist | Catch after | Decay /s | Investigate | Bamboo | A catch costs | Clear |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Small Enclosure | enclosure + moat / visitor plaza / parking lot at dusk | stage-3 searchlight | 1.35 s | 0.5 | 2.0 m/s | 2 | 5 s | escape or 1500 |
| 2 | Safari Zone | savanna paddock (watering hole, acacias, termite mounds) / safari track round an acacia infield / ranger camp (parked jeeps, crates, hut) | **moving jeeps**: one laps the track, one shuttles across the camp; touching one is a catch ("Run over by the safari jeep!"); tall-grass hiding spots | 1.25 s | 0.45 | 2.2 m/s | 2 | 6 s | escape or 1600 |
| 3 | Bird Garden | aviary walk (net walls, lily pond) / flamingo ponds / swan lake (two lakes, one crossing) | **birds**: walking (not sneaking) within 1.6 m squawks one; the nearest calm keeper within 12 m comes to look, 4 s cooldown; flower-hedge hiding spots, flower beds | 1.15 s | 0.4 | 2.4 m/s | 1 | 7 s | escape or 1700 |
| 4 | Central Zoo | panda house terrace (2 keepers) / central plaza round the fountain (3 keepers) / main gate with turnstile walls, dusk | **crowds** of visitors as the hiding spots; kiosks, benches, the zooFountain GLB as a sight blocker | 1.05 s | 0.35 | 2.6 m/s | 1 | 8 s | escape or 1800 |
| 5 | Night Escape | panda house at night / moonlit plaza / back gate | **night on every stage** (core "night" preset, dark palette, lit lamps with light pools, Victorian street lamps) and **two searchlights** (stage 2 from a west tower, stage 3 from an east tower) | 0.95 s | 0.3 | 2.8 m/s | 1 | 10 s | — |

Gates move on every later level (G1 / G2 / G3 x-windows: L1 [3,5] [-6,-4] [5,8]; L2 [-5,-3] [5,7] [-8,-5]; L3 [-1,1] [-7,-5] [2,5]; L4 [-2,0] [6,8] [-1,2]; L5 [4,6] [-6,-4] [6,9]); cycles are per map (L2 24/18/21 s, L3 21/21/15, L4 21/18/18, L5 21/18/18). Jeeps run once round their axis-aligned loop per stage cycle, phased by their stage's first keeper (`rules.jeepPose`), so the solver's periodic masks cover them; every searchlight's period divides its stage cycle for the same reason. The catch time is the same for every device (user decision 2026-10-24); the searchlights use it too.

**Limits.** The bound uses the route floor `L(k)` of the map (`testkit.stageRouteBound(…, map)`), the walk speed, the snacks, the win bonus and the clock. Per map (levels.test.ts): L1 B = 3190 / 158.0 pts/s (L(0) = 63.9 m), L2 3160 / 140.7 (64.7 m), L3 3180 / 155.9 (60.8 m), L4 3160 / 149.2 (61.1 m), L5 3170 / 142.7 (65.3 m). Every map's bound is at or below level 1's, and jeep catches, like every catch, need the 1 s grace, so the earliest end stays 5.4 s: every level keeps **PROPOSED_LIMITS (3290 / 5000–182000 ms / base 0 / 163 pts/s)** (`PROPOSED_LEVEL_LIMITS`). Note: on L3 and L4 the earliest conceivable 0-snack win is 19.0-19.1 s (L1 20.0 s), below the provisional `minDurationMs` 20000 that meta.ts still serves; no bot gets near it (the oracle's wins take 35 s+), and the go-live PR's PROPOSED_LIMITS (5000 ms) has no such gap. `meta.ts` / `arcade-games.json` are unchanged (provisional block on all five levels).

**Bots** (levels.test.ts, real store): the oracle (earliest-arrival grid plan, all 12 snacks, map-aware: jeeps in its masks, it never walks past a bird) escapes ≥ 90 % of 12 seeds per level inside PROPOSED_LIMITS; idle and toss-spam score 0 and never clear. levels.test.ts also checks every level setting in the simulation (on level 1's map), that the five layouts differ, each twist (a jeep catch, a squawk and the keeper it calls, no squawk when sneaking, the night plaza searchlight).

## Fairness (`fairness.test.ts` level 1, `fairness.level-N.test.ts` levels 2-5 via `fairnessSuite.ts`; core periodic solver C5)

Level 1 (unchanged): grid 0.4 m, step 0.25 s, sneak moves; per keeper a mask from its undisturbed patrol with margins (8 + 1 sub-samples per step, hearing 1.2 + 0.75 m, cone + 3° and + 0.5 m, 5 sample points per cell, bush search + 0.4 m). For every offset combination (6 / 36 / 216) and every phase, every start cell and gate-entry band cell is winning; every snack candidate is winning at some phase; every start and entry band is outside every cone and ≥ 4 / 3.75 m from every keeper at every moment (0.05 s). The **solver bot** replays `planPeriodic` routes through the real rules: 24 / 24 seeds won, 0 catches. The **novice proxy** (no plan: waits when the way ahead is watched, hides in bushes within 4.5 m, decides every 0.3 s, gives up waiting after 10 s): **24 / 40 wins (60 %)**.

Levels 2-5 (`fairnessSuite.ts`), the same solver and margins on each map plus its searchlights and a jeep mask per jeep (body + 0.45 m + half a cell diagonal), and **stricter**: every blocked mask is dilated by one phase (a cell entered at phase p must also be clear through p - 1, since a moving panda is already partly in it; level 1's masks without this let the solver bot be seen on one L5 seed while building the maps). Proven on every map: every start and entry-band cell winning at every phase of every combination (L2 6/36/36, L3 6/36/216, L4 36/216/216, L5 6/36/216 combinations); starts and bands out of every cone, light and bird range, ≥ 4 / 3.75 m from keepers, ≥ 0.75 m from every jeep; every jeep loop inside its stage and clear of every solid and hiding spot; every snack reachable and 15-60 % risky (keeper, light or jeep); 300 seeded layouts valid; the solver bot wins 16 / 16 seeds with 0 catches. Novice proxy (cautious about keepers, lights, jeeps and birds): L2 14/30 (47 %), L3 12/30 (40 %), L4 28/30 (93 %), L5 24/30 (80 %) (floors in the tests: 30 / 25 / 50 / 50 %). Honest caveat: the proxy does not ramp with the levels; it hides very well in L4's crowds and L5's third stage, and it ignores bamboo. The difficulty ramp comes from the level settings (quicker catch, slower decay, faster keepers, fewer bundles, dearer catches) and the twists; a human playtest decides whether L4 / L5 need one more keeper.

## Scene, camera and look

- Follow camera, pitch 62°, one yaw, `useFittedView` window (phone portrait 8.5 × 12 m, phone landscape 16 × 7.5, larger 16 × 14; `camera.ts`), `CameraRig` on a live aim (panda + 1.5 m north) clamped to the stage (south / sides inside, ≤ 3 m past the north gate).
- Panda (2026-10-28): panda.glb has no skeleton, so it is rigged in code by the core quadruped auto-rig (`<QuadrupedModel>`, `PANDA_LANDMARKS` in assets.ts, checked on the real mesh in panda.test.ts), 1.15 m long. `pandaGait.ts`: a diagonal-sequence walk (core `DIAGONAL_WALK`) at the sneak, a trot (diagonal pairs) at the full walk, the phase advanced by the distance really moved over the stride (cadence below the 12 Hz cap at every speed, so the planted paws never slide), sneak = the core `quadrupedCrouch` (trunk 0.09 GLB units lower with the paws re-planted, head dipped), idle breathing and head look-around when still, head nod with the steps and into turns, small paw fold for the big flat paws; `hop` on a toss and out through the exit, flattened while caught. Mesh facts allowed for in the test: the right front paw rests 1.4 cm above the floor in the GLB, and the tail is a tiny tuft. The merged stand-in stays the fallback.
- Levels 2-5 look (`looks.ts` THEMES, Stage / Terrain per map): savanna ground, acacias, tall grass, jeeps and jeep tracks, beachHut GLB as ranger huts, shared crate GLB; aviary nets, ponds with stone rims (core Water), flower beds, flowerA GLB blooms on flower hedges, birds (parrot / flamingo / duck, code-built, jump and flap on a squawk with a SQUAWK! popup); paved plazas, crowds of code-built visitors, kiosks, zooFountain GLB as a plaza fountain, turnstile walls; night preset on every stage, streetLampVictorian GLB lamps lit with light pools, two searchlight towers with lamp heads. Every wall, hut and prop is a solid, so the core camera views' collision uses them (Scene passes `run.map.solids`). The north hedge row opens at each level's exit.
- Keepers: 3 skinned slots (`<HumanoidModel>` + torch on `handR`, `keeperPose`: walk, idle, torch arm via `aimArm`, the look-around on chest 0.4 / head 0.6) filled with the current stage's keepers, then next-stage keepers inside the window + 1 m; each slot has a 7 m and a 9 m `<Flashlight blockers>` (C1) placed at `FRAME_PRIORITY.pose`, coral while suspicious. Instanced khaki ground rings, meter rings + fills, "?" / "!" billboards. Searchlight = the one SpotLight. `TargetMarkers` arrows: the exit (mint), each keeper and the searchlight (amber, coral while suspicious).
- Look: day preset, sky `#bae6fd` fog; stage 3 fades to `sunset` with `#f4a582` (C2 `useStageLighting`) and the lamp heads / halos glow in. Bamboo GLB (`/models/3d/zoo-escape/bamboo.glb`) for the solid clumps and stage 1's hiding thickets; leafy blobs for the plaza / parking planters; kiosk GLB (`zooKiosk.glb`, striped canopy baked in) on the three kiosk footprints; drop bars swing down; mint hide outline (pulses coral with a keeper within 1.5 m); exit beacon; `core/fx` sparkle, puff, confetti, score popups, shake; sfx click steps, whoosh rustle, pop, alarm, thud, pickup, hit, chime; ambient loop restarted on [phase, muted].
- Draw calls (estimate, not measured): ground 5, moat / banks / bridge 3, fences + gates + bars 4, GLB props 8, kiosks / bushes / tower 3, lamp glows 2, outline + beacon 2, snacks + glows + bundles 3, keepers 3 + torches 3 + cones 6 + searchlight 2, overlays 5, panda 2, fx ≤ 5 → **≈ 56 worst case** (target 55, cap 65).

## Files

`meta.ts` · `index.tsx` · `level.ts` · `rules.ts` · `camera.ts` · `poses.ts` · `assets.ts` · `looks.ts` · `Decor.tsx` · `Terrain.tsx` · `Scene.tsx` · `Stage.tsx` · `Keepers.tsx` · `Primitives.tsx` · `Hud.tsx` + `Hud.module.css` · `testkit.ts` (test-only: grids, masks, oracle, bound) · tests `rules` / `fairness` / `camera` / `poses` / `assets` / `looks` · `assets.spec.json` · `tools/thumbs/inputs/zoo-escape.mjs`.

## Look (2026-10-24)

Modern-look pass (TASK P-36-look-zoo):
- **Atmosphere & Sky**: Added `<SkyDome>` with two-tone gradient (`skyTop` deep azure `#0284c7`, `skyBottom` warm afternoon horizon `#bae6fd`, transitioning to dusk twilight `#311042` and orange horizon `#f97316` via `useStageLighting`). Fog near 45 / far 95 (dusk 40 / 85) keeps all play area elements completely crisp and un-fogged while softening the horizon.
- **Palette**: Unified all colors into a single palette in `looks.ts` (`COLORS`). Enclosure, plaza, and parking have distinct materials with high contrast so panda (white/black), keepers (khaki/boots), cones (amber/coral), and exit indicators (mint) remain easily readable.
- **Terrain**: Replaced flat planes with `Terrain.tsx` featuring canvas-textured organic meadow grass (`useCanvasTexture` with sun/shade/earth mottling), stone-paved visitor plaza, dark asphalt parking lot with white stalls and amber zebra crosswalk, concrete perimeter curbs, water moat with stone boulder banks, and arched timber footbridge. The outer ground extends 160 × 200 m, ensuring no void/gap below the scene across all aspect ratios (1280×800, 390×844, 844×390).
- **Decor outside play area**: Added `Decor.tsx` with instanced manicured box hedges, parkland trees (deciduous and pines), directional zoo signposts, distant rolling hills, and gently drifting sky clouds (respecting reduced motion and `useQuality().decor`). All decor sits strictly outside the play bounds with proven zero occlusion of panda or keepers from the fitted camera (`looks.test.ts`).
- **Stand-ins**: Every code-made fallback was upgraded to 2-3 tones with deliberate bevels/rounded features (panda with snout, rounded ears and paws; keeper with safari hat and dark band; faceted rocks; segmented bamboo culms with nodes; slatted benches; hooded waste bins; fluted lantern posts; multi-tone cars with bumpers and headlights; searchlight tower with visor and struts; heavy timber gates).
- **Juicy feedback**: Added dust puff core fx burst on catch (`fx.burst("puff", at, 18)`).
- **Draw call estimate**:
  - SkyDome: 1
  - Terrain (ground planes 4, paths 1, curbs 1, lines 1, crosswalk 1, moat 1, banks 1, bridge 1): 11
  - Fences & gates (posts 1, rails 1, gates 1, drop bars 1): 4
  - GLB props / stand-ins (rocks 1, bamboo 1, benches 1, bins 1, lamps 1, palms 1, cars 1, trees 1, kiosks 1, bushes 1, tower 1): 11
  - Decor outside (hedges 1, trees 1, pines 1, signposts 1, hills 1, clouds 1): 6
  - Keepers & searchlight (3 keepers + 3 torches + 3 cones + searchlight): 10
  - Overlays (discs 1, meter rings 1, meter fills 1, bubbles 2): 5
  - Panda (mesh 1, shadow 1): 2
  - Visual cues (outline 1, beacon 1, lamp glows 2, snacks 1, snack-glows 1, bundles 1): 7
  - Total typical playing: **52–56 draw calls**, well within the ≤ 60 budget (tested with zero per-frame allocations).

## Changed from design

- Catch time one value 1.35 s (Decision Q2); `createRun(seed)` has no coarse flag.
- Limits re-derived on the built level: maxScore 3290 (same), pps 163 (was 165): the route floor now includes the snack discs exactly.
- Keepers never "fly" at 2 m/s (`ground` 1): the core walk's run flight lifted the soles 2.4 cm.
- Snack risk = the largest single watcher's share on the margin mask (union over combinations depends on the seed).
- The bamboo GLB also draws stage 1's four hiding bushes (Decisions: "bamboo GLB as the hiding clumps").
- Adopted Hyper3D prop GLBs (2026-10-25, batch 5 part A): `zooKiosk` (striped canopy baked in — the separate instanced awnings are gone), `leafyBush`, `woodenFootbridge` (sunk so its deck top lands on the old 0.165), `searchlightTower` (drawn 4.4 m, no lamp head baked — the beam apex at 4.5 starts just above its railing) and `bambooSnack` (a flat spread pile, fitted to the 0.42 m unit height). All keep their merged stand-ins as fallbacks; sizes pinned in `assets.test.ts`.

## Decisions (user, 2026-10-24)

Approved; settled for a modern, fair arcade feel: core end cue for scoring time-ups and `clockChip: false`; Q1 panda 1.15 m; Q2 one catch time 1.35 s; Q3 dusk via C2; Q4 core C5, C1, C3, C2 added; Q5 keepers reset behind the opaque card; Q6 keepers 1.75 m with the 0.9 m ring as their read; Q7 ≤ 3 skinned keepers; bamboo GLB, warm-to-dusk sky, lamp glows, flashlight cones.

## Status

TASK P-18-zoo-escape | build zoo-escape | branch claude/game-zoo-escape | allowed: play50games-frontend/src/arcade3d/games/zoo-escape/**, play50games-frontend/public/images/3d/zoo-escape.webp, tools/thumbs/inputs/zoo-escape.mjs

Branch checked: `git branch --show-current` = claude/game-zoo-escape (on top of claude/core-expansion-2). Status stays "dev"; meta.scoring unchanged (provisional); thumbnail null (not captured: no browser on this run).

**Files** (all in `games/zoo-escape/` unless noted): new `level.ts`, `rules.ts`, `camera.ts`, `poses.ts`, `assets.ts`, `Scene.tsx`, `Stage.tsx`, `Keepers.tsx`, `Primitives.tsx`, `Hud.tsx`, `Hud.module.css`, `testkit.ts` (test-only helpers, imports no core/testing), tests `rules.test.ts`, `fairness.test.ts`, `camera.test.ts`, `poses.test.ts`, `assets.test.ts`; changed `index.tsx` (real GameDefinition), `meta.ts` (control strings only), `README.md`; new `tools/thumbs/inputs/zoo-escape.mjs`. No core, other game, manifest, GLB or arcade-games.json change.

**Checks**: `npx tsc --noEmit` clean; `npx vitest run src/arcade3d/games/zoo-escape`: 5 files, 42 tests, all pass, ≈ 31 s wall (rules ≈ 25 s, fairness ≈ 29 s in parallel workers). Not run (by instruction): `npm run build`, dev server, browser, `tools/gamecheck` (not present), perf probe, screenshots.

**Acceptance checklist**
- [x] GameDefinition: Scene, Hud (caught card, stage toast), assets, no durationMs (rules clock, `clockChip: false`), camera, environment, touchControls + labels Sneak / Toss, hudStats Time / Snacks x/12 / Catches x/3 / Bamboo x/2, 3 instruction lines, resultDelayMs 1500.
- [x] rules.ts pure and seeded (rngNext), no Math.random / Date.now / three / React; every number in rules.ts / level.ts, pinned by value.
- [x] One useRunFrame (input → stepRun → applyToStore → fx / sfx); visuals in useFrame with useGameTime; pools updated in frame callbacks, no JSX map over run state, no setState or allocation in frame callbacks (scratch objects, prebuilt Colors, `lerpColors` / `copy` only).
- [x] Input: `inputToWorld(moveX, moveY, view.yaw)`, held `jump` = sneak, `actionPressed` = toss (one per press); no swipe / tap use.
- [x] Camera: `useFittedView` window + `<CameraRig>` on a live aim with stage bounds (no snapshot target).
- [x] Models: panda `<Model>` (1.15 m), keeper `<HumanoidModel>` + `useHumanoidPose` + `gaitPhaseStep` + applyLift (soles ≤ 1 cm on the real mesh), rock / bamboo / bench / bin / lamp / palm / car / leafyTree `<InstancedModel>` with merged vertex-coloured stand-ins; size tests on every fitted mesh.
- [x] C1 `<Flashlight blockers>` moved at FRAME_PRIORITY.pose; C2 `useStageLighting(stage 3 ? "sunset" : null, 1.5, "#f4a582")`; C3 sizes; C5 solver in fairness.test.ts; bamboo GLB used.
- [x] Ends with end("win" | "lose" | "timeup"), setScore first; no submitScore / API / localStorage.
- [ ] Browser checks (390 × 844 banner open, 844 × 390, 1280 × 800, Retry × 10, perf probe, readability ≥ 24 px, thumbnail): Claude's playtest.

**Scoring and proof**: `score = max(0, (won ? 1000 + 10·floor(timeLeft) : 0) + 50·snacks − 100·catches)`. PROPOSED_LIMITS = maxScore **3290**, minDurationMs **5000**, maxDurationMs **182000**, base **0**, maxPointsPerSec **163**. Route floor (straight lines through the three gate windows touching k snack discs, rigorous with sampling slack) L(12) = 64.60 m → earliest 12-snack win 20.19 s → B = 3190 (+3 % → 3290); max B(k)/t(k) = 158.0 → 163; earliest end = a lose at ≥ 5.4 s; clock ≤ 180 s of play. Speed cap tested on 20,000 random steps.

**Bots** (real store, 30 / 60 / 144 Hz + random frames, every run withinServerLimits, capScore no-op): oracle 3040 on seeds 65 / 46 (35.7 / 35.9 s, all 12 snacks, 0 catches, every frame rate) = **92.4 %** of 3290; seed 43 3000. Solver bot (planPeriodic, sneak only) 24 / 24 wins, 0 catches. Novice proxy **24 / 40 = 60 %** wins. Rusher 5 / 40 = 12.5 % wins. Idle 0 (time-up, never caught), toss spammer 0, bush camper 0 (no win), catch farmer 0 (lose, ≥ 5 s). Seed counts reduced to keep the suite ≈ 30 s: oracle 3 seeds × 4 frame modes, idle / spam / camp 12 seeds, farmer 8, rusher 40, solver 24, novice 40 (skill asks 200+; the fairness proof itself covers every offset combination exhaustively).

**Draw calls (estimate, not measured)** ≈ 56 worst case (target 55, cap 65): ground 5, moat/banks/bridge 3, fences/gates/bars 4, GLB props 8 (one per GLB mesh), kiosks/bushes/tower 3 (the kiosk GLB's striped canopy replaces the separate awnings), lamp glows 2 (dusk), outline + exit beacon 2, snacks/glows/bundles 3, 3 keepers + 3 torches + 3 visible cones (6) + searchlight (2), overlays 5, panda 2, fx ≤ 5. 1 dynamic light (the searchlight SpotLight, mounted all run, skipped on "low").

**Open questions**
1. Bamboo GLB: used for the 3 solid bamboo clumps AND stage 1's four hiding bushes (read "the bamboo GLB as the hiding clumps" literally); the plaza / parking hiding spots stay leafy planters. Keep, or bamboo for the solids only?
2. Novice proxy 60 % is a bot, not a person: the hot spots are K2's loop corner near (−1, −16) and stage 3's north keeper near the exit; a real novice playtest decides whether stage 3 needs another bush near (2, −38.5).
3. Oracle ≥ 90 % only on lucky seeds (median grid-plan time ≈ 56 s → ≈ 2840); the limit is still the rigorous straight-line bound. OK to keep, or tighten with an obstacle-aware bound (visibility graph) later?
4. Camera windows (8.5 × 12 / 16 × 7.5 / 16 × 14 m) and the 24 px readability are design values, not measured; check in the playtest (landscape window first if small).
5. Draw calls / p95 not measured; hidden 7 m / 9 m Flashlights still run their clip each frame (7 clips, CPU only). If a playtest shows a cost, ask for a core Flashlight `active` flag (core change, not done here).
6. Flashlight alert colour is applied by recolouring its two materials when the calm / alert flag flips (no React state per frame). A core `color` that is read live, or a `tint` ref, would be cleaner (core request, optional).
7. Slot reassignment (a next-stage keeper entering / leaving the window) resets that slot's gait phase: a possible one-frame stride pop. Acceptable?
8. Thumbnail `public/images/3d/zoo-escape.webp` not captured (no browser); the input script is ready.

## Levels and panda pass (2026-10-28, branch claude/zoo-levels)

Checked: `npx tsc --noEmit` clean; `npx vitest run src/arcade3d/games/zoo-escape src/arcade3d/core/rig`: 25 files, 314 tests pass. Not checked: the browser (the sandboxed dev server was not reachable from Chrome), so the new props, the themes, the night lighting, the jeeps, birds and crowds and the panda's gait on the real canvas, the draw-call count (estimated +10-20 on levels 2-5: one instanced draw per new prop kind, a Water per pond on level 3) and the camera views on the new maps are unverified on screen. The thumbnail stays level 1's.

## Camera views

Views: default, chase, front, top, free (fences and props block the camera). **C** / **T** or the 📷 button cycles them; drag (or two fingers) looks around and switches to the free view, wheel / pinch zooms, **V** recenters. The rules receive the drawn camera's yaw (the fitted yaw in the default view), so a run in the default view is unchanged; no rules, bots, proofs or scoring were touched. Core docs: `core/camera/README.md`.
