# Deliverable I: Complete agent prompt library

Every prompt is copy-paste ready. Fill only the `<…>` fields the prompt names. Prompts point agents at files instead of pasting context (cheaper, never stale). Claude tells you when to paste each one (the order is in I.1 and in the roadmap, 09 §J).

## I.0 Shared blocks

### Common preamble

Every prompt for Codex, Antigravity and Kimi below starts with this preamble, filled in, and repeats its rules line ("Always: …"). Claude's own prompts are shorter because Claude works under CLAUDE.md.

```text
[PLAY50 TASK <ID>] Repo Codaton-LLC/25-play50games. Worktree: <worktree path>. Branch: <branch> (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK <ID> | <target> | branch <branch> | allowed: <allowed paths>"
and check it against `git branch --show-current` and the files you see. If anything does not match, stop and say what differs.
Read only the files this task lists (do not scan the whole repo; AGENTS.md first).
Rules: change only the allowed paths. Never edit package.json, package-lock.json or any Claude-owned file (CLAUDE.md "Ownership"). Never spend Hyper3D credits. Never upload to, test against or call production (cms.play50.games, the live Vercel site). Never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw. Style: 3-space indent, double quotes, semicolons; new UI = CSS Modules + existing CSS vars, never globals.css. If something generic is missing from arcade3d/core, do not build it in your folder: write it under "Open questions" and continue with what you can.
End with the HANDOFF block.
```

### HANDOFF block (the agent's final reply; games also paste it into their README "Status")

```text
HANDOFF <ID>
Branch / last commit: <branch> @ <sha>
Files changed (git diff --name-only main...HEAD): <list>
Checks: npm run build <pass/fail> | npx tsc --noEmit <pass/fail> | npx vitest run <N passed / failures> | node tools/gamecheck <slug> <pass/fail, if the tool exists>
Built (max 5 lines):
Scoring formula (games only):
Decisions I took and why:
Open questions for Claude or the user:
Known issues / follow-ups:
Evidence: screenshot paths, perf JSON paths
```

## I.1 Index: which prompt goes to which agent, in which order

| ID | Prompt | Agent | Branch | Phase | Prerequisites | Covers your category |
|---|---|---|---|---|---|---|
| P-00 | Agent capability probe (report only) | Codex, Antigravity, Kimi | `<agent>/probe` (no commits) | 0 | none | skills and tooling verification (10 §N, task N-04) |
| P-01 | Runtime baseline audit (report only) | Antigravity | `antigravity/baseline-audit` (no commits) | 0 | none | repository audit (runtime), performance |
| P-01b | Static audit re-check (report only, optional) | Kimi | `kimi/audit-recheck` (no commits) | 0 | none | repository audit |
| P-02 | Core P1-A: registry for 30 | Claude | `claude/expansion-registry` | 1 | your decisions D2, D4, D5 | cross-game integration, shared framework |
| P-03 | Core P1-B: effects, quality, perf probe, env, presets, shell fixes | Claude | `claude/expansion-fx` | 1 | P-02 merged | shared framework, performance |
| P-04 | Core P1-C: pure gameplay helpers | Codex | `codex/core-helpers` | 1 | none (new files only) | shared framework, physics, NPC |
| P-05 | Core P1-D: input, rig, render, kit, HUD | Claude | `claude/expansion-input-rig` | 1 | P-03, P-04 merged | shared framework, mobile controls, animation |
| P-06 | Audio cues and loops | Kimi | `kimi/core-audio` | 1 | none (one existing file) | audio integration |
| P-07 | `tools/gamecheck` + `tools/perf` | Kimi | `kimi/tools-gamecheck-perf` | 1 | P-03 merged (perf probe) | automated testing, performance |
| P-08 | UI kit: collections, loading card | Antigravity | `antigravity/ui-collections` | 1 | P-02 merged | shared UI components |
| P-09 | Style sheet v2 | ChatGPT | – | 2 | D1 | asset preparation |
| P-10 | Concept image (one per asset) | ChatGPT | – | 2 | P-09 picked | asset preparation |
| P-11 | Hyper3D batch N | Claude (your PC) | `claude/assets-batch-<n>` | 2, 4, 5 | concepts approved + "po, gjenero" | asset preparation |
| P-12 | Import, optimise, fit a GLB | Claude (your PC) | same as P-11 | 2, 4, 5 | P-11 results downloaded with your OK | asset optimisation and import |
| P-13 | Humanoid rig adoption (landmarks) | Claude | same as P-11 | 2, 4, 5 | a humanoid GLB imported | animation integration |
| P-14 | Game design README (G0) | game owner | `<agent>/design-<slug>` | 3–6 | spec approved, P-02 merged | game design |
| P-15 | Build one game | game owner | `<agent>/game-<slug>` | 3–6 | P-14 approved, core deps merged | individual game implementation |
| P-16 | Animation pass in a game (creature motion, custom poses) | game owner | the game branch | 3–6 | P-05 merged, GLB in the manifest | animation integration |
| P-17a | Mechanical review | Kimi | none (report) | every game | HANDOFF received | testing and debugging |
| P-17b | Adversarial review | Claude | none (review) → fixes by owner | every game | P-17a report | testing, refactoring |
| P-18 | Visual and mobile QA | Antigravity | none (report) | every game, wave end | game branch runs locally | visual QA, mobile controls |
| P-19 | Performance pass | Claude (core) / owner (game) | `claude/perf-<topic>` or the game branch | when a gate fails | `tools/perf` report | performance optimisation |
| P-20 | Wave-end integration and regression | Claude | `claude/wave-<n>-integration` | end of each wave | wave merged | cross-game integration |
| P-21 | Go-live audit (report only) | Antigravity or Kimi | none | 8 | game merged, your go-live decision | release preparation |
| P-22 | Go-live | Claude + you | `claude/golive-<slug>` | 8 | P-21 clean | release preparation |
| P-23 | Mobile controls tuning (core) | Claude | `claude/touch-tuning` | after wave 1 | P-18 reports of wave 1 | mobile controls |
| P-24 | Slim the agent read set (D10) | Claude | `claude/docs-slim` | 1 | D10 | cost |

---

## P-00 Agent capability probe (Codex, Antigravity, Kimi; report only)

```text
[PLAY50 TASK P-00] Repo Codaton-LLC/25-play50games. Worktree: <worktree path>. Branch: <agent>/probe (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-00 | capability probe | branch <agent>/probe | allowed: none (report only, nothing committed)"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md and docs/arcade-expansion/07-agents-and-skills.md §H.2.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Answer each question with evidence (command output or a screenshot path), at most 30 lines in total:
1. Which files did you load automatically as project instructions when this session started (AGENTS.md, CLAUDE.md, others)?
2. Project skills: do you support SKILL.md skills, and from which folder? Test it: copy docs/arcade-expansion/skills/arcade-playtest/ into that folder in this worktree (do NOT commit), start a fresh session or task, ask "what does the arcade-playtest skill do?", report whether it loaded by itself, then delete the copy.
3. In play50games-frontend: output of `node -v`, `npm -v`, `git --version`, and `npx vitest --version` (after `npm ci` if node_modules is missing).
4. Can you push from this worktree? Run `git push --dry-run origin HEAD` and paste the result (do not push).
5. Browser (Antigravity only): build with NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 `npx next build`, run `npx next start -p 3100`, open http://localhost:3100/3d/robot-collector in your browser agent, press Play: does the 3D scene draw? Screenshot.
6. Headless Chrome (Codex, Kimi): can you run `node tools/thumbs/capture.mjs --slugs robot-collector --base-url http://localhost:3100` against the same local build (install its deps with `npm install sharp ws --prefix tools/thumbs` first; never commit them)? Paste the last 10 lines.
7. How do you see your remaining usage or quota? Paste what it shows now.
Checks: every answer carries the command output or screenshot it asks for; `git status` is clean at the end.
Acceptance: all 7 questions answered with evidence; nothing committed, pushed or left behind (the copied skill deleted).
Do NOT: commit, push, edit tracked files, or call production.
End with the HANDOFF block (files changed: none).
```

## P-01 Runtime baseline audit (Antigravity, report only)

```text
[PLAY50 TASK P-01] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-antigravity. Branch: antigravity/baseline-audit (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-01 | baseline audit of the 10 existing games | branch antigravity/baseline-audit | allowed: none (report only)"
and check it against `git branch --show-current`. If anything does not match, stop and say what differs.
Read only: AGENTS.md, docs/arcade-expansion/01-repo-audit.md, play50games-frontend/src/arcade3d/core/README.md (sections "Time and frame order", "Camera fit and the safe area").
Rules: you change no file and make no commit. Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.

Role: QA engineer with a real browser (use your built-in browser agent).
Objective: measure how the 10 existing games behave today, so the expansion has a baseline.

Steps:
1. In play50games-frontend: `npm ci`, then
   `NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 npx next build` and `npx next start -p 3100` (on Windows set the env vars with `set` or `$env:`).
2. First check that WebGL renders in your browser: open http://localhost:3100/3d/robot-collector, press Play, and confirm the 3D scene draws (not stuck at "Loading"). Report yes/no; if no, stop and report what you see.
3. For each slug in play50games-frontend/src/arcade3d/types.ts ARCADE_SLUGS, at 1280x800 and at 390x844 (mobile emulation, touch, cookie banner left open):
   - play 30 s with the game's controls; pause with Esc and resume; finish or lose a run; press Retry three times;
   - from the DevTools console read `performance.now()`-based frame timing for 10 s (record p50/p95 ms) and, where available, renderer info via the React Three Fiber devtools or `window.__towerProbe` for tower-climb;
   - take one screenshot during play and one of the result panel.
4. Note anything broken, overlapped by the HUD/joystick/cookie banner, unreadable, or slow.

Checks: `git status` clean at the end; the server was localhost only.
Acceptance: a table with one row per game and view: renders (y/n), p50/p95 frame ms, Retry x3 ok (y/n), overlaps, bugs; screenshots saved outside the repo with their paths listed.
Do NOT: edit or commit anything; point anything at production; install global packages.
End with the HANDOFF block (files changed: none).
```

## P-01b Static audit re-check (Kimi, optional, report only)

```text
[PLAY50 TASK P-01b] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-kimi. Branch: kimi/audit-recheck (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST reply with exactly one line: "TASK P-01b | static audit re-check | branch kimi/audit-recheck | allowed: none (report only)" and check it against `git branch --show-current`; stop if it differs.
Read only: AGENTS.md, docs/arcade-expansion/01-repo-audit.md.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Objective: verify every [V] claim in 01-repo-audit.md against the code, cheaply. For each claim with a file and line, open exactly that file and range. Report: claim, verified / wrong / stale, the correct fact with file:line.
Checks: each verdict quotes the file:line you opened.
Acceptance: every [V] claim in 01-repo-audit.md has a verdict; wrong ones carry the correct fact.
Do NOT edit files, scan unrelated folders, or run builds. End with the HANDOFF block (files changed: none).
```

## P-02 Core P1-A: registry for 30 (Claude)

```text
[PLAY50 TASK P-02] Branch claude/expansion-registry from main, in a Claude worktree.
Read: CLAUDE.md, docs/arcade-expansion/README.md (§A.2–A.3, decisions), 02-production-matrix.md (§C.1, §C.4), 06-shared-library-and-architecture.md (§9.3 types, §F.1), 01-repo-audit.md (§B.8 L1–L3).
Objective: make the platform carry 30 games without showing unfinished ones.
Do:
1. types.ts: ARCADE_SLUGS += the 20 slugs of 02 §C.1 (keep the first 10 in order); ArcadeStatus "live" | "soon" | "dev"; ArcadeCollection; optional collection on ArcadeGameMeta (omitted = "originals", so the 10 existing meta files stay untouched); AgentOwner += "antigravity" | "kimi"; ControlScheme += "aim-drag" | "steer" | "timing" | "look" | "flight".
2. flags.ts: ARCADE_PREVIEW (NEXT_PUBLIC_ARCADE_PREVIEW, literal key).
3. 20 stub folders games/<slug>/{meta.ts,index.tsx} (status "dev", collection, order 11–30, owner per 02 §C.2, accent per 02 §C.1, provisional scoring per 02 §C.4, thumbnail null, index.tsx = PlaceholderScene); registry.ts and loaders.ts entries.
4. Visibility: getVisibleGames() hides "dev" unless ARCADE_PREVIEW; /3d, the hub teaser, sitemap, JSON-LD and OG use it; app/3d/[slug]: generateStaticParams keeps all 30 (static), the page calls notFound() for a "dev" slug unless ARCADE_PREVIEW; robots noindex for "dev" and "soon".
5. /3d: sections per collection (Originals, Adventure, Skill), interim: one ArcadeGrid per section (replaced by one ArcadeGrid with the `collections` prop when P-08 lands); hub and arcade copy counts from the registry (app/page.tsx lines 82, 113, 122 and app/3d/page.tsx line 35, "10" / "Ten").
6. arcade-games.json version 3: 20 new entries, enabled false, provisional limits (max_score = 1.5 × estimate, base = max_score, max_pps = max_score) so registry.sync.test.ts passes; php validation rules respected (slug regex, positive limits).
7. sharedAssets.ts: REUSED_ASSETS aliases for the game-folder GLBs listed in 06 §F.1 (url, budget, fallback, no game edits).
8. tools/thumbs: drop the 10-slug whitelist (accept any slug in ARCADE_SLUGS); load the input script from tools/thumbs/inputs/<slug>.mjs when it exists (owned by that game's owner), else the existing inputs.mjs entry, else a generic script (idle, then taps and arrow presses); export the loader for tools/perf. tools/og: skip games without a thumbnail (no failure).
9. Tests: registry (30 slugs, unique orders, every meta has a loader), visibility with and without the preview flag, sync test green.
Checks: npm run build (route table: /3d/[slug] 30 static pages; / and /classic unchanged First Load JS ±1 KB), npx tsc --noEmit, npx vitest run.
Acceptance: with all flags as on Vercel production, /3d shows exactly the same 10 games as before; with ARCADE_PREVIEW=1 it shows 30 in three sections; /3d/treasure-island is 404 without the preview flag.
Do NOT: change any game's gameplay, enable any new game on the server, upload anything.
```

## P-03 Core P1-B: effects, quality, perf probe, environment, presets, shell fixes (Claude)

```text
[PLAY50 TASK P-03] Branch claude/expansion-fx from main (after P-02), Claude worktree.
Read: core/README.md, docs/arcade-expansion/06-shared-library-and-architecture.md (§F.3, §9.1, §9.3 fx/quality/audio types, §10), 01-repo-audit.md (§B.8 L4–L6, L9, L12).
Objective: one shared look-and-feel layer, measurable performance, and the open shell bugs closed.
Do:
1. core/fx: pooled bursts (sparkle, puff, splash, debris, confetti, smoke, sparks, snow) on DynamicInstanced, useFx() with burst(kind, pos, count) and score(pos, text) (canvas-texture sprite pool), useCameraShake (CameraRig impulse, decays, respects reduced motion), <Trail>. No allocation per emit; counts scaled by useQuality().particles.
2. core/quality.ts: tiers from PerformanceMonitor declines + coarse pointer (06 §10.4), useQuality(), pure tierFor() with tests.
3. core/perfProbe.tsx: mounted by ShellStage when the URL has ?perf=1: window.__arcadePerf { calls, triangles, geometries, textures, programs, frames, p50, p95, max } (ring buffer, no allocation) and a tiny on-screen readout.
4. Lighting presets "sunset", "snow", "space" in ShellStage; core/env <Water>, <SkyDome>, <Starfield>, <SnowFall>.
5. GameShell: GameDefinition.touchLabels for Jump/Action; loops from audio (P-06 API) stop on pause, mute, over and unmount (if P-06 is not merged yet, this wiring moves to P-05).
6. Fix L12: Esc/P must not resume behind the rotate overlay; report env(safe-area-inset-bottom) in useSafeArea.
7. Baseline: run the perf probe by hand on the 10 existing games (desktop + 4x CPU emulation, the tools/thumbs input scripts) and put the numbers in the merge notes; Kimi's P-07 turns them into tools/perf/baseline.json with the tool.
8. core/README.md: one section per module with a 10-line example.
Checks: build, tsc, full vitest; all 10 existing games still play (headless CDP run of tools/thumbs) with no console errors and no perf regression (> 10% calls or > 20% p95).
Do NOT: edit any game folder; add dependencies.
```

## P-04 Core P1-C: pure gameplay helpers (Codex)

```text
[PLAY50 TASK P-04] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE-play50games (main checkout). Branch: codex/core-helpers (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-04 | core pure helpers | branch codex/core-helpers | allowed: play50games-frontend/src/arcade3d/core/{ballistics,path,motion,kinematics}.ts + .test.ts, core/ai/** , core/README.md (new sections only)"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md; docs/arcade-expansion/06-shared-library-and-architecture.md §9.3 (the interfaces you implement) and §9.4; play50games-frontend/src/arcade3d/core/README.md "Helpers"; core/collision.ts and core/math.ts (style, the `out` parameter pattern, Vec3-like {x,y,z}); core/collision.test.ts (test style).
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Rules: this is a delegated core task (decision D9): you may create/edit ONLY the allowed files above. No React, no three.js imports in these files: pure TypeScript, deterministic, allocation-free in hot paths (optional `out` params), no Math.random (take an rng or a seed), no Date.now.

Role: senior engine programmer writing small, pure, well-tested game math.
Objective: implement and test these modules exactly to the interfaces in §9.3 (names may only change if you explain why in the HANDOFF):
1. ballistics.ts: solveLaunch (low/high arc, null when out of range), launchForTime, stepProjectile (gravity + constant wind acceleration, semi-implicit Euler), trajectoryPoints (fills a Float32Array, stops at groundY), landingPoint (analytic, no wind; numeric with wind).
2. path.ts: createPath (polyline or Catmull-Rom with `samples` per segment, closed/open), arc-length table, pointAt, tangentAt, nearestS, advance(state, ds) for riders, PathGraph with junction choices for conveyors.
3. motion.ts: hop, waddle, hover, bank, spring (critically damped option), squashStretch; all return/fill small offset objects.
4. kinematics.ts: circle vs segment (XZ) detection + resolution with restitution and friction, moving segments (rotating blade around a pivot: contact velocity included), a fixed-substep integrator helper substep(dt, maxStep, fn), 2D rigid body step (x, y, angle, vx, vy, omega, thrust, torque, gravity) for a lander, a damped pendulum (1 and 2 axes) driven by pivot acceleration.
5. ai/: steering (seek, arrive, flee, wander with an rng, separate), vision (inViewCone, hasLineOfSightXZ against axis-aligned boxes), patrol (waypoint loop on a Path with waits, look-around, investigate(point) then return), index.ts.
Tests (vitest, *.test.ts next to each file), at least: ballistics vs closed-form at 3 ranges (< 1 mm), wind shifts the landing as expected; path arc length of a circle polygon within 0.5 %, pointAt continuity at joints, advance across a closed loop; kinematics energy never grows over 10,000 bounces with restitution ≤ 1, a 30/60/144 Hz frame split gives the same rest point within 1 mm (substep), pendulum amplitude decays; vision cone edges (just inside/outside), line of sight blocked by a box corner; patrol returns to its route after an investigation. Keep each test file under ~250 lines: test behaviour, not every branch.
Docs: add one section per module to core/README.md "Helpers" table + a 10-line usage example each.
Checks: in play50games-frontend `npm run build`, `npx tsc --noEmit`, `npx vitest run` all pass; `git diff --name-only main...HEAD` lists only the allowed files.
Acceptance: Claude can import each module from a game without changes; no allocation inside step functions (review will check); all tests green.
Do NOT: touch any other core file, game folder, package.json, or add dependencies; implement rendering; change existing helpers' behaviour.
End with the HANDOFF block.
```

## P-05 Core P1-D: input, rig, render, kit, HUD (Claude)

```text
[PLAY50 TASK P-05] Branch claude/expansion-input-rig from main (after P-03 and P-04), Claude worktree.
Read: core/README.md (incl. P-03/P-04 sections), 06 §9.3 (AimDrag, material, attachments, per-copy tint), §F.3, 05 §E.3.
Do:
1. inputController.ts + input.tsx: the aim-drag gesture (InputState.drag: active, released one-frame, start, current, power 0..1 over AIM_DRAG_FULL_PX, angle, cancelled under AIM_DRAG_MIN_PX); it coexists with tap/tapDown/swipe rules (a drag is never a swipe in a game that reads drag: definition-level opt-in `input: { drag: true }`); keyboard aim fallback documented; InputState.digit (one frame: 1–9 from Digit/Numpad keys, for pile, upgrade and slot choices). Pure tests in inputController.test.ts.
2. render/TrajectoryDots.tsx (instanced dots from ballistics.trajectoryPoints, fade, partial preview fraction).
3. assets.tsx: ModelAsset.material overrides (stone, bronze, gold, bone, custom) shared per kind (one material instance per kind per scene), honoured by <Model>, <InstancedModel> and <HumanoidModel>; a `tint` prop on <Model> and <HumanoidModel> (multiplies the GLB colour; one cached material per distinct tint); <DynamicInstancedModel> update(i, matrix, color) per-copy tint via instanceColor (GLB and fallbackParts).
4. rig/attachments.ts + <HumanoidModel attach={{ head, chest, handL, handR }}>: anchors from landmarks (head top, chest back, wrist + palm offset), children follow bones each frame (no allocation); tests on the runner (hat stays on the head through walk, carry, cheer within 1 cm).
5. core/kit: <Conveyor>, <Fence>, <Flashlight> (spot + additive cone, cone angle/range props matching ai/vision), <Pedestal>, <Gem>, <Parcel>.
6. core/hud: <TargetMarkers targets> (off-screen arrows placed inside the safe area), <TimingRing>.
7. core/README.md sections; adoption notes.
Checks: build, tsc, vitest; existing games unchanged in the headless run.
Do NOT: edit games; add dependencies.
```

## P-06 Audio cues and loops (Kimi)

```text
[PLAY50 TASK P-06] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-kimi. Branch: kimi/core-audio (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-06 | core audio cues and loops | branch kimi/core-audio | allowed: play50games-frontend/src/arcade3d/core/audio.ts, core/audio.test.ts, core/README.md section "Sound" only"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md; play50games-frontend/src/arcade3d/core/audio.ts and audio.test.ts (all of it); core/README.md section "Sound"; docs/arcade-expansion/06-shared-library-and-architecture.md §9.3 (the audio block).
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Rules: delegated core task (decision D9): only the allowed files. No audio files, no dependencies: everything is synthesized with Web Audio (oscillators, noise buffers, filters, envelopes), like the existing cues. Keep the gesture rules exactly as they are (initAudio, isAudioGesture, no AudioContext before a trusted gesture), and mute (play50games_3d_muted) must silence loops at once.

Role: audio programmer for a browser game platform.
Objective: extend the sound set for 20 new games.
Implement:
1. New SfxName cues: whoosh, splash, thud, chime, combo, buzz, boom, click, pop, zap, alarm. Each under 0.6 s, gentle (family audience), peak level matched to the existing cues.
2. playSfx(name, opts?: { pitch?: number (0.5..2), pan?: number (-1..1, StereoPannerNode), volume?: number (0..1) }) – backwards compatible (existing calls unchanged).
3. startLoop(name, opts?) for LoopName: engine, rotor, vacuum, belt, surf, bubbling, slide, thrust, hum, ambient. Returns { set({ pitch, volume, pan }), stop() } with 60 ms ramps (no clicks); a loop started before the first gesture is a silent handle that starts when audio becomes available; stopAllLoops() for the shell; at most 4 loops at once (the oldest stops).
4. Pure helpers testable without Web Audio (envelope maths, the loop registry, the 4-loop cap, mute handling) and tests in audio.test.ts (fake AudioContext as the existing tests do). Keep the test file growth under ~250 lines.
5. core/README.md "Sound": the new API with a 10-line example.
Checks: in play50games-frontend `npm run build`, `npx tsc --noEmit`, `npx vitest run` pass; `git diff --name-only main...HEAD` lists only the allowed files. Listen to every cue in a local page you do not commit, and describe each in one line in the HANDOFF.
Acceptance: every new cue and loop plays after the first gesture and is silent while muted; existing playSfx calls sound and behave exactly as before; at most 4 loops at once; tests green.
Do NOT: edit GameShell or any other file (Claude wires loops into pause/mute/unmount in P-03), add audio assets, change existing cue sounds.
End with the HANDOFF block.
```

## P-07 `tools/gamecheck` + `tools/perf` (Kimi)

```text
[PLAY50 TASK P-07] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-kimi. Branch: kimi/tools-gamecheck-perf (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-07 | tools/gamecheck + tools/perf | branch kimi/tools-gamecheck-perf | allowed: tools/gamecheck/**, tools/perf/**"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md; tools/thumbs/README.md, tools/thumbs/capture.mjs and inputs.mjs (reuse their CDP pattern and per-game input scripts); docs/arcade-expansion/03-game-specs-adventure.md "Common Definition of Done"; docs/arcade-expansion/06-shared-library-and-architecture.md §10.1 and §10.5; docs/arcade-expansion/09-roadmap-budget-qa.md §K.4 (budgets); play50games-frontend/src/arcade3d/core/perfProbe.tsx (window.__arcadePerf).
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Rules: Node 24 ESM. No committed package.json and no new dependencies: install what tools/thumbs already uses (`ws`, `sharp`) with `npm install <pkg> --prefix tools/<tool>` (gitignored, like tools/thumbs); any other package needs Claude's OK first. Only localhost URLs are accepted (refuse anything else, like tools/thumbs).

Role: build/test tooling engineer.
Build:
A. tools/gamecheck/index.mjs <slug> [--base main]: runs from the repo root and prints a pass/fail table:
   1. ownership: `git diff --name-only <base>...HEAD` ⊆ allowed paths (games/<slug>/**, public/images/3d/<slug>.webp, tools/thumbs/inputs/<slug>.mjs) unless --allow <glob> is given (core tasks);
   2. required files present (meta.ts, index.tsx, Scene.tsx, rules.ts, rules.test.ts, assets.ts, assets.spec.json, README.md);
   3. README has the template sections (from games/treasure-island/README.md headings once it exists; until then the list in the Definition of Done) and is ≤ 200 lines;
   4. rules.test.ts ≤ 600 lines (warning, not failure, above);
   5. forbidden imports in the folder (components/GameEngine, lib/storage/progressStorage, lib/api/progress, other games' folders, top-level useGLTF.preload, Math.random or Date.now inside rules.ts);
   6. meta.ts has no three/React imports; meta.scoring equals arcade-games.json (reuse the logic of registry.sync.test.ts or call vitest on it);
   7. `npx tsc --noEmit` and `npx vitest run src/arcade3d/games/<slug>` in play50games-frontend.
   Exit code non-zero on any failure. --json for machine output.
B. tools/perf/capture.mjs [--slugs a,b] [--base-url http://localhost:3100] [--cpu 1|4] [--seconds 30]: like tools/thumbs (headless Chrome over CDP), opens /3d/<slug>?perf=1, declines the cookie banner, plays with the game's input script (the loader Claude adds to tools/thumbs in P-02: tools/thumbs/inputs/<slug>.mjs, else the old inputs.mjs entry, else the generic script) for the given seconds, presses Retry 10 times (geometries/textures after each), reads window.__arcadePerf, writes tools/perf/out/<slug>.json; desktop 1280x800 and mobile 390x844 with touch emulation and CPU throttling.
C. tools/perf/compare.mjs: compares out/*.json with tools/perf/baseline.json; fails on calls +10 %, p95 +20 %, geometries or textures growing over the retries, or any budget breach from 06 §10.1; prints a table.
D. Baseline: run capture.mjs on the 10 existing games (desktop and 4x CPU mobile) and commit tools/perf/baseline.json (check it against the numbers in Claude's P-03 merge notes; explain differences over 10 %).
E. README.md for each tool; `node --test` tests for the pure parts (path rules, README section parsing, comparison maths).
Checks: `node --test` in both tools; run gamecheck on robot-collector (expect pass on the folder rules that apply to existing games; document which rules are expansion-only and skipped for the originals) and perf on robot-collector and tower-climb against a local server.
Acceptance: gamecheck fails on a branch that touches a path outside its allowed list (prove it with a scratch commit you then drop) and passes the applicable rules on robot-collector; capture + compare run end to end on two games; baseline.json committed.
Do NOT: touch play50games-frontend or any other folder; run against production; commit out/ files (gitignore them; baseline.json is the only committed result).
End with the HANDOFF block.
```

## P-08 UI kit: collections and loading card (Antigravity)

```text
[PLAY50 TASK P-08] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-antigravity. Branch: antigravity/ui-collections (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-08 | arcade UI collections | branch antigravity/ui-collections | allowed: play50games-frontend/src/arcade3d/ui/** (tsx + module.css + tests)"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md; play50games-frontend/src/arcade3d/ui/* (all files); play50games-frontend/src/arcade3d/types.ts (ArcadeGameMeta, ArcadeCollection); play50games-frontend/src/app/3d/page.tsx and page.module.css (how the grid is used); docs/arcade-expansion/02-production-matrix.md §C.1.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Rules: display components only. Hooks allowed: useBestScore, plus React useState/useEffect for the filter state only (sessionStorage inside try/catch). No fetching, no API/store imports, no three or @react-three imports. CSS Modules + existing CSS vars (--bg, --card, --stroke, --accent); never globals.css; no new dependencies.

Role: front-end engineer, mobile first, accessible.
Build:
1. ArcadeGrid: optional prop `collections?: Array<{ id: ArcadeCollection; title: string; blurb: string }>`; when given, render one section per collection (h2 + blurb + grid) and a row of filter chips ("All", "Originals", "Adventure", "Skill") as real buttons with aria-pressed; the filter is client state only (remember it in sessionStorage inside try/catch); without the prop it behaves exactly as today.
2. ArcadeCard: show a small collection label; "New" badge for games with order > 10 and status "live" (prop-driven, no date logic); keep every existing state ("soon" not clickable, "live" link).
3. A new display component ArcadeLoadingCard ({ meta }: thumbnail or accent gradient, title, a progress shimmer, reduced-motion safe) that Claude will wire into ArcadeGameMount.
4. Tests: a small vitest for the filter logic (pure function) only.
Check in your browser at 375px, 768px and 1280px with 30 games (use a local scratch page you do not commit that renders ArcadeGrid with the registry and NEXT_PUBLIC_ARCADE_PREVIEW=1): no horizontal overflow, focus visible, chips usable by keyboard, contrast ≥ 4.5:1. Attach screenshots.
Checks: `npm run build`, `npx tsc --noEmit`, `npx vitest run` pass; `git diff --name-only main...HEAD` lists only arcade3d/ui/**.
Acceptance: without the `collections` prop the grid renders exactly as today; with it, sections and chips work by mouse, touch and keyboard at 375 / 768 / 1280 px; screenshots attached. Claude then replaces P-02's interim one-grid-per-section on /3d with one ArcadeGrid that has the prop.
Do NOT: edit app/3d/page.tsx (Claude wires the prop), types, registry or any other folder.
End with the HANDOFF block.
```

## P-09 Style sheet v2 (ChatGPT)

```text
Create a style sheet for a family-friendly 3D browser game world called "Play50 toy world, premium edition". It must match an existing game whose hero is a matte white robot with soft blue panels and a glowing visor, and stylised human characters with slightly big heads, glasses and beards. Show on one 1536x1024 image: one small friendly character in a T-pose, five props (a wooden treasure chest, a boulder, a shopping cart, a cartoon cannon, a pine tree), an 8-colour palette (warm off-white #f4efe6, light grey #d4d4d8, slate #475569, gold #fbbf24, coral #f87171, mint #34d399, cyan #22d3ee, one world colour), and two material swatches (matte painted, satin). Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette with one bright accent per object, soft studio light, no outlines, no cel shading, no glossy plastic, no saturated candy colours, no text. Make 3 variations (A, B, C) as separate images.
```

You pick one; Claude saves it outside the repo if it shows a face, inside `tools/hyper3d/concepts/style-v2.webp` otherwise.

## P-10 Concept image (ChatGPT, one per image-to-3D asset)

```text
(Attach the chosen style sheet.) Matching the attached style sheet: premium stylised mobile-game concept art. One single <ASSET LINE FROM 05 §E.5>, three-quarter front view, the whole object visible from top to bottom, centred, on a plain light-grey background, soft even studio lighting, no shadow on the ground, no text, no logo, no other objects. Look: friendly rounded proportions, soft bevelled edges, simple clean shapes, matte to satin painted materials, restrained palette <PALETTE FROM 05 §E.5>. 1024x1024.
```

For humanoids append: `Full body from head to feet in a clean T-pose: arms straight out to the sides at shoulder height, palms down, legs slightly apart, standing upright, facing the viewer, nothing touching or connecting the arms to the body, empty hands.` Regenerate if the T-pose is not clean, a hand or foot is cut off, or an extra object appears. Paste the image into Claude Code on your PC.

## P-11 Hyper3D batch N (Claude, your PC, only after "po, gjenero batch N")

```text
[PLAY50 TASK P-11] Asset batch <N>. Local Claude Code on the user's PC (the Rodin MCP is there). Branch claude/assets-batch-<N> in a Claude worktree.
Read: docs/arcade-expansion/05-hyper3d-catalog.md (§E.2, §E.3, the batch table in §E.6 and each asset's entry), skills arcade-asset-batch (docs/arcade-expansion/skills/arcade-asset-batch/SKILL.md).
Preconditions (stop if one is missing): the user has written "po, gjenero batch <N>" in chat; every image-to-3D asset of the batch has an approved concept image saved in %USERPROFILE%\.play50\concepts\ (and, if it shows no face, a copy in tools/hyper3d/concepts/); the user has read the Hyper3D dashboard balance and it covers the batch plus its reserve.
Do: for each asset in batch order: upload the concept (rodin_create_uploads + PUT) when image mode; rodin_generate with tier Gen-2.5-Medium and the quality_override from the catalog, the prompt text exactly as in §E.5; rodin_wait; show the user the display_url (never the signed files[].url) and wait for "ok" before downloading; record every generation in the ledger (%USERPROFILE%\.play50\hyper3d-ledger.json) with the credits the dashboard shows. Retries without asking only while the batch's reserve (05 §E.6: 3 / 2 / 2) lasts, at most one per asset; any retry beyond the reserve needs a new "po" from the user.
Output: the downloaded base_basic_pbr.glb files in the scratchpad, a table (asset, task id, attempts, credits, verdict), then continue with P-12 for each accepted asset.
Do NOT: use HighPack or Extreme-High; generate anything not in the approved batch; commit raw files.
```

## P-12 Import, optimise, fit a GLB (Claude)

```text
[PLAY50 TASK P-12] Import and fit <asset id> for <slug|shared>. Same branch as P-11.
Read: skills arcade-model-adopt; 05 §E.4 (the asset row: target size, collision, orientation) and §E.5 (fit and checks).
Do: node tools/hyper3d/src/cli.mjs import <file> --slug <slug|shared> --id <id> → optimize <slug> --id <id> (must pass the budget) → add the url to core/modelManifest.ts in a new "expansion batch <N>" block → if the GLB is used by a game that already exists, set scale / stretch / rotationY / yOffset (and material where the catalog says so) in that game's assets.ts or in core sharedAssets.ts for shared ones; otherwise put a default fit in sharedAssets.ts / REUSED_ASSETS → add a size test (rendered bounds within 2 % of the target in metres, facing +z) → screenshot it in the game (or a scratch page outside the repo) under its lighting preset.
Checks: modelManifest.test.ts, the size test, build, tsc, vitest.
Do NOT: change gameplay; commit the scratch page or raw files.
```

## P-13 Humanoid rig adoption (Claude)

```text
[PLAY50 TASK P-13] Landmarks for <character> (<url>). Same branch as P-11.
Read: core/README.md "Characters: the auto-rig" (all of it, incl. "Landmarks, and measuring a character" and what went wrong on earlier characters), skills arcade-model-adopt (humanoid part), 05 §E.5 entry for the character (fit and checks).
Do: read the GLB positions; estimateHumanoidLandmarks; posed preview (rest, arms down, walk at 4 phases from the side, carry, cheer, reach; front, side, close-up) in a scratch page outside the repo; tune what looks wrong (sleeves → armRadius, helmets → headY/neckBlend, boots → ankleY, tabard/skirt → hemY); commit <NAME>_LANDMARKS on the asset (shared ones in sharedAssets.ts); add the character test with rig/characterChecks.ts describeCharacter (bind pose = static GLB, hands beside hips arms-down, nothing below the floor, planted foot within 1 cm through a walk, head rigid, skirt stretch < 2x if any); measure its height and write the per-game scale for the target height (05 §E.4).
Checks: the character test, build, tsc, vitest.
Output: the landmark set with the fields set by eye explained in comments, screenshots of the posed preview (outside the repo).
```

## P-14 Game design README, gate G0 (game owner)

```text
[PLAY50 TASK P-14] Repo Codaton-LLC/25-play50games. Worktree: <worktree path>. Branch: <agent>/design-<slug> (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-14 | design <slug> | branch <agent>/design-<slug> | allowed: play50games-frontend/src/arcade3d/games/<slug>/README.md, play50games-frontend/src/arcade3d/games/<slug>/assets.spec.json"
and check it against `git branch --show-current`. Stop if anything differs.
Read only: AGENTS.md; docs/arcade-expansion/<03-game-specs-adventure.md | 04-game-specs-skill.md> section "<N>. <Title>" and, in 03, "Conventions shared by all 20 specs" and "Common Definition of Done"; play50games-frontend/src/arcade3d/core/README.md (the sections for the modules your spec lists under "Dependencies"); play50games-frontend/src/arcade3d/games/treasure-island/README.md (the template; if it is not merged yet, robot-collector/README.md); docs/arcade-expansion/skills/arcade-game-design/SKILL.md (follow it).

Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Role: game designer and technical lead of <slug>.
Objective: turn the spec into an implementable design README (≤ 200 lines, template sections), and the asset spec. No code.
The README must state: concept, controls (desktop + touch, exactly what meta.ts will say), rules with every number you will use, the scoring formula and how you will prove its server limits, run end conditions (which end reason, when), camera (useFittedView area/pitch/yaws, follow or fixed), the core helpers you will use by name, assets (ids from 05 §E.4, classes, sizes, what is procedural), the file split, the test plan (what rules.test.ts proves, under ~600 lines), the perf budget (draw calls target), accessibility, known risks and open questions. Where you change something from the spec, say what and why.
assets.spec.json: the schema used by the existing games (copy clean-city's shape), only for assets this game owns (no shared ones).
Checks: `git diff --name-only main...HEAD` lists only the two allowed files.
Acceptance: Claude and the user can approve the design without a question the README could have answered; every item of the skill's validation checklist is ticked in the HANDOFF.
Do NOT: write code, create other files, change the spec in docs/.
End with the HANDOFF block (Open questions = what Claude or the user must decide).
```

## P-15 Build one game (game owner)

```text
[PLAY50 TASK P-15] Repo Codaton-LLC/25-play50games. Worktree: <worktree path>. Branch: <agent>/game-<slug> (already created by Claude; never create a branch. Codex in the main checkout: run `git switch` to it first; in the other worktrees it is already checked out).
FIRST, before reading or changing anything else, reply with exactly one line:
"TASK P-15 | build <slug> | branch <agent>/game-<slug> | allowed: play50games-frontend/src/arcade3d/games/<slug>/**, play50games-frontend/public/images/3d/<slug>.webp, tools/thumbs/inputs/<slug>.mjs"
and check it against `git branch --show-current`. Stop if anything differs.
Read only (in this order): AGENTS.md; play50games-frontend/src/arcade3d/games/<slug>/README.md (your approved design: it is the spec); docs/arcade-expansion/03-game-specs-adventure.md "Conventions shared by all 20 specs" + "Common testing criteria" + "Common Definition of Done"; play50games-frontend/src/arcade3d/core/README.md ("Time and frame order", "Input events", "Helpers", "Camera fit and the safe area", and the sections of every module your README lists); play50games-frontend/src/arcade3d/games/treasure-island/ (reference: Scene.tsx, rules.ts, rules.test.ts, index.tsx, meta.ts, assets.ts, README.md); docs/arcade-expansion/skills/arcade-game-build/SKILL.md and skills/arcade-score-limits/SKILL.md (follow them). Open other core files only to check a signature.

Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Role: owner and gameplay engineer of <slug> on an existing React Three Fiber platform (Next 14, React 18, three 0.170, R3F 8, drei 9, zustand 4, vitest 2).
Objective: <slug> playable end to end, meeting the Common Definition of Done, status stays "dev".

Requirements:
1. index.tsx default-exports a GameDefinition: Scene, Hud? (mark panels with data-arcade-safe-area), assets, durationMs / lives as designed, camera, environment (lighting preset from your README), touchControls, touchLabels, hudStats, instructions (≤ 3 lines), resultDelayMs for your end animation.
2. rules.ts: pure, deterministic with a seed (createRng / rngNext), no three/React/DOM, no Math.random / Date.now. All gameplay numbers live here. Use the core pure helpers your README names (collision, math, limits, ballistics, path, ai, motion, kinematics) instead of writing your own.
3. Scene.tsx: run state created once (useState), one useRunFrame calling rules.ts then the store (addScore, setStat/incStat, setLevel, loseLife, end); visuals only read the state in useFrame and animate with useGameTime() (never state.clock.elapsedTime); no setState and no allocation in frame callbacks.
4. Input: useInput(); discrete moves from input.pressed (never also from swipe); presses from tapDown or tap (one per action); aim from input.drag when your game opts in; movement through inputToWorld(moveX, moveY, view.yaw).
5. Camera: useFittedView({ area, pitch, yaws, focus, margin, shift: true }) (+ followFocus for follow cameras) and <CameraRig … offset shift>, so nothing important hides under the HUD, the controls or the cookie banner at 390x844.
6. Models: assets.ts lists ModelAssets (SHARED_ASSETS / REUSED_ASSETS from core for shared and reused ones; your own ids from 05 §E.4); render with <Model asset fallback={<YourPrimitive/>}>, <InstancedModel>, <DynamicInstancedModel> (per-copy tint where designed); humanoids with <HumanoidModel> + useHumanoidPose + walkStride / gaitPhaseStep + bodyLift (never a T-pose, never feet through the floor), attachments via attach={…}; solid creatures with core/motion. Missing GLBs fall back to your primitives (start with primitives; never edit the manifest or GLBs).
7. Effects and sound: core/fx (useFx, useCameraShake), core/env, core/kit, core/hud; playSfx / startLoop from core/audio (loops are stopped by the shell).
8. End the run with end("win" | "lose" | "timeup") as designed; never call submitScore, the arcade API or localStorage.
9. meta.ts: plain data; controls text matches the game; scoring stays as Claude set it (provisional) unless your HANDOFF asks for a change with the proof.
10. Playtest script and thumbnail: write tools/thumbs/inputs/<slug>.mjs (the only file you may add under tools/; same shape as the entries in tools/thumbs/inputs.mjs), then run tools/thumbs for <slug> against your local server, or leave thumbnail null.

Coding conventions: 3-space indent, double quotes, semicolons; small files by concern (camera.ts, poses.ts, Hud.tsx …) like the existing games; comments only where the code is not obvious.
Performance: draw calls ≤ the target in your README (hard cap 150); repeated props instanced; ≤ 1 extra dynamic light; no per-frame allocation; geometries/textures flat over 10 Retries (?perf=1).
Testing: rules.test.ts (≤ ~600 lines) covers determinism, every scoring event, win/lose conditions, the generators' validity over 1,000 seeds where you generate layouts, and the scoring-limit proof with a bot driving the real store (advanceRunClock + playedFrameDt), per the arcade-score-limits skill; character/size tests for every GLB you fit.
Checks before the HANDOFF: in play50games-frontend `npm run build`, `npx tsc --noEmit`, `npx vitest run`; from the repo root `node tools/gamecheck <slug>`; play it with keyboard at 1280x800 and with touch emulation at 390x844 (cookie banner open) and 844x390; `node tools/perf/capture.mjs --slugs <slug>`.
Acceptance: the Common Definition of Done (03), every item checked in the HANDOFF.
Handoff deliverables: the HANDOFF block (also pasted into README "Status"), screenshots at the three sizes, tools/perf JSON, the scoring formula and limit proof summary.
Do NOT: edit anything outside the allowed paths (core, types, registry, loaders, other games, tools other than your inputs file, package.json, arcade-games.json, the manifest, GLBs); import from another game; add dependencies; set status "soon" or "live"; spend credits; call production.
End with the HANDOFF block.
```

### P-15 parameters per game

| Slug | Owner / worktree | Spec section | Core modules to use | Assets (batch) | Watch out for |
|---|---|---|---|---|---|
| treasure-island | Claude | 03 §1 | env, fx, attachments, material, quality | chest, rock (1) | it becomes the template: README sections, test budget |
| museum-guard | Antigravity | 03 §2 | ai/vision, motion, material, kit Flashlight, audio pan | knight, dino, penguin (1–2) | drag-to-turn must not scroll the page; radar never hides the view |
| luggage-rush | Codex | 03 §3 | path (PathGraph), per-copy tint, kit Conveyor | suitcase (1) | junction rule tested at the crossing line |
| dino-egg-rescue | Antigravity | 03 §4 | motion, path, fx | dino, leafyTree (2), rock (1) | egg stack on the back through the waddle |
| delivery-drone | Codex | 03 §5 | ballistics, path, motion, TargetMarkers, startLoop | drone (2) | pendulum energy; city chunking for draw calls |
| shopping-cart | Antigravity | 03 §6 | ai/patrol, fx, startLoop | cart (1) | runner hands on the handle; no tunnelling at 9 m/s |
| snowball-battle | Claude | 03 §7 | ballistics, ai/steering, ai/vision, attachments | snowKid (3), pineTree (1) | AI fairness; throws never through forts |
| ghost-vacuum | Kimi | 03 §8 | ai/steering, ai/vision, attachments, kit Flashlight, startLoop | vacuum (2) | hose never through the body; ghosts cute |
| construction-worker | Kimi | 03 §9 | kinematics (pendulum), attachments, digit keys, fx | none | swing energy never grows |
| alien-farm | Kimi | 03 §10 | path, env Starfield, per-copy tint, material | alien, glowPod (3) | audio-first timing works |
| mini-golf | Claude | 04 §11 | kinematics, ballistics, aim-drag, TrajectoryDots, env Water | windmill (2) | frame-rate independence; every hole solvable |
| robot-factory | Kimi | 04 §12 | path, kit Conveyor, per-copy tint, fx sparks | none | finished robot walks off cleanly |
| pirate-cannons | Claude | 04 §13 | ballistics, path, aim-drag, TrajectoryDots, env Water | ship, cannon, chest (1) | documents aim-drag tuning for the family |
| castle-defender | Codex | 04 §14 | ballistics (launchForTime), path, motion, per-copy tint, digit keys | goblin, castleTower (3) | 40 goblins within the frame budget |
| penguin-slide | Codex | 04 §15 | path (spline), motion, env SnowFall, startLoop | penguin, fish, pineTree (1) | generator never impossible; memory flat over 3 min |
| space-repair | Antigravity | 04 §16 | kinematics, path, TargetMarkers, TimingRing, attachments, env Starfield | astronaut (3) | floating poses never a T |
| monster-kitchen | Kimi | 04 §17 | motion, tint, fx | monster, cauldron, fish (1) | order bubble vs HUD at 390x844 |
| knight-arena | Antigravity | 04 §18 | attachments, fx Trail, motion | knight, dummy (2) | swings read; sword never through the head |
| zoo-escape | Claude | 04 §19 | ai/patrol, ai/vision, ai/steering, ballistics, motion, kit Fence | panda, keeper (3) | drawn cones equal the logic |
| rocket-landing | Codex | 04 §20 | kinematics (rigid body 2D), env Starfield, fx, startLoop | rocket (2) | every planet landable on its fuel |

## P-16 Animation pass in a game (game owner, on the game branch)

```text
[PLAY50 TASK P-16] Same repo, worktree and branch as your P-15 task (<agent>/game-<slug>).
FIRST reply with exactly one line: "TASK P-16 | animation <slug> | branch <agent>/game-<slug> | allowed: play50games-frontend/src/arcade3d/games/<slug>/**" and check it against `git branch --show-current`; stop if it differs.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Read only: core/README.md "Characters: the auto-rig" (Driving a character, Limits) and the core/motion section; games/penalty-hero/poses.ts and poses.test.ts (how a game builds its own poses from aimArm / turnBone / setBoneEuler, pure and tested); your README.
Objective: every character and creature in <slug> moves believably: humanoids never T-pose, planted feet do not slide at walking speed (walkStride / gaitPhaseStep), the body is lifted by bodyLift; solid creatures use core/motion (hop, waddle, bank, squash) with the stride frequency matched to their speed; custom poses (swings, throws, digs) live in games/<slug>/poses.ts as pure functions with tests on the real mesh (rig/characterChecks.ts rigCharacter: hands where they should be, nothing below the floor, the head rigid).
Checks: build, tsc, vitest, gamecheck; side and front screenshots of each pose at 390x844.
Acceptance: no frame of any humanoid shows a T-pose; planted feet within 1 cm of the floor in the pose tests; creature motion matches its speed (no visible skating).
Do NOT: edit core/rig; add bones; use state.clock.elapsedTime.
End with the HANDOFF block.
```

## P-17a Mechanical review (Kimi, report only)

```text
[PLAY50 TASK P-17a] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-kimi. Review target: branch <agent>/game-<slug> (fetch it; do not commit or push anything).
FIRST reply with exactly one line: "TASK P-17a | review <slug> on <agent>/game-<slug> | allowed: none (report only)" and confirm the branch exists; stop if not.
Read only: docs/arcade-expansion/skills/arcade-review/SKILL.md (part A, mechanical) and the branch's games/<slug>/README.md and HANDOFF.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Do: in a separate review worktree, never your own: `git fetch origin <agent>/game-<slug>` then `git worktree add --detach ..\p50-review-<slug> origin/<agent>/game-<slug>` (run `npm ci` there); run `node tools/gamecheck <slug>`, `npm run build`, `npx tsc --noEmit`, `npx vitest run` in play50games-frontend; run tools/perf for <slug> against a local server and compare with the budgets; list every Definition-of-Done item as pass / fail / not checkable with evidence (command output lines, file:line).
Output: a report (≤ 60 lines) ordered by severity; no opinions on design (that is Claude's pass).
Checks: the report quotes the exit status of every command.
Acceptance: every Definition-of-Done item has a verdict with evidence; the review worktree is removed at the end (`git worktree remove ..\p50-review-<slug>`).
Do NOT: edit, commit, push or fix anything.
End with the HANDOFF block (files changed: none).
```

## P-17b Adversarial review (Claude)

```text
[PLAY50 TASK P-17b] Review <agent>/game-<slug>. Inputs: the owner's HANDOFF, Kimi's P-17a report.
Read: skills arcade-review (part B), the game's README and spec section, the diff (git diff main...origin/<branch>).
Do: ownership diff; read rules.ts and Scene.tsx fully; try to break scoring (bots that exploit: idle farming, pause abuse, spamming input, frame-rate changes) through the real store; mutation-probe the key tests (flip a comparison or a constant; a test must fail); check frame-loop rules (no allocation, no setState, useGameTime); play at 1280x800, 390x844 with the banner, 844x390 (headless CDP); check perf JSON; check the visual rules (no T-pose, feet, overlaps).
Output: one fix list for the owner (blockers / should / nice), ≤ 15 items, each with file:line and the expected behaviour. Plan one fix round; a second only for blockers.
```

## P-18 Visual and mobile QA (Antigravity, report only)

```text
[PLAY50 TASK P-18] Repo Codaton-LLC/25-play50games. Worktree: C:\Users\grani\Documents\WORKSPACE\p50-antigravity. Target: branch <agent>/game-<slug> (or main at a wave end). No commits.
FIRST reply with exactly one line: "TASK P-18 | visual QA <slug or wave> | target <branch> | allowed: none (report only)"; stop if the branch does not exist.
Read only: docs/arcade-expansion/skills/arcade-playtest/SKILL.md; the game's README "Controls" and "Visual direction"; docs/arcade-expansion/05-hyper3d-catalog.md §E.1 (style rules).
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Do: get the target into a separate review worktree, never your own: `git fetch origin <branch>` then `git worktree add --detach ..\p50-review-<slug> origin/<branch>` (`origin/main` at a wave end) and `npm ci` there; build there with NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 NEXT_PUBLIC_ARCADE_PREVIEW=1 and start on port 3100; in your browser agent play the game at 1280x800 (keyboard), 390x844 and 360x740 (touch, cookie banner open and closed), 844x390 landscape; record a short video of one run per size.
Check and report with screenshots: anything hidden under the HUD, the joystick/buttons or the banner; text readability; touch targets ≥ 44 px; controls match the instructions; characters never in a T-pose, feet on the floor, no clipping; colours follow the style rules (matte, restrained, one accent); effects readable but not noisy; Pause/Resume/Retry/Exit; reduced-motion behaviour; console errors.
Output: a report ordered by severity (≤ 40 lines) with screenshot and video paths.
Acceptance: every size covered (banner open and closed on phones), every check above answered; the review worktree removed at the end.
Do NOT: edit or commit anything.
End with the HANDOFF block (files changed: none).
```

## P-19 Performance pass (Claude core / owner game)

```text
[PLAY50 TASK P-19] Performance fix for <slug or core area>. Input: the tools/perf compare report (failing metric, numbers).
Read: 06 §10 (budgets, diagnosis order), the failing game's README perf section.
Do: reproduce with tools/perf (same CPU throttle and size) → diagnose in the §10.5 order (calls → triangles/textures → programs → overdraw → allocations) → fix in the owning code (game folder by the owner; core by Claude) → re-run tools/perf and the 10-retry memory check.
Acceptance: the metric back within budget, no other metric worse, tests green.
Do NOT: lower visual quality below the spec without the user's OK; touch other games.
```

When a game owner runs P-19 on its game branch, prefix it with:

```text
[PLAY50 TASK P-19] Repo Codaton-LLC/25-play50games. Worktree: <worktree path>. Branch: <agent>/game-<slug> (never create a branch; Codex in the main checkout: `git switch` to it first).
FIRST reply with exactly one line: "TASK P-19 | performance <slug> | branch <agent>/game-<slug> | allowed: play50games-frontend/src/arcade3d/games/<slug>/**" and check it against `git branch --show-current`; stop if it differs.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
End with the HANDOFF block (with the before/after tools/perf numbers).
```

## P-20 Wave-end integration and regression (Claude)

```text
[PLAY50 TASK P-20] Wave <n> integration on claude/wave-<n>-integration.
Do: merge main; full vitest + build (route table: / and /classic free of three.js, 30 static /3d pages); tools/thumbs for every game with a script (blank-canvas check) → thumbnails for the new games; tools/og cards for the new games; tools/perf for all games vs baseline; classic smoke (/classic, /games/1 Exit → /classic, /progress, /certificate); update docs/status.md (work board, what landed), CLAUDE.md "Where we are" one line; record actual effort per game in the ledger (09 §K.6) and recalibrate the next wave's estimates.
Output: the wave report (regressions, fixes, recalibrated estimates).
```

## P-21 Go-live audit (Antigravity or Kimi, report only)

```text
[PLAY50 TASK P-21] Repo Codaton-LLC/25-play50games. Worktree: <your worktree>. Target: main, game <slug>. No commits.
FIRST reply with exactly one line: "TASK P-21 | go-live audit <slug> | target main | allowed: none (report only)". Then confirm, by printing the meta.ts slug field, that you are auditing <slug> and nothing else.
Read only: docs/arcade-expansion/skills/arcade-go-live/SKILL.md (audit checklist), docs/arcade-expansion/09-roadmap-budget-qa.md §L, the game's README.
Always: change only the allowed paths; never edit package.json, package-lock.json, or Claude-owned files (CLAUDE.md "Ownership") outside this task's allowed paths; never spend Hyper3D credits; never call, test against or upload to production (cms.play50.games, the live Vercel site); never commit secrets, .env*.local, node_modules, .next or tools/hyper3d/raw.
Do: run the audit checklist against a local preview build (never production): DoD items, perf JSON within budgets, the README's limit proof present and matching meta.scoring, controls, overlaps with the cookie banner, console errors, a full run with keyboard and with touch.
Output: READY / NOT READY with blockers (file:line or screenshot), ≤ 30 lines.
Checks: the build, vitest and gamecheck commands of the checklist with their exit status.
Acceptance: READY only if every checklist item passes with evidence.
Do NOT: edit, commit, or touch production.
End with the HANDOFF block (files changed: none).
```

## P-22 Go-live (Claude + you)

```text
[PLAY50 TASK P-22] Go-live <slug> on claude/golive-<slug>.
Read: skills arcade-go-live; the P-21 report (must be READY); the README limit proof.
Do: set the proven limits in meta.scoring and arcade-games.json (enabled: true, version bump), meta status "live" (or "soon" if the user wants a teaser first); registry sync test; build; vitest; hand the user the exact JSON file to upload (play50games-backend/play50games/includes/arcade-games.json → server wp-content/themes/play50games/includes/arcade-games.json, after a Plesk backup); after the user confirms the upload, check GET /arcade/games (read-only) shows the new version; merge to main (Vercel deploys); check the live page as a guest (play one run, the best survives a reload) and the sitemap; record the go-live in docs/status.md.
Rollback: enabled false in the JSON (upload) and status back to "dev" (merge).
```

## P-23 Mobile controls tuning (Claude, after wave 1)

```text
[PLAY50 TASK P-23] Touch tuning on claude/touch-tuning, from the wave-1 P-18 reports and your phone notes.
Do: tune AIM_DRAG constants, joystick dead zone and lift, button sizes and labels, the swipe/tap thresholds only where reports show a problem; each change with a test in inputController.test.ts; re-run P-18 on two wave-1 games.
Do NOT: change a game's rules.
```

## P-24 Slim the agent read set (Claude, decision D10)

```text
[PLAY50 TASK P-24] Docs only, claude/docs-slim.
Do: move CLAUDE.md "Where we are" history, the per-game table and the open-thread log to docs/status.md (keep a 10-line summary and a link); keep CLAUDE.md under ~15 KB with contracts, rules and ownership; AGENTS.md: a "read set" per task type (game agent: AGENTS.md + core/README.md + its spec + its README + the reference game ≈ 70 KB); skills.md: point the expansion to docs/arcade-expansion/ and mark the old saturated style block as superseded by 05 §E.1.
Acceptance: no rule is lost (diff reviewed rule by rule); every prompt in 08 still points at existing sections.
```
