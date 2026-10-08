---
name: arcade-score-limits
description: Derive and prove the server score limits (maxScore, min/maxDurationMs, base, maxPointsPerSec) of a 3D Arcade points game, with a README proof and a bot test through the real store. Use before a game's review, when its scoring changes, and in every go-live.
---

# Arcade score limits

## Background
The WordPress API rejects a points run when `score > maxScore`, `score > base + maxPointsPerSec × seconds`, or `durationMs` is outside `[minDurationMs, maxDurationMs]` (`docs/arcade-api.md`, `core/limits.ts` `withinServerLimits`). `meta.scoring` must equal `arcade-games.json` (`registry.sync.test.ts`). Limits are tight on purpose: the proven maximum plus about 3–5 %. The worked example is `games/robot-collector/README.md` "Server limits and why they hold (the proof)" and its `rules.test.ts` block "scoring limit proof".

## Inputs
`rules.ts` (all scoring events and timings), `index.tsx` (`durationMs`, `lives`, `finalScore`), the core clock facts: `useRunFrame` dt equals the played time the run clock counts (no untimed frames), `dt ≤ 1/20 s`.

## Steps
1. **List every score source** with its maximum rate: points per event × the fastest possible event rate (from movement speeds, cooldowns, spawn schedules), and one-off bonuses (time left, completion).
2. **Upper bound as a function of time** `B(t)`: sum of the rates over the time they can be active, plus bonuses reachable by time `t`. Prove each rate from rules constants (cite them), not from play.
3. **Choose** `maxPointsPerSec` and `base` so that `B(t) ≤ base + pps × t` for every `t` in the duration window; `maxScore ≥ max B(t)`; add 3–5 % margin and round up.
4. **Duration window:** `minDurationMs` = the fastest legal end (a win can come early) minus a margin; `maxDurationMs` = the timer (+ result-delay-free margin) or a long cap for endless games.
5. **Bot test** in `rules.test.ts`: drive `createArcadeStore()` with `advanceRunClock` + `playedFrameDt` and the game's own rules; bots: optimal (oracle), greedy, idle, input spam, and frame-rate variants (30 / 60 / 144 Hz splits); 200+ seeds each; assert `withinServerLimits(final.score, final.durationMs, meta.scoring)` for every run, and that the best bot reaches ≥ 90 % of `maxScore` (the limit is not loose).
6. **README section** "Server limits and why they hold": the formula, each rate with its constant, `B(t)`, the chosen numbers, the margin, what the bots reached.
7. **Values:** the owner proposes; Claude sets `meta.scoring` and `arcade-games.json` together in the go-live PR (never on a game branch).

## Outputs
The README proof, the bot tests, proposed numbers in the HANDOFF.

## Validation checklist
- [ ] Every rate cites a constant in `rules.ts`.
- [ ] Pausing, retrying, input spam and frame rate cannot raise the score rate (tests).
- [ ] The best bot is within 90–100 % of `maxScore`; no run exceeds any limit.
- [ ] `capScore` stays a no-op for every bot run.

## Reuse
Every points game; the same bot harness shape is copied from the reference game.
