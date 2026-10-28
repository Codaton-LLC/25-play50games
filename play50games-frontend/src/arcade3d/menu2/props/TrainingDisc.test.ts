import { expect, it } from "vitest";
import { Vector3 } from "three";
import { buildTrainingDiscGeometry, buildTrainingDiscInlayGeometry, getSharedTrainingDiscGeometry } from "./TrainingDisc";

it("TrainingDisc is symmetric, half a metre across, and under 2k triangles", () => {
   const body = buildTrainingDiscGeometry();
   const inlay = buildTrainingDiscInlayGeometry();
   body.computeBoundingBox();
   const box = body.boundingBox!;
   const size = box.getSize(new Vector3());
   expect(size.x).toBeCloseTo(0.5, 2);
   expect(size.y).toBeCloseTo(0.5, 2);
   expect(size.z).toBeCloseTo(0.08, 2);
   expect(box.min.x).toBeCloseTo(-box.max.x, 5);
   expect(box.min.z).toBeCloseTo(-box.max.z, 5);
   expect(body.getAttribute("position").count / 3 + inlay.getAttribute("position").count / 3).toBeLessThan(2000);
   expect(getSharedTrainingDiscGeometry()).toBe(getSharedTrainingDiscGeometry());
   body.dispose();
   inlay.dispose();
});
