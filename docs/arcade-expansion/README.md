# 3D Arcade expansion: 20 new games (plan, awaiting approval)

> Status: **approved 2026-10-08** (your answers are in §A.6 and `docs/status.md`). Execution starts with `10-owner-checklist-and-sprint-1.md` §M.3.
> It extends `docs/platform-plan.md` (still the source of truth for the platform) and never overrides its "never" rules.
> Written from a full read of the repository at `main` = `422fdff` (2026-10-08).

## How to read this plan

| File | Deliverables | Read it when |
|---|---|---|
| `README.md` (this file) | **A** Executive architecture summary, decisions to approve | first |
| `01-repo-audit.md` | **B** Existing repository audit | before any architecture change |
| `02-production-matrix.md` | **C** 20-game production matrix, priority scores, waves | planning a wave |
| `03-game-specs-adventure.md` | **D** Specs for games 1–10 (Collection "Adventure") | designing or building one of them |
| `04-game-specs-skill.md` | **D** Specs for games 11–20 (Collection "Skill") | designing or building one of them |
| `05-hyper3d-catalog.md` | **E** Hyper3D production catalog with every prompt | preparing an asset batch |
| `06-shared-library-and-architecture.md` | **F** Shared asset library, §9 architecture, §10 performance | core work, asset reuse |
| `07-agents-and-skills.md` | **G** Responsibility matrix, **H** skills and tooling | assigning work |
| `08-prompt-library.md` | **I** Every copy-paste prompt, with owner, order and prerequisites | handing out work |
| `09-roadmap-budget-qa.md` | **J** Roadmap, **K** budget and cost, **L** QA and release | tracking the program |
| `10-owner-checklist-and-sprint-1.md` | **M** Your checklist, **N** first sprint (15 tasks + prompts) | today |
| `11-chatgpt-concept-prompts.md` | the 18 ChatGPT concept prompts, filled in, with file names | making concept images |
| `skills/<name>/SKILL.md` | starter project skills (H) | after approval, installed per agent |

Tags used everywhere:
- **[V]** verified in this repository (file and line given where useful).
- **[W]** from a web source (secondary sources, checked 2026-10-08; re-check before relying on it).
- **[A]** assumption or estimate. Every effort and cost number is an estimate.

---

## Deliverable A: Executive architecture summary

### A.1 The strategy in one paragraph

The platform does not need a rebuild. The 3D core in `play50games-frontend/src/arcade3d/core/` (13k lines: shell, run clock, input, camera fit, safe area, instancing, auto-rig for T-pose characters, scores and leaderboard) already carries ten games. Most of the cost of those ten came from reworking the core *during* game development (two "core follow-up" rounds, `core/README.md` "Closed core gaps") and from very large per-game test suites and READMEs. So the plan is: **(1)** extend the core once, before any new game starts ("core v3": about 12 missing generic systems, listed in A.3), **(2)** build one **reference game** (Treasure Island) that uses them and sets the production standard, **(3)** build the other 19 in three waves, at most one game per agent at a time and at most four game branches open at once, with a fixed design-review gate before code and one adversarial review after, **(4)** spend Hyper3D credits only on assets that carry the look (27 core generations, most of them shared by two or more games) and draw everything geometric in code.

### A.2 Principal technical decisions

| # | Decision | Why |
|---|---|---|
| 1 | Keep the stack exactly: Next 14.2, React 18.3, three ~0.170, R3F 8, drei 9, zustand 4, vitest 2 **[V]** `package-lock.json` (`package.json` ranges: next ^14, react ^18.2). No new runtime dependency. | R3F 9 / drei 10 need React 19 (CLAUDE.md). Everything new is small code in `core/`. |
| 2 | **Rapier where it pays (D6, your answer).** Scoring logic stays in pure, deterministic `rules.ts` (golf ball, rocket lander, pendulum, ballistics) so every score limit can be proven. Rapier (installed, lazy, `physics: true`) is used for visual physics (debris, toppling cans, a collapsing building) and for a game's movement only when its design README shows custom code would be clearly worse and the limit proof does not depend on exact physics; its download counts toward the game's load budget. | Rapier is installed and wired (`ShellStage.tsx:17`) but no shipped game uses it yet **[V]** (`obstacle-race/index.tsx:20` `physics: false`); pure rules keep score limits provable, Rapier adds feel where it is cheap to add. |
| 3 | New status **`"dev"`**: the game exists on `main`, is hidden from `/3d`, the sitemap and its route on production, and is playable on preview builds with a new `NEXT_PUBLIC_ARCADE_PREVIEW=1` flag. | Merging 20 games-in-progress must stay safe for `main` (Vercel auto-deploy). Twenty "Soon" cards would look like vaporware. |
| 4 | New `collection` on `ArcadeGameMeta`: `"originals"` (the 10 existing), `"adventure"` (games 1–10), `"skill"` (11–20). `/3d` shows sections with filter chips. | 30 cards in one flat grid do not scan; your brief already defines the two collections. |
| 5 | One shared **effects + audio + quality** layer in core (`core/fx`, extended `audio.ts`, `core/quality.ts`, `core/perfProbe.tsx`). | Today every game draws its own pops and rings, there are only 7 synthesized sounds and no loops **[V]** (`audio.ts:12`), and only tower-climb has a draw-call probe **[V]** (`tower-climb/Scene.tsx:184-191`). |
| 6 | One shared **gameplay helper** layer, pure and tested: `ballistics`, `path` (conveyors, patrols, sailing ships), `ai/steering`, `ai/vision`, `motion` (hop, waddle, hover, bank for non-humanoid heroes), `kinematics` (circle vs segment bounce), aim-drag input. | 19 of the 20 games use at least one of these; written once they cost one review instead of one per game. |
| 7 | Rig extensions: **bone attachments** (`<HumanoidModel attach={{ head, chest, handL, handR }}>`), **material overrides** (stone, bronze, gold, bone) and a `tint` on `<Model>` / `<HumanoidModel>`, **per-copy tint** on `<DynamicInstancedModel>`. | Lets one runner GLB become an explorer, a ghost hunter and a site worker (hat, backpack, hard hat) and lets Museum Guard show other games' heroes as statues. Saves about 8 Hyper3D generations. Today `HumanoidModel` children are plain group children, not bone-attached **[V]** (`HumanoidModel.tsx:89-103`). |
| 8 | Non-humanoid heroes (dino, penguin, panda, monster, goblin, drone, rocket) are **solid models with procedural whole-body motion** (hop, waddle, squash, bank), like the pigeon. No skeletal animation for them in v1. | The auto-rig is humanoid-only (17 bones) **[V]** `core/README.md` "Limits"; the pigeon precedent passed review. A quadruped/tail rig is an optional later R&D item (E). |
| 9 | Art direction **"Play50 toy world, premium edition"**: rounded friendly proportions **plus** matte/satin materials, restrained palettes, one accent per asset. | Your brief says "colourful toy world", but the repository records that the saturated toy prompts "looked clownish" and that you preferred the "premium mobile game" robot (CLAUDE.md, Hyper3D pipeline). The existing assets are the definitive reference, so the style block is rewritten (05, §E.1). **Needs your approval.** |
| 10 | Every score is a **points** game with a server limit proven by a bot through the real store, as for the existing ten. | The server has the points model already (`arcade-api.php`); time games cannot reward pickups (the server recomputes the score from duration). |
| 11 | Reference-game-first: **Treasure Island** (Claude) before any other builder starts a game. **Pirate Cannon Battle** (Claude) is the first wave-1 game because it proves aim-drag (reused by mini-golf) and ballistics (reused by snowball-battle, castle-defender, zoo-escape and delivery-drone). | Same pattern that made robot-collector the template; it is the cheapest way to stop 19 agents repeating 19 mistakes. |
| 12 | Cost levers: a slim "game agent read set" (≈70 KB instead of ≈200 KB of mandatory docs), design README approved before code, test and README budgets, `tools/gamecheck` for every mechanical check, one adversarial review per game. | The current read order (CLAUDE.md 49 KB, skills.md 34 KB, platform-plan 32 KB, arcade-api 34 KB) **[V]** costs every agent session ~50k tokens before it reads a line of its game. |
| 13 | Codex and Kimi through their CLIs, Antigravity, Cursor and ChatGPT by copy-paste (D12). | About 80 fewer copy-paste rounds for you; Claude reads only each run's HANDOFF file; Antigravity's value is its interactive browser. |

### A.3 What the core gets before game 1 (Phase 1, Claude-owned)

| PR | Content | Unblocks |
|---|---|---|
| P1-A Registry for 30 | `ARCADE_SLUGS` for 30, `status: "dev"`, `collection`, `AgentOwner` + `antigravity` + `kimi`, new `ControlScheme`s, 20 stubs, `loaders.ts`, `arcade-games.json` v3 (20 disabled entries, provisional limits), `/3d` sections, hub and arcade copy counts from the registry (today "10" / "Ten" is hard-coded in `app/page.tsx:82,113,122` and `app/3d/page.tsx:35` **[V]**), `tools/thumbs` + `tools/og` entries | every game branch |
| P1-B Effects, sound, quality, perf | `core/fx` (pooled bursts, floating score text, camera shake), `audio.ts` new cues + loops, `core/quality.ts` (`useQuality()` tiers), `core/perfProbe.tsx` (`?perf=1` → `window.__arcadePerf`), lighting presets `sunset` / `snow` / `space`, `core/env` (water, sky dome, starfield) | look and feel of all 20 |
| P1-C Gameplay helpers (pure) | `ballistics.ts`, `path.ts`, `ai/steering.ts`, `ai/vision.ts`, `ai/patrol.ts`, `motion.ts`, `kinematics.ts`, all with vitest | 11 games |
| P1-D Input, rig, render | aim-drag gesture in `inputController.ts` (`InputState.drag`), digit keys (`InputState.digit`), `<TrajectoryDots>`, bone attachments, material overrides and `tint`, per-copy tint, `<TargetMarkers>` (off-screen arrows), `core/kit` (conveyor belt, fence, flashlight cone, pedestal, gem, parcel) | the rest |

Optional later (Phase 7): achievements-lite (local only), daily seed, music.

### A.4 Shape of the program

```
Phase 0  audit (done: 01-repo-audit.md) + your decisions
Phase 1  core v3 (P1-A..D)                                   Claude (+ Codex for P1-C under review)
Phase 2  visual foundation: style sheet v2, asset batch 1     ChatGPT + Claude (local MCP) + you
Phase 3  reference game: treasure-island                      Claude
Phase 4  wave 1: pirate-cannons, penguin-slide, shopping-cart, monster-kitchen, luggage-rush
Phase 5  wave 2: mini-golf, delivery-drone, rocket-landing, dino-egg-rescue, knight-arena, robot-factory, ghost-vacuum
Phase 6  wave 3: zoo-escape, snowball-battle, castle-defender, space-repair, museum-guard, alien-farm, construction-worker
Phase 7  integration + optimization (perf pass, collections UI polish, achievements-lite if approved)
Phase 8  release: each game goes live one by one (your decision per game, existing go-live runbook)
```

### A.5 Numbers at a glance (estimates **[A]** unless tagged)

| Item | Value |
|---|---|
| New games | 20 (10 Adventure, 10 Skill), all points-scored |
| Hyper3D generations, core set | 19 tier 1 + 8 tier 2 = **27**, plus a retry reserve of 7 = **34** |
| Credits at the project's recorded rate (0.5 per Gen-2.5 Medium generation, `docs/platform-plan.md` §4) | ≈ **17** (≈ 34 if a generation really costs 1.0) |
| Hyper3D balance | **31 credits** (your dashboard, 2026-10-08); the charge per generation is confirmed by the balance after batch 1 |
| Existing GLBs reused | 30 of the 39 in `public/models/3d` **[V]** (list in 05 §E.6) |
| Assets made in code instead of Hyper3D | ≈ 60 (ghosts, eggs, gems, parcels, tracks, buildings, planets, conveyors, …) |
| Agent effort | ≈ 550 agent-hours across all agents (range 460–650), recalibrated after the reference game (09 §K.1) |
| Your time | ≈ 50–60 hours over the whole program, mostly decisions, playtests and uploads (09 §K.1) |

### A.6 Decisions (answered 2026-10-08)

| ID | Decision | Your answer (2026-10-08) |
|---|---|---|
| D1 | Art direction "Play50 toy world, premium edition" (05 §E.1) | **yes** |
| D2 | The 20 slugs, titles and the two collections (02 §C.1) | **yes** |
| D3 | Gameplay changes vs your brief ("Director's call" in each spec): Construction Worker is a crane game, Museum Guard look-to-freeze, Robot Factory an assembly line, Alien Farm timing-harvest, Treasure Island a detector hunt | **yes** |
| D4 | Owners (02 §C.2) | **yes, and Cursor is back (Pro plan): five builders, 4 games each**: Claude 4, Codex 4, Antigravity 4, Kimi 4, Cursor 4 (+ the UI kit again) |
| D5 | `status: "dev"` + `NEXT_PUBLIC_ARCADE_PREVIEW` flag | **yes** |
| D6 | Physics | **Rapier allowed where it is needed** (A.2 #2) |
| D7 | Hyper3D in batches (tier 1: 19, tier 2: 8, tier 3: 5 only if credits remain), every batch approved in chat | **yes**; balance **31 credits** |
| D8 | New human characters | **your face** on the knight, the astronaut and the zookeeper (like the v2 characters); the snow kid is **a young you without a beard**; concepts made in ChatGPT with your face reference, never committed (05 §E.1) |
| D9 | Bounded core tasks delegated (pure helpers to Codex, audio to Kimi), Claude reviews and merges | **yes** |
| D10 | Slim the agent read set (`docs/status.md`, CLAUDE.md ≤ ~15 KB) | **yes** |
| D11 | Achievements-lite and music postponed to Phase 7 | **yes** |
| D12 | Codex and Kimi through their CLIs (P-25), Codex in its own worktree `p50-codex`; Antigravity, Cursor and ChatGPT copy-paste (07 §G.4) | **yes** |

Non-blocking questions are listed in `10-owner-checklist-and-sprint-1.md` §M.0.
