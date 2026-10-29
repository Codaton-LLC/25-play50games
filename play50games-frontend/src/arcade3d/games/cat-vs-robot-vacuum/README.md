# Cat vs Robot Vacuum

Game 36 · points · difficulty 1 · collection adventure · owner kimi (built by Claude Haiku, gated by Claude 2026-10-26). Spec: `docs/menu1-new/specs-31-40.md` §36. Status `dev`.

Walk the cat down one hall, collect every treat and curl up on the bed. Robot vacuums patrol a loop down the middle; from level 2 they chase what they can see. A hit costs a life and sends the cat back to the bed. Three lives. Only a win clears a level (no `clearScore`).

## Rules (rules.ts, pure and seeded)

- Hall along +z: x in ±2.4 (the walls hold the cat in: `clampToHall`), six-metre rooms. Furniture (bed in room 0, then sofa, bookshelf, table in turn) and clutter sit in the side bays, so the lane (|x| ≤ 1.0) is always open. Every treat, toy and the bed are reachable (flood fill, 200 seeds per level).
- Cat: radius 0.28, top speed 4.2, accel 22, brake 28; pickups at 0.5 m. Hop: `jumpPressed`, 0.45 s of i-frames, then a 0.3 s gap. Mercy 0.80 s after a hit. One set of constants for keyboard and touch.
- Treats ≥ 1.5 m apart, 30 points + 5 per streak step (a treat within 4.0 s of the last), streak bonus capped at +15. Toys 20, no streak. Win: every treat and the cat on the bed (1.0 m around its centre); +4 per full second left on the shell clock.
- Vacuums (gate rewrite, see "Gate changes"): each rides its own place on the closed lane loop at `patrolSpeed`, spawned spread over the loop at least 6 m (along it) from the start corner. A loop vacuum waits while another is less than 3 m ahead, so they never stack. From level 2, a patrolling vacuum that has rested 2.5 s since its last chase and sees the cat (within `chaseRange`, `hasLineOfSightXZ` past furniture and clutter, not in the first 3 s) chases at `chaseSpeed` for 4 s. Then it drives back to the nearest point of the loop at 1.3 × patrol speed, **harmless** (its glow strip is off), docks and rides the loop, and turns harmful again only once the cat is 1.0 m clear of it and it is spaced from the others. **A hop over a chasing vacuum shakes it off**: it goes back the same way.

## Gate changes (2026-10-26)

- The run never ended on 0 lives (the Scene never called `loseLife`), and the cat could walk out of the hall (no walls). `syncStore` (rules.ts) now writes score, lives, the win and the HUD stats (only on a change), and the walls are in the step.
- The vacuums were `stepPatrol` + `investigate`; after a chase every chaser returned to the same nearest point and two or three vacuums merged into one forever, and a returning vacuum crossing the lane could not be dodged fairly. Bots lost 90–100 % of runs on levels 3–5. Replaced by the loop riders above (deterministic, tested).
- The home pad was drawn at x = 0, not at the bed. The camera fitted the whole hall (a 36 m hall made the cat a dot); it now follows the cat with a 6 × 9 m window, yaw 0 only (a turned camera looked across the hall, where wall-side furniture can hide the cat).
- Furniture boxes re-sized to the fitted GLBs (bed 1.2 × 0.6 × 1.9, table 0.88 × 0.72 × 1.8, shelf 0.37 × 1.15 × 1.4) and turned to face the lane; the clutter box is 0.335 tall (the cat box GLB at 0.5 m across).
- Limits re-derived (below); the helper's numbers were not proven.

## Levels

| L | Title | Rooms | Treats | Toys | Vacuums | Patrol / chase | Range | Clutter | Clock | Light | Limits (max / base / pps) | Careful bot clears | Oracle best |
|---|---|---:|---:|---:|---:|---|---:|---:|---:|---|---|---:|---:|
| 1 | Living Room | 2 | 8 | 1 | 1 | 1.4 / – | 0 | 0 | 90 s | day | 745 / 380 / 81 | 200 / 200 | 686 |
| 2 | Kitchen | 3 | 12 | 1 | 1 | 1.8 / 2.4 | 6 | 0 | 120 s | indoor | 1020 / 560 / 35 | 200 / 200 | 942 |
| 3 | Bedroom | 4 | 16 | 2 | 2 | 1.8 / 2.6 | 7 | 0 | 150 s | indoor | 1355 / 760 / 51 | 200 / 200 | 1250 |
| 4 | Kids Room | 5 | 20 | 2 | 2 | 2.1 / 3.0 | 8 | 4 | 150 s | day | 1520 / 940 / 34 | 200 / 200 | 1406 |
| 5 | Whole House | 6 | 25 | 3 | 3 | 2.2 / 3.0 | 8 | 6 | 180 s | night | 1875 / 1185 / 30 | ≥ 198 / 200 | 1715 |

All levels: `minDurationMs` 4000, `maxDurationMs` = the clock. L5 / L1 = 1875 / 745 = 2.5.

## Server limits and why they hold (one proof per level)

| Source | Value | Bound |
|---|---|---|
| Treat | 30 + min(15, 5 × (streak − 1)) | each treat once: ≤ 45 × treats |
| Toy | 20 | each once: 20 × toys |
| Win | 4 × floor(seconds left) | once |

`Bobj = 45 treats + 20 toys` = 380 / 560 / 760 / 940 / 1185 = `base`. A run that ends at t scores ≤ Bobj, or Bobj + 4 floor(D − t) on a win at t. With the earliest win M: `maxScore ≥ Bobj + 4 floor(D − M)` (+3 %, rounded up to 5) and `pps ≥ 4 (D / M − 1)`. M = 0.8 × the fastest win of the oracle and the careful bot over 200 seeds at 30 / 60 / 144 Hz: 4.3 / 12.73 / 11.23 / 16.32 / 21.97 s (`PROOF_EARLIEST_WIN_S`).

Tests (`proof.level-N.test.ts`, bots in `testing/bots.ts`, all through `createArcadeStore` + `simulateRun`, lives and clock the shell's): the proof's arithmetic; the careful bot (plans round every vacuum, flees chasers, hops head-on ones) clears ≥ 99 % of 200 seeds per level inside the limits and never wins before M; the oracle inside the limits, never before M, best ≥ 90 % of `maxScore`; idle never clears and scores 0; input spam inside the limits. Mutation probes on every level read in `rules.ts`, `index.tsx` and `meta.ts` fail the tests.

## Look and models

Adopted (copied into `public/models/3d`, listed in `modelManifest.ts`, fits in `assets.ts` from the measured bounds, checked on the real meshes in `assets.test.ts`):

- `cat-vs-robot-vacuum/`: `cat` (0.70 m nose to tail, faces +z, a creature: `<Model tint>` per level + `hop` / `waddle`, not the auto-rig), `robotVacuum` (0.72 m across, plus a code glow ring that pulses while chasing and is off while it returns), `catTreatFish` and `catToyPlush` (the regenerations the spec's still-needed list asked for, now in the ready folder, instead of the flagged `catTreat` / `catToy`), `catBox` (clutter), `catTreeR` (decor; not `catTree`).
- `shared/`: `bed`, `table`, `bookshelfFull` (the full-shelves regeneration, instead of `bookshelf`), `woodenChair` (decor); `sofa` was already shared.
- The house (`House.tsx`, after the first playtest): every room has its own floor, drawn once on a canvas and shared (light or warm wood planks, or kitchen tiles; neighbouring rooms always differ; the kitchen level starts on tiles), a patterned rug in the lane, and the hall's low walls (0.55 m, under the cat's sight line) carry a dark baseboard and a light cap. Outside the hall: a darker parquet to the fog and the outer house walls (1.4 m) on both sides and beyond the far end, never on the camera side. About ten draw calls for all of it.
- Decor (cat trees, chairs) is fitted to 1 m and placed by spot scale in the strip between the hall and the outer walls and beyond the far end wall, never on the camera side.
- Camera: the aim may come within 1.2 m of either end wall, so the cat starts near the middle of the picture (it sat at the top edge with the aim held 3.5 m in).

## Polish (2026-10-28, `claude/m1-animals`)

- The cat walks, trots and gallops on the core quadruped rig (`CAT_LANDMARKS` in `assets.ts`, checked on the real mesh in `cat.test.ts`): planted paws by speed, idle when still, a leap for the hop, and on a win it hops onto the bed and sits. Rodin's second tail (lying on the floor) is folded away.
- Readable colours: cool, quiet floors and walls (whitewashed and grey wood, pale tiles, a muted blue rug); the cat is the only warm orange (every level's tint is a ginger), the vacuums are dark graphite with a red glow ring and a red floor aura while they can hurt (both off while one drives back harmless), the treats gold with a pulsing gold disc, the toys a pink mouse with a pink disc, the bed's ring green and pulsing once every treat is in. A white ring and a contact shadow mark the cat; a cool rim light from the far end edges every object.
- The goal: a HUD pill ("Eat the gold fish, dodge red" -> "All fish! Nap on the bed"), an edge arrow to the nearest treat and then to the bed.
- Camera: a 5.3 x 7 m window (was 6 x 9), a closer start on a portrait phone, and the player zoom (wheel, pinch, + / -, `core/useCameraZoom`).

## Camera views (2026-10-28, `kimi/cam-views-cat-dog`)

Core camera views (`core/camera`, adoption in `Scene.tsx` / `Hud.tsx`): 📷 or **C** cycles Classic (the fitted follow camera) / Chase / Front / Top / Free; drag looks around; V recenters. The rules get the drawn camera's yaw (`cam.yaw()`), so WASD / the stick stay screen-relative in every view; bots and proofs are unchanged. Furniture, clutter and the house walls are camera solids; the top view is framed closer (12 m) for the narrow hall and stays inside the fog (22–60 m). On a win the cat turns to face the drawn camera (was the fitted south camera).

## Known issues

- No playtest yet (gate fork: no build or screenshots). To check: the cat and vacuum facing, the turned sofa / table / shelf facing the lane, the shelf squashed to 1.15 m (stretch 0.70), the bed narrowed to 1.2 m (stretch 0.76), draw calls (estimate ~30, cap 45).
- `catTreatFish` / `catToyPlush` / `bookshelfFull` are adopted from the ready folder without a written QA verdict in the spec.
