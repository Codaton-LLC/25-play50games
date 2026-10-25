import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { postman3dMeta } from "./meta";
import { createRun, step, OFFICE, PROPOSED_LEVEL_LIMITS } from "./rules";

describe("five neighbourhood configurations", () => {
   it("keeps the stub owner and exposes the five approved item totals", () => {
      expect(postman3dMeta.owner).toBe("claude");
      expect(postman3dMeta.status).toBe("dev");
      expect(postman3dMeta.levels?.map((l) => l.scoring)).toEqual(LEVEL_IDS.map((id) => PROPOSED_LEVEL_LIMITS[id]));
      expect(LEVEL_IDS.map((id) => LEVELS[id].letters + LEVELS[id].parcels)).toEqual([4, 6, 8, 10, 14]);
   });
   for (const id of LEVEL_IDS) {
      it(`L${id}: 200 seeds have reachable doors and mailboxes, bounded inventory and correct hazards`, () => {
         for (let seed = 0; seed < 200; seed++) {
            const r = createRun(seed, LEVELS[id]);
            expect(r.dogs).toHaveLength(LEVELS[id].dogs);
            expect(r.cars).toHaveLength(LEVELS[id].traffic);
            expect(r.lives).toBe(id >= 4 ? 3 : null);
            expect(r.items.filter((i) => i.loaded && i.kind === "letter").length).toBeLessThanOrEqual(LEVELS[id].bagCap);
            expect(r.items.filter((i) => i.loaded && i.kind === "parcel").length).toBeLessThanOrEqual(1);
            // Check the actual mover/collider, with hazards removed only for the reachability probe.
            r.cars.length = 0; r.dogs.length = 0;
            for (const h of r.houses) {
               const street = Math.round(h.mailZ / 20) * 20;
               Object.assign(r.hero, { x: h.x, z: street, stun: 0 });
               for (let f = 0; f < 35; f++) step(r, { moveX: 0, moveY: h.side, yaw: 0, actionPressed: false }, 0.05);
               expect(Math.abs(r.hero.z - h.doorZ)).toBeLessThan(1.2);
               expect(r.hero.x).toBeGreaterThan(r.bounds.min.x);
               expect(r.hero.x).toBeLessThan(r.bounds.max.x);
               expect(Math.abs(h.doorZ - h.mailZ)).toBe(3);
            }
         }
      });
   }
   it("parks the player clear of traffic and the post-office building", () => {
      const r = createRun(5, LEVELS[5]);
      expect(r.hero.x).toBe(OFFICE.x); expect(r.hero.z).toBe(OFFICE.z);
      for (let i = 0; i < 4200; i++) step(r, { moveX: 0, moveY: 0, yaw: 0, actionPressed: true }, 0.05);
      expect(r.lives).toBe(3); expect(r.score).toBe(0);
   });
   it("keeps the courier outside the post-office roof while its counter stays reachable", () => {
      const r = createRun(5, LEVELS[1]);
      for (let i = 0; i < 100; i++) step(r, { moveX: 0, moveY: -1, yaw: 0, actionPressed: false }, 0.05);
      expect(r.hero.z).toBeGreaterThan(-5.4);
      expect(r.hero.z).toBeLessThan(OFFICE.z);
   });
});
