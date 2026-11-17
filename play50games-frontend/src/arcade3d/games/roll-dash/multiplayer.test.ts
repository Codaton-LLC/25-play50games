// Local multiplayer: N runs on one street, each with a private roster; co-op spreads shield and magnet;
// two honest bots race level 1 to a winner; a co-op team of two bots clears it.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";

describe("roll-dash multiplayer", () => {
   it("the runs share one street, each with its own lead hero", () => {
      const m = createMultiRun(1, 2, ["riko", "riko", "vexa"], "versus");
      expect(m.runs).toHaveLength(3);
      expect(m.runs.map((r) => r.active)).toEqual(["riko", "riko", "vexa"]);
      expect(m.runs[1].items.map((i) => i.d)).toEqual(m.runs[0].items.map((i) => i.d));
   });

   it("co-op: a shield and a magnet cover the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 5000;
      a.magnetUntil = 4000;
      onAllyPower({ source: a, ally: b, power: "shield" } as never);
      onAllyPower({ source: a, ally: b, power: "magnet" } as never);
      expect([b.shieldUntil, b.magnetUntil]).toEqual([5000, 4000]);
   });

   it("two honest bots race level 1 to the end (versus): placings and a leader", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60 * 120 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].place).toBe(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
   }, 120_000);

   it("a co-op team of two bots clears level 1 together", () => {
      const m = createMultiRun(2, 1, ["kiro", "vexa"], "coop");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60 * 120 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
   }, 120_000);
});
