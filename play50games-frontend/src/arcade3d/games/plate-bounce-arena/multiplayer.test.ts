// Local multiplayer: co-op shares the table's progress and orbs; versus keeps them apart; two bots
// reach a result.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, placings, stepMulti } from "./multiplayer";

describe("multiplayer", () => {
   it("co-op shares the sections and the orbs; versus does not", () => {
      const coop = createMultiRun(4, 1, ["zuno", "riko"], "coop");
      expect(coop.runs[0].prog).toBe(coop.runs[1].prog);
      expect(coop.runs[0].collected).toBe(coop.runs[1].collected);
      const vs = createMultiRun(4, 1, ["zuno", "riko"], "versus");
      expect(vs.runs[0].prog).not.toBe(vs.runs[1].prog);
      expect(vs.runs[1].versus).toBe(true);
   });

   it("two bots in co-op clear the table together", () => {
      const m = createMultiRun(4, 1, ["zuno", "kiro"], "coop");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60 * 300 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].finished).toBe(true);
   }, 300_000);
});
