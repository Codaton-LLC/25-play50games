# 3D Arcade – game catalog, Hyper3D prompts, hand-offs

Project context: `CLAUDE.md`. Full plan: `docs/platform-plan.md`. API contract: `docs/arcade-api.md`.
Scoring source of truth = each game's `arcade3d/games/<slug>/meta.ts`, mirrored in `play50games-backend/play50games/includes/arcade-games.json`.

## Decisions

- Name **"3D Arcade"**. Hub tabs: **Play Classic 50 Games** (`/classic`) and **3D Arcade** (`/3d`). Classic dashboard moves from `/` to `/classic`.
- No hero video yet: CSS-animated hero; a trailer replaces it in Phase 5 via the `media` prop.
- Arcade is separate from classic: no unlock chain, no certificate, own score per game.
- Leaderboard = **logged-in users only**, public name "First L." with opt-out. Guests keep local bests and can "Save this score to my account" after logging in.
- All 10 games are planned now and shipped **one at a time** in the order below.
- Agents: **Claude** (most work, shared code, backend, assets, all reviews/merges), **Cursor**, **Codex** (ChatGPT). ChatGPT chat makes concept art. No other agents.
- Hyper3D via API (45-credit production account + 10-credit lab account). **Every paid batch is approved by the user in chat first.**
- Backend is tested directly on production with the safety procedure (plan §3 "5.4").
- Secrets removed from git; JWT secret rotation in Phase 3.

## Who builds what

| Agent | Packages | Games |
|---|---|---|
| Claude | C0 contracts, C1 hub/routing, C2 3D core, C3/C4 leaderboard API + client, all assets, reviews, merges | robot-collector, office-escape, warehouse-rush, obstacle-race |
| Cursor | K1 hub visuals, K2 arcade UI kit, Phase 5 trailer + OG images | food-catcher, penalty-hero, clean-city |
| Codex | X2 Hyper3D CLI, X3 WP admin page, Phase 5 run tokens | pigeon-crossing, tower-climb, escape-room |
| ChatGPT chat | Style sheets, character concept art (delivered via the user) | – |

While game N is being built, the owner of game N+1 prepares only its README, `assets.spec.json` and concept art.

## Game catalog (rollout order)

| # | Slug | Title | Owner | Diff | Introduces | Gameplay |
|---|---|---|---|---|---|---|
| 1 | `robot-collector` | Robot Collector | Claude | 1 | Reference game: joystick, collect + timer | Steer a tiny warehouse robot, collect all 10 batteries before the timer hits zero. Every second left is bonus points. |
| 2 | `food-catcher` | Food Catcher 3D | Cursor | 1 | Template works for another agent; spawners | A chef catches falling fruit. 5 catches in a row = 2x combo. Three bad items and you are out. |
| 3 | `office-escape` | Office Escape | Claude | 1 | Rigged runner, lane runner | Endless lane runner through an office: change lanes, jump desks, dodge chairs. Faster every 20 s. Distance + coins. |
| 4 | `pigeon-crossing` | Pigeon Crossing | Codex | 2 | Grid hop, deterministic traffic | Hop a pigeon lane by lane across traffic. Every level adds faster cars. |
| 5 | `penalty-hero` | Penalty Hero | Cursor | 2 | Tap target, keeper AI | 10 shots. Pick one of 6 target zones, the keeper guesses a side. Streaks give bonus points. |
| 6 | `warehouse-rush` | Warehouse Rush | Claude | 2 | Carry and drop, colour zones | 60 s: pick up coloured boxes, drop each in the matching zone. Wrong zone costs points. |
| 7 | `tower-climb` | Tower Climb | Codex | 2 | Vertical platformer | Climb moving and falling platforms, grab coins, reach checkpoints. Camera follows. Height + coins. |
| 8 | `clean-city` | Clean the City | Cursor | 1 | 3 maps from config | Collect all litter on park, city and beach maps (same code, config per map). Faster = time bonus. |
| 9 | `escape-room` | Tiny Escape Room | Codex | 2 | Raycast, inventory | Search a small room for the key, the book and the battery, then unlock the door. Fastest escape wins. |
| 10 | `obstacle-race` | Obstacle Race | Claude | 2 | Rapier physics | Physics course: rotating bar, jump platforms, moving blocks, balance bridge. Fall = back to checkpoint. Best time wins. |

### Controls (from `meta.ts` / `index.tsx`)

| Slug | Scheme | Keyboard | Touch | `touchControls` |
|---|---|---|---|---|
| robot-collector | joystick | WASD / arrows to move | Joystick to move | joystick |
| food-catcher | lanes | Left / right arrows to move | Drag or tap left / right | swipe, tap |
| office-escape | runner | Left / right to change lane, Space to jump | Swipe left / right, swipe up to jump | swipe |
| pigeon-crossing | hop | Arrows / WASD to hop | Swipe or tap to hop | swipe, tap |
| penalty-hero | tap-target | Arrow keys to aim, Space to shoot | Tap a target zone | tap |
| warehouse-rush | joystick | WASD to move, E / Space to pick up and drop | Joystick + Action button | joystick, action |
| tower-climb | platformer | Left / right to move, Space to jump | Joystick + Jump button | joystick, jump |
| clean-city | joystick | WASD / arrows to move | Joystick to move | joystick |
| escape-room | point-and-move | WASD to move, click to inspect | Joystick + tap to inspect | joystick, tap |
| obstacle-race | platformer | WASD to move, Space to jump | Joystick + Jump button | joystick, jump |

### Scoring limits (from `meta.ts`, must equal `arcade-games.json`)

Points games: server rejects `score > maxScore` or `score > base + maxPointsPerSec × seconds`. Time games: `score = max(0, floor((timeBaseMs − durationMs) / 10))`, computed by the server; the UI shows the best time.

| Slug | Kind | Max score | Duration window | Cap (base + pts/s) | Unit | Display |
|---|---|---|---|---|---|---|
| robot-collector | points | 1,600 | 5 s – 75 s | 600 + 120/s | pts | int |
| food-catcher | points | 5,000 | 5 s – 100 s | 0 + 50/s | pts | int |
| office-escape | points | 200,000 | 3 s – 30 min | 0 + 100/s | pts | int |
| pigeon-crossing | points | 50,000 | 3 s – 30 min | 0 + 100/s | pts | int |
| penalty-hero | points | 1,500 | 10 s – 10 min | 0 + 150/s | pts | int |
| warehouse-rush | points | 3,000 | 5 s – 75 s | 0 + 50/s | pts | int |
| tower-climb | points | 50,000 | 3 s – 30 min | 0 + 100/s | pts | int |
| clean-city | points | 6,000 | 10 s – 15 min | 1000 + 100/s | pts | int |
| escape-room | time | 60,000 | 15 s – 10 min | timeBase 600 s | time | time |
| obstacle-race | time | 30,000 | 15 s – 5 min | timeBase 300 s | time | time |

Limits are provisional. Changing one = Claude's "assets + limits" PR (meta + JSON together), never a game branch.

### Models per game (plan §4)

`×N` = generations budgeted for that asset. **→ shared** = saved to `public/models/3d/shared/` and reused later. Everything else goes to `public/models/3d/<slug>/`.

| Slug | Universe (seed) | Generate with Hyper3D | Reuse from shared | Primitives in code |
|---|---|---|---|---|
| robot-collector | warehouse | robot ×3 → shared, battery → shared, crate → shared, barrel (all on lab account) | – | floor, walls |
| food-catcher | food | chef ×2, apple, banana → shared, burger, sock, tinCan → shared, runner final ×2 → shared | – | counter, lanes |
| office-escape | office | desk → shared, printer, chair → shared, coffee cart, water cooler | runner | corridor, coins |
| pigeon-crossing | street | pigeon ×2, car, taxi, van | – | road, kerbs |
| penalty-hero | stadium | striker ×2, keeper ×2 | – | ball, goal frame + net, pitch |
| warehouse-rush | warehouse | shelf rack, pallet | robot, crate (tinted per zone) | colour zones |
| tower-climb | playground | flag, spring pad | runner | platforms |
| clean-city | shared-cast (5050) | bottle, paper bag | runner, tinCan, banana | ground per map, bin, bench, lamp, palm, umbrella |
| escape-room | office | key, book, door, console | runner, battery, desk, chair | room shell |
| obstacle-race | playground | finish arch | runner | obstacles (Rapier colliders) |

Budget: about 42 production generations ≈ 21 credits at 0.5/generation (of 45), plus ~10 lab generations. If the smoke test shows 1.0/generation, Claude applies the cut list (about 30 generations).

## Hyper3D (Rodin) prompt conventions

Style name: **"Play50 toy world"** – bright vinyl-toy look, one seed per universe (recorded in `assets.spec.json`).

| | Characters | Props |
|---|---|---|
| Mode | image-to-3D from approved ChatGPT concept art | text-to-3D |
| Tier | `Gen-2.5-Medium` | `Gen-2.5-Low` (Fast) |
| Detail | `quality_override ≈ 18000` | 1.5–4k faces |
| Pose | T-pose on | – |
| Always | `glb`, `mesh_mode=Raw`, `material=PBR`, universe `seed` | same |
| Never | HighPack, Extreme-High | same |
| After `optimize` | ≤ 20k tris, 1024 px textures, ≤ 1.5 MB | ≤ 5k tris, 512 px, ≤ 300 KB |

Prompt formula (subject first, then the blocks):

```text
Style block:     Play50 toy world style, bright vinyl toy look, smooth rounded shapes, saturated colours, friendly cartoon proportions
Prop suffix:     single isolated prop, centered, no base, no ground, no text, clean game-ready low-poly topology
Character text:  <subject>, Play50 toy world style, full body, T-pose, clean game-ready topology   (sent with the concept image)
Prop prompt:     <subject>, <style block>, <prop suffix>
```

### Example subjects per game

| Game | Asset | Type | Subject |
|---|---|---|---|
| robot-collector | robot | character | small friendly utility robot, rounded capsule body, big round glowing eyes, short antenna, stubby legs, teal and white |
| robot-collector | battery / crate / barrel | prop | chunky battery cell with a lightning bolt symbol, green glow · wooden shipping crate with metal corners · blue metal barrel with two ridges |
| food-catcher | chef | character | chunky chef mascot, oversized white chef hat, round belly, red neckerchief, white apron |
| food-catcher | runner (shared) | character | "Play50 Runner": sporty mascot, hoodie, shorts, sneakers, headband, big expressive eyes |
| food-catcher | good / bad food | prop | shiny red apple with one leaf · single yellow banana · big strawberry with green leaves · cartoon burger with cheese and lettuce · old striped sock with a hole · dented tin can with a blank label |
| office-escape | office kit | prop | simple office desk · boxy office printer with paper tray · rolling office chair · small coffee cart with cups · office water cooler with a blue bottle |
| pigeon-crossing | pigeon | character | chubby city pigeon mascot, oversized head, big expressive eyes, grey-blue feathers, green-purple neck sheen, wings spread |
| pigeon-crossing | vehicles | prop | small rounded red hatchback car · rounded yellow taxi with roof sign · boxy white delivery van |
| penalty-hero | striker / keeper | character | football striker mascot, blue kit with number 10, boots · goalkeeper mascot, bright green kit, oversized gloves |
| warehouse-rush | warehouse kit | prop | two-level metal warehouse shelf rack, orange uprights · wooden pallet |
| tower-climb | climb kit | prop | checkpoint flag on a short pole, yellow flag · round bounce spring pad, red top |
| clean-city | litter + map props | prop | crushed plastic bottle · crumpled plastic bag · green public bin with lid · wooden park bench · small palm tree · striped beach umbrella · street lamp post |
| escape-room | room items | prop | big golden old-fashioned key · thick red hardcover book · wooden door with frame and keypad · sci-fi control console with buttons and a small screen |
| obstacle-race | finish | prop | inflatable finish line arch with a checkered banner |

## ChatGPT concept art (characters only)

Characters needing art: robot, runner, chef, pigeon, striker, keeper. The user pastes the prompt into ChatGPT and passes the PNG to Claude (saved as `tools/hyper3d/concepts/<slug>-<id>.png`).

Style sheets (once, step S0; the user picks one and attaches it to every concept prompt):

```text
Create a style sheet for a family-friendly 3D browser game world called "Play50 toy world". Show one small character, three props (a crate, an apple, a traffic cone), an 8-colour palette and a material sample. Look: bright vinyl toy, smooth rounded shapes, saturated colours, soft studio light, simple clean materials, no outlines, no fine texture noise, friendly cartoon proportions. Make 3 different options (A, B, C) as separate 1536x1024 images.
```

Concept art (one per character; attach the chosen style sheet):

```text
Play50 toy-world style, matching the attached style sheet: three-quarter front view of <character subject>, T-pose (arms straight out to the sides, legs slightly apart), full body from head to feet, single figure centered, plain light-grey background, no shadow, no props, no text, no logo, soft even lighting, 1024x1024.
```

Regenerate if feet or hands are cropped, extra objects appear, or the pose is not a clean T-pose.

## Per-game workflow (Phase 4)

1. Owner writes `games/<slug>/README.md` (rules, controls, scoring formula, assets) and `assets.spec.json`. Claude approves.
2. ChatGPT concept art (characters only) arrives through the user.
3. Claude runs `plan`; **the user approves the spend in chat**; Claude runs `gen --confirm` and `optimize`.
4. Claude opens the "assets + limits" PR: GLBs + the game's `arcade-games.json` entry. The WP JSON goes live first.
5. Owner builds `Scene`, `rules` + tests, `assets.ts` and the thumbnail on `<agent>/game-<slug>`; sets `status: "live"` last.
6. Claude reviews: `git diff --name-only main...<branch>`, build, vitest, plays on phone and desktop. Then merge and deploy.

## Definition of done (per game)

- Folder has `meta.ts`, `index.tsx`, `Scene.tsx`, `rules.ts`, `rules.test.ts`, `assets.ts`, `assets.spec.json`, `README.md`; thumbnail `public/images/3d/<slug>.webp`.
- Plays end to end from `/3d/<slug>`: ready → countdown → playing → pause/resume (Esc/P, tab hidden) → over → retry / exit.
- Keyboard on desktop and touch at 375px (emulation + one real phone). 60 fps target on a mid phone, ≤ 150 draw calls.
- Runs end with `end(reason)`; GameShell submits. Best score shows on the `/3d` card. No localStorage or API calls in the game.
- `rules.ts` pure + seeded, covered by `rules.test.ts`. `meta.scoring` equals `arcade-games.json`.
- Models within budget (`optimize` passes); game still runs with primitives if a GLB is missing.
- No imports from classic (`GameEngine/**`, `progressStorage`, `lib/api/progress`); only own folder + thumbnail changed.
- `npm run build`, `npx tsc --noEmit`, `npx vitest run` pass in `play50games-frontend`.
- `status: "live"` set in the last commit.

## Hand-off prompts

Claude tells the user when to paste each one. Branches: `cursor/<pkg>`, `codex/<pkg>`.

| Prompt | Agent | Branch | Paste when |
|---|---|---|---|
| K1 | Cursor | `cursor/k1-hub-visuals` | Phase 0 is on `main` (Phase 1 start) |
| X2 | Codex | `codex/x2-hyper3d-cli` | Phase 0 is on `main` (Phase 1 start) |
| K2 | Cursor | `cursor/k2-arcade-ui` | Release 0 is out (Phase 2 start) |
| X3 | Codex | `codex/x3-arcade-admin` | Release 0 is out and `docs/arcade-api.md` is final |
| Game | Cursor / Codex | `<agent>/game-<slug>` | Previous game released and this game's assets PR merged |

### K1 – Hub visuals (Cursor)

```text
Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md and docs/platform-plan.md first (§2 is your spec). Work on branch `cursor/k1-hub-visuals`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend.

Task K1: landing hub visuals.

Files you may create or edit (nothing else):
- play50games-frontend/src/components/Hub/HubHero.tsx + HubHero.module.css
- play50games-frontend/src/components/Hub/CollectionPanel.tsx + CollectionPanel.module.css
- play50games-frontend/src/components/Hub/ArcadeTeaserStrip.tsx + ArcadeTeaserStrip.module.css
The three .tsx files already exist as compiling stubs. Keep their export names and prop types exactly. If you need a prop that is not there, stop and ask.

Build:
1. HubHero: about 75vh (60vh under 640px). H1 "Play50Games". Subline "50 classic brain games. 10 new 3D arcade worlds. One place to play." CTAs "Play Classic 50 Games" -> /classic and "Enter the 3D Arcade" -> /3d; when the stub's props say the arcade is off, the second CTA reads "coming soon" and is not a link.
   Background is CSS only (no three.js, no canvas, no video): radial gradients in the existing palette (--bg #0b1020, --card, --stroke, --accent #7dd3fc); a perspective grid floor made of a 2x tall layer looped with translate3d; 6-8 floating inline-SVG tiles (only 4 under 640px); a soft glow behind the H1. When the `media` prop is set, render it as the background instead (Phase 5 trailer).
2. CollectionPanel: one card per collection with title, one-line facts, CTA link and a children slot. Classic facts: "50 games · 5 categories · certificate" (Claude puts the progress badge in the slot). 3D facts: "10 mini-games · own leaderboard each · no unlocks" plus the teaser strip.
3. ArcadeTeaserStrip: horizontal strip of small game tiles (title, accent colour, "Soon" badge when status is "soon") from the data the stub receives. Scroll-snap on mobile.

Rules:
- CSS Modules + existing CSS vars only. Never edit globals.css. No Tailwind, no new dependencies.
- Animate only transform and opacity. @media (prefers-reduced-motion: reduce) stops every animation.
- Responsive via CSS media queries (no JS window-width checks). Mobile first, no horizontal overflow at 375px.
- No data fetching. No imports of three, @react-three/* or arcade3d/core. Server components unless interactivity really needs "use client".
- Accessible: semantic headings, real links for CTAs, decorative SVGs aria-hidden, visible focus styles, text contrast >= 4.5:1.
- Style: 3-space indent, double quotes, semicolons.
- To preview before Claude wires the hub page, use a local scratch page and do not commit it.

Done when:
- `npm run build`, `npx tsc --noEmit` and `npx vitest run` pass in play50games-frontend.
- The build route table shows First Load JS for `/` within ±10 KB of main.
- Checked at 375px and desktop, with reduced motion on and off.
- `git diff --name-only main...cursor/k1-hub-visuals` lists only the six files above.
Reply with: files changed, screenshots (375px + desktop), anything left open.
```

### K2 – Arcade UI kit (Cursor)

```text
Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md and docs/platform-plan.md first. Work on branch `cursor/k2-arcade-ui`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend.

Task K2: 3D Arcade UI kit (display components only).

Files you may create or edit (nothing else):
- play50games-frontend/src/arcade3d/ui/{ArcadeCard,ArcadeGrid,LeaderboardTable,ResultPanel,BestScoreBadge}.tsx
- matching *.module.css files in arcade3d/ui/
The .tsx files exist as compiling stubs. Keep export names and prop types exactly; if you need a prop that is not there, stop and ask.
Types: ArcadeGameMeta + ScoringRules (arcade3d/types.ts), LocalScoreEntry + SubmitResult + SubmitStatus (arcade3d/core/scores.ts), ArcadeLeaderboard + ArcadeLeaderboardEntry (lib/api/arcade.ts).

Build:
1. BestScoreBadge: best for one game via `useBestScore(slug)`; "No score yet" when null. Format by scoring.display: "int" -> "1,234 pts" (unitLabel); "time" -> bestDurationMs as m:ss.cc.
2. ArcadeCard: thumbnail (accent-coloured gradient placeholder when null), title, tagline, difficulty (1-3 dots), BestScoreBadge, accent border/glow. status "soon" -> "Soon" badge, not clickable; "live" -> link to /3d/<slug>.
3. ArcadeGrid: cards in `order`; 1 column at 375px, 2 on tablet, 3-4 on desktop.
4. LeaderboardTable: rank, name, score (same formatting; time games show duration_ms), date. Highlight is_me. If `me` is outside the shown entries, add a separated "You" row. Empty state "Be the first on the leaderboard." Loading and error states come in via props.
5. ResultPanel: final score, "New best!" when isNewBest, best, rank when present, Retry and Exit buttons, and one message per SubmitStatus:
   - synced: "Saved to the leaderboard. Rank #<rank>."
   - saved-local, leaderboard-off: "Saved on this device."
   - login-required: "Log in to put this on the leaderboard." + Log in button; once logged in (prop), show "Save this score to my account".
   - rate-limited: "Too many scores in a row. Saved on this device, try again in a minute."
   - rejected: "This score could not be verified. Saved on this device."
   - banned: "This account cannot post to the leaderboard."
   - offline: "You are offline. Saved on this device."
   - config-error: "The leaderboard is unavailable right now. Saved on this device."
   - unranked: "Finish the course to set a time. This run was not saved." (time games that end with lose/timeup)
   Every action is a callback prop; ResultPanel never calls the API.

Rules:
- Display only. The only hook allowed is useBestScore. No fetching, no API/store imports, no three or @react-three/* imports.
- CSS Modules + existing CSS vars. Never edit globals.css. No new dependencies.
- Mobile first: touch targets >= 44px, no horizontal overflow at 375px. Accessible: <table> semantics for the leaderboard, real <button>s, aria-live="polite" on the submit message.
- Style: 3-space indent, double quotes, semicolons.

Done when:
- `npm run build`, `npx tsc --noEmit` and `npx vitest run` pass in play50games-frontend.
- Checked on a local scratch page (not committed) at 375px and desktop: soon/live cards, empty/full leaderboard, every SubmitStatus.
- `git diff --name-only main...cursor/k2-arcade-ui` lists only arcade3d/ui/**.
Reply with: files changed, screenshots, anything left open.
```

### X2 – Hyper3D CLI (Codex)

```text
Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md and docs/platform-plan.md first (§4 is your spec). Work on branch `codex/x2-hyper3d-cli`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend.

Task X2: Hyper3D (Rodin) CLI. You spend NO credits: everything you run uses --mock.

Files you may create or edit: tools/hyper3d/** except tools/hyper3d/concepts/** (Claude) and tools/hyper3d/raw/** (gitignored output). A separate tools/hyper3d/package.json is fine (e.g. @gltf-transform/*, meshoptimizer, sharp). Never touch play50games-frontend/package.json or its lockfile.

Commands (Node 24, native fetch, ESM):
- plan <slug> [--spec <file>]: read play50games-frontend/src/arcade3d/games/<slug>/assets.spec.json; print every generation (id, kind, mode, tier, attempts, estimated credits) and the total.
- budget: remaining credits per account (API if available, else the ledger) and the spend ledger.
- smoke: one cheap generation on the lab account. Records the real `consumed` and checks API access, TAPose casing, quality_override, FBX output and the privacy setting. Prints a report.
- gen <slug> --confirm [--account lab|prod] [--only <id>]: submit -> poll -> download to tools/hyper3d/raw/<slug>/<id>-<n>.glb; append to the ledger.
- import <file> --slug <slug> --id <id>: take a GLB downloaded from the web UI (fallback when the API is unavailable).
- optimize <slug> [--id <id>]: gltf-transform: pivot centred on the floor, textures resized to webp (1024 character / 512 prop), simplify, meshopt, inspect. Write to play50games-frontend/public/models/3d/<shared|slug>/<id>.glb. Exit non-zero over budget (character 20k tris / 1.5 MB, prop 5k tris / 300 KB).
- Optional convert / merge-clips (Blender CLI, only when blender is on PATH).
- --mock on every command: no network, fake API responses, tiny GLB fixtures generated in code (no binary fixtures in git).

API: base https://api.hyper3d.com/api/v2. POST /rodin (multipart) -> poll POST /status {subscription_key} -> POST /download {task_uuid}. Download links expire in about 10 minutes: download right away, retry once. Check the official Rodin API docs for field names and keep every request field in one config module so the smoke test can correct them.
Defaults: characters = image-to-3D from a concept PNG, tier Gen-2.5-Medium, quality_override about 18000, T-pose on. Props = text-to-3D, Gen-2.5-Low, 1.5-4k faces. Always glb, mesh_mode Raw, material PBR, explicit seed. Refuse HighPack and Extreme-High.

Secrets and safety:
- Keys come only from %USERPROFILE%\.play50\hyper3d.env (HYPER3D_KEY_PROD, HYPER3D_KEY_LAB). Ledger: %USERPROFILE%\.play50\hyper3d-ledger.json. Never read keys from the repo; never print, log or write them (mask in errors). Do not create hyper3d.env.
- gen refuses: without --confirm; in a git worktree or any checkout other than the main one (compare `git rev-parse --git-dir` with `--git-common-dir`); when the estimate would leave less than 2 credits on the account.
- Never run smoke or gen without --mock.

assets.spec.json: define and document the schema in tools/hyper3d/README.md, plus a JSON Schema and tools/hyper3d/examples/robot-collector.assets.spec.json. Start from:
{ "slug", "universe", "seed", "assets": [ { "id", "kind": "character"|"prop", "mode": "image"|"text", "prompt", "concept"?: "tools/hyper3d/concepts/<file>.png", "tier", "qualityOverride"?, "attempts", "target": "shared"|"<slug>", "budget": { "tris", "bytes" }, "textureSize" } ] }

Done when:
- `node --test` in tools/hyper3d covers spec parsing, the budget guard, the worktree guard, the --confirm guard, key masking, and mock gen -> optimize end to end.
- `plan robot-collector --mock --spec tools/hyper3d/examples/robot-collector.assets.spec.json`, `budget --mock` and `optimize --mock` work.
- README documents every command and the spec.
- `npm run build` + `npx vitest run` still pass in play50games-frontend.
- `git diff --name-only main...codex/x2-hyper3d-cli` lists only tools/hyper3d/**.
Reply with: files changed, sample output of plan/budget/optimize in mock mode, open questions about the API.
```

### X3 – WP admin page (Codex)

```text
Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md, docs/platform-plan.md (§3) and docs/arcade-api.md first. Work on branch `codex/x3-arcade-admin`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend.

Task X3: WordPress admin page "Arcade Scores".

File you may create (nothing else): play50games-backend/play50games/wt-cpt/arcade-scores-admin.php
Claude adds the guarded require_once in functions.php. Do not edit functions.php, includes/rest-api.php, includes/arcade-api.php or any other theme file.
Use the exact table name, columns, user meta keys and cache/transient names from docs/arcade-api.md. If the doc does not define something you need, stop and ask; do not invent names.

Build:
- Admin menu page "Arcade Scores" (capability manage_options).
- List: filter by game (slugs from includes/arcade-games.json), 50 rows per page. Columns: rank, user (display name + link to user-edit), best_score, best_duration_ms (m:ss.cc), plays, hidden, banned, best_at, last_played.
- Actions: delete one row; reset one game (deletes all its rows; confirm by typing the slug); ban / unban a user; clear the leaderboard cache (one slug or all).
- Every action is a form posting to admin-post.php with action=play50_arcade_<name>, handled on admin_post_play50_arcade_<name>. Inside every handler: check_admin_referer with a per-action nonce, current_user_can('manage_options'), sanitize input (sanitize_key, absint), $wpdb->prepare for every query, then wp_safe_redirect back with a notice and exit.
- Do NOT copy the admin_init + wp_die pattern from wt-cpt/share-tracking.php.
- Escape all output (esc_html, esc_attr, esc_url). If the table does not exist yet, show a notice, never a fatal error.
- Prefix every function play50_arcade_admin_ and wrap each in function_exists. Avoid PHP 8-only syntax (the production PHP version is not confirmed).

Done when:
- `php -l` passes on the file (if you have no PHP, say so; Claude lints it).
- `npm run build` + `npx vitest run` still pass in play50games-frontend.
- `git diff --name-only main...codex/x3-arcade-admin` lists only that file.
- You never upload to or test against the production site; Claude tests it with the production safety procedure.
Reply with: the file, a list of actions with their nonce/action names, anything left open.
```

### Game – one 3D game (Cursor / Codex)

Fill `<agent>` (`cursor` or `codex`), `<slug>` and `<title>` from the catalog.

```text
Repo Codaton-LLC/25-play50games. Read AGENTS.md, CLAUDE.md and docs/platform-plan.md first. Work on branch `<agent>/game-<slug>`. Touch only the files listed. Do not edit package.json or any Claude-owned file. Done = `npm run build` + `npx vitest run` pass in play50games-frontend.

Task: build the 3D Arcade game `<slug>` ("<title>").
Spec: skills.md (catalog, controls, scoring limits and models rows for <slug>) plus the approved README.md and assets.spec.json in play50games-frontend/src/arcade3d/games/<slug>/.

Files you may create or edit (nothing else):
- play50games-frontend/src/arcade3d/games/<slug>/** (meta.ts, index.tsx, Scene.tsx, rules.ts, rules.test.ts, assets.ts, README.md, extra files inside this folder)
- play50games-frontend/public/images/3d/<slug>.webp (thumbnail, 16:9, <= 60 KB)

Template: copy the structure of arcade3d/games/robot-collector/ (Claude's reference game) and follow its README.

How:
- index.tsx default-exports a GameDefinition (arcade3d/core/types.ts): Scene, assets, camera, environment, touchControls, hudStats, instructions, durationMs / lives if the game needs them; finalScore only if the default (store score + elapsedMs) is wrong.
- Game loop inside useRunFrame (runs only while playing, dt is clamped). Read input only from useInput (keyboard and touch are already unified). Use the collision helpers from arcade3d/core. Store actions: addScore, setStat / incStat, setLevel, loseLife, end(reason).
- Never call submitScore, the arcade API or localStorage. End the run with end("win" | "lose" | "timeup"); GameShell shows the result and submits the score. Time games are ranked only on end("win"); lose/timeup runs are shown as unranked and never saved.
- Models: list them in assets.ts as ModelAsset entries (shared ones via SHARED_ASSETS) and render with useModel. The GLBs are already in public/models/3d/<slug>/ and public/models/3d/shared/ (Claude's assets PR). A missing GLB falls back to a primitive, so start with primitives. Do not add or change GLBs.
- Scoring lives in rules.ts: pure functions, deterministic with a seed (no Math.random or Date.now inside rules). rules.test.ts (vitest) covers scoring, the max score and edge cases.
- meta.scoring must stay equal to play50games-backend/play50games/includes/arcade-games.json (registry.sync.test.ts checks it). If a limit looks wrong, stop and ask Claude; do not change it.
- No imports from components/GameEngine/**, lib/storage/progressStorage or lib/api/progress. No three or React imports in meta.ts. No top-level useGLTF.preload.
- Performance: <= 150 draw calls (instance repeated props), 60 fps target on a mid phone, no allocations or setState inside the frame loop.
- Keep status "soon" until everything works; set status "live" in your last commit.
- Style: 3-space indent, double quotes, semicolons.

Done when:
- It plays end to end (ready -> countdown -> playing -> pause/resume -> over -> retry / exit) with keyboard on desktop and touch at 375px emulation.
- `npm run build`, `npx tsc --noEmit` and `npx vitest run` pass in play50games-frontend.
- README.md covers rules, controls, the scoring formula, assets used and known issues.
- `git diff --name-only main...<agent>/game-<slug>` lists only the files above.
Reply with: files changed, how to play, the scoring formula, anything left open.
```

## Later (not v1)

Skins, ghost replays, daily challenge, multiplayer Warehouse Rush, cross-game leaderboard, run tokens (Phase 5, Codex).
