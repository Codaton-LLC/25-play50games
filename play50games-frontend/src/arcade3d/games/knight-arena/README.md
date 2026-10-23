# Knight Training Arena

Owner: Antigravity. Slug: `knight-arena`. Skill game 8 (order 28 in catalog, game 18 in expansion), complexity 3. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §18. Gate G0 (game design); the build fills `Status`. Units: metres, seconds; x east (+x = right), z south (+z = front/camera), y up. Every "Changed from spec" line says what and why.

## Concept

A young knight trains on the castle green at midday. The knight stands at the centre of an octagonal wooden training ring surrounded by 8 wooden training dummies (4 cardinal directions × near/far). Targets pop up on the beat showing directional arrows; the knight strikes in rhythm with a wooden sword to build combo multipliers up to ×4. Shield dummies require two strikes, and tomato decoys must be avoided. A full spin meter unleashes a 360° sweeping spin attack hitting all active real targets. Accent `#facc15`.

## Controls

`meta.ts`: `scheme: "timing"`, `touchControls: ["swipe", "action"]`, `touchLabels: { action: "Spin" }`.

- `keyboard`: "Arrows / WASD to strike, Space to spin"
- `touch`: "Swipe to strike, Action to spin"
- Directional strikes read `input.pressed.up / down / left / right` (one-frame latched). Swipes are already included in `pressed` by core convention (never also read `swipe`). Space / E / Enter and the 72 px bottom-right touch **Spin** (`Action`) button read `actionPressed || jumpPressed` to fire the spin attack when the spin meter is at 100%. `M` key or the HUD button toggles the optional metronome click. Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ARENA`, `KNIGHT`, `TARGETS`, `BEAT`, `TIMING`, `COMBO`, `SPIN`, `SCORING`) and are proven in `rules.test.ts`.

- **Arena** (`ARENA`): octagonal ring radius 4.5 m enclosed by `<Fence path={RING_PATH}>` (`core/kit`, `RING_PATH = createPath(OCTAGON_POINTS, { closed: true })`), surrounded by green grass `#65a30d`, two backdrop towers (`EXPANSION_ASSETS.castleTower`, 6 m tall at (−6, −7.5) and (6, −7.5)), and four leafy trees (`EXPANSION_ASSETS.leafyTree`, 3.5 m tall).
- **Knight & reach** (`KNIGHT`, `poses.ts`): `EXPANSION_CHARACTERS.knight` (1.75 m tall, scale $1.75 / 1.884 = 0.929$, auto-rigged with `KNIGHT_LANDMARKS`). Stands at (0, 0, 0) facing south (+z, yaw 0). Carries a 0.85 m wooden sword in `attach.handR` and a 0.55 m heater shield in `attach.handL`.
  - **Facing**: root group yaw turns toward each strike direction (`0` = S/+z, `π` = N/−z, `−π/2` = W/−x, `+π/2` = E/+x) via `turnTowards` at 40 rad/s (reaches 180° in $\le 0.08\text{ s}$) and **keeps facing the last strike** until the next directional input.
  - **Swings & lunge**: 4 directional swings (duration 0.25 s, contact at $u = 0.5$) built from `aimArm(out, side, ux, uy, uz, fx, fy, fz, roll)` (8-number signature) + `turnBone` on spine/chest. Standing sword reach from origin is $\approx 0.26\text{ m}$ shoulder $+ 0.44\text{ m}$ arm $+ 0.10\text{ m}$ torso lean $+ 0.75\text{ m}$ blade beyond grip $= \mathbf{1.55\text{ m}}$, meeting the near dummy ($r_{\text{near}} = 1.60\text{ m}$, surface $1.28\text{ m}$) within $0.05\text{ m}$ of centre. For a far strike ($r_{\text{far}} = 2.60\text{ m}$, surface $2.28\text{ m}$), the knight steps **$1.00\text{ m}$ outward** and back ($\sin(\pi u)$ translation peaking at $1.00\text{ m}$ at $u = 0.5$, total reach $2.55\text{ m}$, within $0.05\text{ m} \le 0.15\text{ m}$ of the far dummy), driven by a `walkPose` stride step + `bodyLift` (with two-bone leg IK on the rear foot like `penalty-hero`'s `keeperReadyPose` so the planted foot never slides).
  - **Spin**: a 360° spin (0.40 s) rotates the **knight root group's yaw** by $2\pi \cdot \text{smoothstep}(u)$ while holding a horizontal cleave pose (`aimArm`), not a bone spin. `cheerPose` plays on run end.
- **Target dummies** (`TARGETS`, 8 posts): 4 directions (N, S, W, E) × 2 distances: **near** $r_{\text{near}} = 1.60\text{ m}$ (in-place swing) and **far** $r_{\text{far}} = 2.60\text{ m}$ (1.0 m lunge step). Each dummy (`EXPANSION_ASSETS.dummy`, 1.50 m tall, collision radius $0.32\text{ m}$) stands on a ground target disc of radius $r_{\text{disc}} = \mathbf{0.50\text{ m}}$ ($1.00\text{ m}$ diameter; near $[1.10, 2.10]\text{ m}$ and far $[2.10, 3.10]\text{ m}$ touch without overlapping). Hits trigger damped spring wobble (`core/motion` `spring`, $k = 64, c = 8$).
- **Beat map & cumulative schedule** (`BEAT`): fixed `durationMs: 60000`. Runtime selects one of **3 fixed seeded beat maps** (`BEAT.MAP_SEEDS = [101, 202, 303]`, picked via `BEAT.MAP_SEEDS[randomSeed() % 3]`; `createBeatMap(seed)` stays pure for any seed). Beat times form **one cumulative list** (`BEAT_TIMES_MS`, 111 beats total) with **no beat on a stage boundary** ($15, 30, 45\text{ s}$), first scoring beat at $t_0 = \mathbf{1.50\text{ s}}$ ($\ge 1.2\text{ s}$), last beat at $t_{110} = \mathbf{59.54\text{ s}}$ ($\le 59.6\text{ s}$, so its $+200\text{ ms}$ window closes at $59.74\text{ s} < 60.0\text{ s}$):
  - **Stage 1** ($1.50\text{–}14.70\text{ s}$, 100 BPM = $600\text{ ms}$): 23 beats; near regular dummies only.
  - **Stage 2** ($15.27\text{–}29.45\text{ s}$, 110 BPM = $545.45\text{ ms}$): 27 beats; near + far regular dummies + shield dummies.
  - **Stage 3** ($30.50\text{–}44.50\text{ s}$, 120 BPM = $500\text{ ms}$): 29 beats; adds tomato decoys + half-beat double targets ($\Delta t = 250\text{ ms}$).
  - **Stage 4** ($45.23\text{–}59.54\text{ s}$, 130 BPM = $461.54\text{ ms}$): 32 beats; fast mixed (near + far regulars, shields, half-beat doubles at $\Delta t = 230.8\text{ ms} \ge 230\text{ ms}$, and off-direction tomato decoys).
  - **Map caps** (`BEAT` constants): across the 111 beats, every map caps total hit slots at `BEAT.MAX_HIT_SLOTS = 140` ($H \le 140$), shield dummies at `BEAT.MAX_SHIELDS = 12` (each shield is 2 consecutive hit slots on the same post = 24 slots), half-beat double pairs at `BEAT.MAX_DOUBLES = 29` (each pair adds a second regular hit slot half a beat later = 58 slots across 29 beats), and single-target beats at 58 ($24 + 58 + 58 = 140$ hit slots), plus `BEAT.TOMATO_COUNT = 18` tomato decoys.
- **Lead time, active window & timing judge** (`TIMING`):
  - **Lead time**: every target becomes visible **2 beats before** its beat time $t_b$ ($1200\text{ ms}$ at 100 BPM, $\ge 923\text{ ms}$ at 130 BPM), with an overhead billboard icon and a 3D approach ring shrinking onto the $r = 0.50\text{ m}$ ground disc.
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
- **Combo** (`COMBO`): starts at $\times 1$, steps $+1$ every 8 consecutive real hits ($\times 2$ at 8, $\times 3$ at 16, max $\times 4$ at $24+$ hits). Any whiff, unhit expiry, or struck tomato resets combo to $\times 1$.

## Scoring

- Regular hit: $20 \times \text{combo}$ on-beat ($\le 90/120\text{ ms}$), $10 \times \text{combo}$ off-beat ($90\text{–}200\text{ ms}$).
- Shield dummy: Hit 1 (crack) = $10 \times \text{combo}$ on-beat ($5 \times \text{combo}$ off-beat); Hit 2 (break) = $20 \times \text{combo}$ on-beat ($10 \times \text{combo}$ off-beat).
- Tomato decoy struck: $-50\text{ pts}$ (`run.score = Math.max(0, run.score - 50)` per event, matching `useArcadeStore.addScore` floor at 0; no time-up `setScore`).
- Spin attack: $20 \times \text{combo}$ per cleared active real target $+ 50\text{ pts}$ spin bonus (when $\ge 1$ target cleared).

### Server limits and why they hold (the proof)

`meta.ts` stays at the provisional `9000 / 58000–62000 / 9000 / 9000` on this branch; `arcade-games.json` is Claude-owned and updated with `meta.ts` at go-live.

| | provisional (`meta.ts` on branch) | **proposed** for go-live (Claude sets `meta.ts` + `arcade-games.json`) |
|---|---|---|
| `maxScore` / `max_score` | 9000 | **11700** |
| `minDurationMs`–`maxDurationMs` | 58000–62000 ms | **58000–62000 ms** |
| `base` / `maxPointsPerSec` | 9000 / 9000 | **0 / 202** |

Proof (`rules.ts` `perfectScore(map)` oracle + closed-form bound):
1. **Hit-slot bound (`H`):** Across 111 cumulative beats, `BEAT.MAX_HIT_SLOTS` caps total real hit slots at $H \le 140$ ($12$ shields $\times 2 + 29$ half-beat doubles $\times 2 + 58$ singles $= 140$). Every hit slot yields at most $20 \times \text{combo}$ (a shield crack yields $10 \times \text{combo} \le 40 < 80$; a spin-cleared shield yields one $20 \times \text{combo} \le 80$ slot instead of two).
2. **Combo ramp deduction (`-960`):** Hits 1–8 are at $\times 1$ ($\le 20 = 80 - 60$), hits 9–16 at $\times 2$ ($\le 40 = 80 - 40$), hits 17–24 at $\times 3$ ($\le 60 = 80 - 20$), and hits $25..H$ at $\times 4$ ($\le 80$). Thus total hit points across $H \ge 24$ slots satisfy:
   $$P_{\text{hits}}(H) \le 80H - (8 \times 60 + 8 \times 40 + 8 \times 20) = 80H - 960.$$
3. **Spin bonus bound:** Each non-spin hit adds at most $+15\%$ meter, spin-cleared targets add $0\%$, and the meter never overflows past $100\%$, so $\text{spins} \le \lfloor 15H / 100 \rfloor$. With $H \le 140$, $\text{spins} \le \lfloor 15 \times 140 / 100 \rfloor = 21$, adding at most $50 \times \text{spins} \le 1050\text{ pts}$:
   $$B(H) \le 80H - 960 + 50\lfloor 15H / 100 \rfloor = 80(140) - 960 + 50(21) = 10,240 + 1,050 = \mathbf{11,290}\text{ pts}.$$
4. **Oracle on the 3 fixed maps & `maxScore`:** On the 3 fixed maps (`BEAT.MAP_SEEDS`), the `perfectScore(map)` DP/oracle (accounting for the 12 shield cracks at $10 \times \text{combo}$ and spin-cleared slots not charging the meter) reaches $\approx 11,200\text{ pts}$; $\max_{\text{map}} \text{perfectScore}(\text{map}) \times 1.04 \le 11,700$ (rounded up to 100) gives **`maxScore = 11700`** ($+3.6\%$ above the analytic ceiling $11,290$).
5. **Duration & `maxPointsPerSec`:** Fixed `durationMs: 60000` ends only on `"timeup"` at 60.0 s (`58000–62000 ms`). For a fixed-duration game we set **`base = 0`** and **`maxPointsPerSec = ceil(11700 / 58) = 202`** ($0 + 202 \times 58 = 11,716 \ge 11,700$).

## Run end

- `"timeup"` by shell at 60 s (`durationMs: 60000`). No `"lose"` condition; `"quit"` on Exit discards the run.
- `resultDelayMs: 1200`: knight plays `cheerPose`, `fx.burst("confetti", { x: 0, y: 1.8, z: 0 }, 28)` fires, and the Scene plays its own completion fanfare (`playSfx("win")` + `playSfx("chime", { pitch: 1.25 })`). Note: `GameShell` currently plays `"lose"` on any non-`"win"` end including `"timeup"` (see Open Questions).

## Scene and camera

- **Camera & fit**: `GameDefinition.camera = { position: [0, 9.5, 5.5], fov: 45 }` (overrides stub `fov: 50`). Fixed 3/4 view with `useFittedView` using AABB `area = { min: { x: -3.5, y: 0, z: -3.5 }, max: { x: 3.5, y: 2.3, z: 3.5 } }` ($y \in [0, 2.3]\text{ m}$ encloses the 1.75 m knight, helmet plume, raised sword, and $y = 1.85\text{ m}$ overhead target icons; the $r = 4.5\text{ m}$ fence and backdrop towers/trees sit outside the fit box as peripheral decor), `pitch: (60 * Math.PI) / 180` ($60^\circ$ in radians), `yaws: [0]`, `focus: [{ x: 0, y: 0, z: 0 }]`, `margin: { top: 0.10, bottom: 0.08, left: 0.03, right: 0.03 }`, `shift: true`, `avoidControls: true` (keeps the 72 px bottom-right Spin button out of the fit).
- **N / S line-of-sight projection table at pitch $60^\circ$ (`yaw = 0`, $\cot 60^\circ = 0.5774$, $z_{\text{proj}} = z - 0.5774\,y$):**

| Object on $x = 0$ line | Ground $z$ (m) | Disc $z$ ($r = 0.50\text{ m}$) | Top height $y$ (m) | Top projected $z_{\text{proj}}$ (m) | Occlusion check |
|---|---|---|---|---|---|
| Far-N dummy | −2.60 | [−3.10, −2.10] | 1.50 (icon 1.85) | −3.47 (icon −3.67) | Fully north of Near-N |
| Near-N dummy | −1.60 | [−2.10, −1.10] | 1.50 (icon 1.85) | **−2.47** (icon −2.67) | Top at −2.47 m stops **0.13 m south** of Far-N post (−2.60 m); Far-N torso & icon clear |
| Knight (origin) | 0.00 | — | 1.75 | **−1.01** | Head at −1.01 m stops **0.09 m south** of Near-N disc front edge (−1.10 m); 0 overlap |
| Near-S dummy | +1.60 | [+1.10, +2.10] | 1.50 (icon 1.85) | +0.73 (icon +0.53) | Clear of knight ($z = 0$) |
| Far-S dummy | +2.60 | [+2.10, +3.10] | 1.50 (icon 1.85) | **+1.73** (icon +1.53) | Top at +1.73 m stops **0.13 m south** of Near-S post (+1.60 m); Near-S torso & front disc clear |

- **Pixel readability (predicted from $7.0 \times 2.3 \times 7.0\text{ m}$ fitted AABB at pitch $60^\circ$, `fov: 45`, banner open on phones), shorter side in CSS px:**

| Viewport | Scale (px/m) | Knight ($0.75 \times 1.75\text{ m}$) | Dummy + disc ($r = 0.50\text{ m}$, $1.0\text{ m}$ Ø) | Overhead arrow / tomato ($0.75\text{ m}$) | Target |
|---|---|---|---|---|---|
| 1280 × 800 (desktop) | ~92 px/m | 60 × 124 px | 80 × 92 px (disc) / 92 × 149 px (with dummy) | 65 × 65 px | $\ge 24\text{ px}$: pass |
| 390 × 844 (touch, banner) | ~52 px/m | 34 × 70 px | 45 × 52 px (disc) / 52 × 84 px (with dummy) | 38 × 38 px | $\ge 24\text{ px}$: pass |
| 844 × 390 (touch, banner) | ~33 px/m | 25 × 45 px | 29 × 33 px (disc) / 33 × 54 px (with dummy) | 25 × 25 px | $\ge 24\text{ px}$: pass |

- **HUD (`hudStats` + `definition.Hud`)**: `hudStats` shows `Combo` (`x1`..`x4`) and `Spin` (`0%`..`99%` / `READY!`). `definition.Hud` renders a compact top-centre `data-arcade-safe-area` bar with the spin meter fill, a pulsing **"SPIN READY! [SPACE / SPIN]"** badge with a sword-star icon at 100% (shape + text + motion, not colour alone), and the Metronome mute/unmute button.

## Core helpers used

`GameDefinition` (`durationMs`, `resultDelayMs`, `touchControls`, `touchLabels`, `hudStats`, `Hud`, `camera`, `environment`), `useRunFrame`, `useGameTime`, `useInput`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setStat`, `end`); `core/math` (`createRng`, `rngNext`, `randomSeed`, `turnTowards`); `core/path` (`createPath`); `core/motion` (`spring`); `core/kit` (`Fence`); `core/rig` (`<HumanoidModel attach>`, `useHumanoidPose`, `idlePose`, `walkPose`, `cheerPose`, `aimArm`, `turnBone`, `levelFoot`, `bodyLift`, `KNIGHT_LANDMARKS`, `BONE`); `core/fx` (`useFx`: `burst` with `"sparks"`, `"confetti"`, `"puff"`, `score`, `shake`, `warm`; `<Trail target={swordTipRef}>`); `core/env` (`<SkyDome>`); `core/render` (`<InstancedModel>`, `<DynamicInstancedModel>`, `<DynamicInstanced>`, `BlobShadow`, `useCanvasTexture`); `core/audio` (`playSfx`, `startLoop`, `stopAllLoops`); `core/limits` (`withinServerLimits`, `capScore`); `core/testing/botHarness` (`createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`).

## Assets

| id / source | class | target in game | rules footprint | fallback |
|---|---|---|---|---|
| `knight` / `EXPANSION_CHARACTERS.knight` | C (A) | 1.75 m tall (GLB 1.884 m, auto-rig) | circle r 0.4 m at origin | capsule |
| `dummy` / `EXPANSION_ASSETS.dummy` | A | 1.5 m on $r = 0.50\text{ m}$ base disc (8 posts) | circle r 0.32 m | capsule |
| `castleTower` / `EXPANSION_ASSETS.castleTower` | C (A) | 6.0 m tall, 2 backdrop towers | circle r 1.4 m | cylinder |
| `leafyTree` / `EXPANSION_ASSETS.leafyTree` | C (A) | 3.5 m tall, 4 trees outside ring | circle r 0.6 m | cylinder + cone |
| `woodenSword` / procedural | B | 0.85 m long, in `attach.handR` | tip reach 1.55 m (2.55 m lunge) | box |
| `shield` / procedural | B | 0.55 m heater shield, in `attach.handL` | none | cylinder |
| `fence` / `core/kit/Fence` | B | octagonal ring r 4.5 m, height 1.1 m (`createPath`) | decor outside fit box | procedural posts |
| `targetMarkers` / procedural | B | $r = 0.50\text{ m}$ ground discs, 3D shrinking approach rings, $0.75\text{ m}$ billboard arrows/tomato | none | plane + ring |

- `assets.spec.json` has `"assets": []` (0 custom GLBs owned).
- **Changed from spec:**
  - *Spin +50 bonus:* Spin attack grants $+50\text{ pts}$ when clearing $\ge 1$ active target because it rewards holding Spin for multi-target beats while keeping the ceiling tight ($50 \times 21 = 1050$).
  - *Shield 10 + 20 scoring:* Shield dummy pays $10 \times \text{combo}$ on Hit 1 (crack) and $20 \times \text{combo}$ on Hit 2 (break) on beat ($5\times / 10\times$ off-beat) because immediate points feedback confirms the crack while keeping every hit slot $\le 20 \times \text{combo}$.
  - *Confetti at ×4 and run end:* `fx.burst("confetti", ...)` triggers both when reaching $\times 4$ combo (spec §18.11) and during the 1200 ms run-end delay because both moments merit a celebration burst.
  - *No cloth banners on fence:* Dropped separate banner meshes (spec §18.10; banner colours `#facc15` / `#3b82f6` applied to shield and ring trim) because omitting them saves draw calls under the 45-call cap and keeps the N/S sightline clean.
  - *3 fixed maps vs any seed:* Gameplay draws from 3 fixed map seeds (`MAP_SEEDS[randomSeed() % 3]`, matching spec §18.8) while `createBeatMap(seed)` accepts any seed so tests can verify invariants across 1,000 seeds.
  - *Knight height 1.75 m vs catalog 1.6 m:* Proposed at 1.75 m because it keeps the knight $\ge 25\text{ px}$ at $844 \times 390$ with the banner open and gives a 1.55 m sword reach (see Open Questions).
  - *Dummy on a $r = 0.50\text{ m}$ base disc, not a post:* The shared `dummy.glb` includes its own stand and has no separate post mesh, and the $1.0\text{ m}$ base disc provides the $\ge 24\text{ px}$ floor target.
  - *Stage 4 "fast mixed" contents:* Explicitly defined as 32 beats at 130 BPM combining near + far regulars, 2-hit shields, half-beat doubles ($\Delta t = 230.8\text{ ms}$), and off-direction tomatoes because spec §18.7 leaves "fast mixed" open.

## Files

`meta.ts` · `index.tsx` · `rules.ts` (`perfectScore`, beat maps, mid-frame judge, strike/spin/combo/score) · `rules.test.ts` · `poses.ts` + `poses.test.ts` · `assets.ts` + `assets.test.ts` · `Scene.tsx` · `Arena.tsx` · `Dummies.tsx` · `Primitives.tsx` · `assets.spec.json` · `README.md` · `tools/thumbs/inputs/knight-arena.mjs`.

## Test plan

`rules.test.ts` ≤ 600 lines:
- **Tuning & schedule pins:** literal checks for `BEAT` (`MAX_HIT_SLOTS = 140`, `MAX_SHIELDS = 12`, `MAX_DOUBLES = 29`, 111 cumulative beats, no beat at $15/30/45\text{ s}$, first beat $1.50\text{ s} \ge 1.2\text{ s}$, last beat $59.54\text{ s} \le 59.6\text{ s}$, lead time $\ge 2$ beats, half-beat doubles $\ge 230\text{ ms}$ apart, no tomato within $\pm 200\text{ ms}$ of a real target in the same direction across 1,000 seeds).
- **Rules & edge cases:** mid-frame judge ($t - dt/2$), near/far earliest-beat arbitration (tie: near), unhit expiry at $t_b + 200\text{ ms}$ resets combo, whiff resets combo and scores 0, one strike per frame, input during 0.25 s swing counts, shield 2-hit window and crack/break scoring, spin skips tomatoes / no meter recharge / $+50$ only when $\ge 1$ cleared / meter clamped at 100%, touch $\pm 120\text{ ms}$ window leaves `perfectScore(map)` and `maxScore` unchanged.
- **Real-store bots (`botHarness`, 200 seeds each at 20 / 30 / 60 / 144 Hz):**
  - **Oracle bot** reaches $\ge 90\%$ of `maxScore` ($\ge 10,530$).
  - **Human bot** (timing jitter $\mathcal{N}(0, 50\text{ ms})$) reaches $\ge 50\%$ of the oracle score.
  - **Bots that must NOT score high:** **4-direction mash bot** ($\le 15\%$ of oracle), **decoy-hitter bot** ($-50$ and combo reset), **skip-hard-targets bot** (expiry resets combo), **pause-spam bot** ($\le$ oracle), and **always-spin bot** ($\le$ oracle). Every run passes `withinServerLimits` (`11700 / 58000–62000 / 0 / 202`) and `capScore` is a no-op.
- **`poses.test.ts` / `assets.test.ts`:** soles within 1 cm of floor across idle, 4 swings, 1.0 m lunge, and cheer; sword tip within $\le 0.15\text{ m}$ of near (1.6 m) and far (2.6 m) dummies at contact frame; sword never clips head.
- **Browser checks:** pixel sizes ($\ge 24\text{ px}$) and N/S occlusion at $1280 \times 800$, $390 \times 844$, and $844 \times 390$ with banner open; Retry $\times 10$ flat geometries.

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
  2. **Approve proposed score limits at go-live:** `maxScore: 11700`, `minDurationMs: 58000`, `maxDurationMs: 62000`, `base: 0`, `maxPointsPerSec: 202`.
  3. **Wider touch window on a shared leaderboard:** Keep $\pm 120\text{ ms}$ on-beat on touch vs $\pm 90\text{ ms}$ on desktop on the same leaderboard?
  4. **Knight height 1.75 m vs 1.6 m:** Keep 1.75 m (for $\ge 25\text{ px}$ phone readability and 1.55 m sword reach) or use the catalog's 1.6 m?
  5. **Whether doubles exist at all on touch:** Keep half-beat double pairs ($\ge 230.8\text{ ms}$ apart) on touch or spawn doubles on desktop only?

## Fix round 1 (2026-10-24)

1. **Rule gaps (a–i):** Added unhit expiry ($t_b + 200\text{ ms}$) miss + combo reset; empty-direction whiff combo reset + 0 pts; 1 strike/frame with no lockout during the 0.25 s swing; near/far earliest-beat tie-break (tie: near) and $> 400\text{ ms}$ same-direction tomato separation; 2-beat lead time ($\ge 923\text{ ms}$) and $\pm 200\text{ ms}$ active window; half-beat doubles ($\ge 230.8\text{ ms}$); shield Hit 2 on next beat $\pm 200\text{ ms}$ with combo + meter rules; spin skips tomatoes, no meter recharge, $+1$ combo/target, $+50$ only if $\ge 1$ cleared, meter capped at 100%; 111 cumulative beats in $1.50\text{–}59.54\text{ s}$ with no boundary beats.
2. **Max-score proof:** Switched to 3 fixed seeded maps (`randomSeed() % 3`), `perfectScore(map)` oracle, `BEAT` slot caps ($H \le 140$), proven $B \le 80H - 960 + 50\lfloor 15H/100 \rfloor = 11,290$, and proposed `11700 / 58000–62000 / 0 / 202`.
3. **Limits wording:** Marked limits as **proposed** for go-live; `meta.ts` stays at `9000 / 9000` on branch.
4. **Camera & occlusion:** Set `area` AABB (`y: 0..2.3`), `pitch: (60 * Math.PI) / 180` rad, `focus: [{ x: 0, y: 0, z: 0 }]`, `fov: 45`, and added the $60^\circ$ N/S projection table.
5. **Readability:** Set target disc $r = 0.50\text{ m}$, fitted gameplay box $\pm 3.5\text{ m}$ (fence cropped as decor), and added the CSS px table ($1280 \times 800$, $390 \times 844$, $844 \times 390$ with banner).
6. **Reach & motion:** Set $r_{\text{near}} = 1.6\text{ m}$, $r_{\text{far}} = 2.6\text{ m}$ with a $1.0\text{ m}$ lunge (`walkPose` + two-bone IK) and $\le 0.15\text{ m}$ sword-tip contact test; 360° spin as root group yaw; `turnTowards` within $0.08\text{ s}$ holding last strike facing.
7. **Core APIs:** Replaced invalid `fx.*` calls with `fx.burst("sparks" | "confetti", p, n)` and `<Trail target={swordTipRef}/>`; dropped `TimingRing` for 3D instanced approach rings; dropped time-up `setScore`; replaced shell win fanfare with in-delay game fanfare; listed `createPath`, `randomSeed`, 8-number `aimArm`, and `hudStats`.
8. **HUD:** Specified `hudStats` (`combo`, `spin`) + `data-arcade-safe-area` `definition.Hud` with non-colour "SPIN READY!" badge and `avoidControls: true`.
9. **Timing fairness:** Added mid-frame judge ($t - dt/2$), 20/30/60/144 Hz bot tests, and toggleable metronome (`M` / HUD button).
10. **Test plan:** Added 200-seed 20/30/60/144 Hz oracle ($\ge 90\%$), human ($\ge 50\%$ of oracle), and 5 negative bots (4-dir mash $\le 15\%$, decoy-hitter, skip-hard, pause-spam, always-spin), touch window max invariance, and browser px/occlusion checks.
11. **Performance & spec diffs:** Updated draw calls to target 30 / cap 45 (28 total including 1 knight mesh, 8 score sprites, 1 `<Trail>`) and added all 8 "Changed from spec: ... because ..." items.
