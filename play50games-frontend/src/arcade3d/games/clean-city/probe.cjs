const ts = require("typescript");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const original = Module._resolveFilename;
Module._resolveFilename = function (request, parent, ...rest) {
   if (request.startsWith("@/")) request = path.resolve(process.cwd(), "src", request.slice(2));
   return original.call(this, request, parent, ...rest);
};
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText, filename);
const assert = require("node:assert/strict");
const { createRun, step, finalRunScore, withinServerLimits, capScore, isValidLayout, generateLayout, PROPOSED_LEVEL_LIMITS } = require("./rules.ts");
const { collectorBot } = require("./levelBots.ts");
const { LEVELS } = require("./levels.ts");
const { cleanCityMeta } = require("./meta.ts");
const { createArcadeStore } = require("../../core/useArcadeStore.ts");
const { advanceRunClock, playedFrameDt } = require("../../core/frameLoop.ts");
const seeds = Number(process.argv[2] || 200);
const began = Date.now();
const report = [];
function play(id, seed, kind, hz, realStore = false) {
   const run = createRun(seed, LEVELS[id]), limits = PROPOSED_LEVEL_LIMITS[id];
   const bot = collectorBot(kind === "human"), store = realStore ? createArcadeStore() : null;
   const input = { moveX: 0, moveY: 0 }, idle = { moveX: 0, moveY: 0 };
   if (store) { store.getState().configure({ durationMs: run.level.durationMs }); store.getState().markReady(); store.getState().start(); }
   let frames = 0, paused = false, resumed = false, pausedAt = 0;
   const refs = [run.events, run.litter, run.runner, ...run.litter];
   while (store ? store.getState().phase !== "over" : !run.ended) {
      if (frames++ > 100000) throw new Error("frame guard");
      if (store && seed === 0 && !paused && run.simMs > 1000) {
         store.getState().pause(); pausedAt = store.getState().elapsedMs; paused = true;
      } else if (store && paused && !resumed) {
         assert.equal(store.getState().elapsedMs, pausedAt);
         assert.equal(playedFrameDt(store.getState()), 0);
         store.getState().resume(); resumed = true;
      }
      if (store) advanceRunClock(store, 1 / hz);
      const dt = store ? playedFrameDt(store.getState()) : 1 / hz;
      if (!dt) continue;
      let move = idle;
      if (kind === "oracle" || kind === "human") {
         try { move = bot(run); } catch (e) { throw new Error(`L${id} seed${seed} ${kind}/${hz}, map${run.map}, runner${run.runner.x},${run.runner.z}: ${e.message}`); }
      }
      else if (kind === "greedy") {
         let d = Infinity;
         for (const slot of run.litter) if (slot.active) {
            const next = Math.hypot(slot.x - run.runner.x, slot.z - run.runner.z);
            if (next < d) { d = next; input.moveX = slot.x - run.runner.x; input.moveY = slot.z - run.runner.z; }
         }
         move = input;
      } else if (kind === "spam") {
         input.moveX = frames % 11 === 0 ? NaN : 100 * Math.sin(frames * 0.017);
         input.moveY = frames % 13 === 0 ? Infinity : 100 * Math.cos(frames * 0.019); move = input;
      }
      const x = run.runner.x, z = run.runner.z;
      const ev = step(run, dt * 1000, move);
      if (store) {
         const state = store.getState();
         if (ev.collected !== -1) state.setScore(run.score);
         if (ev.ended === "win") { state.setScore(finalRunScore(run, state.timeLeftMs ?? 0)); state.end("win"); }
      }
      const elapsedMs = store ? store.getState().elapsedMs : run.simMs;
      const score = store ? store.getState().score : run.score;
      if (score > limits.maxScore || score * 1000 > limits.base * 1000 + limits.maxPointsPerSec * elapsedMs + 1e-6) throw new Error(`L${id} seed${seed} ${kind} score bound at ${elapsedMs}`);
      if (ev.nextMap === -1 && Math.hypot(run.runner.x - x, run.runner.z - z) > 5 * run.stepMs / 1000 + 1e-8) throw new Error("speed bound");
      if (Math.abs(run.runner.x) > 13.5 + 1e-8 || Math.abs(run.runner.z) > 13.5 + 1e-8) throw new Error("floor bound");
      if (store && (run.simMs > elapsedMs + 1e-6 || elapsedMs - run.simMs >= 1.001)) throw new Error("clock parity");
   }
   const state = store ? store.getState() : { score: run.score, elapsedMs: run.simMs, endReason: run.ended };
   assert.ok(withinServerLimits(state.score, state.elapsedMs, limits), `L${id}/${seed}/${kind}/${hz}: final limits`);
   assert.equal(capScore(state.score, state.elapsedMs, limits), state.score);
   assert.equal(run.events, refs[0]); assert.equal(run.litter, refs[1]); assert.equal(run.runner, refs[2]);
   for (let i = 0; i < run.litter.length; i++) assert.equal(run.litter[i], refs[i + 3]);
   return { run, state };
}
// argv[3]: optional comma list of levels (the test runs one process per level, in parallel)
const only = process.argv[3] ? process.argv[3].split(",").map(Number) : [1, 2, 3, 4, 5];
for (const id of only) {
   let wins = 0, clears = 0, best = 0, honestBest = 0, slowest = 0, maxPasses = 0, runs = 0;
   for (let seed = 0; seed < seeds; seed++) {
      for (const [kind, hz] of [["oracle", [30, 60, 144][seed % 3]], ["human", [30, 60, 144][seed % 3]], ["greedy", 20], ["spam", 20], ["idle", 20]]) {
         const { run, state } = play(id, seed, kind, hz); runs++;
         if (kind === "oracle") {
            best = Math.max(best, state.score);
            for (let map = 0; map < 3; map++) {
               assert.ok(isValidLayout(run.layouts[map], run.caches[map], LEVELS[id]), `L${id} seed${seed} map${map}: layout`);
               assert.deepEqual(run.layouts[map], generateLayout(seed, map, run.caches[map], LEVELS[id]));
               maxPasses = Math.max(maxPasses, run.layouts[map].passes);
            }
         }
         if (kind === "human") {
            if (state.endReason === "win") wins++;
            if (state.score >= cleanCityMeta.levels[id - 1].clearScore) clears++;
            honestBest = Math.max(honestBest, state.score); slowest = Math.max(slowest, state.elapsedMs);
         }
         if (kind === "idle") assert.equal(state.score, 0);
      }
   }
   assert.ok(wins / seeds >= 0.9, `L${id}: honest wins ${wins}/${seeds}`);
   assert.ok(clears / seeds >= 0.9, `L${id}: honest clears ${clears}/${seeds}`);
   assert.ok(best >= PROPOSED_LEVEL_LIMITS[id].maxScore * 0.9, `L${id}: oracle ${best} < 90% of ${PROPOSED_LEVEL_LIMITS[id].maxScore}`);
   let storeRuns = 0;
   for (const kind of ["oracle", "human", "greedy", "spam", "idle"]) for (const hz of [30, 60, 144]) {
      play(id, 0, kind, hz, true); storeRuns++;
   }
   if (process.env.CLEAN_CITY_PROGRESS) console.error(`L${id}: ${Date.now() - began}ms`);
   report.push({ id, seeds, runs, storeRuns, humanRuns: seeds, wins, clears, best, honestBest, slowest, maxPasses });
}
process.stdout.write(JSON.stringify({ levels: report, runtimeMs: Date.now() - began }) + "\n");
