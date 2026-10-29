# Dragon Cave Rush (Menu 2, game 14, World 1 Ember Heights)

Ride a mine cart through a crystal cave with Cindermaw, an angry, drained dragon, on your tail. Lean into
the curves, hop gaps and rocks, duck her breath, and bring back the egg the Shadow Plates' patrol bots
stole. Lead hero Riko. Status `dev`, order 66, collection `rollheroes`, owner `claude`. A time game.

## Concept and controls

- The cart rides the rails at the level's track speed: 14 m/s on L1, up to 22 m/s on L5. You never steer
  it; you lean, hop, duck, swap and use your power.
- **Lean** (A / D, arrows, the stick; camera-relative): the right lean on a curve gives +15 % speed. A
  wrong lean, or no lean, on a sharp curve tips the cart onto two wheels (warning, sparks). The next
  wrong lean on another sharp curve derails it (a hit).
- **Hop** (Space / Hop): over gaps and rocks. **Duck** (S / Down, stick pulled down): under beams and breath.
- **Swap track** (a tap of ← / → or a swipe on the canvas): only where a parallel track exists (forks).
- **Power** (E / Enter / Power): see the hero roles below.
- **Camera:** the shared Menu 2 orbit camera. Right-drag or two fingers turn it, the wheel or a pinch
  zooms, Q / C / R / F turn and tilt it, V recenters it. The auto-follow swings it back behind the rails
  1.2 s after you let go. One finger never turns it: the canvas swipe is the lane swap.
- **Distance meter** (0-100, always on screen): Cindermaw's distance. It creeps down while she chases. A
  hit costs 25. Perfect leans, cleared obstacles and Riko's barricades raise it. At 0 she catches you:
  a hit, and a respawn at the last lantern.
- **Breath:** an orange glow from behind, a roar and a HUD warning 1.0 s before every breath. The breath
  fires down the lane you were on, so duck it or swap.

## Files

| File | What |
|---|---|
| `levels.ts` | the five level configs (timer, speed, star target, dark, boss) |
| `track.ts` | the rails: segments, lanes (fork / scaffold / ghost / shortcut), hazards, breaths, orbs, secrets, lanterns, the L5 loop and its boss events, the bot's lane plan (pure) |
| `rules.ts` | the pure, deterministic 2 ms-substep simulation, the store hand-off, the limits and their proof |
| `bot.ts` | the honest bot (the tests and `?autoplay=1`) |
| `heroes.ts`, `progression.ts` | hero roles, the flow meter, stars, secrets, the boss `CINDERMAW` |
| `assets.ts`, `look.ts` | the models with their measured sizes; the palette, the cave tunnel and floor meshes, the light |
| `Course.tsx` | everything along the rails, drawn from windowed instanced pools round the cart |
| `Hero.tsx` | the cart with the picked hero (menu2/heroAnim) and Cindermaw |
| `World.tsx` | the lights: level light, the cart lantern, the ember glow, the breath flash |
| `Scene.tsx`, `CartJuice.tsx`, `camera.ts` | the run, the input mapping, the juice, the orbit camera, the intro |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | the HUD, the star screen, progress |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players |

## Hero roles (the card)

| Hero | Power | What it opens |
|---|---|---|
| Riko | Boost (4 s cooldown) | smashes a cracked barricade onto a shortcut track (+20 distance, its orbs; L4: the hidden hoard room shard) |
| Nami | Double hop | the second hop near a scaffold ramp lifts the cart onto the upper track (its orbs, the ember shard) |
| Kiro | Shield (3 s, 8 s cooldown) | absorbs one breath or lavafall; the lavafall fork's orbs |
| Zuno | Magnet (3 s, 8 s cooldown) | pulls a crystal trail of orbs off the cave wall |
| Vexa | Phase (2.6 s, 7 s cooldown) | the purple ghost rails are solid only while phasing (a rockfall bypass, the sticker); anyone else falls through |

Every hero clears every level. The hero side tracks only carry bonus orbs and secrets.

## Levels

1. **Crystal Entry** (90 s, 14 m/s): gentle curves, then a gap and a low beam. Then the hoard: Cindermaw
   wakes, and a 20 s escape with two breaths ends at the skull gate.
2. **Rockfall** (110 s, 16 m/s): hanging crystals fall where their shadow marks the rails, and forks
   offer two routes, one of them through the rockfall.
3. **Glow Tunnel** (120 s, 18 m/s): a dark cave lit by glow mushrooms and the cart lantern. Each breath
   lights the track ahead for 1.2 s.
4. **Deep Cave** (130 s, 20 m/s): lavafalls on timers, parallel tracks with swaps under fire, breaths in
   pairs.
5. **Dragon Hoard** (180 s, 22 m/s): boss level (below).

### Boss: Cindermaw (L5, `CINDERMAW`, 8 hp)

The track runs into a loop (radius 32 m, about 201 m a lap) round her. The loop repeats until she is free.
Every hit comes from the track and lands in her next open window:

1. **Crystal drop** (8 to 5 hp): she flies beside you. Hop on the glowing trigger plates to drop the
   crystals onto her, three times.
2. **Ore ramps** (5 to 3 hp): she flies ahead and sends fireballs down the main track. Swap to the outer
   track and hit the boost ramps, which fling ore into her, twice.
3. **Collar locks** (3 to 0 hp): she hovers over the loop. Hop at each of the three collar locks as you
   pass them. Then slow-mo, the collar breaks, she turns, and she flies you out.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 250 ms
per orb, minus the flow bonus. Only a win (`end("win")`) is ranked. A time-up is unranked.

### Server limits and why they hold

The cart's speed along the rails is fixed by the track. Each straight piece runs at the track speed and
each curve at no more than ×1.15. Nothing else ever moves the cart faster: a boost only breaks a
barricade, and the speed-guard test checks every substep on every level. So the least finish time is the
rails' length piece by piece at that bound (`travelFloorMs`, with one substep of slack per piece). On L5
it is the run-in, plus the longer of one lap and Cindermaw's fastest defeat (`bossMinMs`), plus the run
out. From that bound the proof takes off every orb's 250 ms and the flow meter's maximum bonus
(`comboMaxBonus`). `minDurationMs` is that bound less about 4.5 %, rounded down to 100 ms (`proposeLimits`).

| Level | min ms | max ms = time base | max score |
|---|---:|---:|---:|
| 1 Crystal Entry | 36 400 | 90 000 | 5 360 |
| 2 Rockfall | 33 300 | 110 000 | 7 670 |
| 3 Glow Tunnel | 30 600 | 120 000 | 8 940 |
| 4 Deep Cave | 28 300 | 130 000 | 10 170 |
| 5 Dragon Hoard | 33 900 | 180 000 | 14 610 |

These are pinned in `rules.test.ts` and must equal `arcade-games.json` (registry.sync).

The tests cover:

- honest bots at 30, 60 and 144 fps through the real store: every level is won at 89-95 % of maxScore, with every main orb and no hits;
- an idle bot and a spam bot;
- every hero, plain and with its power mashed;
- mutation probes: a faster track or another timer changes the row.

## Stars, flow, secrets, progress

- **Stars:** clear, all main orbs, and the submitted time at or under the level's star target. The
  bonus badge is "never below 50 distance" once she woke.
- **Flow meter:** a chain within 2.5 s, +0.25 per link, capped at ×2. Orbs, perfect leans and cleared
  obstacles feed it.
- **Secrets:** the ember shard at the end of the scaffold track (Nami) and the sticker in the ghost-rail
  cave (Vexa). On L4, the hoard shard sits behind Riko's cracked barricade.
- `levelEnd.ts` records the result through menu2/progress.

## Local multiplayer (menu2/multiplayer, M1)

2-4 carts on the same rails, each player on their own device. The carts start in a short column 3.5 m
apart with P1 in front, and each cart's head start is added back to its time. Taken orbs and broken
barricades are shared. One Cindermaw rides the leader's tail. In co-op, Kiro's shield, Zuno's magnet and
Vexa's phase cover the team, and the team clears when every cart is out. In versus, the first cart
through the gate wins and the others get the grace time. Multiplayer runs are never ranked.

The card's coupled co-op train and its split screen for 3-4 players are not built: this is the shared
M1 framework's shared camera.

## Models

All the visible objects are the ready Hyper3D GLBs in `public/models/3d/dragon-cave-rush/`, listed in
`core/modelManifest.ts`:

- the cart, rails, scaffold, crystals, cluster, mushrooms, stalagmites, rocks, lavafall, lantern posts, arch bridge (the duck beam), wall chunk (the barricade), hoard, egg and skull gate;
- `m2PatrolBot`, the egg thieves at the hoard;
- `m2CinderDragon`, Cindermaw.

The bat and the score orb are the shared Menu 2 ones. `assets.test.ts` checks every `GLB_SIZE` against
the real mesh. The cave tunnel and floor are procedural meshes (terrain); the trigger plates, collar
lock rings, fireballs and lava streams are code.

## Open issues

- `registry.sync.test.ts` expects consecutive orders. Order 66 follows 59 on this branch, so that one
  test fails here until orders 60-65 are merged.
- On a keyboard, an A / D press at a fork both leans and swaps track, because a lane swap is any left /
  right press. Hold the lean key through the curve and tap it only to swap.
