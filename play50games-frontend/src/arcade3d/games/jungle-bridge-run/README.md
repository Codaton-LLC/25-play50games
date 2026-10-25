# Jungle Bridge Run

Owner: antigravity. Slug: `jungle-bridge-run`. Order 46. Status `dev`. Collection `adventure`. Points. Difficulty 2. Five levels. Spec: `.handoff/C-46-jungle-bridge-run/spec.md`.

## Rules

Race an explorer forward along a three-lane track through the jungle. Jump gaps and rolling logs, slide under vines, cross single-lane rope bridges, and navigate around solid pillars and lava vents. Collect gems along the way. Each 24 m obstacle section ends in an ancient ruin checkpoint gate. Reaching the gate awards +100 points and updates your respawn checkpoint.

Falling into a gap or hitting an obstacle costs one of your 3 lives and respawns you at the start of the current section after a 0.8 s recovery delay. Gems already collected in that section remain collected.

Lanes are at x = −2, 0, +2. Lane transitions take 0.18 s and can be initiated at any time, including mid-jump. The jump lasts 0.55 s with a 1.3 m parabolic arc. The slide lasts 0.60 s and lowers the player hitbox to 0.6 m (clearing low hanging vines).

Score:
- +100 per section cleared
- +20 per gem collected
- Win only: +4 per full second left on the clock (`4 * floor(timeLeftMs / 1000)`)
- Objective ceiling: `Bobj = 100 * sections + 20 * (3 * sections)`.

## Levels

Track length = `sections * 24` m (+ 6 m run-in).

| L | Title | Sections | Speed | Patterns | Clock | Lighting | Background | Fog Far |
|---|---|---:|---:|---|---:|---|---|---:|
| 1 | Jungle Path | 3 | 6.0 m/s | gap, pillar | 75 s | day | `#86efac` | 70 m |
| 2 | Rope Bridges | 5 | 6.5 m/s | gap, pillar, bridge, vine | 90 s | day | `#4ade80` | 60 m |
| 3 | Waterfall | 7 | 7.0 m/s | gap, pillar, bridge, vine, log | 110 s | day | `#22c55e` | 55 m |
| 4 | Ancient Temple | 9 | 7.8 m/s | gap, pillar, bridge, vine, log | 120 s | sunset | `#a16207` | 45 m |
| 5 | Volcano Jungle | 12 | 8.4 m/s | gap, pillar, bridge, vine, log, lava | 120 s | sunset | `#7f1d1d` | 40 m |

## Controls

- Keyboard: A / D or Left / Right arrows to switch lanes (0.18 s), Space or W or Up arrow to jump (0.55 s), S or Down arrow to slide (0.60 s).
- Touch: Canvas swipes (swipes fire into `pressed` mid-gesture: swipe left/right for lanes, swipe up to jump, swipe down to slide). `touchControls: []`.
- Scheme: `runner`.
- Timings are identical between keyboard and touch (`rules.test.ts`).
- Shell stats: Section (n of sections), Gems.

## Server limits

`base = Bobj`. `minDurationMs = 4000`. `unitLabel: "pts"`, `display: "int"`.
Level 5 `maxScore` (2310) satisfies the 3× rule: `2310 / 780 = 2.96 ≤ 3.0` and `2310 ≤ 3300`.

`base + pps * seconds` at measured earliest win:

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 480 | 13.00 s | 728 | 480 + 24 × 13.00 = 792 | 780 | 93.3% |
| 2 | 800 | 19.40 s | 1080 | 800 + 20 × 19.40 = 1188 | 1140 | 94.7% |
| 3 | 1120 | 24.87 s | 1460 | 1120 + 18 × 24.87 = 1567 | 1510 | 96.7% |
| 4 | 1440 | 28.47 s | 1804 | 1440 + 16 × 28.47 = 1895 | 1860 | 97.0% |
| 5 | 1920 | 35.03 s | 2256 | 1920 + 14 × 35.03 = 2410 | 2310 | 97.7% |

Proof (`rules.test.ts`):
- Deterministic run generation across 200 seeds.
- Guaranteed clear line for every section.
- Jump clears gap (slide falls); slide clears vine (jump/stand hits).
- Falls respawn at section start, preserving collected gems.
- Independent simultaneous jump and lane change.
- Bot harness:
  - Oracle wins across levels and reaches ≥ 90% of maxScore.
  - Human-paced bot stays within limits.
  - Idle bot fails to win and stays within limits.
  - Spam bot stays within limits.

## Look

One unified palette in `looks.ts`. Planks `#a16207`, moss `#4d7c0f`, water far below `#0e7490` (`<Water>` 12 m down), accent `#22c55e`.
Camera: follow along z only (x fixed at 0 to avoid lane swimming), pitch 28°, look-ahead 8 m, fov 50, `shift: true`.
Character: auto-rigged explorer (1.76 m) driven by `walkPose` (run speed), `jumpPose`, `turnBone` on spine (low lean slide), `flailPose` (fall/recovery) and `cheerPose` (win).
Decor: unit-size geometry scaled by spot; canyon walls and jungle canopy line the outer perimeter so there is no void at the screen edges.

## What Claude registers

1. `src/arcade3d/types.ts` — `"jungle-bridge-run"` is registered in `ARCADE_SLUGS`.
2. `src/arcade3d/registry.ts` — `jungleBridgeRunMeta` registered in `ARCADE_GAMES`.
3. `src/arcade3d/loaders.ts` — `"jungle-bridge-run": () => import("./games/jungle-bridge-run")`.
4. `play50games-backend/play50games/includes/arcade-games.json` — copy the five level limits:

```json
"jungle-bridge-run": {
  "title": "Jungle Bridge Run",
  "kind": "points",
  "max_score": 780,
  "min_duration_ms": 4000,
  "max_duration_ms": 75000,
  "base": 480,
  "max_pps": 24,
  "enabled": false,
  "levels": [
    { "title": "Jungle Path", "max_score": 780, "min_duration_ms": 4000, "max_duration_ms": 75000, "base": 480, "max_pps": 24 },
    { "title": "Rope Bridges", "max_score": 1140, "min_duration_ms": 4000, "max_duration_ms": 90000, "base": 800, "max_pps": 20 },
    { "title": "Waterfall", "max_score": 1510, "min_duration_ms": 4000, "max_duration_ms": 110000, "base": 1120, "max_pps": 18 },
    { "title": "Ancient Temple", "max_score": 1860, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 1440, "max_pps": 16 },
    { "title": "Volcano Jungle", "max_score": 2310, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 1920, "max_pps": 14 }
  ]
}
```
