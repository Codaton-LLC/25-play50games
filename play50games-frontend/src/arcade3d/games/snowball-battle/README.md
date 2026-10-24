# Snowball Battle

Owner: Cursor. Slug: `snowball-battle`. Adventure game 7 (order 17), complexity 4, wave 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §7; assets: 05 §E.4. Units: metres, seconds; x east, z south (+z toward the camera), y up. Every number lives in `rules.ts` and is pinned by value in `rules.test.ts`. Every "Changed from spec" line says what and why.

## Concept

A friendly 1-vs-3 snowball fight in a fenced schoolyard. You scoop snow, hide on the near side of a fort, and tag the rival whose wind-up you can see. Rivals telegraph, dodge, and crumble the forts, so the cover changes. Accent `#bae6fd`. You win by tagging each rival 3 times; 5 tags on you is a loss; the fight lasts 90 s.

## Controls

`meta.ts` will say `scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`, `touchLabels: { action: "Scoop" }`.

- `keyboard`: "WASD / arrows to move, mouse to aim; hold E or Enter to scoop, Space to throw".
- `touch`: "Joystick to move, hold Scoop to pack a snowball, tap a rival to throw".
- `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (up = away from the camera), magnitude clamped to 1. Scoop is `action` held (E / Enter / Scoop). A fine pointer throws with `aimFired(input, { jump: true })` (Space) and a click's `tapDown` does nothing. A coarse pointer throws with `tapDown` on a rival and has no Jump button. One event per throw. Esc / P and a hidden tab pause in the shell. `setStat` keys `time` / `ammo` / `rivals` (labels Time, Ammo, Rivals) feed the shell chips; the mittens sit in `Hud` under those chips.
- Changed from the stub ("hold E to scoop, Space to throw" / "hold Action"): the button is labelled Scoop, and the mouse aim is part of the keyboard line. Changed from the core adoption note that lists this game as aim-drag: no `input.drag`, no `stepAxisAim`, no `TrajectoryDots`. The director's call is auto-target; a drag lob is the free aim that call rejects, and a full arc preview would show the landing the dodge is meant to contest.

## Rules

Pure seeded `rules.ts`, one `useRunFrame`, `substep` ≤ 1/120 s. No Rapier: forts are AABBs and the limit proof is this step. Groups: `YARD`, `KID`, `SCOOP`, `THROW`, `FORT`, `AI`, `SCORE`.

- **Yard.** Walkable x ∈ [−12, 12], z ∈ [−9, 9] (24 × 18). `clampToBounds` inset by 0.35. Snowman at the origin, footprint x/z ±0.70, height 1.60, immortal. 7 forts, footprint 1.80 × 1.80, centres in [−8.5, 8.5] × [−5.5, 5.5], ≥ 3.60 apart, ≥ 3.20 from the snowman. 10 pines in the edge band (|x| ≥ 9.2 or |z| ≥ 6.6), ≥ 2.20 apart, trunk circle r 0.30 (movement only; they are not sight boxes). Player start (0, 6.2), yaw π (facing −z). 40 generator attempts, then `FALLBACK_YARD`. Flood fill, cell 0.50, clearance 0.35, joins the start to every fort's four cover pockets (1.30 out from each face centre). Each fort's peek pocket (the face toward the snowman) has a player pocket within 6 m with `hasLineOfSightXZ` clear.
- **Kids.** Circle r 0.35, speed 4.5, accel 22, brake 30, `turnTowards` 10 rad/s. Diagonals normalised. `sweptAabbXZ` against forts (HP ≥ 1) and the snowman, then circle push-out against kids and trunks, then the clamp, then the step scaled back to `4.5 · dt`. Drawn height is the committed 1.30 m (`EXPANSION_CHARACTER_HEIGHT.snowKid`), not the catalog 1.25. Standing hit spheres: body (y 0.62, r 0.32), head (y 1.05, r 0.20). Crouch (speed < 0.25 and `distanceToBoxXZ` ≤ 0.50 to the snowman or a fort with HP ≥ 1): body (y 0.42, r 0.32), head (y 0.72, r 0.18). In the open the tall spheres stay, so spinning or crouch-spamming does not shrink the hurtbox.
- **Ammo.** Max 3. A scoop press plants the feet (velocity 0, move ignored) and grants no immunity. Release in [0.50, 1.50) pockets 1 ball if ammo < 3. Reaching 1.50 launches one big roller and pockets nothing from that press. Under 0.50 cancels. Throw gap 0.40 s. No throw while planted. Player starts at 0. Thrower and dodger start active with 1 ball (max 2); the sneaker is absent until 10 s.
- **Throw.** Highlight = the living rival inside `inViewCone` (aim yaw, half-angle 38° × π/180, range 36) with `hasLineOfSightXZ` against the snowman and forts of HP ≥ 1, smallest angle, tie = lower id. No highlight, no throw, no ammo spent. Desktop aim is the pointer ray on y = 0; until the pointer moves, aim stays the facing (start yaw π). Touch: a `tapDown` within 56 CSS px of a rival's projected body throws at that rival; between taps the highlight follows movement facing. `launchForTime` from (feet + facing · 0.35, y 1.00) to the lead point (position + velocity · flight, y 0.62, clamped to the inset). Flight time lerps 0.65 at distance ≤ 6 to 0.85 at distance ≥ 14, clamped. Gravity 9.81, wind 0. Rivals use this same `THROW`. At launch a dry-run of `stepProjectile` (substep 1/120, reused buffer) stores the impact; the live ball repeats that path, and the dodge and the landing ring read the stored point. Either standing or crouch sphere overlaps the ball (`spheresOverlap`). Ball r 0.25; coarse pointers, fixed at run start from `matchMedia("(pointer: coarse)")`, use hit r 0.33 while the drawn ball stays Ø 0.50. A tag counts only when the target is in `windup`. Any other kid overlap destroys the ball and scores 0. A ball that finishes its flight with no hit splats at the stored point and dies.
- **Forts.** 3 HP. Heights 1.40 / 0.95 / 0.55. A ball whose centre would enter the AABB at y ≤ the current height hits the fort, spends itself, and removes 1 HP. It never appears past the fort. At 0 HP the mound is visual only: no collision, no sight block, so a crumbled fort opens a lane. The snowman blocks sight, balls and feet for the whole fight.
- **Big roller.** r 0.45, y 0.45, 6 m/s along facing, life 2.20 s, same fort rule, no arc. A wind-up tag from it knocks the rival down for 1.50 s (one tag, immune, cannot act). It still cannot tag anyone who is not in `windup`, so it does not outrun the hit clock below.
- **AI.** Direction from `arrive(agent, pocket, 4.5, slowRadius, out)` plus `separate(agent, kids, 1.20, 1.5, sep)`. Relocate uses slowRadius 0; cover and peek use 0.80. The kid then uses the player's accel 22, brake 30 and cap 4.5 toward that horizontal desired velocity. A dodge writes `flee(agent, impact, 4.5, out)` instead, for 0.60 s. From rest, 4.5/22 = 0.20 s reaches full speed and covers 0.46 m, then 3.14 m at 4.5 m/s takes 0.70 s, so a 3.60 m relocate takes at least **0.90 s**. FSM `cover → scoop → peek → windup → throw → relocate`. Cover pocket = the face, 1.30 m out, whose outward side blocks LOS to the player; peek pocket = the face toward the snowman. Timers: cover 0.80, peek 0.40, wind-up 1.20 (rooted, no dodge), recover 0.30 (rooted), stagger 0.45 after a small-ball tag (immune, velocity 0), relocate to a different standing fort. A big-ball tag uses a 1.50 s knockdown instead of the 0.45 s stagger, which only lengthens the cycle. They scoop only while LOS is blocked. They enter wind-up only with LOS and a ball. LOS gone at release cancels the throw and spawns nothing. Dodge: stored impact within 1.00 m, after 0.35 / 0.27 / 0.20 s from t = 0 / 30 / 60, and only when not rooted. Open time (LOS clear and further than 0.50 from cover) caps at 2.00 s, then a forced relocate. Before 60 s at most one rival is in peek, wind-up or recover; from 60 s, two. The sneaker joins at 10.00 s on the northernmost free fort, ammo 1, in cover. Roles pick forts only (thrower: nearest the player; dodger: farthest from the last impact; sneaker: largest angle off the player's facing). Timers do not vary, so the limit does not depend on the seed.
- **Frame order.** Spawn, then input, then AI, then movement, then balls. On one substep the player's ball resolves before incoming balls. Then score, then end. Same-frame: a ninth tag wins before the incoming ball is applied.
- **Clock.** No `durationMs`. The rules clock adds played dt and, after that frame's tags, calls `end("timeup")` at ≥ 90 s. Changed from the fixed-timer convention: the shell's `"timeup"` frame does not run `useRunFrame`, so a tag on that frame would vanish and a win on that frame would show "Time's up!" and play the lose sting.
- Changed from spec: flight 0.65–0.85 and wind-up 1.20 s, was 0.60–0.90 and 0.45. A 0.45 s telegraph is shorter than a 0.60 s flight, so a human (about 0.40 s to see it and throw) cannot land the punish, and a perfect dodge always leaves. At ≤ 8 m, flight ≤ 0.70, so 0.40 + 0.70 = 1.10 sits inside 1.20 with 0.10 s spare. Incoming flight ≥ 0.65 gives 0.65 − 0.35 − 0.57/4.5 ≈ 0.17 s to step out of a 0.57 m overlap. Fort count is 7, was 6–8, so the HP budget and the gap proof are one number. A 0 HP mound does not block sight, was a low obstacle: otherwise crumble never opens a lane. One press yields one small or one big, was an unspecified hold: three balls from one hold would erase the ammo limit. Rivals start with 1 ball, was unspecified: the first telegraph is up during the player's first 0.50 s scoop.

**Human pace (estimate, for the witness bot to beat).** One wind-up is offered every 3.20 s (the cycle below). A player who converts 2 of 3, scoops inside the gap (0.50 s) and sidesteps incoming finishes 9 tags in about 45–70 s with 2–4 health left, on keyboard and on touch (the coarse hit radius forgives a short dodge). Converting half still lands near 60–80 s. The 90 s clock has spare. The witness (0.40 s reaction, throws only in the first 0.70 s of a wind-up, range ≤ 8, sidesteps an impact within 1.20 m) must win every sampled seed in ≤ 85 s with ≥ 1 health. If it does not, lengthen the wind-up before shipping.

## Scoring

`runScore = 100·hits + 300·outs + (won ? 500 + 50·healthLeft : 0)`. `healthLeft = 5 − playerTags` (0..5), only on a win. The hit that reaches 3 tags on a rival pays 100 and 300. Forts, scoops, dodges and whiffs pay 0. Live `addScore` once per tag; `setScore(runScore)` on the end frame is reconciliation. Maximum 9·100 + 3·300 + 500 + 5·50 = **2550**. A loss or a time-up keeps banked hits and outs only.

### Server limits and why they hold (the proof)

Build sets `meta.scoring` to **maxScore 2550, minDurationMs 14000, maxDurationMs 92000, base 600, maxPointsPerSec 75**. Claude copies that into `arcade-games.json` (`enabled: false`). The stub's provisional 4500 / 10–92 s / base 4500 / 4500 pps (02 §C.4, 1.5 × the 3000 estimate) would accept a forged fast clear.

1. **Hits need a wind-up.** First wind-up opens at cover + peek = 1.20 s. Fastest tag is that instant plus `FLIGHT_MIN` 0.65 = **1.85 s**. After a tag the rival is immune for stagger 0.45, then relocate ≥ 0.90, cover 0.80, peek 0.40 = 2.55 s until the next wind-up, plus 0.65 s of flight. Period **3.20 s**. Before 60 s only one wind-up exists, and 1.85 + 8·3.20 = **27.45 s** is still before 60 s, so the two-wind-up phase cannot shorten a perfect clear. Nine scoops of 0.50 s fit inside the 3.20 s gaps (the first scoop fits before 1.20).
2. **Prefixes.** Focus-fire: hit n = 1..9 lands at 1.85 + (n−1)·3.20 and scores `100n + 300·floor(n/3)`, plus 500 + 250 only at n = 9. That is 100, 200, 600, 700, 800, 1200, 1300, 1400, 2550. `withinServerLimits` uses `score·1000 ≤ 600·1000 + 75·round(ms)`. At 27.45 s, 2,550,000 ≤ 600,000 + 75·27450 = 2,658,750. Earlier prefixes sit under the same line (the n = 6 spike of 1200 at 17.85 s allows 1938). No other source exists, so every prefix including the end bonus is inside the line, and `capScore` changes nothing.
3. **Fastest honest loss** is five unanswered tags: first release at 2.40 s, impact 3.05, then 3.60 s between impacts (recover 0.30 + relocate 0.90 + cover 0.80 + peek 0.40 + wind-up 1.20). Fifth impact **17.45 s**. minDuration 14 s sits under that; a 2550 at 14 s fails the pps line (allowed 1650). maxDuration 92 s sits 2 s over the 90 s clock.
4. **Bots that must fail:** idle (no input, open start) and spinner (circle strafe, no scoop) lose with score 0; camper (nearest fort, never throws) times out at 90 s with score 0; spammer (scoop whenever ammo < 3, throw whenever ammo > 0, aim yaw spins) never wins and scores ≤ 700. They cannot farm: an out rival does not respawn, and a tag outside wind-up pays 0.

## Run end

- `end("win")` on the frame the ninth tag lands, after `setScore` of the full formula. `resultDelayMs: 1200` (cheer, confetti).
- `end("lose")` when `playerTags` reaches 5, banked points kept, no health bonus.
- `end("timeup")` from the rules clock at ≥ 90 s, after that frame's tags, when neither of the above fired. Banked points kept. `end("quit")` is the shell's Exit and saves nothing.
- The player's ball is resolved before incoming on the same substep, so a ninth tag on that substep is a win.

## Scene and camera

Follow the player's feet. The fit box is a window around the origin, x ±3.1, y 0..1.45, z ±2.5, `focus: [{0,0,0}]`, pitch `(52·π)/180`, `yaws: [0]`, fov 45, `margin` 0.02, `padding` 8, `shift: true`. `<CameraRig follow={player} followFraction={1} damping={5} offset={view.offset} shift={view.shift}>`, look-at `[0,0,0]`. One sentence: yaw 0 keeps the camera on +z looking toward −z, and a window around the kid (not the whole 24 × 18) is what still leaves a 1.30 m kid and a 0.50 m ball at least 24 CSS px tall once `fitView` has dollied out for the HUD. `fitView` binary-searches distance; camera height above the look-at is `sin(pitch)·distance`; yaw 0 is the +z side. `CameraRig` eases position and look-at by `1−exp(−5·dt)`. No `followFocus` over the yard: that would force the origin window to stay on screen from the fence, and the dolly would jump. Changed from spec pitch ≈ 60° and "fitted to the 24 × 18": at 60° a full-yard fit draws the kid under 16 px on a phone (cos 60° = 0.5). Off-screen rivals and balls use `<TargetMarkers>` at 28 CSS px.

Kid px = `|project(0,1.30,0) − project(0,0,0)| · canvasHeight/2` after the lens shift. Ball px ≈ `(0.50 / distance) / (2·tan(22.5°)) · canvasHeight`. Ground px/m is a 1 m segment along x at the focus. Rows below are that projection through a `fitView` replica with assumed rects (portrait: HUD y 8–96, 136 px joystick and Scoop lifted over a 92 px banner; landscape: HUD y 6–52 between the side controls, banner 72 px). The build remeasures the registered rects and shrinks the window if a real banner drops the kid or the ball under 24 px. Shift was 0 on these three fits.

| viewport | distance | kid px | ground px/m | ball px | 1.2 m ring px |
|---|---:|---:|---:|---:|---:|
| 390×844, banner open | 19.55 | 44.0 | 52.1 | 26.1 | 62.5 |
| 844×390, banner open | 9.60 | 43.9 | 49.0 | 24.5 | 58.8 |
| 1280×800 | 7.55 | 118.4 | 127.8 | 63.9 | 153.4 |

Landing ring and target ring sit at y 0.04 and 0.06, `depthWrite: false`, above the snow. Score text at y 1.70. Ground `#f8fafc`, shade `#bfdbfe`. `environment: { background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" }`. `<SkyDome top="#bae6fd" bottom="#f8fafc">`. `<SnowFall count={360}>`, scaled by `useQuality().particles`. Poses, in `poses.ts`: `walkPose` with amount = min(1, speed / 4.5) and `gaitPhaseStep(..., 4)`; crouch blends a bent spine / chest / head (`turnBone`) and folded thighs with `levelFoot` on both feet; the throw is `aimArm` cocked back then followed through, blended through `carryPose` first so the arm does not pass the T; `cheerPose` on a win; `flailPose` during stagger and knockdown. `<HumanoidModel applyLift>` default, so the soles stay on y = 0.

## Core helpers used

`GameDefinition` (`resultDelayMs`, `touchControls`, `touchLabels`, `hudStats`, `environment`, no `durationMs`, no `physics`), `useRunFrame`, `useGameTime`, `useInput`, `inputToWorld`, `aimFired`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), `substep`, ballistics `launchForTime` + `stepProjectile` (the stored impact is the stepped one, so the ring matches the hit), steering `seek` / `arrive` / `flee` / `separate`, vision `inViewCone` + `hasLineOfSightXZ`, collision `sweptAabbXZ` / `spheresOverlap` / `sphereAabbOverlap` / `distanceToBoxXZ` / `clampToBounds` / `circlesOverlapXZ`, math `createRng` / `rngNext` / `turnTowards` (`randomSeed` in the Scene only), rig `HumanoidModel` `attach={{ head, chest }}`, `useHumanoidPose`, `walkPose`, `gaitPhaseStep`, `bodyLift`, `blendPoses`, `aimArm`, `turnBone`, `levelFoot`, `carryPose`, `cheerPose`, `flailPose`, `SNOW_KID_LANDMARKS`, `EXPANSION_CHARACTERS.snowKid`, `EXPANSION_ASSETS.pineTree`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useFx` (`warm`, `burst`, `score`, `shake`), `SnowFall`, `SkyDome`, kit `Fence`, `TargetMarkers`, `useQuality` / `scaledCount`, `startLoop` / `playSfx`, `withinServerLimits` / `capScore`. Tests: `createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`, `createGrid`, `freeGrid`. All of these exist on `origin/main`, including `lighting: "snow"`. Nothing generic is planned in the game folder: the yard generator, the FSM and the crouch/throw poses are the game.

## Assets

| id | class / source | size | fallback |
|---|---|---|---|
| snowKid ×4 | A, `EXPANSION_CHARACTERS.snowKid`, owned GLB already imported | 1.30 m, scale `1.3/1.9011`, capsule r 0.35, ≤ 20k tris / 1024 / 1.5 MB | capsule, team scarf drawn on the stand-in too |
| pineTree ×10 | C, `EXPANSION_ASSETS.pineTree` (shared, not in `assets.spec.json`) | committed 4 m; spot `scale` 0.75–1.25 and `rotY` → 3–5 m | cylinder + cone, trunk r 0.30 |
| beanie + scarf | B, procedural, one mesh per kid on `attach.head` / `attach.chest` | player `#38bdf8`, thrower `#f87171`, dodger `#4ade80`, sneaker `#fb923c` | same mesh on the capsule |
| forts, snowman, balls, ring, ground, footprints | B, code | fort 1.80 × height × 1.80; ball Ø 0.50; roller Ø 0.90 | (they are the mesh) |
| fence | B, kit `Fence` | height 1.10 around the yard | (kit) |

The kid GLB is not tinted and has no `material` override: a tint would paint the face. Team colour is the attachment mesh's own material. `assets.spec.json` records the existing snowKid recipe only and does not authorise another generation. The face concept stays out of git. Pines, beanies and the yard are not owned GLBs. Changed from spec: height 1.30 m, was 1.25, because `EXPANSION_CHARACTER_HEIGHT.snowKid` and `SNOW_KID_LANDMARKS` are already committed (`armRadius` 0.115 for the puffy sleeves, `ankleY` 0.194 so the boots stay rigid).

## Files

`meta.ts` · `index.tsx` · `rules.ts` · `rules.test.ts` · `poses.ts` · `poses.test.ts` · `assets.ts` · `assets.test.ts` · `Scene.tsx` · `Yard.tsx` · `Kids.tsx` · `Balls.tsx` · `Hud.tsx` · `Hud.module.css` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail and `tools/thumbs/inputs/snowball-battle.mjs` come with the build, not this design.

## Test plan

`rules.test.ts` ≤ ~600 lines. The whole snowball-battle vitest file stays under ~60 s: layout checks are pure; store bots are short samples, not 200 full 90 s runs (those cannot fit the time). Pins kill a mutated constant even when a derived check would still pass.

- Pin `YARD`, `KID`, `SCOOP`, `THROW`, `FORT`, `AI`, `SCORE` and the limit numbers by value. 200 seeds: deterministic, 7 forts, gaps, flood-fill, a ≤ 6 m LOS pocket per peek, fallback valid and unused. One reject fixture per rule.
- Scoop 0.49 / 0.50 / 1.49 / 1.50; ammo stops at 3; a big launch adds no small; throw gap 0.40; no throw without a highlight. Flight 0.65 at 6 m and 0.85 at 14 m. Cone edges 38°. Lead point clamped.
- A fort between thrower and target: the ball overlaps the fort, never the target, including a roller. Height steps 1.40 / 0.95 / 0.55; 0 HP blocks neither sight nor feet. LOS lost at release spawns no ball. Dodge inside 1.00 m after the reaction; a wind-up does not dodge. Open time ≤ 2.00 s. One wind-up before 60 s, two after. Sneaker absent at 9.99 s and present at 10.
- Tags only in wind-up; the ninth tag wins; the fifth player tag loses; same-substep player ball wins the tie; time-up at 90 keeps the bank and pays no +500. `runScore` endpoints. The 1.85 / 3.20 / 27.45 / 17.45 arithmetic. Every prefix passes `withinServerLimits`; a 2550 at 14 s fails; `capScore` is a no-op on legal ends.
- Store, via `simulateRun` + `fixedFrames(50)` (20 fps): witness 8 seeds × keyboard and coarse, all win ≤ 85 s with ≥ 1 health; perfect bot 8 seeds, win ≥ 27.45 s, score ≤ 2550; idle, camper, spinner 4 seeds each, score 0, no win; spammer 8 seeds, no win, score ≤ 700. One `randomFrames` seed per bot repeats for determinism. If the file exceeds ~60 s, drop witness seeds to 4 and say so; do not drop the pins or the fort-tunnel test.
- `poses.test.ts`: soles within 1 cm in walk, crouch, throw blend and cheer on the real mesh; the throw blend goes through `carryPose` so the hand stays inside half the T reach; `gaitPhaseStep` at 4.5 m/s with cadence 4 does not slide the planted foot (if the cap bites, lower the amount curve). `assets.test.ts`: drawn height 1.30 m ± 1 cm, attachment anchors within 1 cm through the crouch.

## Performance

Target **42** draw calls, game cap **60** (the spec's perf line), platform cap 150. Budget: 4 skinned kids ≤ 8, one beanie+scarf mesh per kid = 4, pines 1, forts 1, snowman 2, fence 2, ground 1, snow 1, sky 1, ball pool 1, roller pool 1, rings 1, blob shadow 1, fx ≤ 4, score sprites ≤ 2 → about 31, with 11 spare for a GLB that splits. Lights: the `snow` preset only. Pools fixed at mount (`fx.warm("puff","debris","sparkle","confetti","score")`); ball matrices and the AIS scratch are allocated once. No per-frame allocation, no React state per frame, HUD writes on change. `scaledCount` cuts snow, footprints and confetti only. Retry ×10 must keep geometries flat.

## Audio

`startLoop("ambient", { volume: 0.12 })` each time the phase enters `playing`, including the frame after pause or unmute; the shell's `stopAllLoops` on pause, mute and over means the next entry creates one new handle and never a second live one. Scoop `thud` (pitch 0.7); throw `whoosh`; your tag is a mint ring plus `chime`; you being tagged is a coral flash plus `hit`; crumble `thud` (pitch 0.5); win is confetti plus the shell's `win`. `audio.ts` has no crunch or splat name. Mute keeps the rings, the mittens and the raised arm.

## Accessibility

The highlighted rival gets a ground ring and, when off screen, a 28 px arrow. Incoming balls draw the landing ring, a shape as well as a colour. Wind-up holds the arm up for the whole 1.20 s. Health is five mittens plus the count; ammo is three dots plus the count. The mittens panel is `#0f172a` under the shell chips (`data-arcade-safe-area`), text `#f8fafc` (above 4.5:1 on that panel), ≥ 14 CSS px. Scoop and the joystick are the shell's 72 px targets. `fx.shake` honours reduced motion; the rings and the kids keep moving. The witness bot finishes the fight on keyboard and on touch.

## Risks and open questions

- The px table uses assumed rects. A taller real banner means a smaller window, decided in the build, still with the kid and the ball ≥ 24 px.
- Witness, perfect and degenerate bots are acceptance gates. No measurement is claimed here. A witness that loses means the wind-up or the flight clamp changes in the open, with the limit proof redone.
- Gait at 4.5 m/s on the snow kid's short stride may hit cadence 4; `poses.test.ts` decides the amount curve.
- Personality is fort choice only. Different timers per role would make the 27.45 s bound seed-dependent.
- Open questions: none for the user. Claude copies the scoring block into `arcade-games.json` at merge (`enabled: false`); this design cannot edit that file. The snowKid GLB, landmarks and `snow` preset are already on `origin/main`.

## Status

G0 design only. Not built. `status` stays `"dev"`.
