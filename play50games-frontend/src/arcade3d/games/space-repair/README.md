# Space Repair Mission

Owner: Codex (reassigned by the user, 2026-10-09). Slug: `space-repair`. Skill game 16, wave 3, complexity 3. Implemented for P-18; development status pending Claude’s final gates. Spec: `docs/arcade-expansion/04-game-specs-skill.md` §16; catalog: 05 §E.4. Units: metres, played seconds, radians; x east, z south, y up. Core verified against local `origin/main` **bd65ac3**, without fetching. Every departure is labelled below.

## Status

TASK P-18-space-repair-fix1 | finish space-repair | branch codex/game-space-repair | allowed: play50games-frontend/src/arcade3d/games/space-repair/**, play50games-frontend/public/images/3d/space-repair.webp, tools/thumbs/inputs/space-repair.mjs

Branch verified with git branch --show-current. No commit, push, branch change, reset, clean, deletion, credit spend or production access.

Files changed: game rules.ts, rules.test.ts, poses.ts, Astronaut.tsx, README.md; administrative .handoff/P-18-space-repair-fix1/HANDOFF.md. Existing thumbnail input remains present; thumbnail stays null as requested.

Failures and fixes:
- Contacts: the nearest solar-wing exit entered a gap narrower than the suit; the final arena clamp undid depenetration and left 0.25 m clearance. Clamp arena bounds first, select the nearest arena-valid separating face, and redirect boundary-blocked edge corrections through that face. Retain deterministic four-pass contacts and reused scratch. Original clearance/escape assertions remain; added both exterior wing gaps and initially out-of-arena wing overlaps.
- Poses: measuring individual blends identified the partial wide cheer as the 0.79 m maximum. Keep float/thrust/repair arms in an aimed drop=0 representation and use a compact bent-elbow victory wrench pump. Original <0.68 span, torso clearance, rigid helmet, attachment and height assertions remain unchanged.
- Speed: 384 Oracle runs (48 seeds x four schedules x both devices); 464 Idle and 464 BlindSpam runs each (200 seeds x both devices at 20 Hz, plus eight seeds x four display schedules x both devices): 1,312 principal proof runs. Schedules remain 30/60/144 Hz and seeded random 4–50 ms. Degenerates run until their real loss; no injected power/hits or shortened rules clock. One store/controller per run is reused on every frame; removed the per-frame milestone array. Prefix, terminal and capScore assertions remain.
- Other WIP: replaced the static capsule visibility outline with a depth-independent copy of the actual posed rig, with disposed mount-owned material; added the fallback backpack body. README now contains this Status handoff.

Test evidence (2026-10-24):
- Final full game suite: 28/28 pass, three files, Vitest duration 52.66 s (53.278 s wall); principal proof 49.717 s, rules file 51.752 s. Previous complete measurement was 56.00 s; both below 60 s.
- npx tsc --noEmit: PASS (exit 0).
- npx vitest run src/arcade3d/games/space-repair: attempted, but esbuild config loading fails with Access denied reading ../../../.. before test collection. All 28 tests instead ran through installed Vitest's programmatic API, config:false with the unchanged config's @ alias and automatic JSX passed in memory. No config/package edits.
- Reproduce fallback from play50games-frontend: node -e "import('vitest/node').then(async({startVitest})=>{const root=process.cwd().replaceAll('\\','/');const c=await startVitest('test',['src/arcade3d/games/space-repair'],{config:false,root,watch:false},{resolve:{alias:{'@':root+'/src'}},esbuild:{jsx:'automatic'}});process.exitCode=c?.state.getFiles().some(f=>f.result?.state==='fail')?1:0;await c?.close();})"
- Geometry generation: 1,000 seeds; seeded movement: 4,096 steps. rules.test.ts: 374 lines.
- Oracle: every run wins; score 3948–4504, best 95.83% of 4700; minimum power 72.713789; slowest stored win 120041.766 ms. Idle/spam score 0; fastest stored loss 37666.667 ms. All prefixes and terminals satisfy proposed limits; capScore is a no-op.
- Human: 12/12 wins, 26–27 repairs, power 16.15–40.55, peak speed 4.2; measured travel 2.417–2.448 s and service 3.224–3.392 s. These are actual controller results, below the older analytical 3.4–3.6 s service estimate; browser human validation remains necessary. Both first-minute novice witnesses pass >=40 power. Greedy scores 3850–4500; held/camping/spinning exploit gates pass.

Acceptance checklist (original brief, item by item):
- [x] 1 Definition/controls/Hud/assets/camera/environment/result delay implemented; no durationMs, clockChip false.
- [x] 2 Pure seeded rules, core helpers, all gameplay/scoring constants and PROPOSED_LIMITS.
- [x] 3 One rules/store run loop, fixed pools and reused frame scratch; stats update on displayed changes.
- [x] 4 Frame-sampled movement and one OR repair edge; no classic imports/storage/API calls.
- [x] 5 Fitted local follow camera and registered HUD; portrait/landscape projection tests pass. Browser overlap/readability/banner checks pending Claude.
- [x] 6 Existing station/astronaut/battery assets and posed fallback; real mesh fit/rig tests pass.
- [x] 7 Core effects/audio; loop restarts keyed by phase/mute. Browser mute/reduced-motion checks pending.
- [x] 8 Rules score reconciliation before end(win/lose); real-store boundary/pause/retry tests pass.
- [x] 9 meta status dev and provisional scoring preserved; proposed limits 4700/37000/122000/400/40 require Claude's paired metadata/backend update.
- [x] 10 Existing tools/thumbs/inputs/space-repair.mjs present; thumbnail wired.
- [ ] Common final gates: Claude runs full repository tests/build/gamecheck and headless keyboard/two-thumb playthroughs; ready/countdown/Esc/P/tab/pause/resume/over/Retry/Exit; 1280x800/390x844/844x390 screenshots with banner on/off, actual >=24 px silhouettes, contrast/overlays, missing-GLB fallback, mute/reduced motion, mid-phone p95 and Retry x10 resource stability.
- [ ] Draw calls are an estimate (~32 plus imported mesh/material reserve 13), not measured evidence: verify target <=45, hard game cap 50, <=100k triangles, p95 <=33 ms; include the exact-pose outline and fallback backpack in measurement.

Open questions: no new design decision requested. Claude owns the remaining browser/performance/build evidence and paired scoring integration. The measured human cadence differs from the design prediction; assess the real keyboard/two-thumb witness rather than treating the bot as a human playtest. Scope checked only with git status --porcelain; tracked modifications are confined to the game folder.

## Five stations (levels, 2026-10-29)

Each level repairs a different station (`levels.ts` `station`, `rules.ts` `STATIONS` / `stationOf`). Level 1 has no `station` and flies today's ring through the very same `MODULES` / `SOLIDS` / `DEBRIS_PATH` objects (the frame-for-frame replay against `today.rules.fixture.ts` still matches). A layout sets the eight pods, their service discs (1.8 m out along each pod's outward normal), every solid footprint, the debris loop's radii and the set pieces `Station.tsx` draws; the suit starts on dock 1 of its station.

| Level | Station | Layout | Look (`index.tsx` environment) | What changes in play |
|---|---|---|---|---|
| 1 Docking Bay | `bay` | today's ring: pods r 4.2, round hub, solar wings east and west | night space | today's |
| 2 Power Wing | `power` | pods round a 5 x 3.4 m oval on a long power spine (solid, glowing conduit), big solar arrays north and south (solid), debris loop 8.7 x 7.1 | full sun (`day`) | fly round the spine's ends; the east/west docks sit far out on the oval |
| 3 Comms Wing | `comms` | wide ring (pods r 4.8, docks r 6.6) round the big comms dish (hub r 1.9 with a tilted dish), 8 antenna masts (solid) between the docks outside, debris loop r 8.1 | dusk-blue `night` | longest trips (chords 5.05 m); the outer lane between docks and masts is narrow debris alley |
| 4 External Platform | `platform` | square open deck: pods on the corners (3.3, 3.3) and edge middles (3.6), a diamond command block, cargo crates at two corners, debris loop r 8.6 | hard `sunset` light | corner docks sit far out; open space with a wide debris swing |
| 5 Station Emergency | `emergency` | the ring turned half a pod, 8 sealed bulkheads (solid, hazard stripes) on the old diagonals between docks, a pulsing red alarm light, debris loop r 8.9 | red alarm `night` | the outer lane is sealed between docks: fly the inner ring; fastest debris and tightest arcs (unchanged level knobs) |

Fairness per level (`levels.test.ts` "five different stations"): every dock has > 0.6 m clearance and a 0.25 m-grid path from the start; adjacent docks (the ticket order) are joined by a clear straight chord under 5.2 m; the debris loop stays > 0.06 m off every docked suit and inside the arena; pods never overlap; the battery spot is inside the arena; every level's docks differ from every other level's. The store proof per level (honest 50 seeds, oracle 30, greedy, idle and spam, both devices, 30/60/144 Hz and random frames) runs each station.

**Limits unchanged.** The proof depends only on the 30 ticket times, the 150-point award, the 200-point bonus and the drain (each identical on every level): the station only changes travel, which can delay but never add a paid repair. Every limit test re-runs per level.

## Concept

Float around a toy station, brake beside a sparking module and tap a large timing ring to mend it. Keep power above zero for **120 s**. Eight numbered modules, a silver astronaut, blue solar wings and Earth below make the route readable; inertia between repairs and a satisfying wrench reach give it its identity. Accent `#818cf8`.

## Controls

`meta.ts` controls: `scheme: "joystick"`; `keyboard: "WASD / arrows to thrust; release to brake; tap E, Enter or Space in the repair arc"`; `touch: "Joystick to thrust; release to brake; tap Repair in the repair arc"`. Definition: `touchControls: ["joystick", "action"]`, `touchLabels: { action: "Repair" }`.

- `moveX/moveY` → `inputToWorld(..., view.yaw, scratch)`; clamp vector magnitude to 1, dead zone 0.12. Repair reads `actionPressed || jumpPressed` once per rendered playing frame, never once per substep. E/Enter/Repair map to Action, Space to Jump; simultaneous edges are one attempt. Held input and OS repeat do not repeat repair. No mouse aim, canvas taps, swipes, drag or extra touch button.
- Esc/P and hidden-tab pause are shell-owned. Touch and keyboard share the same repair-arc timing windows (60/45/35°). Both devices use neutral braking and the same leaderboard.
- Changed from spec: arrows/Enter follow existing core bindings; desktop gets the same neutral brake as touch because counter-thrust alone makes stopping in a small service disc unnecessarily difficult. The exact help strings disclose braking.

## Rules

Pure seeded `rules.ts`; literal groups `STATION`, `SUIT`, `BREAKS`, `REPAIR`, `DEBRIS`, `CELL`, `SCORE`, `CLOCK`. No Rapier, mesh-derived collisions or wall-clock time. One `useRunFrame`; core `substep` consumes all played dt in steps ≤1/120 s, with splits at scheduled events, lock expiry, cell eligibility/expiry, power zero and 120 s. Cache the callback and scratch. Frame-sampled input is not claimed identical under different input sampling times.

- **Station:** flight square x/z ±10; centre clamps to ±9.55 for astronaut r0.45. Module i=0..7 is at `(4.2*sin(i*pi/4), 4.2*cos(i*pi/4))`; its service disc is at the same angle, radius 6, disc r0.6. Module visual diameter 1.3, height 1.2. Footprints: each module is a circumscribed regular 12-gon of inradius 0.65; hub a regular 16-gon of inradius 1.2 at origin; solar wings AABBs x[8.1,9.3] and [-9.3,-8.1], z[-1,1]. These fixed closed segment lists use core circle/segment contacts. Struts and docking-port trim are cosmetic, below the flight plane; no invisible connector walls. Minimum service-disc separation from its own collider is 1.8−0.6−0.65/cos(pi/12)−0.45 >0.077.
- **Astronaut:** start at service disc 0, velocity zero, facing the hub. XZ thrust 6 m/s²; speed cap 7 after thrust AND contacts/knockback. Neutral means input magnitude ≤0.12; reduce speed by `min(speed,3*dt)` without reversing. Use trapezoidal displacement from pre/post-force velocity, then contact resolution. Facing eases at 8/s towards travel above speed 0.2, towards the module while docked; yaw has no rule effect. Visual soles float at y0.25; no walking gait on empty space.
- **Contacts:** `circleSegmentXZ` + `resolveCircleSegmentXZ(...,0.5,0)` for fixed footprints, stable module/edge order; at most 4 resolution passes then retain the last legal position and remove inward velocity if still overlapping. Boundary clamp reflects only outward velocity at restitution 0.5. Contact entry starts 0.5 s cosmetic wobble and cancels docking; re-arm entry after separation≥0.05, shared wobble cooldown0.5 s prevents corner strobing. No power/score penalty. Slice travel7/120<0.059 is below body radius0.45, so a resolved body cannot cross a segment's centreline between tests; shortest solid width≥1.2. Tests include corners/interior recovery and escape under outward thrust; contact push-out is depenetration, never a travel-speed rejection that pins the body.
- **Break tickets:** exactly 30 candidate events under proposed U1: 6,12,18,24,30,36; 40,44,...,76; 80,83,...,119. RNG state is `{s:(seed>>>0)||1}`; first `rngNext` chooses direction (value<0.5:−1, otherwise+1), next8 samples set module arc offsets in id order, next4 set debris phases in slot order; no later RNG draws. Ticket k targets module `(direction*k mod 8 +8) mod 8`. First target is always 0, making the opening teachable. If that module is already broken, consume/skip the ticket: no queued duplicate, reset, extra drain or future award. Otherwise create one broken generation with hits=0 and perfect=true. Repairs cannot create tickets; maximum four paid generations per module.
- **Power:** starts 100; derivative = minus the number of currently broken modules (1/s each), including travel, docking and miss locks. Integrate exactly between event times; clamp only after a +25 cell, to [0,100]. No passive regeneration, no direct collision damage. Zero is absorbing. Below 25: steady warning text/bar/vignette and alarm on downward crossing; re-arm above 30. Each module shows its number, broken icon and completed/required hit pips. HUD: Power floor(P)%, Repairs n, Remaining ceil(120−t)s; shell Played remains shell-owned.
- **Docking:** eligible only inside a BROKEN module's service disc, speed ≤1, neutral input and wobble expired; choose nearest disc, ties lower module id. Latch at the current legal position and set velocity zero (no position snap/free travel). While neutral and eligible, hold there; movement >0.12 unlatches immediately. Leaving retains that generation's hit count/perfect flag and absolute miss-lock expiry, but resets needle age to zero. Docking during a lock is allowed; redocking neither clears nor extends it, and the needle stays frozen until expiry. No repair while moving, wobbling, outside the disc or at a healthy module; such presses do nothing and grant no points.
- **Required hits:** modules [0..7] require **[1,1,2,1,1,2,1,3]**, fixed for the whole run (mean 1.5). Changed from spec: 1-3 hits follow fixed cap stripes/pips rather than module size; all modules share one footprint/reach to keep collision and phone target clearance uniform. Repair parameters snapshot when a ticket actually breaks the module: stage at t<40 / 40≤t<80 / t≥80; periods **1.2/1.0/0.8 s**; repair-arc widths **60/45/35°** for both touch and keyboard. Seeded arc centre for module i is `0.5 + 0.05*(2*rngNext−1)` turns, frozen across its generations; zones never wrap (bounds inside 0.325..0.675). Use `needlePosition(age,period,"loop")`, `judgeTiming(pos,zone,1/3)`; arc endpoints and perfect-third endpoints are inclusive.
- **Timing attempts:** entry, each successful hit and each completed miss lock reset needle age to zero. An eligible new press is graded once against that frame's rule needle; good/perfect adds one hit, perfect flag ANDs with the grade. A miss clears perfect, retains hits, freezes needle at zero for **0.5 s**; presses during lock are discarded, not queued; its remaining played-time duration carries across undock/redock (never pause time). After a successful hit the next hit must wait for the reset needle to reach the arc again; two keys cannot finish multiple pips. Reaching required hits repairs exactly once, clears drain immediately and emits one score event. No randomness or extra survival points on a miss. Changed from spec: explicit reset/lock/latch/progress semantics close the hold/spam and repeated-hit-in-one-arc loopholes.
- **Cells:** successful-repair milestones 4,12,20 each spawn one `SHARED_ASSETS.battery`, no other source. Position = that module's service centre +1.3 m along increasing-index tangent, y1.1. After 0.35 s, automatically collect within XZ distance ≤2.0 for +25 power (capped100), zero score; expire after 8 s if missed. A docked player is ≤1.9 away, so waiting briefly guarantees pickup; moving away can miss it. Three single-use slots, id-order collection, no respawn. Battery long axis is camera-up, visible fitted length 1.0 m; bob ≤0.04. Changed from spec: the catalog's otherwise unspecified P2 cells become three finite milestone recharges, giving late human repair queues a power margin without farming.
- **Debris:** one closed 32-point `createPath` polygon, vertices on r7.6, y0.95; phase = `j/4 + seeded offset in [-0.025,0.025]` turns for slot j=0..3. Activate 2/3/4 slots at 0/40/80 s, speeds 1.0/1.2/1.4 m/s by current stage; `advance` all four paths from time zero so later activations do not teleport existing pieces. Each is drawn diameter0.5, collision circle r0.25. Contact with astronaut uses `circlesOverlapXZ`; apply outward normal impulse2 m/s, cancel latch, wobble0.5, global debris cooldown1 s (coincident centres: outward station radial normal, +z at origin). Speed cap still7. No drain or score from debris; it need not collide with station props. The polygon stays outside every service disc/player clearance and inside solar-wing clearance, so repairs and the inner adjacent route are safe; it punishes overshoot rather than unavoidable camping damage.
- **Frame/event order:** advance continuous movement/timing/drain to the next boundary; power zero ends before anything can revive it. Then break tickets, contacts/unlatch, frame-end repair edge (if its sample time is not after120), milestone spawns, eligible cell collections, final survival award/win. New breaks start draining only AFTER their instant; repairs/collections cannot undo earlier drain. A frame straddling120 integrates only to120 and discards later input/remainder. A repair begun at t>=117.5 (or earlier) that remains incomplete at120 is dropped, with no partial-hit award or overtime. At exact120, loss has priority; a legal repair/collection at that same instant precedes bonus/win. Pause/over advance nothing; Retry resets schedule/RNG/slots/locks.
- **Changed from spec: late cadence 3.0 s instead of 2.5 s because** the original 32-ticket load exhausts a human-paced queue around110-113 s. Proposed U1 is normative for the build pending user approval: 30 tickets, last at119; no extra simultaneous burst, since backlog already creates simultaneous failures. Never silently restore2.5 s or retune the controller to pass.
- **Changed from spec: only 2 mirror break orders because** predictable adjacent routing teaches inertial braking and bounds human travel; seed selects clockwise/counterclockwise plus +/-18 degrees arc jitter and debris phases, not arbitrary ticket times/permutations. This deliberately narrower reading of "seeded breakdown schedules" needs U2 approval.
- **Human budget (analytical queue estimate, not a playtest):** adjacent centres are4.592 m apart. Rest-to-rest thrust6/neutral-brake3 needs peak sqrt(4*4.592)=4.286 m/s and2.143 s; add~0.5 s reaction/settling ->2.65 s travel. Normal service~3.4-3.6 s includes multi-hit timing; misses additionally cost0.5 s lock plus the reset needle's return (~0.6 s), once every4 repairs. Illustrative FIFO model: finish=max(ticket,previous finish)+3.4+1.1 on every fourth repair; integrate one drain/s per outstanding ticket, collect milestone cells0.35 s later with100 cap. Proposed30-ticket schedule yields26 repairs by120, drain149.8, effective recharge64.7, final power14.9 (~13 with frame/control overhead); old32-ticket schedule reaches zero~113.23 s. At3.6 s ordinary service this margin is not assured: the real HumanPaced gate below must pass with honest measured timing, or report U1 unresolved. First60 s novice witness still needs>=40 power at frozen start difficulty. No ideal bot substitutes for keyboard/two-thumb witnesses.

## Scoring

`runScore = 100*repairs + 50*perfectRepairs + (won ? 2*floor(powerAt120) : 0)`. Perfect means EVERY required hit was perfect and there was no miss during that broken generation. Live `addScore(100|150)` once per completed generation; no awards for individual hits, cells, movement, idle time, bounces or power replenishment. Final `setScore(runScore)` reconciles once before `end`, not another additive award; no `finalScore` override. Loss retains repairs and receives no power bonus. At most **30*150+200=4700**; this is a conservative ceiling, not a claimed attainable oracle score. Popups +100/+150 perfect; HUD and result expose the power bonus.

### Server limits and why they hold (the proof)

Exact proposed `meta.scoring`: `{ kind: "points", maxScore: 4700, minDurationMs: 37000, maxDurationMs: 122000, base: 400, maxPointsPerSec: 40, unitLabel: "pts", display: "int" }`. Claude must pair the backend entry (`enabled:false`) before build acceptance; P-14 edits neither metadata nor backend. Never infer current provisional values from stale local main.

1. **Every award prefix (t in played seconds):** a paid generation needs an issued ticket, at most150 points each. Before6: B=0<=400+40t. On[6,40): n<=min(6,floor(t/6)), B<=25t-400+40t. On[40,80): n<=7+(t-40)/4, B<=37.5t-450<=400+40t. On[80,120): n<=min(30,17+(t-80)/3), B<=min(4500,50t-1450)<=400+40t, since10t<=1850 throughout. At120 add the sole bonus<=200: B<=4700<=5200=400+40*120. Loss never adds a bonus. Event instants use inclusive ticket counts; skips only reduce them. Later store-frame time enlarges the envelope; whole-ms rounding costs<=0.02 points, far below the terminal500-point slack. Base400 replaces250 to remove the former~1% end-envelope margin (5000 vs5050); these revised bounds exceed the skill's3-5% minimum rate margin. MaxScore4700 is the conservative finite ceiling, not a claim of a measured attainable score. No cap hides an incorrect formula.
2. **Real movement/work lower bounds:** between different service discs, path length ≥4.592−1.2=3.392, hence travel≥0.4846 s at the true7 m/s cap; acceleration, brake, solids and wobble only add time. No latch snaps, cells or impulses bypass that cap on legal separated trajectories; push-out only restores clearance and cannot shortcut a different service disc. Test corner escape and this travel bound together. Earliest green-start among all stages/modes/seed centres is `0.8*(0.45−60/720)=0.293333 s`; earliest perfect start≥`0.8*(0.45−60/2160)=0.337777 s` per hit after reset. First ticket is on the starting dock at6; earliest first good is 6+1.2*(0.45−60/720)=**6.44 s** on both touch and keyboard (wider touch arcs never raised the bound; scoring limits stay valid), first perfect≥6.49 s. These bounds tighten ticket-only prefixes; they cannot raise them. A full-knowledge bot must use real thrust/braking, hit resets and cell pickup, never teleport or directly set power/hits. The fastest possible WIN is exactly120 s on the rules clock because survival has no early-completion win.
3. **Earliest loss:** no repair/cell can increase drain; before40 the idle maximal-broken trajectory is the earliest possible expiry. Cumulative drain at36 is `6*(1+2+3+4+5)=90`; six broken then consume the remaining10 in10/6 s. Therefore loss≥**37.666667 s**, safely above37000; collisions have zero power damage. One full-frame store overshoot is ≤50 ms; all ends≤120050<122000. Countdown, pause and result delay are excluded.
4. **Finite maximum:** 30 one-use tickets, each ≤150, plus one bonus≤200. Every seed, fine/coarse mode, miss history and frame partition respects this; skipped tickets only lower scores. Through real `createArcadeStore`/`simulateRun`, assert score/max/rate bounds after EVERY update (duration minimum applies only at end), terminal `withinServerLimits`, and `capScore` unchanged. Record fastest loss/win, extrema and bonus separately; no runtime measurements are claimed at G0.

## Run end

- Rules own a fixed **120 s survival clock**, `durationMs` OMITTED: first P≤0 calls `end("lose")`; otherwise at t120 reconcile repairs/power bonus and call `end("win")` in the same callback. Completing/repairing all currently broken modules does not end early. No gameplay `"timeup"` reason.
- Changed from spec/Common clocks exception: survival uses explicit `"win"` instead of shell `"timeup"`, because store tick moves to phase "over" before useRunFrame runs; playedFrameDt then returns0, so the last frame's drain, repair and bonus would never be processed. The shell text is "Time's up!", not a loss label. Shell still owns phases, pause, result/submission, Retry and Exit; game shows Remaining itself and never calls storage/API.
- `resultDelayMs:1200`; win has mint repair flash/confetti/cheer, loss darkens panels and the astronaut slumps. Motion/awards freeze; visual result animation uses `useGameTime().now` only.

## Scene and camera

- **Close full-follow**, pitch **50°**, `yaws:[0]`, `fov:45`, `shift:true`, `padding:4`, margins0.02 on all sides; local `useFittedView` area x/z ±2.75, y[0,2.2], focus[0,1.1,0]. CameraRig follows the astronaut centre `(x,1.1,z)`, fraction1, damping5, bounds x/z±9.55,y1.1, with fitted offset/shift. One yaw means camera on +z looking −z and stable screen-relative thrust; a close window keeps the suit/repair zone legible while arrows cover remote modules.
- Changed from spec: pitch50 instead of≈60 and a translated local window instead of fitting the entire station across `followFocus`'s world reach. Full follow is translation invariant, so use one local focus; do not pass the whole ±10 arena as area/focus and shrink the suit. With cap7 and damping5, follow lag≤7/5=1.4 m; the ±2.75 hull includes lag + body/service-disc extent. Rig lerps BOTH position and look-at, not just position. Keep the rig mounted across viewport/safe-rectangle/banner changes: CameraRig already eases offset/shift updates, while remounting would snap mid-run; movement damps at5/s. No second camera writer or generic fit implementation in the game folder.
- Camera math: focal length `f=H/(2*tan(22.5°))`; camera depth `Z=D−sin(pitch)*(y−focusY)−cos(pitch)*(z−focusZ)`. A small camera-parallel length L projects as `L*f/Z`; exact mesh endpoints use their OWN depths. Lens shift translates pixels, not scale. FitView searches D (dollies); the following table specifies conservative FAR-depth acceptance ceilings, not measured fits. Suit poses must retain helmet-to-sole Δy≥1.6 and |Δz|≤0.1, giving projected reference length≥1.6*cos50−0.1*sin50=0.952 m; verify the actual posed silhouette too.

| viewport, banner OPEN | focal f | required far depth Z≤ | minimum px/m | suit reference≥ | module width1.3 | cell camera-up1.0 | markers |
|---|---:|---:|---:|---:|---:|---:|---:|
|390×844|1018.80|30|33.96|32.32 px|44.15 px|33.96 px|28 CSS px|
|844×390|470.77|18|26.15|24.89 px|34.00 px|26.15 px|28 CSS px|

- These are design gates, not screenshot evidence. Replace arbitrary free-pocket dimensions with actual core fit/projection plus browser measurements: every important visible suit/module/cell silhouette>=24 CSS px and clear of every registered shell/HUD/control/banner rect throughout max-lag reversal, poses, docking, resize and banner transitions. Remote modules/cells require>=28 px TargetMarkers arrows. Landscape's24.89 px suit reference is marginal: measure actual posed vertices/silhouette; if<24, tighten far-depth (closer fit within rect clearance) or enlarge the suit and revalidate clearances, subject to U3. If neither fits, stop for Claude's layout decision; never shrink targets or disable avoidance.
- `TimingRing` in registered Hud:112 CSS px portrait/desktop,96 landscape; `perfectShare:1/3`, live needle/zones, "REPAIR"/"WAIT". In390x844 portrait put the112 px ring BETWEEN joystick (right edge x152) and Action (left edge x298), within the146 px gap, vertically aligned with the controls; it consumes no additional camera height. In844x390 landscape retain the right rail above Action (ring y~109-205 with~85 px banner open),8 px control gap; place the44 px Power/Remaining/Repairs row left or centre below chips, NEVER over that rail. Read actual rectangles via useSafeArea; remeasure responsive layouts and all overlaps rather than assuming these coordinates universal. Reserved boxes stay mounted while hidden to prevent fit oscillation; ring/controls/chips/banner/stats remain disjoint.
- Hull `#e2e8f0`, panels `#1e3a8a`, warning `#f87171`, fixed `#34d399`, space `#020617`. `environment:{background:"#020617",lighting:"space"}`, no fog, extra lights, bloom or shadow maps; preset already exists (ambient0.1, hemisphere0.35, white directional2 at[6,6,8]). Earth sphere r12 at[0,−25,−12], canvas continents, no collider; Starfield600 (200 low), fixed seeded stars.
- Float pose from arms-down idle, `ground=0`, `applyLift={false}`, slow elbows/knees drift≤0.08 rad at0.3 Hz; thrust forearms forward, torso lean≤0.06 rad. Local `poses.ts` uses `aimArm`/`turnBone` to point wrench toward the module; transition via `carryPose(0)` before aim to avoid passing the T. No `reachPose` wave, foot-floor test or walking stride in zero gravity. Test actual helmet rigidity, glove/suit clearance and minimum silhouette through float/thrust/reach/wobble/cheer. Fallback is a posed suit, never a static T.
- Overlays above real surfaces: cap top1.20, numbered decal1.24 (+0.04); service disc at0.06 over strut/deck top0.02; mint module ring1.26, thruster nozzles outside backpack surface by0.03. DepthWrite=false on transparent overlays, explicit renderOrder; no coplanar decal/ring. If foreground hull hides the astronaut, show a one-call depth-independent suit outline at the exact posed transform, inside the same budget. Markers use fixed11 slots (8 broken modules,3 active cells), hidden flags rather than array recreation.

## Core helpers used

Verified on `origin/main` bd65ac3: runtime `GameDefinition`, `useRunFrame`, `useGameTime`, `useInput`, `useArcadeStore` (`addScore/setScore/setStat/end`); `inputToWorld`, `rngNext`; `core/kinematics` (`substep`, `circleSegmentXZ`, `resolveCircleSegmentXZ`); `circlesOverlapXZ`; `core/path` (`createPath`, `advance`); `useFittedView`/`CameraRig`, `useSafeArea`, `useCoarsePointer` (`core/TouchControls.tsx`); `HumanoidModel`, `useHumanoidPose`, `idlePose`, `carryPose`, `cheerPose`, `aimArm`, `turnBone`, attachments `chest/handR`; `EXPANSION_CHARACTERS.astronaut`, `ASTRONAUT_LANDMARKS`, `EXPANSION_CHARACTER_GLB_HEIGHT`, `SHARED_ASSETS.battery`; `Model`, `DynamicInstancedModel`, `Instanced`, `useCanvasTexture`; `TargetMarkers`, `TimingRing`, `needlePosition`, `judgeTiming`; lighting `space`, `Starfield`; `useFx` (`warm/burst/score/shake`), `useQuality`, `startLoop`, `playSfx`; limits `withinServerLimits/capScore`. Test-only `createArcadeStore`, `core/testing/botHarness` (`simulateRun`, `fixedFrames`, `randomFrames`, `createGrid`, `freeGrid`, `followPath`, `steer`). Core owns generic collision/path/fit/rig/timing/pools/run-loop utilities; game owns station footprints, ticket/drain/repair/cell rules and controller policy. No missing required dependency found; `followFocus` exists but is deliberately unnecessary for this full local follow.

## Assets

No generation/credits. `assets.spec.json` retains the existing recipe shape but describes the EXISTING owned astronaut GLB, never a regeneration request. Catalog prompt called for no backpack and the user's face through the visor; the actual GLB has a backpack. Preserve its actual face/visor and backpack, never queue regeneration to reconcile that discrepancy. Reuse the imported asset/landmarks; shared and procedural objects never enter that file.

| id (05 §E.4) | class / source | target / budget | fallback |
|---|---|---|---|
|astronaut|A, owned `space-repair/astronaut.glb`, `EXPANSION_CHARACTERS.astronaut`|default1.75 m, GLB height1.8231, scale1.75/1.8231; catalog≤18k tris/1024 texture, target≤1.5 MB|posed capsule torso, helmet, bent limbs, pack; same r0.45|
|jetpack, wrench|B, procedural attachments|existing GLB backpack is jetpack body; chest-mounted nozzle pair spans0.35, each0.1 diameter; wrench0.35 long, grip across right palm along−x|fallback includes pack/nozzles/tool explicitly because core attachments do not mount on fallback|
|power cells|D, `SHARED_ASSETS.battery`, shared/battery.glb|source1.02 x 1.90 x 1.01 m (known fixture); camera-up1.0 m long; shared budget≤5k tris/300k bytes; existing texture|striped cylinder with identical length/pickup rule|
|modules, panels, Earth, debris, stars|B, code/core env|sizes above; module12-sided shell/dome, hub16 sides, wing1.2×2, debris0.5; reusable canvas number/stripe/continent atlases|same code|

- Changed from catalog: astronaut1.75 instead of1.5 for the real core fit/phone silhouette; keep its existing backpack instead of requesting a backpack-free regeneration. Attach only the procedural nozzle hardware plus wrench. Derive both chest/hand placement from measured core anchors/ASTRONAUT_LANDMARKS, never guessed GLB coordinates; test nozzle clearance and tool grip≤0.01 m through poses.
- `sharedAssets.ts` supplies astronaut id/height/landmarks, no battery size constant. Known battery dimensions are **1.02 x 1.90 x 1.01 m**, cited by `games/escape-room/look.test.ts:145`; assert these against the actual shared GLB through core's test reader in game `assets.test.ts`, then fit uniformly by1/1.90 and assert camera-up length1.0. Keep those asset-specific dimensions in game `assets.ts`; do not remeasure as an unknown or add a generic helper. Material overrides live on the derived asset object's `material`, never a `<Model material>` prop. Preserve suit textures/helmet.

## Files

Future build: `meta.ts` (exact controls/limits, status dev) · `index.tsx` (definition, no durationMs) · `rules.ts` (station, tickets, inertia/contacts, timing/drain/cells, score/end; pure) · `rules.test.ts` · `assets.ts` + `assets.test.ts` (actual suit/battery fits/anchors) · `poses.ts` + `poses.test.ts` (floating/thrust/repair) · `Scene.tsx` (one run loop, local fit/rig, fx/audio) · `Station.tsx` (batched hull/panels/Earth/debris) · `Astronaut.tsx` (rig/nozzles/wrench/fallback) · `Hud.tsx` + `Hud.module.css` (ring/stats, registered safe areas, existing CSS vars) · `assets.spec.json` · `README.md` · `public/images/3d/space-repair.webp` · `tools/thumbs/inputs/space-repair.mjs`. P-14 writes only README/asset recipe plus the explicitly requested ignored administrative `.handoff/P-14-space-fix1/HANDOFF.md`; no implementation, packages, core, backend or other docs.

## Test plan

Measured fix-round-1 suite:28/28 pass in52.66 s (principal proof49.717 s);384 Oracle +464 Idle +464 BlindSpam runs. See Status for command, extrema and remaining acceptance evidence.

`rules.test.ts` target500, hard≤~600 lines INCLUDING bots; whole game suite target<60 s. Reuse core harness, aggregate tick invariants and assert per run; no matcher/string allocation per tick. Pin literals by VALUE, not comparisons of a constant with its derived formula; preserve all boundary/mutation cases if reducing redundant seeded trajectories for runtime.

- 256 seeds: identical schedule/arc offsets per seed; exact30 times/8 ids/direction, generation skipping, at most4 awards/module; all service discs reachable on0.25 grid/r0.45 clearance, safe inner chords, debris/solar/service clearance and fixed footprints. Invalid schedule/generation/clearance fixtures must fail.
- Movement: thrust6, neutral brake3 without reversal, vector cap7 including debris, diagonals/dead zone, trapezoidal distance, boundary reflection0.5, corner contacts/4-pass recovery,0.5 wobble/cooldown, no tunnelling, docking r0.6/speed1 exact edges and no snap, retained progress/reset needle, outward-thrust corner escape without7*dt correction rejection. Targeted extremes plus4096 seeded steps, not a full world bot for each geometry assertion.
- Repair: all stage snapshots/widths/periods, equal repair-arc timing windows on both devices (60/45/35°) and seeded centre extremes; literal edge/just-outside tests for good/perfect third, min age bounds, 1/2/3 pips, bad perfect flag persists, 0.499/0.5 lock boundary, one OR edge/frame and ignored held/repeat/lock inputs. Simultaneous keys do not double-hit. Leaving/re-entry cannot recycle a hit or undo a miss; dock during lock, undock/redock at0.499 s, and expiry at0.5 s retain the original absolute lock deadline. Mutation cases: widen by1°, use default0.3 perfectShare, keep needle after hit, pay per hit, reset perfect on re-entry, process edge in every substep.
- Drain/cells/clock: exact piecewise integrals before/after all break times, power0 crossing, skipped ticket no extra drain, repair stops drain only from its instant, milestone4/12/20 once, +25/cap100, pickup radius2/age0.35/expiry8 boundaries, missed slots/duplicate claims, alarm25/re-arm30. Split mid-frame zero/120, expiry beats pickup, incomplete repairs started at/after117.5 dropped at120, exact-deadline repair/bonus vs after-deadline edge, score before end, pause/over immutable and Retry fresh. Kill mutations for drain0.5, refill before zero, bonus on lose, durationMs timeout and dropped last-frame score.
- Score: +100/+150 only per generation, miss retention, floor fractional power, no cell/hit/drift awards, all event-prefix inequalities and literal4700/37000/122000/400/40; analytical earliest-loss and movement/work bounds. `withinServerLimits` only on terminals, raw max/rate every prefix, `capScore` no-op. Store clock covers countdown remainder, pause/resume and300 ms raw stalls (legal played cap50 ms).
- **Rules-only OracleRepair**, **Idle**, **BlindSpam20Hz**: Oracle48 seeds x {30,60,144 Hz,random4-50 ms} x both pointer modes; Idle/BlindSpam200 seeds x20 Hz x both modes plus8 seeds at all four display schedules (1312 principal proof runs, user fix-round-1 runtime waiver); real createArcadeStore/advanceRunClock/playedFrameDt, rules and frame-sampled input only, no rendering or injected power/hits. Oracle uses legal movement/braking/docking/predicted perfect arcs/cell pickups; assert all win and best>=90% of4700=4230, report score/power/time extrema. Re-derived centre-arc estimate:30 perfect repairs=4500, rest-to-rest adjacent travel2.143 s, stage hit time0.6/0.5/0.4 s per pip, wait0.35 at milestones; last repair~119.8, drain~21.14, effective recharge~14.8, power~93.66 ->~4686 points (seed/frame variations pending). Old~4790 estimate belonged to32 tickets. Raw score/max/rate every prefix; terminal withinServerLimits and capScore no-op EVERY run, including losses. Idle/spam must lose before120; blind spam/held input score0, all degenerates<=600.
- **HumanPacedRepair**6 seeds/mode at20 fps: neutral braking ONLY (no counter-thrust shortcut), top speed<=4.3, ~0.5 s reaction AND settling budget per target, real multi-hit needle waits and one deliberate miss per4 repairs, including persistent0.5 s lock and reset wait. Log adjacent travel~2.65 s and ordinary service~3.4-3.6 s; reject an unrealistically fast~2.7 s/service implementation. Require win, power>=10,>=24 repairs in both modes; errors/reactions are actual controls through rules. If this fails do not loosen the bot or claim U1 validated. Add frozen-start-difficulty60 s novice witness>=40 power; all estimates above remain unmeasured design predictions.
- Slower movement policies **GreedyRepair**, **HoldRepair**, **CampOneModule**, **ConstantThrustSpin**:4 seeds each/mode at20 fps plus one random-frame seed/mode; small seed counts are Claude-waived, the user’s P-18 fix-round-1 coverage above overrides the older200-seed cross-product requirement. Greedy reports attainable score; remaining degenerates lose before120 with<=600, held score0. Target500/~600 hard test-file lines, report actual runtime; preserve the revised seed/frame coverage and the<60 s suite gate.
- `assets.test.ts`/`poses.test.ts`: actual1.75 suit/default scale/landmarks, measured1.0 battery fit and camera-facing axis, no T at blends, helmet rigid, gloves outside torso, tool grip/nozzles≤1 cm, min1.6 height/0.1 depth silhouette references, fallback parity; no floor/stride assertions for floating soles. Camera tests use ACTUAL core fit/projection and representative safe rects at390×844/844×390 with banner, max-lag and all important poses/depths≥24 px. These supplement, never replace browser measurement.
- Build-stage common03 gates: build, tsc, vitest, gamecheck; keyboard/two-thumb wins, ready/countdown/Esc/P/tab/pause/resume/over/Retry/Exit, banner on/off and screenshots1280×800/390×844/844×390; reduced motion/mute/unmute, missing-GLB fallback, ring not under chips/controls, overlays visibly above surfaces, measured readability, perf and Retry×10 flat resources. P-14 executes document/scope checks only.

## Performance

Target **≤45 draw calls**, hard game cap50 (spec), platform cap150; ≤100k visible triangles, mid-phone p95≤33 ms. Budget: suit≤4, nozzles/wrench3, merged/instanced station8, cells≤3, debris1, Earth1, stars1, service/repair overlays3, suit visibility outline1, warmed fx kinds5, score sprites≤2 =32, reserve13 for imported mesh/material splits. `space` lights only, zero shadows/dynamic lights. Render call counts must be measured with all8 broken,4 debris,3 cell slots and all fx; simplify decorative meshes if the reserve fails, never raise45 silently.

Prebuild8 module/dock slots,4 riders,3 cells,11 markers and scratch contact/pose/matrix buffers, shared materials/atlases and fixed zone arrays. `fx.warm` puff/sparks/sparkle/confetti/score; thruster puffs≤6 bursts/s, sparks≤4 bursts/s TOTAL, ≤2 score sprites. `useQuality` reduces stars/fx/Earth detail only, never hazards/targets/timing. No per-frame arrays, objects, closures, colour/string creation, texture/path rebuilds or React state; stats update only on displayed-value changes. Core SVG needle polling has its own existing transform-string update; no additional game allocation loop. Dispose mount-owned resources; measure at30/60/90/120 and Retry×10 after warmup for flat geometry/texture counts and no retained-heap trend. All performance measurements pending build.

## Audio

Existing `startLoop("thrust",{volume:0})`, update reused options to volume0.25 while thrusting,0 otherwise, pitch0.9+0.3*speed/7. Shell stops loops on pause/mute/over/unmount: recreate exactly one handle on resume/unmute while playing; stop stale handle, never stack. Sparks `buzz` volume0.12, cooldown0.75 s global, pan=clamp(sin(moduleBearing−cameraYaw),−1,1); lap `click` volume0.15; good hit `thud`, completed repair `chime`, perfect `combo`, miss/contact `hit`, cell `pickup`, low power `alarm` on crossing only. Repair ratchet is the existing `thud/click` cues, not an invented audio key. Shell owns win/lose cues; sound optional, tick/lock/grade/power all visible.

## Accessibility

Number/icon/pips, dashed service disc, needle/arc shape and explicit GOOD/PERFECT/MISS/WAIT text avoid colour-only information. Repair72 CSS px, ring112/96, markers28, HUD text≥14 px; opaque `#020617` backing with `#f8fafc`/`#e2e8f0` text (contrast>14:1), verify computed text contrast≥4.5:1 including warnings. Panels/register boxes stay below shell chips and outside touch hit targets. Touch and keyboard use equal repair arcs (60/45/35°), no hidden control toggle. Reduced motion removes shake, bob, limb drift, flashes/blinking, Earth spin and particles; retains actual inertia/needle/debris motion as essential information and steady broken/low-power icons. No rapid red flicker; vignette steady. Muted/unlocked audio never affects rules; all help/control strings match the actual actions.

## Open questions (historical)

All open questions (U1–U3 and equal arc timing windows) were resolved by the user’s Decisions below. Current remaining acceptance evidence is listed in Status.

## Fix round 1 (2026-10-24)

1. Replaced losing32-ticket budget with proposed30-ticket/3.0 s cadence, explicit queue maths and honest neutral-brake HumanPaced gate; U1 table stays pending.
2. Re-derived every score prefix,4700/37000/122000/400/40 limits and30-ticket Oracle estimate; restored200-seed x frame coverage for Oracle/Idle/BlindSpam,>=90% best-score gate and explicit slower-bot waiver.
3. Corrected shell-timeout rationale: tick enters over before the final rules callback, rather than presenting timeup as loss.
4. Labelled the2 mirror-order limitation as Changed from spec and U2.
5. Moved portrait ring between controls; landscape rail excludes stats; replaced pocket sizes with measured>=24 px clearance gate.
6. Removed rig re-keying; require measured landscape suit size and closer fit/larger suit if it fails.
7. Made miss lock persist through undock/redock, allow docking during lock, drop incomplete deadline repairs; removed7*dt correction rejection and require corner escape.
8. Labelled uniform module footprint versus size-based hit count as Changed from spec.
9. Cited/assert known1.02 x 1.90 x 1.01 battery dimensions; asset recipe now describes existing visor/face/backpack and forbids regeneration.
10. Added useCoarsePointer to verified helpers; collected U1-U4 as pending user decisions. Documentation/spec only; no build/runtime results claimed.

## Decisions (user, 2026-10-24)

The user approved this design and asked Claude to settle every open question with a modern, fair arcade feel in mind. These answers override the Open questions above; the build follows them.

- **Core (Claude adds before the builds):** a points game that ends on `"timeup"` with a score above 0 plays the win cue and confetti like a finish, not the lose sting; `GameDefinition.clockChip: false` hides the shell's Played chip for games that show their own clock.
- U1 late cadence: 3.0 s (as proposed).
- U2 two mirror break orders: approved.
- U3 listed departures: approved (desktop neutral braking, three recharges, rules-clock win, 50 deg close follow, the 1.75 m suit with backpack, uniform footprints, dock/reset/lock rules, backlog-only simultaneous breaks).
- Decision (user, 2026-10-24): equal arcs on touch and keyboard (standing decision 7: timing windows 60/45/35° identical on touch and keyboard; touch keeps only non-timing help like larger tap targets and visual aids, never a wider window; scoring limits stay valid because wider touch arcs never raised the bound).
- Modern look: the new station module GLB (`/models/3d/space-repair/stationModule.glb`) for the modules; Earth rim light, star parallax, jetpack flame fx, sparks on repairs.

## Claude merge review (2026-10-24)

- Limits verified (arcade-score-limits): the ticket-count envelope in "Server limits" holds (30 tickets x 150 + 200 = 4700; every prefix under 400 + 40 t; earliest loss 37.67 s; win at exactly 120 s); the oracle's best 4504 = 95.8 % of maxScore. Copied into `meta.scoring` and `arcade-games.json` (`enabled: false`, status `dev`); `rules.test.ts` pins meta = `PROPOSED_LIMITS`. Mutation probes (perfect AND, miss clears perfect, bonus floor) are caught; a "never lose" mutation hangs the suite instead of failing (bots loop without a frame cap): add a frame/time cap to the degenerate-bot loops.
- Playtest (headless, 1280 x 800 / 390 x 844 banner open / 844 x 390): 20-22 draw calls, p95 17 ms on desktop, no console errors, HUD and ring clear of the banner and controls, suit 40-60 CSS px. Fixed: the depth-independent wireframe outline washed the whole suit out to a pale ghost; it is now an x-ray drawn only where something in front hides the suit (`depthFunc: GreaterDepth`, opacity 0.22).
- Open (Codex): in 844 x 390 a TargetMarkers arrow can sit on the suit.

## Look (2026-10-25)

Visual-only modern-look pass for P-113:
- **Palette and tones:** unified into `looks.ts` `COLORS` with deliberate multi-tone sci-fi styling across all visible code-made stand-ins (central docking hub, pressurized struts, solar wings, battery cells, wrench tool, fallback module and astronaut). No raw grey boxes.
- **Lighting and environment:** core `space` lighting preset with deep space fog `[COLORS.fog, 55, 140]` (Earth sits inside the near distance, so the fog does not grey it out) and `<SkyDome>` from `core/env`. Earth is main's planet: sphere radius 12 at `[0, −25, −12]`, rim radius 12.15 at opacity 0.065. The canvas map keeps the cloud bands.
- **Station, not a floor:** core plus truss arms and dock ports only. The full-screen light deck and the navy perimeter ring (cyan blocks) were removed in the 2026-10-25 visual gate: they hid Earth and the stars and read as a warehouse floor. Hub and truss metal is `#1e293b`. Earth is main's planet (sphere r12 at [0, −25, −12]). Stars stay 600 / 220 / 120 by quality tier. `HULL_GROUND` in `looks.ts` is only the camera-test envelope; it is not drawn.
- **Surroundings outside play area:** `Decor.tsx` with instanced low-poly asteroid belt (tones A/B), distant station modules and solar wings, orbital communication satellites, and deep cosmic nebula clouds. All decor strictly outside the play arena bounds `[-10, 10]`, with zero line-of-sight occlusion to modules, service discs, or the player from the fitted camera.
- **Juicy feedback:** camera shake on a miss (`fx.shake(0.12)`), spark bursts and sparkles on hits and awards (scaled up for perfect repairs: 24 sparks, 16 sparkles, shake 0.12), and light starfield counts on phones (`600` on high tier, reduced to `220` on mid tier and `120` on low tier).
- **Resource discipline:** all geometries and materials allocated once and disposed on unmount. No `dispose={null}` on any `<primitive attach="geometry">` (preserving R3F v8 disposal). Zero per-frame allocations.

### Draw-call budget estimate

| Component | Draw calls | Notes |
|---|---:|---|
| Astronaut | 5–7 | HumanoidModel suit, jet nozzles & flame instances, wrench, x-ray outline |
| Station | 15–18 | Instanced modules, multi-tone hub & struts, solar wings, labels decal, dynamic rings/docks/pips/debris, battery cell, Earth & rim |
| Decor | 6–7 | Asteroid field (tones A & B), distant modules & solar wings, satellites, nebula dust |
| Sky & Environment | 2 | SkyDome, Starfield |
| FX & Popups | 6–8 | Warmed particle pools (puff, sparks, sparkle, confetti) and score sprites |
| **Total** | **≤33** | The visual gate measured 36 with the deck. Removing the deck, perimeter ring and beacons drops 3 calls. Cap 40 |


## Five levels

The core level selector, unlocks and sum-of-level-bests leaderboard are used directly.
All eight modules and the same assets remain present. The plan's named wings describe
configurations of the existing station; no runner route, return objective or new layout is added.
The later Claude decision supersedes the backlog's shorter L2 schedule: all five levels retain
all 30 repair tickets and 120 seconds, so every level offers the same 4,700-point ceiling.

| Level | Title | Debris speed by stage (m/s) | Repair arcs by stage (degrees) | Miss lock (s) | Clear |
|---|---|---|---|---|---|
| 1 | Docking Bay | 1 / 1.2 / 1.4 | 60 / 45 / 35 | 0.50 | Win or 2,400 points |
| 2 | Power Wing | 1.2 / 1.4 / 1.6 | 59 / 44 / 34 | 0.52 | Win or 2,400 points |
| 3 | Comms Wing | 1.4 / 1.7 / 2.0 | 58 / 43 / 33 | 0.54 | Win or 2,400 points |
| 4 | External Platform | 1.6 / 1.9 / 2.3 | 57 / 42 / 32 | 0.56 | Win or 2,400 points |
| 5 | Station Emergency | 1.8 / 2.2 / 2.6 | 56 / 41 / 31 | 0.60 | Win or 2,400 points |

Periods stay 1.2 / 1 / 0.8 seconds throughout. Difficulty increases in every stage:
faster moving debris, narrower timing windows and longer recovery from a miss.
Touch and keyboard use the exact same arc array and periods. The rules clock owns
the finish and bonus, as before; no shell duration override can cut off its final step.
HUD remaining time reads the selected config. Space lighting is retained on every level;
the plan's different lighting moods are not implemented in this task.

### Server limits and why they hold: per-level proofs

For each level the only score sources are a completed repair (100), its all-perfect
bonus (50), and the terminal surviving-power bonus (2 times floor(power), at most 200).
Cells add power, never points; hits before completion, collisions and skipped tickets add
no points. A repair generation consumes one issued ticket and pays once. Let N(t) be the
number of schedule entries at or before t. Before the finish, B(t) = 150 N(t); at 120 s,
B(120) = 150 * 30 + 200 = 4,700. For every one of the 30 schedule boundaries,
150 N(t) <= 400 + 40 t (checked independently for every level). Between boundaries
the left side is constant and the right side increases. At the finish 4,700 <= 5,200.
This envelope does not assume player speed, perfect reaction or any minimum work time;
faster debris or narrower arcs cannot invalidate it.

Earliest loss: leaving every broken module unrepaired maximizes power drain. The first
five six-second intervals drain 6 * (1 + 2 + 3 + 4 + 5) = 90 power by 36 s. Six
broken modules then drain the remaining 10 in 10/6 s, giving 37 2/3 s. Repairs and
cells can only delay loss. Debris has no direct power penalty. Winning is exactly 120 s.
The unchanged window [37,000, 122,000] ms includes the earliest loss and at most 50 ms
of store-frame reconciliation; result-delay time is excluded. The original approved
exact combinatorial ceiling remains 4,700 without additional ceiling padding; duration
margins are 666.67 ms early and 2 s late. The same base/pps margin is retained.

| Proof | Tickets / finish | Per-source ceiling | maxScore | min/max duration ms | base / pps | Why the level changes preserve the bound |
|---|---|---|---|---|---|---|
| L1 Docking Bay | 30 / 120 s | 3,000 + 1,500 + 200 | 4,700 | 37,000 / 122,000 | 400 / 40 | Exact original engine, constants and limits; frozen-engine replay test |
| L2 Power Wing | 30 / 120 s | 3,000 + 1,500 + 200 | 4,700 | 37,000 / 122,000 | 400 / 40 | Same N(t), power drain, score events and deadline; smaller arcs only restrict hits |
| L3 Comms Wing | 30 / 120 s | 3,000 + 1,500 + 200 | 4,700 | 37,000 / 122,000 | 400 / 40 | Same independent ticket envelope and earliest-loss calculation; debris adds no points/drain |
| L4 External Platform | 30 / 120 s | 3,000 + 1,500 + 200 | 4,700 | 37,000 / 122,000 | 400 / 40 | Narrower arcs and longer locks cannot generate tickets or extra awards |
| L5 Station Emergency | 30 / 120 s | 3,000 + 1,500 + 200 | 4,700 | 37,000 / 122,000 | 400 / 40 | Same N(t) and finish bonus; longest lock and fastest debris never increase score sources |

Fair service discs remain outside the entire debris collision envelope:
7.6 cos(pi/32) - 6 - 0.6 - 0.45 - 0.25 > 0.06 m, independently of debris speed.
No frame-loop allocation was added: the level config is captured once at run creation.
The test-only today.rules.fixture.ts freezes the pre-task engine; replay hashes compare
all serialized simulation state every frame, excluding only the new config and callback.
The original rules.test.ts stays byte-identical.

## Camera views

Views: default and top (the stick stays screen-fixed). **C** / **T** or the 📷 button cycles them; drag (or two fingers) looks around and switches to the free view, wheel / pinch zooms, **V** recenters. The rules receive the drawn camera's yaw (the fitted yaw in the default view), so a run in the default view is unchanged; no rules, bots, proofs or scoring were touched. Core docs: `core/camera/README.md`.
