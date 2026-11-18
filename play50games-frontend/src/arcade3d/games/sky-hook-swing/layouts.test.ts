// The first gap is wider than a jump plus Riko's dash, so the rope is the way across.
import { describe, expect, it } from "vitest";
import { LEVEL_IDS } from "@/arcade3d/types";
import { G, V_JUMP, V_RUN, courseFor } from "./rules";
import { V_DASH, POWER_MS } from "./heroes";
import { SECRETS } from "./progression";

function jumpDashReach(): number {
   const air = (2 * V_JUMP) / G;
   return V_RUN * air + V_DASH * (POWER_MS.dash / 1000);
}

describe("the rope is required", () => {
   for (const id of LEVEL_IDS) {
      it(`level ${id}: the first gap is wider than a jump and a dash, and the secrets match the card`, () => {
         const course = courseFor(id);
         const start = course.islands[0];
         const next = course.islands
            .filter((s) => s.cp && s.x > start.x + start.r)
            .sort((a, b) => a.x - b.x)[0];
         const gap = next.x - next.r - (start.x + start.r);
         expect(gap).toBeGreaterThan(jumpDashReach());
         expect(course.secrets).toHaveLength(SECRETS[id].length);
         for (const index of course.route) expect(course.anchors[index]).toBeTruthy();
      });
   }
});
