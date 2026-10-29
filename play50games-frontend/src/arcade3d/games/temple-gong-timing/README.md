# Temple Gong Timing (Menu 2, game 36, World 3 Wild Temples): STRIKE ON THE BEAT

Card: `docs/menu2-super/world-3-wild-temples.md` "36 Temple Gong Timing" (branch `claude/m2-super-plan`). Slug `temple-gong-timing`, order 72, owner claude, status dev, lead hero Kiro (`defaultHeroFor`). A points game, the World 3 finale (Coilstone freed on level 5).

## Concept and controls

Giant gongs stand round a ruined circular stage (`chart.ts`: stage radius 7.4 m, gongs on 8.3 m, their strike points on 6.6 m). Timing rings shrink onto the gong that the next note belongs to; Strike (E / Enter / the Strike button) when the ring closes. The judgement is one window for every device (CLAUDE.md decision 7): **Perfect within 45 ms, Good within 90 ms**, judged on the run clock (fixed steps, 1000/120 ms), never on the audio clock. A press up to 180 ms early at the note's own gong spends the note as a miss, so spamming never pays.

The card's touch fix: with the stick at rest the hero rolls to the next note's gong by himself (`rules.ts` auto-route), so a phone player only times Strike. The stick (camera-relative, `StepInput.yaw = orbit.viewYaw`) takes over to go after bonus notes, echo orbs and the secrets. Jump (Space / Jump) clears the off-beat shockwaves. Ceremony drums are hold notes: keep Strike held to the end for 50 more.

- Keyboard: WASD / arrows, Space, E or Enter; camera: drag, Q / C, R / F, wheel, V recenters.
- Touch: joystick, Jump, Strike; two fingers rotate, pinch zooms (`OrbitHud` recenter button).
- Camera (`camera.ts`): the card asks for "one fixed elevated stage camera", Menu 2 asks for a free orbit, so play uses the shared orbit (`menu2/camera`) pivoting on the stage (leaning 35 % towards the hero so he stays in frame on a phone), high and in front, its auto-follow off: the view only moves when the player moves it.

## Files

`levels.ts` (5 configs) · `chart.ts` (the stage geometry, the bar DSL, the songs of levels 1-4, level 5's units) · `rules.ts` (the pure, fixed-step simulation) · `bound.ts` (the score bound) · `progression.ts` (combo, points, stars, secrets, Coilstone) · `heroes.ts` · `bot.ts` (the honest bot, `?autoplay=1` in preview builds) · `Scene.tsx` (beat drums through `playSfx`) · `StageView.tsx` · `World.tsx` · `Coilstone.tsx` · `Hero.tsx` · `camera.ts` · `Hud.tsx` + CSS · `StarResult.tsx` + `levelEnd.ts` · `multiplayer.ts` + `MultiScene.tsx` + `MultiplayerHud.tsx` · `look.ts` · `assets.ts` · tests `rules`, `proof`, `orbit`, `multiplayer`, `assets`.

Chart DSL (`writeBars`): a bar is 4 (or 8) slots; `gN` a note on gong N, `dN` / `DN` a drum (`D` held), `XN` a cross-stage note (Riko), `PN` a pillar note (Nami), `H` the ghost gong (Vexa), `G` the Great Gong, `!` a lantern call, `~` its answer (no ring), `^` a shockwave, `.` a rest.

## Levels (the card)

| Level | BPM | Gongs | Twist | Clear (accuracy) | Echo orbs | Score target |
|---|---|---|---|---|---|---|
| L1 Slow Beat | 96 | 4 | one gong, then two, then held drums; rings 4 beats ahead | 70 % | 44 | 9 300 |
| L2 Alternating Gongs | 104 | 6 | call and response: the lantern pillars flash a 4-note pattern, you play it back with no rings | 75 % | 43 | 8 700 |
| L3 Moving Targets | 112 | 6 | the gongs orbit the stage (one turn in 28 s): lead your roll | 80 % | 40 | 8 100 |
| L4 Fast Rhythm | 124 | 8 | eighth notes and shockwaves on every other off-beat | 85 % | 52 | 11 500 |
| L5 Perfect Timing | 120 | 6 | Coilstone (below) | Coilstone freed | 70 | 17 500 |

Accuracy = (Perfects + Goods / 2) / main notes. Bonus notes are extra and never count against it.

### Boss: Coilstone, the Temple Serpent (level 5)

The shared World 3 guardian (`m2CoilstoneHead` + instanced `m2CoilstoneSegment`), coiled round the stage, eight plates (`progression.ts COILSTONE`). The song is built as the fight goes, unit by unit (`chart.ts BOSS_UNITS`):
- P1 "Echo the call" (8 -> 4): its tail plays a pattern on three gongs; each Perfect echo cracks a plate.
- P2 "Duel" (4 -> 1): 8-bar phrases with shockwaves; 80 % or better in a phrase cracks a plate.
- P3 "The Great Gong" (1 -> 0): a 16-beat crescendo ending on the Great Gong in the middle (the code-built `menu2/props` GreatGong; the m2GreatGong GLB is not used). A Perfect last strike frees it (slow-mo, jade eyes); a miss repeats the crescendo.
A failed unit repeats; the run is capped at 240 s. Only the first `PAID_UNITS` (call 2, duel 4, great 2) pay points; later repeats are encores worth nothing, so farming a fight never out-scores winning it.

## Heroes (passive perks)

- **Riko:** his dash crosses the stage in a beat (14 m/s, others roll at 9), so he alone takes the cross-stage notes worth double (`rules.test.ts` checks every cross note needs more than the roll and less than the dash).
- **Nami:** double-jumps to the pillar-top gongs (bonus notes, 1.7 m of air).
- **Kiro:** his shield saves one miss or one shockwave every 20 s (the combo survives).
- **Zuno:** his magnet pulls echo orbs from 4 m.
- **Vexa:** phases to the ghost gong (bonus notes and the ghost chord's shard).

## Scoring

Main note: Perfect 100, Good 50; pillar / ghost note 150 / 75; cross note 200 / 100; a held drum 50 more; a Perfect throws an echo orb (20) out of the gong. A hero at the strike point catches it at once, and one that rolls away has 1.6 s to grab it as it floats inward. The combo (`menu2/combo`: 8 s window, +0.1 a link, cap x2) multiplies note bases. Secrets and the boss add no score.

### Server limits and why they hold (`bound.ts`, `proof.test.ts`)

- Levels 1-4 play one fixed song and always last the whole song. maxScore = every note at its best (Perfect + echo + hold) plus `comboMaxBonus` (the exact most the combo can add over every order). The prefix bound S(t) (all notes whose window has opened by t, GOOD_MS before the beat) gives the rate row: S(t) <= base + pps x t at every note's earliest moment (S only steps up there). minDuration = the song's length x 0.94, rounded down to 100 ms.
- Level 5: any run is a string of units from the start, so its points by t are at most (the best points per ms of any unit) x t + (the most one unit pays), each note at twice its base (the combo's cap) plus its extras. maxScore = each kind's paid units at that kind's best unit. minDuration = the quickest defeat (one call unit, three duels, the Great Gong's note) x 0.94.

| Level | maxScore | minDurationMs | maxDurationMs | base | maxPointsPerSec |
|---|---|---|---|---|---|
| 1 | 12 790 | 72 800 | 79 500 | 400 | 176 |
| 2 | 13 690 | 71 500 | 78 154 | 400 | 187 |
| 3 | 14 180 | 64 400 | 70 572 | 400 | 215 |
| 4 | 14 790 | 41 800 | 46 517 | 400 | 358 |
| 5 | 28 600 | 64 700 | 242 000 | 5 720 | 318 |

The rows are pinned in `proof.test.ts` and equal `meta.levels[].scoring` and `arcade-games.json`. Checked per frame: perfect, 45 ms-sloppy, spamming and random players of every hero at 30 / 60 / 144 fps never pass the bound or maxScore; a level-5 farmer who never cracks a duel plate plays to the cap and stays under it; the honest bot wins every level with three stars and a 45 ms-sloppy bot still clears (levels 1-4 at the accuracy target); a ragged-frame run through the real store submits a score inside the limits.

## Secrets, stars, progress

Secrets (`menu2/secrets`, never score): **Ghost gong chord** (Vexa: strike every ghost note: the shard; L1-L4), **The Ninth Gong** (L1 and L3: strike the hidden gong among the ruins, front left, on three downbeats: a sticker, and the beat track adds a rimshot), **Silent Master** (L2 and L5: every answer to a call Perfect, a sticker), **One Strike** (L5: Coilstone freed on the first try of the Great Gong). Stars (`menu2/stars`): the clear, the echo orbs, the score target; no-hit = full combo. The level end goes through `menu2/progress` (`levelEnd.ts`), the star screen is `StarResult.tsx`.

## Local multiplayer (menu2/multiplayer, M1)

2-4 heroes on the same stage and song (`multiplayer.ts`). Co-op "band mode": a Perfect by one hero keeps every bandmate's combo window open; the band clears when its average accuracy reaches the level's target (L5: when everyone frees Coilstone). Versus: the same chart, the highest score wins. The shared camera frames every hero. Not built from the card: the mirrored half-stages of versus and the party "gong steal".

## Look

Per level (`look.ts`): the World 3 palette from dawn to storm. Flowers grow round the stage with every Perfect (the card's "the arena grows back"). Gongs `m2TempleGong` on `m2StrikerPost`, the floor `m2GongStage`, drums `m2CeremonyDrum`, pillars `m2RuinLanternPillar`, rings `m2TimingRing`, ruins `m2JungleRuinBg`, echo orbs the shared `scoreOrb`.

## Open issues

- No latency calibration step (the card's): judging uses the run clock, so a device's audio latency shifts only what the player hears, never the windows.
- No world music stems (`menu2/audio` does not exist yet): the beat is a drum track built from core sound effects.
- Echo orbs spawn inside the reach of a hero standing at the gong, so a Perfect usually catches its orb at once; the star counts echo orbs, which in practice means Perfects.
- Versus half-stages and party "gong steal" are not built.
