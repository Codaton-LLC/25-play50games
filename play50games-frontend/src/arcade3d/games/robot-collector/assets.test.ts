// Robot Collector's fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <Model> / <InstancedModel> draw): every model is in the manifest and on disk, the hazardBeacon
// matches its committed raw bounds and drawn size, and its decor spots stay outside the play area.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, HAZARD_BEACON_GLB, HAZARD_BEACON_SCALE, HAZARD_BEACON_SPOTS } from "./assets";
import { WALL } from "./Primitives";
import { ARENA } from "./rules";

async function drawnBox(asset: ModelAsset): Promise<Box3> {
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

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

describe("robot-collector models", () => {
   it("are all in the manifest and on disk", () => {
      for (const asset of Object.values(ASSETS)) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
      }
      expect(ASSETS.hazardBeacon.url).toBe("/models/3d/robot-collector/hazardBeacon.glb");
   });

   it("measures the hazardBeacon GLB as committed", async () => {
      const raw = await rawBox(ASSETS.hazardBeacon);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(HAZARD_BEACON_GLB.width, 3);
      expect(raw.max.y).toBeCloseTo(HAZARD_BEACON_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(HAZARD_BEACON_GLB.depth, 3);
   });

   it("draws the hazardBeacon at the fitted size", async () => {
      const drawn = await drawnBox(ASSETS.hazardBeacon);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(HAZARD_BEACON_GLB.height * HAZARD_BEACON_SCALE, 3);
      const footprint = Math.max(drawn.max.x - drawn.min.x, drawn.max.z - drawn.min.z);
      expect(footprint).toBeCloseTo(HAZARD_BEACON_GLB.width * HAZARD_BEACON_SCALE, 3);
   });

   it("stands the beacons on the wall trim, outside the play bounds", () => {
      // the base half-width: the widest the beacon reaches from its spot centre
      const r = (Math.max(HAZARD_BEACON_GLB.width, HAZARD_BEACON_GLB.depth) * HAZARD_BEACON_SCALE) / 2;
      for (const spot of HAZARD_BEACON_SPOTS) {
         // the centre stands off the floor, on a wall's trim (the trim runs wall to wall)
         expect(Math.abs(spot.x) > ARENA.halfX || Math.abs(spot.z) > ARENA.halfZ).toBe(true);
         // ... and the base stays on the warehouse: not past the wall's outer face + the plinth lip
         expect(Math.abs(spot.x) + r).toBeLessThanOrEqual(ARENA.halfX + WALL.thickness + 0.15);
         expect(Math.abs(spot.z) + r).toBeLessThanOrEqual(ARENA.halfZ + WALL.thickness + 0.15);
      }
   });
});
