# Rocket Landing Challenge

Owner: Codex. Slug: `rocket-landing`. Skill game 20, wave 2, complexity 3. Gate G0 design for approval; no implementation or measured bot results. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §20; asset ids: 05 §E.4. Units: metres, seconds, radians; x right, y up, z=0 gameplay plane. Positive theta tilts thrust toward -x, matching core kinematics.

## Concept

Feather a chunky white toy rocket's engine, cancel drift and land upright on five alien worlds. Three lives cover the whole campaign; a crash repeats the current planet. Different gravity, narrowing pads, wind and a moving pad make each landing a new control problem. Accent `#fda4af`.

## Controls

`meta.ts`: `scheme: "flight"`; `index.tsx` GameDefinition fields: `touchControls: ["joystick", "jump"]`, `touchLabels: { jump: "Thrust" }`.

- `keyboard`: "A / D or left / right to rotate; hold Space, W or up to thrust".
- `touch`: "Joystick left / right to rotate; hold Thrust to fire the engine; release the joystick to auto-level".
- Held `moveX` clamped to [-1,1] rotates. Fine pointers: thrust = `jump || moveY < -0.5` (Space/W/Up); coarse pointers: thrust = `jump` (Thrust button only), ignoring moveY completely. Core up is -1; diagonal joystick rotation never fires the engine. No `inputToWorld` needed.
- Ignore discrete presses/taps/drag/action; continuous input is sampled once. Opposed horizontal keys yield zero; Esc/P and hidden-tab pause are shell-owned.

## Decisions (user, 2026-10-09)

- Fine pointers use jump or negative moveY; coarse pointers use the Thrust button only, joystick rotates only. Coarse-pointer auto-level is fixed per run, no toggle, same leaderboard.
- Paired limits: maxScore2800, minDurationMs5000, maxDurationMs242000, base800, maxPointsPerSec200. Geometry below preserves these proofs; no backend/core change in this task.

## Rules

All values below are named constants in pure `rules.ts` (`BODY`, `ENGINE`, `PLANETS`, `CONTACT`, `TRANSITION`). No Rapier or mesh-derived terrain collisions. One `useRunFrame` samples input and calls the cached fixed-step callback.

- **Integration:** `createFixedStep(1/120)` once; `fixedStep` and `stepRigidBody2D` for {x,y,angle,vx,vy,omega}, unit mass/inertia. Played dt <=0.05 means at most 6 steps (below core's 8-step drop limit); residual <1/120 carries forward and is never cleared on planet/attempt changes. For a constant tick-input timeline, frame partitions yield identical state; live input is frame-sampled, so differently timed input is not claimed identical. Pause adds no dt. Terrain/pad/forces use simulated played time, not wall time.
- **Engine:** binary thrust acceleration 12 along local +y, no thrust when fuel=0; burn 10 units/s only for actual engine-on time. At a fuel-empty crossing split that tick into powered/unpowered intervals so the last fraction is neither free nor lost. Linear speed vector capped at 12 after integration; no linear drag. Angular torque `-3*moveX - 4*omega`, omega capped at +/-1.5 rad/s; wrap angle into [-pi,pi). On coarse pointers, neutral abs(moveX)<=0.05 substitutes torque `clamp(-8*theta - 4*omega,-3,3)`; active input keeps manual torque. Both torque laws bound |omega| by0.75 rad/s from rest, so the1.5 safety cap is never reached. Neither mode forces the angle or changes landing thresholds.
- **World:** x [-10,10], y [-1,20]; touching a boundary with the collision polygon crashes (no clamp/bounce). Pad top y=2, thickness0.4, z depth2. Rocket spawn centre (padX(0)+approachOffset,14), angle/vx/vy/omega=0. Approach offset is a seeded signed horizontal displacement: |dx| in[3,6] m, independent of pad width; reject |spawnX|>7.5. Spawn nose y15.1 leaves4.9 m ceiling clearance. Terrain top is a polyline sampled at13 equally spaced x values from -10 to10, heights seeded in [-0.5,0.5], extruded depth3 down to y=-2. Pad floats clear of it. Background planets are not colliders.

| planet | gravity | pad width | pad centre x | starting fuel | obstacle / force |
|---|---:|---:|---|---:|---|
| Moon | 1.6 | 6 | seeded [-1,1] | 100 | none |
| Desert | 3.7 | 5.5 | seeded [-1,1] | 100 | none |
| Ice | 5 | 5 | seeded [-1,1] | 95 | none |
| Gas moon | 2.5 | 4.5 | seeded [-1,1] | 90 | wind ax=0.4*sin(2*pi*t/8+phase) |
| Asteroid | 1 | 4 | 2*sin(2*pi*t/16+phase), phase0 or pi | 85 | moving pad; roof slab |

- **Attempt time t:** resets0; seeded wind phase and asteroid phase0/pi repeat on retries. Asteroid max |padVx|=pi/4<1. Its spawn x is seeded +/-[4.5,6] (padX(0)=0); roof rectangle x[-3,3], y[9,10] blocks descent over the pad. Enter via either side shaft x[3,8] or[-8,-3], lower centre below7.8, then steer underneath toward the moving pad. No pillars seal the lower chamber.
- **Generator/corridor:** static planets reserve x[-8,8] above y0.5; asteroid reserves that lower chamber through y8.9 plus both side shafts outside the roof. Full hull radius<=1.35 gives side-centre lanes[4.35,6.65] and their negatives; upright rocket at centre y7.8 clears roof bottom by0.1. Pad swept span x[-4,4] stays inside the chamber; terrain<=0.5 leaves pad top2 clear. Validate hull-expanded routes, spawn/boundary clearance and approach offsets. After16 rejected candidates use flat terrain, static pad0/spawn+4.5, asteroid phase0/spawn+4.5 with the same roof. Fallback must satisfy all constraints, never bypass the cavern.
- **Fuel feasibility:** thrust12 exceeds every gravity (1..5); even30-degree steering leaves vertical acceleration>=12*cos(30deg)-5=5.39. Symmetric30-degree powered transfer has horizontal acceleration6 (>=5.6 against gas wind), covering6 m in<=2.08 powered seconds before rotation/ramp allowance. Reserve <=3 powered seconds for transfer, <=2.5 for vertical braking and <=2 for hover/turn corrections: <=7.5 s/75 units versus minimum85. Asteroid's longer coast/under-roof route uses the low gravity1, pad speed<1 and >=1 s burn reserve. These are conservative control-budget targets, not executed trajectory evidence: future deterministic witness/controller tests must validate joint clearance, switching times and positive reserve for every seeded extreme in both assist modes; any failure blocks implementation acceptance, rather than silently tuning fuel.
- **Rocket collision:** derive the convex XY hull from every projected GLB vertex after the exact2.2 m fit in `assets.test.ts`, including fins, all four feet and foot pads; commit the resulting vertices as constants in `assets.ts`/`rules.ts`. Expected width1.30*1.16=1.508 m (half0.754), not +/-0.5. Assert every transformed mesh vertex is covered within0.02 m and radius<=1.35; no accepted visual overhang. Fallback mesh fits the same hull/feet/bell; asset failures require explicit design retuning, never silent rescaling.
- **Contact:** swept-AABB broad phase over rocket/pad motion, expanded for angular motion; candidate obstacles only. Subdivide maximum relative hull-point travel into <=0.025 m slices (<=0.12 m rocket travel/tick plus pad motion; about5-6 slices, not60), then12-step bisection only in the first crossing slice. Obstacles thickness>=0.4 m cannot be traversed in one1/120 tick. Test swept edge/vertex crossings and tangencies within each slice, including rotation, rather than relying solely on overlapping endpoints. Evaluate analytic pad/interpolated body at earliest contact; simultaneous hazard contact crashes.
- **Landing:** first contact must be a foot against pad top, descending relative to it, every projected foot x within inclusive pad edges, and no body contact with a side/underside/hazard. Require strict abs(vy)<2, abs(vx-padVx)<1, abs(wrapped theta)<10*pi/180; equality crashes. No omega threshold: retain the spec's three gates. Freeze rules at impact; during the hold visually rotate/translate about the contacting foot onto the second foot (gap derived from the committed feet: about 0.26 m at 10 degrees, 1.508*sin10), with no score, collision or physics changes; do not require four simultaneous contacts. Contact must be strictly descending (relative vy < 0), so softness tops out at 199. An invalid first contact crashes once, never bounces into a valid landing.
- **Attempts/events:** initial lives3. Crash reduces lives by1, clears clean-run flag and freezes rules motion; with lives remaining, hold1.2 played seconds then reset pose/fuel on the same planet. Successful landing awards once, increments completed, then holds1.2 played seconds before spawning next planet. Held input may carry into the new attempt; it cannot act during a hold. Lives never refill; fuel refills only on spawn. Fuel-empty alone is not an end: coasting can still land or crash.
- **Clock/order:** `durationMs: 240000`; shell timeout precedes the game callback. Within a tick fuel split, earliest contact, then award/life decrement, then transition; carry unconsumed tick time into the hold/next attempt. Clock continues through holds. Stop processing on end. HUD: Planet n/5, Lives n/3, Fuel rounded down, relative horizontal/vertical speed and tilt.
- Changed from spec: 60 s is an expected campaign length, not a legal minimum; hard240 s timeout prevents indefinite flight. Lower starting fuel95/90/85 resolves progression's conflict with "100 per landing"; fuel score normalizes to that attempt's initial budget. Optional fuel-cell pickups are omitted to keep fuel/score finite. The asteroid combines moving pad and a side-entry cavern approach; seeded geometry cannot seal the route. Moving-pad vx is measured relatively because contact safety depends on drift against the pad.

## Scoring

On a valid landing, `soft = clamp(floor(200*(1-abs(vy)/2)),0,200)`; `centre = clamp(floor(150*(1-abs(bodyX-padX)/(padWidth/2))),0,150)`; `reserve = clamp(floor(150*fuelLeft/startFuel),0,150)`. Snapshot impact position, velocity and remaining fuel before freezing. Award `soft+centre+reserve` once per planet. `runScore = sum(landingAwards) + (completed===5 && crashes===0 ? 300 : 0)`; add the clean bonus only on final win. No crash/time/flying points, no score on an unsuccessful touch. `addScore` events, final `setScore(runScore)` reconciliation, then `end`; no finalScore override. HUD shows the three components during the hold; popup "+N landing" clear above the body.

### Server limits and why they hold (the proof)

Use **maxScore2800; minDurationMs5000; maxDurationMs242000; base800; maxPointsPerSec200**. Claude must pair meta/server entries before go-live.

1. Five single-use awards<=500 plus clean bonus300 give2800. Real descending softness tops out199 and every planet needs a braking burn; true best is below the bound (about2730 is an estimate, not measured). Retries never replay completed planets or restore clean status.
2. Spawn centre14 to upright contact centre3.1 drops10.9; allow rotated hull radius1.35, so any contact requires centre drop>=10.65. Downward acceleration<=g+12<=17 gives flight>=sqrt(2*10.65/17)=1.119 s (even inverted thrust; speed cap only delays).
3. Award n occurs at t>=1.119*n+1.2*(n-1). For n=1..4, 500*n<=800+200*t; at n=5, t>=10.395 s gives2800<=2879. Thus partial awards and final bonus satisfy800+200*t; crashes/holds only add time. Fixed simulated time never exceeds store played time.
4. Fastest loss route is three Moon ceiling crashes: nose15.1 to ceiling20 is4.9 m, upright net acceleration10.4 gives sqrt(2*4.9/10.4)=0.971 s; 3*0.971+2*1.2=5.312 s. Rotation increases ceiling clearance and reduces upward acceleration; side boundaries from |spawnX|<=7.5 require rotation first, terrain/pad are farther, and other planets cannot precede a Moon outcome. Pin and adversarially test these competing first-contact bounds. Fastest legal win is expected around23 s, unmeasured; proven lower bound10.395 already exceeds5. Timeout240 s fits242 s; result delay excluded.
5. Future harness checks each award/terminal against these inequalities, `withinServerLimits` and unchanged `capScore`; record fastest/slowest wins/losses, highest score and fuel margins. No bot measurements claimed at G0.

## Run end

- `end("win")` immediately on fifth valid landing after final award/clean bonus; no fifth hold before end.
- `end("lose")` immediately on third crash, after decrement; previous landing points retained, no clean bonus.
- Shell `"timeup"` at240 s even during transition; contact on that frame earns nothing. No manual API/localStorage calls.
- `resultDelayMs: 1200`; frozen body, dust/confetti or sparks/debris animate with game time only. No score/motion during delay; shell owns submission, Retry and Exit.

## Scene and camera

- Side view along +z, pitch0/yaws[0]/fov35, no roll. Fit rocket/whole-pad AABB plus0.5 m x/y padding, z[-1.5,1.5]; `useFittedView` shift:true, padding4 CSS px, margins top/bottom0.04 and left/right0.03, safe-area avoidance enabled.
- `CameraRig`/`followFocus` share union centre, fraction1, bounds x[-10,10], y[-1,20], damping12. Refit every frame and immediately on resize/safe-area change; no10 Hz cache. Include eased and requested aims; expand immediately, contract only while maintaining fit. Reset aim/fit on spawn; no second pose writer.
- Phone layout contract: at844x390 banner open, reserve <=128 px total vertically for shell/banner/insets plus8 px fit padding, leaving254 px; after8% fit margins, usable233.7 px. Six HUD stats share one44 px row in side rails with joystick/72 px Thrust, not six stacked rows; the44 px speed/tilt gauges occupy those rails too. Reserve160 px per side, leaving524 px usable width (>=492 after6% fit margins). Require actual registered rectangles to meet these budgets; measure at build, fail acceptance if shell/banner consumes more.
- Maximum rocket/pad vertical union with padding is20-1.6+1=19.4 m; worst horizontal union<=20+1=21 m. Scale>=min(233.7/19.4,492/21)=12.04 px/m. The rocket's projected longest dimension (nose-to-feet, independent of in-plane rotation)2.2 m gives>=26.5 px; narrowest4 m pad>=48 px. Portrait390x844 uses a bottom control band and one44 px HUD row: require usable width>=310 and height>=600 after margins; scale>=14.76 px/m. Verify both views at maximal legal separation, all tilts and banner on/off; size means longest projected rocket dimension, not its vertical AABB when horizontal. No schematic/second render path; `TargetMarkers` may supplement indicators, never replace fit.
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

`meta.ts` (exact controls/limits, dev status) · `index.tsx` (definition, coarse-pointer assist fixed per run) · `rules.ts` (planets, fuel, integration, swept polygon/contact, attempts/score; pure) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (measured GLB/bell/feet fits) · `Scene.tsx` (one run callback, fitted follow, model/fx/audio) · `Planet.tsx` (one terrain/pad/cavern, shared buffers) · `Primitives.tsx` (fallback rocket, engine cone) · `Hud.tsx` + `Hud.module.css` (gauges, safe-area registration, existing CSS vars) · `assets.spec.json` · `README.md` · `public/images/3d/rocket-landing.webp` · `tools/thumbs/inputs/rocket-landing.mjs`. This task writes only README/assets spec; future files require a build hand-off. No classic GameEngine/progressStorage imports.

## Test plan

`rules.test.ts` <=~600 lines, including local controller bots; no generic harness copies or per-tick matcher allocation. Aggregate invariant maxima then assert per run. Whole rules/bot suite target <60 s; if slow, reduce redundant trajectories, retain proofs and every planet/mode/frame schedule.

- Pin every gameplay constant; generator determinism/validity on256 seeds plus literal fallback and invalid fixtures. Same input tick timeline under60/20 fps/random4..50 ms frames gives identical fixed-tick state/events and residual; test pause/countdown/stalls through the real clock. Never exercise core's overload path with unclamped live dt.
- Exact landing gates at1.999/2,0.999/1,9.999/10 degrees, both signs; pad-relative moving contact, entire foot-span edges, body/side/underside first hits, polygon/terrain/cavern tangencies, high-speed angular sweeps, contact-time interpolation and simultaneous hazards. Slice travel <=0.025 m, bisection contact/landing plane error <=0.002 m; visual feet within0.01 m of pad.
- Fuel burn10/s,85..100 budgets, final fractional powered tick, zero-fuel coast, no negative/recharge-farming, binary flame parity; torque sign, omega/speed caps and both assist modes. Crash once per attempt, two retries only,1.2 s holds carry tick remainder, same seeded retry, fifth win/third loss, clock timeout wins ties, pause/over immutable.
- Every score component's floor/clamp endpoints, clean bonus once, zero bonus after any crash, partial/timeup retention, one reward/planet and reconciliation not additive; finite/rate/duration proofs above on adversarial contact/transition fixtures. No need to attain conservative2800 analytically.
- Legal full-knowledge feedback controller uses position/velocity errors to choose tilt/rotate and pulsed binary thrust (never teleport, refill or disable collision); predict asteroid pad velocity/phase. Run16 seeds per assist mode:8 at60 fps,4 at20 fps,4 random schedules, all five planets. Require all win under240 s with positive fuel at each touchdown; report minimum reserve and per-planet timings. Additional idle/spam/early-crash bots8 seeds each at20 fps plus4 random seeds; targeted worst wind phases/lowest-fuel fixtures cover extremes. Mathematical corridor/bounds tests cover seeds beyond bot sampling; bot successes alone do not prove every seed landable.
- `assets.test.ts`: real mesh size/bell/feet transforms, XY hull envelope, fallback feet/bell parity, committed mesh-derived hull coverage within0.02 m. Build/browser later: common03 criteria and keyboard/two-thumb end-to-end, ready/countdown/Esc/P/tab/over/Retry/Exit, screenshots1280x800,390x844,844x390 banner on/off,24 px sizing, clear overlays, missing GLB fallback, moving pad and flame parity. Build/tsc/vitest/gamecheck/thumbnail belong to build acceptance, not G0.

## Performance

Target **<=30 draw calls**, hard game cap35, platform cap150. Budget: rocket<=5, terrain/cavern3, pad/deck/lights4, starfield1, backdrop2, guide/rings2, cone1, smoke/dust/sparks/debris/confetti pools5, score sprites<=2 =25; reserve5 for mesh splits. One planet resident; no shadow maps, extra lights, Rapier or bloom. Core space lights only. If GLB splits exceed reserve, simplify cosmetic pad/backdrop meshes before raising budget.

Reuse terrain13-vertex top buffers and cavern geometry, one canvas texture, one rocket/pad and fixed scratch matrices/contact buffers. Warm fx kinds once; engine smoke <=8 bursts/s, <=24 particles per burst before quality scaling; touchdown puff16, crash sparks24/debris12, perfect confetti24 (soft>=190,centre>=140), maximum2 score sprites. No new resources or React renders per frame; HUD writes only changed displayed values. Quality reduces stars/fx/backdrop, never collision/pad/guide. Dispose mount-owned resources; perf probe mid-phone p95 target<=33 ms, worst calls<=35, GPU counts flat at30/60/120/240 s and Retryx10 after warm-up. All measurements pending build.

## Audio

`startLoop("thrust", {volume:0})` on entry to playing; handle `.set({volume:powered ? 0.35 : 0})`, recreate after shell pause/mute stopper on resume/unmute without stacking. Rotation `whoosh` volume0.1 at input onset, cooldown0.3 s; touchdown `thud` then `chime`, crash `boom` plus coral hit feedback, low fuel `alarm` on crossing20% of initial budget once/attempt. Use only these existing cue names; no new core keys. Shell owns win/lose cues; mute retains all visual information.

## Accessibility

Numeric relative speeds/tilt plus mint check/coral cross, outlined fuel bar and lives text/icons, dashed guide with landing gate status: no colour-only or sound-only information. Thrust target72 CSS px and joystick allow two-thumb landing; coarse-pointer auto-level explicitly disclosed. Keyboard-only completion uses unassisted damping; same leaderboard bounds. Reduced motion disables shake, light blinking, debris/confetti and backdrop motion, retains actual rocket/pad movement and a steady engine-on cone. Every DOM HUD block uses data-arcade-safe-area and CSS Modules; no globals changes. Text >=14 CSS px, gauges >=44 px high, exact numeric thresholds shown in help.

## Risks

No executed fuel witnesses, bot/phone/performance measurements exist at design gate. Joint fuel/clearance feasibility and real shell safe-area budgets are implementation acceptance gates; the analytical estimates above do not substitute for them. Hull projection, mesh splits and first-crash minimization need asset/adversarial tests.

## Open questions
- Ceiling trap (user decision, Claude review 2026-10-09): on the asteroid (g 1) a 0.3 s thrust tap at spawn coasts about 5.9 m up, past the 4.9 m clearance, and crashes into the ceiling (Moon: a 0.4 s tap). Option: a soft ceiling (engine cut / clamp, no crash); the fastest loss would then be >= 3*1.119+2.4 = 5.76 s, so 5000 ms still holds. Builder default until decided: keep the crash.
- Side-wall crash bound (Claude review): write and test the numbers: >= 1.15 m sideways travel needed after the hull swings to 1.35, about 0.8 m possible in 1 s with omega <= 0.75.

- Approve the remaining design departures: normalized fuel scoring/lower later budgets/no pickups, y14 spawn under y20 ceiling, seeded3..6 m approach offsets, enlarged moving-pad amplitude and side-entry roof, and the single-view phone HUD layout. Controls, assist and paired limits were already decided on2026-10-09.

## Status

P-14-fix1 design revision only; implementation and measured acceptance pending Claude's build hand-off.
