# Agent instructions (Cursor, Codex)

Read before changing anything:
1. `CLAUDE.md` – project context, contracts, ownership, rules.
2. `skills.md` – game catalog, your packages and games, hand-off prompts.
3. `docs/platform-plan.md` – approved plan (source of truth).
4. `docs/arcade-api.md` – leaderboard API contract.

Rules:
- Work only on your own branch: `cursor/<pkg>` or `codex/<pkg>` (e.g. `codex/game-pigeon-crossing`). Never push to `main`.
- Touch only the files your hand-off prompt lists. Game owners: `play50games-frontend/src/arcade3d/games/<slug>/**` + `public/images/3d/<slug>.webp`.
- Never edit `package.json`, `package-lock.json` or Claude-owned files (`next.config.js`, `tsconfig.json`, `arcade3d/{core,assets}/**`, `arcade3d/{types,registry,loaders,flags}.ts`, `public/models/3d/**`, WP `functions.php`, `includes/arcade-api.php`, `includes/arcade-games.json`, docs). Need a change there? Ask Claude.
- Never import classic code (`GameEngine/**`, `progressStorage`) into arcade code.
- Never spend Hyper3D credits: no real `smoke` or `gen`, use `--mock`. Never read, print or commit keys.
- Never test against or upload to the production WordPress site.
- Style: 3-space indent, double quotes, semicolons. New UI = CSS Modules + existing CSS vars; never edit `globals.css`.
- Done = `npm run build` and `npx vitest run` pass in `play50games-frontend`, and `git diff --name-only main...<branch>` shows only your files.
- Unsure? Stop and ask; do not guess.
