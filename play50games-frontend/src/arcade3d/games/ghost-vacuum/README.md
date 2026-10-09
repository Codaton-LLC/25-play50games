# Ghost Vacuum

Owner Codex; slug `ghost-vacuum`; adventure spec 03 section 8; P-14-fix1 design only. Units metres/seconds; x east, z south, y up. Cute toy mansion, twelve smiling ghosts, flashlight stun and vacuum capture in120 s; accent `#a78bfa`.

## Controls and integration

- `meta.ts`: scheme joystick, durationMs120000, resultDelayMs1600. `GameDefinition` in `index.tsx`: touchControls joystick/action, touchLabels action Vacuum.
- Keyboard WASD/arrows move; mouse aims; hold E/Enter/Space to vacuum. Touch joystick moves/aims; hold72 CSS px Vacuum. Flashlight always on. Shell owns pause, phases, clock, submission, Retry/Exit and persistence.
- Scene projects fine-pointer motion onto floor y=0, ignoring HUD/controls; until real pointer movement, facing follows movement and retains direction when stopped. Rules receive world aim yaw/point, movement and hold (`action || jump`); rules never project pointers or read rig transforms.
- `inputToWorld` uses fitted yaw, normalized magnitude<=1. Coarse mode fixed at run start: held assist selects nearest eligible stunned/pulling ghost within4 m/45 degrees of movement-facing, ties lower id, turns<=180 degrees/s; movement remains manual. No instant capture or wider capture cone.

## Pure rules

Seeded `rules.ts`, groups MANSION/HUNTER/GHOST/LIGHT/PULL/SCHEDULE/SCORE; no Rapier or classic imports. One `useRunFrame` callback consumes full played dt via `substep`<=1/120 s, splitting release/stun/capture/timer boundaries without dropping remainder. Stable id order; caller-owned RNG/scratch.

- Mansion x[-14,14],z[-10,10]; hall x[-3,3]. Library/study west, kitchen/ballroom east, split at z0. Walls0.2 thick/2.4 tall; permanently open2 m doorways at x+/-3,z+/-5. Start(0,8), yaw pi (north).
- Hunter radius0.4, speed4, acceleration20, brake24, turning cap14 rad/s. Radius-inset bounds, `resolveSphereAabb` for furniture/walls, normalized diagonals, final displacement<=4*dt. Vacuum never slows walking.
- Each side room: desk1.6x0.8 at(+/-10,+/-7), chair0.6x0.6 at(+/-10,+/-5.5); library desk has4 decorative books. Desk is host; pop base2 m toward hall. Assign persistent room ordinal n in release-id order; offsets z=(0,-1,+1)[n mod3], plus floor(n/3) metres toward hall: six distinct, room-inset pop positions. Hosts/pop positions reachable on0.25 grid with0.4 clearance; no rejection generator. Decorations/books/open door leaves do not collide.
- Room release assignment is seeded permutation cycling four rooms, never hall. ids0-2 at0,3-4 at20,5 at30 (gold),6-7 at40,8-10 at60 (8 gold,9-10 big),11 at90 (gold). Exactly12 ids, no replacement/expiry/despawn. Released surplus waits FIFO.
- Active cap3 before40,6 thereafter. Active includes admitted hidden/wandering/fleeing/stunned/pulling; excludes caught and pending, including released-but-waiting. One hidden ghost per host; occupied-host admissions begin visibly wandering at their own spread position. Hidden reveal at hunter-host distance<=3; persistent shake/shimmer/icon. No re-hiding after reveal.
- Ghost states pending -> hidden or wandering -> wandering/fleeing -> stunned -> pulling -> caught; breaks return wandering. Ordinary wander/flee speeds0.8/1.2 before60,1.0/1.5 thereafter; gold1.2/1.8, big0.6/0.9. Acceleration<=4, speed<=type flee speed. Furniture ignored, walls respected; wander room clamp radius0.4 (big0.5), no doorway crossing while wandering.
- Core `wander` direction is(sin(agent.yaw+state.angle),cos(...)); keep agent.yaw=0 (+Z), seed state.angle uniform[0,2pi), jitter0.8 rad/sqrt(s). At x edge reflect state.angle=-angle; z edge pi-angle; both at corners, wrap2pi, remove outward velocity. `flee` when lit; hidden/stunned/caught do not steer. Exposed velocity starts zero. Cosmetic bob+/-0.08 at1 Hz.
- Light cone half-angle25 degrees, range5 from hunter centre in XZ, inclusive, wall-only `hasLineOfSightXZ`; furniture never blocks. Continuous exposure0.4 s (big0.8) stuns2 s, interruption resets exposure. Hidden/pulling/caught cannot accumulate exposure. Stun stops velocity; expiry resets exposure and returns wandering.
- Pull begins held on stunned target in12-degree/4 m cone with wall LOS, progress p=0. No room clamp during pulls: ghosts may traverse doorway into hall; LOS prevents pulling through walls. Snapshot segment ghost A, hunter H, progress p0. q=(p-p0)/(1-p0); logical position=(1-q)A+qH+right*0.25*(1-q)*sin(4pi*q), right perpendicular to A-H (coincident: hunter right). Tug vanishes at both endpoints and scales with remaining distance; nozzle is cosmetic.
- On hunter movement or grace re-entry, rebase A to current/frozen logical position, H to current hunter centre, p0 to current p; q=0 before advancing, so moving endpoints cannot jump the ghost. Stationary hunter does not rebase. Progress requires1 s total valid held time; cone/range uses current logical position. Inside0.6 m nozzle radius omit cone and LOS checks; hold/range still required. Capture only at p=1, at current hunter centre; no early capture. Stun expiry suspended while pulling.
- Invalid cone/range/LOS freezes position/progress and accumulates grace; <=0.3 s pauses, >0.3 breaks and clears exposure/progress; re-entry resets grace. Releasing hold breaks immediately. All eligible ghosts pull concurrently with independent state, no transfer. After break outside home room, retrace saved valid pull polyline at type speed through doorway, then resume room-clamped wander; never snap to room or clamp through wall.
- Session requires continuously held action and >=1 active pull; empty set closes after simultaneous captures. New pulls while still held start fresh session. First capture has no combo, subsequent +50; sort simultaneous captures by id. Broken ghosts pay nothing, caught ids pay once.
- Clock first; advance [elapsed-dt,elapsed] using internal cursor. At split boundaries: release/reveal, movement, light, pull, capture, score/end. Never backdate releases; no score on shell timeout frame. Exposure threshold remainder may advance pull, never count same interval twice. Exact stun expiry precedes new pull, capture precedes session closure. Deadline wins ties.
- Spec departures: finite releases/gold times30/60/90; no room swapping/re-hide; room-confined wander and visible occupied-host admissions; arrows/Enter supported. These make farming finite and earliest clear after90 s, replacing speculative60 s duration.

## Scoring and proof

`score=100*caught+200*goldCaught+50*extraInSessions+(won ? 10*floor(max(0,120-tWin)) : 0)`. Extras=sum(max(0,k-1)) over sessions. `addScore` once per capture, reconcile with `setScore`, then `end("win")` after twelfth; no finalScore override. Timeup120 s retains points/no bonus; no lose/health/penalties. Win cheer/confetti during1600 ms result delay, no further score.

Existing main meta/JSON limits5250/10000-122000 ms/base5250/pps5250 are superseded. Proposed **maxScore2630, minDurationMs91000, maxDurationMs122000, base1720 (=2630-910), maxPps10**; Claude updates meta.ts and arcade-games.json at merge, enabled stays false until go-live.

1. Twelve captures/three gold give<=1800; <=11 session extras give<=550, hence capture total<=2350 at every prefix. No survival/stun/hint awards or duplicate payment.
2. Ghost11 cannot leave pending before90; pending/hidden cannot accumulate light. Sequential ordinary exposure0.4+valid pull1 implies tWin>=91.4 even with instant reveal, perfect aim and zero travel. Cap waiting, travel, acceleration and LOS only increase duration; this is a lower bound, not an attainability claim.
3. Time bonus<=10*floor(28.6)=280, total<=2630. Envelope1720+10t equals2630 at accepted minimum91 s, so pps binds there; legal wins>=91.4 have envelope>=2634. Before20 s three ordinary give<=400; before28 s five ordinary give<=700, both below1720. From28 to90 s at most11 captures/two gold/10 extras give<=2000<=1720+10t. From90 s all capture prefixes<=2350<2620. Timeout<=2350<2920 at120 s. Wins>=91400 or timeout120000 fit91000-122000; pause/countdown/result excluded by store clock.
4. Pin literals and prove all event/prefix inequalities; legal bots use `simulateRun(createArcadeStore())`, `advanceRunClock`/`playedFrameDt`, check every prefix/terminal `withinServerLimits` and unchanged `capScore`. Record score/duration extrema and admitted schedule. Never teleport/freeze ghosts or bypass light/LOS/aim. Keyboard and coarse wins are required feasibility witnesses; failure means revise design openly.

HUD: Ghosts x/12, shell time, ghost progress rings and capture base/combo popup. Before90 show "Last ghost in N s" (ceil(max(0,90-elapsed))); after90 if pending cap-blocked show "Last ghost waiting".

## Scene, camera and readability

- Follow pitch75 degrees/yaw0/fov45, shift true, padding8 CSS px/margin0.04; `CameraRig` full follow damping4, origin-local `useFittedView`, no partial follow/followFocus. Separate portrait area x/z+/-4.5, landscape x+/-5,z+/-4.5; gameplay hull y[0,1.56]. Never shrink either axis below suction4+big radius0.5. Walls outside gameplay hull may crop. Ordinary/gold visual height1.0 m, big1.2; rules radii unchanged0.4/0.5.
- Core fitView already tests each safe-area rectangle against projected hull; side joystick/Action are NOT full-width bands. Pass registered shell/game HUD, controls, banner/home obstructions; no game-local rectangle picker. Full hunter and capture-target bodies must avoid all rectangles and have longest dimension>=24 CSS px. Validate at390x844/844x390 banner open/closed; insufficient fit blocks acceptance and goes to Claude for camera/visual-size adjustment, preserving >=+/-4.5 coverage.
- Light range5 may leave screen; >=24 px `TargetMarkers` arrows for exposed ghosts/shaking hosts, none for pending/caught. Table is illustrative scale arithmetic, not fit measurements: estimated free dimensions after padding/HUD/banner, projected depth budget10 m; actual perspective/height hull/side rectangles need browser verification.

| CSS viewport | banner | assumed free W x H | min(W/window width,H/10) px/m | ordinary / big px |
|---|---|---|---|---|
|390x844|closed|350x650|38.9|38.9 /46.7|
|390x844|open|350x560|38.9|38.9 /46.7|
|844x390|closed|800x290|29.0|29.0 /34.8|
|844x390|open|800x240|24.0|24.0 /28.8|

- Camera yaw0 is south (+z): horizontal wall segments at z>=hunter.z cut to0.35 m; vertical portions z>=hunter.z cut to0.35, split at hunter.z. North portions remain2.4; fade opacity0.15 only if occluding hunter/active target. Cosmetics never change LOS/collision. Fan may draw through cut-away walls; exposure ring/eye sparkle appears ONLY on rules-valid illuminated ghost, so blocked light is distinguishable.
- Wallpaper `#4c1d95`/`#3b0764`, floor `#78350f`, ghosts `#e0e7ff`/rim `#a78bfa`, gold `#fde047`; night environment/background `#1e1b4b`. One kit Flashlight spot, disabled low tier without hiding cone.
- `HumanoidModel`/`RUNNER_LANDMARKS`/`useHumanoidPose`, `walkStride`/`bodyLift`: body and legs face aim yaw during mouse aim, otherwise movement-facing. Backward gait uses sign(dot(velocity,bodyForward))*`gaitPhaseStep(amount,landmarks,scale,speed,dt,4)` (pass positive speed; apply negative sign outside helper); cap4 cycles/s, lateral gait positive. Soles within0.01 m; `aimArm`/`turnBone`, cosmetic arm relative yaw+/-60 degrees.
- BEFORE GLB build Claude trims floor-hanging straps via gltf-transform vertex cull (no credits), commits `EXPANSION_GLB_POINTS.vacuumBack` and measured canister-only bounds/size in core. Builder fits0.55 m canister using those core bounds, rotatesY pi and places transformed vacuumBack at chest back attachment. No guessed back-plate point or strap-inclusive fit. Primitive pack fallback has explicit local back/hose anchors. Missing core measurements block GLB build until supplied/user fallback decision.
- Hose from transformed `EXPANSION_GLB_POINTS.vacuumHose`, behind/right of torso to forward nozzle, radius0.035,12x6 segments, reused curve/buffers. Never intersect torso at extreme walk/aim/cheer; primitive pack follows same attachment contract.
- Lift whole kit Flashlight group0.025 m: its own y0.015 sector lands y0.04. Floor outline y0.03, pull ring ghost-top+0.15, score text+0.3, depthWrite false. Fan25 degrees/5 m, suction outline12 degrees/4 m. Stunned bodies appear solid using per-instance brightness attribute in same additive instanced body call, plus readable face/star; no extra opaque body pass.

## Assets and files

No generation/credits. Existing recipe only; manifest tier Gen-2.5-Medium (actual vacuum generation), budget2500 tris/300000 bytes/512 texture. Canister target0.55 m tall AFTER strap trim; shared assets excluded from manifest.

| asset | source / size | fallback |
|---|---|---|
|vacuum|EXPANSION_ASSETS.vacuum; <=2500 tris,512,300k bytes|rounded primitive canister/gauges, explicit anchors|
|hunter|SHARED_ASSETS.runner,1.56 m/r0.4|posed primitive hunter/pack|
|desk/chair|SHARED_ASSETS.desk/chair,1.6/0.6 m wide|boxes/legs|
|book/door|REUSED_ASSETS.book/door,0.25/2.2 m tall|book box/open frame,2 m clearance|
|ghosts|procedural lathe/wobble/fresnel,1.0/1.2 m,<500 tris,6 visible max|no wobble low tier|
|rooms/nozzle/decor|procedural; nozzle0.25,candelabra0.6,clock0.4,painting0.8x0.6|same code|

Future game-local files: meta/index/rules/rules.test/assets/assets.test/Scene/Mansion/Ghosts/poses/poses.test/Vacuum/Hud/Hud.module.css; thumbnail separate owner scope. This revision touches only README, assets.spec.json and requested handoff.

## Test plan and build gates

- Game tests <60 s, rules.test <~600 lines; aggregate tick invariants, no matcher per tick. Pin all tuning/layout/schedule/scoring/limits.256 layout seeds verify grid reachability, distinct pop slots/host occupancy, cap3->6/FIFO and ids. Same seed/input/frame schedule identical; varied frames preserve bounds/gates, not identical wander. Pause/over immutable, remainder retained.
- Movement20,000 bounded steps/corners/diagonals, ghost speeds/acceleration/reflection/containment/no re-hide. Light25-degree/5 m and pull12-degree/4 m inclusive edges/LOS/tangency/furniture; exposure0.399/0.4,big0.799/0.8, expiry2, sequential remainder. Pull0.999/1, grace0.3/>0.3, release/re-entry, decaying tug extremes,0.6 nozzle, moving-hunter/rebase continuity, doorway traversal and broken-return route; assist45 degrees/180 degrees per second/tie ids.
- Concurrent captures/id order/session breaks/held-through-empty, no repeat payment, gold300/big100, bonus floors, twelfth win/deadline/timeup/result delay. Analytical prefix/duration proof and unchanged capScore. Full-knowledge legal bot200 seeds: each seed ONE of6 schedule/mode combinations (60fps/20fps/random4-50ms x keyboard/coarse), counts34/34/33/33/33/33; require every win. Spam bot200 seeds likewise one combination; total400 full runs plus2 idle fixtures, not1200 win runs. Profile60 s budget; if exceeded reduce full-run sample counts explicitly, preserving256 layout seeds and edge proofs; report actual counts/runtime.
- Assets/poses: measured canister-only0.55/runner1.56 fits, vacuumBack alignment/back clearance0.01 through walk/aim/cheer, hose/nozzle outside torso, soles0.01, missing-GLB fallback anchors. Browser screenshots1280x800/390x844/844x390 banner on/off, actual24 px/all safe rects, overlays, keyboard/two-thumb wins, ready/countdown/pause/tab/over/Retry/Exit, mute/reduced motion, Retry x10 flat resource counts. These are future gates, no measurements claimed.

## Performance, sound and access

- Target<=55 calls, game cap60/platform150, <=150k tris, mid-phone p95<=33 ms. Budget room6,runner/pack<=8,props<=12,body/face2,hose2,flashlight2,suction outline1,progress/markers/shadows4,decor4,fx<=5,scores<=2 =48;7 reserved mesh splits. Body one additive instanced call; face/star/crown second. Low removes shimmer/wobble/spot only, never targets/cones.
- Fixed6 ghost/12 marker slots, shared materials/textures, cached vectors/matrices/curve/RNG/substep/audio options, no per-frame allocations/strings/React updates; event-only labels aggregate<=2 sprites. Warm pools, suction48/capture18 particles, dispose owned resources; no bloom/shadow maps/transparency sorting. Measure worst6 ghosts at30/60/90/120 and Retry x10.
- `startLoop("vacuum",{volume:0})`, reused set pitch0.8+0.8*maxProgress, volume held0.35 else0; ambient0.08. Restart after pause/mute stop on resume, never stack. Panned pop giggle1.5/0.15, zap stun, pickup capture, combo pitch1+0.1*sessionExtraCount, hit break0.15 plus coral flash on ghost. Shell end cues; visuals preserve information when muted.
- Host shimmer/icon, exposure ring, stun star, progress, gold crown/big double outline, numeric HUD>=14 CSS px, registered CSS Module UI using existing vars; no globals.css. Reduced motion removes shake/wobble/particles/flicker, keeps steady icons and real travel/tug; disclosed assist, keyboard movement-facing playable.
- Helpers confirmed: core steering wander/flee, vision inViewCone/hasLineOfSightXZ, rig/kit/audio/fx/hud/quality, runtime hooks/store/substep/resolveSphereAabb/RNG/turnTowards, core botHarness and limits. No helper copies or core edits. Claude merge changes metadata/backend; actual fit, bot feasibility, calls and pose clearance remain builder acceptance gates.

## Open questions

- User: trim GLB straps and publish vacuumBack/canister-only bounds in core (recommended), or use a primitive pack?
- User: approve cute smiling ghost look at playtest.

## Status

P-14-fix1 design revision only; implementation/runtime/browser validation remain with builder.
