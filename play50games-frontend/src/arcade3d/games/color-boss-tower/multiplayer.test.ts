// Local multiplayer (menu2/multiplayer): versus is everyone's own tower and guardian (the same
// timings), co-op shares the claws and the orbs (one charge loads the team's cannon); both run to the
// end with bots; multiplayer runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, stepMulti, team } from "./multiplayer";
import { colorBossTowerMeta } from "./meta";

function play(mode: "versus" | "coop") {
   const m = createMultiRun(7, 1, ["riko", "nami"], mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 60 * 160 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("versus: each player has their own claws; the orbs are shared; first to win places first", () => {
      const m = createMultiRun(7, 1, ["riko", "nami"], "versus");
      expect(m.runs[0].claws).not.toBe(m.runs[1].claws);
      expect(m.runs[0].orbTaken).toBe(m.runs[1].orbTaken);
      expect(m.runs[0].hero.a).not.toBe(m.runs[1].hero.a);
      const done = play("versus");
      expect(done.ended).toBe("win");
      expect(placings(done)[0].place).toBe(1);
   }, 60_000);

   it("co-op: the claws are the team's, and the team clears together", () => {
      const m = createMultiRun(7, 1, ["riko", "nami"], "coop");
      expect(m.runs[0].claws).toBe(m.runs[1].claws);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(done.runs.every((r) => r.ended === "win")).toBe(true);
      expect(team(done).cleared).toBe(true);
   }, 60_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(colorBossTowerMeta.scoring, "win", 2)).toBe(false);
   });
});
