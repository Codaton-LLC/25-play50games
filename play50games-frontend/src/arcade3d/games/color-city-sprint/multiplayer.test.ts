// Local multiplayer (menu2/multiplayer): versus keeps each player's own red, co-op relay shares one
// network and alternates the beacons; both run to the end with bots; multiplayer runs are unranked.
import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { createBot, botInput } from "./bot";
import { createStepInput, type StepInput } from "./rules";
import { createMultiRun, placings, relayOwner, stepMulti, team } from "./multiplayer";
import { colorCitySprintMeta } from "./meta";

function play(mode: "versus" | "coop", level: 1 | 2 | 5 = 1) {
   const m = createMultiRun(7, level, ["riko", "nami"], mode);
   const bots = m.runs.map((r) => createBot(r));
   const inputs: StepInput[] = m.runs.map(() => createStepInput());
   for (let f = 0; f < 20_000 && m.ended === null; f++) {
      m.runs.forEach((r, i) => botInput(bots[i], r, inputs[i]));
      stepMulti(m, 1000 / 60, inputs);
   }
   return m;
}

describe("local multiplayer", () => {
   it("versus: each player paints their own lanes; first home wins the podium", () => {
      const m = createMultiRun(7, 1, ["riko", "nami"], "versus");
      expect(m.runs[0].painted).not.toBe(m.runs[1].painted);
      expect(m.runs[0].collected).toBe(m.runs[1].collected);
      const done = play("versus");
      expect(done.ended).toBe("win");
      expect(placings(done)[0].place).toBe(1);
   }, 60_000);

   it("co-op relay: one shared red network, the beacons alternate between the players, the team clears together", () => {
      const m = createMultiRun(7, 1, ["riko", "nami"], "coop");
      expect(m.runs[0].painted).toBe(m.runs[1].painted);
      expect(relayOwner(m)).toBe(0);
      expect(m.runs[0].beaconLocked).toBe(false);
      expect(m.runs[1].beaconLocked).toBe(true);
      const done = play("coop");
      expect(done.ended).toBe("win");
      expect(done.runs.every((r) => r.ended === "win")).toBe(true);
      expect(team(done).cleared).toBe(true);
   }, 60_000);

   it("a multiplayer run never reaches the solo board", () => {
      expect(isRankedRun(colorCitySprintMeta.scoring, "win", 2)).toBe(false);
   });
});
