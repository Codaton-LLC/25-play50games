# Firefighter Rescue

Owner: cursor. Slug: `firefighter-rescue`. Order 31. Status `dev`. Collection `adventure` (proposal — the spec leaves the collection id to Claude; category in the master plan is Task). Points. Difficulty 2. One corridor, five level configs. Spec: `docs/menu1-new/specs-31-40.md` §31.

## Rules

Enter the floor at `(0, 0.85)`. Put every fire out and walk every neighbour into the exit, one at a time. The shell clock and three lives end the run. A partial score ranks; only a win clears the level (no `clearScore`).

Corridor hall is `x ∈ [−1.5, 1.5]`. Rooms alternate left and right, 6 m along z and 5 m deep, from z = 0. The porch starts at z = −3.4. Door openings are ±0.8 m around each room's middle. A locked door is a fire on the hall side of that doorway (`x = ±1.02`) plus a solid slab. The flood fill keeps the room shut until that fire is out. The exit rect is `x ∈ [−1.15, 1.15]`, `z ∈ [−2.9, −1.15]`. The escort stand is `(0, −2.7)`.

On-foot mover: radius 0.38, top speed 4.6, accel 22, brake 28. Inside a smoke disc the speed is × 0.65. `inputToWorld` uses the fitted camera yaw, so keyboard and touch share the same step.

Spray is a hold, not a tap. A fire completes after 0.75 s inside 1.3 m. Releasing the button or leaving range resets the hold. A hold already on a fire stays on that fire until it completes or cancels. Talking to a neighbour is the same hold shortened to 0.30 s, and only when that neighbour is the nearest target inside 1.3 m. A second talk does nothing while someone is already following.

Breath starts at 1. It drains `breathDrain` per second inside a smoke disc and refills 0.25/s outside. At 0 the run loses a life, the active follower snaps home, their clean flag dies, and breath returns to 1. Other neighbours are left alone.

Follow uses `arrive` at 3.2 m/s with a preferred gap of 1.1 m. If the follower's real speed stays under 0.15 m/s for 1.2 s while more than 2 m from the firefighter, they are placed on the nearest free point of the segment, preferring the firefighter's end (the sofa-gap case).

Debris is a box on a 4 s path with a 0.6 s pause at each end (cycle 9.2 s, x from −1.05 to 1.05). A swept hit outside the hop spends a life and stuns for 0.50 s. During the 0.40 s hop the box deals no damage. Nothing respawns; debris keeps cycling.

Score, all integers: +100 per fire, +150 when a neighbour enters the exit, +50 more if that neighbour's clean flag never died, and on a win only +6 per full second left (`6 * floor(timeLeftMs / 1000)`). Objective ceiling `Bobj = 100 * fires + 200 * civilians`.

## Levels

Same corridor. Only counts, breath drain, clock and the core lighting preset change. Fog is `[background, 14, 36]`.

| L | Title | Rooms | Fires | People | Smoke | Locked | Debris | Drain /s | Clock | Light |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Small Apartment | 2 | 2 | 1 | 1 | 0 | 0 | 0.15 | 120 s | indoor `#292524` |
| 2 | Family House | 3 | 4 | 2 | 2 | 1 | 0 | 0.18 | 150 s | day `#44403c` |
| 3 | Office | 4 | 6 | 3 | 3 | 1 | 0 | 0.22 | 180 s | indoor `#1c1917` |
| 4 | Hotel | 5 | 8 | 4 | 4 | 2 | 1 | 0.28 | 180 s | night `#0c0a09` |
| 5 | Warehouse | 6 | 10 | 5 | 5 | 2 | 2 | 0.32 | 210 s | sunset `#291c14` |

## Controls

WASD / arrows move. Hold E or Enter to spray. Space hops. Touch: joystick, Action "Spray", Jump "Hop". Scheme `joystick`. The same 0.75 s spray, 0.30 s talk, 0.40 s hop and 0.50 s debris stun run on both devices (`rules.test.ts`). The shell owns pause. `clockChip` stays on. Custom HUD is a breath meter only (`data-arcade-safe-area`). Stat chips: Fires, Saved, Breath 0–100. `resultDelayMs` 900.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000` (a life can end early; the pps line still rejects a full clear that fast). `unitLabel: "pts"`, `display: "int"`.

The sketch assumed an earliest win M and `peak = Bobj + 6 * (durationS − M)`, with level 1 pps 60 at M = 12 s. The oracle wins level 1 in 8.4 s, so `400 + 60 * 8.4 = 904` is under the real score 1066. pps on level 1 is **96**. The other four levels still match the sketch: the measured win is at or after the sketch M, so the sketch pps already covers the score. Level 5 `maxScore` 3050 is under 3300 and under `3 * 1100`.

`base + pps * seconds` at the measured earliest win:

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 400 | 8.40 s | 1066 | 400 + 96 × 8.40 = 1206 | 1100 | 96.9% |
| 2 | 800 | 21.78 s | 1568 | 800 + 40 × 21.78 = 1671 | 1650 | 95.0% |
| 3 | 1200 | 38.97 s | 2046 | 1200 + 32 × 38.97 = 2447 | 2200 | 93.0% |
| 4 | 1600 | 57.67 s | 2332 | 1600 + 24 × 57.67 = 2984 | 2550 | 91.5% |
| 5 | 2000 | 80.43 s | 2774 | 2000 + 20 × 80.43 = 3609 | 3050 | 91.0% |

The score is `Bobj + 6 * floor(timeLeft)`. Level 1's 8.40 s leaves 111 full seconds (`666 + 400 = 1066`). A hypothetical 7.5 s clear would score 1072, and `400 + 96 * 7.5 = 1120` still accepts it. The oracle did not beat 8.3 s in 24 runs.

Proof (`rules.test.ts`, through `createArcadeStore` + `advanceRunClock` + `withinServerLimits`): per level, 12 seeds at 30 Hz and 60 Hz for an oracle, a human-paced bot (stick 0.9, spray starts after 0.18 s), an idle bot and a spam bot, plus one oracle at 144 Hz. Idle scores 0 and does not win. Spam stays inside the limits. Oracle wins: 24/24, 24/24, 24/24, 24/24, 23/24. Every winning best is at least 90% of that level's `maxScore`. Layout: 40 seeds × 5 levels, deterministic and reachable, including a locked door that opens only after its fire is marked out.

## Look

One palette in `looks.ts`. Walls `#44403c`, floor `#292524`, ember `#f97316` on the active fire only. Lighting and background come from the level. Camera: follow, pitch 52°, yaws `[0, π/2]`, fov 48, `followFocus` fraction 0.45, `shift: true`, look-ahead 1.5 m.

Models (2026-10-28, `claude/firefighter-models`): every visible object is a Hyper3D GLB, fitted in `assets.ts` from its measured bounds (`assets.test.ts` checks each fit and triangle count on the real mesh).

- **Firefighter**: `charFirefighter.glb` (menu1 set, 18k tris), auto-rigged with the measured `FIREFIGHTER_LANDMARKS`, drawn 1.82 m (`firefighter.test.ts`). `poses.ts`: walk and run from core `walkPose`, the phase stepped by `gaitPhaseStep` (the walk's own stride, planted feet); the right hand always carries the extinguisher (forearm forward at the waist, the canister hanging from its handle on `handR`), a spray raises it to the chest with a water jet (`fx` splash) and steam on the fire; while a neighbour follows, the left arm reaches back to guide them; a hop tucks; a win cheers with confetti. Never a T-pose. The older `firefighter-rescue/hero.glb` is not used.
- **Outside the porch**: the fire truck (5.2 m, parked across the street), two hydrants and the hose reel, all past the porch, never on the floor (`looks.ts` `TRUCK_SPOT`, `HYDRANT_SPOTS`, `HOSE_REEL_SPOT`).
- **Exit signs** (`exitSignV2`, an arrow sign; `exitSign` has a letter-like glyph and is not used): one under a lintel over the porch mouth, one flush on each porch wall over the exit zone, all above 1.7 m.
- **Fire doors**: each room has a double fire door (`fireDoor.glb`, two 0.8 x 2.1 m leaves in the hall wall). A locked room's leaves stay shut while its doorway fire burns, then swing 90° into the room; unlocked rooms start open (`doorLeaf` in `looks.ts`).
- **Debris**: each hazard is a pile of two crossed charred planks (`fallingDebris.glb`, 0.68 m) inside the rules' box; it tumbles while it slides and shudders during the end warnings.
- **Furniture**: the shared sofa, bed, cabinet and wooden chair fill their `FURN_SIZE` boxes (one `InstancedModel` per kind), turned to face into their rooms.
- **Neighbours**: the shared `civilianNpc` (1.62 m) in one `DynamicInstancedModel` pool of 5 with a waddle. It is not a T-pose (hands on hips), so it cannot be auto-rigged.

- **Cutaway walls**: from the fitted yaw, every wall with play floor right behind it is drawn 1.0 m tall instead of 2.25 m (`cutawayWalls` in `looks.ts`), and the door leaves, plaques, signs and the porch lintel in such a wall follow it, so no wall or door hides the firefighter, a fire or a neighbour (`looks.test.ts` traces the sightlines on every level and both yaws). Before this the near hall wall hid the firefighter on desktop.

Draw calls stay far under 150 (22 on level 1 to 27 on level 5, measured with `?perf=1`; one per GLB pool). The brightness fill (extra hemisphere and ambient light) and the phone framing are unchanged. Decor plaques scale with `useQuality().decor`.

## Known issues

- The neighbours are static figures (the shared `civilianNpc` has its hands on its hips, not a T-pose): they waddle while they follow, their legs do not walk. A T-pose civilian GLB would let the auto-rig walk them.
- The camera frames the whole building. On the warehouse the firefighter reads smaller than on level 1.
- Spray is not a simulated hose. Smoke is a disc plus `fx.smoke`; the jet is `fx` splash puffs.
- One of 24 warehouse oracle seeds still walks into debris and loses. The limit uses the winning runs. A player who clips a parked pile spends a life; the hop is the dodge.

## What Claude registers

Steps 1–4 are done (`claude/menu1-scaffold`, 2026-10-25: slug in `ARCADE_SLUGS`, registry, loader, the five limits in `arcade-games.json`, casts removed). Step 5 is open. Do not enable the game. Status stays `dev`, `enabled: false`.

1. `src/arcade3d/types.ts` — add `"firefighter-rescue"` to `ARCADE_SLUGS` (after `rocket-landing`). Drop the `as ArcadeSlug` casts in `meta.ts` and `index.tsx`.
2. `src/arcade3d/registry.ts` — `import { firefighterRescueMeta } from "./games/firefighter-rescue/meta"` and append it to `ARCADE_GAMES`.
3. `src/arcade3d/loaders.ts` — `"firefighter-rescue": () => import("./games/firefighter-rescue")`.
4. `play50games-backend/play50games/includes/arcade-games.json` — copy the five limits. Level 1 is the top-level scoring. `enabled: false`.

```json
"firefighter-rescue": {
  "title": "Firefighter Rescue",
  "kind": "points",
  "max_score": 1100,
  "min_duration_ms": 4000,
  "max_duration_ms": 120000,
  "base": 400,
  "max_pps": 96,
  "enabled": false,
  "levels": [
    { "title": "Small Apartment", "max_score": 1100, "min_duration_ms": 4000, "max_duration_ms": 120000, "base": 400, "max_pps": 96 },
    { "title": "Family House", "max_score": 1650, "min_duration_ms": 4000, "max_duration_ms": 150000, "base": 800, "max_pps": 40 },
    { "title": "Office", "max_score": 2200, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1200, "max_pps": 32 },
    { "title": "Hotel", "max_score": 2550, "min_duration_ms": 4000, "max_duration_ms": 180000, "base": 1600, "max_pps": 24 },
    { "title": "Warehouse", "max_score": 3050, "min_duration_ms": 4000, "max_duration_ms": 210000, "base": 2000, "max_pps": 20 }
  ]
}
```

5. Done (2026-10-28): the GLBs in `assets.spec.json` are in `public/models/3d/firefighter-rescue/` (plus the shared `cabinet.glb`) and in `core/modelManifest.ts`, fitted and tested. `hero.glb` and `exitSign.glb` are left out.
