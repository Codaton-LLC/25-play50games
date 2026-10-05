import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const tool = fileURLToPath(new URL("../", import.meta.url));
const repo = path.resolve(tool, "../..");
const sample = {
   slug: "robot-collector", universe: "warehouse", seed: 5050,
   assets: [{ id: "battery", kind: "prop", mode: "text", prompt: "Toy battery", attempts: 1, target: "shared", budget: { tris: 5000, bytes: 300000 }, textureSize: 512 }]
};

test("spec defaults and rejects traversal, paid extras, duplicate IDs and invalid budgets", async () => {
   const { parseSpec } = await import("../src/spec.mjs");
   assert.equal(parseSpec(sample).assets[0].tier, "Gen-2.5-Low");
   assert.equal(parseSpec(sample).assets[0].qualityOverride, 2500);
   for (const mutate of [
      s => { s.slug = "../escape"; },
      s => { s.seed = 65536; },
      s => { s.assets[0].addons = ["HighPack"]; },
      s => { s.assets[0].tier = "Gen-2.5-Extreme-High"; },
      s => { s.assets.push(s.assets[0]); },
      s => { s.assets[0].budget.bytes = 300001; },
      s => { s.assets[0].kind = "character"; },
      s => { s.assets[0].attempts = 0; }
   ]) {
      const bad = structuredClone(sample);
      mutate(bad);
      assert.throws(() => parseSpec(bad));
   }
   const { loadSpec } = await import("../src/spec.mjs");
   assert.equal((await loadSpec(repo, "shared")).assets.length, 8);
});

test("guards enforce confirmation, main checkout and two-credit reserve", async () => {
   const { requireConfirm, guardCheckout, guardBudget } = await import("../src/safety.mjs");
   assert.throws(() => requireConfirm(false), /confirm/);
   requireConfirm(true);
   assert.throws(() => guardCheckout("C:/repo/.git/worktrees/x", "C:/repo/.git", "C:/repo/.git"), /checkout/);
   assert.throws(() => guardCheckout("C:/clone/.git", "C:/clone/.git", "C:/repo/.git"), /checkout/);
   guardCheckout("C:/repo/.git", "C:/repo/.git", "C:/repo/.git");
   guardBudget(2.5, 0.5);
   assert.throws(() => guardBudget(2.49, 0.5), /reserve/);
   assert.throws(() => guardBudget(NaN, 0.5));
});

test("errors redact raw and URL-encoded credentials, bearer headers and signed links", async () => {
   const { maskError } = await import("../src/safety.mjs");
   const key = "fake+secret/key=";
   const masked = maskError(`oops ${key} ${encodeURIComponent(key)} Authorization: Bearer other-secret https://example.invalid/file?token=private`, [key]);
   for (const secret of [key, encodeURIComponent(key), "other-secret", "token=private"]) {
      assert.ok(!masked.includes(secret));
   }
});

test("mock generation and optimization use real GLBs, floor pivot, WebP and meshopt without network", async () => {
   const { run } = await import("../src/cli.mjs");
   const { createIO, inspectModel } = await import("../src/models.mjs");
   const dir = await mkdtemp(path.join(tmpdir(), "hyper3d-test-"));
   const messages = [];
   const oldFetch = globalThis.fetch;
   globalThis.fetch = () => { throw new Error("Network forbidden"); };
   try {
      const ctx = { repo, mockRoot: dir, print: line => messages.push(line) };
      await run(["gen", "shared", "--only", "battery", "--confirm", "--mock"], ctx);
      await run(["optimize", "shared", "--id", "battery", "--mock"], ctx);
      const ledger = JSON.parse(await readFile(path.join(dir, "ledger.json"), "utf8"));
      assert.equal(ledger.entries.length, 1);
      assert.equal(ledger.entries[0].consumed, 0.5);
      assert.equal(ledger.entries[0].status, "downloaded");
      const output = path.join(dir, "models/shared/battery.glb");
      const io = await createIO();
      const doc = await io.read(output);
      const report = inspectModel(doc);
      assert.equal(report.tris, 4);
      assert.ok(Math.abs(report.bounds.min[1]) < 1e-6);
      assert.ok(Math.abs(report.bounds.min[0] + report.bounds.max[0]) < 1e-6);
      assert.equal(doc.getRoot().listTextures()[0].getMimeType(), "image/webp");
      assert.ok(doc.getRoot().listExtensionsUsed().some(e => e.extensionName === "EXT_meshopt_compression"));
      assert.ok(messages.some(m => m.includes("PASS")));
      await assert.rejects(run(["gen", "shared", "--mock"], ctx), /confirm/);
      await assert.rejects(run(["optimize", "shared", "--id", "missing", "--mock"], ctx), /Unknown/);
      const { optimizeGLB, fixtureGLB } = await import("../src/models.mjs");
      await assert.rejects(optimizeGLB(await fixtureGLB(), { ...sample.assets[0], budget: { tris: 5000, bytes: 1 } }), /OVER BUDGET/);
   } finally {
      globalThis.fetch = oldFetch;
      await rm(dir, { recursive: true, force: true });
   }
});

test("CLI rejects unknown options before doing work", () => {
   assert.throws(() => execFileSync(process.execPath, [path.join(tool, "src/cli.mjs"), "gen", "shared", "--mock", "--confrim"], { stdio: "pipe" }));
});
