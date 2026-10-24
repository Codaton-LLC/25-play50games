[PLAY50 TASK P-66-levels-construction-worker] Worktree: <WORKTREE>. Branch: <agent>/levels-construction-worker (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-66-levels-construction-worker | 5 levels for construction-worker | branch <agent>/levels-construction-worker | allowed: play50games-frontend/src/arcade3d/games/construction-worker/**". Check against `git branch --show-current`; stop if it differs.

construction-worker gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Level = per-level `COUNTS` row + `CLOCK_S`: the `COUNTS` rows are frozen into `PLAN` once at module load (rules.ts:64-74), so levels need `createRun(seed, level)` plumbing. The built 240 s / 36-piece full shift IS the plan's L5 ("full shift combining every mechanic"), so levels are re-ordered around it — the backlog's recommendation; flag the ordering at merge. The plan's walking fetch-and-place loop and parallel objectives were never built (crane + pendulum, strictly sequential `PLAN`) — do not build them.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 19 — Construction Worker": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The construction-worker folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx, looks.ts.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "construction-worker" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 240 s / 36-piece full shift): maxScore 6100, minDurationMs 9000, maxDurationMs 242000, base 0, maxPointsPerSec 150.

Per-level config (rules.ts constants, from the backlog; `COUNTS` rows :49-53, `CLOCK_S` :6):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Garden Shed | `COUNTS [2,2,2,1,1]→[1,1,1,0,0]` (3 pieces, 1 floor); `CLOCK_S 240→120` | medium — the `t(k)=0.88+1.13k` floor and the 6100 ceiling (README proof ¶1-4) assume 36 pieces / 240 s → own limits; the `TIME_BONUS 5` (:42) ceiling shrinks with the clock |
| 2 | Tiny House | `COUNTS→[2,1,1,1,0]` (5 pieces); `CLOCK_S→150` | medium — same per-level proof rework; shorter clock lowers the time-bonus ceiling |
| 3 | Garage | house row `[2,2,2,1,1]` (8 pieces); wind enabled early via a NEW level flag (wind is tower-only today, rules.ts:484-489); `CLOCK_S→180` | low-medium — wind changes dynamics but not the score proof (it uses only the 7.8/8.9 gates + the 0.25 s dwell, README :48) |
| 4 | Shop Front | shop row `[3,3,3,2,1]` (12 pieces); `CLOCK_S→180` | medium — 12 pieces / 180 s re-derives the win floor and the time-bonus ceiling |
| 5 | Mini Tower | today's full 36-piece `COUNTS` (all three buildings) as-is; `CLOCK_S 240` unchanged | low-medium — today's 240 s proof (6100, minDurationMs 9000 vs `t(9)=11.05 s`) carries over |

Rules:
- Level 1 = the [1,1,1,0,0] / 120 s truncated plan (dev game; no bests to migrate); today's full shift anchors L5 (backlog-recommended re-ordering — the built game strictly dominates every plan level). Existing rules.test.ts must pass unchanged.
- Levels 2-5 are harder variants, same assets (no new GLBs; plan props are procedural or shared). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 — with a 3-piece L1 the 6100 L5 ceiling may breach the ratio: if L1's computed maxScore is under ~2000, raise L1/L2 piece counts rather than capping L5, and state the ratio in HANDOFF.
- Do NOT build the plan's parallel plan ordering (L4) or multiple zones/workstations (L3) — `PLAN` is strictly sequential (:64-74); flag, don't build.
- Per-level lighting is NOT supported (`lighting: "day"` hardcoded, index.tsx:16 / Scene.tsx:80 / looks.ts COLORS); keep the day look.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
