import { beforeAll, describe, expect, it } from "vitest";
import { createPose, soleHeight } from "@/arcade3d/core/rig";
import { rigCharacter } from "@/arcade3d/core/rig/characterChecks";
import { SNOW_KID_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, KID_SCALE } from "./assets";
import { kidPose, type KidLook } from "./poses";

describe("snow kid soles", () => {
   beforeAll(async () => { await rigCharacter(ASSETS.kid); });

   it("keeps the lower sole within 1 cm for walk, crouch, throw and cheer", () => {
      const out = createPose();
      const scratch = createPose();
      const looks: KidLook[] = ["walk", "crouch", "throw", "cheer"];
      for (const look of looks) for (const speed of [0, 2, 4.5]) for (let k = 0; k < 8; k++) {
         kidPose(k / 8 * Math.PI * 2, speed, look, k * 0.2, out, scratch);
         const floor = Math.min(
            soleHeight(out, SNOW_KID_LANDMARKS, 1),
            soleHeight(out, SNOW_KID_LANDMARKS, -1),
         ) * KID_SCALE;
         expect(Math.abs(floor), look).toBeLessThanOrEqual(0.01);
      }
   });
});
