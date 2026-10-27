# menu2/secrets

1 to 3 hidden things per level (00-framework.md pillar 6): colour **shards** and **stickers**, found by exploring or with a hero power. Secrets add no score, so no proof changes.

## API (`secrets.ts`)

| | |
|---|---|
| `SecretSpec { id, kind: "shard" \| "sticker", name, hero? }` | per level. Ids use `a-z0-9-` and are unique in the level |
| `secretProblems(list)` | validation (1 to 3 secrets, ids, names) |
| `createSecretTracker(list)`, `collectSecret(t, i)` (true only the first time), `copySecretTracker` | the run's finds (allocated once) |
| `foundIds`, `foundMask`, `idsFromMask`, `countKinds`, `secretKey(slug, level, id)` | reads |

## Adoption

1. Declare `SECRETS[level]` and place each one in the course, off the main route. A hero-gated spot sets `hero`.
2. In the rules, add a pickup check like an orb's: `collectSecret(run.secrets, i)`, plus an event for the Scene's fx.
3. At the end (a win or a time-up), pass the found ones (`{ id, kind }`) to `recordLevelResult` (menu2/progress).
4. Draw them (code markers are fine: a glowing crystal, a badge) and hide the ones already found.

Reference: `games/sky-tower-jump` (a sky shard over the first pad, a ledge shard off a mid-route island, and a sticker by the gate on levels 1 and 5).
