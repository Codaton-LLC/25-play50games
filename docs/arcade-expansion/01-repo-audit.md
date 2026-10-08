# Deliverable B: Existing repository audit

Repository `Codaton-LLC/25-play50games`, `main` at `422fdff` (2026-10-08), read in full for the arcade parts. Paths below are relative to `play50games-frontend/src/` unless they start with a top-level folder. Tags: **[V]** verified in the repo, **[W]** web, **[A]** assumption.

## B.1 Stack and runtime

| Area | Finding | Source |
|---|---|---|
| Framework | Next 14.2 App Router, React 18.3 (lockfile; `package.json` ranges ^14 / ^18.2), TypeScript, plain CSS + CSS Modules, CSS vars (`--bg #0b1020`, `--card`, `--stroke`, `--accent #7dd3fc`), dark only, system fonts, Heroicons. No Tailwind. | `package.json`, `docs/platform-plan.md` **[V]** |
| 3D | `three ~0.170`, `@react-three/fiber ^8.18`, `@react-three/drei ^9.122`, `@react-three/rapier ^1.5` (lazy), `zustand ^4.5`. Dev: `vitest ^2.1`. | `package.json` **[V]** |
| Physics | Rapier is wired lazily (`core/ShellStage.tsx:17`, `PhysicsGate`) behind `GameDefinition.physics`, but **no game sets `physics: true`** (obstacle-race uses custom rules, `games/obstacle-race/index.tsx:20`). | **[V]** |
| Renderer | One `<Canvas>` per game: `dpr={[1, 1.75]}`, `antialias: true`, `powerPreference: "high-performance"`, camera near 0.1 / far 400, drei `PerformanceMonitor`: on a decline DPR drops to 1, after 3 declines it stays there. No shadow maps (games use `BlobShadow`), no post-processing. | `core/ShellStage.tsx:19-26, 141-163` **[V]** |
| Lighting | Three presets, each ambient + hemisphere + one directional light: `day`, `indoor`, `night`. Background colour and optional fog per game. | `core/ShellStage.tsx:49-91` **[V]** |
| Audio | 7 synthesized cues (`pickup`, `hit`, `jump`, `win`, `lose`, `countdown`, `go`) through Web Audio, mute per device (`play50games_3d_muted`), AudioContext only inside a trusted gesture. No loops, no music, no positional sound. | `core/audio.ts:12-192`, `core/README.md` "Sound" **[V]** |
| Routing | `/` hub (server, no three.js), `/classic`, `/3d` grid (server), `/3d/[slug]` static for every slug in `ARCADE_SLUGS` with `dynamicParams = false`, game mounted client-only through `GAME_LOADERS` (one chunk per game). | `app/3d/page.tsx`, `app/3d/[slug]/page.tsx`, `arcade3d/loaders.ts` **[V]** |
| Flags | `NEXT_PUBLIC_ARCADE_ENABLED`, `_LEADERBOARD`, `_API_MOCK`, read with literal keys. | `arcade3d/flags.ts` **[V]** |
| Deploy | Vercel auto-deploys `main` (https://25-play50games.vercel.app). WordPress (https://cms.play50.games) is uploaded **by hand**; merging never deploys the backend. | CLAUDE.md **[V]** |

## B.2 Game structure and contracts

- **Registration.** `types.ts` defines `ARCADE_SLUGS` as a literal tuple of **10** slugs; `ArcadeSlug` is derived from it, so a new game is a type change (Claude-owned). `registry.ts` imports each `games/<slug>/meta.ts` (plain data) and sorts by `order`. `loaders.ts` maps every slug to a dynamic `import()` **[V]**.
- **Meta.** `ArcadeGameMeta`: slug, title, tagline, description, order, `status: "live" | "soon"`, difficulty 1–3, orientation, `controls { scheme, keyboard, touch }`, `scoring`, thumbnail, accent, `owner: "claude" | "cursor" | "codex"`. There is no collection field and no hidden/dev status; `antigravity` and `kimi` are not valid owners **[V]** `types.ts`.
- **Control schemes**: `joystick | lanes | runner | hop | tap-target | platformer | point-and-move` **[V]**. Missing for the expansion: aim-and-release (golf, cannons, snowballs, castle), steer (penguin), timing (knight, monster kitchen), look (museum), flight (drone, rocket).
- **GameDefinition** (`core/types.ts`): `Scene`, `Hud?`, `assets`, `physics?`, `durationMs?`, `lives?`, `camera`, `environment? { background, fog?, lighting }`, `touchControls` (`joystick | jump | action | swipe | tap`), `hudStats?`, `instructions`, `resultDelayMs?`, `finalScore?` **[V]**.
- **Run lifecycle**: phases `loading | ready | countdown | playing | paused | over`; `end(reason)` idempotent; GameShell computes and submits the score once; result delay (default 800 ms) for end animations; `restart()` remounts the Scene by `runId` **[V]** `core/README.md`.
- **Frame order** is fixed by priorities (input −2, clock −1, gameTime −0.75, simulation −0.5, camera −0.25, pose −0.125, visuals 0) **[V]** `core/frameLoop.ts`.
- **Folder per game**: `meta.ts`, `index.tsx`, `Scene.tsx`, `rules.ts` (pure, seeded), `rules.test.ts`, `assets.ts`, `assets.spec.json`, `Primitives.tsx`, `README.md`, often `Hud.tsx`, `camera.ts`, `poses.ts`, `gait.ts`. Games never import each other **[V]**.
- **Scoring**: `meta.scoring` must equal `play50games-backend/play50games/includes/arcade-games.json` (`registry.sync.test.ts`); the JSON is at version 2 with all 10 games; the server validates slugs with `^[a-z0-9-]{1,40}$` and skips entries with bad limits **[V]** `arcade-api.php:85-129`.
- **Live state (2026-10-08)**: `status: "live"` in code for robot-collector, food-catcher, pigeon-crossing; `enabled: true` in the JSON for 8 games (all but penalty-hero and obstacle-race), from the last two commits (`83e73ba`, `422fdff`) **[V]**. CLAUDE.md's "Where we are" still describes 3 enabled games, so it is one step behind the JSON.

## B.3 Reusable systems already in core (do not rebuild)

| System | What exists | File |
|---|---|---|
| Shell | WebGL check, loading, start card (instructions, best, top 10), 3-2-1 countdown, HUD, pause (Esc/P, tab hidden), result with Retry/Exit, rotate-device and context-lost overlays, focus management | `GameShell.tsx`, `ShellOverlays.tsx`, `ShellStage.tsx` |
| Store | zustand run state + actions, `createArcadeStore()` for tests, `advanceRunClock` / `playedFrameDt` pure twins | `useArcadeStore.ts`, `frameLoop.ts` |
| Input | keyboard WASD/arrows/Space/E/Enter, joystick, Jump/Action buttons, swipes mid-gesture, `tap`, `tapDown`, `pressed` one-frame edges, pointer | `input.tsx`, `inputController.ts` |
| Camera | `useFittedView` / pure `fitView` (keeps a world box on screen clear of HUD, controls and the cookie banner, lens shift), `CameraRig` follow, `followFocus` | `useFittedView.ts`, `view.ts`, `CameraRig.tsx` |
| Safe area | live rects of HUD, controls and obstructions | `safeArea.tsx` |
| Collision | XZ circles, AABB, sphere vs AABB resolve, bounds, `sweptAabbXZ` | `collision.ts` |
| Math | `createRng`, `rngNext`, `randomSeed`, `turnTowards`, `inputToWorld` | `math.ts` |
| Models | `<Model asset fallback>`, `useModel`, `<InstancedModel>`, `<DynamicInstancedModel>`, manifest gating (unlisted GLBs never fetched), cache clearing on exit | `assets.tsx`, `modelManifest.ts`, `GameShell.tsx:288` |
| Render | `<Instanced>`, `useInstanceMatrices`, `<DynamicInstanced>`, `BlobShadow`, `useCanvasTexture` | `render/` |
| Characters | auto-rig for static T-pose GLBs (17 bones, skin weights from landmarks), procedural poses (walk, idle, carry, reach, cheer, jump, flail), `walkStride`, `gaitPhaseStep`, `bodyLift`, `footPoint`, character tests on the real mesh | `rig/` |
| Scores | local-first save, leaderboard POST with JWT, unranked handling, sync, `useBestScore`, `useLeaderboard` | `scores.ts`, `useBestScore.ts`, `useLeaderboard.ts` |
| Limits | `withinServerLimits`, `capScore` | `limits.ts` |
| Analytics | dataLayer events `arcade_start`, `arcade_game_over`, `arcade_new_best` | `analytics.ts` |

## B.4 Assets

- **39 GLBs, 6.5 MB** in `public/models/3d` **[V]**: characters 439–613 KB (robot, runner, chef, striker, keeper, pigeon, cleaner), props 41–182 KB. Shared: runner, robot, battery, crate, tinCan, banana, desk, chair, coin.
- Budgets: characters ≤ 20k tris, 1024 px, ≤ 1.5 MB; props ≤ 5k tris, 512 px, ≤ 300 KB **[V]** (tris and bytes in `sharedAssets.ts` `CHARACTER_BUDGET` / `PROP_BUDGET`; texture sizes in CLAUDE.md and the `optimize` step).
- Pipeline: Hyper3D Rodin through the **official Rodin MCP** in the user's local Claude Code (OAuth, no API key; tiers Gen-2.5-Extreme-Low / Medium / High, no seed, no T-pose flag, no balance tool) → `node tools/hyper3d/src/cli.mjs import` → `optimize` (gltf-transform: centred pivot, webp textures, simplify, meshopt, budget check) → manifest line → `scale` / `stretch` / `rotationY` fitted in the game's `assets.ts` **[V]** CLAUDE.md, `tools/hyper3d/README.md`.
- The MCP lives in `~/.claude.json` on your PC, **not in this cloud session**: asset generation can only run in your local Claude Code **[V]**.
- Concepts: `tools/hyper3d/concepts/*.webp` (14 files, none with your face; the v2 face concepts stay in `%USERPROFILE%\.play50\concepts\`) **[V]**.
- Credits: about 40 generations so far (31 before group D, 8 group D, 1 cleaner) **[V]** CLAUDE.md; recorded rate 0.5 credit per generation **[V]** `docs/platform-plan.md` §4 (the platform plan itself notes the marketing page said "from 1"). Third-party pages in 2026 disagree on Rodin pricing and units **[W]** ([3D AI Studio](https://www.3daistudio.com/blog/how-to-use-rodin-gen-2-5-online-tutorial), [CostBench](https://www.costbench.com/software/ai-3d-generation/rodin-hyper3d/)), and one describes a pay-by-result model (credits charged on download) **[W]**. **The real balance and the per-generation charge must be read from the Hyper3D dashboard before the first batch.**

## B.5 Visual design language (as implemented)

- Characters: stylised humans with a slightly big head, glasses and a beard (v2 runner, chef, striker, keeper, cleaner, from your concepts), a matte white robot with soft blue panels and a glowing visor, a chubby grey pigeon **[V]** CLAUDE.md.
- Props: rounded, slightly chunky, clean painted textures, mostly mid-saturation (wooden crate, blue barrel, red apple, gold coin) **[V]** GLBs and thumbnails.
- Scenes: deep navy shell background `#0b1020`, per-game background and fog, soft hemisphere lighting, blob shadows, canvas-drawn floor textures, no outlines, no cel shading.
- Documented preference: "premium mobile game: clean, matte, soft panels; NOT toy/cartoon/saturated (the first toy-style prompts looked clownish)" **[V]** CLAUDE.md. `skills.md` still carries the older "saturated colours" style block **[V]**. The plan resolves this in favour of the implemented look (05 §E.1).

## B.6 Mobile support (as implemented)

Touch joystick, Jump/Action buttons (coarse pointers only), swipes, taps; screen-relative movement; camera fit that avoids the HUD, controls and the cookie banner; rotate overlay for `orientation`; 44 px touch targets; DPR adaptation; context-loss overlay. Checked headless at 390 × 844, 360 × 740, 844 × 390 and 1280 × 800 **[V]** `core/README.md`. **No real-device performance numbers are recorded** for any game: "60 fps on a mid phone" is a target, not a measurement **[V]**.

## B.7 Tooling and tests

- `npm test` = vitest; about 1,015 tests on `main` **[V]** CLAUDE.md. Per-game tests are 690–2,810 lines; READMEs 213–539 lines **[V]**.
- `tools/hyper3d` (CLI, `node --test`), `tools/thumbs` (headless Chrome over CDP: plays a run and captures a 640 × 360 webp; per-game input scripts in `inputs.mjs`), `tools/og` (OG cards), `tools/arcade-api-smoke.sh` (never against production without your OK) **[V]**.
- Headless playtests over CDP are the review practice because the Claude browser pane stays at "Loading" for R3F **[V]** CLAUDE.md.

## B.8 Limitations that matter for 20 more games

| # | Limitation | Impact | Fix (phase) |
|---|---|---|---|
| L1 | `ARCADE_SLUGS`, `AgentOwner`, `ControlScheme` and `status` are closed unions for 10 games, 3 agents | new games do not type-check | P1-A |
| L2 | `/3d` is one flat grid; copy hard-codes "10" / "Ten" (`app/page.tsx:82, 113, 122`, `app/3d/page.tsx:35`) | 30 cards do not scan; copy goes stale | P1-A + UI kit task |
| L3 | No hidden state for work in progress (`soon` cards are visible on production) | 20 in-progress games would show as 20 "Soon" cards | P1-A (`dev` + preview flag) |
| L4 | No shared particles, floating text, camera shake | 20 games would each write their own | P1-B |
| L5 | 7 one-shot sounds, no loops (engines, vacuums, belts, thrusters) | many new games need a loop | P1-B |
| L6 | No shared perf probe; budgets checked by review | regressions are invisible | P1-B + `tools/perf` |
| L7 | No aim-drag gesture, no digit keys, no ballistics, paths, steering, vision, patrol, procedural creature motion | 19 of the 20 games would re-invent at least one | P1-C, P1-D |
| L8 | No bone attachments, no material override, no per-copy tint for GLB pools | forces extra Hyper3D generations | P1-D |
| L9 | Lighting presets only `day / indoor / night`; no water, sky or starfield helpers | snow, sunset, sea and space games | P1-B |
| L10 | Agent read order ≈ 200 KB of mandatory docs | ~50k tokens per session before work starts | D10 (slim CLAUDE.md, read sets) |
| L11 | Per-game test and README size grew with every review round | biggest single cost driver after rework | test and README budgets (09 §K.4) |
| L12 | Open core issues: Esc/P resume behind the rotate overlay; the bottom safe-area inset is not reported; the cookie banner is found by a 1 s poll **[V]** CLAUDE.md, `core/README.md` | small, but every new game inherits them | fix in P1-B |

## B.9 Missing information (cannot be verified from here)

| Item | Who can provide it | Needed by |
|---|---|---|
| Hyper3D balance and the real charge per Gen-2.5 Medium generation (and whether rejected previews are free) | you, Hyper3D dashboard | asset batch 1 (Phase 2) |
| Real-device frame times for the 10 existing games on a mid Android phone and an iPhone | you (one phone each) + `tools/perf` | Phase 1 exit (baseline) |
| Plan limits of each agent (Codex plan, Antigravity quota, Kimi plan), and whether Cursor credits return | you | Phase 3 (wave planning) |
| Whether Antigravity and Kimi read project skills (`SKILL.md`) and from which folder | first sprint test task (N) | Phase 1 |
| Production PHP version (affects only backend edits; the expansion needs JSON uploads only) | you, Plesk | Phase 8 |

## B.10 How the 20 games fit without a rewrite

1. Each game is a new folder under `arcade3d/games/<slug>/` built against the same `GameDefinition`; nothing in the 10 existing games changes.
2. Every new generic need becomes a core module once (Phase 1), with tests, before games start, so no "core follow-up" round interrupts the waves.
3. New statuses and collections are additive fields with defaults (an omitted `collection` means `"originals"`, so the 10 existing meta files are not edited).
4. The backend needs only new entries in `arcade-games.json` (disabled until each go-live), no PHP change.
5. Bundle impact is per route: each game is its own lazy chunk, and `/` and `/classic` stay free of three.js (checked at every PR by the route table).
