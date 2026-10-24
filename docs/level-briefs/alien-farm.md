[PLAY50 TASK P-70-levels-alien-farm] Worktree: <WORKTREE>. Branch: <agent>/levels-alien-farm (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-70-levels-alien-farm | 5 levels for alien-farm | branch <agent>/levels-alien-farm | allowed: play50games-frontend/src/arcade3d/games/alien-farm/**". Check against `git branch --show-current`; stop if it differs.

alien-farm gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Levels are constant parameterization — `createRun(seed)` (:328) takes no level yet, so add the standard `createRun(seed, level)` plumbing — plus a re-run of the `bound.ts` certificate and the bots per level. The plan's crop-count win conditions (6-24 crops) have NO supporting code (runs end only by timeup, README "Run end") — score targets only; do not build a quota win.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 20 — Alien Farm": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The alien-farm folder: README.md (incl. "Server limits and why they hold"), rules.ts (incl. PROPOSED_LIMITS :144-153), rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "alien-farm" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 100 s / 9-bed game): maxScore 12900, minDurationMs 99000, maxDurationMs 102000, base 200, maxPointsPerSec 250.

Per-level config (rules.ts constants, from the backlog; the built 100 s pace is certified, so the plan's 120 s L1 is dropped):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Starter Plot | today's config unchanged: `DURATION_MS 100_000` (:15), 9 beds cycles 6/8 s (:54-64), `SHIP.speeds [2,2.5,3]` (:125), `HARVEST.capacity 4` (:111) | low — today's config is the certified one (S* = 12400, H* = 71, PROPOSED_LIMITS :144-153) |
| 2 | Crystal Farm | `SHIP.speeds→[1.7,2.1,2.5]` (:125); `PLOTS.activateAt 20/40→0` (:56-63); `DURATION_MS→150_000` | high — duration limits are pinned to 100 s (minDurationMs 99000 / maxDurationMs 102000, meta.ts:23-24); every pick bound in `bound.ts` re-runs for 150 s |
| 3 | Glow Marsh | `PLOTS.cycleS 6→5` (:55-63); `SPORES.lifeS 5→7` (:129); `DURATION_MS→180_000` | high — shorter cycles change the stage windows feeding the relaxation (`bound.ts`, README proof ¶2) and H*; certificate + bots re-run |
| 4 | Meteor Field | `SHIP.speeds→[2.5,3,3.5]`; `CYCLE.halfLate 0.6→0.5` (:96); `PLOTS.activateAt→0`; `DURATION_MS→180_000` | high — window widths (`CYCLE.half*` :93-96) feed the bound; a faster ship breaks the README ¶27 delivery trade-off assumptions → full re-proof |
| 5 | Grand Alien Harvest | `DURATION_MS→210_000`; `PLOTS.cycleS 6→5`, gourd `8→7`; keep `HARVEST.capacity 4` (:111) — 5 would break the ≤100-per-crop load argument (README ¶1) | high — S* roughly doubles at 210 s; maxScore/base/pps and the rate inequality re-derived per level |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same beds, same clock, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — all plan props exist or have stand-ins, README "Assets"). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 (12900 × 3 = 38700 headroom; state the computed L5/L1 ratio in HANDOFF).
- Do NOT build the plan's crop-quota win conditions or per-level lighting ("bright/natural/dramatic/cinematic" — only `lighting: "sunset"` exists, index.tsx:20); flag, don't build.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
