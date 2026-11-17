# Roll Dash (Menu 2, game 11, World 6 Prism Fortress): READ THE LOCK, TAG THE HERO, FIRE

Cards:
- the spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 11 — Roll Dash": a 3-lane endless runner over five streets of 600, 900, 1200, 1500 and 2000 m, 60-120 s;
- the World 6 card: `docs/menu2-super/world-6-prism-fortress.md` "11 Roll Dash" (branch `claude/m2-super-plan`): Prism Locks, the hero tag-switch and the Echo Storm Hawk.

Slug `roll-dash`, order 91, owner claude, status dev. A time game.

## Concept and controls

You roll forward on your own down Greytown's grey causeway to the Prism Fortress, three lanes wide. Every **Prism Lock** carries a hero colour and glyph and opens only to that hero's power:

| Lock | Colour / glyph | Opened by |
|---|---|---|
| cracked barricade | red / chevron | Riko's dash |
| 3 m barrier | blue / wave | Nami's double jump |
| drain spray / tesla arc | green / hexagon | Kiro's shield |
| coin vault | yellow / horseshoe | Zuno's magnet |
| ghost wall | purple / spiral | Vexa's phase |

The whole squad rolls together (World 6's `heroTag`): **tag** the right hero, then fire the power.

A single lock blocks one lane: dodge it, or open it for the orb line behind it. A full lock spans all three lanes and must be answered. A wrong hero on a full lock bounces you back 3 m and costs a heart.

A correct unlock gives +1 flow, a 1.5 s +1.5 m/s boost, and repaints the street behind you in colour. The glyphs keep it readable without colour, as the W6 accessibility rule asks.

- **Keyboard:** A / D or Left / Right change lane (0.18 s). Space or Up jumps (1.4 m). S or Down tucks under a sign. **1-5 tag** a hero. E or Enter fires the power. Camera: drag, Q / C, R / F, wheel; V recenters.
- **Touch:** swipe left / right / up / down. The **portrait strip** (bottom left) tags: tap a portrait. Each portrait shows its glyph and its power's cooldown, and greys while tagging cools or is locked. Power fires. Two fingers rotate the camera, pinch zooms.
- **The tag:**
  - Global cooldown 0.5 s.
  - **Hand-off:** a tag while the power runs, or within 0.4 s after it, gives +1 flow step, and the outgoing power lingers 0.3 s.
  - A benched hero recharges twice as fast, which rewards rotation.
  - **Fresh legs:** a mid-air tag gives one fresh air action per airtime.
  - **Clutch:** a tag within 0.4 s before a lock opens it as a clutch, which adds a flow bonus.
  - A tag on its own never scores.
- **Powers (W6 tag tuning):**

  | Hero | Power | Duration | Cooldown |
  |---|---|---|---|
  | Riko | dash, +8 m/s | 0.3 s | 3 s |
  | Kiro | shield (it also takes a crash) | 1.5 s | 5 s |
  | Zuno | magnet (pulls orbs from 6 m) | 3 s | 7 s |
  | Vexa | phase | 0.8 s | 5 s |
  | Nami | double jump (her Jump; Power does nothing) | — | — |

- **Camera (`camera.ts`):** the shared orbit, behind and above, looking down the street. It auto-follows behind you, and a boost pushes the field of view out (speed lines). The lanes stay screen-relative: if you turn the camera to look back, left and right swap (`laneSign`).

## Files

- `levels.ts`: the five level configs.
- `course.ts`: the streets. L1 is hand-written; L2-L4 come from a seeded generator (the same every run). L5's items are spawned by the Hawk.
- `rules.ts`: the pure fixed-step simulation, 1000/120 ms, including the tag state.
- `bound.ts`: the score bound.
- `progression.ts`: combo, stars, secrets and the Hawk.
- `heroes.ts` and `bot.ts` (the honest bot, `?autoplay=1` in preview builds).
- `latch.ts`: the portrait strip's tag.
- Scene and views: `Scene.tsx`, `StreetView.tsx`, `World.tsx`, `Hawk.tsx`, `Hero.tsx`, `camera.ts`, `Hud.tsx` + CSS.
- Level end: `StarResult.tsx` and `levelEnd.ts`.
- Multiplayer: `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx`.
- Tests: `rules`, `proof`, `orbit`, `multiplayer`, `assets`.

## Levels

- **L1 Gate Street** (600 m, 9 m/s, locks light up 2 s ahead). Three beats:
  1. red barricades in one lane;
  2. blue barriers;
  3. full lock pairs, red then blue, 1.5 s apart.
- **L2 Market Lane** (900 m, 11 m/s). All five colours. **Double locks**: a ghost wall with a barricade 6 m behind it, so you tag Vexa, phase, then tag Riko and dash. This is the Hand-off showcase.
- **L3 Old Town** (1200 m, 12.5 m/s). Grey shadow rollers (`m2ShadowArmadillo`) roll in and **repaint** a lock 1 s before you reach it. Ore carts (`m2OreCart`) roll across the lanes.
- **L4 Night Causeway** (1500 m, 14 m/s). Darkness: a lock shows its colour and glyph only in a street lamp's light. **Prism Lock zones** (the 2 s before some full locks) refuse tags, so be the right hero *before* you enter.
- **L5 Fortress Bridge**: the boss, the **Echo Storm Hawk** (`m2StormHawkBoss` in grey "echo" glass). It has ten plates:
  - **P1:** it drops feather-locks ahead. Open one with its hero inside the window and a prism spark hits it (6 hits). Between windows it drops crates.
  - **P2:** a red lane shadow warns of its swoop (1.2 s), so dodge it. At the bottom its wing plate glows one hero's colour for 1 s: be that hero and jump into it in its lane (3 hits).
  - **P3:** gusts push you one lane, then five coloured plates come 0.6 s apart. Pass each one as its hero, a forced Full Prism, for the slow-mo shatter.

  Lengths and speeds follow the card. The generator never asks for a colour again before its hero has recharged (its cooldown + 0.6 s of rolling), and a Prism Lock zone never covers a double lock.

## Stars, secrets, progress

**Stars** (`menu2/stars`):
- the clear;
- the colour orbs;
- the target time (the No-hit run is a separate badge).

**Orbs.** A run can't hold every lane at once: a lock's reward line competes with a free lane's line. So the orb star asks for 60 % of the street's orbs (level 5: 20).

**Target times.** L1 63 s, L2 78 s, L3 92 s, L4 105 s, L5 45 s. The spec says 60 / 75 / 90 / 105 / 120. The first three are slightly looser because the card wants about 85 % correct unlocks to make it, and the honest bot (which dodges what it can't answer) sets that pace. Level 5's spec time is its clock, not a goal.

**Secrets** (`menu2/secrets`, never score):
- **Perfect Gate** (L1): every lock answered and no hit.
- **The Courtyard** (L2): the ghost wall past 550 m (Vexa).
- **The Alley** (L3): the gold vault past 500 m (Zuno).
- **The Shop Window** (L4): a red lock broken in the dark (Riko, a shard).
- **Full Prism** (L2-L4): five different heroes open a lock inside one flow chain.
- **The Prism Shard** (L5): free the Hawk's plates with a Full Prism.

The level end goes through `menu2/progress` (`levelEnd.ts`).

## Scoring

The submitted time is the finish less the flow bonus. The flow meter (`menu2/combo`) chains correct unlocks, clutch tags and Hawk hits. A tag on its own never scores.

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)

**Levels 1-4.** The street is `length` metres, and the forward speed is never more than:
- the level's base,
- plus the boost (assumed always on),
- plus Riko's dash: +8 m/s for 0.3 s. Her cooldown is 3 s, or 1.5 s on the bench, so dashes come no closer than 1.5 s apart.

So L ≤ (base + boost) T + 2.4 (1 + T / 1.5), which bounds the finish time T from below. A bounce or a stumble only slows you.

**Level 5.** `bossMinMs()`: menu2/boss with a perfect hitter.

**The row.** Each limits row is that floor, less the largest flow bonus (`comboMaxBonus` over every lock with its clutch, plus every Hawk hit), less 6 %, rounded down to 100 ms:

| Level | maxScore | minDurationMs | time base | the honest bot |
|---|---|---|---|---|
| L1 | 10 460 | 45 400 | 150 s | about 62 s |
| L2 | 12 180 | 58 200 | 180 s | about 77 s |
| L3 | 14 000 | 70 000 | 210 s | about 91 s |
| L4 | 15 990 | 80 100 | 240 s | about 103 s |
| L5 | 28 090 | 19 100 | 300 s | about 35 s |

**What `proof.test.ts` checks.** The rows equal `proposeLimits`, meta and `arcade-games.json`. It then plays:
- honest, random and spamming players of every lead, at 30 / 60 / 144 fps; none submits under the row;
- the honest bot, which wins every level with three stars and no hit (Riko or Vexa leading);
- a ragged-frame run through the real store, which gives a ranked win inside the limits.

## Local multiplayer (menu2/multiplayer, M1)

Two to four rollers on the same street (`multiplayer.ts`), each with a private roster (two may both lead with Riko) and a ring in their slot colour.

- **Versus race:** first to the gate wins.
- **Co-op:** shield and magnet cover the team, an unlock keeps everyone's flow alive, and the team clears when everyone is through.
- The shared camera frames everyone down the street. P1 tags with the portrait strip; the other players tag only through the rules' input (no on-screen strip for them yet).

**Not built from the card:**
- the 6-lane co-op street;
- the shared hero bench, the high-five swap and twin locks;
- the grey slick dropped on a rival;
- the ghost race.

## Look

World 6 (`look.ts`): smoked grey (slate to graphite) with the hero colours as the only saturated tones.
- **The street:** a grey road with lane lines and kerbs. Old-town houses (`m2OldTownHouseBg`) and street lamps (`m2StreetLamp`) line it, with market stalls (`m2MarketStall`) in L2 and L3.
- **The fortress:** it floats far ahead (`skyFortressGate` on glass crystals), and the gate itself stands at the street's end.
- **Locks:** they use ready models: `m2ArenaCrate` tinted red or gold, `m2CityBarrier` stood up and tinted blue, `m2TeslaCoil` pairs with a code arc, and `m2EnergyBarrierWall` tinted violet.
- **Glyphs:** a glyph billboard hangs over every lock. Locks light up a fixed *time* ahead: the glyph grows in `leadS` before you reach it.
- **Coins:** `m2GoldCoin`.

The colour returning: a rainbow wash spreads down the road behind every correct unlock.

Only the stretch around the roller is drawn (moving pools), so a 1.5 km street costs the same as a short one.

**Models: no Hyper3D credit was spent.**
- Copied into `public/models/3d/roll-dash/`: the `ready/menu2/roll-dash` set, `m2ArenaCrate`, `m2TeslaCoil`, `m2EnergyBarrierWall` and `m2StormHawkBoss`.
- The rest are reused by url.
- Not used from the card's list: `m2TrafficCone` and `m2StreetJumpRamp`.

## Open issues

- **`heroTag` lives in the game:** its tag state (cooldown, Hand-off, bench recharge, fresh legs, Prism Lock zones) is in `rules.ts`. The W6 card asks for a shared `menu2/heroTag` module used by all ten World 6 games, which doesn't exist yet; this one is the first candidate to extract.
- **Missing card features:**
  - Prism Lock rings fired by enemies (only zones here).
  - Daily seeds.
  - Per-hero tag chimes beyond a pitch per hero.
  - The world music stems.
- **Level 5's street** is the boss's own: there are no hand-placed obstacles, only what the Hawk drops, and orb lines every 30 m.
- **The swoop** hurts in its lane on the ground; jumping clears it.
