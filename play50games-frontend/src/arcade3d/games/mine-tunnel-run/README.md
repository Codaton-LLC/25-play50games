# Mine Tunnel Run — Menu 2 #12 (World 1 Ember Heights)

Dig and drop: bore your own tunnel down through a side-on cross-section of a mine, and drop the
boulders you loosen exactly where you want them. Reach the lift at the bottom. Lead hero Riko
(`defaultHeroFor`). Status `dev`; the backend row stays `enabled: false`. Order 64 (Menu 2 orders
56-63 are taken by the parallel builds, 65 is robot-factory-run): `registry.sync.test.ts`'s
"order = position" check passes once those games sit before it.

## Signature mechanic

- A cell grid, 20-24 cells wide and 40-64 deep (`levels.ts`, ASCII maps). A cell is 1.6 m, so the
  1.45 m hero fits a one-cell tunnel; speeds follow the card in m/s.
- Moving into soil digs it (soft 0.2 s, packed 0.5 s, ore 0.45 s with its orb; rock never). A dig only
  clears the cell: the stick walks you in, gravity drops you after a down dig. Up digs up.
- Walk 6.5 m/s, a roll at 9 m/s after 0.35 s of running in an open tunnel, a hop of two cells with a
  short hang and two air moves, a step up onto one-cell ledges, Down in the air = roll-drop (22 m/s).
- A boulder with an open cell under it wobbles 0.8 s, then falls: it crushes beetles, breaks cracked
  floors, hits Rockjaw, and crushes the hero (back to the last lantern). It never seals the lift.
- Lanterns are checkpoints and light the dark; a boxed-in hero is dug out to the last lantern after 2 s.

## Levels

| | Twist |
|---|---|
| L1 Dry Tunnel (90 s, 20 x 40) | the card's three beats: dig down to a lantern; a boulder over your path rumbles when you dig its floor (step aside); drop a boulder down a chute onto the beetle guarding the lift |
| L2 Pipe Zone | three rail lines: dig into one and a cart carries you to its far end at 10 m/s |
| L3 Water Gaps | sealed water pockets: breach one and it floods your tunnels a cell every 0.3 s (slows you, puts out lanterns) |
| L4 Fast Tunnel | after 15 s the roof collapses from the top, a row every 0.6 s (rubble; lanterns below the line are the checkpoints); tunnelling beetles carve paths |
| L5 Deep Mine Sprint | Rockjaw, the Tunnel Beetle (the drained cave beetle x5, grey) |

**Rockjaw** (`progression.ts` ROCKJAW, shared `menu2/boss`), in the arena at the bottom: a gallery
above a chamber, four boulders sitting on soil plugs over open chutes.
1. *Ceiling drop* (3 hits): it charges along the chamber and stops sniffing under the plug nearest
   you: dig that plug from the gallery and the boulder falls on its shell. The hopper refills a plug in 3 s.
2. *Burrow* (2 hits): it burrows; a 1 s dust patch marks your column; it erupts through the gallery
   floor there. Step two cells off, then drop the boulder beside it on its back.
3. *Flipped* (3 hits): the ceiling gives, the chutes stand open; drop into the chamber, hop beside it
   and drift onto its belly holding Down (roll-drop). Slow motion, the ore glows, the lift opens.

## Heroes

| | Power | Route |
|---|---|---|
| Riko | dash bores four cells at once, smashes cracked rock | the sealed vaults behind cracked rock (secret 3 on L1, L2, L4, L5), cracked bands as shortcuts |
| Nami | double jump (four cells) | the sealed air pockets high over a shaft (the sticker, secret 2) |
| Kiro | shield: one boulder / gas / bite; water does not slow it | gas pockets as shortcuts; the L3 flooded room's shard only counts under the shield |
| Zuno | magnet pulls orbs within 2 cells, through rock | the orb trails sealed in rock beside shafts |
| Vexa | phase through ghost rock | the ghost-rock shafts to the shard (secret 1) |

## Scoring (a time game)

The submitted time is the finish ms minus 0.4 s per orb and the flow bonus (`runTimeMs`); the score is
`(timeBase - time) / 10`, server-side. Limits per level (`PROPOSED_LEVEL_LIMITS`, `proposeLimits`):
`minDurationMs` = the fewest cells from the start to the lift (rock and bedrock are walls; soil, ore,
gas, cracked and ghost rock, boulders and water all passable) x 70 ms (the dash bore, the fastest
crossing), on L5 the gallery's cells plus Rockjaw's fastest defeat, minus every orb and the most flow
bonus, rounded down to 100 ms. No power, dig order or tunnelling beetle can beat it.

## Files

`levels.ts` (maps, parser) · `rules.ts` (the world, heroes, boulders, beetles, water, rails, rockfall,
Rockjaw, limits) · `progression.ts` · `bot.ts` (Dijkstra planner + the Rockjaw script; proofs and the
preview-only `?autoplay=1`) · `coach.ts` · `Scene.tsx` · `Grid.tsx` (instanced terrain, canvas textures
in `textures.ts`) · `Props.tsx` · `Boss.tsx` · `Hero.tsx` · `World.tsx` (surface, framing rock) · `Hud.tsx`.

## Tests

`rules.test.ts` (digs, boulders, floods, rails, rockfall, every power, scoring, the coach),
`levels.test.ts` (maps, reachability, secrets, backend sync, progress), `proof.test.ts` (all heroes x
30/60/144 Hz through the real store inside the limits, power and random-input spam, the rows read
their level), `assets.test.ts`, `multiplayer.test.ts`.
