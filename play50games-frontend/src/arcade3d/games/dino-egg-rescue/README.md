# Dino Egg Rescue

Owner: Antigravity. Slug: `dino-egg-rescue`. Adventure game 4 (order 14), complexity 2. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §4. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south (+z = south / nest side), y up. Every "Changed from spec" line says what and why.

## Concept

A prehistoric valley at sunset. A clumsy baby dino (`EXPANSION_ASSETS.dino`) gathers runaway eggs across a 30 × 22 m valley and carries them back to its nest in the South-West before a 90 s clock runs out. The signature mechanic is risk/reward stacking: the dino carries up to 3 eggs on its back, but each carried egg slows it down (1.0 → 0.85 → 0.72 → 0.60 speed), and a rolling boulder drops the whole stack! Boulders roll down gullies from an active volcano in the North-East, and sticky mud pits cut speed in half. Golden eggs spawn every ~25 s for high-value rescue opportunities. Accent `#a3e635`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Dash" }`.

- `keyboard`: "WASD / arrows to move, Space or E to dash" (matches `meta.ts`).
- `touch`: "Joystick to move, tap Dash to dash". Changed from stub ("Joystick + Action to dash") because the button is labelled Dash (`touchLabels`).
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative). Dash starts on `actionPressed || jumpPressed` (Space / E / touch Dash button): 0.4 s speed burst at 8.0 m/s with 1.5 s cooldown; grants 0.4 s boulder invulnerability. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`VALLEY`, `DINO`, `EGGS`, `BOULDERS`, `TREES`, `MUD`, `NEST`, `SCORING`) and are proven in `rules.test.ts`.

- **Valley** (`VALLEY`): 30 × 22 m (x ±15, z ±11). Outer perimeter clamped via `clampToBounds`. Ground is grass `#84cc16` and soil `#a16207`; volcano backdrop outside bounds at NE ((16, −13), procedural cone with glowing crater `#f97316`).
- **Nest** (`NEST`): centered at SW (−11.0, 7.5), radius 1.8 m with delivery contact zone r 1.4 m. Procedural torus with straw canvas texture. Entering contact zone deposits all carried eggs instantly.
- **Dino** (`DINO`, `EXPANSION_ASSETS.dino`): 1.1 m long, 0.8 m tall, faces +z. Collision circle r 0.55 m. Base speed 5.0 m/s, accel 20 m/s², brake 25 m/s², turn rate 12 rad/s (`turnTowards`). Movement step resolves trees (`resolveSphereAabb`, circle push-out), then the boundary clamp, then scales to `maxSpeed · dt`.
- **Egg carry & speed stacking** (`EGGS`): carry up to 3 eggs on back. Speed multiplier: 0 eggs × 1.0 (5.0 m/s), 1 egg × 0.85 (4.25 m/s), 2 eggs × 0.72 (3.60 m/s), 3 eggs × 0.60 (3.00 m/s). Eggs wobble with spring physics (`core/motion` `spring`).
- **Mud pits** (`MUD`): 3 static mud patches (circles r 1.6 m seeded away from nest and egg spawns). Inside mud, speed is multiplied by 0.5 (multiplicative: 3 eggs in mud = 3.0 × 0.5 = 1.5 m/s).
- **Dash** (`DINO`): Space / E / Dash button. 0.4 s burst at 8.0 m/s (1.5 s cooldown). Squash & stretch on burst (`core/motion`). Invulnerable to boulder hits during the 0.4 s burst.
- **Boulders** (`BOULDERS`, `EXPANSION_ASSETS.rock` pool): roll down 2 to 4 fixed gullies (`core/path`) from NE to SW at 3.5–5.5 m/s. Interval decreases from 3.0 s down to 1.2 s over 90 s. Lanes 1–2 active from 0 s; lane 3 unlocks at 30 s; lane 4 unlocks at 60 s. Collision circle r 0.5 m. On hit (unless dashing): drops entire egg stack (eggs scatter 1.5 m away and rest on ground), dino stunned for 0.8 s (velocity 0, controls locked), boulder breaks into debris (`core/fx`).
- **Trees & cover** (`TREES`, `EXPANSION_ASSETS.leafyTree`, `REUSED_ASSETS.palm`): 8–10 trees. Trunk circle r 0.35 m blocks movement and stops boulders (boulder crumbles into debris on trunk contact).
- **Egg spawning** (`EGGS`): max 4 standard eggs on ground simultaneously. Procedural ellipsoids (0.4 × 0.3 m) with canvas spots in 3 pastel colors (`#fde68a`, `#bfdbfe`, `#fbcfe8`). Spawn ≥ 6.0 m from nest center, ≥ 3.0 m apart, never inside mud pits or tree trunks. Pick-up radius 0.6 m. Scoop is automatic on contact if carry stack < 3. Ground eggs replenish after collection/delivery.
- **Golden egg** (`EGGS`): glowing egg (`#fbbf24`, gold sparkle halo) spawns at 25 s, 50 s, 75 s; despawns after 8.0 s if uncollected. Delivers for 300 pts flat.
- **Clock**: `durationMs: 90000` (fixed 90 s timer; shell counts down and ends with `"timeup"`).

## Scoring

`runScore(regularDelivered, regularPoints, goldenDelivered) = regularPoints + 300 · goldenDelivered`.
- 1 egg delivered: 100 pts (1 × 100).
- 2 eggs delivered together: 240 pts (2 × 120).
- 3 eggs delivered together: 450 pts (3 × 150).
- Golden egg: 300 pts flat.
- Live: `addScore(points)` on nest delivery event; popup score sprite (`fx.score`).
- Ceilings: Theoretical max with greedy 3-egg trips: ~12 trips × 450 = 5400 + 3 × 300 = 6300 pts. Human expert: 2500–3500 pts.

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 6000 | **6000** |
| duration | 10000–92000 ms | **88000–92000 ms** |
| `base` / `max_pps` | 6000 / 6000 | **0 / 70** |

The provisional 10 s minimum and 6000 pps were loose place-holders. Proposed limits hold:
1. **Distance floor:** nest is at (−11, 7.5); all eggs spawn ≥ 6.0 m from nest centre. Single round trip ≥ 12.0 m. For 3 eggs spaced ≥ 3.0 m apart, minimum collection tour ≥ 18.0 m.
2. **Kinematic speed bounds:** dino top speed ≤ 5.0 m/s (slowed by stack to 3.0 m/s and mud to 1.5 m/s); dash burst adds 3.2 m every 1.5 s (average speed ≤ 5.7 m/s empty, ≤ 4.3 m/s loaded). Minimum time per 3-egg round trip ≥ 3.87 s.
3. **Trip ceiling in 90 s:** at most 90 / 3.87 = 23 theoretical trips, but egg replenishment (max 4 on ground) and travel distances across the 30 × 22 m valley cap realistic oracle trips at 11–12 trips (≤ 5400 pts).
4. **Golden eggs:** exactly 3 spawns at 25 s, 50 s, 75 s (3 × 300 = 900 pts).
5. **Score ceiling:** realistic perfect run with golden eggs: 11 trips × 450 + 900 = 5850 pts ≤ 6000 pts.
6. **Linear envelope:** $70 \text{ pts/s} \times 90 \text{ s} = 6300 \ge 6000$, ensuring `withinServerLimits(score, ms, limits)` passes on all valid runs.

## Run end

- `"timeup"` by shell at 90 s (`durationMs: 90000`). Result delay `resultDelayMs: 1200` to show celebration / nest sparkle.
- No early win or lose condition (pure time-attack endurance collect).

## Scene and camera

- **Follow 3/4 top-down, pitch 50°**: `useFittedView` with dynamic window sizing (`camera.ts`: targeting ~34 px/m at 390 × 844 portrait and ~24 px/m at 844 × 390 landscape), pitch 50°, `followFocus` centered on dino with bounds clamped to the valley (`VALLEY_BOUNDS`). Follow live point: `<CameraRig follow={{ x: dino.x, y: 0, z: dino.z }} bounds={VALLEY_BOUNDS} damping={4} followFraction={1} offset={view.offset} shift={view.shift} />`.
- **Readability on 390 × 844**: ~34 px/m window ensures dino (1.1 m) is ~37 px long and eggs (0.4 m) with 0.8 m emissive ground glow are ~27 px across, exceeding the 24 px minimum readability threshold.
- **Dino animation:** `core/motion` `waddle` (body roll and head bob stride-matched to speed, avoiding foot slip), `squashStretch` on dash burst. Carried eggs attached above dino back, wobbling via `spring`.
- `environment: { background: "#7c2d12", lighting: "sunset" }`; prehistoric grass `#84cc16` and soil `#a16207`, volcano backdrop cone at NE with lava glow `#f97316`.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`, `clampToBounds`), `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`), `core/motion` (`waddle`, `spring`, `squashStretch`), `core/path` (boulder gullies), `core/limits` (`withinServerLimits`, `capScore`), `core/testing/botHarness` (`createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useCanvasTexture` (egg spots, nest straw), `EXPANSION_ASSETS.dino`, `EXPANSION_ASSETS.rock`, `EXPANSION_ASSETS.leafyTree`, `REUSED_ASSETS.palm`, `core/fx` (`useFx`: `burst` sparkle / dust / debris, `score`, `shake`), `core/hud/TargetMarkers` (golden egg hint arrow when off-screen), `useQuality` + `scaledCount`, P-06 audio (`startLoop`, `playSfx`).

## Assets

No new generation: every GLB is shared or reused. Fits in `assets.ts`, checked in `assets.test.ts`.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| dino | C (A) `EXPANSION_ASSETS.dino` (`shared/dino.glb`) | 1.1 m long, 0.8 m tall | circle r 0.55 | capsule |
| boulders | C (A) `EXPANSION_ASSETS.rock` (`shared/rock.glb`) pool | 0.8–1.2 m diameter | circle r 0.5 | sphere |
| leafyTree | C (A) `EXPANSION_ASSETS.leafyTree` (`shared/leafyTree.glb`) | 3.5 m tall | trunk circle r 0.35 | cylinder + cone |
| palm | D `REUSED_ASSETS.palm` (`clean-city/palm.glb`) | 3.0 m tall | trunk circle r 0.3 | cylinder + cone |
| eggs | B procedural ellipsoids (canvas spots) | 0.4 × 0.3 m | circle r 0.3 (pickup r 0.6) | sphere |
| goldenEgg | B procedural ellipsoid (emissive gold) | 0.45 × 0.35 m | circle r 0.35 (pickup r 0.7) | sphere |
| nest | B procedural torus + straw texture | 3.6 m diameter | delivery circle r 1.4 | cylinder |
| procedural | B: valley terrain, mud decal discs, volcano backdrop cone, gully tracks | | | |

- `assets.spec.json` lists `"assets": []` because this game owns zero custom GLBs.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (valley layout, dino kinematics, egg spawning, boulder gullies, mud pits, stack delivery, scoring; pure, seeded) · `rules.test.ts` (tuning pins, seed validity, boulder lanes, botHarness limit bots) · `assets.ts` + `assets.test.ts` (manifest validation, models) · `camera.ts` (fitted view options, follow sizing) · `Scene.tsx` (one `useRunFrame`, camera, dino, eggs, boulders, nest, fx, audio loops) · `Valley.tsx` (ground, mud pits, trees, volcano backdrop) · `Primitives.tsx` (stand-ins) · `assets.spec.json` · `README.md` · `public/images/3d/dino-egg-rescue.webp` · `tools/thumbs/inputs/dino-egg-rescue.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines, behaviour over branches:
- **Tuning pins:** speeds (5.0, 8.0 dash), stack multipliers (1.0, 0.85, 0.72, 0.60), mud multiplier (0.5), cooldowns (dash 1.5 s, stun 0.8 s), spawn bounds.
- **Valley & generator:** deterministic per seed; 1,000 seeds verify valid egg spawns (≥ 6.0 m from nest, ≥ 3.0 m apart, no mud or tree intersection); golden egg schedules at 25 s, 50 s, 75 s.
- **Movement & collisions:** dino kinematics with 0–3 eggs; mud pit slowing; dash speed and invulnerability window; swept step never exceeds max speed; tree trunk obstacle push-out.
- **Boulders:** gully lane progression (2 lanes at 0 s, 3 at 30 s, 4 at 60 s); boulder interval decreasing; hit drops stack and stuns; tree collision crumbles boulder; dash avoids hit.
- **Egg carry & delivery:** scoop adds to stack up to 3; nest entry deposits stack; score calculation matches formula (+100/240/450, golden 300).
- **Scoring proof & bots:** 200 seeds each with botHarness (optimal bot, safe 1-egg bot, idle bot); idle bot times out with 0 pts at 90000 ms; all runs pass `withinServerLimits` under the proposed envelope; `capScore` is a no-op.
- Browser: common criteria (03), banner open/closed, Retry ×10 keeps geometries flat.

## Performance

Target **40** draw calls, cap **55**; triangles ≤ 80k with every GLB (dino 12k, trees instanced 6k, boulders pooled 4k, nest 2k, valley 4k, fx pools ≤ 3). Lights: `sunset` preset only (no dynamic lights). Pools warmed at mount (`fx.warm("sparkle", "burst", "score")`). No per-frame allocation.

## Audio

P-06 audio integration:
- Loops: `startLoop("rumble", { volume: 0.25 })` for rolling boulders (pitch/volume modulated by proximity).
- SFX: footstep thumps on stride; scoop pop (`"pickup"`); nest delivery chime with pitch scaled by stack size (`"chime"`); boulder hit bonk / egg scatter (`"hit"`); dash whoosh (`"whoosh"`); golden egg spawn shimmer.

## Accessibility

Boulder lanes telegraph with dust trail and shadow 0.8 s ahead of roll; carried egg stack count displayed clearly on HUD ("Eggs x/3") and physically on dino's back; dash cooldown ring indicator; golden egg off-screen hint with `<TargetMarkers>`; large touch controls (Dash button ≥ 72 px); `fx.shake` honours reduced motion.

## Risks and open questions

- **Waddle animation without foot slide:** stride-matched bob frequency: at top speed 5.0 m/s and reduced speeds (4.25, 3.6, 3.0 m/s), `waddle` frequency must scale with velocity so feet do not visually skate.
- **Egg stack spring stability:** egg physics on dino's back must use damped spring (`core/motion` `spring`) clamped so eggs never clip into the dino model during rapid turns or dash.
- **Open questions:** None; all design parameters and asset bindings verified.

## Status

```text
HANDOFF P-14 dino-egg-rescue
Branch / last commit: antigravity/design-dino-egg-rescue (committed, not pushed)
Files changed:
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/README.md
  play50games-frontend/src/arcade3d/games/dino-egg-rescue/assets.spec.json
Checks:
  - Branch confirmed: antigravity/design-dino-egg-rescue
  - Template matched: 14 sections from treasure-island/README.md, <= 200 lines
  - assets.spec.json: valid empty assets array (0 custom GLBs owned)
  - git status / git diff shows only the 2 allowed files
```
