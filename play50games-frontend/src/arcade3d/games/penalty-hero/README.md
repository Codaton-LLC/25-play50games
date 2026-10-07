# Penalty Hero

Owner: Cursor. Slug: `penalty-hero`. Accent `#f472b6`. Status stays `"soon"` until the game is reviewed and its models exist. **The game is playable** on primitives (striker, keeper, ball, goal, stadium); the striker and keeper GLBs drop in through `assets.ts`.

| File | What it owns |
|---|---|
| `meta.ts` | Card data, portrait orientation, thumbnail `/images/3d/penalty-hero.webp` and scoring limits. Plain data, server-safe; numeric limits match `arcade-games.json`. |
| `index.tsx` | `GameDefinition`: Scene, Hud, assets, camera (0, 4, 20) → (0, 1.22, 0), fov 40, `touchControls: ["tap"]`, one shell stat `shots` / 10, `finalScore` through `rules.finalScore`. No run timer or lives. |
| `rules.ts` | Pure seeded `createRun(seed)` and `step(state, dtMs, input)`: aim, accuracy, keeper draw, phases, outcomes and scoring, plus `zoneAt(x, y)` for goal-plane points and `aimPresses` (core `pressed` without swipes). No three.js/React/DOM/random source. |
| `rules.test.ts` | Vitest, including idle scoring, the duration/rate proof, shot targets, the limit cap, the zone mapping, keyboard presses and swipes through the core input controller, and a press judged where it landed (`tapDown`) against one judged on release (`tap`). |
| `Scene.tsx` | Mount seed (`randomSeed`), Simulation (`useRunFrame` → `step`; `tapDown` → ray → plane z = 0 → `zoneAt`; `pressed` → aim), store stats and sounds, `useFittedView` + `CameraRig`, visuals from phase progress and `useGameTime`. |
| `camera.ts` / `camera.test.ts` | Shared fitted-view bounds/config and projected whole-composition checks with the real Three.js camera. |
| `Primitives.tsx` | Stadium (canvas-texture pitch, crowd and boards), goal frame and net lines, code ball, striker and keeper fallbacks. The boards and the lowest crowd rows behind the net are dark and low-contrast, so they do not compete with the zones. |
| `Hud.tsx` / `Hud.module.css` | Goals/streak pill (below the shell HUD row, offset by the top safe-area inset), ten shot dots (✓ / ✕ plus colour) with the hint (lifted above the home indicator and the cookie banner), the aim deadline for the last 5 s (a large amber pill, red from 2 s, popping each second), GOAL / SAVED feedback (`aria-live="polite"`). The pill and the dots panel are `data-arcade-safe-area`. |
| `assets.ts` / `assets.spec.json` | Striker and keeper `ModelAsset`s / two character generation requests. No generated ball. |

### How the build maps to this design

- Store stats written by Scene: `shots` (shell HUD), `goals`, `streak`, `goalMask` (bit i = shot i scored), `feedback` (0 none, 1 goal, 2 saved, 3 wide, 4 timeout; cleared when the next aim starts) and `aimLeft` (whole seconds, only on change). `setScore` on every goal, `end("win")` on `ended`.
- Camera: `camera.ts` supplies the core `useFittedView` config. Its guarded box spans the goal guard, striker's full animated fit box, and ball/spot bounds; the scene passes the fitted offset and shift to `CameraRig`. The core avoids the shell HUD, both marked game-HUD panels, controls and cookie banner. The dots panel is marked `data-arcade-safe-area` and lifted by `var(--arcade-bottom-obstruction)`.
- Reticle: a ring over the highlighted zone at `x = centre + r / 0.6 * 1.04 m`; the white band is the `abs(r) <= 0.25` window. The ring turns green inside it.
- Keeper: rolls 65° about the hip toward side columns, lifts for the top row and, for a low dive, drops the hip (the stand-in) or pushes off and lands only 0.12 m lower (the GLB, so its boots and glove stay above the grass: `layout.ts` `keeperDivePlacement`); returns during the last 60 % of the hold. Striker: lean and lunge (+0.3 x, -0.65 z) in the run-up, a kick tilt in the first 200 ms of flight, back in the hold.
- Input (core "Input events"): a touch or a click shoots on the **press** (`input.tapDown`), never on the release. The shot samples the reticle of the last rendered frame, which is what was on screen when the finger landed, and locks on the next frame. `input.tap` would wait for the release and judge the shot 100–350 ms late, which turned well-timed taps wide. Keyboard aim reads `input.pressed` (arrow / WASD keydowns, latched by core), so a key tapped between two frames still moves the highlight, and two keys in one frame move both axes. The end delay is core's default `resultDelayMs` (800 ms).

### What a new game copies from here

- Use robot-collector on main as the structure template: this file split, server-safe metadata, a `GameDefinition`, pure seeded rules and tests proving server limits. Reuse core `useRunFrame`, `useInput`, store, `Model` and audio contracts. Never import another game's code.
- Make run state once in a lazy Scene `useState` initializer; do not call setState in the frame loop. `<Simulation />` calls `useRunFrame` → `step(state, dt, input)` → store actions/sound events. Core runs every `useRunFrame` before the camera and every plain `useFrame`, whatever the mount order. Visual callbacks only render the resulting state; they do not advance time.
- Core supplies what this design once planned locally: `useGameTime` (pause-safe animation clock), `useFittedView` + `CameraRig shift` (free-screen fit around the HUD, the game HUD's marked panels and the cookie banner), `<Model fallback>`, and `tapDown` / `pressed` input events. Use them; check `core/README.md` before copying anything.
- Do not copy warehouse props/layouts, camera yaw/follow, battery effects or scoring. Characters use `<Model asset fallback={<Primitive />}>`. Copy a generic utility only if needed and still absent from core.

## Concept

Ten penalties into a goal split into six zones. Choose a zone and strike when its wobbling reticle is centred. Accurate shots beat the keeper unless it dives into that zone; imprecise shots can go wide. Consecutive goals earn bonus **points**, displayed as `pts`; goals are a separate count.

## Controls

`meta.controls.scheme` stays `"tap-target"`; the published primary lines remain "Arrow keys to aim, Space to shoot" and "Tap a target zone".

| | Left | Centre | Right |
|---|---|---|---|
| Top | top-left | top-centre | top-right |
| Bottom | bottom-left | bottom-centre | bottom-right |

- Read `useInput().current`. In AIM, every direction press in `input.pressed` (a new arrow / WASD keydown; auto-repeat and held keys do not count) moves the highlight **one zone**. Clamp at edges, no wrapping; start bottom-centre, `up` means the top row. Both axes apply in one frame (two keys between two frames move diagonally); opposite presses in one frame cancel. A press during run-up, flight or hold is dropped, never kept for the next shot. Core latches every press, so a key tapped and released between two frames is never lost (`moveX` / `moveY`, sampled once per frame, would miss it).
- **Swipes do not aim** (a decision of this review). Core sets `pressed[direction]` for every swipe, with `swipe` on the same frame, so `aimPresses` drops the swipe's direction. On touch the zone is picked by touching it, and every swipe starts with a press that may already have shot; a swipe that also moved the highlight would act twice. A key of the same direction pressed in the very frame a swipe fires is dropped with it (a keyboard and a finger at once).
- Space (`jumpPressed`) or E/Enter (`actionPressed`) shoots the highlighted zone. Apply aim movement before the shooting edge; accept one shot per frame, never held `jump`/`action` auto-repeat.
- Touch/click: on the press, `Raycaster.setFromCamera(input.tapDown, camera)` then `ray.intersectPlane()` onto **z = 0**, using a `Plane` with normal `(0, 0, 1)`. Convert the point to a zone; never intersect keeper, ball, net or GLB meshes. Outside-zone presses, a parallel ray or no intersection do nothing, including no timeout reset. A press on a zone selects it and shoots once, judged by the reticle on screen when the finger landed (the last rendered frame); holding the finger, dragging or releasing changes nothing. `input.tap` is not read: it fires on release, up to 350 ms later.
- Zone bounds: x = -3.66..3.66, split at -1.22 and 1.22; y = 0..2.44, split at 1.22. Internal boundaries belong to the right/upper zone; include outer goal edges. A locked shot ignores further aim/shoot input through run-up, flight and feedback. At the 20 s deadline, timeout takes precedence over a new shot. Esc/P, hidden tab and blur belong to shell pause.

## Rules and skill

- Scene draws a **new random 32-bit seed on each mount**, outside `rules.ts`: its lazy initializer uses `crypto.getRandomValues(new Uint32Array(1))[0]`, then `createRun(seed)`. Retry/restart remount by `runId`. Asset seed 5155 is only the generation seed, not the gameplay seed.
- PRNG: **mulberry32**. Keeper selection uses integer weights: six weights initially 2; draw `floor(random * sum(weights))`, then select by integer cumulative sums. After a manual shot its chosen zone gains +1, including wide shots. Timeouts neither reinforce a zone nor draw a keeper choice. Seed plus the same dt/input timeline reproduces every result.
- Skill: during AIM a reticle wobbles horizontally about the selected zone centre. Normalized offset `r = 0.6 * sin(2 * PI * aimSeconds / 1.2 + phase)`; the marked centre band **`abs(r) <= 0.25`** is accurate. Draw each shot's phase from a separate mulberry32 stream seeded with `(seed ^ 0x9e3779b9) >>> 0`, so reticle draws cannot change keeper draws. Waiting for the band and firing there affects the outcome, rather than only keeper luck.
- At shot lock, record accuracy, selected zone and keeper draw once. Accurate + a different keeper zone = GOAL; matching zone = SAVED. An off-centre shot goes wide: target x = ±4.16 (outside the post, sign from r), y = selected row centre. Every miss is **SAVED**, 0 points, streak reset; custom Hud may add "Wide" as a secondary explanation.
- AIM times out after **20 s of simulation dt**. It is a forced miss, never an auto-shot of the selected/default zone: SAVED, 0 points, streak = 0. It still consumes the same 1600 ms cycle before counting as completed. A wholly idle ten-shot run scores **0**, with 0 goals and streak.
- Exactly ten shots, no early end. Commit each outcome once at flight completion, then finish feedback. After the tenth hold call **`end("win")`** once, even after ten misses; the shell's existing title is **"You did it!"**. Report final score/stats before end in that callback. GameShell owns results/submission; no game API/localStorage writes.
- Goal sound: **`playSfx("pickup")`**. Save/wide/timeout: **`playSfx("hit")`**, once at resolution. Pause/resume cannot replay events.

### Simulation timing and frame order

**Every shot timer, the 20 s aim timeout, reticle and every animation advance only by dt from the game's simulation `useRunFrame` → `rules.ts step(state, dt, input)`.** dt is seconds, core-clamped to `MAX_FRAME_DT = 0.05`; `run.time += dt` and phase timers live in that step. No `setTimeout`, `performance.now`, tween callbacks, `Date.now`, independent visual delta or stored `state.clock.elapsedTime` for gameplay/animations. R3F resets its elapsed clock on pause/resume.

| Phase after a shot or timeout locks | Minimum simulation time |
|---|---|
| Run-up / striker lean and lunge | 700 ms |
| Ball flight / keeper dive | 500 ms |
| GOAL or SAVED hold | 400 ms |
| Full cycle, including shot 10 | **1600 ms** |

`step` consumes frame time once, carrying remaining dt across phase boundaries without skipping or double-counting phases. Accept at most one shooting edge; do not reuse it in the next AIM. Finish the tenth hold before ending. dt <= 0 makes no progress. Pause stops the simulation callback, freezing all visual state.

`core/ShellStage` latches input (priority -2) and ticks RunClock (-1) before game callbacks. `useRunFrame` runs at the simulation priority (-0.5), before `CameraRig` (-0.25) and every plain `useFrame` (0), whatever the mount order (`core/README.md` "Time and frame order"). Visuals render phase progress in `useFrame` and animate with `useGameTime`, including paused resizes, without advancing the run.

## Scoring

`meta.scoring`: `kind: "points"`, `display: "int"`, **`unitLabel: "pts"`**. The limits were tightened on 2026-10-07 (from 1500, 150 pts/s and 10–600 s) to the proof below:

| Limit | Value |
|---|---|
| `base` | 0 |
| `maxPointsPerSec` | 95 |
| `maxScore` | 1450 |
| `minDurationMs` | 15500 |
| `maxDurationMs` | 225000 |

First goal after a miss: +100. Each consecutive goal: +150 (100 plus 50 streak bonus). Every miss: 0 and reset streak. Perfect run: `100 + 9 * 150 = 1450 pts`. No time bonus.

### Server limits and why they hold (the proof)

Server checks: integer score in [0, 1450], duration in [15500, 225000] ms and `score * 1000 <= 95 * durationMs`.

1. All ten cycles, including timeouts and the final hold, consume at least 1600 ms each of **simulation useRunFrame dt** (run-up 700 + flight 500 + hold 400; aim time can be 0 and leftover dt carries across phases): 16000 ms total simulation. The only end is `end("win")` after 10 cycles, so every run lasts at least that, whatever it scores. Wall clocks, renderer elapsed time and tween completions cannot shortcut that bound.
2. RunClock and Simulation use the same clamped delta, and core counts every played frame in `elapsedMs` (no untimed frame, `useRunFrame` dt = store `frameMs`), so the submitted floor is **16000 ms**. Pause advances neither. Use GameShell's default duration, `Math.round(elapsedMs)`, not the animation clock.
3. Minimum-duration margin: **500 ms** (3.1%) over `minDurationMs` 15500. The perfect score 1450 is exactly `maxScore`: the score is discrete and no clock is involved, so a margin would only hand forgers 1451–1500. Rate cap at the floor: `95 * 16 = 1520 pts`, a 70-point margin (4.8%) over the 90.625 pts/s a perfect run at the floor needs; integer inequality `1450000 <= 1520000`. Inside a run the rate peaks at 1450 / 15.6 s = 92.95 pts/s, just after the 10th goal commits and before its 400 ms hold, still under 95 (2.2%), so the per-frame rate checks hold too. On its own the line holds 1450 to a claimed 15263.2 ms or more (break-even), so with the 15500 ms minimum the rate line never binds for any score ≤ 1450: the accepted region is the rectangle 0–1450 by 15500–225000 ms.
4. Saves, wide shots and timeouts only remove points/break streaks, so every run <=1450. Waiting adds time, not points. Ten maximum waits plus cycles consume `10 * (20000 + 1600) = 216000` ms simulation; carrying remainder across boundaries and allowing one final frame gives submitted duration <=**216050 ms**, 8950 ms (4.1%) under 225000.
5. Reduced motion changes poses only; accuracy and phase durations stay identical. Pausing cannot complete a phase; skill cannot shorten the cycle. Idle runs score 0 at roughly 216 s and pass every limit.

Measured with throwaway bots (deleted, nothing committed): 1000 seeds × 7 dt patterns (50, 16.7, 8.3, 6.94, random 1–50, jitter, 0.5–2.5 ms) with an oracle bot that knew the keeper stream and a spam bot: 7000 perfect runs, fastest 1450 at 16454 ms (88.1 pts/s), median 17687 ms; shortest run of any kind 16000 ms, longest idle run 216048 ms. 22800 more runs (oracle, spam, random, idle) checked against these limits: 0 rejected, `capScore` never bound, highest in-run rate 92.1 pts/s.

The best a forger can post is 1450 at a claimed 15500 ms (before: 1500 at 10 s), and the run-token TTL drops to 525 s.

Defensive `capScore` uses `min(rawScore, 1450, floor(95 * Math.round(elapsedMs) / 1000))` at submission. It is a no-op for reachable completed runs (at 16000 ms it gives 1520, which `maxScore` caps to 1450) rather than hiding a broken bound with a clamp.

## Scene and camera

World units are metres, +y up, goal plane z = 0; striker faces -z:

| Piece | Dimensions / position |
|---|---|
| Goal opening | **7.32 × 2.44**, x = ±3.66, y = 0..2.44; each zone 2.44 × 1.22 |
| Frame / net | 0.06-thick frame outside opening; primitive net extends to z = -1.5 |
| Spot / ball | **11 m** from goal at (0, 0, 11); ball radius 0.11, centre (0, 0.11, 11) |
| Striker | **1.75 m** high, root (-0.65, 0, 11.8), 0.70 wide × 0.60 deep; animated fit box x = -1.1..0.35, y = 0..1.85, z = 10.8..12.1 |
| Keeper | 1.85 m high, root (0, 0, -0.15), facing +z; dives toward zone centres |
| Camera | Fixed (0, 4, 20), lookAt (0, 1.22, 0); perspective near 0.1 / far 400; aspect-dependent FOV/view offset |

Fit the whole composition: goal guard box x = ±4.06, y = -0.40..2.84, z = 0; striker box above; ball box x = ±0.11, y = 0..0.22, z = 10.89..11.11. The goal's 0.40 m margin covers frame/net and rigid dive bounds. Keep striker motion inside its declared box. No ball/keeper camera follow.

The implementation uses core `fitView` through `useFittedView`, with `shift: true` and the original camera pitch/minimum distance. The fit AABB is x = ±4.06 m, y = -0.40..2.84 m, z = 0..12.1 m: it covers the goal guard plus the striker box x = -1.1..0.35, y = 0..1.85, z = 10.8..12.1 and the ball/spot at z ≈ 11. `useSafeArea` supplies current HUD, controls and banner rectangles. `camera.test.ts` projects the goal, striker and ball boxes using Three.js and the core fit at desktop 1280 × 720 / 1280 × 800, portrait 390 × 844 / 360 × 740, and landscape 844 × 390 / 740 × 360, with the bottom panel and cookie obstruction both open and closed. Each projected shape must stay on-canvas and outside every safe-area rectangle. These are deterministic projection checks, not browser screenshots.

Therefore **`meta.orientation = "portrait"`**. On coarse pointers, landscape uses GameShell's rotate-device overlay and cannot start/continue shooting. Core's orientation gate does not apply to fine pointers: the planned game must also pause/block shooting when its measured target fit fails, with a custom-Hud hint to resize the desktop window or clear the obstruction, then require Resume after refitting. Enlarging only the landscape goal crops striker/spot; that is not this fit. Actual overlay/browser measurements, safe insets and cookie obstruction remain implementation acceptance checks; recompute before widening orientation support.

### Rigid animation plan

No skeletal clips. Character roots have floor pivots via `assets.ts`. During the 700 ms run-up, striker leans about x and lunges toward the ball (root moves at most +0.3 x / -0.65 z), within its animated fit box, then resets in the hold. During the **500 ms ball flight**, keeper translates toward the locked zone and rolls about z toward the dive (<=65 degrees; small roll for centre). Ease from normalized simulation phase progress; return to centre during the 400 ms hold. Ball arc/spin also uses that progress, never tween completion callbacks. Reduced motion uses restrained/stable poses but keeps durations, accuracy and a visible timing cue.

**The GLBs on the core auto-rig** (2026-10-06, drawing only; v2 GLBs 2026-10-07). Both characters are static T-pose GLBs: `<HumanoidModel>` (core/rig) builds their skeletons in code from the landmarks in `assets.ts` (`STRIKER_LANDMARKS`, `KEEPER_LANDMARKS`, measured once from the GLBs; `striker.test.ts`, `keeper.test.ts`) and `useHumanoidPose` builds each pose every frame from the same phase progress the groups use (`poses.ts`, pure; `poses.test.ts`):
- **v2 (2026-10-07):** the stylised Hyper3D characters (big head, glasses, beard; the arm span is now the longest side, so the scales come from the measured heights: 0.93 and 1.02 keep the first GLBs' 1.745 m and 1.852 m). Re-measured in posed previews: the arm band widened to the sleeves, the knees set behind the lower kneecap (the estimate's half hip height bent the leg inside the sock), rigid boots, shorts as two tubes, the head joint at the top of the short neck so the beard's lower edge stays on the collar when the head turns. Their shorter legs swing a shorter arc, so the run-up ends 5 cm nearer the ball (`RUNUP.z` -0.65) to keep the laces on it at contact (`poses.test.ts`). The keeper's low side dive no longer drops its hip 0.42 m (`keeperDivePlacement`): that sank a boot about 35 cm into the grass mid-dive and the near glove at the end, on the first GLBs as on these; it now pushes off and lands 0.12 m lower, and `keeper.test.ts` skins every dive on the real mesh as the scene draws it (nothing below the grass). Still open, unchanged by v2: the run-up's single stride is timed, not driven by the distance covered, so the planted foot slides about 40 cm over the walk part of the 700 ms run-up (44 cm with the first GLB); a distance-driven phase alone leaves about 25 cm, because the run-up path runs 25° off the striker's facing and turns 14° on the way, so it needs a run-up redesign rather than new landmarks.
- **Striker:** `idlePose` while aiming (a breath and a glance); over the run-up one stride of `walkPose` with an amount growing from 0.35 to 0.8 and, in its last quarter, the kick's backswing (`kickPose` 0 → 0.55: the kicking leg, its own right where the ball sits, swings back with the knee folded), so the laces meet the ball as the flight starts; the follow-through (`kickPose` 0.55 → 1, the leg out in front, the opposite arm forward, the body leaning back and twisted into the kick) over the first 150 ms of the flight; back to the idle through the hold. The 0.22 rad lean of the run-up (and the kick's extra 0.12) is the spine's (`turnBone`); every target is eased into at 25/s so a phase change never pops. The root still lunges and turns as planned; its stride and idle bobs and the whole-body lean are the stand-in's only (the GLB rises and falls with its planted foot through the rig's own lift).
- **Keeper:** `keeperReadyPose` (knees bent, leaning forward, both gloves out in front, breathing; the crouch lowers the body onto its flat soles) blended into `keeperDivePose` by the dive progress: to a side, the near arm reaches out and up (`reachPose`, high for the top row), the far arm up past the head, the legs trail bent (a jump's tuck) and the spine bends towards the ball; in the middle, both arms up for a high ball or forward in a crouch for a low one. The root's leap and the 65° roll about the hip stay as planned. Its sway (`layout.ts`: ±0.12 m for the GLB, ±0.22 m for the stand-in, faded out by the dive and back in after it instead of jumping at the flight's start) is a weight shift: `keeperReadyPose(t, out, shift, dip)` reaches both legs back to where the feet stood (two-bone IK from `KEEPER_LANDMARKS`), so the soles stay planted while the hips move between them, and the stand-in's hop becomes a bounce in the GLB's knees (`dip`, the body lowered over the same feet); `poses.test.ts` checks the feet stay within 2 mm. The kick leg is pinned to the ball's side: `layout.ts` holds the striker's root, the spot and the run-up offsets, and `poses.test.ts` turns the ball into the striker's frame at the backswing and at contact.
- Fallbacks: `StrikerPrimitive` / `KeeperPrimitive` with the rigid root animation exactly as before.

## Assets and prerequisite concept art

Before generation the user creates/approves these **two ChatGPT concepts**, attaching the chosen Play50 style sheet, and passes PNGs to Claude. Regenerate cropped hands/feet, extra objects or an incorrect T-pose. No paid generation is part of this review.

**Striker → `tools/hyper3d/concepts/penalty-hero-striker.png`:**

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of a friendly football striker mascot, bright blue kit with a clearly readable number 10 on the chest, chunky blue shorts, football boots, rounded vinyl-toy body, big expressive eyes, smooth rounded shapes, saturated colours, simple clean materials, no outlines or fine texture noise. T-pose with arms straight out to the sides and legs slightly apart, full body from head to feet, single figure centered, plain light-grey background, no shadow, no ball or other props, no text except the jersey number 10, no logo, soft even studio lighting, 1024x1024.
```

**Keeper → `tools/hyper3d/concepts/penalty-hero-keeper.png`:**

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of a friendly goalkeeper mascot, bright green kit, chunky green shorts, oversized goalkeeper gloves and football boots, rounded vinyl-toy body, big expressive eyes, smooth rounded shapes, saturated colours, simple clean materials, no outlines or fine texture noise. T-pose with arms straight out to the sides and legs slightly apart, full body including both gloves and feet, single figure centered, plain light-grey background, no shadow, no ball, goal or other props, no text, no logo, soft even studio lighting, 1024x1024.
```

| Model | Source | Spec | Fallback / rendering |
|---|---|---|---|
| striker | `/models/3d/penalty-hero/striker.glb`, this game (v2, 2026-10-07: 18k tris, 580 KB, 1.90 × 1.88 × 0.39 T-pose; `scale: 0.93` = **1.745 m**, turned to face −z) | `assets.spec.json`, image concept above | Blue capsule/head/boots; rigid root animation |
| keeper | `/models/3d/penalty-hero/keeper.glb`, this game (v2, 2026-10-07: 18k tris, 556 KB, 1.89 × 1.82 × 0.37 T-pose; `scale: 1.02` = **1.85 m**, facing +z) | `assets.spec.json`, image concept above | Green capsule/head/gloves; rigid translate/roll |
| ball | **Code primitive**, radius 0.11 | None | Sphere with simple black/white panels/materials, always code |
| goal frame/net, pitch, zones, reticle | Code primitives | None | Boxes/lines, plane and coloured markers |

Universe **`stadium`**, generation seed **5155**. Striker ×2 + keeper ×2 = four generations, estimated **2 credits** at 0.5 each. Removing the generated ball saves **0.5 credit**, previously 2.5. Character caps stay 20k tris / 1024 px / 1.5 MB. No skins needed. Claude handles approved concepts/models/generation/import/optimization; this branch touches neither GLBs nor concepts. Swap fallback/model in `assets.ts`, not rules or tap mapping.

## HUD

Exactly **one** shell `hudStat`: `{ key: "shots", label: "Shots", max: 10 }`, using completed shots 0..10. No lives or game countdown; shell Score / Played / Shots plus mute/pause stays one row at 375 px. Do not add Goals/Streak to `hudStats`. Score is points; results/bests use **`pts`**.

`definition.Hud` owns Goals, Streak, ten small bottom shot dots (pending/goal/miss plus text), reticle timing cue and GOAL/SAVED feedback. Reserve its height in the fit, use noninteractive `pointer-events: none`, and announce outcomes with `aria-live="polite"`; colour alone does not indicate results. Goals/streak may be store stats without being shell HUD stats.

Placement: the Goals/Streak pill sits at `env(safe-area-inset-top) + 4.4rem`, below the shell HUD row, which starts at the same inset (notch phones, `viewport-fit=cover`). The dots panel sits at `0.9rem + env(safe-area-inset-bottom) + var(--arcade-bottom-obstruction)`, the variable GameShell sets to the open cookie banner's height, so the banner never hides it (the touch controls use the same lift). The aim deadline shows the last 5 s of the 20 s as a large pill ("SHOOT! 4 s"), amber, then red from 2 s, popping once per second.

## Edge cases

- Pause/hidden tab freezes every timer and animation. Paused resize only reprojects state. The tenth hold resumes its remaining time before `end("win")`; end is idempotent. Zero-goal completion still uses the win title.
- Timeout outranks same-frame input. Outside taps do not prolong AIM. Held keys do not repeat. Score, weights, outcome and sound are committed once.
- Retry/restart clears phase, aim, streak, weights, score and seed. Strict Mode may initialize twice; there is no global run state or paid side effect.
- Rotation to landscape on coarse pointers invokes portrait gate and shell pause. On return, refit before shooting. Fine-pointer windows with an inadequate fit should also pause through the planned fit gate (not built). The fit already avoids the cookie banner (`useFittedView` obstructions); do not promise usable targets if an obstruction consumes required space.
- Missing/broken GLBs use primitives. Ball and tap regions do not depend on character geometry.

## Test plan

Planned `rules.test.ts` (Vitest, pure state/fake input, no wall-clock sleeps):

- Same seed/dt/input timeline reproduces results; uint32 extremes/multiple seeds, integer weighted draws, all zones reachable, exact +1/no timeout reinforcement, separate reticle stream.
- One zone per press, clamping at corners, diagonals in one frame, opposite presses cancel, Space/E edges, locked-phase presses dropped. Through the core input controller: a key tapped between two frames still moves, auto-repeat does not, a swipe does not aim, and a press (`tapDown`) is judged where it landed while a release (`tap`) 250 ms later goes wide. Deadline input cannot evade timeout.
- Accuracy inside/at/outside abs(r) = 0.25; goal versus keeper save; wide = SAVED/0/streak reset. dt = 0/reduced motion cannot change results.
- Streak 100/150/reset, perfect 1450, every other sequence <=1450. **Drive ten idle timeouts: 0 points, 0 goals, 0 streak, ten completed shots**, never auto-scoring the default zone.
- Every 700/500/400 ms phase, including final hold, at 60/120 Hz and irregular raw deltas clamped by core; carry remainder, no skipped cycle/reused edge/double resolution.
- Drive real `createArcadeStore` like ShellStage, RunClock first, through countdown/pause/resume/retry. Check the store and the run clock agree (no untimed frame since the core follow-up), submitted floor **16000 ms** (500 ms over the 15500 ms minimum), maximum <=216050 ms (8950 ms under 225000), the **70-point rate margin** at the floor (1520 against 1450), the in-run peak under 95 pts/s, and `capScore` a no-op for completed runs. The limits are pinned (1450, 15.5–225 s, 95 pts/s) with boundary checks.
- One `end("win")`, final score/stats before end, one pickup/hit event per result, no replay on resume. No renderer/wall-clock reads or `Math.random` in rules.

**Browser acceptance plan (pending Scene implementation):** local production build, arcade enabled and API mock enabled, never production WordPress.

- Desktop portrait 800 × 1000 keyboard, **375 × 812** touch emulation and one real portrait phone: ready → countdown → playing → pause/resume → ten shots → "You did it!" → Retry → idle ten-miss round (0 pts) → Exit. Check one-row shell HUD, custom stats/dots/feedback and exactly one sound per result.
- Project all six quads at 375 × 812 with real camera/canvas and overlay rects: >=44 × 44 CSS px, below HUD/above bottom Hud. Tap every zone/boundary/outside; tap over keeper/net and verify plane mapping. Compare to the measured projection table.
- At **812 × 375** with coarse-pointer emulation, rotate overlay blocks shots and pauses; return portrait and continue the same shot. Repeat on a fine-pointer desktop: the planned local fit gate pauses and shows the resize hint instead. Preserve the documented 30 px landscape failure rather than claim support. Test safe insets, cookie banner open/closed, resize/rotation mid-flight.
- Pause for 2.5 s separately in AIM, run-up, flight and final hold; hide/reveal and blur/focus. Resume identical reticle/ball/keeper progress, no extra timeout/shot/sound; test long-frame clamps and reduced motion.
- Mock submission score/duration matches proof; no-GLB fallback, focus/accessibility, no horizontal overflow, <=150 draw calls and 60 fps target on a mid phone. Runtime performance/screenshots are not yet measured.

## Known issues and core gaps

- Playable; the striker and keeper GLBs are drawn through the core auto-rig (Rigid animation plan), the primitives are their fallbacks. Projection measurements above check the earlier camera maths; the build uses core `useFittedView`. The keeper's far arm reaches up rather than across the body in a side dive (an arm crossing the chest crushes the shoulder in linear blend skinning).
- The fine-pointer fit gate (pause and a resize hint when a desktop window makes the zones smaller than 44 px) is not built. Coarse pointers still get GameShell's portrait gate.
- The fit now includes the goal, ball/penalty spot and the striker's animated bounds, so they stay clear of the HUD and cookie obstruction. `Hud.module.css` marks the dots panel as a safe area and lifts it by `--arcade-bottom-obstruction`; `camera.test.ts` pins projected clearance for the requested desktop and phone sizes, portrait and landscape, with the banner open and closed.
- Full-composition landscape targets fail 44 px height; metadata enforces portrait. Landscape support needs a separately measured camera/composition redesign, not different scoring limits.
- GameShell enforces orientation only on coarse pointers. The planned fit gate must cover inadequate fine-pointer viewports/large bottom obstructions too.
- Swipes never aim (see Controls). A same-direction key press in the frame a swipe fires is dropped with the swipe; that needs a keyboard and a finger at once.
- Core open items that touch this game: the bottom safe-area inset is not reported to the fit, and the cookie banner is found by a 1 s poll, so the dots panel's lift can trail the banner by up to a second.
