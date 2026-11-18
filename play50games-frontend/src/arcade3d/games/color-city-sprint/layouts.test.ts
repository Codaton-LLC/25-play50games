// The five cities against the card: the signature, the level shapes (laps, beacons, the twists),
// every pickup and beacon where the rules can reach it, every hero's route on every level, and the
// stations Greyout uses on level 5.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS, SIGNATURE } from "./levels";
import { HERO_R, PICKUP_R, RAMP_LEN, TRUCK_HALF_L, blockIndexAt, busAt, courseFor, createBusPose, overRail } from "./city";
import { SECRETS } from "./progression";

describe("the card", () => {
   it("is route-making laps on an open city of blocks", () => {
      expect(SIGNATURE).toBe("route-making laps");
      expect(LEVELS[1].nx - 1).toBe(3);
      expect(LEVELS[1].laps).toBe(2);
      expect(LEVELS[1].beacons).toHaveLength(4);
      expect(LEVELS[2].buses.filter((b) => !b.parked).every((b) => b.cycleMs === 9000)).toBe(true);
      expect(LEVELS[2].beacons.some((b) => "bus" in b)).toBe(true);
      expect(LEVELS[3].gates.length).toBeGreaterThanOrEqual(4);
      expect(LEVELS[4].night).toBe(true);
      expect(LEVELS[4].laps).toBe(3);
      expect(LEVELS[4].ring).not.toBeNull();
      expect(LEVELS[5].boss).toBe(true);
      for (const id of [3, 4, 5] as const) expect([LEVELS[id].nx - 1, LEVELS[id].nz - 1]).toEqual([5, 5]);
   });
});

describe("placement", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: beacons in open street, gems and hazards off the buildings, secrets where their hero gets in, ramps on streets`, () => {
         const c = courseFor(id);
         const solid = (x: number, z: number) => {
            const b = blockIndexAt(c, x, z);
            return b >= 0 && c.blocks[b].kind === "building";
         };
         for (const b of c.beacons) {
            if (b.bus >= 0) continue;
            for (let a = 0; a < 16; a++) {
               const r = PICKUP_R + HERO_R;
               expect(solid(b.x + Math.cos(a) * r, b.z + Math.sin(a) * r), `beacon ${b.x},${b.z}`).toBe(false);
            }
         }
         for (const o of c.orbs) expect(solid(o.x, o.z), `orb ${o.x},${o.z}`).toBe(false);
         for (const s of [...c.sludge, ...c.vents]) expect(solid(s.x, s.z)).toBe(false);
         const list = SECRETS[id];
         c.secrets.forEach((s, i) => {
            const b = blockIndexAt(c, s.x, s.z);
            const kind = b >= 0 ? c.blocks[b].kind : "street";
            if (list[i].id === "rail-sticker") expect(overRail(c, s.x, s.z)).toBe(true);
            else if (list[i].id === "shop-shard") expect(kind).toBe("ghost");
            else if (list[i].id === "site-shard") expect(kind).toBe("site");
            else expect(kind).toBe("plaza");
         });
         for (const r of c.ramps) for (let t = 0; t <= RAMP_LEN; t += 1) expect(solid(r.x - r.dx * t, r.z - r.dz * t)).toBe(false);
         expect(c.edges.length).toBe((c.nx - 1) * c.nz + c.nx * (c.nz - 1));
      });
   }

   it("every level has every hero's route: a site (Riko), a bus under the rail and a ramp (Nami), sludge or vents (Kiro), drains (Zuno), a ghost shop (Vexa)", () => {
      for (const id of LEVEL_IDS) {
         const c = courseFor(id);
         expect(c.blocks.some((b) => b.kind === "site"), `L${id} site`).toBe(true);
         expect(c.blocks.some((b) => b.kind === "ghost"), `L${id} ghost`).toBe(true);
         expect(c.rail, `L${id} rail`).not.toBeNull();
         expect(c.ramps.length).toBeGreaterThan(0);
         expect(c.sludge.length + c.vents.length).toBeGreaterThan(0);
         expect(c.drains.length).toBeGreaterThan(0);
         const pose = createBusPose();
         let under = false;
         for (const b of c.buses) for (let ms = 0; ms < 9000 && !under; ms += 100) {
            busAt(b, ms, pose);
            if (overRail(c, pose.x, pose.z)) under = true;
         }
         expect(under, `L${id} bus under the rail`).toBe(true);
      }
   });

   it("level 5: each brush stop has Greyout's front 1 m past its ramp's lip, facing it; the valve stops are on the avenue", () => {
      const c = courseFor(5);
      for (const s of c.brushStops) {
         const r = c.ramps[s.ramp];
         const fx = s.x + Math.sin(s.yaw) * TRUCK_HALF_L;
         const fz = s.z + Math.cos(s.yaw) * TRUCK_HALF_L;
         expect(Math.hypot(fx - (r.x + r.dx), fz - (r.z + r.dz))).toBeLessThan(0.01);
         expect(Math.sin(s.yaw) * r.dx + Math.cos(s.yaw) * r.dz).toBeCloseTo(-1, 6);
      }
      const avenueZ = c.edges[c.permanentEdges[0]].az;
      for (const s of c.valveStops) expect(s.z).toBe(avenueZ);
      expect(c.gates.length).toBeGreaterThanOrEqual(2);
   });
});
