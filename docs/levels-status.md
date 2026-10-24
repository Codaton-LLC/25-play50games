# Arcade 3D — Levels Tracker

> Generated 2026-10-25 from `origin/main` + remote branches. Docs only; no code changes.

## Summary

- Levels live on origin/main (meta.ts `levels` + 5-level JSON in `arcade-games.json`): **5 games** — castle-defender, food-catcher, obstacle-race, robot-collector, tower-climb.
- Waiting for JSON upload (levels on main, JSON missing): **0 games**.
- Levels built on branches, awaiting merge/review: **6 games** — clean-city, knight-arena, museum-guard, office-escape, pigeon-crossing, warehouse-rush.
- Not started: **19 games** — 17 have a ready brief (brief ready), 2 have no brief and no branch (needs builder: escape-room, penalty-hero).

## Status table

| game | live/dev | 5 levels on origin/main? | levels branch(es) + latest commit (origin) | JSON levels in arcade-games.json (origin/main)? | brief in docs/level-briefs/? | next step |
|---|---|---|---|---|---|---|
| alien-farm | dev | no | — | no | yes | brief ready |
| castle-defender | live | yes | claude/levels-castle-defender (2026-10-24, merged), codex/levels-castle-defender (2026-10-24, merged) | yes (5) | no | done |
| clean-city | live | no | codex/levels-clean-city (2026-10-24, not merged) | no | no | review |
| construction-worker | dev | no | — | no | yes | brief ready |
| delivery-drone | dev | no | — | no | yes | brief ready |
| dino-egg-rescue | dev | no | — | no | yes | brief ready |
| escape-room | live | no | — | no | no | needs builder |
| food-catcher | live | yes | claude/levels-food-catcher (2026-10-24, merged), opencode/levels-food-catcher (2026-10-24, merged) | yes (5) | no | done |
| ghost-vacuum | dev | no | — | no | yes | brief ready |
| knight-arena | live | no | cursor/levels-knight-arena (2026-10-24, not merged) | no | yes | review |
| luggage-rush | dev | no | — | no | yes | brief ready |
| mini-golf | dev | no | — | no | yes | brief ready |
| monster-kitchen | dev | no | — | no | yes | brief ready |
| museum-guard | live | no | cursor/levels-museum-guard (2026-10-25, not merged) | no | yes | review |
| obstacle-race | live | yes | claude/levels-obstacle-race (2026-10-24, merged), kimi/levels-obstacle-race (2026-10-24, merged) | yes (5) | no | done |
| office-escape | live | no | claude/levels-office-escape (2026-10-24, not merged), codex/levels-office-escape (2026-10-24, not merged) | no | no | review |
| penalty-hero | live | no | — | no | no | needs builder |
| penguin-slide | dev | no | — | no | yes | brief ready |
| pigeon-crossing | live | no | claude/levels-pigeon-crossing (2026-10-24, not merged), codex/levels-pigeon-crossing (2026-10-24, not merged) | no | no | review |
| pirate-cannons | dev | no | — | no | yes | brief ready |
| robot-collector | live | yes | antigravity/levels-robot-collector (2026-10-24, merged), claude/levels-robot-collector (2026-10-24, merged) | yes (5) | no | done |
| robot-factory | dev | no | — | no | yes | brief ready |
| rocket-landing | dev | no | — | no | yes | brief ready |
| shopping-cart | dev | no | — | no | yes | brief ready |
| snowball-battle | dev | no | — | no | yes | brief ready |
| space-repair | dev | no | — | no | yes | brief ready |
| tower-climb | live | yes | claude/levels-tower-climb (2026-10-24, merged), cursor/levels-tower-climb (2026-10-24, merged) | yes (5) | no | done |
| treasure-island | dev | no | — | no | yes | brief ready |
| warehouse-rush | live | no | claude/levels-warehouse-rush (2026-10-24, not merged), cursor/levels-warehouse-rush (2026-10-24, not merged) | no | no | review |
| zoo-escape | dev | no | — | no | yes | brief ready |

## Notes

- "merged" = branch tip is an ancestor of `origin/main`; "not merged" = levels work exists on the branch but is not on main.
- office-escape branch levels live in `levels.ts` (5 levels keyed 1–5), not yet wired into `meta.ts` — still counted as built, pending review/merge.
- Non-game levels branches also on origin: `claude/levels-backend`, `claude/levels-core`, `claude/levels-design`, `kimi/levels-backlog` (all 2026-10-24) — infrastructure/branches, not tied to one game.
- Source for "5 levels on origin/main": `meta.ts` in `play50games-frontend/src/arcade3d/games/<slug>/` on `origin/main` exports `levels`.
- Source for JSON: `play50games-backend/play50games/includes/arcade-games.json` on `origin/main` — exactly the 5 done games have a `levels` array with 5 entries.
