// Local multiplayer: N runs from one seed share the orbs, the smashed boards and the jams; co-op
// spreads shield / magnet / phase; a versus race ends after the grace; a co-op team clears when all
// are through; two honest bots race level 1.
import { describe, expect, it } from "vitest";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, leaderIndex, placings, stepMulti, team } from "./multiplayer";

describe("roll-cannon-jump multiplayer", () => {
   it("the runs share the orbs and the boards", () => {
      const m = createMultiRun(1, 1, ["riko", "nami"], "versus");
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      expect(m.runs[0].broken).toBe(m.runs[1].broken);
      expect(m.runs[1].heroId).toBe("nami");
   });

   it("co-op: Kiro's shield covers the team", () => {
      const m = createMultiRun(1, 2, ["kiro", "vexa"], "coop");
      const inputs: StepInput[] = [{ ...createStepInput(), actionPressed: true }, createStepInput()];
      m.runs[0].hero.mode = "fly";
      stepMulti(m, 16, inputs);
      expect(m.runs[1].hero.shieldUntil).toBe(m.runs[0].hero.shieldUntil);
      expect(m.runs[1].hero.shieldUntil).toBeGreaterThan(0);
   });

   it("two honest bots race level 1 to the end (versus): placings and a leader", () => {
      const m = createMultiRun(1, 1, ["riko", "zuno"], "versus");
      const bots = m.runs.map((r) => createBot(r));
      const inputs = m.runs.map(() => createStepInput());
      for (let f = 0; f < 20_000 && m.ended === null; f++) {
         m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
         stepMulti(m, 1000 / 60, inputs);
      }
      expect(m.ended).toBe("win");
      expect(placings(m)[0].place).toBe(1);
      expect(leaderIndex(m)).toBeGreaterThanOrEqual(0);
      const c = createMultiRun(1, 1, ["riko", "zuno"], "coop");
      expect(team(c).cleared).toBe(false);
   }, 120_000);
});
