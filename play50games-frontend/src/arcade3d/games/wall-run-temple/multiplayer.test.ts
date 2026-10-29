// Local multiplayer: seats side by side, shared orbs, co-op shares the furthest checkpoint, the race ends
// after the grace once someone finishes.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, placings, stepMulti } from "./multiplayer";

describe("multiplayer", () => {
   it("two seats side by side share the orbs; two bots race to a result", () => {
      const m = createMultiRun(4, 1, ["kiro", "riko"], "versus");
      expect(m.runs).toHaveLength(2);
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      expect(m.runs[0].hero.z).not.toBe(m.runs[1].hero.z);
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 20_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].finished).toBe(true);
   });

   it("co-op pulls the trailing hero's checkpoint up to the leader's", () => {
      const m = createMultiRun(4, 1, ["kiro", "nami"], "coop");
      m.runs[0].checkpoint = 3;
      stepMulti(m, 16, [createStepInput(), createStepInput()]);
      expect(m.runs[1].checkpoint).toBe(3);
   });
});
