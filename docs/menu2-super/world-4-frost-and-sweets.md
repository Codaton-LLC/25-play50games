# World 4: Frost & Sweets (yellow, lead hero Zuno, Magnet)

## The world: the Sugarfrost Workshop

**Choice: a toy workshop in the snow, not a frozen candy kingdom.**
Why this one: a workshop explains *all eight* games. A candy kingdom explains the candy, ice and gem games, but not a toy room, a magnet lab or a toy train line. The workshop sits in a snowy mountain village and makes every toy and every sweet in the world. That gives each game a natural place:
- the **Ice Peak** above it supplies the ice
- the **Toy Room** is where new toys are tested
- the **Sugar Kitchen** makes the sweets
- the **sledding slopes** run down to the village
- the **Ornament Vault** stores the glowing gem baubles
- the **Pinball Hall** is the games room
- the **toy train line** links the buildings
- **Zuno's Tinker Lab** builds the magnetic toys

Candy and toys are things the workshop *makes*, and snow is where it *is*, so the mix reads as one place and never as two themes glued together.

**Look:** warm timber and brass buildings under deep snow, pale-blue ice, and candy in soft pastel glazes with a frosted, sugar-dusted finish. Shadow Plates drained the gold out of everything: lantern glass, brass keys, honey candy and gem cores are grey at the start. Gameplay accents are the one saturated colour on screen.

**Music mood:** music box, glockenspiel, celesta, sleigh bells and plucked strings at about 112–124 BPM. The tone is bouncy and cosy rather than epic. Each game varies the instruments: the Toy Room and Pinball Hall get a wind-up toy-band feel, while Snow Slide and Rail Grind get a faster 132 BPM sleigh-bell gallop. Boss tracks add low brass and timpani. When a game is cleared, its stem returns to the world map theme.

**World guardian:** **King Bonbon** (`m2CandyKingBoss`) is the workshop's old candy-maker king. Shadow Plates has turned him grey and sour, and he hoards the stolen yellow in his sugar palace. He is the boss of game 19 Candy World Runner (L5) and appears in cutscenes on the world map. The other seven L5 bosses are his frozen helpers or Shadow Plates' lieutenants.

**How the colour returns:** every game you clear relights one landmark of the workshop on the world map: the peak beacon, the toy-room window, the kitchen chimney, the sled-hill lanterns, the vault door, the pinball marquee, the station lamp and the lab coil. Each landmark glows **gold** again. After all 8, the great workshop clock rings, Zuno's yellow floods back across the map, and his Magnet power gets its golden trail effect for all worlds.

**Theme fences (things W4 does not use):**
- no wind or water (W2), so the hazards are icicles, snow, sugar and toys
- no rhythm or balance meters (W3)
- no mines, lava or factories (W1)
- no lasers, portals or mirrors (W5)
- no colour-switching as a core (W6)

The "Color" games here use colour only as restoration feedback, never as the core verb.

---

### 9 Ice Peak Jumper  (World 4, yellow)
**One-line hook:** You can't stop on ice. You build your slide, then launch off the edge, and the run-up is your aim.
**Signature mechanic:** Slide-launch.
- **Gripless ice:** ice platforms have no friction. The hero keeps sliding: stick input accelerates at 5 m/s², with no braking.
- **Speed sets distance:** jump distance scales with slide speed. 0–9 m/s gives 2.5–7.0 m horizontal and a fixed 2.2 m apex.
- **Grip patches:** snow patches (`m2SnowLedge`) are the only places with grip, where you can stop, turn and re-aim.
- **Ice brake:** hold Down/Brake to dig in. This decelerates at 6 m/s² and leaves a spray trail.
- **Cracked ice** (`m2CrackedIcePlatform`) shatters 1.2 s after the first touch.
- **Controls:** stick/WASD, Jump, Brake (mobile: a brake button under the jump button).
- **Landing arc:** a dotted landing arc shows when you are above 4 m/s, in L1–L2 only.

**Why it's different from:**
- *1 Sky Tower Jump* (W2): that game uses precise static footing and double-jump height. Here the footing moves you, and the skill is managing momentum.
- *20 Snow Slide Dash* (W4): Snow Slide is continuous steering downhill. This game is discrete launches uphill, where each jump is a decision.

**Hero roles:**
- Riko: Dash adds +4 m/s instantly on ice, so he can launch to far "speed ledges" (a shortcut column). It also breaks the cracked ice walls of the frozen caves (`CrackedWall`).
- Nami: her double jump re-aims mid-air (sets a new direction), which reaches the high cornice ledges (`HighLedge`) with orbs.
- Kiro: Shield crosses icicle-rain chutes (`HazardZone`), the fast vertical shortcut, and blocks one snowball hit.
- Zuno: Magnet pulls coin trails frozen inside ice walls (`MagnetTrail`). His trails mark a hidden launch line.
- Vexa: Phase goes through frosted ghost-ice walls (`GhostWall`) into a back cave with a shard.

**Levels:**
- L1 Base Camp: teaches the mechanic in 3 beats.
  - (1) Slide across a flat ice sheet and stop on a snow patch.
  - (2) Slide-launch over a 3 m gap: a short run-up fails safely into a snow pit, a long one makes it.
  - (3) A cracked platform you must leave within 1.2 s.
  - 10 landings, about 40 m climb.
- L2 Icicle Steps: twist, icicles (`m2Icicle`) above routes shake for 0.8 s, then drop. Tiered ledges zig-zag, so you must plan your slide direction.
- L3 Yeti Ridge: twist, a `m2SnowYeti` on a high ledge throws snowballs every 3 s. Rolling snowballs (`m2Snowball`) come down the ramps. A rolling snowball can be **ridden** for 2 s (hop on top) as a moving launch pad.
- L4 Lantern Night: twist, at night grip only exists on snow patches lit by lanterns. The lanterns cycle in a 6 s loop (lit 4 s, dark 2 s), so you time your arrivals.
- L5 Summit Cairn, boss "the Frost Golem" (`m2FrostGolemBoss`):
  - **P1 Slope slam:** his fist slams make 30° ice slopes. Slide up a slope, launch onto his back and ground-pound the glowing yellow core. That is 3 hits, with a 2 s vulnerable stun after each slam.
  - **P2 Glaze:** he freezes the whole arena (no snow patches). Ice boulders he throws come to rest as stepping stones, so launch from boulder to boulder to reach his shoulder. 2 hits.
  - **P3 Climb:** he climbs the `m2SummitCairn`. It is a vertical chase with platforms crumbling 3 s behind you. The final hit is a launch into his head crystal, with a slow-mo finish.

**Stars:**
- clear
- all orbs (L1–L5: 25 / 30 / 35 / 40 / 45)
- time targets 70 / 95 / 110 / 125 / 160 s

No-hit bonus. Perfect landings (within 0.3 m of the platform centre) feed the combo.

**Secrets:**
- a "golden mitten" sticker frozen inside an ice cube (break it with a Riko dash or 3 snowball hits)
- a summit-cairn shortcut flag in L2 and L4
- a hidden ledge behind the background peak, reached only by a max-speed launch (9 m/s)

**Juice moments:**
- ice-spray trail that grows with speed
- FOV widens +6° above 7 m/s
- frost-crack decals on hard landings
- a "ting" on a perfect landing, plus a sparkle ring
- slow-mo on the golem's head shatter, with gold light bursting from the crystal

**Multiplayer (1-4):**
- **Co-op:** heroes can stand on each other to use one as a grip patch (a hero counts as snow for 1.5 s), which forms co-op-only launch chains. Two co-op ledges need Nami + Riko.
- **Versus race:** to the summit, with the same layout side by side.
- **Camera:** shared vertical camera fitted to all heroes. Anyone more than 1.2 screens below respawns at the leader's last checkpoint (leash respawn).

**Assets:**
- ready in `ice-peak-jumper/`: `m2IcePlatform`, `m2IcePlatformV2`, `m2CrackedIcePlatform`, `m2SnowLedge`, `m2SnowLedgeV2`, `m2Icicle`, `m2Snowball`, `m2IceCrystal` (orbs/shards), `m2SummitCairn`, `m2IcePeakBg`, `m2SnowYeti`
- shared: `m2FrostGolemBoss`, `m2IceSlime` (L4 patrols on snow patches)
- root: `checkpointBeacon`
- nothing new is MUST

**Risks:**
- "Slippery" can feel unfair. Fixes:
  - 120 ms coyote time
  - a snow patch at least every 3 platforms in L1–L3
  - the predicted arc in early levels
  - brake always works
  - falls drop to the last snow patch, not the start
- Too floaty or slow. Fix: a fixed apex and a fast fall (gravity ×1.6 after the apex).

**Shared-system needs:**
- the hero controller needs a per-surface `friction` and `grip` flag (also used by 20, 23 and 32)
- "slide" and "brake" anim poses in `heroAnims`
- leash respawn in `players`

---

### 18 Toy Room Run  (World 4, yellow)
**One-line hook:** Knock over the first domino, then run the falling chain like a moving bridge across a giant playroom.
**Genre change:** this is no longer an auto-runner. It is a chain-reaction platformer, and you still *run*: you race the toppling wave. The title stays.

**Signature mechanic:** Ride the domino wave.
- **Starting a chain:** roll into a starter piece to begin a chain of dominoes, standing books, keyboard keys and blocks.
- **The wave:** it travels at a fixed speed (4 m/s in L1, up to 9 m/s in L4). Pieces fall flat and become a walkable bridge over gaps between furniture.
- **Running into standing pieces:** if you hit one, you bounce back 1.5 m.
- **Falling behind:** if you lag more than 8 m, the oldest fallen pieces slide off the table edge, so the bridge is short-lived.
- **Toy devices:** the wave fires toys on its own schedule. A `m2ToyDrum` launches you only at the moment the wave hits it, a `m2ToyRaceCar` shoots off, and a `m2SpinningTop` spins up. You must be in the right spot at the right time.
- **Stalled chains:** some chains stall at a missing piece. Push a spare piece into the gap to restart it.
- **Forks:** chains fork. Your choice of branch is your route.

The topple is scripted and deterministic, not rigid-body physics.

**Why it's different from:**
- *13 Robot Factory Run* / *46 Color Door Sprint* (W1 auto-runners): here you control your own speed and position. The world moves on a timer, and the skill is reading the wave.
- *19 Candy World Runner* (W4): Candy is lanes plus managing your size. This is free 3D movement plus chain timing.

**Hero roles:**
- Riko: Dash catches a wave you have lost (+6 m/s for 0.4 s) and knocks down heavy "block wall" pieces (`CrackedWall`) that open a side chain.
- Nami: double jump to the pencil-ramp shelf route (`HighLedge`, `m2GiantPencil` as a ramp), a high chain worth 2× orbs.
- Kiro: Shield passes through tumbling-block cascades (`HazardZone`, where a block tower falls across the path) without being knocked off.
- Zuno: Magnet pulls coin trails from under the rug and out of drawers (`MagnetTrail`). It also pulls one spare domino from up to 5 m to fix a stalled chain.
- Vexa: Phase walks through the ghost wall of the toy castle (`m2ToyCastleBg` doorway) to a secret chain.

**Levels:**
- L1 Desk Start: teaches the mechanic in 3 beats.
  - (1) Push one domino, and 6 pieces bridge a gap between two book stacks. Nothing is timed; you can wait.
  - (2) A 20-piece line at 4 m/s across the desk. Running into it bounces you back gently.
  - (3) The wave hits a toy drum. Stand on it when it hits and you are launched to the shelf (a 1 s window, shown by a drum glow).
- L2 Book Bridge: twist, stalled chains. 3 gaps that you fill by pushing spare pieces, plus your first fork (a short risky branch or a long safe one).
- L3 Race Track: twist, the wave starts toy race cars that cross your path (dodge them) or that you ride (land on the roof, 3 s ride along the floor track).
- L4 Lights Out: twist, a night playroom. Only fallen pieces glow, so you see the bridge but not the gaps ahead. Spinning tops wander and bump you. Wave speed is 9 m/s.
- L5 Toybox Finale, boss "Jack Wobble" (new giant jack-in-the-box, a frozen helper):
  - **P1 Whack:** he springs out of one of 3 toyboxes, and the lid rattles for 1 s first. Start the chain that ends at the heavy book above his box. The book drops on his spring for a hit; you need 3.
  - **P2 Throwback:** he spits toy blocks that land standing on end as new dominoes. Push those chains back at him; each one that reaches his box is a hit (2 hits).
  - **P3 Bounce:** he bounces around the room on his spring. When he lands he crouches for 1.5 s. Topple the giant book-stack line onto him for the final hit, with a slow-mo of the lid slamming shut and gold confetti.

**Stars:**
- clear
- all orbs (20 / 26 / 32 / 38 / 40)
- time targets 55 / 75 / 90 / 105 / 140 s

"Surf bonus": stay within 2 m of the wave front for a whole chain.

**Secrets:**
- a sticker inside the toy castle (Vexa)
- a hidden fork on L2's bookshelf with a shard
- in L3, a "perfect topple" achievement: no chain stalled and no bounce-backs

**Juice moments:**
- click-clack SFX pitch rising with chain length
- each fallen piece pops a tiny dust puff
- camera tilts slightly in the wave direction
- the drum launch has a big boing, a squash and a camera kick
- chains over 50 pieces play a short music sting

**Multiplayer (1-4):**
- **Co-op:** "double start" toyboxes need two players to push two starters within 0.5 s. Zuno can fetch spare pieces for everyone.
- **Versus:** parallel desks, each player with their own chain in their hero accent. First to the toy chest wins.
- **Party "Domino Derby":** 90 s. Start as many chains as you can, and the most pieces toppled wins.
- **Camera:** shared, fitted to all heroes (the courses run parallel).

**Assets:**
- ready in `toy-room-run/`: `m2ToyBlocks`, `m2BookStack`, `m2GiantPencil`, `m2KeyboardKey`, `m2KeyboardKeyV2`, `m2KeyboardKeyV2R`, `keyboardKeyI` (chain pieces), `m2SpinningTop`, `m2ToyDrum`, `m2ToyRaceCar`, `m2ToyCastleBg`
- root: `checkpointBeacon`
- shared: `m2PatrolBot` (as a wind-up toy patrol in L4, optional)
- needed: `m2ToyDomino` (MUST L1), `m2JackBoxBoss` (MUST L2–5)

**Risks:**
- Waiting for the wave is boring. Fix: wave speed is always at least 80% of hero run speed, so you are always moving, and L1 beat 1 is the only untimed chain.
- Losing the wave feels cheap. Fix: Dash catch-up for everyone at 1 charge per chain (Riko gets 2), and a respawn re-triggers the chain from its last checkpoint piece.

**Shared-system needs:**
- a small deterministic `chainReaction` helper (a timeline of topple events from a seed) so ghosts and proofs replay exactly
- the boss state machine must support targets triggered by level events, not only direct hits

---

### 19 Candy World Runner  (World 4, yellow)
**One-line hook:** Eat sweets to grow and burn them off to shrink. Your size decides what you smash, what you squeeze through and what holds your weight.

**Signature mechanic:** Sugar Size. It is an auto-forward runner on 3 lanes: speed 9 m/s in L1, up to 14 m/s in L5, with a lane switch taking 0.18 s. The hero has 3 sizes, **Small / Normal / Big**, shown as 3 pips on the HUD.

| Size | Gets bigger by | What it can do |
|---|---|---|
| Small | (start of a burn) | fits under cookie and candy-cane arches |
| Normal | eating 3 candy coins (`m2CandyCoin`) | no special ability |
| Big | eating 3 more candy coins | smashes jelly cubes and chocolate walls; too heavy for wafer bridges |

- **Shrinking:** hold Down to "sugar-burn roll" and drop one size over 0.6 s.
- **The puzzle:** choose which lane's sweets to eat (or skip) so that you arrive at each obstacle at the right size.
- **Warnings:** obstacles show a size silhouette sign 2 s ahead.

**Why it's different from:**
- *15 Color City Sprint* (W1): that game is a lane runner about dodging and speed. Here the decision is your body size, made in advance.
- *18 Toy Room Run* (W4): Toy Room has no auto-run and is about timing a moving bridge. This game is about route-planning your size.

**Hero roles:**
- Riko: Dash at Big size makes a "sugar charge" that breaks reinforced gingerbread walls (`CrackedWall`) into a bonus lane.
- Nami: double jump onto the candy-cane rail route above the lanes (`HighLedge`). Her route has fewer coins, so it suits a Small run.
- Kiro: Shield crosses popping-candy fields (`HazardZone`, crackling ground that would knock you down one size).
- Zuno: Magnet pulls coin trails out of the frosting walls (`MagnetTrail`), and it is toggleable, so he chooses when to grow. This makes him the size-control expert.
- Vexa: Phase goes through ghost gingerbread walls (`GhostWall`) into a hidden fourth lane.

**Levels:**
- L1 Candy Lane: teaches the mechanic in 3 beats.
  - (1) Eat 3 coins, grow, smash a jelly cube (`m2JellyCube`).
  - (2) Roll to shrink and slip under a cookie arch (`m2CookieArch`).
  - (3) Both in a row, with the sign shown 3 s ahead.
- L2 Cookie Road: twist, weight. Chocolate-bar bridges (`m2ChocoBarPlatform`) crack under Big, and donut platforms (`m2DonutPlatform`) bounce Small heroes up to a high lane.
- L3 Sorbet Slopes: twist, frozen lanes. On frosted ice a lane change drifts for 0.3 s. Frozen candy blocks need Big, and frozen arches need Small, packed close together.
- L4 Gummy Grove: twist, `m2GummyMonster` enemies bite you down one size. Bouncing on a gummy's head grows you one size, so enemies are also tools.
- L5 Bonbon Palace, boss "King Bonbon" (`m2CandyKingBoss`, the world guardian), in a running boss fight:
  - **P1 Lollipop wheels:** he retreats ahead, rolling giant lollipop wheels (`m2Lollipop`) down 2 of the 3 lanes. Go Small to pass under a wheel's gap, then reach Big by the jelly drum he stands on and smash it. 3 hits.
  - **P2 Sour sprinkles:** he showers shrink-sprinkles. Golden candy coins appear in 1 lane only, so reach Big and dash into his throne. 2 hits.
  - **P3 Palace collapse:** the palace falls apart behind you; outrun it. Arches alternate fast (Small, Big, Small). At the end, a Big-size body slam on the king's crown releases the stolen yellow, with a slow-mo honey-gold burst.

**Stars:**
- clear
- all orbs (30 / 35 / 40 / 45 / 45)
- time: runners have fixed speed, so the target is "no size miss": you finish with at most 1 wrong-size hit (0 in L5)

No-hit bonus.

**Secrets:**
- the hidden fourth lane (Vexa) with a shard
- a "sugar giant" sticker: stay Big for 20 s in L2 without breaking a bridge
- an alternate exit in L3 behind a candy-cane arch, reachable only at Small

**Juice moments:**
- a squash-and-stretch grow and shrink, with a pitch-up chime on growing and pitch-down on shrinking
- jelly cubes burst into wobbling chunks
- the camera pulls back as you grow (+1.2 m per size)
- the sugar-burn roll leaves sprinkles
- slow-mo crown pop at the end

**Multiplayer (1-4):**
- **Versus race:** 2 players get split screen (framework rule for runners). For 3–4 players, one shared 5–6-lane track.
- **Co-op:** a Big hero smashes walls that open the lane for a Small friend. "Piggyback" arches need one Big hero to carry a Small hero through (a co-op route).
- **Party:** no; this game does not fit a party arena.

**Assets:**
- ready in `candy-world-runner/`: `m2CandyCaneArch`, `m2CandyCastleBg`, `m2CandyCoin`, `m2ChocoBarPlatform`, `m2CookieArch`, `m2DonutPlatform`, `m2JellyCube`, `m2Lollipop`
- shared: `m2CandyKingBoss`, `m2GummyMonster`
- root: `checkpointBeacon`
- nothing new is MUST

**Risks:**
- Size confusion. Fix: size silhouette signs 2 s ahead, 3 HUD pips, a distinct hero scale (0.7 / 1.0 / 1.4) and a coloured lane glow on the lane that "makes" the right size.
- A "trial and error" feel. Fix: L1–L2 always leave one lane that works at every size.

**Shared-system needs:**
- `heroModels` needs runtime uniform scale and collider scale with smooth tweening
- `stars` must accept a custom third star ("no size miss") instead of time

---

### 20 Snow Slide Dash  (World 4, yellow)
**One-line hook:** Carve freely down a wide mountain, string ice gates for speed, and land clean air tricks to stay ahead of the avalanche.

**Signature mechanic:** Carve & Air. This is free analog steering on a wide slope (no lanes), with the hero in ball-roll, at 12 m/s in L1 up to 28 m/s in L5.

- **Carving:** hold Carve for a tight turn that costs 15% speed. Release to accelerate.
- **Snow surfaces** change handling:

| Surface | Speed | Steering |
|---|---|---|
| Powder | slow | full grip |
| Packed | fast | normal |
| Ice sheet | +20% | none |

- **Ice gates** (`m2IceGate`): each one in a row adds +1.5 m/s and +1 combo, up to 6. A missed gate breaks the streak.
- **Air tricks** off a ramp (`m2SnowJumpRamp`): spin with left/right and flip with up/down. Landing aligned within 20° banks a boost of +2 m/s per half-rotation. A misaligned landing is a 0.6 s stumble.

**Why it's different from:**
- *37 Plate Surf* (W2): that game is riding water waves with their rhythm. This is open-slope route-carving with gate streaks and spin-landing.
- *19 Candy World Runner* (W4): Candy is 3 lanes with pre-planned size. Here there are no lanes, analog speed control and air tricks.

**Hero roles:**
- Riko: Dash smashes the cracked ice wall of the frozen-pond shortcut (`CrackedWall`), saving about 4 s.
- Nami: double jump over cliff gaps onto the upper ridge line (`HighLedge`), with longer air and more trick points.
- Kiro: Shield crosses snow-dump zones (`HazardZone`), where loaded pines drop snow that would bury you for 1 s, on the direct line through the forest.
- Zuno: Magnet pulls coin trails out of the frozen creek (`MagnetTrail`) and auto-collects gate stars within 4 m.
- Vexa: Phase goes through ghost snow-fences (`GhostWall`) into a hidden gully run.

**Levels:**
- L1 Bunny Hill: teaches the mechanic in 3 beats.
  - (1) Steer between wide-spaced pines (`m2SnowPine`).
  - (2) 3 gates in a row, with a speed whoosh on each.
  - (3) One ramp: spin once, land straight, boost.
- L2 Pine Run: twist, snow types. Patches of powder and packed snow make you choose a line (the fast packed line has denser trees).
- L3 Frozen Lake: twist, ice sheets with no steering, so you must pre-aim before you enter. Cracks open behind you, and stopping is not possible.
- L4 Lantern Slope: twist, a night run lit by lanterns. Sledding snowmen (`m2Snowman` on sleds) cross the slope, and there are double ramps for 2-trick combos.
- L5 Avalanche Run, boss "Big Drift" (`m2SnowYeti` at 3× scale with a frost glow, King Bonbon's snow-keeper):
  - **P1 Outrun:** he rides the avalanche behind you. Keeping a gate streak of 3 or more holds the gap; a broken streak lets him gain.
  - **P2 Snowball barrage:** he hurls snowballs that become rocks (`m2SnowRock`) on the slope ahead. Each perfect trick landing charges a "frost star" (`m2FrostStar`), and passing a gate fires it back at him. 3 hits.
  - **P3 Cliff:** the final 40 m cliff jump. Spin twice and land on his head (an auto-aim cone of 3 m) in slow-mo. The avalanche turns to gold snow.

**Stars:**
- clear
- all orbs (gate stars: 20 / 25 / 30 / 35 / 40)
- time targets 45 / 60 / 70 / 80 / 100 s

The combo meter here is "gate streak + trick score".

**Secrets:**
- the hidden gully (Vexa)
- a snowman sticker: hit 5 snowmen's hats off with a carve in L4
- in L2, a summit-cabin (`m2SnowCabinBg`) rooftop jump with a shard, reachable only at more than 20 m/s

**Juice moments:**
- a snow-spray fan on carves
- speed lines and FOV +10° at top speed
- gate whoosh plus a pitch-rising chime per streak step
- a crunch landing with a camera kick
- avalanche rumble shake that rises as Big Drift closes in
- slow-mo cliff finale

**Multiplayer (1-4):**
- **Versus race:** downhill race.
- **Co-op:** drafting, so riding behind a friend gives +10% speed. Some "twin gates" give a big boost only when two heroes pass together.
- **Party:** none.
- **Camera:** shared and fitted, while the slope is wide. It falls back to 2-way split if two heroes are more than 35 m apart (3–4 players: the leader-pack camera plus leash respawn).

**Assets:**
- ready in `snow-slide-dash/`: `m2SnowPine`, `m2SnowRock`, `m2IceGate`, `m2SnowJumpRamp`, `m2FrostStar`, `m2Snowman`, `m2SnowCabinBg`
- from `ice-peak-jumper/`: `m2SnowYeti`, `m2Snowball`, `m2CrackedIcePlatform` (lake crack wall)
- nothing new is MUST; `m2ToySled` is NICE, for the snowmen and an optional cosmetic ride

**Risks:**
- Open slopes are hard to read at speed. Fixes:
  - a gate line always visible 3 gates ahead
  - a faint "racing line" glow in L1–L2
  - pines kept out of a 4 m corridor on the default line
- The tricks feel random. Fix: snap the landing alignment within 20° and an audio cue when the alignment is good.

**Shared-system needs:**
- a downhill spline-plus-heightfield controller
- per-surface friction (shared with 9)
- `combo` must accept a streak source (gates)
- split camera for 2 players in `players`

---

### 23 Gem Collector 3D  (World 4, yellow)
**One-line hook:** Every gem you grab joins a glowing train behind you. Bank long trains for huge scores, but never cross your own tail.

**Signature mechanic:** Gem Train (an arena; stick to roll, Action to bank).
- **The train:** collected gems trail behind the hero as a chain, up to 20 links at 0.8 m spacing, and follow your exact path.
- **Banking:** drive into a Score Beacon (`m2ScoreBeacon`). Score = links² (capped at 400 per bank).
- **Losing links:** crossing your own tail cuts the chain at that point, and the cut links scatter and fade in 3 s. Hazards that touch the tail cut it as well.

Gem kinds:

| Gem | Effect |
|---|---|
| Clear | +1 link |
| Frost | +1 link, but slows you 20% for 3 s |
| Gold | counts as 2 links |

- **Lasso:** encircling something with your train (closing a loop around it without crossing yourself) "lassoes" it. This is used on enemies and the boss.

There is no colour matching (that would be W6's core).

**Why it's different from:**
- *42 Magnet Coin Lab* (W4): that game is room puzzles with polarity. This is an open score-attack arena about path shape.
- *26 Color Arena Survival* / *29 Energy Core Hunt* (W6): those are survival and colour-switch. Here the core is a tail that grows, and banking it is a risk.

**Hero roles:**
- Riko: Dash through crystal walls (`CrackedWall`) to sealed gem pockets. Dashing also snaps the train straight, which makes a tight turn safe.
- Nami: double jump onto high pedestals (`m2GemPedestal`, `HighLedge`) for gold gems. The train follows through the air.
- Kiro: Shield protects the tail from frost-sweeper zones (`HazardZone`, a sweeping frost breath across the floor).
- Zuno: Magnet gives a +1.5 m pickup radius and pulls hidden gem trails out of the rim walls (`MagnetTrail`). He is the lead hero but is not overpowered: his train is not longer.
- Vexa: Phase lets the train pass through itself for 2 s (no self-cut, so tight loops are allowed) and through ghost walls (`GhostWall`) to a back vault.

**Levels:**
- L1 Vault Floor: teaches the mechanic in 3 beats.
  - (1) Collect 3 gems and bank them at the beacon.
  - (2) Build an 8-link train; the bank shows the score jump.
  - (3) A lone gem placed so that a careless loop crosses your tail. The cut gems scatter slowly, and you can regrab them within 3 s.
- L2 Shifting Tiles: twist, arena tiles (`m2ArenaTile`, `m2ArenaTileV2`) sink in a 5 s pattern, which squeezes the space your train can use.
- L3 Slime Pen: twist, `m2IceSlime` enemies chase your tail and bite off links. Lasso a slime to freeze it into a gold gem.
- L4 Chest Rush: twist, treasure chests (`m2TreasureChest`) burst open with 6 gems, and the beacons move between 3 pedestals every 15 s.
- L5 Gumdrop Glutton, boss (`m2GummyMonster` at 3× scale, the vault's frozen keeper):
  - **P1:** he chases you and eats your tail. Lasso him around a pedestal, which stuns him for 3 s. Bank during the stun for a hit (3 hits).
  - **P2:** he splits into 3 mini-gummies (`m2SlimeBlob` scaled, gummy-tinted). Lasso each one; a bigger loop makes the lasso faster.
  - **P3:** he swallows the last beacon. Bank a train of 10 or more straight into his open mouth during the 2 s yawn window; links over 10 deal bonus damage. Slow-mo as he spits out a fountain of gold gems.

**Stars:**
- clear (reach the target score: 300 / 600 / 900 / 1200 / boss)
- all orbs (5 hidden colour orbs per level)
- time: reach the target score before 60 / 75 / 90 / 90 / 150 s

No-cut bonus.

**Secrets:**
- the back vault (Vexa)
- a "perfect 20" sticker: bank a full 20 train without a cut
- a hidden pedestal at the arena rim in L4 (Nami)

**Juice moments:**
- each link chimes one note higher, so the train plays a scale
- a bank beam fires to the ceiling, its height scaling with links
- a cut makes a glass-shatter tinkle plus 0.08 s hit-stop
- lasso closure snaps with a gold ring flash
- the camera pulls back as the train grows

**Multiplayer (1-4):**
- **Party arena "Gem Rush":** 90 s rounds. Each player has a train, and crossing another player's tail **steals** the links behind the crossing point.
- **Co-op:** a shared bank score, and a co-op lasso where two trains together encircle the boss.
- **Versus:** most banked score.
- **Camera:** shared, fixed arena camera.

**Assets:**
- ready in `gem-collector-3d/`: `m2ArenaRimWall`, `m2ArenaTile`, `m2ArenaTileV2`, `m2CrystalHillBg`, `m2GemPedestal`, `m2ScoreBeacon`, `m2TreasureChest`
- shared: `m2GummyMonster`, `m2IceSlime`, `m2SlimeBlob`
- from `ice-peak-jumper/`: `m2IceCrystal` (crystal walls)
- needed: `m2FacetGem` (MUST L1, recolourable gem; there is no gem model yet)

**Risks:**
- Snake-style frustration. Fix: a self-cut only cuts behind the crossing point, and you can regrab cut gems for 3 s.
- Instanced gems per frame. Fix: an `InstancedMesh` for all links and gems keeps the draw calls within budget.
- Zuno becoming too strong. Fix: he only gets extra radius, not more links.

**Shared-system needs:**
- a `trailFollower` (path-history chain) usable for co-op leashes elsewhere
- `combo` accepts a bank event
- deterministic gem spawns from the seed, for `daily` and `ghost`

---

### 32 Plate Bounce Arena  (World 4, yellow)
**One-line hook:** You *are* the pinball. Roll your hero through a giant toy pinball table, flick the flippers, and steer with tiny nudges.
**Genre change:** from "bounce-pad course" to hero-as-pinball. The title stays; the "arena" is the Pinball Hall table.

**Signature mechanic:** Hero pinball.
- **The table:** tilted 7°. The hero is in ball-roll the whole time and can make light nudges in the air or on the ground (2 m/s² of steer, limited).
- **Flippers:** two (left/right buttons; on mobile, a tap on each half of the screen). Hold to keep a flipper up and cradle the ball.
- **Scoring pieces:** bumpers (`m2BumperPost`) kick you out at 12 m/s, bounce mushrooms (`m2BounceMushroom`) launch you up, and score rings (`m2ScoreRingGold`) sit on ramps.
- **Goals:** each table has objectives, such as lighting 5 lanterns, hitting 3 drop targets or completing a ramp loop. These open the next table section and, at the end, the exit hole.
- **Balls:** you have 3 lives (balls) per table.

**Why it's different from:**
- *43 Roll Cannon Jump* (W1): that game is aim-and-fire from cannons. Here you are in constant physics play and react with flippers.
- *26 Color Arena Survival* (W6): that is last-hero-standing survival. Here you play a table with objectives, and the versus mode is a goal duel.

**Hero roles:**
- Riko: 1 nudge-dash per ball, a burst in any direction, also used to break the cracked toy-block barrier (`CrackedWall`) in front of the skill lane.
- Nami: double jump hops off the table plane onto the upper mini-table (`HighLedge`), which has its own bumpers.
- Kiro: Shield is a once-per-ball save that crosses the outlane (`HazardZone`) instead of draining.
- Zuno: Magnet holds the ball on magnet pads (aim, then release with a 1.5 s hold) and pulls coin trails from under the glass (`MagnetTrail`).
- Vexa: Phase passes the ghost gate (`GhostWall`) into the hidden attic table.

**Levels:**
- L1 Practice Table: teaches the mechanic in 3 beats.
  - (1) Flip to hit one bumper; the drain is blocked by a gate for this beat.
  - (2) A ramp shot through a score ring.
  - (3) Light 3 lanterns to open the exit hole.
- L2 Mushroom Garden: twist, mushroom launchers send you onto an upper orbit lane. Hitting 3 orbits in a row opens a 2× multiplier.
- L3 Ice Table: twist, a frozen playfield with 30% less friction and a faster ball. Ice-block drop targets shatter when hit.
- L4 Multiball: twist, 2 toy marbles join you (they score but can't be nudged). Keep all 3 alive for a 3× jackpot ramp.
- L5 Rollo's Table, boss "Rollo" (`m2ShadowArmadillo`, a Shadow Plates lieutenant), a rival ball:
  - **P1 Clash:** he rolls around the table. Hit him faster than 10 m/s (you glow when you are fast enough) to knock him into one of the lit pockets. 3 pockets = 3 hits.
  - **P2 Armour:** he curls up, and dark plates cover him. Only a "golden" hero, charged by completing a ramp loop (10 s), cracks the armour. 2 hits.
  - **P3 Flipper thief:** he jams one flipper at a time, alternating every 8 s. Use the free flipper plus nudges into the final jackpot ramp, which launches you down onto him for a slow-mo finish. The table's lights blaze gold.

**Stars:**
- clear
- all orbs (orbs sit on hard shots: 8 / 10 / 12 / 14 / 10)
- time: clear before 90 / 110 / 120 / 140 / 180 s

Bonus: no ball lost.

**Secrets:**
- the attic table (Vexa)
- a hidden "toy penguin" sticker behind a drop target
- an L2 skill shot: a plunger launch timed to land straight in the top lane

**Juice moments:**
- bumper hits pop with light rings and 0.04 s hit-stop
- a flipper "clack" with a tiny camera kick
- the playfield lights chase-animate on combos
- jackpot: confetti and a slow-mo zoom
- the table rattles if you nudge too often (cosmetic only, no tilt-fail)

**Multiplayer (1-4):**
- **Party "Pinball Duel":** 2 players face each other on opposite ends of the table, or 4 players on a 4-sided table. Each player guards their goal with their own flippers. Draining a ball into a rival's goal scores; first to 5 wins.
- **Co-op multiball:** each player is a ball on one table with a shared score. Flippers are split, with the left pair and the right pair per player in 2-player mode.
- **Camera:** fixed angled table camera, shared, with no split.

**Assets:**
- ready in `plate-bounce-arena/`: `m2BounceMushroom`, `m2BumperPost`, `m2ScoreRingGold`, `m2StadiumStandBg` (the Pinball Hall around the table)
- from `gem-collector-3d/`: `m2ArenaTile`, `m2ArenaRimWall` (table bed and rails)
- from `color-rail-grind/`: `m2RailSegment` (wire ramps)
- from `magnet-coin-lab/`: `m2MagnetPad`
- root: `bouncePad` (slingshots)
- shared: `m2ShadowArmadillo`
- needed:
  - `m2ToyFlipper` (MUST L1)
  - `m2PinballPlunger` (NICE; a bouncePad can fake it)
  - `m2PenguinDropTarget` (NICE; ice blocks can fake it)

**Risks:**
- Real pinball can feel random. Fixes:
  - a fixed-step (120 Hz) deterministic ball integrator
  - a forgiving flipper sweet spot
  - slow-mo for 0.3 s when a drain is imminent and a flipper can still save it
  - no tilt penalty
- Performance on mobile. Fix: the table is only about 40 meshes and the light chases are emissive uniforms.

**Shared-system needs:**
- a `pinballPhysics` module (a deterministic, simple sphere-vs-capsule-vs-box solver)
- a fixed `tableCamera` mode in `useFittedView`
- a 2- and 4-sided duel layout for `players`

---

### 35 Color Rail Grind  (World 4, yellow)
**One-line hook:** Grind the workshop's toy train line, flipping track switches ahead of you to build your own route, and route a runaway train into its buffers.

**Signature mechanic:** Switch-routing.
- **Grinding:** the hero grinds automatically on rails (`m2RailSegment` network, 10–20 m/s). Left/Right hops to an adjacent parallel rail (0.35 s hop), and Jump clears gaps and grind rings (`m2GrindRing`).
- **Switches:** **tap a junction switch** (`m2RailSwitch`, highlighted 1.5 s before it) to throw it. That decides which branch you take. Some switches also redirect other trains on the network, so your route doubles as a puzzle.
- **Crouch:** on downslopes, crouch for +3 m/s.
- **Colour:** as you grind, the rail lanterns relight gold behind you as visual feedback. You score a "relight %" for a bonus, but colour never gates a route.

**Why it's different from:**
- *49 Zipline Rush* (W2): that is a single fixed line plus timing. Here the network branches and you author the route.
- *19 Candy World Runner* (W4): Candy has fixed lanes on the ground and its decision is size. Here the decision is the branch, and switches affect other moving things.

**Hero roles:**
- Riko: Dash jumps a broken rail gap (a long-gap shortcut) and breaks the wooden barrier of side spurs (`CrackedWall`).
- Nami: double jump reaches the top rail tier (`HighLedge`), a faster and riskier line.
- Kiro: Shield crosses icicle tunnels (`HazardZone`, falling icicles).
- Zuno: Magnet grip lets him ride the upside-down loop rail (an exclusive loop shortcut). He also pulls coin trails out of snowbanks beside the track (`MagnetTrail`).
- Vexa: Phase goes through the ghost door of the old tunnel (`GhostWall`) to a hidden spur.

**Levels:**
- L1 Station Yard: teaches the mechanic in 3 beats.
  - (1) Grind and hop between two parallel rails to grab rings.
  - (2) A first switch: one tap sends you to the orb branch, while no tap gives the plain branch (both are safe).
  - (3) A grind-ring jump over a gap.
- L2 Village Loop: twist, dead ends. Some branches end in buffer stops (bonk, lose 3 s), and the mini-map shows the next 2 junctions.
- L3 Ice Bridge: twist, frozen rails. They are 20% faster with no crouch, and frozen switches need a jump-stomp to throw instead of a tap.
- L4 Night Express: twist, toy trains drive the network. Throw switches to send them off your line, or hop rails at the last second.
- L5 Runaway Express, boss "the Clockwork Express" (new possessed toy locomotive, Shadow Plates' lieutenant):
  - **P1 Route it:** the train runs ahead on the parallel network. Throw the right switches so it crashes into 3 buffer stops (`m2RailJunction` buffer ends). Each crash is a hit.
  - **P2 Wagon drop:** it uncouples wagons back at you along your rail, so hop to dodge. Grind through 3 grind rings to "charge" for P3.
  - **P3 Roof:** jump onto its roof (using `m2RailLaunchRamp`) and stomp the wind-up key 3 times while dodging steam puffs. Slow-mo as the key spins out and the lamps relight gold.

**Stars:**
- clear
- all orbs (25 / 30 / 35 / 40 / 35)
- time targets 60 / 80 / 95 / 105 / 150 s

Relight 90%+ is a bonus.

**Secrets:**
- the hidden spur (Vexa)
- a "golden caboose" sticker on an L2 branch reached only by throwing two switches in a 1 s window
- the loop shortcut (Zuno) has a shard

**Juice moments:**
- grind sparks (icy blue on frozen rails)
- switch "clunk" with a lever animation
- rail-hop whoosh
- buffer-stop crash with a camera kick and toy springs flying
- gold lamps relighting in a wave behind you

**Multiplayer (1-4):**
- **Versus race on one network:** a switch you throw changes it for everyone, so you can block a rival's route. This is the game's best mode.
- **Co-op:** one player holds a "switch lever station" while the other grinds the gated route. Some co-op branches need 2 switches thrown together.
- **Camera:** shared and fitted. It splits for 2 players if they diverge more than 30 m (3–4 players: leader camera plus leash).

**Assets:**
- ready in `color-rail-grind/`: `m2RailSegment`, `m2RailSegmentV2`, `m2RailSwitch`, `m2RailJunction`, `m2RailLaunchRamp`, `m2GrindRing`, `m2SupportPillar`, `m2ElevatedRailBg`
- from `snow-slide-dash/`: `m2SnowPine`, `m2SnowCabinBg` (village)
- from `ice-peak-jumper/`: `m2Icicle`
- from `toy-room-run/`: `m2ToyBlocks` (barriers)
- needed: `m2ClockworkTrainBoss` (MUST L2–5); `m2ToyTrainWagon` is NICE (L4 trains and P2 wagons; until then, the boss loco is scaled 0.6 with no face glow)

**Risks:**
- Switches are missed at speed. Fix: a 1.5 s highlight, a big tap target (the whole right half of the screen on mobile as "throw next switch") and audio ticks.
- Dead ends feel punishing. Fix: a buffer bonk only costs time, with no death, and in L1 you can't fail.

**Shared-system needs:**
- a `railNetwork` spline graph with switch states that is deterministic and shared across players (needed for the versus sabotage)
- the boss state machine must support a boss on a path that is hit by level events

---

### 42 Magnet Coin Lab  (World 4, yellow)
**One-line hook:** Flip your polarity to fly between magnet pads, and herd swarms of steel coins through Zuno's tinker lab into the coin bank.

**Signature mechanic:** Polarity flip.
- **Flipping:** Action toggles the hero between **+** and **−**. They are shown with shape icons (a ring for +, a bar for −) plus tone, not by colour.
- **Magnet pads** (`m2MagnetPad`) in range 6 m: opposite polarity pulls you (to cross gaps), and same polarity pushes you (to launch upward, 8 m).
- **Coins:** steel coins (`m2SilverCoin`) are attracted to you as a swarm of up to 30. They lag behind you, catch on corners and fall into pits.
- **Polarity gates** (`m2PolarityGate`) only let one sign through, so they filter your swarm and you.
- **Rooms:** each level is 5–7 small puzzle rooms. The goal in each room is to get N coins into the bank (`m2TreasureChest` re-skinned as a toy piggy-bank, a reuse).

**Why it's different from:**
- *23 Gem Collector 3D* (W4): that is an open score arena about path shape. This is hand-built room puzzles with push and pull physics.
- *44 Crystal Cave Switch* (W5): that toggles world states. Here you toggle *yourself*, and the force acts on you and on the coins.

**Hero roles:**
- Zuno (lead): Magnet "overcharge" doubles the range to 12 m and pulls coins through thin walls (`MagnetTrail`). This is the only hero who solves the "behind glass" coin vaults.
- Riko: Dash plus a repel pad gives a 1.5× long launch, and Dash breaks cracked lab glass (`CrackedWall`).
- Nami: double jump reaches a high shelf (`HighLedge`) with a spare coin pile.
- Kiro: Shield crosses static-spark floors (`HazardZone`, where sparks would scatter your swarm).
- Vexa: Phase goes through the ghost lab wall (`GhostWall`) into a storage room.

**Levels:**
- L1 Basic Magnet: teaches the mechanic in 3 beats.
  - (1) Walk near a coin pile; it follows you; walk into the bank.
  - (2) Flip to opposite, and a pad pulls you over a 4 m gap.
  - (3) Flip to same on a pad for a launch to the upper exit (with a coin swarm in tow).
- L2 Two Poles: twist, polarity gates. You must pass a gate as one sign and flip right after it to keep your coins (the coins inherit your sign).
- L3 Moving Metal: twist, metal blocks (`m2MetalBlockV2`) that you pull or push into place as bridges or coin dams. The blocks slide on rails.
- L4 Drone Lab: twist, lab drones (`m2LabDrone`) steal coins. Repel them at close range to knock the coins loose.
- L5 Scrap Magnus, boss (a composite golem built in code from `m2MetalBlockV2` blocks with a `m2HorseshoeMagnet` head, a frozen helper):
  - **P1 Tug:** he pulsates, alternating + and − every 3 s, and the HUD ring shows his sign. Match his sign to be pushed away from his slam, then flip to opposite to be yanked into his chest core. 3 hits.
  - **P2 Block storm:** he hurls metal blocks. Attract one, then flip to repel and throw it back. 3 hits; each one knocks off armour blocks.
  - **P3 Core:** his core floats above a ring of pads. Chain three pad launches (pull, push, pull) in 4 s for the final strike. Slow-mo as the coins shower gold.

**Stars:**
- clear
- all orbs (3 per room)
- time: par per level 90 / 120 / 150 / 170 / 180 s

Bonus: all coins banked (no coin lost).

**Secrets:**
- the storage room (Vexa)
- a "prototype magnet toy" sticker behind glass (Zuno only)
- in L3, a hidden route made by pushing a block into a vent

**Juice moments:**
- field-line ripples on each flip
- coins clink with pitch rising as the swarm grows
- pad pull with a stretch on the hero model
- repel launch: a boom ring and camera kick
- bank deposit: a cascade and a coin counter roll-up
- Magnus's blocks fly apart in slow-mo

**Multiplayer (1-4):**
- **Co-op:** two heroes with opposite signs attract each other, so one can yank the other across gaps. There are co-op-only rooms built around this "magnetic pair".
- **Versus "Coin Tug":** both pull the same swarm toward their own bank.
- **Party "Coin Storm":** 60 s in an open lab. Most coins banked wins.
- **Camera:** shared, fitted per room.

**Assets:**
- ready in `magnet-coin-lab/`: `m2HorseshoeMagnet`, `m2LabDrone`, `m2LabMachineBg`, `m2LabPlatform`, `m2LabPlatformV2`, `m2MagnetPad`, `m2MetalBlockV2`, `m2PolarityGate`, `m2SilverCoin`
- from `gem-collector-3d/`: `m2TreasureChest` (the bank)
- shared: `m2FactoryDrone` (not used, to stay off W1's theme)
- nothing new is MUST; `m2ToyPiggyBank` is NICE (a nicer bank)

**Risks:**
- Magnet physics can feel floaty or unclear. Fixes:
  - forces are capped and eased
  - a visible field ring on each pad with + and − icons
  - the hero's sign is shown on the hero (a halo shape) and on the HUD
- Puzzles get too hard. Fix: every room is solvable by any hero, and Zuno only adds shortcuts. Coins that fall respawn on their pile after 3 s.

**Shared-system needs:**
- a deterministic `magnetField` (point sources with a sign, forces on the hero and on coin boids)
- coin swarm as `InstancedMesh`
- a composite boss (one built from instanced parts) in the `boss` state machine

---

## Hyper3D models needed

Reuse is maximised. Most of W4 is covered by ready models: 64 ready files in the eight folders, plus shared heroes and bosses. Only true gaps are requested below.

### 9 Ice Peak Jumper
Reuses:
- `ice-peak-jumper/`: all 11 files
- shared: `m2FrostGolemBoss`, `m2IceSlime`, `m2HeroZuno` and the other 4 heroes
- root: `checkpointBeacon`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| (none) | | | Fully covered by ready models. |

### 18 Toy Room Run
Reuses:
- `toy-room-run/`: all 11 files
- shared: `m2PatrolBot` (wind-up patrol)
- root: `checkpointBeacon`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ToyDomino | prop | MUST for level 1 vertical slice | Stylized giant wooden toy domino tile standing on its short edge for a premium mobile/browser arcade game, rounded bevelled edges, warm painted cream wood with simple round dot inlays, slightly worn toy finish, neutral areas suitable for runtime recolouring, clean low-poly game-ready geometry, no text, no logos |
| m2JackBoxBoss | boss | MUST for L2–5 | Stylized giant jack-in-the-box toy boss for a premium mobile/browser arcade game, cube toy box with brass crank on the side, a goofy spring-loaded creature head with round button eyes and a wobbly coil spring neck, frosty grey-and-pastel paint with chipped edges, neutral pose with the lid open, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2WindUpKey | prop | NICE | Stylized oversized brass wind-up toy key for a premium mobile/browser arcade game, butterfly-shaped handle on a short shaft, polished but chunky, clean low-poly game-ready geometry, no text, no logos |

### 19 Candy World Runner
Reuses:
- `candy-world-runner/`: all 8 files
- shared: `m2CandyKingBoss`, `m2GummyMonster`
- root: `checkpointBeacon`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2FrostedCupcakeTower | set-piece | NICE | Stylized tall stacked cupcake tower set-piece for a premium mobile/browser arcade game, three frosted cupcakes stacked with icy blue frosting and sugar-snow sprinkles, glossy pastel wrappers, frozen candy kingdom feel, clean low-poly game-ready geometry, no text, no logos |

### 20 Snow Slide Dash
Reuses:
- `snow-slide-dash/`: all 7 files
- `ice-peak-jumper/`: `m2SnowYeti` (boss at 3×), `m2Snowball`, `m2CrackedIcePlatform`
- root: `checkpointBeacon`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ToySled | prop | NICE | Stylized wooden toy sled for a premium mobile/browser arcade game, curved runners with brass caps, painted slats with soft frost on the edges, cosy workshop-made look, clean low-poly game-ready geometry, no text, no logos |

### 23 Gem Collector 3D
Reuses:
- `gem-collector-3d/`: all 7 files
- shared: `m2GummyMonster` (boss at 3×), `m2IceSlime`, `m2SlimeBlob`
- `ice-peak-jumper/`: `m2IceCrystal`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2FacetGem | prop | MUST for level 1 vertical slice | Stylized floating faceted gem ornament collectible for a premium mobile/browser arcade game, rounded brilliant-cut shape with a small brass cap like a holiday bauble, neutral pale crystal material suitable for runtime recolouring and emissive glow, clean low-poly game-ready geometry under 1500 triangles, no text, no logos |

### 32 Plate Bounce Arena
Reuses:
- `plate-bounce-arena/`: all 4 files
- `gem-collector-3d/`: `m2ArenaTile`, `m2ArenaRimWall`
- `color-rail-grind/`: `m2RailSegment`
- `magnet-coin-lab/`: `m2MagnetPad`
- root: `bouncePad`
- shared: `m2ShadowArmadillo` (boss)

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ToyFlipper | prop | MUST for level 1 vertical slice | Stylized pinball flipper for a giant toy pinball table in a premium mobile/browser arcade game, tapered rounded paddle with a rubber edge band and a brass pivot cap, glossy toy plastic, neutral colour suitable for runtime recolouring, lying flat, clean low-poly game-ready geometry, no text, no logos |
| m2PinballPlunger | prop | NICE | Stylized spring plunger launcher for a giant toy pinball table in a premium mobile/browser arcade game, chunky brass spring in a wooden housing with a round knob handle, clean low-poly game-ready geometry, no text, no logos |
| m2PenguinDropTarget | prop | NICE | Stylized toy penguin drop-target for a giant pinball table in a premium mobile/browser arcade game, flat-backed rounded penguin figure on a hinged base, painted wood toy finish with frost dusting, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 35 Color Rail Grind
Reuses:
- `color-rail-grind/`: all 8 files
- `snow-slide-dash/`: `m2SnowPine`, `m2SnowCabinBg`
- `ice-peak-jumper/`: `m2Icicle`
- `toy-room-run/`: `m2ToyBlocks`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ClockworkTrainBoss | boss | MUST for L2–5 | Stylized oversized clockwork toy steam locomotive boss for a premium mobile/browser arcade game, chunky rounded tin-toy body, big brass wind-up key on the roof, glowing round headlamp eyes and a grumpy grille mouth, frost on the edges, grey-and-pastel paint, neutral pose on straight track, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2ToyTrainWagon | prop | NICE | Stylized tin-toy train wagon for a premium mobile/browser arcade game, open-top cargo wagon with rounded edges and brass couplings, pastel paint with frost on the rim, clean low-poly game-ready geometry, no text, no logos |

### 42 Magnet Coin Lab
Reuses:
- `magnet-coin-lab/`: all 9 files
- `gem-collector-3d/`: `m2TreasureChest` (bank)
- the boss is a composite of `m2MetalBlockV2` and `m2HorseshoeMagnet`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ToyPiggyBank | prop | NICE | Stylized large toy piggy bank coin collector for a premium mobile/browser arcade game, round ceramic body with a brass coin slot on top and small brass feet, glossy pastel glaze, original design, clean low-poly game-ready geometry, no text, no logos |

### World 4 map (shared)
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2WorkshopClockTower | background | NICE | Stylized snowy toy-workshop clock tower landmark for a premium mobile/browser arcade game world map, timber and brass tower with a big round clock face without numerals, lantern windows, deep snow on the roofs, cosy mountain-village feel, clean low-poly game-ready geometry, no text, no logos |

**Totals: must-L1 = 3** (`m2ToyDomino`, `m2FacetGem`, `m2ToyFlipper`), **must-L2–5 = 2** (`m2JackBoxBoss`, `m2ClockworkTrainBoss`), **nice = 8** (`m2WindUpKey`, `m2FrostedCupcakeTower`, `m2ToySled`, `m2PinballPlunger`, `m2PenguinDropTarget`, `m2ToyTrainWagon`, `m2ToyPiggyBank`, `m2WorkshopClockTower`).
