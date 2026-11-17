// The auto-rig on the postman (public/models/3d/postman-3d/charPostman.glb, 2026-10-26): the committed
// POSTMAN_LANDMARKS match what the heuristics find, his poses keep the feet on the floor, the hands clear
// of the hips and the head (with its cap) rigid (core/rig/characterChecks.ts), and his scale draws him
// 1.78 m tall. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, FIT, GLB_SIZE, POSTMAN_LANDMARKS, POSTMAN_SCALE } from "./assets";

describe("postman-3d charPostman.glb", () => {
   describeCharacter("postman", {
      asset: ASSETS.postman,
      landmarks: POSTMAN_LANDMARKS,
      height: GLB_SIZE.charPostman.height,
      reach: GLB_SIZE.charPostman.width / 2,
      estimate: {
         // set by eye (assets.ts): no cloth bridges the legs (the estimate's 0.624 hem is the close inner
         // thighs); the wider armRadius takes the whole sleeve down with the arm
         tolerance: { hemY: 0.2, armRadius: 0.02 },
      },
      // the head joint 1.4231 + its blend: the face and the cap above it are rigid
      headFrom: 1.45,
      hipHalfWidth: 0.22,
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(POSTMAN_LANDMARKS.hemY).toBe(POSTMAN_LANDMARKS.crotchY);
   });

   describe("on the real mesh", () => {
      let postman: RiggedCharacter;
      beforeAll(async () => {
         postman = await rigCharacter(ASSETS.postman);
      });
      it("is drawn 1.78 m tall with his soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = postman.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * POSTMAN_SCALE).toBeCloseTo(FIT.postmanHeight, 3);
         expect(ASSETS.postman.scale).toBe(POSTMAN_SCALE);
      });
   });
});
