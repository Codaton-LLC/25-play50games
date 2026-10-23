import { Box3, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BODY_OFFSET, DRONE_HOOK, DRONE_SCALE, ROTORS } from "./assets";

/** Decode the real meshopt vertices in root space, without textures, fetch or a DOM. */
async function bounds(url: string): Promise<Box3> {
   const { cloud, positionType } = await readCharacterGlb(url);
   expect(positionType).toBe(5126);
   const box = new Box3(), point = new Vector3();
   for (let i = 0; i < cloud.length; i += 3) {
      point.fromArray(cloud, i);
      expect(Number.isFinite(point.x + point.y + point.z), url).toBe(true);
      box.expandByPoint(point);
   }
   return box;
}

describe("real GLB fits and the logical hook", () => {
   it("fits the real drone to 0.9 m and keeps the measured hook at the origin", async () => {
      const b = await bounds(ASSETS.drone.url), size = b.getSize(new Vector3());
      expect(size.x).toBeCloseTo(EXPANSION_GLB_SIZE.drone.width, 2);
      expect(size.x * DRONE_SCALE).toBeCloseTo(0.9, 2);
      expect(DRONE_HOOK.x * DRONE_SCALE + BODY_OFFSET[0]).toBeCloseTo(0, 8);
      expect(DRONE_HOOK.y * DRONE_SCALE + ASSETS.drone.yOffset).toBeCloseTo(0, 8);
      expect(DRONE_HOOK.z * DRONE_SCALE + BODY_OFFSET[2]).toBeCloseTo(0, 8);
      for (const p of ROTORS) {
         const original = new Vector3(p.x / DRONE_SCALE + DRONE_HOOK.x, p.y / DRONE_SCALE + DRONE_HOOK.y, p.z / DRONE_SCALE + DRONE_HOOK.z);
         expect(b.clone().expandByScalar(0.03).containsPoint(original)).toBe(true);
      }
   });
   it("keeps fallback rotor centres and cable/parcel origins aligned", () => {
      expect(ROTORS).toHaveLength(4);
      expect(ROTORS.every((p) => Number.isFinite(p.x + p.y + p.z) && p.y > 0)).toBe(true);
      const pivot = 11, top = pivot - 2, centre = top - 0.2;
      expect(centre - 0.2).toBeCloseTo(8.6);
      // core Parcel is bottom-centred, so its draw origin equals the scoring contact point.
      expect(centre - 0.2 + 0.4).toBeCloseTo(top, 8);
   });
   it("checks every shared and reused model against its intended scale", async () => {
      for (const [asset, axis, intended, tolerance] of [
         [ASSETS.car, "z", 1.6, 0.35], [ASSETS.taxi, "z", 1.6, 0.35], [ASSETS.van, "z", 2, 0.4],
         [ASSETS.pigeon, "x", 0.6, 0.03], [ASSETS.crate, "x", 0.8, 0.02], [ASSETS.tree, "y", 3, 0.02],
      ] as const) {
         const size = (await bounds(asset.url)).getSize(new Vector3());
         expect(Math.abs(size[axis] * asset.scale - intended)).toBeLessThan(tolerance);
      }
   });
});
