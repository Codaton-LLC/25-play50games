> Approved 2026-10-05; source of truth for the platform + 3D Arcade work

# Play50Games → platform: landing hub + 3D Arcade (10 games)

## Context

Today `/` *is* the classic dashboard of 50 sequential 2D games (unlock chain + certificate). Goal: turn the site into a platform.
- `/` becomes a **landing hub** with tabs: **Play Classic 50 Games** (`/classic`) and **3D Arcade** (`/3d`), with room for more collections later.
- **3D Arcade** has 10 React Three Fiber mini-games. Models come from Hyper3D Rodin (API; accounts with 45 + 10 credits).
- The arcade is fully separate from classic: no unlock chain and no certificate. Each game has its **own score and its own WordPress leaderboard**.
- Games ship **one at a time**, but this plan covers everything up front.
- Work split: **Claude does the most** (shared code, backend, integration, 4 games, all reviews). **Cursor** and **Codex (ChatGPT)** build their own parts in parallel. ChatGPT chat makes character concept art.
- When Cursor or Codex should start, Claude gives the user a ready-to-paste prompt (see §9).

### User decisions (final)
- Name "3D Arcade". There is no hero video, so we build an animated hero (a trailer can replace it later).
- Leaderboard is for **logged-in users only**; public name "First L." with opt-out. Guests keep a local best and can press "Save this score to my account" after logging in.
- The leaderboard API is tested **directly on production**. It is protected by flags, a backup, lint, a test user and an admin reset (§5.4).
- Secrets: **clean up and rotate** (§7 Phase 0 and Phase 3).
- No Grok.

### Verified repo facts that shape the plan
- Frontend: Next 14.2 / React 18.3, plain CSS + CSS vars (`--bg #0b1020`, `--card`, `--stroke`, `--accent #7dd3fc`), dark only, system fonts, Heroicons. No 3D code yet.
- `FE/src/app/page.tsx` (786 lines) can move verbatim to `/classic`. Only 3 places mean "back to classic":
  - `games/[id]/page.tsx:79` (`handleExit`). It also covers GameEngine's Exit, X and Continue buttons through `onExit`, so GameEngine is not edited.
  - `progress/page.tsx:183`
  - `certificate/page.tsx:378`
- `Header.tsx` shows Login/Register only when both callbacks are passed. It has no nav and a JS `innerWidth<640` switch.
- WP: `includes/rest-api.php` has reusable `play50_get_jwt_from_header()` (:9), `play50_get_user_id_from_jwt()` (:26) and `play50_check_api_key_permission()` (:394).
- **Secrets are committed to git:**
  - `play50games-backend/wp-config.php` (+ both example files);
  - a hard-coded JWT secret fallback in `WP/functions.php:~503-506`;
  - `.idea/` + `play50games-backend/.idea/` (deployment.xml, sshConfigs.xml) on GitHub `Codaton-LLC/25-play50games`.
- `FE/.env.local` points at the **live** CMS.
- Hyper3D: base URL `https://api.hyper3d.com/api/v2`. Flow: submit `/rodin` (multipart) → poll `/status {subscription_key}` → `/download {task_uuid}` (links expire in about 10 minutes).
  - Gen-2.5 Low/Medium cost **0.5 credit** in the docs; the marketing page says "from 1".
  - API access may need the Business plan.
  - A 1-generation smoke test settles both before we spend real credits.
- PHP, Blender and Docker are not installed on this PC. Node is v24.

---

## 1. Architecture

### Routes
| Route | What |
|---|---|
| `/` | Server-rendered hub (no three.js) |
| `/classic` | Old dashboard, moved; behaviour unchanged |
| `/games/[id]` | Unchanged except Exit → `/classic` |
| `/3d` | Arcade grid: 10 cards, best score each, "soon" badges |
| `/3d/[slug]` | One game, client-only mount, full screen, `generateStaticParams` for 10 slugs |
| `/progress`, `/certificate/*` | Classic only; back link → `/classic` |

### Feature flags (`FE/src/arcade3d/flags.ts`)
- `NEXT_PUBLIC_ARCADE_ENABLED`: hides the tab, links, routes and sitemap entries when off.
- `NEXT_PUBLIC_ARCADE_LEADERBOARD`: server scores on or off.
- `NEXT_PUBLIC_ARCADE_API_MOCK`: dev mock.
- With these flags, merging to `main` (auto-deploy) is always safe.

### Folders
```
FE/src/arcade3d/
  flags.ts types.ts registry.ts loaders.ts            # Claude only; plain data, server-safe
  core/  GameShell ArcadeGameMount useArcadeStore useRunFrame input TouchControls
         CameraRig collision assets(useModel+primitive fallback) audio analytics scores useLeaderboard
  ui/    ArcadeCard ArcadeGrid LeaderboardTable ResultPanel BestScoreBadge   # Cursor (display only)
  games/<slug>/ meta.ts index.tsx Scene.tsx rules.ts rules.test.ts assets.ts assets.spec.json README.md
FE/src/components/Hub/ HubHero CollectionPanel ArcadeTeaserStrip (Cursor) · ClassicProgressBadge (Claude)
FE/src/components/Nav/SectionTabs.tsx · Header/HeaderWithAuth.tsx (Claude)
FE/src/lib/api/arcade.ts apiBase.ts
FE/public/models/3d/{shared,<slug>}/*.glb   FE/public/images/3d/<slug>.webp
WP/includes/arcade-api.php (Claude) · WP/includes/arcade-games.json (Claude) · WP/wt-cpt/arcade-scores-admin.php (Codex)
ROOT/tools/hyper3d/** (Codex builds; only Claude/user runs paid `gen`)
ROOT/docs/platform-plan.md (this plan) · ROOT/docs/arcade-api.md (API contract)
```

### Dependencies (Claude only edits `package.json`)
- `three@~0.170`, `@types/three`, `@react-three/fiber@^8`, `@react-three/drei@^9`, `zustand@^4`, `@react-three/rapier@^1` (loaded lazily, obstacle-race only).
- Dev: `vitest`.
- R3F 8 and drei 9 are the last majors for React 18. Check with `npm i --dry-run`; `npm ls three` must show a single copy.
- Load models with `useGLTF(url,false,true)` (meshopt, no Draco CDN).
- No `three` imports in `types/registry/flags/meta`, and no top-level `useGLTF.preload`.

### Contracts (Claude writes these first; everyone codes against them)
- `ArcadeGameMeta`: slug, title, tagline, order, `status:"live"|"soon"`, difficulty, orientation, controls, `scoring:ScoringRules`, thumbnail, accent, owner.
- `ScoringRules`:
  - `kind:"points"|"time"`, `maxScore`, `min/maxDurationMs`, `base`, `maxPointsPerSec`, `timeBaseMs?`, `display`.
  - For time games the server computes the score.
- `GameDefinition`: Scene, Hud?, assets, physics?, durationMs?, lives?, camera, environment, `touchControls`, `hudStats`, instructions, `finalScore?`.
- Core hooks:
  - `useArcadeStore` (phases `loading|ready|countdown|playing|paused|over`; `end()` is idempotent);
  - `useRunFrame` (runs only while playing; dt clamped);
  - `useInput` (one ref for keyboard, joystick, jump, action, swipe and tap);
  - `useModel` (an error boundary falls back to a primitive).
- `scores.ts`: `submitScore(run,userId)` (local first, then POST when a JWT is present and the flag is on), `saveRunToAccount`, `syncServerScores` (at most every 5 min), `useBestScore(slug)`.
  - Keys: `play50games_3d_scores:guest` / `:u<id>`.
  - Status union: `synced|saved-local|login-required|rate-limited|rejected|banned|offline|leaderboard-off|config-error|unranked`.
  - Time games are ranked only on `end("win")`; a lost or timed-out run is `unranked` (score 0, nothing saved).
- `arcadeApi`: `submit`, `leaderboard(slug,limit)`, `me()`, `setPrivacy`. It is a mock when the flag is set, and reuses `getApiHeaders()` plus the new `apiBase.ts`.
- Rules for every game folder:
  - Do not import `GameEngine/**` or classic `progressStorage` / `progress`.
  - Touch only your own folder.
  - ≤150 draw calls. Characters ≤20k tris with 1024 px textures; props ≤5k tris with 512 px textures.
  - `rules.ts` is pure and deterministic with a seed.

---

## 2. Landing page "/" spec

1. **HeaderWithAuth** (client) owns the Login/Register modals and renders `Header showSubtitle={false}`.
   - New Header prop `showPlatformNav`: "Classic 50" → `/classic`, "3D Arcade" → `/3d` (only when the flag is on).
   - Responsive by CSS media query, not the JS width check.
2. **HubHero**, about 75vh (60vh on mobile):
   - H1 "Play50Games", subline "50 classic brain games. 10 new 3D arcade worlds. One place to play."
   - CTAs "Play Classic 50 Games" and "Enter the 3D Arcade" ("coming soon" while the flag is off).
   - Background is **CSS only, no three.js on `/`**: radial gradients in the existing palette, a perspective grid floor moved with `translate3d`, 6–8 floating SVG tiles (only 4 under 640px), and a glow behind the H1.
   - `prefers-reduced-motion` stops all movement. A `media` prop lets the Phase 5 trailer replace the background.
3. **SectionTabs**: a sticky `<nav>` of real `<Link>`s (SEO; each collection has its own URL). It is reused on `/`, `/classic` and `/3d`.
4. **Two CollectionPanels**:
   - Classic: "50 games · 5 categories · certificate", plus `ClassicProgressBadge` with the real X/50. It loads once and does not poll.
   - 3D Arcade: "10 mini-games · own leaderboard each · no unlocks", plus a teaser strip.
5. A static "How it works" section, then the **Footer**, which adds Classic 50 and 3D Arcade links.

**Metadata and SEO**
- The root layout gets platform copy and no canonical.
- `classic/layout.tsx` and `3d/layout.tsx` each set a full openGraph.
- Canonicals are set per page. `/3d/[slug]` is noindex while "soon".
- Sitemap adds `/classic`, plus `/3d` and live game slugs when the flag is on.
- The user updates the GTM triggers (`/` → `/classic`) before Release 0.

---

## 3. WordPress leaderboard (`play50/v1/arcade/*`)

- **Table** `{prefix}play50_arcade_scores`:
  - One row per (user, game): `best_score`, `best_duration_ms`, `last_score`, `plays`, `hidden`, `best_at`, `last_played`.
  - `UNIQUE(user_id,game_slug)`, `KEY(game_slug,hidden,best_score,best_at)`.
  - Installed with `dbDelta` on `after_switch_theme` and on `init` when the version option changes, so nobody has to reactivate the theme on prod.
- **Saving** is one atomic `INSERT … ON DUPLICATE KEY UPDATE` that keeps the best score and adds 1 to plays.
- **Endpoints:**

  | Method | Route | Access |
  |---|---|---|
  | GET | `/arcade/games` | API key |
  | POST | `/arcade/scores` | JWT only |
  | GET | `/arcade/leaderboard/<slug>?limit=` | API key; JWT optional, fills `me` |
  | GET | `/arcade/me` | JWT |
  | POST | `/arcade/me/privacy` | JWT |

  Phase 5 adds `POST /arcade/runs/start` for run tokens.
- **Auth:** `play50_check_api_key_permission` + JWT via the existing helpers + `get_userdata` + ban meta. Cookies are never accepted for writes.
- **Validation:**
  - slug is enabled in `arcade-games.json`;
  - `duration_ms` is within [min,max];
  - points games: `score ≤ max_score` and `score ≤ base + max_pps·seconds`;
  - time games: the server computes the score.
- **Rate limits** (transients): 10 per minute per user, 3 s gap per game, 30 per 10 minutes per hashed IP. A `rest_pre_dispatch` filter limits `/auth/register` to 5 per hour per IP.
- **Reads:** the top 50 are cached 60 s per slug; names load in one batch. Rank = `COUNT(*)+1`. Cache-Control is `private` when a JWT is sent.
- **Admin page "Arcade Scores":** list, delete row, reset game, ban/unban, clear cache. Uses `admin_post_*` + `check_admin_referer` + a capability check.
- `rest-api.php` is never edited. `functions.php` gets guarded `require_once` lines after the rest-api include.

### 5.4 Production-only testing (user's choice): safety procedure
1. Take a hosting DB and file backup before the first backend upload.
2. Lint before every upload: `php -l` via a portable PHP CLI installed on this PC (`winget install PHP.PHP.8.3` or a zip). A PHP parse error would take the whole live site down.
3. Upload with the arcade frontend flags **off**. In `arcade-games.json` only the game under test has `enabled:true`.
4. Test with a dedicated "arcade-test" account and run the curl suite (§10).
5. Then use admin "Reset game" to wipe the test rows. Only after that turn the frontend flags on.

---

## 4. Hyper3D pipeline and credit budget

- **CLI** `tools/hyper3d/` (Node fetch), built by Codex. Commands: `plan`, `budget`, `smoke`, `gen --confirm`, `import`, `optimize`, optional `convert` / `merge-clips` (Blender), and `--mock` on everything.
  - `gen` refuses to run without `--confirm`, outside the main checkout, or below a 2-credit reserve.
  - Keys and the spend ledger live in `%USERPROFILE%\.play50\` and never in git.
  - **Every paid batch is approved by the user in chat first.**
- **Defaults:**
  - Characters: image-to-3D from ChatGPT concept art, `Gen-2.5-Medium`, `quality_override≈18000`, T-pose.
  - Props: text-to-3D, `Gen-2.5-Low`, 1.5–4k faces (Fast mode).
  - Always `glb`, `mesh_mode=Raw`, `material=PBR`, `seed`. Never HighPack or Extreme-High.
- **Optimize:** `gltf-transform` centers the pivot, resizes textures to webp (1024 / 512), simplifies, applies meshopt, then inspects. It fails over budget (characters 20k tris / 1.5 MB, props 5k / 300 KB).
- **Smoke test first** (10-credit "lab" account). It checks API access, the real `consumed`, `TAPose` casing, `quality_override`, FBX output and privacy. If there is no API access, we fall back to generating in the web UI plus `import`.
- **Style "Play50 toy world":** bright vinyl-toy look with one seed per universe.
- **Shared models** in `models/3d/shared/`: runner, robot, battery, crate, tinCan, banana, desk, chair. They are reused across games.
- **Rigging:** done in code for every character, the runner included (2026-10-06): the core auto-rig (`core/rig`, `core/README.md` "Characters: the auto-rig") builds a skeleton and skin weights from the static T-pose mesh and animates it with procedural poses (arms down, walk/run, carry, cheer, jump). No Mixamo pass. Concepts stay T-pose.

**Budget:**
- Lab: about 10 generations (≈5 credits) on the 10-credit account.
- Production: **42 generations ≈ 21 credits at 0.5** (24 left of 45). At 1.0 per generation the cut list gives 30 generations, about 15 credits left.

| Game | Generated | Reused |
|---|---|---|
| robot-collector | robot ×3, battery, crate, barrel (lab) | none |
| food-catcher | chef ×2, apple, banana, strawberry, burger, sock, tinCan, runner final ×2 | none |
| office-escape | desk, printer, chair, coffee cart, water cooler | runner |
| pigeon-crossing | pigeon ×2, car, taxi, van | none |
| penalty-hero | striker ×2, keeper ×2, ball | none |
| warehouse-rush | shelf rack, pallet | robot, crate |
| tower-climb | flag, spring pad | runner |
| clean-city | bottle, bag, bin, bench, palm, umbrella, lamp | runner, tinCan, banana |
| escape-room | key, book, door, console | runner, battery, desk, chair |
| obstacle-race | finish arch | runner |

---

## 5. Phased roadmap

### Phase 0: contracts and cleanup (Claude; blocks everyone)
- **Repo hygiene:**
  - `.gitignore`: `graphify-out/`, `tools/hyper3d/raw|node_modules`, `.idea/`, `play50games-backend/.idea/`, `play50games-backend/wp-config.php`.
  - `.gitattributes`: `* text=auto`, binaries for glb/png/webp/mp4.
  - `git rm -r --cached .idea play50games-backend/.idea play50games-backend/wp-config.php`. Local files are kept; warn that other clones delete them on pull, so back them up.
  - Scrub secrets from both `wp-config-*example.php` files.
- **Docs:**
  - `docs/platform-plan.md` (this plan) and `docs/arcade-api.md`.
  - Rewrite `CLAUDE.md`, `skills.md` and `AGENTS.md`: remove Grok, set the final ownership, add worktree/branch rules.
- **Frontend:**
  - Install the dependencies and vitest.
  - Write `arcade3d/{flags,types,registry,loaders}.ts` and all 10 game stubs (`status:"soon"`).
  - `core/scores.ts` with tests, the mock `arcade.ts`, `apiBase.ts`.
  - Compiling stubs for GameShell, Hub/* and ui/*.
- **Backend:** guarded loader lines in `functions.php`, `arcade-games.json` (all 10 with provisional limits), `registry.sync.test.ts`.
- **Exit:** `npm run build`, `npx tsc --noEmit` and `npx vitest run` pass; the `/` bundle is unchanged; pushed to `main`.

### Phase 1: hub and routing → Release 0 (Claude C1 ∥ Cursor K1 ∥ Codex X2)
- **C1 (Claude):**
  - Move `page.tsx` to `classic/page.tsx`: rename it, drop dead imports and code, add `SectionTabs`, no behaviour change.
  - `classic/layout.tsx`, the hub `page.tsx`, `HeaderWithAuth`, `SectionTabs`, `ClassicProgressBadge`, the Header `showPlatformNav` prop, Footer, metadata, sitemap and the 3 link changes.
  - Stale-JWT fix in `auth.ts` + `AuthContext.tsx`: remove the token only after a definitive HTTP 200 `{authenticated:false}`, so a 5xx never logs anyone out.
- **K1 (Cursor):** HubHero, CollectionPanel and ArcadeTeaserStrip visuals.
- **X2 (Codex):** the Hyper3D CLI, tested with `--mock` only.
- **Exit:**
  - `/` is the hub with no three.js and the same First Load JS (±10 KB).
  - `/classic` behaves exactly like the old `/`. Exit, X and Continue in `/games/1` → `/classic`.
  - At 375px there is no horizontal overflow.
  - A forged JWT gives the guest view and the token is cleared.
  - With the flag off there are no `/3d` links and `/3d/x` returns 404.
  - **Deploy with `NEXT_PUBLIC_ARCADE_ENABLED=0`.**

### Phase 2: 3D core and `/3d` routes (Claude C2 ∥ Cursor K2 ∥ Codex X3)
- **C2 (Claude):**
  - GameShell: WebGL check, `Canvas dpr=[1,1.75]` + PerformanceMonitor, Suspense loader, lazy Physics.
  - Screens: start (instructions, best, top 10), countdown, HUD, pause (Esc/P, tab hidden), result, retry, exit.
  - Its own top bar and login modals; `100dvh`; `touch-action:none` only on the canvas.
  - Context-loss overlay, rotate-device overlay, asset disposal on unmount.
  - Plus the store, input, touch controls, camera, collision, `useModel`, audio, `dataLayer` analytics and `useLeaderboard`.
  - Routes `3d/layout.tsx`, `3d/page.tsx` and `3d/[slug]/page.tsx`.
- **K2 (Cursor):** the arcade UI kit (ArcadeCard, ArcadeGrid, LeaderboardTable, ResultPanel, BestScoreBadge).
- **X3 (Codex):** the WP admin page `arcade-scores-admin.php`, written against `docs/arcade-api.md`.
- **Exit:**
  - `/3d` shows 10 "soon" cards.
  - The robot-collector stub runs through every phase on desktop and in mobile emulation.
  - The three.js chunk loads only on `/3d/[slug]`.
  - CLI `plan` and `optimize --mock` work.

### Phase 3: Game 1 + leaderboard → Release 1 (Claude)
- **Backend (Claude):**
  - `arcade-api.php`, then `php -l`.
  - Review Codex's admin page.
  - The production procedure in §3 / 5.4. The user uploads the WP side **before** the frontend.
- **Security:**
  1. C1 is live.
  2. The user excludes `wp-config.php` from the PhpStorm upload.
  3. The user sets a new random `JWT_AUTH_SECRET_KEY` in the server `wp-config.php`; everyone logs in once.
  4. The user confirms in chat.
  5. Claude removes the hard-coded fallback in `functions.php` (done in the Release 1 prep: without the constant the theme now derives a key from the server's own salts and logs a notice).
- **Assets:**
  - Lab smoke test plus the robot-collector batch (user approves about 5 credits).
  - `optimize`, then an assets PR.
- **C3 robot-collector (reference game):** built with primitives first, then models. Its README becomes the template for the other games.
- **C4:**
  - The real `arcade.ts`, score sync, ResultPanel "Log in to put this on the leaderboard" → "Save this score to my account", the privacy toggle.
  - A privacy-policy update and a note in the register modal about public names.
- **Exit:**
  - Playable with keyboard and touch; a guest's best survives a reload.
  - A logged-in score shows on the leaderboard with its rank; switching users never shows foreign bests.
  - The curl suite passes on prod with the test user, and the test rows are reset.
  - Classic `/progress` and `/certificate` are unchanged.
- **Release 1:** flags on. If the secret rotation is delayed, ship with the leaderboard flag off (local scores only).

#### Release 1 runbook
The code is on `main` with the Vercel flags off (`robot-collector` is `live`; `arcade-games.json` has only `robot-collector` `enabled:true`). The WP arcade API is already on prod. Upload WordPress **before** touching the Vercel flags.

1. **Backup:** hosting DB + theme files (including the server `wp-config.php`). Then log in on the site as **arcade-test** and keep that token as `OLD_JWT` in your local env (`read -rs OLD_JWT && export OLD_JWT`, same setup as `docs/arcade-api.md` §13). Step 3 uses it to prove the old key is dead.
2. **JWT secret:** the server `wp-config.php` (kept out of the repo and out of the PhpStorm upload) very likely still defines the **leaked** key: the old tracked copy did, at about line 109, with the same value as the old `functions.php` fallback. Open it, find the existing `define('JWT_AUTH_SECRET_KEY', ...)` line and **replace its value**; add the line only if it is missing. There must be exactly **one** such define, above "That's all, stop editing" and above `require_once ABSPATH . 'wp-settings.php'`. Never add a second define below the old one: PHP keeps the first value and only warns. Generate the value locally (`openssl rand -base64 48`), never reuse the old value, never paste it in chat. Every existing JWT stops working: everyone logs in once (the frontend drops the stale token by itself).
3. **Upload** `functions.php` + `includes/arcade-games.json`, each after `php -l`. Check that the site and `/wp-json/play50/v1/arcade/games` still load, then prove the old key is dead:
   - `curl -s -w ' %{http_code}' -H "X-API-Key: $KEY" -H "Authorization: Bearer $OLD_JWT" "$WP/arcade/me"` returns **401** with `"code":"unauthorized"`, and `curl -s -H "X-API-Key: $KEY" -H "Authorization: Bearer $OLD_JWT" "$WP/auth/status"` returns `"authenticated":false`. A 200 or `"authenticated":true` means the leaked key is still in use: stop and fix step 2 before going on.
   - The PHP error log has no "Constant JWT_AUTH_SECRET_KEY already defined" warning and no "JWT_AUTH_SECRET_KEY is not defined" notice.
4. **Test:** log in as **arcade-test** (fresh JWT after step 2) and run the curl suite (`docs/arcade-api.md` §13, `SLUG=robot-collector`). All checks pass.
5. **Clean up:** Admin → Arcade Scores → **Reset game** `robot-collector`, then **Clear cache**.
6. **Vercel env (Production):** `NEXT_PUBLIC_ARCADE_ENABLED=1`, `NEXT_PUBLIC_ARCADE_LEADERBOARD=1`; `NEXT_PUBLIC_ARCADE_API_MOCK` stays unset.
7. **Redeploy** (the flags are inlined at build time, so a rebuild is required).
8. **Verify on prod:**
   - `/` shows the 3D tab; `/3d` lists Robot Collector as playable; `/sitemap.xml` has `/3d` and `/3d/robot-collector`.
   - Guest: play on desktop (keyboard) and phone (touch); the best survives a reload; the result offers Log in.
   - Logged in: a run shows "synced"; the name ("First L.") and rank appear on the leaderboard; switching users never shows foreign bests.
   - `/3d` "Show my name on leaderboards" off → the leaderboard shows "Anonymous"; switch it back on.
   - Classic `/classic`, `/games/1`, `/progress`, `/certificate` behave as before.
9. **Rollback:** Vercel flags off + redeploy (the hub and classic site keep working). If the API misbehaves, set `robot-collector` `enabled:false` in `arcade-games.json` and upload it.

### Phase 4: games 2–10, one at a time
For each game:
1. The owner writes the README and `assets.spec.json`; Claude approves.
2. ChatGPT concept art (characters only) arrives through the user.
3. Claude runs `plan`; the user approves the spend; Claude runs `gen` and `optimize`.
4. Claude opens an "assets + limits" PR (GLBs plus the `arcade-games.json` entry). The WP JSON goes live first.
5. The owner builds `Scene`, `rules` + tests, `assets` and the thumbnail, and sets `status:"live"` last.
6. Claude reviews: an ownership diff (`git diff --name-only main...branch`), build, vitest, playing on phone and desktop. Then merge and deploy.

### Phase 5: polish
- **Claude:** JSON-LD (`WebSite`, `ItemList` of `VideoGame`), merge the six `getApiBase` copies into `apiBase.ts`, Lighthouse ≥90 on `/`, games playable in under 3 s on 4G.
- **Cursor:** a 10–15 s trailer (webm + mp4 ≤1.5 MB plus a poster) swapped into HubHero via `media`, and OG images.
- **Codex:** run tokens (`/arcade/runs/start`, HMAC, single use) and a `tools/arcade-api-smoke.sh` script.

---

## 6. Work split (non-overlapping files)

Owned by Claude only: `package.json`/lock, `next.config.js`, `tsconfig.json`, `arcade3d/{core,assets}/**`, `types/registry/loaders/flags.ts`, `public/models/3d/**`, `WP/functions.php`, `WP/includes/arcade-api.php`, `WP/includes/arcade-games.json`.

| ID | Package | Owner | Depends on | Files |
|---|---|---|---|---|
| C0 | Contracts, stubs, dependencies, hygiene, docs | **Claude** | none | Phase 0 list |
| C1 | `/classic` move, hub page, nav, links, SEO, stale-JWT fix | **Claude** | C0 | `app/{page,layout,sitemap}`, `app/classic/**`, 3 link files, `Header`, `Footer`, `Nav`, `ClassicProgressBadge`, `auth.ts`, `AuthContext.tsx` |
| K1 | Hub visuals | **Cursor** | C0 | `Hub/{HubHero,CollectionPanel,ArcadeTeaserStrip}.*` |
| X2 | Hyper3D CLI | **Codex** | C0 | `tools/hyper3d/**` (except `concepts/`) |
| C2 | 3D core and `/3d` routes | **Claude** | C0 | `arcade3d/core/**`, `app/3d/**` |
| K2 | Arcade UI kit | **Cursor** | C0 | `arcade3d/ui/**` |
| X3 | WP admin page | **Codex** | C0 | `WP/wt-cpt/arcade-scores-admin.php` |
| C3 / C4 | robot-collector; leaderboard API + client + privacy | **Claude** | C2 | `games/robot-collector/**`, `arcade-api.php`, `arcade.ts`, `scores.ts`, privacy page |
| A | All asset generation and assets PRs | **Claude** (user approves spend) | README approved | `public/models/3d/**`, `tools/hyper3d/concepts/**`, `arcade-games.json` |
| ART | Character concept art | **ChatGPT chat** (via the user) | none | delivered to Claude |
| Games | robot-collector, office-escape, warehouse-rush, obstacle-race | **Claude** | previous game released | `games/<slug>/**` |
| Games | food-catcher, penalty-hero, clean-city | **Cursor** | same | same |
| Games | pigeon-crossing, tower-climb, escape-room | **Codex** | same | same |
| P | SEO/performance · trailer/OG · run tokens | Claude · Cursor · Codex | G10 | see Phase 5 |

**Count:**
- **Claude:** C0–C4, the backend, all assets, 4 games, all reviews and merges.
- **Cursor:** K1, K2, 3 games, trailer.
- **Codex:** CLI, admin page, 3 games, run tokens.

**Branch rule:** Cursor and Codex each work on their own branch (`cursor/<pkg>`, `codex/<pkg>`; a local worktree or a cloud branch). Claude merges after the ownership diff check.

## 7. Game rollout order (one at a time)

| # | Game | Owner | New thing it introduces | Score |
|---|---|---|---|---|
| 1 | robot-collector | Claude | Reference game: joystick, collect + timer | points (max 1600) |
| 2 | food-catcher | Cursor | Proves the template works for another agent; spawners | points |
| 3 | office-escape | Claude | Rigged runner, lane runner | points (distance + coins) |
| 4 | pigeon-crossing | Codex | Grid hop, deterministic traffic | points |
| 5 | penalty-hero | Cursor | Tap target, keeper AI | points (10 shots) |
| 6 | warehouse-rush | Claude | Carry and drop, colour zones | points (60 s) |
| 7 | tower-climb | Codex | Vertical platformer | points |
| 8 | clean-city | Cursor | 3 maps from config | points + time bonus |
| 9 | escape-room | Codex | Raycast, inventory | time (server-computed) |
| 10 | obstacle-race | Claude | Rapier physics | time (server-computed) |

While game N is being built, the owner of game N+1 prepares only its README, asset spec and concept art.

## 8. Timeline (parallel lanes)

| Step | Claude | Cursor | Codex / ChatGPT | User |
|---|---|---|---|---|
| S0 | C0 | none | ChatGPT: 3 style sheets | Back up `.idea`/`wp-config`; create `%USERPROFILE%\.play50\hyper3d.env` |
| S1 | C1 | K1 | X2 · ChatGPT: robot + runner concepts | Pick a style; GTM triggers |
| S2 | Review; **Release 0**; start C2 | K2 | X3 | Approve lab spend (~5 cr) |
| S3 | C2; smoke + lab batch; C3 with primitives | G2 README/spec | X2 fixes · ChatGPT: chef | Rotate JWT secret, confirm |
| S4 | C3 with models; C4 + backend on prod; **Release 1** | G2 prep | G4 README/spec | DB backup; upload WP first |
| S5+ | One game at a time per §7: assets PR → owner builds → Claude reviews | | | Approve each asset batch |

## 9. Hand-off prompts (Claude tells the user when to paste each one)

Prefix for every prompt:
> "Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md and docs/platform-plan.md first. Work on branch `<branch>`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend."

| Package | Prompt summary |
|---|---|
| **K1** (Cursor) | Fill the 3 Hub stubs exactly to their prop types. CSS Modules plus the existing CSS vars. Animate only transform/opacity (grid floor = a 2× tall layer moved with translate3d). Respect reduced motion. ≤4 tiles under 640px. No data fetching, no new dependencies. |
| **K2** (Cursor) | Fill ArcadeCard, ArcadeGrid, LeaderboardTable, ResultPanel and BestScoreBadge to their props. Display only; the only hook allowed is `useBestScore`. Format scores from `ScoringRules.display`. ResultPanel shows a message per `SubmitStatus` plus the login and "Save to my account" buttons. Mobile first. |
| **X2** (Codex) | Build `tools/hyper3d` per platform-plan §4 with Node native fetch. Key and ledger from `%USERPROFILE%\.play50`. `gen` requires `--confirm`, the main checkout and budget headroom. `--mock` on every command. `optimize` enforces budgets. Never log keys. Spend no credits. |
| **X3** (Codex) | Build the admin "Arcade Scores" page per `docs/arcade-api.md`: list, delete, reset, ban/unban, clear cache. Use `admin_post_*` + `check_admin_referer` + `manage_options` inside each handler. Do not copy the `admin_init` + `wp_die` pattern from `share-tracking.php`. |
| **Game** (Cursor/Codex) | Copy robot-collector's structure into `games/<slug>/`. Use `GameDefinition`, `useRunFrame`, `useInput`, the collision helpers and `SHARED_ASSETS`. Scoring goes in `rules.ts` with vitest tests, and `meta.scoring` must match `arcade-games.json`. Respect the budgets. Set `status:"live"` last. |
| **ART** (ChatGPT chat) | "Play50 toy-world style: three-quarter front view of <character>, T-pose, plain light-grey background, 1024px, single figure." |

## 10. Verification

- **Every frontend PR:**
  - `npm run build`, `npx tsc --noEmit`, `npx vitest run` and the ownership diff.
  - The route table shows no three.js on `/` and `/classic`, and `/3d/[slug]` as static.
- **Manual:**
  - 375px touch emulation and desktop.
  - Tab switch pauses the game; context-loss overlay; rotate overlay; reduced motion on `/`.
  - Classic regression: the unlock chain, a game, Continue → `/classic`, `/progress`, `/certificate`.
- **Backend** (prod, test user; `$KEY` and `$JWT` from local env, never pasted into chat): `php -l` on both PHP files, then curl for games, leaderboard, a valid submit and these negative cases:

  | Request | Expected |
  |---|---|
  | No JWT | 401 |
  | Cookie only | 401 |
  | No API key | 401 |
  | `score` 99999 | 400 |
  | Implausible score/time | 400 |
  | Time game | server computes the score |
  | Unknown slug | 404 |
  | `duration_ms` 100 | 400 |
  | 11 submits per minute | 429 |
  | 6 registers per hour | 429 |
  | Banned user | 403 |
  | Deleted user | 401 |

  Then admin reset.
- **Pipeline:** `plan`/`optimize --mock` in branches. Real `smoke`/`gen` only after approval. `gltf-transform inspect` must be within budget.

## 11. Risks
1. **Hyper3D API may need the Business plan, or cost 1.0 per generation.** The smoke test tells us. Fallbacks: web UI + `import`, and the 1.0 cut list.
2. **Prod-only backend testing.** Mitigated by backup, `php -l`, flags off, enabled-per-game, a test user and admin reset. It remains the biggest operational risk.
3. **Committed secrets remain in git history.** If the repo was ever shared outside the team, also rotate the DB password and `PLAY50_API_KEY`.
4. **PhpStorm "upload on save" goes to live.** Exclude `wp-config.php` and keep an eye on uploads.
5. **Mobile performance.** Lazy chunks, adaptive DPR, budgets enforced by the CLI.
6. **SEO dip when `/` changes.** Canonicals, sitemap, internal links and GTM are all updated.
7. **Client-side cheating.** Limits, plausibility checks, rate limits, bans and later run tokens reduce it; nothing removes it.
8. **Parallel agents.** Exclusive paths, contracts first, Claude-only shared files.

## Open items to confirm during execution (not blockers)
- Frontend host is Vercel auto-deploying from `main` (assumed from the "support versel" commit).
- Which Hyper3D plan each account is on (the smoke test answers this).
- OK to install the portable PHP CLI (for `php -l`) and optionally Blender + a Mixamo export for the runner.
