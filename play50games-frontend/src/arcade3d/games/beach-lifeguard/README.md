# Beach Lifeguard

Menu 1 game 34 (`docs/menu1-new/specs-31-40.md` §34). Points, difficulty 2, collection adventure, owner antigravity (built by Antigravity, gated and reworked by Claude 2026-10-25). Status `dev`.

A sand strip and a sea that deepens from the shore. An alert rings and a pink ring marks a swimmer; run down the beach, wade in and swim out (slower in the water), press Grab within 1.2 m, tow them back on the rescue tube and carry them up past the line at z = 2. Three missed alerts end the run.

## Files

| File | What |
|---|---|
| `rules.ts` | Pure rules: `createRun(seed, level, levelId)`, `step(run, input, dt, timeLeftMs)` (returns a shared event), `syncStore(run, ev, store)` (exactly the Scene's store calls), `stepZ` (the water split), `PROPOSED_LEVEL_LIMITS`, `PROOF_MIN_WIN_S`. |
| `levels.ts` | The five `BeachLevel` configs, titles, tile lines. |
| `looks.ts` | Palette, the follow view (an 18 x 15 m window round the aim, 9 x 12 m in portrait), aim bounds, the fog from the fitted distance, decor spots, the sea floor (`seabedY`) and the swim blend (`swimBlend`). |
| `assets.ts` | The ready Hyper3D GLBs with their measured raw bounds, fits in metres, `LIFEGUARD_LANDMARKS`. |
| `Scene.tsx` | One `useRunFrame` (step + syncStore + effects), the rigged lifeguard (run, wade, front crawl, carry, jet ski seat, cheer), the towed / carried swimmer, the rescue tube and its line, instanced swimmers / props / decor, the sea floor, `<Water>`, the shore foam, the wake rings, the code torus, `TargetMarkers`. |
| `testing/bots.ts`, `testing/limitProof.ts` | Test-only bots (oracle, greedy, idle, spam) through the real store (`playBot`) and a pure twin (`playPure`) for the 200-seed sweeps. |

## Controls and timing

Stick / WASD / arrows move (`inputToWorld` at the camera yaw), sand speed 5.0, x 0.62 in the water (split inside the frame that crosses z = 0, on x as well), x 0.85 while carrying. Grab is `actionPressed` (E, Enter, the touch Grab) within 1.20 m of the active swimmer only. On L4-L5 a Grab within 1.2 m of the jet ski mounts it (8.5 m/s on the water, it drops you at the shore and goes back to its dock). Every constant is the same for keyboard and touch; there is no held-button window.

Camera views (core/camera): 📷 / C (T too) cycle Classic → Chase → Front → Top → Free; drag turns the free view, wheel / pinch zoom. `useCameraViews({ subject: "character", steering: "camera" })`, all five views; the pivot is the drawn chest: on the sand `PIVOT` over the feet, easing down to the water line as the swim blends in, at the rider's chest on the jet ski. Solids: the tower and the beach props (`run.solids`), so the camera pulls in front of them in the chase / front / free views. `framing: { top: { distance: 18 } }`: the beach fog starts at `FOG_NEAR = 22` m (`looks.ts` `fogFor`), so the top view stays inside it. `step` gets `cam.yaw()`; in the classic view that is exactly the fitted yaw, so bots, proofs and limits are unchanged. No key conflicts: the game itself uses only WASD / arrows, E / Enter and Space. There was no game `Hud` before this (`Hud.tsx` is new and renders only the 📷 button); Saved and Alert stay the shell's stat chips.

## Levels

| L | Title | Width | Swim depth | Rescues | Alert | Jet ski | Clock | Lighting | Limits (max / base / pps) | Fastest bot win | Honest clear |
|---|---|---:|---:|---:|---:|---|---:|---|---|---:|---:|
| 1 | Small Beach | 24 | 12 | 2 | 40 s | no | 120 s | day | 1110 / 500 / 107 | 6.96 s | 200/200 |
| 2 | Busy Beach | 32 | 16 | 3 | 34 s | no | 150 s | day | 1490 / 750 / 64 | 14.10 s | 200/200 |
| 3 | Resort | 40 | 18 | 4 | 30 s | no | 180 s | day, more chairs | 1860 / 1000 / 46 | 22.97 s | 200/200 |
| 4 | Waterpark | 44 | 20 | 5 | 28 s | yes | 180 s | sunset | 2130 / 1250 / 50 | 23.13 s | 200/200 |
| 5 | Stormy Beach | 48 | 22 | 6 | 24 s | yes | 210 s | sunset, near fog | 2510 / 1500 / 44 | 28.94 s | 200/200 |

A level clears only on a win (no `clearScore`). minDurationMs 4000 everywhere.

## Server limits and why they hold

Score sources (rules.ts constants): a rescue pays `RESCUE_BASE_POINTS` 180, plus `RESCUE_CLOCK_BONUS` 70 when its alert clock is above half; each swimmer is rescued once, so the objective ceiling is `Bobj = 250 x rescues`. The win adds `TIME_BONUS_PER_SECOND` 5 x the full seconds left on the shell clock. Expiries, grabs and the jet ski pay nothing.

For a win at time t: `B(t) = Bobj + 5 floor(D - t)`, largest at the earliest win M. Before any win the score is a part of Bobj <= base. So `base = Bobj`, `maxScore >= Bobj + 5 floor(D - M)` and `pps >= 5 (D - M) / M`. M (`PROOF_MIN_WIN_S`) is 0.8 x the fastest win of the oracle and greedy bots over 200 seeds at 30 / 60 / 144 Hz (the oracle rides the jet ski on L4-L5 when the ride is faster; L4 / L5 keep the smaller M from an earlier layout run, which only loosens pps); margins: maxScore +3 %, pps +4 %, rounded up.

| L | Bobj | D | M | peak | maxScore | pps | best bot | best / max |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 500 | 120 | 5.56 | 1070 | 1110 | 107 | 1065 | 96 % |
| 2 | 750 | 150 | 11.28 | 1440 | 1490 | 64 | 1425 | 96 % |
| 3 | 1000 | 180 | 18.37 | 1805 | 1860 | 46 | 1785 | 96 % |
| 4 | 1250 | 180 | 17.08 | 2060 | 2130 | 50 | 2030 | 95 % |
| 5 | 1500 | 210 | 22.51 | 2435 | 2510 | 44 | 2405 | 96 % |

L5 / L1 = 2.26. Tests (`limits.a/b.test.ts` via `testing/limitProof.ts`): every oracle, greedy, idle and spam run on 200 seeds is inside its level's limits with the cap a no-op; M <= 0.8 x the fastest win; the line covers B(t) for every t >= M; best >= 90 % of maxScore; the honest bot clears >= 99 %; idle never clears; the store-driven bots (30 / 60 / 144 Hz and random frames) agree with the pure sweep.

## Models

Ready GLBs from `menu1-beach-lifeguard` (copied as optimized, listed in `core/modelManifest.ts`): `charLifeguard` (1.82 m, auto-rig with `LIFEGUARD_LANDMARKS`, `lifeguard.test.ts`), `lifeguardTower` (3.0 m, solid), `rescueFloat` (0.9 m, on the tower, in the right hand on the sand, on its tow line in the water), `beachgoerNpc` (1.65 m, unrigged, chest-deep, bobbing), `rescueJetSki` (2.4 m), `beachChair`, `beachCooler`, `sandcastle`, `beachHut` (decor), plus the reused clean-city `umbrella` and `palm`. Not adopted: `surfboard*` (a disc, broken, and `surfboardLong` is square), `alertBuoy` (the alert stays the code torus), `hero.glb`.

## The swim (2026-10-28, after the user's playtest: "the person walks on water; the lifeguard should swim")

All visual: the rules (and so the limits) are unchanged.

- **The sea has depth.** A sea floor (`Seabed`) slopes from the shore (`seabedY`: 0.42 m down per metre out, to 3.2 m) under a see-through `<Water>` (opacity 0.8), shaded from sand to deep teal: shallow water reads light, the deep reads dark. Two foam lines (`ShoreFoam`, a canvas texture) wash up the wet sand and back, half a wave apart.
- **The lifeguard wades, then swims.** On foot he stands on the sea floor, so wading sinks him to the waist. From z = -1.3 to -2.3 (`swimBlend`) he lies down about his chest (the group turned 1.42 rad about x, pivoted at the chest) with the chest at the water line, and the pose blends from the walk into the core front crawl (`crawlPose`: arms over, a pull under the body, a high-elbow recovery, a body roll, a breath to the side, a flutter kick), one arm cycle about every 1.2 s at full speed. Each hand entry splashes; a ring of foam spreads behind the kick.
- **The pickup.** Grab: a splash and two rings where the swimmer was, a "Saved!" popup, and the swimmer is drawn up out of the water onto the rescue tube (eased from where it stood).
- **The tow.** In the water the swimmer lies on its back at the water line on the tube, head towards the lifeguard, towed on a yellow line from his hip; without a swimmer the tube trails on the line behind him. On the sand it is the tube in his hand.
- **The carry.** Out of the water he carries the swimmer up the beach across his forearms (`carryPose` on the arms, the swimmer lying across them); a rescue drops it on the dry sand ("Rescued! +N", confetti), where every rescued swimmer then stands facing the sea, bouncing a little.
- **The jet ski** rider sits on its seat with the core `sitPose` (it was the idle pose raised 0.55 m), and the ski leaves a wake.
- The swimmer GLB is arms-down (no T-pose), so it cannot be auto-rigged: it stays a solid figure that bobs, rocks and splashes in trouble, lies on the tube and stands on the sand.

## Gate fixes (2026-10-25)

- Props and the tower were walk-through: `resolveSphereAabb` returns a copy unless `out` is passed.
- An expired alert cycled to the next index even when that swimmer was already saved, so it could never be grabbed and cost another life: the alert now goes to the next swimmer still out (`nextSwimmer`).
- Swimmer x's are sorted draws in the slack left after the 6 m spacing (the helper's first-come rejection got stuck on 23 of 200 L4 seeds and fell back to fixed even slots); the alert order is shuffled.
- `createRun` guessed the level id from the config; it takes it. Held Action no longer re-triggers grab / mount every frame (one press = one Grab).
- The lifeguard was a static `<Model>`: now `<HumanoidModel>` with walk (gait phase from `gaitPhaseStep`), idle on the jet ski and a cheer on the win, and the float attached to the right hand.
- Ground and water reach past the fog (no void at the edges); the camera follows a window instead of fitting the whole 48 m beach; props, swimmers and decor are instanced; decor is fitted to 1 m and scaled once by its spot; tall decor stands past the beach ends and only low clutter on the camera side (see Playtest fixes).
- The custom HUD duplicated the shell's Saved / Alert chips: removed.
- Limits re-proven per level (the helper's L1 maxScore 1020 was below a 1060 bot run).

## Playtest fixes (2026-10-25, after the first flagged-build playtest)

- Portrait (390 x 844) was washed out and the lifeguard tiny: portrait now follows a 9 x 12 m window (landscape 18 x 15 m), and the fog is set from the fitted camera distance (`fogFor`: it starts half a window past the aim, keeps the level's own depth, never nearer than the desk 22 m), restored on unmount. `looks.test.ts` fits both windows at 390 x 844 and 1280 x 800 with the pure `fitView`.
- Palms and huts stood between the camera and the beach (the camera looks north from the south, so "behind the sand" was the camera side): tall decor now lines both ends of the beach only (>= 2 m past the play rectangle), and the camera side has only low clutter (sandcastles and coolers under 0.7 m, decor-fitted to 1 m). Tested in `looks.test.ts`.
- The sand was one flat plane with a hard white line: one canvas texture now runs the whole beach width, wet sand from the water to the safe line at z = 2 with a soft tide line where it ends, dry sand in tone bands with ripples and grain.

## Known issues / for the playtest

- Check the jet ski's forward axis and that the tower's front faces the sea (`rotation-y = PI`).
- The swimmer GLB is unrigged (arms down, no T-pose): it bobs and rocks, it cannot wave or hold the tube with its arms. A T-pose swimmer GLB would let the auto-rig animate it (a Hyper3D generation, user's call).
