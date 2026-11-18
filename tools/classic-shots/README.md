# Classic Games Screenshot Harness (`tools/classic-shots`)

Captures before/after comparison screenshots for the 50 classic 2D games (`/games/1` .. `/games/50`) at `390x844`, `360x740`, and `1180x820`.

## What It Does

1. **Localhost-only guard**: Accepts only `http://localhost:<port>` as the base URL and refuses any other host or protocol so production is never scripted.
2. **Unlocks all classic games locally**: Seeds `localStorage.play50games_progress` (and `play50games_guest_id`) in the test browser using the exact `GameProgress` shape read by `play50games-frontend/src/lib/storage/progressStorage.ts`.
3. **Blocks writes to the CMS**: Intercepts requests to `cms.play50.games` and blocks every non-`GET` request.
4. **Starts each game and captures 3 viewports**:
   - Visits `/games/<id>`
   - Accepts the cookie banner via its **Accept** button
   - Clicks **Start Game** and waits `1.5 s`
   - Saves screenshots at `390x844`, `360x740`, and `1180x820` to `tools/classic-shots/out/<label>/<id>-<w>x<h>.png`
   - Writes per-game console errors to `tools/classic-shots/out/<label>/errors.json`

## How to Run

Start the local frontend server (for example on port `3250`), then from the repository root run:

```bash
# Capture all 50 classic games into tools/classic-shots/out/before/
node tools/classic-shots/shoot.mjs http://localhost:3250 before

# Capture all 50 classic games into tools/classic-shots/out/after/
node tools/classic-shots/shoot.mjs http://localhost:3250 after
```

### Subset / Smoke Run

You can pass `--ids` (or a third positional argument) to capture specific game IDs:

```bash
node tools/classic-shots/shoot.mjs http://localhost:3460 smoke --ids 1,18,24,41,49
```

### Options

- `<baseUrl>` (required): `http://localhost:<port>`
- `<label>` (optional, default `before`): Output subfolder under `tools/classic-shots/out/<label>/`
- `--ids <list>`: Comma-separated list of game IDs in `1..50` (e.g. `1,18,24,41,49`)
- `--chrome <path>`: Path to Chrome binary (defaults to `CHROME_PATH` or standard OS install path)
