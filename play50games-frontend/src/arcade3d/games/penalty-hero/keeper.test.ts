// The auto-rig on the real keeper (public/models/3d/penalty-hero/keeper.glb): the measured
// KEEPER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the gloves
// clear of the shorts and the head rigid (core/rig/characterChecks.ts). A new keeper.glb must be
// re-measured.
import { describe } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, KEEPER_LANDMARKS } from "./assets";

describe("penalty-hero keeper.glb", () => {
   describeCharacter("keeper", {
      asset: ASSETS.keeper,
      landmarks: KEEPER_LANDMARKS,
      height: 1.89,
      reach: 0.932,
      estimate: {
         // the arm band is widened by hand to the raglan sleeves; the shorts' inner sides read as a hem
         // (0.662); the ankle blend is narrowed to keep the boots rigid
         tolerance: { armRadius: 0.035, hemY: 0.15, ankleBlend: 0.03 },
      },
      headFrom: 1.58,
      hipHalfWidth: 0.24,
   });
});
