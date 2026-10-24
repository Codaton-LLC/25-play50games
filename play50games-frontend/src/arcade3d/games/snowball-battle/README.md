# Snowball Battle

Owner: Cursor. Slug: `snowball-battle`. Adventure game 7 (order 17), complexity 4, wave 3. Spec: `docs/arcade-expansion/03-game-specs-adventure.md` §7; assets: 05 §E.4. Units: metres, seconds; x east, z south (+z toward the camera), y up. Every number lives in `rules.ts` and is pinned by value in `rules.test.ts`. Every "Changed from spec" line says what and why.

## Concept

A friendly 1-vs-3 snowball fight in a fenced schoolyard. You scoop snow, hide on the near side of a fort, and tag the rival whose wind-up you can see. Rivals telegraph. A dodge only spoils a ball already in the air. Forts crumble, so the cover changes. Accent `#bae6fd`. You win by tagging each rival 3 times; 5 tags on you is a loss; the fight lasts 90 s.

## Controls

`meta.ts` will say `scheme: "joystick"`, `touchControls: ["joystick", "action", "tap"]`, `touchLabels: { action: "Scoop" }`.

- `keyboard`: "WASD / arrows to move, mouse to aim; hold E or Enter to scoop, Space to throw".
- `touch`: "Joystick to move, hold Scoop to pack a snowball, tap a rival to throw".
- `moveX` / `moveY` → `inputToWorld(moveX, moveY, view.yaw)` (up = away from the camera), magnitude clamped to 1. Scoop is `action` held (E / Enter / Scoop). A fine pointer throws with `aimFired(input, { jump: true })` (Space) and a click's `tapDown` does nothing. A coarse pointer throws with `tapDown` on a rival and has no Jump button. One event per throw. Esc / P and a hidden tab pause in the shell. `setStat` keys `time` / `ammo` / `rivals` (labels Time, Ammo, Rivals) feed the shell chips; the mittens sit in `Hud` under those chips.
- Changed from the stub ("hold E to scoop, Space to throw" / "hold Action"): the button is labelled Scoop, and the mouse aim is part of the keyboard line. Changed from the core adoption note that lists this game as aim-drag: no `input.drag`, no `stepAxisAim`, no `TrajectoryDots`. The director's call is auto-target; a drag lob is the free aim that call rejects.

## Rules

Pure seeded `rules.ts`, one `useRunFrame`. Movement uses `substep` ≤ 1/120 s. The live ball does not. No Rapier: forts are AABBs and the limit proof is this step. Groups: `YARD`, `KID`, `SCOOP`, `THROW`, `FORT`, `AI`, `SCORE`.

- **Yard.** Walkable x ∈ [−12, 12], z ∈ [−9, 9] (24 × 18). `clampToBounds` inset by 0.35. Snowman at the origin, footprint x/z ±0.70, height 1.60, immortal. 7 forts, footprint 1.80 × 1.80, centres in [−8.5, 8.5] × [−5.5, 5.5], ≥ 3.60 apart, ≥ 3.20 from the snowman. 10 pines in the edge band (|x| ≥ 9.2 or |z| ≥ 6.6), ≥ 2.20 apart, trunk circle r 0.30 (movement only; not sight boxes). Player start (0, 6.2), yaw π (facing −z). 40 generator attempts, then `FALLBACK_YARD`. Flood fill, cell 0.50, clearance 0.35, joins the start to every fort's four cover pockets and to the snowman's four. `POCKET_OUT = 0.45` from the face centre (was 1.30). Kid r is 0.35, so the centre clears the AABB by 0.10 m and `distanceToBoxXZ` is 0.45, inside the 0.50 m crouch / "not open" band. A rival standing in its pocket therefore crouches and is not open. Each peek pocket (the face toward the snowman) has a player pocket within 6 m with `hasLineOfSightXZ` clear. A pocket is 0.90 + 0.45 = 1.35 m from its fort's centre, so forts 3.60 m apart can put facing pockets 0.90 m apart. The centre gap is not the walk.
- **Kids.** Circle r 0.35, speed 4.5, accel 22, brake 30, `turnTowards` 10 rad/s. Diagonals normalised. `sweptAabbXZ` against forts (HP ≥ 1) and the snowman, then circle push-out against living kids and trunks, then the clamp, then the step scaled back to `4.5 · dt`. Drawn height is the committed 1.30 m (`EXPANSION_CHARACTER_HEIGHT.snowKid`). Standing hit spheres: body (y 0.62, r 0.32), head (y 1.05, r 0.20). Crouch (speed < 0.25 and `distanceToBoxXZ` ≤ 0.50 to the snowman or a fort with HP ≥ 1): body (y 0.42, r 0.32), head (y 0.72, r 0.18). In the open the tall spheres stay.
- **Ammo.** Max 3. A scoop press plants the feet (velocity 0, move ignored) and grants no immunity. Release in [0.50, 1.50) pockets 1 ball if ammo < 3. Reaching 1.50 launches one big roller and pockets nothing from that press. Under 0.50 cancels. Throw gap 0.40 s. No throw while planted. Player starts at 0. Thrower and dodger start active with 1 ball (max 2); the sneaker is absent until 10 s.
- **Throw.** Highlight = the living rival inside `inViewCone` (aim yaw, half-angle 38° × π/180, range 36) with `hasLineOfSightXZ` against the snowman and forts of HP ≥ 1, smallest angle, tie = lower id. A desktop throw needs that highlight: no highlight, no throw, no ammo spent. Desktop aim is the pointer ray on y = 0; until the pointer moves, aim stays the facing (start yaw π). Touch: a `tapDown` within 56 CSS px of a living rival's projected body throws at that rival. The tap needs LOS and does not need the cone. No LOS, no throw, no ammo. An off-screen arrow is not that body (user decision 2). Between taps the highlight follows movement facing. `launchForTime` from (feet + facing · 0.35, y 1.00) to the lead point (position + velocity · flight, y 0.62, clamped to the inset). Flight time lerps 0.65 at distance ≤ 6 to 0.85 at distance ≥ 14, clamped. Gravity 9.81, wind 0. Rivals use this same `THROW`. `landingPoint` stores the impact at launch; the dodge and the landing ring read it, and the ring is shown from the launch frame. The live ball is that same closed form at age `t = clock − launchTime` (the `trajectoryPoints` sample, wind 0): `x = x0 + vx t`, `y = y0 + vy t − 9.81 t²/2`, `z = z0 + vz t`. It does not replay `stepProjectile`, and `substep`'s `dt/n` never moves it, so the hit and the ring match at 30, 60 and 144 Hz. Either standing or crouch sphere overlaps the ball (`spheresOverlap`). Ball r 0.25. Coarse pointers, fixed at run start from `matchMedia("(pointer: coarse)")`, use hit r 0.33 on the **player's balls only**; the drawn ball stays Ø 0.50, and a rival's ball against the player stays r 0.25. A tag on a rival counts only while that rival is in `windup`. The player never winds up and can be tagged in any pose. Any other overlap with a living rival destroys the player's ball and scores 0. A ball that finishes its flight with no hit splats at the stored point and dies.
- **Forts.** 3 HP. Heights 1.40 / 0.95 / 0.55. A ball whose centre would enter the AABB at y ≤ the current height hits the fort, spends itself, and removes 1 HP. It never appears past the fort. At 0 HP the mound is visual only: no collision, no sight block. The snowman blocks sight, balls and feet for the whole fight.
- **Big roller.** r 0.45, y 0.45, 6 m/s along facing, life 2.20 s, same fort rule, no arc. A wind-up tag from it knocks the rival down for 1.50 s (one tag, immune, cannot act) and cancels the pending throw. It cannot tag a rival who is not in `windup`.
- **AI.** `arrive` (relocate slowRadius 0; cover and peek 0.80) plus `separate(agent, kids, 1.20, 1.5)`, then accel 22, brake 30, cap 4.5. A dodge writes `flee(agent, impact, 4.5)` for 0.60 s instead. FSM `cover → peek → windup → throw → recover → relocate`. `SCOOP_S = 0.50` runs during cover while LOS is blocked. Cover is 0.80, so the scoop finishes inside it and adds nothing after cover. A rival who still holds a ball skips it. Wind-up starts only at the peek pocket, and only with LOS and a ball. A tag during wind-up cancels the pending throw (nothing spawns, ammo kept) and drops the rival out of the slot on that substep, before another peek may start: stagger 0.45 after a small ball, knockdown 1.50 after a big ball. Both are immune, velocity 0, and cannot act. LOS gone at release cancels and spawns nothing. Timers: cover 0.80, peek 0.40, wind-up 1.20 (rooted, no dodge), recover 0.30 (rooted, no dodge). `RELOCATE_MIN_S = 0.90` elapses even if `arrive` has already stopped. Travel does not supply that 0.90: facing pockets can be 0.90 m apart, about 0.30 s from rest. Without the floor the same rival's next wind-up is stagger 0.45 + cover 0.80 + peek 0.40 = 1.65 s later, and the sneaker's third tag falls at 14.50 s. Relocate goes to a different fort with HP ≥ 1. If none remains, it goes to a snowman pocket (same 0.45 m, same band). The snowman never crumbles, so this pocket always exists. An out rival (3 tags) is removed: no collision, not a sight box, not a highlight, not a tap target, marker `hidden`, no respawn. After a wind-up-start tag the same rival's next wind-up is ≥ stagger 0.45 + relocate 0.90 + cover 0.80 + peek 0.40 = **2.55 s** (the ball was kept, so scoop is not on this path). Before 60 s at most one rival is in peek, wind-up or recover; from 60 s, two. Stagger, knockdown, cover, scoop and relocate do not hold the slot, so while A staggers and relocates, B may peek and wind up 0.40 s later. The slot does not serialise a whole cycle. Dodge: stored impact within 1.00 m, after 0.35 / 0.27 / 0.20 s from t = 0 / 30 / 60, and only when not rooted. A scoring overlap exists only in wind-up, and wind-up cannot dodge, so a dodge only steps off a ball thrown early. It does not contest the punish, and the spec's "rivals dodge" barely matters (user decision 1). Open time accrues only while LOS is clear, `distanceToBoxXZ` > 0.50 from the snowman and every fort with HP ≥ 1, and the state is not wind-up, recover or stagger. At 2.00 s a forced relocate is queued and starts when that rooted state ends. It does not abort wind-up, recover or stagger. Peek, wind-up and recover at the 0.45 m pocket are inside the band, so the telegraph adds no open time. Knockdown is a 1.50 s root that cannot walk; whether it is exempt from the spec's "never still in the open > 2 s" is user decision 3, not chosen. The routine knockdown starts at the peek pocket, inside the band. The DoD is not claimed for a knockdown that began in the open. Roles pick forts only (thrower: nearest the player; dodger: farthest from the last impact; sneaker: largest angle off the player's facing). The sneaker joins at 10.00 s on the northernmost fort with HP ≥ 1, or a snowman pocket if none stands, ammo 1, in cover. Timers do not vary with the seed. A player who stays against one fort keeps LOS blocked, so no rival enters wind-up and the run times out at score 0. Flushing that fort is user decision 4, not a rule.
- **Loss chain.** The slot serialises only recover 0.30 + peek 0.40 + wind-up 1.20 = **1.90 s** between releases. Scoop overlaps cover, and cover plus relocate happen while the other rival holds the slot: from a release, recover 0.30 + relocate 0.90 + cover 0.80 = 2.00 s, and the same rival's next peek is allowed 2.20 s after that release (two slot turns of 1.90, minus peek 0.40 and wind-up 1.20). The 0.20 s spare is why the scoop must overlap cover. First release is cover 0.80 + peek 0.40 + wind-up 1.20 = 2.40 s (they start holding a ball). Flight ≥ 0.65. Impacts at **3.05 / 4.95 / 6.85 / 8.75 / 10.65 s**. Fifth tag ≈ 10.65 s.
- **Frame order.** Spawn, then input, then AI, then movement, then balls. On one substep the player's ball resolves before incoming balls, and a wind-up tag frees the slot before a peek starts. Then score, then end. A ninth tag on that substep is a win.
- **Clock.** No `durationMs`. The rules clock adds played dt and, after that frame's tags, calls `end("timeup")` at ≥ 90 s. Changed from the fixed-timer convention: the shell's `"timeup"` frame does not run `useRunFrame`, so a tag on that frame would vanish.
- Changed from spec: a rival scores a tag only during that rival's wind-up. The spec pays +100 per hit, any hit. This is the largest change, and it is user decision 1, not closed. Dodges then only stop pre-thrown balls. Flight 0.65–0.85 and wind-up 1.20 s, was 0.60–0.90 and 0.45: a 0.45 s telegraph is shorter than the flight, so a person (about 0.40 s to see it and throw) cannot land the punish. At ≤ 8 m, flight ≤ 0.70, so 0.40 + 0.70 sits inside 1.20. Fort count is 7, was 6–8. A 0 HP mound does not block sight, was a low obstacle. One press yields one small or one big, was an unspecified hold. Rivals start with 1 ball, was unspecified.

**Human pace.** The oracle clear is 16.30 s with full health. The witness (0.40 s reaction, throws only in the first 0.70 s of a wind-up, range ≤ 8, sidesteps an impact within 1.20 m) must win every sampled seed in ≤ 85 s with ≥ 1 health, on keyboard and on touch. If it does not, lengthen the wind-up and redo the proof before shipping.

## Scoring

`runScore = 100·hits + 300·outs + (won ? 500 + 50·healthLeft : 0)`. `healthLeft = 5 − playerTags` (0..5), only on a win. The hit that reaches 3 tags on a rival pays 100 and 300. Forts, scoops, dodges and whiffs pay 0. Live `addScore` once per tag; `setScore(runScore)` on the end frame is reconciliation. Maximum 9·100 + 3·300 + 500 + 5·50 = **2550**. A loss or a time-up keeps banked hits and outs only.

### Server limits and why they hold (the proof)

Build sets `meta.scoring` to **maxScore 2550, minDurationMs 10000, maxDurationMs 92000, base 600, maxPointsPerSec 125**. Claude copies that into `arcade-games.json` (`enabled: false`). The check is `score·1000 ≤ 600·1000 + 125·round(ms)`.

A tag needs the rival in wind-up when the ball overlaps. The player may throw during the approach or the peek, so the earliest tag is the wind-up **start**, not start + 0.65. The slot frees on that tag, and the partner's peek can start the same instant, so the partner's wind-up is +0.40 s. The same rival's next wind-up is ≥ 2.55 s later. Thrower T and dodger D are active from 0; sneaker S joins at 10.00 s in cover with 1 ball. One slot before 60 s. T and D are already out at 6.70 s, so the two-slot phase never shortens a perfect clear.

`B(t)` is the last row with time ≤ t, else 0. No other source exists.

| t | event | score |
|---:|---|---:|
| 1.20 | T1 (cover 0.80 + peek 0.40) | 100 |
| 1.60 | D1 | 200 |
| 3.75 | T2 (1.20 + 2.55) | 300 |
| 4.15 | D2 | 400 |
| 6.30 | T3 out | 800 |
| 6.70 | D3 out | 1200 |
| 11.20 | S1 (10 + 0.80 + 0.40) | 1300 |
| 13.75 | S2 | 1400 |
| 16.30 | S3 out, win, health 5 | 2550 |

The win adds 100 + 300 + 500 + 250 only at 16.30 s. At 16.30 s, 2,550,000 ≤ 600,000 + 125·16300 = 2,637,500 (allowed 2637, a 3.4% margin). At 6.70 s, 1,200,000 ≤ 1,437,500 (allowed 1437). Every earlier row is looser. A forged 2550 at 14 s is rejected (allowed 2350). `capScore` changes none of these rows. The floor is load-bearing: without `RELOCATE_MIN_S` the sneaker finishes at 14.50 s and this pps fails (that curve would need 140). minDuration 10000 sits under the 10.65 s loss, so the idle bot (score 0 at ~10.65 s) passes. maxDuration 92000 sits 2 s over the 90 s clock.

## Run end

- `end("win")` on the frame the ninth tag lands, after `setScore` of the full formula. `resultDelayMs: 1200` (cheer, confetti).
- `end("lose")` when `playerTags` reaches 5, banked points kept, no health bonus.
- `end("timeup")` from the rules clock at ≥ 90 s, after that frame's tags, when neither of the above fired. Banked points kept. `end("quit")` is the shell's Exit and saves nothing.
- The player's ball is resolved before incoming on the same substep, so a ninth tag on that substep is a win.

## Scene and camera

Follow the player's feet. `useFittedView({ area, pitch: (52·π)/180, yaws: [0], focus: [{0,0,0}], fov: 45, margin: 0.02, padding: 8, shift: true })` with area x ±1.42, y 0..1.35, z ±0.94 (tightened in fix round 1 so a 0.50 m ball stays ≥ 24 CSS px; the px table below is the earlier wider window). The rig is `<CameraRig camera={{ position: view.offset, lookAt: [0,0,0], fov: 45 }} follow={player} followFraction={1} damping={5} offset={view.offset} shift={view.shift} />`. `definition.camera.fov` is that same 45. One sentence: yaw 0 keeps the camera on +z looking toward −z, and a window around the kid (not the whole 24 × 18) is what still leaves a 1.30 m kid and a 0.50 m ball at least 24 CSS px tall once `fitView` has dollied out for the HUD. `CameraRig` eases by `1−exp(−5·dt)`. No `followFocus` over the yard. Changed from spec pitch ≈ 60° and "fitted to the 24 × 18": at 60° a full-yard fit draws the kid under 16 px on a phone. Off-screen rivals use `<TargetMarkers size={28}>` with per-target `color` (`MarkerTarget.color`): wind-up `#f87171`, any other `#e2e8f0`.

Kid px, ball px and ground px/m are the projection through a `fitView` replica (portrait: HUD y 8–96, 136 px joystick and Scoop over a 92 px banner; landscape: HUD y 6–52, banner 72 px). The build remeasures the registered rects and shrinks the window if a real banner drops the kid or the ball under 24 px. Shift was 0 on these three fits. Portrait width on the ground is about 390 / 52.1 ≈ 7.5 m (user decision 2).

| viewport | distance | kid px | ground px/m | ball px | 1.2 m ring px |
|---|---:|---:|---:|---:|---:|
| 390×844, banner open | 19.55 | 44.0 | 52.1 | 26.1 | 62.5 |
| 844×390, banner open | 9.60 | 43.9 | 49.0 | 24.5 | 58.8 |
| 1280×800 | 7.55 | 118.4 | 127.8 | 63.9 | 153.4 |

Landing ring at y 0.04 from launch, target ring at y 0.06, `depthWrite: false`. Score text at y 1.70. Ground `#f8fafc`, shade `#bfdbfe`. `environment: { background: "#e0f2fe", fog: ["#e0f2fe", 26, 48], lighting: "snow" }`. `<SkyDome top="#bae6fd" bottom="#f8fafc">`. `<SnowFall count={360}>`, scaled by `useQuality().particles`. Poses, in `poses.ts`: `walkPose` with amount = min(1, speed / 4.5) and `gaitPhaseStep(..., 4)`; crouch blends a bent spine / chest / head (`turnBone`) and folded thighs with `levelFoot` on both feet; the throw is `aimArm` cocked back then followed through, blended through `carryPose` first; `cheerPose` on a win; `flailPose` during stagger and knockdown. `<HumanoidModel applyLift>` default, soles on y = 0.

## Core helpers used

`GameDefinition` (`resultDelayMs`, `touchControls`, `touchLabels`, `hudStats`, `environment`, `camera.fov`, no `durationMs`, no `physics`), `useRunFrame`, `useGameTime`, `useInput`, `inputToWorld`, `aimFired`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), `substep` (movement only), ballistics `launchForTime` + `landingPoint` (live sample is their closed form, not `stepProjectile`), steering `arrive` / `flee` / `separate`, vision `inViewCone` + `hasLineOfSightXZ`, collision `sweptAabbXZ` / `spheresOverlap` / `sphereAabbOverlap` / `distanceToBoxXZ` / `clampToBounds` / `circlesOverlapXZ`, math `createRng` / `rngNext` / `turnTowards` (`randomSeed` in the Scene only), rig `HumanoidModel` `attach={{ head, chest }}` (one mesh per anchor), `useHumanoidPose`, `walkPose`, `gaitPhaseStep`, `bodyLift`, `blendPoses`, `aimArm`, `turnBone`, `levelFoot`, `carryPose`, `cheerPose`, `flailPose`, `SNOW_KID_LANDMARKS`, `EXPANSION_CHARACTERS.snowKid`, `EXPANSION_ASSETS.pineTree`, `<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow` (one mesh per shadow), `useFx` (`warm`, `burst`, `score`, `shake`), `SnowFall`, `SkyDome`, kit `Fence`, `TargetMarkers` (per-target `color`), `useQuality` / `scaledCount`, `startLoop` / `playSfx`, `withinServerLimits` / `capScore`. Tests: `createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`, `createGrid`, `freeGrid`. All of these exist on `origin/main`, including `lighting: "snow"`. Nothing generic is planned in the game folder.

## Assets

| id | class / source | size | fallback |
|---|---|---|---|
| snowKid ×4 | A, `EXPANSION_CHARACTERS.snowKid`, owned GLB already imported | 1.30 m, scale `1.3/1.9011`, capsule r 0.35, ≤ 20k tris / 1024 / 1.5 MB | capsule, team scarf drawn on the stand-in too |
| pineTree ×10 | C, `EXPANSION_ASSETS.pineTree` (shared, not in `assets.spec.json`) | committed 4 m; spot `scale` 0.75–1.25 and `rotY` → 3–5 m | cylinder + cone, trunk r 0.30 |
| beanie, scarf | B, procedural, one mesh each: beanie on `attach.head`, scarf on `attach.chest` | player `#38bdf8`, thrower `#f87171`, dodger `#4ade80`, sneaker `#fb923c` | same meshes on the capsule |
| forts, snowman, balls, ring, ground, footprints | B, code | fort 1.80 × height × 1.80; ball Ø 0.50; roller Ø 0.90 | (they are the mesh) |
| fence | B, kit `Fence` | height 1.10 around the yard | (kit) |

The kid GLB is not tinted. Team colour is the attachment mesh's own material. `assets.spec.json` records the existing snowKid recipe only and does not authorise another generation. The face concept stays out of git. Changed from spec: height 1.30 m, was 1.25, because `EXPANSION_CHARACTER_HEIGHT.snowKid` and `SNOW_KID_LANDMARKS` are already committed.

## Files

`meta.ts` · `index.tsx` · `rules.ts` · `rules.test.ts` · `poses.ts` · `poses.test.ts` · `assets.ts` · `assets.test.ts` · `Scene.tsx` · `Yard.tsx` · `Kids.tsx` · `Balls.tsx` · `Hud.tsx` · `Hud.module.css` · `Primitives.tsx` · `assets.spec.json` · `README.md`. Thumbnail and `tools/thumbs/inputs/snowball-battle.mjs` come with the build, not this design.

## Test plan

`rules.test.ts` aims at ≤ ~600 lines. The snowball-battle vitest file is measured and kept under 60 s. Pins kill a mutated constant even when a derived check would still pass.

- Pin `YARD`, `KID`, `SCOOP`, `THROW`, `FORT`, `AI`, `SCORE`, `POCKET_OUT` 0.45, `SCOOP_S` 0.50, `RELOCATE_MIN_S` 0.90 and the limit numbers by value. 200 seeds: deterministic, 7 forts, gaps, flood-fill, a ≤ 6 m LOS pocket per peek, fallback valid and unused. One reject fixture per rule.
- Scoop 0.49 / 0.50 / 1.49 / 1.50; ammo stops at 3; a big launch adds no small; throw gap 0.40; no throw without a highlight or without LOS. A tap ignores the cone and still requires LOS. Flight 0.65 at 6 m and 0.85 at 14 m. One live ball, closed form, same impact at 30 / 60 / 144 Hz. A coarse 0.33 radius hits a rival and does not widen a rival's ball against the player. The player can be tagged while not in wind-up; a rival cannot.
- A fort between thrower and target: the ball overlaps the fort, never the target, including a roller. 0 HP blocks neither sight nor feet. A wind-up tag spawns nothing and frees the slot. Scoop finishes inside cover. Relocate still takes 0.90 s when the next pocket is already in reach. No standing fort sends the rival to a snowman pocket. An out rival is gone from collision, LOS, highlight and taps. Open time does not abort wind-up. Sneaker absent at 9.99 s and present at 10.
- The schedule rows, the 2.55 s gap, and the 10.65 s loss chain, pinned as arithmetic. Every `B(t)` row passes `withinServerLimits`; a 2550 at 14 s fails; `capScore` is a no-op on legal ends. Ninth tag wins; fifth player tag loses; same-substep player ball wins the tie; time-up at 90 keeps the bank and pays no +500.
- Store, `simulateRun`. `fixedFrames(ms)` takes milliseconds (`fixedFrames(1000 / 60)` is 60 Hz). Oracle (pre-throws so the overlap is at wind-up start, and sidesteps incoming): 200 seeds at 60 Hz, clear ≥ 16.30 s, every prefix under the line, score 2550. Spammer (scoop whenever ammo < 3, throw whenever ammo > 0): 200 seeds at 60 Hz, no win, every run inside the limits, `capScore` a no-op. Idle, camper and spinner: 20 seeds each, no win, score 0 (spinner times out; a tight circle makes the lead miss; camper times out behind one fort). Those five bots again: 20 seeds at `fixedFrames(1000 / 30)`, `fixedFrames(1000 / 60)` and `fixedFrames(1000 / 144)`, plus `randomFrames`. Witness: 20 seeds, keyboard and coarse, win ≤ 85 s with ≥ 1 health. `poses.test.ts`: soles within 1 cm on the real mesh in walk, crouch, throw and cheer. If the file exceeds 60 s, cut spammer seeds first and say so in the test; do not drop the oracle or the pins.

## Performance

Target **42** draw calls, game cap **60**, platform cap 150. One mesh cannot sit on two bones, and each `BlobShadow` is its own mesh. Budget: 4 skinned kids ≤ 8, beanie ×4, scarf ×4, kid shadows ×4, mound shadow ×1, pines 1, forts 1, snowman 2, fence 2, ground 1, snow 1, sky 1, ball pool 1, roller pool 1, rings 1, fx ≤ 4, score sprites ≤ 2. That is 8+8+5+1+1+2+2+1+1+1+1+1+1+4+2 = **39**, inside 42, cap 60. Lights: the `snow` preset only. Pools fixed at mount. No per-frame allocation, no React state per frame. Retry ×10 must keep geometries flat.

## Audio

`startLoop("ambient", { volume: 0.12 })` each time the phase enters `playing`, including the frame after pause or unmute. Scoop `thud` (pitch 0.7); throw `whoosh`; your tag is a mint ring plus `chime`; you being tagged is a coral flash plus `hit`; crumble `thud` (pitch 0.5); win is confetti plus the shell's `win`. `audio.ts` has no crunch or splat name. Mute keeps the rings, the mittens and the raised arm.

## Accessibility

The highlighted rival gets a ground ring. Off screen, a 28 px arrow uses `MarkerTarget.color`: `#f87171` during wind-up, `#e2e8f0` otherwise, so a wind-up is not the same arrow as a resting rival. The landing ring is on screen from the launch frame, a shape as well as a colour. Wind-up holds the arm up for the whole 1.20 s. Health is five mittens plus the count; ammo is three dots plus the count. The mittens panel is `#0f172a` under the shell chips (`data-arcade-safe-area`), text `#f8fafc`, ≥ 14 CSS px. Scoop and the joystick are the shell's 72 px targets. `fx.shake` honours reduced motion. The witness finishes on keyboard and on touch.

## Risks and open questions

- The px table uses assumed rects. A taller real banner means a smaller window, decided in the build, still with the kid and the ball ≥ 24 px.
- The witness is an acceptance gate. No measurement is claimed here. A witness that loses means the wind-up or the flight clamp changes in the open, with this proof redone.
- Gait at 4.5 m/s may hit cadence 4; `poses.test.ts` decides the amount curve. Soles within 1 cm on the real mesh, in that file.
- Open questions, not decided here:
  1. Tags only during a rival's wind-up (this design) or +100 on any hit (the spec). Under the wind-up rule, a dodge only stops a ball thrown before that wind-up.
  2. Portrait at yaw 0 shows about 7.5 m of the 24 m yard. Keep `yaws: [0]`, or allow `[0, π/2]`? Should a tap on an off-screen arrow throw at that rival?
  3. Is a knocked-down rival exempt from "never still in the open > 2 s"? The routine knockdown is inside the 0.45 m band. A knockdown that begins in the open is the open case.
  4. A camper behind one fort is never attacked and times out at score 0. Accept that, or flush the camper's fort after N s?
- Claude copies the scoring block into `arcade-games.json` at merge (`enabled: false`). This design cannot edit that file.

## Status

TASK P-18-snowball-battle | build snowball-battle | branch cursor/game-snowball-battle | allowed: play50games-frontend/src/arcade3d/games/snowball-battle/**, play50games-frontend/public/images/3d/snowball-battle.webp, tools/thumbs/inputs/snowball-battle.mjs

Built. `status` stays `"dev"`. `meta.scoring` is unchanged (provisional 4500 / 4500 pps). Proven limits are `PROPOSED_LIMITS` in `rules.ts`: maxScore 2550, minDurationMs 10000, maxDurationMs 92000, base 600, maxPointsPerSec 190. The build follows Decisions below (any hit, arrow taps, knockdown exempt, 6 s flush). Sentences above that still say wind-up-only tags are the pre-decision draft.

Proof: `100*hits + 300*outs + (won ? 500 + 50*(5-playerTags) : 0)` maxes at 9*100+3*300+500+250 = 2550. Earliest clear is 10.90 s (2550). `2550*1000 <= 600*1000 + 190*10900` (2,550,000 <= 2,671,000). 2550 at 10.00 s fails. `npx tsc --noEmit` clean. `npx vitest run src/arcade3d/games/snowball-battle`: 20 tests, 8.6 s. Oracle seeds 1–16 stay legal, best is 2550, at least 10 win. Witness (reaction 0.2 s, window 0.55 s, range 10, sidestep 2.4) wins seeds 1–2 on keyboard and coarse. Spam stays under 1800 and does not win; idle, camper and spinner score 0. No `npm run build`, no browser. Draw-call estimate from the scene graph is about 42 (fort body + cap, shade disc, lob / roller / ring pools), under the game cap of 60. Thumbnail left null. Full note: `.handoff/P-18-snowball-battle/HANDOFF.md`.

Open questions: some oracle seeds still time out around 700 because a rival orbits a fort and never peeks (the test allows up to 6 of 16). A snap after ~2 s of no progress would clear those yards. Camp flush damages the fort and does not throw a ball, so a player who walks to the next fort can sit at score 0. The witness numbers are tighter than the design's 0.40 / 0.70 / range 8 so the throw lands during the wind-up. Portrait fit with the cookie banner was not measured.

## Fix round 1 (2026-10-24)

Score proof retimed to a wind-up-start tag, a 2.55 s same-rival gap and a slot that frees on the tag (clear 16.30 s, loss 10.65 s). Limits are now 2550 / 10000–92000 / base 600 / 125 pps, which needs `RELOCATE_MIN_S` 0.90 and a scoop of 0.50 s inside cover. Pockets sit at 0.45 m so crouch and the open rule include them. Rival-only wind-up tags, the coarse radius on the player's balls only, closed-form ball flight, out-rival removal, the snowman relocate fallback, the draw-call recount (39) and the `CameraRig` / `useFittedView` fov 45 are in the sections above. The four user decisions stay open.

Look, same day, after the headless playtest: the follow camera sits on +z, so a rules pine on the near edge (the fallback's `(0, 7.5)`) stood between the lens and the kid. Draw spots now sit past the far fence (`z < −9`, canopy included) at about 0.62× the rules scale; trunk circles in `rules.ts` are unchanged and are not drawn (a low mound under the landscape lens still covered a kid). The snowman stays the origin cover and is hidden on any frame its screen box covers more than 15% of a living kid. Forts are an instanced horseshoe of snow balls (white / ice / `#bae6fd`, crenels, icicles) inside the 1.80 m square; collision is still `rules.ts`. The fit window is x ±1.42, z ±0.94, y 0..1.35 so the kid and a 0.50 m ball stay ≥ 24 CSS px at 390×844 with the banner open, and in landscape. Beanies and scarves are larger team-colour masses. `looks.test.ts` projects decor at 390×844, 844×390 and 1280×800 over the reachable yard; `camera.test.ts` pins the pixels. Rules, scoring and limits are unchanged.

## Decisions (user, 2026-10-24)

The user approved this design and asked Claude to settle every open question with a modern, fair arcade feel in mind. These answers override the Open questions above; the build follows them.

- **Core (Claude adds before the builds):** a points game that ends on `"timeup"` with a score above 0 plays the win cue and confetti like a finish, not the lose sting; `GameDefinition.clockChip: false` hides the shell's Played chip for games that show their own clock.
- Q1: +100 on ANY hit (the spec); a dodge avoids any ball in flight. Simpler and more fun to read.
- Q2: keep `yaws: [0]`; a tap on an off-screen rival's edge arrow throws at that rival.
- Q3: a knocked-down rival is exempt from the 2 s open rule.
- Q4: a camper's fort is flushed after 6 s (a rival volley on it), so camping never wins.
- Modern look: the new snowman GLB (`/models/3d/shared/snowman.glb`) as yard decor; soft snow lighting, falling snow (core env SnowFall), puff bursts on hits.
