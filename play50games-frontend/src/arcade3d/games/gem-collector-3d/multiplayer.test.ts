// Local multiplayer (menu2/multiplayer): one floor of gems for everyone (a gem in one train is gone
// for the others), versus ranks by score, co-op adds the scores up toward the target; both run to the
// end with bots; multiplayer runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { GEM, createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, stepMulti, teamScore } from "./multiplayer";
import { gemCollector3dMeta } from "./meta";

function play(mode: "versus" | "coop") {
   const m = createMultiRun(7, 1, ["zuno", "nami"], mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 20_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("one floor: the players share the gem states; a gem in one train never joins another", () => {
      const m = createMultiRun(7, 1, ["zuno", "nami"], "versus");
      expect(m.runs[0].gemState).toBe(m.runs[1].gemState);
      expect(m.runs[0].chestOpen).not.toBe(m.runs[1].chestOpen);
      const done = play("versus");
      const seen = new Set<number>();
      for (const r of done.runs) for (let k = 0; k < r.n; k++) {
         expect(seen.has(r.links[k])).toBe(false);
         seen.add(r.links[k]);
         expect(done.runs[0].gemState[r.links[k]]).toBe(GEM.train);
      }
      expect(done.ended).not.toBeNull();
      const p = placings(done);
      expect(p[0].place).toBe(1);
      const best = Math.max(...done.runs.map((r) => r.score));
      expect(done.runs[p[0].index].score).toBe(best);
   }, 120_000);

   it("co-op: the chests and slimes are the team's; the team's banks add up to clear the target", () => {
      const m = createMultiRun(7, 3, ["zuno", "nami"], "coop");
      expect(m.runs[0].slimeAlive).toBe(m.runs[1].slimeAlive);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(teamScore(done)).toBeGreaterThanOrEqual(300);
   }, 120_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(gemCollector3dMeta.scoring, "win", 2)).toBe(false);
   });
});
