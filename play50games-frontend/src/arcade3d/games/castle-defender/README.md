# Castle Defender

Owner: Codex. Slug: `castle-defender`. Skill game 14, complexity 4. Spec: 04 §14; assets: 05 §E.4. Gate G0 design only. Units: metres, seconds; x east, z south (toward wall), y up. All tuning belongs in pure `rules.ts`.

## Concept

Defend a toy castle with one wall cannon against five finite waves. Lead clustered goblins with splash shots, crush climbing crews with a rock, then choose a visible upgrade. Gate survival wins; missed groups visibly thump the gate. Accent `#94a3b8`, grass `#65a30d`, stone `#a8a29e`, banners `#3b82f6`, day lighting.

## Controls

`meta.ts`: `scheme: "tap-target"`, `touchControls: ["tap", "action"]`, `touchLabels: { action: "Rock" }`.

- `keyboard`: "Click the field to fire; arrows / WASD aim, Space fires; E / Enter drops a rock; 1 / 2 chooses an upgrade".
- `touch`: "Tap the field to fire, tap Rock to clear a ladder, tap an upgrade card to choose".
- Field fire reads only `tapDown`, projected onto y=0 with cached ray/plane/vector; never `tap`. Space reads `jumpPressed`; rock reads `actionPressed`. One shot request per frame, field press wins over simultaneous Space. Held fire does not repeat. Pointer motion alone does not fire. Shell owns Esc/P, hidden-tab pause, phases, Retry/Exit and submission.
- `createAxisAim` + `stepAimKeys`: x[-5,5], y[-2,6] interpreted as world z=-y; step0.5 m, rate6 m/s, holdDelay0.25 s, dragGain0. No drag opt-in. Initial reticle (0,-2). Fine-pointer taps set aim exactly; coarse taps snap within1.5 m to nearest living ground goblin's predicted impact centre, ties lower id. Recompute flight prediction twice, clamp to field; no automatic shooting or ladder targeting.
- During intermission, only `digit`1/2 or DOM card click chooses; canvas shots/rock ignored. Cards stop propagation and latch one choice until the next rules frame; no stale click crosses phases. A reload press buffers one fixed impact point with `bufferFire`; later presses replace that one point, never move it implicitly.

## Rules

Constants grouped FIELD/WAVES/GOBLIN/CANNON/ROCK/UPGRADE/SCORE. No Rapier. One `useRunFrame` consumes all played dt using core `substep` <=1/120 s, splitting spawn, launch, impact, arrival, climb, intermission and deadline boundaries; no dropped remainder or backdated events.

- Field x[-5,5], z[-6,2]; wall at z2.5, cannon base(0,1.2,3), gate(0,0,2.5), towers(+/-6.5,0,3). Three straight `createPath` routes: x=-3,0,3, z=-6 to2, length8. River/forest/road are cosmetic. Goblin rules circle r0.3, no separation or mesh collisions; grounded corpses do not block paths.
- Gate starts100 HP, max100 until repair upgrade; HP integral, clamped[0,maxHP]. Ground arrival deals walker5/shield8/runner5 once, removes that id as escaped (no kill points). Crew members only climb; each reaching top deals5 once and escapes. HP0 ends immediately before further awards.
- Walker HP1/speed0.7; shield HP2/speed0.7; runner HP1/speed1.2; crew member HP1/speed0.7. Shield damage is0.5 if impact is in front: dot(impact-centre, path tangent)>=0, otherwise1; coincident counts front. Other types take1. Fractional HP retained. Ground splash checks centre distance<=radius, not radius+r; climbing crew cannot be cannon-hit.

| wave | walkers | shields | runners | crew members | total | crews |
|---|---|---|---|---|---|---|
|1|8|0|0|0|8|0|
|2|10|4|0|0|14|0|
|3|10|4|6|0|20|0|
|4|10|4|6|6|26|2|
|5|12|6|6|6|30|2|

- Exactly98 single-use ids. Wave start times0,28,56,84,112. Build packs of<=3: each crew is an indivisible three-member pack; ordinary types seeded-shuffled then packed, packs shuffled. Pack j spawns at8*j/(packCount-1) seconds (single pack at0), lane=(j+seedOffset)%3; each member s=0 initially with cosmetic lateral offsets -0.4,0,+0.4 (rules centres use same offsets). For each crew in pack order choose the first unused lane cyclically from (j+seedOffset)%3; ordinary pack lanes remain cyclic. RNG changes order, not timing/counts/speeds. Pool40, never regenerate ids or carry living enemies across waves.
- Each crew carries a 1.2 m-wide ladder with three equally timed members. At s8 erect on its lane: members ascend logical y0 to2 over2 s simultaneously; cannon immunity begins at arrival. All three still-alive members are independent ids; killed members never return. Empty crew has no ladder. At full height survivors damage and disappear. Most threatened ladder = greatest climb fraction, then smallest crew id; rock targets only erected nonempty ladders.
- Cannon: reload0.8 s, first shot ready at0; gravity9.81, wind0, target y0. Flight T=0.6+0.4*clamp(horizontal muzzle-target distance/10,0,1), hence[0.6,1]. `launchForTime` sets velocity from the transformed measured muzzle. Rules retain launch time/from/velocity and use `landingPoint`/`trajectoryPoints` for analytic flight/contact, not Euler drift. Ground impact at exactT, splash radius2, damage1. No range damage falloff, friendly fire, hit points on projectiles or score for shots. Queued fire launches immediately when reload ends; at most one request consumed once per frame.
- Double shot emits two projectiles at the SAME point/time, processed in projectile id order, each damage1; one reload, no wider radius. Pool8 suffices: fastest reload0.512, flight<=1 implies at most4 cannon balls plus1 falling rock;3 slots reserve. Corpses paid once even with simultaneous hits.
- Rock ready at start, cooldown8 s after accepted drop; no ladder means no consumption. Drop from target lane y3 to y0, gravity9.81, zero initial velocity (`landingPoint`, flight sqrt(6/9.81)=0.7820619 s). At impact remove that crew's ladder and kill all remaining climbing members if still on it, +20 each. Snapshot crew id; no transfer if it empties. Other ladders unaffected.
- Wave clear requires all spawned ids resolved AND at least24 s since its start; +200 once, including waves with escapes. Waves1-4 then intermission4 s (clock continues). Choose immediately but next wave waits until scheduled start; default left at expiry. Slowest ground/crew resolution8+8/0.7+2=21.428572 s, so every surviving wave clears at24. Win at136 s. Fixed `durationMs:150000` is a shell safety ceiling.
- Upgrade pool: reload multiplies reload by0.8, max2 picks (0.8,0.64,0.512); splash multiplies radius by1.3, max2 (2,2.6,3.38); repair once adds25 to maxHP and currentHP (max125); double once. Each intermission offers two distinct seeded eligible types, sorted reload/splash/repair/double for left/right. Six total pick capacities ensure two eligible types for all four offers; selected effects persist, unused cards vanish. No score for repair or upgrade.
- Event order: shell deadline first; within played interval spawn, launch, movement/arrival/climb damage, impacts in projectile id order, kill awards, clear/upgrade/win. Damage beats same-time rescue; dead gate cannot earn impact/clear/win awards. Score changes precede end. Rules freeze in pause/over; result animation cannot score.
- Changed from spec: exact table/timing, finite ids, minimum24 s wave duration and4 s upgrade windows replace unspecified wave cadence, preventing instant-wave score spikes and fixing duration. Repairs are one additive25 HP upgrade with max125 rather than compounded percentages, so every score source has a finite bound.
- Human-paced feasibility estimate (unmeasured): unupgraded reload0.8 allows30 launches per24 s; human cadence1.2 s allows20. Finale has10 packs; roughly10 first hits plus4 shield repeats=14 shots/16.8 s, with lead <=1.2 m and radius>=2, and two rock drops8 s apart if ladder arrivals permit. Alternatively cannon kills crews before arrival. Two reload picks, one splash and repair, with no double, give0.512 reload/radius2.6/125 HP; even 4 escaped runners cost20 and two missed shields16, leaving89 from full repair. Keyboard full-width sweep10/6=1.67 s plus0.25 hold delay; clustered pack targeting and buffering overlap travel with reload. Actual human/limited-reaction bot wins are mandatory; this estimate is not a guarantee.

## Scoring

`runScore = 20*killed + 200*cleared + (won ? 2*gateHP : 0)`. Live `addScore` once per unique kill/clear; on win reconcile `setScore(runScore)` then `end("win")`. Escapes, shots, shields damaged, time, upgrade selection and survival pay nothing. Max98*20+5*200+2*125=**3210**. Lose/timeup retain earned points, no HP bonus, no finalScore override.

### Server limits and why they hold (the proof)

Propose **maxScore3210; minDurationMs20000; maxDurationMs152000; base160; maxPointsPerSec25**. Claude pairs these in meta/server at implementation; provisional 02 §C.4 values were outside this task's permitted reads and must be compared by Claude.

1. At every prefix within wave k, ignore travel/reload/shields and allow all its kills immediately: score<=20*cumulativeCount(k)+200*(k-1). For k1..5 this is160,640,1240,1960,2760 at earliest wave times0,28,56,84,112. Envelope160+25t there is160,860,1560,2260,2960; it grows between events.
2. Clear prefixes at24,52,80,108,136 have maxima360,840,1440,2160,2960; envelope760,1460,2160,2860,3560. Final HP bonus<=250 gives3210<=3560 at136; it is included, never hidden by capScore. Any timeout prefix<=2960 before win; lower health only reduces bonus.
3. Real fastest possible kill cannot precede0.6 s flight; physical speed only delays these conservative bounds. A wave cannot finish before24, intermission exactly4, hence earliest AND latest surviving win136. No gate damage before8/1.2=6.666667 s; wave1 has only40 total damage, so loss cannot occur until wave2 begins28 plus at least6.666667 s (even falsely allowing runners there), giving>=34.666667 s. Min20 s safely covers all losses; max152 s covers136 s win/150 s timeout and excludes countdown/pause/result delay.
4. Prove pack travel8/speed, climb2, spawn<=8 and all event/prefix inequalities with literal fixtures and mutation checks. Full-store legal bots via `simulateRun(createArcadeStore())` use real frame clocks, aim speed, flight, splash, rock, upgrades; check every scoring prefix against the envelope, each terminal with `withinServerLimits`, and `capScore` unchanged. Report extrema, accepted inputs, reasons, missed packs and gate HP; no teleport, instant hits or health immunity.

## Run end

- `end("lose")` at HP0 from arrival/climb, before simultaneous impact/clear. `end("win")` at fifth clear,136 played seconds, after kill/clear/HP bonus. Shell `"timeup"` at150 s beats same-frame awards; this is a safety guard, normal surviving rules always win136.
- `resultDelayMs:1600`; win confetti/raised banners, lose gate tilt/dust. Frozen gameplay and score; shell owns result UI, persistence and API.

## Scene and camera

- Fixed behind-wall view, pitch60 degrees, `yaws:[0]`, fov45, shift true, padding8 CSS px, margin0.02 all sides. `useFittedView` area x[-5.6,5.6], z[-6.5,3.5], y[0,3.4], fixed focus(0,0,-1.5); pass distance/offset/shift to `CameraRig`, no follow. One yaw keeps arrows and lane order stable. Tower roofs/tree crowns outside gameplay hull may crop; never extend fit for decorative6 m towers.
- Register compact HUD/cards with `data-arcade-safe-area`; core `fitView` checks every shell/game HUD, Action side rectangle, banner and home inset. Do not convert side controls into full-width bands or pick a free rectangle in game code. Cards overlay ONLY during intermission. Health/wave/reload HUD avoids shell chips; actual browser fit is the acceptance authority.
- Changed from spec: goblins1.6 m instead of0.9, ladder2 m tall/1.2 wide, reticle diameter1.5; rules radius0.3 unchanged. Fit/table show why a0.9 m goblin is too small in landscape. Depth derives from real GLB depth/height:0.7557/1.8957*1.6=0.637819 m; width1.184 m. Projected goblin length L=depth*sin60+height*cos60=1.35236 m (hop ignored conservatively).
- Projected hull D=10*sin60+3.4*cos60=10.360254 m, W11.2. Illustrative S=min(freeW/11.2,freeH/D); perspective and individual side rectangles require real screenshot measurements. Reticle depth1.5*sin60=1.299038; ladder longest edge2*cos60+1.2*sin60=2.039230. Banner-open landscape minimum row gives >24 CSS px for all three; never claim measured from this table.

| viewport | banner | assumed free W x H | S px/m | goblin px | reticle px | ladder px |
|---|---|---|---|---|---|---|
|390x844|closed|350x650|31.250|42.26|40.60|63.73|
|390x844|open|350x560|31.250|42.26|40.60|63.73|
|844x390|closed|800x290|27.991|37.85|36.36|57.08|
|844x390|open|800x200|19.305|26.11|25.08|39.37|

- Foreground wall lowered visually to1.2 m except side towers; gate rules remain unchanged. Ladder/climbers rendered on field face at z2, always visible above wall silhouettes; threatened crew icon at head+0.2 with24 CSS px `TargetMarkers` fallback. Goblin hop amplitude0.06, phase advances2 Hz, tint and shields/runner pennants show type; arms already down, no T-pose. Death spin0.35 s from a separate cosmetic slot, no rule body resurrection.
- Ground y0; road/river y0.015, targeting ring y0.04, dust ring y0.06, ladder endpoints field-side y0.08/2.08; score above subject+0.3. `depthWrite:false` for translucent overlays; explicit order and actual separation prevent z-fighting. Environment background`#dbeafe`, lighting`day`; only hemisphere/directional preset, blob shadows, no Rapier or extra lights.

## Core helpers used

Confirmed on local `origin/main` tree/exports (no network): `launchForTime`, `landingPoint`, `trajectoryPoints` (ballistics); `createPath`, `advance`, `pointAt`, `tangentAt` (path); `hop`, `squashStretch` (motion); `DynamicInstancedModel` with `tinted` and update(i,matrix,color), `Model`, `InstancedModel`; `createAxisAim`, `stepAimKeys`, `createBufferedFire`, `bufferFire` (aim); `substep`, `rngNext`; `useRunFrame`, `useInput`, `useGameTime`, `useArcadeStore`; `useFittedView`, `CameraRig`, `useSafeArea`, pure `fitView`; `useFx` (warm/burst/score/shake), `playSfx`, `startLoop`; `TargetMarkers`, `useQuality`, `scaledCount`, `BlobShadow`, `useCanvasTexture`; shared asset entries/sizes/points and `expansionPoint`; limits `withinServerLimits`, `capScore`; test-only `createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames`. HUD upgrade cards are game-specific DOM, not an invented core card component. No generic core helper copied into this folder.

## Assets

Already imported; no generation or credits. `assets.spec.json` records ONLY owned goblin recipe, not shared dependencies. All fits derive from measured core sizes; budgets/fit checks use actual meshes.

| id | class / source | target / collision | fallback |
|---|---|---|---|
|goblin|A `EXPANSION_ASSETS.goblin`, castle-defender/goblin.glb|1.6 tall, r0.3; <=4500 tris/512 texture;40 pooled|instanced rounded body/ears, arms down|
|castleTower|C(A) `EXPANSION_ASSETS.castleTower` shared|6 tall,2 copies; decorative AABB only, <=5000 tris|crenellated cylinder|
|cannon|C(A) `EXPANSION_ASSETS.cannon` shared|1.6 long, rotationY pi; no collision|barrel/cylinder/cart|
|door|D `REUSED_ASSETS.door`, escape-room/door.glb|3 tall, gate AABB decorative|arched box|
|rock|C `EXPANSION_ASSETS.rock` shared|1 wide projectile, decorative0.6-1.2; no mesh collisions|sphere|
|leafyTree|C `EXPANSION_ASSETS.leafyTree` shared|3.5 tall,4 outside lanes; decorative|trunk/canopy|
|procedural|B wall/field/road/river/banners/ladders/shields/balls/reticle|wall1.2 high, ladder1.2x2, shield0.55, ball0.25, banner0.6x0.9|same geometry|

- `EXPANSION_CHARACTERS` excludes goblin; catalog explicitly solid arms-down, so use `DynamicInstancedModel` + `core/motion`, no rig/landmarks. Sizes in core: goblin1.4028x1.8957x0.7557, tower1.3862x1.91x1.4204, cannon1.3736x1.4473x1.8975, rock1.9011x0.8989x1.857, tree1.804x1.9133x1.247. Derive uniform scale from height or width/depth specified above.
- Cannon anchor `EXPANSION_GLB_POINTS.cannonMuzzle`=(0,1.036,0.9488); transform with fit/rotation then base translation for rules and visuals, including primitive fallback matching that transformed point. Tower platform=(0,1.374,0) ->4.31623 m at6 m fit; cannon deliberately on procedural wall platform, not tower roof. Door has no measured size/point in sharedAssets: measure its local bounding box in assets adapter once before fitting3 m; assert size, never guess1.9. No new core anchor needed.

## Files

Future split: `meta.ts` (exact strings/limits) · `index.tsx` (definition) · `rules.ts` (schedule, movement, damage, upgrade, score) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (fits/anchors) · `Scene.tsx` (one run callback/camera/events) · `Castle.tsx` (field/wall/props) · `Goblins.tsx` (fixed pool/tints/hop) · `Cannon.tsx` (balls/reticle/rocks) · `Hud.tsx` + `Hud.module.css` (health/cards/reload) · `Primitives.tsx` · `assets.spec.json` · `README.md` · future thumbnail `public/images/3d/castle-defender.webp` and `tools/thumbs/inputs/castle-defender.mjs`. This task writes no implementation or thumbnail.

## Test plan

`rules.test.ts` <=~600 lines, full game test set <60 s. Aggregate tick invariants, no assertion per tick; core helpers already tested. Pin literal wave arrays/count98/times0,28,56,84,112, speeds, HP/damage, radii, reload stacks,8 s rock, repair125, score3210 and limits160/25/20,000/152,000. Reject mutations via edge fixtures, never self-referential expected bounds.

- 256 seeded schedules: exact counts/types/crew lane separation/pack spacing/caps; deterministic same seed/input/schedule; all paths8 m, resolution<=21.428572. Pause/over immutable, full dt remainder; 24 s clear/4 s choice/default/one pick; upgrade capacity proof and no-double route.
- Arc impact within1e-6 m of clicked point at0.6/1 s across field/muzzle; splash2 inclusive/2+epsilon outside; shields front/back/coincident/0.5 HP; double simultaneous hits pay once. Test travel, exact arrival/2 s climb, rock0.7820619 impact/crew snapshot/no-consumption/8 s boundary and same-time gate destruction before rescue.
- Every score source and clear with escaped enemies;136 win, HP bonus0..250, no post-end award, loss, timeout safety fixture. Keyboard nudge/hold/sweep/buffer aim snapshot, one-frame tap/Space/Action/digit events, coarse snap1.5 boundary/ties/lead. Test missing assets separately with same anchors.
- Legal oracle200 seeds plus human-paced200 seeds: each seed ONE combination of keyboard/coarse and60 fps/20 fps/random4-50 ms (six combinations distributed34/34/33/33/33/33). Human bot reaction0.35 s, >=1.2 s firing interval, aim speed6, up to0.6 m seeded aim error, prioritizes imminent damage, legal rock/upgrade inputs; require wins with >=20 HP on no-double route, otherwise revise tuning before acceptance. Oracle uses legal aim/inputs and cannot bypass projectile time. Spam200 seeds at20 fps plus idle fixture test losses/bounds. No three schedules per seed; record actual runtime/counts/extrema, profile before adding runs.
- All store bots check prefix envelope and terminal server limits/cap no-op; analytical proof remains authoritative even if oracle is slower. Browser1280x800/390x844/844x390 banner on/off: actual fitted silhouettes>=24 px, every safe rectangle clear, HUD contrast, wall occlusion, missing-GLB fallback, two-thumb/keyboard wins, shell lifecycle/mute/reduced motion, Retry x10 flat resources. Future builder runs build/tsc/vitest/gamecheck; no runtime evidence claimed at G0.

## Performance

Target<=50 draw calls (spec estimate50), acceptance cap60/platform150. Budget terrain4, wall/gate/banner5, towers4, cannon3, trees/rocks4, goblins2, type accessories2, ladders2, projectiles2, shadows1, rings2, fx4, labels2=37 plus13 for actual mesh splits.40 goblins up to180k tris; total target<=230k, mid-phone p95<=33 ms; must measure40-body stress fixture even though normal maximum30. No shadow maps/bloom, only day preset.

Fixed40 live goblin/40 death/8 projectile/4 crew/4 marker slots; shared geometries/materials, cached vectors/matrices/colors/RNG/path queries/audio options, no per-frame arrays/objects/strings or React state updates. Cosmetic dead bodies hidden if needed to keep drawn goblins<=40. `fx.warm` puff/debris/confetti/score; max2 event-aggregated score labels, impact16 particles. Quality reduces trees/particles/death spin, never enemy/ladder/reticle capacities or rules. Dispose owned buffers/textures, verify Retry x10 flat geometry/texture counts.

## Audio

`boom` shot0.35, `thud` impact/gate0.25, `pop` goblin hup pitch1.5/volume0.08 at pack spawn (not per goblin), `hit` ladder crash, `chime` upgrade, `go` wave horn pitch0.6; shell win/lose cues. Camera-relative pan=clamp(sin(bearing-viewYaw),-1,1). Optional `startLoop("ambient",{volume:0.08})`: effect depends on phase/muted, stops handle on cleanup and recreates only while playing/unmuted after pause or mute; never retain a stopped handle. All information also visible.

## Accessibility

24 CSS px minimum goblins/ladder/reticle at both phone orientations/banner states;72 px Rock; cards>=44 px targets, visible keyboard1/2 labels/focus. Health/wave/reload text>=14 px, `#f8fafc` on opaque`#0f172a` (contrast>17:1), verify >=4.5:1 with all overlays clear of shell chips. Shield shape, runner pennant, crew ladder distinguish types without colour. Landing ring previews radius/readiness; threatened ladder gets steady outlined icon plus numeric rock cooldown. Reduced motion disables hop/spin/shake/flashes/confetti, keeps paths/projectiles/steady warnings. No flashing over3 Hz; audio optional, keyboard complete, coarse assist disclosed.

## Risks and open questions

- Actual fit with perspective/safe rectangles may spend the small landscape readability margin; builder must measure and enlarge visuals or reduce decorative hull before approval, never hide important geometry under controls.40 GLB instances may exceed frame budget despite few calls; profile actual triangle load, request Claude optimization if needed (no credits).
- Human cadence estimate is deliberately unmeasured; no-double human-paced wins/real playtest are blocking build gates. Fixed slots avoid reactive backlogs; intermission default prevents indefinite duration. Shield direction and rock rescue timing must be visually taught with rear-hit ring and climb progress.
- Open questions for Claude/user: approve documented departures (1.6 m goblins, fixed136 s completion, additive one-time repair and upgrade caps); approve proposed server limits after comparison with provisional02 §C.4. No missing named core dependency on local origin/main; remote freshness cannot be checked without network. Build owner must confirm door measured-fit API behaviour and asset budget on actual meshes.

## Status

