# Treasure Island

Owner: Claude. Slug: `treasure-island`. Adventure game 1 (order 11), complexity 2, the **reference game of the expansion**: the other 19 games copy this README's sections (in this order, ≤ 200 lines), its file split and its test budget. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §1. Gate G0 approved 2026-10-08 with two user decisions (below); built on `claude/game-treasure-island` (`Status`). Units: metres, seconds; x east, z south (+z = the dock), y up. Every "Changed from spec" line says what and why.

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
- **Treasures** (`generateIsland(seed)`): 5 spots, `rho ≤ 0.72`, ≥ 1.5 from every prop footprint edge, never behind a palm crown or the canopy from the camera (`SIGHT`, Scene and camera), ≥ 6 apart, ≥ 7 from the start; all reachable (flood fill, 0.25 grid, clearance 0.4, inside the final-tide reach `rho ≤ 0.87`, connected to the start). **Fairness band:** the ideal route (start → all 5 centre to centre, best of 120 orders) is 38–56. 40 attempts, then `FALLBACK_ISLAND` (tested valid, unused on 1,000 seeds). Changed from spec: the "progressively further" spacing becomes this band, because the detector leads to the nearest treasure (the order is the player's, not the generator's) and the limit proof needs a minimum route; and `rho ≤ 0.72` instead of "outside the outer 25 %" so every dig reach is on land at the final tide.
- **Types by find order:** a seeded permutation of coins, coins, gem, gem with the chest inserted as the 4th or 5th find. Changed from spec (types per spot): the find order is the player's, so typing the k-th find is the only way to guarantee the late chest reveal.
- **Detector** (`DETECTOR`): target = the nearest undug treasure to the explorer's centre (ties: lower index), distance d. Strength `s = clamp(1 − d / 12, 0, 1)`. Pulse period `P = 1.2 − 1.05 · s` (1.2 s → 0.15 s); `rules.ts` advances `pulse += dt / P` and reports a beep on each wrap while s > 0 (deterministic, testable). Ring radius `0.7 + 0.8 · s`, colour slate `#64748b` → gold `#fbbf24` by s; `ready` (d ≤ 0.9) = solid gold double ring.
- **Dig** (`DIG`): a press starts a dig, the explorer **plants its feet** (velocity 0, movement ignored while digging). Hold time accumulates play dt; a release before 0.6 s cancels with no effect. At ≥ 0.6 s it resolves: an undug treasure within 0.9 of the centre is found, otherwise a **false dig** (sand puff, nothing found, clears `clean`). One dig per press: release to dig again. Changed from spec: planted feet and one-dig-per-press (the spec leaves both open) keep the pose readable, avoid accidental repeated false digs from a held button, and make the dig time exact in the proof.
- **Tide** (`TIDE`): `shore(t) = 1` until 70 s, then linear to 0.75 at 90 s (the walkable radius shrinks by 25 %); the clamp pushes a wading explorer inward with the water (≤ 14 · 0.25 / 20 = 0.175 m/s). The water plane rises 0.3 m (looks only; rules stay flat). Treasures sit at `rho ≤ 0.72`, so the tide never strands one.
- **Hint** (`HINT`): 20 s after play start or the last find without a find, `hint` = the detector's target; the seagull circles over it (r 2.0 at 4.5 m, 4 s a lap, on the camera's line of sight through the spot so it shows right over it) until the next find; an off-screen spot gets a `TargetMarkers` arrow.
- **Clock:** `durationMs: 90000` (fixed timer, the shell counts it down and ends with `"timeup"`).

## Scoring

`runScore(found, cleanFinds, won, timeLeftMs) = 200 · found + 50 · cleanFinds + (won ? 10 · floor(timeLeftMs / 1000) : 0)`. A find is clean when no false dig happened since the previous find (or since the start); a false dig voids only that one +50. Live: `addScore(200 | 250)` per find; on the win `setScore(runScore(...))` and `end("win")` in the same callback. `finalScore` is not overridden (duration = `elapsedMs`). Maximum 1000 + 250 + 10 · 81 = **2060**; time-up at most 4 · 250 = 1000. Popups: "+200" / "+250 clean".

### Server limits and why they hold (the proof)

| | provisional (02 §C.4) | set on this branch (`meta.ts` = `arcade-games.json`, `enabled: false`) |
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

Tighter, not used: acceleration from rest at the start and after each dig (5 × 0.104 s) gives 9.50 s and 2050, but breaks if `accel` changes. **Measured:** a full-knowledge bot (optimal order, grid path around props, never false-digs) on the real store, 300 seeds each at 60 fps, 20 fps and random 4–50 ms frames: best 10.38 / 10.45 / 10.48 s, all **2040** (99 % of 2060; seed 94), slowest 12.3 s; in the browser 10.25–13.3 s, 1960–2040. Margins: min duration 480 ms under the proven 8.98 s and 1.9 s under the best bot; max 2 s over the 90 s clock. Spam bots and an idle explorer pass too; `capScore` is a no-op on every run (tests).

## Run end

- `end("win")` on the frame the 5th dig resolves (score as above). `resultDelayMs: 1600`: the last reveal (often the chest), confetti and `cheerPose` are seen.
- `"timeup"` by the shell at 90 s: no time bonus. No `"lose"`. The 5th dig resolving on the time-up frame: the clock runs first, so it is a time-up (deterministic, as robot-collector).

## Scene and camera

- **Closer follow camera, 3/4 top-down, pitch 50°** (decision 1): a window of the island centred on the explorer, sized from the canvas (`looks.ts` `windowHalf`: 52 CSS px per metre as the aim, half extents x 3.5–10, z 3.5–7.5 and ≤ 1.4 × x, in 0.25 m steps), so a phone shows a 7.5 × 10.5 m window and a 1280 × 800 desktop 20 × 15 m (≈ 60 % of the island). `useFittedView(viewFor(w, h))` = `{ area: ±hx × 0–1.9 × ±hz around the origin, pitch, yaws: [0], focus: [origin], margin: { top: 0.11, bottom: 0.07, left: 0.02, right: 0.02 }, padding: 8, shift: true, fov: 45 }` (one cached object per window size), `<CameraRig follow={run.explorer} followFraction={1} offset shift damping={4}>`. One yaw: the camera always looks north from the dock's side, so the start reads the same on every screen and the canopy sight rule (below) holds. Changed from the design (whole island, pitch 55°, yaws [0, π/2]): the user's decision; 55° drew the explorer 15 % shorter. An off-screen seagull hint gets a core `<TargetMarkers>` arrow at the screen edge; the detector's own target gets none (the ring is the game: an arrow to it would play it for you).
- **Sight rule** (`rules.ts` `SIGHT`, `behindCanopy`): with one yaw, a palm crown or the umbrella canopy hides a strip of sand north of it; no treasure is placed there (+ 0.3 m), so a dig and its reveal are never behind a crown.
- Ground looks: sand height 0 for `rho ≤ 0.75`, down to −0.3 at `rho` 1, steeper beyond; water at −0.3 rising to 0 over the tide, so the drawn shoreline matches `shore(t)` exactly; the explorer is drawn at that height (rules flat).
- **Explorer** (`useHumanoidPose`, `applyLift={false}`, the group carries `bodyLift × 0.825`): `walkPose` with amount = min(1, speed / 5) (the full run at top speed: its own 1.26 m stride keeps 5 m/s under the cadence cap; 0.9 hit the cap and slid), phase by `gaitPhaseStep(amount, RUNNER_LANDMARKS, 0.825, speed, dt, 4)` (planted foot put); `idlePose` upper body when still; **`digPose(t)`** (game-local, `poses.ts`): a crouch (thighs 0.5, knees 0.95 rad, soles flat), spine / chest / head bent 0.55 / 0.35 / −0.3 rad with `turnBone`, both arms aimed down and forward with `aimArm`, scooping at 2.5 Hz, `levelFoot` both; blended in by the dig weight through `carryPose(0)` first (so no arm swings through the T); `cheerPose` on the win, turned to the camera. Hat on `attach={{ head }}` (crown + brim 0.36 across, a band), drawn on the rigged GLB only; the stand-in wears its own.
- `environment: { background: "#fdba74", fog: ["#fdba74", 40, 95], lighting: "sunset" }`; `<SkyDome top="#1e3a8a" bottom="#fdba74">`; `<Water>` in a group whose y the tide moves; the foam line is an elliptic ring at `shore(t)` (core `foamEdge` foams the plane's rectangular edge, not a shoreline).

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats` Treasures x/5, `environment`), `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `CameraRig` (full follow, so no `followFocus`), `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), collision (`resolveSphereAabb`, `circlesOverlapXZ`, `distanceToBoxXZ`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only, `turnTowards`), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel>`, `<Instanced>`, `BlobShadow`, `useCanvasTexture` (towel, sand speckle), `SHARED_ASSETS` / `REUSED_ASSETS` / `EXPANSION_ASSETS` + `COIN_GLB_SIZE` / `EXPANSION_GLB_SIZE`, rig (`<HumanoidModel attach={{ head }}>`, `useHumanoidPose`, `walkPose`, `idlePose`, `cheerPose`, `carryPose`, `blendPoses` + `POSE_MASK`, `aimArm`, `turnBone`, `levelFoot`, `gaitPhaseStep` / `walkStride`, `bodyLift`, `BONE`, `RUNNER_LANDMARKS`), materials (`material` override), `core/motion` (`hover`, `waddle`), `core/fx` (`useFx`: `burst` sparkle / puff / confetti, `score`, `shake`, `warm`; `useCameraShake` via `fx.shake`), `core/env` (`Water`, `SkyDome`), lighting `sunset`, `core/kit` `Gem`, `core/hud` `TargetMarkers` (hint arrow when the gull's target is off-screen or under the HUD), `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below). Not used: `Trail`, `core/path`, `core/ai` (the gull circles on `hover`; the crabs `waddle` in place). Nothing generic is planned in the game folder; the ellipse clamp is game-local by the spec.

## Assets

No new generation: every GLB is in `core/modelManifest.ts` already. Fits in `assets.ts`, derived from the measured sizes, checked in `assets.test.ts` on the real meshes.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| explorer | D `SHARED_ASSETS.runner` scale 0.825 + B hat on `attach.head` | 1.556 m tall | circle r 0.4 | capsule + hat |
| chest | C `EXPANSION_ASSETS.chest` (default fit) | 0.9 × 0.6 × 0.6, lock +z | none (dug) | box |
| rock | C `EXPANSION_ASSETS.rock`, `<InstancedModel>`, seeded yaw / size | 0.6–2.5 long | circle 0.42 × size | sphere |
| palm | D `REUSED_ASSETS.palm`, `<InstancedModel>` | 3.0 tall, crown 2.4 | trunk circle r 0.3 | cylinder + cone |
| umbrella | D `REUSED_ASSETS.umbrella` | 2.8 tall, canopy 2.6, edge 1.73 m up | pole circle r 0.15 | cylinder + cone |
| crate | D `SHARED_ASSETS.crate`, `<InstancedModel>` ×3 | 0.8 cube | one AABB | box |
| coin | D `SHARED_ASSETS.coin` (fit from `COIN_GLB_SIZE`), pool of 10 | 0.3 across, 5 per pile | none | disc |
| seagull | D `REUSED_ASSETS.pigeon` + `material: { color: "#f8fafc" }` | 0.6 long | none | sphere |
| crab | E `EXPANSION_ASSETS.crab` (this game's GLB, `assets.spec.json`), pool of 3 (decision 2) | 0.5 wide | none | sphere |
| gems | B `core/kit` `<Gem size={0.3}>` emerald `#34d399` / ruby `#f43f5e` | 0.3 | none | (is code) |
| procedural | B: island (sand + grass lathe), dug holes (pool of 5), detector ring + dig-progress arc (one shader quad for both), rowboat (hull, floor, seats), foam line, dock (deck + instanced posts), towel, explorer hat (crown + brim, band) | | | |

- Changed from the design table: the umbrella is 2.8 m (at 2.2 m the canopy edge was at the hatted explorer's eyes); the crab 0.5 m (0.35 m was 9 px on a phone).
- Changed from spec: the seagull uses a `material` override, not a tint (a tint multiplies the grey pigeon and cannot make it white); the "chest stack" is a crate stack (a chest prop would spoil the chest reveal).
- `assets.spec.json` lists only the crab (the one GLB in this game's folder, already generated in the tier-3 batch). Everything else is shared (`assets/shared.spec.json` or the expansion catalog).

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `rules.ts` (island generator, explorer step, detector, dig, tide, hint, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: `digPose(t, out)`, `explorerPose` blend; tested in `poses.test.ts` on the real runner via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits and sizes on the real meshes) · `Scene.tsx` (one `useRunFrame`, camera, explorer, treasures, fx, audio) · `Island.tsx` (ground, water, sky, props, rowboat, dock) · `Detector.tsx` (ring, dig arc, beeps) · `Primitives.tsx` (stand-ins, hat) · `assets.spec.json` · `README.md` · `public/images/3d/treasure-island.webp` · `tools/thumbs/inputs/treasure-island.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4), behaviour over branches; core is already tested. Built: 727 lines (the bot harness, a grid path finder with a heap, is ~170 of them).

- **Generator:** deterministic per seed; 1,000 seeds valid (`rho ≤ 0.72`, spacing 6 / 7, ≥ 1.5 from footprints, band 38–56, flood-fill reachable at the final tide, chest 4th or 5th); `isValidIsland` rejects one case per rule; fallback valid and unused.
- **Movement:** top speed 5 / 3 wading; diagonals no faster; stops and slides at props; 20,000 random steps never exceed `5 · dt`, never enter a footprint, never leave the clamp; tide push ≤ 0.175 m/s.
- **Detector:** s = 1 at d 0, 0 at d ≥ 12, **monotonic non-increasing in d** (dense sweep); period 1.2 → 0.15; beep count over a fixed walk; re-targets the nearest undug after a find.
- **Dig:** found at 0.9, not at 0.91; release at 0.59 s cancels; feet planted; one dig per press; a false dig voids only the next find's +50.
- **Tide / hint:** `shore` 1 at 70 s, 0.75 at 90 s; no treasure ever outside the reach; hint after exactly 20 s, cleared by a find.
- **Scoring + proof:** `runScore` events; `MIN_ROUTE` 29.9 and ideal − 8.1 ≤ brute-force reach route on 1,000 seeds; earliest win 8.98 s scores 2060; every win 8.98–90 s and every time-up passes `withinServerLimits`, `capScore` a no-op; the best bot through the real store wins, never under 8.98 s, passes; an idle explorer times out with 0 at 90000 ms.
- `poses.test.ts` / `assets.test.ts`: soles within 1 cm of the floor in walk, dig and cheer; hat within 1 cm of the head anchor through them; hands never cross the T reach in the dig blend; fitted sizes from the table.
- Browser (headless CDP, flags + mock): the common criteria (03), banner open and closed, Retry ×10 keeps `geometries` flat.

## Performance

Target **45** draw calls, cap **60**; triangles ≤ 150k with every GLB (runner 18k, palms and rocks instanced; decor counts by `useQuality().decor`: crabs 3 → 0 on "low"; palms are footprints, so all are drawn). Estimate: sky 1, water 1, island 2, palms 2, rocks 1, crates 1, umbrella 2 + towel 1, dock 2, rowboat 2, explorer 1–2 + hat 2, blob shadows 1, ring 1 + arc 1, holes 1, chest 1, gems 4, coins 1, gull 1, crabs 1, fx pools ≤ 3, score sprites ≤ 2 → 33–45. Lights: the `sunset` preset only. Pools sized at mount (`fx.warm("sparkle", "puff", "confetti", "score")`); no per-frame allocation. **Measured** (`?perf=1`, headless Chrome, flagged preview build): 1280 × 800 calls 20–22 (max 29), 82–100k tris, p95 16.9 ms; 390 × 844 touch, banner open, 4× CPU: calls 15–17 (max 24), p95 17.9–18.6 ms; 844 × 390: calls 20–21, p95 19–22 ms. Retry ×10 (desktop and phone): geometries 24 / 20-21 and textures 26 / 25 flat after the first run. No console errors.

## Audio

P-06 is not merged; designed against 06 §9.3 (`playSfx(name, { pitch, pan, volume })`, `startLoop(name)`): `startLoop("surf", { volume: 0.25 })` on play (stopped by the shell on pause, over, mute); detector beep `playSfx("click", { pitch: 0.8 + 0.8 · s, volume: 0.3 + 0.4 · s })` per pulse; dig `"thud"` every 0.2 s of a hold; find `"pickup"` (+ `"chime"` when clean); false dig `"hit"` at low volume; tide `"whoosh"` at 70 s and the surf loop to 0.5; win fanfare by the shell. Built before P-06 lands: find `"pickup"`, false dig `"hit"`, beeps silent (the ring carries the signal), then adopted with P-06.

## Accessibility

Three visual channels at once (pulse speed, ring size, colour) plus an optional beep, so colour is never needed alone; "ready" is a shape change (double ring). Hold-to-dig shows a progress arc. Seagull hint after 20 s. HUD chip "Treasures x/5". Keyboard and touch both complete the game; the Dig button is 72 px. `fx.shake` honours reduced motion (core).

## Risks and open questions

- **Decisions (user, 2026-10-08):** (1) closer follow camera, about 60 % of the island on a desktop and closer on a phone (explorer measured 42 px tall on 390 × 844, 46 px at 1280 × 800, 28 px at 844 × 390 with the banner open), with `TargetMarkers` arrows for the seagull's off-screen spot; (2) three decor crabs on the beach (`EXPANSION_ASSETS.crab`, `core/motion` `waddle` along the waterline, `scaledCount(3, decor)`, 0 on "low").
- Band acceptance: 31 % of first attempts pass (the sight rule took it from 37 %; 400 picks per treasure); just over the 30 % floor, so a new prop rule moves the band.
- The ring is drawn with `depthWrite: false` 4 cm over the higher side of the slope (or the water): no z-fighting seen in any shot.
- Gait: at top speed the full run's stride (1.26 m) keeps the cadence under 4 (`poses.test.ts`), so the planted foot does not slide.
- The walking explorer can still pass behind a crown or the canopy for a moment (only the treasures are kept in sight).
- P-06 timing (audio above).

## Status

```text
HANDOFF P-15
Branch / last commit: claude/game-treasure-island (see git log; not pushed)
Files changed (git diff --name-only main...HEAD): games/treasure-island/** (+ tests), public/images/3d/treasure-island.webp, tools/thumbs/inputs/treasure-island.mjs, play50games-backend/.../arcade-games.json (treasure-island entry only)
Checks: npm run build pass (plain + flagged) | npx tsc --noEmit pass | npx vitest run all pass | node tools/gamecheck: tool not merged yet (P-07); tools/perf likewise, the ?perf=1 probe used instead
Built: rules (seeded island, explorer, detector, dig, tide, hint, score) + proof; Scene (closer follow camera, rigged explorer with hat and dig pose, detector shader ring, reveals, gull + marker, crabs); 4 test files on the real meshes.
Scoring formula: 200 a find + 50 clean + 10/s left on a win; limits 2060, 8.5-92 s, 1250 + 100/s.
Decisions I took and why: pitch 50 (explorer 15 % taller), one yaw (sight rule), umbrella 2.8 m and crab 0.5 m, gull on the camera's line of sight, RUN_AMOUNT 1 (no foot slide), no marker for the detector's target (it would play the game).
Open questions: thumbnail stays null in meta until registry.test.ts (core) stops requiring null for dev games.
Known issues / follow-ups: audio TODO(P-06); 844 x 390 explorer 28 px; rules.test.ts 727 lines.
Evidence: %USERPROFILE%/.play50/treasure-island/*.png and *-report.json
```
