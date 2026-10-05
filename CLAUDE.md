# Play50Games – project context for AI agents

Read in this order: this file → `skills.md` (game catalog, Hyper3D prompts, hand-off prompts) → `docs/platform-plan.md` (approved plan, source of truth) → `docs/arcade-api.md` (leaderboard API contract).
Cursor and Codex are pointed here via `AGENTS.md`. Agents: **Claude** (most work, all reviews and merges), **Cursor**, **Codex** (ChatGPT), plus ChatGPT chat for concept art.

## Current state (verified 2026-10-05)

- `play50games-frontend/` – Next 14.2 (App Router), React 18.3, plain CSS (`globals.css`) + CSS vars (`--bg`, `--card`, `--stroke`, `--accent`), dark only, system fonts, Heroicons. No Tailwind.
- 3D deps installed: `three@~0.170` (+ `@types/three`), `@react-three/fiber@^8`, `@react-three/drei@^9`, `@react-three/rapier@^1` (lazy, obstacle-race only), `zustand@^4`. Dev: `vitest@^2`. Never R3F 9 / drei 10 (React 19 only).
- Scripts: `npm run dev | build | start | lint`, `npm test` (= `vitest run`, config `vitest.config.mts`, files `src/**/*.test.ts`).
- `src/arcade3d/` contracts are written (Phase 0): `types.ts`, `flags.ts`, `registry.ts`, `loaders.ts`, `core/{types,scores,useBestScore,format}.ts`, `core/PlaceholderScene.tsx`, tests `core/scores.test.ts` + `registry.sync.test.ts`, 10 stubs `games/<slug>/{meta.ts,index.tsx}` (all `status: "soon"`), prop-typed stubs `ui/*.tsx` (K2) and `components/Hub/{HubHero,CollectionPanel,ArcadeTeaserStrip}.tsx` (K1), and `assets/shared.spec.json`.
- 3D core (C2): full `core/GameShell.tsx` + `ShellStage.tsx`, `ArcadeGameMount.tsx`, `useArcadeStore`, `useRunFrame`, `input.tsx` (+ pure `inputController.ts`), `TouchControls`, `CameraRig`, `collision`, `assets.tsx` (`Model`, `useModel`) + `sharedAssets.ts` (`SHARED_ASSETS`), `audio`, `analytics`, `useLeaderboard`, `ErrorBoundary`; tests `useArcadeStore.test.ts`, `collision.test.ts`, `inputController.test.ts`. Routes `app/3d/{layout,page}.tsx` + `app/3d/[slug]/page.tsx` (10 SSG slugs, `dynamicParams = false`).
- `src/lib/api/arcade.ts` (arcade client + mock, snake_case wire format) and `src/lib/api/apiBase.ts` (single WP base URL).
- `play50games-backend/play50games/` – WordPress theme, REST `play50/v1` (`games`, `progress`, `unlock-status`, `certificate/*`, `share/*`, `auth/*`, `faq`). New: `includes/arcade-games.json` (server score limits, all `enabled: false`). `arcade-api.php` is not written yet (Phase 3).
- Classic platform: 50 sequential 2D games (unlock chain + certificate). Today `/` is still the dashboard (`src/app/page.tsx`). Game page `games/[id]` → `GameEngine` (one 14k-line file) → `game-types/*Games.tsx` → `*-parts/<Game>.tsx`. Progress: `lib/storage/progressStorage.ts` (keys `play50games_*`). Game contract: `GAME_REQUIREMENTS.md`.
- `html-css-js-games/` – old prototypes, reference only.
- Deploy: Vercel auto-deploys `main` (assumed). WP API is production (`cms.play50.games`); `.env.local` points at it.
- Secrets: `wp-config.php` and `.idea/` are untracked, example configs scrubbed. JWT secret rotation happens in Phase 3.

## Goal

1. `/` becomes a **landing hub** (CSS-animated hero + tabs): **Play Classic 50 Games** (`/classic`) and **3D Arcade** (`/3d`); room for more collections.
2. **3D Arcade** = 10 React Three Fiber mini-games with Hyper3D (Rodin) models. No unlock chain, no certificate, no coupling to classic progress.
3. Each 3D game has its **own score** (local best for everyone) and its **own WP leaderboard** (logged-in users only, public name "First L.", opt-out).

## Routes

| Route | Purpose | Status |
|---|---|---|
| `/` | Server-rendered hub, no three.js | Phase 1 |
| `/classic` | Old dashboard moved verbatim, behaviour unchanged | Phase 1 |
| `/games/[id]` | Classic game page; only change: Exit → `/classic` | Phase 1 |
| `/3d` | Arcade grid: 10 cards, best score each, "soon" badges | Phase 2 |
| `/3d/[slug]` | One game, client-only mount, full screen, `generateStaticParams` for 10 slugs, noindex while "soon" | Phase 2 |
| `/progress`, `/certificate/*` | Classic only; back link → `/classic` | Phase 1 |

"Back to classic" links to fix in Phase 1: `games/[id]/page.tsx:79` (`handleExit`, also covers GameEngine Exit/X/Continue), `progress/page.tsx:183`, `certificate/page.tsx:378`. GameEngine itself is not edited.

## Feature flags (`src/arcade3d/flags.ts`)

| Env var (`"1"` or `"true"` = on) | Off means |
|---|---|
| `NEXT_PUBLIC_ARCADE_ENABLED` | No 3D tab, links, routes (`/3d/*` → 404) or sitemap entries |
| `NEXT_PUBLIC_ARCADE_LEADERBOARD` | Scores stay in localStorage only (status `leaderboard-off`) |
| `NEXT_PUBLIC_ARCADE_API_MOCK` | On = in-memory mock instead of WP (dev only) |

All default off, so merging to `main` is always safe. Read each flag with its literal key (Next inlines them at build time).

## Folder layout

```
play50games-frontend/src/
  arcade3d/
    types.ts flags.ts registry.ts loaders.ts   # Claude. Plain data, server-safe (loaders.ts is "use client")
    registry.sync.test.ts                      # meta.scoring must equal arcade-games.json
    core/                                      # Claude
      types.ts scores.ts useBestScore.ts format.ts PlaceholderScene.tsx            (Phase 0)
      GameShell ShellStage ArcadeGameMount useArcadeStore useRunFrame input inputController
      TouchControls CameraRig collision assets(Model, useModel) sharedAssets(SHARED_ASSETS)
      audio analytics useLeaderboard ErrorBoundary                                  (Phase 2, C2)
      frameLoop gameTime view useFittedView safeArea modelManifest math limits render/ README.md
                                                                   (core follow-up: helpers games share)
    ui/  ArcadeCard ArcadeGrid LeaderboardTable ResultPanel BestScoreBadge  # Cursor K2, display only
    games/<slug>/  meta.ts index.tsx                                       (exist)
                   Scene.tsx rules.ts rules.test.ts assets.ts assets.spec.json README.md
  components/Hub/  HubHero CollectionPanel ArcadeTeaserStrip (Cursor K1) · ClassicProgressBadge (Claude)
  components/Nav/SectionTabs.tsx · components/Header/HeaderWithAuth.tsx (Claude)
  lib/api/arcade.ts apiBase.ts
play50games-frontend/public/models/3d/{shared,<slug>}/*.glb   # Claude (optimized GLBs only)
play50games-frontend/public/images/3d/<slug>.webp             # game owner (thumbnail)
play50games-backend/play50games/includes/arcade-games.json    # Claude (exists)
play50games-backend/play50games/includes/arcade-api.php       # Claude (Phase 3)
play50games-backend/play50games/wt-cpt/arcade-scores-admin.php # Codex X3
tools/hyper3d/**                                              # Codex X2; concepts/ = Claude
docs/platform-plan.md · docs/arcade-api.md                    # Claude
```

## Contracts (code is the source of truth)

- `ArcadeGameMeta` (`types.ts`): slug, title, tagline, description, order, `status: "live" | "soon"`, difficulty, orientation, controls, `scoring`, thumbnail, accent, owner.
- `ScoringRules`: `kind: "points" | "time"`, `maxScore`, `min/maxDurationMs`, `base`, `maxPointsPerSec`, `timeBaseMs?`, `unitLabel`, `display`. Points: server rejects `score > base + maxPointsPerSec * seconds`. Time: `score = max(0, floor((timeBaseMs - durationMs) / 10))`, recomputed by the server. Higher is always better.
- `GameDefinition` (`core/types.ts`): `Scene`, `Hud?`, `assets: Record<id, ModelAsset>`, `physics?`, `durationMs?`, `lives?`, `camera`, `environment?`, `touchControls`, `hudStats?`, `instructions`, `finalScore?`.
- Run phases `loading | ready | countdown | playing | paused | over`; `end(reason)` is idempotent. Games end runs with `end()`; GameShell computes the final score (`definition.finalScore` or store `score` + `elapsedMs`) and calls `submitScore` once per run. `end("quit")` exits without saving. Time games are ranked only on `end("win")` (`isRankedRun`): `"lose"`/`"timeup"` show the result with status `unranked`, score 0, nothing saved or sent.
- `useArcadeStore` (`core/useArcadeStore.ts`): zustand store = `RunState` + `RunActions` plus shell-only `configure({durationMs, lives})`, `markReady()`, `tick(dtMs)` (advances the 3 s countdown, `elapsedMs`, `timeLeftMs`; `"timeup"` at 0), `countdownMs`, `pausedFrom`, `config`. `start()`/`restart()` increment `runId` (the Scene remounts per run); `reset()` is safe twice; score/stat changes are ignored once `over`; `loseLife()` to 0 ends with `"lose"`. Read with selectors in React, `useArcadeStore.getState()` in the frame loop. `createArcadeStore()` makes an isolated store (tests).
- `useRunFrame((state, dt, time) => …, { priority? })`: runs only while `playing`. Its dt is exactly the play time the run clock counted this frame (≤ 1/20 s, including the rest of the frame in which the countdown ends, so there are no untimed frames; store `frameMs`). It runs before every plain `useFrame` (`FRAME_PRIORITY` in `core/frameLoop.ts`: input -2, clock -1, gameTime -0.75, simulation -0.5, visuals 0), whatever the mount order. Pure twins for tests: `advanceRunClock`, `playedFrameDt`.
- `useGameTime()` → `{ now, delta, play }`: pause-safe animation clock, per run. Never use `state.clock.elapsedTime` (R3F resets it whenever GameShell pauses). Details: `core/README.md`.
- Camera and screen: `useFittedView({ area, pitch, yaws, focus, margin, padding })` → `{ yaw, distance, offset }` (pure `fitView` in `core/view.ts`) keeps a world box on screen, clear of the HUD and touch controls. `useSafeArea()` → live `{ hud[], controls[] }` px rects, including the joystick's lift above the cookie banner. `inputToWorld(moveX, moveY, yaw, out?)` maps screen-relative input to the world. `CameraRig follow={ref | {x,y,z}} followFraction bounds damping offset` snaps on mount and eases into later changes.
- Rendering helpers `core/render`: `useInstanceMatrices`, `BlobShadow`, `useCanvasTexture`. Rules helpers: `core/math` (`createRng`, `randomSeed`, `turnTowards`), `core/limits` (`withinServerLimits`, `capScore` for points games), `distanceToBoxXZ` in `collision.ts`.
- `useInput()` → `MutableRefObject<InputState>`: `moveX/moveY` (-1..1, up = -1), held `jump`/`action`, one-frame `jumpPressed`/`actionPressed`/`swipe`/`tap`, `pointer {x, y, down}` (R3F-style -1..1). Keyboard WASD/arrows, Space, E/Enter; touch joystick/Jump/Action from `definition.touchControls` (coarse pointers only); swipes and taps on the canvas. Esc/P belong to the shell (pause).
- `collision.ts`: pure `{x,y,z}` helpers (`aabbOverlap`, `aabbFromCenter`, `spheresOverlap`, `circlesOverlapXZ`, `sphereAabbOverlap`, `resolveSphereAabb`, `clampToBounds`, `isOutOfBounds`, …) with optional `out` to avoid allocations.
- `assets.tsx`: `<Model asset={…} fallback?={<OwnPrimitive/>} />` (GLB via `useGLTF(url, false, true)`, per-instance clone, SkeletonUtils when `rigged`, `scale/rotationY/yOffset`; the custom fallback or a ~1-unit primitive when the GLB is missing), `useModel(asset)` → `{ scene, animations, failed }`, `useModelFailed(asset)` (no clone). Only urls in `core/modelManifest.ts` (`MODEL_MANIFEST`, `hasModel`) are fetched. Anything else goes straight to its fallback, so missing GLBs make no requests. The assets PR adds the GLB and its manifest line together; `modelManifest.test.ts` checks the list against `public/models/3d`. `SHARED_ASSETS` (runner, robot, battery, crate, tinCan, banana, desk, chair). `CameraRig` (static, or follow a ref or a live point), `playSfx(name)` + mute (`play50games_3d_muted`), `trackArcade` (dataLayer `arcade_start|arcade_game_over|arcade_new_best`), `useLeaderboard(slug)` → `{ enabled, data, loading, error, retry }`.
- `core/scores.ts`: `submitScore(run, userId)` (local first, then POST when JWT + leaderboard flag), `saveRunToAccount` (retry-safe: one local play per run and user), `isRankedRun(rules, endReason)`, `unrankedResult(slug, userId)`, `syncServerScores` (max every 5 min), `readLocalScores`. Keys `play50games_3d_scores:guest` / `play50games_3d_scores:u<id>`; event `play50games_3d_scores_updated`. `SubmitStatus` = `synced | saved-local | login-required | rate-limited | rejected | banned | offline | leaderboard-off | config-error | unranked`. The result screen offers Log in while there is no JWT (guest, cookie-only session, token dropped after a 401) and "Save to my account" only with a JWT.
- `useBestScore(slug)` → `LocalScoreEntry | null` for the current user, updates live.
- `arcadeApi` (`lib/api/arcade.ts`): `submit`, `leaderboard(slug, limit)`, `me()`, `setPrivacy`. `ArcadeMeEntry = { best, best_duration_ms, plays, last_played, rank }`. Errors map from the WP_Error `code` in the body, never the HTTP status alone.
- WP endpoints `play50/v1/arcade/*`: `GET games`, `POST scores` (JWT only), `GET leaderboard/<slug>`, `GET me`, `POST me/privacy`. Reuse `play50_get_jwt_from_header()`, `play50_get_user_id_from_jwt()`, `play50_check_api_key_permission()` from `includes/rest-api.php` (never edit that file).

## Ownership

**Claude-only files** (plan §6): `package.json` + `package-lock.json`, `next.config.js`, `tsconfig.json`, `arcade3d/{core,assets}/**`, `arcade3d/{types,registry,loaders,flags}.ts`, `public/models/3d/**`, WP `functions.php`, `includes/arcade-api.php`, `includes/arcade-games.json`. Also Claude: `vitest.config.mts`, `lib/api/{arcade,apiBase}.ts`, `CLAUDE.md`, `skills.md`, `AGENTS.md`, `docs/**`.

| ID | Package | Owner | Files |
|---|---|---|---|
| C0 | Contracts, stubs, deps, hygiene, docs | Claude | Phase 0 list |
| C1 | `/classic` move, hub page, nav, links, SEO, stale-JWT fix | Claude | `app/{page,layout,sitemap}`, `app/classic/**`, 3 link files, Header, Footer, Nav, ClassicProgressBadge, `auth.ts`, `AuthContext.tsx` |
| K1 | Hub visuals | Cursor | `components/Hub/{HubHero,CollectionPanel,ArcadeTeaserStrip}.*` |
| X2 | Hyper3D CLI | Codex | `tools/hyper3d/**` except `concepts/` |
| C2 | 3D core + `/3d` routes | Claude | `arcade3d/core/**`, `app/3d/**` |
| K2 | Arcade UI kit | Cursor | `arcade3d/ui/**` |
| X3 | WP admin page | Codex | `wt-cpt/arcade-scores-admin.php` |
| C3 / C4 | robot-collector; leaderboard API + client + privacy | Claude | `games/robot-collector/**`, `arcade-api.php`, `arcade.ts`, `scores.ts`, privacy page |
| A | Asset generation + assets PRs | Claude (user approves spend) | `public/models/3d/**`, `tools/hyper3d/concepts/**`, `arcade-games.json` |
| Games | 4 / 3 / 3 games | Claude / Cursor / Codex | `games/<slug>/**` (see `skills.md`) |

Branches: Cursor `cursor/<pkg>`, Codex `codex/<pkg>` (local worktree or cloud branch). Claude merges after the ownership check `git diff --name-only main...<branch>`.

## Rules for every game folder

- Touch only `arcade3d/games/<slug>/**` and `public/images/3d/<slug>.webp`.
- No imports from `components/GameEngine/**`, `lib/storage/progressStorage` or `lib/api/progress`. Classic pages never import arcade code.
- `meta.ts` is plain data: no three/R3F/React imports. No top-level `useGLTF.preload`. Game code is loaded only via `loaders.ts`.
- `meta.scoring` must equal `arcade-games.json` (`registry.sync.test.ts`). Limit changes go through Claude's "assets + limits" PR.
- `rules.ts` is pure and deterministic with a seed; `rules.test.ts` covers scoring.
- Use core (`core/README.md`): `GameDefinition`, `useRunFrame`, `useGameTime`, `useInput` + `inputToWorld`, `useFittedView` + `CameraRig`, collision, `core/render`, `core/math`, `core/limits`, `<Model fallback>` + `SHARED_ASSETS`. Generic code never lives in a game folder; ask Claude to add it to the core. Never write localStorage or call the API yourself.
- Keyboard AND touch. 60 fps target on mid phones, ≤ 150 draw calls.
- Budgets: characters ≤ 20k tris, 1024 px textures, ≤ 1.5 MB; props ≤ 5k tris, 512 px, ≤ 300 KB.
- Primitives are fine until the GLB exists (unlisted in `core/modelManifest.ts` = never fetched, `<Model fallback>` draws yours). Swap via `assets.ts`, not scene logic.
- Set `status: "live"` last.

## Hyper3D (Rodin) pipeline

- CLI `tools/hyper3d/` (Node fetch): `plan`, `budget`, `smoke`, `gen --confirm`, `import`, `optimize`, `--mock` everywhere. Codex builds it; only Claude or the user runs paid commands.
- **Credits are spent only after the user approves the batch in chat.** `gen` refuses without `--confirm`, outside the main checkout, or below a 2-credit reserve.
- Keys and spend ledger live in `%USERPROFILE%\.play50\` (`hyper3d.env`). Never in git, logs or chat.
- API base `https://api.hyper3d.com/api/v2`: `/rodin` (multipart) → poll `/status` → `/download` (links expire in ~10 min).
- Characters: image-to-3D from ChatGPT concept art, `Gen-2.5-Medium`, `quality_override ≈ 18000`, T-pose. Props: text-to-3D, `Gen-2.5-Low`, 1.5–4k faces. Always `glb`, `mesh_mode=Raw`, `material=PBR`, fixed `seed`. Never HighPack or Extreme-High.
- `optimize` (gltf-transform): center pivot, webp textures (1024 / 512), simplify, meshopt, inspect; fails over budget. Load with `useGLTF(url, false, true)` (meshopt, no Draco CDN).
- Raw originals stay in `tools/hyper3d/raw/` (gitignored). Only optimized GLBs are committed.
- Smoke test first on the 10-credit lab account. Production budget ≈ 42 generations ≈ 21 credits of 45 (plan §4).
- Rigging: one "Play50 Runner" via Mixamo (optional); every other character is animated in code.

## Phases

| Phase | Scope | Who | Status |
|---|---|---|---|
| 0 | Contracts, stubs, deps, repo hygiene, docs | Claude | **In progress** (deps, contracts, stubs, scores + tests, arcade client, `arcade-games.json`, hygiene done) |
| 1 | Hub + `/classic` + nav/SEO + stale-JWT fix → **Release 0** (arcade flag off) | Claude C1 ∥ Cursor K1 ∥ Codex X2 | Not started |
| 2 | 3D core + `/3d` routes + UI kit + WP admin page | Claude C2 ∥ Cursor K2 ∥ Codex X3 | C2 done on `claude/c2-core`; K2, X3 open |
| 3 | robot-collector + leaderboard API on prod + JWT rotation → **Release 1** | Claude | Not started |
| 4 | Games 2–10, one at a time (order in `skills.md`) | Owners | Not started |
| 5 | Polish: JSON-LD, Lighthouse ≥ 90, trailer/OG, run tokens | Claude · Cursor · Codex | Not started |

Phase 0 exit: `npm run build`, `npx tsc --noEmit`, `npx vitest run` pass; `/` bundle unchanged; pushed to `main`.

## Working agreements

- Style: 3-space indent, double quotes, semicolons, TS strict-ish. Match surrounding code.
- New UI: CSS Modules (`*.module.css`) + existing CSS vars (`var(--card)`, …). Never edit `globals.css` for new work. No Tailwind, no new UI libraries.
- Do not touch classic game logic (`GameEngine/**`, `progressStorage`) or the WP theme unless the task says so. `rest-api.php` is never edited; `functions.php` only gets guarded `require_once` lines (Claude).
- Only Claude edits `package.json` / lockfile. Ask Claude for a new dependency.
- Before "done", in `play50games-frontend`: `npm run build` and `npx vitest run` (plus `npx tsc --noEmit`).
- Never commit `graphify-out/`, `.next/`, `node_modules/`, `tools/hyper3d/raw/`, or secrets (`.env*.local`, `wp-config.php`, `.idea/`, Hyper3D keys).
- Backend is tested on **production only**, via the plan §3 "5.4" safety procedure: DB + file backup → `php -l` before every upload → upload with arcade flags off and only the game under test `enabled` → "arcade-test" user + curl suite → admin "Reset game" → then flags on. The user uploads WP before the frontend.
- PhpStorm upload-on-save goes to live: keep `wp-config.php` excluded.
- `$KEY` / `$JWT` come from local env, never pasted into chat.
- Small PRs: one game or one core change per PR.
- Unsure about scope or a decision? Ask the user (via Claude) before guessing. Decisions are listed in `skills.md`.
