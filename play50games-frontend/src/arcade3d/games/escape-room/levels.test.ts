import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { definitionLevelProblems, levelEnvironment } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { computeTimeScore, isRankedRun } from "@/arcade3d/core/scores";
import { LEVELS } from "./levels";
import { escapeRoomMeta as meta } from "./meta";
import definition from "./index";
import { createRun, step, createStepInput, isWalkable, DOOR_POSITION, RUNNER, MIN_FINISH_MS, PROPOSED_LEVEL_LIMITS, type EscapeRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

/** Axis-route witness, real movement only. Collect in clue order, then search the decoys.
 * 200 ms reaction on every visit is the honest human-paced bot; no reaction is the oracle.
 * Uses the counted core clock: 200 seeds at 30 Hz, plus 60/144 Hz device replays.
 * The oracle knows the layout but deliberately uses human-paced movement and reactions.
 */
function play(seed: number, id: (typeof LEVEL_IDS)[number], honest: boolean, hz = 30) {
   const run = createRun(seed, LEVELS[id]);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: run.level.durationMs });
   store.getState().markReady(); store.getState().start();
   store.setState({ phase: "playing", countdownMs: 0 });
   const targets: number[] = [];
   for (const item of run.order) targets.push(run.items[item].station, run.items[item].station);
   if (id !== 1) for (const station of run.layout.stations) if (station.item < 0) targets.push(station.id);
   if (run.level.returnSwitch) targets.push(0);
   targets.push(run.stations.length);
   const input = createStepInput();
   const dt = 1000 / hz;
   let visit = 0, leg = 0, waiting = 0, inspecting = false;
   let frames = 0;
   while (!run.ended && frames++ < 40000) {
      const target = targets[visit];
      const p = target === run.stations.length ? DOOR_POSITION : run.layout.stations[target];
      input.moveX = 0; input.moveY = 0; input.actionPressed = false; input.tappedTarget = null;
      if (inspecting && run.action.kind === "none") { visit++; leg = targets[visit] === target ? 2 : 0; waiting = 0; inspecting = false; continue; }
      if (run.action.kind === "none") {
         // x=+-2.5 clears the blocked centre and the furniture on both sides.
         const corridor = p.x < 0 ? -2.5 : p.x > 0 ? 2.5 : run.player.x < 0 ? -2.5 : 2.5;
         const x = leg < 2 ? corridor : p.x;
         const z = leg === 0 ? run.player.z : p.z;
         const dx = x - run.player.x, dz = z - run.player.z;
         const distance = Math.hypot(dx, dz);
         if (distance < 0.12) {
            if (leg < 2) { leg++; continue; }
            waiting += dt;
            if (waiting >= (honest ? 200 : 0)) {
               input.actionPressed = seed % 2 === 0;
               input.tappedTarget = seed % 2 ? target : null;
               inspecting = true;
            }
         } else {
            input.moveX = dx / distance * Math.min(honest ? 0.85 : 1, distance * 3);
            input.moveY = dz / distance * Math.min(honest ? 0.85 : 1, distance * 3);
         }
      }
      advanceRunClock(store, dt / 1000);
      const active = store.getState();
      const x = run.player.x, z = run.player.z, ms = run.simMs;
      step(run, playedFrameDt(active) * 1000, input);
      if (Math.hypot(run.player.x - x, run.player.z - z) > RUNNER.speed * (run.simMs - ms) / 1000 + 1e-8) throw Error("speed limit");
      if (!isWalkable(run.layout, run.player.x, run.player.z)) throw Error("collision");
      if (run.simMs > active.elapsedMs + 1e-6) throw Error("uncounted time");
      if (run.ended) store.getState().end(run.ended);
      if (active.phase === "over" && !run.ended) throw Error("bot timed out");
   }
   return { run, elapsed: store.getState().elapsedMs };
}

function atStation(run: EscapeRun, id: number) {
   run.player.x = run.layout.stations[id].x; run.player.z = run.layout.stations[id].z;
   run.player.vx = 0; run.player.vz = 0;
}
function inspect(run: EscapeRun, id: number, tap: boolean) {
   const input = createStepInput(); input.actionPressed = !tap; input.tappedTarget = tap ? id : null;
   step(run, 1, input);
   input.actionPressed = false; input.tappedTarget = null;
   while (run.action.kind !== "none") step(run, 1, input);
}

describe("escape-room five levels", () => {
   it("matches core/meta declarations, original L1, limits and environments", () => {
      expect(levelMetaProblems(meta)).toEqual([]);
      expect(definitionLevelProblems(meta, definition)).toEqual([]);
      expect(createRun(5050, LEVELS[1])).toEqual(createRun(5050));
      expect(meta.scoring).toEqual(PROPOSED_LEVEL_LIMITS[1]);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      expect(levelEnvironment(definition, 4)?.lighting).toBe("night");
      expect(levelEnvironment(definition, 5)?.lighting).toBe("space");
      for (const id of LEVEL_IDS) {
         expect(scoringFor(meta, id)).toEqual(PROPOSED_LEVEL_LIMITS[id]);
         expect(meta.levels![id - 1].clearScore).toBeUndefined();
      }
   });
   it("keeps L1 frame-end scoring and uses exact higher-level finishing timestamps", () => {
      const store = createArcadeStore();
      store.setState({ endReason: "win", elapsedMs: 30033, stats: {} });
      expect(definition.finalScore!(store.getState()).durationMs).toBe(30033);
      store.setState({ stats: { finishMs: 30001 } });
      expect(definition.finalScore!(store.getState()).durationMs).toBe(30001);
      store.setState({ endReason: "timeup" });
      expect(definition.finalScore!(store.getState()).durationMs).toBe(30033);
   });
   it("has monotone objective, decoy, action and mechanic counts; cap stays within 3x", () => {
      for (const id of LEVEL_IDS.slice(1)) {
         const a = LEVELS[(id - 1) as 1], b = LEVELS[id];
         expect(b.items).toBeGreaterThanOrEqual(a.items);
         expect(b.containers).toBeGreaterThan(a.containers);
         expect(b.containers - b.items).toBeGreaterThanOrEqual(a.containers - a.items);
         for (const key of ["ordered", "shuffledOrder", "returnSwitch"] as const) expect(+b[key]).toBeGreaterThanOrEqual(+a[key]);
         expect(PROPOSED_LEVEL_LIMITS[id].maxScore).toBeGreaterThanOrEqual(meta.scoring.maxScore);
      }
      expect(PROPOSED_LEVEL_LIMITS[5].maxScore).toBeLessThanOrEqual(3 * meta.scoring.maxScore);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: deterministic pools, serial duration proof and unclamped time score`, () => {
         const c = LEVELS[id], l = PROPOSED_LEVEL_LIMITS[id];
         const floor = id === 1 ? MIN_FINISH_MS : c.containers * 1100 + c.items * 900 + 1800 + (c.returnSwitch ? 1100 : 0) + Math.ceil(7.2 / 2.6 * 1000);
         expect(l.minDurationMs).toBeLessThan(floor);
         if (id > 1) expect(floor - l.minDurationMs).toBeLessThan(floor * 0.05);
         expect(computeTimeScore(l, l.minDurationMs)).toBe(l.maxScore);
         for (let seed = 0; seed < 200; seed++) {
            const a = createRun(seed, c), b = createRun(seed, c);
            expect(a).toEqual(b);
            expect(a.stations).toHaveLength(c.containers);
            expect(a.items).toHaveLength(c.items);
            expect(a.items.every((item) => item.station >= 0)).toBe(true);
            expect(a.layout.stations.every((s) => isWalkable(a.layout, s.x, s.z))).toBe(true);
         }
      });
      it(`L${id}: human-paced oracle clears 200 seeds, plus 60/144 Hz keyboard/touch replays`, () => {
         const l = PROPOSED_LEVEL_LIMITS[id];
         let honestClears = 0, fastest = Infinity, slowest = 0;
         for (let seed = 0; seed < 200; seed++) {
            for (const honest of [true]) {
               const { run, elapsed } = play(seed, id, honest);
               expect(run.ended, `L${id} seed ${seed} honest=${honest}, ${run.simMs}`).toBe("win");
               expect(elapsed).toBeGreaterThanOrEqual(l.minDurationMs);
               expect(elapsed).toBeLessThan(l.maxDurationMs);
               expect(Math.floor((l.timeBaseMs - elapsed) / 10)).toBeLessThanOrEqual(l.maxScore);
               expect(isRankedRun(l, "win")).toBe(true);
               if (honest) honestClears++;
               fastest = Math.min(fastest, elapsed); slowest = Math.max(slowest, elapsed);
            }
         }
         for (const hz of [60, 144]) {
            for (const seed of [0, 1]) {
               const result = play(seed, id, true, hz);
               expect(result.run.ended).toBe("win");
               expect(result.elapsed).toBeGreaterThanOrEqual(l.minDurationMs);
               expect(result.elapsed).toBeLessThan(l.maxDurationMs);
            }
         }
         console.info(`L${id}: honest ${honestClears}/200; oracle 200/200; range ${Math.round(fastest)}-${Math.round(slowest)} ms`);
         expect(honestClears).toBeGreaterThanOrEqual(180);
      }, 55000);
      it(`L${id}: 200 seeded input mashers obey the speed and early-win guards`, () => {
         const limits = PROPOSED_LEVEL_LIMITS[id];
         for (let seed = 0; seed < 200; seed++) {
            const run = createRun(seed, LEVELS[id]);
            let random = seed + 1;
            for (let frame = 0; frame < 200; frame++) {
               random = (Math.imul(random, 1664525) + 1013904223) >>> 0;
               const x = run.player.x, z = run.player.z, ms = run.simMs;
               step(run, 50, { moveX: (random & 3) - 1, moveY: ((random >>> 2) & 3) - 1, actionPressed: true });
               if (Math.hypot(run.player.x - x, run.player.z - z) > RUNNER.speed * (run.simMs - ms) / 1000 + 1e-8) throw Error("masher speed");
               if (!isWalkable(run.layout, run.player.x, run.player.z)) throw Error("masher collision");
               if (run.ended === "win") {
                  expect(run.simMs).toBeGreaterThanOrEqual(limits.minDurationMs);
                  expect(Math.floor((limits.timeBaseMs - run.simMs) / 10)).toBeLessThanOrEqual(limits.maxScore);
               }
            }
            expect(run.ended).not.toBe("win");
         }
      });
      it(`L${id}: idle and remote input spam never clear; time-up wins ties`, () => {
         for (const spam of [false, true]) {
            const run = createRun(1, LEVELS[id]);
            run.simMs = run.level.durationMs - 50;
            step(run, 50, { moveX: 0, moveY: 0, actionPressed: spam, tappedTarget: spam ? 99 : null });
            expect(run.ended).toBe("timeup"); expect(run.found).toBe(0);
         }
      });
      it(`L${id}: keyboard/touch have identical opening and retrieval windows`, () => {
         const a = createRun(7, LEVELS[id]), b = createRun(7, LEVELS[id]);
         const station = a.items[a.order[0]].station;
         atStation(a, station); atStation(b, station);
         inspect(a, station, false); inspect(b, station, true);
         expect(a.simMs).toBe(1100); expect(a).toEqual(b);
         inspect(a, station, false); inspect(b, station, true);
         expect(a.simMs).toBe(2000); expect(a).toEqual(b);
      });
   }
   it("locked clue order cannot be skipped and final power requires a fresh return action", () => {
      for (const id of [3, 4, 5] as const) {
         const run = createRun(7, LEVELS[id]);
         const wrong = run.items[run.order[1]].station;
         atStation(run, wrong); inspect(run, wrong, true); inspect(run, wrong, true);
         expect(run.found).toBe(0); expect(run.message).toBe("locked");
      }
      const run = createRun(7, LEVELS[5]);
      run.found = 5; run.foundMask = 31;
      run.player.x = DOOR_POSITION.x; run.player.z = DOOR_POSITION.z;
      inspect(run, run.stations.length, true);
      expect(run.ended).toBeNull(); expect(run.exitReady).toBe(false);
      atStation(run, 0); inspect(run, 0, true);
      expect(run.exitReady).toBe(true);
   });
});
