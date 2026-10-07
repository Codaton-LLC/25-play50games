# tools/thumbs — in-game thumbnail capture

Captures real in-game thumbnails for the 10 3D Arcade games: drives headless
Chrome over the DevTools protocol (raw `ws`, no puppeteer), declines the cookie
banner, clicks Play, waits out the 3-2-1 countdown, plays a few seconds with a
per-game input script (`inputs.mjs`), checks the run is still on (no result
panel, no pause or error overlay, and the shell's Pause button still enabled
before and after the shot, so a crash inside the result delay is not caught;
such a run is played once more), hides every HTML overlay above the canvas
(a style rule, so a panel that mounts late stays hidden too), screenshots the
canvas (1280x720 layout at 2x, or a `{ zoom }` window of it) and post-processes
it with sharp (16:9, 640x360, webp, quality tuned so each file is <= 60 KB; a
blank canvas or an oversized file fails).

## Setup

```sh
npm install sharp ws --prefix tools/thumbs
```

(`package.json` / `package-lock.json` / `node_modules` here are intentionally
gitignored — this folder is self-contained.)

## Start the server

From `play50games-frontend/` (flags must be set at build time, Next inlines them;
without `NEXT_PUBLIC_ARCADE_ENABLED` every `/3d/<slug>` is 404 and the tool stops):

```sh
NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 npx next build
npx next start -p 3100
```

Only a local server is accepted (`localhost`, `127.0.0.1`, `[::1]`, `*.localhost`):
the tool plays real runs, so it never points at production.

## Run

```sh
# all ten games -> tools/thumbs/out/<slug>.webp (gitignored)
node tools/thumbs/capture.mjs

# rerun one or two games
node tools/thumbs/capture.mjs --slugs robot-collector,clean-city

# other options (--out is relative to the current directory)
node tools/thumbs/capture.mjs --base-url http://localhost:3100 --out tools/thumbs/out
node tools/thumbs/capture.mjs --chrome "C:\Program Files\Google\Chrome\Application\chrome.exe"   # or CHROME_PATH
node tools/thumbs/capture.mjs --write   # also copy into play50games-frontend/public/images/3d/<slug>.webp
```

Nothing is written outside `--out` unless `--write` is given. Look at every
image before committing the `--write` copies.

Chrome is launched with a temporary profile and closed by the script itself
(Ctrl+C included); the profile is deleted afterwards. Exit code = number of
failed games (99 = setup error, 130 = interrupted); a summary table (slug,
ok/fail, KB, path) prints at the end.

Per-game input scripts live in `inputs.mjs` — one data entry per game, easy to
tune (tap / hold / down / up / click-at-canvas-fraction / wait steps). The shot
is taken right after the last step, so end a script on a held key (`down`) or a
fresh jump to catch the character mid-move. A `{ zoom: 1..2, at: [x, y] }` step
frames the shot on a canvas-shaped window around a point (the desktop camera of
the top-down games shows the whole board, so the hero is tiny without it); the
2x screenshot keeps at least one source pixel per output pixel up to zoom 2.
The Open Graph cards (`tools/og`) crop the middle of each thumbnail to a square,
so keep the hero near the centre of the shot.
