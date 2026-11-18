# Gem Collector 3D (Menu 2, game 23, World 4 Frost & Sweets)

Status: **dev** (`enabled: false` in `arcade-games.json`, registry order 81). Design card:
`docs/menu2-super/world-4-frost-and-sweets.md` "23 Gem Collector 3D" (slug and title from
`docs/master-plan/menu2-index.json`). Lead hero Zuno (`DEFAULT_HERO`).

## The game

**Signature: the gem train.** The Ornament Vault is a round arena. Every gem you roll over joins a
glowing train that trails your exact path: links sit 0.8 m apart along it, up to 20 of them.

- **Bank:** drive into a score beacon and the train is banked. n links score min(400, n²), and a gold
  gem counts 2.
- **Self-cut:** bring your head back across your own tail (5 links or more behind it) and the train is
  cut there. The cut links fall loose for 3 s; regrab them or they are gone.
- **Lasso:** come back *beside* your tail without crossing it and the loop closes. What it encloses is
  lassoed: a chewing ice slime freezes into a gold gem, the Glutton is stunned or hit.

Gems: clear (+1 link), frost (+1, slows you to 80 % for 3 s), gold (counts 2). The vault refills on a
fixed schedule (waves), so the supply is finite and known. Banking is automatic on contact: Action is
the hero power, not a bank button.

Controls: WASD / arrows (camera-relative), Space jumps, E / Enter is the hero power. On touch: joystick,
Jump, Power. Camera: the shared free orbit (`menu2/camera`): drag or two fingers, wheel or pinch, Q / C,
R / F, V.

## Levels

A points game. Each level is a timed round; levels 1-4 are cleared at the card's target score
(`clearScore`), and level 5 by beating the Glutton.

| | Name | Round | Target | Twist |
|---|---|---|---|---|
| 1 | Vault Floor | 90 s | 300 | Three beats: three gems beside the beacon (bank them), a curved line of eight (the bank jumps 9 → 64), and a lone gold gem inside a small ring where a careless loop crosses your tail. |
| 2 | Shifting Tiles | 100 s | 600 | A 4 × 4 grid of hex slabs. One diagonal group sinks every 5 s (it shakes 1.3 s first), and rolling into the pit loses the train. |
| 3 | Slime Pen | 110 s | 900 | Three ice slimes hunt the tail's end and bite off the last link. After a bite a slime sits chewing for 3.5 s: loop round it and it freezes into gold. |
| 4 | Chest Rush | 120 s | 1200 | At night (the gems, chests and beacon glow). Four chests burst into six gems each, and the one open beacon moves between three spots every 15 s. |
| 5 | Gumdrop Glutton | 240 s | boss | The boss (below). Fourteen refill waves and a fountain at each phase keep the floor stocked. |

Every level also has a frost sweeper or another tail hazard, the cracked crystal wall and its sealed
pocket, the high pedestal, the ghost wall and the back vault, the rim's hidden gem trail, five orbs and
three secrets.

## Hero roles (every level has all five)

- **Riko:** the dash (+7 m/s for 0.4 s, 3 charges) breaks the cracked crystal wall into the sealed
  pocket (two gold gems and the pocket shard). It also snaps the train straight behind him, so a tight
  turn is safe while it lasts.
- **Nyla:** the second jump lands on the 2.2 m pedestal (a plain jump peaks at 1.2 m) for its gold gem
  and the pedestal shard.
- **Kiro:** the shield keeps the tail safe from the frost sweepers, the slimes' and minis' bites (not
  from the hero's own crossings or a fall).
- **Zuno** (lead): the magnet adds 1.5 m of pickup reach and pulls the hidden trail out of the rim
  (within 7 m). His train is no longer than anyone's.
- **Vexa:** the phase lets the train cross itself for 2 s (tight loops allowed) and takes her through
  the ghost wall into the back vault (three gold gems and the vault sticker).

## Boss: the Gumdrop Glutton (L5, `progression.ts` GLUTTON, 7 HP)

`m2GummyMonster`, 2.4 m tall. Every hit comes from the train, never from touching him.

1. **Chase** (3 hits): he stomps after you and eats the last link of a train he touches (every 0.8 s),
   then lunges. Full, he waddles back to his spot and squats (9 s window): loop your train round him
   (about 13 links close the loop) and he is stunned for 4 s. Bank while he is stunned for the hit.
2. **Split** (3 hits): three mini-gummies (`m2SlimeBlob`) nibble the tail. In each window they wobble
   out, dizzy, to their own spot and sit there (8 s): lasso one.
3. **Yawn** (1 hit): he holds the last beacon (no beacon takes banks) and slams the floor near him. While
   he yawns (2.5 s), bank a train of 10 or more into his mouth. Links over 10 score 20 each.

## Score limits (points game)

The store's score is `run.score`. The submitted duration is the run time.

**maxScore** (`rules.ts` `maxScoreOf`, `proof.test.ts`):

1. **Conservation.** Every gem that can ever exist is listed in advance: the level's gems, each chest's
   six, each slime's gold, the refill waves, the boss fountains. Each gem is in exactly one state
   (absent, floor, train, banked, loose, eaten). The train holds gem indices, so a gem is banked once at
   most. W = the whole supply's link weight (gold counts 2).
2. **The bank bound.** Banks scoring min(400, n²) with Σ n ≤ W total at most
   floor(W / 20) × 400 + (W mod 20)²: n² is superadditive up to the cap at 20. The test checks it against
   a brute-force optimum for every W up to 180.
3. Plus every orb (5 × 25), `comboMaxBonus` over fixed events (a gem's *first* pickup, at most one bank
   per gem, each lasso, each hit), and on level 5 seven hits × 150, the defeat 600 and the yawn bonus at
   most 10 × 20.

**minDurationMs**: levels 1-4 end only on their round clock, so the bound is the round length. Level 5 can
end on the defeat, so its bound is `bossMinMs` (every hit on the first instant of its window, 30.7 s).
Each is taken at 95 %, floored to 100 ms. **maxDurationMs** = the round + 1 s.
**base 0, maxPointsPerSec = ceil(maxScore / minDuration)**.

| Level | maxScore | minDurationMs | maxDurationMs | max_pps |
|---|---:|---:|---:|---:|
| 1 Vault Floor | 4235 | 85500 | 91000 | 50 |
| 2 Shifting Tiles | 5449 | 95000 | 101000 | 58 |
| 3 Slime Pen | 6300 | 104500 | 111000 | 61 |
| 4 Chest Rush | 7132 | 114000 | 121000 | 63 |
| 5 Gumdrop Glutton | 14157 | 29100 | 241000 | 487 |

These rows are in `meta.ts` (via `PROPOSED_LEVEL_LIMITS`, equal to `proposeLimits` by test),
`arcade-games.json` and the `PINNED` table in `rules.test.ts`.

## What the bots reached

`bot.ts` plays like a careful player with no power:

- It rolls to the nearest gem whose straight line doesn't cross its own tail, and side-steps when it is
  about to.
- It keeps off sunk and shaking tiles, live frost bands, slimes and open beacons (until it wants to
  bank), and opens chests.
- It banks at 20 weight, or waits for the next wave rather than banking a short train.
- It lassoes chewing slimes, the squatting Glutton and the dizzy minis by circling them.
- It drives a 10+ train into the yawn.

Results at 60 fps (Zuno):

| Level | score / maxScore | clear reached | banks | cuts | lassos |
|---|---:|---:|---:|---:|---:|
| 1 | 1547 / 4235 | 8.0 s (target 300) | 5 | 0 | 0 |
| 2 | 1036 / 5449 | 23.5 s (600) | 4 | 4 | 0 |
| 3 | 1963 / 6300 | 56.3 s (900) | 4 | 40 | 3 slimes |
| 4 | 2694 / 7132 | 35.0 s (1200) | 8 | 16 | 0 |
| 5 | 3069 / 14157 | the Glutton down at 91.7 s | 8 | 25 | 6 |

Every level clears at 30, 60 and 144 fps (level 5 at 20-165 fps in 92-132 s of its 240 s). Spam runs
(200 on L1, 30 per level), every hero with its power mashed, and the honest bot through the real store
with ragged frames all stay inside the limits (`rules.test.ts`, `proof.test.ts`).

## Stars, secrets, flow

- **Stars** (`menu2/stars`): the clear (target score / the Glutton down), all five orbs, and the clear
  reached in time (60, 75, 90, 90 and 150 s). No-cut badge: never cut, bitten or knocked.
- **Secrets** (`menu2/secrets`): the vault sticker (Vexa), the pocket shard (Riko), the pedestal shard
  (Nyla).
- **Flow** (`menu2/combo`): first pickups, banks, lassos and hits chain within 3 s, ×2 cap.

## Multiplayer (1-4, `multiplayer.ts`)

- **Versus:** one floor of gems for everyone. A gem in one train is gone for the others, and a cut drops
  it back for anyone. The highest score when the round ends wins.
- **Co-op:** the chests, the cracked wall and the slimes are shared too. The team's scores add up toward
  the level's target. Kiro's shield, Zuno's magnet and Vexa's phase cover the team.
- Multiplayer runs are never ranked.

## Models

`public/models/3d/gem-collector-3d/` holds m2FacetGem (every gem, tinted by kind; 3k triangles, upright), m2ScoreBeacon,
m2GemPedestal, m2TreasureChest, m2ArenaTileV2 (the sinking slabs), m2ArenaRimWall (the rim, instanced),
m2CrystalHillBg (the backdrop) and m2GummyMonster (the boss, from ready/menu2/shared). Three are reused by
url: Ice Peak Jumper's m2IceSlime and m2IceCrystal (the cracked wall), and Plate Surf's m2SlimeBlob (the
minis). m2ArenaTile (an unusable rock) is left out; m2FacetGemI (the brass-capped bauble, 5k triangles) was swapped for m2FacetGem in the Menu 2 polish pack (level 5 drew about 510k triangles of gems). `assets.test.ts`
tests the fits against the measured meshes. The floor, the vault walls and the tethers are code.

## Open issues

- Level 5 in multiplayer: each player fights their own Glutton; the camera shows player 1's.
- The minis are Plate Surf's slime blob, untinted (pink-red), not gummy-tinted as the card asks.
- The card's "Action to bank" is automatic banking on contact (Action stays the hero power).
- The bot never uses a power, so the pocket, the pedestal, the vault and the rim trail are proven by the
  hero tests, not by a bot run.
