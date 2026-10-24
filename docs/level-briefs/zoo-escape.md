[PLAY50 TASK P-59-levels-zoo-escape] Worktree: <WORKTREE>. Branch: <agent>/levels-zoo-escape (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-59-levels-zoo-escape | 5 levels for zoo-escape | branch <agent>/levels-zoo-escape | allowed: play50games-frontend/src/arcade3d/games/zoo-escape/**". Check against `git branch --show-current`; stop if it differs.

zoo-escape gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. Gates ARE checkpoints (win = cross gate 3), hiding (13 bushes), lures (bamboo toss), one-way locked paths (drop bars) all exist — levels are stage-count slices + `CLOCK`/`KEEPERS`/`CYCLES`/`VISION` constants.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 29 — Zoo Escape": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The zoo-escape folder: README.md (incl. "Server limits and why they hold"), rules.ts (+ level.ts), rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "zoo-escape" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts holds provisional 4500/20000/200000/4500/4500; the PROVEN ones are `PROPOSED_LIMITS` in rules.ts — 3290 / 5000–182000 ms / 163 pts/s — oracle 3040 = 92.4%; Claude swaps them in at go-live).

Per-level config (constants, from the backlog; per-level stage subset in `createRun(seed, level)` — the win check at rules.ts:519 assumes stage 3, so slicing needs plumbing):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Small Enclosure | stages 1-2 subset; `CLOCK 180→90`; keepers 1/1 (`STAGE_KEEPERS` level.ts:238) | medium — score bound `B = 1000+50k+10·(180−L(k)/3.2)` (rules.ts:45-54) is clock-dependent → re-derived per level |
| 2 | Safari Zone | 2-stage subset, keepers 1/2; `CLOCK→120`; `TOSS.bundles 2→3` (:33) | medium — fewer reachable snacks lower k → per-level maxScore |
| 3 | Bird Garden | today's 3 stages; keepers 1/2/2, `VISION.range [7,7,9]→[6,6,8]` (:29); `CYCLES [27,24,18]→[24,21,16]` (level.ts:26); `CLOCK→150` | medium — keeper/vision touch fairness, not the score bound (catches only −100/−5 s); clock re-derived |
| 4 | Central Zoo | today's map; keepers 2/3/3, `SUSPICION.catchS 1.35→1.1` (:32), `HEARING.walk 3.0→3.6` (:30); searchlight `period 9→6` (:36); `CLOCK→180` = today's | low-medium — today's 180 s / 3-stage config is the certified one |
| 5 | Night Escape | today's map + `SEARCHLIGHT.range 14→16` (:36), `CYCLES→[20,18,14]`; night-all-stages needs a per-level lighting param (today stage-3 dusk is a runtime `useStageLighting` flag, Scene.tsx:125) | medium — faster cycles lower clear time; B(k) re-derived; easier snacks can raise maxScore → re-proof |

Rules:
- Level 1 = the stages-1-2 / 90 s slice (dev game; no bests to migrate). Today's 3-stage/180 s campaign anchors L3-L4; the backlog recommends this slicing — flag the ordering at merge. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5 are harder variants, same assets (no new GLBs). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Per-level lighting (bright/natural/dramatic/cinematic) is NOT supported — day hardcoded; keep the built look and flag; don't wire the core override from a game branch.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
