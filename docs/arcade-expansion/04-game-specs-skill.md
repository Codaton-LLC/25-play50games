# Deliverable D (part 2): Game specifications, Collection "Skill" (games 11–20)

Conventions, common testing criteria and the common Definition of Done are in `03-game-specs-adventure.md` (top). Every number is a tuning starting point **[A]**.

---

## 11. Mini Golf 3D (`mini-golf`): Claude · wave 2 · complexity 4

**Director's call.** Physics engine only if it pays (D6): by default the ball is a deterministic circle on a course made of a few tile types (flat, ramp, bowl, gap, tunnel), integrated in fixed sub-steps in `rules.ts`. That keeps strokes reproducible and testable; the owner may still choose Rapier at G0 if the design README shows it is clearly better (the limit proof then counts strokes, not physics). Six holes per run (not nine) keep a session near 3 minutes; a seeded "course of the day" order adds variety.

1. **Concept.** Six bite-size toy holes with ramps, tunnels and a spinning windmill: drag, aim and sink it in as few strokes as possible.
2. **Core loop.** Look at the hole → drag back from the ball (direction + power, preview to the first bounce) → release → watch it roll, bank and drop → next hole.
3. **Objective.** Finish all 6 holes (`end("win")`). Each hole caps at par + 4 strokes (the ball is picked up). No timer; the run's duration window is wide.
4. **Controls.** Desktop: drag with the mouse from anywhere (aim-drag), or arrows aim + hold Space to charge, release to putt. Touch: drag anywhere (aim-drag). `touchControls: []` (canvas gesture only). Scheme `aim-drag` (new).
5. **Camera.** Per-hole fitted static camera that shows the whole hole (`useFittedView` with the hole's bounds), a gentle follow for long holes; a short fly-over between holes during the result-free transition.
6. **Mechanics.**
   - Ball: radius 0.06 m (drawn 1.5× for readability), integrated at 240 Hz sub-steps; rolling friction, slope acceleration from the tile's height function, restitution 0.75 on rails (`core/kinematics` circle vs segment), airborne off a ramp lip (ballistic), landing with a bounce.
   - Moving obstacles: windmill blades (rotating segments), sliding gate (moving AABB), a turntable (rotating floor adds tangential velocity).
   - Tunnels: entry → exit with the same speed (a path segment).
   - Hole: captured if the speed is < 1.2 m/s within the cup radius (faster balls lip out with a deflection).
   - Water hazard: +1 stroke, ball back to the last rest point.
   - Scoring: per hole 100 × (par + 3 − strokes) (min 0), hole-in-one +200; total over 6 holes.
7. **Difficulty progression.** Holes ordered easy → hard (straight → bank → ramp + gap → windmill → tunnel maze → turntable finale).
8. **Replayability.** 10 designed holes; each run draws 6 in a seeded order with mirrored variants; best score and leaderboard; hole-in-one hunting.
9. **Duration.** 2–4 minutes.
10. **Level design.** Floating toy islands, one per hole, connected visually; felt greens with wooden rails, trees and rocks around, water between islands.
11. **Visual direction.** Windmill (A) with procedural blades; flag (D checkpoint-flag, tinted red by material override); ball procedural white with dimple normal map from canvas; s:leafyTree, s:rock; core `<Water>` between islands; trajectory dots (P1-D `<TrajectoryDots>`). Palette: felt `#4ade80` → `#16a34a`, rails `#a16207`, water `#38bdf8`, sky `#e0f2fe`, accent `#86efac`. Lighting `day`. Effects: confetti on a hole-in-one, splash, cup sparkle, power meter ring.
12. **Audio.** Putt tap (pitch by power), rail clack, cup rattle, splash, applause chime on birdie or better.
13. **Performance.** ≈ 40 draw calls (only the current hole and its neighbour are mounted); sub-stepping is cheap (one ball, ≤ 40 segments).
14. **Accessibility.** Preview line, power ring with numbers, keyboard aiming in 1° steps, "mulligan" disabled for ranking but a practice mode is not in scope (v1).
15. **Complexity.** 4 (physics tuning and hole design).
16. **Estimated work.** 18–28 agent-hours; review 4 h; you 2 h.
17. **Dependencies.** P1-C (`kinematics`, `ballistics`), P1-D (aim-drag, `<TrajectoryDots>`, material override), P1-B (`<Water>`, fx); assets windmill (batch 2), checkpoint-flag, s:leafyTree, s:rock.
18. **Testing criteria.** Rules: determinism of a putt across frame rates (30 / 60 / 144 fps give the same rest point within 1 mm), energy never grows on rails, every hole has a solution within par (a solver test), lip-out rule, scoring proof. Visual: preview matches the real first segment. Perf: ≤ 45 draw calls.
19. **Definition of Done.** Common DoD + every hole is completable by a novice within par + 4 (playtest).

---

## 12. Robot Factory Sorter (`robot-factory`): Kimi · wave 2 · complexity 2

**Director's call.** A second conveyor sorter would duplicate Luggage Rush. This one **assembles**: grab the parts the blueprint asks for, in order, and scrap the faulty ones. The payoff is the shared robot GLB stepping off the line and walking away with the auto-rig.

1. **Concept.** Build robots on a humming assembly line: grab the right parts off the conveyor in the order the blueprint asks, and scrap the faulty ones.
2. **Core loop.** Read the blueprint (3–5 parts) → when a matching part enters the grab zone, grab it → it snaps onto the ghost robot → when complete the robot walks off → next blueprint; swipe sparking parts into scrap.
3. **Objective.** Score as much as possible in 90 s (`timeup`). Three faulty parts installed end the run (`end("lose")`).
4. **Controls.** Desktop: Space grabs the part in the grab zone, Down / S scraps it; or click a part to grab it. Touch: tap a part (`tapDown`) to grab, swipe down on the grab zone to scrap (`pressed.down`). `touchControls: ["tap", "swipe"]`. Scheme `tap-target`.
5. **Camera.** Fixed side 3/4 view of the conveyor and the assembly station (fitted, landscape and portrait yaws).
6. **Mechanics.**
   - Conveyor = `core/path` with parts riding by arc length; grab zone = an interval of arc length.
   - Part kinds: head (dome, box, antenna), torso (barrel D, crate D), power cell (battery D), arms (claw, tool); colours by per-copy tint.
   - Stream generator guarantees the next needed part appears within 4 s, plus distractors and faulty parts (sparking).
   - Grab a wrong part: it bounces back onto the belt, combo reset, 0.5 s lockout. Grab a faulty part: strike.
   - Scoring: +20 per correct part × combo (+0.2 per correct, max ×2), +200 per finished robot.
7. **Difficulty progression.** Belt speed +4 % per robot, blueprints 3 → 5 parts, more distractors and faults, two belts merging at 60 s.
8. **Replayability.** Seeded blueprints and streams; combo chains.
9. **Duration.** 90 s.
10. **Level design.** One factory bay: belt from left to right, grab zone with a procedural robot arm, assembly cradle, exit door for finished robots, scrap bin.
11. **Visual direction.** Parts procedural plus reused props (barrel, crate, battery, D) tinted; the finished robot = shared robot GLB drawn with the blueprint's colour through the `tint` prop on `<HumanoidModel>` (P1-D), walking off with `<HumanoidModel>` (walk by `walkStride`, a wave with `reachPose`). Procedural robot arm (instanced segments) animates each grab. Palette: factory `#1e293b`, belt `#475569`, parts `#7dd3fc` / `#fbbf24` / `#f87171` / `#a3e635`, sparks `#fde047`, accent `#7dd3fc`. Lighting `indoor`. Effects: snap flash, sparks on faulty parts (fx `sparks`), steam vents.
12. **Audio.** Belt hum loop, grab clunk, snap click, fault zap, robot "boop-beep" on completion.
13. **Performance.** ≈ 35 draw calls; parts pooled per kind; one skinned robot at a time (two during the hand-over).
14. **Accessibility.** Blueprint icons with shape + colour; the needed part highlighted on the belt; faulty parts spark **and** blink; slower first robot.
15. **Complexity.** 2.
16. **Estimated work.** 8–12 agent-hours; review 2 h; you 1 h.
17. **Dependencies.** P1-C (`path`), P1-D (per-copy tint, kit conveyor), P1-B (fx sparks, audio loop); no new Hyper3D asset; robot, battery, barrel, crate.
18. **Testing criteria.** Rules: grab-zone timing, stream guarantees for 1,000 seeds, wrong/faulty handling, scoring proof (oracle bot). Visual: the walking robot leaves cleanly (feet planted). Perf: ≤ 40 draw calls.
19. **Definition of Done.** Common DoD + a full robot always completes before the next blueprint appears.

---

## 13. Pirate Cannon Battle (`pirate-cannons`): Claude · wave 1 · complexity 3

**Director's call.** This is the reference for the aim-and-release family (mini-golf reuses the aim-drag; snowballs, castle, the zoo distraction and the drone drop reuse the ballistics). Keep it tight: one fort cannon, ships on lanes, **wind** that changes every wave and a **partial** arc preview (you see the first 40 % of the flight), so long shots are a skill. Floating powder barrels give chain-reaction moments.

1. **Concept.** Man a seaside fort's cartoon cannon: drag to aim, read the wind, and sink pirate ships before they reach the harbour.
2. **Core loop.** Pick a target → drag to aim (yaw + elevation) → read the wind vane → release → splash or hit → reload (1.2 s) → next.
3. **Objective.** Survive 90 s (`timeup`) with at least one of 3 harbour lives; a ship reaching the harbour costs a life; 0 lives = `end("lose")`.
4. **Controls.** Desktop: drag with the mouse (horizontal = yaw, vertical = elevation), release fires; or arrows aim + Space fires. Touch: drag anywhere, release fires. `touchControls: []`. Scheme `aim-drag` (new).
5. **Camera.** Fixed over-the-shoulder behind the cannon, low pitch looking out to sea, fitted so the farthest lane and the harbour are on screen; a short recoil shake.
6. **Mechanics.**
   - `core/ballistics`: muzzle speed 28 m/s, gravity 9.8, wind as a constant horizontal acceleration (±3 m/s²), no drag.
   - Ships sail on `core/path` lanes at 3 distances (25 / 40 / 55 m), bob on the water; hit test = cannonball sphere vs 2–3 spheres per ship.
   - Ship types: dinghy (1 HP, fast), sloop (2 HP), galleon (3 HP, slow, zig-zag).
   - Powder barrels (D barrel) float; hitting one explodes (radius 6 m) and damages ships in range.
   - Scoring: dinghy 100, sloop 200, galleon 300; +50 per 10 m beyond 30 m; chain bonus +100 per extra ship in a barrel blast; combo ×1.5 on 3 consecutive hits.
7. **Difficulty progression.** Waves every 20 s: more ships, faster, zig-zag paths, the wind range grows.
8. **Replayability.** Seeded waves and wind; long-range and chain bonuses.
9. **Duration.** 90 s (or less on a loss).
10. **Level design.** A cove: the fort parapet in front, open sea with three lanes, a palm island (D palm) as an obstacle that blocks low shots, the harbour mouth to the right.
11. **Visual direction.** Cannon (A, shared with castle-defender) with a recoil animation (procedural slide + barrel kick); ship (A), sail colours varied by procedural sail planes and flag attachments, sinking animation (tilt + sink + bubbles); barrels and crates (D) floating; chest (s:chest) as a rare bonus floating target. Core `<Water>` with foam on ship hulls; sky dome. Palette: sea `#0ea5e9` → `#0369a1`, sand `#fde68a`, stone `#a8a29e`, sails `#f8fafc` / `#fca5a5`, accent `#f87171`. Lighting `day`. Effects: muzzle smoke, splash columns, wood debris, explosion puff, floating score.
12. **Audio.** Boom (with a low thump), whistle in flight, splash, wood crack, ship bell at each wave, seagull ambience loop (quiet).
13. **Performance.** ≈ 40 draw calls; ships pooled (≤ 8), cannonballs and debris pooled.
14. **Accessibility.** Wind shown as an arrow with a number; the preview arc; a landing marker on the water for the previewed part; aim snaps to 0.5° steps on keyboard.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h (adversarial review by a second Claude session); you 1.5 h.
17. **Dependencies.** P1-C (`ballistics`, `path`), P1-D (aim-drag, `<TrajectoryDots>`, attachments for flags), P1-B (`<Water>`, fx, audio); assets ship, s:cannon, s:chest (batch 1), barrel, crate, palm.
18. **Testing criteria.** Rules: ballistic integration vs the analytic solution (< 1 cm at 55 m), wind effect, ship hit spheres, barrel blast radius, wave schedule, scoring proof (oracle bot with perfect lead). Visual: aim drag feels 1:1 on a phone. Perf: ≤ 45 draw calls.
19. **Definition of Done.** Common DoD + its README documents the aim-drag tuning that golf, snowballs and castle reuse.

---

## 14. Castle Defender (`castle-defender`): Codex · wave 3 · complexity 4

**Director's call.** A full tower defence is too big. This is a **wall-cannon defence**: tap where you want the shot to land (the core solves the arc), goblins march on three paths, a rock drop clears ladders, and between waves you pick one of two upgrades. Goblins are a pooled solid model with a hop-march, so 40 of them cost 1–2 draw calls.

1. **Concept.** Hold the castle wall against waves of bumbling cartoon goblins: tap to fire the wall cannon, drop rocks on ladders and keep the gate standing.
2. **Core loop.** Goblins advance → tap ahead of a group (lead them) → splash → ladder crews reach the wall → drop a rock (cooldown) → wave cleared → choose an upgrade.
3. **Objective.** Survive 5 waves (`end("win")`, ≈ 150 s). Gate health 0 = `end("lose")`.
4. **Controls.** Desktop: click a point on the field to fire there; or arrows move a reticle, Space fires; E drops a rock on the most threatened ladder; 1 / 2 pick an upgrade (`InputState.digit`, P1-D). Touch: tap the field (`tapDown`), Action = rock drop, tap an upgrade card. `touchControls: ["tap", "action"]`. Scheme `tap-target`.
5. **Camera.** Fixed high view from behind the wall, fitted to the field, the wall and the gate.
6. **Mechanics.**
   - Fire: `core/ballistics` solves the launch for the tapped point (flight 0.6–1.0 s); splash radius 2 m; reload 0.8 s.
   - Goblins: pool of 40 on 3 `core/path` routes; types: walker (1 HP), shield (2 HP, front hits do half), runner (fast), ladder crew (3 goblins carrying a ladder; if it reaches the wall, they climb and damage the gate).
   - Rock drop: clears one ladder and its climbers (cooldown 8 s).
   - Upgrades (pick 1 of 2 after waves 1–4): reload −20 %, splash +30 %, gate +25 % health, double shot.
   - Scoring: +20 per goblin, +200 per wave cleared, on win +2 per gate health point.
7. **Difficulty progression.** Wave table: 8 → 30 goblins, new types per wave (shield at 2, runners at 3, two ladder crews at 4, a mixed finale).
8. **Replayability.** Seeded wave order inside the table; upgrade choices change the run.
9. **Duration.** 120–160 s.
10. **Level design.** A green field narrowing to the castle; three paths (road, river bank, forest edge); the wall with the cannon in the centre and two castle towers.
11. **Visual direction.** Goblin (A, ≤ 4.5k tris, pooled `<DynamicInstancedModel>` with per-copy tint per type, hop-march from `core/motion`), castle tower (A, shared with knight-arena) ×2, wall procedural (crenellated, stone canvas), gate = door (D) scaled, cannon (s:cannon), trees and rocks (shared). Palette: grass `#65a30d`, stone `#a8a29e`, goblins `#84cc16` / `#a3e635` with tints, banners `#3b82f6`, accent `#94a3b8`. Lighting `day`. Effects: impact dust ring, goblins tumbling (flail spin), ladder splinters, wave banner.
12. **Audio.** Boom, impact thump, goblin "hup" chirps (synth), ladder crash, wave horn, gate thud.
13. **Performance.** ≈ 50 draw calls with 40 goblins (pooled), projectiles pooled.
14. **Accessibility.** Landing marker under the reticle; threatened ladders flash; gate health bar; generous tap snapping to the nearest goblin group on coarse pointers.
15. **Complexity.** 4.
16. **Estimated work.** 18–28 agent-hours; review 4 h; you 2 h.
17. **Dependencies.** P1-C (`ballistics`, `path`, `motion`), P1-D (per-copy tint), P1-B (fx); assets goblin, s:castleTower (batch 3), s:cannon, door, s:rock, s:leafyTree.
18. **Testing criteria.** Rules: launch solver hits the tapped point, splash maths, wave table, upgrades, gate damage, scoring proof (oracle bot). Gameplay: wave 5 is winnable without the double-shot upgrade. Perf: ≤ 60 draw calls at 40 goblins.
19. **Definition of Done.** Common DoD + 40 goblins on screen keep the frame-time budget on the mid-phone profile.

---

## 15. Penguin Ice Slide (`penguin-slide`): Codex · wave 1 · complexity 3

**Director's call.** An endless downhill run in **track space** (distance along a spline + lateral offset), like office-escape's lanes but analog. Banked turns, ramps with spin tricks and checkpoint gates that add time keep it fresh without physics.

1. **Concept.** Belly-slide a penguin down a twisting glacier: carve between ice blocks, launch off ramps and slurp up fish.
2. **Core loop.** Carve left/right → line up fish trails → hit ramps for air and spin tricks → pass time gates → speed rises until you run out of time.
3. **Objective.** Go as far as possible: start with 30 s, each gate +8 s (a game-local clock in `rules.ts`, no `durationMs`; at 0 the game calls `end("timeup")`). Three crashes = `end("lose")`.
4. **Controls.** Desktop: A / D or left / right steer (analog by hold time), Space hop; in the air left / right spins. Touch: joystick x steers (or drag anywhere: pointer x), Jump button hops. `touchControls: ["joystick", "jump"]`. Scheme `steer` (new).
5. **Camera.** Chase camera behind and above (pitch ≈ 25°), rolls slightly into banked turns, pulls back with speed; fog hides the generation edge.
6. **Mechanics.**
   - Track: seeded sequence of segments (straight, curve, S-bend, ramp, narrow, split) along `core/path` (Catmull-Rom spline); position = (s, d) with lateral limit per segment.
   - Speed: 8 → 22 m/s with slope and time; carving costs 2 % speed per second of hard turn.
   - Obstacles: ice blocks, snowmen, cracks (hop over); collision in track space (`circlesOverlapXZ` on (s, d)); crash = 1 s tumble, speed reset to 60 %.
   - Ramps: automatic launch, airtime 0.6–1.2 s; spins: each 360° = +50, landing within 30° of straight or it is a crash.
   - Fish: lines and arcs; magnet-free.
   - Scoring: +1 per metre, +10 per fish, tricks +50 per spin (+100 for a double).
7. **Difficulty progression.** Speed ramp, narrower segments, more obstacles per 100 m, gates further apart.
8. **Replayability.** Seeded tracks; trick and fish optimisation; leaderboard.
9. **Duration.** 45–180 s.
10. **Level design.** Glacier valley: ice track with snow banks, pine forests, ice caves (tunnels), a frozen lake section, finish-style gates with flags.
11. **Visual direction.** Penguin (A, shared; solid model rotated onto its belly with flippers out, bank and squash from `core/motion`), fish (s:fish, instanced), s:pineTree (instanced per chunk), ice blocks (procedural translucent boxes with a fresnel shader), snowmen procedural, gates with checkpoint flags (D, tinted blue). Track mesh extruded along the spline with an ice canvas texture and sparkle. Palette: ice `#e0f2fe` → `#7dd3fc`, snow `#f8fafc`, pines `#14532d`, fish `#f97316`, sky `#bae6fd`, accent `#67e8f9`. Lighting `snow`. Effects: ice spray at the sides when carving, snow puff on landing, speed lines, fish sparkle.
12. **Audio.** Slide swish loop (pitch with speed), carve scrape, fish gulp, ramp whoosh, landing thump, gate chime, crash bonk.
13. **Performance.** ≈ 50 draw calls; track generated in chunks of 60 m (3 live), trees and obstacles instanced per chunk; chunk recycling (no growth in geometries).
14. **Accessibility.** Hazards outlined in coral, fish lines lead to the safe line; auto-hop on cracks on coarse pointers (assist toggle in the README; on by default for touch).
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`path` splines, `motion` bank/squash), P1-B (`snow` preset, fx, audio loop); assets s:penguin, s:fish, s:pineTree (batch 1), checkpoint-flag.
18. **Testing criteria.** Rules: generator never makes an impossible segment (a solver bot with full lookahead survives 3 minutes on 500 seeds), speed curve, trick landing rule, gate timing, scoring proof (pps bound with the fastest legal play). Visual: the penguin hugs the banked track. Perf: ≤ 55 draw calls, geometries flat over 3 minutes.
19. **Definition of Done.** Common DoD + a 3-minute run keeps memory flat (perf probe).

---

## 16. Space Repair Mission (`space-repair`): Antigravity · wave 3 · complexity 3

**Director's call.** Zero gravity is the identity: **inertia movement** (you drift) plus a **timing ring** for each repair. A gentle auto-brake (on for touch) keeps it family-friendly.

1. **Concept.** Jetpack around a tiny space station in zero gravity and fix sparking modules before the station's power runs out.
2. **Core loop.** A module breaks (sparks, red blink, off-screen arrow) → thrust over, braking early → hold position at the module → hit Action when the needle crosses the green arc (1–3 times) → fixed → next.
3. **Objective.** Keep station power above 0 for 120 s (`timeup` = survival). Power 0 = `end("lose")`.
4. **Controls.** Desktop: WASD thrust (screen-relative); E / Space repair timing. Touch: joystick + Action. `touchControls: ["joystick", "action"]`. Scheme `joystick` + timing.
5. **Camera.** Follow top-down tilted (pitch ≈ 60°) around the station ring, fitted with `followFocus`.
6. **Mechanics.**
   - Movement: 2D inertia, thrust 6 m/s², max 7 m/s, auto-brake 3 m/s² when no input (assist).
   - Collisions with modules and solar panels: bounce with 0.5 restitution, 0.5 s wobble.
   - Breakdowns seeded; each broken module drains 1 power/s (power 100 at start).
   - Repair ring: needle rotates (1.2 → 0.8 s per turn), green arc 60° → 35°; 1–3 hits needed by module size; a miss costs 0.5 s.
   - Debris drifts on `core/path` lanes; hitting it knocks you back.
   - Scoring: +100 per repair, +50 if all hits were perfect (centre third of the arc), +2 per power point left at 120 s.
7. **Difficulty progression.** Break interval 6 s → 2.5 s, simultaneous breaks, more debris, faster needles.
8. **Replayability.** Seeded breakdown schedules; perfect chains.
9. **Duration.** 60–120 s.
10. **Level design.** A ring station of 8 modules around a hub, two solar wings, a docking port, Earth below, starfield.
11. **Visual direction.** Astronaut (A, humanoid, auto-rig: floating idle with slow limb drift, arms forward when thrusting, a game-local `aimArm` reach toward the module while repairing), jetpack + wrench procedural attachments with flame fx; modules procedural (cylinders, domes, panels with canvas decals), Earth sphere with a canvas texture, core `<Starfield>`. Palette: hull `#e2e8f0`, panels `#1e3a8a`, warning `#f87171`, fixed `#34d399`, space `#020617`, accent `#818cf8`. Lighting `space` (new: one hard key, dim fill, rim). Effects: thruster puffs, sparks, repair flash, power-low red vignette (DOM).
12. **Audio.** Thruster loop, spark crackle (panned), repair ratchet, perfect ding, power alarm under 25 %.
13. **Performance.** ≈ 45 draw calls; one skinned character + attachments.
14. **Accessibility.** Off-screen arrows (`<TargetMarkers>`), the timing ring is big and has a tick sound per lap, auto-brake assist, the green arc widened on coarse pointers.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`path`, `kinematics`), P1-D (attachments, `<TargetMarkers>`), P1-B (`space` preset, `<Starfield>`, fx, audio loop); asset astronaut (batch 3), battery (power cells).
18. **Testing criteria.** Rules: inertia and braking, collision bounces, repair timing windows, drain maths, scoring proof (oracle bot). Visual: floating poses never look like a T-pose. Perf: ≤ 50 draw calls.
19. **Definition of Done.** Common DoD + a novice survives 60 s at the start difficulty (playtest).

---

## 17. Monster Kitchen (`monster-kitchen`): Kimi · wave 1 · complexity 2

**Director's call.** Orders are **sequences** with a **turntable**: ingredients sit on a lazy Susan that you rotate, so the skill is spatial memory and speed, not hunting. The v2 chef (yours) is the cook, reused with its existing poses.

1. **Concept.** Cook for a queue of hungry, picky monsters: spin the ingredient wheel and toss the right weird ingredients into the bubbling cauldron in order.
2. **Core loop.** Read the order bubble (3–5 icons in order) → rotate the wheel to bring the next ingredient in front → tap it → it arcs into the cauldron (colour shift) → order complete → the monster eats, dances and leaves a tip → next monster.
3. **Objective.** Score as much as possible in 90 s (`timeup`). Three monsters leaving angry = `end("lose")`.
4. **Controls.** Desktop: left / right (or A / D) rotate the wheel one slot, Space / Enter tosses the front ingredient; or click any visible ingredient. Touch: swipe left/right rotates (`pressed`), tap an ingredient tosses it (`tapDown`). `touchControls: ["swipe", "tap"]`. Scheme `tap-target`.
5. **Camera.** Fixed front view of the counter, the cauldron and the monster queue (fitted; portrait stacks the queue above the counter).
6. **Mechanics.**
   - Wheel with 8 slots; the front 3 are tappable; rotating takes 0.18 s per slot.
   - Ingredients: apple, banana, burger, sock, tinCan (D), fish (s:fish), eyeball and slime cube (procedural); refilled after use.
   - Orders seeded; patience bar per monster (drains 1/s, faster for grumpy types).
   - Wrong ingredient: cauldron burps (order restarts), patience −3.
   - Scoring: 100 × order length factor (3 → 1.0, 4 → 1.4, 5 → 1.9) + tip = 5 × patience left.
7. **Difficulty progression.** Longer orders, faster patience drain, the wheel drifts by itself at 50 s, two monsters ordering at once at 70 s.
8. **Replayability.** Seeded orders and monster types; tip optimisation.
9. **Duration.** 60–90 s.
10. **Level design.** A cosy cave kitchen: counter, the wheel on the left, the cauldron in the centre, the monster window at the back, shelves of jars (procedural).
11. **Visual direction.** Chef (D v2, `idlePose`, a game-local `aimArm` reach toward the wheel, cheer on a 5-order), monster (A: round blob with stubby arms, wobble and dance from `core/motion`, three variants by `tint` + procedural horns and hats as children of the monster's group at measured head points), cauldron (A) with a procedural liquid surface whose colour lerps with the order. Palette: cave `#3f3f46`, warm light `#fdba74`, cauldron liquid by order, monsters `#a78bfa` / `#4ade80` / `#f472b6`, accent `#f472b6`. Lighting `indoor` warm. Effects: steam, bubbles, splash on toss, burp cloud, confetti tip.
12. **Audio.** Plop, bubbling loop, burp, wheel click, happy monster chirp, grumpy grumble (synth).
13. **Performance.** ≈ 35 draw calls; ingredients instanced per kind; one skinned chef.
14. **Accessibility.** Ingredient icons in the order match the 3D items and carry a shape outline; patience as a bar and a face; rotation also by tapping the side arrows.
15. **Complexity.** 2.
16. **Estimated work.** 8–12 agent-hours; review 2 h; you 1 h.
17. **Dependencies.** P1-B (fx steam/bubbles, audio loop), P1-C (`motion`), P1-D (per-copy tint, attachments); assets monster, cauldron (batch 1), s:fish, chef, apple, banana, burger, sock, tinCan.
18. **Testing criteria.** Rules: order generation, wheel indexing, wrong-ingredient reset, patience, scoring proof (oracle bot with minimal rotations). Visual: the chef's reach meets the wheel. Perf: ≤ 40 draw calls.
19. **Definition of Done.** Common DoD + the order bubble never overlaps the HUD at 390 × 844.

---

## 18. Knight Training Arena (`knight-arena`): Antigravity · wave 2 · complexity 3

**Director's call.** "Hit moving targets" becomes a **direction-and-rhythm** game: targets light up around the knight with an arrow; you strike in that direction on the beat for combo multipliers. Wooden swords and training dummies keep it family-friendly.

1. **Concept.** A young knight trains on the castle green: strike each target in the direction it shows, on the beat, and build the biggest combo.
2. **Core loop.** A target lights up (direction arrow) → swipe or press that direction → the knight swings → hit → combo grows; a shield target needs two strikes; a "tomato" decoy must be left alone.
3. **Objective.** Highest score in 60 s (`timeup`).
4. **Controls.** Desktop: arrows / WASD strike in that direction (`pressed`), Space = spin attack when the meter is full. Touch: swipe in the direction (`pressed` includes swipes), Action = spin. `touchControls: ["swipe", "action"]`. Scheme `timing` (new).
5. **Camera.** Fixed 3/4 view around the knight in the ring centre, fitted to the ring radius.
6. **Mechanics.**
   - 8 target posts around the knight (4 directions × near/far; near for v1 directions, far ones need a step).
   - A seeded beat map at 100 → 130 BPM; a target is "on beat" within ±90 ms of its beat (±120 ms on coarse pointers).
   - Hit off-beat = 50 %; wrong direction = miss (combo reset); hitting a decoy = −50 and combo reset.
   - Combo multiplier +1 every 8 hits (max ×4); spin attack hits all lit targets.
   - Scoring: 10 per hit × combo (on beat ×2).
7. **Difficulty progression.** BPM ramps every 15 s; double targets, shields and decoys appear in later sections.
8. **Replayability.** Three seeded beat maps; combo chasing.
9. **Duration.** 60 s.
10. **Level design.** A round training ring with a wooden fence and banners, a castle backdrop (2 castle towers), trees.
11. **Visual direction.** Knight (A, humanoid, shared with museum-guard; auto-rig: game-local swing poses built from `aimArm` + `turnBone` in `poses.ts`, like penalty-hero's kick), wooden sword + shield attachments (procedural), dummy (A) on posts with a spring wobble, target discs procedural with canvas arrows. Palette: grass `#65a30d`, wood `#a16207`, banners `#facc15` / `#3b82f6`, armour `#cbd5e1`, accent `#facc15`. Lighting `day`. Effects: swoosh trail on the sword, hit sparks, combo text, confetti at ×4.
12. **Audio.** Metronome tick (soft, on beat), swoosh, thwack (pitch with combo), shield clang, decoy splat, fanfare at the end.
13. **Performance.** ≈ 40 draw calls; one skinned knight; dummies instanced.
14. **Accessibility.** Arrows on targets (shape, not colour), a beat ring that closes in on each target, wider timing windows on touch, metronome optional.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-D (attachments), P1-B (fx trail/sparks, audio), P1-C (`motion` for dummies); assets s:knight, dummy (batch 2), s:castleTower (batch 3; a procedural tower stands in until then), s:leafyTree.
18. **Testing criteria.** Rules: beat windows, direction matching, combo maths, decoys, scoring proof (perfect bot). Visual: each of the 4 swings reads clearly and the sword never passes through the head. Perf: ≤ 45 draw calls.
19. **Definition of Done.** Common DoD + input latency: a swipe registers within one frame of `pressed` (no `tap` wait).

---

## 19. Zoo Escape (`zoo-escape`): Claude · wave 3 · complexity 4

**Director's call.** Stealth for families: **visible vision cones**, bushes to hide in, and a **distraction toss** to lure a keeper. Keepers are on patrol loops (no pathfinding), which keeps the AI cheap and fair. Points, not time, so snacks on risky detours pay.

1. **Concept.** Help a mischievous panda sneak out of the zoo: hide in bushes, slip past the keepers' flashlight gaze and reach the gate.
2. **Core loop.** Watch the cones → move between bushes → toss a distraction to turn a keeper → grab snacks on the way → reach the stage exit → next stage → the gate.
3. **Objective.** Reach the gate after 3 stages (`end("win")`). Caught = back to the stage start with −5 s; 3 catches = `end("lose")`. 180 s timer kept in `rules.ts` (no `durationMs`, because catches change it; at 0 the game calls `end("timeup")`).
4. **Controls.** Desktop: WASD move; hold Space = sneak (slower, quieter); E = toss a distraction ahead (2 per stage). Touch: joystick + Jump (hold, sneak) + Action (toss). `touchControls: ["joystick", "jump", "action"]`. Scheme `joystick`.
5. **Camera.** Follow top-down (pitch ≈ 62°) so cones are readable, fitted to the stage with `followFocus`.
6. **Mechanics.**
   - Keepers: `core/ai/patrol` waypoint loops with pauses and look-arounds; vision = `ai/vision` cone (60°, 7 m → 9 m) with line of sight against walls and bushes; hearing radius 3 m (1.2 m while sneaking).
   - Alert: seen → suspicion meter fills (1.2 s to full); full = caught; partial → the keeper investigates the last seen point, then returns.
   - Bushes: inside = invisible (unless a keeper walks into the bush).
   - Distraction: a bamboo bundle thrown 4 m (`core/ballistics`); the nearest keeper within 10 m walks to it and looks for 3 s.
   - Snacks: bamboo sprigs on risky spots.
   - Scoring: +1,000 on escape, +10 per second left, +50 per snack, −100 per catch (min 0).
7. **Difficulty progression.** Stage 1 enclosure (1 keeper), stage 2 plaza (2 keepers, crossing cones), stage 3 parking lot at dusk (3 keepers, longer cones, a sweeping searchlight).
8. **Replayability.** Seeded patrol phases and snack spots; routes; leaderboard.
9. **Duration.** 90–180 s.
10. **Level design.** Three connected areas: panda enclosure (rocks, bamboo, moat bridge), visitor plaza (benches, bins, lamps, kiosks), parking lot (cars, D) with the exit gate.
11. **Visual direction.** Panda (A, solid, `core/motion` waddle + sneak crouch squash + a hop when tossing), keeper (A, humanoid, auto-rig: walk by `walkStride`, look-around via `turnBone` on the head, flashlight attachment), vision cones as translucent ground fans (procedural), bushes procedural (instanced leafy blobs), fences (core kit), benches, bins, lamps (D), s:rock, s:leafyTree, palm (D). Palette: grass `#4ade80`, paths `#e7e5e4`, cones `#fde68a` at 25 % alpha, alert `#f87171`, panda black/white, accent `#34d399`. Lighting `day` → `sunset` in stage 3. Effects: "?" and "!" bubbles over keepers, rustle leaves, snack sparkle.
12. **Audio.** Footsteps (quieter while sneaking), rustle in a bush, alert sting, distraction thud, gate fanfare.
13. **Performance.** ≈ 60 draw calls; ≤ 3 skinned keepers; cones as one batched mesh.
14. **Accessibility.** Cones visible at all times; suspicion meter above each keeper; a "safe" outline on bushes; generous catch time on coarse pointers (1.5 s).
15. **Complexity.** 4 (AI + stealth tuning).
16. **Estimated work.** 18–28 agent-hours; review 4 h; you 2 h.
17. **Dependencies.** P1-C (`ai/patrol`, `ai/vision`, `ai/steering`, `ballistics`, `motion`), P1-D (attachments, kit fence); assets panda, keeper (batch 3), bench, bin, lamp, palm, car, s:rock, s:leafyTree.
18. **Testing criteria.** Rules: cone + line-of-sight at edges, hearing radius, suspicion timing, investigate/return, every stage has a safe route at all patrol phases (a solver bot), scoring proof. Visual: cones match the logic exactly (a test compares the drawn fan to `inViewCone`). Perf: ≤ 65 draw calls.
19. **Definition of Done.** Common DoD + no keeper can see through a wall or a bush (tests) + a novice escapes in at least 1 of 3 runs (playtest).

---

## 20. Rocket Landing Challenge (`rocket-landing`): Codex · wave 2 · complexity 3

**Director's call.** Classic lunar lander, kept **2.5D** (a side view with 3D models) so the controls stay two-axis. Five landings on five planets with distinct gravity and wind make it a short campaign.

1. **Concept.** Feather the thrusters of a chunky toy rocket and set it down gently on floating landing pads across five tricky planets.
2. **Core loop.** Fall → rotate and thrust to kill speed → line up over the pad → touch down soft and straight → score → next planet.
3. **Objective.** Land on all 5 pads (`end("win")`). A crash costs one of 3 lives and restarts that landing; 0 lives = `end("lose")`. Each landing has a fuel budget.
4. **Controls.** Desktop: left / right (A / D) rotate, hold Space or W thrust. Touch: joystick x rotates, Jump button (hold) thrusts. `touchControls: ["joystick", "jump"]`. Scheme `flight` (new).
5. **Camera.** Side view (2.5D) with a small fov, following the rocket and zooming out to include the pad (fitted to rocket + pad bounds).
6. **Mechanics.**
   - 2D rigid body (x, y, θ, vx, vy, ω) integrated in fixed sub-steps (`core/kinematics`), gravity per planet (moon 1.6, desert 3.7, ice 5, gas-giant moon 2.5 + wind, asteroid 1.0 with a moving pad).
   - Landing: legs touch the pad with |vy| < 2 m/s, |vx| < 1 m/s, |θ| < 10° → landed; else crash (terrain contact anywhere else is a crash).
   - Fuel: thrust burns 10 units/s of 100 per landing.
   - Scoring per landing: softness 0–200 (by |vy|), centre 0–150 (by offset), fuel 0–150 (fuel left); +300 if all 5 are landed without a crash.
7. **Difficulty progression.** Planet order fixed: smaller pads, wind, a moving pad, a cavern approach, lower fuel.
8. **Replayability.** Seeded terrain variation per planet; perfect-landing chasing.
9. **Duration.** 60–240 s.
10. **Level design.** Five side-on terrains (extruded polylines with canvas textures), floating pads with lights, planets and moons as backdrop spheres.
11. **Visual direction.** Rocket (A: chunky, rounded, white with a coloured band and porthole), flame fx (additive cone + particles, length by thrust), pads procedural with blinking lights, terrains procedural per planet palette, core `<Starfield>`, battery (D) as fuel-cell pick-ups (optional bonus). Palette: per planet (moon `#d6d3d1`, desert `#fdba74`, ice `#bae6fd`, gas `#c4b5fd`, asteroid `#78716c`), flame `#fde047` → `#f97316`, accent `#fda4af`. Lighting `space`. Effects: dust on touchdown, sparks and debris on a crash, perfect-landing confetti.
12. **Audio.** Thrust loop (volume by thrust), rotation hiss, landing clunk, crash boom, low-fuel beep, planet-complete chime.
13. **Performance.** ≈ 30 draw calls; one planet mounted at a time.
14. **Accessibility.** Speed and tilt gauges turn mint when within landing limits; a guide line from the legs to the pad; "assisted rotation" (auto-levels when no rotation input) on coarse pointers.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`kinematics`), P1-B (`space` preset, `<Starfield>`, fx flame, audio loop); asset rocket (batch 2), battery.
18. **Testing criteria.** Rules: integration is frame-rate independent, landing thresholds, fuel, crash/respawn, every planet is landable with the fuel budget (a controller bot), scoring proof. Visual: the flame matches thrust. Perf: ≤ 35 draw calls.
19. **Definition of Done.** Common DoD + touch landing is possible with one thumb on the joystick and one on Jump.
