[PLAY50 TASK P-67-levels-shopping-cart] Worktree: <WORKTREE>. Branch: <agent>/levels-shopping-cart (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-67-levels-shopping-cart | 5 levels for shopping-cart | branch <agent>/levels-shopping-cart | allowed: play50games-frontend/src/arcade3d/games/shopping-cart/**". Check against `git branch --show-current`; stop if it differs.

shopping-cart gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Levels are pure constant sets — `LIST_COUNT` / `DURATION_MS` / shopper / spill knobs over the one fixed 32×24 store; moving hazards already exist as patrolling shoppers (:741-764), so no new mechanics are needed anywhere.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 16 — Crazy Shopping Cart": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The shopping-cart folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "shopping-cart" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts = PROPOSED_LIMITS rules.ts, today's 6-item / 75 s run): maxScore 2030, minDurationMs 3500, maxDurationMs 77000, base 1700, maxPointsPerSec 100.

Per-level config (rules.ts constants, from the backlog; built win = all listed items + `FINISH_ZONE` entry, :67-70, :797-803):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Mini Market | today's config unchanged: `LIST_COUNT 6` (:25), `DURATION_MS 75_000` (:24) | low — today's config is exactly the proven one (`MIN_WIN_ROUTE_M 30.91` :166, `MIN_TOUR_DISTANCE 52` :152) |
| 2 | Fresh Food | `LIST_COUNT→7`; `DURATION_MS→100_000` (the plan's 120 s breaks the proven 77 s cap) | medium — a longer `shortestPickTour` (:282-314) → the 2030 ceiling + `MIN_TOUR_DISTANCE` re-derived per level |
| 3 | Household Aisles | `LIST_COUNT→9`; 4th shopper active at 20 s instead of 40 (:732, :422); `SPILLS` spawn 25/50 s → 15/35 (:139-142); `DURATION_MS→150_000` | medium — shoppers/spills cost time (ceiling intact); 150 s ≫ 77 s → per-level maxDurationMs mandatory |
| 4 | Superstore | `LIST_COUNT→12`; `DURATION_MS→60_000` (resource pressure); `PYRAMIDS 6→8` (:128-137) for chokepoints | medium-high — 12-item tour distance and earliest-win move together; the `1700+100t` envelope re-proven |
| 5 | Closing-Time Rush | `LIST_COUNT→15`; `DURATION_MS→180_000`; `SPILLS`→3 puddles | medium — ceiling rises with items, but the time bonus shrinks with the clock; per-level limits mandatory at 180 s |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same list count, same clock, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs; the plan's "2-6 sub-zones" are free as extra `SOLID_OBSTACLES` AABBs :44-78, but they change routes → tour proof; only add them if the per-level proof is redone). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1.
- Fairness: identical timing windows for touch and keyboard.
- Per-level lighting is NOT supported (`lighting: "indoor"` hardcoded, index.tsx:15); keep the indoor look.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
