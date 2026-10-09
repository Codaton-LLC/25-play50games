import { describe, expect, it } from "vitest";
import { hasModel } from "@/arcade3d/core/modelManifest";
import { EXPANSION_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
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

   it("character and prop dimensions match README specifications", () => {
      // Dino: 1.1 m long, 0.85 m tall (GLB height 1.48 scaled by 1.1/1.8939 * 0.937)
      const dinoScale = ASSETS.dino.scale ?? 1;
      const dinoStretchY = ASSETS.dino.stretch?.[1] ?? 1;
      expect(EXPANSION_GLB_SIZE.dino.depth * dinoScale).toBeCloseTo(1.1, 1);
      expect(EXPANSION_GLB_SIZE.dino.height * dinoScale * dinoStretchY).toBeCloseTo(0.85, 1);

      // Rock: fits round 1.0 m boulder
      const rockStretch = ASSETS.rock.stretch!;
      expect(rockStretch[0] * EXPANSION_GLB_SIZE.rock.width).toBeCloseTo(1.0, 3);
      expect(rockStretch[1] * EXPANSION_GLB_SIZE.rock.height).toBeCloseTo(1.0, 3);
      expect(rockStretch[2] * EXPANSION_GLB_SIZE.rock.depth).toBeCloseTo(1.0, 3);

      // Leafy tree: 3.5 m height
      const treeScale = ASSETS.leafyTree.scale ?? 1;
      expect(EXPANSION_GLB_SIZE.leafyTree.height * treeScale).toBeCloseTo(3.5, 1);
   });
});
