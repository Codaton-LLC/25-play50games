[PLAY50 TASK P-84-levels-monster-kitchen] Worktree: <WORKTREE>. Branch: <agent>/levels-monster-kitchen (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-84-levels-monster-kitchen | 5 levels for monster-kitchen | branch <agent>/levels-monster-kitchen | allowed: play50games-frontend/src/arcade3d/games/monster-kitchen/**". Check against `git branch --show-current`; stop if it differs.

monster-kitchen gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. USER DECISION (2026-10-24): the game STAYS AS BUILT — human chef cooking for monsters at a fixed station (ingredient wheel + cauldron, 2 order windows); no zones, no walking/carry, no re-theme. Levels differentiate only via window timing, order-length ramp, drift and patience.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 27 — Monster Kitchen": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The monster-kitchen folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "monster-kitchen" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, DECIDED 2026-10-24 = rules.PROPOSED_LIMITS: 4830 / 12000–92000 ms / base 240 / 60 pts/s; proven seed-independent ceiling 4680 × 1.03 → 4830, README "Server limits"). The proof chain (ceiling via B(t) ≤ 240+60t + windows :49-51, spam-lose angry ≥ order+3.5 s :51, drift) is tightly coupled — windowBAtS, DRIFT and PATIENCE.drains.grumpy are load-bearing; every change re-opens it. `maxDurationMs 92000` caps all levels at ~92 s.

Per-level config (constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Snack Bar | today's game unchanged: `DURATION_MS 90_000` (:16), `ORDERS.windowBAtS 70` (:56), `DRIFT {fromS 50, everyS 6}` (:83), `PATIENCE.max 10` (:75) | low as-is — limits proven for exactly this config |
| 2 | Monster Café | `ORDERS.windowBAtS 70→45` (:56); `lenAt`/`lenPick` thresholds `25/50→20/40` (:64-70); `DURATION_MS→120_000` (plan's 150 s over any sane cap) | medium — the ≤15-before-window-B / ≤8-after completion counts (:49) shift; ceiling 4680 and the B(t) slope (:50) re-proven |
| 3 | Busy Kitchen | `DRIFT.fromS 50→30`, `everyS 6→5` (:83); `ORDERS.windowBAtS→35` (:56); zones: NOT built — the two windows are the parallel pressure | high — drift cadence and window timing are load-bearing in the ceiling proof (:49-51); every change re-opens it |
| 4 | Dinner Rush | `PATIENCE.drains.grumpy 1.3→1.5` (:78), `penalty 3→4` (:76); `DRIFT.everyS→4` (:83); `WHEEL.slots 8` (:25) MUST stay — ring math is π/4-hardcoded (:218) | high — grumpy drain sets the min-duration (spam-lose) proof (:51) and penalty feeds it; drift feeds the ceiling; full re-proof |
| 5 | Grand Feast | all pressure knobs at once: `windowBAtS→30`; `DRIFT {30, 4}`; drains `{1.1, 1.3, 1.5}` (:78); `DURATION_MS→120_000`; cinematic env NOT supported (`indoor` hardcoded, index.tsx:22) — keep built look, flag | high — the whole proof chain (ceiling, windows, spam-lose, drift) is re-run; 120 s > 92000 → per-level meta.scoring mandatory |

Rules:
- Level 1 = today's game byte-for-byte (dev game; no bests to migrate): the 90 s / 2-window / 8-slot config stays L1. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — all 8 ingredient kinds + 3 monster types exist, README "Assets" :82-93). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Plan mechanics with NO support (do not build — user decision): multi-zone/workstation layouts, player movement + carry, "serve N orders" win condition (score attack only, README:58). Plan timers (120–210 s) exceed `maxDurationMs 92000`; levels 2-5 use ~120 s with per-level limits.
- Per-level lighting NOT supported (lighting hardcoded `indoor`, index.tsx:22; presets exist in core/lighting.ts:28 but the env override is core work — keep the built look and flag).
- `WHEEL.slots` stays 8 (π/4 ring math, :218).
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files or meta.scoring of level 1).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
