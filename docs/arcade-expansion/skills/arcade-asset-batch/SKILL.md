---
name: arcade-asset-batch
description: Run one approved Hyper3D (Rodin) asset batch for the 3D Arcade through the Rodin MCP on the user's PC: concepts, generation, review, download, import, optimize, manifest. Claude only, local Claude Code only, and only after the user wrote "po, gjenero batch <N>". Use when the user approves an asset batch or asks to generate models.
---

# Arcade asset batch (Claude, local)

## Hard rules
- No generation without the user's approval of this batch in chat; no download without the user's "ok" on each result; never show the signed `files[].url` (show `display_url`).
- Gen-2.5-Medium only; never HighPack, never Extreme-High.
- Concept images that show a real face (the user's) never enter git: they stay in `%USERPROFILE%\.play50\concepts\`.
- Raw files stay in the scratchpad or `tools/hyper3d/raw/` (gitignored).

## Inputs
`docs/arcade-expansion/05-hyper3d-catalog.md`: §E.2 (what to validate), §E.3 (workflow), §E.5 (each asset's prompt, settings, fit and checks), §E.6 (the batch table); approved concept images in `%USERPROFILE%\.play50\concepts\expansion\<id>.png` (names in `docs/arcade-expansion/11-chatgpt-concept-prompts.md`); the dashboard balance the user reported.

## Steps
1. Show the batch table (asset, mode, settings, expected credits incl. reserve) and the balance; stop if the balance does not cover it.
2. For each asset, in table order:
   1. image mode: `rodin_create_uploads`, HTTP PUT the concept;
   2. `rodin_generate` with the exact prompt from §E.5, tier Gen-2.5-Medium, `quality_override` from the entry;
   3. `rodin_wait`, `rodin_get_result`; show the `display_url`; wait for the user's verdict;
   4. on "ok": download `base_basic_pbr.glb` to the scratchpad; on "no": one retry with a prompt fix you explain, **only while the batch's approved reserve lasts** (05 §E.6: 3 / 2 / 2); any retry beyond the reserve, or a second retry of one asset, needs a new "po" from the user;
   5. append the ledger (`%USERPROFILE%\.play50\hyper3d-ledger.json`): time, asset, task id, attempt, credits shown.
3. For each accepted file: `node tools/hyper3d/src/cli.mjs import <file> --slug <shared|slug> --id <id>` → `optimize <slug> --id <id>` (must pass budget) → add the url to `core/modelManifest.ts` in an "expansion batch <N>" block → continue with skill `arcade-model-adopt`.
4. Commit GLBs + manifest lines (+ face-free concepts to `tools/hyper3d/concepts/<slug>-<id>.webp`) on `claude/assets-batch-<N>`.

## Outputs
GLBs in `public/models/3d/<shared|slug>/`, manifest lines, ledger entries, a batch report (asset, attempts, credits, verdict, measured bounds).

## Validation checklist
- [ ] `modelManifest.test.ts` passes (list = folder).
- [ ] Each GLB within budget (props ≤ 5k tris / 300 KB, characters ≤ 20k / 1.5 MB; goblin ≤ 4.5k).
- [ ] Moving parts were left out as the catalog says (windmill blades, drone rotors, flames, liquids).
- [ ] Humanoids: arms level in the T (≤ ~15° off), facing +z, centred.
- [ ] Credits used ≤ the batch estimate; the user saw every result.

## Reuse
Batches 1–4 of the expansion and any later asset request.
