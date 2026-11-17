// guide.ts: the beacon and the hint follow the run and never change it.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { LEVELS } from "./levels";
import { hintCode, hintFor, targetShip } from "./guide";
import { SEA, SHIP_SAILING, createRun } from "./rules";

describe("pirate-cannons guide", () => {
   it("marks the sailing ship nearest the harbour and never changes the run", () => {
      for (const id of LEVEL_IDS) {
         const run = createRun(5, LEVELS[id]);
         for (const s of run.ships) s.state = SHIP_SAILING;
         run.ships[0].rider.position.x = 3;
         run.ships[1].rider.position.x = 9;
         const before = JSON.stringify(run.ships.map((s) => [s.state, s.rider.position.x]));
         expect(targetShip(run)?.rider.position.x).toBeGreaterThanOrEqual(9);
         expect(JSON.stringify(run.ships.map((s) => [s.state, s.rider.position.x]))).toBe(before);
      }
   });

   it("warns near the harbour, teaches the drag first and is never empty", () => {
      const run = createRun(5, LEVELS[1]);
      expect(targetShip(run)).toBeNull();
      expect(hintCode(run)).toBe(1);
      run.ships[0].state = SHIP_SAILING;
      run.ships[0].rider.position.x = -10;
      run.nextShot = 1;
      expect(hintFor(hintCode(run), true).text).toMatch(/Drag to turn/);
      run.nextShot = 3;
      expect(hintCode(run)).toBe(2);
      run.ships[0].rider.position.x = SEA.harbourX - 1;
      expect(hintCode(run)).toBe(3);
      expect(hintFor(3, false).tone).toBe("warn");
   });
});
