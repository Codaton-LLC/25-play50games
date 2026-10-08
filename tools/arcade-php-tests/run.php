<?php
/**
 * Pure-PHP harness for the arcade run tokens (docs/run-tokens.md §9). No WordPress, no database,
 * no network: it loads includes/arcade-api.php with stubs and a scripted fake $wpdb, and drives the
 * real route callbacks. Run with the PHP CLI from the repo root:
 *
 *   php tools/arcade-php-tests/run.php
 *
 * Exit code = number of failed checks. Synthetic users and JWTs only; never point this at a site.
 */

error_reporting(E_ALL);
ini_set('display_errors', '1');

$constant_mode = isset($argv[1]) ? $argv[1] : '';

define('ABSPATH', __DIR__ . '/');
define('MINUTE_IN_SECONDS', 60);
define('HOUR_IN_SECONDS', 3600);
define('ARRAY_A', 'ARRAY_A');
if ($constant_mode === 'constant-on') {
    define('PLAY50_ARCADE_REQUIRE_RUN_TOKEN', true);
} elseif ($constant_mode === 'constant-off') {
    define('PLAY50_ARCADE_REQUIRE_RUN_TOKEN', false);
}

$log_file = tempnam(sys_get_temp_dir(), 'p50a-log');
ini_set('log_errors', '1');
ini_set('error_log', $log_file);

// ---------------------------------------------------------------- WordPress stubs

class WP_Error {
    public $code;
    public $message;
    public $data;
    public function __construct($code = '', $message = '', $data = null) {
        $this->code = $code;
        $this->message = $message;
        $this->data = $data;
    }
    public function get_error_code() { return $this->code; }
    public function get_error_data() { return $this->data; }
}

class WP_REST_Response {
    public $data;
    public $status;
    public $headers = array();
    public function __construct($data = null, $status = 200) {
        $this->data = $data;
        $this->status = $status;
    }
    public function header($name, $value) { $this->headers[$name] = $value; }
}

class WP_REST_Request {
    private $method;
    private $route;
    private $body;
    public function __construct($method, $route, $body = array()) {
        $this->method = $method;
        $this->route = $route;
        $this->body = $body;
    }
    public function get_json_params() { return $this->body; }
    public function get_body() { return json_encode($this->body); }
    public function get_header($name) { return null; }
    public function get_route() { return $this->route; }
    public function get_method() { return $this->method; }
    public function get_url_params() { return array(); }
    public function get_query_params() { return array(); }
}

class WP_User {
    public $ID;
    public function __construct($id) { $this->ID = $id; }
    public function exists() { return $this->ID > 0; }
}

$GLOBALS['t_options'] = array();
$GLOBALS['t_transients'] = array();
$GLOBALS['t_user_meta'] = array();
$GLOBALS['t_filters'] = array();
$GLOBALS['t_routes'] = array();
$GLOBALS['t_jwt'] = '';
$GLOBALS['t_now_ms'] = 1791000000000;
$GLOBALS['t_salt'] = 'test-salt-not-a-secret';

function add_action($hook, $cb, $priority = 10, $args = 1) {}
function add_filter($hook, $cb, $priority = 10, $args = 1) { $GLOBALS['t_filters'][$hook][] = $cb; }
function apply_filters($hook, $value) {
    if (!empty($GLOBALS['t_filters'][$hook])) {
        foreach ($GLOBALS['t_filters'][$hook] as $cb) {
            $value = call_user_func($cb, $value);
        }
    }
    return $value;
}
function get_option($name, $default = false) {
    return array_key_exists($name, $GLOBALS['t_options']) ? $GLOBALS['t_options'][$name] : $default;
}
function update_option($name, $value, $autoload = null) { $GLOBALS['t_options'][$name] = $value; return true; }
function get_transient($key) { return isset($GLOBALS['t_transients'][$key]) ? $GLOBALS['t_transients'][$key] : false; }
function set_transient($key, $value, $ttl) { $GLOBALS['t_transients'][$key] = $value; return true; }
function delete_transient($key) { unset($GLOBALS['t_transients'][$key]); return true; }
function get_user_meta($uid, $key, $single = false) {
    return isset($GLOBALS['t_user_meta'][$uid][$key]) ? $GLOBALS['t_user_meta'][$uid][$key] : '';
}
function update_user_meta($uid, $key, $value) { $GLOBALS['t_user_meta'][$uid][$key] = $value; }
function delete_user_meta($uid, $key) { unset($GLOBALS['t_user_meta'][$uid][$key]); }
function get_userdata($uid) { return ($uid > 0 && $uid < 1000) ? new WP_User($uid) : false; }
function wp_salt($scheme = 'auth') { return $GLOBALS['t_salt'] . '|' . $scheme; }
function is_wp_error($thing) { return $thing instanceof WP_Error; }
function absint($v) { return abs((int) $v); }
function wp_strip_all_tags($s) { return strip_tags($s); }
function cache_users($ids) {}
function register_rest_route($ns, $route, $args) { $GLOBALS['t_routes'][$ns . $route] = $args; }

// rest-api.php helpers (never loaded here): JWT "jwt-u<id>" belongs to user <id>.
function play50_check_api_key_permission() { return true; }
function play50_get_jwt_from_header() { return $GLOBALS['t_jwt']; }
function play50_get_user_id_from_jwt($token) {
    return preg_match('/^jwt-u([0-9]+)$/', (string) $token, $m) === 1 ? (int) $m[1] : 0;
}

// Clock seam (arcade-api.php defines it only when missing).
function play50_arcade_now_ms() { return $GLOBALS['t_now_ms']; }

/** Scripted $wpdb: records every statement, keeps scores and claims in arrays, injects failures. */
class Fake_WPDB {
    public $prefix = 'wp_';
    public $last_error = '';
    public $log = array();
    public $created = array();
    public $tables = array();
    public $fail_create = array();
    public $scores = array();
    public $claims = array();
    public $fail_claim = false;
    public $fail_upsert = false;
    /** the claim answers 0 once, as after a "server has gone away" re-run of an applied INSERT */
    public $claim_rerun = false;

    public function get_charset_collate() { return 'DEFAULT CHARSET=utf8mb4'; }
    public function esc_like($s) { return addcslashes($s, '_%\\'); }
    public function prepare($query, ...$args) {
        if (count($args) === 1 && is_array($args[0])) {
            $args = $args[0];
        }
        $i = 0;
        return preg_replace_callback('/%[sd]/', function ($m) use (&$i, $args) {
            $v = $args[$i++];
            return $m[0] === '%d' ? (string) (int) $v : "'" . addslashes((string) $v) . "'";
        }, $query);
    }
    public function query($sql) {
        $this->log[] = $sql;
        $this->last_error = '';
        if (strpos($sql, 'INSERT IGNORE INTO wp_play50_arcade_runs') !== false) {
            if ($this->fail_claim) {
                $this->last_error = 'scripted claim failure';
                return false;
            }
            preg_match("/VALUES \('([0-9a-f]{32})', ([0-9]+), '([^']*)', ([0-9]+), ([0-9]+), ([0-9]+)\)/", $sql, $m);
            if ($this->claim_rerun) {
                $this->claim_rerun = false;
                $this->claims[$m[1]] = array('user_id' => (int) $m[2], 'game_slug' => $m[3], 'expires_ms' => (int) $m[5]);
                return 0;
            }
            if (isset($this->claims[$m[1]])) {
                return 0;
            }
            $this->claims[$m[1]] = array('user_id' => (int) $m[2], 'game_slug' => $m[3], 'expires_ms' => (int) $m[5]);
            return 1;
        }
        if (strpos($sql, 'INSERT INTO wp_play50_arcade_scores') !== false) {
            if ($this->fail_upsert) {
                $this->last_error = 'scripted upsert failure';
                return false;
            }
            preg_match("/VALUES \(([0-9]+), '([^']*)', ([0-9]+), ([0-9]+)/", $sql, $m);
            $key = $m[1] . '|' . $m[2];
            $score = (int) $m[3];
            if (!isset($this->scores[$key])) {
                $this->scores[$key] = array('best_score' => $score, 'plays' => 1, 'best_at' => '2026-10-08 10:00:00');
                return 1;
            }
            $this->scores[$key]['best_score'] = max($this->scores[$key]['best_score'], $score);
            $this->scores[$key]['plays']++;
            return 2;
        }
        if (preg_match('/DELETE FROM wp_play50_arcade_runs WHERE expires_ms <= ([0-9]+) LIMIT 1000/', $sql, $m) === 1) {
            $n = 0;
            foreach ($this->claims as $nonce => $row) {
                if ($row['expires_ms'] <= (int) $m[1] && $n < 1000) {
                    unset($this->claims[$nonce]);
                    $n++;
                }
            }
            return $n;
        }
        return 0;
    }
    public function get_var($sql) {
        $this->last_error = ''; // real wpdb::query() flushes the previous error
        $this->log[] = $sql;
        if (preg_match("/SHOW TABLES LIKE '([^']*)'/", $sql, $m) === 1) {
            $name = stripslashes(stripslashes($m[1])); // prepare() escaped esc_like()'s backslashes
            return isset($this->tables[$name]) ? $name : null;
        }
        if (preg_match("/SELECT best_score FROM wp_play50_arcade_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2];
            return isset($this->scores[$key]) ? (string) $this->scores[$key]['best_score'] : null;
        }
        if (strpos($sql, 'COUNT(*) + 1') !== false) {
            return '1';
        }
        return null;
    }
    public function get_row($sql, $output = null) {
        $this->last_error = '';
        $this->log[] = $sql;
        if (preg_match("/FROM wp_play50_arcade_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2];
            return isset($this->scores[$key]) ? $this->scores[$key] : null;
        }
        return null;
    }
    public function get_results($sql, $output = null) { $this->log[] = $sql; $this->last_error = ''; return array(); }
    public function delete($table, $where, $format = null) {
        $this->log[] = 'DELETE ' . $table . ' ' . json_encode($where);
        if ($table === 'wp_play50_arcade_runs') {
            foreach ($this->claims as $nonce => $row) {
                if ($row['user_id'] === (int) $where['user_id']) {
                    unset($this->claims[$nonce]);
                }
            }
        }
        return 1;
    }
}

$GLOBALS['wpdb'] = new Fake_WPDB();

// A disabled game for the 404 cases, added before the loader's static cache fills.
add_filter('play50_arcade_games', function ($games) {
    $games['test-off'] = $games['robot-collector'];
    $games['test-off']['enabled'] = false;
    return $games;
});

require dirname(__DIR__, 2) . '/play50games-backend/play50games/includes/arcade-api.php';

// ---------------------------------------------------------------- tiny test kit

$pass = 0;
$fail = 0;
function ok($cond, $name) {
    global $pass, $fail;
    if ($cond) {
        $pass++;
    } else {
        $fail++;
        fwrite(STDERR, "FAIL $name\n");
    }
}
function code_of($r) { return ($r instanceof WP_Error) ? $r->code : 'ok'; }
function reason_of($r) { return ($r instanceof WP_Error && isset($r->data['reason'])) ? $r->data['reason'] : null; }
function status_of($r) { return ($r instanceof WP_Error) ? $r->data['status'] : $r->status; }
function as_user($uid) { $GLOBALS['t_jwt'] = $uid ? 'jwt-u' . $uid : ''; }
function fresh_limits() { $GLOBALS['t_transients'] = array(); }
function start($slug, $uid = 7) {
    as_user($uid);
    return play50_arcade_start_run(new WP_REST_Request('POST', '/play50/v1/arcade/runs/start', array('slug' => $slug)));
}
function mint($slug = 'robot-collector', $uid = 7) {
    fresh_limits();
    $r = start($slug, $uid);
    return ($r instanceof WP_REST_Response) ? $r->data['run_token'] : null;
}
function submit($body, $uid = 7) {
    fresh_limits(); // isolate the token logic from the 3 s gap; the rate tests below use real counters
    as_user($uid);
    return play50_arcade_submit(new WP_REST_Request('POST', '/play50/v1/arcade/scores', $body));
}
function sub($token, $duration = 30000, $slug = 'robot-collector', $uid = 7, $score = 100) {
    $body = array('slug' => $slug, 'score' => $score, 'duration_ms' => $duration);
    if ($token !== '__absent__') {
        $body['run_token'] = $token;
    }
    return submit($body, $uid);
}
function advance($ms) { $GLOBALS['t_now_ms'] += $ms; }
function log_text() { global $log_file; return (string) file_get_contents($log_file); }
function log_count($needle) { return substr_count(log_text(), $needle); }
function plays($uid = 7, $slug = 'robot-collector') {
    global $wpdb;
    $key = $uid . '|' . $slug;
    return isset($wpdb->scores[$key]) ? $wpdb->scores[$key]['plays'] : 0;
}

// ---------------------------------------------------------------- constant-only scenarios

if ($constant_mode !== '') {
    play50_arcade_install();
    $GLOBALS['t_options']['play50_arcade_require_run_token'] = ($constant_mode === 'constant-off') ? '1' : '0';
    $r = sub('__absent__');
    if ($constant_mode === 'constant-on') {
        ok(code_of($r) === 'invalid_data' && reason_of($r) === 'required', 'constant true wins over option off');
    } else {
        ok(code_of($r) === 'ok', 'constant false wins over option on');
    }
    echo "$constant_mode: passed $pass, failed $fail\n";
    exit($fail);
}

// ---------------------------------------------------------------- 1. install and readiness

ok(play50_arcade_run_tokens_ready() === false, 'not ready before install');
$wpdb->fail_create['wp_play50_arcade_runs'] = true;
play50_arcade_install();
ok(get_option('play50_arcade_db_version') === false, 'version not recorded when the runs table is missing');
ok(get_transient('p50a_install_failed') === 1, 'failed install sets the retry guard');

// not ready: start refuses, OFF submit with a ticket-shaped value takes the legacy path
fresh_limits();
$r = start('robot-collector');
ok(code_of($r) === 'db_error' && status_of($r) === 500, 'start: not ready -> 500 db_error');
$shaped = 'r1.1791000000000.1791000362000.' . str_repeat('a', 32) . '.' . str_repeat('b', 64);
$before = count($wpdb->log);
$r = sub($shaped);
ok(code_of($r) === 'ok', 'OFF + not ready + ticket -> legacy accept');
$runs_queries = 0;
foreach (array_slice($wpdb->log, $before) as $sql) {
    if (strpos($sql, 'play50_arcade_runs') !== false) {
        $runs_queries++;
    }
}
ok($runs_queries === 0, 'OFF + not ready: no runs-table query');
ok(log_count('run_token not-ready robot-collector') === 1, 'not-ready log line');
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';
$r = sub($shaped);
ok(code_of($r) === 'db_error', 'ON + not ready + ticket -> db_error');
$r = sub('__absent__');
ok(reason_of($r) === 'required', 'ON + not ready + no ticket -> required');
unset($GLOBALS['t_options']['play50_arcade_require_run_token']);

unset($wpdb->fail_create['wp_play50_arcade_runs']);
delete_transient('p50a_install_failed');
play50_arcade_maybe_install();
ok(get_option('play50_arcade_db_version') === '2', 'install records DB version 2');
ok(isset($wpdb->tables['wp_play50_arcade_scores'], $wpdb->tables['wp_play50_arcade_runs']), 'both tables created');
ok(play50_arcade_run_tokens_ready() === true, 'ready after install');
ok(isset($GLOBALS['t_routes']['play50/v1/arcade/runs/start']) === false, 'routes not registered before rest_api_init');
play50_arcade_register_routes();
$route = $GLOBALS['t_routes']['play50/v1/arcade/runs/start'];
ok($route['methods'] === 'POST' && $route['permission_callback'] === 'play50_arcade_auth_user', 'start route: POST, JWT permission');

// ---------------------------------------------------------------- 2. start

fresh_limits();
$r = start('robot-collector');
ok($r instanceof WP_REST_Response && $r->status === 200, 'start: 200');
ok(array_keys($r->data) === array('run_token'), 'start: body is exactly {run_token}');
ok($r->headers['Cache-Control'] === 'private, no-store', 'start: private, no-store');
ok(preg_match('/^r1\.[0-9]{13}\.[0-9]{13}\.[0-9a-f]{32}\.[0-9a-f]{64}$/D', $r->data['run_token']) === 1, 'start: ticket format');
$p = play50_arcade_run_token_parse($r->data['run_token']);
ok($p['issued_ms'] === $GLOBALS['t_now_ms'] && $p['expires_ms'] === $GLOBALS['t_now_ms'] + 62000 + 300000, 'start: expiry = max_duration + 300 s');
ok(mint() !== mint(), 'start: two tickets differ');
ok(count($wpdb->claims) === 0, 'start stores nothing');

fresh_limits();
ok(code_of(start('robot-collector', 0)) === 'unauthorized', 'start: no JWT -> 401');
$GLOBALS['t_jwt'] = 'forged';
ok(code_of(play50_arcade_start_run(new WP_REST_Request('POST', '/x', array('slug' => 'robot-collector')))) === 'unauthorized', 'start: forged JWT -> 401');
ok(code_of(start('robot-collector', 5000)) === 'unauthorized', 'start: deleted user -> 401');
$GLOBALS['t_user_meta'][9]['play50_arcade_banned'] = 1;
ok(code_of(start('robot-collector', 9)) === 'forbidden', 'start: banned -> 403');
ok(code_of(start('Robot!')) === 'invalid_data', 'start: bad slug -> 400');
ok(code_of(start('no-such-game')) === 'not_found', 'start: unknown game -> 404');
ok(code_of(start('test-off')) === 'not_found', 'start: disabled game -> 404');
as_user(7);
ok(code_of(play50_arcade_start_run(new WP_REST_Request('POST', '/x', array()))) === 'invalid_data', 'start: no slug -> 400');

// rate limits: 30 per minute per user, then 429 with an integer retry_after; a quick second start is fine
fresh_limits();
$codes = array();
for ($i = 1; $i <= 31; $i++) {
    $codes[] = code_of(start('robot-collector'));
}
ok(count(array_filter(array_slice($codes, 0, 30), function ($c) { return $c === 'ok'; })) === 30, 'start: 30 per minute pass');
$r = start('robot-collector');
ok(code_of($r) === 'rate_limited' && is_int($r->data['retry_after']) && $r->data['retry_after'] >= 1, 'start: #31 -> 429 + retry_after');
ok(code_of(start('robot-collector', 8)) === 'ok', 'start: another user is not limited by the first');
// per IP: 120 per 10 minutes across users
fresh_limits();
$ok_count = 0;
for ($u = 1; $u <= 5; $u++) {
    for ($i = 0; $i < 25; $i++) {
        if (code_of(start('robot-collector', $u)) === 'ok') {
            $ok_count++;
        }
    }
}
ok($ok_count === 120, 'start: 120 per 10 minutes per IP');

// ---------------------------------------------------------------- 3. submit: the happy path and replay

// Sections 3-6 run with enforcement ON, where every ticket failure rejects. Section 7b checks that
// the same failures fall back to the legacy path while enforcement is OFF.
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';

$t = mint();
advance(30000);
$before = count($wpdb->log);
$r = sub($t, 30000);
ok(code_of($r) === 'ok' && $r->data['success'] === true, 'submit: aged ticket -> 200');
ok(array_keys($r->data['data']) === array('slug', 'score', 'best_score', 'is_new_best', 'plays', 'rank'), 'submit: unchanged success body');
$claim_at = $upsert_at = -1;
foreach (array_slice($wpdb->log, $before) as $i => $sql) {
    if (strpos($sql, 'INSERT IGNORE INTO wp_play50_arcade_runs') !== false) {
        $claim_at = $i;
    }
    if (strpos($sql, 'INSERT INTO wp_play50_arcade_scores') !== false) {
        $upsert_at = $i;
    }
}
ok($claim_at >= 0 && $upsert_at > $claim_at, 'submit: claim runs before the upsert');
$plays = plays();
advance(3200);
$r = sub($t, 30000);
ok(code_of($r) === 'invalid_data' && reason_of($r) === 'used' && status_of($r) === 400, 'replay -> 400 used');
ok(plays() === $plays, 'replay adds no play');
ok($r->data['field'] === 'run_token', 'replay: field run_token');

// ---------------------------------------------------------------- 4. binding, format, tampering

$t = mint('robot-collector', 7);
advance(30000);
ok(reason_of(sub($t, 30000, 'food-catcher', 7, 100)) === 'signature', 'wrong slug -> signature');
ok(reason_of(sub($t, 30000, 'robot-collector', 8)) === 'signature', 'another user -> signature');
$p = play50_arcade_run_token_parse($t);
$tampered = 'r1.' . ($p['issued_ms'] - 600000) . '.' . $p['expires_ms'] . '.' . $p['nonce'] . '.' . $p['sig'];
ok(reason_of(sub($tampered, 30000)) === 'signature', 'backdated issued_ms -> signature');
$tampered = 'r1.' . $p['issued_ms'] . '.' . ($p['expires_ms'] + 3600000) . '.' . $p['nonce'] . '.' . $p['sig'];
ok(reason_of(sub($tampered, 30000)) === 'signature', 'extended expiry -> signature');
$tampered = 'r1.' . $p['issued_ms'] . '.' . $p['expires_ms'] . '.' . str_repeat('0', 32) . '.' . $p['sig'];
ok(reason_of(sub($tampered, 30000)) === 'signature', 'swapped nonce -> signature');
ok(reason_of(sub(strtoupper($t), 30000)) === 'malformed', 'uppercase -> malformed');
ok(reason_of(sub(substr($t, 0, -1), 30000)) === 'malformed', 'short signature -> malformed');
ok(reason_of(sub($t . 'a', 30000)) === 'malformed', 'long signature -> malformed');
ok(reason_of(sub($t . "\n", 30000)) === 'malformed', 'trailing newline -> malformed');
ok(reason_of(sub('', 30000)) === 'malformed', 'empty string -> malformed');
ok(reason_of(sub(array($t), 30000)) === 'malformed', 'array -> malformed');
ok(reason_of(sub(12345, 30000)) === 'malformed', 'number -> malformed');
ok(reason_of(sub(str_repeat('a', 32), 30000)) === 'malformed', 'design-style 32 hex -> malformed');
ok(reason_of(sub(null, 30000)) === 'required', 'null run_token = tokenless (enforcement on: required)');
// none of the rejections above touched the ticket: it still submits once
advance(3200);
ok(code_of(sub($t, 30000)) === 'ok', 'rejections write nothing: the ticket still works');

// another key (salt rotation) invalidates tickets in flight
$t = mint();
advance(30000);
$p = play50_arcade_run_token_parse($t);
$other_key = hash_hmac('sha256', 'play50 arcade run token v1', 'another-salt|auth', true);
$other_sig = hash_hmac('sha256', 'r1|7|robot-collector|' . $p['issued_ms'] . '|' . $p['expires_ms'] . '|' . $p['nonce'], $other_key);
ok(reason_of(sub('r1.' . $p['issued_ms'] . '.' . $p['expires_ms'] . '.' . $p['nonce'] . '.' . $other_sig, 30000)) === 'signature', 'other key -> signature');

// ---------------------------------------------------------------- 5. elapsed and expiry

$t = mint();
advance(20000);
$r = sub($t, 21001);
ok(reason_of($r) === 'elapsed' && $r->data['field'] === 'duration_ms', 'age + 1001 -> elapsed (field duration_ms)');
ok(code_of(sub($t, 21000)) === 'ok', 'age + 1000 -> accepted (and the elapsed reject left it usable)');

$t = mint();
advance(-5000); // server clock steps back
ok(reason_of(sub($t, 12500)) === 'elapsed', 'backward clock step -> elapsed');
advance(5000);

$t = mint();
$p = play50_arcade_run_token_parse($t);
$GLOBALS['t_now_ms'] = $p['expires_ms'] - 1;
ok(code_of(sub($t, 30000)) === 'ok', 'expiry - 1 ms -> accepted');
$t = mint();
$p = play50_arcade_run_token_parse($t);
$GLOBALS['t_now_ms'] = $p['expires_ms'];
ok(reason_of(sub($t, 30000)) === 'expired', 'exact expiry -> expired');
$GLOBALS['t_now_ms'] = $p['expires_ms'] + 1;
ok(reason_of(sub($t, 30000)) === 'expired', 'expiry + 1 ms -> expired');

// an expired ticket stays expired after cleanup removed its claim row (no replay window)
$t = mint();
advance(30000);
ok(code_of(sub($t, 30000)) === 'ok', 'gc fixture: claimed');
$p = play50_arcade_run_token_parse($t);
$GLOBALS['t_now_ms'] = $p['expires_ms'] + 1;
delete_transient('p50a_runs_gc');
play50_arcade_runs_gc(play50_arcade_now_ms());
ok(!isset($wpdb->claims[$p['nonce']]), 'gc deletes the expired claim');
ok(reason_of(sub($t, 30000)) === 'expired', 'after gc the ticket is still refused (expired)');

// ---------------------------------------------------------------- 6. score checks run first; failures

$t = mint();
advance(30000);
ok(code_of(sub($t, 30000, 'robot-collector', 7, 99999)) === 'invalid_data' && reason_of(sub($t, 30000, 'robot-collector', 7, 99999)) === null, 'bad score rejected before the token step');
ok(code_of(sub($t, 100)) === 'invalid_data', 'bad duration rejected before the token step');
ok(code_of(sub($t, 30000)) === 'ok', 'score/duration rejects leave the ticket unused');

$t = mint();
advance(30000);
$wpdb->fail_claim = true;
$plays = plays();
$r = sub($t, 30000);
ok(code_of($r) === 'db_error' && status_of($r) === 500, 'claim failure -> db_error');
ok(plays() === $plays, 'claim failure: no upsert');
$wpdb->fail_claim = false;

$t = mint();
advance(30000);
$wpdb->fail_upsert = true;
$before = count($wpdb->log);
$r = sub($t, 30000);
ok(code_of($r) === 'db_error', 'upsert failure after the claim -> db_error');
$unclaim = 0;
foreach (array_slice($wpdb->log, $before) as $sql) {
    if (stripos($sql, 'DELETE') !== false || stripos($sql, 'UPDATE wp_play50_arcade_runs') !== false) {
        $unclaim++;
    }
}
ok($unclaim === 0, 'upsert failure: the claim is never undone');
$wpdb->fail_upsert = false;
advance(3200);
ok(reason_of(sub($t, 30000)) === 'used', 'upsert failure: the ticket is burned, not reusable');

$t = mint();
advance(30000);
$wpdb->claim_rerun = true;
$plays = plays();
ok(reason_of(sub($t, 30000)) === 'used', 'reconnect re-run of an applied claim -> used, fails safe');
ok(plays() === $plays, 'reconnect re-run: no upsert');

$all = implode("\n", $wpdb->log);
ok(preg_match('/START TRANSACTION|FOR UPDATE|COMMIT|ROLLBACK/i', $all) !== 1, 'no transaction or locking read anywhere');

// ---------------------------------------------------------------- 7. enforcement switch

unset($GLOBALS['t_options']['play50_arcade_require_run_token']);

$before_log = log_count('run_token tokenless robot-collector');
$r = sub('__absent__');
ok(code_of($r) === 'ok', 'OFF: tokenless (old client) accepted');
ok(log_count('run_token tokenless robot-collector') === $before_log + 1, 'OFF: tokenless log line');
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';
$r = sub('__absent__');
ok(code_of($r) === 'invalid_data' && reason_of($r) === 'required' && status_of($r) === 400 && $r->data['field'] === 'run_token', 'ON: tokenless -> 400 required');
$t = mint();
advance(30000);
ok(code_of(sub($t, 30000)) === 'ok', 'ON: valid ticket -> 200');
$GLOBALS['t_options']['play50_arcade_require_run_token'] = 'yes-typo';
ok(code_of(sub('__absent__')) === 'ok', 'option: an unrecognized value stays OFF (only true/1/"1"/"true" turn it on)');
$GLOBALS['t_options']['play50_arcade_require_run_token'] = true;
ok(reason_of(sub('__absent__')) === 'required', 'option true -> ON');
unset($GLOBALS['t_options']['play50_arcade_require_run_token']);

$g = play50_arcade_get_games(null);
ok($g->data['run_tokens'] === array('mode' => 'optional', 'ready' => true), 'games: run_tokens mode/ready');
ok(isset($g->data['games']->{'robot-collector'}), 'games: shape kept');
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';
ok(play50_arcade_get_games(null)->data['run_tokens']['mode'] === 'required', 'games: shows required');
unset($GLOBALS['t_options']['play50_arcade_require_run_token']);

// rejections are never unauthorized/forbidden (those drop the JWT or report a ban)
foreach (array('used', 'signature', 'expired', 'elapsed', 'malformed', 'required') as $reason) {
    $e = play50_arcade_run_token_reject($reason, 'robot-collector');
    ok($e->code === 'invalid_data' && $e->data['status'] === 400 && $e->data['reason'] === $reason, "reject $reason: invalid_data 400");
}
// ---------------------------------------------------------------- 7b. enforcement OFF: ticket failures fall back

/** Builds a failing ticket for $reason, submits it, returns the response (the fixture is reset after). */
function failing_submit($reason) {
    global $wpdb;
    switch ($reason) {
        case 'malformed':
            return sub('r1.not-a-ticket', 30000);
        case 'signature':
            $t = mint('food-catcher');
            advance(30000);
            return sub($t, 30000);
        case 'expired':
            $t = mint();
            $p = play50_arcade_run_token_parse($t);
            $GLOBALS['t_now_ms'] = $p['expires_ms'];
            return sub($t, 30000);
        case 'elapsed':
            $t = mint();
            advance(5000);
            return sub($t, 30000);
        case 'used':
            $t = mint();
            advance(30000);
            $first = sub($t, 30000);
            ok(code_of($first) === 'ok', 'used fixture: the first submit is accepted');
            advance(3200);
            return sub($t, 30000);
        case 'claim-error':
            $t = mint();
            advance(30000);
            $wpdb->fail_claim = true;
            $r = sub($t, 30000);
            $wpdb->fail_claim = false;
            return $r;
    }
    return null;
}

unset($GLOBALS['t_options']['play50_arcade_require_run_token']);
foreach (array('malformed', 'signature', 'expired', 'elapsed', 'used', 'claim-error') as $reason) {
    $line = 'play50 arcade: run_token ' . $reason . ' robot-collector (optional, accepted)';
    $logged = log_count($line);
    $plays_before = plays();
    $r = failing_submit($reason);
    // 'used' adds the fixture's own first play as well
    $expected_plays = $plays_before + ($reason === 'used' ? 2 : 1);
    ok(code_of($r) === 'ok' && $r->data['success'] === true, "OFF: $reason ticket -> accepted on the legacy path");
    ok(plays() === $expected_plays, "OFF: $reason ticket -> one play recorded");
    ok(log_count($line) === $logged + 1, "OFF: $reason -> logged '(optional, accepted)'");
}
// the legacy checks still apply to a submit whose ticket failed
$t = mint();
advance(5000);
ok(code_of(sub($t, 30000, 'robot-collector', 7, 99999)) === 'invalid_data', 'OFF: bad score with a bad ticket still rejected (score check)');
ok(code_of(sub('r1.not-a-ticket', 100)) === 'invalid_data', 'OFF: bad duration with a bad ticket still rejected (duration check)');
fresh_limits();
as_user(7);
$body = array('slug' => 'robot-collector', 'score' => 100, 'duration_ms' => 30000, 'run_token' => 'r1.not-a-ticket');
play50_arcade_submit(new WP_REST_Request('POST', '/x', $body));
ok(code_of(play50_arcade_submit(new WP_REST_Request('POST', '/x', $body))) === 'rate_limited', 'OFF: rate limits still apply to a bad ticket');
// a valid ticket is still claimed (single use) while enforcement is off
$t = mint();
advance(30000);
ok(code_of(sub($t, 30000)) === 'ok', 'OFF: valid ticket accepted');
ok(isset($wpdb->claims[play50_arcade_run_token_parse($t)['nonce']]), 'OFF: valid ticket is claimed');
ok(code_of(sub(null, 30000)) === 'ok', 'OFF: null run_token = tokenless, accepted');

// the same failures under ON reject with their reason
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';
foreach (array('malformed', 'signature', 'expired', 'elapsed', 'used') as $reason) {
    $plays_before = plays();
    $r = failing_submit($reason);
    $expected_plays = $plays_before + ($reason === 'used' ? 1 : 0);
    ok(code_of($r) === 'invalid_data' && reason_of($r) === $reason && status_of($r) === 400, "ON: $reason ticket -> 400 $reason");
    ok(plays() === $expected_plays, "ON: $reason ticket -> no play recorded");
}
$r = failing_submit('claim-error');
ok(code_of($r) === 'db_error' && status_of($r) === 500, 'ON: claim error -> db_error');
unset($GLOBALS['t_options']['play50_arcade_require_run_token']);

ok(strpos(log_text(), 'r1.') === false && strpos(log_text(), 'jwt-u') === false, 'logs hold no ticket or JWT');

// ---------------------------------------------------------------- 8. time game, ban, deleted user, gc

$time_slug = 'escape-room';
$games = play50_arcade_games();
$tg = $games[$time_slug];
$t = mint($time_slug);
$d = $tg['min_duration_ms'] + 5000;
advance($d);
$r = sub($t, $d, $time_slug, 7, 999999);
$expected = (int) min($tg['max_score'], max(0, intdiv($tg['time_base_ms'] - $d, 10)));
ok(code_of($r) === 'ok' && $r->data['data']['score'] === $expected, 'time game: ticket + forged client score -> server score');

$t = mint();
advance(30000);
$GLOBALS['t_user_meta'][7]['play50_arcade_banned'] = 1;
ok(code_of(sub($t, 30000)) === 'forbidden', 'ban blocks a ticketed submit');
unset($GLOBALS['t_user_meta'][7]['play50_arcade_banned']);

$t = mint('robot-collector', 11);
advance(30000);
ok(code_of(sub($t, 30000, 'robot-collector', 11)) === 'ok', 'user 11 claims');
play50_arcade_on_deleted_user(11);
$left = 0;
foreach ($wpdb->claims as $row) {
    if ($row['user_id'] === 11) {
        $left++;
    }
}
ok($left === 0, 'deleted user: claims removed');

// gc: once per 10 minutes, expired rows only
$wpdb->claims = array(
    str_repeat('1', 32) => array('user_id' => 1, 'game_slug' => 'robot-collector', 'expires_ms' => 100),
    str_repeat('2', 32) => array('user_id' => 1, 'game_slug' => 'robot-collector', 'expires_ms' => PHP_INT_MAX),
);
delete_transient('p50a_runs_gc');
play50_arcade_runs_gc(1000);
ok(array_keys($wpdb->claims) === array(str_repeat('2', 32)), 'gc: only expired rows');
$wpdb->claims[str_repeat('3', 32)] = array('user_id' => 1, 'game_slug' => 'robot-collector', 'expires_ms' => 100);
play50_arcade_runs_gc(1000);
ok(isset($wpdb->claims[str_repeat('3', 32)]), 'gc: not again within 10 minutes');

// submit limits unchanged: the 3 s gap still answers a quick second submit first
fresh_limits();
as_user(7);
$t1 = mint();
$t2 = mint();
advance(30000);
fresh_limits();
$body = array('slug' => 'robot-collector', 'score' => 100, 'duration_ms' => 30000);
$r1 = play50_arcade_submit(new WP_REST_Request('POST', '/x', $body + array('run_token' => $t1)));
$r2 = play50_arcade_submit(new WP_REST_Request('POST', '/x', $body + array('run_token' => $t2)));
ok(code_of($r1) === 'ok' && code_of($r2) === 'rate_limited', 'submit gap still applies before the token step');
advance(3200);
ok(code_of(sub($t2, 30000)) === 'ok', 'a rate-limited submit leaves its ticket unused');

@unlink($log_file);
echo "run tokens: passed $pass, failed $fail\n";
exit($fail);
