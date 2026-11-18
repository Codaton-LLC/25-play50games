# menu2/boss

A data-driven boss for each game's level 5 (00-framework.md pillar 4). A boss is a `BossConfig`. The machine runs phases by health, and each phase cycles its attacks as **telegraph -> attack -> vulnerable**. Hits count only while the boss is vulnerable. A hit flashes the boss, and can push it into the next phase (after a short transition) or defeat it. The machine is pure and deterministic: one big dt gives the same result as many small ones.

## API (`boss.ts`)

| | |
|---|---|
| `BossConfig { id, name, maxHp, phases[{ id, name, endsAt, attacks[{ id, telegraphMs, attackMs, vulnerableMs, damage? }] }], introMs, transitionMs, hitFlashMs, oneHitPerWindow, defeatMs, slowMo { scale, durationMs } }` | the declaration. A phase runs while `hp / maxHp > endsAt`; the last phase ends at 0 |
| `createBoss(cfg)`, `createBossEvents()` | state (steps `intro / telegraph / attack / vulnerable / transition / defeat / done`) |
| `stepBoss(state, cfg, dtMs, ev)` | advances by rules time. `ev`: telegraph, attack, vulnerable, recovered, phaseChanged, defeated, done |
| `hitBoss(state, cfg, damage, ev)` | `"ignored" / "hit" / "phase" / "defeated"` |
| `bossTimeScale(state, cfg)` | the **visual-only** slow-mo on the finish (1, then `slowMo.scale`, eased back to 1). Never feed it to the rules |
| `currentAttack`, `stepProgress`, `phaseForHp`, `phaseMarks`, `hitsToDefeat`, `bossProblems` | reads and validation (1 to 3 phases, telegraphs of at least 300 ms) |

`BossHealthBar.tsx` shows the name, the phase, the health with a trailing drain, the phase marks, a hit flash and a pulse while the boss is open. It is marked `data-arcade-safe-area`.

## Adoption

1. Declare the boss in the game (`progression.ts`) and test that `bossProblems(cfg)` is empty.
2. Step it in `useRunFrame` with the rules dt. Check the attack's hazard during `attack`; call `hitBoss` when the hero lands a hit during `vulnerable`.
3. Visuals: a telegraph glow from `stepProgress`, the flash while `flashMs > 0`, animations scaled by `bossTimeScale`, and `fx.shake` on `ev.defeated`.
4. Publish hp, step and flash as stats, and draw `<BossHealthBar>` in the Hud.
5. A boss that adds score (a defeat bonus) counts it in the maxScore proof (`hitsToDefeat` bounds the hits).

Reference: `games/sky-tower-jump/progression.ts` `STORM_GUARDIAN` (a declared stub; there is no fight yet).
