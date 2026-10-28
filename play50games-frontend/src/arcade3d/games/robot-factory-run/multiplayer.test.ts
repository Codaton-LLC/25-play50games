import { describe, it, expect } from "vitest";
import { createMultiRun, stepMulti } from "./multiplayer";
import { createStepInput } from "./rules";
import { createBot, botInput } from "./bot";
describe("local factory multiplayer", () => {
   it("co-op has one real belt clock, versus has separate chargers", () => {
      const c = createMultiRun(1, 1, ["riko", "nami"], "coop");
      const v = createMultiRun(1, 1, ["riko", "nami"], "versus");
      expect(c.runs[0].board).toBe(c.runs[1].board);
      expect(v.runs[0].board).not.toBe(v.runs[1].board);
      for (let f = 0; f < 180; f++)
         stepMulti(c, 1000 / 60, [createStepInput(), createStepInput()]);
      expect(c.runs[0].board.cells).toHaveLength(1);
      expect(c.runs[0].board.cells[0].x).toBeCloseTo(-5.5, 0);
   });
   for (const mode of ["coop", "versus"] as const)
      it(`${mode}: two honest controllers finish`, () => {
         const m = createMultiRun(1, 1, ["riko", "nami"], mode), bots = m.runs.map(createBot), inputs = m.runs.map(createStepInput);
         for (let f = 0; f < 9000 && !m.ended; f++) {
            m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
            stepMulti(m, 1000 / 60, inputs);
         }
         expect(m.ended).toBe("win");
      });
});
describe("shared factory cooperation and cell theft", () => {
   it("versus middle-belt Roll + Power takes a real rival cell", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "versus");
      for (let f = 0; f < 180; f++)
         stepMulti(m, 1000 / 60, [createStepInput(), createStepInput()]);
      const c = m.runs[1].board.cells[0];
      m.runs[0].hero.x = 0;
      m.runs[0].hero.z = 5;
      const i = createStepInput();
      i.roll = true;
      i.actionPressed = true;
      stepMulti(m, 10, [i, createStepInput()]);
      expect(m.runs[0].board.cells).toContain(c);
      expect(m.runs[1].board.cells).not.toContain(c);
      expect(m.stealReady[0]).toBeGreaterThan(m.simMs);
   });
   it("co-op powers protect an ally and simultaneous outer switches clear jams", () => {
      const m = createMultiRun(1, 4, ["kiro", "nami"], "coop");
      const a = createStepInput(), b = createStepInput();
      a.actionPressed = true;
      stepMulti(m, 10, [a, b]);
      expect(m.runs[1].hero.hurtUntil).toBeGreaterThan(2000);
      m.runs[0].hero.x = -4;
      m.runs[0].hero.z = 2;
      m.runs[1].hero.x = 6;
      m.runs[1].hero.z = 2;
      m.runs[0].board.jamUntil.fill(10000);
      a.roll = b.roll = true;
      a.actionPressed = false;
      stepMulti(m, 10, [a, b]);
      expect(m.runs[0].board.jamUntil).toEqual([0, 0, 0, 0]);
      expect(m.runs[0].board.turns.slice(1, 3)).toEqual([0, 0]);
   });
});
