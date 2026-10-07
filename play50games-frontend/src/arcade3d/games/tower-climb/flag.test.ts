// The checkpoint flag GLB (group C) as the flag pool draws it (assets.ts scale on the real,
// meshopt-decoded mesh; writeFlag only translates): the rules' FLAG box, so writeFlag's "only
// whole inside the column" check and the spur clearance hold for the GLB as for the stand-in.
import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS } from "./assets";
import { FLAG } from "./rules";

describe("tower-climb checkpoint flag GLB", () => {
   it("is listed, stands FLAG.height (0.8 m) tall on its ledge and stays inside FLAG.halfWidth, facing the camera", async () => {
      const asset = ASSETS.flag;
      expect(hasModel(asset.url)).toBe(true);
      expect(asset.stretch ?? [1, 1, 1]).toEqual([1, 1, 1]);
      expect(asset.rotationY ?? 0).toBe(0);
      expect(asset.yOffset ?? 0).toBe(0);
      const { cloud } = await readCharacterGlb(asset.url);
      const s = asset.scale ?? 1, box = new Box3(), p = new Vector3();
      for (let i = 0; i < cloud.length; i += 3) box.expandByPoint(p.set(cloud[i], cloud[i + 1], cloud[i + 2]).multiplyScalar(s));
      expect(box.min.y).toBeGreaterThanOrEqual(-1e-3);
      expect(box.min.y).toBeLessThan(0.01);
      expect(box.max.y / FLAG.height).toBeGreaterThan(0.97);
      expect(box.max.y).toBeLessThanOrEqual(FLAG.height + 1e-3);
      expect(Math.max(-box.min.x, box.max.x)).toBeLessThanOrEqual(FLAG.halfWidth);
      // the banner spreads across x (the play plane) and is thin in z, toward the camera
      expect(box.max.z - box.min.z).toBeLessThan(box.max.x - box.min.x);
   });
});
