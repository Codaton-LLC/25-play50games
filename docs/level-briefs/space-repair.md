[PLAY50 TASK P-59-levels-space-repair] Worktree: <WORKTREE>. Branch: <agent>/levels-space-repair (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-space-repair | 5 levels for space-repair | branch <agent>/levels-space-repair | allowed: play50games-frontend/src/arcade3d/games/space-repair/**". Check against `git branch --show-current`; stop if it differs.

space-repair gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. All five levels are `BREAKS.times` / `CLOCK.duration` / `DEBRIS.speeds` / `REPAIR` constant sets — all 8 modules are always present, moving hazards already exist as debris.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 26 — Space Repair Mission": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The space-repair folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "space-repair" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's game = 30 tickets / 120 s): maxScore 4700, minDurationMs 37000, maxDurationMs 122000, base 400, maxPointsPerSec 40 — proven for exactly this config (README; `PROPOSED_LIMITS` rules.ts:15).

Per-level config (rules.ts constants, from the backlog; the plan's "repair N systems" maps to ticket-count/schedule length, not new layouts; no forward-runner route, finish, or return-to-module mechanic exists — don't build them):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Docking Bay | today's config kept as-is: `BREAKS.times` 30 entries (:9), `CLOCK.duration 120` (:14), `DEBRIS.speeds [1,1.2,1.4]` (:11) | low — today's config is the proven one |
| 2 | Power Wing | `CLOCK.duration→90` (:14); `BREAKS.times` trimmed to ~15 tickets ending ≤84 s (:9) | medium — ceiling `30·150+200` drops with fewer tickets → per-level maxScore; earliest-loss 37.67 s bound (proof step 3) re-derived |
| 3 | Comms Wing | `DEBRIS.speeds→[1.4,1.7,2.0]` (:11); `REPAIR.periods [1.2,1,0.8]→[1.1,0.95,0.8]` (:10) | medium — periods tighten proof-step-2 hit-time bounds, not the ceiling; debris stays outside service discs (README:69) so fairness holds |
| 4 | External Platform | `speeds→[1.8,2.2,2.6]`; `REPAIR.fine [60,45,35]→[55,40,30]`, `coarse [90,75,60]→[80,65,50]` (:10); full 30-ticket schedule | medium — full schedule restores the 4700 ceiling but speeds change movement/work lower bounds; witness gate (≥24 repairs) must re-pass |
| 5 | Station Emergency | full schedule + `REPAIR.periods→[1.0,0.85,0.7]` (:10), `REPAIR.lock 0.5→0.6` (:10) | medium — tighter periods raise achievable score toward 4700 (oracle best already 4504, README:25); per-level limits re-proven |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same schedule, same scoring, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Per-level lighting NOT supported (`lighting:"space"` hardcoded, index.tsx:17) — keep the space look; flag, don't build.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
