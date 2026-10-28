# Dog Park Fetch

Owner: kimi. Slug: `dog-park-fetch`. Order 41. Status `dev`. Collection `adventure`. Points. Difficulty 1. One fenced lawn, five level configs. Spec: `docs/menu1-new/specs-41-50.md` §41.

## Rules

You are the dog. The owner stands on a blanket at the south end of the lawn and throws one toy at a time. Run to the toy, pick it up and bring it back to the blanket. A frisbee caught in the air pays a bonus. There are no lives.

- Throws: `throws` per level. Every third throw (the first, the fourth, and so on) is a frisbee, so frisbees = ceil(throws / 3). The other throws are a ball or a stick, drawn from the seed. The whole plan (kinds, landing spots, flight times) is drawn when the run is made, so it does not depend on the player.
- Landing: uniform in `[throwMin, throwMax]` metres from the blanket, at a seeded angle. Every landing is inside the fence (1 m margin) and at least 1.5 m clear of every prop's edge. The first throw comes 0.8 s after the start, and the next throw comes 0.8 s after the last one is resolved (returned, or fetched by the owner). One throw is active at a time.
- Flight: a ball or stick flies `0.9 + 0.05 × distance` s. A frisbee flies 1.6 s over the first 6 m plus 0.13 s per metre past that (`frisbeeFlight`; gate change from the spec's flat 1.6 s, which made the 9-18 m frisbees of L3-L5 uncatchable from the blanket), apex 1.5 m. A frisbee is catchable in its last 0.9 s, only while it is below 1.4 m, only while the dog leaps (`jumpPressed`, 0.45 s, 0.8 m arc), and only within 0.6 m of the dog's centre (`canCatch`, pure, tested at 1.39 m and 1.41 m).
- Pickup: a toy on the grass is picked up when the dog's centre is within 0.5 m of it. Only one toy is carried at a time.
- Delivery: a carried toy is returned when the dog's centre is within 1.5 m of the blanket centre.
- Mowers (L3 and up): a closed four-corner loop (`mowerLoop`: 2.5 m inside the fence north, east and west; on the south it runs north of the blanket, 1.5 + 0.6 + 1 m clear), `stepPatrol` at `mowerSpeed`. A hit (radius 0.6 + 0.32) drops the carried toy where the dog stands (it lies on the grass until picked up again, and pays nothing) and stuns the dog for 0.6 s. After a hit the dog is safe from mowers for 0.8 s (mercy).
- Patience (L4 and up): a throw left on the grass for more than `patienceS` is fetched by the owner: 0 points, and the next throw starts. Two timed-out throws on L4 and L5 end the run at once with `end("lose")`. On L1 to L3 nothing times out.
- Props: benches (solid circles, L1 and up), the fountain (solid circle, L2 and up), two low park bushes (L3 and up, 0.5 m tall so they never hide the dog). The dog and the throws keep clear of them.
- Score, all integers: +100 per toy returned, +40 if it was returned within 8.0 s of landing (or of a catch), +60 per frisbee caught, and on win +4 per full second left. Each throw's return pays once.
- Win: every throw resolved and at least `throws - 1` of them returned. Timeup: shell.

## Levels

| L | Title | Lawn (m) | Throws | Landing (m) | Mowers | Mower speed | Patience | Fountain | Light |
|---|---|---|---:|---|---:|---:|---:|---|---|
| 1 | Small Park | 20 × 16 | 4 | 6–10 | 0 | – | none | no | day |
| 2 | City Park | 26 × 20 | 6 | 7–13 | 0 | – | none | yes | day |
| 3 | Forest Park | 30 × 24 | 8 | 8–15 | 1 | 1.8 | none | yes | day |
| 4 | Beach Park | 32 × 26 | 10 | 8–16 | 1 | 2.2 | 14 s | yes | sunset |
| 5 | Dog Festival | 36 × 28 | 12 | 9–18 | 2 | 2.4 | 12 s | yes | day |

The dog's tint is the level's tint (L1 untinted). The owner is never tinted.

## Controls

WASD / arrows run. Space jumps (leap). Touch: joystick and Jump. Scheme `joystick`. The same leap length and catch window run on both devices. The shell owns pause. HUD: the shell's score and clock, plus the stat chip Fetched (max = throws). There is no custom HUD. `resultDelayMs` 900. The target arrow (`TargetMarkers`) points at the toy while it is out, and at the blanket while the dog carries it.

## Server limits (one proof per level, gate 2026-10-26)

Score sources (`rules.ts`): +100 per toy returned (`TOY_POINTS`), +40 within 8 s of landing (`QUICK_POINTS`, `QUICK_S`), +60 per frisbee caught (`FRISBEE_CATCH_POINTS`), and on a win +4 per full second left (`TIME_BONUS_PER_SECOND`). Each throw pays once, so `Bobj = 140 throws + 60 ceil(throws / 3)` (`objectiveCeiling`) and a run ending at t scores at most Bobj (timeup / lose) or `Bobj + 4 floor(D - t)` (a win). With `base = Bobj` the rate line holds for every win at t >= M when `pps >= 4 (D / M - 1)`; the peak is `Bobj + 4 floor(D - M)`, maxScore = peak + 3 %.

M is the fastest win of the oracle bot (runs to the landing point as the toy leaves the owner's hand, waits there for a frisbee and leaps; it never pre-runs to a throw it cannot see) over 200 seeds at 30 / 60 / 144 Hz, times 0.8 (`PROOF_EARLIEST_WIN_S`).

| L | Bobj | D (s) | oracle fastest (s) | M (s) | peak | maxScore | pps (needed) | oracle best | honest clears |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 680 | 90 | 12.57 | 10.0 | 1000 | 1030 | 33 (32.0) | 988 (96 %) | 200/200 |
| 2 | 960 | 120 | 22.07 | 17.65 | 1368 | 1410 | 24 (23.2) | 1348 (96 %) | 200/200 |
| 3 | 1300 | 150 | 32.43 | 25.95 | 1796 | 1850 | 20 (19.1) | 1768 (96 %) | 200/200 |
| 4 | 1640 | 150 | 42.95 | 34.36 | 2100 | 2165 | 14 (13.5) | 2068 (96 %) | 200/200 |
| 5 | 1920 | 180 | 59.87 | 47.89 | 2448 | 2525 | 12 (11.0) | 2396 (95 %) | 200/200 |

minDurationMs 4000 everywhere, maxDurationMs = the clock. L5 / L1 = 2.45. A level clears only on a win.

Tests: `proof.level-N.test.ts` (bots in `testing/bots.ts`, suite in `testing/proof.ts`): the arithmetic; the honest bot (follows the toy's shadow, 90 % stick, dodges mowers) clears >= 99 % of 200 seeds per level (200/200 measured), inside the limits, never faster than M; the oracle inside the limits, best >= 90 %; idle never wins and scores 0 (200 seeds through the rules, 10 through the store); input spam inside the limits. All bots play through `createArcadeStore` with the same `frame()` the Scene uses. Mutation probes: 18 level reads in rules, index, meta and looks all fail the tests.

## Look and models (gate)

- Ground: park grass to 160 m under the fog, the fenced lawn a brighter mown rectangle with stripes, a code fence (pickets + two rails, 2 draw calls), the blanket pad; L4 a sand strip and `<Water>` beyond the south fence (visual only).
- Camera: a follow camera, one yaw (0), pitch 55 deg, a 16 x 14 m window around the aim (10 x 14 m on a portrait phone, so the dog stays readable), clamped to the lawn. The fog starts half a window past the fitted camera distance (`fogFor`, tested at 390 x 844 and 1280 x 800 on every level).
- Decor (`decorSpots`): a tree line behind the north fence and down both sides, low bushes all round (the south row under 0.7 m: the camera side), L5 festival tents and an agility tunnel + hurdles behind the north fence. All decor GLBs are fitted to 1 m and placed by the spot's scale (never scaled twice); nothing stands inside the fence except the solid props.
- Models (all fitted from their measured bounds, `assets.test.ts` on the real meshes; triangles pinned): dog 0.9 m long, faces +z, per-level tint; owner = shared `civilianNpc` 1.75 m (hops per throw); tennis ball 0.14 m, stick 0.6 m, frisbee 0.28 m (turned over: the GLB lies concave side up); fountain 2.4 m across (its 1.2 m solid circle); lawn mower 1.3 m long; bench (shared) 1.2 m for its 0.5 m circle; park bush, festival tent, agility tunnel / hurdle, leafy tree as decor.
- Left out: `dogHouse*`, `dogBone*`, `agilityHurdle` (dogs baked in, spec), `dogOwnerNpc` (a dog baked in at its feet), shared `picketFence` (80+ copies x 1.5k tris round the lawn: the code fence instead).
- Triangles a frame (every copy at full decor): 96k / 109k / 123k / 124k / 147k on L1-L5 (test cap 300k).

## Polish (2026-10-28, `claude/m1-animals`)

- The dog runs like a dog on the core quadruped rig (`DOG_LANDMARKS` in `assets.ts`, checked on the real mesh in `dog.test.ts`): walk, trot and gallop by speed with planted paws, head nod and a wagging raised tail; idle when still and it sits after 1.2 s of waiting; a leap for the jump; it sits dazed while a mower has stunned it. The carried toy is held in its mouth (`attach.mouth`). Rodin's second, low curled tail is folded away.
- Camera: a closer window (portrait 6.8 x 9.2 m, landscape 12 x 9.2 m; was 10 x 14 / 16 x 14) and the player zoom (wheel, pinch, + / -, `core/useCameraZoom`, `ZOOM` 0.55-1.8). The edge arrow and a beacon (a light column and ring) on the waiting toy show throws outside the view.
- Look: a grass texture with quiet mowing stripes (they were loud lime bands), a red gingham picnic blanket instead of the orange disc, a white ring and contact shadow under the dog.

## Not built (spec items left out)

- Festival bunting (L5) and tree shade (L3).
- The path strips (`#d6d3d1`).
- A throw pose and a muzzle socket: the owner hops; the carried toy sits at a fixed point in front of the dog.

## Known issues

- Catches: the leap is a timer, not a physics arc, so the dog's height does not decide a catch; the toy's height does (`canCatch`).
- Frisbee flight is a parabola (apex 1.5 m) whose time grows with distance. The seeded landing point is the only randomness in a throw.
- A mower drop leaves the toy where the dog stood. It can be dropped again, and the patience timer keeps running.
- The bench is drawn 1.2 m long for its 0.5 m solid circle: its ends overhang the circle by 0.1 m.
