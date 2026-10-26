import { describe, expect, it } from "vitest";
import { inputToWorld } from "@/arcade3d/core/math";
import { createGrid, freeGrid, nearestFree } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { PROPOSED_LEVEL_LIMITS, TUNING, createRun, flowerSpotOk, objectiveCeiling, stepRun, type RunState } from "./rules";

const DT = 1 / 60;
const at = (run: RunState, x: number, z: number) => {
   run.bee.x = x;
   run.bee.z = z;
   run.bee.vx = 0;
   run.bee.vz = 0;
};
const hiveSpot = (run: RunState) => ({ x: run.hive.x, z: run.hive.z - (TUNING.hiveSolid + TUNING.beeRadius + 0.2) });

describe("bee-garden rules: determinism", () => {
   it("the same seed and inputs give the same run", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(99, LEVELS[id], id);
         const b = createRun(99, LEVELS[id], id);
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
         for (let i = 0; i < 900; i++) {
            const inp = { dirX: Math.sin(i / 40), dirZ: Math.cos(i / 55), jump: i % 200 < 90 };
            stepRun(a, inp, DT);
            stepRun(b, inp, DT);
         }
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
   });
   it("different seeds give different gardens", () => {
      expect(JSON.stringify(createRun(1).flowers)).not.toBe(JSON.stringify(createRun(2).flowers));
   });
});

describe("bee-garden rules: the generator, per level (300 seeds)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: every count, size and placement rule holds`, () => {
         const level = LEVELS[id];
         const hx = level.width / 2;
         const hz = level.depth / 2;
         for (let seed = 1; seed <= 300; seed++) {
            const run = createRun(seed, level, id);
            expect(run.level).toBe(level);
            expect(run.levelId).toBe(id);
            expect(run.bounds).toEqual({ halfX: hx, halfZ: hz });
            expect(run.timeLeft).toBe(level.durationMs / 1000);
            expect(run.flowers.length).toBe(level.units);
            expect(run.webs.length).toBe(level.webs);
            expect(run.branches.length).toBe(level.branches);
            expect(run.hive).toEqual({ x: 0, z: hz - TUNING.hiveInset, radius: TUNING.hiveRadius });
            // the seeded scatter places every flower 1.6 m apart (the closer fallback scan is never needed)
            for (const f of run.flowers) for (const g of run.flowers) if (f !== g) expect(Math.hypot(f.x - g.x, f.z - g.z)).toBeGreaterThanOrEqual(1.6);
            run.flowers.forEach((f, i) => {
               expect(f.id).toBe(i);
               expect(f.type).toBe("ABC"[i % 3]);
               const others = run.flowers.filter((g) => g !== f);
               expect(flowerSpotOk(f.x, f.z, hx, hz, run.hive, run.branches, run.webs, others, 0.8)).toBe(true);
            });
            for (const h of [...run.webs, ...run.branches]) {
               // the hive pad and the south corridor carry no hazard
               expect(Math.hypot(h.x - run.hive.x, h.z - run.hive.z)).toBeGreaterThanOrEqual(run.hive.radius + 2.0);
               expect(h.z).toBeLessThanOrEqual(hz - TUNING.corridor);
               expect(Math.abs(h.x)).toBeLessThanOrEqual(hx - 2.0);
            }
            // the bee starts clear of everything, outside the hive box, inside the pad
            expect(Math.hypot(run.bee.x - run.hive.x, run.bee.z - run.hive.z)).toBeGreaterThan(TUNING.hiveSolid + TUNING.beeRadius);
            expect(Math.hypot(run.bee.x - run.hive.x, run.bee.z - run.hive.z)).toBeLessThan(run.hive.radius + TUNING.beeRadius);
         }
      });
      it(`L${id}: every flower and the hive are reachable (flood fill, 200 seeds)`, () => {
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, LEVELS[id], id);
            const grid = createGrid({ cell: 0.2, halfX: run.bounds.halfX - TUNING.beeRadius, halfZ: run.bounds.halfZ - TUNING.beeRadius });
            const free = freeGrid(grid, (x, z) => {
               for (const b of run.branches) if (Math.hypot(x - b.x, z - b.z) < b.radius + TUNING.beeRadius) return false;
               for (const w of run.webs) if (Math.hypot(x - w.x, z - w.z) < w.radius + TUNING.beeRadius) return false;
               return Math.hypot(x - run.hive.x, z - run.hive.z) >= TUNING.hiveSolid + TUNING.beeRadius;
            });
            // one flood fill from the start (4 neighbours), then every flower's node must be reached
            const seen = new Uint8Array(grid.size);
            const queue = [nearestFree(grid, free, run.bee.x, run.bee.z, 0.3)];
            seen[queue[0]] = 1;
            for (let q = 0; q < queue.length; q++) {
               const n = queue[q];
               const i = Math.floor(n / grid.nz);
               const j = n % grid.nz;
               for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  const ni = i + di;
                  const nj = j + dj;
                  if (ni < 0 || nj < 0 || ni >= grid.nx || nj >= grid.nz) continue;
                  const m = ni * grid.nz + nj;
                  if (free[m] && !seen[m]) {
                     seen[m] = 1;
                     queue.push(m);
                  }
               }
            }
            for (const f of run.flowers) expect(seen[nearestFree(grid, free, f.x, f.z, 0.3)]).toBe(1);
         }
      });
   }
});

describe("bee-garden rules: scoring events", () => {
   const deposit = (carried: number[]) => {
      const run = createRun(1, LEVELS[1], 1);
      for (const id of carried) run.flowers[id].hasNectar = false;
      run.carried.push(...carried);
      const p = hiveSpot(run);
      at(run, p.x, p.z);
      stepRun(run, {}, DT);
      return run;
   };
   it("a deposit of 1 pays 20, of 2 pays 40, of 3 pays 75", () => {
      expect(deposit([0]).score).toBe(20);
      expect(deposit([0, 1]).score).toBe(40);
      const three = deposit([0, 1, 2]);
      expect(three.score).toBe(75);
      expect(three.lastDeposit).toBe(75);
      expect(three.carried).toEqual([]);
      expect(three.totalDeposited).toBe(3);
      expect(three.events).toContain("deposit");
   });
   it("a deposit pays only inside the pad (radius 1.6 + bee 0.3)", () => {
      const run = createRun(1, LEVELS[1], 1);
      run.flowers[0].hasNectar = false;
      run.carried.push(0);
      at(run, run.hive.x - 2.0, run.hive.z);
      stepRun(run, {}, DT);
      expect(run.score).toBe(0);
      at(run, run.hive.x - 1.85, run.hive.z);
      stepRun(run, {}, DT);
      expect(run.score).toBe(20);
   });
   it("a flower gives its nectar once, the carry never exceeds 3", () => {
      const run = createRun(5, LEVELS[1], 1);
      for (let i = 0; i < 4; i++) {
         run.flowers[i].x = 0.1 * i;
         run.flowers[i].z = -2;
      }
      at(run, 0.15, -2);
      stepRun(run, {}, DT);
      expect(run.carried).toEqual([0, 1, 2]);
      expect(run.flowers[3].hasNectar).toBe(true);
      expect(run.events.filter((e) => e === "pickup").length).toBe(3);
      stepRun(run, {}, DT);
      expect(run.carried.length).toBe(3);
   });
   it("pickup reach is 0.55 m", () => {
      const run = createRun(5, LEVELS[1], 1);
      const f = run.flowers[0];
      at(run, f.x + 0.56, f.z);
      stepRun(run, {}, DT);
      expect(run.carried).toEqual([]);
      at(run, f.x + 0.54, f.z);
      stepRun(run, {}, DT);
      expect(run.carried).toEqual([0]);
   });
   it("a web stuns 0.50 s, puts the carry back on the same flowers and pays 0", () => {
      const run = createRun(3, LEVELS[2], 2);
      const ids = [4, 7];
      for (const id of ids) run.flowers[id].hasNectar = false;
      run.carried.push(...ids);
      run.score = 40;
      const w = run.webs[0];
      at(run, w.x + 0.5, w.z);
      stepRun(run, { dirX: 1, dirZ: 0 }, DT);
      expect(run.events).toEqual(["web_hit"]);
      expect(run.stunTimer).toBe(TUNING.stunDuration);
      expect(run.carried).toEqual([]);
      for (const id of ids) expect(run.flowers[id].hasNectar).toBe(true);
      expect(run.flowers.filter((f) => !f.hasNectar)).toEqual([]);
      expect(run.score).toBe(40);
      // stunned: no movement for 0.5 s of play, whatever the input
      const x = run.bee.x;
      for (let t = 0; t < 0.49; t += DT) stepRun(run, { dirX: 1, dirZ: 0, jump: true }, DT);
      expect(run.bee.x).toBe(x);
      expect(run.stamina).toBe(100);
   });
   it("win: every unit banked ends the run with +4 per full second left, inside the level's limits", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(8, LEVELS[id], id);
         const store = createArcadeStore();
         store.getState().configure({ durationMs: LEVELS[id].durationMs });
         store.getState().markReady();
         store.getState().start();
         run.flowers.forEach((f) => (f.hasNectar = false));
         run.totalDeposited = LEVELS[id].units - 1;
         run.carried.push(0);
         run.score = objectiveCeiling(LEVELS[id].units) - 20;
         run.time = 60.5;
         const p = hiveSpot(run);
         at(run, p.x, p.z);
         stepRun(run, {}, 0.01, store);
         expect(run.endReason).toBe("win");
         const left = Math.floor(LEVELS[id].durationMs / 1000 - 60.51);
         expect(run.score).toBe(objectiveCeiling(LEVELS[id].units) + 4 * left);
         expect(run.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
         expect(store.getState().endReason).toBe("win");
         expect(store.getState().score).toBe(run.score);
      }
   });
   it("the objective ceiling is 20 per unit + 15 per full load", () => {
      expect(LEVEL_IDS.map((id) => objectiveCeiling(LEVELS[id].units))).toEqual([245, 375, 490, 620, 750]);
   });
   it("timeup: each level's clock ends the run with what was banked, not a second early", () => {
      for (const id of LEVEL_IDS) {
         const d = LEVELS[id].durationMs / 1000;
         const run = createRun(2, LEVELS[id], id);
         run.score = 60;
         run.time = d - 1;
         stepRun(run, {}, 0.02);
         expect(run.over).toBe(false);
         expect(run.timeLeft).toBeCloseTo(0.98, 9);
         run.time = d - 0.01;
         stepRun(run, {}, 0.02);
         expect(run.endReason).toBe("timeup");
         expect(run.score).toBe(60);
      }
   });
   it("no win before every unit of the level is banked", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(8, LEVELS[id], id);
         run.flowers[0].hasNectar = false;
         run.totalDeposited = LEVELS[id].units - 2;
         run.carried.push(0);
         const p = hiveSpot(run);
         at(run, p.x, p.z);
         stepRun(run, {}, DT);
         expect(run.totalDeposited).toBe(LEVELS[id].units - 1);
         expect(run.over).toBe(false);
      }
   });
});

describe("bee-garden rules: flight", () => {
   it("top speed 6.5, boost 9.5, accel 16", () => {
      const run = createRun(1, LEVELS[1], 1);
      at(run, 0, 0);
      stepRun(run, { dirX: 1, dirZ: 0 }, 0.05);
      expect(run.bee.vx).toBeCloseTo(16 * 0.05, 10);
      for (let i = 0; i < 60; i++) stepRun(run, { dirX: 1, dirZ: 0 }, DT);
      expect(run.bee.vx).toBeCloseTo(6.5, 6);
      at(run, -6, 0);
      for (let i = 0; i < 60; i++) stepRun(run, { dirX: 1, dirZ: 0, jump: true }, DT);
      expect(run.bee.vx).toBeCloseTo(9.5, 6);
   });
   it("stamina drains 22/s while boosting and refills 10/s, cap 100", () => {
      const run = createRun(1, LEVELS[1], 1);
      for (let i = 0; i < 60; i++) stepRun(run, { jump: true }, DT);
      expect(run.stamina).toBeCloseTo(78, 6);
      stepRun(run, {}, DT); // release: lock
      for (let i = 0; i < 59; i++) stepRun(run, {}, DT);
      expect(run.stamina).toBeCloseTo(88, 6);
      for (let i = 0; i < 600; i++) stepRun(run, {}, DT);
      expect(run.stamina).toBe(100);
   });
   it("boost locks 1.00 s after stamina reaches 0, even while held, and 1.00 s after a release", () => {
      const run = createRun(1, LEVELS[1], 1);
      run.stamina = 0.2;
      stepRun(run, { jump: true }, DT);
      expect(run.stamina).toBe(0);
      expect(run.boosting).toBe(false);
      expect(run.boostLock).toBe(1);
      let t = 0;
      while (!run.boosting && t < 3) {
         stepRun(run, { jump: true }, DT);
         t += DT;
      }
      expect(t).toBeGreaterThan(1 - 1e-9);
      expect(t).toBeLessThan(1 + 2 * DT);
      // release mid-boost
      const r2 = createRun(1, LEVELS[1], 1);
      stepRun(r2, { jump: true }, DT);
      expect(r2.boosting).toBe(true);
      stepRun(r2, {}, DT);
      expect(r2.boostLock).toBe(1);
      for (let i = 0; i < 30; i++) stepRun(r2, { jump: true }, DT);
      expect(r2.boosting).toBe(false);
   });
   it("no input: the bee brakes at its accel (16) and drag (0.6/s); the hive box and branches are solid; the garden is walled", () => {
      const run = createRun(4, LEVELS[1], 1);
      at(run, 0, 0);
      run.bee.vx = 5;
      stepRun(run, {}, 0.05);
      expect(run.bee.vx).toBeCloseTo((5 - 16 * 0.05) * (1 - 0.6 * 0.05), 10);
      at(run, run.hive.x, run.hive.z - 0.5);
      stepRun(run, { dirX: 0, dirZ: 1 }, DT);
      expect(Math.hypot(run.bee.x - run.hive.x, run.bee.z - run.hive.z)).toBeCloseTo(TUNING.hiveSolid + TUNING.beeRadius, 6);
      const b = run.branches[0];
      at(run, b.x + 0.1, b.z);
      stepRun(run, {}, DT);
      expect(Math.hypot(run.bee.x - b.x, run.bee.z - b.z)).toBeCloseTo(b.radius + TUNING.beeRadius, 6);
      at(run, run.bounds.halfX + 3, 0);
      stepRun(run, {}, DT);
      expect(run.bee.x).toBe(run.bounds.halfX - TUNING.beeRadius);
   });
   it("the breeze pushes east 0.8 m/s² only on a breezy level (L5)", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, LEVELS[id], id);
         at(run, 0, 0);
         stepRun(run, {}, 0.05);
         expect(run.bee.vx).toBeCloseTo(LEVELS[id].breeze ? 0.8 * 0.05 : 0, 12);
      }
      expect(LEVEL_IDS.filter((id) => LEVELS[id].breeze)).toEqual([5]);
   });
   it("keyboard and touch: one rule, one set of constants (a full stick equals a held key)", () => {
      const key = createRun(55, LEVELS[2], 2);
      const stick = createRun(55, LEVELS[2], 2);
      const k = { x: 0, z: 0 };
      const s = { x: 0, z: 0 };
      for (let i = 0; i < 240; i++) {
         inputToWorld(0, -1, 0, k); // W / up arrow
         inputToWorld(Math.sin(1e-9), -1, 0, s); // the stick pushed fully up
         stepRun(key, { dirX: k.x, dirZ: k.z, jump: i < 100 }, DT);
         stepRun(stick, { dirX: s.x, dirZ: s.z, jump: i < 100 }, DT);
      }
      expect(stick.bee.z).toBeCloseTo(key.bee.z, 6);
      expect(stick.stamina).toBeCloseTo(key.stamina, 9);
      // nothing in the tuning depends on the device
      expect(Object.keys(TUNING).some((k2) => /touch|key|coarse|pointer/i.test(k2))).toBe(false);
   });
});
