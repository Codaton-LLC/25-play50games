[PLAY50 TASK P-82-levels-luggage-rush] Worktree: <WORKTREE>. Branch: <agent>/levels-luggage-rush (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-82-levels-luggage-rush | 5 levels for luggage-rush | branch <agent>/levels-luggage-rush | allowed: play50games-frontend/src/arcade3d/games/luggage-rush/**". Check against `git branch --show-current`; stop if it differs.

luggage-rush gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Built game: one baggage hall, tap-to-flip diverters, 3-strike overflow, 120 s clock — levels are duration/belt/spawn constant sets; the plan's zones/workstations and the walking ground-worker loop were never built (README "Concept").

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 13 — Airport Luggage Rush": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The luggage-rush folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "luggage-rush" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts: 7620 / 10000–122000 ms / base 0 / 64 pts/s, PROVEN — oracle 77 bags / 7500 ≤ 7620, README "Server limits"; rules.test.ts pins them to PROPOSED_LIMITS). WARNING: every proposed duration exceeds `maxDurationMs 122000` — per-level limits are mandatory for levels 2-5.

Per-level config (constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Training Belt | today's game unchanged: `DURATION_MS 120_000` (:9), `BELT.base 1.35` (:33), `SPAWN {2.2, 0.9, 120}` (:36), `STRIKE_LIMIT 3` (:13) | low — existing proof (77 bags / 7500 ≤ 7620) carries over |
| 2 | Two Destinations | `DURATION_MS→150_000` (:9); `BELT.base 1.35→1.5` (:33); heavy/VIP rolls already exist (`ROLL` :355-366) | medium — longer run adds bags → new oracle proof; 150 s > `maxDurationMs 122000` must be raised |
| 3 | Four Destinations | `DURATION_MS→180_000` (:9); `PHASE_D3 40→30`, `PHASE_D4 70→55` (:14-15); `SPAWN.end 0.9→0.8` (:36); lighting preset swap IS supported (core `LIGHTING_PRESETS`, core/lighting.ts:26). 4-6 zones: NOT built — skip | high — 180 s far over the 122 s cap; earlier phases → full re-proof of maxScore/points-per-sec |
| 4 | Rush Hour | `DURATION_MS→180_000` (:9); `SPEED_AT` every 10 s instead of 15 (:34); `ROLL.heavyLate 0.3→0.4` (:355); "parallel tasks": NOT built — skip | high — heavier mix lowers throughput (heavy 0.70×), needs measured proof |
| 5 | International Hub | `DURATION_MS→210_000` (:9); `SPAWN.end→0.75`, `SPAWN.rampS 120→150` (:36); `BELT.base→1.55` (:33); a 5th flight needs a new `FLIGHTS` entry (:39-44, no GLB needed); 6 zones: NOT built — skip | high — bags spawn past 120 s; score ceiling far above 7620 → per-level limits mandatory |

Rules:
- Level 1 = today's game byte-for-byte (dev game; no bests to migrate): built 120 s fixed clock already matches plan L1. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs; a 5th flight is a `FLIGHTS` data row). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1 — a 210 s level will exceed 3×7620, so carry per-level meta.scoring and flag the decision-3 guard at merge.
- Plan mechanics with NO support (do not build): zone/workstation layouts and "parallel objectives" (new `PATHS` segments + chute meshes, :90-117). Lighting mood per level is cheap (core presets).
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files or meta.scoring of level 1).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
