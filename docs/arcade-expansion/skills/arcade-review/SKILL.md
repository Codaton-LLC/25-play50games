---
name: arcade-review
description: Review a 3D Arcade branch in two parts: A) mechanical checks by script (any agent, report only) and B) Claude's adversarial review (scoring exploits, mutation probes, frame-loop rules, visuals, performance). Use when an agent hands off a game or a delegated core task.
---

# Arcade review

## Part A: mechanical (Kimi or any agent; report only, no edits)
1. In a separate review worktree, never your own: `git fetch origin <branch>` then `git worktree add --detach ../p50-review-<slug> origin/<branch>` and `npm ci` there; remove it at the end (`git worktree remove`).
2. Repo root: `node tools/gamecheck <slug>` (core tasks: `--allow <glob>` with the task's allowed paths).
3. `play50games-frontend`: `npm run build` (note the route table: `/` and `/classic` unchanged), `npx tsc --noEmit`, `npx vitest run`.
4. `tools/perf` capture + compare for the game (skill `arcade-playtest`, step 5).
5. Walk the Common Definition of Done (03) item by item: pass / fail / not checkable, with evidence (command output line, file:line).
6. Report ≤ 60 lines, by severity. No design opinions.

## Part B: adversarial (Claude)
1. Ownership: `git diff --name-only main...origin/<branch>`.
2. Read `rules.ts`, `Scene.tsx`, `index.tsx`, `meta.ts` fully; the rest by need.
3. **Break the score:** bots through the real store that idle-farm, pause-spam, input-spam, change frame rate (30/60/144), exploit spawns or collisions, end early/late; any run outside `withinServerLimits` is a blocker; a bot reaching < 90 % of `maxScore` means the limit is loose.
4. **Mutation probes:** flip a comparison, change a constant, drop a branch in `rules.ts` scoring and end conditions; the tests must fail. A surviving mutation = a missing test.
5. **Frame-loop rules:** no allocation or `setState` in `useRunFrame`/`useFrame`; `useGameTime` not `state.clock`; `pressed` not also `swipe`; one of `tap`/`tapDown`; `inputToWorld` with `view.yaw`.
6. **Visuals:** headless run at 1280 × 800, 390 × 844 (banner), 844 × 390; T-pose, feet, overlaps, readability; the result delay shows the ending.
7. **Perf:** perf JSON vs the README target and 06 §10.1.
8. **Output:** one fix list (blockers / should / nice, ≤ 15 items, file:line + expected behaviour). Plan one fix round; a second only for blockers. Add one line per new kind of finding to `arcade-game-build` "Validation checklist".

## Reuse
Every game and every delegated core task.
