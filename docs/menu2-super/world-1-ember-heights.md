# World 1: Ember Heights (red, Riko, Dash)

## World intro
**Look.** A city built on the flank of a sleeping volcano. Rooftops and neon signs sit at the top. Below them are a street-level city, a travelling circus on its edge, a factory district, the mines, the dragon's caves, and finally the volcano core. Shadow Plates has drained it to ash grey: the neon is dead, the furnaces are cold and the lava has crusted over. Red only shows on things the player touches or restores, so the world-map colour comes back district by district.

**Music.** Driving brass-and-drum street funk with a fast backbeat (about 128 BPM) in the city. It turns heavier and more industrial in the factory and mines (metal percussion, low brass), and in the core it becomes a deep pulse built on a heartbeat kick. Every game uses the same four-bar riff, re-orchestrated.

**World map order (descending the mountain):** 2 Rooftop Roll Climb, then 43 Roll Cannon Jump, 15 Color City Sprint, 46 Color Door Sprint, 13 Robot Factory Run, 12 Mine Tunnel Run, 14 Dragon Cave Rush, and last 4 Lava Pillar Jump, the world finale.

**Guardian boss.** Kalder the Magma Golem (`m2MagmaGolemBoss`) is the volcano's guardian. Shadow Plates has crusted his molten heart in grey plates. Each W1 game has its own level-5 boss, either a Shadow Plates lieutenant or a drained local creature, and Kalder is fought in Lava Pillar Jump L5.

**How the colour returns.** Each game cleared relights its district on the world map: rooftop neon, the circus lights, city streets, the gate hall, the furnaces, the ore veins, the crystal caves. When Kalder's crust breaks, the lava glows red again, a red shockwave rolls up the mountain on the map, and Riko's plates turn from grey to full red (cheer animation plus a world-restored sticker).

**W1 design rule.** This world is about speed, and every game expresses it with a different verb:

| # | Game | Core verb |
|---|---|---|
| 2 | Rooftop | bank momentum on slopes |
| 43 | Roll Cannon | aim and fire yourself |
| 15 | Color City | choose your own line through an open city |
| 46 | Color Door | read a rule and commit to a door |
| 13 | Robot Factory | rewire the conveyor line |
| 12 | Mine Tunnel | dig your own tunnel |
| 14 | Dragon Cave | ride a cart with a chaser behind you |
| 4 | Lava Pillar | out-climb a pulsing lava tide |

**Shared rules W1 relies on.**
- From the existing prototypes: run speed 6.5 m/s, gravity 30, jump 14 m/s (apex 3.27 m), a 130 ms jump buffer, 100 ms coyote time, the whole-ms deterministic clock, and pickups that take time off a time game.
- Two moves added to the shared `heroAnims` and `powers`:
  - **Roll** (Shift, or the gamepad B / touch Roll button) curls the hero into a ball.
  - **Roll-drop** (Roll pressed in the air) is a fast ground-pound at 22 m/s down. Most W1 bosses are hit with a roll-drop or a ball-ram.

---

### 2 Rooftop Roll Climb  (World 1, red)
**One-line hook:** Curl into a ball on slanted roofs to bank speed, then spend it on huge leaps up a zigzag city skyline.

**Signature mechanic: slope momentum.**
- Holding Roll on a sloped roof (15 to 30 degrees) accelerates the ball downhill at 6 to 9 m/s², up to `V_ROLL_MAX` 13 m/s.
- Releasing Roll into a jump at a roof lip keeps the banked horizontal speed, so a leap covers up to about 12 m, against 6 m from a normal run.
- While curled, speed bleeds off at 4 m/s² on flat roofs and 9 m/s² uphill.
- If you uncurl without jumping, you brake to 6.5 m/s over 0.3 s.
- The level loop: climb a block (fire escapes, AC units, ladders), roll down its slope, leap across a street to the next, higher block, then switch back (the zigzag).
- Controls: move, Jump, Roll, Power.

**Keep from the prototype:**
- the zigzag stack of roofs
- sliding roofs, and blinking roofs with their 1600 ms grip
- icy decks, which become rain-wet tin roofs here
- checkpoint lamps
- coins worth 400 ms
- the 7 m fall-and-respawn rule
- the honest bot and the Dijkstra lower bound, which must now use `V_ROLL_MAX` on slope edges

**Why it's different from:**
- *1 Sky Tower Jump (W2):* Sky Tower is pure vertical reach. Here the height comes from climbing, and the gaps are crossed with speed you built yourself.
- *43 Roll Cannon Jump (W1):* the cannon is aim-and-fire with a fixed launch. Here the launch speed is earned continuously by your line down the slope.

**Hero roles:**
- **Riko:** dash plus Roll gives a 15.5 m/s burst at a lip. It smashes cracked skylights, opening a drop-through shortcut one block lower that skips a fire escape.
- **Nami:** double jump reaches the water-tower ledges. Each one holds a colour orb and a slope that starts one roof higher.
- **Kiro:** shield lets you roll through neon-sign spark arcs (L4 and L5), the shorter route.
- **Zuno:** magnet pulls coin trails out of gutters and drainpipes along the slope line.
- **Vexa:** phase passes through ghost billboards (purple-outlined) that block a straight slope-to-slope line.

**Levels:**
- **L1 Low Roofs** (90 s timer, 6 blocks). Three beats:
  1. A gentle slope ends in a 7 m gap that only a rolled leap clears. The landing roof is wide, and a short ladder lets a failed roll retry.
  2. A fire-escape climb, then a second slope facing the opposite way: the first switchback.
  3. Two slopes chained: landing on the next slope while still curled keeps the speed. This ends at the helipad.
- **L2 Office Roofs.** Twist: window-cleaner gondolas slide (movers, 2.4 s period) as landing pads in mid-street. Timing the roll so the leap meets a gondola is the new skill.
- **L3 Moving Rooftops.** Twist:
  - Crane-swung roof slabs (pendulum, 3.2 s).
  - Rain-wet tin slopes accelerate 1.5 times faster, but you cannot brake on them.
  - Blinking roofs return.
- **L4 Night Skyline.** Twist:
  - Chimney updrafts replace the prototype's wind: a column lifts a curled ball by 4 m and gives a vertical shortcut.
  - Neon-sign spark arcs on a 2.8 s cycle.
  - Night look.
- **L5 High-Rise Climb: boss "Ashback, the Shadow Armadillo"** (`m2ShadowArmadillo`), a race boss with a distance meter instead of an HP bar.
  - **P1, Race:** Ashback races you up the lower blocks and kicks water tanks into the slopes. A tank is a 1 s rolling hazard, telegraphed by a wobble. Overtaking him in a rolled leap scores a hit, and you need 2.
  - **P2, Grey paint:** he sprays slopes grey, making them sticky (no speed gain). Roll a slope before he reaches it (his target glows 1.5 s ahead) to keep it red. Ramming him at 10 m/s or more scores a hit, and you need 2.
  - **P3, Helipad duel:** he curls and rams across the pad on 2.5 s telegraphs. Dodge, and he hits the antenna and is stunned for 2 s. Roll down the pad's ramp into him 3 times. Slow-mo finish, and he flees down the mountain, a set-up for game 43.

**Stars:**
- Clear.
- All colour orbs (8 in L1, up to 16 in L5).
- Target time, set at about 1.5 times the bot's best: L1 about 35 s, L5 about 110 s.
- No-hit bonus.
- Scoring stays a time game: finish time minus 400 ms per coin.

**Secrets:**
- One hidden sticker per level in a gated spot (water tower, skylight, ghost billboard).
- L3 has a red colour shard on a crane hook that you reach only with a perfect rolled leap.
- L5 has a "no ladder" shortcut line.

**Juice moments:**
- Speed lines and an ember trail at 10 m/s or more.
- A camera FOV push of +8 degrees during a rolled leap.
- A thump with dust and a camera kick on landing.
- Neon relighting red as you pass under it.
- The combo meter chains slope, leap and slope within 0.6 s.

**Multiplayer (1-4):**
- **Versus race** up the same skyline. This is the best fit, with ghost races before M2.
- **Co-op:** Nami boosts a friend onto a tank. Two-hero gates: a cracked skylight (Riko) above a ghost billboard (Vexa).
- Shared vertical camera framing all heroes. If a player falls 2 blocks behind, they warp to the leader's checkpoint.

**Assets:**
- Ready: `m2RooftopBlock`, `m2RoofExhaustFan`, `m2RoofSolarRack`, `m2SkylineTower`, the shared heroes, `m2ShadowArmadillo` (and the `m2ShadowArmadilloR` variant), `checkpointBeacon`.
- New: `m2SlopedRoof` (MUST L1), `m2WaterTower` (NICE, a code mesh today).

**Risks:**
- Momentum can feel slippery. Fix: arcs stay deterministic, a landing-shadow preview shows while curled, and every slope gap has a wide L1-style landing.
- Higher speed breaks the old limits. Fix: re-derive the bound with `V_ROLL_MAX`, and keep a test that "roll on every slope" cannot beat the floor.

---

### 43 Roll Cannon Jump  (World 1, red)
**One-line hook:** Aim and fire yourself from cannon to cannon through a grey, drained circus, landing in moving cannons, trampolines and balloons.

**Signature mechanic: aim, time, fire.**
- In a cannon, the stick sets yaw (±60 degrees) and pitch (20 to 70 degrees).
- The power ring pulses from 60 to 100 % on a 1.2 s cycle, and Jump fires.
- An arc preview shows the full arc in L1, the first 50 % in L2 and L3, and the first 30 % in L4 and L5.
- In flight you get only a small air nudge (1.5 m/s²). Roll dives steeper, which corrects a long shot.
- A cannon within 1.2 m of the hero auto-catches it, with a 0.4 s hit-stop.
- Landing options: platforms, trampolines (`m2Trampoline`, bouncing to 1.3 times the incoming height) and balloon bunches (pop for one free re-aim in mid-air).
- From L3, auto-cannons fire on their own after 1.5 s in a chain, Barrel-Blast style: here timing replaces aiming.

**Why it's different from:**
- *45 Sky Hook Swing (W2):* swinging is continuous pendulum control. Here every shot is one committed ballistic decision.
- *27 Ring Jump Challenge (W2):* rings there are the goal of jumping. Here the fire hoops are optional bonus lines, and the core is landing in the next cannon.
- Also *2 Rooftop:* the launch speed is fixed by the cannon, not built by your movement.

**Hero roles:**
- **Riko:** dash in flight is a horizontal burst of 4 m extra. It smashes cracked target boards that open a hidden cannon line.
- **Nami:** double jump in flight is a second arc, reaching the high trapeze cannons with the orbs.
- **Kiro:** shield lets you fly through grey smoke jets (from L3), which otherwise knock you off your arc.
- **Zuno:** magnet pulls orb trails out of the tent canvas along your arc, within 4 m.
- **Vexa:** phase flies through ghost tent poles that block the direct shot.

**Levels:**
- **L1 Short Launch** (75 s, 6 cannons). Three beats:
  1. A fixed cannon pointing at a wide platform: just press fire.
  2. Aim at a cannon 8 m away, with the full arc preview.
  3. The power pulse matters: a short shot and a long shot, a trampoline catch, then the finish ring.
- **L2 Angle Practice.** Twist: pitch matters. Lob over a tent wall versus a flat shot under the trapeze. The preview is shortened.
- **L3 Moving Pads.** Twist: cannons ride rails (2.8 s), rotate on a wheel (auto-aim, fire on timing), and auto-cannon chains begin.
- **L4 Long Distance.** Twist:
  - Long shots of 25 m and more across the big top.
  - Balloon re-aims as the only way across one gap.
  - Smoke jets.
  - The preview is cut to 30 %.
- **L5 Big Top Finale: boss "Ashbag, the Smoke Blimp"**, a Shadow Plates lieutenant: a grey blimp circling inside the tent.
  - **P1:** fire yourself through its 3 smoke-pod balloons (one per circuit, 6 s). Each pod you pop rains orbs.
  - **P2:** it drops grey paint bombs that jam a cannon for 3 s (shadow telegraph 1 s). Bounce off trampolines into its gondola, and you need 2 hits.
  - **P3:** it rises to the top of the tent. Chain 4 auto-cannons upward, then roll-dive into its valve. Slow-mo, the tent lights turn red, and confetti.

**Stars:**
- Clear.
- All orbs.
- Target time.
- Bonus: "par shots" per level (L1 par 6), shown like golf.
- Time game: finish minus orb bonus. A shot count is stored for the par bonus but not scored.

**Secrets:**
- A hidden cannon behind a cracked board (Riko).
- A sticker on the trapeze (Nami).
- L4 has a "one-shot" line that skips 3 cannons when you hit the power pulse at 100 %.

**Juice moments:**
- A barrel-recoil camera kick.
- A trail ribbon in the hero's colour.
- Crowd silhouettes cheer when they turn red as you pass.
- A drumroll while aiming.
- Slow-mo for 0.3 s on a perfect 100 % shot.

**Multiplayer (1-4):**
- **Versus race** on mirrored cannon lanes.
- **Party "Cannon Golf":** most rings and fewest shots in 90 s.
- **Co-op:** a friend riding a moving cannon as a "catcher" can fire you on. Two-hero gate: Nami tops up the arc while Vexa's phase opens the pole line.
- Shared camera, since the arena is a single tent.

**Assets:**
- Ready: `m2CannonIsle`, `m2Trampoline`, `m2BalloonBunch`, `m2BigTopTentBg`, `bouncePad`, `islandA`/`islandB` (floating stands), the heroes.
- New: `m2RollCannon` (MUST L1), `m2SmokeBlimpBoss` (MUST L2–5), `m2FireHoop` (NICE, otherwise a code torus).

**Risks:**
- Trial and error can feel random. Fix: deterministic arcs, a fixed pulse cycle, a ghost of your last shot's arc, and every fall respawning in the last cannon in 0.8 s.
- Dead time while aiming. Fix: the pulse forces a decision within 2.4 s, and auto-cannons keep the rhythm.

---

### 15 Color City Sprint  (World 1, red)
**One-line hook:** Pick your own line through an open city between checkpoint beacons. Every street you restore turns into a red speed lane you can use on the next lap.

**Signature mechanic: route-making laps.**
- The city is an open 5 × 5 block grid with streets, alleys, plazas, ramps and bus roofs.
- One beacon is lit at a time (a pillar of red light), with an arrow at the edge of the screen. You choose the route.
- The path you take between two beacons is painted red. On later laps (2 or 3 per level) a red lane gives +30 % speed (8.5 m/s), and a chain of red lanes also builds the combo meter.
- Your lap-1 choices therefore design your lap-2 and lap-3 speed network. Players learn to plan a loop, not just the shortest line.
- Grey sludge puddles slow you by 40 %.
- Ramps (`m2StreetJumpRamp`) launch you onto bus roofs. Buses (`m2CityBus`) drive fixed loops, so they work as moving shortcuts.

**Why it's different from:**
- *25 Paint the Platforms (W6):* painting is the goal there. Here the paint is a by-product of your route and pays off as speed, and the score is time.
- *46 Color Door Sprint (W1):* that is a fixed corridor with forced choices. This is a free-roam open city with no lanes.

**Hero roles:**
- **Riko:** dash smashes cracked construction hoardings, opening diagonal cuts through a block.
- **Nami:** double jump from a bus roof reaches the elevated rail line, a fast ring road with 2 orbs.
- **Kiro:** shield lets you drive straight through sludge puddles and steam vents without slowing.
- **Zuno:** magnet pulls coin trails out of storm drains and fountains along the avenue.
- **Vexa:** phase passes through ghost shop-fronts (purple glow), a through-building shortcut.

**Levels:**
- **L1 Red Block** (2 laps, 4 beacons, a 3 × 3 sub-grid). Three beats:
  1. A beacon straight down an avenue.
  2. A beacon with a visible choice: a narrow alley that is shorter but has cones, or the clear avenue.
  3. Lap 2: your red lanes glow, you feel the boost, and the finish is in the plaza.
- **L2 Bus Line.** Twist: buses on loops (a 9 s cycle), ramps onto bus roofs, and one beacon that sits on a moving bus.
- **L3 Rush Hour.** Twist: colour gates (`m2ColorGate`) at crossings cycle open and shut every 4 s like traffic lights, so your route must meet green.
- **L4 Night Neon.** Twist:
  - Darkness: only streetlamps and your red lanes are lit.
  - Lap 1 is a scouting lap in the dark, and laps 2 and 3 run fast on the network you built.
  - Beacons are placed so a single loop can link them.
- **L5 Greyout Avenue: boss "Greyout, the Street Sweeper"**, a lieutenant's giant sweeper truck that erases your red lanes as it drives.
  - **P1:** chase it, ramp off a bus and land on its roof brush units. You need 3 hits, and each hit stops the erasing for 5 s.
  - **P2:** it sprays sludge and drops drone cones (`m2FactoryDrone`). Ride your surviving red lanes to catch it and roll-ram the tank valves at the back. You need 2.
  - **P3:** it rams you through the plaza. Lure it into a colour gate as the gate closes, twice. The gate slams, the truck spins out, and slow-mo shows the whole city repainting red.

**Stars:**
- Clear.
- All orbs (spread so no single route gets them all in one lap, which encourages different lines per lap).
- Target time.
- Time game.

**Secrets:**
- A rooftop sticker reachable from the elevated rail.
- A colour shard in a ghost shop.
- L4 has a hidden "perfect loop" achievement for linking every beacon on one red ring.

**Juice moments:**
- Red paint splashing up behind you as lanes form.
- A speed ripple when you enter a red lane.
- A bus horn and a dust kick on a ramp landing.
- A lap-split time pop.
- Windows lighting up as streets are restored.

**Multiplayer (1-4):**
- **Versus race** is the best fit. Each player's lanes are in their own colour and boost only them, and another player's lane counts as neutral.
- **Co-op relay:** players share one red network and beacons alternate between players.
- **Split screen** for 2 to 4 players, since the city is open and the players spread apart. For 2 players with the same target, a shared camera is optional.

**Assets:**
- Ready: `m2PastelCityBg`, `m2CityBus`, `m2CityBarrier`, `m2TrafficCone`, `m2StreetJumpRamp`, `m2ColorGate`/`m2ColorGateV2`, `m2EnergyGem` (orbs), `checkpointBeacon`, `m2SkylineTower` and `m2RooftopBlock` (city blocks, reused from game 2), `m2FactoryDrone`, the heroes.
- New: `m2GreySweeperBoss` (MUST L2–5), `m2TrafficLight` (NICE).

**Risks:**
- An open city can confuse, especially on a phone. Fix:
  - an edge arrow and a mini-map arc to the next beacon
  - sight lines so every beacon is visible from the one before
  - the L1 grid kept to 3 × 3
- The optimal route is solved once and gets boring. Fix: a daily seed reorders the beacons, with ghost races.
- Proof: the lower bound is Dijkstra over the street graph at red-lane speed on every edge, which assumes every lane is red.

---

### 46 Color Door Sprint  (World 1, red)
**One-line hook:** Sprint down Shadow Plates' Hall of Doors, read the rule lamp, and commit to the one true door before the wall locks.

**Signature mechanic: read and commit.**
- An auto-run corridor at 10 m/s in L1, rising to 18 m/s in L5, with 2 to 5 door lanes. A door wall comes every 35 to 45 m.
- A rule lamp hangs ahead and shows the rule for the next wall.
- Doors lock 0.6 s before impact, so a lane change after that does nothing.
- The true door gives a +0.5 s speed surge and combo.
- A wrong door bounces you back, costs 1.5 s and resets the combo.
- The rules escalate by level:
  - match the colour
  - match the sound (each colour has its own chime)
  - NOT this colour (the lamp is crossed out)
  - the echo rule: the lamp shows the rule for the wall after next, so you hold one rule in memory
- Controls: left and right (swipe on touch) to change lane, Jump over floor bars, Roll under low beams, Power.

**Why it's different from:**
- *21 Color Match Jump (W6):* that matches the hero's own colour to platforms. Here the rule is external, changes per wall and adds memory.
- *33 Mirror Dash (W5):* a mirrored-control mind game. Here the controls are plain, and the challenge is reading a rule at speed.

**Hero roles:**
- **Riko:** dash smashes a cracked fake door, which is always the wrong colour, into a hidden side corridor with 3 orbs and a skip of 2 walls.
- **Nami:** double jump reaches the upper door row over a tall wall (from L3), which holds a bonus orb lane.
- **Kiro:** shield absorbs one wrong door (no bounce) every 20 s.
- **Zuno:** magnet pulls the orb trails out of the corridor walls between door walls.
- **Vexa:** phase passes through a ghost door. Ghost doors are always right, but they are hard to spot (a faint shimmer).

**Levels:**
- **L1 Two Doors** (8 walls). Three beats:
  1. One door open, one shut: just steer.
  2. Two open doors in different colours, with the lamp colour shown on the floor arrows too.
  3. Lamp only, and a speed pad (`m2ChevronSpeedPad`) after the last wall.
- **L2 Three Doors.** Twist: three lanes, and the sound cue begins. Halfway through, the lamp dims, so you must hear the chime.
- **L3 Fake Door.** Twist:
  - Sliding doors (`m2SlidingDoor`) shift lanes during the approach.
  - Cracked fake doors appear.
  - The NOT rule arrives.
- **L4 Fast Gates.** Twist: the echo rule (memory one wall ahead), 4 to 5 lanes, and 16 m/s.
- **L5 Door Sprint Master: boss "Flicker, the Fire Spirit"** (`m2FireSpirit` scaled ×4), a drained fire spirit Shadow Plates set as the hall's warden.
  - **P1:** Flicker races ahead and slams doors. His flame colour is the rule. Every 4 correct doors in a row charge a "red rush". Fire the rush to ram him, and you need 3 hits.
  - **P2:** he throws fake cues: the lamp flickers between colours. The true colour is the one held longest (0.6 s against 0.2 s) and the one that chimes. You need 2 hits.
  - **P3:** he splits into 3 flames, each behind a door. Hit the one that matches the lamp, 3 times, at rising speed. Slow-mo, the hall turns red, and the doors swing open to the factory district.

**Stars:**
- Clear.
- All orbs.
- Target time.
- No wrong door counts as the no-hit bonus.
- Time game: auto-run, so time drops only through surges, shortcuts and orbs.

**Secrets:**
- Riko's side corridor in L1 and L3.
- A sticker in the upper door row (Nami).
- One ghost door per level leads to a colour shard.

**Juice moments:**
- Each true door bursts into red sparks with a rising chime pitch through the combo.
- A wrong door gives a thud, a camera kick and a grey dust puff.
- The lamp swings when the rule changes.
- Speed tunnel lines at 15 m/s and above.

**Multiplayer (1-4):**
- **Versus**, side by side in parallel corridors with the same seed, so every player meets the same rules.
- **Party "Door Roulette":** one shared corridor where each player's true door differs (it matches the player's hero colour), with last hero running.
- Split vertical strips for 2 to 4 players, each corridor narrow. On a phone, single player only.

**Assets:**
- Ready: `m2Doorway`/`m2DoorwayV2`, `m2SlidingDoor`, `m2ArchWall`, `m2ArchCorridorBg`, `m2ChevronSpeedPad`, `m2ScoreOrb`, `m2FireSpirit`, `m2MineLanternPost` (tinted as the rule lamp), the heroes.
- New: `m2RuleLamp` (NICE).

**Risks:**
- Reading at speed is hard for kids, and colour-blind players are excluded. Fix: every colour also has a shape on the door (circle, triangle, square, diamond, hex) and a chime, the L1 speed is low, and the reaction window never drops under 0.9 s.
- Memorising a fixed sequence. Fix: rules are seeded per run from a fixed pool, the proof stays seed-independent (auto-run time), and a daily seed applies.

---

### 13 Robot Factory Run  (World 1, red)
**One-line hook:** Rewire a live factory line: roll over switch plates to turn conveyor turntables and route yourself and the power cells into the exit charger.

**Signature mechanic: conveyor routing.**
- A 3/4-view factory floor built on a 2 m grid of conveyor belts (`m2Conveyor`). The belts carry everything on them at 2.5 m/s, adding to your own speed.
- Turntable junctions rotate 90 degrees (0.35 s) whenever someone rolls over the red switch plate wired to them.
- Power cells come out of a dispenser and ride the belts.
- Route 3 cells into the exit charger (2 cells in L1). Then the exit opens, and you must reach it.
- A cell that falls into a scrap press is lost and respawns after 4 s, which costs time.
- Hazards:
  - hydraulic presses (1.6 s cycle, shadow telegraph 0.5 s)
  - robot arms that sweep on a timer
  - tread bots
  - laser gates
- You are one moving piece on the board, so you route with your body.
- Controls: move, Jump, Roll (faster against belts), Power.

**Why it's different from:**
- *42 Magnet Coin Lab (W4):* that is about pulling collectables. Here the objects move by themselves, and you change the paths they follow.
- *39 Color Bridge Builder (W6):* building is placing new pieces. Here the board is fixed, and you rotate a live, moving system under time pressure.

**Hero roles:**
- **Riko:** dash flicks a cell sideways onto a neighbouring belt (a one-shot reroute) and breaks cracked crates that block a switch.
- **Nami:** double jump reaches catwalk switches (`m2SteelCatwalk`) that control the high turntables, plus an orb ledge.
- **Kiro:** shield lets you walk through a laser gate while carrying the route through, the short line.
- **Zuno:** magnet pulls a cell up to 4 m to you, hopping it one belt.
- **Vexa:** phase walks through ghost crates and press walls into a maintenance shortcut.

**Levels:**
- **L1 Assembly Start** (90 s). Three beats:
  1. Ride a belt to the charger room and see a cell travel.
  2. Roll a switch plate: a turntable turns, and the cell enters the charger.
  3. Two turntables and one press: time the cell past the press, then exit.
- **L2 Conveyor Hall.** Twist: belts reverse direction on a 6 s factory klaxon cycle, so routes must work in both phases or be timed.
- **L3 Robot Arms.** Twist: robot arms grab whatever sits on their pad and drop it 2 belts over on schedule. Use them as teleports for cells, or for yourself.
- **L4 Laser Line.** Twist: switch plates also toggle laser gates, so each rotation opens one path and closes another. Plan which state you need.
- **L5 Factory Overdrive: boss "Overseer M-8"** (`m2MegaRobotBoss`), Shadow Plates' factory foreman.
  - **P1:** M-8 stomps the floor, and its chest overload socket glows. Route 3 cells into it through turntables. It punches turntables, jamming them for 3 s, and Riko's dash unjams one early.
  - **P2:** it walks the belts. Reverse the belt under it with switches to drag it into presses, twice.
  - **P3:** it overheats and back vents open. Climb the catwalks and roll-drop into the vents, 3 times. Slow-mo, the furnaces relight red, and the line runs red cells.

**Stars:**
- Clear.
- All orbs.
- Target time.
- Bonus: "no lost cells".
- Time game: finish minus orbs.

**Secrets:**
- A hidden sixth turntable that sends a cell into a secret charger, which gives a sticker.
- A ghost crate maintenance room with a shard.
- L3 has an arm that carries you to a roof window.

**Juice moments:**
- A turntable clunk with sparks and a camera micro-kick.
- The charger fills with a rising tone per cell.
- Press slams with dust and hit-stop when a cell is saved by inches.
- Belts glow red as power returns.

**Multiplayer (1-4):** the best co-op game in W1.
- **Co-op:** one player rides, the others hold switches, and the levels have co-op-only dual switches (two plates pressed together).
- **Versus:** a split factory, each player charging their own exit, with a shared middle belt where you can steal a cell.
- Shared camera: the factory is one screen.

**Assets:**
- Ready: `m2Conveyor`, `m2FactoryCrate`, `m2FactoryHallBg`, `m2HydraulicPress`, `m2LaserGate`, `m2RobotArm`, `m2SteelCatwalk`, `m2TreadBot`, `m2PatrolBot`, `m2FactoryDrone`, `m2MegaRobotBoss`, `m2EnergyGem` (tinted as the cell), the heroes.
- New: `m2ConveyorTurntable` (MUST L1), `m2PowerCell` (NICE).

**Risks:**
- A puzzle that stalls. Fix: cells keep flowing and respawn, routes are short (at most 4 turntables in L1 to L3), and a "hint pulse" lights the next useful switch after 10 s idle.
- Turntable chaos in co-op. Fix: each switch shows on its belt arrow which way it will turn next.

---

### 12 Mine Tunnel Run  (World 1, red)
**One-line hook:** Bore your own tunnel down through a cross-section mine, and drop the boulders you loosen exactly where you want them.

**Genre change:** this game moves from a tunnel runner to a dig-action game. The old runner overlapped with games 13, 14 and 15. The title is kept, since you still run the tunnel, now one you carve yourself.

**Signature mechanic: dig and drop.**
- A side-on 2.5D cross-section of a mine on a 1 m cell grid, 20 to 28 cells wide and 40 to 80 deep.
- Moving into soil digs it:
  - soft soil: 0.2 s per cell
  - packed soil: 0.5 s
  - rock: undiggable
  - red ore: holds an orb
- In open tunnels you walk at 6.5 m/s, hop 2 cells, and roll down dug slopes at up to 9 m/s.
- Any boulder (`m2CaveRock`) with an empty cell below wobbles for 0.8 s, then falls. Falling boulders crush beetles and break cracked floors, and they hurt you.
- The goal: reach the lift at the bottom. Darkness lies beyond a 5 m radius, and lantern posts relight the area and act as checkpoints.
- Controls: 4-way move/dig, Jump, Roll, Power.

**Why it's different from:**
- *14 Dragon Cave Rush (W1):* that is a forward-moving rail chase. Here you create the level geometry yourself.
- *44 Crystal Cave Switch (W5):* that toggles existing crystal paths. Here you carve the terrain, and the falling physics is yours to aim.

**Hero roles:**
- **Riko:** dash bores 4 cells in a straight line instantly and smashes cracked rock (the shared `CrackedWall` as a cell type).
- **Nami:** double jump crosses open shafts to high air pockets that hold orbs.
- **Kiro:** shield takes one boulder hit or one flood, and lets you dig through a gas pocket.
- **Zuno:** magnet pulls orb trails through up to 2 cells of rock, so you do not need to dig to them.
- **Vexa:** phase passes through one layer of ghost rock (faint purple veins), the secret shafts.

**Levels:**
- **L1 Dry Tunnel** (90 s, 20 × 40). Three beats:
  1. Dig straight down through soft soil to a lantern.
  2. A boulder above your path wobbles and falls into the shaft you dug. You learn to step aside.
  3. Drop a boulder on a beetle (`m2CaveBeetle`) guarding the lift, by digging the cell under it.
- **L2 Pipe Zone.** Twist: ore carts on rails (`m2OreCart`, `m2MineRail`) cross the mine. Dig into a rail line and ride a cart at 10 m/s sideways.
- **L3 Water Gaps.** Twist: water pockets. Breach one and the water floods down through your tunnels (1 cell per 0.3 s), slowing you and putting out lanterns, so you must dig around them.
- **L4 Fast Tunnel.** Twist:
  - A rockfall line (`m2RockfallPile`) collapses from the top after 15 s at 1 row per 0.6 s, a chase from above.
  - Tunnelling beetles dig their own paths, which you can use.
- **L5 Deep Mine Sprint: boss "Rockjaw, the Tunnel Beetle"** (`m2CaveBeetle` scaled ×5, recoloured grey), a drained giant.
  - **P1:** Rockjaw chases you down a shaft. Dig side pockets to let it pass, then drop boulders on its shell, 3 times.
  - **P2:** it burrows and erupts under you, with a dust telegraph of 1 s. Lure it under boulder stacks.
  - **P3:** it is flipped on its back in the ore chamber. Roll-drop onto its belly 3 times. Slow-mo, the ore veins glow red, and the lift rises.

**Stars:**
- Clear.
- All orbs (ore cells).
- Target time.
- Time game.

**Secrets:**
- Ghost-rock shafts to shards.
- A sticker in a sealed air pocket (Nami).
- L3 has a hidden flooded room you open with a Kiro shield-dig.

**Juice moments:**
- Soil crumbles with grit particles.
- A boulder wobble with a rumble before it falls, then a dust camera shake on impact.
- A lantern relights with a warm bloom.
- An ore cell pops a red orb.

**Multiplayer (1-4):**
- **Co-op:** dig together. Co-op-only giant boulders need two heroes to loosen.
- **Versus race:** the mine is split left and right with a shared middle column, so you can drop boulders on a rival's path (it stuns, never kills).
- Shared camera on the cross-section, zooming out up to 1.4 times.

**Assets:**
- Ready: `m2MineBeam`, `m2MineEntranceBg`, `m2MineLanternPost`, `m2MineRail`/`m2MineRailR`, `mineTrackCurveI`, `m2OreCart`, `m2RockfallPile`, `m2CaveBeetle`/`m2CaveBeetleR`, `m2CaveRock` and `m2CrystalCluster` (reused from Dragon Cave), `m2FactoryCrate`, the heroes.
- New: `m2SoilBlockSet` (NICE, otherwise instanced code cubes), `m2MineLiftCage` (NICE).

**Risks:**
- Soft-locking by trapping yourself. Fix: every rock layer has a guaranteed digger route, a "dig-out" respawn at the last lantern after 2 s stuck, and boulders never seal the lift cell.
- Draw calls with many cells. Fix: instanced soil (1 draw per soil type), and only the cells near the camera are active.
- Proof: the lower bound is the shortest dig path with soft soil as the cost floor.

---

### 14 Dragon Cave Rush  (World 1, red)
**One-line hook:** Ride a mine cart through a crystal cave with an angry, drained dragon on your tail: lean into curves, hop gaps, duck its breath, and bring back its stolen egg.

**Signature mechanic: chase cart.**
- You ride a cart (`m2MineCart`) on rails at 14 m/s in L1, up to 22 m/s in L5.
- Lean left or right on curves. The correct lean gives +15 % speed. A wrong lean or no lean on a sharp curve tips the cart onto two wheels, with a warning, and a second wrong lean derails you (a hit).
- Jump hops gaps and rocks, and Down ducks under beams and breath.
- The dragon Cindermaw follows behind. A distance meter (0 to 100) shrinks on hits and rises on perfect leans and boosts. At 0 she catches you: a hit, and a respawn at the last lantern.
- Breath telegraph: an orange glow from behind and a roar, 1.0 s before the breath. Duck it, or swap to the parallel track at forks.
- Story: Shadow Plates' patrol bots stole her red egg (`m2DragonEgg`) and she thinks you did. You carry it home.

**Why it's different from:**
- *35 Color Rail Grind (W4):* grinding is board balance and jumping between rails. Here you are a passenger vehicle with lean physics and a threat behind you.
- *12 Mine Tunnel Run (W1):* digging versus a fixed, fast forward track.

**Hero roles:**
- **Riko:** dash is a cart boost that smashes cracked barricades onto a shortcut track and gains 20 distance.
- **Nami:** double jump hops the cart to the upper track (scaffold rails, `m2MineScaffold`), which carries the orbs.
- **Kiro:** shield absorbs one breath or lavafall (`m2LavafallRock`).
- **Zuno:** magnet pulls crystal trails off the cave walls as you pass.
- **Vexa:** phase rides ghost rails (purple, translucent), solid only while phasing, through a rockfall.

**Levels:**
- **L1 Crystal Entry** (90 s). Three beats:
  1. A calm ride with gentle curves: learn to lean.
  2. A gap and a low beam: learn to hop and duck.
  3. You pass the hoard, the dragon wakes, and a 20 s escape with 2 telegraphed breaths ends at the exit.
- **L2 Rockfall.** Twist: falling stalactites (`m2HangingCrystal`, shadow telegraph) and forks with 2 routes, one of them through a rockfall.
- **L3 Glow Tunnel.** Twist: a dark cave lit only by glow mushrooms (`m2GlowMushrooms`) and the dragon's breath. Each breath lights the track ahead for 1.2 s.
- **L4 Deep Cave.** Twist: lavafalls on timers, parallel tracks with lane swaps under fire, and breaths in pairs.
- **L5 Dragon Hoard: boss "Cindermaw"** (new), a cave dragon wearing Shadow Plates' grey collar.
  - **P1:** she flies on a parallel track. Jump trigger plates to drop hanging crystals onto her, 3 times.
  - **P2:** she flies ahead and attacks from the front with fireballs down the track. Swap tracks, then hit the boost ramps that fling ore into her, twice.
  - **P3:** a loop track around her. Hop at the 3 collar locks as you pass. Slow-mo, the collar breaks, she turns red, you hand back the egg, and she flies you out.

**Stars:**
- Clear.
- All orbs.
- Target time.
- Bonus: "never below 50 distance".
- Time game: the track speed is the main term and orbs subtract.

**Secrets:**
- A ghost-rail cave holding a sticker.
- The upper scaffold track to a colour shard.
- L4 has a hidden hoard room behind a cracked wall (Riko).

**Juice moments:**
- Sparks from the wheels on two-wheel tilts.
- An orange rim light flooding from behind as she breathes.
- Crystal shatter.
- Camera roll into leans.
- A roar shake.

**Multiplayer (1-4):**
- **Versus race** on parallel tracks, one cart each, with a shared dragon that targets the leader.
- **Co-op:** carts coupled in a train, with the lead player leaning and the rear player ducking and hopping.
- Shared chase camera for 2 players, split screen for 3 to 4.

**Assets:**
- Ready: the whole `dragon-cave-rush` folder (cave tiles, `m2CaveArchBridge`, `m2CaveBlockPlatform`, `m2CavePillarPlatform`, `m2CaveRock`, `m2CaveTempleArch`, `m2CaveTempleSteps`, `m2CaveWallChunk`, `m2CrystalCluster`, `m2DragonEgg`, `m2DragonHoard`, `m2DragonSkullGate`, `m2GlowMushrooms`, `m2HangingCrystal`, `m2LavafallRock`, `m2MineCart`, `m2MineScaffold`, `m2MineTrack`/`m2MineTrackR`, `m2Stalagmites`, `m2CaveLanternPost`), plus `m2CaveBat` and `m2PatrolBot` (the egg thieves).
- New: `m2CinderDragon` (MUST L1, since she is the chaser from L1).

**Risks:**
- Rail riding can feel on autopilot. Fix: a lean on every curve, a decision every 3 to 4 s, and distance as constant feedback.
- A chaser from behind is unfair if unseen. Fix: every breath has an audio, light and rim-glow telegraph of 1.0 s at least, and the meter is always visible.

---

### 4 Lava Pillar Jump  (World 1, red, world finale)
**One-line hook:** Out-climb a lava tide that surges on the volcano's heartbeat, on basalt pillars that heat under your feet and crumble if you linger, and ride the geysers that fire on each surge.

**Signature mechanic: heartbeat surges and hot-foot.**
- The lava rises at a base rate of 0.18 m/s (L1) up to 0.60 m/s (L5). On every heartbeat it also surges +1.2 m over 1.5 s:
  - every 6 s in L1
  - every 5 s in L2
  - every 4 s from L4
- The surge is telegraphed 1 s ahead by the cavern walls pulsing red and a deep kick drum.
- Every pillar top heats while you stand on it. It turns orange at 1.2 s and white at 2.4 s, and crumbles at 3.0 s. It cools back to black in 4 s once you leave.
- Geyser vents (`m2LavaGeyserVent`) fire only on the surge. Standing on one at the beat launches you 2 times higher than a jump. The threat is also the lift: you plan to arrive at a vent on the beat.
- Controls: move, Jump, Roll, Power.

**Keep from the prototype:**
- the S-sweep across the cavern (±4 to 6.5 m, 0.5 to 0.6 rad per pillar) and its uneven rises
- sliding basalt bridges, sinking orange shelves, glassy shelves and falling rocks
- crystals as checkpoints
- embers taking 400 ms off
- "lava covers the checkpoint, so the run ends"
- the proof: surge height is added to the lava curve, and vent launches go in the bound as a fixed launch apex

**Why it's different from:**
- *3 Flooded Ruins Escape (W2):* the rising water there is steady and swimmable. Here the tide is lethal, rhythmic, and also your elevator through the geysers.
- *2 Rooftop Roll Climb (W1):* that is a zigzag climb built on momentum. Here the time pressure comes from below and from the surface under you, and the route sweeps.

**Hero roles:**
- **Riko:** dash smashes cracked basalt caps that open a hollow-pillar chimney, an internal shortcut 2 pillars up.
- **Nami:** double jump reaches overhang shelves with embers and a safe cool ledge (no heat).
- **Kiro:** shield lets you stand in lava spray from vents and rocks, and a shielded hero can ride a vent off-beat.
- **Zuno:** magnet pulls ember trails out of the lava surface itself (only within 1 m of it, a risk-reward line).
- **Vexa:** phase passes through ghost obsidian walls into the inner core path, which is shorter.

**Levels:**
- **L1 Warm Cavern** (90 s). Three beats:
  1. A pillar glows under you: step to the next, and learn the heat.
  2. The first surge: climb 2 pillars before the beat, with a wide margin.
  3. Ride one vent on the beat to the exit ledge.
- **L2 Pillar Field.** Twist: sliding basalt bridges (`m2BasaltBridge`) that slide on the heartbeat, and surges every 5 s.
- **L3 Falling Rocks.** Twist: each surge shakes rocks (`m2LavaRock`) loose with shadow markers, and glassy and sinking shelves return.
- **L4 Fast Lava.** Twist: magma slugs (`m2MagmaSlug`) crawl over pillars and leave hot trails that heat a top 2 times faster, surges every 4 s, and narrower pillars.
- **L5 Volcano Core: boss "Kalder, the Magma Golem"** (`m2MagmaGolemBoss`), the W1 guardian, in a ring of pillars around him.
  - **P1:** his fist slams are the heartbeat, and each slam is a surge. Ride a vent on the slam onto his shoulders and roll-drop on the 3 grey crust plates.
  - **P2:** he tears pillars down and the lava rises steadily (no ebb). Launch off collapsing pillar tops to his back cracks, twice.
  - **P3:** his grey-crusted heart is exposed. Ride the biggest surge geyser to the cavern roof, then dive into the heart. Slow-mo, the crust shatters, the lava glows true red, and the W1 colour-return cutscene plays.

**Stars:**
- Clear.
- All embers.
- Target time.
- Bonus: "no crumbled pillar".
- Time game: finish minus 400 ms per ember.

**Secrets:**
- Hollow-pillar chimneys (Riko).
- A sticker on a cool overhang (Nami).
- A shard in the ghost obsidian core path.
- L3 hides a vent that only fires on every third beat, a big skip.

**Juice moments:**
- A heartbeat camera pulse and FOV breath on every surge.
- Pillar tops visibly heating, with steam when they cool.
- A geyser launch with a whoosh, a column of sparks and slow-mo at the apex for 0.15 s.
- Ember pops.

**Multiplayer (1-4):**
- **Co-op climb** with one shared lava. A fallen hero respawns on the highest friend's crystal. Co-op-only twin vents (both pressed on the beat give a mega-launch).
- **Party "Last Above Lava":** a ring arena with endless surges, last hero standing.
- Shared vertical camera.

**Assets:**
- Ready: `m2BasaltPillar`, `m2BasaltBridge`, `m2CollapsePlatform`, `m2Ember`, `m2LavaGeyserVent`, `m2LavaRock`, `m2MagmaSlug`, `m2VolcanoBg`, `m2MagmaGolemBoss`, `m2FireSpirit` (ambient spirits), the heroes.
- New: `m2ObsidianCheckpoint` (NICE, crystals are a code mesh today).

**Risks:**
- The heartbeat feels like a rhythm game (W3's theme). Fix: there are no beat inputs and no scoring on the beat. The beat is only a hazard and a lift you plan around.
- Heat and lava together are too punishing for kids. Fix: L1 heat takes 3.0 s with 1.2 s warnings, the surge is always telegraphed, and crystal checkpoints come every 3 pillars.

---

## Shared systems: what W1 needs
- **`heroAnims`:** roll-ball (held), roll-drop (ground pound), cart-ride lean/duck, cannon curl, and a dig pose (Mine). Roll is a shared input on every scheme (Shift, gamepad B, touch Roll button).
- **`powers`:**
  - `CrackedWall` must also work as a grid cell (Mine), a door (Door Sprint) and a track barricade (Dragon).
  - `GhostWall` must also work as ghost rails and ghost rock, which are solid only while phasing.
  - `MagnetTrail` must allow trails behind 2 cells of rock and on lava.
- **`boss`:**
  - Race and chase bosses (Ashback, Cindermaw P1, Rockjaw P1) need a distance meter instead of HP.
  - Multi-phase bosses need "environmental hit" sources: presses, gates, falling crystals and boulders.
- **Movement and proofs:**
  - The proof helpers need momentum edges (Rooftop `V_ROLL_MAX`), ballistic edges (Cannon, vents), street-graph Dijkstra with lane speed (City), grid dig cost (Mine), and auto-run fixed time (Door, Dragon).
  - Every new score source stays inside `maxScore`.
- **`combo`:** per-game chain windows (0.6 s Rooftop, per-door Door Sprint, per-lean Dragon).
- **`juice`:** FOV push on speed, hit-stop on cannon catches and door hits, heartbeat camera pulse.
- **`daily` + `ghost`:** seeded beacon order (City), seeded rule sets (Door), ghost arcs (Cannon), ghost races (Rooftop, City, Dragon).
- **Multiplayer:** split screen is needed for City, Dragon (3 to 4 players) and Door. All other W1 games use the shared fitted camera.

---

## Hyper3D models needed

### 2 Rooftop Roll Climb
Reuses `m2RooftopBlock`, `m2RoofExhaustFan`, `m2RoofSolarRack`, `m2SkylineTower`, `m2ShadowArmadillo`/`m2ShadowArmadilloR`, `checkpointBeacon` and the 5 heroes.

| id | type | priority | prompt |
|---|---|---|---|
| m2SlopedRoof | prop | MUST for level 1 vertical slice | Stylized slanted city rooftop section with a smooth 20-degree tin slope ending in a raised lip, grey-red painted metal panels, small gutter along the low edge, rectangular footprint about 6 by 8 metres, for a premium mobile/browser arcade game, readable silhouette, clean low-poly game-ready geometry, no text, no logos |
| m2WaterTower | prop | NICE | Stylized rooftop water tower, round wooden barrel tank on four steel legs with a little ladder and conical cap, warm red-brown wood and dark grey metal, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 43 Roll Cannon Jump
Reuses `m2CannonIsle`, `m2Trampoline`, `m2BalloonBunch`, `m2BigTopTentBg`, `bouncePad`, `islandA`, `islandB` and the heroes.

| id | type | priority | prompt |
|---|---|---|---|
| m2RollCannon | prop | MUST for level 1 vertical slice | Stylized circus launch cannon with a wide round barrel on a separate swivel base, red and cream stripes, brass bands, big friendly bore, barrel and base as separate parts for aiming, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |
| m2SmokeBlimpBoss | boss | MUST for L2–5 | Stylized villain smoke blimp boss, a grey patched airship balloon with three bulging smoke-pod sacs on its sides, a small riveted gondola underneath and a big valve on top, mischievous glowing eyes on the front, neutral pose, plain light-grey background, original design, not resembling any existing franchise, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |
| m2FireHoop | prop | NICE | Stylized circus fire hoop on a short stand, metal ring wrapped with stylized orange flame shapes, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 15 Color City Sprint
Reuses `m2PastelCityBg`, `m2CityBus`, `m2CityBarrier`, `m2TrafficCone`, `m2StreetJumpRamp`, `m2ColorGate`/`m2ColorGateV2`, `m2EnergyGem`, `checkpointBeacon`, `m2SkylineTower`, `m2RooftopBlock`, `m2FactoryDrone` and the heroes.

| id | type | priority | prompt |
|---|---|---|---|
| m2GreySweeperBoss | boss | MUST for L2–5 | Stylized giant villain street-sweeper truck boss, ash-grey bulky body with two spinning round brush units on the front corners, a large sludge tank with valves on the back, angry headlight eyes and a grille mouth, neutral pose, plain light-grey background, original design, not resembling any existing franchise, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |
| m2TrafficLight | prop | NICE | Stylized city traffic light post with three round lamps and a rounded housing, dark grey metal, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 46 Color Door Sprint
Reuses `m2Doorway`/`m2DoorwayV2`, `m2SlidingDoor`, `m2ArchWall`, `m2ArchCorridorBg`, `m2ChevronSpeedPad`, `m2ScoreOrb`, `m2FireSpirit` (as the boss), `m2MineLanternPost` (as the rule lamp) and the heroes. Nothing is a MUST.

| id | type | priority | prompt |
|---|---|---|---|
| m2RuleLamp | prop | NICE | Stylized hanging signal lamp on a chain, round glass globe in a metal cage with a flat front disc for a symbol, dark iron and warm glass, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 13 Robot Factory Run
Reuses `m2Conveyor`, `m2FactoryCrate`, `m2FactoryHallBg`, `m2HydraulicPress`, `m2LaserGate`, `m2RobotArm`, `m2SteelCatwalk`, `m2TreadBot`, `m2PatrolBot`, `m2FactoryDrone`, `m2MegaRobotBoss`, `m2EnergyGem` and the heroes.

| id | type | priority | prompt |
|---|---|---|---|
| m2ConveyorTurntable | prop | MUST for level 1 vertical slice | Stylized factory conveyor turntable junction, a square 2 by 2 metre frame holding a round rotating disc with a short conveyor belt section and big arrow ridges, small red switch plate beside it, steel grey and red, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |
| m2PowerCell | prop | NICE | Stylized glowing power cell canister, chunky capsule with metal end caps and a bright red glowing core visible through glass windows, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 12 Mine Tunnel Run
Reuses `m2MineBeam`, `m2MineEntranceBg`, `m2MineLanternPost`, `m2MineRail`/`m2MineRailR`, `mineTrackCurveI`, `m2OreCart`, `m2RockfallPile`, `m2CaveBeetle`/`m2CaveBeetleR` (scaled ×5 as the boss), `m2CaveRock`, `m2CrystalCluster`, `m2FactoryCrate` and the heroes. Nothing is a MUST.

| id | type | priority | prompt |
|---|---|---|---|
| m2SoilBlockSet | prop | NICE | Stylized set of four 1-metre mine terrain cubes with softly bevelled edges: soft brown soil, packed dark soil, grey rock, and rock with glowing red ore veins, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |
| m2MineLiftCage | set-piece | NICE | Stylized mine elevator cage with a wooden platform, iron-bar frame, pulley wheel on top and a lantern hook, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 14 Dragon Cave Rush
Reuses the whole `dragon-cave-rush` folder (25 files, including `m2MineCart`, `m2MineTrack`, `m2DragonEgg`, `m2DragonHoard`, `m2HangingCrystal`), plus `m2CaveBat`, `m2PatrolBot` and the heroes.

| id | type | priority | prompt |
|---|---|---|---|
| m2CinderDragon | boss | MUST for level 1 vertical slice | Stylized cave dragon boss, big friendly-fierce four-legged dragon with folded bat-like wings, ember-red scales currently faded to ash grey, glowing orange throat, rounded horns, a heavy grey metal collar with three locks around its neck, T-pose, plain light-grey background, original design, not resembling any existing franchise, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### 4 Lava Pillar Jump
Reuses `m2BasaltPillar`, `m2BasaltBridge`, `m2CollapsePlatform`, `m2Ember`, `m2LavaGeyserVent`, `m2LavaRock`, `m2MagmaSlug`, `m2VolcanoBg`, `m2MagmaGolemBoss`, `m2FireSpirit` and the heroes. Nothing is a MUST.

| id | type | priority | prompt |
|---|---|---|---|
| m2ObsidianCheckpoint | prop | NICE | Stylized obsidian checkpoint crystal on a small basalt base, tall black glassy crystal with a red glowing core, for a premium mobile/browser arcade game, clean low-poly game-ready geometry, no text, no logos |

### Total
- **MUST for level 1 vertical slice: 4** (m2SlopedRoof, m2RollCannon, m2ConveyorTurntable, m2CinderDragon)
- **MUST for L2–5: 2** (m2SmokeBlimpBoss, m2GreySweeperBoss)
- **NICE: 8** (m2WaterTower, m2FireHoop, m2TrafficLight, m2RuleLamp, m2PowerCell, m2SoilBlockSet, m2MineLiftCage, m2ObsidianCheckpoint). Each one has a code-mesh or tinted-reuse fallback, so any of them can be skipped.
