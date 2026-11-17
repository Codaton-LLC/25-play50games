// Mini Golf's fits on the real, meshopt-decoded GLBs (what <Model> / <InstancedModel> draw): the
// windmill is 2.2 m tall with its tunnel as clear as the rules' walls and its hub where the blades
// turn; the blade tips clear the felt; the flag is 0.8 m.
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Box3, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, CASTLE_DRAWN, CASTLE_HEIGHT, CASTLE_Y, ISLAND_SKIRT, TREE_HEIGHT, WINDMILL_CLEAR, WINDMILL_HUB, castleSpots } from "./assets";
import { WINDMILL, buildHole } from "./course";
import { DECOR_TREE_HALF, DECOR_TREE_OUT, DECOR_TREE_SCALE, feltRects, holeZ } from "./looks";
import { BALL, CUP } from "./physics";

/** The GLB's vertices scaled by the asset's fit (no stretch or turn in these fits). */
async function drawn(asset: ModelAsset): Promise<Vector3[]> {
   expect(asset.stretch).toBeUndefined();
   expect(asset.rotationY ?? 0).toBe(0);
   const { cloud } = await readCharacterGlb(asset.url);
   const s = asset.scale ?? 1;
   const out: Vector3[] = [];
   for (let i = 0; i < cloud.length; i += 3) out.push(new Vector3(cloud[i] * s, cloud[i + 1] * s + (asset.yOffset ?? 0), cloud[i + 2] * s));
   return out;
}

describe("mini-golf models", () => {
   it("are all in the manifest (the windmill is this game's own GLB)", () => {
      for (const asset of Object.values(ASSETS)) expect(hasModel(asset.url), asset.url).toBe(true);
      expect(ASSETS.windmill.url).toBe("/models/3d/mini-golf/windmill.glb");
   });

   it("draws the windmill 2.2 m tall on the felt, its body inside the rules' box", async () => {
      const pts = await drawn(ASSETS.windmill);
      const box = new Box3().setFromPoints(pts);
      expect(box.max.y - box.min.y).toBeCloseTo(2.2, 2);
      expect(Math.abs(box.min.y)).toBeLessThan(0.01);
      // at ball height the walls stay inside the rules' body box (+1 cm)
      for (const p of pts) if (p.y < 0.2) {
         expect(Math.abs(p.x)).toBeLessThan(WINDMILL.halfX + 0.01);
         expect(Math.abs(p.z)).toBeLessThan(WINDMILL.halfZ + 0.01);
      }
   });

   it("keeps the tunnel at ball height clear of the rules' tunnel walls (0.232 m)", async () => {
      expect(WINDMILL_CLEAR).toBeCloseTo(2 * WINDMILL.tunnelHalf, 3);
      const pts = await drawn(ASSETS.windmill);
      // nothing of the mesh inside the walls' box from the felt to the ball's top, along the whole tunnel
      for (const p of pts) {
         const inside = Math.abs(p.x) < WINDMILL.tunnelHalf - 0.005 && p.y > 0.01 && p.y < 2 * BALL.radius && Math.abs(p.z) < WINDMILL.halfZ;
         expect(inside, `${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}`).toBe(false);
      }
   });

   it("puts the hub where the blades turn (within 1 cm) and the blade tips 4.8 cm over the felt", () => {
      expect(Math.abs(WINDMILL_HUB.y - WINDMILL.hubY)).toBeLessThan(0.01);
      expect(WINDMILL_HUB.z).toBeLessThan(WINDMILL.bladeZ);
      expect(WINDMILL.hubY - WINDMILL.length).toBeCloseTo(0.048, 3);
      expect(WINDMILL.bladeZ - WINDMILL.halfZ).toBeGreaterThan(0.04);
   });

   it("draws the flag 0.8 m tall and the trees at their height", async () => {
      const flag = new Box3().setFromPoints(await drawn(ASSETS.flag));
      expect(flag.max.y).toBeGreaterThan(CUP.flagHeight * 0.97);
      expect(flag.max.y).toBeLessThan(CUP.flagHeight * 1.01);
      const tree = new Box3().setFromPoints(await drawn(ASSETS.tree));
      expect(tree.max.y - tree.min.y).toBeCloseTo(TREE_HEIGHT, 2);
   });

   it("a decor tree's canopy (spot scale DECOR_TREE_SCALE) clears the rails by >= 0.1 m from DECOR_TREE_OUT", async () => {
      const reach = Math.max(...(await drawn(ASSETS.tree)).map((p) => Math.hypot(p.x, p.z))) * DECOR_TREE_SCALE;
      expect(reach).toBeLessThanOrEqual(DECOR_TREE_OUT - 0.1);
      expect(reach).toBeLessThanOrEqual(DECOR_TREE_HALF * 1.25);
   });

   it("stands the ruined gate in the sea, clear of every island", async () => {
      expect(existsSync(resolve("public", ASSETS.castle.url.slice(1)))).toBe(true);
      expect(hasModel(ASSETS.castle.url)).toBe(true);
      const box = new Box3().setFromPoints(await drawn(ASSETS.castle));
      expect(box.min.y).toBeCloseTo(0, 2);
      expect(box.max.y - box.min.y).toBeCloseTo(CASTLE_HEIGHT, 2);
      expect(box.max.x - box.min.x).toBeCloseTo(CASTLE_DRAWN.width, 2);
      expect(box.max.z - box.min.z).toBeCloseTo(CASTLE_DRAWN.depth, 2);
      const halfX = CASTLE_DRAWN.width / 2;
      const halfZ = CASTLE_DRAWN.depth / 2;
      for (const mirrored of [false, true]) {
         const holes = [0, 1, 2, 3, 4, 5].map((index) => buildHole(index, mirrored));
         const spots = castleSpots(holes);
         expect(spots).toHaveLength(4);
         for (const spot of spots) {
            expect(spot.y).toBe(CASTLE_Y);
            expect(spot.y).toBeLessThan(-1.3);
            expect(spot.y + CASTLE_HEIGHT).toBeGreaterThan(-1.3);
            for (const hole of holes) {
               const z0 = holeZ(hole.index);
               const cx = (hole.box.x0 + hole.box.x1) / 2;
               const cz = z0 + (hole.box.z0 + hole.box.z1) / 2;
               const sx = (hole.box.x1 - hole.box.x0) / 2 + ISLAND_SKIRT;
               const sz = (hole.box.z1 - hole.box.z0) / 2 + ISLAND_SKIRT;
               const hitsIsland = spot.x + halfX > cx - sx && spot.x - halfX < cx + sx && spot.z + halfZ > cz - sz && spot.z - halfZ < cz + sz;
               expect(hitsIsland, `hole ${hole.index} mirror ${mirrored}`).toBe(false);
               for (const rect of feltRects(hole)) {
                  const hitsFelt = spot.x + halfX > rect.x0 && spot.x - halfX < rect.x1 && spot.z + halfZ > z0 + rect.z0 && spot.z - halfZ < z0 + rect.z1;
                  expect(hitsFelt).toBe(false);
               }
            }
         }
      }
   });
});
