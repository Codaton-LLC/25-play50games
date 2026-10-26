# World 3: Wild Temples (green, lead hero Kiro, Shield)

Design cards for the eight World 3 games, written against `00-framework.md`. Every card follows the framework template. Temples here are generic ancient stone and jungle ruins from a lost civilization: carved sandstone, jade inlays, moss, roots and waterfalls. No dojo, no paper screens, no throwing stars, nothing ninja.

## World intro

**Look.** A lost jungle city. Step pyramids and cliff temples rise out of a canopy that is several hundred metres deep. Shadow Plates has drained the green, so the world opens grey and ashen: grey moss, white-grey leaves and dull jade. The only warm accents are torch and lantern light, gold coins and the glowing orb pickups. As you play, colour comes back in local bursts. Every lit lantern, perfect gong strike, crossed rope and cleared gate repaints a ring of moss and leaves in saturated green around it, so a finished level looks visibly greener than it did at the start. Lighting presets per level go from misty morning (L1), to green noon (L2), to golden hour (L3) and blue night with torches (L4), and the boss level (L5) has a storm-grey sky that breaks into sunlight on the boss finish.

**Music mood.** Organic percussion: log drums, clay pots, shakers, low bamboo flutes and a deep gong on the downbeat. The tempo is 96–120 BPM, and the world theme is the same 8-bar motif in every game. Temple Gong Timing uses that motif as its playable song, so the world's music *is* the world's rhythm game. Each level adds one instrument layer when the colour returns. The audio system needs a per-world stem set (base drums + 3 unlockable layers).

**Guardian boss: Coilstone, the Temple Serpent.** This is the world guardian, a colossal serpent of carved jade-and-sandstone segments wound through the ruins. Shadow Plates has wrapped its head in his dark plates and turned it against the jungle. It appears in three games, each time differently:
- in **16 Temple Coin Rush** it chases you (L5)
- in **34 Spin Pole Climb** it is coiled around the central pole (L5)
- in **36 Temple Gong Timing** you free it with a rhythm duel (L5, the world finale)

It is built as a code-driven chain of segments (one head GLB plus one body-segment GLB, instanced), so a single model pair covers all three fights. Two more of Shadow Plates' lieutenants appear in this world. **Umbra** (`m2ShadowArmadillo`) is a dark rival hero who wall-runs and balances like you. The other bosses are corrupted jungle creatures scaled up from ready enemies: the **Soot Bat Queen** (`m2CaveBat`), the **Howler King** (`m2JungleMonkey`) and **Mother Snapper** (`m2SnapperPlant`).

**How the colour returns.** On the world map, each cleared game regrows one terrace of the jungle around its node. When all eight are cleared, and Coilstone has been freed in 36 L5, the Great Gong rings across the map. A green shockwave repaints the whole world, Kiro's shell plates light up green, and the Shield becomes his full-strength version in later worlds: duration +1 s, cosmetic only on leaderboards.

**World-wide rules.** Kiro is the lead hero. His Shield (20 s cooldown, 3 s duration) crosses hazard zones; in this world those are fire jets, thorn bursts, spore clouds and falling rubble. Every level has at least one route for each of the five powers. The four temple games each own a separate core verb:

| Game | Core verb |
|---|---|
| Lantern Jump | **ignite** |
| Coin Rush | **pay** |
| Wall Run | **wall-run** |
| Gong Timing | **strike on the beat** |

---

### 6 Temple Lantern Jump  (World 3, green)
**One-line hook:** You climb a pitch-dark temple shaft by bouncing on lanterns to relight them, and only the light you leave behind holds the ledges up.
**Signature mechanic:** *Ignite and carry the flame.* This is a vertical platformer in darkness.
- **Ember meter.** The hero carries an ember glow. It is an 8 s meter, and its light radius shrinks from 6 m to 1.5 m as it burns down.
- **Lanterns.** Landing on an unlit lantern (`m2TempleLantern` on a bracket) is a bounce pad. It launches you 1.4× a normal jump, refills the ember and ignites the lantern for 12 s. A lit lantern lights a 5 m sphere.
- **Sun-glyph ledges** (`m2TempleLedge` with an emissive glyph shader) are solid only while they sit inside some light: your ember or a lit lantern. In darkness they fade to a ghost outline over 0.4 s and drop you.
- **Plain stone** ledges are always solid, but they are invisible beyond your ember radius.

So the route is a chain of light: you light a lantern, which makes the glyph ledges above it solid, and you have to reach the next lantern before both lights die. Controls are stick/WASD and Jump. Action, while airborne, throws the ember downward. That relights a lantern below you for a friend, or lights a ledge cluster, but it costs 3 s of ember.
**Board:** time (sum of 5 best times).
**Why it's different from:**
- *1 Sky Tower Jump* is a pure jump-distance climb in daylight. Here the resource is light, and the platforms exist only while lit.
- *44 Crystal Cave Switch* toggles world states with a switch. Here light is a continuous, fading area that you carry and spread, never a toggle.
**Hero roles:**
- **Riko:** dashes through cracked shaft walls into side galleries, each with a brazier (`m2StoneBrazier`) that relights the whole floor for 20 s, which is a shortcut.
- **Nami:** her double jump skips one lantern in a chain; she reaches the high balconies (`m2WoodenBalconyV2`) holding orbs.
- **Kiro:** shields through the fire-jet chimneys that block the fast centre column.
- **Zuno:** his magnet pulls ember sparks out of soot walls (+2 s ember each) and the coin trails hidden in the dark.
- **Vexa:** phases through ghost walls into a hidden lantern room containing the level's shard.
**Levels:**
- **L1 Temple Gate** (12 m shaft, 9 lanterns; teaches in 3 beats):
  1. One lit lantern and plain ledges, so you learn the bounce.
  2. A dark gap. Bouncing the lantern makes the glyph ledges appear, which teaches that light makes ledges solid.
  3. The ember dims on the way to a lantern 6 s away, which teaches the timer.
  Target time 70 s.
- **L2 Lantern Hall**, twist: *swinging lanterns*. Lanterns hang on chains and swing 2 m (period 3 s), so the light pool moves and the glyph ledges solidify in a sweeping band. Height 20 m.
- **L3 Balcony Climb**, twist: *wind gusts* blow lanterns out early. A gust is telegraphed by drifting leaves 1 s ahead, and it cuts a lantern's lit time from 12 s to 6 s. Wooden balconies (`m2WoodenBalcony`) crumble 1.2 s after you touch them. Height 28 m.
- **L4 Night Temple**, twist: *soot bats* (`m2CaveBat`) fly paths that snuff any lit lantern they touch. Bounce a bat to stun it for 4 s. Ember max is 6 s. Height 36 m.
- **L5 Golden Roof**, boss **"Soot Bat Queen"** (`m2CaveBat` at 4× scale, ash tint, glowing eyes). She perches on the roof beams (`m2TempleBeam`) and fans darkness down the shaft.
  - *P1:* she flaps every 6 s and snuffs every lantern on screen. Relight 3 lanterns in a row under her perch to scorch her wings (1 hit each, 3 hits).
  - *P2:* she dives along the shaft. Ride a lantern bounce up into her path while lit to hit her, 3 hits. Fire jets now pulse.
  - *P3:* the roof (`m2RuinRoofSection`) is dark except for her eyes. Throw the ember (Action) into the giant roof brazier as she passes over it, for a slow-mo finish.
**Stars:** clear / all 5 colour orbs (2 sit in the dark side galleries) / target time (L1 70 s, L2 95 s, L3 120 s, L4 145 s, L5 180 s), plus a no-hit badge.
**Secrets:**
- **"First Light":** clear a level without letting the ember drop below 2 s. Reward: a sticker.
- **Shard in the Vexa lantern room.**
- **Hidden roof brazier:** light all 9 lanterns of L1 in one run and it lights, opening a sky shortcut to the top.
**Juice moments:**
- A lantern ignites with a warm flash, ember sparks, a camera kick of +2° FOV and a pitch-rising chime per lantern in a chain. That chain is the combo meter: lanterns within 2 s of each other.
- Glyph ledges "draw" themselves in gold lines as the light reaches them.
- Moss turns green in a ring around each lit lantern.
**Multiplayer (1-4):**
- **Co-op (best fit):** heroes share light. Each hero's ember lights ledges for everyone, and ember throws relight lanterns for whoever is below. One co-op-only route: two heroes stand on twin pressure lanterns at once to light a giant chandelier that reveals a shortcut.
- **Versus race:** the same shaft, and every lantern you light is lit for rivals too, so lighting is shared but racing is not.
- Shared camera that frames the vertical band containing all heroes. A hero who falls more than 8 m below the highest hero respawns at the last lantern.
**Assets:**
- Reuse from `temple-lantern-jump/`: `m2TempleLantern`, `m2LanternDeck` (start/checkpoint deck), `m2TempleLedge` (glyph and plain ledges, two materials), `m2TempleBeam`, `m2WoodenBalcony`/`V2`, `m2StoneBrazier`, `m2RuinRoofSection`, `m2TempleTowerBg`.
- Reuse shared: `m2CaveBat` (enemy and boss), five heroes, `checkpointBeacon.glb`.
- New: none MUST. NICE `m2StoneCageLantern`, a stone-and-bronze cage lantern, if the ready `m2TempleLantern` reads as an East-Asian paper lantern in review (style rule).
**Risks:**
- **Darkness becomes frustrating guesswork.** Fix: every plain ledge has a faint rim light at all times, the next lantern always glows dimly as a beacon, and the ember beeps at 2 s.
- **Phones at 390×844 lose detail in the dark.** Fix: the phone quality tier raises ambient light by 20% while timings stay identical (fairness).
- The prototype's camera and platform collision are kept; its plain bounce-climb loop is replaced.

---

### 8 Jungle Vine Jump  (World 3, green)
**One-line hook:** You climb a giant jungle tree by swinging on vines while sliding up and down them, trading speed for reach on every swing.
**Signature mechanic:** *Climb the swing.* You grab a vine automatically by touching it.
- **Grip height:** while hanging, Up/Down slides the grip along the vine, from 1.5 m to 6 m below the anchor. A short grip swings fast (period ~1.6 s) with a small arc; a long grip swings slow (~3.2 s) with a big arc and more reach.
- **Pumping:** pressing Left/Right in time with the swing adds amplitude, up to 75° maximum.
- **Release:** Jump lets go along the swing's tangent.
- **The skill** is changing the grip *mid-swing*. Pulling up at the bottom of the arc speeds you up, like a real swing pump. Sliding down at the top extends your reach. Both are physically consistent through conservation of angular momentum.
- **Landing:** you land on branches and leaf pads, or catch the next vine directly for a combo.

Mobile: stick and Jump.
**Board:** time.
**Why it's different from:**
- *45 Sky Hook Swing* uses fixed-length hooks and is about release timing on a horizontal course. Here rope length is the live control, and the route goes straight up a tree with vine-to-vine catches.
- *34 Spin Pole Climb* climbs by orbiting a rigid pole. Here you are a pendulum and momentum is the whole game.
**Hero roles:**
- **Riko:** dashing in mid-air after a release is a second impulse, which reaches the far vine bundles past cracked bark walls.
- **Nami:** double-jumps up to the high canopy leaf pads, where the orbs are.
- **Kiro:** shields through thorn-burst clusters and spore clouds that block the short route.
- **Zuno:** his magnet pulls emerald trails (`m2JungleEmerald`) out of hollow trunks along the swing arcs.
- **Vexa:** phases through the ghost-root wall into a hollow inside the trunk with a secret vine shaft.
**Levels:**
- **L1 Green Start** (30 m climb; teaches in 3 beats):
  1. One vine over a safe leaf pad, to learn grab, pump and release.
  2. Two vines far apart, which teach that sliding down reaches further.
  3. A vine-to-vine catch over a 4 m drop that you cannot fall far from (there is a net leaf under it).
  Target 75 s.
- **L2 Branch Climb**, twist: *swaying branches* (`m2BranchPlatformV2`) that bob ±0.6 m, and vines that are rooted to moving branches, so the anchor moves.
- **L3 Swinging Vines**, twist: *snapping vines*. Brown, dry vines (`m2JungleVineV2`) break 2.5 s after you grab them, so you must commit fast. Snapper plants (`m2SnapperPlant`) bite on a 2 s cycle beside the landing pads.
- **L4 Ruins**, twist: *stone ruin rings* (`m2MossyRuinArch`, `m2RuinStone`). Some vines hang from broken arches that tilt as you swing (a weight puzzle), and fruit-throwing monkeys (`m2JungleMonkey`) knock you off the vine if they hit. Climb 70 m.
- **L5 Canopy Peak**, boss **"Howler King"** (`m2JungleMonkey` at 3× scale, ash-grey fur with dark plates on the shoulders, Shadow Plates' lieutenant). He sits in the crown of the tree.
  - *P1:* he throws fruit pods in 3-shot volleys at the vine you are on. Swing at maximum amplitude into his perch branch to knock him back, 2 hits.
  - *P2:* he chews through vine anchors, so vines drop 2 s after his roar. You climb under him and must keep moving. Release from a 60°+ swing straight into him, 2 hits.
  - *P3:* he grabs a vine and swings opposite you. Meet him at the bottom of the arc with more speed (a shorter grip wins) to knock him off the canopy, with a slow-mo finish.
**Stars:** clear / all 5 orbs / target time (L1 75 s up to L5 210 s), plus a no-fall badge.
**Secrets:**
- **"Monkey Bars":** 10 vine-to-vine catches without touching a platform. Reward: a sticker.
- **Shard in the Vexa trunk hollow.**
- **Hidden emerald vine** that glows only when you hang at the 6 m grip. It opens a shortcut to the next tier.
**Juice moments:**
- A whoosh rises in pitch with the swing speed.
- Leaves burst on each release, and a green colour streak trails you at combo ×3+.
- A camera roll of ±4° follows the swing.
- A catch-to-catch combo counts within a 1.2 s window.
- Canopy birds scatter on a perfect release (one within 5° of the ideal angle).
**Multiplayer (1-4):**
- **Co-op:** two heroes on one vine add their pumps together, so they swing higher. A co-op-only "tandem launch" reaches a canopy that needs both: one hero pumps, the other rides.
- **Versus race:** up the same tree. Grabbing a vine a rival is on makes it heavier, so it swings slower.
- Shared vertical camera; split screen is not needed.
**Assets:**
- Reuse from `jungle-vine-jump/`: `m2JungleVine`/`V2` (live and dry), `m2BranchPlatform`/`V2`, `m2LeafPlatform`/`V2`, `m2MossyRuinArch`, `m2RuinStone`, `m2SnapperPlant`, `m2JungleEmerald`, `m2GiantJungleTreeBg`.
- Reuse shared: `m2JungleMonkey` (enemy and boss), heroes.
- New: NICE `m2JungleFruitPod`, the thrown projectile (a sphere stand-in works).
**Risks:**
- **Pendulum physics feels floaty or unpredictable.** Fix: a deterministic pendulum in `rules.ts` with a fixed dt, a dotted release-arc preview on L1–L2 only (removed from L3 on), and the same timing on every device.
- **The vine mesh stretching to different lengths looks bad.** Fix: the vine is drawn as a chain of instanced segments, and the GLB is the top and leaf part only.
- The prototype's swing is fixed-length; grip control replaces it.

---

### 16 Temple Coin Rush  (World 3, green)
**One-line hook:** You run from a rolling boulder through a collapsing temple, grabbing coins to pay the toll gates that open the fast lanes.
**Signature mechanic:** *Collect and pay.* This is a three-lane forward runner (Left/Right to change lane, Up to jump, Down to roll-slide; swipes on mobile) with a coin economy that lasts only as long as the run.
- **Toll gates.** Every 12–18 s a temple gate (`m2TempleGate`) splits the path into a fast lane and a slow lane. The fast gate shows a coin price (5–25) floating above it in UI, never as text on the mesh.
- **Paying.** Running through the fast gate with enough coins spends them: the coins fly into the gate's basin and the gate opens onto a short, clean, coin-rich lane. Without enough coins the gate stays shut and pushes you into the slow lane: longer, with more traps, and with the boulder gaining 1.5 m.
- **The boulder** (`m2RollingBoulder`) chases at a gap of 6 m. The gap shrinks with every stumble and grows with every perfect lane.
- **Scoring.** Unspent coins at the finish are worth double, so every gate is a decision: buy speed or bank points.
**Board:** points (finish bonus + banked coins ×2 + time bonus), capped per level in `maxScore`.
**Why it's different from:**
- *12 Mine Tunnel Run* and *15 Color City Sprint* are pure dodge-and-speed runners. Here coins are a currency you spend on routing.
- *42 Magnet Coin Lab* and *23 Gem Collector 3D* are about gathering. Here gathering only matters for what you choose to spend or keep.
**Hero roles:**
- **Riko:** dashes through cracked side walls, which counts as a free toll (it skips a gate without paying).
- **Nami:** double-jumps onto upper ledge lanes above the slow lane with coin arcs.
- **Kiro:** shields straight through fire-jet pillars (`m2FireJetPillar`) that otherwise force a lane change, so he keeps his line.
- **Zuno:** his magnet pulls hidden coin veins out of the walls (+8 to +15 coins per vein), so he can buy every gate.
- **Vexa:** phases through the ghost gate, a hidden toll-free gate visible only as a shimmer.
**Levels:**
- **L1 Temple Entry** (55 s course, speed 8 m/s; teaches in 3 beats):
  1. A coin line, then a 5-coin gate that you can easily afford.
  2. A 15-coin gate you cannot yet afford, so you see the slow lane and the boulder closing.
  3. A gate after a rich coin stretch where paying or banking is your choice.
- **L2 Coin Hall**, twist: *spike trap tiles* (`m2SpikeTrapTile`) that pop on a 1.5 s rhythm. Gates now come in pairs (a cheap one and a dear one) with different lane lengths. Speed 9 m/s.
- **L3 Broken Floors**, twist: *collapsing tiles* (`m2BrokenTile`) fall 0.5 s after the boulder's rumble wave passes, so the floor behind you vanishes and a stumble near a gap costs a life.
- **L4 Rolling Hazards**, twist: *two boulders* (the second rolls in from a side ramp) and *price surges*: a gate's price rises by 1 every 2 s that you approach without picking a lane, which punishes hesitation. Speed 10.5 m/s.
- **L5 Temple Sprint**, boss **"Coilstone"** chase. The serpent replaces the boulder; its head is in the corridor behind you, with body segments looping overhead.
  - *P1:* it lunges every 8 s, telegraphed by a hiss and dust 1 s ahead. Pay a "bell gate" (20 coins), which drops a stone bell on its head, 2 hits.
  - *P2:* its body coils across the lanes ahead as moving walls. Slide under and jump over while buying gates. Each bell gate costs 30 now, 2 hits.
  - *P3:* a straight sprint to the grand gate. Every coin you spend there is a strike at Shadow Plates' plates on its head (each 10 coins = 1 crack, 5 cracks to free it). Then slow-mo as the plates shatter and the serpent turns green. It escapes, setting up 34 and 36.
**Stars:** clear / all orbs (3, each behind a hero-gated or paid lane) / target time with a coin-bank target (L1: finish with ≥ 20 banked coins), plus a no-stumble badge.
**Secrets:**
- **"Pauper's Run":** finish without paying a single toll. Reward: a sticker.
- **Hidden Vexa ghost gate** with a colour shard.
- **The "jackpot" gate** in L3: it costs 50, and behind it is a treasure room worth double coins.
**Juice moments:**
- Coins arc into the gate basin with a cash-register chime.
- The gate grinds open with a camera shake.
- The boulder's rumble gets louder and the screen edges darken as it closes in.
- A perfect lane (no hit, all coins) restores the green on the walls.
- Combo: consecutive coins within 0.4 s.
**Multiplayer (1-4):**
- **Versus race (best fit):** everyone runs the same course and the coins are shared. Coins grabbed by one player are gone for the rest, and paying a gate opens it for whoever is right behind you, so there is a tactical choice to make.
- **Co-op:** a shared coin purse that everyone pays from.
- Camera: split screen, one per runner, for 2 players; for 3–4, a shared wide follow camera with heroes in their own colour-tinted lanes on a 6-lane-wide hall variant.
**Assets:**
- Reuse from `temple-coin-rush/`: `m2TempleGate`, `m2TempleCoin`, `m2BrokenTile`, `m2SpikeTrapTile`, `m2FireJetPillar`, `m2RollingBoulder`, `m2StoneObstacle`, `m2StepPyramidBg`.
- Reuse shared: heroes; `m2CoilstoneHead` and `m2CoilstoneSegment` (new, shared, see the table).
- New: NICE `m2OfferingBowl`, a coin basin bolted beside a gate (without it, coins fly into the gate's top).
**Risks:**
- **Spending feels like a tax.** Fix: the fast lane always pays back more than it costs when you play it well (it has more coins and a better time), so a skilled player gains from it and a cautious player can still bank.
- **The score has a provable cap.** It equals the coins placed + the finish bonus + the time bonus at the theoretical best route; the proof test counts every coin, and doubling applies to unspent coins only.

---

### 31 Wall Run Temple  (World 3, green)
**One-line hook:** You cross a cliff temple without a floor, running along its walls and kicking from wall to wall.
**Signature mechanic:** *Wall-run.*
- **Starting a run:** jump toward a wall (`m2TempleWall` with `m2WallRunMarker` glyph strips) and hold toward it. You stick and run along it at 7 m/s.
- **The droop:** the run arc slowly sinks, 0 m for the first 0.6 s, then down 1.5 m/s², so each wall gives about 1.6 s of run before you drop.
- **Wall-kick:** Jump kicks you off at 60° toward the opposite wall, and a kick-landing resets the droop.
- **Columns:** stone columns (`m2StoneColumn`) give a "column whip". Grab one at speed and you pivot 90° around it into a new direction.
- **The floor is a chasm,** so you cross by wall-kick chains. Gap platforms (`m2TempleGapPlatform`) are the rest stops and checkpoints.

Controls: stick, Jump, and Action (a wall-roll into ball form, which passes under spike panels).
**Board:** time.
**Why it's different from:**
- *2 Rooftop Roll Climb* climbs up buildings with jumps. Here you move sideways along vertical surfaces, with almost no floor at all.
- *47 Tightrope Path* is slow, precise balance. This is fast flow parkour where stopping means falling.
**Hero roles:**
- **Riko:** dashes through cracked wall panels into an inner corridor shortcut.
- **Nami:** her double jump at the end of a run reaches the upper wall tier, with orbs and a faster line.
- **Kiro:** shields along the dart-vent walls (stone vents that puff thorn darts) without breaking his run.
- **Zuno:** his magnet pulls gold ring orbs (`m2GoldRingOrb`) out of the cliff face along the run arc.
- **Vexa:** phases through the ghost wall into the hidden temple interior with the shard.
**Levels:**
- **L1 Training Wall** (teaches in 3 beats):
  1. One long wall over a shallow pit with a floor, so a fall is safe.
  2. Two facing walls, which teach the kick.
  3. A column whip around a corner over the real chasm.
  Target 60 s.
- **L2 Double Wall**, twist: *moving walls*. Wall panels slide in and out of the cliff on a 3 s cycle, so you run while a panel is out.
- **L3 Column Hall**, twist: *column chains*. Whip-to-whip sequences, plus spike panels (`m2WallSpikePanel`) that you pass with a wall-roll (Action), timed to 0.3 s windows.
- **L4 Broken Temple**, twist: *crumbling walls* that crack 0.8 s after you start running on them, so chains must be fast. Swinging stone rams sweep the gaps on a 2.4 s cycle.
- **L5 Master Wall Run**, boss **"Umbra"** (`m2ShadowArmadillo`, Shadow Plates' lieutenant and a dark rival hero) in a tall shaft.
  - *P1:* he runs the opposite wall mirroring you and throws shadow plates across in 2 s volleys, which you dodge by dropping or rising on the wall. When your paths meet at the same height, kick into him, 2 hits.
  - *P2:* he cracks the walls ahead of you, so you must take the column whip route and catch him at a column, 2 hits.
  - *P3:* a vertical chase up the shaft with alternating wall kicks. Out-climb him to the top glyph and slam it, which drops the capstone on him with a slow-mo finish.
**Stars:** clear / all orbs / target time (L1 60 s to L5 150 s), plus a no-fall badge.
**Secrets:**
- **"Never Touch the Floor":** cross a level using no gap platform except the checkpoints. Reward: a sticker.
- **Shard in the Vexa interior.**
- **A hidden lower wall tier** with a cave route, reached only by letting the droop take you low on purpose.
**Juice moments:**
- Dust sprays from your feet on the wall.
- Each wall-kick gives a camera kick and a "thunk" whose pitch rises through the chain.
- The column whip has a brief 0.1 s slow-mo.
- The combo is your wall-kick chain (×1–×5).
- Green vines sprout along each wall you finish.
**Multiplayer (1-4):**
- **Versus race (best fit):** side by side through the same temple. Walls being used by a rival crack faster.
- **Co-op:** a co-op-only "boost kick" where one hero kicks off another hero's back for a 2× leap to a hidden gallery.
- Camera: a shared follow camera for 2 players; for 3–4, a fitted side camera with a catch-up teleport to the leader's checkpoint after 4 s off screen.
**Assets:**
- Reuse from `wall-run-temple/`: `m2TempleWall`/`V2`, `m2WallRunMarker`, `m2StoneColumn`, `m2TempleGapPlatform`, `m2WallSpikePanel`, `m2GoldRingOrb`, `m2CliffTempleBg`.
- Reuse shared: `m2ShadowArmadillo` (Umbra), heroes, `checkpointBeacon.glb`.
- New: NICE `m2SwingingStoneRam` (L4 hazard; a code log of `m2StoneColumn` scaled down works as a fallback).
**Risks:**
- **The camera loses the hero against the wall.** Fix: a side-on camera that leads in the run direction, with the wall drawn semi-transparent between the camera and the hero.
- **Sticking to walls feels sticky or random.** Fix: an explicit glyph strip marks runnable walls, with a 0.15 s grace window to catch a wall after a jump.

---

### 34 Spin Pole Climb  (World 3, green)
**One-line hook:** You climb ancient stone poles by running around them, because every lap of the spiral carries you upward.
**Signature mechanic:** *Orbit to rise.*
- **The helix.** Each pole (`m2RotatingPole`) carries a spiral stair of grip ledges (`m2GripLedge`, instanced in code). The hero is locked onto that helix, and Left/Right moves you around the pole. Moving one way climbs, the other way descends: one lap = 3 m of height.
- **The camera** orbits with you, so the pole stays centred and the world turns.
- **Pole spin.** The poles themselves spin at 10–40°/s, either with your direction (it carries you up, like an escalator) or against it (it treadmills you down).
- **Hazards** sit at fixed angles on the helix: sweeper bars (`m2SweeperBar`) that sweep at a different speed than the pole, gaps in the stair and spike collars.
- **Jump** hops over a sweeper or across a gap in the stair.
- **Switching poles.** When you face a neighbouring pole, a jump with Up switches to that pole's helix.
- **Rest points:** circular platforms (`m2CircularPlatform`) and mushroom caps (`m2MushroomCapTop`).
**Board:** time.
**Why it's different from:**
- *28 Crystal Tower* and *1 Sky Tower Jump* climb by jumping between free platforms. Here vertical progress is locked to orbiting, and the puzzle is reading relative spin speeds.
- *8 Jungle Vine Jump* is momentum on ropes. Here everything is rigid rotation and angles.
**Hero roles:**
- **Riko:** dashes through the cracked collar stone that blocks a stair section, a shortcut lap.
- **Nami:** double-jumps up 1.5 laps between stair rings to reach the orb ledges.
- **Kiro:** shields through the thorn-spore puffs vented by the spinning poles.
- **Zuno:** his magnet pulls the coin spiral out of a hollow pole.
- **Vexa:** phases through the ghost pole (a translucent one) whose helix leads to the shard cap.
**Levels:**
- **L1 Slow Poles** (2 poles, 18 m; teaches in 3 beats):
  1. A still pole: run around it and rise.
  2. A pole spinning *with* you, which is fast and fun.
  3. A pole spinning *against* you, so you learn to jump to the neighbour pole instead.
  Target 60 s.
- **L2 Twin Poles**, twist: *sweeper bars* on their own spin; you jump them on a readable 1.5 s rhythm.
- **L3 Mixed Rotation**, twist: *reversing poles* that flip direction every 6 s, telegraphed by grinding stone and a 1 s glyph flash, so you plan your pole switches.
- **L4 Fast Tower**, twist: *spiral tower climb*. A single wide central pole (the scale of `m2SpiralTowerBg`) with four helixes at different pitches. Switching helix is a short sideways hop, and spike collars move up and down the pole.
- **L5 Spin Master**, boss **"Coilstone"** wound around the central pole in the opposite spiral, so its body rotates against you.
  - *P1:* it slides its coils down the helix. Jump each segment as it passes; the glowing dark plate segments (1 in 5) are hit by stomping, 3 hits.
  - *P2:* its head appears on the far side and bites at your angle. Run the stair until the head overshoots, then hop pole to pole to strike its plated crown from above, 2 hits.
  - *P3:* the whole pole spins at 60°/s. Climb the last 3 laps to the gong cap at the top and roll into it; the sound shatters the last plates, with a slow-mo finish. Coilstone falls asleep, and the story continues in 36.
**Stars:** clear / all orbs / target time (L1 60 s to L5 170 s), plus a no-hit badge.
**Secrets:**
- **"Against the Grain":** finish a pole's helix against its spin without switching. Reward: a sticker.
- **Shard on the Vexa ghost pole.**
- **A checkpoint disc** (`m2CheckpointDisc`) hidden under a mushroom cap. Standing on it spins all the poles in your direction for 10 s.
**Juice moments:**
- A stone-grinding hum with Doppler as the poles spin.
- Green moss spirals up behind your path.
- A perfect sweeper hop (within 0.15 s) gives a chime.
- The combo counts laps without a hit.
- A pole switch has a whoosh and a short camera swing.
**Multiplayer (1-4):**
- **Co-op:** heroes on the same helix share a lap combo. A co-op-only "brake": one hero holds a hub lever that stops a pole while the others climb it.
- **Versus race (best fit):** up a 4-pole field. Players on the same pole are lapped around, so you can bump past a rival.
- Camera: a shared camera that orbits the field centre and frames every hero. Every hero has its own pole outline colour.
**Assets:**
- Reuse from `spin-pole-climb/`: `m2RotatingPole`/`V2`, `m2GripLedge` (the instanced helix stairs), `m2CircularPlatform`, `m2MushroomCapTop`, `m2SweeperBar`, `m2CheckpointDisc`, `m2SpiralTowerBg`.
- Reuse from 36: `m2TempleGong` (the gong cap at the top in L5).
- Reuse shared: `m2CoilstoneHead` and `m2CoilstoneSegment`, heroes.
- New: none.
**Risks:**
- **The rotating camera causes motion sickness.** Fix: the camera eases with a 0.25 s lag, the horizon stays level and its yaw speed is capped; a "fixed camera" setting moves the hero around a still pole.
- **Depth on the hidden back side.** Fix: hazards on the far side show through the pole as glowing outlines 1 lap ahead.

---

### 36 Temple Gong Timing  (World 3, green)
**One-line hook:** You roll into giant temple gongs on the beat of the jungle drums, and every perfect strike makes the ruined arena grow back.
**Signature mechanic:** *Strike on the beat.* This is a rhythm game in a 3D arena.
- **The arena:** 4–8 gongs (`m2TempleGong` on `m2StrikerPost`) stand around a circular ruin stage (`m2GongStage`).
- **The beat:** the song (the world motif, 96–132 BPM) sends timing rings (`m2TimingRing`) shrinking onto a gong, one beat ahead (4 beats on L1).
- **Striking:** you move the hero toward that gong (stick) and press Action on the beat. The hero rolls into ball form and slams into the gong.
- **Windows:** Perfect ±45 ms, Good ±90 ms, Miss outside. They are identical on touch and keyboard. A one-time audio-latency calibration (tap along to 8 beats) sets the offset.
- **Movement is part of the rhythm:** gongs far apart need you to start rolling a beat early.
- **Drum notes** (`m2CeremonyDrum`) are "hold" notes: you stay on the drum and hold Action for the length shown.
- **Off-beat shockwaves** from the corruption pulse across the stage, and you jump them on the off-beat.
**Board:** points (accuracy × combo), with the maximum proven per song chart.
**Why it's different from:**
- *16 Temple Coin Rush* and *31 Wall Run Temple* are traversal against the clock. Here the clock is the music, and all movement is in service of hitting beats.
- *40 Disc Target Throw* is aim and accuracy at your own pace. Here accuracy is temporal, with no aiming.
**Hero roles:**
- **Riko:** his dash crosses the stage in one beat to reach far gong pairs, so he can take the "cross-stage" chart variants worth double.
- **Nami:** double-jumps to the high gongs on the pillar tops (`m2RuinLanternPillar`), which are bonus notes.
- **Kiro:** his shield absorbs one shockwave, or saves one combo-breaking miss (lead hero perk).
- **Zuno:** his magnet pulls the "echo notes" (green orbs that float out after each Perfect) to him from 4 m.
- **Vexa:** phases through the ghost gong, an invisible gong that rings a secret chord section worth a shard.
**Levels:**
- **L1 Slow Beat** (96 BPM, 4 gongs; teaches in 3 beats):
  1. One gong; hit on the shrinking ring.
  2. Two gongs alternating; move between them.
  3. A drum hold note.
  Target: 70% accuracy.
- **L2 Alternating Gongs** (104 BPM, 6 gongs), twist: *call and response*. Lantern pillars flash a 4-note pattern, and you play it back with no rings.
- **L3 Moving Targets** (112 BPM), twist: *rotating stage*. The gongs orbit the stage, so you lead your roll.
- **L4 Fast Rhythm** (124 BPM, 8 gongs), twist: *shockwaves* on the off-beats, plus syncopated charts (eighth notes).
- **L5 Perfect Timing**, the world finale, boss **"Coilstone"** freed by rhythm. The serpent coils around the stage, and its tail slams the drums.
  - *P1 (call):* it plays a pattern on 3 gongs with its tail. Echo it exactly; each perfect echo cracks a plate, 4 plates.
  - *P2 (duel):* it slams off-beat shockwaves while you play a dense chart; 80%+ accuracy per 8-bar phrase cracks plates.
  - *P3 (the Great Gong):* a 16-beat crescendo that ends on the Great Gong at the centre. A Perfect final strike gives slow-mo, the serpent's eyes turn jade, and the green colour wave restores the world (the world-map event).
**Stars:** clear (the accuracy target: 70/75/80/85/90%) / all echo orbs / a score target (the time-target equivalent for a song), plus a full-combo badge.
**Secrets:**
- **The ghost gong chord** (Vexa) holds a shard.
- **"Silent Master":** clear L2's call-and-response with the HUD rings turned off (a toggle in L2+). Reward: a sticker.
- **Hidden 9th gong** in the jungle ruin background (`m2JungleRuinBg`). Hit it 3 times on the downbeat to unlock a remix of the song.
**Juice moments:**
- Each gong strike sends a visible soundwave ring, a camera kick on Perfect and a hit-stop of 40 ms.
- Grass and flowers grow out from the stage a little more with each Perfect.
- The music adds layers as the combo builds (×10, ×25, ×50).
- The drums flash green.
**Multiplayer (1-4):**
- **Co-op (best fit):** a band mode. Each player owns 2 gongs of the stage, and the chart splits across players; finale chords need everyone to hit within the same window.
- **Versus:** the same chart on mirrored half-stages, highest accuracy wins.
- **Party:** "gong steal," where whoever hits a shared gong first takes the note.
- Camera: one fixed elevated stage camera for everyone (no split screen).
**Assets:**
- Reuse from `temple-gong-timing/`: `m2TempleGong`, `m2StrikerPost`, `m2TimingRing`, `m2GongStage`, `m2CeremonyDrum`, `m2RuinLanternPillar`, `m2JungleRuinBg`.
- Reuse shared: `m2CoilstoneHead` and `m2CoilstoneSegment`, heroes.
- New: NICE `m2GreatGong`, a giant central gong for L5 (fallback: `m2TempleGong` at 2.5× scale).
**Risks:**
- **Audio latency differs by device.** Fix: the calibration step and the WebAudio scheduled clock (never frame timing). Timing is judged against the audio clock in `rules.ts` inputs.
- **Moving the hero makes rhythm unfair on touch.** Fix: tapping a gong on the screen auto-routes the roll to it, so the timing press is the only skill. Keyboard and gamepad players can also use tap/click routing; same windows for all.
- **Music licence:** the song stems must be generated or royalty-free, with the licence recorded in `audio`.

---

### 40 Disc Target Throw  (World 3, green)
**One-line hook:** You throw a returning disc that curves and banks off ancient stone, then catch it on the way back to keep your combo.
**Signature mechanic:** *Throw, bank, catch.* The hero stands in a ruin courtyard.
- **Aiming:** drag (touch) or hold the mouse to aim; release to throw. The swipe's curve sets a hook left or right, up to a 35° bend.
- **Flight:** the training disc flies about 18 m, and it ricochets off stone surfaces (columns and walls) with a reflection plus a 15% speed loss, up to 3 banks.
- **Return:** the disc then returns along a boomerang arc to the hero's position at launch time.
- **Catching:** you move (stick) to catch it. A catch within 0.6 m keeps the combo and gives a "clean catch" multiplier. A miss drops the combo and costs 1.5 s to fetch the disc.
- **Targets:** hay targets (`m2HayBaleTarget`), stone idol targets and moving targets score more after banks (×1 / ×2 / ×3 per bank), and a single throw can hit several targets.

Mobile gets the allowed aim help, a dotted preview of the first segment only; there is no timing help.
**Board:** points (hits × bank multiplier × combo), with the maximum proven per level target set.
**Why it's different from:**
- *36 Temple Gong Timing* judges time. This judges aim, geometry and the catch.
- *43 Roll Cannon Jump* launches the hero. Here the hero stays and the projectile comes back, so positioning for the catch is the second half of every throw.
**Hero roles:**
- **Riko:** dashes to catch a disc that would otherwise land out of reach (catch range +4 m).
- **Nami:** double-jumps for a high catch, which lets her throw "lob" discs over the palisade (`m2PalisadeWall`) to targets behind it.
- **Kiro:** shields through the thorn-burst zone covering the best throwing spot.
- **Zuno:** his magnet pulls the returning disc to him from 3 m, which is a safer catch, and pulls the coin clusters off hit targets.
- **Vexa:** her disc phases through ghost walls for one throw, reaching the hidden target behind the temple wall.
**Levels:**
- **L1 Static Targets** (10 targets; teaches in 3 beats):
  1. A straight throw and catch.
  2. A target behind a pillar, hit with a curve.
  3. A target reachable only by banking off a wall.
  Target time 60 s.
- **L2 Moving Targets**, twist: *rail targets* sliding along ruin rails at 1.5–3 m/s; you lead the throw.
- **L3 Color Targets**, twist: *colour order*. Targets glow in sequence (green → gold → jade), and hitting them in order gives ×2. A bank shot that hits all three in one throw is a "Triple Glyph".
- **L4 Fast Combo**, twist: *a moving hero*. You throw from a slowly drifting raft platform (shared idea with 47: `m2RaftPlatform`), so the return point moves and the catch needs prediction. Monkeys (`m2JungleMonkey`) try to steal the disc in flight; hit them with it for a bonus.
- **L5 Accuracy Master**, boss **"Mother Snapper"** (`m2SnapperPlant` at 5× scale with dark plates on her stalk), rooted in the courtyard centre.
  - *P1:* her mouth opens for 1.2 s every 4 s. Throw the disc into it, 3 hits. Her closed mouth is plated and reflects the disc randomly.
  - *P2:* she grows seed pods on 4 vines. Bank throws hit the pods behind her, and each popped pod stuns her for an open-mouth window, 3 hits.
  - *P3:* she spits thorn volleys at you (shield or dodge) and only her plated crown is weak, reachable by a 2-bank shot off the courtyard columns. The final hit gives slow-mo and a bloom of green flowers.
**Stars:** clear / all orbs (hit the 3 orb targets hidden on rooftops and behind walls) / time target to clear the target set, plus a "no dropped disc" badge.
**Secrets:**
- **"Trick Shot":** one throw with 3 banks and 3 hits. Reward: a sticker.
- **Vexa's hidden target** holds a shard.
- **Score marker posts** (`m2ScoreMarkerPost`): hit all 4 in L1 with no misses to unlock a gold disc skin (cosmetic).
**Juice moments:**
- A whoosh from the disc, whose pitch rises with every bank.
- Sparks and a stone "clack" on each bank.
- The target bursts into hay and leaves.
- A satisfying "thwap" on the catch with a hand flash.
- Hit-stop on multi-hits.
- A trail ribbon in the hero's colour.
- Combo: consecutive clean catches.
**Multiplayer (1-4):**
- **Versus (best fit):** a target duel on the same courtyard. Targets you hit turn your colour, the most colour at time-up wins, and you can steal a target by hitting it again.
- **Co-op:** pass catches. The disc returns to a teammate instead of the thrower (a co-op-only target behind the boss needs a relay).
- Camera: shared fixed courtyard camera.
**Assets:**
- Reuse from `disc-target-throw/`: `m2HayBaleTarget`, `m2PalisadeWall`, `m2ScoreMarkerPost`, `m2TrainingPavilionBg` (dressed as a jungle ruin camp).
- Reuse from 31: `m2StoneColumn` (bank pillars). From 47: `m2RaftPlatform` (L4).
- Reuse shared: `m2SnapperPlant` (boss), `m2JungleMonkey`, heroes.
- New, **MUST L1:** `m2TrainingDisc`, the throwable disc itself.
- New, NICE: `m2StoneIdolTarget` (a stone ring target, for L3 colour order; a tinted hay target works as fallback).
**Risks:**
- **Physics hard to read.** Fix: a short preview of the first segment plus a post-throw path trail for 1 s, so players learn the banks.
- **Catches feel cheap.** Fix: the catch radius is shown as a ring on the ground at the disc's return point, 0.8 s ahead.
- **Score cap:** the proof enumerates the targets × maximum bank multiplier × combo cap.

---

### 47 Tightrope Path  (World 3, green)
**One-line hook:** You cross a misty jungle gorge on ropes and old beams, fighting wind and sway to keep your balance.
**Signature mechanic:** *Balance.*
- **The lean meter.** Moving along a rope or beam fills a lean meter, a needle that drifts left or right (the drift speed grows with the speed you walk, the gusts and the sway of the rope). You hold the stick in the opposite direction to bring the needle back. Past ±100% you wobble for 0.5 s, a warning; if you do not recover, you fall to the last checkpoint.
- **Speed vs safety:** walking slowly makes the needle drift slowly; sprinting (Up held) moves at 2× but drifts at 3×.
- **Crouch** (Action) halves the drift but stops you.
- **Jump** leaps short gaps between beams, and the landing kicks the needle by a random ±30% (the seed is fixed per level).
- **The hero** carries a long balance pole whose ends visibly dip with the lean.

Elements:
- ropes (code tube, sag 0.4 m)
- balance beams (`m2BalanceBeam`)
- rotating beams, which spin around their long axis at 20°/s and push the needle in the spin direction
- swinging sandbags (`m2SwingSandbag`)
- drifting rafts (`m2RaftPlatform`) on the river far below, as rest spots

**Board:** time.
**Why it's different from:**
- *31 Wall Run Temple* is fast flow where stopping means falling. Here you live in a slow, precise loop of control, and stopping is a tactic.
- *37 Plate Surf* and *35 Color Rail Grind* are about riding momentum. Here you counter a continuous balance force, with no momentum to ride.
**Hero roles:**
- **Riko:** dashes across a whole rope segment in 0.4 s, ignoring the lean, but only on the cracked-plank "dash ropes".
- **Nami:** double-jumps from rope to rope when two ropes run at different heights, reaching the high rope with orbs.
- **Kiro:** shields through a gust zone, so the needle does not drift for 3 s (lead hero).
- **Zuno:** his magnet pulls coin arcs up from the river mist below.
- **Vexa:** phases through the ghost bridge (an invisible plank route) that holds the shard.
**Levels:**
- **L1 Wide Beams** (6 elements; teaches in 3 beats):
  1. A wide plank bridge (`plankBridge.glb`) with a slow needle.
  2. A narrow beam where you must correct the needle.
  3. A short rope with a gentle gust.
  Target 60 s.
- **L2 Narrow Beams**, twist: *gusts*. Wind is telegraphed by leaves and mist streaks blowing 1 s ahead, and pushes the needle ±60% over 1.5 s.
- **L3 Moving Beams**, twist: *swinging sandbags* (period 2.5 s) and *swaying ropes* that sway with any other walker or bird landing on them.
- **L4 Rotating Path**, twist: *rotating beams* plus *night fog*. You see only 8 m of rope ahead, lit by lookout tower torches (`m2LookoutTower`).
- **L5 Balance Master**, boss **"Umbra"** rope joust (`m2ShadowArmadillo`). He walks the same rope towards you.
  - *P1:* he stomps every 3 s, sending a sway wave along the rope. Crouch at the right moment to ride it, then stomp back when he is mid-wave, which makes him wobble 3 times and he retreats a rope.
  - *P2:* he cuts strands, so the rope sags and the needle drifts faster. Cross to the beam where he waits and shove (Action) when his needle tips, 2 hits.
  - *P3:* on a rotating beam over the gorge, you both balance. Out-balance him for 10 s while he throws plates, then a final shove gives a slow-mo fall into the mist (he escapes by gliding off: no harm).
**Stars:** clear / all orbs / target time (L1 60 s to L5 180 s), plus a "never wobbled" badge.
**Secrets:**
- **"Steady Hands":** cross a level without the needle passing ±50%. Reward: a sticker.
- **Vexa's ghost bridge** holds a shard.
- **A hidden lookout tower** where a crouch-wait for 5 s on its rope lets a bird land on your pole and reveals a hidden rope to a canopy shortcut.
**Juice moments:**
- The camera slowly tilts with the needle (max 6°).
- Creaking rope sounds grow with the lean.
- Mist drifts beneath you, and a catch-yourself "gasp" plays on wobble recovery.
- Green leaves sprout along the rope behind you.
- Combo: clean elements crossed (no wobble).
**Multiplayer (1-4):**
- **Co-op (best fit):** a shared rope. Each hero's walk sways the rope for everyone, so you must coordinate stepping. A co-op-only "counterweight" lets two heroes on a seesaw beam balance each other.
- **Versus race:** parallel ropes.
- **Party:** "rope push," a last-hero-standing on one beam.
- Camera: shared side camera for co-op; split screen per rope for a 2-player versus.
**Assets:**
- Reuse from `tightrope-path/`: `m2LookoutTower`, `m2RaftPlatform`, `m2RockPillarBg`, `m2SwingSandbag`.
- Reuse from root: `plankBridge.glb` (wide beams) and `checkpointBeacon.glb`.
- Reuse shared: `m2ShadowArmadillo` (Umbra), heroes.
- New, **MUST L1:** `m2BalanceBeam`, the narrow mossy stone-and-wood beam that is the core element.
- New, NICE: `m2BalancePole`, the held pole (a code cylinder with bronze end caps works as fallback).
**Risks:**
- **Balance meters can be boring.** Fix: every element has a different force pattern (gust, sway, spin, stomp), the sprint option gives a risk-reward line for speed, and levels are short (6–15 elements).
- **Unfair random landings.** Fix: the landing kicks are seeded per level, so the same jump always kicks the same way and can be learned.

---

## Notes for the shared systems

The W3 games need these from the shared systems:
- **`boss`:**
  - A **segmented serpent chain**: N instanced `m2CoilstoneSegment` copies following a head along a spline path (a follow-the-leader buffer). Hit flash and plate states apply per segment.
  - Coilstone is used by 16, 34 and 36, so build it once.
  - Boss fights driven by beats or coins: a phase can advance on an external counter (paid coins in 16, perfect echoes in 36), not only on hits.
- **`audio`:**
  - A **beat clock** on the WebAudio timeline, with a latency calibration saved per device.
  - A per-world stem set (base + 3 layers) that later levels unlock.
  - The beat clock is shared by 36 and, optionally, as a backing rhythm in 16 (the spike tiles on the beat).
- **Light volume system for 6:** a cheap "is point inside any lit sphere" query (max 12 lights, CPU-side) that drives ledge solidity in `rules.ts`, plus a fake-light shader (emissive + vertex fade) instead of real point lights, to stay within 50 draw calls and the phone budget.
- **Pendulum helper for 8:** deterministic swing integration with variable length (grip slide), fixed dt, in `core/math`-style pure code. It could also serve 45 Sky Hook Swing (W2) with a fixed length.
- **Helix movement for 34:** the hero locked onto a helix (angle + pitch), plus camera orbit with an eased yaw. A "fixed camera" accessibility setting is needed.
- **Balance meter for 47:** a reusable needle/meter HUD widget (also usable for a W4 rail-grind lean if wanted).
- **Run economy for 16:** coins counted, spent and banked inside the run, with the `maxScore` proof counting placed coins only.
- **Projectile with banks for 40:** reflection off tagged collider boxes plus a return arc, and a touch aim preview limited to the first segment (decision 7: aim help only).
- **`combo`:** the combo meter must accept game-specific chain events (a lantern chain, catch-to-catch, wall kicks, laps, Perfects, clean catches, clean elements) with per-game windows.
- **Hero gating in rhythm and throw games:** the `powers` helpers must work outside platforming. Examples: Kiro's shield absorbs a combo-breaking miss in 36, and Vexa's phase applies to a projectile in 40.

---

## Hyper3D models needed

What every game reuses is listed in each card's **Assets** line. Only the truly missing models are below. The shared heroes (`m2HeroRiko/Nami/Kiro/Zuno/Vexa`) are used by every game and are not repeated.

### Shared W3 boss: Coilstone (used by 16, 34, 36)
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2CoilstoneHead | boss | MUST for L2–5 | Stylized giant serpent head made of carved jade and weathered sandstone for a premium mobile/browser arcade game, ancient lost-civilization temple guardian, geometric stone scales with moss and small roots, glowing jade eyes, mouth slightly open with stone fangs, a short neck stump cut flat at the back so body segments can attach, original design, not resembling any existing franchise, neutral pose facing forward, plain light-grey background, clean low-poly game-ready geometry, no text, no logos |
| m2CoilstoneSegment | boss | MUST for L2–5 | Stylized single body segment of a giant stone serpent for a premium mobile/browser arcade game, a thick round ring of carved jade and sandstone scales with moss in the cracks, flat circular front and back faces so copies chain together, slightly tapered, ancient lost-civilization style, original design, not resembling any existing franchise, plain light-grey background, clean low-poly game-ready geometry, no text, no logos |

### 6 Temple Lantern Jump
Reuses: `m2TempleLantern`, `m2LanternDeck`, `m2TempleLedge`, `m2TempleBeam`, `m2WoodenBalcony`/`V2`, `m2StoneBrazier`, `m2RuinRoofSection`, `m2TempleTowerBg`, `m2CaveBat`, `checkpointBeacon`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2StoneCageLantern | prop | NICE | Stylized ancient stone-and-bronze cage lantern on a short wall bracket for a premium mobile/browser arcade game, carved sandstone top and base, bronze bars, a warm glowing ember core, jungle lost-civilization temple style, not paper, not East-Asian, clean low-poly game-ready geometry, no text, no logos |

### 8 Jungle Vine Jump
Reuses: `m2JungleVine`/`V2`, `m2BranchPlatform`/`V2`, `m2LeafPlatform`/`V2`, `m2MossyRuinArch`, `m2RuinStone`, `m2SnapperPlant`, `m2JungleEmerald`, `m2GiantJungleTreeBg`, `m2JungleMonkey`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2JungleFruitPod | prop | NICE | Stylized round spiky jungle fruit pod for a premium mobile/browser arcade game, harmless cartoon projectile, green-orange husk with leaf stem, soft rounded spikes, clean low-poly game-ready geometry, no text, no logos |

### 16 Temple Coin Rush
Reuses: `m2TempleGate`, `m2TempleCoin`, `m2BrokenTile`, `m2SpikeTrapTile`, `m2FireJetPillar`, `m2RollingBoulder`, `m2StoneObstacle`, `m2StepPyramidBg`, plus `m2CoilstoneHead`/`Segment`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2OfferingBowl | prop | NICE | Stylized ancient stone offering basin on a short carved pedestal for a premium mobile/browser arcade game, wide shallow bowl of weathered sandstone with jade inlay rim and a few gold coins inside, jungle lost-civilization style, no real-world religious symbols, clean low-poly game-ready geometry, no text, no logos |

### 31 Wall Run Temple
Reuses: `m2TempleWall`/`V2`, `m2WallRunMarker`, `m2StoneColumn`, `m2TempleGapPlatform`, `m2WallSpikePanel`, `m2GoldRingOrb`, `m2CliffTempleBg`, `m2ShadowArmadillo`, `checkpointBeacon`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2SwingingStoneRam | prop | NICE | Stylized carved stone battering ram log hanging from two short bronze chains for a premium mobile/browser arcade game, rounded blunt ends, moss and vines, ancient jungle temple trap, harmless rounded shapes, clean low-poly game-ready geometry, no text, no logos |

### 34 Spin Pole Climb
Reuses: `m2RotatingPole`/`V2`, `m2GripLedge`, `m2CircularPlatform`, `m2MushroomCapTop`, `m2SweeperBar`, `m2CheckpointDisc`, `m2SpiralTowerBg`, `m2TempleGong` (from 36), plus `m2CoilstoneHead`/`Segment`.

Nothing new needed.

### 36 Temple Gong Timing
Reuses: `m2TempleGong`, `m2StrikerPost`, `m2TimingRing`, `m2GongStage`, `m2CeremonyDrum`, `m2RuinLanternPillar`, `m2JungleRuinBg`, plus `m2CoilstoneHead`/`Segment`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2GreatGong | set-piece | NICE | Stylized giant bronze gong in a massive carved sandstone arch frame for a premium mobile/browser arcade game, ancient jungle lost-civilization temple, geometric carvings without real-world religious symbols, moss and hanging roots, jade inlays, clean low-poly game-ready geometry, no text, no logos |

### 40 Disc Target Throw
Reuses: `m2HayBaleTarget`, `m2PalisadeWall`, `m2ScoreMarkerPost`, `m2TrainingPavilionBg`, `m2StoneColumn` (31), `m2RaftPlatform` (47), `m2SnapperPlant`, `m2JungleMonkey`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2TrainingDisc | prop | MUST for level 1 vertical slice | Stylized harmless flying training disc like a sports flying disc for a premium mobile/browser arcade game, smooth rounded rim, thick soft edge, carved jade-green and sandstone pattern ring on top, no blades, no points, not a weapon, clean low-poly game-ready geometry, no text, no logos |
| m2StoneIdolTarget | prop | NICE | Stylized round stone ring target on a short carved pedestal for a premium mobile/browser arcade game, concentric jade and sandstone rings with a glowing centre, ancient jungle ruin style, no real-world religious symbols, clean low-poly game-ready geometry, no text, no logos |

### 47 Tightrope Path
Reuses: `m2LookoutTower`, `m2RaftPlatform`, `m2RockPillarBg`, `m2SwingSandbag`, `plankBridge`, `checkpointBeacon`, `m2ShadowArmadillo`.
| id | type | priority | Hyper3D prompt |
|---|---|---|---|
| m2BalanceBeam | prop | MUST for level 1 vertical slice | Stylized long narrow balance beam for a premium mobile/browser arcade game, an old squared wooden log with carved sandstone end blocks, moss patches and a clear flat walkable top, rounded edges, jungle ruin style, neutral materials, clean low-poly game-ready geometry, no text, no logos |
| m2BalancePole | prop | NICE | Stylized long wooden balance pole for a premium mobile/browser arcade game, straight light wood shaft with rounded bronze weight caps on both ends, wrapped grip in the middle, harmless, clean low-poly game-ready geometry, no text, no logos |

### Total
- **MUST for level 1 vertical slice: 2** (`m2TrainingDisc`, `m2BalanceBeam`)
- **MUST for L2–5: 2** (`m2CoilstoneHead`, `m2CoilstoneSegment`)
- **NICE: 7** (`m2StoneCageLantern`, `m2JungleFruitPod`, `m2OfferingBowl`, `m2SwingingStoneRam`, `m2GreatGong`, `m2StoneIdolTarget`, `m2BalancePole`). Each one already has a fallback (a primitive or a scaled ready model), so none of them blocks a build.

Every other boss is a reused, scaled and tinted ready model: the Soot Bat Queen (`m2CaveBat`), the Howler King (`m2JungleMonkey`), Mother Snapper (`m2SnapperPlant`) and Umbra (`m2ShadowArmadillo`).
