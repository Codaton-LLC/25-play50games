# Haunted Mansion Keys

Owner: antigravity. Slug: `haunted-mansion-keys`. Order 39. Status `dev`. Collection `adventure`. Time game. Difficulty 2. Five level configs. Spec: `.handoff/P-137-haunted/spec.md`.

## Rules

Search a dark mansion room by room for coloured keys, open the matching doors, pull wall levers when available to open shortcuts, avoid patrolling suits of armour, and escape through the exit door as fast as you can.

The mansion is a grid of `cols × rows` rooms, each 6 m wide by 5 m deep. Seeded growth guarantees every room is connected and attached to a reachable room from the entrance at `(0, 0)`. The exit door is the final lock, leading into the far room `(cols - 1, rows - 1)`.

On-foot mover: radius 0.36, top speed 4.4, accel 22, brake 28. `inputToWorld` uses the fitted camera yaw, ensuring keyboard and touch share the exact same movement feel.

Interactions:
- Holding E, Enter or touch Use within 1.2 m of a key, locked door, or lever starts a 0.20 s windup.
- Releasing the button or stepping out of range resets the windup.
- Once 0.20 s completes:
  - An uncollected key is added to the inventory ring.
  - A locked door matching a held key unlocks and opens permanently.
  - A lever toggles and opens its shortcut door.

Armour (Levels 4 and 5):
- One `armourStand` agent patrols the main corridor using `stepPatrol` at `armourSpeed`.
- Touching the armour outside an 0.80 s mercy window costs one life (`loseLife()`) and returns the detective to the entrance of the current room.
- Keys already held stay held.
- Running out of lives on L4–L5 ends the run with `"lose"` (unranked).

End condition:
- Win: the exit door is unlocked and the detective enters the exit room (`end("win")`).
- Score is derived from the shell time formula: `max(0, floor((timeBaseMs - durationMs) / 10))`.
- L1–L3 have no lives; failure only occurs on clock expiration (`timeup`, unranked).

## Levels

| L | Title | Grid | Rooms | Keys | Lever | Armour | Armour Speed | Clock / TimeBase | Lives | Lighting | Background | Fog Far |
|---|---|---:|---:|---:|:---:|:---:|---:|---:|:---:|---|---|---:|
| 1 | Entrance Hall | 3 × 1 | 3 | 2 | No | No | 0.0 | 180 s | — | indoor | `#44403c` | 40 m |
| 2 | Library | 3 × 2 | 6 | 3 | No | No | 0.0 | 210 s | — | indoor | `#3f3f46` | 36 m |
| 3 | Bedrooms | 4 × 2 | 8 | 3 | Yes | No | 0.0 | 240 s | — | night | `#1c1917` | 30 m |
| 4 | Basement | 5 × 2 | 10 | 4 | Yes | Yes | 1.6 | 240 s | 3 | night | `#0c0a09` | 22 m |
| 5 | Grand Mansion Escape | 4 × 3 | 12 | 5 | Yes | Yes | 1.9 | 300 s | 3 | night | `#0c0a09` | 24 m |

## Controls

WASD / arrow keys move. Hold E or Enter to use. Touch: joystick, Action "Use". Scheme `joystick`. No jump. The windup is 0.20 s on both devices (`rules.test.ts`). Custom HUD draws the Key Ring showing shapes currently held (`data-arcade-safe-area`). The shell displays clock, keys stat chip, and lives (L4–L5). `resultDelayMs` 900.

## Server limits & Scoring Proof

Time game. `base = 0`, `maxPointsPerSec = 0`, `unitLabel: "time"`, `display: "time"`. `timeBaseMs = durationMs = maxDurationMs`. Score formula: `floor((timeBaseMs - durationMs) / 10)`.

| L | Title | timeBaseMs | minDurationMs | maxScore | Measured Oracle Win | Measured Oracle Score |
|---|---|---:|---:|---:|---:|---:|
| 1 | Entrance Hall | 180,000 | 2,000 | 17,800 | 2,733 ms | 17,726 |
| 2 | Library | 210,000 | 2,500 | 20,750 | 4,200 ms | 20,580 |
| 3 | Bedrooms | 240,000 | 4,000 | 23,600 | 6,966 ms | 23,303 |
| 4 | Basement | 240,000 | 5,000 | 23,500 | 7,983 ms | 23,201 |
| 5 | Grand Mansion Escape | 300,000 | 5,000 | 29,500 | 7,133 ms | 29,286 |

3× Check: `maxScore[5] / maxScore[1] = 29,500 / 17,800 = 1.657 ≤ 3.0`.

Proof (`rules.test.ts`):
- 200 seeds tested (40 seeds × 5 levels): deterministic generation, flood fill reaches the exit with the lever unused, every key is reachable before its door opens, no duplicate shapes per level.
- Timing windows: exactly 0.20 s windup on keyboard and touch, canceling on premature release.
- Armour mechanics: damages hero only when armour is active, respects 0.80 s mercy window, teleports hero to room entrance, preserves held keys.
- Bots: honest human-paced bot, idle bot, spam bot and oracle bot tested across all levels at 30 Hz and 60 Hz. Idle bot scores 0. Oracle bot wins 8/8 across all levels and stays inside server limits.

## Look

One palette in `looks.ts`. Walls `#292524`, floor `#1c1917`, moonlight accent `#c4b5fd`. Camera: follow, pitch 58°, fov 48, `followFocus` fraction 0.55, `shift: true`, look-ahead 1.0 m.

Fallback primitives:
- Detective figure (`DetectiveFigure`, 1.80 m, trench coat, fedora, skin tone).
- Keys: 5 distinct shape plaques (circle, square, triangle, diamond, star) in 5 high-contrast tints.
- Bevelled 2–3 tone fallbacks for doors, wall levers, armour stands, grandfather clocks, paintings, chairs, tables, and bookshelves.

## What Claude registers

1. `src/arcade3d/types.ts` — `"haunted-mansion-keys"` in `ARCADE_SLUGS`.
2. `src/arcade3d/registry.ts` — `import { hauntedMansionKeysMeta } from "./games/haunted-mansion-keys/meta"` in `ARCADE_GAMES`.
3. `src/arcade3d/loaders.ts` — `"haunted-mansion-keys": () => import("./games/haunted-mansion-keys")`.
4. `play50games-backend/play50games/includes/arcade-games.json`:

```json
"haunted-mansion-keys": {
  "title": "Haunted Mansion Keys",
  "kind": "time",
  "max_score": 17800,
  "min_duration_ms": 2000,
  "max_duration_ms": 180000,
  "base": 0,
  "max_pps": 0,
  "time_base_ms": 180000,
  "enabled": false,
  "levels": [
    { "title": "Entrance Hall", "max_score": 17800, "min_duration_ms": 2000, "max_duration_ms": 180000, "base": 0, "max_pps": 0, "time_base_ms": 180000 },
    { "title": "Library", "max_score": 20750, "min_duration_ms": 2500, "max_duration_ms": 210000, "base": 0, "max_pps": 0, "time_base_ms": 210000 },
    { "title": "Bedrooms", "max_score": 23600, "min_duration_ms": 4000, "max_duration_ms": 240000, "base": 0, "max_pps": 0, "time_base_ms": 240000 },
    { "title": "Basement", "max_score": 23500, "min_duration_ms": 5000, "max_duration_ms": 240000, "base": 0, "max_pps": 0, "time_base_ms": 240000 },
    { "title": "Grand Mansion Escape", "max_score": 29500, "min_duration_ms": 5000, "max_duration_ms": 300000, "base": 0, "max_pps": 0, "time_base_ms": 300000 }
  ]
}
```
