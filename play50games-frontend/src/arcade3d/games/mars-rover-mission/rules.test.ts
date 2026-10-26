import { describe, expect, it } from "vitest";
import { createGrid, freeGrid, nearestFree } from "@/arcade3d/core/testing/botHarness";
import { createArcadeStore } from "@/arcade3d/core/useArcadeStore";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import {
   BASE_PAD_RADIUS,
   BOULDER_RADIUS,
   CHARGER_PAD_RADIUS,
   CHARGE_RATE,
   DRIVE_DRAIN,
   GEN,
   IDLE_DRAIN,
   LIVES,
   PROPOSED_LEVEL_LIMITS,
   ROCK_RADIUS,
   ROVER,
   SITE_RING_RADIUS,
   axis,
   createRun,
   createStoreSync,
   energyReach,
   frame,
   objectiveCeiling,
   step,
   type Run,
} from "./rules";

const DT = 1 / 60;
const HOLD = { moveX: 0, moveY: 0 };
const place = (run: Run, x: number, z: number, speed = 0, yaw = Math.PI) => {
   run.rover.x = x;
   run.rover.z = z;
   run.rover.speed = speed;
   run.rover.yaw = yaw;
};
/** Steps n frames, holding the rover's speed fixed (the brake/throttle rules aside). */
const hold = (run: Run, seconds: number, speed: number) => {
   for (let t = 0; t < seconds - 1e-9; t += DT) {
      run.rover.speed = speed;
      step(run, HOLD, DT);
   }
};
const open = (run: Run) => {
   run.rocks.length = 0;
   run.boulders.length = 0;
};

describe("mars-rover-mission rules: determinism", () => {
   it("the same seed and inputs give the same run, at any frame split", () => {
      for (const id of LEVEL_IDS) {
         const a = createRun(77, LEVELS[id], id);
         const b = createRun(77, LEVELS[id], id);
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
         for (let i = 0; i < 600; i++) {
            const inp = { moveX: Math.sin(i / 37), moveY: -0.9 + 0.3 * Math.cos(i / 51) };
            step(a, inp, DT);
            step(b, inp, DT);
         }
         expect(JSON.stringify(a)).toBe(JSON.stringify(b));
      }
   });
   it("30, 60 and 144 Hz drive the same (fixed 1/120 s steps)", () => {
      const end = (hz: number) => {
         const run = createRun(3, LEVELS[1], 1);
         open(run);
         const n = Math.round(4 * hz);
         for (let i = 0; i < n; i++) step(run, { moveX: 0.6, moveY: -1 }, 1 / hz);
         return run.rover;
      };
      const r30 = end(30);
      for (const hz of [60, 144]) {
         const r = end(hz);
         expect(r.x).toBeCloseTo(r30.x, 6);
         expect(r.z).toBeCloseTo(r30.z, 6);
         expect(r.yaw).toBeCloseTo(r30.yaw, 9);
      }
   });
});

describe("mars-rover-mission rules: the generator (300 seeds per level)", () => {
   for (const id of LEVEL_IDS) {
      it(`L${id}: counts, spacing, clearances and the energy rule hold`, () => {
         const level = LEVELS[id];
         const hx = level.width / 2;
         const hz = level.depth / 2;
         const reach = energyReach(level);
         for (let seed = 1; seed <= 300; seed++) {
            const run = createRun(seed, level, id);
            expect([run.sites.length, run.chargers.length, run.rocks.length, run.boulders.length]).toEqual([level.sites, level.chargers, level.rocks, level.boulders]);
            expect(run.basePad).toEqual({ x: 0, z: hz - GEN.baseInset, radius: BASE_PAD_RADIUS });
            expect(run.rover).toMatchObject({ x: 0, z: hz - GEN.baseInset, speed: 0, battery: 100, yaw: Math.PI });
            run.sites.forEach((s, i) => {
               expect(s.index).toBe(i);
               for (const o of run.sites) if (o !== s) expect(Math.hypot(o.x - s.x, o.z - s.z)).toBeGreaterThanOrEqual(GEN.siteSpacing);
               // >= 3 m from solids
               for (const r of run.rocks) expect(Math.hypot(r.x - s.x, r.z - s.z) - r.radius - SITE_RING_RADIUS).toBeGreaterThanOrEqual(3 - 1e-9);
               for (const b of run.boulders) expect(Math.abs(b.x - s.x)).toBeGreaterThanOrEqual(GEN.laneFromSite);
               expect(Math.abs(s.x)).toBeLessThanOrEqual(hx - GEN.wallMargin);
               expect(run.chargers.some((c) => Math.hypot(c.x - s.x, c.z - s.z) <= reach)).toBe(true);
            });
            run.chargers.forEach((c, i) => {
               expect(c.index).toBe(i);
               for (const b of run.boulders) expect(Math.abs(b.x - c.x)).toBeGreaterThanOrEqual(GEN.laneFromPad);
               for (const o of run.chargers) expect(Math.hypot(o.x - c.x, o.z - c.z)).toBeLessThanOrEqual(2 * reach);
            });
            expect(run.chargers.some((c) => Math.hypot(c.x - run.basePad.x, c.z - run.basePad.z) <= 2 * reach)).toBe(true);
            for (const b of run.boulders) {
               expect(Math.abs(b.x - run.basePad.x)).toBeGreaterThanOrEqual(GEN.laneFromBase);
               expect(b.speed).toBe(level.boulderSpeed);
            }
            for (const r of run.rocks) {
               for (const o of run.rocks) if (o !== r) expect(Math.hypot(o.x - r.x, o.z - r.z)).toBeGreaterThanOrEqual(GEN.rockSpacing);
               for (const b of run.boulders) expect(Math.abs(b.x - r.x)).toBeGreaterThanOrEqual(GEN.rockFromLane);
            }
         }
      });
      it(`L${id}: every site, charger and the base are reachable (flood fill, 200 seeds)`, () => {
         for (let seed = 1; seed <= 200; seed++) {
            const run = createRun(seed, LEVELS[id], id);
            const grid = createGrid({ cell: 0.5, halfX: run.level.width / 2 - ROVER.radius, halfZ: run.level.depth / 2 - ROVER.radius });
            const free = freeGrid(grid, (x, z) => run.rocks.every((r) => Math.hypot(x - r.x, z - r.z) >= r.radius + ROVER.radius));
            const seen = new Uint8Array(grid.size);
            const queue = [nearestFree(grid, free, run.rover.x, run.rover.z, 0.6)];
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
            for (const p of [...run.sites, ...run.chargers]) expect(seen[nearestFree(grid, free, p.x, p.z, 0.6)]).toBe(1);
         }
      });
   }
});

describe("mars-rover-mission rules: the generator uses the whole plain", () => {
   it("sites reach out to each level's own side walls; the energy reach is each level's own", () => {
      for (const id of LEVEL_IDS) {
         let far = 0;
         for (let seed = 1; seed <= 150; seed++) for (const s of createRun(seed, LEVELS[id], id).sites) far = Math.max(far, Math.abs(s.x));
         expect(far).toBeGreaterThan(0.9 * (LEVELS[id].width / 2 - GEN.wallMargin - 0.5));
         const perMetre = DRIVE_DRAIN * LEVELS[id].drainScale + IDLE_DRAIN / 3.5;
         expect(energyReach(LEVELS[id])).toBeCloseTo(85 / (2 * 1.35 * perMetre), 9);
      }
   });
});

describe("mars-rover-mission rules: driving", () => {
   it("the stick has a 0.2 dead zone; a held key equals a full stick", () => {
      expect(axis(0.2)).toBe(0);
      expect(axis(-0.15)).toBe(0);
      expect(axis(1)).toBe(1);
      expect(axis(-1)).toBe(-1);
      expect(axis(0.6)).toBeCloseTo(0.5, 12);
   });
   it("top speed 7, accel 7, brake 12, reverse 2.5", () => {
      const run = createRun(1, LEVELS[1], 1);
      open(run);
      place(run, 0, run.level.depth / 2 - 2);
      for (let i = 0; i < 30; i++) step(run, { moveX: 0, moveY: -1 }, DT);
      expect(run.rover.speed).toBeCloseTo(3.5, 9);
      for (let i = 0; i < 60; i++) step(run, { moveX: 0, moveY: -1 }, DT);
      expect(run.rover.speed).toBe(7);
      place(run, 0, 0, 6);
      for (let i = 0; i < 30; i++) step(run, { moveX: 0, moveY: 1 }, DT);
      expect(run.rover.speed).toBeCloseTo(0, 9);
      for (let i = 0; i < 120; i++) step(run, { moveX: 0, moveY: 1 }, DT);
      expect(run.rover.speed).toBe(-2.5);
   });
   it("steering: right turns clockwise, scaled by speed (0.35 at a standstill, full from 2 m/s)", () => {
      const run = createRun(1, LEVELS[1], 1);
      open(run);
      place(run, 0, 0, 0, 0);
      for (let i = 0; i < 30; i++) step(run, { moveX: 1, moveY: 0 }, DT);
      expect(run.rover.yaw).toBeCloseTo(-ROVER.steer * 0.35 * 0.5, 9);
      place(run, 0, 0, 4, 0);
      run.acc = 0;
      const y0 = run.rover.yaw;
      for (let i = 0; i < 12; i++) {
         run.rover.speed = 4;
         step(run, { moveX: 1, moveY: -0.5 }, 1 / 120);
      }
      expect(run.rover.yaw - y0).toBeCloseTo(-ROVER.steer * 0.1, 6);
   });
   it("rocks are solid; above 3 m/s a hit spends a life and bounces the speed to -0.3 of itself, once per 1 s", () => {
      const run = createRun(1, LEVELS[2], 2);
      run.boulders.length = 0;
      const r = run.rocks[0];
      place(run, r.x, r.z + ROCK_RADIUS + ROVER.radius + 0.02, 5, Math.PI);
      step(run, { moveX: 0, moveY: -1 }, DT);
      expect(run.lives).toBe(LIVES - 1);
      expect(run.ev.rockHit).toBe(true);
      expect(run.rover.speed).toBeLessThan(0);
      expect(Math.hypot(run.rover.x - r.x, run.rover.z - r.z)).toBeGreaterThanOrEqual(ROCK_RADIUS + ROVER.radius - 1e-9);
      // a second hit inside the grace costs nothing
      place(run, r.x, r.z + ROCK_RADIUS + ROVER.radius + 0.02, 5, Math.PI);
      step(run, HOLD, DT);
      expect(run.lives).toBe(LIVES - 1);
      // slow: only a nudge
      const slow = createRun(1, LEVELS[2], 2);
      slow.boulders.length = 0;
      place(slow, r.x, r.z + ROCK_RADIUS + ROVER.radius + 0.01, 2.9, Math.PI);
      step(slow, HOLD, DT);
      expect(slow.lives).toBe(LIVES);
      expect(Math.hypot(slow.rover.x - r.x, slow.rover.z - r.z)).toBeGreaterThanOrEqual(ROCK_RADIUS + ROVER.radius - 1e-9);
   });
   it("a boulder hit uses the swept box: a 30 Hz frame across its path does not tunnel", () => {
      const run = createRun(4, LEVELS[3], 3);
      run.rocks.length = 0;
      const b = run.boulders[0];
      b.z = 0;
      run.boulders.length = 1;
      // the rover crosses the lane in one 1/30 s frame's worth of substeps at top speed, west to east
      place(run, b.x - 1.9, 0.3, 7, Math.PI / 2);
      for (let i = 0; i < 20 && !run.ev.boulderHit; i++) step(run, { moveX: 0, moveY: -1 }, 1 / 30);
      expect(run.lives).toBe(LIVES - 1);
   });
   it("each level's walls stop the rover without a hit", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(1, LEVELS[id], id);
         open(run);
         place(run, LEVELS[id].width / 2 - ROVER.radius - 0.05, 0, 7, Math.PI / 2);
         step(run, HOLD, DT);
         expect(run.rover.x).toBe(LEVELS[id].width / 2 - ROVER.radius);
         expect(run.rover.speed).toBe(0);
         expect(run.lives).toBe(LIVES);
      }
   });
});

describe("mars-rover-mission rules: scans, battery and the win", () => {
   it("a scan at 0.49 m/s for 1.00 s completes; at 0.51 m/s it does not; leaving the ring resets the hold", () => {
      const run = createRun(1, LEVELS[1], 1);
      open(run);
      const s = run.sites[0];
      place(run, s.x + 1.2, s.z);
      hold(run, 0.98, 0.49);
      expect(s.scanned).toBe(false);
      hold(run, 0.04, 0.49);
      expect(s.scanned).toBe(true);
      expect(run.score).toBe(120);
      const fast = createRun(1, LEVELS[1], 1);
      open(fast);
      place(fast, fast.sites[0].x + 1.2, fast.sites[0].z);
      hold(fast, 2, 0.51);
      expect(fast.sites[0].scanned).toBe(false);
      const out = createRun(1, LEVELS[1], 1);
      open(out);
      const o = out.sites[0];
      place(out, o.x, o.z);
      hold(out, 0.8, 0);
      place(out, o.x + SITE_RING_RADIUS + 0.1, o.z);
      hold(out, DT, 0);
      expect(o.holdTime).toBe(0);
   });
   it("the centre bonus: stopped within 1.0 m pays 180; each site pays once", () => {
      const run = createRun(2, LEVELS[1], 1);
      open(run);
      const s = run.sites[1];
      place(run, s.x + 0.9, s.z);
      hold(run, 1.05, 0);
      expect(run.score).toBe(180);
      expect(run.samplesScanned).toBe(1);
      hold(run, 3, 0);
      expect(run.score).toBe(180);
      expect(run.samplesScanned).toBe(1);
   });
   it("battery: 0.35/s idle, 0.9 per metre x drainScale; charging +12/s only while stopped on a pad", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(6, LEVELS[id], id);
         open(run);
         place(run, 0, 0);
         hold(run, 1, 0);
         expect(run.rover.battery).toBeCloseTo(100 - IDLE_DRAIN, 6);
         const before = run.rover.battery;
         hold(run, 1, 4);
         // the speed is reset to 4 each frame; drag shaves a little inside the frame
         expect(before - run.rover.battery).toBeCloseTo(IDLE_DRAIN + DRIVE_DRAIN * 4 * LEVELS[id].drainScale, 1);
      }
      const run = createRun(6, LEVELS[1], 1);
      open(run);
      const c = run.chargers[0];
      run.rover.battery = 50;
      place(run, c.x, c.z + CHARGER_PAD_RADIUS - 0.1);
      hold(run, 1, 0);
      expect(run.rover.battery).toBeCloseTo(50 + CHARGE_RATE, 6);
      hold(run, 1, 0.6);
      expect(run.rover.battery).toBeLessThan(50 + CHARGE_RATE);
   });
   it("battery at 0 ends with lose, once", () => {
      const run = createRun(6, LEVELS[1], 1);
      open(run);
      place(run, 0, 0);
      run.rover.battery = 0.001;
      const store = createArcadeStore();
      store.getState().configure({ durationMs: 120_000, lives: LIVES });
      store.getState().markReady();
      store.getState().start();
      const sync = createStoreSync();
      frame(run, HOLD, DT, store, sync);
      expect(run.over).toBe("lose");
      expect(run.ev.lost).toBe(true);
      expect(store.getState().endReason).toBe("lose");
      frame(run, HOLD, DT, store, sync);
      expect(run.ev.lost).toBe(false);
   });
   it("lives: three hits end the run with lose", () => {
      const run = createRun(1, LEVELS[2], 2);
      run.boulders.length = 0;
      const r = run.rocks[0];
      for (let i = 0; i < 3; i++) {
         run.rover.invulnerable = 0;
         place(run, r.x, r.z + ROCK_RADIUS + ROVER.radius + 0.02, 6, Math.PI);
         step(run, HOLD, DT);
      }
      expect(run.lives).toBe(0);
      expect(run.over).toBe("lose");
   });
   it("the win: every site scanned, then 0.6 s stopped on the base pad; +5 per full second left, inside the limits", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(9, LEVELS[id], id);
         open(run);
         for (const s of run.sites) s.scanned = true;
         run.samplesScanned = run.sites.length - 1;
         place(run, run.basePad.x, run.basePad.z);
         hold(run, 1, 0);
         expect(run.over).toBe(null);
         run.samplesScanned = run.sites.length;
         run.score = objectiveCeiling(LEVELS[id].sites);
         run.time = 60.25;
         hold(run, 0.58, 0);
         expect(run.over).toBe(null);
         hold(run, 0.05, 0);
         expect(run.over).toBe("win");
         const left = Math.floor(LEVELS[id].durationMs / 1000 - run.time);
         expect(run.score).toBe(objectiveCeiling(LEVELS[id].sites) + 5 * left);
         expect(run.score).toBeLessThanOrEqual(PROPOSED_LEVEL_LIMITS[id].maxScore);
      }
   });
   it("timeup: each level's clock ends the run with what was scanned", () => {
      for (const id of LEVEL_IDS) {
         const d = LEVELS[id].durationMs / 1000;
         const run = createRun(2, LEVELS[id], id);
         open(run);
         run.time = d - 1;
         run.rover.battery = 100;
         step(run, HOLD, 0.02);
         expect(run.over).toBe(null);
         run.time = d - 0.01;
         step(run, HOLD, 0.02);
         expect(run.over).toBe("timeup");
      }
   });
   it("Bobj is 180 per site", () => {
      expect(LEVEL_IDS.map((id) => objectiveCeiling(LEVELS[id].sites))).toEqual([540, 720, 900, 1080, 1260]);
      expect(BOULDER_RADIUS).toBeLessThan(ROVER.radius);
   });
});
