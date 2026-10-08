# Clean the City

Owner: Cursor. Slug: `clean-city`. Game 8 of the 3D Arcade. Status stays `"soon"`. This file is the design. `rules.ts` is the pure game; `Scene.tsx` plays it. `meta.scoring` was tightened on 2026-10-07 (4940, 43–250 s; see "Server limits").

The mechanic is the robot-collector one: walk, touch an item, it is collected. Movement, the speed guard, circle-vs-AABB collision and the camera fit are copied from that game. This folder does not import it.

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring` (must equal `arcade-games.json`). Plain data, server-safe. The limits change only with the proof below (Claude's limits PR). |
| `index.tsx` | The `GameDefinition` GameShell runs: Scene, Hud, assets, `durationMs: 240000`, camera, `hudStats`, instructions. |
| `rules.ts` | Map configs, seeded litter, movement, pickups, scoring. Pure, no three.js/React/DOM/`Math.random`. |
| `rules.test.ts` | Vitest for `rules.ts`, including the scoring-limit proof below. |
| `sizes.test.ts` | Vitest for the drawn sizes: the litter stand-ins (on y = 0, one fresh set per mount, all freed on dispose), the bottle and bag GLBs fitted to them (the real meshes, within 5 %) and the runner's scale (the real runner.glb). |
| `props.test.ts` | Vitest for the obstacle props (see "Obstacle props"): the bench, bin, lamp, palm and umbrella GLBs as drawn (real meshes, `assets.ts` fits, `propSpots.ts` spots and turns) against their squares, the litter spots, the runner's height, and rays from the fitted cameras to every litter spot. |
| `Scene.tsx` | The frame loop. On mount, `useState` builds all three layouts and the reachable-spot cache. The frame loop only steps and writes the store. |
| `camera.ts` | The camera constants (pitch, follow, reach, the fitted view's options). Plain data, shared by `Scene.tsx` and `props.test.ts`. |
| `Primitives.tsx` / `propSpots.ts` | Park, city and beach look: ground, paths, the obstacle props (`<InstancedModel>` per kind and map: GLBs for benches, bins, lamps, palms and umbrellas, primitives for trees and buildings, each primitive also the GLB's fallback), and the stand-in runner and litter. `propSpots.ts` is the pure part: where each prop stands (the rules' squares) and how it is turned. Its `GLB_PROPS` is the one list of GLB props: `Primitives.tsx` `GlbProps` draws exactly its entries (asset and spots as listed), so `props.test.ts` checks what is drawn. |
| `Decor.tsx` / `decorSpots.ts` | Decoration beyond the floor (see "Decor around the maps"): the ground around the park and the city, the city's kerb, street line and parked cars, the park's pigeons (built in code). `decorSpots.ts` is the pure part (spots, the pigeons' animation). |
| `decorSpots.test.ts` | Vitest for the decor: every footprint (the car GLBs as drawn; the pigeon's parts in every pose, pecks and flight included) outside the floor content and the pickup burst's reach, and clear of every obstacle square, litter spot and reachable runner position of all three maps; the car GLBs in the manifest and at their sizes; the pigeon's size, facing and triangle count. |
| `Hud.tsx` | The map name (Park / City / Beach). Fixed box, `data-arcade-safe-area`. |
| `assets.ts` / `assets.spec.json` | Models used (`ModelAsset`s) / the Hyper3D spec for the two props only this game generates. |

### What a new game copies from here

- **Copy from robot-collector, not from this folder:** the file split; `rules.ts` as pure functions with a seed and a speed guard; from `Scene.tsx`, the run state made once in `useState` (no setState in the loop), `useRunFrame` → `rules.ts` → store calls (`addScore`, `setStat`, `end`), visuals that only read that state in `useFrame` and animate with `useGameTime()`, and `<Model asset fallback>`. Fit the camera with `useFittedView` and `CameraRig`. Games do not import each other.
- **This game adds one pattern:** three maps in a single run, chosen from config (same rules, different ground and obstacles). All three layouts are built once. The scenery toggles, and the same 20 litter slots move to the next map. A later multi-map game can copy that pattern. It still does not import this folder.
- **Do not copy:** the park, city and beach primitives, or the litter pop. They are decoration for this game.

## Concept

The Play50 runner walks three outdoor maps in one run: a park, a city block and a beach. Each map has 20 pieces of litter. Collect all 20 and the next map loads. Collect all 60 before the clock runs out and the run is a win. The clock is one 240 s timer for the whole run, not a timer per map. Faster clears earn a time bonus. The look is the Play50 vinyl-toy style with accent `#4ade80`.

## Controls

Matches `meta.ts` (`scheme: "joystick"`).

- Keyboard: WASD or the arrow keys. Diagonals are not faster. Esc or P pauses (GameShell).
- Touch: the virtual joystick (bottom left). It is analog, so a small push walks slowly.
- The camera yaw stays 0 (the floor is square). Up on the screen is −z, away from the camera, and right is +x (`inputToWorld` with yaw 0).
- Movement (`RUNNER` in `rules.ts`), the same shape as robot-collector's `ROBOT`: top speed 5 units/s, acceleration 24 u/s², braking 30 u/s². The runner turns to face where it is going (`turnRate` 14/s, eased).

## Constants

| Name | Value |
|---|---|
| Walk speed | 5 units/s |
| Acceleration / braking | 24 u/s² / 30 u/s² |
| Turn rate | 14 /s |
| Runner radius | 0.5 |
| Litter collision radius | 0.3 (the drawn mesh is about 0.9–1.0; the circle used for pickup and the proof stays 0.3) |
| Pickup reach | 0.8 (runner radius + collision radius) |
| Pair spacing | 5.4 between any two litter centres on the same map |
| Start spacing | 4.0 from the start pad to every litter centre |
| Prop spacing | 1.0 from a litter centre to any obstacle AABB. The floor boundary is not an obstacle. |
| Floor | 28 × 28 (centre box \|x\| ≤ 14, \|z\| ≤ 14) |
| Spawn box | \|x\| ≤ 13.5 and \|z\| ≤ 13.5, on the 0.5 grid |
| Start pad | `(0, 12)` on every map, on the side nearest the camera |
| Items | 20 per map, 3 maps, 60 in the run |
| Clock | 240 s (`durationMs: 240000`) |

`stepRunner` never moves the runner more than `5 * dt` in one step. After velocity, collision push-out and the wall clamp, it scales the step back if needed. The same guard is what the proof relies on. The wall clamp keeps the runner's centre inside the spawn box (\|x\| ≤ 13.5, \|z\| ≤ 13.5).

## Rules

- The run lasts 240 s of unpaused play. GameShell runs the 3-2-1 countdown and the clock. The clock and the walker both advance by the simulation frame dt. Nothing reads the wall clock, and nothing stores `state.clock.elapsedTime`.
- Three maps, in order: `park`, `city`, `beach`. The configs differ in ground colour, paths and obstacles. The litter rules are the same.
- Scene's `useState` on mount draws one 32-bit seed and builds all three layouts, plus each map's reachable-spot cache. Strict mode does not draw a second seed. The same run seed always gives the same three layouts. Nothing in the frame loop allocates a layout, a list or a vector.
- All 20 pieces of the current map are the same 20 slots. On a map change those slots are moved onto the next layout and their kinds are swapped. They are not remounted. The next map's pieces are not collectable until that write has happened, and pickups are not tested again on the swap frame.
- A piece is collected when the runner's circle (r = 0.5) touches the litter's circle (r = 0.3): the centres are within 0.8. The mesh is drawn at about 0.9–1.0 world units so it reads on a phone. That draw size is not the collision radius.
- Each piece has a ground ring and a soft glow, the same idea as robot-collector's battery glow: a flat ring on the ground and a pulsing glow, so a piece is visible at about 10 px per unit.
- The runner collides with the boundary and with every obstacle through `resolveSphereAabb` (`core/collision.ts`). Core has no circle push-out, so trees, lamps, palms and umbrella poles collide as squares, the way robot-collector's barrels do. The square's half-extent is the radius of what the camera sees of the prop: the tree's trunk and leaves, the lamp's base and globe, the palm's crown. The corner of that square sticks out past that circle (under 0.3 for a tree of half-extent 0.7). At the runner's height the palm trunk and the umbrella pole are thinner than their squares, so the runner stops short of them ("Obstacle props"). Paths and umbrella canopies are painted and do not collide.
- The 1.0 clearance test and the reachability flood fill use those same squares. Clearance is the distance from the litter centre to the obstacle AABB. The boundary is not in that list. The flood fill walks runner-centre cells that `resolveSphereAabb` would accept against those AABBs and the wall clamp. A litter spot is reachable when some accepted centre is within 0.8 of it.
- Map clear: the 20th pickup ends the map. The runner is placed on the next map's start pad with zero velocity, `stats.map` advances, and the 20 slots take the next layout's positions and kinds. Map 3's 20th pickup ends the run with `end("win")`.
- The clock reaches 0: GameShell ends the run with `"timeup"`.
- Scenery switches with `run.map`. All three scenery groups stay mounted; `Worlds` sets `visible` from `run.map` in a `useFrame` (priority -0.2), the same frame the litter moves, not a render later. The map change does not mount or dispose geometry.
- A layout must pass `isValidLayout`:
  - Litter sits on the 0.5 grid inside the spawn box (\|x\| ≤ 13.5, \|z\| ≤ 13.5). Each centre is at least 1.0 from every obstacle square and at least 4.0 from `(0, 12)`. Any two centres on that map are at least 5.4 apart. Every spot is in that map's reachable cache.
  - Obstacles are fixed by the map config, not by the seed. They leave corridors at least 2.2 wide (the runner is 1.0 across).
- Placement is not blind rejection sampling. For one pass:
  1. Start from that map's cached spots (spawn box, 1.0 clear of the obstacle squares, reachable).
  2. Drop every spot closer than 4.0 to the start pad.
  3. Pick a spot uniformly from the list that remains. Place it. Then drop every remaining spot closer than 5.4 to the piece just placed.
  4. Repeat until 20 pieces are placed. If the list is empty early, the pass fails.
- Up to 40 passes per map, continuing the same seed's rng. `FALLBACK_SPOTS` for that map is used only if all 40 fail, and the fallback passes `isValidLayout`. The test of 1000 seeds × 3 maps must not take the fallback.
- Kinds, five of each, shuffled by the layout seed: bottle, paper bag, tin can, banana.

### Obstacles per map

The collision shape is the square. The visual may be round. Benches, bins, lamps, palms and umbrellas are Hyper3D GLBs fitted to their squares (group D, see "Obstacle props"); trees and buildings are code primitives.

| Map | Obstacles |
|---|---|
| park | 3 benches, AABB 2.4 × 0.8. 2 trees, square half-extent 0.7 (visual circle r = 0.7). 1 bin, square 0.7. |
| city | 4 buildings, AABB 3.2 × 3.2. 4 lamps, square half-extent 0.3 (the base, below 0.2, and the globe span it; the post between them narrows from 0.35 to about 0.12). 2 bins, square 0.7. |
| beach | 4 palms, square half-extent 0.6 (the crown spans it, from about 1.0 up, above the runner's head; below it the trunk is about 0.3 across, off the square's centre). 3 umbrella poles, square half-extent 0.25 (the pole is 0.07 across; the canopy is visual and does not collide). 1 bin, square 0.7. |

## Scoring

| Event | Points |
|---|---|
| Litter | +50 (`addScore`, live in the HUD). 60 pieces = 3000. |
| Win (all 3 maps) | + 10 per **full** second left: `10 * floor(timeLeftMs / 1000)` |
| Time up | no bonus: `50 * collected` (at most 59 pieces, 2950) |

The final score is `runScore(collected, won, timeLeftMs)`. The duration GameShell submits is `elapsedMs`, the store's default, so `finalScore` is not overridden. Examples: a win at 45.19 s leaves 194 full seconds, so 3000 + 1940 = **4940**. A win at 90 s leaves 150 s, so 3000 + 1500 = **4500**. 40 pieces at time-up score **2000**.

### Server limits and why they hold (the proof)

`meta.ts` and `arcade-games.json` set `kind: "points"`, `maxScore` 4940, `base` 1000, `maxPointsPerSec` 100, duration 43–250 s (tightened 2026-10-07 from 6000 and 10–900 s, which accepted 6000 at a claimed 50 s: 1060 above the proven maximum). The server accepts a run only if it passes every check below:

- `score <= 4940`
- `43000 <= duration_ms <= 250000`
- `score * 1000 <= 1000 * 1000 + 100 * duration_ms`, that is, `score <= 1000 + 100 * t`

Only two kinds of run are submitted: a win, or a time-up at exactly 240000 ms (the store sets `elapsedMs = durationMs`). Quit does not submit and the game has no lives.

**Max score, any play.** The best win is the earliest one (step 4): **4940** = `maxScore`, with no room. A time-up is at most 2950. ✓

**Time up.** t = 240 s, 10 s (4.2%) under the 250 s maximum. The rate cap is 1000 + 24000 = 25000; the score is at most 2950. ✓

**Win at time t.** The score is `3000 + 10 * floor(240 - t)`. It falls as t grows. The cap `1000 + 100 t` rises. They meet at **t = 40.0 s**: 3000 + 10 × 200 = 5000 against a cap of 5000; a win at 39.9 s is still in that bonus bucket (5000 points) against a cap of 4990. The 43 s minimum duration already rejects any run before 43 s, and the rate line never binds inside the 43–250 s window (at 43 s it allows 5300, at the earliest win 5519). So any win before 43 s has to be **physically impossible**. It is, with 2.19 s to spare:

1. **Speed.** `stepRunner` never moves the runner more than `maxSpeed * dt` = 5 · dt in one step. The test drives 20,000 random steps with random dt and checks this.
2. **Clock.** One run has one countdown. `RunClock` (priority -1) counts every played frame, and `useRunFrame`'s dt is exactly the play time it counted in that frame, including the rest of the frame in which the countdown ends (`core/README.md`), so no frame is untimed. Pause stops both. Map changes happen while the run is already playing, so that frame is timed. The rules' whole-ms clock never runs ahead of `elapsedMs`, so driving time is at most `elapsedMs / 1000`. Step 4 still subtracts one `MAX_FRAME_DT` (0.05 s) as a conservative safety margin.
3. **Distance.** To collect a piece, the runner's centre must come within R = 0.8 of it. With the spacing rules, and the runner put back on the start pad when a map loads (it does not walk between maps), the minimal route is:
   - Start pad to the first piece of a map: ≥ 4.0 − 0.8 = 3.2.
   - Between two pieces: ≥ 5.4 − 1.6 = 3.8. Nineteen of those is 72.2.
   - One map is at least 3.2 + 72.2 = **75.4** units. Three maps are at least **226.2** units (`GUARANTEED_MIN_ROUTE`). Obstacles only make it longer. Two pieces 5.4 apart cannot be touched from one spot, because 5.4 > 1.6.
4. **Earliest win.** 226.2 / 5 − 0.05 (the safety margin of step 2) = **45.19 s** (`fastestFinishMs` = 45190). Time left is 240000 − 45190 = 194810 ms, which is 194 full seconds. The best possible score is 3000 + 10 × 194 = **4940**. That is exactly `maxScore` 4940 and ≤ 1000 + 100 × 45.19 = 5519 (579 points of room, 5.19 s past the 40.0 s line). The integer check is `4940 * 1000 = 4,940,000 <= 1,000,000 + 100 * 45190 = 5,519,000`. 45190 ms is 2190 ms (4.85%) over the 43000 ms minimum. Every later win scores less against a higher cap. A score of 4950 would need a win by 45000 ms, which step 3 rules out; the proof keeps 0.29 s of slack (the 0.05 s frame margin plus the unused 0.24 s of the 194-second bonus bucket).
5. **Any earlier pickup.** For k < 60 there is no time bonus, so the score is `50 * k`. The earliest moment k pieces can have been collected uses the same legs, and the rate cap is above that score. The tightest of those is the first piece: route 3.2, t = 0.59 s, score 50 against a cap of 1059. The win in step 4 is the tight case. A submitted run is only a win or a time-up (quit does not submit), and both are inside the duration window: a win is at least 45190 ms, a time-up is 240000 ms.
6. **Every seed.** `generateLayout` returns a layout that passes `isValidLayout`, which checks exactly the spacing used in step 3. The fallback passes those checks too. The 1000 × 3 test never takes it.

`capScore` still trims the final score to the server limit as a safety net. It rounds the duration the way GameShell does before submitting (`Math.round(elapsedMs)`). The tests check that it changes nothing for any reachable win or time-up.

Margins: `maxScore` 4940 equals the proven maximum (never undercut); `minDurationMs` 43000 is 2190 ms (4.85%) under the proven earliest win (45190 ms, 4.95% under the physical 45240 ms); `maxDurationMs` 250000 is 4.2% over the exact 240000 ms time-up; `base` 1000 / `maxPointsPerSec` 100 are unchanged. The frontier goes down over time while the rate line goes up, so base and rate are not levers here: the minimum duration trims the corner more strongly. The best a forger can post drops from 6000 to 4940 (the proven ceiling, 240 above the best bot run), at a claimed 43000 ms or more, and the run-token TTL (`max_duration_ms` + 300 s) shrinks from 1200 s to 550 s.

Measured (throwaway bots, deleted, nothing committed): the test's nearest-first perfect bot (12 seeds) wins at best in 87407 ms, 4520 points. A planned bot (2-opt plus or-opt order over the reach-shortened legs, 12 restarts, touch points of the shortest path through the 0.8 reach disks, grid paths around obstacles) on the 15 luckiest of 3000 seeds plus 8 typical seeds, at 16.7 / 8.3 / 50 / random 1–50 ms frames: 184 wins, best 69205 ms = **4700** (seeds 934, 89, 2727, 967); typical seeds 73–74 s, about 4660. Even with no obstacles, acceleration or turning, the planned orders on the luckiest seeds need at least 64–65 s (disk paths 319.8–326 units), so perfect driving would reach at most about 4750. A check against `core/limits` accepted every win from 45190 to 239999 ms (whole ms and .4/.6 fractions) and every time-up score 0–2950 with `capScore` a no-op, and rejected 4950, 42999 ms and 250001 ms.

### Why 240 s

The shortest legal clear is 45.19 s of straight lines. A real seed walks around benches and buildings, so a clean run is longer than that, on the order of a minute or more. 240 s is 80 s a map: enough to cross the 28-unit floor several times while looking for the last piece, and short enough that the bonus still matters (a 90 s clear is 4500, a 3-minute clear is 3600, and timing out scores at most 2950). 240 s sits inside the 250 s maximum. A per-map clock would reset the bonus and break the single duration the server checks, so the timer is one clock for all three maps.

## Scene and camera

- The camera looks three-quarter top-down, tilted 56° (`PITCH`), yaw 0, and follows a focus point 12% of the way from the floor centre to the runner (`FOLLOW`), with damping 4 (`camera.ts`). The floor is square, so the fit keeps yaw 0 on every aspect. Copy the fit from robot-collector's `camera.ts`. Do not import it.
- `fitView` keeps the whole 28 × 28 floor, boundary included, inside a safe screen area: below the HUD, and on touch screens out of the joystick's box. The joystick is checked in px, not as a share of the screen: 132 px joystick + 20 px gap + 8 px of air, plus the safe-area insets. The start pad `(0, 12)` sits on the side nearest the camera.
- Acceptance values the fit must hit (focus centred, touch insets 0):
  - 375 × 812: about 10 px per world unit. The floor's screen y runs from 298 to 533.
  - 812 × 375: the floor's screen y runs from 91 to 324, and the floor's near-left corner is to the right of the joystick box.
  - 1280 × 800: about 21 px per world unit.
- Resizing or rotating refits. Yaw stays 0, so the control mapping does not flip.
- Frame order: `<Simulation>` is the Scene's first child, so its `useRunFrame` step runs before the camera and the meshes. Visuals animate with `useGameTime()`, which freezes on pause, never `state.clock.elapsedTime`.
- The frame loop does not allocate. Layouts, the reachable-spot cache and the 20 litter slots exist from mount. A map change writes new x, z and kind into those slots and sets `stats.map`. Ring and glow meshes are the same 20, moved with the slots.
- No shadow maps. Moving things get a blob shadow. Litter and repeated props are instanced.
- Draw-call budget is the arcade one: ≤ 150, with 60 fps as the target. Measured (2026-10-07, production build at 1280 × 800, mid-run, `renderer.info.render.calls`, highest seen in a run in brackets): park 20 (21), 18 before the decor; city 23 (24), 17 before; beach 17 (18), no decor. Triangles (`renderer.info.render.triangles`): park 48.7k (the pigeon flock 3k of it), city 56.4k (the parked cars about 10.5k), beach 45.9k. Geometries and textures stay flat over 5 Retries. With the group D obstacle GLBs (one draw call per kind instead of two or three primitive parts; "Obstacle props"; 2026-10-08, production build at 1280 × 800 and 390 × 844, banner open, at map entry): park 17 calls / 60.6k triangles, city 21 / 68.9k, beach 14 / 65.3k; geometries and textures flat over 2 Retries.

## Assets

| Model | Source | Spec | Fallback until the GLB exists |
|---|---|---|---|
| runner | **shared** `models/3d/shared/runner.glb` (live) | `assets/shared.spec.json` | Capsule body, hoodie, headband. Not in this spec. |
| bottle | **this game** `models/3d/clean-city/bottle.glb` (live, group C: a clear jar of colourful scraps with a red cap, not the spec's crushed plastic bottle; see Group C below) | `./assets.spec.json` | Green crushed bottle, drawn at about 0.9–1.0, with the ground ring |
| paper bag | **this game** `models/3d/clean-city/bag.glb` (live, group C) | `./assets.spec.json` | Brown crumpled bag, drawn at about 0.9–1.0, with the ground ring |
| tin can | **shared** | `assets/shared.spec.json` | Crushed can, same draw size and ring. Not in this spec. |
| banana | **shared** | `assets/shared.spec.json` | Yellow banana, same draw size and ring. Not in this spec. |
| bench, bin, lamp, palm, umbrella (obstacles) | **this game** `models/3d/clean-city/{bench,bin,lamp,palm,umbrella}.glb` (live, group D: image-to-3D from `tools/hyper3d/concepts/clean-city-*.webp`) | `./assets.spec.json` | The primitives in `Primitives.tsx`: a box bench, a slate drum bin, a pole with a glowing ball, a trunk with a leaf blob, a cone on a pole |
| ground, paths, trees, buildings, start pad | primitives in code | none | (always primitives) |
| parked car, taxi, van (decor) | **pigeon-crossing's** `models/3d/pigeon-crossing/{car,taxi,van}.glb` (live, reused) | none (no generation) | Coloured boxes |
| pigeons (decor) | built in code (`Decor.tsx` `createPigeonParts`), no GLB | none | (always code: pigeon-crossing's 12k-triangle pigeon.glb made the flock 60k triangles; a decimated pigeon of about 800 triangles would need an assets PR) |

The bottle and the paper bag were generated first (group C): universe `shared-cast` and seed 5050, the same universe and seed as the shared tin can and banana, so the four litter pieces are one toy set. The runner, the tin can and the banana are reused, so they are not listed in this spec. The bench, bin, lamp, palm and umbrella followed (group D, 2026-10-07, user-approved): Gen-2.5-Medium image-to-3D from concept images (the spec's `concept`; the schema still says `mode: "text"`), 1500–2500 tris, 55–103 KB each. Trees and buildings were not generated: they stay primitives.

- Five of each litter kind on every map. Swapping a GLB is an `assets.ts` change, not a scene change.
- A GLB should face +z and stand on y = 0. The runner is about 1 unit tall. A litter GLB is scaled so the drawn piece is about 0.9–1.0. `scale`, `rotationY` and `yOffset` are adjusted in the assets PR. The pickup circle stays r = 0.3 whatever the mesh does.
- **Group C (2026-10-07):** the bottle and bag GLBs are fitted to their stand-ins' footprint and height (`createLitterStandIns`), centred and on y = 0 like them; the pool's random yaw turns them like the stand-ins. The bottle GLB is a squat jar (1.26 × 1.91 × 1.20, a clear bottle of colourful scraps with a red cap): `scale 0.471, stretch [0.743, 1, 0.776]` slims it to the stand-in's 0.44 × 0.90 × 0.44. The crumpled paper bag (1.90 × 1.90 × 1.21): `scale 0.421, stretch [0.775, 1, 0.9]` → 0.62 × 0.80 × 0.46. One InstancedMesh per pool, as the stand-ins (18 draw calls on the park either way). Played on the production build in headless Chrome (2026-10-07, a bot reading the run): all three maps cleared and won at 1280 × 800 (keyboard) and at 375 × 812 (joystick); the bag reads as a brown crumpled bag in its ring, and the runner walks with its arms and legs swinging. The bottle is the right size and centred in its ring, so it still reads as a pickup, but not as a bottle: at play size it is a multicoloured egg about 15 px tall on desktop and a coloured dot about 8 px tall on a phone (review, 2026-10-07), where the green stand-in read as a bottle. It is not what `assets.spec.json` asks for (a crushed plastic bottle). Open, the user decides: keep it, or approve one Gen-2.5 regeneration (Hyper3D credits) of a plain green or clear crushed bottle with nothing inside. Going back to the stand-in means removing `bottle.glb` and its manifest line together (`modelManifest.test.ts`) and dropping the bottle case in `sizes.test.ts`. Neither path changes a scale or the rules.
- Collision never comes from a model. Footprints are the squares in the obstacle table.

### Obstacle props

Group D (2026-10-07): the bench, bin, lamp, palm and umbrella GLBs draw the obstacles of all three maps (`propSpots.ts`: one copy on each square's centre, from `rules.ts` `MAPS`). One `<InstancedModel>` per kind and map (each GLB is one mesh: one draw call), the primitive as its fallback. The rules never see a mesh, so each GLB is fitted to its square with `scale` + `stretch` from the optimized GLB's measured bounds (Rodin makes the longest side about 1.9; the optimize step centres x and z and stands the mesh on y = 0):

| Prop | Square | GLB (w × h × d) | Fit (`assets.ts`) | Drawn (w × h × d) |
|---|---|---|---|---|
| bench | 2.4 × 0.8 | 1.893 × 0.842 × 0.803 | `scale 0.996, stretch [1.2727, 1, 1]` | 2.40 × 0.84 × 0.80, backrest at −z like the stand-in |
| bin | 1.4 × 1.4 | 1.390 × 1.903 × 1.394 | `scale 1.0043, stretch [1, 0.6541, 1]` | 1.40 × 1.25 × 1.40 (uniform would be 1.91 tall, twice the runner), slot facing the camera |
| lamp | 0.6 × 0.6 | 0.448 × 1.900 × 0.432 | `scale 1.3404, stretch [1, 0.7852, 1]` | 0.60 × 2.00 × 0.58, the round base fills the square (uniform would be 2.55) |
| palm | 1.2 × 1.2 | 1.775 × 1.903 × 1.782 | `scale 0.6734, stretch [1, 1.3264, 1]` | 1.20 × 1.70 × 1.20, the crown spans the square, taller than uniform (1.28); trunk about 0.3 across; a quarter turn or none per copy (never a half turn, see below) |
| umbrella | 0.5 × 0.5 (pole) | 1.780 × 1.902 × 1.737 | `scale 0.8428` | 1.50 × 1.60 × 1.46, pole 0.07 across; quarter turns (never a half turn: the canopy tilts towards the camera or sideways) |

- **Never bigger than the square.** Every vertex of every copy (turn included) lies inside its obstacle square, and the copy spans at least 95 % of it: the bench and the bin at every height, the lamp with its base and its globe, the palm with its crown. So from the camera the runner stops where the prop is drawn, never inside a drawn part. The one exception is the umbrella canopy, which the obstacle table already calls visual: it overhangs the pole square only above the runner's head (its lowest edge is at 0.99, the runner 0.95), and only out to 0.75 from the pole (0.25 + the runner's radius), where the runner's centre stops along an axis. The runner can stand under the canopy's rim, never further in.
- **Narrower at the runner's height.** Below the runner's 0.95 head the palm trunk (about 0.3 across, off the crown's centre: x −0.15 to 0.18, z −0.03 to 0.27 in the GLB's frame) and the umbrella pole (0.07) fill much less of their squares than the crown and the canopy above them, or the old primitives (a trunk of radius 0.5–0.6, a pole of radius 0.25) did. The lamp post narrows from 0.35 just above its base (0.55, below 0.2) to about 0.12 below its globe. The bench and the bin fill their squares at that height. So the runner, pushed into a prop, stops with ground between it and the drawn part: 0.33–0.57 short of a palm trunk and 0.20–0.23 short of a pole (0.83–1.07 and 0.70–0.73 from its centre to the nearest drawn part below its head), about 0 at a bench, a bin and a lamp base. The painted ground ellipse under each prop (half-extent + 0.15) marks the footprint, and the runner's ring touches it. `props.test.ts` caps each gap at today's shape (`BODY_GAP`: bench and bin 0.01, lamp 0.05, palm 0.58, pole 0.24), so a smaller or narrower mesh fails. The palm's widest gap (0.57) is on the GLB's −z side: unturned it faces away from the camera, behind the crown; the two palms with a quarter turn ((−8, −8) and (9, 3)) face it towards the nearer side wall. A half turn would show it to the camera and is never used (the test also caps the gap facing the camera and the floor's middle at 0.45). A wider trunk base or a sand mound would be an asset change, not a scale tweak: the user decides whether the look needs it.
- **The canopy can hide the runner.** From the camera, a runner standing behind a pole on the far (−z) side, up to about 1.4 from it, is hidden by the canopy, ring included (seen in the review on desktop and on a phone). The old primitive cone (radius 1.15, from 1.45 up) hid more by the same geometry. Litter is never behind a canopy (next bullets). A canopy that fades while the runner is behind it is optional polish.
- **Never over a litter spot.** Seen from above, no copy comes within half a drawn litter piece (0.475) of any spot litter can be placed on (the rules keep litter 1.0 from every square).
- **Never hides litter.** `props.test.ts` casts rays from the fitted cameras (1280 × 800, 1920 × 1080, 390 × 844, 375 × 812, 844 × 390 and 768 × 1024 with no HUD rects, the closest each fit allows, and a far camera with rays near 56°) from a 3 × 3 grid over the follow range, to the middle (0.4 up) of every litter spot near a prop, against the real triangles: none is blocked (a 2.18 palm, a 2.55 lamp, a 1.91 bin or a 1.85 bench would be). The tallest prop, the 2.0 lamp, stays under `VIEW.area`'s 2.6.
- **Playtest** (production build, headless Chrome, a bot clearing the maps; 1280 × 800 keyboard and 390 × 844 touch, cookie banner open; screenshots of all three maps): every prop reads as itself at play size (the slatted benches, the domed green bins, the dark lamp posts with cream globes, the palms, the red and white umbrellas). The bin is green on the park's green lawn, so it stands out less there than the old slate drum did: at play size it reads as a striped, glossy green dome (a ball or a watermelon more than a bin; its slot does not show on a phone), and at 1.25 it is 1.3 times the runner (the slate drum was 1.06). Lowering it does not help: its 1.40 width is fixed by the square (and the 95 % span check), so a lower bin is squatter and rounder, more ball-like. Open, the user decides: accept it, or approve a regeneration of a bin with a flat lid or a contrasting rim (an assets decision, Hyper3D credits). A ray from the live camera to each piece's middle, every 2.5 s, never met a GLB prop. Draw calls with the decor hidden, against origin/main (no decor there): park 15 (18), city 15 (17), beach 14 (17); the obstacles alone 4 (7), 4 (6), 3 (6). With the decor: park 17, city 21, beach 14 (highest seen in a run 18, 22, 15). Re-played after merging main (code-built pigeons) and the review fixes (2026-10-08, same build and sizes, a bot winning all three maps with keys and with the joystick, banner open): park 17 calls / 60.6k triangles, city 21 / 68.9k, beach 14 / 65.3k at map entry; no litter piece behind a GLB prop in 100 samples, the runner never covered in them; geometries and textures flat over 2 Retries; no console errors; the pigeon GLB is no longer fetched. Pushed into each palm, the runner's centre stopped 0.83–0.96 from the nearest drawn part below its head from the camera side and the floor's middle, 1.07 only on (−8, −8)'s wall side; 0.72 from a pole.
- **Not changed:** trees and buildings (no GLB, primitives). The 2.8 tall buildings can cover a piece right behind them from the closest desktop camera (seen twice in one city run, the same before this change).

### Decor around the maps

Pure decoration (2026-10-07, `Decor.tsx`, `decorSpots.ts`): `rules.ts`, the camera fit and the litter never see it.

- **Ground around the floor.** The park sits in a darker lawn, the city in asphalt (four flat strips touching the floor's edges, never under it, top just below y = 0 so litter glows past the edge stay on top). The beach keeps the sky colour around it: it reads as the sea.
- **City: a street beyond the far edge.** A kerb (far side and down both sides, none on the near side), a dashed centre line, and four parked cars along the far kerb, nose to +x: van (x −9.6), car (−4.4), taxi (3.4), car (9.4), all at z −15.2. They reuse pigeon-crossing's car, taxi and van GLBs (same urls, `assets.ts` copies its fitted stretch and rotationY; its scale × 0.82 makes the car 2.18 long, about 4 m next to the 0.95 runner as a 1.75 m person). Static `<InstancedModel>` per kind: 3 draw calls.
- **Park: five pigeons on the lawn beyond the far edge** (z −15.0 to −15.65), 0.48 tall (half the runner; life size, about 0.16, and 0.30 were 2–5 px specks). Each is built in code (`createPigeonParts`): a blue-grey body, a darker neck and head, a tail tipped up and two pink legs, six pieces of one low sphere, 600 triangles a bird and 3,000 for the flock (pigeon-crossing's pigeon GLB, tried first, is 12,000 triangles a bird for something 6–12 px tall on desktop and 3–6 px on a phone; review 2026-10-07). One core `<DynamicInstanced>` (1 draw call) placed every frame from `useGameTime()`: two pecks (a tip about a point under the beak), a pause and a small hop that turns it to a new heading every 2.8 s, each on its own phase. When the runner comes within 2.4 of one (it can, at the far edge), it flies 1.4 further out in an arc and lands; it comes back once the runner is more than 3.6 away. Visual only.
- **Where decor may stand** (`decorSpots.test.ts` checks each rule on the drawn meshes, the pigeon in every pose it takes): outside the square |x|, |z| ≤ 14.3 that holds everything the run collides with or spawns (the runner's body reaches 14.0, a litter glow 13.5 + 0.72 = 14.22, 14.29 at its pop-in overshoot), so nothing overlaps the floor, an obstacle, a litter spot or a reachable runner position (no ghost collisions, no prop the runner walks through). The one effect drawn past it is the pickup burst's fading outer edge (up to 13.5 + 1.0 = 14.5, opacity ≤ 0.21 past 14.3), which may slip under the city kerb; every car and pigeon stays outside 14.5. Decor never stands beyond the near edge (z > 14), the only side from which something could stand between the camera and the floor (the camera's x stays within the follow range, so decor beside or behind the floor never covers the runner or a piece). It stands close to the far edge, in the band the fitted camera shows at 1280 × 800, 390 × 844 and 844 × 390, banner open or closed (the landscape fits keep that band for the 2.6-tall props on the far edge). Played on the production build in headless Chrome (2026-10-07, a bot clearing the maps) at all three sizes, banner open and declined: every car and pigeon whole on the canvas and under no page element (HUD, map pill, joystick, banner) in every sample, one every 2 s with the runner anywhere from the far edge to the start pad. Re-played the same way after the pigeons became code-built (same day): the same result, the pigeons 5–9 px on desktop and 2–4 px on a phone, frozen while paused, geometries flat over 5 Retries, no console errors. A parked car can stand right behind a litter piece on the far edge; the piece is drawn in front of it (the car is farther from the camera everywhere), so it stays readable.
- The camera fit (`VIEW.area`, the floor) is unchanged. The car GLBs load in their own `<Suspense>`, so the run never waits for decoration; the pigeons need no load.

## HUD

GameShell draws Score, Time (counting down from 4:00) and `hudStats`:

- `[{ key: "items", label: "Litter", max: 20 }, { key: "map", label: "Map", max: 3 }]`

`setStat("items", n)` on every pickup, reset to 0 when the next map loads. `setStat("map", 1 | 2 | 3)` when that map loads. The scenery does not read the store: all three groups stay mounted and `Worlds` sets `visible` from `run.map` in a `useFrame` (priority -0.2), the same frame the litter moves.

The game's own HUD (`Hud.tsx`, `Hud: MapHud`) is one pill with the map name (Park / City / Beach), bottom right. It is a fixed 148 × 36 px box marked `data-arcade-safe-area`, so the camera fit keeps the floor clear of it and a map change never moves the fit, and its bottom offset adds `var(--arcade-bottom-obstruction)`, so the cookie banner never covers it on a phone.

## Edge cases

- Pause (Esc, P, tab hidden, window blur) stops `useRunFrame` and the clock. Visual animation freezes too: visuals animate with `useGameTime()`, which freezes on pause.
- Pause and resume reset R3F's `state.clock.elapsedTime`. Visuals never read it; `useGameTime()` only moves by the played frame delta.
- Map transition and the 20th pickup are the same frame: score the pickup, write the next layout into the existing 20 slots, park the runner on `(0, 12)`, set `stats.map`, and do not collect anything else that frame. No mesh is mounted or destroyed. The nearest new piece is at least 3.2 away, and one frame moves at most 5 × 0.05 = 0.25, so it is not collected on the following frame either.
- The 20th piece of map 3 and the end of the clock on the same frame: `RunClock` runs first and ends the run as `"timeup"`, so that piece is not collected (at most 2950). `end()` is idempotent.
- On a win, `setScore` and `end("win")` run in the same callback, after the clock ticked for that frame, so `timeLeftMs` and `elapsedMs` match the submitted duration.
- Retry and restart remount the Scene (`key = runId`). That mount builds a new seed, three layouts and a new cache. Nothing carries over, and the frame loop still does not allocate.
- A missing GLB shows its primitive. The ring and the glow are still drawn. An obstacle GLB that fails draws its primitive in the same square.

## Test plan

`rules.test.ts` (vitest):

- Layouts: deterministic per run seed and map id. 1000 seeds × 3 maps never return `FALLBACK_SPOTS` (the fallback itself still passes `isValidLayout`). `isValidLayout` rejects a pair closer than 5.4, a piece closer than 4.0 to `(0, 12)`, a piece outside the spawn box, a piece closer than 1.0 to an obstacle square, and an unreachable spot. Clearance and the flood fill use the same squares. The boundary is not treated as an obstacle. Placement picks from the list that is still valid after the previous piece, and a second call with the same seed returns the same spots.
- Route bound, not the exact shortest route: for each layout, `distance(start, nearest piece) − reach + 19 × (smallest pair distance − 2 × reach)`, or an MST on the 20 centres with the reach subtracted on every edge (plus the start leg). The test asserts that lower bound is ≥ `GUARANTEED_MIN_ROUTE` for the map (75.4) and that the three maps sum to at least 226.2. It does not search collection orders.
- Movement: reaches exactly top speed; diagonals are not faster; brakes to a stop; stops at a building and a bench and slides along them; a tree, lamp, palm and umbrella pole block as squares; 20,000 random steps never exceed 5 · dt, never enter an obstacle square and never leave the spawn box.
- Pickups: only the current map's 20 count; the 20th writes the next layout into the same slots and does not collect on that frame; map 3's 20th completes the run; nothing is collected twice.
- Scoring: 50 per piece; the time bonus uses full seconds only; a 90 s win is 4500; time-up with 40 pieces is 2000; `withinServerLimits` matches the server formula; `capScore` is a no-op on reachable results.
- Proof: `GUARANTEED_MIN_ROUTE` is 226.2 and the earliest win is 45190 ms; the 40.0 s line is the break-even of the rate line (5000 against 5000, and 39.9 s breaks it), and the 43 s minimum rejects both; `maxScore` equals `BEST_SCORE` (4940) and the minimum keeps 2190 ms under the earliest win; every win from 45.19 s to 240 s passes both limits; every time-up score passes; the boundary checks (4940 at 43 s and 250 s accepted, 4950, 42999 ms and 250001 ms rejected, 42999.6 ms rounds to 43000); an idle runner times out with 0.

`props.test.ts` (vitest, the real GLBs as drawn): every bench, bin, lamp, palm and umbrella pole of the three maps has exactly one copy on its square's centre; the GLBs are listed, one mesh each, trees and buildings unlisted; the documented drawn sizes, feet on y = 0, under 2.6; no node rotation, scale or matrix (the test's point cloud applies only the translation); quarter turns only, never a half turn for a palm or an umbrella; each copy inside its square and spanning it (the umbrella canopy only above the runner's head and within the runner's reach of the pole); below the runner's head each gap to the square's edges within `BODY_GAP`, and a palm's gap facing the camera or the floor's middle within 0.45; no copy within 0.475 of a litter spot; rays from the fitted cameras to every litter spot near a prop meet no triangle. Mutation-probed (bin unfitted or 1.91 tall, palm 2.18 tall, umbrella at scale 1 or 0.6, lamp 2.55 tall or wider, bench unstretched or 1.85 tall, a palm turned 0.4 rad, a smaller palm): each fails a check other than the documented sizes. Also (2026-10-08): the old palm turns (a half turn on (−9, 3)) and an umbrella half turn fail the turn check, the old palm turns and `[0, ¼, 0, −¼]` fail `BODY_GAP` (camera or middle side), the palm at scale 0.6, the lamp 0.85 as wide and the bin 0.9 as wide fail `BODY_GAP` too, and a `GLB_PROPS` entry drawing the lamp or the palm spots for the poles fails the listing checks.

Browser (when the scene exists; production build, flags on with the API mock):

- Steps: start, countdown, pause and resume, clear map 1, confirm map 2 loaded with Litter at 0 and Map at 2 and the same 20 litter meshes moved (no remount), pause 2 s on map 2 (litter still full size after resume), then time-up. A second run clears all three maps and wins.
- Desktop 1280 × 800 with the keyboard: about 21 px per unit. 375 × 812: about 10 px per unit, floor y 298–533. 812 × 375 with the joystick: floor y 91–324, and the floor's near-left corner stays to the right of the joystick box. Litter reads at that size because the mesh is about 0.9–1.0 and each piece has a ground ring.
- Checks: the win score equals `3000 + 10 * floor(timeLeftMs / 1000)` for the submitted duration; a time-up equals `50 * collected` at 4:00.

## Known issues and core gaps

- The scene is playable. The `meta.ts` limits were tightened on 2026-10-07 to the proof (4940 max, 43–250 s); break-even stays 40.0 s, the earliest win stays 45.19 s, and the 43 s minimum duration rejects anything earlier. `capScore` trims only an impossible finish (a teleporting test win at 7.7 s became 1,769; a real run cannot finish before 45.19 s, where the cap does not bind).
- `skills.md` and plan §4 list universe `street` for the bin, bench, palm, umbrella and lamp. They were generated in group D from concept images instead (no universe or seed; the MCP has none). The catalog update belongs to Claude.
- Core collision can push a circle out of a box (`resolveSphereAabb`) and can test two circles (`circlesOverlapXZ`). It cannot push a circle out of a circle. Round props are squares so the game does not need a `resolveCircleXZ`. The clearance check and the flood fill use those squares too.
- The scene uses the current core: `useFittedView` + `followFocus` + `CameraRig` (`shift: true`, yaw locked at 0), `useGameTime()`, `useRunFrame`, `<InstancedModel>` for map props, one `<DynamicInstancedModel>` pool per litter kind and `<DynamicInstanced>` for the litter rings and glows. Input is `inputToWorld(moveX, moveY, view.yaw)`. Every played frame is timed, including the countdown handoff; the proof's 0.05 s is only a safety margin.
- Litter: one `<DynamicInstancedModel>` per kind, pool size `PER_KIND` (5), placed by the same `update` whatever is drawn. A listed GLB (tin can, banana) is one InstancedMesh per GLB mesh for the whole pool, sharing the loader cache's geometry and material (nothing cloned, nothing for the game to free). Until a GLB is listed, or when it fails, the pool draws the game's stand-in parts (`useLitterStandIns`, passed as `fallbackParts`): one set per Scene mount, disposed on unmount, so Retries do not pile up geometries.
- The runner is `<HumanoidModel asset={ASSETS.runner}>` (runner.glb, auto-rigged), scale 0.503 in `assets.ts` (the shared v2 GLB, 2026-10-07, is 1.886 tall, so it draws 0.95, about 1 unit, next to its 0.90 stand-in; `sizes.test.ts` measures it). `PrimitiveRunner` (drawn unscaled) is the fallback while it loads or if it fails, and moves its arms and legs from the same pose (idle, walk, a short reach on each pickup, a cheer when a map clears). The stride and the body lift use the runner's own measured joints (`RUNNER_LANDMARKS`) and that scale: the walk's own stride keeps the planted foot still, but the phase never beats faster than `MAX_CADENCE` = 4 strides a second (as robot-collector and warehouse-rush), so at full speed (5 units/s against the v2 runner's 0.77 stride, which would beat about 6.5 times a second) the stride stretches to 1.25 and the planted foot slides about 38 % of the ground's travel (34 % with the v1 runner's 0.83). `MAX_CADENCE` 6.5 would remove the slide; that is the owner's call.
- Tin can and banana GLBs are instanced at scale 0.5 (longest side 0.95); bottle and bag are fitted to their stand-ins (Assets above). The obstacle props are fitted to their squares ("Obstacle props"). Trees and buildings stay primitives; their urls are not in the manifest, so nothing is fetched.
- Still open in the core, and this fit uses them: the cookie banner is found by a 1 s poll, and `env(safe-area-inset-bottom)` is not reported. A generic measurement bug belongs in `core/`, not a local fitter.
