// The shared coin GLB as the coin pool draws it: core modelParts (what <InstancedProp> instances)
// on the real, meshopt-decoded mesh, then Scene.tsx's placement (spin about y, bob, the coin's
// point). It replaces the stand-in disc in place: the same diameter, about its thickness, centred
// on the point, and inside the rules' 0.7 m coin box at every spin.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, Quaternion, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { COIN_GLB_SIZE, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { COIN_STAND_IN } from "./Primitives";
import { COIN } from "./rules";

/** The coin's vertices in the pool's local frame (the coin's point at the origin), via core modelParts. */
async function drawnCoin(asset: ModelAsset = ASSETS.coin): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(asset.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, asset);
   expect(parts).toHaveLength(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return points;
}

describe("office-escape coin GLB", () => {
   it("is the shared coin, listed in the manifest, a plain prop", () => {
      expect(ASSETS.coin.url).toBe("/models/3d/shared/coin.glb");
      expect(ASSETS.coin.url).toBe(SHARED_ASSETS.coin.url);
      expect(hasModel(ASSETS.coin.url)).toBe(true);
      expect(ASSETS.coin.rigged).toBeFalsy();
      expect(ASSETS.coin.humanoid).toBeUndefined();
   });

   it("fits from core COIN_GLB_SIZE, the real mesh's bounds, standing on y = 0", async () => {
      // the one place the GLB's numbers live (both games derive scale and yOffset from it)
      const raw = new Box3().setFromPoints(await drawnCoin(SHARED_ASSETS.coin)), size = raw.getSize(new Vector3());
      expect(Math.abs(size.x - COIN_GLB_SIZE.width), `width ${size.x}`).toBeLessThan(0.002);
      expect(Math.abs(size.y - COIN_GLB_SIZE.height), `height ${size.y}`).toBeLessThan(0.002);
      expect(Math.abs(size.z - COIN_GLB_SIZE.depth), `depth ${size.z}`).toBeLessThan(0.002);
      expect(Math.abs(raw.min.y), `foot ${raw.min.y}`).toBeLessThan(0.002);
      // the fit the README quotes: about 0.316, the centre lifted onto the coin's point
      expect(ASSETS.coin.scale).toBeCloseTo(0.316, 3);
      expect(ASSETS.coin.yOffset).toBeCloseTo(-0.294, 3);
   });

   it("is drawn at the stand-in disc's size, centred on the coin's point, faces along ±z", async () => {
      const points = await drawnCoin();
      const box = new Box3().setFromPoints(points), size = box.getSize(new Vector3()), centre = box.getCenter(new Vector3());
      const diameter = COIN_STAND_IN.radius * 2;
      expect(Math.abs(size.x / diameter - 1), `width ${size.x}`).toBeLessThan(0.02);
      expect(Math.abs(size.y / diameter - 1), `height ${size.y}`).toBeLessThan(0.03);
      // centred: it spins about its own axis and bobs about the point, like the stand-in
      for (const axis of ["x", "y", "z"] as const) expect(Math.abs(centre[axis]), `centre ${axis}`).toBeLessThan(0.005);
      // the rim (outer 15 % of the face) about the stand-in's 0.07, the raised stars a little more
      const rim = new Box3();
      for (const p of points) if (Math.hypot(p.x, p.y) > 0.85 * COIN_STAND_IN.radius) rim.expandByPoint(p);
      const rimDepth = rim.max.z - rim.min.z;
      expect(rimDepth, `rim ${rimDepth}`).toBeGreaterThan(COIN_STAND_IN.thickness * 0.85);
      expect(rimDepth, `rim ${rimDepth}`).toBeLessThan(COIN_STAND_IN.thickness * 1.25);
      expect(size.z).toBeLessThan(0.12);
   });

   it("stays inside the rules' coin box at every spin and bob, as Scene.tsx places it", async () => {
      const points = await drawnCoin();
      const half = COIN.half / 1000;
      const placement = new Matrix4(), q = new Quaternion(), e = new Euler(), p = new Vector3(), box = new Box3();
      for (let k = 0; k < 48; k++) {
         // Scene.tsx Coins: spin about y, a bob of at most 0.05 m about the rules' height
         const bob = 0.05 * Math.sin(k);
         placement.compose(new Vector3(0, bob, 0), q.setFromEuler(e.set(0, (k * Math.PI) / 24, 0)), new Vector3(1, 1, 1));
         box.makeEmpty();
         for (const point of points) box.expandByPoint(p.copy(point).applyMatrix4(placement));
         expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(half);
         expect(Math.max(-box.min.y, box.max.y)).toBeLessThan(half);
      }
   });
});
