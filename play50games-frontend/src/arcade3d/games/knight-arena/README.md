# Knight Training Arena

Owner: Antigravity. Slug: `knight-arena`. Skill game 8 (order 28 in catalog, game 18 in expansion), complexity 3. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §18. Gate G0 (game design); the build fills `Status`. Units: metres, seconds; x east (+x = right), z south (+z = front/camera), y up. Every "Changed from spec" line says what and why.

## Concept

A young knight trains on the castle green at midday. The knight stands at the centre of an octagonal wooden training ring surrounded by 8 wooden dummy posts. Targets pop up on the beat showing directional arrows; the knight strikes in rhythm with a wooden sword to build combo multipliers up to ×4. Shield dummies require two strikes, and tomato decoys must be avoided. A full spin meter unleashes a 360° sweeping spin attack hitting all active targets. Accent `#facc15`.

## Controls

`meta.ts`: `scheme: "timing"`, `touchControls: ["swipe", "action"]`, `touchLabels: { action: "Spin" }`.

- `keyboard`: "Arrows / WASD to strike, Space to spin"
- `touch`: "Swipe to strike, Action to spin"
- Directional strikes read `input.pressed.up / down / left / right` (one-frame latched). Swipes are already included in `pressed` by core convention (never also read `swipe`). Space key and touch Action button read `actionPressed || jumpPressed` to fire the spin attack when the spin meter is full (100%). Esc / P pause (shell).

## Rules

All numbers live in `rules.ts` (`ARENA`, `KNIGHT`, `TARGETS`, `BEAT`, `COMBO`, `SPIN`) and are proven in `rules.test.ts`.

- **Arena** (`ARENA`): octagonal training ring radius 4.5 m enclosed by `<Fence>` (`core/kit`), surrounded by green grass, two backdrop towers (`EXPANSION_ASSETS.castleTower`, 6 m tall at (-7, 8) and (7, 8)), and four leafy trees (`EXPANSION_ASSETS.leafyTree`, 3.5 m tall).
- **Knight** (`KNIGHT`): `EXPANSION_CHARACTERS.knight` (height 1.75 m, auto-rigged humanoid with `KNIGHT_LANDMARKS`). Stands at (0, 0, 0) facing south (+z). Carries wooden sword in right hand (`attach.handR`) and shield in left hand (`attach.handL`).
- **Poses** (`poses.ts`): `idlePose` with breathing sway; 4 strike swings (Up/-z, Down/+z, Left/-x, Right/+x) using `aimArm` and torso `turnBone` (duration 0.25 s); far target strikes include a 0.6 m lunge step with planted foot (`bodyLift`); 360° `spinPose` (duration 0.40 s); `cheerPose` on run completion. Soles flat on ground (`levelFoot`, `ground = 1`).
- **Target posts** (8 dummies): 4 cardinal directions (N, S, W, E) at 2 distances: near $r_{\text{near}} = 2.0\text{ m}$ (in-place swing) and far $r_{\text{far}} = 3.2\text{ m}$ (lunge-step swing). Dummies: `EXPANSION_ASSETS.dummy` (1.5 m on base disc). Hits trigger damped spring wobble (`core/motion` `spring`, $k = 64, c = 8$).
- **Beat map** (`BEAT`): `durationMs: 60000` (fixed 60 s shell clock). 4 stages of 15 s: Stage 1 (0–15 s) 100 BPM (600 ms/beat, 25 beats, near targets); Stage 2 (15–30 s) 110 BPM (545.45 ms/beat, 27.5 beats, far + shield targets); Stage 3 (30–45 s) 120 BPM (500 ms/beat, 30 beats, decoys + double targets); Stage 4 (45–60 s) 130 BPM (461.5 ms/beat, 32.5 beats, fast mixed). Total exactly 115 beats. Seeded by `createRng(seed)`.
- **Timing windows**: on-beat within $\pm 90\text{ ms}$ ($\pm 120\text{ ms}$ on coarse pointers / touch). Active target hit window is $\pm 200\text{ ms}$ of target beat.
- **Hit resolution**: on-beat hit = 100% value + on-beat credit (×2); off-beat hit (90–200 ms) = 50% value (×1); wrong direction or outside 200 ms = miss (resets combo to ×1).
- **Target types**: Regular dummy (1 hit to clear); Shield dummy (needs 2 hits: hit 1 cracks shield, hit 2 breaks dummy, or spin attack clears in 1 hit); Tomato decoy (must be ignored: hitting gives −50 pts and resets combo; letting it expire costs nothing).
- **Spin attack** (`SPIN`): charges $+10\%$ per hit ($+15\%$ on beat). At 100%, Space/Action triggers a 360° sweep hitting all active targets with on-beat credit and clearing shields.
- **Combo** (`COMBO`): starts at ×1, increases by +1 every 8 consecutive hits (max ×4 at 24+ hits). Miss or decoy hit resets combo to ×1.

## Scoring

- On-beat hit: $20 \times \text{combo}$ ($10 \times 2 \times \text{combo}$).
- Off-beat hit: $10 \times \text{combo}$.
- Shield dummy: Hit 1 = $10 \times \text{combo}$; Hit 2 = $20 \times \text{combo}$ on beat.
- Tomato decoy hit: $-50\text{ pts}$ (floor 0).
- Spin attack: clears all active targets for on-beat points $\times$ combo, plus $+50\text{ pts}$ spin bonus.
- Popups: "+20", "+40", "+80", "COMBO x4!", "SPIN!" via `fx.score`. Live `addScore` per event; final `setScore(runScore)` on time-up.

### Server limits and why they hold (the proof)

| | provisional (02 §C.4) | set on this branch (`meta.ts` = `arcade-games.json`, `enabled: false`) |
|---|---|---|
| `maxScore` / `max_score` | 9000 | **10800** |
| duration | 58000–62000 ms | **58000–62000 ms** |
| `base` / `max_pps` | 9000 / 9000 | **300 / 180** |

Proof plan (real store via `botHarness`):
1. **Finite stream:** 115 beats across 60 s. Maximum possible target events $\le 140$ (including shields and doubles).
2. **Ceiling calculation:** Max points at combo ×4: hits 1–8: $8 \times 20 = 160$; 9–16: $8 \times 40 = 320$; 17–24: $8 \times 60 = 480$; hits 25–140: $116 \times 80 = 9280$; shields $\le 15 \times 20 = 300$; 4 spins $\times 50 = 200$. Theoretical absolute ceiling $\le 10,740 \le 10,800$.
3. **Rate bound:** Peak BPM is 130 BPM (2.167 beats/s). At combo ×4, maximum points rate is $\le 2.167 \times 80 = 173.3\text{ pps} \le 180\text{ pps}$. Line $300 + 180 \cdot t$ yields $11,100$ at 60 s, strictly enveloping all legal runs.
4. **Duration:** Fixed shell clock `durationMs: 60000`, run only ends on `"timeup"` at 60 s ($58,000 \le \text{duration} \le 62,000\text{ ms}$).
5. **Real-store bots:** Oracle bot (perfect timing on 200 seeds), human-paced bot (150–250 ms reaction time on 200 seeds), spam bot, and idle bot all satisfy `withinServerLimits` and `capScore` is a no-op.

## Run end

- `"timeup"` by shell at 60 s.
- `resultDelayMs: 1200`: knight cheers (`cheerPose`), fanfare audio plays, confetti burst.
- `"quit"` on Exit (immediate). No `"lose"` condition.

## Scene and camera

- Fixed 3/4 view: `useFittedView` with area $x \in [-4.5, 4.5]$, $z \in [-4.5, 4.5]$ (octagonal arena 9 × 9 m), pitch $45^\circ$, `yaws: [0]`, `focus: [0, 0, 0]`, `margin: { top: 0.10, bottom: 0.08, left: 0.03, right: 0.03 }`, `shift: true`, `fov: 45`.
- Fixed camera rationale: a rhythm and direction game requires instant, rock-solid screen-relative spatial orientation without camera drift.
- Lighting: `lighting: "day"`, sky dome gradient (`top="#1e3a8a"`, `bottom="#93c5fd"`), soft hemisphere light, blob shadows on knight and dummies.

## Core helpers used

`GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `useFittedView`, `CameraRig`, `useSafeArea`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`); `core/math` (`createRng`, `rngNext`, `turnTowards`); `core/motion` (`spring`); `core/kit` (`Fence`); `core/hud` (`TimingRing`); `core/rig` (`<HumanoidModel attach>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `turnBone`, `levelFoot`, `KNIGHT_LANDMARKS`, `BONE`); `core/fx` (`useFx`: `sparks`, `trail`, `confetti`, `score`); `core/render` (`<InstancedModel>`, `<DynamicInstancedModel>`, `BlobShadow`, `useCanvasTexture`); `core/audio` (`playSfx`, `startLoop`, `stopAllLoops`); `core/limits` (`withinServerLimits`, `capScore`); `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`).

## Assets

| id / source | class | target in game | rules footprint | fallback |
|---|---|---|---|---|
| `knight` / `EXPANSION_CHARACTERS.knight` | C (A) | 1.75 m tall (GLB 1.884 m, auto-rig) | circle r 0.4 m at origin | capsule |
| `dummy` / `EXPANSION_ASSETS.dummy` | A | 1.5 m on red base disc (8 posts) | circle r 0.32 m | capsule |
| `castleTower` / `EXPANSION_ASSETS.castleTower` | C (A) | 6.0 m tall, 2 towers in backdrop | circle r 1.4 m | cylinder |
| `leafyTree` / `EXPANSION_ASSETS.leafyTree` | C (A) | 3.5 m tall, 4 trees around ring | circle r 0.6 m | cylinder + cone |
| `woodenSword` / procedural | B | 0.85 m long, in right hand (`attach.handR`) | none | box |
| `shield` / procedural | B | 0.55 m heater shield, in left hand (`attach.handL`) | none | cylinder |
| `fence` / `core/kit/Fence` | B | octagonal ring r 4.5 m, height 1.1 m | none | procedural posts |
| `targetMarkers` / procedural | B | canvas-textured arrows (Up/Down/Left/Right, tomato) | none | plane |

- `assets.spec.json` has `"assets": []` because all 3D assets are shared/expansion GLBs; 0 custom GLBs owned.

## Files

`meta.ts` (data, limits) · `index.tsx` (`GameDefinition`) · `rules.ts` (beat schedule, timing judge, strike resolution, combo/meter state, scoring; pure) · `rules.test.ts` (beat generation, timing windows, combo math, store limit proofs) · `poses.ts` + `poses.test.ts` (pure knight strike poses, spin, cheer, foot contact tests) · `assets.ts` + `assets.test.ts` (mesh fits, landmarks) · `Scene.tsx` (one `useRunFrame`, audio, camera, fx, targets, knight) · `Arena.tsx` (ring floor, fence, castle towers, trees) · `Dummies.tsx` (8 dummy posts, spring wobble, arrow/target discs) · `Primitives.tsx` (stand-in fallbacks, wooden sword, shield) · `assets.spec.json` · `README.md` · `tools/thumbs/inputs/knight-arena.mjs`.

## Test plan

`rules.test.ts` ≤ 600 lines:
- Tuning constants pinned by literal values (`BEAT`, `TIMING`, `COMBO`, `SPIN`, `SCORING`).
- Determinism: 1,000 seeds produce valid, playable beat schedules with guaranteed spacing.
- Timing windows: on-beat ($\le 90$ ms desktop, $\le 120$ ms touch), off-beat ($90–200$ ms), miss ($> 200$ ms).
- Direction matching: matching direction strikes dummy; wrong direction counts as miss and resets combo.
- Shield dummy logic: requires 2 strikes (or 1 spin); tomato decoy: −50 and combo reset if struck, no penalty if ignored.
- Spin attack: meter accumulates correctly, Space/Action clears all lit targets, grants spin bonus.
- Real-store bots via `botHarness`: oracle bot, human-paced bot (150–250 ms reaction time), spam bot, and idle bot across 200 seeds; every run passes `withinServerLimits` and `capScore` is no-op.
- `poses.test.ts` / `assets.test.ts`: knight soles within 1 cm of floor across idle, all 4 swings, lunge, spin and cheer; sword does not clip head.

## Performance

Target **≤ 35 draw calls**, hard cap **50**; rendered triangles $\le 70\text{k}$.
- Calls estimate: knight 2, sword + shield 2, dummies (8 posts instanced) 1–2, fence 2, castle towers (2 instanced) 1, trees (4 instanced) 1, arena ground 2, target discs 1, fx pools 3, blob shadows 1, sky dome 1, score sprites 2 $\to \approx 20–25$ draw calls.
- Zero per-frame allocations: all matrices, scratch vectors, colors, and step input objects hoisted and preallocated.

## Audio

- Background: `startLoop("ambient", { volume: 0.2 })` (restarted on `[phase, muted]`).
- Beat click: `playSfx("click", { pitch: 1.0, volume: 0.25 })`.
- Strike whoosh: `playSfx("whoosh", { pitch: 1.1 })`.
- Hit thwack: `playSfx("thud", { pitch: 1.0 + combo * 0.1, volume: 0.5 })`.
- Shield clang: `playSfx("zap", { pitch: 0.8 })` / `playSfx("chime")`.
- Decoy splat: `playSfx("splash", { pitch: 0.7 })`.
- Spin attack: `playSfx("combo", { pitch: 1.2 })`.
- Win fanfare by shell.

## Accessibility

- Arrows use distinct high-contrast geometric chevron shapes; tomato decoy has distinct round splat icon (shape, not color alone).
- Shrinking timing ring visually converges onto target disc at the exact beat.
- Wider timing window on coarse pointers ($\pm 120\text{ ms}$ vs $\pm 90\text{ ms}$).
- Metronome audio click reinforces rhythm for low-vision players.
- HUD text $\ge 4.5:1$ contrast clear of shell chips.

## Risks and open questions

- **Sword collision with knight:** `poses.test.ts` validates that the wooden sword attached to `handR` swings outside the helmet plume and pauldrons.
- **Touch swipe response:** `pressed` handles swipe on direction detection without waiting for finger lift.
- **Open questions:**
  1. Approve updated score limits: `maxScore: 10800`, `duration: 58000–62000 ms`, `base: 300`, `max_pps: 180` (replacing placeholder `9000 / 9000`).
  2. Confirm shield target scoring (10 pts on crack + 20 pts on break × combo) and decoy tomato penalty (−50 pts + combo reset).

## Status

```text
HANDOFF P-14 knight-arena
Branch / last commit: antigravity/design-knight-arena @ HEAD (pushed)
Files changed:
  play50games-frontend/src/arcade3d/games/knight-arena/README.md
  play50games-frontend/src/arcade3d/games/knight-arena/assets.spec.json
Checks:
  - Branch confirmed: antigravity/design-knight-arena
  - Template matched: 14 sections from treasure-island/README.md, <= 200 lines
  - assets.spec.json: valid empty assets array (0 custom GLBs owned)
  - git status / git diff shows only the 2 allowed files
```
