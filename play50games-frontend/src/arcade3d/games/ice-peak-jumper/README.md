# Ice Peak Jumper (Menu 2, game 9, World 4 Frost & Sweets)

You can't stop on ice. You build your slide, then launch off the edge, and the run-up is your aim.

- Lead hero: Zuno.
- Status `dev`, order 75, collection `rollheroes`, owner `claude`.
- A time game.

## Concept and controls

- **Ice has no grip.** The stick (WASD / arrows, camera-relative) accelerates the hero at 5 m/s², up to 9 m/s. Nothing slows the slide except the brake or pushing the other way. The brake is the stick pulled back (S / Down): 6 m/s².
- **A jump keeps the slide's speed.** 0-9 m/s gives 2.5-7.0 m, with a fixed 2.2 m apex and gravity ×1.6 after it. There is 120 ms of coyote time and a 120 ms jump buffer.
- **Snow grips.** You walk at 5 m/s and can stop, turn and re-aim.
- **Beacons.** The route's snow patches carry the cairn beacons.
  - Each beacon lights when you land on it after the one before it.
  - The summit opens once all of them are lit.
  - A fall drops you back on the last lit beacon.
- **Cracked ice** shatters 1.2 s after the first touch and comes back 4 s later.
- **Landing arc.** On levels 1-2, a dotted arc shows where a jump would land, above 4 m/s.
- **Perfect landings.** A landing within 0.3 m of a platform's centre is perfect and feeds the flow meter.
- **Power:** E / Enter / the Power button (see the hero roles).
- **Camera:** the shared Menu 2 orbit camera (drag or two fingers, wheel or pinch, Q / C / R / F, V to recenter). Above 7 m/s the view widens by up to 6°.

## Files

| File | What |
|---|---|
| `levels.ts` | the five level configs (timer, star target, landing arc, night, boss) |
| `course.ts` | the platforms, beacons, hero routes, hazards and the golem's arena (pure) |
| `rules.ts` | the pure, deterministic simulation (4 ms steps), the store hand-off, the limits and their proof |
| `bot.ts` | the honest bot (tests and `?autoplay=1`) |
| `heroes.ts`, `progression.ts` | the hero roles, flow meter, stars, secrets and `FROST_GOLEM` |
| `assets.ts`, `look.ts` | the models with their measured sizes; the palette and the light |
| `Peak.tsx` | everything with a rule: platforms, slopes, walls, orbs, secrets, icicles, yeti, rollers, slimes, chutes, lanterns, beacons, the summit cairn, the landing arc |
| `World.tsx` | sky, far peaks, snowfall, lights |
| `Hero.tsx`, `Golem.tsx` | the animated hero (and the blob-shadow probe); the Frost Golem |
| `Scene.tsx`, `PeakJuice.tsx`, `camera.ts` | the run, the input mapping, the juice, the orbit camera, the intro |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | the HUD (speed meter, ICE / SNOW tag), the star screen, progress |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local play for 2-4 players |

## Hero roles (the card)

| Hero | Power | What it opens |
|---|---|---|
| Riko | Dash, +4 m/s on ice for 0.5 s (4 s cooldown) | Speed ledges 6.8 m off a run (9 m/s carries only 6.7 m); smashes the golden-mitten ice cube |
| Nami | Second jump in the air, which re-aims along the stick | High cornices 3.6 m up (one jump rises 2.2 m), the cairn flag |
| Kiro | Shield (3 s, blocks one hit) | Crosses the icicle-rain chute; blocks a snowball |
| Zuno | Magnet (3 s) | Pulls the coin trails frozen inside the ice walls |
| Vexa | Phase (2.6 s) | Goes through the ghost-ice walls into the back caves (a shard) |

Every hero clears every level. The hero routes only carry bonus orbs and secrets.

## Levels

1. **Base Camp** (180 s timer, star at 70 s). It teaches the mechanic in three beats:
   1. a flat ice sheet into a snow patch;
   2. the 3 m gap (the run-up decides);
   3. cracked ice.
2. **Icicle Steps** (95 s star). Tiered ledges zig-zag up the face. Icicles beside the runs shake for 0.8 s once you pass under them, then drop.
3. **Yeti Ridge** (110 s star). A yeti on the high ledge throws a snowball every 3 s at where you stand. He waits for you to land, and a shadow marks the spot 1.2 s ahead. Rolling snowballs on a side sheet can be ridden for 2 s to their ledge.
4. **Lantern Night** (125 s star). Snow grips only while its lantern is lit (4 s of every 6 s, staggered). Ice slimes patrol two patches.
5. **Summit Cairn** (160 s star). The boss level (below).

### Boss: the Frost Golem (`FROST_GOLEM`, 6 hp)

He wakes when the arena's beacon lights. Every hit comes from the arena: landing on the glowing target charges a hit for his next open window (2-3 s after each slam).

1. **Slope slam** (3 hits). Slide up the 25° ice slope he raised and launch onto the core on his back. You are set down on the arena after each hit.
2. **Glaze** (2 hits). Climb the boulder steps to his shoulder.
3. **Climb** (1 hit). He climbs the cairn. Its five platforms crumble 3 s after you touch them. Reach his head crystal to finish him, with a slow-mo finish.

After his defeat, the summit beyond his head is the goal.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 100 ms per orb, minus the flow bonus. Only a win is ranked.

### Server limits and why they hold

The rules guarantee three things (`rules.test.ts` guards them on every step for random and mashed input from every hero):

- **Climb.** Every take-off sets vy = V_JUMP and never more, and gravity takes it back. So a hero rises at V_JUMP / 2 = 5.05 m/s on average at best. Slopes climb at most 9 × 0.46 m/s, the slide being capped at 9 m/s on them.
- **Travel.** The slide never exceeds 9 m/s, except a dash's 4 m/s for its 0.5 s window (one dash, then one per 4 s). So `maxTravel(t)` bounds the horizontal displacement.
- **Order.** The beacons light only in order, and a fall drops you on the last lit beacon, so no teleport carries you ahead.

So each beacon-to-beacon leg takes at least the longer of its climb over V_CLIMB_MAX and the travel floor for the gap between the two footprints. Level 5 adds the golem's least defeat time (`bossMinMs`, every window hit at once).

From that floor come off:

- the most orbs one hero can take: the main route, the ride and Kiro's chute (anyone can take a chute's hit), plus its own hero route, since the others' routes are out of reach without their power (`powers.test.ts`);
- the most flow bonus.

What is left, less 6 %, rounded down to 100 ms, is the limit:

| Level | min ms | time base | max score |
|---|---:|---:|---:|
| 1 Base Camp | 2 400 | 180 000 | 17 760 |
| 2 Icicle Steps | 600 | 210 000 | 20 940 |
| 3 Yeti Ridge | 1 400 | 240 000 | 23 860 |
| 4 Lantern Night | 2 100 | 270 000 | 26 790 |
| 5 Summit Cairn | 17 700 | 360 000 | 34 230 |

The bound is honest but loose: the real runs take 30-50 s. The time on ice goes into building and killing speed, and no rule can bound that, because a slide once built is kept forever.

### What the bots reached

- The honest bot (Zuno) wins every level at 30, 60 and 144 fps, with every main orb, under each level's star target. Its solo runs take 34-49 s, with no falls and no hits.
- Every hero wins with the plain bot, and no mashed-power run beats the floor.

## Stars, flow, secrets, progress

- **Stars:**
  - clear;
  - every main orb (25 / 30 / 35 / 40 on levels 1-4, as the card asks; level 5's short climb carries 21);
  - the time target.
- **No-hit badge:** no hit from an icicle, snowball, roller, slime or the chute. A fall is not a hit.
- **Flow meter:** a link within 3 s, +0.25 per link, capped at ×2. Orbs and perfect landings feed it.
- **Secrets:**
  - the golden mitten in its ice cube (Riko);
  - the cairn flag on a high cornice (levels 2 and 4, Nami);
  - the hidden ledge behind the peak (a launch of 8.8 m/s or more);
  - the ghost-ice shard (Vexa).
- `levelEnd.ts` records the result through menu2/progress.

## Local multiplayer (menu2/multiplayer, M1)

2-4 heroes start side by side on the start patch, and taken orbs are shared.

- **Co-op:** the checkpoints are shared. This is the card's leash respawn: a fall drops you on the highest beacon any hero has lit. Kiro's shield, Zuno's magnet and Vexa's phase cover the team, and the team clears when everyone is on the summit.
- **Versus:** first to the summit wins.

The peak's cracked ice and the golem are drawn from the leader's run. Multiplayer runs are never ranked.

Not built from the card:

- a hero acting as a grip patch for another (co-op launch chains);
- the two co-op-only ledges.

## Models

- **This game's own GLBs:** the ready Hyper3D set in `public/models/3d/ice-peak-jumper/`, plus `m2FrostGolemBoss` and `m2IceSlime` from shared. All are listed in `core/modelManifest.ts`.
  - Platforms are the ice / snow / cracked slabs stretched to each footprint, with a tall ice block for the boss steps.
- **Shared Menu 2 GLBs:** the orb and the checkpoint beacon.
- **Drawn in code** (moving parts and markers):
  - the golem's slam slope;
  - the frozen walls (trail, ghost, cube);
  - lantern posts and halos;
  - warning rings, the snowball shadows and the landing arc.

## Open issues

- `registry.sync.test.ts` expects consecutive orders. Order 75 follows 67 on this branch, so that test fails here until orders 68-74 are merged (`slice_resolve.py` sorts it).
- The card's 40 m climb on level 1 is about 11 m here. Every link rises at most 1.6 m, so that each jump stays readable.
- Level 3's yeti waits for you to land before he throws (never at you mid-air).
