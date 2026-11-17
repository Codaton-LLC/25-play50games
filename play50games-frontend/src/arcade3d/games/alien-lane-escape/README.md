# Alien Lane Escape (Menu 2, game 17, World 5 Neon Cosmos)

Sprint across an alien valley while a mothership's scanner sweeps over you. Be inside a shadow when the scan line passes.

- Lead hero: Vexa.
- Status `dev`, order 85, collection `rollheroes`, owner `claude`.
- A time game.
- Card: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 17".

## Concept and controls

- **Auto-run.** The runner moves forward on its own at the level's speed: 10 m/s on level 1 up to 15 m/s on level 5.
- **Lanes.** There are three lanes. A lane change takes 0.18 s. Change lanes with a ← / → press (A / D), a swipe on the canvas, or a flick of the touch stick.
- **Jump and slide.**
  - Space, Up, a swipe up or the Jump button jumps.
  - Holding Down / S (or the stick pulled down) slides. A swipe down slides for about 0.6 s.
- **The scan (the signature mechanic: break line of sight).**
  - The Mothership hangs behind you. As you pass a scan's trigger, its violet line sweeps forward along the track at 22 m/s. It starts 40 m behind you.
  - The line closes in as you run, so it reaches you at the scan's meeting point. A stumble or goo never moves that point.
  - A cover stands there: a crystal, a rock, a drifting pod or a fresh meteor crater. It paints a 3 m **shadow strip** on its lane, and the meeting point is in the middle of the strip.
  - In the strip as the line passes, you are **UNSEEN**: a flow link.
  - Under a low cover (SLIDE sign) only a sliding hero is hidden.
  - Caught, the tractor beam lifts and spins you for 1.2 s. The flow chain breaks. Two catches within 6 s count as a hit.
- **Telegraph.** 1.5 s before the line reaches you, three things warn you:
  - an alarm chirp;
  - the SCAN bar at the top of the screen (violet while exposed, cyan once hidden), clear of thumbs on a phone;
  - a violet glow along the bottom edge.
  
  While a line passes you hidden, the screen drains of colour and a heartbeat plays.
- **Obstacles.** Rocks need a jump; glowing energy bars need a slide. Meeting one wrong is a stumble: half speed for 0.8 s, and a hit. Goo slows you to 0.6.
- **Camera.** The shared Menu 2 orbit camera:
  - Right-drag or two fingers turn it; the wheel or a pinch zooms.
  - Q / C / R / F turn and tilt it; V recenters.
  - One finger never turns it, because the swipe changes lanes.

## Files

| File | What |
|---|---|
| `levels.ts` | The five level configs (timer, speed, star target, boss). |
| `course.ts` | The track: scans with their covers, obstacles, orbs, goo, meteors, plants, mesas, caves, boss events, the bot's beats, the launch-road loop (pure). |
| `rules.ts` | The pure, deterministic simulation (4 ms steps), the store hand-off, the limits and their proof. |
| `bot.ts` | The honest bot (tests and `?autoplay=1`). It plays each hero's own route. |
| `heroes.ts`, `progression.ts` | The hero roles, flow meter, stars, secrets and `MOTHERSHIP`. |
| `assets.ts`, `look.ts` | The models with their measured sizes; the palette, the sky and the light per level. |
| `Road.tsx` | Everything with a rule, drawn from windows round the runner: covers, shadow strips, the scan line, meteors, plants, caves, the mesa, orbs, the boss track. |
| `World.tsx` | The starry sky with moons and aurora, spores, the valley floor, lights. |
| `Hero.tsx`, `Mothership.tsx` | The runner (beam spin, slide tuck); the Mothership and level 4's scanner drone. |
| `Scene.tsx`, `RunnerJuice.tsx`, `camera.ts` | The run, the input mapping, the juice, the camera, the intro. |
| `Hud.tsx`, `StarResult.tsx`, `levelEnd.ts` | The HUD (hidden / open, the SCAN bar), the star screen, progress. |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | Local play for 2-4 players. |

## Hero roles (the card)

| Hero | Power | What it does |
|---|---|---|
| Riko | Dash: x1.6 for 0.75 s, every 5 s | The scanner cannot lock on mid-dash. She takes the three orbs in open ground at a scan's meeting point instead of the cover's two. |
| Nami | A second jump in the air | Reaches the high mesa over the middle lane, which the scan cannot see (its orbs; the sticker on levels 1 and 4). |
| Kiro | Bubble, 1.2 s, every 8 s | Scan-proof, and carries him through goo at full speed (the goo's orb). In co-op it covers the team. |
| Zuno | Magnet, 3 s, every 8 s | Pulls the coin trails buried in the goo puddles from the next lane. |
| Vexa | Phase, 2.6 s, every 7 s | Hides inside any crystal within 4 m, strip or not. Walks through the ghost-crystal walls into the caves: two per level, the first with the shard. |

## Levels

1. **Alien Meadow** (10 m/s, star 55 s). It teaches the scan in three beats:
   1. a big crystal right in your lane, so you only stay put;
   2. the cover in the next lane;
   3. two quick scans with two covers in a row.
2. **Crystal Route** (11 m/s, star 58 s). Hovering pods drift across the lanes as their scan starts, and their shadow moves with them.
3. **Meteor Zone** (12.5 m/s, star 58 s).
   - Meteors fall 1 s after their trigger onto a ring telegraph, with dust and a camera kick.
   - Their craters are the new shadows; before the meteor lands there is no shadow.
   - The abduction zone: let a scan catch you inside it, and the beam lifts you to the **abducted shard** on its floating rock.
4. **Glow Plants** (13.5 m/s, star 58 s).
   - A glow plant stands in a cover's lane just before it. Brushed, it lights up and washes out the shadows within 10 m for 3 s, so steer into the lane after the plant.
   - The scanner drone also sweeps **lateral** lines across the lanes, landing 1.5 s after their trigger.
5. **Planet Escape** (15 m/s, star 80 s). The boss level (below).

### Boss: the Mothership (`MOTHERSHIP`, 7 hp)

The launch road (200 m) repeats until it is down. The drawn track runs on, so it never jumps back. Every hit is earned on the track and lands in the boss's next open window.

1. **Abduction beams** (3 hits). A beam locks onto a lane 8 m before it lands, next to a decoy pod. Be in that lane as it locks, then leave it before it lands. Blobs drop to jump.
2. **Glowing underside** (3 hits). It lowers ahead over the track. Saucer drones climb as stepping stones; jump into its underside from their lane.
3. **Planet escape** (1 hit). Constant scans as you sprint cover to cover. The last jump crashes a meteor into it, in slow motion.

## Stars, flow, secrets

- **Stars.** Clear; every main orb (the hero-route orbs and the open-ground orbs are extra); and the submitted time at or under the level's target.
- **No-hit badge.** The card's "Ghost Run": never caught and never stumbled.
- **Flow meter.** A link within 3 s, +0.25 per link, capped at x2. Each orb links 30 ms; each scan passed unseen (and each boss hit charged) links 80 ms.
- **Secrets.**
  - Level 1: the cave shard (Vexa) and the mesa sticker (Nami).
  - Level 2: the cave shard.
  - Level 3: the cave shard and the abducted shard.
  - Level 4: the cave shard and the mesa sticker.
  - Level 5: the cave shard.

## Scoring

Time game: `score = floor((timeBaseMs - duration) / 10)`. The duration is the finish time, minus 100 ms per orb, minus the flow bonus. Only a win is ranked.

### Server limits and why they hold

The bound (`minFinishMs`, `minDurationMsOf` in `rules.ts`):

- **Speed.** Nothing makes the runner faster than the level's speed except Riko's dash (x1.6 for 0.75 s, at most once every 5 s from the first frame). So covering `d` metres takes at least `leastRunMs(d) = (d / v - 0.45) / 1.09` seconds.
- **Level 5.** It adds the Mothership: once it wakes at the launch road, nobody leaves the loop before its least defeat time (a hit in the first ms of every open window) or one lap.
- **Bonuses.** From the floor we subtract:
  - the most orbs one hero can take: the main orbs, Kiro's goo orbs and every open-ground orb, plus the largest of Nami's, Zuno's and Vexa's own route orbs;
  - the most flow bonus the course can feed (`comboSpecOf`).
- **The limit.** The bound less 5 %, rounded down to 100 ms (`proposeLimits`), pinned in `rules.test.ts`.

| Level | min duration | time base | max score |
|---|---|---|---|
| 1 | 35 200 | 120 000 | 8 480 |
| 2 | 37 200 | 130 000 | 9 280 |
| 3 | 39 200 | 140 000 | 10 080 |
| 4 | 35 700 | 150 000 | 11 430 |
| 5 | 40 900 | 200 000 | 15 910 |

The guards in the tests:

- 30 s of random input for every hero on every level never gets further than the dash allowance.
- 60 spam runs never beat the floor.
- Every hero with its power mashed never beats the floor.
- The honest bot wins through the real store with ragged frames: a ranked win inside the limits.

## What the bots reached

The honest bot (Vexa, its routes played) wins every level at 30, 60 and 144 fps:

- never caught, never stumbled;
- every main orb;
- at least 80 % of max score.

Submitted times at 60 fps: about 42.8 / 45.3 / 47.5 / 43.4 / 69.6 s.

Every hero's bot wins every level unseen. All but Riko keep every main orb; Riko trades a cover's two orbs for the three in open ground.

## Models

Only Hyper3D models that already existed; no credits were spent.

- The ready set from `~/.play50/hyper3d/ready/menu2/alien-lane-escape`: lane slab, crystal, plant, pod, goo puddle, meteor rock, flying saucer, spires background, and the card's NICE `m2ScannerDrone`.
- The shared `m2AlienMothership` and `m2AlienBlob`.
- The shared Menu 2 orb, beacon and hero GLBs.

The scan line, the shadow strips, the beams and the glows are code (decals and additive planes), as the card says.
