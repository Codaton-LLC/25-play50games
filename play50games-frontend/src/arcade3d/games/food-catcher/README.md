# Food Catcher 3D

Owner: Cursor. Slug: `food-catcher`. The scene plays on top of `rules.ts`. Status stays `"soon"` until Claude reviews it.

| File | What it owns |
|---|---|
| `meta.ts` | Card data and `scoring`. Unchanged. Status stays `"soon"`. |
| `index.tsx` | `GameDefinition`: Scene, 2× Hud, assets, 90 s, 3 lives, combo stat. |
| `rules.ts` / `rules.test.ts` | Pure seeded catch, movement and the score proof. |
| `Scene.tsx` | One `useRunFrame` step, pointer ray, `useFittedView` camera, falling-item pool. |
| `Primitives.tsx` | Kitchen, chef and food stand-ins. |
| `Hud.tsx` | The 2× badge once the combo reaches 5. |
| `assets.ts` / `assets.spec.json` | Model ids. GLBs are not fetched until they are in `modelManifest.ts`. |

### What a new game copies from here

Copy the robot-collector split, not this folder. From this scene, the useful pattern is a fixed pool of falling slots updated in `useFrame` from a pure `step()`, with the camera fit from `useFittedView` (`shift: true`, yaw 0) so the play rectangle stays clear of the shell HUD.

## Concept

A chunky chef slides along a kitchen counter and catches food falling toward the board. Apples, bananas and burgers add points, and five good catches in a row double the points. Socks and tin cans are junk: catch one and you lose a life. Three junk catches end the round, otherwise it lasts 90 seconds. The camera never follows the chef. The toys are the Play50 vinyl-toy look, accent `#86efac`.

## Controls

Matches `meta.ts` (`scheme: "lanes"`). The published keyboard line is "Left / right arrows to move".

- Keyboard: Left and Right arrows, or A and D. Hold accelerates the chef toward that direction. Release decelerates to a stop. The chef does not jump.
- Touch, one mapping: while the pointer is down, shoot a ray through the pointer and intersect the play plane `z = 0`. The chef moves toward that hit's x, along the counter, and never faster than max speed. Releasing the pointer stops the input. The chef does not jump.

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

Why a scored end before 5 s cannot happen. Lives are the only early end, and quit does not submit a score. The earliest third bad item is spawn 6, and only if spawns 4, 5 and 6 all roll bad. Those spawns sit in the first step, so they fall at 1.6 units/s. The center drops 4.4 units in `4.4 / 1.6 = 2.75 s = 2750 ms` (55 frames of 50 ms). The item is inserted at y = 6.0 on its spawn frame and does not move on that frame.

| Spawn | Time | Earliest kind | Crosses y = 1.6 |
|---|---|---|---|
| 1 | 1200 ms | good, forced | 3950 ms |
| 2 | 2400 ms | good, forced | 5150 ms |
| 3 | 3600 ms | good, forced | 6350 ms |
| 4 | 4800 ms | first possible bad | 7550 ms |
| 5 | 6000 ms | second possible bad | 8750 ms |
| 6 | 7200 ms | third possible bad | 9950 ms |

The third life is lost at 9950 ms at the earliest, which is inside `minDurationMs` 5000 and `maxDurationMs` 100000. The run does not wait, and it does not pad the clock.

## Scoring

`meta.ts` (`kind: "points"`, `display: "int"`, `unitLabel: "pts"`):

| Limit | Value |
|---|---|
| `base` | 0 |
| `maxPointsPerSec` | 50 |
| `maxScore` | 5000 |
| `minDurationMs` | 5000 (5 s) |
| `maxDurationMs` | 100000 (100 s) |

The server accepts a points run only when `score` is an integer, `0 <= score <= 5000`, `5000 <= durationMs <= 100000`, and `score * 1000 <= 50 * durationMs`.

Award, before the clamp:

- Combo under 5: a good catch is +10.
- The good catch that brings the combo to 5, and every later good catch until a reset, is +20.
- A missed good item, or a caught bad item, sets the combo back to 0. The next good catches are +10 again until the combo reaches 5.
- A dodged bad item leaves the combo where it is. A later good catch stays on +20 if the combo was already 5 or more.

`n` good catches with no reset score `10 * n` when `n < 5`, and `20 * n - 40` when `n >= 5` (four +10 catches, then +20).

Cumulative goods on the game clock. Treat every spawn as good. That is the densest point stream the gap table allows, because a bad roll only removes points. After `n` spawns the score is at most the formula above, and the `n`th spawn is at time `t_n` from the schedule. At every `t_n`, `floor(50 * t_n / 1000)` is at least that score. The smallest slack on the spawn clock is 50 points, at the first spawn: 10 points against `floor(50 * 1.2) = 60`. From the fifth spawn on, each new good item is worth 20. The shortest gap is 500 ms, and 500 ms adds 25 points of budget. Step totals, still assuming every spawn is good:

| Clock | Good spawns so far | Points if all were already caught | Budget `floor(50 * t / 1000)` |
|---|---|---|---|
| 15 s | 12 | 200 | 750 |
| 30 s | 27 | 500 | 1500 |
| 45 s | 46 | 880 | 2250 |
| 60 s | 69 | 1340 | 3000 |
| 75 s | 96 | 1880 | 3750 |
| 90 s | 126 | 2480 | 4500 |

Perfect play catches an item only once its center has reached y = 1.6, and the round stops at 90 s. At 3.8 units/s the last step needs 24 frames of 50 ms (1200 ms) to fall 4.4 units, so the spawns at 88950, 89450 and 89950 ms are still in the air at 90 s. The other 123 spawns resolve in time. Four +10 and 119 +20 is `40 + 2380 = 2420`.

`2420 <= 5000` and `2420 <= floor(50 * 90) = 4500`. The integer server check is `2420 * 1000 = 2,420,000 <= 50 * 90000 = 4,500,000`.

`finalScore` returns `{ score: min(score, 5000, floor(50 * duration_s)), durationMs }`, with `duration_s = durationMs / 1000`, so the floor is `floor(50 * durationMs / 1000)`. A full clear submits duration 90000. A three-life loss submits the cross time of the third caught bad item, at earliest 9950. On either legal run the clamp does not change the awarded total.

## Camera and scene layout

The play rectangle that must stay on screen is x in [-4.2, 4.2] and y in [0, 6.5]. Its center is `(0, 3.25)`. The camera looks straight at that center from `+z`, with fov 40. It does not follow the chef.

`GameDefinition.camera` starts at position `[0, 3.25, 8.93]`, fov 40, lookAt `[0, 3.25, 0]`. Scene then fits the rectangle from `useThree` size, on mount and whenever the size changes:

```text
aspect = size.width / size.height
tanHalf = tan(20°)
z = max(3.25, 4.2 / aspect) / tanHalf
camera.position = (0, 3.25, z)
camera.lookAt(0, 3.25, 0)
camera.fov = 40
camera.aspect = aspect
camera.updateProjectionMatrix()
```

`tan(20°) ≈ 0.36397`.

| View | Aspect | z | What is tight |
|---|---|---|---|
| 375×812 portrait | 375/812 ≈ 0.4618 | 24.99 | width. Half-width is 4.2. Half-height is about 9.09, so y runs from about -5.84 to 12.34 and still contains [0, 6.5]. |
| 16:9 | 16/9 | 8.93 | height. Half-height is 3.25, so y is exactly [0, 6.5]. Half-width is 3.25 × 16/9 ≈ 5.78, which contains [-4.2, 4.2]. |

The counter and the kitchen wall are code primitives. Items fall straight down. Bad items (sock and tin can) wear a dark red ring, `#9f1239`, drawn in code around the item. The ring is not part of the GLB.

## Assets

Generate (this game's `assets.spec.json`, universe `food`, seed 5152):

| id | Kind | Notes |
|---|---|---|
| chef | character | Image-to-3D. Prerequisite: `tools/hyper3d/concepts/food-catcher-chef.png` must exist before that generation. The player. Animated in code. |
| apple | prop | Good item. `qualityOverride` 1500. |
| burger | prop | Good item. |
| sock | prop | Bad item. `qualityOverride` 1500. Subject: "old faded grey sock with a hole, dirty brown patches", then the Play50 style block and the prop suffix. |

Reuse from `public/models/3d/shared/` (not in this spec):

| id | Role |
|---|---|
| banana | Good item. |
| tinCan | Bad item. |

Until a GLB exists, each of those ids is a coloured primitive. Swapping the model is an `assets.ts` change, not a scene change. The Play50 Runner is not in this scene. The dark red ring is drawn for whichever bad id is in the air, primitive or GLB.

## HUD

The shell already draws score, time and lives. The game definition sets:

- `durationMs: 90000`
- `lives: 3`
- `hudStats: [{ key: "combo", label: "Combo" }]`

Scene writes the combo with `setStat("combo", combo)`. An optional small `Hud` draws a 2x badge when the combo is 5 or more. It does not repeat the score, the clock or the hearts.

## Edge cases

- Hiding the tab, Esc, or P pauses the run. Spawning, falling and the clock stop until resume. `end()` is not called by the pause.
- At most 16 items exist at once. A spawn the cap refuses is skipped, not queued. The gap schedule stays under that cap: the shortest gap is 500 ms and the shortest fall is 1200 ms on the 50 ms grid, about three items in the air.
- Catch and miss are resolved once per item, on the crossing frame.
- `end()` is idempotent. A life loss on the same frame as 0:00 still ends once.
- The chef cannot leave x [-3.5, 3.5].
- A scored end before 5 s is not produced. The earliest third bad catch is 9950 ms. Quit leaves through the shell and does not submit.

## Test plan for `rules.ts`

`rules.ts` is pure. The same seed and the same list of inputs always return the same spawns, catches and score. No `Date.now`, no `Math.random`, no DOM.

`rules.ts` exports the spawn schedule (`spawnTimes` for a 90000 ms clock returns the 126 times above, starting 1200, 2400, 3600, …).

- Same seed reproduces the same item kinds, x positions and spawn times.
- A different seed changes the kinds and the x positions. It does not change the spawn times.
- The first 3 spawns are good for every seed. From spawn 4 on, the bad chance is the table's chance for that spawn's step.
- Spawns are at least the step gap apart, and never under 500 ms.
- Good catches 1 through 4 score +10 each. The 5th scores +20, and a 6th scores +20.
- Missing a good item resets the combo. The next good catch scores +10.
- Catching a bad item resets the combo and costs one life.
- Dodging a bad item keeps the combo and the lives. If the combo was already 5 or more, the next good catch still scores +20.
- Three caught bad items end the run. The earliest schedule (spawns 4, 5 and 6 are bad, and each is caught) ends at 9950 ms.
- The clock ends the run at 90 s.
- Fixed frame step 50 ms. An item spawned at T sits at y = 6.0 on that frame and then moves `speed * 0.05` on each later frame. Perfect play treats every spawn as good and catches it on the frame its center crosses y = 1.6. The test asserts the score is exactly 2420 (123 catches: `4 * 10 + 119 * 20`).
- `finalScore` of that run is `min(2420, 5000, floor(50 * 90)) = 2420`.
- The 16-item cap skips a refused spawn and does not release it later.
- Two `end` paths in one run (lives and the clock on the same tick) produce one result.

## Known issues / open questions

- The chef concept PNG `tools/hyper3d/concepts/food-catcher-chef.png` is a prerequisite for the image-to-3D chef. It is not part of this change, and the chef cannot be generated until it exists.
- `meta.ts` still publishes the touch line "Drag or tap left / right". The scene uses the single pointer-x mapping in Controls. That string is outside these two files.
- `skills.md` still lists a strawberry prop for this game. This spec does not generate one.
- Shared banana and tin can stay on the shared spec (seed 5050). This game only places them, and it does not regenerate them.
