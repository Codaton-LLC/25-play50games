# 3D Arcade: five levels per game (design)

Status: design, 2026-10-24, nothing built. Owner: Claude (core, backend, limits); game owners (level content).
Source of the level content: the user's master plan `PLAY50_ALL_100_GAMES_500_LEVELS_FULL.md` (not in git), "Global level rule":
**1 base environment + 5 level configurations**. Levels vary layout, spawns, objective count, hazards, speed, lighting
and timing, never the whole map or the controls.

User decisions (2026-10-24): every 3D game gets 5 levels; **one leaderboard per game = the sum of the player's best score
on each of its 5 levels**; classic 2D games are untouched. Today the 30 games each have one level (castle-defender has
5 waves, zoo-escape 3 stages, office-escape and pigeon-crossing speed stages: those stay inside a level).

Contents: 1 Game side · 2 Shell and UI · 3 Local scores · 4 Backend · 5 Score-limit proofs · 6 Work breakdown and rollout · 7 Risks and open questions.

---

## 1. Game side

### 1.1 Naming

`RunState.level` / `setLevel()` already exist and **keep their meaning**: the game's internal stage or wave inside one run
(castle-defender `run.wave + 1`, zoo-escape stage, pigeon-crossing, office-escape speed stage). The level the player
picked is a new, separate field, **`levelId`**. UI text says "Level 3"; in code "level" without "Id" is always the stage.

### 1.2 Server-safe meta (`arcade3d/types.ts`, `games/<slug>/meta.ts`)

```ts
export const LEVEL_IDS = [1, 2, 3, 4, 5] as const;
export type LevelId = (typeof LEVEL_IDS)[number];

export interface LevelMeta {
   id: LevelId;
   /** from the plan, e.g. "Open Office" */
   title: string;
   /** this level's server limits; must equal arcade-games.json games[slug].levels[id - 1] */
   scoring: ScoringRules;
   /** a run whose score reaches this clears the level (the plan's "target score"); omitted = only a win clears */
   clearScore?: number;
}

export interface ArcadeGameMeta {
   // ...unchanged...
   /** omitted = one level (= scoring). When present: exactly 5, ids 1..5 in order, levels[0].scoring deep-equals scoring */
   levels?: readonly LevelMeta[];
}
```

Why the limits sit in `meta.ts` and not in `GameDefinition`: `registry.sync.test.ts`, the `/3d` grid card and the server
contract need them without loading three.js. `meta.scoring` stays and is level 1 (the v3 JSON top level, see §4.1).

Pure helpers in `registry.ts` (server-safe, tested in `registry.test.ts`):

```ts
export function levelsOf(meta: ArcadeGameMeta): readonly LevelMeta[];   // no levels -> [{ id: 1, title: meta.title, scoring: meta.scoring }]
export function levelCount(meta: ArcadeGameMeta): 1 | 5;
export function scoringFor(meta: ArcadeGameMeta, id: LevelId): ScoringRules; // throws on an unknown id
export function isLevelId(meta: ArcadeGameMeta, value: unknown): value is LevelId;
export function maxTotal(meta: ArcadeGameMeta): number;                     // sum of the levels' maxScore
```

Rules (tests): all levels share `kind`, `unitLabel` and `display`; `clearScore <= scoring.maxScore`; level 5 needs no
`clearScore` (nothing to unlock).

### 1.3 Runtime level spec (`core/types.ts`)

```ts
export interface LevelSpec<C = unknown> {
   id: LevelId;
   /** one line on the start card under the tiles, e.g. "5 obstacle clusters, wide gaps" */
   description: string;
   /** the game's typed level data; Scene and rules read it (see useLevel) */
   config: C;
   /** replaces definition.instructions for this level (only when the level adds a mechanic) */
   instructions?: string[];
   /** merged over definition.environment: { ...definition.environment, ...environment } */
   environment?: Partial<NonNullable<GameDefinition["environment"]>>;
   /** override definition.durationMs / lives for this level (the countdown clock and lives chips) */
   durationMs?: number;
   lives?: number;
   resultDelayMs?: number;
}

export interface GameDefinition<C = unknown> {
   // ...unchanged...
   /** omitted = one level with config undefined. When present: one spec per meta.levels entry, same ids */
   levels?: readonly LevelSpec<C>[];
}
```

A game's `index.tsx` builds its specs from its pure `levels.ts`:

```ts
// games/castle-defender/levels.ts (pure data, no React)
export interface CastleLevel { waves: number; counts: readonly (readonly [number, number, number, number])[]; speed: number; hp: number; lanes: 3 | 4 | 5; }
export const LEVELS: Record<LevelId, CastleLevel> = { 1: { waves: 3, ... }, 2: { waves: 4, ... }, /* ... */ 5: { waves: 8, ... } };

// index.tsx
levels: LEVEL_IDS.map((id) => ({ id, description: DESCRIPTIONS[id], config: LEVELS[id],
   environment: id === 4 ? { lighting: "night", background: "#0b1020" } : undefined })),
```

### 1.4 How Scene and rules get the level

- Store (`core/useArcadeStore.ts`): new shell-owned field `levelId: LevelId` (default 1). It lives outside `freshRun()`, so
  `start()`/`restart()` keep it, and `reset()` sets 1. New action `selectLevel(id, config: Partial<RunConfig>)`: allowed
  only in `ready` and `over` (ignored otherwise: the level never changes mid-run), sets `levelId` and the run config
  (duration, lives, result delay) **without** going back to `loading` (today `configure()` sets `loading`, and `markReady()`
  runs once per stage mount). New action `menu()`: `over` or `paused` → `ready` (a fresh run state, `runId` unchanged), so
  the result panel can return to the level tiles.
- Hook (`core/level.tsx`, new): `useLevel<C>(): ActiveLevel<C>` with
  `interface ActiveLevel<C> { id: LevelId; meta: LevelMeta; spec: LevelSpec<C> | null; config: C }`, read from a
  `LevelContext` that GameShell provides (and ShellStage bridges into the Canvas like `SafeAreaProvider`). Games wrap it
  once: `export const useCastleLevel = () => useLevel<CastleLevel>();`. Frame loops read `useArcadeStore.getState().levelId`
  only if they must; normally the config is captured once per run.
- Rules stay pure: `createRun(seed, level: CastleLevel)` replaces module constants (`COUNTS`, `STARTS`, `DURATION_MS`,
  `TREASURE_COUNT`, ...). The Scene already remounts per `runId`; it creates the run with
  `useMemo(() => createRun(seed, config), [runId])`. Tests call `createRun(seed, LEVELS[n])` directly.
- `finalScore(state)` keeps its signature; a game that needs the level reads its own captured run.

### 1.5 Winning and clearing a level

Nothing new for the game: it ends a run with `end("win" | "lose" | "timeup")` as today. The shell decides:

```ts
// core/levels.ts (pure)
export function isLevelCleared(endReason: EndReason | null, score: number, level: LevelMeta): boolean {
   return endReason === "win" || (level.clearScore !== undefined && score >= level.clearScore);
}
```

A level is cleared by a win, or by reaching `clearScore` (score-attack and endless levels such as office-escape L5 or
pigeon-crossing, which never "win"). Time games: only a win is ranked (unchanged `isRankedRun`), so only a win clears.

### 1.6 Backward compatibility

A game with no `meta.levels` and no `definition.levels` is one level: `levelsOf()` synthesises level 1 from
`meta.scoring`, `useLevel()` returns `{ id: 1, spec: null, config: undefined }`, the start card shows no tiles, the
submit omits `level`. The 30 games keep working unchanged until their own levels PR. A test asserts that
`meta.levels` and `definition.levels` are both present or both absent and have the same ids (a per-game test in the
template, plus a loader-level check in `registry.test.ts` for games converted so far).

---

## 2. Shell and UI

### 2.1 Start card (`ShellOverlays.tsx` `StartCard`)

Shown only when `levelCount(meta) === 5` and the levels flag is on (§6.4):

- A row of **5 tiles** (`role="radiogroup"`, buttons with `role="radio"`, arrow keys move, digits 1–5 select): number,
  title, best on that level (formatted by its `display`: points or a time), a check when cleared, a lock icon when locked.
  Phones: the row scrolls horizontally inside the card (no page scroll), tiles ≥ 44 px.
- Under the row: the selected level's `description` and, for a locked tile, "Clear level 2 to unlock".
- **Total** line: "Total 3 420 pts · 2 of 5 levels cleared" (sum of the per-level bests, §3).
- Play plays the selected level (disabled on a locked tile). Instructions show `spec.instructions ?? definition.instructions`.
- The top-10 block below stays the one game leaderboard (totals).
- Selecting a tile calls `selectLevel(id, levelRunConfig(definition, id))` and writes the URL (§2.4).

New pure module `core/levelProgress.ts`:

```ts
export interface LevelProgress { id: LevelId; title: string; best: number | null; bestDurationMs: number | null; plays: number; cleared: boolean; unlocked: boolean; }
export function levelProgress(meta: ArcadeGameMeta, entry: LocalScoreEntry | null): { levels: LevelProgress[]; total: number; cleared: number };
export function pickInitialLevel(progress: LevelProgress[], requested: number | null, lastPlayed: LevelId | null): LevelId;
export function levelRunConfig(definition: GameDefinition, id: LevelId): Partial<RunConfig>;
```

`pickInitialLevel`: the requested level if unlocked, else the highest unlocked level ≤ requested; with no request,
the last played level, else the lowest unlocked level that is not cleared, else 5.

### 2.2 Unlock rule (recommendation: unlock by clearing)

`unlocked(1) = true`; `unlocked(n) = cleared(n - 1) || hasScore(n)`; never re-locks.

Why clearing and not "played once": the plan's levels escalate from tutorial to challenge, and with a summed board a
"play to unlock" rule lets anyone die in 4 s on levels 1–4 to reach 5. Why not "all unlocked": same reason, and the
tiles would carry no progression. `hasScore(n)` keeps a level open that was scored on another device or before a rule
change. `cleared` comes from the local flag set on a win (§3) **or** a best ≥ `clearScore`, which also works for
server-synced bests (the server knows scores, not wins). The unlock is client-side only; the server accepts any known
level within its limits (§7, risk R4).

### 2.3 Result panel (`ui/ResultPanel.tsx`, K2 file maintained by Claude)

New optional props: `level?: { id: LevelId; title: string; count: number }`, `total?: number`, `unlockedLevel?: LevelId | null`,
`onNextLevel?: () => void`, `onLevels?: () => void`. Shows "Level 3 · Copy Room", the score, the **level** best
(`SubmitResult.best` becomes the level best, §3.3), the new total, and "Level 4 unlocked!" on the first clear.
Buttons in the sticky bar: **Next level** (primary, only when level n is cleared, n < 5), **Retry** (same level),
**Levels** (`menu()`, back to the start card), Exit. Next level = `selectLevel(n + 1, ...)` then `restart()`.
The HUD gets a "L3" chip (`HudChips`) when the game has 5 levels.

### 2.4 URL

`/3d/<slug>?level=3`. The page is static (SSG, `dynamicParams = false`), so the server never reads it: GameShell reads
`window.location.search` once on mount (client only, no `useSearchParams` Suspense boundary needed), passes it to
`pickInitialLevel`, and on every tile change writes it with `window.history.replaceState` (Next 14.2 syncs the router).
Level 1 removes the parameter. Invalid or locked values fall back silently. Canonical, OG and JSON-LD stay `/3d/<slug>`.
Last played level per game: `localStorage` `play50games_3d_level:<slug>` (convenience only, try/catch).

### 2.5 Analytics (`core/analytics.ts`)

`ArcadeEventPayload.level?: LevelId` (sent only for 5-level games) on `arcade_start`, `arcade_game_over`,
`arcade_new_best` (now "new level best"); new event `arcade_level_cleared` `{ game, level, score, duration_ms }`, sent
on the first clear of a level by this user/guest. GTM triggers keep matching on `event`.

---

## 3. Local scores (`core/scores.ts`, `useBestScore.ts`)

### 3.1 Storage shape (same keys `play50games_3d_scores:guest|u<id>`)

```ts
export interface LocalLevelEntry { best: number; bestDurationMs: number | null; plays: number; lastPlayed: string; cleared: boolean; }

export interface LocalScoreEntry {
   /** the per-game TOTAL = sum of levels[*].best (single-level games: the level-1 best, as today) */
   best: number;
   /** sum of the levels' bestDurationMs when every scored level has one, else null */
   bestDurationMs: number | null;
   plays: number;            // all levels
   lastPlayed: string;
   rank: number | null;      // the server rank of the total
   /** keys "1".."5"; absent in data written before this change */
   levels?: Partial<Record<`${LevelId}`, LocalLevelEntry>>;
}
```

`best` keeps its place and now means "the number the board ranks", so the existing `/3d` cards, `BestScoreBadge` and
any old tab reading `entry.best` stay correct.

### 3.2 Migration (lazy, no write on read)

`readLocalScores()` runs every entry through pure `normalizeEntry(slug, entry)`: an entry without `levels` becomes
`levels: { "1": { best, bestDurationMs, plays, lastPlayed, cleared: best >= (clearScore of level 1 ?? Infinity) } }`
and `best` stays the same number. The next save writes the new shape. Unknown level keys are dropped; a malformed
level entry is dropped, never thrown.

### 3.3 Submit and results

- `FinishedRun.level: LevelId` (default 1). `normalizeRun(run, scoringFor(meta, run.level))`, `isRankedRun` with the
  level's rules. `mergeRun` merges into `levels[level]`, sets `cleared ||= isLevelCleared(...)` and recomputes the total.
- `SubmitResult` gains `level: LevelId`, `total: number`, `newlyCleared: boolean`; `best` / `bestDurationMs` /
  `isNewBest` become **the level's** (for single-level games: identical to today).
- `sendToLeaderboard` sends `level` only when it is not 1 (single-level payloads stay byte-identical) and reads
  `data.level_best_score` and `data.best_score` (= total) from the response (§4.4).
- `unrankedResult(slug, level, userId)`.
- `syncServerScores`: per game and per level, `best = max(local, server)`; `cleared ||= server best >= clearScore`; the
  total is recomputed from the merged levels; `rank` comes from the server.

### 3.4 Hooks

- `useBestScore(slug)` unchanged signature, returns the normalized entry (best = total).
- New `useLevelProgress(meta)` → `{ levels: LevelProgress[]; total: number; cleared: number }`, live on
  `ARCADE_SCORES_EVENT` and `storage` like `useBestScore` (both built on one internal `useLocalEntry(slug)`).

---

## 4. Backend (`includes/arcade-api.php`, `arcade-games.json`, admin page)

### 4.1 `arcade-games.json` version 4 (v3-compatible)

```json
"castle-defender": {
  "title": "Castle Defender", "kind": "points",
  "max_score": 1900, "min_duration_ms": 30000, "max_duration_ms": 95000, "base": 300, "max_pps": 40,
  "enabled": false,
  "levels": [
    { "title": "Outer Wall",   "max_score": 1900, "min_duration_ms": 30000, "max_duration_ms": 95000,  "base": 300, "max_pps": 40 },
    { "title": "Main Gate",    "max_score": 2900, "min_duration_ms": 38000, "max_duration_ms": 110000, "base": 350, "max_pps": 46 },
    { "title": "Twin Towers",  "...": "..." },
    { "title": "Night Siege",  "...": "..." },
    { "title": "Royal Defense","...": "..." }
  ]
}
```

(numbers illustrative). Rules: `levels` optional; when present exactly 5 entries; each entry has the full limit set of
the game's `kind` (`max_score`, `min/max_duration_ms`, and `base` + `max_pps` or `time_base_ms`); `kind` and `enabled`
are game-level only; **`levels[0]` equals the top-level limits**. The v3 PHP reads only the top-level keys, so it sees
level 1: the v4 JSON can be uploaded before or after the new PHP. Invalid `levels` → logged, the game is served as
one level (submits for 2–5 then fail as unknown levels, never as wrong limits). `registry.sync.test.ts` checks every
`meta.levels[i].scoring` against `levels[i]`, `levels[0]` against the top level, and that a game without `meta.levels`
has no `levels` key.

`play50_arcade_normalize_game()` adds `'levels' => [1 => limits, ..., 5 => limits]` (always present; one entry for a
single-level game) and `play50_arcade_game_level($game, $level)` → limits array or null. `GET /arcade/games` returns
the normalized `levels` per game and a top-level `"features": { "levels": true }`.

### 4.2 Database (DB version 2 → 3)

The existing `{prefix}play50_arcade_scores` table **stays the board**: one row per user and game, and its `best_score`
becomes the **total**. Rank, top-50 cache, `hidden`, privacy, the admin page list and `GET leaderboard` keep working on
it unchanged. New table for the per-level bests:

```sql
CREATE TABLE {prefix}play50_arcade_level_scores (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  game_slug varchar(40) NOT NULL,
  level tinyint(3) unsigned NOT NULL,
  best_score int(10) unsigned NOT NULL DEFAULT 0,
  best_duration_ms int(10) unsigned DEFAULT NULL,
  last_score int(10) unsigned NOT NULL DEFAULT 0,
  plays int(10) unsigned NOT NULL DEFAULT 0,
  best_at datetime NOT NULL,
  last_played datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY user_game_level (user_id,game_slug,level),
  KEY game_level (game_slug,level,best_score)
);
```

Why a table and not a `level` column on the scores table: `dbDelta` cannot change the existing `UNIQUE user_game`
key, and a column would turn every board query into a `SUM ... GROUP BY` and break the rank function, the cache and the
admin page. Keeping the total as a materialised row keeps every read path as it is.

Migration in `play50_arcade_install()` (on `init` when the option is not `'3'`): `dbDelta` the new table, then one
idempotent backfill
`INSERT IGNORE INTO level_scores (user_id, game_slug, level, best_score, best_duration_ms, last_score, plays, best_at, last_played) SELECT user_id, game_slug, 1, best_score, best_duration_ms, last_score, plays, best_at, last_played FROM scores`,
then `update_option('play50_arcade_db_version', '3')` only when all three tables exist and the backfill returned
non-false. Existing bests become level 1; the totals are already equal to them, so no board moves at migration.
`play50_arcade_levels_ready()` = option is `'3'`.

### 4.3 Submit (`POST /arcade/scores`)

Body: `{ slug, score, duration_ms, level?, run_token? }`. New steps (§7 numbering of `docs/arcade-api.md`):

- **6b. Level**: absent → 1. Must be an integer (`play50_arcade_int`) with `play50_arcade_game_level($game, $level) !== null`,
  else `invalid_data` 400 `{ field: "level" }` ("Unknown level."). Steps 8–10 then use **that level's** limits.
- **10c. Run token**: verified against the level (§4.5).
- **11. Writes**: when levels are ready: (a) the level upsert into `level_scores` (the exact statement of today's
  upsert, keyed by `user_game_level`); (b) the total upsert into `scores`:
  `INSERT INTO scores (...) SELECT %d, %s, SUM(best_score), ... FROM level_scores WHERE user_id = %d AND game_slug = %s ON DUPLICATE KEY UPDATE best_at = IF(VALUES(best_score) > best_score, VALUES(best_at), best_at), best_score = VALUES(best_score), best_duration_ms = VALUES(best_duration_ms), last_score = VALUES(last_score), plays = plays + 1, last_played = VALUES(last_played)`.
  The total is assigned (not `GREATEST`), so an admin deleting a forged level row lowers it on recompute
  (`play50_arcade_recompute_total($uid, $slug)`, also called by the admin page). `best_duration_ms` of the total = sum of
  the levels' when none is null, else null. When levels are **not** ready: level 1 takes today's path unchanged, levels
  2–5 return `db_error` 500 ("levels not ready").
- Response `data` adds `level`, `level_best_score`, `is_new_level_best`; `best_score` = total, `is_new_best` = the total
  rose (equals `is_new_level_best`, since a total of bests rises exactly when one best rises), `rank` = rank of the total.
  Old clients read `best_score`/`rank` and stay correct.
- Rate limits unchanged: the 3 s gap stays per user **and game** (not per level; a level is a full run), 10/min per
  user, 30/10 min per IP. "Next level" right after a submit is fine: a run lasts ≥ `min_duration_ms`.

### 4.4 Reads

- `GET /arcade/leaderboard/<slug>`: shape unchanged, `score` = total. New optional per entry `levels_scored` (0–5),
  from one `COUNT(*) ... GROUP BY user_id` on the top-50 user ids inside the cached `play50_arcade_top()`.
  `?level=` is not supported (one board, user decision).
- `GET /arcade/me`: each slug entry keeps `best` (= total), `best_duration_ms`, `plays`, `last_played`, `rank` and adds
  `levels: { "1": { best, best_duration_ms, plays, last_played }, ... }` (only scored levels; one extra query by user).
- `GET /arcade/games`: §4.1.

### 4.5 Run tokens bound to the level

`POST /arcade/runs/start` takes `{ slug, level? }` (validated like the submit; unknown → `invalid_data` field `level`).
The ticket format stays `r1.<issued>.<expires>.<nonce>.<sig>`; only the signed subject changes:
`$subject = ($level === 1) ? $slug : $slug . '@' . $level` (`@` is outside the slug charset, so no collision), passed as
`$slug` to `play50_arcade_run_token_sign()` / `_check()`. Level-1 tickets are byte-identical to today, so tickets
issued just before the upload still verify; a level-3 ticket fails `signature` on a level-5 submit. Expiry uses the
level's `max_duration_ms`. The claims table keeps `game_slug` = slug. Enforcement switch and fallback unchanged.
Client: `arcadeApi.startRun(slug, level?)`, `runTicket.onRunStart(runId, slug, level)`.

### 4.6 Admin page and deletes (`wt-cpt/arcade-scores-admin.php`, Codex X3 file, changed in the backend PR)

"Reset game" also deletes the slug's `level_scores` rows; deleting one board row also deletes that user's level rows
for the game; a new per-row "Levels" detail shows the 5 bests (read-only). `play50_arcade_on_deleted_user()` deletes the
user's level rows. Ban/unban stays on the board table.

### 4.7 What the user uploads, in order (zero downtime for the 10 live games)

1. Plesk backup (DB + theme files). `php -l` on both PHP files.
2. Upload `includes/arcade-api.php` (DB v3) and `wt-cpt/arcade-scores-admin.php`. The first request migrates (small
   tables, one `INSERT ... SELECT`). Old frontends keep working: no `level` = level 1, same responses plus extra keys.
3. Upload `includes/arcade-games.json` v4 (no game has `levels` yet in this first upload, so limits are unchanged).
4. Claude checks read-only: `GET /arcade/games` shows `features.levels`, version 4; then the curl suite on the
   "arcade-test" user (level omitted, level 1, level 2 on a single-level game → `invalid_data level`, `level: "x"`, a
   level-bound ticket on the wrong level) and Reset game for the test rows.
5. Only then the frontend levels flag goes on (§6.4). Each later game's levels need a JSON upload **before** its merge,
   exactly like a go-live.

---

## 5. Score-limit proofs per level (`arcade-score-limits` skill)

The skill applies **once per level**: every level is its own scoring window, so each gets its own score sources,
`B(t)`, chosen `base`/`maxPointsPerSec`/`maxScore`/duration window and 3–5 % margin. Concretely:

- `rules.ts` exports `PROPOSED_LEVEL_LIMITS: Record<LevelId, ScoringRules>` (replaces `PROPOSED_LIMITS`), each with a
  doc comment citing its ceiling, e.g. `/** L3: B = 5 waves × ... */`.
- `rules.test.ts` "scoring limit proof" loops `for (const id of LEVEL_IDS)`: the same bot set (oracle, greedy, idle,
  input spam, 30/60/144 Hz) × 200 seeds through `createArcadeStore()`, with `createRun(seed, LEVELS[id])`, asserting
  `withinServerLimits(score, ms, PROPOSED_LEVEL_LIMITS[id])`, `capScore` a no-op, and the best bot ≥ 90 % of that
  level's `maxScore`. Plus: `PROPOSED_LEVEL_LIMITS[id]` deep-equals `scoringFor(meta, id)` once Claude copied them.
- Clear targets get their own test: the greedy bot reaches `clearScore` (or wins) on ≥ 60 % of seeds of each level,
  and the idle bot never clears (a level cannot be cleared by doing nothing).
- README section "Server limits and why they hold" gets one sub-section per level (one table row per score source per
  level is enough when only counts and speeds change), and a "Levels" table (title, config deltas, clear rule, limits).
- Time games: `timeBaseMs` and `minDurationMs` per level (each level's fastest legal finish), proof per level.
- Per-level limits stay roughly the same order of magnitude (L5 max ≤ ~3 × L1 max), so the sum is not decided by one
  level alone (§7, Q3).

---

## 6. Work breakdown and rollout

### 6.1 Core PRs (Claude)

**C-L1 `claude/levels-core`** (no UI change, flag off): `types.ts` (`LevelId`, `LEVEL_IDS`, `LevelMeta`, `meta.levels`),
`registry.ts` helpers, `flags.ts` `ARCADE_LEVELS`, `core/types.ts` (`LevelSpec`, `GameDefinition.levels`), store
(`levelId`, `selectLevel`, `menu`), `core/level.tsx` (`LevelContext`, `useLevel`), `core/levels.ts` + `levelProgress.ts`
(pure), `scores.ts` (shape, `normalizeEntry`, per-level merge, sync), `useBestScore`/`useLevelProgress`,
`lib/api/arcade.ts` (`level` in submit and start, response and `me` types, the mock keyed by slug + level with totals),
`runTicket.ts`, `analytics.ts`, `registry.sync.test.ts`. Tests: store transitions (`selectLevel` ignored mid-run,
`menu()`), migration of an old entry, totals, unlock rules, `pickInitialLevel`, submit payload omits level 1, mock
board sums. Size ≈ 900–1100 lines incl. tests.
**C-L2 `claude/levels-shell`**: start-card tiles, result panel buttons, HUD chip, URL read/write, `/3d` card shows
"Total · n/5" for 5-level games, `core/README.md` "Levels" section, a dev-only demo (`PlaceholderScene` with 5 colour
configs) for the headless playtest at 1280 × 800 and 390 × 844 with the cookie banner. Size ≈ 500–700 lines.
Both merge to `main` safely: no game has levels and the flag is off.

### 6.2 Backend PR (Claude) `claude/levels-backend`

`arcade-api.php` §4 (DB v3, level validation, level-aware limits and tickets, totals, `me.levels`, `features`),
`arcade-games.json` v4 header (no `levels` yet), admin page §4.6, `tools/arcade-php-tests/run.php` cases (normalize
levels, invalid levels fallback, subject signing, level 1 ticket identical to v3), `tools/arcade-api-smoke.sh
--only levels` (never against production without the user's OK), `docs/arcade-api.md` (§2, §3, §6.1–6.4, §6.6, §7, §9,
§12, §13) and `docs/run-tokens.md` §3/§5. Size ≈ 350 PHP + 200 tests + docs. Can be built in parallel with C-L1;
it is **uploaded before** the flag goes on.

### 6.3 Per-game "levels" task (template for helper agents)

Branch `<agent>/levels-<slug>`; touch only `games/<slug>/**` plus, as the one exception, the `levels` array of its own
entry in `arcade-games.json` for **dev** games (Claude re-derives it at review; live games: Claude writes the JSON).

1. Read the plan's 5 "Levels" blocks for the game and today's `rules.ts`. Today's game becomes **level 1** for the 10
   live games (keeps their migrated bests fair, Q1); dev games may follow the plan's L1 directly.
2. `levels.ts` (pure): `export interface <Game>Level { ... }` with only what varies (layout id or segment count,
   objective count, spawn table, hazard kinds, speed factor, timer, lives, lighting preset) and `LEVELS: Record<LevelId, ...>`.
   Map the plan: "Map size / Layout" → layout or segment count; "Main objective" → objective count; "Hazards" → hazard
   set; "Timer / target" → `durationMs` or clear target; "Lighting / mood" → `environment` (L1 day/indoor, L4 night,
   L5 the game's dramatic preset); "New mechanic" → the one feature switched on at that level. Same base environment,
   same assets (a new prop only with an approved asset batch).
3. `rules.ts`: module constants that vary become `createRun(seed, level)` inputs; nothing else changes.
4. `Scene.tsx`/`Hud.tsx`: read the config through `useLevel` (one game hook); HUD maxima from the config.
5. `index.tsx`: `levels` with description, config, environment/duration/lives overrides. `meta.ts`: `levels` with titles
   from the plan, `clearScore`, and `scoring` = `PROPOSED_LEVEL_LIMITS` (level 1 = `meta.scoring`).
6. Tests: `levels.test.ts` (ids 1..5 match meta; difficulty is monotone: objective count, speed or hazard set never
   decrease; every level solvable by the oracle bot on 200 seeds; existing fairness tests run per level), the §5 proofs,
   `assets.test.ts` unchanged. README: "Levels" table + per-level proofs.
7. Gate: `npx tsc --noEmit`, `npx vitest run`, flagged build, headless playtest of all 5 levels (desktop + phone), HANDOFF
   with proposed limits and the clear rates. Size per game ≈ 400–900 lines, about one agent day; zoo-escape and
   escape-room (hand-authored maps) are the large ones.

### 6.4 Rollout

1. C-L1 and the backend PR in parallel → user uploads the backend (§4.7) → C-L2.
2. **Pilots (Claude)**: `robot-collector` (live points game, the reference proof, simple spawn-count configs),
   `castle-defender` (dev, already wave-based: the plan's 3/4/5/6/8 waves map onto `COUNTS`/`STARTS`), `obstacle-race`
   (live **time** game: course length and hazard configs, exercises time-score totals). After each: Claude limits commit,
   user uploads the JSON, merge, Vercel preview with `NEXT_PUBLIC_ARCADE_LEVELS=1` checked live.
3. Production flag `NEXT_PUBLIC_ARCADE_LEVELS=1` once the three pilots and the backend are live (until then production
   behaves as level 1 everywhere, even for converted games).
4. Remaining 7 live games one by one (as Release 2 go-lives), then the 20 dev games by their owners, in parallel.

---

## 7. Risks and open questions

**Risks**

- R1 Content: 150 level configurations and 150 limit proofs. Mitigation: configs vary data only (§6.3), the bot harness
  is looped, not rewritten.
- R2 Board shift: on the live games, totals grow as players play levels 2–5; old level-1-only bests drop in rank.
  Expected; announce it, no data loss.
- R3 Sum scale: a level with a much larger `maxScore` dominates the total (office-escape and pigeon-crossing are
  endless, max 152 500 / 50 000). Mitigation: §5 order-of-magnitude rule; Q3.
- R4 Unlocks are client-side: a forged client can submit level 5 directly. Each level is still bounded by its limits and
  ticket, so the worst case equals an honest player who cleared 1–4. Accepted.
- R5 Order: the frontend flag on before the PHP upload would send `level` to a v3 server, which ignores it and stores a
  level-5 score as the game best. Mitigation: the flag stays off until `GET /arcade/games` shows `features.levels`;
  C-L1 also disables level select at runtime when the games response lacks it (one cached read).
- R6 Bundle and memory: all 5 configs share one asset set; a level-only GLB would load for every level. Keep per-level
  assets out unless approved.
- R7 `RunState.level` vs `levelId` confusion for agents: §1.1 and the core README spell it out; a later rename of the
  stage field to `stage` is optional.

**Open questions for the user**

- Q1 Live games: should **today's game be level 1** (recommended: migrated bests stay meaningful) or should level 1
  become the plan's easier tutorial (then old bests count as level 1 although they were earned on a harder level)?
- Q2 Unlock rule: clear (win or target score) as recommended, or unlock by playing once, or all open?
- Q3 Total: plain sum of raw bests (as decided), or should each level be scaled to a common maximum (e.g. 1 000 per
  level) so no level dominates? Recommended: plain sum with the §5 scale rule.
- Q4 Time games (escape-room, obstacle-race): the total is a sum of time scores shown as points; the per-level tiles
  show times. OK, or should their board show the sum of best times (only for players who finished all 5)?
- Q5 Helpers editing their own game's `levels` in `arcade-games.json` for dev games (§6.3): allowed, or Claude only?
- Q6 Pilots: robot-collector, castle-defender, obstacle-race. Swap any?
- Q7 Should guests see levels 2–5 locked like everyone, or should levels need a login? Recommended: same rules for guests.
