import { describe, expect, it } from "vitest";
import { bossProblems } from "@/arcade3d/menu2/boss/boss";
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { GREYOUT, SECRETS } from "./progression";
import { comboSpecOf, courseFor } from "./rules";
import { LEVEL_IDS } from "@/arcade3d/types";

describe("progression", () => {
   it("Greyout's config is a legal three-phase boss", () => {
      expect(bossProblems(GREYOUT)).toEqual([]);
      expect(GREYOUT.maxHp).toBe(7);
      expect(GREYOUT.phases.map((p) => p.endsAt)).toEqual([4 / 7, 2 / 7, 0]);
   });

   it("every level has three secrets and a finite flow bonus", () => {
      for (const id of LEVEL_IDS) {
         expect(SECRETS[id]).toHaveLength(3);
         expect(Number.isFinite(comboMaxBonus(comboSpecOf(courseFor(id))))).toBe(true);
      }
      expect(SECRETS[4][2].id).toBe("perfect-loop");
   });
});
