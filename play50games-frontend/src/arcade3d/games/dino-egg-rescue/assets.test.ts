import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { ASSETS, DINO_BACK_TOP_ANCHOR, TREE_TRUNK_RADIUS } from "./assets";

describe("dino-egg-rescue model assets", () => {
   it("all shared models exist in the model manifest", () => {
      for (const [name, asset] of Object.entries(ASSETS)) {
         expect(hasModel(asset.url), `${name}: ${asset.url}`).toBe(true);
      }
   });

   it("leafy tree trunk radius is pinned to 0.256 m from GLB metrics", () => {
      expect(TREE_TRUNK_RADIUS).toBeCloseTo(0.256, 3);
   });

   it("egg stack anchor on dino back is accurately mapped from GLB units", () => {
      expect(DINO_BACK_TOP_ANCHOR.x).toBeCloseTo(0, 3);
      expect(DINO_BACK_TOP_ANCHOR.y).toBeCloseTo(0.41, 2);
      expect(DINO_BACK_TOP_ANCHOR.z).toBeCloseTo(-0.06, 2);
   });
});
