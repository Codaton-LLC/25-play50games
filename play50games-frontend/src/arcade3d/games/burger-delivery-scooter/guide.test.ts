// guide.ts: the beacons go to the shop, then to the active door; read-only.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "../../types";
import { LEVELS } from "./levels";
import { burgerHint, hintCode, nextGoal, type Goal } from "./guide";
import { createRun } from "./rules";

const fresh = (): Goal => ({ kind: 0, x: 0, z: 0 });

describe("burger-delivery-scooter guide", () => {
   it("points at the shop, then at the next door, and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(4, id, LEVELS[id]);
         const before = JSON.stringify(run);
         expect(nextGoal(run, fresh())).toMatchObject({ kind: 1, x: run.shop.x, z: run.shop.z });
         expect(JSON.stringify(run)).toBe(before);
         run.carrying = true;
         expect(nextGoal(run, fresh())).toMatchObject({ kind: 2, x: run.doors[0].x, z: run.doors[0].z });
         run.delivered = 1;
         const second = run.doors[Math.min(1, run.doors.length - 1)];
         expect(nextGoal(run, fresh())).toMatchObject({ kind: 2, x: second.x, z: second.z });
         run.end = "win";
         expect(nextGoal(run, fresh()).kind).toBe(0);
         expect(hintCode(run)).toBe(0);
      }
   });

   it("says shop or door with the order number, and a new key per order", () => {
      const run = createRun(4, 1, LEVELS[1]);
      const shop = burgerHint(run, hintCode(run));
      expect(shop.text).toMatch(/pink shop/);
      run.carrying = true;
      const door = burgerHint(run, hintCode(run));
      expect(door.text).toMatch(/Order 1 of \d+: stop on the green ring/);
      expect(door.tone).toBe("carry");
      run.carrying = false;
      run.delivered = 1;
      expect(burgerHint(run, hintCode(run)).key).not.toBe(shop.key);
   });
});
