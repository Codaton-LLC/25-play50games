# World 2: Sky & Sea (blue, lead hero Nami, Double Jump)

## World intro

**Look.** At the start everything is chalk-grey: bleached sky islands, a flat grey sea, rain-coloured ruins. As the player clears levels the colour comes back in layers. First cerulean sky, then teal water, then white foam and gold sunlight on the cloud edges. The palette is airy and high-key: big negative space, long draw distance through soft fog, readable silhouettes against the sky. Hazards are always storm-violet with a white rim, so they read on both grey and blue.

**Music mood.** Breezy and buoyant at 100–120 BPM: marimba, steel pan, plucked harp, soft synth pads and a whistled lead. Stems are added as the combo meter rises: percussion at x2, bass at x3, lead at x4. Boss tracks swap the pads for low brass and storm drums. Every level starts on the grey version of its loop (filtered, mono) and opens to the full stereo mix as colour orbs are collected.

**Guardian.** **Tempest, the Storm Hawk** (`m2StormHawkBoss`), set over the sky by Shadow Plates. Its wings hold the stolen blue as a storm ring around the world. Its lieutenants and creatures guard the other seven games. The final fight with Tempest is Sky Tower Jump L5.

**How the colour returns.** Every game ends its L5 by ringing a **Tide Bell**. That restores one region of the W2 map node: islands, ruins, cloud sea, ring canyon, surf bay, wind tunnels, airship docks and sea stacks. With all 8 bells rung, Tempest's storm ring breaks on the world map (a slow-mo cutscene of about 6 s), the map sky turns blue and Nami's sash and visor regain their colour. Partial progress is visible all along: each cleared level adds a band of blue to that game's map node.

**Core verbs in this world: each one is different.**
| # | Game | Core verb | Direction of play |
|---|---|---|---|
| 1 | Sky Tower Jump | **SLAM**: ground-pound into pads to bank bounce height | up |
| 3 | Flooded Ruins Escape | **FLOOD**: raise and lower the water to make your own route | up, through a puzzle |
| 5 | Cloud Hopper | **GLIDE**: hop on sinking clouds, spend feathers to glide | across |
| 27 | Ring Jump Challenge | **DIVE**: steer a free-fall through rings | down |
| 37 | Plate Surf | **CARVE**: pump up and down a wave face for speed | along a wave |
| 41 | Wind Tunnel Escape | **REDIRECT**: turn fans to route currents, then ride them | through a maze |
| 45 | Sky Hook Swing | **SWING**: aim a hook, reel the rope, release at the peak | across gaps |
| 49 | Zipline Rush | **RIDE**: brake or tuck on sagging cables, hop between lines | down along a line |

Sky Tower goes up by bouncing, Cloud Hopper goes across by gliding and Ring Jump goes down by diving. The three no longer share a direction or a button rhythm.

**Shared-system needs for W2** (in addition to the framework list):
- `heroAnims` extra clips: `slam` (Sky Tower), `glide` and `skydive` (Cloud Hopper, Ring Jump), `swim` and `float` (Flooded Ruins), `surfStance`, `carveL/R` and `trick` (Plate Surf), `hang` and `tuck` (Zipline), `swing` and `hookThrow` (Sky Hook).
- `water`: one water volume with an animated level (`setTarget(y, speed)`), buoyancy, a swim state, and a shader where the surface is the only transparent draw. Used by 3 and 37.
- `windField`: box or cylinder volumes with a direction vector and strength, shown as streak particles. Used by 5, 41 and 27 (updrafts).
- `tether`: a pendulum rope with variable length (Sky Hook) and a `cableRider` that follows a spline with sag (Zipline).
- `airControl`: a mode for falling and gliding with tunable drag, lift and a terminal speed. Used by 5 and 27.
- `powers`: Nami's double jump must also give a mid-air re-orient in dive and glide states (spec below), so the lead hero stays useful in games where nobody jumps from the ground.

---

### 1 Sky Tower Jump  (World 2, blue)
**One-line hook:** Climb a storm-wrapped tower of floating islands by slamming into bounce pads. Every slam banks more height for the next bounce.
**Signature mechanic:** **Slam-bounce chain.**
- Press Jump in the air to **Slam**: the hero becomes a ball and drops at 22 m/s.
- Landing a Slam on a bounce pad launches the hero at the chain height: 8 m, then 11 m, then 14 m, up to a cap of 17 m.
- The chain holds if the next pad is Slammed within 2.5 s. A normal landing resets it to 8 m.
- Pad types, recoloured at runtime:
  - **plain** (blue)
  - **angled** (tilted 30°, throws the hero sideways to the next island face)
  - **moving** (on `movingBlock` rails, 2–4 m/s)
  - **cracked** (holds 1 slam, then falls)
- Ordinary jumps still exist for short hops, at 3.2 m, so the pads are the only way to gain real height.
- Kept from the prototype: floating islands, bounce pads, moving blocks and checkpoint beacons every 40 m.
**Why it's different from:**
- **Cloud Hopper:** that game goes across and is about drift and glide. Sky Tower goes up and is about timing the downward Slam.
- **Plate Bounce Arena (W4):** that one is a flat party arena where you bounce rivals off. Here the bouncing is a solo vertical chain with aimed pads.
**Hero roles:**
- **Riko:** dash-Slam diagonally (a 6 m horizontal lunge into the Slam). It breaks cracked island walls that hide pad shortcuts that skip about 15 m.
- **Nami:** her double jump becomes a **re-Slam**. She can cancel a mis-aimed Slam once, hop 2 m and Slam again, which keeps the chain on hard angled pads. High ledges hold orb clusters.
- **Kiro:** his shield absorbs a lightning strike in the storm bands without dropping the chain.
- **Zuno:** his magnet pulls orb trails out of the waterfall islands (`m2SkyIslandWaterfall`).
- **Vexa:** phases through ghost floors on spires. Dropping through one lands on a hidden pad inside the spire, a vertical chimney route.
**Levels:**
- **L1 Training Sky (60 m):**
  - Beat 1: one pad by itself. Slam onto it and get the 8 m pop.
  - Beat 2: two pads in a row, where the second pop visibly goes higher (11 m) and the HUD chain gem lights.
  - Beat 3: a gap that only a x3 chain clears, with a safe walk-around ledge underneath.
  - Checkpoint, then the castle island at the top.
- **L2 Cloud Steps (100 m):** twist: **angled pads**. Islands sit on staggered faces of a ring, so the climb spirals around the tower core (`m2SkyIslandSpire`).
- **L3 Moving Platforms (150 m):** twist: **moving pads** on rails. You Slam where the pad *will be*. A ghost marker shows the impact point while falling.
- **L4 Storm Heights (220 m):** twist: **lightning bands**. Every 6 s a violet band crosses a height. It is telegraphed 1.5 s ahead, and a hit breaks the chain. Cracked pads come back too.
- **L5 Infinite Tower, boss "Tempest the Storm Hawk":**
  - **Phase 1: circling.** Tempest circles the summit and throws wind gusts that push the hero 3 m sideways. Bounce above it (x3 chain or more) and Slam onto its back. That counts as 1 hit, and it takes 3.
  - **Phase 2: feather barrage.** It perches on the castle and rains feather spikes in lanes. Four pads ring the arena. Slam them in clockwise order to fire the pad bells, which stun Tempest. Then Slam its head for the hit.
  - **Phase 3: the dive.** Tempest dives at the hero (2 s telegraph shadow). Bait it into a cracked pad, which falls and leaves it stunned. Then do the final Slam (slow-mo) and ring the Tide Bell.
  - After the boss, an endless mode unlocks: a seeded tower for leaderboard height.
**Stars:** clear / all colour orbs (12–30 per level, many at chain-height peaks) / time: L1 70 s, L2 95 s, L3 130 s, L4 170 s, L5 240 s. No-hit bonus: a **Perfect Chain** badge for never letting the chain reset below x2 after the first checkpoint.
**Secrets:**
- One **sky shard** per level on a pad that only a x4 chain reaches (an invisible ceiling until you are fast enough).
- L3 hides a sticker behind Vexa's chimney.
- L4 has Riko's cracked wall shortcut.
**Juice moments:**
- Each chain level adds pitch to the pad "boing" (a major-scale step).
- At x4 the camera pulls back and the hero gets a blue comet trail.
- Every Slam gives a hit-stop of 60 ms and a camera kick.
- Checkpoint beacons send a ring of light outward.
- Missing the chain gives a soft "pfft" and the trail fades.
**Multiplayer (1-4):**
- **Co-op:** Nami can be "bounce-boosted": a friend who Slams a shared pad while another hero is on it gives that hero +3 m. Co-op routes have twin pads that must be Slammed within 0.5 s of each other to open a high door.
- **Versus race:** race to 100 m on mirrored towers side by side.
- Camera: shared, fitted vertically to every hero. In versus the screen splits left and right, with one tower each.
**Assets:**
- Reuse from `sky-tower-jump`: `m2SkyPlatform`, `m2SkyPlatformSmall`, `m2SkyIslandSpire`/`R`, `skySpireI`, `m2SkyIslandWaterfall`, `m2SkyIslandCastle`, `m2CrumblePlatform` (cracked pads), `m2StoneBlockPlatform`/`R`, `stoneBlockPlatformI`, `m2FloatingRocks`, `m2CloudBank`, `m2SkyBanner`, `m2FortressStairs`/`R`, `m2WindFanTower` (gust source in phase 1), `m2CherryTree`.
- Reuse from the root: `bouncePad`, `movingBlock`, `checkpointBeacon`, `islandA/AV2/B/BV2/C/D`, `skyFortressGate`.
- Reuse from `shared`: `m2StormHawkBoss`, the five heroes, and `m2AquaOrb` (from plate-surf) as the colour orb.
- New: none.
**Risks:**
- Holding the chain could feel like a twitch test. Fix: a 2.5 s window, a landing-point ghost and generous pad radius (1.6 m).
- Players could ignore the chain and walk-hop. Fix: the main route needs x3 gaps by L2. Safe side ledges exist only in L1.

---

### 3 Flooded Ruins Escape  (World 2, blue)
**One-line hook:** Escape a drowned temple by deciding where the water goes. Lower it to open the way down, raise it to float up to ledges you can't reach.
**Signature mechanic:** **Flood control.**
- Stone levers set the water level of the zone they are in. A lever has 2 or 3 positions (low, mid, high), and the level moves at 0.8 m/s toward the target.
- The water is both the lift and the threat:
  - In water the hero **swims** and floats up at 1.2 m/s.
  - Floating crates (`m2FlyingCrate`, made buoyant here) rise with the surface.
  - Under water, an air meter of 6 s empties. Air bubbles from `m2RuinWaterSpout` refill it.
- Separately, the **storm tide** rises steadily from below (0.25–0.6 m/s by level) and is the escape clock. Levers can't lower it; they only set the inner chambers.
- Kept from the prototype: switchback ramps, the spiral around the flooded central shaft, and levers that lower water.
**Why it's different from:**
- **Crystal Cave Switch (W5):** that is light and mirror switches with no physics. Here the water level moves bodies and is also the clock.
- **Sky Tower Jump:** Sky Tower gains height by bouncing. Here you gain it by **flooding** and floating, and your thinking is "which lever first".
**Hero roles:**
- **Riko:** dashes through cracked brick ledges (`m2RuinBrickLedge`) into side cisterns that let the water drain early, a shortcut of about 20 s.
- **Nami:** her double jump from the swim state is a **breach jump**: a 4 m leap out of water onto high ledges with orb nests.
- **Kiro:** his shield blocks the steam jets and whirlpool pull in the flooded rooms, so he can cross them without draining the room.
- **Zuno:** his magnet pulls coin trails up out of the shaft floor when the water is low.
- **Vexa:** phases through sunken ghost doors in the shaft wall, a hidden spiral that bypasses one lever puzzle.
**Levels:**
- **L1 Drain Entry:**
  - Beat 1: a high ledge and a lever. Pull it, the room floods and you float up.
  - Beat 2: the reverse. A low door under water, so pull the lever to drain the room and walk through.
  - Beat 3: the storm tide starts slowly (0.25 m/s) behind you up a 3-switchback climb to the exit gate (`m2RuinFloodGate`).
- **L2 Pipe Maze:** twist: **linked chambers**. Lowering one channel (`m2RuinChannel`) raises the one next to it, so you have to pick an order. A wrong order is recoverable, never a soft-lock: every lever can be pulled back.
- **L3 Valve Shaft:** twist: the **spiral shaft**. The central shaft has 3 rings of levers and the water level decides which spiral ledges are dry. Cave bats roost in dry niches and swoop when the water is low.
- **L4 Flood Rise:** twist: the **fast tide** (0.6 m/s) plus **air pockets**. A long underwater swim is chained between waterspout bubbles. The swim is the shortcut, and the long dry route is safe.
- **L5 Final Escape, boss "Umbra Roller" (a Shadow Plates lieutenant):**
  - **Phase 1: the chase.** Umbra Roller (`m2ShadowArmadillo`) rolls down the spiral shaft like a boulder, once every 8 s. Flood the ring below it so it floats and loses grip, and it gets stuck at a ring gate. Ground-pound its back: 1 hit.
  - **Phase 2: plugging the drains.** It curls up in the drain at the bottom and tries to pin the water at "high". Pull the 3 pressure levers in a row (each on a timer) to suck it out through a waterspout geyser. Hit it while it spins in the air.
  - **Phase 3: storm tide.** The tide rises at 0.8 m/s while it chases you up the switchbacks. Lure it onto a floodgate, then drop the gate. Ring the Tide Bell at the top.
**Stars:** clear / all orbs (15–28) / time: L1 80 s, L2 120 s, L3 150 s, L4 165 s, L5 210 s. No-hit bonus: never touch the storm tide.
**Secrets:**
- A **sunken shard** that can only be reached when one specific room is fully flooded *and* drained in the same run: something appears on the floor after the drain.
- A sticker behind Vexa's ghost door.
- The L4 swim route hides an extra air bubble that leads to a hidden chamber.
**Juice moments:**
- Lever pulls rumble, and the water surface ripples outward when the level changes.
- A breach jump makes a big splash crown and freezes for 1 frame.
- The tide creeps up with a violet foam edge and a heartbeat in the music.
- The underwater camera muffles the low-pass filter on the music.
**Multiplayer (1-4):**
- **Co-op:** the main mode. Two players hold two levers at once (L2 dual-lock doors). One hero holds the water high while another swims through. Kiro shields the group from whirlpools. Some co-op chambers need a double-jump breach (Nami) plus a dash wall break (Riko).
- **Versus:** a race up a mirrored shaft, where your levers flood your rival's side.
- Camera: shared and fitted to all heroes, with a vertical framing bias toward the tide.
**Assets:**
- Reuse from `flooded-ruins-escape`: `m2RuinBrickLedge`, `m2RuinChannel`/`R`, `ruinChannelI`, `m2RuinFloodGate`, `m2RuinPlatform`/`R`, `m2RuinWaterSpout`, `m2StoneLever`/`R`, `stoneLeverI`, `m2SunkenTempleBg`.
- Reuse from other folders: `m2FlyingCrate` (wind-tunnel-escape, as a floating crate), `woodenLadder`, `plankBridge`, `stoneTower`, `checkpointBeacon`.
- Reuse from `shared`: `m2ShadowArmadillo`/`R` (boss), `m2CaveBat`, heroes, and `m2AquaOrb` as the colour orb.
- New: NICE `m2SunkenDrainGrate` (phase 2 arena floor).
**Risks:**
- A puzzle could stall the escape. Fix: the tide pauses while a lever puzzle room is "active" in L1–L2, and lever states always show their target level as a glowing line on the wall.
- Swimming feels floaty. Fix: swim speed 4 m/s, a quick surface pop, and the air meter shown as a ring around the hero, not as UI text.

---

### 5 Cloud Hopper  (World 2, blue)
**One-line hook:** Cross a drifting cloud sea before sunset. Every cloud sinks under you, and feathers buy you glide time.
**Signature mechanic:** **Sink and glide.**
- **Sinking clouds.** Clouds sink as soon as you land, at 0.6 m/s, and burst into vapour after 3 s, so you have to keep moving.
- **Feathers.** Each feather (`m2Feather`) adds 1.5 s to a glide meter (max 4.5 s). Hold Jump in the air to glide: forward speed 7 m/s, falling 1.2 m/s.
- **Wind.** Wind bands push gliders sideways, shown as streaks.
- **Landing streak.** Landing on a cloud's bright centre (radius 0.8 m) gives a streak point and a little rebound puff.
- **Sun clock.** The level is a horizontal run of 250–600 m, and the sun sinks with the time limit.
- Kept from the prototype: cloud platforms, feather power-ups, stars (now the colour orbs, `m2SkyStar`), wind rings (now glide boost gates: flying through one refills 1 s of glide) and the rainbow bridge finish.
**Why it's different from:**
- **Sky Tower Jump:** Sky Tower is vertical and you hit down to go up. Cloud Hopper is horizontal and you hold to *stay* up. The resource is glide time, not chain height.
- **Wind Tunnel Escape:** there you change the wind and ride it with no meter. Here the wind is weather you read and fight, and your own glide is the engine.
**Hero roles:**
- **Riko:** an air dash (one per glide) that spends 1 s of glide for a 6 m burst. It crashes through storm-cloud walls into hidden cloud shelves.
- **Nami:** her double jump refreshes once per glide. Hopping out of a glide re-launches it, which reaches the high "sun shelves" with orb rows.
- **Kiro:** his shield lets him glide straight through thunderheads (`m2StormCloud`) that would drop the others.
- **Zuno:** his magnet pulls feathers in from 6 m, and draws orb trails out of the rain columns.
- **Vexa:** phases through ghost-cloud walls into a mirrored "night cloud" path.
**Levels:**
- **L1 Soft Clouds (250 m):**
  - Beat 1: big clouds 2 m apart. Feel them sink.
  - Beat 2: a 10 m gap with a feather in front of it. Hold to glide.
  - Beat 3: a wind ring in mid-air that only a glide reaches, refilling glide on the way to the rainbow bridge.
- **L2 Moving Clouds:** twist: clouds **drift** on lanes at 1–2 m/s, so you plan landings ahead.
- **L3 Wind Zone:** twist: **crosswind bands**. Gliding into the wind halves speed, gliding with it doubles. Some orbs need a downwind sprint.
- **L4 Fading Clouds:** twist: **pulse clouds** that solidify on the music beat (every 0.75 s), plus thunderheads that zap the ones near them.
- **L5 Sky Sprint, boss "Gloom Nimbus" (a storm-cloud creature under Tempest):**
  - **Phase 1: the chase.** The boss chases from behind and swallows clouds. Outrun it by chaining streaks. Each centre landing pushes it back 2 m. Reach 3 "lightning rods" and glide through them to shock it: 3 hits.
  - **Phase 2: rising up.** It rises up in front and rains hail lanes, telegraphed by shadows. Glide through its 3 open "eyes" (glowing rings) as they open.
  - **Phase 3: the burst.** It sinks the last clouds. Glide the final 40 m on feathers it drops. Ring the Tide Bell on the rainbow bridge.
**Stars:** clear / all orbs / beat the sunset: L1 60 s, L2 80 s, L3 95 s, L4 110 s, L5 150 s. No-hit bonus: a 20-landing **centre streak**.
**Secrets:**
- A **dawn shard** in a hidden cloud below the main route, which a deep, slow glide reaches.
- Vexa's night cloud path holds a sticker.
- L3 has a secret wind ring that throws you to a shortcut ahead of the sun.
**Juice moments:**
- Clouds squash and spring on landing.
- The glide leaves a feather trail.
- A centre landing gives a soft chime that climbs the scale with the streak.
- Thunderheads crackle before they strike.
- The sunset tints the sky warmer as time runs out.
**Multiplayer (1-4):**
- **Co-op:** heroes can land on each other's back mid-glide (a "piggyback") to refresh glide once. Co-op orb clouds need two heroes at once so they don't sink.
- **Versus race:** the same course at the same time. Landing on a cloud sinks it faster for the next player, which is a mind game.
- Camera: shared, a side-on 3/4 view following the group. It zooms out to a 30 m span and teleports a straggler to the leader with a 1 s penalty.
**Assets:**
- Reuse from `cloud-hopper`: `m2CloudPlatform`, `m2CloudPlatformV2`, `m2Feather`, `m2SkyStar`, `m2WindRing`, `m2StormCloud`, `m2RainbowBridge`, `m2CloudCastleBg`.
- Reuse from other folders: `m2CloudBank` (sky-tower-jump), `checkpointBeacon`.
- Reuse from `shared`: heroes. The boss can be a 6x-scaled `m2StormCloud` with emissive eyes until the NICE model exists.
- New: NICE `m2GloomNimbusBoss`.
**Risks:**
- Sinking clouds could be stressful for new players. Fix: L1 clouds sink at 0.3 m/s and have 5 s before they burst, and every 60 m there is a solid cloud anchor (checkpoint).
- Gliding could skip the hop rhythm. Fix: the glide meter caps at 4.5 s, so you must land to keep going.

---

### 27 Ring Jump Challenge  (World 2, blue)
**One-line hook:** Leap from a stone pillar and steer a long free-fall through rings down into a sea canyon, threading each ring to keep your speed.
**Genre change:** from "forward ring-run" to **skydive ring course**. The title stays, because every run still starts with a jump off a column. Diving gives W2 the downward verb that sets it apart from Sky Tower and Cloud Hopper.
**Signature mechanic:** **Dive and thread.**
- After the jump-off, the hero falls through a 300–800 m vertical canyon of stone rings (`m2StoneRingBg`).
- Controls:
  - The stick steers on the horizontal plane at 9 m/s.
  - Hold **Dive** (down or Jump): tuck into a ball and fall at 40 m/s.
  - Release to **spread**: fall at 18 m/s with better steering.
- **Ring rules:**
  - Each threaded ring (`m2NeutralRing`) gives a combo point and +2 m/s of speed.
  - A **centre thread** (inner 30%) doubles the points.
  - Missing a ring does nothing, but your combo cools.
  - Updraft geysers slow you down so you can reach far rings.
- **The finish:** at the bottom you must land on a column target pad (`m2ColumnPlatform`) or splash into a marked pool. Landing on the centre ring of the pad gives a bonus.
- Rings are **not** colour-matched (colour switching belongs to W6). They are speed, combo and route choice.
**Why it's different from:**
- **Sky Tower Jump / Cloud Hopper:** both are about getting up or across. This is about going down, with constant speed management and no landings until the end.
- **Space Pod Jump (W5):** that is low-gravity hopping between pods. This is pure free-fall steering through a dense 3D ring field.
**Hero roles:**
- **Riko:** an air dash (cooldown 3 s) that crosses 8 m sideways to reach far rings. It breaks the cracked ring seals that hide side shafts.
- **Nami:** her double jump becomes an **air-brake flip**. It cancels the fall for 0.6 s and hops her back up 3 m, so she can thread a ring she just passed or reach the high ledge nooks on the canyon wall.
- **Kiro:** his shield lets him fall through wind-shear (storm) zones and break through mist rings that slow other heroes.
- **Zuno:** his magnet bends nearby orb trails toward the fall line.
- **Vexa:** phases through the canyon wall's ghost panels into a hidden inner shaft lined with gold rings.
**Levels:**
- **L1 Wide Rings (300 m):**
  - Beat 1: a column of big rings straight below. Just fall through them.
  - Beat 2: rings offset sideways. Steer.
  - Beat 3: a gap where you must hold Dive to keep pace before a big ring trio, then land on a wide pad.
- **L2 Moving Rings:** twist: rings **orbit and slide** at 2–4 m/s, so you aim ahead.
- **L3 Color Rings, renamed "Updraft Rings":** twist: **updrafts and speed rings** (`m2SpeedBoost`, `m2SpringPad` geysers). You choose between a fast vertical line and a slow wide line with more rings. (The old "colour rings" idea moves to W6.)
- **L4 Fast Route:** twist: **narrow walls**. The canyon pinches into tight slot sections with spinning blade gates (`spikedBall` on arms). Diving is risky but fast.
- **L5 Perfect Streak, boss "Cyclone Ray" (a storm manta under Tempest):**
  - **Phase 1: the spiral.** The Ray spirals down alongside you and leaves rings of wind behind it. Thread 5 of its wake rings in a row to charge a dive strike. Then dive into its glowing back fin: 1 hit, and it takes 3.
  - **Phase 2: the storm wall.** It circles and spits lightning lanes, telegraphed for 1 s. Air-brake to dodge, and hit it when it banks wide open.
  - **Phase 3: the final drop.** A last 200 m fall. Land on its tail pad as it surfaces from the sea, in slow-mo, then ring the Tide Bell on the column.
**Stars:** clear / all orbs (rings count as orbs where marked) / time: L1 35 s, L2 45 s, L3 55 s, L4 60 s, L5 110 s. No-hit bonus: **Perfect Streak**, no missed ring for the whole level.
**Secrets:**
- One **gold ring** per level hidden off the main line. It is visible only through a gap in the wall.
- Vexa's inner shaft.
- A landing sticker for a centre-ring landing on the target pad.
**Juice moments:**
- Air rushes in stereo.
- Each ring threaded gives a whoosh and rising pitch.
- The camera FOV opens with speed (from 60° up to 80°).
- Centre threads freeze for 1 frame with a burst ring.
- The landing gives a big splash and camera kick.
**Multiplayer (1-4):**
- **Versus:** the best mode. Simultaneous dives where whoever threads a ring first takes the points, so lines cross and you jostle.
- **Co-op:** "formation" rings that need 2 heroes inside them at once, for big bonus orbs.
- Camera: shared, top-down-ish and looking down the shaft, fitted to all heroes. Split 2-way on tablet for 3–4 players if the spread exceeds 25 m.
**Assets:**
- Reuse from `ring-jump-challenge`: `m2ColumnPlatform`, `m2NeutralRing`, `m2NeutralRingV2`, `m2NeutralStar` (orb), `m2SpeedBoost`, `m2SpringPad` (updraft geyser base), `m2StoneRingBg`.
- Reuse from other folders: `m2SeaRock` (plate-surf) for the canyon floor, `spikedBall` and `m2WindRing` (cloud-hopper) for the boss wake rings.
- Reuse from `shared`: heroes.
- New: MUST L2–5 `m2CycloneRayBoss`.
**Risks:**
- Depth reading in free-fall is hard. Fix: every ring casts a soft shadow ring onto a guide plane below, the next ring gets an outline, and a drop-line from the hero shows where you will pass.
- Runs could be too short. Fix: 35–110 s levels with many branches, a ghost replay and a daily seed for an endless shaft.

---

### 37 Plate Surf  (World 2, blue)
**One-line hook:** Ride a giant rolling wave on a hero plate. Carve up and down its face to pump for speed, and launch off the lip for tricks before the curl swallows you.
**Genre change:** from "downhill board surf" to **ocean wave surf**. That moves it away from W4's Snow Slide Dash. The title stays.
**Signature mechanic:** **Carve and pump.**
- The wave is a moving set-piece: a curling wall about 8 m high travelling along a bay at 12 m/s.
- The surfer's speed depends on **pumping**: steer up the face, then down it, in rhythm. Each well-timed down-carve (in the 0.4 s window where the wave is steepest) adds +1.5 m/s, up to 24 m/s.
- If you stop pumping you slow down and the **curl** behind you catches up. Being swallowed costs 1 heart and a respawn.
- At the lip, press Jump to air and hold a direction for a trick. That earns combo, and each trick gives +1 s of curl buffer.
- Hazards: rocks, buoys and jellies. Orbs (`m2AquaOrb`) sit high on the lip and low in the trough.
**Why it's different from:**
- **Snow Slide Dash (W4):** that is a static downhill slope driven by gravity. Here the wave moves, and you make your own speed with pump rhythm while being chased.
- **Zipline Rush:** that is a fixed line where you only control speed. Here the 2D surface of the wave face is free.
**Hero roles:**
- **Riko:** a dash carve, a burst that cuts through cracked reef walls into hidden lagoon sections.
- **Nami:** a double air off the lip reaches the high "spray ledges": cliff arches with orb rows.
- **Kiro:** his shield lets him ride straight through the barrel's violet storm spray and through jelly packs.
- **Zuno:** his magnet pulls orb trails out of the foam behind the wave.
- **Vexa:** phases through ghost rock arches to a calm inner lane.
**Levels:**
- **L1 Training Slope, renamed "Training Swell":**
  - Beat 1: a small wave. Ride straight, then up and down, and see the speed meter fill.
  - Beat 2: a buoy line to carve between.
  - Beat 3: the lip opens. Air for the first trick, then land in the lagoon.
  - The curl is slow (11 m/s) and slower than your top speed.
- **L2 Rocky Path:** twist: **sea rocks** (`m2SeaRock`) and buoys (`m2MarkerBuoy`) placed in lanes, so you have to pick the high or low line.
- **L3 Jump Gates:** twist: **lip gates**. Floating rings above the lip that you reach only with airs, plus jellies (`m2SlimeBlob` recoloured translucent blue) bobbing in the trough.
- **L4 Speed Canyon:** twist: the wave runs into a **sea-cliff canyon** (`m2SeaCliffBg`). It narrows and the curl speeds up to 15 m/s.
- **L5 Plate Surf Master, boss "King Breaker" (`m2GiantCrabBoss`):**
  - **Phase 1: the claw.** The crab rides the wave ahead of you and slams its claw down in a lane (telegraphed by a 1.2 s shadow). Air off the lip onto its carapace: 1 hit.
  - **Phase 2: the bubbles.** It burrows into the face and blows bubble mines. Pump past them to build top speed, then trick into its eye stalks as it surfaces.
  - **Phase 3: the barrel.** The wave barrels. Ride inside the tube and pump through as the crab tries to block the exit. Carve-dash into it (slow-mo) and ring the Tide Bell on the beach.
**Stars:** clear / all orbs / time: L1 50 s, L2 65 s, L3 75 s, L4 85 s, L5 120 s. No-hit bonus: never swallowed by the curl.
**Secrets:**
- A **pearl shard** in a hidden tube section that you enter only with top speed.
- A sticker in Vexa's inner lane.
- L4 hides a cliff cave that only Nami's double air reaches.
**Juice moments:**
- Spray fans off every carve.
- Pump timing gets a "thrum" bass note and the board glows.
- Tricks get named pop text, but only with icons: spin, flip, grab.
- The curl roars louder as it closes.
- The barrel ride turns the light teal.
**Multiplayer (1-4):**
- **Versus:** the same wave, where the leader gets slowed by riding in front (no draft). Most orbs plus distance wins.
- **Co-op:** "tandem pump", where riding side by side gives both +10% speed. A co-op wave holds lip gates that need two riders airing at once.
- Camera: shared, behind and above the pack. The wave keeps everyone close, and stragglers are pulled by the curl.
**Assets:**
- Reuse from `plate-surf`: `m2AquaOrb`, `m2MarkerBuoy`, `m2SeaCliffBg`, `m2SeaRock`.
- Reuse from `shared`: `m2GiantCrabBoss`, `m2SlimeBlob` (jelly tint), heroes.
- Reuse from other folders: `m2NeutralRing` (lip gates, from ring-jump-challenge), `checkpointBeacon`.
- New: MUST L1 `m2SurfPlate`. NICE `m2SeaGullDiver` (L4 hazard).
- The wave itself is a procedural mesh and shader.
**Risks:**
- Pump timing could be unclear. Fix: a glowing "sweet band" on the wave face and a vibration on mobile.
- The procedural wave could be heavy. Fix: one deformed plane of about 20k triangles, foam done in the shader, no transparent overdraw except the spray particles.

---

### 41 Wind Tunnel Escape  (World 2, blue)
**One-line hook:** Turn the fans of a storm tunnel to send the wind where you need it, then ride your own currents out before the storm front catches up.
**Signature mechanic:** **Redirect the wind.**
- The tunnel is built of rooms. Each room has 2–5 **fans** (`m2WindFan`, `m2AirVent`).
- Tap Action next to a fan to rotate it 90° (it has 4 directions) or switch it on or off.
- Each active fan makes a current 8–14 m long, which carries the hero at 7 m/s with no jumping needed, plus flying crates (`m2FlyingCrate`) that you ride or that block a current.
- The puzzle is setting the fans so that the currents chain: across, up and through the exit.
- Pressure: a **storm front** of violet fog fills rooms from behind. It starts 30 s behind and drains 1 heart a second inside it.
**Why it's different from:**
- **Cloud Hopper:** there the wind is weather you resist with your own glide. Here you build the wind yourself, with no glide meter: it is a routing puzzle in motion.
- **Crystal Cave Switch (W5):** that is static light routing. Here your own body travels the route, and moving crates and drones push back.
**Hero roles:**
- **Riko:** a dash breaks cracked vent covers, opening a fan that skips a room.
- **Nami:** her double jump can hop *out* of a current mid-ride to a high ledge, where the hidden fan switches and the orb shelves are.
- **Kiro:** his shield lets him ride straight through the static-shock vents that zap the others.
- **Zuno:** his magnet pulls orbs from currents you didn't ride, so a fan setup doesn't have to choose between route and orbs.
- **Vexa:** phases through ghost fan housings into maintenance ducts, a quiet shortcut.
**Levels:**
- **L1 Gentle Wind:**
  - Beat 1: one fan pointing up. Ride it to a ledge.
  - Beat 2: rotate one fan so it points across a gap.
  - Beat 3: two fans that must chain, up then across, to the exit. The storm front appears only at the end, as a slow chase.
- **L2 Cross Wind:** twist: **crosswinds**. Two currents meet and add together as vectors, so the angle you reach depends on both.
- **L3 Vertical Lift:** twist: a **tall shaft** with lift platforms (`m2FanLiftPlatform`). Setting fans moves platforms as well as the hero.
- **L4 Moving Fans:** twist: fans on **rails** and fans that auto-rotate on a 3 s cycle. Patrol drones (`m2FactoryDrone`) drift in the currents and act as shield-bumpers.
- **L5 Storm Tunnel, boss "Gale Engine" (a turbine monster Tempest built):**
  - **Phase 1: blowing back.** The engine blows a huge blast at you. Turn the 3 side fans to push its own blast back into its intake: 1 hit each time, and it takes 3.
  - **Phase 2: the core.** It opens its core and pulls everything in. Set the fans so that flying crates are carried into the intake, jamming it.
  - **Phase 3: the escape.** The engine collapses and the storm front surges. Chain 4 fan rooms in 25 s, then ring the Tide Bell in the open sky beyond.
**Stars:** clear / all orbs / time: L1 60 s, L2 90 s, L3 110 s, L4 130 s, L5 180 s. No-hit bonus: never touch the storm front.
**Secrets:**
- A **gust shard** reachable only with a fan setup that is never needed for the exit, a deliberate "creative setup" reward.
- A sticker behind Vexa's duct.
- An anemometer post (`m2AnemometerPost`) that spins faster at the right setup and opens a hidden vent.
**Juice moments:**
- Fan rotation goes clack-clack-whirr.
- Currents are visible streaks that change colour by strength.
- Riding gives a cloth-flap sound and the camera tilts with the current.
- The storm front's lightning flashes the tunnel walls.
**Multiplayer (1-4):**
- **Co-op:** the best fit. One player turns fans while another rides, and co-op rooms have fans that two heroes must hold at once.
- **Versus:** mirrored tunnels where each player's fans can blow into the rival's lane.
- Camera: shared, an isometric room view. A room fits everyone, and the camera moves on when the last hero enters the next room.
**Assets:**
- Reuse from `wind-tunnel-escape`: `m2AirVent`, `m2AnemometerPost`, `m2FanLiftPlatform`, `m2FlyingCrate`, `m2WindFan`, `m2WindTubeBg`.
- Reuse from other folders: `m2WindFanTower` (sky-tower-jump), `movingBlock` (fan rails), `checkpointBeacon`.
- Reuse from `shared`: `m2FactoryDrone` (recoloured storm-violet as a wind drone), heroes.
- New: MUST L2–5 `m2GaleEngineBoss`.
**Risks:**
- Players could get stuck on a fan puzzle with the storm behind them. Fix: the storm pauses while a "fan setup" room is in its first visit, and a hint shows a faint ghost current of the right setup after 20 s.
- Riding currents is passive. Fix: you steer ±2 m within the current and dodge crates, so it is active riding.

---

### 45 Sky Hook Swing  (World 2, blue)
**One-line hook:** Throw a hook to any ring in range across the airship docks, reel the rope to change your swing, and release at the peak to fly to the next one.
**Signature mechanic:** **Aim, reel, release.**
- Press Action to fire a hook at the nearest grapple ring (`m2GrappleRingPost`, `m2SwingAnchor`) within 14 m in the stick's direction. The aim cone is 35°.
- Once hooked, the rope is a pendulum:
  - Up on the stick **reels in**, to as short as 3 m, which raises swing speed.
  - Down **reels out**, to as long as 12 m, which dips the hero lower.
- Release (Action) flings the hero in the tangent direction. Releasing at the peak (green flash) gives +25% speed.
- Chaining 4 releases into hooks without touching ground fills the combo.
**Why it's different from:**
- **Jungle Vine Jump (W3):** vines are fixed ropes you grab and let go of. Sky Hook has an aimed throw to any ring, rope length control and pendulum physics.
- **Zipline Rush:** that follows a fixed cable with speed control. Here every swing is a free choice of anchor, angle and length.
**Hero roles:**
- **Riko:** a dash out of a release gives a straight 6 m horizontal boost. It smashes cracked crate stacks on the docks into side routes.
- **Nami:** a double jump after release adds height, reaching high anchor ledges that hold orb loops.
- **Kiro:** his shield lets him swing through cannon smoke and spark lines from the airship cables.
- **Zuno:** his magnet pulls orb strings from the clouds below the swing arc.
- **Vexa:** phases through ghost hull panels of the airships, onto the hidden inner deck.
**Levels:**
- **L1 Single Swing:**
  - Beat 1: one anchor over a short gap. Hook, swing, release.
  - Beat 2: reel in to clear a taller wall.
  - Beat 3: three anchors in a row to the landing pad (`m2LandingTargetPad`), with a safety net under the first one.
- **L2 Double Swing:** twist: **chaining**. Anchors are set apart so that only peak releases connect. You also meet **swing islands** (`m2SwingIsland`) as rest stops.
- **L3 Moving Anchors:** twist: anchors on **airships** (`m2AirshipBg` in motion) and on spinning windmill blades (`m2WindmillIsland`).
- **L4 Long Gaps:** twist: **wind and length**. Gusts push the swing, so you reel long for big arcs, and anchors break after 3 s (cracked rings).
- **L5 Sky Swing Master, boss "The Gust Galleon" (an airship set-piece of Tempest's fleet):**
  - **Phase 1: the cannons.** The galleon's 3 cannon turrets fire telegraphed shots. Swing around its hull rings and release into a turret to knock it off: 3 turrets.
  - **Phase 2: the drones.** Patrol drones cut the hull rings. Hook a drone itself (it is a moving anchor), swing it into the mast and break the sail.
  - **Phase 3: the escape.** The galleon breaks apart and falls. Swing up the falling rings to the bridge (slow-mo) and ring the Tide Bell on the crow's nest.
**Stars:** clear / all orbs / time: L1 45 s, L2 70 s, L3 90 s, L4 100 s, L5 150 s. No-hit bonus: **sky chain**, never touch ground between checkpoints.
**Secrets:**
- A **compass shard** on an anchor beyond the normal hook range. It is reachable only with a perfect peak release plus a reel-in.
- A sticker on Vexa's inner deck.
- An L3 airship that loops back past a hidden ring.
**Juice moments:**
- The hook "thunk" and a rope snap tight.
- A whoosh at the bottom of the arc.
- The peak release gets a green flash, a hit-stop of 50 ms and a FOV kick.
- Turret hits explode into confetti-blue.
- The camera pulls far back for big arcs.
**Multiplayer (1-4):**
- **Co-op:** heroes can hook each other as an anchor (a mid-air "handoff"). Co-op anchors are heavy rings that need two ropes to swing.
- **Versus:** race across the docks, where taking an anchor first locks it for 1 s.
- Camera: shared, a side view with depth. It fits all heroes and leads in the direction of travel.
**Assets:**
- Reuse from `sky-hook-swing`: `m2AirshipBg`, `m2GrappleRingPost`, `m2LandingTargetPad`, `m2SwingAnchor`, `m2SwingAnchorV2`, `m2SwingIsland`, `m2WindmillIsland`.
- Reuse from other folders: `m2CloudBank` (sky-tower-jump), `m2FlyingCrate`, `checkpointBeacon`.
- Reuse from `shared`: `m2FactoryDrone` (phase 2 drones), heroes.
- New: MUST L2–5 `m2SkyCannonTurret` (boss weak point, used 3 times). NICE `m2GrappleHook` (the hook is a simple procedural claw until then).
**Risks:**
- Aiming on mobile is hard. Fix: an auto-target ring highlight in the cone, and a "hook" button that always takes the highlighted one.
- Rope physics could glitch. Fix: an analytic pendulum, not a physics engine, with fixed timesteps and a speed cap.

---

### 49 Zipline Rush  (World 2, blue)
**One-line hook:** Race down sagging cables between sea-stack lighthouses, braking and tucking to hit the landing marks and hopping from line to line in mid-ride.
**Signature mechanic:** **Ride the line.**
- The hero hangs from a trolley on a spline cable. Gravity sets the speed along the line's sag.
- **Tuck** (hold down) speeds you up by +40%. **Brake** (hold up) slows you down by -60% and sparks.
- Jump releases you. While riding beside a parallel or crossing cable (within 3 m), you can **switch lines** with a sideways hop.
- Each cable ends at a landing mat (`m2LandingMat`) with 3 zones. Arriving too fast overshoots into the sea, and too slow stops you short on the sag.
- A transfer is a release at the end of one line onto the next tower deck. Timing gives a combo.
**Why it's different from:**
- **Color Rail Grind (W4):** there you balance on top of a rail with left and right lean. Here you hang below, gravity drives you, and the skill is speed control plus switching lines.
- **Sky Hook Swing:** that is free aiming between anchors. This is reading fixed lines, sag and speed.
**Theme note:** to keep away from W3's jungle, the setting moves from forest rooftops to **coastal pines and sea-stack lighthouses**. L1–L2 reuse `m2ForestCanopyBg` as coastal pine cliffs. From L3 on, the lines hang over open sea between rock stacks.
**Hero roles:**
- **Riko:** a dash in mid-air between lines reaches a cable that is otherwise too far away. It breaks cracked tower walls into an inner stair shortcut.
- **Nami:** a double jump off a line reaches a higher cable, the express line with orb strings.
- **Kiro:** his shield lets him ride through spark storms where lightning hits the cables.
- **Zuno:** his magnet pulls orbs off a parallel cable you are not riding.
- **Vexa:** phases through ghost signal flags and gates on the cable into a secret short line.
**Levels:**
- **L1 Training Line:**
  - Beat 1: one gentle cable. Feel the speed build, then brake into the green zone.
  - Beat 2: tuck to clear a dip without stopping.
  - Beat 3: two parallel lines with orbs on one. Hop across, then land.
- **L2 Twin Lines:** twist: **crossing cables**. Switch at the crossing points, with branches that lead to different towers.
- **L3 Moving Landing:** twist: **moving landing decks** on bobbing buoy rafts (`m2TreetopDeck` reskinned as a raft) and swinging gull flocks to duck under.
- **L4 Night Skyline, renamed "Lighthouse Night":** twist: **darkness**. Only the lighthouse beam sweep shows the cables, so you memorise the line. Spark storms hit the cables.
- **L5 Zipline Master, boss "Volt Eel" (a storm creature living in the cables):**
  - **Phase 1: the cables.** The eel swims along the cables and electrifies one at a time, telegraphed by a glow for 1.5 s. Switch away, then hop onto its head as it crosses your line: 1 hit, and it takes 3.
  - **Phase 2: coiled.** It coils around the main lighthouse. Ride the spiral line around the tower, tuck for top speed and release into its gill at the top.
  - **Phase 3: the plunge.** The eel snaps the cables and they sag fast. Brake and tuck to land on the last deck (slow-mo), then ring the Tide Bell in the lighthouse lantern.
**Stars:** clear / all orbs / time: L1 50 s, L2 65 s, L3 80 s, L4 90 s, L5 130 s. No-hit bonus: **bullseye**, every landing in the centre zone.
**Secrets:**
- A **lantern shard** on a cable reachable only by a line switch at full tuck speed.
- A sticker on Vexa's short line.
- An L4 hidden cable that only lights when the beam passes at the right moment.
**Juice moments:**
- The trolley hums, and its pitch rises with speed.
- Braking throws sparks.
- Line switches give a whip-sound and the cable wobbles.
- Landings slide and kick up dust on the mat.
- At top speed the edge of the view blurs.
**Multiplayer (1-4):**
- **Versus:** racing on parallel lines, where hopping onto a rival's line bumps them (both lose 20% speed).
- **Co-op:** "relay", where one hero holds a switch to open a gate on another's line. A shared cable carries 2 trolleys for a tandem tuck bonus.
- Camera: shared, behind and above, looking down the line. Split 2-way only in 4-player versus on desktop.
**Assets:**
- Reuse from `zipline-rush`: `m2ForestCanopyBg` (L1–2 coastal pines), `m2LandingMat`, `m2TreetopDeck` (deck and raft), `m2ZiplineTower`.
- Reuse from `plate-surf`: `m2SeaRock`, `m2SeaCliffBg`, `m2MarkerBuoy`.
- Reuse from other folders: `stoneTower` (lighthouse base), `checkpointBeacon`.
- Reuse from `shared`: heroes.
- New: MUST L1 `m2ZiplineTrolley`. MUST L2–5 `m2VoltEelBoss`. NICE `m2SeaStackLighthouse`.
- The cables are procedural tubes.
**Risks:**
- Riding could feel passive. Fix: every line has a choice (switch, tuck or brake) about every 3 s, plus orbs and landings that reward speed control.
- Landing zones could be unreadable at speed. Fix: a coloured target projection that grows as you near the end, and the HUD speed needle turns green inside the right band.

---

## Hyper3D models needed

Ready models already cover almost every set, prop and enemy. New requests are only the two ride objects that no ready model provides (surf plate, zipline trolley), three bosses and one boss weak-point prop. Shared helpers (cracked wall, ghost wall, high ledge) are assumed to be built procedurally by the `powers` system; one NICE W2 skin is listed.

### 1 Sky Tower Jump
Ready models used:
- `sky-tower-jump/*` (all 18)
- root: `bouncePad`, `movingBlock`, `checkpointBeacon`, `islandA`, `islandAV2`, `islandB`, `islandBV2`, `islandC`, `islandD`, `skyFortressGate`
- `shared`: `m2StormHawkBoss`, `m2HeroRiko/Nami/Kiro/Zuno/Vexa`
- `plate-surf`: `m2AquaOrb` (colour orb, used world-wide)

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| (none) | | | All needs are covered by ready models. |

### 3 Flooded Ruins Escape
Ready models used:
- `flooded-ruins-escape/*` (all 12)
- `wind-tunnel-escape`: `m2FlyingCrate`
- root: `woodenLadder`, `plankBridge`, `stoneTower`, `checkpointBeacon`
- `shared`: `m2ShadowArmadillo`, `m2ShadowArmadilloR`, `m2CaveBat`, heroes
- `m2AquaOrb`

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2SunkenDrainGrate | set-piece | NICE | Stylized ancient round stone drain grate floor for a premium mobile/browser arcade game, 10 m wide circular sandstone slab with radial grate slots and a central whirlpool hole, moss and water stains, worn carvings of waves, clean low-poly game-ready geometry, no text, no logos |

### 5 Cloud Hopper
Ready models used:
- `cloud-hopper/*` (all 8)
- `sky-tower-jump`: `m2CloudBank`
- root: `checkpointBeacon`
- `shared`: heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2GloomNimbusBoss | boss | NICE | Stylized giant storm-cloud creature boss for a premium mobile/browser arcade game, huge puffy dark violet-grey cloud body with a wide toothless frowning mouth, three round glowing eye openings, small lightning-bolt horns, wispy cloud arms, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 27 Ring Jump Challenge
Ready models used:
- `ring-jump-challenge/*` (all 7)
- `plate-surf`: `m2SeaRock`
- `cloud-hopper`: `m2WindRing`
- root: `spikedBall`, `checkpointBeacon`
- `shared`: heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2CycloneRayBoss | boss | MUST for L2–5 | Stylized giant storm manta ray boss for a premium mobile/browser arcade game, wide flat diamond wings with deep blue-violet top and pale underside, glowing cyan wing-edge stripes, a ridged back fin that glows as a weak point, long thin tail ending in a flat landing-pad tip, friendly but fierce eyes, wings spread in a neutral T-pose-like glide pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 37 Plate Surf
Ready models used:
- `plate-surf/*` (all 4)
- `ring-jump-challenge`: `m2NeutralRing`
- root: `checkpointBeacon`
- `shared`: `m2GiantCrabBoss`, `m2SlimeBlob` (jelly tint), heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2SurfPlate | prop | MUST for level 1 vertical slice | Stylized round surf plate for a premium mobile/browser arcade game, a wide slightly oval disc board like a big ceramic plate with a raised rim and a gentle upturned nose, smooth glossy neutral white top with a simple wave-line groove for runtime recolouring, rubber foot pad in the centre, small underside fin, clean low-poly game-ready geometry, no text, no logos |
| m2SeaGullDiver | enemy | NICE | Stylized chunky cartoon seagull enemy for a premium mobile/browser arcade game, round white body, grey wings spread wide, big orange beak, goggle-like round eyes with a mischievous look, wings spread neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 41 Wind Tunnel Escape
Ready models used:
- `wind-tunnel-escape/*` (all 6)
- `sky-tower-jump`: `m2WindFanTower`
- root: `movingBlock`, `checkpointBeacon`
- `shared`: `m2FactoryDrone`, heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2GaleEngineBoss | boss | MUST for L2–5 | Stylized giant turbine monster boss for a premium mobile/browser arcade game, round riveted brass-and-slate engine body with a huge front intake fan as a mouth, glowing violet storm core visible behind the blades, two stubby exhaust-pipe arms, small angry headlight eyes above the intake, sturdy clawed feet, neutral standing pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 45 Sky Hook Swing
Ready models used:
- `sky-hook-swing/*` (all 7)
- `sky-tower-jump`: `m2CloudBank`
- `wind-tunnel-escape`: `m2FlyingCrate`
- root: `checkpointBeacon`
- `shared`: `m2FactoryDrone`, heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2SkyCannonTurret | prop | MUST for L2–5 | Stylized airship deck cannon turret for a premium mobile/browser arcade game, chunky rounded brass cannon on a rotating wooden-and-iron base, short wide barrel, a glowing violet storm crystal on top as a clear weak point, riveted plates, clean low-poly game-ready geometry, no text, no logos |
| m2GrappleHook | prop | NICE | Stylized grappling hook for a premium mobile/browser arcade game, chunky three-pronged rounded claw in polished steel with a blue grip ring and a short rope loop, toy-like friendly proportions, clean low-poly game-ready geometry, no text, no logos |

### 49 Zipline Rush
Ready models used:
- `zipline-rush/*` (all 4)
- `plate-surf`: `m2SeaRock`, `m2SeaCliffBg`, `m2MarkerBuoy`
- root: `stoneTower`, `checkpointBeacon`
- `shared`: heroes

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ZiplineTrolley | prop | MUST for level 1 vertical slice | Stylized zipline trolley for a premium mobile/browser arcade game, compact rounded steel pulley housing with two grooved wheels on top, a chunky T-shaped hand grip below with blue rubber grips, small brake lever, toy-like friendly proportions, clean low-poly game-ready geometry, no text, no logos |
| m2VoltEelBoss | boss | MUST for L2–5 | Stylized long electric sea eel boss for a premium mobile/browser arcade game, sleek serpentine body in deep teal with glowing cyan stripe pattern, wide fin crest along the back, round expressive eyes, visible glowing gill slits as weak points, small lightning-tipped tail fin, laid out straight in a neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2SeaStackLighthouse | set-piece | NICE | Stylized sea-stack lighthouse for a premium mobile/browser arcade game, tall rough rock pillar rising from the sea with a short white-and-blue striped lighthouse on top, round lantern room, wooden zipline deck platform ringing its middle, cable anchor rings, clean low-poly game-ready geometry, no text, no logos |

### World 2 shared (optional skin)
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2CrackedCoralWall | prop | NICE | Stylized cracked stone-and-coral wall block for a premium mobile/browser arcade game, 3 m square sea-weathered sandstone slab with bright deep cracks, small coral and barnacle clusters, slightly bulging centre to read as breakable, clean low-poly game-ready geometry, no text, no logos |

**Total: MUST for L1 vertical slice = 2** (`m2SurfPlate`, `m2ZiplineTrolley`). **MUST for L2–5 = 4** (`m2CycloneRayBoss`, `m2GaleEngineBoss`, `m2SkyCannonTurret`, `m2VoltEelBoss`). **NICE = 6** (`m2SunkenDrainGrate`, `m2GloomNimbusBoss`, `m2SeaGullDiver`, `m2GrappleHook`, `m2SeaStackLighthouse`, `m2CrackedCoralWall`).
