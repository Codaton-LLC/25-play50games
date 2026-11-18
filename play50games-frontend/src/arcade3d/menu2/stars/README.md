# menu2/stars

Per-level 3-star evaluation and the level-end star screen (00-framework.md pillar 3).

- Stars: **clear**, **every colour orb**, **the goal**. The goal is a target time (`{ kind: "time", targetMs }`), or a game value: `{ kind: "atLeast", target, label }` (knock-offs) or `{ kind: "atMost", target, label }` (HP lost, hits taken).
- **No-hit badge** on top: a clear with `hits === 0`.
- Nothing counts without a clear. Each star is its own goal: progress keeps the union of every run's stars.

## API (`stars.ts`, pure)

| | |
|---|---|
| `evaluateStars(spec, { cleared, orbs, goalValue, hits })` | `{ clear, allOrbs, goal, noHit, mask, stars }` |
| `STAR_BIT` (`clear` 1, `orbs` 2, `goal` 4), `ALL_STARS` | the mask bits |
| `starCount`, `mergeStarMask`, `newStarMask` | mask helpers |
| `goalMet`, `goalText`, `starLabels(spec)`, `starSpecProblems` | labels and validation |

`StarScreen.tsx` (CSS module): `mask`, `newMask`, `labels`, `noHit`, `noHitEver?`, `secrets?: { found, total, newFound? }`, `xpGained?`, `accent?`. The stars pop in one by one (reduced motion: none). Fits a 390 px card.

## Adoption (each game)

1. Give each level a `StarSpec` (orb total + goal). Pick the target from the honest bot's time: a little slower than the bot.
2. Count hits in the rules (falls, damage) for the no-hit badge.
3. At the end (before `end("win")`): `evaluateStars`, then `recordLevelResult` (menu2/progress), and publish the mask, the new mask, no-hit, secrets and XP as store stats.
4. Show it: `GameDefinition.ResultExtra` is a small component that reads those stats and renders `<StarScreen>` (the core puts it under the result card's title, inside the level context). Reference: `games/sky-tower-jump/{levelEnd.ts,StarResult.tsx}`.

Stars add no score, so no proof changes.
