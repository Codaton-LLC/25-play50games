import { describe, it, expect } from "vitest";
import { createMultiRun, stepMulti, orbNeeded } from "./multiplayer";
import { botInput } from "./bot";
describe("local relay and race", () => {
   it("keeps an orb visible for another active player after P1 collects or finishes", () => {
      const g = createMultiRun(1, ["riko", "nami"], "versus");
      g.runs[0].collected[0] = 1;
      expect(orbNeeded(g.runs, 0)).toBe(true);
      g.runs[0].ended = "win";
      expect(orbNeeded(g.runs, 0)).toBe(true);
      g.runs[1].collected[0] = 1;
      expect(orbNeeded(g.runs, 0)).toBe(false);
   });
   for (const mode of ["coop", "versus"] as const) for (const count of [2, 4]) {
      it(`${count} players ${mode}: independent simulations complete together`, () => {
         const g = createMultiRun(1, (["nami", "riko", "kiro", "vexa"] as const).slice(0, count), mode);
         expect(new Set(g.runs.map((r) => r.collected)).size).toBe(count);
         for (let f = 0; f < 12000 && !g.ended; f++) stepMulti(g, 1000 / 60, g.runs.map(botInput));
         expect(g.ended).toBe("win"); expect(g.runs.every((r) => r.ended === "win")).toBe(true);
      });
   }
});
