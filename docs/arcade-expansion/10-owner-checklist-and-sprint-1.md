# Deliverable M: Your personal action checklist · Deliverable N: First execution sprint

## M. Your checklist

### M.0 Questions that do not block the start (answer when convenient)

1. Should new games appear as **"Soon" teaser cards** a few days before they go live, or stay hidden until live?
2. Which **real phones** can you test on (model, Android/iOS)? One mid-range Android is the most useful.
3. **Go-live order** for the 20: by wave (default), or do you want favourites first?
4. ~~Cursor~~ answered: Cursor is back (Pro plan) as the fifth builder.
5. Can 2–3 people (family, friends) playtest the AI games (snowball-battle, zoo-escape) for 10 minutes each in wave 3?
6. Achievements-lite and music: interested for Phase 7 (D11), or never?

### M.1 In execution order

| # | When | What you do | Time | Kind |
|---|---|---|---|---|
| 1 | done | Decisions D1–D12 answered (README §A.6) | – | done 2026-10-08 |
| 2 | done | Hyper3D balance: 31 credits (the charge per generation is confirmed after batch 1) | – | done 2026-10-08 |
| 3 | done | Agents this week: Codex (Plus), Kimi (Pro), Antigravity (Pro), Cursor (Pro) | – | done 2026-10-08 |
| 3b | next | Claude installs the Codex and Kimi CLIs on your PC (P-26 step 0); you log in to each once in the browser window it opens | 10 min | **you personally** (accounts) |
| 4 | Sprint 1 | Start Claude Code on your PC and paste P-26 (kickoff); it runs the Codex and Kimi probes itself; you paste P-00 into Antigravity and its reply back to Claude | 20 min | you start it; agents work independently |
| 5 | Sprint 1 | Paste P-01 into Antigravity (Claude runs P-04 for Codex and P-06 for Kimi through the CLIs) | 5 min | you; agents independent |
| 6 | Sprint 1 | ChatGPT: paste P-09 (style sheet v2), pick A/B/C, give the image to Claude in your local Claude Code | 30 min | **you personally** (taste) |
| 7 | Sprint 1 | ChatGPT: the 6 batch-1 prompts from `11-chatgpt-concept-prompts.md` (chest, cannon, ship, cart, monster, penguin); approve or regenerate each; save as `%USERPROFILE%\.play50\concepts\expansion\<id>.png` | 60 min | **your approval** |
| 8 | Sprint 1 end | Check the Vercel production `/3d` after P-02 merges: it must look exactly as before (10 games) | 5 min | your check |
| 9 | Phase 2 | Write "po, gjenero batch 1" when Claude shows the batch table; approve each download ("ok") | 20 min | **your approval** (spend) |
| 10 | Phase 3 | Approve the treasure-island design; playtest it on desktop and your phone with `?perf=1`; say "template approved" | 1.5 h | **your approval** |
| 11 | Phase 3 | Approve the 4 wave-1 designs (Claude summarises each in 5 lines) | 30 min | **your approval** |
| 12 | Waves 1–3 | Paste P-14/P-15/P-17a/P-18 prompts when Claude says; playtest each game (≈ 20 min each); approve batches 2 and 3 | ≈ 1.5 h per game incl. waiting | you + approvals |
| 13 | Wave 3 | Organise 2–3 playtesters for snowball-battle and zoo-escape | 1 h | you |
| 14 | Phase 7 | Run all 20 on your phone with `?perf=1`, send the numbers | 2 h | you |
| 15 | Phase 8, per game | Decide the order; for each: Plesk backup → upload the JSON Claude hands you → say "uploaded" → one logged-in run after deploy | 20 min per game | **you personally** (server access) |

### M.2 Split of responsibilities

| You must do personally | Agents do independently | Needs your approval | Automated | Postponed |
|---|---|---|---|---|
| decisions D1–D11; Hyper3D balance; ChatGPT concept sessions; phone tests; Plesk backups and JSON uploads; Vercel env changes (none needed for the expansion); credentials (never pasted in chat) | core modules, games, tests, docs, reviews, QA reports, thumbnails, OG cards, perf runs | style sheet, every concept, every Hyper3D batch and download, each game design (G0), each playtest (G5), each go-live, anything that changes the score limits on the server | ownership diff, type checks, tests, README/test budgets (`tools/gamecheck`), perf budgets and memory (`tools/perf`), thumbnails (`tools/thumbs`), headless runs | achievements-lite, music, tier-3 assets, run tokens, daily challenge, Lighthouse pass, trailer |


### M.3 Start: step by step

**When:** as soon as you have answered the decisions (step 1). Nothing else blocks the start; the first week has no Hyper3D spend.

| Step | Who | What exactly | Done when |
|---|---|---|---|
| 1 | you | ✅ Done 2026-10-08: decisions answered, Hyper3D 31 credits, plans Codex Plus / Kimi Pro / Antigravity Pro / Cursor Pro (`docs/status.md`). | done |
| 2 | Claude installs, you log in (PC) | In P-26 step 0 Claude installs the Codex CLI (`npm install -g @openai/codex`) and the Kimi Code CLI (PowerShell: `irm https://code.kimi.com/kimi-code/install.ps1 \| iex`). You then run `codex login` and `kimi login` in a PowerShell window and confirm in the browser. Hyper3D login if needed: `claude mcp login hyper3d-rodin`. | `codex --version` and `kimi --version` print |
| 3 | you start, Claude works (PC) | Open Claude Code on your PC in the repository and paste **P-26** (08) together with your message from step 1. Claude merges the plan into main, writes `docs/status.md`, installs the skills, creates `WORKSPACE\p50-codex`, and runs the P-00 probe for Codex and Kimi through their CLIs. | Claude reports "CLI ok / copy-paste" per agent |
| 4 | you (Antigravity, Cursor) | Paste the filled-in **P-00** into Antigravity and into Cursor, then **P-01** into Antigravity; paste each HANDOFF back into Claude Code. | probes + baseline received |
| 5 | Claude (PC) | **P-02** (registry for 30) itself; starts **P-04** (Codex) and **P-06** (Kimi) through the CLIs (P-25); reviews and merges them. | `/3d` on Vercel unchanged; 30 games in a preview build |
| 6 | you (ChatGPT) | Style sheet (step 0 of `11-chatgpt-concept-prompts.md`), pick A/B/C; then the 6 batch-1 concepts (no human faces in batch 1); save them in `%USERPROFILE%\.play50\concepts\expansion\`. Runs in parallel with steps 5–7. | 6 images saved |
| 7 | Claude (PC) | **P-03** (effects, quality, perf probe); then **P-07** (Kimi, CLI) and **P-08** (you paste into Cursor); then **P-05**; core freeze check. | core freeze v3.0 green |
| 8 | you | Tell Claude "concepts batch 1 ready"; read the batch table and credit estimate; write "po, gjenero batch 1"; approve each result with "ok". | 11 GLBs in the manifest |
| 9 | Claude, you | Reference game **treasure-island**: you approve its design, Claude builds it, you playtest on desktop and phone (`?perf=1`) and say "template approved". | template freeze |
| 10 | everyone | Wave 1: pirate-cannons (Claude), penguin-slide (Codex, CLI), shopping-cart (Antigravity, pasted), monster-kitchen (Kimi, CLI), luggage-rush (Cursor, pasted); concepts for batch 2 meanwhile (the human ones with your face reference). Then waves 2 and 3 the same way (09 §J). | wave regression green |
| 11 | you + Claude | Go-live one game at a time, in the order you choose (09 §L.4). | each game live |

---

## N. First execution sprint (15 tasks)

Goal of the sprint: decisions taken, agents verified, core v3 mostly built, style and batch-1 concepts approved. Exit: **core freeze v3.0** (or one PR from it) and batch 1 ready to generate.

| # | Task | Agent | Prerequisite | Prompt | Done when |
|---|---|---|---|---|---|
| N-01 | Decisions D1–D11 | **You** | read README §A | – (reply in chat) | answers recorded by Claude in `docs/status.md` |
| N-02 | Hyper3D balance and per-generation charge; check the MCP login on your PC (`claude mcp login hyper3d-rodin` if needed) | **You** | – | – | numbers in `docs/status.md` |
| N-03 | Kickoff on your PC: plan merged to main, `docs/status.md` (decisions, work board, ledger), skills in `.claude/skills/`, the `p50-codex` worktree, probe branches, the CLI pilot | **Claude (your PC)** | N-01, CLIs installed | **P-26** | pilot result per agent reported to you |
| N-04 | Capability probe of each helper | **Codex, Kimi** (CLI, run by Claude in P-26 step 7) · **Antigravity, Cursor** (you paste) | N-03 | **P-00** (worktrees `…\WORKSPACE\p50-antigravity`, `…\WORKSPACE\p50-cursor`) | three probe reports; 07 §H.2 updated by Claude |
| N-05 | Runtime baseline of the 10 games | **Antigravity** (you paste) | N-03 | **P-01** | baseline table + screenshots |
| N-06 | Registry for 30 (P1-A) | **Claude** | N-01 (D2, D4, D5) | **P-02** | merged; production `/3d` unchanged; preview shows 30 |
| N-07 | Slim the read set | **Claude** | N-01 (D10) | **P-24** | CLAUDE.md ≤ ~15 KB, `docs/status.md`, AGENTS.md read sets |
| N-08 | Pure gameplay helpers (P1-C) | **Codex** (CLI via P-25) | N-04 | **P-04** | merged after Claude's review |
| N-09 | Audio cues and loops | **Kimi** (CLI via P-25) | N-04 | **P-06** | merged after Claude's review and your listening check |
| N-10 | Effects, quality, perf probe, env, presets, shell fixes (P1-B) | **Claude** | N-06 | **P-03** | merged; existing games unchanged; baseline numbers in the merge notes |
| N-11 | Style sheet v2 | **You + ChatGPT** | N-01 (D1) | **P-09** | you picked A, B or C |
| N-12 | Batch-1 concepts (chest, cannon, ship, cart, monster, penguin) | **You + ChatGPT** | N-11 | **P-10**, filled in: `11-chatgpt-concept-prompts.md` batch 1 | 6 approved images in `%USERPROFILE%\.play50\concepts\expansion\` |
| N-13 | Collections UI | **Cursor** (you paste) | N-06 | **P-08** | merged; Claude wires the prop on `/3d` |
| N-14 | `tools/gamecheck` + `tools/perf` + baseline | **Kimi** (CLI via P-25) | N-10 | **P-07** | merged; `baseline.json` committed |
| N-15 | Input, rig, render, kit, HUD (P1-D) → core freeze check | **Claude** | N-08, N-10 | **P-05** | merged; freeze checklist (07 §G.3) green |

Order: N-01/N-02 (you) → N-03 Claude's kickoff on your PC (with the Codex/Kimi pilot = their part of N-04) → you paste N-04 and N-05 into Antigravity → Claude runs N-06, N-07 and starts N-08, N-09 through the CLIs → N-10 → N-11/N-12 any time after D1 → N-13 (you paste) after N-06 → N-14 (CLI) after N-10 → N-15. The step-by-step version is §M.3.

All prompts are in `08-prompt-library.md` with every field filled except the ones named above.

### What comes right after sprint 1

1. Batch 1 generation (P-11/P-12) once you write "po, gjenero batch 1".
2. The reference game, treasure-island (Claude: P-14 → your approval → P-15).
3. Wave-1 designs (P-14) for penguin-slide (Codex), luggage-rush (Codex, after penguin), shopping-cart (Antigravity), monster-kitchen (Kimi), while the reference game is built.
