# Crazy Shopping Cart

Owner: Antigravity. Slug: `shopping-cart`. Adventure game 6 (order 16), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §6. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south (+z = checkout exit), y up. Every "Changed from spec" line says what and why.

## Concept

Drift a runaway supermarket shopping cart through supermarket aisles, grab 6 glowing grocery items on your shopping list, and race to checkout before 75 s runs out. The cart handles with inertia: momentum in turns, skids on slippery puddles, and a "ride the cart" boost where the runner hops onto the rear base bar for high speed at reduced grip. Shoppers (cleaner, chef, customer) patrol cross walkways, can pyramids topple on contact, and clean pick-ups build a multiplier combo. Accent `#fb923c`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Ride" }`.

- `keyboard`: "WASD / arrows to steer, hold Space to ride" (matches `meta.ts`).
- `touch`: "Joystick to steer, hold Ride to ride". Changed from stub ("hold Jump to ride") because the touch button is labelled Ride (`touchLabels`).
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative; up = away from camera). Heading turns toward input at 4 rad/s via `turnTowards`. Ride boost active while `jump` is held (Space / touch Ride button). Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`STORE`, `CART`, `COLLISION`, `SHOPPERS`, `SPILLS`, `PYRAMIDS`, `LIST`, `SCORING`) and are proven in `rules.test.ts`.

- **Store** (`STORE`): 32 × 24 m (x ±16, z ±12). Outer walls at x = ±16, z = ±12. 4 shelf blocks (each AABB 1.4 m wide × 13.0 m long, z −8 to +5 at x −10.5, −4.5, 1.5, 7.5) define 5 aisles (aisle width 2.0–2.5 m). North cross walkway z −11.5 to −8.5 (width 3.0 m); South cross walkway z 5.5 to 8.5 (width 3.0 m). Fruit island AABB 2.0 × 4.0 m at (13.5, 0.0). Freezer row along North wall (z −11.8 to −10.5, x −12 to 12). Checkout counters at South exit (z 8.0 to 10.5); finish zone AABB [−4, 4] × [9.5, 11.5]. Start (−12.0, 7.0) facing north (−z).
- **Cart kinematics** (`CART`): GLB 1.0 × 1.0 × 0.6 m; collision circle r 0.55, bounding AABB half-size 0.45 × 0.45. Heading turns toward input at 4.0 rad/s (`turnTowards`). Velocity eases toward heading: `velocity += (heading * targetSpeed - velocity) * grip * dt`. Max walking speed 6.0 m/s, riding 9.0 m/s (boost). Throttle accel 12.0 m/s²; drag deceleration 5.0 m/s² without input. Grip rate: normal 6.0 /s, riding 3.0 /s (wider drifts), on spills 1.5 /s (slick slides).
- **Continuous collision** (`COLLISION`): every frame, the cart's movement step `delta` is tested with `sweptAabbXZ(cartAABB, delta, shelfAABB, hit)` against all shelf units and outer walls. Contact at time `t ∈ [0, 1]` advances cart to impact, reflects normal velocity with restitution 0.3, slides remaining time `(1 - t)` along tangent, and resets combo. Residual overlap resolved with `resolveSphereAabb`. Zero tunnelling at 9.0 m/s.
- **Can pyramids** (`PYRAMIDS`): 6 pyramids at aisle ends (footprint circle r 0.4 m). Contact topples pyramid (`toppled: true`), triggers can debris burst, slows cart to max 3.0 m/s for 0.5 s, and resets combo.
- **Shoppers** (`SHOPPERS`, `core/ai/patrol`): 3 NPCs at start (cleaner, chef, customer), 4th shopper spawns at 40.0 s. Patrol cross walkways at 1.8 m/s via `stepPatrol`. Footprint circle r 0.4 m. A bump stuns cart for 1.0 s (velocity 0, input locked, dizzy wobble), resets combo, and grants 1.5 s invulnerability grace.
- **Spills** (`SPILLS`): puddle 1 appears at 25.0 s, puddle 2 at 50.0 s (footprint circle r 1.2 m). Inside puddle, grip drops to 1.5 /s and skid marks spawn.
- **List & Items** (`LIST`): 24 shelf slots across the store. 6 items picked per seed from 6 grocery products: apple, banana, burger, tinCan, bottle, bag. List items glow with an emissive pulse. Pick-up reach: cart centre within 1.0 m of slot centre. Non-list shelf props are visual decor only. Changed from spec: 6 product types instead of 10 kinds, matching available GLBs 1:1 for crisp visual and icon legibility.
- **Clock**: `durationMs: 75000` (75 s shell timer).

## Scoring

`runScore(items, comboPoints, won, timeLeftMs) = 100 · items + comboPoints + (won ? 300 + 10 · floor(timeLeftMs / 1000) : 0)`. Each collected item awards +100. Consecutive clean pick-ups without bumps, topples or crashes award $+20 \times c$ where $c \in [1, 6]$ is the clean streak; perfect 6-item streak awards $20+40+60+80+100+120 = 420$ combo points. List complete awards +300. Win awards +10 per full second left on entering checkout. Live: `addScore(100 + combo)` per pick-up; on win `setScore(runScore(...))` and `end("win")`. Maximum theoretical score: 600 (items) + 420 (combo) + 300 (complete) + 10 · 66 (time bonus on earliest 8.5 s win) = **1980** (server cap **2000** to safely accommodate theoretical edge routes down to 7.0 s). Time-up max score: 600 + 420 = 1020. Popups: "+100", "+20 combo", "+300 complete", "+660 time bonus".

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 3000 | **2000** |
| duration | 10000–77000 ms | **8000–77000 ms** |
| `base` / `max_pps` | 3000 / 3000 | **1200 / 100** |

The provisional 10 s minimum would reject a legal optimal riding run under 10 s, so it drops to 8000 ms. Proof plan (through the real store):

1. **Speed:** `velocity` never exceeds 9.0 m/s (20,000 random steps with random dt, grip and collisions).
2. **Clock:** `useRunFrame` dt driven by store `frameMs`; moving + stun times ≤ `elapsedMs`.
3. **Route:** visiting 6 shelf slots in 5 aisles from start to checkout requires a minimum Manhattan/aisle distance ≥ 58.0 m. At top riding speed 9.0 m/s with 4.0 rad/s turns and acceleration from rest, minimum win time is ≥ 8.5 s.
4. **Earliest win** = 8.5 s → 1320 + 10 · 66 = 1980 pts ≤ 2000. 8000 ms provides a 500 ms safety margin.
5. **Linear server envelope:** `1200 + 100 · t`. At 8.0 s, $1200 + 800 = 2000$. For all $t \ge 8.0\text{ s}$, the envelope is $\ge 2000 \ge \text{score}(t)$ because time bonus strictly decreases as time elapses. Time-up at 75 s scores ≤ 1020.
6. **Every seed:** layout generator guarantees 6 distinct reachable items and unobstructed aisle routes.

## Run end

- `end("win")` on entering checkout finish zone with all 6 list items collected. `resultDelayMs: 1200` to show register "ka-ching", confetti burst and runner cheer.
- `"timeup"` by shell at 75 s: ends run with points collected so far. No `"lose"` condition. Crossing checkout with incomplete list does not trigger win.

## Scene and camera

- **Follow 3/4 top-down, pitch 55°**: `useFittedView({ area, pitch: 55°, yaws: [0, π/2], focus: followFocus({ lookAt: [0, 0, 0], reach: STORE_BOX, fraction: 0.25, bounds: STORE_BOX }), margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 }, padding: 8, shift: true })`; `area` = store interior x ±16, z ±12, y 0–2.2 m; portrait turns 90°.
- `<CameraRig follow={cartPosition} lookAhead={velocity * 0.25} followFraction={0.25} bounds={STORE_BOX} damping={4} offset shift={view.shift}>`.
- **Runner and cart coupling:** runner rendered inside `CartGroup` at local offset (0, 0, −0.65), feet on floor, hands gripping red handle at y 0.94 m (`EXPANSION_GLB_POINTS.cartHandle`). Walking pose: `carryPose(0)` forward reach with `gaitPhaseStep`; riding pose: `jumpPose` tuck standing on cart base bar. Hands stay locked to the handle during all turns.
- `environment: { background: "#f8fafc", lighting: "indoor" }`; white tile floor canvas texture, procedural supermarket ceiling strip lights.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats` Items x/6, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`sweptAabbXZ`, `resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`, `aabbFromCenter`), `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useCanvasTexture`, `SHARED_ASSETS` / `REUSED_ASSETS` / `EXPANSION_ASSETS` + `EXPANSION_GLB_POINTS`, rig (`<HumanoidModel>`, `useHumanoidPose`, `walkPose`, `carryPose`, `jumpPose`, `idlePose`, `cheerPose`, `aimArm`, `turnBone`, `levelFoot`, `gaitPhaseStep`, `walkStride`, `bodyLift`, `BONE`, `RUNNER_LANDMARKS`), `core/ai/patrol` (`stepPatrol`), `core/fx` (`useFx`: `burst` sparkle / debris / confetti, `score`, `shake`, `warm`; `useCameraShake`), lighting `indoor`, `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below).

## Assets

No new generation: cart GLB is in `EXPANSION_ASSETS.cart`, all other assets shared/reused. Fits in `assets.ts`, checked in `assets.test.ts`.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| cart | A `EXPANSION_ASSETS.cart` (`assets.spec.json`) | 1.0 × 1.0 × 0.6 m | circle r 0.55, AABB 0.9 × 0.9 | box |
| pusher | D `SHARED_ASSETS.runner` scale 0.825 | 1.556 m tall | coupled to cart | capsule |
| cleaner | D `REUSED_ASSETS.cleaner` | 1.55 m tall | circle r 0.4 | capsule |
| chef | D `REUSED_ASSETS.chef` | 1.82 m tall | circle r 0.4 | capsule |
| shopper | D `SHARED_ASSETS.runner` scale 0.825 + tint | 1.556 m tall | circle r 0.4 | capsule |
| products | D `apple`, `banana`, `burger`, `tinCan`, `bottle`, `bag` | 0.2–0.35 m across | pickup radius 1.0 m | sphere / cylinder |
| pyramids | B procedural tin cans (pool of 6 pyramids × 6 cans) | 0.8 m high pyramid | circle r 0.4 | cylinder stack |
| procedural | B: shelves (instanced metal units + canvas price strips), checkout counters, freezer row, fruit island, tile floor, spill puddles, skid decals | | | |

- `assets.spec.json` lists only `cart` (the one GLB owned by this game). Everything else is shared/reused.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (store layout, kinematics, swept collision, shoppers, spills, pyramids, list, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `pushPose`, `ridePose`, runner blend) · `poses.test.ts` · `assets.ts` + `assets.test.ts` (fits and sizes on real meshes) · `Scene.tsx` (one `useRunFrame`, camera, cart, items, fx, audio) · `Store.tsx` (shelves, floor, freezer, fruit island, checkout, lighting) · `Cart.tsx` (cart GLB, runner humanoid model, wheels, hands anchor) · `Shoppers.tsx` (NPC patrol rendering) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/shopping-cart.webp` · `tools/thumbs/inputs/shopping-cart.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines, behaviour over branches; core is already tested.

- **Store & generator:** deterministic per seed; 1,000 seeds valid (6 distinct list items, items placed on reachable slots, fair aisle distribution); fallback valid.
- **Kinematics & grip:** turn rate capped at 4.0 rad/s; walking speed capped at 6.0 m/s; riding speed capped at 9.0 m/s; grip easing matches 6.0 /s normal, 3.0 /s riding, 1.5 /s spills.
- **Swept collision:** 20,000 random steps at 9.0 m/s with random dt never tunnel through shelf boxes or outer walls (`sweptAabbXZ`); restitution bounce 0.3 applied correctly; sliding tangent motion preserves momentum.
- **Can pyramids & spills:** pyramid contact slows to 3.0 m/s for 0.5 s, topples mesh, breaks combo; puddle entry switches grip to 1.5 /s.
- **Shoppers:** `stepPatrol` waypoint transitions deterministic; bump stuns cart for exactly 1.0 s, resets combo, obeys 1.5 s invulnerability grace.
- **Scoring + proof:** `runScore` events; minimum route ≥ 58.0 m; earliest win 8.5 s scores 1980 pts ≤ 2000; all legal runs pass `withinServerLimits(score, ms, limits)`; server envelope $1200 + 100 \cdot t$ holds for all $t \in [8.0, 75.0]$; idle player times out with 0 pts at 75000 ms.
- `poses.test.ts` / `assets.test.ts`: runner hands within 3 cm of cart handle at y 0.94 m across full steering range; soles on floor; cart mesh bounds match catalog.
- Browser: common criteria (03), banner open/closed, Retry ×10 keeps geometries flat.

## Performance

Target **55** draw calls, cap **70**; triangles ≤ 120k with every GLB (runner 18k, cleaner 18k, chef 18k, cart 4k, instanced shelves 4, instanced products 6, can pyramids 2, checkout 2, floor 1, decals 1, fx pools ≤ 3). Lights: `indoor` preset only (no extra dynamic lights). Pools warmed at mount (`fx.warm("sparkle", "debris", "confetti", "score")`). No per-frame allocation.

## Audio

P-06 is not merged; designed against 06 §9.3 (`playSfx(name, { pitch, pan, volume })`, `startLoop(name)`): `startLoop("engine", { volume: 0.3 })` on play (cart rattle, pitch scales with speed); pick-up `"pickup"` (rising pitch with combo); clean combo `"chime"`; crash / bump `"hit"`; pyramid topple `"thud"`; spill slide `"whoosh"`; checkout register `"win"` fanfare. Built before P-06 lands: `"pickup"`, `"hit"`, `"win"` work directly; loop silent until P-06 merges.

## Accessibility

Shopping list on HUD shows product icons and checkmarks; target items glow with emissive pulse and bob; soft auto-steer assist on coarse pointers (aims toward nearest list item within 20°); high-contrast floor markings; `fx.shake` honours reduced motion.

## Risks and open questions

- **Drift control feel on mobile:** 4 rad/s turn rate and 3.0 /s riding grip must feel responsive on small touch joysticks without feeling sluggish or uncontrollably slippery. Soft steer assist tunes this.
- **Swept collision edge cases:** corners where two shelf AABBs meet must resolve without snagging (sliding along tangent).
- **NPC density in aisles:** patrol loops stay in cross walkways and perimeter aisles to avoid blocking narrow aisle paths completely.
- **Open questions for user / Claude:** (1) Should checkout require stopping inside the checkout zone for 0.5 s, or does driving through the finish line immediately trigger the win? (Designed: instant trigger on entering zone with complete list). (2) Should can pyramids respawn after 15 s, or remain toppled for the rest of the run? (Designed: remain toppled).

## Status

(empty until the build)
