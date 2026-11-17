# Paint the Platforms (Menu 2, game 25, World 6 "Prism Fortress")

An area-painting challenge in the Prism Fortress's drained courtyard. Every tile the hero runs over takes
the hero's colour; a level is won when its target share of the arena is painted before the card's
timer runs out. World 6 has no lead hero: the start card preselects the player's last pick, else Riko.
Order 94, status `dev`, owner claude, a **time** game. Design card:
`docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 25 — Paint the Platforms" (30 % to
80 %, 60 s to 120 s); the World 6 notes ("25 Paint the Platforms": set lines, the roller, eraser
drones) shaped the hazards. The W6 hero tag-switch (`heroTag`) does not exist in the shared code yet:
each run plays one hero, picked on the start card.

## Files

- `levels.ts` the five level rows (goal, timer, target, which hazards); `course.ts` the platforms cut
  into 2 m tiles on one fixed lattice, rims, rafts and their docks, grey blots' loops, paint blobs,
  Vexa's glass cage, Nami's pillar, the Blob's pedestal, and the links the bot crosses.
- `rules.ts` pure deterministic rules (1 ms steps): running, jumping, painting, rows setting, blots,
  the roller, rafts, the Paint Blob, the bound (`freeSources`, `minPathM`, `minFinishMs`,
  `proposeLimits`).
- `bot.ts` an honest player: nearest grey tile first (rows nearly full first), links to other
  platforms (gap jumps, raft docks), clear of blots and the roller's lane, out of slam rings, splats the
  open Blob.
- Scene: `Scene.tsx`, `MultiScene.tsx`, `World.tsx` (the fortress), `ArenaView.tsx`, `Boss.tsx`,
  `Hero.tsx`, `camera.ts`, `look.ts`, `assets.ts`, `Hud.tsx` (the paint panel and mini-map; `live.ts`
  feeds the mini-map), `StarResult.tsx`, `levelEnd.ts`.
- Tests: `rules.test.ts`, `proof.test.ts`, `assets.test.ts`, `multiplayer.test.ts`, `orbit.test.ts`.

## Rules

- Run 6 m/s (camera-relative stick), jump 2.6 m. The tile under the hero (while he stands on it) takes
  his colour. Action fires the hero power; on level 5, beside the open Blob, it splats it.
- A full row of one platform **sets**: it glows and nothing wipes it again.
- Paint blobs splash their tile and the four next to it.
- Grey blots (L2+) crawl fixed loops and wipe the unset tile they move onto; touching one stuns you.
- Rafts (L3) wait 1.5 s at each dock and cross at 2 m/s; they carry you, and their tiles count.
- The roller (L4) glows a two-row lane of the big court for 1.5 s, then rolls across it, wiping unset
  paint and stunning whoever is in it.
- A fall puts you back on the last fixed platform you stood on; your paint stays.

## Hero powers

| Hero | Power |
|---|---|
| Riko | dash: 4 m in 0.2 s (cooldown 1.2 s): a fast streak |
| Nami | double jump: the gold blob on the 4 m pillar (a sticker) |
| Kiro | shield 1.5 s: a blot he touches freezes 3 s, the roller stops on him, the slam passes him |
| Zuno | magnet 3 s: paint blobs come to him from 5 m |
| Vexa | phase 0.8 s: into the glass cage (a shard), through the blots |

## Levels

1. First Strokes: one 8 x 7 courtyard, paint 30 % in 60 s.
2. Grey Blots: two courts and a bridge, a blot on each, 40 % in 75 s.
3. Moving Tiles: three islands and two tile rafts, 50 % in 90 s.
4. Time Attack: a 8 x 8 court with the roller and a side court each way across 2 m gaps, three blots,
   65 % in 105 s.
5. 80% Master: the Paint Blob's 10 x 10 court (the pedestal takes the middle four tiles), two blots,
   80 % in 120 s **and** the Blob popped (6 hp). Its tell drops a dark ring where you stand, then it
   slams and greys every unset tile inside; after a slam its core opens: splat it. P1 slam (2.4 m), P2
   wide slam (3.2 m), P3 twin slam (the ring and its mirror across the Blob).

Secrets: Full mural (every tile painted at once), Vexa's caged prism blob, Nami's gold pillar blob.
Stars: clear, every paint blob, the target time.

## Scoring and server limits (why they hold)

The submitted time is the finish time. The flow chain (fresh tiles, blobs, rows set, Blob hits within
3 s) drives the meter and XP only: painting fast already is the score, and a time bonus would sink the
proven floor. Each level row is `proposeLimits(courseFor(level))`:

- the cells: the hero paints only the lattice cell he stands in; a stretch of path shorter than one
  tile fits in a one-tile square and meets at most 4 cells, so a path of L metres meets at most
  4 (L / 2 + 1) cells (a respawn starts a new stretch but costs 0.8 s, more than its 4 cells are worth);
- the free tiles: a paint blob's splash, a raft's own tiles and every fixed tile within 2.5 m of its
  swept path (stepping off a raft starts a new stretch there). Each source is free only once reached: the
  least over every choice of sources of max(reach distance, cell path for what is left);
- at V_AVG = 6 m/s + Riko's dash average (8.33 m/s), less one more dash's worth (2.8 m); level 5 at
  least the Blob's least defeat time (`bossMinMs`);
- less 6 %, to the 100 ms below; `maxScore = floor((timeBase - min) / 10)`.

| Level | min (ms) | max (ms) | maxScore |
|---|---|---|---|
| 1 | 100 | 60000 | 5990 |
| 2 | 1000 | 75000 | 7400 |
| 3 | 500 | 90000 | 8950 |
| 4 | 1800 | 105000 | 10320 |
| 5 | 13800 | 120000 | 10620 |

The floor is loose by design (the true worst case of a path hopping lattice corners is near 2 cells a
tile, a real run about 0.5).

Honest bot (seed 1, 60 fps, every hero): L1 3.9 s, L2 9.4 s, L3 21.0 s, L4 43.4 s, L5 43.3 s (the Blob
down), no falls.

## Models

`public/models/3d/paint-the-platforms/` (Hyper3D, generated for this game, optimized here with
`assets.spec.json`; the boss through a character entry, its spec kept outside the repo): m2ArenaFloorTile
(599 tris, every tile, tinted), m2ArenaWall (the rims), m2PaintPickup (paint blobs, the caged and gold
blobs), m2PaintBlobBoss (20k tris, the boss; small and grey, the blots). Backdrop: menu2 islandB and
stoneTower. Code: the platform bases, the roller (a moving part), the cage glass, the pillar, the
pedestal, rings and glows.

## Multiplayer (local 2-4)

Co-op "Mural Crew" shares one board (each hero paints in their own colour) and one set of hazards
(stepped by player 1's run; the slam lands on everyone in its ring); versus keeps each player's own
board and ranks by finish time.

## Known issues / open

- No hero tag-switch (W6 `heroTag` is not built): one hero per run.
