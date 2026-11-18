// Tower Climb's storm-cloud fit on the real, meshopt-decoded GLB (through core modelParts, what
// <DynamicInstancedModel> draws): the url is in the manifest, the file exists, the fit matches the
// measured bounds, and every spot stays outside the play bounds for the whole drift.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { AREA } from "./camera";
import { ASSETS, STORM_CLOUD_BAND, STORM_CLOUD_DRAWN, STORM_CLOUD_GLB, STORM_CLOUD_SCALE, STORM_CLOUD_SPOTS, STORM_CLOUD_WIDTH } from "./assets";
import { STORM_CLOUD_SWAY, writeStormCloud } from "./visuals";

async function drawnBox(asset: ModelAsset): Promise<Box3> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts.length).toBeGreaterThan(0);
   const box = new Box3();
   const v = new Vector3();
   for (let i = 0; i < local.length; i += 3) box.expandByPoint(v.set(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return box;
}

describe("tower-climb storm clouds (levels 4-5 decor)", () => {
   it("lists the GLB in the manifest and on disk", () => {
      expect(ASSETS.stormCloud.url).toBe("/models/3d/tower-climb/stormCloud.glb");
      expect(hasModel(ASSETS.stormCloud.url)).toBe(true);
      expect(existsSync(resolve("public", ASSETS.stormCloud.url.slice(1)))).toBe(true);
   });

   it("measures the stormCloud GLB and draws it at the fitted size", async () => {
      const raw = await drawnBox({ ...ASSETS.stormCloud, scale: 1, stretch: undefined, rotationY: 0, yOffset: 0 });
      expect(raw.min.y).toBeCloseTo(0, 3);
      expect(raw.max.x - raw.min.x).toBeCloseTo(STORM_CLOUD_GLB.width, 3);
      expect(raw.max.y - raw.min.y).toBeCloseTo(STORM_CLOUD_GLB.height, 3);
      expect(raw.max.z - raw.min.z).toBeCloseTo(STORM_CLOUD_GLB.depth, 3);
      expect(STORM_CLOUD_SCALE).toBeCloseTo(STORM_CLOUD_WIDTH / STORM_CLOUD_GLB.width, 6);
      // fitted: a 2.4 m puff beside the 4.6 m column, bottom on the spot's y (floor pivot, no yOffset)
      const drawn = await drawnBox(ASSETS.stormCloud);
      expect(drawn.min.y).toBeCloseTo(0, 3);
      expect(drawn.max.x - drawn.min.x).toBeCloseTo(STORM_CLOUD_DRAWN.width, 2);
      expect(drawn.max.y - drawn.min.y).toBeCloseTo(STORM_CLOUD_DRAWN.height, 2);
      expect(drawn.max.z - drawn.min.z).toBeCloseTo(STORM_CLOUD_DRAWN.depth, 2);
   });

   it("keeps every spot outside the play bounds through the whole drift", () => {
      expect(STORM_CLOUD_SPOTS.length).toBeGreaterThanOrEqual(2);
      expect(STORM_CLOUD_SPOTS.length).toBeLessThanOrEqual(4);
      const halfW = STORM_CLOUD_DRAWN.width / 2;
      const bottom = 17.3;
      const position = new Vector3(), rotation = new Quaternion();
      const s = new Vector3();
      const m = new Matrix4();
      for (const [i, spot] of STORM_CLOUD_SPOTS.entries()) {
         // a cloud clears the play bounds when its footprint misses the camera guard box (x ±2.3,
         // z ±0.6, which contains every gameplay object) on at least one axis; every spot does so in x
         // with the full sway amplitude, and sits behind the play plane (slabs reach z = -0.3)
         expect(Math.abs(spot.x) - (halfW * spot.s + STORM_CLOUD_SWAY)).toBeGreaterThanOrEqual(AREA.max.x);
         expect(spot.z).toBeLessThan(-0.8); // behind the tower panels (z = -0.52)
         expect(spot.y).toBeGreaterThanOrEqual(0);
         expect(spot.y).toBeLessThan(STORM_CLOUD_BAND);
         // the written matrices, swept over a full band of the sink plus sway extremes (reduced and not)
         for (const now of [0, 3.7, 12.9, 25.1, 49.3, 50 * STORM_CLOUD_BAND]) {
            for (const reduced of [false, true]) {
               writeStormCloud(spot, i, bottom, now, reduced, m);
               m.decompose(position, rotation, s);
               expect(position.y).toBeGreaterThanOrEqual(bottom - 1e-9);
               expect(position.y).toBeLessThan(bottom + STORM_CLOUD_BAND);
               expect(s.x).toBeCloseTo(spot.s, 6);
               // never reaches the guard box, so never the runner, a slab or a prop
               expect(Math.abs(position.x) - halfW * spot.s).toBeGreaterThanOrEqual(AREA.max.x - 1e-9);
               expect(position.z).toBeLessThan(-0.8);
            }
         }
      }
   });
});
