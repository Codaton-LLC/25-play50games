# Knight Training Arena

Owner: Antigravity. Slug: `knight-arena`. Skill game 8 (order 28 in catalog, game 18 in expansion), complexity 3. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §18. Gate G0 (game design); the build fills `Status`. Units: metres, seconds; x east (+x = right), z south (+z = front/camera), y up. Every "Changed from spec" line says what and why.

## Levels (P-61, 2026-10-24)

Five levels through the core level system (`core/README.md` "Levels"): `levels.ts` holds the pure `KnightLevel` configs, `createRun(seed, level)` / `createBeatMap(seed, level)` take one, the scene reads it with `useKnightLevel()` (`useLevel<KnightLevel>()`), `index.tsx` declares the five `LevelSpec`s, and `meta.ts` the titles, limits and clear scores. Level 1 is today's game: the frozen 111-beat grid, the same caps, the 110 ms on-beat window, combo step 8, and `meta.scoring` 11600 / 58000–62000 / base 0 / pps 200. `rules.test.ts` is unchanged. Every level is the same octagon, the same eight posts and the same assets. The run always ends on the 60 s shell clock (`timeup`); a level clears when the score reaches `clearScore`. Level 5 has nothing to unlock, so it has no `clearScore`.

| Level | Title | Beats / slots | BPM | On-beat | Combo step | What changes | Lighting | clearScore |
|---|---|---:|---|---:|---:|---|---|---:|
| 1 | Basic Training | 111 / 140 | 100 / 110 / 120 / 130 | 110 ms | 8 | today's game | sunset, today's sky | 4400 |
| 2 | Moving Targets | 113 / 145 | 104 / 114 / 124 / 136 | 110 ms | 8 | far posts from beat 0; the marker slides from the near post to the far post | day | 4500 |
| 3 | Timed Course | 118 / 156 | 108 / 118 / 128 / 142 | 100 ms | 8 | tighter on-beat window; doubles from stage 2 | sunset, deeper sky | 5100 |
| 4 | Combo Arena | 122 / 163 | 112 / 122 / 134 / 148 | 100 ms | 6 | combo climbs every 6 hits; more shields and tomatoes | night | 6000 |
| 5 | Royal Trial | 128 / 176 | 116 / 128 / 140 / 156 | 90 ms | 6 | fastest grid and the tightest on-beat window | sunset, darker sky | — |

Plan adaptation (GAME 28): "moving targets" is the approach marker sliding along the same strike direction (no new dummy locomotion, no new GLB). "Tighter timing" shrinks only the on-beat bonus window; the miss window stays ±200 ms, and touch and keyboard share that window. The plan's attempt limit is not built: a miss that ended the run would fall inside the 58–62 s window this proof is built on (`docs/levels-backlog.md`). Difficulty is monotone (beats, slots and the ceiling rise; the on-beat window and the combo step never get easier: `levels.test.ts`).

### Server limits, one proof per level

Same sources as level 1. A real slot pays 20 × combo once (a spin-cleared slot pays the same 20 × combo). Combo is 1 / 2 / 3 / 4. Step 8: hits 1–8 / 9–16 / 17–24 / 25+. Step 6: hits 1–6 / 7–12 / 13–18 / 19+. A paid spin needs ⌈100 / 15⌉ + 1 = 8 slots and then pays 50, so at most ⌊slots / 8⌋ spins. Tomatoes only subtract. The run cannot end before the shell clock, so the server sees ~60 s on every level: `minDurationMs` 58000 and `maxDurationMs` 62000 stay, with the same one-frame overshoot. `base` 0. `pps` = ⌈maxScore / 58⌉, so 58 s × pps ≥ maxScore and the rate line never binds inside the window. `maxScore` = ⌈ceiling × 1.04 / 100⌉ × 100.

Hit points are 80 × slots − 960 at step 8, and 80 × slots − 720 at step 6. Slots = beats + double pairs (a shield is two beats, already inside the beat count; a double adds one extra slot).

| Level | slots, step | hits | spins × 50 | ceiling B | maxScore | pps | B / maxScore |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 | 140, 8 | 10240 | 17 × 50 = 850 | 11090 | 11600 | 200 | 95.6 % |
| 2 | 145, 8 | 10640 | 18 × 50 = 900 | 11540 | 12100 | 209 | 95.4 % |
| 3 | 156, 8 | 11520 | 19 × 50 = 950 | 12470 | 13000 | 225 | 95.9 % |
| 4 | 163, 6 | 12320 | 20 × 50 = 1000 | 13320 | 13900 | 240 | 95.8 % |
| 5 | 176, 6 | 13360 | 22 × 50 = 1100 | 14460 | 15100 | 261 | 95.8 % |

Level 5's maxScore is 15100 / 11600 = 1.30× level 1 (decision 3: ≤ ~3×). Each level's slot count and ceiling are strictly above the previous, so a harder level offers more points. The numbers are `PROPOSED_LEVEL_LIMITS` in `rules.ts` and `meta.levels`. Claude copies levels 2–5 into `arcade-games.json` at merge. `levels.test.ts` checks the formula, that the DP optimum on 80 seeds per level is ≤ B and ≥ 90 % of maxScore, and that the store oracle on seeds 101 / 202 / 303 at 60 Hz reaches ≥ 97 % of that map's optimum inside `withinServerLimits` with `capScore` a no-op.

Clear scores sit under the human bot's lowest run on these seeds and far above a direction mash (see Status). Level 5's winnability check uses 6400 inside the test only.

The section "Server limits and why they hold" below is the level-1 proof and is unchanged.

## Concept

A young knight trains on the castle green at sunset. The knight stands at the centre of an octagonal wooden training ring surrounded by 8 wooden training dummies (4 near on the cardinal rays + 4 far rotated $22.5^\circ$ off the cardinal rays). Targets pop up on the beat showing directional arrows; the knight strikes in rhythm with a sword to build combo multipliers up to ×4. Shield dummies require two strikes, and tomato decoys must be avoided. A full spin meter unleashes a 360° sweeping spin attack hitting all active real targets. Accent `#facc15`.

## Controls

`meta.ts`: `controls.scheme = "timing"`. `GameDefinition` (`index.tsx`): `touchControls: ["action", "swipe"]` (no joystick: strikes are swipes, and the stick covered the arena on phones), `touchLabels: { action: "Spin" }`.

- `keyboard`: "Arrows / WASD to strike, Space to spin"
- `touch`: "Swipe to strike, Action to spin"
- Directional strikes read `input.pressed.up / down / left / right` (one-frame latched). Swipes are already included in `pressed` by core convention (never also read `swipe`). Each cardinal key/swipe (`up` = N, `down` = S, `left` = W, `right` = E) addresses both the near cardinal dummy ($0^\circ$) and the far dummy ($+22.5^\circ$ clockwise off that cardinal ray) in that sector: both display the same cardinal chevron arrow, and even a diagonal touch swipe aimed directly at a $22.5^\circ$ far dummy has $|\tan 22.5^\circ| = 0.414 < 1$, so `inputController.ts` still classifies its dominant axis as the matching cardinal `pressed` direction. Space / E / Enter and the 72 px bottom-right touch **Spin** (`Action`) button read `actionPressed || jumpPressed` to fire the spin attack when the spin meter is at 100%. `M` key or the HUD button toggles the optional metronome click. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ARENA`, `KNIGHT`, `TARGETS`, `BEAT`, `TIMING`, `COMBO`, `SPIN`, `SCORING`, `scoreCeiling`) and are proven in `rules.test.ts`.

- **Arena** (`ARENA`): octagonal ring radius 3.5 m enclosed by `<Fence path={RING_PATH}>` (`core/kit`, `RING_PATH = createPath(OCTAGON_POINTS, { closed: true })`), surrounded by green grass `#557a3a`, two backdrop towers (`EXPANSION_ASSETS.castleTower`, 6 m tall at (−4.2, −3.5) and (4.2, −3.5)), and four leafy trees (`EXPANSION_ASSETS.leafyTree`, 3.5 m tall).
- **Knight & reach** (`KNIGHT`, `poses.ts`): `EXPANSION_CHARACTERS.knight` (1.75 m tall including helmet plume, scale $1.75 / 1.884 = 0.929$, auto-rigged with `KNIGHT_LANDMARKS` from `core/sharedAssets`). Stands at (0, 0, 0). Carries a 0.85 m sword (`ASSETS.sword`, `/models/3d/knight-arena/sword.glb`) in `attach.handR` ($0.15\text{ m}$ hilt + $0.70\text{ m}$ blade ahead of wrist) and a 0.55 m heater shield (`ASSETS.shield`, `/models/3d/knight-arena/shield.glb`) in `attach.handL`.
  - **Facing**: root group yaw turns toward the resolved strike target's post yaw ($\text{atan2}(x, z)$) via `turnTowards(from, to, amount)` (`core/math`) at $40\text{ rad/s}$ and keeps facing the last strike until the next directional input.
  - **Swings, lunge & surface contact**: 4 directional shoulder-level slashes (duration 0.25 s, contact at $u = 0.5$, sword tip kept at $y \le 1.80\text{ m}$) built from `aimArm(out, side, ux, uy, uz, fx, fy, fz, roll)` + `turnBone` on spine/chest. Standing sword-tip reach from the knight's root meets the **near dummy's front surface** ($r_{\text{near}} - r_{\text{dummy}} = 1.60 - 0.32 = \mathbf{1.28\text{ m}}$) within $\le 0.15\text{ m}$. For a far strike ($r_{\text{far}} = 2.60\text{ m}$, **front surface at $2.60 - 0.32 = \mathbf{2.28\text{ m}}$** along its $+22.5^\circ$-offset ray), the knight steps **$1.00\text{ m}$ outward and back** along that $22.5^\circ$ ray ($\sin(\pi u)$ root translation peaking at $1.00\text{ m}$ at $u = 0.5$, total tip reach $1.00 + 1.28 = \mathbf{2.28\text{ m}}$), driven by a **real `walkPose` stride step** (`POSE_MASK.legs` under the upper-body slash) + `bodyLift` so both feet step out and back on the floor. At the $1.00\text{ m}$ lunge peak the knight's centre is $\mathbf{0.78\text{ m}}$ from the near dummy's centre ($> 0.40 + 0.32 = 0.72\text{ m}$, $0.06\text{ m}$ body clearance).
  - **Spin**: a 360° spin (0.40 s) rotates the **knight root group's yaw** by $2\pi \cdot \text{smoothstep}(u)$ while holding a horizontal cleave pose (`aimArm`). `cheerPose` plays on run end.
- **Target dummies** (`TARGETS`, 8 posts): 4 directions (`up`/N, `down`/S, `left`/W, `right`/E) × 2 distances:
  - **4 near dummies** at $r_{\text{near}} = 1.60\text{ m}$ on the cardinal rays: **Near-N** $(0.00, -1.60)$, **Near-S** $(0.00, +1.60)$, **Near-W** $(-1.60, 0.00)$, **Near-E** $(+1.60, 0.00)$ (surface at $1.28\text{ m}$).
  - **4 far dummies** at $r_{\text{far}} = 2.60\text{ m}$ rotated **$+22.5^\circ$ ($\pi/8\text{ rad}$)** clockwise off each cardinal ray: **Far-N** $(+1.00, -2.40)$, **Far-S** $(-1.00, +2.40)$, **Far-W** $(-2.40, -1.00)$, **Far-E** $(+2.40, +1.00)$ (surface at $2.28\text{ m}$).
  - Each dummy (`EXPANSION_ASSETS.dummy`, 1.50 m tall, collision radius $0.32\text{ m}$) stands on a ground target disc of radius $r_{\text{disc}} = \mathbf{0.50\text{ m}}$. Hits trigger damped spring wobble (`core/motion` `spring`, $k = 64, c = 8$).
- **Beat map & cumulative schedule** (`BEAT`): fixed `durationMs: 60000`. Runtime selects one of **3 fixed seeded beat maps** (`BEAT.MAP_SEEDS = [101, 202, 303]`; `createBeatMap(seed)` stays pure for any seed). Beat times form **one cumulative list** (`BEAT_TIMES_MS`, 111 beats total) with **no beat on a stage boundary** ($15, 30, 45\text{ s}$), first scoring beat at $t_0 = \mathbf{1.50\text{ s}}$, and **every hit slot $\le 59.6\text{ s}$** ($t_{110} = \mathbf{59.54\text{ s}}$):
  - **Stage 1** ($1.50\text{–}14.70\text{ s}$, 100 BPM = $600\text{ ms}$): 23 beats; near regular dummies only.
  - **Stage 2** ($15.25\text{–}29.43\text{ s}$, 110 BPM = $545.45\text{ ms}$): 27 beats; near + far regular dummies + shield dummies.
  - **Stage 3** ($30.43\text{–}44.43\text{ s}$, 120 BPM = $500\text{ ms}$): 29 beats; adds tomato decoys + same-direction near + far double pairs.
  - **Stage 4** ($45.23\text{–}59.54\text{ s}$, 130 BPM = $461.54\text{ ms}$): 32 beats; fast mixed (near + far regulars, shields, same-direction near + far double pairs, and off-direction tomato decoys).
  - **Map caps** (`BEAT` constants): across the 111 beats, every map caps total hit slots at `BEAT.MAX_HIT_SLOTS = 140` ($H = 140$), shield dummies at `BEAT.MAX_SHIELDS = 12` (each shield is 2 consecutive hit slots on the same post = 24 slots), same-direction near + far double pairs at `BEAT.MAX_DOUBLES = 29` (58 slots across 29 beats), and single-target beats at 58 ($24 + 58 + 58 = 140$ hit slots), plus `BEAT.TOMATO_COUNT = 18` tomato decoys.
- **Lead time, active window & timing judge** (`TIMING`):
  - **Lead time**: every target becomes visible **2 beats before** its beat time $t_b$, with a $0.60\text{ m}$ overhead billboard icon (centred at $y = 1.85\text{ m}$) and a 3D approach ring shrinking onto the $r = 0.50\text{ m}$ ground disc.
  - **Hittable window**: a target is live/active **only within $\pm 200\text{ ms}$** of $t_b$.
  - **Mid-frame timing fairness**: `rules.ts` judges timing at $t_{\text{judge}} = \text{time} - dt / 2$.
  - **On-beat vs off-beat**: $|t_{\text{judge}} - t_b| \le 110\text{ ms}$ (`TIMING.ON_BEAT_WINDOW_MS = 110`, Q3 Decision: one window for every device) is **on-beat** ($20 \times \text{combo}$); $110\text{–}200\text{ ms}$ is **off-beat** ($10 \times \text{combo}$). Level 1 uses 110 ms. Levels 3–5 tighten only this bonus window (100 / 100 / 90 ms); the ±200 ms miss window stays, and touch and keyboard still share it.
- **Strike arbitration, whiffs, expiry & target types**:
  - **(a) Unhit expiry**: any real target still unhit past $t_b + 200\text{ ms}$ expires as a **miss** and resets combo to $\times 1$. An expired tomato decoy disappears with 0 penalty and no combo change.
  - **(b) Whiff (empty direction)**: pressing a direction that has **no live target** within $\pm 200\text{ ms}$ is a **whiff**: resets combo to $\times 1$, awards 0 points, and adds 0% spin meter.
  - **(c) One strike per frame & swing overlap**: at most one directional strike is processed per frame (`up, down, left, right`). The 0.25 s swing animation is visual only and does not lock out input.
  - **(d) Near vs far same-direction & tomato separation**: when both near and far targets in the pressed direction are within $\pm 200\text{ ms}$, the strike hits the earliest beat $t_b$; if they form a same-direction near + far double pair at $t_b$, **one strike in that direction clears both** (Q5 Decision). The generator never schedules a tomato decoy in the same direction within $\pm 400\text{ ms}$ of a real target.
  - **(e) Shield dummy (2 hits)**: Hit 1 at $t_{b1} \pm 200\text{ ms}$ cracks the shield; Hit 2 is on the next beat $t_{b2}$ on the same post. Missing Hit 1 expires both Hit 1 and Hit 2 and resets combo.
  - **(f) Spin attack** (`SPIN`): real-target hits charge the meter by $+15\%$ on-beat ($+10\%$ off-beat), clamped to $100\%$. At $100\%$, Space/Action consumes the meter (`0%`) and sweeps $360^\circ$: it clears all active real targets ($20 \times \text{combo}$ each), skips tomato decoys, adds $+1$ combo hit per cleared target, does not charge the spin meter during the sweep, and awards $+50\text{ pts}$ spin bonus when $\ge 1$ active real target is cleared.
- **Combo** (`COMBO`): multiplier on the $k$-th consecutive real hit (`1 + Math.min(3, Math.floor((k - 1) / 8))`) starts at $\times 1$ for hits 1–8, **$\times 2$ on the 9th hit** (hits 9–16), **$\times 3$ on the 17th hit** (hits 17–24), and **$\times 4$ on the 25th hit** (hits $25+$). Level 1's step is 8. Levels 4 and 5 step every 6 hits (×2 on the 7th, ×3 on the 13th, ×4 on the 19th).

## Scoring

- Real target hit: $20 \times \text{combo}$ on-beat (level 1: $\le 110\text{ ms}$; levels 3–5: 100 / 100 / 90 ms), $10 \times \text{combo}$ off-beat (out to $200\text{ ms}$).
- Tomato decoy struck: $-50\text{ pts}$ (`run.score = Math.max(0, run.score - 50)`), resets combo to $\times 1$.
- Spin attack: $20 \times \text{combo}$ per cleared active real target $+ 50\text{ pts}$ spin bonus (when $\ge 1$ target cleared).

### Server limits and why they hold

`meta.scoring` = `arcade-games.json`: **maxScore 11600, 58000–62000 ms, base 0, maxPointsPerSec 200**. The server rejects a run when `score > maxScore`, `score · 1000 > base · 1000 + pps · durationMs` or the duration is outside the window (`core/limits.ts`).

1. **Score sources** (all in `rules.ts`): a real hit pays `SCORING.ON_BEAT_PTS` (20) × combo on-beat, 10 × combo off-beat; a spin pays `SCORING.SPIN_HIT_PTS` (20) × combo per cleared slot plus `SPIN_BONUS_PTS` (50) once; a tomato only subtracts (−50). Combo is `comboForStreak(k)` = 1 / 2 / 3 / 4 for the k-th consecutive real hit (`COMBO.STEP_HITS` 8, `MAX_MULTIPLIER` 4). Every real slot is one cue and can be scored once (hit, spin-cleared or expired).
2. **Hit ceiling:** every map has exactly `BEAT.MAX_HIT_SLOTS` = 140 real slots (1000-seed invariant test). The best case is all 140 on-beat in one unbroken streak: 20 · (8·1 + 8·2 + 8·3 + 116·4) = 20 · 512 = **10240**. A spin-cleared slot pays the same 20 × combo, so spins add nothing over this except the bonus.
3. **Spin bonus ceiling:** a spin needs the meter at `SPIN.MAX_METER` 100 and resets it to 0; the best charge is `ON_BEAT_CHARGE` 15 per hit, so ⌈100 / 15⌉ = 7 charging hits per spin, and the bonus needs ≥ 1 cleared slot, which charges nothing. So each paid spin uses ≥ 8 of the 140 slots: ≤ ⌊140 / 8⌋ = 17 spins, 17 · 50 = **850**.
4. **Ceiling:** B ≤ 10240 + 850 = **11090** for any map and any input (`scoreCeiling()`, tested). The exact DP optimum (`solveOptimalSpinSchedule`) over seeds 1–1000 is 10990–11090; the three shipping maps (101 / 202 / 303) are 11040 each.
5. **Chosen numbers:** `maxScore` = ⌈11090 · 1.04 / 100⌉ · 100 = **11600** (4.6 % over the ceiling; the exact optimum 11090 is 95.6 % of it). `base 0`, `pps 200`: 200 · 58 s = 11600 ≥ maxScore, so the rate line never binds anywhere in the window and needs no time-shaped proof. 
6. **Duration:** the run has no win or lose end; it always ends on the shell's `durationMs` 60000 (`BEAT.DURATION_MS`) timeup. The played clock overshoots by at most one frame (dt ≤ 1/20 s), so a ranked run is 60000–60050 ms, inside **58000–62000 ms** with 2 s each side.
7. **Bots** (`rules.test.ts`, real store through `simulateRun`): the DP oracle on the 3 shipping maps at 20 / 30 / 60 / 144 Hz and on 200 more seeds at 60 Hz reaches ≥ 97 % of that map's optimum (≥ 10708 on the shipping maps, ≥ 92 % of maxScore) and every run passes `withinServerLimits` with `capScore` a no-op; a human bot (150–250 ms reaction, N(0, 50 ms) jitter, 92 % hits, 4 % decoys) 8450 in the build hand-off; a random 4-direction masher ≤ 15 % of the oracle (310 in the hand-off); a decoy-hitter stays below the oracle and inside the limits.


## Scene and camera

- **Camera & fit**: `CAMERA_CONFIG = { position: [0, 7.8, 6.2], lookAt: [0, 0.5, 0], fov: 45 }`, `useFittedView` with `area = { min: { x: -3.5, y: 0, z: -3.5 }, max: { x: 3.5, y: 2.2, z: 3.5 } }`, `pitch: (60 * Math.PI) / 180`, `yaws: [0]`, `focus: [{ x: 0, y: 0.5, z: 0 }]`, `shift: true`.
- **Line-of-sight projection table at pitch $60^\circ$ (`yaw = 0`, $\cot 60^\circ = 0.5774$, $z_{\text{proj}} = z - 0.5774\,y$):**

| Object `(x, z)` (m) | Screen $x$ span (m): disc / body / icon | Disc $z$ ($y = 0$, $r = 0.50\text{ m}$) | Body $z_{\text{proj}}$ ($y \in [0, 1.50]\text{ m}$) | Icon ($y \in [1.55, 2.15]\text{ m}$) or sword $z_{\text{proj}}$ | Occlusion check (`yaw = 0`) |
|---|---|---|---|---|---|
| **Far-N** `(+1.00, −2.40)` | `[+0.50, +1.50]` / `[+0.68, +1.32]` / `[+0.70, +1.30]` | `[−2.90, −1.90]` | `[−3.27, −2.40]` | Icon `[−3.64, −3.29]` | Disjoint in $x$ from Near-N ($|x| \le 0.32\text{ m}$) |
| **Near-N** `(0.00, −1.60)` | `[−0.50, +0.50]` / `[−0.32, +0.32]` / `[−0.30, +0.30]` | `[−2.10, −1.10]` | `[−2.47, −1.60]` | Icon `[−2.84, −2.50]` | $0.18\text{ m}$ west of Far-N disc |
| **Knight** `(0.00, 0.00)` | Body `[−0.30, +0.30]`, sword `[−0.45, +0.45]` | — | Plume ($y = 1.75$): **`[−1.01, 0.00]`** | Raised sword ($y \le 1.80$): **`−1.04`** | South of Near-N disc front edge (`−1.10 m`); 0 overlap |
| **Near-S** `(0.00, +1.60)` | `[−0.50, +0.50]` / `[−0.32, +0.32]` / `[−0.30, +0.30]` | `[+1.10, +2.10]` | `[+0.73, +1.60]` | Icon `[+0.36, +0.71]` | Icon top (`+0.36 m`) south of Knight feet (`0.00 m`) |
| **Far-S** `(−1.00, +2.40)` | `[−1.50, −0.50]` / `[−1.32, −0.68]` / `[−1.30, −0.70]` | `[+1.90, +2.90]` | `[+1.53, +2.40]` | Icon `[+1.16, +1.51]` | $0.18\text{ m}$ west of Near-S disc |
| **Near-W / Far-W** `(−1.60, 0)` / `(−2.40, −1.00)` | `[−1.92, −1.28]` vs `[−2.72, −2.08]` | `[−0.50, +0.50]` / `[−1.50, −0.50]` | `[−0.87, 0.00]` / `[−1.87, −1.00]` | Icons `[−1.24, −0.89]` / `[−2.24, −1.89]` | $0.16\text{ m}$ horizontal gap in $x$ |
| **Near-E / Far-E** `(+1.60, 0)` / `(+2.40, +1.00)` | `[+1.28, +1.92]` vs `[+2.08, +2.72]` | `[−0.50, +0.50]` / `[+0.50, +1.50]` | `[−0.87, 0.00]` / `[+0.13, +1.00]` | Icons `[−1.24, −0.89]` / `[−0.24, +0.11]` | $0.16\text{ m}$ horizontal gap in $x$ |

- **HUD (`hudStats` + `definition.Hud`)**: core `hudStats` shows numeric `Combo`, `Spin` (`0..100`), and `BPM`. The `"SPIN READY! [SPACE / SPIN]"` badge and the Metronome `[M]` button live in `KnightArenaHud` (`data-arcade-safe-area`).

## Assets & Performance

- Assets (`assets.ts`): `knight` (`EXPANSION_CHARACTERS.knight`, 1.75 m), `dummy` (`EXPANSION_ASSETS.dummy`, 1.5 m), `castleTower` (`EXPANSION_ASSETS.castleTower`, 6.0 m), `leafyTree` (`EXPANSION_ASSETS.leafyTree`, 3.5 m), `sword` (`/models/3d/knight-arena/sword.glb`, 0.85 m), `shield` (`/models/3d/knight-arena/shield.glb`, 0.55 m).
- Draw-call count: $\le 28$ draw calls (target $\le 30$, cap 45), zero per-frame allocations.

## Decisions (user, 2026-10-24)

- Q1 timeup sting: fixed in core.
- Q2 limits: approved (`maxScore=11600`, `58–62 s`, `base=0`, `maxPointsPerSec=200`), now in `meta.ts` and `arcade-games.json`.
- Q3 timing window: ONE window for every device, $\pm 110\text{ ms}$ (judged at frame midpoint $t - dt/2$).
- Q4 knight height: 1.75 m.
- Q5 doubles: only same-direction near + far pairs (one strike clears both) on every device; no half-beat pairs.
- Modern look: Hyper3D sword and shield GLBs (`/models/3d/knight-arena/sword.glb`, `shield.glb`) on `handR`/`handL`, sunset arena with banners, `<Trail>` on sword tip, `sparks` on hits, and beat-synced target light pulse.

## Status

```
TASK P-61-levels-knight | 5 levels for knight-arena | branch cursor/levels-knight-arena | allowed: play50games-frontend/src/arcade3d/games/knight-arena/**

STATUS: DONE

FILES:
- play50games-frontend/src/arcade3d/games/knight-arena/levels.ts (new)
- play50games-frontend/src/arcade3d/games/knight-arena/levels.test.ts (new)
- play50games-frontend/src/arcade3d/games/knight-arena/rules.ts
- play50games-frontend/src/arcade3d/games/knight-arena/index.tsx
- play50games-frontend/src/arcade3d/games/knight-arena/meta.ts
- play50games-frontend/src/arcade3d/games/knight-arena/Scene.tsx
- play50games-frontend/src/arcade3d/games/knight-arena/Dummies.tsx
- play50games-frontend/src/arcade3d/games/knight-arena/README.md
- .handoff/P-61-levels-knight/HANDOFF.md
rules.test.ts was not edited. meta.scoring of level 1 is still 11600 / 58000 / 62000 / 0 / 200. arcade-games.json was not edited.

FIVE LEVELS:
| Level | Title | Beats | Slots | BPM | On-beat | Step | Mechanic | Lighting | clear | maxScore | pps | ceiling |
| 1 | Basic Training | 111 | 140 | 100/110/120/130 | 110 | 8 | today's game | sunset (unchanged) | 4400 | 11600 | 200 | 11090 |
| 2 | Moving Targets | 113 | 145 | 104/114/124/136 | 110 | 8 | far from beat 0; marker slides near to far | day | 4500 | 12100 | 209 | 11540 |
| 3 | Timed Course | 118 | 156 | 108/118/128/142 | 100 | 8 | tighter window; doubles from stage 2 | sunset, deeper | 5100 | 13000 | 225 | 12470 |
| 4 | Combo Arena | 122 | 163 | 112/122/134/148 | 100 | 6 | combo every 6 hits; more shields and tomatoes | night | 6000 | 13900 | 240 | 13320 |
| 5 | Royal Trial | 128 | 176 | 116/128/140/156 | 90 | 6 | fastest grid, tightest window | sunset, darker | none | 15100 | 261 | 14460 |
Duration 60000 ms on every level. Miss window ±200 ms. Touch and keyboard share the on-beat window. No new GLBs.
Shields (stages 2/3/4): 4+4+4, 4+4+4, 4+5+5, 5+5+5, 5+6+6.
Doubles: 0+13+16, 0+14+18, 6+14+18, 8+15+18, 10+16+22.
Tomatoes: 0+9+9, 0+9+9, 3+9+10, 4+10+11, 5+11+13.
Slots = beats + doubles.

LIMITS AND PROOFS (rules.ts PROPOSED_LEVEL_LIMITS; README "Levels"):
The run always ends on the shell clock, so every level keeps 58000–62000 ms. base 0. pps = ceil(maxScore / 58), so 58 s × pps >= maxScore and the rate line never binds. Ceiling B: every real slot on-beat in one streak (20 × combo) plus 50 × floor(slots / 8) spins. Step 8 hit points = 80×slots − 960. Step 6 hit points = 80×slots − 720. maxScore = ceil(B × 1.04 / 100) × 100.
L1: 10240 + 850 = 11090 → 11600 / pps 200 (today's limits).
L2: 10640 + 900 = 11540 → 12100 / pps 209.
L3: 11520 + 950 = 12470 → 13000 / pps 225.
L4: 12320 + 1000 = 13320 → 13900 / pps 240.
L5: 13360 + 1100 = 14460 → 15100 / pps 261.
L5 maxScore is 1.30× level 1 (<= ~3×). Each level's slots and ceiling are strictly above the previous. DP optimum on 80 seeds per level is <= B and >= 90% of maxScore.

BOT CLEAR RATES (human model from rules.test.ts: reaction 150–250 ms, N(0, 50 ms) jitter clamped ±160, 92% hits, 4% tomato mistakes, spin when full). Seeds 4, 11, 18, 27, 36, 42, 55, 63, 71, 88. Level 5's play target is 6400 (test only; no clearScore).
| Level | cleared | min | mean | mash seed 11 at 30 Hz | idle |
| 1 | 10/10 | 5280 | 6906 | 340 | 0 |
| 2 | 10/10 | 5280 | 6719 | 660 | 0 |
| 3 | 10/10 | 5930 | 8012 | 290 | 0 |
| 4 | 10/10 | 7140 | 8869 | 610 | 0 |
| 5 | 10/10 | 8120 | 9462 | 600 | 0 |
Store oracle, seeds 101 / 202 / 303 at 60 Hz, every level: score >= 97% of that map's DP optimum, endReason timeup, withinServerLimits, capScore a no-op.

TESTS: npx tsc --noEmit exit 0. npx vitest run src/arcade3d/games/knight-arena: 31 passed (poses 4, assets 3, rules 5, levels 19), wall 42.16 s, summed test time 55.21 s. Suite under 60 s.
Mutation probe: stepRun graded on-beat with TIMING.ON_BEAT_WINDOW_MS (110) instead of run.onBeatWindowMs. "L5: a strike at the on-beat edge" failed (91 ms off the beat graded onBeat). Restored before the suite above.

OPEN QUESTIONS:
- registry.sync.test.ts fails until Claude copies PROPOSED_LEVEL_LIMITS for levels 2-5 into arcade-games.json. This task does not edit backend files.
- No flagged build and no headless playtest here. Claude does those.
- The plan's attempt limit was not built (a miss that ended the run would break the 58–62 s proof). Moving targets are a marker slide, not new locomotion.
- Core lighting has no dusk preset. Level 4 uses night. Levels 3 and 5 use sunset; level 5's background is darker than level 1.
- Level 5 has no clearScore. 6400 is only the test's winnability target.
- The human rate is 10/10 on these 10 seeds, not a 200-seed sweep. The 200-seed level-1 store proof stays in rules.test.ts.
```
