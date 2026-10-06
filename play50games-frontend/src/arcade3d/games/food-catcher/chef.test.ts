// The auto-rig on the real chef (public/models/3d/food-catcher/chef.glb): the measured
// CHEF_LANDMARKS match what the heuristics find, its poses keep the feet on the floor, the hands
// clear of the apron and the toque rigid, and the apron hangs between the stepping legs
// (core/rig/characterChecks.ts). A new chef.glb must be re-measured.
import { describe } from "vitest";
import { describeCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ASSETS, CHEF_LANDMARKS } from "./assets";

describe("food-catcher chef.glb", () => {
   describeCharacter("chef", {
      asset: ASSETS.chef,
      landmarks: CHEF_LANDMARKS,
      height: 1.898,
      reach: 0.897,
      estimate: {
         // the apron's hem: its decimated middle hides the lower bands from the estimate's bridge count (0.633 for 0.53)
         tolerance: { hemY: 0.12 },
      },
      headFrom: 1.46,
      hipHalfWidth: 0.235,
      // the apron: from its hem to the crotch, in front of the thighs (the legs' front is at about z 0.09)
      apron: { hemY: 0.53, topY: 0.75, frontZ: 0.12 },
   });
});
