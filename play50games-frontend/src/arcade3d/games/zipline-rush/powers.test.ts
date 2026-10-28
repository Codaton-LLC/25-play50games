import { describe, expect, it } from "vitest";
import { createRun, step, idleInput, cablePoint } from "./rules";
import { botInput } from "./bot";
import { defaultHeroFor } from "../../menu2/heroes/heroPick";
describe("heroes have physical roles", () => {
   it("preselects the W2 lead Nami", () => expect(defaultHeroFor("zipline-rush")).toBe("nami"));
   for (const hero of ["nami", "riko"] as const) it(`${hero} catches a genuinely separate cable after an airborne power`, () => {
      const r = createRun(2, hero); let jumped = false, reached = false;
      for (let f = 0; f < 5000 && !r.ended; f++) {
         const i = botInput(r);
         if (r.section === 1 && r.t > 0.35 && r.t < 0.4 && !jumped && r.mode === "ride") { i.jump = true; jumped = true; }
         if (jumped && r.mode === "air" && r.airMs > 75 && r.airMs < 110) { i.power = true; i.x = hero === "riko" ? 1 : 0; }
         step(r, 1000 / 60, i);
         if (r.lane === (hero === "nami" ? 2 : 3)) reached = true;
      }
      expect(reached).toBe(true); expect(r.secrets.found[2]).toBe(1);
   });
   it("Zuno collects the other cable's orb without moving to it", () => {
      const z = createRun(2, "zuno"), n = createRun(2, "nami");
      for (const r of [z, n]) { r.mode = "ride"; r.t = 0.54; r.lane = 0; Object.assign(r.hero, cablePoint(r.cfg, 0, 0, 0.54)); }
      step(z, 17, { ...idleInput(), power: true }); step(n, 17, idleInput());
      expect(z.collected[2]).toBe(1); expect(n.collected[2]).toBe(0);
   });
   it("Vexa enters the short inner signal line only while phasing", () => {
      const r = createRun(2, "vexa"); r.section = 1; r.mode = "ride"; r.t = 0.4;
      step(r, 17, { ...idleInput(), power: true });
      expect(r.lane).toBe(4); expect(r.secrets.found[1]).toBe(1);
   });
   it("Kiro can cross the same live spark storm without a hit", () => {
      const k = createRun(4, "kiro"), n = createRun(4, "nami");
      for (const r of [k, n]) { r.section = 1; r.mode = "ride"; r.t = 0.36; r.lane = 0; }
      step(k, 17, { ...idleInput(), power: true }); step(n, 17, idleInput());
      expect(k.hits).toBe(0); expect(n.hits).toBe(1);
   });
});
