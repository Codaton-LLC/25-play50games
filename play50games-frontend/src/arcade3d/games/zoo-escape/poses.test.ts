// The keeper's poses on the real mesh (core rigCharacter): soles on the floor through the walk and
// the look-around, the torch hand forward of the shoulder and below it (never the T-pose), the head
// carrying the look.
import { beforeAll, describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { BONE, createAnchorGroup, createPose, soleHeight } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { ZOO_KEEPER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, KEEPER_SCALE } from "./assets";
import { KEEPER_CADENCE, LOOK_SHARE, keeperAmount, keeperPhaseStep, keeperPose } from "./poses";

describe("keeper poses", () => {
   let character: RiggedCharacter;
   beforeAll(async () => { character = await rigCharacter(ASSETS.keeper); });

   it("pins the gait mapping", () => {
      expect(keeperAmount(1.3)).toBeCloseTo(1.3 / 3, 12);
      expect(keeperAmount(9)).toBe(1);
      expect(KEEPER_CADENCE).toBe(4);
      expect(LOOK_SHARE).toEqual({ chest: 0.4, head: 0.6 });
      expect(keeperPhaseStep(0, 0, 0.1)).toBe(0);
      expect(keeperPhaseStep(keeperAmount(1.3), 1.3, 0.1)).toBeGreaterThan(0);
   });

   it("keeps the lower sole on the floor within 1 cm through the walk and the look-around", () => {
      const scratch = createPose();
      let worst = 0;
      for (const amount of [0, keeperAmount(1.3), keeperAmount(2)]) for (const look of [-1.2, 0, 0.8]) for (let k = 0; k < 24; k++) {
         const p = createPose();
         keeperPose((k / 24) * Math.PI * 2, amount, look, k / 10, 0, p, scratch);
         const floor = Math.min(soleHeight(p, ZOO_KEEPER_LANDMARKS, 1), soleHeight(p, ZOO_KEEPER_LANDMARKS, -1));
         worst = Math.max(worst, Math.abs(floor * KEEPER_SCALE));
      }
      expect(worst).toBeLessThanOrEqual(0.01);
   });

   it("holds the torch forward and below the shoulder (no T-pose) and turns the head with the look", () => {
      const L = ZOO_KEEPER_LANDMARKS;
      const hand = createAnchorGroup(character.rig, "handR");
      character.rig.bones[character.rig.anchors.handR.bone].add(hand);
      const scratch = createPose();
      const v = new Vector3();
      for (let k = 0; k < 12; k++) {
         const p = createPose();
         keeperPose((k / 12) * Math.PI * 2, keeperAmount(1.3), 0, k / 5, 0, p, scratch);
         character.posed(p);
         hand.getWorldPosition(v);
         expect(v.z, `hand forward at k ${k}`).toBeGreaterThan(L.shoulderZ + 0.15);
         expect(v.y).toBeLessThan(L.shoulderY - 0.1);
         expect(Math.abs(v.x)).toBeLessThan(L.wristX * 0.75);
      }
      const head = new Quaternion(), rest = new Quaternion();
      const p0 = createPose(), p1 = createPose();
      keeperPose(0, 0, 0, 0, 0, p0, scratch);
      keeperPose(0, 0, 0.8, 0, 0, p1, scratch);
      character.posed(p0);
      character.rig.bones[BONE.head].getWorldQuaternion(rest);
      character.posed(p1);
      character.rig.bones[BONE.head].getWorldQuaternion(head);
      expect(2 * Math.acos(Math.min(1, Math.abs(rest.dot(head))))).toBeCloseTo(0.8, 1);
      hand.removeFromParent();
   });
});
