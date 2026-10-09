# Ghost Vacuum

Owner Codex; slug `ghost-vacuum`; adventure spec 03 section 8; P-15-fix2 implementation awaiting review. Units metres/seconds; x east, z south, y up. Cute toy mansion, twelve smiling ghosts, flashlight stun and vacuum capture in120 s; accent `#a78bfa`.

## Controls and integration

- `meta.ts`: `controls: { scheme: "joystick", keyboard: "WASD / arrows to move, mouse to aim; hold E, Enter or Space to vacuum", touch: "Joystick to move and aim, hold Vacuum to catch stunned ghosts" }`. `GameDefinition` in `index.tsx`: `durationMs: 120000`, `resultDelayMs: 1600`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Vac" }`.
- Keyboard WASD/arrows move; mouse aims; hold E/Enter/Space to vacuum. Touch joystick moves/aims; hold72 CSS px Vac. Flashlight always on. Shell owns pause, phases, clock, submission, Retry/Exit and persistence.
- Scene projects fine-pointer motion onto ghost-body plane y=0.6, ignoring HUD/controls; until real pointer movement, facing follows movement and retains direction when stopped. Rules receive world aim yaw/point, movement and hold (`action || jump`); rules never project pointers or read rig transforms.
- `inputToWorld` uses fitted yaw, normalized magnitude<=1. Coarse mode fixed at run start: held assist selects nearest eligible stunned/pulling ghost within4 m/45 degrees of movement-facing, ties lower id, turns<=180 degrees/s; movement remains manual. No instant capture or wider capture cone.

## Pure rules

Seeded `rules.ts`, groups MANSION/HUNTER/GHOST/LIGHT/PULL/SCHEDULE/SCORE; no Rapier or classic imports. One `useRunFrame` callback consumes full played dt via `substep`<=1/120 s, splitting release/stun/capture/timer boundaries without dropping remainder. Stable id order; caller-owned RNG/scratch.

- Mansion x[-14,14],z[-10,10]; hall x[-3,3]. Library west/north z<0, study west/south z>0; kitchen east/north z<0, ballroom east/south z>0. Walls0.2 thick/2.4 tall; permanently open2 m doorways at x+/-3,z+/-5. Start(0,8), yaw pi (north).
- Hunter radius0.4, speed4, acceleration20, brake24, turning cap14 rad/s. Radius-inset bounds, `resolveSphereAabb` for furniture/walls, normalized diagonals, final displacement<=4*dt. Vacuum never slows walking.
- Each side room: desk1.6x0.8 at(+/-10,+/-7), chair0.6x0.6 at(+/-10,+/-5.5); library desk has4 decorative books. Desk is host; pop base2 m toward hall. Assign persistent room ordinal n in release-id order; offsets z=(0,-1,+1)[n mod3], plus floor(n/3) metres toward hall: six distinct, room-inset pop slots as headroom; twelve ghosts cycling four rooms assign exactly three per room, so only n=0,1,2 are used. Hosts/pop positions reachable on0.25 grid with0.4 clearance; no rejection generator. Decorations/books/open door leaves do not collide.
- Room release assignment is seeded permutation cycling four rooms, never hall. ids0-2 at0,3-4 at20,5 at30 (gold),6-7 at40,8-10 at60 (8 gold,9-10 big),11 at90 (gold). Exactly12 ids, no replacement/expiry/despawn. Released surplus waits FIFO.
- Active cap3 before40,6 thereafter. Active includes admitted hidden/wandering/fleeing/stunned/pulling; excludes caught and pending, including released-but-waiting. One hidden ghost per host; occupied-host admissions begin visibly wandering at their own spread position. Hidden reveal at hunter-host distance<=3; persistent shake/shimmer/icon. No re-hiding after reveal.
- Ghost states pending -> hidden or wandering -> wandering/fleeing -> stunned -> pulling -> caught; breaks return wandering. Ordinary wander/flee speeds0.8/1.2 before60,1.0/1.5 thereafter; gold1.2/1.8, big0.6/0.9. Acceleration<=4, speed<=type flee speed. Furniture ignored, walls respected; wander room clamp radius0.4 (big0.5), no doorway crossing while wandering.
- Core `wander` direction is(sin(agent.yaw+state.angle),cos(...)); keep agent.yaw=0 (+Z), seed state.angle uniform[0,2pi), jitter0.8 rad/sqrt(s). At x edge reflect state.angle=-angle; z edge pi-angle; both at corners, wrap2pi, remove outward velocity. `flee` when lit; hidden/stunned/caught do not steer. Exposed velocity starts zero. Cosmetic bob+/-0.08 at1 Hz.
- Light cone half-angle25 degrees, range5 from hunter centre in XZ, inclusive, wall-only `hasLineOfSightXZ`; furniture never blocks. Continuous exposure0.4 s (big0.8) stuns2 s, interruption resets exposure. Hidden/pulling/caught cannot accumulate exposure. Stun stops velocity; expiry resets exposure and returns wandering.
- Pull begins held on stunned target in12-degree/4 m cone with wall LOS, global progress p=0. No room clamp during pulls: ghosts may traverse doorway into hall; LOS prevents pulling through walls. Store tug-free segment endpoints A (ghost base), H (hunter centre), and p0. q=(p-p0)/(1-p0); base=(1-q)A+qH; logical=base+right(base->H)*0.25*(1-p)*sin(4*pi*p). Right is the perpendicular to base->H (coincident: hunter right). Offset is freshly computed from GLOBAL p each step; never fold it into A. Nozzle is cosmetic; handle p=1 as capture before division by zero.
- On hunter movement or grace re-entry, rebase A from the current/frozen tug-free base, H from current hunter centre, p0 from current p; q=0 before advancing. Stationary hunter does not rebase. Keep base separately from logical position; never restart tug phase at local q. Distance-scaled tug stays small at long range (no extra tracking there); no angle-defined tug. Progress requires1 s total valid held time; cone/range tests current logical position. Inside0.6 m nozzle radius omit cone and LOS checks; hold/range still required. Capture only at p=1, at current hunter centre; stun expiry suspended while pulling.
- Invalid cone/range/LOS freezes base/logical/progress and accumulates grace; <=0.3 s pauses, >0.3 breaks and clears exposure/progress; re-entry resets grace. Releasing hold breaks immediately. All eligible ghosts pull concurrently with independent state, no transfer. After break outside home room, return at type speed through the current room-side doorway and hall-side doorway, across the hall to the home hall-side doorway, then into its room-side doorway and resume room-clamped wander. Store a source-room id and a four-stage cursor, not per-frame history; radius-inset doorway crossing avoids door jambs, with wall-clear segments. Returning ghosts can be lit, stunned and pulled in the hall; stun pauses return, a new pull replaces it, and a later break recomputes the bounded route from its current room. Never snap/clamp through a wall.
- Session requires continuously held action and >=1 active pull; empty set closes after simultaneous captures. New pulls while still held start fresh session. First capture has no combo, subsequent +50; sort simultaneous captures by id. Broken ghosts pay nothing, caught ids pay once.
- Clock first; advance [elapsed-dt,elapsed] using internal cursor. At split boundaries: release/reveal, movement, light, pull, capture, score/end. Never backdate releases; no score on shell timeout frame. Exposure threshold remainder may advance pull, never count same interval twice. Exact stun expiry precedes new pull, capture precedes session closure. Deadline wins ties.
- Spec departures: finite releases/gold times30/60/90; no room swapping/re-hide; room-confined wander and visible occupied-host admissions; arrows/Enter supported. These make farming finite and earliest clear after90 s, replacing speculative60 s duration.

## Scoring and proof

`score=100*caught+200*goldCaught+50*extraInSessions+(won ? 10*floor(max(0,120-tWin)) : 0)`. Extras=sum(max(0,k-1)) over sessions. `addScore` once per capture, reconcile with `setScore`, then `end("win")` after twelfth; no finalScore override. Timeup120 s retains points/no bonus; no lose/health/penalties. Win cheer/confetti during1600 ms result delay, no further score.

Existing main meta/JSON limits5250/10000-122000 ms/base5250/pps5250 are superseded. Proposed **maxScore2630, minDurationMs91000, maxDurationMs122000, base1720 (=2630-910), maxPps10**; Claude updates meta.ts and arcade-games.json at merge, enabled stays false until go-live.

1. Twelve captures/three gold give<=1800; <=11 session extras give<=550, hence capture total<=2350 at every prefix. No survival/stun/hint awards or duplicate payment.
2. Ghost11 cannot leave pending before90; pending/hidden cannot accumulate light. Sequential ordinary exposure0.4+valid pull1 implies tWin>=91.4 even with instant reveal, perfect aim and zero travel. Cap waiting, travel, acceleration and LOS only increase duration; this is a lower bound, not an attainability claim.
3. Time bonus<=10*floor(28.6)=280, total<=2630. Envelope1720+10t equals2630 at accepted minimum91 s, so pps binds there; legal wins>=91.4 have envelope>=2634. Before20 s three ordinary give<=400; before30 s five ordinary give<=700, both below1720. From30 to90 s at most11 captures/two gold/10 extras give<=2000<=1720+10t. From90 s all capture prefixes<=2350<2620. Timeout<=2350<2920 at120 s. Wins>=91400 or timeout120000 fit91000-122000; pause/countdown/result excluded by store clock.
4. Pin literals and prove all event/prefix inequalities; legal bots use `simulateRun(createArcadeStore())`, `advanceRunClock`/`playedFrameDt`, check every prefix/terminal `withinServerLimits` and unchanged `capScore`. Record score/duration extrema and admitted schedule. Never teleport/freeze ghosts or bypass light/LOS/aim. Keyboard and coarse wins are required feasibility witnesses; failure means revise design openly.

HUD: Ghosts x/12, shell time, ghost progress rings and capture base/combo popup. Before90 show "Last ghost in N s" (ceil(max(0,90-elapsed))); after90 if pending cap-blocked show "Last ghost waiting".

## Scene, camera and readability

- Follow pitch62 degrees/yaw0/fov45, shift true, padding8 CSS px/margin0.04; `CameraRig` full follow damping4, origin-local `useFittedView`, no partial follow/followFocus. Separate portrait area x/z+/-4.5, landscape x+/-5,z+/-4.5; gameplay hull y[0,1.56]. Never shrink either axis below suction4+big radius0.5. Walls outside gameplay hull may crop. Ordinary/gold visual height1.0 m and diameter>=1.0 m; big height/diameter1.2 m; rules radii unchanged0.4/0.5.
- Core fitView already tests each safe-area rectangle against projected hull; side joystick/Action are NOT full-width bands. Pass registered shell/game HUD, controls, banner/home obstructions; no game-local rectangle picker. Full hunter and capture-target bodies must avoid all rectangles and have longest dimension>=24 CSS px. Validate at390x844/844x390 banner open/closed; insufficient fit blocks acceptance and goes to Claude for camera/visual-size adjustment, preserving >=+/-4.5 coverage.
- Light range5 may leave screen; >=24 px `TargetMarkers` arrows for exposed ghosts/shaking hosts, none for pending/caught. Table is illustrative projection arithmetic, not browser fit measurements: assumed free dimensions after padding/HUD/banner; perspective, poses and side rectangles still require verification. At pitch75, height alone contributes only cos75=0.2588; a near-top-down hunter silhouette about0.7 m at24 px/m is only16.8 px and fails.
- The drawn ordinary sheet is 1.0 m wide and 1.35 m tall (big scales both by1.2); rules radii stay0.4/0.5. The body is an ellipsoid of horizontal radius0.5, vertical radius0.475, centred at y0.875; its skirt runs from radius0.38 at y0 to radius0.42 at y0.6. Ignore cosmetic bob/base translation for extent. For pitch a, projected body half-extent R=sqrt((0.5*sin(a))^2+(0.475*cos(a))^2). Real silhouette bounds are lo=min(0.875*cos(a)-R,-0.38*sin(a),0.6*cos(a)-0.42*sin(a)), hi=max(0.875*cos(a)+R,0.38*sin(a),0.6*cos(a)+0.42*sin(a)); L=max(1,hi-lo). The old footprint*sin(a)+height*cos(a) expression is only a bounding-box upper bound, not the sphere's drawn extent.
- Portrait keeps pitch62; landscape now uses pitch50, a nine-metre window on both axes (half-window4.5), and1% vertical margins. L is1.2409 at62 and1.3434 at50 (big1.4891/1.6121). Hunter bounding estimate remains0.30*sin(a)+1.56*cos(a); measure the posed silhouette separately. Projected fit-box depth D=9*sin(a)+1.56*cos(a), so D=8.6789 portrait and7.8971 landscape. Landscape targets >=27 CSS px/metre with the banner open; actual perspective fit/registered safe rects still require Claude's measurement.
- This table uses assumed free dimensions and an orthographic approximation S=min(freeW/9,freeH/D). It is design arithmetic, not browser evidence; it must not be used to claim the24 px gate passed.

| CSS viewport | banner | pitch | assumed free W x H | estimated S px/m | ordinary px | big px | hunter bounding estimate px |
|---|---|---|---|---|---|---|---|
|390x844|closed|62|350x650|38.889|48.26|57.91|38.78|
|390x844|open|62|350x560|38.889|48.26|57.91|38.78|
|844x390|closed|50|800x290|36.722|49.33|59.20|45.26|
|844x390|open|50|800x240|30.391|40.83|48.99|37.46|

- Camera yaw0 is south (+z): horizontal wall segments at z>=hunter.z cut to0.35 m; vertical portions z>=hunter.z cut to0.35, split at hunter.z. North portions remain2.4; fade opacity0.15 only if occluding hunter/active target. Cosmetics never change LOS/collision. Fan may draw through cut-away walls; exposure ring/eye sparkle appears ONLY on rules-valid illuminated ghost, so blocked light is distinguishable.
- Wallpaper `#9683b0`, floor `#ad825d`, cool fill light0.65, ghosts `#e0e7ff`/rim `#a78bfa`, gold `#fde047`; night environment/background `#1e1b4b`. One kit Flashlight spot, disabled low tier without hiding cone.
- `HumanoidModel`/`RUNNER_LANDMARKS`/`useHumanoidPose`, `walkStride`/`bodyLift`: body and legs face aim yaw during mouse aim, otherwise movement-facing. Backward gait uses sign(dot(velocity,bodyForward))*`gaitPhaseStep(amount,landmarks,scale,speed,dt,4)` (pass positive speed; apply negative sign outside helper); cap4 cycles/s, lateral gait positive. Soles within0.01 m; `aimArm`/`turnBone`, cosmetic arm relative yaw+/-60 degrees.
- Claude trims floor-hanging straps out of the GLB (no credits) and publishes canister-only `EXPANSION_GLB_SIZE.vacuum` and `EXPANSION_GLB_POINTS.vacuumBack` in core. Builder fits0.55 m canister from that size, rotatesY pi and places transformed vacuumBack at chest back attachment. No guessed back point or strap-inclusive fit. Primitive pack with explicit local back/hose anchors is only the missing-GLB fallback. Core now provides the trimmed size and measured back/hose landmarks.
- Hose from transformed `EXPANSION_GLB_POINTS.vacuumHose`, behind/right of torso to forward nozzle, radius0.035,12x6 segments, reused curve/buffers. Never intersect torso at extreme walk/aim/cheer; primitive pack follows same attachment contract.
- Both kit Flashlight groups start at the posed right-hand nozzle tip with height0, using the forearm direction; the decorative sector rides that origin. Floor outline y0.03, pull ring around the sheet silhouette, score text+0.3, depthWrite false. Fan25 degrees/5 m, suction outline12 degrees/4 m. Stunned bodies appear solid using per-instance brightness attribute in same additive instanced body call, plus readable face/star; no extra opaque body pass.

## Assets and files

No generation/credits. Existing recipe only; manifest tier Gen-2.5-Medium (actual vacuum generation), budget2500 tris/300000 bytes/512 texture. Canister target0.55 m tall AFTER strap trim; shared assets excluded from manifest.

| asset | source / size | fallback |
|---|---|---|
|vacuum|EXPANSION_ASSETS.vacuum; <=2500 tris,512,300k bytes|rounded primitive canister/gauges, explicit anchors|
|hunter|SHARED_ASSETS.runner,1.56 m/r0.4|posed primitive hunter/pack|
|desk/chair|SHARED_ASSETS.desk/chair,1.6/0.6 m wide|boxes/legs|
|book/door|REUSED_ASSETS.book/door,0.25 m book length lying flat/2.2 m door height|book box/open frame,2 m clearance|
|ghosts|procedural lathe/wobble/fresnel,1.0/1.2 m,<500 tris,6 visible max|no wobble low tier|
|rooms/nozzle/decor|procedural; nozzle0.25,candelabra0.6,clock0.4,painting0.8x0.6|same code|

Game-local files: meta/index/rules/rules.test/assets/assets.test/Scene/Mansion/Ghosts/poses/poses.test/Vacuum/Hud/Hud.module.css; thumbnail paths `public/images/3d/ghost-vacuum.webp` and `tools/thumbs/inputs/ghost-vacuum.mjs`. This revision edits game implementation/tests/README and the requested handoff; assets.spec.json unchanged.

## Test plan and build gates

- Game tests <60 s, rules.test <~600 lines; aggregate tick invariants, no matcher per tick. Pin all tuning/layout/schedule/scoring/limits.256 layout seeds verify grid reachability, distinct pop slots/host occupancy, cap3->6/FIFO and ids, including pending last ghost after90 s. Same seed/input/frame schedule identical; varied frames preserve bounds/gates, not identical wander. Pause/over immutable, remainder retained.
- Movement20,000 bounded steps/corners/diagonals, ghost speeds/acceleration/reflection/containment/no re-hide. Light25-degree/5 m and pull12-degree/4 m inclusive edges/LOS/tangency/furniture; exposure0.399/0.4,big0.799/0.8, expiry2, sequential remainder. Pull0.999/1, grace0.3/>0.3, release/re-entry, decaying tug extremes,0.6 nozzle, moving-hunter/rebase continuity: hunter walking or backing away at4 m/s for a whole1 s pull, aligned to the tug-free base, never off-cone (inside0.6 m uses nozzle exemption), no accumulated drift; global tug phase across repeated rebases/grace, doorway traversal/jamb clearance and bounded broken-return route including hall re-stun/re-pull; assist45 degrees/180 degrees per second/tie ids.
- Concurrent captures/id order/session breaks/held-through-empty, no repeat payment, gold300/big100, bonus floors, twelfth win/deadline/timeup/result delay. Analytical prefix/duration proof and unchanged capScore. Full-knowledge legal bot150 seeds: each seed ONE of6 schedule/mode combinations (60fps/20fps/random4-50ms x keyboard/coarse), counts25/25/25/25/25/25; require every win. Spam bot150 seeds likewise one combination; total300 full runs plus2 idle fixtures, not1200 win runs. Profile60 s budget; if exceeded reduce full-run sample counts explicitly, preserving256 layout seeds and edge proofs; report actual counts/runtime.
- Assets/poses: measured canister-only0.55/runner1.56 fits, vacuumBack alignment/back clearance0.01 through walk/aim/cheer, hose/nozzle outside torso, soles0.01, missing-GLB fallback anchors. Browser screenshots1280x800/390x844/844x390 banner on/off, actual24 px/all safe rects, overlays, keyboard/two-thumb wins, ready/countdown/pause/tab/over/Retry/Exit, mute/reduced motion, Retry x10 flat resource counts. These are future gates, no measurements claimed.

## Performance, sound and access

- Target<=55 calls, game cap60/platform150, <=150k tris, mid-phone p95<=33 ms. Budget room6,runner/pack<=8,props<=12,body/face2,hose2,flashlight2,suction outline1,progress/markers/shadows4,decor4,fx<=5,scores<=2 =48;7 reserved mesh splits. `useQuality`/`scaledCount` scale cosmetic budgets only, never ghost/marker capacity or rules. Sheet/tail/crown/double outline/stun outline/progress ring share one additive instanced call with feature attributes; eyes/smile share one dark instanced call. Low removes shimmer/wobble/spot only, never targets/cones.
- Fixed12 ghost/12 marker slots (at most6 active), shared materials/textures, cached vectors/matrices/curve/RNG/substep/audio options, no per-frame allocations/strings/React updates; event-only labels aggregate<=2 sprites. Warm pools, suction36 (12 low tier, none reduced motion)/capture18 particles, dispose owned resources; no bloom/shadow maps/transparency sorting. Measure worst6 ghosts at30/60/90/120 and Retry x10.
- `startLoop("vacuum",{volume:0})`, reused set pitch0.8+0.8*maxProgress, volume held0.35 else0; ambient0.08. Restart after pause/mute stop on resume, never stack. Panned pop giggle1.5/0.15, zap stun, pickup capture, combo pitch1+0.1*sessionExtraCount, hit break0.15 plus coral flash on ghost. Pan=clamp(sin(worldBearing-cameraYaw),-1,1), the camera-relative bearing sine. Shell end cues; visuals preserve information when muted.
- Host shimmer/icon, exposure ring, stun star, progress, gold crown/big double outline, numeric HUD>=14 CSS px, registered CSS Module UI using existing vars; no globals.css. Reduced motion removes shake/wobble/particles/flicker, keeps steady icons and real travel/tug; disclosed assist, keyboard movement-facing playable.
- Helpers confirmed: core steering wander/flee, vision inViewCone/hasLineOfSightXZ, rig/kit/audio/fx/hud/quality, runtime hooks/store/substep/resolveSphereAabb/RNG/turnTowards, test-only `core/testing/botHarness` (`createGrid`, `freeGrid`, `followPath`, `steer`, `simulateRun`, `fixedFrames`, `randomFrames`) and limits. No helper copies or core edits. Claude merge changes metadata/backend; actual fit, bot feasibility, calls and pose clearance remain builder acceptance gates.

## Decisions (user, 2026-10-09)

- Claude trims straps out of the GLB; use canister-only core size/back anchor. Primitive pack is only the missing-GLB fallback. Keep distance-scaled tug, with no tracking needed at long range; no angle-defined tug.

## Open questions

- User: approve cute smiling ghost look at playtest.

## Status

P-15-fix2, 2026-10-09, branch codex/game-ghost-vacuum; changes left uncommitted for Claude.

Round1 (1660be6) review supplied by Claude: rules/scoring accepted; real-input wins at1280x800/390x844/844x390; desktop110.5s/1890;1740 tests/build passed;21-22 calls,p95 17ms,Retry x10 flat,0 console errors. These measurements describe round1, not this revision.

Round2 changes:
- Taller sheet/skirt ghosts, smile, gold crown, big double outline, angular pull ring; additive features share one instanced draw. Landscape nine-metre window/pitch50/1% vertical margins; clamped markers suppressed within1.5 projected metres (at least36px) of hunter.
- Pointer aims at y0.6; Vac touch label; broken pulls route through source/home doorways, preserving hall re-stun and re-pull.
- Right-hand nozzle via HumanoidModel handR; right arm aimed forward with hunter yaw; beams start at its actual tip; chest hose updates reused geometry to the posed hand.
- Readable suction opacity0.32 and streaming particles, brighter mansion/fill, wood desk look, selective foreground wall fade0.15, host desk shake/icon shimmer, panned pop/capture/combo pitch, four flat library books, four open door GLBs, candelabra/clock/painting.
- Regression tests for11.9/12.1 degrees, final release and >=91.4s win, fractional floor bonus, interrupted exposure, suspension of nearly expired stun during pull grace,45-degree assist/180-degree turn/tie id, foreign-room doorway return and hall re-stun/re-pull. Pose tests measure the runner back independently from mesh/landmarks and add pack/hose clearance.
- Bot sample reduced to150 legal +150 spam (all six input/frame combinations25 each), plus two idle cases; runtime remains unmeasured.

Verification in this sandbox: TypeScript noEmit passed before final documentation update. No vitest/build/browser/mesh decoding/thumb/performance execution, per task instruction. Scope checked with git status --porcelain only; metadata/scoring/backend/core/packages unchanged. No commit, push, branch operation, production/network access or credits.

Claude acceptance remains: run all tests/build, mutation probes, mesh clearance assertions, suite <60s, actual >=27px/m landscape banner fit and >=24px hunter/ghost gate at all three viewports, marker overlap, local input playtests, shader/GLB visual check, audio pan/mute, reduced motion, draw-call/p95 and Retry x10 resources. No new screenshots, thumbnail or runtime measurements claimed.
