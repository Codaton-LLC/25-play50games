import { describe, expect, it } from "vitest";
import { ROOF_CAP, ROOFTOP_OVERLAY_Y } from "./visuals";

describe("rooftop overlays", () => {
   it("keeps every pad above the roof cap top with visible clearance", () => {
      expect(ROOFTOP_OVERLAY_Y - (ROOF_CAP.centerY + ROOF_CAP.thickness / 2)).toBeGreaterThanOrEqual(0.02);
   });
});
