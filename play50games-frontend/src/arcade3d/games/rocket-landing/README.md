# Rocket Landing Challenge

Owner: Codex. Slug: `rocket-landing`. Skill game 20, wave 2, complexity 3. Gate G0 design for approval; no implementation or measured bot results. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §20; asset ids: 05 §E.4. Units: metres, seconds, radians; x right, y up, z=0 gameplay plane. Positive theta tilts thrust toward -x, matching core kinematics.

## Concept

Feather a chunky white toy rocket's engine, cancel drift and land upright on five alien worlds. Three lives cover the whole campaign; a crash repeats the current planet. Different gravity, narrowing pads, wind and a moving pad make each landing a new control problem. Accent `#fda4af`.

## Controls

`meta.ts`: `scheme: "flight"`, `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Thrust" }`.

- `keyboard`: "A / D or left / right to rotate; hold Space, W or up to thrust".
- `touch`: "Joystick left / right to rotate; hold Thrust to fire the engine; release the joystick to auto-level".
- Held `moveX` clamped to [-1,1] rotates; thrust = `jump || moveY > 0.5`. Core W/up sets moveY; Space and the labelled Jump button set jump. Joystick upward also thrusts by the same mapping (intentional, disclosed by the in-game hint "Joystick up also thrusts"). Negative moveY does nothing. No `inputToWorld`: the axes are screen-horizontal and engine-on, independent of camera yaw.
- Ignore `pressed`, taps, drag, pointer and action: these are continuous controls, not discrete moves; no press/event is consumed twice. Opposed horizontal held keys yield zero. Esc/P and hidden-tab pause are shell-owned.
- Changed from spec: label Jump "Thrust", accept up alongside W, and document joystick-up thrust because existing InputState combines keyboard and joystick axes; no new input routing or fields. Auto-level is fixed per run from coarse-pointer capability, with no toggle; desktop release only damps rotation.

## Rules

All values below are named constants in pure `rules.ts` (`BODY`, `ENGINE`, `PLANETS`, `CONTACT`, `TRANSITION`). No Rapier or mesh-derived terrain collisions. One `useRunFrame` samples input and calls the cached fixed-step callback.

- **Integration:** `createFixedStep(1/120)` once; `fixedStep` and `stepRigidBody2D` for {x,y,angle,vx,vy,omega}, unit mass/inertia. Played dt <=0.05 means at most 6 steps (below core's 8-step drop limit); residual <1/120 carries forward and is never cleared on planet/attempt changes. For a constant tick-input timeline, frame partitions yield identical state; live input is frame-sampled, so differently timed input is not claimed identical. Pause adds no dt. Terrain/pad/forces use simulated played time, not wall time.
- **Engine:** binary thrust acceleration 12 along local +y, no thrust when fuel=0; burn 10 units/s only for actual engine-on time. At a fuel-empty crossing split that tick into powered/unpowered intervals so the last fraction is neither free nor lost. Linear speed vector capped at 12 after integration; no linear drag. Angular torque `-3*moveX - 4*omega`, omega capped at +/-1.5 rad/s; wrap angle into [-pi,pi). On coarse pointers, neutral abs(moveX)<=0.05 substitutes torque `clamp(-8*theta - 4*omega,-3,3)`; active input keeps manual torque. Neither mode forces the angle directly or changes landing thresholds.
- **World:** x [-12,12], y [-1,22]; touching a boundary with the collision polygon crashes (no clamp/bounce). Pad top y=2, thickness0.4, z depth2. Rocket spawn centre (0,16), angle/vx/vy/omega=0. Terrain top is a polyline sampled every 2 m from x=-12 to12, heights seeded in [-0.5,0.5], extruded depth3 down to y=-2. Pad floats clear of it. Background planets are not colliders.

| planet | gravity | pad width | pad centre x | starting fuel | obstacle / force |
|---|---:|---:|---|---:|---|
| Moon | 1.6 | 6 | seeded [-1,1] | 100 | none |
| Desert | 3.7 | 5.5 | seeded [-1,1] | 100 | none |
| Ice | 5 | 5 | seeded [-1,1] | 95 | none |
| Gas moon | 2.5 | 4.5 | seeded [-1,1] | 90 | wind ax=0.4*sin(2*pi*t/8+phase) |
| Asteroid | 1 | 4 | base seeded [-0.5,0.5] + sin(2*pi*t/12+phase) | 85 | moving pad; cavern pillars |

- **Attempt time t:** starts0 at every spawn; wind/pad phases seeded [0,2*pi), fixed for that planet and reused on retry. Pad velocity is analytic derivative (asteroid max pi/6 m/s). Asteroid pillars are solid rectangles x[-10,-5] and [5,10], y[0,12]; ceiling slabs x[-10,-4] and [4,10], y[12,13]. Central shaft width8 remains open from spawn to pad; this is a forgiving cavern entrance, not a sealed roof. Terrains/pad positions are generated once per planet per run; retries cannot reroll difficulty.
- **Generator:** fixed gameplay obstacles and bounded seeded decor/terrain; reserve x[-4,4] clear above y0.5, including all pad swept positions plus a 1.1 m body margin. Validate bounds, pad/terrain clearance and corridor; 16 candidate attempts then literal flat-terrain fallback with pad base0 and phase0. Reject invalid candidates; fallback must satisfy the same rules. Seeded layout changes terrain and approach offset, not gravity or reward budgets.
- **Rocket collision:** target height2.2, centred logical body; game-authored convex hull of transformed four `ROCKET_FEET_GLB` points projected into XY plus body silhouette vertices (-0.45,-0.75),(0.45,-0.75),(0.45,0.55),(0,1.1),(-0.45,0.55). Feet and silhouette must fit local x/y +/-1.1 after the measured fit; tests fail if they do not (do not silently rescale physics). Projection of all four feet forms the landing support span, including legs at different z. Real GLB/fallback uses the same logical transform; no cosmetic bob shifts collision.
- **Contact:** test swept transformed hull edges/vertices against terrain, cavern rectangles, world boundaries and pad top/sides/bottom each tick. Resolve earliest time of impact by conservative angular sweep subdivision: <=0.002 m maximum hull-point travel per slice (radius bound1.56, speed12, omega1.5), then bisection12 iterations within the first crossing slice. This is game-specific rotating polygon/lander grading, not a copied generic physics engine. Evaluate interpolated body and analytic pad at contact time; tangent terrain contact counts as crash. Simultaneous pad/terrain/hazard contact is a crash.
- **Landing:** first contact must be a foot against pad top, descending relative to it, every projected foot x within inclusive pad edges, and no body contact with a side/underside/hazard. Require strict abs(vy)<2, abs(vx-padVx)<1, abs(wrapped theta)<10*pi/180; equality crashes. No omega threshold: retain the spec's three gates. Freeze the whole body on first valid contact, placing the lowest foot on top and retaining impact tilt (other feet may be above it); do not require four simultaneous contacts. Zero relative vertical speed is allowed for a top-contact fixture. An invalid first contact crashes once, never bounces into a valid landing.
- **Attempts/events:** initial lives3. Crash reduces lives by1, clears clean-run flag and freezes rules motion; with lives remaining, hold1.2 played seconds then reset pose/fuel on the same planet. Successful landing awards once, increments completed, then holds1.2 played seconds before spawning next planet. Held input may carry into the new attempt; it cannot act during a hold. Lives never refill; fuel refills only on spawn. Fuel-empty alone is not an end: coasting can still land or crash.
- **Clock/order:** `durationMs: 240000`; shell timeout precedes the game callback. Within a tick fuel split, earliest contact, then award/life decrement, then transition; carry unconsumed tick time into the hold/next attempt. Clock continues through holds. Stop processing on end. HUD: Planet n/5, Lives n/3, Fuel rounded down, relative horizontal/vertical speed and tilt.
- Changed from spec: 60 s is an expected campaign length, not a legal minimum; hard240 s timeout prevents indefinite flight. Lower starting fuel95/90/85 resolves progression's conflict with "100 per landing"; fuel score normalizes to that attempt's initial budget. Optional fuel-cell pickups are omitted to keep fuel/score finite. The asteroid combines moving pad and an open cavern approach; seeded geometry cannot seal the route. Moving-pad vx is measured relatively because contact safety depends on drift against the pad.

## Scoring

On a valid landing, `soft = clamp(floor(200*(1-abs(vy)/2)),0,200)`; `centre = clamp(floor(150*(1-abs(bodyX-padX)/(padWidth/2))),0,150)`; `reserve = clamp(floor(150*fuelLeft/startFuel),0,150)`. Snapshot impact position, velocity and remaining fuel before freezing. Award `soft+centre+reserve` once per planet. `runScore = sum(landingAwards) + (completed===5 && crashes===0 ? 300 : 0)`; add the clean bonus only on final win. No crash/time/flying points, no score on an unsuccessful touch. `addScore` events, final `setScore(runScore)` reconciliation, then `end`; no finalScore override. HUD shows the three components during the hold; popup "+N landing" clear above the body.

### Server limits and why they hold (the proof)

Propose **maxScore2800; minDurationMs2000; maxDurationMs242000; base800; max_pps420**. Provisional numbers from 02 §C.4 were not supplied in the permitted read set: do not invent a comparison. Claude must pair `meta.scoring` with the server entry, disabled until go-live.

1. Each component is bounded200/150/150; five distinct single-use planets imply score<=5*500+300=2800. Crash retries cannot replay a completed planet or restore the clean flag. Maximum is conservative, not a promise a fueled descent can attain it.
2. For n awarded landings, the n-1 success holds consume >=1.2*(n-1) played seconds without awards. Therefore n<=1+t/1.2 and score<=500+(500/1.2)*t+300<=800+420*t. This includes live partial scores and the final clean bonus; failed-attempt holds only increase elapsed time. Fixed-step simulated time never exceeds store played time.
3. Lose requires three crashes and two completed1.2 s retry holds: elapsed>=2.4 s even allowing instantaneous crashes. Win requires four1.2 s success holds: elapsed>=4.8 s. Timeout is exactly240 s. Thus all submitted terminal reasons fit2..242 s (0.4 s lower and2 s upper margins); result delay is excluded from elapsedMs.
4. Pin constants, prove award uniqueness/hold accounting on adversarial fixtures and drive controller/idle/spam bots through `createArcadeStore` + `simulateRun` (`advanceRunClock`, `playedFrameDt`). Assert the inequalities at each award, `withinServerLimits` on every terminal result and `capScore` unchanged. Raw stalls are clamped by the store, not fed directly into fixedStep. Record actual fastest/slowest win, highest score, fuel margins and reasons after build; no measurements claimed at G0.

## Run end

- `end("win")` immediately on fifth valid landing after final award/clean bonus; no fifth hold before end.
- `end("lose")` immediately on third crash, after decrement; previous landing points retained, no clean bonus.
- Shell `"timeup"` at240 s even during transition; contact on that frame earns nothing. No manual API/localStorage calls.
- `resultDelayMs: 1200`; frozen body, dust/confetti or sparks/debris animate with game time only. No score/motion during delay; shell owns submission, Retry and Exit.

## Scene and camera

- Side view along +z toward z0, **pitch0, yaws[0], fov35**, no camera roll; fixed orientation lets tilt and vertical speed remain readable. `useFittedView` area is the AABB union of the rocket hull and whole pad, enlarged0.5 m in x/y, z[-1.5,1.5]; initial bounds at most x[-4.1,4.1], y[1.1,17.6]. `shift:true`, padding4 CSS px, margins top/bottom0.04, left/right0.03, all safe-area avoidance enabled.
- Follow the union centre using `CameraRig` fraction1, bounds x[-12,12], y[-1,22], damping12. `followFocus` uses the same centre/reach/bounds/fraction; translate fit area into that local frame and include both current eased aim and requested aim in the fit's focus range, so lag cannot crop either subject. Refit on cached union bounds quantized outward in0.25 m increments (at most10 Hz plus immediate expansion), and on safe-area/viewport changes. Fit both subjects every frame; expansion snaps, contraction may ease at4/s but never below the required distance. No independent camera pose writer. Snap/reset centre/fit on respawn.
- Phone acceptance: rocket2.2 m / initial vertical span16.5 m gives about53 CSS px in a400 px free-height band; narrowest4 m pad remains wider. This is an estimate, not a safe-area measurement. Require rocket's projected height and pad's projected width >=24 CSS px at390x844 with banner open, including maximal legal separation. If safe area cannot satisfy both at extreme flight height, use registered game HUD panel with a fixed80x80 CSS px orthographic rocket/pad schematic and numeric separation (no gameplay mesh inflation); keep world view fitted. Verify844x390 separately. `TargetMarkers` handles targets occluded by temporary HUD/resize, not a substitute for the pad fit.
- Pad top ring/guide are depthWrite=false, top y=2.04 (0.04 above surface), lights at2.08; terrain outline0.03 above its surface. Vertical leg-to-pad guide uses dashed white, mint check when all landing gates hold, coral cross otherwise; speed gauges show pad-relative drift. Label/score offsets >=0.3 m above the hull, projected/clamped to registered safe HUD band so no overlay lies on the pad/rocket.
- Environment background `#020617`, lighting `"space"`, no fog obscuring contact. `Starfield` count600 (quality-scaled); up to2 background spheres radius3/5 at z=-20/-30. Planet palette moon `#d6d3d1`, desert `#fdba74`, ice `#bae6fd`, gas `#c4b5fd`, asteroid `#78716c`. Flames yellow `#fde047` to orange `#f97316`.

## Core helpers used

`GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `useArcadeStore` (`addScore`, `setScore`, `setStat`, `end`), `createFixedStep`, `fixedStep`, `stepRigidBody2D`, `createRng`/`rngNext` (`randomSeed` Scene only), `useFittedView`, `followFocus`, `CameraRig`, `useSafeArea`, `Model`, `Instanced`, `useCanvasTexture`, `EXPANSION_ASSETS.rocket`, `EXPANSION_GLB_SIZE.rocket`, `EXPANSION_GLB_POINTS.rocketBell`, `ROCKET_FEET_GLB`, `Starfield`, `space` lighting, `useFx` (`warm`, `burst`, `score`, `shake`), `useQuality`, `scaledCount`, `TargetMarkers`, `startLoop`, `playSfx`, `withinServerLimits`, `capScore`; test-only `createArcadeStore`, `simulateRun`, `fixedFrames`, `randomFrames` from core/testing/botHarness. No aim helper needed for binary thrust; gauges are game-specific DOM stats in a registered HUD, not a guessed core gauge API. Rotating polygon/contact grading is local; core owns integration, pools, environment, camera and run harness.

## Assets

No generation: rocket already imported. `assets.spec.json` records only the owned rocket's catalog recipe, never authorizes another Hyper3D call; shared battery is excluded.

| id (05 §E.4) | class / source | target / budget | fallback |
|---|---|---|---|
| rocket | A, `EXPANSION_ASSETS.rocket`, rocket-landing/rocket.glb | 2.2 m tall from measured size; <=5k tris,512 texture,300k bytes target | rounded cylinder/nose, red band, porthole, fins/feet; same fitted bell and support points |
| fuel cells | D, `SHARED_ASSETS.battery` | optional catalog asset; not mounted, no pickups | none needed |
| terrains, pads, planets, stars, flame | B, procedural / core env/fx | dimensions above; terrain13 polyline vertices, pad depth2/thickness0.4; flame length0.8 while powered,0 off | code |

`assets.ts` transforms imported feet/bell with exactly the model's scale/centre/orientation; flame origin equals `rocketBell`, never a guessed y offset. Body axis +y, rotate about z by theta. No GLB flame/pad. Cavern rocks, pad legs, lights and terrain textures are code. Additive flame cone is game-specific engine drawing; pooled smoke/sparks come from core fx (no invented core Flame component). All support/GLB dimensions tested before tuning the contact polygon.

## Files

`meta.ts` (exact controls/limits, dev status) · `index.tsx` (definition, coarse-pointer assist fixed per run) · `rules.ts` (planets, fuel, integration, swept polygon/contact, attempts/score; pure) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (measured GLB/bell/feet fits) · `Scene.tsx` (one run callback, fitted follow, model/fx/audio) · `Planet.tsx` (one terrain/pad/cavern, shared buffers) · `Primitives.tsx` (fallback rocket, engine cone) · `Hud.tsx` + `Hud.module.css` (gauges, optional schematic, safe-area registration, existing CSS vars) · `assets.spec.json` · `README.md` · `public/images/3d/rocket-landing.webp` · `tools/thumbs/inputs/rocket-landing.mjs`. This task writes only README/assets spec; future files require a build hand-off. No classic GameEngine/progressStorage imports.

## Test plan

`rules.test.ts` <=~600 lines, including local controller bots; no generic harness copies or per-tick matcher allocation. Aggregate invariant maxima then assert per run. Whole rules/bot suite target <60 s; if slow, reduce redundant trajectories, retain proofs and every planet/mode/frame schedule.

- Pin every gameplay constant; generator determinism/validity on256 seeds plus literal fallback and invalid fixtures. Same input tick timeline under60/20 fps/random4..50 ms frames gives identical fixed-tick state/events and residual; test pause/countdown/stalls through the real clock. Never exercise core's overload path with unclamped live dt.
- Exact landing gates at1.999/2,0.999/1,9.999/10 degrees, both signs; pad-relative moving contact, entire foot-span edges, body/side/underside first hits, polygon/terrain/cavern tangencies, high-speed angular sweeps, contact-time interpolation and simultaneous hazards. Sweep tolerance <=0.002 m, landing plane error <=0.002 m; visual feet within0.01 m of pad.
- Fuel burn10/s,85..100 budgets, final fractional powered tick, zero-fuel coast, no negative/recharge-farming, binary flame parity; torque sign, omega/speed caps and both assist modes. Crash once per attempt, two retries only,1.2 s holds carry tick remainder, same seeded retry, fifth win/third loss, clock timeout wins ties, pause/over immutable.
- Every score component's floor/clamp endpoints, clean bonus once, zero bonus after any crash, partial/timeup retention, one reward/planet and reconciliation not additive; finite/rate/duration proofs above on adversarial contact/transition fixtures. No need to attain conservative2800 analytically.
- Legal full-knowledge feedback controller uses position/velocity errors to choose tilt/rotate and pulsed binary thrust (never teleport, refill or disable collision); predict asteroid pad velocity/phase. Run16 seeds per assist mode:8 at60 fps,4 at20 fps,4 random schedules, all five planets. Require all win under240 s with positive fuel at each touchdown; report minimum reserve and per-planet timings. Additional idle/spam/early-crash bots8 seeds each at20 fps plus4 random seeds; targeted worst wind phases/lowest-fuel fixtures cover extremes. Mathematical corridor/bounds tests cover seeds beyond bot sampling; bot successes alone do not prove every seed landable.
- `assets.test.ts`: real mesh size/bell/feet transforms, XY hull envelope, fallback feet/bell parity, no model collision inference. Build/browser later: common03 criteria and keyboard/two-thumb end-to-end, ready/countdown/Esc/P/tab/over/Retry/Exit, screenshots1280x800,390x844,844x390 banner on/off,24 px sizing, clear overlays, missing GLB fallback, moving pad and flame parity. Build/tsc/vitest/gamecheck/thumbnail belong to build acceptance, not G0.

## Performance

Target **<=30 draw calls**, hard game cap35, platform cap150. Budget: rocket<=5, terrain/cavern3, pad/deck/lights4, starfield1, backdrop2, guide/rings2, cone1, smoke/dust/sparks/debris/confetti pools5, score sprites<=2 =25; reserve5 for mesh splits. One planet resident; no shadow maps, extra lights, Rapier or bloom. Core space lights only. If GLB splits exceed reserve, simplify cosmetic pad/backdrop meshes before raising budget.

Reuse terrain13-vertex top buffers and cavern geometry, one canvas texture, one rocket/pad and fixed scratch matrices/contact buffers. Warm fx kinds once; engine smoke <=8 bursts/s, <=24 particles per burst before quality scaling; touchdown puff16, crash sparks24/debris12, perfect confetti24 (soft>=190,centre>=140), maximum2 score sprites. No new resources or React renders per frame; HUD writes only changed displayed values. Quality reduces stars/fx/backdrop, never collision/pad/guide. Dispose mount-owned resources; perf probe mid-phone p95 target<=33 ms, worst calls<=35, GPU counts flat at30/60/120/240 s and Retryx10 after warm-up. All measurements pending build.

Audio: `startLoop("thrust", {volume:0})` on entry to playing; handle `.set({volume:powered ? 0.35 : 0})`, recreate after shell pause/mute stopper on resume/unmute without stacking. Rotation `whoosh` volume0.1 at input onset, cooldown0.3 s; touchdown `thud` then `chime`, crash `boom` plus coral hit feedback, low fuel `alarm` on crossing20% of initial budget once/attempt. P-06 distinct new lander cues may replace these confirmed existing names when Claude supplies identifiers; no guessed keys. Shell owns win/lose cues; mute retains all visual information.

## Accessibility

Numeric relative speeds/tilt plus mint check/coral cross, outlined fuel bar and lives text/icons, dashed guide with landing gate status: no colour-only or sound-only information. Thrust target72 CSS px and joystick allow two-thumb landing; coarse-pointer auto-level explicitly disclosed. Keyboard-only completion uses unassisted damping; same leaderboard bounds. Reduced motion disables shake, light blinking, debris/confetti and backdrop motion, retains actual rocket/pad movement and a steady engine-on cone. Every DOM HUD block uses data-arcade-safe-area and CSS Modules; no globals changes. Text >=14 CSS px, gauges >=44 px high, exact numeric thresholds shown in help.

## Risks and open questions

- Risks: actual foot projection/body envelope and mesh splits need asset tests; conservative sweep must stay fast and catch near-tangent contacts; no bot/phone/perf evidence exists yet. Fuel/headroom estimates are plausible (max gravity5 is below thrust12; free fall14 m on moon about4.2 s) but not landability results. Bots must gate implementation approval and expose any tuning change explicitly.
- Claude/user decisions: approve listed spec departures, normalized fuel scoring, coarse-pointer assist with disclosed joystick-up thrust, cavern layout, camera schematic fallback and proposed paired server limits. Claude must compare provisional02 values outside this read scope and provide any distinct P-06 cue names. Do not change core/manifest/backend here; no unresolved choice is silently assigned to the builder.

## Status
