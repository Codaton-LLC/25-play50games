# Crazy Shopping Cart

Owner: Antigravity. Slug: `shopping-cart`. Adventure game 6 (order 16), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §6. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south (+z = checkout exit), y up. Every "Changed from spec" line says what and why.

## Decisions (user, 2026-10-08)

- **Characters:** Cart pusher is the shared runner (`SHARED_ASSETS.runner`). In-store shoppers are 3 new faceless characters (`shopperA` elderly woman in lilac cardigan, `shopperB` young woman in mint hoodie, `shopperC` man in orange polo; GLBs under `/models/3d/shopping-cart/`, drawn with `<HumanoidModel>` + core poses). Neither chef nor cleaner is used.
- **Checkout win:** Instant win upon entering the checkout finish zone with the list complete (no dwell timer).
- **Pyramids:** Toppled can pyramids stay toppled for the rest of the run (no respawn).
- **Product catalog:** Shopping list draws items per seed from 10 imported product kinds: apple, banana, burger, tinCan, bottle, bag, sock, battery, fish, gourd (from SHARED, REUSED, and EXPANSION assets).

## Levels (five per game, 2026-10-25)

Five levels through the core level system (`core/README.md` "Levels"): `levels.ts` holds the pure `ShoppingCartLevel` configs, `createRun(seed, level)` / `stepRun` play one, `index.tsx` declares the five `LevelSpec`s (description, config, instructions, `durationMs`, and `hudStats` with the level's item count), `meta.ts` the titles and limits. **Level 1 is today's game unchanged** (6 items, 75 s clock, 40 s Shopper D, proven 2030 ceiling). A level clears on a **win** or reaching `clearScore`.

| Level | Title | Items | Clock | Shopper D | Shopper speed / wait | clearScore |
|---|---|---:|---:|---:|---:|---:|
| 1 | Mini Market | 6 | 75 s | 40 s | 1.8 m/s (0.6 s wait) | 1200 |
| 2 | Fresh Food | 7 | 100 s | 30 s | 1.9 m/s (0.5 s wait) | 1400 |
| 3 | Household Aisles | 9 | 150 s | 20 s | 2.0 m/s (0.4 s wait) | 1600 |
| 4 | Superstore | 12 | 150 s | 15 s | 2.1 m/s (0.3 s wait) | 1800 |
| 5 | Closing-Time Rush | 15 | 180 s | 0 s (start) | 2.2 m/s (0.2 s wait) | - |

Plan adaptation (GAME 16): 1 base store environment + 5 level configurations; indoor lighting is kept throughout. Item counts scale 6 -> 7 -> 9 -> 12 -> 15. The 4th shopper (`shopperD`) activates progressively earlier (40 s down to 0 s at rush hour), and shoppers move faster with shorter waypoint pauses. The 52 m tour gate holds across all levels.

### Server limits per level (the proof)

The score formula is identical across all levels:
`runScore(items, comboPoints, listComplete, won, timeLeftMs) = 100 · items + comboPoints + (listComplete ? 300 : 0) + (won ? 10 · floor(timeLeftMs / 1000) : 0)`
where perfect combo awards $10 \cdot K(K + 1)$ points for $K$ items.

1. **Kinematic floor (3500 ms):** In any frame starting at play time $t$ (dt $\le 0.05$ s), $|v| \le \min(9, 12t + 0.6)$. At 3.5 s, $\int_0^{3.5} \min(9, 12t + 0.6) dt = 28.56$ m. The shortest win route visiting $\ge 6$ items and checkout is $\ge 30.91$ m (`MIN_WIN_ROUTE_M`), which strictly exceeds 28.56 m. Since visiting $K \ge 6$ items visits at least 6 items, no win can occur before 3.5 s on any level (`minDurationMs: 3500`).
2. **Earliest win & score ceiling:** At $t = 3.5$ s, $\text{timeLeftMs} = \text{durationMs} - 3500$, giving maximum time bonus $10 \cdot \lfloor (\text{durationMs} - 3500) / 1000 \rfloor$.
3. **Linear envelope:** $S(t) \le \text{base} + \text{maxPointsPerSec} \times t$ holds for all $t \ge 3.5$ s with $\text{pps} = 100$.
4. **Order of magnitude:** Level 5 `maxScore` (5960) is $2.94\times$ Level 1's (2030), satisfying the $\le \sim 3\times$ guard.

| Level | Title | Items ($K$) | Clock | Items + Combo + Complete | Earliest Win Bonus ($t = 3.5$ s) | `maxScore` | `minDurationMs` | `maxDurationMs` | `base` / `maxPointsPerSec` |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | Mini Market | 6 | 75 s | $600 + 420 + 300 = 1320$ | $10 \times 71 = 710$ | **2030** | 3500 | 77000 | 1700 / 100 |
| 2 | Fresh Food | 7 | 100 s | $700 + 560 + 300 = 1560$ | $10 \times 96 = 960$ | **2520** | 3500 | 102000 | 2200 / 100 |
| 3 | Household Aisles | 9 | 150 s | $900 + 900 + 300 = 2100$ | $10 \times 146 = 1460$ | **3560** | 3500 | 152000 | 3250 / 100 |
| 4 | Superstore | 12 | 150 s | $1200 + 1560 + 300 = 3060$ | $10 \times 146 = 1460$ | **4520** | 3500 | 152000 | 4200 / 100 |
| 5 | Closing-Time Rush | 15 | 180 s | $1500 + 2400 + 300 = 4200$ | $10 \times 176 = 1760$ | **5960** | 3500 | 182000 | 5650 / 100 |

### Bot clear rates (`levels.test.ts`)

| Level | Path-following bot wins / 40 | Win rate | Walking bot wins / 50 | Walking win rate | Idle score |
|---|---:|---:|---:|---:|---:|
| 1 | 40 / 40 | 100% | 50 / 50 | 100% | 0 (never clears) |
| 2 | 40 / 40 | 100% | 50 / 50 | 100% | 0 (never clears) |
| 3 | 40 / 40 | 100% | 50 / 50 | 100% | 0 (never clears) |
| 4 | 40 / 40 | 100% | 50 / 50 | 100% | 0 (never clears) |
| 5 | 40 / 40 | 100% | 50 / 50 | 100% | 0 (never clears) |

## Concept

Drift a runaway supermarket shopping cart through supermarket aisles, grab glowing grocery items on your shopping list, and race to checkout before the clock runs out. The cart handles with inertia: momentum in turns, skids on slippery puddles, and a "ride the cart" boost where the runner hops onto the rear base bar for high speed at reduced grip. Shoppers patrol walkways, can pyramids topple on contact, and clean pick-ups build a combo multiplier. Accent `#fb923c`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Ride" }`.

- `keyboard`: "WASD / arrows to steer, hold Space to ride" (matches `meta.ts`).
- `touch`: "Joystick to steer, hold Ride to ride".
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative; up = away from camera). Heading turns toward input at 4.0 rad/s via `turnTowards`. Ride boost active while `jump` is held (Space / touch Ride button). Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`STORE`, `CART`, `COLLISION`, `SHOPPERS`, `SPILLS`, `PYRAMIDS`, `POINTS`, `ASSIST`) and `levels.ts` (`LEVELS`), proven in `rules.test.ts` and `levels.test.ts`.

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
- **Shoppers** (`SHOPPERS`, `core/ai/patrol`): 3 NPCs at start (`shopperA`, `shopperB`, `shopperC`); 4th shopper spawns per level (`shopperDActiveS`). Patrol walkways at level's speed via `stepPatrol`. Circle r 0.4 m. Bump stuns cart for 1.0 s (velocity 0, input locked, dizzy wobble), resets combo streak, and grants 1.5 s invulnerability grace.
- **Spills** (`SPILLS`): puddle 1 spawns at 25.0 s (Aisle 2 entrance), puddle 2 at 50.0 s (Aisle 4 entrance). Circle r 1.2 m. Inside puddle, grip drops to 1.5 /s and skid marks spawn.
- **List & generator** (`LIST`): 24 shelf slots (6 per shelf: 3 west face, 3 east face at z −5.0, −1.5, +2.0). Items picked per seed from 10 product kinds. Items glow with emissive beacon halo (0.8 m diameter) and bob at y 0.6–0.85 m. Pickup reach: 1.0 m from slot centre. Generator fairness: enforces the design's gate: shortest `storeDistance` pick tour (start → items → checkout) $\ge 52\text{ m}$ (`MIN_TOUR_DISTANCE`).
- **Auto-steer assist** (`ASSIST`): on coarse pointers, if heading within 20° (0.35 rad) of uncollected list item within 8.0 m, pulls heading toward item at `STEER_ASSIST_RATE = 1.5 rad/s` (overridable by player's 4.0 rad/s input).

## Run end

- `end("win")` instantly on entering checkout finish zone with all list items collected. `resultDelayMs: 1200` to show register "ka-ching", confetti burst and runner cheer.
- `"timeup"` by shell when clock expires: ends run with points collected so far. No `"lose"` condition. Crossing checkout with incomplete list does not trigger win.

## Scene and camera

- **Follow 3/4 top-down, pitch 50°**: `useFittedView` with dynamic window sizing (`camera.ts`: targeting ~40 px/m at 390 × 844 portrait and ~27 px/m at 844 × 390 landscape; desktop up to 14 × 14 m window), pitch 50° ((50 · π) / 180), `followFocus` centered around the cart with bounds clamped to the store.
- **Readability on 390 × 844**: ~40 px/m window ensures runner + cart are clearly visible. List items have a 0.8 m emissive ground halo and bobbing product meshes with collection animations for instant visibility.
- **Follow live point:** `<CameraRig camera={definition.camera} follow={{ x: cart.x + 0.25 * cart.vx, y: 0, z: cart.z + 0.25 * cart.vz }} bounds={STORE_BOUNDS} damping={4} followFraction={1} offset={view.offset} shift={view.shift} />`.
- **Runner and cart coupling:** runner rendered inside `CartGroup` at local offset (0, 0, −0.65), feet on floor, hands gripping red handle at y 0.94 m (`EXPANSION_GLB_POINTS.cartHandle`). Walking pose: forward reach with `gaitPhaseStep`; riding pose: `jumpPose` tuck standing on cart base bar with 0.18 m lift. Hands stay locked to handle during all turns.
- `environment: { background: "#0b1220", lighting: "indoor" }`; white tile floor canvas texture, 70 m perimeter floor to avoid voids, supermarket ceiling emissive strip lights.

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

## Files

`meta.ts` (data, per-level scoring) · `index.tsx` (`GameDefinition`, 5 level specs) · `levels.ts` (pure level configs) · `levels.test.ts` (level declarations, progression, proofs, bot sweeps) · `rules.ts` (store layout, kinematics, swept collision, shoppers, spills, pyramids, list, scoring; pure, seeded) · `rules.test.ts` (swept collision continuous proof, face unsticking, shopper routes, botHarness limit bots, mutant tests) · `poses.ts` (pure: `runnerPose`, `shopperPose`, runner/shopper blending) · `poses.test.ts` (height, handle reach, ride tuck, cadence) · `assets.ts` + `assets.test.ts` (manifest validation, product catalog, models) · `camera.ts` (fitted view options, follow sizing) · `Scene.tsx` (one `useRunFrame`, camera, cart, items, fx, audio loops) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md`.
