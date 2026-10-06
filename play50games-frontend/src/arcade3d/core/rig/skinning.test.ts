// The auto-rig in three.js, skinned on the CPU (SkinnedMesh.applyBoneTransform; node, no WebGL):
// the bind pose draws exactly like <Model>, armsDown and the walk move the right vertices the right
// way, and the template handles node transforms, quantized positions and several meshes.
import { describe, expect, it } from "vitest";
import {
   Box3,
   BufferAttribute,
   BufferGeometry,
   Group,
   Int16BufferAttribute,
   Mesh,
   MeshBasicMaterial,
   SkinnedMesh,
   Vector3,
   type Object3D,
} from "three";
import { assetScale } from "../assets";
import type { ModelAsset } from "../types";
import { bodyLift } from "./gait";
import { BONE, estimateHumanoidLandmarks, type HumanoidLandmarks } from "./humanoid";
import { armsDownPose, createPose, restPose, walkPose, type HumanoidPose } from "./poses";
import { applyHumanoidPose, buildHumanoidTemplate, cloneHumanoid, disposeHumanoid, humanoidTemplate, type HumanoidRig } from "./skinning";
import { APRON, HUMAN, HUMAN_FEET, HUMAN_PARTS, buildShape, gridFace, mirrorPartners } from "./testShapes";

const human = buildShape(HUMAN_PARTS);
const humanL = estimateHumanoidLandmarks(human);
const NODE_Y = 0.86;

function meshOf(positions: Float32Array | BufferAttribute): Mesh {
   const geometry = new BufferGeometry();
   geometry.setAttribute("position", positions instanceof BufferAttribute ? positions : new BufferAttribute(positions, 3));
   return new Mesh(geometry, new MeshBasicMaterial());
}

/** A GLB-like scene: a root with its own transform (<Model> replaces it), the mesh under a node lifted by NODE_Y. */
function humanScene(): Object3D {
   const root = new Group();
   root.position.set(9, 9, 9);
   const node = new Group();
   node.position.set(0, NODE_Y, 0);
   const shifted = Float32Array.from(human, (v, i) => (i % 3 === 1 ? v - NODE_Y : v));
   node.add(meshOf(shifted));
   root.add(node);
   return root;
}

/** Places a GLB root like <Model>: asset scale (with stretch), rotationY, yOffset, nothing else. */
function placeLikeModel(root: Object3D, asset: Partial<ModelAsset>): void {
   root.position.set(0, asset.yOffset ?? 0, 0);
   root.rotation.set(0, asset.rotationY ?? 0, 0);
   root.scale.set(...assetScale(asset));
   root.updateMatrixWorld(true);
}

/** World positions of every vertex of the static (unskinned) model. */
function staticWorld(root: Object3D): Float32Array {
   const out: number[] = [];
   const v = new Vector3();
   root.updateMatrixWorld(true);
   root.traverse((o) => {
      const mesh = o as Mesh;
      if (!mesh.isMesh) return;
      const p = mesh.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
         v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld);
         out.push(v.x, v.y, v.z);
      }
   });
   return Float32Array.from(out);
}

/** World positions of every vertex of a posed rig, skinned on the CPU like the vertex shader does. */
function skinnedWorld(rig: HumanoidRig): Float32Array {
   const out: number[] = [];
   const v = new Vector3();
   rig.root.updateMatrixWorld(true);
   rig.root.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isSkinnedMesh) return;
      const p = mesh.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
         v.fromBufferAttribute(p, i);
         mesh.applyBoneTransform(i, v);
         v.applyMatrix4(mesh.matrixWorld);
         out.push(v.x, v.y, v.z);
      }
   });
   return Float32Array.from(out);
}

function posed(pose: HumanoidPose, landmarks?: Partial<HumanoidLandmarks>, applyLift = true): { rig: HumanoidRig; world: Float32Array } {
   const template = buildHumanoidTemplate(humanScene(), { landmarks });
   if (!template) throw new Error("no template");
   const rig = cloneHumanoid(template);
   applyHumanoidPose(rig, pose, applyLift);
   return { rig, world: skinnedWorld(rig) };
}

const maxDistance = (a: Float32Array, b: Float32Array) => {
   let max = 0;
   for (let i = 0; i < a.length; i += 3) max = Math.max(max, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1], a[i + 2] - b[i + 2]));
   return max;
};

describe("buildHumanoidTemplate", () => {
   it("measures the mesh in the GLB root's space (the node's lift applied, the root's own transform not)", () => {
      const template = buildHumanoidTemplate(humanScene());
      expect(template).not.toBeNull();
      for (const [key, value] of Object.entries(humanL)) expect(template!.landmarks[key as keyof HumanoidLandmarks]).toBeCloseTo(value, 4);
   });

   it("shares the loaded attributes and material, adds 4 skin influences, never frustum culls", () => {
      const scene = humanScene();
      const source = scene.children[0].children[0] as Mesh;
      const template = buildHumanoidTemplate(scene)!;
      const skins: SkinnedMesh[] = [];
      template.root.traverse((o) => {
         if ((o as SkinnedMesh).isSkinnedMesh) skins.push(o as SkinnedMesh);
      });
      expect(skins).toHaveLength(1);
      expect(skins[0].geometry.getAttribute("position")).toBe(source.geometry.getAttribute("position"));
      expect(skins[0].material).toBe(source.material);
      expect(skins[0].geometry.getAttribute("skinIndex").itemSize).toBe(4);
      expect(skins[0].geometry.getAttribute("skinWeight").count).toBe(human.length / 3);
      expect(skins[0].frustumCulled).toBe(false);
      expect(skins[0].skeleton.bones).toHaveLength(17);
   });

   it("reads quantized (normalized int16) positions through the node's dequantizing scale", () => {
      const RANGE = 2;
      const q = new Int16Array(human.length);
      for (let i = 0; i < human.length; i++) q[i] = Math.round((human[i] / RANGE) * 32767);
      const root = new Group();
      const node = new Group();
      node.scale.setScalar(RANGE);
      node.add(meshOf(new Int16BufferAttribute(q, 3, true)));
      root.add(node);
      const template = buildHumanoidTemplate(root)!;
      for (const key of ["shoulderY", "shoulderX", "crotchY", "hipX", "neckY", "wristX"] as const) {
         expect(Math.abs(template.landmarks[key] - humanL[key])).toBeLessThan(0.02);
      }
      // the bind pose of a quantized mesh still draws where the static mesh does
      const rig = cloneHumanoid(template);
      applyHumanoidPose(rig, restPose(createPose()));
      expect(maxDistance(skinnedWorld(rig), staticWorld(root))).toBeLessThan(1e-5);
   });

   it("several meshes share one skeleton and are measured as one cloud", () => {
      const root = new Group();
      const n = human.length / 3;
      const cut = Math.floor(n / 2) * 3;
      const head = new Group();
      head.position.set(0, 0.5, 0);
      root.add(meshOf(human.slice(0, cut)));
      head.add(meshOf(Float32Array.from(human.slice(cut), (v, i) => (i % 3 === 1 ? v - 0.5 : v))));
      root.add(head);
      const template = buildHumanoidTemplate(root)!;
      const skins: SkinnedMesh[] = [];
      template.root.traverse((o) => {
         if ((o as SkinnedMesh).isSkinnedMesh) skins.push(o as SkinnedMesh);
      });
      expect(skins).toHaveLength(2);
      expect(skins[0].skeleton.bones).toEqual(skins[1].skeleton.bones);
      for (const [key, value] of Object.entries(humanL)) expect(template.landmarks[key as keyof HumanoidLandmarks]).toBeCloseTo(value, 5);
      const rig = cloneHumanoid(template);
      applyHumanoidPose(rig, restPose(createPose()));
      expect(maxDistance(skinnedWorld(rig), staticWorld(root))).toBeLessThan(1e-5);
   });

   it("no template for a scene without meshes, or with a real skeleton", () => {
      expect(buildHumanoidTemplate(new Group())).toBeNull();
      const rigged = new Group();
      rigged.add(new SkinnedMesh(new BufferGeometry(), new MeshBasicMaterial()));
      expect(buildHumanoidTemplate(rigged)).toBeNull();
   });

   it("humanoidTemplate builds once per scene and landmark values", () => {
      const scene = humanScene();
      const a = humanoidTemplate(scene, { landmarks: { hipY: 0.9 } });
      expect(humanoidTemplate(scene, { landmarks: { hipY: 0.9 } })).toBe(a);
      expect(humanoidTemplate(scene, { landmarks: { hipY: 0.95 } })).not.toBe(a);
      expect(humanoidTemplate(scene)).toBe(humanoidTemplate(scene, {}));
      expect(humanoidTemplate(humanScene(), { landmarks: { hipY: 0.9 } })).not.toBe(a);
   });
});

describe("the bind pose is <Model>", () => {
   it("same vertices and bounds as the static model under the asset transform (scale, stretch, rotationY, yOffset)", () => {
      const asset = { scale: 1.4, stretch: [1, 0.9, 1.1] as const, rotationY: 0.7, yOffset: 0.2 };
      const source = humanScene();
      const template = buildHumanoidTemplate(source)!;
      const rig = cloneHumanoid(template);
      applyHumanoidPose(rig, restPose(createPose()));
      placeLikeModel(rig.root, asset);
      const staticModel = source.clone(true);
      placeLikeModel(staticModel, asset);
      const skinned = skinnedWorld(rig);
      const plain = staticWorld(staticModel);
      expect(skinned).toHaveLength(plain.length);
      expect(maxDistance(skinned, plain)).toBeLessThan(1e-5);
      const box = (p: Float32Array) => new Box3().setFromArray(p);
      expect(box(skinned).min.distanceTo(box(plain).min)).toBeLessThan(1e-5);
      expect(box(skinned).max.distanceTo(box(plain).max)).toBeLessThan(1e-5);
   });

   it("each clone has its own bones over the shared geometry", () => {
      const template = buildHumanoidTemplate(humanScene())!;
      const a = cloneHumanoid(template);
      const b = cloneHumanoid(template);
      expect(a.bones[BONE.hips]).not.toBe(b.bones[BONE.hips]);
      const skin = (rig: HumanoidRig) => rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
      expect(skin(a).geometry).toBe(skin(b).geometry);
      expect(skin(a).skeleton.bones[BONE.upperArmL]).toBe(a.bones[BONE.upperArmL]);
      applyHumanoidPose(a, walkPose(1, 1, createPose()));
      expect(b.bones[BONE.upperLegL].quaternion.equals(cloneHumanoid(template).bones[BONE.upperLegL].quaternion)).toBe(true);
      expect(a.bones[BONE.upperLegL].quaternion.equals(b.bones[BONE.upperLegL].quaternion)).toBe(false);
   });

   it("disposeHumanoid frees a clone's bone textures, not the shared geometry", () => {
      const template = buildHumanoidTemplate(humanScene())!;
      const rig = cloneHumanoid(template);
      const skin = rig.root.children.find((o) => (o as SkinnedMesh).isSkinnedMesh) as SkinnedMesh;
      const texture = skin.skeleton.computeBoneTexture().boneTexture!;
      let disposed = 0;
      texture.addEventListener("dispose", () => disposed++);
      let geometryDisposed = 0;
      skin.geometry.addEventListener("dispose", () => geometryDisposed++);
      disposeHumanoid(rig);
      expect(disposed).toBe(1);
      expect(skin.skeleton.boneTexture).toBeNull();
      expect(geometryDisposed).toBe(0);
   });
});

describe("skinned poses", () => {
   const rest = posed(restPose(createPose())).world;
   const n = rest.length / 3;
   const at = (p: Float32Array, i: number) => new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);

   it("armsDown brings the hands below the shoulders, beside the torso, on their own side", () => {
      const { world } = posed(armsDownPose(createPose()));
      let hands = 0;
      for (let i = 0; i < n; i++) {
         const x = rest[i * 3];
         if (Math.abs(x) < 0.8) continue;
         hands++;
         const p = at(world, i);
         expect(Math.sign(p.x)).toBe(Math.sign(x));
         expect(p.y).toBeLessThan(humanL.shoulderY - 0.45);
         // outside the torso and within a hand's width of where a hanging arm reaches out
         expect(Math.abs(p.x)).toBeGreaterThan(HUMAN.torsoHalf);
         expect(Math.abs(p.x)).toBeLessThan(humanL.shoulderX + (HUMAN.reach - humanL.shoulderX) * Math.sin(humanL.armSpread) + 0.1);
      }
      expect(hands).toBeGreaterThan(20);
   });

   it("armsDown moves nothing but the arms, and no arm vertex further than its turn about the shoulder allows", () => {
      const { world } = posed(armsDownPose(createPose()));
      const turn = Math.PI / 2 - humanL.armSpread + 0.12; // the drop plus the elbow bend
      for (let i = 0; i < n; i++) {
         const before = at(rest, i);
         const moved = before.distanceTo(at(world, i));
         if (Math.abs(before.x) < humanL.shoulderX - humanL.shoulderBlend || Math.abs(before.y - humanL.shoulderY) > humanL.armRadius * 1.25) {
            expect(moved).toBeLessThan(1e-6);
         } else {
            const shoulder = new Vector3(Math.sign(before.x) * humanL.shoulderX, humanL.shoulderY, humanL.shoulderZ);
            expect(moved).toBeLessThanOrEqual(turn * before.distanceTo(shoulder) + 1e-4);
         }
      }
   });

   it("walk at phase + π is the mirror image of walk at phase", () => {
      const partners = mirrorPartners(human);
      for (const [phase, amount] of [
         [0.3, 0.5],
         [Math.PI / 2, 1],
         [4, 0.8],
      ]) {
         const a = posed(walkPose(phase, amount, createPose())).world;
         const b = posed(walkPose(phase + Math.PI, amount, createPose())).world;
         let worst = 0;
         for (let i = 0; i < n; i++) {
            const j = partners[i];
            worst = Math.max(worst, Math.hypot(b[i * 3] + a[j * 3], b[i * 3 + 1] - a[j * 3 + 1], b[i * 3 + 2] - a[j * 3 + 2]));
         }
         expect(worst).toBeLessThan(1e-4);
      }
   });

   it("walk at π/2 puts the left (+x) foot forward and the right one back, the right elbow forward", () => {
      const { world } = posed(walkPose(Math.PI / 2, 0.8, createPose()));
      let feet = 0;
      let elbows = 0;
      for (let i = 0; i < n; i++) {
         const x = rest[i * 3];
         const y = rest[i * 3 + 1];
         const dz = world[i * 3 + 2] - rest[i * 3 + 2];
         if (y < 0.05) {
            feet++;
            if (x > 0) expect(dz).toBeGreaterThan(0.15);
            else expect(dz).toBeLessThan(-0.15);
         }
         // the elbows swing with the upper arms, opposite to the legs (the hands also bend forward)
         if (Math.abs(Math.abs(x) - humanL.elbowX) < 0.02) {
            elbows++;
            if (x > 0) expect(dz).toBeLessThan(-0.05);
            else expect(dz).toBeGreaterThan(0.05);
         }
      }
      expect(feet).toBeGreaterThan(20);
      expect(elbows).toBeGreaterThan(20);
   });

   it("applyLift raises the whole body by bodyLift (the pose's lift x hip height when standing), only when applied", () => {
      const pose = armsDownPose(createPose());
      pose.lift = 0.05;
      const down = posed(armsDownPose(createPose())).world;
      const lifted = posed(pose).world;
      for (let i = 0; i < n; i += 11) expect(lifted[i * 3 + 1] - down[i * 3 + 1]).toBeCloseTo(0.05 * humanL.hipY, 5);
      const off = posed(pose, undefined, false);
      expect(maxDistance(off.world, down)).toBeLessThan(1e-6);
      expect(off.rig.bones[BONE.hips].position.y).toBe(off.rig.hipsY);
   });

   it("explicit landmarks move the joints the bones turn about", () => {
      const { rig } = posed(armsDownPose(createPose()), { shoulderX: 0.25 });
      rig.root.updateMatrixWorld(true);
      const p = new Vector3();
      expect(rig.bones[BONE.upperArmL].getWorldPosition(p).x).toBeCloseTo(0.25, 6);
      expect(rig.bones[BONE.upperArmR].getWorldPosition(p).x).toBeCloseTo(-0.25, 6);
      expect(rig.landmarks.shoulderX).toBe(0.25);
   });
});

/** A rig over `positions` (one mesh at the GLB root), with optional explicit landmarks. */
function rigOf(positions: Float32Array, landmarks?: Partial<HumanoidLandmarks>): HumanoidRig {
   const root = new Group();
   root.add(meshOf(positions));
   return cloneHumanoid(buildHumanoidTemplate(root, { landmarks })!);
}

describe("the feet on the floor (a human with long flat shoes)", () => {
   const shape = buildShape([...HUMAN_PARTS, HUMAN_FEET]);
   const rig = rigOf(shape);
   const lowest = (pose: HumanoidPose, applyLift: boolean) => {
      applyHumanoidPose(rig, pose, applyLift);
      const world = skinnedWorld(rig);
      let low = Infinity;
      for (let i = 1; i < world.length; i += 3) low = Math.min(low, world[i]);
      // a game that moves the model's group itself adds bodyLift to it
      return low + (applyLift ? 0 : bodyLift(pose, rig.landmarks));
   };
   const PHASE_STEPS = 24;

   it("a walk keeps one sole on the floor at every phase (within 1 cm) and none below it, lifted by the rig or by the game", () => {
      for (const amount of [0.3, 0.5]) {
         for (const applyLift of [true, false]) {
            for (let k = 0; k < PHASE_STEPS; k++) {
               const low = lowest(walkPose((k / PHASE_STEPS) * Math.PI * 2, amount, createPose()), applyLift);
               expect(low, `amount ${amount} phase ${k}`).toBeGreaterThan(-0.005);
               expect(low, `amount ${amount} phase ${k}`).toBeLessThan(0.01);
            }
         }
      }
   });

   it("a run never sinks a sole into the floor, and plants one near mid-stance (legs together)", () => {
      for (const amount of [0.6, 0.8, 1]) {
         for (let k = 0; k < PHASE_STEPS; k++) expect(lowest(walkPose((k / PHASE_STEPS) * Math.PI * 2, amount, createPose()), true)).toBeGreaterThan(-0.005);
         for (const phase of [0, Math.PI]) expect(Math.abs(lowest(walkPose(phase, amount, createPose()), true))).toBeLessThan(0.01);
      }
   });

   it("standing poses stand on the floor; the soles stay flat on it while the body dips at the long stride", () => {
      expect(Math.abs(lowest(armsDownPose(createPose()), true))).toBeLessThan(1e-4);
      // at the long stride both legs are straight and apart: the body is lower than standing
      const stride = walkPose(Math.PI / 2, 0.5, createPose());
      expect(bodyLift(stride, rig.landmarks)).toBeLessThan(-0.01);
      applyHumanoidPose(rig, stride);
      const world = skinnedWorld(rig);
      // every sole vertex (rest y = 0) of both shoes is on the floor: the shoes are flat, not tipped
      let soles = 0;
      for (let i = 0; i < shape.length / 3; i++) {
         if (shape[i * 3 + 1] > 1e-6) continue;
         soles++;
         expect(Math.abs(world[i * 3 + 1])).toBeLessThan(0.004);
      }
      expect(soles).toBeGreaterThan(50);
   });
});

describe("cloth that bridges the legs (an apron)", () => {
   // the apron's front face as a triangulated grid, on top of the human and the apron box
   const body = buildShape([...HUMAN_PARTS, APRON]);
   const face = gridFace(body.length / 3, APRON.min[0], APRON.max[0], APRON.min[1], APRON.max[1], APRON.max[2]);
   const shape = Float32Array.from([...body, ...face.positions]);
   const area = (p: Float32Array, a: number, b: number, c: number) => {
      const u = new Vector3(p[b * 3] - p[a * 3], p[b * 3 + 1] - p[a * 3 + 1], p[b * 3 + 2] - p[a * 3 + 2]);
      const v = new Vector3(p[c * 3] - p[a * 3], p[c * 3 + 1] - p[a * 3 + 1], p[c * 3 + 2] - p[a * 3 + 2]);
      return u.cross(v).length() / 2;
   };
   /** The largest area stretch of an apron front triangle in a pose. */
   const worstStretch = (rig: HumanoidRig, pose: HumanoidPose) => {
      applyHumanoidPose(rig, pose, false);
      const world = skinnedWorld(rig);
      let worst = 0;
      for (let t = 0; t < face.triangles.length; t += 3) {
         const a = face.triangles[t];
         const b = face.triangles[t + 1];
         const c = face.triangles[t + 2];
         worst = Math.max(worst, area(world, a, b, c) / area(shape, a, b, c));
      }
      return worst;
   };

   it("hangs between the legs at a walk: no apron triangle stretches 1.5x (a hard L/R split stretches it into a sheet)", () => {
      const rig = rigOf(shape);
      expect(rig.landmarks.hemY).toBeLessThan(0.52);
      const walk = walkPose(Math.PI / 2, 0.5, createPose());
      expect(worstStretch(rig, walk)).toBeLessThan(1.5);
      expect(worstStretch(rig, walkPose((3 * Math.PI) / 2, 0.5, createPose()))).toBeLessThan(1.5);
      // the same apron weighted as if nothing bridged the legs: the webbing the skirt weights prevent
      const split = rigOf(shape, { hemY: rig.landmarks.crotchY });
      expect(worstStretch(split, walk)).toBeGreaterThan(2.5);
   });
});
