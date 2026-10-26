// The auto-rig on the bellboy (public/models/3d/hotel-bellboy-rush/charBellboy.glb, 2026-10-25): the
// committed BELLBOY_LANDMARKS match what the heuristics find, his poses keep the feet on the floor, the
// hands clear of the hips and the head (with its pillbox hat) rigid (core/rig/characterChecks.ts), and
// his scale draws him 1.74 m tall. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, BELLBOY_HEIGHT, BELLBOY_LANDMARKS, BELLBOY_SCALE, GLB_SIZE } from "./assets";

describe("hotel-bellboy-rush charBellboy.glb", () => {
   describeCharacter("bellboy", {
      asset: ASSETS.bellboy,
      landmarks: BELLBOY_LANDMARKS,
      height: GLB_SIZE.charBellboy.height,
      reach: GLB_SIZE.charBellboy.width / 2,
      estimate: {
         // set by eye (assets.ts): no cloth bridges the legs (the estimate's 0.633 hem is the close inner thighs)
         tolerance: { hemY: 0.2, armRadius: 0.01 },
      },
      // the head joint 1.5735 + its 0.024 blend: the face and the pillbox hat above it are rigid
      headFrom: 1.6,
      hipHalfWidth: 0.21,
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(BELLBOY_LANDMARKS.hemY).toBe(BELLBOY_LANDMARKS.crotchY);
   });

   describe("on the real mesh", () => {
      let bellboy: RiggedCharacter;
      beforeAll(async () => {
         bellboy = await rigCharacter(ASSETS.bellboy);
      });
      it("is drawn 1.74 m tall with his soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = bellboy.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * BELLBOY_SCALE).toBeCloseTo(BELLBOY_HEIGHT, 3);
         expect(ASSETS.bellboy.scale).toBe(BELLBOY_SCALE);
      });
   });
});
