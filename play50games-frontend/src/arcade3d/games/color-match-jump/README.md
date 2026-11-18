# Color Match Jump (Menu 2, game 21, World 6 Prism Fortress)

Order 92, owner Claude, status `dev`, backend `enabled: false`. Design card: `docs/menu2-super/world-6-prism-fortress.md` "21 Color Match Jump" (branch `claude/m2-super-plan`), plus the five spec levels in `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` "GAME 21".

## Signature: the landing match

Hop across hex pillars over the void.
- A landing in your **active hero's colour** holds, lights the hex and feeds the combo.
- Any other colour **cracks** the hex. It drops 0.6 s later, and staying on it is a fall that costs a heart.
- Grey hexes are always safe.

The whole squad is in every level (World 6). You **tag** a hero at any time, mid-air included, so the right colour touches down:
- keys 1–5 (T cycles), or tap a portrait in the strip;
- a 0.5 s tag cooldown;
- benched heroes recharge their powers twice as fast;
- a hero tagged in mid-air gets a fresh air action (fresh legs).

The countdown **beacon** shows a code of colours. Landing them in order, each on a new hex, cracks the code. Enough codes open the **crown** at the far end; reaching it is the win.

Hops are fixed-time arcs between lattice hexes:
- a tap is a 1-hex hop (560 ms);
- holding the button makes it a 2-hex long jump (720 ms);
- a hop climbs at most 1.3 m.

## Levels (`levels.ts`, fields in `course.ts`, seeded per level)

| L | Name | Twist | Codes | Sink | Target |
|---|---|---|---|---|---|
| 1 | Two-Tone Steps | red and blue only; scripted beats: red rows, one blue hex, R/B stepping stones over the void | 5 × 2 | none | 30 s |
| 2 | Three Calls | yellow joins | 8 × 3 | 1 row / 3 s | 45 s |
| 3 | Shifting Hues | every hex steps through the palette every 4 s (0.8 s fade), pillars bob | 12 × 3 | 1 row / 2.6 s | 55 s |
| 4 | Fast Countdown | all five colours, glassy hexes skid (0.25 s) | 16 × 4 | 1 row / 1.8 s | 90 s |
| 5 | Frozen Crown | Echo Frost Golem on a ring field | boss | none | 80 s |

The card asks for codes of 5–6 on L4. They are 4 here, so that the 16 codes stay playable ahead of the 1.8 s sink wave.

## Hero roles (every level; each route holds an orb, so the "all orbs" star needs every hero)

- **Riko (red):** the air dash carries a hop two hexes further. It crosses the void to the dash island; on the ground it is a 3-hex dash hop.
- **Nami (blue):** the double jump clears the 4 m pillars. On L5 it is also the way up onto the golem's shoulder.
- **Kiro (green):** his shield crosses the lightning curtains. Without it, a curtain zaps you for a heart.
- **Zuno (yellow):** his magnet pulls the floating orb trail in from 6 m.
- **Vexa (purple):** her phase passes and lands through ghost pillars, which bounce everyone else back.

Secrets (one per level):
- L1: Nami's second high pillar.
- L2: the hex inside a ghost pillar.
- L3: Riko's far island.
- L4: a code cracked in under 4 s.
- L5: Zuno's frost shard over the void.

## Boss: Echo Frost Golem (L5, `progression.ts` `FROST_GOLEM`, shared `menu2/boss`)

The golem is the ice-peak-jumper `m2FrostGolemBoss` drawn in grey glass. Hits are queued by the rules and taken in the machine's vulnerable windows.

1. **Cores:**
   - It slams a ring band of hexes into neutral, slippery ice.
   - Crack a 4-colour code whose last colour you land on the glowing core hex behind it. That is 3 hits.
2. **Plate:**
   - Boulders delete the hex you stand on (1 s shadow telegraph, gone for 8 s). The stomp hex is never targeted.
   - From the stomp hex, jump at the golem, double-jump as Nami, and be the plate's colour at touchdown (tag mid-air). That is 3 hits.
3. **Prism storm:**
   - Every hex recolours every 2 s.
   - Take 5 prism shards on matching hexes and hold out 20 s. The last hit gives the slow-mo finish.

## Scoring and limits (time game)

The submitted time is the finish time; the score is `floor((timeBase − ms) / 10)`.

Proof of the floor:
- Every code step is a landing on a hex, and every landing ends a hop.
- A hop lasts at least `HOP_MS` = 560 ms and only starts on the ground. Bounces and respawns never count as landings.
- So `k` code steps need at least `k × 560` ms.
- L5 needs 3 × 4 code landings, 3 stomps of 2 hops each, then the 20 s storm.

| L | min ms | max / base ms | max score |
|---|---:|---:|---:|
| 1 | 5599 | 90000 | 8440 |
| 2 | 13439 | 120000 | 10656 |
| 3 | 20159 | 150000 | 12984 |
| 4 | 35839 | 180000 | 14416 |
| 5 | 30079 | 240000 | 20992 |

The numbers are pinned in `rules.test.ts` and match `meta.ts` (`LIMITS`) and `arcade-games.json`. `proof.test.ts` drives the input-only bot (`bot.ts`) through the real arcade store with each of the five lead heroes on every level. Its finishes:
- L1 10.97 s
- L2 21.18 s
- L3 25.85 s
- L4 57.70 s
- L5 47.33 s

All are no-hit, and all are inside the limits.

## Models

The ready `color-match-jump` GLBs, copied from the Hyper3D ready folder (no generation, no credits):
- `m2HexPlatform`: the hexes, tinted per instance on one white material;
- `m2CrackedHexPlatform`;
- `m2HexPlatformV2`: the crown;
- `m2HexPillar`: the columns and ghost pillars;
- `m2CountdownBeacon`;
- `m2SignalOrbLamp`: the code lamps;
- `m2FloatingArenaBg`: the fortress islands and the golem's platform.

Shared models: the Menu 2 `scoreOrb` and ice-peak-jumper's `m2FrostGolemBoss`.

Code-built: the colour-blind glyphs (chevron, wave, hexagon, horseshoe, spiral) on every coloured hex, the lightning curtains, the boulder, its shadow, and the ring markers.

`assets.test.ts` checks every model's measured bounds and budgets against the real files.

## Not done (open)

- Local multiplayer ("Code Breakers" versus, "Last Hex Standing", co-op twin hexes) is not built. The game is solo for now.
- The shared W6 systems the card names do not exist yet. Their game-local equivalents, and the generic parts to extract when more W6 games land:
  - `heroTag`: the keys and the portrait strip go through the shared `menu2/heroTag/tagInput` (keys 1-5 by physical key, Digit or Numpad row; T the next; Shift+T is T here), and the tag's cooldown, linger and bench recharge are its constants; the tag state itself stays in `rules.ts`;
  - `colourKit`: the hero glyphs come from `menu2/heroTag` (`TAG_GLYPH`); the hex palette (with grey and ice) stays in `look.ts` / `Field.tsx`;
  - `echoMaterial`: a material override on the golem.
- Not yet checked: real-phone frame time and draw calls, audio balance, and gamepad tagging (no LB/RB yet).
