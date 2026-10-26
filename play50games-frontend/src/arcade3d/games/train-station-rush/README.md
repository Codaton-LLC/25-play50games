# Train Station Rush (`train-station-rush`)

Menu 1 game 44 (`docs/menu1-new/specs-41-50.md` §44). Points, difficulty 2, collection skill, owner claude, status `dev`
(hidden; `arcade-games.json` `enabled: false`).

You are the station worker. Bags and passengers turn up at the entrance with a platform tag (colour + shape +
number). Carry the bag, or walk the passenger, to that platform's boarding pad while its train is in.

## Files

| File | What |
|---|---|
| `levels.ts` | `StationLevel` and the five configs from the spec, titles, start-card lines, `passengerCount` |
| `rules.ts` | pure, seeded: `createRun(seed, level)`, `step(run, input, dt, timeLeftMs)`, the task queue, the follower, the crowd, `earliestWinS`, `PROPOSED_LEVEL_LIMITS` |
| `meta.ts` | server-safe meta, the five limits (= `PROPOSED_LEVEL_LIMITS` = `arcade-games.json`) |
| `index.tsx` | `GameDefinition<StationLevel>`: five `LevelSpec`s (clock, light, fog, HUD max, instructions) |
| `Scene.tsx` | one `useRunFrame`; the worker (auto-rig), trains (carriage GLB pool + code engine pool), travellers (one pool), the plates atlas, the follow camera |
| `Hud.tsx` | the departures board (`data-arcade-safe-area`): each open task's shape, number, bag or passenger and its train's wait |
| `looks.ts` | `COLORS`, `PLATFORM_LOOKS`, camera window, island / track / wall spots, the trains' timeline (`trainOffset`), atlas layout |
| `assets.ts` | the Hyper3D GLBs and their measured fits, `WORKER_LANDMARKS` |
| `Primitives.tsx` | the engine (code, until a `locomotiveFront` GLB exists) and bevelled stand-ins |
| `bots.testing.ts` | test bots (oracle, honest human pace, idle, spam) through the real store; tests only |
| tests | `rules.test.ts` (rules + per-level proof), `bots.test.ts`, `levels.test.ts`, `worker.test.ts`, `assets.test.ts` |

## Rules

- Concourse across the top: z 0..8 (the entrance wall at z 0), as wide as the platforms plus 1.5 m a side. Platforms
  run down from it (z 8..19) in back-to-back pairs on islands: track (2.4 m) | platform (2.8) | platform (2.8) | track
  (2.4), pairs side by side, so every platform has its own track. Track beds are never walkable. A boarding pad in the
  middle of each platform (z 13.5); a sign behind it, two lamps and a canopy with benches on every island.
- On-foot mover: accel 22, brake 28, radius 0.38, top speed 4.6 m/s, x 0.80 with a bag in hand. A move slides along
  whatever blocks it (one axis at a time) and never goes further than speed x dt.
- Tasks open at the entrance spots (one spot with one task open, two with two). Each is `{ kind, platform }`; its
  train arrives `arriveS` after the task opens and leaves `dwellS` later. The next queued task opens when one resolves.
  Platforms come from a shuffle bag (every `platforms` tasks in a row use each once, never the same twice in a row);
  `round(tasks x passengerShare)` of them are passengers, in a seeded order. Two open tasks never share a platform, and
  a task never opens on a track whose train is still pulling out (4 s).
- `actionPressed` within 1.20 m: at a spot, take its task (one in hand at a time); a passenger then follows at 3.0 m/s,
  1.0 m behind (`arrive`); stuck under 0.15 m/s for 1.2 s while more than 1.8 m away, it jumps to the nearest free point
  towards the worker, at most `MAX_JUMP` = 3.42 m (so it never beats 3.0 m/s on average). At a pad: hand over if it is
  the task's platform, its train is in and (a passenger) the passenger is within 2.2 m of the pad. A wrong platform,
  an empty hand or a train not in yet: a buzz, no cost.
- A train that leaves with its task undelivered: that task is missed (a life; what was held goes), the next opens.
- Crowd (L3+): travellers wander the concourse (`wander` + `separate`, 0.9 m/s), clear of a lane along the platform
  edge, stepping aside for the worker and the passenger; they are solid for both.
- Score: +100 per delivered task, +50 more if more than half of its train's wait was left, and on the win +5 per full
  second left. Each task resolves once. Win: every task resolved with at most one missed. Lose: lives 0 (three
  missed), or every task resolved with two missed. Time-up: the shell clock.
- Keyboard and touch share the same function and the same constants: only the stick axes and `actionPressed` reach
  `step`; the follower's timings are play time.

## Levels

| L | Title | platforms | tasks | passengers | open at once | arrive / dwell | crowd | clock | light |
|---|---|---:|---:|---:|---:|---|---:|---:|---|
| 1 | 2 Platforms | 2 | 4 | 0 | 1 | 4 / 22 s | 0 | 120 s | day |
| 2 | 4 Platforms | 4 | 6 | 2 | 1 | 4 / 22 s | 0 | 150 s | day |
| 3 | Central Station | 4 | 8 | 3 | 1 | 3 / 20 s | 6 | 180 s | indoor |
| 4 | Rush Hour | 4 | 10 | 4 | 2 | 3 / 24 s | 8 | 180 s | sunset |
| 5 | Mega Station | 6 | 12 | 6 | 2 | 3 / 24 s | 10 | 210 s | night |

Level 1 is the spec's base game. Difficulty is monotone (platforms, tasks, passengers, tasks open at once and the crowd
never drop; the clock per task shrinks 30 → 25 → 22.5 → 18 → 17.5 s). Only a win clears a level (`clearScore` omitted).

## Server limits and why they hold

Score sources per level: delivery 100 x tasks, prompt bonus 50 x tasks, win bonus 5 x floor(seconds left). Before a
win the score is at most `150 * (tasks - 1)`; a win at time t carries at most `150 * tasks + 5 * floor(clock - t)`.

**Earliest win `T0` (`earliestWinS`, provable).** A bag is walked from an entrance spot's Use zone to its pad's zone at
3.68 m/s; a passenger walks from its spot to within 2.2 m of the pad at 3.0 m/s (its stuck jump never beats that);
every delivery but the last is followed by a walk back to an entrance zone at 4.6 m/s. A leg is at least the points'
distance less both reaches. The shuffle bag fixes how often each platform comes up; the bound takes the nearest
platforms for the part round, the passengers on the shortest walks and the farthest pad last (no walk back), by brute
force. A win with one task missed needs that train to leave: at least `arriveS + dwellS` after the start, so
`T0 = min(all delivered, max(all but one delivered, arriveS + dwellS))`. Frames never move the worker further than
speed x dt (20 000 random frames); after a pickup the speed exceeds 3.68 m/s for under 0.05 s (0.05 m slack a bag).

`maxScore = 150 * tasks + 5 * floor(clock - T0)`, `base = 150 * tasks`, `maxPointsPerSec = ceil(5 * floor(clock - T0) / T0)`:
a win at any t ≥ T0 stays under `base + pps * t` (checked every 10 ms to the clock). `minDurationMs` = the earliest end
of any run, less 0.1 s: a loss needs a train to leave (`arriveS + dwellS`), a win needs `T0`. `maxDurationMs = clock + 2 s`.

| L | T0 (s) | earliest end (s) | base | pps | maxScore | min / max duration (ms) |
|---|---:|---:|---:|---:|---:|---|
| 1 | 17.30 | 17.30 | 600 | 30 | 1110 | 17 200 / 122 000 |
| 2 | 26.00 | 26.00 | 900 | 24 | 1520 | 25 900 / 152 000 |
| 3 | 36.30 | 23.00 | 1200 | 20 | 1915 | 22 900 / 182 000 |
| 4 | 45.31 | 27.00 | 1500 | 15 | 2170 | 26 900 / 182 000 |
| 5 | 63.35 | 27.00 | 1800 | 12 | 2530 | 26 900 / 212 000 |

L5 / L1 = 2.28 (≤ 3). Every level offers more than the one before.

Bots (`bots.test.ts`, `levels.test.ts`), through `createArcadeStore` at 30 / 60 / 144 Hz: every run of every bot is
inside its level's limits and `capScore` is a no-op; the oracle (greedy: earliest departure first) wins ≥ 99 %; no bot beats `T0` or ends before the
earliest end; idle never scores (its trains leave: a loss); spam never wins. The honest human-paced bot (0.9 stick,
stops at each point, reads the tag, 0.2-0.45 s before each Use, waits for a lagging passenger, sidesteps travellers)
wins ≥ 99 % of 200 seeds on every level. Mutation probes show every level knob (platforms, tasks, passengerShare,
parallel, arriveS, dwellS, crowd, durationMs, light) reaches the simulation.

Bot runs (40 seeds, 60 Hz; the 200-seed clear rate is asserted in `levels.test.ts`):

| L | honest: wins, median score, median time | oracle: best score (% of max), fastest win |
|---|---|---|
| 1 | 40/40, 1060, 27.7 s | 1095 (98.6 %), 20.9 s |
| 2 | 40/40, 1405, 48.5 s | 1465 (96.4 %), 36.5 s |
| 3 | 40/40, 1760, 67.5 s | 1845 (96.3 %), 50.8 s |
| 4 | 40/40, 1510, 90.2 s | 2060 (94.9 %), 66.8 s |
| 5 | 40/40, 1695, 120.2 s (at dwell 22 s) | 2035 (80.4 %), 90.7 s |

## Look

- One palette (`looks.ts COLORS`): platform `#cbd5e1`, edge strip `#facc15`, track bed `#57534e`, accent `#38bdf8`,
  terrazzo concourse, slate walls. Platform looks: blue circle, green square, orange triangle, purple diamond, red
  star, teal drop, always with the number (pad plates, sign plates, the tags over waiting tasks, the HUD board).
- Lighting from the core preset per level (day, day, indoor, sunset, night) + fog in the level's colour; the yellow
  edge strips and the lamp heads glow at night.
- Track beds sit 0.55 m below the floor (looks only): rails, sleepers and red buffers; trains slide in (ease-out over
  `arriveS`) and pull out accelerating; two `trainCarV2` carriages behind a code engine per train.
- Camera: a follow window (`useFittedView` + `CameraRig`, `shift: true`, pitch 58°, from past the platforms' ends
  towards the entrance): landscape keeps the whole depth and about two islands on screen, portrait a narrower,
  shorter window that follows both ways.
- Feedback: confetti + floating score at the pad, sparkle on a pickup, a puff + shake + alarm when a train leaves
  without its task, pulsing pad rings while their train is in, a ring under whatever Use would reach (green when it
  would act), an off-screen arrow to the held task's pad (`TargetMarkers`).

## Models (Hyper3D, `public/models/3d`)

| Asset | File | Fit (from the measured raw bounds, `assets.test.ts`) |
|---|---|---|
| worker | `train-station-rush/charStationWorker.glb` (18k tris) | 1.78 m tall, auto-rig with `WORKER_LANDMARKS` (`worker.test.ts`), untinted |
| carriage | `train-station-rush/trainCarV2.glb` | 2.0 m wide (14.3 m long), one dynamic pool |
| canopy | `train-station-rush/platformCanopy.glb` | 4.0 x 2.1 m across each island, 2.0 m tall |
| sign | `train-station-rush/platformSign.glb` | 1.2 m wide behind each pad, its plate from the atlas |
| bench | `train-station-rush/stationBench.glb` | 1.9 m, concourse sides |
| clock | `train-station-rush/stationClock.glb` | 1.35 m over the entrance doors |
| trolley | `train-station-rush/stationTrolley.glb` | 1.04 m, parked by the entrance |
| backpack | `train-station-rush/backpack.glb` | a bag look, 0.55 m (0.47 m in the arms) |
| ticket machines | `train-station-rush/ticketMachine.glb` | 1.7 m, beside the entrance |
| travellers | `shared/travellerNpc.glb` | 1.70 m, passengers and the crowd, one pool, unrigged, untinted |
| suitcase | core `EXPANSION_ASSETS.suitcase` | 0.80 m (0.56 m in the arms) |
| lamps | core `REUSED_ASSETS.lamp` | 2.8 m on the islands |

The worker: walk by distance over `walkStride` (`gaitPhaseStep`, cadence cap 3.4/s), the idle's upper body when still,
the forearms-forward `carryPose(0)` with a bag (the bag between the forearms), `cheerPose` on the win,
`applyLift={false}` with the group raised by `bodyLift`.

## Known issues

- L5's ceiling assumes every task earns its +50; with two tasks open at once the second rarely can, so the best oracle
  run reaches about 80 % of L5's `maxScore` (L1-L4: 95-99 %; the test floor for L5 is 75 %). A tighter L5 ceiling needs a bound on prompt deliveries
  with two open tasks.
- `platformCanopy.glb`'s texture reads as green shag at play size: it is drawn in one slate material (`ASSETS.canopy.material`).
- The engine is a code stand-in: still wanted `locomotiveFront` (`hyper3d-needed.md`); `locomotive.glb` is a whole
  multi-car set and is not used.
- `travellerNpc.glb` is photoreal with hands in pockets (not a T-pose): unrigged, it waddles; still wanted
  `passengerNpc`. `ticketMachine.glb` has text-like marks (kept at the back wall); still wanted `ticketMachineClean`.
- Spec deviations (to keep L5 clearable on 99 % of seeds and walks honest): L5's dwell is 24 s (spec 22: with six far
  platforms and passengers at 3 m/s the honest bot lost 4 of 200 seeds, 200/200 at 24 s); the concourse is 8 m deep (spec 10),
  platforms 2.8 m wide (spec 3) with 2.4 m track beds, every platform has its own track (back-to-back pairs).
