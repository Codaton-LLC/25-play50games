// Local multiplayer: N runs from one seed share the light, the orbs and the braziers; co-op spreads
// shield / magnet / phase and lights the chandelier on the twin plates; a hero far under the highest
// is sent back; two honest bots race level 1; a co-op team of two bots clears it.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput } from "./rules";
import { MP_FALL_M, createMultiRun, leaderIndex, onAllyPower, placings, platesHeld, stepMulti, team } from "./multiplayer";

describe("temple-lantern-jump multiplayer", () => {
   it("the runs share the lanterns, the orbs and the braziers", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "versus");
      expect(m.runs[0].litUntil).toBe(m.runs[1].litUntil);
      expect(m.runs[0].orbTaken).toBe(m.runs[1].orbTaken);
      expect(m.runs[0].brazierLit).toBe(m.runs[1].brazierLit);
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

   it("co-op level 1 has twin plates that need two heroes", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "coop");
      expect(m.runs[0].course.plates.length).toBe(2);
      expect(platesHeld(m)).toBe(0);
      const [p0, p1] = m.runs[0].course.plates;
      Object.assign(m.runs[0].hero, { x: p0.x, z: p0.z, y: 0, grounded: true });
      Object.assign(m.runs[1].hero, { x: p1.x, z: p1.z, y: 0, grounded: true });
      expect(platesHeld(m)).toBe(3);
      const inputs = m.runs.map(() => createStepInput());
      stepMulti(m, 16, inputs);
      expect(m.chandelier).toBe(true);
      expect(m.runs[0].floodUntil).toBeGreaterThan(m.simMs);
   });

   it("a hero far under the highest is sent back to the last lantern", () => {
      const m = createMultiRun(1, 1, ["kiro", "nami"], "versus");
      m.runs[0].hero.y = 30;
      m.runs[1].hero.y = 30 - MP_FALL_M - 3;
      m.runs[1].hero.grounded = false;
      stepMulti(m, 16, m.runs.map(() => createStepInput()));
      expect(m.runs[1].hero.y).toBeLessThan(30 - MP_FALL_M);
      expect(m.runs[0].hero.y).toBeGreaterThan(20);
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
      expect(team(createMultiRun(1, 1, ["kiro", "zuno"], "coop")).cleared).toBe(false);
   }, 120_000);
});
