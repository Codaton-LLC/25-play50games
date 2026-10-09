# Ghost Vacuum

Owner Codex; slug `ghost-vacuum`; adventure spec 03 section 8; P-14-fix2 design only. Units metres/seconds; x east, z south, y up. Cute toy mansion, twelve smiling ghosts, flashlight stun and vacuum capture in120 s; accent `#a78bfa`.

## Controls and integration

- `meta.ts`: `controls: { scheme: "joystick", keyboard: "WASD / arrows to move, mouse to aim; hold E, Enter or Space to vacuum", touch: "Joystick to move and aim, hold Vacuum to catch stunned ghosts" }`. `GameDefinition` in `index.tsx`: `durationMs: 120000`, `resultDelayMs: 1600`, `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Vacuum" }`.
- Keyboard WASD/arrows move; mouse aims; hold E/Enter/Space to vacuum. Touch joystick moves/aims; hold72 CSS px Vacuum. Flashlight always on. Shell owns pause, phases, clock, submission, Retry/Exit and persistence.
- Scene projects fine-pointer motion onto floor y=0, ignoring HUD/controls; until real pointer movement, facing follows movement and retains direction when stopped. Rules receive world aim yaw/point, movement and hold (`action || jump`); rules never project pointers or read rig transforms.
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
- Invalid cone/range/LOS freezes base/logical/progress and accumulates grace; <=0.3 s pauses, >0.3 breaks and clears exposure/progress; re-entry resets grace. Releasing hold breaks immediately. All eligible ghosts pull concurrently with independent state, no transfer. After break outside home room, return at type speed via the home doorway centre, then the saved room-side crossing base and resume room-clamped wander. Store only these two waypoints, not per-frame history; radius-inset doorway crossing avoids door jambs, with wall-clear segments. Returning ghosts can be lit, stunned and pulled in the hall; stun pauses return, a new pull replaces it, and a later break restarts the same bounded return route. Never snap/clamp through a wall.
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
- At pitch62, sin62=0.882948, cos62=0.469472. Projected size L=footprint*sin62+height*cos62. Ordinary L=1.0*0.882948+1.0*0.469472=1.352420 m; big L=1.2*0.882948+1.2*0.469472=1.622904 m. Hunter uses conservative visible depth0.30 m (pose gate; runner GLB depth0.52 at height1.886 scales to0.430 m at1.56): L=0.30*0.882948+1.56*0.469472=0.997260 m. Longest screen dimension is at least this projected depth; verify posed silhouette, not collision radius.
- Projected hull depth D=9*sin62+1.56*cos62=8.678904 m; scale S=min(freeW/windowW,freeH/D), portrait windowW9, landscape10. Each size below is S*L. Minimum row has hunter27.58 px (>24 by3.58), ordinary37.40 and big44.88; both half-windows stay>=4.5 m. Actual perspective fit must retain this margin or block builder acceptance.

| CSS viewport | banner | assumed free W x H | S=min(W/windowW,H/8.678904) px/m | ordinary px | big px | HUNTER px |
|---|---|---|---|---|---|---|
|390x844|closed|350x650|min(38.889,74.894)=38.889|52.59|63.11|38.78|
|390x844|open|350x560|min(38.889,64.524)=38.889|52.59|63.11|38.78|
|844x390|closed|800x290|min(80,33.414)=33.414|45.19|54.23|33.32|
|844x390|open|800x240|min(80,27.653)=27.653|37.40|44.88|27.58|

- Camera yaw0 is south (+z): horizontal wall segments at z>=hunter.z cut to0.35 m; vertical portions z>=hunter.z cut to0.35, split at hunter.z. North portions remain2.4; fade opacity0.15 only if occluding hunter/active target. Cosmetics never change LOS/collision. Fan may draw through cut-away walls; exposure ring/eye sparkle appears ONLY on rules-valid illuminated ghost, so blocked light is distinguishable.
- Wallpaper `#4c1d95`/`#3b0764`, floor `#78350f`, ghosts `#e0e7ff`/rim `#a78bfa`, gold `#fde047`; night environment/background `#1e1b4b`. One kit Flashlight spot, disabled low tier without hiding cone.
- `HumanoidModel`/`RUNNER_LANDMARKS`/`useHumanoidPose`, `walkStride`/`bodyLift`: body and legs face aim yaw during mouse aim, otherwise movement-facing. Backward gait uses sign(dot(velocity,bodyForward))*`gaitPhaseStep(amount,landmarks,scale,speed,dt,4)` (pass positive speed; apply negative sign outside helper); cap4 cycles/s, lateral gait positive. Soles within0.01 m; `aimArm`/`turnBone`, cosmetic arm relative yaw+/-60 degrees.
- Claude trims floor-hanging straps out of the GLB (no credits) and publishes canister-only `EXPANSION_GLB_SIZE.vacuum` and `EXPANSION_GLB_POINTS.vacuumBack` in core. Builder fits0.55 m canister from that size, rotatesY pi and places transformed vacuumBack at chest back attachment. No guessed back point or strap-inclusive fit. Primitive pack with explicit local back/hose anchors is only the missing-GLB fallback. Local core still has old bounds/no vacuumBack; Claude's trim/measurement update is a merge/build dependency, not an open user decision.
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

Future game-local files: meta/index/rules/rules.test/assets/assets.test/Scene/Mansion/Ghosts/poses/poses.test/Vacuum/Hud/Hud.module.css; thumbnail paths `public/images/3d/ghost-vacuum.webp` and `tools/thumbs/inputs/ghost-vacuum.mjs` (future owner scope). This revision touches only README and requested handoff; assets.spec.json unchanged.

## Test plan and build gates

- Game tests <60 s, rules.test <~600 lines; aggregate tick invariants, no matcher per tick. Pin all tuning/layout/schedule/scoring/limits.256 layout seeds verify grid reachability, distinct pop slots/host occupancy, cap3->6/FIFO and ids, including pending last ghost after90 s. Same seed/input/frame schedule identical; varied frames preserve bounds/gates, not identical wander. Pause/over immutable, remainder retained.
- Movement20,000 bounded steps/corners/diagonals, ghost speeds/acceleration/reflection/containment/no re-hide. Light25-degree/5 m and pull12-degree/4 m inclusive edges/LOS/tangency/furniture; exposure0.399/0.4,big0.799/0.8, expiry2, sequential remainder. Pull0.999/1, grace0.3/>0.3, release/re-entry, decaying tug extremes,0.6 nozzle, moving-hunter/rebase continuity: hunter walking or backing away at4 m/s for a whole1 s pull, aligned to the tug-free base, never off-cone (inside0.6 m uses nozzle exemption), no accumulated drift; global tug phase across repeated rebases/grace, doorway traversal/jamb clearance and bounded broken-return route including hall re-stun/re-pull; assist45 degrees/180 degrees per second/tie ids.
- Concurrent captures/id order/session breaks/held-through-empty, no repeat payment, gold300/big100, bonus floors, twelfth win/deadline/timeup/result delay. Analytical prefix/duration proof and unchanged capScore. Full-knowledge legal bot200 seeds: each seed ONE of6 schedule/mode combinations (60fps/20fps/random4-50ms x keyboard/coarse), counts34/34/33/33/33/33; require every win. Spam bot200 seeds likewise one combination; total400 full runs plus2 idle fixtures, not1200 win runs. Profile60 s budget; if exceeded reduce full-run sample counts explicitly, preserving256 layout seeds and edge proofs; report actual counts/runtime.
- Assets/poses: measured canister-only0.55/runner1.56 fits, vacuumBack alignment/back clearance0.01 through walk/aim/cheer, hose/nozzle outside torso, soles0.01, missing-GLB fallback anchors. Browser screenshots1280x800/390x844/844x390 banner on/off, actual24 px/all safe rects, overlays, keyboard/two-thumb wins, ready/countdown/pause/tab/over/Retry/Exit, mute/reduced motion, Retry x10 flat resource counts. These are future gates, no measurements claimed.

## Performance, sound and access

- Target<=55 calls, game cap60/platform150, <=150k tris, mid-phone p95<=33 ms. Budget room6,runner/pack<=8,props<=12,body/face2,hose2,flashlight2,suction outline1,progress/markers/shadows4,decor4,fx<=5,scores<=2 =48;7 reserved mesh splits. `useQuality`/`scaledCount` scale cosmetic budgets only, never ghost/marker capacity or rules. Body one additive instanced call; face/star/crown second. Low removes shimmer/wobble/spot only, never targets/cones.
- Fixed6 ghost/12 marker slots, shared materials/textures, cached vectors/matrices/curve/RNG/substep/audio options, no per-frame allocations/strings/React updates; event-only labels aggregate<=2 sprites. Warm pools, suction48/capture18 particles, dispose owned resources; no bloom/shadow maps/transparency sorting. Measure worst6 ghosts at30/60/90/120 and Retry x10.
- `startLoop("vacuum",{volume:0})`, reused set pitch0.8+0.8*maxProgress, volume held0.35 else0; ambient0.08. Restart after pause/mute stop on resume, never stack. Panned pop giggle1.5/0.15, zap stun, pickup capture, combo pitch1+0.1*sessionExtraCount, hit break0.15 plus coral flash on ghost. Pan=clamp(sin(worldBearing-cameraYaw),-1,1), the camera-relative bearing sine. Shell end cues; visuals preserve information when muted.
- Host shimmer/icon, exposure ring, stun star, progress, gold crown/big double outline, numeric HUD>=14 CSS px, registered CSS Module UI using existing vars; no globals.css. Reduced motion removes shake/wobble/particles/flicker, keeps steady icons and real travel/tug; disclosed assist, keyboard movement-facing playable.
- Helpers confirmed: core steering wander/flee, vision inViewCone/hasLineOfSightXZ, rig/kit/audio/fx/hud/quality, runtime hooks/store/substep/resolveSphereAabb/RNG/turnTowards, test-only `core/testing/botHarness` (`createGrid`, `freeGrid`, `followPath`, `steer`, `simulateRun`, `fixedFrames`, `randomFrames`) and limits. No helper copies or core edits. Claude merge changes metadata/backend; actual fit, bot feasibility, calls and pose clearance remain builder acceptance gates.

## Decisions (user, 2026-10-09)

- Claude trims straps out of the GLB; use canister-only core size/back anchor. Primitive pack is only the missing-GLB fallback. Keep distance-scaled tug, with no tracking needed at long range; no angle-defined tug.

## Open questions

- User: approve cute smiling ghost look at playtest.

## Status

```text
TASK P-15 | build ghost-vacuum | branch codex/game-ghost-vacuum | allowed: play50games-frontend/src/arcade3d/games/ghost-vacuum/**, play50games-frontend/public/images/3d/ghost-vacuum.webp, tools/thumbs/inputs/ghost-vacuum.mjs
HANDOFF P-15 — ghost-vacuum
State: BLOCKED on measurements / external validation; initial implementation, NOT Common Definition of Done complete.
Branch: codex/game-ghost-vacuum (verified). No branch creation/switch, commit or push.
Status: dev; meta.ts, scoring and thumbnail:null unchanged.
Files: game folder index.tsx plus rules/rules.test, Scene, Mansion, Ghosts, Vacuum, assets/assets.test, poses/poses.test, Primitives, camera, Hud/CSS Module, README Status; tools/thumbs/inputs/ghost-vacuum.mjs; this explicitly requested .handoff/P-15-ghost/HANDOFF.md.
Implemented: seeded four-room permutation and finite 12-id releases; FIFO active caps; hidden reveal; acceleration/collision movement; core wander/flee/cone/LOS; continuous exposure; stun and concurrent pulls with global-phase tug-free rebasing, grace/release and bounded return waypoints; finite session/capture scoring and win; one rules-to-store frame hook; clock-first shell timer; fitted full follow camera; humanoid walk/aim/cheer, canister chest attachment, procedural hose, instanced ghosts/props/walls, markers, HUD, effects/audio, primitive fallbacks and local input script.
Tests written (NOT executed): 1000 layout seeds and reachability; tuning/scoring pins; determinism; 20000 movement steps; exposure, cones, LOS, nozzle, tug rebasing, moving hunter, grace/release, concurrent capture, win/deadline; analytical prefix envelope; 200 legal bot wins required + 200 spam runs across six frame/input combinations, two idle runs, through simulateRun/createArcadeStore (advanceRunClock + playedFrameDt); real GLB sizes, floor poses and attachment alignment.
Verified: node node_modules/typescript/bin/tsc --noEmit from play50games-frontend exited 0 after final code changes. git status --porcelain showed only task game files/input script before adding this requested handoff/README Status. Static forbidden-call scan found no Math.random/Date.now/localStorage/submitScore/clock.elapsedTime in the game.
Not run, per explicit sandbox instructions: npm build, vitest, browser/keyboard/touch playtests, GLB decoding, tools/thumbs, gamecheck, tools/perf. No network, production access, Hyper3D calls or dependencies.
Evidence: screenshots at 1280x800, 390x844 and 844x390 NOT produced; performance JSON NOT produced; thumbnail remains null. No measured draw-call, p95, resource-retry, safe-area or 24px claims.
Scoring formula: 100*caught + 200*goldCaught + 50*extraInSessions + (won ? 10*floor(max(0,120-tWin)) : 0).
Limit proof: 12 captures + 3 gold <=1800; at most 11 session extras <=550; capture prefixes <=2350. Last release >=90s plus 0.4s exposure and 1s pull implies win >=91.4s; time bonus <=280 and total <=2630. Prefix maxima <=400 before20s, <=700 before30s, <=2000 from30–90s and <=2350 thereafter fit 1720+10*t. Legal wins and120s timeout fit91000–122000ms. Bot extrema, capScore-no-op results and >=90% limit witness are UNVERIFIED.
Acceptance checklist:
[x] Correct existing branch, authorized scope, no commit/push/credits/production/API.
[x] Definition, controls, fixed duration120000/result delay1600, HUD safe-area marker, dev metadata unchanged.
[x] Pure seeded rules use named core helpers; one useRunFrame and game-time visuals.
[x] Core fit receives all registered safe-area rectangles; >=4.5m half-window retained.
[x] TypeScript check.
[ ] Shared prop fits, full real-mesh character/canister/hose clearance, all fallback contracts validated.
[ ] Complete approved visual finish and every mechanics/edge test.
[ ] All vitest tests, 400 bot outcomes and <60s runtime; build.
[ ] Keyboard/touch end-to-end, all three viewport/banner checks, shell lifecycle/accessibility.
[ ] <=55 draw calls, <=150k triangles, p95<=33ms and Retry x10 resource stability.
[ ] Screenshots, perf JSON and captured thumbnail.
Known implementation follow-ups:
- Desk/chair currently use shared assets' default fits. assets.test.ts records raw desk/chair/book/door bounds and checks required1.6m/0.6m widths; those fit assertions may fail until measured scales are supplied. No guessed measurements were used. Book/door models are declared but not rendered; decorative books/door leaves/candelabra/clock/painting remain.
- Canister back-point alignment and sole tests exist; mesh-surface pack clearance, hose/nozzle non-intersection and posed >=0.30m silhouette tests remain. Hose is chest-local/static, and the primitive hunter does not animate limb gait yet.
- Walls cut at hunter.z but lack the approved selective0.15-opacity occlusion fade.
- Ghosts have body/eyes, illuminated/stun rings and progress diamonds; smile, gold crown, big double outline and a true progress ring remain. Host icon is steady; shimmer/shake and panned event/combo cues remain.
- Return uses doorway hall-side/room-side points; exact saved crossing-base contract and hall re-stun/re-pull/jamb adversarial tests still need verification.
- The bot harness has not been run: do not treat generated tests as feasibility evidence or a passing scoring proof. Full edge/mutation coverage and best-bot limit tightness remain.
Open questions:
1. Claude: run assets.test.ts and return raw desk/chair/book/door bounds so their exact approved fits can be completed without guessed dimensions.
2. Claude: run rules/pose tests and return failures, bot score/duration extrema and total runtime; profile the400-run suite before claiming the60s budget.
3. Claude: provide pose mesh-clearance and headless fit measurements (all safe rects, hunter/ghost>=24 CSSpx with banner open at both mobile sizes), then run build/all tests/local browser/perf/thumbs after fixes.
4. User approval of the smiling ghost look remains pending the eventual completed playtest.
```
