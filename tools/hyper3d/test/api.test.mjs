import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("API submits documented fields and refreshes an expired download exactly once", async () => {
   const { RodinClient } = await import("../src/api.mjs");
   const asset = { kind: "character", mode: "image", prompt: "Robot", tier: "Gen-2.5-Medium", qualityOverride: 18000 };
   const calls = [];
   let downloads = 0;
   const client = new RodinClient("synthetic-key", async (url, init) => {
      calls.push([url, init]);
      if (url.endsWith("/rodin")) {
         assert.equal(init.body.get("TAPose"), "true");
         assert.equal(init.body.get("quality_override"), "18000");
         assert.equal(init.body.get("geometry_file_format"), "glb");
         assert.equal(init.body.has("geometry_instruct_mode"), false);
         assert.equal(init.body.has("addons"), false);
         assert.equal(init.body.has("prompt"), false);
         assert.equal(init.body.get("seed"), "5050");
         assert.ok(init.body.get("images") instanceof Blob);
         return Response.json({ uuid: "task-1", jobs: { subscription_key: "sub-1", uuids: ["job-1"] }, consumed: 0.5 }, { status: 201 });
      }
      if (url.endsWith("/status")) {
         assert.deepEqual(JSON.parse(init.body), { subscription_key: "sub-1" });
         return Response.json({ jobs: [{ uuid: "job-1", status: "Done" }] }, { status: 201 });
      }
      if (url.endsWith("/download")) {
         assert.deepEqual(JSON.parse(init.body), { task_uuid: "task-1" });
         downloads++;
         return Response.json({ list: [{ name: "model.glb", url: `https://signed.invalid/${downloads}` }] }, { status: 201 });
      }
      assert.equal(init.headers?.Authorization, undefined);
      return url.endsWith("/1") ? new Response("expired", { status: 403 }) : new Response(new Uint8Array([1, 2, 3]));
   }, async () => {});
   const result = await client.submit(asset, 5050, new Uint8Array([1]));
   await client.poll(result.jobs.subscription_key);
   assert.deepEqual([...await client.download(result.uuid)], [1, 2, 3]);
   assert.equal(downloads, 2);
   assert.equal(calls.filter(([u]) => u.endsWith("/rodin")).length, 1);
});

test("API never exposes invalid JSON or transport response text", async () => {
   const { RodinClient } = await import("../src/api.mjs");
   const marker = "private-response-fragment";
   const invalid = new RodinClient("synthetic", async () => new Response(marker));
   await assert.rejects(invalid.balance(), { message: "Rodin balance: invalid JSON response" });
   const failed = new RodinClient("synthetic", async () => { throw new Error(marker); });
   await assert.rejects(failed.balance(), { message: "Rodin balance: request failed" });
});

test("API rejects semantic errors, missing spend, failed jobs and empty jobs", async () => {
   const { RodinClient } = await import("../src/api.mjs");
   const asset = { kind: "prop", mode: "text", prompt: "Battery", tier: "Gen-2.5-Low", qualityOverride: 1500 };
   for (const response of [
      { error: "NO_SUCH_TASK", uuid: "x", consumed: 0.5 },
      { uuid: "x", jobs: { subscription_key: "s" } },
      { uuid: "x", consumed: -1, jobs: { subscription_key: "s" } }
   ]) {
      const client = new RodinClient("synthetic", async () => Response.json(response));
      await assert.rejects(client.submit(asset, 10));
   }
   for (const jobs of [[], [{ status: "Failed" }], [{ status: "Unexpected" }]]) {
      const client = new RodinClient("synthetic", async () => Response.json({ jobs }), async () => {});
      await assert.rejects(client.poll("s"));
   }
});

test("ledger persists real consumption before download failure and fails closed on corruption", async () => {
   const { Ledger } = await import("../src/ledger.mjs");
   const dir = await mkdtemp(path.join(tmpdir(), "hyper3d-ledger-"));
   try {
      const file = path.join(dir, "ledger.json");
      const ledger = new Ledger(file, true);
      await ledger.lock(async () => {
         await ledger.load();
         await ledger.append({ account: "lab", task: "task-1", consumed: 1, slug: "shared", id: "battery", attempt: 1, status: "submitted" });
         assert.equal(ledger.remaining("lab"), 9);
         await assert.rejects(new Ledger(file, true).lock(async () => {}), /locked/);
      });
      const reopened = new Ledger(file, true);
      await reopened.load();
      assert.equal(reopened.remaining("lab"), 9);
      assert.equal(JSON.parse(await readFile(file, "utf8")).entries[0].status, "submitted");
      await writeFile(file, "{bad-json");
      await assert.rejects(new Ledger(file, true).load(), /safely/);
   } finally {
      await rm(dir, { recursive: true, force: true });
   }
});

test("uncertain submissions block further paid work until reconciled", async () => {
   const { Ledger } = await import("../src/ledger.mjs");
   const ledger = new Ledger("unused", false);
   ledger.data.entries.push({ account: "lab", consumed: 0.5, status: "uncertain" });
   assert.throws(() => ledger.requireReconciled("lab"), /reconcile/);
   ledger.requireReconciled("prod");
});
