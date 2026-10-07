# tools/thumbs — in-game thumbnail capture

Captures real in-game thumbnails for the 10 3D Arcade games: drives headless
Chrome over the DevTools protocol (raw `ws`, no puppeteer), declines the cookie
banner, clicks Play, waits out the 3-2-1 countdown, plays a few seconds with a
per-game input script (`inputs.mjs`), hides every HTML overlay above the canvas,
screenshots the canvas and post-processes it with sharp (16:9, 640x360, webp,
quality tuned so each file is <= 60 KB).

## Setup

```sh
npm install sharp ws --prefix tools/thumbs
```

(`package.json` / `package-lock.json` / `node_modules` here are intentionally
gitignored — this folder is self-contained.)

## Start the server

From `play50games-frontend/` (flags must be set at build time, Next inlines them):

```sh
NEXT_PUBLIC_ARCADE_ENABLED=1 NEXT_PUBLIC_ARCADE_API_MOCK=1 NEXT_PUBLIC_ARCADE_LEADERBOARD=1 npm run build
npx next start -p 3100
```

## Run

```sh
# all ten games -> tools/thumbs/out/<slug>.webp
node tools/thumbs/capture.mjs

# rerun one game
node tools/thumbs/capture.mjs --slugs robot-collector

# other options
node tools/thumbs/capture.mjs --base-url http://localhost:3100 --out tools/thumbs/out
node tools/thumbs/capture.mjs --write   # also copy into play50games-frontend/public/images/3d/<slug>.webp
```

Chrome (`C:\Program Files\Google\Chrome\Application\chrome.exe`) is launched and
killed by the script itself. Exit code = number of failed games; a summary table
(slug, ok/fail, KB, path) prints at the end.

Per-game input scripts live in `inputs.mjs` — one data entry per game, easy to
tune (tap / hold / click-at-canvas-fraction / wait steps).
