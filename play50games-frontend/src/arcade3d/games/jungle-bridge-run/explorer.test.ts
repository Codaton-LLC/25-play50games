// The auto-rig on the explorer (public/models/3d/jungle-bridge-run/charExplorer.glb, 2026-10-25): the
// committed EXPLORER_LANDMARKS match the heuristics (seeded with the hand-set crotch), the poses keep the
// feet on the floor, the hands clear of the hips and the head (with its hat) rigid, and the scale draws
// him 1.76 m tall. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, EXPLORER_LANDMARKS, EXPLORER_SCALE, GLB_SIZE } from "./assets";
import { STAND_HEIGHT } from "./rules";

describe("jungle-bridge-run charExplorer.glb", () => {
   describeCharacter("explorer", {
      asset: ASSETS.explorer,
      landmarks: EXPLORER_LANDMARKS,
      height: GLB_SIZE.charExplorer.height,
      reach: GLB_SIZE.charExplorer.width / 2,
      estimate: {
         // set by hand (assets.ts): the legs part below 0.70; nothing bridges them (shorts)
         explicit: { crotchY: 0.7, hemY: 0.7 },
      },
      // the head joint 1.48 + its blend: the face and the safari hat above are rigid
      headFrom: 1.5,
      hipHalfWidth: 0.22,
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(EXPLORER_LANDMARKS.hemY).toBe(EXPLORER_LANDMARKS.crotchY);
   });

   describe("on the real mesh", () => {
      let explorer: RiggedCharacter;
      beforeAll(async () => {
         explorer = await rigCharacter(ASSETS.explorer);
      });
      it("is drawn 1.76 m tall with his soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = explorer.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * EXPLORER_SCALE).toBeCloseTo(STAND_HEIGHT, 3);
         expect(ASSETS.explorer.scale).toBe(EXPLORER_SCALE);
      });
   });
});
