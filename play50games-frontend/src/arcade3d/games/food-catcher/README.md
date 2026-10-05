# Food Catcher 3D

Owner: Cursor. Slug: `food-catcher`. Status stays `"soon"` until the game itself is built. This file is the design only. No scene or rules code yet.

## Concept

A chunky chef slides along a kitchen counter and catches food falling toward the board. Apples, bananas, strawberries and burgers add points, and five good catches in a row double the points. Socks and tin cans are junk: catch one and you lose a life. Three junk catches end the round, otherwise it lasts 90 seconds. The camera never moves. The toys are the Play50 vinyl-toy look, accent `#86efac`.

## Controls

Matches `meta.ts` (`scheme: "lanes"`). The published control lines are "Left / right arrows to move" and "Drag or tap left / right".

- Keyboard: Left and Right arrows, or A and D. Hold to keep moving. The chef does not jump.
- Touch: drag horizontally, or tap the left half of the screen to move left and the right half to move right.
- The chef's x position is clamped to the play area. Items are caught only when they overlap the chef.

## Rules

Good items: apple, banana, strawberry, burger. Bad items: sock, tin can. Banana and the tin can use the shared models. The other four foods, the sock and the chef are generated for this game.

- The round clock is 90 seconds of unpaused play. It starts when the run enters `playing`.
- The chef starts with 3 lives. A bad item that hits the chef costs one life and scores nothing.
- A good item that hits the chef scores points and adds 1 to the combo.
- A miss is any item that reaches the counter without hitting the chef. A good miss scores nothing. A bad miss does not cost a life (the junk was dodged).
- The combo resets to 0 on a miss or on a bad item, whether or not that bad item cost a life.
- The round ends when the third life is lost or when the clock hits 90 seconds. `end()` runs once.
- Pause (Esc, P, or the tab hidden) freezes the clock, spawning and falling. Resume continues the same run. Pause time is not part of `durationMs`.

Difficulty steps up at 15, 30, 45, 60 and 75 seconds. Each step raises the fall speed and how often items appear. The good-item rate is what the scoring proof uses. Bad items are extra and never add points.

| Elapsed | Min gap between good spawns | Fall speed | Chance a spawn is bad |
|---|---|---|---|
| 0–15 s | 1200 ms | 1.6 units/s | 12% |
| 15–30 s | 1000 ms | 2.0 | 16% |
| 30–45 s | 800 ms | 2.4 | 20% |
| 45–60 s | 650 ms | 2.9 | 24% |
| 60–75 s | 550 ms | 3.3 | 28% |
| 75–90 s | 500 ms | 3.8 | 32% |

The first good item cannot spawn before 500 ms. Fall speed is the vertical speed of items already in the air; a step does not teleport them.

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

Award, before the cap:

- Combo under 5: a good catch is +10.
- The good catch that brings the combo to 5, and every later good catch until a reset, is +20 (the 2x multiplier).
- A miss or a bad item sets the combo back to 0. The next good catches are +10 again until the combo reaches 5.

Why that cannot break the limits:

- A catch is worth at most 20 points.
- Good items are spawned at most once per 500 ms, and not before 500 ms. In the first `t` milliseconds the number of good spawns is at most `floor(t / 500)`.
- Catching all of them at 2x is at most `20 * floor(t / 500)` points. With `n = floor(t / 500)`, the elapsed time is at least `500n` ms, so the server budget is at least `50 * 500n / 1000 = 25n` points. `20n` is under that, which is the integer test `score * 1000 <= 50 * durationMs`. A 20-point catch needs only 400 ms of budget, and the gap is 500 ms.
- A full 90 s round can spawn at most `floor(90000 / 500) = 180` good items. At 20 points each that is 3600, under both `50 * 90 = 4500` and `maxScore` 5000.
- Bad items add no points, so they only make the total smaller.
- The submitted duration is unpaused play time. The clock stops at 90 s, so `durationMs` is at most 90000, inside the 100 s maximum.
- If the third life is lost before 5 s, `end()` waits until `durationMs` is 5000 and awards nothing more. The run then meets `minDurationMs`. Points earned in those 5 s are at most `20 * floor(5000 / 500) = 200`, and the 5 s budget is `50 * 5 = 250`.

`rules.ts` still clamps the returned score with the same integer test (`min(awarded, 5000, intdiv(50 * durationMs, 1000))`) so a bug in the spawner cannot submit an illegal total. With the gaps above, a perfect run never touches the clamp.

## Camera and scene layout

The camera is fixed for the whole run. It sits in front of and slightly above the counter, looking at the middle of the play area. It does not follow the chef.

The play area is 8 units wide. The chef moves on x from -3.6 to 3.6 along the front edge of the counter (y = 0). Items spawn at y = 6, inside x = -3.4 to 3.4, and fall straight down. The counter and the kitchen wall behind it are code primitives (a box and a backdrop), not generated models. Lanes are only the left/right range. Items do not switch lanes as they fall.

## Assets

Generate (this game's `assets.spec.json`, universe seed 5152):

| id | Kind | Notes |
|---|---|---|
| chef | character | Image-to-3D from `tools/hyper3d/concepts/food-catcher-chef.png`. The player. Animated in code. |
| apple | prop | Good item. |
| strawberry | prop | Good item. |
| burger | prop | Good item. |
| sock | prop | Bad item. |

Reuse from `public/models/3d/shared/` (not in this spec):

| id | Role |
|---|---|
| banana | Good item. |
| tinCan | Bad item. |

Until a GLB exists, each of those ids is a coloured primitive. Swapping the model is an `assets.ts` change, not a scene change. The Play50 Runner is not in this scene.

## HUD

- Score, in points (`1,234 pts`).
- Lives, 3 down to 0.
- Combo, the current streak. Show a 2x mark once the streak reaches 5.
- Time left, counting down from 90 seconds.

## Edge cases

- Hiding the tab, Esc, or P pauses the run. Spawning, falling and the clock stop until resume. `end()` is not called by the pause.
- At most 16 items exist at once. A spawn tick that would pass 16 is skipped, not queued, so a long cap does not dump a burst later.
- Catch and miss are resolved once per item. A caught item cannot also miss.
- `end()` is idempotent. A life loss on the same frame as 0:00 still ends once.
- The chef cannot leave the 8-unit width. Input past the edge holds the chef on the boundary.
- A run that loses its third life before 5 s does not submit early. It waits, paused for scoring, until 5 s, as described under Scoring.

## Test plan for `rules.ts`

`rules.ts` is pure. The same seed and the same list of inputs always return the same spawns, catches and score. No `Date.now`, no `Math.random`, no DOM.

- Same seed reproduces the same item kinds, x positions and spawn times.
- A different seed changes the sequence.
- Good catches 1 through 4 score +10 each. The 5th scores +20, and a 6th scores +20.
- A miss or a bad item resets the combo. The next good catch scores +10.
- Three bad catches end the run with 0 lives. A bad item that is not caught does not remove a life.
- The clock ends the run at 90 s.
- The good-item gap shortens at each 15 s boundary and is never under 500 ms.
- Catching every good item in a seeded full round scores at most 3600, and `score * 1000 <= 50 * durationMs` holds for that run and for a run that ends on the third life.
- The 16-item cap skips spawns and does not release them as a burst.
- Two `end` paths in one run (lives and the clock on the same tick) produce one result.
