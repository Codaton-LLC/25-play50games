// The shared coin GLB as the coin pool draws it: core modelParts (what <DynamicInstancedModel>
// instances) on the real, meshopt-decoded mesh, placed by writeCoin. It replaces the stand-in disc in
// place (same diameter, about its thickness, centred on the coin's point) and keeps writeCoin's
// "only whole inside the column" rule: the GLB's materials carry no clipping planes.
import { describe, expect, it } from "vitest";
import { Box3, BufferGeometry, Float32BufferAttribute, Group, Matrix4, Mesh, Vector3 } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { ASSETS } from "./assets";
import { createTowerParts, disposeTowerParts } from "./Primitives";
import { COIN, createRun } from "./rules";
import { writeCoin } from "./visuals";

/** The coin's vertices in the pool's local frame (the coin's point at the origin), via core modelParts. */
async function drawnCoin(): Promise<Vector3[]> {
   const { local, node } = await readCharacterGlb(ASSETS.coin.url);
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", new Float32BufferAttribute(local, 3));
   const mesh = new Mesh(geometry);
   mesh.position.fromArray(node);
   const root = new Group();
   root.add(mesh);
   const parts = modelParts(root, ASSETS.coin);
   expect(parts).toHaveLength(1);
   const points: Vector3[] = [];
   for (let i = 0; i < local.length; i += 3) points.push(new Vector3(local[i], local[i + 1], local[i + 2]).applyMatrix4(parts[0].matrix));
   geometry.dispose();
   return points;
}

/** The stand-in disc as the pool draws it at the origin: its geometry through its local. */
function standInBox(): Box3 {
   const parts = createTowerParts();
   try {
      const box = new Box3(), piece = new Box3();
      for (const part of parts.coin) {
         part.geometry.computeBoundingBox();
         for (const local of part.locals ?? [new Matrix4()]) box.union(piece.copy(part.geometry.boundingBox!).applyMatrix4(local));
      }
      return box;
   } finally { disposeTowerParts(parts); }
}

describe("tower-climb coin GLB", () => {
   it("is the shared coin, listed in the manifest, a plain prop", () => {
      expect(ASSETS.coin.url).toBe("/models/3d/shared/coin.glb");
      expect(ASSETS.coin.url).toBe(SHARED_ASSETS.coin.url);
      expect(hasModel(ASSETS.coin.url)).toBe(true);
      expect(ASSETS.coin.rigged).toBeFalsy();
      expect(ASSETS.coin.humanoid).toBeUndefined();
      // fitted from core COIN_GLB_SIZE (office-escape/coin.test.ts checks it on the real mesh): about
      // 0.316, the README's figure
      expect(ASSETS.coin.scale).toBeCloseTo(0.316, 3);
   });

   it("replaces the stand-in disc in place: its diameter, about its thickness, centred on the coin's point", async () => {
      const points = await drawnCoin();
      const glb = new Box3().setFromPoints(points), size = glb.getSize(new Vector3()), centre = glb.getCenter(new Vector3());
      const disc = standInBox(), want = disc.getSize(new Vector3());
      expect(want.x).toBeCloseTo(2 * COIN.radius, 6);
      expect(disc.getCenter(new Vector3()).length()).toBeLessThan(1e-9);
      expect(Math.abs(size.x / want.x - 1), `width ${size.x}`).toBeLessThan(0.02);
      expect(Math.abs(size.y / want.y - 1), `height ${size.y}`).toBeLessThan(0.03);
      for (const axis of ["x", "y", "z"] as const) expect(Math.abs(centre[axis]), `centre ${axis}`).toBeLessThan(0.005);
      // faces along ±z like the disc; the rim (outer 15 % of the face) about the disc's thickness
      const rim = new Box3();
      for (const p of points) if (Math.hypot(p.x, p.y) > 0.85 * COIN.radius) rim.expandByPoint(p);
      const rimDepth = rim.max.z - rim.min.z;
      expect(rimDepth, `rim ${rimDepth}`).toBeGreaterThan(want.z * 0.85);
      expect(rimDepth, `rim ${rimDepth}`).toBeLessThan(want.z * 1.15);
      expect(size.z).toBeLessThan(0.12);
      // the spin about y keeps it within the 0.30 radius the README's coin/spur clearance counts on
      let reach = 0;
      for (const p of points) reach = Math.max(reach, Math.hypot(p.x, p.z));
      expect(reach).toBeLessThanOrEqual(COIN.radius + 0.005);
   });

   it("is drawn only whole inside the column: at writeCoin's extremes, every vertex stays within it", async () => {
      const points = await drawnCoin();
      const run = createRun(5050), coin = run.coins[0], matrix = new Matrix4(), p = new Vector3();
      coin.active = true; coin.collected = false; coin.x = 1.5;
      const top = run.maxHeight + 4, bottom = run.viewBottomY;
      // the highest and lowest coin points writeCoin still shows, with and without the bob
      const cases: Array<[number, boolean]> = [
         [top - COIN.radius - 0.03, false], [bottom + COIN.radius + 0.03, false],
         [top - COIN.radius, true], [bottom + COIN.radius, true],
      ];
      for (const [y, reduced] of cases) {
         coin.y = y;
         let shown = 0, low = Infinity, high = -Infinity;
         for (let k = 0; k < 64; k++) {
            if (writeCoin(run, coin, k * 0.37, reduced, matrix) === false) continue;
            shown++;
            for (const point of points) {
               p.copy(point).applyMatrix4(matrix);
               low = Math.min(low, p.y); high = Math.max(high, p.y);
            }
         }
         expect(shown, `coin at ${y}`).toBe(64);
         expect(low, `coin at ${y}`).toBeGreaterThanOrEqual(bottom - 1e-9);
         expect(high, `coin at ${y}`).toBeLessThanOrEqual(top + 1e-9);
      }
   });
});
