# Office Escape

Owner: Claude. Slug: `office-escape`. Game 3 of the 3D Arcade: the first lane runner and the first game with the shared Play50 Runner. Status stays `"soon"` until the game is built and reviewed. **This file is the design. There is no scene or rules code yet.** `meta.ts` and the `index.tsx` stub are already on `main`. This prep adds only this README and `assets.spec.json`. The limits in `meta.ts` are correct as they are (proof below).

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. On `main`, unchanged. |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, assets, camera, environment, `touchControls: ["swipe"]`, `hudStats`, instructions. No `durationMs`, no `lives`, no `finalScore`. Stub today. |
| `rules.ts` | Everything that decides the outcome: speed schedule, distance, jump arc, lane moves, input edges, seeded rows and coins, collisions, scoring. Pure: no three.js, React, DOM, `Math.random` or `Date.now`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the fairness bot and the scoring-limit proof below. |
| `Scene.tsx` | The frame loop and the moving things: feeds dt and input into `rules.ts`, draws the run, reports to the store. |
| `Primitives.tsx` | Office look: floor, partitions, pillars, plants, backdrop, boxes, coins, the stand-in runner, the obstacle fallback shapes and the local `InstancedProp`. |
| `camera.ts` | `fitChase`: places the static chase camera so the runner and all three lanes fit below the HUD. Runs on resize only. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the three props only this game generates. |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split, `rules.ts` as pure functions with a seed and tests that prove the limits, the run state made once in `useState`, a `<Simulation>` component rendered **first** that runs `useRunFrame` → `rules.ts` → store calls, and `useModel(asset).failed` → primitive. Games never import each other.
- **This game adds four patterns** a later runner or scroller can copy (copy, never import):
  1. **Floating origin.** The runner stays at z = 0 and the world is drawn at `(distance − trackPosition)`. A 28 km run never loses float precision.
  2. **Integer clock.** The simulation counts whole milliseconds (with a carry) and whole millimetres. Distance is a closed-form function of time, so it never drifts and tests can check it exactly.
  3. **Rows placed by time.** Each obstacle row is placed by the time the runner reaches it, through the exact distance function. The fairness gap therefore holds across speed changes.
  4. **Fixed pools, instanced props.** Rows and coins live in fixed slots that are rewritten in place. Every prop type is one `InstancedMesh`. Nothing mounts, unmounts or allocates after the first frame.
- **Do not copy:** the office primitives, the coin spin and the stand-in runner. They are decoration for this game.

## Concept

The Play50 Runner is late for a meeting and sprints down an endless office corridor with three lanes. Desks, printers and stacks of boxes are low, so you jump them. Chairs, coffee carts and water coolers are tall, so you change lanes. Coins float along the lanes. The corridor gets faster every 20 seconds, and one hit ends the run. The score is the metres run plus 50 per coin. The look is the Play50 vinyl-toy style in a bright office, accent `#fbbf24`.

## Controls

Matches `meta.ts` (`scheme: "runner"`): "Left / right to change lane, Space to jump" and "Swipe left / right, swipe up to jump".

- **Keyboard.** Left/A and Right/D change lane by one. Space jumps, and W/Up is an alias. Esc or P pauses (GameShell).
- **Touch.** Swipe left or right to change lane, swipe up to jump (core `SWIPE_MIN_PX` 30 px within `SWIPE_MAX_MS` 700 ms, read on release). Taps and swipe down do nothing. `touchControls: ["swipe"]` renders no joystick and no buttons.
- **Edges, not holds.** The core only gives held axes for the arrows, so `rules.ts` turns them into one-shot events. A lane event fires when `moveX` crosses ±0.5 from the dead zone, and it re-arms only after `|moveX|` falls back below 0.5. Holding Left changes one lane. Left and Right together give `moveX` 0, which is no event. W/Up works the same way on `moveY < −0.5`. Space uses `jumpPressed`. A swipe is a one-frame `swipe` value.
- **Lane change.** Each event moves the target lane by one, clamped to 0..2. An event at an outer lane does nothing (the runner only wobbles). The runner slides sideways at 10 m/s, so one lane takes 200 ms. A new event mid-slide retargets at once, so a second Left continues to the far lane and a Right turns back. Lane changes also work in the air.
- **Jump.** On the ground, a jump starts on the frame of the event. Its phase counts from that frame's start, so after the step it equals the step length. In the air, a jump pressed within the last 150 ms before landing is kept and starts on the landing frame. An earlier press is dropped. Order inside one frame: lane events (keyboard, then swipe), then the jump.

## Constants

Rules use whole millimetres and whole milliseconds. 1 world unit is 1 m.

| Name | Value |
|---|---|
| Lanes | 3, centres x = −2, 0, +2 m (lane width 2.0 m). The runner starts on the middle lane. |
| Runner hitbox | half-width 0.35, depth 0.5 (±0.25 around z = 0), height 1.3 from the feet. Drawn about 1.55 tall: the head is not in the hitbox. |
| Speed | 8 m/s at the start, +1 m/s every 20 s of simulation time, cap 16 m/s from 160 s |
| Lane change | 10 m/s sideways = 200 ms per lane, retarget at once |
| Jump | airtime `JUMP_MS` 700 ms, apex 1.10 m (feet), `y = floor(4 · 1100 · j · (700 − j) / 700²)` mm, j = ms since take-off |
| Jump buffer | 150 ms before landing |
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
- **Every timer advances only by this step:** the run time `simMs`, the jump phase, the slide, the speed stage, track generation and the run limit. Nothing in the rules reads `Date.now`, `performance.now` or `state.clock.elapsedTime`. Visual-only motion (coin spin, idle bob in the countdown, the crash tumble) uses `run.time`, a separate visual clock advanced by `min(delta, 0.1)` in `useFrame`. It never feeds the rules. Pause stops both.
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

- Scene draws a new 32-bit seed on every mount, in its lazy `useState` initializer: `crypto.getRandomValues(new Uint32Array(1))[0]`. GameShell remounts the Scene (`key = runId`) on start, retry and restart. PRNG: **mulberry32** (`createRng`, as in robot-collector). Rows use `createRng(seed)`. Coins use a second stream, `createRng((seed ^ 0x9e3779b9) >>> 0)`, so coin patterns never shift the rows. The same seed always gives the same track, whatever the frame rate. The draws depend only on the row index and the slot index, never on frame timing. A coin's raise-or-remove check reads only rows that are always placed before that coin (see Coins), so it does not depend on frame timing either.
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
5. **Landing in time.** A runner that jumped row k has at most 700 − 103 = **597 ms** of air left after leaving it. Landing plus the 115 ms lead needs ≤ 712 ms, which leaves 238 ms of the 950 ms gap. A runner that took a pointless jump right at `out_k` has at most 700 ms of air: 815 ms needed, 135 ms spare. The steer from step 2 runs in parallel, because lane changes work in the air. The press window from step 4 is therefore at least 135 ms long. That is longer than the longest frame (50 ms), so some frame always starts inside it. The jump buffer also starts a press made during the last 150 ms of the descent on the landing frame.

**Timing windows for one jump** (the span of press times that clear a jumpable): desk and printer 494 − 150 = **344 ms** at 8 m/s and 419 ms at 16 m/s. Boxes 470 − 162.5 = **307 ms** at 8 m/s and 389 ms at 16 m/s. The numbers grow with speed because the overlap gets shorter.

The proof needs only the gap, the steer time and the jump arc. It does not need the extras, which only make the game easier. The checks happen once per frame at frame ends, and steps 2–5 hold for any sequence of steps ≤ 50 ms. A design prototype of the integer rules ran a bot that follows exactly this strategy (and one that adds a pointless jump after every row) for 40 seeds at 60, 30, 20 and 144 fps. All 320 runs reached the 29:55 limit without a hit. `rules.test.ts` repeats this with the real rules.

### Coins

- Coin slot i sits at track position `20 m + 10 m · i`. Each slot holds at most one coin, in one lane. The coin stream draws runs of 3–6 slots in one random lane, then 1–3 empty slots.
- A slot whose coin box would touch an obstacle hitbox in its lane (`|s_i − s_row| ≤ hd_obstacle + 0.35`) is adjusted. Over a jumpable the coin is raised to y = 1.9 and collected only in the air (feet > 0.25 m), so a jump earns it. Over a dodge obstacle the slot stays empty. A coin is never inside a dodge hitbox.
- **The check never misses a row, at any frame rate.** It runs once, when the coin is written into its pool slot, against the rows already placed. A coin can touch a row only if `s_i ≥ s_row − hd_obstacle − 0.35 m`, so that row's front edge `s_row − hd − 0.25 m` is at most `s_i + 0.1 m`. Slot i is written once `s_i ≤ distance + 72 m`. By then, every row whose front edge is at most `s_i + 2 m` is already placed, because rows are placed up to 74 m ahead and before the coins in every step (and in `createRun`). Even if one long frame crosses both thresholds, the row is placed first. With equal look-aheads, a coin could be written one frame before the row in front of it. Whether that happened would then depend on the frame rate. A design prototype of the integer rules showed this. It ran 300 seeds for 300 s each and compared 60 fps against 144, 30 and 20 fps, fixed 1 ms and 50 ms steps, and random 1–50 ms steps. Coins differed for 134 seeds. With the 74 / 72 m split there were no differences, and every coin matched a check against the full row list.
- A coin is collected when the runner's hitbox overlaps the coin box: depth `|s_i − distance| < 0.6 m`, sideways `|x − lane| < 0.7 m`, and the heights overlap. A ground coin is missed when the feet are above 0.95 m, so jumping over a ground coin skips it. Overlap along the track is 1.2 m and one frame moves at most 0.8 m, so no coin is skipped by a long frame.
- Coin density: **at most 1 coin per 10 m of track, counting all three lanes together** (one slot, one coin). That is ≤ 0.8 coins/s at the start and ≤ 1.6 coins/s at the cap, whatever lanes the runner picks.

### Collisions and the end of a run

- Order inside one step: input edges → clock (`simMs`, distance, slide, jump phase) → track recycle and spawn → **obstacles** → coins → score → run limit. A hit ends the step at once: nothing is collected on that frame.
- **Hit:** sideways, depth and height all overlap (`feet < top`). `setScore(capScore(score, elapsedMs))`, then `end("lose")`, then `playSfx("hit")`. The runner tumbles back in the result view. That is visual only, driven by `run.time`, and the frameloop keeps running during "over".
- **Run limit:** at `simMs ≥ 1,795,000`, `setScore(capScore(...))` and `end("win")`. GameShell shows "You did it!". The server accepts runs up to 30:00, so the game stops itself 5 s before that.
- Quit (Exit or leaving the page) does not submit. Pause never ends the run.

### One hit ends the run (why not one extra life)

- It is the genre's rule and this card's promise ("Late for the meeting. Run!", difficulty 1). Every run has the same shape, and the fairness proof shows every hit was avoidable.
- An extra life needs a recovery rule, and that rule needs its own proof. After a hit, the runner sits inside an obstacle with the next row ≥ 950 ms away. It would need invulnerability (blinking, passing through obstacles) or a rewind, plus a lives chip in the HUD. Both add states that the 950 ms argument does not cover.
- The forgiveness goes into the numbers instead: hitboxes smaller than the props, a 1.3 m hitbox on a 1.55 m runner, 0.95 m lane clearance, jump windows of 307–419 ms, a 150 ms jump buffer, and retargeting mid-slide. Retry is one tap and a new seed.
- Lives would not change the scoring proof. The bound below does not depend on how the run ends.

## Scoring

| Event | Points |
|---|---|
| Distance | +1 per **full** metre run: `floor(distanceMm / 1000)` (rounded down, so the HUD never shows a metre not yet run) |
| Coin | +50 |

`score = floor(distanceMm / 1000) + 50 * coins`. Scene calls `setScore(score)` whenever the number changes (at most 16 times a second plus coins) and `setStat("coins", coins)` on every pickup. Scene never calls `addScore`, so the HUD can never drift from the formula. The submitted duration is the store's `elapsedMs` (default, no `finalScore` override).

Examples: a hit at 45.0 s of play is 390 m. With 20 coins that is 390 + 1000 = **1390**. Even with a coin in every slot, a run that reaches the limit at 28,000 m scores at most 28,000 + 50 × 2,799 = **167,950**.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 200000, `base` 0, `maxPointsPerSec` 100, duration 3–1800 s. The server accepts a run only if:

- `score <= 200000`
- `3000 <= duration_ms <= 1800000`
- `score * 1000 <= 100 * duration_ms`, that is, `score <= 100 * t` with t = duration_ms / 1000

Let `e` be the store's `elapsedMs` at the end, `d = Math.round(e)` the submitted duration, and `τ` the simulation time in whole ms.

1. **Clock.** `RunClock` (priority −1) and `useRunFrame` (priority 0) see the same clamped delta. The only simulation step the clock does not count is the frame where the countdown turns into "playing", which is ≤ `MAX_FRAME_DT` = 50 ms. Pause stops both. The carry only rounds down. So `e − 1 ≤ τ ≤ e + 50`, and `τ ≤ d + 50`. The test drives the real `createArcadeStore` frame by frame the way `ShellStage` does and checks this bound, as robot-collector does.
2. **Coins are bounded by distance.** A coin at `20 + 10 i` m can only be taken once `distance > 20 + 10 i − 0.6` m. So `coins ≤ floor((D − 19.4) / 10) + 1 < D / 10` for D in metres, and 0 below 19.4 m.
3. **Score is bounded by distance.** `score ≤ D + 50 · D / 10 = 6 · D(τ)`. At the cap that is 16 m/s + 1.6 coins/s × 50 = **96 points/s**, under 100.
4. **Rate check, including the untimed frame.** Speed never exceeds 16 m/s, so `D(τ) ≤ D(d + 50) ≤ 16 · d / 1000 + 0.8` m. Then `6 · D(τ) ≤ 0.096 · d + 4.8`, which is ≤ `0.1 · d` for every `d ≥ 1200 ms`. Every submitted run is longer than that (step 6). Using the real speed schedule instead of the cap, the largest `6 · D(d + 50) / (0.1 · d)` over d = 4950 … 1,795,050 ms is **0.936**, at the run limit. ✓
5. **Max score.** The run stops at τ ≤ 1,795,049, where D = 28,000.8 m at most. So `score ≤ 6 × 28,000.8 ≈ 168,005`, and the bound with a coin in every slot is 167,950. Both are < 200,000. The cap is never reached before 1800 s, because the run never gets there. ✓
6. **Duration window.** The first row is entered at τ = 5000 ms, so the earliest hit gives `e ≥ τ − 50 = 4950`, which is ≥ 3000. That run scores at most 40 + 50 × 3 = 190 against a cap of 495. The run limit gives `e ≤ τ + 1 ≤ 1,795,050`, which is ≤ 1,800,000. Quit does not submit. ✓

`capScore(score, elapsedMs)` = `min(score, 200000, floor(100 · Math.round(elapsedMs) / 1000))` is applied before `end()` as a safety net only. The tests prove it is a no-op for every reachable run. **The limits in `meta.ts` and `arcade-games.json` are correct and unchanged.**

## Scene and camera

- **Floating origin.** The runner stays at x = lane position, z = 0. Rows, coins and decor are drawn at `z = (distance − s) / 1000` m (negative = ahead). The floor and the side walls are long planes whose texture offset scrolls by `distance mod tile`. Pillars, plants and partition posts are instanced every 6 m and recycled like the rows. A static backdrop (windows, city) sits behind the fog to fill the band above the horizon. There is no ceiling: it would block the chase camera.
- **Chase camera.** It sits behind and above the runner, at x = 0, and never pans sideways, so all three lanes are always on screen. It does not follow jumps. The runner never moves along z, so the camera is static for the whole run and only refits on resize, rotation or a change in the obstruction. Scene renders `<CameraRig camera={fitted} />` without `follow`. There is no FOV kick or shake, because they would break the fit.
- **`fitChase(width, height, insets, obstruction)`** (`camera.ts`, the robot-collector `fitView` idea):
  - Safe rect: top 64 px (10 px HUD padding + 44 px chips and buttons + 10 px of air) + safe-area top. Bottom 16 px + safe-area bottom + `useBottomObstruction()` (cookie banner). Sides 8 px + insets. There is **no joystick box**, because `["swipe"]` renders no touch controls.
  - Pitch is fixed at **16°** down. Vertical FOV is **60°** when the canvas is portrait (aspect < 1) and **50°** otherwise.
  - The runner's feet (0, 0, 0) are pinned at 20% of the safe height above its bottom edge. The camera slides along that ray to the **closest** distance (binary search) that satisfies all four rules: (a) the runner box x ±2.45, y 0–2.65 (jump apex included), z ±0.3, and the lane edges x = ±3 m on the floor over the same depth z ∈ [−0.3, +0.3] stay inside the safe rect (the near end, z = +0.3, is the widest and is the one that binds); (b) a standing runner is at most 25% of the safe height; (c) the camera is at least 3.2 m high (above the runner at the apex); (d) a 1.6 m obstacle top 50 m ahead (3.1 s at the cap) stays below the HUD.
- **Fitted views** (computed with that rule, insets 0, no banner; px are CSS px from the top-left; "px/m" is the scale across the track at that distance). The runner, feet, apex and lane-edge columns are measured at the runner's centre, z = 0. The lane edges are also given at z = +0.3, the near end that rule (a) checks:

| Viewport | FOV | Camera (x, y, z) → looks at | Binding rule | Runner (standing) | Feet y / apex top y | px/m at runner / 10 / 30 / 50 m | Lane edges x at z = 0 (at z = +0.3) | Floor y at 10 / 30 / 50 / 70 m | Horizon y |
|---|---|---|---|---|---|---|---|---|---|
| 375 × 812 | 60° | (0, 7.33, 10.43) → (0, 0, −15.13) | (a) width: the near lane edges touch the 8 px side margins | 81 px | 650 (162 above bottom) / 507 | 58 / 32 / 17 / 11.7 | 12 … 363 (8 … 367) | 452 / 336 / 294 / 272 | 204 |
| 812 × 375 | 50° | (0, 4.30, 6.98) → (0, 0, −8.02) | (b) runner = 25% of 295 px | 74 px | 300 (75 above bottom) / 169 | 51 / 23 / 11 / 7.2 | 253 … 559 (247 … 565) | 175 / 121 / 104 / 96 | 72 |
| 1280 × 800 | 50° | (0, 3.79, 6.15) → (0, 0, −7.06) | (b) runner = 25% of 720 px | 180 px | 640 (160 above bottom) / 317 | 123 / 52 / 24 / 15.6 | 270 … 1010 (254 … 1026) | 358 / 248 / 215 / 200 | 154 |

  Also checked with the same rule: 390 × 844 gives 85 px (rule (a) binds) and feet at y 675, and 915 × 412 gives 83 px (rule (b) binds) and feet at y 330. On every view the horizon is below the HUD line, so rule (d) never binds and the track is visible up to the fog (40–75 m). A 2 m lane is 23 px wide 50 m ahead on the portrait phone and 14 px in landscape. The camera is 3.8–7.3 m up, so it looks over the runner's head. The middle lane is hidden behind the runner only in the last 3–4.5 m (≤ 0.3 s at the cap), well after the decision point.
- **Frame order.** `<Simulation>` is the Scene's first child, so its step runs before `Obstacles`, `Coins`, `Runner` and the decor in every frame (same reason as robot-collector). Visual components only read `run` in `useFrame`.
- **No allocation in the frame loop.** `createRun(seed)` allocates everything once: 8 row slots (each with a fixed lane array), 10 coin slots, both rng closures, the input latches and the scratch `Object3D` / `Matrix4` used to write instance matrices. A step rewrites fields in place. Instance counts change through `mesh.count`. Store calls happen only when a value changes: `setScore` on a new metre or coin, `setStat` on a pickup, `setLevel(k + 1)` on a stage change. A stage change also flashes the lane stripes amber for 0.5 s (visual only).
- **`InstancedProp`** (local in `Primitives.tsx` until the core has one). When the GLB loads, every mesh inside it becomes one `InstancedMesh` with capacity 24, sharing the GLB's geometry and material. Its node transform and the asset's `scale` / `rotationY` / `yOffset` are folded into each instance matrix. `frustumCulled = false`, because instances spread 80 m from the mesh origin. Missing GLB: a coloured primitive `InstancedMesh` (`useModel(asset).failed`). Boxes and coins are always primitives.
- **Draw calls (estimate, to be measured):** floor 1, walls 2, decor 3, backdrop 1, six obstacle types 6 with GLBs (about 12 with the two-part fallbacks), obstacle contact shadows 1, coins 2 (disc + glow), runner 1–6, blob shadow 1: **about 20–35**, far under 150. No shadow maps.
- `environment`: background and fog `#dbeafe`, fog 40–75 m, `lighting: "indoor"`.

## Assets

| Model | Source | Spec | Role | Fallback until the GLB exists |
|---|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` (character, rigged if the Mixamo pass is done) | `assets/shared.spec.json` | player | Orange hoodie capsule body, round head, headband, cylinder arms and legs swung in code |
| desk | **shared** `models/3d/shared/desk.glb` | `assets/shared.spec.json` | jump | Wood desktop slab + modesty panel (2 instanced boxes) |
| chair | **shared** `models/3d/shared/chair.glb` | `assets/shared.spec.json` | dodge | Seat + tall backrest (2 instanced boxes), slate |
| printer | **this game** `models/3d/office-escape/printer.glb` | `./assets.spec.json` | jump | Grey box + white paper slab |
| coffeeCart | **this game** `models/3d/office-escape/coffeeCart.glb` | `./assets.spec.json` | dodge | Red cart box + silver urn cylinder |
| waterCooler | **this game** `models/3d/office-escape/waterCooler.glb` | `./assets.spec.json` | dodge | White box + blue bottle cylinder |
| boxes, coins, floor, walls, partitions, pillars, plants, backdrop | primitives in code | none | – | (always primitives) |

- **Generate only the printer, the coffee cart and the water cooler:** three text-to-3D props, `Gen-2.5-Low`, `qualityOverride` 1500 / 2500 / 2000, one attempt each, so 3 generations (about 1.5 credits at 0.5). The desk, chair and runner are already in `shared.spec.json` and are generated and billed there, not here.
- **Universe `shared-cast`, seed 5050, not a new `office` universe.** These three props stand next to the shared desk and chair in the same rows. In this pipeline a universe is one seed plus one prompt style, and the desk and chair are `shared-cast` 5050. Matching both makes the five office props one toy set. A separate `office` seed would make the generated props drift from the shared desk and chair beside them. clean-city made the same choice for its litter. The prompts use the shared desk and chair suffix word for word ("stylized toy-like 3D game asset, … no base or ground") and add "no text or logos", because a printer panel, a coffee cart and a bottle label invite printed text. The targets stay `office-escape`. They are not shared, because no other planned game uses them.
- A prop GLB should face +z (towards the oncoming runner) and stand on y = 0. `assets.ts` sets `scale` so the drawn sizes match the obstacle table: the desk with its desktop at about 0.6 m, the chair with its backrest at about 1.4 m. That is a tuning step in the assets PR. The shared desk has a monitor that reaches about 0.95 m. The hitbox is the desktop (0.55 m), and a jump is above 0.95 m only for about 260 ms around the apex, so a badly timed jump can visibly skim the monitor. That is cosmetic. See Known issues.
- The runner GLB faces +z by convention and runs towards −z, so `assets.ts` uses `{ ...SHARED_ASSETS.runner, rotationY: Math.PI }`, plus `animations` when clips exist.

### Runner animation

1. **Rigged GLB with clips** (Mixamo pass done; clip names go into `assets.ts` `animations: { run, jump }` in the assets PR). The run clip loops with `timeScale = 0.75 + speed / 32` (1.0 at 8 m/s, 1.25 at 16 m/s). The jump clip plays once, scaled to 700 ms. The code effects below are added on the root.
2. **GLB without clips.** Whole-body code animation: a vertical bob of 0.06 m per stride, a forward lean of 6° + 0.5° per m/s over 8, a roll into the slide (±10°, from the sideways speed), squash on take-off and landing (scale y 0.85 / xz 1.08 for 80 ms, from the jump phase), stretch while rising, and a slight tuck at the apex. A T-pose mesh keeps its arms straight out. If that looks wrong in review, `assets.ts` forces the primitive runner until the rigged GLB exists (one line).
3. **No GLB.** The primitive runner with the same root effects, plus arms and legs swinging ±35°.

Stride phase = `distance / 2.4 m`, so legs move with the ground and stop when it stops (countdown, pause, over). The squash timers come from the jump phase (simulation state). The countdown idle and the crash tumble use `run.time`. Nothing reads R3F's clock.

## HUD

GameShell draws Score, **Played** (the game is untimed: no `durationMs`) and `hudStats: [{ key: "coins", label: "Coins" }]`. Distance is shown through the score, which goes up 1 per metre. There are no lives and no custom HUD. At 375 px the row is about 330 px wide (Score "167,950", Played "29:55", Coins "2799", mute, pause), one line. Scene writes `setStat("coins", n)` on every pickup.

Planned `index.tsx`:

```ts
const definition: GameDefinition = {
   slug: "office-escape",
   Scene,
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
- **Countdown:** the world is still (distance 0), the runner idles on the start line, and the rows up to 74 m and the coins up to 72 m are already there. The countdown-to-playing frame is the one untimed step (proof step 1).
- **Resize or rotation mid-run** refits the camera only. Rules, lanes and controls do not depend on the view.
- **Retry and restart** remount the Scene (`key = runId`): a new seed, new pools, a new runner. Nothing carries over. React strict mode double-creates the run in `useState`, which is harmless.
- **Missing GLB:** its instanced primitive. A GLB that breaks while rendering falls back the same way. Collision never depends on the model.
- **Very long runs:** distance stays an exact integer (≤ 28,000,000 mm) and draw positions are relative to the runner, so there is no precision loss. The run ends itself at 29:55 ("You did it!").

## Test plan

`rules.test.ts` (vitest):

- **Clock.** The carry turns 1000 frames of 1/60 s into 16,666 ms, the floor of the sum and never more. Steps are 0..50 ms. dt ≤ 0 does nothing.
- **Speed and distance.** `speedAt` is 8 at 0 ms, 9 at 20,000 ms, 16 from 160,000 ms, and never above 16. `distanceAt` matches the stage table (160, 340, …, 1840 m; 28,000 m at 1,795,000 ms). `timeAt` is the exact inverse: `distanceAt(timeAt(s)) ≥ s > distanceAt(timeAt(s) − 1)`.
- **Jump.** `y(0) = y(700) = 0`, the apex is 1100 mm at 350 ms, feet ≥ 550 mm for j ∈ [103, 597] and ≥ 600 mm for j ∈ [115, 585]. The apex is below every dodge top, so no dodge obstacle can be cleared in any phase.
- **Input.** Held Left gives exactly one lane change. Release and press again gives another. Left and Right together give none. Swipes left, right and up work. Space and W/Up are edges. A jump in the air is buffered only in the last 150 ms. A retarget mid-slide reverses at once. The outer lanes clamp. Slides take 200 ms per lane at any frame rate.
- **Track (1000 seeds × 300 s, 100 seeds × 1,795 s).** Same seed, same rows and coins. A different seed changes them. **Frame-rate independence:** each seed run at 144, 60, 30 and 20 fps (through the carry), with fixed 1 ms and 50 ms steps, and with random steps of 1–50 ms gives identical row sequences and identical coins: the slot, the lane and the raised or removed flag, starting from the `createRun` fill at mount. Every coin's flag also matches a reference check against the full row list, not only the rows alive when it was written. The two streams are independent (changing the coin seed leaves the rows unchanged). Every row has a passable lane, and no row has three dodges. `in_{k+1} − out_k ≥ 950` and `in_0 = 5000`. Alive rows never exceed 7 and alive coins never exceed 9, so the generator never finds a full pool. Coin slots sit at 20 + 10 i m with at most one coin each. No coin sits inside a dodge hitbox, and raised coins appear only over jumpables.
- **Collisions.** Every dodge type hits in every jump phase. A jumpable is cleared exactly when the feet are above its top on every overlapping frame. A runner centred in a neighbouring lane never touches. At 50 ms frames and 16 m/s, no obstacle or coin is skipped.
- **Fairness bot.** A bot that follows the proof's strategy (steer after leaving a row, press jump on the last frame at or before `in − 115`), and a sloppy bot that also jumps right after every row, play 50 seeds each at 60, 30, 20 and 144 fps. They must reach the 1,795,000 ms limit and end with `"win"`. If one hits, the test prints the seed, the row and the frame.
- **Scoring.** `floor(mm / 1000) + 50 · coins`. The examples above. `withinServerLimits` matches the server formula. `capScore` is a no-op on every bot frame and on the theoretical maximum.
- **Proof.** The real store, driven like `ShellStage` through countdowns, pauses, resumes, restarts and frames up to 300 ms, has exactly one untimed step ≤ 50 ms per run, and `e − 1 ≤ τ ≤ e + 50`. `6 · D(d + 50) ≤ 0.1 · d` for every whole ms d in 4950 … 1,795,050 (maximum ratio 0.936). The max score at the limit is 167,950 ≤ 179,495 and ≤ 200,000. A limit end submits ≤ 1,795,050 ms. The earliest possible hit submits ≥ 4950 ms. An idle runner either hits a row in its lane at ≥ 5000 ms or reaches the limit.

Browser (production build, flags on with the API mock, headless Chrome over CDP):

- **Desktop 1280 × 800, keyboard:** start, countdown, run past 20 s (the score rate goes from 8 to 9 m/s), a held Left (exactly one lane change), Space jumps over a desk and collects a raised coin, a 2.5 s pause in mid-jump (same height after resume), then a deliberate hit on a chair → "Game over". The score must equal `floor(m) + 50 · coins` for the submitted duration. Retry gives a different track.
- **375 × 812 and 812 × 375, touch emulation:** swipes are sent as CDP touch drags (left, right, up). The fit matches the table within ±2 px: runner height, feet y, apex top y, lane edges at z = 0 and at z = +0.3 (on 375 × 812 the near ends sit on the 8 px side margins), horizon below the HUD. These are the points rule (a) uses, so the rule, the table and this check measure the same thing. The HUD is one row. No joystick is shown. With the cookie banner open, the runner sits above it.
- **Performance:** `renderer.info.render.calls` ≤ 150 and 60 fps on desktop and in phone emulation. `renderer.info.memory` (geometries, textures) stays constant from 5 s to 60 s, which shows the pools: no remounts and no new materials.
- **Missing GLBs** show the primitives with the same hitboxes.

## Known issues and core gaps

- **No one-shot events for the arrows.** The core has `jumpPressed` and `actionPressed`, but Left, Right and Up are held axes only. `rules.ts` detects edges itself, so a key pressed and released between two frames (under 16 ms) is missed. Core candidate: `leftPressed`, `rightPressed` and `upPressed` like `jumpPressed`.
- **Swipes fire on release.** The swipe adds the gesture's own time (typically 80–200 ms) before the lane change starts. The fairness slack (135–238 ms beyond the worst case, plus the extras) absorbs a normal swipe, but a slow one at the cap can be late. Core candidate: emit the swipe as soon as the pointer has moved 30 px, not on `pointerup`.
- **No instanced GLB in the core.** `<Model>` clones the GLB for each placement. The game copies a local `InstancedProp`. Core candidate, along with robot-collector's `useInstanceMatrices`.
- The other gaps are the ones robot-collector recorded, and this game keeps copies until the core has them:
  - No pause-safe animation clock (`run.time`).
  - Frame order depends on `<Simulation>` mounting first.
  - `CameraRig` cannot fit a box into the free screen area (`fitChase`).
  - The core does not report overlay rects (the HUD height is copied as 64 px; the banner comes from `useBottomObstruction`).
  - The untimed countdown frame (≤ 50 ms, covered by the proof).
  - `<Model>` has no `fallback` prop (the scene asks `useModel(asset).failed`).
- **Runner rig not decided.** If the shared runner arrives as a static T-pose GLB, the code animation runs with straight arms. The fallback is one line in `assets.ts` (primitive runner until the rig exists). Clip names are set in the assets PR.
- **Desk monitor.** The shared desk was prompted with a monitor (up to about 0.95 m). The hitbox is the desktop, and a late or early jump can visibly skim the monitor. If players read it as unjumpable, use the primitive desk or a monitor-free desk in a later shared-spec pass.
- **Catalog drift.** `skills.md` (models row) still says universe `office` for this game, and plan §4 lists desk and chair under this game's generations. This spec uses `shared-cast` 5050 and generates only the printer, the coffee cart and the water cooler, because the desk and chair are in `shared.spec.json`. Update the catalog in the next pass.
- The `index.tsx` stub's two instruction lines are placeholders. The planned four lines are above.
- Until the GLBs exist, each load requests the three game GLBs and the shared runner, desk and chair, gets 404s, and shows the primitives.
