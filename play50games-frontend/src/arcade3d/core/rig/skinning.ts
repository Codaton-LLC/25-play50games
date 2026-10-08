// The auto-rig in three.js: a static T-pose GLB scene -> a SkinnedMesh with a code-built skeleton.
// Owned by Claude. No React, so tests run it in node (no WebGL). <HumanoidModel> and <Model> use it.
//
//    const template = humanoidTemplate(gltf.scene, asset.humanoid);  // once per GLB (cached)
//    const rig = cloneHumanoid(template);                            // one per drawn character
//    applyHumanoidPose(rig, pose);                                   // every frame, no allocation
//
// - Every mesh of the GLB becomes a SkinnedMesh that shares the loaded geometry's attributes (and
//   materials); only skinIndex / skinWeight are new. The mesh keeps its node transform (e.g. the
//   robot's y = 0.86) relative to the GLB root, so the bind pose draws exactly like <Model>.
// - Positions are read with fromBufferAttribute, so quantized / normalized (KHR_mesh_quantization)
//   and interleaved attributes work.
// - Templates are cached per loaded scene (WeakMap): a GLB that GameShell drops from the loader
//   cache takes its template with it.
// - Skinned meshes are not frustum culled: the bounds of a moving skeleton change every frame.
import { Bone, BufferGeometry, Group, Matrix4, Object3D, Quaternion, Skeleton, SkinnedMesh, Uint16BufferAttribute, Float32BufferAttribute, Vector3, type Mesh } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { ModelAsset } from "../types";
import { BONE, BONE_COUNT, BONE_PARENT, HUMANOID_BONES, computeSkinWeights, estimateHumanoidLandmarks, humanoidJoints, type HumanoidLandmarks } from "./humanoid";
import { bodyLift } from "./gait";
import { armsDownPose, createPose, resolvePose, type HumanoidPose } from "./poses";
import { anchorOffset, measureAnchors, type AnchorName, type HumanoidAnchors } from "./attachments";

export type HumanoidOptions = NonNullable<ModelAsset["humanoid"]>;

export interface HumanoidTemplate {
   /** the GLB root's replacement: skinned meshes + the skeleton, unscaled (<primitive> gets the asset transform) */
   root: Object3D;
   /** the landmarks the rig was built from (explicit fields + estimates) */
   landmarks: HumanoidLandmarks;
   /** where attachments sit (rig/attachments.ts), measured on the mesh */
   anchors: HumanoidAnchors;
}

export interface HumanoidRig {
   /** this character's own copy of the template: put it in the scene */
   root: Object3D;
   /** its bones, HUMANOID_BONES order */
   bones: Bone[];
   landmarks: HumanoidLandmarks;
   /** where attachments sit (rig/attachments.ts) */
   anchors: HumanoidAnchors;
   /** the hips bone's bind position (y), the lift is added to it */
   hipsY: number;
}

const BONE_PREFIX = "humanoid:";
const V = new Vector3();

/**
 * Builds the skinned version of a static T-pose GLB scene. Returns null when the scene has no
 * plain mesh (or already has a skinned one: a real rig is drawn with `rigged`, not auto-rigged).
 */
export function buildHumanoidTemplate(source: Object3D, options: HumanoidOptions = {}): HumanoidTemplate | null {
   source.updateMatrixWorld(true);
   const fromRoot = source.matrixWorld.clone().invert();
   const meshes: Array<{ mesh: Mesh; matrix: Matrix4; positions: Float32Array }> = [];
   let skinned = false;
   source.traverse((object) => {
      const mesh = object as Mesh & { isSkinnedMesh?: boolean };
      if (!mesh.isMesh) return;
      if (mesh.isSkinnedMesh) {
         skinned = true;
         return;
      }
      const position = mesh.geometry.getAttribute("position");
      if (!position) return;
      // the mesh relative to the GLB root (<Model> replaces the root's own transform)
      const matrix = fromRoot.clone().multiply(mesh.matrixWorld);
      const positions = new Float32Array(position.count * 3);
      for (let i = 0; i < position.count; i++) {
         V.fromBufferAttribute(position, i).applyMatrix4(matrix);
         positions[i * 3] = V.x;
         positions[i * 3 + 1] = V.y;
         positions[i * 3 + 2] = V.z;
      }
      meshes.push({ mesh, matrix, positions });
   });
   if (skinned || meshes.length === 0) return null;

   let total = 0;
   for (const m of meshes) total += m.positions.length;
   const cloud = new Float32Array(total);
   let at = 0;
   for (const m of meshes) {
      cloud.set(m.positions, at);
      at += m.positions.length;
   }
   const landmarks = estimateHumanoidLandmarks(cloud, options.landmarks);

   const root = new Object3D();
   root.name = source.name;
   const joints = humanoidJoints(landmarks);
   const bones = HUMANOID_BONES.map((name) => {
      const bone = new Bone();
      bone.name = BONE_PREFIX + name;
      return bone;
   });
   for (let b = 0; b < BONE_COUNT; b++) {
      const parent = BONE_PARENT[b];
      const px = parent < 0 ? 0 : joints[parent * 3];
      const py = parent < 0 ? 0 : joints[parent * 3 + 1];
      const pz = parent < 0 ? 0 : joints[parent * 3 + 2];
      bones[b].position.set(joints[b * 3] - px, joints[b * 3 + 1] - py, joints[b * 3 + 2] - pz);
      (parent < 0 ? root : bones[parent]).add(bones[b]);
   }

   const skins: SkinnedMesh[] = [];
   for (const { mesh, matrix, positions } of meshes) {
      const geometry = new BufferGeometry();
      const from = mesh.geometry;
      // share the loaded attributes (and their GPU buffers); only the skin attributes are new
      for (const name of Object.keys(from.attributes)) geometry.setAttribute(name, from.attributes[name]);
      geometry.setIndex(from.index);
      for (const group of from.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.setDrawRange(from.drawRange.start, from.drawRange.count);
      const { skinIndex, skinWeight } = computeSkinWeights(positions, landmarks);
      geometry.setAttribute("skinIndex", new Uint16BufferAttribute(skinIndex, 4));
      geometry.setAttribute("skinWeight", new Float32BufferAttribute(skinWeight, 4));
      geometry.name = from.name;

      const skin = new SkinnedMesh(geometry, mesh.material);
      skin.name = mesh.name;
      skin.castShadow = mesh.castShadow;
      skin.receiveShadow = mesh.receiveShadow;
      skin.renderOrder = mesh.renderOrder;
      skin.frustumCulled = false;
      matrix.decompose(skin.position, skin.quaternion, skin.scale);
      root.add(skin);
      skins.push(skin);
   }

   // bind with the template root at the identity: bone inverses and bind matrices in GLB root space
   root.updateMatrixWorld(true);
   const skeleton = new Skeleton(bones);
   for (const skin of skins) skin.bind(skeleton, skin.matrixWorld);
   return { root, landmarks, anchors: measureAnchors(cloud, landmarks) };
}

const templates = new WeakMap<Object3D, Map<string, HumanoidTemplate | null>>();

/** buildHumanoidTemplate, once per loaded scene and set of explicit landmarks. */
export function humanoidTemplate(source: Object3D, options: HumanoidOptions = {}): HumanoidTemplate | null {
   let byKey = templates.get(source);
   if (!byKey) {
      byKey = new Map();
      templates.set(source, byKey);
   }
   const key = JSON.stringify(options.landmarks ?? {});
   if (!byKey.has(key)) byKey.set(key, buildHumanoidTemplate(source, options));
   return byKey.get(key) ?? null;
}

/** A private copy of the template (SkeletonUtils: its own bones, the shared geometry), arms down. */
export function cloneHumanoid(template: HumanoidTemplate): HumanoidRig {
   const root = cloneSkinned(template.root);
   const bones: Bone[] = new Array(BONE_COUNT);
   root.traverse((object) => {
      if (!(object as Bone).isBone || !object.name.startsWith(BONE_PREFIX)) return;
      const index = HUMANOID_BONES.indexOf(object.name.slice(BONE_PREFIX.length) as (typeof HUMANOID_BONES)[number]);
      if (index >= 0) bones[index] = object as Bone;
   });
   const rig: HumanoidRig = { root, bones, landmarks: template.landmarks, anchors: template.anchors, hipsY: bones[BONE.hips].position.y };
   applyHumanoidPose(rig, armsDownPose(createPose()));
   return rig;
}

/**
 * Frees what a clone owns on the GPU: its skeletons' bone textures (the geometry and materials
 * belong to the template and the loader cache). Call it when the clone leaves the scene; drawing
 * it again later just rebuilds the textures.
 */
export function disposeHumanoid(rig: HumanoidRig): void {
   rig.root.traverse((object) => {
      const skin = object as SkinnedMesh;
      if (skin.isSkinnedMesh) skin.skeleton.dispose();
   });
}

/**
 * A new empty group placed on anchor `name`, relative to its bone (not parented: add it with
 * `rig.bones[rig.anchors[name].bone].add(group)`, e.g. in a layout effect, and remove it with
 * `group.removeFromParent()`). On the bone, its children follow it every frame through the scene
 * graph (no per-frame work). `scale` is the asset's scale per axis (assetScale); the group undoes it
 * so its children are in the model group's units (keep a character's scale uniform).
 */
export function createAnchorGroup(rig: HumanoidRig, name: AnchorName, scale: readonly [number, number, number] = [1, 1, 1]): Group {
   const anchor = rig.anchors[name];
   const group = new Group();
   group.name = `anchor:${name}`;
   const o = anchorOffset(anchor, rig.landmarks);
   group.position.set(o.x, o.y, o.z);
   group.scale.set(1 / (scale[0] || 1), 1 / (scale[1] || 1), 1 / (scale[2] || 1));
   return group;
}

const RESOLVED = new Float32Array(BONE_COUNT * 4);
const Q = new Quaternion();

/**
 * Writes a pose into the rig's bones (no allocation). `applyLift` (default true) moves the hips by
 * bodyLift(pose, landmarks) (gait.ts: the ground contact that keeps the lower sole on the floor,
 * plus the pose's own lift); pass false when the game bobs the model's group itself by bodyLift.
 */
export function applyHumanoidPose(rig: HumanoidRig, pose: HumanoidPose, applyLift = true): void {
   resolvePose(pose, rig.landmarks.armSpread, RESOLVED);
   for (let b = 0; b < BONE_COUNT; b++) {
      const o = b * 4;
      rig.bones[b].quaternion.copy(Q.set(RESOLVED[o], RESOLVED[o + 1], RESOLVED[o + 2], RESOLVED[o + 3]));
   }
   rig.bones[BONE.hips].position.y = rig.hipsY + (applyLift ? bodyLift(pose, rig.landmarks) : 0);
}
