#!/usr/bin/env bash
# Credentials must never appear in shell traces, argv, diagnostics or plans.
set +x
set -u
set -o pipefail
umask 077

say() { printf '%s\n' "$*" | sed -E 's/eyJ[A-Za-z0-9._+/=-]*/[REDACTED]/g'; }
stop() { say "FAIL $*" >&2; exit 1; }
usage() {
   say 'Usage: bash tools/arcade-api-smoke.sh [--env FILE] [--dry-run]'
   say '       [--only reads|auth|validation|rate|privacy|time|register]'
   say '       [--api-key-gate open|closed]'
}

dry_run=0
only=""
gate="open"
env_file=""
while (( $# )); do
   case "$1" in
      --dry-run) dry_run=1; shift ;;
      --env|--only|--api-key-gate)
         (( $# >= 2 )) || stop 'Option needs a value.'
         case "$1" in
            --env) env_file=$2 ;;
            --only) [[ -z $only ]] || stop 'Use --only once.'; only=$2 ;;
            --api-key-gate) gate=$2 ;;
         esac
         shift 2 ;;
      --help|-h) usage; exit 0 ;;
      *) stop 'Unknown option. Use --help.' ;;
   esac
done
case "$only" in ""|reads|auth|validation|rate|privacy|time|register) ;; *) stop 'Invalid --only group.' ;; esac
case "$gate" in open|closed) ;; *) stop 'API-key gate must be open or closed.' ;; esac

WP=${WP:-}
KEY=${KEY:-}
JWT=${JWT:-}
if [[ -n $env_file ]]; then
   [[ -f $env_file && -r $env_file ]] || stop 'Cannot read env file.'
   line=""
   while IFS= read -r line || [[ -n $line ]]; do
      line=${line%$'\r'}
      [[ $line =~ ^[[:space:]]*(#|$) ]] && continue
      [[ $line =~ ^[[:space:]]*(KEY|JWT|WP)[[:space:]]*=(.*)$ ]] || stop 'Env file accepts only KEY, JWT and WP assignments.'
      name=${BASH_REMATCH[1]}
      value=${BASH_REMATCH[2]}
      value=${value#"${value%%[![:space:]]*}"}
      value=${value%"${value##*[![:space:]]}"}
      if [[ ${#value} -ge 2 ]]; then
         first=${value:0:1}
         if [[ ( $first == '"' || $first == "'" ) && ${value: -1} == "$first" ]]; then
            value=${value:1:${#value}-2}
         fi
      fi
      case "$name" in KEY) KEY=$value ;; JWT) JWT=$value ;; WP) WP=$value ;; esac
   done < "$env_file"
fi
for value in "$WP" "$KEY" "$JWT" "${COOKIE:-}"; do
   [[ $value != *$'\n'* && $value != *$'\r'* ]] || stop 'Multiline environment values are not allowed.'
done

SLUG=${SLUG:-robot-collector}
TIME_SLUG=${TIME_SLUG:-}
RUN_REGISTER=${RUN_REGISTER:-0}
[[ $SLUG =~ ^[a-z0-9-]{1,40}$ ]] || stop 'Invalid SLUG.'
case "$TIME_SLUG" in ""|escape-room|obstacle-race) ;; *) stop 'TIME_SLUG must be escape-room or obstacle-race.' ;; esac
case "$RUN_REGISTER" in 0|1) ;; *) stop 'RUN_REGISTER must be 0 or 1.' ;; esac
[[ $only != time || -n $TIME_SLUG ]] || stop '--only time needs TIME_SLUG.'
OK_SCORE=${OK_SCORE:-100}
OK_MS=${OK_MS:-30000}
BAD_SCORE=${BAD_SCORE:-1500}
BAD_MS=${BAD_MS:-5000}
for value in "$OK_SCORE" "$OK_MS" "$BAD_SCORE" "$BAD_MS"; do
   [[ $value =~ ^[0-9]{1,9}$ ]] || stop 'Score/duration fixtures must be nonnegative integers, at most nine digits.'
done

run() { printf '{"slug":"%s","score":%s,"duration_ms":%s}' "$1" "$2" "$3"; }
V=$(run "$SLUG" "$OK_SCORE" "$OK_MS")
selected() { [[ -z $only || $only == "$1" ]]; }
phase="count"
planned_requests=0
planned_submits=0
planned_rate_limited_submits=0
planned_wait_ms=0
sent_submits=0
pass=0
fail=0
printed=0

wait_for() {
   if [[ $phase == count ]]; then
      case "$1" in 3.2) planned_wait_ms=$((planned_wait_ms + 3200)) ;; 61) planned_wait_ms=$((planned_wait_ms + 61000)) ;; esac
   elif [[ $phase == dry ]]; then
      [[ $1 != 61 ]] || say 'WAIT 61 s (fresh per-user submit window)'
   else
      sleep "$1" || stop 'Wait interrupted.'
   fi
}
gap() { wait_for 3.2; }
section() { [[ $phase == count ]] || say "== $*"; }

# Only this stream contains credentials; curl reads it on stdin, never from argv.
config() {
   local value=$2
   value=${value//\\/\\\\}
   value=${value//\"/\\\"}
   printf '%s = "%s"\n' "$1" "$value"
}
curl_config() {
   local method=$1 path=$2 auth=$3 key=$4 data=$5 kind=$6
   config url "$WP$path"
   config request "$method"
   case "$key" in
      real) [[ -z $KEY ]] || config header "X-API-Key: $KEY" ;;
      wrong) config header "X-API-Key: ${KEY}x" ;;
   esac
   case "$auth" in
      jwt) config header "Authorization: Bearer $JWT" ;;
      forged) config header 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxfQ.forged' ;;
      cookie) config header "Cookie: ${COOKIE:-wordpress_logged_in_x=fake}" ;;
   esac
   if [[ $method == POST ]]; then
      config header 'Content-Type: application/json'
      config data "$data"
   fi
   [[ $kind != header ]] || printf 'include\n'
}

# name, status, WP code, body/header regex, method, relative path, auth, key, body, kind
check() {
   local name=$1 want=$2 code=$3 pattern=$4 method=$5 path=$6 auth=$7 key=$8 data=${9:-} kind=${10:-body}
   if [[ $phase == count ]]; then
      planned_requests=$((planned_requests + 1))
      if [[ $method == POST && $path == /arcade/scores ]]; then
         planned_submits=$((planned_submits + 1))
         [[ $want != 429 ]] || planned_rate_limited_submits=$((planned_rate_limited_submits + 1))
      fi
      return
   fi
   if [[ $phase == dry ]]; then
      printed=$((printed + 1))
      say "PLAN $printed $method \$WP$path [auth=$auth key=$key] => $want $code: $name"
      return
   fi
   last_run=$(date +%s) || stop 'Cannot read clock.'
   if [[ $method == POST && $path == /arcade/scores ]]; then
      used=$((used + 1))
      sent_submits=$((sent_submits + 1))
   fi
   write_state
   local out status body headers
   # -q disables .curlrc (which could enable tracing/redirects). No automatic retries.
   if ! out=$(curl_config "$method" "$path" "$auth" "$key" "$data" "$kind" |
      curl -q --config - --silent --connect-timeout 10 --max-time 30 --write-out $'\n%{http_code}' 2>/dev/null); then
      fail=$((fail + 1))
      say "FAIL $name: transport error (details suppressed)"
      return
   fi
   status=${out##*$'\n'}
   body=${out%$'\n'*}
   body=${body//$'\r'/}
   headers=${body%%$'\n\n'*}
   if [[ $status == "$want" ]] &&
      { [[ $code == - ]] || grep -qE "\"code\"[[:space:]]*:[[:space:]]*\"$code\"" <<< "$body"; } &&
      { [[ $pattern == - ]] || { [[ $kind == header ]] && grep -qiE "$pattern" <<< "$headers"; } ||
         { [[ $kind == body ]] && grep -qE "$pattern" <<< "$body"; }; }; then
      pass=$((pass + 1))
      say "PASS $name"
   else
      fail=$((fail + 1))
      # No raw body, headers, URL, curl error or credentials, even if the server echoes them.
      [[ $status =~ ^[0-9]{3}$ ]] || status="unknown"
      say "FAIL $name: HTTP $status; expected $want $code and response pattern"
   fi
}

suite() {
   if selected reads; then
      section 'reads'
      check 'games: with key' 200 - "\"$SLUG\"" GET /arcade/games none real
      if [[ $gate == open ]]; then
         check 'games: no key (gate open)' 200 - "\"$SLUG\"" GET '/arcade/games?_=smoke-no-key' none none
         check 'games: wrong key (gate open)' 200 - "\"$SLUG\"" GET '/arcade/games?_=smoke-wrong-key' none wrong
      else
         check 'games: no key' 401 missing_api_key - GET '/arcade/games?_=smoke-no-key' none none
         check 'games: wrong key' 403 invalid_api_key - GET '/arcade/games?_=smoke-wrong-key' none wrong
      fi
      check 'board: guest' 200 - '"me"[[:space:]]*:[[:space:]]*null' GET "/arcade/leaderboard/$SLUG?limit=10" none real
      check 'board: forged JWT ignored' 200 - '"me"[[:space:]]*:[[:space:]]*null' GET "/arcade/leaderboard/$SLUG" forged real
      check 'board: limit clamped' 200 - '"entries"[[:space:]]*:' GET "/arcade/leaderboard/$SLUG?limit=999" none real
      check 'board: unknown slug' 404 not_found - GET /arcade/leaderboard/no-such-game none real
      check 'board: public cache' 200 - '^cache-control:.*public' GET "/arcade/leaderboard/$SLUG" none real '' header
      check 'board: private with JWT' 200 - '^cache-control:.*private' GET "/arcade/leaderboard/$SLUG" jwt real '' header
      check 'me: ok' 200 - - GET /arcade/me jwt real
      check 'me: no JWT' 401 unauthorized - GET /arcade/me none real
      check 'me: forged JWT' 401 unauthorized - GET /arcade/me forged real
   fi
   if selected auth; then
      section 'submit auth'
      check 'submit: no JWT' 401 unauthorized - POST /arcade/scores none real "$V"
      check 'submit: cookie only' 401 unauthorized - POST /arcade/scores cookie real "$V"
      if [[ $gate == open ]]; then
         check 'submit: no API key (gate open)' 200 - '"success"[[:space:]]*:[[:space:]]*true' POST /arcade/scores jwt none "$V"
         gap
      else
         check 'submit: no API key' 401 missing_api_key - POST /arcade/scores jwt none "$V"
      fi
      check 'submit: forged JWT' 401 unauthorized - POST /arcade/scores forged real "$V"
      check 'submit: bad slug' 400 invalid_data - POST /arcade/scores jwt real "$(run 'Robot!' 10 "$OK_MS")"
      check 'submit: unknown slug' 404 not_found - POST /arcade/scores jwt real "$(run no-such-game 10 "$OK_MS")"
   fi
   if selected validation; then
      section 'validation (3.2 s gaps; final immediate submit expects 429)'
      check 'submit: valid' 200 - '"success"[[:space:]]*:[[:space:]]*true' POST /arcade/scores jwt real "$V"; gap
      check 'me: has slug' 200 - "\"$SLUG\"[[:space:]]*:[[:space:]]*\\{[[:space:]]*\"best\"[[:space:]]*:" GET /arcade/me jwt real
      check 'board: me filled' 200 - '"me"[[:space:]]*:[[:space:]]*\{[[:space:]]*"rank"[[:space:]]*:[[:space:]]*[0-9]+' GET "/arcade/leaderboard/$SLUG" jwt real
      check 'submit: score 99999' 400 invalid_data - POST /arcade/scores jwt real "$(run "$SLUG" 99999 "$OK_MS")"; gap
      check 'submit: implausible' 400 invalid_data - POST /arcade/scores jwt real "$(run "$SLUG" "$BAD_SCORE" "$BAD_MS")"; gap
      check 'submit: duration_ms 100' 400 invalid_data - POST /arcade/scores jwt real "$(run "$SLUG" 10 100)"; gap
      check 'submit: negative score' 400 invalid_data - POST /arcade/scores jwt real "$(run "$SLUG" -5 "$OK_MS")"; gap
      check 'submit: float score' 400 invalid_data - POST /arcade/scores jwt real "$(run "$SLUG" 12.5 "$OK_MS")"; gap
      check 'submit: no duration' 400 invalid_data - POST /arcade/scores jwt real "{\"slug\":\"$SLUG\",\"score\":10}"; gap
      check 'submit: valid again' 200 - '"plays"[[:space:]]*:[[:space:]]*[0-9]+' POST /arcade/scores jwt real "$V"
      check 'submit: 3 s gap' 429 rate_limited - POST /arcade/scores jwt real "$V"
   fi
   if selected time; then
      if [[ -n $TIME_SLUG ]]; then
         section 'time game'
         local time_base=600000
         [[ $TIME_SLUG != obstacle-race ]] || time_base=300000
         check 'time: client score ignored' 200 - "\"score\"[[:space:]]*:[[:space:]]*$(((time_base - 60000) / 10))," POST /arcade/scores jwt real "$(run "$TIME_SLUG" 999999 60000)"
      else
         section 'time skipped (set TIME_SLUG to an enabled time game)'
      fi
   fi
   if selected rate; then
      section 'rate (10 per minute per user)'
      wait_for 61
      local i
      for i in 1 2 3 4 5 6 7 8 9 10; do
         check "minute #$i" 200 - - POST /arcade/scores jwt real "$V"; gap
      done
      check 'minute #11' 429 rate_limited - POST /arcade/scores jwt real "$V"
   fi
   if selected privacy; then
      section 'privacy'
      check 'privacy: get' 200 - '"hide_name"[[:space:]]*:[[:space:]]*(true|false)' GET /arcade/me/privacy jwt real
      check 'privacy: hide' 200 - '"hide_name"[[:space:]]*:[[:space:]]*true' POST /arcade/me/privacy jwt real '{"hide_name":true}'
      check 'board: shows Anonymous' 200 - '"name"[[:space:]]*:[[:space:]]*"Anonymous"[^}]*"is_me"[[:space:]]*:[[:space:]]*true' GET "/arcade/leaderboard/$SLUG?limit=50" jwt real
      check 'privacy: show' 200 - '"hide_name"[[:space:]]*:[[:space:]]*false' POST /arcade/me/privacy jwt real '{"hide_name":false}'
      check 'privacy: bad body' 400 invalid_data - POST /arcade/me/privacy jwt real '{}'
      check 'privacy: no JWT' 401 unauthorized - POST /arcade/me/privacy none real '{"hide_name":true}'
   fi
   if selected register; then
      if [[ $RUN_REGISTER == 1 || $only == register ]]; then
         section 'register (may block sign-ups from this IP for 1 h)'
         local i
         for i in 1 2 3 4 5; do check "register #$i" 400 missing_fields - POST /auth/register none real '{}'; done
         check 'register #6' 429 rate_limited - POST /auth/register none real '{}'
      else
         section 'register skipped (RUN_REGISTER=1 or --only register)'
      fi
   fi
}

suite
if (( dry_run )); then
   phase="dry"
   say "DRY RUN: API-key gate $gate; no requests, waits or timestamp writes."
   suite
   say "Planned requests: $planned_requests; score submits: $planned_submits/30; expected rate-limited score submits: $planned_rate_limited_submits; waits: $planned_wait_ms ms."
   exit 0
fi

[[ -n $WP ]] || stop 'WP is required.'
WP=${WP%/}
case "$WP" in http://*/play50/v1|https://*/play50/v1) ;; *) stop 'WP must be an HTTP(S) REST base ending in /play50/v1.' ;; esac
[[ ! $WP =~ [[:space:]] && $WP != *'@'* && $WP != *'?'* && $WP != *'#'* ]] || stop 'WP must not contain credentials, whitespace, query or fragment.'
[[ $only == register || -n $JWT ]] || stop 'JWT is required.'
[[ -n $KEY ]] || stop 'KEY is required.'
for program in curl sed grep date sleep mktemp mv mkdir rmdir rm; do command -v "$program" >/dev/null || stop 'Required shell tool is missing.'; done

temp_root=${TMPDIR:-${TEMP:-/tmp}}
temp_root=${temp_root//\\//}
[[ -d $temp_root ]] || stop 'System temp directory is unavailable.'
state_file="$temp_root/play50-arcade-api-smoke.state"
lock_dir="$state_file.lock"
[[ ! -L $state_file && ! -d $state_file ]] || stop 'Unsafe budget state path.'
mkdir "$lock_dir" 2>/dev/null || stop 'Another smoke run holds the budget lock; inspect stale locks before retrying.'
state_tmp=""
guard_ready=0
write_state() {
   printf '%s %s %s\n' "$last_run" "$window_start" "$used" > "$state_tmp" && mv -f "$state_tmp" "$state_file" || stop 'Cannot record budget state.'
}
cleanup() {
   if (( guard_ready )); then
      last_run=$(date +%s)
      printf '%s %s %s\n' "$last_run" "$window_start" "$used" > "$state_tmp" && mv -f "$state_tmp" "$state_file"
   fi
   [[ -z $state_tmp || ! -f $state_tmp ]] || rm -f "$state_tmp"
   rmdir "$lock_dir" 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
state_tmp=$(mktemp "$temp_root/play50-arcade-smoke-state.XXXXXX") || stop 'Cannot allocate budget state.'
now=$(date +%s) || stop 'Cannot read clock.'
last_run=0
window_start=$now
used=0
if [[ -f $state_file ]]; then
   IFS=' ' read -r last_run window_start used extra < "$state_file" || stop 'Invalid budget state.'
   [[ $last_run =~ ^[0-9]{1,10}$ && $window_start =~ ^[0-9]{1,10}$ && $used =~ ^[0-9]{1,2}$ && -z $extra ]] || stop 'Invalid budget state.'
   last_run=$((10#$last_run))
   window_start=$((10#$window_start))
   used=$((10#$used))
   (( now >= last_run && now >= window_start )) || stop 'Budget clock moved backwards.'
   [[ -n $only ]] || (( now - last_run >= 600 )) || stop 'Full run refused: another run happened within 10 minutes.'
   if (( now - window_start >= 600 )); then window_start=$now; used=0; fi
fi
(( used + planned_submits <= 30 )) || stop 'Run refused: conservative submit budget would exceed 30 per 10 minutes.'
guard_ready=1
last_run=$now
write_state
phase="live"
say "API-key gate $gate; planned score submits $planned_submits/30, including $planned_rate_limited_submits expected rate-limited probes."
suite
say "Passed: $pass; Failed: $fail; Score submits: $sent_submits (includes expected 429s)."
exit "$fail"
