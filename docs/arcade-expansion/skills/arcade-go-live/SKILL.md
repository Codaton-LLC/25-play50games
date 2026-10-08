---
name: arcade-go-live
description: Take one 3D Arcade game from status "dev" to live on production - audit checklist (report-only agents), Claude's go-live branch with proven limits in meta.ts and arcade-games.json, the user's manual JSON upload, merge and live checks, plus rollback. Use when the user decides a game should go live.
---

# Arcade go-live

## Part 1: audit (Antigravity or Kimi, report only, local preview build)
Print the `meta.ts` slug first to prove the target. Then check and report READY / NOT READY with evidence:
- Common Definition of Done (03) items all pass; gamecheck green on `main`.
- Perf JSON within 06 §10.1 on desktop and 4× CPU mobile; memory flat over 10 Retries.
- README "Server limits and why they hold" present; the numbers it proposes match the bot results.
- A full run with keyboard (1280 × 800) and with touch (390 × 844, banner open); no overlaps; no console errors.
- Thumbnail and OG card exist for the slug.

## Part 2: go-live branch (Claude)
1. `claude/golive-<slug>` from `main`.
2. `meta.scoring` = the proven limits; `arcade-games.json`: the same values, `enabled: true`, `version` + 1; `meta.status = "live"` (or `"soon"` if the user wants a teaser first).
3. `registry.sync.test.ts`, build, full vitest.
4. Hand the user the exact file `play50games-backend/play50games/includes/arcade-games.json` and the target path `wp-content/themes/play50games/includes/arcade-games.json`; the user takes a Plesk backup first and uploads only that file.
5. After the user says "uploaded": read-only `GET /wp-json/play50/v1/arcade/games` shows the new version and the slug enabled.
6. Merge to `main` (Vercel deploys).
7. Live checks: `/3d` card clickable; a guest run (best survives a reload); sitemap has `/3d/<slug>`; OG image resolves. The user does one logged-in run (rank shows).
8. Record in `docs/status.md`: date, limits, version.

## Rollback
`enabled: false` for the slug in the JSON (upload) and `status: "dev"` (merge). The hub and the other games keep working.

## Never
Test against production with anything but the user's own normal run; paste `$KEY` / `$JWT`; upload anything but the JSON.
