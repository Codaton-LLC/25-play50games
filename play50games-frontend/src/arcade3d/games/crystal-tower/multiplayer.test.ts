// Local multiplayer (menu2/multiplayer): versus keeps each player's own beacons and sequences,
// co-op shares one tower (the tiers are the team's); both run to the end with bots; multiplayer
// runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, stepMulti, team } from "./multiplayer";
import { crystalTowerMeta } from "./meta";

function play(mode: "versus" | "coop") {
   const m = createMultiRun(7, 1, ["vexa", "nami"], mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 20_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("versus: each player has their own tiers (the same sequences from the seed); the gems are shared; first home wins", () => {
      const m = createMultiRun(7, 1, ["vexa", "nami"], "versus");
      expect(m.runs[0].tiers).not.toBe(m.runs[1].tiers);
      expect(Array.from(m.runs[0].tiers[0].seq)).toEqual(Array.from(m.runs[1].tiers[0].seq));
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      const done = play("versus");
      expect(done.ended).toBe("win");
      expect(placings(done)[0].place).toBe(1);
   }, 120_000);

   it("co-op: one shared tower (a show and a round are the team's), the team clears together", () => {
      const m = createMultiRun(7, 1, ["vexa", "nami"], "coop");
      expect(m.runs[0].tiers).toBe(m.runs[1].tiers);
      expect(m.runs[0].inside).toBe(m.runs[1].inside);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(done.runs.every((r) => r.ended === "win")).toBe(true);
      expect(done.runs[0].tier).toBe(done.runs[1].tier);
      expect(team(done).cleared).toBe(true);
   }, 120_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(crystalTowerMeta.scoring, "win", 2)).toBe(false);
   });
});
