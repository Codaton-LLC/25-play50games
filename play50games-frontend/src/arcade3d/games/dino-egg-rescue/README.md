# Dino Egg Rescue

Owner: Antigravity. Slug: `dino-egg-rescue`. Adventure game 4 (order 14), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §4. Gate G0 (design rework); the build fills `Status`. Units: metres, seconds; x east, z south (+z = south / nest side), y up. Every "Changed from spec" line says what and why.

## Decisions (user, 2026-10-09)

- **D1. Egg supply capped:** 4 eggs at start, then one new egg every 3.0 s at t = 3, 6, ... 87 s (29 eggs) while fewer than 4 on ground (regular eggs ≤ 33). Spawns move progressively further from nest over time (§7 progression). Scattered eggs are the same eggs, never new ones.
- **D2. Dash speed scaling:** Dash speed (8.0 m/s) is scaled by the stack multiplier (1.0, 0.85, 0.72, 0.60) and mud multiplier (0.5), matching walking physics.
- **D3. Post-stun grace:** 1.0 s boulder invulnerability grace after 0.8 s stun ends, telegraphed by a blinking visual halo.
- **D4. Trees:** `leafyTree` only; no palms used.

## Concept

A prehistoric valley at sunset. A clumsy baby dino (`EXPANSION_ASSETS.dino`) gathers runaway eggs across a 30 × 22 m valley and carries them back to its nest in the South-East before 90 s runs out. The signature mechanic is risk/reward stacking: the dino carries up to 3 eggs on its back, but each carried egg slows it down (1.0 → 0.85 → 0.72 → 0.60 speed), and a rolling boulder drops the whole stack! Boulders roll down gullies from an active volcano in the North-East, and sticky mud pits cut speed in half. Golden eggs spawn every ~25 s for high-value rescue opportunities. Accent `#a3e635`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Dash" }`.

- `keyboard`: "WASD / arrows to move, Space or E to dash" (matches `meta.ts`).
- `touch`: "Joystick to move, tap Dash to dash". Changed from stub ("Joystick + Action to dash") because the touch button is labelled Dash (`touchLabels`).
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative). Dash starts on `actionPressed || jumpPressed` (Space / E / touch Dash): 0.4 s burst at base 8.0 m/s (scaled by stack/mud, D2) with 1.5 s cooldown; grants 0.4 s boulder invulnerability (dino passes through boulders). Esc / P pause.

## Rules

All numbers live in `rules.ts` (`VALLEY`, `DINO`, `EGGS`, `BOULDERS`, `TREES`, `MUD`, `NEST`, `SCORING`) and are proven in `rules.test.ts`.

- **Valley** (`VALLEY`): 30 × 22 m (x ±15, z ±11). Outer perimeter clamped via `clampToBounds`. Ground is grass `#84cc16` and soil `#a16207`; volcano backdrop outside bounds at NE ((16, −13), procedural cone with glowing crater `#f97316`). Dino starts at the nest centre (11.0, 7.5) facing −x (towards the valley).
- **Nest** (`NEST`): centred South-East at (11.0, 7.5) (merge review F1: the old SW spot (−11, 7.5) lay 0.11 m from lane 3's centre line), radius 1.8 m with delivery contact zone r 1.4 m. Procedural torus with straw canvas texture. Entering contact zone deposits all carried eggs instantly.
- **Dino kinematics & integration** (`DINO`, `EXPANSION_ASSETS.dino`): 1.1 m long, 0.8 m tall, faces +z. Collision circle r 0.55 m. Base speed 5.0 m/s, accel 20 m/s², brake 25 m/s², turn rate 12 rad/s (`turnTowards`). Integration order: integrate velocity ($p + v \cdot dt$), resolve tree collisions (`resolveSphereAabb` circle push-out against trunks), then clamp to valley bounds.
- **Egg carry & speed stacking** (`EGGS`, D1, D2): carry up to 3 eggs on back, anchored to `expansionPoint(EXPANSION_ASSETS.dino, EXPANSION_GLB_POINTS.dinoBackTop)` (the point is in GLB units, { x: 0, y: 0.756, z: −0.1 }; with the dino fit (scale 1.1 / 1.8939, stretch y 0.937, no yOffset) it is ~(0, 0.41, −0.06) m) with damped spring (`core/motion` `spring`). Speed multiplier (walk & dash): 0 eggs × 1.0 (5.0 m/s walk / 8.0 m/s dash), 1 egg × 0.85 (4.25 / 6.8 m/s), 2 eggs × 0.72 (3.60 / 5.76 m/s), 3 eggs × 0.60 (3.00 / 4.80 m/s).
- **Mud pits** (`MUD`): 3 fixed mud patches (circles r 1.6 m; no seeded placement: the ~4 m stripes between lanes cannot hold a pit with its clearance, so they sit NW of lane 4 or SE of lane 1): M1 (−11.5, −7.5) NW, M2 (11.5, 1.0) and M3 (6.5, 9.3) SE. Clearance by edge distance (table below). Speed multiplied by 0.5 (multiplicative: 3 eggs in mud = 1.50 m/s walk, 2.40 m/s dash).
- **Boulders & lanes** (`BOULDERS`, `EXPANSION_ASSETS.rock` pool): 4 fixed gully lanes entering NE, crossing valley SW: Lane 1 (14, −11) → (−2, 11) at 3.6 m/s; Lane 2 (9, −11) → (−8, 11) at 4.2 m/s; Lane 3 (4, −11) → (−14, 11) at 4.8 m/s (unlocks 30 s); Lane 4 (−1, −11) → (−15, 5) at 5.2 m/s (unlocks 60 s). Constant speed per lane (no overtaking). Schedule: one global spawn interval, linear from 3.0 s at t = 0 to 1.2 s at t = 90 s; at each tick the lane is chosen (seeded) among the unlocked lanes whose last boulder left ≥ 2.5 s ago, and the tick is skipped if there is none (per-lane headway ≥ 2.5 s). Contact band: a boulder (r 0.5) touches the dino (r 0.55) within 1.05 m of the lane centre, so the band is 2.1 m wide. Crossing gap: mud is off every band (table below), so the slowest on-lane dino speed is 3.0 m/s (3 eggs, no mud): crossing 2.1 / 3.0 = 0.70 s plus the boulder's pass time 2.1 / v ≤ 2.1 / 3.6 = 0.58 s gives 1.28 s ≤ 2.5 s headway. After a hit, 0.8 s stun + 1.0 s grace, then the dino needs ≤ 1.05 / 3.0 = 0.35 s (≤ 0.7 s) to leave the half band before the next boulder. Boulders roll over ground eggs without touching them. Hit (unless invulnerable) stuns dino for 0.8 s, drops carried eggs, followed by 1.0 s grace invulnerability (D3).
- **Scatter mechanics** (`EGGS`, D1): on boulder hit, carried eggs scatter outward 1.5 m. Any egg landing out of bounds or inside the nest zone, mud or a tree trunk is moved to the nearest valid free ground spot (eggs may lie on lanes; boulders roll over them). Scattered eggs count toward the ground cap (4 max), pausing new 3.0 s spawns until collected.
- **Trees & cover** (`TREES`, `EXPANSION_ASSETS.leafyTree`, D4): 8 fixed trees, T1–T8 at (−13.5, −10), (−7.5, −9.8), (−13.8, −4.6), (14, −2.5), (14.2, 4.5), (8, 4.5), (14, 10), (3.5, 10.2). Trunk radius 0.256 m (derived from `LEAFY_TREE_TRUNK_RADIUS_GLB = 0.14` × scale 1.829 at 3.5 m height).
- **Lane clearance** (merge review F1, F3): edge distance (m) from each item to each lane **segment**'s contact band (centre distance − item radius − 1.05); every value ≥ 2.0 (`rules.test.ts` checks it). Nest centre to lane 1's centre line: 8.45 m.

| item (r) | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| nest (11, 7.5) r 1.8 | 5.60 | 10.04 | 14.28 | 18.36 |
| dino start (11, 7.5) r 0.55 | 6.85 | 11.29 | 15.53 | 19.61 |
| M1 (−11.5, −7.5) r 1.6 | 15.91 | 11.43 | 7.13 | 2.95 |
| M2 (11.5, 1) r 1.6 | 2.39 | 6.67 | 10.75 | 14.66 |
| M3 (6.5, 9.3) r 1.6 | 3.22 | 7.78 | 12.14 | 16.36 |
| T1 / T2 / T3 r 0.256 | 20.35 / 15.38 / 17.41 | 15.89 / 11.02 / 12.82 | 11.61 / 6.83 / 8.42 | 7.44 / 2.80 / 4.11 |
| T4 / T5 / T6 r 0.256 | 3.69 / 7.97 / 2.96 | 7.85 / 12.29 / 7.38 | 11.82 / 16.40 / 11.61 | 15.93 / 20.34 / 15.67 |
| T7 / T8 r 0.256 | 11.05 / 2.67 | 15.49 / 7.30 | 19.73 / 11.73 | 23.81 / 16.04 |

- **Egg supply & spawning** (`EGGS`, D1): 4 eggs at t = 0; spawn ticks are fixed at t = 3k s (k = 1..29); a tick is skipped and lost (never made up) when ≥ 4 eggs are on the ground (total supply ≤ 33). Distance r(t) = 6 + 10 · t / 90 m from the nest centre ± 1.5 m (seeded), at a seeded angle; a spot out of bounds or in mud, the nest zone or a trunk is rejected and redrawn (eggs may lie on lanes). A delivered egg is removed for good (never respawned or re-counted). Pick-up radius 0.6 m.
- **Golden egg** (`EGGS`): spawns at 25 s, 50 s, 75 s within 8 m of the dino, same rejection rule (≤ 8 / 3.0 = 2.7 s away even with 3 eggs, inside its 8 s despawn); despawns after 8.0 s uncollected; despawn timer pauses once carried; carried in mouth/pouch (takes 0 stack slots, does not slow dino); scatters on hit; delivers for 300 pts flat.
- **Clock**: `durationMs: 90000` (fixed 90 s timer; shell counts down and ends with `"timeup"`).

## Scoring

`runScore(deliveredEggs, goldenDelivered) = sum(deliveredPoints) + 300 · goldenDelivered`.
- Regular deliveries: 1 egg = 100 pts (100/egg); 2 eggs = 240 pts (120/egg); 3 eggs = 450 pts (150/egg). Max regular points per egg is strictly 150 pts.
- Golden egg: 300 pts flat (does not count toward stack multiplier or stack slots).
- Live: `addScore(points)` on nest delivery; popup score sprite (`fx.score`).

### Server limits and why they hold (the proof)

| | provisional (02 §C.4) | set at merge (`meta.ts`, `arcade-games.json`) |
|---|---|---|
| `maxScore` / `max_score` | 6000 | **6000** |
| duration | 10000–92000 ms | **88000–92000 ms** |
| `base` / `max_pps` | 6000 / 6000 | **0 / 70** |

The counting proof holds by strict upper bounds from user decisions D1:
1. **Regular egg bound:** total regular eggs available is capped at ≤ 33 (4 at start + 29 interval spawns).
2. **Regular score ceiling:** each egg yields at most 150 pts (in a 3-egg stack): $33 \times 150 = \mathbf{4950}\text{ pts}$.
3. **Golden egg ceiling:** exactly 3 golden eggs spawn during 90 s: $3 \times 300 = \mathbf{900}\text{ pts}$.
4. **Absolute maximum score:** $4950 + 900 = \mathbf{5850}\text{ pts} \le \mathbf{6000}\text{ pts}$ (`maxScore`).
5. **Duration:** every completed run ends exclusively by shell `"timeup"` at `elapsedMs = 90000` (no early win or lose; quit discards run), falling strictly within 88000–92000 ms.
6. **Linear envelope:** $5850 / 88.0\text{ s} = 66.48\text{ pts/s} \le 70\text{ pts/s}$ (`maxPointsPerSec`). $0 + 70 \cdot t \ge 6000 \ge 5850$ holds for all $t \ge 85.8\text{ s}$.

## Run end

- `"timeup"` by shell at 90 s (`durationMs: 90000`). Result delay `resultDelayMs: 1200` to show nest celebration.
- No early win or lose condition (pure time-attack endurance collect).

## Scene and camera

- **Camera & fit:** `GameDefinition.camera = { position: [0, 16, 13.4], fov: 45 }`. Follow 3/4 top-down view, pitch 50° ((50 · π) / 180), yaws [0]. `useFittedView` with area in metres (see "Camera windows" below). Follow live point `<CameraRig camera={definition.camera} follow={{ x: dino.x, y: 0, z: dino.z }} bounds={VALLEY_BOUNDS} damping={4} followFraction={1} offset={view.offset} shift={view.shift} />`; the fit's `focus` comes from `followFocus({ lookAt, reach, fraction: 1, bounds: VALLEY_BOUNDS })`, where `reach` and `bounds` are AABBs (`VALLEY_BOUNDS` = { min: { x: −15, y: 0, z: −11 }, max: { x: 15, y: 0, z: 11 } }), not tuples.
- **TargetMarkers:** `<TargetMarkers>` displays screen-edge guidance arrows pointing to nearest uncollected eggs when stack < 3, the nest when carrying ≥ 1 egg, and warning arrows for incoming boulders at spawn.
- **Camera windows (`camera.ts` `viewFor`, pinned in `camera.test.ts`):** phones (shorter side < 600 CSS px) get a tight window: portrait 8.0 × 10.8 m at pitch 50°, landscape 10.6 × 7.4 m at pitch 60° (the short side is the valley's depth, so the steeper look keeps the far row from foreshortening). Larger screens keep 11 × 15 m / 16 × 11 m at pitch 50°. The egg glow discs are drawn at the pickup radii (0.6 m regular, 0.7 m golden; visual only, the rules are unchanged).
- **Pixel readability, MEASURED** (Claude review 2026-10-09: headless Chrome, a bot playing a full 90 s run, about 98 samples per viewport; projected bounding box of the drawn dino mesh, of each egg's glow disc + egg and of each boulder, objects on screen only; phones with the cookie banner open). Shorter side of the box, min / median in CSS px:

| Viewport | Dino | Egg + disc | Golden egg + disc | Boulder | Target |
|---|---|---|---|---|---|
| 1280 × 800 (keyboard) | 34.7 / 44.6 | 27.1 / 38.0 | 56.0 / 67.9 | 32.9 / 42.2 | ≥ 24 px: pass |
| 390 × 844 (touch, banner) | 23.2 / 31.5 | 21.8 / 33.2 | 32.6 / 39.5 | 25.3 / 29.9 | ≥ 24 px: pass (2 / 160 egg samples below 24) |
| 844 × 390 (touch, banner) | 20.3 / 25.5 | 21.4 / 31.4 | 26.5 / 34.0 | 24.2 / 27.7 | ≥ 24 px median: pass (16 / 133 egg samples below 24, the far row) |

The longer side is about 1.3× these (dino 39 / 33 px median on the phones). The dino's box is smallest when it heads straight away from the camera. Eggs and boulders near the screen edges can sit partly under the HUD, the touch buttons or the banner (on 844 × 390 about a quarter of the egg samples and a third of the boulder samples touch one of them); `<TargetMarkers>` point at off-screen eggs, the golden egg, the nest and boulders. (The earlier table here, 47.5 / 49.3 / 33.6 px and 38.0 / 39.4 / 26.9 px, was a prediction; the measured sizes at that window were about half of it.)

- **Dino animation:** `core/motion` `waddle` (stride-matched body roll & head bob scaling with ground speed; no foot slip), `squashStretch` on dash burst.
- `environment: { background: "#7c2d12", lighting: "sunset" }`; grass `#84cc16`, soil `#a16207`, volcano backdrop cone at NE with lava glow `#f97316`.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`, `clampToBounds`), `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`), `core/motion` (`waddle`, `spring`, `squashStretch`), `core/path`, `core/limits` (`withinServerLimits`, `capScore`), `core/testing/botHarness` (`createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useCanvasTexture` (egg spots, nest straw), `EXPANSION_ASSETS.dino`, `EXPANSION_ASSETS.rock`, `EXPANSION_ASSETS.leafyTree`, `EXPANSION_GLB_POINTS.dinoBackTop`, `core/fx` (`useFx`: `burst` sparkle / puff / debris, `score`, `shake`), `core/hud/TargetMarkers`, `useQuality` + `scaledCount`, P-06 audio (`startLoop`, `playSfx`).

## Assets

No new generation: every GLB is shared. Fits in `assets.ts`, checked in `assets.test.ts`.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| dino | C (A) `EXPANSION_ASSETS.dino` (`shared/dino.glb`) | 1.1 m long, 0.8 m tall | circle r 0.55 | capsule |
| boulders | C (A) `EXPANSION_ASSETS.rock` (`shared/rock.glb`) pool | 1.0 m spherical fit, rolls on profile | circle r 0.5 | sphere |
| leafyTree | C (A) `EXPANSION_ASSETS.leafyTree` (`shared/leafyTree.glb`) | 3.5 m tall | trunk circle r 0.256 | cylinder + cone |
| eggs | B procedural ellipsoids (canvas spots) | 0.4 × 0.3 m + 1.0 m glow disc | circle r 0.3 (pickup r 0.6) | sphere |
| goldenEgg | B procedural ellipsoid (gold glow) | 0.45 × 0.35 m + 1.2 m glow disc | circle r 0.35 (pickup r 0.7) | sphere |
| nest | B procedural torus + straw texture | 3.6 m diameter | delivery circle r 1.4 | cylinder |
| procedural | B: valley terrain, mud decal discs, volcano backdrop cone, gully tracks | | | |

- **Changed from spec:** pitch 50° vs 55° (boosts screen height by 15 %); boulder speed 3.6–5.2 m/s vs 3–6 m/s and dropped single bounce (pure ground roll); ferns dropped; draw-call cap met at 50 (target 35, cap 50); tree trunk radius 0.256 m from `LEAFY_TREE_TRUNK_RADIUS_GLB = 0.14` vs 0.35 m; palms dropped (D4: `leafyTree` only).
- `assets.spec.json` lists `"assets": []` because this game owns zero custom GLBs.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (valley layout, dino kinematics, egg supply/spawns, boulder gullies, mud pits, stack delivery, scoring; pure, seeded) · `rules.test.ts` (tuning pins, seed validity, boulder lanes, botHarness limit bots) · `assets.ts` + `assets.test.ts` (manifest validation, models) · `camera.ts` (fitted view options, follow sizing) · `Scene.tsx` (one `useRunFrame`, camera, dino, eggs, boulders, nest, fx, audio loops) · `Valley.tsx` (ground, mud pits, trees, volcano backdrop) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/dino-egg-rescue.webp` · `tools/thumbs/inputs/dino-egg-rescue.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines, behaviour over branches:
- **Tuning pins:** speeds (5.0, 8.0 dash), stack multipliers (1.0, 0.85, 0.72, 0.60), mud multiplier (0.5), cooldowns (dash 1.5 s, stun 0.8 s, grace 1.0 s), pins for 450 (3 eggs), 240 (2 eggs), 100 (1 egg), 300 (golden egg).
- **Spawn logic & supply bound:** 1,000 seeds verify deterministic egg supply capped at ≤ 33; ticks only at t = 3k; spawns move progressively further from nest; 3 golden eggs at 25 s, 50 s, 75 s within 8 m of the dino; a bot hoarding 4 eggs on the ground gets no spawns (lost ticks); a scatter that would land in the nest zone is moved out; a delivered egg never comes back.
- **Layout clearance:** edge distance from the nest, every mud pit, every trunk and the dino start to every lane segment ≥ 2.0 m beyond the 1.05 m contact half-band (point-to-segment).
- **Movement & collisions:** velocity integration order; tree obstacle push-out against 0.256 m trunk; boundary clamp; dash speed cut by stack/mud; boulder collision stuns 0.8 s and triggers 1.0 s grace; hit during dash invulnerability or grace drops nothing.
- **Boulders & lanes:** 4 gully paths; constant speed per lane (no overtaking); boulder interval 3.0 → 1.2 s; lane headway ≥ 2.5 s ≥ 0.70 s crossing + 0.58 s pass (2.1 m band); boulders roll over eggs without interaction.
- **Scoring proof & bots:** 20 seeds per bot (optimal bot, safe 1-egg bot, idle bot) through real store (`simulateRun`); idle bot times out with 0 pts at 90000 ms; all runs pass `withinServerLimits(score, ms, limits)` under 6000 / 88000–92000 / 0 / 70; `capScore` is a no-op.
- Browser: common criteria (03), banner open/closed, Retry ×10 keeps geometries flat.

## Performance

Target **35** draw calls, cap **50**; triangles ≤ 75k with every GLB (dino 12k, trees instanced 6k, boulders pooled 4k, nest 2k, valley 4k, fx pools ≤ 3). Lights: `sunset` preset only. Pools warmed at mount (`fx.warm("sparkle", "puff", "debris", "score")`). No per-frame allocation.

## Audio

P-06 audio integration:
- Loops: `startLoop("hum", { pitch: 0.6, volume: 0.25 })` for boulder rumble (pitch/volume modulated by proximity). Scene restarts loop in `useEffect` when returning to `"playing"` and `!muted`.
- SFX: footstep `"thud"` on stride; scoop pop (`"pickup"`); nest delivery chime with pitch scaled by stack size (`"chime"`); boulder hit bonk / egg scatter (`"hit"`); dash whoosh (`"whoosh"`); golden egg spawn `"chime"` at pitch 1.5.

## Accessibility

Boulder lanes telegraph with dust trail and shadow 0.8 s ahead of roll; HUD: "Eggs x/3" plus a golden-carried icon at top centre in a `data-arcade-safe-area` panel, clear of the shell chips, text contrast ≥ 4.5:1; eggs also shown physically on the dino's back; the dash cooldown ring is drawn around the dino in the world (core `TouchControls` has no cooldown), plus a small HUD bar; golden egg off-screen hint with `<TargetMarkers>`; large touch controls (Dash button ≥ 72 px); `fx.shake` honours reduced motion.

## Risks and open questions

- **Waddle animation without foot slide:** stride-matched bob frequency: at top speed 5.0 m/s and reduced speeds (4.25, 3.6, 3.0 m/s), `waddle` frequency must scale with velocity so feet do not visually skate.
- **Egg stack spring stability:** egg physics on dino back (`EXPANSION_GLB_POINTS.dinoBackTop`) must use damped spring (`core/motion` `spring`) clamped so eggs never clip into the dino model during rapid turns or dash.
- **Open questions:** None; all design parameters and asset bindings verified and frozen by user decisions (2026-10-09).

## Merge review (Claude, 2026-10-09)

Patched at merge: F1 nest + dino start moved SE to (11, 7.5), lane-segment clearance table + test; F2 2.1 m contact band and crossing math; F3 fixed mud pits by edge clearance (NW of L4 / SE of L1); F4 fixed spawn ticks, lost ticks, r(t), rejection, delivered eggs gone, two new tests; F6 `followFocus` AABBs + `CameraRig camera`; F7 egg 0.959 m readability, far-row numbers; F8 `expansionPoint` for `dinoBackTop`; F9 HUD panel + world cooldown ring; F10 boulder schedule; F11 SFX names (`chime`, `thud`); F12 golden egg within 8 m, boulder speed 3.6–5.2. Limits set in `meta.ts` and `arcade-games.json` (6000 / 88000–92000 ms / 0 / 70).

## Status

```text
TASK P-15-fix1 | build dino-egg-rescue fixes | branch antigravity/game-dino-egg-rescue | allowed: play50games-frontend/src/arcade3d/games/dino-egg-rescue/**, play50games-frontend/public/images/3d/dino-egg-rescue.webp, tools/thumbs/inputs/dino-egg-rescue.mjs
Branch / last commit: antigravity/game-dino-egg-rescue @ HEAD (pushed)
Files changed:
  play50games-frontend/public/images/3d/dino-egg-rescue.webp
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/README.md
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/Scene.tsx
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/Valley.tsx
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/assets.test.ts
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/assets.ts
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/camera.ts
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/meta.ts
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/rules.test.ts
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/rules.ts
Checks: npm run build pass (47/47 static pages, flagged & preview) | npx tsc --noEmit pass (0 errors) | npx vitest run pass (1803/1803 tests in 135 files; dino-egg-rescue 33/33 tests in 3.29s) | thumbnail captured (tools/thumbs/capture.mjs: 13.0 KB, OK)
Fixes applied:
  1. Stale ground eggs: Fixed pool of 9 regular eggs + 1 golden egg updated per frame from run state; picked eggs disappear and new eggs appear instantly.
  2. Camera follow: CameraRig follows run.dino directly at damping 4 with bounds VALLEY_BOUNDS; follows dino across the valley without lag.
  3. Camera zoom & pixel sizes: Local window fit (11.0x15.0 m portrait, 16.0x11.0 m landscape) via viewFor. Predicted (not measured) sizes 47.5 / 49.3 / 33.6 px and 38.0 / 39.4 / 26.9 px; the review measured about half of that and retuned the phone windows (see "Pixel readability, MEASURED").
  4. Run clock integration: Single useRunFrame driving rules and store updates on the run clock; visuals animate in useFrame with useGameTime().
  5. Zero allocations: Hoisted stepInp, preallocated Colors (.copy), in-place array compaction in rules (no .filter()), direct scalar clamping (no {x,y,z}).
  6. Design items: Boulder warning TargetMarkers + 0.8 s lane telegraph warning visual; egg stack damped spring sway with spotted egg canvas texture; hum loop pitch and volume modulated by boulder proximity; golden straw nest material fix; rock GLB spherical fit (1.0 m diameter) rolling on profile.
  7. Mutation results (all 6 mutants killed in tests):
     - "lost tick deferred instead of lost": KILLED (lost tick permanently discarded, next spawn strictly at t = 6.0 s)
     - "grace no longer invulnerable": KILLED (boulder hit during grace drops 0 eggs, 0 stun, grace preserved)
     - "scatter clamp removed": KILLED (scattered eggs pushed >= 1.8 m from nest, out of mud, within valley bounds)
     - "golden spawn radius 3-8 -> 10-15": KILLED (golden spawns strictly within [3.0, 8.0] m across 50 seeds)
     - "r(t) frozen at 6": KILLED (spawn distance grows from ~6.3 m at t=3 to ~15.3 m at t=84, delta > 6.0 m)
     - "rules time at half speed": KILLED (rules clock matches store run clock 1:1, delta < 50 ms / 1 frame over 90 s)
     - Store-backed ceiling test: KILLED (proves 5850 <= 6000 ceiling, withinLimits(5850)=true, withinLimits(6001)=false)
Open questions: None.
Evidence: play50games-frontend/public/images/3d/dino-egg-rescue.webp (13.0 KB), tools/thumbs/out/dino-egg-rescue.webp
```
