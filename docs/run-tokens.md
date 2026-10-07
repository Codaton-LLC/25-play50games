# Single-use Arcade run tokens

Design for Phase 5, 2026-10-07, read against main `ad772150d93b071da32fd434d59513cee0bef48e`. **Proposal for Claude's review; no implementation or production change is included.** The current contract remains [arcade-api.md](arcade-api.md), especially §§4–9, §11 and §13. The rollout follows [platform-plan.md](platform-plan.md) §3, including its production safety procedure, and Phase 5.

## 1. Goal, threat model and limits

Require a server-issued, user-bound, game-bound ticket before a ranked submission. In `required` mode it provides these guarantees:

- A copied ticket cannot increment `plays` or apply a score twice, including simultaneous requests.
- A caller cannot forge a ticket, change its user/game/issuance time, or submit without a recorded issuance. Existing JWT authentication still rejects forged JWTs; HMAC is an additional check.
- The reported simulation duration cannot exceed the time since server issuance beyond a small tolerance, and must still satisfy the existing minimum/maximum duration and points plausibility checks.
- Issuance limits add another bounded step to scripted mass submissions. Separate submit limits continue to apply to rejected and accepted attempts.

This is **not gameplay attestation**. A modified client can request a valid ticket, wait, invent a plausible score and duration, then submit once. Tokens do not establish that inputs, collisions, a TIME game's win, or the reported duration were genuine. In particular, the elapsed-time inequality rejects excessively **long** claimed durations; it cannot reject an artificially **short** duration after enough real time has passed. An automated client can collect tickets and use them within the issuance/submit limits, including parallel runs. Distributed accounts/IPs and compromised JWTs remain outside this guarantee. The browser API key is not an anti-cheat secret.

`optional` mode allows tokenless submissions and therefore cannot provide these guarantees across the entire leaderboard. Neither mode retroactively verifies old scores. Guests continue playing and keeping local bests without a server ticket.

## 2. Proposed policy and identifiers

Use one per-game field, `run_token_mode`, in `includes/arcade-games.json`: `off | optional | required`. Missing field means `off`. Do not add a second global override or a new frontend environment flag. An explicit unknown value is a configuration error: log it, flag it in admin, and skip that game rather than silently weakening enforcement.

Expose the normalized field through `GET /arcade/games`; preserve its `{ games: { ... } }` shape and existing cache headers. This extends the contract, not `meta.scoring` or the limits. The client reads policy while the start screen is loading, without blocking Play. Missing field from an older backend means `off`; failure to fetch policy means **unknown**, not confirmed `off`.

| Proposed constant | Value | Purpose |
|---|---|---|
| `DURATION_SLACK_MS` | 1000 | Server clock/rounding tolerance in the elapsed-duration check |
| `TTL_SLACK_MS` | 300000 | Five minutes for countdown, pause, network delay and submission retry |
| Start request timeout | 2000 ms | Bound the background request; never delay gameplay |
| Token TTL | issued game's `max_duration_ms + TTL_SLACK_MS` | Absolute wall-clock lifetime, never sliding |

These are two different slacks. A five-minute expiry allowance must **not** let a client claim five minutes of play immediately after issuance. Countdown and pauses increase wall time but not `state.elapsedMs`; the comparison remains one-sided. A pause/offline period longer than the remaining TTL leaves the run local-only. Do not extend or replace a ticket for an already-started run.

`run_id` is a server-generated 128-bit random value encoded as exactly 32 lowercase hex characters, from PHP [random_bytes(16)](https://www.php.net/manual/en/function.random-bytes.php). It is unrelated to the store's numeric `runId`, which identifies React/store runs. All issuance times are taken from the server, never from a request or the client's clock.

Store timestamps as integer Unix milliseconds using a 64-bit PHP runtime. Return `issued_at` and `expires_at` as UTC ISO 8601 strings with exactly three fractional digits, for example `2026-10-07T12:00:00.000Z`. This retains §1's UTC datetime convention while specifying millisecond precision. The formatter must be deterministic; timezone settings must not change the signed string.

## 3. Start endpoint and signature

Register `POST /play50/v1/arcade/runs/start` (REST namespace `play50/v1`, route `/arcade/runs/start`). Reuse `play50_arcade_auth_user` as `permission_callback`: the current API-key helper, Bearer JWT, and existing user. Cookies alone remain 401. Preserve the current API-key behavior when `PLAY50_API_KEY` is undefined; hardening that gate is a separate deployment decision.

Request:

```json
{ "slug": "robot-collector" }
```

Successful response is HTTP 200, with precisely these fields in order:

```json
{
  "run_id": "7c9e5b30f0124ca3b6df90a12f348bd7",
  "token": "0000000000000000000000000000000000000000000000000000000000000000",
  "issued_at": "2026-10-07T12:00:00.000Z",
  "expires_at": "2026-10-07T12:06:15.000Z"
}
```

The all-zero token is an illustrative format value, not a valid signature. Robot Collector's 75000 ms maximum plus 300000 ms TTL slack explains the example expiry. Return `Cache-Control: private, no-store`; never put the ticket in a URL, shared cache, analytics event or error message.

Derive a 32-byte signing key at runtime as the binary SHA-256 digest of `wp_salt('auth')` concatenated with `|play50-arcade-runs-v1`. This follows the salt-derived JWT fallback in `functions.php`, with a separate domain label; never reuse `JWT_AUTH_SECRET_KEY` or its old leaked value. The label is public, the salt is private. No new key file or hard-coded secret is needed. Missing salt/crypto support fails with `db_error` 500; never use an empty/literal fallback key.

Canonical HMAC input is exactly `user_id|slug|run_id|issued_at`: positive user ID in decimal without leading zeroes; the validated lowercase slug; the 32-character hex ID; and the server's canonical ISO string. No whitespace or terminal newline. These fields cannot contain `|`. `token` is the lowercase 64-character hex result of HMAC-SHA256. Verify with PHP [hash_equals(expected, supplied)](https://www.php.net/manual/en/function.hash-equals.php) after length/format checks, keeping the supplied value second. Client claims are never used to reconstruct issuance or expiry: look those up by `run_id`.

Salt rotation invalidates outstanding tickets. The domain label versions the signing scheme; a future scheme requires an explicit migration. Expiry is authoritative database state even though it is not a component of the required HMAC input.

### Start validation and rate limits

Order: API key → JWT/existing user → ban (`play50_arcade_banned`) → slug format → known/enabled game → issuance limits → mode → storage readiness → generate and persist ticket → response. Mode `off` returns `not_found` 404 and issues nothing. A failed insert returns `db_error` 500 and never returns a usable ticket. Reject extra client identity/timestamp claims as authority; only `slug` is used.

Use `play50_arcade_hit` and `play50_arcade_ip_hash`, with separate start counters so starting and finishing one run do not spend two entries from today's submit budget:

| Check order | Proposed transient | Limit/window |
|---|---|---|
| 1 | `p50a_start_gap_{uid}_{slug}` | 1 / 3 s |
| 2 | `p50a_rl_start_u_{uid}` | 10 / 60 s |
| 3 | `p50a_rl_start_ip_{ip_hash}` | 30 / 600 s |

Keep submit keys and numbers from §8 unchanged (`p50a_gap_*`, `p50a_rl_u_*`, `p50a_rl_ip_*`), plus registration and privacy limits. Earlier checks count when a later check fails; a rejected limit check does not increment its own counter. Invalid/missing slug and auth failures follow today's early-return behavior. IPs come from `REMOTE_ADDR` plus the existing trusted-proxy filter; never trust arbitrary `X-Forwarded-For`.

The existing transient limiter permits a small concurrency overshoot. That remains an explicitly accepted throughput limit, **not** the mechanism enforcing single use. Tokens do not introduce a hard global bot-rate guarantee.

## 4. Storage, atomic consumption and expiry

Choose a small durable table, proposed name `{$wpdb->prefix}play50_arcade_runs`, rather than a transient per ticket. WordPress [transients can disappear before their advertised expiration](https://developer.wordpress.org/apis/transients/); a `get_transient` followed by `delete_transient` also does not serialize two consumers. Cached tickets would reject legitimate runs after eviction, and independent readers could both accept the same ticket.

| Proposed column | Type/meaning |
|---|---|
| `run_id` | `CHAR(32)`, ASCII/binary comparison, primary key |
| `user_id` | Unsigned bigint, authenticated owner |
| `game_slug` | `VARCHAR(40)`, validated slug |
| `issued_ms` | Unsigned bigint, immutable server issuance |
| `expires_ms` | Unsigned bigint, immutable absolute expiry |
| `used_ms` | Nullable unsigned bigint; null until accepted |

Indexes: primary key `run_id`, expiry index `expires_ms`, and `(user_id, game_slug)` for account cleanup. Do not store the raw token/JWT/IP. A failed random-ID collision may generate another ID once; other insert failures are generic DB errors.

Install through the existing `dbDelta`/versioned `init` path, bumping `PLAY50_ARCADE_DB_VERSION` and checking both tables exist before recording the new version. The new table and existing scores table must both use **InnoDB**. The existing schema does not declare its engine, so Claude must inspect it and arrange any conversion under backup before enabling tokens. Readiness failure blocks issuance and token-bearing submissions with `db_error`; it must not silently fall back to an unsafe consume sequence. Modes `off` and optional tokenless submits retain their legacy path.

After ordinary score validation, process a token-bearing submission in one transaction:

1. Start the transaction, select the ticket row by primary key with `FOR UPDATE`, and wait for its lock. Use `$wpdb->prepare` for every value; table identifiers come only from server helpers.
2. Verify existence, user/slug binding and HMAC from immutable row fields. Sample server `now_ms` **after acquiring the lock**, so lock wait cannot bypass expiry.
3. A backward server clock (`now_ms < issued_ms`) fails closed as `db_error`, without consuming the ticket. Then reject expiry at `now_ms >= expires_ms`, reject non-null `used_ms`, and check elapsed duration.
4. Read/lock the relevant score row and perform §9's existing upsert. Preserve assignment order, hidden/name behavior, points limits and TIME score recomputation. Read back the response and rank while the transaction can still roll back.
5. Set `used_ms` once, then commit **both** the ticket consumption and score update. An UPDATE must affect exactly one unused row. A duplicate consumer gets the updated locked row and cannot upsert again.
6. Clear the slug leaderboard cache after a committed new best and return the unchanged §6.2 response.

Any SQL/deadlock/rank failure before commit rolls back both changes and returns `db_error` 500. Transaction setup and commit failures are checked too. An ambiguous lost connection at commit has an unknown client outcome; never issue a replacement ticket to retry the score. This depends on [InnoDB locking reads inside a transaction](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html), not PHP process-local state or the submit gap limiter.

An expired ticket never authorizes a submit, even if cleanup has not run. Keep used rows until original expiry so a live replay is identifiable; purge rows with `expires_ms <= now_ms` through an hourly WP-Cron job, in indexed batches of at most 1000. Missing traffic may delay physical cleanup but cannot extend validity. Extend `deleted_user` cleanup to remove that user's tickets. Admin score reset/cache clear does not resurrect or un-use tickets. A ban is rechecked on both endpoints; an already issued ticket cannot submit while banned.

## 5. Submit contract and exact errors

Extend `ArcadeSubmitBody` with optional `run_id: string`; `run_token` already exists but is currently ignored. A token-bearing submit sends both, alongside the unchanged score fields: the start response's `token` becomes `run_token`, and its `run_id` is copied unchanged. Do not accept `issued_at`, `expires_at`, a user ID or a claimed mode as authority.

Preserve §7 steps 1–10: auth, ban, slug, enabled game, **existing submit limits before duration/score validation**, and current scoring. Insert token policy/verification before the score mutation. Rejected token attempts therefore spend the submit budget and never increment `plays`. Normal duration validation still rejects values below `min_duration_ms` or above `max_duration_ms`.

For a verified unused ticket additionally require:

`duration_ms <= now_ms - issued_ms + DURATION_SLACK_MS`

No lower bound equating duration to wall time: countdown, pause, hidden-tab throttling and upload delays are legitimate. No client clock appears in this inequality. TIME games still use the server's duration-to-score formula; their `end('win')` restriction remains a frontend rule, not something this signature proves.

Use existing WP error names so an older client's `mapErrorCode` works without a new enum. Distinguish token failures using fixed `data.reason` values; do **not** return `unauthorized` for a run-ticket error or `forbidden` for a signature error, because those respectively clear the JWT or report a ban.

| Failure | WP_Error code / HTTP | Extra data | Existing client code → status |
|---|---|---|---|
| Missing API key / wrong API key | `missing_api_key` / 401; `invalid_api_key` / 403 | Existing contract | `api_key` → `config-error` |
| Missing/invalid/expired JWT, cookie-only, deleted user | `unauthorized` / 401 | Existing contract | `unauthorized` → `login-required` |
| Banned user, start or submit | `forbidden` / 403 | Existing contract | `banned` → `banned` |
| Missing/invalid slug | `invalid_data` / 400 | `field: slug` | `invalid_data` → `rejected` |
| Unknown/disabled game; start while mode off | `not_found` / 404 | None | `not_found` → `rejected` |
| Start/submit rate limit | `rate_limited` / 429 | Integer `retry_after` in seconds | `rate_limited` → `rate-limited` |
| Duration/score type, min/max or points plausibility failure | `invalid_data` / 400 | Existing `field` | `invalid_data` → `rejected` |
| Required mode, both ticket fields absent | `invalid_data` / 400 | `field: run_token`, `reason: required` | `invalid_data` → `rejected` |
| Only one field present; null/empty/non-string/wrong format | `invalid_data` / 400 | Missing/bad `field: run_id` or `run_token`, `reason: malformed` | `invalid_data` → `rejected` |
| No row for syntactically valid ID (including a purged ticket) | `invalid_data` / 400 | `field: run_id`, `reason: unknown` | `invalid_data` → `rejected` |
| Different authenticated user or submit slug | `invalid_data` / 400 | `field: run_token`, `reason: binding` | `invalid_data` → `rejected` |
| HMAC mismatch, including salt rotation | `invalid_data` / 400 | `field: run_token`, `reason: signature` | `invalid_data` → `rejected` |
| Expired row, `now_ms >= expires_ms` | `invalid_data` / 410 | `field: run_token`, `reason: expired` | `invalid_data` → `rejected` |
| Already used before expiry | `invalid_data` / 409 | `field: run_token`, `reason: used` | `invalid_data` → `rejected` |
| Duration exceeds server elapsed time plus 1000 ms | `invalid_data` / 400 | `field: duration_ms`, `reason: elapsed` | `invalid_data` → `rejected` |
| Missing storage/crypto, SQL/transaction failure, backward clock | `db_error` / 500 | No sensitive detail | `server` → `saved-local` |
| WP core malformed JSON | `rest_invalid_json` / 400 | WP core behavior | `server` → `saved-local` |

Within ticket verification precedence is lookup → binding → HMAC → clock sanity → expiry → used → elapsed check. Format/policy precede lookup. Ordinary auth/rate/duration/score failures retain their earlier precedence. Token messages are fixed, e.g. “This run could not be verified. Play again to rank.” SQL stays in server logs; redact credentials and submitted payloads there too. The proposed 409/410 uses of `invalid_data` and its new fields must be documented in §4 before deployment. `mapErrorCode` already chooses that name before considering HTTP status; no JWT is dropped for these errors.

## 6. Rollout and backward compatibility

| Mode at submit | Old client, no ticket | New client, no ticket | Ticket fields supplied |
|---|---|---|---|
| `off` | Legacy acceptance and limits | Same | Ignore both, as today's reserved field is ignored; no consumption |
| `optional` | Legacy acceptance and limits | Allowed fallback | Require the full valid unused pair; invalid/expired/used tickets reject |
| `required` | Reject `reason: required`; game still playable | Save locally; ranking requires a ticket | Require the full valid unused pair |

In optional mode, a partially supplied pair is **not** a tokenless request. Never strip a rejected ticket and retry without it; that would turn signature/replay failures into a downgrade path. Optional mode is migration compatibility, not enforceable anti-cheat.

Proposed sequence:

1. Claude updates the API contract and implementation, installs/checks storage under backup, lints both PHP files, and deploys all games with mode omitted/`off`. Keep existing `enabled` and frontend flags independent.
2. Deploy the compatible frontend: start requests, policy reading, memory-only tickets, stable result/retry handling, and mock parity. No game-owned Scene needs token code.
3. Set only `robot-collector` to `optional`, bump the config's informational version, refresh `/arcade/games` caches, and run the dedicated test-user cases from §9. Monitor starts, failures and tokenless submissions.
4. Before `required`, announce that older/open clients must reload; wait at least the game's maximum duration + TTL slack + the 300 s public policy-cache lifetime after the compatible frontend is deployed. This grace reduces in-flight failures but cannot force an indefinitely open old tab to upgrade.
5. Switch that game to `required`, invalidate public policy caches, monitor rejection reasons and local-only reports, then repeat game by game. Backend policy at submit is authoritative even when the frontend cache is stale.
6. Roll back enforcement immediately by setting the game to `off` (or `optional` for tokenless compatibility), refreshing policy caches, and leaving the table intact. Do not delete data or rotate salts as the rollback mechanism. Existing leaderboard scores stay intact.

The current §13 legacy suite requires mode `off`. Its tokenless valid-submit and per-minute cases would correctly reject in `required`; it needs the token-aware fixtures described below. This design does not authorize any upload or production probe.

## 7. Frontend lifecycle, offline behavior and retries

Current integration points:

- [GameShell.tsx](../play50games-frontend/src/arcade3d/core/GameShell.tsx) subscribes to store phases, clears the outcome on countdown, and uses `submittedRunRef` to call `submitScore` once at `over`, before the 800 ms result overlay delay.
- [useArcadeStore.ts](../play50games-frontend/src/arcade3d/core/useArcadeStore.ts) increments numeric `runId` on every `beginRun`, including Restart from pause. Resume restores the same run. Detect a **new run ID**, not only `ready/over → countdown`, or paused Restart is missed.
- [scores.ts](../play50games-frontend/src/arcade3d/core/scores.ts) saves locally before upload; `saveRunToAccount` avoids a second local play on retry. [arcade.ts](../play50games-frontend/src/lib/api/arcade.ts) already has `run_token`, the stable error mapping, and a mock client.

At countdown start, issue exactly one background start request for that numeric run ID when leaderboard is enabled, a user ID and JWT exist, and policy is optional/required. For unknown policy, make one best-effort start request; a legacy backend's 404 leaves the legacy submit path available. Confirmed `off`, guest, cookie-only and leaderboard-off flows make no request. Play/countdown never awaits the network, and token failures never pause gameplay.

Keep a memory-only context in a shell-lifetime ref, keyed within that shell by local `runId`, slug and user ID: pending request, original start deadline, ticket or failure, policy, and original account binding. Effect resubscription/Strict Mode replay for the same run reuses the pending request instead of minting again. Do not use a module-global cache keyed only by numeric `runId`: the store resets on Exit, so another shell can reuse that number. A real unmount discards its context; a new mount must never inherit that ticket. Initialize from an already-counting-down store when resubscribing within the same shell; discard token use if attaching only after playing has begun. The 2000 ms timeout is anchored to original countdown start, not restarted by an effect. Abort/ignore late responses on timeout, account change, Restart or Exit. Network abort cannot undo a server insert; abandoned rows expire normally.

Only tickets resolved for the correct run/account before that deadline can be used. There is no automatic start retry: `{ slug }` has no idempotency identifier, so a lost response could otherwise mint a second, later ticket. An explicit game Retry/Restart creates a fresh local run and may request a fresh ticket, subject to issuance limits. Do not request a new ticket on resume, at finish, or from “Save to my account”.

At `over`, freeze the final run and its matching context. Keep the current `isRankedRun`/quit checks: TIME `lose/timeup` and all `quit` runs never upload. Save ranked runs locally **once**, immediately, irrespective of ticket success. Hand an optional ticket context separately to `submitScore`/`saveRunToAccount`, without putting secrets into `FinishedRun`, localStorage, sessionStorage or analytics.

| Situation at finish | Behavior |
|---|---|
| Matching usable ticket | Submit original score/duration with `run_id` and `run_token` |
| Start failed/timed out/offline, confirmed optional | Submit once without either field; normal upload errors/statuses apply |
| Start failed, confirmed required | Keep saved result local-only; no tokenless upload; show a fixed ranking-unavailable explanation |
| Policy unknown/stale | A single tokenless legacy attempt is allowed when no ticket exists; a required backend returns `invalid_data`. Keep local result and do not retry by minting |
| Ticket exists but is expired or known rejected | Local-only; do not remove it to exploit optional fallback |
| Account changed/logged out since issuance | Never attach old user's ticket to the new identity; keep original result association/local best isolated |

Network failure maps to `offline`; DB failure to `saved-local`; 429 to `rate-limited`; ticket rejection to `rejected`; API-key failure to `config-error`. Genuine JWT 401 still clears the JWT and offers login. Preserve `data.reason`/`retry_after` as safe error details if needed for result text and retry scheduling, without expanding the existing code/status enums. Do not send another user's score using a freshly switched account's JWT.

No background infinite retry queue. After a network/500/429 upload failure, allow one explicit result-screen retry of the **same frozen body and same ticket**, before expiry. Honor `retry_after`; after an ambiguous network/500 failure wait at least 3.2 s for the submit gap. Never call local merge again, reissue, refresh the ticket, or strip its fields. A deterministic 400/409/410 rejection is terminal. If the first response was lost after commit, the retry may return `used`; sync `/arcade/me`/leaderboard to reconcile and never increment server `plays` again. Do not claim that a `used` response alone proves this particular payload succeeded.

Guest gameplay, local bests and no-request behavior stay unchanged. Guest login at the result can still save into the account locally once. In optional/off mode it may also upload without a ticket. **Required mode cannot rank a run begun as a guest**, nor a run started before login: no user-bound issuance exists, and retroactive minting is forbidden. Explain “Play again while logged in to rank.” This is a necessary change to post-login ranking eligibility, not guest play; Claude must approve its UX before required rollout. Already-issued tickets may be retried after renewing a JWT for the same user if still valid.

The mock client must mirror policy, issuance, elapsed checks, expiry and single-use consumption with a deterministic test clock. Never use real backend traffic to test frontend token behavior. Result delay, simulation dt, score normalization and the game's reported duration remain unchanged.

## 8. Admin and observability

Extend “Arcade Scores” during the later implementation to show the selected game's mode, storage/engine readiness, issued tickets, token-bearing accepted submits, optional tokenless accepts, and rejected-token counts for today/last seven UTC days, grouped by the fixed reasons in §5. Show all-game totals too. Rate limits and DB failures are separate operational counts; rejection must not create a score row or a user ban automatically.

Proposed aggregate storage: one `p50a_rtstats_YYYYMMDD_{slug}` transient per game/day, holding bounded integer counters and a fixed rejection-reason map; TTL eight days. No user IDs, raw IPs, tokens, run IDs, JWTs or payloads. Counts are best-effort: transient eviction/concurrent increments may lose counts, so label them approximate and never use them for enforcement. Counter/log failure must not change the submit decision. Fixed-reason redacted server logs supplement counters; do not print request bodies or database parameters containing credentials.

§11 currently allows the admin only four Arcade helpers. Propose a fifth read-only public helper, `play50_arcade_run_token_stats($slug = null)`, returning these aggregates/readiness. Claude must explicitly update §11 in the implementation PR before the admin calls it. Retain `manage_options`, output escaping, guarded helpers and notices when storage is absent; no new destructive admin action is needed.

The hourly cleanup removes only expired ticket rows. Counter transients expire on their own; no permanent event/audit table is proposed. Retain an expiry backlog/oldest-expired-age diagnostic for storage maintenance. Physical cleanup is never the authorization check, and cache clear/reset never removes a live-used marker.

## 9. Test plan

### PHP harness and local database cases

Use synthetic users/salts, an injectable server clock and controlled limiter state. PHP 7.4-compatible implementation, lint with installed PHP 8.3. No actual secrets/site requests in the harness.

1. Pin a known HMAC vector for exact canonical formatting. Change user, slug, run ID or issuance by one character; every changed signature fails. IDs have 32 hex characters and tokens 64. Locale/timezone cannot change issuance formatting. Unknown/null/array/overlong fields fail.
2. Pin API-key/JWT/cookie/deleted-user/ban precedence on both routes. Authenticated invalid token returns `invalid_data`, preserves JWT client-side and never becomes `forbidden`.
3. Test missing/off/optional/required/invalid mode, start returning 404 off, and all combinations of omitted/one/null/empty/two fields at submit. Optional with a supplied invalid ticket must reject; tokenless optional must accept.
4. Pin start and submit counters independently: three-second gap, 10/min/user, 30/10min/IP, fixed-window reset, retry-after and earlier-counter charging. Explicitly retain the existing documented transient race limitation.
5. Pin duration at min/max, server age + 1000 exactly and +1001, issuance in the future, expiry −1/exact/+1, fractional/negative/bool duration, and points plausibility. TIME recomputation ignores a forged client score as before.
6. Use two actual database connections to simultaneously submit one valid token with limiter interference removed in the harness: one accepted upsert/`plays +1`, one `used` rejection, including distinct competing payloads. An in-memory PHP mock cannot prove this property. Test separate tickets for the same score row too; deadlock rollback must preserve unused tickets.
7. Inject failures at token lookup, previous-score read, upsert, read-back, rank, used update and commit. Pre-commit failures roll back score and ticket; commit ambiguity never results in a replacement-ticket retry. Non-InnoDB/unavailable storage fails readiness, including crash/restart between writes.
8. Expiry is enforced with cleanup disabled; hourly batches never delete live rows or restore used ones. Deletion removes account tickets; ban blocks issuance/use; unban does not renew expiry; salt rotation invalidates old HMACs. Changing game limits applies current submit limits without extending a recorded expiry.
9. Response field order, UTC types, `private, no-store`, redacted errors/logs, unchanged score payload/rank/cache behavior, approximate counter eviction and admin capability/absence notices.

### New curl cases in §13 style

Extend the later smoke script with the existing `check NAME STATUS CODE BODY_REGEX ...`, header checks and `gap` conventions. Keep the token-capturing start request's response in a private local variable/file; **do not** feed it into §13's failure printer, which prints response bodies. Logs show PASS/FAIL and fixed reason/status only. Never use `set -x` or paste credentials/tickets into chat.

| Named case | Expected status/code or observation |
|---|---|
| Start: no JWT / cookie-only / forged JWT / deleted user | 401 `unauthorized` |
| Start: missing key / wrong key | 401 `missing_api_key` / 403 `invalid_api_key`, only when key gate is configured |
| Start: bad slug / unknown/disabled game / off mode | 400 `invalid_data` / 404 `not_found` / 404 `not_found` |
| Start: banned account | 403 `forbidden` |
| Start: valid optional/required | 200; private/no-store; exact four fields, valid formats, expected TTL |
| Start: immediate repeat; minute #11; IP #31 | 429 `rate_limited`, integer retry-after; isolate windows as below |
| Optional: no pair | 200 for an otherwise valid legacy submit |
| Required: no pair; one field; wrong token format | 400 `invalid_data`, reasons `required`/`malformed` |
| Submit: unknown ID; changed HMAC; second JWT owner; different enabled slug | 400 `invalid_data`, reasons `unknown`/`signature`/`binding`/`binding` |
| Submit: duration beyond token age + tolerance | 400 `invalid_data`, `field: duration_ms`, `reason: elapsed` |
| Submit: valid earned-age ticket | 200 unchanged success body; `plays` increases exactly once |
| Submit: same ticket after `gap` | 409 `invalid_data`, `reason: used`; no second play |
| Submit: known expired row | 410 `invalid_data`, `reason: expired`; after cleanup may be 400 `unknown` |
| TIME game: valid ticket, deliberately wrong client score | 200 with §7 server-computed score; wait for claimed duration age |
| Parallel same-ticket requests | At most one accepted update; other may hit existing 429 before the 409 check. Exact atomicity is pinned by the two-connection harness |

Start→submit fixtures must wait enough **actual server age**: for §13's `OK_MS=30000`, wait at least 30 s after obtaining the ticket (waiting min duration alone is insufficient). For quicker rejection cases use an otherwise plausible min-duration run, account for the 1000 ms tolerance, and do not hide the elapsed error behind a bad score. Replays wait 3.2 s first or the existing gap check wins. Cross-slug/owner cases need an enabled second game and separate test JWT; otherwise use the harness and do not change live rollout scope just to reach them.

Run the legacy suite in mode off, then small independent token batches. Start and submit each have a 30/10min IP budget; neither suite can run all matrix rows and rate stress in one window. Keep a request ledger per bucket, at most 20 normal counted requests per batch, fresh user windows (61 s) and ten-minute IP resets between batches. The 31st-IP stress batch needs its own authorized window and multiple dedicated users to avoid the user/gap limit masking it. Minute start tests can abandon tickets; minute submit tests need distinct tickets aged beforehand, never one reused ticket.

Run expiry/salt-rotation/clock/concurrency fault cases in the harness first; a real expiry case must actually wait for TTL, not backdate production DB rows or weaken public limits. Any later authorized production test follows backup → both PHP lints → frontend flags off/only test game enabled → dedicated arcade-test → tests → score reset/cache clear. Abandoned tickets expire; wait out their TTL before reusing a production test setup. This design task runs **none** of these probes.

### Vitest client cases

- Strict Mode/effect-resubscription deduplication, initial countdown attachment, paused Restart/new run ID, resume reuse, Retry, Exit and out-of-order response handling. An actual Exit/remount with the same numeric `runId` cannot inherit an old ticket; a stale response cannot overwrite the new run/account.
- Guests/cookie-only/leaderboard-off/known-off issue no start request; unknown policy makes one best-effort call. Play/countdown advances immediately through timeout, offline, 401, 429 and 500.
- Correct policy discovery and missing-field compatibility; stale off/optional policy versus required backend yields a local saved/rejected result, never reissuance or JWT deletion.
- Matching context attaches exactly both fields. Account switch/logout prevents cross-account send. Expired/rejected tickets never become tokenless optional retries.
- Local merge occurs once at end, regardless of pending issuance/upload; explicit upload retry and `saveRunToAccount` do not increment local plays again. Same-user renewed JWT may retry the original ticket before expiry.
- TIME lose/timeup and quit issue no submit; end uses final simulation duration, not countdown, result-delay or wall time. A consumed ticket in the mock cannot submit twice.
- Pin every §5 error code/status mapping (including `invalid_data` at 409/410), reason/retry-after preservation, no JWT drop for ticket errors, and actual JWT 401 behavior.
- Required guest-to-account result remains local-only; optional guest save uses the old tokenless path. No retroactive start, token persistence or credential-bearing analytics.
- Mock tests with fake server time for elapsed/expiry/races; frozen-body retry after an ambiguous response, `used` reconciliation, retry-after/expiry boundaries and one explicit retry maximum.

## 10. Questions for Claude before implementation

1. Approve separate 1000 ms duration tolerance and five-minute TTL slack? Longer pauses/uploads will remain playable but local-only after expiry; supporting indefinite pause requires a separate server protocol.
2. Confirm InnoDB for the current score table and 64-bit PHP on the host. Who performs any engine conversion under backup, and which DB version will this install use?
3. Approve per-game `run_token_mode` in the JSON and its public normalized field, rather than a global WP option. What rejection/tokenless-use thresholds and compatibility window gate optional→required?
4. Approve required-mode guest/post-login ranking restriction and the result text. “Guest flow unchanged” can preserve play/local saves, but cannot preserve ranking of an unticketed historical run without an explicit bypass that defeats required mode.
5. Accept strict single-use 409 plus `/me` reconciliation after a lost success response? Returning a stored idempotent success receipt is an alternative, but adds payload binding/storage and changes the proposed replay response; do not implement both accidentally.
6. Approve existing `invalid_data` with fixed reasons and new 409/410 statuses, the fifth admin helper/approximate counters, and redacted curl diagnostics. These require an explicit §4/§11/§13 contract update by Claude.
7. Confirm the desired threat boundary: this design adds issuance, replay protection and elapsed upper bounds, not proof of a real TIME win or human play. If the goal is authoritative scores, tickets alone cannot meet it.

Implementation handoff after review: Claude-owned backend/config/contract, core GameShell/scores and API/mock changes must land together under a new scoped prompt; this branch changes only this design document. Existing `rest-api.php`, classic progress, game logic and package dependencies are outside that work.
