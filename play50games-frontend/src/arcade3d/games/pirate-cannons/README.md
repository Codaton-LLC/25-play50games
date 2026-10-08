# Pirate Cannon Battle

Owner: Claude. Slug: `pirate-cannons`. Skill game 13 (order 23), complexity 3, wave 1, the **reference of the aim-and-release family**: mini-golf reuses its aim drag, snowball-battle and castle-defender reuse its lob aim and ballistics (section "Aim-drag tuning"). Spec: `docs/arcade-expansion/04-game-specs-skill.md` §13. Gate G0 (design); the build fills `Status`. Units: metres, seconds, degrees in the text (radians in code); x right, z towards the camera (the sea is −z), y up; the water is y 0. Every "Changed from spec" line says what and why.

## Concept

A stone fort on a sunny cove. You man its cartoon bronze cannon and sink pirate ships crossing the bay on three lanes before they slip into the harbour on the right. Fixed muzzle speed, so distance is elevation; the wind changes every wave and the arc preview shows only the start of the flight, so long shots are read, not computed. Floating powder barrels blow up ships around them. Accent `#f87171`.

## Controls

`meta.ts`: `scheme: "aim-drag"`, definition `input: { drag: true }`, `touchControls: []` (canvas gesture only).

- `keyboard`: "Drag to aim, release to fire, click to fire again; or arrows + Space". Changed from the stub ("…or arrows + Space"): it names the tap re-fire.
- `touch`: "Drag to aim, release to fire, tap to fire again". Changed from the stub for the same reason.
- `instructions`: "Drag sideways to turn, pull down to shoot farther." · "Release to fire. Tap fires the same aim again." · "Read the wind arrow. Hit a powder barrel to blast ships near it."
- Input fields: `drag` (`active`, `start`, `current`, `released`, `cancelled`), `tap` (fire), `moveX` / `moveY` + `pressed.{left,right,up,down}` (keyboard aim), `jumpPressed` (Space fires). Esc / P pause (shell). `drag.power` / `drag.angle` are not used (see below).

### Aim-drag tuning (the family reference)

The **lob aim** (`aim.ts`, pure): `aim = { yaw, elevation }`, yaw 0 = straight out to sea (−z), + = right; limits yaw ±45°, elevation 0–35°. It persists between shots (the cannon stays where you left it).

- **Relative drag:** on the drag's first `active` frame the aim is stored (`aim0`). While active, with the canvas size `w × h` from `useThree`: `dxPx = (current.x − start.x) · w / 2`, `dyPx = (current.y − start.y) · h / 2` (y up), `yaw = clamp(aim0.yaw + 0.25° · dxPx)`, `elevation = clamp(aim0.elevation − 0.15° · dyPx)`. So the barrel follows the finger sideways and **pulling down shoots farther**. In `AIM_DRAG_FULL_PX` (160 px) units: 40° of yaw, 24° of elevation. At the 55 m lane 1 px is ≈ 0.24 m sideways and ≈ 0.29 m in range.
- **Fire:** `drag.released && !drag.cancelled` fires the released aim; a drag under `AIM_DRAG_MIN_PX` (16 px, `cancelled`) only adjusts; a `tap` fires the current aim (a short press gives `tap` and `cancelled` on the same frame: act on the tap). A fire during the reload is **buffered** (one) and goes off when the reload ends, with the aim at that moment.
- **Keyboard:** `stepKeyboardAim(k, input, dt, { turnRate: 0.45, powerRate: 0.35, minAngle: π/2 − 45°, maxAngle: π/2 + 45°, minPower: 0 })` with `k.angle = π/2 − yaw`, `k.power = elevation / 35°` (≈ 26°/s of yaw, 12°/s of elevation while held). Each fresh `pressed` arrow nudges exactly 0.5°; holding sweeps only after 0.25 s; keyboard values snap to the 0.5° grid (spec §14). Space (`jumpPressed`) fires like a release.
- **Preview:** `<TrajectoryDots count={9} step={0.1} fraction={1} radius={0.12} opacity={0.9} endOpacity={0.15} endScale={0.5}>` = the first **0.8 s** of the flight with the current wind, plus a landing ring on the water under the 0.8 s point.
- **Why not core's `power` / `angle`:** a polar slingshot needs a 7 px pull for the 25 m lane (under the 16 px cancel) and makes yaw twitchy on short pulls; separable relative axes match the spec ("horizontal = yaw, vertical = elevation") and allow shot-to-shot corrections, the game's core skill. Mini-golf keeps core's polar `power` / `angle` (a putt is direction + power) with the same 160 / 16 px constants.
- `aim.ts` is the family's lob aim; it moves to `core/aim.ts` (Claude) before the second lob game (castle-defender or snowball-battle) starts, so no game imports from another.

## Rules

All numbers live in `rules.ts` (`WORLD`, `CANNON`, `SHIPS`, `WAVES`, `BARREL`, `CHEST`, `ISLAND`) and `aim.ts` (`AIM`), proven in `rules.test.ts`.

- **Fixed tick:** `advanceRun(run, dt, aim, fire)` runs whole ticks of **1/120 s** from an accumulator (the leftover carries), so outcomes do not depend on the frame rate. A shot fired in a frame starts on the next tick.
- **Cannon** (`CANNON`): on the fort platform (top y 2.2) at x 0, z 0; the pivot is the axle (y 2.55); the muzzle = pivot + the measured arm (`EXPANSION_GLB_POINTS.cannonMuzzle` through `expansionPoint`, minus the axle) turned by (yaw, elevation − the GLB's own barrel angle); muzzle ≈ y 3.0. Reload **1.2 s** from each shot.
- **Ballistics** (`WORLD`): muzzle speed **28 m/s** along the aim, gravity **9.8**, wind a constant horizontal acceleration, no drag (`BallisticParams`). The ball's position is the closed form `trajectoryPoints(shot, WORLD, 2, t, scratch)` at t = ticks / 120 (core's exact samples, stopped at the water), never Euler. Ball radius 0.25. No wind, elevation ≈ 1.5° reaches the 25 m lane (0.95 s), ≈ 10° the 40 m lane (1.4 s), ≈ 18° the 55 m lane (2.1 s); 35° reaches ≈ 79 m, ≈ 61 m into a 3 m/s² headwind.
- **Wind** (`WAVES`): per wave, seeded: direction uniform 0–360°, strength uniform in [0.5, 1] × max, max **1.0 / 1.5 / 2.0 / 2.5 / 3.0** m/s² for waves 1–5 (spec ±3). It changes on the wave tick; at 3 m/s² a 2.1 s flight drifts ≈ 6.6 m.
- **Lanes** (`core/path`, `createPath` + `advance`): straight crossings at z −25 / −40 / −55 from the spawn x −30 to the **harbour buoy line x +18** (48 m). Galleons zig-zag ±3 m in z (period 16 m, `smooth`), sloops ±1.5 m from wave 4; heading from `tangentAt`.
- **Ships** (`SHIPS`; HP, speed, hit spheres along the heading at local offsets, centres above the water):

| type | length | HP | speed | spheres (offset, radius, centre y) | points |
|---|---|---|---|---|---|
| dinghy | 3 m (×0.5) | 1 | 4.0 | ±0.7, r 0.7, y 0.35 | 100 |
| sloop | 6 m | 2 | 2.8 | −1.9 / 0 / +1.9, r 1.15, y 0.55 | 200 |
| galleon | 9 m (×1.5) | 3 | 2.0 | −2.85 / 0 / +2.85, r 1.7, y 0.8 | 300 |

- Same-lane gap: a ship closer than 4 m (stern to bow) to the ship ahead matches its speed. At most **8 ships** alive; a spawn waits for a free slot (both only make arrivals later).
- **Waves** (`WAVES`, starting at 0 / 20 / 40 / 60 / 80 s, speed ×1.0 / 1.1 / 1.2 / 1.3 / 1.4): fixed type and lane multisets, seeded order; ship i of n spawns at `wave start + i · span / n + jitter[0, 1.5 s]`, span 16 s (wave 5: 8 s).

| wave | ships | lanes | HP |
|---|---|---|---|
| 1 | sloop ×2, dinghy | 25, 25, 40 | 5 |
| 2 | sloop ×2, dinghy, galleon | 25, 40, 40, 55 | 8 |
| 3 | sloop ×2, dinghy ×2, galleon | 25, 40, 40, 55, 55 | 9 |
| 4 | galleon ×2, sloop ×2, dinghy ×2 | 25, 25, 40, 40, 55, 55 | 12 |
| 5 | galleon, sloop, dinghy ×2 | 25, 40, 55, 55 | 7 |

- **Hits:** each tick, ball sphere vs every live ship sphere (`spheresOverlap`), then barrels, chest and island; the first contact stops the ball. At 120 Hz the ball moves ≤ 0.24 m a tick, so a grazing pass can miss only within ≈ 7 mm of the edge (tested). A hit takes 1 HP; at 0 the ship sinks (no longer a target, never reaches the harbour). Water contact = splash, a miss.
- **Powder barrels** (`BARREL`, `REUSED_ASSETS.barrel`): one per wave, 2 s after its start, on a seeded lane at lane z + 3 (towards the cannon), from x −30 drifting +x at 0.6 m/s; hit sphere r 0.6, centre y 0.2. Hit → blast radius **6 m**: every ship with a sphere within 6 + r of the centre takes 1 HP; barrels within 6 m go off **0.15 s** later (chain). One shot damages a ship at most once, whatever the chain.
- **Chest** (`CHEST`, P2): once per run, at a seeded time 30–60 s, on lane 40 or 55, from x −30 at 1.6 m/s; sphere r 0.6, y 0.25; worth 300. It leaves at x +18 without a penalty.
- **Island** (`ISLAND`): centre (−7, −33), mound r 3.5 up to y 0.9, two palm trunks (cylinders r 0.3 to y 3.0) and crowns (spheres r 1.3 at y 3.2). A ball touching any of them is a miss (sand or leaf puff). Lanes clear it (25 + 3 < 29.5, 40 − 3 > 36.5).
- **Harbour:** a live ship whose centre crosses x +18 costs a life (`loseLife()`, `lives: 3`) and sails on, fading. Changed from spec: the harbour mouth is the buoy line on the right of every lane, so lanes stay straight and the field fits a phone.
- **Clock:** `durationMs: 90000` (fixed timer, the shell ends with `"timeup"`). Tick order: ships, balls and blasts, harbour, then the score.

## Scoring

Per shot: `shotPoints = mult · (100 · damaged + Σ_sunk laneBonus + chain + chest)`, with `damaged` = ships that lost 1 HP to this shot, `laneBonus` = **0 / 50 / 100** for lanes 25 / 40 / 55 (once, for the sinking shot), `chain = 100 · min(3, damaged − 1)` when the shot set off a barrel, `chest` = 300 when hit, `mult = 1.5` when this shot is the **3rd or later consecutive scoring shot** (one that damaged a ship or hit the chest; a miss resets), else 1. Every term is a multiple of 50, so `shotPoints` is an integer. Live: `addScore(shotPoints)` when the shot resolves (a blast chain resolves when its last barrel has gone off); popups "+100", "+150 ×1.5", "Chain +200". `finalScore` is not overridden.

- Changed from spec: 100 per hit (sums to the spec's 100 / 200 / 300 per ship) so the score moves on every hit; the range bonus is per lane (spec: +50 per 10 m beyond 30 m, which gives 0 / 50 / 100 at the lane distances) so it is readable, seed-independent and does not reward shooting ships at the far left edge (65 m); chain bonus capped at +300 per shot; "combo ×1.5 on 3 consecutive hits" defined as above.

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 9000 | **10500** |
| duration | 10000–92000 ms | **21000–92000 ms** |
| `base` / `max_pps` | 9000 / 9000 | **1500 / 110** |

The provisional 9000 is below what an excellent run can reach (every ship sunk mostly at ×1.5 is ≈ 8,500–9,500), so it must rise. Proof plan (robot-collector's structure, through the real store):

1. **Ceiling:** each ship is worth at most `1.5 · (100 · HP + laneBonus)`, each barrel at most `1.5 · 300` of chain (≤ 5), the chest `1.5 · 300`. Per wave 1275 / 1950 / 2250 / 2700 / 1875, chest 450: **10500**, independent of the seed (fixed multisets).
2. **Points by time t:** `C(t)` = that ceiling over the ships, barrels and chest spawned by t, worst order (most valuable first) and earliest spawns (jitter 0, no slot waits). It stays under `1500 + 110 · t` at every spawn time; the tightest step is 84 s (10350 vs 10740). At 90 s the line is 11400 ≥ 10500.
3. **Clock:** `useRunFrame`'s dt is the store's `frameMs`; the bot drives `createArcadeStore()` with `advanceRunClock` + `playedFrameDt` (frames 4–300 ms, pauses, countdown ending mid-frame); ticks never exceed `elapsedMs`.
4. **Earliest loss:** the third harbour crossing is at ≥ **22.67 s** (wave 1: sloops spawned at 0 and 5.33 s take 17.14 s, the dinghy spawned at 10.67 s takes 12 s; wave 2 ships arrive ≥ 30.9 s). 22670 ≥ 21000 (7 % margin). A time-up is 90 s, ≤ 92 s.
5. **Every seed:** the generator only permutes the fixed multisets and jitters later, so 1 and 4 hold for all seeds (checked on 1,000).

Measured during the build: an oracle bot (perfect intercept lead with `solveLaunch` iterated on the predicted ship position, the island avoided, barrels when they chain ≥ 2) on the real store at 60 fps, 20 fps and random 4–50 ms frames; its best and the margin to 10500 go here. If its best is under 70 % of 10500, the limits PR tightens the ceiling (e.g. a per-shot bound from the reload). `capScore` stays the safety net.

## Run end

- `"lose"` when the third ship reaches the harbour (`loseLife()` to 0, the store ends the run). `resultDelayMs: 1400`: the ship sailing in and the fort's flag dropping are seen.
- `"timeup"` by the shell at 90 s. No `"win"`. A ship crossing on the time-up frame does not count (the clock runs first).

## Scene and camera

- **Fixed, behind the cannon, looking out to sea** (the lanes' depth must read as distance): `useFittedView({ area: SEA_BOX, pitch, yaws: [0], margin: { top: 0.12, bottom: 0.2, left: 0.02, right: 0.02 }, padding: 8, shift: true })`; `SEA_BOX` = x ±19, y 0–6, z −60 to −20 (the three lanes with zig-zags and spheres); `pitch` **14°** when the canvas is landscape, **30°** in portrait (a 38 m wide field cannot fit a portrait screen from a low eye). The bottom margin keeps a band for the cannon and the parapet below the field. `<CameraRig camera={{ position, lookAt: SEA_FOCUS }} offset={view.offset} shift={view.shift}>` (static). Changed from spec ("low pitch"): portrait is steeper, because of the width.
- Recoil: the cannon slides back 0.35 m and returns over 0.4 s (`spring`), plus `fx.shake(0.12)`.
- `environment: { background: "#bae6fd", fog: ["#bae6fd", 70, 160], lighting: "day" }`; `<SkyDome top="#38bdf8" bottom="#e0f2fe">`; `<Water size={[140, 100]} position={[0, 0, -40]} color="#0ea5e9" deep="#0369a1" amplitude={0.15}>`. Ships bob and roll by `hover` and a sine (looks only; rules stay flat). Sinking: roll to 25°, down 2.5 m over 1.6 s, `splash` bubbles, `debris`.

## Core helpers used

`GameDefinition` (`input: { drag: true }`, `durationMs`, `lives`, `resultDelayMs`, `touchControls: []`, `hudStats` Wave x/5, `Hud`, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`drag`, `tap`, `pressed`, `jumpPressed`, `moveX/Y`), `stepKeyboardAim`, `AIM_DRAG_MIN_PX` / `AIM_DRAG_FULL_PX`, `useFittedView` + `CameraRig`, `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `loseLife`, `setStat`), ballistics (`trajectoryPoints`, `solveLaunch` (bot), `stepProjectile` (reference test only), `BallisticParams`, `Projectile`), path (`createPath`, `advance`, `tangentAt`), collision (`spheresOverlap`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `advanceRunClock` / `playedFrameDt` / `createArcadeStore` (tests), `fitView` (camera test), `<Model fallback>`, `<InstancedModel>`, `<DynamicInstancedModel tinted>` (per-copy `color`), `<DynamicInstanced>`, `<TrajectoryDots>`, `REUSED_ASSETS` / `SHARED_ASSETS` / `EXPANSION_ASSETS` + `EXPANSION_GLB_SIZE` / `EXPANSION_GLB_POINTS` / `expansionPoint`, materials (`material` override), `core/motion` (`hover`, `spring`), `core/fx` (`useFx`: `burst` smoke / splash / debris / puff / sparkle, `score`, `shake`, `warm`), `core/env` (`Water`, `SkyDome`), lighting `day`, `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below). Not used: rig (no character), `core/ai`, `Trail` (the ball is fast and close to its dots). Generic code in the folder: only `aim.ts`, which moves to core with the second lob game (above).

## Assets

No new generation: every GLB is in `core/modelManifest.ts`. Fits in `assets.ts`, derived from the measured sizes, checked in `assets.test.ts` on the real meshes.

| id | class / source | target in game | rules volume | fallback |
|---|---|---|---|---|
| ship | A `EXPANSION_ASSETS.ship` (this game's GLB), pool of 8, `rotationY` bow → heading, waterline (`shipWaterline`) on y 0 | 3 / 6 / 9 m long by type | 2–3 spheres | hull box + mast + sail parts |
| cannon | C `EXPANSION_ASSETS.cannon` (default fit), on a procedural turntable ring | 1.6 m long | muzzle point | cylinder on a box |
| powder barrel | D `REUSED_ASSETS.barrel` + `material: { color: "#b91c1c" }`, pool of 5 | 0.9 m tall, half under | sphere r 0.6 | cylinder |
| chest | C `EXPANSION_ASSETS.chest` (default fit), floating | 0.9 × 0.6 × 0.6 | sphere r 0.6 | box |
| palm | D `REUSED_ASSETS.palm`, `<InstancedModel>` ×2 | 3.6 m tall, crown 2.6 | trunk + crown | cylinder + cone |
| crate | D `SHARED_ASSETS.crate`, flotsam pool of 3 (decor) | 0.8 cube | none | box |
| procedural | B: fort (platform, instanced parapet blocks below the lowest shot line, corner tower), flagpole + wind flag, turntable ring, island mound, harbour mole + lighthouse + buoys (instanced), ship pennants (white / coral `#fca5a5` / red `#f87171` by type), galleon fore and aft sails, HP pips (1–3 discs over each ship), wakes, cannonballs (pool of 4), landing ring | | | |

- Palette: sea `#0ea5e9` → `#0369a1`, sand `#fde68a`, stone `#a8a29e`, sails `#f8fafc` / `#fca5a5`, accent `#f87171`.
- Changed from spec: types are told apart by size, pennant colour and the galleon's extra sails, not sail tints (a per-copy tint would colour the hull too: the GLB is one mesh); the powder barrel uses a `material` override (a tint cannot turn the blue barrel red).
- `assets.spec.json` lists only the ship (the one GLB in this game's folder, generated in batch 1, image-to-3D). Its concept `tools/hyper3d/concepts/pirate-cannons-ship.png` is committed by the assets + limits PR.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `aim.ts` (pure lob aim: drag, keyboard nudge and snap, `AIM`) · `rules.ts` (wave generator, fixed tick, ships, balls, barrels, chest, island, scoring; pure, seeded) · `rules.test.ts` · `aim.test.ts` · `assets.ts` + `assets.test.ts` · `camera.test.ts` (pure `fitView`) · `Scene.tsx` (one `useRunFrame`, camera, fx, audio) · `Cannon.tsx` (cannon, recoil, dots, landing ring, balls) · `Ships.tsx` (ship, pennant, sail, pip and wake pools) · `Bay.tsx` (water, sky, fort, island, harbour, barrels, chest, flotsam) · `Hud.tsx` (wind vane, reload) · `Primitives.tsx` (stand-ins, `fallbackParts`) · `assets.spec.json` · `README.md` · `public/images/3d/pirate-cannons.webp` · `tools/thumbs/inputs/pirate-cannons.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4) plus `aim.test.ts` ≤ ~120; behaviour over branches; core is already tested.

- **Ballistics:** the rules' ball equals an independent analytic formula (≤ 1e-6 m) and a 1 kHz `stepProjectile` reference (< 1 cm) at 55 m; wind drift = ½ a t²; the same aim, wind and fire time at 30, 60, 144 fps and random 4–50 ms frames give the same hit tick, ship and score.
- **Aim:** gains, clamps, relative to the drag's start; release fires, `cancelled` only adjusts, tap fires, one buffered fire during the reload; keyboard 0.5° nudge per press, sweep after 0.25 s, snap.
- **Waves:** deterministic per seed; the multisets, spawn windows, speeds, wind ranges, barrels, chest window; gap rule; ≤ 8 alive.
- **Every ship reachable:** for 1,000 seeds each ship has a window ≥ 1.5 s in which an oracle shot inside the aim limits, clear of the island, under its wave's wind, hits it.
- **Hits:** sphere contact at r_sum ± 1 mm; the grazing miss band ≤ 1 cm; the island blocks; blast at 6 + r ± 1 mm; chain after 0.15 s; one damage per ship per shot; a sunk ship never costs a life.
- **Scoring + proof:** every event (hit, sink + lane bonus, chain cap, chest, combo start and reset); the ceiling 10500 from the tables; `C(t) ≤ 1500 + 110 t` at every spawn time; an idle run loses at ≥ 22.67 s on 1,000 seeds; the oracle bot through the real store scores ≤ 10500 and passes `withinServerLimits`, `capScore` a no-op; time-up at 90000 ms.
- `camera.test.ts`: the field and the muzzle on screen at 1280 × 800, 390 × 844, 844 × 390, banner open and closed. `assets.test.ts`: ship lengths and waterline, drawn muzzle within 5 cm of the rules' muzzle at yaw ±45° and elevation 0 / 35°, parapet under the lowest shot.
- Browser (headless CDP, flags + mock): the common criteria (03); the drag on 390 × 844 touch emulation; Retry ×10 keeps `geometries` flat.

## Performance

Target **35** draw calls, cap **45** (spec ≈ 40). Estimate: sky 1, water 1, fort 3, cannon 1 + ring 1, flag 2, island 1, palms 2, mole + lighthouse 3, buoys 1, ships 1, pennants 1, sails 1, pips 1, wakes 1, barrels 1, chest 1, flotsam 1, balls 1, landing ring 1, dots 1, fx pools ≤ 5, score sprites ≤ 3 → 30–36. Triangles ≤ 100k (8 ships × 5k, cannon 4k, chest 4k). Pools sized at mount (`fx.warm("smoke", "splash", "debris", "puff", "sparkle", "score")`); no per-frame allocation (module scratch). `useQuality`: water "reduced" / "flat", flotsam 3 → 0 and fx counts scaled. Lights: the `day` preset only. Measured with `?perf=1` (p95 on the mid-phone profile, 09 §L.3) and reported here.

## Audio

P-06 is not merged; designed against 06 §9.3: fire `playSfx("boom", { volume: 0.9 })` + `"thud"` at pitch 0.6 (the low thump); in flight `"whoosh"` at pitch 1.4 for the far lanes; `"splash"` on a miss; `"hit"` (wood crack) on a hit, `"boom"` at pitch 0.7 on a barrel blast, `"combo"` rising with the streak; `"chime"` at pitch 0.7 as the ship bell on each wave (with the wind change); `startLoop("ambient", { volume: 0.15 })` gulls and surf. Built before P-06 lands: fire `"jump"`, hit `"hit"`, sink `"pickup"`, harbour `"hit"`, then adopted with P-06.

## Accessibility

Wind as an arrow plus a number (m/s², one decimal) in the HUD and a streaming flag on the fort; the 0.8 s preview and a landing ring; keyboard aim in 0.5° steps with Space to fire; ship HP as pips (shape, not colour); ship type by size; a reload ring on the cannon. No touch button needed: the whole game is drag and tap. `fx.shake` honours reduced motion (core).

## Risks and open questions

- **Small far ships in portrait:** the 38 m field across 390 px puts a far sloop at ≈ 50 px; measured in the first playable.
- The cannon is one mesh: elevation tips the whole cannon about its axle (to 35°); if that reads badly, the visual tilt is capped and the barrel gets a procedural sleeve (rules unchanged).
- Wind 3 m/s² with a 0.8 s preview on the far lane may be too hard; `WAVES` max wind is the tuning knob (the proof does not depend on it, reachability does).
- The ceiling 10500 is loose by design (no reload model); see the proof's last line.
- Changed from spec: a fixed 0.8 s preview instead of 40 % of the flight, because `<TrajectoryDots>` shows dots at a fixed step; it gives ≈ 84 / 57 / 38 % on the 25 / 40 / 55 m lanes, so difficulty grows with range like the bonus.
- **Open questions for the user:** (1) Aim: relative drag (drag adjusts the cannon from where it is, tap fires again; designed) or an absolute slingshot (every shot a fresh pull from zero)? Mini-golf keeps the slingshot either way. (2) Portrait: steeper 30° view of the whole bay (designed) or keep the low over-the-shoulder view and narrow the bay for everyone (lanes x ±12, shorter crossings)?

## Status

(empty until the build)
