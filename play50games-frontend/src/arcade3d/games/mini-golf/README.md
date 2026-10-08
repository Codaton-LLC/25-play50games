# Mini Golf 3D

Owner: Claude. Slug: `mini-golf`. Skill game 11 (order 21), complexity 4, wave 2, the second game of the aim-and-release family (pirate-cannons is its reference, section "Aim-drag tuning") and the game that proves the physics kit (`core/kinematics`). Spec: `docs/arcade-expansion/04-game-specs-skill.md` §11. Gate G0 (design); the build fills `Status`. Units: metres, seconds, degrees in the text (radians in code); each hole has its own frame: x right, z towards the camera (+z = the tee side, the cup lies towards −z), y up, the main felt at y 0. Every "Changed from spec" line says what and why.

## Concept

Six bite-size toy holes on floating felt islands above a calm sea: a straight, a dogleg bank, a ramp jump over water, the windmill, a pipe maze and a turntable hill. Pull back from anywhere, release, watch the ball roll, bank off the wooden rails and drop with a rattle. Par is printed on every hole; aces earn confetti. Accent `#86efac`.

## Controls

`meta.ts`: `scheme: "aim-drag"`, definition `input: { drag: true }`, `touchControls: []` (canvas gesture only).

- `keyboard`: "Drag to aim and putt, or arrows to aim and hold Space, release to putt". Changed from the stub ("…or arrows + hold Space"): it names the release.
- `touch`: "Pull back from anywhere, release to putt". Changed from the stub ("Drag to aim, release to putt"): it says the pull goes backwards and needs no ball touch.
- `instructions`: "Pull back from anywhere: the longer the pull, the harder the putt." · "Release to putt. Sink it in as few strokes as you can." · "Keys: arrows aim and set power; hold Space and release, or Enter putts the power shown."
- Input fields: `drag` (`active`, `angle`, `power`, `released`, `cancelled`), `pressed.{left,right,up,down}` + `moveX/Y` (keyboard aim), `jump` / `jumpPressed` (Space charge), `actionPressed` (E / Enter: putt the set power). A `tap` does nothing (a mis-tap never costs a stroke). Esc / P pause (shell).

### Aim-drag tuning (reused from pirate-cannons)

- **Slingshot (core polar):** while `drag.active`, power = `drag.power` (pull / `AIM_DRAG_FULL_PX` 160 px, clamped to 1) and the shot points along `drag.angle` (start − current, on screen). The screen vector is un-foreshortened by the hole camera's pitch (forward = screen y / sin(pitch)) and turned into the world with `inputToWorld(right, −forward, view.yaw)`, so the dots point where the pull points on screen (tested). A release `!cancelled` putts; a pull under `AIM_DRAG_MIN_PX` (16 px) only cancels. Pirate's family rule stands: a putt is direction + power, so mini-golf keeps core's polar `power` / `angle` with the same 160 / 16 px constants.
- **Ball speed:** `v0 = 4.5 · power` m/s (`BALL.vMax`): 16 px = 0.45 m/s (rolls 0.11 m), 80 px = 2.25 (2.8 m), 160 px = 4.5 (11.25 m on flat felt); 1 px ≈ 0.028 m/s.
- **Keyboard** (pirate's nudge-then-sweep): each fresh `pressed` ← / → turns 1° (spec), ↑ / ↓ changes power by 2 %; an arrow held over **0.25 s** sweeps with `stepKeyboardAim` (turnRate 1.05 rad/s = 60°/s, powerRate 0.5/s, no angle limits, minPower 0.1); keyboard values snap to the 1° / 2 % grid. Holding Space runs a charge meter, power = `needlePosition(held, 2.0, "pingpong")` (0 → 1 → 0 every 2 s, min 0.1); releasing Space putts that power. Enter (`actionPressed`) putts the shown power with no timing at all. Each stroke starts aimed at the cup, power 0.5.
- **Core move (Claude, before the build):** mini-golf is the second aim-drag game, so it triggers moving the family's generic aim code out of `games/pirate-cannons/aim.ts` into `core/aim.ts` as a small core PR: the nudge-then-sweep-then-snap keyboard stepper (pirate's `stepKeys`, with step sizes, hold delay and ranges as options) and the fire triggers (`released && !cancelled`, Space). Pirate-cannons then imports them; its relative lob mapping (yaw / elevation from the drag's start) moves along for castle-defender and snowball-battle. Mini-golf imports the stepper from core and keeps only its putt mapping (pitch correction, `vMax`, charge meter) in `aim.ts`. No game imports from another.

## Rules

All numbers live in `course.ts` (`HOLES`) and `physics.ts` (`BALL`, `CUP`, `WINDMILL`, `TURNTABLE`), proven in `rules.test.ts` and `course.test.ts`.

- **Fixed tick:** `run.clock = createFixedStep(1 / 120)` once per run; `advanceRun(run, dt, aim, putt)` calls `fixedStep(run.clock, dt, run.tick)`; each tick runs `substep(1/120, 1/240, …)`: two 240 Hz sub-steps (spec). `useRunFrame`'s dt ≤ 1/20 s gives ≤ 6 ticks, under `fixedStep`'s 8-step cap, so no tick is dropped. A putt released in a frame starts on the next tick. The windmill and the turntable turn by ticks since the hole started, so a putt's outcome depends only on its start tick. Changed from spec (240 Hz steps): 240 Hz ticks would need 12 steps in a 50 ms frame and `fixedStep` drops whole steps past 8.
- **Ball** (`BALL`): radius **0.06** (drawn 1.5× = 0.09); rolling friction **0.9 m/s²** against the velocity (never reverses it); slope acceleration **(5/7) · 9.8 · ∇h** (a rolling solid sphere) from the tile's analytic height function; speed clamped to **6 m/s** (`vCap`, the proof's bound; honest play peaks at ≈ 5.4 on hole 6's slope). **Rest:** speed < **0.05 m/s** where the slope pull ≤ 0.9 m/s² (grades ≤ 7.4°); every slope is either ≤ 2 % (the ball may rest) or ≥ 9° (it never can). The stroke ends at rest; that spot becomes the **last rest point**. A stroke still moving after 20 s ends at the last rest point, no penalty (a guard; bots never hit it).
- **Rails:** `circleSegmentXZ` + `resolveCircleSegmentXZ(ball, hit, 0.75, 0.1)` (restitution **0.75**, Coulomb mu **0.1**); static rails are segments on the boards' inner faces. Rails are infinitely tall in the rules (an airborne ball never clears one).
- **Airborne** (hole 3 only, a tagged lip): off the lip the ball flies in closed form from the lip state (gravity 9.8, no wind; `landingPoint` for the landing pad's height), evaluated per sub-step (no Euler drift). Landing: vertical speed × −0.3 (rolls when it is under 0.3 m/s), horizontal × 0.85. Below the water level (y −0.15) over the gap = water.
- **Cup** (`CUP`): capture radius **0.10** (centre to centre; drawn cup 0.13 so the drawn ball fits). Captured if the speed is **< 1.2 m/s** inside it; faster = **lip-out**: velocity turned away from the cup centre by 25° × (1 − d / 0.10) (dead centre turns right; mirrored left), speed × 0.85, judged once per pass (the ball must leave the circle first). The flag (0.8 m) stands 0.25 m behind the cup (−z), no collision, so it never hides the cup.
- **Water:** a ball centre inside a pond box or below the gap's water level → splash, **+1 stroke**, ball back to the last rest point (the tee before the first stroke).
- **Strokes:** each putt and each water penalty is a stroke. Cap **par + 4** (spec): when a stroke ends (rest or water) with the count at par + 4, the ball is picked up ("Picked up", hole scored as par + 4). So at most 6 / 6 / 7 / 7 / 7 / 8 strokes, 41 a run.
- **Mirror:** `generateCourse(seed)` mirrors each hole in x on a seeded bit (64 variants; spin directions mirror too). Mirrored outcomes equal the originals' within 1e-9 (tested).
- **Hole out:** 2.0 s of play from capture (0.6 s drop + 1.4 s camera fly-over) before the next hole takes a putt; input is ignored meanwhile.
- **Run cap:** the game keeps its own clock (no `durationMs`): at 600 s of play it ends with `end("timeup")`; a "Time left" HUD stat shows from 540 s. Changed from spec ("no timer"): a run must end within the server's duration window; a slow novice needs ≈ 8 min (41 strokes × 11 s).

### The six holes (fixed order, easy → hard; mirror bit per hole)

| # | name, par | layout (felt at y 0 unless stated) | tee → cup | feature |
|---|---|---|---|---|
| 1 | First Putt, 2 | lane x ±0.5, z −3.5…+3.5 | (0, 3.0) → (0.15, −2.6) | a 2 % side tilt towards −x over z −3.5…−1.0 (a gentle break) |
| 2 | Dogleg, 2 | leg A x ±0.5, z −1.5…3.5; leg B x −0.5…3.5, z −1.5…−0.5 | (0, 3.0) → (2.9, −1.0) | 45° bank board across the outer corner, (−0.5, −0.9) to (0.1, −1.5); the straight line hits the inner corner |
| 3 | Ramp Jump, 3 | lane x ±0.6, z −4.0…4.0 | (0, 3.5) → (0.3, −2.8) | flat to z 1.0, 12° ramp to the lip at z 0.0 (y 0.21), water gap z 0…−0.6 (water y −0.15), landing green beyond; side beams span the gap |
| 4 | Windmill, 3 | lane x ±0.7, z −4.5…4.5 | (0, 3.8) → (0.25, −2.6) | windmill at (0, 0) filling the lane; funnel rails (±0.7, 1.6) → (±0.116, 0.75); tunnel walls x ±0.116 from z 0.75 to −0.75 |
| 5 | Pipe Maze, 3 | upper tier y 0.4: x ±1.5, z 1.5…4.5; lower green: x ±1.5, z −4.5…1.5 | (0, 4.0) → (0.6, −3.0) | three mouths 0.24 wide in the tier wall at x −1 / 0 / +1; pond 0.8 × 0.6 at (0.6, −1.3) |
| 6 | Turntable Hill, 4 | terrace y 0.6: x ±0.8, z 3.5…5.0; 9° slope x ±1.0, z 3.5 → −0.3; lower green x ±1.5, z −4.2…−0.3 | (0, 4.5) → (0.6, −3.3) | turntable on the slope; pond 1.0 × 1.0 at (−0.5, −3.3) |

- **Hole 3 numbers:** the gap needs ≥ 2.4 m/s at the lip (0.64 m range at 2.5); from the tee that is v0 ≥ 3.88 m/s (86 % power: 2.5 m flat costs 4.5 m²/s², the 1.01 m ramp 4.76). An ace lands at ≈ 2.5 m/s at the lip and arrives under 1.2 m/s. A short ball rolls back down the ramp (no rest at 12°).
- **Windmill** (`WINDMILL`): `EXPANSION_ASSETS.windmill` (2.2 m tall, scale 2.2 / 1.8979); tunnel clear width 0.2 × 1.159 = **0.232** (`WINDMILL_TUNNEL_GLB`), so the ball's centre must pass within ±0.056 of the axis (the funnel guides it). Hub `EXPANSION_GLB_POINTS.windmillHub` → (0, 1.148, 0.649) m; a 0.15 m procedural axle puts the blade plane at z **0.80**, in front of the arch (0.753). 4 blades 1.10 × 0.30 (tip 0.048 above the felt), one turn per **6 s** (a blade passes the bottom every 1.5 s), start phase 45° (open). In the rules a blade is its chord at ball height (y 0.06), rebuilt each tick as a moving segment (`vx` = the blade's sideways speed there, ≈ 1.14 m/s); it blocks the mouth for |φ| ≤ 16.7° from straight down: **closed 0.56 s, open 0.94 s** of every 1.5 s (pinned in a test). A ball that rests inside the tunnel is placed at (0, −0.85), no penalty.
- **Pipes** (hole 5, a path segment each): entry when the ball's centre crosses a mouth line inside its window, heading in; it exits at the **same speed** (spec) after length / speed. Left → a portal in the left rail at (−1.5, −3.0) heading +x (2.1 m from the cup: the good pipe, ace for entry speeds 1.90–2.24), drawn 5.0 m; centre → the back rail at (0, −4.5) heading +z, 6.4 m; right → the right rail at (1.5, 0.8) heading −x, 1.4 m. Each drawn length ≥ the straight mouth-to-portal distance.
- **Turntable** (`TURNTABLE`): a disc r 0.9 centred (0, 1.6) on hole 6's slope carrying one bar 1.7 m long through its centre, ω **1.2 rad/s** (5.24 s a turn), a rotating segment (`pivot`, `omega`: contact velocity from core). Changed from spec: the floor does not carry the ball. A carried ball can orbit the rim or never settle, which breaks the rest rule; the bar keeps the timing challenge, and the 9° slope means no ball can rest in its sweep. No sliding gate either (spec mechanics list): the windmill and the bar already make two timing holes.
- Changed from spec (10 designed holes, 6 drawn per run): 6 fixed holes with a seeded mirror each. Every hole must be proven solvable within par at every frame rate; six proven holes in a fixed easy → hard order beat ten unproven ones, and the mirror keeps the "course of the day" variety.

## Scoring

`holeScore(par, strokes) = 100 · max(0, par + 3 − strokes) + (strokes === 1 ? 200 : 0)` (spec, unchanged); a picked-up hole counts par + 4 = 0. Par 17 (2, 2, 3, 3, 3, 4). Par everywhere = 6 × 300 = **1800**; an ace is 600 / 700 / 800 on par 2 / 3 / 4. Live: `addScore(holeScore)` at the capture (or pick-up); popups "Birdie +400", "Hole in one! +600". `finalScore` is not overridden.

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `arcade-games.json` now) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 6750 | **4100** |
| duration | 30000–900000 ms | **15000–602000 ms** |
| `base` / `max_pps` | 6750 / 6750 | **1200 / 200** |

The provisional 30 s minimum would reject a legal ace run (≥ 16.25 s, below), so it must drop. Proof plan (robot-collector's structure, through the real store):

1. **Ceiling:** a hole is worth at most 100 · (par + 2) + 200 (strokes ≥ 1): Σ = 100 · 17 + 6 · 400 = **4100**, for every seed and mirror.
2. **Speed:** |v| ≤ 6 m/s on every sub-step (the clamp), including blade and bar hits; a pipe moves the ball at its entry speed over a length ≥ the straight distance; airborne travel is counted in x / z.
3. **Earliest capture per hole:** ≥ (|tee − cup| − 0.10) / 6 after the hole opens: 5.50 / 4.84 / 6.21 / 6.31 / 6.93 / 7.72 m → 0.917 + 0.807 + 1.035 + 1.051 + 1.155 + 1.287 = **6.25 s**, plus 5 hole-outs × 2.0 s = **16.25 s** earliest win. 15000 ms leaves 1.25 s (8 %).
4. **Clock:** `useRunFrame`'s dt is the store's `frameMs`; ticks never exceed `elapsedMs` (the leftover carries, no tick dropped). The bots drive `createArcadeStore()` through core `simulateRun`.
5. **Line:** every run ends at hole 6 (≥ 16.25 s) or at the 600 s cap, so only the final score meets the line: `1200 + 200 · 15 = 4200 ≥ 4100`, growing after. Max: the cap ends the run on the first frame past 600 s (≤ 600.05 s) → 602000.
6. **Measured** (build): the par bot, an ace-hunting oracle and a spam bot; best score and margins reported here.

## Run end

- `end("win")` on the tick hole 6 is captured or picked up, with its score added in the same callback. `resultDelayMs: 1800`: the drop, the flag lift and (birdie or better) confetti are seen.
- `end("timeup")` by the rules at 600 s of play (score so far). No `"lose"`.

## Scene and camera

- **Fixed per hole, fitted:** `looks.ts` `viewFor(hole, w, h)` = `useFittedView({ area: the hole's rail box + 0.15 m, y 0 to its tallest point (flag 0.8; hole 4 the blade tips 2.25), pitch: 58°, yaws: [0, π/2] (hole 4: [0], so the blades face the camera), margin: { top: 0.1, bottom: 0.05, left: 0.03, right: 0.03 }, padding: 8, shift: true, fov: 45 })`, one cached object per hole and size; `<CameraRig camera={{ position: focus + view.offset, lookAt: focus }} shift damping={3}>`, so it snaps at the start and eases ≈ 1.4 s to the next hole (the fly-over). Holes are ≤ 9.2 m long, so a whole-hole fixed view beats the spec's follow (a putt is read before it is played). Estimate: drawn ball 15 px on 390 × 844 and on 844 × 390 (sideways yaw), 25 px at 1280 × 800.
- Islands: hole k sits at world z −16k on a rock base (lathe); only the current hole and the next are mounted. One sea `<Water>` under them; the gap and ponds are small `<Water>` patches. Decor (trees, rocks) only behind and beside the rails, never between the camera and the lane.
- `environment: { background: "#e0f2fe", fog: ["#e0f2fe", 30, 90], lighting: "day" }`. Felt `#4ade80` → `#16a34a` (shaded by height), rails `#a16207`, water `#38bdf8`.
- Preview: `<TrajectoryDots count={12} step={0.1} params={{ gravity: 0, wind: { x: 0, z: 0 } }}>` from the ball along the aim to the first rail contact or the flat-felt roll length (v0² / 1.8), capped at **2.5 m** (long putts are read, not computed; slopes and bounces not shown); a power ring around the ball (arc = power) plus the percent in the HUD.

## Core helpers used

`GameDefinition` (`input: { drag: true }`, `resultDelayMs`, `touchControls: []`, `hudStats` Hole x/6 · Par · Strokes, `Hud`, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`drag`, `pressed`, `moveX/Y`, `jump`, `jumpPressed`, `actionPressed`), `stepKeyboardAim`, `AIM_DRAG_MIN_PX` / `AIM_DRAG_FULL_PX`, the core aim stepper (moved from pirate-cannons, above), `inputToWorld`, `useFittedView` + `CameraRig`, `fitView` (camera test), `useSafeArea` (through the fit), `useArcadeStore` (`addScore`, `setStat`, `end`), kinematics (`circleSegmentXZ`, `resolveCircleSegmentXZ`, `rotateSegmentXZ`, `substep`, `createFixedStep`, `fixedStep`), ballistics (`landingPoint`), `hud/timingMath` `needlePosition` (charge meter), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `createArcadeStore` + `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`; tests), `<Model fallback>`, `<InstancedModel>`, `<Instanced>`, `BlobShadow`, `useCanvasTexture` (ball dimples, felt grain), `<TrajectoryDots>`, `EXPANSION_ASSETS` (`windmill`, `rock`, `leafyTree`) + `EXPANSION_GLB_SIZE` / `EXPANSION_GLB_POINTS.windmillHub` / `WINDMILL_TUNNEL_GLB` / `expansionPoint`, `REUSED_ASSETS.checkpointFlag` + `material` override, `core/fx` (`useFx`: `burst` sparkle / splash / confetti / puff, `score`, `warm`), `core/env` (`Water`), lighting `day`, `useQuality` + `scaledCount`, perf probe `?perf=1`, audio (`playSfx`, `startLoop`, `useMuted`). Not used: rig (no character), `core/path` (pipes are one segment each), `core/ai`, `Trail`. Nothing generic in the folder beyond what the core aim PR takes.

## Assets

Only the windmill is this game's own GLB (batch 2, already imported and in `core/modelManifest.ts`, 119 KB). Fits in `assets.ts`, derived from the measured sizes, checked in `assets.test.ts`.

| id | class / source | target in game | rules volume | fallback |
|---|---|---|---|---|
| windmill | A `EXPANSION_ASSETS.windmill` (default fit), front +z | 2.2 m tall, 1.57 × 1.51 base, tunnel 0.232 clear | body box + tunnel walls | cylinder + cone |
| blades | B: 4 sails 1.10 × 0.30 on spars + axle, one instanced mesh | blade plane z 0.80 | moving chord | (is code) |
| flag | D `REUSED_ASSETS.checkpointFlag` scale 0.8 / 1.9, `material: { color: "#dc2626" }` | 0.8 m | none | cylinder |
| tree | C `EXPANSION_ASSETS.leafyTree`, `<InstancedModel>`, scale for 2.0–2.6 m | decor | none | cylinder |
| rock | C `EXPANSION_ASSETS.rock`, `<InstancedModel>`, seeded yaw / size 0.4–1.0 | decor (island edges) | none | sphere |
| procedural | B: felt tiles (one merged geometry per hole, ramps and slopes from the same height functions), rails (instanced boards), cups, ball (white, canvas dimple normal map), pipes (tubes + portal rings), turntable disc + bar, island bases, gap beams, power ring | | | |

- The override paints the whole flag red (pole too): a toy look; a `tint` is the fallback if it reads badly.
- `assets.spec.json` lists only the windmill; its concept `tools/hyper3d/concepts/mini-golf-windmill.png` is committed by the assets + limits PR.

## Files

`meta.ts` (data, scoring) · `index.tsx` (`GameDefinition`) · `course.ts` (the six holes: tiles and height functions, rails, cups, ponds, pipes, windmill, turntable; mirror) · `physics.ts` (pure ball step: friction, slopes, rails, moving segments, airborne, cup, water, pipes) · `rules.ts` (run state, fixed tick, strokes, cap, hole out, scoring, run cap) · `aim.ts` (putt mapping, charge meter) · `rules.test.ts` · `course.test.ts` (solver) · `aim.test.ts` · `assets.ts` + `assets.test.ts` · `camera.test.ts` · `looks.ts` (views, palette) · `Scene.tsx` (one `useRunFrame`, camera, fx, audio) · `Course.tsx` (islands, felt, rails, cups, flags, pipes, decor, water) · `Windmill.tsx` (GLB + blades) · `Ball.tsx` (ball, dots, power ring) · `Hud.tsx` (power, scorecard) · `Primitives.tsx` · `assets.spec.json` · `README.md` · `public/images/3d/mini-golf.webp` · `tools/thumbs/inputs/mini-golf.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4) with core `botHarness`, `course.test.ts` ≤ ~250, `aim.test.ts` ≤ ~100; behaviour over branches; core is already tested.

- **Frame-rate independence:** on every hole (windmill and bar included) the same putt starting on tick 120 gives the same rest point within **1 mm** (in practice identical) at 30, 60, 144 fps and random 4–50 ms frames; no tick dropped at 50 ms frames.
- **Physics:** tuning pins (`BALL`, `CUP`, `WINDMILL`, `TURNTABLE` equal their literals); flat roll length v² / 1.8 ± 1 cm; 10,000 random static-rail hits never gain speed; a moving-wall hit changes speed by ≤ (1 + e) · |v_wall|; `vCap`; rest at 0.05 m/s and never on a ≥ 9° slope; capture at 1.19 m/s, lip-out at 1.21, at d 0.100 vs 0.101, once per pass; water = +1 stroke and the last rest point; gap clearance from a 2.4 m/s lip; the bounce; pipes keep the speed and take length / speed; the tunnel rest placement; windmill open 0.94 s of 1.5 s; mirror equality ≤ 1e-9.
- **Solvable within par** (`course.test.ts`): a beam search over aim (0.5°), power (0.01) and wait (0.1 s on holes 4 and 6) finds, for both mirrors, a line that sinks within par and still does so for every start tick within ±6 ticks (so any frame rate reaches it); the found lines are committed and replayed through the real store (`simulateRun`) at 30 / 60 / 144 Hz and random frames.
- **Strokes and scoring:** cap par + 4 counting penalties; `holeScore` table; ceiling 4100; earliest win 16.25 s on the speed bound; the par bot (200 seeds: mirrors, frame rates, pauses), an ace oracle and a spam bot (random pulls every frame, 200 seeds) all pass `withinServerLimits`, `capScore` a no-op; an idle bot times out at 600 s with 0.
- **Preview:** its end equals the real first rail contact or flat rest within 1 cm. `aim.test.ts`: pitch correction, 160 / 16 px, 1° / 2 % nudges, sweep after 0.25 s, the charge meter, Enter. `assets.test.ts`: tunnel clear width = the rules' walls, hub within 1 cm, blade tip 0.048, flag 0.8 m. `camera.test.ts`: every hole in view at 1280 × 800, 390 × 844, 844 × 390, banner open and closed.
- Browser (headless CDP, flags + mock): the common criteria (03); a drag on 390 × 844 touch emulation; Retry ×10 keeps `geometries` flat.

## Performance

Target **38** draw calls, cap **45** (spec ≈ 40). Estimate: sea 1, ponds / gap 1–2, two islands × (felt 1, base 1, rails 1) = 6, cups 2, flags 2, windmill 1 + blades 1 + axle 1, pipes 1, turntable 2, trees 1–2, rocks 1, ball 1 + shadow 1, dots 1, power ring 1, fx pools ≤ 4, score sprites ≤ 2 → 30–38. Triangles ≤ 80k (windmill 4k, trees and rocks instanced). One ball and ≤ 40 segments a hole: 240 sub-steps a second are cheap. Pools sized at mount (`fx.warm("sparkle", "splash", "confetti", "puff", "score")`); no per-frame allocation (module scratch). `useQuality`: water "reduced" / "flat", decor scaled. Lights: the `day` preset only. Measured with `?perf=1` at the build.

## Audio

P-06 cues: putt `"click"` (pitch 0.7 + 0.8 · power); rail `"thud"` (pitch 1.4, volume by impact speed, ≥ 0.3 m/s, at most one per 60 ms, panned by x); blade or bar hit `"thud"` pitch 0.8; lip-out `"click"` pitch 1.8; capture `"pop"` (+ `"chime"` for par, `"combo"` rising for birdie or better); water `"splash"`; pipe in / out `"whoosh"`; hole-in-one `"pickup"` + confetti. Loops: `startLoop("ambient", { volume: 0.15 })` while playing; on hole 4 `startLoop("rotor", { volume: 0.12, pitch: 0.5 })` for the windmill; restarted after pause / unmute (`useMuted`), stopped by the shell.

## Accessibility

Dots preview plus a power ring and a percent; keyboard aim in 1° steps and power in 2 % steps; Enter putts with no timing (the Space charge is optional); par, strokes and hole in HUD chips, a 6-cell scorecard; the windmill's open window is wide (0.94 s); the camera fly-over is a cut when reduced motion is preferred. Touch needs no buttons.

## Risks and open questions

- **Tunnel mouth:** the ball's centre must pass within ±5.6 cm; the funnel guides it, but a novice playtest decides. Knob: scale the windmill 10 % (window ±7.9 cm), rules from the same fit.
- **Hole 3 needs 86 % power from the tee:** a hard pull on a phone; knob: the tee 1 m closer.
- The solver's runtime in vitest (budget ≈ 10 s): fall back to the committed lines plus a coarse search.
- Hole 6's bar can add speed; the 6 m/s clamp bounds it for the proof; the measured peak goes here.
- **Open (user):** (1) six fixed holes with a seeded mirror instead of ten drawn six per run (above); (2) the 10-minute run cap ("Time left" from 9:00) instead of no timer.

## Status

(empty until the build)
