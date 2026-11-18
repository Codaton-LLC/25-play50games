# Flooded Ruins Escape (Menu 2, game 03, World 2 Sky & Sea): FLOOD

Owner: Cursor (rebuilt by Claude to the approved super-game card). Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`).
Design card: `docs/menu2-super/world-2-sky-and-sea.md` game 3 (branch `claude/m2-super-plan`).
The hero is one of the five Color Roll Heroes armadillos (`menu2/heroModels.ts`); World 2's lead, **Nami**, is preselected.

## Concept and controls

Escape a drowned temple by deciding where the water goes. Stone levers set the water level of their
chamber: flood a trench and float up to a ledge you cannot jump to, drain one to walk under a low door.
Under water you swim (hold Jump to rise, let go to sink) on a 6 s air meter that bubble spouts refill.
Behind you the **storm tide** rises (0.25 m/s on level 1 up to 0.8 m/s on level 5): it is the escape
clock, and no lever can lower it. Every Menu 2 system is in: stars, the flow meter, secrets, XP, local
multiplayer, the free orbit camera, the shared hero picker, and a three-phase boss on level 5.

This game's verb is **FLOOD**. Sky Tower Jump gains height by bouncing, and Cloud Hopper glides across
the cloud sea. Here you gain height by flooding a chamber, and the question is always "which lever first".
`layouts.test.ts` checks that it plays like that.

- Keyboard: WASD / arrows move **camera-relative** (up = away from the camera). Space jumps, and holding it swims up. E or Enter is the hero power. Camera: drag, wheel, Q / Z and C / X turn, R / F tilt, V recenters (menu2/camera).
- Touch: the core joystick, Jump (hold to swim up) and Power. Two fingers turn the camera, a pinch zooms, and the round button recenters.
- **The same timing on both** (decision 7): one jump press and one action press, a 130 ms buffer and 100 ms coyote time.
- The hero picker (`menu2/heroes` HeroPicker) shows on the start card, in the pause menu and on the result screen. The pick is the next run's option.

## Files

| File | What |
|---|---|
| `meta.ts` | plain data: a time game, five levels with the card's names, collection `rollheroes`, order 53, status `dev` |
| `levels.ts` | the five level configs: timer, storm tide (rate, start, cap), boss flag |
| `ruins.ts` | the temple, level by level (pure data): blocks, chambers, levers, spouts, jets, whirlpools, bats, crates, orbs, secrets, the boss arena, and the honest bot's route |
| `progression.ts` | the flow meter, chain bases, star targets, secrets, and the boss config `UMBRA_ROLLER` |
| `heroes.ts` | the five heroes, power durations, the breach height, and the shared hero pick (`createHeroPick`) |
| `rules.ts` | pure rules: the water's closed forms, movement, swimming and air, levers, the tide, hazards, powers, the boss, the lower bound and `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, and `?autoplay=1` on preview builds) |
| `camera.ts`, `Scene.tsx`, `MultiScene.tsx`, `Course.tsx`, `World.tsx`, `Hero.tsx`, `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts`, `multiplayer.ts` | the orbit camera and intro, the simulation and juice, the drawn temple, the hero, the HUD, stars and progress, local multiplayer |
| `Water.tsx`, `waterLook.ts` | the water (look only): one shader for every surface (a small swell, two scrolling ripple normal samples, fresnel to the sky, a sun / moon glint, foam along a chamber's walls or, for the tide, from a canvas mask of the blocks it meets at its height), a body darker with depth, bubbles round a swimming hero, a teal tint while the camera is under a surface. Phones (water quality below "full") drop the swell and the second ripple layer and use a 512 px foam mask |
| `rules.test.ts` | mechanics, the hand-off, the lower bound, the pinned limits, honest, idle and spam bots, the real store, the camera-relative stick |
| `powers.test.ts` | the five hero roles, and one press with one timing |
| `layouts.test.ts` | FLOOD, not bounce or glide: the card's twist on each level, and the hero features per level |
| `proof.test.ts` | every hero with its power mashed, spam on all five levels, and mutation probes |
| `progression.test.ts` | the Menu 2 configs, secret placement, flow within its bound, the sunken shard, Umbra Roller |

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms with the fraction carried, and every arc,
swim and water level depends only on rules ms, the same at 30, 60 or 144 fps. No allocation after `createRun()`.

- **Hero:** a vertical cylinder (radius 0.32, height 1.2), feet at y. Run `V_RUN` 6.5 m/s (accel 50 on the ground, 32 in the air). Gravity 30, jump 14 m/s (apex `H_JUMP` 3.27 m).
- **The stick is camera-relative inside the rules.** `StepInput.yaw` is the orbit camera's `viewYaw`, and `step()` maps the stick with core `inputToWorld(moveX, moveZ, yaw)`. Bots and tests leave yaw at 0, where the stick is already in world space. Turning keeps the stick's length, so the speed bounds in the proof hold for any yaw.
- **Chambers and levers:** each chamber's water moves towards its target at `V_WATER` 0.8 m/s, a closed form of rules time (`zoneLevel`). Walking or swimming into a lever moves it to its next position, which sets the targets of the chambers it acts on. A lever re-arms once you step 1.5 m away. Levers cycle, so a wrong pull is undone by pulling again (no soft-lock). Level 2's levers are **linked**: lowering one chamber raises the next. Level 5's three pressure levers spring back after 5 s.
- **Swimming:** feet 0.5 m under the surface means swimming, at 4 m/s. Holding Jump rises at 1.2 m/s and letting go sinks at 0.9 m/s. A swimmer floats with the feet 0.55 m under the surface, and a Jump press there leaps out at full jump speed. A flooded block holds the feet.
- **Air:** while the head is under water the 6 s meter runs down, and at 0 the hero is lost ("air"). It refills at the surface, and at once inside a bubble spout.
- **Floating crates** (`m2FlyingCrate`, buoyant here): a crate's top floats 0.3 m over its chamber's water, between its resting top and its cap.
- **Storm tide:** it starts at its checkpoint (level 1: the switchbacks; level 2: the climb), after a delay (levels 3 and 4), or with the boss's third phase (level 5). It then rises at the level's rate. Touching it loses the hero ("tide"). If it covers the active checkpoint, the run ends **"flood"** (unranked). It never makes a finish faster.
- **Hazards:** steam jets (live for a fixed fraction of each cycle), cave bats (they swoop while their chamber's water is low), and whirlpools (they pull a swimmer in, and the core drags it under). Shield and phase ignore all three. Nothing protects from the tide.
- **Falls:** falling 7 m under the last top stood on is lost: 900 ms out of view, then 600 ms frozen on the checkpoint. The clock runs on.
- **Orbs:** picked up within 0.95 m of the hero's middle. Each takes 300 ms off the submitted time.
- **Finish:** standing on the goal (level 5: the Tide Bell rings only once Umbra Roller is beaten). The level's timer ends the run unranked (`timeup`).

### Hero roles (the card)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | Dash 280 ms at 12.5 m/s (15 s) | breaks cracked brick: level 2's plug into the cistern tunnel (the cistern shard) |
| Nami | Double jump (10 s) | from the water's surface it is the **breach jump**, a 4 m leap onto the orb nests (levels 1-3) that a plain leap (3.27 m from the float height) cannot reach. In the air it is a double jump capped at the flight's apex |
| Kiro | Shield 2.5 s (20 s) | walks through steam jets (levels 2, 3) and swims through whirlpools (level 4) |
| Zuno | Magnet 2.5 s, 4.2 m reach (20 s) | pulls the buried orb trails out of a drained floor (levels 1, 2, 3, 5); flooded, they stay buried |
| Vexa | Phase 1.2 s (20 s) | passes the ghost panels to the sticker niches (every level; level 3's is the hidden spiral niche in the shaft wall) |

None of them adds vertical reach beyond the proof's: the double jump is capped at the flight's apex,
and the breach is counted in `WATER_REACH`. The dash is bounded by the dash floor (below).

## Scoring

A **time game**: `kind: "time"`, display `"time"`. The server computes `score = floor((timeBaseMs − duration_ms) / 10)`.
The submitted duration is `finishMs − 300 · orbs − flow bonus` (`runTimeMs`). Only a win is ranked. The game's own clock is the HUD (`clockChip: false`).

### Server limits and why they hold (the proof)

1. **Clock.** `useRunFrame` hands the game the play time the run clock counted, and the rules turn it into whole ms. `finishMs ≤ elapsedMs`.
2. **Horizontal speed.** In any ms the hero moves at most `V_RUN / 1000` m, or `V_DASH / 1000` during a dash. The progress guard clamps every push-out and whirlpool pull to that. The stick's yaw keeps its length.
3. **Height.** On land, height only grows in a jump from a top (or a double jump capped at the flight's apex). From water, a launch rises at most `WATER_REACH` over the surface (the breach, a leap, or a jump from a crate). The water itself only rises after a lever acting on it is pulled, at `V_WATER`, and never above its highest lever target (`waterReadyMs`).
4. **Walls.** Each chamber's boundary is cut into cells. A cell under an always-solid block that reaches the floor can only be crossed above that block's top. Cracked brick, ghost panels and crates are treated as open, so every hero is covered.
5. **Least arrival.** `minArrivalMs` relaxes "standing on b, having last stood on a" until nothing improves: a direct move (the edge bound), arrival through the water, the straight line from the block before, and entry into a chamber. Every real run is at or above this fixed point.
6. **Level 5.** The finish also waits for Umbra Roller's least defeat time: each phase hit at the first ms of a vulnerable window the hero can be there for (`bossDefeatMinMs`), plus the walk from the floodgate lever to the bell.
7. **Least duration.** Take off every orb (300 ms each) and the most flow bonus the course can feed (`comboMaxBonus`: each orb, each first landing, each lever's first pull, each boss hit).
8. **Dash floor.** A dash saves at most `(280 + 1) · (12.5 − 6.5) / 6.5` ms of horizontal bound, once per 15 s cooldown and once at the start (`dashFloorMs`).
9. **Limits.** `proposeLimits` takes the bound less about 4.5 %, rounded down to 100 ms, inside 94-100 % of the bound and never above the dash floor. `timeBaseMs` and `maxDurationMs` are the level timer.

| Level | Least finish | Orbs | Least duration | minDurationMs | maxDurationMs / timeBaseMs | maxScore |
|---|---:|---:|---:|---:|---:|---:|
| 1 Drain Entry | 15 874 ms | 20 | 8 444 ms | 7 900 | 180 000 | 17 210 |
| 2 Pipe Maze | 13 709 ms | 23 | 5 219 ms | 4 900 | 210 000 | 20 510 |
| 3 Valve Shaft | 19 596 ms | 27 | 9 766 ms | 9 200 | 240 000 | 23 080 |
| 4 Flood Rise | 8 500 ms | 17 | 2 030 ms | 1 700 | 270 000 | 26 830 |
| 5 Final Escape | 22 354 ms | 19 | 15 024 ms | 14 300 | 300 000 | 28 570 |

Every level is worth at least level 1's 17 210, and level 5's 28 570 is 1.66× that (the cap is 3×).
`meta.ts` and `arcade-games.json` ship this table. `rules.test.ts` pins it and checks the dash floor.
`registry.sync.test.ts` checks the JSON against meta. The bound is loose on level 4: the crypt swim's
roof is open to the proof, so it allows a straight line through it. A loose bound is still safe.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (`bot.ts`: follows the level's route of blocks, levers, waits, swims and boss moves; it does not use the hero power) | Wins on every level at 30, 60 and 144 fps with every main orb and no hit. Score at 60 fps: L1 **16 008** (93.0 % of 17 210), L2 **19 134** (93.3 %), L3 **21 348** (92.5 %), L4 **25 740** (95.9 %), L5 **27 382** (95.8 %). Every hero clears with it (`proof.test.ts`) |
| Every hero with its power mashed (Riko at 30/60/144 Hz) | never under the floor |
| Honest bot through the real store, ragged frames | a ranked win inside the limits, the score recomputed from the time |
| Idle bot | the timer or the tide ends it (level 4's fast tide floods the start), unranked, nothing sent |
| 120 spam bots on level 1, and 25 on every level (random stick and yaw, jump mashing and holding, power mashing, 4-50 ms frames, any hero) | no win under the floor |
| Mutation probes | another level's temple read under a level's row falls outside its window; a 30 s longer timer changes maxScore; no row matches another level's course or timer |

## Levels (the card)

| Level | Title | Timer | Tide | The twist |
|---|---|---|---|---|
| 1 | Drain Entry | 180 s | 0.25 m/s from the switchback checkpoint | the three beats: pull trench A's lever and float up (or ride the floating crate) to the high ledge; drain trench B to walk under its low door; climb three switchback rows with the tide behind you |
| 2 | Pipe Maze | 210 s | 0.32 m/s from the climb | **linked chambers**: each lever floods one chamber and drains the next, so the order matters (and a wrong order is undone). Steam jets in C's doorway. Riko's cracked plug opens the cistern tunnel |
| 3 | Valve Shaft | 240 s | 0.4 m/s after 20 s | the **spiral shaft**: ledges wind round the flooded shaft, three rings of levers raise its water, and each lap ends in a collapsed side you swim across at that ring's level. A cave bat swoops while the water is low, and a steam jet guards the last lap |
| 4 | Flood Rise | 270 s | 0.6 m/s after 6 s | the **fast tide and air pockets**: the shortcut dives under the crypt roof from bubble spout to bubble spout (with a whirlpool), and the long dry terraces stay above the tide. A hidden bubble leads to the grotto shard |
| 5 | Final Escape | 300 s | 0.8 m/s from phase 3 | the boss, **Umbra Roller** |

### Boss: Umbra Roller (level 5, menu2/boss `UMBRA_ROLLER`, model `m2ShadowArmadillo`)

A Shadow Plates lieutenant with 3 hp, three phases and one hit each:

1. **The chase.** It rolls down the steps into the ring basin every cycle. Pull the ring lever on the last step: the basin floods, it floats and loses its grip, and you land on its back.
2. **Plugging the drains.** It curls in the arena's drain. Pull the three pressure levers inside 5 s of each other, and the geyser throws it up. Hit it while it spins in the air.
3. **Storm tide.** The tide starts at 0.8 m/s while it chases you up the switchbacks (a 9 s climb, slower than a hero). Pull the floodgate lever while it sits on the gate. The Tide Bell rings only after the defeat.

The rim between the basin and the arena is a checkpoint. Hits come off the submitted time as flow links (80 ms base each), counted in the proof.

## Stars, flow, secrets, progress

- **Stars** (menu2/stars): a clear; every main orb (hero-gated bonus orbs are extra); and the time star at the card's targets of L1 80 s, L2 120 s, L3 150 s, L4 165 s and L5 210 s. The no-hit badge means you were never touched by the tide, a jet, a bat, a whirlpool or the boss, never drowned and never fell.
- **Flow meter** (menu2/combo): a link within 2.5 s, +0.25 per link, capped at x2. Each orb is a 40 ms base, each first landing 20 ms, each lever's first pull 40 ms, and each boss hit 80 ms.
- **Secrets** (menu2/secrets, no score):
  - the card's **sunken shard**, which appears on a chamber's floor only after that chamber was fully flooded and then drained in the same run;
  - a **sticker** behind Vexa's ghost panel on every level;
  - level 2's cistern shard behind Riko's plug;
  - level 4's grotto shard behind the hidden bubble.
- **Progress / XP** (menu2/progress): the level end records the clear, stars, secrets and XP.

## Local multiplayer (menu2/multiplayer)

1-4 players on one screen, in co-op or versus, through `MultiScene.tsx` and `multiplayer.ts`. The water,
the levers, the broken bricks, the orbs and the boss are shared by every hero of the run (`RuinRun`
water / levers / broken / boss, with one boss owner). The shared camera is the orbit camera turned round
the group, and every player's stick gets its yaw. The storm tide is shared too (the earliest start), boss ownership passes to the next hero still in when the owner ends, and co-op shares checkpoints and Kiro's, Zuno's and Vexa's powers. Versus is a race in the same shared temple with a finish grace.

## Camera (menu2/camera)

`OrbitCamera` in solo, `OrbitDriver` + `SharedCamera` in multiplayer. The pivot is the hero plus a fixed 1.2 m
lead towards -z, held while falling (`orbitPivot`). The solids come from `solidBoxes` (every block where it is now: crates at
their water, broken brick left out). A hero against a wall is inside the camera's 0.35 m margin of it, so
the cast tests the wall itself there (`orbitCollision.ts`): a turn towards it stops at its face. In a narrow
trench a blocked view rises to look over the wall (`liftTo` 72°, `liftOrbitPitch`); the camera never comes
nearer than 2.2 m (the pivot leads the hero by 1.2 m, so nearer would put the camera inside the hero), and
`Course.tsx` fades any block still round the camera or between it and the hero to faint stone. The intro ends on the orbit's first pose (`camera.ts` `playCamera`).
`OrbitHud` gives the touch recenter button and the first-time hint.

## Models

Hyper3D props in `public/models/3d/flooded-ruins-escape/`:
- `m2RuinPlatform`, `m2RuinBrickLedge`, `m2RuinChannel`, `m2StoneLever`, `m2RuinWaterSpout`, `m2SunkenTempleBg`;
- the exit flood gate **`m2RuinFloodGateV2I`** (replaces `m2RuinFloodGate`);
- the floating crates, `m2FlyingCrate`.

From `public/models/3d/menu2/`: the boss `m2ShadowArmadillo`, the cave bats `m2CaveBat`, and the heroes.
Chamber floors, walls and the bodies under the ledges stay code boxes (instanced, one draw call per set) with a
canvas flagstone texture (`Course.tsx drawStone` through core `useCanvasTexture`: three slab tones, dark grout,
worn rims and chipped corners, cracks, moss in the grout), mapped in world space so a long wall never stretches it.
`assets.test.ts` fits every GLB to its measured bounds, and `core/modelManifest.ts` lists every url.

## Open issues

- Not playtested in a browser yet (rules and visuals are covered by the tests only).
- The honest bot does not take the hero routes (Riko's cistern tunnel, Nami's nests and so on). Those are covered by `powers.test.ts` scenes.
- The level 4 bound is loose (see the proof). A tighter one would model the crypt roof's sealed cells for swimmers.
- Versus "levers flood your rival's side" (the card) is not built: in versus the chambers are shared like in co-op.
- Co-op: levers are shared but each run's re-arm is its own, so a second hero walking through a lever's trigger pulls it again and can undo a teammate's pull. A rules fix would count a lever only when the hero steers into it.
- The card's L2 co-op dual-lock doors and the versus mirrored shaft are not built. The underwater music low-pass needs a core audio filter API. `m2AquaOrb` is not in ready/, so orbs are the shared coin. Umbra Roller's roll spins the standing `m2ShadowArmadillo` mesh (not a curled ball): check by eye.
