# Office Escape

Owner: Claude. Slug: `office-escape`. Game 3 of the 3D Arcade: the first lane runner and the first game with the shared Play50 Runner. **The game is built and playable** (rules, scene, camera, HUD notice, primitives for every model; browser results under "Test plan"). Status stays `"soon"` until it is reviewed. No GLB is generated yet, so every model is drawn by its primitive. The limits in `meta.ts` were tightened on 2026-10-07 to the proven maximum plus about 3% (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. `scoring` tightened 2026-10-07 (proof below); `thumbnail` points at `public/images/3d/office-escape.webp` (640 × 360, 19 KB, rendered from the game). |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, `Hud`, assets, camera, environment, `touchControls: ["swipe"]`, `hudStats`, `resultDelayMs: 900` (the crash's fall and bounce before the result panel), instructions. No `durationMs`, no `lives`, no `finalScore`. |
| `rules.ts` | Everything that decides the outcome: speed schedule, distance, jump arc, lane moves, input edges, seeded rows and coins, collisions, scoring. Pure: no three.js, React, DOM, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the fairness bot and the scoring-limit proof below. |
| `Scene.tsx` | The frame loop and the moving things: feeds dt and input into `rules.ts`, draws the run (corridor treadmill, obstacles, coins, runner), reports to the store, places the chase camera. |
| `Primitives.tsx` | Office look: the corridor (floor, walls, ceiling, lane stripes, pillars, plants, cabinets, end window), the obstacle, coin and shadow stand-ins, the local `InstancedProp` and the stand-in runner. |
| `camera.ts` / `camera.test.ts` | `fitChase`: the static chase camera that fits the runner and all three lanes into the safe rect (`chaseInsets` reads it from core `useSafeArea`). Runs on resize and safe-area changes only. The test checks the table below. |
| `Hud.tsx` / `Hud.module.css` | The "Faster! 9 m/s" notice on every speed-up (see HUD). |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the three props only this game generates. |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, `rules.ts` as pure functions with a seed and tests that prove the limits, the run state made once in `useState`, a `<Simulation>` component rendered **first** that runs `useRunFrame` → `rules.ts` → store calls, and `useModel(asset).failed` → primitive. Games never import each other.
- **This game adds four patterns** a later runner or scroller can copy (copy, never import):
  1. **Floating origin.** The runner stays at z = 0 and the world is drawn at `(distance − trackPosition)`. A 28 km run never loses float precision. The scenery is a **treadmill**: one static 12 m pattern laid over 120 m, in a group slid by `distance mod 12 m`, so nothing in it ever re-spawns.
  2. **Integer clock.** The simulation counts whole milliseconds (with a carry) and whole millimetres. Distance is a closed-form function of time, so it never drifts and tests can check it exactly.
  3. **Rows placed by time.** Each obstacle row is placed by the time the runner reaches it, through the exact distance function. The fairness gap therefore holds across speed changes.
  4. **Fixed pools, instanced props.** Rows and coins live in fixed slots that are rewritten in place. Every prop type is one or two `InstancedMesh`es whose matrices and `count` the frame loop rewrites (`PropSlot` in `Primitives.tsx`). Nothing mounts, unmounts or allocates after the first frame.
- **Do not copy:** the office primitives, the coin spin and the stand-in runner. They are decoration for this game.

## Concept

The Play50 Runner is late for a meeting and sprints down an endless office corridor with three lanes. Desks, printers and stacks of boxes are low, so you jump them. Chairs, coffee carts and water coolers are tall, so you change lanes. Coins float along the lanes. The corridor gets faster every 20 seconds, and one hit ends the run. The score is the metres run plus 50 per coin. The look is the Play50 vinyl-toy style in a bright office, accent `#fbbf24`.

## Controls

Matches `meta.ts` (`scheme: "runner"`): "Left / right to change lane, Space to jump" and "Swipe left / right, swipe up to jump".

- **Keyboard.** Left/A and Right/D change lane by one. Space jumps, and W/Up is an alias. Esc or P pauses (GameShell).
- **Touch.** Swipe left or right to change lane, swipe up to jump (core `SWIPE_MIN_PX` 30 px within `SWIPE_MAX_MS` 700 ms, fired mid-gesture once the finger has travelled 30 px, once per gesture). Taps and swipe down do nothing. `touchControls: ["swipe"]` renders no joystick and no buttons.
- **Edges, not holds.** The core only gives held axes for the arrows, so `rules.ts` turns them into one-shot events. A lane event fires when `moveX` crosses ±0.5 from the dead zone, and it re-arms only after `|moveX|` falls back below 0.5. Holding Left changes one lane. Left and Right together give `moveX` 0, which is no event. W/Up works the same way on `moveY < −0.5`. Space uses `jumpPressed`. A swipe is a one-frame `swipe` value.
- **Lane change.** Each event moves the target lane by one, clamped to 0..2. An event at an outer lane does nothing (the runner only wobbles). The runner slides sideways at 10 m/s, so one lane takes 200 ms. A new event mid-slide retargets at once, so a second Left continues to the far lane and a Right turns back. Lane changes also work in the air.
- **Jump.** On the ground, a jump starts on the frame of the event. Its phase counts from that frame's start, so after the step it equals the step length. In the air, a jump pressed within the last 135 ms before landing is kept and starts on the landing frame. An earlier press is dropped. Order inside one frame: lane events (keyboard, then swipe), then the jump.

## Constants

Rules use whole millimetres and whole milliseconds. 1 world unit is 1 m.

| Name | Value |
|---|---|
| Lanes | 3, centres x = −2, 0, +2 m (lane width 2.0 m). The runner starts on the middle lane. |
| Runner hitbox | half-width 0.35, depth 0.5 (±0.25 around z = 0), height 1.3 from the feet. Drawn about 1.55 tall: the head is not in the hitbox. |
| Speed | 8 m/s at the start, +1 m/s every 20 s of simulation time, cap 16 m/s from 160 s |
| Lane change | 10 m/s sideways = 200 ms per lane, retarget at once |
| Jump | airtime `JUMP_MS` 700 ms, apex 1.10 m (feet), `y = floor(4 · 1100 · j · (700 − j) / 700²)` mm, j = ms since take-off |
| Jump buffer | 135 ms before landing (`G_MIN` − airtime − 115 ms lead, fairness step 5) |
| Row gap `G_MIN` | 950 ms of running between leaving one row and reaching the next, plus a seeded extra (stage table) |
| First row | the runner reaches it at 5000 ms (40 m) |
| Spawn / recycle | rows appear when their front edge is 74 m ahead and coins when their slot is 72 m ahead (both in the fog), rows first. Both are recycled 12 m behind the runner (behind the camera) |
| Row slots | 8 (at most 7 alive, proof below). Each prop type is an `InstancedMesh` with 3 × 8 = 24 instances. |
| Coin slots | track positions 20 m + 10 m · i, at most one coin per slot; 10 pool slots (at most 9 alive) |
| Coin runs | 3–6 consecutive slots in one lane, then 1–3 empty slots (own seeded stream) |
| Coin box | 0.7 m cube. Ground coins centred at y = 0.6, raised coins at y = 1.9 |
| Run limit | 1,795,000 ms of simulation time (29:55): the run ends with `end("win")` |

### Obstacles

Hitboxes are axis-aligned boxes on the floor, a little smaller than the drawn prop. No collision ever comes from a model.

| Type | Role | Source | Drawn size w × d × h (m) | Hitbox half-width | Hitbox depth | Hitbox top |
|---|---|---|---|---|---|---|
| desk | jump | shared GLB | 1.6 × 0.8 × 0.6 (monitor to about 0.95) | 0.70 | 0.7 | 0.55 |
| printer | jump | this game's GLB | 1.0 × 0.8 × 0.6 | 0.45 | 0.7 | 0.55 |
| boxes | jump | primitive (two cartons) | 1.2 × 0.9 × 0.65 | 0.55 | 0.8 | 0.60 |
| chair | dodge | shared GLB (high back) | 0.9 × 0.9 × 1.4 | 0.40 | 0.7 | 1.30 |
| coffeeCart | dodge | this game's GLB | 1.2 × 1.4 × 1.4 | 0.55 | 1.3 | 1.30 |
| waterCooler | dodge | this game's GLB | 0.6 × 0.6 × 1.6 | 0.30 | 0.5 | 1.50 |

- **Jump means jump, dodge means dodge, by geometry.** The jump apex (feet at 1.10 m) is below the lowest dodge top (1.30 m), so no jump clears a dodge obstacle. Every jumpable top (≤ 0.60 m) is cleared by a jump for 470 ms or more of its 700 ms. The table's role column is a consequence of those numbers, not a separate flag. A test checks it.
- **Lane clearance.** A runner centred in a lane is 2.0 − 0.35 − 0.70 = **0.95 m** clear of the widest hitbox in a neighbouring lane.
- **No tunnelling.** One frame moves the runner at most 16 m/s × 50 ms = 0.8 m forward and 10 m/s × 50 ms = 0.5 m sideways. The shortest overlap along the track is 0.5 + 0.5 = 1.0 m (water cooler), and the narrowest sideways overlap is 2 × (0.35 + 0.30) = 1.3 m. Checking once per frame never skips an obstacle.

## Rules

### The clock and the speed

- One Simulation step per frame. `useRunFrame` gives the clamped dt (≤ 0.05 s). `rules.ts` turns it into whole milliseconds with a carry: `carry += dt * 1000; stepMs = Math.floor(carry); carry -= stepMs`. So `stepMs` is 0..50 and the sum of the steps never runs ahead of the sum of the dts.
- **Every timer advances only by this step:** the run time `simMs`, the jump phase, the slide, the speed stage, track generation and the run limit. Nothing in the rules reads `Date.now`, `performance.now` or `state.clock.elapsedTime`. Visual-only motion (coin spin, idle bob in the countdown, the crash tumble) uses core `useGameTime().now`, a separate visual clock advanced by `min(delta, 0.1)` that restarts with every run. It never feeds the rules. Pause stops both.
- Stage `k = min(floor(simMs / 20000), 8)`. Speed is `8 + k` m/s, which is `8 + k` mm per ms. Distance in mm is closed-form and exact: `distanceAt(t) = 20000 · (8k + k(k−1)/2) + (t − 20000k) · (8 + k)`. `timeAt(mm)` is its inverse: the first whole ms at which `distanceAt` reaches mm. The runner cannot speed up or slow down, so the time the runner reaches any track position is known when the track is built.

| Stage | Simulation time | Speed | Distance at start | Extra row gap (50 ms steps) | Obstacles per row: 1 / 2 / 3 |
|---|---|---|---|---|---|
| 0 | 0–20 s | 8 m/s | 0 m | 600–1400 ms | 60 / 40 / 0 % |
| 1 | 20–40 s | 9 | 160 m | 600–1400 ms | 60 / 40 / 0 % |
| 2 | 40–60 s | 10 | 340 m | 300–1000 ms | 35 / 50 / 15 % |
| 3 | 60–80 s | 11 | 540 m | 300–1000 ms | 35 / 50 / 15 % |
| 4 | 80–100 s | 12 | 760 m | 300–1000 ms | 35 / 50 / 15 % |
| 5 | 100–120 s | 13 | 1000 m | 0–700 ms | 20 / 55 / 25 % |
| 6 | 120–140 s | 14 | 1260 m | 0–700 ms | 20 / 55 / 25 % |
| 7 | 140–160 s | 15 | 1540 m | 0–700 ms | 20 / 55 / 25 % |
| 8 (cap) | from 160 s | 16 | 1840 m | 0–700 ms | 20 / 55 / 25 % |

At the run limit (1,795,000 ms) the distance is exactly 1840 + 16 × 1635 = **28,000 m**.

### Track: obstacle rows

- Scene draws a new 32-bit seed on every mount, in its lazy `useState` initializer: core `randomSeed()` (`core/math.ts`). GameShell remounts the Scene (`key = runId`) on start, retry and restart. PRNG: **mulberry32** (`createRng`, as in robot-collector). Rows use `createRng(seed)`. Coins use a second stream, `createRng((seed ^ 0x9e3779b9) >>> 0)`, so coin patterns never shift the rows. The same seed always gives the same track, whatever the frame rate. The draws depend only on the row index and the slot index, never on frame timing. A coin's raise-or-remove check reads only rows that are always placed before that coin (see Coins), so it does not depend on frame timing either.
- A row is up to three obstacles, one per lane, at one track position `s`. Its band is the largest hitbox depth among its obstacles, `hd` = half of it. The runner **enters** the row when `distance ≥ s − hd − 250 mm` and **leaves** it when `distance > s + hd + 250 mm`.
- **Placement by time.** Row 0 is entered at `FIRST_ROW_MS` = 5000. When row k is placed, its leave time `out_k = timeAt(s_k + hd_k + 250)` is known. Row k+1 is entered at `in_{k+1} = out_k + 950 + extra`, with `extra` from the table for the stage at `out_k`. Its centre is `s_{k+1} = distanceAt(in_{k+1}) + 250 + hd_{k+1}`. The composition of row k+1 is drawn before its `s`, because `hd` depends on it.
- **Composition.** Draw the obstacle count from the stage table. Draw the lanes as a seeded shuffle. Each obstacle is jump or dodge 50/50, then a uniform type within that role. **A row always has at least one passable lane** (empty or jumpable). Rows with 1 or 2 obstacles always have an empty lane. In a 3-obstacle row, if the first two are dodges, the third is forced to a jumpable, so a row is never three dodges. A row of three jumpables ("jump the desks") is allowed.
- Rows are written into the 8 slots as the window moves. Each step does three things in a fixed order. First it recycles rows whose back edge `s + hd + 250 mm` is more than 12 m behind. Then it places rows while the next row's front edge `s − hd − 250 mm` is at most `distance + 74 m`. Only then does it write coins (at 72 m, see Coins). The 2 m head start for rows is what keeps coin adjustment independent of frame timing. At mount, `createRun` runs the same three things at distance 0: rows up to 74 m, then coins up to 72 m. So the corridor is populated during the countdown.
- **Pool bound.** Consecutive row centres are at least **13.35 m** apart: speed only rises inside a gap, and both half-bands add ≥ 0.5 m each. Stages 0–1 give ≥ 8 m/s × 1.55 s + 1.0 = 13.4 m. Stages 2–4 give ≥ 10 m/s × 1.25 s + 1.0 = 13.5 m. Stages 5+ give ≥ 13 m/s × 0.95 s + 1.0 = 13.35 m. An alive row's centre lies within 86 m + 2 × 0.9 m = 87.8 m of track: 12 m behind to 74 m ahead, plus the largest half-band and the runner on each side. n rows need (n − 1) × 13.35 m ≤ 87.8 m, so n ≤ 7: **at most 7 rows** are alive and 8 slots always suffice. Coins sit 10 m apart in an 84 m window, so at most 9 are alive. A full pool would make generation depend on frame timing; this bound rules that out, and a test checks it.

### Fairness: every row can be passed (the proof)

The claim: whatever the runner did up to leaving row k, as long as it survived, some input sequence passes row k+1.

1. **Time available.** By construction `in_{k+1} − out_k ≥ 950 ms`, measured on the exact clock, so a speed step inside the gap changes nothing. Row 0 is entered at 5000 ms, from a standing start in the middle lane.
2. **Steer.** At `out_k` the runner is somewhere in x ∈ [−2, +2] m, maybe in the air. Pick a passable lane L of row k+1, which always exists. Press towards L. Sideways speed is 10 m/s and the distance is at most 4 m, so the runner is centred on L after **≤ 400 ms**, in the air or not. Centred, it is 0.95 m clear of the neighbouring hitboxes.
3. **If L is empty**, nothing else is needed.
4. **If L is a jumpable** (top 0.55 or 0.60 m), feet are at or above the top for jump phase j ∈ [103, 597] ms (top 0.55) or [115, 585] ms (top 0.60). The jumpable's own overlap lies inside the row's band, and the band lasts at most (1.3 + 0.5) m / 8 m/s = 225 ms. A jump pressed at `in_{k+1} − 115` is at j = 115 on entering the band and at most j = 340 on leaving it, inside [115, 585], so it clears. With frames, the bot presses on the last frame that starts at or before `in_{k+1} − 115`. That puts j in [115, 165) on entering and ≤ 390 on leaving. Any press from `max(landing, out_{k+1} − 585)` to `in_{k+1} − 115` clears too.
5. **Landing in time.** A runner that jumped row k has at most 700 − 103 = **597 ms** of air left after leaving it. Landing plus the 115 ms lead needs ≤ 712 ms, which leaves 238 ms of the 950 ms gap. A runner that took a pointless jump right at `out_k` has at most 700 ms of air: 815 ms needed, 135 ms spare. The steer from step 2 runs in parallel, because lane changes work in the air. The press window from step 4 is therefore at least 135 ms long. That is longer than the longest frame (50 ms), so some frame always starts inside it. The jump buffer also starts a press made during the last 135 ms of the descent on the landing frame. A press buffered before `out_k` (a double press) starts a second jump at most 135 ms after `out_k`, which lands by `out_k + 835` = `in_{k+1} − 115` for a minimum gap: just in time for the lead, and a press then is on the ground or buffered for that landing moment. That is why the buffer is 950 − 700 − 115 = **135 ms** and no longer. With 150 ms, a minimum-gap row whose passable lanes are only boxes (take-off by `in − 115`) or a desk or printer that sets the band (`in − 103`) could not be passed after such a double press.

**Timing windows for one jump** (the span of press times that clear a jumpable): desk and printer 494 − 150 = **344 ms** at 8 m/s and 419 ms at 16 m/s. Boxes 470 − 162.5 = **307 ms** at 8 m/s and 389 ms at 16 m/s. The numbers grow with speed because the overlap gets shorter.

The proof needs only the gap, the steer time and the jump arc. It does not need the extras, which only make the game easier. The checks happen once per frame at frame ends, and steps 2–5 hold for any sequence of steps ≤ 50 ms. A design prototype of the integer rules ran a bot that follows exactly this strategy (and one that adds a pointless jump after every row) for 40 seeds at 60, 30, 20 and 144 fps. All 320 runs reached the 29:55 limit without a hit. `rules.test.ts` repeats this with the real rules.

### Coins

- Coin slot i sits at track position `20 m + 10 m · i`. Each slot holds at most one coin, in one lane. The coin stream draws runs of 3–6 slots in one random lane, then 1–3 empty slots.
- A slot whose coin box would touch an obstacle hitbox in its lane (`|s_i − s_row| ≤ hd_obstacle + 0.35`) is adjusted. Over a jumpable the coin is raised to y = 1.9 and collected only in the air (feet > 0.25 m), so a jump earns it. Over a dodge obstacle the slot stays empty. A coin is never inside a dodge hitbox.
- **The check never misses a row, at any frame rate.** It runs once, when the coin is written into its pool slot, against the rows already placed. A coin can touch a row only if `s_i ≥ s_row − hd_obstacle − 0.35 m`, so that row's front edge `s_row − hd − 0.25 m` is at most `s_i + 0.1 m`. Slot i is written once `s_i ≤ distance + 72 m`. By then, every row whose front edge is at most `s_i + 2 m` is already placed, because rows are placed up to 74 m ahead and before the coins in every step (and in `createRun`). Even if one long frame crosses both thresholds, the row is placed first. With equal look-aheads, a coin could be written one frame before the row in front of it. Whether that happened would then depend on the frame rate. A design prototype of the integer rules showed this. It ran 300 seeds for 300 s each and compared 60 fps against 144, 30 and 20 fps, fixed 1 ms and 50 ms steps, and random 1–50 ms steps. Coins differed for 134 seeds. With the 74 / 72 m split there were no differences, and every coin matched a check against the full row list.
- A coin is collected when the runner's hitbox overlaps the coin box: depth `|s_i − distance| < 0.6 m`, sideways `|x − lane| < 0.7 m`, and the heights overlap. A ground coin is missed when the feet are above 0.95 m, so jumping over a ground coin skips it. Overlap along the track is 1.2 m and one frame moves at most 0.8 m, so no coin is skipped by a long frame.
- Coin density: **at most 1 coin per 10 m of track, counting all three lanes together** (one slot, one coin), and **at most 6 of every 7 consecutive slots**, because every run of at most 6 coin slots is followed by at least 1 empty slot. So the first n slots hold at most `n − floor(n / 7)` coins. That is ≤ 0.69 coins/s at the start and ≤ 1.37 coins/s at the cap, whatever lanes the runner picks.

### Collisions and the end of a run

- Order inside one step: input edges → clock (`simMs`, distance, slide, jump phase) → track recycle and spawn → **obstacles** → coins → score → run limit. A hit ends the step at once: nothing is collected on that frame.
- **Hit:** sideways, depth and height all overlap (`feet < top`). `setScore(capScore(score, elapsedMs))`, then `end("lose")`, then `playSfx("hit")`. The runner tumbles back (visual only, driven by `useGameTime().now`; the frameloop keeps running during "over"), and GameShell keeps the scene and the HUD on screen for the game's result delay (`resultDelayMs: 900` in `index.tsx`: the 0.45 s fall onto its back and one ~0.45 s bounce) before the result panel. The score is submitted at once.
- **Run limit:** at `simMs ≥ 1,795,000`, `setScore(capScore(...))` and `end("win")`. GameShell shows "You did it!". The server accepts runs up to 30:00, so the game stops itself 5 s before that.
- Quit (Exit or leaving the page) does not submit. Pause never ends the run.

### One hit ends the run (why not one extra life)

- It is the genre's rule and this card's promise ("Late for the meeting. Run!", difficulty 1). Every run has the same shape, and the fairness proof shows every hit was avoidable.
- An extra life needs a recovery rule, and that rule needs its own proof. After a hit, the runner sits inside an obstacle with the next row ≥ 950 ms away. It would need invulnerability (blinking, passing through obstacles) or a rewind, plus a lives chip in the HUD. Both add states that the 950 ms argument does not cover.
- The forgiveness goes into the numbers instead: hitboxes smaller than the props, a 1.3 m hitbox on a 1.55 m runner, 0.95 m lane clearance, jump windows of 307–419 ms, a 135 ms jump buffer, and retargeting mid-slide. Retry is one tap and a new seed.
- Lives would not change the scoring proof. The bound below does not depend on how the run ends.

## Scoring

| Event | Points |
|---|---|
| Distance | +1 per **full** metre run: `floor(distanceMm / 1000)` (rounded down, so the HUD never shows a metre not yet run) |
| Coin | +50 |

`score = floor(distanceMm / 1000) + 50 * coins`. Scene calls `setScore(score)` whenever the number changes (at most 16 times a second plus coins) and `setStat("coins", coins)` on every pickup. Scene never calls `addScore`, so the HUD can never drift from the formula. The submitted duration is the store's `elapsedMs` (default, no `finalScore` override).

Examples: a hit at 45.0 s of play is 390 m. With 20 coins that is 390 + 1000 = **1390**. Even with every coin of the densest possible stream, a run that reaches the limit at 28,000 m scores at most 28,000 + 50 × 2,400 = **148,000** (2,400 coins in 2,799 slots).

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 152500, `base` 0, `maxPointsPerSec` 85, duration 4.8–1800 s (tightened 2026-10-07 from 200000, 100/s and 3–1800 s; the old proof assumed a coin in every slot, which capped any proof at 93.6 points/s and 167,950). The server accepts a run only if:

- `score <= 152500`
- `4800 <= duration_ms <= 1800000`
- `score * 1000 <= 85 * duration_ms`, that is, `score <= 85 * t` with t = duration_ms / 1000

Let `e` be the store's `elapsedMs` at the end, `d = Math.round(e)` the submitted duration, and `τ` the simulation time in whole ms.

1. **Clock.** `RunClock` (`FRAME_PRIORITY.clock` −1) runs before `useRunFrame` (`FRAME_PRIORITY.simulation` −0.5), and `useRunFrame` passes the play time the clock just added (`frameMs`, clamped like the clock), so **every simulation step is counted by the clock: there is no untimed step**. The frame in which the countdown ends counts its rest as play time and steps the game by exactly that rest. Pause stops both. The integer carry only rounds down, by less than 1 ms. So `e − 1 < τ ≤ e`, and since `τ` is whole and `d = Math.round(e) > e − 0.5`, `τ ≤ d`. The test drives the real `createArcadeStore` frame by frame the way `ShellStage` does and checks this bound (no untimed step, `e − 1 < τ ≤ e`), as robot-collector does.
2. **Coins are bounded by distance and by the stream.** A coin at `20 + 10 i` m can only be taken once `distance > 20 + 10 i − 0.6` m, so a runner at D has reached at most `n = slotsReached(D) = floor((D − 19.4) / 10) + 1 < D / 10` slots (D in metres, 0 below 19.4 m). The stream lays runs of at most 6 coin slots, each followed by at least 1 empty slot (`COIN_RUN.max` 6, `COIN_GAP.min` 1), so any 7 consecutive slots hold an empty one and `coins ≤ n − floor(n / 7)`. A removed coin only lowers it.
3. **Score is bounded by distance.** `score ≤ floor(D) + 50 · (n − floor(n / 7))`. At the cap that is 16 m/s + 1.6 · 6/7 coins/s × 50 = **84.6 points/s** over a stretch of maximal density, under 85. Over a whole run the slower first 160 s keep the ratio lower still (step 4).
4. **Rate check, with 50 ms to spare.** `τ ≤ d` (step 1); the check below even allows `τ ≤ d + 50`, one whole clamped frame more, so `D(τ) ≤ D(d + 50)`. With the real speed schedule, the largest `(floor(D) + 50 · (n − floor(n / 7))) / (0.085 · d)` at `D = D(d + 50)` over every whole d = 4950 … 1,795,050 ms is **0.970** (82.455 points/s, at d ≈ 1,794,913, the run's end). The bound rises with time: 38/s at 5–10 s, 60.6/s at 160 s, 71.8/s at 300 s, 80.3/s at 900 s, 82.45/s at 1795 s. `base` 0 stays optimal: past 160 s the bound is a line with a negative intercept, so a positive base would only raise the accepted line at early times. ✓
5. **Max score.** The run stops at τ ≤ 1,795,049, where D = 28,000.8 m at most and n = 2,799 slots, which hold at most 2,400 coins. So `score ≤ 28,000 + 50 × 2,400 = 148,000` ≤ 152,500 = `maxScore` ≤ `floor(85 × 1,794.95)` = 152,570. The old every-slot bound (167,950) no longer fits; the density bound is what the limit rests on. ✓
6. **Duration window.** The first row is entered at τ = 5000 ms, so the earliest hit gives `e ≥ τ ≥ 5000` (the bound checked below, `e ≥ 4950`, keeps the same 50 ms to spare), which is ≥ 4800. That run scores at most 40 + 50 × 3 = 190 against a cap of 420 even at 4950 ms. The run limit gives `e < τ + 1 ≤ 1,795,050`, which is ≤ 1,800,000. Quit does not submit. ✓

Margins: `maxPointsPerSec` 85 is 3.1% above the proven 82.455; `maxScore` 152,500 is 3.0% above the proven 148,000 (and binds before the rate at the run end, 85 × 1795.05 = 152,579); `minDurationMs` 4800 is 4% below the earliest possible submission (5000 ms); `maxDurationMs` stays 1,800,000 (runs end by 1,795,050 ms, and it also sets the run-token TTL). The best a forger can post is 152,500 at a claimed 1,794,118 ms or more, down from 180,000.

Measured (throwaway probes, deleted): coins actually available per seed (not removed, slot reached), 20,000 seeds × a full 29:55 run: mean 1893.6, sd 14.9, max 1947, so at most 125,350 for a perfect player on the best seed (highest cumulative ratio of any seed 69.94 points/s, at 1673.7 s). A coin-aware chase bot won 30 of 30 runs (10 seeds × 60 fps / 20 fps / random 1–50 ms), best 106,900 (1578 coins), best cumulative 59.7 points/s. Below 148,000 / 82.5 only a statistical argument is left (about 127.5k over all 2^32 seeds), so the limits stay at the proven maximum plus 3%.

`capScore(score, elapsedMs)` = `min(score, 152500, floor(85 · Math.round(elapsedMs) / 1000))` is applied before `end()` as a safety net only. The tests prove it is a no-op for every reachable run.

## Scene and camera

- **Floating origin.** The runner stays at x = lane position, z = 0. Rows and coins are drawn at `z = (distance − s) / 1000` m (negative = ahead).
- **Corridor treadmill.** Floor, walls, ceiling, light panels, lane stripes, pillars, plants and filing cabinets are one static 12 m pattern laid over 120 m of local z (+24 … −96). Scene slides their group by `(distance mod 12000) / 1000` m every frame, so the textures never scroll and nothing is recycled by hand: the floor texture tiles every 2 m, the wall texture every 12 m, dashes every 3 m, light panels every 4 m, pillars and plants every 12 m. The corridor is 9.2 m wide (walls at x = ±4.6, decor between the lane edges at ±3 and the walls) and 9.5 m tall: a two-storey office atrium. **The ceiling sits above every fitted camera** (the highest, portrait, is 7.33 m), so it frames the band above the horizon without ever covering the runner; it hides itself if a camera is ever fitted within 1 m of it. A window with a pale city (`fog: false`) closes the corridor 92 m ahead.
- **Chase camera.** It sits behind and above the runner, at x = 0, and never pans sideways, so all three lanes are always on screen. It does not follow jumps. The runner never moves along z, so the camera is static for the whole run and only refits on resize, rotation or a change in the obstruction. A small `ChaseCamera` component renders core `<CameraRig camera={fitted} />` without `follow`; only it re-renders when the safe area changes. There is no FOV kick or shake, because they would break the fit.
- **Why not core `useFittedView`.** It fits a box around a focus point (at the picture centre, or moved with a lens shift). This camera keeps a fixed 16° pitch and pins the feet at 20% of the safe height instead, so its look point moves ahead as the camera backs off (−15.13 m on the portrait phone, −7.06 m on the laptop). No single `focus` reproduces that, and a lens shift lowers the horizon (more floor, less track ahead). `fitChase` keeps the README rules and numbers exactly; its safe rect comes from core `useSafeArea`.
- **`fitChase(width, height, insets)`** (`camera.ts`, pure, tested in `camera.test.ts`):
  - Safe rect (`chaseInsets(useSafeArea())`): top = the shell HUD's bottom + 10 px of air (64 px with the 54 px HUD, also the value before the HUD is measured). Bottom 16 px + the cookie banner (`useSafeArea().obstructions`). Sides 8 px + the device insets, read from the HUD row's padding (it is padded by 10 px + `env(safe-area-inset-*)`). There is **no joystick box**, because `["swipe"]` renders no touch controls.
  - Pitch is fixed at **16°** down. Vertical FOV is **60°** when the canvas is portrait (aspect < 1) and **50°** otherwise.
  - The runner's feet (0, 0, 0) are pinned at 20% of the safe height above its bottom edge. The camera slides along that ray to the **closest** distance (binary search) that satisfies all four rules: (a) the runner box x ±2.45, y 0–2.65 (jump apex included), z ±0.3, and the lane edges x = ±3 m on the floor over the same depth z ∈ [−0.3, +0.3] stay inside the safe rect (the near end, z = +0.3, is the widest and is the one that binds); (b) a standing runner is at most 25% of the safe height; (c) the camera is at least 3.2 m high (above the runner at the apex); (d) a 1.6 m obstacle top 50 m ahead (3.1 s at the cap) stays below the HUD.
- **Fitted views** (computed with that rule, insets 0, no banner; px are CSS px from the top-left; "px/m" is the scale across the track at that distance). The runner, feet, apex and lane-edge columns are measured at the runner's centre, z = 0. The lane edges are also given at z = +0.3, the near end that rule (a) checks:

| Viewport | FOV | Camera (x, y, z) → looks at | Binding rule | Runner (standing) | Feet y / apex top y | px/m at runner / 10 / 30 / 50 m | Lane edges x at z = 0 (at z = +0.3) | Floor y at 10 / 30 / 50 / 70 m | Horizon y |
|---|---|---|---|---|---|---|---|---|---|
| 375 × 812 | 60° | (0, 7.33, 10.43) → (0, 0, −15.13) | (a) width: the near lane edges touch the 8 px side margins | 81 px | 650 (162 above bottom) / 507 | 58 / 32 / 17 / 11.7 | 12 … 363 (8 … 367) | 452 / 336 / 294 / 272 | 204 |
| 812 × 375 | 50° | (0, 4.30, 6.98) → (0, 0, −8.02) | (b) runner = 25% of 295 px | 74 px | 300 (75 above bottom) / 169 | 51 / 23 / 11 / 7.2 | 253 … 559 (247 … 565) | 175 / 121 / 104 / 96 | 72 |
| 1280 × 800 | 50° | (0, 3.79, 6.15) → (0, 0, −7.06) | (b) runner = 25% of 720 px | 180 px | 640 (160 above bottom) / 317 | 123 / 52 / 24 / 15.6 | 270 … 1010 (254 … 1026) | 358 / 248 / 215 / 200 | 154 |

  Also checked with the same rule: 390 × 844 gives 85 px (rule (a) binds) and feet at y 675, and 915 × 412 gives 83 px (rule (b) binds) and feet at y 330. On every view the horizon is below the HUD line, so rule (d) never binds and the track is visible up to the fog (40–75 m). A 2 m lane is 23 px wide 50 m ahead on the portrait phone and 14 px in landscape. The camera is 3.8–7.3 m up, so it looks over the runner's head. The middle lane is hidden behind the runner only in the last 3–4.5 m (≤ 0.3 s at the cap), well after the decision point.

  **Measured live** (production build, headless Chrome, 2026-10-05): all three rows match the table within 0.5 px and 0.005 m (for example 1280 × 800: camera (0, 3.789, 6.152) → (0, 0, −7.063), runner 180 px, feet 640, apex 317.3, lane edges 254.2 … 1025.8 at z = +0.3, horizon 154). The shell HUD measures 54 px, so the safe top is the README's 64 px. With the cookie banner open on 375 × 812 (banner top at 650 px) the fit moves the feet to y 520 and the near lane edges to y 528, still on the 8 px side margins.
- **Frame order.** `<Simulation>` is the Scene's first child and steps in `useRunFrame` (`FRAME_PRIORITY.simulation`, before the camera and every plain `useFrame`), so `Corridor`, `Obstacles`, `Coins` and `Runner` always draw this frame's state. Visual components only read `run` in `useFrame`.
- **No allocation in the frame loop.** `createRun(seed)` allocates the run once: 8 row slots (each with a fixed lane array), 10 coin slots, both rng closures and the input latches. The visual state (`Fx`: landing, speed-up and crash times, smoothed roll and lean, per-coin pickup times in typed arrays) and the instance slots are made once per Scene mount, and the matrix scratch (`Matrix4`, `Quaternion`, `Euler`, `Vector3`) once per module. A step rewrites fields in place. Instance counts change through `mesh.count`. Store calls happen only when a value changes: `setScore` on a new metre or coin, `setStat` on a pickup, `setLevel(k + 1)` on a stage change. A stage change also flashes the lane stripes amber for 0.5 s (visual only). Heap sampling while playing attributes about 55 KB/s to the game's chunk (number boxing in three.js setter calls, no objects); three.js's own renderer accounts for about 1 MB/s.
- **Instanced props (`PropSlot`, `PropMeshes`, `InstancedProp` in `Primitives.tsx`).** Each obstacle type is one or two `InstancedMesh`es ("parts") with capacity 24 (8 row slots × 3 lanes). A part is one unit geometry and one material; its pieces (a desktop, two side panels, a laptop …) are extra instances with their own transform and `instanceColor`, so a whole desk is two draw calls whatever the count. Every frame, `Obstacles` walks the 8 row slots once and writes `placement × piece` matrices and `mesh.count` per type, plus one soft contact shadow per obstacle (one more `InstancedMesh`). `frustumCulled = false`, because instances spread 80 m from the mesh origin. `InstancedProp` swaps the stand-in parts for the GLB's own meshes once the model is listed in `core/modelManifest.ts` (core `useModel` + `modelParts`: the node transform and the asset's `scale` / `rotationY` / `yOffset` are folded into the piece matrix), with the same slots and the same matrices; a local error boundary (`PropErrorBoundary`) draws the stand-in parts if a listed GLB breaks while rendering. Core `<InstancedModel>` is not used because its spots are static (matrices written once); here every instance moves every frame. Boxes, coins and shadows are always primitives. Rows look less machine-placed with a fixed per-row turn (chairs up to ±0.6 rad), and the obstacle that was hit rocks back after the crash (looks only).
- **Coins.** A gold disc with a star on both faces (3 material groups) and an additive glow quad, 10 instances each. They spin and bob with `useGameTime()`. Raised coins get a bigger glow. A collected coin flies up over the runner's head and shrinks in 0.3 s; a missed one shrinks away 1–2.2 m behind the runner instead of flying past the camera.
- **Draw calls (measured):** 43–50 on every viewport, budget 150. The most there can be is 50: corridor 12, obstacles 10 with every type in view (an `InstancedMesh` with `count` 0 issues no draw) plus 1 for the contact shadows, coins 4, runner 22 + blob shadow 1. About 11–14 k triangles, 32 geometries, 6 textures and 13 programs, constant over a run and across retries. No shadow maps.
- `environment`: background and fog `#dbeafe`, fog 40–75 m, `lighting: "indoor"`.

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` (group B, 2026-10-06: 18k tris, 529 KB, a 1.79 × 1.90 × 0.48 static T-pose, grey hoodie, joggers, sneakers; animated by the core auto-rig, below) | `assets/shared.spec.json` | player | `RunnerPrimitive`: orange hoodie, blue backpack, round head with hair and a teal headband (tails flap), capsule arms and legs with elbow and knee joints swung in code. 22 meshes |
| desk | **shared** `models/3d/shared/desk.glb` | `assets/shared.spec.json` | jump | Oak desktop, white side panels, modesty panel, a closed laptop and papers (one box part) + a mug (one cylinder part). No monitor, so a jump never skims one |
| chair | **shared** `models/3d/shared/chair.glb` | `assets/shared.spec.json` | dodge | Slate seat and high backrest with a headrest, armrests, five-star base (box part) + gas stem and casters (cylinder part) |
| printer | **this game** `models/3d/office-escape/printer.glb` | `./assets.spec.json` | jump | Grey body, darker lid, paper tray and output paper, teal control panel with a screen (one box part) |
| coffeeCart | **this game** `models/3d/office-escape/coffeeCart.glb` | `./assets.spec.json` | dodge | Red two-shelf cart with posts, handle and pastry boxes (box part) + silver urn with lid, tap, cup stacks and four wheels (cylinder part) |
| waterCooler | **this game** `models/3d/office-escape/waterCooler.glb` | `./assets.spec.json` | dodge | White body, tap recess, drip tray, blue and red taps (box part) + blue bottle, neck, cap and cup holder (cylinder part) |
| boxes, coins, floor, walls, ceiling, stripes, pillars, plants, cabinets, end window | primitives in code | none | – | (always primitives) |

Every GLB of this table is in `core/modelManifest.ts` now (group A props, the group B runner). The stand-ins use the README drawn sizes, so the hitboxes read right whenever a model is missing or fails to load.

- **The runner on the auto-rig** (2026-10-06). `assets.ts`: `{ ...SHARED_ASSETS.runner, scale: 0.82, rotationY: Math.PI }`: the 1.90-tall GLB drawn at **1.55 m**, the `RunnerPrimitive`'s height (the 1.3 m hitbox in the rules is unchanged), turned round to run towards −z. Its joints are `RUNNER_LANDMARKS` (`core/sharedAssets.ts`, measured once from the GLB; `core/rig/runner.test.ts`). The Scene draws it with `<HumanoidModel asset pose applyLift={false} fallback={<RunnerPrimitive/>}>` and builds the pose every frame in `useHumanoidPose` (core `FRAME_PRIORITY.pose`, after the step): `walkPose` at the stand-in's stride phase (`distance / 2.4 m`, so the legs move with the ground and stop when it stops; the GLB's own stride would be 1.36 m at a run, so the feet slide a little at speed) with an amount easing from 0 (the idle's breath and glance) to 0.85 at 8 m/s and 1 at the 16 m/s cap; the lean into the run and the roll into a lane change go into the spine (`turnBone`), because a whole-body lean about the feet would tip the soles into the floor; `jumpPose` blends in by the airborne blend with the knees tucked at the apex; on a crash `crash.ts` `crashPose` (the root still tumbles onto its back as before, `crashPlacement`): `flailPose`'s waving arms and shaking head with the legs raised and kicking, because `flailPose`'s own knees fold the shins back, which on its back put the shin and foot up to 18 cm through the floor (`crash.test.ts` skins the real runner through the whole end animation: nothing below the floor); `cheerPose` on a win (with the hop). The body group carries the GLB's rise over its planted foot (`bodyLift` × 0.82) instead of the stand-in's bob; the squash on take-off and landing and the wall wobble stay on it. The stand-in keeps its own swung limbs, bob, lean and roll (the Scene sees it through a ref on its wrapper group).

- **Generate only the printer, the coffee cart and the water cooler:** three text-to-3D props, `Gen-2.5-Low`, `qualityOverride` 1500 / 2500 / 2000, one attempt each, so 3 generations (about 1.5 credits at 0.5). The desk, chair and runner are already in `shared.spec.json` and are generated and billed there, not here.
- **Universe `shared-cast`, seed 5050, not a new `office` universe.** These three props stand next to the shared desk and chair in the same rows. In this pipeline a universe is one seed plus one prompt style, and the desk and chair are `shared-cast` 5050. Matching both makes the five office props one toy set. A separate `office` seed would make the generated props drift from the shared desk and chair beside them. clean-city made the same choice for its litter. The prompts use the shared desk and chair suffix word for word ("stylized toy-like 3D game asset, … no base or ground") and add "no text or logos", because a printer panel, a coffee cart and a bottle label invite printed text. The targets stay `office-escape`. They are not shared, because no other planned game uses them.
- A prop GLB should face +z (towards the oncoming runner) and stand on y = 0. `assets.ts` sets `scale` so the drawn sizes match the obstacle table: the desk with its desktop at about 0.6 m, the chair with its backrest at about 1.4 m. That is a tuning step in the assets PR. The shared desk has a monitor that reaches about 0.95 m. The hitbox is the desktop (0.55 m), and a jump is above 0.95 m only for about 260 ms around the apex, so a badly timed jump can visibly skim the monitor. That is cosmetic. See Known issues.
- The runner GLB faces +z by convention and runs towards −z, so `assets.ts` uses `{ ...SHARED_ASSETS.runner, scale: 0.82, rotationY: Math.PI }`.

### Runner animation

1. **The static T-pose GLB on the core auto-rig (today).** `<HumanoidModel>` builds its skeleton in code from `RUNNER_LANDMARKS`; the Scene drives the pose (Assets above): the run cycle at the stride phase, the idle, the leap, the crash flail and the cheer, with the lean and the roll in the spine. The root effects below stay. (A Mixamo pass with clips is no longer planned: `rigged` GLBs get no auto-rig, and the code poses cover every state.)
2. **No GLB (the fallback).** The primitive runner with the same root effects, plus hips swinging ±35° with opposite arms, knees bending in the swing phase, elbows bent, a leap pose blended in while airborne (front leg forward, back knee tucked, deeper at the apex), and headband tails that flap faster at speed; a whole-body lean of 6° + 0.5° per m/s over 8, a roll into the slide (±10°) and a bob of 0.06 m per stride on its body group.

Root effects for both: squash on take-off and landing (scale y 0.85 / xz 1.08 for 80 ms, from the jump phase), stretch while rising, the wall wobble. Stride phase = `distance / 2.4 m`, so legs move with the ground and stop when it stops (countdown, pause, over). The take-off squash and the rising stretch come from the jump phase (simulation state); the landing squash starts on the step's `landed` event. The countdown idle (a breath and a glance), the crash and the win use `useGameTime().now`. Nothing reads R3F's clock.

- **Crash** (`"lose"`): the runner is knocked 0.25 m back onto its back over 0.45 s, turned 0.6 rad towards the middle of the track so the whole body stays above the bottom edge of every fitted view, bounces once, then its head wobbles. Arms and legs spread, the blob shadow stretches under the body, and the obstacle that was hit rocks back and settles.
- **Win** (the 29:55 limit): the runner hops on the spot with its arms up.
- Both play before the result panel: `resultDelayMs: 900` keeps the scene up until the fall is over and the bounce has died down (`crash.test.ts` "result delay": the fall complete and the bounce's remaining swing under 20% of its first one when the panel appears: 11% at 900 ms, where the core default 800 ms would leave 28%). Measured 2026-10-07 in headless Chrome (rAF probe from the end to Retry): 900 ms / 52 frames at 1280 × 800, 1017 ms / 47 frames at 390 × 844 (the delay counts rendered frames, each at most 50 ms); the runner lies on its back in a screenshot ~750 ms after the hit, the HUD's Pause hidden, Mute still there.

## HUD

GameShell draws Score, **Played** (the game is untimed: no `durationMs`) and `hudStats: [{ key: "coins", label: "Coins" }]`. Distance is shown through the score, which goes up 1 per metre. There are no lives. At 375 px the row is about 330 px wide (Score "148,000", Played "29:55", Coins "2400", mute, pause), one line. Scene writes `setStat("coins", n)` on every pickup.

**The game's own HUD (`Hud.tsx`) is one notice:** "Faster! 9 m/s" … "Faster! 16 m/s" for 1.6 s on every speed-up (the store's `level`, which Scene sets on a stage change; the lane stripes flash amber at the same moment). It sits in the HUD row between the chips and the buttons on wide screens, and just under the row (over the ceiling band, where nothing is played) on screens up to 640 px wide. The live region (`role="status"`) is always mounted, like every game HUD panel, so nothing re-lays out mid-run, and its animation waits while the game is paused. It is a dark blurred pill like the shell HUD chips (`rgba(11, 16, 32, 0.66)`), because it sits over the bright ceiling, where `var(--card)` (6% white) left the white and amber text unreadable. It is deliberately **not** marked `data-arcade-safe-area`: it is gone again in 1.6 s and never covers the runner or the lanes near it, while marking it would lower the safe top on phones and move the chase camera's fit for good.

`index.tsx`:

```ts
const definition: GameDefinition = {
   slug: "office-escape",
   Scene,
   Hud: OfficeHud,
   assets: ASSETS,
   // first frame only: Scene's CameraRig refits on mount (camera.ts)
   camera: { position: [0, 4.3, 7], fov: 50, lookAt: [0, 0, -8] },
   environment: { background: "#dbeafe", fog: ["#dbeafe", 40, 75], lighting: "indoor" },
   touchControls: ["swipe"],
   hudStats: [{ key: "coins", label: "Coins" }],
   instructions: [
      "Run as far as you can. Swipe or press Left / Right to change lanes.",
      "Swipe up or press Space to jump desks, printers and boxes.",
      "Dodge chairs, coffee carts and water coolers. One hit ends the run.",
      "1 point per metre, +50 per coin. It gets faster every 20 s.",
   ],
};
```

## Edge cases

- **Pause** (Esc, P, tab hidden, window blur) stops `useRunFrame` and the clock, mid-jump or mid-slide included. On resume the jump continues from the same phase and height. Visuals never read `state.clock.elapsedTime`, which R3F resets on every frameloop switch.
- **Input released on blur:** `release()` clears held keys. A key held through a pause therefore gives no event on resume until it is pressed again. A key pressed and released between two frames is missed (see Known issues).
- **Same frame:** two lane events from keyboard and swipe both apply (clamped). A lane event and a jump both apply. A hit and a coin: the hit wins and the coin is not counted. A hit and the run limit: the hit wins (`"lose"`). `end()` is idempotent.
- **Countdown:** the world is still (distance 0), the runner idles on the start line, and the rows up to 74 m and the coins up to 72 m are already there. The frame in which the countdown ends steps the game by the rest of that frame, which the clock also counts as play time: there is no untimed step (proof step 1).
- **Resize or rotation mid-run** refits the camera only. Rules, lanes and controls do not depend on the view.
- **Retry and restart** remount the Scene (`key = runId`): a new seed, new pools, a new runner. Nothing carries over. React strict mode double-creates the run in `useState`, which is harmless.
- **Missing GLB:** its instanced primitive. A GLB that breaks while rendering falls back the same way: the runner through core `<Model>`'s error boundary, each obstacle type through `InstancedProp`'s own `PropErrorBoundary` (core's `ModelErrorBoundary` is not exported), which draws the stand-in parts in the same slot. Collision never depends on the model.
- **Very long runs:** distance stays an exact integer (≤ 28,000,000 mm) and draw positions are relative to the runner, so there is no precision loss. The run ends itself at 29:55 ("You did it!").

## Test plan

`rules.test.ts` (vitest):

- **Clock.** The carry turns 1000 frames of 1/60 s into 16,666 ms, the floor of the sum and never more. Steps are 0..50 ms. dt ≤ 0 does nothing.
- **Speed and distance.** `speedAt` is 8 at 0 ms, 9 at 20,000 ms, 16 from 160,000 ms, and never above 16. `distanceAt` matches the stage table (160, 340, …, 1840 m; 28,000 m at 1,795,000 ms). `timeAt` is the exact inverse: `distanceAt(timeAt(s)) ≥ s > distanceAt(timeAt(s) − 1)`.
- **Jump.** `y(0) = y(700) = 0`, the apex is 1100 mm at 350 ms, feet ≥ 550 mm for j ∈ [103, 597] and ≥ 600 mm for j ∈ [115, 585]. The apex is below every dodge top, so no dodge obstacle can be cleared in any phase.
- **Input.** Held Left gives exactly one lane change. Release and press again gives another. Left and Right together give none. Swipes left, right and up work. Space and W/Up are edges. A jump in the air is buffered only in the last 135 ms. A retarget mid-slide reverses at once. The outer lanes clamp. Slides take 200 ms per lane at any frame rate.
- **Track (1000 seeds × 300 s, 100 seeds × 1,795 s).** Same seed, same rows and coins. A different seed changes them. **Frame-rate independence:** each seed run at 144, 60, 30 and 20 fps (through the carry), with fixed 1 ms and 50 ms steps, and with random steps of 1–50 ms gives identical row sequences and identical coins: the slot, the lane and the raised or removed flag, starting from the `createRun` fill at mount. Every coin's flag also matches a reference check against the full row list, not only the rows alive when it was written. The two streams are independent (changing the coin seed leaves the rows unchanged). Every row has a passable lane, and no row has three dodges. `in_{k+1} − out_k ≥ 950` and `in_0 = 5000`. Alive rows never exceed 7 and alive coins never exceed 9, so the generator never finds a full pool. Coin slots sit at 20 + 10 i m with at most one coin each. No coin sits inside a dodge hitbox, and raised coins appear only over jumpables.
- **Collisions.** Every dodge type hits in every jump phase. A jumpable is cleared exactly when the feet are above its top on every overlapping frame. A runner centred in a neighbouring lane never touches. At 50 ms frames and 16 m/s, no obstacle or coin is skipped.
- **Fairness bot.** A bot that follows the proof's strategy (steer after leaving a row, press jump on the last frame at or before `in − 115`), and a sloppy bot that also jumps right after every row, play 50 seeds each at 60, 30, 20 and 144 fps. They must reach the 1,795,000 ms limit and end with `"win"`. If one hits, the test prints the seed, the row and the frame. A runner that leaves a row with 1–135 ms of air left and a second jump already buffered still passes a minimum-gap row of boxes, or of a printer and a desk, at every stage and frame rate.
- **Scoring.** `floor(mm / 1000) + 50 · coins`. The examples above. `withinServerLimits` matches the server formula (850 at 10 s, 4800 ms, 1,800,000 ms and 152,500 at the edges). `capScore` is a no-op on every bot frame and on the theoretical maximum.
- **Proof.** The real store, driven like `ShellStage` through countdowns, pauses, resumes, restarts and frames up to 300 ms, has no untimed step, and `e − 1 < τ ≤ e`. The coin stream (200 seeds × 29:55) never fills 7 slots in a row and the first n slots never hold more than `n − floor(n / 7)` coins. `floor(D) + 50 · (n − floor(n / 7))` at `D(d + 50)` is ≤ `0.085 · d` for every whole ms d in 4950 … 1,795,050 (maximum ratio 0.970). The max score at the limit is 148,000 ≤ 152,500 ≤ 152,570, and a coin in every slot (167,950) would be rejected. A limit end submits ≤ 1,795,050 ms. The earliest possible hit submits ≥ 4950 ms. An idle runner either hits a row in its lane at ≥ 5000 ms or reaches the limit. Every bot frame keeps its coins within the density bound.

Browser (production build, flags on with the API mock, headless Chrome over CDP):

- **Desktop 1280 × 800, keyboard:** start, countdown, run past 20 s (the score rate goes from 8 to 9 m/s), a held Left (exactly one lane change), Space jumps over a desk and collects a raised coin, a 2.5 s pause in mid-jump (same height after resume), then a deliberate hit on a chair → "Game over". The score must equal `floor(m) + 50 · coins` for the submitted duration. Retry gives a different track.
- **375 × 812 and 812 × 375, touch emulation:** swipes are sent as CDP touch drags (left, right, up). The fit matches the table within ±2 px: runner height, feet y, apex top y, lane edges at z = 0 and at z = +0.3 (on 375 × 812 the near ends sit on the 8 px side margins), horizon below the HUD. These are the points rule (a) uses, so the rule, the table and this check measure the same thing. The HUD is one row. No joystick is shown. With the cookie banner open, the runner sits above it.
- **Performance:** `renderer.info.render.calls` ≤ 150 and 60 fps on desktop and in phone emulation. `renderer.info.memory` (geometries, textures) stays constant from 5 s to 60 s, which shows the pools: no remounts and no new materials.
- **Missing GLBs** show the primitives with the same hitboxes.

`camera.test.ts` (vitest): `fitChase` reproduces the three table rows within 1 px and 0.05 m (binding rule, fov, camera, look point, runner, feet, apex, lane edges at z = 0 and +0.3, floor rows, horizon); runner, apex and lanes stay inside the safe rect on six more screens; the cookie banner lifts the feet to 20% of the smaller safe height; `chaseInsets` reads the HUD bottom, the side insets and the banner.

**Browser results (2026-10-05).** Production build with `NEXT_PUBLIC_ARCADE_ENABLED`, `_API_MOCK` and `_LEADERBOARD` on, `next start`, headless Chrome over CDP (ANGLE D3D11) with a bot that reads the run state and plays by the proof's strategy:

- **1280 × 800, keyboard:** start screen and countdown with the corridor already set (2–3 rows, 4–6 coins, distance 0, camera unchanged). Right → lane 2 in < 300 ms; Left held 700 ms → exactly one lane change; A, D, and Left clamped at the outer lane; Space and W jump. A 2.5 s pause at jump phase 319–321 ms froze `jumpMs`, feet (1091 mm), distance and the store clock, and the jump continued from there. The bot ran past 20 s: level 2, the stripes flashed amber, "Faster! 9 m/s" showed, and the distance rate was exactly 9.000 m/s. It cleared desks, printers and boxes and collected 7–18 coins (raised ones in the air). Every collected coin stayed visible for its whole 0.3 s flight (17 frames at 56 fps, also at 10 m/s in stage 2), and the "Faster!" pill read clearly over the ceiling at 1280 × 800 and 375 × 812. A deliberate run into a dodge obstacle ended with `"lose"` and a result panel whose score equals `floor(distance / 1000) + 50 · coins` (for example 682 = floor(282220 / 1000) + 50 × 8 at 33.58 s), within the server rate. The panel appeared 0 frames after the end then, so the crash pose ran behind it and was not visible in screenshots 120 ms and 500 ms after the hit; since the core result delay it waits (Runner animation: 900 ms with `resultDelayMs: 900`). Retry gave a new seed and a different track, score and coins back to 0.
- **375 × 812 and 812 × 375, touch emulation:** swipes right, left (twice in a row: lane 2 → 0), up (jump), down (nothing) and a tap (nothing) behave as specified; no joystick or buttons render. The camera matches the table (above). The notice sits under the HUD row at 375 px and inside it at 812 px. Same run, speed-up, hit, result and retry checks as on desktop.
- **Cookie banner open** (375 × 812, banner 162 px): the feet move to y 520 and the near lane edges stay on the side margins, 122 px above the banner.
- **Performance:** 43–50 draw calls, 11–14 k triangles; 56–57 fps (the headless frame cap) on every viewport, also with the CPU throttled 4× and 6× (longest frame 30 / 42 ms); `renderer.info.memory` constant at 32 geometries and 6 textures from 4 s to 32 s and across a retry; no React commits in the canvas while playing apart from the chase camera on a HUD size change (0–6 in 6 s); no `.glb` requests; no console errors or warnings.

## Known issues and core gaps

- **No one-shot events for the arrows (lane taps are frame-sampled).** The core has `jumpPressed` and `actionPressed` (latched in `keyDown`, never lost), but Left, Right, A, D and W/Up are held axes only, sampled once per frame by `latch()`. `rules.ts` derives the lane and jump edges from those samples, so a key pressed and released between two latches never moves `moveX` off 0 and is lost, and the release gap of a quick Left-Left double tap can be missed, merging two lane changes into one. That is a tap under about 17 ms at 60 fps, 33 ms at 30 fps and 50 ms at 20 fps. Measured at 56 fps: 8 lane taps with keydown and keyup about 1 ms apart gave 0 lane changes, 8 taps held 10 ms gave 7 or 8 (a hold shorter than a frame is caught only when a latch falls inside it), and 3 zero-hold Space presses all jumped. Real key taps at 60 fps are almost always longer than 17 ms, so this matters mainly on slow devices. Core candidate: latched `leftPressed`, `rightPressed` and `upPressed` edges in `inputController.keyDown`, like `pendingJump`, which `readInput` would OR with the zone edge.
- **Closed: swipes fired on release, and the result panel hid the crash and the win.** Both were core gaps this game recorded; core follow-up 2 closed them for every game: swipes now fire mid-gesture at 30 px (no wait for the whole gesture), and the scene stays on screen for the result delay before the panel. This game sets `resultDelayMs: 900` (core default 800) so the fall and the bounce finish before the panel covers the runner (Runner animation).
- **Core `<InstancedModel>` is static.** It writes its spots once, so a pool whose instances move every frame cannot use it. The game keeps a local `InstancedProp` / `PropSlot` built on core `useModel` + `modelParts`. Core candidate: an `InstancedModel` variant that hands its meshes and piece matrices to the game's frame loop.
- **The bottom safe-area inset is not read.** `chaseInsets` gets the top and side insets from the HUD row's padding, but nothing in the core reports `env(safe-area-inset-bottom)`, so a phone whose page runs under the home indicator keeps only the 16 px margin there. Core candidate: `useSafeArea()` insets.
- **`useSafeArea()` has no selector.** HUD chips change width as the score grows, every change is a new safe area, and `ChaseCamera` re-renders for it (the fit does not change). It is one small component, measured at 0–6 renders in 6 s.
- Core gaps robot-collector recorded that are closed now and used here: the pause-safe clock (`useGameTime`), the frame order (`FRAME_PRIORITY`, `useRunFrame` before every visual), the overlay rects (`useSafeArea`: HUD, banner), `<Model fallback>` (the runner), and the GLB manifest (no `.glb` request before a model exists). `useFittedView` exists too but does not fit this camera (see "Why not core `useFittedView`").
- **Runner rig: decided** (2026-10-06). The shared runner is a static T-pose GLB on the core auto-rig (Assets, Runner animation); no clips, no `useAnimations`. Its feet slide a little at top speed (the stand-in's 2.4 m stride phase is kept for both, the GLB's own run stride is 1.36 m); the leap's tuck and the crash flail are blends over the run cycle.
- **Desk monitor.** The shared desk was prompted with a monitor (up to about 0.95 m). The hitbox is the desktop, and a late or early jump can visibly skim the monitor. If players read it as unjumpable, use the primitive desk (a closed laptop, nothing above 0.7 m) or a monitor-free desk in a later shared-spec pass.
- **Catalog drift.** `skills.md` (models row) still says universe `office` for this game, and plan §4 lists desk and chair under this game's generations. This spec uses `shared-cast` 5050 and generates only the printer, the coffee cart and the water cooler, because the desk and chair are in `shared.spec.json`. Update the catalog in the next pass.
