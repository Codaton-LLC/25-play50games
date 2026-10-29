// Local multiplayer (menu2/multiplayer): versus keeps each player's own waves, co-op shares one
// playroom (the chains are the team's); both run to the end with bots; multiplayer runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, stepMulti, team } from "./multiplayer";
import { toyRoomRunMeta } from "./meta";

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
   it("versus: each player rides their own waves; the gems are shared; first home wins", () => {
      const m = createMultiRun(7, 1, ["zuno", "nami"], "versus");
      expect(m.runs[0].fallAt).not.toBe(m.runs[1].fallAt);
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      const done = play("versus");
      expect(done.ended).toBe("win");
      expect(placings(done)[0].place).toBe(1);
   }, 60_000);

   it("co-op: one shared playroom (a push starts the chain for both), the team clears together", () => {
      const m = createMultiRun(7, 1, ["zuno", "nami"], "coop");
      expect(m.runs[0].fallAt).toBe(m.runs[1].fallAt);
      expect(m.runs[0].status).toBe(m.runs[1].status);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(done.runs.every((r) => r.ended === "win")).toBe(true);
      expect(team(done).cleared).toBe(true);
   }, 60_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(toyRoomRunMeta.scoring, "win", 2)).toBe(false);
   });
});
