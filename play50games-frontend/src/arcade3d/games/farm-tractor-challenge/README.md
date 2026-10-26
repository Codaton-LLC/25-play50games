# Farm Tractor Challenge

Owner: kimi. Slug: `farm-tractor-challenge`. Order 35. Status `dev`. Collection `skill`. Points. Difficulty 2. One yard, five level configs. Spec: `.handoff/C-35-farm-tractor-challenge/spec.md`.

## Rules

The field is `width × depth`, centred on the origin. North is +z. The barn bay is the north strip. The tractor starts on the south side, facing north, stopped. A fence ring is the boundary. The gate is a gap (`|x| < 3.8` at `z = depth/2 − 8`); the posts are circles of radius 0.42.

Street-vehicle integrator. Stick up is forward (`moveY` −1). Top speed 6, accel 6, brake 10, reverse 2, steer 1.4 rad/s, radius 1.35, drag 0.8. Positive steer turns right. Reverse flips the steer sign. Below 0.12 m/s the tractor can still turn, at half rate. Keyboard and touch share `step()`. The camera yaw is not used for steering.

A trip's bales wear the tint ring. Overlap at incoming speed under 2 hitches one into the next free trailer slot (the speed is read before drag). At 2 or above the bale stays and a life is spent. A full trailer ignores a further slow overlap. Unarmed bales do not hitch. Slots never exceed `balesPerTrip`.

The trailer is a critically damped spring (`SPRING_K` 26) toward a point 1.15 + 2.4 m behind the tractor. It never writes the tractor. Two slot offsets sit on that point.

Mud rects multiply accel, top speed and reverse by 0.55 while the tractor circle overlaps them. Speed above the mud top bleeds with the brake. Mud never covers a bale or the bay (200 seeds).

Fence segments, gate posts and tree boxes push the tractor out. Contact while moving into them above 0.8 m/s spends a life and zeros speed. At 0.8 or below the speed is scrubbed (× 0.15) and no life is spent. One bump per 1.15 s.

Parking: every bale of the trip is hitched, the tractor centre and every slot anchor are inside the bay, and `|speed| < 0.4` for 0.60 s of play time. Then +200, plus +100 if that trip took no bump. The next trip arms. A win is every trip parked. Lives are the level's bump budget; 0 lives is a loss. Timeup is the shell. On a win only, +4 per full second left.

`Bobj = 300 × trips` (the +200 and the clean +100). Bumps add no points.

## Levels

Same yard rules. Counts, cargo, clock and the core lighting preset change. Level 4 fogs grey (`#a8a29e`, near 9). The others fog toward their sky.

| L | Title | Trips | Bales | Mud | Trees | Cargo | Lives | Clock | Light |
|---|---|---:|---:|---:|---:|---|---:|---:|---|
| 1 | Farm Yard | 2 | 1 | 0 | 0 | hay | 6 | 120 s | day `#bae6fd` |
| 2 | Wheat Field | 3 | 2 | 0 | 0 | hay | 6 | 150 s | day `#86efac` |
| 3 | Orchard | 4 | 2 | 0 | 6 | crate | 5 | 180 s | sunset `#fdba74` |
| 4 | Mud Farm | 5 | 2 | 3 | 0 | hay | 4 | 180 s | day `#a8a29e` |
| 5 | Mega Farm | 6 | 2 | 4 | 8 | hay | 4 | 210 s | sunset `#b45309` |

Level 2 is the first trip with two slots. The hitch rule does not change. Trees are solid AABBs (half-extent 0.55). Level 3 swaps the hitch mesh to the apple crate at the same radius.

## Controls

WASD / arrows drive. Touch: joystick only. Scheme `steer`. The 2.0 hitch line, the 0.8 fence line and the 0.60 s park hold are the same on both devices (`rules.test.ts`). The shell owns pause. `clockChip` stays on. Custom HUD is Load `n/size` (`data-arcade-safe-area`). Stat chip: Trips. Score, time and lives (bumps left) are the shell chips. `resultDelayMs` 900.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000`. `unitLabel: "pts"`, `display: "int"`.

The sketch used an earliest win M and `peak = Bobj + 4 × (durationS − M)`, with level 1 pps 14 at M = 30 s. The oracle wins level 1 in 23.05 s at 984, and `600 + 14 × 23.05 = 922.7` is under that score, so level 1 pps is **22**. A clear at 19.1 s scores the 1000 cap, and `600 + 22 × 19.1 = 1020.2` still accepts it. Levels 2–5 finish after the sketch M, so their sketch pps already covers the score. Their `maxScore` is lower than the sketch so the measured best is at least 90% of the cap. Level 5 `maxScore` 2280 is under `3 × 1000`.

`base + pps × seconds` at the measured earliest win:

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 600 | 23.05 s | 984 | 600 + 22 × 23.05 = 1107.1 | 1000 | 98.4% |
| 2 | 900 | 67.27 s | 1228 | 900 + 13 × 67.27 = 1774.51 | 1340 | 91.6% |
| 3 | 1200 | 84.58 s | 1580 | 1200 + 12 × 84.58 = 2214.96 | 1740 | 90.8% |
| 4 | 1500 | 110.45 s | 1776 | 1500 + 9 × 110.45 = 2494.05 | 1960 | 90.6% |
| 5 | 1800 | 141.15 s | 2072 | 1800 + 8 × 141.15 = 2929.2 | 2280 | 90.9% |

Level 1's 23.05 s leaves 96 full seconds (`384 + 600 = 984`). The oracle did not beat 23.05 s in 24 runs plus the 144 Hz run.

Proof (`rules.test.ts`, through `createArcadeStore` + `advanceRunClock` + `withinServerLimits`): per level, 12 seeds at 30 Hz and 60 Hz for an oracle, a human-paced bot (stick 0.9, brake lag 0.18 s), an idle bot and a spam bot, plus one oracle at 144 Hz. Idle scores 0 and does not win. Spam stays inside the limits. Store score matches the rules score on every oracle run. Oracle wins: 24/24 on every level. Every winning best is at least 90% of that level's `maxScore`. Layout: 200 seeds × 5 levels, mud off the bales and the bay, gaps ≥ 4 m.

## Look

One palette in `looks.ts`. Grass `#84cc16`, soil `#a16207`, mud `#57534e`, barn `#b45309`, accent `#eab308`. Lighting and background come from the level. Chase camera: pitch 46°, yaws `[π, π/2]`, fov 46, follow fraction 0.2, look-ahead 3.5 m, `shift: true`, bounds the field.

The farmer is a seated `HumanoidModel` stand-in (`FarmerFigure`, 1.78 m, `applyLift={false}`) until `charFarmer.glb` is measured. Cheer on a win. Hay or crates are one `DynamicInstancedModel` pool (hidden once delivered, shown on the trailer by the same pool). Fence, trees and mud are instanced. Decor (silo, trough, scarecrow, shared crate) sits outside the north fence. Grass extends 2.6× the longer side so the chase frame has no void. Fallback posts and cargo are unit meshes scaled by the spot or the instance matrix.

## Known issues

- `charFarmer` has no measured landmarks and `scale` 1. The pose is a game-local sit (no core `sitPose`). Claude's assets PR measures the GLB and keeps the seated height at 1.78 m.
- Every url under `/models/3d/farm-tractor-challenge/` is unlisted, so those fallbacks draw. The leafy tree and the barn crate are shared meshes already in the manifest.
- Leave `hero.glb`. Regen still open for `hayBaleBound`, `grainSiloGround` and `scarecrowPost`. The game loads `hayBale`, `grainSilo` and `scarecrow`. `grainSiloR` is the closer interim silo if Claude swaps the file.
- Draw calls were not measured on a device. The target is about 30, cap 50.
- No thumbnail yet: `meta.thumbnail` is `null`.

## What Claude registers

The slug is already on main (registry, loader, stub meta). Status stays `dev`. Do not enable the game.

1. `play50games-backend/play50games/includes/arcade-games.json` — copy the five limits. Level 1 is the top-level scoring. `enabled: false`.

```json
"farm-tractor-challenge": {
  "title": "Farm Tractor Challenge",
  "kind": "points",
  "max_score": 1000,
  "min_duration_ms": 4000,
  "max_duration_ms": 120000,
  "base": 600,
  "max_pps": 22,
  "enabled": false,
  "levels": [
    { "title": "Farm Yard", "max_score": 1000, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 600, "max_pps": 22 },
    { "title": "Wheat Field", "max_score": 1340, "min_duration_ms": 4000, "max_duration_ms": 150000, "base": 900, "max_pps": 13 },
    { "title": "Orchard", "max_score": 1740, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1200, "max_pps": 12 },
    { "title": "Mud Farm", "max_score": 1960, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1500, "max_pps": 9 },
    { "title": "Mega Farm", "max_score": 2280, "min_duration_ms": 4000, "max_duration_ms": 210000, "base": 1800, "max_pps": 8 }
  ]
}
```

2. Copy the GLBs named in `assets.spec.json` to `public/models/3d/farm-tractor-challenge/` and add them to `core/modelManifest.ts`. Leave `hero.glb`. Then fit scales. The tree and the barn crate are already shared.
