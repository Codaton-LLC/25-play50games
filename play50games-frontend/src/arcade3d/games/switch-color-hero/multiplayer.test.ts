// Local multiplayer: seats in different lanes, co-op shares the pickups and the furthest checkpoint, the
// race ends after the grace once someone finishes.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, placings, stepMulti } from "./multiplayer";

describe("multiplayer", () => {
   it("two seats in different lanes; co-op shares the pickups; two bots race to a result", () => {
      const coop = createMultiRun(4, 1, ["riko", "nami"], "coop");
      expect(coop.runs[0].collected).toBe(coop.runs[1].collected);
      const m = createMultiRun(4, 1, ["riko", "nami"], "versus");
      expect(m.runs[0].hero.lane).not.toBe(m.runs[1].hero.lane);
      expect(m.runs[0].collected).not.toBe(m.runs[1].collected);
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
      const m = createMultiRun(4, 2, ["riko", "kiro"], "coop");
      m.runs[0].checkpoint = -120;
      stepMulti(m, 16, [createStepInput(), createStepInput()]);
      expect(m.runs[1].checkpoint).toBe(-120);
   });
});
