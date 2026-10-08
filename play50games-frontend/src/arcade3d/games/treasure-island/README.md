# Treasure Island

Owner: Claude. Slug: `treasure-island`. Adventure game 1 (order 11), complexity 2, the **reference game of the expansion**: the other 19 games copy this README's sections (in this order, ≤ 200 lines), its file split and its test budget. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §1. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x east, z south (+z = the dock), y up. Every "Changed from spec" line says what and why.

## Concept

A tiny tropical island at sunset. The explorer (the shared runner in a procedural explorer hat) walks it with a buzzing treasure detector and digs up five **hidden** treasures before a 90 s clock and the rising tide end the run. The detector ring on the sand says how warm you are (pulse speed, size and colour at once, plus a beep), so walking becomes reading a signal. Accent `#2dd4bf`.

## Controls

`meta.ts`: `scheme: "joystick"`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Dig" }`.

- `keyboard`: "WASD / arrows to move, hold E, Enter or Space to dig" (unchanged from the stub).
- `touch`: "Joystick to move, hold Dig to dig". Changed from the stub ("hold Action") because the button is labelled Dig.
- Input fields: `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (screen-relative; up = away from the camera). A dig starts on `actionPressed || jumpPressed` (one-frame, never lost: E / Enter / the touch Dig button set `action`, Space sets `jump`) and continues while `action || jump` is held. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ISLAND`, `EXPLORER`, `DETECTOR`, `DIG`, `TIDE`, `HINT`, `SPACING`) and are proven in `rules.test.ts`.

- **Island** (`ISLAND`): ellipse 28 × 22 (semi-axes 14 × 11); `rho(x, z) = sqrt((x/14)² + (z/11)²)`. Land is `rho ≤ shore(t)`, the shallows are the band `shore(t) < rho ≤ shore(t) + 0.12` (wading), deeper water is the boundary: a game-local radial clamp scales (x, z) back to `rho = shore + 0.12` (core `clampToBounds` is an AABB). Grass `rho ≤ 0.78`, beach outside it (about 3 m); same speed on both.
- **Explorer** (`EXPLORER`, robot-collector's model): circle r 0.4; top speed 5 on land, 3 in the shallows (60 %); accel 24, brake 30, eased turning (`turnTowards`, rate 14/s). Start (0, 9.2) at the dock's foot (`rho` 0.84), facing north. `stepExplorer` resolves props (`resolveSphereAabb`, circle-circle push-out), then the clamp, then **scales the step back to `maxSpeed · dt`** (before the tide), as robot-collector does.
- **Props** (rules footprints, never the mesh): palms 8–12 (seeded, `rho` 0.15–0.8, ≥ 2.2 apart, ≥ 3 from the start), trunk circle r 0.3; 2 rock outcrops (seeded centres at `rho` 0.45–0.75, one east, one west), 3–5 rocks each, size 0.6–2.5, circle r = 0.42 × size; fixed: crate stack 3 × 0.8 m at (−2.4, 9.0) as one AABB 1.7 × 0.9, umbrella pole circle r 0.15 at (7.5, 6.5), rowboat AABB 2.6 × 1.1 at (−9.5, 6.0), dock AABB |x| ≤ 0.9, z ≥ 10.2 (decoration, not walkable).
- **Treasures** (`generateIsland(seed)`): 5 spots, `rho ≤ 0.72`, ≥ 1.5 from every prop footprint edge, ≥ 6 apart, ≥ 7 from the start; all reachable (flood fill, 0.25 grid, clearance 0.4, inside the final-tide reach `rho ≤ 0.87`, connected to the start). **Fairness band:** the ideal route (start → all 5 centre to centre, best of 120 orders) is 38–56. 40 attempts, then `FALLBACK_ISLAND` (tested valid, unused on 1,000 seeds). Changed from spec: the "progressively further" spacing becomes this band, because the detector leads to the nearest treasure (the order is the player's, not the generator's) and the limit proof needs a minimum route; and `rho ≤ 0.72` instead of "outside the outer 25 %" so every dig reach is on land at the final tide.
- **Types by find order:** a seeded permutation of coins, coins, gem, gem with the chest inserted as the 4th or 5th find. Changed from spec (types per spot): the find order is the player's, so typing the k-th find is the only way to guarantee the late chest reveal.
- **Detector** (`DETECTOR`): target = the nearest undug treasure to the explorer's centre (ties: lower index), distance d. Strength `s = clamp(1 − d / 12, 0, 1)`. Pulse period `P = 1.2 − 1.05 · s` (1.2 s → 0.15 s); `rules.ts` advances `pulse += dt / P` and reports a beep on each wrap while s > 0 (deterministic, testable). Ring radius `0.7 + 0.8 · s`, colour slate `#64748b` → gold `#fbbf24` by s; `ready` (d ≤ 0.9) = solid gold double ring.
- **Dig** (`DIG`): a press starts a dig, the explorer **plants its feet** (velocity 0, movement ignored while digging). Hold time accumulates play dt; a release before 0.6 s cancels with no effect. At ≥ 0.6 s it resolves: an undug treasure within 0.9 of the centre is found, otherwise a **false dig** (sand puff, nothing found, clears `clean`). One dig per press: release to dig again. Changed from spec: planted feet and one-dig-per-press (the spec leaves both open) keep the pose readable, avoid accidental repeated false digs from a held button, and make the dig time exact in the proof.
- **Tide** (`TIDE`): `shore(t) = 1` until 70 s, then linear to 0.75 at 90 s (the walkable radius shrinks by 25 %); the clamp pushes a wading explorer inward with the water (≤ 14 · 0.25 / 20 = 0.175 m/s). The water plane rises 0.3 m (looks only; rules stay flat). Treasures sit at `rho ≤ 0.72`, so the tide never strands one.
- **Hint** (`HINT`): 20 s after play start or the last find without a find, `hint` = the detector's target; the seagull circles over it (r 2.0 at 4.5 m, 4 s a lap) until the next find.
- **Clock:** `durationMs: 90000` (fixed timer, the shell counts it down and ends with `"timeup"`).

## Scoring

`runScore(found, cleanFinds, won, timeLeftMs) = 200 · found + 50 · cleanFinds + (won ? 10 · floor(timeLeftMs / 1000) : 0)`. A find is clean when no false dig happened since the previous find (or since the start); a false dig voids only that one +50. Live: `addScore(200 | 250)` per find; on the win `setScore(runScore(...))` and `end("win")` in the same callback. `finalScore` is not overridden (duration = `elapsedMs`). Maximum 1000 + 250 + 10 · 81 = **2060**; time-up at most 4 · 250 = 1000. Popups: "+200" / "+250 clean".

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 2850 | **2060** |
| duration | 15000–92000 ms | **8500–92000 ms** |
| `base` / `max_pps` | 2850 / 2850 | **1250 / 100** |

The provisional 15 s minimum would reject a legal (lucky or perfect) win under 15 s, so it must drop. Proof plan (robot-collector's structure, through the real store):

1. **Speed:** `stepExplorer` never moves more than `5 · dt` per step before 70 s (20,000 random steps with random dt, props and the clamp).
2. **Clock:** `useRunFrame`'s dt is the store's `frameMs`; the bot drives `createArcadeStore()` with `advanceRunClock` + `playedFrameDt` (frames 4–300 ms, pauses, countdowns ending mid-frame): moving + digging time ≤ `elapsedMs`.
3. **Route:** each leg is at least its centre distance minus the reach at both ends (start leg ≥ 7 − 0.9, others ≥ 6 − 1.8, never clipped at 0), so any route ≥ ideal − 0.9 − 4 · 1.8 = ideal − 8.1 ≥ 38 − 8.1 = **29.9** (`MIN_ROUTE`; brute force over 120 orders on 1,000 seeds).
4. **Digging:** 5 digs of ≥ 0.6 s with the feet planted: ≥ 3.0 s without moving.
5. **Earliest win** = 29.9 / 5 + 3.0 = **8.98 s** → 1250 + 10 · floor(81.02) = **2060**. 8980 ≥ 8500 (480 ms, 5 % margin); the line `1250 + 100 · t` is 2100 at 8.5 s and only grows while the score only falls, so it never bites a legal run; a win after 70 s (tide push) scores ≤ 1450. Time-up: ≤ 1000 at exactly 90 s, ≤ 92 s.
6. **Every seed:** `generateIsland` returns only band-valid layouts or the tested fallback.

Tighter, not used: acceleration from rest at the start and after each dig (5 × 0.104 s) gives 9.50 s and 2050, but breaks if `accel` changes. Measured during the build: a full-knowledge bot (optimal order, straight lines + prop avoidance, never false-digs) on the real store at 60 fps, 20 fps and random 4–50 ms frames; its best and the margin to 2060 go here. `capScore` stays the safety net.

## Run end

- `end("win")` on the frame the 5th dig resolves (score as above). `resultDelayMs: 1600`: the last reveal (often the chest), confetti and `cheerPose` are seen.
- `"timeup"` by the shell at 90 s: no time bonus. No `"lose"`. The 5th dig resolving on the time-up frame: the clock runs first, so it is a time-up (deterministic, as robot-collector).

## Scene and camera

- **Follow 3/4 top-down, pitch 55°**: the route around the explorer must be read, and the ring must be visible on the sand. `useFittedView({ area, pitch: 55°, yaws: [0, π/2], focus: followFocus({ lookAt: [0, 0, 0], reach: WALK_BOX, fraction: 0.25, bounds: WALK_BOX }), margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 }, padding: 8, shift: true })`; `area` = the walkable box x ±15.7, z ±12.4, y 0–1.9 (explorer + hat); landscape looks across the 28 m side, portrait turns 90°. `<CameraRig follow={run.explorer} followFraction={0.25} bounds={WALK_BOX} damping={4} offset shift={view.shift}>`.
- Ground looks: sand height 0 for `rho ≤ 0.75`, down to −0.3 at `rho` 1, steeper beyond; water at −0.3 rising to 0 over the tide, so the drawn shoreline matches `shore(t)` exactly; the explorer is drawn at that height (rules flat).
- **Explorer** (`useHumanoidPose`, `applyLift={false}`, the group carries `bodyLift × 0.825`): `walkPose` with amount = 0.9 · min(1, speed / 5), phase by `gaitPhaseStep(amount, RUNNER_LANDMARKS, 0.825, speed, dt, 4)` (planted foot put); `idlePose` upper body when still; **`digPose(t)`** (game-local, `poses.ts`): both arms down and forward with `aimArm` (upper arm toward (±0.15, −0.6, 0.78), forearm (0, −0.85, 0.5)), scooping at 2.5 Hz, spine and chest bent forward 0.35 / 0.2 rad with `turnBone`, `levelFoot` both; blended in by the dig weight through `carryPose(0)` first (so no arm swings through the T); `cheerPose` on the win. Hat on `attach={{ head }}` (crown + brim 0.36 across, a band), drawn on the rigged GLB only; the stand-in wears its own.
- `environment: { background: "#fdba74", fog: ["#fdba74", 40, 95], lighting: "sunset" }`; `<SkyDome top="#1e3a8a" bottom="#fdba74">`; `<Water>` in a group whose y the tide moves, `foamEdge` as the tide foam line.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats` Treasures x/5, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `followFocus` + `CameraRig`, `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only, `turnTowards`), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `<Instanced>`, `BlobShadow`, `useCanvasTexture` (towel, sand speckle), `SHARED_ASSETS` / `REUSED_ASSETS` / `EXPANSION_ASSETS` + `COIN_GLB_SIZE` / `EXPANSION_GLB_SIZE`, rig (`<HumanoidModel attach={{ head }}>`, `useHumanoidPose`, `walkPose`, `idlePose`, `cheerPose`, `carryPose`, `blendPoses` + `POSE_MASK`, `aimArm`, `turnBone`, `levelFoot`, `gaitPhaseStep` / `walkStride`, `bodyLift`, `BONE`, `RUNNER_LANDMARKS`), materials (`material` override), `core/motion` (`hover`, `bank`, `waddle`), `core/fx` (`useFx`: `burst` sparkle / puff / splash / confetti, `score`, `shake`, `warm`; `useCameraShake` via `fx.shake`), `core/env` (`Water`, `SkyDome`), lighting `sunset`, `core/kit` `Gem`, `core/hud` `TargetMarkers` (hint arrow when the gull's target is under the HUD), `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below). Not used: `Trail`, `core/path`, `core/ai` (the gull circles on `hover`; the crabs `waddle` in place). Nothing generic is planned in the game folder; the ellipse clamp is game-local by the spec.

## Assets

No new generation: every GLB is in `core/modelManifest.ts` already. Fits in `assets.ts`, derived from the measured sizes, checked in `assets.test.ts` on the real meshes.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| explorer | D `SHARED_ASSETS.runner` scale 0.825 + B hat on `attach.head` | 1.556 m tall | circle r 0.4 | capsule + hat |
| chest | C `EXPANSION_ASSETS.chest` (default fit) | 0.9 × 0.6 × 0.6, lock +z | none (dug) | box |
| rock | C `EXPANSION_ASSETS.rock`, `<InstancedModel>`, seeded yaw / size | 0.6–2.5 long | circle 0.42 × size | sphere |
| palm | D `REUSED_ASSETS.palm`, `<InstancedModel>` | 3.0 tall, crown 2.4 | trunk circle r 0.3 | cylinder + cone |
| umbrella | D `REUSED_ASSETS.umbrella` | 2.2 tall, canopy 2.0 | pole circle r 0.15 | cylinder + cone |
| crate | D `SHARED_ASSETS.crate`, `<InstancedModel>` ×3 | 0.8 cube | one AABB | box |
| coin | D `SHARED_ASSETS.coin` (fit from `COIN_GLB_SIZE`), pool of 10 | 0.3 across, 5 per pile | none | disc |
| seagull | D `REUSED_ASSETS.pigeon` + `material: { color: "#f8fafc" }` | 0.6 long | none | sphere |
| crab | E `EXPANSION_ASSETS.crab` (this game's GLB, `assets.spec.json`), pool of 3 | 0.35 wide | none | sphere |
| gems | B `core/kit` `<Gem size={0.3}>` emerald `#34d399` / ruby `#f43f5e` | 0.3 | none | (is code) |
| procedural | B: island (sand + grass lathe), dug holes (pool of 5), detector ring + dig-progress arc (one shader ring each), rowboat (hull + seats), dock (deck + instanced posts), towel, explorer hat (crown + brim, band) | | | |

- Changed from spec: the seagull uses a `material` override, not a tint (a tint multiplies the grey pigeon and cannot make it white); the "chest stack" is a crate stack (a chest prop would spoil the chest reveal).
- `assets.spec.json` lists only the crab (the one GLB in this game's folder, already generated in the tier-3 batch). Everything else is shared (`assets/shared.spec.json` or the expansion catalog).

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (island generator, explorer step, detector, dig, tide, hint, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `digPose(t, out)`, `explorerPose` blend; tested in `poses.test.ts` on the real runner via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits and sizes on the real meshes) · `Scene.tsx` (one `useRunFrame`, camera, explorer, treasures, fx, audio) · `Island.tsx` (ground, water, sky, props, rowboat, dock) · `Detector.tsx` (ring, dig arc, beeps) · `Primitives.tsx` (stand-ins, hat) · `assets.spec.json` · `README.md` · `public/images/3d/treasure-island.webp` · `tools/thumbs/inputs/treasure-island.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4), behaviour over branches; core is already tested.

- **Generator:** deterministic per seed; 1,000 seeds valid (`rho ≤ 0.72`, spacing 6 / 7, ≥ 1.5 from footprints, band 38–56, flood-fill reachable at the final tide, chest 4th or 5th); `isValidIsland` rejects one case per rule; fallback valid and unused.
- **Movement:** top speed 5 / 3 wading; diagonals no faster; stops and slides at props; 20,000 random steps never exceed `5 · dt`, never enter a footprint, never leave the clamp; tide push ≤ 0.175 m/s.
- **Detector:** s = 1 at d 0, 0 at d ≥ 12, **monotonic non-increasing in d** (dense sweep); period 1.2 → 0.15; beep count over a fixed walk; re-targets the nearest undug after a find.
- **Dig:** found at 0.9, not at 0.91; release at 0.59 s cancels; feet planted; one dig per press; a false dig voids only the next find's +50.
- **Tide / hint:** `shore` 1 at 70 s, 0.75 at 90 s; no treasure ever outside the reach; hint after exactly 20 s, cleared by a find.
- **Scoring + proof:** `runScore` events; `MIN_ROUTE` 29.9 and ideal − 8.1 ≤ brute-force reach route on 1,000 seeds; earliest win 8.98 s scores 2060; every win 8.98–90 s and every time-up passes `withinServerLimits`, `capScore` a no-op; the best bot through the real store wins, never under 8.98 s, passes; an idle explorer times out with 0 at 90000 ms.
- `poses.test.ts` / `assets.test.ts`: soles within 1 cm of the floor in walk, dig and cheer; hat within 1 cm of the head anchor through them; hands never cross the T reach in the dig blend; fitted sizes from the table.
- Browser (headless CDP, flags + mock): the common criteria (03), banner open and closed, Retry ×10 keeps `geometries` flat.

## Performance

Target **45** draw calls, cap **60**; triangles ≤ 150k with every GLB (runner 18k, palms and rocks instanced; decor counts by `useQuality().decor`: palms 12 → 6, crabs 3 → 0 on "low"). Estimate: sky 1, water 1, island 2, palms 2, rocks 1, crates 1, umbrella 2 + towel 1, dock 2, rowboat 2, explorer 1–2 + hat 2, blob shadows 1, ring 1 + arc 1, holes 1, chest 1, gems 4, coins 1, gull 1, crabs 1, fx pools ≤ 3, score sprites ≤ 2 → 33–45. Lights: the `sunset` preset only. Pools sized at mount (`fx.warm("sparkle", "puff", "splash", "confetti", "score")`); no per-frame allocation. Measured with `?perf=1` (p95 on the mid-phone profile, 09 §L.3) and reported here.

## Audio

P-06 is not merged; designed against 06 §9.3 (`playSfx(name, { pitch, pan, volume })`, `startLoop(name)`): `startLoop("surf", { volume: 0.25 })` on play (stopped by the shell on pause, over, mute); detector beep `playSfx("click", { pitch: 0.8 + 0.8 · s, volume: 0.3 + 0.4 · s })` per pulse; dig `"thud"` every 0.2 s of a hold; find `"pickup"` (+ `"chime"` when clean); false dig `"hit"` at low volume; tide `"whoosh"` at 70 s and the surf loop to 0.5; win fanfare by the shell. Built before P-06 lands: find `"pickup"`, false dig `"hit"`, beeps silent (the ring carries the signal), then adopted with P-06.

## Accessibility

Three visual channels at once (pulse speed, ring size, colour) plus an optional beep, so colour is never needed alone; "ready" is a shape change (double ring). Hold-to-dig shows a progress arc. Seagull hint after 20 s. HUD chip "Treasures x/5". Keyboard and touch both complete the game; the Dig button is 72 px. `fx.shake` honours reduced motion (core).

## Risks and open questions

- **Small hero on phones:** the whole island stays on screen, so on 390 × 844 the explorer is about 22 px tall and the ring 20–45 px. Measured in the first playable; see question 1.
- Band acceptance: if under 30 % of first attempts pass 38–56, the band moves and the proof numbers with it (tests recompute them).
- The ring shader and the rising water must not z-fight the sloped sand (ring drawn with `depthWrite: false` at ground + 0.02).
- Clean-city found the runner's feet sliding under a cadence cap: amount = 0.9 · speed / 5 with the cap 4 must not bite at 5 m/s (`gait` check in `poses.test.ts`).
- P-06 timing (audio above).
- **Open questions for the user:** (1) Camera: whole island always visible (as designed) or a closer follow camera showing about 60 % of the island, with `TargetMarkers` for off-screen hints? (2) Crabs: 3 scuttling decor crabs on the beach (+1 draw call, no credits: already generated) yes or no?

## Status

(empty until the build)
