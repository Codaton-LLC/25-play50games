// Shared checks for a real character GLB and its committed landmarks (vitest only; the app never
// imports this file). Each character test (rig/runner.test.ts, the games' chef / striker / keeper
// tests) calls describeCharacter(): the GLB is read and meshopt-decoded without a loader
// (robotGlb.ts), auto-rigged with the committed landmarks, and its poses are skinned on the CPU
// like the vertex shader does. rig/robot.test.ts is the hand-written original of these checks.
// rigCharacter() gives a game test the same CPU skinner for its own poses (a catch, a crash).
import { beforeAll, describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, MeshBasicMaterial, SkinnedMesh, Vector3 } from "three";
import type { ModelAsset } from "../types";
import { bodyLift } from "./gait";
import { BONE, estimateHumanoidLandmarks, type HumanoidLandmarks } from "./humanoid";
import { POSE_MASK, armsDownPose, blendPoses, cheerPose, createPose, idlePose, restPose, walkPose, type HumanoidPose } from "./poses";
import { readCharacterGlb, type CharacterGlb } from "./robotGlb";
import { applyHumanoidPose, buildHumanoidTemplate, cloneHumanoid, type HumanoidRig } from "./skinning";

export interface CharacterSpec {
   /** the asset with its committed `humanoid.landmarks` (its url is read from public/) */
   asset: ModelAsset;
   landmarks: HumanoidLandmarks;
   /** the GLB's height and arm reach (|x|) the landmarks were measured on, GLB units */
   height: number;
   reach: number;
   /**
    * How the estimate is compared with the committed set: `explicit` seeds the estimate (a field
    * the heuristics get wrong on this mesh, documented in the test), `tolerance` widens the default
    * tolerance per key (positions 0.06, shoulderX / shoulderY 0.03, blends 0.02, armSpread 0.15).
    */
   estimate?: { explicit?: Partial<HumanoidLandmarks>; tolerance?: Partial<Record<keyof HumanoidLandmarks, number>> };
   /** rest y above which every vertex is the rigid head (a hat, a face) */
   headFrom: number;
   /** the hips' half-width: with the arms down the hands hang outside it */
   hipHalfWidth: number;
   /** cloth that bridges the legs (the chef's apron): its stretch over a walk cycle is checked */
   apron?: { hemY: number; topY: number; frontZ: number };
}

const BLENDS: Array<keyof HumanoidLandmarks> = ["shoulderBlend", "elbowBlend", "hipBlend", "kneeBlend", "ankleBlend", "crotchBlend", "spineBlend", "neckBlend"];
const STEPS = 16;
const phaseOf = (k: number) => (k / STEPS) * Math.PI * 2;

/** A character GLB auto-rigged with its asset's committed landmarks, posed on the CPU. */
export interface RiggedCharacter {
   glb: CharacterGlb;
   rig: HumanoidRig;
   skin: SkinnedMesh;
   position: BufferAttribute;
   /** every vertex in `pose`, skinned on the CPU like the vertex shader does (GLB root space, before the asset's scale and turn) */
   posed(pose: HumanoidPose, applyLift?: boolean): Float32Array;
}

/**
 * Reads `asset`'s GLB (from public/), rigs it like <HumanoidModel> does and returns a CPU skinner:
 * for game tests that check a pose of their own on the real mesh (a catch, a crash). Call it in a
 * beforeAll.
 */
export async function rigCharacter(asset: ModelAsset): Promise<RiggedCharacter> {
   const glb = await readCharacterGlb(asset.url);
   const root = new Group();
   const holder = new Group();
   holder.position.fromArray(glb.node);
   const geometry = new BufferGeometry();
   const position = new BufferAttribute(glb.local, 3);
   geometry.setAttribute("position", position);
   holder.add(new Mesh(geometry, new MeshBasicMaterial()));
   root.add(holder);
   const rig = cloneHumanoid(buildHumanoidTemplate(root, asset.humanoid)!);
   const skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
   const v = new Vector3();
   return {
      glb,
      rig,
      skin,
      position,
      posed(pose: HumanoidPose, applyLift = true): Float32Array {
         applyHumanoidPose(rig, pose, applyLift);
         rig.root.updateMatrixWorld(true);
         const world = new Float32Array(glb.cloud.length);
         for (let i = 0; i < position.count; i++) skin.applyBoneTransform(i, v.fromBufferAttribute(position, i)).applyMatrix4(skin.matrixWorld).toArray(world, i * 3);
         return world;
      },
   };
}

/** Registers the checks of one character (inside the caller's describe). */
export function describeCharacter(name: string, spec: CharacterSpec): void {
   const L = spec.landmarks;
   let glb: CharacterGlb;
   let rig: HumanoidRig;
   let skin: SkinnedMesh;
   let position: BufferAttribute;
   let character: RiggedCharacter;

   beforeAll(async () => {
      character = await rigCharacter(spec.asset);
      ({ glb, rig, skin, position } = character);
   });

   /** Every vertex in `pose`, skinned on the CPU like the vertex shader does (GLB root space). */
   const posed = (pose: HumanoidPose, applyLift = true): Float32Array => character.posed(pose, applyLift);

   /** The lowest point of each foot (rest y below the ankle's blend), and of the whole character. */
   function feet(world: Float32Array): { left: number; right: number; all: number } {
      let left = Infinity;
      let right = Infinity;
      let all = Infinity;
      for (let i = 0; i < world.length / 3; i++) {
         const y = world[i * 3 + 1];
         all = Math.min(all, y);
         if (glb.cloud[i * 3 + 1] > L.ankleY - L.ankleBlend) continue;
         if (glb.cloud[i * 3] > 0) left = Math.min(left, y);
         else right = Math.min(right, y);
      }
      return { left, right, all };
   }

   describe(name, () => {
      it(`is the ${spec.height.toFixed(2)} tall T-pose with a reach of ${spec.reach.toFixed(2)} the landmarks were measured on (float positions)`, () => {
         expect(glb.positionType).toBe(5126);
         let maxY = 0;
         let reach = 0;
         for (let i = 0; i < glb.cloud.length; i += 3) {
            maxY = Math.max(maxY, glb.cloud[i + 1]);
            reach = Math.max(reach, Math.abs(glb.cloud[i]));
         }
         expect(maxY).toBeCloseTo(spec.height, 2);
         expect(reach).toBeCloseTo(spec.reach, 2);
         expect(spec.asset.humanoid?.landmarks).toBe(L);
      });

      it("the committed landmarks are close to the estimate (positions within 6 cm, shoulders 3 cm, blends 2 cm, or the documented tolerance)", () => {
         const estimate = estimateHumanoidLandmarks(glb.cloud, spec.estimate?.explicit);
         for (const key of Object.keys(L) as Array<keyof HumanoidLandmarks>) {
            const base = key === "armSpread" ? 0.15 : key === "shoulderX" || key === "shoulderY" ? 0.03 : BLENDS.includes(key) ? 0.02 : 0.06;
            const tolerance = spec.estimate?.tolerance?.[key] ?? base;
            expect(Math.abs(estimate[key] - L[key]), `${key}: estimate ${estimate[key].toFixed(3)}, committed ${L[key]}`).toBeLessThan(tolerance);
         }
      });

      it("bind pose: every vertex where the static GLB draws it", () => {
         const world = posed(restPose(createPose()));
         let worst = 0;
         for (let i = 0; i < world.length; i++) worst = Math.max(worst, Math.abs(glb.cloud[i] - world[i]));
         expect(worst).toBeLessThan(1e-5);
      });

      it("arms down: the hands hang beside the hips (below the shoulders, outside the hips, on their own side), nothing below the floor, the head and the legs still", () => {
         const world = posed(armsDownPose(createPose()));
         const rest = glb.cloud;
         let hands = 0;
         let low = Infinity;
         for (let i = 0; i < rest.length / 3; i++) {
            const x = rest[i * 3];
            const y = rest[i * 3 + 1];
            low = Math.min(low, world[i * 3 + 1]);
            const moved = Math.hypot(world[i * 3] - x, world[i * 3 + 1] - y, world[i * 3 + 2] - rest[i * 3 + 2]);
            if (y > spec.headFrom || y < L.crotchY) expect(moved, `vertex ${i} at rest y ${y.toFixed(3)}`).toBeLessThan(1e-5);
            if (Math.abs(x) < L.wristX) continue;
            hands++;
            expect(world[i * 3 + 1]).toBeLessThan(L.shoulderY - 0.5 * (L.wristX - L.shoulderX));
            expect(Math.abs(world[i * 3])).toBeGreaterThan(spec.hipHalfWidth);
            expect(Math.sign(world[i * 3])).toBe(Math.sign(x));
         }
         expect(hands).toBeGreaterThan(500);
         expect(low).toBeGreaterThan(-0.005);
      });

      it("walking (amount 0.3 and 0.5): the planted foot within 1 cm of the floor at every phase, nothing below it", () => {
         for (const amount of [0.3, 0.5]) {
            for (let k = 0; k < STEPS; k++) {
               const { left, right, all } = feet(posed(walkPose(phaseOf(k), amount, createPose())));
               expect(Math.min(left, right), `amount ${amount} phase ${k}`).toBeLessThan(0.01);
               expect(Math.min(left, right), `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
               expect(all, `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
            }
         }
      });

      it("as the games draw it (applyLift false, the group raised by bodyLift): a walk, a run and the idle blend keep every vertex above the floor", () => {
         const p = createPose();
         const scratch = createPose();
         for (const amount of [0.3, 0.6, 1]) {
            for (let k = 0; k < STEPS; k++) {
               walkPose(phaseOf(k), amount, p);
               blendPoses(p, idlePose(1.3, scratch), 1 - Math.min(1, amount * 5), p, POSE_MASK.upper);
               const { all } = feet(posed(p, false));
               expect(all + bodyLift(p, L), `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
            }
         }
      });

      it("the head (and whatever it wears) moves rigidly with the head bone (< 2 mm), however the neck and head turn", () => {
         const m = new Matrix4();
         const v = new Vector3();
         for (const pose of [idlePose(1.3, createPose()), idlePose(4, createPose()), cheerPose(0.4, createPose()), walkPose(1, 1, createPose())]) {
            const world = posed(pose);
            m.multiplyMatrices(rig.bones[BONE.head].matrixWorld, skin.skeleton.boneInverses[BONE.head]);
            let worst = 0;
            let head = 0;
            for (let i = 0; i < position.count; i++) {
               if (glb.cloud[i * 3 + 1] <= spec.headFrom) continue;
               head++;
               v.fromBufferAttribute(position, i).applyMatrix4(skin.bindMatrix).applyMatrix4(m).applyMatrix4(skin.bindMatrixInverse).applyMatrix4(skin.matrixWorld);
               worst = Math.max(worst, Math.hypot(v.x - world[i * 3], v.y - world[i * 3 + 1], v.z - world[i * 3 + 2]));
            }
            expect(head).toBeGreaterThan(1000);
            expect(worst).toBeLessThan(0.002);
         }
      });

      if (spec.apron) {
         const apron = spec.apron;
         it("the apron (cloth bridging the legs) stretches less than 2x over a walk cycle at amount 0.5; a thigh poking through it by more than 5 cm is reported", () => {
            const rest = glb.cloud;
            const idx = glb.indices;
            // the apron's triangles: every corner at rest between the hem and the top, in front of the legs
            const inApron = (i: number) => rest[i * 3 + 1] >= apron.hemY && rest[i * 3 + 1] <= apron.topY && rest[i * 3 + 2] >= apron.frontZ;
            const edges: Array<[number, number]> = [];
            for (let t = 0; t < idx.length; t += 3) {
               const a = idx[t];
               const b = idx[t + 1];
               const c = idx[t + 2];
               if (!inApron(a) || !inApron(b) || !inApron(c)) continue;
               edges.push([a, b], [b, c], [c, a]);
            }
            expect(edges.length).toBeGreaterThan(300);
            // the bare thighs: between the knee and the crotch, inside the legs' depth and width
            const thigh: number[] = [];
            for (let i = 0; i < rest.length / 3; i++) {
               const y = rest[i * 3 + 1];
               if (y < L.kneeY + L.kneeBlend || y > L.crotchY - L.hipBlend) continue;
               if (Math.abs(rest[i * 3]) > L.legOuterX || Math.abs(rest[i * 3 + 2] - L.hipZ) > L.legDepth) continue;
               thigh.push(i);
            }
            const length = (p: Float32Array, a: number, b: number) => Math.hypot(p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]);
            let worstStretch = 0;
            let worstPoke = 0;
            const cell = (x: number, y: number) => `${Math.round(x * 50)},${Math.round(y * 50)}`;
            for (let k = 0; k < STEPS; k++) {
               const world = posed(walkPose(phaseOf(k), 0.5, createPose()));
               for (const [a, b] of edges) {
                  const before = length(rest, a, b);
                  if (before < 1e-4) continue;
                  worstStretch = Math.max(worstStretch, length(world, a, b) / before);
               }
               // per 2 cm cell of the posed (x, y): the apron's front and the thighs' front
               const front = new Map<string, number>();
               for (let i = 0; i < rest.length / 3; i++) {
                  if (!inApron(i)) continue;
                  const key = cell(world[i * 3], world[i * 3 + 1]);
                  front.set(key, Math.max(front.get(key) ?? -Infinity, world[i * 3 + 2]));
               }
               for (const i of thigh) {
                  const z = front.get(cell(world[i * 3], world[i * 3 + 1]));
                  if (z !== undefined) worstPoke = Math.max(worstPoke, world[i * 3 + 2] - z);
               }
            }
            expect(worstStretch).toBeLessThan(2);
            if (worstPoke > 0.05) console.info(`${name}: a thigh pokes through the apron by up to ${(worstPoke * 100).toFixed(1)} cm over a walk cycle at amount 0.5 (not asserted)`);
         });
      }
   });
}
