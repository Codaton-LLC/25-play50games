# Color Bridge Builder (Menu 2, game 39, World 6 Prism Fortress)

Card: `docs/menu2-super/world-6-prism-fortress.md` "### 39 Color Bridge Builder" (branch
`claude/m2-super-plan`). Order 98, owner claude, status `dev`. World 6 has no lead hero: the picked hero
is the one you start as, and Tag swaps to any of the five during the run.

## The game

A light puzzle across a canyon seen from above (one cell = 2 m, `levels.ts` maps). Energy nodes shoot
colour beams; a beam that reaches an anchor turns every chasm cell it crosses into a light bridge of its
colour. Where beams cross, the colour after the crossing is the mix (a union of red 1, blue 2, yellow 4):
red + blue purple, blue + yellow green, red + yellow orange (flickers 0.8 s on / 0.8 s off), all three
white. Only the hero of a bridge's colour walks it: Riko red, Nami blue, Zuno yellow, Vexa purple, Kiro
green; orange and white are anyone's. The wrong hero (or the chasm, or orange in its dark beat) drops the
hero; it is back on its last rock cell a second later.

- Switches (walk onto one) cycle their node's colour (some include "off"); L4's timed node shines 10 s.
- Prisms turn a beam 90°; walking into one rotates it (once per push).
- Tag (Space / the Tag button): to the hero the cell ahead needs, else the next hero. Tagging during a
  step lands the new hero on the new cell: that is how you cross a red-to-purple seam mid-bridge.
- Powers (E / Enter / Power): Riko dashes 3 cells (gaps, cracked rock), Nami leaps 2, Zuno's magnet pulls
  the prism ahead (2-4 cells) one cell closer, Vexa walks any light for 1.5 s (orange's dark beat too),
  Kiro's shield (3 s) blocks a beam at his cell.
- Drones (L4) swallow the beam they fly through: the bridge behind them goes dark while they pass.

| Level | Twist | Bot |
|---|---|---|
| 1 Two Switches | the card's three beats: red bridge (Riko), a dark node switched to blue (Nami), red crossing blue into purple: tag Vexa mid-bridge | 10.3 s |
| 2 Prisms | bump a prism to aim yellow (Zuno); blue crossing yellow into green (Nami then Kiro); the green ledge's sticker | 10.6 s |
| 3 Split Bridge | red + yellow = flickering orange; two half-bridges side by side; yellow (orange) or blue (purple) at the top; Vexa's phase over the flicker gap to the shard | 10.7 s |
| 4 Timed Bridge | two drones over two bridges; a node lit 10 s from a far switch; Riko's dash through cracked rock to the shard | 12.9 s |
| 5 Canyon Gate | a purple approach, then the Bridge Keeper | 18.8 s |

**The Bridge Keeper** (`progression.ts` KEEPER, 6 hp, m2BridgeKeeperBoss): its plate takes the middle
node's beam, which crosses the blue and the yellow beams on the way, so the three switches set the
colour the plate gets. Each window it wants one colour: red, blue, yellow (P1), purple, green (P2, its arm
laser greys a node for 4 s each cycle), white (P3); between windows it stomps the row you stand on (Kiro's
shield rides it out). The gate opens when it falls.

Secrets: flicker-gap shard (L3), green-ledge sticker (L2), cracked-rock shard (L4, Riko). Stars: clear,
all orbs, the target time (75 / 100 / 120 / 140 / 150 s); the result adds a "Never fell" badge.

## Files

`levels.ts`, `rules.ts` (pure, 120 Hz; beams recomputed each quantum), `progression.ts`, `bot.ts` (a plan
per level: colour a node, turn a prism, walk (shortest path over cells some hero can stand on, tagging one
step ahead or mid-step), wait for a drone or an orange beat, use a power; L5 answers the plate; crew mates
follow the lead and never touch switches), `coach.ts`, `Scene.tsx`, `Board.tsx`, `Heroes3D.tsx` (the
active hero, re-made on a Tag), `Keeper.tsx`, `Hud.tsx` (active hero, colour here / ahead, mix table,
the plate's wanted / received colour), `StarResult.tsx`, `MultiplayerHud.tsx`, `levelEnd.ts`, `look.ts`,
`assets.ts`.

Models (no credits spent): from `p50-assets\hyper3d-new` m2BridgeKeeperBoss (15k tris, 402 KB, inside the
character budget), m2ColorSwitch, m2BridgeAnchor, m2EnergyNode, and from `hyper3d-recovered`
m2CrystalSlabBridge (the light bridge cells, tinted per colour), m2BrokenBridgeEnd (in the folder, not
drawn yet), all optimized with `tools/hyper3d/src/models.mjs` `optimizeGLB` (props 4000 / 3000 tris,
512 px WebP); ready/menu2 m2BridgePylon (the gate), m2FloatingRockIsle and m2CanyonBg (around the
canyon), m2LaserPrism (laser-maze-run), m2FactoryDrone (shared, 18k tris: character budget, as in the
other games that use it). Rock isles are code slabs (terrain).

## Scoring

Time game. Submitted ms = finish - 400 ms per orb - the flow bonus; score = (timeBase - ms) / 10. Lower
bound (`minFinishMs`): the start-to-exit cell distance at a dash's 100 ms a cell, plus on L5 the Keeper's
fastest defeat (`bossMinMs`). Pinned in `meta.scoring`, the `arcade-games.json` row (`enabled: false`)
and `levels.test.ts`; `proof.test.ts` runs every hero at 30 / 60 / 144 Hz through the real store, plus
power / tag mashing and random input.

| Level | timeBase | min ms | maxScore |
|---|---|---|---|
| 1 | 150 000 | 100 | 14 990 |
| 2 | 180 000 | 100 | 17 990 |
| 3 | 200 000 | 100 | 19 990 |
| 4 | 220 000 | 300 | 21 970 |
| 5 | 300 000 | 16 200 | 28 380 |

## Known issues / follow-ups

- The levels are short puzzles (the bot crosses each in 10-19 s); Nami's leap, Zuno's magnet and Kiro's
  shield are in the rules and tests but no level requires them yet. Splitter prisms and the versus
  "Bridge Duel" are not built; multiplayer is a bridge crew on one canyon.
- The loose L1-L4 floors: the orb bonus outweighs the cell-distance bound.
