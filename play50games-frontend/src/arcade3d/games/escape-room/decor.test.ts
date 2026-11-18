// Level 4 / 5 Hyper3D decor: manifest, file, fitted size, and spots beyond the play bounds.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, SHIP_CONSOLE_SPOTS, STOVE_SPOTS } from "./assets";
import { ARENA } from "./rules";

const WALL_OUTER = { x: 6.2, z: 5.2 };

async function fitted(asset: ModelAsset): Promise<Box3> {
   const { cloud } = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1;
   const m = new Matrix4().compose(new Vector3(0, asset.yOffset ?? 0, 0), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), asset.rotationY ?? 0), new Vector3(s, s, s));
   const box = new Box3();
   for (let i = 0; i < cloud.length; i += 3) box.expandByPoint(new Vector3(cloud[i], cloud[i + 1], cloud[i + 2]).applyMatrix4(m));
   return box;
}

const CASES = [
   { name: "stoveT", asset: ASSETS.stoveT, spots: STOVE_SPOTS, size: [0.727, 1.233, 0.629] },
   { name: "shipConsole", asset: ASSETS.shipConsole, spots: SHIP_CONSOLE_SPOTS, size: [1.7, 0.931, 1.068] },
] as const;

describe.each(CASES)("$name decor", ({ name, asset, spots, size }) => {
   it("is in the manifest and the file exists", () => {
      expect(asset.url).toBe(`/models/3d/escape-room/${name}.glb`);
      expect(hasModel(asset.url)).toBe(true);
      expect(existsSync(resolve("public", asset.url.slice(1)))).toBe(true);
   });

   it("is fitted to a grounded prop of a sensible size", async () => {
      const box = await fitted(asset);
      const got = box.getSize(new Vector3());
      expect(box.min.y).toBeCloseTo(0, 3);
      expect(got.x).toBeCloseTo(size[0], 2);
      expect(got.y).toBeCloseTo(size[1], 2);
      expect(got.z).toBeCloseTo(size[2], 2);
   });

   it("keeps 2-4 whole footprints outside the walls and the play bounds", async () => {
      const box = await fitted(asset);
      expect(spots.length).toBeGreaterThanOrEqual(2);
      expect(spots.length).toBeLessThanOrEqual(4);
      for (const spot of spots) {
         const m = new Matrix4().makeRotationY(spot.rotY);
         const c = box.clone().applyMatrix4(m);
         const nearZ = spot.z + c.max.z < -ARENA.halfZ;
         const sideX = spot.x + c.min.x > ARENA.halfX || spot.x + c.max.x < -ARENA.halfX;
         // beyond the walls too (shell outer faces at 6.2 / 5.2), not only the arena
         if (nearZ) expect(spot.z + c.max.z).toBeLessThan(-WALL_OUTER.z);
         if (sideX) expect(Math.abs(spot.x) - Math.max(Math.abs(c.min.x), Math.abs(c.max.x))).toBeGreaterThan(WALL_OUTER.x);
         expect(nearZ || sideX, `${name} at ${spot.x},${spot.z}`).toBe(true);
      }
   });
});
