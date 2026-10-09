import { beforeAll, describe, expect, it } from "vitest";
import { Vector3 } from "three";
import { createAnchorGroup, createPose, soleHeight } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { EXPANSION_GLB_POINTS, RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, HUNTER_SCALE, PACK_OFFSET, VACUUM_SCALE } from "./assets";
import { hunterPose } from "./poses";

describe("posed runner floor and vacuum attachment", () => {
   let character: RiggedCharacter;
   beforeAll(async () => { character = await rigCharacter(ASSETS.hunter); });
   it("keeps the planted sole within 1cm through walking, aiming and cheering", () => {
      let worst = 0;
      for (const amount of [0, 0.3, 0.6, 1]) for (const cheer of [false, true]) for (let k = 0; k < 24; k++) {
         const p = createPose(); hunterPose(k / 24 * Math.PI * 2, amount, cheer, k / 24, p);
         // Match the sole landmarks that HumanoidModel uses for bodyLift.
         const floor = Math.min(soleHeight(p, RUNNER_LANDMARKS, 1), soleHeight(p, RUNNER_LANDMARKS, -1)) * HUNTER_SCALE;
         worst = Math.max(worst, Math.abs(floor));
      }
      expect(worst).toBeLessThanOrEqual(0.01);
   });
   it("places the transformed canister back exactly 1cm behind the chest anchor for every pose", () => {
      const anchor = createAnchorGroup(character.rig, "chest", [HUNTER_SCALE, HUNTER_SCALE, HUNTER_SCALE]);
      const info = character.rig.anchors.chest;
      character.rig.bones[info.bone].add(anchor);
      const point = new Vector3(), origin = new Vector3();
      for (const cheer of [false, true]) for (let k = 0; k < 24; k++) {
         const p = createPose(); hunterPose(k / 24 * Math.PI * 2, 1, cheer, k / 24, p);
         character.posed(p);
         point.set(-EXPANSION_GLB_POINTS.vacuumBack.x * VACUUM_SCALE + PACK_OFFSET[0], EXPANSION_GLB_POINTS.vacuumBack.y * VACUUM_SCALE + PACK_OFFSET[1], -EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE + PACK_OFFSET[2]);
         anchor.localToWorld(point); anchor.localToWorld(origin.set(0, 0, 0));
         expect(point.distanceTo(origin) * HUNTER_SCALE).toBeCloseTo(0.01, 5);
      }
      anchor.removeFromParent();
   });
});
