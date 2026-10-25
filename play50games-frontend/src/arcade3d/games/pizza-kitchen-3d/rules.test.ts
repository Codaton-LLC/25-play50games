import { describe, expect, it } from "vitest";
import { createRun, step, useStation, bakeGrade, stations } from "./rules";
import { LEVELS } from "./levels";

describe("pizza kitchen", () => {
   it("seeds identical tickets and gives L1 cheese only", () => {
      expect(createRun(7, LEVELS[3])).toEqual(createRun(7, LEVELS[3]));
      expect(createRun(7, LEVELS[1]).tickets.every(t => t.ingredients.join() === "sauce,cheese")).toBe(true);
   });
   it("grades the exact golden boundaries", () => {
      expect(bakeGrade(5, LEVELS[1])).toBe("perfect");
      expect(bakeGrade(6.5, LEVELS[1])).toBe("good");
      expect(bakeGrade(10, LEVELS[1])).toBe("burnt");
   });
   it("spoils out of order and stuns for half a second", () => {
      const r = createRun(1, LEVELS[2]);
      r.player.x = stations(r.level).find(s => s.id === "dough")!.x;
      r.player.z = -0.6;
      useStation(r, "dough");
      r.player.x = stations(r.level).find(s => s.id === "cheese")!.x;
      step(r, 0.05, 0, 0, false);
      r.time = 0.25;
      useStation(r, "cheese");
      expect(r.prep).toBeNull();
      expect(r.stunUntil).toBe(0.75);
      expect(r.score).toBe(0);
   });
   it("idle and stationary spam never score", () => {
      for (const spam of [false, true]) {
         const r = createRun(2, LEVELS[5]);
         for (let i = 0; i < 4200; i++) step(r, 0.05, 0, 0, spam);
         expect(r.score).toBe(0);
         expect(r.end).toBe("lose");
      }
   });
});


function at(r: ReturnType<typeof createRun>, id: string) {
   r.time = Math.max(r.time, r.nextUse, r.stunUntil);
   r.player.x = stations(r.level).find(s => s.id === id)!.x;
   r.player.z = -0.6;
   useStation(r, id);
}
function load(r: ReturnType<typeof createRun>, oven = "oven0") {
   at(r, "dough");
   const ingredients = r.tickets[r.prep!.ticket].ingredients;
   for (const ing of ingredients) at(r, ing);
   at(r, oven);
}
describe("oven, quota and input edge cases", () => {
   it("burnt pizzas pay nothing and keep the ticket open", () => {
      const r = createRun(1, LEVELS[1]); load(r);
      r.time = r.ovens[0]!.startedAt + 10;
      at(r, "oven0");
      expect(r.ovens[0]).toBeNull(); expect(r.carried).toBeNull();
      expect(r.tickets[0].state).toBe("open"); expect(r.score).toBe(0);
   });
   it("raw takeout leaves an oven baking; two ovens have independent clocks", () => {
      const r = createRun(1, LEVELS[3]); load(r); load(r, "oven1");
      const first = r.ovens[0]!.startedAt;
      expect(r.ovens[1]!.startedAt).toBeGreaterThan(first);
      at(r, "oven0"); expect(r.carried).toBeNull();
      r.time = first + 6;
      at(r, "oven0");
      expect(r.carried?.perfect).toBe(true); expect(r.ovens[1]).not.toBeNull();
   });
   it("expiry pays zero once, clears pizzas and opens a replacement", () => {
      const r = createRun(1, LEVELS[4]);
      r.tickets[1].openedAt = 10;
      load(r); r.time = 44.99;
      step(r, 0.02, 0, 0, false);
      expect(r.expired).toBe(1); expect(r.score).toBe(0); expect(r.ovens[0]).toBeNull();
      expect(r.tickets[2].state).toBe("open");
      step(r, 0.05, 0, 0, false); expect(r.expired).toBe(1);
      r.time = 55; step(r, 0.01, 0, 0, false); expect(r.end).toBe("lose");
   });
   it("serving pays exactly once; L5 requires boxing", () => {
      const r = createRun(2, LEVELS[5]); load(r);
      r.time = r.ovens[0]!.startedAt + 6; at(r, "oven0");
      at(r, "serve"); expect(r.score).toBe(0); expect(r.carried).not.toBeNull();
      at(r, "box"); at(r, "serve"); const paid = r.score;
      expect(paid).toBe(230); at(r, "serve"); expect(r.score).toBe(paid);
   });
   it("identical touch/keyboard events have the same timing, stun and movement", () => {
      const keyboard = createRun(42, LEVELS[5]); const touch = createRun(42, LEVELS[5]);
      for (let i = 0; i < 900; i++) {
         const args = [0.05, Math.sin(i / 25), Math.cos(i / 30), i % 6 === 0] as const;
         step(keyboard, ...args); step(touch, ...args);
      }
      expect(keyboard).toEqual(touch);
   });
   it("win bonus is awarded once and late raw/invalid Uses cannot farm points", () => {
      const r = createRun(1, LEVELS[1]);
      for (let i = 0; i < 3; i++) {
         load(r); r.time = r.ovens[0]!.startedAt + 5; at(r, "oven0"); at(r, "serve");
      }
      expect(r.end).toBe("win"); const paid = r.score;
      for (let i = 0; i < 50; i++) { step(r, 0.05, 1, 1, true); useStation(r, "serve"); }
      expect(r.score).toBe(paid);
   });
});
