[PLAY50 TASK P-59-levels-pirate-cannons] Worktree: <WORKTREE>. Branch: <agent>/levels-pirate-cannons (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-pirate-cannons | 5 levels for pirate-cannons | branch <agent>/levels-pirate-cannons | allowed: play50games-frontend/src/arcade3d/games/pirate-cannons/**". Check against `git branch --show-current`; stop if it differs.

pirate-cannons gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 23 — Pirate Cannon Battle": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The pirate-cannons folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx, looks.ts.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "pirate-cannons" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 90 s / 3-lives wave game): maxScore 10500, minDurationMs 19000, maxDurationMs 92000, base 1500, maxPointsPerSec 110.

Per-level config (rules.ts constants, from the backlog; the plan's attempt-limited target gallery has NO supporting code — no shot limit, no win state — so levels are wave/difficulty variants of today's game):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Training Deck | `WAVES` as-is (:102-108), `DURATION_MS 90000`, `LIVES 3` | low — ceiling 10500 / 19000–92000 ms already proven (README) |
| 2 | Harbor Targets | `WAVES` lane arrays → weight lanes 1/2 (40/55 m) | low — more far-lane sinks raise `LANE_BONUS` take; `ceilingAt` re-summed |
| 3 | Moving Boats | `ZIG.sloopFromWave 4→1`; combo already `POINTS.combo 1.5 from 3` | low — zig/combo don't change `MAX_SCORE`; dramatic lighting NOT supported (`lighting:"day"` only) |
| 4 | Storm Battle | `WAVES` speed 1.0–1.4 → 1.15–1.6, wind 1.0–3.0 → 1.5–3.5; `SHIPS.dinghy r 0.7→0.55` | medium — the earliest-LOSS proof (20.54 s vs minDurationMs 19000, README §4) breaks with faster ships; re-proof needed |
| 5 | Captain Challenge | denser `WAVES` multisets; `SEA.maxAlive 8→12` | high — more ships/pairs raise `MAX_SCORE` past 10500 → per-level maxScore/base/maxPointsPerSec via new `ceilingAt` |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same waves, same scoring, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Do NOT build the plan's attempt/shot-limit mechanic — it is new end-condition code and out of scope; flag in HANDOFF if you believe a level needs it.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
