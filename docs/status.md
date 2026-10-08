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
| Hyper3D balance | 31 credits (the charge per Gen-2.5 Medium generation is confirmed by the balance after batch 1; plan assumes 0.5) | 2026-10-08 |
| Codex | Plus plan (the smallest: small tasks, one at a time) | 2026-10-08 |
| Kimi | Pro plan | 2026-10-08 |
| Antigravity | Pro plan | 2026-10-08 |
| Cursor | Pro plan (back as a builder) | 2026-10-08 |
| CLIs on the PC | Codex CLI 0.161.0 (npm global, logged in with ChatGPT); Kimi Code 2.1.1 (`%USERPROFILE%\.kimi-code\bin`, logged in on kimi.ai, `--region global`) | 2026-10-08 |

## CLI mode: commands confirmed by the P-00 pilot (2026-10-08)

| Agent | Command (from Claude Code, Git Bash) | Pilot result |
|---|---|---|
| Codex | `timeout 1800 codex exec --sandbox workspace-write -c 'windows.sandbox="unelevated"' -C "C:/Users/grani/Documents/WORKSPACE/p50-codex" - < .handoff/<ID>/prompt.md > .handoff/<ID>/run.log 2>&1` (prompt on stdin) | **CLI ok** (3 min 46 s). The first run failed: `~/.codex/config.toml` has `[windows] sandbox = "elevated"` (set by the Codex desktop app), which gives `helper_unknown_error: setup refresh had errors` on every command, so always pass the `unelevated` override. The sandbox has **no network** (no push, no `npm install`), and `.codex/` in the worktree is read-only (project skills not testable). So Claude runs `npm ci`, local builds and headless captures; Codex does code tasks only. It loads AGENTS.md; the user skill folders are `~/.codex/skills`, `~/.agents/skills`. No quota view in the CLI. |
| Kimi | `cd p50-kimi && timeout 1800 kimi -p "Read the file .handoff/<ID>/prompt.md in this worktree and carry out the task it describes exactly, including the [CLI MODE] rules at its end." < /dev/null > .handoff/<ID>/run.log 2>&1` | **CLI ok** (about 11 min, everything answered). `-p` always runs in `auto` mode (no approvals); only the static deny rules gate it. Those rules are added to `~/.kimi-code/config.toml` (backup `config.toml.bak-2026-10-08`): no FetchURL/Bash to `cms.play50.games`, `25-play50games.vercel.app` or `play50.games`; no `git push` (`--dry-run` allowed), `git commit`, `git switch`, `git checkout`, `git reset --hard` or `rm -rf`. It has network: it built the app, served it on port 3101 and captured robot-collector headless. It loads AGENTS.md; project skills auto-load from `.agents/skills/` (not inside its subagents). Quota only through `/usage` in interactive mode. |

Known local issues: port 3100 is held by an old `next start` from `.claude/worktrees/enable-four` (PID 7964 on 2026-10-08), so give helpers port 3101/3102. Cursor's uncommitted K2 result-panel edits from 2026-10-07 are saved as a WIP commit on `cursor/k2-result-fixes` (`795dfa1`, local only, probably stale against main).

## Where we are

- Plan: `docs/arcade-expansion/` (start at its README), merged to main 2026-10-08; skills installed in `.claude/skills/`.
- P-26 kickoff done (2026-10-08): CLIs installed and logged in, `p50-codex` worktree, probe branches, Codex/Kimi pilot (above). Next: §M.3 step 4 (the user pastes P-00 into Antigravity and Cursor, then P-01 into Antigravity), then step 5 (P-02, P-04 Codex, P-06 Kimi).
- Nothing of the expansion is built yet. The 10 original games are unchanged.

## Work board (active branches)

| Branch | Agent | Mode | Worktree | Allowed paths | Task | Since |
|---|---|---|---|---|---|---|
| codex/probe | Codex | CLI | p50-codex | none (report only) | P-00 (done, CLI ok) | 2026-10-08 |
| kimi/probe | Kimi | CLI | p50-kimi | none (report only) | P-00 (done, CLI ok) | 2026-10-08 |
| antigravity/probe | Antigravity | copy-paste | p50-antigravity | none (report only) | P-00 (waiting for the user to paste) | 2026-10-08 |
| antigravity/baseline-audit | Antigravity | copy-paste | p50-antigravity | none (report only) | P-01 (after P-00) | 2026-10-08 |
| cursor/probe | Cursor | copy-paste | p50-cursor | none (report only) | P-00 (waiting for the user to paste) | 2026-10-08 |
| cursor/ui-collections | Cursor | copy-paste | p50-cursor | `arcade3d/ui/**` | P-08 (after P-02) | 2026-10-08 |

## Effort ledger

| Task | Agent | Mode | Runs | Active hours | Review rounds | Credits | Notes |
|---|---|---|---|---|---|---|---|
| plan (docs/arcade-expansion) | Claude (cloud) | – | – | – | 1 consistency review | 0 | approved 2026-10-08 |
| P-26 kickoff | Claude (PC) | – | 1 | ~0.7 | – | 0 | plan merged, skills, worktrees, branches, CLI pilot |
| P-00 probe | Codex | CLI | 2 | 0.1 | – | 0 | run 1 failed (elevated sandbox), run 2 ok |
| P-00 probe | Kimi | CLI | 1 | 0.2 | – | 0 | ok |
