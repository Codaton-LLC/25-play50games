# Temple Lantern Jump (Menu 2, game 06)

Owner: Claude. Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`). Order 56 (55 is Cloud Hopper).
Spec: `docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md` GAME 06 ("Use balconies and lantern bounce pads to climb").
Heroes: the shared Color Roll Heroes, each its own GLB (`menu2/heroModels.ts`, live pick in `heroes.ts`). The picker colour is a swatch only.

## Concept and controls

An original hillside temple at dusk: paper lanterns, wooden balconies, beams and braziers, in generic stone and timber. The
climb is a courtyard in **groups of three**:

1. a **lantern bounce pad** on one side of the courtyard (walk onto it: it throws you 8 m up at once),
2. a **balcony** on the other side, one lantern's throw (5 to 7 m) above it: a jump only reaches 3.3 m, so the lanterns are the
   only way up (`layouts.test.ts` takes them away and no level can be finished),
3. a **middle balcony** a short hop higher, which on some groups holds a **brazier checkpoint** (the lit lantern you respawn at).

Then the next lantern, on the opposite side. Coins take 0.4 s off your time each. A fall costs time and returns you to the last
checkpoint. The generator is `temple.ts` (`buildTemple`, `nodeRole`); it is not Rooftop's zigzag, Flooded's spiral or Lava's sweep.

- Keyboard: WASD / arrows move (up = away from the camera), Space jumps, E or Enter uses the hero power.
- Touch: joystick + Jump + Power. The same timing for both: one jump press and one action press, 130 ms buffer, 100 ms coyote time.
- The start card picks the hero; the pick shows on the intro at once.

## Files

| File | What |
|---|---|
| `meta.ts` | time game, five levels, `rollheroes`, order 56, status `dev`, owner `claude` |
| `index.tsx` | GameDefinition: `intro: true`, `clockChip: false`, `finalScore` |
| `levels.ts` | the five specs (balconies, lantern throw, hazards) |
| `temple.ts` | the courtyard generator |
| `heroes.ts` / `powers` | the five heroes and the run-option pick (`subscribeHero`) |
| `rules.ts` | pure rules, the lower bound, `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | honest bot (tests, and `?autoplay=1` on preview builds) |
| `Scene.tsx` / `Course.tsx` / `World.tsx` | simulation and camera; balconies, lanterns, braziers; the hillside |
| `rules.test.ts`, `proof.test.ts`, `layouts.test.ts`, `powers.test.ts`, `assets.test.ts`, `look.test.ts`, `hero.test.ts`, `livePick.test.ts` | proof, powers, mesh fit |

## Rules

Units: 1 = 1 m; forward is -z, up is +y. The clock is whole ms. A jump arc depends only on the ms since take-off.

- **Hero:** cylinder radius 0.32, height 1.2. Run 6.5 m/s. Gravity 30. Jump 14 m/s (apex 3.27 m). A lantern launches at 22 m/s (apex 8.07 m; `PAD_HALF` 1.25 m around its centre).
- **Balconies:** rectangles; landing crosses a top downwards, centre over it (grown by 0.15 m).
- **Hazards:** swinging decks (movers), paper floors that tear away and return (3.6 s cycle, gone 22 %), polished wood (low traction), bells that strike the rim of some balconies (shield and phase ignore them), hillside wind on level 5. They sit on the plain middle balconies only, so a throw always lands on a still, dry balcony.
- **Finish:** stand on the goal roof. The level timer ends the run `"timeup"` (unranked). Only `end("win")` is ranked.

## Scoring and limits

A **time game**: `score = floor((timeBaseMs - duration_ms) / 10)`, the duration being the finish minus 400 ms per coin.

The bound (`minDurationMsOf`) takes the shortest chain of flights between balconies (a lantern's throw is a flight like any other, from a
lantern only) with the ground time counted as 0, and every coin. `proposeLimits` takes 92 % of it, rounded down to 100 ms. The bound
ignores the walking between lanterns, so the honest bot's finish is several times it; that only makes the limit generous, never
unsafe (`rules.test.ts` keeps every finish at least the limit and under 7x it).

| Level | Name | minDurationMs | maxDurationMs = timeBaseMs | maxScore | honest bot (30 / 60 / 144 fps) |
|---|---|---:|---:|---:|---|
| 1 | Temple Gate | 2 700 | 90 000 | 8 730 | 94 % |
| 2 | Lantern Hall | 4 700 | 120 000 | 11 530 | 94 % |
| 3 | Balcony Climb | 4 400 | 150 000 | 14 560 | 92 % |
| 4 | Night Temple | 4 100 | 180 000 | 17 590 | 91 % |
| 5 | Golden Roof | 5 100 | 240 000 | 23 490 | 91 % |

Level 5 is a best-time climb, so its clock is 240 s (the others follow the plan: 90 / 120 / 150 / 180 s). Level 5's maxScore is 2.69x level 1's
(the cap is 3x). The honest bot clears every level at least 90 % of the level's maxScore at 30, 60 and 144 fps.

`proof.test.ts` runs every hero with its power mashed on every level at 30 / 60 / 144 Hz (no finish beats the floor or the clock), idle
(never wins) and 60 spam runs per level, and mutation probes (a 15 % lower goal roof or six fewer balconies falls outside the limits
window). `registry.sync.test.ts` checks the JSON against `meta.ts`.

## Levels

| Level | Title | Timer | Course |
|---|---|---|---|
| 1 | Temple Gate | 90 s | 10 balconies, 3 lanterns, goal at 24 m, wide and still |
| 2 | Lantern Hall | 120 s | 14 balconies, 4 lanterns to 34 m, a swinging deck |
| 3 | Balcony Climb | 150 s | 18 balconies, 6 lanterns to 44 m, swinging decks, paper floors, polished wood |
| 4 | Night Temple | 180 s | 22 balconies, 7 lanterns to 54 m, night, swinging decks, tearing floors, bells |
| 5 | Golden Roof | 240 s | 28 balconies, 9 lanterns to 68 m, every hazard and the hill wind |

## Models

Hyper3D props in `public/models/3d/temple-lantern-jump/`: `m2TempleLedge` (the decks), `m2TempleLantern` (the lantern pads and the hanging
lanterns), `m2LanternDeck` (lantern posts), `m2StoneBrazier` (checkpoints), `m2TempleBeam` (timber under the decks),
`m2RuinRoofSection` (the golden roof over the goal), `m2TempleTowerBg` (far towers), `m2WoodenBalcony` and `m2WoodenBalconyV2` (listed, kept for decor).
Heroes reuse `/models/3d/menu2/m2Hero{Riko,Nami,Kiro,Zuno,Vexa}.glb`. Coins reuse the shared coin. `assets.test.ts` fits every GLB to the real mesh.
