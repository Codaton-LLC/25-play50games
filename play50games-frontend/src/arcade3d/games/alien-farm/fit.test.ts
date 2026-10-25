import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { FOV, VIEW } from "./looks";

describe("alien-farm camera fit", () => {
   it("computes valid fitView at 1280x800, 390x844, and 844x390", () => {
      const sizes = [
         { name: "desktop", width: 1280, height: 800 },
         { name: "portrait", width: 390, height: 844 },
         { name: "landscape", width: 844, height: 390 },
      ];
      for (const s of sizes) {
         const fit = fitView({ ...VIEW, fov: FOV, width: s.width, height: s.height });
         expect(fit.distance).toBeGreaterThan(5);
         expect(fit.offset[1]).toBeGreaterThan(4);
         expect(fit.offset[2]).toBeGreaterThan(3);
      }
   });
});
