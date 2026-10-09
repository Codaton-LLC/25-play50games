# Dino Egg Rescue

Owner: Antigravity. Slug: `dino-egg-rescue`. Adventure game 4 (order 14), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §4. Gate G0 (design rework); the build fills `Status`. Units: metres, seconds; x east, z south (+z = south / nest side), y up. Every "Changed from spec" line says what and why.

## Decisions (user, 2026-10-09)

- **D1. Egg supply capped:** 4 eggs at start, then one new egg every 3.0 s at t = 3, 6, ... 87 s (29 eggs) while fewer than 4 on ground (regular eggs ≤ 33). Spawns move progressively further from nest over time (§7 progression). Scattered eggs are the same eggs, never new ones.
- **D2. Dash speed scaling:** Dash speed (8.0 m/s) is scaled by the stack multiplier (1.0, 0.85, 0.72, 0.60) and mud multiplier (0.5), matching walking physics.
- **D3. Post-stun grace:** 1.0 s boulder invulnerability grace after 0.8 s stun ends, telegraphed by a blinking visual halo.
- **D4. Trees:** `leafyTree` only; no palms used.

## Concept

A prehistoric valley at sunset. A clumsy baby dino (`EXPANSION_ASSETS.dino`) gathers runaway eggs across a 30 × 22 m valley and carries them back to its nest in the South-West before 90 s runs out. The signature mechanic is risk/reward stacking: the dino carries up to 3 eggs on its back, but each carried egg slows it down (1.0 → 0.85 → 0.72 → 0.60 speed), and a rolling boulder drops the whole stack! Boulders roll down gullies from an active volcano in the North-East, and sticky mud pits cut speed in half. Golden eggs spawn every ~25 s for high-value rescue opportunities. Accent `#a3e635`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Dash" }`.

- `keyboard`: "WASD / arrows to move, Space or E to dash" (matches `meta.ts`).
- `touch`: "Joystick to move, tap Dash to dash". Changed from stub ("Joystick + Action to dash") because the touch button is labelled Dash (`touchLabels`).
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative). Dash starts on `actionPressed || jumpPressed` (Space / E / touch Dash): 0.4 s burst at base 8.0 m/s (scaled by stack/mud, D2) with 1.5 s cooldown; grants 0.4 s boulder invulnerability (dino passes through boulders). Esc / P pause.

## Rules

All numbers live in `rules.ts` (`VALLEY`, `DINO`, `EGGS`, `BOULDERS`, `TREES`, `MUD`, `NEST`, `SCORING`) and are proven in `rules.test.ts`.

- **Valley** (`VALLEY`): 30 × 22 m (x ±15, z ±11). Outer perimeter clamped via `clampToBounds`. Ground is grass `#84cc16` and soil `#a16207`; volcano backdrop outside bounds at NE ((16, −13), procedural cone with glowing crater `#f97316`). Dino starts at nest center (−11.0, 7.5) facing +x.
- **Nest** (`NEST`): centered at SW (−11.0, 7.5), radius 1.8 m with delivery contact zone r 1.4 m. Procedural torus with straw canvas texture. Entering contact zone deposits all carried eggs instantly.
- **Dino kinematics & integration** (`DINO`, `EXPANSION_ASSETS.dino`): 1.1 m long, 0.8 m tall, faces +z. Collision circle r 0.55 m. Base speed 5.0 m/s, accel 20 m/s², brake 25 m/s², turn rate 12 rad/s (`turnTowards`). Integration order: integrate velocity ($p + v \cdot dt$), resolve tree collisions (`resolveSphereAabb` circle push-out against trunks), then clamp to valley bounds.
- **Egg carry & speed stacking** (`EGGS`, D1, D2): carry up to 3 eggs on back, anchored to `EXPANSION_GLB_POINTS.dinoBackTop` ({ x: 0, y: 0.756, z: −0.1 }) with damped spring (`core/motion` `spring`). Speed multiplier (walk & dash): 0 eggs × 1.0 (5.0 m/s walk / 8.0 m/s dash), 1 egg × 0.85 (4.25 / 6.8 m/s), 2 eggs × 0.72 (3.60 / 5.76 m/s), 3 eggs × 0.60 (3.00 / 4.80 m/s).
- **Mud pits** (`MUD`): 3 static mud patches (circles r 1.6 m, seeded with `seed: 5050` away from lanes, nest and spawns). Speed multiplied by 0.5 (multiplicative: 3 eggs in mud = 1.50 m/s walk, 2.40 m/s dash).
- **Boulders & lanes** (`BOULDERS`, `EXPANSION_ASSETS.rock` pool): 4 fixed gully lanes entering NE, crossing valley SW: Lane 1 (14, −11) → (−2, 11) at 3.6 m/s; Lane 2 (9, −11) → (−8, 11) at 4.2 m/s; Lane 3 (4, −11) → (−14, 11) at 4.8 m/s (unlocks 30 s); Lane 4 (−1, −11) → (−15, 5) at 5.2 m/s (unlocks 60 s). Constant speed per lane (no overtaking). Global spawn interval 3.0 s → 1.2 s staggered across active lanes (min per-lane headway 2.5 s). Nest, mud pits and trees are strictly ≥ 2.0 m clear of lane centers. Crossing gap: crossing width 1.05 m takes ≤ 0.70 s at slowest speed (1.5 m/s); 2.5 s headway guarantees safe crossing windows. Boulders roll over ground eggs without touching them. Hit (unless invulnerable) stuns dino for 0.8 s, drops carried eggs, followed by 1.0 s grace invulnerability (D3).
- **Scatter mechanics** (`EGGS`, D1): on boulder hit, carried eggs scatter outward 1.5 m. Any egg landing out-of-bounds or inside nest/mud is clamped to nearest valid free ground spot. Scattered eggs count toward the ground cap (4 max), pausing new 3.0 s spawns until collected.
- **Trees & cover** (`TREES`, `EXPANSION_ASSETS.leafyTree`, D4): 8 trees. Trunk radius 0.256 m (derived from `LEAFY_TREE_TRUNK_RADIUS_GLB = 0.14` × scale 1.829 at 3.5 m height). Trees never intersect boulder lanes.
- **Egg supply & spawning** (`EGGS`, D1): 4 eggs at t = 0; one new egg every 3.0 s at t = 3, 6, ... 87 s (29 spawns) when < 4 eggs on ground (total supply ≤ 33). Spawn distance scales from 6.0 m up to 16.0 m from nest over 90 s. Pick-up radius 0.6 m.
- **Golden egg** (`EGGS`): spawns at 25 s, 50 s, 75 s within 14 m of nest/dino (reachable in ≤ 3.0 s); despawns after 8.0 s uncollected; despawn timer pauses once carried; carried in mouth/pouch (takes 0 stack slots, does not slow dino); scatters on hit; delivers for 300 pts flat.
- **Clock**: `durationMs: 90000` (fixed 90 s timer; shell counts down and ends with `"timeup"`).

## Scoring

`runScore(deliveredEggs, goldenDelivered) = sum(deliveredPoints) + 300 · goldenDelivered`.
- Regular deliveries: 1 egg = 100 pts (100/egg); 2 eggs = 240 pts (120/egg); 3 eggs = 450 pts (150/egg). Max regular points per egg is strictly 150 pts.
- Golden egg: 300 pts flat (does not count toward stack multiplier or stack slots).
- Live: `addScore(points)` on nest delivery; popup score sprite (`fx.score`).

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
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

- **Camera & fit:** `GameDefinition.camera = { position: [0, 16, 13.4], fov: 45 }`. Follow 3/4 top-down view, pitch 50° ((50 · π) / 180), yaws [0]. `useFittedView` with area in metres (e.g. area box $11.0 \times 15.0\text{ m}$ in portrait, $16.0 \times 11.0\text{ m}$ in landscape). Follow live point `<CameraRig follow={{ x: dino.x, y: 0, z: dino.z }} bounds={VALLEY_BOUNDS} damping={4} followFraction={1} offset={view.offset} shift={view.shift} />` with `followFocus({ lookAt: [0, 0, 0], reach: [15, 11], fraction: 1 })`.
- **TargetMarkers:** `<TargetMarkers>` displays screen-edge guidance arrows pointing to nearest uncollected eggs when stack < 3, the nest when carrying ≥ 1 egg, and warning arrows for incoming boulders at spawn.
- **Pixel readability table (banner open, fov 45°, pitch 50°):**
  Projected size on screen $= \text{footprint} \cdot \sin(50^\circ) + \text{height} \cdot \cos(50^\circ)$ ($\sin(50^\circ) = 0.766, \cos(50^\circ) = 0.643$).
  - Dino (1.1 m long, 0.8 m tall): projected $1.1 \cdot 0.766 + 0.8 \cdot 0.643 = 1.357\text{ m}$.
  - Boulder (1.0 m diameter, 1.0 m tall): projected $1.0 \cdot 0.766 + 1.0 \cdot 0.643 = 1.409\text{ m}$ (width 1.0 m).
  - Egg with ground glow disc (1.0 m diameter disc, 0.3 m tall egg): projected $1.0 \cdot 0.766 + 0.3 \cdot 0.643 = 0.959\text{ m}$ (disc width 1.0 m).

| Viewport | Clear Canvas Area | Effective px/m | Dino (1.357 m) | Boulder (1.409 m) | Egg + Disc (1.0 m) | Target ≥ 24 px |
|---|---|---|---|---|---|---|
| 390 × 844 (portrait) | 390 × 540 CSS px | ~35 px/m | 47.5 px | 49.3 px | 35.0 px | PASS (+46 % margin) |
| 844 × 390 (landscape) | 580 × 265 CSS px | ~28 px/m | 38.0 px | 39.4 px | 28.0 px | PASS (+17 % margin) |

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

- **Changed from spec:** pitch 50° vs 55° (boosts screen height by 15 %); boulder speed 3.5–5.2 m/s vs 3–6 m/s and dropped single bounce (pure ground roll); ferns dropped; draw-call cap met at 50 (target 35, cap 50); tree trunk radius 0.256 m from `LEAFY_TREE_TRUNK_RADIUS_GLB = 0.14` vs 0.35 m; palms dropped (D4: `leafyTree` only).
- `assets.spec.json` lists `"assets": []` because this game owns zero custom GLBs.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (valley layout, dino kinematics, egg supply/spawns, boulder gullies, mud pits, stack delivery, scoring; pure, seeded) · `rules.test.ts` (tuning pins, seed validity, boulder lanes, botHarness limit bots) · `assets.ts` + `assets.test.ts` (manifest validation, models) · `camera.ts` (fitted view options, follow sizing) · `Scene.tsx` (one `useRunFrame`, camera, dino, eggs, boulders, nest, fx, audio loops) · `Valley.tsx` (ground, mud pits, trees, volcano backdrop) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/dino-egg-rescue.webp` · `tools/thumbs/inputs/dino-egg-rescue.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines, behaviour over branches:
- **Tuning pins:** speeds (5.0, 8.0 dash), stack multipliers (1.0, 0.85, 0.72, 0.60), mud multiplier (0.5), cooldowns (dash 1.5 s, stun 0.8 s, grace 1.0 s), pins for 450 (3 eggs), 240 (2 eggs), 100 (1 egg), 300 (golden egg).
- **Spawn logic & supply bound:** 1,000 seeds verify deterministic egg supply capped at ≤ 33; spawns move progressively further from nest; 3 golden eggs scheduled at 25 s, 50 s, 75 s; scattered eggs pause new spawns while ground count ≥ 4.
- **Movement & collisions:** velocity integration order; tree obstacle push-out against 0.256 m trunk; boundary clamp; dash speed cut by stack/mud; boulder collision stuns 0.8 s and triggers 1.0 s grace; hit during dash invulnerability or grace drops nothing.
- **Boulders & lanes:** 4 gully paths; constant speed per lane (no overtaking); lane headway ≥ 2.5 s > 0.70 s crossing time; boulders roll over eggs without interaction.
- **Scoring proof & bots:** 20 seeds per bot (optimal bot, safe 1-egg bot, idle bot) through real store (`simulateRun`); idle bot times out with 0 pts at 90000 ms; all runs pass `withinServerLimits(score, ms, limits)` under 6000 / 88000–92000 / 0 / 70; `capScore` is a no-op.
- Browser: common criteria (03), banner open/closed, Retry ×10 keeps geometries flat.

## Performance

Target **35** draw calls, cap **50**; triangles ≤ 75k with every GLB (dino 12k, trees instanced 6k, boulders pooled 4k, nest 2k, valley 4k, fx pools ≤ 3). Lights: `sunset` preset only. Pools warmed at mount (`fx.warm("sparkle", "puff", "debris", "score")`). No per-frame allocation.

## Audio

P-06 audio integration:
- Loops: `startLoop("hum", { pitch: 0.6, volume: 0.25 })` for boulder rumble (pitch/volume modulated by proximity). Scene restarts loop in `useEffect` when returning to `"playing"` and `!muted`.
- SFX: footstep thumps on stride; scoop pop (`"pickup"`); nest delivery chime with pitch scaled by stack size (`"chime"`); boulder hit bonk / egg scatter (`"hit"`); dash whoosh (`"whoosh"`); golden egg spawn shimmer.

## Accessibility

Boulder lanes telegraph with dust trail and shadow 0.8 s ahead of roll; carried egg stack count displayed clearly on game HUD ("Eggs x/3") and physically on dino back; dash cooldown ring indicator on button; golden egg off-screen hint with `<TargetMarkers>`; large touch controls (Dash button ≥ 72 px); `fx.shake` honours reduced motion. HUD stats styled with high-contrast text clear of shell chips.

## Risks and open questions

- **Waddle animation without foot slide:** stride-matched bob frequency: at top speed 5.0 m/s and reduced speeds (4.25, 3.6, 3.0 m/s), `waddle` frequency must scale with velocity so feet do not visually skate.
- **Egg stack spring stability:** egg physics on dino back (`EXPANSION_GLB_POINTS.dinoBackTop`) must use damped spring (`core/motion` `spring`) clamped so eggs never clip into the dino model during rapid turns or dash.
- **Open questions:** None; all design parameters and asset bindings verified and frozen by user decisions (2026-10-09).

## Status

```text
HANDOFF P-14-fix1 dino-egg-rescue
Branch / last commit: antigravity/design-dino-egg-rescue @ HEAD (pushed)
Files changed:
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/README.md
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/assets.spec.json
Checks:
  - Branch confirmed: antigravity/design-dino-egg-rescue
  - Template matched: 14 sections from treasure-island/README.md, <= 180 lines
  - assets.spec.json: valid empty assets array (0 custom GLBs owned)
  - git status / git diff shows only the 2 allowed files
```
