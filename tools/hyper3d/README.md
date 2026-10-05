# Hyper3D / Rodin asset CLI

The primary workflow is **generate through the official Rodin MCP in Claude Code,
then import + optimize here**. Import and optimization need neither an API key
nor API/Business-plan access. The legacy API `gen`, `smoke` and `budget` commands
remain available with their paid-execution guards; MCP billing is separate from
this CLI's API ledger.

Node **24**, ESM and native fetch. Install this tool independently of the frontend:

```powershell
cd tools/hyper3d
npm ci
node --test
```

Run examples below **from the repository root**. All examples use `--mock`.
Mock mode performs no network requests, reads no keys or personal ledger, does not
read concept PNGs, and never writes `public/models/3d` or the real raw directory.
It creates tiny textured GLB fixtures in code and uses the **real optimizer**.
Generated mock artifacts and its separate ledger live in ignored
`tools/hyper3d/.mock/`. No binary fixtures belong in git.

## Commands

```powershell
node tools/hyper3d/src/cli.mjs --help
node tools/hyper3d/src/cli.mjs plan shared --mock
node tools/hyper3d/src/cli.mjs plan robot-collector --mock --spec tools/hyper3d/examples/robot-collector.assets.spec.json
node tools/hyper3d/src/cli.mjs budget --mock
node tools/hyper3d/src/cli.mjs smoke --confirm --mock
node tools/hyper3d/src/cli.mjs gen shared --only battery --confirm --account lab --mock
node tools/hyper3d/src/cli.mjs gen robot-collector --confirm --mock --spec tools/hyper3d/examples/robot-collector.assets.spec.json
node tools/hyper3d/src/cli.mjs import downloaded.glb --slug shared --id battery --mock
node tools/hyper3d/src/cli.mjs import https://download.example.invalid/model.glb --slug shared --id battery --mock
node tools/hyper3d/src/cli.mjs optimize shared --id battery --mock
node tools/hyper3d/src/cli.mjs optimize --mock
```

| Command | Behavior |
| --- | --- |
| `plan <slug> [--spec <file>]` | Validate spec; print id, kind, mode, tier, attempts, each generation estimate and total. Current base estimate is 0.5 credits. Never reads keys. |
| `budget` | Show remaining lab/prod credits from GET `/check_balance`, falling back to the ledger when API access is unavailable. Print spend records. Unknown ledger balance is reported as unknown, never invented. Mock starts at lab=10/prod=45 and deducts mock records. |
| `smoke --confirm` | Exactly one low-tier, 1500-face robot generation on lab, using the shared robot concept. Check submit/status/download, actual `consumed`, acceptance of `TAPose` and `quality_override`, GLB parsing and measured triangles. Save charge before polling. Prints FBX/privacy limitations separately. Requires confirmation, including in mock mode. |
| `gen <slug> --confirm [--account lab\|prod] [--only <id>] [--spec <file>]` | Preflight concepts, check checkout and reserve, submit each attempt once, poll all jobs, download immediately, validate GLB and append/update ledger. Default account: robot-collector=lab, otherwise prod. Real output: `tools/hyper3d/raw/<slug>/<id>-<n>.glb`. Attempts on each invocation are additional attempts; numbering never overwrites existing files. |
| `import <file\|https-url> --slug <slug> --id <id> [--spec <file>]` | Copy a local GLB or download an HTTPS artifact from Rodin MCP/web UI, save the next raw attempt exclusively without overwriting, then validate. No API or key access. Invalid input remains in raw for inspection, with a failure naming that attempt; it cannot be optimized. URLs and redirects must stay HTTPS (at most five redirects), without embedded credentials or forwarded authorization. In mock mode neither the file nor URL is read; a fixture is generated instead. |
| `optimize <slug> [--id <id>] [--spec <file>]` | Read the highest numbered raw attempt, resize/compress textures to WebP, center the floor pivot once, apply meshopt compression and inspect decoded output. Unrigged models are welded and simplified as needed; rigged models preserve geometry. Write `play50games-frontend/public/models/3d/<target>/<id>.glb` only after it passes caps and the floor assertion. Real mode requires a slug and existing raw file. `optimize --mock` defaults to shared and synthesizes missing inputs. |

All commands accept `--mock` and `--help`. Unknown/misplaced options fail.
An explicit `--spec` resolves against the repo root, even when launched from the
tool folder. An import filename resolves against the current working directory.
Blender `convert` / `merge-clips` are optional and are **not implemented** here.

## Assets specification

Default input is
`play50games-frontend/src/arcade3d/games/<slug>/assets.spec.json`, or
`play50games-frontend/src/arcade3d/assets/shared.spec.json` for `shared`.
The JSON Schema is [assets.schema.json](assets.schema.json), validated at runtime
with Ajv, plus semantic checks for unique IDs and matching targets/command slug.
See [robot-collector example](examples/robot-collector.assets.spec.json).

| Field | Contract |
| --- | --- |
| `slug` | Lowercase letters/digits with optional interior hyphens; matches CLI slug. |
| `universe` | Nonempty universe/style name; metadata only. |
| `seed` | Required integer 0–65535, explicitly sent for every attempt. |
| `assets` | Nonempty array. Unknown properties, including paid add-ons, are rejected. |
| `id` | Case-insensitively unique letters/digits/interior hyphens. `battery` and `BATTERY` collide. CamelCase shared IDs such as `tinCan` work. No traversal or Windows reserved names. |
| `kind`, `mode` | `character` requires `image`; `prop` requires `text`. |
| `rigged` | Optional boolean. `true` skips weld and simplify even when there is no skin. A GLB with any skin is always treated as rigged, including when this field is false or omitted. |
| `prompt` | Required nonempty string, maximum 1024 characters. Subject + Play50 toy-world style recommended. Retained as metadata for image mode; sent to the API only for text mode. |
| `concept` | Required for characters: `tools/hyper3d/concepts/<name>.png`. Real generation verifies PNG signature and resolved path containment; mock never reads it. |
| `tier` | Defaults: character=`Gen-2.5-Medium`, prop=`Gen-2.5-Low`. Also permits `Gen-2.5-Extreme-Low` and `Gen-2.5-High`. Refuses Extreme-High, HighPack and unknown fields. |
| `qualityOverride` | Optional integer 500–20000, default 18000 character / 2500 prop. Maps to `quality_override`; the tool deliberately keeps the Fast-mode ceiling. Existing shared 1000-face specs are accepted. |
| `attempts` | Required integer 1–100. Every attempt costs the estimate; this is not a retry count. |
| `target` | Exactly `shared` or this spec's slug. |
| `budget.tris`, `budget.bytes` | Positive integers. Maximum character: 20000 tris / 1500000 bytes; prop: 5000 / 300000. Smaller custom budgets are enforced. Byte caps are decimal, measured on final GLB. |
| `textureSize` | Required positive integer <=1024 character / <=512 prop. Preserve aspect ratio and limit both dimensions. |

Legacy API requests send GLB, Raw topology, PBR, explicit seed, and low/medium
textures (no extreme-high texture surcharge). They omit `addons` and
`geometry_instruct_mode` entirely, and omit `prompt` in image mode.
Characters send `TAPose=true`. Attempt seeds intentionally stay identical to the
universe seed for reproducibility.

## Secrets, ledger and safety

Paid execution is for **Claude/the user only after explicit batch approval**.
During development and verification, **never run smoke or gen without --mock**.
`--confirm` is mandatory for gen and smoke even in mock mode. The internal paid
generation path also checks confirmation before checkout, key or ledger access.
Real generation rejects linked worktrees and a `.git` location differing from
the configured repository root: absolute, resolved `--git-dir` must equal
`--git-common-dir` and `<repo>/.git`. Ordinary clones cannot be distinguished from
one another by these Git values; the tool anchors its repository root to its own
installed location. Do not copy the CLI into another checkout for paid work.
Mock generation skips the checkout guard and works in linked git worktrees.

Keys are read **only** from `%USERPROFILE%\.play50\hyper3d.env`, only for real API
commands. Supported names: `HYPER3D_KEY_PROD` and `HYPER3D_KEY_LAB`. The tool never
creates this file, reads repo env files, uses key environment variables, or
prints/records credentials. Both external keys are registered for masking.
API transport and JSON-parsing errors use fixed messages without body or parser
text. Other errors mask known values and URL-encoded forms, bearer
headers and signed URLs. Download requests never forward API authorization.

Ledger: `%USERPROFILE%\.play50\hyper3d-ledger.json`. The tool's version-1 format:

```json
{
   "version": 1,
   "mock": false,
   "accounts": {
      "lab": { "balance": null, "entryOffset": 0 },
      "prod": { "balance": null, "entryOffset": 0 }
   },
   "entries": []
}
```

Each account snapshot has the API remaining balance and the number of entries at
that instant (`entryOffset`). Deduct later entries for the account. A successful
live balance check before paid work persists a fresh snapshot. Entries contain
time, account, slug, id, attempt, task UUID, actual `consumed` and status; completed
entries also have the local file path. They contain no prompt, key, subscription
key, concept image or signed link. Atomic replacement and an exclusive `.lock`
protect the ledger throughout the batch. If a process dies leaving a lock,
verify that no CLI is still running and reconcile API usage before manually
removing that exact lock file. Corrupt/incompatible ledgers fail closed.

Paid gen requires a live balance check, sufficient reserve for the whole batch,
and another check before each attempt. Estimate uses the greater of 0.5 and the
account's maximum recorded consumption. It refuses to leave less than **2
credits**. API balance is a snapshot, not a reservation against other clients.
Submission requests are never retried. Ambiguous submission failures are marked
`uncertain` with a conservative estimate and require manual reconciliation before
more paid work. Accepted submissions record the actual charge before polling;
failed generation/download keeps that charge. Polling has a 20-minute deadline,
5–30-second backoff and bounded `Retry-After` handling. Downloads refresh the
signed-link list and retry once without generating again.

## Optimizer limits and review

Only self-contained GLB v2 with triangle primitives is accepted. External buffers
or textures are rejected, so local optimization cannot fetch remote resources.
Meshopt input/output is supported; Draco input requires prior conversion outside
this tool. Rigged detection uses `listSkins().length > 0` or spec `rigged: true`.
Rigged meshes skip weld and simplify entirely; excessive triangles fail with
`OVER BUDGET`. Byte and texture caps still apply.

Unrigged models above the triangle cap try simplify error tolerances 0.001,
0.005, 0.01, 0.02, then 0.05. Each attempt starts from the same welded geometry;
the first result within budget is kept and its error is reported. If 0.05 still
exceeds the cap, optimization fails with `OVER BUDGET`. Models already within
budget report `simplify error=not needed`. Existing optimized output is retained
on failure.

Pivot centering runs once before compression. Positions stay floating point;
other attributes are quantized and meshopt-compressed. This avoids changing the
skin's position coordinate system and then shifting it a second time. Decoded
scene bounds must have min Y equal to zero within floating-point tolerance
(1e-6). Animated/skinned motion bounds and visual quality require Claude's review.
Optimization selects the latest attempt; to
choose an earlier result, import that GLB as a new attempt first.

## API evidence and open checks

Field names and request defaults are centralized in `src/config.mjs` so a lab
smoke can correct them without scattering wire strings through the tool.
Official docs checked on **2026-10-05**:

- [Rodin Gen-2.5](https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5):
  multipart `images`, `TAPose`, `quality_override`, `geometry_file_format`,
  0.5-credit base; successful acceptance requires no `error` and a task UUID.
- [Check Status](https://docs.hyper3d.ai/en/api-specification/check-status):
  POST `subscription_key` from `jobs.subscription_key`; wait until all jobs Done.
- [Download Results](https://docs.hyper3d.ai/en/api-specification/download-results):
  POST `task_uuid` from top-level UUID; `list` of name/url pairs, expiring links.
- [Check Balance](https://docs.hyper3d.ai/en/api-specification/check-balance):
  GET `/check_balance`, numeric `balance`.
- [API data policy](https://docs.hyper3d.ai/en/legal/data-retention-policy):
  API output is not publicly published or used for training; active retention is
  seven days. The generation schema exposes no privacy switch.

Mock smoke validates the pipeline, **not live access or billing**. Paid lab smoke
must still confirm account API entitlement, actual consumed and visual T-pose.
FBX is documented as an alternative single `geometry_file_format`; a GLB request
does not establish FBX delivery. The smoke reports FBX as **not tested**, avoiding
a second unapproved generation. Ask Hyper3D whether one task can deliver both
formats without another charge, and whether any account-level privacy setting
must be inspected outside the API. No network or paid smoke was run for this PR.

## Verification

`node --test` covers spec parsing, unsafe paths/paid tiers, confirmation, worktree
and reserve guards, redaction, API contract/error paths, expiring-download retry,
ledger locking/persistence, local/HTTPS imports including concurrent numbering,
rig/seam/weight preservation, curved-mesh simplification, and mock gen → real
optimization with WebP, meshopt and floor-pivot checks. Run it in both the main
checkout and a linked worktree. Tests use temporary directories and fake transport;
they never read a real key or call Hyper3D. Frontend build and Vitest are separate
required integration checks; this tool has its own package and lockfile.
