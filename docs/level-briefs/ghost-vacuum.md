[PLAY50 TASK P-59-levels-ghost-vacuum] Worktree: <WORKTREE>. Branch: <agent>/levels-ghost-vacuum (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-ghost-vacuum | 5 levels for ghost-vacuum | branch <agent>/levels-ghost-vacuum | allowed: play50games-frontend/src/arcade3d/games/ghost-vacuum/**". Check against `git branch --show-current`; stop if it differs.

ghost-vacuum gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Count scaling IS the built-in win (`caught === COUNT`) — levels are `COUNT`/`SCHEDULE`/`DURATION_MS` slices; the cleanest count-scaling of all games.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 18 — Ghost Vacuum": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The ghost-vacuum folder: README.md (incl. "Scoring and proof" :31-40), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "ghost-vacuum" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's game = 12 ghosts / 120 s): maxScore 2630, minDurationMs 91000, maxDurationMs 122000, base 1720, maxPointsPerSec 10.

Per-level config (rules.ts constants, from the backlog; `SCHEDULE` (:16) sliced to the first N releases per level; night look stays — "bright" contradicts the night mechanic):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Living Room | `COUNT 12→4` (:9) + schedule slice; `DURATION_MS 120_000→180_000` (:8) | low — per-level max = 4·300 + bonus; envelope `1720+10t` re-derived (closed form per COUNT) |
| 2 | Library | `COUNT→6` + slice; `DURATION_MS→180_000`; active cap `elapsed<40?3:6` (:99) → `<25?2:4` | low-medium — `minDurationMs 91000` was pinned to gold ghost 11 @90 s (:16) — slicing the schedule changes it |
| 3 | Kitchen | `COUNT→8`; `DURATION_MS→200_000`; ghost speeds `wander/flee +20%` (:12); late-switch `60→45` (:159, hardcoded — needs a param) | low-medium — per-level max recomputed from the schedule; tWin lower bound re-derived |
| 4 | Attic | `COUNT→10`; `DURATION_MS→220_000`; `LIGHT.exposure 0.4→0.5` (:13); active cap → `<30?3:6` (:99) | low-medium — longer exposure slows captures → lowers achievable score; min-duration bound re-checked |
| 5 | Whole Mansion | today's config kept: `COUNT 12`, full `SCHEDULE`, `DURATION_MS 120_000` (plan's 300 s ≫ proven maxDurationMs 122000) | low — today's config is the proven one |

Rules:
- Level 1 = the 4-ghost slice (dev game; no bests to migrate). Today's 12-ghost/120 s game IS the plan's L5 and anchors there; the backlog recommends this re-ordering — flag it at merge. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — hunter/ghost GLBs owned; the plan's "capture orb" is unnecessary, payment is direct :205-212). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Parameterize the two hardcoded phase switches (:99 active cap, :159 late-switch) as level inputs; do not build the plan's blocked/locked paths (fixed walls, no door logic) — flag, don't build.
- Per-level lighting NOT supported (night hardcoded, index.tsx:17-21) — keep night.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
