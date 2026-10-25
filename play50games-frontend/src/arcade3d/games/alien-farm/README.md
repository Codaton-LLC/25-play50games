# Alien Farm

Owner: Claude (P-18 build, taken over from Antigravity; design P-14 by Codex). Slug: `alien-farm`. Adventure game 10, complexity 3. Spec: `03-game-specs-adventure.md` §10; assets: `05-hyper3d-catalog.md` §E.4. Units: metres, seconds, radians; x east, z south, y up. Every gameplay number lives in pure `rules.ts`.

## Concept

A mint alien tends nine moonlit plots, reads their rising pulse, plucks at peak glow and carries up to four crops to a moving saucer whose beam pays 25 x n² per load. A pure 100 s score attack (Decision A): no win/lose, the shell's timer ends the run with `"timeup"` and the finish cue. Purple dusk palette (one `COLORS` object in `looks.ts`): soil `#3b0764`, mint `#4ade80`, cyan `#22d3ee`, rocks `#7c3aed`, gold perfect, coral miss.

## Controls

`meta.ts`: `scheme: "joystick"`, keyboard "WASD / arrows to move; press E, Enter or Space to harvest at peak glow; enter the beam to deliver", touch "Joystick to move; tap Pick at peak glow; enter the beam to deliver". `index.tsx`: `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Pick" }` ("Harvest" wrapped to two lines in the round button).

- `moveX/moveY` → `inputToWorld(…, view.yaw)` (one yaw, 0), magnitude clamped to 1. A press is `actionPressed || jumpPressed`, read once at the start of the played frame: simultaneous keys are one attempt, held keys never repeat. No canvas tap, drag or swipe action.
- The same timing windows for touch and keyboard (standing decision 7): the design's coarse-pointer perfect widening (0.35 s) is **dropped**; perfect is ±0.25 s for everyone.

## Rules (as built)

Groups: `FARM`, `FARMER`, `PLOTS`, `OFFSET_TABLES`, `CYCLE`, `HARVEST`, `SHIP`, `SPORES`, `SCORE`. No Rapier, no wall clock, no mesh collision.

- **Farm:** farmer centre clamped to x ±10.1, z ±8.1 (walkable 10.5/8.5 minus radius 0.4). Start (0, 6), facing north. Plots row-major at x −5/0/5, z −4/0/4; beds 1.6 x 1.6 are walkable (the drawing lifts the farmer 0.10 m onto the soil). Six rocks at (±12, −7/0/7), three crates at x ≈ −11, z ≈ 8–9, all outside the walkable area.
- **Movement:** accelerate 24 m/s², brake 30, turn 14 rad/s. Top speed 4.5 (1 − 0.08 n) for n = 0..4 crops (4.5/4.14/3.78/3.42/3.06), x0.6 inside spores (zones are 4 m apart: never two at once). The velocity is capped at once when the limit drops; the displacement of every step is capped to top speed x dt (the limit proof uses it).
- **Activation and crops:** ids 0, 2, 4, 6, 8 from 0 s, 1 and 7 from 20 s (glowPods, C = 6 s), 3 and 5 from 40 s (gourds, C = 8 s). A locked bed shows a dim seed mound.
- **Seed:** `createRng(seed)` draws the offset table `floor(16 rng())`, then the route direction, then s0 = 64 rng(). Table t holds nine ticks `T[t][i] = (t + 5i + 3 floor(i/3)) mod 16` (frozen literals), delta = T/8 s; cycle k of plot i starts at `b = activateAt + delta + kC`.
- **Growth:** peak p = b + C/2; half window w = 0.90 (p < 40), 0.75 (p < 70), else 0.60. Sprout [b, b + 0.2C), growing, ripe [p − w, p + w] (endpoints ripe), overripe until the burst at b + 0.85C, spent until the next cycle. Perfect = |press − p| ≤ 0.25.
- **Press (Decision B):** a press that starts a harvest never cools the tool. Every other press sets the cooldown to press + 0.60, including a press while cooling (repeated taps keep it cooling). Target = the nearest plot within 0.90 m (centre distance, inclusive; ties lower id) whose current cycle is not picked, missed or burst. Pressing in sprout, growing or overripe **bursts that crop at once** (`missed`, the stage turns spent, its spore zone lands now around the farmer, streak reset, coral "burst! too early / too late" with a puff, a thud and a small shake) and **dazes the farmer for `HARVEST.burstStunS` = 2 s** (planted, no movement, a dizzy sway of chest and head). That cycle never bursts again. A burst crop is no target. This is the anti-spam rule (2026-10-24 fix): a blind press costs the crop and 2 s, so pressing without reading the pulse scores far below an honest player; the timing windows stay the same for touch and keyboard. A full basket, nothing in reach or a waiting bed only cools (a full basket never harms a crop). A press during the 0.30 s pick is ignored.
- **Pick:** the farmer stops, faces the crop and stays planted 0.30 s; the crop (and its perfect flag) is reserved, so it cannot burst. At completion it joins the basket and pays 50 (100 perfect). A pick still running at time-up is not paid.
- **Saucer:** closed polyline (−9,−7) → (9,−7) → (9,7) → (−9,7), 64 m, speed 2 / 2.5 / 3 m/s before 40 / 70 / after; its position is the exact integral (`shipDistance`), independent of frame splits. Beam: farmer centre within 2 m (inclusive) of the ship's XZ unloads **all** crops at once for 25 n², each crop once. Every bed centre is ≥ 3 m from the route, so a harvester in reach (≤ 0.9) is never in the beam.
- **Spores:** every ignored cycle bursts once at b + 0.85C (a mistimed press bursts it earlier, at the press) into a 2 m zone for 5 s; it slows, never blocks.
- **Order per frame:** the press at the frame's start, then equal steps ≤ 1/120 s: pick completion (the planted farmer moves only for the rest of that step), movement, ship, bursts, beam loading. `feedStore` pushes points live (`addScore`) and the HUD stats (Delivered, Basket n/4, Perfect).
- **Shipment banner:** the delivery that reaches 16 crops shows "Shipment of 16!" with confetti. No points, never a "lose".

## Scoring

`runScore = 50 harvested + 50 perfect + 25 Σ(load size²)`. Points arrive live: 50/100 at each pick, 25 n² at each unload. No streak, time or end bonus, no deductions, no `finalScore`. The store score equals `run.score` on every bot run (tested).

### Server limits and why they hold (the proof)

`PROPOSED_LIMITS` in `rules.ts`: **maxScore 12900, minDurationMs 99000, maxDurationMs 102000, base 200, maxPointsPerSec 250**, copied into `meta.scoring` and `arcade-games.json` (2026-10-24, re-verified after the burst rule: a burst and the daze only remove picks or add time, so the relaxation below still bounds every run; the bots below re-ran through the real rules).

1. **Per-crop ceiling.** A crop pays ≤ 100 at its pick and its load pays 25 n² = 25 n per crop ≤ 100 (n ≤ 4). So score ≤ Σ(150 + 50 [perfect]) over the picks.
2. **Relaxation (`bound.ts`).** Nodes = (plot, cycle) ripe windows inside the run (a pick must complete by 100 s). From a press at t on plot i the next press on j is ≥ max(open_j, t + 0.30 + max(0, d(i,j) − 1.8)/4.5) (planted 0.30 s, then from within 0.90 m of i to within 0.90 m of j at ≤ 4.5 m/s); the first press ≥ max(open_j, max(0, d(start, j) − 0.9)/4.5). Relaxed away (each can only add time): acceleration, carry and spore slowdowns, the 2 s burst daze, deliveries and the ship, frame quantisation. Exact for the relaxation and independent of s0 and direction.
3. **Exhaustive label search** (earliest time per (last node, previous node) state, Pareto on score; the previous node is kept only while it could be reached again inside its window: a → b → a needs two gaps ≥ 71/90 s, possible only in a 1.8 s window; three gaps never fit). Outward-safe: every gap is rounded down by 1e-9 and windows widened by 1e-9. Cross-checked by brute force over all chains on 16 s horizons (4 tables, both weightings).
4. **Certificate:** per table S = 12250, 12100, 11950, 11950, 12050, 12050, 11700, 12050, 12050, 12400, 12400, 10800, 11350, 11350, 11800, 11800, so **S\* = 12400** (the harvest count alone: H\* = 71, which 200 H\* = 14200 would over-cover). maxScore = 100 ceil(1.04 S\* / 100) = 12900 (4.0 % margin).
5. **Rate:** first pick completes ≥ 2.40 s (earliest window opens at 2.1); different-plot presses ≥ 71/90 s apart (closest beds 4 m); same plot ≥ 4.2 s. Every prefix with H picks scores ≤ 200 H ≤ 200 + 250 (2.40 + (H − 1) 71/90) for H = 1..124 (smallest margin 258.33); 125 picks need more than 100 s. The run lasts exactly 100000 ms of play (shell timer), inside 99000..102000.
6. **Tightness (Decision D, a documented looser limit):** the best legal oracle reaches **7275 = 56.4 %** of maxScore, below the 90 % gate. Reason: the relaxation pays every crop as a delivered full load but charges nothing for the beam trips; the real ship (2–3 m/s on a 64 m loop) costs about 2–4 s per load and the clustered offset tables (all nine deltas within 1.9 s) leave a dead stretch in every cycle. A delivery-aware certificate needs an enclosure of the ship's position over continuous s0 and both directions; not attempted. Open question 2.

## Run end

The shell's 100 s timer ends the run (`"timeup"`); core `endCue` plays the finish ("win") cue when the score is above 0. `resultDelayMs: 1600`: the farmer turns to the camera and cheers with confetti (score > 0) or slumps (0). The shell's Time chip is the clock (`clockChip` default). Nothing scores during the delay.

## Scene and camera

- Full follow, one yaw: `useFittedView(VIEW)` with `area` x/z ±3, y 0..1.6, pitch 50°, fov 45, margins 0.02, padding 8, `shift: true`; `<CameraRig follow={run.farmer} followFraction={1} damping={5} offset shift>` (a live target). Decision C: in portrait, neighbour beds 5 m away in x can sit off screen; core `TargetMarkers` arrows (beam when carrying, the next ripe/opening crop when the basket has room, gold while ripe) and the hum lead to them. They never steer or press.
- Overlays: bed soil top 0.10, channels 0.02, beam ring 0.04, cooldown ring 0.05, pulse rings 0.12, spore discs 0.14; additive overlays never write depth. Crops stand on the soil; score labels float at 1.5 m (crops ≤ 1.1) and 1.75 m (farmer 1.3).
- Pulse language: the outer ring dims by stage (coral when locked), an inner disc fills towards the peak (`ringFill`), and both turn gold inside the perfect band; ripe crops pulse in brightness and bob (steady in reduced motion). The cooldown is a coral ring at the farmer's feet that shrinks as it ends.
- Environment: `lighting: "sunset"` (2026-10-24 playtest: "night" read near-black on desktop), background `#120a2e`, fog 28–75 m, core `SkyDome` (purple dusk) and `Starfield` (600, scaled by quality), a moon at (−20, 18, −35), a crater rim lathe at r 15.5–20.5. No extra lights, shadows or bloom.

## Assets

Existing GLBs only, no Hyper3D credits. Fits from measured bounds, checked on the real meshes (`assets.test.ts`):

| asset | source | fit | stand-in |
|---|---|---|---|
| farmer | `EXPANSION_CHARACTERS.alien` | 1.3 m / 1.8902 (`ALIEN_LANDMARKS` kept) | `AlienPrimitive`: capsule body, big head, glowing antennae |
| glowPod / gourd | `EXPANSION_ASSETS` | 1.0 m tall, uniform (0.67 / 0.95 m wide), mint / cyan looks | lathe bulb / gourd + three leaves (pool parts) |
| saucer | `/models/3d/alien-farm/ufo.glb` (1.890 x 1.049 x 1.898, floor pivot) | 2.8 m across, underside at 3.2 m, slow spin and bob | `SaucerPrimitive`: lathe hull, glass dome |
| rocks / crates | shared `rock`, `crate` | 1.2 m (purple look) / 0.8 m | instanced dodecahedra / rounded boxes |

- Changed from design: crops are scaled **uniformly** (no squash: the GLB proportions stay) and grow from 0.5 to 1.0 m tall with the width at max(0.75, height). The crop pools are `<DynamicInstancedModel tinted>` with 13 slots (nine beds + four basket miniatures 0.22 m, gold when perfect).
- The farmer: `<HumanoidModel>` + `useHumanoidPose`: `alienWalkPose` by distance (`alienPhaseStep` = `gaitPhaseStep`, cadence cap 4/s), `bodyLift` on its group, the basket on the left arm (`applyLeftBasketCarry`), the pick in `poses.ts` `harvestPose` (hip/spine/chest lean with the thighs counter-rotated, two-bone arm aim to the crop's near rim, head rigid), `cheerPose` after time-up. `poses.test.ts` on the real mesh: 1.30 m, soles ≤ 1 cm through walk and pick, the hand ≤ 5 cm from both crops at 0.45–0.90 m and all heights, no T-pose swing, the head rigid.

## Files

`meta.ts` · `index.tsx` · `rules.ts` (pure) · `bound.ts` (the certified search, tests only) · `bots.ts` + `planner.ts` (bots, tests only) · `rules.test.ts` · `looks.ts` (palette, camera window, pure drawing math) · `assets.ts` + `assets.test.ts` · `poses.ts` + `poses.test.ts` · `Scene.tsx` · `Farm.tsx` · `Crops.tsx` · `Saucer.tsx` · `Farmer.tsx` · `Primitives.tsx` · `assets.spec.json` · `tools/thumbs/inputs/alien-farm.mjs`.

## Tests (as built)

`rules.test.ts`: pinned constants and tables; 1000 seeds (every table and both routes drawn, determinism); route length 64 and the 3 m bed clearance; exact ship integral and wraps; stage boundaries; bursts once (long frames too); press fixtures (waiting, out of reach 0.91 vs 0.90, early/late lock, locked crop, cooldown 0.599/0.600, correct press never cools, perfect ±0.25 vs ±0.2501, pick at 0.30 s, full basket, tap during a pick); 20,000 random movement steps (displacement ≤ top x dt, bounds); spore speed; beam 2 vs 2.001, 25 n² once, empty beam; shipment banner; live store feed; brute-force cross-check, the certificate, the rate inequality. Bots through the real store (`simulateRun`, `advanceRunClock` + `playedFrameDt`), one seed per (table, direction) pair = 32 seeds, frame schedules cycling 30 / 60 / 144 Hz and random 4–50 ms; every run: store score = rules score, 100000 ms, every prefix ≤ min(maxScore, 200 + 250 t), `withinServerLimits`, `capScore` a no-op. Reduced from the design's 256 seeds x 2 modes x 3 rates (13,824 runs) to keep the suite near 25 s; disclosed here.

| bot | runs | score | gate |
|---|---|---|---|
| oracle (`planner.ts`: plans each basket by search on the real schedule and route) | 32 | 5450–7275 | ≥ 45 % of maxScore (D) |
| human-paced (arrow only, 0.20 s re-aim, press −0.16..+0.23 s off the peak, 0.35 s pause) | 32 | 2400–4300 | ≥ 2000, below the oracle |
| slower human (0.25 s, −0.20..+0.29 s, 0.45 s) | 16 | 2275–3875 | ≥ 1500 |
| idle / hold Harvest | 16 / 16 | 0 / 0 | 0 |
| camp one plot, perfect presses | 16 | 400 | ≤ 400 (basket full, never delivers) |
| spin by a bed, random presses | 16 | ≤ 400 | ≤ 400 |
| 5 Hz orbit spam | 16 | 0 | ≤ 125 |
| 0.61 s metronome | 32 | 50–1500 (mean 703) | max < human min; mean < 0.3 x human mean |
| arrive and press once, pulse-blind | 32 | 150–2100 (mean 1286) | max < human min; mean < 0.45 x human mean (3391); max < 0.35 x oracle |

## Look (2026-10-24, revised P-90)

Modern-look pass (Task P-86 & P-90): polished whimsical alien farm aesthetic, visual-only.
- **Lighting & Atmosphere:** core `"sunset"` lighting preset configured via GameDefinition environment in `index.tsx`, linear purple dusk fog (`FOG.near = 32`, `FOG.far = 85`), gradient `SkyDome` (`#09041e` overhead to `#5b21b6` at sunset horizon), and `Starfield` (700 stars).
- **Two Celestial Moons:** large cratered lavender primary moon and glowing cyan/teal minor moon positioned in the upper camera sky view (`Moons` following camera orientation), both `fog={false}`.
- **Plum Ground & Beds with Dark Teal Furrows:** wide soil plane in rich alien plum (`COLORS.soil` `#3b0764`), purple planter frames (`COLORS.bed` `#4c1d95`), plum bed soil base (`COLORS.bedSoil` `#2e1065`), and 3 parallel dark teal furrow ridges (`COLORS.furrowRidge` `#0e4b56`) for high contrast against green mint crops (`#4ade80`), linked by glowing cyan irrigation channels (`COLORS.channel` `#22d3ee`).
- **Surroundings & Decor in Camera Window (`Decor.tsx`):**
  - Strange rock spires: tapering hexagonal crystal/rock columns with faceted crystal tips (`COLORS.spire` `#581c87` / `COLORS.spireTip` `#c084fc`), instanced along north perimeter and flank pathways.
  - Glowing alien plants: curved stalks with bioluminescent bulbous caps (`COLORS.plantCap` `#2dd4bf` / `plantGlow` `#a7f3d0`), instanced along pathways and bed borders.
  - Silo: futuristic storage silo with rounded dome cap, hopper ring and glowing conduit pipe (`COLORS.siloBody` `#cbd5e1` / `siloGlow` `#38bdf8`) northwest of Bed 0 (`[-6.5, 0, -5.4]`) in full camera view.
  - Distant hills: procedurally triangulated low-poly rolling ridge mesh outside the farm (`hillMesh()`), rising to the north and distant flanks, and flat in the south foreground (`z >= 7.0`) to avoid any rim band under the joystick.
  - Camera window framing: all decor instances fall inside the camera-visible farm area (`[-7, 7] x [-5.8, 5.8]`), clear of the crop beds, and never occlude plot targets at 1280x800, 390x844, and 844x390 (`looks.test.ts`).
  - Seamless ground: wide plum soil plane extends to radius 90, guaranteeing no sky/void shows below the scene.
- **Code-made stand-ins:**
  - Alien farmer: bevelled boots with sole trim (`RoundedBoxGeometry`), blue overalls with bib and strap buttons, cream shirt collar and cuffs, large glossy eyes, and cute glowing mint antennae.
  - Woven basket: dual-tone with darker rim trim (`COLORS.basketDark`).
  - Saucer: multi-tone lathe hull with dark undercarriage rim, glowing beam emitter, and glowing canopy dome.
  - Crops: fluted glowing bulbs and spiral gourds over styled leaves with dark undersides.
  - Rocks & crates: faceted alien crystal clusters (flat-shaded low-poly) and reinforced banded crates.
- **Juicy feedback:** 26-particle glow sparkle burst on perfect pick with rising chime, gold score popups, camera shake only on streaks of 3 or more; existing burst puffs/thuds and delivery bursts preserved.
- **Draw-call budget estimate (<= 60):**
  - Farm & sky: 8 (SkyDome 1, Starfield 1, primary moon 1, minor moon 1, soil plane 1, distant hills 1, bed frames 1, bed soil & furrows 2, channels 1)
  - Decor: 5 (rock spires 1, plant stalks 1, plant caps 1, silo structure 1, silo conduit 1; rocks & crates via InstancedModel 2)
  - Crops: 7 (glowPod pool 2, gourd pool 2, timing rings 1, timing fills 1, seed mounds 1, spore discs 1, cooldown ring 1)
  - Saucer: 3 (model 1, beam cone 1, beam ring 1)
  - Farmer: 3 (alien humanoid model 1, basket 1, shadow 1)
  - Target markers: 0 (pure DOM)
  - Active FX & score popups: ~4-6 when active
  - Total estimated draw calls: ~32-36 (comfortably below the 60 budget limit). All geometries and materials created once and disposed on unmount; no `dispose={null}` on primitives.

## Performance

Target ≤ 45 draw calls. Estimate: farm 10 (sky, stars, moon, ground, rim, bed bodies, bed soil, channels, rocks, crates), crops 7 (two pools, rings, fills, seeds, spores, cooldown), saucer 3 (GLB, beam, ring), farmer 3 (skinned GLB, shadow, basket), fx ≤ 7 (sparkle, puff, confetti, ≤ 4 score sprites): about 30, peak ≈ 33. No extra lights; pools fixed; no allocation, `setState` or `Color.set` in frame callbacks (one cached `Color` set per pool); geometry built once per mount and disposed. Not measured in a browser yet.

## Audio

`startLoop("ambient", 0.08)` and one `"hum"` loop on the nearest sprouting/growing/ripe crop within 6 m (the crop in reach is always the nearest): pitch 0.6 + 1.2 q, volume 0.18 (1 − d/6) from p − 1.5 to p + w, pan by dx/d; a `chime` at the peak. Both restart on [phase, muted]. Pick `pop` (pitch 1 / 1.5) + `pickup`, perfect `chime` rising with the streak, delivery `whoosh` + `combo` (pitch 1 + 0.1 (n − 1)), miss `hit` 0.15, refused press `click` 0.12, burst `thud` 0.15. Changed from design: one hum handle instead of three (simpler and never more than two loops).

## Accessibility

Ripe = full ring + bright pulse, perfect = gold ring and disc, locked = coral ring, overripe = olive crop; glowPods and gourds differ in silhouette and colour. Reduced motion: no ring pulse, crop bob, saucer bob/bank or shake; rings stay steady. HUD text comes from the shell chips.

## Decisions (user, 2026-10-24)

- A: a pure time-up score attack; deliveries keep paying and 16 shows a bonus banner, never a "lose". The timeup end plays the finish cue (core `endCue`).
- B: keep the missed-cycle lock; the 0.60 s cooldown applies only to presses that do not start a harvest.
- C: the 6 x 6 portrait window with arrows and the hum to off-screen plots.
- D: a documented looser limit where the proof or the oracle cannot reach 90 % (section 6 above).
- Modern look: the ufo GLB for the saucer; purple dusk sky, emissive pulsing glowPods, soft beam cone.

## Status

The HANDOFF (`.handoff/P-18-alien-farm/HANDOFF.md`):

TASK P-18-alien-farm | build alien-farm | branch claude/game-alien-farm | allowed: play50games-frontend/src/arcade3d/games/alien-farm/**, play50games-frontend/public/images/3d/alien-farm.webp, tools/thumbs/inputs/alien-farm.mjs

**Result:** playable end to end (ready → countdown → 100 s play → timeup → cheer → result) on GLBs or primitives; status `dev`; Claude takeover of Antigravity's WIP (rules.ts rewritten: the WIP did not compile and its tests crashed; assets.ts / tests fixed; poses.ts kept, its real-mesh tests pass). `npx tsc --noEmit` clean; `npx vitest run src/arcade3d/games/alien-farm`: 3 files, 33 tests (no `it.fails`), ~25 s. Not run here (instructions): `npm run build`, a server, a browser, the perf probe, screenshots, the thumbnail.

**Files** (game folder): new `Scene.tsx`, `Farm.tsx`, `Crops.tsx`, `Saucer.tsx`, `Farmer.tsx`, `Primitives.tsx`, `looks.ts`, `bound.ts`, `bots.ts`, `planner.ts`; rewritten `rules.ts`, `rules.test.ts`, `index.tsx`, `assets.ts`, `README.md`; fixed `assets.test.ts`, `poses.test.ts`, `assets.spec.json` (note only); kept `poses.ts`, `meta.ts` (scoring untouched). Plus `tools/thumbs/inputs/alien-farm.mjs`. Thumbnail left null.

**Acceptance checklist**
- [x] GameDefinition: Scene, assets, `durationMs` 100000 (shell timer, Decision A), camera, environment (night, fog, dusk SkyDome), joystick + Harvest, hudStats (Delivered, Basket /4, Perfect), 3 instruction lines, `resultDelayMs` 1600; clock = the shell's Time chip.
- [x] rules.ts pure and seeded (createRng), no three/React/DOM/Math.random/Date.now; core substep, clampToBounds, turnTowards, createPath/pointAt/tangentAt, limits.
- [x] One useRunFrame → stepRun → feedStore (addScore live, setStat) → fx/sfx; visuals read state in useFrame with useGameTime; pools, no JSX map over run state, no per-frame allocation, no Color.set per frame.
- [x] Input: actionPressed || jumpPressed once per frame; inputToWorld(view.yaw).
- [x] Camera: useFittedView (6 x 6 m window, pitch 50, shift) + CameraRig following the live `run.farmer`; TargetMarkers arrows to the beam and the next crop.
- [x] Models: alien via HumanoidModel + useHumanoidPose + gaitPhaseStep + bodyLift; glowPod/gourd DynamicInstancedModel tinted pools; ufo.glb via Model; rock/crate InstancedModel; fallbacks for all; size tests on real meshes (ufo measured 1.890 x 1.049 x 1.898).
- [x] fx bursts, floating scores, shake; playSfx; ambient + hum loops restarted on [phase, muted].
- [x] Limits proof + bots through the real store; PROPOSED_LIMITS in rules.ts; meta.scoring unchanged.
- [ ] Browser: screenshots 1280 x 800 / 390 x 844 (banner) / 844 x 390, safe-area fit, perf probe, Retry x10, keyboard + touch playtest (Claude).

**Scoring:** 50 per pick, 100 perfect (|press − peak| ≤ 0.25 s), 25 n² per beam unload (n ≤ 4). Live points, no end bonus.

**Proposed limits:** maxScore 12900, minDurationMs 99000, maxDurationMs 102000, base 200, maxPointsPerSec 250. Proof: every crop ≤ 150 + 50 perfect (a 25 n² load is ≤ 100 per crop); an exhaustive label search (`bound.ts`, brute-force cross-checked) over all 16 offset tables, relaxing acceleration, carry/spore slowdown, deliveries and the ship (so it holds for every s0 and direction), certifies S\* = 12400 (H\* = 71 picks); maxScore = 100 ceil(1.04 S\*/100). Rate: 200 H ≤ 200 + 250 (2.40 + (H − 1) 71/90) for H ≤ 124 (margin 258.3); a run is exactly 100000 ms.

**Bot results** (32 seeds = every table x both routes, frames cycling 30/60/144 Hz + random; every run: store = rules score, within limits, prefix ≤ min(maxScore, 200 + 250 t), `withinServerLimits`, `capScore` a no-op): oracle 5450–7275 (best 56.4 % of maxScore); human-paced 2575–4375; slower human 2500–3875; idle 0; hold 0; camp ≤ 400; spin ≤ 400; 5 Hz spam 0; 0.61 s metronome 800–2200; arrive-and-press 1950–3400.

**Draw calls (estimate):** about 30, peak ≈ 33 (target 45, cap 150). No extra lights.

**Open questions**
1. **Resolved (2026-10-24):** a mistimed press now bursts the crop at once and dazes the farmer 2 s. Pulse-blind bots: arrive-and-press 150–2100 (mean 1286), metronome 50–1500, both below every honest human-paced run (2400–4300, mean 3391). The design's absolute "< 1600" gate is replaced by these relative gates (an unlucky honest run and a lucky blind run no longer overlap). Tried and dropped: the daze alone at 0.8–1.6 s (still overlapped), ruining the next cycle too (no gain).
2. **Tightness (Decision D):** the oracle reaches 56 % of maxScore. A delivery-aware certificate (ship-position enclosure over continuous s0) could tighten it; not attempted.
3. **Done:** PROPOSED_LIMITS copied into meta.scoring and arcade-games.json (still `enabled: false`, status `dev`). The production JSON is uploaded by the user, never by an agent.
4. Coarse-pointer perfect widening (0.35 s) dropped per standing decision 7 (same windows for touch and keyboard).
5. Crops scaled uniformly (glowPod 0.67 m wide, gourd 0.95 m) instead of the design's 1.1 m squash; growth 0.5 → 1.0 tall, width ≥ 0.75 of it.
6. One hum loop (nearest crop) instead of three.
7. Bot coverage 32 seeds per bot instead of 256 x 2 modes x 3 rates, to keep the suite near 25 s.
8. **Done (playtest 2026-10-24):** "night" read near-black, now "sunset". The ufo GLB is fully metallic (no environment map in the arcade) and rendered as a black disc: it now draws with one material override (silver-lavender, metalness 0.3), losing its texture; a re-export with metallicFactor ≈ 0.3 would keep the texture. Waiting beds had a grey ring that read as coral on the plum soil; it now takes the crop's colour, so coral means only a burst.
9. Core needs: none.
