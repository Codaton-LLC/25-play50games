import { expect, it } from "vitest";
import { DoubleSide, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { buildMirrorGateFrameGeometry, buildMirrorGateSurfaceGeometry } from "./MirrorGate";

it("MirrorGate has a 2.4 m open arch with a recessed shaped mirror", () => {
   const frame = buildMirrorGateFrameGeometry();
   const surface = buildMirrorGateSurfaceGeometry();
   frame.computeBoundingBox();
   surface.computeBoundingBox();
   expect(frame.boundingBox!.getSize(new Vector3()).y).toBeCloseTo(2.4, 2);
   const material = new MeshBasicMaterial({ side: DoubleSide });
   const mesh = new Mesh(frame, material);
   mesh.updateMatrixWorld();
   const ray = new Raycaster(new Vector3(0, 1, 2), new Vector3(0, 0, -1));
   expect(ray.intersectObject(mesh)).toHaveLength(0);
   expect(surface.boundingBox!.max.z).toBeLessThan(frame.boundingBox!.min.z);
   for (const geometry of [frame, surface]) {
      expect(Array.from(geometry.getAttribute("position").array).every(Number.isFinite)).toBe(true);
      expect((geometry.index?.count ?? geometry.getAttribute("position").count) / 3).toBeLessThan(2500);
      geometry.dispose();
   }
   material.dispose();
});
