// Fits on the real meshes: torso parts 0.50 m, the cell 0.45 m, the robot 1.20 m, the door 1.00 x 1.85 x 0.20 m.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { PART_DRAWN, PART_GLB, ASSETS, CELL_SIZE, DOOR, POWER_CORE_DRAWN, POWER_CORE_GLB, POWER_CORE_SPOTS, ROBOT_HEIGHT, ROBOT_SCALE, TORSO_SIZE } from "./assets";
import { DECOR_SPOTS, inPlayBounds } from "./looks";

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

const rawBox = (asset: ModelAsset) => boundsOf({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

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

   it("fits the powerCore GLB at sensible real size sitting on the ground", async () => {
      expect(existsSync(resolve("public", ASSETS.powerCore.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.powerCore.url)).toBe(true);
      const raw = await rawBox(ASSETS.powerCore);
      expect(raw.min.y).toBeCloseTo(0, 2);
      expect(raw.max.x - raw.min.x).toBeCloseTo(POWER_CORE_GLB.width, 2);
      expect(raw.max.y - raw.min.y).toBeCloseTo(POWER_CORE_GLB.height, 2);
      expect(raw.max.z - raw.min.z).toBeCloseTo(POWER_CORE_GLB.depth, 2);
      const drawn = await boundsOf(ASSETS.powerCore);
      expect(drawn.min.y).toBeCloseTo(0, 2);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(POWER_CORE_DRAWN.width, 2);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(POWER_CORE_DRAWN.height, 2);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(POWER_CORE_DRAWN.depth, 2);
   });

   it("places power core spots outside the play bounds and clear of other decor", () => {
      expect(POWER_CORE_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(POWER_CORE_SPOTS.length).toBeLessThanOrEqual(4);
      const coreR = Math.max(POWER_CORE_DRAWN.width, POWER_CORE_DRAWN.depth) / 2;
      for (const spot of POWER_CORE_SPOTS) {
         expect(inPlayBounds(spot.x, spot.z, coreR)).toBe(false);
         for (const decor of DECOR_SPOTS) {
            if (decor.kind !== "pillar" && decor.kind !== "crate" && decor.kind !== "robotArm") continue;
            expect(Math.hypot(spot.x - decor.x, spot.z - decor.z)).toBeGreaterThan(coreR + decor.radius);
         }
      }
   });

describe("robot-factory head and arm parts (Menu 1 adoption)", () => {
   const KEYS = ["headDome", "headBox", "headAntenna", "armClaw", "armWrench", "armDrill"] as const;
   it("are in the manifest, on disk, wear the part shell and match the measured GLB bounds", async () => {
      for (const key of KEYS) {
         const asset = ASSETS[key];
         expect(hasModel(asset.url), key).toBe(true);
         expect(existsSync(resolve("public", asset.url.slice(1))), key).toBe(true);
         expect(asset.material, key).toBeDefined();
         const raw = (await rawBox(asset)).getSize(new Vector3());
         expect(raw.x, key).toBeCloseTo(PART_GLB[key].width, 2);
         expect(raw.y, key).toBeCloseTo(PART_GLB[key].height, 2);
         expect(raw.z, key).toBeCloseTo(PART_GLB[key].depth, 2);
      }
   });
   it("draws every part at its README size, standing on y 0, small enough to ride the belt and the cradle", async () => {
      for (const key of KEYS) {
         const box = await boundsOf(ASSETS[key]);
         const size = box.getSize(new Vector3());
         expect(box.min.y, key).toBeCloseTo(0, 2);
         const pinned = { width: size.x, height: size.y, depth: size.z }[PART_DRAWN[key].dim];
         expect(pinned, key).toBeCloseTo(PART_DRAWN[key].size, 2);
         expect(Math.max(size.x, size.y, size.z), key).toBeLessThanOrEqual(0.52);
      }
   });
});
});
