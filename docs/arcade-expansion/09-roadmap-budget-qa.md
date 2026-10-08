# Deliverable J: Implementation roadmap · K: Budget and cost optimisation · L: QA and release plan

All effort numbers are estimates **[A]**; they are recalibrated after Phase 3 and after every wave from the effort ledger (§K.6). "Agent-hours" = wall-clock hours an agent session is actively working, a rough proxy for usage; your plans' real limits decide the calendar.

## J. Implementation roadmap

### J.0 Overview

| Phase | Goal | Parallel lanes | Exit gate |
|---|---|---|---|
| 0 Audit | facts + decisions | Claude (done), Antigravity P-01, Kimi P-01b (optional) | your D1–D11 answers |
| 1 Architecture | core v3 + tools | Claude P-02 → P-03 → P-05 ∥ Codex P-04 (from day 1) ∥ Kimi P-06 (from day 1), P-07 ∥ Antigravity P-08 ∥ Claude P-24 | core freeze v3.0 |
| 2 Visual foundation | style v2, batch 1 GLBs | ChatGPT P-09/P-10 → you approve → Claude P-11/12 | batch 1 in the manifest |
| 3 Reference game | treasure-island | Claude P-15; owners write wave-1 designs (P-14) | template freeze |
| 4 Wave 1 | 5 low-risk games | Claude pirate ∥ Codex penguin → luggage ∥ Antigravity shopping ∥ Kimi monster; batch 2 assets | wave-1 regression |
| 5 Wave 2 | 7 games | Claude golf ∥ Codex drone → rocket ∥ Antigravity dino → knight ∥ Kimi robot-factory → ghost; batch 3 | wave-2 regression |
| 6 Wave 3 | 7 advanced games | Claude zoo → snowball ∥ Codex castle ∥ Antigravity space → museum ∥ Kimi alien → construction | wave-3 regression |
| 7 Integration + optimisation | perf, polish, optional achievements | Claude P-19/P-20, owners fix, Antigravity QA | all 20 within budgets |
| 8 Release | go-live one by one | Antigravity/Kimi P-21 → Claude P-22 → you upload | each game live |

```
Phase:   0   1-----------   2------   3---------   4----------------   5------------------   6------------------   7------   8 →
Claude   ✓   P-02 P-03 P-05 P-11/12   treasure     pirate  (reviews)   golf    (reviews)     zoo → snowball        P-19/20   P-22 ×20
Codex        P-04                     P-14 ×2      penguin → luggage   drone → rocket        castle                fixes
Antig.   P-01 P-08                    P-14         shopping            dino → knight         space → museum        P-18      P-21
Kimi     P-01b P-06 P-07              P-14         monster             robot-fac → ghost     alien → construction  P-17a     P-21
ChatGPT       P-09 P-10 (batch 1)                  P-10 (batch 2)      P-10 (batch 3)
You      D1–D11  approve style/concepts, "po, gjenero"   playtests ×5      playtests ×7           playtests ×7          phone     uploads ×20
```

### Phase 0: Repository audit

- **Tasks:** static audit (done: `01-repo-audit.md`); runtime baseline P-01; optional static re-check P-01b; your decisions.
- **Owners:** Claude, Antigravity, Kimi; you decide.
- **Dependencies:** none.
- **Effort:** Antigravity 3 h, Kimi 1 h, you 1–2 h (reading A, answering D1–D11, reading the dashboard balance).
- **Prompts:** P-01, P-01b.
- **Skills:** none beyond the repo.
- **Deliverables:** baseline report (renders in Antigravity's browser y/n, frame times, overlaps), decisions recorded in `docs/status.md`.
- **Acceptance gate:** D1–D11 answered; Hyper3D balance known.
- **Risks:** Antigravity's browser may not render the R3F canvas (then visual QA falls back to `tools/thumbs` screenshots + your phone).
- **Your actions:** answer the decisions, read the Hyper3D balance, tell Claude which agents have credits now.

### Phase 1: Architecture (core v3)

- **Tasks:** P-02 registry for 30; P-03 effects, quality, perf probe, env, presets, shell fixes; P-04 pure helpers (Codex); P-05 input/rig/render/kit/HUD; P-06 audio (Kimi); P-07 gamecheck + perf (Kimi); P-08 collections UI (Antigravity); P-24 slim docs.
- **Dependencies:** P-04 (new pure files) and P-06 (audio.ts only) start at once, in parallel with P-02. P-03 and P-08 after P-02. P-05 after P-03 + P-04. P-07 after P-03.
- **Effort:** Claude 30–40 h (P-02 6, P-03 12, P-05 14, P-24 2, reviews of P-04/06/07/08 6); Codex 8–12 h; Kimi 12–16 h; Antigravity 5–8 h; you 1 h.
- **Prompts:** P-02, P-03, P-04, P-05, P-06, P-07, P-08, P-24.
- **Skills:** `arcade-review` for Claude's reviews of delegated core work.
- **Deliverables:** core modules with tests and README sections; `tools/gamecheck`, `tools/perf` + `baseline.json`; `/3d` collections; slim CLAUDE.md + `docs/status.md`.
- **Acceptance gate (core freeze v3.0):** the 10 existing games unchanged (headless run, no console errors, no perf regression vs baseline); production view of `/3d` identical with flags as on Vercel; preview build shows 30; full vitest + build green.
- **Risks:** scope creep in core (mitigation: only what 2+ games need, listed in 06 §9.1); delegated core code quality (mitigation: pure modules, tests, Claude review).
- **Your actions:** merge approvals are Claude's; you check `/3d` on the Vercel deployment after P-02 (nothing new visible).

### Phase 2: Visual foundation

- **Tasks:** style sheet v2 (P-09) → you pick; concepts for batch 1 image-to-3D assets (P-10: chest, cannon, ship, cart, monster, penguin) → you approve; batch 1 generation (P-11) → import/optimise/fit (P-12); README of the art direction (05 §E.1 copied into `skills.md`).
- **Dependencies:** D1, D7, balance known.
- **Effort:** you 2–3 h (ChatGPT sessions, approvals); Claude 6–8 h.
- **Prompts:** P-09, P-10, P-11, P-12.
- **Skills:** `arcade-asset-batch`, `arcade-model-adopt`.
- **Deliverables:** 11 GLBs (batch 1) in the manifest with default fits; ledger entries.
- **Acceptance gate:** every batch-1 GLB within budget, fitted, shown under its lighting preset; credits spent ≤ plan.
- **Risks:** Rodin output off-style (mitigation: concept approval first, one retry per asset, the cut list).
- **Your actions:** pick the style; approve each concept; write "po, gjenero batch 1"; approve downloads.

### Phase 3: Reference game

- **Tasks:** treasure-island (P-14 design by Claude → you approve → P-15 build → P-17b review by a fresh Claude session → P-18 QA by Antigravity → your playtest → merge); in parallel the wave-1 owners write their designs (P-14 for penguin-slide, luggage-rush, shopping-cart, monster-kitchen; pirate-cannons by Claude).
- **Dependencies:** core freeze v3.0, batch 1.
- **Effort:** Claude 16–24 h + review 3–4 h; Antigravity QA 1 h; you 2 h + design approvals 1 h.
- **Prompts:** P-14, P-15, P-16, P-17a, P-17b, P-18.
- **Skills:** `arcade-game-design`, `arcade-game-build`, `arcade-score-limits`, `arcade-playtest`, `arcade-review`.
- **Deliverables:** the game (status `dev`), the **expansion README template**, the measured effort (for recalibration), any core fixes it found.
- **Acceptance gate (template freeze):** Common DoD met; perf within budget on desktop and 4× emulation; your playtest on your phone "this is the quality bar".
- **Risks:** the reference exposes core gaps (expected: fix them now, before the wave); taking too long (time-box: 2 review rounds).
- **Your actions:** approve the treasure-island design; playtest; say "template approved".

### Phase 4: Wave 1 (lowest risk)

- **Games:** pirate-cannons (Claude), penguin-slide → luggage-rush (Codex), shopping-cart (Antigravity), monster-kitchen (Kimi).
- **Parallel lane:** concepts + batch 2 (leafyTree, dino, drone, rocket, windmill, vacuum, knight, dummy).
- **Dependencies:** template freeze; batch 1.
- **Effort:** build 48–72 agent-hours total; Claude reviews 11–13 h; you 5–7 h (5 playtests, batch 2 approvals).
- **Prompts:** P-14 (next games), P-15, P-16, P-17a, P-17b, P-18, P-10, P-11, P-12, P-13 (knight), P-23 after the wave.
- **Deliverables:** 5 games merged as `dev`; batch 2 GLBs; touch tuning.
- **Acceptance gate:** wave-1 regression (P-20) green; every game passed its review in ≤ 2 rounds.
- **Risks:** first full games for Antigravity and Kimi (mitigation: simplest games, mechanical review first, explicit prompts).
- **Your actions:** approve 4 designs, playtest 5 games, batch 2 approvals.

### Phase 5: Wave 2 (parallel production)

- **Games:** mini-golf (Claude), delivery-drone → rocket-landing (Codex), dino-egg-rescue → knight-arena (Antigravity), robot-factory → ghost-vacuum (Kimi).
- **Parallel lane:** concepts + batch 3 (goblin, castleTower, snowKid, astronaut, alien, glowPod, panda, keeper); landmarks for the batch-3 humanoids.
- **Effort:** build 82–124 agent-hours; Claude reviews 20 h; you 9–11 h.
- **Prompts:** as wave 1.
- **Acceptance gate:** wave-2 regression green.
- **Risks:** golf physics tuning (time-box; the hole set can shrink to the 6 best of 8); drone city draw calls (chunking from day one).
- **Your actions:** approve designs, playtest 7 games, batch 3 approvals.

### Phase 6: Wave 3 (advanced games)

- **Games:** zoo-escape → snowball-battle (Claude), castle-defender (Codex), space-repair → museum-guard (Antigravity), alien-farm → construction-worker (Kimi).
- **Effort:** build 102–156 agent-hours; Claude reviews 24 h; you 11–13 h.
- **Acceptance gate:** wave-3 regression green; all 20 games merged as `dev`.
- **Risks:** AI fairness (snowball, zoo) needs playtests with real players (your family/friends: a 10-minute session each); 40 goblins on mid phones (perf gate; fewer goblins per wave if needed).
- **Your actions:** approve designs, playtest 7 games, invite 2–3 testers for the AI games.

### Phase 7: Integration and optimisation

- **Tasks:** P-20 final integration; P-19 for every game outside its budget; collections UI polish; loading card wired; optional achievements-lite (D11) and tier-3 assets if credits remain; README/status cleanup.
- **Effort:** Claude 15–25 h; owners 1–3 h each for fixes; Antigravity QA 6 h; you 4–6 h (phone checks of all 20).
- **Acceptance gate:** all 20 within budgets; no open blocker; your phone numbers recorded.

### Phase 8: Release

- **Tasks per game (your order):** P-21 audit → P-22 go-live branch → Plesk backup + JSON upload by you → Claude verifies `GET /arcade/games` → merge → live checks.
- **Effort per game:** Claude 1–1.5 h, auditor 0.5–1 h, you 0.5 h.
- **Acceptance:** the game is playable on production as a guest and logged in, its leaderboard accepts a real run, sitemap and OG card present.
- **Risks:** JSON uploaded with a typo (mitigation: Claude hands you the exact file, `php -l` is not needed for JSON but the server logs a skipped entry; Claude checks `GET /arcade/games` right after).

---

## K. Budget and cost optimisation

### K.1 Resource estimate (balanced scenario)

| Resource | Claude | Codex | Antigravity | Kimi | ChatGPT | You |
|---|---|---|---|---|---|---|
| Core + tools | 30–40 h | 8–12 h | 5–8 h | 12–16 h | – | 1 h |
| Games (build incl. fix rounds) | 82–126 h (5 games) | 62–94 h (5) | 52–78 h (5) | 52–78 h (5) | – | – |
| Reviews / QA | 55–65 h (adversarial) | – | 18–24 h (visual QA) | 8–12 h (mechanical) | – | 30–35 h (playtests) |
| Assets | 25–35 h | – | – | – | ≈ 27 concept images | 6–8 h |
| Integration + release | 35–45 h | – | 8–10 h (audits) | 8–10 h (audits) | – | 12–15 h (uploads, checks) |
| **Total** | **≈ 230–310 h** | **≈ 70–105 h** | **≈ 85–120 h** | **≈ 80–115 h** | – | **≈ 55–75 h** |

Program total ≈ 460–650 agent-hours (≈ 550 at midpoints). Hyper3D: 34 generations ≈ 17 credits at 0.5 (≈ 34 at 1.0). **Claude is the bottleneck**: the plan moves everything that is not core, assets or adversarial review away from it.

### K.2 Where the first 10 games spent their effort **[V]**

| Driver | Evidence | Lever in this plan |
|---|---|---|
| Core reworked mid-production | two "core follow-up" rounds; `core/README.md` "Closed core gaps (follow-up 2)" lists 7 gaps found by games | Phase 1 builds every generic need first; core freeze before games |
| Very large tests | per game 690–2,810 test lines | test budget ≤ ~600 lines, behaviour over branches, core already tested |
| Long READMEs | 213–539 lines | README template ≤ 200 lines |
| Many review rounds | 11–24 commits per game folder | design gate G0 before code; max 2 review rounds; mechanical pre-review by script |
| Heavy context per session | mandatory reads ≈ 200 KB (CLAUDE.md 49 KB, skills.md 34 KB, platform-plan 32 KB, arcade-api 34 KB, core README 42 KB) | slim read set ≈ 70 KB (P-24), prompts point at sections |
| One agent did implementation + testing + debugging | CLAUDE.md "Workflow" | Kimi scripts checks, Antigravity does visual QA, Claude reviews once deeply |

### K.3 Levers and expected savings **[A]**

| Lever | How | Expected effect |
|---|---|---|
| Build common systems once | Phase 1 (06 §9.1) | 11 games avoid re-inventing 1–4 systems each; avoids a mid-wave core round (≈ 30–50 agent-hours) |
| Reuse assets | 30 existing GLBs, 10 new shared, ≈ 60 procedural | 34 generations instead of ≈ 70 (≈ 18 credits saved at 0.5) |
| Standard prompts | 08 with the common preamble and HANDOFF | fewer wrong-target runs (Kimi's audit mix-up), shorter hand-offs |
| Small read sets | P-24 + prompts list sections | ≈ 30k tokens saved per session; at ≈ 12 sessions per game × 20 games ≈ 7M tokens |
| No repeated repo analysis | `01-repo-audit.md` is the cached audit; agents never "explore the repo" | a full exploration costs ≈ 50–150k tokens each time |
| Reference game first | treasure-island + template freeze | the 19 others copy one proven folder |
| Fewer debugging cycles | pure rules + scoring bots + gamecheck + perf compare before review | review finds design issues, not mechanical ones |
| Cached docs | `core/README.md` sections with examples; skills as files | agents stop re-deriving APIs from source |
| Automated validation | `tools/gamecheck`, `tools/perf`, `tools/thumbs` | each check is a command, not a review hour |
| Asset retries | concept approval before generation; one retry max without asking | ≈ 25 % reserve instead of ×2 attempts |

### K.4 Budgets every agent works to

| Budget | Limit | Enforced by |
|---|---|---|
| Game README | ≤ 200 lines, template sections | gamecheck |
| `rules.test.ts` | ≈ 600 lines (warning above) | gamecheck |
| Review rounds | 2 (the second only for blockers) | Claude |
| HANDOFF | ≤ 40 lines | prompt |
| Read set per game session | ≈ 70 KB | prompts + slim CLAUDE.md |
| Hyper3D retries | 1 per asset without asking | P-11 |
| Draw calls / frame time / memory | 06 §10.1 | tools/perf compare |

### K.5 Execution scenarios

| | Low cost | **Balanced (recommended)** | High quality |
|---|---|---|---|
| Games | 20 | 20 | 20 |
| Hyper3D | tier 1 only (22 gens ≈ 11 credits); tier-2 heroes from the cut list (procedural goblin, castle tower, glowPod; runner-based keeper) | tier 1 + 2 (34 gens ≈ 17 credits) | + tier 3, 2 concept-backed retries for each hero (≈ 42 gens ≈ 21+ credits) |
| Parallel game branches | 2 (Claude + one helper) | 4 | 4 + Cursor if credits return |
| Reviews | Kimi mechanical + Claude spot review (1 h) | Kimi mechanical + Claude adversarial (2–4 h) | + a second Claude reviewer on AI and physics games |
| QA | `tools/thumbs` screenshots + your phone | + Antigravity visual QA per game | + 2–3 outside playtesters per wave |
| Extras | none | achievements-lite optional | achievements, music loops, tier-3 assets, trailer refresh |
| Calendar **[A]** | longest (one game at a time per pair) | ≈ 1/3 of low-cost | ≈ balanced + 20 % |
| Risk | more rework found late | moderate | lowest, most expensive |

Agent subscription prices are not listed: they depend on your plans and change often. Compare scenarios by agent-hours and credits, and read your plans' usage pages after Phase 3 to convert.

### K.6 Effort ledger

`docs/status.md` gets a ledger table that Claude fills at every merge: task id, agent, sessions, approximate active hours, review rounds, credits, notes. After Phase 3 and every wave, Claude recalibrates the remaining estimates (C.2 build column) from actuals and tells you if a scenario switch is needed.

### K.7 Uncertainty

| Unknown | Effect | Resolved by |
|---|---|---|
| Hyper3D price per generation (0.5 vs 1.0) and pay-by-result | ×2 on credits | dashboard before batch 1 |
| Antigravity and Kimi on full games | ±40 % on their game estimates | wave 1 actuals |
| Real-phone performance | perf fixes in Phase 7 | your phone checks from Phase 3 |
| Agent plan limits | calendar | your plans; ledger |

---

## L. Quality assurance and release plan

### L.1 Gates per game

| Gate | What | Who | Evidence |
|---|---|---|---|
| G0 Design | README design approved (P-14) | owner → Claude + you | approved README on `main` (docs-only merge) |
| G1 Rules | `rules.ts` + tests: determinism, scoring events, end conditions, limit proof draft | owner | vitest output |
| G2 Playable (primitives) | end-to-end run on keyboard and touch | owner | screenshots at 3 sizes |
| G3 Models | GLBs adopted, size tests, no T-pose, feet on the floor | owner (+ Claude for landmarks) | character/size tests, screenshots |
| G4 Review | gamecheck + perf compare green; Kimi mechanical pass; Claude adversarial pass; Antigravity visual QA | Kimi, Claude, Antigravity | reports |
| G5 Playtest | your run on desktop and your phone (`?perf=1` numbers) | you | "ok" in chat + numbers |
| G6 Merge | `status: "dev"` on `main` | Claude | merge commit |
| G7 Go-live | audit READY, proven limits in meta + JSON, JSON uploaded, `status: "live"` | auditor, Claude, you | `GET /arcade/games`, live check |

### L.2 Test layers

1. **Pure rules (vitest):** determinism, scoring, end conditions, generators over 1,000 seeds, limit proof with a bot through the real store (`advanceRunClock` + `playedFrameDt`), mutation probes in Claude's review.
2. **Core (vitest):** every new core module has its own tests (P-02 … P-07); existing 1,015 tests stay green.
3. **Character and size tests** on the real meshes (`rig/characterChecks.ts`, size tests).
4. **Headless integration:** `tools/thumbs` (plays a run, blank-canvas check), `tools/perf` (budgets, memory over retries).
5. **Visual QA:** Antigravity browser runs + screenshots; your phone.
6. **Regression at wave end (P-20):** full vitest, build route table (`/` and `/classic` free of three.js), every game's headless run, perf vs baseline, classic smoke (`/classic`, `/games/1` Exit → `/classic`, `/progress`, `/certificate`).

### L.3 Device matrix

| Device | How | When |
|---|---|---|
| Desktop Chrome 1280 × 800 | headless + Antigravity | every game |
| Phone portrait 390 × 844 and 360 × 740, banner open/closed | emulation (touch, 4× CPU) | every game |
| Phone landscape 844 × 390 | emulation | every game |
| Your real phone(s) (one Android, one iPhone if available) | `?perf=1`, a full run | G5 and before go-live |
| Firefox and Safari desktop | a smoke run | wave end |

### L.4 Release runbook per game (from the existing Release runbook)

1. P-21 audit says READY.
2. Claude's P-22 branch: proven limits in `meta.scoring` and `arcade-games.json` (`enabled: true`, version bump), status `live` (or `soon` for a teaser).
3. You: Plesk backup, then upload **only** `play50games-backend/play50games/includes/arcade-games.json` to the server's `wp-content/themes/play50games/includes/arcade-games.json`.
4. Claude: `GET /arcade/games` (read-only) shows the new version and the game enabled.
5. Claude merges to `main`; Vercel deploys.
6. Claude: live check as a guest (a run, best survives a reload); sitemap; OG card. You: one logged-in run (rank shows).
7. Watch: wp-admin "Arcade Scores" for implausible rows in the first days (the limits do not re-check stored rows **[V]** CLAUDE.md).
8. **Rollback:** `enabled: false` in the JSON (upload) and `status: "dev"` (merge).

### L.5 Post-release signals

- dataLayer events `arcade_start`, `arcade_game_over`, `arcade_new_best` **[V]** per game: starts vs completions show where players drop.
- Leaderboard rows per game; a score at the exact cap repeatedly = review the proof.
- Your notes from friends' playtests feed a "polish backlog" per game in `docs/status.md`.
