import { describe, expect, it } from "vitest";
import { isRankedRun } from "@/arcade3d/core/scores";
import { colorCitySprintMeta } from "./meta";
import { createMultiRun, onAllyPower, stepMulti } from "./multiplayer";
import { createStepInput } from "./rules";

describe("local multiplayer", () => {
   it("co-op shares the paint and versus does not", () => {
      const coop = createMultiRun(1, 1, ["riko", "nami"], "coop");
      const versus = createMultiRun(1, 1, ["riko", "kiro"], "versus");
      expect(coop.runs[0].painted).toBe(coop.runs[1].painted);
      expect(versus.runs[0].painted).not.toBe(versus.runs[1].painted);
      expect(coop.runs[0].collected).toBe(coop.runs[1].collected);
      expect(versus.runs[0].collected).toBe(versus.runs[1].collected);
   });

   it("an ally shield copies the timestamp, and a multi run is not ranked", () => {
      const m = createMultiRun(2, 1, ["kiro", "zuno"], "coop");
      m.runs[0].hero.shieldUntil = 4000;
      onAllyPower({ from: 0, to: 1, power: "shield", source: m.runs[0], ally: m.runs[1] });
      expect(m.runs[1].hero.shieldUntil).toBe(4000);
      const input = createStepInput();
      input.moveX = 1;
      stepMulti(m, 32, [input, input]);
      expect(isRankedRun(colorCitySprintMeta.scoring, "win", 2)).toBe(false);
   });
});
