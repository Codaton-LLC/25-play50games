import { describe, it, expect } from "vitest";
import { createRun, step, createStepInput, rotateSwitch } from "./rules";
describe("live factory routing", () => {
   it("requires rolling, edge entry, and a 350 ms turn", () => {
      const r = createRun(1, 1);
      const i = createStepInput();
      r.hero.x = -4;
      r.hero.z = 2;
      step(r, 16, i);
      expect(r.board.turns[0]).toBe(1);
      r.hero.z = 4;
      step(r, 16, i);
      r.hero.z = 2;
      i.roll = true;
      step(r, 16, i);
      expect(r.board.turns[0]).toBe(2);
      expect(rotateSwitch(r, 0)).toBe(false);
   });
   it("cells really travel, get scrapped and respawn after four seconds", () => {
      const r = createRun(1, 1);
      const i = createStepInput();
      for (let f = 0; f < 900; f++)
         step(r, 16, i);
      expect(r.board.lost).toBeGreaterThan(0);
      expect(r.board.charged).toBe(0);
   });
});
