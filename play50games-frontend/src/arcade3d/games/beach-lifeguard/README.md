# Beach Lifeguard

Owner: antigravity. Slug: `beach-lifeguard`. Order 34. Status `dev`. Collection `adventure`. Points. Difficulty 2. One beach environment, five level configurations. Spec: `.handoff/P-136-lifeguard/spec.md`.

## Rules

Start at the lifeguard tower at `(0, 8)`. Alerts pop in the water zone (`z < 0`); sprint down the sand, wade into the water, reach the active swimmer in trouble, press Grab (E / Enter / touch "Grab") within 1.2 m, and escort them back to safe dry sand (`z ≥ 2`).

- **Beach boundaries:** sand depth 14 m (`z` from 0 to 14), water depth `level.water` (`z` from 0 to `-level.water`), width `level.width`. Shoreline is at `z = 0`.
- **Mover physics:** on-foot mover, radius 0.38, top speed 5.0 m/s on sand, speed factor × 0.62 in water (`z < 0`). Moving across `z = 0` integrates piecewise so water speed is exactly 0.62 m/s ratio for every instant in water.
- **Carrying:** carrying a swimmer reduces speed by × 0.85 (carrying on sand is 4.25 m/s, carrying in water is 2.635 m/s). Float is carried on `handR`.
- **Jet Ski:** available on Levels 4 and 5. Overlap within 1.2 m plus Grab action mounts it; speed becomes 8.5 m/s, clamped to `z ≤ 0`. Touching sand (`z ≥ 0`) automatically dismounts and resets the jet ski to its dock.
- **Alerts & Lives:** `level.alertS` seconds per alert. If an alert expires: loses 1 life (`loseLife()`), swimmer and float reset, next alert begins. 3 expired alerts lose the run (`lives = 3`).
- **Scoring:** +180 base points when reaching safe sand (`z ≥ 2`), +70 bonus if alert clock was still above half (`alertTime > alertS / 2`), and on win +5 per full second left on the shell clock (`Math.floor(timeLeftMs / 1000) * 5`). Exactly `level.rescues` alerts to win, no extras.

## Levels

One continuous beach environment. Only dimensions, swimmer count, alert timers, jet ski availability, lighting and fog change:

| L | Title | Width | Water | Rescues | Alert Timer | Jet Ski | Duration | Lighting | Background | Fog Far |
|---|---|---:|---:|---:|---:|---|---:|---|---|---:|
| 1 | Small Beach | 24 m | 12 m | 2 | 40 s | No | 120 s | day | `#7dd3fc` | 80 |
| 2 | Busy Beach | 32 m | 16 m | 3 | 34 s | No | 150 s | day | `#38bdf8` | 80 |
| 3 | Resort | 40 m | 18 m | 4 | 30 s | No | 180 s | day | `#0ea5e9` | 70 |
| 4 | Waterpark | 44 m | 20 m | 5 | 28 s | Yes | 180 s | sunset | `#fb923c` | 55 |
| 5 | Stormy Beach | 48 m | 22 m | 6 | 24 s | Yes | 210 s | sunset | `#44403c` | 42 |

## Controls

- Keyboard: WASD / arrows to move, E or Enter to grab.
- Touch: joystick to move, Action "Grab". `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Grab" }`. Scheme `joystick`. No jump.
- Same timing windows and physical constants for keyboard and touch: radius 0.38, top speed 5.0, water factor 0.62, carry factor 0.85, grab range 1.20 m.
- Custom HUD: Alert percentage meter with dynamic warning color (pink `#fb7185` → amber `#f59e0b` → red `#ef4444`) and carrying indicator. Stat chips: Saved (0..rescues), Alert (0..100).

## Server limits

`base = Bobj = 250 * rescues`. Speed bonus on win: +5 / second left. `minDurationMs = 4000`.

| L | Title | Bobj | M | peak | base | pps | maxScore | maxDurationMs |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| 1 | Small Beach | 500 | 25 | 975 | 500 | 21 | 1020 | 120000 |
| 2 | Busy Beach | 750 | 40 | 1300 | 750 | 16 | 1360 | 150000 |
| 3 | Resort | 1000 | 55 | 1625 | 1000 | 14 | 1690 | 180000 |
| 4 | Waterpark | 1250 | 70 | 1800 | 1250 | 10 | 1880 | 180000 |
| 5 | Stormy Beach | 1500 | 90 | 2100 | 1500 | 9 | 2190 | 210000 |

`2190 / 1020 = 2.147 ≤ 3`.

Proof (`rules.test.ts` and `levels.test.ts`):
- Honest bot, idle bot, spam bot, and oracle bot stay within limits across all 5 levels.
- Grab range verified at 1.20 m (success) and 1.21 m (failure).
- Water speed factor is verified to be exactly 0.62 in pure sand, pure water, and crossing `z = 0` in both directions.
- Expired alert loses a life and does not score.
- Jet ski cannot mount on L1 (`jetSki: false`) and mounts on L4 (`jetSki: true`).
- Corridors from every swimmer to `(x, 2)` and to the tower at `(0, 8)` are proven free of prop AABBs across multiple seeds.

## Look

- Color palette in `looks.ts`: Sand `#f2d7a6`, wet sand `#e7c98a`, water shallow `#38bdf8`, water deep `#0284c7`, accent `#fb7185`.
- Environment: Day presets on L1–L3, Sunset on L4, Stormy Sunset with close fog on L5.
- Water rendered with core `<Water>` shader component.
- Camera: Follow camera, pitch 50°, fov 48, bounds the beach rect, `shift: true`. Screen-edge directional arrows via `<TargetMarkers>`.
- Stand-in fallbacks: deliberate, bevelled, 2–3 tone fallbacks in `Primitives.tsx`.

## Known issues

- Hyper3D GLBs generated in `menu1-beach-lifeguard/` are referenced by URL (`/models/3d/beach-lifeguard/<id>.glb`) in `assets.ts` and `assets.spec.json`, unlisted in `modelManifest.ts` so custom fallbacks draw until Claude copies them.
- `charLifeguard` character stand-in is drawn until landmarks are measured for core `HumanoidModel`.
- Buoy file has no GLB on disk; code alert torus (`#fb7185` / `#f8fafc`) draws around the active swimmer.
- Thumbnail is `null` until the game thumbnail is captured.

## What Claude registers

1. `src/arcade3d/types.ts`: already contains `"beach-lifeguard"`.
2. `src/arcade3d/registry.ts`: already imports `beachLifeguardMeta`.
3. `src/arcade3d/loaders.ts`: already registers dynamic import for `"beach-lifeguard"`.
4. `play50games-backend/play50games/includes/arcade-games.json`:
   Add or verify the 5 level limits:

```json
"beach-lifeguard": {
  "title": "Beach Lifeguard",
  "kind": "points",
  "max_score": 1020,
  "min_duration_ms": 4000,
  "max_duration_ms": 120000,
  "base": 500,
  "max_pps": 21,
  "enabled": false,
  "levels": [
    { "title": "Small Beach", "max_score": 1020, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 500, "max_pps": 21 },
    { "title": "Busy Beach", "max_score": 1360, "min_duration_ms": 4000, "max_duration_ms": 150000, "base": 750, "max_pps": 16 },
    { "title": "Resort", "max_score": 1690, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1000, "max_pps": 14 },
    { "title": "Waterpark", "max_score": 1880, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1250, "max_pps": 10 },
    { "title": "Stormy Beach", "max_score": 2190, "min_duration_ms": 4000, "max_duration_ms": 210000, "base": 1500, "max_pps": 9 }
  ]
}
```
