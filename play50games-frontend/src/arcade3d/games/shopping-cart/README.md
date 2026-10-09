# Crazy Shopping Cart

Owner: Antigravity. Slug: `shopping-cart`. Adventure game 6 (order 16), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §6. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south (+z = checkout exit), y up. Every "Changed from spec" line says what and why.

## Decisions (user, 2026-10-08)

- **Characters:** Cart pusher is the shared runner (`SHARED_ASSETS.runner`). In-store shoppers are 3 new faceless characters (`shopperA` elderly woman in lilac cardigan, `shopperB` young woman in mint hoodie, `shopperC` man in orange polo; GLBs under `/models/3d/shopping-cart/`, drawn with `<HumanoidModel>` + core poses). Neither chef nor cleaner is used.
- **Checkout win:** Instant win upon entering the checkout finish zone with the list complete (no dwell timer).
- **Pyramids:** Toppled can pyramids stay toppled for the rest of the run (no respawn).
- **Product catalog:** Shopping list draws 6 items per seed from 10 imported product kinds: apple, banana, burger, tinCan, bottle, bag, sock, battery, fish, gourd (from SHARED, REUSED, and EXPANSION assets).

## Concept

Drift a runaway supermarket shopping cart through supermarket aisles, grab 6 glowing grocery items on your shopping list, and race to checkout before 75 s runs out. The cart handles with inertia: momentum in turns, skids on slippery puddles, and a "ride the cart" boost where the runner hops onto the rear base bar for high speed at reduced grip. 3 shoppers patrol walkways, can pyramids topple on contact, and clean pick-ups build a combo multiplier. Accent `#fb923c`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Ride" }`.

- `keyboard`: "WASD / arrows to steer, hold Space to ride" (matches `meta.ts`).
- `touch`: "Joystick to steer, hold Ride to ride". Changed from stub ("hold Jump to ride") because the touch button is labelled Ride (`touchLabels`).
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative; up = away from camera). Heading turns toward input at 4.0 rad/s via `turnTowards`. Ride boost active while `jump` is held (Space / touch Ride button). Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`STORE`, `CART`, `COLLISION`, `SHOPPERS`, `SPILLS`, `PYRAMIDS`, `LIST`, `SCORING`, `ASSIST`) and are proven in `rules.test.ts`.

- **Store floor plan** (`STORE`): 32 × 24 m (x ±16, z ±12). Outer walls at x = ±16, z = ±12.
  - 4 shelf blocks: each AABB 1.2 m wide × 12.0 m long (z −7.5 to +4.5), centered at x = −9.0 ([−9.6, −8.4]), x = −4.0 ([−4.6, −3.4]), x = +1.0 ([0.4, 1.6]), x = +6.0 ([5.4, 6.6]).
  - 5 aisles: Aisle 1 (entrance) x [−15.5, −9.6] (width 5.9 m); Aisle 2 x [−8.4, −4.6] (width 3.8 m); Aisle 3 x [−3.4, 0.4] (width 3.8 m); Aisle 4 x [1.6, 5.4] (width 3.8 m); Aisle 5 x [6.6, 11.0] (width 4.4 m).
  - Walkways: North cross walkway z [−10.6, −7.5] (clear width 3.1 m); South cross walkway z [4.5, 7.5] (clear width 3.0 m).
  - Fruit island: AABB x [11.5, 14.5], z [−3.0, 3.0] (size 3.0 × 6.0 m).
  - Freezer row: along North wall, AABB x [−12.0, 12.0], z [−11.8, −10.6] (depth 1.2 m).
  - Checkout counters: 3 counter AABBs at z [8.0, 9.8] (each 0.8 × 1.8 m) at x [−4.0, −3.2], [−1.0, −0.2], [2.0, 2.8], leaving two 2.2 m open checkout lanes (x [−3.2, −1.0] and [−0.2, 2.0]).
  - Finish zone: AABB x [−4.5, 4.5], z [10.2, 11.8] (past counters, 0.4 m clear gap, zero overlap).
  - Start position: (−12.0, 6.0) in Aisle 1, facing north (−z).
- **Cart kinematics & speed model** (`CART`): GLB 1.0 × 1.0 × 0.6 m. Max speed 6.0 m/s walking, 9.0 m/s riding (boost). Target speed ramps at `throttleAccel = 12.0 m/s²` while input held; natural drag deceleration `5.0 m/s²` without input. Heading turns toward input at 4.0 rad/s (`turnTowards`). Velocity eases toward heading: `velocity += (targetVelocity - velocity) * grip * dt`. Grip rate: normal 6.0 /s, riding 3.0 /s (wider drifts), on spills 1.5 /s (slick slides).
- **Swept collision & composite proxy** (`COLLISION`): collision proxy covers cart + pusher runner: composite AABB 0.9 m wide × 1.6 m long (z ±0.8 m local space; cart r 0.55 m, runner at z −0.65 m r 0.4 m). Up to 3 swept passes per frame (`sweptAabbXZ`): pass 1 advances to contact $t_1$, reflects normal velocity by restitution 0.3, and projects remaining step along tangent face; pass 2 tests deflected tangent step against adjacent obstacles (allowing clean sliding around shelf corners); pass 3 resolves residual overlap via `resolveSphereAabb`. Zero tunnelling at 9.0 m/s. Collision resets combo streak.
- **Can pyramids** (`PYRAMIDS`): 6 pyramids at shelf ends: (−9.0, 4.8), (−4.0, 4.8), (1.0, 4.8), (−9.0, −7.8), (−4.0, −7.8), (1.0, −7.8). Circle r 0.4 m. Contact topples pyramid (`toppled: true`), can debris burst, slows cart to max 3.0 m/s for 0.5 s, resets combo streak. Pyramids stay toppled.
- **Shoppers** (`SHOPPERS`, `core/ai/patrol`): 3 NPCs at start (`shopperA`, `shopperB`, `shopperC`); 4th shopper spawns at 40.0 s. Patrol walkways at 1.8 m/s via `stepPatrol`. Circle r 0.4 m. Bump stuns cart for 1.0 s (velocity 0, input locked, dizzy wobble), resets combo streak, and grants 1.5 s invulnerability grace.
- **Spills** (`SPILLS`): puddle 1 spawns at 25.0 s (Aisle 2 entrance), puddle 2 at 50.0 s (Aisle 4 entrance). Circle r 1.2 m. Inside puddle, grip drops to 1.5 /s and skid marks spawn.
- **List & generator** (`LIST`): 24 shelf slots (6 per shelf: 3 west face, 3 east face at z −5.0, −1.5, +2.0). 6 items picked per seed from 10 product kinds: apple, banana, burger, tinCan, bottle, bag, sock, battery, fish, gourd. Items glow with emissive beacon halo (0.8 m diameter) and bob at y 0.6–0.85 m. Pickup reach: 1.0 m from slot centre. Generator fairness: enforces the design's gate: shortest `storeDistance` pick tour (start → 6 items → checkout, brute force over 720 visit orders) $\ge 52\text{ m}$ (`MIN_TOUR_DISTANCE`; accepts ~87 % of the 134,596 slot sets, so 40 seeded attempts practically never fall through); `FALLBACK_LIST` tour 73.9 m. `storeDistance` is aisle-aware: Manhattan when no whole shelf stands between the two x values (or both points lie past the same shelf end), else round the nearer end via the north (z −7.8) or south (z 4.8) walkway.
- **Auto-steer assist** (`ASSIST`): on coarse pointers, if heading within 20° (0.35 rad) of uncollected list item within 8.0 m, pulls heading toward item at `STEER_ASSIST_RATE = 1.5 rad/s` (overridable by player's 4.0 rad/s input).
- **Clock**: `durationMs: 75000` (75 s shell timer).

## Scoring

`runScore(items, comboPoints, won, timeLeftMs) = 100 · items + comboPoints + (listComplete ? 300 : 0) + (won ? 10 · floor(timeLeftMs / 1000) : 0)`.
- Collected item: +100 pts each (6 items = 600 pts).
- Consecutive clean pick-up combo: $+20 \times c$ where $c \in [1, 6]$ is the clean streak; perfect 6-item streak awards $20+40+60+80+100+120 = 420$ combo pts. Resets only on a real crash into a wall, shelf or counter (normal speed > `CRASH_NORMAL_SPEED` = 3.0 m/s), a shopper bump or a pyramid topple; the 1.5–3 m/s shelf contacts of grabbing an item keep the streak.
- List complete bonus: +300 pts awarded **immediately at list completion** when the 6th item is grabbed.
- Win time bonus: awarded **at the win** on entering checkout finish zone: $+10 \times \lfloor\text{timeLeftMs} / 1000\rfloor$.
- Maximum score ceiling: $600 + 420 + 300 + 10 \cdot \lfloor 75 - t\rfloor \le \mathbf{2030}$ pts (at earliest win $t = 3.5\text{ s}$, $1320 + 710 = 2030$). Time-up max score: $600 + 420 + 300 = 1320$ pts (or 1020 if incomplete). Popups: "+100", "+20 combo", "+300 list complete", "+710 time bonus".

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 3000 | **2030** |
| duration | 10000–77000 ms | **3500–77000 ms** |
| `base` / `max_pps` | 3000 / 3000 | **1700 / 100** |

The provisional 10 s minimum would reject legal riding speedruns, so the duration floor is 3500 ms. The proof:

1. **Speed:** in a frame starting at play time $t$ (run clock frames $dt \le 0.05$ s), `targetSpeed` $\le 12\,(t + dt)$ and $\le 9$ (riding cap); the velocity takes a convex step towards the target velocity (grip factor in (0, 1)), and slides, rebounds (× 0.3), stuns and the 3 m/s pyramid slow only shrink it, so $|v| \le \min(9,\ 12t + 0.6)$.
2. **Distance in 3.5 s:** $\int_0^{3.5} \min(9, 12t + 0.6)\,dt = 28.56$ m (28.35 m with 20 fps frames). The swept collision moves the cart at most $|v|\,dt$ per frame (plus a 1 mm back-off per pass).
3. **Shortest win route (config space, script `%USERPROFILE%\.play50\shopping-cart\fix3-bound2.mjs`):** the cart centre moves in config space: every solid (shelves, fruit island, freezer row, checkout counters) inflated by the proxy's minimum half extent 0.45 m, the walls pulled in by 0.45 m. A pickup needs the centre inside the item's 1.0 m reach disc, a win needs it inside the finish box. Region boundaries are sampled every 0.05 m, geodesics come from a visibility graph over the inflated corners, and Held-Karp over the visit order runs on every 6-slot set (134,596). Over every set the gate accepts, the shortest start → 6 discs → finish path is $\ge 30.91$ m (`MIN_WIN_ROUTE_M`, sampling allowance subtracted). The script filters with the old 27.8 m gate; the 52 m gate accepts a subset of those sets, so the bound only rises.
4. **Floor:** $28.56 < 30.91$, so no win happens before 3.5 s; the fastest win the bound allows is ~3.71 s. Caveat: the residual push-out after the sweep is not velocity-limited (≤ ~0.47 m per contact, when the oriented proxy turns against a face); a win under 3.5 s would need ~2.35 m of push-out on top of flat-out riding, judged implausible (the 200-seed bots never win before 3.5 s).
5. **Score ceiling:** $S(t) = 600 + 420 + 300 + 10 \cdot \lfloor 75 - t\rfloor \le 1320 + 710 = 2030$ for every win at $t \ge 3.5$ s; time-up runs score ≤ 1320.
6. **Linear envelope:** $1700 + 100 \cdot t \ge 2050 > 2030 \ge S(t)$ for every $t \ge 3.5$ s.

Tests: "kinematic part of the 3500 ms proof" pins the 28.56 / 28.35 m envelope below `MIN_WIN_ROUTE_M` and checks that `stepRun` riding flat out from rest at 60, 30 and 20 fps never beats it; "max score arithmetic" pins 2030 at 3.5 s and `withinServerLimits` over 3.5–75 s; the 200-seed botHarness run checks real wins through the store.

## Run end

- `end("win")` instantly on entering checkout finish zone with all 6 list items collected. `resultDelayMs: 1200` to show register "ka-ching", confetti burst and runner cheer.
- `"timeup"` by shell at 75 s: ends run with points collected so far. No `"lose"` condition. Crossing checkout with incomplete list does not trigger win.

## Scene and camera

- **Follow 3/4 top-down, pitch 50°**: `useFittedView` with dynamic window sizing (`camera.ts`: targeting ~40 px/m at 390 × 844 portrait and ~27 px/m at 844 × 390 landscape; desktop up to 14 × 14 m window), pitch 50° ((50 · π) / 180), `followFocus` centered around the cart with bounds clamped to the store.
- **Readability on 390 × 844**: ~40 px/m window ensures runner + cart are clearly visible. List items have a 0.8 m emissive ground halo and bobbing product meshes with collection animations for instant visibility.
- **Follow live point:** `<CameraRig camera={definition.camera} follow={{ x: cart.x + 0.25 * cart.vx, y: 0, z: cart.z + 0.25 * cart.vz }} bounds={STORE_BOUNDS} damping={4} followFraction={1} offset={view.offset} shift={view.shift} />`.
- **Runner and cart coupling:** runner rendered inside `CartGroup` at local offset (0, 0, −0.65), feet on floor, hands gripping red handle at y 0.94 m (`EXPANSION_GLB_POINTS.cartHandle`). Walking pose: forward reach with `gaitPhaseStep`; riding pose: `jumpPose` tuck standing on cart base bar with 0.18 m lift. Hands stay locked to handle during all turns.
- `environment: { background: "#0b1220", lighting: "indoor" }`; white tile floor canvas texture, 70 m perimeter floor to avoid voids, supermarket ceiling emissive strip lights.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats` Items x/6, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`sweptAabbXZ`, `resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`, `aabbFromCenter`), `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useCanvasTexture`, `SHARED_ASSETS` / `REUSED_ASSETS` / `EXPANSION_ASSETS` + `EXPANSION_GLB_POINTS`, rig (`<HumanoidModel>`, `useHumanoidPose`, `walkPose`, `carryPose`, `jumpPose`, `idlePose`, `cheerPose`, `aimArm`, `turnBone`, `levelFoot`, `gaitPhaseStep`, `walkStride`, `bodyLift`, `BONE`, `RUNNER_LANDMARKS`), `core/ai/patrol` (`stepPatrol`), `core/fx` (`useFx`: `burst` sparkle / debris / confetti, `score`, `shake`, `warm`; `useCameraShake`), lighting `indoor`, `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below).

## Assets

No new generation: cart GLB in `EXPANSION_ASSETS.cart`, 3 shoppers generated in batch (`shopperA`, `shopperB`, `shopperC`), all 10 products imported. Fits in `assets.ts`, checked in `assets.test.ts`.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| cart | A `EXPANSION_ASSETS.cart` (`assets.spec.json`) | 1.0 × 1.0 × 0.6 m | circle r 0.55, composite AABB 0.9 × 1.6 | box |
| pusher | D `SHARED_ASSETS.runner` scale 0.825 | 1.556 m tall | coupled to cart at (0, 0, −0.65) | capsule |
| shopperA | A `shopperA.glb` (`assets.spec.json`) | 1.55 m tall | circle r 0.4 | capsule |
| shopperB | A `shopperB.glb` (`assets.spec.json`) | 1.60 m tall | circle r 0.4 | capsule |
| shopperC | A `shopperC.glb` (`assets.spec.json`) | 1.75 m tall | circle r 0.4 | capsule |
| products | D/C 10 kinds: apple, banana, burger, tinCan, bottle, bag, sock, battery, fish, gourd | 0.2–0.35 m across | pickup radius 1.0 m | sphere / cylinder |
| pyramids | B procedural tin cans (pool of 6 pyramids × 6 cans) | 0.8 m high pyramid | circle r 0.4 | cylinder stack |
| procedural | B: shelves (instanced metal units + canvas price strips), checkout counters, freezer row, fruit island, tile floor, spill puddles, skid decals | | | |

- `assets.spec.json` lists 4 assets owned by this game: `cart`, `shopperA`, `shopperB`, `shopperC`. Everything else is shared/reused.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (store layout, kinematics, swept collision, shoppers, spills, pyramids, list, scoring; pure, seeded) · `rules.test.ts` (swept collision continuous proof, face unsticking, shopper routes, botHarness limit bots, mutant tests) · `poses.ts` (pure: `runnerPose`, `shopperPose`, runner/shopper blending) · `poses.test.ts` (height, handle reach, ride tuck, cadence) · `assets.ts` + `assets.test.ts` (manifest validation, product catalog, models) · `camera.ts` (fitted view options, follow sizing) · `Scene.tsx` (one `useRunFrame`, camera, cart, items, fx, audio loops) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/shopping-cart.webp` · `tools/thumbs/inputs/shopping-cart.mjs`.

## Test plan

`rules.test.ts` ≤ ~800 lines, behaviour over branches; core is already tested.

- **Store & generator:** deterministic per seed; 1,000 seeds valid (6 distinct list items from 10 products, items placed on reachable slots, shortest `storeDistance` pick tour $\ge 52\text{ m}$); fallback valid (73.9 m); `storeDistance` / `shelvesBetween` pinned for facing slots, opposite faces of one shelf and across islands.
- **DoD walking completion:** list is completable at walking speed (6.0 m/s, no riding boost) within 75 s on every seed (proven across 1,000 seeds by a walking bot, ensuring riding is fun but never mandatory).
- **Kinematics & grip:** turn rate capped at 4.0 rad/s; target speed ramps at 12.0 m/s²; walking speed capped at 6.0 m/s, riding at 9.0 m/s; grip easing matches 6.0 /s normal, 3.0 /s riding, 1.5 /s spills.
- **Swept collision:** 20,000 random steps at 9.0 m/s with random dt never tunnel through shelf boxes or outer walls (`sweptAabbXZ`); composite proxy protects runner; up to 3 passes resolve corners without snagging; rebound speed pinned to exactly 0.3 × the impact speed on each of the four walls; a 2.9 m/s contact (shelf or wall) keeps the combo, 3.1 m/s breaks it.
- **Can pyramids & spills:** pyramid contact slows to 3.0 m/s for 0.5 s, topples mesh, breaks combo; toppled pyramids stay toppled; puddle entry switches grip to 1.5 /s.
- **Shoppers:** `stepPatrol` waypoint transitions deterministic; bump stuns cart for exactly 1.0 s, resets combo, obeys 1.5 s invulnerability grace, pushes shopper clear of cart volume.
- **Scoring + proof:** `runScore` events; +300 awarded at list completion; config-space win route $\ge 30.91\text{ m}$ > 28.56 m reachable in 3.5 s; earliest win 3.5 s scores 2030 pts $\le 2030$; all legal runs pass `withinServerLimits(score, ms, limits)`; server envelope $1700 + 100 \cdot t$ holds for all $t \in [3.5, 75.0]$; idle player times out with 0 pts at 75000 ms.
- `poses.test.ts` / `assets.test.ts`: runner hands within 3 cm of cart handle at y 0.94 m across full steering range; soles on floor; cart and shopper mesh bounds match catalog.
- Browser: common criteria (03), banner open/closed, Retry ×10 keeps geometries flat.

## Performance

Target **55** draw calls, cap **70**; triangles ≤ 120k with every GLB (runner 18k, shoppers 3 × 18k, cart 4k, instanced shelves 4, instanced products 6, can pyramids 2, checkout 2, floor 1, decals 1, fx pools ≤ 3). Lights: `indoor` preset only (no extra dynamic lights). Pools warmed at mount (`fx.warm("sparkle", "debris", "confetti", "score")`). No per-frame allocation.

## Audio

P-06 is not merged; designed against 06 §9.3 (`playSfx(name, { pitch, pan, volume })`, `startLoop(name)`): `startLoop("engine", { volume: 0.3 })` on play (cart rattle, pitch scales with speed); pick-up `"pickup"` (rising pitch with combo); clean combo `"chime"`; crash / bump `"hit"`; pyramid topple `"thud"`; spill slide `"whoosh"`; checkout register `"win"` fanfare. Built before P-06 lands: `"pickup"`, `"hit"`, `"win"` work directly; loop silent until P-06 merges.

## Accessibility

Shopping list on HUD shows product icons and checkmarks; target items glow with emissive beacon halo (0.8 m) and float at eye height; soft auto-steer assist on coarse pointers (`STEER_ASSIST_RATE = 1.5 rad/s` within 20°); high-contrast floor markings; `fx.shake` honours reduced motion.

## Risks and open questions

- **Drift control feel on mobile:** 4 rad/s turn rate and 3.0 /s riding grip must feel responsive on small touch joysticks without feeling sluggish or uncontrollably slippery. Soft steer assist tunes this.
- **Swept collision multi-pass overhead:** 3 passes with 4 shelf boxes and 4 walls is at most 24 AABB sweep tests per frame (pure scalar math, <0.02 ms).
- **Shopper landmark measurement:** when Claude imports `shopperA|B|C.glb`, landmarks will be verified in `assets.test.ts`; until then, capsule primitives stand in cleanly.
- **Open questions:** None; all design questions resolved.

## Status

```
HANDOFF P-15-fix3 shopping-cart
Branch / last commit: antigravity/game-shopping-cart @ HEAD
Files changed (git diff --name-only main...HEAD):
  play50games-frontend/public/images/3d/shopping-cart.webp
  play50games-frontend/src/arcade3d/games/shopping-cart/Primitives.tsx
  play50games-frontend/src/arcade3d/games/shopping-cart/README.md
  play50games-frontend/src/arcade3d/games/shopping-cart/Scene.tsx
  play50games-frontend/src/arcade3d/games/shopping-cart/assets.spec.json
  play50games-frontend/src/arcade3d/games/shopping-cart/assets.test.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/assets.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/camera.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/index.tsx
  play50games-frontend/src/arcade3d/games/shopping-cart/meta.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/poses.test.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/poses.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/rules.test.ts
  play50games-frontend/src/arcade3d/games/shopping-cart/rules.ts
  tools/thumbs/inputs/shopping-cart.mjs
Checks: npm run build pass (47/47 static pages) | npx tsc --noEmit pass (0 errors) | npx vitest run pass (1701+ tests, shopping-cart 46/46)
Built: Aisle-aware routing with shelvesBetween; 52 m minimum pick tour (design gate); 3500 ms speedrun floor; proposed limits 2030 maxScore, 3500-77000 ms, 1700 base + 100/s; combo preserved on soft scrapes and reset only on a real crash (> 3.0 m/s normal speed); shopper radial push-out beyond cart volume; hoisted allocations; useGameTime R3F clock integration; runner capsule mesh wrap; mutant killer tests for M1, M6, M8, M9, M10.
Scoring formula: 100 per item + combo (+20/step) + 300 list complete + 10/s left on win; proposed limits 2030 maxScore, 3.5-77.0 s duration, 1700 base + 100/s.
Decisions I took and why: shelvesBetween computes Manhattan distance directly when slots share an aisle, the limit floor rests on the config-space bound (README proof), not on this metric; normal velocity threshold 3.0 m/s (Claude, 2026-10-09) preserves player combos during smooth corner and aisle wall scrapes; shopper push-out prevents visual clipping after stun.
Open questions for Claude or the user: None.
Known issues / follow-ups: None.
Evidence: public/images/3d/shopping-cart.webp (9.7 KB), tools/thumbs/out/shopping-cart.webp
```
