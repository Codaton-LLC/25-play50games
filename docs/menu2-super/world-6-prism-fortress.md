# World 6: Prism Fortress (all colours, all heroes)

Design cards for the ten World 6 games of Menu 2 "Color Roll Heroes". They follow `00-framework.md` (pillars, shared systems, multiplayer 1–4, card template). World 6 is the finale world: Shadow Plates' own fortress, where all five heroes play together and the core verb of the world is the **hero tag-switch** (section 2).

World map order (the path through the fortress): 11 Roll Dash → 21 Color Match Jump → 22 Switch Color Hero → 25 Paint the Platforms → 26 Color Arena Survival → 29 Energy Core Hunt → 39 Color Bridge Builder → 48 Color Orb Defense → 30 Color Boss Tower → 50 Ultimate Color Trial.

---

## 1. World intro

**Look.** The Prism Fortress is a crystal citadel of smoked grey glass. It floats over Greytown, the drained town at its foot. Every surface is faceted, and thin veins of trapped colour pulse under the glass. The art keeps the fortress grey (cool slate `#64748B` to graphite `#1F2937`) with the five hero colours as the only saturated tones. That makes every colour-coded object read at a glance:
- Riko red `#EF4444`
- Nami blue `#2563EB`
- Kiro green `#22C55E`
- Zuno yellow `#FACC15`
- Vexa purple `#8B5CF6`

The levels climb the fortress: the causeway and town (11), the pillar fields and spires of the outer wall (21, 22), the mural courtyard and colosseum (25, 26), the reactor and the canyon under the walls (29, 39), the castle keep (48), the hollow tower (30), and the Prism Heart in the sky above it (50). Lighting per level comes from a core preset. The fog is cold and grey, and colour light spills from whatever the player has restored.

**Music mood.** One W6 theme built from the five world leitmotifs: Riko's driving drums, Nami's airy pads, Kiro's marimba and gong, Zuno's bright plucks and Vexa's arps. At the start of the world the mix is "drained": low-passed, mono, slightly detuned. Each cleared game opens the filter one step and adds that game's lead layer. Tagging a hero briefly brings that hero's motif forward for 2 bars. Bosses use the full mix at 132 BPM, and the finale ends on all five motifs in unison. The tracks are royalty-free or generated, with the licence recorded in `audio`.

**Guardian boss.** Shadow Plates himself (`m2VillainShadowPlates`). He is fought at the crown of his tower (game 30 L5) and again inside the Prism Heart (game 50 L5, the final boss).

Each of the other eight games ends with an **Echo**: a grey glass copy of one guardian beaten in Worlds 1–5. Shadow Plates forged them from the colour he stole. Echoes reuse the ready boss GLBs with the shared `echoMaterial` shader (section 2.2), so they cost no credits:

| Game | Echo boss | Model |
|---|---|---|
| 11 | Echo Storm Hawk | `m2StormHawkBoss` |
| 21 | Echo Frost Golem | `m2FrostGolemBoss` |
| 22 | Echo Mothership | `m2AlienMothership` |
| 25 | Echo Candy King | `m2CandyKingBoss` |
| 26 | Echo Giant Crab | `m2GiantCrabBoss` |
| 29 | Glass Glutton | `m2GummyMonster` at 4× |
| 39 | Echo Mega Robot | `m2MegaRobotBoss` |
| 48 | Echo Magma Golem | `m2MagmaGolemBoss` |
| 30 L4 | Stone Guardian | `m2StoneGuardianBoss` (the tower's own lieutenant) |

**How the colour returns.** The world-map fortress has ten facets, one per game. Clearing a game lights its facet in a mix of all five colours, and 3 stars make it sparkle. In play, colour comes back locally wherever the player succeeds:
- a street segment refills behind a correct unlock (11)
- a matched hex lights (21)
- a set mural line glows (25)
- a defeated Echo bursts into its world's colour and the level's fog warms

Clearing game 30 lights the tower crown on the map. Clearing game 50 shatters the Prism Heart, and a colour wave rolls across all six worlds of the map.

---

## 2. Shared systems for World 6

### 2.1 `heroTag`: the hero tag-switch (core system of World 6)

In World 6 the whole squad of five heroes is in every level, and the player swaps the active hero mid-level. **The active hero's colour is the player's colour.** Every colour check in W6 (gates, tiles, cores, bridges, orbs, boss plates) reads `heroTag.activeColour`. Switching colour therefore means switching hero, and with the hero comes that hero's power.

**Roster and order**
- All five heroes are always available in W6.
- The player picks the **lead**, the hero who starts the level. The rest follow in colour-wheel order R → B → G → Y → P, cyclic from the lead.
- A level config may restrict the roster to teach (`roster: ["riko","nami"]`). A restricted level never gates its clear behind a missing hero.
- Open user decision: whether W6 unlocks only after W1–W5 are cleared. If it opens earlier, unrestored heroes still play fully, but are drawn desaturated until their world is cleared.

**Input** (the same timing windows on every device)

| Device | Direct select | Cycle |
|---|---|---|
| Solo keyboard | `1`–`5` | `Q` = previous, `E` = next |
| Split keyboard (M1) | — | P1: `Q`/`R`. P2: `,`/`.` |
| Gamepad | — | LB/RB |
| Touch | A strip of 5 hero portraits, bottom-left above the joystick, inside `useSafeArea`. Tap a portrait to select that hero. Tap the active portrait to cycle to the next. | |

Touch direct-select exists so that touch is never slower than keyboard. There is no slow-mo wheel, because slow-mo would be timing help (CLAUDE.md fairness rule 7).

**The swap itself**
- A tag takes **0.12 s**. The outgoing hero curls into the roll-ball, a prism burst flashes in the new colour, and the incoming hero pops out at the same position.
- The swap keeps position, velocity, facing and airborne state.
- Damage still applies during the swap. A tag gives **no invulnerability**, so it is never an escape button.
- **Global tag cooldown: 0.5 s.** The portrait strip greys during it.
- **Fresh legs:** a hero tagged in mid-air gets a fresh air-action. Nami tagged in after a jump still has her double jump. This is capped at one fresh air-action per airtime, so tag-chaining cannot become flight. This is a designed route tool in 21, 30 and 50.

**Powers under tagging ("W6 tag tuning" in `powers`)**
- Each hero keeps its own cooldown.
- A benched hero's cooldown recharges **2× faster**, which rewards rotation.

| Hero | Power | Duration | Cooldown |
|---|---|---|---|
| Riko | Dash 6 m | 0.3 s | 3 s |
| Nami | Double jump | — | once per airtime |
| Kiro | Shield | 1.5 s | 5 s |
| Zuno | Magnet, radius 6 m | 3 s | 7 s |
| Vexa | Phase | 0.8 s | 5 s |

W1–W5 use the longer base cooldowns from the spec. W6 shortens them because swapping is the play.

**Hand-off and the combo meter (`combo`)**
- **Hand-off:** a tag within 0.4 s after the outgoing hero's power ends, or while it is still active. The incoming hero gets +1 combo step, and the outgoing power's effect lingers for 0.3 s: the shield bubble stays, the dash momentum carries. This is the "relay" feel of W6.
- **Spectrum ring:** the combo meter has a five-segment ring. Each distinct hero that scores an action inside one combo window lights a segment.
- **Full Prism:** all five segments lit gives +1 multiplier step, still under the combo cap.
- **Scoring honesty:** a tag on its own never scores, so tags cannot be farmed. Hand-off and Full Prism only multiply real actions, and they are counted in every level's `maxScore` proof.

**Health:** the squad shares 3 hearts. A hit plays `hurt` on the active hero. Benched heroes cannot be hurt, unless a game parks them in the world (22).

**Prism Lock (enemy effect).** A grey shock ring telegraphs for 0.8 s, then disables tagging for 2.0 s. The portraits show chains and the HUD makes a "clunk". Bosses use it so that pre-tagging (being the right hero before the moment) becomes a skill.

**Rendering and audio**
- All five hero GLBs are preloaded at level load. Only the active hero is drawn, plus parked heroes in 22, so one character costs the triangle budget at a time.
- The burst is a pooled particle effect, plus a 2-frame camera kick on a Hand-off.
- Each hero has its own tag chime on a pentatonic scale (R C, B D, G E, Y G, P A). A Full Prism chain plays a short melody.

**Multiplayer rules**
- **Co-op:** each player owns one hero. Unowned heroes form the shared **bench**, and a player's tag cycles only through free bench heroes. With 4 players the bench is a single hero, so it is contested.
  - **High-five swap:** two players within 1.5 m press tag within 0.3 s of each other to swap heroes. It costs no cooldown and gives both +1 combo.
- **Versus and party:** each player has a private five-hero roster, so two players may both be Riko. Players are told apart by a player ring in their slot colour (white, orange, cyan, pink, never a hero colour), a number badge and a nameplate. A party mode may set `tag: "off"`. Only 25's "Colour Claim" does: there each player keeps one team colour.
- **Determinism:** tags are input events in the replay log, so `ghost`, daily seeds and the M2 server replay them exactly.

**Accessibility (required in W6).** Every colour also carries a glyph on portraits, tiles, gates, cores, bridges and orbs:
- Red: chevron (dash)
- Blue: wave (jump)
- Green: hexagon (shield)
- Yellow: horseshoe (magnet)
- Purple: spiral (phase)

A colour-blind palette option shifts hue and luminance but keeps the glyphs.

**API sketch (`src/arcade3d/menu2/heroTag`, pure core in `heroTag/rules.ts`):**
```
createTagState({ roster, lead, tagCooldownS: 0.5, benchRecharge: 2 })
tagTo(state, heroId | "next" | "prev", nowS) -> { ok, reason: "cooldown" | "locked" | "taken" }
activeColour(state) -> "red" | "blue" | "green" | "yellow" | "purple"
prismLock(state, nowS, durationS)
isHandOff(state, nowS) -> boolean
spectrum(state) -> Set<heroId>
useActiveHero() -> hero, for the scene and the HUD portrait strip
```

### 2.2 Other W6 needs from the shared systems

| Need | System | Used by |
|---|---|---|
| `colourKit`: the 5 colours plus grey, glyph textures, a recolourable material helper (one material per colour, shared across instances so draw calls stay low), the colour-blind palette | new small shared module | all ten |
| `echoMaterial`: a grey smoked-glass shader with emissive prism cracks and one coloured "weak plate" slot driven by uniforms, applied to the ready boss GLBs | `boss` | 11, 21, 22, 25, 26, 29, 39, 48 |
| `roundManager`: rounds and waves, call → countdown → resolve, best-of-N match flow, eliminated-player "ghost" role | new, next to `boss` | 21 L5, 25 party, 26, 48 |
| `stars` custom third goal: survival games swap "time target" for a declared goal (knock-offs, dome HP), still proven in `maxScore` | `stars` | 26, 48 |
| `boss` environment damage: the boss takes hits from scene objects (cannons, beams, pens), not only from hero contact | `boss` | 25, 29, 30, 39 |
| `parkedHeroes`: tagged-out heroes stay in the world as ball bodies; tag-in with a camera pan; checkpoint gather | `heroTag` extension | 22, 50 P2 |
| Puzzle solver for tests: BFS over room states proves every room is solvable from any recall | test util | 22, 39 |
| `trialKit`: the cannon aim (43), swing physics (45), beat clock (36), rail graph and junction (35) and portal pairs (24) extracted as reusable modules. Per CLAUDE.md, generic code lives in shared code, never inside another game's folder. | shared, built with those games | 50 |
| `players` bench pool + player rings + high-five swap | `players` (M1) | all co-op modes |

---

## 3. Design cards

### 11 Roll Dash  (World 6, all colours)
**One-line hook:** Roll down Greytown's causeway to the fortress, where every obstacle is a lock that only one hero's power opens: read the glyph ahead, tag the right hero, fire.

**Signature mechanic:** a 3-lane ball-roll runner with "Prism Locks".
- **Controls:** auto-forward. Left/right changes lane in 0.18 s. Space/up jumps 1.4 m. Down tucks under. Action fires the active power. Tag uses the `heroTag` inputs.
- **Speed:** 9 m/s in L1, rising to 15 m/s in L5.
- **Prism Locks** light up a fixed *time* ahead, not a distance: 2.0 s in L1, 1.1 s in L5. Each carries a colour and a glyph:

| Lock | Colour | Opened by |
|---|---|---|
| Cracked barricade | Red | Riko's dash breaks it |
| Tall grey barrier, 3 m | Blue | Nami's double jump clears it |
| Drain spray / tesla arc | Green | Kiro's shield passes it |
| Coin vault | Yellow | Zuno's magnet rips out a coin trail and opens a slot |
| Ghost wall | Purple | Vexa phases through it |

- Single locks block one lane: you may dodge round them, or open them for the reward.
- **Full locks** span all 3 lanes: you must answer them.
- A correct unlock gives +1 combo, a 1.5 s +1.5 m/s boost, and a 20 m wave of colour refilling the street behind you.
- **Clutch tag:** tagging in the last 0.4 s before a lock gives a bonus.
- Wrong hero on a full lock: bounce back and lose 1 heart.

**Why it's different from:**
- 46 Color Door Sprint (W1): one hero matches door colours by lane choice. Here colour means a *power action*, and the verb is tag-and-fire.
- 17 Alien Lane Escape (W5): lane dodging. In Roll Dash, dodging is the fallback and the score comes from answering locks.

**Hero roles:**
- Riko opens red locks and dash-breaks crate stacks for orb pockets.
- Nami clears tall barriers, and her rooftop ledges hold high orb lines.
- Kiro crosses drain sprays and tesla arcs (`m2TeslaCoil` reused).
- Zuno pulls hidden coin trails out of vault walls, and gold vaults lead to side alleys.
- Vexa phases through ghost walls into back streets that are shortcuts.

**Levels:**
- **L1 Gate Street** (600 m, 9 m/s, 3 lock types). Three beats:
  1. Red barricades in one lane. The Riko portrait pulses with the chevron.
  2. A blue barrier. Tag to Nami and hop it.
  3. A full lock pair, red then blue, 1.5 s apart.
- **L2 Market Lane** (900 m, 11 m/s). Twist: yellow vaults and purple ghost walls join, plus **double locks**: a ghost wall with a barricade 6 m behind it, so you tag Vexa, phase, then tag Riko within 0.7 s. This is a Hand-off showcase.
- **L3 Old Town** (1200 m, 12.5 m/s). Twist: grey shadow rollers (`m2ShadowArmadillo`) roll in the lanes and **repaint** a lock once, 1.0 s before you reach it. Read the late change. Grey ore carts (`m2OreCart`) cross the lanes.
- **L4 Night Causeway** (1500 m, 14 m/s). Twist: darkness. Locks show their colour only inside street-lamp light (`m2StreetLamp`). Prism Lock zones disable tagging for 2 s, so you must be the right hero *before* you enter them.
- **L5 Fortress Bridge**, boss "Echo Storm Hawk" (about 2000 m, 15 m/s):
  - **P1 (100–60 %):** the Hawk flies ahead and drops feather-locks. Every lock opened with the right hero fires a prism spark into it. 6 hits.
  - **P2 (60–25 %):** it swoops back down a lane, telegraphed by a lane shadow for 1.2 s. Dodge it. At the bottom of the swoop its wing plate glows one colour for 1.0 s: tag to that hero and jump into it. 3 hits.
  - **P3 (25–0 %):** gust waves push you one lane sideways every 2 s while full locks come every 2 s. Then the Hawk lands on the bridge gate (`skyFortressGate`) with 5 coloured plates in a row 0.6 s apart. Tag through all five while rolling past, a forced Full Prism. Slow-mo shatter.

**Stars:** clear / all colour orbs (30–60 per level, many behind single locks and gated alleys) / target time. The run is auto-speed, so the time comes from boosts: the target needs about 85 % correct unlocks. No-hit bonus.

**Secrets:**
- L2: a ghost wall at 600 m opens into a sticker courtyard.
- L3: a gold vault's coin trail leads into an alley shortcut that saves about 4 s.
- L4: Riko cracks a red shop window to a rooftop line with a colour shard.
- L5: a Nami ledge over the bridge arch holds a shard.

**Juice moments:** locks shatter into hero-coloured glass. The street repaints in a rolling wave and lamps flicker on. Each lock plays its hero's chime, so a clean chain is a melody. Camera kick on full locks, a speed-line FOV push during boosts, and the Hawk's slow-mo plate shatter.

**Multiplayer (1-4):**
- **Co-op relay (2–4):** a 6-lane wide street on one shared camera. Players own heroes from the bench pool. Locks spawn across both halves, so the player who holds the right hero must swerve into the partner's lanes. The high-five swap passes a hero over on the move.
  - **Co-op-only twin locks:** a two-colour gate that needs both heroes at once, side by side.
- **Versus race (2–4):** same seed, private rosters, split screen (2 side by side, 3–4 in a 2×2 grid). Each correct unlock drops a grey slick in the rivals' matching lane 3 s later. First to the gate wins.
- **Ghost race:** before M2, race friends' recorded runs.
- **Camera:** shared for co-op, split for versus.

**Assets:**
- Reuse from `roll-dash/`: `m2GoldCoin`, `m2MarketStall`, `m2OldTownHouseBg`, `m2StreetLamp`.
- Reuse from `color-city-sprint/`: `m2CityBarrier` (blue barrier), `m2TrafficCone`, `m2StreetJumpRamp`.
- Reuse from `energy-core-hunt/`: `m2ArenaCrate` (crates, red barricade stacks), `m2TeslaCoil` (green lock).
- Reuse from `switch-color-hero/`: `m2EnergyBarrierWall` (ghost wall, translucent).
- Reuse from `mine-tunnel-run/`: `m2OreCart` (grey cart).
- Reuse from `menu2/` root: `skyFortressGate`.
- Reuse from `shared/`: `m2ShadowArmadillo`, `m2StormHawkBoss` (echo).
- New: none.

**Risks:**
- Reading glyphs at 15 m/s. Fix: time-based lead, big glyph billboards and colour-blind glyphs.
- "Always the same 5 answers". Fix: double locks (L2), repaints (L3), light-gated reading (L4), a daily seed.
- Touch tag speed. Fix: direct portrait select.

---

### 21 Color Match Jump  (World 6, all colours)
**One-line hook:** Hop across hex pillars over the void, where only a landing in your own colour holds: tag in mid-air so the right hero touches down.

**Signature mechanic:** **landing match.**
- **Hexes:** `m2HexPlatform` / `m2HexPillar`, 2 m across, at heights 0–4 m.
- **Match:** landing on a hex of your active colour holds solid and lights it. You get +1 combo and a 0.15 s "stick" for a clean next jump.
- **Wrong colour:** the hex cracks (`m2CrackedHexPlatform`) and drops 0.6 s later. You can still jump off it, but you cannot stay.
- **Grey hexes** are neutral: safe, no combo.
- **Jump:** a tap is a 1.6 m hop, a hold is a 2.4 m long jump. Airtime is 0.55–0.7 s, the tag window. Fresh legs means a mid-air tag into Nami gives her double jump.
- **Codes:** the countdown beacon (`m2CountdownBeacon`) shows a **code**, a sequence of 3–6 colours. Land on hexes in that order to "crack the code": an orb burst plus beacon time.
- **Pressure:** a sink wave drops the rear rows of the field, 1 row per 3 s in L2 and per 1.8 s in L4. The goal is to reach the crown platform at the far end with N codes cracked.

**Why it's different from:**
- 26 Color Arena Survival: you stand and shove on a flat floor between calls. Here you keep moving, and every landing is the colour check.
- 7 Neon Cube Jump (W5): timed hops on a fixed rhythm. Here the challenge is the colour you are in at touchdown, chosen mid-air.
- 32 Plate Bounce Arena (W4): bounce pads, no colour check.

**Hero roles:**
- Riko dashes across 4–5 m gaps between pillar clusters (the long-jump shortcut lines).
- Nami's double jump reaches tall pillars with orbs and high codes.
- Kiro crosses grey lightning curtains strung between pillars.
- Zuno pulls orb trails off distant hexes you cannot reach in time.
- Vexa phases through ghost pillars that block the straight line, a shortcut.

**Levels:**
- **L1 Two-Tone Steps:** red and blue only, no sinking. Three beats:
  1. A row of red hexes. Riko just hops.
  2. One blue hex ahead. The Nami portrait pulses during the jump.
  3. Alternating R/B stepping stones over a short void: tag on every jump.
  - The crown at 40 m, 5 rounds of codes as the spec asks.
- **L2 Three Calls:** yellow joins. Beacon codes of 3–4. The sink wave starts at 1 row / 3 s. 8 codes.
- **L3 Shifting Hues:** hexes change colour on a 4 s cycle, with the colour fading for 0.8 s before the change. Pillars rise and sink 1 m on a 3 s period. 12 codes.
- **L4 Fast Countdown:** all 5 colours. Codes of 5–6. Sinking at 1 row / 1.8 s. Glassy hexes slide you 0.4 m on landing. 16 codes.
- **L5 Frozen Crown**, boss "Echo Frost Golem", on a ring field of radius 14 m around the golem:
  - **P1:** it slams and freezes a ring of hexes into grey ice (neutral and slippery). Its back carries 3 colour cores. Crack a 4-hex code whose last hex sits right behind it, and the code pulse shatters the matching core. 3 hits.
  - **P2:** it hurls ice boulders that delete hexes (shadow telegraph 1.0 s) and crouches with its head plate glowing a colour. Land the matched hex beside it, double-jump (Nami, or any hero tagged in as fresh legs) onto its shoulder, and be the plate colour at the stomp. 3 hits.
  - **P3:** the whole field recolours every 2 s. Survive 20 s and grab 5 prism shards that pop on matched hexes. The 5th shard launches you over its head for the slow-mo finish.

**Stars:** clear / all orbs (high pillars and gated lines) / target time to the crown. No-hit means no cracked landing.

**Secrets:**
- L2: a ghost pillar hides a sticker hex.
- L3: a Riko dash line across the void reaches an island with a shard.
- L4: a perfect code-6 in under 4 s opens a hidden crown route.

**Juice moments:** a ring ripple of colour across the hex on a match. A matched code lights the whole path in sequence, like a melody. The crack-and-drop has a glassy crunch, a little camera dip and a red vignette. Golem cores burst in their colour.

**Multiplayer (1-4):**
- **Versus "Code Breakers" (2–4):** same field, shared camera (the field is compact). Each player gets their own code on their own beacon colour. Matched hexes flash in the player's ring colour. A wrong landing cracks the hex **for everyone**, so sabotage by cracking a rival's next hex is legal. Most codes in 120 s wins.
- **Party "Last Hex Standing":** a `roundManager` match. The field sinks from the edges, and the last player on a hex wins the round. Eliminated players become grey ghosts who may freeze one hex grey per round.
- **Co-op (2–4):** shared field. A Nami player can boost a partner onto a tall pillar.
  - **Co-op-only twin hexes:** two adjacent hexes of different colours that must be matched within 0.5 s of each other to raise a bridge.
- **Camera:** shared, fitted.

**Assets:**
- Reuse from `color-match-jump/`: `m2HexPlatform`, `m2HexPlatformV2`, `m2CrackedHexPlatform`, `m2HexPillar`, `m2CountdownBeacon`, `m2SignalOrbLamp` (code lamps), `m2FloatingArenaBg`.
- Reuse from `shared/`: `m2FrostGolemBoss` (echo).
- New: none.

**Risks:**
- Mid-air tagging is hard on touch. Fix: direct portrait select, airtime ≥ 0.55 s, L1 with only 2 colours and no sinking.
- Random fields can be unwinnable. Fix: fields are seeded and validated (a reachable matched path within the jump range always exists).
- Visual noise from 5 colours. Fix: glyphs plus a desaturated grey base for the hexes you are not looking at.

---

### 22 Switch Color Hero  (World 6, all colours)
**Genre change:** from "colour-gate runner" to "tag-relay puzzle platformer". Gate running is already covered by 11 Roll Dash and 46 Color Door Sprint. The title still fits, so it stays.

**One-line hook:** The hero you tag out stays behind: park heroes on colour switches to hold the Spire's gates open, then tag back to them across the room.

**Signature mechanic:** **parked heroes** (`parkedHeroes`).
- Tagging out leaves the outgoing hero curled as a ball on the spot.
- Tagging in to a parked hero moves control to that hero's position, with a 0.35 s camera pan.
- **Colour switch** (`m2SwitchPlatform`): holds its gate (`m2ColorGateArch`) open while a hero **of that colour** sits on it. Grey switches take any hero.
- **Energy barriers** (`m2EnergyBarrierWall`): only the hero of the barrier's colour passes.
- A parked ball is a 1 m step for others, and has weight (some switches need weight 2).
- **Recall:** hold tag for 0.6 s to send every parked hero back to the room's start. It is a reset, never a shortcut.
- **Checkpoint pads** (`m2CheckpointFlagPad`) gather all parked heroes when the active hero reaches them, with a rolling "whoosh" home.
- Rooms are at most 20 × 12 m, so one fitted camera shows the whole puzzle.

**Why it's different from:**
- 39 Color Bridge Builder: there you mix light beams. Here the puzzle pieces are your own heroes.
- 44 Crystal Cave Switch (W5): toggle switches with one hero. Here you are in several places at once.

**Hero roles:**
- Riko dashes 6 m gaps and breaks cracked floor to drop a parked hero onto a lower switch.
- Nami reaches high switches and is the best parker on raised plates.
- Kiro parked is **immovable**: patrol bots cannot push him.
- Zuno's magnet drags a parked hero ball along magnet rails, so he moves pieces without tagging.
- Vexa phases through ghost walls and, while phased, through barriers of **any** colour for 0.8 s.

**Levels:**
- **L1 Two Switches:** heroes R, B, G. Three beats:
  1. A red switch with a red gate: park Riko, tag Nami, walk through.
  2. A blue barrier only Nami passes.
  3. The relay: Riko parks on the red switch, Nami passes the blue barrier and stands on a blue switch that opens Riko's way, then tag back to Riko and walk to the pad.
  - 8 gates in the spec's sense, over 4 rooms.
- **L2 Weight & Steps:** twist: switches of weight 2 (two parked heroes), ball-stools, and timed switches that stay open 4 s after you leave them.
- **L3 Patrols:** twist: grey patrol bots (`m2PatrolBot`, echo-tinted) push parked heroes off switches on fixed routes. Kiro and Zuno's rails become key.
- **L4 Twin Rooms:** twist: rooms come in linked pairs. A switch in room A holds a gate in room B. Doors close 6 s after you tag away, a speed relay.
- **L5 Spire Roof**, boss "Echo Mothership" (`m2AlienMothership`, echo):
  - **P1:** a tractor beam sweeps the roof (telegraph circle 1.5 s) and abducts parked heroes caught in it, until a checkpoint returns them. Keep parked heroes under awnings. Three coloured pods drop beam generators onto switches: park the matching hero on a pod's switch and it overloads. 3 hits.
  - **P2:** it abducts your most recently parked hero for real. Solve a 3-switch rescue room in 30 s while it fires grey bolts. The rescue opens a prism mirror that reflects its own beam back. 1 big hit, plus the hero comes back.
  - **P3:** it descends to 6 m. Five switches ring the roof and slide 2 m every 4 s. Park all five heroes on their matching switches at once (the last one is you), and the Prism Lattice fires. Slow-mo.

**Stars:** clear / all orbs (many on switch-only ledges) / target time (par set by the solver's fastest tag route plus 25 %). No-hit.

**Secrets:**
- L2: stack 3 heroes into a tower to reach a sticker vent.
- L3: a Zuno rail drags a hero into a hidden shard alcove.
- L4: a Vexa all-colour barrier skip saves a whole room.

**Juice moments:** gates bloom open in their colour. Parked heroes idle (peeking out of the ball, a little yawn). Recall makes all balls roll home with a domino chime. The lattice finish draws five beams converging.

**Multiplayer (1-4):**
- **Co-op is the star (2–4).** Each player owns a hero, the bench heroes can be parked by anyone, and players can stand on switches themselves.
  - **Co-op-only "hold rooms":** two live players must hold two switches while a third crosses. Parking alone cannot solve them, because those switches need a live hero.
  - The high-five swap trades colours on the spot.
  - Shared fitted camera: a room fits on one screen.
- **Versus "Relay Race" (2):** mirrored spire, same puzzles, split screen. Fewest tags breaks ties.
- **Party:** not a fit.

**Assets:**
- Reuse from `switch-color-hero/`: `m2SwitchPlatform`, `m2ColorGateArch`, `m2ColorGateArchV2`, `m2EnergyBarrierWall`, `m2EnergyPickup`, `m2CheckpointFlagPad`, `m2SciFiSpireBg`.
- Reuse from `shared/`: `m2PatrolBot`, `m2AlienMothership` (echo).
- Reuse from `menu2/` root: `movingBlock` (sliding switches).
- New: none.

**Risks:**
- Softlocks. Fix: Recall, plus the solver test proves every room solvable from the recall state.
- Puzzles that feel slow. Fix: tag-in pans of only 0.35 s, rooms ≤ 90 s, a par-time star.
- Too many balls on screen. Fix: at most 5 parked heroes, rendered as instanced balls at a distance.

---

### 25 Paint the Platforms  (World 6, all colours)
**One-line hook:** Repaint Shadow Plates' grey mural tile by tile. Every tile needs a set colour, so tag heroes to switch your brush, and lock each line before the grey roller wipes it.

**Signature mechanic:** **paint-by-numbers with hero brushes.**
- **Floor:** the courtyard is a tile grid (`m2PaintTile`, 1.5 m), 8 × 8 in L1, up to 16 × 16 in L5.
- **Mural:** the easel (`m2EaselBg`) shows the target mural as pixel art: a sun, a flower, the five heroes. The same mural shows as a faint grey outline under the floor.
- **Painting:** rolling over a tile paints it your active colour. Correct tiles sparkle. Wrong ones can be repainted.
- **Set:** a full row or column matching the mural "sets" and locks, scoring and safe from erasing.
- **Paint supply:** each hero carries 30 tiles of paint, shown as a fill on the portrait. Buckets (`m2PaintBucket`) refill the active hero. Benched heroes refill 1 tile/s, a reason to rotate.
- **Pressure:** the Giant Paint Roller (`m2GiantPaintRoller`) rolls lanes and greys every unlocked tile, telegraphed by a lane glow for 1.5 s.
- **Goal:** % of the mural matched (30 → 80 % as in the spec).

**Why it's different from:**
- 23 Gem Collector 3D (W4): collect the matching colour. Here you place colour to a plan.
- 26 Color Arena Survival: shove-sumo. The free-paint turf war exists here only as a party mode.

**Hero roles:**
- Riko's dash paints a 5-tile streak in 0.3 s, and breaks cracked walls into a hidden mural corner.
- Nami's double jump plus a slam splashes a plus shape of 5 tiles, and reaches balcony buckets.
- Kiro shielded in a lane stops the roller for 2 s, to protect a nearly set line.
- Zuno pulls paint pickups (`m2PaintPickup`) from across the courtyard.
- Vexa phases through the roller and through the arena walls (`m2ArenaWall`) between courtyard sections.

**Levels:**
- **L1 First Strokes** (8 × 8, red sun on blue sky, 30 %, 60 s). Three beats:
  1. Roll the red outline tiles.
  2. Tag Nami and fill blue.
  3. Finish a row and watch it set.
- **L2 Paint Supply** (10 × 10, 3 colours, 40 %): twist: limited paint and buckets.
- **L3 Sliding Rows** (12 × 12, 50 %): twist: conveyor rows shift 1 tile every 3 s, so the mural alignment moves under you. Set lines stop sliding.
- **L4 Roller Rush** (14 × 14, 65 %, 105 s): twist: the Giant Roller plus grey eraser drones (`m2FactoryDrone`, echo-tinted) that hover and grey a tile every 2 s until bumped.
- **L5 Frosted Mural** (16 × 16, 80 %), boss "Echo Candy King" (`m2CandyKingBoss`) on a corner tower. He sprays grey frosting splats of 2 m (shadow telegraph 1.0 s).
  - **P1:** set lines charge the four corner towers (`m2ArenaCornerTower`). His crown gem shows a colour. Roll into a charged tower's base as that hero to fire it. 3 hits.
  - **P2:** he rides the roller, homing at 4 m/s. Lure it over set lines: locked paint is slick, so it topples for 2.5 s. Bump his exposed back as the crown colour. 3 hits.
  - **P3:** he frosts the whole mural except set lines. Paint the final 5 × 5 portrait of the five heroes in 25 s, and all towers fire.

**Stars:** clear (target %) / all orbs / target time to reach the target %. No-hit.

**Secrets:**
- 100 % mural: a shard.
- A ghost-wall corner mural reveals a sticker when painted.
- In L3, a Nami balcony bucket of "prism paint" paints any colour correctly for 5 s.

**Juice moments:** paint squelch and splat decals. A set line plays a xylophone run across its tiles. The mural on the easel comes alive as you paint it. The roller wipe makes a grey shush, and the Candy King's crown shatters into sprinkles.

**Multiplayer (1-4):**
- **Party "Colour Claim" (2–4, 90 s rounds):** no mural. Each player picks a team colour and keeps that one hero (`tag: "off"`). Most tiles wins. Five tiles of your colour in a line set and lock. The roller is a neutral hazard, and Kiro-style shield bumps stop it. A great TV mode.
- **Co-op "Mural Crew" (2–4):** one shared mural, with colours split by who owns which hero. Coordination happens through colour. The roller targets the player with the most unset tiles.
- **Versus "Mirror Murals" (2):** the same mural on two halves of the courtyard. Set lines on your side push the roller onto the rival's side.
- **Camera:** shared (the courtyard fits; at 16 × 16 the camera tilts up to 62° for readability).

**Assets:**
- Reuse from `paint-the-platforms/`: `m2PaintTile`, `m2PaintBucket`, `m2PaintPickup`, `m2GiantPaintRoller`, `m2ArenaWall`, `m2ArenaCornerTower`, `m2EaselBg`.
- Reuse from `shared/`: `m2FactoryDrone`, `m2CandyKingBoss` (echo).
- New: none. Tiles are one instanced mesh with per-instance colour.

**Risks:**
- Tedious filling. Fix: dash streaks, slam splashes, small murals, set lines as mid-goals.
- Hard to see which tile needs what. Fix: the outline under the floor shows a glyph per tile, and the easel highlights the row you are on.
- Performance at 256 tiles. Fix: a single instanced mesh with a colour attribute.

---

### 26 Color Arena Survival  (World 6, all colours)
**One-line hook:** Roll-ball sumo in a crumbling colosseum: the beacon calls a colour, every other tile falls, and you shove your rivals off whatever is left.

**Signature mechanic:** **colour-call sumo.**
- **Rounds** (`roundManager`):
  1. The beacon tower (`m2BeaconTower`) calls a colour with its glyph and chime.
  2. A countdown runs: 4.0 s in L1 down to 1.6 s in L5.
  3. Every tile **not** of that colour crumbles (`m2CrumblingTile`) and drops for 3 s.
  4. The floor rises again in a new pattern: stripes, rings, spirals, checkers.
- **Bumping:** contact between roll-balls applies an impulse from the speed difference. Hold Action 0.4 s to charge a heavy bump (2× impulse), then release.
- **Anchor rule:** standing on a tile of **your active colour** halves the knockback you take. When the call is green, everyone races for green tiles, and the one who is Kiro there is the heavy one.
- **Golden safe markers** (`m2SafeMarker`) never fall and are worth fighting for.
- **Score:** rounds survived plus rivals knocked off.

**Why it's different from:**
- 21 Color Match Jump: traversal by landing.
- 32 Plate Bounce Arena (W4): bounce pads and height.
- Here the verb is shove-and-anchor on a floor that a colour call decides.

**Hero roles:**
- Riko: dash-bump, the strongest hit (2.5× impulse).
- Nami: double jump hops a gap or dodges a charge.
- Kiro: shield gives immunity to knockback for 1.5 s and reflects half the bump.
- Zuno: magnet yanks the nearest rival 3 m toward you, off their tile.
- Vexa: phase passes through a bump, or hovers 0.8 s over a falling tile.
- Hero-gated arena-edge ledges hold orbs:
  - Nami: high balcony.
  - Riko: cracked parapet.
  - Vexa: ghost gate to the stands.

**Levels:**
- **L1 Slow Rounds** (5 rounds, 4.0 s). Three beats:
  1. Call red: roll to the red block.
  2. Call blue: tag Nami on the tile and feel the anchor (the tip appears once).
  3. A slow shadow rival (`m2ShadowArmadillo`) arrives: bump it off.
- **L2 Three Colours** (8 rounds, 3.2 s): twist: 2 rivals and golden safe markers.
- **L3 Five Colours** (12 rounds, 2.6 s): twist: moving patterns (rings rotate during the countdown) and a heavy rival (`m2ShadowArmadilloR`, 1.5× mass).
- **L4 Double Calls** (16 rounds, 1.8 s): twist: two-colour calls ("RED + BLUE") and spawn pads (`m2SpawnPad`) that launch rivals in mid-round.
- **L5 Crab Colosseum**, boss "Echo Giant Crab" (`m2GiantCrabBoss`):
  - **P1:** it sweeps a claw over the called colour's tiles (arc telegraph 1.0 s). After each sweep the claw rests on the floor, glowing that colour for 2 s. A charged bump by the hero of that colour hits it. 3 hits.
  - **P2:** fake calls. The crab's shell flashes a colour that is not the beacon's: read the beacon. During each drop, lure it over the falling tiles. It sinks half in, stuck for 3 s, with its belly plate open: bump it as the plate colour. 3 hits.
  - **P3:** the arena shrinks to one ring and the crab charges across. Survive 4 fast calls, then block its charge with Kiro's shield and Hand-off into Riko's dash within 0.4 s, which knocks it over the edge. Slow-mo.

**Stars:** clear / all orbs (orbs pop on tiles during drops, so they are risky) / **custom third goal** "knock-offs ≥ N" (L1 1, L5 8). Survival levels have a fixed length, so a time target would mean nothing. L5 uses a target time. No-hit.

**Secrets:**
- L2: the stands hold a sticker behind the ghost gate.
- L3: surviving a round on the single golden marker of a "zero tile" call drops a shard.
- L4: a Riko-cracked parapet holds a hidden spawn pad that launches you to an orb ring.

**Juice moments:** tiles crumble in waves outward from the beacon. Heavy bumps get a hit-stop (60 ms) and a ring shockwave. Falling rivals spin with a comic whistle. Each call plays its hero's motif sting. The crowd in the colosseum backdrop regains colour row by row.

**Multiplayer (1-4):** the flagship party game of W6.
- **Party "Prism Sumo" (2–4, best of 5 rounds):** last hero standing, private rosters, player rings and number badges.
  - Eliminated players become **Grey Ghosts** floating overhead: once per round they drop a grey splat that makes one tile fall early. Nobody waits out a round with nothing to do.
- **Party modes:**
  - **King Tile:** score per second on the golden marker.
  - **Team 2v2:** a teammate bump gives a speed boost instead of a knockback.
  - **Hot Call:** the player who survives a round with the fewest tiles under them picks the next call.
- **Co-op (2–4):** survive waves of shadow rivals and the crab together. A Kiro player's shield bubble covers a partner at 1.5 m.
- **Camera:** shared, fitted to the arena (a fixed frame, never chasing).
- **M2 note:** bumps are resolved in `rules.ts` on a fixed 60 Hz step so the server can be authoritative.

**Assets:**
- Reuse from `color-arena-survival/`: `m2SurvivalFloorTile`, `m2CrumblingTile`, `m2BeaconTower`, `m2SafeMarker`, `m2SpawnPad`, `m2ColosseumBg`.
- Reuse from `plate-bounce-arena/`: `m2BumperPost` (edge posts).
- Reuse from `shared/`: `m2ShadowArmadillo`, `m2ShadowArmadilloR`, `m2GiantCrabBoss` (echo).
- New: none.

**Risks:**
- Chaos and luck. Fix: symmetric spawns, patterns that always leave each called colour within reach of every player, and the anchor rule rewarding skill.
- Ganging up on one player in a 4-player party. Fix: a short bump immunity (0.6 s) after being hit.
- Physics divergence online. Fix: deterministic fixed-step resolution.

---

### 29 Energy Core Hunt  (World 6, all colours)
**One-line hook:** Energy cores are skittish sparks that flee from heroes of every other colour: herd them into corners with the wrong colours, then tag to the right one and scoop.

**Signature mechanic:** **herding.**
- **Cores:** core sprites (`m2CoreSprite`, recoloured) wander a 30 × 30 m reactor floor.
- **Fleeing:** a core flees any hero of **another** colour within 4 m, at 5.5 m/s against the hero's 6 m/s. It also edges away from its **own** colour hero within 2 m, but that hero scoops it on touch.
- So you herd with the wrong colours from far (a big push radius), pin the core against a crate or wall, then tag to the right colour and snatch it.
- **Tiring:** a core that has fled for 6 s tires (3 m/s, a panting animation), so a chase never runs forever.
- **Carrying:** carry up to 3 cores, which orbit the squad and stay through tags.
- **Recipe:** the reactor pylon (`m2CorePylon`) shows one, for example "2 red, 1 blue, 1 yellow". Deliver through the core gates (`m2CoreGate`). A wrong core sparks the reactor and costs 3 s.
- **Pens:** capsules (`m2CoreCapsule`) with doors. Herd a core into an open pen and it closes, auto-delivered with a bonus.

**Why it's different from:**
- 23 Gem Collector 3D (W4): static gems.
- 42 Magnet Coin Lab (W4): magnetism is the core verb there.
- Here the pickups are living and run away, and colour decides whether you push or catch.

**Hero roles:**
- Riko dashes to cut off a fleeing core.
- Nami reaches high crate tops where cores hide.
- Kiro herds through tesla arcs (`m2TeslaCoil`), where cores pass unharmed.
- Zuno's magnet pulls **any** colour core toward him for 3 s, overriding fleeing, though he still cannot scoop off-colour cores.
- Vexa's phase makes her invisible to cores for 0.8 s (sneak up), and passes crate walls.

**Levels:**
- **L1 First Sparks** (recipe 6, 3 colours, 60 s). Three beats:
  1. A red core in a dead-end corridor: Riko walks up and scoops it.
  2. A blue core flees from Riko into a corner: tag Nami and scoop.
  3. The first recipe at the reactor.
- **L2 Pens** (recipe 9, 4 colours): twist: pens whose doors close 1 s after a core enters.
- **L3 Two Floors** (recipe 12): twist: a two-level arena with ramps, plus grey decoy cores that burst into a scare cloud scattering every core within 6 m.
- **L4 Flocks** (recipe 15): twist: cores move in flocks of 3 (boids) and split when scared. The recipe changes every 25 s, and the tesla coils pulse on a 4 s cycle.
- **L5 Reactor Core**, boss "Glass Glutton" (`m2GummyMonster` at 4×, echo glass):
  - **P1:** it inhales cores (a suction cone of 6 m, telegraphed by a 1 s wobble). Herd cores *away* from it into pens. A full pen of 3 same-colour cores fires a capsule beam at it. 3 hits.
  - **P2:** it charges at 6.5 m/s (lean telegraph 0.8 s). Kiro-shield through a tesla arc and it follows you into it: shocked, it spits out all cores. Scoop 3 recipe cores in 8 s and deliver: the reactor zaps it. 2 cycles.
  - **P3:** it splits into 3 small coloured gluttons that **flee like cores**. Herd each with other colours, tag, and ram it as its own colour. The last pop rains cores (score) in slow-mo.

**Stars:** clear / all orbs / target time. No-hit.

**Secrets:**
- L2: a Vexa ghost wall hides a golden core that counts as any colour.
- L3: a Nami crate tower holds a shard.
- L4: herding a whole flock into one pen at once drops a sticker.

**Juice moments:** cores squeak and scatter with little dust puffs. A scoop is a satisfying "pop-clink" as the core joins the orbit. The reactor fills like a gauge and roars on a recipe. The Glutton wobbles like glass jelly and cracks on hits.

**Multiplayer (1-4):**
- **Co-op "Ranch Crew" (2–4):** herding becomes teamwork. One player sweeps a line while the right colour waits at the corner.
  - **Co-op-only big cores (2× size):** they only stop fleeing when surrounded by two heroes, and need two players to scoop together.
- **Versus "Core Rustlers" (2–4):** each player has a reactor at a corner with their own recipe. Bump a rival to knock 1 core out of their orbit and steal it. Pens are neutral. Most recipes in 150 s wins. A party favourite.
- **Camera:** shared, fitted to the 30 × 30 floor with margin.

**Assets:**
- Reuse from `energy-core-hunt/`: `m2EnergyCore` (reactor charge, recipe icons), `m2ArenaCrate`, `m2CoreCapsule`, `m2CoreGate`, `m2CorePylon`, `m2TeslaCoil`, `m2ReactorBg`.
- Reuse from `shared/`: `m2GummyMonster` (Glass Glutton, echo).
- New: `m2CoreSprite`, MUST for L1. The skittish core is what the player looks at all game. The fallback is `m2EnergyCore` with squash-stretch hops.

**Risks:**
- Frustrating escapes. Fix: tiring after 6 s, rounded arena corners only where intended, the magnet assist, and pens.
- Arena too small on a phone (844 × 390). Fix: the fitted camera, with core screen markers at the edge when a core is offscreen.
- Boids cost. Fix: at most 20 cores, with flocking in pure `rules.ts` at 30 Hz.

---

### 39 Color Bridge Builder  (World 6, all colours)
**One-line hook:** Aim colour beams from energy nodes across the canyon, cross them to mix new colours, and walk each light bridge as the hero who matches it.

**Signature mechanic:** **beam mixing builds the path.**
- **Nodes and switches:** energy nodes (`m2EnergyNode`) emit beams. Colour switches (`m2ColorSwitch`) set a node to a primary: red, blue or yellow.
- **Bridges:** where a beam spans two bridge anchors (`m2BridgeAnchor`), it solidifies into bridge tiles (`m2BridgeTile`) of its colour.
- **Mixing:** where two beams cross, the segment after the crossing takes the mix:

| Beams | Mix | Who can walk it |
|---|---|---|
| Red + Blue | Purple | Vexa |
| Blue + Yellow | Green | Kiro |
| Red + Yellow | Orange | Anyone, but it **flickers** (0.8 s on, 0.8 s off), a timing bridge |
| All three | White | Anyone, solid |

- **Who can walk:** only the hero of a bridge's colour walks it. Others fall through softly and respawn at the last anchor, losing 1 s. Tag mid-bridge when the colour changes.
- **Prisms:** prisms (`m2LaserPrism`) turn a beam 90° when you roll into them. Splitter prisms fork it.

**Why it's different from:**
- 38 Laser Maze Run (W5): lasers are hazards you dodge. Here beams are the floor you build.
- 22 Switch Color Hero: the puzzle pieces there are parked heroes. Here they are light and colour mixing, which no other Menu 2 game uses.

**Hero roles:**
- Riko dashes 5 m gaps without a bridge.
- Nami reaches high anchors and nodes.
- Kiro's shield **blocks a beam** while he stands in it, cutting a mix on purpose.
- Zuno's magnet slides a prism along its rail from 6 m.
- Vexa's phase walks any colour bridge for 0.8 s.

**Levels:**
- **L1 Two Switches** (75 s). Three beats:
  1. A red node makes a red bridge: walk it as Riko.
  2. Switch a node to blue and walk it as Nami.
  3. Red and blue beams cross into a purple segment: tag Vexa mid-bridge.
  - 2 linked objectives.
- **L2 Prisms:** twist: yellow joins. Rotate prisms to aim. A green mix teaches Kiro.
- **L3 Split Bridge:** twist: splitters, half-bridges of two colours side by side, and orange flicker bridges.
- **L4 Timed Bridge:** twist: nodes stay on 10 s after you hit their switch, and grey drones (`m2FactoryDrone`) fly through beams and absorb them for 2 s.
- **L5 Canyon Gate**, boss "Echo Mega Robot" (`m2MegaRobotBoss`), a puzzle-boss. It marches toward the fortress gate over whatever bridges exist. It is heavy and walks any colour.
  - **P1:** while it crosses, change a mix under it to orange. It drops to a lower ledge, stunned, with its chest plate showing a colour. Route a beam of that colour into the plate. 3 hits.
  - **P2:** its arm lasers grey your beams and smash prisms (telegraph: the arm glows for 1.2 s). Kiro's shield blocks the arm laser. Zuno pulls spare prisms in. Cross two beams on its back plate. 2 hits.
  - **P3:** it climbs the final arch. Build a **white** bridge (all three primaries) to the top in 25 s, and Riko-dash into its core. Slow-mo.

**Stars:** clear / all orbs (on beam-only isles) / target time. No-hit.

**Secrets:**
- L2: a white bridge to a floating rock isle holds a sticker.
- L3: a Vexa phase over a flicker gap reaches a shard.
- L4: a hidden node behind a Riko-cracked rock completes the level in one beam.

**Juice moments:** beams hum at a pitch per colour, and crossing beams chord. Bridge tiles assemble with a crystalline clink from anchor to anchor. A white bridge blooms with a choir swell. The robot topples with dust and a camera kick.

**Multiplayer (1-4):**
- **Co-op "Bridge Crew" (2–4):** any player works switches and prisms.
  - **Co-op-only routes:** two heroes on two separate bridges at once hold a pressure prism, and a Kiro player's shield cut lets a partner cross on the changed mix.
  - Shared fitted camera per canyon section.
- **Versus "Bridge Duel" (2):** mirrored canyons, split screen. A "lob node" lets you send one beam into the rival's canyon every 20 s to recolour one of their bridges.
- **Party:** not a fit.

**Assets:**
- Reuse from `color-bridge-builder/`: `m2BridgeTile`, `m2BridgeTileV2`, `m2BridgeAnchor`, `m2BridgePylon`, `m2BrokenBridgeEnd`, `m2ColorSwitch`, `m2EnergyNode`, `m2FloatingRockIsle`, `m2CanyonBg`.
- Reuse from `laser-maze-run/`: `m2LaserPrism` (prisms, splitters).
- Reuse from `shared/`: `m2FactoryDrone`, `m2MegaRobotBoss` (echo).
- New: none.

**Risks:**
- Mixing rules are hard to learn. Fix: a mix-table chip in the HUD, a ghost preview of a beam's path while you stand by a prism, and glyphs on bridges (a purple bridge shows the spiral).
- Unsolvable states. Fix: the solver test, and the switches reset with Recall (hold tag).

---

### 48 Color Orb Defense  (World 6, all colours)
**One-line hook:** Orbs of every colour pour toward your dome: parry each one with the hero of its colour at the moment of contact, and ricochet it back into Shadow Plates' launchers.

**Signature mechanic:** **colour parry.**
- **Dome and lanes:** the dome beacon (`m2DomeBeacon`, 10 HP) sits in the centre, with 3–5 lanes from launchers (`m2OrbLauncher`) on the castle wall.
- **Orbs:** orbs (`m2EnergyOrb`, with `m2OrbBlob` as heavy orbs) roll at 4 m/s in L1, up to 9 m/s.
- **Parry:** touching an orb while your active hero matches its colour bounces it away.
- **Perfect parry:** Action within 0.15 s before contact. The same window on touch, keyboard and gamepad. The orb ricochets back down its lane into the launcher: 3 hits silence that launcher for 15 s.
- **Wrong colour:** you are knocked back 2 m and the orb keeps rolling.
- **Zone plates** (`m2ZonePlate`): standing on a matching plate auto-blocks that lane. It is static defence, but you can only hold one.
- **Shield pedestals** (`m2ShieldPedestal`): charged by parries, they fire a dome pulse that clears every orb.

**Why it's different from:**
- 40 Disc Target Throw (W3): you aim and throw at targets. Here you react and parry.
- 36 Temple Gong Timing (W3): rhythm timing on a beat. Here the timing is spatial and the colour must be switched first.
- 26: sumo, no projectiles.

**Hero roles:**
- Riko: dash reaches a far lane, and a dash-parry returns the orb at 1.5× speed.
- Nami: double jump intercepts lobbed arc orbs.
- Kiro: a shield parry blocks **any** colour, but gives no ricochet.
- Zuno: magnet clusters nearby orbs and slows them 50 % for 2 s.
- Vexa: phase slips through an orb to reach another lane.
- Gated orb pickups:
  - Nami: wall-walk ledge.
  - Riko: cracked buttress.
  - Vexa: ghost door into the launcher gallery.

**Levels:**
- **L1 Two Colours** (4 waves, 2 lanes). Three beats:
  1. Red orbs in one lane: parry as Riko.
  2. Blue orbs in lane 2: tag Nami.
  3. A slow orb with a perfect-parry prompt ring: ricochet it into a launcher.
- **L2 Three Colours** (6 waves): twist: zone plates rotate around the dome every 10 s.
- **L3 Four Colours** (8 waves): twist: lobbed arc orbs, and split orbs that break into two colours if parried wrong.
- **L4 Fast Waves** (10 waves, 8 m/s): twist: grey decoy orbs. Any hero may parry one, but a decoy that reaches the dome fires a Prism Lock.
- **L5 Keep Wall**, boss "Echo Magma Golem" (`m2MagmaGolemBoss`) on the castle wall:
  - **P1:** it hurls big orbs in a 3-colour sequence. A perfect parry returns one to its body, but it only hurts if its chest plate (which cycles every 4 s) matches the orb. 4 hits.
  - **P2:** it smashes the launchers into lava pools, so orbs come from 5 directions. A Prism Lock every 10 s means pre-tag. A **chain** (perfect-parry an orb into another orb) makes a prism shot. 3 hits.
  - **P3:** it leaps down and becomes a giant rolling orb that circles the dome, shifting colour. Parry it as the matching hero (a big 0.3 s window) to knock it back. After 3 parries it slams into the wall. Slow-mo.

**Stars:** clear (dome survives) / all colour orbs (here the collectibles are "prism shards", so they are never confused with enemy orbs; shard art is shared across Menu 2) / **custom third goal** "dome HP ≥ 7". No-hit = dome untouched.

**Secrets:**
- L2: a Vexa ghost door into the launcher gallery: silence a launcher from behind for a sticker.
- L3: 10 perfect parries in a row drops a shard.
- L4: a Riko-cracked buttress hides a spare pedestal.

**Juice moments:** each parry is a hit-stop of 40 ms with a ring of colour and a bat-crack. Perfect ricochets leave comet trails. Launchers cough smoke when silenced. The dome glows brighter with each pedestal charge. The golem orb parry gets a hard camera kick.

**Multiplayer (1-4):** a flagship party game.
- **Party "Dome Duel" (2–4):** each player has a dome at a corner of a cross-shaped arena, and centre launchers fire at everyone. A perfect parry aims with the stick during the window (8 directions), so it can **send the orb to a rival's dome**. Domes at 0 HP are out, and the last dome standing wins. Eliminated players take over a launcher (choose lane and colour every 3 s), so nobody sits out.
- **Co-op "Keepers" (2–4):** one shared dome. Players own heroes and the bench is contested.
  - **Co-op-only twin parry:** heavy orbs need two heroes to parry within 0.3 s of each other.
  - **High-five swap:** trades lanes and colours instantly.
- **Versus "Score Wall" (2):** same waves, split arenas, most ricochet hits wins.
- **Camera:** shared and fixed (a round arena of 24 m), for party, co-op and 2-player versus alike.

**Assets:**
- Reuse from `color-orb-defense/`: `m2DomeBeacon`, `m2EnergyOrb`, `m2OrbBlob`, `m2ZonePlate`, `m2ShieldPedestal`, `m2ArenaPillar`, `m2CastleWallBg`.
- Reuse from `gem-collector-3d/`: `m2ScoreBeacon` (wave counter).
- Reuse from `shared/`: `m2MagmaGolemBoss` (echo).
- New: `m2OrbLauncher`, MUST for L1. It is the ricochet target, visible all game.

**Risks:**
- Visual chaos with 5 lanes. Fix: lane telegraph arrows, glyph orbs, and per-colour pitch so you can hear what is coming.
- The parry window feels unfair. Fix: an identical window on every input, a visible approach ring, and a 0.15 s window that never shrinks (speed is the difficulty instead).
- Dome Duel ganging. Fix: launchers aim at the healthiest dome first.

---

### 30 Color Boss Tower  (World 6, all colours)
**One-line hook:** Climb the inside of Shadow Plates' hollow tower around the boss himself, charge the colour cores in its walls with the matching hero, and turn the tower's prism cannons on him.

**Signature mechanic:** **the boss fight is a climb, and the tower is your weapon.**
- **The tower:** a hollow tower of radius 12 m, with a spiral of platforms (`m2TowerPlatform` / `V2`) along the inner wall. The boss stands in the central shaft: the Stone Guardian in L1–4, Shadow Plates in L5.
- **Movement:** 2.5D on the cylinder. Left/right moves around, jump moves up.
- **Core claws** (`m2CoreClawHolder`) on the walls hold dormant cores (`m2EnergyCore`). Touch one as the matching hero to charge it.
- **Cannons:** a charged claw powers the nearest prism cannon (`m2PrismCannon`). It locks on and fires when the boss's weak plate opens.
- **Each level:** climb to the next floor ring and land N vulnerability cycles (2 → 6 as in the spec).
- **The boss's attacks:**
  - horizontal arm sweeps across a band of the spiral (telegraph: dust and a glow line, 1.0 s): jump or shield
  - hazard orbs (`m2HazardOrb`) rolling down the spiral
  - slams that crack platforms

**Why it's different from:**
- 28 Crystal Tower (W5) and 2 Rooftop Roll Climb (W1): climbs with no boss present. Here the boss is always there and you hit him only through the tower.
- 50: the final fight uses direct hero-power hits, not cannons.

**Hero roles:**
- Riko sprints the spiral and breaks cracked platforms before they drop.
- Nami's double jump skips a whole loop (a shortcut up). Fresh-legs tagging chains two skips.
- Kiro's shield blocks a sweep or a hazard orb.
- Zuno's magnet charges a claw from 6 m by pulling its core into the cannon line, for claws on ledges out of reach.
- Vexa phases through the boss's arm and through ghost panels in the shaft (a centre shortcut).

**Levels:**
- **L1 Gatehouse** (2 cycles). Three beats:
  1. Climb 2 loops and charge a red claw as Riko. The cannon fires at the dozing guardian and it wakes.
  2. Its slow sweep: jump it.
  3. A blue claw on a high ledge: Nami. Cycle 2.
- **L2 The Guardian Wakes** (3 cycles, 3 colours): twist: hazard orbs roll down the spiral.
- **L3 Crumbling Spiral** (4 cycles): twist: platforms drop 2 s after you land, and the guardian turns a tower segment 30° every 6 s, so the spiral shifts.
- **L4 Guardian's Fury** (5 cycles), boss "Stone Guardian", the tower's lieutenant:
  - **P1:** 4 claw colours.
  - **P2:** it climbs alongside you, a vertical chase. Cannons need a **chain charge** (two claws within 4 s) to double-fire.
  - It falls, revealing the crown.
- **L5 Crown of the Spire** (6 cycles), boss "Shadow Plates". The arena is a boss disc (`m2BossArenaDisc`) at the top, with 5 cannons and 5 claws on the rim:
  - **P1 Plate Armour (100–65 %):** he hovers in the centre wearing stolen colour plates. He throws grey plate-discs in arcs (landing circle 0.8 s) and spreads shadow pools that slow you. Every 12 s one claw lights: charge it with its hero, and its cannon blasts the plate of that colour off. The fallen plate lands as a temporary platform. 3 plates.
  - **P2 Spire Collapse (65–30 %):** he punches the disc into 5 floating fragments orbiting at different speeds, with the claws on the fragments. Hop between them (Nami, and fresh legs). His grey beam drains charged cores after 6 s, so you must fire **two cannons in one opening**: a Hand-off chain charge. 2 plates.
  - **P3 Grey Heart (30–0 %):** unplated, he tears the Prism Core out of the central claw and the cannons die. Climb the rising spiral of his falling plates, Prism Locks every 8 s. At the top, five glyphs light on the core one by one (0.8 s each): tag through all five heroes and hit each.
  - **End:** on the last hit he shatters the core, grabs the shards and escapes up through a rift into the Prism Heart (the hook for game 50). Slow-mo and a crown colour burst.

**Stars:** clear / all orbs (on loop-skip ledges) / target time. No-hit.

**Secrets:**
- L2: a Vexa ghost panel in the shaft leads to a sticker niche.
- L3: a Riko-cracked window outside opens a view over all six worlds and a shard.
- L5: catching all 5 falling plates before they vanish gives a hidden "plate collector" sticker.

**Juice moments:** cannon charge-up whine and a huge prism beam with screen shake. The guardian's stone chips fly off. Each broken plate clangs with its hero's motif. In the P3 tag finish each hit flashes its colour across the whole tower. The escape cutscene runs about 4 s and can be skipped.

**Multiplayer (1-4):**
- **Co-op (2–4):** shared camera around the cylinder. Players are kept within one loop of each other: a lagging player rides a bubble up after 3 s.
  - **Co-op-only twin claws:** cannons that fire only if two heroes charge two claws within 1 s, for double damage.
  - The bench pool decides who can charge which colour.
- **Versus "Spire Race" (2):** split screen, the same tower, and the boss targets the leader.
- **Ghost race:** before M2.
- **Party:** not a fit.

**Assets:**
- Reuse from `color-boss-tower/`: `m2TowerPlatform`, `m2TowerPlatformV2`, `m2CoreClawHolder`, `m2HazardOrb`, `m2BossArenaDisc`, `m2StoneGuardianBoss`, `m2DarkTowerBg`.
- Reuse from `energy-core-hunt/`: `m2EnergyCore`.
- Reuse from `shared/`: `m2VillainShadowPlates`.
- New: `m2PrismCannon`, MUST for L1. It is the core of the signature.

**Risks:**
- The cylinder camera can confuse, and the boss can hide the hero. Fix: the camera sits between the shaft and the wall looking outward and slightly up, the boss fades to 40 % with an outline when it covers the hero, and an arrow points to the next lit claw.
- A long L5. Fix: a checkpoint per phase, hearts refilled each phase.

---

### 50 Ultimate Color Trial  (World 6, all colours)
**One-line hook:** The finale: chase Shadow Plates through five trial gates, each remixing the signature verb of one world, then fight him inside the Prism Heart with all five heroes.

**Signature mechanic:** **the remix gauntlet under hero tag.** Each trial gate (`m2TrialGate` / `V2`) is a 20–35 s section that remixes one world's core verb through `trialKit`:

| World | Trial | Remixes | What you do |
|---|---|---|---|
| W1 Ember Heights (red) | Ember Trial | 43 Roll Cannon Jump | Aim and fire from cannon isles (`m2CannonIsle`) onto trampolines (`m2Trampoline`) |
| W2 Sky & Sea (blue) | Sky Trial | 45 Sky Hook Swing | Grapple-swing between hook posts (`m2GrappleRingPost`, `m2SwingAnchor`) |
| W3 Wild Temples (green) | Wild Trial | 36 Temple Gong Timing | Strike gongs on the beat (`m2TempleGong`, `m2TimingRing`) to raise steps |
| W4 Frost & Sweets (yellow) | Frost Trial | 35 Color Rail Grind | Grind rails and flip junctions (`m2RailSegment`, `m2RailSwitch`, `m2GrindRing`) |
| W5 Neon Cosmos (purple) | Neon Trial | 24 Portal Hop | Portal pairs (`m2PortalFrame`, `m2PortalIsle`) |

- Across every trial the W6 tag applies, and each trial has power-locks that need the other heroes.
- The remixes follow the approved cards of those five games. If a card changes, this trial follows it.
- Trial checkpoints sit at each gate (`m2TrialCheckArch`).

**Why it's different from:** every other game has one verb. This one is the exam of all six worlds. Its boss is fought by direct hero-power hits, unlike the cannons of game 30.

**Hero roles:**
- Each trial has a **spotlight hero**, the hero of its world, who gets a +50 % combo there.
- Gated routes still apply everywhere: Riko breaks a cracked cannon wall to a better angle, Nami reaches high hooks, Kiro shields through drain curtains on the rails, Zuno pulls coin trails along swing arcs, Vexa ghost-phases between portal pairs.

**Levels:**
- **L1 Ember & Sky Gates** (3 sections): Ember Trial, Sky Trial, then a short tag gauntlet. Three teaching beats: one cannon shot, one swing, one tag lock. 75 s.
- **L2 Wild & Frost Gates** (4 sections): Wild Trial, Frost Trial, and two tag mixers (the gong beat raises the rails). 90 s.
- **L3 Neon & Prism Gates** (5 sections): Neon Trial, plus three W6 remixes: a 21 landing-match hex run, a 26 colour call on a falling floor, a 39 two-beam bridge. 105 s.
- **L4 Spectrum Run** (6 sections): all five trials back to back, at higher speed and with Prism Locks, ending in a forced Full Prism tag sequence at the Heart's door. 120 s.
- **L5 The Prism Heart**, final boss "Shadow Plates, Heart of Grey" (below). Target 4:30.

#### Final boss: "Shadow Plates, Heart of Grey" (game 50, L5)
**Arena:**
- An octagon of 18 m (`m2TrialOctPlatform`) floating in the sky colosseum (`m2SkyColosseumBg`).
- Five trial gates stand on five of its edges, each glowing its world colour.
- The Prism Heart (`m2PrismHeart`) floats 10 m above, grey and pulsing.
- Five boss beacons (`m2BossBeacon`) mark the phase progress.
- Shadow Plates (`m2VillainShadowPlates`, 3.5 m) has a health bar in 3 segments.
- **Hearts and checkpoints:** the squad has 3 hearts per phase. Hearts refill at each phase start, and a phase checkpoint means losing restarts only that phase.
- **Music:** the full W6 theme. Each phase adds a layer, and the finale is all five motifs in unison.

**Phase 1 "Stolen Colours" (about 90 s, 5 hits).**
- He wears 5 stolen plates. Each cycle he casts one world's attack from its gate, in a seeded order with each attack once per cycle.
- After each attack, **that plate opens for 3 s**, and only its hero's **power** breaks it. A wrong hero bounces off with a clang and no damage.

| Attack | Telegraph | What it does | How to break the plate |
|---|---|---|---|
| Red "Ember Lines" | Cracks glow 1.0 s | 3 crack lines erupt across the octagon | Riko **dashes** into him |
| Blue "Gale Rings" | Rings expand 0.6 s apart | Two wind rings push outward: jump the first, double-jump the second | He rises 3 m: Nami **double-jumps** and stomps the plate on his back |
| Green "Gong Quake" | Rings spaced 0.75 s on the music beat | 4 shockwave rings: jump each on the beat | He fires a grey bolt: Kiro's **shield** reflects it into his green plate |
| Yellow "Grey Rain" | Shadows fall 0.8 s before | Grey coins rain down | His plate comes loose: Zuno holds the **magnet** within 6 m for 1.2 s while dodging. No button mashing |
| Purple "Mirror Split" | — | 3 mirror copies circle him. Only the real one casts a shadow | The purple plate sits on his inner core: Vexa **phases** through the real one's body |

- Pre-tagging during the telegraph is the skill. Each plate broken returns its colour to its gate.

**Phase 2 "The Tag Thief" (about 75 s).**
- He roars a long Prism Lock and **steals your bench**. The four heroes you are not playing are caged (`m2HeroCage`, fallback a code light-cage) inside four of the trial gates.
- You fight on with the active hero only. The floor greys inward from the rim, one tile ring every 6 s. Grey tiles slow you to 60 %.
- **To free a hero:** enter its gate for a 12–15 s micro-trial of that world:
  - one cannon shot onto a ledge
  - a 3-hook swing chain
  - a 4-gong beat
  - one rail junction flip
  - one portal-pair puzzle
- A freed hero rejoins the tag roster and fires a beam of its colour into Shadow Plates, which damages him and recolours a ring of floor.
- **His pressure meanwhile:**
  - grey disc throws (red line telegraph 0.8 s)
  - a dive slam at your position (shadow 1.0 s)
  - once per micro-trial, he sends a shadow roller (`m2ShadowArmadillo`) into the gate after you
- The gate of your active hero's own world stays closed, so **your choice of lead decides which four trials you play**. That is built-in replay variety.
- Freeing all four ends the phase.

**Phase 3 "Shadow Prism" (about 60 s).**
- He shatters into **five shadow copies**, each wrapped in one colour aura and standing on a gate pad. The real Shadow Plates hides inside the Prism Heart above.
- The copies circle the octagon, faster each cycle, and attack in turn with their world's attack at 0.7 s telegraphs.
- A copy can be hit only by **its own hero**, by any contact during its 1.5 s recovery after its attack. Each hit copy flies up into the Heart and cracks it.
- **Full Prism rule:** hit all five copies within one combo window (10 s for this fight) and the Heart cracks fully at once. Otherwise the remaining copies re-form and you need a second round.
- When the Heart breaks, it lowers to the floor, and Shadow Plates is exposed: small, grey and drained.

**Finale "Five as One".**
- A ring of five glyphs lights around your hero, one at a time, 1.0 s each.
- Tag to each hero in that order: five inputs, the same window on every device. A miss restarts the ring with no damage taken, so it never fails you, only delays.
- On the fifth tag the five heroes merge into the **Prism Ball** (cinematic). The player steers it for 6 s up a spiral of light into the Heart.
- Slow-mo 0.25× on impact. A colour wave floods the colosseum, then the world map of all six worlds.

**Ending:**
- Shadow Plates' plates fall away. Underneath is a small colourless armadillo who wanted every colour for himself.
- The heroes hand him one shard, and his shell glows faintly.
- Credits roll over a ride through all six restored worlds.
- **Unlocks:** "Prism Trial" daily mode (`daily` seed over the five trials). Optional user decision: Shadow Plates as an unlockable cosmetic or hero.

**Co-op final (2–4):**
- **P1:** any player may break a plate with the right power, so players split the colours between them.
- **P2:** he cages the **bench** heroes, and players free them in parallel gates.
- **P3:** copies still need their own hero, and the high-five swap is key.
- **Finale:** every player taps tag on their own glyph at the same time ("all hands in", a 0.5 s unison window).

**Stars:** clear / all colour orbs (in L5: 5 shards, one per micro-trial gate) / target time (L1 75 s … L5 4:30). No-hit.

**Secrets:**
- L1: a Riko-cracked cannon wall leads to a cannon that reaches a sticker cloud.
- L3: a Vexa portal pair hides a shard.
- L4: a full run with every trial's spotlight hero gives the "Spectrum" sticker.

**Juice moments:** each trial gate erupts in its world colour on clear. Plate breaks get world-specific SFX (lava hiss, wind, gong, coin rain, mirror shatter). Full Prism cracks the Heart all at once with a white flash. The Prism Ball ride has speed lines and all five motifs.

**Multiplayer (1-4):**
- **Co-op (2–4)** through the trials and the final boss, as above. Shared camera, with split screen allowed only in rail and swing sections where heroes diverge more than 25 m.
- **Versus "Trial Race" (2–4):** L1–L4 side by side on the same seed, split screen.
- **Ghost race:** against friends' Spectrum Runs.
- **Party:** not a fit.

**Assets:**
- Reuse from `ultimate-color-trial/`: `m2TrialGate`, `m2TrialGateV2`, `m2TrialCheckArch`, `m2TrialOctPlatform`, `m2TrialRing`, `m2BossBeacon`, `m2SkyColosseumBg`.
- Reuse from `roll-cannon-jump/`: `m2CannonIsle`, `m2Trampoline`.
- Reuse from `sky-hook-swing/`: `m2GrappleRingPost`, `m2SwingAnchor`.
- Reuse from `temple-gong-timing/`: `m2TempleGong`, `m2TimingRing`, `m2StrikerPost`.
- Reuse from `color-rail-grind/`: `m2RailSegment`, `m2RailSwitch`, `m2GrindRing`.
- Reuse from `portal-hop/`: `m2PortalFrame`, `m2PortalIsle`.
- Reuse from `color-match-jump/`: `m2HexPlatform`.
- Reuse from `color-arena-survival/`: `m2CrumblingTile`.
- Reuse from `color-bridge-builder/`: `m2BridgeTile`.
- Reuse from `shared/`: `m2VillainShadowPlates`, `m2ShadowArmadillo`.
- New:
  - `m2PrismHeart`, MUST for L2–5. It hangs over L4's door and is the boss centrepiece.
  - `m2HeroCage`, NICE. The fallback is a code light-cage.

**Risks:**
- Five external modules mean five dependencies. Fix: `trialKit` extracted as each source game is built, and 50 is scheduled last (W6 is already last in the order).
- Difficulty spike in the final boss. Fix: phase checkpoints, hearts refilled each phase, the finale ring that cannot fail, and telegraphs never under 0.7 s.
- Length. Fix: L5 is about 4 minutes, and the cinematics are skippable after the first view.

---

## Hyper3D models needed

Echo bosses, shadow minions and all hero-gate props come from ready models, with recolouring done by `colourKit` and `echoMaterial`. Only what no ready model can stand in for is listed.

### 11 Roll Dash
Ready models used:
- `roll-dash/`: `m2GoldCoin`, `m2MarketStall`, `m2OldTownHouseBg`, `m2StreetLamp`
- `color-city-sprint/`: `m2CityBarrier`, `m2TrafficCone`, `m2StreetJumpRamp`
- `energy-core-hunt/`: `m2ArenaCrate`, `m2TeslaCoil`
- `switch-color-hero/`: `m2EnergyBarrierWall`
- `mine-tunnel-run/`: `m2OreCart`
- root: `skyFortressGate`
- `shared/`: `m2ShadowArmadillo`, `m2StormHawkBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 21 Color Match Jump
Ready models used:
- `color-match-jump/`: `m2HexPlatform`, `m2HexPlatformV2`, `m2CrackedHexPlatform`, `m2HexPillar`, `m2CountdownBeacon`, `m2SignalOrbLamp`, `m2FloatingArenaBg`
- `shared/`: `m2FrostGolemBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 22 Switch Color Hero
Ready models used:
- `switch-color-hero/`: `m2SwitchPlatform`, `m2ColorGateArch`, `m2ColorGateArchV2`, `m2EnergyBarrierWall`, `m2EnergyPickup`, `m2CheckpointFlagPad`, `m2SciFiSpireBg`
- root: `movingBlock`
- `shared/`: `m2PatrolBot`, `m2AlienMothership`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 25 Paint the Platforms
Ready models used:
- `paint-the-platforms/`: `m2PaintTile`, `m2PaintBucket`, `m2PaintPickup`, `m2GiantPaintRoller`, `m2ArenaWall`, `m2ArenaCornerTower`, `m2EaselBg`
- `shared/`: `m2FactoryDrone`, `m2CandyKingBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 26 Color Arena Survival
Ready models used:
- `color-arena-survival/`: `m2SurvivalFloorTile`, `m2CrumblingTile`, `m2BeaconTower`, `m2SafeMarker`, `m2SpawnPad`, `m2ColosseumBg`
- `plate-bounce-arena/`: `m2BumperPost`
- `shared/`: `m2ShadowArmadillo`, `m2ShadowArmadilloR`, `m2GiantCrabBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 29 Energy Core Hunt
Ready models used:
- `energy-core-hunt/`: `m2EnergyCore`, `m2ArenaCrate`, `m2CoreCapsule`, `m2CoreGate`, `m2CorePylon`, `m2TeslaCoil`, `m2ReactorBg`
- `shared/`: `m2GummyMonster` (Glass Glutton), five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2CoreSprite | enemy | MUST for level 1 vertical slice | Stylized small energy-core creature for a premium mobile/browser arcade game, a round faceted glass sphere about the size of a football with a soft glowing neutral white-grey core inside (it will be tinted at runtime), two tiny stubby rounded feet, two simple glossy dot eyes and a small curious expression, a short antenna spark on top, cute but premium matte-and-glass materials, neutral standing pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 39 Color Bridge Builder
Ready models used:
- `color-bridge-builder/`: `m2BridgeTile`, `m2BridgeTileV2`, `m2BridgeAnchor`, `m2BridgePylon`, `m2BrokenBridgeEnd`, `m2ColorSwitch`, `m2EnergyNode`, `m2FloatingRockIsle`, `m2CanyonBg`
- `laser-maze-run/`: `m2LaserPrism`
- `shared/`: `m2FactoryDrone`, `m2MegaRobotBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| — | — | — | No new model needed. |

### 48 Color Orb Defense
Ready models used:
- `color-orb-defense/`: `m2DomeBeacon`, `m2EnergyOrb`, `m2OrbBlob`, `m2ZonePlate`, `m2ShieldPedestal`, `m2ArenaPillar`, `m2CastleWallBg`
- `gem-collector-3d/`: `m2ScoreBeacon`
- `shared/`: `m2MagmaGolemBoss`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2OrbLauncher | prop | MUST for level 1 vertical slice | Stylized orb launcher turret for a premium mobile/browser arcade game, a squat dark slate-grey stone and smoked-glass mortar on a short round wall-mount base, a wide flared funnel mouth angled forward, a ring of neutral white crystal vents around the barrel that will be tinted at runtime, small brass rivets and bevelled edges, villain-fortress style, clean low-poly game-ready geometry, no text, no logos |

### 30 Color Boss Tower
Ready models used:
- `color-boss-tower/`: `m2TowerPlatform`, `m2TowerPlatformV2`, `m2CoreClawHolder`, `m2HazardOrb`, `m2BossArenaDisc`, `m2StoneGuardianBoss`, `m2DarkTowerBg`
- `energy-core-hunt/`: `m2EnergyCore`
- `shared/`: `m2VillainShadowPlates`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2PrismCannon | prop | MUST for level 1 vertical slice | Stylized prism cannon for a premium mobile/browser arcade game, a long faceted clear crystal barrel set in a dark graphite stone-and-metal cradle on a curved wall bracket, a round lens at the muzzle, a glowing socket at the back for an energy core, neutral white crystal that will be tinted at runtime, elegant bevelled shapes, fantasy-tech fortress style, clean low-poly game-ready geometry, no text, no logos |

### 50 Ultimate Color Trial
Ready models used:
- `ultimate-color-trial/`: `m2TrialGate`, `m2TrialGateV2`, `m2TrialCheckArch`, `m2TrialOctPlatform`, `m2TrialRing`, `m2BossBeacon`, `m2SkyColosseumBg`
- `roll-cannon-jump/`: `m2CannonIsle`, `m2Trampoline`
- `sky-hook-swing/`: `m2GrappleRingPost`, `m2SwingAnchor`
- `temple-gong-timing/`: `m2TempleGong`, `m2TimingRing`, `m2StrikerPost`
- `color-rail-grind/`: `m2RailSegment`, `m2RailSwitch`, `m2GrindRing`
- `portal-hop/`: `m2PortalFrame`, `m2PortalIsle`
- `color-match-jump/`: `m2HexPlatform`
- `color-arena-survival/`: `m2CrumblingTile`
- `color-bridge-builder/`: `m2BridgeTile`
- `shared/`: `m2VillainShadowPlates`, `m2ShadowArmadillo`, five heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2PrismHeart | set-piece | MUST for L2–5 | Stylized giant floating prism crystal for a premium mobile/browser arcade game, a large faceted gem shaped like a rounded diamond (not a heart symbol) with five vertical facet bands, smoked dark-grey glass with thin glowing veins of trapped colour inside, a few small crystal shards orbiting close to its surface, jagged broken crystal points at the bottom tip, majestic final-boss centrepiece, clean low-poly game-ready geometry, no text, no logos |
| m2HeroCage | prop | NICE | Stylized floating prison cage for a premium mobile/browser arcade game, five curved dark smoked-crystal bars rising from a round graphite stone ring base and meeting in a pointed crystal cap, empty inside, faint grey glow on the ring, villain-fortress style matching a grey glass citadel, clean low-poly game-ready geometry, no text, no logos |

**Total: must-L1 3** (`m2CoreSprite`, `m2PrismCannon`, `m2OrbLauncher`) **· must-L2–5 1** (`m2PrismHeart`) **· nice 1** (`m2HeroCage`).
