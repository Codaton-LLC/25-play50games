# Project status: 3D Arcade expansion

Claude-only file (decision D10). The work board and the effort ledger are updated at every hand-off and merge. CLAUDE.md keeps only a short summary and points here.

## Decisions (answered by the user, 2026-10-08)

| ID | Decision | Answer |
|---|---|---|
| D1 | Art direction "Play50 toy world, premium edition" (`arcade-expansion/05-hyper3d-catalog.md` §E.1) | yes |
| D2 | The 20 slugs, titles and the two collections (`02` §C.1) | yes |
| D3 | Gameplay changes ("Director's call" in each spec) | yes |
| D4 | Owners | yes; **Cursor is back** (Pro): five builders with 4 games each (`02` §C.2), Cursor also owns the UI kit task P-08 |
| D5 | `status: "dev"` + `NEXT_PUBLIC_ARCADE_PREVIEW` | yes |
| D6 | Physics | **Rapier allowed where it is needed**; scoring logic stays in pure `rules.ts` so limits stay provable |
| D7 | Hyper3D batches, each approved in chat | yes |
| D8 | New human characters | **the user's face** on the knight (visor raised), the astronaut (clear visor) and the zookeeper; the snow kid is **a young version of the user without a beard**; ChatGPT concepts made with the user's face reference; face concepts never committed |
| D9 | Bounded core tasks delegated (pure helpers to Codex, audio to Kimi) | yes |
| D10 | Slim read set (this file; CLAUDE.md ≤ ~15 KB) | yes |
| D11 | Achievements-lite and music in Phase 7 | yes |
| D12 | Codex and Kimi through their CLIs (P-25), Codex in its own worktree `p50-codex`; Antigravity, Cursor, ChatGPT copy-paste | yes |

## Accounts and budgets

| Item | Value | Date |
|---|---|---|
| Hyper3D balance | **12.5 credits** (after the 3 shoppers, 2026-10-08); before that **14 credits** after 34 generations (27 core + 5 tier 3 + 2 retries); charge confirmed **0.5 per Gen-2.5-Medium generation** (31 -> 17.5 after the 27 core). IDs in %USERPROFILE%\.play50\hyper3d\*-ids.txt | 2026-10-08 |
| Codex | Plus plan (the smallest: small tasks, one at a time) | 2026-10-08 |
| Kimi | Pro plan | 2026-10-08 |
| Antigravity | Pro plan | 2026-10-08 |
| Cursor | Pro plan (back as a builder) | 2026-10-08 |
| CLIs on the PC | Codex CLI 0.161.0 (npm global, logged in with ChatGPT); Kimi Code 2.1.1 (`%USERPROFILE%\.kimi-code\bin`, logged in on kimi.ai, `--region global`) | 2026-10-08 |

## CLI mode: commands confirmed by the P-00 pilot (2026-10-08)

| Agent | Command (from Claude Code, Git Bash) | Pilot result |
|---|---|---|
| Codex | `timeout 1800 codex exec --sandbox workspace-write -c 'windows.sandbox="unelevated"' -C "C:/Users/grani/Documents/WORKSPACE/p50-codex" - < .handoff/<ID>/prompt.md > .handoff/<ID>/run.log 2>&1` (prompt on stdin) | **CLI ok** (3 min 46 s). The first run failed: `~/.codex/config.toml` has `[windows] sandbox = "elevated"` (set by the Codex desktop app), which gives `helper_unknown_error: setup refresh had errors` on every command, so always pass the `unelevated` override. The sandbox has **no network** (no push, no `npm install`), and `.codex/` in the worktree is read-only (project skills not testable). So Claude runs `npm ci`, local builds and headless captures; Codex does code tasks only. It also cannot spawn child processes (`spawn EPERM`: no `next build`, no vitest/esbuild; `tsc` works), so Claude runs build and vitest after every Codex run. Prompts must compare against `origin/main` or use `git status --porcelain`: the local `main` ref is stale (it belongs to the main checkout), and P-04 run 1 stopped on `main...HEAD`. It loads AGENTS.md; the user skill folders are `~/.codex/skills`, `~/.agents/skills`. No quota view in the CLI. |
| Kimi | `cd p50-kimi && timeout 1800 kimi -p "Read the file .handoff/<ID>/prompt.md in this worktree and carry out the task it describes exactly, including the [CLI MODE] rules at its end." < /dev/null > .handoff/<ID>/run.log 2>&1` | **CLI ok** (about 11 min, everything answered). `-p` always runs in `auto` mode (no approvals); only the static deny rules gate it. Those rules are added to `~/.kimi-code/config.toml` (backup `config.toml.bak-2026-10-08`): no FetchURL/Bash to `cms.play50.games`, `25-play50games.vercel.app` or `play50.games`; no `git push` (`--dry-run` allowed), `git commit`, `git switch`, `git checkout`, `git reset --hard` or `rm -rf`. It has network: it built the app, served it on port 3101 and captured robot-collector headless. It loads AGENTS.md; project skills auto-load from `.agents/skills/` (not inside its subagents). Quota only through `/usage` in interactive mode. |

Known local issues: port 3100 is held by an old `next start` from `.claude/worktrees/enable-four` (PID 7964 on 2026-10-08), so give helpers port 3101/3102. Cursor's uncommitted K2 result-panel edits from 2026-10-07 are saved as a WIP commit on `cursor/k2-result-fixes` (`795dfa1`, local only, probably stale against main).

## Where we are

- Plan: `docs/arcade-expansion/` (start at its README), merged to main 2026-10-08; skills installed in `.claude/skills/`.
- P-26 kickoff done (2026-10-08): CLIs installed and logged in, `p50-codex` worktree, probe branches, pilots of all four agents (above).
- P-01 baseline (Antigravity, 2026-10-08): all 10 games render at 1280x800 and 390x844 with the cookie banner open, Retry x3 ok, no overlaps; frame times p50 16.7 / p95 17.2-17.8 ms, but measured in headless Chrome (vsync-capped, desktop GPU), so they are a smoke baseline, not phone numbers; it reported `__towerProbe` missing although tower-climb sets it (Scene.tsx:185). Screenshots and `audit_results.json` in `%USERPROFILE%\.gemini\antigravity\brain\bce5aadd-dee1-472d-a6c6-551e07e29d9c\scratch\`. Real-phone numbers come with `tools/perf` (P-07).
- **P-02 merged 2026-10-08** (`3eb92de`): 30 slugs, `status: "dev"`, collections, `NEXT_PUBLIC_ARCADE_PREVIEW`, 20 stubs, `arcade-games.json` v3 (20 disabled entries, provisional limits; no server upload needed until a new game goes live), `REUSED_ASSETS`, tools/thumbs + og. Checked: production flags = the same 10 cards, `/3d/treasure-island` 404; preview = 3 sections, dev routes 200 + noindex. Follow-ups: dev cards are not clickable in preview (the UI kit links only live cards: P-08), the `tools/og` arcade card still says "10 mini-games" (regenerate when the first new game goes live), chef/cleaner landmarks still in their game folders.
- Core v3 (P-02, P-03, P-04, P-05, P-08) merged on 2026-10-08; P-06 (Kimi audio) waits for its quota, then P-07 (Kimi tools). After P-06 is merged, register `stopAllLoops` in core/loopControl.ts (one line, TODO(P-06)). Then core freeze v3.0 and the reference game treasure-island (P-14 design for the user's approval).
- The 10 original games are unchanged (perf calls per game equal to the P-03 baseline after every merge).

## Wave 1 (started 2026-10-08, after the user approved the treasure-island template)

| Game | Owner | Mode | Design (G0) | Build (P-15) |
|---|---|---|---|---|
| treasure-island (reference) | Claude | agent | approved | **merged** `a02934b` (status dev); review: merge after fixes -> branch `claude/ti-followup` (pinned constants, tide clamp test, props after clamp, 200+ bot seeds, core `core/testing/botHarness.ts`) in progress |
| pirate-cannons | Claude | agent | approved + fix round (`b630827`), merged | branch `claude/game-pirate-cannons` (worktree pc, port 3111) in progress |
| penguin-slide | Codex | CLI | approved + fix round (`d1c03e1`), merged | branch `codex/game-penguin-slide` (p50-codex) running; Claude runs vitest/build/playtest after |
| shopping-cart | Antigravity | copy-paste | approved after rework (`9151e02`), merged; 3 new faceless shoppers generated (1.5 credits) and rigged (`199124e`, merged) | branch `antigravity/game-shopping-cart` (port 3102): prompt given to the user |
| luggage-rush | Cursor | copy-paste | approved + fix round (`8ff608f`), merged | branch `cursor/game-luggage-rush` (port 3103): prompt given to the user |
| monster-kitchen | Kimi | CLI | not started (Kimi quota: P-06 first) | – |

User decisions on wave 1 designs (2026-10-08): penguin 180 s ceiling + limits, touch auto-hop always on; shopping-cart 3 new faceless shoppers (A grandmother, B young woman, C man), win on entering checkout, pyramids stay toppled, 6 items from 10 kinds; luggage-rush max 7620 / pps 64, a hold before 70 s strikes at once; pirate-cannons relative drag + tap to fire again, 30° portrait camera. Local preview of treasure-island: `.claude/worktrees/ti-play`, `next start -p 3200 -H 0.0.0.0` (LAN 192.168.2.110).

## Work board (active branches)

| Branch | Agent | Mode | Worktree | Allowed paths | Task | Since |
|---|---|---|---|---|---|---|
| codex/core-helpers | Codex | CLI | p50-codex | core/{ballistics,path,motion,kinematics}.ts, core/ai/** | P-04 **merged** `55924ab` (after 1 fix round, re-review: all 12 mutation probes caught) | 2026-10-08 |
| kimi/core-audio | Kimi | CLI | p50-kimi | core/audio.ts, audio.test.ts, README "Sound" | P-06 committed `17c95d8`; review: merge after fixes (LFO ignores volume, engine pitch, set after stop, NaN, disconnect, ramp/master tests, README); fix round 1 **stopped by Kimi's 5-hour quota** at 18:54 with audio.ts fixed and audio.test.ts half-updated (uncommitted in p50-kimi): rerun "finish fix round 1" after the quota resets | 2026-10-08 |
| claude/expansion-fx | Claude | – | .claude/worktrees/fx | core/** | P-03 **merged** `a005f96` (review: shake undo, declines cap, percentile test fixed; DPR cap documented as a deviation in 06 §10.4; iPhone bottom inset to check on a real phone) | 2026-10-08 |
| claude/expansion-input-rig | Claude | – | .claude/worktrees/p05 | core/** | P-05 **merged** `88f5c2e` (review: pointer capture for aim drag, layout-effect attachments/looks, `tinted` pools) | 2026-10-08 |
| claude/assets-batch-1 + claude/assets-characters-b23 | Claude | – | assets1, chars | public/models/3d, core/modelManifest, sharedAssets, rig tests | **merged** `ff0b06a`: 22 props/creatures (EXPANSION_ASSETS, sizes, points, tests) + tier 3 + rock/suitcase v2 + 5 rigged characters (knight, snowKid, astronaut, alien, keeper; landmarks + checks). Known looks: suitcase keeps a trolley handle (tint in code), vacuum straps, plane is a prop plane, crab 4 legs, astronaut backpack (= jetpack), knight armour glossy black (material override possible) | 2026-10-08 |
| codex/probe | Codex | CLI | p50-codex | none (report only) | P-00 (done, CLI ok) | 2026-10-08 |
| kimi/probe | Kimi | CLI | p50-kimi | none (report only) | P-00 (done, CLI ok) | 2026-10-08 |
| antigravity/probe | Antigravity | copy-paste | p50-antigravity | none (report only) | P-00 (done 2026-10-08: auto-loads AGENTS.md only; project skills auto-load from `.agents/skills/`; build, tsc, vitest 1144 tests pass; can push; WebGL drew robot-collector on port 3102, but through its own headless Chrome CDP script, not the interactive browser agent; quota only in the app UI) | 2026-10-08 |
| antigravity/baseline-audit | Antigravity | copy-paste | p50-antigravity | none (report only) | P-01 (done 2026-10-08) | 2026-10-08 |
| cursor/probe | Cursor | copy-paste | p50-cursor | none (report only) | P-00 (done 2026-10-08: auto-loads CLAUDE.md + AGENTS.md; project skills folder `.cursor/skills/` did not auto-load in a subagent, so prompts keep pointing at the SKILL.md path; vitest 2.1.9; can push; no quota readout) | 2026-10-08 |
| cursor/ui-collections | Cursor | copy-paste | p50-cursor | `arcade3d/ui/**` | P-08 **merged** `b52d6bf` (cherry-picked onto main + /3d wired: chips only when more than one collection shows) | 2026-10-08 |

## Effort ledger

| Task | Agent | Mode | Runs | Active hours | Review rounds | Credits | Notes |
|---|---|---|---|---|---|---|---|
| plan (docs/arcade-expansion) | Claude (cloud) | – | – | – | 1 consistency review | 0 | approved 2026-10-08 |
| P-26 kickoff | Claude (PC) | – | 1 | ~0.7 | – | 0 | plan merged, skills, worktrees, branches, CLI pilot |
| P-00 probe | Codex | CLI | 2 | 0.1 | – | 0 | run 1 failed (elevated sandbox), run 2 ok |
| P-00 probe | Kimi | CLI | 1 | 0.2 | – | 0 | ok |
| P-00 probe | Cursor | copy-paste | 1 | – | – | 0 | ok |
| P-00 probe | Antigravity | copy-paste | 1 | – | – | 0 | ok |
| P-01 baseline | Antigravity | copy-paste | 1 | – | – | 0 | headless only |
| P-02 registry for 30 | Claude | – | 1 | ~1 | self-check | 0 | merged `3eb92de` |
| P-04 core helpers | Codex | CLI | 3 | 0.3 | 2 | 0 | run 1 stopped (stale main ref), run 2 12 min, fix round 4 min; merged |
| P-06 audio | Kimi | CLI | 2 | 0.8 | 1 | 0 | run 1 30 min; fix round cut by the 5-hour quota (Kimi Pro: about one big task per 5-hour window) |
| P-08 UI collections | Cursor | copy-paste | 1 | – | self-check | 0 | merged |
