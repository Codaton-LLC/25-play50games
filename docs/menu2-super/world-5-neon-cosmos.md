# World 5: Neon Cosmos (Purple, Vexa / Phase)

## World intro
**Look.** A deep violet void with a faint cyan grid on the horizon. Floating neon cube fields, a ringed planet (`m2RingedPlanetBg`), alien spire valleys, drifting portal ruins, and crystal caves and towers that glow from inside. With the colour gone, everything is grey glass with dead edge strips. As the colour returns, the edge strips light up purple, then cyan, then magenta. Readability rule for the whole world: gameplay states are shown by **shape and fill** (solid vs. wireframe, filled vs. outlined glyph), never by hue alone. That keeps W5 away from W6's colour-switch games and works for colour-blind players.

**Music mood.** Glassy synthwave at 104–112 BPM: a soft arpeggio, a sub-bass pad and crystal bells. The stems are layered, so each restored game adds one layer to the world-map theme (bells, then arp, then drums, then lead). Puzzle games (24, 38, 44) use a calmer 88 BPM "thinking" mix that rises when a solution clicks.

**Theme: mind games.** Every game here asks the player to think one move ahead. The eight core verbs are flip the world, orbit, hide, place a portal, remember, steer two at once, redirect light, and turn gravity. No two share a verb.

**Guardian boss: the Hollow Prism.** Shadow Plates' lieutenant in this world: a huge faceted octahedron of black glass with a hollow, glowing core that drinks colour through its facets. It shows up in cameos (it watches from the sky in 10, 24 and 28) and is fought for real in **44 Crystal Cave Switch, L5**, inside a cave cube it can rotate.

**How the colour returns.** Each cleared game lights one star of the "Vexa constellation" on the W5 map node. A thread of purple light then runs from that game's node to the centre. When all 8 are cleared and the Hollow Prism is shattered, its stored colour breaks back out as a purple rainbow that hits Vexa (cheer animation, slow-mo). The neon grid of the whole map switches from grey to full colour, and the W6 Prism Fortress gate appears on the horizon.

**Shared-system needs for W5** (requests to `src/arcade3d/menu2/`):
- `physics`: support **per-body radial gravity with sphere-of-influence (SOI) hand-off** (10), **rotatable gravity vector with hero re-orientation** (44), and **momentum-preserving teleport transforms** (24).
- `worldState`: a global **two-state flip bus** (A/B solidity) that cubes, lasers and enemies subscribe to (7). It must be deterministic for ghosts and proof.
- `visibility`: a **darkness + reveal-pulse** layer (radius and fade) using one cheap emissive mask, with no real-time lights per pulse (28).
- `beams`: a grid **laser raycast solver** with reflections, max 8 bounces, recomputed only when a prism moves (38).
- `inputController`: a **mirrored-avatar mapping** (one input drives two avatars with a per-zone transform: invert, copy, delay) (33).
- `stealth`: scanner sweeps plus **cover-shadow volumes** with exact on-floor decals (17).
- `powers` `GhostWall`: Vexa is the lead hero, so every W5 level has **two** Vexa ghost routes instead of one.
- `boss`: support a boss that is **assembled from props** (7, 38) as well as a single GLB.
- `ghost`: puzzle games (24, 38, 44) record the solution path, so a friend's ghost can "show" an answer only after you have cleared the level once.

---

### 7 Neon Cube Jump  (World 5, Purple)
**One-line hook:** Every jump you take flips the whole cube field: solid cubes turn to hologram and holograms turn solid, so you plan each jump to land on the set it creates.
**Signature mechanic:** Cubes belong to set **A** (filled face, square glyph) or set **B** (filled face, triangle glyph). Only one set is solid at a time; the other is a 25% wireframe hologram you fall through. The flip happens **on takeoff** (0.08 s shimmer), so every jump lands on the other set. Rules that make it clever:
- Rolling or walking off an edge does **not** flip, so you can drop without flipping.
- `m2EnergyPad` launches you without flipping (a "free jump").
- Air actions follow the same rule: a second jump flips again and an air dash does not (see Hero roles).
- Controls: stick or WASD to move, Space or the jump button to jump, roll on the hold-down action. Cubes are 2 m, the jump reaches 2 cubes across and 1 up, and the hero speed is 6 m/s.
**Why it's different from:** 21 Color Match Jump (W6) matches colours to platforms; here colour does nothing, because *your own jump count* sets the level's state. 1 Sky Tower Jump climbs a fixed tower, while this field changes under you with every input.
**Hero roles:**
- **Riko:** an air dash moves 4 m with no flip, so she crosses a wide gap and still lands on the set she left, which opens dash-only shortcuts.
- **Nami:** her double jump flips **twice**, so she lands back on the set she started on. She reaches "same-set" high ledges that are impossible for others.
- **Kiro:** his shield lets him stand inside a laser cube's beam for 1.5 s (L4 laser routes).
- **Zuno:** his magnet pulls coin trails that are hidden *inside hologram cubes*.
- **Vexa:** while phasing (0.6 s), a flip does not drop her through holograms. She rides one hologram cube and reaches two ghost-wall secrets per level.
**Levels:**
- L1 **Static Grid** (3 beats): (1) a gap where only B holograms lie ahead; jump and they turn solid under you. (2) A lone A cube behind you vanishes on your next jump, which teaches "no going back". (3) An A/B staircase climb of 6 cubes. Target 45 s.
- L2 **Moving Cubes**: B cubes slide on rails at 2 m/s, but **only while solid**. Holograms freeze in place, so you "park" a cube by timing your jumps.
- L3 **Blink Grid**: rogue cubes with a ring glyph flip on their own 1.6 s clock, ignoring you. You sync your jump rhythm to them (a visual pulse shows the clock, with no audio cue needed).
- L4 **Laser Grid**: `m2LaserWall`s join the sets. A-lasers are live when A is solid, so your jumps switch lasers on and off. `m2NeonSentryDrone` patrols only on solid cubes.
- L5 **Neon Overdrive**, boss **"Flipframe"**: a 3×3 cube giant built from `m2NeonCube` blocks around a sentry-drone core. Its blocks belong to sets too.
  - P1: it stomps the solid set. You hop so that your landing set is the one it is *not* stomping. Three dodged stomps open its core.
  - P2: the core floats on a hologram cube. Jump to make that cube solid, then ground-pound the core. 3 hits.
  - P3: Overdrive. The field flips on its own every 1.2 s *and* on your jumps. Climb its falling blocks to the core for the final hit (slow-mo).
**Stars:** clear / all 12 colour orbs (several sit on cubes reachable only on a specific flip parity) / target time (L1 45 s up to L5 110 s). The no-hit bonus counts as a fourth star.
**Secrets:** a "parity shard" reachable only after an even number of jumps since the checkpoint (an HUD counter shows parity as a square or triangle glyph), two Vexa ghost walls, and a Nami same-set ledge sticker in L3.
**Juice moments:** the whole grid ripples outward from the hero on each flip; a soft glass chime rises in pitch on alternate flips; a "Perfect Park" pop when a moving cube stops exactly under you; the camera kicks on the boss stomp; the combo grows with consecutive jumps without touching the ground for more than 0.5 s.
**Multiplayer (1-4):**
- Co-op: the flip bus is **shared**, so anyone's jump flips everyone. That is chaos by design, so co-op uses "call it" pings (tap to ping "Hold!"). Co-op-only route: one player stands on an energy pad as an anchor while another flips.
- Versus race: each player gets their **own** flip state, rendered as split ghost grids of the same layout, side by side.
- Party: "Last Cube Standing", where each jump also flips a rival's set.
- Camera: shared fitted view; split screen for versus.
**Assets:** reuse all of `neon-cube-jump/` (`m2NeonCube`, `m2EnergyPad`, `m2LaserWall`, `m2LaserWallV2`, `m2DigitalCoin`, `m2NeonSentryDrone`, `m2NeonSpikeBlock`, `m2NeonWedgeRamp`, `m2NeonCityBg`), root `checkpointBeacon.glb`, and the 5 shared heroes. The hologram look is a runtime wireframe/fresnel shader, not a new model. The boss is assembled from cubes plus the drone. NICE: `m2FlipframeCore`.
**Risks:**
- Players lose track of the state. Fix: a big parity glyph on the HUD, and the next-solid set always shows a faint "landing preview" outline under the jump arc.
- Co-op chaos. Fix: the ping system, and shared flip only in co-op, never in versus.
- The existing prototype's free jumping has to be removed; the prototype is replaced, not patched.

---

### 10 Space Pod Jump  (World 5, Purple)
**One-line hook:** Leap between tiny planetoids and station pods, falling into real orbits and slingshotting past moons to reach the next dock.
**Signature mechanic:** Patched-conic gravity:
- Each body has a sphere of influence (SOI = 2.5 × radius), and only the nearest SOI pulls (μ = g·R²), so arcs are true Kepler orbits.
- Surface gravity is 6 m/s² on a planetoid with R = 4 m (μ = 96). Circular orbit speed is √(μ/r) and escape speed is √(2μ/r), about 6.9 m/s at the surface.
- A normal jump (4.5 m/s) always comes back down. A **charged launch** from an `m2SpacePod` cradle (hold 0–0.8 s, 5 to 9 m/s, aimed with the stick) can escape.
- In flight, hold Action for **retro jets**: 1.5 m/s² thrust with 1.2 s of fuel, refilled on landing. A dotted trajectory preview shows the next 1.5 s, coloured where it would crash or leave the map.
- Moving moons let you **slingshot**: passing behind a moon in its direction of travel adds up to +3 m/s.
**Why it's different from:** 5 Cloud Hopper and 1 Sky Tower Jump use flat, downward gravity on fixed platforms; here "down" is wherever the nearest body is and you plan curves. 43 Roll Cannon Jump (W1) fires straight shots, while here you ride closed orbits and choose when to break them.
**Hero roles:**
- **Riko:** her dash is a 0.3 s prograde burn (+2.5 m/s), the one way to break into a high orbit without a pod. It also breaks cracked satellite panels.
- **Nami:** her double jump is a second impulse mid-orbit (a mini burn in any direction), which lets her catch moons others miss.
- **Kiro:** his shield crosses the solar-flare zone and the debris belts in L3 and L4.
- **Zuno:** his magnet pulls orbiting `m2EnergyOrbBlue` rings in from a 6 m radius, which is big for orb stars.
- **Vexa:** phasing passes through a planetoid's crust to its far side, a straight chord instead of an orbit. She also reaches 2 ghost-hatch secrets.
**Levels:**
- L1 **Dock** (3 beats): (1) walk all the way around one round planetoid, so the player feels down change. (2) Hop to a second planetoid whose SOI overlaps the first, so you fall into it. (3) Your first pod launch to the `m2StationDeck` dock, with a wide capture ring. Target 50 s.
- L2 **Pod Line**: a chain of 6 cradles. You must **circularise**: arrive, tap the jets at the right moment to settle into orbit, then launch at the right point of the orbit. A ghost arc teaches "launch tangent".
- L3 **Satellite Field**: moving moons, and slingshot gates (rings) that only open at ≥ 8 m/s. `m2SatellitePanel` arrays are rotating platforms. `m2SpaceCrate` debris drifts in orbit.
- L4 **Zero-G Gap**: one region has no planetoid, only drift. Jet fuel is precious, and you push off floating crates (each push applies an equal, opposite impulse to the crate).
- L5 **Orbital Peak**, boss **"Orbit Warden"**: a mechanical moon with plate rings that sits at the system centre and rewrites orbits.
  - P1: it fires slow gravity mines that bend your trajectory preview, and you read the new arc. Ride an orbit behind it and pod-launch into its 3 exposed vents.
  - P2: it spins up its rings into a fast debris belt. Time the gap (every 2.4 s) and land on its surface, walk round to its thruster, and roll into it. 2 hits.
  - P3: it tries to escape into the planet's shadow (the Hollow Prism watches). Slingshot off its own moon to catch it and deliver the final hit (slow-mo).
**Stars:** clear / all orbs (several only in high orbits) / target time; a bonus for "no jet fuel used" in L1–L2.
**Secrets:** a hidden moonlet only reachable by a perfect slingshot; Vexa's crust-chord to a sticker in the core of L4's big planetoid; a Riko high-orbit shard.
**Juice moments:** a starfield streak at speed; the trajectory dots ping when they lock onto a capture; a soft "whomp" and dust ring when entering an SOI; the camera rolls to keep the local "down" at the bottom of the screen, limited to 25°/s so nobody feels sick; a "Perfect Orbit" combo for chaining 3 captures without jets.
**Multiplayer (1-4):**
- Co-op: a co-op tether, where one player in orbit pulls the other along. Two heroes can stand on opposite sides of a pod and launch together for a double-strength escape (a co-op route).
- Versus: race to the dock on the same system, and slingshotting past a rival steals 1 m/s from them.
- Camera: shared fitted view, which zooms out to show the bodies everyone is on; a split screen is not needed.
**Assets:** reuse `space-pod-jump/` (`m2SpacePod`, `m2StationDeck`, `m2DockingArm`, `m2SatellitePanel`, `m2SpaceCrate`, `m2EnergyOrbBlue`, `m2Asteroid` for debris and small moons, `m2RingedPlanetBg`), shared heroes, and `checkpointBeacon.glb`. New: `m2MiniPlanetoid` (MUST L1, the walkable body) and `m2OrbitWardenBoss` (MUST L2–5). NICE: `m2GravityBuoy`.
**Risks:**
- Real orbits feel floaty or unfair. Fixes:
  - a generous capture ring at docks (1.5× radius)
  - the 1.5 s preview always on
  - SOI hand-off is instant, not blended, so arcs stay predictable
  - integration uses a fixed 120 Hz sub-step so ghosts and proof match
- Motion sickness. Fix: limited camera roll, and an option to keep "up" fixed.

---

### 17 Alien Lane Escape  (World 5, Purple)
**One-line hook:** Sprint across an alien valley while a mothership's scanner sweeps over you, and be inside a shadow when the scan line passes.
**Signature mechanic:** A 3-lane runner (speed 10 to 15 m/s) with one twist: **break line of sight**.
- `m2AlienMothership` hovers behind you and sends **scan lines**: a glowing violet sheet that sweeps forward along the track at 22 m/s.
- Each sweep is telegraphed by a rising chirp and a violet edge glow at the bottom of the screen, 1.5 s ahead.
- Cover objects (`m2AlienCrystal`, `m2AlienPlant`, rocks) cast a painted **shadow strip** 3 m long on the lane right behind them. If you are inside a strip when the line passes, you are "Unseen" (+combo).
- If you are caught, a tractor beam lifts you for 1.2 s (you lose time, and the next obstacle is still coming). Two catches within 6 s count as a hit.
- Controls: left and right to change lane, up to jump, down to slide (sliding also shrinks you into low shadows).
**Why it's different from:** 15 Color City Sprint and 12 Mine Tunnel Run (W1) are pure speed and dodging; here you *slow down your thinking* to be in the right place when the scan passes. 19 Candy World Runner (W4) is about collecting along the route, while here the route is chosen by cover.
**Hero roles:**
- **Riko:** her dash crosses a 12 m open stretch before the scan lands, a speed route with no cover.
- **Nami:** her double jump reaches the high mesa lane (a 4th, upper lane on some stretches) that the scan cannot see.
- **Kiro:** his shield is a scan-proof bubble for 1.2 s, once per stretch, and he crosses goo-spray hazards.
- **Zuno:** his magnet pulls coin trails out of `m2AlienGooPuddle`s.
- **Vexa:** she phases *into* a crystal and hides inside it, so any crystal is perfect cover, even ones without a shadow strip. She also passes 2 ghost walls in the spires.
**Levels:**
- L1 **Alien Meadow** (3 beats): (1) a scan with one big crystal right in your lane, so you only need to stay put. (2) A scan where the cover is in the next lane. (3) Two quick scans with two covers in a row. Target 55 s.
- L2 **Crystal Route**: moving cover. `m2AlienPod`s roll across the lanes, so their shadow moves with them.
- L3 **Meteor Zone**: `m2MeteorRock`s land ahead (a telegraph ring 1 s before) and **leave craters that become new shadows**. You read where cover *will* be.
- L4 **Glow Plants**: some `m2AlienPlant`s light up when brushed and *erase* nearby shadows for 3 s, and the scanner now also sweeps sideways (a lateral line across the lanes).
- L5 **Planet Escape**, boss **"Mothership"** (`m2AlienMothership`):
  - P1: it drops `m2AlienBlob`s and abduction beams. Lure 3 abduction beams onto decoy `m2AlienPod`s (stand next to one, then dodge at the last moment), and it overheats.
  - P2: it lowers. `m2FlyingSaucer` drones become stepping stones to its glowing underside; jump-roll into it 3 times while scans continue.
  - P3: a constant scan as you sprint to the launch pad, cover to cover, and the final jump crashes a meteor into it (slow-mo).
**Stars:** clear / all orbs (some sit in open ground, a risk) / target time; a bonus for "Ghost Run" (never caught).
**Secrets:** a cave behind a Vexa crystal; a Nami mesa sticker; an "abducted shard" you get only by *letting* yourself be beamed once in L3, which lifts you to a floating rock.
**Juice moments:** the world desaturates as the scan passes over you while you are hidden, with a heartbeat sound; an "UNSEEN" pop; dust on meteor impact plus a camera kick; the tractor beam spins the hero with a funny hurt animation.
**Multiplayer (1-4):**
- Co-op: a shadow can hold 2 heroes. A Kiro bubble covers everyone in its lane. A co-op route needs Vexa's ghost crystal opened for others (she holds it open 2 s).
- Versus race: same course; being caught slows you and not your rival, and the scan targets the leader.
- Camera: split screen for 2 players (one lane set each), shared fitted view for co-op up to 4 on wide screens.
**Assets:** reuse `alien-lane-escape/` (`m2AlienLaneSlab`, `m2AlienCrystal`, `m2AlienPlant`, `m2AlienPod`, `m2AlienGooPuddle`, `m2MeteorRock`, `m2FlyingSaucer`, `m2AlienSpiresBg`) and shared `m2AlienMothership`, `m2AlienBlob` and the heroes. The scan line and shadow strips are shaders and decals. NICE: `m2ScannerDrone`.
**Risks:**
- The scan feels random. Fix: every sweep is fixed per level seed, telegraphed 1.5 s ahead, and there is always a reachable shadow within 2 lanes.
- Phones hide the bottom glow behind thumbs. Fix: the telegraph is also a top-of-screen bar and a chirp.

---

### 24 Portal Hop  (World 5, Purple)
**One-line hook:** You choose where the exit portal opens, and whatever speed you carry in, you carry out, so you fall, fly and fling yourself across floating ruins.
**Signature mechanic:**
- Each island has a fixed **entry portal** (`m2PortalFrame`) and 2–4 **anchor obelisks** (`m2GlowObelisk`) where the **exit** (`m2PortalFrameV2`) can open.
- Tap an obelisk on screen, or cycle with Q/E or the bumpers, to move the exit there. It takes 0.4 s and there is only one exit at a time.
- **Momentum is preserved:** speed in equals speed out, along the exit's facing. A fall of 8 m into a floor portal gives about 12 m/s out of a wall portal, which launches you about 10 m.
- When you are within 6 m of the entry, a ghost arc shows the exit trajectory, and it updates live as you switch anchors.
- Controls: move and jump, plus the anchor choice. Nothing is placed freely, so it stays readable on a phone.
**Why it's different from:** 27 Ring Jump Challenge (W2) flies *through* rings for points; here the portal *redirects* you and you design the route. 21 Color Match Jump (W6) chooses by colour; here colour does nothing, only position, facing and speed matter.
**Hero roles:**
- **Riko:** dashing into a portal adds +4 m/s in, so she reaches far "speed-only" anchors.
- **Nami:** her double jump after exiting extends the arc to high ledges.
- **Kiro:** his shield lets him exit through a laser curtain that guards some anchors.
- **Zuno:** his magnet pulls coin trails along a portal arc.
- **Vexa:** she can phase *through* an entry portal without teleporting (a ghost route behind the frame), and she reaches 2 ghost-wall secrets.
**Levels:**
- L1 **Two Portals** (3 beats): (1) walk in, pop out on the next island (one anchor). (2) Choose between 2 anchors, one leading to the orb. (3) Fall from a ledge into a floor portal and fling out of a wall exit to cross a big gap. Target 45 s.
- L2 **Two Pairs**: two linked pairs on the same island. Chain them (exit A becomes speed into B), and the speed stacks.
- L3 **Moving Portals**: anchors orbit their island at 20°/s, so you choose *when* to enter as well as where.
- L4 **Cargo**: `m2VoidCrystal` blocks can be pushed through portals. Fling them onto pressure switches across gaps, or build steps.
- L5 **Portal Master**, boss **"Portal Wyrm"**: a long serpent of void glass that swims through *your* portals. Its body is built from `m2VoidCrystal` segments.
  - P1: it chases you between islands. Place the exit so that it emerges facing a `m2ColorBeacon` spike: 3 head-bonks.
  - P2: it coils around the central island. Fling yourself at high speed (the fall-through trick) onto its back crystal: 2 hits.
  - P3: chain both pairs so it loops into its own tail and ties itself in a knot, then deliver the final hit (slow-mo).
**Stars:** clear / all orbs / target time (fast routes need a good fall into the portal). Bonus: "Portal Economy", finishing with no more than the par number of anchor switches.
**Secrets:** a hidden anchor that only appears from a specific approach angle, a Vexa behind-the-frame route, and a "terminal velocity" sticker (exit at 18 m/s or more).
**Juice moments:** the camera keeps your facing through teleports with a 0.15 s swirl; a speed-line burst out of the exit; a whoosh pitch that rises with speed; a "Perfect Fling" ping when you land inside the target ring.
**Multiplayer (1-4):**
- Co-op: each player controls one pair (1–2 players each). Co-op-only routes: one player holds the exit on a far anchor while another "launches" a block.
- Versus: the same island chain side by side, with par switches shown.
- Party: "Portal Tag", where you choose exits that dump a rival into the void (the portals are shared).
- Camera: a shared fitted view; it may pan between islands when players split.
**Assets:** reuse `portal-hop/` (`m2PortalFrame`, `m2PortalFrameV2`, `m2PortalIsle`, `m2GlowObelisk`, `m2VoidCrystal`, `m2ColorBeacon`, `m2FloatingRuinBg`), root `islandA`–`islandD` (V2) as extra floating islands, `checkpointBeacon.glb`, and the heroes. New: `m2PortalWyrmBoss` head (MUST L2–5); its body uses `m2VoidCrystal` segments. NICE: `m2PortalAnchorPad`.
**Risks:**
- Spatial confusion after teleporting. Fixes:
  - the exit always faces a visible landing
  - the preview arc is shown before entry
  - the camera never flips more than 90° in one teleport
- Trivial with only 2 anchors. Fix: from L2 on there are always ≥ 3 anchors and one false lead per island.

---

### 28 Crystal Tower  (World 5, Purple)
**One-line hook:** The tower lights up its safe path for a few seconds, then goes dark, and you climb from memory, using crystal pulses to check.
**Signature mechanic:**
- Each floor is a ring of `m2CrystalHexPlatform`s around the central spire. Every platform's outline is always faintly visible at 10%, so there is no void, but only some are **real**; the rest are glass decoys.
- On reaching a floor, the `m2SequenceBeacon` plays a **light preview**: real platforms flash in walking order, 0.5 s each, about 3 s in total. Then the floor goes dark.
- A decoy cracks under you after 0.3 s and drops you one floor to the last checkpoint. You are not killed.
- Each `m2Crystal` picked up gives one **lumen pulse**: tap to reveal real platforms within 6 m for 1.5 s.
- You can **replay** the preview by standing on the beacon again, at a cost of 4 s.
- Controls: move and jump, plus a pulse button.
**Why it's different from:** 6 Temple Lantern Jump (W3) climbs lit lanterns in rhythm; here you climb in the dark from memory. 1 Sky Tower Jump is a reflex climb, while here you stop, watch, and then execute.
**Hero roles:**
- **Riko:** dashes over a short decoy pair (decoys need 0.3 s of contact to crack) on dash-only shortcuts.
- **Nami:** her double jump skips a floor ring to an outer high ledge.
- **Kiro:** his shield crosses the crystal-shard hail on the outer ring of L4.
- **Zuno:** his magnet pulls hidden crystals out of the spire wall, which gives extra pulses.
- **Vexa:** her phase climbs *through* the spire core on 2 ghost-wall shafts, a vertical route with its own short preview.
**Levels:**
- L1 **Three Steps** (3 beats): (1) a 3-platform path shown slowly, with no decoys under the first step. (2) The same path with 2 decoys; a fall drops you onto a soft pad. (3) Your first crystal, so you pulse to check a fork. Target 50 s.
- L2 **Branches**: the paths are 5 steps long with a fork, and the preview shows only one branch (the orb branch must be found with a pulse).
- L3 **Turning Floors**: the ring rotates 30° per beat (every 1.2 s), so memory has to be relative to landmarks (the spire's glow veins), not to the screen.
- L4 **Shard Storm**: `m2CaveBat`s "eat" your pulses (they fly toward light), and the preview gets shorter (0.35 s per step).
- L5 **Memory Tower**, boss **"Crystal Golem"** (`m2CrystalGolem`): it climbs the spire ahead of you.
  - P1: it smashes 2 real platforms per floor, so the preview updates. Hit its back crystal when it pauses to roar (step onto the lit pad behind it).
  - P2: a dark floor where only the golem glows. Dodge its glowing fist-lines and lure them onto decoys: 3 lures stun it.
  - P3: the spire top. Climb the final memory path while it collapses the floor below, and ground-pound its head crystal (slow-mo).
**Stars:** clear / all orbs (some sit on real platforms that are *not* in the preview) / target time. Bonus: "Perfect Memory", no decoy stepped on and no replay.
**Secrets:** a hidden ninth platform on L2 that flashes only during the replay; a Vexa core-shaft sticker; a Zuno wall crystal shard.
**Juice moments:** each real platform chimes a note during the preview, and stepping on it in the dark plays the same note, so the path is a melody. A decoy shatters into glass shards. A pulse sends a ring wave through the dark floor. The camera kicks on golem smashes.
**Multiplayer (1-4):**
- Co-op: players see *different parts* of the preview (each gets 1/N of the steps), so they must talk or ping. A co-op route needs two pulses at once to reveal the Vexa shaft for everyone.
- Versus race: the same tower with a different decoy layout per player, seeded fairly.
- Camera: a shared fitted view orbiting the spire.
**Assets:** reuse `crystal-tower/` (`m2CrystalHexPlatform`, `m2Crystal`, `m2SequenceBeacon`, `m2CrystalStairs`, `m2FloatCrystalPedestal`, `m2CrystalSpireBg`, `m2CrystalGolem` as the boss), shared `m2CaveBat` and the heroes. Decoy glass is a runtime material on the same hex model. Nothing new is needed.
**Risks:**
- Pure memory can feel punishing. Fixes:
  - the melody gives an audio hint
  - pulses
  - a replay costs time, not lives
  - falling drops one floor only
- Darkness can read as void on a phone. Fix: 10% outlines, an always-lit spire, and a minimum ambient lighting level.

---

### 33 Mirror Dash  (World 5, Purple)
**One-line hook:** You steer your hero and their reflection at the same time, on two runways where left and right are swapped, and both must make it through.
**Signature mechanic:**
- Two 3-lane runways run side by side, split by a mirror wall of `m2MirrorStand`s. Your hero runs on the left runway and a glass **reflection** runs on the right.
- One input drives both. **Lane changes are mirrored** (you go left, it goes right); jumps and slides are copied.
- Obstacles (`m2HazardBlock`) differ on each runway, so you look for the one input that saves both.
- The reflection survives 3 cracks, which reset at checkpoints. A crack slows both for 0.6 s.
- Speed is 9 to 14 m/s. Controls: swipe or left/right, up to jump, down to slide.
**Why it's different from:** 15 Color City Sprint and 46 Color Door Sprint (W1) control one runner; here you solve for two at once. 17 Alien Lane Escape (W5) is about where you are *when*; here it is about one input that is right for two bodies.
**Hero roles:**
- **Riko:** her dash breaks a cracked block on *your* runway, and the reflection copies the dash, which can open a shortcut only for both.
- **Nami:** her double jump is copied too, for high-lane coin lines on both sides.
- **Kiro:** his shield covers **both** bodies for 1 s; the bonus is a laser stretch.
- **Zuno:** his magnet pulls coins from both runways at once.
- **Vexa:** her phase lets *the reflection* pass through the mirror wall for 0.8 s, swapping runways, which reaches 2 ghost routes.
**Levels:**
- L1 **Mirror Lane** (3 beats): (1) obstacles only on your side. (2) Obstacles only on the reflection's side, so you watch the right half. (3) Both sides, with one obvious safe input. Target 50 s.
- L2 **Converge**: the runways can **merge** into one wide road for short stretches, where you and the reflection must not collide (opposite lane moves cross).
- L3 **Frosted Glass**: frosted mirror zones make the reflection **copy** instead of invert. The zones are clearly marked with a different wall texture.
- L4 **Echo**: in echo zones the reflection repeats your input 0.5 s later, so you read the obstacles twice.
- L5 **Clone Master**, renamed **"Glass Hall"**, boss **"Glass Sentinel"**: a towering knight-like mirror sculpture made of panes.
  - P1: it throws panes that land as obstacles on *both* runways at mirrored positions. Survive 20 s, then it stoops.
  - P2: it raises its shield-pane over one runway. Steer so the *unshielded* body hits its glowing knee-gem with a jump: 3 hits.
  - P3: the runways merge. Make both bodies jump into its chest crystal at the same time (the timing ring shows), and it shatters (slow-mo).
**Stars:** clear / all orbs (half sit on the reflection's side) / target time. Bonus: "Flawless Reflection", no cracks.
**Secrets:** a hidden third runway visible only in the reflection (the reflection can reach it with Vexa's swap); a Riko shortcut sticker; frosted-zone shards.
**Juice moments:** the mirror wall ripples on every lane change; a crack makes a sharp glass sound and leaves a hairline on the screen edge; a "Twin Perfect" pop when one input saves both sides from 2 obstacles at once; a slow-mo shatter for the boss.
**Multiplayer (1-4):**
- Co-op: **each player drives one body** (the true co-op form). In 4-player co-op there are two mirrored pairs on separate halves.
- Versus: each player runs their own pair side by side.
- Camera: one shared view for 1–2 players (the runways fit naturally); split screen for 3–4 players.
**Assets:** reuse `mirror-dash/` (`m2RunwayPlatform`, `m2MirrorStand`, `m2HazardBlock`, `m2MirrorHallBg`), `m2NeonSpikeBlock` and `m2LaserWall` from neon-cube-jump for variety, `m2Crystal` for orbs, and the heroes. The reflection is the same hero GLB with a glass shader. New: `m2GlassSentinelBoss` (MUST L2–5). NICE: `m2MirrorGate`.
**Risks:**
- Too hard to read 6 lanes on a 390 px phone. Fixes:
  - lanes are 1.4 m wide and the camera sits high and behind
  - obstacles are tall and bold
  - the first 2 levels slow to 9–11 m/s
  - orbs on the far side get a subtle highlight
- Title change: the level "Clone Master" is renamed "Glass Hall" to stay away from clone wording.
- The original memory concept is dropped on purpose, because 28 Crystal Tower owns memory in this world.

---

### 38 Laser Maze Run  (World 5, Purple)
**One-line hook:** A vault heist: push prisms to bend the security lasers onto the locks, grab the core, then run back out through the beams you just set up.
**Signature mechanic:**
- Rooms are on a 2 m tile grid. `m2LaserPrism` blocks are pushed by rolling into them (one tile, 0.25 s) and rotated 90° with Action.
- A prism bends a beam 90° off its diagonal face. Beams come from emitters and must reach **receiver locks**; some locks need 2 beams. Beams hurt: touching one costs a heart and knocks you back 1 tile.
- **Two halves:**
  - **Break-in:** solve the room so the locks open.
  - **Getaway:** after you grab the vault core, the alarm sounds, a 25–40 s timer starts, and you run back through every room *with your own beam layout still live*. You can re-push prisms on the run.
- Controls: move, roll (push), Action (rotate). The camera is a 3/4 view from above so the whole beam path fits.
**Why it's different from:** 7 Neon Cube Jump (W5) switches lasers by jumping; here you **route** light with objects. 44 Crystal Cave Switch (W5) moves the room; here you move pieces inside a fixed room, and the getaway turns the puzzle into a run.
**Hero roles:**
- **Riko:** her dash pushes a prism 2 tiles in one move and breaks cracked vault walls (a getaway shortcut).
- **Nami:** her double jump hops over a low beam and onto the ledge prisms of the upper rows.
- **Kiro:** his shield walks *through* one beam for 1.2 s, the fastest getaway route.
- **Zuno:** his magnet pulls coins from the vent shafts, and it can pull a prism one tile toward him (a reverse push for undoing mistakes).
- **Vexa:** her phase passes through the vault's ghost walls on 2 routes, and through a prism (beams pass through her while phasing).
**Levels:**
- L1 **Static Lasers** (3 beats): (1) push one prism into a beam so the lock opens. (2) Rotate a prism to aim it. (3) A short getaway where your beam now blocks the corridor, so you push it aside. Target 60 s.
- L2 **Moving Lasers**: emitters on rails sweep, and you place prisms to "catch" the beam at the right moment. `m2SecurityCam`s: if one spots you, it adds a temporary beam.
- L3 **Cross Grid**: two-beam locks, and the beams cross; a crossing burns a floor tile (`m2LaserFloorTile`) into a pit for the getaway.
- L4 **Fast Maze**: the getaway time is cut to 25 s, `m2PatrolBot`s push prisms back on their patrol, and you use that against them.
- L5 **Laser Master**, boss **"Vault Warden"**: a security core assembled from a giant `m2SecurityCam` head on a ring of `m2LaserWall`s.
  - P1: it fires a rotating beam. Push 3 prisms so its own beam bounces back into its lens (3 hits).
  - P2: it summons patrol bots that push your prisms. Rebuild the bounce while dodging: 2 hits.
  - P3: a getaway race out while it collapses the vault, then one final prism shot as you exit (slow-mo).
**Stars:** clear / all orbs (several sit behind beams you must re-route) / target time (break-in plus getaway). Bonus: "Clean Heist", never spotted and never burned.
**Secrets:** a hidden lock that opens only with a 3-bounce beam; a Vexa vault sticker; a Riko cracked-wall shortcut shard.
**Juice moments:** a beam snaps into a lock with a bass "thunk" and the gate slides open; red alarm lighting on the getaway with a music tempo jump; prisms scrape and spark; hit-stop and a camera kick on a beam hit.
**Multiplayer (1-4):**
- Co-op: one player holds a prism in place while the other runs the beam. Some locks need 2 heroes standing as "living mirrors" (co-op only: two heroes reflect a beam with their shields).
- Versus: mirrored vaults side by side, and the first one out wins.
- Camera: a shared overhead view (the rooms fit).
**Assets:** reuse `laser-maze-run/` (`m2LaserPrism`, `m2LaserFloorTile`, `m2SecurityCam`, `m2VaultWallBg`), `m2LaserWall` and `m2LaserWallV2` from neon-cube-jump, shared `m2PatrolBot`, `checkpointBeacon.glb`, and the heroes. New: `m2LaserEmitter` (MUST L1, which doubles as the receiver lock through an emissive swap). The boss is assembled from props. NICE: `m2VaultCoreBoss`.
**Risks:**
- Sokoban dead ends. Fixes:
  - Zuno's pull, plus a "reset room" button that costs 3 s for everyone
  - each room is hand-checked to be solvable from every reachable state
- Beam clutter on a phone. Fixes:
  - at most 3 beams per room
  - beams are 0.25 m thick with a bright core
  - a beam's path previews as dashed while you hold a prism

---

### 44 Crystal Cave Switch  (World 5, Purple)
**One-line hook:** Hit a crystal switch and the whole cave turns 90°, walls become floors, and you solve each cave by choosing which way is down.
**Signature mechanic:**
- Each cave is a cube room (about 16 m). A `m2CrystalSwitch` shows an arrow ring (the axis and direction of turn).
- Rolling into a switch **rotates the room 90°** over 0.8 s, with the hero held safely, and gravity points to the new floor.
- Loose things fall to the new floor: `m2CrystalSlabBridge` slabs, `m2SlimeBlob`s and boulders.
- Gates (`m2CaveGate`) on walls become reachable doors.
- A HUD cube-compass shows which face is down, and a long-press on a switch shows a ghost preview of the room after the turn.
**Why it's different from:** 10 Space Pod Jump (W5) has gravity pulling toward bodies, which you ride; here gravity is a **puzzle switch** for the whole room. 38 Laser Maze Run moves pieces inside a fixed room; here the room moves and the pieces follow.
**Hero roles:**
- **Riko:** her dash breaks cracked crystal walls that are walls only in one orientation.
- **Nami:** her double jump reaches a switch on the "ceiling" without rotating twice.
- **Kiro:** his shield survives falling onto a crystal-spike face after a turn.
- **Zuno:** his magnet pulls hidden coin trails through the crystal walls and holds one loose slab in place during a turn.
- **Vexa:** she phases into a wall, so when the room turns she ends up *inside the new floor's* hidden pocket (2 ghost routes).
**Levels:**
- L1 **Two Crystals** (3 beats): (1) one switch, one turn, and the far wall's gate becomes the floor. (2) A turn that drops a slab bridge across a gap. (3) Two switches where order matters (the wrong order is undone with a third switch, with no fail state). Target 60 s.
- L2 **Falling Things**: slimes and boulders fall with gravity. Squash slimes, or use a boulder as a weight on a pressure plate.
- L3 **Hidden Crystal**: some switches are lit, and so usable, only when seen "upright" from the current orientation. `m2CrystalBeaconPillar`s glow when aligned.
- L4 **Timed Turn**: amber switches spring back after 6 s (the room turns back), so you hurry through the open gate. `m2CaveBat`s ignore gravity.
- L5 **Crystal Master**, boss and **world guardian "Hollow Prism"**: the fight is inside a cave cube it controls.
  - P1: it turns the room on its own every 5 s (telegraphed by a facet flare). Its glowing core is exposed only on the face that is currently *down*, so hit the switch at the right time and roll into the core: 3 hits.
  - P2: it splits into 3 floating shards. Turn the room so they fall onto crystal spikes, one face at a time.
  - P3: it reforms, and both of you can turn the room. Out-turn it in a 3-move duel, then the final dash into its core (slow-mo, and colour bursts back into Vexa).
**Stars:** clear / all orbs (some only reachable in one orientation) / target time. Bonus: "Par Turns", solving each room in no more than the par number of turns.
**Secrets:** an upside-down sticker room visible only from the ceiling orientation; Vexa's in-floor pocket; a "full circle" shard for turning one room through all 6 orientations.
**Juice moments:** dust and crystal tinkles pour down on every turn; loose slabs land with a heavy thud and a camera kick; the HUD cube spins along; a soft choir swell when a gate aligns.
**Multiplayer (1-4):**
- Co-op: switches need **two players** to turn some axes (both roll in within 1 s). A co-op route needs Zuno to hold a slab while Riko turns.
- Versus: mirrored cave twins side by side, with a par-turns race.
- Party: "Cave Flip", where a shared room has 4 switches and you turn others into the spikes.
- Camera: a shared fixed view per room, which turns with the room.
**Assets:** reuse `crystal-cave-switch/` (`m2CrystalSwitch`, `m2CaveGate`, `m2CaveSlabPlatform`, `m2CrystalSlabBridge`, `m2CrystalBeaconPillar`, `m2GrottoWallBg`), `m2Crystal` and `m2VoidCrystal`, shared `m2SlimeBlob` and `m2CaveBat`, and the heroes. New: `m2HollowPrismBoss` (MUST L2–5, also used for cameos in 10, 24 and 28). NICE: `m2CaveBoulder`.
**Risks:**
- Disorientation. Fixes:
  - the cube-compass
  - the ghost preview
  - the camera turns with the room so "down" is always at the bottom of the screen
  - a 0.8 s turn, never instant
- Soft-locks. Fixes:
  - every room has a "reset" crystal
  - every orientation keeps a switch reachable

---

## Hyper3D models needed

Every game also reuses the 5 shared heroes (`m2HeroRiko`, `m2HeroNami`, `m2HeroKiro`, `m2HeroZuno`, `m2HeroVexa`) and root `checkpointBeacon.glb`. Hologram, glass, decoy, scan-line, beam and darkness looks are runtime shaders, not new models.

### 7 Neon Cube Jump
Ready reused: `m2NeonCube`, `m2EnergyPad`, `m2LaserWall`, `m2LaserWallV2`, `m2DigitalCoin`, `m2NeonSentryDrone`, `m2NeonSpikeBlock`, `m2NeonWedgeRamp`, `m2NeonCityBg`. The boss "Flipframe" is assembled from cubes plus the drone.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2FlipframeCore | boss | NICE | Stylized floating geometric boss core for a premium mobile/browser arcade game, a chunky faceted cube-shaped reactor heart with glowing purple and cyan seams and four short stubby connector arms to attach blocks, dark graphite shell, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 10 Space Pod Jump
Ready reused: `m2SpacePod`, `m2StationDeck`, `m2DockingArm`, `m2SatellitePanel`, `m2SpaceCrate`, `m2EnergyOrbBlue`, `m2Asteroid`, `m2RingedPlanetBg`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2MiniPlanetoid | set-piece | MUST for level 1 vertical slice | Stylized tiny round planetoid for a premium mobile/browser arcade game, near-perfect sphere with a gently cratered walkable surface, lavender-grey rock with soft purple crystal patches and a few small glowing vents, readable silhouette from all sides, clean low-poly game-ready geometry, no text, no logos |
| m2OrbitWardenBoss | boss | MUST for L2–5 | Stylized mechanical moon guardian boss for a premium mobile/browser arcade game, a round armored sphere of curved metal plates with two tilted rotating plate rings around it, three glowing purple vents and one large rear thruster, menacing but friendly cartoon proportions, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2GravityBuoy | prop | NICE | Stylized floating gravity buoy beacon for a premium mobile/browser arcade game, small spherical space buoy with a glowing purple ring band and three short antenna fins, white and dark grey panels, clean low-poly game-ready geometry, no text, no logos |

### 17 Alien Lane Escape
Ready reused: `m2AlienLaneSlab`, `m2AlienCrystal`, `m2AlienPlant`, `m2AlienPod`, `m2AlienGooPuddle`, `m2MeteorRock`, `m2FlyingSaucer`, `m2AlienSpiresBg`, shared `m2AlienMothership` (boss), `m2AlienBlob`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2ScannerDrone | enemy | NICE | Stylized small alien scanner drone for a premium mobile/browser arcade game, round hovering body with one wide glowing violet lens on the front and two small side fins, smooth lilac and dark purple shell, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 24 Portal Hop
Ready reused: `m2PortalFrame`, `m2PortalFrameV2`, `m2PortalIsle`, `m2GlowObelisk`, `m2VoidCrystal` (cargo blocks and the wyrm body), `m2ColorBeacon`, `m2FloatingRuinBg`, root `islandA`, `islandAV2`, `islandB`, `islandBV2`, `islandC`, `islandD`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2PortalWyrmBoss | boss | MUST for L2–5 | Stylized void-glass serpent head boss for a premium mobile/browser arcade game, the large head of a sleek space serpent made of dark translucent purple crystal with glowing cyan inner veins, smooth crest of crystal fins, open neck end to connect to separate body segments, expressive cartoon eyes, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2PortalAnchorPad | prop | NICE | Stylized portal anchor pad for a premium mobile/browser arcade game, round floating stone disc with a carved ring channel for engine-generated glow and three small crystal studs on the rim, dark slate and purple crystal, clean low-poly game-ready geometry, no text, no logos |

### 28 Crystal Tower
Ready reused: `m2CrystalHexPlatform` (real and decoy through material), `m2Crystal`, `m2SequenceBeacon`, `m2CrystalStairs`, `m2FloatCrystalPedestal`, `m2CrystalSpireBg`, `m2CrystalGolem` (boss), shared `m2CaveBat`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| (none) | - | - | Everything needed is already ready. |

### 33 Mirror Dash
Ready reused: `m2RunwayPlatform`, `m2MirrorStand`, `m2HazardBlock`, `m2MirrorHallBg`, `m2NeonSpikeBlock`, `m2LaserWall` (from neon-cube-jump), `m2Crystal`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2GlassSentinelBoss | boss | MUST for L2–5 | Stylized towering mirror-glass knight sculpture boss for a premium mobile/browser arcade game, tall humanoid figure built from large angular reflective glass panes with silver-violet frame edges, a big pane-shield on one arm, glowing purple gem in the chest and on each knee, open helmet-like crystal head with no face covering, T-pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2MirrorGate | set-piece | NICE | Stylized mirror gate arch for a premium mobile/browser arcade game, tall rounded archway with an empty center for an engine mirror effect, silver frame with violet crystal inlays and small side lamps, clean low-poly game-ready geometry, no text, no logos |

### 38 Laser Maze Run
Ready reused: `m2LaserPrism`, `m2LaserFloorTile`, `m2SecurityCam` (scaled up as the Vault Warden head), `m2VaultWallBg`, `m2LaserWall`, `m2LaserWallV2`, shared `m2PatrolBot`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2LaserEmitter | prop | MUST for level 1 vertical slice | Stylized compact laser emitter turret for a premium mobile/browser arcade game, squat rounded dark graphite base with a short barrel ending in a round glass lens, neutral emissive strip around the lens for runtime recolor, small bolts and vents, works as both emitter and receiver lock, clean low-poly game-ready geometry, no text, no logos |
| m2VaultCoreBoss | boss | NICE | Stylized vault security core boss for a premium mobile/browser arcade game, large floating armored sphere with one big round camera lens and a rotating ring of short laser barrels around its middle, dark graphite and violet panels, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |

### 44 Crystal Cave Switch
Ready reused: `m2CrystalSwitch`, `m2CaveGate`, `m2CaveSlabPlatform`, `m2CrystalSlabBridge`, `m2CrystalBeaconPillar`, `m2GrottoWallBg`, `m2Crystal`, `m2VoidCrystal`, shared `m2SlimeBlob`, `m2CaveBat`.

| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2HollowPrismBoss | boss | MUST for L2–5 | Stylized giant hollow crystal guardian boss for a premium mobile/browser arcade game, a huge floating octahedron of dark smoky glass facets with a hollow open center holding a glowing purple core, thin silver edge lines and a few floating shard fragments orbiting it, menacing but readable, neutral pose, plain light-grey background, original design, not resembling any existing franchise, clean low-poly game-ready geometry, no text, no logos |
| m2CaveBoulder | prop | NICE | Stylized round cave boulder for a premium mobile/browser arcade game, chunky rolling rock with small embedded purple crystals, slate-grey stone, clean low-poly game-ready geometry, no text, no logos |

**Total: must-L1 = 2** (`m2MiniPlanetoid`, `m2LaserEmitter`), **must-L2–5 = 4** (`m2OrbitWardenBoss`, `m2PortalWyrmBoss`, `m2GlassSentinelBoss`, `m2HollowPrismBoss`), **nice = 7** (`m2FlipframeCore`, `m2GravityBuoy`, `m2ScannerDrone`, `m2PortalAnchorPad`, `m2MirrorGate`, `m2VaultCoreBoss`, `m2CaveBoulder`).
