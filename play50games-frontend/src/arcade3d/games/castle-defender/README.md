# Castle Defender

Owner: Codex. Slug: castle-defender. G0 design revision only. Spec: 04 §14. Metres/seconds; x east, z toward wall, y up. Pure rules own tuning; no Rapier.

## Concept and controls

Defend the gate through five finite waves with splash cannon shots, ladder rocks and upgrades. Day lighting; grass #65a30d, stone #a8a29e, banners #3b82f6, accent #94a3b8.
- meta: scheme tap-target; touchControls tap/action; action label Rock. Desktop click fires, arrows/WASD aim, Space fires, E/Enter rocks, 1/2 chooses. Touch taps fire, Rock rescues, cards choose. Instructions and HUD: "Hit shields from behind".
- Fire reads tapDown only, Space jumpPressed, Rock actionPressed; one request/frame, field wins simultaneous Space. Ignore pressed aim nudges on coarse pointers: swipes must not both fire and nudge. Pointer motion does not fire; held fire does not repeat. Shell owns pause/hidden-tab/Retry/Exit.
- createAxisAim + stepAimKeys: x[-5,5], axis y[-2,6] maps z=-y, step0.5, rate6, holdDelay0.25, dragGain0. Initial axis(0,2) means world reticle(0,0.04,-2), mid-field, not wall.
- Fine tap sets exact aim. Coarse snap within1.5 m to nearest living ground goblin predicted at impact, ties lower id; shield snap is0.65 m BEHIND predicted centre along path tangent, still within splash. Recompute flight prediction twice, clamp field; no automatic shots or ladder targeting.
- bufferFire stores one fixed impact point during reload; later presses replace it. Offer cards stop propagation, latch one choice; no stale input crosses phases. During offers combat inputs are ignored. DOM clicks or digit1/2 choose.

## Pure rules

One useRunFrame consumes played dt via substep<=1/120 s, splitting exact spawn/launch/arrival/climb/impact/award/next-start/safety boundaries; no dropped remainder.
- Field x[-5,5], z[-6,2]; wall z2.5, cannon base(0,1.2,3), gate(0,0,2.5), towers(+/-6.5,0,3). createPath lanes x=-3,0,3 run z-6 to2, length8. Road/river/forest cosmetic.
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
- Non-overlapping triangle: fastest member leads at lateral0/progress0 (ties id), side bodies lateral+/-0.65 and0.8 m behind. Rules centres and drawn centres match, including rear offset at spawn; side arrivals delayed0.8/speed. Side gap1.3>body width1.184; rear gap0.8>depth0.637819 and cannot shrink within a pack. Base radius2 covers the initial triangle including shield rear aim; mixed-speed members may later separate beyond one splash. No rule collision response.
- Crew ladder1.2 wide; erection when last surviving member arrives. Simultaneous2 s climb y0 to2, cannon immunity begins individually at arrival; surviving members independently damage/escape at top. Empty crew never erects. Threatened ladder greatest climb fraction, then smallest crew id.
- Cannon reload0.8, ready at0; gravity9.81, wind0, target y0. T=0.6+0.4*clamp(horizontal muzzle-target distance/10,0,1), range[0.6,1]. launchForTime from transformed measured muzzle; landingPoint/trajectoryPoints give analytic flight, exact impactT. Radius2/damage1, no falloff/friendly fire/shot score. Queue launches immediately at reload end.
- Double emits two same-point/same-time balls, id order, one reload; corpses paid once. Reload upgrades bottom at0.512; flight<=1 gives<=4 balls plus1 rock. Projectile pool8.
- Rock initially ready; accepted drop starts8 s cooldown. No erected ladder: buffer one press up to1 s, target next nonempty crew by predicted erection then id; accept at erection only before expiry, otherwise expire without consumption. No cooldown bypass.
- Rock snapshots crew id, falls y3 to0 with zero velocity/gravity9.81, flight sqrt(6/9.81)=0.7820619. Impact kills remaining climbers on that ladder (+20 each) and destroys it; no transfer. Two-second climb leaves1.2179381 s after erection to press; later impacts cannot rescue.
- Offer opens as soon as all wave ids resolve for waves1-4 (usually20-21 s); keep +200 clear at24 s and fixed next start. Choose once, apply once; default left at next start. Clock continues. Slowest crew resolution8+8.8/0.7+2=22.571429<24. No wave5 offer. Surviving win136 s.
- Upgrade pool: reload x0.8 max2 (0.8/0.64/0.512); splash x1.3 max2 (2/2.6/3.38); repair once +25 current/maxHP (max125); double once. Two distinct seeded eligible types sorted reload/splash/repair/double. Six capacities ensure two eligible cards at all four offers. No upgrade score.
- Omit durationMs: shell chip shows played time; game HUD "Wave N/5". Pure rules safety end("timeup") at140 s; test never fires on a surviving run. Event order: spawn, launch, movement/arrival/climb damage, impacts by id, kills, offers/clear/win, then safety. Damage beats same-time rescue; HP0 loses before awards. Freeze pause/over.
- Human estimate (unmeasured): cadence1.2 s permits20 launches/24 s; finale roughly10 pack hits +4 shield repeats=14 shots/16.8 s. One timely rock helps; crews may erect<8 s apart, so SECOND crew must be handled by cannon before climbing. Reload/reload/splash/repair no-double route gives0.512/radius2.6/125 HP. Four escaped runners and two shields leave89 HP from full repair. Keyboard full sweep10/6+0.25=1.92 s; testing must establish feasibility.

## Score, limits and end

runScore=20*killed+200*cleared+(won?2*gateHP:0). addScore once per unique kill/clear; win setScore(runScore) then end("win"). No shot/escape/time/upgrade points. Max98*20+5*200+2*125=3210; loss/timeup retain earned score without bonus.
- Limits: maxScore3210, minDurationMs39000, maxDurationMs140000, base160, maxPointsPerSec25. Claude sets meta.ts and arcade-games.json at merge.
- Every wave-prefix bound permitting instant kills is160,640,1240,1960,2760 at starts0,28,56,84,112; envelope160+25t is160,860,1560,2260,2960 and increases between events.
- Clear-prefix maxima360,840,1440,2160,2960 at24,52,80,108,136 are<=760,1460,2160,2860,3560. Final HP bonus<=250 gives3210<=3560. Real flight only delays kills; no capScore-hidden excess.
- Wave1 total damage<=8*5=40 cannot destroy100 HP. Wave2 has no runners: earliest further arrival28+8/0.7=39.428571 s; rear delay only increases it. Therefore min39000 safely rounds down; exact fastest loss approximately45 s. Every surviving run wins136<140 safety; played duration excludes countdown/pause/results.
- Lose atHP0; win fifth clear136 after score/bonus. Safety140 only for broken/incomplete schedule. resultDelayMs1600, frozen score; banners/confetti win, gate tilt/dust lose; shell owns result/persistence/API.

## Camera, HUD and visuals

- Fixed behind-wall pitch60, yaw0, fov35 matched in useFittedView/CameraRig, shift true, padding8 CSS px, margin0.02. Fit x[-5.6,5.6], z[-7.3,3.5], y[0,2.3], focus(0,0,-1.5). Order: trim decorative y3.4 hull (climbers need2.08), reduce fov45 to35, then guarantee24 CSS px markers/reticle outline if measured geometry falls short. Decorative roofs/crowns may crop.
- Real perspective: F=H/(2*tan(fov/2)); v=F*(0.5*y-sin60*(z+1.5))/(d-sin60*y-0.5*(z+1.5)). Shift adds constant. Project all body AABB corners and reticle endpoints; never use flat px/m alone. Old landscape mid19.3 proxy ignored far scale~0.86, estimating22 px goblins/21.6 px reticle; exact reticle example d24.39/fov45 is21.04 at spawn.
- Examples below use landscapeH390/d30.34 and portraitH844/d45, fov35. They are projections, NOT measured fitView output. Body height1.6/depth0.637819/width1.184. Reticle diameter1.5 at y0.04. Actual safe rectangles can increase d: measure and enlarge/add24 px markers until acceptance. Spawn goblins z<-4.5 ALWAYS have24 px TargetMarkers; any smaller body elsewhere also gets one. Distant reticle gets24 px screen outline.

| banner-open viewport | location z | body projected height px | reticle depth px | with marker/outline |
|---|---|---|---|---|
|390x844|far -6|41.71|35.06|>=24|
|390x844|near 2|40.46|41.85|>=24|
|844x390|far -6|29.02|22.97|24|
|844x390|boundary -4.5|28.90|24.06|>=24|
|844x390|near 2|27.76|29.85|>=24|

- Every HUD/card/banner uses data-arcade-safe-area. Core fits shell chips, Rock, banner/home rectangles; no game-side free-rectangle substitute. Health/wave/reload>=14 px; "Hit shields from behind" visible; short "Wave N" banner at each start.
- Banner open portrait: two144x88 CSS px cards side by side,8 gap, bottom free strip ABOVE banner/control reserve. Landscape: two176x72 cards,8 gap, centred strip ABOVE bottom banner and LEFT of right72 px Rock reserve. Position from measured safe rectangles BELOW shell chips; move strip vertically if required. Must clear all shell chips/Rock in both orientations.
- Full-card buttons: icon, title, numeric effect, visible "1"/"2" key hint, focus outline. Opaque #0f172a with #f8fafc (>17:1), secondary #cbd5e1 (>12:1); selected #1d4ed8 with white (>6:1). All text>=4.5:1; targets>=44 px, Rock72 px.
- Wall visual1.2 high except towers; field-side ladders z2 remain visible; threatened crew steady outlined24 px icon. Goblin hop0.06 at2 Hz; shield shape/runner pennant distinguish types. Death flail spin0.35 s cosmetic; ladder destruction splinters; dust rings, wave banners. No resurrection.
- Ground0, road/river0.015, reticle0.04, dust0.06, ladder0.08..2.08, score subject+0.3; translucent depthWrite false with render order. Background #dbeafe/day hemisphere+directional preset, blob shadows; no extra lights/Rapier.

## Helpers and assets

Confirmed existing helpers: launchForTime/landingPoint/trajectoryPoints; createPath/advance/pointAt/tangentAt; hop/squashStretch; DynamicInstancedModel tinted update/Model/InstancedModel; createAxisAim/stepAimKeys/createBufferedFire/bufferFire; substep/rngNext; useRunFrame/useInput/useGameTime/useArcadeStore; useFittedView/CameraRig/useSafeArea/fitView; useFx/playSfx/startLoop; TargetMarkers/useQuality/scaledCount/BlobShadow/useCanvasTexture; expansionPoint; withinServerLimits/capScore; test createArcadeStore/simulateRun/fixedFrames/randomFrames. Cards are game DOM, no invented core helper.
- Existing goblin GLB is solid arms-down, not humanoid; EXPANSION_CHARACTERS excludes it. Use DynamicInstancedModel + motion, no rig. assets.spec.json owned goblin mode image (catalog image-to-3D); no generation/credits.
- Goblin A EXPANSION_ASSETS.goblin,1.6 tall/r0.3,<=4500 tris/512 texture,40 slots, primitive body/ears fallback. Size1.4028x1.8957x0.7557; fitted width1.184/depth0.637819.
- Shared tower6 tall x2 (size1.3862x1.91x1.4204); cannon1.6 long/rotationY pi (1.3736x1.4473x1.8975); rock1 wide (1.9011x0.8989x1.857); tree3.5 tall x4 (1.804x1.9133x1.247). Uniform scale from requested axis; decorative only. Primitive fallbacks preserve fitted silhouettes.
- Door D REUSED_ASSETS.door,3 tall; reference REUSED_GLB_SIZE.door, NO runtime bounding-box adapter. Claude adds constant before build using measured1.19x1.89x0.27 GLB units: explicit merge dependency, not currently exported.
- Cannon muzzle EXPANSION_GLB_POINTS.cannonMuzzle=(0,1.036,0.9488), transform scale/rotation/translation identically in rules/render/fallback. Tower platform(0,1.374,0) fits4.31623 at6 tall; cannon sits on procedural wall platform.
- Procedural wall/field/road/river/banners/ladders/shields/balls/reticle; shield0.55, ball0.25, banner0.6x0.9. Shared assets need no generation; owned recipe only in assets.spec.json.

## Implementation and tests

Future files: meta.ts/index.tsx/rules.ts/rules.test.ts/assets.ts/assets.test.ts/Scene.tsx/Castle.tsx/Goblins.tsx/Cannon.tsx/Hud.tsx/Hud.module.css/Primitives.tsx plus thumbnail. This task writes no implementation.
- rules.test.ts<=~600 lines, total game tests<60 s. Literal fixtures pin98 ids, starts, speeds/HP/damage, pack body gaps, radius/reload/repair125/score3210/limits160/25/39000/140000. Aggregate tick invariants; mutation checks, not self-derived expected bounds.
- Start64 legal +64 human-paced +32 spam seeds; ONE frame schedule per seed. Distribute legal/human across keyboard/coarse and60 fps/20 fps/random4-50 ms (11/11/11/11/10/10). Scale ONLY from measured runtime; report counts/runtime/extrema/reasons/missed packs/HP.
- Human bot reaction0.35 s, fire interval>=1.2, aim speed6, seeded error<=0.6, prioritize imminent damage, legal rock/card inputs. REQUIRE>=95% seeds win with>=20 HP on no-double route; revise tuning if not reached. Oracle also uses actual aim/inputs/flight, no teleport/immunity. Spam20 fps plus idle losses.
- Test schedules/types/crew lanes/determinism/caps, all resolutions<=22.571429; within-pack drawn body AABBs never intersect at spawn/march/arrival and radius2 covers the initial triangle. Independent packs may overtake without rule collision response. Pause/over immutable; no dt remainder loss.
- Test early offer/all-resolved trigger,24 s award, fixed next start/default/one pick, upgrade capacity/no-double. Test ballistic error<=1e-6 at0.6/1 s, radius inclusive/epsilon outside, shield front/back/coincident/rear snap, double pay-once.
- Test arrival/climb2, rock1 s buffer/expiry/no-consumption/cooldown8/snapshot/0.7820619 fall/1.2179381 rescue window, second crew cannon requirement and same-time fatal damage before rescue.
- Test every score prefix<=160+25t, terminal withinServerLimits and capScore unchanged;136 win/HP bonus, loss,140 safety fixture, surviving runs NEVER reach safety, no post-end award. Keyboard hold/nudge/aim snapshot, one-frame inputs/coarse swipe/ties/lead/boundary, missing assets/anchors.
- Browser1280x800/390x844/844x390 banner on/off: actual silhouettes or markers/reticle>=24 CSS px, ladders readable, HUD/cards clear shell/Rock, contrast, wall occlusion, fallback, keyboard/two-thumb wins, mute/reduced motion, Retry x10 flat resources. Builder runs npm run build and npx vitest run; no runtime evidence claimed here.

## Performance, audio and accessibility

Target<=50 draws, acceptance<=60/platform150; approximate37 plus13 mesh splits. Stress40 bodies<=180k goblin tris, total<=230k; mid-phone p95<=33 ms measured. No shadow maps/bloom.
Pools40 live/40 cosmetic death/8 projectile/4 crew/4 marker slots, extra spawn markers from fixed goblin slots. Shared cached geometry/material/math/RNG/audio, no per-frame arrays/strings/React updates. Hide corpses to keep<=40 drawn. fx.warm puff/debris/confetti/score; max2 score labels, impact16 particles. Quality reduces decoration only. Dispose owned resources; Retry x10 verification.
Audio boom0.35, thud0.25, pack hup pop pitch1.5/0.08, ladder hit, upgrade chime, wave go pitch0.6; shell end cues. Pan clamp(sin(bearing-yaw)). Optional ambient0.08 stops on pause/mute/cleanup, recreate only playing/unmuted; never reuse stopped handle.
24 px readability,72 px Rock,>=44 px cards, complete keyboard. Types distinguished by shapes. Reduced motion removes hop/flail/shake/flashes/confetti, retains paths/projectiles/steady warnings; no>3 Hz flashes; audio optional.

## Open questions

- User approval:1.6 m visual goblins, finite waves/fixed136 s win, one additive+25 HP repair, capped upgrades, limits3210/39000/140000/base160/pps25.

Status: G0 design fixes only. Claude must add door constant/set metadata limits before implementation build. Actual fit/performance/human success are builder acceptance gates.
