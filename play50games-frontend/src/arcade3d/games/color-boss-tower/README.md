# Color Boss Tower (Menu 2, game 30)

World 6, Prism Spire: the tag-switch world. All five heroes climb together (`menu2/heroTag`); the active hero's colour
is yours. Slug `color-boss-tower`, order 97, owner Claude, status `dev` until the user signs it off. A time game.

**Signature:** the boss fight is a climb, and the tower is your weapon. The guardian stands in the open shaft of a hollow
tower; you never hit him yourself. A spiral of ledges runs up the inner wall. Colour claws on the ledges hold dormant
cores: touch one as the hero of its colour and its prism cannon charges. When his weak plate opens (the boss machine's
vulnerable window), a charged cannon fires: one hit.

## Controls

- Keyboard: A / D or the arrows run round the ring (camera-relative), Space jumps, E / Enter fires the active hero's
  power, **1-5 tag that hero in, T the next** (Shift+T the previous). Camera: drag, wheel, Q / C turn, R / F tilt, V recenters.
- Touch: joystick, Jump and Power; **tap a portrait** in the bottom strip to tag that hero in.
- Local multiplayer (2-4): Down on a player's stick tags their next hero, Up the previous.

The tag (menu2/heroTag): a 0.5 s global cooldown; a benched hero's power recharges at 2x; a tag inside the combo window
is a Hand-off; a hero tagged in mid-air gets one fresh air action (Nami's jump); Prism Lock (level 5) freezes the roster.

| Hero | Colour | Power here |
|---|---|---|
| Riko | red | dash (20 m/s for 0.3 s, 3 s): across a gap, through the cracked window |
| Nami | blue | a second jump (fresh after a tag): up the two skip ledges to a high blue claw |
| Kiro | green | shield (1.5 s, 5 s): the sweep and the hazard orbs bounce off |
| Zuno | yellow | magnet (3 s, 7 s): charges a yellow claw high on the wall from 6 m |
| Vexa | purple | phase (0.8 s, 5 s): through a hazard orb, and through the ghost panel to its niche |

## The five levels

One tower, five configurations (`levels.ts`):

| Level | Name | Ledges | Claws | Twist | Guardian | Timer | 3rd star |
|---|---|---:|---:|---|---|---:|---:|
| 1 | Training Guardian | 30 | 4 | three beats: red claw, the slow sweep, Nami's high blue claw | Stone, 2 cycles | 150 s | 40 s |
| 2 | Two Colors | 40 | 6 | hazard orbs roll down the spiral (one per telegraph) | Stone, 3 | 180 s | 50 s |
| 3 | Three Colors | 48 | 7 | the ledges crumble 2 s after you land (back 4 s later; checkpoints never crumble) | Stone, 4 | 210 s | 65 s |
| 4 | Fast Switch Boss | 52 | 11 | his fury: phase 2 needs a chain charge, two cannons within 4 s | Stone, 5 | 240 s | 110 s |
| 5 | Grand Color Guardian | 44 | 11 | Plate Armour (only the lit colour fires), Spire Collapse (a chain before his beam drains a core in 6 s), Grey Heart (the tag finish: five glyphs light one by one, be that hero) | Grand, 6 HP | 300 s | 150 s |

The guardian's sweep: a glowing dust line round the ring at your height while he winds up, then his arm swings once round
the tower; jump as it passes. Three hearts (refilled at each phase change); out of hearts = "lose" (unranked). A fall is
caught 4 m under the highest checkpoint you reached and puts you back on it.

## Score limits

A time game: `score = floor((timeBaseMs - submitted) / 10)`, `submitted = finishMs - 200 ms per orb - the flow bonus`.

The proof (`rules.ts`, `rules.test.ts`): every hit happens inside a vulnerable window, so no run beats the guardian
before `bossMinMs` (each hit on the first instant of its window; computed by stepping the real boss machine), and the
defeat plays out `defeatMs` before the run ends. The flow meter counts only fixed things, each once per run: a claw's
charge, a cannon hit (one per HP), an orb, a glyph (level 5, five; a glyph scores flow only once per run even if a window
is failed and repeated), so `comboMaxBonus` is finite. `minDurationMs = 95 % of (bossMinMs + defeatMs - 5 x 200 -
comboMaxBonus)`, floored to 100 ms; `maxScore = (timeBaseMs - minDurationMs) / 10`.

| Level | minDurationMs | timeBaseMs = maxDurationMs | maxScore |
|---|---:|---:|---:|
| 1 | 10800 | 150000 | 13920 |
| 2 | 14300 | 180000 | 16570 |
| 3 | 17900 | 210000 | 19210 |
| 4 | 23800 | 240000 | 21620 |
| 5 | 31200 | 300000 | 26880 |

Pinned in three places: `PROPOSED_LEVEL_LIMITS` (meta.ts reads it), `arcade-games.json`, and the `PINNED` table in
`rules.test.ts`. Tests: the honest bot wins every level at 30 / 60 / 144 fps with every lead hero, above the floor; every
power mashed and 20 spam runs per level (random stick, jump, power, tags, frame times) never beat the floor; the flow
bonus never exceeds `comboMaxBonus`.

## What the bot does

Submitted times at 60 fps (Riko leads): 15.9 s, 20.5 s, 28.3 s, 53.7 s, 73.3 s; the third-star targets are about
two to two and a half times those.


`bot.ts` climbs like a careful player: up the spiral (a jump near each ledge's end), tagging to the next claw's hero three
ledges early; at the claw it charges by touch, Zuno's magnet for a yellow claw on the wall, or Nami's two jumps up the skip
ledges for a high blue one. It plants itself for the sweep and jumps as the arm comes round, holds its ledge while a
hazard orb rolls down at it and hops it, keeps the paired claws for the chain phases, and tags through the glyphs on level
5. `?autoplay=1` (preview builds) lets it play.

## Files

`levels.ts` (the five towers), `progression.ts` (combo, stars, secrets, the guardians' configs), `rules.ts` (pure,
deterministic, whole-ms steps), `bot.ts`, `heroes.ts`, `look.ts`, `assets.ts`, `camera.ts` (the orbit outside the wall looking
in: the wall's near side is cut away), `Tower.tsx`, `Boss.tsx`, `Hero.tsx` (five animators; the tagged-out hero lingers 300 ms), `Scene.tsx`, `Hud.tsx`
(hearts, orbs, charged cannons, flow, boss bar and hint, the glyphs, the portrait strip), `multiplayer.ts`,
`MultiScene.tsx`, `MultiplayerHud.tsx`, `levelEnd.ts`, `StarResult.tsx`, `meta.ts`, `index.tsx`.

## Models

`public/models/3d/color-boss-tower/`: m2StoneGuardianBoss (levels 1-4, 7 m), m2ColorGuardianBoss (level 5, 8.5 m; from the
hyper3d-new batch), m2TowerLedgePlatform (hyper3d-new; every ledge, 4 x 0.6 x 2.8 m, and the skip ledges), m2HazardOrb
(hyper3d-new, 0.9 m), m2CoreClawHolder, m2PrismCannon, m2BossArenaDisc (his disc in the shaft), m2DarkTowerBg (the crown of
spires), m2PrismHeart (level 5's Grey Heart). The orbs and checkpoint beacons are menu2's. Unused from the ready folder:
m2TowerPlatform, m2TowerPlatformV2, m2PrismCannonI.

## Open issues

- Multiplayer co-op: the team's guardian is player 1's (the cannons are shared); allies' powers do not cover each other.
- Rain on level 2 is lighting only (no particles).
