// Local multiplayer: N runs from one seed share the orbs and the urn; co-op spreads shield / magnet /
// phase; two honest bots race level 1 to a winner; a co-op team of two bots clears it.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";

describe("spin-pole-climb multiplayer", () => {
   it("the runs share the orbs and the urn", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "versus");
      expect(m.runs[0].orbTaken).toBe(m.runs[1].orbTaken);
      expect(m.runs[0].urnBroken).toBe(m.runs[1].urnBroken);
      expect(m.runs[1].heroId).toBe("nami");
   });

   it("co-op: a shield, a magnet and a phase cover the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "vexa"], "coop");
      const [a, b] = m.runs;
      a.shieldUntil = 5000;
      a.magnetUntil = 4000;
      a.phaseUntil = 3000;
      onAllyPower({ source: a, ally: b, power: "shield" } as never);
      onAllyPower({ source: a, ally: b, power: "magnet" } as never);
      onAllyPower({ source: a, ally: b, power: "phase" } as never);
      expect([b.shieldUntil, b.magnetUntil, b.phaseUntil]).toEqual([5000, 4000, 3000]);
   });

   it("two honest bots race level 1 to the end (versus): placings and a leader", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 40_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].place).toBe(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
   }, 120_000);

   it("a co-op team of two bots clears level 1 together", () => {
      const m = createMultiRun(2, 1, ["kiro", "riko"], "coop");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 40_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
   }, 120_000);
});
