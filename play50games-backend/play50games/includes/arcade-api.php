<?php
/**
 * Play50Games 3D Arcade API (play50/v1/arcade/*).
 *
 * Contract: docs/arcade-api.md (source of truth). Separate from classic progress:
 * own table, own routes, own transients (p50a_*). Loaded from functions.php after
 * includes/rest-api.php, whose helpers it reuses:
 *   play50_check_api_key_permission(), play50_get_jwt_from_header(), play50_get_user_id_from_jwt().
 *
 * Auth for user routes is Bearer JWT only. Never use get_current_user_id(),
 * is_user_logged_in() or wp_get_current_user() in this file.
 *
 * Compatible with PHP 7.4+ and WordPress 6.x. Run `php -l` before every upload.
 */

if (!defined('ABSPATH')) {
    exit;
}

if (!defined('PLAY50_ARCADE_DB_VERSION')) {
    define('PLAY50_ARCADE_DB_VERSION', '1');
}

// ---------------------------------------------------------------------------
// Table + install (§2)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_table')) {
    /** Full table name with prefix. Public: used by the admin page. */
    function play50_arcade_table() {
        global $wpdb;
        return $wpdb->prefix . 'play50_arcade_scores';
    }
}

if (!function_exists('play50_arcade_install')) {
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
            update_option('play50_arcade_db_version', PLAY50_ARCADE_DB_VERSION, true);
        } else {
            error_log('play50 arcade: table install failed');
            set_transient('p50a_install_failed', 1, HOUR_IN_SECONDS); // no retry storm on every request
        }
    }
}

if (!function_exists('play50_arcade_maybe_install')) {
    /** Runs on init: one get_option (autoloaded) per request, dbDelta only when the version changes. */
    function play50_arcade_maybe_install() {
        if (get_option('play50_arcade_db_version') === PLAY50_ARCADE_DB_VERSION) {
            return;
        }
        if (get_transient('p50a_install_failed')) {
            return;
        }
        play50_arcade_install();
    }
}

// ---------------------------------------------------------------------------
// Game config (§3)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_valid_slug')) {
    /** True when $slug is a string matching ^[a-z0-9-]{1,40}$ (D: no trailing newline). */
    function play50_arcade_valid_slug($slug) {
        return is_string($slug) && preg_match('/^[a-z0-9-]{1,40}$/D', $slug) === 1;
    }
}

if (!function_exists('play50_arcade_normalize_game')) {
    /** Normalized config array, or null for an invalid entry (logged and skipped). */
    function play50_arcade_normalize_game($slug, $raw) {
        $slug = is_int($slug) ? (string) $slug : $slug;
        if (!play50_arcade_valid_slug($slug) || !is_array($raw)) {
            error_log('play50 arcade: invalid game entry skipped (bad slug or not an object)');
            return null;
        }

        $kind = isset($raw['kind']) ? $raw['kind'] : '';
        if ($kind !== 'points' && $kind !== 'time') {
            error_log('play50 arcade: game ' . $slug . ' skipped (unknown kind)');
            return null;
        }

        $max_score = (isset($raw['max_score']) && is_numeric($raw['max_score'])) ? (int) $raw['max_score'] : 0;
        $min_ms = (isset($raw['min_duration_ms']) && is_numeric($raw['min_duration_ms'])) ? (int) $raw['min_duration_ms'] : 0;
        $max_ms = (isset($raw['max_duration_ms']) && is_numeric($raw['max_duration_ms'])) ? (int) $raw['max_duration_ms'] : 0;
        if ($max_score <= 0 || $min_ms >= $max_ms) {
            error_log('play50 arcade: game ' . $slug . ' skipped (max_score or duration limits)');
            return null;
        }

        $base = 0;
        $max_pps = 0;
        $time_base_ms = null;
        if ($kind === 'time') {
            $time_base_ms = (isset($raw['time_base_ms']) && is_numeric($raw['time_base_ms'])) ? (int) $raw['time_base_ms'] : 0;
            if ($time_base_ms <= 0) {
                error_log('play50 arcade: game ' . $slug . ' skipped (time game without time_base_ms)');
                return null;
            }
        } else {
            $base = (isset($raw['base']) && is_numeric($raw['base'])) ? max(0, (int) $raw['base']) : 0;
            $max_pps = (isset($raw['max_pps']) && is_numeric($raw['max_pps'])) ? max(0, (int) $raw['max_pps']) : 0;
        }

        $title = (isset($raw['title']) && is_string($raw['title']) && $raw['title'] !== '') ? $raw['title'] : $slug;

        return array(
            'title' => $title,
            'kind' => $kind,
            'max_score' => $max_score,
            'min_duration_ms' => $min_ms,
            'max_duration_ms' => $max_ms,
            'base' => $base,
            'max_pps' => $max_pps,
            'time_base_ms' => $time_base_ms,
            'enabled' => isset($raw['enabled']) && $raw['enabled'] === true,
        );
    }
}

if (!function_exists('play50_arcade_games')) {
    /**
     * slug => normalized config (all games, enabled or not). Public: used by the admin page.
     * Static cache: add `play50_arcade_games` filters before the first call.
     */
    function play50_arcade_games() {
        static $games = null;
        if ($games !== null) {
            return $games;
        }

        $games = array();
        $file = __DIR__ . '/arcade-games.json';
        $json = file_exists($file) ? json_decode((string) file_get_contents($file), true) : null;
        if (!is_array($json) || !isset($json['games']) || !is_array($json['games'])) {
            error_log('play50 arcade: arcade-games.json missing or invalid');
        } else {
            foreach ($json['games'] as $slug => $raw) {
                $game = play50_arcade_normalize_game($slug, $raw);
                if ($game) {
                    $games[(string) $slug] = $game;
                }
            }
        }

        $games = apply_filters('play50_arcade_games', $games);
        if (!is_array($games)) {
            $games = array();
        }
        return $games;
    }
}

if (!function_exists('play50_arcade_game')) {
    /** Enabled game or null. $require_enabled = false is for /me and the admin page. */
    function play50_arcade_game($slug, $require_enabled = true) {
        if (!play50_arcade_valid_slug($slug)) {
            return null;
        }
        $games = play50_arcade_games();
        if (!isset($games[$slug]) || !is_array($games[$slug])) {
            return null;
        }
        if ($require_enabled && empty($games[$slug]['enabled'])) {
            return null;
        }
        return $games[$slug];
    }
}

// ---------------------------------------------------------------------------
// Small helpers: errors, responses, parsing, time
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_error')) {
    function play50_arcade_error($code, $message, $status, $extra = array()) {
        return new WP_Error($code, $message, array_merge(array('status' => (int) $status), $extra));
    }
}

if (!function_exists('play50_arcade_invalid')) {
    /** 400 invalid_data with data.field. */
    function play50_arcade_invalid($field, $message = 'Score rejected.') {
        return play50_arcade_error('invalid_data', $message, 400, array('field' => $field));
    }
}

if (!function_exists('play50_arcade_not_found')) {
    function play50_arcade_not_found() {
        return play50_arcade_error('not_found', 'Unknown game.', 404);
    }
}

if (!function_exists('play50_arcade_db_error')) {
    /** 500 db_error. $wpdb->last_error goes to error_log only, never to the client. */
    function play50_arcade_db_error($context) {
        global $wpdb;
        error_log('play50 arcade: db error (' . $context . '): ' . $wpdb->last_error);
        return play50_arcade_error('db_error', 'Something went wrong. Please try again.', 500);
    }
}

if (!function_exists('play50_arcade_response')) {
    function play50_arcade_response($data, $cache_control, $vary = '') {
        $response = new WP_REST_Response($data, 200);
        $response->header('Cache-Control', $cache_control);
        if ($vary !== '') {
            $response->header('Vary', $vary);
        }
        return $response;
    }
}

if (!function_exists('play50_arcade_int')) {
    /** JSON integer >= 0 or a digit-only string up to 9 digits; anything else -> null. */
    function play50_arcade_int($value) {
        if (is_int($value)) {
            return $value >= 0 ? $value : null;
        }
        if (is_string($value) && preg_match('/^[0-9]{1,9}$/D', $value) === 1) {
            return (int) $value;
        }
        return null;
    }
}

if (!function_exists('play50_arcade_bool')) {
    /** true/false, 1/0, "1"/"0", "true"/"false"; anything else -> null. */
    function play50_arcade_bool($value) {
        if ($value === true || $value === 1 || $value === '1' || $value === 'true') {
            return true;
        }
        if ($value === false || $value === 0 || $value === '0' || $value === 'false') {
            return false;
        }
        return null;
    }
}

if (!function_exists('play50_arcade_iso')) {
    /** MySQL UTC DATETIME -> ISO 8601 UTC ("2026-10-05T12:34:56Z"). */
    function play50_arcade_iso($datetime) {
        if (is_string($datetime) && preg_match('/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/D', $datetime, $m) === 1) {
            return $m[1] . 'T' . $m[2] . 'Z';
        }
        return '';
    }
}

if (!function_exists('play50_arcade_body')) {
    /** JSON body as an array (empty array when missing or not an object). */
    function play50_arcade_body($request) {
        $body = $request->get_json_params();
        if (!is_array($body)) {
            $decoded = json_decode((string) $request->get_body(), true);
            $body = is_array($decoded) ? $decoded : array();
        }
        return $body;
    }
}

// ---------------------------------------------------------------------------
// Auth (§5)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_bearer_token')) {
    /** Bearer token or '' (shared helper first, then the request header for REDIRECT_HTTP_AUTHORIZATION hosts). */
    function play50_arcade_bearer_token($request) {
        $token = function_exists('play50_get_jwt_from_header') ? play50_get_jwt_from_header() : null;
        if (!is_string($token) || trim($token) === '') {
            $token = '';
            $header = ($request instanceof WP_REST_Request) ? $request->get_header('authorization') : null;
            if (is_string($header) && preg_match('/^\s*Bearer\s+(\S+)/i', $header, $m) === 1) {
                $token = $m[1];
            }
        }
        return trim($token);
    }
}

if (!function_exists('play50_arcade_has_auth_header')) {
    /**
     * True when any Authorization header was sent (valid or not). Checks every source the token
     * can come from, including getallheaders() (mod_php hosts without the .htaccess rule).
     */
    function play50_arcade_has_auth_header($request) {
        if (!empty($_SERVER['HTTP_AUTHORIZATION']) || !empty($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
            return true;
        }
        $header = ($request instanceof WP_REST_Request) ? $request->get_header('authorization') : null;
        if (is_string($header) && $header !== '') {
            return true;
        }
        if (function_exists('getallheaders')) {
            $all = getallheaders();
            if (is_array($all)) {
                foreach ($all as $name => $value) {
                    if (is_string($name) && strtolower($name) === 'authorization' && is_string($value) && $value !== '') {
                        return true;
                    }
                }
            }
        }
        return play50_arcade_bearer_token($request) !== '';
    }
}

if (!function_exists('play50_arcade_request_user')) {
    /** WP_User for a valid, unexpired token of an existing user; null otherwise. Memoized per token. */
    function play50_arcade_request_user($request) {
        static $memo = array();
        $token = play50_arcade_bearer_token($request);
        if ($token === '' || !function_exists('play50_get_user_id_from_jwt')) {
            return null;
        }
        if (array_key_exists($token, $memo)) {
            return $memo[$token];
        }

        $user = null;
        $uid = (int) play50_get_user_id_from_jwt($token);
        if ($uid > 0) {
            $found = get_userdata($uid);
            if ($found instanceof WP_User && $found->exists()) {
                $user = $found;
            }
        }

        if (count($memo) > 8) {
            $memo = array();
        }
        $memo[$token] = $user;
        return $user;
    }
}

if (!function_exists('play50_arcade_check_api_key')) {
    /** true or WP_Error (missing_api_key 401 / invalid_api_key 403) from the shared helper. */
    function play50_arcade_check_api_key() {
        if (!function_exists('play50_check_api_key_permission')) {
            return play50_arcade_error('db_error', 'Something went wrong. Please try again.', 500);
        }
        $check = play50_check_api_key_permission();
        return is_wp_error($check) ? $check : true;
    }
}

if (!function_exists('play50_arcade_auth_user')) {
    /**
     * permission_callback for user routes: API key, Bearer JWT, existing user.
     * @param WP_REST_Request $request
     * @return WP_User|WP_Error
     */
    function play50_arcade_auth_user($request) {
        $api = play50_arcade_check_api_key();
        if (is_wp_error($api)) {
            return $api;
        }
        $user = play50_arcade_request_user($request);
        if (!$user) {
            return play50_arcade_error('unauthorized', 'Please log in again.', 401);
        }
        return $user;
    }
}

// ---------------------------------------------------------------------------
// Rate limits (§8)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_hit')) {
    /** Fixed window on a transient. @return int 0 = allowed, else seconds until the window resets. */
    function play50_arcade_hit($key, $limit, $window) {
        $now = time();
        $t = get_transient($key);
        if (!is_array($t) || !isset($t['count'], $t['reset']) || (int) $t['reset'] <= $now) {
            $t = array('count' => 0, 'reset' => $now + (int) $window);
        }
        if ((int) $t['count'] >= $limit) {
            return max(1, (int) $t['reset'] - $now);
        }
        $t['count'] = (int) $t['count'] + 1;
        set_transient($key, $t, max(1, (int) $t['reset'] - $now));
        return 0;
    }
}

if (!function_exists('play50_arcade_ip_hash')) {
    function play50_arcade_ip_hash() {
        $ip = isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '';
        $ip = (string) apply_filters('play50_arcade_client_ip', $ip); // only for a trusted proxy; never read X-Forwarded-For directly
        return md5($ip . wp_salt());
    }
}

if (!function_exists('play50_arcade_route_is')) {
    /**
     * True when the request route matches $route the way WP_REST_Server matches it:
     * case-insensitive, and without the D modifier, so `$` also matches before a final "\n".
     * $route must be a literal path without regex characters.
     */
    function play50_arcade_route_is($request, $route) {
        if (!($request instanceof WP_REST_Request)) {
            return false;
        }
        return preg_match('@^' . $route . '/?$@i', (string) $request->get_route()) === 1;
    }
}

if (!function_exists('play50_arcade_limit_register')) {
    /** rest_pre_dispatch: 5 sign-ups per hour per hashed IP. The register route itself is not edited. */
    function play50_arcade_limit_register($result, $server, $request) {
        if ($result !== null) {
            return $result;
        }
        if (!($request instanceof WP_REST_Request)) {
            return $result;
        }
        // Same regex semantics as WP's router ('@^' . $route . '$@i', no D modifier), so a route
        // that WP dispatches to the register handler (any case, trailing "\n") is always counted.
        if ($request->get_method() !== 'POST' || !play50_arcade_route_is($request, '/play50/v1/auth/register')) {
            return $result;
        }
        $wait = play50_arcade_hit('p50a_rl_reg_' . play50_arcade_ip_hash(), 5, HOUR_IN_SECONDS);
        if ($wait) {
            return play50_arcade_error('rate_limited', 'Too many sign-ups. Try again later.', 429, array('retry_after' => (int) $wait));
        }
        return $result;
    }
}

// ---------------------------------------------------------------------------
// Names, ranks, cache (§9, §10)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_public_name')) {
    /** "First L.", "Anonymous" or "Player". Never display_name, user_login or email. Public: used by the admin page. */
    function play50_arcade_public_name($uid) {
        $uid = (int) $uid;
        if ($uid <= 0) {
            return 'Player';
        }
        if (get_user_meta($uid, 'play50_arcade_hide_name', true)) {
            return 'Anonymous';
        }
        if (!get_userdata($uid)) {
            return 'Player';
        }

        $first = get_user_meta($uid, 'first_name', true);
        $first = is_scalar($first) ? trim(wp_strip_all_tags((string) $first)) : '';
        $first = trim(mb_substr($first, 0, 20));
        if ($first === '') {
            return 'Player';
        }

        $last = get_user_meta($uid, 'last_name', true);
        $last = is_scalar($last) ? trim(wp_strip_all_tags((string) $last)) : '';
        if ($last === '') {
            return $first;
        }
        $initial = mb_substr($last, 0, 1);
        $initial = function_exists('mb_strtoupper') ? mb_strtoupper($initial) : strtoupper($initial);
        return $first . ' ' . $initial . '.';
    }
}

if (!function_exists('play50_arcade_rank')) {
    /** Competition rank among visible rows (COUNT(*) + 1), or null on a DB error. */
    function play50_arcade_rank($slug, $best_score, $best_at) {
        global $wpdb;
        $table = play50_arcade_table();
        $rank = $wpdb->get_var($wpdb->prepare(
            "SELECT COUNT(*) + 1 FROM {$table}
            WHERE game_slug = %s AND hidden = 0
              AND (best_score > %d OR (best_score = %d AND best_at < %s))",
            $slug,
            (int) $best_score,
            (int) $best_score,
            (string) $best_at
        ));
        if ($rank === null || $wpdb->last_error !== '') {
            return null;
        }
        return (int) $rank;
    }
}

if (!function_exists('play50_arcade_top')) {
    /**
     * Top 50 visible rows for a slug, cached 60 s in p50a_top_{slug}.
     * @return array|WP_Error list of {user_id, rank, name, score, duration_ms, achieved_at}
     */
    function play50_arcade_top($slug) {
        $key = 'p50a_top_' . $slug;
        $cached = get_transient($key);
        if (is_array($cached)) {
            return $cached;
        }

        global $wpdb;
        $table = play50_arcade_table();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT user_id, best_score, best_duration_ms, best_at FROM {$table}
            WHERE game_slug = %s AND hidden = 0
            ORDER BY best_score DESC, best_at ASC, id ASC
            LIMIT 50",
            $slug
        ), ARRAY_A);
        if (!is_array($rows) || $wpdb->last_error !== '') {
            return play50_arcade_db_error('top');
        }

        $user_ids = array();
        foreach ($rows as $row) {
            $user_ids[] = (int) $row['user_id'];
        }
        if (!empty($user_ids) && function_exists('cache_users')) {
            cache_users(array_values(array_unique($user_ids)));
        }

        $list = array();
        $position = 0;
        $prev_score = null;
        $prev_at = null;
        $prev_rank = 0;
        foreach ($rows as $row) {
            $position++;
            $score = (int) $row['best_score'];
            $at = (string) $row['best_at'];
            $rank = ($prev_score !== null && $score === $prev_score && $at === $prev_at) ? $prev_rank : $position;
            $list[] = array(
                'user_id' => (int) $row['user_id'],
                'rank' => $rank,
                'name' => play50_arcade_public_name((int) $row['user_id']),
                'score' => $score,
                'duration_ms' => ($row['best_duration_ms'] === null) ? null : (int) $row['best_duration_ms'],
                'achieved_at' => play50_arcade_iso($at),
            );
            $prev_score = $score;
            $prev_at = $at;
            $prev_rank = $rank;
        }

        set_transient($key, $list, 60);
        return $list;
    }
}

if (!function_exists('play50_arcade_clear_cache')) {
    /** Deletes p50a_top_{slug}, or the cache of every configured slug when $slug is null. Public: used by the admin page. */
    function play50_arcade_clear_cache($slug = null) {
        $slugs = ($slug === null) ? array_keys(play50_arcade_games()) : array((string) $slug);
        foreach ($slugs as $one) {
            delete_transient('p50a_top_' . $one);
        }
    }
}

if (!function_exists('play50_arcade_on_deleted_user')) {
    function play50_arcade_on_deleted_user($user_id) {
        global $wpdb;
        $wpdb->delete(play50_arcade_table(), array('user_id' => (int) $user_id), array('%d'));
        play50_arcade_clear_cache();
    }
}

// ---------------------------------------------------------------------------
// Route callbacks (§6, §7)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_get_games')) {
    /** GET /arcade/games */
    function play50_arcade_get_games($request) {
        // Vary: Origin because rest-api.php reflects the Origin in Access-Control-Allow-Origin.
        return play50_arcade_response(array('games' => (object) play50_arcade_games()), 'public, max-age=300', 'Origin');
    }
}

if (!function_exists('play50_arcade_submit')) {
    /** POST /arcade/scores. Steps follow §7; the first failure returns. */
    function play50_arcade_submit($request) {
        global $wpdb;

        // 1-3. API key, token, user (also the permission_callback; memoized).
        $user = play50_arcade_auth_user($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $uid = (int) $user->ID;

        // 4. Ban.
        if (get_user_meta($uid, 'play50_arcade_banned', true)) {
            return play50_arcade_error('forbidden', 'This account cannot submit arcade scores.', 403);
        }

        $body = play50_arcade_body($request);

        // 5. Slug format.
        $slug = isset($body['slug']) ? $body['slug'] : null;
        if (!play50_arcade_valid_slug($slug)) {
            return play50_arcade_invalid('slug', 'Invalid game.');
        }

        // 6. Known and enabled.
        $game = play50_arcade_game($slug);
        if (!$game) {
            return play50_arcade_not_found();
        }

        // 7. Rate limits: gap -> user -> IP. Runs before body validation on purpose.
        $wait = play50_arcade_hit('p50a_gap_' . $uid . '_' . $slug, 1, 3);
        if (!$wait) {
            $wait = play50_arcade_hit('p50a_rl_u_' . $uid, 10, MINUTE_IN_SECONDS);
        }
        if (!$wait) {
            $wait = play50_arcade_hit('p50a_rl_ip_' . play50_arcade_ip_hash(), 30, 10 * MINUTE_IN_SECONDS);
        }
        if ($wait) {
            return play50_arcade_error('rate_limited', 'Too many scores. Try again in a few seconds.', 429, array('retry_after' => (int) $wait));
        }

        // 8-9. Duration.
        $duration_ms = play50_arcade_int(isset($body['duration_ms']) ? $body['duration_ms'] : null);
        if ($duration_ms === null || $duration_ms < $game['min_duration_ms'] || $duration_ms > $game['max_duration_ms']) {
            return play50_arcade_invalid('duration_ms');
        }

        // 10. Score.
        if ($game['kind'] === 'time') {
            // 10b. Server-computed, the client value is ignored (same as computeTimeScore in scores.ts).
            $score = (int) min($game['max_score'], max(0, intdiv($game['time_base_ms'] - $duration_ms, 10)));
        } else {
            // 10a. Integer, in range, plausible: score <= base + max_pps * duration_ms / 1000.
            $score = play50_arcade_int(isset($body['score']) ? $body['score'] : null);
            if ($score === null || $score > $game['max_score']
                || $score * 1000 > $game['base'] * 1000 + $game['max_pps'] * $duration_ms) {
                return play50_arcade_invalid('score');
            }
        }

        $table = play50_arcade_table();

        // 11. Previous best, then the atomic upsert.
        $previous = $wpdb->get_var($wpdb->prepare(
            "SELECT best_score FROM {$table} WHERE user_id = %d AND game_slug = %s",
            $uid,
            $slug
        ));
        if ($wpdb->last_error !== '') {
            return play50_arcade_db_error('read previous');
        }
        $is_new_best = ($previous === null) || ($score > (int) $previous);

        // best_duration_ms and best_at must be assigned before best_score (left-to-right evaluation).
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
            $uid,
            $slug,
            $score,
            $duration_ms,
            $score,
            $now,
            $now
        );
        if ($wpdb->query($sql) === false) {
            return play50_arcade_db_error('upsert');
        }

        // 12. Read back, rank, clear the slug cache on a new best.
        $row = $wpdb->get_row($wpdb->prepare(
            "SELECT best_score, plays, best_at FROM {$table} WHERE user_id = %d AND game_slug = %s",
            $uid,
            $slug
        ), ARRAY_A);
        if (!is_array($row)) {
            return play50_arcade_db_error('read back');
        }
        $rank = play50_arcade_rank($slug, (int) $row['best_score'], (string) $row['best_at']);
        if ($rank === null) {
            return play50_arcade_db_error('rank');
        }
        if ($is_new_best) {
            play50_arcade_clear_cache($slug);
        }

        return play50_arcade_response(array(
            'success' => true,
            'data' => array(
                'slug' => $slug,
                'score' => $score,
                'best_score' => (int) $row['best_score'],
                'is_new_best' => $is_new_best,
                'plays' => (int) $row['plays'],
                'rank' => $rank,
            ),
        ), 'private, no-store');
    }
}

if (!function_exists('play50_arcade_get_leaderboard')) {
    /** GET /arcade/leaderboard/<slug>?limit=10. JWT optional: invalid or missing -> anonymous. */
    function play50_arcade_get_leaderboard($request) {
        global $wpdb;

        // URL param only: get_param() would let ?slug= in the query string override the path.
        $url_params = $request->get_url_params();
        $slug = isset($url_params['slug']) ? $url_params['slug'] : '';
        $game = play50_arcade_game($slug);
        if (!$game) {
            return play50_arcade_not_found();
        }

        $query = $request->get_query_params();
        $limit = 10;
        if (isset($query['limit']) && is_scalar($query['limit']) && $query['limit'] !== '') {
            $limit = absint($query['limit']);
        }
        $limit = max(1, min(50, $limit));

        $top = play50_arcade_top($slug);
        if (is_wp_error($top)) {
            return $top;
        }

        $user = play50_arcade_request_user($request);
        $uid = $user ? (int) $user->ID : 0;

        $entries = array();
        foreach (array_slice($top, 0, $limit) as $item) {
            $entries[] = array(
                'rank' => (int) $item['rank'],
                'name' => (string) $item['name'],
                'score' => (int) $item['score'],
                'duration_ms' => ($item['duration_ms'] === null) ? null : (int) $item['duration_ms'],
                'achieved_at' => (string) $item['achieved_at'],
                'is_me' => ($uid > 0 && (int) $item['user_id'] === $uid),
            );
        }

        $me = null;
        if ($uid > 0) {
            $table = play50_arcade_table();
            $mine = $wpdb->get_row($wpdb->prepare(
                "SELECT best_score, best_at FROM {$table} WHERE user_id = %d AND game_slug = %s AND hidden = 0",
                $uid,
                $slug
            ), ARRAY_A);
            if ($wpdb->last_error !== '') {
                return play50_arcade_db_error('board me');
            }
            if (is_array($mine)) {
                $my_rank = play50_arcade_rank($slug, (int) $mine['best_score'], (string) $mine['best_at']);
                if ($my_rank === null) {
                    return play50_arcade_db_error('board me rank');
                }
                $me = array('rank' => $my_rank, 'best_score' => (int) $mine['best_score']);
            }
        }

        // Personalized whenever a user was resolved, whatever header source the token came from.
        $cache_control = ($uid > 0 || play50_arcade_has_auth_header($request)) ? 'private, no-store' : 'public, max-age=30';
        return play50_arcade_response(array(
            'slug' => $slug,
            'entries' => $entries,
            'me' => $me,
        ), $cache_control, 'Authorization, Origin');
    }
}

if (!function_exists('play50_arcade_get_me')) {
    /** GET /arcade/me: object keyed by slug, no other top-level keys. */
    function play50_arcade_get_me($request) {
        global $wpdb;

        $user = play50_arcade_auth_user($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $uid = (int) $user->ID;

        $table = play50_arcade_table();
        $rows = $wpdb->get_results($wpdb->prepare(
            "SELECT game_slug, best_score, best_duration_ms, plays, hidden, best_at, last_played FROM {$table}
            WHERE user_id = %d
            ORDER BY game_slug ASC",
            $uid
        ), ARRAY_A);
        if (!is_array($rows) || $wpdb->last_error !== '') {
            return play50_arcade_db_error('me');
        }

        $games = play50_arcade_games();
        $out = array();
        foreach ($rows as $row) {
            $slug = (string) $row['game_slug'];
            if (!isset($games[$slug])) {
                continue;
            }
            // null only for hidden (banned) rows; a failed rank query is db_error, never a silent null.
            $rank = null;
            if ((int) $row['hidden'] === 0) {
                $rank = play50_arcade_rank($slug, (int) $row['best_score'], (string) $row['best_at']);
                if ($rank === null) {
                    return play50_arcade_db_error('me rank');
                }
            }
            $out[$slug] = array(
                'best' => (int) $row['best_score'],
                'best_duration_ms' => ($row['best_duration_ms'] === null) ? null : (int) $row['best_duration_ms'],
                'plays' => (int) $row['plays'],
                'last_played' => play50_arcade_iso((string) $row['last_played']),
                'rank' => $rank,
            );
        }

        // An empty result stays a PHP array here so WP core's _fields/_embed handling never sees a
        // top-level stdClass (PHP 8 TypeError); play50_arcade_empty_me_object() turns [] into {} on output.
        return play50_arcade_response($out, 'private, no-store');
    }
}

if (!function_exists('play50_arcade_empty_me_object')) {
    /** rest_pre_echo_response: GET /arcade/me with no rows is {} (not []). */
    function play50_arcade_empty_me_object($result, $server, $request) {
        if ($result === array() && play50_arcade_route_is($request, '/play50/v1/arcade/me')) {
            return new stdClass();
        }
        return $result;
    }
}

if (!function_exists('play50_arcade_get_privacy')) {
    /** GET /arcade/me/privacy */
    function play50_arcade_get_privacy($request) {
        $user = play50_arcade_auth_user($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $hidden = (bool) get_user_meta((int) $user->ID, 'play50_arcade_hide_name', true);
        return play50_arcade_response(array('hide_name' => $hidden), 'private, no-store');
    }
}

if (!function_exists('play50_arcade_set_privacy')) {
    /** POST /arcade/me/privacy {"hide_name": bool} */
    function play50_arcade_set_privacy($request) {
        $user = play50_arcade_auth_user($request);
        if (is_wp_error($user)) {
            return $user;
        }
        $uid = (int) $user->ID;

        // Every write path is throttled: this one clears every leaderboard cache.
        $wait = play50_arcade_hit('p50a_rl_priv_' . $uid, 10, MINUTE_IN_SECONDS);
        if ($wait) {
            return play50_arcade_error('rate_limited', 'Too many requests. Try again later.', 429, array('retry_after' => (int) $wait));
        }

        $body = play50_arcade_body($request);
        $hide = array_key_exists('hide_name', $body) ? play50_arcade_bool($body['hide_name']) : null;
        if ($hide === null) {
            return play50_arcade_invalid('hide_name', 'Invalid privacy setting.');
        }

        // No change: no write and no cache clear.
        if ((bool) get_user_meta($uid, 'play50_arcade_hide_name', true) === $hide) {
            return play50_arcade_response(array('hide_name' => $hide), 'private, no-store');
        }

        if ($hide) {
            update_user_meta($uid, 'play50_arcade_hide_name', 1);
        } else {
            delete_user_meta($uid, 'play50_arcade_hide_name');
        }
        play50_arcade_clear_cache();

        return play50_arcade_response(array('hide_name' => $hide), 'private, no-store');
    }
}

// ---------------------------------------------------------------------------
// Routes + hooks (§11)
// ---------------------------------------------------------------------------

if (!function_exists('play50_arcade_register_routes')) {
    function play50_arcade_register_routes() {
        if (!function_exists('play50_check_api_key_permission') || !function_exists('play50_get_user_id_from_jwt')) {
            error_log('play50 arcade: rest-api.php helpers missing, arcade routes not registered');
            return;
        }

        register_rest_route('play50/v1', '/arcade/games', array(
            'methods' => 'GET',
            'callback' => 'play50_arcade_get_games',
            'permission_callback' => 'play50_arcade_check_api_key',
        ));

        register_rest_route('play50/v1', '/arcade/scores', array(
            'methods' => 'POST',
            'callback' => 'play50_arcade_submit',
            'permission_callback' => 'play50_arcade_auth_user',
        ));

        register_rest_route('play50/v1', '/arcade/leaderboard/(?P<slug>[a-z0-9-]{1,40})', array(
            'methods' => 'GET',
            'callback' => 'play50_arcade_get_leaderboard',
            'permission_callback' => 'play50_arcade_check_api_key',
        ));

        register_rest_route('play50/v1', '/arcade/me', array(
            'methods' => 'GET',
            'callback' => 'play50_arcade_get_me',
            'permission_callback' => 'play50_arcade_auth_user',
        ));

        register_rest_route('play50/v1', '/arcade/me/privacy', array(
            array(
                'methods' => 'GET',
                'callback' => 'play50_arcade_get_privacy',
                'permission_callback' => 'play50_arcade_auth_user',
            ),
            array(
                'methods' => 'POST',
                'callback' => 'play50_arcade_set_privacy',
                'permission_callback' => 'play50_arcade_auth_user',
            ),
        ));
    }
}

add_action('after_switch_theme', 'play50_arcade_install');
add_action('init', 'play50_arcade_maybe_install');
add_action('rest_api_init', 'play50_arcade_register_routes');
add_filter('rest_pre_dispatch', 'play50_arcade_limit_register', 10, 3);
add_filter('rest_pre_echo_response', 'play50_arcade_empty_me_object', 10, 3);
add_action('deleted_user', 'play50_arcade_on_deleted_user');
