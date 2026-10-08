# Penguin Ice Slide

Owner: Codex. Slug: `penguin-slide`. Skill game 15, wave 1, complexity 3. Gate G0 design; no implementation in this task. Spec: 04 §15; asset ids: 05 §E.4. Units: metres, seconds, radians; rules use longitudinal distance s and lateral offset d, world y up. Core owns the shell and submission.

## Concept

Belly-slide a penguin down a twisting glacier, carve through fish trails, hop cracks, spin off ramps and cross time gates. An endless-looking seeded downhill course ends at three crashes, an empty gate clock or the 180 s run ceiling. Accent `#67e8f9`.

## Controls

`meta.ts`: `scheme: "steer"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Hop" }`.

- `keyboard`: "A / D or left / right to steer; Space to hop; steer in the air to spin".
- `touch`: "Joystick left / right to steer and spin; tap Hop to hop; auto-hop assists cracks".
- `moveX` is the held steering axis, clamped to [-1, 1]; keyboard builds analog steering by smoothing it at 4 units/s toward the held axis. `pressed.left/right` supplies a one-step signed impulse for a brief key press when `moveX` is zero; opposing presses cancel. Never also consume `swipe`. `jumpPressed` starts one grounded hop; held `jump` does not repeat. Ignore `moveY`, `action`, `tap`, `tapDown`, `drag` and `pointer`. Esc/P and hidden-tab pause belong to the shell.
- Changed from spec: use the joystick option only, omitting optional drag-anywhere to avoid two conflicting steer sources. The new `steer` scheme needs Claude's core registration if absent; it uses existing axes/events, not a new InputState field.

## Rules

All constants below belong in pure `rules.ts`; one `useRunFrame` consumes play dt. Start s=0, d=0, speed=8, crashes=0, remaining=30, air=0. No `durationMs`; HUD: Time (ceil seconds), Distance (floor metres), Crashes x/3, Assist On/Off.

- **Time/order:** integrate in `substep(dt, 1/120, cachedStep)` (no dropped play time). Split a step at clock expiry, 180 s ceiling and longitudinal event crossings. Earliest event wins; equal-time expiry beats gate, crash beats pickup, landing failure beats trick award. Gate adds 8 s once only if crossed before expiry. Remaining has no cap; hard elapsed ceiling is 180 s. No scoring or motion after end.
- Changed from spec: a 180 s ceiling makes the listed 45–180 s duration upper bound enforceable and scoring finite. Early loss/timeup is permitted; 45 s is an expected session, not a guaranteed minimum.
- **Track:** 60 m arc-length chunks, 3 resident slots: previous, current, next. Initial chunk is straight; all hazards start at s>=60. Global event IDs derive from seed, chunk index and slot, never an accumulating history. Each chunk is generated from seed/index plus its bounded entry descriptor. Catmull-Rom paths use 24 samples per span and are resampled/cropped to 60 m. Boundary position/tangent/bank agree; split branches are each 60 m with matching endpoints. Rules s is actual arc length, never control-point spacing.
- **Forms:** seeded choice among straight, curve, S-bend, ramp, narrow and split; ramp at most one/chunk and at least 60 m after the previous ramp. Curve heading change <=20 degrees/chunk, S-bend <=15 degrees each way, downhill grade 0.03–0.08. Split opens two corridors centred d=±1.5, each half-width 1.25; choose by sign of d at the fork (zero chooses left), retain branch until merge; entry/exit taper 20 m. Use `createPathGraph` for branch links; reward/obstacle budgets apply across both branches together.
- **Widths/progression:** ordinary half-width 3.5, narrow half-width 2.25. Difficulty q=min(elapsed/120,1); obstacle slots/chunk = 2+floor(3q), except the empty initial chunk. Narrow and split transitions taper over >=20 m. Penguin radius 0.35; clamp centre to half-width minus 0.35 (banks are forgiving, no crash on clamp).
- **Speed:** acceleration a=0.1+2*grade m/s²; v'=clamp(v+a*dt, 0, 22), then multiply by exp(-0.02*dt) when abs(steer)>=0.75. Initial speed 8; normal cruise ramps toward 22. A crash sets v=0.6*v and stops forward movement for 1 s; afterwards acceleration resumes without resetting to 8. Lateral velocity = 4*steer m/s, with no inertial drift; in air lateral steering still works. Cosmetic bank never changes score or speed.
- **Obstacles:** ice radius 0.6, snowman radius 0.5, crack radius 0.6 in (s,d). Penguin collision circle 0.35. Use `circlesOverlapXZ` with x=s,z=d, plus swept closest-approach checks over each substep (including first entry into an airborne interval) to avoid tunnelling. Non-crack obstacles collide below height 1.0; cracks below 0.15. One crash per contact group; 1 s tumble is invulnerable, movement frozen, air/spin cleared, nearest safe corridor position restored. Third crash ends immediately. No hidden collider inferred from meshes.
- **Fair generator:** reserve a continuous hazard-free centre corridor of width 1.2 (penguin diameter 0.7 plus margin 0.5); within splits reserve it on both branches. Safe corridor centre may shift <=1.5 m per 20 m, starts at the prior exit centre, and includes gate aperture and taper. Obstacle footprints including penguin radius cannot overlap it. Cracks cover only optional side routes, never the mandatory corridor. Hazards have >=12 m longitudinal separation and >=20 m preview. Validate swept reachable intervals at v=22, lateral limit 4, and all width transitions; 16 candidate attempts then a tested straight safe fallback with identical event budgets. Fish mark the safe corridor; the solver may ignore optional ramps/tricks. No unavoidable hop or spin is required.
- **Hop/ramps:** manual hop lasts 0.6 s, height h=4*0.5*u*(1-u), u=airTime/0.6. Grounded ramp entry launches once; ramp airtime T=0.6+0.6q, height h=4*1.2*u*(1-u), u=airTime/T. An existing hop does not relaunch at a ramp. No queued jump and no repeated launch while overlapping a ramp.
- **Spins:** ramps only; signed yaw integrates 600 degrees/s * steer, manual hops cannot score spins. Successful landing requires wrapped yaw within 30 degrees of forward (inclusive). Spins=floor(abs(netYaw)/360), capped at 2 (T<=1.2, rate<=600). Landing rewards 50*spins; a double is +100 total, not +100 extra. Failed landing crashes and awards zero. Direction reversals cancel rotation, preventing oscillation farming.
- Changed from spec: clarify double-spin wording as +100 total and confine tricks to ramps, so unlimited manual-hop farming cannot undermine the limits.
- **Fish:** <=12/chunk across both split branches, >=3 m apart longitudinally, none before s=60. Circle pickup radius 0.55 including penguin reach, vertical tolerance 0.6; magnet-free. Trails on the safe line or optional ramp arcs; one pickup/ID, expire behind player. No reward spawned by cosmetics.
- **Gates:** full safe-corridor aperture (half-width 1), first s=120; each next spacing=120+60*min(gateIndex/10,1), gateIndex=0 for first-to-second interval. Crossing on selected branch while abs(d-gateCentre)<=1 gives +8 s once; missed gate expires, never respawns. No points for gates. Flags are not collision objects.
- **Assist:** ready-card checkbox "Auto-hop cracks", default on for coarse pointer, off otherwise; accessible keyboard toggle, frozen for the run. When grounded with a projected crack hit <=0.1 s away, issue the same hop as `jumpPressed`; manual input wins ties. No assist score multiplier or separate leaderboard; safe corridor still works with assist off.

## Scoring

`runScore = floor(s) + 10*fishCollected + trickPoints`; `trickPoints` sums 50*successfulRampSpins. Publish score deltas through `addScore`, reconcile with `setScore` at end; no `finalScore` override, duration is shell elapsedMs. Distance awarded only for actual forward arc-length travel; no points during tumble. Fish/trick popups "+10", "+50 spin", "+100 double".

### Server limits and why they hold (the proof)

| Limit | provisional (task / 02 §C.4) | proposed, Claude-owned limits PR |
|---|---|---|
| maxScore / max_score | 75000 | **18700** |
| duration | 3000–900000 ms | **3000–182000 ms** |
| base / max_pps | not supplied in allowed inputs | **440 / 104** |

For t<=180, s<=22t<=3960. A conservative count of chunks touched is floor(s/60)+1<=67 (includes empty first chunk and boundary rounding). Fish<=12*67=804, ramp awards<=100*67=6700: score<=3960+8040+6700=18700. For any t, score<=s+220*(floor(s/60)+1)<= (1+220/60)*22t+220 =102.667t+220, below 440+104t. The extra 220 base covers a whole event batch and frame-end rounding; `capScore` remains a safety net and must be a no-op for legal runs.

Earliest loss needs 3 hazards: first centre >=60, subsequent centres >=12 apart, earliest contact >=84-(0.6+0.35)=83.05 m; even ignoring two tumbles, t>=83.05/22=3.775 s. No initial hazards and timeout>=30 s; earliest ceiling 180 s. Thus 3000 ms minimum holds. Clock ceases at the exact event; shell duration may include the enclosing <=50 ms frame, safely below 182000 ms. Build tests must verify that store duration, including final frame, never rounds below 3000 ms.

Proof plan: assert ds<=22*dt for every step, chunk-wide reward budgets and non-replay IDs across recycling/splits; drive fastest-reward and earliest-loss bots via `createArcadeStore`, `advanceRunClock`, `playedFrameDt` at 60/20 fps and random 4–300 ms raw frames (store clamp respected), including pause/countdown boundaries. Check every terminal result with `withinServerLimits`, and capScore unchanged. Report measured best score/duration after build; analytic maximum intentionally overcounts unreachable simultaneous rewards. Claude must update both meta.scoring and arcade-games.json together before submission can go live.

## Run end

- `end("lose")` immediately on third crash; `end("timeup")` when remaining hits zero or elapsed reaches 180 s. No `"win"`. Gate at exact expiry cannot rescue the run.
- `resultDelayMs: 1200`; freeze rules immediately, use game time for the final tumble or gentle coast visual only. Shell owns result, Retry/Exit and API access.

## Scene and camera

- **Follow chase, pitch 25 degrees, yaws [0] in track-local coordinates**: keeps upcoming hazards readable and left/right consistent in portrait and landscape. Floating origin keeps penguin at local s=0; recycle previous chunk without camera jumps. Compute world frame from `tangentAt`; rotate the fitted offset with that frame, never rotate input axes with the screen.
- `useFittedView`: local area x=[-5,5], y=[0,4], forward=[-4,32]; pitch=25*pi/180, yaws=[0], padding=2, margin={top:0.11,bottom:0.08,left:0.03,right:0.03}, shift=true, fov=50. `followFocus` and `CameraRig` share lookAt=[0,0,10], reach/bounds of this local box and fraction=0.25; damping=6. Fit this box around the moving focus each update; distance grows by factor 1+0.2*(v/22), never closer than the fit.
- Cosmetic camera roll <=3 degrees; body/track bank <=12 degrees (`bank`, reference gravity 9.81). Disable camera roll and speed pullback for reduced motion. Penguin belly rotated 90 degrees, lifted from measured belly bounds to track+0.01; add air height and tangent orientation. No rig/T-pose requirements for this solid creature.
- `environment`: background="#bae6fd", fog=["#bae6fd",35,85], lighting="snow". SkyDome, SnowFall count=300, ice/snow banks, pines, optional procedural arch cave and frozen-lake scenery have no rules colliders. Fog conceals next-slot end at least 60 m ahead. No Rapier.

## Core helpers used

`GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`); `createRng`/`rngNext` (chunk seeding), `randomSeed` (Scene only); `createPath`, `advance`, `pointAt`, `tangentAt`, `createPathGraph`, `advanceGraph`; `substep` (chosen over fixedStep to consume all timed dt); `bank`, `hop` (cosmetic), `spring`, `squashStretch`; `circlesOverlapXZ`; `useFittedView`, `followFocus`, `CameraRig`, `useSafeArea`; `Model`, `InstancedModel`, `DynamicInstancedModel`, `Instanced`, `BlobShadow`, `useCanvasTexture`; `EXPANSION_ASSETS`, `EXPANSION_GLB_SIZE`, `REUSED_ASSETS`; `useFx` (`warm`, `burst`, `score`, `shake`), `useCameraShake` via fx; `SkyDome`, `SnowFall`, snow lighting; `useQuality`, `scaledCount`, perf probe `?perf=1`, `TargetMarkers` (one upcoming gate target); `withinServerLimits`, `capScore`; real-store clock helpers above. No generic helpers copied into the game; the generator, track-space collision sweep and event ordering are game-specific.

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

`meta.ts` (controls, scoring, dev status) · `index.tsx` (definition, ready assist checkbox) · `rules.ts` (seeded chunks, speed, steering, hop/spin, collisions, gates, clock, scoring) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (fits/belly clearance) · `Scene.tsx` (one run callback, camera, penguin, fx/audio) · `Track.tsx` (three reusable chunk slots and instances) · `Primitives.tsx` (fallbacks and procedural props) · `Hud.tsx` + `Hud.module.css` (assist/clock labels using existing CSS vars, data-arcade-safe-area) · `assets.spec.json` · `README.md` · `public/images/3d/penguin-slide.webp` · `tools/thumbs/inputs/penguin-slide.mjs`. No poses.ts needed for a solid model; no classic engine/progressStorage imports.

## Test plan

`rules.test.ts` <=~600 lines; test behaviour and bounds, not copies of core algorithms.

- Determinism: same seed/input timeline identical, including recycled chunks; initial safe zone, bounded 16 attempts/fallback, branch seams, widths, obstacle spacing, fish/ramp budgets and unique IDs. Inject invalid candidate for each invariant.
- P-15 fairness: full-lookahead solver survives 180 s on 500 seeds with assist off and no tricks, including narrow/split transitions at forced v=22; verify reserved corridor analytically for every accepted candidate, plus fallback. Solver shares legal movement/action limits, not collision immunity. Distinguish collision survival from timeout; standard-clock solver must also catch enough gates to survive the full 180 s on all 500 seeds; any timeout before the ceiling fails the generator acceptance check.
- Speed/steer: cap 22, carve decay, crash 60% and 1 s freeze, edge clamps, diagonals irrelevant, taps/holds/opposed inputs, dt partition, swept collisions at maximal speed. No movement or timer change while paused/over.
- Air: hop 0.6 s, ramps 0.6–1.2, no relaunch, crack clearance, assisted vs manual hop, spins/reversals, ±30-degree success and just-outside failure, zero/single/double scores, no manual-hop reward.
- Gates/time: first 120, spacing formula, one award, miss, branch duplicate prevention, exact expiry ties, terminal third crash, ceiling; no win path. Fish radius/vertical limits, one pickup, distance floor, scoring/event order and all server proofs/bots above.
- `assets.test.ts`: measured sizes, belly lowest point within 1 cm of banked track at rest, no prop-based collision inference; primitive fallbacks and shared GLB failure visually checked.
- Build/browser later: common 03 criteria, ready/countdown/pause (Esc/P/tab)/over/Retry/Exit, keyboard and 390x844 touch/banner open; screenshots 1280x800, 390x844, 844x390, banner closed too; hazards never hidden, no z-fighting. npm build, tsc, vitest, gamecheck as common build DoD, not this documentation task.

## Performance

Target **50 draw calls**, hard game cap **55**, <=150 platform cap. Budget: track/banks 6, obstacles/borders 6, fish <=3, trees <=6, flags/posts <=6, penguin/fallback <=5, sky/snow/lake/arches <=6, blobs 1, speed lines 1, fx pools 3, score sprites <=2 =45; reserve 5 for real shared mesh splits. Cosmetic simplification required if imported GLBs exceed reserve.

Exactly 3 chunk geometry slots, preallocated position/index buffers and instance matrices: <=36 fish, 15 obstacles, 30 trees (10/chunk, scaled cosmetically), 6 gate flag pairs, 3 ramps. Warm sparkle/snow/splash/score pools once; rate-limit carving snow to 10 bursts/s, fish popups coalesced per 0.2 s, at most 2 active score sprites. One canvas ice texture, no per-chunk materials/textures, no retained chunk history. Regenerate path objects only on recycling, release references immediately; dispose mount-owned resources on unmount. No per-frame allocations or dynamic lights; snow preset only, blob shadows.

P-15 memory acceptance: record geometries/textures/programs and JS retained heap after warm-up at 30/60/120/180 s; GPU counts constant, no upward retained-heap trend after GC at identical checkpoints. Retry x10 returns counts to baseline. Measure ?perf=1 p95 on mid-phone profile and calls with all effects active; report numbers after build. Quality reduces trees/snow/fx only, never hazards, fish or gate geometry.

## Audio

P-06 designed API: `startLoop("slide")` while playing, shell stops on pause/over/mute; proposed pitch tracks 0.8+0.6*v/22 when loop API supports updates. `playSfx(name, { pitch, pan, volume })`: carve scrape, fish gulp, ramp whoosh, landing thump, gate chime, crash bonk (P-06 cues). Adopt exact cue identifiers from P-06 when merged; no guessed new cue keys in implementation. Fallback now: fish "pickup", gate "chime", crash "hit"; silent continuous slide/carve and optional ramp/landing cues. Visual feedback fully communicates each event.

## Accessibility

Coral hazard silhouettes plus dark crack shape (not colour alone); fish show a safe route, gate aperture mint ring and +8 s HUD flash; air landing alignment arrow and circular ±30-degree window. Assist checkbox is labelled/focusable on ready card and usable with keyboard. Hop touch target 72 px. Clock numeric plus low-time pulse at <=5 s (steady outline under reduced motion); crash count icons and text. Mute leaves full visual feedback. Reduced motion disables camera roll, speed lines/pullback, reduces snow and uses core shake preference; rules stay identical.

## Risks and open questions

- New steer scheme registration and server metadata are Claude-owned; implementation cannot edit those files without a separate owner task. Limits above are design proposals, not changes to live metadata.
- Chase fit in rotating local coordinates and floating-origin seams need portrait/banner QA before tuning; never solve readability by hiding hazards or changing scoring speed.
- Chunk retry acceptance and real GLB mesh counts require measurement; fallback guarantees fairness even if random candidates all fail. Gate spacing can legitimately exhaust the clock before 180 s; optional reward routes need not be feasible together.
- P-06 cue names/loop pitch updates await merged API; fallback above is complete. No assets credits needed.
- Open questions for Claude/user: approve the explicit 180 s ceiling and proposed limits (18700, 3000–182000 ms, base 440 / pps 104); confirm/add core `steer` registration; confirm P-06 cue identifiers/update API when merged. These are ownership approvals, not unspecified gameplay choices.

## Status

(empty until the build)

