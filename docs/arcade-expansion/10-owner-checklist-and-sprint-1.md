# Deliverable M: Your personal action checklist · Deliverable N: First execution sprint

## M. Your checklist

### M.0 Questions that do not block the start (answer when convenient)

1. Should new games appear as **"Soon" teaser cards** a few days before they go live, or stay hidden until live?
2. Which **real phones** can you test on (model, Android/iOS)? One mid-range Android is the most useful.
3. **Go-live order** for the 20: by wave (default), or do you want favourites first?
4. Do you want to top up **Cursor** credits to add a fifth builder (shorter calendar, more review load on Claude)?
5. Can 2–3 people (family, friends) playtest the AI games (snowball-battle, zoo-escape) for 10 minutes each in wave 3?
6. Achievements-lite and music: interested for Phase 7 (D11), or never?

### M.1 In execution order

| # | When | What you do | Time | Kind |
|---|---|---|---|---|
| 1 | now | Read `README.md` §A; answer D1–D11 in chat (e.g. "D1 po, D2 po, …") | 45 min | **you personally** |
| 2 | now | Hyper3D dashboard: note the credit balance and the charge shown for one Gen-2.5 Medium generation; tell Claude | 10 min | **you personally** (account access) |
| 3 | now | Tell Claude which agents have usage left this week (Codex, Antigravity, Kimi; Cursor?) | 5 min | you |
| 4 | Sprint 1 | Paste P-00 into Codex, Antigravity and Kimi (Claude creates the branches first); paste each reply back to Claude | 20 min | you (copy-paste); agents work independently |
| 5 | Sprint 1 | Paste P-01 into Antigravity; P-04 into Codex; P-06 into Kimi (Claude tells you when) | 10 min | you; agents independent |
| 6 | Sprint 1 | ChatGPT: paste P-09 (style sheet v2), pick A/B/C, give the image to Claude in your local Claude Code | 30 min | **you personally** (taste) |
| 7 | Sprint 1 | ChatGPT: P-10 for the 6 batch-1 concepts (chest, cannon, ship, cart, monster, penguin); approve or regenerate each | 60 min | **your approval** |
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

---

## N. First execution sprint (15 tasks)

Goal of the sprint: decisions taken, agents verified, core v3 mostly built, style and batch-1 concepts approved. Exit: **core freeze v3.0** (or one PR from it) and batch 1 ready to generate.

| # | Task | Agent | Prerequisite | Prompt | Done when |
|---|---|---|---|---|---|
| N-01 | Decisions D1–D11 | **You** | read README §A | – (reply in chat) | answers recorded by Claude in `docs/status.md` |
| N-02 | Hyper3D balance and per-generation charge; check the MCP login on your PC (`claude mcp login hyper3d-rodin` if needed) | **You** | – | – | numbers in `docs/status.md` |
| N-03 | Create helper branches (`codex/core-helpers`, `kimi/core-audio`, `antigravity/baseline-audit`, `<agent>/probe`), the work board in `docs/status.md`, install the skills in `.claude/skills/` | **Claude** | N-01 (D9) | – (Claude, local) | branches exist in each worktree; work board lists them |
| N-04 | Capability probe of each helper | **Codex, Antigravity, Kimi** | N-03 | **P-00** (fill `<agent>` and the worktree: Codex `C:\Users\grani\Documents\WORKSPACE-play50games`, Antigravity `…\WORKSPACE\p50-antigravity`, Kimi `…\WORKSPACE\p50-kimi`) | three probe reports; §H.2 updated by Claude |
| N-05 | Runtime baseline of the 10 games | **Antigravity** | N-03 | **P-01** | baseline table + screenshots |
| N-06 | Registry for 30 (P1-A) | **Claude** | N-01 (D2, D4, D5) | **P-02** | merged; production `/3d` unchanged; preview shows 30 |
| N-07 | Slim the read set | **Claude** | N-01 (D10) | **P-24** | CLAUDE.md ≤ ~15 KB, `docs/status.md`, AGENTS.md read sets |
| N-08 | Pure gameplay helpers (P1-C) | **Codex** | N-04 | **P-04** | merged after Claude's review |
| N-09 | Audio cues and loops | **Kimi** | N-04 | **P-06** | merged after Claude's review and your listening check |
| N-10 | Effects, quality, perf probe, env, presets, shell fixes (P1-B) | **Claude** | N-06 | **P-03** | merged; existing games unchanged; baseline numbers in the merge notes |
| N-11 | Style sheet v2 | **You + ChatGPT** | N-01 (D1) | **P-09** | you picked A, B or C |
| N-12 | Batch-1 concepts (chest, cannon, ship, cart, monster, penguin) | **You + ChatGPT** | N-11 | **P-10** (asset lines and palettes from 05 §E.5) | 6 approved images on your PC |
| N-13 | Collections UI | **Antigravity** | N-06 | **P-08** | merged; Claude wires the prop on `/3d` |
| N-14 | `tools/gamecheck` + `tools/perf` + baseline | **Kimi** | N-10 | **P-07** | merged; `baseline.json` committed |
| N-15 | Input, rig, render, kit, HUD (P1-D) → core freeze check | **Claude** | N-08, N-10 | **P-05** | merged; freeze checklist (07 §G.3) green |

Order of pasting: N-01/N-02 (you) → Claude does N-03 → you paste N-04 ×3 → N-05, N-08, N-09 → Claude runs N-06, N-07, then N-10 → N-11/N-12 any time after D1 → N-13 after N-06 → N-14 after N-10 → Claude N-15.

All prompts are in `08-prompt-library.md` with every field filled except the ones named above.

### What comes right after sprint 1

1. Batch 1 generation (P-11/P-12) once you write "po, gjenero batch 1".
2. The reference game, treasure-island (Claude: P-14 → your approval → P-15).
3. Wave-1 designs (P-14) for penguin-slide (Codex), luggage-rush (Codex, after penguin), shopping-cart (Antigravity), monster-kitchen (Kimi), while the reference game is built.
