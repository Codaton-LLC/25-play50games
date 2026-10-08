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
| CLIs on the PC | not installed yet: Claude installs them in P-26 step 0, the user signs in | 2026-10-08 |

## Where we are

- Plan: `docs/arcade-expansion/` (start at its README). Next step: `10-owner-checklist-and-sprint-1.md` §M.3 step 2 (kickoff P-26 on the PC).
- Nothing of the expansion is built yet. The 10 original games are unchanged.

## Work board (active branches)

| Branch | Agent | Mode | Worktree | Allowed paths | Task | Since |
|---|---|---|---|---|---|---|
| – | – | – | – | – | – | – |

## Effort ledger

| Task | Agent | Mode | Runs | Active hours | Review rounds | Credits | Notes |
|---|---|---|---|---|---|---|---|
| plan (docs/arcade-expansion) | Claude (cloud) | – | – | – | 1 consistency review | 0 | approved 2026-10-08 |
