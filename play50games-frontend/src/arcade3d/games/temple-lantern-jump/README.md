# Temple Lantern Jump (Menu 2, game 6, World 3 Wild Temples): CARRY THE FLAME

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 67. Built to its
approved design card (`docs/menu2-super/world-3-wild-temples.md` "6 Temple Lantern Jump") on the
menu2 shared systems. Codex's partial branch (`codex/m2-temple-lantern-jump`, models only plus a
sketch) was taken over: the rules, course generator, proof, scene and HUD are rewritten.

## Concept and controls

A pitch-dark jungle-temple shaft. Stone cage lanterns hang up a spiral; bouncing on one throws the
hero 1.4x as high, refills the fading **ember** (8 s, 6 s on level 4) and lights the lantern for
12 s. Gold sun-glyph ledges are solid only in light (the ember's 6 m pool, a lit lantern, a flare, a
lit brazier); in the dark they fade and drop you. Plain stone ledges and the start deck are always
solid.

- Keyboard: WASD / arrows move (camera-relative), **Space jumps**, **E / Enter**: in the air it throws
  the ember down at a lantern (3 s of ember relights it; at the roof brazier on level 5), on the
  ground (or with nothing to throw at) it fires the hero power.
- Touch: joystick + Jump + Ember. Same timings on touch and keyboard.
- Camera (menu2/camera, the shared orbit): drag / two fingers turn, wheel / pinch zoom, Q/C turn,
  R/F tilt, V recentre. Movement reads the camera yaw (`StepInput.yaw`).
- Hero: the shared picker (start card, pause, result). **Kiro** (W3's lead) is preselected.

## Files

| File | What |
|---|---|
| `meta.ts`, `index.tsx` | plain data (time game, five levels, order 67), the GameDefinition (intro, star screen, runPlayers) |
| `levels.ts`, `course.ts` | per-level config; the deterministic spiral generator (pads, lanterns, glyph ledges, balconies, galleries, orbs, jets, bats, plates) |
| `rules.ts` | pure rules: fixed 1000/120 ms sub-steps, latched presses, ember, lantern light, glyph ledges, powers, bats, gusts, boss, secrets, limits |
| `bound.ts` | the score proof: the climb floor and the Queen's least defeat time |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `heroes.ts`, `progression.ts`, `levelEnd.ts`, `StarResult.tsx` | heroes; combo, stars, secrets, the Queen; progress; the star screen |
| `Scene.tsx`, `CourseView.tsx`, `World.tsx`, `Queen.tsx`, `Hero.tsx`, `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` | the scene, the course, the shaft, the boss, the hero, the orbit, the palette, the models, the HUD |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players |

(`CourseView.tsx`, not `Course.tsx`: Windows would collide it with `course.ts`.)

## Levels

| # | Name | Shaft | Lanterns | New |
|---|---|---|---|---|
| 1 | Temple Gate | 12 m | 9 | bounce first; the long dark stretch; target 70 s |
| 2 | Lantern Hall | 20 m | 12 | lanterns swing 2 m on chains; fire jets block the fast centre column |
| 3 | Balcony Climb | 28 m | 15 | gusts blow lit lanterns out (leaves warn 1 s ahead); balconies crumble |
| 4 | Night Temple | 36 m | 18 | soot bats snuff lit lanterns (bounce one to stun it); ember 6 s |
| 5 | Golden Roof | 40 m | 21 | the Soot Bat Queen (menu2/boss `QUEEN`, 7 hp) |

### Boss: the Soot Bat Queen (level 5)
Arena above the last lantern. Phase 1 (relight): she fans darkness; relight three lanterns to scorch
her wings. Phase 2 (dive): bounce into her dive over the glowing lantern. Phase 3 (brazier): throw the
ember into the roof brazier. Winning is her defeat, not the roof.

### Hero roles (all bonus, never required)
Riko dashes (12 m/s, 0.5 s); Nami double jumps on Jump; Kiro shields the fire jets 3 s; Zuno's magnet
(6 m, 3 s) pulls sparks and orbs; Vexa phases through the ghost wall to the ghost-room orb.

## Scoring

A time game. The submitted time = finish ms - 100 ms per orb - the flow bonus (combo: lanterns 15 ms,
orbs 20 ms, boss hits 40 ms, x2 cap). Score = `floor((timeBaseMs - time) / 10)`. A loss, the time cap
or quitting is unranked.

| Level | minDurationMs | maxDurationMs = timeBaseMs | maxScore |
|---|---|---|---|
| 1 | 1300 | 180000 | 17870 |
| 2 | 2600 | 210000 | 20740 |
| 3 | 3900 | 240000 | 23610 |
| 4 | 5200 | 270000 | 26480 |
| 5 | 24300 | 360000 | 33570 |

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)
No hero rises faster on average than `V_CLIMB_MAX = V_BOUNCE / 2` (a bounce landing on its apex; Nami's
second jump, a stomp and a dash are slower), so a shaft of height H takes at least H / V_CLIMB_MAX.
Level 5 adds the Queen's least defeat time (`bossMinMs`: a perfect hitter in the first ms of every
vulnerable window). The row is that floor less the largest bonus (5 orbs + the flow meter at x2 on
every counted event), less 6 %, rounded to 100 ms. Tests: the pinned rows equal `proposeLimits`;
random players of every hero never rise above the V_CLIMB_MAX line; the bot wins every level at 30,
60 and 144 fps with all 5 orbs (4 at 30 fps on some levels) inside the limits; idle times out unranked; a ragged-frame bot run
through the real store submits a ranked score inside the limits.

## Secrets, stars, progress
Per level two secrets (`progression.ts` SECRETS): a ghost room behind the wall (Vexa), gallery orbs in
the dark, a hidden brazier. Three stars: clear, all orbs, target time (`starSpecFor`). Recorded
through the shared progress adapter (`levelEnd.ts`).

## Local multiplayer (menu2/multiplayer, M1)
2-4 heroes climb the same shaft: the lit lanterns, orbs and braziers are shared. Co-op: Kiro's shield,
Zuno's magnet and Vexa's phase cover the team; two heroes standing on the twin plates of the start
deck light the great chandelier (the shaft floods for 20 s); the team clears when all are through.
Versus: first through wins, the others get the grace. A hero 8 m under the highest is sent back to
the last lantern. Multiplayer runs are never ranked.

## Open issues
- Model look/placement is judged from headless screenshots only; a real-phone pass is pending.
- The Queen is four `m2CaveBat` copies scaled 4.3x with an ash tint (no dedicated mesh).
