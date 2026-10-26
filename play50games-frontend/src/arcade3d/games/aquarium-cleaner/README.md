# Aquarium Cleaner

Owner: kimi. Slug: `aquarium-cleaner`. Order 49. Status `dev`. Collection `adventure`. Points. Difficulty 2. One tank, five level configs. Spec: `docs/menu1-new/specs-41-50.md` §49. Built on `claude/game-aquarium-cleaner`.

## Rules

A diver walks the floor of a giant aquarium in lead boots. The tank is `width x depth` with glass on the back and both sides; the front is open to the camera. The diver starts at the entry (front left), where the trash basket also stands. The bubble column is front centre and the exit hatch front right.

On-foot mover: radius 0.38, top speed 3.0, accel and brake 12 (water drag). Solids (the castle, rocks and filter machines) are circles; the diver slides round them.

Tasks, `tasks = algae + trash + filters` (3, 4, 5, 6, 8):

- **Algae** (on the glass): hold Work (E / Enter / touch "Work") for 1.00 s within 1.2 m of the patch. A high patch (2 m up, L2+) scrubs only while the diver's feet are above 1.0 m: the hold waits while he is too low (it keeps its time while Work stays held) and the Float arc (`jumpPressed`, 0.9 s, peak 1.8 m, about 0.56 s above 1.0 m) is how he gets up, so a high patch takes two floats.
- **Filters** (machines on the floor): hold Work for 1.50 s within 1.2 m of the machine.
- **Trash**: collected on overlap (up to three carried), emptied by walking into the basket (radius 0.9). Each binned item is one task.
- Releasing Work or leaving the 1.2 m range resets the hold. A hold stays on its target until it ends or breaks.
- **Air** 100, drains `airDrain` per second (x1.5 while working, including while a high patch waits for a float). The bubble column (radius 1.2) refills 25 per second instead of draining. Air 0: one life lost (3 lives), the diver respawns at the entry with full air, carried trash drops where he was. Lives 0 ends the run.
- **Sharks** (L3+): `stepPatrol` along a closed loop of eight waypoints (the rectangle 3.4 m in from the glass, corners cut), speed `sharkSpeed`. A hit (centres within 1.0 m) outside the 0.80 s mercy costs 30 air and pushes the diver 1.5 m. The loop leaves a 2 m lane along the glass (the layout tests check it) and every solid stays 1.2 m + its radius off the loop.
- **Current** (L5): 0.5 m/s² in world x. The mover is velocity-targeted, so the current is its settled drift: +0.5 m/s in x for a diver who does not steer. (A literal added acceleration would be frame-rate dependent and under 1 cm per second against the 12 m/s² brake.)
- **Win**: every task done and the diver on the hatch (radius 1.0). The hatch glows green when the list is done. **Timeup** is the shell's.

Score, all integers: +120 per task, +30 more if the air at that moment is above 50, and on a win +4 per full second left. Each task pays once. `Bobj = 150 x tasks`.

A level is cleared only by a win (no `clearScore`: with the +30 air bonus, `120 x tasks` was reached before the list was done, e.g. 5 of 6 tasks on L4).

Keyboard and touch run the same `step()`: only the stick axes, `action` and `jumpPressed` matter, for the same 1.00 s, 1.50 s and 0.9 s on both devices (`rules.test.ts`).

## Levels

| L | Title | Tank | Algae (high) | Trash | Filters | Tasks | Drain /s | Sharks | Current | Clock | Light |
|---|---|---|---|---:|---:|---:|---:|---|---|---:|---|
| 1 | Small Tank | 16 x 12 | 1 (0) | 1 | 1 | 3 | 1.2 | - | no | 120 s | day `#5eead4` |
| 2 | Tropical Tank | 20 x 14 | 2 (1) | 1 | 1 | 4 | 1.3 | - | no | 150 s | day `#2dd4bf` |
| 3 | Shark Tunnel | 24 x 14 | 2 (1) | 2 | 1 | 5 | 1.4 | 1 at 1.6 | no | 180 s | indoor `#115e59` |
| 4 | Giant Aquarium | 26 x 18 | 2 (1) | 2 | 2 | 6 | 1.5 | 1 at 1.9 | no | 180 s | day `#0d9488` |
| 5 | Deep Sea Exhibit | 30 x 20 | 3 (2) | 3 | 2 | 8 | 1.5 | 2 at 2.0 | yes | 210 s | night `#042f2e` |

Fog is `[background, 42, 120]`: it starts past the whole camera window on a 390 × 844 phone, a 1280 × 800 desktop and an 844 × 390 landscape phone (`look.test.ts`). The layout is seeded (`createRun(seed, level)`): the castle, rocks, filters, patches and trash are placed by rejection sampling and a flood fill proves every patch (a stand point within 1.0 m), filter, item, the basket, the column and the hatch reachable from the entry. 200 seeds x 5 levels in `rules.test.ts`.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000`. A win at time `t` scores `Bobj + 4 (dur - t)` and the server accepts `base + pps x t`, so `pps >= 4 (dur - t) / t` at the fastest possible win. The sketch assumed a win no earlier than 30 s on level 1; the honest oracle wins level 1 in 10.2 s. So the limits are re-derived from the measured earliest win `e` (200 seeds, oracle at 30, 60 and 144 Hz), with `t = 0.85 e` as the allowance for a faster pilot, `pps = ceil(4 (dur - t) / t)` and `maxScore` = `Bobj + 4 (dur - t)` plus about 3%:

| L | Bobj | earliest win e | t = 0.85 e | base + pps x e | pps | maxScore | best oracle | best / max | maxDurationMs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 450 | 10.20 s | 8.67 s | 450 + 52 x 10.20 = 980 | 52 | 925 | 886 | 95.8% | 120000 |
| 2 | 600 | 15.98 s | 13.58 s | 600 + 41 x 15.98 = 1255 | 41 | 1180 | 1136 | 96.3% | 150000 |
| 3 | 750 | 17.27 s | 14.68 s | 750 + 46 x 17.27 = 1544 | 46 | 1450 | 1398 | 96.4% | 180000 |
| 4 | 900 | 23.95 s | 20.36 s | 900 + 32 x 23.95 = 1666 | 32 | 1580 | 1524 | 96.5% | 180000 |
| 5 | 1200 | 32.20 s | 27.37 s | 1200 + 27 x 32.20 = 2069 | 27 | 1990 | 1908 | 95.9% | 210000 |

Level 5 `maxScore` 1990 is under `3 x 925`. The score without a win never passes `Bobj`, which `base` already covers. A level with every task done but no stand on the hatch scores at most `Bobj` and clears.

Proof (`proof.level-N.test.ts`, one level per file, `testing/proof.ts`; bots in `testing/bot.ts`, all through `createArcadeStore` + `advanceRunClock`): the arithmetic above (every win at or after 0.85 e fits `base + pps x t` and `maxScore`, `maxScore` within 5 % of that peak); the honest (human-paced: stick 0.9, 0.18 s reactions) bot wins at least 99 % of 200 seeds at 30 / 60 / 144 Hz, inside the limits, `capScore` a no-op; the oracle inside the limits on 200 seeds, never faster than 0.85 e, best at least 90 % of `maxScore`; idle never wins and scores 0 (200 seeds through the rules, 10 through the store); spam inside the limits. Measured at the gate (2026-10-26, 200 seeds per bot and level): oracle 200/200 on every level, honest bot 200/200 on every level, best scores 886 / 1136 / 1398 / 1520 / 1908, earliest wins 10.18 / 15.98 / 17.40 / 24.07 / 32.27 s (`EARLIEST_WIN_MS` keeps the lower of two measurements). Both bots bend away from a shark within 3 m (a player sees it coming) and hold their work point against the L5 current; before those two fixes the honest bot lost 4 of 200 L5 seeds to bites and drift, never to the rules.

## Look

One palette (`COLORS`) in `looks.ts`: sand `#f5deb3`, glass edge `#99f6e4` as a thin emissive frame, algae `#4d7c0f` decals that fade as the hold fills, accent `#2dd4bf`. Lighting and background come from the level (core presets + fog). Camera: follow, pitch 50 deg, one yaw (0: the tank's open front always faces the camera; a portrait phone no longer turns it to look through the side glass), fov 48, an 8 × 11 m window round the diver (the portrait camera sits at about 25 m instead of 34 m), `shift: true`. The sand plane is 300 m bigger than the tank, so no screen edge shows void.

Models are Hyper3D GLBs through the core: the diver (`charDiver`, 1.78 m, auto-rig with committed `DIVER_LANDMARKS`, slow `walkPose` 0.4 with a stride from `gaitPhaseStep` at 0.6 x speed, spine pitched 10 deg, `jumpPose` on a float, an arm aimed at the patch while scrubbing, the scrubber in `handR` and the tank on the chest by `attach`), castle (2.5 m wide, y x0.8), rocks (instanced), filter machine V3 (1.3 m wide), trash basket, bottle pool, fish schools (decor, high in the back half), shark pool, coral (instanced decor on the back glass). The bubble column is code (a ring, a faint tube and 26 rising bubbles): the `bubbleStation` GLBs are glass domes and are not used. `coral`, `seaweed` and the V2 / V3 variants are broken shard meshes and are not used either. Every GLB has a bevelled 2-3 tone stand-in (`Primitives.tsx`). Decor is authored at the drawn size of spot scale 1 and scaled by the spot only; coral stays against the back glass and fish above 2.4 m behind the diver's half of the tank, so nothing sits between the camera and him. About 35 draw calls by count (cap 60); not measured on a device.

Juice: bubbles from the helmet every 1.5 s, sparkle + score popup per task, splash on a pick-up, shake on a shark bite and on running out of air, `playSfx` on each.

## Controls

WASD / arrows move, hold E or Enter to work, Space floats. Touch: joystick, Action "Work", Jump "Float". Scheme `joystick`. `touchControls: ["joystick", "action", "jump"]`. Game HUD: the task list with icons and ticks plus the air meter (`data-arcade-safe-area`). Stat chips: Tasks (done / total), Air 0-100. A `TargetMarkers` arrow points to the nearest open task, the basket when carrying, and the hatch when the list is done.

## Known issues

- The honest bots do not dodge sharks. A bite costs air only, so the proof stays valid; a player who dodges scores the same.
- The shark GLB shows an open toothy mouth (QA note in the ledger, "friendly-stylised" was asked for). Kept: the user decides whether to regenerate.
- `filterMachineV3` has no pipes into the sand; the status bead above it (amber, green when checked) carries the state.
- No glass shader: an emissive frame, a 12% pane and the fog tint. No swim pose in the core: the lead-boot walk, the float and the bubbles carry "underwater".
- No thumbnail yet: `meta.thumbnail` is `null` until `/images/3d/aquarium-cleaner.webp` lands.
