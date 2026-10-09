import { describe, expect, it } from "vitest";
import { fitView } from "@/arcade3d/core/view";
import { FOV, YAW, viewFor } from "./looks";

function pxPerM(width: number, height: number, banner: number): number {
   const view = viewFor(width, height);
   const fit = fitView({
      ...view,
      width,
      height,
      fov: FOV,
      avoid: banner > 0 ? [{ left: 0, top: height - banner, right: width, bottom: height }] : [],
   });
   return height / (2 * fit.distance * Math.tan((FOV * Math.PI) / 360));
}

describe("construction-worker camera", () => {
   it("keeps yaw 0.6 until the phone is short and wide", () => {
      expect(viewFor(390, 844).yaws).toEqual([YAW]);
      expect(viewFor(1280, 800).yaws).toEqual([YAW]);
      expect(viewFor(844, 390).yaws?.[0]).toBeCloseTo(YAW + Math.PI / 2, 5);
      expect(viewFor(390, 844)).toBe(viewFor(391, 800));
   });

   it("stays readable with the cookie banner open", () => {
      const portrait = pxPerM(390, 844, 162);
      const wide = pxPerM(844, 390, 83);
      expect(viewFor(390, 844).area?.max.y).toBe(5.7);
      expect(viewFor(390, 844).area?.min.z).toBeGreaterThan(4);
      expect((viewFor(390, 844).area?.max.x ?? 0) - (viewFor(390, 844).area?.min.x ?? 0)).toBeLessThan(10);
      expect(portrait, "portrait px/m").toBeGreaterThan(28);
      expect(wide, "landscape px/m").toBeGreaterThan(20);
   });
});
