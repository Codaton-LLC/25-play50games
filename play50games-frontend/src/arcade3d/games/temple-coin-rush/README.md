# Temple Coin Rush (Menu 2, game 16)

World 3 "Wild Temples" (green), lead hero Kiro. Design card: `docs/menu2-super/world-3-wild-temples.md`
"16 Temple Coin Rush" (branch `claude/m2-super-plan`). Status `dev`, order 69, a **points** game.

**Core verb: COLLECT AND PAY.** A three-lane auto-runner through a collapsing jungle temple with a
boulder at your heels. Coins fill a purse that lasts only for the run. Every 12-18 s a toll gate
splits the path for a section: run through a toll arch with enough coins and they are spent (the
portcullis grinds up onto a short, clean, coin-rich fast lane with a run boost); without enough the gate
stays shut and pushes you into a slow lane (longer: 90 % speed, with traps, and the boulder gains 1.5 m).
Unspent coins score double at the finish, so every gate is a choice: buy speed or bank points.

## Files

| File | What |
|---|---|
| `levels.ts` | the five levels' numbers (speed, clock, par time, finish bonus, bank target, boss) |
| `temples.ts` | each level's hand-written script and the builder: coin lines and arcs, blocks, beams, fire jets, spike and broken tiles, side-ramp boulders, Zuno's veins, the toll gates and their sections |
| `rules.ts` | the pure, deterministic run (1 ms steps), the bounds and `PROPOSED_LEVEL_LIMITS` |
| `progression.ts` | the combo, the stars, the secrets, Coilstone's `BossConfig` |
| `bot.ts` | the honest bot (tests and `?autoplay=1` on preview builds) |
| `heroes.ts` | the five heroes and their roles here; Kiro preselected |
| `multiplayer.ts` | 2-4 local players: versus (shared coins, held-open lanes) and co-op (one purse) |
| `Scene.tsx`, `World.tsx`, `Course.tsx`, `Hero.tsx`, `camera.ts` | the scene, the temple, the props, the hero, the orbit camera and the intro |
| `Hud.tsx`, `StarResult.tsx`, `MultiplayerHud.tsx`, `MultiScene.tsx` | the HUD, the star screen, multiplayer |

## Rules

- **Lanes:** three, 2.4 m wide; Left / Right change lanes (camera-relative under the orbit camera), Up
  jumps (apex 1.29 m), Down rolls (0.7 s). Inside a gate's section stone dividers hold the lane.
- **Coins:** picked up within 1 m of the hero's middle (Zuno's magnet: 5 m). A coin within 0.4 s of the
  last links the combo (juice: the ping climbs, the meter fills; it adds no score).
- **Toll gates:** each lane behind a gate is a toll lane (cheap, dear, or level 3's 50-coin jackpot with
  coins worth 2) or a slow lane. The price floats over the arch on a billboard badge (never on the
  mesh) and on the HUD's gate card ("pay or bank?" / "short by n"). Paying happens at the gate's plane.
  A shut gate pushes the hero to the nearest slow lane. Level 4's surge: every 2 s of the last 40 m spent
  outside a toll lane adds 1 to the price.
- **The boulder:** 6 m behind. A stumble costs 1.6 m, a slow section 1.5 m, a perfect lane (a paid,
  free or ghost lane run without a stumble and every low coin) gives 1 m back (max 9 m), and it creeps
  back to 6 m at 0.12 m/s two seconds after the last stumble. At 0.8 m it catches you: a life (3), and
  it falls back to 6 m with 1.5 s of grace. The HUD's gap meter reddens and the screen's edges darken as
  it closes; its rumble gets louder.
- **Hazards:** stone blocks (jump: feet over 0.85 m), low beams across the hall (roll), fire-jet pillars
  (their flame fills the lane: step out, or Kiro's shield), spike tiles (level 2+: up 600 ms of every
  1.5 s), broken tiles (level 3+: a rumble wave rolls out of the boulder every 3.5 s for 26 m; a tile it
  passes falls 0.5 s later; a grounded hero on the pit falls: a life), side-ramp boulders (level 4: they
  roll across the hall once you are 13 m away). A stumble: 45 % speed for 0.7 s, the combo broken.
- **Hero roles (the card):** Riko's dash into a gate's cracked side wall is a free toll into the fast
  lane; Nami's double jump reaches the ledge coins over the slow lanes (out of a single jump's reach);
  Kiro's shield walks through the fire jets and takes a knock; Zuno's magnet pulls the hidden coin veins
  out of the walls (8-10 coins each); Vexa's phase opens the ghost gate, a hidden toll-free passage with
  coins and a shard (its traps skipped). Every level has a route for each power, and every relic orb sits
  in a toll lane any hero can pay for.

## Levels (the card)

| Level | Speed | Gates | Twist |
|---|---|---|---|
| 1 Temple Entry | 8 m/s | 3 | three beats: a coin line then a 5-coin gate; a 15-coin gate no plain run can afford yet (tested); a rich stretch, then pay or bank |
| 2 Coin Hall | 9 m/s | 4 | gates in pairs (a cheap and a dear toll), spike tiles on a 1.5 s rhythm |
| 3 Broken Floors | 9.5 m/s | 4 | the rumble drops the broken tiles; the 50-coin jackpot gate |
| 4 Rolling Hazards | 10.5 m/s | 5 | side-ramp boulders; price surges |
| 5 Temple Sprint | 11 m/s | 2 + the arena | Coilstone, the Temple Serpent |

## Coilstone (level 5)

World 3's shared guardian (`m2CoilstoneHead` + a chain of `m2CoilstoneSegment` looping overhead, also
used by 34 and 36), through `menu2/boss`, 9 hp. It replaces the boulder at the boss start (its head
chases at the same gap). The arena spawns a section every 40 m ahead while it is up: a 10-coin line and a
toll at its plane.
- **Lunge** (2 hits): it hisses and marks a lane with dust; 1 s later it lunges there (a stumble that
  costs 3 m). Pay a bell gate in the middle lane (20 coins): the bell flies back and drops on its head
  while it recoils.
- **Coils** (2 hits): its body coils across the lanes ahead, low (jump) and high (roll) in turn; bells
  now cost 30.
- **Grand Gate** (5 hits): a straight sprint past rows of offering bowls; every 10 coins paid cracks a
  plate.
A paid bell or bowl queues a hit that lands at the next open window (one a window). Slow-mo, the plates
shatter, it turns green and slides away over the wall; the grand gate stands 45 m ahead.

## Scoring

The card's board: **banked coins x 2**, and on a win **+ the finish bonus** (150 / 200 / 250 / 300 /
400) **+ the time bonus** (one point per 0.1 s under the par time: 58 / 64 / 66 / 66 / 95 s). A lost run
(the third life) and a time-up (the level's clock: 120-240 s) score the bank x 2. The bank counts up to
the level's cap (`bankCap`, below). The Scene keeps the store's score at `scoreOf(run)`; `finalScore`
submits it with the played time.

## Server limits and why they hold

- **The speed guard.** `speedNow` is the level's speed, times 0.9 in a slow section and 0.45 in a
  stumble, plus inside a gate's section that lane's toll boost (1.5 / 2.5 m/s); nothing else adds
  speed (Riko's dash is a burst for the wall, not a speed boost). So `runFloorMs` (each metre at the
  level's speed, or in a gate's section at the speed plus that gate's best boost) is the least time to
  any z, and the finish's floor `minFinishMs` follows. Tested every ms with mashed powers.
- **Level 5's floor.** The larger of the boss machine's own least time after the boss start and the
  coins: every hit needs its own paid arena section (one payment per plane), so the last of 9 payments
  is at section 8's plane at the earliest, and the grand gate then stands 45 m further on.
- **The bank.** `heroBankBound(course, hero)`: every common coin the hero can reach (the veins only for
  Zuno) plus, at each gate, the best of its lanes (a slow lane's coins, the ledge coins only for Nami,
  the ghost passage only for Vexa; a toll lane's coins less its price, or free for Riko at a cracked
  wall), ignoring whether it could afford the toll. `bankCap` is the best hero's; level 5's arena coins
  are for paying (`ARENA_BANK` 0).
- **maxScore** = finish bonus + 2 x bankCap + the time bonus at `minFinishMs`, plus 3 %, rounded up to 10.
- **base + maxPointsPerSec x s:** a run that ends at `t` before `minFinishMs` can only be a lost run (or
  a time-up), worth 2 x the coins within vMax t + 5 m of the start; from `minFinishMs` on, maxScore.
  `proposeLimits` covers that bound at every 250 ms (+3 %), and a test checks it at every 100 ms.
- **Duration:** 1 s to the level's clock (a run can be lost early; the clock ends it).

| Level | maxScore | min / max ms | base | pps |
|---|---:|---|---:|---:|
| 1 | 480 | 1000 / 120000 | 21 | 12 |
| 2 | 610 | 1000 / 130000 | 36 | 14 |
| 3 | 710 | 1000 / 140000 | 38 | 16 |
| 4 | 690 | 1000 / 150000 | 27 | 14 |
| 5 | 910 | 1000 / 240000 | 38 | 15 |

Meta, `arcade-games.json` (dev, `enabled: false`) and the pinned test move together.

### What the bots reached

| Bot | Result |
|---|---|
| Honest bot (weighs each gate's lanes, steers for coins, jumps / rolls / dodges, uses each hero's power at its gate) | wins every level with every hero at 30 / 60 / 144 Hz inside every limit; Kiro 73-82 % of maxScore (L1 82 %, L2 74 %, L3 75 %, L4 73 %, L5 73 %), the best hero 78-84 % |
| Every hero with its power mashed | every run inside every limit (`proof.test.ts`) |
| Through the real store, ragged frames | a ranked points run inside the limits, the store's score = the run's |
| Spam (40 per level, any hero, random presses, yaws, power mashed, 4-50 ms frames) | every end (win, lost, time-up) inside the limits and under `scoreBoundAt` |
| Idle (no input) | runs on, pays the first toll it can, ends below the bot |

Mutation probes: a 30 % faster level or a doubled finish bonus breaks its maxScore; no level's row
matches another level's course.

## Stars, combo, secrets

- **Stars:** clear; all 3 relic orbs (each in a toll lane, or in the run-up on level 1 / 5); finish with
  the bank target (20 / 30 / 35 / 40 / 30 coins). The badge: no stumble.
- **Secrets:** Vexa's ghost-gate shard (every level), "Pauper's Run" (finish without paying a single
  toll; Riko's free toll counts as not paying; level 5's bells and bowls are not tolls), level 3's
  jackpot room.
- **Restore:** the canopy beyond the walls turns from grey to green as the gates are passed (and as
  Coilstone's plates crack).

## Multiplayer (1-4)

Parallel corridors, one shared camera (desktop and tablet), the same seed. **Versus:** the coins are
shared (a coin one hero grabs is gone from every corridor) and a toll lane one hero pays stays open 2 s
for whoever comes through it next: a free pass. **Co-op:** one shared purse everyone pays from; Kiro's
shield, Zuno's magnet and Vexa's phase cover the team. Never ranked.

## Models

`public/models/3d/temple-coin-rush/`: `m2TempleGate`, `m2TempleCoin`, `m2OfferingBowl` (NICE, today's),
`m2RollingBoulder`, `m2StoneObstacle`, `m2SpikeTrapTile`, `m2BrokenTile`, `m2FireJetPillar`,
`m2StepPyramidBg` (ready/menu2/temple-coin-rush), and `m2CoilstoneHead`, `m2CoilstoneSegment`
(ready/menu2/shared: World 3's shared boss, 15k triangles each, the character budget). World 3's set
already shipped with temple-lantern-jump is reused by its manifest urls (no copy): `m2TempleBeam` (the
low beams), `m2TempleLedge` (Nami's ledges), `m2StoneBrazier` (the wall-top fires),
`m2TempleTowerBg`. Code parts: the side walls (a carved-sandstone canvas texture with a jade band and
moss), the canopy, the pillars, dividers and portcullis bars, the flames, the chevrons, the relic gems,
the bells, the pits. GLB coins near the hero (40), cheap gold discs beyond.

## Tests and playtest

- `rules.test.ts` (40), `proof.test.ts` (17), `orbit.test.ts` (6), `multiplayer.test.ts` (6),
  `hero.test.ts` (3), `assets.test.ts`: green, with `registry.sync`, `modelManifest` and
  `ShellOverlays` (278 tests in 11 files, 2026-10-29); `tsc` clean.
- Headless Chrome on `next dev -p 3311`, `?autoplay=1`: 1280 x 800 (mouse drag / wheel orbit) on all
  five levels, and 390 x 844 (two-finger orbit, pinch) on levels 1, 3 and 5. Every run reached the
  result card except one desktop level 2 run cut off by frame stalls from other processes at 49.6 s
  of game time; L1 392 pts, L3 529, L5 664 (all three stars). 0 console errors; 20-46 draw calls;
  135-260k triangles, about 305k on level 5; p50 16.7 ms.
- Fixed after looking: the gates sink into the floor (the GLB is a closed door), chevron arrows, the
  price badges above the lintel, a passed gate's frame is gone (the camera behind it would look at
  its lintel), the boulder and Coilstone's head in the lower foreground (never round the camera),
  Coilstone's body coiling along the left wall's top ahead of the hero, a lathed bronze bell, a
  compact gate card and a short boss name on phones.

## Open issues

- No production `next build` ran.
- Level 5 peaks at about 305k triangles (two 15k-triangle Coilstone GLBs, 8 rings); the phone tier
  draws 5 rings.
- The rumble wave is a translucent band; a dust stream would read better.
- On a portrait phone the boulder looms large in the lower third (the orbit stands farther back).
- No thumbnail yet (`public/images/3d/temple-coin-rush.webp`, meta `thumbnail: null`).
- Multiplayer is covered by unit tests only.
- The shared Coilstone chain lives in this game folder; World 3's other two Coilstone games (34, 36)
  should lift it into `menu2/boss`.
