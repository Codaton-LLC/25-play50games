// Sandbox fallback: uses the installed TypeScript compiler, without esbuild or a browser.
// Run from play50games-frontend: node src/arcade3d/games/zipline-rush/verify.cjs
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const Module = require("node:module");
const ts = require("typescript");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (id, parent, ...rest) {
   if (id.startsWith("@/")) id = path.resolve("src", id.slice(2));
   return resolve.call(this, id, parent, ...rest);
};
require.extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, "utf8"), {
   compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, file);
const { createRun, step, maxScoreFor, limitsFor, landingZone, targetSpeed, idleInput } = require("./rules.ts");
const { botInput } = require("./bot.ts");
const { createArcadeStore } = require("../../core/useArcadeStore.ts");
const { withinServerLimits } = require("../../core/limits.ts");
const { serverSyncProblems } = require("../../levelSync.ts");
const { ziplineRushMeta } = require("./meta.ts");
const { createMultiRun, stepMulti } = require("./multiplayer.ts");
const { levelEndStats } = require("./levelEnd.ts");
const { memoryProgressStorage } = require("../../menu2/progress/progressStore.ts");
const { ASSETS } = require("./assets.ts");
const { MODEL_MANIFEST } = require("../../core/modelManifest.ts");
const heroes = ["riko", "nami", "kiro", "zuno", "vexa"];
assert.deepEqual([3, 5, 7, 9, 12].map(landingZone), ["short", "edge", "centre", "edge", "over"]);
assert.equal(targetSpeed(10, 1), 14);
assert.equal(targetSpeed(10, -1), 4);
assert.deepEqual([1, 2, 3, 4, 5].map(maxScoreFor), [1460, 1780, 2100, 2420, 3990]);
const backend = JSON.parse(fs.readFileSync("../play50games-backend/play50games/includes/arcade-games.json", "utf8"));
assert.deepEqual(serverSyncProblems(ziplineRushMeta, backend.games["zipline-rush"]), []);
for (const asset of Object.values(ASSETS)) {
   assert.ok(MODEL_MANIFEST.includes(asset.url)); assert.ok(!/ninja|turtle|shell/i.test(asset.url));
   const data = fs.readFileSync(path.resolve("public", asset.url.slice(1)));
   const glb = JSON.parse(data.subarray(20, 20 + data.readUInt32LE(12)).toString());
   const tris = glb.meshes.reduce((sum, mesh) => sum + mesh.primitives.reduce((n, p) => n + glb.accessors[p.indices].count / 3, 0), 0);
   assert.ok(data.length <= asset.budget.bytes, `${asset.id} byte budget`);
   assert.ok(tris <= asset.budget.tris, `${asset.id} triangle budget`);
}
let count = 0;
for (let id = 1; id <= 5; id++) {
   const times = [];
   for (const hero of heroes) for (const fps of [30, 60, 144]) {
      const r = createRun(id, hero), store = createArcadeStore();
      store.getState().configure({ durationMs: null }); store.getState().markReady(); store.getState().start();
      for (let frame = 0; frame < 60000 && store.getState().phase !== "over"; frame++) {
         store.getState().tick(1000 / fps);
         if (store.getState().phase !== "playing") continue;
         step(r, store.getState().frameMs, botInput(r));
         store.getState().setScore(r.score);
         assert.ok(r.score <= maxScoreFor(id));
         if (r.ended) store.getState().end(r.ended);
      }
      assert.equal(store.getState().endReason, "win", `L${id}/${hero}/${fps}`);
      assert.ok(withinServerLimits(store.getState().score, store.getState().elapsedMs, limitsFor(id)));
      if (r.boss) { assert.equal(r.boss.hits, 5); assert.equal(r.boss.hp, 0); assert.equal(r.boss.phase, 2); }
      const storage = memoryProgressStorage();
      const first = levelEndStats(r, null, storage), repeat = levelEndStats(r, null, storage);
      assert.ok(first.stars & 1); assert.ok(first.xp > 0); assert.equal(repeat.xp, 0);
      times.push(Math.round(r.finishMs)); count++;
   }
   console.log(`L${id}: 15/15 store runs clear; ${Math.min(...times)}–${Math.max(...times)} ms; ceiling ${maxScoreFor(id)}`);
   for (let seed = 1; seed <= 12; seed++) {
      let n = seed; const random = () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; };
      const r = createRun(id, heroes[seed % 5]);
      for (let f = 0; f < 25000 && !r.ended; f++) {
         step(r, 8 + random() * 40, { x: random() * 2 - 1, throttle: random() * 2 - 1, yaw: random() * 6.28, jump: random() < 0.15, power: true });
         assert.ok(r.score <= maxScoreFor(id)); assert.ok(r.combo.events <= r.cfg.sections * 5);
      }
   }
}
for (const mode of ["coop", "versus"]) for (const n of [2, 4]) {
   const g = createMultiRun(1, heroes.slice(0, n), mode);
   for (let f = 0; f < 12000 && !g.ended; f++) stepMulti(g, 1000 / 60, g.runs.map(botInput));
   assert.equal(g.ended, "win"); assert.ok(g.runs.every((r) => r.ended === "win"));
}
const invalid = createRun(1), before = JSON.stringify(invalid);
step(invalid, Number.NaN, idleInput()); step(invalid, -1, idleInput()); assert.equal(JSON.stringify(invalid), before);
console.log(`${count} real-store wins, 60 random power-spam runs, 4 multiplayer runs, progress idempotence and backend sync passed.`);
for (const hero of ["nami", "riko"]) {
   const r = createRun(2, hero); let jumped = false, reached = false;
   for (let f = 0; f < 5000 && !r.ended; f++) {
      const i = botInput(r);
      if (r.section === 1 && r.t > 0.35 && r.t < 0.4 && !jumped && r.mode === "ride") { i.jump = true; jumped = true; }
      if (jumped && r.mode === "air" && r.airMs > 75 && r.airMs < 110) { i.power = true; i.x = hero === "riko" ? 1 : 0; }
      step(r, 1000 / 60, i); if (r.lane === (hero === "nami" ? 2 : 3)) reached = true;
   }
   assert.ok(reached, `${hero} reaches its real bonus cable`); assert.equal(r.secrets.found[2], 1);
}
const phase = createRun(2, "vexa"); phase.section = 1; phase.mode = "ride"; phase.t = 0.4;
step(phase, 17, { ...idleInput(), power: true }); assert.equal(phase.lane, 4); assert.equal(phase.secrets.found[1], 1);
const shield = createRun(4, "kiro"), plain = createRun(4, "nami");
for (const r of [shield, plain]) { r.section = 1; r.mode = "ride"; r.t = 0.36; r.lane = 0; }
step(shield, 17, { ...idleInput(), power: true }); step(plain, 17, idleInput()); assert.equal(shield.hits, 0); assert.equal(plain.hits, 1);
const magnet = createRun(2, "zuno"), noMagnet = createRun(2, "nami");
for (const r of [magnet, noMagnet]) { r.mode = "ride"; r.t = 0.54; r.lane = 0; }
step(magnet, 17, { ...idleInput(), power: true }); step(noMagnet, 17, idleInput()); assert.equal(magnet.collected[2], 1); assert.equal(noMagnet.collected[2], 0);
console.log("All five physical hero roles and every referenced GLB's manifest / triangle / byte budget passed.");
