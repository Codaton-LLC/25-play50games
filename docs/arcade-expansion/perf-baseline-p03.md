# Perf baseline, P-03 (core v3), 2026-10-08

The ten existing games measured on branch `claude/expansion-fx` (P-03) and on its base `55924ab` (main before P-03), for the regression gate in 06 §10.5. Kimi's P-07 turns these numbers into `tools/perf/baseline.json`.

## How it was measured

- Local production builds with `NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1`, `next start -p 3106`, never production.
- Headless Chrome (new headless, ANGLE d3d11, Windows 11 desktop), 1280 × 720 CSS px, device scale factor 1, over CDP. Cookie banner declined, Play, the game's `tools/thumbs` input script, then 20 s more in which the script is replayed in a loop (Retry clicked when a run ended; `retries` below). Once at CPU throttling 1× and once at 4× (`Emulation.setCPUThrottlingRate`).
- Two independent sources:
  - **probe** = `window.__arcadePerf` from `core/perfProbe.tsx` (`?perf=1`), read at the end: `calls` / `triangles` of the last frame, `maxCalls` since the stage mounted, live `geometries` / `textures` / `programs`, and frame-time p50 / p95 / max (ms) over the last 600 unpaused frames.
  - **counted** = a script injected before the page loads that counts WebGL `draw*` calls per `requestAnimationFrame` and the rAF intervals during the 20 s window only (works on builds without the probe, so main and P-03 are compared with the same tool). `draws` = median / max over frames that drew.
- Headless Chrome is vsync-locked at 60 Hz and GPU-bound here, so 4× CPU throttling barely moves the frame times on this machine: the 4× numbers are a regression signal, not a phone estimate (06 §10.1). A real phone run (`?perf=1` and the overlay) is still needed before each go-live.
- No console errors (console.error, uncaught exceptions, Log errors) in any of the 40 runs (20 per build).

## P-03 build (`?perf=1`)

| Game | CPU | draws med / max (counted) | probe calls / maxCalls | triangles | geometries | textures | programs | probe p50 / p95 / max ms | rAF p95 ms (counted) | retries |
|---|---|---|---|---|---|---|---|---|---|---|
| robot-collector | 1× | 17 / 17 | 17 / 17 | 54 390 | 12 | 14 | 8 | 16.7 / 16.8 / 17.9 | 16.8 | 0 |
| food-catcher | 1× | 12 / 14 | 12 / 14 | 24 382 | 18 | 17 | 7 | 16.7 / 16.8 / 33.4 | 16.8 | 0 |
| office-escape | 1× | 21 / 22 | 20 / 22 | 37 594 | 23 | 27 | 12 | 16.7 / 16.8 / 32.9 | 16.8 | 2 |
| pigeon-crossing | 1× | 10 / 13 | 10 / 13 | 13 274 | 9 | 12 | 5 | 16.7 / 16.8 / 33.4 | 16.8 | 0 |
| penalty-hero | 1× | 25 / 27 | 27 / 27 | 36 920 | 27 | 12 | 6 | 16.7 / 16.8 / 93.8 | 16.8 | 1 |
| warehouse-rush | 1× | 19 / 19 | 19 / 19 | 42 210 | 15 | 22 | 12 | 16.7 / 16.9 / 19.5 | 16.8 | 0 |
| tower-climb | 1× | 11 / 14 | 11 / 14 | 18 337 | 7 | 10 | 6 | 16.7 / 16.8 / 18.2 | 16.8 | 0 |
| clean-city | 1× | 17 / 18 | 17 / 18 | 58 992 | 18 | 22 | 8 | 16.7 / 16.8 / 18.8 | 16.8 | 0 |
| escape-room | 1× | 30 / 32 | 30 / 32 | 32 106 | 32 | 13 | 7 | 16.7 / 16.9 / 21.7 | 16.8 | 0 |
| obstacle-race | 1× | 33 / 36 | 32 / 36 | 86 826 | 27 | 11 | 11 | 16.7 / 17.3 / 20.1 | 16.8 | 0 |
| robot-collector | 4× | 17 / 17 | 17 / 17 | 54 390 | 12 | 14 | 8 | 16.7 / 25.8 / 48.0 | 17.1 | 0 |
| food-catcher | 4× | 12 / 18 | 11 / 18 | 21 882 | 21 | 20 | 7 | 16.9 / 32.3 / 98.6 | 33.3 * | 0 |
| office-escape | 4× | 20 / 22 | 21 / 22 | 45 100 | 23 | 27 | 12 | 16.7 / 19.4 / 130.6 | 16.8 | 2 |
| pigeon-crossing | 4× | 12 / 12 | 12 / 12 | 23 274 | 9 | 12 | 5 | 16.7 / 17.4 / 38.4 | 16.8 | 0 |
| penalty-hero | 4× | 25 / 27 | 25 / 27 | 36 854 | 27 | 12 | 6 | 16.7 / 17.6 / 158.4 | 16.8 | 0 |
| warehouse-rush | 4× | 19 / 19 | 19 / 19 | 42 218 | 15 | 22 | 12 | 16.7 / 17.6 / 34.3 | 16.8 | 0 |
| tower-climb | 4× | 11 / 12 | 11 / 12 | 18 325 | 7 | 10 | 6 | 16.7 / 17.3 / 35.4 | 16.8 | 0 |
| clean-city | 4× | 17 / 17 | 17 / 17 | 60 550 | 17 | 22 | 8 | 16.7 / 17.2 / 22.3 | 16.8 | 0 |
| escape-room | 4× | 30 / 32 | 30 / 32 | 32 106 | 32 | 13 | 7 | 16.7 / 17.5 / 22.5 | 16.8 | 0 |
| obstacle-race | 4× | 33 / 36 | 32 / 36 | 86 826 | 27 | 11 | 11 | 16.7 / 17.1 / 18.7 | 16.8 | 0 |

\* The first 4× run of food-catcher had a rAF p95 of 33.3 ms; two reruns of food-catcher, robot-collector and office-escape at 4× on the same P-03 build gave rAF p95 16.8 ms (probe p95 17.0–18.2 ms), with and without `?perf=1`, like main. One noisy run, not a regression.

## Main (`55924ab`, same tool, counted only: main has no probe)

| Game | draws med / max 1× | rAF p50 / p95 1× | draws med / max 4× | rAF p50 / p95 4× |
|---|---|---|---|---|
| robot-collector | 17 / 17 | 16.7 / 16.8 | 13 / 17 | 16.7 / 16.8 |
| food-catcher | 11 / 14 | 16.7 / 16.8 | 11 / 18 | 16.7 / 16.8 |
| office-escape | 21 / 22 | 16.7 / 16.8 | 20 / 22 | 16.7 / 16.8 |
| pigeon-crossing | 11 / 12 | 16.7 / 16.8 | 12 / 13 | 16.7 / 16.8 |
| penalty-hero | 25 / 27 | 16.7 / 16.8 | 25 / 27 | 16.7 / 16.8 |
| warehouse-rush | 19 / 19 | 16.7 / 16.8 | 19 / 19 | 16.7 / 16.8 |
| tower-climb | 11 / 12 | 16.7 / 16.8 | 11 / 12 | 16.7 / 16.8 |
| clean-city | 17 / 17 | 16.7 / 16.8 | 17 / 18 | 16.7 / 16.8 |
| escape-room | 30 / 32 | 16.7 / 16.8 | 30 / 32 | 16.7 / 16.8 |
| obstacle-race | 33 / 36 | 16.7 / 16.8 | 33 / 36 | 16.7 / 16.8 |

## Result

- Draw calls: the per-game maximum is the same on main and P-03 within the run-to-run spread of the scripted play (e.g. pigeon-crossing 12–13, tower-climb 12–14 and food-catcher 14–18 vary between runs of the same build as traffic, ledges and food come and go). The fx and env layers mount nothing in a game that does not use them, and the probe only exists with `?perf=1`.
- Frame time: p95 16.8 ms on both builds in the counted window (vsync-bound), apart from the one noisy run above. No regression beyond the gate (+10 % calls, +20 % p95).
- `probe calls` matches the independent per-frame draw count in every game, so `gl.info.render.calls` read at the start of the next frame is a whole frame.
