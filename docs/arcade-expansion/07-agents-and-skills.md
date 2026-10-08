# Deliverable G: Multi-agent responsibility matrix · Deliverable H: AI skills and tooling

## G.1 What each agent can do here (verified where possible)

"From this repo" = what the agent actually delivered in this project (commit history, CLAUDE.md). "From the web" = secondary sources, 2026-10-08 **[W]**; confirm in the first sprint (task N-04, prompt P-00).

| Agent | Environment and access **[V]** | Delivered in this repo **[V]** | Capabilities from the web **[W]** | Limits seen | Best use in the expansion |
|---|---|---|---|---|---|
| **Claude** (Claude Code) | Local on your PC (Windows) with the Hyper3D Rodin MCP; own worktrees under `.claude/worktrees/`; cloud sessions (like this one) with GitHub access but **no Hyper3D MCP** | Phase 0–3, the whole core (13k lines), backend + API, 4 games, all assets, all reviews and merges, auto-rig | skills, subagents, MCP, hooks | usage limits; its browser pane stays at "Loading" for R3F, so playtests run headless over CDP | core v3, reference game + 4 games, assets, every review and merge, release |
| **Codex** (OpenAI) | Works in the **main checkout** `C:\Users\grani\Documents\WORKSPACE-play50games`, branches `codex/<pkg>`; Claude never switches branches there | Hyper3D CLI, WP admin page, pigeon-crossing, tower-climb, escape-room, JSON-LD, API smoke script, warehouse gait | CLI + cloud tasks in parallel sandboxes, reads `AGENTS.md`, project skills in `.codex/skills` ([source](https://codex.danielvaughan.com/2026/03/27/codex-cli-skills-ecosystem/)) | reviews needed many test/README fixes (tower-climb: 14) | 5 games (precise rule-heavy ones: tracks, lander, castle waves), pure core helpers (P1-C) under review |
| **Antigravity** (Google) | Worktree `…\p50-antigravity`, branches `antigravity/<pkg>` | one `getApiBase`, go-live audits (food-catcher, pigeon-crossing) | agent manager for parallel agents, built-in browser sub-agent (Chromium) with screenshots and recordings as "Artifacts", Gemini 3, CLI since v2.0 ([Thoughtworks Radar](https://www.thoughtworks.com/radar/tools/google-antigravity), [InfoWorld](https://www.infoworld.com/article/4096113/a-first-look-at-googles-new-antigravity-ide.html)) | no full game yet in this repo; whether its browser renders this R3F canvas is unverified | UI kit (collections), visual and mobile QA in a real browser, 5 games (visual, joystick-style) |
| **Kimi** (Moonshot, Kimi Code) | Worktree `…\p50-kimi`, branches `kimi/<pkg>` | `tools/thumbs` (CDP capture), a go-live audit (it audited food-catcher instead of office-escape) | CLI agent with plan mode, `AGENTS.md`, skills, MCP, subagents, headless/CI ([kimi-cli](https://upd.dev/MoonshotAI/kimi-cli/src/1.47.0), [overview](https://innfactory.ai/en/ai-harness/kimi-code/)); code is sent to Moonshot's service **[W]** | followed the wrong target once: prompts must make it echo the slug and branch first | tooling (`tools/gamecheck`, `tools/perf`), first-pass mechanical reviews, audio cues, 5 games (tap/timing ones) |
| **ChatGPT** (chat) | no repo access; you paste prompts and pass images to Claude | style sheets and every character concept | image generation | concept consistency drifts between chats: attach the approved style sheet every time | style sheet v2, all concept images |
| **Cursor** | worktree `…\p50-cursor`, out of credits since 2026-10-07 | K1, K2, food-catcher, penalty-hero, clean-city | – | no credits | reserve: takes any unstarted game with the same prompt |
| **You** | GitHub, Vercel, Plesk/WordPress, Hyper3D account, ChatGPT, phones | decisions, approvals, uploads | – | time | decisions, art approval, playtests, uploads, releases |

## G.2 Responsibility matrix

R = does the work, A = approves / merges, C = consulted, Q = QA. Every merge to `main` is Claude's (A), after your playtest for games.

| Task | Claude | Codex | Antigravity | Kimi | ChatGPT | You | Why |
|---|---|---|---|---|---|---|---|
| Game design (specs, this plan) | R | – | – | – | C (optional critique) | A | the specs need the core's real constraints |
| Per-game design README (G0) | A | R (own games) | R (own games) | R (own games) | – | A | the builder must own the design it builds |
| Architecture and repo analysis | R | – | – | C (static re-check, optional) | – | A | Claude owns core and contracts |
| Core v3: registry, effects, audio wiring, input, rig, render | R / A | – | – | – | – | – | Claude-only files, highest blast radius |
| Core v3: pure helpers (ballistics, path, ai, motion, kinematics) | A | R | – | – | – | – | well-specified, pure, test-heavy: Codex's strength; Claude reviews (D9) |
| Core v3: synthesized audio cues and loops | A | – | – | R | – | Q (ears) | bounded leaf module, explicit file list (D9) |
| Core gameplay of each game | A | R ×5 | R ×5 | R ×5 | – | Q | one owner per folder |
| 3D scene development | A | R | R | R | – | Q | same |
| Physics and collision (game level) | A | R | R | R | – | – | built on core kinematics |
| NPC behaviour (game level) | A | R | R | R | – | – | built on `core/ai` |
| Shader and rendering optimisation | R | – | – | – | – | – | water, ghosts, ice, flames live in core |
| UI/UX: collections on `/3d`, loading card, hub copy | A (+ page wiring R) | – | R (`arcade3d/ui/**`) | – | – | A | display-only kit; Antigravity can see it in its browser |
| Asset concepts | C | – | – | – | R | A | your taste decides |
| Asset generation, import, optimisation, fitting | R (local MCP) | – | – | – | – | A (spend) | credits + MCP live on your PC |
| Character landmarks and rig adoption | R | – | – | – | – | – | needs the rig expertise |
| Asset-pipeline automation (CLI changes) | A | R | – | – | – | – | Codex built `tools/hyper3d` |
| Testing tools (`tools/gamecheck`, `tools/perf`) | A | – | – | R | – | – | Kimi built `tools/thumbs` (same CDP pattern) |
| First-pass mechanical review of a game branch | C | – | – | R | – | – | cheap, scripted, saves Claude tokens |
| Adversarial review (design, feel, tests with mutation probes) | R | – | – | – | – | – | one deep review per game |
| Visual and mobile QA in a browser | C | – | R (Q) | – | – | Q (real phone) | Antigravity's browser agent; your phone for truth |
| Performance audit | R (fixes in core) | – | Q | R (`tools/perf` runs) | – | Q (phone numbers) | numbers from scripts, fixes where the code lives |
| Refactoring | R (core) | R (own games) | R (own games) | R (own games) | – | – | only inside owned paths |
| Documentation | R (docs/**, core README) | R (own README) | R (own README) | R (own README) | – | – | READMEs follow the reference template |
| Integration (registry, JSON, thumbnails, OG) | R | – | – | – | – | – | Claude-only files |
| Deployment preparation and go-live | R | – | Q (go-live audit) | Q (go-live audit) | – | R (uploads, Vercel), A | backend is uploaded by hand |

## G.3 Collaboration workflow

### Branching

- `main` = always deployable (flags + `status: "dev"` keep work invisible). Only Claude merges, with merge commits (`git merge --no-ff`), as today.
- One branch per task: `claude/<pkg>`, `codex/<pkg>`, `antigravity/<pkg>`, `kimi/<pkg>`. Game branches: `<agent>/game-<slug>`; design-only branches: `<agent>/design-<slug>`.
- Claude creates the helper's branch in the helper's worktree before handing out the prompt (copies `.env.local`; helpers run `npm ci` themselves) **[V]** CLAUDE.md. Codex works in the main checkout, where Claude never switches branches: Claude only creates the branch ref from its own worktree (`git branch codex/<pkg> main`; refs are shared by all worktrees) and Codex runs `git switch codex/<pkg>` as its first step. Never two Codex tasks at once.
- Reviewers and QA agents check a branch out in a **separate** review worktree (`git worktree add --detach ..\p50-review-<slug> origin/<branch>`), never in the worktree where their own branch is in progress, and remove it afterwards.
- Long branches merge `main` in (never rebase someone else's branch).

### File ownership (single writer per path)

| Paths | Owner during the expansion |
|---|---|
| `package.json`, lockfile, `next.config.js`, `tsconfig.json`, `vitest.config.mts` | Claude |
| `arcade3d/{types,registry,loaders,flags}.ts`, `arcade3d/core/**`, `public/models/3d/**`, `app/3d/**`, `app/page.tsx` | Claude (P1-C helpers and audio delegated by explicit file list, D9) |
| `arcade3d/games/<slug>/**`, `public/images/3d/<slug>.webp`, `tools/thumbs/inputs/<slug>.mjs` | that game's owner (02 §C.2) |
| `arcade3d/ui/**` | Antigravity (collections task), then Claude |
| `tools/gamecheck/**`, `tools/perf/**` | Kimi |
| `tools/hyper3d/**` (not `concepts/`) | Codex |
| `tools/hyper3d/concepts/**`, `tools/thumbs/{capture,inputs}.mjs`, `tools/og/**` | Claude |
| `play50games-backend/**` | Claude (JSON edits only for the expansion) |
| `docs/**`, `CLAUDE.md`, `AGENTS.md`, `skills.md` | Claude |

The **work board** (`docs/status.md` "Active branches", Claude the only writer) lists each open branch, its owner and its allowed paths. Claude updates it when handing out a prompt; `tools/gamecheck` fails if a branch touches a path outside its row.

### Hand-off protocol

1. **Start**: every prompt begins with the common preamble (08 §I.0), which makes the agent echo the task id, slug, branch and allowed paths before doing anything (stops wrong-target work).
2. **During**: the agent never edits outside its paths; a missing core feature is a question to Claude, not a local workaround.
3. **End**: the agent replies with the **HANDOFF block** (template in 08 §I.0): files changed, commands run with results (`gamecheck`, build, vitest), scoring formula, decisions taken, open questions, known issues. The same text goes into the game README's "Status" section, so context survives the chat.
4. **Review**: Kimi's mechanical pass (scripted, P-17a) → Claude's adversarial pass (P-17b) → fixes by the owner (one round planned, a second only for blockers) → your playtest → Claude merges.

### Merge requirements (every branch)

- `node tools/gamecheck <slug>` green (ownership diff, `tsc`, vitest for the folder, registry sync, manifest, README sections, test and README budgets, perf probe budget).
- `npm run build` and the full `npx vitest run` green.
- HANDOFF block present; README updated.
- For games: headless screenshots at 1280 × 800, 390 × 844 (banner open), 844 × 390; perf JSON from `tools/perf`.

### Integration checkpoints

| Checkpoint | When | What runs |
|---|---|---|
| Core freeze v3.0 | end of Phase 1 | full vitest + build + `tools/perf` baseline of the 10 existing games (must not regress) |
| Template freeze | reference game merged | the README template, test budget and gamecheck rules are fixed for the 19 others |
| Wave end | after each wave | full regression: vitest, build, `tools/thumbs` for all games (blank-canvas check), `tools/perf` for all, classic smoke (`/classic`, `/games/1`, `/progress`) |
| Go-live | per game | go-live audit + your phone check + JSON upload |

### Parallel or sequential

| Can run in parallel | Must be sequential |
|---|---|
| P1-C (Codex) and the audio cues (Kimi) from day 1 ∥ P1-A then P1-B (Claude) ∥ `tools/gamecheck` + `tools/perf` (Kimi) ∥ style sheet + concepts (ChatGPT) ∥ collections UI (Antigravity) | P1-A before any game branch (types) |
| Up to 4 game branches (one per agent) | Reference game before any other game starts building |
| Design READMEs of the next game while the current one builds | Asset batch N before the games that need its GLBs adopt them (they start on primitives) |
| Concepts for batch N+1 while batch N is being fitted | Core changes needed by a running game: merged to `main` first, then the game merges `main` in |
| Go-live audits of finished games | Backend JSON upload before the frontend `status: "live"` merge |

---

## H. AI skills and tooling strategy

### H.1 Verified available

| Where | Skill / tool | Verified how |
|---|---|---|
| Claude Code (this cloud session) | `code-review`, `simplify`, `security-review`, `run`, `init`, `skill-creator` (anthropic-skills), `session-start-hook`, `workflow-authoring` | listed in this session's skill list |
| Claude Code (your PC) | Rodin MCP `hyper3d-rodin` (`rodin_generate`, `rodin_wait`, `rodin_get_result`, `rodin_create_uploads`) | CLAUDE.md "Hyper3D (Rodin) pipeline" |
| Repository (any agent) | `tools/hyper3d` (import, optimize, plan, mock), `tools/thumbs` (CDP capture), `tools/og`, `tools/arcade-api-smoke.sh` | files in `tools/` |
| Codex, Kimi, Antigravity | **nothing verified from here** beyond the repo tools | needs task N-04 (P-00) |

### H.2 Recommended (needs installation or configuration)

| Agent | Recommendation | Why | Status |
|---|---|---|---|
| all | Node 24 + a local Chrome/Chromium for `tools/thumbs` / `tools/perf` | headless playtests | Node 24 is the project's version **[V]** |
| Claude (your PC) | keep `hyper3d-rodin` logged in (`claude mcp login hyper3d-rodin` when it expires) | asset batches | **[V]** |
| Codex | project skills folder: copy `docs/arcade-expansion/skills/*` to `.codex/skills/` | auto-loaded skills | path from **[W]**, verify in N-04 |
| Kimi | load the same skills through its skills mechanism (or the prompt points to the SKILL.md path); optional `chrome-devtools` MCP for interactive debugging | its docs show MCP and skills **[W]** | verify in N-04 |
| Antigravity | allow its browser agent to open `http://localhost:3100`; check that WebGL renders in it | visual QA | verify in N-04 |
| Claude | copy the skills to `.claude/skills/` after approval | auto-loaded | standard Claude Code location |

The prompts never depend on auto-loading: each one says "read `docs/arcade-expansion/skills/<name>/SKILL.md` and follow it", so a skill works for every agent even where installation fails.

### H.3 Project-specific skills to create

Starter files are in `docs/arcade-expansion/skills/` (one folder each, standard `SKILL.md` with `name` / `description` frontmatter).

| Skill | Objective | Triggers | Inputs | Outputs | Used by | Reuse |
|---|---|---|---|---|---|---|
| `arcade-game-design` | turn a spec into an approved design README (G0) | "design <slug>", a new game branch | spec in 03/04, core README | `games/<slug>/README.md` design sections, `assets.spec.json`, open questions | game owners | all 20 |
| `arcade-game-build` | build a game to the Definition of Done | "build <slug>" | approved README, reference game | the folder, tests, thumbnail, HANDOFF | game owners | all 20 |
| `arcade-score-limits` | derive and prove the server limits | before go-live, after scoring changes | `rules.ts` | proof section, bot test, meta + JSON values | owner (proof), Claude (JSON) | all 20 |
| `arcade-asset-batch` | concept → approval → generation → import → optimise → manifest | "asset batch N" | catalog (05), approved concepts | GLBs, manifest lines, ledger entry | Claude (local) | 4 batches |
| `arcade-model-adopt` | fit a GLB in `assets.ts` (props) or measure landmarks (humanoids) | a GLB lands | GLB, game spec sizes | fits, size tests, landmarks + character test | Claude | 27 GLBs |
| `arcade-playtest` | headless playtest + screenshots + perf JSON | before review, at wave end | slug, local server | screenshots, `tools/perf` JSON, findings | Antigravity, Kimi, Claude | every review |
| `arcade-review` | mechanical pass + adversarial checklist | a branch is handed off | branch, HANDOFF | review report, fix list | Kimi (mechanical), Claude (adversarial) | every branch |
| `arcade-go-live` | one game from `dev` to live | your go-live decision | slug | go-live branch, JSON for upload, post-deploy checks | Claude + you | 20 go-lives |

Validation checklist common to all skills: the skill names the exact files it may touch; it ends with commands whose output proves success; it never spends credits, uploads to production or edits Claude-only files unless it is a Claude skill that says so.
