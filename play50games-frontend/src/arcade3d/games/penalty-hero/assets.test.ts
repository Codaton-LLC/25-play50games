// Penalty Hero's model fits on the real, meshopt-decoded GLBs (through core modelParts, what
// <Model> / <InstancedModel> draw): every model is in the manifest, its file exists, the fits match
// the measured bounds, and the level 4-5 trophy spots sit outside the play bounds.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { BufferGeometry, Float32BufferAttribute, Group, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, FINAL_TROPHY_ASSET, FINAL_TROPHY_DRAWN, FINAL_TROPHY_GLB, FINAL_TROPHY_HEIGHT, FINAL_TROPHY_SPOTS } from "./assets";
import { PENALTY_FIT_AREA } from "./camera";

async function drawnBox(asset: ModelAsset): Promise<{ min: Vector3; max: Vector3 }> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const min = new Vector3(Infinity, Infinity, Infinity);
   const max = new Vector3(-Infinity, -Infinity, -Infinity);
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) {
      v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix);
      min.min(v);
      max.max(v);
   }
   geometry.dispose();
   return { min, max };
}

const rawBox = (asset: ModelAsset) => drawnBox({ ...asset, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });

/** Circle (spot, footprint radius r) vs the play-bounds box: true when they overlap. */
function overlapsPlayArea(x: number, z: number, r: number): boolean {
   const { min, max } = PENALTY_FIT_AREA;
   return x + r > min.x && x - r < max.x && z + r > min.z && z - r < max.z;
}

describe("penalty-hero models", () => {
   it("are all in the manifest and their files exist", () => {
      for (const asset of [...Object.values(ASSETS), FINAL_TROPHY_ASSET]) {
         expect(hasModel(asset.url), asset.url).toBe(true);
         expect(existsSync(resolve("public", asset.url.slice(1))), asset.url).toBe(true);
      }
      expect(FINAL_TROPHY_ASSET.url).toBe("/models/3d/penalty-hero/finalTrophy.glb");
   });

   it("measures the finalTrophy GLB as committed", async () => {
      const raw = await rawBox(FINAL_TROPHY_ASSET);
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(FINAL_TROPHY_GLB.width, 3);
      expect(raw.max.y - raw.min.y).toBeCloseTo(FINAL_TROPHY_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(FINAL_TROPHY_GLB.depth, 3);
   });

   it("draws the finalTrophy at the fitted size, standing on the grass", async () => {
      const drawn = await drawnBox(FINAL_TROPHY_ASSET);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(FINAL_TROPHY_DRAWN.width, 3);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(FINAL_TROPHY_HEIGHT, 3);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(FINAL_TROPHY_DRAWN.depth, 3);
   });

   it("places the finalTrophy spots outside the play bounds", () => {
      expect(FINAL_TROPHY_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(FINAL_TROPHY_SPOTS.length).toBeLessThanOrEqual(4);
      const r = Math.max(FINAL_TROPHY_DRAWN.width, FINAL_TROPHY_DRAWN.depth) / 2;
      for (const spot of FINAL_TROPHY_SPOTS) {
         expect(overlapsPlayArea(spot.x, spot.z, r), `spot ${spot.x},${spot.z}`).toBe(false);
      }
   });
});
