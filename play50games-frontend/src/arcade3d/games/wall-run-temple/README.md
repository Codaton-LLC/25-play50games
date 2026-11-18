# Wall Run Temple (Menu 2, game 31, World 3 Wild Temples): WALL-RUN

Status: **dev** (preview builds only, `enabled: false` in `arcade-games.json`), order 70. Built by Claude
on 2026-10-29 to the approved card (`docs/menu2-super/world-3-wild-temples.md` "31 Wall Run Temple" on
`claude/m2-super-plan`, framework `00-framework.md`) on the menu2 shared systems.

## Concept and controls

A cliff temple with no floor. Jump onto the glyph walls and run along them, kick from wall to wall
before the run droops, whip round stone columns at the corners, and rest on the gap platforms.

- **Wall-run:** jump at a glyph wall moving toward it (or with the stick held toward it: a 150 ms grace)
  and you stick, running along it at 7 m/s. The run holds its height for 0.6 s, then droops at
  1.5 m/s²; after 1.6 s on one wall you drop off. Running off a panel's end onto the next panel of the
  same face carries on.
- **Wall-kick:** Jump on a wall kicks you up (8 m/s) and across (6.5 m/s) to the facing wall; the catch
  restarts the run. Each catch after a kick links the combo, the card's x1-x5 kick chain; a landing ends it.
- **Column whip:** pass a stone column at speed (5 m/s or more) and you swing round it; the grab snaps to
  the closest point so the turn is exactly 90°. A temple corner block fills each turn's inside, so a
  plain jump cannot cut the corner.
- **Wall-roll:** Action on a wall rolls you into the armoured ball for 0.5 s: spike panels pass over you.
- Keyboard: WASD / arrows (camera-relative), Space jumps and kicks, E / Enter rolls on a wall and fires
  the hero power off it. Touch: joystick, Jump, Roll. Same windows on touch and keyboard (decision 7).
- Camera (menu2/camera, the shared orbit): behind the hero down the corridor; it swings behind each new
  heading 0.6 s after a whip (auto-follow on the corridor's heading). Drag / two fingers turn, wheel /
  pinch zoom, Q/C turn, R/F tilt, V recenters.
- Hero: the shared picker (start card, pause, result). **Kiro** (W3's lead) is preselected.

## Files

| File | What |
|---|---|
| `meta.ts`, `index.tsx` | plain data (time game, five levels, order 70); the GameDefinition (intro, star screen, runPlayers, a sky per level) |
| `levels.ts`, `course.ts` | the per-level config; the course builder (corridors of facing walls, whips with corner blocks, the shaft, the five hero pockets, the legs the bot reads) |
| `rules.ts` | pure rules: 8 ms substeps, wall catch / run / droop / kick, whip, roll, moving and crumbling panels, hazards, pickups, Umbra, the reach bound, `PROPOSED_LEVEL_LIMITS` |
| `bot.ts` | the honest bot (tests, `?autoplay=1` on preview builds) |
| `heroes.ts`, `progression.ts`, `levelEnd.ts`, `StarResult.tsx` | heroes; combo, stars, secrets, `UMBRA` (menu2/boss); progress; the star screen |
| `World.tsx`, `CourseView.tsx`, `Umbra.tsx`, `Hero.tsx`, `look.ts`, `assets.ts`, `textures.ts`, `Billboards.tsx` | the sky, canopy and cliffs; the temple; the boss; the hero; palette and skies; the models; canvas textures; one-draw-call billboards |
| `Scene.tsx`, `camera.ts`, `Hud.tsx` | simulation and juice, the orbit camera and intro, the HUD |
| `multiplayer.ts`, `MultiScene.tsx`, `MultiplayerHud.tsx` | local 2-4 players |

## Levels (one temple, five configurations)

1. **Training Wall** (misty morning, target 60 s): one long wall over a shallow pit with a floor (a fall
   there is a soft reset, not a fall), two facing walls (the kick), a column whip round a corner over the
   real chasm; then three more corridors and corners.
2. **Double Wall** (green noon, 80 s): sliding panels in and out of the cliff on a 3 s cycle (the facing
   panel is out while yours is in); an in panel is not runnable and sits 1.2 m back (still solid).
3. **Column Hall** (golden hour, 100 s): whip-to-whip chains of two and three columns, and spike panels on
   both walls that you roll under.
4. **Broken Temple** (blue night with torches, 120 s): crumbling 6 m panels crack 0.8 s after a run on
   them starts (the timer runs with the run, a seam buys no time; respawns and checkpoints mend them),
   and stone rams swing down the corridors' middles (wall-runners pass beside them; a kick meets them).
5. **Master Wall Run** (the storm, 150 s), boss **Umbra** (`m2ShadowArmadillo`):
   - P1 Mirror: he runs the facing wall level with you and throws a flat shadow plate across in his
     attack (rise or drop on the wall to let it pass); in his window, kick into him: 2 hits.
   - P2 Cracks (a gate opens): he waits at the next hall column; whip round it in his window: 2 hits.
   - P3 Shaft (a gate opens): a vertical shaft of facing walls (no run along them); out-climb him by kicks
     to the top glyph and slam it in his window: the capstone drops on him (slow-mo).

### Hero roles (every level has all five pockets; their orbs are bonus orbs)

| Hero | Power | Pocket |
|---|---|---|
| Riko | dash 12 m/s, 0.5 s | a cracked stone panel on a pad with orbs packed inside: only the dash breaks in |
| Nami | a second jump in the air | the upper wall tier over a pad: above a kick's reach, inside a kick plus a double jump |
| Kiro | shield 3 s (20 s cooldown, the world's rule) | a dart-vent line high on a corridor wall, orbs threaded through it (the shield also stops rams and plates) |
| Zuno | magnet 6 m | gold ring orbs (`m2GoldRingOrb`) set in the cliff face behind a wall, past any hand |
| Vexa | phase 3 s | a ghost-walled room beside a pad: orbs and the shard |

Stars: clear, every main orb, a submitted time at or under 60 / 80 / 100 / 120 / 150 s; the no-fall badge.
Secrets on every level: **Never Touch the Floor** (finish with no fall and no landing off a checkpoint:
a sticker), the **ghost room shard**, the **lower tier cave** (a low wall under a corridor, reached only by
letting the droop take you down on purpose).

## Scoring and the proof

Time game: `score = floor((timeBaseMs - duration) / 10)`, ranked only on a win. Submitted duration =
finish ms - 50 ms per orb - the flow meter's bonus (`runTimeMs`, `finalScore`).

1. **Clock:** whole ms, the fraction carried; `simMs <= elapsedMs`.
2. **The reach bound:** after every substep and on a respawn, `clampReach` keeps the hero's Manhattan
   distance (xz) from the start at or under `12 m/s x t` (`V_PACE`, `reachOf`). It is an average pace from
   the start, not a top speed; honest bots stay under 80 % of it (`proof.test.ts`), and a spam test with
   random camera yaws and frame times checks the bound every step on every level.
3. **The course is a staircase** of +x and +z legs (it never doubles back), so its length is the Manhattan
   distance to the finish pad's near edge (`span`). Level 5 also needs Umbra down: his machine
   (menu2/boss) is time-driven and takes hits only in his windows, so the least time to land all 5 hits is
   `bossMinMs` = 10 200 ms.
4. **Least duration:** less every orb (bonus orbs included) at 50 ms and the flow bound `comboMaxBonus`
   (orbs 4 ms, the first 40 kick links 3 ms, the first 2 x columns whip links 5 ms, boss hits 20 ms, x5 cap).
5. **Limits:** the bound x 0.95 rounded down to 100 ms; `timeBaseMs` = `maxDurationMs` = the clock cap.

| Level | Span (m) | Travel floor | Boss floor | Orbs (main) | Orb bonus | Flow bound | Least duration | minDurationMs | maxDurationMs | maxScore | Bot finish (ms) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 207.2 | 17 267 | - | 48 (32) | 2 400 | 1 378 | 13 488 | 12 800 | 150 000 | 13 720 | 27 100-27 300 |
| 2 | 227.8 | 18 984 | - | 50 (34) | 2 500 | 1 370 | 15 113 | 14 300 | 180 000 | 16 570 | 36 600-51 700 |
| 3 | 214.4 | 17 867 | - | 48 (32) | 2 400 | 1 538 | 13 928 | 13 200 | 210 000 | 19 680 | 30 900-33 700 |
| 4 | 217.2 | 18 100 | - | 48 (32) | 2 400 | 1 378 | 14 322 | 13 600 | 240 000 | 22 640 | 42 200-65 700 |
| 5 | 130.0 | 10 834 | 10 200 | 36 (20) | 1 800 | 1 586 | 7 447 | 7 000 | 300 000 | 29 300 | 27 600-27 700 |

Bot finish: 30 runs per level (5 heroes x 6 seeds, 5 % ragged frames), all wins. `meta.ts` and
`arcade-games.json` carry `PROPOSED_LEVEL_LIMITS`; `registry.sync.test.ts` keeps them equal.

## Playtest (2026-10-29, headless Chrome over CDP, `next dev` on 3313, `?autoplay=1`, all levels unlocked)

All five levels cleared by the preview bot at 1280 x 800 (mouse-drag orbit) and at 390 x 844 (two-finger
orbit): 0 console errors, at most 58 draw calls, at most 0.75 M triangles (wall slabs 6 x 4 m, corner skins
on the top 9 m only), frame p50 16.7 ms. A column or corner block the camera is inside steps out of the shot
(a fast whip outruns the camera's collision), so the hero stays in view on a phone.

## Known issues

- Temple corner blocks, the gap platforms' hollow-top fillers, the ram chains, the darts, the gates and the
  top glyph are code (deliberate, 2-3 tones); everything else is Hyper3D.
- The shared multiplayer camera keeps one yaw for the whole course (it turns at corners); the card's
  catch-up teleport for 3-4 players after 4 s off screen is not built; the co-op boost kick is not built.
- Umbra is the shared armadillo GLB (no rig): he slides and tips on the wall rather than running.
