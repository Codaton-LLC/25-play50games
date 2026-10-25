# Bee Garden

Game 40 · Points · Difficulty 1 · Owner: Antigravity.
Worktree branch: `antigravity/game-bee-garden`.

Fly in the horizontal plane over a vibrant garden, pick sweet nectar off blooming flowers, dodge sticky spider webs and return to the hive before the clock runs out.

## Concept and Controls

- **Avatar & Flight**: A busy bumblebee flying in the XZ plane with fixed altitude (1.15 m).
  - Movement: `moveY` / `moveX` via `inputToWorld(moveX, moveY, cameraYaw)`.
  - Normal top speed: 6.5 m/s, acceleration: 16 m/s², drag: 0.6, radius: 0.30 m.
  - Boost: Holding `jump` (Space on keyboard or "Boost" touch button) boosts speed to 9.5 m/s.
  - Stamina: Drains at 22/s while boosting. Hitting 0 or releasing boost triggers a 1.00 s lock cooldown before boost can be used again. Refills at 10/s while boost is idle (cap 100).
- **Core Loop**:
  - Fly over flowers to collect glowing nectar orbs.
  - Carry up to 3 nectar drops at once (`carried.length <= 3`).
  - Fly to the southern hive landing ring (radius 1.6 m) to deposit nectar:
    - Each unit scores +20 pts.
    - Depositing a full load of 3 scores a +15 pt bonus (+75 pts total for 3 units).
  - Clearing the level requires depositing all `units` (10 / 15 / 20 / 25 / 30).
  - On win: bonus of +4 per full second remaining on the timer.
- **Hazards & Obstacles**:
  - **Branches**: Solid circular logs (radius 0.50 m) that block the bee's flight path.
  - **Spider Webs**: Sticky hazards (radius 0.65 m). Overlapping a web stuns the bee for 0.50 s, halts velocity, and drops all carried nectar back onto the flowers it was taken from (they reappear uncollected). Hitting a web deals 0 damage and awards 0 pts.
  - **Breeze (Level 5)**: Constant +0.8 m/s² sideways wind acceleration along world +x.
- **Fairness**:
  - Keyboard and touch share identical physical parameters, timing constants (boost drain, refill, 1.0 s lock, 0.50 s web stun), and pickup radii.

## Five Levels

Level configurations defined in `levels.ts`:

| Level | Title | Units | Webs | Branches | Breeze | Duration | Lighting | Background |
|---|---|---:|---:|---:|---:|---:|---|---|
| 1 | Flower Garden | 10 | 0 | 2 | No | 120 s | day | `#7dd3fc` |
| 2 | Vegetable Garden | 15 | 2 | 4 | No | 150 s | day | `#86efac` |
| 3 | Greenhouse | 20 | 4 | 6 | No | 180 s | day | `#bbf7d0` |
| 4 | Forest Flowers | 25 | 6 | 8 | No | 180 s | sunset | `#166534` |
| 5 | Giant Garden | 30 | 8 | 8 | Yes (+0.8 m/s²) | 210 s | day | `#14532d` |

## Server Limits and Scoring Proofs

All scoring events are finite:
- Objective score ceiling: $B_{\text{obj}} = 20 \times \text{units} + 15 \times \lfloor \text{units} / 3 \rfloor$.
  - L1 (10 units = 3 full loads + 1 unit): $20 \times 10 + 15 \times 3 = 245$.
  - L2 (15 units = 5 full loads): $20 \times 15 + 15 \times 5 = 375$.
  - L3 (20 units = 6 full loads + 2 units): $20 \times 20 + 15 \times 6 = 490$.
  - L4 (25 units = 8 full loads + 1 unit): $20 \times 25 + 15 \times 8 = 620$.
  - L5 (30 units = 10 full loads): $20 \times 30 + 15 \times 10 = 750$.
- Speed bonus on win: $+4 \times \lfloor (\text{durationMs} - \text{elapsedMs}) / 1000 \rfloor$.
- Dropped nectar returns to its original flower and cannot be scored twice.
- Web hits and obstacle bumps add 0 points.
- Limits proven with earliest win time $M$ (s) and peak score $B_{\text{obj}} + 4 \times (\text{durationS} - M)$:

| Level | Title | $B_{\text{obj}}$ | Earliest $M$ (s) | Peak Score | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Flower Garden | 245 | 14 | 669 | 245 | 31 | 680 | 120,000 |
| 2 | Vegetable Garden | 375 | 24 | 879 | 375 | 22 | 890 | 150,000 |
| 3 | Greenhouse | 490 | 32 | 1082 | 490 | 19 | 1100 | 180,000 |
| 4 | Forest Flowers | 620 | 45 | 1160 | 620 | 13 | 1180 | 180,000 |
| 5 | Giant Garden | 750 | 58 | 1358 | 750 | 11 | 1380 | 210,000 |

Verification:
- Invariant: `base + pps * M >= peak` holds on every level.
- Ratio check: Level 5 `maxScore` (1380) / Level 1 `maxScore` (680) = $2.03 \le 3$ (Decision 3 holds).
- Minimum duration: `minDurationMs = 4000` ms on all levels.

## Models and Asset Pipeline

Models referenced from `ready/menu1-bee-garden/`:
- `/models/3d/bee-garden/bee.glb`
- `/models/3d/bee-garden/beehive.glb`
- `/models/3d/bee-garden/flowerA.glb`
- `/models/3d/bee-garden/flowerB.glb`
- `/models/3d/bee-garden/flowerC.glb`
- `/models/3d/bee-garden/nectarOrb.glb`
- `/models/3d/bee-garden/bigLeaf.glb`
- `/models/3d/bee-garden/branchV2.glb` (skipped v1 `branch.glb`)
- `/models/3d/bee-garden/spiderWeb.glb`
- `/models/3d/bee-garden/vegetablePlanter.glb`
- `/models/3d/bee-garden/wateringCan.glb`
- Shared expansion: `EXPANSION_ASSETS.mushroom`, `EXPANSION_ASSETS.leafyTree`.

Until the GLBs are copied into `public/models/3d/bee-garden/` and listed in `core/modelManifest.ts`, deliberate 2-3 tone bevelled procedural fallbacks draw from `Primitives.tsx`.

## Registry Lines Claude Must Add

### 1. `play50games-frontend/src/arcade3d/types.ts`
Add `"bee-garden"` to `ARCADE_SLUGS`:
```ts
export const ARCADE_SLUGS = [
   // ...
   "bee-garden",
] as const;
```

### 2. `play50games-frontend/src/arcade3d/loaders.ts`
Add dynamic import entry:
```ts
"bee-garden": () => import("./games/bee-garden"),
```

### 3. `play50games-frontend/src/arcade3d/registry.ts`
Export meta from game:
```ts
import { beeGardenMeta } from "./games/bee-garden/meta";

export const ARCADE_GAMES: Record<ArcadeSlug, ArcadeGameMeta> = {
   // ...
   "bee-garden": beeGardenMeta,
};
```

### 4. `play50games-backend/play50games/includes/arcade-games.json`
Add game definition:
```json
"bee-garden": {
   "slug": "bee-garden",
   "title": "Bee Garden",
   "enabled": false,
   "kind": "points",
   "scoring": {
      "kind": "points",
      "maxScore": 680,
      "minDurationMs": 4000,
      "maxDurationMs": 120000,
      "base": 245,
      "maxPointsPerSec": 31,
      "unitLabel": "pts",
      "display": "int"
   },
   "levels": [
      { "id": 1, "title": "Flower Garden", "scoring": { "kind": "points", "maxScore": 680, "minDurationMs": 4000, "maxDurationMs": 120000, "base": 245, "maxPointsPerSec": 31, "unitLabel": "pts", "display": "int" } },
      { "id": 2, "title": "Vegetable Garden", "scoring": { "kind": "points", "maxScore": 890, "minDurationMs": 4000, "maxDurationMs": 150000, "base": 375, "maxPointsPerSec": 22, "unitLabel": "pts", "display": "int" } },
      { "id": 3, "title": "Greenhouse", "scoring": { "kind": "points", "maxScore": 1100, "minDurationMs": 4000, "maxDurationMs": 180000, "base": 490, "maxPointsPerSec": 19, "unitLabel": "pts", "display": "int" } },
      { "id": 4, "title": "Forest Flowers", "scoring": { "kind": "points", "maxScore": 1180, "minDurationMs": 4000, "maxDurationMs": 180000, "base": 620, "maxPointsPerSec": 13, "unitLabel": "pts", "display": "int" } },
      { "id": 5, "title": "Giant Garden", "scoring": { "kind": "points", "maxScore": 1380, "minDurationMs": 4000, "maxDurationMs": 210000, "base": 750, "maxPointsPerSec": 11, "unitLabel": "pts", "display": "int" } }
   ]
}
```
