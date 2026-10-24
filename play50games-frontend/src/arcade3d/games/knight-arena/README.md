# Knight Training Arena

Owner: Antigravity. Slug: `knight-arena`. Skill game 8 (order 28 in catalog, game 18 in expansion), complexity 3. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §18. Gate G0 (game design); the build fills `Status`. Units: metres, seconds; x east (+x = right), z south (+z = front/camera), y up. Every "Changed from spec" line says what and why.

## Concept

A young knight trains on the castle green at midday. The knight stands at the centre of an octagonal wooden training ring surrounded by 8 wooden training dummies (4 near on the cardinal rays + 4 far rotated $22.5^\circ$ off the cardinal rays). Targets pop up on the beat showing directional arrows; the knight strikes in rhythm with a wooden sword to build combo multipliers up to ×4. Shield dummies require two strikes, and tomato decoys must be avoided. A full spin meter unleashes a 360° sweeping spin attack hitting all active real targets. Accent `#facc15`.

## Controls

`meta.ts`: `controls.scheme = "timing"`. `GameDefinition` (`index.tsx`): `touchControls: ["swipe", "action"]`, `touchLabels: { action: "Spin" }`.

- `keyboard`: "Arrows / WASD to strike, Space to spin"
- `touch`: "Swipe to strike, Action to spin"
- Directional strikes read `input.pressed.up / down / left / right` (one-frame latched). Swipes are already included in `pressed` by core convention (never also read `swipe`). Each cardinal key/swipe (`up` = N, `down` = S, `left` = W, `right` = E) addresses both the near cardinal dummy ($0^\circ$) and the far dummy ($+22.5^\circ$ clockwise off that cardinal ray) in that sector: both display the same cardinal chevron arrow, and even a diagonal touch swipe aimed directly at a $22.5^\circ$ far dummy has $|\tan 22.5^\circ| = 0.414 < 1$, so `inputController.ts` still classifies its dominant axis as the matching cardinal `pressed` direction. Space / E / Enter and the 72 px bottom-right touch **Spin** (`Action`) button read `actionPressed || jumpPressed` to fire the spin attack when the spin meter is at 100%. `M` key or the HUD button toggles the optional metronome click. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ARENA`, `KNIGHT`, `TARGETS`, `BEAT`, `TIMING`, `COMBO`, `SPIN`, `SCORING`) and are proven in `rules.test.ts`.

- **Arena** (`ARENA`): octagonal ring radius 4.5 m enclosed by `<Fence path={RING_PATH}>` (`core/kit`, `RING_PATH = createPath(OCTAGON_POINTS, { closed: true })`), surrounded by green grass `#65a30d`, two backdrop towers (`EXPANSION_ASSETS.castleTower`, 6 m tall at (−6, −7.5) and (6, −7.5)), and four leafy trees (`EXPANSION_ASSETS.leafyTree`, 3.5 m tall).
- **Knight & reach** (`KNIGHT`, `poses.ts`): `EXPANSION_CHARACTERS.knight` (1.75 m tall including helmet plume, scale $1.75 / 1.884 = 0.929$, auto-rigged with `KNIGHT_LANDMARKS` from `core/sharedAssets`). Stands at (0, 0, 0) facing south (+z, yaw 0). Carries a 0.85 m wooden sword in `attach.handR` ($0.15\text{ m}$ hilt + $0.70\text{ m}$ blade ahead of wrist) and a 0.55 m heater shield in `attach.handL`.
  - **Facing**: root group yaw turns toward the resolved strike target's post yaw ($\text{atan2}(x, z)$: cardinal $0, \pi, \mp\pi/2$ for near strikes; $+22.5^\circ$ offset $-\pi/8, 7\pi/8, -5\pi/8, +3\pi/8$ for far strikes) via `turnTowards(from, to, amount)` (`core/math`) using the game-local ease fraction `amount = Math.min(1, (40 * dt) / Math.abs(diff))` ($40\text{ rad/s}$ angular speed, reaching $180^\circ$ in $\le 0.08\text{ s}$) and **keeps facing the last strike** until the next directional input.
  - **Swings, lunge & surface contact**: 4 directional shoulder-level slashes (duration 0.25 s, contact at $u = 0.5$, sword tip kept at $y \le 1.80\text{ m}$) built from `aimArm(out, side, ux, uy, uz, fx, fy, fz, roll)` (8-number signature) + `turnBone` on spine/chest. Along the strike line, standing sword-tip reach from the knight's root is $0.14\text{ m}$ (spine lean + shoulder forward offset) $+ 0.44\text{ m}$ (shoulder-to-wrist $0.471 \times 0.929$) $+ 0.70\text{ m}$ (blade ahead of grip) $= \mathbf{1.28\text{ m}}$, meeting the **near dummy's front surface** ($r_{\text{near}} - r_{\text{dummy}} = 1.60 - 0.32 = \mathbf{1.28\text{ m}}$) within $\le 0.15\text{ m}$ without piercing its centre. For a far strike ($r_{\text{far}} = 2.60\text{ m}$, **front surface at $2.60 - 0.32 = \mathbf{2.28\text{ m}}$** along its $+22.5^\circ$-offset ray), the knight steps **$1.00\text{ m}$ outward and back** along that $22.5^\circ$ ray ($\sin(\pi u)$ root translation peaking at $1.00\text{ m}$ at $u = 0.5$, total tip reach $1.00 + 1.28 = \mathbf{2.28\text{ m}}$ right at the far dummy's surface), driven by a **real `walkPose` stride step** (`POSE_MASK.legs` under the upper-body slash) + `bodyLift` so both feet step out and back on the floor (**no planted rear foot and no leg IK** — `core/rig` has no IK, `core/README.md` "no IK in the core"). Because the far ray is rotated $22.5^\circ$ off the cardinal line, at the $1.00\text{ m}$ lunge peak the knight's centre is $\sqrt{1.00^2 + 1.60^2 - 2(1.00)(1.60)\cos 22.5^\circ} = \mathbf{0.78\text{ m}}$ from the near dummy's centre ($> 0.40 + 0.32 = 0.72\text{ m}$, leaving **$0.06\text{ m}$ body-to-body surface clearance**), and the strike line passes $1.60\sin 22.5^\circ = \mathbf{0.61\text{ m}}$ from the near dummy's centre (**$0.29\text{ m}$ clear** of its $0.32\text{ m}$ surface).
  - **Spin**: a 360° spin (0.40 s) rotates the **knight root group's yaw** by $2\pi \cdot \text{smoothstep}(u)$ while holding a horizontal cleave pose (`aimArm`), not a bone spin. `cheerPose` plays on run end.
- **Target dummies** (`TARGETS`, 8 posts): 4 directions (`up`/N, `down`/S, `left`/W, `right`/E) × 2 distances:
  - **4 near dummies** at $r_{\text{near}} = 1.60\text{ m}$ on the cardinal rays: **Near-N** $(0.00, -1.60)$, **Near-S** $(0.00, +1.60)$, **Near-W** $(-1.60, 0.00)$, **Near-E** $(+1.60, 0.00)$ (surface at $1.28\text{ m}$).
  - **4 far dummies** at $r_{\text{far}} = 2.60\text{ m}$ rotated **$+22.5^\circ$ ($\pi/8\text{ rad}$)** clockwise off each cardinal ray ($2.60\cos 22.5^\circ = 2.40\text{ m}$, $2.60\sin 22.5^\circ = 1.00\text{ m}$): **Far-N** $(+1.00, -2.40)$, **Far-S** $(-1.00, +2.40)$, **Far-W** $(-2.40, -1.00)$, **Far-E** $(+2.40, +1.00)$ (surface at $2.28\text{ m}$).
  - Each dummy (`EXPANSION_ASSETS.dummy`, 1.50 m tall, collision radius $0.32\text{ m}$) stands on a ground target disc of radius $r_{\text{disc}} = \mathbf{0.50\text{ m}}$ ($1.00\text{ m}$ diameter; near and far centres in each sector are $1.28\text{ m}$ apart, leaving $0.28\text{ m}$ between discs). Hits trigger damped spring wobble (`core/motion` `spring`, $k = 64, c = 8$).
- **Beat map & cumulative schedule** (`BEAT`): fixed `durationMs: 60000`. Runtime selects one of **3 fixed seeded beat maps** (`BEAT.MAP_SEEDS = [101, 202, 303]`, picked via `BEAT.MAP_SEEDS[randomSeed() % 3]`; `createBeatMap(seed)` stays pure for any seed). Beat times form **one cumulative list** (`BEAT_TIMES_MS`, 111 beats total) with **no beat on a stage boundary** ($15, 30, 45\text{ s}$), first scoring beat at $t_0 = \mathbf{1.50\text{ s}}$ ($\ge 1.2\text{ s}$), and **every hit slot $\le 59.6\text{ s}$ (the second half of a half-beat double and the second hit of a shield included)** — beat 110 at $t_{110} = \mathbf{59.54\text{ s}}$ is always a single-slot regular target, so the last hit slot's $+200\text{ ms}$ window closes at $59.74\text{ s} < 60.0\text{ s}$:
  - **Stage 1** ($1.50\text{–}14.70\text{ s}$, 100 BPM = $600\text{ ms}$): 23 beats; near regular dummies only.
  - **Stage 2** ($15.27\text{–}29.45\text{ s}$, 110 BPM = $545.45\text{ ms}$): 27 beats; near + far regular dummies + shield dummies.
  - **Stage 3** ($30.50\text{–}44.50\text{ s}$, 120 BPM = $500\text{ ms}$): 29 beats; adds tomato decoys + half-beat double targets ($\Delta t = 250\text{ ms}$).
  - **Stage 4** ($45.23\text{–}59.54\text{ s}$, 130 BPM = $461.54\text{ ms}$): 32 beats; fast mixed (near + far regulars, shields, half-beat doubles at $\Delta t = 230.8\text{ ms} \ge 230\text{ ms}$ up to beat 109, single on beat 110 so all hit slots $\le 59.6\text{ s}$, and off-direction tomato decoys).
  - **Map caps** (`BEAT` constants): across the 111 beats, every map caps total hit slots at `BEAT.MAX_HIT_SLOTS = 140` ($H \le 140$), shield dummies at `BEAT.MAX_SHIELDS = 12` (each shield is 2 consecutive hit slots on the same post = 24 slots), half-beat double pairs at `BEAT.MAX_DOUBLES = 29` (each pair adds a second regular hit slot half a beat later = 58 slots across 29 beats), and single-target beats at 58 ($24 + 58 + 58 = 140$ hit slots), plus `BEAT.TOMATO_COUNT = 18` tomato decoys.
- **Lead time, active window & timing judge** (`TIMING`):
  - **Lead time**: every target becomes visible **2 beats before** its beat time $t_b$ ($1200\text{ ms}$ at 100 BPM, $\ge 923\text{ ms}$ at 130 BPM), with a $0.60\text{ m}$ overhead billboard icon (centred at $y = 1.85\text{ m}$, spanning $y \in [1.55, 2.15]\text{ m}$) and a 3D approach ring shrinking onto the $r = 0.50\text{ m}$ ground disc.
  - **Hittable window**: a target is live/active **only within $\pm 200\text{ ms}$** of $t_b$.
  - **Mid-frame timing fairness**: because `input.pressed` is published on the frame after the press (up to 1 frame lag, $\le 50\text{ ms}$ at the 20 Hz `dt` cap), `rules.ts` judges timing at $t_{\text{judge}} = \text{time} - dt / 2$.
  - **On-beat vs off-beat**: $|t_{\text{judge}} - t_b| \le 90\text{ ms}$ ($\le 120\text{ ms}$ on coarse pointers / touch) is **on-beat** (100% value = $20 \times \text{combo}$ for a regular hit); $90\text{–}200\text{ ms}$ ($120\text{–}200\text{ ms}$ touch) is **off-beat** (50% value = $10 \times \text{combo}$).
- **Strike arbitration, whiffs, expiry & target types**:
  - **(a) Unhit expiry**: any real target (regular or shield hit) still unhit past $t_b + 200\text{ ms}$ expires as a **miss** and resets combo to $\times 1$. An expired tomato decoy disappears with 0 penalty and no combo change.
  - **(b) Whiff (empty direction)**: pressing a direction that has **no live target** within $\pm 200\text{ ms}$ (neither near nor far) is a **whiff**: resets combo to $\times 1$, awards 0 points, and adds 0% spin meter (mashing all 4 directions never pays).
  - **(c) One strike per frame & swing overlap**: at most **one directional strike is processed per frame** (priority `up, down, left, right`). The 0.25 s swing animation is visual only and **does not lock out input**: a press during an active 0.25 s swing counts immediately and retargets the swing.
  - **(d) Near vs far same-direction & tomato separation**: when both near and far targets in the pressed direction are within $\pm 200\text{ ms}$, the strike hits the **earliest beat $t_b$** (tie: **near**). The generator **never schedules a tomato decoy in the same direction within an overlapping $\pm 200\text{ ms}$ window** of a real target (gap $> 400\text{ ms}$).
  - **(f) Double targets**: because touch has one canvas pointer and one swipe per gesture, two targets never share the exact same beat timestamp; a double is a **half-beat pair** ($\ge 230.8\text{ ms}$ apart in Stages 3–4) so single-finger swipes and keys can hit both sequentially.
  - **(g) Shield dummy (2 hits)**: Hit 1 at $t_{b1} \pm 200\text{ ms}$ cracks the shield ($10 \times \text{combo}$ on-beat, $5 \times \text{combo}$ off-beat, $+1$ combo hit, $+15\%$ on-beat / $+10\%$ off-beat spin meter). If Hit 1 is hit, Hit 2's window is on the **next beat** $t_{b2} = t_{b1} + \text{beatPeriod} \pm 200\text{ ms}$ with the same timing judge ($20 \times \text{combo}$ on-beat, $10 \times \text{combo}$ off-beat, $+1$ combo hit, $+15\% / +10\%$ spin meter). Missing Hit 1 expires the shield at $t_{b1} + 200\text{ ms}$ (cancelling Hit 2) and resets combo; missing Hit 2 expires at $t_{b2} + 200\text{ ms}$ and resets combo.
  - **(h) Spin attack** (`SPIN`): regular/shield hits charge the meter by $+15\%$ on-beat ($+10\%$ off-beat), **clamped to $100\%$ (no overflow)**. At $100\%$, Space/Action consumes the meter (`0%`) and sweeps $360^\circ$: it clears all **active real targets** (within $\pm 200\text{ ms}$ of $t_b$) for on-beat points ($20 \times \text{combo}$ each; a live shield dummy breaks in one sweep for $20 \times \text{combo}$ and cancels any remaining hit on that shield), **skips tomato decoys**, **adds $+1$ combo hit per cleared target**, **does NOT charge the spin meter**, and awards the **$+50\text{ pts}$ spin bonus only when $\ge 1$ active real target is cleared**.
- **Combo** (`COMBO`): multiplier on the $k$-th consecutive real hit ($k = 1, 2, \dots$, i.e. `1 + Math.min(3, Math.floor((k - 1) / 8))`) starts at $\times 1$ for hits 1–8 and steps $+1$ after every 8th hit: **$\times 2$ starts on the 9th hit** (hits 9–16), **$\times 3$ starts on the 17th hit** (hits 17–24), and **$\times 4$ starts on the 25th hit** (hits $25+$). Any whiff, unhit expiry, or struck tomato resets the streak and multiplier to $\times 1$.

## Scoring

- Regular hit: $20 \times \text{combo}$ on-beat ($\le 90/120\text{ ms}$), $10 \times \text{combo}$ off-beat ($90\text{–}200\text{ ms}$).
- Shield dummy: Hit 1 (crack) = $10 \times \text{combo}$ on-beat ($5 \times \text{combo}$ off-beat); Hit 2 (break) = $20 \times \text{combo}$ on-beat ($10 \times \text{combo}$ off-beat).
- Tomato decoy struck: $-50\text{ pts}$ (`run.score = Math.max(0, run.score - 50)` per event, matching `useArcadeStore.addScore` floor at 0; no time-up `setScore`).
- Spin attack: $20 \times \text{combo}$ per cleared active real target $+ 50\text{ pts}$ spin bonus (when $\ge 1$ target cleared).

### Server limits and why they hold (the proof)

`meta.ts` stays at the provisional `9000 / 58000–62000 / 9000 / 9000` on this branch; `arcade-games.json` is Claude-owned and updated with `meta.ts` at go-live from the real oracle.

| | provisional (`meta.ts` on branch) | **proposed** for go-live (Claude sets `meta.ts` + `arcade-games.json` from build oracle) |
|---|---|---|
| `maxScore` / `max_score` | 9000 | **`ceil100(max_map perfectScore(map) * 1.04)`** ($\le 11,300$; analytic ceiling $11,290$) |
| `minDurationMs`–`maxDurationMs` | 58000–62000 ms | **58000–62000 ms** |
| `base` / `maxPointsPerSec` | 9000 / 9000 | **`0` / `ceil(maxScore / 58)`** ($\le 195$) |

Proof (`rules.ts` `perfectScore(map)` oracle + closed-form sanity ceiling):
1. **Hit-slot bound (`H`):** Across 111 cumulative beats, `BEAT.MAX_HIT_SLOTS` caps total real hit slots at $H \le 140$ ($12$ shields $\times 2 + 29$ half-beat doubles $\times 2 + 58$ singles $= 140$). Every hit slot yields at most $20 \times \text{combo} \le 80$ (the 12 shield cracks each yield $10 \times \text{combo} \le 40$, and a spin-cleared shield yields one $20 \times \text{combo} \le 80$ slot instead of two).
2. **Combo ramp deduction (`-960`):** Because $\times 2$ starts on the 9th hit, hits 1–8 score at $\times 1$ ($\le 20 = 80 - 60$), hits 9–16 at $\times 2$ ($\le 40 = 80 - 40$), hits 17–24 at $\times 3$ ($\le 60 = 80 - 20$), and hits $25..H$ at $\times 4$ ($\le 80$). Thus total hit points across $H \ge 24$ slots satisfy:
   $$P_{\text{hits}}(H) \le 80H - (8 \times 60 + 8 \times 40 + 8 \times 20) = 80H - 960.$$
3. **Spin bonus & closed-form sanity ceiling (`11,290`):** Each non-spin hit adds at most $+15\%$ meter, spin-cleared targets add $0\%$, and the meter never overflows past $100\%$, so $\text{spins} \le \lfloor 15H / 100 \rfloor$. With $H \le 140$, $\text{spins} \le \lfloor 15 \times 140 / 100 \rfloor = 21$, adding at most $50 \times 21 = 1,050\text{ pts}$:
   $$B(H) \le 80H - 960 + 50\lfloor 15H / 100 \rfloor = 80(140) - 960 + 50(21) = 10,240 + 1,050 = \mathbf{11,290}\text{ pts}$$
   (and accounting for the 12 shield cracks paying $\le 40$ instead of $80$ tightens the real oracle to $\le \sim 10,810\text{ pts}$).
4. **Build-time oracle pin for `maxScore`:** At build time, `rules.ts` computes the exact DP/oracle `perfectScore(map)` over the 3 fixed maps (`BEAT.MAP_SEEDS`) and pins **`maxScore = Math.ceil((Math.max(...MAP_SEEDS.map(s => perfectScore(createBeatMap(s)))) * 1.04) / 100) * 100`**, keeping $11,290$ as the closed-form sanity ceiling.
5. **Duration & `maxPointsPerSec`:** Fixed `durationMs: 60000` ends only on `"timeup"` at 60.0 s (`58000–62000 ms`), with **`base = 0`** and **`maxPointsPerSec = Math.ceil(maxScore / 58)`**.

## Run end

- `"timeup"` by shell at 60 s (`durationMs: 60000`). No `"lose"` condition; `"quit"` on Exit discards the run.
- `resultDelayMs: 1200`: knight plays `cheerPose`, `fx.burst("confetti", { x: 0, y: 1.8, z: 0 }, 28)` fires, and the Scene plays its own completion fanfare (`playSfx("win")` + `playSfx("chime", { pitch: 1.25 })`). Note: `GameShell` currently plays `"lose"` on any non-`"win"` end including `"timeup"` (see Open Questions).

## Scene and camera

- **Camera & fit**: `GameDefinition.camera = { position: [0, 9.5, 5.5], fov: 45 }` (overrides stub `fov: 50`). Fixed 3/4 view with `useFittedView` using AABB `area = { min: { x: -3.5, y: 0, z: -3.5 }, max: { x: 3.5, y: 2.2, z: 3.5 } }` ($y \in [0, 2.2]\text{ m}$ encloses the $1.75\text{ m}$ knight + plume, $y \le 1.80\text{ m}$ sword swings, and $y \in [1.55, 2.15]\text{ m}$ overhead target icons; the $r = 4.5\text{ m}$ fence and backdrop towers/trees sit outside the fit box as peripheral decor), `pitch: (60 * Math.PI) / 180` ($60^\circ$ in radians), `yaws: [0]`, `focus: [{ x: 0, y: 0, z: 0 }]`, `margin: { top: 0.10, bottom: 0.08, left: 0.03, right: 0.03 }`, `shift: true`, `avoidControls: true` (keeps the 72 px bottom-right Spin button out of the fit).
- **Line-of-sight projection table at pitch $60^\circ$ (`yaw = 0`, $\cot 60^\circ = 0.5774$, $z_{\text{proj}} = z - 0.5774\,y$; screen horizontal $= x$, including $0.60\text{ m}$ billboard icons at $y \in [1.55, 2.15]\text{ m}$, knight plume at $y = 1.75\text{ m}$, and raised sword at $y \le 1.80\text{ m}$):**

| Object `(x, z)` (m) | Screen $x$ span (m): disc / body / icon | Disc $z$ ($y = 0$, $r = 0.50\text{ m}$) | Body $z_{\text{proj}}$ ($y \in [0, 1.50]\text{ m}$) | Icon ($y \in [1.55, 2.15]\text{ m}$) or sword $z_{\text{proj}}$ | Occlusion check (`yaw = 0`) |
|---|---|---|---|---|---|
| **Far-N** `(+1.00, −2.40)` | `[+0.50, +1.50]` / `[+0.68, +1.32]` / `[+0.70, +1.30]` | `[−2.90, −1.90]` | `[−3.27, −2.40]` | Icon `[−3.64, −3.29]` | Offset $+1.00\text{ m}$ east ($22.5^\circ$): $x \ge +0.50\text{ m}$ is **disjoint in $x$** from Near-N body & icon ($|x| \le 0.32\text{ m}$) |
| **Near-N** `(0.00, −1.60)` | `[−0.50, +0.50]` / `[−0.32, +0.32]` / `[−0.30, +0.30]` | `[−2.10, −1.10]` | `[−2.47, −1.60]` | Icon `[−2.84, −2.50]` | Body & icon ($|x| \le 0.32\text{ m}$) pass **$0.18\text{ m}$ west** of Far-N disc ($x \ge +0.50$) and **$0.36\text{ m}$ west** of Far-N base/body ($x \ge +0.68$) |
| **Knight** `(0.00, 0.00)` | Body `[−0.30, +0.30]`, sword `[−0.45, +0.45]` | — | Plume ($y = 1.75$): **`[−1.01, 0.00]`** | Raised sword ($y \le 1.80$): **`−1.04`** | Plume (`−1.01 m`) and raised sword (`−1.04 m`) stop **$0.06\text{–}0.09\text{ m}$ south** of Near-N disc front edge (`−1.10 m`); 0 overlap |
| **Near-S** `(0.00, +1.60)` | `[−0.50, +0.50]` / `[−0.32, +0.32]` / `[−0.30, +0.30]` | `[+1.10, +2.10]` | `[+0.73, +1.60]` | Icon `[+0.36, +0.71]` | Icon top (`+0.36 m`) stops **$0.36\text{ m}$ south** of Knight feet (`0.00 m`); 0 overlap |
| **Far-S** `(−1.00, +2.40)` | `[−1.50, −0.50]` / `[−1.32, −0.68]` / `[−1.30, −0.70]` | `[+1.90, +2.90]` | `[+1.53, +2.40]` | Icon `[+1.16, +1.51]` | Offset $-1.00\text{ m}$ west ($22.5^\circ$): body & icon ($x \le -0.68\text{ m}$) pass **$0.18\text{ m}$ west** of Near-S disc ($x \ge -0.50$) and **$0.36\text{ m}$ west** of Near-S base/body ($x \ge -0.32$) |
| **Near-W / Far-W** `(−1.60, 0)` / `(−2.40, −1.00)` | Body/icon `[−1.92, −1.28]` vs `[−2.72, −2.08]` | `[−0.50, +0.50]` / `[−1.50, −0.50]` | `[−0.87, 0.00]` / `[−1.87, −1.00]` | Icons `[−1.24, −0.89]` / `[−2.24, −1.89]` | **$0.16\text{ m}$ horizontal gap in $x$** between bodies/icons; Near-W ($x \ge -1.92$) does not cover Far-W body or disc centre |
| **Near-E / Far-E** `(+1.60, 0)` / `(+2.40, +1.00)` | Body/icon `[+1.28, +1.92]` vs `[+2.08, +2.72]` | `[−0.50, +0.50]` / `[+0.50, +1.50]` | `[−0.87, 0.00]` / `[+0.13, +1.00]` | Icons `[−1.24, −0.89]` / `[−0.24, +0.11]` | **$0.16\text{ m}$ horizontal gap in $x$** between bodies/icons; Far-E ($x \ge +2.08$) does not cover Near-E body or disc |

- **Pixel readability (analytic prediction from $7.0 \times 2.2 \times 7.0\text{ m}$ fitted AABB at pitch $60^\circ$, `fov: 45`, banner open on phones):**
  - *Note on geometry & build-time measurement:* In guard/idle the knight is $\sim 0.55\text{–}0.60\text{ m}$ wide across the pauldrons ($\times 1.75\text{ m}$ tall, foreshortened to $\sim 1.55\text{ m}$ at $60^\circ$); the $1.00\text{ m}$ Ø ground discs are foreshortened vertically by $\sin 60^\circ \approx 0.87\times$ ($1.00\text{ m}$ wide $\times 0.87\text{ m}$ tall); and perspective (`fov: 45`) draws the far row ($z = -2.40\text{ m}$) $\sim 18\%$ smaller than the centre/near row. The table below is a **prediction** (earlier predictions were $\sim 2\times$ too high); **the build measures actual rendered bounding boxes in headless Chrome and must reach $\ge 24\text{ px}$ on the shorter side**. If the knight's shorter side (width) measures $< 24\text{ px}$ at $844 \times 390$ with the banner open, the planned fix is to tighten the fitted `area` XZ bounds from $\pm 3.5\text{ m}$ to $\pm 3.0\text{ m}$ ($+17\%$ scale, since all 8 discs lie within $[-2.90, +2.90]\text{ m}$) and/or increase the knight's drawn scale.

| Viewport | Centre / far scale (px/m) | Knight ($\sim 0.58 \times 1.75\text{ m}$) | Target disc ($1.00\text{ m W} \times 0.87\text{ m H}$ at $60^\circ$, near / far) | Dummy ($\sim 0.64 \times 1.50\text{ m}$, near / far) | Overhead icon ($0.60\text{ m}$, near / far) | Requirement |
|---|---|---|---|---|---|---|
| 1280 × 800 (desktop) | ~78 / ~65 px/m | ~45 × 120 px | ~78 × 68 px / ~65 × 57 px | ~50 × 102 px / ~42 × 85 px | ~47 × 47 px / ~39 × 39 px | Measured in browser $\ge 24\text{ px}$ |
| 390 × 844 (touch, banner) | ~48 / ~40 px/m | ~28 × 74 px | ~48 × 42 px / ~40 × 35 px | ~31 × 63 px / ~26 × 52 px | ~29 × 29 px / ~24 × 24 px | Measured in browser $\ge 24\text{ px}$ |
| 844 × 390 (touch, banner) | ~42 / ~35 px/m | ~24 × 65 px | ~42 × 37 px / ~35 × 30 px | ~27 × 55 px / ~24 × 46 px | ~25 × 25 px / ~24 × 24 px | Measured in browser $\ge 24\text{ px}$ (fallback: $\pm 3.0\text{ m}$ fit or larger knight) |

- **HUD (`hudStats` + `definition.Hud`)**: core `hudStats` are numbers only (`RunState.stats: Record<string, number>`): `hudStats: [{ key: "combo", label: "Combo" }, { key: "spin", label: "Spin", max: 100 }]` shows numeric `Combo` (`1`..`4`) and `Spin` (`0`..`100`). The `"SPIN READY! [SPACE / SPIN]"` text badge (with a sword-star icon and pulse at 100%, shape + text + motion, not colour alone) and the Metronome mute/unmute button live in the game's own `definition.Hud` inside a compact top-centre `data-arcade-safe-area` bar.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats`, `Hud`, `camera`, `environment`), `useRunFrame`, `useGameTime`, `useInput`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setStat`, `end`); `core/sharedAssets` (`EXPANSION_CHARACTERS`, `EXPANSION_ASSETS`, `EXPANSION_GLB_SIZE`, `EXPANSION_CHARACTER_GLB_HEIGHT`, `KNIGHT_LANDMARKS`); `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`); `core/path` (`createPath`); `core/motion` (`spring`); `core/kit` (`Fence`); `core/rig` (`<HumanoidModel attach>`, `useHumanoidPose`, `idlePose`, `walkPose`, `cheerPose`, `aimArm`, `turnBone`, `levelFoot`, `bodyLift`, `POSE_MASK`, `BONE`); `core/fx` (`useFx`: `burst` with `"sparks"`, `"confetti"`, `"puff"`, `score`, `shake`, `warm`; `<Trail target={swordTipRef}>`); `core/env` (`<SkyDome>`); `core/render` (`<InstancedModel>`, `<DynamicInstancedModel>`, `<DynamicInstanced>`, `BlobShadow`, `useCanvasTexture`); `core/audio` (`playSfx`, `startLoop`, `stopAllLoops`); `core/limits` (`withinServerLimits`, `capScore`); `core/testing/botHarness` (`createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`).

## Assets

| id / source | class | target in game | rules footprint | fallback |
|---|---|---|---|---|
| `knight` / `EXPANSION_CHARACTERS.knight` | C (A) | 1.75 m tall ($\sim 0.58\text{ m}$ wide in guard, GLB 1.884 m, auto-rig) | circle r 0.4 m at origin | capsule |
| `dummy` / `EXPANSION_ASSETS.dummy` | A | 1.5 m on $r = 0.50\text{ m}$ base disc (4 cardinal near + 4 $+22.5^\circ$ far) | circle r 0.32 m | capsule |
| `castleTower` / `EXPANSION_ASSETS.castleTower` | C (A) | 6.0 m tall, 2 backdrop towers | circle r 1.4 m | cylinder |
| `leafyTree` / `EXPANSION_ASSETS.leafyTree` | C (A) | 3.5 m tall, 4 trees outside ring | circle r 0.6 m | cylinder + cone |
| `woodenSword` / procedural | B | 0.85 m long ($0.70\text{ m}$ blade ahead of grip), in `attach.handR` | tip reach 1.28 m near / 2.28 m far lunge (surface contact) | box |
| `shield` / procedural | B | 0.55 m heater shield, in `attach.handL` | none | cylinder |
| `fence` / `core/kit/Fence` | B | octagonal ring r 4.5 m, height 1.1 m (`createPath`) | decor outside fit box | procedural posts |
| `targetMarkers` / procedural | B | $r = 0.50\text{ m}$ ground discs, 3D shrinking approach rings, $0.60\text{ m}$ billboard arrows/tomato | none | plane + ring |

- `assets.spec.json` has `"assets": []` (0 custom GLBs owned).
- **Changed from spec:**
  - *Far dummies rotated $+22.5^\circ$ off cardinal lines:* Placed the 4 far dummies at $22.5^\circ$ clockwise off N/S/W/E because keeping near and far dummies on the same ray made the 1.0 m lunge collide with the near dummy and caused Near-N / Far-S billboard icons and bodies to occlude Far-N / Near-S at pitch $60^\circ$.
  - *Spin +50 bonus:* Spin attack grants $+50\text{ pts}$ when clearing $\ge 1$ active target because it rewards holding Spin for multi-target beats while keeping the ceiling tight ($50 \times 21 = 1050$).
  - *Shield 10 + 20 scoring:* Shield dummy pays $10 \times \text{combo}$ on Hit 1 (crack) and $20 \times \text{combo}$ on Hit 2 (break) on beat ($5\times / 10\times$ off-beat) because immediate points feedback confirms the crack while keeping every hit slot $\le 20 \times \text{combo}$.
  - *Confetti at ×4 and run end:* `fx.burst("confetti", ...)` triggers both when reaching $\times 4$ combo (spec §18.11) and during the 1200 ms run-end delay because both moments merit a celebration burst.
  - *No cloth banners on fence:* Dropped separate banner meshes (spec §18.10; banner colours `#facc15` / `#3b82f6` applied to shield and ring trim) because omitting them saves draw calls under the 45-call cap and keeps sightlines clean.
  - *3 fixed maps vs any seed:* Gameplay draws from 3 fixed map seeds (`MAP_SEEDS[randomSeed() % 3]`, matching spec §18.8) while `createBeatMap(seed)` accepts any seed so tests can verify invariants across 1,000 seeds.
  - *Knight height 1.75 m vs catalog 1.6 m:* Proposed at 1.75 m because it matches `EXPANSION_CHARACTER_HEIGHT.knight`, aids $\ge 24\text{ px}$ phone readability, and gives a 1.28 m standing sword reach to the near dummy's surface (see Open Questions).
  - *Dummy on a $r = 0.50\text{ m}$ base disc, not a post:* The shared `dummy.glb` includes its own stand and has no separate post mesh, and the $1.0\text{ m}$ base disc provides the $\ge 24\text{ px}$ floor target.
  - *Stage 4 "fast mixed" contents:* Explicitly defined as 32 beats at 130 BPM combining near + far regulars, 2-hit shields, half-beat doubles ($\Delta t = 230.8\text{ ms}$), and off-direction tomatoes because spec §18.7 leaves "fast mixed" open.

## Files

`meta.ts` · `index.tsx` · `rules.ts` (`perfectScore`, beat maps, mid-frame judge, strike/spin/combo/score) · `rules.test.ts` · `poses.ts` + `poses.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Arena.tsx` · `Dummies.tsx` · `Primitives.tsx` · `assets.spec.json` · `README.md` · `tools/thumbs/inputs/knight-arena.mjs`.

## Test plan

`rules.test.ts` ≤ 600 lines:
- **Tuning & schedule pins:** literal checks for `BEAT` (`MAX_HIT_SLOTS = 140`, `MAX_SHIELDS = 12`, `MAX_DOUBLES = 29`, 111 cumulative beats, no beat at $15/30/45\text{ s}$, first beat $1.50\text{ s} \ge 1.2\text{ s}$, **every hit slot $\le 59.6\text{ s}$ including the second half of any double**, lead time $\ge 2$ beats, half-beat doubles $\ge 230\text{ ms}$ apart, no tomato within $\pm 200\text{ ms}$ of a real target in the same direction across 1,000 seeds).
- **Rules & edge cases:** mid-frame judge ($t - dt/2$), near/far earliest-beat arbitration (tie: near), unhit expiry at $t_b + 200\text{ ms}$ resets combo, whiff resets combo and scores 0, one strike per frame, input during 0.25 s swing counts, shield 2-hit window and crack/break scoring, combo steps to $\times 2$ on the 9th hit / $\times 3$ on the 17th / $\times 4$ on the 25th, spin skips tomatoes / no meter recharge / $+50$ only when $\ge 1$ cleared / meter clamped at 100%, touch $\pm 120\text{ ms}$ window leaves `perfectScore(map)` and `maxScore` unchanged.
- **Real-store bots (`botHarness`, 200 seeds each at 20 / 30 / 60 / 144 Hz):**
  - **Oracle bot** reaches **$\ge 0.97 \times$ the oracle score** (`perfectScore(map)`).
  - **Human bot** (timing jitter $\mathcal{N}(0, 50\text{ ms})$) reaches $\ge 50\%$ of the oracle score.
  - **Bots that must NOT score high:** **4-direction mash bot** ($\le 15\%$ of oracle), **decoy-hitter bot** ($-50$ and combo reset), **skip-hard-targets bot** (expiry resets combo), **pause-spam bot** ($\le$ oracle), and **always-spin bot** ($\le$ oracle). Every run passes `withinServerLimits` and `capScore` is a no-op.
- **`poses.test.ts` / `assets.test.ts`:** soles within 1 cm of floor across idle, 4 swings, 1.0 m `walkPose` lunge step, and cheer; sword tip within $\le 0.15\text{ m}$ of the near ($1.28\text{ m}$) and far ($2.28\text{ m}$) dummies' **front surfaces** at contact frame ($u = 0.5$); lunging knight body ($r = 0.40\text{ m}$) stays $> 0.72\text{ m}$ centre-to-centre from the near dummy ($r = 0.32\text{ m}$); sword stays at $y \le 1.80\text{ m}$ during play and never clips head.
- **Browser checks:** measured CSS pixel sizes ($\ge 24\text{ px}$ on shorter side, applying the $\pm 3.0\text{ m}$ fit or knight scale fallback if needed at $844 \times 390$) and 8-dummy + icon + plume/sword non-occlusion at $1280 \times 800$, $390 \times 844$, and $844 \times 390$ with banner open; Retry $\times 10$ flat geometries.

## Performance

Target **≤ 30 draw calls**, hard cap **45** (spec §18.18); triangles $\le 70\text{k}$.
- Draw-call count: knight (`<HumanoidModel>`, 1 mesh) **1** + sword & shield **2** + 8 dummies (`<DynamicInstancedModel>`) **2** + base discs, 3D approach rings & billboard icons (instanced) **3** + `<Fence>` **2** + 2 castle towers (instanced) **1** + 4 trees (instanced) **1** + arena floor **2** + `<BlobShadow>` **1** + `<SkyDome>` **1** + `<Trail target={swordTipRef}>` **1** + active `useFx()` burst pools (`sparks`, `confetti`, `puff`) **3** + floating score sprites (8 `SCORE_SLOTS`) **8** = **28 draw calls** ($\le 30$ target, $\le 45$ cap). Zero per-frame allocations.

## Audio

- Ambient loop: `startLoop("ambient", { volume: 0.2 })` (restarted on `[phase, muted]`).
- Optional metronome click (toggleable via `M` or HUD button): `playSfx("click", { pitch: 1.0, volume: 0.25 })`.
- SFX: swing `playSfx("whoosh", { pitch: 1.1 })`, hit `playSfx("thud", { pitch: 1.0 + combo * 0.1, volume: 0.5 })`, shield crack/break `playSfx("zap", { pitch: 0.8 })` / `playSfx("chime")`, tomato splat `playSfx("splash", { pitch: 0.7 })`, spin `playSfx("combo", { pitch: 1.2 })`, run-end fanfare `playSfx("win")` + `playSfx("chime", { pitch: 1.25 })` in the 1200 ms result delay.

## Accessibility

- High-contrast chevron arrow shapes vs round tomato splat icon (shape + outline, never colour alone).
- Game-local 3D approach ring shrinks onto the $r = 0.50\text{ m}$ target disc over 2 beats; wider on-beat window on touch ($\pm 120\text{ ms}$ vs $\pm 90\text{ ms}$); toggleable metronome click; pulsing "SPIN READY!" badge with icon + text in `data-arcade-safe-area` HUD ($\ge 4.5:1$ contrast).

## Risks and open questions

- **Open questions for the user (not decided here):**
  1. **Shell `"lose"` sting on `"timeup"` (core gap, Claude):** `GameShell` plays `"lose"` for every non-`"win"` end, `"timeup"` included; should core play `"win"` when a points game ends on `"timeup"`?
  2. **Approve proposed score limits at go-live:** `maxScore = ceil100(max_map perfectScore * 1.04)` ($\le 11,300$), `minDurationMs: 58000`, `maxDurationMs: 62000`, `base: 0`, `maxPointsPerSec = ceil(maxScore / 58)` ($\le 195$).
  3. **Wider touch window on a shared leaderboard:** Keep $\pm 120\text{ ms}$ on-beat on touch vs $\pm 90\text{ ms}$ on desktop on the same leaderboard?
  4. **Knight height 1.75 m vs 1.6 m:** Keep 1.75 m (for $\ge 24\text{ px}$ phone readability and 1.28 m surface sword reach) or use the catalog's 1.6 m?
  5. **Whether doubles exist at all on touch:** Keep half-beat double pairs ($\ge 230.8\text{ ms}$ apart) on touch or spawn doubles on desktop only?

## Fix round 1 (2026-10-24)

1. **Rule gaps (a–i):** Added unhit expiry ($t_b + 200\text{ ms}$) miss + combo reset; empty-direction whiff combo reset + 0 pts; 1 strike/frame with no lockout during the 0.25 s swing; near/far earliest-beat tie-break (tie: near) and $> 400\text{ ms}$ same-direction tomato separation; 2-beat lead time ($\ge 923\text{ ms}$) and $\pm 200\text{ ms}$ active window; half-beat doubles ($\ge 230.8\text{ ms}$); shield Hit 2 on next beat $\pm 200\text{ ms}$ with combo + meter rules; spin skips tomatoes, no meter recharge, $+1$ combo/target, $+50$ only if $\ge 1$ cleared, meter capped at 100%; 111 cumulative beats in $1.50\text{–}59.54\text{ s}$ with no boundary beats.
2. **Max-score proof & limits:** Switched to 3 fixed seeded maps (`randomSeed() % 3`), `perfectScore(map)` oracle, `BEAT` slot caps ($H \le 140$), proven $B \le 80H - 960 + 50\lfloor 15H/100 \rfloor = 11,290$; marked limits as proposed for go-live while `meta.ts` stays at `9000 / 9000` on branch.
3. **Camera, reach, core APIs, HUD & tests:** Set `area` AABB, `pitch: (60 * Math.PI) / 180` rad, `focus: [{ x: 0, y: 0, z: 0 }]`, `fov: 45`; set $r_{\text{near}} = 1.6\text{ m}$, $r_{\text{far}} = 2.6\text{ m}$ with 1.0 m lunge and 360° root-yaw spin; replaced invalid `fx.*` calls with `fx.burst` and `<Trail>`; added mid-frame judge ($t - dt/2$), metronome toggle, 200-seed 20/30/60/144 Hz bot suite, 28 draw-call budget, and "Changed from spec" rationales.

## Fix round 2 (2026-10-24)

1. **Blocker 1 — Far strike geometry, real `walkPose` step & surface contact:** Rotated the 4 far dummies ($r_{\text{far}} = 2.60\text{ m}$) by $+22.5^\circ$ ($\pi/8\text{ rad}$) clockwise off the cardinal rays to $(+1.00, -2.40)$, $(-1.00, +2.40)$, $(-2.40, -1.00)$, and $(+2.40, +1.00)$, keeping the $1.00\text{ m}$ lunge peak $0.78\text{ m}$ centre-to-centre from the near dummy ($> 0.40 + 0.32 = 0.72\text{ m}$, $0.06\text{ m}$ body clearance) and the sword path $0.61\text{ m}$ from the near dummy's centre ($0.29\text{ m}$ surface clearance). Replaced the planted rear foot and leg IK with a real `walkPose` step out and back + `bodyLift` (dropped leg IK; `core/rig` has no IK). Set standing sword-tip reach along the strike line to $1.28\text{ m}$ ($0.14\text{ m}$ lean $+ 0.44\text{ m}$ arm $+ 0.70\text{ m}$ blade) and lunge reach to $2.28\text{ m}$, measuring `poses.test.ts` contact against each dummy's **front surface** ($r - 0.32\text{ m} = 1.28\text{ m}$ near, $2.28\text{ m}$ far). Verified that cardinal keys and swipes (`pressed.up/down/left/right`) still address each sector's near ($0^\circ$) and far ($+22.5^\circ$, $|\tan 22.5^\circ| = 0.414 < 1$) dummies.
2. **Blocker 2 — Full occlusion proof including billboard icons, plume & raised sword:** With the $22.5^\circ$ far-dummy offset ($\Delta x = 1.00\text{ m}$), $0.60\text{ m}$ overhead icons ($y \in [1.55, 2.15]\text{ m}$), and shoulder-level sword swings capped at $y \le 1.80\text{ m}$ ($z_{\text{proj}} = -1.04\text{ m}$, plume at $y = 1.75\text{ m} \to -1.01\text{ m}$, both south of Near-N's $-1.10\text{ m}$ disc edge), redid the $60^\circ$ projection table across all 8 dummies + knight showing disjoint $(x, z_{\text{proj}})$ spans for every disc, body, icon, plume, and raised sword.
3. **Build-time pins & nits:** Pinned combo step so $\times 2$ starts on the 9th hit ($\times 3$ on 17th, $\times 4$ on 25th, matching $-960$); set `maxScore = ceil100(max_map perfectScore * 1.04)` from the real build oracle while keeping $11,290$ as the sanity ceiling and removing the invented $\sim 11,200$ number (real oracle $\le \sim 10,810$); set oracle-bot test to $\ge 0.97 \times$ oracle score; gave `turnTowards` the game-local ease fraction `amount = min(1, 40*dt/|diff|)`; kept core `hudStats` numeric only (`Spin` 0–100) with `"SPIN READY!"` in `definition.Hud`; pinned every hit slot $\le 59.6\text{ s}$ including the second half of doubles; updated the predicted px table ($\sim 0.58\text{ m}$ knight width, $0.87\times$ foreshortened discs, smaller far row, browser measurement $\ge 24\text{ px}$ with $\pm 3.0\text{ m}$ fit / scale fallback); moved `KNIGHT_LANDMARKS` to `core/sharedAssets` and `touchControls` / `touchLabels` to `GameDefinition` (`index.tsx`).

## Decisions (user, 2026-10-24)

The user approved this design and asked Claude to settle every open question with a modern, fair arcade feel in mind. These answers override the Open questions above; the build follows them.

- **Core (Claude adds before the builds):** a points game that ends on `"timeup"` with a score above 0 plays the win cue and confetti like a finish, not the lose sting; `GameDefinition.clockChip: false` hides the shell's Played chip for games that show their own clock.
- Q1 timeup sting: fixed in core (see above).
- Q2 limits: approved as proposed (maxScore = ceil100(max over the 3 maps of perfectScore x 1.04), 58-62 s, base 0, pps = ceil(maxScore / 58)); Claude writes the measured numbers into meta.ts and arcade-games.json at merge.
- Q3 timing window: ONE window for every device, +-110 ms (a shared leaderboard stays fair; touch latency is covered by judging at the frame's mid-time).
- Q4 knight height: 1.75 m (readability on phones).
- Q5 doubles: only same-direction near + far pairs (one strike clears both) on every device; no half-beat pairs.
- Modern look: the new Hyper3D sword and shield GLBs (`/models/3d/knight-arena/sword.glb`, `shield.glb`, already in the manifest) replace the code attachments; arena at sunset with banners, a Trail on the sword tip, sparks on hits, a beat-synced light pulse on the targets.
