[PLAY50 TASK P-68-levels-treasure-island] Worktree: <WORKTREE>. Branch: <agent>/levels-treasure-island (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-68-levels-treasure-island | 5 levels for treasure-island | branch <agent>/levels-treasure-island | allowed: play50games-frontend/src/arcade3d/games/treasure-island/**". Check against `git branch --show-current`; stop if it differs.

treasure-island gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Levels are `TREASURE_COUNT` / `DURATION_MS` / `TIDE` constant sets over the one fixed island (seeded placement already exists, :265-291). The built 5-treasure / 90 s game sits mid-plan (≈ the plan's L4), so levels are re-ordered around it — the backlog's recommendation, same as rocket-landing; flag the ordering at merge. The plan's clue→map-piece→final-chest chain, blocked/locked paths and rope bridge have NO supporting code (built win = the Nth dig, :656) — do not build them; a "map piece" could reuse the coin GLB if ever demanded.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 11 — Treasure Island": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The treasure-island folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "treasure-island" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 5-treasure / 90 s game): maxScore 2060, minDurationMs 8500, maxDurationMs 92000, base 1250, maxPointsPerSec 100.

Per-level config (rules.ts constants, from the backlog; the plan's 180-300 s timers are dropped — they need per-level limits far past the proven 92 s cap — 150 s keeps tide headroom):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Starter Beach | `TREASURE_COUNT 5→2` (:17); `DURATION_MS 90_000→150_000` (:16) | medium — `MIN_ROUTE = 29.9` (:437) and EARLIEST_WIN 8.98 s (:440) re-derive per count; maxScore recomputed |
| 2 | Palm Grove | `TREASURE_COUNT→3`; `DURATION_MS→150_000` | medium — as L1; the plan's "blocked path" has no support (props are pass-around AABBs) |
| 3 | Rocky Cove | `TREASURE_COUNT→4`; `TIDE.startS 70→55` (:51) = the pressure knob | medium — the proof cites `TIDE.startS = 70` (README "Server limits"); an earlier tide re-opens the earliest-win bound |
| 4 | Jungle Interior | today's config kept: `TREASURE_COUNT 5`, `DURATION_MS 90_000`; `TIDE.startS→60`, `finalShore 0.75→0.65` (:51) | medium — the full proof (MIN_ROUTE, 8.98 s vs minDurationMs 8500) re-proven; 2060 recomputed |
| 5 | Pirate Peak | `TREASURE_COUNT→6`; `SPACING.treasures 6→5` (:57); `ISLAND.rx 14→17` (:20-29) — camera fit re-checked | medium-high — bigger island + tighter spacing re-run the `IDEAL_ROUTE.min` bound; the plan's 300 s timer is dropped |

Rules:
- Level 1 = the 2-treasure / 150 s truncated plan (dev game; no bests to migrate); today's 5-treasure / 90 s game anchors L4 (backlog-recommended re-ordering). Existing rules.test.ts must pass unchanged.
- Levels 2-5 are harder variants, same assets (no new GLBs — chest/palm/rock/shovel exist, assets.ts:54-72). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 — with base 1250 + per-treasure points the caps scale gently; state the L5/L1 ratio in HANDOFF.
- Do NOT build the clue→chest chain, locked/blocked paths or the rope bridge (all new-mechanic code); flag, don't build.
- Per-level lighting is NOT supported (`lighting: "sunset"` hardcoded, index.tsx:20); keep the sunset look.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
