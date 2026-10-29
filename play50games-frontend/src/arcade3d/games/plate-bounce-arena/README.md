# Plate Bounce Arena (Menu 2 #32, World 4, lead hero Zuno)

The hero is the pinball. A toy pinball table in the Pinball Hall, tilted 7°, five configurations (the card
in `docs/menu2-super/world-4-frost-and-sweets.md`, "32 Plate Bounce Arena").

## Files

| File | What |
|---|---|
| `table.ts` | The five tables as data in table coordinates (x across, z up the table, h height): walls, kickers, flippers, bumpers, mushrooms, penguin targets, lanterns, ramps / the orbit, orbs, magnet pads, the deck, the attic, the exit hole and each level's objectives in order. |
| `rules.ts` | The deterministic pinball (8 ms substeps), objectives, balls, powers, secrets, Rollo, the proof (`chainFloorM`, `bossMinMs`, `proposeLimits`). Pure. |
| `bot.ts` | The honest bot: flips only. Near the flippers it tries flips (which, when, how long, or a cradle) on copies of the run 1.5 s ahead and keeps the best one. |
| `TableView.tsx`, `World.tsx`, `Ball.tsx`, `Rollo.tsx` | The table, the hall, the hero ball, the boss. Visual only. |
| `Scene.tsx`, `camera.ts`, `Hud.tsx` | Simulation and juice, the orbit camera (the card's table view as the default pose), the HUD. |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | Local 2-4 players on one table. |

## Play

- Space / Flip held charges the plunger; let go to launch (a gold band on the gauge is the skill shot).
- A / ← and D / → hold the flippers (they also nudge lightly); on a phone, hold that half of the screen. Space / Flip in play flips both.
- The stick and W / S nudge the table (2 m/s², camera-relative). No tilt penalty.
- Camera: right-drag, two fingers, pinch, Q / C; recenter returns to the table view.
- Three balls per table, a 6 s ball save after each launch. Losing the last ball ends the run unranked.

Sections (objectives) count only while current; when all are done the exit hole opens (it pulls the ball in):

1. Practice: 3 bumper hits with the drain gated, a ramp shot through the gold rings, 3 lanterns.
2. Mushroom Garden: the mushrooms throw the ball onto the orbit; 3 orbits in a row (15 s apart at most) light the 2× table multiplier; then knock down 3 penguins.
3. Ice Table: 30 % less drag, a 15 % steeper slope; the left ice blocks, a ramp shot, the right ice blocks.
4. Multiball: 3 lanterns release 2 steel marbles (they score but cannot be nudged and never count for sections); 2 jackpot ramp shots (3× jackpot while all three are alive).
5. Rollo (m2ShadowArmadillo, 6 HP): P1 Clash: hit him at ≥ 9 m/s in his window (3); P2 Armour: only a golden ball (10 s after a ramp shot) counts (2); P3 Flipper thief: he jams one flipper, the other every 8 s, while a toy post guards that side of the drain; the jackpot ramp in his window is the finish (1).

Heroes: Riko dash (once per ball) breaks the cracked block into the skill lane; Nami hop and double hop (from under the deck onto the raised deck with its own bumpers); Kiro shield (4 s, once per ball) saves a drain; Zuno sticks to a magnet pad (hold Action, ≤ 1.5 s), aims with the stick, fires at 15 m/s and pulls the coins under the glass; Vexa phase (3 s) through the ghost gate into the attic. Secrets: the skill shot, the penguin sticker behind the lone penguin, the attic shard.

Stars: clear; every main orb (8 / 10 / 12 / 14 / 10); the time 90 / 110 / 120 / 140 / 180 s. Badge: no ball lost.

## Scoring and the proof

Time game: the submitted time is the finish time minus 50 ms per orb minus the combo bonus. Per level,
`minDurationMs = floor(0.95 × (floor − orbs × 50 − comboMaxBonus) / 100) × 100` and `timeBaseMs = maxDurationMs`
= the clock cap (300 / 330 / 360 / 390 / 420 s).

The floor: the ball never moves faster than `V_MAX` = 18 m/s. The rules cap the speed every substep and also
cap the ball's travel per substep to `V_MAX × dt` (push-outs, ramp transport, flights, the magnet included);
the only jump is the respawn onto the plunger. Sections count only while current, so a win must touch, in
order, a piece of each section (a bumper, the ramp mouth then the whole ramp, the lanterns or the bank in any
order, the mushrooms then the orbit path, each time) and then the hole. `chainFloorM` is the shortest such
chain between contact discs, where every leg may instead start from the plunger; the floor is
`chainFloorM / V_MAX`. On level 5 the floor is `bossMinMs` (every Rollo hit at the first moment of each
window). The combo meter counts at most 24 bumper and 8 ramp/orbit links; `comboMaxBonus` bounds it.

Tests: `proof.test.ts` (the bot through the real store with ragged frames, ranked inside the row; the travel
bound under input spam for every step; idle and a lost table unranked; the pinned rows), `bots.test.ts` (every
hero clears every level under 85 % of the cap), `rules.test.ts`, `powers.test.ts`, `table.test.ts`,
`assets.test.ts`, `look.test.ts`, `orbit.test.ts`, `multiplayer.test.ts`.

## Assets

Table props from `~/.play50/hyper3d/ready/menu2/plate-bounce-arena` (mushroom, bumper V2, penguin, plunger,
score ring, stadium stand V2I; `m2BumperPost` turned out to be an arcade cabinet and `m2ToyFlipper` a toy
shuffle table: both are hall decoration) and magnet-coin-lab's `m2HorseshoeMagnet` for Zuno's pads. Shared:
the heroes, `m2ShadowArmadillo`, `scoreOrb`, `bouncePad`, the coin. The flippers are the code-built
`menu2/props` Flipper. Code: the playfield, rails, ramps, lanterns, the hole, posts, deck, glass, lights.

## Known limits

- The ranked floor is loose on levels 1-4 (a few seconds against bot times of 1-3 minutes): it is sound, not tight.
- Versus is a race to the exit (first to sink, after the grace), not the card's "goal duel, first to 5".
- Multiplayer balls pass through each other (each hero has their own run on the shared table).
