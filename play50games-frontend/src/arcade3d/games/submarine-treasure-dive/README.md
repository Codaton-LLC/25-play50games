# Submarine Treasure Dive

Owner: cursor. Slug: `submarine-treasure-dive`. Order 42. Status `dev`. Collection `adventure`. Points. Difficulty 2. One reef, five level configs. Spec: `.handoff/C-42-submarine-treasure-dive/spec.md`.

## Rules

The sub starts on the dock at cruise height 3.0 m, facing +z. Flight is on XZ: `inputToWorld(moveX, moveY, yaw)`, accel 9, top speed 5.5, exponential drag 0.9 (terminal speed before the cap is 10). Radius 0.9. Hold Dive to sink to 0.8 m in 0.60 s; release to rise in 0.60 s. The same window is used for keyboard and touch.

A treasure collects only while the center is strictly below 1.2 m and within 1.4 m on XZ. Treasures do not respawn. Rocks, coral (radius 1.0), anchors and wrecks are solid at every height. Arches are solid only while low (`y <= 1.5`), so the sub flies over them at cruise. Low is also the double-drain band, which is separate from the scoop.

Battery starts at 100. It drains `drain` per second at cruise and twice that while low. At 0 the run ends `lose`. From level 3, a jellyfish overlap outside the 0.80 s mercy costs 8 battery and pushes the sub 1.5 m back along its velocity. A new solid contact faster than 3 m/s costs 4 battery. Either hit clears the clean flag for the next pickup. From level 4 a current of `(current, 0)` m/s² is added on world x.

Score, all integers: +150 per treasure, +50 more when nothing has bumped or stung since the previous pickup (the run starts clean), and on a win only +5 per full second left. Objective ceiling `Bobj = 200 * treasures`. Win: every treasure taken and the sub center inside the dock pad (radius 2, any height) with battery still above 0. Timeup is the shell clock. No lives. A partial score ranks.

## Levels

Same reef, centered on the origin. The dock is south. Counts, drain, clock, current and the core lighting preset change. Fog is always `["#0e7490", 8, fogFar]`.

| L | Title | Size | Treasures | Rocks | Coral | Jellies | Speed | Current | Drain /s | Clock | Light |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | Shallow Reef | 30×26 | 3 | 4 | 4 | 0 | — | 0 | 0.55 | 120 s | day |
| 2 | Coral Reef | 36×30 | 4 | 6 | 8 | 0 | — | 0 | 0.55 | 150 s | day |
| 3 | Sunken Ship | 40×34 | 5 | 6 | 8 | 3 | 1.2 | 0 | 0.50 | 180 s | sunset |
| 4 | Deep Cave | 44×36 | 6 | 8 | 10 | 4 | 1.4 | 0.5 | 0.45 | 180 s | night |
| 5 | Ancient Ruins | 48×40 | 8 | 10 | 12 | 6 | 1.6 | 0.6 | 0.45 | 240 s | night |

Level 4 drain is 0.38 and level 5 0.36 (the spec says 0.6). Gate review: at 0.45 the paced pilot lost 4% of level 4 and 9% of level 5 seeds to a flat battery. Drain is the tuning knob: at 0.6 two fair seeds finished under 15% battery (9.4 and 14.6). At 0.45 every winning oracle, including 144 Hz, keeps at least 15%.

## Controls

WASD / arrows steer. Hold E or Enter to dive. Touch: joystick and Action "Dive". Scheme `flight`. Sink, rise, mercy and the bump window do not change with the device. The shell owns pause. `clockChip` stays on (score and time). Custom HUD is a battery meter only (`data-arcade-safe-area`). Stat chips: Treasure, Battery 0–100. `resultDelayMs` 900. No lives.

## Server limits

`base = Bobj`. `maxDurationMs` is the level clock. `minDurationMs = 4000`. `unitLabel: "pts"`, `display: "int"`.

The sketch's pps assumed a finish around its minute mark M. The time bonus pays more for a faster finish, and a fair route on these floors ends well before M, so `base + sketchPps * seconds` is under the real score. Level 1 at 16.90 s scores 1065; `600 + 15 * 16.90 = 853` does not cover it. pps is raised on every level. `maxScore` sits just above the measured best so the best is still at least 90% of the cap, and level 5 (2780) stays under `3 * 1180`.

`base + pps * seconds` at the measured best oracle (seeds 1–4 at 30 Hz and 60 Hz, plus seed 2 at 144 Hz):

| L | Bobj | Measured win | Score | base + pps × seconds | maxScore | Best / max |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 600 | 16.90 s | 1065 | 600 + 42 × 16.90 = 1310 | 1180 | 90.3% |
| 2 | 800 | 23.37 s | 1380 | 800 + 40 × 23.37 = 1735 | 1520 | 90.8% |
| 3 | 1000 | 29.17 s | 1700 | 1000 + 38 × 29.17 = 2108 | 1880 | 90.4% |
| 4 | 1200 | 34.87 s | 1775 | 1200 + 32 × 34.87 = 2316 | 1960 | 90.6% |
| 5 | 1600 | 45.85 s | 2520 | 1600 + 32 × 45.85 = 3067 | 2780 | 90.6% |

A fully clean level 1 at the same 16.90 s would score 1115 (the measured run missed one +50). That still fits 1180, and `600 + 42 * 16.90` accepts it. The sketch cap of 1100 would not.

Proof (`rules.test.ts`, through `createArcadeStore` + `advanceRunClock` + `withinServerLimits`): per level, 4 seeds at 30 Hz and 60 Hz for an oracle, a human-paced bot (stick 0.9, dive starts after 0.18 s) and a spam bot, plus one idle run and one oracle at 144 Hz. Idle scores 0 and does not win. Oracle wins 8/8 on every level with at least 15% battery left, including the 144 Hz run. Every best is at least 90% of that level's `maxScore` and never over it. Layout: 200 seeds × 5 levels, deterministic, treasures at least 6 m apart and 1.5 m clear of every solid, exact rock, coral and jelly counts.

Also covered: no pickup at 1.2 m, pickup below it scores 200, arches block only while low, drain is exactly twice while low, sink and rise match at 30 Hz and 60 Hz, a jelly costs 8 once per mercy and pushes back, a solid hit over 3 m/s costs 4 and one under it does not, the dock does not win before the quota, the level 4 current matches `(current / 0.9) * (1 - e^(-0.9))`, and both yaws go through `inputToWorld` to the same pose.

## Look

One palette in `looks.ts`. Sand `#e7c98a`, water fog `#0e7490`, accent `#22d3ee`. Lighting is the level preset (`day`, `sunset`, `night`). Night adds an emissive cone headlight, not a spot light. Camera: chase, pitch 55°, fov 46, look-ahead 2.5 m along velocity, `followFocus` over the floor, `shift: true`. The camera does not dip with the sub. A `BlobShadow` on the sand reads the height. The floor plane is padded 48 m past the reef so the frame has no void. Decor stays under the cruise height so it does not cover the sub.

The sub is a bevelled two-tone stand-in with a spinning prop until Claude fits `miniSubmarine.glb`. Sonar is a code torus that expands from the sub every 2 s. `<TargetMarkers>` points at the nearest treasure, then the dock. Fish schools and the current motes are visual only. Columns lie on their side. Fallback geometry is unit-sized and scaled once by the spot.

## Known issues

- Every url under `/models/3d/submarine-treasure-dive/` is unlisted, so the fallbacks draw. Chest, coin, rock and the second fish school are shared meshes that already load.
- The sub has no humanoid landmarks. Claude adds that GLB at the gate. This game's hero is the mini sub, not a person.
- `pearlShell.glb`, the upright hulls, and the broken coral / seaweed shards are not referenced. The wreck id is `shipwreckSidewaysT`. If that mesh still reads wrong, the bevelled box is the hull.
- Fog hides the far reef. The marker is the guide.
- No thumbnail yet: `meta.thumbnail` is `null`.
- Draw calls were not measured in a browser. The scene targets about 35 and stays under 55 by instancing each pool.

## Status

Playable in rules and in the scene with fallbacks. Status stays `dev`. Do not enable the game. Claude copies the GLBs, sets the manifest lines, and copies these limits into `arcade-games.json`.
