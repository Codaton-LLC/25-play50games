# Candy World Runner (Menu 2, game 19, World 4 Frost & Sweets)

Eat sweets to grow, burn them off to shrink. Your size decides what you smash, what you squeeze through and what holds your weight.

- Lead hero: Zuno.
- Status `dev`, order 77, collection `rollheroes`, owner `claude`.
- A time game.

## Concept and controls

- **Auto-run.** The runner moves forward on its own at the level's speed: 9 m/s on level 1 up to 14 m/s on level 5.
- **Lanes.** There are three lanes. A lane change takes 0.18 s, or 0.45 s on level 3's frosted ice. Change lanes with a ← / → press (A / D), a swipe on the canvas, or a flick of the touch stick.
- **Sizes: Small, Normal, Big.** The scale is the card's 0.7 / 1.0 / 1.4, with a squash-and-stretch pop on each change.
  - Every 3 candy coins grow you one size.
  - Holding Down (S, or the stick pulled down) sugar-burn rolls you down one size every 0.6 s.
- **Obstacles need a size.**
  - Big smashes jelly cubes, chocolate walls and frozen blocks.
  - Small slips under cookie, candy-cane and frozen arches.
  - Met at the wrong size, an obstacle is a **size miss**: you stumble through at half speed for 0.8 s.
- **Size signs.** A BIG / SMALL sign over each obstacle shows 2 s ahead (3 s on level 1), and the HUD repeats it.
- **Jump.** Space / Jump hops.
- **Power.** E / Enter / Power uses the hero's power (see Hero roles).
- **Camera.** The shared Menu 2 orbit camera: right-drag or two fingers, wheel or pinch, Q / C / R / F, V to recenter. One finger never turns it, because the swipe changes lanes. It pulls back 1.2 m per size.

## Files

| File | What |
|---|---|
| `levels.ts` | the five level configs (timer, speed, allowed misses, boss) |
| `course.ts` | the road as beats (obstacle rows), their coins, orbs, side lanes, the twists, the palace loop (pure) |
| `rules.ts` | the pure, deterministic simulation (4 ms steps), the store hand-off, the limits and their proof |
| `bot.ts` | the honest bot (tests and `?autoplay=1`) |
| `heroes.ts`, `progression.ts` | the hero roles, flow meter, stars (with the custom third star), secrets and `KING_BONBON` |
| `assets.ts`, `look.ts` | the models with their measured sizes; the palette, the sky and the light |
| `Road.tsx` | the road and everything with a rule, drawn from windows round the runner (the palace drawn on down the road each lap) |
| `World.tsx` | sky, sprinkles, the candy-floss meadow, lights |
| `Hero.tsx`, `King.tsx` | the runner at its size; King Bonbon |
| `Scene.tsx`, `RunnerJuice.tsx`, `camera.ts` | the run, the input mapping, the juice, the camera, the intro |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | the HUD (size pips, coins towards the next size, the sign), the star screen, progress |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local play for 2-4 players |

## Hero roles (the card)

| Hero | Power | What it opens |
|---|---|---|
| Riko | Dash: at Big it is a sugar charge | Breaks the gingerbread wall into the left bonus lane (its orbs) |
| Nami | A second jump in the air | Reaches the candy-cane rail over the middle lane (its orbs); one jump never does |
| Kiro | Shield (3 s) | Crosses the popping-candy field (its orbs); anyone else is knocked down a size |
| Zuno | Magnet, switched on and off (1 s cooldown) | Pulls the coin trails out of the frosting wall, and the candy coins round him: he chooses when to grow |
| Vexa | Phase (2.6 s) | Through the ghost wall into the hidden fourth lane (its orbs and the shard) |

## Levels

1. **Candy Lane** (9 m/s). It teaches the mechanic in three beats:
   1. eat 3 + 3 coins, grow, smash a jelly cube;
   2. roll down, slip under a cookie arch;
   3. both in a row.

   One lane is always free at each obstacle row.
2. **Cookie Road** (10 m/s). Chocolate-bar bridges crack under a Big hero, which counts as a size miss. Donuts bounce a Small hero high over the road to their orbs.
3. **Sorbet Slopes** (11 m/s). Frosted ice makes a lane change drift for 0.45 s. Frozen blocks (Big) and frozen arches (Small) sit packed close. At the end, a candy-cane arch at the edge of the left lane is the secret exit, and only a Small runner fits.
4. **Gummy Grove** (12.5 m/s). Gummy monsters bite you down a size. A jump onto a gummy's head grows you a size.
5. **Bonbon Palace** (14 m/s). The boss level (below).

### Boss: King Bonbon (`KING_BONBON`, 6 hp)

He retreats ahead of you down the palace road. The palace section (180 m) repeats until he is free. The road's drawn position runs on, so it never jumps back.

Every hit is a Big beat on the track. It charges a hit for his next open window.

1. **Lollipop wheels** (3 hits). Go Small under the wheels rolling down two lanes, then go Big for his jelly drum (twice a lap).
2. **Sour sprinkles** (2 hits). Golden coins sit in one lane only; take them, then slam his throne at Big (twice a lap).
3. **Palace collapse** (1 hit). The arches alternate Small, Big, Small fast. Then comes a Big body slam on his crown, with a slow-mo honey-gold burst.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 100 ms per orb, minus the flow bonus. Only a win is ranked.

### Server limits and why they hold

The runner never moves faster than the level's speed. A miss only slows it, and nothing speeds it up; `rules.test.ts` checks this on every step for random input from every hero. So the road at that speed is a floor.

On level 5 the king wakes when you reach the palace. From then on you can only leave after his least defeat time (`bossMinMs`, every window hit at once) or one lap, whichever is longer.

From that floor come off:

- the most orbs one hero can take: the road's and the donuts', plus Kiro's field (anyone can take its knock), plus its own route, since the others are gated by their powers (`powers.test.ts`);
- the most flow bonus. The palace's beats count once per lap for at most `ceil(bossMin / lap) + 1` laps. An extra lap costs more time (13 s) than its beats can add to the flow bonus.

What is left, less 4.5 %, rounded down to 100 ms, is the limit:

| Level | min ms | time base | max score |
|---|---:|---:|---:|
| 1 Candy Lane | 40 800 | 120 000 | 7 920 |
| 2 Cookie Road | 39 900 | 130 000 | 9 010 |
| 3 Sorbet Slopes | 30 000 | 140 000 | 11 000 |
| 4 Gummy Grove | 27 100 | 150 000 | 12 290 |
| 5 Bonbon Palace | 32 600 | 200 000 | 16 740 |

### What the bots reached

- The honest bot (Zuno, no powers) wins every level at 30, 60 and 144 fps, with every main orb and no size miss. It scores at least 80 % of maxScore: about 94 % on levels 1-4 and 83 % on level 5, where the king's windows decide.
- Every hero wins with the plain bot. Spam and power-mashed runs never beat the floor.

## Stars, flow, secrets, progress

- **Stars:**
  - clear;
  - every main orb (28 / 28 / 26 / 26 / 18 on these layouts);
  - the card's custom third star "no size miss": at most 1 wrong-size hit, 0 on level 5 (menu2/stars `atMost`).
- **No-hit badge:** no miss, bite or popped field.
- **Flow meter:** a link within 2.5 s, +0.25 per link, capped at ×2. Orbs and obstacles met at the right size feed it.
- **Secrets:**
  - the fourth-lane shard (every level, Vexa);
  - the "sugar giant" sticker (level 2: stay Big for 20 s without breaking a bridge);
  - the secret exit (level 3: Small through the candy-cane arch at the end of the left lane).

## Local multiplayer (menu2/multiplayer, M1)

- **Setup.** 2-4 runners start in a short column, P1 in front, 3.5 m apart. Each runner's head start is added back to its time. Each runner has its own size and eats its own coins; the orbs are shared.
- **Modes.** Co-op shares Kiro's shield, Vexa's phase and Zuno's magnet. In versus, first through the gate wins.
- **Camera and drawing.** The shared camera frames everyone. The road and the king are drawn from the leader's run.
- **Not built from the card:**
  - the 2-player split screen;
  - the 5-6-lane track for 3-4 players;
  - co-op "piggyback" arches.

## Models

- **This game's own GLBs:** the ready Hyper3D set in `public/models/3d/candy-world-runner/`, including today's `m2FrostedCupcakeTower`, plus `m2CandyKingBoss` and `m2GummyMonster` from shared. All are listed in `core/modelManifest.ts`.
  - Tinted copies: the frozen blocks are a tinted jelly cube, and the drum and crown are gold jelly; the frozen arches are a tinted cookie arch; the throne is a gold cupcake tower.
  - Lollipops are the wheels.
- **Shared Menu 2 GLB:** the orb.
- **Drawn in code:** the road, the gates, the rail, the frosting walls, the fields and ice, the size signs.

## Open issues

- `registry.sync.test.ts` expects consecutive orders. Order 77 follows 75 on this branch, so that test fails here until orders 71-74 and 76 are merged (`slice_resolve.py` sorts it).
- The main orb counts are below the card's 30-45: the orbs reward the right size after each obstacle row.
