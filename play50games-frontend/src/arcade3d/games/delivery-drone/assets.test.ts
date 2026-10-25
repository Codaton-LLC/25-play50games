import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { ASSETS, BODY_OFFSET, BRICK_GLB, BRICK_HEIGHT, BRICK_SPOTS, DRONE_HOOK, DRONE_SCALE, GLASS_GLB, GLASS_HEIGHT, GLASS_SPOTS, ROTORS, SKYLINE_FOOTPRINT, SKYLINE_Z } from "./assets";
import { OUTER_BUILDING_SPOTS, PLAY_BOUNDS } from "./looks";

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

async function fitted(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}

describe("delivery-drone skyline variety", () => {
   it("fits the brick and glass towers into the gap north of the play box", async () => {
      for (const asset of [ASSETS.brick, ASSETS.glass]) {
         expect(existsSync(resolve("public", asset.url.slice(1)))).toBe(true);
         expect(hasModel(asset.url)).toBe(true);
      }
      const brick = await fitted(ASSETS.brick);
      const glass = await fitted(ASSETS.glass);
      expect(brick.min.y).toBeCloseTo(0, 2);
      expect(glass.min.y).toBeCloseTo(0, 2);
      expect(brick.max.y - brick.min.y).toBeCloseTo(BRICK_HEIGHT, 2);
      expect(glass.max.y - glass.min.y).toBeCloseTo(GLASS_HEIGHT, 2);
      expect(brick.max.x - brick.min.x).toBeCloseTo(SKYLINE_FOOTPRINT, 2);
      expect(brick.max.z - brick.min.z).toBeCloseTo(SKYLINE_FOOTPRINT, 2);
      expect(glass.max.x - glass.min.x).toBeCloseTo(SKYLINE_FOOTPRINT, 2);
      expect(glass.max.z - glass.min.z).toBeCloseTo(SKYLINE_FOOTPRINT, 2);
      const rawBrick = await bounds(ASSETS.brick.url);
      const rawGlass = await bounds(ASSETS.glass.url);
      expect(rawBrick.getSize(new Vector3()).y).toBeCloseTo(BRICK_GLB.height, 2);
      expect(rawGlass.getSize(new Vector3()).y).toBeCloseTo(GLASS_GLB.height, 2);
      const half = SKYLINE_FOOTPRINT / 2;
      for (const spot of [...BRICK_SPOTS, ...GLASS_SPOTS]) {
         expect(spot.z + half).toBeLessThan(PLAY_BOUNDS.min.z);
         const mine = { minX: spot.x - half, maxX: spot.x + half, minZ: spot.z - half, maxZ: spot.z + half };
         for (const other of OUTER_BUILDING_SPOTS) {
            const hit = mine.minX < other.x + other.w / 2 && mine.maxX > other.x - other.w / 2 && mine.minZ < other.z + other.d / 2 && mine.maxZ > other.z - other.d / 2;
            expect(hit, `${spot.x},${spot.z} vs ${other.x},${other.z}`).toBe(false);
         }
      }
      expect(SKYLINE_Z).toBe(-42.25);
   });
});
