// The five levels (docs/arcade-levels.md §6.3 step 6 and §5): declarations, level 1 = today's game
// (replayed bit-exact against today's createRun), monotone difficulty, every level setting reaching
// the simulation, the limit proof per level and the bots through the real store. rules.test.ts
// (level 1's own proof and bots) is untouched.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { definitionLevelProblems, isLevelCleared, levelEnvironment, levelHudStats, levelInstructions, levelRunConfig } from "@/arcade3d/core/levels";
import { levelMetaProblems, scoringFor } from "@/arcade3d/levelMeta";
import { advanceRunClock, playedFrameDt } from "@/arcade3d/core/frameLoop";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { computeTimeScore, isRankedRun } from "@/arcade3d/core/scores";
import { LEVELS } from "./levels";
import { escapeRoomMeta as meta } from "./meta";
import definition from "./index";
import * as rules from "./rules";
import { createRun, step, createStepInput, isWalkable, targetInReach, DOOR_POSITION, DURATION_MS, NONE, RUNNER, MIN_FINISH_MS, PROPOSED_LEVEL_LIMITS, type EscapeRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

type Mode = "oracle" | "blind";

/** The next target for a player who sees only what the game shows: open the containers in one
 * sweep (right column north, then left column south), take a visible item when it is next (the
 * HUD's "Next"), come back for a seen item once it becomes next, restore power, then the exit. */
function blindTarget(run: EscapeRun): number {
   const need = run.found < run.level.items ? (run.level.ordered ? run.order[run.found] : NONE) : -2;
   for (let id = 0; id < run.stations.length; id++) {
      const item = run.layout.stations[id].item;
      if (run.stations[id].phase === "open" && item !== NONE && run.items[item].visible
         && (need === NONE || item === need)) return id;
   }
   const sweep = run.layout.stations.map((s) => s.id).sort((a, b) => {
      const sa = run.layout.stations[a], sb = run.layout.stations[b];
      if (sa.x > 0 !== sb.x > 0) return sa.x > 0 ? -1 : 1;
      return sa.x > 0 ? sb.z - sa.z : sa.z - sb.z;
   });
   for (const id of sweep) if (run.stations[id].phase === "closed") return id;
   if (run.found === run.level.items && !run.exitReady) return 0;
   return run.stations.length;
}

/** Real movement only, through the counted core clock. "oracle": knows the layout, full stick, no
 * reaction (the fastest witness). "blind": blindTarget, 85 % stick and 200 ms per interaction. */
function play(seed: number, id: (typeof LEVEL_IDS)[number], mode: Mode, hz = 30) {
   const run = createRun(seed, LEVELS[id]);
   const store = createArcadeStore();
   store.getState().configure({ durationMs: run.level.durationMs });
   store.getState().markReady(); store.getState().start();
   store.setState({ phase: "playing", countdownMs: 0 });
   const plan: number[] = [];
   for (const item of run.order) plan.push(run.items[item].station, run.items[item].station);
   if (id !== 1) for (const station of run.layout.stations) if (station.item < 0) plan.push(station.id);
   if (run.level.returnSwitch) plan.push(0);
   plan.push(run.stations.length);
   const honest = mode === "blind";
   const input = createStepInput();
   const dt = 1000 / hz;
   let visit = 0, leg = 0, waiting = 0, inspecting = false;
   let target = honest ? blindTarget(run) : plan[0];
   let frames = 0;
   while (!run.ended && frames++ < 40000) {
      const p = target === run.stations.length ? DOOR_POSITION : run.layout.stations[target];
      input.moveX = 0; input.moveY = 0; input.actionPressed = false; input.tappedTarget = null;
      if (inspecting && run.action.kind === "none") {
         const next = honest ? blindTarget(run) : plan[++visit];
         leg = next === target ? 2 : 0; target = next; waiting = 0; inspecting = false;
         continue;
      }
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
   return { run, elapsed: store.getState().elapsedMs, endReason: store.getState().endReason };
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
      it(`L${id}: the blind honest bot clears >= 90 % of 200 seeds, the oracle 50 of 50; every time within the limits`, () => {
         const l = PROPOSED_LEVEL_LIMITS[id], levelMeta = meta.levels![id - 1];
         let blind = 0, fastest = Infinity, slowest = 0, oracleFastest = Infinity;
         for (let seed = 0; seed < 200; seed++) {
            for (const mode of seed < 50 ? ["blind", "oracle"] as const : ["blind"] as const) {
               const { run, elapsed, endReason } = play(seed, id, mode);
               const ms = id === 1 ? elapsed : run.finishMs; // what index.tsx finalScore submits
               if (mode === "oracle") expect(run.ended, `L${id} seed ${seed} oracle`).toBe("win");
               expect(isLevelCleared(endReason, 0, levelMeta)).toBe(run.ended === "win");
               if (run.ended !== "win") continue;
               expect(ms).toBeGreaterThanOrEqual(l.minDurationMs);
               expect(ms).toBeLessThan(l.maxDurationMs);
               expect(Math.floor((l.timeBaseMs - ms) / 10)).toBeLessThanOrEqual(l.maxScore);
               expect(isRankedRun(l, "win")).toBe(true);
               if (mode === "blind") { blind++; fastest = Math.min(fastest, ms); slowest = Math.max(slowest, ms); }
               else oracleFastest = Math.min(oracleFastest, ms);
            }
         }
         for (const hz of [60, 144]) {
            for (const seed of [0, 1]) {
               const result = play(seed, id, "blind", hz);
               expect(result.run.ended).toBe("win");
               expect(result.elapsed).toBeGreaterThanOrEqual(l.minDurationMs);
               expect(result.elapsed).toBeLessThan(l.maxDurationMs);
            }
         }
         console.info(`L${id}: blind ${blind}/200 (${Math.round(fastest)}-${Math.round(slowest)} ms); oracle 50/50, fastest ${Math.round(oracleFastest)} ms; minDurationMs ${l.minDurationMs}`);
         expect(blind).toBeGreaterThanOrEqual(180);
      }, 180000);
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
   it("restores exit power with E as well as with a tap", () => {
      const run = createRun(7, LEVELS[5]);
      for (const item of run.items) item.found = true;
      run.found = 5; run.foundMask = 31;
      run.stations.forEach((s, id) => { s.phase = run.layout.stations[id].item === NONE ? "open" : "collected"; });
      for (const item of run.items) item.visible = false;
      atStation(run, 0);
      expect(targetInReach(run)).toBe(0);
      inspect(run, 0, false);
      expect(run.exitReady).toBe(true);
      expect(run.simMs).toBe(1100);
   });
});

const L1_TODAY = [
   "win:25866:25866:1172:b42395af",
   "win:25806:25806:1161:2f2dc39d",
   "win:22504:22504:1003:6decacb1",
   "win:25684:25684:1148:e28270d4",
   "win:24865:24865:1144:dd660bec",
   "win:22888:22888:1019:5ef335ea",
   "win:22514:22514:999:c36e8203",
   "win:28030:28030:1267:1cf4a1e5",
   "win:25047:25047:1119:dc9e9931",
   "win:22012:22012:983:7f8c46fe",
   "win:25240:25240:1129:ecb59fd0",
   "win:27490:27490:1232:34ca9ad5",
   "win:28120:28120:1245:3d5138ed",
   "win:25574:25574:1151:da790d03",
   "win:25026:25026:1144:9f33bce9",
   "win:21774:21774:992:29b18fa3",
   "win:25776:25776:1176:c647ab8f",
   "win:27879:27879:1242:e37da1cf",
   "win:21564:21564:973:2f07faae",
   "win:27809:27809:1259:66718f81",
   "win:25849:25849:1158:4957c2c9",
   "win:25834:25834:1155:58bc3b9d",
   "win:25902:25902:1175:d4c5cf06",
   "win:22746:22746:1017:4e4a2f86",
];

describe("escape-room level 1 is today's game", () => {
   it("replays bit-exact against today's createRun (traces recorded from origin/main before levels)", () => {
      for (let seed = 0; seed < L1_TODAY.length; seed++) {
         expect(l1Trace(rules, seed), `seed ${seed}`).toBe(L1_TODAY[seed]);
         expect(l1Trace(rules, seed, (s) => createRun(s, LEVELS[1])), `seed ${seed} LEVELS[1]`).toBe(L1_TODAY[seed]);
      }
      expect(LEVELS[1]).toEqual({ id: 1, items: 3, containers: 4, durationMs: DURATION_MS, ordered: false, shuffledOrder: false, returnSwitch: false });
      expect(levelRunConfig(definition, 1).durationMs).toBe(DURATION_MS);
      expect(levelInstructions(definition, 1)).toBe(definition.instructions);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
   });
});

describe("escape-room level settings reach the simulation", () => {
   it("index.tsx: per-level clock, Found maximum, instructions and lighting", () => {
      expect(levelEnvironment(definition, 2)).toEqual(definition.environment);
      expect(levelEnvironment(definition, 3)?.lighting).toBe("sunset");
      for (const id of LEVEL_IDS) {
         expect(levelRunConfig(definition, id).durationMs).toBe(LEVELS[id].durationMs);
         expect(levelHudStats(definition, id)).toEqual([{ key: "found", label: "Found", max: LEVELS[id].items }]);
         if (id > 1) expect(levelInstructions(definition, id)).not.toBe(definition.instructions);
      }
      expect(levelInstructions(definition, 5).join(" ")).toMatch(/first drawer/);
   });
   it("shuffledOrder moves the anchors and permutes the clue order; L2-L3 keep both fixed", () => {
      for (const id of [2, 3, 4, 5] as const) {
         let moved = 0, permuted = 0;
         for (let seed = 0; seed < 40; seed++) {
            const run = createRun(seed, LEVELS[id]);
            if (run.layout.stations.some((s) => Math.abs(s.x) !== 3.5)) moved++;
            if (run.order.some((item, i) => item !== i)) permuted++;
            expect([...run.order].sort()).toEqual(run.items.map((item) => item.id));
         }
         expect(moved > 0).toBe(LEVELS[id].shuffledOrder);
         expect(permuted > 0).toBe(LEVELS[id].shuffledOrder);
      }
   });
   it("L2+: the chairs block the centre of the room (L1 keeps it open)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(2, LEVELS[id]);
         expect(isWalkable(run.layout, 0, 0)).toBe(id === 1);
         expect(isWalkable(run.layout, 1.5, 0)).toBe(id === 1);
         expect(isWalkable(run.layout, 2.5, 0)).toBe(true);
      }
   });
   it("returnSwitch: only L5 starts without exit power", () => {
      for (const id of LEVEL_IDS) expect(createRun(3, LEVELS[id]).exitReady).toBe(!LEVELS[id].returnSwitch);
   });
   it("L2+: the exit stays shut until every container was searched; L1 never asks for that", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(11, LEVELS[id]);
         const decoy = run.layout.stations.find((s) => s.item === NONE)!.id;
         for (const item of run.order) {
            const station = run.items[item].station;
            atStation(run, station); inspect(run, station, true); inspect(run, station, true);
         }
         expect(run.found).toBe(LEVELS[id].items);
         if (run.level.returnSwitch) {
            expect(run.exitReady).toBe(false);
            atStation(run, 0); inspect(run, 0, true);
         }
         expect(run.exitReady).toBe(true);
         expect(run.stations[decoy].phase).toBe("closed");
         run.player.x = DOOR_POSITION.x; run.player.z = DOOR_POSITION.z;
         inspect(run, run.stations.length, true);
         if (id === 1) { expect(run.ended).toBe("win"); continue; }
         expect(run.ended).toBeNull(); expect(run.message).toBe("locked");
         for (const s of run.layout.stations) if (run.stations[s.id].phase === "closed") { atStation(run, s.id); inspect(run, s.id, true); }
         run.player.x = DOOR_POSITION.x; run.player.z = DOOR_POSITION.z;
         inspect(run, run.stations.length, true);
         expect(run.ended).toBe("win");
         expect(run.finishMs).toBe(run.simMs);
      }
   });
   it("the exit needs every one of the level's items (4 on L3-L4, 5 on L5), not just three", () => {
      for (const id of [3, 4, 5] as const) {
         const run = createRun(13, LEVELS[id]);
         for (const s of run.layout.stations) { atStation(run, s.id); inspect(run, s.id, true); }
         for (const item of run.order.slice(0, 3)) { const st = run.items[item].station; atStation(run, st); inspect(run, st, true); }
         expect(run.found).toBe(3);
         run.exitReady = true;
         run.player.x = DOOR_POSITION.x; run.player.z = DOOR_POSITION.z;
         inspect(run, run.stations.length, true);
         expect(run.ended).toBeNull(); expect(run.message).toBe("locked");
      }
   });
   it("L5: everything searched and collected, the exit still needs power", () => {
      const run = createRun(13, LEVELS[5]);
      for (const s of run.layout.stations) { atStation(run, s.id); inspect(run, s.id, true); }
      for (const item of run.order) { const st = run.items[item].station; atStation(run, st); inspect(run, st, true); }
      expect(run.found).toBe(5); expect(run.exitReady).toBe(false);
      run.player.x = DOOR_POSITION.x; run.player.z = DOOR_POSITION.z;
      inspect(run, run.stations.length, true);
      expect(run.ended).toBeNull(); expect(run.message).toBe("locked");
   });
   it("the clock is the level's: time-up at durationMs, not before", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, LEVELS[id]);
         run.simMs = LEVELS[id].durationMs - 51;
         step(run, 50, createStepInput());
         expect(run.ended).toBeNull();
         step(run, 50, createStepInput());
         expect(run.ended).toBe("timeup"); expect(run.simMs).toBe(LEVELS[id].durationMs);
      }
   });
});

/** Hashes every frame's full observable state (float bits exact) while a route bot with seeded
 * noise wins level 1. Shape-agnostic: the L1_TODAY values came from today's rules.ts. */
interface RulesModule { createRun(seed: number): any; step(run: any, dt: number, input: any): any; createStepInput(): any }
const F64 = new Float64Array(1), U32 = new Uint32Array(F64.buffer);
function mix(h: number, v: number): number { return Math.imul(h ^ v, 16777619) >>> 0; }
function num(h: number, v: number): number { F64[0] = v; return mix(mix(h, U32[0]), U32[1]); }
function str(h: number, v: string): number { for (let i = 0; i < v.length; i++) h = mix(h, v.charCodeAt(i)); return h; }
function l1Trace(m: RulesModule, seed: number, make: (seed: number) => any = m.createRun): string {
   const run = make(seed);
   const input = m.createStepInput();
   let rnd = (seed * 2654435761 + 7) >>> 0;
   const next = () => (rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0) / 4294967296;
   const targets: number[] = [];
   for (const item of run.items) targets.push(item.station, item.station);
   targets.push(4);
   let h = 2166136261, visit = 0, leg = 0, inspecting = false, frames = 0;
   while (!run.ended && frames++ < 20000) {
      const dt = [1000 / 30, 1000 / 60, 1000 / 144, next() * 70][frames % 4];
      input.moveX = 0; input.moveY = 0; input.actionPressed = false; input.tappedTarget = null;
      if (next() < 0.06) {
         input.moveX = next() * 2 - 1; input.moveY = next() * 2 - 1;
         input.actionPressed = next() < 0.3; input.tappedTarget = next() < 0.2 ? Math.floor(next() * 7) - 1 : null;
      } else if (visit < targets.length && run.action.kind === "none") {
         const target = targets[visit];
         const p = target === 4 ? { x: 0, z: -4.2 } : run.layout.stations[target];
         if (inspecting) { visit++; leg = targets[visit] === target ? 2 : 0; inspecting = false; }
         else {
            const corridor = p.x < 0 ? -2.5 : p.x > 0 ? 2.5 : run.player.x < 0 ? -2.5 : 2.5;
            const x = leg < 2 ? corridor : p.x, z = leg === 0 ? run.player.z : p.z;
            const dx = x - run.player.x, dz = z - run.player.z, d = Math.hypot(dx, dz);
            if (d < 0.12) {
               if (leg < 2) leg++;
               else { input.actionPressed = seed % 2 === 0; input.tappedTarget = seed % 2 ? target : null; inspecting = true; }
            } else { input.moveX = dx / d * Math.min(1, d * 3); input.moveY = dz / d * Math.min(1, d * 3); }
         }
      }
      const ev = m.step(run, dt, input);
      const p = run.player;
      h = num(num(num(num(num(num(num(num(h, run.simMs), run.remainder), run.stepMs), run.lockedMs), p.x), p.z), p.vx), p.vz);
      h = num(num(num(num(num(h, run.found), run.foundMask), run.finishMs), run.action.remainingMs), run.door.progressMs);
      h = str(str(str(str(h, run.action.kind), run.door.phase), run.message), String(run.ended));
      for (const s of run.stations) h = str(num(h, s.progressMs), s.phase);
      for (const k of Object.keys(ev).sort()) h = str(h, `${k}=${ev[k]}`);
   }
   return `${run.ended}:${run.simMs}:${run.finishMs}:${frames}:${h.toString(16)}`;
}
