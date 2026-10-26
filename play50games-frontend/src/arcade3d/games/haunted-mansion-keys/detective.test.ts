// The auto-rig on charDetective.glb (Hyper3D image-to-3D, menu1-haunted-mansion-keys): the committed
// DETECTIVE_LANDMARKS match what the heuristics find, the poses keep the feet on the floor, the hands
// clear of the coat and the hat-and-face head rigid (core/rig/characterChecks.ts), and the scale draws
// it 1.80 m tall. A new charDetective.glb must be re-measured.
import { describe, expect, it } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { readCharacterGlb } from "@/arcade3d/core/rig/robotGlb";
import { ASSETS, DETECTIVE_LANDMARKS, DETECTIVE_SCALE, GLB_SIZE } from "./assets";

describe("haunted-mansion-keys charDetective.glb", () => {
   describeCharacter("detective", {
      asset: ASSETS.detective,
      landmarks: DETECTIVE_LANDMARKS,
      height: GLB_SIZE.charDetective.height,
      reach: GLB_SIZE.charDetective.width / 2,
      headFrom: DETECTIVE_LANDMARKS.headY + DETECTIVE_LANDMARKS.neckBlend,
      hipHalfWidth: 0.26,
      apron: { hemY: DETECTIVE_LANDMARKS.hemY, topY: DETECTIVE_LANDMARKS.crotchY, frontZ: 0.05 },
   });

   it("is drawn 1.80 m tall with its soles on the floor", async () => {
      const { cloud } = await readCharacterGlb(ASSETS.detective.url);
      let top = -Infinity, low = Infinity;
      for (let i = 1; i < cloud.length; i += 3) { top = Math.max(top, cloud[i]); low = Math.min(low, cloud[i]); }
      expect(low).toBeCloseTo(0, 4);
      expect(top * DETECTIVE_SCALE).toBeCloseTo(1.8, 3);
      expect(ASSETS.detective.scale).toBe(DETECTIVE_SCALE);
   });
});
