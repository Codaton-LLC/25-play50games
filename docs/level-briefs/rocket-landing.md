[PLAY50 TASK P-59-levels-rocket-landing] Worktree: <WORKTREE>. Branch: <agent>/levels-rocket-landing (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-rocket-landing | 5 levels for rocket-landing | branch <agent>/levels-rocket-landing | allowed: play50games-frontend/src/arcade3d/games/rocket-landing/**". Check against `git branch --show-current`; stop if it differs.

rocket-landing gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Best fit of all games: every plan hazard (tighter turns, wind, moving pad, fuel pressure) already exists as a `PLANETS` mechanic — levels are planet subsets + `DURATION_MS`.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 30 — Rocket Landing Challenge": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The rocket-landing folder: README.md (incl. "Scoring" / "Server limits"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "rocket-landing" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts, today's game = full 5-planet campaign): maxScore 2800, minDurationMs 5000, maxDurationMs 242000, base 800, maxPointsPerSec 200.

Per-level config (rules.ts constants, from the backlog; per-level planet subset via `createRun(seed, level)` over the built `PLANETS` table :11-17; win-on-last-planet needs a campaign-length param):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Moon Pad | planets 1-2 (Moon g1.6, Desert g3.7); `DURATION_MS 240_000→120_000` | low — per-award 500 cap + ≥1.119 s min flight recompute trivially; max → 1300 |
| 2 | Wide Crater | planets 1-3 (adds Ice g5); `DURATION_MS→150_000`; fuel 100/100/95 is the built-in ramp | low — max → 1800+300 |
| 3 | Mars Ridge | planets 1-4; wind `0.4→0.6` (:245); pad amplitude `2→3` (:38); `DURATION_MS→180_000` | low-medium — moving pad adds `padVx` to the `\|vx−padVx\|<1` contact gate; fairness re-checked |
| 4 | Asteroid Base | today's full 5-planet campaign as-is (fuel 100→85, asteroid g1 + roof cavern); `DURATION_MS→180_000` | low — today's config is the proven one |
| 5 | Precision Landing | `CONTACT.vy 2→1.5`, `\|theta\| π/18→π/24` (:8); or 5 planets with clean bonus `300→450` (:191-194) | medium — tighter gates make 500-per-planet rarer → per-level bot re-proof |

Rules:
- Level 1 = the planets-1-2 slice (dev game; no bests to migrate). Today's full campaign anchors L4; the backlog recommends this slicing — flag the ordering at merge. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Do NOT build the plan's fuel-pickup mechanic — it was explicitly omitted (README) and would break reserve-scoring balance.
- Per-level lighting is NOT supported (`lighting:"space"` hardcoded) — keep the space look; flag, don't build.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json at merge (never edit backend files).
- Pure, deterministic rules with a seed; levels.test.ts per §6.3 step 6 + mutation-probe your new tests; the scoring proof is a 3-line closed form per level.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
