import { expect, it } from "vitest";
import { Vector3 } from "three";
import { buildGreatGongFrameGeometry, buildGreatGongGeometry, greatGongSwing } from "./GreatGong";

it("GreatGong fits a 2.2 m disc inside a 3 m frame and clamps its strike swing", () => {
   const frame = buildGreatGongFrameGeometry();
   const gong = buildGreatGongGeometry();
   frame.computeBoundingBox();
   gong.computeBoundingBox();
   expect(frame.boundingBox!.getSize(new Vector3()).y).toBeCloseTo(3, 2);
   expect(gong.boundingBox!.getSize(new Vector3()).x).toBeCloseTo(2.2, 2);
   for (const geometry of [frame, gong]) {
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      expect(geometry.getAttribute("position").count / 3).toBeLessThan(2500);
      geometry.dispose();
   }
   expect(greatGongSwing(0, 0.2)).toBe(0);
   expect(Math.abs(greatGongSwing(1, 0.2))).toBeGreaterThan(0);
   expect(greatGongSwing(3, 0.2)).toBe(greatGongSwing(1, 0.2));
   expect(greatGongSwing(-1, 0.2)).toBe(0);
});
