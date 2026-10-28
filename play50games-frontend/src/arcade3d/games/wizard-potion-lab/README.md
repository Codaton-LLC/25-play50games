# Wizard Potion Lab

Owner: cursor. Slug: `wizard-potion-lab`. Order 38. Status `dev`. Collection `skill`. Points. Difficulty 2. One round lab, five level configs.

## Rules

The cauldron is the origin. You start just outside it, at `(0, POT_STAND)`. Shelves stand on a ring at `radius − 1.2`, one per ingredient type the recipes use. Types, in order: mushroom, crystal, berry, flower, herb, bottle. A recipe is a seeded list of `steps` types with no two identical types in a row. Level 5 (`dual`) keeps two recipes open; the others open the next list only when the current one is finished. The cauldron accepts the carried item only when it is the head of an open list.

On-foot mover: radius 0.36, top speed 4.4, accel 22, brake 28. `inputToWorld` uses the fitted camera yaw, so keyboard and touch share the same step. `actionPressed` within 1.2 m picks up the nearest shelf item, or adds what you carry when you are at the cauldron. The same press puts the item back when you are closer to that ingredient than to the cauldron. You carry one. A wrong add stuns for 0.60 s and sends the item home. From level 2 it also spends a life (`loseLife`). Level 1 has no lives. From level 3 one ingredient slides on a 3 m sine path (`WANDER_LEN`, period 3.6 s) and the pickup follows that point. The path stays inside the lab and outside the cauldron.

Score, all integers: +300 per finished recipe, +80 more when that recipe took no wrong add, and on a win only +4 per full second left (`4 * floor(timeLeftMs / 1000)`). A wrong add never scores. Objective ceiling `Bobj = 380 * recipes`. The shell clock ends the run. A partial score ranks; only a win clears the level (no `clearScore`).

## Levels

Same lab. Counts, the clock and the core lighting preset change. Fog is `[background, radius * 1.7, radius * 4.4]`.

| L | Title | Radius | Recipes | Steps | Dual | Wander | Lives | Clock | Light |
|---|---|---:|---:|---:|---|---|---:|---:|---|
| 1 | Beginner Lab | 7 | 2 | 2 | | | | 120 s | indoor `#1e1b4b` |
| 2 | Mushroom Lab | 8 | 3 | 3 | | | 3 | 150 s | indoor `#1e1b4b` |
| 3 | Crystal Lab | 9 | 4 | 4 | | yes | 3 | 180 s | night `#172554` |
| 4 | Forest Lab | 10 | 5 | 5 | | yes | 3 | 180 s | sunset `#3b0764` |
| 5 | Master Wizard Lab | 11 | 6 | 5 | yes | yes | 3 | 210 s | night `#1e1b4b` |

## Controls

WASD / arrows move. E or Enter uses. Touch: joystick, Action "Use". Scheme `joystick`. No jump. Camera views: 📷 button (touch) or **C** cycles default → chase → front → top → free (`core/camera`); the movement follows the view on screen (`cam.yaw()` into the rules). The same 1.2 m use range and 0.60 s stun run on both devices (`rules.test.ts`). The shell owns pause and the Score / Time chips. Lives appear from level 2. Custom HUD (`data-arcade-safe-area`) shows up to two rows of remaining steps as circle, square, triangle, diamond, star, drop, plus what you carry. `resultDelayMs` 900.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000` (level 1 cannot `end("lose")`; its earliest end is a win or the clock). `unitLabel: "pts"`, `display: "int"`.

The sketch used an earliest win M and `peak = Bobj + 4 * (durationS − M)`, with level 1 at M = 28 s and pps 16. The oracle wins level 1 in 8.93 s (score 1204), so that line is short. pps follows the measured win with about a second of room. Level 5 `maxScore` 2760 is under `3 * 1260`.

`base + pps * seconds` at the measured earliest win:

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 760 | 8.93 s | 1204 | 760 + 64 × 8.93 = 1332 | 1260 | 95.6% |
| 2 | 1140 | 25.00 s | 1640 | 1140 + 28 × 25.00 = 1840 | 1710 | 95.9% |
| 3 | 1520 | 52.70 s | 2028 | 1520 + 12 × 52.70 = 2152 | 2110 | 96.1% |
| 4 | 1900 | 93.87 s | 2244 | 1900 + 8 × 93.87 = 2651 | 2350 | 95.5% |
| 5 | 2280 | 121.95 s | 2632 | 2280 + 8 × 121.95 = 3256 | 2760 | 95.4% |

A hypothetical level 1 clear at 7.5 s scores 1208, and `760 + 64 * 7.5 = 1240` still accepts it. The oracle did not beat 8.9 s in 16 runs.

Proof (`rules.test.ts`, through `createArcadeStore` + `advanceRunClock` + `withinServerLimits`): per level, 8 seeds at 30 Hz and 60 Hz for an oracle, a human-paced bot (stick 0.9, Use after 0.16 s), an idle bot and a spam bot, plus one oracle at 144 Hz. Idle scores 0 and does not win. Every bot stays inside the limits and `capScore` is a no-op. Oracle wins: 16/16 on every level. Every winning best is at least 90% of that level's `maxScore`. Layout: 200 seeds × 5 levels, deterministic, every step is on a shelf, no two identical types in a row. Wander samples stay inside the lab and outside the cauldron, and the path is 3 m end to end.

## Look

One palette in `looks.ts`. Floor `#312e81`, shelves `#44403c`, cauldron glow `#a78bfa`, accent `#c4b5fd`. Lighting and background come from the level. The apron plane uses the level background so the framed square has no void past the round floor. Camera: follow, pitch 52°, yaws `[0, π/2]`, fov 46, `followFocus` fraction 0.42, `shift: true`. The look point stays near the cauldron.

The wizard is a `HumanoidModel` stand-in (`WizardFigure`, 1.70 m, robe / hat / beard) until `charWizard.glb` is measured. Adding to the pot aims the right arm (`aimArm` side −1). Cheer on a win. `startLoop("bubbling")` while the scene is mounted. The cauldron is `EXPANSION_ASSETS.cauldron`; a disc at its inner floor takes the colour of the last accepted ingredient. The mushroom is `EXPANSION_ASSETS.mushroom`. Other props are local urls and draw bevelled fallbacks. Candles and floor runes scale with `useQuality().decor`. Walls and runes are unit boxes scaled by the spot.

## Known issues

- `charWizard` has no measured landmarks and `scale` 1. The gait uses a fixed 0.68 m stride. Claude's assets PR measures the GLB, sets landmarks and the scale that keeps 1.70 m, and checks the drawn height. The wizard is untinted.
- Every url under `/models/3d/wizard-potion-lab/` is unlisted, so those fallbacks draw. The cauldron and the mushroom are the live meshes.
- `wizard-potion-lab/hero.glb` is not used. `shared/gardenMushroom.glb` replaces the expansion mushroom when that PR lands. The shelf source is `shared/bookshelf.glb`.
- The camera frames the whole lab, so the wizard reads smaller on level 5 than on level 1.
- No thumbnail yet: `meta.thumbnail` is `null`.

## What Claude registers

The slug is already on main. Status stays `dev`. Do not enable the game. Copy the five limits into `arcade-games.json` (level 1 is the top-level scoring) and copy the GLBs named in `assets.spec.json` into `public/models/3d/wizard-potion-lab/` plus the manifest lines. Leave `hero.glb`. Then fit scales. The cauldron and the current mushroom are already shared; do not copy a second cauldron.

```json
"wizard-potion-lab": {
  "title": "Wizard Potion Lab",
  "kind": "points",
  "max_score": 1260,
  "min_duration_ms": 4000,
  "max_duration_ms": 120000,
  "base": 760,
  "max_pps": 64,
  "enabled": false,
  "levels": [
    { "title": "Beginner Lab", "max_score": 1260, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 760, "max_pps": 64 },
    { "title": "Mushroom Lab", "max_score": 1710, "min_duration_ms": 4000, "max_duration_ms": 150000, "base": 1140, "max_pps": 28 },
    { "title": "Crystal Lab", "max_score": 2110, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1520, "max_pps": 12 },
    { "title": "Forest Lab", "max_score": 2350, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1900, "max_pps": 8 },
    { "title": "Master Wizard Lab", "max_score": 2760, "min_duration_ms": 4000, "max_duration_ms": 210000, "base": 2280, "max_pps": 8 }
  ]
}
```
