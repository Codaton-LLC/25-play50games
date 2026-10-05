# Penalty Hero

Owner: Cursor. Slug: `penalty-hero`. Status stays `"soon"` until the game itself is built. This file is the design only. No scene or rules code yet.

## Concept

You are the striker. Ten penalties, one at a time, into a goal split into six zones. Pick a zone and shoot. A seeded keeper dives at one zone. Same zone is a save. Anything else is a goal. Goals in a row pay a streak bonus. The ball is seen from behind, and the six zones stay big enough to tap on a phone. Accent `#f472b6`.

## Controls

Matches `meta.ts` (`scheme: "tap-target"`). The published control lines are "Arrow keys to aim, Space to shoot" and "Tap a target zone".

- Keyboard: arrow keys move the highlight among the six zones. Space shoots the highlighted zone. The highlight starts on bottom-center.
- Touch: one tap on a zone aims and shoots it. There is no second button.
- A shot that has already started ignores further aim and shoot input until the feedback hold ends.

The six zones, from the striker's view:

| | left | center | right |
|---|---|---|---|
| top | top-left | top-center | top-right |
| bottom | bottom-left | bottom-center | bottom-right |

## Rules

The round is 10 shots. It does not end early.

- On each shot the keeper picks one of the six zones with a seeded weighted draw, then dives during the ball flight.
- Every zone starts at weight 2. After the shot, the zone the player chose gains +1 weight. The keeper therefore leans toward corners the player has already used, and every zone can still come up.
- The draw happens when the shot is locked. The player does not see the dive choice until the ball is in flight.
- If the dive zone equals the shot zone, the result is SAVED and the streak returns to 0.
- Otherwise the result is GOAL and the streak increases by 1.
- Feedback is the text GOAL or SAVED, held before the next shot can start.
- There is no power bar. Flight time is fixed, so timing does not change the score or the duration.
- `end()` runs once, after the tenth feedback hold.
- Pause (Esc, P, or the tab hidden) freezes the shot clocks. Resume continues the same shot. Pause time is not part of `durationMs`.

Each shot spends a fixed minimum of unpaused time, even if the player shoots on the first frame:

| Step | Minimum |
|---|---|
| Run-up and strike | 700 ms |
| Ball flight (the dive plays here) | 500 ms |
| GOAL / SAVED hold | 400 ms |
| Total | 1600 ms |

Aim time sits in front of that and can be 0 ms on touch, because the tap is the shot. If the player does not shoot, the aimed zone (or bottom-center, if they never aimed) auto-shoots after 20 s. That caps a run at `10 * (20000 + 1600) = 216000` ms, inside the 10 minute maximum.

## Scoring

`meta.ts` (`kind: "points"`, `display: "int"`, `unitLabel: "goals"`):

| Limit | Value |
|---|---|
| `base` | 0 |
| `maxPointsPerSec` | 150 |
| `maxScore` | 1500 |
| `minDurationMs` | 10000 (10 s) |
| `maxDurationMs` | 600000 (10 min) |

The server accepts a points run only when `score` is an integer, `0 <= score <= 1500`, `10000 <= durationMs <= 600000`, and `score * 1000 <= 150 * durationMs`.

Award:

- The first goal of a streak (streak becomes 1) is +100.
- Each later goal in that streak is +150, which is 100 plus a 50 streak bonus.
- A save scores 0 and sets the streak back to 0. The next goal is +100 again.

A perfect run is ten goals: `100 + 9 * 150 = 1450`.

Why that cannot break the limits:

- 1450 is under `maxScore` 1500. Any save replaces a 150 (or the opening 100) with 0 and also restarts the bonus, so every other line is lower than 1450.
- The fastest run is ten shots with no aim delay: `10 * 1600 = 16000` ms (16 s). That is above `minDurationMs` and below `maxDurationMs`.
- At 16 s the rate budget is `150 * 16 = 2400` points. The integer test is `1450 * 1000 = 1450000` against `150 * 16000 = 2400000`. 1450 is under 2400.
- Slower play only adds aim time, which raises the budget and does not add points. The auto-shot cap keeps `durationMs` at or below 216000, under 600000.
- Reduced motion may cut the motion, but the same 1600 ms still elapse, so the fastest case does not get shorter.

`rules.ts` still clamps with `min(awarded, 1500, intdiv(150 * durationMs, 1000))`. A perfect 16 s run scores 1450 and never touches the clamp.

## Camera and scene

The camera is fixed behind the ball, a little above the penalty spot, looking at the middle of the goal. It does not follow the ball.

On a 375 px portrait phone the goal fills the upper part of the view. The six zones are the tap targets, each at least 44 px. The striker and the ball sit in the lower third and do not cover the zones. The pitch is a ground plane. The goal frame and the net are boxes and a simple grid, not generated models.

## Assets

Generate (this game's `assets.spec.json`, universe seed 5155):

| id | Kind | Notes |
|---|---|---|
| striker | character | Image-to-3D from `tools/hyper3d/concepts/penalty-hero-striker.png`. The player. Animated in code. |
| keeper | character | Image-to-3D from `tools/hyper3d/concepts/penalty-hero-keeper.png`. Animated in code. |
| ball | prop | The penalty ball. |

Code primitives, no Hyper3D credits:

| Piece | Role |
|---|---|
| Goal frame and net | The six zones live on this frame. |
| Pitch | Ground plane under the penalty spot. |

Until a GLB exists, the striker, the keeper and the ball are coloured stand-ins. Swapping the model is an `assets.ts` change, not a scene change.

## HUD

- Shots, as `x/10`.
- Goals, the count from 0 to 10.
- Streak, the current run of goals. It shows 0 after a save.
- The score is the points total from the formula above. `formatScore` appends the meta unit label `goals`.

## Edge cases

- Pause mid-shot, including during the dive or the GOAL / SAVED hold, freezes that shot. Resume continues it. The shot is resolved once.
- Hiding the tab is the same pause. It does not call `end()`.
- Input during the 1600 ms of a shot does not change the zone or fire a second ball.
- The tenth shot still plays its feedback before `end()`. A pause on that hold delays the end until the remaining feedback time has run.
- `end()` is idempotent.
- The same seed and the same ten zones always produce the same dives. Aim timeouts use the same rule, so an idle run is deterministic too.

## Test plan for `rules.ts`

`rules.ts` is pure. The same seed and the same list of zone choices always return the same dives, results and score. No `Date.now`, no `Math.random`, no DOM.

- The same seed and the same zones reproduce the same keeper dives.
- A different seed can change a dive. Weights start at 2, and the chosen zone's weight increases by 1 after the shot.
- One goal scores 100. A second consecutive goal scores 150. A save then a goal scores 100 again.
- Ten goals in a row score 1450. A save anywhere scores less.
- Ten instant shots take 16000 ms, and `1450 * 1000 <= 150 * 16000`.
- An idle run auto-shoots at 20 s per shot and stays under 600000 ms.
- GOAL and SAVED match the zone comparison, including top-center against bottom-center.
- Pause does not add to `durationMs` and does not resolve the shot twice.
- `end()` after shot 10 returns one result.
