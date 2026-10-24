[PLAY50 TASK P-59-levels-delivery-drone] Worktree: <WORKTREE>. Branch: <agent>/levels-delivery-drone (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-delivery-drone | 5 levels for delivery-drone | branch <agent>/levels-delivery-drone | allowed: play50games-frontend/src/arcade3d/games/delivery-drone/**". Check against `git branch --show-current`; stop if it differs.

delivery-drone gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 15 — Delivery Drone": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The delivery-drone folder: README.md (incl. "Decisions" + "Server limits"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx, looks.ts.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "delivery-drone" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's game = 12 deliveries / 180 s): maxScore 3600, minDurationMs 20000, maxDurationMs 182000, base 300, maxPointsPerSec 75.

Per-level config (rules.ts constants, from the backlog; L1 anchors the slice — dev game, no bests to migrate):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Training Rooftop | `ROUTE.count 12→3`, `ROUTE.ceiling 180→120`, `CITY.towers 8→4` | low — maxScore → 900; loading-rate proof unchanged |
| 2 | Residential Blocks | `ROUTE.count→4`, `ceiling→150`, `ROUTE.padRadius 1.25→1.0`, `CITY.towers→6`, `WIND.from 60→45` | low — maxScore → 1200 |
| 3 | Downtown | `PIGEON.middleFrom 60→30`, `finalFrom 120→60`, `count 6→8`, `ROUTE.count→5`, `WIND.from→30` | low-medium — moving traffic has no support; pigeons are the only colliding hazard; maxScore → 1500 |
| 4 | Windy Towers | `WIND.accel 1.5→2.5`, `PARCEL.fragileFrom 8→4`, `fragilePrecision 40→50`, `ROUTE.count→6`, `BATTERY.drain 1→1.5` | medium — drain↑ invalidates the battery bound `97−4t` (README proof ¶2); per-level bot re-proof |
| 5 | Night Delivery | `ROUTE.count→8`, `ceiling→240`, `CITY.towers 8→12` | medium — 240 s ceiling + drain needs `BATTERY.initial` raised or proof redone; night lighting NOT supported (fog/sky hardcoded, `lighting:"day"` only) — keep day look |

Rules:
- Level 1 = the easy slice above (dev game; today's 12-delivery build stays available as the hardest config, ≈ plan L5 territory — see ordering note). Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1 per the slice widths here (decision 3 guard is about level ordering — flag at merge).
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).
- Ordering note: the backlog recommends today's config anchor near L5 with L1 as the 3-delivery slice; if Claude instead keeps "today's game = Level 1" verbatim, shift the slices up one and confirm at merge.

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
