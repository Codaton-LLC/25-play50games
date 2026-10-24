import { existsSync } from "node:fs";
import path from "node:path";
import { Group, Vector3 } from "three";
import { beforeAll, describe, expect, it } from "vitest";

if (!existsSync(path.join(process.cwd(), "public")) && existsSync(path.join(process.cwd(), "play50games-frontend", "public"))) {
   process.chdir(path.join(process.cwd(), "play50games-frontend"));
}

import { rigCharacter, type RiggedCharacter } from "../../core/rig/characterChecks";
import { BONE } from "../../core/rig/humanoid";
import type { HumanoidPose } from "../../core/rig/poses";
import { applyHumanoidPose, createAnchorGroup } from "../../core/rig/skinning";
import { KNIGHT_LANDMARKS } from "../../core/sharedAssets";
import { ASSETS, SWORD_BLADE_AHEAD } from "./assets";
import {
   guardPose,
   KNIGHT_SCALE,
   lungeStepOffset,
   slashPose,
   spinPose,
   spinYawOffset,
   type StrikeDir,
   victoryPose,
} from "./poses";

const DIRECTIONS: StrikeDir[] = ["up", "down", "left", "right"];

describe("knight-arena poses and attachments", () => {
   let char: RiggedCharacter;
   let handRAnchor: Group;
   let handLAnchor: Group;

   let footIndices: number[] = [];

   beforeAll(async () => {
      char = await rigCharacter(ASSETS.knight);
      const s: [number, number, number] = [KNIGHT_SCALE, KNIGHT_SCALE, KNIGHT_SCALE];
      handRAnchor = createAnchorGroup(char.rig, "handR", s);
      handLAnchor = createAnchorGroup(char.rig, "handL", s);
      char.rig.bones[char.rig.anchors.handR.bone].add(handRAnchor);
      char.rig.bones[char.rig.anchors.handL.bone].add(handLAnchor);
      const L = KNIGHT_LANDMARKS;
      footIndices = [];
      for (let i = 0; i < char.position.count; i++) {
         if (char.glb.cloud[i * 3 + 1] <= L.ankleY - L.ankleBlend) {
            footIndices.push(i);
         }
      }
   });

   function minFootYMetres(pose: HumanoidPose): { left: number; right: number } {
      applyHumanoidPose(char.rig, pose, true);
      char.rig.root.scale.setScalar(1);
      char.rig.root.position.set(0, 0, 0);
      char.rig.root.rotation.set(0, 0, 0);
      char.rig.root.updateMatrixWorld(true);
      let left = Infinity;
      let right = Infinity;
      const v = new Vector3();
      for (const i of footIndices) {
         char.skin.applyBoneTransform(i, v.fromBufferAttribute(char.position, i)).applyMatrix4(char.skin.matrixWorld);
         const yM = v.y * KNIGHT_SCALE;
         if (char.glb.cloud[i * 3] > 0) left = Math.min(left, yM);
         else right = Math.min(right, yM);
      }
      return { left, right };
   }

   function swordTipWorld(pose: HumanoidPose, rootOffset = { x: 0, y: 0, z: 0 }, rootYaw = 0): Vector3 {
      applyHumanoidPose(char.rig, pose, false);
      char.rig.root.scale.setScalar(KNIGHT_SCALE);
      char.rig.root.position.set(rootOffset.x, rootOffset.y, rootOffset.z);
      char.rig.root.rotation.set(0, rootYaw, 0);
      char.rig.root.updateMatrixWorld(true);
      const tipLocal = new Vector3(-SWORD_BLADE_AHEAD, 0, 0);
      return handRAnchor.localToWorld(tipLocal);
   }

   function headCenterWorld(pose: HumanoidPose, rootOffset = { x: 0, y: 0, z: 0 }, rootYaw = 0): Vector3 {
      applyHumanoidPose(char.rig, pose, false);
      char.rig.root.scale.setScalar(KNIGHT_SCALE);
      char.rig.root.position.set(rootOffset.x, rootOffset.y, rootOffset.z);
      char.rig.root.rotation.set(0, rootYaw, 0);
      char.rig.root.updateMatrixWorld(true);
      const headBone = char.rig.bones[BONE.head];
      return headBone.localToWorld(new Vector3(0, 0.12, 0));
   }

   it("keeps knight soles within 1 cm of the floor across guard, 4 slashes, far lunge step, spin, and victory", () => {
      for (let i = 0; i <= 16; i++) {
         const u = i / 16;
         const gFeet = minFootYMetres(guardPose(u * 2));
         expect(Math.min(gFeet.left, gFeet.right)).toBeGreaterThanOrEqual(-0.01);
         expect(Math.min(gFeet.left, gFeet.right)).toBeLessThanOrEqual(0.01);

         const sFeet = minFootYMetres(spinPose(u));
         expect(Math.min(sFeet.left, sFeet.right)).toBeGreaterThanOrEqual(-0.01);
         expect(Math.min(sFeet.left, sFeet.right)).toBeLessThanOrEqual(0.01);

         const vFeet = minFootYMetres(victoryPose(u * 2));
         expect(Math.min(vFeet.left, vFeet.right)).toBeGreaterThanOrEqual(-0.01);
         expect(Math.min(vFeet.left, vFeet.right)).toBeLessThanOrEqual(0.01);

         for (const dir of DIRECTIONS) {
            const nearFeet = minFootYMetres(slashPose(dir, u, false));
            expect(Math.min(nearFeet.left, nearFeet.right)).toBeGreaterThanOrEqual(-0.01);
            expect(Math.min(nearFeet.left, nearFeet.right)).toBeLessThanOrEqual(0.01);

            const farFeet = minFootYMetres(slashPose(dir, u, true));
            expect(Math.min(farFeet.left, farFeet.right)).toBeGreaterThanOrEqual(-0.01);
            expect(Math.min(farFeet.left, farFeet.right)).toBeLessThanOrEqual(0.01);
         }
      }
      expect(handLAnchor).toBeDefined();
   });

   it("reaches within <= 0.15 m of near (1.28 m) and far (2.28 m) dummy front surfaces at u = 0.5", () => {
      const nearFrontZ = 1.60 - 0.32; // 1.28 m
      const farFrontZ = 2.60 - 0.32; // 2.28 m

      for (const dir of DIRECTIONS) {
         const nearPose = slashPose(dir, 0.5, false);
         const nearOffset = lungeStepOffset(0.5, false, 0, nearPose);
         const nearTip = swordTipWorld(nearPose, nearOffset, 0);
         const nearDistXZ = Math.hypot(nearTip.x, nearTip.z - nearFrontZ);
         expect(nearDistXZ, `${dir} near reach (${nearTip.x.toFixed(3)}, ${nearTip.z.toFixed(3)})`).toBeLessThanOrEqual(0.15);

         const farPose = slashPose(dir, 0.5, true);
         const farOffset = lungeStepOffset(0.5, true, 0, farPose);
         const farTip = swordTipWorld(farPose, farOffset, 0);
         const farDistXZ = Math.hypot(farTip.x, farTip.z - farFrontZ);
         expect(farDistXZ, `${dir} far reach (${farTip.x.toFixed(3)}, ${farTip.z.toFixed(3)})`).toBeLessThanOrEqual(0.15);
      }

      // Distinct directional trajectories
      const upTip = swordTipWorld(slashPose("up", 0.5, false));
      const downTip = swordTipWorld(slashPose("down", 0.5, false));
      expect(upTip.y).toBeGreaterThan(downTip.y + 0.15);

      const leftStart = swordTipWorld(slashPose("left", 0.2, false));
      const leftEnd = swordTipWorld(slashPose("left", 0.8, false));
      expect(leftEnd.x).toBeGreaterThan(leftStart.x + 0.25);

      const rightStart = swordTipWorld(slashPose("right", 0.2, false));
      const rightEnd = swordTipWorld(slashPose("right", 0.8, false));
      expect(rightEnd.x).toBeLessThan(rightStart.x - 0.25);
   });

   it("keeps sword tip <= 1.80 m during play and never clips the knight's head", () => {
      for (let i = 0; i <= 20; i++) {
         const u = i / 20;
         const gPose = guardPose(u);
         const gTip = swordTipWorld(gPose, lungeStepOffset(0, false, 0, gPose));
         const gHead = headCenterWorld(gPose, lungeStepOffset(0, false, 0, gPose));
         expect(gTip.y).toBeLessThanOrEqual(1.80);
         expect(gTip.distanceTo(gHead)).toBeGreaterThan(0.22);

         const sPose = spinPose(u);
         const sTip = swordTipWorld(sPose, lungeStepOffset(0, false, 0, sPose), spinYawOffset(u));
         const sHead = headCenterWorld(sPose, lungeStepOffset(0, false, 0, sPose), spinYawOffset(u));
         expect(sTip.y).toBeLessThanOrEqual(1.80);
         expect(sTip.distanceTo(sHead)).toBeGreaterThan(0.22);

         for (const dir of DIRECTIONS) {
            for (const isFar of [false, true]) {
               const pose = slashPose(dir, u, isFar);
               const offset = lungeStepOffset(u, isFar, 0, pose);
               const tip = swordTipWorld(pose, offset, 0);
               const head = headCenterWorld(pose, offset, 0);
               expect(tip.y, `${dir} u=${u} isFar=${isFar} y`).toBeLessThanOrEqual(1.80);
               expect(tip.distanceTo(head), `${dir} u=${u} head clearance`).toBeGreaterThan(0.22);
            }
         }
      }
   });

   it("keeps lunging knight body (> 0.72 m) clear of adjacent near dummy on +22.5 deg far ray", () => {
      const nearDummy = { x: 0, z: -1.60 }; // near Up dummy (r = 0.32 m)
      const farUpPos = { x: 1.00, z: -2.40 }; // far Up dummy at 2.60 m rotated +22.5 deg
      const farUpYaw = Math.atan2(farUpPos.x, farUpPos.z);

      for (let i = 0; i <= 20; i++) {
         const u = i / 20;
         const pose = slashPose("up", u, true);
         const offset = lungeStepOffset(u, true, farUpYaw, pose);
         const dist = Math.hypot(offset.x - nearDummy.x, offset.z - nearDummy.z);
         expect(dist).toBeGreaterThan(0.72); // knight r=0.40 + dummy r=0.32 = 0.72 m
      }
   });
});
