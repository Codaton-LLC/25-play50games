# Jungle Bridge Run

Game 46 · points · difficulty 2 · collection adventure · owner antigravity (built by Antigravity, gated and integrated by Claude 2026-10-25). Spec: `docs/menu1-new/specs-41-50.md` §46.

A forward runner on three plank lanes over a jungle river: jump the gaps and rolling logs, slide under the vines, take the clear lane past a pillar or a lava vent, stay on the planks of a rope bridge, grab the gems. Each section ends at a ruin gate (a checkpoint); a hit costs one of three lives and puts you back 4 m before the section start, on its clear lane.

## Controls (one set of timings for keyboard and touch)

- Lanes: `pressed.left` / `pressed.right` (A / D, arrows, swipes; `pressed` already carries the swipes, `swipe` is never read), 0.18 s per lane, also mid-jump. Lane 0 is the screen's left lane: the camera looks along +z, so `LANE_X = [2, 0, -2]`.
- Jump: `jumpPressed` (Space, touch: a swipe up via `pressed.up`), 0.55 s, a 1.3 m arc, not again in the air. Slide: `pressed.down`, 0.60 s on the ground (a slide in the air drops the runner).
- `touchControls: []`: the canvas swipes are the controls. Nothing in the rules knows the device.

## Rules (`rules.ts`, pure)

- Sections of 24 m from z = 6; the runner starts at z = 0 and moves at the level's `speed` (no boost). The finish is the last gate.
- Every section has a clear lane that differs from the lane the runner arrives on (the last clear lane; lane 1 at the start). One pattern at +5 m, or (L4–L5) two at +1.5 and +13.5 m (never a bridge in a pair): every pattern is at least 9.5 m from the next (spec: "keep L5 patterns spaced at least 10 m").
  - `gap`: 2.5 m without planks on all lanes; a grounded runner (y < 0.15) inside the inner 1.7 m falls (the 0.4 m edges hold a foot). Jump.
  - `vine`: a bar over the clear and the arrival lane (all three half the time), ±0.35 m deep: slide under it on the ground.
  - `log`: rolls back and forth across ±2.4 m at `logSpeed` (axis along z, 1.2 m long, 0.6 m thick); a runner under 0.4 m within its reach trips. Jump it or dodge it. A single log's section also has a pillar on the arrival lane 10.2 m on, and two logs never pair, so standing still never passes a section.
  - `bridge`: 8 m where only the clear lane has planks.
  - `pillar` / `lava`: block the arrival lane (lava only 1.2 s of every 3 s).
- Gems: 3 per section at +4 / +11 / +18 m, on the clear lane or (35 %) another lane, never inside a pillar, a vent or off a bridge's planks (moved to the clear lane).
- Score, all integers: +20 per gem (once), +100 per gate passed (the last one included), on the win +6 per full second left on the shell clock.
- End: win at the finish; lose at 0 lives; timeup from the shell (`durationMs`, a ceiling).

## Levels

| L | Title | Sections | Speed | Patterns | Log speed | Clock | Look | Limits (max / min ms / base / pps) |
|---|---|---:|---:|---|---:|---:|---|---|
| 1 | Jungle Path | 3 | 6.0 | gap, pillar | – | 75 s | day | 880 / 5500 / 480 / 30 |
| 2 | Rope Bridges | 5 | 6.5 | + bridge, vine | – | 90 s | day | 1260 / 5200 / 800 / 23 |
| 3 | Waterfall | 7 | 7.0 | + log | 2.5 | 110 s | day, waterfall backdrop | 1680 / 4900 / 1120 / 22 |
| 4 | Ancient Temple | 9 | 7.8 | same, pairs | 3.2 | 120 s | sunset, closer fog | 2050 / 3300 / 1440 / 20 |
| 5 | Volcano Jungle | 12 | 8.4 | + lava, pairs | 3.6 | 120 s | sunset, red fog, volcano backdrop | 2505 / 3200 / 1920 / 15 |

Only a win clears a level (no `clearScore`).

## Server limits and why they hold (one proof per level)

- `Bobj = 100 · sections + 20 · 3 · sections` (every gate and gem once) = 480 / 800 / 1120 / 1440 / 1920 = `base`.
- The run moves forward at exactly `speed` from z = 0 and nothing speeds it up (a hit only sets it back), so the earliest win is exactly `M = (6 + 24 · sections) / speed` = 13.00 / 19.38 / 24.86 / 28.46 / 35.00 s (`earliestWinS`; every bot win in the tests is at or after it).
- A win at `t ≥ M` scores at most `Bobj + 6 · floor(D − t)`, largest at `M`: peak 852 / 1220 / 1630 / 1986 / 2430; before `M` the score is part of `Bobj ≤ base`. The rate line needs `pps ≥ 6 (D / M − 1)` = 28.6 / 21.9 / 20.6 / 19.3 / 14.6 → 30 / 23 / 22 / 20 / 15 (the test walks every t in 10 ms steps).
- `maxScore` = peak + 3 %, rounded up to 5. The oracle bot reaches the peak exactly on every level (all gems, no hit): 97 % of `maxScore`.
- `minDurationMs`: no run ends before three hits at the earliest points the layout allows (`earliestEndS`: the first pattern's start minus 0.6 m, from z = 0, then twice after the 0.8 s respawn 4 m before the section) = 6.13 / 5.78 / 5.49 / 3.74 / 3.59 s; the limit is ~0.9 of that. A win is always later.
- L5 / L1 = 2505 / 880 = 2.85 (≤ 3).

Bots (`testing/bots.ts`, through `createArcadeStore` + `simulateRun`, the Scene's own `syncStore`; `proof.level-N.test.ts` one level per file): the honest bot (jumps and slides centred in each window with a ±60 ms seeded spread, lane changes to the clear lane) clears ≥ 99 % of 200 seeds per level at 30 / 60 / 144 Hz (200 / 200 measured on every level); the oracle (perfect timing, detours for every gem when the lane is safe) stays inside the limits and reaches ≥ 90 % of `maxScore`; idle never clears (200 seeds); input spam stays inside the limits (60 seeds, random frames).

`rules.test.ts`: determinism; the generator on 200 seeds per level (counts, clear line, the arrival lane always stopped, spacing, pairs only on L4–L5, gems reachable); every obstacle's rule (a jump clears a gap and a slide does not, a slide clears a vine and a jump does not, log height, pillar, bridge, the lava window); move timings; screen-ordered lanes; every score event; respawn; the store's lives. `levels.test.ts`, `assets.test.ts` (every GLB's bounds and fit, the deck drawn exactly where the rules hold the runner, decor clearances), `explorer.test.ts` (the auto-rig checks on the real mesh). Mutation probes on every level read in `rules.ts`, `index.tsx`, `looks.ts` and `meta.ts` fail the tests.

## Look and models

All listed `menu1-jungle-bridge-run` GLBs are adopted (`templePillarV2`, `ruinGateR`; `jungleLogSingle`, `jungleFern` and `volcanoBackdrop` from the still-needed list are in the ready folder now and adopted too; `jungleLog` (two logs) and `junglePlant` (potted) are not used), plus `EXPANSION_ASSETS.leafyTree`. Fits in `assets.ts` from the measured bounds, tested on the real meshes:

- explorer 1.76 m through the core auto-rig (`EXPLORER_LANDMARKS`, measured; crotch set by hand): run (`walkPose` 1, phase by `gaitPhaseStep`), `jumpPose` by height, a slide leans the spine and tips the body back, `flailPose` and a drop after a fall, `cheerPose` at the finish; untinted.
- track: `woodenBridge` as 1 m plank-lane pieces (1.9 m wide, low kerbs between lanes) stretched by `sz` over each stretch of deck; `ropeBridge` (1.6 m, rope rails) on a bridge's plank lane; one `ruinGateR` per lane at every gate (2 m wide, lintel 2 m up); `templePillarV2` 1.1 m wide; `jungleLogSingle` 1.2 m long, 0.6 m thick, rolling about its axis. Every kind is one instanced pool.
- code by design: the vine bars (a rope with leaf tufts; spec: `hangingVineV2` is still needed), lava vents (crust + an eruption glow), gems (one faceted cyan pool), stilts under the deck, `<Water>` 12 m down.
- canyon: `jungleRock` walls and river rocks, `leafyTree` rims, `jungleFern`, `hangingVine` curtains (background only), all fitted to 1 m and placed by their spot's scale; nothing above the deck within |x| < 7 (the camera at x = 0 can never see decor in front of the runner, `assets.test.ts`); L3 `waterfallCliff` and L5 `volcanoBackdrop` ride beside the track ahead of the camera, hazy in the fog.
- Camera: behind and above (yaw π), pitch 28°, 8 m look-ahead, x fixed on the track centre, a fitted window of the three lanes from the runner to 17 m ahead, `shift`.

## Known issues / for the playtest

- Not yet seen in a browser at the gate: the deck's top height (`FIT.deckTop`, from the mesh profile), the gate's opening, the log's roll, the explorer's slide lean.
- A slide is a lean, not a crouch (no slide pose in core).
- The rolling log is visual on its own lane band; the hit box is its 1.2 m length.
