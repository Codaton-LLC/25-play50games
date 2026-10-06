// The auto-rig on the real striker (public/models/3d/penalty-hero/striker.glb): the measured
// STRIKER_LANDMARKS match what the heuristics find once the shoulders are given (its flat chest
// breaks the column heuristic), its poses keep the feet on the floor, the hands clear of the shorts
// and the head rigid (core/rig/characterChecks.ts). A new striker.glb must be re-measured.
import { describe } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, STRIKER_LANDMARKS } from "./assets";

describe("penalty-hero striker.glb", () => {
   describeCharacter("striker", {
      asset: ASSETS.striker,
      landmarks: STRIKER_LANDMARKS,
      height: 1.897,
      reach: 0.917,
      estimate: {
         // the decimated chest leaves the shoulder columns too sparse: the estimate puts the shoulder
         // at 0.07 (and the arm spread at its 0.6 cap) unless the shoulder is given
         explicit: { shoulderX: STRIKER_LANDMARKS.shoulderX },
         // the arm band is widened by hand to the sleeves; the shorts' inner sides read as a hem
         // (0.648); the ankle blend is narrowed to keep the boots rigid
         tolerance: { armRadius: 0.05, hemY: 0.17, ankleBlend: 0.03 },
      },
      headFrom: 1.59,
      hipHalfWidth: 0.24,
   });
});
