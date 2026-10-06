// The auto-rig on the real shared robot (public/models/3d/shared/robot.glb, read and meshopt-decoded
// here without a loader, robotGlb.ts): the measured ROBOT_LANDMARKS match what the heuristics find,
// and its poses keep the feet on the floor, the hands clear of the body and the head, the helmet
// rigid and the shoulders uncrushed. A new robot.glb must be re-measured.
import { beforeAll, describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from "three";
import { ROBOT_LANDMARKS, SHARED_ASSETS } from "../sharedAssets";
import { bodyLift, walkStride } from "./gait";
import { BONE, estimateHumanoidLandmarks, type HumanoidLandmarks } from "./humanoid";
import { POSE_MASK, armsDownPose, blendPoses, carryPose, cheerPose, createPose, idlePose, reachPose, restPose, walkPose, type HumanoidPose } from "./poses";
import { readRobotGlb, type RobotGlb } from "./robotGlb";
import { applyHumanoidPose, buildHumanoidTemplate, cloneHumanoid, type HumanoidRig } from "./skinning";

let robot: RobotGlb;
let rig: HumanoidRig;
let skin: SkinnedMesh;
let position: BufferAttribute;

beforeAll(async () => {
   robot = await readRobotGlb();
   // the robot as a GLB scene (mesh under its translated node), auto-rigged with its committed landmarks
   const root = new Group();
   const holder = new Group();
   holder.position.fromArray(robot.node);
   const geometry = new BufferGeometry();
   position = new BufferAttribute(robot.local, 3);
   geometry.setAttribute("position", position);
   holder.add(new Mesh(geometry, new MeshBasicMaterial()));
   root.add(holder);
   rig = cloneHumanoid(buildHumanoidTemplate(root, SHARED_ASSETS.robot.humanoid)!);
   skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
});

/** Every vertex of the robot in `pose`, skinned on the CPU like the vertex shader does (GLB root space). */
function posed(pose: HumanoidPose, applyLift = true): Float32Array {
   applyHumanoidPose(rig, pose, applyLift);
   rig.root.updateMatrixWorld(true);
   const world = new Float32Array(robot.cloud.length);
   const v = new Vector3();
   for (let i = 0; i < position.count; i++) skin.applyBoneTransform(i, v.fromBufferAttribute(position, i)).applyMatrix4(skin.matrixWorld).toArray(world, i * 3);
   return world;
}

const L = ROBOT_LANDMARKS;

describe("shared robot.glb", () => {
   it("is the 1.90 x 1.72 x 0.60 T-pose the landmarks were measured on (float positions)", () => {
      expect(robot.positionType).toBe(5126);
      let maxY = 0;
      let reach = 0;
      for (let i = 0; i < robot.cloud.length; i += 3) {
         maxY = Math.max(maxY, robot.cloud[i + 1]);
         reach = Math.max(reach, Math.abs(robot.cloud[i]));
      }
      expect(maxY).toBeCloseTo(1.715, 2);
      expect(reach).toBeCloseTo(0.95, 2);
   });

   it("the committed landmarks are close to the estimate (positions within 6 cm, shoulders 3 cm, blends 2 cm)", () => {
      const estimate = estimateHumanoidLandmarks(robot.cloud);
      const blends: Array<keyof HumanoidLandmarks> = ["shoulderBlend", "elbowBlend", "hipBlend", "kneeBlend", "ankleBlend", "crotchBlend", "spineBlend", "neckBlend"];
      for (const key of Object.keys(ROBOT_LANDMARKS) as Array<keyof HumanoidLandmarks>) {
         // the arm spread is raised by eye (16° against the estimated 9°) so the hanging arms clear the body
         const tolerance = key === "armSpread" ? 0.15 : key === "shoulderX" || key === "shoulderY" ? 0.03 : blends.includes(key) ? 0.02 : 0.06;
         expect(Math.abs(estimate[key] - ROBOT_LANDMARKS[key]), key).toBeLessThan(tolerance);
      }
   });

   it("bind pose: every vertex where the static GLB draws it", () => {
      const world = posed(restPose(createPose()));
      let worst = 0;
      for (let i = 0; i < world.length; i++) worst = Math.max(worst, Math.abs(robot.cloud[i] - world[i]));
      expect(worst).toBeLessThan(1e-5);
   });

   it("arms down: hands below the shoulders and clear of the hips, the head and the legs still", () => {
      const world = posed(armsDownPose(createPose()));
      const rest = robot.cloud;
      let hands = 0;
      for (let i = 0; i < rest.length / 3; i++) {
         const x = rest[i * 3];
         const y = rest[i * 3 + 1];
         const moved = Math.hypot(world[i * 3] - x, world[i * 3 + 1] - y, world[i * 3 + 2] - rest[i * 3 + 2]);
         if (y > 1.2 || y < L.crotchY) expect(moved).toBeLessThan(1e-5);
         if (Math.abs(x) < L.wristX) continue;
         hands++;
         expect(world[i * 3 + 1]).toBeLessThan(L.shoulderY - 0.3);
         // the hips are 0.27 wide at most
         expect(Math.abs(world[i * 3])).toBeGreaterThan(0.3);
         expect(Math.sign(world[i * 3])).toBe(Math.sign(x));
      }
      expect(hands).toBeGreaterThan(1000);
   });

   it("carry overhead: the hands rise beside the head, up to its top (under a carried box)", () => {
      const world = posed(carryPose(1, createPose()));
      let top = 0;
      for (let i = 0; i < robot.cloud.length / 3; i++) {
         if (Math.abs(robot.cloud[i * 3]) < L.wristX) continue;
         top = Math.max(top, world[i * 3 + 1]);
         // the forearms and hands stay outside the head (0.35 wide) while they pass it
         if (world[i * 3 + 1] > 1.25 && world[i * 3 + 1] < 1.55) expect(Math.abs(world[i * 3])).toBeGreaterThan(0.3);
      }
      expect(top).toBeGreaterThan(1.6);
   });
});

describe("the robot's feet on the floor", () => {
   /** The lowest point of each foot (rest y below the ankle's blend), and of the whole robot. */
   function feet(world: Float32Array): { left: number; right: number; all: number } {
      let left = Infinity;
      let right = Infinity;
      let all = Infinity;
      for (let i = 0; i < world.length / 3; i++) {
         const y = world[i * 3 + 1];
         all = Math.min(all, y);
         if (robot.cloud[i * 3 + 1] > L.ankleY - L.ankleBlend) continue;
         if (robot.cloud[i * 3] > 0) left = Math.min(left, y);
         else right = Math.min(right, y);
      }
      return { left, right, all };
   }
   const STEPS = 16;
   const phaseOf = (k: number) => (k / STEPS) * Math.PI * 2;

   it("walking (amount 0.3 and 0.5): one foot planted within 1 cm of the floor at every phase, the other not below it", () => {
      for (const amount of [0.3, 0.5]) {
         for (let k = 0; k < STEPS; k++) {
            const { left, right, all } = feet(posed(walkPose(phaseOf(k), amount, createPose())));
            expect(Math.min(left, right), `amount ${amount} phase ${k}`).toBeLessThan(0.01);
            expect(Math.min(left, right), `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
            expect(all).toBeGreaterThan(-0.005);
         }
      }
   });

   it("as the games draw it (applyLift false, the group raised by bodyLift), at a walk, a run and the warehouse's carry speed", () => {
      const p = createPose();
      const scratch = createPose();
      for (const amount of [0.3, 0.6, 0.83, 1]) {
         for (let k = 0; k < STEPS; k++) {
            // robot-collector's and warehouse-rush's driver: the walk, the idle's upper body while slow, the carry's arms
            walkPose(phaseOf(k), amount, p);
            blendPoses(p, idlePose(1.3, scratch), 1 - Math.min(1, amount * 5), p, POSE_MASK.upper);
            if (amount === 0.83) blendPoses(p, carryPose(1, scratch), 1, p, POSE_MASK.arms);
            const { all } = feet(posed(p, false));
            expect(all + bodyLift(p, L), `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
         }
         // a run plants its foot at mid-stance (legs together)
         for (const phase of [0, Math.PI]) {
            const { left, right } = feet(posed(walkPose(phase, amount, createPose())));
            expect(Math.abs(Math.min(left, right))).toBeLessThan(0.01);
         }
      }
   });

   it("walkStride is the planted foot's sweep: it goes back half a stride under the body from one reach to the other", () => {
      for (const amount of [0.3, 0.5, 1]) {
         const footZ = (phase: number) => {
            posed(walkPose(phase, amount, createPose()));
            return rig.bones[BONE.footL].getWorldPosition(new Vector3()).z;
         };
         const sweep = footZ(Math.PI / 2) - footZ((3 * Math.PI) / 2);
         expect(walkStride(amount, L)).toBeCloseTo(2 * sweep, 4);
         expect(sweep).toBeGreaterThan(0.1 * amount);
      }
      expect(walkStride(0, L)).toBeCloseTo(0, 9);
      expect(walkStride(1, L)).toBeGreaterThan(walkStride(0.5, L));
   });
});

describe("the robot's head and shoulders", () => {
   it("the helmet (rest y > 1.2) moves rigidly with the head bone (< 2 mm), however the neck and head turn", () => {
      const m = new Matrix4();
      const v = new Vector3();
      for (const pose of [idlePose(1.3, createPose()), idlePose(4, createPose()), cheerPose(0.4, createPose()), walkPose(1, 1, createPose())]) {
         const world = posed(pose);
         m.multiplyMatrices(rig.bones[BONE.head].matrixWorld, skin.skeleton.boneInverses[BONE.head]);
         let worst = 0;
         let helmet = 0;
         for (let i = 0; i < position.count; i++) {
            if (robot.cloud[i * 3 + 1] <= 1.2) continue;
            helmet++;
            v.fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(m).applyMatrix4(skin.bindMatrixInverse).applyMatrix4(skin.matrixWorld);
            worst = Math.max(worst, Math.hypot(v.x - world[i * 3], v.y - world[i * 3 + 1], v.z - world[i * 3 + 2]));
         }
         expect(helmet).toBeGreaterThan(4000);
         expect(worst).toBeLessThan(0.002);
      }
   });

   /** Cap-top shoulder triangles (around the shoulder joint, above its axis) shrunk below 0.6x their area. */
   function crushed(world: Float32Array): number {
      const rest = robot.cloud;
      const idx = robot.indices;
      const area = (p: Float32Array, a: number, b: number, c: number) => {
         const ux = p[b * 3] - p[a * 3];
         const uy = p[b * 3 + 1] - p[a * 3 + 1];
         const uz = p[b * 3 + 2] - p[a * 3 + 2];
         const vx = p[c * 3] - p[a * 3];
         const vy = p[c * 3 + 1] - p[a * 3 + 1];
         const vz = p[c * 3 + 2] - p[a * 3 + 2];
         return Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      };
      let count = 0;
      let checked = 0;
      for (let t = 0; t < idx.length; t += 3) {
         const a = idx[t];
         const b = idx[t + 1];
         const c = idx[t + 2];
         const y = (rest[a * 3 + 1] + rest[b * 3 + 1] + rest[c * 3 + 1]) / 3;
         const x = Math.abs(rest[a * 3] + rest[b * 3] + rest[c * 3]) / 3;
         if (y < L.shoulderY + 0.03 || y > L.shoulderY + 1.25 * L.armRadius + 0.02 || Math.abs(x - L.shoulderX) > 2 * L.shoulderBlend) continue;
         const before = area(rest, a, b, c);
         if (before < 1e-9) continue;
         checked++;
         if (area(world, a, b, c) / before < 0.6) count++;
      }
      expect(checked).toBeGreaterThan(300);
      return count;
   }

   it("arms overhead (carry) shrug the shoulders instead of crushing their caps: at most a handful of cap-top triangles below 0.6x", () => {
      expect(crushed(posed(armsDownPose(createPose())))).toBe(0);
      expect(crushed(posed(carryPose(1, createPose())))).toBeLessThanOrEqual(3);
      // also while walking with the box
      const p = walkPose(1, 0.83, createPose());
      blendPoses(p, carryPose(1, createPose()), 1, p, POSE_MASK.arms);
      expect(crushed(posed(p))).toBeLessThanOrEqual(3);
   });

   it("a high reach and a cheer pass the wide head: no moving-arm vertex at head height inside the head's outline", () => {
      // the cheer's wave is widest (closest to vertical) on the left at t = π/6, on the right at π/18
      for (const [side, pose] of [
         [1, reachPose(1, 1, createPose())],
         [-1, reachPose(-1, 1, createPose())],
         [1, cheerPose(Math.PI / 6, createPose())],
         [-1, cheerPose(Math.PI / 18, createPose())],
      ] as const) {
         const world = posed(pose);
         // the posed helmet's outline: per 1 cm of height and depth, how far out it reaches on this side
         const cell = (y: number, z: number) => `${Math.round(y * 100)},${Math.round(z * 100)}`;
         const outline = new Map<string, number>();
         for (let i = 0; i < position.count; i++) {
            if (robot.cloud[i * 3 + 1] <= 1.19) continue;
            const key = cell(world[i * 3 + 1], world[i * 3 + 2]);
            outline.set(key, Math.max(outline.get(key) ?? -Infinity, side * world[i * 3]));
         }
         let inside = 0;
         let passing = 0;
         for (let i = 0; i < position.count; i++) {
            // the reaching arm beyond the shoulder's blend (all arm)
            if (side * robot.cloud[i * 3] < L.shoulderX + L.shoulderBlend || Math.abs(robot.cloud[i * 3 + 1] - L.shoulderY) > L.armRadius) continue;
            const reach = outline.get(cell(world[i * 3 + 1], world[i * 3 + 2]));
            if (reach === undefined) continue;
            passing++;
            if (side * world[i * 3] < reach - 0.005) inside++;
         }
         expect(passing).toBeGreaterThan(100);
         expect(inside).toBe(0);
      }
   });
});
