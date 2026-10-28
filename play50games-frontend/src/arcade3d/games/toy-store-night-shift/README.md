# Toy Store Night Shift

Owner: kimi. Slug: `toy-store-night-shift`. Order 48. Status `dev`. Collection `skill`. Points. Difficulty 2. One store, five level configs. Spec: `docs/menu1-new/specs-41-50.md` §48. Built on `claude/game-toy-store-night-shift`.

The plan's hero is a toy robot; `toyRobot.glb` is not a T-pose (arms hang down), so it cannot go through the auto-rig. The player is the night guard (`charNightGuard`, a clean T-pose) and the toy robots are the wind-up hazards, as the spec says. If the user wants the robot as the hero, that needs a T-pose regeneration.

## Rules

The store is `aisles` rows of 4 m shelves (solid boxes, 0.8 m deep, 1.6 m high). A row's shelves stand 1.4 m apart; rows are 3.6 m apart, so every aisle is 2.8 m wide and every gap 1.4 m (`rules.test.ts` checks both, and the clearance to the walls, on 200 seeds). The shelves go to the rows in turn. One shelf per toy kind, two from level 3 (either is right). The guard starts in the front left corner.

Toys: `toys` of them on the floor, kinds mixed (kind = index mod `categories`, shuffled), at least 1.5 m apart, never inside a shelf, 2.5 m from the start. A flood fill proves every toy can be picked up and every shelf front reached; `createRun` retries the seed's layout until it does.

On-foot mover: radius 0.38, top speed 4.4, x 0.9 while carrying, accel 22, brake 28.

**Use** (E / Enter / touch "Use", `actionPressed`, one press per action):

- a toy on the floor within 1.2 m: pick it up (one at a time; two, stacked, from level 4);
- a shelf within 1.2 m (distance to its box) while carrying: drop the TOP toy on the nearest shelf. Its kind matches: the toy stays on the shelf for good, +80, and +20 more if no wrong drop happened since the previous right one. It does not match: the toy falls back to the floor 0.55 m off the shelf's face, 0.50 s stun (no move, no Use), and the clean bonus is gone until the next right drop.
- with a toy and a shelf both in reach: a matching shelf takes the drop, a wrong shelf never steals the pick-up (only with nothing to pick up, or full hands, does a wrong shelf take the drop). With two carried, the lower toy cannot be delivered before the top one: a wrong top toy blocks the one under it.

Wind-ups (`windups`, from level 2): toy robots and toy cars on `stepPatrol` loops round the rows (8 waypoints, corners cut, 1.8 m from the row's centre line, the middle of an aisle) at `windupSpeed`; the row is `index mod aisles`, odd ones run the other way, and none starts within 6 m of the guard. A touch (centres within 0.95 m) outside the 0.80 s mercy drops every carried toy on the floor where he stands. No lives, no points lost; the toys are only back on the floor.

Score, all integers: +80 per right drop, +20 clean, and on a win +4 per full second left. A toy pays once. `Bobj = 100 x toys`.

**End.** Win: every toy on a shelf. No lose. Timeup is the shell's. Only a win clears the level (no `clearScore`).

Keyboard and touch run the same `step()`: the same stun, mercy and reach on both devices.

## Levels

| L | Title | Aisles | Kinds | Shelves | Toys | Carry | Wind-ups | Speed | Clock | Light |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Toy Shelf | 2 | 3 | 3 | 5 | 1 | 0 | - | 120 s | indoor `#fce7f3` |
| 2 | Store Floor | 3 | 4 | 4 | 8 | 1 | 1 | 1.4 | 150 s | indoor `#fbcfe8` |
| 3 | Warehouse | 4 | 5 | 10 | 10 | 1 | 2 | 1.6 | 180 s | night `#1e293b` |
| 4 | Mega Toy Store | 4 | 6 | 12 | 14 | 2 | 3 | 1.8 | 180 s | indoor `#f9a8d4` |
| 5 | Toy Chaos | 5 | 7 | 14 | 18 | 2 | 4 | 2.0 | 210 s | night `#0f172a` |

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000`. A win at time `t` scores `Bobj + 4 (dur - t)` and the server accepts `base + pps x t`, so `pps >= 4 (dur - t) / t` at the fastest possible win. The sketch assumed a first win at 30 s on level 1; the honest oracle wins level 1 in 5.85 s (the whole store is 5 toys within a few metres of each other). So the limits are re-derived from the measured earliest win `e` (the lowest over the builder's 100-seed run and the gate's 200-seed run per level, the oracle at 30, 60 and 144 Hz; it carries pairs on levels 4-5; the gate's 200 seeds lowered L2 and L5, so their pps and maxScore went up), with `t = 0.85 e` as the allowance for a faster pilot, `pps = ceil(4 (dur - t) / t)` and `maxScore = Bobj + 4 (dur - t)` plus about 3%:

| L | Bobj | earliest win e | t = 0.85 e | base + pps x e | pps | maxScore | best oracle | best / max | maxDurationMs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 500 | 5.85 s | 4.97 s | 500 + 93 x 5.85 = 1044 | 93 | 990 | 956 | 96.6% | 120000 |
| 2 | 800 | 11.60 s | 9.86 s | 800 + 57 x 11.60 = 1461 | 57 | 1405 | 1352 | 96.2% | 150000 |
| 3 | 1000 | 16.53 s | 14.05 s | 1000 + 48 x 16.53 = 1793 | 48 | 1715 | 1652 | 96.3% | 180000 |
| 4 | 1400 | 21.61 s | 18.37 s | 1400 + 36 x 21.61 = 2178 | 36 | 2110 | 2032 | 96.3% | 180000 |
| 5 | 1800 | 31.37 s | 26.66 s | 1800 + 28 x 31.37 = 2678 | 28 | 2610 | 2512 | 96.2% | 210000 |

Level 5 `maxScore` 2610 is under `3 x 990` (2.64x). The score without a win never passes `Bobj`, which `base` already covers. The oracle won 100/100 seeds on every level; the human-paced bot (stick 0.9, 0.15 s before each Use, one toy at a time) wins at least 99% of 100 seeds on every level (`levels.test.ts`).

Proof (`proof.level-N.test.ts`, one level per file so they run in parallel; `testing/proof.ts`, bots in `testing/bot.ts`, all through `createArcadeStore` + `advanceRunClock`): per level the proof's arithmetic (`PROOF_EARLIEST_WIN_S` = 0.85 e), 200 oracle seeds and 200 human-paced seeds at 30 / 60 / 144 Hz (each inside the limits, `capScore` a no-op, no win before 0.85 e, at least 99 % wins; measured 200/200 on every level), best oracle at least 90 % of `maxScore`, idle on 200 seeds through the rules and 10 through the store (never wins, scores 0), 40 spam seeds inside the limits. Mutation probes on every level read in `rules.ts`, `index.tsx` and `meta.ts` (18) all fail the tests.

## Look

One palette (`COLORS`) in `looks.ts`: floor `#e2e8f0` tiles, shelf trims `#f472b6` / `#60a5fa`, accent `#f472b6`. Lighting and background come from the level (core presets + fog). Camera: follow, pitch 58 deg, yaws `[0, pi/2]`, fov 48, `shift: true`; the fit keeps a 12 x 7 m window round the aim on screen, and the aim follows the guard (0.6 m ahead, clamped only 1 m inside the walls), so he stays near the middle of the free area, clear of the kinds panel and the controls, at the start and at every wall (`framing.test.ts` projects him at 390 x 844 and 1280 x 800 from every standable spot); past the walls the view shows a dark ground that reaches past the fog (a 390 x 844 phone turns to yaw pi/2 and sits about 21 m away), so a big store scrolls under the camera and the floor outside it never shows a void. Fog starts at 60 m, past every fitted camera plus the window (`looks.test.ts`). The +x wall, on the portrait camera's side, is a 0.7 m counter so it never hides the guard; the back and left walls are 2.6 m.

Shelf signs lie flat on the shelf top, so they read from either camera yaw: a coloured plate with a white frame shape and the toy's silhouette (`glyphs.ts`: circle bears, square cars, triangle planes, diamond balls, hexagon blocks, star trains, pentagon robots). Colour alone fails at night, so the shape and the picture carry the kind. Plates are unlit (`MeshBasicMaterial`), so they read in the dark levels too. The carried toy's plate floats over the guard's head and faces the camera. The HUD (`data-arcade-safe-area`) lists the kinds of the level with the same chip and how many are left; the stat chips are Shelved and Carrying.

The shelves are painted cream (a material override: the GLB's olive texture read as a flat monotone) with a coloured trim band and kick plate per row (pink, blue, yellow, mint, lilac). On the night levels a dim warm fill light walks with the guard so he keeps his colours. Shelved toys sit on the shelf top beside the sign (four slots a shelf, a second row behind them). Models: the guard (`charNightGuard`, 1.80 m, auto-rig with committed `GUARD_LANDMARKS`, `carryPose` on the arms while carrying, `cheerPose` on a win, a `Flashlight` with `light={false}` on his feet: the lit floor sector, no spot light), the shelf (`toyShelfSolidT`, 4 x 1.6 x 0.8 m), seven toy kinds (one `DynamicInstancedModel` pool per kind, the blocks are `toyBlocksPlainT`), the wind-ups (`toyRobot` with a `waddle`, `toyCar` with a `hop`), bins and the shared crate as decor on a display strip behind the back wall (never walkable, so they never meet the guard). Every GLB has a bevelled 2-3 tone stand-in (`Primitives.tsx`). About 30 draw calls by count (cap 60); not measured on a device. Juice: sparkle + score popup on a right drop, puff + shake on a wrong drop, splash + shake on a wind-up hit, `playSfx` on each.

## Controls

WASD / arrows move, E or Enter uses. Touch: joystick and Action "Use". Scheme `joystick`. `touchControls: ["joystick", "action"]`, no jump. 📷 or C cycles the camera views (classic / chase / front / top / free); drag the canvas to look around. A `TargetMarkers` arrow points to the shelf for the carried toy, else to the nearest toy on the floor.

## Known issues

- `toyShelf.glb` has small toys baked onto its shelves and `toyShelfEmpty.glb` is a paper-thin panel, so the shelf is `toyShelfSolidT.glb` (an open frame) squashed to 1.6 m: it reads as a toy-shop unit, but its cubbies are shallower than the real thing. A better empty shelf would let the toys stand inside it.
- The honest bots do not dodge wind-ups; a touch only costs the carried toys, so the proof stays valid.
- A toy that is dropped wrong lies 0.55 m off the shelf face, which can be inside the next aisle's wind-up loop. It is a floor toy like any other.
- No thumbnail yet: `meta.thumbnail` is `null` until `/images/3d/toy-store-night-shift.webp` lands.
