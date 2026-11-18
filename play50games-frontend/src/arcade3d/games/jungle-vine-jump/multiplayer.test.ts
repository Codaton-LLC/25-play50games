// Local multiplayer: N runs from one seed share the tree (snapped vines, orbs, emeralds); co-op adds
// pumps on a shared vine and spreads shield / magnet / phase; versus makes a shared vine heavy; a hero
// far under the highest is sent back; two honest bots race level 1; a co-op team of two clears it.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { MP_FALL_M, RIVAL_PUMP, TANDEM_PUMP, createMultiRun, leaderIndex, onAllyPower, placings, pumpScales, stepMulti, team } from "./multiplayer";

describe("jungle-vine-jump multiplayer", () => {
   it("the runs share the snapped vines, the orbs and the emeralds", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "versus");
      expect(m.runs[0].downUntil).toBe(m.runs[1].downUntil);
      expect(m.runs[0].orbTaken).toBe(m.runs[1].orbTaken);
      expect(m.runs[0].emeraldTaken).toBe(m.runs[1].emeraldTaken);
      expect(m.runs[1].heroId).toBe("nami");
   });

   it("co-op: two on one vine pump harder together; versus: a rival makes it heavy", () => {
      for (const [mode, k] of [["coop", 1 + TANDEM_PUMP], ["versus", RIVAL_PUMP]] as const) {
         const m = createMultiRun(1, 1, ["kiro", "nami"], mode);
         m.runs[0].hero.vine = 0;
         m.runs[1].hero.vine = 0;
         pumpScales(m);
         expect(m.runs[0].pumpScale, mode).toBeCloseTo(k, 9);
         m.runs[1].hero.vine = -1;
         pumpScales(m);
         expect(m.runs[0].pumpScale).toBe(1);
      }
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

   it("a hero far under the highest is sent back to the last platform", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "versus");
      m.runs[0].hero.y = 30;
      m.runs[1].hero.y = 30 - MP_FALL_M - 3;
      m.runs[1].hero.grounded = false;
      stepMulti(m, 16, m.runs.map(() => createStepInput()));
      expect(m.runs[1].hero.y).toBeLessThan(30 - MP_FALL_M);
      expect(m.runs[1].hits).toBe(1);
   });

   it("two honest bots race level 1 to the end (versus): placings and a leader", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].place).toBe(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
   }, 120_000);

   it("a co-op team of two honest bots clears level 1 together", () => {
      const m = createMultiRun(2, 1, ["kiro", "riko"], "coop");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 60_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
   }, 120_000);
});
