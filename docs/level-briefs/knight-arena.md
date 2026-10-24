[PLAY50 TASK P-65-levels-knight-arena] Worktree: <WORKTREE>. Branch: <agent>/levels-knight-arena (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-65-levels-knight-arena | 5 levels for knight-arena | branch <agent>/levels-knight-arena | allowed: play50games-frontend/src/arcade3d/games/knight-arena/**". Check against `git branch --show-current`; stop if it differs.

knight-arena gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. The built game is a 60 s / 4-stage / 140-slot rhythm score attack with no win/lose state — every plan level that asks for an attempt limit or moving dummies has NO supporting code, so levels are stage-mix / BPM / timing variants over `createBeatMap(seed)` caps (`BEAT.MAP_SEEDS` :98 is already pure).

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 28 — Knight Training Arena": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The knight-arena folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx, looks.ts.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "knight-arena" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 60 s / 4-stage / 140-slot game): maxScore 11600, minDurationMs 58000, maxDurationMs 62000, base 0, maxPointsPerSec 200.

Per-level config (rules.ts constants, from the backlog; the plan's attempt-limited target gallery and moving dummies have NO supporting code — no shot limit, `stepRun` never loses :457-572, posts are static :37-46):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Basic Training | today's game unchanged: all 4 stages, 140 slots, `BEAT.MAX_SHIELDS 12` (:99), `MAX_DOUBLES 29` (:99), `TOMATO_COUNT 18` (:99) | low — the only fully proven config (today's game is actually closest to the plan's L5) |
| 2 | Moving Targets | all-far stage-2 mix (`TARGETS.FAR_RADIUS_M 2.60 m` :55, the `maxPost 4:8` split :229); `BEAT.MAX_SHIELDS→0`, `TOMATO_COUNT→0` | low-medium — slot count unchanged → `scoreCeiling` 11090 (:403) holds |
| 3 | Timed Course | `stageDoubleTargets` start 50→23 (:175-178); `STAGES` bpm → 110/120/130/140 (:80-85) | medium — earlier doubles change the spin-schedule DP optimum (:345-392) → per-level maxScore + oracle re-run |
| 4 | Combo Arena | `COMBO.STEP_HITS 8→6` (:65); `STAGES` bpm → 140-150 (`periodMs` :84); `TARGETS.DISC_RADIUS_M 0.50→0.40` (:54, cosmetic — hits are timing-judged ±200 ms, `TIMING.ACTIVE_WINDOW_MS` :60) | medium — STEP_HITS changes the per-slot combo sum → ceiling re-summed |
| 5 | Royal Trial | today's map + stricter `TIMING.ON_BEAT_WINDOW_MS 110→90` (:61) | medium — the tighter window re-checks the 58-62 s duration proof (README step 6) |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same stages, same scoring, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 (the ceiling is slot-count-bound — same 140 slots, so caps stay near 11090 while achievable scores drop with BPM; flag in HANDOFF if a level's bot best falls under level 1's, per decision 3).
- Do NOT build the plan's attempt/shot limit (L1/L5) or moving dummies (L2-3) — both are new mechanics with no support; flag, don't build.
- Per-level lighting is NOT supported (single hardcoded sunset env, index.tsx:16-19); keep the sunset look.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
