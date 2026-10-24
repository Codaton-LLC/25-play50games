[PLAY50 TASK P-69-levels-museum-guard] Worktree: <WORKTREE>. Branch: <agent>/levels-museum-guard (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-69-levels-museum-guard | 5 levels for museum-guard | branch <agent>/levels-museum-guard | allowed: play50games-frontend/src/arcade3d/games/museum-guard/**". Check against `git branch --show-current`; stop if it differs.

museum-guard gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. The plan's core (WASD patrol through 3-12 rooms, E to interact) was never built — the built game is a fixed-spot flashlight defence on an 8-pedestal ring, so the plan's "wings/rooms" map ONLY to ring size (`RING.count` + `KINDS` roster) and `PHASES` knobs. Exhibit counts ≠ 8 need roster + `pedestalAngle` coverage re-proofs.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 12 — Museum Guard": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The museum-guard folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "museum-guard" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 8-pedestal / 90 s-dawn game): maxScore 2050, minDurationMs 12000, maxDurationMs 92000, base 0, maxPointsPerSec 25.

Per-level config (rules.ts constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Main Hall | today's config unchanged: `RING.count 8` (:9), `PHASES.dawn 90` (:48), `PHASES.ends [30,60,90]` (:42) | low — the only fully proven config (both-exits/cone proof :680-684); the plan's smaller "4 exhibits / 180 s" L1 is dropped |
| 2 | Ancient Wing | `RING.count 8→6` + `KINDS→2/2/1/1` (:76); `PHASES.dawn 90→105` | medium — dawn 105 raises the ceiling (5·105 + returns + dawn bonus) → per-level maxScore; the 45°-spacing cone proof redone for 6 pedestals |
| 3 | Art Wing | `PHASES.cap [2,3,3]→[3,3,4]` (:44), `PHASES.gap [4.2,3.6,3.2]→[3.6,3.2,2.8]` (:46), `PHASES.speed→[1,1.2,1.35]` (:43), `PHASES.dawn→120` | medium-high — more starts raise `SCORE.maxReturns 21` (:66) and the 25 pts/s prefix proof (README step 5) |
| 4 | Science Wing | `RING.count→10` + `KINDS→3/3/2/2` (:76); `PHASES.dawn→120` | high — pedestal count/spacing changes every path length → earliest-lose 13.79 s vs minDurationMs 12000 (README step 4) re-derived |
| 5 | Full Museum Night | `RING.count→12` + roster (:76); `PHASES.dawn→150` | high — longest dawn + most starts maximize the ceiling; per-level maxScore/pps + the fixture-lose proof all redone |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same ring, same phases, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — statues/doors/bench shared). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 — the ceiling scales with dawn × starts, so keep L2's dawn 105 close to L1's 90 and state each level's cap in HANDOFF.
- Do NOT build blocked/locked paths (L2/L3), free-position randomization (L4 — would break the 2.842/6.926 m path-length proof, README "Path"), or any patrol/movement (L5 "full-map route"); flag, don't build.
- Lighting: night IS the mechanic — the plan's bright/natural/dramatic/cinematic presets mostly contradict it, and `environment` is one hardcoded object (index.tsx:22); keep the night env.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
