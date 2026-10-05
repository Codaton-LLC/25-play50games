# X2 Hyper3D CLI implementation plan

Spec: approved platform-plan §4 and the X2 hand-off. Node 24 ESM, native fetch.
Only tools/hyper3d is owned here. Mock execution never accesses personal keys,
the personal ledger, the network, concepts, raw originals, or public models.

1. Write node:test coverage for spec validation, reserve, confirmation, checkout
   guards, key redaction, and generation-to-optimization output. Run before code.
2. Implement spec.mjs and assets.schema.json: safe identifiers, strict properties,
   character/image and prop/text contracts, defaults and hard optimization caps.
3. Implement safety.mjs and ledger.mjs: main checkout identity, external-only keys,
   masked errors, atomic ledger writes and an exclusive lock spanning paid work.
4. Implement config.mjs and api.mjs: centralized fields; submit once, record spend
   before polling; bounded polling; immediate downloads with one URL refresh.
5. Implement models.mjs using glTF Transform, Sharp, meshoptimizer: generated
   textured fixtures, floor pivot, WebP, simplification, meshopt and measured caps.
6. Implement cli.mjs, example and README. Mock output is tools/hyper3d/.mock;
   production output paths follow the hand-off for later Claude/user execution.
7. Run node --test, all requested mock examples and smoke/import paths. Run
   frontend build, TypeScript and Vitest. Inspect ownership diff, commit, push
   codex/x2-hyper3d-cli and open a PR to main. Do not merge.

API checks: docs.hyper3d.ai confirms TAPose, geometry_file_format, consumed,
jobs.subscription_key, task_uuid and GET check_balance. FBX is a single-format
alternative; privacy has a policy, no documented generation toggle. Smoke must
distinguish acceptance from visual verification and documented from tested.

## X2 review corrections

Primary workflow is now Rodin MCP in Claude Code → import → optimize. Legacy API
generation remains guarded. Only tools/hyper3d files are modified.

1. Add regression tests for smoke/internal confirmation, case-insensitive IDs,
   omitted API fields, fixed parser/transport errors, unique local/HTTPS imports,
   skinned/seamed geometry preservation and simplification above the initial error.
2. Skip checkout checks only in mock mode. Require confirmation inside every
   real generation path, as well as at gen/smoke CLI entry points.
3. Detect skins or explicit rigged metadata; skip weld/simplify for rigs. Retry
   unrigged simplification from the original geometry at the five approved errors.
4. Center once before compression, preserve float positions, assert decoded min Y
   equals zero. Reject over-budget output before writing public models.
5. Document MCP imports and revised safety/optimizer behavior. Verify main checkout
   and linked-worktree node tests, mock commands and frontend integration checks.
6. Commit, push and update PR #1; verify only tools/hyper3d differs from origin/main.
