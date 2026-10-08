# Penguin Ice Slide

Owner: Codex. Slug: `penguin-slide`. Skill game 15, wave 1, complexity 3. P-15 implementation; runtime review pending. Spec: 04 §15; asset ids: 05 §E.4. Units: metres, seconds, radians; rules use longitudinal distance s and lateral offset d, world y up. Core owns the shell and submission.

## Concept

Belly-slide a penguin down a twisting glacier, carve through fish trails, hop cracks, spin off ramps and cross time gates. An endless-looking seeded downhill course ends at three crashes, an empty gate clock or the 180 s run ceiling. Accent `#67e8f9`.

## Controls

`meta.ts`: `scheme: "steer"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Hop" }`.

- `keyboard`: "A / D or left / right to steer; Space to hop; steer in the air to spin".
- `touch`: "Joystick left / right to steer and spin; tap Hop to hop; auto-hop assists cracks".
- `moveX` is the held steering axis, clamped to [-1, 1]; smooth all input at 4 units/s toward the held axis (InputState cannot distinguish keyboard from joystick). When `moveX` is zero, `pressed.left/right` supplies a target -1/+1 for 0.1 s of play time, then zero, with the same smoothing. Opposing presses cancel; held-axis input takes precedence and clears the impulse. Consume each press once per latched frame, not per substep. `pressed` also comes from canvas swipes; never also consume `swipe` or double-count it. `jumpPressed` starts one grounded hop; held `jump` does not repeat. Ignore `moveY`, `action`, `tap`, `tapDown`, `drag` and `pointer`. Esc/P and hidden-tab pause belong to the shell.
- Changed from spec: use the joystick option only, omitting optional drag-anywhere to avoid two conflicting steer sources. `steer` is already registered in `types.ts`; it uses existing axes/events, not a new InputState field.

## Rules

All constants below belong in pure `rules.ts`; one `useRunFrame` consumes play dt. Start s=0, d=0, speed=8, crashes=0, remaining=30, air=0. No `durationMs`; HUD: Time (ceil seconds), Distance (floor metres), Crashes x/3, Auto-hop On (touch) / Off (keyboard), informational only.

- **Time/order:** integrate in `substep(dt, 1/120, cachedStep)` (no dropped play time). Split a step at clock expiry, 180 s ceiling and longitudinal event crossings. Earliest event wins; equal-time expiry beats gate, crash beats pickup, landing failure beats trick award. Gate adds 8 s once only if crossed before expiry. Remaining has no cap; hard elapsed ceiling is 180 s. No scoring or motion after end.
- Changed from spec: a 180 s ceiling makes the listed 45–180 s duration upper bound enforceable and scoring finite. Early loss/timeup is permitted; 45 s is an expected session, not a guaranteed minimum.
- **Track:** 60 m arc-length chunks, 3 resident slots: previous, current, next. Initial chunk is straight; all hazards start at s>=60. Global event IDs derive from seed, chunk index and slot, never an accumulating history. Each chunk is generated from seed/index plus its bounded entry descriptor. Catmull-Rom paths use 24 samples per span and are resampled/cropped to 60 m. Boundary position/tangent/bank agree; split branches are each 60 m with matching endpoints. Rules s is actual arc length, never control-point spacing.
- **Forms:** seeded choice among straight, curve, S-bend, ramp, narrow and split; ramp at most one/chunk and at least 60 m after the previous ramp. Curve heading change <=20 degrees/chunk, S-bend <=15 degrees each way, downhill grade 0.03–0.08. Split opens two corridors centred d=±1.5, each half-width 1.25; choose by sign of d at the fork (zero chooses left), retain branch until merge; entry/exit taper 20 m. Use `createPathGraph` for branch links; reward/obstacle budgets apply across both branches together.
- **Widths/progression:** ordinary half-width 3.5, narrow half-width 2.25. Difficulty q=min(elapsed/120,1); obstacle slots/chunk = 2+floor(3q), except the empty initial chunk. Narrow and split transitions taper over >=20 m. Penguin radius 0.35; clamp centre to half-width minus 0.35 (banks are forgiving, no crash on clamp).
- **Speed:** acceleration a=0.1+2*grade m/s²; v'=clamp(v+a*dt, 0, 22), then multiply by exp(-0.02*dt) when abs(steer)>=0.75. Initial speed 8; normal cruise ramps toward 22. A crash sets v=0.6*v and stops forward movement for 1 s; afterwards acceleration resumes without resetting to 8. Lateral velocity = 4*steer m/s, with no inertial drift; in air lateral steering still works. Cosmetic bank never changes score or speed.
- **Obstacles:** ice radius 0.6, snowman radius 0.5, crack radius 0.6 in (s,d). Penguin collision circle 0.35. Use `circlesOverlapXZ` with x=s,z=d, plus swept closest-approach checks over each substep (including first entry into an airborne interval) to avoid tunnelling. Non-crack obstacles collide below height 1.0; cracks below 0.15. One crash per contact group; 1 s tumble is invulnerable, movement frozen, air/spin cleared, nearest safe corridor position restored. Third crash ends immediately. No hidden collider inferred from meshes.
- **Fair generator:** reserve a continuous hazard-free centre corridor of width 1.2 (penguin diameter 0.7 plus margin 0.5); within splits reserve it on both branches. Safe corridor centre may shift <=1.5 m per 20 m, starts at the prior exit centre, and includes gate aperture and taper. Obstacle footprints including penguin radius cannot overlap it. Cracks cover only optional side routes, never the mandatory corridor. Hazards have >=12 m longitudinal separation and >=20 m preview. Validate swept reachable intervals at v=22, lateral limit 4, and all width transitions; 16 candidate attempts then a tested straight safe fallback with identical event budgets. Fish mark the safe corridor; the solver may ignore optional ramps/tricks. No unavoidable hop or spin is required.
- **Hop/ramps:** manual hop lasts 0.6 s, height h=4*0.5*u*(1-u), u=airTime/0.6. Grounded ramp entry launches once; ramp airtime T=0.6+0.6q, height h=4*1.2*u*(1-u), u=airTime/T. An existing hop does not relaunch at a ramp. No queued jump and no repeated launch while overlapping a ramp.
- **Spins:** ramps only; signed yaw integrates 600 degrees/s * steer, manual hops cannot score spins. Successful landing requires wrapped yaw within 30 degrees of forward (inclusive). On a valid landing, spins=round(abs(netYaw)/360); 335 degrees earns one spin, capped at 2 (T<=1.2, rate<=600). Landing rewards 50*spins; a double is +100 total, not +100 extra. Failed landing crashes and awards zero. Direction reversals cancel rotation, preventing oscillation farming.
- Changed from spec: clarify double-spin wording as +100 total and confine tricks to ramps, so unlimited manual-hop farming cannot undermine the limits.
- **Fish:** <=12/chunk across both split branches, >=3 m apart longitudinally, none before s=60. Circle pickup radius 0.55 including penguin reach, vertical tolerance 0.6; magnet-free. Trails on the safe line or optional ramp arcs; one pickup/ID, expire behind player. No reward spawned by cosmetics.
- **Gates:** full safe-corridor aperture (half-width 1), first s=120; each next spacing=120+60*min(gateIndex/10,1), gateIndex=0 for first-to-second interval. Crossing on selected branch while abs(d-gateCentre)<=1 gives +8 s once; missed gate expires, never respawns. No points for gates. Flags are not collision objects.
- **Assist:** auto-hop cracks is ALWAYS ON for touch and off for keyboard-only play, with no toggle or ready-card control (GameDefinition has no start-card slot). Detect touch capability outside InputState, e.g. maxTouchPoints>0, including hybrid touch devices. When grounded with a projected crack hit <=0.1 s away, issue the same hop as `jumpPressed`; manual input wins ties. No assist score multiplier or separate leaderboard; safe corridor still works for keyboard-only play without assist.

## Scoring

`runScore = floor(s) + 10*fishCollected + trickPoints`; `trickPoints` sums 50*successfulRampSpins. Publish score deltas through `addScore`, reconcile with `setScore` at end; no `finalScore` override, duration is shell elapsedMs. Distance awarded only for actual forward arc-length travel; no points during tumble. Fish/trick popups "+10", "+50 spin", "+100 double".

### Server limits and why they hold (the proof)

| Limit | provisional (task / 02 §C.4) | proposed, Claude-owned limits PR |
|---|---|---|
| maxScore / max_score | 75000 | **18700** |
| duration | 3000–900000 ms | **9000–182000 ms** (tightened minimum proposed in fix1) |
| base / max_pps | not supplied in allowed inputs | **440 / 104** |

For t<=180, s<=22t<=3960. A conservative count of chunks touched is floor(s/60)+1<=67 (includes empty first chunk and boundary rounding). Fish<=12*67=804, ramp awards<=100*67=6700: score<=3960+8040+6700=18700. For any t, score<=s+220*(floor(s/60)+1)<= (1+220/60)*22t+220 =102.667t+220, below 440+104t. The extra 220 base covers a whole event batch and frame-end rounding; `capScore` remains a safety net and must be a no-op for legal runs.

With v0=8 and a<=0.26, ignoring carve/crash slowdown gives s(t)<=8t+0.13t² (semi-implicit 1/120 s steps add at most 0.26t/120). First contact is no earlier than 60-0.95=59.05 m: solving this bound gives >=6.65 s, hence >=6.6 s conservatively. For third-crash loss, three obstacle contacts require s>=83.05 m; if a ramp landing contributes, at least two obstacle contacts require s>=72-0.95=71.05 m, or two ramps require s>=120 m. These bounds assume no minimum gap between a ramp and an obstacle. The weakest case reaches 71.05 m only after >=7.87 s of active travel using the same discrete bound; two completed 1 s invulnerable tumbles add 2 s (acceleration resumes afterwards), so loss>=9.87 s even ignoring crash speed reductions. Propose minDurationMs=9000, stronger than the approved 3000 ms. Timeout>=30 s; ceiling=180 s. Shell duration may include the enclosing <=50 ms frame, safely below 182000 ms. Build bots must verify every terminal store duration >=9000 ms, including ramp-failure losses; Claude owns adoption of this tightened minimum.

Proof plan: assert ds<=22*dt for every step, chunk-wide reward budgets and non-replay IDs across recycling/splits; drive fastest-reward and earliest-loss bots via `createArcadeStore`, `advanceRunClock`, `playedFrameDt` at 60/20 fps and random 4–300 ms raw frames (store clamp respected), including pause/countdown boundaries. Check every terminal result with `withinServerLimits`, and capScore unchanged. Report measured best score/duration after build; analytic maximum intentionally overcounts unreachable simultaneous rewards. Claude must update both meta.scoring and arcade-games.json together before submission can go live.

## Run end

- `end("lose")` immediately on third crash; `end("timeup")` when remaining hits zero or elapsed reaches 180 s. No `"win"`. Gate at exact expiry cannot rescue the run.
- `resultDelayMs: 1200`; freeze rules immediately, use game time for the final tumble or gentle coast visual only. Shell owns result, Retry/Exit and API access.

## Scene and camera

- **Local chase, pitch 25 degrees, yaws [0]**: floating origin keeps penguin at local longitudinal s=0; transform track/scenery into its tangent frame from `tangentAt`, retaining lateral d and air height. Recycle previous chunk without camera jumps; keep steering track-relative.
- `useFittedView`: fixed local area x=[-5,5], y=[0,4], forward=[-4,32], focus=[0,0,10]; pitch=25*pi/180, yaws=[0], padding=2, margin={top:0.11,bottom:0.08,left:0.03,right:0.03}, shift=true, fov=50. Refit only on canvas/safe-area changes, never speed or per frame. No `followFocus` or game `CameraRig follow`: the player does not translate longitudinally in this frame.
- Scene owns camera `useFrame` at `FRAME_PRIORITY.camera`, after simulation; mutate preallocated vectors, camera position and lookAt directly using fixed fitted offset/focus. Apply speed pullback factor 1+0.2*(v/22), damping=6 with pause-safe game delta; snap on mount/rebase and keep distance >=fit. A static non-following CameraRig may own fitted lens shift only; it has no per-frame position writer. No per-frame React state or offset prop updates; custom camera pose is the sole frame writer before visuals/shake.
- Cosmetic camera roll <=3 degrees; body/track bank <=12 degrees (`bank`, reference gravity 9.81). Disable camera roll and speed pullback for reduced motion. Penguin belly rotated 90 degrees, lifted from measured belly bounds to track+0.01; add air height and tangent orientation. No rig/T-pose requirements for this solid creature.
- `environment`: snow lighting and sky background. Definition fog [25,56] is an initial value; ChaseCamera updates it after every fitted/damped pose. Three fog uses view-space depth: d is the penguin ground-origin depth, near=d+22 m, far=d+46 m. The player and 20 m preview remain clear across portrait/banner fits and pullback. At pitch 25 degrees a straight edge 60 m ahead adds about 54 m depth; a 20-degree curve retains about 51 m, past far. Browser QA must verify the nearest split/curve edge and preview silhouettes. No added geometry or draw calls.

## Core helpers used

`GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`); `createRng`/`rngNext` (chunk seeding), `randomSeed` (Scene only); `createPath`, `advance`, `pointAt`, `tangentAt`, `createPathGraph`, `advanceGraph`; `substep` (chosen over fixedStep to consume all timed dt); `bank`, `hop` (cosmetic), `spring`, `squashStretch`; `circlesOverlapXZ`; `useFittedView`, `CameraRig` (static lens shift only), `useSafeArea`, `FRAME_PRIORITY.camera` plus R3F `useFrame`; `Model`, `InstancedModel`, `DynamicInstancedModel`, `Instanced`, `BlobShadow`, `useCanvasTexture`; `EXPANSION_ASSETS`, `EXPANSION_GLB_SIZE`, `REUSED_ASSETS`; `useFx` (`warm`, `burst`, `score`, `shake`), `useCameraShake` via fx; `SkyDome`, `SnowFall`, snow lighting; `useQuality`, `scaledCount`, perf probe `?perf=1`, `TargetMarkers` (one upcoming gate target); `withinServerLimits`, `capScore`; real-store clock helpers above. No generic helpers copied into the game; the generator, track-space collision sweep and event ordering are game-specific.

## Assets

No generation and no game-owned GLBs; `assets.spec.json` has an empty assets array, preserving clean-city's top-level schema. Fits in `assets.ts` use measured `EXPANSION_GLB_SIZE`; checks load real meshes during build.

| id (05 §E.4) | class / source | target / footprint | fallback |
|---|---|---|---|
| penguin | C (A), EXPANSION_ASSETS.penguin | 0.8 m standing fit then belly rotation; circle 0.35 | ellipsoid body, beak, flippers |
| fish | C (A), EXPANSION_ASSETS.fish | 0.35 m long; pickup circle 0.55 | orange ellipsoid + tail |
| pine trees | C (A), EXPANSION_ASSETS.pineTree | 3–5 m tall, no collision | stacked cones + trunk |
| gate flags | D, REUSED_ASSETS.checkpointFlag | 1.5 m tall, material override blue #38bdf8, no collision | pole + blue triangle |
| track, ice blocks, snowmen, gates | B, procedural | track widths above; ice diameter 1.2/height 1; snowman diameter 1/height 1.4; gate posts 2.4 tall | code |

Penguin <=8k tris/1024 texture, fish <=1.5k/512; pine shared budget verified without editing shared assets. Track uses canvas ice texture; snow banks, crack dark discs/coral borders, ramp slopes, split islands, arches, lake plane and speed lines are procedural, non-generated. Ice fresnel uses opaque shader approximation to avoid transparent sorting through banks.

## Files

`meta.ts` (controls, scoring, dev status) · `index.tsx` (definition, always-on touch assist capability) · `rules.ts` (seeded chunks, speed, steering, hop/spin, collisions, gates, clock, scoring) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (fits/belly clearance) · `Scene.tsx` (one run callback, camera, penguin, fx/audio) · `Track.tsx` (three reusable chunk slots and instances) · `Primitives.tsx` (fallbacks and procedural props) · `Hud.tsx` + `Hud.module.css` (assist/clock labels using existing CSS vars, data-arcade-safe-area) · `assets.spec.json` · `README.md` · `public/images/3d/penguin-slide.webp` · `tools/thumbs/inputs/penguin-slide.mjs`. No poses.ts needed for a solid model; no classic engine/progressStorage imports.

## Test plan

`rules.test.ts` <=~600 lines; test behaviour and bounds, not copies of core algorithms.

- Determinism: same seed/input timeline identical, including recycled chunks; initial safe zone, bounded 16 attempts/fallback, branch seams, widths, obstacle spacing, fish/ramp budgets and unique IDs. Inject invalid candidate for each invariant.
- P-15 fairness: full-lookahead solver survives 180 s on 500 seeds in keyboard-only mode without assist or tricks, including narrow/split transitions at forced v=22; verify reserved corridor analytically for every accepted candidate, plus fallback. Solver shares legal movement/action limits, not collision immunity. Distinguish collision survival from timeout; standard-clock solver must also catch enough gates to survive the full 180 s on all 500 seeds; any timeout before the ceiling fails the generator acceptance check.
- Speed/steer: cap 22, carve decay, crash 60% and 1 s freeze, edge clamps, diagonals irrelevant, taps/holds/opposed inputs, 0.1 s impulses and smoothing for keyboard/joystick/swipe presses without double count, dt partition, swept collisions at maximal speed. No movement or timer change while paused/over.
- Air: hop 0.6 s, ramps 0.6–1.2, no relaunch, crack clearance, assisted vs manual hop, spins/reversals, ±30-degree success and just-outside failure, 335/360/385-degree singles and 690/720-degree doubles, zero-spin valid landings, no manual-hop reward; touch assist always on without a toggle.
- Gates/time: first 120, spacing formula, one award, miss, branch duplicate prevention, exact expiry ties, terminal third crash, ceiling; no win path. Fish radius/vertical limits, one pickup, distance floor, scoring/event order and all server proofs/bots above.
- `assets.test.ts`: measured sizes, belly lowest point within 1 cm of banked track at rest, no prop-based collision inference; primitive fallbacks and shared GLB failure visually checked.
- Build/browser later: common 03 criteria, ready/countdown/pause (Esc/P/tab)/over/Retry/Exit, keyboard and 390x844 touch/banner open; screenshots 1280x800, 390x844, 844x390, banner closed too; hazards retain 20 m clear preview, nearest generation-edge camera depth >=56 m through recycling/curves/splits and speed pullback, no z-fighting. npm build, tsc, vitest, gamecheck as common build DoD, not this documentation task.

## Performance

Target **50 draw calls**, hard game cap **55**, <=150 platform cap. Budget: track/banks 6, obstacles/borders 6, fish <=3, trees <=6, flags/posts <=6, penguin/fallback <=5, sky/snow/lake/arches <=6, blobs 1, speed lines 1, fx pools 3, score sprites <=2 =45; reserve 5 for real shared mesh splits. Fog [25,56] retains the 3-slot budget (45+5=50); no fourth-slot track/bank calls are added. Runtime calls still require build measurement. Cosmetic simplification required if imported GLBs exceed reserve.

Exactly 3 chunk geometry slots, preallocated position/index buffers and instance matrices: <=36 fish, 15 obstacles, 30 trees (10/chunk, scaled cosmetically), 6 gate flag pairs, 3 ramps. Warm sparkle/snow/splash/score pools once; rate-limit carving snow to 10 bursts/s, fish popups coalesced per 0.2 s, at most 2 active score sprites. One canvas ice texture, no per-chunk materials/textures, no retained chunk history. Regenerate path objects only on recycling, release references immediately; dispose mount-owned resources on unmount. No per-frame allocations or dynamic lights; snow preset only, blob shadows.

P-15 memory acceptance: record geometries/textures/programs and JS retained heap after warm-up at 30/60/120/180 s; GPU counts constant, no upward retained-heap trend after GC at identical checkpoints. Retry x10 returns counts to baseline. Measure ?perf=1 p95 on mid-phone profile and calls with all effects active; report numbers after build. Quality reduces trees/snow/fx only, never hazards, fish or gate geometry.

## Audio

P-06 designed API: `startLoop("slide")` while playing, shell stops on pause/over/mute; proposed pitch tracks 0.8+0.6*v/22 when loop API supports updates. `playSfx(name, { pitch, pan, volume })`: carve scrape, fish gulp, ramp whoosh, landing thump, gate chime, crash bonk (P-06 cues). Adopt exact cue identifiers from P-06 when merged; no guessed new cue keys in implementation. Fallback now: fish "pickup", gate "pickup", crash "hit"; silent continuous slide/carve and optional ramp/landing cues. Visual feedback fully communicates each event.

## Accessibility

Coral hazard silhouettes plus dark crack shape (not colour alone); fish show a safe route, gate aperture mint ring and +8 s HUD flash; air landing alignment arrow and circular ±30-degree window. Touch auto-hop is always enabled; the HUD label is informational, with no checkbox or focusable toggle. Keyboard users have manual Hop and the reserved safe corridor. Hop touch target 72 px. Clock numeric plus low-time pulse at <=5 s (steady outline under reduced motion); crash count icons and text. Mute leaves full visual feedback. Reduced motion disables camera roll, speed lines/pullback, reduces snow and uses core shake preference; rules stay identical.

## Risks and open questions

- Server metadata is Claude-owned; approved limits await owner adoption, with the tighter 9000 ms minimum proposed here. This task changes no live metadata; steer registration is already present.
- Chase fit in rotating local coordinates and floating-origin seams need portrait/banner QA before tuning; never solve readability by hiding hazards or changing scoring speed.
- Chunk retry acceptance and real GLB mesh counts require measurement; fallback guarantees fairness even if random candidates all fail. Gate spacing can legitimately exhaust the clock before 180 s; optional reward routes need not be feasible together.
- P-06 cue names/loop pitch updates await merged API; fallback above is complete. No assets credits needed.
### Decisions (user, 2026-10-08)

- The 180 s ceiling and limits (18700, 3000–182000 ms, base 440 / pps 104) are approved. Fix1 proposes tightening only the minimum to 9000 ms using the proof above.
- Touch auto-hop over cracks is ALWAYS ON, no toggle; drop the ready-card assist checkbox because GameDefinition has no start-card slot.
- The steer scheme is already registered in types.ts; nothing to ask or add.

### Open questions

- Claude: adopt the proven 9000 ms minimum in the future paired meta/server limits update? Existing approval covers 3000 ms; all other approved limits stay as recorded.
- Claude: confirm exact P-06 cue identifiers and loop pitch-update API when merged; current fallback uses existing pickup/hit cues.

## Status

```text
TASK P-15 | build penguin-slide | branch codex/game-penguin-slide | allowed: play50games-frontend/src/arcade3d/games/penguin-slide/**, play50games-frontend/public/images/3d/penguin-slide.webp, tools/thumbs/inputs/penguin-slide.mjs
HANDOFF P-15 — Penguin Ice Slide
Branch: codex/game-penguin-slide; no branch changes, commits or pushes.
Status: dev; implementation ready for Claude validation, Common DoD not yet verified.
Files: games/penguin-slide/{index.tsx,meta.ts,rules.ts,rules.test.ts,assets.ts,assets.test.ts,Scene.tsx,Track.tsx,Primitives.tsx,camera.tsx,Hud.tsx,Hud.module.css,README.md}; tools/thumbs/inputs/penguin-slide.mjs.
Administrative output: .handoff/P-15-penguin/HANDOFF.md, explicitly requested in the CLI instructions.
Scope check: git status --porcelain lists only task files before this handoff; local main was not compared.
[x] GameDefinition replaces placeholder; variable gate clock, snow lighting, Hop label, three instructions, 1200 ms result delay.
[x] Pure seeded rules; 1/120 s substeps, event splitting, expiry precedence, one-contact crashes, three-crash loss, 180 s ceiling.
[x] Six forms; three resident chunks; arc-length paths, linked split branches, tapered widths, reserved corridors, 16-attempt safe fallback.
[x] Held steering and one-shot pressed impulses; jumpPressed only; touch-capability auto-hop always on, no toggle.
[x] One useRunFrame -> rules -> store; fitted camera and static lens-shift rig; pause-safe visual motion, solid penguin, floor/bank clearance.
[x] Shared/reused model assets; dynamic pools and primitives; measured flag floor offset; no manifest or GLB edits.
[x] FX warmed; snow carving rate limited; at most two score popups; existing pickup/hit/jump audio, TODO(P-06) loop/cues.
[x] Tests authored: 1,000-seed course validity/determinism/seams; fallback; scoring, gates, hops/spins, assist, collision, terminal conditions.
[x] Real-store proof bots authored: 500 safe seeds at normal and forced 22 m/s; 200 seeds each safe/reward/crash/spam at 60/20 fps and random 4–300 ms raw frames, with pauses/countdown.
[x] Real-GLB bounds/size and resting bank/slope-clearance tests authored; rules.test.ts 361 lines.
[x] npx tsc --noEmit: PASS, final invocation exit 0.
[x] Static source scan: no Math.random/Date.now in rules, elapsedTime, API/localStorage/submission, classic imports or other-game imports.
[x] meta.scoring remains Claude's provisional data; thumbnail stays null; no credits or production access.
[ ] npm run build and npx vitest run: deferred to Claude by explicit sandbox instructions; tests have NOT been executed here.
[ ] Keyboard/touch/browser lifecycle, banner open/closed, 1280x800 / 390x844 / 844x390 screenshots: deferred, no screenshots produced.
[ ] Draw calls <=50 target /55 cap, mid-phone p95, 10 Retries and 30/60/120/180 s memory checkpoints: unmeasured; no perf JSON produced.
[ ] Hazard preview >=20 m and generation edge fully fogged across fit/pullback/splits: needs browser verification.
[ ] Thumbnail capture: input script supplied; capture deferred. gamecheck/tools/perf skipped as instructed (not merged).
Scoring: floor(actual arc-length s) + 10*fishCollected + sum(50*successfulRampSpins); gates add time, never points.
Limit proof: s<=22t, t<=180; <=12 fish and <=100 trick points per 60 m chunk; score<=s+220*(floor(s/60)+1)<=18700.
Rate proof: score<=102.667t+220<440+104t. Proposed paired server limits: max 18700, base 440, pps 104, duration 9000–182000 ms.
Minimum proof: approved README's weakest third-crash bound >=9.87 s includes two complete 1 s tumbles; timeout >=30 s. Claude owns adopting the proposed 9000 ms minimum; current approval is 3000 ms.
Bot measurements: pending vitest; no measured best score/duration claimed. capScore no-op assertions are authored. The approved analytic maximum intentionally overcounts unreachable simultaneous rewards; the skill's >=90% max bot criterion is not asserted.
Decisions: outer-bank obstacles preserve both split corridors; smooth tapers stay below the 4 m/s steering reach at 22 m/s; split branch lengths solved to 60 m; primitive launch pads have raised side rails with a clear centre; HUD follows measured shell chips.
Open questions:
- Camera/fog: fix1 implements player view-depth d+[22,46]; portrait/banner and split-edge visual QA remains pending.
- Claude: adopt 9000 ms minimum with the paired meta/server update after bot results? No server-owned files were changed.
- P-06: confirm merged cue identifiers and loop API before replacing the explicit TODOs.
Acceptance: awaiting Claude build/vitest/browser/perf results and any resulting fix round; do not promote beyond dev.
```

### P-15-fix1 status

Current flag GLB scene bounds measured: minY=0, height=1.8968853950500488. Its 1.5 m fit needs zero lift. Gate miss fixture excludes hazards: the original missed lane hit an obstacle before the gate. Production gate rules are unchanged. Split endpoints use 9-decimal component tolerance.

Bot budget: 100 normal and 50 forced-speed survival runs at 20 fps; 64 limits runs at 60 fps, 16 at 20 fps, 16 seeded random-frame runs. Four legal modes rotate evenly (16 each at 60 fps; four each in smaller sets). Rules keep 1/120 s substeps. Pauses/countdown, terminal limits and capScore checks remain. Every played frame contributes to a maximum travel-excess assertion, replacing millions of matcher calls with one per run. No shared harness import.

Claude measured baseline: 1,000 survival runs cost 559 s and 800 limits runs cost 231 s. Run reduction alone predicts about 84+87=171 s, insufficient for the target. Removing per-frame matcher overhead is the additional optimization; whole-file under-60 s timing awaits Claude Vitest. Diagnostic benchmark and TypeScript validation are recorded in the fix1 handoff; no new Vitest timing is claimed here. Build and browser QA also remain pending.

Diagnostic measured 150 survival runs in 21.33 s and the initial 300 limits runs in 60.36 s (81.69 s total, standalone Node assertions, not Vitest). Therefore final limits sampling is 96 runs: 64/16/16 across frame schedules, each balanced across four modes. Linear measured-cost estimate is about 19.3 s for limits, 40.6 s combined, leaving about 19 s for course/assets and Vitest overhead. The taper reachability proof also aggregates maxima over all 480,000 samples instead of allocating two matchers per sample. Final whole-file timing still requires Claude validation.
