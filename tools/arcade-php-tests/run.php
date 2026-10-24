<?php
/**
 * Pure-PHP harness for the arcade run tokens (docs/run-tokens.md §9) and levels (docs/arcade-levels.md §4). No WordPress, no database,
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
if (!function_exists('mb_substr')) { function mb_substr($s, $start, $len = null) { return substr($s, $start, $len); } } // CLI without mbstring
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

/**
 * Scripted $wpdb: records every statement, keeps scores, level rows and claims in arrays, injects
 * failures. It understands exactly the statements arcade-api.php sends (anything else answers 0/null).
 */
class Fake_WPDB {
    public $prefix = 'wp_';
    public $last_error = '';
    public $log = array();
    public $created = array();
    public $tables = array();
    public $fail_create = array();
    /** board rows "uid|slug" => {user_id, game_slug, best_score, best_duration_ms, last_score, plays, hidden, best_at, last_played} */
    public $scores = array();
    /** level rows "uid|slug|level" => {user_id, game_slug, level, best_score, best_duration_ms, last_score, plays, best_at, last_played} */
    public $levels = array();
    public $claims = array();
    public $fail_claim = false;
    public $fail_upsert = false;
    public $fail_level_upsert = false;
    public $fail_backfill = false;
    public $fail_mirror = false;
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
    private static function n($v) { return ($v === 'NULL' || $v === null) ? null : (int) $v; }
    /** rows as $wpdb returns them: every value a string, NULL stays null */
    private static function out($row) {
        $o = array();
        foreach ($row as $k => $v) {
            $o[$k] = ($v === null) ? null : (string) $v;
        }
        return $o;
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
        // v3 backfill: every board row -> level 1, existing level rows untouched
        if (strpos($sql, 'INSERT IGNORE INTO wp_play50_arcade_level_scores') !== false) {
            if ($this->fail_backfill) {
                $this->last_error = 'scripted backfill failure';
                return false;
            }
            $n = 0;
            foreach ($this->scores as $row) {
                $key = $row['user_id'] . '|' . $row['game_slug'] . '|1';
                if (!isset($this->levels[$key])) {
                    $this->levels[$key] = $this->level_from_board($row);
                    $n++;
                }
            }
            return $n;
        }
        // mirror: board rows -> level 1, assigned
        if (strpos($sql, 'INSERT INTO wp_play50_arcade_level_scores') !== false && strpos($sql, 'SELECT') !== false) {
            if ($this->fail_mirror) {
                $this->last_error = 'scripted mirror failure';
                return false;
            }
            preg_match("/WHERE x\.user_id IS NULL AND (?:s\.user_id = ([0-9]+) AND )?s\.game_slug = '([^']*)'/", $sql, $m);
            $n = 0;
            foreach ($this->scores as $row) {
                $has_higher = false; // the LEFT JOIN guard: users with a level 2-5 row are skipped
                foreach ($this->levels as $l) {
                    if ($l['user_id'] === $row['user_id'] && $l['game_slug'] === $row['game_slug'] && $l['level'] > 1) {
                        $has_higher = true;
                    }
                }
                if (!$has_higher && $row['game_slug'] === $m[2] && ($m[1] === '' || $row['user_id'] === (int) $m[1])) {
                    $this->levels[$row['user_id'] . '|' . $row['game_slug'] . '|1'] = $this->level_from_board($row);
                    $n++;
                }
            }
            return $n;
        }
        // level upsert (today's statement on the level table)
        if (strpos($sql, 'INSERT INTO wp_play50_arcade_level_scores') !== false) {
            if ($this->fail_level_upsert) {
                $this->last_error = 'scripted level upsert failure';
                return false;
            }
            preg_match("/VALUES \(([0-9]+), '([^']*)', ([0-9]+), ([0-9]+), ([0-9]+), ([0-9]+), 1, '([^']*)', '([^']*)'\)/", $sql, $m);
            $key = $m[1] . '|' . $m[2] . '|' . $m[3];
            $run = array('best_score' => (int) $m[4], 'best_duration_ms' => (int) $m[5], 'last_score' => (int) $m[6], 'at' => $m[7]);
            if (!isset($this->levels[$key])) {
                $this->levels[$key] = array('user_id' => (int) $m[1], 'game_slug' => $m[2], 'level' => (int) $m[3],
                    'best_score' => $run['best_score'], 'best_duration_ms' => $run['best_duration_ms'], 'last_score' => $run['last_score'],
                    'plays' => 1, 'best_at' => $run['at'], 'last_played' => $run['at']);
                return 1;
            }
            $this->apply_run($this->levels[$key], $run);
            return 2;
        }
        if (strpos($sql, 'INSERT INTO wp_play50_arcade_scores') !== false) {
            if ($this->fail_upsert) {
                $this->last_error = 'scripted upsert failure';
                return false;
            }
            // total recompute: every value assigned, hidden kept on an existing row
            if (strpos($sql, 'plays = VALUES(plays)') !== false) {
                preg_match("/VALUES \(([0-9]+), '([^']*)', ([0-9]+), (NULL|[0-9]+), ([0-9]+), ([0-9]+), ([0-9]+), '([^']*)', '([^']*)'\)/", $sql, $m);
                $key = $m[1] . '|' . $m[2];
                $hidden = isset($this->scores[$key]) ? $this->scores[$key]['hidden'] : (int) $m[7];
                $this->scores[$key] = array('user_id' => (int) $m[1], 'game_slug' => $m[2], 'best_score' => (int) $m[3],
                    'best_duration_ms' => self::n($m[4]), 'last_score' => (int) $m[5], 'plays' => (int) $m[6], 'hidden' => $hidden,
                    'best_at' => $m[8], 'last_played' => $m[9]);
                return 1;
            }
            preg_match("/VALUES \(([0-9]+), '([^']*)', ([0-9]+), ([0-9]+), ([0-9]+), 1, 0, '([^']*)', '([^']*)'\)/", $sql, $m);
            $key = $m[1] . '|' . $m[2];
            $run = array('best_score' => (int) $m[3], 'best_duration_ms' => (int) $m[4], 'last_score' => (int) $m[5], 'at' => $m[6]);
            if (!isset($this->scores[$key])) {
                $this->scores[$key] = array('user_id' => (int) $m[1], 'game_slug' => $m[2], 'best_score' => $run['best_score'],
                    'best_duration_ms' => $run['best_duration_ms'], 'last_score' => $run['last_score'], 'plays' => 1, 'hidden' => 0,
                    'best_at' => $run['at'], 'last_played' => $run['at']);
                return 1;
            }
            $this->apply_run($this->scores[$key], $run);
            return 2;
        }
        if (preg_match("/DELETE FROM wp_play50_arcade_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2];
            $had = isset($this->scores[$key]);
            unset($this->scores[$key]);
            return $had ? 1 : 0;
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
    private function level_from_board($row) {
        return array('user_id' => $row['user_id'], 'game_slug' => $row['game_slug'], 'level' => 1,
            'best_score' => $row['best_score'], 'best_duration_ms' => $row['best_duration_ms'], 'last_score' => $row['last_score'],
            'plays' => $row['plays'], 'best_at' => $row['best_at'], 'last_played' => $row['last_played']);
    }
    /** the ON DUPLICATE KEY UPDATE of the run upserts (IFs before GREATEST) */
    private function apply_run(&$row, $run) {
        if ($run['best_score'] > $row['best_score']) {
            $row['best_duration_ms'] = $run['best_duration_ms'];
            $row['best_at'] = $run['at'];
        }
        $row['best_score'] = max($row['best_score'], $run['best_score']);
        $row['last_score'] = $run['last_score'];
        $row['plays']++;
        $row['last_played'] = $run['at'];
    }
    public function get_var($sql) {
        $this->last_error = ''; // real wpdb::query() flushes the previous error
        $this->log[] = $sql;
        if (preg_match("/SHOW TABLES LIKE '([^']*)'/", $sql, $m) === 1) {
            $name = stripslashes(stripslashes($m[1])); // prepare() escaped esc_like()'s backslashes
            return isset($this->tables[$name]) ? $name : null;
        }
        if (preg_match("/SELECT best_score FROM wp_play50_arcade_level_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)' AND level = ([0-9]+)/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2] . '|' . $m[3];
            return isset($this->levels[$key]) ? (string) $this->levels[$key]['best_score'] : null;
        }
        if (preg_match("/SELECT best_score FROM wp_play50_arcade_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2];
            return isset($this->scores[$key]) ? (string) $this->scores[$key]['best_score'] : null;
        }
        if (strpos($sql, 'COUNT(*) + 1') !== false) {
            preg_match("/game_slug = '([^']*)' AND hidden = 0\s+AND \(best_score > ([0-9]+) OR \(best_score = ([0-9]+) AND best_at < '([^']*)'\)\)/", $sql, $m);
            $n = 1;
            foreach ($this->scores as $row) {
                if ($row['game_slug'] === $m[1] && !$row['hidden']
                    && ($row['best_score'] > (int) $m[2] || ($row['best_score'] === (int) $m[3] && $row['best_at'] < $m[4]))) {
                    $n++;
                }
            }
            return (string) $n;
        }
        return null;
    }
    public function get_col($sql) {
        $this->last_error = '';
        $this->log[] = $sql;
        $out = array();
        if (preg_match("/SELECT DISTINCT user_id FROM wp_play50_arcade_level_scores WHERE game_slug = '([^']*)'/", $sql, $m) === 1) {
            foreach ($this->levels as $row) {
                if ($row['game_slug'] === $m[1]) {
                    $out[(string) $row['user_id']] = (string) $row['user_id'];
                }
            }
        }
        return array_values($out);
    }
    public function get_row($sql, $output = null) {
        $this->last_error = '';
        $this->log[] = $sql;
        if (preg_match("/FROM wp_play50_arcade_level_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)' AND level = ([0-9]+)/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2] . '|' . $m[3];
            return isset($this->levels[$key]) ? self::out($this->levels[$key]) : null;
        }
        if (preg_match("/FROM wp_play50_arcade_scores WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            $key = $m[1] . '|' . $m[2];
            return isset($this->scores[$key]) ? self::out($this->scores[$key]) : null;
        }
        return null;
    }
    public function get_results($sql, $output = null) {
        $this->log[] = $sql;
        $this->last_error = '';
        $out = array();
        if (preg_match("/FROM wp_play50_arcade_level_scores\s+WHERE user_id = ([0-9]+) AND game_slug = '([^']*)'/", $sql, $m) === 1) {
            foreach ($this->levels as $row) {
                if ($row['user_id'] === (int) $m[1] && $row['game_slug'] === $m[2]) {
                    $out[$row['level']] = self::out($row);
                }
            }
            ksort($out);
            return array_values($out);
        }
        if (preg_match("/FROM wp_play50_arcade_level_scores\s+WHERE user_id = ([0-9]+)\s+ORDER BY/", $sql, $m) === 1) {
            foreach ($this->levels as $row) {
                if ($row['user_id'] === (int) $m[1]) {
                    $out[$row['game_slug'] . '|' . $row['level']] = self::out($row);
                }
            }
            ksort($out, SORT_STRING);
            return array_values($out);
        }
        if (preg_match("/FROM wp_play50_arcade_scores\s+WHERE user_id = ([0-9]+)\s+ORDER BY/", $sql, $m) === 1) {
            foreach ($this->scores as $row) {
                if ($row['user_id'] === (int) $m[1]) {
                    $out[$row['game_slug']] = self::out($row);
                }
            }
            ksort($out, SORT_STRING);
            return array_values($out);
        }
        if (preg_match("/FROM wp_play50_arcade_scores\s+WHERE game_slug = '([^']*)' AND hidden = 0/", $sql, $m) === 1) {
            foreach ($this->scores as $row) {
                if ($row['game_slug'] === $m[1] && !$row['hidden']) {
                    $out[] = $row;
                }
            }
            usort($out, function ($a, $b) {
                return ($b['best_score'] <=> $a['best_score']) ?: strcmp($a['best_at'], $b['best_at']);
            });
            return array_map(array('Fake_WPDB', 'out'), array_slice($out, 0, 50));
        }
        return array();
    }
    public function delete($table, $where, $format = null) {
        $this->log[] = 'DELETE ' . $table . ' ' . json_encode($where);
        $sets = array('wp_play50_arcade_runs' => 'claims', 'wp_play50_arcade_level_scores' => 'levels', 'wp_play50_arcade_scores' => 'scores');
        if (isset($sets[$table])) {
            $set = $sets[$table];
            foreach ($this->$set as $key => $row) {
                if ($row['user_id'] === (int) $where['user_id']) {
                    unset($this->{$set}[$key]);
                }
            }
        }
        return 1;
    }
}

$GLOBALS['wpdb'] = new Fake_WPDB();

// Test games, added before the loader's static cache fills: a disabled game for the 404 cases, two
// five-level games (points and time) and one whose `levels` are invalid (served as one level).
function test_levels($kind, $count = 5) {
    $out = array();
    for ($i = 1; $i <= $count; $i++) {
        $out[] = ($kind === 'points')
            ? array('title' => 'P' . $i, 'max_score' => 1000 * $i, 'min_duration_ms' => 10000 + 1000 * $i, 'max_duration_ms' => 60000 + 10000 * $i, 'base' => 100 * $i, 'max_pps' => 50 * $i)
            : array('title' => 'T' . $i, 'max_score' => 4000 + 1000 * $i, 'min_duration_ms' => 10000 * $i, 'max_duration_ms' => 100000 * $i, 'time_base_ms' => 50000 + 50000 * $i);
    }
    return $out;
}
function test_raw_game($kind, $levels) {
    $first = $levels[0];
    unset($first['title']);
    $raw = array('title' => 'Test ' . $kind, 'kind' => $kind, 'enabled' => true) + $first;
    if ($levels !== null) {
        $raw['levels'] = $levels;
    }
    return $raw;
}
add_filter('play50_arcade_games', function ($games) {
    $games['test-off'] = $games['robot-collector'];
    $games['test-off']['enabled'] = false;
    $games['lv-points'] = play50_arcade_normalize_game('lv-points', test_raw_game('points', test_levels('points')));
    $games['lv-time'] = play50_arcade_normalize_game('lv-time', test_raw_game('time', test_levels('time')));
    $bad = test_levels('points');
    $bad[0]['max_score'] = 999; // levels[0] differs from the top level
    $raw = test_raw_game('points', test_levels('points'));
    $raw['levels'] = $bad;
    $games['lv-bad'] = play50_arcade_normalize_game('lv-bad', $raw);
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
ok(get_option('play50_arcade_db_version') === '3', 'install records DB version 3');
ok(isset($wpdb->tables['wp_play50_arcade_scores'], $wpdb->tables['wp_play50_arcade_runs'], $wpdb->tables['wp_play50_arcade_level_scores']), 'all three tables created');
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

// ---------------------------------------------------------------- 9. levels (docs/arcade-levels.md §4)

/** Submit with an optional level (null = no `level` key). */
function lsub($slug, $level, $score, $duration, $uid = 7, $token = '__absent__') {
    $body = array('slug' => $slug, 'score' => $score, 'duration_ms' => $duration);
    if ($level !== null) {
        $body['level'] = $level;
    }
    if ($token !== '__absent__') {
        $body['run_token'] = $token;
    }
    return submit($body, $uid);
}
function lstart($slug, $level, $uid = 7) {
    fresh_limits();
    as_user($uid);
    $body = array('slug' => $slug);
    if ($level !== null) {
        $body['level'] = $level;
    }
    return play50_arcade_start_run(new WP_REST_Request('POST', '/play50/v1/arcade/runs/start', $body));
}
function lmint($slug, $level, $uid = 7) {
    $r = lstart($slug, $level, $uid);
    return ($r instanceof WP_REST_Response) ? $r->data['run_token'] : null;
}
function field_of($r) { return ($r instanceof WP_Error && isset($r->data['field'])) ? $r->data['field'] : null; }
function level_row($uid, $slug, $level) {
    global $wpdb;
    $key = $uid . '|' . $slug . '|' . $level;
    return isset($wpdb->levels[$key]) ? $wpdb->levels[$key] : null;
}
function board_row($uid, $slug) {
    global $wpdb;
    $key = $uid . '|' . $slug;
    return isset($wpdb->scores[$key]) ? $wpdb->scores[$key] : null;
}
function me_of($uid) {
    as_user($uid);
    $r = play50_arcade_get_me(new WP_REST_Request('GET', '/play50/v1/arcade/me'));
    return ($r instanceof WP_REST_Response) ? $r->data : $r;
}
function count_sql($needle, $from = 0) {
    global $wpdb;
    $n = 0;
    foreach (array_slice($wpdb->log, $from) as $sql) {
        if (strpos($sql, $needle) !== false) {
            $n++;
        }
    }
    return $n;
}

unset($GLOBALS['t_options']['play50_arcade_require_run_token']);
$games = play50_arcade_games();

// 9.1 config: the repo JSON is v4 and every game in it still has one level
$repo = json_decode(file_get_contents(dirname(__DIR__, 2) . '/play50games-backend/play50games/includes/arcade-games.json'), true);
ok($repo['version'] === 4 && play50_arcade_games_version() === 4, 'json: version 4');
$repo_ok = true;
foreach ($repo['games'] as $slug => $raw) {
    $g = play50_arcade_normalize_game($slug, $raw);
    if (!$g || array_keys($g['levels']) !== array(1) || isset($raw['levels'])) {
        $repo_ok = false;
    }
}
ok($repo_ok && count($repo["games"]) === count(array_filter($repo["games"], "is_array")) && count($repo["games"]) >= 10, 'json: every game valid, one level each, no `levels` key');
$rc = $games['robot-collector'];
ok(array_keys($rc) === array('title', 'kind', 'max_score', 'min_duration_ms', 'max_duration_ms', 'base', 'max_pps', 'time_base_ms', 'enabled', 'levels'), 'normalize: v3 keys + levels');
$level_one = $rc['levels'][1];
unset($level_one['title']);
ok($level_one === array('max_score' => 1470, 'min_duration_ms' => 12500, 'max_duration_ms' => 62000, 'base' => 600, 'max_pps' => 120, 'time_base_ms' => null), 'normalize: one-level game has level 1 = top level');
ok(play50_arcade_level_count($rc) === 1 && play50_arcade_level_count($games['lv-points']) === 5, 'level_count 1 / 5');
ok(play50_arcade_level_count($games['lv-bad']) === 1, 'invalid levels (levels[0] differs) -> one level');
ok(log_count('game lv-bad levels ignored, served as one level (levels[0] differs from the top-level limits)') >= 1, 'invalid levels are logged');
ok($games['lv-points']['levels'][3]['max_score'] === 3000 && $games['lv-points']['levels'][3]['title'] === 'P3', 'level 3 limits + title');
ok(play50_arcade_game_level($games['lv-points'], 3)['max_pps'] === 150 && play50_arcade_game_level($games['lv-points'], 3)['title'] === 'Test points', 'game_level: level limits, game title kept');
ok(play50_arcade_game_level($games['lv-points'], 1)['max_score'] === $games['lv-points']['max_score'], 'game_level 1 = top level');
ok(play50_arcade_game_level($rc, 1) !== null && play50_arcade_game_level($rc, 2) === null, 'one-level game: level 1 only');
ok(play50_arcade_game_level($games['lv-points'], 6) === null && play50_arcade_game_level($games['lv-points'], 0) === null, 'game_level: 0 and 6 unknown');

// invalid `levels` shapes: each served as one level, the game itself stays
$base_raw = test_raw_game('points', test_levels('points'));
$cases = array(
    'four levels' => test_levels('points', 4),
    'six levels' => test_levels('points', 6),
    'not a list' => array_combine(array('a', 'b', 'c', 'd', 'e'), test_levels('points')),
    'a string' => 'levels',
    'empty' => array(),
);
$missing = test_levels('points');
unset($missing[2]['max_pps']);
$cases['level 3 without max_pps'] = $missing;
$bad_window = test_levels('points');
$bad_window[4]['min_duration_ms'] = $bad_window[4]['max_duration_ms'];
$cases['level 5 min >= max'] = $bad_window;
$time_missing = test_levels('time');
unset($time_missing[1]['time_base_ms']);
foreach ($cases as $name => $levels) {
    $raw = $base_raw;
    $raw['levels'] = $levels;
    $g = play50_arcade_normalize_game('x-case', $raw);
    ok(is_array($g) && play50_arcade_level_count($g) === 1 && $g['max_score'] === 1000, "invalid levels ($name) -> one level");
}
$raw = test_raw_game('time', test_levels('time'));
$raw['levels'] = $time_missing;
$g = play50_arcade_normalize_game('x-time', $raw);
ok(is_array($g) && play50_arcade_level_count($g) === 1, 'invalid levels (time level without time_base_ms) -> one level');
$g = play50_arcade_normalize_game('x-time', test_raw_game('time', test_levels('time')));
ok($g['levels'][5]['time_base_ms'] === 300000 && $g['levels'][5]['base'] === 0, 'time levels normalized');

// 9.2 GET games
$g = play50_arcade_get_games(null);
ok($g->data['features'] === array('levels' => true) && $g->data['version'] === 4, 'games: features.levels true, version 4');
ok(!isset($g->data['games']->{'robot-collector'}['levels']), 'games: a one-level game is served without levels');
ok(array_keys($g->data['games']->{'robot-collector'}) === array('title', 'kind', 'max_score', 'min_duration_ms', 'max_duration_ms', 'base', 'max_pps', 'time_base_ms', 'enabled'), 'games: one-level game keys exactly as before');
$lp = $g->data['games']->{'lv-points'}['levels'];
ok(array_keys($lp) === array(0, 1, 2, 3, 4) && $lp[0]['max_score'] === 1000 && $lp[4]['max_score'] === 5000, 'games: levels is a list, level 1 first');
ok(strpos(json_encode($g->data), '"levels":[{"title":"P1"') !== false, 'games: levels encodes as a JSON array');

// 9.3 submit: level validation
$rc_before = plays();
foreach (array('2' => 2, '"x"' => 'x', '0' => 0, '-1' => -1, '1.5' => 1.5, 'null' => null, 'true' => true, '"2 "' => '2 ') as $label => $value) {
    $body = array('slug' => 'robot-collector', 'score' => 100, 'duration_ms' => 30000, 'level' => $value);
    $r = submit($body);
    ok(code_of($r) === 'invalid_data' && field_of($r) === 'level' && status_of($r) === 400 && $r->message === 'Unknown level.', "one-level game, level $label -> invalid_data field level");
}
ok(plays() === $rc_before, 'unknown levels record nothing');
foreach (array(6, 0, 'x', 99) as $value) {
    $r = lsub('lv-points', $value, 100, 30000);
    ok(field_of($r) === 'level', "five-level game, level " . json_encode($value) . " -> field level");
}
ok(field_of(lsub('lv-bad', 2, 100, 30000)) === 'level', 'invalid JSON levels: level 2 unknown (never checked against wrong limits)');

// level 1 / no level on a one-level game: the same response, the same board statement
$r_none = lsub('robot-collector', null, 100, 30000, 15);
$r_one = lsub('robot-collector', 1, 100, 30000, 16);
$r_str = lsub('robot-collector', '1', 100, 30000, 17);
$keys = array('slug', 'score', 'best_score', 'is_new_best', 'plays', 'rank');
ok(array_keys($r_none->data['data']) === $keys && array_keys($r_one->data['data']) === $keys && array_keys($r_str->data['data']) === $keys, 'one-level game: no level / level 1 / "1" -> the old response keys');
ok($r_none->data === array_replace($r_one->data, array()) && $r_one->data == $r_none->data, 'one-level game: level 1 response equals the no-level response');
$before = count($wpdb->log);
lsub('robot-collector', null, 120, 30000, 18);
$expected_upsert = $wpdb->prepare(
    "INSERT INTO wp_play50_arcade_scores
                (user_id, game_slug, best_score, best_duration_ms, last_score, plays, hidden, best_at, last_played)
            VALUES (%d, %s, %d, %d, %d, 1, 0, %s, %s)
            ON DUPLICATE KEY UPDATE
                best_duration_ms = IF(VALUES(best_score) > best_score, VALUES(best_duration_ms), best_duration_ms),
                best_at = IF(VALUES(best_score) > best_score, VALUES(best_at), best_at),
                best_score = GREATEST(best_score, VALUES(best_score)),
                last_score = VALUES(last_score),
                plays = plays + 1,
                last_played = VALUES(last_played)",
    18, 'robot-collector', 120, 30000, 120, board_row(18, 'robot-collector')['best_at'], board_row(18, 'robot-collector')['last_played']
);
ok(in_array($expected_upsert, array_slice($wpdb->log, $before), true), 'one-level game: the board upsert is byte-identical to v2');
ok(count_sql('INSERT INTO wp_play50_arcade_level_scores', $before) === 1 && count_sql('SELECT s.user_id, s.game_slug, 1,', $before) === 1, 'one-level game: one mirror statement into level 1');
$b = board_row(18, 'robot-collector');
$l = level_row(18, 'robot-collector', 1);
ok($l !== null && $l['best_score'] === $b['best_score'] && $l['plays'] === $b['plays'] && $l['best_duration_ms'] === $b['best_duration_ms'] && $l['best_at'] === $b['best_at'], 'one-level game: level 1 row mirrors the board row');
lsub('robot-collector', null, 90, 40000, 18);
ok(level_row(18, 'robot-collector', 1)['plays'] === 2 && level_row(18, 'robot-collector', 1)['best_score'] === 120 && level_row(18, 'robot-collector', 1)['last_score'] === 90, 'one-level game: mirror follows a second run');
$wpdb->fail_mirror = true;
$r = lsub('robot-collector', null, 130, 30000, 18);
$wpdb->fail_mirror = false;
ok(code_of($r) === 'ok' && $r->data['data']['best_score'] === 130, 'mirror failure: logged, the board write still answers 200');
ok(log_count('db error (level mirror)') === 1, 'mirror failure logged');

// 9.4 limits per level
ok(code_of(lsub('lv-points', null, 1001, 30000)) === 'invalid_data' && field_of(lsub('lv-points', null, 1001, 30000)) === 'score', 'L1: score above L1 max_score rejected');
ok(code_of(lsub('lv-points', 3, 2500, 30000, 40)) === 'ok', 'L3: the same kind of score accepted under L3 limits');
ok(field_of(lsub('lv-points', 3, 3001, 30000)) === 'score', 'L3: above L3 max_score rejected');
ok(field_of(lsub('lv-points', 3, 1000, 12000)) === 'duration_ms', 'L3: below L3 min_duration (but above L1 min) rejected');
ok(code_of(lsub('lv-points', 1, 500, 12000, 41)) === 'ok', 'L1: the same duration accepted on L1');
ok(field_of(lsub('lv-points', 1, 500, 80000)) === 'duration_ms' && code_of(lsub('lv-points', 3, 500, 80000, 42)) === 'ok', 'max_duration per level');
// plausibility per level: L2 = base 200 + 100/s; L1 = 100 + 50/s
ok(code_of(lsub('lv-points', 1, 800, 14000, 45)) === 'ok' && field_of(lsub('lv-points', 1, 801, 14000)) === 'score' && code_of(lsub('lv-points', 2, 801, 14000, 43)) === 'ok', 'points-per-second per level');
// time: the server score uses the level's time base
$r = lsub('lv-time', 2, 999999, 100000, 44);
ok(code_of($r) === 'ok' && $r->data['data']['score'] === 5000 && $r->data['data']['level_best_score'] === 5000, 'time L2: server score from L2 time_base');
ok(field_of(lsub('lv-time', 2, 0, 15000)) === 'duration_ms', 'time L2: below L2 min_duration rejected');

// 9.5 points total = sum of level bests
$u = 21;
$r = lsub('lv-points', null, 500, 20000, $u);
ok(code_of($r) === 'ok' && $r->data['data']['best_score'] === 500 && $r->data['data']['level'] === 1 && $r->data['data']['level_best_score'] === 500, 'points: first level-1 run, total 500');
ok(array_keys($r->data['data']) === array('slug', 'score', 'best_score', 'is_new_best', 'plays', 'rank', 'level', 'level_best_score', 'is_new_level_best'), 'five-level game: response adds level, level_best_score, is_new_level_best');
$r = lsub('lv-points', 2, 700, 20000, $u);
ok($r->data['data']['best_score'] === 1200 && $r->data['data']['is_new_best'] === true && $r->data['data']['is_new_level_best'] === true && $r->data['data']['plays'] === 2, 'points: L1 500 + L2 700 = 1200');
$r = lsub('lv-points', 2, 300, 25000, $u);
ok($r->data['data']['best_score'] === 1200 && $r->data['data']['level_best_score'] === 700 && $r->data['data']['is_new_level_best'] === false && $r->data['data']['is_new_best'] === false && $r->data['data']['plays'] === 3 && $r->data['data']['score'] === 300, 'points: a lower L2 run keeps 1200');
$r = lsub('lv-points', 2, 900, 30000, $u);
ok($r->data['data']['best_score'] === 1400 && $r->data['data']['level_best_score'] === 900, 'points: a better L2 run raises the total to 1400');
$b = board_row($u, 'lv-points');
ok($b['best_score'] === 1400 && $b['plays'] === 4 && $b['best_duration_ms'] === 20000 + 30000 && $b['last_score'] === 900, 'points: board row = sums (score, duration of the bests, plays), last score');
ok($b['best_at'] === max(level_row($u, 'lv-points', 1)['best_at'], level_row($u, 'lv-points', 2)['best_at']), 'points: best_at = latest level best');
ok(is_int($r->data['data']['rank']) && $r->data['data']['rank'] >= 1, 'points: rank of the total');
// level 1 explicitly = no level
$r = lsub('lv-points', 1, 600, 20000, $u);
ok($r->data['data']['level'] === 1 && $r->data['data']['best_score'] === 1500, 'points: level 1 sent explicitly = level 1');
// a ban keeps the row hidden through a recompute
$GLOBALS['t_user_meta'][$u]['play50_arcade_banned'] = 1;
$wpdb->scores[$u . '|lv-points']['hidden'] = 1;
play50_arcade_recompute_total($u, 'lv-points', $games['lv-points']);
ok(board_row($u, 'lv-points')['hidden'] === 1, 'recompute keeps hidden');
unset($GLOBALS['t_user_meta'][$u]['play50_arcade_banned']);
$wpdb->scores[$u . '|lv-points']['hidden'] = 0;
// the total is assigned: removing a (forged) level row lowers it on recompute
$forged = level_row($u, 'lv-points', 2);
unset($wpdb->levels[$u . '|lv-points|2']);
$t = play50_arcade_recompute_total($u, 'lv-points', $games['lv-points']);
ok($t['best_score'] === 600 && board_row($u, 'lv-points')['best_score'] === 600, 'recompute assigns the total (a removed level lowers it)');
$wpdb->levels[$u . '|lv-points|2'] = $forged;
play50_arcade_recompute_total($u, 'lv-points', $games['lv-points']);
// a level-upsert failure answers db_error and leaves the board alone
$wpdb->fail_level_upsert = true;
$r = lsub('lv-points', 4, 100, 30000, $u);
$wpdb->fail_level_upsert = false;
ok(code_of($r) === 'db_error' && board_row($u, 'lv-points')['best_score'] === 1500, 'level upsert failure -> db_error, board unchanged');

// 9.6 time total = summed best times, only with all 5 levels
$u = 22;
$times = array(1 => 60000, 2 => 100000, 3 => 150000, 4 => 200000, 5 => 250000);
for ($n = 1; $n <= 4; $n++) {
    $r = lsub('lv-time', $n === 1 ? null : $n, 0, $times[$n], $u);
    ok(code_of($r) === 'ok' && $r->data['data']['best_score'] === 0 && $r->data['data']['rank'] === null && $r->data['data']['plays'] === $n, "time: $n of 5 levels -> not ranked (best 0, rank null)");
    ok(board_row($u, 'lv-time') === null, "time: $n of 5 levels -> no board row");
}
ok($r->data['data']['level_best_score'] === 5000 && $r->data['data']['is_new_level_best'] === true, 'time: level best still reported');
$me = me_of($u);
ok(isset($me['lv-time']) && $me['lv-time']['best'] === 0 && $me['lv-time']['rank'] === null && $me['lv-time']['best_duration_ms'] === null && $me['lv-time']['plays'] === 4, 'me: unranked time game entry (best 0, rank null, plays over levels)');
ok(array_keys($me['lv-time']['levels']) === array(1, 2, 3, 4) && $me['lv-time']['levels'][2]['best_duration_ms'] === 100000, 'me: per-level times');
ok(strpos(json_encode($me), '"levels":{"1":{"best":4000,"best_duration_ms":60000') !== false, 'me: levels encodes as an object keyed "1".."5"');
$r = lsub('lv-time', 5, 0, $times[5], $u);
$sum = array_sum($times);
$expected = (int) min(35000, max(0, intdiv(1000000 - $sum, 10)));
ok($expected === 24000 && $r->data['data']['best_score'] === $expected, 'time: all 5 -> total = (sum of time bases - sum of times) / 10 = 24000');
$b = board_row($u, 'lv-time');
ok($b['best_score'] === 24000 && $b['best_duration_ms'] === $sum && $b['plays'] === 5 && is_int($r->data['data']['rank']), 'time: board row holds the summed time and is ranked');
$r = lsub('lv-time', 3, 0, 120000, $u);
ok($r->data['data']['best_score'] === intdiv(1000000 - ($sum - 30000), 10) && board_row($u, 'lv-time')['best_duration_ms'] === $sum - 30000, 'time: a faster L3 lowers the summed time (+3000)');
$r = lsub('lv-time', 3, 0, 290000, $u);
ok($r->data['data']['best_score'] === 27000 && $r->data['data']['is_new_level_best'] === false, 'time: a slower L3 run changes nothing');
// ranking follows the summed time: a faster total ranks above
$v = 23;
foreach (array(1 => 50000, 2 => 90000, 3 => 140000, 4 => 190000, 5 => 240000) as $n => $ms) {
    $r = lsub('lv-time', $n, 0, $ms, $v);
}
ok($r->data['data']['best_score'] === intdiv(1000000 - 710000, 10) && $r->data['data']['rank'] === 1, 'time: total 710 s ranks first');
delete_transient('p50a_top_lv-time');
$top = play50_arcade_top('lv-time');
ok(count($top) === 2 && $top[0]['user_id'] === 23 && $top[0]['duration_ms'] === 710000 && $top[1]['user_id'] === 22, 'time board: only finished players, ordered by summed time');
// pure formula: partial sets, missing times, the cap
$tg = $games['lv-time'];
$rows = array();
foreach ($times as $n => $ms) {
    $rows[] = array('level' => $n, 'best_score' => 1, 'best_duration_ms' => $ms, 'last_score' => 1, 'plays' => 1, 'best_at' => '2026-10-24 10:00:0' . $n, 'last_played' => '2026-10-24 10:00:0' . $n);
}
ok(play50_arcade_total_from_levels($tg, $rows)['best_score'] === 24000, 'total_from_levels: time formula');
ok(play50_arcade_total_from_levels($tg, array_slice($rows, 0, 4)) === null, 'total_from_levels: 4 of 5 -> null');
$no_time = $rows;
$no_time[2]['best_duration_ms'] = null;
ok(play50_arcade_total_from_levels($tg, $no_time) === null, 'total_from_levels: a level without a time -> null');
$fast = $rows;
foreach ($fast as $i => $row) {
    $fast[$i]['best_duration_ms'] = 1;
}
ok(play50_arcade_total_from_levels($tg, $fast)['best_score'] === 35000, 'total_from_levels: capped at the sum of max_score');
$extra = $rows;
$extra[] = array('level' => 6) + $rows[0];
ok(play50_arcade_total_from_levels($tg, $extra)['plays'] === 5, 'total_from_levels: rows of unknown levels ignored');
ok(play50_arcade_total_from_levels($games['lv-points'], array_slice($rows, 0, 2))['best_score'] === 2 && play50_arcade_total_from_levels($games['lv-points'], array()) === null, 'total_from_levels: points sum; no rows -> null');
$one = $games['escape-room'];
ok(play50_arcade_total_from_levels($one, array(array('level' => 1, 'best_score' => 777, 'best_duration_ms' => null) + $rows[0]))['best_score'] === 777, 'total_from_levels: one-level time game = its level-1 row');

// 9.7 run tickets per level (enforcement ON)
$GLOBALS['t_options']['play50_arcade_require_run_token'] = '1';
$t = lmint('robot-collector', null);
$p = play50_arcade_run_token_parse($t);
ok($p['sig'] === hash_hmac('sha256', 'r1|7|robot-collector|' . $p['issued_ms'] . '|' . $p['expires_ms'] . '|' . $p['nonce'], play50_arcade_run_token_key()), 'ticket without level: signed over the plain slug (v2 format)');
$t1 = lmint('lv-points', 1);
$p1 = play50_arcade_run_token_parse($t1);
ok($p1['sig'] === play50_arcade_run_token_sign(7, 'lv-points', $p1['issued_ms'], $p1['expires_ms'], $p1['nonce']) && $p1['expires_ms'] === $p1['issued_ms'] + 70000 + 300000, 'level-1 ticket: plain slug, L1 expiry');
$t3 = lmint('lv-points', 3);
$p3 = play50_arcade_run_token_parse($t3);
ok($p3['sig'] === play50_arcade_run_token_sign(7, 'lv-points@3', $p3['issued_ms'], $p3['expires_ms'], $p3['nonce']), 'level-3 ticket: signed over "lv-points@3"');
ok($p3['expires_ms'] === $p3['issued_ms'] + 90000 + 300000, 'level-3 ticket: expiry from L3 max_duration_ms');
ok(play50_arcade_run_token_subject('lv-points', 1) === 'lv-points' && play50_arcade_run_token_subject('lv-points', '4') === 'lv-points@4', 'subject: slug / slug@level');
advance(30000);
ok(reason_of(lsub('lv-points', 5, 100, 30000, 7, $t3)) === 'signature', 'level-3 ticket on a level-5 submit -> signature');
ok(reason_of(lsub('lv-points', null, 100, 30000, 7, $t3)) === 'signature', 'level-3 ticket on a level-1 submit -> signature');
ok(reason_of(lsub('lv-points', 2, 100, 30000, 7, $t1)) === 'signature', 'level-1 ticket on a level-2 submit -> signature');
ok(code_of(lsub('lv-points', 3, 100, 30000, 7, $t3)) === 'ok', 'level-3 ticket on its own level -> 200');
ok(reason_of(lsub('lv-points', 3, 100, 30000, 7, $t3)) === 'used', 'level-3 ticket: single use');
ok(code_of(lsub('lv-points', 1, 100, 30000, 7, $t1)) === 'ok', 'level-1 ticket with level 1 sent explicitly -> 200');
ok($wpdb->claims[$p3['nonce']]['game_slug'] === 'lv-points', 'claim row keeps the plain slug');
$tr = lmint('robot-collector', 1);
advance(30000);
ok(code_of(lsub('robot-collector', null, 100, 30000, 7, $tr)) === 'ok', 'one-level game: a ticket from start {level: 1} verifies a no-level submit');
unset($GLOBALS['t_options']['play50_arcade_require_run_token']);
$r = lstart('lv-points', 6);
ok(code_of($r) === 'invalid_data' && field_of($r) === 'level', 'start: level 6 -> invalid_data field level');
ok(field_of(lstart('lv-points', 'x')) === 'level' && field_of(lstart('robot-collector', 2)) === 'level', 'start: "x" / level 2 of a one-level game -> field level');
ok(code_of(lstart('lv-points', '2')) === 'ok', 'start: "2" accepted');
ok(array_keys(lstart('lv-time', 5)->data) === array('run_token'), 'start: level response is exactly {run_token}');

// 9.8 me: one-level games unchanged, five-level games add levels
$me = me_of(21);
ok(isset($me['lv-points']['levels']) && array_keys($me['lv-points']['levels']) === array(1, 2) && $me['lv-points']['best'] === 1500 && is_int($me['lv-points']['rank']), 'me: points total + levels 1, 2');
$me = me_of(18);
ok(array_keys($me['robot-collector']) === array('best', 'best_duration_ms', 'plays', 'last_played', 'rank'), 'me: one-level game entry exactly as before');
ok(array_keys(me_of(40)) === array('lv-points'), 'me: keys are slugs only');

// 9.9 resync when a game's level count changes
$wpdb->scores['31|lv-points'] = array('user_id' => 31, 'game_slug' => 'lv-points', 'best_score' => 800, 'best_duration_ms' => 40000, 'last_score' => 800, 'plays' => 3, 'hidden' => 0, 'best_at' => '2026-10-01 10:00:00', 'last_played' => '2026-10-02 10:00:00');
$wpdb->scores['32|lv-time'] = array('user_id' => 32, 'game_slug' => 'lv-time', 'best_score' => 4000, 'best_duration_ms' => 60000, 'last_score' => 4000, 'plays' => 2, 'hidden' => 0, 'best_at' => '2026-10-01 10:00:00', 'last_played' => '2026-10-02 10:00:00');
ok(get_option('play50_arcade_level_counts') === array('lv-points' => 5, 'lv-time' => 5), 'sync: counts recorded after the first request');
$GLOBALS['t_options']['play50_arcade_level_counts'] = array(); // as if the JSON had just gained levels for both
play50_arcade_sync_level_totals();
ok(level_row(31, 'lv-points', 1)['best_score'] === 800 && board_row(31, 'lv-points')['best_score'] === 800 && board_row(31, 'lv-points')['best_at'] === '2026-10-01 10:00:00', 'resync points: old best copied to level 1, total unchanged');
ok(level_row(32, 'lv-time', 1)['best_duration_ms'] === 60000 && board_row(32, 'lv-time') === null, 'resync time: old best kept as level 1, off the board until all 5');
ok(board_row(22, 'lv-time')['best_score'] === 27000 && board_row(21, 'lv-points')['best_score'] === 1500, 'resync: finished players keep their totals');
ok(get_option('play50_arcade_level_counts') === array('lv-points' => 5, 'lv-time' => 5), 'resync: counts recorded');
$before = count($wpdb->log);
play50_arcade_sync_level_totals();
ok(count($wpdb->log) === $before, 'sync: no query once the counts match');
// a failed resync is retried later and records nothing
$GLOBALS['t_options']['play50_arcade_level_counts'] = array('lv-time' => 5);
$wpdb->fail_mirror = true;
play50_arcade_sync_level_totals();
$wpdb->fail_mirror = false;
ok(!isset($GLOBALS['t_options']['play50_arcade_level_counts']['lv-points']), 'resync failure: count not recorded (retried)');
play50_arcade_sync_level_totals();
ok($GLOBALS['t_options']['play50_arcade_level_counts']['lv-points'] === 5, 'resync retried on the next request');
// a game going back to one level: the board becomes its level-1 row
$GLOBALS['t_options']['play50_arcade_level_counts']['robot-collector'] = 5;
$wpdb->levels['18|robot-collector|2'] = array('level' => 2) + level_row(18, 'robot-collector', 1);
play50_arcade_sync_level_totals();
ok(board_row(18, 'robot-collector')['best_score'] === level_row(18, 'robot-collector', 1)['best_score'], 'resync 5 -> 1: board = level 1');
unset($wpdb->levels['18|robot-collector|2']);

// 9.10 deleted user removes level rows too
lsub('lv-points', 2, 100, 30000, 50);
play50_arcade_on_deleted_user(50);
ok(level_row(50, 'lv-points', 2) === null && board_row(50, 'lv-points') === null, 'deleted user: level rows and board row removed');

// 9.11 v3 migration: once, idempotent, the board untouched. A v2 site: one board row per user and
// game, every one of them a level-1 best (v2 knew no levels).
$wpdb->levels = array();
foreach ($wpdb->scores as $key => $row) {
    if (strpos($row['game_slug'], 'lv-') === 0) {
        unset($wpdb->scores[$key]);
    }
}
$wpdb->scores['70|lv-points'] = array('user_id' => 70, 'game_slug' => 'lv-points', 'best_score' => 800, 'best_duration_ms' => 40000, 'last_score' => 700, 'plays' => 3, 'hidden' => 0, 'best_at' => '2026-10-01 10:00:00', 'last_played' => '2026-10-02 10:00:00');
$wpdb->scores['71|lv-time'] = array('user_id' => 71, 'game_slug' => 'lv-time', 'best_score' => 4000, 'best_duration_ms' => 60000, 'last_score' => 4000, 'plays' => 2, 'hidden' => 0, 'best_at' => '2026-10-01 10:00:00', 'last_played' => '2026-10-02 10:00:00');
$GLOBALS['t_options']['play50_arcade_db_version'] = '2';
unset($GLOBALS['t_options']['play50_arcade_level_counts']);
delete_transient('p50a_install_failed');
$board_before = $wpdb->scores;
ok(play50_arcade_run_tokens_ready() === true && play50_arcade_levels_ready() === false, 'v2: run tokens ready, levels not');
ok(play50_arcade_get_games(null)->data['features'] === array('levels' => false), 'v2: features.levels false');

// not ready yet: level 1 / no level work on the board path, levels 2-5 answer db_error
$before = count($wpdb->log);
ok(code_of(lsub('robot-collector', null, 100, 30000, 60)) === 'ok' && count_sql('wp_play50_arcade_level_scores', $before) === 0, 'v2: one-level submit works, never touches the level table');
ok(code_of(lsub('lv-points', null, 100, 30000, 61)) === 'ok' && code_of(lsub('lv-points', 1, 100, 30000, 61)) === 'ok', 'v2: level 1 of a five-level game works');
$r = lsub('lv-points', 2, 100, 30000, 61);
ok(code_of($r) === 'db_error' && status_of($r) === 500, 'v2: level 2 -> db_error (levels not ready)');
ok(code_of(lstart('lv-points', 2)) === 'db_error' && code_of(lstart('lv-points', null)) === 'ok', 'v2: start level 2 -> db_error, level 1 -> ticket');
$board_before = $wpdb->scores;

$wpdb->fail_backfill = true;
play50_arcade_maybe_install();
$wpdb->fail_backfill = false;
ok(get_option('play50_arcade_db_version') === '2' && get_transient('p50a_install_failed') === 1, 'backfill failure: version stays 2, retry guard set');
ok(play50_arcade_run_tokens_ready() === true && play50_arcade_levels_ready() === false, 'backfill failure: run tokens stay ready');
delete_transient('p50a_install_failed');

$before = count($wpdb->log);
play50_arcade_maybe_install();
ok(get_option('play50_arcade_db_version') === '3', 'migration: version 3');
ok(count_sql('INSERT IGNORE INTO wp_play50_arcade_level_scores', $before) === 1, 'migration: one backfill statement');
$copied_ok = count($wpdb->levels) === count($board_before);
foreach ($board_before as $key => $row) {
    $l = level_row($row['user_id'], $row['game_slug'], 1);
    if (!$l || $l['best_score'] !== $row['best_score'] || $l['best_duration_ms'] !== $row['best_duration_ms'] || $l['plays'] !== $row['plays']
        || $l['best_at'] !== $row['best_at'] || $l['last_played'] !== $row['last_played'] || $l['last_score'] !== $row['last_score']) {
        $copied_ok = false;
    }
}
ok($copied_ok && count($board_before) >= 10, 'migration: every board row copied to level 1 exactly');
ok($wpdb->scores === $board_before, 'migration: board rows untouched');
ok(get_option('play50_arcade_level_counts') === array(), 'migration: level counts start empty (= 1 each)');
$before = count($wpdb->log);
play50_arcade_maybe_install();
ok(count($wpdb->log) === $before, 'migration runs once: nothing on the next request');
$before = count($wpdb->log);
play50_arcade_install(); // after_switch_theme on a v3 site
ok(count_sql('INSERT IGNORE INTO wp_play50_arcade_level_scores', $before) === 0, 'install on a v3 site: no second backfill');
// a second migration (two requests racing) never overwrites a level row
$wpdb->levels['15|robot-collector|1']['best_score'] = 1;
$GLOBALS['t_options']['play50_arcade_db_version'] = '2';
play50_arcade_maybe_install();
ok(level_row(15, 'robot-collector', 1)['best_score'] === 1 && count($wpdb->levels) === count($board_before), 'a repeated backfill copies nothing twice (INSERT IGNORE)');
// first request after migration: games with levels resync (lv-points totals kept, lv-time partial players off)
fresh_limits();
play50_arcade_sync_level_totals();
ok(board_row(61, 'lv-points')['best_score'] === 100 && board_row(70, 'lv-points')['best_score'] === 800 && board_row(70, 'lv-points')['best_at'] === '2026-10-01 10:00:00', 'after migration: points totals kept (= level 1)');
ok(level_row(71, 'lv-time', 1)['best_duration_ms'] === 60000 && board_row(71, 'lv-time') === null, 'after migration: a time game with levels drops level-1-only players off the board, their level 1 kept');
ok(get_option('play50_arcade_level_counts') === array('lv-points' => 5, 'lv-time' => 5), 'after migration: counts recorded once');
$r = lsub('lv-points', 2, 300, 20000, 70);
ok($r->data['data']['best_score'] === 1100 && $r->data['data']['level_best_score'] === 300, 'after migration: a level-2 run adds to the migrated level-1 best');

@unlink($log_file);
echo "run tokens + levels: passed $pass, failed $fail\n";
exit($fail);
