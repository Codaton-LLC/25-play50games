[PLAY50 TASK P-80-levels-dino-egg-rescue] Worktree: <WORKTREE>. Branch: <agent>/levels-dino-egg-rescue (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-80-levels-dino-egg-rescue | 5 levels for dino-egg-rescue | branch <agent>/levels-dino-egg-rescue | allowed: play50games-frontend/src/arcade3d/games/dino-egg-rescue/**". Check against `git branch --show-current`; stop if it differs.

dino-egg-rescue gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Built game: ONE nest, pure time-attack, no win state (README "Run end"); boulder lanes, mud, golden eggs — levels are hazard/supply constant sets, NOT the plan's matching-nests objective (no support).

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 14 — Dino Egg Rescue": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The dino-egg-rescue folder: README.md (incl. "Scoring" proof), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "dino-egg-rescue" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts: 6000 / 88000–92000 ms / base 0 / 70 pts/s; proven for exactly today's 90 s config: supply ≤ 33 × ≤150 + 3 golden × 300 = 5850 ≤ 6000, README:60-74). WARNING: minDurationMs/maxDurationMs are PINNED to the 90 s clock — any level with a different duration carries its own per-level limits; keep all levels at 90–120 s and re-derive both bounds.

Per-level config (constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Green Valley | today's game unchanged: `DURATION_MS 90_000` (:14), 4 boulder lanes (:86-91), `maxStack 3` (:101) | low — proof is for exactly today |
| 2 | Fern Forest | `BOULDERS.unlockS [0,0,30,60]→[0,15,30,45]` (:86-91); spawn-interval lerp faster (:526-528); `DURATION_MS→120_000` (150 s impossible — pinned limits) | high — duration change breaks both pinned bounds; supply proof re-runs |
| 3 | Riverbank | `MUD` 3→5 patches (:52-60); lane speeds `[3.6..5.2]→+0.5 each` (:86-91); `DURATION_MS→120_000` | high — supply envelope (`totalSpawnTicks 29`, :106-109) and 5850 bound re-derived |
| 4 | Volcanic Pass | `BOULDERS.unlockS→[0,0,0,15]`; `goldenSpawnTimes [25,50,75]→[20,40,60]` (:110); `DURATION_MS→120_000` | high — earlier goldens push scores toward 5850; rate bound 66.48 ≤ 70 has little headroom |
| 5 | Dino Sanctuary | `initialSupply 4→6`, `totalSpawnTicks 29→35` (:106-109); `maxStack 3→4` (needs 4th `stackMultipliers` entry, :101-104); `DURATION_MS→120_000` | high — supply ≤ 33 is the spine of the 5850 proof; full re-proof |

Rules:
- Level 1 = today's game byte-for-byte (dev game; no bests to migrate). Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — dino/rock/tree/volcano exist). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Plan mechanics with NO support (do not build): nest matching (one nest only), egg-counted win (runs end only by timeup), multi-zone maps. Per-level lighting NOT supported (sunset hardcoded, index.tsx:19-23) — keep the built look and flag.
- Plan timers (120–210 s) compress to ≤ ~120 s; every duration change needs per-level limits.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
