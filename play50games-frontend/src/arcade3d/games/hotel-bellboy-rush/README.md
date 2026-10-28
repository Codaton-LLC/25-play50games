# Hotel Bellboy Rush (`hotel-bellboy-rush`)

Menu 1 game 37 (`docs/menu1-new/specs-31-40.md` §37). Points, difficulty 2, collection skill, owner claude, status `dev`
(hidden; `arcade-games.json` `enabled: false`).

Push the luggage trolley through one hotel corridor. Read the key card (a floor and a room), take the bag at the
desk, ride the elevator pad when the bag is for another floor, and Use the door with that number.

## Files

| File | What |
|---|---|
| `levels.ts` | `HotelLevel` and the five configs from the spec, titles, start-card lines |
| `rules.ts` | pure, seeded: `createRun(seed, level)`, `step(run, input, dt, timeLeftMs)`, the bag queue, `earliestWinS`, `PROPOSED_LEVEL_LIMITS` |
| `meta.ts` | server-safe meta, the five limits (= `PROPOSED_LEVEL_LIMITS` = `arcade-games.json`) |
| `index.tsx` | `GameDefinition<HotelLevel>`: five `LevelSpec`s (clock, light, fog, HUD maxima, instructions) |
| `Scene.tsx` | one `useRunFrame`, the bellboy (auto-rig), trolley + tow handle, decor, the label atlas, the follow camera |
| `cart.ts` | pure: the cart's measured handle geometry, the hitch, the grips, and `reachArm` (two-bone IK onto `aimArm`) |
| `Hud.tsx` | the key card panel (`data-arcade-safe-area`): room, colour band, next step, the bag's 30 s clock |
| `looks.ts` | `COLORS`, `FLOOR_COLORS`, camera window, wall / trim / sconce / frame spots, label atlas layout |
| `assets.ts` | the ten Hyper3D GLBs and their measured fits, `BELLBOY_LANDMARKS` |
| `Primitives.tsx` | bevelled two-tone stand-ins (only drawn if a GLB fails) |
| `bots.testing.ts` | test bots (oracle, honest human pace, idle, spam) through the real store; tests only |
| tests | `rules.test.ts` (rules + per-level proof), `bots.test.ts`, `levels.test.ts`, `bellboy.test.ts`, `assets.test.ts`, `cart.test.ts` (cart follow + grip IK) |

## Rules

- Corridor 4 m wide (x -2..2), `doors * 3.2 + 6` m long. Reception desk against the lobby end (z 0..0.9), elevator
  door on the x +2 wall at z 4.4 with its pad at (1.2, 4.4), room doors on that wall at z 7.6 + 3.2 i.
- On-foot mover: accel 22, brake 28, radius 0.40, top speed 4.0 m/s, x 0.85 with a bag on the trolley. A push-out
  round a corner never carries the body further than its own step (the proof's speed bound); a pocket between two
  blockers keeps it where it stood.
- `actionPressed` reaches the nearest desk, pad or door point within 1.30 m (the zones never overlap):
  - desk: take the next bag (one at a time); the bag's own 30 s clock starts;
  - pad: from L2, with a bag for another floor, a 1.00 s ride locks movement, then the doors wear the bag's floor
    (labels `floor * 100 + index`). L1: the pad is dark and Use does nothing. Without a bag or with a bag for this
    floor: a buzz, no cost;
  - door: the bag's room on its floor scores and the trolley empties; any other door keeps the bag, costs a life and
    stuns 0.40 s. No bag: a buzz, no cost.
- Keyboard and touch share the same function and the same constants: only the stick axes and `actionPressed` reach
  `step`. The ride (1.00 s) and the stun (0.40 s) are play time, the same on every device.
- Bag queue (seeded): rooms come from a shuffle bag (each run of `doors` bags uses every door once); from L2 every
  bag is for another floor than the last (exactly one ride per bag). The same room never comes twice in a row.
- Score: +80 per delivered bag, +40 more if its 30 s clock is above half, and on the win +5 per full second left.
  Each bag pays once. Win: `bags` deliveries. Lose: 3 wrong doors (lives 0). Time-up: the shell clock.
- The trolley is looks only: it never moves the bellboy (test). He pulls it behind him by a brass tow bar (`cart.ts`,
  `stepTrolley`): its T-grip hangs on a hitch 0.36 m behind his centre on a stiff spring (no lag at a steady walk, at
  most `TROLLEY_LAG` 0.12 m on a start or a stop), the cart heads from its rear axle to the grip (a trailer: it pivots,
  never slides sideways), at most 0.9 rad off his heading (a turn on the spot carries it round him), its far end turns
  about the grip to clear walls and decor, and its centre stays inside the corridor. Straight behind him its centre is
  `TROLLEY_GAP` 1.18 m back (`cart.test.ts`).

## Levels

| L | Title | doors | floors | bags | clock | light | clear |
|---|---|---:|---:|---:|---:|---|---|
| 1 | Lobby Floor | 4 | 1 (pad dark) | 3 | 120 s | indoor | win |
| 2 | 3-Floor Hotel | 4 | 3 | 5 | 150 s | indoor | win |
| 3 | Luxury Hotel | 5 | 3 | 7 | 180 s | indoor | win |
| 4 | Business Hotel | 5 | 3 | 9 | 180 s | sunset | win |
| 5 | Grand Hotel | 6 | 4 | 12 | 210 s | night | win |

Level 1 is the spec's base game. Difficulty is monotone (doors, floors and bags never drop, the clock per bag shrinks
40 → 30 → 25.7 → 20 → 17.5 s, the earliest possible win grows). Only a win clears a level (`clearScore` omitted).

## Server limits and why they hold

Score sources per level: delivery 80 x bags, quick bonus 40 x bags, win bonus 5 x floor(seconds left). Before a win the
score is at most `120 * (bags - 1)`; a win at time t carries at most `120 * bags + 5 * floor(clock - t)`.

**Earliest win `T0` (`earliestWinS`, provable).** Each bag is walked loaded (3.4 m/s) from the desk's Use zone to its
door's zone; from L2 through the pad's zone plus the 1.00 s locked ride (every bag needs exactly one). Each bag but the
last is followed by a walk back to the desk's zone at 4.0 m/s. A leg between two zones is at least the points' distance
less 2 x 1.30 m. The shuffle bag fixes how often each door comes up; the bound takes the cheapest rooms for the part
round and the most distant door for the last bag (no walk back), by brute force over the subsets. Frames never move
the body further than speed x dt (test with 20 000 random frames); after a pickup the speed can exceed 3.4 m/s for at
most (4 - 3.4) / 22 s, under 0.01 m, covered by a 0.05 m slack per bag.

So `maxScore = 120 * bags + 5 * floor(clock - T0)`, `base = 120 * bags` (every score before a win),
`maxPointsPerSec = ceil(5 * floor(clock - T0) / T0)`: a win at any t ≥ T0 stays under `base + pps * t` because the bonus
falls as t grows (checked every 10 ms from T0 to the clock). `minDurationMs = 2000` on every level: no run ends
sooner (`earliestEndS`: three wrong doors need a loaded walk to door 1, 1.28 s, and two 0.40 s stuns = 2.08 s).
`maxDurationMs = clock + 2 s`.

| L | T0 (s) | base | pps | maxScore | min / max duration (ms) | honest bot (200 seeds, 60 Hz): wins, median score | oracle best (% of max), fastest win |
|---|---:|---:|---:|---:|---|---|---|
| 1 | 9.56 | 360 | 58 | 910 | 2000 / 122 000 | 200/200, 855 | 895 (98.4 %), 12.1 s |
| 2 | 19.90 | 600 | 33 | 1250 | 2000 / 152 000 | 200/200, 1115 | 1195 (95.6 %), 30.7 s |
| 3 | 32.93 | 840 | 23 | 1575 | 2000 / 182 000 | 200/200, 1375 | 1500 (95.2 %), 47.2 s |
| 4 | 46.74 | 1080 | 15 | 1745 | 2000 / 182 000 | 200/200, 1510 | 1665 (95.4 %), 63.0 s |
| 5 | 77.93 | 1440 | 9 | 2100 | 2000 / 212 000 | 200/200, 1800 | 1995 (95.0 %), 98.6 s |

L5 / L1 = 2.31 (≤ 3). Every level offers more than the one before.

Tests: `rules.test.ts` "score-limit proof" (the formulas, every win time, the partial score, the 2 s floor);
`bots.test.ts` runs oracle, honest, idle and spam bots through `createArcadeStore` at 30 / 60 / 144 Hz on every level:
every run is inside its level's limits and `capScore` is a no-op, the oracle always wins and reaches ≥ 90 % of
`maxScore`, no bot beats `T0` or ends before 2 s, idle and spam never win (spam's wrong doors cost lives and add no
points). `levels.test.ts`: the honest human-paced bot (0.9 stick, stops at each point, reads the card, 0.2-0.45 s
before each Use) wins ≥ 99 % of 200 seeds on every level, idle never clears; mutation probes show every level knob
(doors, floors, bags, durationMs, light) reaches the simulation.

## Look

- One palette (`looks.ts COLORS`): walls `#44403c`, carpet `#7f1d1d` (canvas diamond runner), marble lobby, brass
  `#d4a574` rails, frames and sconces, accent `#fbbf24`. Floor colours amber / teal / violet / rose on the plates.
- Lighting from the core preset per level (indoor L1-L3, sunset L4, night L5) + fog in the level's background colour;
  emissive sconces brighter at night.
- Door numbers: one 1024 x 512 canvas atlas (`ATLAS`) and one material for every plate (over the doors, the floor mats
  turned to the camera's yaw, the elevator panel, the key card over the trolley); redrawn only when the floor, the
  ride or the card changes. Mat digits are about 0.4 m tall. Colour plus digits, never colour alone.
- Camera: a follow window (`useFittedView` + `CameraRig`, `shift: true`, pitch 50°): landscape looks across the
  hall from the low x -2 side (7.2 m of hall), portrait looks up it from the lobby end (4.6 m), so the numbers stay
  readable on L5's 25 m hall. The near walls are low (0.9 m).
- Feedback: confetti + floating score on a delivery, sparkle on pickup and on every mat when the floor flips, a light
  beam over the pad during the ride, a puff + shake + buzz on a wrong door, a ring under whatever Use would reach
  (green when it would do something; it never says which door is right), an off-screen arrow to the desk or the
  elevator (`TargetMarkers`, never to a door).

## Models (Hyper3D, `public/models/3d`)

| Asset | File | Fit (from the measured raw bounds, `assets.test.ts`) |
|---|---|---|
| bellboy | `hotel-bellboy-rush/charBellboy.glb` (18k tris) | 1.74 m tall, auto-rig with `BELLBOY_LANDMARKS` (`bellboy.test.ts`), untinted |
| trolley | `hotel-bellboy-rush/bellboyTrolleyV3T.glb` | 1.30 m tall, long side (GLB z) along the pull |
| elevator | `hotel-bellboy-rush/elevatorDoorsSliding.glb` | 1.5 m wide, 2.30 m tall on the door wall |
| room doors | `hotel-bellboy-rush/hotelRoomDoor.glb` | 2.10 m, one `InstancedModel` |
| key card | `hotel-bellboy-rush/keyCard.glb` | 0.50 m beacon over the desk while a bag waits |
| desk | `hotel-bellboy-rush/receptionDesk.glb` | 2.2 x 0.9 m (its blocker), ~1.0 m tall |
| bell | `hotel-bellboy-rush/serviceBellV2.glb` | 0.17 m on the desk |
| planters | `hotel-bellboy-rush/lobbyPlanterR.glb` | 1.3 x 0.6 m (its blocker), instanced |
| sofa | `shared/sofa.glb` | 1.7 x 0.82 m (its blocker) |
| guests | `shared/travellerNpc.glb` | 1.70 m, unrigged decor by doors 1 and 3, untinted |
| suitcase | core `EXPANSION_ASSETS.suitcase` | 0.80 m on the trolley deck while loaded |

The bellboy: walk by distance over `walkStride` (`gaitPhaseStep`, cadence cap 3.2/s), the idle's upper body when
still; both hands on the cart's T-grip low behind his back, walking and standing: each frame `reachArm` (`cart.ts`)
solves a two-bone IK from the pose's own hips, spine and chest to that hand's world point on the grip and hands the
upper arm and forearm directions to `aimArm` (elbows bent back and a little out, 75-97 % of the arm's length), blended
with the arms and the trunk above the hips over the walk's legs; the grip swivels on the tow bar and stays square to
his back. If the cart is pushed off the hitch (a wall) both arms let go and come back once it is in reach. On a pickup
or a delivery the arm on the desk's or the door's side reaches out and back (0.7 s). A spine flinch on a wrong door,
`cheerPose` on the win, `applyLift={false}` with the group raised by `bodyLift`.

Why pulled and why a tow bar: pushed, the cart would sink about a metre into the wall at every door (he walks up to
them); pulled, it always has the floor he came over. The GLB's deck overhangs its crossbars by 0.21 m at shin height,
so a grip on the crossbar itself (within arm's reach) would leave the deck 0.15 m behind his heels, inside every stride
(the run's back heel reaches 0.56 m); the 0.45 m tow bar keeps it 0.60 m back. The cart is one mesh (no separate
wheels), so nothing spins.

## Performance

Draw calls: see the playtest notes in the branch report (`?perf=1`, `window.__arcadePerf`). Static decor is instanced
(walls 1, wainscot 1, brass 1, sconces 2, doors 1 per GLB mesh, planters 1, sofa 1); all labels 1; trolley card 1.

## Known issues

- `keyCard.glb` has pseudo-text on its face (small on screen); still wanted: `keyCardPlain`.
- `travellerNpc.glb` is photoreal with hands in pockets (not a T-pose): decor only; still wanted: `passengerNpc`.
- The shared sofa is teal-green, a little off the warm palette (untinted GLB).

## Clarity (2026-10-28, visual only)

The key card's hint ("Take the bag at the desk", "Elevator to floor 2", "Door 203") is the hint line, so no second `HintLine` is added. `guide.ts` (pure, `guide.test.ts`) picks the goal for two core `TargetBeacon`s: a gold "BAG" arrow on the reception desk while the trolley is empty and a green "UP" ring on the elevator pad while the carried bag is for another floor. The right DOOR is never marked: reading the key card and the door numbers is the game. A wrong door pops "Wrong door! -1 life" (`useActionPop`, same 0.22 shake); the bag hops from the desk onto the trolley and, on a correct door, from the trolley to the door (`<Toss>`, 0.4 s). The card's "Key card" label is 12 px. Rules, scoring and limits are unchanged.
