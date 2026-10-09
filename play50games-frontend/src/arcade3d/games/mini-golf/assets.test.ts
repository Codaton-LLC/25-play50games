// Mini Golf's fits on the real, meshopt-decoded GLBs (what <Model> / <InstancedModel> draw): the
// windmill is 2.2 m tall with its tunnel as clear as the rules' walls and its hub where the blades
// turn; the blade tips clear the felt; the flag is 0.8 m.
import { describe, expect, it } from "vitest";
import { Box3, Vector3 } from "three";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, TREE_HEIGHT, WINDMILL_CLEAR, WINDMILL_HUB } from "./assets";
import { WINDMILL } from "./course";
import { DECOR_TREE_HALF, DECOR_TREE_OUT, DECOR_TREE_SCALE } from "./looks";
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
});
