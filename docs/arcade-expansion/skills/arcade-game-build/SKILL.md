---
name: arcade-game-build
description: Build one 3D Arcade game (React Three Fiber, play50games-frontend/src/arcade3d/games/<slug>) from its approved design README to the Common Definition of Done. Use on a <agent>/game-<slug> branch, when asked to "build", "implement" or "finish" an arcade game, or to fix review findings in one.
---

# Arcade game build

## Objective
A playable, tested, budget-compliant game folder that copies the reference game's structure and uses core helpers instead of local copies.

## Inputs
- The approved `games/<slug>/README.md` (it is the spec).
- `docs/arcade-expansion/03-game-specs-adventure.md` "Conventions", "Common testing criteria", "Common Definition of Done".
- `core/README.md`: "Time and frame order", "Input events", "Helpers", "Camera fit and the safe area", plus the sections of every module the README lists.
- The reference game folder `games/treasure-island/` (until it exists: `games/robot-collector/`).

## Steps
1. Echo the task line; confirm the branch.
2. **Skeleton first, primitives only:** `meta.ts` (plain data, `status: "dev"`), `index.tsx` (`GameDefinition`), `rules.ts` (pure, seeded), `Scene.tsx` (one `useRunFrame` → rules → store), `Primitives.tsx`, `assets.ts`. Get ready → countdown → playing → over working with boxes.
3. **Rules and tests next** (`rules.test.ts`): determinism, every scoring event, end conditions, generators over 1,000 seeds, then the limit proof (skill `arcade-score-limits`).
4. **Camera:** `useFittedView({ area, pitch, yaws, focus, margin, shift: true })` (+ `followFocus` for follow cameras) and `<CameraRig … offset shift>`; check 390 × 844 with the cookie banner open.
5. **Input:** discrete moves from `pressed` only; one of `tap` / `tapDown` per action; `drag` if the game opted in; `inputToWorld(moveX, moveY, view.yaw)` for movement.
6. **Models:** `<Model asset fallback={<Primitive/>}>`, `<InstancedModel>`, `<DynamicInstancedModel>` (per-copy tint); humanoids with `<HumanoidModel>` + `useHumanoidPose` + `walkStride`/`gaitPhaseStep` + `bodyLift` + `attach`; creatures with `core/motion`. Never edit the manifest or GLBs.
7. **Feel:** `useFx()` bursts and floating scores, `useCameraShake`, `playSfx` / `startLoop`, `resultDelayMs` for the end animation. Visuals read state in `useFrame` and animate with `useGameTime()`.
8. **Budgets:** `?perf=1` and `node tools/perf/capture.mjs --slugs <slug>`; draw calls ≤ the README target; geometries flat over 10 Retries; no allocation and no `setState` in frame callbacks.
9. **Checks:** `npm run build`, `npx tsc --noEmit`, `npx vitest run` (in play50games-frontend), `node tools/gamecheck <slug>` (repo root).
10. **Evidence:** screenshots at 1280 × 800, 390 × 844 (banner open), 844 × 390; perf JSON; the game's input script `tools/thumbs/inputs/<slug>.mjs` (also used by `tools/perf`).
11. README "Status" = the HANDOFF block.

## Outputs
The game folder, an optional thumbnail, the HANDOFF block.

## Validation checklist
- [ ] `git diff --name-only main...HEAD` ⊆ `games/<slug>/**` + `public/images/3d/<slug>.webp` + `tools/thumbs/inputs/<slug>.mjs`.
- [ ] No imports from other games, `components/GameEngine/**`, `lib/storage/progressStorage`, `lib/api/progress`; no top-level `useGLTF.preload`; no `Math.random` / `Date.now` in `rules.ts`; no `state.clock.elapsedTime`.
- [ ] No localStorage, no API call, no `submitScore`; runs end with `end(reason)`.
- [ ] Runs on primitives with every GLB missing.
- [ ] Keyboard and touch both complete a run; `meta.ts` control strings match.
- [ ] README ≤ 200 lines; `rules.test.ts` ≈ ≤ 600 lines.
- [ ] Status still `"dev"`.

## Reuse
All 20 games. Findings from each review are added to "Validation checklist" by Claude (one line each), so later games inherit them.
