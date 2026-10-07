// The vehicle GLBs as the pools draw them (assets.ts scale / stretch / rotationY on the real,
// meshopt-decoded meshes): the stand-in's size, inside the rules hit box and the 1.5 m height
// limit, and hidden under the side cover at every birth and death, like the stand-ins.
import { describe, expect, it } from "vitest";
import { Box3, Matrix4, Quaternion, Vector3 } from "three";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { createStreetParts, disposeStreetParts } from "./Primitives";
import { COVER_INNER_X, VEHICLE_TYPES } from "./rules";

const UP = new Vector3(0, 1, 0);
const VEHICLES = [ASSETS.car, ASSETS.taxi, ASSETS.van];

/** The GLB's vertices placed like <DynamicInstancedModel> places them (asset transform only). */
async function drawnPoints(asset: ModelAsset): Promise<Vector3[]> {
   const glb = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1, k = asset.stretch ?? [1, 1, 1];
   // core assetScale / modelParts: scale x stretch in the GLB's axes, then rotationY, then yOffset
   const place = new Matrix4().compose(
      new Vector3(0, asset.yOffset ?? 0, 0),
      new Quaternion().setFromAxisAngle(UP, asset.rotationY ?? 0),
      new Vector3(s * k[0], s * k[1], s * k[2]),
   );
   const points: Vector3[] = [];
   for (let i = 0; i < glb.cloud.length; i += 3) points.push(new Vector3(glb.cloud[i], glb.cloud[i + 1], glb.cloud[i + 2]).applyMatrix4(place));
   return points;
}

/** The stand-in's box in the same local frame (length along z, front at +z). */
function standInBox(kind: number): Box3 {
   const parts = createStreetParts();
   const box = new Box3(), p = new Vector3();
   try {
      for (const part of parts.vehicles[kind]) {
         const positions = part.geometry.getAttribute("position");
         for (const local of part.locals!) {
            for (let i = 0; i < positions.count; i++) box.expandByPoint(p.fromBufferAttribute(positions, i).applyMatrix4(local));
         }
      }
   } finally { disposeStreetParts(parts); }
   return box;
}

describe("pigeon-crossing vehicle GLBs", () => {
   it("are drawn at their stand-in's length, width and height (within 5 %), standing on the road", async () => {
      for (let kind = 0; kind < 3; kind++) {
         const drawn = new Box3().setFromPoints(await drawnPoints(VEHICLES[kind]));
         const size = drawn.getSize(new Vector3()), want = standInBox(kind).getSize(new Vector3());
         const name = VEHICLE_TYPES[kind].name;
         expect(Math.abs(size.z / want.z - 1), `${name} length ${size.z} vs ${want.z}`).toBeLessThan(0.05);
         expect(Math.abs(size.x / want.x - 1), `${name} width ${size.x} vs ${want.x}`).toBeLessThan(0.05);
         expect(Math.abs(size.y / want.y - 1), `${name} height ${size.y} vs ${want.y}`).toBeLessThan(0.05);
         expect(drawn.min.y, name).toBeGreaterThanOrEqual(-1e-3);
         expect(drawn.min.y, name).toBeLessThan(0.02);
      }
   });

   it("stay inside their hit box (length along x, depth along z once turned) and under 1.5 m", async () => {
      for (let kind = 0; kind < 3; kind++) {
         const type = VEHICLE_TYPES[kind];
         const drawn = new Box3().setFromPoints(await drawnPoints(VEHICLES[kind]));
         expect(Math.max(-drawn.min.z, drawn.max.z) * 2, type.name).toBeLessThanOrEqual(type.length);
         expect(Math.max(-drawn.min.x, drawn.max.x) * 2, type.name).toBeLessThanOrEqual(type.depth);
         expect(drawn.max.y, type.name).toBeLessThanOrEqual(1.5);
      }
   });

   it("are completely hidden under the side cover at every birth and death, in both directions", async () => {
      const placement = new Matrix4(), p = new Vector3();
      for (let kind = 0; kind < 3; kind++) {
         const type = VEHICLE_TYPES[kind];
         const points = await drawnPoints(VEHICLES[kind]);
         for (const direction of [-1, 1]) for (const edge of [-1, 1]) {
            // the pool's facing (FACE_RIGHT / FACE_LEFT) at the spawn / despawn centre
            placement.makeRotationY(direction * Math.PI / 2).setPosition(edge * (COVER_INNER_X + type.length / 2), 0, 0);
            for (const point of points) {
               p.copy(point).applyMatrix4(placement);
               const hidden = Math.abs(p.x) >= COVER_INNER_X - 1e-6 && p.y >= -1e-3 && p.y <= 1.5 && Math.abs(p.z) <= type.depth / 2;
               if (!hidden) throw new Error(`${type.name} shows outside the cover at ${p.toArray()}`);
            }
         }
      }
   });
});
