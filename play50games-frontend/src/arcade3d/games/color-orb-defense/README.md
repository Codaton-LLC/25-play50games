# Color Orb Defense (Menu 2 #48, order 99)

Status **dev** (`enabled: false` in `arcade-games.json`). Built to the master-plan card
(`docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 48") on the menu2 shared systems.

## Concept and controls

A colour defence arena. Harmless energy orbs fly from portals on the rim of a floating castle arena down
straight lanes to the dome beacon in the middle. Every lane has three colour zones (zone plates with a
shield pedestal). Standing on a zone charges the hero's shield with its colour (the card: "stand on matching
colour zones to block"); an orb that touches the hero while the shield has its colour is blocked. An orb
that reaches the beacon costs a hit point (20); none left and the run is lost. A wave held repairs the
beacon by 1, a perfect wave (no leak) by 2.

- WASD / arrows / joystick to run (camera-relative), Space / Jump to hop (the drone), E / Enter / Power.
- Each portal lights up in its orb's colour 2 s before it launches it (read it, charge, run).
- Camera: the menu2 orbit camera, a high view of the arena from the south that follows the hero a little;
  drag, two fingers, pinch, Q / C; V recenters.
- Powers: Riko dash (14 m/s for 0.3 s), Nyla double jump (the pillar beacon), Kiro shields the beacon (3 s),
  Zuno's magnet widens his block to 3.2 m (3 s), Vexa phases through the drone and runs 40 % faster (2 s).
  No power blocks an orb of the wrong colour.
- Hero: the shared picker; `DEFAULT_HERO` Riko (`defaultHeroFor`: not on the world map yet).

## Levels (`levels.ts`, `arena.ts`)

| | Colours | Waves | Lanes | Orb speed | Gap | Adds |
|---|---|---|---|---|---|---|
| L1 Two Colors | 2 | 4 | 3 | 2.6 m/s | 2.3 s | |
| L2 Three Colors | 3 | 6 | 4 | 2.8 | 2.1 | the drone sweeping the middle ring (moving element) |
| L3 Four Colors | 4 | 8 | 4 | 2.9 | 2.1 | blink orbs (two colours, 0.9 s) |
| L4 Fast Waves | 4 | 10 | 5 | 3.1 | 1.85 | orbs in pairs |
| L5 Orb Defense Master | 5 | 9 + 3 boss phases | 5 | 3.2 | 1.85 | the Orb Mortar |

Wave w of a level has `base + w` orbs; the schedule is fixed per level (seeded). **The Orb Mortar** (new
m2OrbMortarBoss, 6 HP) rises on the north rim when the waves end and lobs golden core orbs (m2OrbBlob) down
a lane when his window opens: block one in its colour in the window and it flies back into him. P1 Lob (one
orb), P2 Twin (two lanes), P3 Rainbow (a blinking core orb; the drone speeds up). A core orb that reaches
the beacon fizzles.

**Scoring (points):** a block 100, +50 early (blocked 8.5 m or farther from the core), a perfect wave 250,
the combo (blocks within 2.5 s, x1-x5), a Mortar hit 600, his defeat 2000. Stars: clear; every regular
orb blocked; 60 % of the level's maximum. Badge: no leak and no knock. Secrets: a perfect wave blocked
all early; the rainbow chain (one block of every colour in a row); the pillar beacon (Nyla).
Multiplayer: one arena, seat 0's run owns the orbs, the beacon and the boss; every hero's block scores for
him; co-op holds the beacon together, versus ranks by score.

## Scoring and the proof

Every orb is on the fixed schedule, so `maxScore = orbs x (100 + 50) + waves x 250 + comboMaxBonus +
(L5) 6 x 600 + 2000` bounds any run. A run ends "win" only when the last orb has left its portal and none
is live (level 5: when the Mortar falls, and his clock starts when the waves end), so
`minDuration = floor(0.95 x minFinish / 100) x 100` with `minFinish = lastSpawn` (L5 `wavesEnd +
bossMinMs`), and `maxPointsPerSec = ceil(maxScore / minDuration)`, so `score x 1000 <= rate x duration`.
`maxDurationMs` is the clock cap + 1 s.

Tests: `proof.test.ts` (every hero holds every level at 30 / 60 Hz inside its row; a ragged-frame store run
is ranked and inside the server limits; random play never beats the bound nor ends early; pinned rows),
`rules.test.ts`, `powers.test.ts`, `arena.test.ts`, `assets.test.ts`, `look.test.ts`, `orbit.test.ts`,
`multiplayer.test.ts`.

The pinned rows (`limits.ts` = `meta.levels[n].scoring` = `arcade-games.json`, checked by `registry.sync.test.ts` and `menu2/limitsSync.test.ts`):

| Level | Name | maxScore | minDurationMs | maxDurationMs | base | maxPointsPerSec |
|---|---|---|---|---|---|---|
| 1 | Two Colors | 4940 | 51000 | 121000 | 0 | 97 |
| 2 | Three Colors | 8890 | 83900 | 151000 | 0 | 106 |
| 3 | Four Colors | 15600 | 143400 | 211000 | 0 | 109 |
| 4 | Fast Waves | 24150 | 179600 | 261000 | 0 | 135 |
| 5 | Orb Defense Master | 28450 | 171400 | 321000 | 0 | 166 |

## Assets

`public/models/3d/color-orb-defense`: from `ready/menu2/color-orb-defense` m2ArenaPillar, m2CastleWallBg,
m2DomeBeacon (the beacon), m2EnergyOrb (the orbs, tinted per frame), m2ZonePlate (tinted); the new set
(`p50-assets/hyper3d-new` m2OrbLauncherPortal, m2ShieldPedestal, m2OrbMortarBoss and
`hyper3d-recovered` m2OrbBlob, m2SpawnPad) optimised with tools/hyper3d's `optimizeGLB` (props 3-5k tris
<= 123 KB, the boss 20k tris 406 KB). Code: the floor and rim, lane lines, zone rings and shields, the
drone, clouds, the sky.
