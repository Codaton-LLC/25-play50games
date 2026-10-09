# Monster Kitchen

Owner: Kimi. Slug: `monster-kitchen`. Skill game 17 (order 27), complexity 2, wave 1. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §17. Gate G0 (design); the build fills `Status`. Units: metres, seconds; x right (the wheel is at −x), z towards the camera (the counter front is +z), y up. Every "Changed from spec" line says what and why.

## Concept

A cosy cave kitchen on a warm shift. A queue of hungry, picky monsters appears at the serving hatch; each shows an order bubble of 3–5 weird ingredients. You spin the lazy Susan of ingredients with your off hand, toss what the bubble asks, in order, into the bubbling cauldron — and the faster the plate, the fatter the tip. The skill is spatial memory (where is the fish now?) plus speed, exactly the director's call. Accent `#f472b6`.

## Controls

`meta.ts`: `scheme: "tap-target"`, `touchControls: ["swipe", "tap"]` (the swipe control renders the two side arrows; no jump/action buttons, no `touchLabels`).

- `keyboard`: "Left / right to turn the wheel, Space or Enter to toss, or click an ingredient" (Space and Enter both toss, per the spec; the stub named only Space).
- `touch`: "Swipe to turn the wheel, tap an ingredient to toss".
- Input fields: `pressed.left` / `pressed.right` (arrows, A/D and swipes — `pressed` already includes swipes, so there is no `swipe` branch) rotate the wheel one slot per press; `tap` (click or short touch on an ingredient) tosses it when it is one of the front 3, otherwise rotates it to the front; `jumpPressed` (Space) / `actionPressed` (Enter) toss the front ingredient. Esc / P pause (shell).
- Changed from spec: the toss reads `tap` (release), not `tapDown`, because `tapDown` fires before every swipe and would toss an ingredient on every rotation — the core input contract ("`tap` or `tapDown`") forces this; up to 350 ms of release latency on touch is fine at a 0.55 s toss cadence.

## Rules

All numbers live in `rules.ts` (`WHEEL`, `INGREDIENTS`, `TOSS`, `ORDERS`, `PATIENCE`, `SERVE`, `DRIFT`, `TYPES`, `SCORING`) and are proven in `rules.test.ts`.

- **Wheel** (`WHEEL`): a lazy Susan on the counter at (−2.0, 0.9, 0) — disc r 0.95, ingredient ring r 0.75, **8 slots**. Slot k sits at ring angle (k + `rotation`) · 45°; the front arc = ring positions 5–7 (±45° of the camera), the **front 3 are tappable**; `rotation` is an integer mod 8, so every ingredient is ≤ 3 rotations from the tappable arc. Rotating takes **0.18 s** per slot (visual easing; the rules apply it instantly, so the limit model grants rotations for free — real play is slower, which only lowers scores). `pressed.left/right` rotates ∓1. From **50 s** the wheel **drifts** on its own: every **6 s** ±1 slot, direction seeded (`DRIFT`).
- **Ingredients** (`INGREDIENTS`): 8 kinds — apple, banana, burger, sock, tinCan, fish, eyeball, slime cube (the last two procedural). The seeded per-run layout puts one kind on each slot; a tossed slot is **empty for 0.9 s**, then refills with a new seeded kind. An empty slot cannot be tossed (a tap gives a dull wobble).
- **Toss** (`TOSS`): **one ingredient in flight at a time**; a toss during a flight or a burp is ignored. Flight **0.55 s**, resolution at landing: if the kind equals the next needed ingredient of an active order, it advances the **earliest-arrived** order that needs it (with two active orders an ingredient can only ever advance one); otherwise the cauldron **burps**: for **1.2 s** tosses are locked, the earliest-arrived order **restarts** (progress 0) and its patience takes **−3**. Patience drains during flights.
- **Orders** (`ORDERS`): seeded; length by the monster's arrival time t: **t < 25 s → 3; 25–50 s → 3–4; ≥ 50 s → 4–5**; each position an independent seeded kind (repeats allowed). A **grace of 1.5 s** after the order appears pauses the patience drain (reading time; penalties still apply). At most **2 orders active**; a third monster waits dimmed in the queue. Changed from spec: with two orders, "wrong" is judged against the earliest order and penalizes it — the cook works the queue front to back; the spec leaves the tie open.
- **Patience** (`PATIENCE`): max **10**. Drain per second by type — jolly **1.0**, greedy **1.15**, grumpy **1.3**; wrong toss −3 (clamped at 0). At 0 the monster leaves **angry** after **0.4 s** (`loseLife()`, `lives: 3`).
- **Serve** (`SERVE`): first order appears at **0.5 s**. On completion the monster eats, dances and tips for **2.0 s**, then the next steps up after **0.8 s** (walk-in). The second window opens at **70 s**: its first monster walks in then (order at 70.8); each window then cycles independently.
- **Scoring** (`SCORING`): on completion, `orderPoints = round(100 · FACTOR[len]) + round(5 · patienceLeft)`, `FACTOR = {3: 1.0, 4: 1.4, 5: 1.9}` → 100 / 140 / 190 plus a tip ≤ 50. Single `addScore` per completion; `finalScore` is not overridden.
- **Clock:** `durationMs: 90000` (fixed timer; the shell ends with `"timeup"`).

## Scoring

One score source: order completions, `100 · FACTOR[len] + 5 · patienceLeft` (rounded). Live `addScore` at completion with a "+190 +45 tip" popup (`fx.score`).

### Server limits and why they hold (the proof)

| | provisional (02 §C.4, `meta.ts` = `arcade-games.json`, `enabled: false`) | proposed (assets + limits PR) |
|---|---|---|
| `maxScore` / `max_score` | 6000 | **4900** |
| duration | 10000–92000 ms | **19000–92000 ms** |
| `base` / `max_pps` | 6000 / 6000 | **240 / 60** |

Proof plan (robot-collector's structure, through the real store):

1. **Ceiling:** a completion pays ≤ 150 (arrival < 25 s), ≤ 190 (25–50 s) or ≤ 240 (≥ 50 s): `FACTOR` caps the first term, `patienceLeft ≤ 10` caps the tip.
2. **Count:** a window cycle ≥ walk-in 0.8 + cook `len · 0.55` (one 0.55 s flight in the air at a time) + eat 2.0 → ≥ **4.45 s** for a 3-item order. First order at 0.5 s, so completion i ≥ `4.45·i − 2.3`: ≤ **16 completions** before 70 s. After 70 s window A's next order appears ≥ 71.7 (window busy until 70.9 + 0.8) and window B's at 70.8; with cook ≥ 2.2 (orders are 4–5 items): ≤ 4 completions each → **≤ 24 completions**. Ceiling **B(90) = 6·150 + 6·190 + 12·240 = 4920**, seed-independent (the generator only permutes within these bounds).
3. **By time:** single-window slope ≤ 240 / 4.45 = 54 < 60, so `B(t)` never outruns `240 + 60·t` before 70 s (slack 1440 at 70 s); the two-window phase adds ≤ 8·240 = 1920 ≤ 1440 + 60·20, and no further completion is possible ≤ 90 s. Pauses, retries, input spam and frame rate cannot raise any rate (core clock facts; bots drive `createArcadeStore()` via `advanceRunClock` + `playedFrameDt`).
4. **Min duration:** a spam-of-wrongs run ends `"lose"` fastest: each wrong costs 0.55 flight + 1.2 burp and −3 patience, so a monster goes angry ≥ 5.8 s after its order appears (landings at 0.55 + 3 × 1.75); with leave 0.4 + walk 0.8 between monsters, the third angry is at ≥ **20.3 s** (exact recurrence in tests) → 19000 ms (6 % margin). Natural anger (drain 1.3 at best) is slower.
5. **Every seed:** the scheduler only permutes types, kinds and drift, all inside the bounds above (checked on 1,000 seeds).

Measured at the build: an oracle bot with minimal rotations (≤ 3 per ingredient, into the front-3 arc) through the real store, 200+ seeds at 60 fps, 20 fps and random 4–50 ms frames, plus spam, wrong-only and idle bots; expected oracle ≈ 4200–4550 (tips decay with cook time). If the measured oracle is under 90 % of 4900, the limits PR tightens `maxScore` to ~ceiling × 1.03. `capScore` stays a no-op on every run (tests).

## Run end

- `"timeup"` by the shell at 90 s. No `"win"` (a score attack).
- `"lose"` when the third monster leaves angry (`lives: 3`, the store ends the run). `resultDelayMs: 1200`: the storm-off (or the last tip + confetti) is seen.
- Same-frame rules: the run clock runs first — an angry third monster on the time-up frame ends as `"timeup"` (deterministic, as robot-collector).

## Scene and camera

- **Fixed front view, one yaw** (the set must read at once — bubble → wheel → cauldron → hatch — and nothing in the game moves the camera): `useFittedView({ area: { x ±3.0, y 0–2.9, z −2.0…+0.9 }, pitch: 22°, yaws: [0], margin: { top: 0.17, bottom: 0.1, left: 0.02, right: 0.02 }, padding: 8, shift: true })`; `<CameraRig camera={{ position, lookAt }} offset shift>` (static). The **order bubbles live in `definition.Hud`** (DOM, stacked under the HUD chips in one safe-area column, marked `data-arcade-safe-area`), so the P-15 DoD "the order bubble never overlaps the HUD at 390 × 844" holds structurally: the shell lays the column out and `useFittedView` keeps every 3D element under it clear (screenshots at 1280 × 800, 390 × 844, 844 × 390, banner open and closed, in the browser tests).
- Layout: counter (y 0.9) across z +0.6; the lazy Susan on the left; the cauldron on a stove drum at centre (x 0, z −0.1, base y 0.9); the chef behind the counter at (−0.9, 0, −0.8); the hatch at z −1.7 (two slots x ±0.8, opening y 0.7–2.3, monsters stand on the floor behind it); shelves of instanced jars on the back wall; the queued monster dimmed at z −2.6.
- `environment: { background: "#3f3f46", fog: ["#3f3f46", 16, 42], lighting: "indoor" }`; warm key from the stove side. `orientation: "any"`: the same fixed area fits portrait (stacked reading) and landscape.

## Core helpers used

`GameDefinition` (`durationMs`, `lives`, `resultDelayMs`, `touchControls`, `hudStats` Served, `Hud` with the order bubbles, `environment`), `useRunFrame`, `useGameTime`, `useInput` (`pressed`, `tap`, `jumpPressed`, `actionPressed`), `useFittedView` + `CameraRig` (static), `useSafeArea` (through the fit and the Hud), `useArcadeStore` (`addScore`, `loseLife`, `end`), `core/math` (`createRng`, `rngNext`, `randomSeed` in the Scene only), `core/limits` (`withinServerLimits`, `capScore`), `createArcadeStore` + `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`; tests), `<Model fallback>`, `<Model tint>`, `<DynamicInstancedModel tinted>` (ingredient pools, per-copy tint), `<InstancedModel>`, `BlobShadow`, `useCanvasTexture` (order icons, jar labels), `REUSED_ASSETS` / `SHARED_ASSETS` / `EXPANSION_ASSETS` + `EXPANSION_GLB_SIZE` / `EXPANSION_GLB_POINTS` (`cauldronInnerRim`) / `CAULDRON_INNER_RADIUS_GLB` / `expansionPoint`, rig (`<HumanoidModel>`, `useHumanoidPose`, `idlePose`, `cheerPose`, `aimArm`, `turnBone`, `blendPoses` + `POSE_MASK`, `carryPose` (reach blend), `CHEF_LANDMARKS` — see Risks), `core/motion` (`hop`, `waddle`, `hover`, `squashStretch`), `core/fx` (`useFx`: `burst` splash / smoke / confetti / sparkle, `score`, `warm`), `useQuality` + `scaledCount`, perf probe `?perf=1`, P-06 audio (below). Not used: `core/ai`, `core/path`, `core/ballistics` (the toss arc is a fixed parabola in `rules.ts`), `Trail`, `core/kit`, `material` override. The wheel indexing, the toss arc and the order icons are game-local (as treasure-island's ellipse clamp); nothing generic is planned in the folder.

## Assets

No new generation: every GLB is in `core/modelManifest.ts`. Fits in `assets.ts`, derived from the measured sizes, checked in `assets.test.ts` on the real meshes.

| id | class / source | target in game | rules footprint | fallback |
|---|---|---|---|---|
| monster | A `EXPANSION_ASSETS.monster` (default fit, pale base), `<Model tint>` per type | 1.4 m tall | none (queue logic) | capsule |
| cauldron | A `EXPANSION_ASSETS.cauldron` (default fit 0.9 wide) | rim ≈ 1.48 m over the stove | none (toss resolves in rules) | cylinder |
| chef | D `REUSED_ASSETS.chef`, scale from the measured height (~1.6 m at the counter) | full body behind the counter | none | capsule |
| apple, burger, sock | D `REUSED_ASSETS.*` | 0.15–0.35 m per slot | none | sphere / cylinder / box |
| banana, tinCan | D `SHARED_ASSETS.*` | 0.15–0.35 m per slot | none | capsule / cylinder |
| fish | C `EXPANSION_ASSETS.fish` (default fit) | 0.35 m long | none | capsule |
| procedural | B: eyeball (sphere + iris), slime cube (rounded box), lazy Susan disc + rim, stove drum, counter, hatch + frame, shelves + instanced jars, cave walls, liquid disc (r = `CAULDRON_INNER_RADIUS_GLB` × scale ≈ 0.331, at `cauldronInnerRim` height − 0.03), bubbles, steam column, horns / party hat / top hat per type, order icons | | | |

- Three monster **types**: jolly (lilac `#a78bfa`, party hat), greedy (green `#4ade80`, top hat), grumpy (pink `#f472b6`, horns) — tint × pale base, headgear as children of the monster group at a measured head anchor (game-local constant in `assets.ts`, verified on the real mesh in `assets.test.ts`).
- `assets.spec.json` lists only `monster` and `cauldron` (the GLBs under `/models/3d/monster-kitchen/`, batch 1, already imported); everything else is shared/reused. The catalog's mushroom decor (E.4, P3) is deferred — open question below.

## Files

`meta.ts` (data; scoring provisional until the limits PR) · `index.tsx` (`GameDefinition`) · `rules.ts` (wheel, ingredients, toss, orders, patience, scheduler, drift, scoring; pure, seeded) · `rules.test.ts` · `poses.ts` (pure: chef `reachThrowPose`, cheer blend) · `poses.test.ts` (on the real chef via `rigCharacter`) · `assets.ts` + `assets.test.ts` (fits, liquid disc, head anchor, chef scale) · `Scene.tsx` (one `useRunFrame`, camera, fx, audio) · `Kitchen.tsx` (counter, stove, hatch, shelves, jars, walls) · `Wheel.tsx` (lazy Susan, slots, ingredient pools, toss arcs) · `Cauldron.tsx` (GLB, liquid, bubbles, steam) · `Monsters.tsx` (monsters, tint, headgear, queue) · `Chef.tsx` (humanoid, poses) · `Hud.tsx` (order bubbles, patience bars) · `Primitives.tsx` (stand-ins, eyeball, slime, headgear, icons) · `assets.spec.json` · `README.md` · `public/images/3d/monster-kitchen.webp` · `tools/thumbs/inputs/monster-kitchen.mjs`.

## Test plan

`rules.test.ts` ≤ ~600 lines (K.4), behaviour over branches; core is already tested; the bots reuse `core/testing/botHarness.ts`.

- **Tuning pins:** `WHEEL`, `TOSS`, `ORDERS`, `PATIENCE`, `SERVE`, `DRIFT`, `FACTOR` equal their literal values (a changed constant fails at once).
- **Wheel:** indexing is a bijection mod 8; ±1 rotation moves the right ingredient into the front arc; every slot ≤ 3 rotations from the arc; drift fires on the 6 s schedule from 50 s, seeded direction; a tossed slot is empty exactly 0.9 s.
- **Orders / scheduler:** deterministic per seed; the length table by arrival; kinds ⊆ the 8; the second window's first order at 70.8; a queued monster steps up only when its window frees; first order at 0.5 s.
- **Toss:** one in flight (a second toss in the same flight or a burp is ignored); resolution at +0.55 s; a match advances exactly the earliest order needing it; a wrong kind restarts that order, −3 patience and locks 1.2 s; an empty slot cannot be tossed; patience drains during flights.
- **Patience / lives:** drains 1.0 / 1.15 / 1.3 after the 1.5 s grace; angry at 0; the third angry ends `"lose"`; grace pauses drain but not penalties.
- **Scoring + proof:** `orderPoints` events; the completion recurrence (≥ 4.45 s cycles, ≤ 24 completions, ceiling 4920) checked on 1,000 seeds; `B(t) ≤ 240 + 60·t` at every completion time; every run passes `withinServerLimits`, `capScore` a no-op; the oracle bot (200+ seeds, 60 fps, 20 fps and random 4–50 ms frames in turn, three run twice for determinism) reaches ≥ 90 % of `maxScore`; spam, wrong-only and idle bots never exceed any limit; the wrong-only bot loses at ≥ 20.3 s; an idle run times out with 0 at 90000 ms.
- `poses.test.ts` / `assets.test.ts`: the chef's reach meets the wheel — the posed hand lands within 5 cm of each of the 3 front slot positions; hands never cross the T reach through the reach blend; soles within 1 cm of the floor in idle, reach and cheer; the liquid disc sits inside the measured rim; the head anchor is on the head through the wobble; fitted sizes from the table.
- Browser (headless CDP, flags + mock): the common criteria (03), banner open and closed, Retry ×10 keeps `geometries` flat; screenshots at 1280 × 800, 390 × 844 and 844 × 390: the order bubble never overlaps the HUD or the touch controls (P-15), nothing important under the HUD.

## Performance

Target **35** draw calls, cap **40** (spec ≈ 35, test criterion ≤ 40). Estimate: walls + counter + stove + hatch ≈ 5, wheel 2, ingredients 8–10 (one `DynamicInstancedModel` per kind, 2 copies each: wheel + flight), cauldron 1 + liquid 1 + bubbles 1 + steam 1, monsters ≤ 3 (2 active + 1 queued) + headgear 3, chef 1–2, blob shadows 2, jars 1, fx pools ≤ 4, score sprites ≤ 2 → 30–36. Triangles ≤ 70k (monster 8k × 3, chef ~18k). Pools sized at mount (`fx.warm("splash", "smoke", "confetti", "sparkle", "score")`); no per-frame allocation. `useQuality`: bubbles and steam scaled by `scaledCount`, steam off and jars halved on "low". Lights: the `indoor` preset only. Measured with `?perf=1` (p95 on the mid-phone profile, 09 §L.3) and reported here.

## Audio

Designed against 06 §9.3 (`playSfx(name, { pitch, pan, volume })`, `startLoop(name)`); cues outside the 9.3 list are synthesized from it, so a later cue rename is a one-line map change. `startLoop("bubbling", { volume: 0.3 })` on play (stopped by the shell on pause/over/mute; fallback `"hum"` at 0.2); rotate `"click"` pitch 1.1; toss `"whoosh"` pitch 1.3 volume 0.3; right landing `"pop"` pitch 0.9 + a splash quiet (`"splash"` 0.3); wrong = burp `"buzz"` pitch 0.5 + `"thud"` pitch 0.6; order complete `"chime"` + happy chirp `"chime"` pitch 1.5 (fallback `"pickup"` 1.2); angry grumble `"buzz"` pitch 0.7 and the shell's `"lose"` on the third; win fanfare n/a (score attack — the shell still plays its end sting). Built before P-06 lands: bubbling → `"hum"`, pop → `"pickup"` pitch 0.7, then adopted with P-06.

## Accessibility

Order icons carry three channels at once — colour, silhouette and a shape outline ring — and match the 3D items; patience reads as a bar **and** a face (a drawn expression dot in the bubble); rotation has four equivalent inputs (arrows, A/D, swipes, the on-screen side arrows); a full playthrough works from the keyboard alone. Tap picking uses a generous raycast box per slot plus nearest-slot fallback, and the front-3 + Space path needs no precision at all; the shell's touch buttons are 72 px. `fx.shake` honours reduced motion (core); the wrong-toss shake is 0.1.

## Risks and open questions

- **Chef landmarks (needs Claude before the build):** `REUSED_ASSETS.chef` is a T-pose humanoid and `CHEF_LANDMARKS` still lives in `games/food-catcher/assets.ts`; games may not import each other, so per the `sharedAssets.ts` note this game is the one that gets them moved to core. Request: Claude moves `CHEF_LANDMARKS` to core (food-catcher adopts) before or with this build.
- **Toss on `tap`, not `tapDown`** (changed from spec; the core input contract — see Controls). If P-15 playtesting feels the release latency, the alternative is a drag-to-aim opt-in, which this game does not want.
- **Spam-lose:** wrong tosses can deliberately anger three monsters in ~20 s; the run is legal (score 0) and the window accepts it (19000 ms). Alternative feel-guard: penalties cannot drop patience below 1 s — rejected: it makes spam free and complicates the proof.
- **maxScore 4900** assumes the measured oracle lands ≥ 90 % of it; the limits PR tightens to ~ceiling × 1.03 if not.
- Numbers marked [A] in the spec (patience 10, drains, grace 1.5, penalty 3, flight 0.55, burp 1.2, refill 0.9, drift 6 s, lengths) are tuning starting points; the proof is re-run before the limits PR if any move.
- Headgear anchors and the monster tints are tuned on the real mesh during the build; a tint that muddies the pale base is swapped for a `material`-override colour (the treasure-island seagull pattern).
- The catalog's mushroom decor (E.4 P3, `EXPANSION_ASSETS.mushroom`) is left out of v1 for the draw-call budget; add as shelf decor later if the probe has headroom.
- Audio: P-06 may ship real `burp` / chirp / grumble cues; the fallback map adopts them by rename.

## Status

(empty until the build)
