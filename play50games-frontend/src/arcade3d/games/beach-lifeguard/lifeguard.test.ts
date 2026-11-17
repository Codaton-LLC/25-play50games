// The auto-rig on charLifeguard.glb (menu1-beach-lifeguard, 2026-10-25): the committed LIFEGUARD_LANDMARKS
// match the heuristics, the poses keep the feet on the floor, the hands clear of the hips and the head rigid
// (core/rig/characterChecks.ts), and the scale draws it 1.82 m tall. A new GLB must be re-measured.
import { describe, expect, it } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, FIT, GLB_SIZE, LIFEGUARD_LANDMARKS, LIFEGUARD_SCALE } from "./assets";

describe("beach-lifeguard charLifeguard.glb", () => {
   describeCharacter("lifeguard", {
      asset: ASSETS.lifeguard,
      landmarks: LIFEGUARD_LANDMARKS,
      height: GLB_SIZE.charLifeguard.height,
      reach: GLB_SIZE.charLifeguard.width / 2,
      // set by hand: no cloth bridges the legs (the estimate puts a hem at the shorts' inner sides)
      estimate: { tolerance: { hemY: 0.2 } },
      headFrom: LIFEGUARD_LANDMARKS.headY + LIFEGUARD_LANDMARKS.neckBlend + 0.005,
      hipHalfWidth: 0.24,
   });

   it("its scale draws it 1.82 m tall", () => {
      expect(GLB_SIZE.charLifeguard.height * LIFEGUARD_SCALE).toBeCloseTo(FIT.lifeguard, 9);
   });

   it("no cloth bridges the legs (hemY = crotchY)", () => {
      expect(LIFEGUARD_LANDMARKS.hemY).toBe(LIFEGUARD_LANDMARKS.crotchY);
   });
});
