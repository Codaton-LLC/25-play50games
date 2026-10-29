# Magnet Coin Lab (Menu 2, game 42, World 4 Frost & Sweets)

Card: `docs/menu2-super/world-4-frost-and-sweets.md` "### 42 Magnet Coin Lab" (branch `claude/m2-super-plan`).
Order 82, owner claude, status `dev`, lead hero Zuno (`defaultHeroFor`).

## The game

A side-view room puzzle with one signature verb: **flip your polarity**. Tap Action to switch between
**+** (drawn as a ring) and **-** (a bar); hold it past 400 ms for the hero power. Each level is a row of
small rooms (24 x 10 m ASCII maps in `levels.ts`); a room is cleared when its quota of coins is in the
piggy bank, and its door opens to the next one.

- **Pads.** A hanging node of the opposite sign pulls the hero (range 7 m) and latches it; Jump lets go
  (the node stays off until the hero lands). A floor pad of the same sign launches the hero 8 m up.
  Floor pads never pull.
- **Coins.** Walking past a pile pulls its coins one by one into a swarm (up to 30) that lags behind on a
  spring, catches on corners, and falls into pits; a lost coin returns to its pile after 3 s. The swarm
  shares the hero's sign, and the pad field that carries the hero carries the swarm too.
- **Gates** let one sign through, hero and coins alike (a coin caught halfway through a gate when its sign
  flips slips out).
- **Metal blocks** slide on their row: a same-sign hero pushes them, an opposite one pulls them; a - hero
  standing on one rides it (rails hold a block over a gap that the hero falls through). A block pushed
  into a vent opens the room's hidden walls.
- **Drones** hunt the biggest swarm and steal coins; a + hero within 2.5 m blasts a drone back and its
  coins fall loose. A drone that gets home with a load drops it down the recycler (the coins go back
  to their pile).
- **Spark floors** sting and scatter the swarm.

Levels (5 / 5 / 5 / 5 / 3 rooms):

| Level | Twist | Rooms |
|---|---|---|
| 1 Basic Magnet | the three beats: follow + bank, pull across, launch up; then pull-then-launch, a hop with Nami's shelf | 5 |
| 2 Two Poles | gates: pass as +, flip for the pad; two gates; - gate + - pad (Vexa's storage room); spark floor; gate maze | 5 |
| 3 Moving Metal | push a block out over a rail gap and hop it; push it to a step; push it into a vent (vault shard); ride a block across a long gap; ride it into a vent | 5 |
| 4 Drone Lab | one drone; two drones over a gap; glass vault (Zuno's sticker); the hangar (three drones + launch); drones over a gap with Riko's cracked alcove | 5 |
| 5 Scrap Magnus | the forge corridor (launch + node), the slag line (- gate, - pad), the arena | 3 |

**Scrap Magnus** (`progression.ts` MAGNUS, 7 hp, the shared menu2 boss machine):
- P1 Tug (3 hits): his sign swaps at the start of each slam (the HUD ring shows it). A hero of his sign
  rides the slam's shove; an opposite one is hurt. When his core opens, flip to the opposite sign and his
  field yanks you into his chest.
- P2 Block storm (3 hits): he hurls a metal block; as - you catch it within 3 m and hold it over your head;
  flip to + while his core is open and it flies back into him. An armour block flies off per hit.
- P3 Core (1 hit): his core rises 4.6 m; + on a floor pad launches you into it.

Hero roles: Zuno's overcharge doubles every field (coins through glass, the sticker behind glass);
Riko's dash breaks cracked glass (spare coins in L4) and makes a 1.5x launch; Nami's double jump
(always on) reaches the spare-coin shelf in L1; Kiro's shield crosses spark floors and takes one hit;
Vexa phases through ghost walls (the storage-room shard in L2).

Secrets: storage-room shard (L2, Vexa), prototype magnet sticker (L4, Zuno only), vent-vault shard (L3,
behind the hidden wall). Stars: clear, all orbs, the card's par (90 / 120 / 150 / 170 / 180 s); the result
adds a "Not a coin lost" badge.

## Files

`levels.ts` (maps + parser), `rules.ts` (pure, 120 Hz fixed step, every hero and room), `progression.ts`
(combo, secrets, Magnus, stars), `bot.ts` (the honest bot: inputs only, a step plan per room, Magnus by
his coach lines; used by the proofs and by `?autoplay=1` in preview builds), `coach.ts`, `Scene.tsx`,
`Room.tsx` (tiles in instanced layers rebuilt only when a tile/door/vent changes, pads, gates, bank,
pickups, blocks, drones, decor), `Coins.tsx` (all coins: 2 draw calls), `Hero.tsx` (shared animator + the
sign halo, flip ripple, pull stretch, power looks), `Magnus.tsx`, `World.tsx` (the workshop hall, snow,
lights), `Hud.tsx`, `StarResult.tsx`, `MultiplayerHud.tsx`, `levelEnd.ts`, `look.ts`, `space.ts`
(room k is drawn at x = 30 k), `assets.ts`.

Models (ready/menu2/magnet-coin-lab, no credits spent): m2MagnetPad, m2HorseshoeMagnet (nodes; Magnus's
head, re-materialled grey steel), m2MetalBlockV2 (blocks; Magnus's body), m2LabDrone, m2ToyPiggyBank
(the bank), m2PolarityGate (gate frames), m2LabMachineBg, m2LabPlatform, m2LabPlatformV2 (decor).
m2SilverCoin (3k tris) is not used: up to ~70 coins are drawn as a code disc with a brass rim.

## Scoring

Time game. Submitted ms = finish - 400 ms per orb - the combo (flow) bonus; score = (timeBase - ms) / 10.
The lower bound (`minFinishMs`): per room, the longer of the start-to-door line at the hero speed cap
`V_MAX` (every hero move is clamped to it) and the nearest pile-to-bank line at the coin cap
`COIN_V_MAX`; the arena adds Magnus's fastest defeat (`bossMinMs`). `minDurationMsOf` takes the orb and
combo bonuses off. Limits (`PROPOSED_LEVEL_LIMITS`, pinned in `meta.scoring`, `arcade-games.json` row
`enabled: false`, and `levels.test.ts` via `serverSyncProblems`):

| Level | timeBase / max | min ms | maxScore | bot (60 Hz) |
|---|---|---|---|---|
| 1 | 180 000 | 100 | 17 990 | 18.4 s |
| 2 | 240 000 | 100 | 23 990 | 22.3 s |
| 3 | 300 000 | 100 | 29 990 | 25.9 s |
| 4 | 320 000 | 100 | 31 990 | 24.5 s |
| 5 | 360 000 | 15 000 | 34 500 | 30.1 s |

The L1-L4 floors are loose (the orb bonus alone is larger than the geometric bound), but honest: no
run can submit less. `proof.test.ts` runs every hero at 30, 60 and 144 Hz through the real arcade store,
plus Action mashing and random input, and checks every submission against the pinned row.

## Known issues / follow-ups

- Co-op in L3 is hard: four heroes of mixed signs push and pull the same blocks (the multiplayer test
  covers L1 and L2). The card's co-op "magnetic pair" rooms and the versus/party modes are not built;
  multiplayer is the shared race / co-op of the other Menu 2 games.
- The card's P3 asks for three chained pad launches; the arena has two floor pads and one launch hits.
- The min-duration floors could be tightened by a path-length bound per room.
