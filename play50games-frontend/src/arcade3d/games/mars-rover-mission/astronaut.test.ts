// The auto-rig on the astronaut (public/models/3d/mars-rover-mission/charAstronaut.glb, 2026-10-25): the
// committed ASTRONAUT_LANDMARKS match what the heuristics find (but the fields set by eye in assets.ts), her
// poses keep the feet on the floor, the hands clear of the hips and the helmet rigid
// (core/rig/characterChecks.ts), and her scale draws her 1.70 m tall. A new GLB must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, ASTRONAUT_LANDMARKS, ASTRONAUT_SCALE, FIT, GLB_SIZE } from "./assets";

describe("mars-rover-mission charAstronaut.glb", () => {
   describeCharacter("astronaut", {
      asset: ASSETS.astronaut,
      landmarks: ASTRONAUT_LANDMARKS,
      height: GLB_SIZE.charAstronaut.height,
      reach: GLB_SIZE.charAstronaut.width / 2,
      estimate: {
         // set by eye (assets.ts): the touching suit thighs are not cloth; the head joint at the helmet's neck ring
         tolerance: { hemY: 0.4, neckY: 0.06, headY: 0.12 },
      },
      // the helmet ring starts at 1.38 (+ the neck blend): the helmet and the face in it are rigid
      headFrom: 1.44,
      hipHalfWidth: 0.24,
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(ASTRONAUT_LANDMARKS.hemY).toBe(ASTRONAUT_LANDMARKS.crotchY);
   });

   describe("on the real mesh", () => {
      let astronaut: RiggedCharacter;
      beforeAll(async () => {
         astronaut = await rigCharacter(ASSETS.astronaut);
      });
      it("is drawn 1.70 m tall with her soles on the floor", () => {
         let top = -Infinity;
         let low = Infinity;
         const cloud = astronaut.glb.cloud;
         for (let i = 1; i < cloud.length; i += 3) {
            top = Math.max(top, cloud[i]);
            low = Math.min(low, cloud[i]);
         }
         expect(low).toBeCloseTo(0, 4);
         expect(top * ASTRONAUT_SCALE).toBeCloseTo(FIT.astronautHeight, 3);
         expect(ASSETS.astronaut.scale).toBe(ASTRONAUT_SCALE);
      });
   });
});
