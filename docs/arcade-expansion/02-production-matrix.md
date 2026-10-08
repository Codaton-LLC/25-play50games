# Deliverable C: 20-game production matrix

All numbers are estimates **[A]** unless tagged **[V]**. They get recalibrated after the reference game (Phase 3) and after wave 1, from the effort ledger described in 09 §K.6.

## C.1 Slugs, titles, collections

Slugs follow the server rule `^[a-z0-9-]{1,40}$` **[V]** `arcade-api.php:88`. `order` continues after the existing ten (11–30). Collections: `originals` = the existing ten, `adventure` = games 1–10 of your brief, `skill` = games 11–20.

| # | Slug | Title | Collection | Order | Accent (card) |
|---|---|---|---|---|---|
| 1 | `treasure-island` | Treasure Island | adventure | 11 | `#2dd4bf` |
| 2 | `museum-guard` | Museum Guard | adventure | 12 | `#c4b5fd` |
| 3 | `luggage-rush` | Airport Luggage Rush | adventure | 13 | `#60a5fa` |
| 4 | `dino-egg-rescue` | Dino Egg Rescue | adventure | 14 | `#a3e635` |
| 5 | `delivery-drone` | Delivery Drone | adventure | 15 | `#38bdf8` |
| 6 | `shopping-cart` | Crazy Shopping Cart | adventure | 16 | `#fb923c` |
| 7 | `snowball-battle` | Snowball Battle | adventure | 17 | `#bae6fd` |
| 8 | `ghost-vacuum` | Ghost Vacuum | adventure | 18 | `#a78bfa` |
| 9 | `construction-worker` | Construction Worker | adventure | 19 | `#fbbf24` |
| 10 | `alien-farm` | Alien Farm | adventure | 20 | `#4ade80` |
| 11 | `mini-golf` | Mini Golf 3D | skill | 21 | `#86efac` |
| 12 | `robot-factory` | Robot Factory Sorter | skill | 22 | `#7dd3fc` |
| 13 | `pirate-cannons` | Pirate Cannon Battle | skill | 23 | `#f87171` |
| 14 | `castle-defender` | Castle Defender | skill | 24 | `#94a3b8` |
| 15 | `penguin-slide` | Penguin Ice Slide | skill | 25 | `#67e8f9` |
| 16 | `space-repair` | Space Repair Mission | skill | 26 | `#818cf8` |
| 17 | `monster-kitchen` | Monster Kitchen | skill | 27 | `#f472b6` |
| 18 | `knight-arena` | Knight Training Arena | skill | 28 | `#facc15` |
| 19 | `zoo-escape` | Zoo Escape | skill | 29 | `#34d399` |
| 20 | `rocket-landing` | Rocket Landing Challenge | skill | 30 | `#fda4af` |

## C.2 The matrix

Columns: **Cx** complexity 1–5 · **Camera** · **Scheme** (control scheme, new ones marked \*) · **Hyper3D (A)** new generations it needs first (shared ones marked `s:`) · **Reuse (D/C)** existing GLBs and new shared ones · **Core deps** Phase 1 modules it needs · **Owner** · **Wave** · **Build** agent-hours incl. tests and review fixes · **Rev** Claude review hours · **You** your hours (design approval, playtest, go-live).

| # | Slug | Cx | Camera | Scheme | Hyper3D (A) | Reuse (D / C) | Core deps | Owner | Wave | Build | Rev | You |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | treasure-island | 2 | follow 3/4 | joystick | s:chest, s:rock | runner, palm, umbrella, coin, crate, pigeon (hint) | env water/sky, fx, attach (hat), quality | Claude | Ref | 16–24 | 4 | 2 |
| 2 | museum-guard | 3 | first-person, fixed centre | look\* | (bust: tier 3, optional) | door, robot, bench; s:knight, s:dino, s:penguin | material override, ai/vision, motion, kit flashlight, fx, audio pan | Cursor | 3 | 12–18 | 3 | 1.5 |
| 3 | luggage-rush | 2 | fixed isometric | tap-target | suitcase | runner (decor) | path/conveyor, per-copy tint, kit conveyor, fx | Cursor | 1 | 8–12 | 2 | 1 |
| 4 | dino-egg-rescue | 2 | follow 3/4 | joystick | s:dino | palm; s:rock, s:leafyTree | motion (waddle, squash), path, fx | Antigravity | 2 | 8–12 | 2 | 1 |
| 5 | delivery-drone | 3 | high chase | flight\* | drone | car, taxi, van, pigeon, crate | path, target markers, audio loop, motion (bank, hover), fx | Codex | 2 | 12–18 | 3 | 1.5 |
| 6 | shopping-cart | 2 | follow 3/4 | joystick | cart | runner, cleaner, chef, apple, banana, burger, tinCan, bottle, bag | patrol, fx, audio loop | Antigravity | 1 | 8–12 | 2 | 1 |
| 7 | snowball-battle | 4 | follow high | joystick + tap-target | snowKid | s:pineTree | ballistics, steering, vision, attach, fx | Cursor | 3 | 18–28 | 4 | 2 |
| 8 | ghost-vacuum | 3 | follow top-down | joystick | vacuum | runner, desk, chair, book, door | attach, steering, kit flashlight, audio loop, fx | Kimi | 2 | 12–18 | 3 | 1.5 |
| 9 | construction-worker | 3 | fixed 3/4, slight follow | joystick + action + digit keys | – | runner, pallet, crate, van | attach (hard hat), kinematics (pendulum), fx | Cursor | 2 | 12–18 | 3 | 1.5 |
| 10 | alien-farm | 3 | follow 3/4, night | joystick | alien, glowPod | crate; s:rock | path, env starfield, fx, audio | Kimi | 3 | 12–18 | 3 | 1.5 |
| 11 | mini-golf | 4 | per-hole fitted | aim-drag\* | windmill | checkpoint-flag; s:rock, s:leafyTree | aim-drag, trajectory dots, kinematics, env water | Claude | 2 | 18–28 | 4 | 2 |
| 12 | robot-factory | 2 | fixed side 3/4 | tap-target | – | robot, battery, barrel, crate | path/conveyor, kit conveyor, fx sparks, per-copy tint | Kimi | 2 | 8–12 | 2 | 1 |
| 13 | pirate-cannons | 3 | fixed behind cannon | aim-drag\* | ship, s:cannon | barrel, crate, palm; s:chest | aim-drag, ballistics, trajectory dots, path, env water, fx | Claude | 1 | 12–18 | 3 | 1.5 |
| 14 | castle-defender | 4 | fixed high | tap-target | goblin, s:castleTower | door; s:cannon, s:rock, s:leafyTree | ballistics, path, motion (hop), per-copy tint, digit keys, fx | Codex | 3 | 18–28 | 4 | 2 |
| 15 | penguin-slide | 3 | chase | steer\* | s:penguin, s:fish, s:pineTree | checkpoint-flag | path (track spline), motion (bank, squash), fx, audio loop | Codex | 1 | 12–18 | 3 | 1.5 |
| 16 | space-repair | 3 | follow top-down | joystick + timing\* | astronaut | battery | kinematics, path, env starfield, attach (jetpack), fx, audio loop, target markers, timing ring | Antigravity | 3 | 12–18 | 3 | 1.5 |
| 17 | monster-kitchen | 2 | fixed front | tap-target | monster, cauldron | chef, apple, banana, burger, sock, tinCan; s:fish | motion, fx (steam, bubbles), per-copy tint | Kimi | 1 | 8–12 | 2 | 1 |
| 18 | knight-arena | 3 | fixed 3/4 | timing\* (directions) | s:knight, dummy | s:castleTower, s:leafyTree | attach (sword), motion, fx, audio | Antigravity | 2 | 12–18 | 3 | 1.5 |
| 19 | zoo-escape | 4 | follow top-down | joystick | panda, keeper | bench, bin, lamp, palm; s:rock, s:leafyTree | patrol, vision, steering, motion, attach (flashlight), kit fence | Claude | 3 | 18–28 | 4 | 2 |
| 20 | rocket-landing | 3 | side 2.5D follow | flight\* | rocket | battery (fuel cells) | kinematics, env starfield, fx (flame), audio loop | Codex | 2 | 12–18 | 3 | 1.5 |

Totals **[A]**: build ≈ 312 agent-hours (midpoints), Claude review ≈ 60 h, your time on games ≈ 30 h (plus program-level tasks in M).

## C.3 Priority scores

Scored 1 (worst) to 5 (best) on your nine criteria. "Simplicity", "cost", "risk" and "testing" are scored so that 5 = simplest / cheapest / safest / easiest to test. The wave also depends on asset and core dependencies and on one-game-per-agent sequencing, so it does not follow the total strictly.

| Slug | Visual | Simple | Reuse arch | Reuse assets | Cost | Risk | Original | Appeal | Testing | **Total** | Wave |
|---|---|---|---|---|---|---|---|---|---|---|---|
| treasure-island | 5 | 4 | 5 | 4 | 4 | 4 | 4 | 5 | 4 | **39** | Ref |
| shopping-cart | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | 4 | **37** | 1 |
| monster-kitchen | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | 4 | **35** | 1 |
| pirate-cannons | 5 | 3 | 5 | 3 | 3 | 3 | 4 | 5 | 3 | **34** | 1 |
| luggage-rush | 3 | 4 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | **33** | 1 |
| penguin-slide | 5 | 3 | 4 | 3 | 3 | 3 | 3 | 5 | 3 | **32** | 1 |
| robot-factory | 4 | 4 | 4 | 5 | 5 | 4 | 3 | 3 | 4 | **36** | 2 (Kimi busy in wave 1) |
| ghost-vacuum | 5 | 3 | 3 | 4 | 4 | 3 | 4 | 5 | 3 | **34** | 2 |
| dino-egg-rescue | 4 | 4 | 4 | 3 | 3 | 4 | 3 | 5 | 4 | **34** | 2 (needs dino batch) |
| rocket-landing | 4 | 3 | 3 | 4 | 4 | 3 | 3 | 4 | 3 | **31** | 2 |
| knight-arena | 4 | 3 | 3 | 3 | 3 | 3 | 4 | 4 | 3 | **30** | 2 |
| delivery-drone | 4 | 3 | 3 | 4 | 3 | 3 | 3 | 4 | 3 | **30** | 2 |
| mini-golf | 4 | 2 | 4 | 3 | 3 | 2 | 3 | 5 | 2 | **28** | 2 (proves the physics kit) |
| museum-guard | 4 | 3 | 3 | 5 | 5 | 2 | 5 | 4 | 3 | **34** | 3 (needs knight, dino, penguin) |
| zoo-escape | 4 | 2 | 4 | 4 | 3 | 2 | 4 | 5 | 2 | **30** | 3 (needs the AI kit) |
| space-repair | 4 | 3 | 3 | 3 | 3 | 3 | 3 | 4 | 3 | **29** | 3 |
| construction-worker | 3 | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | **29** | 2 (no new assets) |
| alien-farm | 4 | 3 | 3 | 2 | 2 | 3 | 4 | 3 | 3 | **27** | 3 |
| snowball-battle | 4 | 2 | 3 | 3 | 3 | 2 | 3 | 5 | 2 | **27** | 3 |
| castle-defender | 4 | 2 | 3 | 3 | 3 | 2 | 3 | 4 | 2 | **26** | 3 |

## C.4 Scoring model and provisional server entries

Every game is a **points** game. The real limits (`maxScore`, duration window, `base`, `maxPointsPerSec`) are set only when the game goes live, in Claude's "assets + limits" PR, with the proof in the game's README and a bot test through the real store (existing practice, `skills.md` "Scoring limits"). Until then P1-A writes **provisional, disabled** entries so the registry sync test and the server's JSON validation pass: `max_score` = 1.5 × the estimate below, `base` = `max_score`, `max_pps` = `max_score` (no plausibility gate yet), `enabled: false`.

| Slug | Score formula (summary; full in D) | Duration window | Estimated max **[A]** |
|---|---|---|---|
| treasure-island | 200 per treasure, +50 per clean dig, +10 per second left (90 s timer) | 15–92 s | 1,900 |
| museum-guard | 5 per second survived, +50 per exhibit sent back, +150 per alarm left at dawn | 10–92 s | 2,600 |
| luggage-rush | 20 per bag × combo (up to ×3), VIP ×2 | 10–122 s | 5,000 |
| dino-egg-rescue | 100 per egg × stack bonus (1 / 1.2 / 1.5), golden egg 300 | 10–92 s | 4,000 |
| delivery-drone | 150 per delivery + precision 0–100 + express 50 | 10–200 s | 4,000 |
| shopping-cart | 100 per list item, +300 list complete, combo, +10 per second left | 10–77 s | 2,000 |
| snowball-battle | 100 per hit, +300 per rival out, +500 clean win, +50 per health left | 10–92 s | 3,000 |
| ghost-vacuum | 100 per ghost, golden 300, multi-catch combo | 10–122 s | 3,500 |
| construction-worker | perfect 100 / good 60 / ok 30 per piece, +500 per building, time bonus | 20–152 s | 6,000 |
| alien-farm | 50 per crop (×2 perfect), delivery bonus by load | 10–102 s | 4,000 |
| mini-golf | per hole 100 × (par + 3 − strokes), hole-in-one +200 | 30 s–15 min | 4,500 |
| robot-factory | 20 per correct part, +200 per robot, combo | 10–92 s | 4,000 |
| pirate-cannons | 100–300 per ship, range bonus, barrel chains | 10–92 s | 6,000 |
| castle-defender | 20 per goblin, +200 per wave, +gate health bonus | 10–200 s | 5,000 |
| penguin-slide | 1 per metre, 10 per fish, tricks 50–200 | 3 s–15 min | 50,000 |
| space-repair | 100 per repair (150 perfect), +survival bonus | 10–122 s | 3,000 |
| monster-kitchen | 100 × order length factor + speed tip | 10–92 s | 4,000 |
| knight-arena | 10 per hit × combo (up to ×4), spin attack | 58–62 s | 6,000 |
| zoo-escape | 1,000 escape + 10 per second left + 50 per snack | 20–200 s | 3,000 |
| rocket-landing | up to 500 per landing (softness, centre, fuel), +300 all five | 15–300 s | 3,000 |

## C.5 Waves and the parallel rules

| Step | Claude | Codex (CLI) | Antigravity | Kimi (CLI) | Cursor |
|---|---|---|---|---|---|
| Phase 1 | core v3 (P-02, P-03, P-05) | pure helpers (P-04) | baseline audit (P-01) | audio (P-06), `tools/gamecheck` + `tools/perf` (P-07) | collections UI (P-08) |
| Phase 3 | **treasure-island** (reference) | design README: penguin-slide | design README: shopping-cart | design README: monster-kitchen | design README: luggage-rush |
| Wave 1 | **pirate-cannons** | **penguin-slide** | **shopping-cart** | **monster-kitchen** | **luggage-rush** |
| Wave 2 | **mini-golf** | **delivery-drone** → **rocket-landing** | **dino-egg-rescue** → **knight-arena** | **robot-factory** → **ghost-vacuum** | **construction-worker** |
| Wave 3 | **zoo-escape** | **castle-defender** | **space-repair** | **alien-farm** | **museum-guard** → **snowball-battle** |

Rules:
1. One game per agent at a time; at most **five** game branches open at once, one per builder, with starts staggered by a few days (Claude's review throughput is the real bottleneck: ≈ 2–4 h per game).
2. While an agent builds game N, it may write only the design README (G0) of its game N+1.
3. A game starts only when its core dependencies are merged and its tier of assets is generated (or it starts on primitives, which is always allowed: unlisted GLBs fall back by design **[V]** `core/modelManifest.ts`).
4. Waves overlap: an agent that finishes early starts its next game; the wave boundary is a planning aid, not a barrier.
5. Cursor is back (Pro plan, 2026-10-08) and builds 4 games plus the UI kit, by copy-paste. Codex is on the Plus plan: if its limit runs out, Claude moves its unstarted game to the builder with the most room.
