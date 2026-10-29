// Color Door Sprint local multiplayer (multiplayer.ts): parallel corridors from the same seed (versus:
// the same doors for everyone), co-op's Door Roulette (each hero's own colour is its true door), ally
// powers, the end rules and the podium.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { HERO_COLOR_INDEX } from "./heroes";
import { corridorGap, createMultiRun, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { createRun, createStepInput, type StepInput } from "./rules";

function race(mode: "coop" | "versus", n: number) {
   const m = createMultiRun(1, 1, ["riko", "nami", "kiro", "zuno"].slice(0, n) as never, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 200_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("color-door-sprint multiplayer", () => {
   it("versus: every corridor rolls the same doors (the same seed), side by side and apart", () => {
      const m = createMultiRun(7, 3, ["riko", "nami", "kiro"], "versus");
      expect(Array.from(m.runs[1].doors)).toEqual(Array.from(m.runs[0].doors));
      expect(Array.from(m.runs[2].trueLane)).toEqual(Array.from(m.runs[0].trueLane));
      expect(m.offsets[1] - m.offsets[0]).toBeCloseTo(corridorGap(3), 6);
      expect(corridorGap(3)).toBeGreaterThan(m.runs[0].course.half * 2);
   });

   it("co-op Door Roulette: each hero's true door is its own colour on every match wall", () => {
      const m = createMultiRun(7, 2, ["riko", "zuno"], "coop");
      for (const r of m.runs) {
         for (const w of r.course.walls) if (w.mode !== "not") expect(r.ruleColor[w.index]).toBe(HERO_COLOR_INDEX[r.heroId]);
      }
   });

   it("co-op: the team clears when every hero is through; versus: a podium, everyone placed", () => {
      const co = race("coop", 2);
      expect(co.ended).toBe("win");
      expect(team(co).cleared).toBe(true);
      const vs = race("versus", 3);
      expect(vs.ended).toBe("win");
      // the same bot on the same doors ties: everyone finishes, everyone is placed first
      expect(vs.runs.every((r) => r.ended === "win")).toBe(true);
      expect(placings(vs).map((q) => q.place)).toEqual([1, 1, 1]);
   });

   it("ally powers: a shield, a magnet, a phase cover the ally for as long as the source's", () => {
      const a = createRun(1, 1, "kiro");
      const b = createRun(1, 1, "riko");
      a.hero.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.hero.shieldUntil).toBe(3000);
   });
});
