// Local multiplayer (multiplayer.ts): carts in a start column whose head start is given back, shared
// orbs and shortcuts, co-op and versus endings, ally powers, every run stepped in lock-step.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { START_GAP, cartTimeMs, createMultiRun, leaderIndex, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { createStepInput, runTimeMs, type StepInput } from "./rules";
import type { HeroId } from "./heroes";

function botMulti(mode: "coop" | "versus", heroes: HeroId[], level: 1 | 2 | 5 = 1) {
   const m = createMultiRun(7, level, heroes, mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 300 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("the carts start in a column (P1 in front); the head start is given back in the time", () => {
      const m = createMultiRun(1, 1, ["riko", "nami", "kiro"], "versus");
      expect(m.runs.map((r) => r.cart.s)).toEqual([2 * START_GAP, START_GAP, 0]);
      expect(m.startMs[0]).toBe(Math.round(((2 * START_GAP) / 14) * 1000));
      m.runs[0].ended = "win";
      m.runs[0].finishMs = 50_000;
      expect(cartTimeMs(m, 0)).toBe(runTimeMs(50_000, 0, 0) + m.startMs[0]);
      expect(leaderIndex(m)).toBe(1);
   });

   it("co-op: two bots clear level 1 together; the orbs are shared (no orb is taken twice)", () => {
      const m = botMulti("coop", ["riko", "zuno"]);
      expect(m.ended).toBe("win");
      expect(team(m).cleared).toBe(true);
      expect(m.runs[0].orbs + m.runs[1].orbs).toBeLessThanOrEqual(m.runs[0].course.orbs.length);
      for (let k = 0; k < m.runs[0].collected.length; k++) expect(m.runs[0].collected[k]).toBe(m.runs[1].collected[k]);
   }, 60_000);

   it("versus: three bots race level 1; the podium ranks the finishers by time", () => {
      const m = botMulti("versus", ["riko", "vexa", "kiro"]);
      expect(m.ended).toBe("win");
      const p = placings(m);
      expect(p[0].place).toBe(1);
      expect(p[0].finished).toBe(true);
   }, 60_000);

   it("co-op ally powers: Kiro's shield, Zuno's magnet and Vexa's phase reach the ally", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "coop");
      const [a, b] = m.runs;
      a.cart.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.cart.shieldUntil).toBe(3000);
      a.cart.phaseUntil = 2000;
      onAllyPower({ from: 0, to: 1, power: "phase", source: a, ally: b });
      expect(b.cart.phaseUntil).toBe(2000);
      a.cart.magnetUntil = 1000;
      onAllyPower({ from: 0, to: 1, power: "magnet", source: a, ally: b });
      expect(b.cart.magnetUntil).toBe(1000);
   });
});
