[PLAY50 TASK P-71-levels-snowball-battle] Worktree: <WORKTREE>. Branch: <agent>/levels-snowball-battle (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-71-levels-snowball-battle | 5 levels for snowball-battle | branch <agent>/levels-snowball-battle | allowed: play50games-frontend/src/arcade3d/games/snowball-battle/**". Check against `git branch --show-current`; stop if it differs.

snowball-battle gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Levels are pure `AI` / `THROW` / `FORT` constant sets over the fixed 24×18 yard (`YARD` :30-36) — rivals already move and dodge, so "moving targets" need no new code; the plan's stationary-target gallery and attempt limits have NO supporting code (targets are AI rivals, no shot limit, runs end only on timeup, README "Run end").

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 17 — Snowball Battle": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The snowball-battle folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "snowball-battle" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's 90 s / 1-vs-3 battle): maxScore 2550, minDurationMs 10000, maxDurationMs 92000, base 600, maxPointsPerSec 190.

Per-level config (rules.ts constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Snow Yard | today's config kept: `AI.dodgeAt [0.35,0.27,0.2]` (:72), `AI.windup 1.2` (:67), `SCORE.duration 90` (:77) — optional tutorial softening `dodgeAt→[0.6,0.5,0.4]` (rivals almost never dodge) | low — slower rivals only raise the 10.9 s clear (EARLIEST :100-110); 2550/10000-92000/600/190 hold with slack (README:60) |
| 2 | Frozen Park | `KID.speed 4.5→4.0` (:39); `AI.dodgeAt→[0.3,0.25,0.2]`; `THROW.distFar 14→18`, `flightFar 0.85→0.95` (:53) — keep `flightNear 0.65` (the proof uses flight ≥ 0.65, README:44) | medium — the flight-time change alters the scoop-cycle bound `0.5k+0.65` and the EARLIEST rows; re-derive the 190 pps table |
| 3 | Snow Fort | `AI.slotAt 60→30` (:70); `AI.sneakerAt 10→8` (:70) = more simultaneous attackers | medium — the earlier two-peek slot shortens the loss chain (10.65 s, README:29) and the earliest clear; minDurationMs 10000 re-checked |
| 4 | Ice Village | `AI.windup 1.2→1.0` (:67); `AI.dodgeAt→[0.25,0.2,0.15]`; `FORT.hp 3→2` (:60) = less cover | high — windup 1.0 vs flight ≤ 0.70 at ≤ 8 m (README:32) eats the punish window the witness proof relies on (160/160, README:157); the clear may drop under 10 s → minDurationMs + EARLIEST re-proven |
| 5 | Championship Arena | `AI.slotAt→0`, `AI.sneakerAt→5`, `AI.dodgeAt→[0.2,0.17,0.14]` (:70-72) = every pressure knob at once | medium-high — the fastest rival set lowers the clear toward/below minDurationMs 10000; maxDurationMs 92000 only moves if `SCORE.duration` changes (not proposed) |

Rules:
- Level 1 = today's game (dev game; no bests to migrate): same rivals, same clock, same limits. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs — kids/pines/forts/snowman all owned, README "Assets"). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 maxScore <= ~3x level 1 — the 90 s clock + hit cap keep every cap at 2550 while achievable scores drop with AI speed; flag in HANDOFF if a level's bot best falls under level 1's, per decision 3.
- Do NOT build the plan's strict attempt/shot limit (L5 — needs a shot counter + lose state) or combo scoring (fixed `SCORE.hit 100` :76); flag, don't build.
- "More target positions/stations" maps to `FORT.count 7` (:60) and the AI knobs, not new geometry.
- Per-level lighting is NOT supported (`lighting: "snow"` + fog hardcoded, index.tsx:14, README:81); keep the snow look.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
