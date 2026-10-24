# Knight Training Arena

Owner: Antigravity. Slug: `knight-arena`. Skill game 8 (order 28 in catalog, game 18 in expansion), complexity 3. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §18. Gate G0 (game design); the build fills `Status`. Units: metres, seconds; x east (+x = right), z south (+z = front/camera), y up. Every "Changed from spec" line says what and why.

## Concept

A young knight trains on the castle green at sunset. The knight stands at the centre of an octagonal wooden training ring surrounded by 8 wooden training dummies (4 near on the cardinal rays + 4 far rotated $22.5^\circ$ off the cardinal rays). Targets pop up on the beat showing directional arrows; the knight strikes in rhythm with a sword to build combo multipliers up to ×4. Shield dummies require two strikes, and tomato decoys must be avoided. A full spin meter unleashes a 360° sweeping spin attack hitting all active real targets. Accent `#facc15`.

## Controls

`meta.ts`: `controls.scheme = "timing"`. `GameDefinition` (`index.tsx`): `touchControls: ["joystick", "action", "swipe"]`, `touchLabels: { action: "Spin" }`.

- `keyboard`: "Arrows / WASD to strike, Space to spin"
- `touch`: "Swipe to strike, Action to spin"
- Directional strikes read `input.pressed.up / down / left / right` (one-frame latched). Swipes are already included in `pressed` by core convention (never also read `swipe`). Each cardinal key/swipe (`up` = N, `down` = S, `left` = W, `right` = E) addresses both the near cardinal dummy ($0^\circ$) and the far dummy ($+22.5^\circ$ clockwise off that cardinal ray) in that sector: both display the same cardinal chevron arrow, and even a diagonal touch swipe aimed directly at a $22.5^\circ$ far dummy has $|\tan 22.5^\circ| = 0.414 < 1$, so `inputController.ts` still classifies its dominant axis as the matching cardinal `pressed` direction. Space / E / Enter and the 72 px bottom-right touch **Spin** (`Action`) button read `actionPressed || jumpPressed` to fire the spin attack when the spin meter is at 100%. `M` key or the HUD button toggles the optional metronome click. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ARENA`, `KNIGHT`, `TARGETS`, `BEAT`, `TIMING`, `COMBO`, `SPIN`, `SCORING`, `PROPOSED_LIMITS`) and are proven in `rules.test.ts`.

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
  - **On-beat vs off-beat**: $|t_{\text{judge}} - t_b| \le 110\text{ ms}$ (`TIMING.ON_BEAT_WINDOW_MS = 110`, Q3 Decision: one window for every device) is **on-beat** ($20 \times \text{combo}$); $110\text{–}200\text{ ms}$ is **off-beat** ($10 \times \text{combo}$).
- **Strike arbitration, whiffs, expiry & target types**:
  - **(a) Unhit expiry**: any real target still unhit past $t_b + 200\text{ ms}$ expires as a **miss** and resets combo to $\times 1$. An expired tomato decoy disappears with 0 penalty and no combo change.
  - **(b) Whiff (empty direction)**: pressing a direction that has **no live target** within $\pm 200\text{ ms}$ is a **whiff**: resets combo to $\times 1$, awards 0 points, and adds 0% spin meter.
  - **(c) One strike per frame & swing overlap**: at most one directional strike is processed per frame (`up, down, left, right`). The 0.25 s swing animation is visual only and does not lock out input.
  - **(d) Near vs far same-direction & tomato separation**: when both near and far targets in the pressed direction are within $\pm 200\text{ ms}$, the strike hits the earliest beat $t_b$; if they form a same-direction near + far double pair at $t_b$, **one strike in that direction clears both** (Q5 Decision). The generator never schedules a tomato decoy in the same direction within $\pm 400\text{ ms}$ of a real target.
  - **(e) Shield dummy (2 hits)**: Hit 1 at $t_{b1} \pm 200\text{ ms}$ cracks the shield; Hit 2 is on the next beat $t_{b2}$ on the same post. Missing Hit 1 expires both Hit 1 and Hit 2 and resets combo.
  - **(f) Spin attack** (`SPIN`): real-target hits charge the meter by $+15\%$ on-beat ($+10\%$ off-beat), clamped to $100\%$. At $100\%$, Space/Action consumes the meter (`0%`) and sweeps $360^\circ$: it clears all active real targets ($20 \times \text{combo}$ each), skips tomato decoys, adds $+1$ combo hit per cleared target, does not charge the spin meter during the sweep, and awards $+50\text{ pts}$ spin bonus when $\ge 1$ active real target is cleared.
- **Combo** (`COMBO`): multiplier on the $k$-th consecutive real hit (`1 + Math.min(3, Math.floor((k - 1) / 8))`) starts at $\times 1$ for hits 1–8, **$\times 2$ on the 9th hit** (hits 9–16), **$\times 3$ on the 17th hit** (hits 17–24), and **$\times 4$ on the 25th hit** (hits $25+$).

## Scoring

- Real target hit: $20 \times \text{combo}$ on-beat ($\le 110\text{ ms}$), $10 \times \text{combo}$ off-beat ($110\text{–}200\text{ ms}$).
- Tomato decoy struck: $-50\text{ pts}$ (`run.score = Math.max(0, run.score - 50)`), resets combo to $\times 1$.
- Spin attack: $20 \times \text{combo}$ per cleared active real target $+ 50\text{ pts}$ spin bonus (when $\ge 1$ target cleared).
- **Server limits (`PROPOSED_LIMITS` in `rules.ts`)**: `meta.ts` stays at provisional `9000 / 58000–62000 / 9000 / 9000` on branch; `PROPOSED_LIMITS` exports proven `maxScore = 11600` (`ceil100(11090 * 1.04)`), `minDurationMs = 58000`, `maxDurationMs = 62000`, `base = 0`, `maxPointsPerSec = 200` (`ceil(11600 / 58)`).

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
- Q2 limits: approved as proposed (`PROPOSED_LIMITS` in `rules.ts`: `maxScore=11600`, `58–62 s`, `base=0`, `maxPointsPerSec=200`).
- Q3 timing window: ONE window for every device, $\pm 110\text{ ms}$ (judged at frame midpoint $t - dt/2$).
- Q4 knight height: 1.75 m.
- Q5 doubles: only same-direction near + far pairs (one strike clears both) on every device; no half-beat pairs.
- Modern look: Hyper3D sword and shield GLBs (`/models/3d/knight-arena/sword.glb`, `shield.glb`) on `handR`/`handL`, sunset arena with banners, `<Trail>` on sword tip, `sparks` on hits, and beat-synced target light pulse.

## Status

```
TASK P-18-knight-arena | build knight-arena | branch antigravity/game-knight-arena | allowed: play50games-frontend/src/arcade3d/games/knight-arena/**, play50games-frontend/public/images/3d/knight-arena.webp, tools/thumbs/inputs/knight-arena.mjs

STATUS: DONE
FILES: play50games-frontend/src/arcade3d/games/knight-arena/{README.md,index.tsx,assets.ts,assets.test.ts,poses.ts,poses.test.ts,rules.ts,rules.test.ts,Primitives.tsx,Arena.tsx,Dummies.tsx,Scene.tsx}, tools/thumbs/inputs/knight-arena.mjs, .handoff/P-18-knight-arena/HANDOFF.md
TESTS: 11 passed / 0 failed (assets.test.ts: 3, poses.test.ts: 4, rules.test.ts: 4 covering 1,000-seed schedule invariants, timing/combo/shield/double/tomato/spin rules, and 200-seed real-store oracle/human/random/adversarial bots across 20/30/60/144 Hz)
PROPOSED_LIMITS: maxScore=11600, minDurationMs=58000, maxDurationMs=62000, base=0, maxPointsPerSec=200 (oracle=11090, human=8450, random=310)
BLOCKERS: none
```
