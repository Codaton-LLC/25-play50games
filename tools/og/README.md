# Open Graph cards

Static social previews for Play50Games. 1200×630 PNG, each at most 200 KB. No trailer. Page metadata is not wired here; Claude adds `openGraph.images` in the C1 files.

Palette is the site one: background `#0b1020`, accent `#7dd3fc`, white text. Type is Segoe UI (Arial if that face is missing). Sharp draws the type through SVG, so a normal Windows font install is enough. The font file is not copied into the repo.

## Regenerate

From the repo root, install sharp only inside this folder (do not add it to `play50games-frontend`):

```
npm install sharp --prefix tools/og
node tools/og/generate.mjs
```

`tools/og/package.json` and `package-lock.json` pin sharp. `node_modules` stays untracked.

The script writes:

| File | What it is |
|---|---|
| `play50games-frontend/public/images/og/hub.png` | Hub. "Classic brain games and a 3D Arcade." |
| `play50games-frontend/public/images/og/classic.png` | Classic 50. The big 50 and "Play Classic 50 Games." |
| `play50games-frontend/public/images/og/arcade.png` | Arcade index. Wordmark `3D Arcade \| Play50Games`. |
| `play50games-frontend/public/images/og/3d/<slug>.png` | One card per arcade game. |

Game cards place the existing thumbnail `public/images/3d/<slug>.webp` in a rounded frame on the left (cover crop) and the game title plus the wordmark on the right. `clean-city.webp` and `escape-room.webp` are not on `main` yet; if the file is missing, the script reads it from `origin/cursor/game-<slug>-scene`. Tower Climb has no thumbnail, so that card is type and a stack of platforms, not a screenshot.

PNGs are palette-quantized (128 colours, then fewer if needed) so they stay under 200 KB.

## Paths Claude should attach

| Route | Image URL |
|---|---|
| `/` | `/images/og/hub.png` |
| `/classic` | `/images/og/classic.png` |
| `/3d` | `/images/og/arcade.png` |
| `/3d/robot-collector` | `/images/og/3d/robot-collector.png` |
| `/3d/food-catcher` | `/images/og/3d/food-catcher.png` |
| `/3d/office-escape` | `/images/og/3d/office-escape.png` |
| `/3d/pigeon-crossing` | `/images/og/3d/pigeon-crossing.png` |
| `/3d/penalty-hero` | `/images/og/3d/penalty-hero.png` |
| `/3d/warehouse-rush` | `/images/og/3d/warehouse-rush.png` |
| `/3d/tower-climb` | `/images/og/3d/tower-climb.png` |
| `/3d/clean-city` | `/images/og/3d/clean-city.png` |
| `/3d/escape-room` | `/images/og/3d/escape-room.png` |
| `/3d/obstacle-race` | `/images/og/3d/obstacle-race.png` |
