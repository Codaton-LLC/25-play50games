# Levels backlog — Part 1 (P-54)

Research for the 5-levels-per-game rollout (CLAUDE.md "Master plan and standing decisions"; design:
`docs/arcade-levels.md` §6.3). For each game: the plan's 5 Levels blocks vs the BUILT mechanics,
which `rules.ts` constants become per-level inputs, and the scoring-limit risk (score limits are
proven per level; every constant change re-opens the proof).

Legend: **Fits?** yes / adapt (plan idea maps onto built mechanics with re-scaling) / no (needs new
code). **Risk** = how much the level config disturbs the proven `meta.scoring` limits
(maxScore / minDurationMs / points-per-second) and the fairness proofs. Effort S/M/L per game.
Line cites: `rules.ts` etc. are inside `play50games-frontend/src/arcade3d/games/<slug>/`.

## office-escape

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Open Office · reach finish through 5 clusters · wide gaps · 60–75 s · bright | yes (adapt: game is endless, no finish — "clusters" = rows) | today's game as-is: `SPEED {start 8, stageMs 20000, maxStage 8}` (rules.ts:27), `GAP_MIN_MS 950` (:47), `STAGES` EASY→HARD mixes 60/40/0 → 20/55/25 (:83-88), `RUN_LIMIT_MS 1_795_000` (:70) | low — limits proven for exactly this config (README "Server limits": 148,000 ≤ 152,500, 82.455 pts/s ≤ 85) |
| 2 | Meeting Floor · 7 clusters · static set · 75–90 s · natural/clean | yes (adapt: all 6 obstacle types + coin stream already exist) | `STAGES[0..1] mix [60,40,0]` (:83) → `[40,50,10]`; `EASY.extra 600/1400` (:83) → `400/1200`; `COIN_RUN {min 3, max 6}` (:64) → `{4,7}` | medium — denser coins raise pts/s toward the 85 cap; density bound must be re-proven (README step 3) |
| 3 | Copy Room · 9 clusters · moving obstacles · 90–110 s · dramatic lighting | partial — lighting via `environment` swap only; moving hazards **no support**: `Row` has fixed `s`/lanes (:167-184), needs new moving-hazard code + fairness redo | `STAGES` → all MEDIUM (:84); lighting: per-level `environment` override (core support needed — env is static in index.tsx:257); moving obstacles: new mechanic, no constant | high if moving hazards land — they invalidate the 950 ms-gap fairness proof (README step 1); full re-proof |
| 4 | Executive Floor · 11 clusters · faster moving hazards · 100–120 s · high contrast | partial — speed/density yes, moving hazards no | `SPEED.stageMs 20_000` (:27) → `15_000`; `STAGES` → all HARD (:85); `GAP_MIN_MS 950` (:47) → `800` — but the 950 gap is what the fairness proof rests on; below it the proof breaks | high — faster stages + tighter gaps change the rate bound and the row-gap proof; limits + fairness re-proven together |
| 5 | After-Hours Office · 14 clusters · mixed hazards, minimal recovery · 120 s challenge · cinematic | yes (adapt: plan's "endless/high-score or 120 s" matches built endless model) | `RUN_LIMIT_MS 1_795_000` (:70) → `120_000`; `STAGES` all HARD; `GAP_MIN_MS 950` → `850`; cinematic env preset (core override needed) | medium — short runs cap scores low (≈ ≤2,500, far under 152,500), but the pts/s proof (step 4 spans d = 4950…1,795,050) must be recomputed for 120 s |

Notes: Level 1 = today's game — yes; LIVE, so the built config stays Level 1 and existing bests stay
fair. New mechanic: **moving obstacles** (L3–4, no support in rules.ts:167-184); per-level lighting
needs core per-level `environment` support; the plan's finish/checkpoint has no built equivalent
(only hit-lose or run-limit-win, rules.ts:757-761). No new GLB — all six obstacle types exist.
Effort **L** — L1/2/5 are constant + env changes, but L3/4 need a moving-hazard mechanic and every
level re-opens the scoring-limit and fairness proofs.

## clean-city

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Pocket Park · collect 10 litter, reach return zone · none · 90 s · bright | adapt | `ITEMS_PER_MAP 20` (:44) → `10`, `DURATION_MS 240_000` (:21) → `90_000`; return zone: **no support** — win is last pickup (:684-694), needs finish-pad mechanic; `FLOOR_HALF 14` (:38) fixed, camera fit assumes 28×28 | high — every change rewrites the proof chain `MAP_MIN_ROUTE/GUARANTEED_MIN_ROUTE/FASTEST_FINISH_MS/BEST_SCORE` (:78-88); `maxScore 4940, minDurationMs 43000` (meta.ts:20-22) re-proven |
| 2 | City Square · collect 15 · more spread targets · 120 s · natural | adapt | `ITEMS_PER_MAP → 15`, `DURATION_MS → 120_000`, `PAIR_SPACING 5.4` (:32) → `4.5`; new `MAPS` entry (:129-172); lighting "sunset" (core presets, core/lighting.ts) | high — same proof rework; fewer pieces + shorter clock loosens limits but must be re-derived per level |
| 3 | Shopping Street · collect 20 · moving hazards · 150 s · dramatic | no (hazards) | `ITEMS_PER_MAP → 20`, `DURATION_MS → 150_000`; moving hazards: **no support** — static AABBs only (`Obstacle` :98-104), needs new moving-hazard code in rules + Scene | high — time-costing hazards affect the earliest-win bound; a lives/fail-state is not covered by the proof |
| 4 | River Walk · collect 25 · target matching / resource pressure · 150 s · strong contrast | no (matching) | `ITEMS_PER_MAP → 25`, `DURATION_MS → 150_000`; matching: **no support** — kinds are visual only, all score `LITTER_POINTS 50` (:49); lighting "night" preset (core) | high — matching changes collection order/rate assumptions in proof step 3 (README "Distance"); re-proof |
| 5 | Festival Cleanup · collect 35 · max density, large area · 180 s · cinematic | adapt | `ITEMS_PER_MAP → 35` (per-kind mix `PER_KIND = /4` :60 must stay integer), `DURATION_MS → 180_000`, denser `MAPS` entry; larger map: `FLOOR_HALF 14` up → refit camera (`camera.ts` VIEW assumes 28×28) | medium — 35×50 = 1750 + bonus > 4940 cap: `maxScore` must rise per level (per-level meta.scoring, §6.3); longer min-route keeps proof shape |

Notes: Level 1 = today's game? **Yes** — LIVE (meta.ts:10); today's 60-item/3-map/240 s run stays
Level 1 and migrated bests stay fair, so the plan's smaller counts (10–35 items, 90–180 s, single
map) must be re-scaled to exceed it or re-ordered. New mechanics: return/delivery zone, moving
hazards, kind matching (all absent from rules.ts). No new GLBs — all five props exist (README
"Assets"). Effort **L** — three of five levels need new mechanics plus five separate scoring proofs
(the proven 4940/43–250 s limits are hard-wired to today's constants).

## escape-room

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Office · find 2 key items + exit seq · none · 180 s · bright | adapt — built is 1 room, 3 items, 600 s cap (README "Concept"); LIVE keeps today's game as L1, so "2 items/180 s" is dropped, not adapted | today's constants unchanged: `ITEM_NAMES 3` (:21), `DURATION_MS 600000` (:9), `STATION_ANCHORS 4` (:23); proven limits maxScore 58370 / minDurationMs 16300 (meta.ts:18-28) stay | low — today's game already proven (README "Scoring" §5-6, 16300 vs MIN_FINISH_MS 16400) |
| 2 | Workshop · 3 items · one blocked path · 210 s · natural/moodier | partially — 3 items ✓; "5 rooms/areas" no support (single `ARENA` 12×10, :11); blocked path = furniture only, no hazard mechanic | `DURATION_MS → 210000`; rooms/blocked-path: **no support** — needs multi-room layout + hazard code | high — 210 s needs new timeBaseMs/maxScore/minDurationMs and re-proof of `MIN_ROUTE` 15.48 / `MIN_FINISH_MS` (:32-33) |
| 3 | Laboratory · 4 items · branching/locked paths · 240 s · dramatic | no — 4 items needs a 5th station (`STATION_ANCHORS/KINDS` fixed 4, :23-24); multi-step clue chains: no mechanic (open→retrieve→door state machine, :185) | `STATION_ANCHORS` 4 → 5 (:23), `ITEM_NAMES` 3 → 4 (:21); `MIN_ROUTE`/`MIN_FINISH_MS` re-enumerated; lighting: **no support** (no fog/lights/sky in Scene.tsx) | high — 4 items add 2000 ms serial actions → new earliest-win bound → per-level minDurationMs/maxScore |
| 4 | Cabin · 4 items · randomized positions · 240 s · stronger contrast | partially — seeded randomization exists (`generateLayout` jitter + Fisher–Yates, :105-122); items/rooms fail as L3 | widen `generateLayout` jitter weights (:110-111); items/stations as L3; lighting preset: **no support**, needs new light/fog code | high — as L3 plus wider jitter changes route distribution → `MIN_ROUTE` re-proof |
| 5 | Mini Spaceship · 5 items · full-map route + time pressure · 300 s · cinematic | no — 5 items exceeds the fixed 4-station pool; 12-room map exceeds `ARENA` (:11); time pressure only via `DURATION_MS` | `ITEM_NAMES` 3 → 5 (:21), `STATION_ANCHORS` 4 → 6 (:23), `ARENA` → larger (:11), `DURATION_MS → 300000` (:9); all proofs re-done | high — denser map + more items raise the earliest-win floor; per-level meta.scoring required (score = `(timeBaseMs − durationMs)/10`) |

Notes: Level 1 = today's game? **Yes** — live (meta.ts:10); built single-room/3-item/600 s game
stays Level 1 with migrated bests; the plan's "2 items/180 s" is superseded. New mechanics/assets:
multi-room layouts (3–12 rooms, `ARENA` is one room), hazards ("blocked/locked paths" — none
exist), lighting/mood presets (no lights/fog/sky in Scene.tsx), station-pool growth for item
counts. No new GLBs strictly required (shared key/book/battery/door reuse). Effort **L** — every
level past 1 needs new layout/pool architecture, a hazard system, per-level scoring metadata and
re-running the exhaustive route proof (2916-shape enumeration in rules.test.ts).

## luggage-rush

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Training Belt · sort 8 to bins · simple path · 120 s · bright | yes (adapt) | = today's game: `DURATION_MS 120_000` (:9), `BELT.base 1.35` (:33), `SPAWN {2.2, 0.9, 120}` (:36), `STRIKE_LIMIT 3` (:13) stay; "sort 8" has no counterpart — built is endless, not finish-based | low — existing proof (oracle 77 bags / 7500 ≤ 7620) carries over unchanged |
| 2 | Two Destinations · sort 12 · more travel · 150 s · natural | adapt | `DURATION_MS → 150_000` (:9); "more travel" ≈ `BELT.base 1.35 → 1.5` (:33); "second task type" already = heavy/VIP rolls (`ROLL` :355-366) | medium — longer run adds bags → new oracle proof; 150 s > `maxDurationMs 122000` (meta.ts:24) must be raised |
| 3 | Four Destinations · sort 16 · multiple workstations · 180 s · dramatic | adapt (zones no) | `DURATION_MS → 180_000` (:9); `PHASE_D3 40 → 30`, `PHASE_D4 70 → 55` (:14-15); `SPAWN.end 0.9 → 0.8` (:36); lighting preset swap supported (core `LIGHTING_PRESETS`, core/lighting.ts:26). 4–6 zones: **no support** — fixed one-hall graph `PATHS` (:90-100), needs new chute segments + mouths | high — 180 s far over the 122 s cap; more spawns + earlier phases → full re-proof of maxScore/points-per-sec |
| 4 | Rush Hour · sort 22 · parallel objectives · 180 s · strong contrast | adapt (parallel no) | `DURATION_MS → 180_000` (:9); `SPEED_AT` every 10 s instead of 15 (:34); `ROLL.heavyLate 0.3 → 0.4` (:355); "parallel tasks": **no support** — one spine, needs new `PATHS` graph + diverter code | high — heavier mix lowers throughput (heavy 0.70×), needs measured proof |
| 5 | International Hub · sort 30 · full workload · 210 s · cinematic | adapt (zones no) | `DURATION_MS → 210_000` (:9); `SPAWN.end → 0.75`, `SPAWN.rampS 120 → 150` (:36); `BELT.base → 1.55` (:33); 6 zones + full-shift queue: **no support**; a 5th+ flight needs a new `FLIGHTS` entry (:39-44, no GLB needed) | high — bags keep spawning past 120 s; score ceiling far above 7620 → per-level limits mandatory |

Notes: Level 1 = today's game: yes — dev game, built 120 s fixed clock already matches plan L1;
only the "sort 8 items" objective differs (built is an endless points game, README "Run end"). New
mechanics: zone/workstation layouts and "parallel objectives" (new `PATHS` segments + chute meshes,
:90-117); the plan's pick-up/carry ground-worker loop was never built (tap-to-flip diverters
instead, README "Concept"). Lighting mood per level is cheap (core presets). Effort **M** — mostly
`createRun(seed, level)` plumbing plus a fresh per-level oracle/limit proof; escalates to L only if
multi-zone graphs are demanded.

## delivery-drone

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Training Rooftop · 3 deliveries · low hazard density · 120 s · bright | yes | `ROUTE.count 12→3` (:13); `ROUTE.ceiling 180→120` (:13); `CITY.towers 8→4` (:8); battery-as-clock already = timer (`BATTERY.initial 100` :12 + 3×recharge 12 fits 120 s) | low — maxScore 3600 → 3×300 = 900; same loading-rate proof (`ROUTE.loading 4`), limits recomputed only |
| 2 | Residential Blocks · 4 deliveries · tighter turns · 150 s · natural | yes (adapt) | `ROUTE.count → 4`; `ROUTE.ceiling → 150`; `ROUTE.padRadius 1.25 → 1.0` (:13); `CITY.towers → 6`; `WIND.from 60 → 45` (:14) | low — maxScore → 1200, proof structure unchanged |
| 3 | Downtown · 5 deliveries · moving obstacles · 180 s · dramatic | adapt | moving hazards exist only as pigeons (`PIGEON` tiers :15, birds fn :373) — moving *traffic* has **no support** (cars cosmetic, README "Assets"); use `PIGEON.middleFrom 60→30, finalFrom 120→60, count 6→8` (:15); `ROUTE.count → 5`; `WIND.from → 30` | low-medium — maxScore → 1500; "resource management" already = battery; dramatic lighting not supported (day preset only, index.tsx:16) |
| 4 | Windy Towers · 6 deliveries · resource/time pressure · 180 s tighter · stronger contrast | yes (adapt) | `WIND.accel 1.5 → 2.5` (:14); more wind zones needs code (count hardcoded 2, :71); error tolerance: `PARCEL.fragileFrom 8 → 4, fragilePrecision 40 → 50` (:11); `ROUTE.count → 6`; `BATTERY.drain 1 → 1.5` (:12) | medium — drain↑ invalidates the battery bound `97−4t` (README proof ¶2); fragile↑ lowers achievable scores → per-level bot re-proof |
| 5 | Night Delivery · 8 deliveries · dense route + precision · 180–240 s · cinematic night | partially | `ROUTE.count → 8`; `ROUTE.ceiling 180 → 240` (:13); `CITY.towers 8 → 12` (:8); **night lighting: no support** — fog/sky hardcoded `#dbeafe`/`#93c5fd` (camera.tsx:26, Scene.tsx:70), `lighting: "day"` only; map > ±30 no support (`CITY.half 30`, :8) | medium — maxScore → 2400; 240 s ceiling + drain 1/s needs battery `initial` raised or proof redone; min-duration limit must move |

Notes: Level 1 = today's game? **No** (dev game): plan L1 (3 deliveries / 120 s) maps directly onto
built mechanics; today's 12-delivery/180 s build is closer to plan L5 and stays available as the
hardest config. Built game is finish-based (win on `ROUTE.count` deliveries); plan timers map
cleanly to `ROUTE.ceiling`. New code needed: night/dramatic lighting (hardcoded fog + sky, day
preset only); moving traffic hazards with collision (only pigeons collide); wind zones > 2 and map
> ±30 m are hardcoded. Effort **M** — L1/2/4 are pure constant parameterization + per-level limits
re-proof; only night lighting and moving traffic are genuinely new code.

## mini-golf

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Garden Course · 3 holes ≤ par · stationary targets · 5–8 attempts / 90 s · bright | yes (adapt) | course = 3 easiest `HOLES` (course.ts:8; `createRun` already takes `course`, rules.ts:120); `PICK_UP_OVER 4 → 2` (:32); `RUN.capS 600 → 300 s` (:30) | high — 3 holes change the 4100 ceiling (Σ `holeScore` :36) and the 15 s min-duration proof; new limits per level |
| 2 | Ramp Course · 4 holes ≤ par · longer distance · 8–10 attempts · natural/clean | yes (adapt) | 4-hole subset; `PICK_UP_OVER → 3`; `RUN.capS → 480 s`; `BALL.vMax 4.5 → 5.0` (physics.ts:21) | high — ceiling/duration proof redone per hole set |
| 3 | Windmill Course · 5 holes ≤ par · moving targets · 10–12 attempts · dramatic lighting | partially | `WINDMILL` turn 6 s, `TURNTABLE.omega 1.2 → 1.6-2.0` (course.ts:110-130) for tighter timing; lighting presets supported (`levelEnvironment`, core levels.ts:52); "combo scoring": **no support** — `holeScore` (:36) is fixed per hole | medium — faster walls change the earliest-win/pick-up timing bounds (README limits proof) |
| 4 | Neon Course · 6 holes ≤ par · smaller/faster targets · 12–15 attempts · high contrast | partially | 6 holes; `CUP.radius 0.10 / captureSpeed 1.2 → 0.08 / 1.0` (physics.ts:32-36) = smaller target; lighting preset ok; "faster targets" = the L3 wall-speed knobs | high — cup/capture changes touch the capture/lip-out tests and the solvable-within-par solver proof (course.test.ts) |
| 5 | Master Course · 9 holes ≤ par · mixed types + strict attempts · score-attack · cinematic | no (as spec'd) | only 6 holes exist (`HOLE_COUNT 6`, course.ts:8 — plan wanted 10, README changed to 6); 9 holes **need 3 new solver-proven hole designs**; strict attempts = `PICK_UP_OVER → 2`; `RUN.capS → 600 s` | high — each new hole adds ≤ 100·(par+2)+200 to the ceiling; every hole needs par-solvability + limits proof |

Notes: Level 1 = today's game? **Yes as baseline** — dev, `enabled: false` (meta.ts:12), no live
bests to protect; today's fixed 6-hole course (par 17) is the natural Level 1, with the plan's
3-hole idea as an easy subset (order can be debated). New mechanics/assets: "combo scoring" (L3)
has no support in `holeScore`; L5's 9 holes need 3 new proven hole layouts; plan's tunnel/ramp GLBs
are procedural (README "Assets"), no new GLB required; per-level lighting already supported by core
presets. Effort **M** for hole subsets + tuned constants; **L** if L5's extra holes are built (each
needs the beam-search solver proof).

## pirate-cannons

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Training Deck · hit 5 targets, limited cannonballs · stationary targets · 5–8 attempts / 90 s · bright | adapt — built game has no attempt limit or hit-count win; waves of ships ≈ "targets" | `WAVES` as-is (:102-108), `DURATION_MS 90000` (:22), `LIVES 3` (:23); attempt limit: **no support**, needs new mechanic | low — ceiling 10500 / 19000–92000 ms already proven (README "Server limits") |
| 2 | Harbor Targets · hit 8 · longer distance · 8–10 attempts · natural/clean | yes — "distance" = far-lane mix; attempts unsupported | `WAVES` lane arrays (:103-107) → weight lanes 1/2 (40/55 m); wind max unchanged | low — more far-lane sinks raise `LANE_BONUS` (:76) take; `ceilingAt` (:854-868) re-summed, tiny rise |
| 3 | Moving Boats · hit 12 · moving targets · 10–12 attempts · dramatic lighting | adapt — zig-zag + combo exist; dramatic lighting: **no support** (only `lighting: "day"`, index.tsx:24; sky color hardcoded) | `ZIG.sloopFromWave 4 → 1` (:90); combo already `POINTS.combo 1.5 from 3` (:138); lighting preset needs new env config | low — zig/combo don't change `MAX_SCORE` (:871); same limits hold |
| 4 | Storm Battle · hit 16 · smaller/faster targets · 12–15 attempts · storm contrast | adapt — speed/wind tunable; storm mood: **no support** | `WAVES` speed 1.0–1.4 → 1.15–1.6, wind 1.0–3.0 → 1.5–3.5 (:103-107); dinghy `SHIPS.dinghy r 0.7 → 0.55` (:68) | medium — ceiling unchanged, but the earliest-loss proof (20.54 s vs `minDurationMs 19000`, README §4) breaks with faster ships; re-proof needed |
| 5 | Captain Challenge · hit 20 · mixed types + strict attempt limit · score-attack · cinematic | partial — mixed types exist; strict attempt limit: **no support**; cinematic lighting: **no support** | denser `WAVES` multisets (:103-107); `SEA.maxAlive 8 → 12` (:87); attempt limit + mood = new mechanics | high — more ships/pairs raise `MAX_SCORE` past 10500; per-level `maxScore`/`base`/`maxPointsPerSec` re-proven via new `ceilingAt` |

Notes: Level 1 = today's game — yes (dev game): the plan's attempt-limited target gallery has no
supporting code (no shot limit, no win state, README "Run end"), so the built 90 s / 3-lives wave
game is the only viable Level 1. New mechanics/assets: attempt-limited lose condition (shot
counter), lighting/mood presets (storm/cinematic — only "day" exists); no new GLB needed (plan's
"target barrel/island target" ≈ existing props). Effort **M** — L1–4 are mostly `WAVES`/`ZIG`/
`SHIPS` constant edits plus re-running the ceiling/earliest-loss proofs; L only if the attempt-limit
mechanic and mood presets are demanded.

## penguin-slide

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Snow Hill · reach finish + collect 10 fish · wide safe gaps · 60–75 s · bright | adapt — built game is endless, no finish or fish-target objective (README:57 "No win") | `DRIVE.max 22 → 18` (:7) tutorial pace; obstacle slots `2+floor(3q)` (:126) → cap at 2 (new per-level `maxSlots`); `CLOCK.initial 30 → 45` (:9); fish target has no counter — needs new objective UI or reinterpret as score target | low — slower speed + shorter runs cap well below `maxScore 18700` (meta.ts:22) |
| 2 | Ice Cave · finish + 15 fish · static obstacles · 75–90 s · moodier natural lighting | adapt — static obstacles already exist (ice/snowman/crack, :19); "cave" lighting not supported | obstacle slots → 3–4 (:126); `CLOCK.initial → 60`; cave lighting: **no support — fog/sky/lighting hardcoded** (index.tsx:14, Scene.tsx:128), needs lighting-preset param | low-medium — denser fish pushes toward the 12/chunk budget (`POINTS.fishBudget 12`, :10); proof per level |
| 3 | Frozen Lake · finish + 20 fish · moving obstacles · 90–110 s · dramatic lighting | partial — density fits; moving hazards **no support** (all obstacles are static circles in (s,d), :19) | obstacle slots → 4–5 (:126); `CLOCK.initial → 75`; moving obstacles: **needs new mechanic** (velocity field + swept collision integration); lighting still unsupported | medium — more chunks + 20-fish target raises max toward 18700; new proof required if `DRIVE.max` rises |
| 4 | Aurora Run · finish + 25 fish · faster moving hazards · 100–120 s · high contrast/night | no (as written) — depends on L3 moving hazards + night/aurora lighting, neither exists | slots → 5–6 (:126); `DRIVE.max 22 → 24` would need re-proof of `s ≤ 22t` (README:49); night lighting: **no support — SkyDome colors hardcoded** (Scene.tsx:128, fog `#e9fbff` index.tsx:14) | high — any speed increase invalidates the 18700 / base 440 / pps 104 proof (README:43-51); full re-proof mandatory |
| 5 | Glacier Sprint · finish + 30 fish OR endless high-score · mixed hazards, minimal recovery · 120 s · cinematic | adapt — "endless/high-score" is the only plan level matching the built endless model; finish + 30 fish objective doesn't fit | keep endless: slots → 6+ with the `q` ramp reaching max sooner (:126); `CLOCK.ceiling 180 → 120` (:9); minimal recovery via slot spacing `COURSE.separation 12 → 10` (:6) — corridor itself is a fairness invariant (README:29), do not shrink; generator re-validation needed | medium — 120 s ceiling lowers the duration bound (score ≤ 102.667t+220 still holds, README:49), easier limits; dense tricks keep score near cap |

Notes: Level 1 = today's game? Dev game — yes with adaptation: today's endless run stays the base
config, but the plan's "reach finish + collect N fish" objective has no built counterpart, so
Level 1 follows the plan only in pacing/density, not win condition. New mechanics/assets: moving
obstacles (L3–4), per-level lighting presets (L2–5), collectible-count objective + finish line (no
win path, README:57). No new GLB — existing ice/snowman/crack/fish props suffice. Effort **L** —
three new systems plus a fresh per-level scoring-limit proof, since the single global
18700/440/104 proof is ceiling-and-speed dependent.

---

## Cross-game summary (Part 1)

- **Constant-only levels (S/M effort):** delivery-drone, luggage-rush, pirate-cannons — plan maps
  onto existing `rules.ts` knobs; work is `createRun(seed, level)` plumbing + per-level limit
  proofs. Mini-golf is M if levels are subsets of the 6 proven holes.
- **Need new mechanics:** moving hazards (office-escape L3–4, clean-city L3, penguin-slide L3–4);
  kind matching (clean-city L4); return/delivery zone (clean-city L1–2); attempt/shot limits
  (pirate-cannons L1/L5); combo scoring (mini-golf L3); finish line + collectible-count objective
  (penguin-slide all levels); multi-room layouts + hazards (escape-room L2–5).
- **Lighting presets are a cross-game gap:** only luggage-rush and mini-golf can swap presets via
  core support today; delivery-drone, penguin-slide, pirate-cannons and escape-room have hardcoded
  fog/sky/colors. Worth building once in core (`docs/arcade-levels.md` §6.3 "environment") before
  per-game level work — office-escape and clean-city also rely on it.
- **Live-game constraint:** office-escape, clean-city, escape-room keep today's game as Level 1
  (migrated bests); their plan L1 specs (smaller counts, shorter timers, fewer items) must be
  re-scaled upward or re-ordered, not adopted as-is.
- **Scoring limits:** every level needs its own proof (§6.3). Highest-risk edits: `GAP_MIN_MS` and
  `SPEED` in office-escape (fairness proof depends on both), `DRIVE.max` in penguin-slide (global
  ceiling proof), cup radius/capture in mini-golf (solver proof), and any maxScore raise beyond the
  proven ceiling (clean-city 4940, pirate-cannons 10500, mini-golf 4100).


---

# Part 2 (P-56)

Same legend and risk definition as Part 1. All 8 games here are dev games (`status: "dev"` /
`enabled: false`) — no migrated bests to protect, so Level-1 ordering is a design choice per game.
Line cites are inside `play50games-frontend/src/arcade3d/games/<slug>/`.

## museum-guard

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Main Hall · inspect 4 exhibits · none · 180 s · bright | no (as written) — built has no patrol/movement: fixed eye, 8-pedestal ring, dawn at 90 s (README "Concept"); "4 exhibits/180 s" is *easier* than today's game | today's config stays L1: `RING.count 8` (:9), `PHASES.dawn 90` (:48), `PHASES.ends [30,60,90]` (:42); an easy variant needs `KINDS` roster rework (:76 is fixed 2×4 kinds) | low if unchanged (limits 2050 / 12000–92000 / 25 proven, README "Server limits"); any roster/ring change re-opens the both-exits/cone proof (:680-684) |
| 2 | Ancient Wing · inspect 6 · one blocked path · 210 s · natural | partial — count ≠ 8 unsupported; "blocked path" no mechanic (paths are fixed inner-lane arcs, README "Path") | `RING.count 8 → 6` + `KINDS` → 2/2/1/1 (:76); `PHASES.dawn 90 → 105`; blocked path: **no support** | medium — dawn 105 raises the ceiling (5·105 + returns + dawn bonus) → per-level `maxScore`; 45°-spacing cone proof redone for 6 pedestals |
| 3 | Art Wing · inspect 8 · branching/locked paths · 240 s · dramatic | partial — 8 exhibits ✓; difficulty = phase knobs; locked paths no mechanic | `PHASES.cap [2,3,3] → [3,3,4]` (:44), `PHASES.gap [4.2,3.6,3.2] → [3.6,3.2,2.8]` (:46), `PHASES.speed → [1,1.2,1.35]` (:43), `PHASES.dawn → 120`; dramatic lighting: env hardcoded night (index.tsx:22), no per-level preset wired | medium-high — more starts raise `SCORE.maxReturns 21` (:66) and the 25 pts/s prefix proof (README step 5); full re-proof |
| 4 | Science Wing · inspect 10 · randomized positions · 240 s · high contrast | partial — 10 needs roster work; "randomized" partially exists (seeded `shuffleKinds`, :243) but pedestal angles are a fixed formula (:180) | `RING.count → 10`, `KINDS → 3/3/2/2` (:76); `PHASES.dawn → 120`; true position randomization: **no support** (would break the 2.842/6.926 m path-length proof, README "Path") | high — pedestal count/spacing changes every path length → earliest-lose 13.79 s vs `minDurationMs 12000` (README step 4) re-derived; ceiling re-summed |
| 5 | Full Museum Night · inspect 12 · full-map route + time pressure · 300 s · cinematic | no — 12 unsupported (as L4); "full-map route" assumes WASD patrol the build never had (README "Controls": turn + flash only); cinematic lighting: night env already, but hardcoded (index.tsx:22) | `RING.count → 12` + roster (:76); `PHASES.dawn → 150`; route/escape objective: **needs new mechanic** | high — longest dawn + most starts maximizes ceiling; per-level `maxScore`/pps and the fixture-lose proof all redone |

Notes: Level 1 = today's game? **Yes** — dev (`status: "dev"`, meta.ts:11), no bests to protect; today's
8-pedestal/90 s config stays Level 1 and the plan's smaller L1 is dropped (levels must escalate).
The plan's core (patrol 3–12 rooms with WASD, E to interact) was never built — the built game is a
fixed-spot flashlight defence, so "wings/rooms" can only map to ring size and phase knobs. New
mechanics needed: exhibit counts ≠ 8 (`KINDS` + `pedestalAngle` coverage proofs), blocked/locked
paths, free-position randomization, and any movement/exploration. Lighting: night is the mechanic —
the plan's bright/natural/dramatic presets mostly contradict it, and `environment` is a single
hardcoded object (index.tsx:22; core per-level env is the cross-game gap from Part 1). No new GLB
(bust already declined, README "Assets"; statues/doors/bench shared). Effort **M** — L1–3 are
`PHASES`/`BEAM` constants + per-level `maxScore`; L4–5 need roster/coverage re-proofs.

## knight-arena

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Basic Training · hit 8 targets · stationary · 5–8 attempts / 90 s · bright | partial — "8 stationary targets" ≈ stage-1 map (23 near-only beats); attempt limit: **no support** (run has no lose state, README "Duration" step 6); 90 s breaks the 60 s clock | `BEAT.MAX_SHIELDS 12 → 0` (:99), `MAX_DOUBLES 29 → 0`, `TOMATO_COUNT 18 → 0` (:99); `STAGES[1..3].beatCount → 0` (:80-85); attempt counter: new mechanic | medium — fewer slots lower the 11090 ceiling (`scoreCeiling` :403) → per-level `maxScore`; 90 s exceeds `maxDurationMs 62000` (meta.ts:24) |
| 2 | Moving Targets · hit 12 · longer distance · 8–10 attempts · natural | partial — distance ✓ (far ring at 2.60 m, `TARGETS.FAR_RADIUS_M` :55); moving targets: **no support** (posts static, `RAW_POSTS` :37-46; targets only pop on the beat) | all-far stage-2 mix (the `maxPost 4 : 8` split, :229); `BEAT.MAX_SHIELDS → 0`, `TOMATO_COUNT → 0`; moving dummies: needs new locomotion + sweep-timing code | low-medium — slot count unchanged → ceiling 11090 holds; re-proof only if motion code lands |
| 3 | Timed Course · hit 18 · moving targets · 10–12 attempts · dramatic | partial — combo scoring already built (`COMBO` :65, ×4 at hit 25); "moving" no; timing pressure = BPM stages (100→130, `STAGES` :80-85) | `stageDoubleTargets start 50 → 23` (:175-178) for earlier doubles; `STAGES` bpm → 110/120/130/140; dramatic lighting: env hardcoded sunset (index.tsx:16-19), no per-level preset | medium — same 140-slot ceiling, but earlier doubles change the spin-schedule DP optimum (:345-392); per-level `maxScore` + oracle re-run |
| 4 | Combo Arena · hit 24 · smaller/faster targets · 12–15 attempts · high contrast | partial — "smaller" is visual-only (hit judge is timing ±200 ms, `TIMING.ACTIVE_WINDOW_MS` :60 — disc size never gates hits); faster = BPM | `TARGETS.DISC_RADIUS_M 0.50 → 0.40` (:54, cosmetic); `STAGES` bpm 130 → 140-150 (`periodMs` :84); combo/step tuning `COMBO.STEP_HITS 8 → 6` (:65) | medium — `STEP_HITS` changes the per-slot combo sum → ceiling re-summed (`scoreCeiling` :403); BPM alone doesn't move 11090 but re-checks the 58-62 s window |
| 5 | Royal Trial · hit 30 · mixed types + strict attempt limit · score-attack · cinematic | partial — mixed types + score-attack = today's game (all 4 stages, 140 slots, README "Status"); strict attempt limit: **no support** | today's map as L5 base; stricter timing `TIMING.ON_BEAT_WINDOW_MS 110 → 90` (:61); attempt-limited lose: **needs new end condition** (stepRun never loses, :457-572) | high if attempt limit lands — a lose-on-miss-N end makes runs end early, breaking the 58000–62000 ms window proof (README step 6) and the duration side of the limits |

Notes: Level 1 = today's game? **Yes** — dev (`status: "dev"`, meta.ts:11); the plan's L1
(attempt-limited, 8 targets, 90 s) has no built counterpart (no attempt counter, no win/lose — every
run ends on the 60 s `BEAT.DURATION_MS` timeup), so the built 60 s / 4-stage / 140-slot game stays
Level 1 as the only fully proven config; it is actually closest to the plan's L5. New mechanics
needed: attempt/shot limits (L1/L5), moving dummies (L2–3), per-level map selection beyond the 3
fixed seeds (`BEAT.MAP_SEEDS` :98 — `createBeatMap(seed)` is already pure, so level = seed + cap
overrides is cheap). Lighting: single hardcoded sunset env (index.tsx:16-19); bright/natural/dramatic
presets not wired (same core gap as Part 1). No new GLB — dummies/sword/shield/towers exist (README
"Assets"). Effort **M** — mostly `createRun(seed, level)` plumbing over `createBeatMap` caps +
per-level `maxScore` re-proofs; **L** only if attempt limits or moving targets are demanded.

## monster-kitchen

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Snack Bar · serve 3 orders · simple path · 120 s · bright | adapt — built is a 90 s endless score attack, no "serve N" win (README:58 "No win"); no movement/zones (plan's WASD/E chef never built) | today's game stays L1: `DURATION_MS 90_000` (:16), `ORDERS.windowBAtS 70` (:56), `DRIFT {fromS 50, everyS 6}` (:83), `PATIENCE.max 10` (:75) unchanged; 120 s only via `DURATION_MS → 120_000` + `windowBAtS → 60` | low as-is (limits proven: 4830 / 12–92 s / base 240 / pps 60, meta.ts:23-27 = PROPOSED_LIMITS :573-580); 120 s breaks `maxDurationMs 92_000` → per-level limits, and the B(70) window count (:49-50) re-derived for the longer clock |
| 2 | Monster Café · serve 5 · more travel · 150 s · natural | adapt — "longer route/second task" = earlier second window + earlier length ramp | `ORDERS.windowBAtS 70 → 45` (:56); `lenAt`/`lenPick` thresholds `25/50 → 20/40` (:64-70); `DURATION_MS → 120_000` (150 s over any sane cap) | medium — the ≤15-completions-before-window-B and ≤8-after counts (:49) shift; ceiling 4680 and the `B(t) ≤ 240+60t` slope (:50) re-proven |
| 3 | Busy Kitchen · serve 7 · multiple workstations · 180 s · dramatic lighting | partial — parallel orders exist (2 windows, :52); 4–6 zones: **no support**, fixed single-counter scene (Kitchen.tsx, camera fit README:64); dramatic preset needs per-level env (lighting hardcoded `indoor`, index.tsx:22; presets exist in core/lighting.ts:28) | `DRIFT.fromS 50 → 30`, `everyS 6 → 5` (:83); `ORDERS.windowBAtS → 35` (:56); zones: new mechanic, no constant | high — drift cadence and window timing are load-bearing in the ceiling proof (:49-51); every change re-opens it |
| 4 | Dinner Rush · serve 9 · parallel objectives, stricter timing · 180 s · strong contrast | adapt — parallel = the two windows (burndown README:26); stricter timing via patience/drift | `PATIENCE.drains.grumpy 1.3 → 1.5` (:78), `penalty 3 → 4` (:76); `DRIFT.everyS → 4` (:83); `WHEEL.slots 8` (:25) must stay — ring math is π/4-hardcoded (:218) | high — grumpy drain sets the min-duration (spam-lose) proof (:51: angry ≥ order+3.5 s) and penalty feeds it; drift feeds the ceiling; full re-proof |
| 5 | Grand Feast · serve 12 · full workload · 210 s · cinematic | adapt — full shift = all pressure knobs at once; 6 zones: **no support** | `DURATION_MS → 120_000`; `windowBAtS → 30`; `DRIFT {30, 4}`; drains `{1.1, 1.3, 1.5}` (:78); cinematic env: needs per-level `environment` plumbing (static in index.tsx:22) | high — the whole proof chain (ceiling, windows, spam-lose, drift) is re-run; 210 s exceeds `maxDurationMs` → per-level meta.scoring mandatory |

Notes: Level 1 = today's game — yes (dev, meta.ts:12 `status: "dev"`; no bests to migrate). The built
90 s / 2-window / 8-slot config is the natural Level 1; the plan's "serve N orders in 120–210 s" has
no win-state support (score attack only, README:58), so level differentiation must come from window
timing, order-length ramp, drift and patience — not order counts or timers as objectives. New
mechanics the plan needs but the code lacks: multi-zone/workstation layouts (L3–5; single fixed
counter, Kitchen.tsx), player movement + carry (never built), "sort/serve N" win condition. No new
GLB — all 8 ingredient kinds + 3 monster types exist (README "Assets" :82-93). Lighting moods
(bright→cinematic) are one-line preset swaps only after core gains per-level `environment` support.
Effort **M** if zones are dropped (pure `createRun(seed, level)` + per-level limit proofs); **L** if
the zone layouts and win conditions are demanded — each re-opens the tightly-coupled 4830/12 s proof.

## robot-factory

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Basic Sort · sort 12 parts · simple path · 120 s · bright | adapt — built is a 90 s shift with win quota 5 robots (SHIFT :11-19), not a sort-N win; no player movement (fixed claw) | today's game stays L1: `SHIFT.DURATION 90` (:13), `WIN_QUOTA 5` (:15), `BELT.V0 1.45 / V_MAX 2.6` (:36,:39), `STREAM.PERIOD 1.6 / HALF 0.8` (:57-58); "12 parts" ≈ 3–4 robots → could offer `WIN_QUOTA → 4` as an easier variant | low as-is — closed-form bound `perfectScore(56,12) = 4580 ≤ 80·M(t)+220 ≤ 50t+264` (:696-716) is proven for exactly these constants; meta still provisional 6000 (meta.ts:22-26), proposed 4750 (:722-731) |
| 2 | Shape Sort · sort 20 parts · more travel · 150 s · natural | adapt — "second task type" = the 3→4→5 blueprint growth already built (`blueprintSize` :127-129); travel = belt speed | `BELT.V1 1.6 → 1.75`, `GROWTH 1.04 → 1.05` (:37-38); `SHIFT.DURATION → 120` (150 s unusable: ceiling `M(150) ≈ 94`, score ≈ 8000+ ≫ 4750); `BELT.FEEDER_T 60 → 45` (:34) | medium — `M(t) = floor((t−0.731)/1.6)+1` (:711-716) and the `< 4 s` fairness guarantee (:45) re-derive with V1/GROWTH; the dwell-vs-`WRONG_LOCKOUT 2.1` argument (:68-74) must be re-checked at higher speeds |
| 3 | Color + Shape · sort 28 parts · multiple workstations · 180 s · dramatic lighting | partial — colour×shape matching is the core mechanic (:105-118); multiple workstations/4 zones: **no support**, fixed bay + one belt pair (Bay.tsx, README:133); dramatic preset needs per-level env (`indoor` hardcoded, index.tsx:20) | `BELT.FEEDER_T → 35` (feeder carries every other non-needed part from then, :34,:450); `STREAM.FAULTY_CHANCE 0.18 → 0.22` (:61); zones: new mechanic | medium-high — feeder merge changes spawn geometry the gap invariant (`MIN_PART_GAP 0.95`, :55) is proven over (:144); fault rate feeds `EARLIEST_LOSS_S` (:719) → `minDurationMs` proof |
| 4 | Fast Factory · sort 38 parts · parallel objectives · 180 s · strong contrast | adapt (parallel no) — "conveyor speeds up" already built (`beltSpeed` :132-135, V_MAX at r=14); parallel stations: **no support**, single claw/grab zone | `BELT.V_MAX 2.6 → 3.0` (:39); `STREAM.FAULT_MIN_INTERVAL 3.5 → 2.8` (:63); `CLAW.WRONG_LOCKOUT 2.1 → 2.4` (:74) to keep blind-grab punishment at the faster dwell; `SHIFT.DURATION → 120` | high — `M(t)`/`R(M)` bounds, the dwell math behind WRONG_LOCKOUT (:68-74), and `EARLIEST_LOSS_S = 2.6 + 2·3.5 + 1.9/2.6 = 10.331 s` (:719) all move → full re-proof of 4750/10000/92000/300/52 |
| 5 | Overdrive · sort 50 parts · full workload · 210 s · cinematic | adapt — full shift = max lattice pressure + faults; 6 zones: **no support** | `STREAM.PERIOD 1.6 → 1.4`, `HALF 0.8 → 0.7` (:57-58, keep `HALF·V0 = 1.015 ≥ MIN_PART_GAP 0.95`); `FAULTY_CHANCE → 0.25`; `BELT.V_MAX → 3.0`; `SHIFT.DURATION → 120`; cinematic env: needs core per-level environment | high — the lattice period is the spine of the entire scoring proof (`maxInstalls` :711-716, `perfectScore` :696); a 1.4 s period raises the 90 s ceiling well past 4750 → per-level meta.scoring required, proof re-run |

Notes: Level 1 = today's game — yes (dev, meta.ts:11 `status: "dev"`); the built 90 s / quota-5
shift stays Level 1 and the plan's smaller counts (12–50 parts, 120–210 s) scale upward from it.
"Sort N parts" maps onto the built game only via `WIN_QUOTA` (robots ≈ parts/`blueprintSize`), never
as a direct part-count win — that end condition has no support (`finish()` keys on quota or the
clock, :615-620). All plan timers (120–210 s) exceed `maxDurationMs 92_000` and would explode the
proven 4580 ceiling (1 part/1.6 s × ~90 pts), so built levels must stay ≤ ~120 s or carry per-level
limits. New mechanics the plan needs but the code lacks: multi-zone layouts and parallel
workstations (L3–5), player movement (never built), a parts-counted win. No new GLB — zero Class E
assets, all parts procedural or shared (README "Assets" :121-134, `assets.spec.json` is empty).
Lighting moods are preset swaps pending core per-level `environment` plumbing. Effort **M** — L1–5
are `createRun(seed, level)` parameterization plus one fresh closed-form limit proof per level (the
proof is closed-form, not bot-measured, so re-proof is cheap); escalates to **L** only if zones or a
parts-counted win condition are demanded.

## space-repair

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Docking Bay · repair 2 systems, return to safe module · wide safe gaps · 60–75 s · bright | adapt — built is a fixed ±10 m station survival game, not a forward runner (no route/jump/slide, README "Concept"); repairs ≈ break tickets, not a return trip | today's game kept as-is: `BREAKS.times` 30 entries (:9), `CLOCK.duration 120` (:14), `DEBRIS.speeds [1,1.2,1.4]` (:11); dev game, no bests to protect | low — limits 4700/37000/122000/400/40 proven for exactly this config (README "Server limits"; PROPOSED_LIMITS :15, meta.ts:20-28) |
| 2 | Power Wing · repair 3 systems · static obstacle set · 75–90 s · natural/clean lighting | adapt (lighting no) | `CLOCK.duration 120 → 90` (:14); `BREAKS.times` trimmed to ~15 tickets ending ≤84 (:9) = gentler 3.0 s cadence kept; "static set": debris slots already stage 2/3/4 at 0/40/80 s (README:69) — keep speeds[0]=1 only by schedule, else speeds as-is | medium — ceiling `30·150+200` (README:77) drops with fewer tickets → per-level maxScore; earliest-loss 37.67 s bound (proof step 3) re-derived for the shorter schedule |
| 3 | Comms Wing · repair 4 systems · moving obstacles · 90–110 s · dramatic lighting | adapt (lighting no) | moving hazards already exist (DEBRIS, :11): `speeds [1,1.2,1.4] → [1.4,1.7,2.0]`; `REPAIR.periods [1.2,1,0.8] → [1.1,0.95,0.8]` (:10); lighting **no support** — only `lighting:"space"` (index.tsx:17, README:107), needs core env override | medium — periods tighten proof-step-2 hit-time bounds (`0.8·(0.45−60/720)`, README:84) not the ceiling; debris stays outside service discs (README:69) so fairness holds |
| 4 | External Platform · repair 5 systems · faster moving hazards · 100–120 s · strong contrast | yes (lighting no) | `speeds → [1.8,2.2,2.6]`; `REPAIR.fine [60,45,35] → [55,40,30]`, `coarse [90,75,60] → [80,65,50]` (:10); full 30-ticket `BREAKS.times` (:9) | medium — full schedule restores the 4700 ceiling but arc widths + speeds change the movement/work lower bounds and human pacing margin (final power ~13, README:73); witness gate (≥24 repairs) must re-pass |
| 5 | Station Emergency · repair 6 systems · mixed hazards, minimal recovery · endless/high-score or 120 s challenge · cinematic | adapt — "endless" **no support**: win is exactly at 120 s (README:88-91); only the 120 s challenge branch fits | today's full schedule + `REPAIR.periods → [1.0,0.85,0.7]` (:10), `REPAIR.lock 0.5 → 0.6` (:10); cinematic lighting **no support** (index.tsx:17) | medium — tighter periods raise achievable score toward 4700 (oracle best already 4504, README:25); per-level maxScore/limits re-proven |

Notes: Level 1 = today's game — dev (`enabled: false`, arcade-games.json:311; meta.ts:11), so the
built 30-ticket/120 s config stays Level 1 as-is; the plan's "60–75 s / repair 2 systems / runner
route" has no built counterpart (no forward route, finish, or return-to-module mechanic — README
"Concept", "Run end"). Plan L2–4's "repair N systems" maps to ticket-count/schedule length, not a
new layout: all 8 modules are always present (`MODULES`, rules.ts:18). No new GLB — modules/
astronaut/battery reuse owned assets (README "Assets"). Per-level lighting (natural/dramatic/
cinematic) needs the same core environment-override gap as Part 1's cross-game note — game hardcodes
`lighting: "space"`. Effort **M** — all five levels are `BREAKS.times` / `CLOCK.duration` /
`DEBRIS.speeds` / `REPAIR` constant sets plus per-level scoring proofs (the ticket-count envelope
and earliest-loss bound are schedule-dependent, README proof steps 1 & 3).

## snowball-battle

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Snow Yard · score 5 valid hits · stationary targets · 5–8 attempts / 90 s · bright | adapt — built is a 1-vs-3 bot battle (tag each rival 3×, README "Concept"), not a target gallery; "attempts" **no support** (no shot limit; only `SCOOP.maxAmmo 3`, :46) | today's game kept: `AI.dodgeAt [0.35,0.27,0.2]` (:72), `AI.windup 1.2` (:67), `SCORE.duration 90` (:77); tutorial flavor via rivals that almost never dodge: `dodgeAt → [0.6,0.5,0.4]` | low — slower rivals only raise the 10.9 s clear (EARLIEST :100-110); 2550/10000/92000/600/190 hold with slack (README:60) |
| 2 | Frozen Park · score 8 hits · longer distance · 8–10 attempts · natural/clean lighting | adapt (lighting no) | "distance" = slower targets: `KID.speed 4.5 → 4.0` (:39), `AI.dodgeAt → [0.3,0.25,0.2]` (:72); `THROW.distFar 14 → 18`, `flightFar 0.85 → 0.95` (:53) — note proof uses flight ≥ 0.65 (README:44), keep `flightNear 0.65`; lighting **no support**: `lighting:"snow"` + fog hardcoded (index.tsx:14, README:81) | medium — flight-time change alters the scoop-cycle bound `0.5k+0.65` (README:44) and EARLIEST rows; re-derive the 190 pps table |
| 3 | Snow Fort · score 12 hits · moving targets · 10–12 attempts · dramatic lighting | yes (lighting no) — rivals already move/dodge; pressure = more simultaneous attackers: `AI.slotAt 60 → 30` (:70), `AI.sneakerAt 10 → 8` (:70); "combo scoring": **no support** — fixed `SCORE.hit 100` (:76) | lighting **no support** (index.tsx:14); dramatic mood needs core env override | medium — earlier two-peek slot shortens the loss chain (10.65 s, README:29) and the earliest clear; minDurationMs 10000 (meta.ts:23) re-checked |
| 4 | Ice Village · score 16 hits · smaller/faster targets · 12–15 attempts · strong contrast | adapt — "faster" = shorter telegraph, not smaller hitboxes (`KID` spheres :40-41 fixed by pose tests): `AI.windup 1.2 → 1.0` (:67), `AI.dodgeAt → [0.25,0.2,0.15]` (:72), `FORT.hp 3 → 2` (:60) = less cover | lighting **no support** | high — windup 1.0 vs flight ≤ 0.70 at ≤8 m (README:32) eats the punish window the witness proof relies on (160/160, README:157); clear may drop under 10 s → minDurationMs and EARLIEST re-proven |
| 5 | Championship Arena · score 20 hits · mixed types + strict attempt limit · score-attack · cinematic | partial — mixed pressure yes: `AI.slotAt 60 → 0`, `sneakerAt 10 → 5`, `dodgeAt → [0.2,0.17,0.14]` (:70-72); strict attempt limit **no support** (needs shot-counter + lose state); score-attack ≈ built 90 s timeup that banks hits (README "Run end") | attempt limit: new mechanic; cinematic lighting **no support** | medium-high — fastest rival set lowers the clear toward/below minDurationMs 10000; maxDurationMs 92000 only moves if `SCORE.duration` changes (not proposed) |

Notes: Level 1 = today's game? Yes — dev (`enabled: false`, arcade-games.json:214; meta.ts:11), so
the built 90 s / 1-vs-3 config stays Level 1 (softened only if a true tutorial is wanted); the
plan's "score 5 hits on stationary targets within N attempts" has no supporting code — targets are
AI rivals and there is no attempt/shot limit (README "Rules", "Run end"). "More target
positions/stations" maps to fort count (`FORT.count 7`, :60) and rival pressure knobs, not new
geometry; the yard is a fixed 24×18 (`YARD`, :30-36). No new GLB (kids/pines/forts/snowman all
owned, README "Assets"). Effort **M** — L1/3/5 are pure `AI` constant sets; L2 touches the flight
bound and L4 the witness gate, so both need the EARLIEST table and 190 pps proof re-derived; only a
strict attempt limit and per-level lighting would push it to L (both are new mechanics).

## alien-farm

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Starter Plot · harvest+deliver 6 alien crops · simple path · 120 s · bright | adapt — built is a pure 100 s score attack with no crop quota (README "Concept"); "6 crops" ≈ one full basket, not a win condition | today's game as-is: `DURATION_MS 100_000` (rules.ts:15), `PLOTS` 9 beds, cycles 6/8 s (rules.ts:54-64), `SHIP.speeds [2, 2.5, 3]` (:125), `HARVEST.capacity 4` (:111); plan's 120 s dropped (built pace is certified at 100 s); "bright": **no support** — only `lighting: "sunset"` (index.tsx:20) | low — today's config is the certified one (S* = 12400, H* = 71, `PROPOSED_LIMITS` maxScore 12900, rules.ts:144-153) |
| 2 | Crystal Farm · 10 crops · more travel distance · 150 s · natural | adapt — "travel" = saucer hauls; slower ship forces longer beam trips | `SHIP.speeds [2, 2.5, 3]` (:125) → `[1.7, 2.1, 2.5]`; `PLOTS.activateAt 20/40` (:56-63) → `0` (all nine beds live from the start); `DURATION_MS` (:15) → `150_000`; "natural" lighting: **no support** | high — duration limits are pinned to 100 s (minDurationMs 99000 / maxDurationMs 102000, meta.ts:23-24) and every pick bound in `bound.ts` must be re-run for 150 s (more cycles → H* and the rate inequality change) |
| 3 | Glow Marsh · 14 crops · multiple workstations · 180 s · dramatic | adapt — "workstations" = the 9 beds; pressure via denser spores exists (`SPORES` :129); "dramatic" lighting **no support** | `PLOTS.cycleS 6 → 5` (:55-63) more cycles per bed; `SPORES.lifeS 5 → 7` (:129); `DURATION_MS → 180_000` | high — shorter cycles change the stage windows feeding the relaxation (`bound.ts`, README proof ¶2) and H*; certificate + bots re-run |
| 4 | Meteor Field · 18 crops · parallel objectives · 180 s · strong contrast | adapt — "parallel" ≈ all beds active + faster ship; a true parallel objective has no supporting mechanic (single sequential press/pick loop) | `SHIP.speeds` → `[2.5, 3, 3.5]`; `CYCLE.halfLate 0.6 → 0.5` (:96) tighter late windows; `PLOTS.activateAt → 0`; `DURATION_MS → 180_000`; contrast lighting **no support** | high — window widths (`CYCLE.half*` :93-96) feed the bound; faster ship breaks the README ¶27 delivery trade-off assumptions → full re-proof |
| 5 | Grand Alien Harvest · 24 crops · full-system workload · 210 s · cinematic | adapt — full workload = every knob at once | `DURATION_MS → 210_000`; `PLOTS.cycleS 6 → 5`, gourd `8 → 7`; keep `HARVEST.capacity 4` (:111) — 5 would break the ≤100-per-crop load argument (README ¶1); cinematic lighting **no support** | high — S* roughly doubles at 210 s; maxScore/base/pps and the rate inequality re-derived per level |

Notes: Level 1 = today's game? **Yes** — dev game (`enabled: false`, meta.ts:11; no bests to
migrate); the built 100 s / 9-bed config stays Level 1 and the plan's quotas (6–24 crops) are
dropped or reinterpreted as score targets — a crop-count win condition is **new mechanic** (today's
run ends only by time-up, README "Run end"). New code: per-level config plumbing (`createRun(seed)`
:328 takes no level), per-level lighting (core env override — cross-game gap, Part 1 summary). No
new GLB (all plan props exist or have stand-ins, README "Assets"). Effort **M** — L1 is untouched;
L2–5 are constant parameterization plus a re-run of the `bound.ts` certificate and bots per level;
**L** only if crop-quota win conditions are demanded.

## construction-worker

| Level | Plan says (name · objective · hazards · timer · lighting) | Fits built game? | Concrete config (rules.ts constant: current → proposed) | Scoring-limit risk |
|---|---|---|---|---|
| 1 | Garden Shed · complete 3 ordered placement steps · simple path · 120 s · bright | adapt — the plan's walking fetch-and-place loop was never built (crane + pendulum drop instead, README "Concept"); steps = blueprint pieces; 3 steps ≈ one floor | per-level `COUNTS` row (:49-53) `[2,2,2,1,1]` → `[1,1,1,0,0]` (3 pieces, 1 floor); `CLOCK_S 240 → 120` (rules.ts:6); "bright" ≈ built `lighting: "day"` (index.tsx:16) | medium — the `t(k) = 0.88 + 1.13k` floor and maxScore 6100 (README proof ¶1-4) assume 36 pieces / 240 s; a 120 s / 3-piece level needs its own limits (`TIME_BONUS 5` :42 ceiling shrinks with the clock) |
| 2 | Tiny House · 4 steps · more travel distance · 150 s · natural | adapt — travel = trolley hauls (pick `PILE_R 7` :39 → drop `SLOT_R 9.5` :40 is fixed geometry), so reinterpret as more pieces: `COUNTS` → `[2,1,1,1,0]` (5); `CLOCK_S → 150`; "natural" lighting: **no support** (day hardcoded, Scene.tsx:80) | medium — same per-level proof rework; shorter clock lowers the time-bonus ceiling |
| 3 | Garage · 5 steps · multiple workstations · 180 s · dramatic | adapt (workstations no) — one plot, 4 fixed slots (`SLOT_A` :45), sequential `PLAN` (:64-74); use the house row `[2,2,2,1,1]` (8 pieces) + hazard pressure via wind enabled early (wind is tower-only today, rules.ts:484-489 — needs a level flag); `CLOCK_S → 180`; dramatic lighting **no support** | low-medium — enabling wind early changes dynamics but not the score proof (it uses only the 7.8/8.9 gates and the 0.25 s dwell, README :48); per-level limits still required |
| 4 | Shop Front · 6 steps · parallel objectives · 180 s · strong contrast | adapt (parallel no) — shop row `[3,3,3,2,1]` = 12 pieces exists; `CLOCK_S → 180`; "parallel tasks": **no support** — `PLAN` order is strictly sequential (:64-74), parallel ordering needs new plan-generation code; contrast lighting **no support** | medium — 12 pieces / 180 s re-derives the win floor (bots need ~204–207 s only for the full 36) and the time-bonus ceiling; parallel ordering, if built, changes the dwell-count proof |
| 5 | Mini Tower · 8 steps · full workload under time pressure · 210 s · cinematic | adapt — tower row `[4,4,4,3,1]` = 16 pieces exists; "full shift" = all three buildings = today's exact 36-piece plan; `CLOCK_S → 210` (or keep 240 = today's game); cinematic lighting **no support** | low-medium — today's 240 s / 36-piece proof (maxScore 6100, minDurationMs 9000 vs `t(9) = 11.05 s`) nearly carries over at 210 s with a lower bonus ceiling |

Notes: Level 1 = today's game? **Recommend re-ordering** — dev game (`enabled: false`, meta.ts:11),
no bests to migrate: the built 240 s / 36-piece full shift already *is* the plan's L5 ("full
shift/challenge combining every mechanic"), so today's config is the natural Level 5 anchor and new
truncated `COUNTS`/`CLOCK_S` levels fill L1–4 (re-ordering is free; keeping built as L1 would leave
every plan level trivially smaller than today's game). New code: per-level plan build (`PLAN` is
derived once from the frozen `COUNTS` at module load, rules.ts:64-74 → `createRun(seed, level)`), a
wind-enable flag for L3, per-level lighting (day-only, hardcoded index.tsx:16 / Scene.tsx:80 /
`looks.ts` COLORS). "Parallel objectives" (L4) and multiple zones (L3) have no supporting mechanic.
No new GLB (plan props procedural or shared; cement-mixer decor already exists, README :143).
Effort **M** — constant data + plumbing + per-level limit proofs; **L** only if parallel plan
ordering is demanded.

---

## Cross-game summary (Part 2)

- **Constant-only levels (M effort):** space-repair and snowball-battle map almost entirely onto
  existing knobs (`BREAKS.times`/`CLOCK.duration`/`DEBRIS.speeds`/`REPAIR.periods`; the `AI` block).
  robot-factory and construction-worker are also mostly constants, but their plan timers (120–210 s)
  exceed proven `maxDurationMs` caps — levels must stay ≤ ~120–150 s or carry per-level limits.
- **Plan never built (mechanic mismatch):** museum-guard (plan = WASD patrol/explore; built = fixed
  flashlight defence — only ring size + `PHASES` map), monster-kitchen and robot-factory (plan =
  walking multi-zone worker; built = fixed-station game — zones need new code), construction-worker
  (plan = walking fetch-and-place; built = crane/pendulum).
- **Recurring "no support" mechanics:** attempt/shot limits with a lose state (knight-arena,
  snowball-battle — these runs can only end on timeup), order/parts/crop-counted win conditions
  (monster-kitchen, robot-factory, alien-farm), multi-zone layouts (monster-kitchen, robot-factory,
  construction-worker), moving targets (knight-arena), combo scoring (snowball-battle).
- **Level-1 ordering:** all 8 are dev games. Today's built config stays Level 1 for museum-guard,
  knight-arena, monster-kitchen, robot-factory, space-repair, snowball-battle, alien-farm; for
  construction-worker the built 240 s / 36-piece full shift is recommended as the Level 5 anchor
  instead (it strictly dominates every plan level).
- **Lighting gap confirmed across all 8:** every game hardcodes a single `environment` /
  `useStageLighting` value in its `index.tsx` (plus Scene.tsx in construction-worker); the plan's
  per-level bright/natural/dramatic/cinematic moods all need the core per-level environment override
  already flagged in Part 1. museum-guard is the exception in spirit — darkness *is* its mechanic.
- **Highest-risk scoring edits:** alien-farm any `DURATION_MS` change (100 s duration limits are
  pinned, meta.ts:23-24, and every `bound.ts` pick re-runs), robot-factory `STREAM.PERIOD` /
  `EARLIEST_LOSS_S` (spine of the closed-form proof), monster-kitchen `PATIENCE.drains.grumpy` /
  `DRIFT` (feed both ceiling and spam-lose bound), snowball-battle L4 windup 1.0 (threatens the
  witness gate and minDurationMs), knight-arena attempt limits (break the 58–62 s window proof).
