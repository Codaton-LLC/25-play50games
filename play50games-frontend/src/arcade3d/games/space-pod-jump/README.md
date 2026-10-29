# Space Pod Jump (Menu 2, game 10)

World 5 "Neon Cosmos" (purple), lead hero Vexa. Design card: `w5-neon-cosmos.md` "10 Space Pod Jump"
(the coordinator's scratchpad `m2b/`). Status `dev`, order 84, a **time** game.

**Core verb: ORBIT (patched-conic gravity).** The play is in the x-y plane (z = 0), seen from +z. Bodies
pull with mu = 6 R^2 inside a sphere of influence SOI = 2.5 R, and **only the dominant body pulls** (the
smallest distance / SOI among the SOIs that hold the hero), so arcs are true Kepler arcs and the hand-off
is instant. Down is wherever that body is: the hero walks round planetoids (4 m/s), jumps (4.5 m/s, it
always comes back down on an R = 4 body: escape there is 6.93 m/s), launches from pod cradles (hold Jump
0-0.8 s: 5-9 m/s, aimed up to 50 degrees with the stick), brakes with the retro jets in flight (hold Jump
after letting go once: 1.5 m/s^2 against the motion, 1.2 s of fuel, refilled on landing) and slingshots off
moving moons. Touching a body lands on it. Leaving the map outside every SOI is "lost in space": after 1 s,
back to the last planetoid.

## Files

| File | What |
|---|---|
| `levels.ts` | the five levels' numbers (clock, star time, boss) |
| `system.ts` | each level's system: bodies (planetoids, moons on orbits, the Warden), pods, orbs, slingshot gates, flares, debris, Riko's cracked panels, level 4's crates, the secrets, the dock, the map bounds |
| `rules.ts` | the pure, deterministic run (1 ms steps), the trajectory predictor (`predictArc`), the bound and `PROPOSED_LEVEL_LIMITS` |
| `progression.ts` | the flow combo, the stars, the secrets, the Orbit Warden's `BossConfig` |
| `bot.ts` | the planning bot: weighs every launch through `predictArc` (tests and `?autoplay=1`) |
| `heroes.ts` | the heroes' roles here; Vexa preselected |
| `multiplayer.ts` | 2-4 local players: versus (slingshot steal) and co-op (double launch) |
| `Scene.tsx`, `World.tsx`, `Course.tsx`, `Hero.tsx`, `camera.ts`, `upPref.ts` | the scene and the rolling camera, the void, the system, the hero rolled to the local up, the camera numbers, the "Up: fixed" option |
| `Hud.tsx`, `StarResult.tsx`, `MultiplayerHud.tsx`, `MultiScene.tsx` | the HUD (fuel, pod card, Up switch), the star screen, multiplayer |

## Rules

- **Walking** is screen-relative: with the view rolled to the local up a right press walks clockwise
  everywhere round the body (`walkSign` reads the camera's roll and yaw from the step input).
- **Pods:** standing within 0.22 rad of a cradle, a Jump press starts the charge; the hero slides into the
  cradle at walking speed while it charges; letting go launches along the cradle's normal turned by the
  stick. A jump on the ground goes straight up off the surface plus the walk and the body's own motion.
- **The trajectory preview** (`predictArc`: 5 ms steps, the dominant body's gravity, moving bodies, the
  Warden's mine, the hazards, the dock) draws the next 1.5 s in flight and while charging: plain, green
  when it locks onto a capture or the dock, red when it would leave the map or hit a hazard.
- **Hazards:** a closed slingshot gate (open only at 8 m/s), a burning solar flare, orbiting debris, a
  cracked panel: a knock (bounced back at half speed, 0.6 s of grace). Kiro's shield crosses flares and
  debris.
- **Hero roles (the card):** Riko's prograde burn (+2.5 m/s in flight) and her dash breaks a cracked
  panel (levels 2 and 5's high-orbit shard); Nami's second impulse in flight (+3 m/s, prograde, or straight
  out with up held); Kiro's shield; Zuno's magnet (orbs from 6 m); Vexa's chord: her phase on a planetoid
  drops her straight through it to the far side at 6 m/s, and phasing on the ghost hatch (every level) or
  through level 4's big planetoid (its core sticker) finds a secret.
- **Level 4's crates:** a Jump press within 1.8 m of a floating crate in flight pushes off it: +3 m/s along
  the motion to the hero, the opposite to the crate.
- **Restore:** a body's halo is grey glass until the hero first lands on it, then lit (World 5 colours).
  Three captures in a row without jets: "Perfect Orbit" (the card's combo).

## Levels

| Level | Bodies | Twist |
|---|---|---|
| 1 Dock | 2 planetoids, the dock | walk all the way round one body (its orbs), hop into the next one's pull, first pod launch to the dock |
| 2 Pod Line | 6 small planetoids in a line | every crossing is a pod launch; aim it, brake if fast |
| 3 Satellite Field | 4 planetoids, 2 moving moons, a moonlet | slingshot gates (8 m/s), debris in orbit, a flare shortcut, the hidden moonlet |
| 4 Zero-G Gap | 4 planetoids round a 40 m gap | drift, push off floating crates, a debris belt, a flare over the gap |
| 5 Orbital Peak | a warm-up, 2 launch planetoids, the Warden and its moon | the Orbit Warden |

## The Orbit Warden (level 5)

`m2OrbitWardenBoss` as an R = 6 body (mu 216, SOI 15) at the arena's centre, its moon on a 12.5 m orbit,
two launch planetoids with pods aimed at it, pods on the Warden itself; through `menu2/boss`, 6 hp. It
starts when the hero first lands on an arena body.
- **Vents** (3 hits): it drops slow gravity mines (m2GravityBuoy: an extra pull within 6 m for 3 s) where
  the hero is heading; landing on one of its three glowing vents (they turn with it) queues a hit.
- **Debris Belt** (2 hits): a belt at 1.6 R with one 70-degree gap, round every 2.4 s; crossing it outside
  the gap is a knock. Walking onto its thruster queues a hit (the thruster then moves on).
- **Escape** (1 hit): a landing at 8.5 m/s or more (a full pod launch, or a slingshot off its moon).
A queued hit lands at its next open window (one a window). Slow-mo; the dock's ring lights up.

## Scoring

A time game: **the submitted time is the finish time** (`runTimeMs`). Orbs feed the "all orbs" star,
gates and captures the flow meter (juice: nothing comes off the time). `finalScore` sends it; the server
computes `(timeBaseMs - time) / 10`.

## Server limits and why they hold

- **The speed guard:** in flight the velocity is capped at V_MAX = 14 m/s (pod 9 + a moon's motion + a fall
  into a well + Riko's burn stay at or under it in play; the cap only bites in contrived cases); on the
  ground the hero moves at walking speed plus its body's motion (a moon moves at most 3.75 m/s); Vexa's
  chord is 6 m/s; the pod slide is walking speed; a take-off never lifts the hero (the body just left does
  not count for 40 ms). So every ms the hero moves at most V_MAX / 1000 m, or is put back on a point it
  stood on before (lost in space). Tested every ms with mashed powers.
- **The floor:** the dock is reached only within 4.5 m of it, so the farthest x must grow from the start
  to `dock.x - 4.5`: `progressFloorMs`. Level 5 also needs the Warden down: its machine's least time after
  the first arena landing (the arena starts no nearer than its first body's surface).
- **minDurationMs** = the floor less about 4.5 %, rounded down to 100 ms.

| Level | minDurationMs | max / base ms | maxScore |
|---|---:|---:|---:|
| 1 | 1900 | 120000 | 11810 |
| 2 | 7800 | 150000 | 14220 |
| 3 | 6300 | 160000 | 15370 |
| 4 | 7800 | 170000 | 16220 |
| 5 | 16000 | 260000 | 24400 |

The floor is a distance bound (no better proof of an orbit's least time is cheap), so the limits are
loose against play: the planning bot takes about 15 / 25 / 48 / 28 / 75 s.

### What the bots reached

| Bot | Result |
|---|---|
| Planning bot (walks to the surface orbs, then weighs ~76 launches per body through the predictor at 5 ms and the best 6 again at 1 ms) | wins every level at 30 / 60 / 144 Hz; brings the Warden down; all main orbs on levels 1, 3, 4 (it skips bodies on level 2) |
| Every hero with its power mashed (level 1) | clears, never under the floor |
| Through the real store, ragged frames | a ranked win inside the limits |
| Spam (12 per level, any hero, random walking, jumps, holds, power, rolls, 4-50 ms frames) | no finish under the floor |

## Multiplayer (1-4)

Each hero flies its own copy of the system (stacked along y), the same seed; one shared camera from +z
(no roll). Versus: a faster hero passing within 2 m of a rival's place takes 1 m/s from them (the card's
slingshot steal). Co-op: two heroes charging pods on the same body launch together (+2 m/s each: the
card's double-strength escape); shield, magnet and phase cover the team. Never ranked.

## Models

`public/models/3d/space-pod-jump/` (ready/menu2/space-pod-jump, no credits spent): `m2MiniPlanetoid` (the
planetoids), `m2OrbitWardenBoss` (15k triangles: the character budget), `m2SpacePod`, `m2StationDeck`,
`m2DockingArm`, `m2SatellitePanel` (Riko's panels), `m2SpaceCrate` (level 4's crates), `m2EnergyOrbBlue`,
`m2Asteroid` (the moons and the debris), `m2RingedPlanetBg`, `m2GravityBuoy` (the Warden's mines); the
dock's beacon is the shared `menu2/checkpointBeacon`. Code: the halos, the SOI rings, the gates, the flares,
the belt, the vents, the thruster, the trajectory dots, the starfield, the grid, the Hollow Prism cameo.
