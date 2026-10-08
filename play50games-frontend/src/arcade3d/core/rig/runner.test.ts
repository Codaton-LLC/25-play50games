// The auto-rig on the real shared runner (public/models/3d/shared/runner.glb, v2 2026-10-07): the
// measured RUNNER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the
// hands clear of the hips and the head rigid (characterChecks.ts). A new runner.glb must be re-measured.
import { describe } from "vitest";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "../sharedAssets";
import { describeCharacter } from "./characterChecks";

describe("shared runner.glb", () => {
   describeCharacter("runner", {
      asset: SHARED_ASSETS.runner,
      landmarks: RUNNER_LANDMARKS,
      // the arm span (1.898) is the longest side: Rodin normalised it, not the height
      height: 1.886,
      reach: 0.949,
      estimate: {
         // no neck shows in front of the big head (the beard reaches the hood's collar): the estimate's
         // narrowest bands are the beard and the mouth, so its head joint (1.599) falls at the mouth;
         // the committed joints sit at the top of the collar, so the whole face and beard are rigid
         tolerance: { headY: 0.08, neckY: 0.08 },
      },
      // the head joint 1.53 + its 0.02 blend: the face, glasses, beard and hair above it are rigid
      headFrom: 1.56,
      hipHalfWidth: 0.23,
   });
});
