# Assets check — 2026-10-25 (P-104)

Read-only check of all 30 games in `play50games-frontend/src/arcade3d/games/`.
Thumbnail = `public/images/3d/<slug>.webp`. OG = `public/images/og/3d/<slug>.png`.
GLB urls were extracted by bundling and evaluating each game's `assets.ts`
(resolves `SHARED_ASSETS` / `REUSED_ASSETS` / `EXPANSION_ASSETS` / `EXPANSION_CHARACTERS`
spreads, not just literals) and checked against the filesystem and
`src/arcade3d/core/modelManifest.ts` (87 entries). All 30 games have an `assets.ts`; none failed.

| game | thumbnail | og | glb count | missing glbs | not in manifest |
|---|---|---|---|---|---|
| alien-farm | yes | yes | 6 | — | — |
| castle-defender | yes | yes | 6 | — | — |
| clean-city | yes | yes | 14 | tree, building | tree, building |
| construction-worker | yes | yes | 5 | — | — |
| delivery-drone | yes | yes | 8 | — | — |
| dino-egg-rescue | yes | yes | 4 | — | — |
| escape-room | yes | yes | 7 | — | — |
| food-catcher | yes | yes | 6 | — | — |
| ghost-vacuum | yes | yes | 8 | — | — |
| knight-arena | yes | yes | 6 | — | — |
| luggage-rush | yes | yes | 3 | — | — |
| mini-golf | yes | yes | 4 | — | — |
| monster-kitchen | yes | yes | 10 | — | — |
| museum-guard | yes | yes | 6 | — | — |
| obstacle-race | yes | yes | 2 | — | — |
| office-escape | yes | yes | 7 | — | — |
| penalty-hero | yes | yes | 2 | — | — |
| penguin-slide | yes | yes | 5 | — | — |
| pigeon-crossing | yes | yes | 4 | — | — |
| pirate-cannons | yes | yes | 6 | — | — |
| robot-collector | yes | yes | 4 | — | — |
| robot-factory | yes | yes | 5 | — | — |
| rocket-landing | yes | yes | 1 | — | — |
| shopping-cart | yes | yes | 15 | — | — |
| snowball-battle | yes | yes | 3 | — | — |
| space-repair | yes | yes | 3 | — | — |
| tower-climb | yes | yes | 8 | slab, moving-slab, ledge, spur, rocket | slab, moving-slab, ledge, spur, rocket |
| treasure-island | yes | yes | 10 | — | — |
| warehouse-rush | yes | yes | 4 | — | — |
| zoo-escape | yes | yes | 11 | — | — |

## Problems

- No missing thumbnails: all 30 `public/images/3d/<slug>.webp` exist.
- No missing OG cards: all 30 `public/images/og/3d/<slug>.png` exist.
- No manifest entry points at a nonexistent file (manifest and `public/models/3d/` are in sync, 87 files).
- 7 referenced GLB urls do not exist on disk and are not in the manifest; all are deliberate
  placeholder/fallback entries (the core only fetches manifest urls, so nothing 404s):
  - `clean-city`: `tree.glb`, `building.glb` — commented in `assets.ts` as "scenery that stays
    primitives (no GLB in the manifest, nothing fetched)". By design.
  - `tower-climb`: `slab.glb`, `moving-slab.glb`, `ledge.glb`, `spur.glb`, `rocket.glb` — `rocket`
    is explicitly commented "No GLB yet: the url is absent from the model manifest"; the four
    platform types use their box fallbacks pending generation. By design, but these 5 (plus
    clean-city's 2) are the swap-in candidates for future Hyper3D batches.
