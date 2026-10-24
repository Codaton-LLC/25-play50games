// The auto-rig on the ghost-vacuum hunter (public/models/3d/ghost-vacuum/hunter.glb, 2026-10-24, from the
// user's own concept): the measured HUNTER_LANDMARKS match what the heuristics find, its poses keep the
// feet on the floor, the hands clear of the hips and the bearded head (with its headset) rigid
// (core/rig/characterChecks.ts), its scale keeps it 1.56 m tall like the runner it replaced, and the
// short sleeves hang with the arms. The game's own poses and the pack on this mesh: poses.test.ts.
// A new hunter.glb must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { armsDownPose, createPose, idlePose } from "@/arcade3d/core/rig";
import { describeCharacter, rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, HUNTER_GLB_HEIGHT, HUNTER_LANDMARKS, HUNTER_SCALE } from "./assets";

const L = HUNTER_LANDMARKS;

describe("ghost-vacuum hunter.glb", () => {
   describeCharacter("hunter", {
      asset: ASSETS.hunter,
      landmarks: L,
      // the height is Rodin's 1.9 here; the arm span (1.748) is shorter
      height: 1.8997,
      reach: 0.8738,
      estimate: {
         // set by eye (assets.ts): the head joint under the beard (1.405, estimate 1.460) so the face and
         // beard turn as one; no cloth bridges the legs (hemY = crotchY: the estimate's 0.681 is the close
         // inner thighs)
         tolerance: { neckY: 0.08, headY: 0.08, hemY: 0.12 },
      },
      // the head joint 1.405 + its 0.015 blend: the beard, face, glasses, headset and hair above it are rigid
      headFrom: 1.42,
      // the belt pouches are 0.24-0.25 wide at the hips: the hanging hands stay outside them
      hipHalfWidth: 0.25,
   });

   it("its scale draws it 1.56 m tall (the shared runner it replaced: 1.886 x 1.56 / 1.886)", () => {
      expect(ASSETS.hunter.scale).toBe(HUNTER_SCALE);
      expect(HUNTER_GLB_HEIGHT * HUNTER_SCALE).toBeCloseTo(1.56, 6);
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(L.hemY).toBe(L.crotchY);
   });
});

describe("ghost-vacuum hunter.glb: the short sleeves", () => {
   let hunter: RiggedCharacter;
   beforeAll(async () => { hunter = await rigCharacter(ASSETS.hunter); });

   it("with the arms down (and in the idle) nothing above the chest sticks out past |x| 0.37: the whole sleeve hangs with the arm (at the estimate's armRadius 0.057 its top stayed out at 0.41)", () => {
      for (const pose of [armsDownPose(createPose()), idlePose(1.3, createPose())]) {
         const world = hunter.posed(pose);
         let widest = 0;
         for (let i = 0; i < world.length; i += 3) if (world[i + 1] > L.chestY) widest = Math.max(widest, Math.abs(world[i]));
         expect(widest).toBeLessThan(0.37);
      }
   });

   it("is drawn 1.56 m tall on the real mesh", () => {
      let top = -Infinity, low = Infinity;
      const cloud = hunter.glb.cloud;
      for (let i = 1; i < cloud.length; i += 3) { top = Math.max(top, cloud[i]); low = Math.min(low, cloud[i]); }
      expect(low).toBeCloseTo(0, 4);
      expect(top * HUNTER_SCALE).toBeCloseTo(1.56, 3);
   });
});
