// The auto-rig on the real cleaner (public/models/3d/clean-city/cleaner.glb, 2026-10-08): the
// measured CLEANER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor,
// the hands clear of the hips and the bearded head rigid (core/rig/characterChecks.ts); its scale
// keeps it 0.95 tall. A new cleaner.glb must be re-measured.
import { describe, expect, it } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, CLEANER_LANDMARKS } from "./assets";

const L = CLEANER_LANDMARKS;

describe("clean-city cleaner.glb", () => {
   describeCharacter("cleaner", {
      asset: ASSETS.cleaner,
      landmarks: L,
      // the arm span (1.898) and the height (1.902) are both about Rodin's 1.9
      height: 1.902,
      reach: 0.949,
      estimate: {
         // set by eye (assets.ts): the head joint on the collar (the beard reaches 1.505), so the face
         // and beard turn as one (estimate 1.526 / 1.565); no cloth bridges the legs (hemY = crotchY:
         // the estimate's 0.634 is the close cargo thighs)
         tolerance: { neckY: 0.08, headY: 0.09, hemY: 0.17 },
      },
      // the head joint 1.49 + its 0.012 blend: the beard, face, glasses and hair above it are rigid
      headFrom: 1.505,
      // the vest is 0.21-0.23 wide beside the wrists (posed y 0.80-0.90), the cargo pockets 0.26 beside
      // the fingertips (y 0.70-0.72, which hang at 0.29): the hands clear the body by 2.7-6.5 cm
      hipHalfWidth: 0.25,
   });

   it("its scale draws it 0.95 tall, the shared runner's height in this game", () => {
      expect(1.9022 * (ASSETS.cleaner.scale ?? 1)).toBeCloseTo(0.95, 3);
   });
});
