[PLAY50 TASK P-81-levels-robot-factory] Worktree: <WORKTREE>. Branch: <agent>/levels-robot-factory (created from origin/main by Claude and checked out; never create or switch branches, never touch main, never run git reset/clean, never delete files).
FIRST line of your HANDOFF: "TASK P-81-levels-robot-factory | 5 levels for robot-factory | branch <agent>/levels-robot-factory | allowed: play50games-frontend/src/arcade3d/games/robot-factory/**". Check against `git branch --show-current`; stop if it differs.

robot-factory gets its 5 levels with the level system that is already built. COPY THE PATTERN of the finished pilots: games/robot-collector and games/castle-defender (levels.ts, rules.ts createRun(seed, level), index.tsx levels incl. hudStats, meta.ts levels, levels.test.ts). Do not invent another shape. USER DECISION (2026-10-24): levels 1-3 stay the built assembly game (blueprint grab/scrap on one belt); levels 4-5 switch to "the plan sorter" — the plan's GAME 22 sorting concept is the content source for L4-L5, adapted to built mechanics where they exist.

Read only, in this order:
1. AGENTS.md and CLAUDE.md "Master plan and standing decisions (2026-10-24)" (decisions 1-4, 7, 8 are binding).
2. docs/arcade-levels.md: §1, §1.5, §5, §6.3 (follow steps 1-7 exactly), "User decisions (2026-10-24)" (today's game = Level 1, unlock on clear, points = sum of level bests).
3. play50games-frontend/src/arcade3d/core/README.md "Levels (five per game)" (useLevel, LevelSpec, meta.levels, clearScore, environment/duration overrides).
4. docs/master-plan/PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md "# GAME 22 — Robot Factory Sorter": its 5 "Levels" blocks are the content source, adapted to the built game's mechanics.
5. The robot-factory folder: README.md (incl. "Server limits and why they hold"), rules.ts, rules.test.ts, meta.ts, index.tsx, Scene.tsx, Hud.tsx.
6. docs/arcade-expansion/skills/arcade-score-limits/SKILL.md (one proof per level).
7. docs/levels-backlog.md "robot-factory" — per-level constant research, already done; don't redo it.

Current scoring limits (meta.ts is PROVISIONAL 6000/10000/92000/6000/6000 — meta.ts:22-26; the PROVEN closed-form bound is `perfectScore(56,12) = 4580 ≤ 80·M(t)+220 ≤ 50t+264`, rules.ts:696-716, proposed 4750/10000/92000/300/52, rules.ts:722-731; Claude swaps at merge). The proof is closed-form (not bot-measured) so re-proof per level is cheap, but `M(t) = floor((t−0.731)/1.6)+1` (:711-716) and `EARLIEST_LOSS_S = 2.6 + 2·3.5 + 1.9/2.6 = 10.331 s` (:719) move with every constant.

Per-level config (constants, from the backlog; L1-L3 assembly, L4-L5 user-decision plan sorter):
| L | Plan level | Config (current → proposed) | Scoring risk |
|---|---|---|---|
| 1 | Basic Sort | today's game unchanged: `SHIFT.DURATION 90` (:13), `WIN_QUOTA 5` (:15), `BELT.V0 1.45 / V_MAX 2.6` (:36,:39), `STREAM.PERIOD 1.6 / HALF 0.8` (:57-58) | low — closed-form bound proven for exactly these constants |
| 2 | Shape Sort | `BELT.V1 1.6→1.75`, `GROWTH 1.04→1.05` (:37-38); `SHIFT.DURATION→120` (150 s unusable: ceiling ≈ 8000+ ≫ 4750); `BELT.FEEDER_T 60→45` (:34) | medium — M(t)/R(M) and the `< 4 s` fairness guarantee (:45) re-derived; dwell-vs-`WRONG_LOCKOUT 2.1` (:68-74) re-checked at higher speeds |
| 3 | Color + Shape | `BELT.FEEDER_T→35` (feeder carries every other non-needed part, :34,:450); `STREAM.FAULTY_CHANCE 0.18→0.22` (:61); zones: NOT built (fixed bay) — use feeder+faults as the L3 pressure | medium-high — feeder merge changes spawn geometry behind `MIN_PART_GAP 0.95` (:55,:144); fault rate feeds EARLIEST_LOSS_S → minDurationMs proof |
| 4 | Fast Factory | USER DECISION — the plan sorter: plan Levels block 4 is the content source; backlog fallback constants: `BELT.V_MAX 2.6→3.0` (:39); `STREAM.FAULT_MIN_INTERVAL 3.5→2.8` (:63); `CLAW.WRONG_LOCKOUT 2.1→2.4` (:74); `SHIFT.DURATION→120` | high — M(t)/R(M), dwell math, and EARLIEST_LOSS_S (:719) all move → full re-proof of 4750/10000/92000/300/52 |
| 5 | Overdrive | USER DECISION — the plan sorter: plan Levels block 5; backlog fallback: `STREAM.PERIOD 1.6→1.4`, `HALF 0.8→0.7` (:57-58, keep `HALF·V0 = 1.015 ≥ MIN_PART_GAP 0.95`); `FAULTY_CHANCE→0.25`; `BELT.V_MAX→3.0`; `SHIFT.DURATION→120` | high — the lattice period is the spine of the entire proof (`maxInstalls` :711-716, `perfectScore` :696); 1.4 s period raises the 90 s ceiling past 4750 → per-level meta.scoring required |

Rules:
- Level 1 = today's game byte-for-byte (dev game; no bests to migrate): the 90 s / quota-5 shift stays L1. Existing rules.test.ts must pass unchanged for level 1.
- Levels 2-5: same assets (no new GLBs — zero Class E assets, README "Assets" :121-134). Difficulty monotone; every level winnable by the honest human-paced bot (>= 90% of seeds); level 5 max score <= ~3x level 1.
- Plan mechanics with NO support (do not build): multi-zone layouts/parallel workstations (single fixed bay + one belt pair), player movement, a parts-counted win (`finish()` keys on quota or clock, :615-620 — "sort N parts" maps only via `WIN_QUOTA`, robots ≈ parts/`blueprintSize`). All plan timers (120–210 s) exceed `maxDurationMs 92000` — built levels stay ≤ ~120 s with per-level limits.
- For L4-L5 (plan sorter): stay inside the built rule set; where the plan demands a mechanic that doesn't exist, adapt to the closest built knob and flag the adaptation in the HANDOFF.
- Per-level lighting NOT supported (`indoor` hardcoded, index.tsx:20) — keep the built look and flag.
- Fairness: identical timing windows for touch and keyboard.
- Per-level PROPOSED_LEVEL_LIMITS in rules.ts with the proof in the README; Claude copies them into arcade-games.json + meta.scoring at merge (never edit backend files or meta.scoring of level 1).
- Pure, deterministic rules with a seed; no allocations in the frame loop; levels.test.ts per §6.3 step 6 + mutation-probe your new tests.
- Run `npx tsc --noEmit` and the game's tests (if the vitest CLI cannot load its config, say so).

[CLI MODE] Nobody can answer you during this run. Do not commit or push (Claude commits after its checks). No network access to production. Scope check: `git status --porcelain` only. When you finish or are blocked, write the HANDOFF (first line above; files; the 5-level table; per-level limits + proofs; bot clear rates per level; test counts + runtime; open questions — include how you adapted the plan-sorter L4-L5) and stop.

EXTRA RULES (lessons from the last level tasks): (1) existing rules.test.ts tests stay byte-identical: you may ADD tests, never edit or delete one; (2) per decision 3 the leaderboard is the SUM of level bests, so a harder level must offer at least as many points as level 1 (more targets/time), never fewer; level 5 maxScore <= ~3x level 1; (3) do not run `npm run build` or a server.
