// Every valley (maps.ts) is fair: the gullies keep 2 m clear of the nest, the start and the mud (so a
// full stack crosses a band at full walking speed inside the headway), water and vents stay off every
// band, nothing solid sits on the nest, every free spot of the valley is reachable from the start
// without a dash, every egg spot (regular, golden, scattered) is reachable and off every hazard, a
// golden egg is always reachable inside its 8 s, and a glowing vent leaves time to step off it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { MAP_1, VENT, WATER, type ValleyMap } from "./maps";
import { cellNear, navGrid, travelTimes } from "./navkit";
import {
   BOULDER_LANES,
   BOULDERS,
   DINO,
   EGGS,
   MUD,
   NEST,
   TREES,
   VALLEY_BOUNDS,
   VENT_REACH,
   createDinoRun,
   isValidGroundSpot,
   laneEdgeClearance,
   lanesFor,
   obstacleDistance,
   pointToSegmentDistanceXZ,
   pushToValidGroundSpot,
   sampleEggSpot,
   sampleGoldenEggSpot,
   ventState,
} from "./rules";

/** Distance from a lane's centre segment to a water box (0 if they touch). */
function laneToBox(lane: { startX: number; startZ: number; endX: number; endZ: number }, w: { x0: number; x1: number; z0: number; z1: number }): number {
   let best = Infinity;
   for (let k = 0; k <= 200; k++) {
      const x = lane.startX + ((lane.endX - lane.startX) * k) / 200;
      const z = lane.startZ + ((lane.endZ - lane.startZ) * k) / 200;
      const dx = Math.max(w.x0 - x, 0, x - w.x1);
      const dz = Math.max(w.z0 - z, 0, z - w.z1);
      best = Math.min(best, Math.hypot(dx, dz));
   }
   return best;
}

const boxDistance = (x: number, z: number, w: { x0: number; x1: number; z0: number; z1: number }) =>
   Math.hypot(Math.max(w.x0 - x, 0, x - w.x1), Math.max(w.z0 - z, 0, z - w.z1));

describe("dino-egg-rescue valleys: level 1 is today's valley", () => {
   it("MAP_1 is rules.ts NEST / MUD / TREES / BOULDER_LANES and the start", () => {
      expect(MAP_1.nest).toEqual({ x: NEST.x, z: NEST.z });
      expect(MAP_1.nest).toEqual({ x: DINO.startX, z: DINO.startZ });
      expect(MAP_1.startFacing).toBe(DINO.startFacing);
      expect(MAP_1.mud).toEqual(MUD.patches);
      expect(MAP_1.obstacles.map((o) => [o.ax, o.az, o.r])).toEqual(TREES.positions.map((t) => [t.x, t.z, TREES.trunkRadius]));
      expect(lanesFor(LEVELS[1])).toEqual([...BOULDER_LANES]);
      expect(MAP_1.water).toHaveLength(0);
      expect(MAP_1.vents).toHaveLength(0);
      expect(LEVELS[1].map).toBe(MAP_1);
   });

   it("every level has its own valley: a different nest, gullies and solids from every other level", () => {
      for (const a of LEVEL_IDS) {
         for (const b of LEVEL_IDS) {
            if (a >= b) continue;
            const A = LEVELS[a].map;
            const B = LEVELS[b].map;
            expect(A.theme).not.toBe(B.theme);
            expect(JSON.stringify(A.lanes)).not.toBe(JSON.stringify(B.lanes));
            expect(JSON.stringify(A.obstacles)).not.toBe(JSON.stringify(B.obstacles));
         }
         expect(LEVELS[a].mudPatches).toBe(LEVELS[a].map.mud.length);
      }
      // the twists: logs in the forest, the river and its bridges, the vents, the pen + pond + geysers
      expect(LEVELS[2].map.obstacles.some((o) => o.kind === "log" && o.low)).toBe(true);
      expect(LEVELS[3].map.water.length).toBe(1);
      expect(LEVELS[3].map.bridges.length).toBe(2);
      expect(LEVELS[4].map.vents.length).toBe(4);
      expect(LEVELS[5].map.obstacles.filter((o) => o.kind === "fence").length).toBeGreaterThanOrEqual(4);
      expect(LEVELS[5].map.water.length).toBe(1);
      expect(LEVELS[5].map.vents.length).toBe(2);
   });
});

function describeValley(id: (typeof LEVEL_IDS)[number]) {
   const level = LEVELS[id];
   const map: ValleyMap = level.map;
   const lanes = lanesFor(level);

   describe(`dino-egg-rescue valley L${id} (${map.theme})`, () => {
      it("the gullies run inside the valley and keep >= 2 m (edge to band) from the nest, the start and every mud pit", () => {
         for (const lane of lanes) {
            for (const [x, z] of [[lane.startX, lane.startZ], [lane.endX, lane.endZ]]) {
               expect(x).toBeGreaterThanOrEqual(VALLEY_BOUNDS.min.x);
               expect(x).toBeLessThanOrEqual(VALLEY_BOUNDS.max.x);
               expect(z).toBeGreaterThanOrEqual(VALLEY_BOUNDS.min.z);
               expect(z).toBeLessThanOrEqual(VALLEY_BOUNDS.max.z);
            }
            expect(Math.hypot(lane.endX - lane.startX, lane.endZ - lane.startZ)).toBeGreaterThan(6);
            expect(laneEdgeClearance(map.nest.x, map.nest.z, NEST.radius, lane), `nest / lane ${lane.id}`).toBeGreaterThanOrEqual(2);
            expect(laneEdgeClearance(map.nest.x, map.nest.z, DINO.radius, lane)).toBeGreaterThanOrEqual(2);
            for (const m of map.mud) expect(laneEdgeClearance(m.x, m.z, MUD.radius, lane), `mud ${m.id} / lane ${lane.id}`).toBeGreaterThanOrEqual(2);
         }
      });

      it("water and vents stay off every band, and solids keep clear of the boulders' path", () => {
         for (const lane of lanes) {
            for (const w of map.water) expect(laneToBox(lane, w) - BOULDERS.contactBandHalfWidth, `water / lane ${lane.id}`).toBeGreaterThanOrEqual(0.3);
            for (const v of map.vents) expect(laneEdgeClearance(v.x, v.z, v.r + VENT_REACH, lane), `vent / lane ${lane.id}`).toBeGreaterThanOrEqual(0.3);
            for (const o of map.obstacles) {
               const d = Math.min(
                  pointToSegmentDistanceXZ(o.ax, o.az, lane.startX, lane.startZ, lane.endX, lane.endZ),
                  pointToSegmentDistanceXZ(o.bx, o.bz, lane.startX, lane.startZ, lane.endX, lane.endZ),
                  pointToSegmentDistanceXZ((o.ax + o.bx) / 2, (o.az + o.bz) / 2, lane.startX, lane.startZ, lane.endX, lane.endZ)
               );
               expect(d - o.r - BOULDERS.contactBandHalfWidth, `${o.kind} (${o.ax}, ${o.az}) / lane ${lane.id}`).toBeGreaterThanOrEqual(0.3);
            }
         }
      });

      it("the nest is clear: no solid, mud, water or vent within reach of its delivery ring", () => {
         const { x, z } = map.nest;
         for (const o of map.obstacles) expect(obstacleDistance(x, z, o)).toBeGreaterThanOrEqual(NEST.radius);
         for (const m of map.mud) expect(Math.hypot(m.x - x, m.z - z)).toBeGreaterThan(NEST.radius + MUD.radius);
         for (const v of map.vents) expect(Math.hypot(v.x - x, v.z - z)).toBeGreaterThan(NEST.radius + v.r + 1);
         for (const w of map.water) expect(boxDistance(x, z, w)).toBeGreaterThan(NEST.radius + 1);
         // vents keep off mud and water too (so the escape below runs on firm ground)
         for (const v of map.vents) {
            for (const m of map.mud) expect(Math.hypot(m.x - v.x, m.z - v.z)).toBeGreaterThan(MUD.radius + v.r + VENT_REACH + DINO.radius);
            for (const w of map.water) expect(boxDistance(v.x, v.z, w)).toBeGreaterThan(v.r + VENT_REACH + DINO.radius);
         }
      });

      it("every free spot of the valley is reachable from the start without a dash (logs are walls here)", () => {
         const g = navGrid(map);
         const start = cellNear(g, map.nest.x, map.nest.z, 0.2);
         expect(start).toBeGreaterThanOrEqual(0);
         const t = travelTimes(g, start, DINO.baseSpeed);
         let free = 0;
         let unreached = 0;
         for (let k = 0; k < t.length; k++) {
            if (!g.free[k]) continue;
            free++;
            if (!Number.isFinite(t[k])) unreached++;
         }
         expect(free).toBeGreaterThan(5000);
         expect(unreached).toBe(0);
      });

      it("eggs (start pile, spawn ticks, goldens, scatters) land on clear ground, reachable from the start", () => {
         const g = navGrid(map);
         const t = travelTimes(g, cellNear(g, map.nest.x, map.nest.z, 0.2), DINO.baseSpeed);
         const check = (x: number, z: number, what: string) => {
            expect(isValidGroundSpot(x, z, 0.2, map), `${what} (${x.toFixed(2)}, ${z.toFixed(2)})`).toBe(true);
            const k = cellNear(g, x, z, EGGS.pickupRadius - 0.05);
            expect(k, `${what} (${x.toFixed(2)}, ${z.toFixed(2)}) reachable`).toBeGreaterThanOrEqual(0);
            expect(Number.isFinite(t[k])).toBe(true);
         };
         for (let seed = 1; seed <= 300; seed++) {
            const run = createDinoRun(seed * 7919, level);
            for (const e of run.groundEggs) check(e.x, e.z, "start egg");
            for (const tt of [3, 30, 60, 90, 105]) {
               const p = sampleEggSpot(run.rng, tt, map);
               check(p.x, p.z, `egg at ${tt} s`);
            }
            // a golden next to a random free spot, and a scatter from it
            const k = (seed * 104729) % g.free.length;
            if (!g.free[k]) continue;
            const x = g.x0 + (k % g.nx) * g.cell;
            const z = g.z0 + Math.floor(k / g.nx) * g.cell;
            const gold = sampleGoldenEggSpot(run.rng, x, z, map);
            check(gold.x, gold.z, "golden");
            for (let a = 0; a < 4; a++) {
               const s = pushToValidGroundSpot({ x: x + Math.cos(a * 1.57) * EGGS.scatterDistance, z: z + Math.sin(a * 1.57) * EGGS.scatterDistance }, 0.4, map);
               check(s.x, s.z, "scatter");
            }
         }
      });

      it("a golden egg is reachable inside its 8 s even with a full stack (mud and water priced in)", () => {
         const g = navGrid(map);
         const slowest = DINO.baseSpeed * Math.min(...level.stackMultipliers);
         let worst = 0;
         const field = new Float64Array(g.nx * g.nz);
         for (let seed = 1; seed <= 30; seed++) {
            const k = (seed * 7907) % g.free.length;
            if (!g.free[k]) continue;
            const x = g.x0 + (k % g.nx) * g.cell;
            const z = g.z0 + Math.floor(k / g.nx) * g.cell;
            const run = createDinoRun(seed, level);
            travelTimes(g, k, slowest, field);
            for (let n = 0; n < 5; n++) {
               const gold = sampleGoldenEggSpot(run.rng, x, z, map);
               const q = cellNear(g, gold.x, gold.z, EGGS.goldenPickupRadius - 0.05);
               expect(q, `golden (${gold.x.toFixed(2)}, ${gold.z.toFixed(2)})`).toBeGreaterThanOrEqual(0);
               worst = Math.max(worst, field[q]);
            }
         }
         expect(worst).toBeLessThan(EGGS.goldenDespawnS);
      });

      it("a glowing vent leaves time to step off it, even with a full stack", () => {
         const slowest = DINO.baseSpeed * Math.min(...level.stackMultipliers);
         for (const v of map.vents) {
            expect((v.r + VENT_REACH) / slowest).toBeLessThan(VENT.warnS * 0.6);
            // the cycle: quiet most of the time, a warning, then the eruption
            let quiet = 0, warn = 0, erupt = 0;
            for (let t = 0; t < v.periodS; t += 0.01) {
               const s = ventState(v, t);
               if (s === 0) quiet++;
               else if (s === 1) warn++;
               else erupt++;
            }
            expect(warn * 0.01).toBeCloseTo(VENT.warnS, 1);
            expect(erupt * 0.01).toBeCloseTo(VENT.eruptS, 1);
            expect(quiet * 0.01).toBeGreaterThan(VENT.warnS + VENT.eruptS);
         }
      });

      it("wading is slow and drifts, but never past the walking speed's escape (the current < a full-stack walk)", () => {
         const slowest = DINO.baseSpeed * Math.min(...level.stackMultipliers);
         for (const w of map.water) expect(Math.hypot(w.flowX, w.flowZ)).toBeLessThan(slowest * WATER.speedMultiplier);
      });
   });
}

for (const id of LEVEL_IDS) describeValley(id);
