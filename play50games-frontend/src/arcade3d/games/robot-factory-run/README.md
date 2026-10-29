# Robot Factory Run (Menu 2, game 13, World 1 Ember Heights): CONVEYOR ROUTING

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 65. Codex built
a first version (`codex/m2-robot-factory-run`, e72cb2d9); Claude's gate rebuilt the game on a real
tile grid against the card (`docs/menu2-super/world-1-ember-heights.md` "13 Robot Factory Run"):
the first version ran every cell along one straight row of junctions (set each once, then wait),
its score floor (`2000 + (n - 1) * 5000`) was not a bound (Zuno's magnet and Riko's flick move cells,
and charged cells came back), it needed a game-local Roll key the shell does not have, and its
scene was a placeholder. The GLBs, the registration and the arcade-games.json slot are Codex's.

## Concept and controls

A grey, powered-down robot factory on a 2 m tile grid. Power cells leave a dispenser on a fixed
beat and ride the conveyor belts. Turntable junctions turn a quarter turn when someone steps on the
red switch plate wired to them (a glowing floor wire shows the wiring; the table's arrow shows where
it sends cells). Route the cells into the charger (2 in L1, 3 after), then reach the exit. You are a
moving piece on the board: belts carry you too.

- Keyboard: WASD / arrows move (camera-relative), Space jumps, Space again in the air roll-drops,
  E or Enter is the hero power. Touch: joystick + Jump + Power. No Roll button is needed: plates fire
  when you step on them, the roll-drop is the second Jump.
- Camera: the shared orbit (menu2/camera), a 3/4 view behind the hero (44 deg, 11.5 m).
- Hero: the shared picker; **Riko** (W1's lead) is preselected.

## Rules (`rules.ts`, `factory.ts`)

- Belts carry cells at 2.5 m/s tile centre to tile centre; a hero standing on a belt rides +2.5 m/s.
- Turntables: a quarter turn clockwise per plate press (0.35 s; a cell at its centre waits); a plate
  resets 0.45 s after a press.
- The dispenser lets a cell out every 3.2 s (L5: 2.4 s) while fewer than 2 (L5: 3) ride and the
  charger still wants more; it skips the beat otherwise.
- A cell that runs off a belt end (onto floor or into machinery) or sits under a slamming press is
  scrap. Presses: 1.6 s cycle, the red shadow warns 0.5 s, the slam lasts 0.3 s, and knocks a hero back.
- L2: the amber klaxon belts run backwards every other 6 s; cells on them turn round.
- L3: robot arms lift what waits on their pad two belts on (cells), or you (onto the catwalk).
- L4: the plates also swap the exit's laser gates: two presses of a plate leave them as they were.
- Tread bots roll back and forth and knock you back.
- Win: the charger full and you in the exit (L5: M-8 down). The cap ends the shift "timeup".

### Hero roles (the card; every level has all five, all bonus)

| Hero | Power (cooldown) | What it opens |
|---|---|---|
| Riko | dash 12 m/s for 0.35 s (5 s) | flicks a cell beside him one belt over, smashes cracked crates (an orb inside), knocks a jammed table free |
| Nami | a second jump in the air | the catwalk (2.2 m) and its orbs / sticker |
| Kiro | shield 2.5 s (9 s) | walks through laser gates (orbs in the beams) |
| Zuno | magnet 3 s, 4 m (7 s) | a cell hops one belt towards him; orbs hidden in the machinery fly out |
| Vexa | phase 1.6 s (8 s) | walks through ghost crates into the maintenance rooms |

## Levels

| Level | Cap | Twist |
|---|---:|---|
| 1 Assembly Start | 90 s | ride a belt; a junction pointing at the floor (the first cell is scrap: the lesson); a second junction that bounces cells until turned; a press; 2 cells. The hidden sixth turntable's extra turn feeds the secret charger |
| 2 Conveyor Hall | 110 s | the klaxon line (short, timed) or the long dry way round (two more junctions); a tread bot |
| 3 Robot Arms | 120 s | the arm line lifts cells over a wall (short), or the long belt round; the roof arm lifts you to the catwalk |
| 4 Laser Line | 140 s | each plate turns a table and swaps the exit lasers; plan the order |
| 5 Factory Overdrive | 240 s | Overseer M-8 |

### Boss: Overseer M-8 (`OVERSEER`, m2MegaRobotBoss, 6.2 m tall)

8 hp, one hit per window, time-driven from the start.
1. **Overload** (3 hits): its chest socket glows; a cell routed into it while it glows is a hit. Its
   punch knocks a junction back a quarter turn and jams it for 1.5 s (one press puts it right; Riko's
   dash frees it at once).
2. **Belt walk** (2 hits): it walks the lane belts; step on the gold plate to reverse the lane and
   drag it into the press, which slams it while the window is open.
3. **Overheat** (3 hits): back on its gantry, its vents open: climb the boxes to the catwalk, jump and
   roll-drop onto a vent. Slow-mo, the furnaces glow red.

## Scoring

A **time game**: duration = finish - 200 ms per orb - the flow bonus (3 s window, +0.25, x2 cap;
orbs 20, charged cells 30, boss hits 40). Only a win is ranked.

### Server limits and why they hold (`bound.ts`)

Levels 1-4: the N charged cells are N different cells, so the latest-emitted of them left the
dispenser no earlier than `firstMs + (N - 1) * cadence` (the dispenser only emits on its beat). That
cell needed at least `d` tile steps at 0.8 s each, where `d` is the fewest steps from the dispenser
to the charger over every tile a cell can sit on in any direction (wiring, klaxon and turns ignored;
an arm is a free jump). The only other ways a cell moves are Riko's flick and Zuno's magnet hop, one
tile per power use, so a journey of T ms gets at most `1 + T / cooldown` free tiles:
`T >= 0.8 s * (d - 1) / (1 + 0.8 s / cooldown)`. Level 5: M-8's windows are time-driven, so it falls
no earlier than every window hit at its first ms (17 700 + intro = 19 700 ms). Less every orb and the
most flow bonus (`comboMaxBonus`), less about 4.5 %.

| Level | Steps d | Least finish | Least duration | minDurationMs | max = timeBase | maxScore |
|---|---:|---:|---:|---:|---:|---:|
| 1 Assembly Start | 10 | 10 906 | 7 596 | 7 200 | 90 000 | 8 280 |
| 2 Conveyor Hall | 15 | 17 555 | 14 215 | 13 500 | 110 000 | 9 650 |
| 3 Robot Arms | 7 | 12 037 | 8 697 | 8 300 | 120 000 | 11 170 |
| 4 Laser Line | 11 | 14 796 | 11 456 | 10 900 | 140 000 | 12 910 |
| 5 Factory Overdrive | - | 19 700 | 15 910 | 15 100 | 240 000 | 22 490 |

### What the bots and probes reached

The bot (`bot.ts`, also driven in the browser with `?autoplay=1`) wins every level with no hit, at
30, 60 and 144 fps. At 60 fps:

| Level | Win (sim ms) | Orbs | % of maxScore |
|---|---:|---:|---:|
| 1 | 20 688 | 8/8 | 85.8 |
| 2 | 29 514 | 8/8 | 85.2 |
| 3 | 26 402 | 8/8 | 85.3 |
| 4 | 26 310 | 8/8 | 89.4 |
| 5 | 55 969 | 8/10 | 82.6 |

`proof.test.ts` also runs 120 random players a level (L1-L4): none charges the k-th cell before the
bound. Spamming jump, roll-drop and every hero power never beats the limit, and the store test pins
the table above.

## Open issues

- The card asks for a 3 s jam after a boss punch. Here it is 1.5 s, and one plate press turns the
  knocked table back. 3 s with the old two-press fix made phase 1 a stall.
- Presses crush only cells that pass during the 300 ms slam. The card's "any cell under the press"
  also killed cells that were still waiting.
- There is no Roll button. Plates fire when you step on them, and a second Jump in the air
  roll-drops (vents, L5).
- The L5 bot skips 2 of the 10 catwalk orbs, so the all-orbs star on L5 is human-only for now.
- Co-op dual switches from the card are not built. In multiplayer every hero is on one shared board,
  and only the driver run moves the line and the boss.
- The multiplayer view follows the local hero only. There is no split view.
