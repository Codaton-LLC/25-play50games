# Arcade API smoke suite

`arcade-api-smoke.sh` maintains the curl checks from §13 of `docs/arcade-api.md`. Run live checks only with the dedicated `arcade-test` account after the §13 prerequisites are satisfied. Codex must not run the live suite against production; Claude owns that run.

## Setup and commands

The script is Bash-compatible, including Git Bash on Windows. Provide `WP`, `KEY`, and `JWT` through the environment or a private env file. The REST base must end in `/play50/v1`. `KEY` may stay empty while the API-key gate is open (the server ignores it); `--api-key-gate closed` requires it.

```bash
export WP="https://<cms-host>/wp-json/play50/v1"
read -rs KEY && export KEY
read -rs JWT && export JWT

bash tools/arcade-api-smoke.sh --dry-run
bash tools/arcade-api-smoke.sh
bash tools/arcade-api-smoke.sh --only reads
bash tools/arcade-api-smoke.sh --only time
bash tools/arcade-api-smoke.sh --only register
```

An env file is parsed as data, never sourced or executed. Use one assignment per line (an optional `export ` prefix is accepted); blank lines, comment lines and CRLF line endings are allowed. Values may be unquoted or wrapped in matching single or double quotes; there are no inline comments.

```text
WP=https://<cms-host>/wp-json/play50/v1
KEY=<frontend-api-key>
JWT=<arcade-test-jwt>
```

```bash
bash tools/arcade-api-smoke.sh --env ~/.play50/arcade-api-smoke.env --dry-run
bash tools/arcade-api-smoke.sh --env ~/.play50/arcade-api-smoke.env --only privacy
```

A file value overrides the corresponding environment variable. `--dry-run` needs no credentials and sends no requests, waits, or budget-state writes. It prints the planned method/path, expected result, request count, score-submit budget, and intentional waits without printing the configured host or credential values.

## Options and groups

| Option | Meaning |
|---|---|
| `--env FILE` | Read `WP`, `KEY`, and `JWT` assignments from a local env file. |
| `--only GROUP` | Run just `reads`, `auth`, `validation`, `rate`, `privacy`, `time`, or `register`. Specify once. |
| `--dry-run` | Print the selected request plan without network activity. |
| `--api-key-gate open\|closed` | Select expected results for an absent/incorrect API key; default is `open`. |
| `--help` | Print usage. |

`SLUG` defaults to `robot-collector` and must be enabled on the test site. `TIME_SLUG` is optional (`escape-room` or `obstacle-race`) and must also be enabled; set it to run the time-game score calculation check. `RUN_REGISTER=1` adds the optional registration rate-limit check to a full run. `--only register` runs it regardless of that variable; it may block sign-ups from the test IP for one hour. The validation fixtures can be changed with `OK_SCORE`, `OK_MS`, `BAD_SCORE`, and `BAD_MS`; defaults match the §13 robot-collector contract.

Groups mirror §13:

- `reads`: game catalog API-key behavior, guest/private leaderboard reads, cache headers, and `/me` authentication.
- `auth`: score-submit authentication, API-key behavior, malformed slug, and unknown game.
- `validation`: accepted and rejected scores/durations, profile and leaderboard visibility, and the per-game 3-second rate limit.
- `rate`: eleven score attempts across a fresh per-user minute window; the final attempt must be rate-limited.
- `privacy`: read, hide, show, malformed body, and unauthenticated privacy updates. "board: shows Anonymous" reads the top 50, so it fails when the test user's score is not in the top 50 of a live board.
- `time`: optional server-computed score for an enabled time game.
- `register`: optional five-per-hour registration limit using empty bodies, so no account is created.

The default API-key gate is `open`, matching the current server where `PLAY50_API_KEY` is not configured. In open mode, catalog reads without or with a wrong key expect HTTP 200. The no-key score-auth probe uses the valid dedicated test JWT and score fixture, so the request reaches the submit handler and expects HTTP 200; this is a counted test score and must be removed by the §13 cleanup. With `--api-key-gate closed`, missing and invalid keys expect 401 and 403 respectively.

## Rate budget and output

The suite conservatively counts every `POST /arcade/scores` attempt, including invalid/auth-failure probes and expected 429s. A default full run plans 26 score attempts (27 when `TIME_SLUG` is set); it separately reports the two expected rate-limited score probes. The server limit is 30 per IP per 10 minutes, so the run refuses when the rolling attempt budget would exceed that limit.

A full live run is refused if a prior live run was recorded less than 10 minutes ago. The timestamp and rolling count are kept under `${TMPDIR:-${TEMP:-/tmp}}/play50-arcade-api-smoke.state`; a temporary lock prevents overlapping runs. Dry runs do not inspect or change this state. Wait 10 minutes between full runs. An interrupted run may leave a lock directory; verify no suite is active before removing a stale lock.

Each `PASS` or `FAIL` reports only the case name and status. Response bodies and curl diagnostics are never printed, and `eyJ...` token-shaped text is redacted from script output. Credentials reach curl only through its config on stdin, never its argv. The process exits with the number of failed checks; setup, safety-guard, and usage errors exit 1.

The suite changes the dedicated user's score rows and privacy setting; until cleanup the test scores are visible on the public board. Follow the manual cases and always perform the cleanup in §13 after a live run. Once real players are on a board, clean up by deleting the `arcade-test` rows only; **Reset game** deletes every player's scores.