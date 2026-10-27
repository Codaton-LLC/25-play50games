# Menu 2 "Color Roll Heroes": super-game framework

Approved by the user on 2026-10-27: "yes I approve them". This document overrides the "same template, new skin" approach used for the first prototypes.

## Why
The old list of 50 reads as 10 vertical jumpers, then 10 runners, then the rest. The look changed but the play did not. From now on, every Menu 2 game must be a game a player would replay for its own sake.

## Story
Shadow Plates, the villain whose model is `m2VillainShadowPlates`, has drained the colour out of the world. The five Color Roll Heroes roll through six worlds to bring it back. Each of the first five worlds restores one hero's colour. The sixth world is Shadow Plates' Prism Fortress.

## The six worlds (all 50 games)
| World | Colour, lead hero | Feel | Games (index #) |
|---|---|---|---|
| W1 Ember Heights | Red, Riko (Dash) | fire, city, factories, mines, speed | 2 Rooftop Roll Climb, 4 Lava Pillar Jump, 12 Mine Tunnel Run, 13 Robot Factory Run, 14 Dragon Cave Rush, 15 Color City Sprint, 43 Roll Cannon Jump, 46 Color Door Sprint |
| W2 Sky & Sea | Blue, Nami (Double Jump) | air, wind, water, height | 1 Sky Tower Jump, 3 Flooded Ruins Escape, 5 Cloud Hopper, 27 Ring Jump Challenge, 37 Plate Surf, 41 Wind Tunnel Escape, 45 Sky Hook Swing, 49 Zipline Rush |
| W3 Wild Temples | Green, Kiro (Shield) | jungle, ancient stone ruins, rhythm, balance | 6 Temple Lantern Jump, 8 Jungle Vine Jump, 16 Temple Coin Rush, 31 Wall Run Temple, 34 Spin Pole Climb, 36 Temple Gong Timing, 40 Disc Target Throw, 47 Tightrope Path |
| W4 Frost & Sweets | Yellow, Zuno (Magnet) | ice, snow, candy, toys, collecting | 9 Ice Peak Jumper, 18 Toy Room Run, 19 Candy World Runner, 20 Snow Slide Dash, 23 Gem Collector 3D, 32 Plate Bounce Arena, 35 Color Rail Grind, 42 Magnet Coin Lab |
| W5 Neon Cosmos | Purple, Vexa (Phase) | neon, space, portals, crystals, mind games | 7 Neon Cube Jump, 10 Space Pod Jump, 17 Alien Lane Escape, 24 Portal Hop, 28 Crystal Tower, 33 Mirror Dash, 38 Laser Maze Run, 44 Crystal Cave Switch |
| W6 Prism Fortress | All colours, all heroes | colour-switch mechanics, arenas, finale | 11 Roll Dash, 21 Color Match Jump, 22 Switch Color Hero, 25 Paint the Platforms, 26 Color Arena Survival, 29 Energy Core Hunt, 39 Color Bridge Builder, 48 Color Orb Defense, 30 Color Boss Tower, 50 Ultimate Color Trial |

Games stay separate, as the user decided. Each one is its own page and leaderboard. The world map is the menu that groups them.

## Pillars: every game must have all of these
1. **One signature mechanic** that no other Menu 2 game uses as its core. Write it in one sentence; if it sounds like another game's sentence, redesign it. Two games may share a genre, such as runner, but never their core verb.
2. **All 5 heroes matter.** Each level has at least one hero-gated route or secret:
   - Riko breaks cracked walls with a dash.
   - Nami reaches high ledges with her double jump.
   - Kiro crosses hazard zones (storm, lava spray, lasers) with his shield.
   - Zuno pulls hidden coin trails out of walls and water with his magnet.
   - Vexa phases through ghost walls.

   Any hero can finish every level. The gated routes give replay value, never a hard block.
3. **3 stars per level:** clear the level, collect every colour orb, and beat the target time. A no-hit bonus counts too.
4. **A level 5 boss**, one of Shadow Plates' lieutenants or a world guardian, with 2 or 3 readable phases. World 6 ends with Shadow Plates himself (game 30, then the finale in game 50).
5. **Juice:**
   - the animated hero, with idle, run, jump, roll, land, hurt and cheer
   - particles on every pickup, hit and checkpoint
   - camera kick on impacts and slow-mo on the boss finish
   - a combo/flow meter that rewards chaining moves
   - sound for every action, and music per world
6. **Secrets:** 1 to 3 hidden things per level, such as colour shards, a hidden sticker or a shortcut. They are found by exploring or by using a hero power.
7. **Teach by playing:** level 1 teaches the mechanic in 3 safe beats with no text walls. Levels 2 to 4 each add one twist. Level 5 is the boss plus everything combined.
8. **Performance:** 60 fps on a mid phone, at most 50 draw calls and 300k triangles per frame, and no void and no hero hidden at 390×844, 844×390, 768×1024 and 1280×800.
10. **Free orbit camera** (user, 2026-10-28): the player can rotate the camera around the hero:
   - Desktop: drag with the mouse, zoom with the wheel, or use keys.
   - Phone and tablet: rotate with two fingers, pinch to zoom.
   - The player can look from behind, the front, the sides or from above; pitch is clamped.
   - Movement is camera-relative, and auto-follow swings the camera back behind the hero gently.
   - Camera collision keeps the hero visible.
   - Shared system `menu2/camera`.
9. **Originality:** no turtles, ninja, masks, katanas, sai, nunchaku, pizza, sewers, rats, sensei or throwing stars. Use discs, not stars, and generic ancient ruins, not a dojo.

## Shared systems: built once in `src/arcade3d/menu2/`, before more games
| System | What it does |
|---|---|
| `heroModels` (exists) | Each hero's own GLB |
| `heroRig` + `heroAnims` | Real animation set (idle, run, jump, double-jump, roll-ball, land, hurt, cheer, defeat) on the five rigged heroes; the ball-roll is the signature move |
| `powers` (exists per game; move to shared) | One power implementation and its tuning, plus hero-gated route helpers (`CrackedWall`, `HighLedge`, `HazardZone`, `MagnetTrail`, `GhostWall`) |
| `stars` | 3-star evaluation and the level-end star screen |
| `combo` | Flow meter: chained actions within a window give a multiplier, capped so leaderboard limits stay provable |
| `boss` | Boss state machine (phases, telegraph, vulnerable window, hit flash), health bar UI, slow-mo finish |
| `juice` | Particles, camera shake and kick, hit-stop, pickup pop, checkpoint burst |
| `audio` | SFX bank per action, plus music per world (royalty-free or generated, licence recorded) |
| `secrets` | Collectible shards and stickers saved per player |
| `progress` | XP, colour shards and stars per level, world completion; saved locally and to the WordPress backend later |
| `worldMap` | The Menu 2 menu page: six worlds on a map, each game a node with stars, locked/unlocked state and a world colour restoring as games are cleared |
| `daily` + `ghost` | Daily challenge seed, and a ghost replay of your best run |
| `shop` hooks | Premium heroes (9, already generated) use the same hero module and plug into `docs/shop-plan.md` |

## Multiplayer: 1 to 4 players at once (user, 2026-10-27)
The user chose both modes, in steps: **local first, then online**. Every game card gets a **Multiplayer** line.

**Modes**, each game picks the ones that fit:
- **Co-op:** 2 to 4 heroes in the same level. Their powers combine: Kiro shields the group, Nami boosts a friend up, Zuno pulls coins for everyone, Vexa opens a ghost path, Riko breaks a wall. Some co-op-only routes need two different heroes.
- **Versus race:** the same course side by side or together, first to the goal or most orbs.
- **Party arena:** short rounds, as in games 26, 32 and 48: last hero standing, or most painted tiles.

**Phase M1, local** (same computer or TV, no server):
- Input: one keyboard split (WASD + arrows) plus up to 4 gamepads through the Gamepad API.
- Players pick heroes in a join screen ("press A to join").
- One shared camera that fits all heroes (`useFittedView` with every hero in the box). Split screen only where a game needs it, such as runners with 2 lanes per player.
- Phone stays 1 player. Tablet and desktop get 2 to 4.
- Core work: `players` (1 to 4 slots, each with its own input, hero and score), multi-input in `inputController`, a camera that frames N heroes, a HUD per player, and a result screen with a podium.

**Phase M2, online** (each player on their own device, phone included):
- Rooms of 2 to 4 with an invite code or link.
- A real-time server. WordPress cannot do this, so it means a small Node server (for example Colyseus or a WebSocket service) with a monthly cost. That decision and the hosting go to the user before M2 starts.
- Deterministic rules (`rules.ts` already uses seeds) let clients send only inputs. The server is authoritative for scores.
- Reconnection, and a bot taking over a player who drops.
- Before M2: **ghost races**, playing against friends' recorded runs, need no real-time server and can come earlier.

**Leaderboards:**
- Solo runs keep the per-game board.
- Multiplayer runs do **not** go into the solo board. Later they get their own boards (co-op best time, versus wins).
- Score limits stay provable per player.

Order: M1 comes right after the shared systems, so the four reference games get local co-op and versus. M2 comes after W2 or W1 are done, once the user approves the server.

Scoring stays honest. Every new score source (stars, combo, secrets) is counted in the per-level `maxScore` proof, as in the current proof tests.

## Design card template (one per game, in `world-N.md`)
```
### <#> <Title>  (World N, <colour>)
**One-line hook:** <what the player does, in one sentence; must be unique>
**Signature mechanic:** <how it works, controls>
**Why it's different from:** <the 2 closest other Menu 2 games, and how>
**Hero roles:** Riko … / Nami … / Kiro … / Zuno … / Vexa …
**Levels:**
- L1 <name>: teaches … (3 beats)
- L2 <name>: twist …
- L3 <name>: twist …
- L4 <name>: twist …
- L5 <name>: boss "<boss name>": phases …
**Stars:** clear / all orbs / time target idea
**Secrets:** …
**Juice moments:** …
**Multiplayer (1-4):** co-op idea / versus idea / party idea (which ones fit), camera (shared or split)
**Assets:** ready Hyper3D models to reuse (from ready/menu2/<slug>/ and shared/), plus any still needed
**Risks:** what could make it boring or unfair, and the fix
```

## Build process (per game)
1. The design card is approved by the user.
2. **Vertical slice:** level 1 only, fully polished, with the shared systems. Claude plays it, then the user plays it at localhost:3226.
3. Levels 2 to 5 and the boss.
4. Gate: proof and limits tests, all 5 heroes, phone and tablet sweep, 0 errors, performance budget.
5. Into the slice preview at 3226, then the user decides on go-live.

## Order
1. Shared systems, then upgrade the four existing games (Sky Tower, Rooftop, Flooded Ruins, Lava Pillar) as the quality reference.
2. The prototypes already made (Cloud Hopper, Temple Lantern, Neon Cube, Jungle Vine) are rebuilt against their approved cards.
3. Then world by world, in the order W2, W1, W3, W4, W5, W6, so the finale comes last.
