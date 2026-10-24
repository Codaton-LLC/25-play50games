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
