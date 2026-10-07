// The auto-rig on the real striker (public/models/3d/penalty-hero/striker.glb, v2): the measured
// STRIKER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the hands
// clear of the shorts and the head rigid (core/rig/characterChecks.ts). A new striker.glb must be
// re-measured.
import { describe } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, STRIKER_LANDMARKS } from "./assets";

describe("penalty-hero striker.glb", () => {
   describeCharacter("striker", {
      asset: ASSETS.striker,
      landmarks: STRIKER_LANDMARKS,
      height: 1.876,
      reach: 0.95,
      estimate: {
         // the knee is set behind the lower kneecap (the estimate takes half the hip height, 0.431);
         // the shorts' inner sides part at their hem (0.594), which the estimate reads as a skirt's;
         // the ankle blend is narrowed to keep the boots rigid
         tolerance: { kneeY: 0.08, hemY: 0.2, ankleBlend: 0.03 },
      },
      headFrom: 1.51,
      hipHalfWidth: 0.24,
   });
});
