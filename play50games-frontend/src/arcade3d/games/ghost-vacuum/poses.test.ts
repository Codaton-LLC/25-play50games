import { beforeAll, describe, expect, it } from "vitest";
import { CatmullRomCurve3, Vector3 } from "three";
import { createAnchorGroup, createPose, soleHeight } from "@/arcade3d/core/rig";
import { rigCharacter, type RiggedCharacter } from "@/arcade3d/core/rig/characterChecks";
import { EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, RUNNER_LANDMARKS } from "@/arcade3d/core/sharedAssets";
import { ASSETS, HUNTER_SCALE, PACK_OFFSET, VACUUM_SCALE } from "./assets";
import { hunterPose } from "./poses";
import { BONE } from "@/arcade3d/core/rig/humanoid";
import { HOSE_RADIUS, HOSE_ROUTE } from "./Vacuum";

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
   it("aligns the measured canister back with the independently measured runner back surface", () => {
      const L = RUNNER_LANDMARKS, backY = (L.chestY + L.shoulderY) / 2;
      let backZ = Infinity;
      const cloud = character.glb.cloud;
      for (let i = 0; i < cloud.length; i += 3) {
         if (Math.abs(cloud[i]) <= L.clavicleX * 0.3 && Math.abs(cloud[i + 1] - backY) <= (L.shoulderY - L.chestY) * 0.2) backZ = Math.min(backZ, cloud[i + 2]);
      }
      expect(Number.isFinite(backZ)).toBe(true);
      const scale = 0.55 / EXPANSION_GLB_SIZE.vacuum.height;
      expect(VACUUM_SCALE).toBeCloseTo(scale, 10);
      const anchor = createAnchorGroup(character.rig, "chest", [HUNTER_SCALE, HUNTER_SCALE, HUNTER_SCALE]);
      const bone = character.rig.bones[BONE.chest];
      bone.add(anchor);
      const point = new Vector3(), surface = new Vector3(), normal = new Vector3();
      for (const cheer of [false, true]) for (let k = 0; k < 12; k++) {
         const pose = createPose(); hunterPose(k / 12 * Math.PI * 2, 1, cheer, k / 12, pose); character.posed(pose);
         point.set(-EXPANSION_GLB_POINTS.vacuumBack.x * scale, EXPANSION_GLB_POINTS.vacuumBack.y * scale, -EXPANSION_GLB_POINTS.vacuumBack.z * scale).add(new Vector3(...PACK_OFFSET));
         anchor.localToWorld(point).multiplyScalar(HUNTER_SCALE);
         // Compute this independently from mesh vertices and runner joints, never PACK_OFFSET.
         bone.localToWorld(surface.set(0, backY - L.chestY, backZ - L.spineZ)).multiplyScalar(HUNTER_SCALE);
         normal.set(0, 0, 1).transformDirection(bone.matrixWorld);
         point.sub(surface);
         // 1 cm skin + 7 cm for the upper back (shoulder blades) that bulges 6.3 cm behind this mid-back strip
         expect(point.dot(normal)).toBeCloseTo(-0.08, 6);
         expect(point.length()).toBeLessThanOrEqual(0.080001);
      }
      anchor.removeFromParent();
   });
   it("keeps the canister and hose clear of the posed torso and upper arm", () => {
      const chest = createAnchorGroup(character.rig, "chest", [HUNTER_SCALE, HUNTER_SCALE, HUNTER_SCALE]);
      const hand = createAnchorGroup(character.rig, "handR", [HUNTER_SCALE, HUNTER_SCALE, HUNTER_SCALE]);
      character.rig.bones[character.rig.anchors.chest.bone].add(chest);
      character.rig.bones[character.rig.anchors.handR.bone].add(hand);
      const curve = new CatmullRomCurve3(HOSE_ROUTE.map((p) => new Vector3(...p)));
      const point = new Vector3(), vertex = new Vector3();
      const size = EXPANSION_GLB_SIZE.vacuum, scale = 0.55 / size.height;
      let hoseGap = Infinity, packPenetration = 0;
      for (const cheer of [false, true]) for (let k = 0; k < 8; k++) {
         const pose = createPose(); hunterPose(k / 8 * Math.PI * 2, 1, cheer, k / 8, pose);
         const world = character.posed(pose), rest = character.glb.cloud, L = RUNNER_LANDMARKS;
         hand.localToWorld(point.set(0, 0, 0)); chest.worldToLocal(point); curve.points[4].copy(point);
         const samples = Array.from({ length: 25 }, (_, j) => curve.getPoint(0.15 + j / 24 * 0.7));
         for (let i = 0; i < world.length; i += 3) {
            vertex.fromArray(world, i); chest.worldToLocal(vertex);
            const dx = size.width * scale / 2 - Math.abs(vertex.x);
            const dy = Math.min(vertex.y - PACK_OFFSET[1], PACK_OFFSET[1] + 0.55 - vertex.y);
            const dz = Math.min(PACK_OFFSET[2] + EXPANSION_GLB_POINTS.vacuumBack.z * -VACUUM_SCALE - vertex.z, vertex.z - (PACK_OFFSET[2] - EXPANSION_GLB_POINTS.vacuumBack.z * VACUUM_SCALE) + size.depth * scale);
            if (dx > 0 && dy > 0 && dz > 0) packPenetration = Math.max(packPenetration, Math.min(dx, dy, dz));
            const arm = Math.abs(rest[i]) >= L.shoulderX && Math.abs(rest[i]) <= L.elbowX && Math.abs(rest[i + 1] - L.shoulderY) < L.armRadius * 2;
            const torso = Math.abs(rest[i]) < L.shoulderX && rest[i + 1] >= L.hipY && rest[i + 1] <= L.neckY;
            if (arm || torso) for (const sample of samples) hoseGap = Math.min(hoseGap, vertex.distanceTo(sample) - HOSE_RADIUS);
         }
      }
      expect(packPenetration).toBeLessThanOrEqual(0.005);
      expect(hoseGap).toBeGreaterThanOrEqual(0.005);
      chest.removeFromParent(); hand.removeFromParent();
   });
});
