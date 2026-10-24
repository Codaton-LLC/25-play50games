[PLAY50 TASK P-72-levels-mini-golf] Worktree: <WORKTREE>. Branch: <agent>/levels-mini-golf (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-72-levels-mini-golf | 5 levels for mini-golf | branch <agent>/levels-mini-golf | allowed: play50games-frontend/src/arcade3d/games/mini-golf/**". Check against `git branch --show-current`; stop if it differs.

mini-golf gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Only 6 solver-proven holes exist (`HOLES`, course.ts:8; `createRun` already takes `course`, rules.ts:120), so Level 1 = today's full 6-hole course (par 17) and the plan's easier 3/4/5-hole subsets are NOT used — the plan's ideas land as harder variants on the same 6 holes; only L5 adds holes (9 = 3 NEW solver-proven designs; tunnels/ramps are procedural, no new GLB).

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 21 — Mini Golf 3D": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The mini-golf folder: README.md (incl. "Server limits and why they hold"), rules.ts, course.ts, physics.ts, rules.test.ts, course.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "mini-golf" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's fixed 6-hole course): maxScore 4100, minDurationMs 15000, maxDurationMs 602000, base 1200, maxPointsPerSec 200.

Per-level config (constants, from the backlog; plan level names kept, escalated onto the 6-hole course per decision 3):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Garden Course | today's 6-hole course unchanged (par 17); `PICK_UP_OVER 4` (:32), `RUN.capS 600` (:30) as-is | low — today's config is the proven one (4100 = Σ `holeScore` :36; the 15 s min-duration proof) |
| 2 | Ramp Course | same 6 holes; `BALL.vMax 4.5→5.0` (physics.ts:21); `PICK_UP_OVER 4→3` (:32); `RUN.capS 600→480 s` (:30) | high — vMax touches the physics bounds; the ceiling/duration proof is redone per hole |
| 3 | Windmill Course | same 6 holes; `TURNTABLE.omega 1.2→1.6-2.0` + windmill turn 6 s tighter (course.ts:110-130) = the plan's "moving targets" | medium — faster walls change the earliest-win / pick-up timing bounds (README limits proof) |
| 4 | Neon Course | same 6 holes; `CUP.radius 0.10→0.08`, `captureSpeed 1.2→1.0` (physics.ts:32-36) = smaller target | high — cup/capture changes touch the capture/lip-out tests and the par-solvability solver proof (course.test.ts) |
| 5 | Master Course | 9 holes — 3 NEW solver-proven hole designs (`HOLE_COUNT 6→9`, course.ts:8); `PICK_UP_OVER→2`; `RUN.capS→600 s` | high — each new hole adds ≤ 100·(par+2)+200 to the ceiling; every hole needs par-solvability + limits proof |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same 6 holes, same scoring, same limits. Existing rules.test.ts and course.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 — a 9-hole ceiling ≈ 1.5x the 6-hole 4100, well inside the guard.
- L5's 3 new holes must pass the beam-search solver proof (course.test.ts) — if solver runtime explodes, flag in HANDOFF rather than weakening the solver.
- Do NOT build the plan's "combo scoring" (`holeScore` :36 is fixed per hole); flag, don't build.
- Per-level lighting IS supported in this game (`levelEnvironment`, core levels.ts:52) — the only one of this batch; the plan's bright→cinematic moods are free preset swaps.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts / course.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
