# Ring Jump Challenge (Menu 2, game 27, World 2 "Sky & Sea")

The design card is `docs/menu2-super/world-2-sky-and-sea.md` #27 (branch `claude/m2-super-plan`):
**DIVE and thread**. Leap off a stone column and steer a long free-fall down a sea canyon through
rings; thread each ring for points and speed, hit its centre for double, tuck into a Dive to beat the
clock, and land on the target pad. The downward verb is World 2's own (Sky Tower goes up by bouncing,
Cloud Hopper across by gliding).

Status `dev` (preview builds only), owner Claude, order 56, collection `rollheroes`, a **points** game.

## Files

| File | What |
|---|---|
| `levels.ts` | the five level rows (drop, shaft radius, run clock cap, par time, boss) |
| `canyon.ts` | pure course builder: rings (static, sliding, orbiting, speed, gold, bonus, the closing trio), orbs (main and hero-gated), updraft geysers, blade gates, wall pockets (open niche, Riko's seal, Vexa's ghost panel), Kiro's storm pockets, ledges (Nami's nooks, geyser shelves), level 4's slots, the pad and the pool, level 5's storm eye, decor spots |
| `rules.ts` | the pure, deterministic run (1 ms steps), scoring, the boss fight, the limits proof |
| `progression.ts` | combo config, star specs, secrets per level, Cyclone Ray's `BossConfig` |
| `heroes.ts` | the five heroes, their power tuning, the shared hero pick (Nami preselected) |
| `bot.ts` | the honest bot (tests, proofs, `?autoplay=1` on preview builds) |
| `camera.ts` | orbit tuning (steep, looking down the shaft), the speed FOV, the intro shots |
| `Scene.tsx` / `MultiScene.tsx` | solo and 2-4 player scenes |
| `World.tsx` | sky, the canyon wall (one mesh with holes for the pockets), pocket backs, rim, monuments, sea, pad, pool buoys, the Tide Bell |
| `Course.tsx` | rings, gold ring, orbs, glows, the depth guide, geysers, ledges, blades, storms, panels, secret pickups, wake rings, lightning lanes |
| `Boss.tsx` | Cyclone Ray drawn from the rules' pure `rayPose` |
| `Hero.tsx` | the shared Menu 2 animator in free-fall (`writeHeroMotion`, tested) |
| `Hud.tsx`, `MultiplayerHud.tsx`, `StarResult.tsx`, `levelEnd.ts` | HUD, multiplayer UI, star screen, progress |

## Rules (rules.ts)

- **The column.** The run starts on the start column at the +z rim. Jump (or a push of the stick)
  leaps: up 6 m/s and 7 m/s towards the shaft, the stick locked for 450 ms. With no input it leaps by
  itself after 2.6 s.
- **The fall.** Spread: 18 m/s, steering 9 m/s on the plane. Hold Dive (Jump): the hero tucks into the
  armoured ball, 40 m/s, steering 4.5 m/s. Gravity 32 m/s² towards a faster fall, drag 30 m/s² back to a
  slower one. The stick is camera-relative (`StepInput.yaw`, core `inputToWorld`).
- **Rings.** Crossing a ring's plane with the hero's centre inside the opening threads it: 100 points,
  200 in the inner 30 % (a centre thread), +2 m/s of fall (a speed ring +6), the extra capped at +10 and
  wearing off at 3 m/s². Passing within 5 m of a main ring's rim without threading it is a **miss**: the
  flow breaks and the Perfect Streak badge is gone, unless the ring is threaded after all (Nami's flip).
- **Moving rings** (level 2, 5) slide or orbit at 2-4 m/s; the closing trio of level 1 shrinks shut
  4.3 / 4.6 / 4.9 s after the hero passes the top of its gap (a spread fall is too slow: hold Dive).
- **Updrafts** hold the fall to 6 m/s (10 diving). **Storm pockets** blow anyone but a shielded Kiro out.
  **Blade gates** (level 4, 5) knock the hero (a hit: the flow breaks, 0.7 s grace).
- **Walls.** The shaft is a cylinder (narrower in level 4's slots). Pockets open behind it: an open niche
  (the gold ring), a cracked seal (only Riko's dash breaks it), a ghost panel (only Vexa's phase passes);
  once inside a pocket the hero stays in it until its foot slides him back into the shaft. Ledges push
  the hero inward.
- **Landing.** The target pad (500, its bull's-eye 1000 and a sticker), the marked pool (300). Anywhere
  else is a splash: 1.2 s in the sea, then a new drop 70 m up, 7 m beside the pad (it always needs
  steering back). A landing adds the speed bonus: 20 points per second under the level's par time.
- **Flow** (menu2/combo): each ring and orb is one link (bases 60 / 20), 2.5 s window, +0.25 a link, x3.
- **The run clock cap** (90-220 s) ends the run `timeup` (points kept, no clear).

## Hero roles (all five matter on every level)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | air dash 8 m in 0.25 s (3 s) | cracked seals over the side shafts (3 orbs each; level 4's seal shard) |
| **Nami** (lead, preselected) | air-brake flip: the fall stops, she hops 3 m back up (2.5 s) | the orb under each wall ledge; re-threading a ring she just missed (the miss is forgiven) |
| Kiro | shield 3 s (9 s) | storm pockets (3 orbs each); blade gates and Cyclone Ray's lightning can't touch him |
| Zuno | magnet 3 s, 7 m reach (8 s) | the orbs hidden in the canyon wall (only glints until the magnet is up) |
| Vexa | phase 1.5 s (6 s) | ghost panels into the inner shaft with bonus rings (and the sticker on levels 2 and 5) |

Every level has one of each (`rules.test.ts` "every hero has a route of its own"). Any hero can land
every level; the routes are extra points, never a block. Co-op: shield, magnet and phase cover the team.

## Levels

| # | Name | Drop | What it adds |
|---|---|---|---|
| 1 | Wide Rings | 330 m | teaches in 3 beats: a column of big rings straight below; offset rings with orb lines to steer along; a gap with orbs straight down, then a trio that closes unless you Dive, over a wide pad |
| 2 | Moving Rings | 420 m | rings slide side to side, orbit the axis, then pairs that slide and orbit round offset centres: aim where they will be |
| 3 | Updraft Rings | 520 m | the choice: a fast line of speed rings (+6 m/s each) or a slow wide line of three geysers with ring spirals and orbs |
| 4 | Fast Route | 600 m | the canyon pinches into three 8 m slots with spinning blade gates (the centre is clear: dive straight down), chambers of rings between |
| 5 | Perfect Streak | 900 m | everything combined, then **Cyclone Ray** in the storm eye, then the final 200 m drop onto its tail pad |

Each level has 1-3 secrets (`progression.ts` SECRETS): the gold ring in a wall niche seen through its
gap (every level), the bull's-eye sticker (levels 1, 3; level 5's tail-pad sticker), the inner-shaft
sticker (Vexa, levels 2 and 5), the seal shard (Riko, level 4).

## Boss: Cyclone Ray (level 5)

A storm manta under Tempest (`m2CycloneRayBoss`, its own image-to-3D GLB, 13 m across), a menu2/boss
`BossConfig` (10 HP, 3 phases). Entering the storm eye (280 m down) starts it; the eye then descends at
8 m/s and holds the hero within 12 m under its centre (18 m while diving) until phase 3.

1. **Spiral** (HP 10 to 5): it swims a spiral 22 m under the eye dropping wind rings (m2WindRing) every
   0.85 s. Thread 5 in a row (a miss resets the chain) to charge the dive strike, then while it is open
   it rises; Dive into its glowing back fin: 3 damage. Two strikes.
2. **Storm Wall** (HP 4 to 2): it circles wide and spits three lightning lanes through the axis,
   telegraphed for 1 s (faint violet), live for 0.9 s (white-hot): steer between them or air-brake;
   Kiro's shield and Vexa's phase pass. Then it banks open in the middle: Dive into it, 1 damage. Three rams.
3. **Final Drop** (HP 1): the eye opens; fall the last 200 m (rings and orbs) and land on its tail pad
   as it surfaces (it circles slowly, 3 m radius pad): the last hit, a slow-mo finish (visual only, a
   140 ms hit-stop), the Tide Bell rings on its column. Miss it and you splash and drop again.

Hits score 300 each, the defeat 1500, the tail pad's landing like the pad (bull's-eye 1000).

## Stars, flow, secrets

- Stars (menu2/stars): landed / every main orb / landed at or under par. Par (s): 16, 24, 46, 30, 85,
  a little over the honest bot's times (14.6, 22.6, 44.4, 27.2, 74.1 s). The card proposed 35/45/55/60/110 s:
  with the card's own speeds (18 / 40 m/s) every drop takes far less, so those targets would be free stars.
- The badge (no-hit) is the card's **Perfect Streak**: no ring missed in the whole level.
- Progress, XP, shards and stickers go through menu2/progress (`levelEnd.ts`).

## Scoring and server limits (why they hold)

A points game: the store's score is `run.score` (published every frame), the duration the run time.
For each level (`rules.ts` `proposeLimits`, pinned in `rules.test.ts`):

- **maxScore** = every ring as a centre thread (200) + every orb, gated ones included (50) +
  `comboMaxBonus` of the course (menu2/combo's proof bound: rings base 60, orbs base 20, x3) + the best
  landing (1000) + the speed bonus at the least finish + on level 5 every hit (6 x 300) and the defeat
  (1500). Every source is countable once per run; wake rings score nothing.
- **minDurationMs**: the vy clamp `vy >= -VMAX` (VMAX = 40 + 10 = 50 m/s) holds on every 1 ms step; the
  leap, a flip, an updraft, the eye, a boss bounce and a splash only slow the fall. So the pad (the highest
  landing, 8 m) is reached no sooner than `(drop - 8) / 50` s (less 2 ms). Level 5 lands only on the
  tail pad, i.e. after the Ray is down: the eye's entry `(280 m) / 50` plus `bossMinMs` (the machine
  stepped with every vulnerable window hit at once). The limit is that bound less about 4.5 %, rounded
  down to 100 ms (94-100 % of it).
- **maxDurationMs** = the run clock cap + 1 s (the shell's clock may count the rest of the frame the cap
  falls in).
- **base 0, maxPointsPerSec = ceil(maxScore / minDuration)**: every run is at most maxScore and lasts at
  least minDuration, so `score * 1000 <= rate * duration` always holds.

| Level | maxScore | minDurationMs | maxDurationMs | max_pps |
|---|---|---|---|---|
| 1 | 9421 | 6100 | 91000 | 1545 |
| 2 | 11935 | 7800 | 101000 | 1531 |
| 3 | 17755 | 9700 | 121000 | 1831 |
| 4 | 14353 | 11300 | 131000 | 1271 |
| 5 | 16228 | 33500 | 221000 | 485 |

`meta.scoring` / `meta.levels`, `arcade-games.json` (`enabled: false`) and the pinned test move together.

### What the bots reached (60 fps, Nami)

| Level | finish | score | rings (centres) / main | main orbs | misses |
|---|---|---|---|---|---|
| 1 | 14.6 s | 7078 | 13 (13) / 13 | 21/21 | 0 |
| 2 | 22.6 s | 7148 | 21 (11) / 22 | 10/11 | 1 |
| 3 | 44.4 s | 9702 | 26 (22) / 35 (the slow line) | 20/25 | 0 |
| 4 | 27.2 s | 11945 | 29 (28) / 29 | 17/17 | 0 |
| 5 | 74.1 s | 10897 | 19 (18) / 20 + the Ray | 16/17 | 1 |

Tests that hold the proof: the honest bot at 30/60/144 fps on every level (inside `withinServerLimits`,
never under the least finish), through the real store with ragged frames (levels 1 and 5), idle (the
clock cap ends it), 200 spam bots on level 1 and 40 on each level, every hero with its power mashed on
every level (Riko at 30/60/144 Hz), the vy clamp under 30 s of random input per level, and mutation
probes (a shorter drop, a longer par: the row no longer matches).

## Models (Hyper3D, ready set; measured in `assets.test.ts`)

`m2NeutralRing` (a flat ring: opening 0.6 GLB units, drawn 0.45 as flat, tinted per kind; gold through
the core `material: "gold"`), `m2ColumnPlatform` (start column, target pad: top platform radius 0.42),
`m2NeutralStar` (orbs), `m2SpringPad` (geysers), `m2SpeedBoost` (listed, not drawn yet: the speed rings
are orange rings), `m2StoneRingBg` (rim monuments), `m2SeaRock` (sea stacks; from plate-surf),
`spikedBall` (blade gates), `m2WindRing` (cloud-hopper's file; the wake rings), `checkpointBeacon`
(menu2's; the Tide Bell column), `m2CycloneRayBoss` (character budget). The heroes are the shared
menu2 GLBs. Code-built (allowed: terrain, water, sky, markers, moving parts): the canyon wall, pocket
backs, ledges, the sea, the blade arms, the bell, the guide rings, the storms, the lanes.

## Camera and controls

Orbit camera (menu2/camera): pitch 64°, 9 m, looking down the shaft, the pivot 2.2 m under the hero;
drag / two fingers turn it, wheel / pinch zoom, Q/Z C/X R/F V keys; auto-follow is gentle (0.5/s, from
5 m/s across). The FOV opens with the fall speed from 60° to 80° (72° to 92° portrait). Keyboard: WASD /
arrows steer, Space leaps and (held) dives, E / Enter power. Touch: joystick, Dive, Power.

## Multiplayer (M1, local 2-4)

Versus (the card's best mode): one shared canyon, the first to thread a ring takes its points, the most
points wins (landers tie on time; then points). Co-op: powers combine, the team clears when everyone has
landed. Shared camera looking down the shaft (pitch 63°, 8-14 m span, held on the lowest hero in versus, so it never leaves the shaft). Level 5: each hero fights its
own Ray in the rules; the scene draws player 1's.

## Playtests (headless Chrome over CDP, preview build on :3271)

Every level played by the bot at 1280 x 800 (levels 1-5 in one session through the level tiles),
level 1 at 390 x 844, 844 x 390 and 768 x 1024 with a two-finger orbit, level 1 by keyboard (Space leap,
Space held = 40 m/s dive and the FOV opening to 74°, Q turning the camera, E the power, a mouse drag
turning it), and a 2-player local run (keyboard 1 + 2). 0 console errors or warnings in every run.
Performance probe (`?perf=1`): at most 28 draw calls and 178k triangles (level 5 with Cyclone Ray),
26 calls / about 155k triangles elsewhere.

## Known issues / open

- m2NeutralRing has a glowing swirl membrane across its opening (the ready GLB): it reads as a portal you
  dive through; the rules treat the whole opening as open.
- m2SpeedBoost is listed and measured but not drawn yet (the speed rings are tinted orange rings).
- Cyclone Ray's facing was set from the mesh (narrow snout at +z); a closer look at its swim pose and the
  phase 3 surfacing is worth a check by eye in the browser.
- The card's 35-110 s star times were replaced by par times from the honest bot (see Stars).
- Multiplayer: level 5 runs one Ray per hero in the rules but draws player 1's; the lobby/podium flow
  was only smoke-tested headless (join, ready, dive), not a full race to the podium.
- No thumbnail yet (`thumbnail: null`, like cloud-hopper).
