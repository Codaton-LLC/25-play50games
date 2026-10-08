# Single-use Arcade run tokens

Design for Phase 5, 2026-10-07, read against main `ad772150d93b071da32fd434d59513cee0bef48e`, revised the same day after Claude's adversarial review (§11 lists the decisions). **Implemented 2026-10-08 (`claude/run-tokens`) with the deviations in §12**: a signed ticket instead of a stored random value, and one global enforcement switch (default off) instead of the per-game `run_token_mode`. The contract is [arcade-api.md](arcade-api.md) §6.6 and §7a; where §§2–10 below differ from §12, §12 and the contract win. The rollout is §12's, with the post-launch test procedure of §6.

## 1. Goal, threat model and limits

Require a server-issued, user-bound, game-bound, single-use ticket before a ranked submission. In `required` mode it delivers:

- **Replay and plays hygiene.** One ticket authorizes at most one accepted submit, so a copied or repeated request cannot add a second play or apply its score again, including simultaneous requests. A database failure after the claim can burn a ticket without recording a score (the run stays saved on the device); it can never apply one twice.
- **Issuance record.** Every accepted ranked submit has a server-recorded start for that user and game, issued at least `duration_ms − DURATION_SLACK_MS` before the submit. A ticket is a 128-bit random value: it cannot be guessed, and another account or game cannot use it.
- **Telemetry.** Starts, claims, tokenless submits and fixed rejection reasons become visible per game (§8).

It does **not** deliver ranking integrity. A bot with one valid account posts the best score the server accepts with one start, a short wait and one submit. The elapsed bound only enforces the wait, and only against long claimed durations; it cannot reject a short one. The board keeps one best per user (`GREATEST` in the upsert, arcade-api.md §9), so one accepted forgery is enough, and replay is worthless to a cheater anyway. The start limits are at least as generous as the submit limits, so they do not slow a bot either.

Earliest server age of a ticket at which the current limits accept each game's best score: `max(min_duration_ms, (max_score − base) × 1000 / max_pps) − DURATION_SLACK_MS`; for TIME games, the best score the server computes at `min_duration_ms`. Every value lies inside the ticket TTL. Values for the tightened limits of 2026-10-07 (`arcade-games.json` version 2; the previous best accepted score in brackets):

| Game | Best accepted score | Claimed duration | Earliest ticket age |
|---|---|---|---|
| robot-collector | 1470 (was 1600) | 12500 ms | ~11.5 s |
| penalty-hero | 1450 (was 1500) | 15500 ms | ~14.5 s |
| escape-room (time) | 58370 (was 58500) | 16300 ms | ~15.3 s |
| obstacle-race (time) | 28150 (was 28500) | 18500 ms | ~17.5 s |
| clean-city | 4940 (was 6000) | 43000 ms | ~42 s |
| warehouse-rush | 1700 (was 3000) | 58621 ms | ~57.6 s |
| food-catcher | 2500 (was 5000) | 89286 ms | ~88 s |
| tower-climb | 19000 (was 50000) | 1727273 ms | ~1726 s |
| pigeon-crossing | 50000 | 1785715 ms | ~1785 s |
| office-escape | 152500 (was a 180000 ceiling) | 1794118 ms | ~1793 s |

The real lever for ranking quality is the **"assets + limits" PR**: change `meta.ts` scoring and `arcade-games.json` together (`registry.sync.test.ts` checks them) so that the server's accepted maximum is the game's provable maximum and nothing above it. That PR is `claude/tighter-limits` (2026-10-07): every game's limits now sit at its proven maximum plus about 3–5%, and each README "Server limits" section carries the proof and its margins, with tests that no reachable run hits the cap. For robot-collector the levers are `max_score` and `min_duration_ms`, not `base`/`max_pps`: every valid layout has an ideal route of at least `IDEAL_ROUTE.min` = 80 units, the pickup reach shortens it by exactly 15.2, so any real route is at least 64.8 units, no win comes before 12.96 s and the maximum is 1000 + 10 × 47 = 1470 (`max_score` 1470, `min_duration_ms` 12500). Even tight limits let a forger post the best possible score; only server-side verification of the run itself could stop that, and it is out of scope. The new limits do not re-check stored scores: a stored robot-collector score above 1470, or with a duration under 12500 ms, is certainly forged and can be reset in wp-admin.

This is **not gameplay attestation**. Tokens do not establish that inputs, collisions, a TIME game's win or the reported duration were genuine. An automated client can collect tickets and use them within the issuance and submit limits, including parallel runs. Distributed accounts or IPs and compromised JWTs remain outside every guarantee. The browser API key is not a secret: production has no `PLAY50_API_KEY` defined, so that gate is open.

`optional` mode allows tokenless submissions and therefore gives none of these guarantees across the board. Neither mode re-verifies old scores. Guests keep playing and keeping local bests without a server ticket.

## 2. Proposed policy and identifiers

Use one per-game field, `run_token_mode`, in `includes/arcade-games.json`: `off | optional | required`. No global override, no new frontend environment flag. Normalization never removes a game:

| JSON value | Normalized | Effect |
|---|---|---|
| missing | `off` | Legacy behavior |
| `"off"`, `"optional"`, `"required"` | the same | §6 table |
| anything else (typo, wrong type, `null`) | `required` plus `config_error: "run_token_mode"` | Fails closed for ranking only: the game, its leaderboard, `/me` and the admin keep working. The loader logs it once per request, like today's skipped entries, and the admin shows the marker |

Today an invalid `kind` or limit skips the game (arcade-api.md §3 "Loader"). `run_token_mode` must not join that list: a skipped game returns 404 on submit and leaderboard and vanishes from `/me`, and a typo in a hand-uploaded file must not take the live game offline. Guard rails for the hand upload: `registry.sync.test.ts` asserts that `run_token_mode` is absent or one of the three values, and plan §3 "5.4" gains a JSON check before every upload, because `php -l` does not parse JSON:

```bash
php -r 'json_decode(file_get_contents($argv[1]), true, 512, JSON_THROW_ON_ERROR); echo "ok\n";' includes/arcade-games.json
```

Expose the normalized field (and `config_error` when set) through `GET /arcade/games`, keeping its `{ games: { ... } }` shape and its `public, max-age=300` header. There is no server-side cache to clear (the loader keeps only a per-request `static`), so a mode change applies at the next submit, and HTTP caches catch up within 300 s. The new client method `arcadeApi.games()` fetches with `cache: "no-cache"`, once per shell mount, without blocking Play. The client uses the policy for two things only: whether to request a start (skipped only when the policy is confirmed `off`) and which copy to show (§7). It never uses the policy to decide whether to upload or whether to attach a ticket; the server decides at submit.

| Constant | Value | Purpose |
|---|---|---|
| `DURATION_SLACK_MS` | 1000 | Server clock steps, ms rounding and the one capped frame of the invariant below; not countdown or network time |
| `TTL_SLACK_MS` | 300000 | Countdown, pauses, upload, and a "Save to my account" login after the run |
| Ticket TTL | the game's `max_duration_ms + TTL_SLACK_MS` | Absolute wall-clock lifetime, never sliding |
| Live tickets | 3 per (user, game) | Bounds storage without breaking a quick Retry (§3) |

The two slacks are independent: the five-minute expiry allowance never lets a client claim five minutes of play right after issuance. A pause or offline period longer than the remaining TTL leaves the run local-only. A ticket is never extended or replaced for a run that has started.

**Invariant: honest runs are never rejected as `elapsed`.** The client keeps a ticket only if its start response resolved while the same store `runId` was still in `countdown` (or `paused` with `pausedFrom: "countdown"`), §7. Then server issuance ≤ response arrival ≤ start of play. `elapsedMs` counts only frame time after the countdown, each frame capped (`useRunFrame` dt ≤ 1/20 s, store `MAX_TICK_MS` 250 ms), so it never exceeds the wall time since play began plus the remainder of the frame in which the countdown ended (at most one capped frame). Every honest duration therefore satisfies `duration_ms ≤ now − issued + one frame`, whatever `COUNTDOWN_MS` is. A shorter countdown or a "skip countdown on Retry" change cannot cause false rejections; it can only leave such runs without a ticket.

`run_token` is a server-generated 128-bit random value from PHP [random_bytes(16)](https://www.php.net/manual/en/function.random-bytes.php), encoded as exactly 32 lowercase hex characters. It is unrelated to the store's numeric `runId`. Server timestamps are integer Unix milliseconds from `play50_arcade_now_ms()` (64-bit PHP). None comes from a request or the client clock, and the start response carries none.

## 3. Start endpoint and ticket

Register `POST /play50/v1/arcade/runs/start` (namespace `play50/v1`, route `/arcade/runs/start`). Reuse `play50_arcade_auth_user` as `permission_callback`: the API-key helper, Bearer JWT, and an existing user. Cookies alone stay 401. The API-key behavior is unchanged while `PLAY50_API_KEY` is undefined; hardening that gate is a separate deployment decision.

Request:

```json
{ "slug": "robot-collector" }
```

Success is HTTP 200 with `Cache-Control: private, no-store` and exactly:

```json
{ "run_token": "7c9e5b30f0124ca3b6df90a12f348bd7" }
```

The ticket never appears in a URL, shared cache, analytics event, log line or error message.

There is no `run_id`, no HMAC and no signing key. Every HMAC input would be read back from the server's own row, the 128-bit value already binds that row to one user and one game, and the only adversary in scope (an account holder) receives the ticket in the same response anyway. Dropping it removes the canonical-string rules, the key derivation from `wp_salt('auth')` (which shares its root with the `functions.php` JWT fallback), the `signature` reason, and the salt-rotation failure mode that would look like an attack spike. The raw value is the primary key: without its owner's JWT it authorizes nothing (the §4 binding check), so hashing it would protect nothing a database backup does not already expose.

Order: API key → JWT/existing user → ban (`play50_arcade_banned`) → slug format → known and enabled game → **mode** (`off` → `not_found` 404: nothing stored, no readiness check) → storage readiness (§4; else `db_error` 500) → start limits → opportunistic cleanup (§4) → live-ticket cap → insert → response. Only `slug` is read from the body. A random-value collision retries once; any other insert failure returns `db_error` 500 and never a usable ticket.

### Start validation and rate limits

| Check order | Proposed transient | Limit/window |
|---|---|---|
| 1 | `p50a_rl_start_u_{uid}` | 30 / 60 s |
| 2 | `p50a_rl_start_ip_{ip_hash}` | 120 / 600 s |

These are sized from the play cycle, not copied from submit. Every countdown issues a start (Restart and Retry included), while quit runs, TIME-game lose/timeup and runs below `min_duration_ms` never submit. A quick-death cycle on a game with a 3000 ms minimum (3 s countdown, 1–3 s of play, 0.8 s result delay, a click) takes 5–7 s, so about 10–12 starts a minute per player; 30 leaves room for paused Restarts and a second tab. 120 per 10 minutes per hashed IP covers several players behind one NAT or carrier IP.

There is no per-game start gap. It protected nothing (a ticket allows one submit, and the unchanged submit limits bound throughput), and it cost the ticket on a paused Restart within 3 s. Submit keys and numbers (arcade-api.md §8: `p50a_gap_*`, `p50a_rl_u_*`, `p50a_rl_ip_*`) and the registration and privacy limits stay unchanged. Earlier checks count when a later one fails; a rejected check does not increment its own counter. IPs come from `REMOTE_ADDR` plus the existing `play50_arcade_client_ip` filter; never trust an arbitrary `X-Forwarded-For`. The transient limiter's small concurrency overshoot stays an accepted throughput limit; it is not what enforces single use.

**Live-ticket cap.** Before the insert, keep at most the two newest unused, unexpired tickets of this user and game, so there are at most three after it:

```sql
-- the second-newest live ticket of this user and game, if any
SELECT issued_ms FROM {runs}
WHERE user_id = %d AND game_slug = %s AND used_ms IS NULL AND expires_ms > %d
ORDER BY issued_ms DESC LIMIT 1 OFFSET 1;
-- when a row came back: drop every older unused ticket
DELETE FROM {runs}
WHERE user_id = %d AND game_slug = %s AND used_ms IS NULL AND issued_ms < %d;
```

Only older tickets go, never just "the previous one": the previous run's upload may still be in flight when Retry starts the next countdown. Two parallel starts may briefly leave four live tickets; that is accepted, because the cap bounds storage and is not a security property.

## 4. Storage, single-use claim and expiry

Use a small durable table, `{$wpdb->prefix}play50_arcade_runs`, rather than a transient per ticket. WordPress [transients can disappear before their advertised expiration](https://developer.wordpress.org/apis/transients/), and a `get_transient` followed by `delete_transient` does not serialize two consumers.

| Proposed column | Type/meaning |
|---|---|
| `run_token` | `CHAR(32)` ASCII, binary comparison, primary key |
| `user_id` | Unsigned bigint, authenticated owner |
| `game_slug` | `VARCHAR(40)`, validated slug |
| `issued_ms` | Unsigned bigint, immutable server issuance |
| `expires_ms` | Unsigned bigint, immutable absolute expiry |
| `used_ms` | Nullable unsigned bigint; null until claimed |

Indexes: primary key `run_token`, `expires_ms` for cleanup, `(user_id, game_slug)` for the cap and account deletion. No JWT, IP or payload is stored.

**Install and readiness.** Extend the existing `dbDelta` install, bump `PLAY50_ARCADE_DB_VERSION` to `'2'`, and record the new version only after `SHOW TABLES` confirms both tables (the current install already checks its table that way). Readiness on every request is then the autoloaded `get_option('play50_arcade_db_version') === PLAY50_ARCADE_DB_VERSION` that `init` already reads, so no extra query. Uploading files to the already-active theme never fires `after_switch_theme`; the versioned `init` path installs, as today. The design needs no transaction and no locking read, so it works on InnoDB and MyISAM alike: no engine check and no `ALTER` of the live scores table.

**Submit: claim first, no transaction.** After arcade-api.md §7 steps 1–10 (auth, ban, slug, enabled game, submit limits, duration, score) and before step 11:

1. Resolve the game's normalized mode. `off`: drop `run_token` and run the unchanged legacy path. No readiness check and no query on the runs table.
2. `optional` or `required`: with `run_token` absent, optional continues on the legacy path and required returns reason `required`. Present but not a string of exactly 32 lowercase hex characters → reason `malformed`.
3. Readiness, else `db_error` 500.
4. `now_ms = play50_arcade_now_ms()`. One plain `SELECT user_id, game_slug, issued_ms, expires_ms, used_ms` by primary key. No row → `unknown`; another user or slug → `binding`; `now_ms >= expires_ms` → `expired`; `used_ms` set → `used`; `duration_ms > now_ms − issued_ms + DURATION_SLACK_MS` → `elapsed` (a backward server clock step also lands here). These rejections write nothing; the ticket stays usable for a correct submit.
5. Claim with one autocommitted statement:
   ```sql
   UPDATE {runs} SET used_ms = %d
   WHERE run_token = %s AND user_id = %d AND game_slug = %s AND used_ms IS NULL AND expires_ms > %d
   ```
   Exactly 1 affected row → continue. 0 → re-read the row and return `used` or `expired` (a concurrent consumer won). `false` → `db_error` 500.
6. The unchanged arcade-api.md §9 read of the previous best, autocommit upsert, read-back, rank and cache clear, then the unchanged §6.2 response. Assignment order, hidden/name behavior, points limits and TIME score recomputation stay as they are. If any of these fails, return `db_error` 500 and **leave the ticket claimed**: a lost-connection (2013) upsert may have committed, so un-claiming could apply one ticket twice.

Single use is the database's own guarantee that only one `UPDATE … WHERE used_ms IS NULL` can change the row. On "MySQL server has gone away" (2006), `wpdb::query()` silently reconnects and re-runs the failed statement with autocommit on. With claim-first, that re-run can only find the ticket claimed (burned, which fails safe), never undo a claim, and there is no `FOR UPDATE` lock or transaction to lose. Lock waits, gap locks on a first submit's missing score row, and deadlocks do not arise, and the scores upsert stays the single atomic statement it is today.

There is no SQL transaction anywhere on these paths. Every transient or option write (limiter hits, `play50_arcade_clear_cache`, the cleanup marker) is its own autocommitted write, and the rejection reason travels in a PHP variable to the response and the log line, so nothing a rejection records can be rolled back. Any counter added later is written after the decision (§8).

**Expiry and cleanup.** An expired ticket never authorizes a submit, whether or not cleanup has run. Used rows stay until their expiry, so a replay reports `used`. Cleanup needs no WP-Cron: when the `p50a_runs_gc` transient is absent, a start sets it for 10 minutes and runs `DELETE FROM {runs} WHERE expires_ms <= %d LIMIT 1000`. Missing traffic delays physical cleanup but never extends validity. `play50_arcade_on_deleted_user` also deletes that user's tickets. A ban is rechecked on both routes; an issued ticket cannot submit while banned. Admin reset and cache clear never touch tickets.

## 5. Submit contract and exact errors

`ArcadeSubmitBody.run_token` already exists (reserved and ignored today). A ticketed submit sends the start response's `run_token` unchanged alongside the unchanged score fields. No other client field (`run_id`, timestamps, user ID, mode) is read as authority.

The existing §7 steps 1–10 keep their order, including the **submit limits before duration and score validation**, so a rejected ticket spends submit budget and never increments `plays`, and a rate-limited or invalid score never touches the ticket. The token step (§4 steps 1–5) sits between step 10 and the upsert. Normal duration validation still rejects values below `min_duration_ms` or above `max_duration_ms`.

For a ticketed submit, additionally require:

`duration_ms <= now_ms - issued_ms + DURATION_SLACK_MS`

There is no lower bound tying duration to wall time (countdown, pauses, hidden-tab throttling and upload delay are legitimate), and no client clock appears in it. TIME games keep the server's duration-to-score formula; their `end("win")` rule remains a frontend rule that a ticket does not prove.

Every ticket failure uses the existing `invalid_data` code at HTTP **400** with a fixed `data.reason`, so an older client's `mapErrorCode` maps it to `rejected` and no new HTTP status enters the contract. Never `unauthorized` (it clears the JWT) or `forbidden` (it reports a ban).

| Failure | WP_Error code / HTTP | Extra data | New client status |
|---|---|---|---|
| Missing / wrong API key (only while `PLAY50_API_KEY` is defined) | `missing_api_key` / 401; `invalid_api_key` / 403 | Existing contract | `config-error` |
| Missing/invalid/expired JWT, cookie-only, deleted user | `unauthorized` / 401 | Existing contract | `login-required` (JWT dropped) |
| Banned user, start or submit | `forbidden` / 403 | Existing contract | `banned` |
| Missing/invalid slug | `invalid_data` / 400 | `field: slug` | `rejected` |
| Unknown/disabled game; start while mode off | `not_found` / 404 | None | `rejected` (submit); no ticket (start) |
| Start/submit rate limit | `rate_limited` / 429 | Integer `retry_after` in seconds | `rate-limited` (submit); no ticket (start) |
| Duration/score type, min/max or points plausibility | `invalid_data` / 400 | Existing `field` | `rejected` |
| Required mode, no `run_token` | `invalid_data` / 400 | `field: run_token`, `reason: required` | `ranking-unavailable` |
| `run_token` not 32 lowercase hex characters | `invalid_data` / 400 | `field: run_token`, `reason: malformed` | `rejected` |
| No row (never issued, evicted by the cap, purged) | `invalid_data` / 400 | `field: run_token`, `reason: unknown` | `rejected` |
| Another authenticated user or submit slug | `invalid_data` / 400 | `field: run_token`, `reason: binding` | `rejected` |
| `now_ms >= expires_ms` | `invalid_data` / 400 | `field: run_token`, `reason: expired` | `rejected` |
| Already claimed | `invalid_data` / 400 | `field: run_token`, `reason: used` | `rejected` |
| Duration exceeds ticket age plus 1000 ms | `invalid_data` / 400 | `field: duration_ms`, `reason: elapsed` | `rejected` |
| Storage not ready, SQL failure, claim or upsert failure | `db_error` / 500 | No sensitive detail | `saved-local` |
| WP core malformed JSON | `rest_invalid_json` / 400 | WP core behavior | `saved-local` |

Precedence inside the token step: mode → presence/format → readiness → lookup → binding → expiry → used → elapsed → claim. Ordinary auth, rate, duration and score failures keep their earlier precedence. Messages are fixed, e.g. "This run could not be verified. Play again to rank." SQL stays in server logs, without credentials or submitted payloads.

## 6. Rollout and backward compatibility

| Mode at submit | Old client (never sends a ticket) | New client, no ticket | New client, ticket |
|---|---|---|---|
| `off` | Legacy acceptance and limits | Same | Ticket ignored: no query, no consumption, legacy even when storage is not ready |
| `optional` | Legacy acceptance and limits | Allowed fallback | Must be valid; an invalid, expired or used ticket rejects |
| `required` | Reject `reason: required`; game still playable | `ranking-unavailable` | Must be valid |

In optional mode a rejected ticket is never stripped and resent without it; that would turn every rejection into a downgrade path. Optional mode is migration compatibility, not enforceable anti-cheat.

Proposed sequence. Every mode change is a config edit plus the §2 JSON check, nothing else:

0. Independently and first: the robot-collector "assets + limits" PR (§1). It improves ranking quality on its own; decide on tokens (Q7) with its numbers in hand.
1. Claude updates the API contract and implementation. Backup, `php -l` on both PHP files and the JSON check, then upload with every game's mode omitted (`off`). Confirm readiness in the admin (DB version 2, runs table present). Vercel flags and every `enabled` value stay as they are.
2. Deploy the compatible frontend: start requests, policy reading, memory-only tickets, `ranking-unavailable`, the simple mock. No game-owned Scene needs token code.
3. Run the token matrix on an empty "soon" slug with the post-launch procedure below, first in `optional`, then in `required`.
4. Set robot-collector to `optional` and wait 300 s for HTTP caches. Canary: the fixed `run_token` log lines (§8) and the client's ticket-outcome analytics (§7): tokenless accepts, late tickets, rejections by reason.
5. Before `required`, announce that open clients must reload and wait at least the game's `max_duration_ms` + `TTL_SLACK_MS` + 300 s after step 2's deploy. This reduces in-flight failures but cannot force an old open tab to upgrade. Switch to `required` when the Q3 thresholds hold, wait 300 s, and watch the reasons. Then repeat game by game.
6. Roll back by setting the game to `off` (or `optional`). It applies at the next submit. For up to 300 s some clients still request starts, which is harmless: a start in `off` returns 404 (no ticket), and a ticket sent in `off` is ignored. Leave the table intact; never delete data or change secrets as the rollback. Existing leaderboard scores stay intact.

### Post-launch production test procedure

Plan §3 "5.4" and arcade-api.md §13 were written for an empty pre-launch board: "frontend flags off", "only `$SLUG` has `enabled:true`", Reset game in cleanup, and "assumes the test user is in the top 50". With robot-collector live (Release 1), that procedure would take the arcade offline (the flags are build-time `NEXT_PUBLIC_*` values, so a flip needs a Vercel redeploy, and disabling the other games makes their routes 404), and its cleanup would delete every player's row (`play50_arcade_reset_game` is `DELETE … WHERE game_slug = %s`). Token tests use this variant instead:

1. Keep the Vercel flags and every game's `enabled` value unchanged. Modes `off` and `optional` are backward compatible.
2. Run the destructive and `required` matrix on a "soon" slug with no rows (e.g. food-catcher), enabled on the server only for the test window, first in `optional`, then in `required`. Afterwards, Reset game **only on that slug** and revert its JSON. Keep the window short: a real player's row on that slug during the window would be reset too.
3. Set the arcade-test account to `hide_name` before testing. Its rows are publicly visible (as "Anonymous") until they are deleted.
4. Clean up any arcade-test row on robot-collector with **Delete row** plus **Clear cache**, never Reset game.
5. Move robot-collector through `off → optional → required` with config edits only.
6. Skip or adapt checks that assume an empty board or a top-50 place (e.g. "board: shows Anonymous").

Both suites, the legacy §13 suite (rerun in mode `off`) and the token cases, get a `KEY_GATE=0|1` switch, default `0` while `PLAY50_API_KEY` is undefined. With `0`, the missing/wrong-key checks are skipped on every route. On production today "games: no key" and "games: wrong key" return 200, and "submit: no API key" is accepted, writes a real play and spends the 3 s gap, so the next "submit: valid" fails with 429. This is a pre-existing §13 bug; the implementation PR fixes §13 as well. This design authorizes no upload or production probe.

## 7. Frontend lifecycle, offline behavior and retries

Current integration points:

- [GameShell.tsx](../play50games-frontend/src/arcade3d/core/GameShell.tsx) subscribes to store phases, clears the outcome on countdown, and uses `submittedRunRef` to call `submitScore` once at `over`, before the 800 ms result delay.
- [useArcadeStore.ts](../play50games-frontend/src/arcade3d/core/useArcadeStore.ts) increments numeric `runId` on every `beginRun`, including Restart from pause; Resume keeps the same run. Detect a **new run ID**, not only `ready/over → countdown`, or a paused Restart is missed.
- [scores.ts](../play50games-frontend/src/arcade3d/core/scores.ts) saves locally before upload. `saveRunToAccount` avoids a second local play only for runs it saved itself (fix below). [arcade.ts](../play50games-frontend/src/lib/api/arcade.ts) already has `run_token`, the stable error mapping and a mock client.

**Start.** At the countdown of each new `runId`, send one background start when the leaderboard flag is on, a user ID and JWT exist, and the policy is not confirmed `off`. An unknown policy gets one best-effort start; a legacy backend's 404 just means no ticket. Guests, cookie-only sessions, leaderboard-off and confirmed `off` send nothing. Play and countdown never wait for the network, and token failures never pause gameplay. A start is never retried (`{ slug }` has no idempotency key, so a lost response would mint a second ticket), and none is sent on resume, at finish or from "Save to my account". An explicit Retry or Restart is a new run and may start again. A start 401 follows the existing rule (drop the JWT), and the run then finishes without one.

Keep the context in a shell-lifetime ref, keyed by local `runId`, slug and user ID: the pending request, the ticket or failure, and the run's original user ID. Effect resubscription or Strict Mode replay for the same run reuses the pending request instead of minting again. A real unmount discards the context, and a new mount never inherits a ticket. There is no module-global cache: the store resets on Exit, so another shell can reuse the same numeric `runId`. Network abort cannot undo a server insert; abandoned rows expire.

**Accept rule (no timeout constant).** A start response is kept only if, when it resolves, the store still has the same `runId`, the same user is logged in with a JWT, and the phase is `countdown` or `paused` with `pausedFrom: "countdown"`. Anything else is discarded. This is the §2 invariant. It uses the whole countdown, pauses included, which a fixed 2000 ms deadline would cut short on a slow mobile start or on the first CORS preflight to the new route.

**Finish.** At `over`, freeze the final run and its context. The `isRankedRun`/quit checks are unchanged: TIME lose/timeup and every quit never upload. Save ranked runs locally **once**, immediately. Then make exactly **one** upload: with `run_token` if a kept ticket exists, otherwise tokenless, and let the server decide. Tickets never enter `FinishedRun`, localStorage, sessionStorage or analytics.

| Situation at finish | Behavior |
|---|---|
| Kept ticket, JWT present | Upload once with `run_token` |
| No ticket (start failed, late, 404, policy unknown), JWT present | Upload once tokenless; a `required` backend answers `reason: required` → `ranking-unavailable` |
| No JWT (guest, cookie-only, start 401), policy known `required` | `ranking-unavailable`; no Log in and no "Save to my account" for this run |
| No JWT, policy `off`, `optional` or unknown | Today's `login-required` flow |
| `login-required` → log in → "Save to my account", **same** user | One resend with the same ticket, if any; `used` or `expired` → terminal `rejected` |
| Same, but the run began as a **guest** (original user ID null) | Today's merge into the account plus a tokenless upload; a `required` backend → `ranking-unavailable` |
| Same, but a **different** logged-in account | Show the existing result; no merge, no upload |

Add one `SubmitStatus`, `ranking-unavailable`, with its own ResultPanel copy: "Saved on this device. Play again while logged in to rank." The StartScreen in GameShell shows "Log in to rank" when the policy is `required` and there is no JWT. ResultPanel is a Cursor K2 file (handoff below), and Q4 must approve this UX before any game goes to `required`. The other mappings stay: network → `offline`, 500 → `saved-local`, 429 → `rate-limited`, other ticket reasons → `rejected`, API key → `config-error`, and a genuine JWT 401 drops the JWT and offers login. Never send one user's run with another account's JWT.

**No upload retry machinery.** Today a failed upload has no retry, and that stays: offline, 429 and 500 end on the existing "Saved on this device" results. The only resend is the `login-required` → "Save to my account" path above. The client never checks expiry; the server decides. No frozen-body retry, no `retry_after` scheduling, no `/me` reconciliation after a lost success response, and no background queue.

**Local plays fix.** `submitScore` stores its `LocalSave` in `accountSaves` under `${uid}|${slug}|${finishedAt}` whenever `uid` is set, so a same-user `saveRunToAccount` after a submit 401 only resends. Today it merges the run a second time (local plays + 1). GameShell keeps the run's original user ID in its outcome and lets "Save to my account" merge into an account only when that ID was null (a guest run). Vitest pins both cases.

**Mock and tests.** The dev mock only issues a ticket and accepts it once. Token logic is tested in vitest with `vi.mock` of `arcadeApi` or an injected fake client, never against the real backend. Result delay, simulation dt, score normalization and the game's reported duration are unchanged. For the canary, `arcade_game_over` gains one fixed field, `ticket: "ok" | "late" | "failed" | "none"`, with no token or ID.

## 8. Admin and observability

No counters and no stats storage. The canary uses fixed `error_log` lines, written after the decision: `play50 arcade: run_token <reason> <slug>` for each rejection, and `play50 arcade: run_token tokenless <slug>` for each optional-mode tokenless accept. They hold no user IDs, IPs, tokens, JWTs or payloads. Issuance and claims are visible in the runs table itself (`issued_ms`, `used_ms`) within the TTL window. A rejection never creates a score row or a ban. If counters prove necessary later, they are written after the decision, outside any SQL statement, with a harness case that runs without a persistent object cache.

The "Arcade Scores" page gains a small read-only panel: each game's normalized mode and `config_error` (from `play50_arcade_games()`, already allowed) and readiness (the DB version, already in its header, plus whether the runs table exists). That needs one new public helper, `play50_arcade_runs_table()`, called behind `function_exists()` so that either upload order is safe. The admin file is Codex's X3 (`wt-cpt/arcade-scores-admin.php`); arcade-api.md §12 limits its scope and §11 allows four helpers, so the implementation PR updates §11 (fifth helper) and §12 (the panel) and the handoff names the owner. `manage_options`, output escaping and the notice when the API is not loaded stay; no new destructive action is needed.

## 9. Test plan

### PHP harness (pure PHP, no database)

The project's machines have a PHP 8.3 CLI without `mysqli`/`pdo_mysql` and no MySQL, and the backend is tested on production only. The harness is therefore pure PHP: `tools/arcade-php-tests/`, owner Claude, run with the installed CLI. It loads `arcade-api.php` with stubs (`WP_Error`, `WP_REST_Request`/`WP_REST_Response`, `add_action`, `apply_filters`, array-backed options, transients and user meta, the auth helpers) and a scripted fake `$wpdb` that records every statement and returns scripted rows, affected-row counts or `false`. The seams are `play50_arcade_now_ms()` and the global `$wpdb`; production code needs no query wrapper. PHP 7.4-compatible code, synthetic users, no secrets, no site requests.

1. Format: 32 lowercase hex characters accepted; uppercase, 31 or 33 characters, non-hex, null, array or number → `malformed`. The start response is exactly `{ run_token }` with `private, no-store`.
2. API-key/JWT/cookie/deleted-user/ban precedence on both routes. A ticket rejection is `invalid_data` 400, never `unauthorized` or `forbidden`.
3. Modes: missing → `off`; unknown or wrong type → `required` plus `config_error`, with the game still listed and its leaderboard and `/me` still served. `off` + ticket + storage not ready → 200 legacy, with no readiness check and no runs-table query. Optional tokenless → accepted; optional with a bad ticket → rejected; required tokenless → `required`. Start in `off` → 404, nothing inserted.
4. Limits: start 30/60 s per user and 120/600 s per IP, earlier-counter charging, integer `retry_after`; a second start within 3 s → 200; submit limits unchanged. Live-ticket cap: a fourth start deletes only the oldest unused ticket, never a used one.
5. Duration: age + 1000 passes, age + 1001 → `elapsed`; a backward clock → `elapsed`; expiry −1 / exact / +1; min/max and points plausibility; TIME recomputation ignores a forged client score.
6. Claim: the statement log holds no `START TRANSACTION`, `FOR UPDATE`, `COMMIT` or `ROLLBACK`, and the claim runs before the upsert. Affected 1 → upsert; 0 → re-read → `used`/`expired`, no upsert; `false` → `db_error`, no upsert; an upsert failure after the claim → `db_error` with no un-claim statement; a scripted 2006 re-run of the claim (0 rows) → `used`, no upsert.
7. Every rejection reason writes its log line once, after the decision.
8. Expiry holds with cleanup disabled; cleanup deletes only rows with `expires_ms <= now`, at most 1000, at most once per 10 minutes. Deleting a user removes their tickets; a ban blocks start and submit; changed game limits apply at submit without changing a recorded expiry.

A two-connection database tier is not needed: single use rests on one conditional `UPDATE`, which the database serializes. Sequential replay (`used`) is verified on production. A local database tier stays optional (a portable MariaDB or WSL, plus `php -d extension_dir=… -d extension=mysqli`).

### New curl cases in §13 style

Extend the later smoke script with the existing `check NAME STATUS CODE BODY_REGEX ...`, header checks, `gap`, and the `KEY_GATE` switch (§6). Keep the start response in a private local variable and **never** pass it to §13's failure printer, which prints response bodies. Logs show PASS/FAIL and fixed reasons only. Never use `set -x`, and never paste credentials or tickets into chat.

| Named case | Expected status/code or observation |
|---|---|
| Start: no JWT / cookie-only / forged JWT / deleted user | 401 `unauthorized` |
| Start: missing key / wrong key | `KEY_GATE=1` only: 401 `missing_api_key` / 403 `invalid_api_key` |
| Start: bad slug / unknown or disabled game / mode off | 400 `invalid_data` / 404 `not_found` / 404 `not_found` |
| Start: banned account | 403 `forbidden` |
| Start: valid | 200; `private, no-store`; exactly `{ run_token }`, 32 lowercase hex |
| Start: again within 3 s (paused Restart) | 200 |
| Start: a fourth live ticket | 200; the oldest ticket then submits as `unknown` |
| Start: #31 within a minute | 429 `rate_limited`, integer `retry_after` |
| Optional: no ticket | 200 for an otherwise valid submit |
| Required: no ticket / malformed ticket | 400 `invalid_data`, reasons `required` / `malformed` |
| Submit: unknown ticket / another enabled slug / second account's JWT | 400 `invalid_data`, reasons `unknown` / `binding` / `binding` |
| Submit: duration beyond ticket age + 1000 ms | 400 `invalid_data`, `field: duration_ms`, `reason: elapsed` |
| Submit: valid, aged ticket | 200, unchanged success body; `plays` increases exactly once |
| Submit: same ticket after `gap` | 400 `invalid_data`, `reason: used`; no second play |
| Submit: expired ticket (real wait for the TTL) | 400 `expired`, or `unknown` after cleanup |
| TIME game: valid ticket, deliberately wrong client score | 200 with the §7 server-computed score |
| Mode off: ticket sent | 200 legacy; the ticket stays unused |

Parallel same-ticket requests are not a production case: the 3 s submit gap answers the second request with 429 first, and single use is the database's property, pinned in the harness by statement order.

Start→submit fixtures must wait real server age: for §13's `OK_MS=30000`, at least 30 s after the start (waiting the minimum duration alone is not enough). Quicker rejection cases use an otherwise plausible min-duration run, allow for the 1000 ms tolerance, and must not hide `elapsed` behind a bad score. Replays wait 3.2 s first, or the existing gap check wins. Cross-slug and second-account cases need a second enabled test slug and a second test JWT; otherwise leave them to the harness and never widen live scope just to reach them.

Submit's 30 per 10 minutes per IP is the binding budget: at most 20 counted submits per batch, 61 s between user windows, 10 minutes between IP batches, and a request ledger per bucket. The start-limit stress cases need their own window. Minute-limit submit tests need distinct, aged tickets, never one reused ticket. Abandoned tickets simply expire. A real expiry case waits for the TTL; never backdate production rows or weaken public limits. This design task runs **none** of these probes.

### Vitest client cases

- Start: Strict Mode/resubscription deduplication, paused Restart (new run ID) → new start, Resume → no start, Retry, Exit. A remount with the same numeric `runId` never inherits a ticket.
- Accept rule: a response resolving in `countdown` or paused-from-countdown is kept; one resolving in `playing`, after Exit, for another run ID or for another user is dropped.
- Guests, cookie-only, leaderboard-off and confirmed `off` send no start; an unknown policy sends one. Play advances immediately through timeout, offline, 401, 429 and 500.
- One upload per run: with the kept ticket, otherwise tokenless. The policy never suppresses an upload or strips a ticket. A `required` reply → `ranking-unavailable`; no JWT plus `required` → `ranking-unavailable` with no Log in or Save buttons.
- "Save to my account": the same user resends with the same ticket and adds no local play (the `accountSaves` fix); a guest run merges once; a different account neither merges nor uploads; `used`/`expired` there → `rejected`.
- TIME lose/timeup and quit never upload; the upload uses the final simulation duration, not countdown, result delay or wall time.
- Every §5 code/status mapping, no JWT drop for ticket errors, and a genuine 401 drops it. No token in storage or analytics; the analytics `ticket` field takes only its four values.
- The mock issues a ticket and accepts it once.

## 10. Questions for Claude before implementation

1. Approve `DURATION_SLACK_MS` 1000 and `TTL_SLACK_MS` 300000? Longer pauses, uploads or a later login leave the run local-only; an indefinite pause would need a separate server protocol.
2. Confirm 64-bit PHP on the host (`PHP_INT_SIZE === 8`) and DB version `'2'`. No engine question remains: nothing requires InnoDB.
3. Approve the per-game JSON mode with the fail-closed normalization of §2. Which canary thresholds gate optional → required (share of tokenless accepts and of `late` tickets, rejections by reason, over how many days)? Possible extra, not part of this design: a wp-admin per-slug override so a rollback does not wait for a file upload.
4. Approve `ranking-unavailable`, its copy, the StartScreen "Log in to rank" hint, and the ResultPanel owner (Cursor K2 or an explicit Claude takeover). This is required before any game goes to `required`.
5. Approve the start limits (30/60 s per user, 120/10 min per IP) and the three live tickets per user and game.
6. Approve the contract updates: arcade-api.md §3 (field and normalization), §4 (ticket reasons, all 400), §6 (new route, `games` field), §7 (token step), §8 (start limits), §10 (deleted user), §11 (fifth helper), §12 (admin panel and owner), §13 (`KEY_GATE`, post-launch procedure), plus the JSON check in plan §3 "5.4".
7. Decide with §1's table whether to build tokens at all. They deliver replay/plays hygiene and issuance telemetry, not ranking integrity; the "assets + limits" PR is the ranking lever and comes first either way.

## 11. Review decisions

What changed after review, and why:

- **No ranking-integrity claim** (RT-SEC-1). §1 now says what tokens deliver, adds the per-game table of the earliest age at which each game's best score is accepted, and names the "assets + limits" PR (robot-collector `max_score`/`min_duration_ms` derived from the rules) as the real lever, step 0 of the rollout, with Q7 deciding on those numbers. A forged top score costs one start and a short wait with or without tokens.
- **Opaque ticket, no HMAC** (RT-SEC-6). `run_id`, the signature, the key derivation from `wp_salt`, the canonical string and the `signature` reason are gone. Every HMAC input was the server's own row data, so it added no property against an account holder.
- **Claim first, no transaction** (RT-SEC-3, RT-B2). A plain read, one conditional autocommitted `UPDATE`, then the unchanged upsert; a claim is never undone. This removes `FOR UPDATE`, first-submit gap-lock deadlocks, the InnoDB requirement and any `ALTER` of the live scores table, and a 2006 reconnect can now only burn a ticket.
- **Nothing to roll back** (RT-SEC-2, RT-M2). With no transaction and no counters, reasons travel in a PHP variable and every option/transient write autocommits on its own; the canary is fixed log lines.
- **Mode before readiness** (RT-SEC-4). Mode `off` never checks readiness or queries the runs table, so rolling back to `off` restores submits even with broken storage.
- **Typos fail closed without removing the game** (RT-SEC-5, RT-UX-7, RT-B6). Missing → `off`, unknown → `required` plus `config_error`, which the admin shows. Add the `registry.sync.test.ts` enum check and the JSON pre-upload check.
- **No start deadline** (RT-SEC-8, RT-UX-3). The 2000 ms constant is gone. A ticket counts only if it arrived during the same run's countdown, which makes the no-false-`elapsed` invariant structural (§2) and independent of `COUNTDOWN_MS`.
- **Start limits from the play cycle** (RT-UX-4, RT-B3). No start gap; 30/60 s per user, 120/10 min per IP; at most three live tickets per user and game, so an in-flight upload survives a quick Retry.
- **Post-launch test procedure** (RT-UX-1, RT-B4). Tests run on an empty "soon" slug; flags and `enabled` stay unchanged; the test account hides its name; robot-collector cleanup uses Delete row, never Reset game; mode flips are config edits only.
- **`KEY_GATE`** (RT-B5). Key checks are skipped while `PLAY50_API_KEY` is undefined; the pre-existing §13 bug is fixed in the implementation PR's contract update.
- **`ranking-unavailable`** (RT-UX-2). One new `SubmitStatus` with its own copy, no Log in/Save for runs that can never rank, a StartScreen hint, ResultPanel named in the handoff, and Q4 as the gate.
- **One upload per run** (RT-UX-5). The only resend is "Save to my account" for the same user with the same ticket. `used`/`expired` are terminal. The client never checks expiry, the mock only issues and accepts once, and the old Q5 (idempotent receipt) is dropped. All ticket rejections are 400, so no new HTTP statuses enter the contract.
- **No caches to refresh** (RT-UX-6, RT-M1). Rollout steps say "wait 300 s"; `games()` fetches with `cache: "no-cache"`; the policy picks start requests and copy, never whether to upload or attach a ticket; a start 404 means no ticket for that run.
- **No double local play** (RT-UX-8). `submitScore` records its local save in `accountSaves`, and the run's original user ID decides who may merge it.
- **A harness that runs here** (RT-B1). Pure PHP in `tools/arcade-php-tests/` on the installed CLI, with a scripted `$wpdb` (it injects failures, so production needs no query wrapper) and the `play50_arcade_now_ms()` seam; claim-first makes the two-connection database tier unnecessary.
- **Readiness and cleanup hooks** (RT-M3). Readiness is the autoloaded DB version, recorded only after the table is verified; cleanup runs opportunistically in start behind a 10-minute transient, with no WP-Cron.
- **Admin owner and contract** (RT-M4). The handoff names the admin-file owner and §11/§12; the panel shrinks to mode, `config_error` and readiness, behind `function_exists()`.

Implementation handoff after review: under a new scoped prompt, these land together. Claude: `includes/arcade-api.php`, `includes/arcade-games.json`, `docs/arcade-api.md` (§§3, 4, 6, 7, 8, 10, 11, 12, 13) and plan §3 "5.4", `core/GameShell.tsx`, `core/scores.ts`, `core/analytics.ts`, `lib/api/arcade.ts` (+ mock), `registry.sync.test.ts`, `tools/arcade-php-tests/`. ResultPanel (`arcade3d/ui/ResultPanel.tsx`, `.module.css`, `.test.ts`): Cursor K2, or an explicit Claude takeover. `wt-cpt/arcade-scores-admin.php`: Codex X3, or an explicit Claude takeover. The ownership check (`git diff --name-only main...<branch>`) must show only these files. The robot-collector "assets + limits" PR (`meta.ts`, `arcade-games.json`, README "Scoring", `rules.test.ts`) is separate and comes first. `rest-api.php`, classic progress, other game code and package dependencies stay out. This branch changes only this design document.

## 12. Implementation (2026-10-08) and rollout

**What was built** (`claude/run-tokens`): `includes/arcade-api.php` (start route, ticket helpers, submit step 10c, claims table, DB version `'2'`), `lib/api/arcade.ts` (`startRun`, `ArcadeApiError.reason`, `isRunToken`, `createMockArcadeClient`), `core/runTicket.ts` (the §7 start/accept/finish rules), `core/scores.ts` (ticket on the one upload, `ranking-unavailable`, the §7 local-plays fix), `GameShell.tsx`, `analytics.ts` (`ticket` field), `ui/ResultPanel.tsx` (one line of copy, Claude takeover of K2 while Cursor is out), the pure-PHP harness `tools/arcade-php-tests/run.php` (99 checks plus two constant scenarios, mutation-probed) and the `tokens` group of `tools/arcade-api-smoke.sh`. The admin readiness panel (§8) is not built: `GET /arcade/games` → `run_tokens` shows mode and readiness read-only instead, and the admin file stays Codex's.

**Deviations from §§2–5, and why:**

| Design | Built | Why |
|---|---|---|
| Opaque 128-bit value stored at start; no HMAC | `r1.<issued_ms>.<expires_ms>.<nonce>.<sig>`, HMAC-SHA256 over user, slug, both times and the nonce; nothing stored at start; the submit claims the nonce with one `INSERT IGNORE` on its primary key | The implementation brief asked for an HMAC-signed ticket. Start writes nothing (no live-ticket cap, no per-start insert), single use still rests on one autocommitted statement (claim first, never undone, no transaction), and the signed expiry rejects an old ticket whether or not cleanup removed its claim, so a later change of `max_duration_ms` cannot revive one |
| Key: none | `hash_hmac('sha256', 'play50 arcade run token v1', wp_salt('auth'), true)`, or `PLAY50_ARCADE_RUN_TOKEN_SECRET` (32+ chars) from `wp-config.php` | Deterministic per site (no first-use race on an option), never in git, domain-separated from the JWT secret. Rotating salts only fails the tickets in flight |
| Per-game `run_token_mode` (`off/optional/required`) in `arcade-games.json` | One switch: constant `PLAY50_ARCADE_REQUIRE_RUN_TOKEN` (wins) or option `play50_arcade_require_run_token`; off = design `optional`, on = design `required` | As briefed. A switch in `wp-config.php` is a one-line, hand-uploaded change that does not touch the live game list. There is no "off" that ignores tickets; rolling back ticket checks = re-uploading the previous `arcade-api.php` (the client then gets 404 on start and goes tokenless) |
| Reasons `unknown`, `binding` | One reason `signature` (wrong user, wrong game, forged, re-keyed) | A signed ticket cannot tell them apart and needs no lookup |
| Live-ticket cap 3 per user and game | none | Nothing is stored at start; submit limits still bound throughput |
| `GET /arcade/games` per-game mode | top-level `run_tokens: { mode, ready }` | Matches the global switch; also the read-only readiness check |
| Policy fetch, StartScreen "Log in to rank" | not built | The client always tries a start when it could submit; the server decides at submit. `required` → `ranking-unavailable` covers the result screen |

Kept as designed: start/submit order and limits (30/60 s per user, 120/10 min per IP for starts; submit limits unchanged and before the token step), the 1000 ms duration slack, the TTL (`max_duration_ms` + 300 s), every rejection `invalid_data` 400 with a fixed `reason` and log line, claim first with no un-claim, readiness = DB version recorded after `SHOW TABLES`, `off`-like legacy acceptance while the switch is off (a ticket sent to a server whose claims table is not ready is ignored, with a `not-ready` log line), the accept rule (a ticket counts only if it arrives during its own run's countdown), one upload per run, memory-only tickets, and the "Save to my account" rules.

**Rollout** (the user does the server steps; the site stays live throughout; never Reset game):

1. Backup (Plesk: database + theme files).
2. `php -l includes/arcade-api.php` (done on the branch) and upload **only** `wp-content/themes/play50games/includes/arcade-api.php`. No `functions.php`, `wt-cpt/` or JSON change is needed. The first request after the upload runs the versioned install on `init` (creates `{prefix}play50_arcade_runs`, records DB version 2).
3. Read-only check: `GET /wp-json/play50/v1/arcade/games` shows `"run_tokens":{"mode":"optional","ready":true}` (allow up to 300 s for caches; add a `?_=` query to bypass them). `ready:false` means the table could not be created: tickets are then ignored and every submit takes the legacy path; the install retries hourly, and the PHP error log has `play50 arcade: table install failed`.
4. The frontend is already on `main` (Vercel). It works against both servers: before the upload its start requests get 404 and it submits exactly as before; after it, runs carry tickets.
5. Canary while the switch is off: the PHP error log lines `play50 arcade: run_token <reason> <slug>` (rejections) and `run_token tokenless <slug>` (old clients and runs whose start failed). Optionally run `bash tools/arcade-api-smoke.sh --only tokens` with the arcade-test account (it writes one or two plays for that account; delete its rows afterwards, never Reset game).
6. Turn enforcement on only when the tokenless lines have mostly stopped (open old tabs reload over days) and the user accepts that a player whose start failed (offline at the countdown, start rate limit) gets "Saved on this device. This run could not be ranked; play again to rank.": add `define('PLAY50_ARCADE_REQUIRE_RUN_TOKEN', true);` to the server's `wp-config.php` above the "stop editing" line (or set the option `play50_arcade_require_run_token` to `1`). Verify read-only: `GET /arcade/games?_=1` shows `"mode":"required"`. Then the smoke group with `--run-token-mode required`, if wanted.
7. Roll back enforcement by removing the define (or setting it to `false`): applies at the next submit. Roll back tickets entirely by re-uploading the previous `arcade-api.php`; the claims table can stay (the old file never reads it, and its DB version check simply re-runs the v1 install, which leaves both tables in place).
