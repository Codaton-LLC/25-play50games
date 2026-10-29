// Temple Coin Rush local multiplayer (multiplayer.ts): parallel corridors from the same seed, versus'
// shared coins and held-open toll lanes, co-op's shared purse, ally powers, the end rules and the podium.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { HOLD_OPEN_MS, corridorGap, createMultiRun, onAllyPower, placings, stepMulti, team } from "./multiplayer";
import { GATE, LANES, NONE, TIER, createRun, createStepInput, laneX, type StepInput } from "./rules";

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

const idle = () => [createStepInput(), createStepInput(), createStepInput()];

describe("temple-coin-rush multiplayer", () => {
   it("the corridors stand side by side and apart, on the same course", () => {
      const m = createMultiRun(7, 3, ["riko", "nami", "kiro"], "versus");
      expect(m.offsets[1] - m.offsets[0]).toBeCloseTo(corridorGap(3), 6);
      expect(corridorGap(3)).toBeGreaterThan(m.runs[0].course.half * 2);
      expect(m.runs[1].course).toBe(m.runs[0].course);
      expect(m.purse).toBeNull();
   });

   it("versus: a coin one hero grabs is gone from every corridor", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko"], "versus");
      const coin = m.runs[0].course.coins.findIndex((q) => q.gate === NONE && q.need === 0);
      const q = m.runs[0].course.coins[coin];
      const h = m.runs[0].hero;
      h.z = q.z + 0.5;
      h.lane = Math.round(q.x / 2.4 + 1);
      h.x = q.x;
      stepMulti(m, 16, idle());
      expect(m.runs[0].collected[coin]).toBe(1);
      expect(m.runs[1].collected[coin]).toBe(1);
      expect(m.runs[1].purse.coins).toBe(0);
   });

   it("versus: a toll lane one hero pays stays open for the hero right behind (a free pass), not for one far behind", () => {
      const m = createMultiRun(1, 1, ["kiro", "riko", "nami"], "versus");
      const g = m.runs[0].course.gates[0];
      const toll = g.lanes.findIndex((r) => r.tier !== TIER.slow);
      m.runs.forEach((r, i) => {
         r.hero.lane = toll;
         r.hero.x = laneX(toll);
         r.hero.z = g.z + 0.3 + (i === 0 ? 0 : i === 1 ? 2 : 40);
         r.purse.coins = i === 0 ? 20 : 0;
      });
      for (let f = 0; f < 400 && m.runs[1].nextGate === 0; f++) stepMulti(m, 16, idle());
      expect(m.runs[0].gateResult[0]).toBe(GATE.paid);
      expect(m.runs[1].gateResult[0]).toBe(GATE.free);
      expect(m.runs[2].openUntil[0 * LANES + toll]).toBeGreaterThan(0);
      expect(HOLD_OPEN_MS).toBe(2000);
      for (let f = 0; f < 1000 && m.runs[2].nextGate === 0; f++) stepMulti(m, 16, idle());
      expect(m.runs[2].gateResult[0]).toBe(GATE.shut);
   });

   it("co-op: one shared purse everyone pays from; the team clears when every hero is through", () => {
      const m = createMultiRun(1, 1, ["kiro", "zuno"], "coop");
      expect(m.runs[0].purse).toBe(m.runs[1].purse);
      const co = race("coop", 2);
      expect(co.ended).toBe("win");
      expect(team(co).cleared).toBe(true);
   });

   it("versus: a podium, everyone placed", () => {
      const vs = race("versus", 3);
      expect(vs.ended).toBe("win");
      expect(placings(vs)).toHaveLength(3);
   });

   it("ally powers: a shield, a magnet, a phase cover the ally for as long as the source's", () => {
      const a = createRun(1, 1, "kiro");
      const b = createRun(1, 1, "riko");
      a.hero.shieldUntil = 3000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: a, ally: b });
      expect(b.hero.shieldUntil).toBe(3000);
   });
});
