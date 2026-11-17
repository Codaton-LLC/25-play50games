# Mirror Dash (Menu 2, game 33, World 5 Neon Cosmos)

Card: `docs/menu2-super/world-5-neon-cosmos.md` "### 33 Mirror Dash" (branch `claude/m2-super-plan`). The
master plan's original "route memory" concept is dropped on purpose, as the card says (28 Crystal Tower
owns memory in World 5). Order 88, owner claude, status `dev`, lead hero Vexa (`defaultHeroFor`).

## The game

Two 3-lane runways (lanes 1.4 m) run side by side, split by a mirror wall. The hero runs the left one, a
glass **reflection** (the same hero GLB in a violet glass material, mirrored) the right one. **One input
drives both**: a lane change is mirrored (you go left, it goes right), jumps and slides are copied. The
obstacles differ on each runway, so the player looks for the one input that saves both bodies.

- Obstacles: blocks (dodge), cracked blocks (Riko's dash breaks them), hurdles (jump), slide bars,
  lasers (dodge; Kiro's shield / Vexa's phase pass), ghost glass (only Vexa's phase passes).
- A hit **cracks** the pair (both slow to 55 % for 0.6 s, 0.9 s grace); the third crack **shatters** it
  back to the last checkpoint gate, where cracks heal. A row with obstacles on both runways cleared with no
  crack is a **Twin Perfect** (flow bonus).
- Zones (the wall shows them): **merge** (the runways become one road; the two inner lanes touch, the
  bodies must not meet), **frosted** (milky wall: the reflection copies instead of mirroring), **echo**
  (pulsing wall: the reflection repeats the input 0.5 s later).
- Speeds 9 → 13.5 m/s (L1 and L2 stay at or under 11.5 m/s for phones).

| Level | Twist | Speed (m/s) | Bot (60 Hz) |
|---|---|---|---|
| 1 Mirror Lane | the card's three beats: your side, the reflection's side, both | 9 → 10.5 | 42.6 s |
| 2 Converge | merge zones | 10 → 11.5 | 37.1 s |
| 3 Frosted Glass | frosted zones (copy) | 11 → 12.5 | 36.2 s |
| 4 Echo | echo zones (0.5 s late) | 11.5 → 13 | 38.4 s |
| 5 Glass Hall | every zone, then the Glass Sentinel | 12.5 → 13.5 | 45.3 s |

**The Glass Sentinel** (`progression.ts` SENTINEL, 5 hp, the shared menu2 boss machine; the
m2GlassSentinelBoss GLB, ~44 m ahead of the pair):
- P1 Pane rain (1 hit): it hurls panes onto both runways at mirrored lanes (one lane open), then stoops:
  jump through the knee-gem over the middle lanes.
- P2 Shield pane (3 hits): its shield pane stands over one runway; the other body jumps through the gem
  in the lane it shows.
- P3 Chest crystal (1 hit): the runways merge; both bodies jump as the closing ring reaches them.

Hero roles: Vexa (lead) phases both bodies for 0.8 s (ghost glass, the ghost-runway shard on L4); Riko's
dash (x1.5, 0.32 s) breaks cracked blocks on both runways (the shortcut sticker on L2); Nami's double jump
is copied by the reflection; Kiro's shield covers both bodies for 1 s; Zuno's magnet pulls orbs from both
runways (two lanes either side, 9 m ahead) for 3 s.

Secrets: ghost-runway shard (L4, Vexa), shortcut sticker (L2, Riko), frosted-zone shard (L3, on the
reflection's side inside a frost zone). Stars: clear, all orbs (half on the reflection's side), target
time (50 / 55 / 55 / 55 / 80 s); the result adds a "Flawless Reflection" badge (no crack).

## Files

`levels.ts` (rows + parser), `rules.ts` (pure, 120 Hz fixed step, pairs, zones, cracks, the Sentinel),
`progression.ts`, `bot.ts` (the honest bot: for each new row ahead it tries every plan for the next two
rows (hero lane, held-late lane changes, a reflection-only nudge against an edge, jump / slide) on a copy
of the world with the same controller it plays, and keeps the one with fewest cracks and most orbs; used
by the proofs and by `?autoplay=1`), `coach.ts`, `Scene.tsx` (input mapping: presses, swipes, a stick
flick), `Track.tsx` (runways (code glass tiles on a brass frame: m2RunwayPlatform is 3k tris a tile, over 1M on screen), the zone-tinted mirror wall, obstacles, orbs, secrets, gates, finish, panes),
`Bodies.tsx` (hero + glass reflection), `Sentinel.tsx`, `World.tsx` (hall, stars, light), `Hud.tsx`,
`StarResult.tsx`, `MultiplayerHud.tsx`, `levelEnd.ts`, `look.ts`, `assets.ts`.

Models (ready, no credits spent): m2MirrorStand, m2HazardBlock (also the cracked look
and the Sentinel's panes), m2MirrorHallBg, m2MirrorGate (checkpoint gates), m2GlassSentinelBoss (15k tris,
794 KB: inside the character budget, tested as such), m2LaserWall and m2NeonSpikeBlock (neon-cube-jump),
m2Crystal (crystal-tower, the orbs).

## Scoring

Time game. Submitted ms = finish - 400 ms per orb - the flow bonus; score = (timeBase - ms) / 10. Lower
bound (`minFinishMs`): the course length at `V_MAX` (the top course speed with a dash, faster than any
pair moves), plus on L5 the Sentinel's fastest defeat (`bossMinMs`) and the exit run.

| Level | timeBase / max | min ms | maxScore |
|---|---|---|---|
| 1 | 150 000 | 15 700 | 13 430 |
| 2 | 170 000 | 14 400 | 15 560 |
| 3 | 180 000 | 16 500 | 16 350 |
| 4 | 190 000 | 18 500 | 17 150 |
| 5 | 240 000 | 22 900 | 21 710 |

Pinned in `meta.scoring`, the `arcade-games.json` row (`enabled: false`) and `levels.test.ts`
(`serverSyncProblems`). `proof.test.ts` runs every hero at 30, 60 and 144 Hz through the real store, plus
power mashing and random input, against the pinned rows.

## Known issues / follow-ups

- Multiplayer is one pair per player on its own copy of the course (a race, or co-op where everyone must
  finish). The card's true co-op (each player drives one body) and split screen for 3-4 players are not
  built.
- Vexa's card power swaps the reflection through the wall to "ghost routes"; here it phases both bodies
  for 0.8 s (ghost glass, obstacles), which is simpler to read.
- The reflection's glass look swaps the hero GLB's materials on the copy; the mirrored scale (-1 on x)
  needs the double-sided glass material.
