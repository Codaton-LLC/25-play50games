// Local multiplayer (menu2/multiplayer): versus keeps each player's own sections (rings, doors,
// rounds, cores), co-op shares one corridor (a section done by anyone opens its exit for all); both
// run to the end with bots; multiplayer runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, progressOf, stepMulti, team } from "./multiplayer";
import { ultimateColorTrialMeta } from "./meta";

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
   it("versus: each player's own sections and colour; the gems are shared; first home wins", () => {
      const m = createMultiRun(7, 1, ["zuno", "nami"], "versus");
      expect(m.runs[0].secDone).not.toBe(m.runs[1].secDone);
      expect(m.runs[0].ringNext).not.toBe(m.runs[1].ringNext);
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      expect(m.runs[0].hero.x).not.toBe(m.runs[1].hero.x);
      const done = play("versus");
      expect(done.ended).toBe("win");
      expect(placings(done)[0].place).toBe(1);
   }, 90_000);

   it("co-op: one shared corridor (a section done by one is done for both), the team clears together", () => {
      const m = createMultiRun(7, 1, ["zuno", "nami"], "coop");
      expect(m.runs[0].secDone).toBe(m.runs[1].secDone);
      expect(m.runs[0].ringNext).toBe(m.runs[1].ringNext);
      expect(m.runs[0].rowNext).toBe(m.runs[1].rowNext);
      expect(m.runs[0].coreState).toBe(m.runs[1].coreState);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(done.runs.every((r) => r.ended === "win")).toBe(true);
      expect(team(done).cleared).toBe(true);
      expect(progressOf(done.runs[0])).toBeGreaterThanOrEqual(progressOf(m.runs[0]));
   }, 90_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(ultimateColorTrialMeta.scoring, "win", 2)).toBe(false);
   });
});
