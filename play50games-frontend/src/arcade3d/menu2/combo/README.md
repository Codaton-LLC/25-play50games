# menu2/combo

The flow meter: chained actions inside a window raise a multiplier, up to a hard cap. Pure and allocation-free per call, so `rules.ts` can call it every ms.

## API (`combo.ts`)

| | |
|---|---|
| `ComboConfig { windowMs, gain, cap }`, `DEFAULT_COMBO` (2 s, +0.25, x2) | tuning |
| `createCombo()`, `resetCombo`, `copyCombo` (for bots' look-ahead) | state |
| `comboHit(state, cfg, nowMs, base)` returns the bonus | one link: the first link of a chain pays 0, then `floor(base * (multiplier - 1))` |
| `comboTick(state, cfg, nowMs)` | ends a chain whose window ran out (call it each step) |
| `comboBreak(state)` | a hit or a fall: the chain breaks and the bonus already paid stays |
| `comboMultiplier(chain, cfg)`, `comboBonus`, `comboFlow` (0..1 meter fill) | reads |
| **`comboMaxBonus({ combo, sources: [{ count, base }] })`** | the proof helper: the most bonus any run of the level can collect |

`ComboMeter.tsx` is a HUD pill (multiplier, draining bar, chain) built from `chain`, `multiplier`, `flow` and `cap`.

## Proof

The i-th link of a run has a chain length of at most i. The multiplier never falls as the chain grows and is capped, so that link's bonus is at most `base_i * (multiplier(i) - 1)`. Sum this with the largest bases on the highest multipliers (the rearrangement inequality) and you get a bound for every order and break pattern: exactly `comboMaxBonus`. `combo.test.ts` checks that 2000 random runs never beat it.

**Only countable events may feed the meter:** each orb once, the first landing on each platform, each knock-off target once. Never a repeatable action such as a jump, or the bound is infinite.

## Adoption

1. Pick the events and a base for each; declare `comboSpecOf(course)` in `rules.ts`.
2. In the rules step: `comboTick` each ms, `comboHit` on each event, `comboBreak` on a hit. Add the bonus to the score (points games) or take it off the submitted time (time games).
3. **The proof:** points games add `comboMaxBonus(spec)` to the maxScore bound; time games take it off the least duration (`minDurationMsOf`). Update `meta.ts`, the pinned limits test and `arcade-games.json` together.
4. Publish `chain`, `multiplier` and `flow` as stats, and draw `<ComboMeter>` in the game Hud.

Reference: `games/sky-tower-jump` (orbs 40 ms, first landings 20 ms, x2 cap; the level 1 bound is 1 230 ms).
