# Switch Color Hero (Menu 2 #22, order 93)

Status **dev** (`enabled: false` in `arcade-games.json`). Built to the master-plan card
(`docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 22") on the menu2 shared systems.
Only existing models, no credits spent.

## Concept and controls

A colour-gate runner. The hero runs on its own down a floating neon track in three lanes and switches its
**own colour** to pass full-width energy gates. (Color Door Sprint is lane choice through door walls; here
the colour is the hero's, and the gates span the track.)

- Colour: keys 1-5, a click or a tap anywhere on the canvas (cycles), or the swatches at the bottom
  (bottom centre; a column on the left on phones). Every colour has a shape (circle, triangle, square,
  diamond, hexagon) on the gate, the swatch and over the hero's head.
- A / D or Left / Right (or a swipe) change lanes, camera-relative; Space / Up / swipe up jumps;
  S / Down / swipe down slides; E / Enter / Power fires the hero power.
- Camera: the menu2 orbit camera behind the runner, with a look-ahead and no roll. Right-drag, two
  fingers, pinch, Q / C; V recenters. One finger is the swipe, so `input={{ oneFinger: false }}`.
- Hero: the shared picker; `DEFAULT_HERO` Riko (`defaultHeroFor`: the game is not on the world map yet).

## Rules (`rules.ts`, deterministic, 8 ms substeps)

- **Gates:** pass only in the colour the gate shows in your lane at that moment. A wrong colour bounces you
  back 4 m, stuns you for 0.8 s and costs a heart. A true gate surges you (+3 m/s for 0.5 s) and links
  the combo. Every gate is required.
- **Gate kinds:** full gates; split gates (a colour per lane: switch, or take the lane in your colour);
  blink gates (two colours alternating every 1.3 s, 1.0 s on L5).
- **Hazards:** each one costs a heart and a bounce.
  - Energy blocks (tall): change lane.
  - Low walls: jump.
  - Beams: slide.
  - Gaps: jump. A fall respawns you at the last checkpoint.
  - Sweepers: a low bar sliding across the lanes; jump it or dodge.
- **Hearts:** three; the last one lost ends the run "lose" (unranked).
- **Powers** (no power ever passes a gate in the wrong colour):

  | Hero | Power | Effect |
  |---|---|---|
  | Riko | Dash | +6 m/s for 0.5 s; smashes blocks |
  | Nami | Double jump | the high prism over the gaps |
  | Kiro | Shield | 3 s: hazards pass, a wrong gate keeps its heart but still bounces |
  | Zuno | Magnet | 4 s, pickups from 6 m |
  | Vexa | Phase | 2 s through blocks, walls, beams and sweepers |

### Levels

| Level | Name | Colours | Gates | Speed | Star time | What it adds |
|---|---|---|---|---|---|---|
| L1 | Two Gates | 2 | 8 | 9 m/s | 60 s | blocks |
| L2 | Three Colors | 3 | 12 | 10 m/s | 75 s | low walls |
| L3 | Fast Switching | 4 | 16 | 11.5 m/s | 90 s | fast gate pairs 9 m apart, blink gates, sweepers |
| L4 | Mixed Obstacles | 4 | 20 | 13 m/s | 105 s | split gates, beams, gaps |
| L5 | Color Overdrive | 5 | 19 + 6 core gates = 25 | 14 m/s | 120 s | Chroma's arena |

`track.ts` builds every level from a fixed seed: no hazard is within 7 m of a gate.

**Chroma** (L5) is ice-peak-jumper's FrostGolem GLB, recoloured at runtime; 6 HP. He runs ahead in an
endless arena, and his core gate lands 22 m ahead when his window opens. A core gate passed in the right
colour in the window is a hit.

| Phase | Core gates | Extra |
|---|---|---|
| P1 Mimic | full, in his colour | |
| P2 Shatter | split | prism sweepers |
| P3 Overdrive | blinking | prism sweepers |

**Stars:** clear; all main pickups; the card's timer. Badge: a clean run (no wrong gate, hazard or fall).

**Secrets:**
- the high prism over a gap (Nami);
- the colour streak (8 true gates in a row);
- the ghost lane shard behind an energy block (Vexa's phase or Riko's dash).

**Multiplayer:** 2-4 heroes in different lanes. Co-op shares pickups and the furthest checkpoint; versus is a race.

## Scoring and the proof

Time game: the submitted time is the finish time minus 50 ms per pickup minus the combo bonus.

The hero never runs faster than `vCap = speed + V_DASH`. The rules also clamp its distance from the start
to `vCap × t` every substep; bounces and respawns only move it back. The floor is
`track.length / vCap`, and on L5 that is followed by `bossMinMs`: Chroma's clock only runs in the arena,
with every hit at the first moment of each window. The combo is bounded by `comboMaxBonus`, with capped
gate links.

The limits are `minDurationMs = floor(0.95 × (floor − pickups × 50 − comboMax) / 100) × 100` and
`timeBaseMs = maxDurationMs` = the clock cap (120 / 150 / 180 / 210 / 300 s).

Tests:
- `proof.test.ts`: every hero wins every level at 30/60/144 Hz inside the row and under 80 % of the cap;
  a ragged-frame store run is ranked; the pace bound holds under spam; idle is unranked; rows are pinned.
- Also `rules.test.ts`, `powers.test.ts`, `track.test.ts`, `assets.test.ts`, `look.test.ts`,
  `orbit.test.ts`, `multiplayer.test.ts`.

The pinned rows (`limits.ts` = `meta.levels[n].scoring` = `arcade-games.json`, checked by `registry.sync.test.ts` and `menu2/limitsSync.test.ts`):

| Level | Name | maxScore | minDurationMs | maxDurationMs = timeBaseMs |
|---|---|---|---|---|
| 1 | Two Gates | 10450 | 15500 | 120000 |
| 2 | Three Colors | 12920 | 20800 | 150000 |
| 3 | Fast Switching | 16050 | 19500 | 180000 |
| 4 | Mixed Obstacles | 18830 | 21700 | 210000 |
| 5 | Color Overdrive | 26690 | 33100 | 300000 |

## Assets

`public/models/3d/switch-color-hero` (from `~/.play50/hyper3d/ready/menu2/switch-color-hero`, generated earlier):

| Model | Used as |
|---|---|
| `m2ColorGateArchV2` | the lane arches |
| `m2ColorGateArch` | the finish arch |
| `m2EnergyBarrierWall` | blocks and low walls, tinted |
| `m2EnergyPickup` | the pickups |
| `m2CheckpointFlagPad` / `V2` | checkpoints |
| `m2SciFiSpireBg` | the city |
| `m2SwitchPlatform` | the start platform |

Shared: the heroes, ice-peak-jumper's `m2FrostGolemBoss` (Chroma).

Code: the deck, lane strips, the gates' energy fields and shapes (recoloured per frame), beams, sweepers,
the sky.
