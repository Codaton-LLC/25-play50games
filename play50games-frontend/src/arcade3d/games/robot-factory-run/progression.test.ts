import { describe, it, expect } from "vitest";
import { bossProblems } from "../../menu2/boss/boss";
import { secretProblems, collectSecret } from "../../menu2/secrets/secrets";
import { memoryProgressStorage } from "../../menu2/progress/progressStore";
import { defaultHeroFor } from "../../menu2/heroes/heroPick";
import { LEVEL_IDS } from "../../types";
import { OVERSEER, SECRETS } from "./progression";
import { createRun } from "./rules";
import { levelEndStats } from "./levelEnd";
describe("shared Menu 2 progression", () => {
   it("starts Ember Heights on Riko and uses a valid three-phase eight-hit boss", () => {
      expect(defaultHeroFor("robot-factory-run")).toBe("riko");
      expect(createRun().heroId).toBe("riko");
      expect(bossProblems(OVERSEER)).toEqual([]);
      expect(OVERSEER.phases.map((p) => p.id)).toEqual(["socket", "press", "vents"]);
   });
   for (const id of LEVEL_IDS)
      it(`L${id}: three stars, secrets and XP save once per achievement`, () => {
         expect(secretProblems(SECRETS[id])).toEqual([]);
         const r = createRun(1, id);
         r.ended = "win";
         r.finishMs = 30000;
         r.orbs = 8;
         collectSecret(r.secrets, 0);
         const storage = memoryProgressStorage();
         const first = levelEndStats(r, null, storage), again = levelEndStats(r, null, storage);
         expect(first.stars).toBe(7);
         expect(first.newStars).toBe(7);
         expect(first.newSecrets).toBe(1);
         expect(first.xp).toBeGreaterThan(0);
         expect(again.newStars).toBe(0);
         expect(again.newSecrets).toBe(0);
         expect(again.xp).toBe(0);
      });
});
