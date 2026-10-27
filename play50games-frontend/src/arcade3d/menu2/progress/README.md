# menu2/progress

XP, stars, no-hit badges, shards and stickers per game and level, plus world completion (through `worldMap/mapModel.ts`). Progress is saved locally under **`play50games_m2_progress:<user>`** (`guest` or `u<id>`, as `core/scores.ts` does) through a storage adapter. **Games never touch localStorage**: they call `recordLevelResult`.

## API

`progress.ts` (pure):

| | |
|---|---|
| `applyLevelResult(data, { slug, level, cleared, stars, noHit, secrets[{ id, kind }] })` | new data, plus `{ xpGained, newStars, firstClear, firstNoHit, newSecrets }` |
| `XP` | paid for firsts only: clear 50, star 100, no-hit 50, shard 25, sticker 50 |
| `parseProgress(raw)` | never throws; drops broken parts |
| `levelOf`, `gameStars`, `gameShards`, `isGameCleared(data, slug, levelCount)`, `hasPlayed`, `totals`, `xpLevel` | reads |
| `mergeProgress(a, b)`, `levelXp` | for the future sync (a union; XP is recomputed, so nothing is paid twice) |

`progressStore.ts`: `progressKey(userId)`, `ProgressStorage` (`localProgressStorage`, and `memoryProgressStorage` for tests), `loadProgress`, `saveProgress` (fires `play50games_m2_progress_updated`) and **`recordLevelResult(userId, result, storage?)`**.

For WordPress later: `ProgressSync { pull(userId), push(userId, data) }`, `setProgressSync` and `syncProgress(userId)` (pull, merge, save). Today it is `noopProgressSync`. A backend route (`play50/v1/m2/progress`) is not built yet.

`useProgress()` (client) returns `{ data, userId, loaded }` and stays live on the update event and on other tabs' storage events.

## Adoption

1. At the level end (on a win, before `end("win")`, and on a time-up so the secrets are kept), call `recordLevelResult(user?.id ?? null, …)`. The Scene can call `useAuth()`, because the Canvas bridges contexts.
2. Publish the summary as stats for the star screen. Reference: `games/sky-tower-jump/levelEnd.ts`.
