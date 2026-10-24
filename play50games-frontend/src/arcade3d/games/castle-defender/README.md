# Castle Defender

Owner: Codex. Slug: castle-defender. P-16 difficulty/combo implementation; server-limit approval pending. Spec: 04 §14. Metres/seconds; x east, z toward wall, y up. Pure rules own tuning; no Rapier.

## Levels (P-30 pilot, 2026-10-24)

Five levels through the core level system (`core/README.md` "Levels"): `levels.ts` holds the pure `CastleLevel` configs, `createRun(seed, level)` takes one, Scene/Hud read it with `useCastleLevel()` (= `useLevel<CastleLevel>()`), `index.tsx` declares the five `LevelSpec`s (description, config, environment from `looks.ts` `LEVEL_LOOKS`), `meta.ts` the titles and limits. Level 1 is today's game unchanged (rules.test.ts passes unchanged; levels.test.ts pins its config, starts, safety end, look and start card). Same castle, lanes, assets, cannon, rocks, HP, damage, combo and the four upgrade offers on every level; only the waves, a speed factor on every goblin, the gap between wave starts and the clear time change, plus the sky, the core lighting preset and two scenery-only looks (`LevelLook.ground` tint on the meadow/hills/lanes, `LevelLook.torches` point lights). A level clears on a **win** (every wave survived, gate HP > 0); there is no `clearScore`.

| Level | Title | Waves / goblins | Speed | Start gap / clear | Win at | What changes | Lighting |
|---|---|---:|---:|---:|---:|---|---|
| 1 | Outer Wall | 5 / 98 | 1.00 | 28 / 24 s | 136 s | today's game | sunset (today's sky) |
| 2 | Main Gate | 5 / 102 | 1.05 | 27 / 23 s | 131 s | shields from wave 1, runners from wave 2 | indoor preset (warm, no glare on the pale stone), blue sky, ground x #dfe2d2 |
| 3 | Twin Towers | 6 / 128 | 1.08 | 26 / 22 s | 152 s | a sixth full siege wave | sunset, deeper dusk sky |
| 4 | Night Siege | 7 / 151 | 1.10 | 25.5 / 21.5 s | 174.5 s | seven waves, an extra ladder crew in wave 6 | night, dark sky, moonlit ground x #9aa4bb, two warm torch lights over the gate lanterns |
| 5 | Royal Defense | 8 / 162 | 1.14 | 25 / 21.5 s | 196.5 s | eight waves, every kind from wave 2, ladders from wave 4 | sunset, purple-crimson sky |

Plan adaptation (GAME 24): the plan's 3/4/5/6/8 waves of stationary-then-moving targets become 5/5/6/7/8 waves of the built moving-goblin siege, because level 1 must stay today's five waves. "Longer distance / moving / faster targets" map to the speed factor and the earlier shields and runners; "strict attempt limit" stays the unchanged reload, flight and four-offer upgrade budget (no new mechanic, no new asset, no target made smaller). Difficulty is monotone by construction (goblins, waves and speed rise; gaps and clear times never grow: levels.test.ts) and measured: the human-paced bot wins 100 / 98 / 98 / 98.5 / 96.5 % of 200 seeds on levels 1-5 (rules.levels.test.ts asserts >= 90 %), and its mean gate HP at a win falls 101 / 87 / 80 / 73 / 78 (level 5's extra two waves are lighter, so its losses are the late waves). Timing is identical on touch and keyboard on every level (reload, flight, rock cooldown and the 2 s climb; touch keeps only the 0.7 m aim snap): levels.test.ts runs the fairness check per level.

Each wave keeps the old invariants: at most 40 bodies (goblin and marker pools), crews in triples and at most 3 (one ladder per lane), the slowest goblin (spawned at 8 s, 8.8 m at 0.7 x speed, plus the 2 s climb) resolved before the clear, and wave 1 unable to break the gate. The rules safety end is the last clear + 3.9 s (level 1: 139.9 s as before).

## Server limits and why they hold

All score sources: one award per unique goblin id, at most 20 x 3 = 60 points (x3 = the top combo); one 200-point clear per wave; one victory bonus 2 x gate HP, at most 250 after the single repair. Shots, upgrades, escapes and time give no points. A Double volley advances combo once and pays each victim once; neither input spam nor frame rate creates ids, clears or repairs.

Proof per level, with N_j goblins in wave j, start gap p and clear time c: allow ALL of wave j's kills at x3 at its start, K_j = 60 (N_0 + ... + N_j) + 200 j at t = j p, and its clear C_j = K_j + 200 (+ 250 on the last wave) at t = j p + c. B(t) is a step function that only rises at these points, so B(t) <= base + pps t everywhere once it holds at every step (the envelope rises in between). base = 60 N_0 (wave 1's kills at t = 0); pps = the steepest step slope (K_j - base) / (j p) or (C_j - base) / (j p + c), plus 3 %, rounded up (level 1 keeps its original 56); maxScore = the exact ceiling 60 N + 200 waves + 250, not a measured maximum. minDurationMs: wave 1 deals at most 40-56 damage, so a run can end only after a wave-2 goblin arrives, at the earliest p + 8 m / (fastest wave-2 type x speed), rounded down. maxDurationMs: the safety end plus one 50 ms frame, rounded up. levels.test.ts checks every step, the formulas and the window per level; rules.levels.test.ts runs the bots.

| Level | maxScore = 60 N + 200 W + 250 | base | steepest slope | pps | earliest end | minDurationMs | safety end | maxDurationMs |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 98, 5: 7130 | 480 | 55.36 | 56 | 28 + 8/0.7 = 39.43 s | 39000 | 139.9 s | 140000 |
| 2 | 102, 5: 7370 | 600 | 58.52 | 61 | 27 + 8/(1.2 x 1.05) = 33.35 s | 33000 | 134.9 s | 135000 |
| 3 | 128, 6: 9130 | 480 | 63.08 | 65 | 26 + 8/(0.7 x 1.08) = 36.58 s | 36000 | 155.9 s | 156000 |
| 4 | 151, 7: 10710 | 480 | 63.92 | 66 | 25.5 + 8/(0.7 x 1.1) = 35.89 s | 35000 | 178.4 s | 178500 |
| 5 | 162, 8: 11570 | 480 | 60.80 | 63 | 25 + 8/(1.2 x 1.14) = 30.85 s | 30000 | 200.4 s | 200500 |

Level 5's maxScore is 1.62 x level 1's (decision 3 guard: <= ~3 x). The limits are in `rules.ts` `PROPOSED_LEVEL_LIMITS` (level 1 = `PROPOSED_LIMITS` = `meta.scoring`), in `meta.ts` `levels` and in `arcade-games.json` `levels` (registry.sync.test.ts).

Bots (rules.levels.test.ts: the rules.test.ts profiles plus input spam): per level a 200-seed human sweep and 30 oracle, 30 random, 6 spam and 6 idle seeds at 30/60/144 Hz on the pure rules loop (the same bot and frame lengths; the store tick is ~80 % of a run's cost), checking every raw prefix against base + pps t, no safety end and `withinServerLimits`; plus 12 runs per level (oracle, human, spam, idle at 30/60/144 Hz) through `createArcadeStore()` checking the final store score and `capScore`. Level 1 also keeps its 480-run real-store matrix in rules.test.ts.

| Level | human wins / 200 | human mean | oracle best (of maxScore) | random / spam / idle wins |
|---|---:|---:|---:|---|
| 1 | 200 | 6386 | 6840 (95.9 %) | 0 / 0 / 0 |
| 2 | 196 | 6318 | 7220 (98.0 %) | 0 / 0 / 0 |
| 3 | 196 | 7950 | 8840 (96.8 %) | 0 / 0 / 0 |
| 4 | 197 | 9424 | 10420 (97.3 %) | 0 / 0 / 0 |
| 5 | 193 | 10263 | 11280 (97.5 %) | 0 / 0 / 0 |

Mutation probes (each broke a test, then restored): ignore the level speed; win after wave 5 hard-coded; a touch-only shorter reload; uncapped upgrade offers; a fixed 139.9 s safety end; L3 maxScore loosened; L4 pps below the slope; L5 minDuration above the earliest end; meta L4 limit different from the proposal; level 1 speed changed; L4 slower than L3; L5 clear before its slowest crew; L5 at speed 1.3 (human wins 117 / 200 < 180); L2 pps below the bots' scores.

The original implementation notes below describe level 1 (the five-wave numbers); the level table above gives levels 2-5.

## Concept and controls

Defend the gate through five finite waves with splash cannon shots, ladder rocks and upgrades. Sunset lighting; the palette (warm grass, sandstone, deep blue and gold) is in "Camera, HUD and visuals".
- meta: scheme tap-target; touchControls tap/action; action label Rock. `controls.keyboard` exactly "Click the field to fire; arrows / WASD aim, Space fires; E / Enter drops a rock; 1 / 2 chooses an upgrade"; `controls.touch` exactly "Tap the field to fire, tap Rock to clear a ladder, tap an upgrade card to choose". Instructions and HUD: "Hit shields from behind". Start-card instructions: `KEYBOARD_INSTRUCTIONS`, or `TOUCH_INSTRUCTIONS` on a coarse pointer (index.tsx getter).
- Fire reads tapDown only, Space jumpPressed, Rock actionPressed; one request/frame, field wins simultaneous Space. Ignore pressed aim nudges on coarse pointers: swipes must not both fire and nudge. Pointer motion does not fire; held fire does not repeat. Shell owns pause/hidden-tab/Retry/Exit.
- createAxisAim + stepAimKeys: x[-5,5], axis y[-2,6] maps z=-y, step0.5, rate6, holdDelay0.25, dragGain0. Initial axis(0,2) means world reticle(0,0.04,-2), mid-field, not wall.
- Fine tap sets exact aim. Coarse snap within0.7 m to nearest living ground goblin predicted at impact, ties lower id; shield snap is0.65 m BEHIND predicted centre along path tangent, still within splash. Recompute flight prediction twice, clamp field; no automatic shots or ladder targeting.
- bufferFire stores one fixed impact point during reload; later presses replace it. Offer cards stop propagation, latch one choice; no stale input crosses phases. During offers combat inputs are ignored. DOM clicks or digit1/2 choose.

## Pure rules

One useRunFrame consumes played dt analytically, splitting exact spawn/launch/arrival/climb/impact/award/next-start/safety boundaries; no dropped remainder.
- Field x[-5,5], z[-6,2]; wall z2.5, cannon base(0,1.2,3), gate(0,0,2.5), towers(+/-6.5,0,3). createPath lanes x=-3,0,3 run z-6.8 to2, length8.8: core pointAt/advance clamp s to [0,length], so the leader starts at s0.8 (z-6) and rear members at s0 (z-6.8); leader travel stays8 m. Road/river/forest cosmetic.
- Gate100 HP, integral clamp[0,maxHP]; repair raises max to125. Arrival damage walker5/shield8/runner5; crew survivor at climb top5. Each damages once and escapes without kill points. Side lanes visibly thump wall stone at x+/-3, centre lane thumps gate; all debit gate HP.
- Walker HP1/speed0.7; shield HP2/speed0.7; runner HP1/speed1.2; crew HP1/speed0.7. Rules circle r0.3; corpses never block. Splash centre distance<=radius. Shield damage0.5 when dot(impact-centre,tangent)>=0 (coincident front), otherwise1; other types1. Fractional HP retained.

| wave | walkers | shields | runners | crew members | total | crews |
|---|---|---|---|---|---|---|
|1|8|0|0|0|8|0|
|2|10|4|0|0|14|0|
|3|10|4|6|0|20|0|
|4|10|4|6|6|26|2|
|5|12|6|6|6|30|2|

- Exactly98 single-use ids; starts0,28,56,84,112. Packs<=3, crews indivisible triples; seeded-shuffle ordinary types then packs. Pack j spawns8*j/(packCount-1), lone pack0; cyclic lane(j+seedOffset)%3. Crew lane first unused cyclic lane in pack order. Seed affects order, not counts/timing/speeds. Pool40; no carry-over.
- Non-overlapping triangle: fastest member leads at lateral0/s0.8 (ties id), side bodies lateral+/-0.65 and0.8 m behind. Rules centres and drawn centres match, including rear offset at spawn; side arrivals delayed0.8/speed. Side gap1.3>body width1.184; rear gap0.8>depth0.637819 and cannot shrink within a pack. Base radius1.2 rewards aiming near the pack centre; a rear-shield aim need not cover the whole triangle, and mixed-speed members can separate beyond one splash. No rule collision response.
- Crew ladder drawn 1.8 wide x 2.8 tall with thick rails (`LADDER`, visual only); erection when last surviving member arrives. Climbers move onto the ladder at lane x -0.6 / 0 / +0.6 (`CLIMB_OFFSETS`, three distinct spots, cosmetic: rocks hit the whole crew, cannon cannot) and are drawn at scale 1.25. Simultaneous2 s climb y0 to2, climb progress shown per ladder; cannon immunity begins individually at arrival; surviving members independently damage/escape at top. Empty crew never erects. Threatened ladder greatest climb fraction, then smallest crew id.
- Cannon reload1.1, ready at0; gravity9.81, wind0, target y0. T=0.6+0.4*clamp(horizontal muzzle-target distance/10,0,1), range[0.6,1]. launchForTime from transformed measured muzzle; landingPoint/trajectoryPoints give analytic flight, exact impactT. Radius1.2/damage1, no falloff/friendly fire/shot score. Queue launches immediately at reload end.
- Double emits two same-point/same-time balls, one reload and one combo step; corpses paid once. Reload upgrades bottom at0.79475; flight<=1 gives<=4 balls plus1 rock. Projectile pool8.
- Rock initially ready; accepted drop starts8 s cooldown. No erected ladder: buffer one press up to1 s, target next nonempty crew by predicted erection then id; accept at erection only before expiry, otherwise expire without consumption. No cooldown bypass.
- Rock snapshots crew id, falls y3 to0 with zero velocity/gravity9.81, flight sqrt(6/9.81)=0.7820619. Impact kills remaining climbers on that ladder (20 * current combo multiplier each) and destroys it; no transfer. Two-second climb leaves1.2179381 s after erection to press; later impacts cannot rescue.
- Offer opens as soon as all wave ids resolve for waves1-4 (usually20-21 s); keep +200 clear at24 s (24 s minimum wave), paid even with escapes, and fixed next start. Choose once, apply once; default left at next start. Clock continues. Slowest crew resolution8+8.8/0.7+2=22.571429<24. No wave5 offer. Surviving win136 s.
- Upgrade pool: reload x0.85 max2 (1.1/0.935/0.79475); splash x1.25 max2 (1.2/1.5/1.875); repair once +25 current/maxHP (max125); double once. Two distinct seeded eligible types sorted reload/splash/repair/double. Six capacities ensure two eligible cards at all four offers. No upgrade score.
- Omit durationMs: shell chip shows played time; game HUD "Wave N/M" (M = the level's waves). Pure rules safety end("timeup") at139.9 s (elapsedMs stays under maxDurationMs140000); test never fires on a surviving run. Event order: spawn, launch, movement/arrival/climb damage, impacts by id, kills, offers/clear/win, then safety. Damage beats same-time rescue; HP0 loses before awards. Freeze pause/over.
- Historical pre-P-16 playtests found random/naive play too strong. Those results are superseded by the measured matrix in Fix round 2 below.

## Score, limits and end

S = sum(round(20 * multiplier_at_kill)) + 200 * cleared + (won ? 2 * gateHP : 0).
A cannon shot that kills at least one goblin advances combo once BEFORE all its kill awards. Combo 0-1 / 2 / 3 / 4 / >=5 gives x1 / x1.5 / x2 / x2.5 / x3. A hit without a kill (including a nonlethal shield hit) preserves combo. An impact hitting no ground goblin, or any goblin damaging the gate at arrival/ladder top, resets it. The two simultaneous balls of Double are one shot/volley, so a corpse-only second ball cannot erase the combo. Rock kills use the current multiplier without changing combo. Offers and wave changes preserve combo.

Awards remain incremental through victory; the final HP bonus is added to the accumulated score. Loss/timeup retain earned points without the bonus. No direct shot, escape, time or upgrade points.

Level 1 PROPOSED_LIMITS and meta.scoring are 7130 / 39000–140000 / base480 / pps56. The five-level proposals are PROPOSED_LEVEL_LIMITS; Claude copies the levels into arcade-games.json at merge. The backend is outside this task.

- Proven universal upper bound B = 98 unique ids * 20 * max multiplier3 + 5 clears * 200 + 2 * max HP125 = 7130. Warm-up/misses can only reduce this bound. A measured oracle maximum plus4% is not a proof that better legal play is impossible, so choose the proven7130 ceiling.
- Permit every wave's kills instantly at its start, all at x3. Kill-prefix maxima including prior clears: 480,1520,2920,4680,6680 at t=0,28,56,84,112. Envelope480+56t: 480,2048,3616,5184,6752.
- At clear times24,52,80,108,136, score bounds before final HP bonus: 680,1720,3120,4880,6880. Envelope: 1824,3392,4960,6528,8096. Final bound7130 also fits8096. The bound is constant between these events while the envelope increases; flight and gradual spawning only delay points. Every real-store frame checks the raw prefix; final withinServerLimits passes and capScore is a no-op.
- Counts/speeds are unchanged: latest possible resolution8+8.8/0.7+2=22.571429<clearAt24, so each wave is resolved before the next. Survivors win at136 s, before139.9 safety.
- Wave1 total possible damage40 cannot destroy100 HP. Earliest wave2 arrival28+8/0.7=39.428571 s; min39000 ms safely rounds down. Even safety139.9 s plus the core's maximum0.05 s played frame stays below max140000 ms. The clock excludes countdown/pause/results.
- Lose atHP0; fifth clear136 adds HP bonus and wins. resultDelayMs1600 remains unchanged. Shell owns result/persistence/API.

## Camera, HUD and visuals

- Fixed behind-wall pitch60, yaw0, fov35 matched in useFittedView/CameraRig, shift true, padding8 CSS px, margin0.02. Fit x[-5.6,5.6], z[-7.3,3.5], y[0,2.3], focus(0,0,-1.5). Order: trim decorative y3.4 hull (climbers need2.08), reduce fov45 to35, then guarantee24 CSS px markers/reticle outline if measured geometry falls short. Decorative roofs/crowns may crop.
- Real perspective: F=H/(2*tan(fov/2)); v=F*(0.5*y-sin60*(z+1.5))/(d-sin60*y-0.5*(z+1.5)). Shift adds constant. Project all body AABB corners and reticle endpoints; never use flat px/m alone. Old landscape mid19.3 proxy ignored far scale~0.86, estimating22 px goblins/21.6 px reticle; exact reticle example d24.39/fov45 is21.04 at spawn.
- Examples below use landscapeH390 (d30.34 banner closed, d36 banner open) and portraitH844/d45, fov35. They are projections, NOT measured fitView output. Body height1.6/depth0.637819/width1.184. Reticle diameter1.5 at y0.04. Actual safe rectangles can increase d: measure and enlarge/add24 px markers until acceptance. Banner open in landscape leaves ~184 px for the 218 px hull, so d grows to ~36 (banner closed ~234 px free: d30.34). Every goblin slot has a TargetMarker slot (capacity40); spawn goblins z<-4.5 ALWAYS show one, any body under24 px elsewhere too. The reticle outline has a minimum screen size >=24 CSS px at any distance.

| viewport / banner | d | location z | body px | reticle depth px | ladder px (tall x wide) | with marker/outline |
|---|---|---|---|---|---|---|
|390x844 open|45|far -6|41.71|35.06|-|>=24|
|390x844 open|45|near 2|40.46|41.85|28.4x38.0|>=24|
|844x390 closed|30.34|far -6|29.02|22.97|-|24|
|844x390 closed|30.34|boundary -4.5|28.90|24.06|-|>=24|
|844x390 closed|30.34|near 2|27.76|29.85|18.9x26.8|>=24|
|844x390 open|36|far -6|24.28|19.78|-|24 (marker, outline)|
|844x390 open|36|near 2|23.39|24.68|16.2x22.3|24 (marker, ladder icon)|

- Only the persistent HUD (health, wave, reload, combo/loss notice, shield hint) uses data-arcade-safe-area. The transient upgrade cards and "Wave N" banner overlay UNMARKED (combat idle, all ids resolved while they show), so the camera never refits per wave. Core fits shell chips, Rock, banner/home rectangles; no game-side free-rectangle substitute. Health/wave/reload>=14 px; "Hit shields from behind" visible; short "Wave N" banner at each start.
- Upgrade cards: `layout.ts` `placeCards(area)` (pure, `layout.test.ts` over 1280x800, 390x844, 360x740, 844x390, banner open/closed) puts two 144x88 cards (176x72 on a short landscape canvas) side by side at the lowest spot nearest the centre that clears every shell chip, the HUD panel, the Rock button and the banner by 10 px; else the other row size, else the cards stacked. Cards stay >= 72 px tall.
- Full-card buttons: icon, title, numeric effect, visible "1"/"2" key hint, focus outline. Opaque #0f172a with #f8fafc (>17:1), secondary #cbd5e1 (>12:1); selected #1d4ed8 with white (>6:1). All text>=4.5:1; targets>=44 px, Rock72 px.
- Wall visual 1.2 high except towers and the gate arch; field-side ladders z 2 remain visible; threatened crew steady outlined 24 px "!" icon drawn 24 px above the top of its ladder and highest climber, never on them. Landing ring previews splash radius and reload readiness; Rock shows its numeric cooldown; a rear-hit ring flashes once on a rear-shield hit to teach it. Goblin hop 0.06 at 2 Hz, plus a slight squash on each footfall. Walker tint green, shield-bearer with a wooden round shield, runner with an orange pennant, crew violet. A drop in hp flashes that goblin white for 0.1 s (the run has no hit timestamp). Death flail spin 0.35 s cosmetic; ladder destruction splinters; dust rings, wave banners. No resurrection.
- Ground 0 (the meadow), road about 0.02, river 0.035, reticle 0.04, dust 0.06, ladder 0.08..2.08, score subject +0.3; translucent depthWrite false with render order. Sunset hemisphere and a warm directional light; blob shadows under the goblins. No extra lights, no shadow maps, no post-processing, no Rapier.
- Fix round 2 (2026-10-24): modern look. A peach horizon under a deep-blue sky, fog starting past z -8 so the meadow stays crisp. Low-poly hills beyond x ±7 and z < -8, a cobbled strip on each lane, a river on the far left. The wall is coursed stone (a brick texture) with a darker base, a set-back cap, merlons and an arched gate; its front stays at z 2.5. Towers keep (±6.5, 0, 3) and gain stone rings and a flag (the balcony was dropped after the playtest: its planks read as loose spikes around the tower GLB); if the tower GLB is missing, the fallback is a shaft plus a pointed roof. Banners and flags are cloth that waves, unless reduced motion is on; a win still raises the wall banners. The cannon recoils and puffs smoke when `run.launches` ticks. Pines (two greens), round trees, rocks, flowers and tufts are instanced outside the fitted field. Birds and clouds drift far beyond z -8 and hold still when reduced motion is on.

## Helpers and assets

Confirmed existing helpers: launchForTime/landingPoint/trajectoryPoints; createPath/advance/pointAt/tangentAt; hop/squashStretch; DynamicInstancedModel tinted update/Model/InstancedModel; createAxisAim/stepAimKeys/createBufferedFire/bufferFire; substep/rngNext; useRunFrame/useInput/useGameTime/useArcadeStore; useFittedView/CameraRig/useSafeArea/fitView; useFx/playSfx/startLoop; TargetMarkers/useQuality/scaledCount/BlobShadow/useCanvasTexture; expansionPoint; withinServerLimits/capScore; test createArcadeStore/simulateRun/fixedFrames/randomFrames. Cards are game DOM, no invented core helper.
- Existing goblin GLB is solid arms-down, not humanoid; EXPANSION_CHARACTERS excludes it. Use DynamicInstancedModel + motion, no rig. assets.spec.json owned goblin mode image (catalog image-to-3D); no generation/credits.
- Goblin A EXPANSION_ASSETS.goblin,1.6 tall/r0.3,<=4500 tris/512 texture,40 slots, primitive body/ears fallback. Size1.4028x1.8957x0.7557; fitted width1.184/depth0.637819.
- Shared tower6 tall x2 (size1.3862x1.91x1.4204); cannon1.6 long/rotationY pi (1.3736x1.4473x1.8975); rock1 wide (1.9011x0.8989x1.857); tree3.5 tall x4 (1.804x1.9133x1.247). Uniform scale from requested axis; decorative only. Primitive fallbacks preserve fitted silhouettes.
- Door D REUSED_ASSETS.door,3 tall; fit from core REUSED_GLB_SIZE.door (1.1909x1.8929x0.268 GLB units, added at merge, checked against the GLB in core/expansionAssets.test.ts), NO runtime bounding-box adapter.
- Cannon muzzle EXPANSION_GLB_POINTS.cannonMuzzle=(0,1.036,0.9488), transform scale/rotation/translation identically in rules/render/fallback. Tower platform(0,1.374,0) fits4.31623 at6 tall; cannon sits on procedural wall platform.
- Procedural wall/field/road/river/banners/ladders/shields/balls/reticle; shield0.55, ball0.25, banner0.6x0.9. Shared assets need no generation; owned recipe only in assets.spec.json.

## Implementation and tests

The 480-run real-store matrix (`testing/matrixBot.ts`, one `matrix.<profile>.test.ts` per profile) uses 40 seeds0-39 for each of random/human/oracle/idle at30/60/144 Hz: 480 real-store runs. Each cell mixes20 fine-pointer and20 coarse-pointer runs. Random: uniform10x8 field tap every0.3 s, random card and a random Rock press on half the taps; offer time does not create a tap backlog. Human: reaction>=0.35 s to newly spawned enemies and ladders, decisions0.35 s apart, shots>=1.2 s apart, radial seeded aim error<=0.6 m, imminent-damage priority, original lowest-card/no-double route. Oracle: exact prediction, pending-projectile damage awareness, legal reload/flight, 0.05 s decisions, Double/splash/reload/repair preference. Idle never acts. These profiles measure fine/coarse field taps; keyboard browser feasibility remains a Claude check.

Assertions: random mean<=40% of7130 and wins<=40%; human wins>=80%; oracle best>=90% and mean>=85%; idle loses. Raw prefixes, integer HP, uncapped final server acceptance, no safety ends, combo stat publication and136 s wins are checked. Literal generator checks cover1000 seeds. Regression fixtures cover shield fractions, splash/snap edges, combo awards/reset/rock/Double, reload buffers, ladders, damage-before-rescue, caps, offers, final-score preservation, pause/over freezing and equivalent large-dt/60Hz wave boundaries.

For runtime, the analytic integrator already splits every simulation event exactly; remove redundant120Hz substeps and scan the current wave's precomputed references for movement/events. Bots mirror Scene by publishing only changed score/stats. No per-frame arrays were added.

Per P-16, Vitest and npm run build are reserved for Claude. Local verification uses a standalone Node TypeScript transpiler and node:assert adapter to call these same test callbacks against the real store; it is not a Vitest run. Browser, full build/suite, safe-area screenshots and performance gates remain with Claude.

## Performance, audio and accessibility

Target<=50 draws, acceptance<=60/platform150; approximate37 plus13 mesh splits. Stress40 bodies<=180k goblin tris, total<=230k; mid-phone p95<=33 ms measured. No shadow maps/bloom.
Pools40 live/40 cosmetic death/8 projectile/4 crew/40 marker slots (one per goblin slot). Shared cached geometry/material/math/RNG/audio, no per-frame arrays/strings/React updates. Hide corpses to keep<=40 drawn. fx.warm puff/debris/confetti/score; max2 score labels, impact16 particles. Quality reduces decoration only. Dispose owned resources; Retry x10 verification.
Audio boom0.35, thud0.25, pack hup pop pitch1.5/0.08, ladder hit, upgrade chime, wave go pitch0.6; shell end cues. Pan clamp(sin(bearing-yaw)). Optional ambient0.08 stops on pause/mute/cleanup, recreate only playing/unmuted; never reuse stopped handle.
24 px readability,72 px Rock,>=44 px cards, complete keyboard. Types distinguished by shapes. Reduced motion removes hop/flail/shake/flashes/confetti, retains paths/projectiles/steady warnings; no>3 Hz flashes; audio optional.

## Decisions (user, 2026-10-09)

Approved: 1.6 m visual goblins (rules radius unchanged); a fixed 136 s surviving win with 5 finite waves (24 s minimum wave); one additive +25 HP repair; capped upgrade stacks; limits 3210 / 39000-140000 ms / base 160 / 25 pts/s. These OLD limits are superseded-pending-approval by P-16's proposed7130 / 39000-140000 / 480 / 56; Claude updates meta and server JSON together after approval.

## Open questions

Levels (2026-10-24, Claude took over P-30 from Codex): the five levels' limits are in meta.ts `levels` and arcade-games.json `levels` (castle stays `enabled: false`). Playtested headless (flagged build, all five levels); fixes: level 2 no longer washes out (indoor preset + ground tint instead of day), level 4 reads as night (dark sky, moonlit ground, warm torchlight at the gate; goblins stay readable). Open: the user's go-ahead on the level content and limits.

## Merge review (Claude, 2026-10-09)

- Landscape rows relabelled banner-closed (d30.34); banner-open row at d36; marker capacity40; reticle outline >=24 px minimum; ladder px column restored.
- Only the persistent HUD is a safe area; cards and the wave banner overlay unmarked.
- Lanes z-6.8 to2 (8.8 m) with the leader at s0.8 (core clamps s); safety end139.9 s; climbers on the ladder rails.
- Restored from 6a54521: landing ring, Rock cooldown number, climb progress, rear-hit ring, +200 even with escapes (rule + test), exact control strings, thumbs input file, 24 s minimum wave departure.
- Core REUSED_GLB_SIZE.door added; meta.ts and arcade-games.json carry the limits.

## Fix round 2 (2026-10-24): difficulty + combo

| Number | Old | New |
|---|---:|---:|
| Base splash radius | 2 m | 1.2 m |
| Splash upgrade factor (max 2 stacks) | 1.3 | 1.25 |
| One/two-stack splash | 2.6 / 3.38 m | 1.5 / 1.875 m |
| Base reload | 0.8 s | 1.1 s |
| Reload upgrade factor (max 2 stacks) | 0.8 | 0.85 |
| One/two-stack reload | 0.64 / 0.512 s | 0.935 / 0.79475 s |
| Coarse prediction snap | 1.5 m | 0.7 m |
| Kill award | 20 | round(20 * multiplier), 20 / 30 / 40 / 50 / 60 |
| Combo multiplier by count 0-1 / 2 / 3 / 4 / >=5 | always 1 | 1 / 1.5 / 2 / 2.5 / 3 |
| Combo-loss HUD duration | absent | 1.2 s of played time |
| Proposed maxScore | 3210 | 7130 |
| Proposed base | 160 | 480 |
| Proposed maxPointsPerSec | 25 | 56 |
| Rules substep ceiling | 1/120 s | no fixed substeps; analytic event boundaries |

Counts98, all speeds/HP/damage, five waves, starts0/28/56/84/112, clearAt24, repair25/max125, shield rear aim0.65, and min/max durations39000/140000 ms are unchanged. Combo starts at0, advances per killing volley, resets on an empty impact or damage, persists between waves, and is published as stat "combo". Hud shows "Combo xN" only above x1 and a1.2 s "Combo lost" notice inside the existing safe-area panel, at14 px. Scene changes only publish combo and its loss notice; optional pitch changes were unnecessary.

Measured on2026-10-24 using the standalone Node adapter, the exact rules.test.ts callbacks and real createArcadeStore/simulateRun. Full run:51 checks,0 failures,49.313 s, including480 bot runs. This is local Node evidence; Claude still runs Vitest/build.

| Bot | Hz | Wins | Mean score | Min | Max | Runtime |
|---|---:|---:|---:|---:|---:|---:|
| random | 30 | 0/40 (0%) | 784.00 | 260 | 1520 | 1.174 s |
| human | 30 | 40/40 (100%) | 6362.85 | 5436 | 6970 | 2.172 s |
| oracle | 30 | 40/40 (100%) | 6811.25 | 6540 | 6840 | 2.370 s |
| idle | 30 | 0/40 (0%) | 230.00 | 200 | 400 | 0.778 s |
| random | 60 | 0/40 (0%) | 784.00 | 260 | 1520 | 2.144 s |
| human | 60 | 40/40 (100%) | 6302.45 | 5386 | 6940 | 4.761 s |
| oracle | 60 | 40/40 (100%) | 6811.50 | 6540 | 6840 | 4.389 s |
| idle | 60 | 0/40 (0%) | 230.00 | 200 | 400 | 1.502 s |
| random | 144 | 0/40 (0%) | 784.75 | 260 | 1520 | 4.560 s |
| human | 144 | 40/40 (100%) | 6339.80 | 4910 | 6990 | 9.166 s |
| oracle | 144 | 40/40 (100%) | 6810.00 | 6480 | 6840 | 11.482 s |
| idle | 144 | 0/40 (0%) | 230.00 | 200 | 400 | 3.966 s |

Random mean is10.996-11.006% of the7130 ceiling and loses100% of seeds. Human wins100% at each rate. Oracle mean is95.512-95.533%, best95.933%; idle loses100%. Per-cell runtime includes simulation, store and assertions. The entire rules run includes generator fixtures and two deterministic replays.

Direct TypeScript: node node_modules/typescript/bin/tsc --noEmit --incremental false. Build/Vitest and browser verification remain pending Claude. Handoff with reproduction instructions: .handoff/P-16-castle-difficulty/HANDOFF.md.

## Go-live batch (Claude, 2026-10-24)

- **Phone landscape goblin size.** With the banner open the one-row HUD panel (top 55, to x ~594) took the band above the field, so the fit pulled the camera back (distance ~32) and goblins drew at ~20 CSS px. In landscape (`max-height: 520px`, `orientation: landscape`) the panel is now a narrow left column (`Hud.module.css`, ≤ 180 px wide); the field band is free and the fit distance drops to ~23, the same as with the banner closed; the farthest goblins measured 24-29 CSS px in the headless playtest (`fit.test.ts` pins >= 24 px at the lane start). No rules, limits or level change; desktop and portrait keep the row.
- **Test time.** The 480 real-store runs moved out of `rules.test.ts` into four `matrix.<profile>.test.ts` files (helper `testing/matrixBot.ts`) and the level bots into `rules.levels.test.ts` (L1–L3) + `rules.levels-late.test.ts` (L4–L5) (helper `testing/levelBots.ts`), so vitest runs them in parallel; the 1000-seed army check collects its per-goblin checks and asserts once (same checks, ~14 s → ~2 s). Same seeds, profiles and assertions.

