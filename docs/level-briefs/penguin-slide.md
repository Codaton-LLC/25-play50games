[PLAY50 TASK P-83-levels-penguin-slide] Worktree: <WORKTREE>. Branch: <agent>/levels-penguin-slide (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-83-levels-penguin-slide | 5 levels for penguin-slide | branch <agent>/levels-penguin-slide | allowed: play50games-frontend/src/arcade3d/games/penguin-slide/**". Check against `git branch --show-current`; stop if it differs.

penguin-slide gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Built game: ENDLESS belly-slide, no finish, no fish-count objective (README:57 "No win") — levels are speed/density/clock constant sets, NOT the plan's "reach finish + collect N fish" (no support in any level).

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 25 — Penguin Ice Slide": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The penguin-slide folder: README.md (incl. the scoring-limit proof), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "penguin-slide" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts is PROVISIONAL 18700 / 9000–182000 ms / base 440 / 104 pts/s; the single global proof `s ≤ 22t`, score ≤ 102.667t+220, README:43-51, is ceiling-and-speed dependent — `DRIVE.max` and the duration bound are load-bearing). Every constant change re-opens the proof.

Per-level config (constants, from the backlog):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Snow Hill | today's game with tutorial pacing: `DRIVE.max 22→18` (:7); obstacle slots `2+floor(3q)` capped at 2 (new per-level `maxSlots`, :126); `CLOCK.initial 30→45` (:9) | low — slower speed + shorter runs cap well below 18700 |
| 2 | Ice Cave | obstacle slots → 3-4 (:126); `CLOCK.initial→60`; cave lighting NOT supported (fog/sky hardcoded, index.tsx:14, Scene.tsx:128) — keep built look, flag | low-medium — denser fish pushes toward the 12/chunk budget (`POINTS.fishBudget 12`, :10); proof per level |
| 3 | Frozen Lake | obstacle slots → 4-5 (:126); `CLOCK.initial→75`; moving obstacles: NOT built (all obstacles are static circles in (s,d), :19) — use density+clock as the L3 pressure | medium — more chunks raise max toward 18700; new proof required if `DRIVE.max` rises |
| 4 | Aurora Run | slots → 5-6 (:126); `CLOCK.initial→90`; keep `DRIVE.max 22` (24 would need re-proof of `s ≤ 22t`, README:49); night lighting NOT supported (SkyDome colors hardcoded, Scene.tsx:128) | high — any speed increase invalidates the 18700 / base 440 / pps 104 proof; full re-proof mandatory |
| 5 | Glacier Sprint | endless high-score (the only plan level matching the built model): slots → 6+ with the `q` ramp reaching max sooner (:126); `CLOCK.ceiling 180→120` (:9); `COURSE.separation 12→10` (:6) — corridor is a fairness invariant (README:29), do NOT shrink; generator re-validation needed | medium — 120 s ceiling lowers the duration bound (score ≤ 102.667t+220 still holds), easier limits; dense tricks keep score near cap |

Rules:
- Level 1 = today's game with only the L1 tutorial-pacing deltas above (dev game; no bests to migrate): today's endless run stays the base config. Existing rules.test.ts must pass unchanged for level 1 (run them against the L1 config exactly as shipped today).
- Levels 2-5 are harder variants, same assets (no new GLBs — ice/snowman/crack/fish props suffice). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Plan mechanics with NO support (do not build): moving obstacles (L3-4), collectible-count objective + finish line (no win path, README:57), per-level lighting presets (L2-5; fog/sky/colors hardcoded).
- Do NOT raise `DRIVE.max` above 22 without re-proving `s ≤ 22t`; do NOT shrink `COURSE.separation` below 12 (fairness invariant).
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
