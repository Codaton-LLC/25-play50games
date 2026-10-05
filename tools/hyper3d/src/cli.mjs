import { parseArgs } from "node:util";
import { mkdir, readFile, readdir, writeFile, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { API, generationFields } from "./config.mjs";
import { estimate, identifier, loadSpec, selectAssets } from "./spec.mjs";
import { guardBudget, maskError, personalDirectory, readKey, requireConfirm, requireMainCheckout } from "./safety.mjs";
import { Ledger } from "./ledger.mjs";
import { MockClient, RodinClient } from "./api.mjs";
import { createIO, fixtureGLB, fixturePNG, inspectModel, optimizeGLB, readGLB, validateFile } from "./models.mjs";

const toolRoot = fileURLToPath(new URL("../", import.meta.url));
const defaultRepo = path.resolve(toolRoot, "../..");
const help = `Hyper3D CLI (Node 24)
node tools/hyper3d/src/cli.mjs <command> [options]
plan <slug> [--spec <file>] [--mock]
budget [--mock]
smoke --confirm [--mock]
gen <slug> --confirm [--account lab|prod] [--only <id>] [--spec <file>] [--mock]
import <file|https-url> --slug <slug> --id <id> [--spec <file>] [--mock]
optimize <slug> [--id <id>] [--spec <file>] [--mock]
optimize --mock defaults to shared and synthesizes missing fixture input.
Mock commands make no network calls and never read personal keys or ledger.
Import + optimize Rodin MCP output; legacy paid API commands require explicit approval.`;

const allowed = {
   plan: ["spec", "mock", "help"], budget: ["mock", "help"], smoke: ["confirm", "mock", "help"],
   gen: ["confirm", "account", "only", "spec", "mock", "help"],
   import: ["slug", "id", "spec", "mock", "help"], optimize: ["id", "spec", "mock", "help"]
};

async function filesFor(rawRoot, slug, id) {
   let files;
   try { files = await readdir(path.join(rawRoot, slug)); } catch (e) { if (e.code === "ENOENT") { return []; } throw e; }
   const pattern = new RegExp(`^${id}-(\\d+)\\.glb$`);
   return files.map(file => ({ file, n: Number(pattern.exec(file)?.[1] ?? 0) })).filter(item => item.n > 0).sort((a, b) => a.n - b.n);
}

async function saveRaw(rawRoot, slug, id, bytes, n) {
   const dir = path.join(rawRoot, slug);
   await mkdir(dir, { recursive: true });
   const file = path.join(dir, `${id}-${n}.glb`);
   await writeFile(file, bytes, { flag: "wx" });
   return file;
}

async function saveNextRaw(rawRoot, slug, id, bytes) {
   let n = Math.max(0, ...(await filesFor(rawRoot, slug, id)).map(f => f.n)) + 1;
   for (;;) {
      try { return { file: await saveRaw(rawRoot, slug, id, bytes, n), n }; }
      catch (error) { if (error.code !== "EEXIST") { throw error; } n++; }
   }
}

async function importBytes(source) {
   if (!/^[a-z][a-z\d+.-]*:\/\//i.test(source)) { return readFile(path.resolve(source)); }
   let url;
   try { url = new URL(source); } catch { throw new Error("Invalid import URL"); }
   for (let redirects = 0; redirects <= 5; redirects++) {
      if (url.protocol !== "https:" || url.username || url.password) { throw new Error("Import requires an HTTPS URL without embedded credentials"); }
      let response;
      try { response = await fetch(url.href, { redirect: "manual", signal: AbortSignal.timeout(API.timeoutMs) }); }
      catch { throw new Error("Import download failed"); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
         const location = response.headers.get("Location");
         if (!location) { throw new Error("Import redirect has no location"); }
         try { url = new URL(location, url); } catch { throw new Error("Invalid import redirect"); }
         continue;
      }
      if (!response.ok) { throw new Error(`Import download: HTTP ${response.status}`); }
      try { return new Uint8Array(await response.arrayBuffer()); }
      catch { throw new Error("Import download failed"); }
   }
   throw new Error("Import exceeded the redirect limit");
}

async function conceptBytes(repo, asset, mock) {
   if (asset.mode !== "image") { return undefined; }
   if (mock) { return fixturePNG(); }
   const root = await realpath(path.join(repo, "tools/hyper3d/concepts"));
   const file = await realpath(path.join(repo, asset.concept));
   const relative = path.relative(root, file);
   if (relative.startsWith("..") || path.isAbsolute(relative)) { throw new Error("Concept must remain in the concepts directory"); }
   const bytes = await readFile(file);
   if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { throw new Error("Concept is not a PNG"); }
   return bytes;
}

export async function generate(ctx, spec, assets, account, smoke = false) {
   if (!ctx.mock) {
      requireConfirm(ctx.confirm);
      await requireMainCheckout(ctx.repo);
   }
   // Preflight every image before any charge or ledger update.
   const images = new Map();
   for (const asset of assets) { images.set(asset.id, await conceptBytes(ctx.repo, asset, ctx.mock)); }
   const ledger = new Ledger(ctx.ledgerFile, ctx.mock);
   return ledger.lock(async () => {
      await ledger.load();
      ledger.requireReconciled(account);
      const client = ctx.mock ? new MockClient() : new RodinClient(await readKey(account, ctx.repo));
      if (!ctx.mock) {
         // Fail closed for paid work if the live balance API is unavailable.
         await ledger.snapshot(account, await client.balance());
      }
      guardBudget(ledger.remaining(account), estimate(assets, ledger.rate(account)));
      const results = [];
      for (const asset of assets) {
         for (let attempt = 1; attempt <= asset.attempts; attempt++) {
            const n = Math.max(0, ...(await filesFor(ctx.rawRoot, spec.slug, asset.id)).map(f => f.n),
               ...ledger.data.entries.filter(e => e.slug === spec.slug && e.id === asset.id).map(e => e.attempt)) + 1;
            if (!ctx.mock) { await ledger.snapshot(account, await client.balance()); }
            guardBudget(ledger.remaining(account), ledger.rate(account));
            let submitted;
            try {
               submitted = await client.submit(asset, spec.seed, images.get(asset.id));
            } catch (error) {
               // A transport failure is ambiguous: block future paid work pending reconciliation.
               if (!ctx.mock) { await ledger.append({ account, slug: spec.slug, id: asset.id, attempt: n, consumed: ledger.rate(account), status: "uncertain", task: null }); }
               throw error;
            }
            const entry = await ledger.append({ account, slug: spec.slug, id: asset.id, attempt: n, task: submitted.uuid, consumed: submitted.consumed, status: "submitted", smoke });
            try {
               await client.poll(submitted.jobs.subscription_key);
               const bytes = await client.download(submitted.uuid);
               const model = await readGLB(await createIO(), bytes);
               inspectModel(model);
               const file = await saveRaw(ctx.rawRoot, spec.slug, asset.id, bytes, n);
               await ledger.update(entry, { status: "downloaded", file: path.relative(ctx.repo, file).replaceAll("\\", "/") });
               ctx.print(`${ctx.mock ? "MOCK " : ""}gen ${spec.slug}/${asset.id}-${n}: consumed=${submitted.consumed}; downloaded GLB`);
               results.push({ consumed: submitted.consumed, model });
               if (ledger.remaining(account) < API.reserve) { throw new Error("Actual consumed exceeded estimate; stopping below reserve"); }
            } catch (error) {
               if (ledger.data.entries[entry].status !== "downloaded") { await ledger.update(entry, { status: "failed-after-charge" }); }
               throw error;
            }
         }
      }
      return results;
   });
}

export async function run(args, overrides = {}) {
   const { values, positionals } = parseArgs({ args, allowPositionals: true, strict: true, options: {
      mock: { type: "boolean", default: false }, confirm: { type: "boolean" }, help: { type: "boolean" },
      spec: { type: "string" }, account: { type: "string" }, only: { type: "string" },
      slug: { type: "string" }, id: { type: "string" }
   } });
   const [command, argument] = positionals;
   const print = overrides.print ?? console.log;
   if (!command || values.help) { print(help); return; }
   if (!allowed[command]) { throw new Error(`Unknown command: ${command}`); }
   if (positionals.length > (["budget", "smoke"].includes(command) ? 1 : 2)) { throw new Error("Unexpected positional argument"); }
   for (const key of Object.keys(values)) {
      if (values[key] !== false && !allowed[command].includes(key)) { throw new Error(`Option --${key} is not valid for ${command}`); }
   }
   const repo = overrides.repo ?? defaultRepo;
   const mockRoot = overrides.mockRoot ?? path.join(toolRoot, ".mock");
   const ctx = {
      repo, print, mock: values.mock, confirm: values.confirm,
      rawRoot: values.mock ? path.join(mockRoot, "raw") : path.join(repo, "tools/hyper3d/raw"),
      ledgerFile: values.mock ? path.join(mockRoot, "ledger.json") : ["budget", "gen", "smoke"].includes(command) ? path.join(personalDirectory(), "hyper3d-ledger.json") : undefined,
      modelsRoot: values.mock ? path.join(mockRoot, "models") : path.join(repo, "play50games-frontend/public/models/3d")
   };
   if (command === "budget") {
      const ledger = await new Ledger(ctx.ledgerFile, ctx.mock).load();
      for (const account of ["lab", "prod"]) {
         let remaining = ledger.remaining(account);
         let source = ctx.mock ? "mock ledger" : "ledger fallback";
         if (!ctx.mock) {
            try {
               remaining = await new RodinClient(await readKey(account, repo)).balance();
               source = "API snapshot";
            } catch { source = "ledger fallback (API unavailable)"; }
         }
         print(`${account}: ${remaining === null ? "unknown" : remaining} credits remaining (${source})`);
      }
      print(`Spend ledger: ${ledger.data.entries.length} entries`);
      for (const entry of ledger.data.entries) {
         print(`${entry.time} ${entry.account} ${entry.slug}/${entry.id}-${entry.attempt} consumed=${entry.consumed} status=${entry.status}`);
      }
      return;
   }
   if (command === "smoke") {
      requireConfirm(values.confirm);
      const shared = await loadSpec(repo, "shared");
      const asset = { ...selectAssets(shared, "robot")[0], tier: "Gen-2.5-Low", qualityOverride: 1500, attempts: 1 };
      const [result] = await generate(ctx, { ...shared, slug: "smoke" }, [asset], "lab", true);
      print(`${ctx.mock ? "MOCK ONLY — " : ""}Smoke report: API submit/status/download PASS; consumed=${result.consumed}`);
      const fields = generationFields(asset, shared.seed);
      print(`TAPose casing: ${API.fields.pose}=${fields[API.fields.pose]} accepted; resulting pose requires visual review`);
      print(`quality_override=${asset.qualityOverride} accepted; measured output=${inspectModel(result.model).tris} triangles`);
      print("GLB: PASS; FBX: documented output enum, NOT TESTED (one output format per generation; no extra paid request)");
      print(`Privacy: no documented toggle; API policy says no public ASSETS or training, 7-day active retention. Account setting UNVERIFIED. ${API.privacyPolicy}`);
      return;
   }
   const slug = command === "import" ? values.slug : argument ?? (command === "optimize" && values.mock ? "shared" : undefined);
   identifier(slug, true);
   if (command === "gen") { requireConfirm(values.confirm); }
   const spec = await loadSpec(repo, slug, values.spec);
   const assets = selectAssets(spec, command === "gen" ? values.only : values.id);
   if (command === "plan") {
      print(`${ctx.mock ? "MOCK " : ""}plan ${slug} (estimate ${API.creditEstimate} credits/generation)`);
      for (const asset of assets) {
         print(`${asset.id} | ${asset.kind} | ${asset.mode} | ${asset.tier} | attempts=${asset.attempts} | estimated=${estimate([asset])} credits`);
         for (let n = 1; n <= asset.attempts; n++) { print(`  ${asset.id}-${n}: ${API.creditEstimate} credits`); }
      }
      print(`Total: ${assets.reduce((sum, a) => sum + a.attempts, 0)} generations, ${estimate(assets)} estimated credits`);
      return;
   }
   if (command === "gen") {
      const account = values.account ?? (slug === "robot-collector" ? "lab" : "prod");
      if (!["lab", "prod"].includes(account)) { throw new Error("Account must be lab or prod"); }
      return generate(ctx, spec, assets, account);
   }
   if (command === "import") {
      identifier(values.id);
      if (!argument) { throw new Error("import requires a GLB path or HTTPS URL"); }
      const bytes = ctx.mock ? await fixtureGLB() : await importBytes(argument);
      const { file, n } = await saveNextRaw(ctx.rawRoot, slug, values.id, bytes);
      try { await validateFile(file); }
      catch (error) { throw new Error(`Import ${slug}/${values.id}-${n} saved but validation failed: ${maskError(error)}`); }
      print(`${ctx.mock ? "MOCK " : ""}import ${slug}/${values.id}-${n}: saved and validated GLB; no CLI credits spent (Rodin MCP/web UI billing is separate)`);
      return;
   }
   if (command === "optimize") {
      for (const asset of assets) {
         const files = await filesFor(ctx.rawRoot, slug, asset.id);
         const latest = files.at(-1);
         const bytes = latest ? new Uint8Array(await readFile(path.join(ctx.rawRoot, slug, latest.file))) : ctx.mock ? await fixtureGLB() : undefined;
         if (!bytes) { throw new Error(`No raw GLB for ${slug}/${asset.id}; run gen or import first`); }
         const { output, report } = await optimizeGLB(bytes, asset);
         const dir = path.join(ctx.modelsRoot, asset.target);
         await mkdir(dir, { recursive: true });
         await writeFile(path.join(dir, `${asset.id}.glb`), output);
         print(`${ctx.mock ? "MOCK " : ""}optimize ${asset.target}/${asset.id}.glb: ${report.tris} tris, ${report.bytes} bytes; ${report.rigged ? "rigged: weld/simplify skipped" : `simplify error=${report.simplificationError ?? "not needed"}`}; WebP <=${asset.textureSize}px; min Y=${report.bounds.min[1]}; floor pivot; meshopt; PASS`);
      }
   }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
   run(process.argv.slice(2)).catch(error => { console.error(maskError(error)); process.exitCode = 1; });
}
