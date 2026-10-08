# Deliverable D (part 1): Game specifications, Collection "Adventure" (games 1–10)

Part 2 (games 11–20) is `04-game-specs-skill.md`. Each spec is the input for that game's design README (gate G0). Fields follow your 19-point list. Every number is a tuning starting point **[A]**, fixed in the game's `rules.ts` and proven in its tests.

## Conventions shared by all 20 specs

- **Runtime contract:** every game is a `GameDefinition` (`core/types.ts`) run by GameShell: phases, countdown, pause (Esc/P, hidden tab), result panel, score submission, Retry/Exit and the result delay come from core. A game ends its run with `end("win" | "lose" | "timeup")` and never touches localStorage or the API.
- **Logic** lives in a pure, seeded `rules.ts` driven from one `useRunFrame`; visuals read the state in `useFrame` and animate with `useGameTime()`. Discrete moves read `input.pressed`; presses read `tapDown` (immediate) or `tap` (release), never both.
- **Camera** uses `useFittedView` (+ `followFocus` for follow cameras) with `shift: true`, so the play area stays clear of the HUD, the touch controls and the cookie banner on every screen.
- **Physics (D6)**: scoring logic stays in pure `rules.ts`; Rapier (`physics: true`, lazy) is welcome for visual physics (debris, toppling, collapse) and for movement only where the design README justifies it and the limit proof does not depend on it.
- **Clocks**: a game with a fixed timer sets `durationMs` (the shell counts it down and ends with `"timeup"`). A game whose clock changes during play (time gates, penalties) keeps its own timer in `rules.ts`, sets no `durationMs`, shows it as a HUD stat and ends with `end("timeup")` itself.
- **Poses**: `reachPose` raises an arm **sideways** (it reads as a wave); reaching, digging and pointing at something in front are game-local poses built with `aimArm` / `turnBone` in the game's `poses.ts` (penalty-hero pattern).
- **Characters**: humanoids through `<HumanoidModel>` + `useHumanoidPose` + `walkStride` / `bodyLift` (never a T-pose, never feet through the floor). Non-humanoids through `<Model>` + `core/motion` (new, P1-C).
- **Look**: "Play50 toy world, premium edition" (05 §E.1): matte/satin materials, one accent per asset, soft hemisphere + one directional light, blob shadows, gameplay glow only on things you can interact with.
- **Feedback language** (shared by all 20, from `core/fx`): collect = gold sparkle burst + `pickup`; good action = mint ring + chime; mistake = coral flash + `hit`; combo = rising pitch; win = confetti + `win`.

### Common testing criteria (every game, in addition to its own)

| Kind | Test |
|---|---|
| Functional | ready → countdown → playing → pause/resume (Esc, P, tab hidden) → over → Retry and Exit, on desktop keyboard and on 390 × 844 touch emulation with the cookie banner open; Retry ×10 keeps `geometries` flat in the perf probe |
| Rules (vitest) | determinism (same seed, same inputs → same result), win and lose conditions, every scoring event, the scoring-limit proof with a bot through the real store (`advanceRunClock` + `playedFrameDt`) |
| Visual | no T-pose, soles on the floor within 1 cm (humanoids), no z-fighting, nothing important under the HUD or controls (headless screenshots at 1280 × 800, 390 × 844, 844 × 390) |
| Performance | perf probe (`?perf=1`): draw calls ≤ the game's budget, ≤ 150 hard cap; p95 frame time on the "mid phone" emulation profile (09 §L.3) |

### Common Definition of Done (every game)

1. Folder complete: `meta.ts`, `index.tsx`, `Scene.tsx`, `rules.ts`, `rules.test.ts`, `assets.ts`, `assets.spec.json`, `README.md` (template, ≤ 200 lines), thumbnail `public/images/3d/<slug>.webp` (captured by `tools/thumbs`).
2. `npm run build`, `npx tsc --noEmit`, `npx vitest run` and `node tools/gamecheck <slug>` pass; `git diff --name-only main...<branch>` lists only the game's folder, its thumbnail and its input script `tools/thumbs/inputs/<slug>.mjs`.
3. Plays end to end with keyboard and with touch; controls in `meta.ts` match what the game does.
4. Uses the shared GLBs and core helpers named in its spec; no game-local copy of a core helper; no import from another game.
5. Draw-call and frame-time budgets met in the perf probe; GLBs within budget (`optimize` passed); still runs on primitives if a GLB is missing.
6. Scoring formula and limit proof in the README; `meta.scoring` equals `arcade-games.json` (provisional until go-live).
7. Status stays `"dev"` until Claude's review is approved and you have playtested it; `"soon"` / `"live"` only in the go-live branch.

---

## 1. Treasure Island (`treasure-island`): Claude · reference game · complexity 2

**Director's call.** "Collect five treasures" alone is robot-collector again. The treasures are **hidden**: a detector tells you how warm you are, and you dig. That turns walking into reading a signal, which is more satisfying, and it costs no extra assets. The tide that shrinks the island in the last 20 seconds gives the timer a visible face.

1. **Concept.** Explore a tiny tropical island with a buzzing treasure detector and dig up five buried treasures before the tide comes in.
2. **Core loop.** Walk → watch the detector ring (pulse speed, colour, size) and listen to its beep → stop where it peaks → hold Dig → the treasure pops out with a sparkle → the detector re-targets the next nearest buried treasure.
3. **Objective.** Win: all 5 treasures dug (`end("win")`). Lose: none; the 90 s timer ends the run (`"timeup"`). Score = treasures + clean digs + time left.
4. **Controls.** Desktop: WASD / arrows move; E, Enter or Space dig (hold 0.6 s). Touch: joystick + Action button (hold). `touchControls: ["joystick", "action"]`. Scheme `joystick`.
5. **Camera.** Follow camera, 3/4 top-down (pitch ≈ 55°), `useFittedView` with `followFocus` over the island bounds; portrait phones get the yaw from `yaws`. Justification: the island must be read around the player to plan a route, and the detector ring must be visible on the ground.
6. **Mechanics.**
   - Movement: robot-collector's model (top speed 5 m/s, accel 24, brake 30, eased turning), sand and grass the same speed, shallow water ring at 60 % speed (wading), deep water is the boundary (a game-local radial clamp to the island ellipse; core `clampToBounds` is an AABB).
   - Collisions: palms, rocks, the chest stack and the dock posts as circles / AABBs (`resolveSphereAabb`).
   - Treasures: 5 spots from `generateIsland(seed)` on sand or grass, ≥ 6 m apart, ≥ 1.5 m from props, all reachable (flood fill test). Types: 2 coin piles, 2 gems, 1 chest (the chest always last-but-one or last so the big reveal comes late).
   - Detector: strength `s = clamp(1 − d / 12, 0, 1)` to the nearest undug treasure; ring pulse period 1.2 s → 0.15 s, colour slate → gold, beep rate the same (P1-B audio). Signature mechanic.
   - Dig: hold Action ≥ 0.6 s while within 0.9 m of a treasure → found. Digging anywhere else plays a 0.6 s dig with a sand puff and nothing: the "false dig" costs time and voids that treasure's clean-dig bonus.
   - Tide: from 70 s the walkable radius shrinks linearly by 25 % until 90 s (water plane rises 0.3 m); treasures are never placed in the outer 25 %, so tide never strands one.
   - Hint for kids: after 20 s without a find, a seagull (stand-in, `<Model>` pigeon tinted white via material override) circles above the nearest treasure.
   - Scoring: +200 per treasure, +50 if it was dug without a false dig since the previous find, on win +10 per full second left.
7. **Difficulty progression.** Within a run: the generator places treasures progressively further from the previous one (spacing rule), the tide raises pressure at the end. Between runs: none (short arcade game); the seed varies the island layout.
8. **Replayability.** New seed every run (layout + treasure spots + palm grove variation), best score and leaderboard, clean-dig and time bonus to optimise. Later (Phase 7, if approved): achievements "No false digs", "Under 40 s".
9. **Duration.** 40–90 s; typical first run ≈ 75 s.
10. **Level design.** Island ellipse 28 × 22 m: a dock at the south (start), beach ring 3 m, grass interior, a palm grove (8–12 palms, instanced), two rock outcrops (instanced rocks), a beach umbrella spot, a wrecked rowboat (procedural, decoration only). Water all around (core `<Water>`), sky dome gradient.
11. **Visual direction.** Runner (shared v2, auto-rig: walk/run by `walkStride`, a game-local dig pose (`aimArm` both arms down and forward + a bent spine via `turnBone`), `cheerPose` on win) with a procedural explorer hat attached to the head bone (P1-D attachments). Palm, umbrella, coin (shared, D), chest (new shared A), rock (new shared A), gems (procedural faceted icosahedron, emissive edge). Palette: sand `#f2d7a6`, sea `#2dd4bf` → deep `#0e7490`, palm green `#4d7c0f`, rock `#78716c`, gold `#fbbf24`, accent `#2dd4bf`. Lighting `sunset` preset (new) for warmth, fog for depth. Effects: sand puff on dig, gold sparkle burst + floating "+200" on a find, detector ring on the ground (one transparent ring mesh with a shader pulse), tide foam line.
12. **Audio.** Detector beep (rate = strength), dig thud loop while holding, treasure chime, tide whoosh at 70 s, win fanfare; ambient surf loop (P1-B loop). Mute via the shell.
13. **Performance.** ≈ 45 draw calls (palms 1–2 instanced, rocks 1, water 1, sky 1, island 2, runner 2, treasures ≤ 5, effects pooled 2); ≈ 80k tris; one shader plane (water) with a cheap vertex wave; no dynamic lights beyond the preset.
14. **Accessibility.** The detector speaks three channels at once (pulse speed, ring size, colour), so colour is never needed alone; sound optional; hold-to-dig has a visible progress ring; the seagull hint; high-contrast HUD chips "Treasures 2/5".
15. **Complexity.** 2 (but it is the reference: it adopts every new core module first).
16. **Estimated work.** 16–24 agent-hours (Claude) including core adoption and the README template for the expansion; Claude review is self-review + one adversarial pass by a second Claude session (3–4 h); you: 2 h (design approval, playtest on your phone).
17. **Dependencies.** P1-A, P1-B (fx, audio loops, sunset preset, water, sky), P1-D (attachments, material override); assets: s:chest, s:rock (batch 1), runner, palm, umbrella, coin.
18. **Testing criteria.** Rules: 1,000 seeds produce valid islands (reachability, spacing, never in the tide zone); detector strength is monotonic in distance; a false dig voids only the current clean bonus; scoring proof (best bot: walks the optimal route, never false-digs). Visual: dig pose reads from 390 × 844; the hat stays on the head through walk, dig and cheer. Perf: ≤ 60 draw calls.
19. **Definition of Done.** Common DoD + the README becomes the **expansion template** (sections, test budget, perf report) that the other 19 copy; its review notes feed `skills/arcade-game-build`.

---

## 2. Museum Guard (`museum-guard`): Cursor · wave 3 · complexity 3

**Director's call.** "Objects move when the player is not looking" works best as a **look-to-freeze** game from the guard's own eyes: you stand in the middle of a round gallery and sweep a flashlight. Exhibits caught in the beam freeze; holding the beam on one sends it back. A radar ring shows what is behind you. The exhibits are **other games' heroes rendered as statues** (knight in stone, dino skeleton in bone, penguin in bronze, robot in gold) through a material override: zero new Hyper3D generations and a fun cross-promotion of the arcade.

1. **Concept.** You are the night guard of a toy museum whose statues sneak off their pedestals whenever your flashlight looks away.
2. **Core loop.** Sweep the beam → spot a moving exhibit on the radar or in view → hold the beam on it to freeze it, keep holding to send it back → turn to the next threat; use the flash burst when several move at once.
3. **Objective.** Survive until dawn (90 s) with at least one of 3 alarms left. An exhibit reaching the exit door uses an alarm and returns to its pedestal. Win = dawn (`timeup` counts as survival; points game, so it is ranked). Lose = 3 alarms used (`end("lose")`).
4. **Controls.** Desktop: mouse x turns the beam (pointer), or A/D / left/right turn it at 180°/s; Space = flash burst (90° cone freeze for 1.2 s, 10 s cooldown). Touch: drag anywhere on the canvas to turn (pointer delta), Action button = flash. `touchControls: ["action"]` (drag is read from `pointer`). Scheme `look` (new).
5. **Camera.** First person at eye height 1.6 m in the gallery centre, fov 70, yaw = beam yaw (eased). Justification: the mechanic *is* not seeing everything; a top-down view would remove it. The radar HUD restores the overview without breaking the tension.
6. **Mechanics.**
   - 8 pedestals on a ring of radius 6 m; 6–8 exhibits; exit door on the ring (escape-room door GLB).
   - Exhibit state machine: `still → sneaking → frozen → returning → still`. Sneaking exhibits move along the ring toward the door, then inward; speed by type (bust hop 0.8 m/s, knight tiptoe 0.6, dino skitter 1.2, penguin slide 1.0 that keeps sliding 0.4 s after it is lit).
   - In view = angle between beam yaw and exhibit < beam half-angle (22°, narrowing to 15°) and distance < 9 m (`core/ai/vision` `inViewCone`). In view → frozen at once; continuously in view ≥ 0.7 s → returning (slides back at 3 m/s).
   - AI director: a seeded schedule starts sneaks so that the next one starts away from the beam (opposite half-circle with probability rising over time); at most 2 → 4 movers at once by phase.
   - Scoring: +5 per second survived, +50 per exhibit sent back, +150 per alarm left at dawn.
7. **Difficulty progression.** Three phases by clock (Midnight 0–30 s, 2 AM 30–60 s, 4 AM 60–90 s): more simultaneous movers, faster sneaks, narrower beam, the dino joins at 2 AM.
8. **Replayability.** Seeded pedestal assignment and sneak schedule; the flash timing is a skill; leaderboard.
9. **Duration.** 90 s fixed if you survive (≈ 40–90 s if you lose).
10. **Level design.** Round gallery (procedural): parquet floor (canvas texture), 8 pedestals, framed paintings between them (procedural canvas art in the arcade palette), a velvet rope ring, the exit door, a skylight with moonlight.
11. **Visual direction.** Statues via `<Model material="stone|bronze|gold|bone">` (P1-D): s:knight (stone), s:dino (bone), s:penguin (bronze), robot (gold); procedural lathe vases ×2 (glazed). Optional tier-3 bust (E). Lighting `night` + one spotlight attached to the camera (core kit `<Flashlight>`: spot light + additive cone mesh); exhibits glow faintly mint when frozen, coral when sneaking. Palette: wall `#312e81`, floor `#a16207`, stone `#e7e5e4`, bronze `#b45309`, accent `#c4b5fd`. Effects: dust motes in the beam, freeze "frost" ring, alarm red pulse.
12. **Audio.** Scuttle/footstep cue per moving exhibit, panned left/right by its bearing (P1-B `playSfx(name, { pan })`) so you can hear what is behind you; freeze "ting"; return whoosh; alarm; dawn chime. Ambient clock tick loop.
13. **Performance.** ≈ 40 draw calls (statues 4–6 meshes, vases instanced, paintings 1 atlas, room 3, beam 1); one spot light (all materials lit by it: acceptable, 1 light); no skeletons (statues are statues: whole-body hops/tiptoes from `core/motion`).
14. **Accessibility.** Radar ring with shapes (not colour only) and a "moving" outline; panned sound; wider beam on coarse pointers (+20 %); flash ability as a safety valve.
15. **Complexity.** 3 (first-person input, AI director, a dynamic light).
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-B (audio pan, fx, night preset), P1-C (`ai/vision`, `motion`), P1-D (material override, kit flashlight); assets s:knight, s:dino, s:penguin (batches 1–2), robot, door, bench.
18. **Testing criteria.** Rules: in-view test at cone edges and the 0.7 s hold; an exhibit never passes through the guard; schedule determinism; scoring proof (bot with perfect sweeping survives with 3 alarms). Gameplay: each phase reachable; flash cooldown visible. Visual: statue materials read as stone / bronze / gold in the beam and outside it. Perf: ≤ 50 draw calls, spot light cost checked on the mid-phone profile.
19. **Definition of Done.** Common DoD + drag-to-turn works on touch without fighting page scroll; the radar never hides a statue in view.

---

## 3. Airport Luggage Rush (`luggage-rush`): Cursor · wave 1 · complexity 2

**Director's call.** Sorting by tapping each suitcase is busywork. Make it a **routing puzzle in real time**: you flip conveyor switches and the suitcases follow the belts to their flight. One tap can route five bags, or misroute them, so attention and timing matter more than tapping speed. This also keeps it clearly different from Robot Factory (assembly, game 12).

1. **Concept.** Flip conveyor switches so every suitcase rides to the flight with its colour and symbol before the baggage hall overflows.
2. **Core loop.** Watch the bags coming → read each bag's tag (colour + symbol) → set the diverters ahead of it → the bag drops into its flight's chute → combo grows; fix the next junction.
3. **Objective.** Score as much as possible in 120 s. 3 strikes (wrong flight or a bag falling off the overflow end) end the run early (`end("lose")`); the clock ending is `"timeup"`.
4. **Controls.** Desktop: A / ←, S / ↓ and D / → toggle diverters 1–3, W / ↑ the 4th from 70 s (read from `pressed`: this game has no movement), or click a diverter. Touch: tap a diverter (`tapDown`: immediate). `touchControls: ["tap"]`. Scheme `tap-target`.
5. **Camera.** Fixed isometric view (pitch ≈ 50°) that fits the whole belt network (`useFittedView` with two yaws: landscape and portrait). Justification: every junction must be visible at once; nothing moves the camera.
6. **Mechanics.**
   - The belt network is a graph of `core/path` segments: one main belt, three diverters (each a two-way junction), four gate chutes, one overflow end.
   - Bags ride at belt speed by arc length; at a junction they take the branch the diverter shows **at the moment they cross the junction line** (pure, testable).
   - Bag tag = flight (colour + symbol + chute shape icon). VIP gold bags ×2 points; heavy bags ride at 70 % speed (they bunch the line).
   - Spawn schedule seeded: interval 2.2 s → 0.9 s; at most one bag per 1.1 m of belt.
   - Scoring: +20 per bag in the right chute × combo multiplier (+0.25 per consecutive correct, max ×3), VIP ×2; a wrong chute or overflow = strike and combo reset.
7. **Difficulty progression.** 0–40 s two diverters and three flights; 40 s third diverter; 70 s fourth flight and diverter; belt speed +3 % every 15 s; heavy bags from 30 s, VIP from 50 s.
8. **Replayability.** Seeded bag sequences; combo optimisation; leaderboard.
9. **Duration.** 60–120 s.
10. **Level design.** A compact baggage hall: the belt enters from a wall flap (top), snakes past the diverters to four gates on the right (each with a flight board), overflow chute at the bottom. A window with a plane silhouette (procedural; tier-3 plane GLB optional).
11. **Visual direction.** Suitcase (A, one model, tinted per flight through per-copy tint on `<DynamicInstancedModel>`, P1-D) with a procedural tag plane (symbol from a canvas atlas); belts from core kit `<Conveyor>` (scrolling texture), rollers instanced; diverter arms with a big arrow; flight boards drawn with `useCanvasTexture`. Optional runner as a baggage handler waving at the gates. Palette: floor `#cbd5e1`, belts `#334155`, flights red `#f87171` / blue `#60a5fa` / green `#34d399` / yellow `#fbbf24`, accent `#60a5fa`. Lighting `indoor`. Effects: mint ring at a correct chute, coral flash + bag tumble at a wrong one.
12. **Audio.** Belt hum loop, diverter clack, correct chime with rising pitch on combo, strike buzz, overflow thud.
13. **Performance.** ≈ 30 draw calls; ≤ 40 bags in one pooled `<DynamicInstancedModel>` (1–2 calls); no lights beyond the preset.
14. **Accessibility.** Flights differ by colour **and** symbol **and** chute icon; diverter state shown as an arrow, not colour; first 20 s slower; large tap targets around each diverter (≥ 64 px hit area).
15. **Complexity.** 2.
16. **Estimated work.** 8–12 agent-hours; review 2 h; you 1 h.
17. **Dependencies.** P1-C `path`, P1-D per-copy tint, kit conveyor; asset suitcase (batch 1).
18. **Testing criteria.** Rules: routing at the junction line (a toggle 1 ms before/after the crossing), spawn spacing never overlaps, combo maths, scoring proof (an oracle bot that always sets diverters correctly). Visual: tags readable at 390 × 844. Perf: ≤ 40 draw calls with 40 bags.
19. **Definition of Done.** Common DoD + a colour-blind check (grey-scale screenshot still tells flights apart).

---

## 4. Dino Egg Rescue (`dino-egg-rescue`): Antigravity · wave 2 · complexity 2

**Director's call.** Collect-and-return becomes interesting with **risk/reward stacking**: the dino can carry up to three eggs on its back, each one slows it, and a boulder hit drops them all. Players choose between safe single trips and greedy stacks.

1. **Concept.** A clumsy baby dino carries runaway eggs home to its nest while dodging rolling boulders and sticky mud.
2. **Core loop.** Spot eggs → waddle over to scoop them (auto) → decide to go home or grab one more → dodge boulders on the way back → drop the stack in the nest for a bonus.
3. **Objective.** Score as much as possible in 90 s (`timeup`). No lose state except the clock.
4. **Controls.** Desktop: WASD / arrows; Space or E = dash (0.4 s burst, 1.5 s cooldown). Touch: joystick + Action. `touchControls: ["joystick", "action"]`. Scheme `joystick`.
5. **Camera.** Follow 3/4 (pitch ≈ 55°), fitted to the valley with `followFocus`. Justification: boulders come from the volcano side and must be seen early.
6. **Mechanics.**
   - Movement like robot-collector; speed × (1, 0.85, 0.72, 0.6) for 0–3 eggs; mud zones × 0.5.
   - Eggs spawn seeded (max 4 on the ground), at least 6 m from the nest, never in mud.
   - Boulders roll down 2 → 4 fixed lanes (`core/path`) from the volcano at 3–6 m/s, bounce once at the valley floor; hit = stack dropped (eggs roll 1.5 m and rest), dino stunned 0.8 s.
   - Dash is invulnerable for its 0.4 s (the skill move).
   - Golden egg every ~25 s (despawns after 8 s).
   - Scoring: +100 per egg delivered × stack bonus (1 egg ×1, 2 eggs ×1.2 each, 3 eggs ×1.5 each), golden egg 300.
7. **Difficulty progression.** Boulder interval 3 s → 1.2 s; new lanes at 30 s and 60 s; eggs spawn further away.
8. **Replayability.** Seeded spawns; the stacking decision; golden eggs.
9. **Duration.** 90 s.
10. **Level design.** A valley 30 × 22 m: nest at the bottom-left, volcano backdrop top-right (procedural cone with a glowing crater), boulder lanes as shallow gullies, mud pits, ferns and trees as cover (they block boulders: a boulder that hits a tree stops and crumbles).
11. **Visual direction.** Dino (A, shared, solid; `core/motion` waddle: body roll with the stride, head bob, squash on dash, eggs on its back wobbling with a spring), eggs (procedural ellipsoids with canvas spots, three pastel colours), nest (procedural torus with a straw canvas texture), boulders (s:rock in a `<DynamicInstancedModel>` pool), s:leafyTree, palm (D), mud decals. Palette: grass `#84cc16`, soil `#a16207`, volcano `#57534e` + glow `#f97316`, eggs `#fde68a` / `#bfdbfe` / `#fbcfe8`, accent `#a3e635`. Lighting `sunset`. Effects: dust puffs at each step, crumble burst, nest sparkle on delivery, floating score.
12. **Audio.** Footstep thumps, egg pop on scoop, boulder rumble (loop, louder when near), drop "crack-no-break" bonk, delivery chime with stack-size pitch.
13. **Performance.** ≈ 40 draw calls; boulders pooled (1–2 calls), eggs instanced (1), trees instanced.
14. **Accessibility.** Boulder lanes telegraph with a dust trail and a ground shadow 0.8 s ahead; stack count on the HUD and on the dino; dash has a visible cooldown ring.
15. **Complexity.** 2.
16. **Estimated work.** 8–12 agent-hours; review 2 h; you 1 h.
17. **Dependencies.** P1-C `motion`, `path`; P1-B fx, sunset; assets s:dino, s:leafyTree (batch 2), s:rock (batch 1), palm.
18. **Testing criteria.** Rules: speed multipliers, stack drop on hit, dash invulnerability window, spawn rules for 1,000 seeds, scoring proof (greedy bot vs safe bot both within limits). Visual: eggs on the back never intersect the body at full waddle. Perf: ≤ 50 draw calls.
19. **Definition of Done.** Common DoD + the dino's waddle reads as walking (feet do not slide visibly at top speed: stride-matched bob frequency).

---

## 5. Delivery Drone (`delivery-drone`): Codex · wave 2 · complexity 3

**Director's call.** Free 3D flight is hard on touch. Altitude is **automatic** (the drone keeps 3 m above whatever is below and climbs over roofs); the skill is the **swinging parcel on a winch**: you must drop it when the swing carries it over the pad. Battery doubles as the timer and the reward (every delivery recharges).

1. **Concept.** Fly a zippy delivery drone over a toy city, swing parcels on a winch and drop them onto glowing rooftop pads before the battery runs flat.
2. **Core loop.** Pick up a parcel at the depot (hover over it) → follow the beacon and the off-screen arrow → line up over the pad while the parcel swings → drop → precision bonus and a battery top-up → next parcel.
3. **Objective.** Maximise score before the battery empties (`end("lose")` when it hits 0; runs typically 90–180 s).
4. **Controls.** Desktop: WASD / arrows fly; Space or E drop. Touch: joystick + Action. `touchControls: ["joystick", "action"]`. Scheme `flight` (new).
5. **Camera.** High chase camera (pitch ≈ 50°), look-ahead in the flight direction, fitted to a 20 m window around the drone (`followFocus`). Justification: rooftops and the swing must be visible; a low camera hides pads behind buildings.
6. **Mechanics.**
   - Drone: velocity with inertia (accel 10 m/s², drag), max 9 m/s; bank tilt from lateral acceleration (`core/motion` bank); auto altitude = max(roof below + 3 m) eased.
   - Tall towers (higher than the cruise ceiling) are walls (XZ AABB collision, soft bounce, battery −3).
   - Parcel: 2-axis damped pendulum (length 2 m) driven by the drone's acceleration; on drop it falls ballistically with the swing velocity (`core/ballistics`).
   - Landing: distance from pad centre → precision 0–100; outside the pad = parcel lost (no battery).
   - Pigeons (D) fly along `core/path` loops; touching one = parcel dropped where you are.
   - Battery: −1 %/s, −2 %/s while boosting (hold Jump optional), +12 % per delivery.
   - Scoring: +150 per delivery + precision (0–100) + express bonus +50 if delivered within 15 s of pick-up.
7. **Difficulty progression.** Targets further away, wind zones from 60 s (visible streaks push the drone and the swing), more pigeon loops, fragile parcels (precision < 40 = broken, no points).
8. **Replayability.** Seeded city and target order; express and precision optimisation.
9. **Duration.** 90–180 s.
10. **Level design.** City 60 × 60 m grid of 8 × 8 blocks (procedural buildings of 3 heights, rooftop details instanced), depot in the centre, 12 rooftop pads, a park with trees, streets with cars below.
11. **Visual direction.** Drone (A): white body, soft blue panels, four spinning rotor discs (procedural blur discs). Parcels procedural (box + tape canvas). Buildings procedural with canvas window textures (lit windows at sunset). Cars, taxis, vans (D) on street paths, pigeons (D), s:leafyTree in the park. Palette: buildings `#e2e8f0` / `#cbd5e1` / `#94a3b8`, roofs `#64748b`, pads `#38bdf8` glow, accent `#38bdf8`. Lighting `day` → `sunset` blend over the run. Effects: rotor wash rings when low, landing sparkle, wind streaks.
12. **Audio.** Rotor hum loop (pitch with speed), winch click, drop thud, delivery chime, low-battery beep at 20 %.
13. **Performance.** ≈ 70 draw calls (city ≈ 25 instanced, vehicles 3 pools, pigeons 1 pool, drone 2, parcel 1, effects 2). City culled by blocks (only the 5 × 5 blocks around the camera are drawn: static instance sets per block).
14. **Accessibility.** Beacon + off-screen arrow (`<TargetMarkers>`), a drop shadow under the parcel that turns mint when over the pad, adjustable "steady winch" (less swing) on coarse pointers.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-B (audio loop, fx), P1-C (`ballistics`, `path`, `motion` bank/hover), P1-D (`<TargetMarkers>`); assets drone (batch 2), car, taxi, van, pigeon, crate.
18. **Testing criteria.** Rules: pendulum energy decays (no runaway), drop landing maths, battery bookkeeping, collisions with towers, scoring proof (oracle bot). Visual: the swing reads on a phone. Perf: ≤ 80 draw calls with the full city.
19. **Definition of Done.** Common DoD + flying with the joystick never needs a second finger.

---

## 6. Crazy Shopping Cart (`shopping-cart`): Antigravity · wave 1 · complexity 2

**Director's call.** Keep it a collect-run, but the cart **drifts**: momentum, skids on spills and a "ride the cart" boost (hold Jump to hop on: faster, less grip). Shoppers are the existing runner, chef and cleaner walking patrol loops, so the store feels alive at zero asset cost.

1. **Concept.** Drift a runaway shopping cart through the aisles, grab everything on your list and dodge shoppers, spills and can pyramids.
2. **Core loop.** Read the list (6 icons) → steer down aisles → drive through a glowing item to grab it → avoid bumps (they break the combo) → when the list is done, race to the checkout.
3. **Objective.** Win: list complete and checkout reached (`end("win")`). Timeup at 75 s ends the run with the items so far.
4. **Controls.** Desktop: WASD / arrows steer (screen-relative); hold Space = ride (boost). Touch: joystick + Jump (hold). `touchControls: ["joystick", "jump"]`. Scheme `joystick`.
5. **Camera.** Follow 3/4 (pitch ≈ 55°), fitted to the store with `followFocus`; look-ahead along velocity.
6. **Mechanics.**
   - Cart kinematics: heading turns toward input at 4 rad/s; velocity eases toward heading (grip 6/s normally, 1.5/s on spills, 3/s while riding); max 6 m/s walking, 9 m/s riding.
   - Collisions: shelves AABB (`resolveSphereAabb`) with a 0.3 restitution bounce; can pyramids topple on contact (visual debris + 0.5 s slow).
   - Shoppers: 3 NPCs on `core/ai/patrol` loops crossing aisles; bump = 1 s stun, combo reset.
   - List: 6 items drawn per seed from 10 product kinds on 24 shelf slots; items glow; only list items are collectable.
   - Scoring: +100 per list item, +20 × combo per consecutive clean pick-up, +300 list complete, on win +10 per full second left.
7. **Difficulty progression.** Items placed further apart in later list positions; spills appear at 25 s and 50 s; a 4th shopper at 40 s.
8. **Replayability.** Seeded lists and layouts; route optimisation; leaderboard.
9. **Duration.** 45–75 s.
10. **Level design.** Store 32 × 24 m: 5 aisles, a fruit island, freezer row, checkout at the exit; can pyramids at aisle ends.
11. **Visual direction.** Cart (A) pushed by the runner (D, `carryPose(0)` arms forward on the handle, walk by `walkStride`; riding pose = `jumpPose` tuck standing on the base bar). Shoppers: cleaner, chef (D, walk). Products: apple, banana, burger, tinCan, bottle, bag (D) on shelves via `<InstancedModel>`; shelves procedural (white metal with canvas price strips). Palette: floor `#f1f5f9` tiles, shelves `#e2e8f0`, signs `#fb923c`, accent `#fb923c`. Lighting `indoor`. Effects: skid marks (decal pool), can debris, sparkle on pick-up, speed lines while riding.
12. **Audio.** Cart rattle loop (pitch with speed), pick-up chime, bump thud, spill squeak, checkout "ka-ching".
13. **Performance.** ≈ 60 draw calls; 3 skinned NPCs + the runner (≈ 8 calls); products instanced per kind.
14. **Accessibility.** List on the HUD with icons and ticks; items glow and bob; a soft auto-steer assist on coarse pointers (aim toward the nearest list item within 20°).
15. **Complexity.** 2.
16. **Estimated work.** 8–12 agent-hours; review 2 h; you 1 h.
17. **Dependencies.** P1-B fx, audio loop; P1-C `ai/patrol`; asset cart (batch 1); runner, cleaner, chef, products.
18. **Testing criteria.** Rules: grip model, collisions never tunnel at 9 m/s (`sweptAabbXZ`), list generation (every list item reachable), scoring proof. Visual: the runner's hands stay on the handle in turns. Perf: ≤ 70 draw calls.
19. **Definition of Done.** Common DoD + riding is fun but never mandatory (the list is completable at walking speed within 75 s for every seed).

---

## 7. Snowball Battle (`snowball-battle`): Cursor · wave 3 · complexity 4

**Director's call.** Free aiming with a thumb is frustrating. Throws **auto-target** the rival nearest your aim direction; the skill is in timing (rivals telegraph and dodge), cover use and ammo (you scoop snowballs, max 3). Forts crumble, so the arena changes during the fight.

1. **Concept.** A friendly 1-vs-3 snowball fight: duck behind snow forts, scoop snowballs and tag the rival kids before they tag you.
2. **Core loop.** Scoop (hold) → peek out → throw at the targeted rival (auto-lead) → duck before their wind-up lands → move to fresh cover when a fort crumbles.
3. **Objective.** Win: every rival tagged 3 times (`end("win")`). Lose: you are tagged 5 times (`end("lose")`). Timeup at 90 s keeps the score.
4. **Controls.** Desktop: WASD move; hold E / Enter = scoop; Space = throw at the highlighted rival; mouse aims the target highlight (pointer). Touch: joystick + Action (hold = scoop) + tap a rival to throw at it (`tapDown`). `touchControls: ["joystick", "action", "tap"]`. Scheme `joystick` + aim.
5. **Camera.** Follow, high (pitch ≈ 60°), fitted to the 24 × 18 m arena with `followFocus`. Justification: incoming throws must be readable.
6. **Mechanics.**
   - Player and rivals move at 4.5 m/s; scooping roots you for 0.5 s.
   - Throws: `core/ballistics` arc with flight time 0.6–0.9 s; lead from target velocity; hit test = ball sphere vs two stacked spheres per kid (`spheresOverlap`).
   - Rival AI (`core/ai/steering` + `vision`): FSM `cover → scoop → peek → windup (0.45 s telegraph) → throw → relocate`, dodges when a ball's predicted landing is within 1 m (reaction time 0.35 → 0.2 s by difficulty).
   - Forts: AABB covers with 3 HP; each hit removes a layer (scale step); at 0 they become a low mound.
   - Big snowball: hold scoop for 1.5 s → a big ball that rolls on the ground (knocks a rival down for 1.5 s).
   - Scoring: +100 per hit, +300 per rival out, +500 on a win, +50 per unused health.
7. **Difficulty progression.** Every 30 s rivals react faster and coordinate (two wind-ups at once); the third rival joins at 10 s.
8. **Replayability.** Seeded fort layouts and rival personalities (thrower, dodger, sneaker).
9. **Duration.** 60–90 s.
10. **Level design.** Snowy schoolyard: 6–8 forts, pine trees at the edges, a snowman in the middle (cover), fence.
11. **Visual direction.** Snow kid (A, humanoid, auto-rig: walk, crouch via `blendPoses` with a bent spine, throw = `aimArm` wind-up then follow-through, cheer); teams told apart by procedural beanie + scarf attachments (P1-D) in blue / red / green / orange. s:pineTree, forts and snowman procedural, snowballs pooled. Palette: snow `#f8fafc` → shadow `#bfdbfe`, accents per team, sky `#e0f2fe`, accent `#bae6fd`. Lighting `snow` preset (new, cool key, bright fill). Effects: snow puff on hits, crumble burst, footprint decals, falling snow particles (light).
12. **Audio.** Scoop crunch, throw whoosh, splat, crumble, win jingle.
13. **Performance.** ≈ 50 draw calls; 4 skinned kids (≈ 8 calls) + attachments (4); snowballs pooled.
14. **Accessibility.** Targeted rival outlined + arrow; incoming balls draw a landing ring; generous hit capsule on coarse pointers; health shown as mittens on the HUD.
15. **Complexity.** 4 (AI + ballistics + destructible cover).
16. **Estimated work.** 18–28 agent-hours; review 4 h; you 2 h.
17. **Dependencies.** P1-C (`ballistics`, `ai/steering`, `ai/vision`), P1-D (attachments), P1-B (`snow` preset, fx); assets snowKid (batch 3), s:pineTree.
18. **Testing criteria.** Rules: hit maths with leads, AI reaction bounds, fort HP, both end conditions, scoring proof (bot that plays near-optimally against the deterministic AI). Gameplay: a novice wins at least 1 in 3 runs at the start difficulty (playtest). Visual: throws read; no T-pose in crouch. Perf: ≤ 60 draw calls.
19. **Definition of Done.** Common DoD + AI never throws through a fort and never stands still in the open for more than 2 s.

---

## 8. Ghost Vacuum (`ghost-vacuum`): Kimi · wave 2 · complexity 3

**Director's call.** Catching = **two steps**: the flashlight stuns a ghost, then the vacuum pulls it in while it tugs back. Ghosts are made in code (glowing translucent shapes with a wobble shader), which looks better than a Rodin mesh and costs no credits.

1. **Concept.** Bust giggling ghosts out of a toy haunted mansion with a backpack vacuum: light them up to stun them, then suck them in.
2. **Core loop.** Explore rooms → spot shaking furniture or a shimmer → face the ghost so the flashlight stuns it → hold Vacuum and keep it in the cone while it tugs → caught.
3. **Objective.** Catch as many ghosts as possible in 120 s (`timeup`); 12 caught = mansion cleared (`end("win")` with a time bonus).
4. **Controls.** Desktop: WASD move; the mouse aims the flashlight (pointer projected on the floor), or it follows movement without a mouse; hold E / Space = vacuum. Touch: joystick (aim follows movement) + Action (hold). `touchControls: ["joystick", "action"]`. Scheme `joystick`.
5. **Camera.** Follow top-down (pitch ≈ 62°) with near walls faded (cutaway) so rooms stay readable.
6. **Mechanics.**
   - Ghosts: wander (`core/ai/steering`), flee when lit, phase through furniture, hide inside furniture (it shakes) and pop out when you come near.
   - Stun: ≥ 0.4 s inside the flashlight cone (25° half-angle, 6 m) → stunned 2 s (solid colour).
   - Vacuum: while holding Action with a stunned ghost in the cone (12°, 4 m), it slides toward the nozzle over 1 s; it tugs sideways (sinusoid) so you must track it; out of the cone > 0.3 s → it breaks free.
   - Golden ghost every ~30 s (faster, 300 points). Big ghost from 60 s (needs 0.8 s of light).
   - Scoring: +100 per ghost, +50 × extra ghosts caught in one pull, golden 300, on win +10 per second left.
7. **Difficulty progression.** More ghosts at once (3 → 6), faster wander, big ghosts, ghosts that swap hiding spots.
8. **Replayability.** Seeded room order and ghost spawns; combo pulls.
9. **Duration.** 60–120 s.
10. **Level design.** Mansion floor 28 × 20 m: hall, library, study, kitchen, ballroom; doors (D) between rooms; furniture desk, chair, book (D) and procedural candelabras, clocks, paintings.
11. **Visual direction.** Runner (D) with the vacuum backpack (A) attached to the chest bone and a procedural hose + nozzle following the right hand (`aimArm` toward the target). Ghosts procedural: lathe body + vertex wobble + fresnel emissive, additive blending, one instanced pool (1 draw call). Rooms procedural with wallpaper canvas textures. Palette: walls `#4c1d95` / `#3b0764`, floor `#78350f`, ghosts `#e0e7ff` with `#a78bfa` rim, golden `#fde047`, accent `#a78bfa`. Lighting `night` + core kit `<Flashlight>` (one spot light). Effects: suction swirl particles, capture pop + sparkle, furniture shake.
12. **Audio.** Vacuum loop (pitch rises during a pull), ghost giggles (short synth chirps, panned), capture pop, stun "zap", spooky ambient drone (very quiet).
13. **Performance.** ≈ 55 draw calls; one spot light; ghosts 1 call; transparency sorted only for ghosts.
14. **Accessibility.** Hidden ghosts shake furniture and shimmer (motion + glow, not colour only); pull progress ring on the ghost; aim assist toward the nearest stunned ghost on coarse pointers.
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`ai/steering`, `ai/vision`), P1-D (attachments, kit flashlight), P1-B (audio loop, pan, fx, night); assets vacuum (batch 2), runner, desk, chair, book, door.
18. **Testing criteria.** Rules: stun and pull timing, break-free rule, combo maths, spawn determinism, scoring proof. Visual: the backpack stays on the back through walk and turn; the hose never passes through the body at the extreme aim angles. Perf: ≤ 60 draw calls.
19. **Definition of Done.** Common DoD + ghosts are clearly cute, never scary (your approval at playtest).

---

## 9. Construction Worker (`construction-worker`): Cursor · wave 2 · complexity 3

**Director's call.** Walking materials to a building is warehouse-rush again. The worker runs the **tower crane**: you choose the right material pile for the next blueprint step (the "collect in sequence" part) and swing it into the glowing slot, with the hook's pendulum making placement a timing skill. The worker character still appears on the ground (runner with a hard hat), cheering each floor.

1. **Concept.** Run the crane on a toy building site: pick the right material for the glowing blueprint slot and swing it into place, floor by floor.
2. **Core loop.** Read the next blueprint step → pick the matching pile (slab, pillar, wall, window, roof) → move the jib and trolley → time the drop against the swing → rating → next step; finish the building, start the next.
3. **Objective.** Build 3 buildings (house, shop, tower) in 150 s → `end("win")` + time bonus. Stability meter: each bad placement wobbles the building; at 0 it collapses (`end("lose")`).
4. **Controls.** Desktop: A / D rotate the jib, W / S move the trolley out / in, Space drop, 1–5 (`InputState.digit`, P1-D) or a click choose a pile. Touch: joystick (x = rotate, y = trolley) + Action (drop) + tap a pile. `touchControls: ["joystick", "action", "tap"]`. Scheme `joystick`.
5. **Camera.** Fixed 3/4 view of the site (pitch ≈ 40°) with a slight follow of the hook height as buildings grow; fitted to site + building top.
6. **Mechanics.**
   - Crane in polar coordinates (angle, radius) with acceleration limits; hook = damped 2D pendulum driven by the trolley's and jib's acceleration (`core/kinematics` helper, pure).
   - Pile choice: a wrong material is refused with a buzz and 1 s lost (no stability loss).
   - Drop: the piece falls from the hook with the swing velocity; landing offset from the slot → perfect (< 0.15 m) / good (< 0.35) / ok (< 0.6) / miss (bounces off, retry, stability −15).
   - Stability: starts 100 per building, −0 / −5 / −10 per perfect / good / ok.
   - Scoring: perfect 100, good 60, ok 30 per piece; +500 per building; on win +5 per second left.
7. **Difficulty progression.** House 8 pieces, shop 12, tower 16; wind gusts from the tower stage (swing pushed sideways), slot tolerance −20 % on the tower.
8. **Replayability.** Seeded pile order and building variants (window and roof styles); perfect streaks.
9. **Duration.** 90–150 s.
10. **Level design.** Site 30 × 24 m: crane at the centre-back, three plots in a row, material yard with 5 piles, site fence, a parked van (D), pallets and crates (D).
11. **Visual direction.** All building pieces procedural (slabs, pillars, brick walls with canvas texture, glass windows with emissive frames, roofs); crane procedural (instanced lattice bars, yellow); runner (D) with a procedural hard hat attachment pointing (a game-local `aimArm` point) and cheering. Palette: crane `#fbbf24`, concrete `#d6d3d1`, brick `#c2410c`, glass `#bae6fd`, site `#a8a29e`, accent `#fbbf24`. Lighting `day`. Effects: dust puff on landing, "Perfect!" floating text, mint outline on the target slot, wobble shake.
12. **Audio.** Crane motor loop, cable creak with swing, clank on landing (pitch by rating), perfect ding, collapse rumble.
13. **Performance.** ≈ 45 draw calls; building pieces instanced per kind.
14. **Accessibility.** Drop shadow + a vertical guide line from the hook to the ground (mint when over the slot); swing amplitude shown; "steady crane" assist on coarse pointers (more damping).
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`kinematics` pendulum), P1-D (attachments), P1-B (fx, audio loop); no new Hyper3D asset; runner, pallet, crate, van.
18. **Testing criteria.** Rules: pendulum stability (energy never grows), rating thresholds, stability maths, wrong-pile handling, scoring proof (oracle bot that drops at the swing's centre). Visual: buildings never intersect the crane; the hat stays on. Perf: ≤ 50 draw calls.
19. **Definition of Done.** Common DoD + every building is finishable by a novice with "ok" placements (stability never forced to 0).

---

## 10. Alien Farm (`alien-farm`): Kimi · wave 3 · complexity 3

**Director's call.** "Harvest crops and carry them to a ship" needs a hook: crops **pulse** through their growth and must be harvested at the peak glow (with an audio cue that rises to it), and the **saucer moves** around the farm, so drop-offs are a moving target. This makes it a rhythm-and-route game, not another collector.

1. **Concept.** Tend a moonlit alien garden: harvest each glowing crop at its brightest pulse and beam the harvest up to your hovering saucer.
2. **Core loop.** Watch plots pulse → move to the one about to peak → harvest on the peak (perfect) → carry up to 4 → walk into the saucer's beam as it passes → load → repeat.
3. **Objective.** Score as much as possible in 100 s (`timeup`). Overripe crops burst spores (slow zones), so neglect has a cost.
4. **Controls.** Desktop: WASD move; E / Space harvest. Touch: joystick + Action. `touchControls: ["joystick", "action"]`. Scheme `joystick`.
5. **Camera.** Follow 3/4 (pitch ≈ 55°) at night, fitted to the 26 × 20 m farm.
6. **Mechanics.**
   - 9 plots, each a state machine `sprout → growing → ripe window (peak) → overripe → burst → sprout`, with seeded phase offsets and per-crop cycle lengths (glowPod 6 s, optional gourd 8 s).
   - Harvest within ±0.25 s of the peak = perfect (×2), within the ripe window = normal, outside = nothing.
   - Carry max 4 (`carryPose` arms); speed −8 % per crop.
   - Saucer moves on a closed `core/path` loop; its beam (radius 2 m) loads everything you carry when you stand in it.
   - Spores: overripe bursts leave a 2 m slow zone (×0.6) for 5 s.
   - Scoring: +50 per crop (×2 perfect), delivery bonus +25 × load² (so full loads pay).
7. **Difficulty progression.** More plots active, shorter windows, the saucer speeds up, a second crop type with a different rhythm at 40 s.
8. **Replayability.** Seeded phases and the saucer route; perfect streaks; load optimisation.
9. **Duration.** 100 s.
10. **Level design.** Crater farm with 9 plots in a 3 × 3 grid, glowing irrigation channels, purple rocks (s:rock with a tinted material), crates (D) as decor, starfield and a big moon.
11. **Visual direction.** Alien farmer (A, humanoid, auto-rig: walk, a game-local `aimArm` reach down to the crop on harvest, carry), glowPod crop (A) scaled by growth stage + emissive pulse (material emissive driven per frame), optional gourd (tier 3; else procedural spiral lathe). Saucer procedural (lathe + emissive ring lights + additive beam cone). Palette: soil `#3b0764`, crop glow `#4ade80` / `#22d3ee`, rocks `#7c3aed` tint, sky `#020617`, accent `#4ade80`. Lighting `night` + emissives; core `<Starfield>`. Effects: harvest pop, beam sparkles, spore clouds.
12. **Audio.** Each ripe crop hums with a pitch rising to its peak (the timing cue), harvest pop (higher for perfect), beam whoosh, spore puff; ambient night loop.
13. **Performance.** ≈ 45 draw calls; plots instanced; emissive pulse via instance colour (no per-plot material).
14. **Accessibility.** Ripe window shown as a ring filling around the plot (shape + light), the hum cue, perfect window widened on coarse pointers (±0.35 s).
15. **Complexity.** 3.
16. **Estimated work.** 12–18 agent-hours; review 3 h; you 1.5 h.
17. **Dependencies.** P1-C (`path`), P1-B (fx, `<Starfield>`, audio), P1-D (material override for the purple rocks, per-copy tint); assets alien, glowPod (batch 3), s:rock, crate.
18. **Testing criteria.** Rules: plot cycles, perfect window bounds, carry limit, beam loading, spore zones, scoring proof (oracle bot that always harvests on the peak and loads 4). Visual: the alien's reach meets the crop. Perf: ≤ 50 draw calls.
19. **Definition of Done.** Common DoD + the hum cue alone (screen covered) lets a tester hit perfects (audio-first timing works).
