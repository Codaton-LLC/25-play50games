// Local multiplayer: one arena, one set of orbs owned by seat 0; a block scores for the hero who made it;
// the partners end with the owner.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, placings, stepMulti } from "./multiplayer";

describe("multiplayer", () => {
   it("the seats share the orbs, the beacon and the boss; seat 0 owns them", () => {
      const m = createMultiRun(4, 5, ["riko", "nami"], "coop");
      expect(m.runs[1].orbs).toBe(m.runs[0].orbs);
      expect(m.runs[1].shared).toBe(m.runs[0].shared);
      expect(m.runs[1].boss).toBe(m.runs[0].boss);
      expect(m.runs[0].owner && !m.runs[1].owner).toBe(true);
      expect(m.runs[0].partners).toEqual([m.runs[1]]);
   });

   it("two bots hold level 1 together and both score", () => {
      const m = createMultiRun(4, 1, ["riko", "kiro"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 20_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(m.runs.every((r) => r.ended === "win")).toBe(true);
      expect(m.runs[0].score + m.runs[1].score).toBeGreaterThan(0);
      expect(placings(m).length).toBe(2);
   });
});
