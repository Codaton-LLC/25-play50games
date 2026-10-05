# 3D Arcade API contract (`play50/v1/arcade/*`)

The source of truth for:
- `play50games-backend/play50games/includes/arcade-api.php` (Claude);
- `play50games-backend/play50games/wt-cpt/arcade-scores-admin.php` (Codex);
- `play50games-frontend/src/lib/api/arcade.ts` (Claude; its types mirror §6).

Plan context: `docs/platform-plan.md` §3. If this file and the plan differ, this file wins. Change it only in a Claude PR that also updates `arcade.ts`.

---

## 1. Ground rules

| Rule | Detail |
|---|---|
| Namespace | `play50/v1`, routes under `/arcade/` |
| Wire format | JSON, **snake_case**, integers as JSON numbers (cast `$wpdb` strings with `(int)`) |
| Datetimes | Stored as UTC `DATETIME` (`gmdate('Y-m-d H:i:s')`), returned as ISO 8601 UTC: `2026-10-05T12:34:56Z` |
| Higher is better | Always. Time games turn a duration into a score (§7) |
| Who is on the leaderboard | Logged-in users only. Guests keep scores in `localStorage`, no guest endpoints |
| Auth for writes | `Authorization: Bearer <JWT>` only. Cookies are ignored (§5) |
| Files never edited | `includes/rest-api.php`. `functions.php` only gets guarded `require_once` lines (Claude) |
| Prefixes | PHP functions `play50_arcade_*`, admin functions `play50_arcade_admin_*`, transients `p50a_*` |
| Kill switch | `enabled:false` in `arcade-games.json`: that game's submit and leaderboard return 404 |
| Reserved | `POST /arcade/runs/start` (Phase 5 run tokens). Until then `run_token` is accepted and ignored |

Load order in `functions.php`, after the `rest-api.php` include:
```php
foreach (array('/includes/arcade-api.php', '/wt-cpt/arcade-scores-admin.php') as $play50_arcade_file) {
    if (file_exists(get_stylesheet_directory() . $play50_arcade_file)) {
        require_once get_stylesheet_directory() . $play50_arcade_file;
    }
}
```

---

## 2. Table

`{$wpdb->prefix}play50_arcade_scores`: one row per (user, game).

```php
define('PLAY50_ARCADE_DB_VERSION', '1');

function play50_arcade_table() {
    global $wpdb;
    return $wpdb->prefix . 'play50_arcade_scores';
}

function play50_arcade_install() {
    global $wpdb;
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    $table = play50_arcade_table();
    $charset_collate = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE {$table} (
  id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  user_id bigint(20) unsigned NOT NULL,
  game_slug varchar(40) NOT NULL,
  best_score int(10) unsigned NOT NULL DEFAULT 0,
  best_duration_ms int(10) unsigned DEFAULT NULL,
  last_score int(10) unsigned NOT NULL DEFAULT 0,
  plays int(10) unsigned NOT NULL DEFAULT 0,
  hidden tinyint(1) NOT NULL DEFAULT 0,
  best_at datetime NOT NULL,
  last_played datetime NOT NULL,
  PRIMARY KEY  (id),
  UNIQUE KEY user_game (user_id,game_slug),
  KEY board (game_slug,hidden,best_score,best_at)
) {$charset_collate};";
    dbDelta($sql);

    if ($wpdb->get_var($wpdb->prepare('SHOW TABLES LIKE %s', $wpdb->esc_like($table))) === $table) {
        update_option('play50_arcade_db_version', PLAY50_ARCADE_DB_VERSION);
    } else {
        error_log('play50 arcade: table install failed');
        set_transient('p50a_install_failed', 1, HOUR_IN_SECONDS); // no retry storm on every request
    }
}

function play50_arcade_maybe_install() {
    if (get_option('play50_arcade_db_version') === PLAY50_ARCADE_DB_VERSION) return;
    if (get_transient('p50a_install_failed')) return;
    play50_arcade_install();
}
add_action('after_switch_theme', 'play50_arcade_install');
add_action('init', 'play50_arcade_maybe_install');
```

dbDelta rules (keep them when the schema changes):
- No `IF NOT EXISTS`, no backticks, one column per line.
- Two spaces after `PRIMARY KEY`. Use `KEY`, never `INDEX`.
- Bump `PLAY50_ARCADE_DB_VERSION` on every schema change; `init` applies it on prod without reactivating the theme.
- dbDelta adds columns and indexes but never drops them. The table is never dropped automatically.

| Column | Meaning |
|---|---|
| `best_score` | Highest accepted score |
| `best_duration_ms` | Duration of the run that set `best_score` |
| `last_score` | Score of the latest accepted run |
| `plays` | Accepted runs (rejected submits do not count) |
| `hidden` | `1` = excluded from leaderboards and ranks (set by ban, cleared by unban) |
| `best_at` | When `best_score` was set (tie-break: earlier wins) |
| `last_played` | Latest accepted run |

---

## 3. Game config: `includes/arcade-games.json`

Edited only by Claude ("assets + limits" PR). Must match each game's `meta.scoring` (checked by `src/arcade3d/registry.sync.test.ts`). The WP JSON goes live before the game's frontend.

```json
{
  "version": 1,
  "games": {
    "robot-collector": {
      "title": "Robot Collector",
      "kind": "points",
      "max_score": 1600,
      "min_duration_ms": 5000,
      "max_duration_ms": 75000,
      "base": 600,
      "max_pps": 120,
      "enabled": false
    },
    "escape-room": {
      "title": "Tiny Escape Room",
      "kind": "time",
      "max_score": 60000,
      "min_duration_ms": 15000,
      "max_duration_ms": 600000,
      "time_base_ms": 600000,
      "enabled": false
    }
  }
}
```

| Field | Points game | Time game |
|---|---|---|
| `title` | required | required |
| `kind` | `"points"` | `"time"` |
| `max_score` | required, > 0 | required, > 0 |
| `min_duration_ms` / `max_duration_ms` | required, min < max | required, min < max |
| `base`, `max_pps` | required, >= 0 | omitted (normalized to 0) |
| `time_base_ms` | omitted (normalized to null) | required, > 0 |
| `enabled` | `true` only for live games (only the game under test during prod tests) | same |

`version` is informational (bump it when limits change).

### Loader

```php
/** @return array<string, array> slug => normalized config (all games, enabled or not) */
function play50_arcade_games() {
    static $games = null;
    if ($games !== null) return $games;

    $games = array();
    $file = __DIR__ . '/arcade-games.json';
    $json = file_exists($file) ? json_decode((string) file_get_contents($file), true) : null;
    if (!is_array($json) || !isset($json['games']) || !is_array($json['games'])) {
        error_log('play50 arcade: arcade-games.json missing or invalid');
    } else {
        foreach ($json['games'] as $slug => $raw) {
            $game = play50_arcade_normalize_game($slug, $raw); // null = invalid entry, skipped + error_log
            if ($game) $games[$slug] = $game;
        }
    }
    $games = apply_filters('play50_arcade_games', $games);
    return $games;
}

/** Enabled game or null. $require_enabled=false is for /me and the admin page. */
function play50_arcade_game($slug, $require_enabled = true) { /* ... */ }
```

Normalized shape (also the `/arcade/games` output):
```php
array(
    'title' => 'Robot Collector',
    'kind' => 'points',          // 'points' | 'time'
    'max_score' => 1600,
    'min_duration_ms' => 5000,
    'max_duration_ms' => 75000,
    'base' => 600,               // 0 for time games
    'max_pps' => 120,            // 0 for time games
    'time_base_ms' => null,      // int for time games
    'enabled' => false,
)
```
An entry is skipped when: slug fails `^[a-z0-9-]{1,40}$`, `kind` is unknown, `max_score <= 0`, `min >= max`, or a time game has no `time_base_ms > 0`. The static cache means `play50_arcade_games` filters must be added before the first call (plugin or theme load time).

---

## 4. Errors

All errors are `WP_Error` → `{"code":"...","message":"...","data":{"status":N,...}}`. The client maps `body.code` (`mapErrorCode` in `arcade.ts`), never the status alone.

| `code` | HTTP | When | Client code |
|---|---|---|---|
| `missing_api_key` | 401 | No `X-API-Key` / `X-Play50-API-Key` (from `play50_check_api_key_permission`) | `api_key` |
| `invalid_api_key` | 403 | Wrong API key (same helper) | `api_key` |
| `unauthorized` | 401 | No Bearer token, bad signature, expired, or user deleted | `unauthorized` (client drops the token) |
| `forbidden` | 403 | User has `play50_arcade_banned` | `banned` |
| `invalid_data` | 400 | Bad body or limits violated; `data.field` = `slug` / `score` / `duration_ms` / `hide_name` | `invalid_data` |
| `not_found` | 404 | Unknown or disabled slug | `not_found` |
| `rate_limited` | 429 | §8; `data.retry_after` = seconds to wait | `rate_limited` |
| `db_error` | 500 | `$wpdb` failure. Message is generic; `$wpdb->last_error` only goes to `error_log` | `server` |
| `rest_no_route` | 404 | WP core: slug in the URL fails the route regex | `not_found` |
| `rest_invalid_json` | 400 | WP core: malformed JSON body (rejected before our code runs) | `server` |

Messages are short and user-safe (for example "Unknown game.", "Score rejected.", "Too many scores. Try again in a few seconds."). Never echo SQL, tokens or limits that are not already public.

Note: when `PLAY50_API_KEY` is not defined, the existing helper allows every request (backward compatibility). Prod must define it.

---

## 5. Auth

| Permission | Steps | Used by |
|---|---|---|
| **public** | `play50_check_api_key_permission()` | `GET /arcade/games`, `GET /arcade/leaderboard/<slug>` |
| **user** | 1. API key (as above)<br>2. Token: `play50_get_jwt_from_header()`, fallback `Bearer` parsed from `$request->get_header('authorization')` (covers hosts that only set `REDIRECT_HTTP_AUTHORIZATION`)<br>3. `$uid = play50_get_user_id_from_jwt($token)`; `0` → `unauthorized`<br>4. `get_userdata($uid)` false (deleted user) → `unauthorized` | `GET/POST /arcade/me*`, `POST /arcade/scores` |
| **ban** | `get_user_meta($uid, 'play50_arcade_banned', true)` truthy → `forbidden` | `POST /arcade/scores` only (inside the callback, before body validation) |

- Implement steps 1-4 as `play50_arcade_auth_user(WP_REST_Request $request)` returning `WP_User|WP_Error`, memoized per request. Use it as the `permission_callback` (return the `WP_Error`, never `false`).
- **Never** call `get_current_user_id()`, `is_user_logged_in()` or `wp_get_current_user()` in arcade code. A request with only WP cookies is a request without a token → 401. Bearer-only auth also means no CSRF surface.
- On `GET /arcade/leaderboard` a token is optional: missing, invalid or expired → treated as anonymous (`me:null`), never 401.
- JWTs live 7 days. The Phase 3 secret rotation invalidates every token → 401 → the client clears it and asks for a login.

---

## 6. Endpoints

Client mapping (`arcadeApi` in `arcade.ts`):

| Method | Route | Permission | Client method |
|---|---|---|---|
| GET | `/arcade/games` | public | none (admin, debugging, tests) |
| POST | `/arcade/scores` | user + ban | `submit()` |
| GET | `/arcade/leaderboard/(?P<slug>[a-z0-9-]{1,40})` | public, JWT optional | `leaderboard()` |
| GET | `/arcade/me` | user | `me()` |
| GET | `/arcade/me/privacy` | user | `getPrivacy()` (added to `arcade.ts` in C4) |
| POST | `/arcade/me/privacy` | user | `setPrivacy()` |

All success responses are HTTP 200. Field order below is the output order (tests grep it).

### 6.1 `GET /arcade/games`

Response (all games, enabled or not):
```json
{ "games": { "robot-collector": { "title": "Robot Collector", "kind": "points", "max_score": 1600, "min_duration_ms": 5000, "max_duration_ms": 75000, "base": 600, "max_pps": 120, "time_base_ms": null, "enabled": false } } }
```
Errors: `missing_api_key`, `invalid_api_key`. Cache-Control: `public, max-age=300` + `Vary: Origin` (rest-api.php reflects the Origin in `Access-Control-Allow-Origin` and removes core's `rest_send_cors_headers`, which would normally add it).

### 6.2 `POST /arcade/scores`

Body (`ArcadeSubmitBody`):
| Field | Type | Notes |
|---|---|---|
| `slug` | string | `^[a-z0-9-]{1,40}$` |
| `score` | int | Required for points games. Ignored for time games (may be missing) |
| `duration_ms` | int | Required |
| `run_token` | string | Optional, ignored until Phase 5 |

"int" means a JSON integer (`is_int`) or a digit-only string up to 9 digits. Floats, negatives, booleans and `null` are `invalid_data`.

Response (`ArcadeSubmitResponse`):
```json
{ "success": true, "data": { "slug": "robot-collector", "score": 840, "best_score": 1020, "is_new_best": false, "plays": 7, "rank": 3 } }
```
| Field | Value |
|---|---|
| `score` | Stored score of this run (server-computed for time games) |
| `best_score`, `plays` | Row values after the upsert |
| `is_new_best` | No previous row, or `score > previous best_score` (same rule as `mergeRun` in `scores.ts`) |
| `rank` | Rank query (§9) with the row's `best_score` / `best_at` |

Errors: every code in §4 except `rest_no_route`. Cache-Control: `private, no-store`.

### 6.3 `GET /arcade/leaderboard/<slug>?limit=10`

- `limit`: `absint`, default 10, clamped to 1..50 (never an error).
- Response (`ArcadeLeaderboard`):
```json
{
  "slug": "robot-collector",
  "entries": [
    { "rank": 1, "name": "Ana K.", "score": 1540, "duration_ms": 61234, "achieved_at": "2026-10-05T12:34:56Z", "is_me": false }
  ],
  "me": { "rank": 14, "best_score": 900 }
}
```
- `entries` come from the top-50 cache (§9), sliced to `limit`. `user_id` never leaves the server.
- `is_me` is always present (`false` without a valid token).
- `me`: valid token and a non-hidden row for this slug → `{rank, best_score}` (fresh rank query, not cached), even when outside `limit`. Otherwise `null`.
- `duration_ms` = `best_duration_ms` (may be `null`). `achieved_at` = `best_at`.
- Errors: `missing_api_key`, `invalid_api_key`, `not_found` (unknown or disabled slug), `db_error` (top-50 or `me` query failed).
- Headers:
  - No `Authorization` header: `Cache-Control: public, max-age=30`
  - `Authorization` header present (valid or not) in any source the token is read from (`$_SERVER`, the request headers, `getallheaders()`), or a user was resolved: `Cache-Control: private, no-store`
  - Always: `Vary: Authorization, Origin`

### 6.4 `GET /arcade/me`

Object keyed by slug (`Partial<Record<ArcadeSlug, ArcadeMeEntry>>`). One key per row whose slug exists in `play50_arcade_games()` (enabled or not); rows for unknown slugs are skipped.
```json
{ "robot-collector": { "best": 1020, "best_duration_ms": 58000, "plays": 7, "last_played": "2026-10-05T12:34:56Z", "rank": 3 } }
```
- `rank`: rank query, or `null` when the row is hidden (banned). A failed rank query is `db_error` 500, never `null`.
- No rows → `{}`. A plain empty PHP array would encode as `[]`, but returning a top-level `stdClass` from the callback is unsafe: WP core's `?_fields` / `?_embed` handling treats the data as an array and fatals on PHP 8. So the callback returns the (possibly empty) array and a `rest_pre_echo_response` filter scoped to this route turns `array()` into `new stdClass()` right before encoding.
- **No other top-level keys.** `syncServerScores()` treats every key as a slug.
- Errors: `missing_api_key`, `invalid_api_key`, `unauthorized`, `db_error`. Cache-Control: `private, no-store`.

### 6.5 `GET /arcade/me/privacy` and `POST /arcade/me/privacy`

- GET response: `{ "hide_name": false }`
- POST body: `{ "hide_name": true }`. Accepted values: `true/false`, `1/0`, `"1"/"0"`, `"true"/"false"`. Missing or anything else → `invalid_data` (`field: hide_name`).
- POST order: auth → rate limit (§8, `p50a_rl_priv_{uid}`, before body validation) → body → no-op check → write.
- POST effect: when the value is unchanged, nothing is written and no cache is cleared. Otherwise `true` → `update_user_meta($uid, 'play50_arcade_hide_name', 1)`, `false` → `delete_user_meta(...)`, then `play50_arcade_clear_cache()` for all slugs.
- POST response: `{ "hide_name": true }`
- Errors: `missing_api_key`, `invalid_api_key`, `unauthorized`, `invalid_data`, `rate_limited` (POST only). Cache-Control: `private, no-store`.

---

## 7. Submit: validation order and scoring

The first failing step returns; later steps do not run.

| # | Step | Failure |
|---|---|---|
| 1 | API key | `missing_api_key` 401 / `invalid_api_key` 403 |
| 2 | Bearer token valid (signature, `exp`) | `unauthorized` 401 |
| 3 | `get_userdata($uid)` | `unauthorized` 401 |
| 4 | Not banned | `forbidden` 403 |
| 5 | `slug` is a string matching `^[a-z0-9-]{1,40}$` | `invalid_data` 400 |
| 6 | `play50_arcade_game($slug)` exists and `enabled` | `not_found` 404 |
| 7 | Rate limits (§8): gap → user → IP | `rate_limited` 429 |
| 8 | `duration_ms` is an int | `invalid_data` 400 |
| 9 | `min_duration_ms <= duration_ms <= max_duration_ms` | `invalid_data` 400 |
| 10a | Points: `score` is an int, `0 <= score <= max_score`, plausible (below) | `invalid_data` 400 |
| 10b | Time: compute `score` (below), ignore the client value | none |
| 11 | Read previous `best_score`, then upsert (§9) | `db_error` 500 |
| 12 | Read the row back, rank it, clear the slug cache if `is_new_best`, respond | `db_error` 500 |

Rate limits run before body validation, so invalid submits (steps 8-10) still use up the budget. That stops anyone from probing the limits for free.

**Points plausibility** (integer form, no floats):
```php
// score <= base + max_pps * duration_ms / 1000
$ok = $score * 1000 <= $game['base'] * 1000 + $game['max_pps'] * $duration_ms;
```

**Time score** (same as `computeTimeScore` in `scores.ts`):
```php
$score = min($game['max_score'], max(0, intdiv($game['time_base_ms'] - $duration_ms, 10)));
```

---

## 8. Rate limits

One fixed-window helper on transients. A rejected request does not increment its own counter. Not atomic: a few extra requests can slip through under a race, which is acceptable.

```php
/** @return int 0 = allowed, else seconds until the window resets */
function play50_arcade_hit($key, $limit, $window) {
    $now = time();
    $t = get_transient($key);
    if (!is_array($t) || $t['reset'] <= $now) {
        $t = array('count' => 0, 'reset' => $now + $window);
    }
    if ($t['count'] >= $limit) {
        return max(1, $t['reset'] - $now);
    }
    $t['count']++;
    set_transient($key, $t, max(1, $t['reset'] - $now));
    return 0;
}

function play50_arcade_ip_hash() {
    $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
    $ip = apply_filters('play50_arcade_client_ip', $ip); // only for a trusted proxy; never read X-Forwarded-For directly
    return md5($ip . wp_salt());
}
```

| Limit | Transient key | Limit / window | Checked |
|---|---|---|---|
| Gap per user + game | `p50a_gap_{uid}_{slug}` | 1 / 3 s | 1st |
| Per user | `p50a_rl_u_{uid}` | 10 / 60 s | 2nd |
| Per hashed IP | `p50a_rl_ip_{ip_hash}` | 30 / 600 s | 3rd |
| Register per hashed IP | `p50a_rl_reg_{ip_hash}` | 5 / 3600 s | `rest_pre_dispatch` |
| Privacy change per user | `p50a_rl_priv_{uid}` | 10 / 60 s | `POST /arcade/me/privacy`, after auth |

A request rejected by a later check still counts toward the earlier ones. 429 body: `data.retry_after` = the helper's return value.

Register limit (the existing route is not edited):
```php
add_filter('rest_pre_dispatch', 'play50_arcade_limit_register', 10, 3);
function play50_arcade_limit_register($result, $server, $request) {
    if ($result !== null) return $result;
    // Same regex semantics as WP's router: '@^' . $route . '$@i' with no D modifier, so `$` also
    // matches before a trailing "\n" (?rest_route=/play50/v1/auth/register%0A). A plain string
    // compare would skip the limiter while WP still dispatches to the register handler.
    if ($request->get_method() !== 'POST' || preg_match('@^/play50/v1/auth/register/?$@i', (string) $request->get_route()) !== 1) {
        return $result;
    }
    $wait = play50_arcade_hit('p50a_rl_reg_' . play50_arcade_ip_hash(), 5, HOUR_IN_SECONDS);
    return $wait ? new WP_Error('rate_limited', 'Too many sign-ups. Try again later.', array('status' => 429, 'retry_after' => $wait)) : $result;
}
```
This runs before route matching and the API-key check, so every attempt counts, including failed ones.

---

## 9. Writes, ranks, cache

### Upsert (one statement, atomic)

`best_duration_ms` and `best_at` **must be assigned before** `best_score`. MySQL evaluates the `UPDATE` list left to right, so a later `IF(VALUES(best_score) > best_score, ...)` would compare against the already-updated value.

```php
$now = gmdate('Y-m-d H:i:s');
$sql = $wpdb->prepare(
    "INSERT INTO {$table}
        (user_id, game_slug, best_score, best_duration_ms, last_score, plays, hidden, best_at, last_played)
    VALUES (%d, %s, %d, %d, %d, 1, 0, %s, %s)
    ON DUPLICATE KEY UPDATE
        best_duration_ms = IF(VALUES(best_score) > best_score, VALUES(best_duration_ms), best_duration_ms),
        best_at = IF(VALUES(best_score) > best_score, VALUES(best_at), best_at),
        best_score = GREATEST(best_score, VALUES(best_score)),
        last_score = VALUES(last_score),
        plays = plays + 1,
        last_played = VALUES(last_played)",
    $uid, $slug, $score, $duration_ms, $score, $now, $now
);
if ($wpdb->query($sql) === false) { /* error_log($wpdb->last_error); return db_error 500 */ }
```
- `VALUES()` is deprecated in MySQL 8.0.20+ but still works there, and it is the form that works on MySQL 5.7 and MariaDB. Keep it.
- `hidden` is never touched by the upsert (banned users never reach it).
- `is_new_best` comes from a `SELECT best_score` read just before the upsert. The 3 s gap makes a same-user race practically impossible, and the stored row stays correct either way.
- The table name is interpolated only from `play50_arcade_table()`. Every value goes through `$wpdb->prepare`.

### Rank (competition ranking: equal score and equal `best_at` share a rank)

```sql
SELECT COUNT(*) + 1 FROM {table}
WHERE game_slug = %s AND hidden = 0
  AND (best_score > %d OR (best_score = %d AND best_at < %s))
```

### Top-50 cache

```sql
SELECT user_id, best_score, best_duration_ms, best_at FROM {table}
WHERE game_slug = %s AND hidden = 0
ORDER BY best_score DESC, best_at ASC, id ASC
LIMIT 50
```
- Transient `p50a_top_{slug}`, TTL 60 s. It stores the finished list: `[{user_id, rank, name, score, duration_ms, achieved_at}]`.
- Names load in one batch: `cache_users($user_ids)` (primes users and their meta), then `play50_arcade_public_name()` per row.
- `rank` inside the list: `i + 1`, except it repeats the previous rank when `(best_score, best_at)` equals the previous row. This matches the rank query.

`play50_arcade_clear_cache($slug = null)` deletes `p50a_top_{slug}`, or the cache of every slug in `play50_arcade_games()` when `$slug` is null.

| Event | Clear |
|---|---|
| Submit with `is_new_best` | that slug |
| Privacy change | all |
| Ban / unban | all |
| `deleted_user` | all |
| Admin delete row / reset game | that slug |
| Admin "Clear cache" | that slug or all |
| Profile name change | nothing (stale for at most 60 s) |

### Cache-Control summary

| Response | Cache-Control |
|---|---|
| `GET /arcade/games` | `public, max-age=300` + `Vary: Origin` |
| `GET /arcade/leaderboard/*` without `Authorization` | `public, max-age=30` + `Vary: Authorization, Origin` |
| `GET /arcade/leaderboard/*` with `Authorization` | `private, no-store` + `Vary: Authorization, Origin` |
| `/arcade/me*`, `POST /arcade/scores` | `private, no-store` |

Set the headers with `$response->header(...)`. WP sends them after its own no-cache headers, so ours win. If a CDN or page cache ever sits in front of `/wp-json`, it must bypass `/wp-json` or vary on the API-key headers.

---

## 10. Names, privacy, bans, deleted users

**Public name** (`play50_arcade_public_name($uid)`, string):

| Case | Output |
|---|---|
| `play50_arcade_hide_name` meta truthy | `Anonymous` |
| `first_name` set | First name (tags stripped, trimmed, max 20 chars) + `" " + uppercase first letter of last_name + "."` when `last_name` is set → `Ana K.` |
| No `first_name`, or user missing | `Player` |

- Never use `display_name`, `user_login` or email: they can be identifying.
- Use `mb_substr` (WP polyfills it). For uppercase use `mb_strtoupper` when it exists, else `strtoupper`.
- The register modal and the privacy policy say that names show publicly as "First L." and can be hidden (C4).

**User meta**

| Meta key | Set by | Effect |
|---|---|---|
| `play50_arcade_hide_name` | `POST /arcade/me/privacy` | Name shows as `Anonymous`. The score stays ranked |
| `play50_arcade_banned` | Admin "Ban" | Submit → 403 `forbidden`; all of the user's rows get `hidden=1` |

**Ban:** `update_user_meta($uid, 'play50_arcade_banned', 1)`, `UPDATE {table} SET hidden = 1 WHERE user_id = %d`, `play50_arcade_clear_cache()`.
**Unban:** `delete_user_meta($uid, 'play50_arcade_banned')`, `UPDATE {table} SET hidden = 0 WHERE user_id = %d`, `play50_arcade_clear_cache()`.

**Deleted user:**
```php
add_action('deleted_user', 'play50_arcade_on_deleted_user');
function play50_arcade_on_deleted_user($user_id) {
    global $wpdb;
    $wpdb->delete(play50_arcade_table(), array('user_id' => (int) $user_id), array('%d'));
    play50_arcade_clear_cache();
}
```
A JWT that still exists for a deleted user gets 401 (§5, step 4).

---

## 11. PHP surface of `arcade-api.php`

**The admin page may call only these four functions:**

| Function | Returns |
|---|---|
| `play50_arcade_table()` | Full table name with prefix |
| `play50_arcade_games()` | slug => normalized config (§3), all games |
| `play50_arcade_clear_cache($slug = null)` | void. One slug, or all when null |
| `play50_arcade_public_name($uid)` | The public name string (§10) |

Internal (do not call from the admin page): `play50_arcade_install`, `play50_arcade_maybe_install`, `play50_arcade_game`, `play50_arcade_normalize_game`, `play50_arcade_auth_user`, `play50_arcade_hit`, `play50_arcade_ip_hash`, `play50_arcade_limit_register`, `play50_arcade_on_deleted_user`, `play50_arcade_empty_me_object`, `play50_arcade_register_routes`, the route callbacks and the small `play50_arcade_*` helpers (parsing, errors, rank, top-50).

| Hook | Callback |
|---|---|
| `after_switch_theme` | `play50_arcade_install` |
| `init` | `play50_arcade_maybe_install` |
| `rest_api_init` | `play50_arcade_register_routes` (every route has a `permission_callback`) |
| `rest_pre_dispatch` (10, 3) | `play50_arcade_limit_register` |
| `rest_pre_echo_response` (10, 3) | `play50_arcade_empty_me_object` (`GET /arcade/me` with no rows → `{}`, §6.4) |
| `deleted_user` | `play50_arcade_on_deleted_user` |

| Filter | Purpose |
|---|---|
| `play50_arcade_games` | Override or extend the normalized game list |
| `play50_arcade_client_ip` | Real client IP behind a trusted proxy |

Before every upload: `php -l includes/arcade-api.php` and `php -l wt-cpt/arcade-scores-admin.php`.

---

## 12. Admin page contract (Codex, `wt-cpt/arcade-scores-admin.php`)

**Scope:** this one file only. No REST routes, no schema changes, no JS libraries, no edits to `arcade-api.php`, `rest-api.php` or `functions.php`.

**Do not copy `share-tracking.php`.** It hooks its handler on `admin_init` and calls `wp_die()` for anyone without `manage_options`. That runs on every admin request (including `admin-ajax.php` and a subscriber's `profile.php`) and breaks them. Use one `admin_post_*` handler per action instead.

### Menu and screen
- `add_menu_page('Arcade Scores', 'Arcade Scores', 'manage_options', 'play50-arcade-scores', 'play50_arcade_admin_render', 'dashicons-awards', 8)` on `admin_menu`.
- If `!function_exists('play50_arcade_table')`, render only an error notice: "Arcade API not loaded".
- Header: DB version (`get_option('play50_arcade_db_version')`) and whether the table exists.
- Game selector: every slug from `play50_arcade_games()` (title, enabled badge, row count), plus any extra slugs found in the table (orphans). Counts come from one query: `SELECT game_slug, COUNT(*) AS n, SUM(hidden) AS h FROM {table} GROUP BY game_slug`.
- Query args: `game` (`sanitize_key` + `^[a-z0-9-]{1,40}$`, default the first game), `paged` (`absint`, min 1), `p50a_notice`.
- Rows for the selected game, 50 per page:
  ```sql
  SELECT id, user_id, best_score, best_duration_ms, last_score, plays, hidden, best_at, last_played
  FROM {table} WHERE game_slug = %s
  ORDER BY best_score DESC, best_at ASC, id ASC
  LIMIT %d OFFSET %d
  ```
  Total from `SELECT COUNT(*) FROM {table} WHERE game_slug = %s`. Pagination via `paginate_links()`.
- Call `cache_users($user_ids)` once per page. Columns: #, user (ID + `user_login` linked to `get_edit_user_link()`), public name, best score, best duration, last score, plays, best at, last played (UTC), status (hidden / banned), actions.
- Markup: core admin classes (`wrap`, `widefat striped`, `button`, `notice`). Escape every output with `esc_html`, `esc_attr`, `esc_url`.

### Actions

Every action is a POST form to `admin_url('admin-post.php')` with a hidden `action` and `wp_nonce_field(<nonce action>)`. Destructive buttons add `onclick="return confirm('...')"`.

| `action` | POST fields | Nonce action | Effect | Notice |
|---|---|---|---|---|
| `play50_arcade_delete_row` | `row_id`, `game` | `play50_arcade_delete_row_{row_id}` | `DELETE` that row; `play50_arcade_clear_cache($game)` | `deleted` |
| `play50_arcade_reset_game` | `game`, `confirm_slug` (must equal `game`, typed by the admin) | `play50_arcade_reset_game_{game}` | `DELETE ... WHERE game_slug = %s`; clear that slug | `reset` (+ `p50a_count`) |
| `play50_arcade_ban_user` | `user_id`, `game` | `play50_arcade_ban_user_{user_id}` | Ban (§10) | `banned` |
| `play50_arcade_unban_user` | `user_id`, `game` | `play50_arcade_unban_user_{user_id}` | Unban (§10) | `unbanned` |
| `play50_arcade_clear_cache` | `game` (slug or `all`) | `play50_arcade_clear_cache` | `play50_arcade_clear_cache($game === 'all' ? null : $game)` | `cleared` |

Every handler, in this order:
```php
add_action('admin_post_play50_arcade_delete_row', 'play50_arcade_admin_delete_row');
function play50_arcade_admin_delete_row() {
    if (!current_user_can('manage_options')) {
        wp_die(esc_html__('Sorry, you are not allowed to do that.'), '', array('response' => 403));
    }
    $row_id = isset($_POST['row_id']) ? absint($_POST['row_id']) : 0;
    check_admin_referer('play50_arcade_delete_row_' . $row_id);
    // validate input (row_id > 0, slug regex, user exists, confirm_slug === game) else notice=error
    // $wpdb->delete / $wpdb->query($wpdb->prepare(...)) + play50_arcade_clear_cache(...)
    wp_safe_redirect(add_query_arg(array('page' => 'play50-arcade-scores', 'game' => $game, 'p50a_notice' => 'deleted'), admin_url('admin.php')));
    exit;
}
```
- Register handlers with `admin_post_` only (never `admin_post_nopriv_`).
- Notices come from a fixed whitelist: `deleted`, `reset`, `banned`, `unbanned`, `cleared`, `error`. Never echo raw query args.

---

## 13. Curl test suite (prod, test user)

Run it per platform-plan §3 "5.4": backup taken, `php -l` clean, frontend flags off, only `$SLUG` has `enabled:true`, logged in as the dedicated **arcade-test** user.

Setup in Git Bash. Values come from your local env. Never paste them into chat, never commit them, never use `set -x`.
```bash
export WP="https://<cms-host>/wp-json/play50/v1"
read -rs KEY && export KEY   # the frontend API key
read -rs JWT && export JWT   # arcade-test token: DevTools > localStorage > play50games_jwt_token
```

Save as a local scratch file (not in the repo), then run `bash arcade-smoke.sh`. It takes about 2 minutes. Wait 10 minutes between full runs (IP limit 30 / 10 min).
```bash
#!/usr/bin/env bash
set -u
: "${WP:?export WP}" "${KEY:?export KEY}" "${JWT:?export JWT}"
SLUG="${SLUG:-robot-collector}"   # must be enabled:true
TIME_SLUG="${TIME_SLUG:-}"        # escape-room | obstacle-race, only when enabled
RUN_REGISTER="${RUN_REGISTER:-0}" # 1 = test the register limit (blocks sign-ups from this IP for 1 h)

# robot-collector: max 1600, 5000..75000 ms, base 600, max_pps 120. Adjust for other games.
OK_SCORE=100;   OK_MS=30000
BAD_SCORE=1500; BAD_MS=5000       # 1500 > 600 + 120 * 5

K=(-H "X-API-Key: $KEY")
A=(-H "Authorization: Bearer $JWT")
F=(-H "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxfQ.forged")
P=(-X POST -H "Content-Type: application/json")
S="$WP/arcade/scores"
pass=0; fail=0
ok()  { pass=$((pass + 1)); echo "PASS  $1"; }
bad() { fail=$((fail + 1)); echo "FAIL  $1"; }

# check NAME STATUS CODE|- BODY_REGEX|- curl-args...
check() {
   local name="$1" want="$2" code="$3" re="$4"; shift 4
   local out status body
   out=$(curl -s -w $'\n%{http_code}' "$@")
   status="${out##*$'\n'}"; body="${out%$'\n'*}"
   if [ "$status" = "$want" ] \
      && { [ "$code" = "-" ] || grep -q "\"code\":\"$code\"" <<<"$body"; } \
      && { [ "$re" = "-" ] || grep -qE "$re" <<<"$body"; }; then
      ok "$name"
   else
      bad "$name -> HTTP $status ${body:0:300}"
   fi
}
# hdr NAME HEADER_REGEX curl-args...
hdr() {
   local name="$1" re="$2"; shift 2
   if curl -s -o /dev/null -D - "$@" | tr -d '\r' | grep -qiE "$re"; then ok "$name"; else bad "$name (no header ~ $re)"; fi
}
run() { printf '{"slug":"%s","score":%s,"duration_ms":%s}' "$1" "$2" "$3"; }
gap() { sleep 3.2; }
V=$(run "$SLUG" $OK_SCORE $OK_MS)

echo "== A. reads"
check "games: with key"           200 - "\"$SLUG\""  "${K[@]}" "$WP/arcade/games"
check "games: no key"             401 missing_api_key - "$WP/arcade/games?_=$RANDOM"
check "games: wrong key"          403 invalid_api_key - -H "X-API-Key: wrong-$RANDOM" "$WP/arcade/games?_=$RANDOM"
check "board: guest"              200 - '"me":null'  "${K[@]}" "$WP/arcade/leaderboard/$SLUG?limit=10"
check "board: forged JWT ignored" 200 - '"me":null'  "${K[@]}" "${F[@]}" "$WP/arcade/leaderboard/$SLUG"
check "board: limit clamped"      200 - '"entries":' "${K[@]}" "$WP/arcade/leaderboard/$SLUG?limit=999"
check "board: unknown slug"       404 not_found -    "${K[@]}" "$WP/arcade/leaderboard/no-such-game"
hdr   "board: public cache"       '^cache-control:.*public'  "${K[@]}" "$WP/arcade/leaderboard/$SLUG"
hdr   "board: private with JWT"   '^cache-control:.*private' "${K[@]}" "${A[@]}" "$WP/arcade/leaderboard/$SLUG"
check "me: ok"                    200 - -            "${K[@]}" "${A[@]}" "$WP/arcade/me"
check "me: no JWT"                401 unauthorized - "${K[@]}" "$WP/arcade/me"
check "me: forged JWT"            401 unauthorized - "${K[@]}" "${F[@]}" "$WP/arcade/me"

echo "== B. submit auth (not rate-counted)"
check "submit: no JWT"            401 unauthorized -    "${P[@]}" "$S" "${K[@]}" -d "$V"
check "submit: cookie only"       401 unauthorized -    "${P[@]}" "$S" "${K[@]}" -H "Cookie: ${COOKIE:-wordpress_logged_in_x=fake}" -d "$V"
check "submit: no API key"        401 missing_api_key - "${P[@]}" "$S" "${A[@]}" -d "$V"
check "submit: forged JWT"        401 unauthorized -    "${P[@]}" "$S" "${K[@]}" "${F[@]}" -d "$V"
check "submit: bad slug"          400 invalid_data -    "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run 'Robot!' 10 $OK_MS)"
check "submit: unknown slug"      404 not_found -       "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run no-such-game 10 $OK_MS)"

echo "== C. validation (each counts; 3.2 s apart)"
check "submit: valid"             200 - '"success":true' "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$V"; gap
check "me: has slug"              200 - "\"$SLUG\":\\{\"best\":" "${K[@]}" "${A[@]}" "$WP/arcade/me"
check "board: me filled"          200 - '"me":\{"rank":[0-9]+' "${K[@]}" "${A[@]}" "$WP/arcade/leaderboard/$SLUG"
check "submit: score 99999"       400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$SLUG" 99999 $OK_MS)"; gap
check "submit: implausible"       400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$SLUG" $BAD_SCORE $BAD_MS)"; gap
check "submit: duration_ms 100"   400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$SLUG" 10 100)"; gap
check "submit: negative score"    400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$SLUG" -5 $OK_MS)"; gap
check "submit: float score"       400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$SLUG" 12.5 $OK_MS)"; gap
check "submit: no duration"       400 invalid_data - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "{\"slug\":\"$SLUG\",\"score\":10}"; gap
check "submit: valid again"       200 - '"plays":[0-9]+' "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$V"
check "submit: 3 s gap"           429 rate_limited - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$V"

if [ -n "$TIME_SLUG" ]; then
   echo "== T. time game: server computes the score"
   case "$TIME_SLUG" in escape-room) TB=600000 ;; obstacle-race) TB=300000 ;; *) TB=0 ;; esac
   check "time: client score ignored" 200 - "\"score\":$(( (TB - 60000) / 10 ))," \
      "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$(run "$TIME_SLUG" 999999 60000)"
fi

echo "== D. 10 per minute per user (waits 61 s for a fresh window)"
sleep 61
for i in 1 2 3 4 5 6 7 8 9 10; do
   check "minute #$i" 200 - - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$V"; gap
done
check "minute #11" 429 rate_limited - "${P[@]}" "$S" "${K[@]}" "${A[@]}" -d "$V"

echo "== E. privacy"
check "privacy: get"              200 - '"hide_name":(true|false)' "${K[@]}" "${A[@]}" "$WP/arcade/me/privacy"
check "privacy: hide"             200 - '"hide_name":true'  "${P[@]}" "$WP/arcade/me/privacy" "${K[@]}" "${A[@]}" -d '{"hide_name":true}'
check "board: shows Anonymous"    200 - '"name":"Anonymous"[^}]*"is_me":true' "${K[@]}" "${A[@]}" "$WP/arcade/leaderboard/$SLUG?limit=50"
check "privacy: show"             200 - '"hide_name":false' "${P[@]}" "$WP/arcade/me/privacy" "${K[@]}" "${A[@]}" -d '{"hide_name":false}'
check "privacy: bad body"         400 invalid_data -        "${P[@]}" "$WP/arcade/me/privacy" "${K[@]}" "${A[@]}" -d '{}'
check "privacy: no JWT"           401 unauthorized -        "${P[@]}" "$WP/arcade/me/privacy" "${K[@]}" -d '{"hide_name":true}'

if [ "$RUN_REGISTER" = "1" ]; then
   echo "== R. register 5 per hour per IP (empty bodies: no account is created)"
   for i in 1 2 3 4 5; do
      check "register #$i" 400 missing_fields - "${P[@]}" "$WP/auth/register" "${K[@]}" -d '{}'
   done
   check "register #6" 429 rate_limited - "${P[@]}" "$WP/auth/register" "${K[@]}" -d '{}'
fi

echo; echo "passed: $pass  failed: $fail"
[ "$fail" -eq 0 ]
```

Budget per run: about 20 counted submits from your IP (limit 30 / 10 min). "Board: shows Anonymous" assumes the test user is in the top 50, which holds on an empty pre-launch board.

### Manual cases (wp-admin + curl)

| Case | Steps | Expected |
|---|---|---|
| Banned user | Admin → Arcade Scores → Ban arcade-test → wait 3 s → submit `$V` | 403 `forbidden`; the test user is gone from `GET /arcade/leaderboard/$SLUG`; `/arcade/me` rank is `null` |
| Unban | Unban → wait 3 s → submit `$V` | 200; the user is back on the board |
| Deleted user | Create a throwaway user in the site UI (the sign-up counts toward the 5/h register limit, so do this before `RUN_REGISTER=1`), log in, `read -rs JWT_DEL`, delete the user in wp-admin, submit with `Authorization: Bearer $JWT_DEL` | 401 `unauthorized`; the user's rows are gone from the admin list |
| Upsert correctness | Submit a higher score, then a lower one (3 s apart) | `best_score` keeps the higher value, `best_at` / `best_duration_ms` belong to the higher run, `plays` +2, `last_score` = the lower one |

### Cleanup (always)
1. Admin → Arcade Scores → **Reset game** for `$SLUG` (and `$TIME_SLUG`), then **Clear cache** → all.
2. `GET /arcade/leaderboard/$SLUG` shows no test rows.
3. Only then turn the frontend flags on (plan §3 "5.4", step 5).
