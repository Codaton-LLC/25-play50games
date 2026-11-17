// Each level is its own place (levels.ts `theme`, looks.ts LOOKS) and Glow Marsh / Grand Harvest add
// marsh pools that slow the farmer. Pools never touch a bed's reach, the start or the saucer's beam
// route, and only slow, so the certified limit proof (which relaxes every slowdown) is unchanged.
import { describe, expect, it, vi } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { levelEnvironment } from "@/arcade3d/core/levels";
import definition from "./index";
import { LEVELS, MARSH_POOLS } from "./levels";
import { LOOKS } from "./looks";
import { FARM, FARMER, HARVEST, POOLS, SHIP, createRun, inPool, stepRun } from "./rules";

vi.mock("./Scene", () => ({ default: () => null }));
vi.mock("./Hud", () => ({ default: () => null }));

/** Distance from a point to the saucer's closed route (rectangle of SHIP.waypoints). */
function routeDistance(x: number, z: number): number {
   const w = SHIP.waypoints;
   let best = Infinity;
   for (let i = 0; i < w.length; i++) {
      const a = w[i], b = w[(i + 1) % w.length];
      const dx = b.x - a.x, dz = b.z - a.z;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (a.x + t * dx), z - (a.z + t * dz)));
   }
   return best;
}

describe("alien-farm levels: five places", () => {
   it("every level has its own look, sky and light; level 1 is today's", () => {
      expect(new Set(LEVEL_IDS.map((id) => LEVELS[id].theme)).size).toBe(5);
      expect(LEVELS[1].theme).toBe("starter");
      expect(LEVELS[1].pools).toEqual([]);
      expect(levelEnvironment(definition, 1)).toEqual(definition.environment);
      const skies = new Set<string>();
      for (const id of LEVEL_IDS) {
         const look = LOOKS[LEVELS[id].theme];
         skies.add(look.skyBottom);
         if (id > 1) expect(levelEnvironment(definition, id)).toEqual({ background: look.background, fog: [look.fog, look.fogNear, look.fogFar], lighting: look.lighting });
      }
      expect(skies.size).toBe(5);
   });

   it("marsh pools sit only on Glow Marsh and the Grand Harvest", () => {
      expect(LEVELS[3].pools).toBe(MARSH_POOLS);
      expect(LEVELS[5].pools).toBe(MARSH_POOLS);
      for (const id of [1, 2, 4] as const) expect(LEVELS[id].pools).toHaveLength(0);
   });

   it("pools are fair: clear of every bed's reach, the start and the beam route, inside the farm", () => {
      for (const p of MARSH_POOLS) {
         for (const bed of LEVELS[3].plots) expect(Math.hypot(p.x - bed.x, p.z - bed.z)).toBeGreaterThanOrEqual(p.r + HARVEST.reach + 0.5);
         expect(Math.hypot(p.x - FARMER.startX, p.z - FARMER.startZ)).toBeGreaterThan(p.r + 1);
         expect(routeDistance(p.x, p.z)).toBeGreaterThanOrEqual(p.r + SHIP.beamRadius);
         expect(Math.abs(p.x) + p.r).toBeLessThan(FARM.bounds.max.x);
         expect(Math.abs(p.z) + p.r).toBeLessThan(FARM.bounds.max.z);
      }
   });

   it("a pool only slows (x0.75): the farmer crosses it slower, never faster, and is never stuck", () => {
      const across = (level: typeof LEVELS[1]) => {
         const run = createRun(1, level);
         run.farmer.x = -2.5;
         run.farmer.z = -4.6;
         for (let i = 0; i < 60; i++) stepRun(run, { dirX: 0, dirZ: 1, press: false }, 1 / 60);
         return run.farmer.z;
      };
      const dry = across({ ...LEVELS[3], pools: [] });
      const wet = across(LEVELS[3]);
      expect(wet).toBeLessThan(dry);
      expect(wet).toBeGreaterThan(-4.6 + 0.5);
      expect(POOLS.slow).toBe(0.75);
      expect(inPool(LEVELS[3], -2.5, -2)).toBe(true);
      expect(inPool(LEVELS[3], 0, 0)).toBe(false);
      expect(inPool(LEVELS[1], -2.5, -2)).toBe(false);
   });
});
