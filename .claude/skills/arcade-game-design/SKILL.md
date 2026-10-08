---
name: arcade-game-design
description: Turn a 3D Arcade game spec (docs/arcade-expansion/03 or 04) into the game's design README and assets.spec.json (gate G0), before any code. Use when asked to "design <slug>", on a <agent>/design-<slug> branch, or when a game folder has only stub files.
---

# Arcade game design (gate G0)

## Objective
One approved design per game, written by the agent that will build it, so the build has no open design questions and no surprises for the review.

## Inputs
- `<slug>` and the spec section in `docs/arcade-expansion/03-game-specs-adventure.md` or `04-game-specs-skill.md`.
- "Conventions" and "Common Definition of Done" at the top of 03.
- `play50games-frontend/src/arcade3d/core/README.md`: only the sections of the modules the spec lists under "Dependencies".
- The reference README: `games/treasure-island/README.md` (or `games/robot-collector/README.md` before the reference is merged).
- `docs/arcade-expansion/05-hyper3d-catalog.md` §E.4 (this game's asset table).

## Steps
1. Echo the task line (slug, branch, allowed paths) and confirm the branch with `git branch --show-current`.
2. Read the spec section twice: once for intent, once for numbers.
3. Write `games/<slug>/README.md` with exactly these sections, ≤ 200 lines:
   `Concept` · `Controls` (desktop + touch, the exact `meta.ts` strings) · `Rules` (every number) · `Scoring` (formula + "Server limits and why they hold": how the proof will go) · `Run end` (which `end()` reason, when) · `Scene and camera` (area, pitch, yaws, follow or fixed, lighting preset) · `Core helpers used` (by name) · `Assets` (ids, class A–E, target sizes, what is procedural, fallbacks) · `Files` (the split) · `Test plan` (what `rules.test.ts` proves; ≤ ~600 lines) · `Performance` (draw-call target, pools, lights) · `Accessibility` · `Risks and open questions` · `Status` (empty until the build).
4. Every change from the spec: a line "Changed from spec: … because …".
5. Write `assets.spec.json` (same shape as `games/clean-city/assets.spec.json`) for the assets this game owns only; shared ones are listed in the README, not in the spec file.
6. Check `git diff --name-only main...HEAD` = the two files.

## Outputs
README design sections, `assets.spec.json`, a HANDOFF block whose "Open questions" lists every decision Claude or the user must take.

## Validation checklist
- [ ] Every control in the spec maps to an existing `InputState` field (`pressed`, `tapDown`, `tap`, `drag`, `moveX/Y`, `jump`, `action`, `pointer`).
- [ ] Every helper named exists in core (or is in the Phase 1 list); nothing generic is planned inside the game folder.
- [ ] The scoring formula has a finite maximum and a plan for the bound `base + pps × seconds`.
- [ ] Camera choice explained in one sentence.
- [ ] Draw-call target ≤ the spec's estimate and ≤ 150.
- [ ] Nothing in the README contradicts `03` "Conventions".

## Reuse
Same skill for all 20 games; only the spec section changes.
