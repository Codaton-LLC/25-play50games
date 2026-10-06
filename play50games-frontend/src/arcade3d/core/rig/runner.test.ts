// The auto-rig on the real shared runner (public/models/3d/shared/runner.glb): the measured
// RUNNER_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the hands
// clear of the hips and the head rigid (characterChecks.ts). A new runner.glb must be re-measured.
import { describe } from "vitest";
import { RUNNER_LANDMARKS, SHARED_ASSETS } from "../sharedAssets";
import { describeCharacter } from "./characterChecks";

describe("shared runner.glb", () => {
   describeCharacter("runner", {
      asset: SHARED_ASSETS.runner,
      landmarks: RUNNER_LANDMARKS,
      height: 1.897,
      reach: 0.894,
      estimate: {
         // no cloth: the estimate takes the joggers' close inner thighs for a hem at 0.648; the
         // ankle blend is narrowed to keep the sneakers rigid
         tolerance: { hemY: 0.15, ankleBlend: 0.03 },
      },
      headFrom: 1.61,
      hipHalfWidth: 0.22,
   });
});
