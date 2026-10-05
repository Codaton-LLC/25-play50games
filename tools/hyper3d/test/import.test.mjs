import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run, generate } from "../src/cli.mjs";
import { fixtureGLB } from "../src/models.mjs";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const spec = path.join(repo, "play50games-frontend/src/arcade3d/assets/shared.spec.json");

test("paid generate rejects missing confirmation before checkout, keys or transport", async () => {
   await assert.rejects(generate({ mock: false, confirm: false, repo: "does-not-exist" }, {}, [], "lab"), /confirm/);
});

test("imports copy local GLB or HTTPS download to unique raw files, then validate", async () => {
   const dir = await mkdtemp(path.join(tmpdir(), "hyper3d-import-"));
   const oldFetch = globalThis.fetch;
   const calls = [];
   try {
      const bytes = await fixtureGLB();
      const source = path.join(dir, "input.glb");
      await writeFile(source, bytes);
      globalThis.fetch = async (url, init) => {
         calls.push([url, init]);
         return new Response(bytes);
      };
      const args = ["--slug", "shared", "--id", "battery", "--spec", spec];
      const ctx = { repo: dir, print: () => {} };
      await run(["import", source, ...args], ctx);
      await run(["import", "https://download.invalid/model.glb?signature=private", ...args], ctx);
      await Promise.all([run(["import", source, ...args], ctx), run(["import", source, ...args], ctx)]);
      const raw = path.join(dir, "tools/hyper3d/raw/shared");
      assert.deepEqual((await readdir(raw)).sort(), ["battery-1.glb", "battery-2.glb", "battery-3.glb", "battery-4.glb"]);
      assert.deepEqual(await readFile(path.join(raw, "battery-1.glb")), Buffer.from(bytes));
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1].headers?.Authorization, undefined);
      await assert.rejects(run(["import", "http://download.invalid/model.glb", ...args], ctx), /HTTPS/);
      await writeFile(source, "invalid model");
      await assert.rejects(run(["import", source, ...args], ctx), /GLB/);
      assert.equal(await readFile(path.join(raw, "battery-5.glb"), "utf8"), "invalid model");
      globalThis.fetch = async () => new Response(null, { status: 302, headers: { Location: "http://download.invalid/model.glb" } });
      await assert.rejects(run(["import", "https://download.invalid/model.glb", ...args], ctx), /HTTPS/);
   } finally {
      globalThis.fetch = oldFetch;
      await rm(dir, { recursive: true, force: true });
   }
});
