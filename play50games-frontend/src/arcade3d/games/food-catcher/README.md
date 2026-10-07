# Food Catcher 3D

Owner: Cursor. Slug: `food-catcher`. The scene plays on top of `rules.ts`. Status stays `"soon"` until Claude reviews it.

| File | What it owns |
|---|---|
| `meta.ts` | Card data, control lines and `scoring`. Status stays `"soon"`. |
| `index.tsx` | `GameDefinition`: Scene, 2× Hud, assets, 90 s, 3 lives, combo stat, `finalScore` (the capScore safety net). |
| `rules.ts` / `rules.test.ts` | Pure seeded catch, movement and the score proof. |
| `Scene.tsx` | One `useRunFrame` step, pointer ray, `useFittedView` camera, falling-item pool. Only `FittedCamera` re-renders on a refit; the rest is memoised. |
| `Primitives.tsx` | Kitchen, chef, food stand-ins and the junk tell. |
| `Hud.tsx` | The 2× badge: always laid out, visible only while the combo is 5 or more. |
| `assets.ts` / `assets.spec.json` | Model ids. GLBs are not fetched until they are in `modelManifest.ts`. |

### What a new game copies from here

Copy the robot-collector split, not this folder. From this scene, the useful pattern is a fixed pool of falling slots updated in `useFrame` from a pure `step()`, with the camera fit from `useFittedView` (`shift: true`, yaw 0) so the play rectangle stays clear of the shell HUD.

## Concept

A chunky chef slides along a kitchen counter and catches food falling toward the board. Apples, bananas and burgers add points, and five good catches in a row double the points. Socks and tin cans are junk: catch one and you lose a life. Three junk catches end the round, otherwise it lasts 90 seconds. The camera never follows the chef. The toys are the Play50 vinyl-toy look, accent `#86efac`.

## Controls

Matches `meta.ts` (`scheme: "lanes"`). The published lines are "Left / right arrows to move" and "Hold and drag left / right".

- Keyboard: Left and Right arrows, or A and D. Hold accelerates the chef toward that direction. Release decelerates to a stop. The chef does not jump.
- Touch (and a held mouse button), one mapping: while the pointer is down, shoot a ray through the pointer and intersect the play plane `z = 0`. The chef moves toward that hit's x, along the counter, and never faster than max speed. Releasing the pointer stops the input. The chef does not jump. There are no on-screen buttons (`touchControls: []`).

## Constants

| Name | Value |
|---|---|
| Chef max speed | 9 units/s |
| Keyboard accel | 45 units/s² (0 to 9 in 0.2 s) |
| Keyboard decel | 45 units/s² (9 to 0 in 0.2 s) |
| Catch box | width 1.4, centered on the chef; top y = 1.6; bottom y = 0 |
| Item radius | 0.35 |
| Spawn center | y = 6.0, x uniform in [-3.4, 3.4] |
| Chef x | clamped to [-3.5, 3.5], so the catch box stays inside x [-4.2, 4.2] |
| Fall distance | 4.4 (from y = 6.0 down to the box top y = 1.6) |

Catch test: on the frame the item's center crosses the box top (center y was above 1.6 and is now at or below 1.6), the item is caught if its circle overlaps the catch box. Overlap is the usual circle-vs-rectangle test (center `(itemX, itemY)`, radius 0.35, box x in `[chefX - 0.7, chefX + 0.7]`, y in `[0, 1.6]`). That frame is the only test. An item that does not overlap on it is a miss, including one that later falls past the counter. The chef cannot catch it by sliding under it afterwards.

Touch steps at most `9 * dt` toward the projected x and does not pass it. Keyboard accel and decel are the only acceleration curve.

## Rules

Good items: apple, banana, burger. Bad items: sock, tin can. Banana and the tin can use the shared models. The apple, the burger, the sock and the chef are generated for this game.

One spawn stream. The clock starts at 0 when the run enters `playing`. A wait starts at 0 and again after every spawn. The wait length is the min gap of the step that contains the start of the wait. The next spawn time is that start plus the gap, and a spawn is emitted only when that time is under 90 s. Each spawn then rolls good or bad with the step's chance. The step is chosen from the spawn's own timestamp. Fall speed is fixed when the item spawns; a later step does not speed items that are already in the air.

The first 3 spawns skip the roll and are always good.

| Elapsed | Min gap between spawns | Fall speed | Chance a spawn is bad |
|---|---|---|---|
| 0–15 s | 1200 ms | 1.6 units/s | 12% |
| 15–30 s | 1000 ms | 2.0 | 16% |
| 30–45 s | 800 ms | 2.4 | 20% |
| 45–60 s | 650 ms | 2.9 | 24% |
| 60–75 s | 550 ms | 3.3 | 28% |
| 75–90 s | 500 ms | 3.8 | 32% |

Bracket is `[start, end)`. The 75–90 s row also covers a wait that starts at or after 75 s. The gap function:

| Wait starts at t | Gap |
|---|---|
| `[0, 15000)` | 1200 |
| `[15000, 30000)` | 1000 |
| `[30000, 45000)` | 800 |
| `[45000, 60000)` | 650 |
| `[60000, 75000)` | 550 |
| `[75000, 90000)` | 500 |

That schedule emits 126 spawns: 12, 15, 18, 24, 27, 30 across the six steps. The first six times are 1200, 2400, 3600, 4800, 6000 and 7200 ms.

- The round clock is 90 seconds of unpaused play.
- The chef starts with 3 lives. A bad item caught on the crossing frame costs one life and scores nothing.
- A good item caught on that frame scores points and adds 1 to the combo.
- A miss is an item that crosses the box top without overlapping the catch box. A missed good item scores nothing and resets the combo to 0. A missed bad item does not cost a life and does not change the combo (the junk was dodged).
- A caught bad item resets the combo to 0.
- The round ends when the third life is lost or when the clock hits 90 seconds. `end()` runs once.
- Pause (Esc, P, or the tab hidden) freezes the clock, spawning and falling. Resume continues the same run. Pause time is not part of `durationMs`.

Why a scored end before 9.5 s cannot happen. Lives are the only early end, and quit does not submit a score. The earliest third bad item is spawn 6, and only if spawns 4, 5 and 6 all roll bad. Those spawns sit in the first step, so they fall at 1.6 units/s. The center drops 4.4 units in `4.4 / 1.6 = 2.75 s = 2750 ms` (55 frames of 50 ms). The item is inserted at y = 6.0 on its spawn frame and does not move on that frame.

| Spawn | Time | Earliest kind | Crosses y = 1.6 |
|---|---|---|---|
| 1 | 1200 ms | good, forced | 3950 ms |
| 2 | 2400 ms | good, forced | 5150 ms |
| 3 | 3600 ms | good, forced | 6350 ms |
| 4 | 4800 ms | first possible bad | 7550 ms |
| 5 | 6000 ms | second possible bad | 8750 ms |
| 6 | 7200 ms | third possible bad | 9950 ms |

The third life is lost at 9950 ms at the earliest, which is inside `minDurationMs` 9500 (450 ms, 4.5%, of margin) and `maxDurationMs` 93000. The run does not wait, and it does not pad the clock. A bad-chasing bot over 3000 seeds and 11 frame patterns never ended sooner.

## Scoring

`meta.ts` (`kind: "points"`, `display: "int"`, `unitLabel: "pts"`):

| Limit | Value |
|---|---|
| `base` | 0 |
| `maxPointsPerSec` | 28 |
| `maxScore` | 2500 |
| `minDurationMs` | 9500 (9.5 s) |
| `maxDurationMs` | 93000 (93 s) |

The server accepts a points run only when `score` is an integer, `0 <= score <= 2500`, `9500 <= durationMs <= 93000`, and `score * 1000 <= 28 * durationMs`.

These limits were tightened on 2026-10-07 (from 5000, 5–100 s and 50/s, which accepted more than twice the provable maximum) to the proven envelope below plus 3–5%:

- `maxScore` 2500 is 3.3% above the proven maximum 2420.
- `maxPointsPerSec` 28 (an integer: the server casts it with `(int)`): 28 × 90 = 2520 is 4.1% above the best end ratio (2420 / 90 s = 26.889 pts/s), 3.7% above the all-good mid-run bound (2420 at the 123rd crossing, 89608 ms, 27.007 pts/s; no submitted run ends there) and 6.3% above the best lose run (2360 at 89608 ms, 26.337 pts/s). 27 would leave 0.4% at the time-up and fails the cumulative bound below by 52 points at the 126th spawn.
- `minDurationMs` 9500 is 450 ms (4.5%) below the earliest honest end (9950 ms, above). `maxDurationMs` 93000 is 3.3% above the exact 90000 ms time-up.
- `base` stays 0: a positive base would only widen what early runs may claim, and a negative one would reject the earliest honest lose runs (30 points at 9.95 s).
- The best a forger can post is 2500 at a claimed 89286 ms or more (2500 × 1000 / 28); a forged 2420 needs at least 86429 ms. Before, 5000 needed 100 s.

Award, before the clamp:

- Combo under 5: a good catch is +10.
- The good catch that brings the combo to 5, and every later good catch until a reset, is +20.
- A missed good item, or a caught bad item, sets the combo back to 0. The next good catches are +10 again until the combo reaches 5.
- A dodged bad item leaves the combo where it is. A later good catch stays on +20 if the combo was already 5 or more.

`n` good catches with no reset score `10 * n` when `n < 5`, and `20 * n - 40` when `n >= 5` (four +10 catches, then +20).

Cumulative goods on the game clock. Treat every spawn as good. That is the densest point stream the gap table allows, because a bad roll only removes points. After `n` spawns the score is at most the formula above, and the `n`th spawn is at time `t_n` from the schedule. At every `t_n`, `floor(28 * t_n / 1000)` is at least that score (the test checks all 126 spawns). The smallest slack on the spawn clock is 23 points, at the first spawn: 10 points against `floor(28 * 1.2) = 33`. From the fifth spawn on, each new good item is worth 20. The shortest gap is 500 ms, and 500 ms adds 14 points of budget, so the slack shrinks in the last step, but the stream ends at spawn 126 (2480 against `floor(28 * 89.95) = 2518`). Step totals, still assuming every spawn is good:

| Clock | Good spawns so far | Points if all were already caught | Budget `floor(28 * t / 1000)` |
|---|---|---|---|
| 15 s | 12 | 200 | 420 |
| 30 s | 27 | 500 | 840 |
| 45 s | 46 | 880 | 1260 |
| 60 s | 69 | 1340 | 1680 |
| 75 s | 96 | 1880 | 2100 |
| 90 s | 126 | 2480 | 2520 |

Perfect play catches an item only once its center has reached y = 1.6, and the round stops at 90 s. At 3.8 units/s the last step needs 24 frames of 50 ms (1200 ms) to fall 4.4 units, so the spawns at 88950, 89450 and 89950 ms are still in the air at 90 s. The other 123 spawns resolve in time. Four +10 and 119 +20 is `40 + 2380 = 2420`.

`2420 <= 2500` and `2420 <= floor(28 * 90) = 2520`. The integer server check is `2420 * 1000 = 2,420,000 <= 28 * 90000 = 2,520,000`.

Measured with throwaway bots (deleted, nothing committed): perfect all-good play over 11 dt patterns (1, 16.7, 1000/60, 1000/120, 1000/144, 1000/30, 50, 7, random 1–50, random 10–20, 16.7 with 50 ms spikes) × 40 seeds always scored 2420 at 90000 ms, never more; an adversarial bot that made crossings k−2..k bad reproduced the best lose run exactly (2360 at 89608 ms). Best honest score over time: 80 at 9.95 s, 460 at 30 s, 1280 at 60 s, 2220 at 85 s, 2420 at 89.6–90 s.

`finalScore` returns `{ score: min(score, 2500, floor(28 * duration_s)), durationMs }`, with `duration_s = durationMs / 1000`, so the floor is `floor(28 * durationMs / 1000)` (core `capScore`, on the whole milliseconds GameShell submits). `index.tsx` wires it as `finalScore: (s) => finalScore(s.score, s.elapsedMs)` with the shell store's score and play time. A full clear submits duration 90000. A three-life loss submits the cross time of the third caught bad item, at earliest 9950. On either legal run the clamp does not change the awarded total.

## Camera and scene layout

The play rectangle that must stay on screen is x in [-4.2, 4.2] and y in [0, 6.5] (z [-0.9, 1.05] covers the depth of the chef and the counter edge). Its center is `(0, 3.25)`. The camera looks straight at it from `+z` (pitch 0, yaw 0) with fov 40. It does not follow the chef.

`GameDefinition.camera` (`index.tsx`) is only the first frame: position `[0, 3.25, 12]`, fov 40, lookAt `[0, 3.25, 0]`. Scene's `FittedCamera` then fits the rectangle with core `useFittedView` and places a static `CameraRig` at `lookAt + view.offset` with `shift={view.shift}`:

```ts
const LOOK_AT = [0, 3.25, 0];
const VIEW = {
   area: { min: { x: -4.2, y: 0, z: -0.9 }, max: { x: 4.2, y: 6.5, z: 1.05 } },
   pitch: 0,
   yaws: [0],
   focus: [{ x: 0, y: 3.25, z: 0 }],
   fov: 40,
   padding: 8,   // px kept clear around the shell HUD and the 2x badge
   shift: true,  // lens shift: the rectangle may sit off-centre in the free space under the HUD
};
```

The fit finds the closest camera distance that keeps the rectangle inside the canvas and out from under the safe area (`useSafeArea`: the shell HUD, the 2× badge, the cookie banner; there are no touch controls). It reruns only when the canvas size or the safe area changes (resize, rotation, the banner), never because of play. The 2× badge is always laid out and only made invisible under a 5 combo, so reaching or losing the combo does not change the safe area and the camera z stays where it is.

The counter, the kitchen wall and the cabinet under the counter are code primitives. The wall spans y [-9, 16] and 24 units across, so the extra height of a portrait phone (y -6.2 to 12.7 at 375×812) and the extra width of an ultra-wide screen show kitchen, not empty background. Two code-drawn pieces hang on the wall behind the play area (`WallDecor` in `Primitives.tsx`): on the left a chalk menu board (slate drawn once with core `useCanvasTexture`: "MENU" and three faint dish lines, no font download; a wooden frame with a chalk ledge), on the right a wooden shelf on two iron brackets with a copper saucepan, a steel stock pot with a lid and a low steel pan. They replace two plain grey boxes that players read as holes. They stay muted and darker than anything that falls (no red, no bright yellow or white, no round fruit-like blobs), so the food and the red junk tell always read first. The wood and the metal are each one merged, vertex-coloured geometry, so the decor costs three draw calls (slate, wood, metal), one more than the two boxes. Items fall straight down. Bad items (sock and tin can) carry the junk tell, drawn in code: a dark red disc (`#9f1239`) behind the item and a bright red rim (`#f43f5e`) around it, both flat in the XY plane so they face the pitch-0 camera (two unlit draw calls per junk item). The tell is not part of the GLB.

## Assets

Generate (this game's `assets.spec.json`, universe `food`, seed 5152):

| id | Kind | Notes |
|---|---|---|
| chef | character | v2 (2026-10-07): image-to-3D from a new concept image kept outside the repo (18k tris, 509 KB, a 1.90 × 1.87 × 0.53 static T-pose: a big bearded head with glasses on a stand-up collar, a double-breasted jacket whose tunic skirt ends above the knees, a belt, trousers, chunky shoes, a toque; short legs). It replaced the group B chef (2026-10-06, from `tools/hyper3d/concepts/food-catcher-chef.webp`, still the spec's concept) at the same url. The player, animated by the core auto-rig (below). |
| apple | prop | Good item. `qualityOverride` 1500. |
| burger | prop | Good item. |
| sock | prop | Bad item. `qualityOverride` 1500. Subject: "old faded grey sock with a hole, dirty brown patches", then the Play50 style block and the prop suffix. |

Reuse from `public/models/3d/shared/` (not in this spec):

| id | Role |
|---|---|
| banana | Good item. |
| tinCan | Bad item. |

Until a GLB exists, each of those ids is a coloured primitive. Swapping the model is an `assets.ts` change, not a scene change. The Play50 Runner is not in this scene. The junk tell is drawn for whichever bad id is in the air, primitive or GLB.

- **The chef on the auto-rig** (2026-10-06; the v2 GLB re-measured 2026-10-07). `assets.ts`: `scale: 0.975` draws the 1.869-tall GLB (its 1.90 longest side is the arm span) at **1.82 m**, the `ChefPrimitive`'s height (hat top 1.83; the catch box in the rules is unchanged), with its joints `CHEF_LANDMARKS` measured once from the GLB (`chef.test.ts`, which also checks the drawn height): the head joint sits on the collar (the beard hides the neck), so the face, the beard and the toque turn rigidly; the tunic's skirt below the crotch is skirt-weighted down to its front hem (0.545), so it hangs between the stepping legs, and the bare thighs below it follow their own leg only. The Scene draws `<HumanoidModel asset pose applyLift={false} fallback={<ChefPrimitive/>}>` and builds the pose every frame in `useHumanoidPose` (after the step) from `poses.ts` (pure, tested on the real GLB in `chef.test.ts`): `idlePose` (a breath and a glance) when still; `walkPose` with an amount easing towards |`chefV`| / 5 m/s (`CHEF_RUN_SPEED`; 7.5 for the long-legged v1 chef) and a phase advanced by the distance run over the walk's own stride (`gaitPhaseStep`, `walkStride` × 0.975: about 1.56 m per unit of amount, 0.76 m at a walk, 1.27 m at a run), so up to about 5 m/s the planted foot stays put; faster it steps at most 4 strides a second, so the feet slide in a 9 m/s dash (2.25 m a stride for its own 1.27 m: the short legs); the GLB turns a quarter to face the way it runs above 1 m/s and back to the camera when it stops (`turnTowards`), and leans into the speed in its spine (`turnBone`, towards the travel direction in its own turned frame: forward while it runs sideways, a tilt while it faces the camera), because the old whole-body roll about the feet dipped the leading foot up to 11 cm into the counter once the model turned. On a catch, good or bad (`run.flashAt`, which the simulation sets for the catch flash), both arms reach up towards the item for 0.4 s and drop (`catchReach`: `carryPose(0.7 w)` blended by `min(1, 3w)`, `w = sin(πk)`, so the arms go through the forearms-forward carry; a plain blend into `carryPose(0.7)` swung them out level through the T-pose on the way up and down). The body group carries the GLB's rise over its planted foot (`bodyLift` × 0.975) instead of the stand-in's bob. The stand-in keeps facing the camera with its old bob and its whole-body lean.

## HUD

The shell already draws score, time and lives. The game definition sets:

- `durationMs: 90000`
- `lives: 3`
- `hudStats: [{ key: "combo", label: "Combo" }]`

Scene writes the combo with `setStat("combo", combo)`. The small `Hud` draws a 2x badge when the combo is 5 or more. It does not repeat the score, the clock or the hearts. The badge is marked `data-arcade-safe-area` and stays mounted and laid out for the whole run (`visibility: hidden` under 5), so its rect in the safe area never changes mid-run.

## Edge cases

- Hiding the tab, Esc, or P pauses the run. Spawning, falling and the clock stop until resume. `end()` is not called by the pause.
- At most 16 items exist at once. A spawn the cap refuses is skipped, not queued. The gap schedule stays under that cap: the shortest gap is 500 ms and the shortest fall is 1200 ms on the 50 ms grid, about three items in the air.
- Catch and miss are resolved once per item, on the crossing frame.
- `end()` is idempotent. A life loss on the same frame as 0:00 still ends once.
- The chef cannot leave x [-3.5, 3.5].
- A scored end before 9.5 s is not produced. The earliest third bad catch is 9950 ms. Quit leaves through the shell and does not submit.

## Test plan for `rules.ts`

`rules.ts` is pure. The same seed and the same list of inputs always return the same spawns, catches and score. No `Date.now`, no `Math.random`, no DOM.

`rules.ts` exports the spawn schedule (`spawnTimes` for a 90000 ms clock returns the 126 times above, starting 1200, 2400, 3600, …).

- Same seed reproduces the same item kinds, x positions and spawn times.
- A different seed changes the kinds and the x positions. It does not change the spawn times.
- The first 3 spawns are good for every seed. From spawn 4 on, the bad chance is the table's chance for that spawn's step (2000 seeds, within ±0.03).
- The kind is rolled from the seed, never taken from the spawn index: across seeds, each of the first three spawns shows all three good kinds, a later spawn of a forced-good run shows all three, and spawn 4 shows both junk kinds when it is bad.
- Spawns are at least the step gap apart, and never under 500 ms.
- Good catches 1 through 4 score +10 each. The 5th scores +20, and a 6th scores +20 (the real score change of each catching step is `[10, 10, 10, 10, 20, 20]`).
- Missing a good item resets the combo. The next good catch scores +10.
- Catching a bad item resets the combo and costs one life.
- Dodging a bad item keeps the combo and the lives. If the combo was already 5 or more, the next good catch still scores +20.
- Three caught bad items end the run. The earliest schedule (spawns 4, 5 and 6 are bad, and each is caught) ends at 9950 ms.
- The clock ends the run at 90 s.
- Fixed frame step 50 ms. An item spawned at T sits at y = 6.0 on that frame and then moves `speed * 0.05` on each later frame. Perfect play treats every spawn as good and catches it on the frame its center crosses y = 1.6. The test asserts the score is exactly 2420 (123 catches: `4 * 10 + 119 * 20`).
- `finalScore` of that run is `min(2420, 2500, floor(28 * 90)) = 2420`.
- Limits: no seed ends before `minDurationMs` 9500 even when every bad item is chased; chased and perfect runs at 4 frame steps stay under `maxScore` and 28 points per second; every spawn good and caught at its spawn time stays under the 28/s line (smallest slack 23 at the first spawn); the boundary checks (2420 at 90–93 s accepted, 93001 ms, 2501 and 9499 ms rejected, a forged 2420 needs 86429 ms).
- The 16-item cap skips a refused spawn and does not release it later.
- Two `end` paths in one run (lives and the clock on the same tick) produce one result.

## Known issues / open questions

- The chef GLB (v2, 2026-10-07) is drawn through the core auto-rig (Assets). Its feet slide in a dash above about 5 m/s (the cadence cap; more than the v1 chef's, its legs are shorter), it runs sideways to the camera (it turns to face the way it runs), and at a run the forward thigh pulls the tunic's front hem into a point (the core's skirt-weighting limit; under 5 cm of poke-through and under 2x stretch over a walk cycle, `chef.test.ts`). The mesh's right sole sits 9 mm above the left one, so a planted right foot hovers up to 9 mm over the counter.
- Portrait letterbox: the play rectangle is 8.4 wide and 6.5 tall, so on a portrait phone the fit is bound by the width and the rectangle fills only about a third of the screen height (375×812, measured: camera z ≈ 26, the view spans y -6.2 to 12.7, about 43 px per unit). The taller wall and the cabinet fill the rest with kitchen, but the items stay small (about 36 px across). A taller play area for portrait would change the fall distance and the score proof, so it is not done here.
- `skills.md` still lists a strawberry prop for this game. This spec does not generate one.
- Shared banana and tin can stay on the shared spec (seed 5050). This game only places them, and it does not regenerate them.
