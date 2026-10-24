// Fits on the real meshes: torso parts 0.50 m, the cell 0.45 m, the robot 1.20 m, the door 1.00 x 1.85 x 0.20 m.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, CELL_SIZE, DOOR, ROBOT_HEIGHT, ROBOT_SCALE, TORSO_SIZE } from "./assets";

async function boundsOf(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const points: Vector3[] = [];
   for (const part of modelParts(root, asset)) {
      const position = part.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) points.push(new Vector3().fromBufferAttribute(position, i).applyMatrix4(part.matrix));
   }
   geometry.dispose();
   return new Box3().setFromPoints(points);
}

describe("robot-factory models", () => {
   it("are all in the manifest", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.id).toBe(true);
   });

   it("draws the torso parts 0.50 m and the cell 0.45 m, standing on their feet, centred", async () => {
      const barrel = await boundsOf(ASSETS.barrel);
      const crate = await boundsOf(ASSETS.crate);
      const battery = await boundsOf(ASSETS.battery);
      const size = new Vector3();
      expect(barrel.getSize(size).y).toBeCloseTo(TORSO_SIZE, 2);
      expect(crate.getSize(size).x).toBeCloseTo(TORSO_SIZE, 2);
      expect(battery.getSize(size).y).toBeCloseTo(CELL_SIZE, 2);
      for (const box of [barrel, crate, battery]) {
         expect(Math.abs(box.min.y)).toBeLessThan(0.01);
         const centre = box.getCenter(new Vector3());
         expect(Math.abs(centre.x)).toBeLessThan(0.02);
         expect(Math.abs(centre.z)).toBeLessThan(0.02);
         expect(Math.max(box.getSize(size).x, size.y, size.z)).toBeLessThanOrEqual(TORSO_SIZE + 0.005);
      }
   });

   it("draws the robot 1.20 m tall and the door 1.00 x 1.85 x 0.20 m", async () => {
      expect(ROBOT_SCALE).toBeCloseTo(0.6996, 4);
      const robot = (await boundsOf(ASSETS.robot)).getSize(new Vector3());
      expect(robot.y).toBeCloseTo(ROBOT_HEIGHT, 2);
      const door = await boundsOf(ASSETS.door);
      const size = door.getSize(new Vector3());
      expect(size.x).toBeCloseTo(DOOR.width, 2);
      expect(size.y).toBeCloseTo(DOOR.height, 2);
      expect(size.z).toBeCloseTo(DOOR.depth, 2);
      expect(Math.abs(door.min.y)).toBeLessThan(0.01);
   });
});
