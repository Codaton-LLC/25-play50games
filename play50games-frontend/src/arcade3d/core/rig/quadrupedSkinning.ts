// The quadruped auto-rig in three.js: a static animal GLB scene -> a SkinnedMesh with a code-built
// skeleton (quadruped.ts). Owned by Claude. No React, so tests run it in node (no WebGL).
//
//    const template = quadrupedTemplate(gltf.scene, asset.quadruped.landmarks); // once per GLB (cached)
//    const rig = cloneQuadruped(template);                                       // one per drawn animal
//    applyQuadrupedPose(rig, pose);                                              // every frame, no allocation
//
// Same contract as the humanoid rig (skinning.ts): every mesh becomes a SkinnedMesh sharing the
// loaded attributes and materials (only skinIndex / skinWeight are new), the bind pose draws
// exactly like <Model>, templates are cached per loaded scene, skinned meshes are not frustum culled.
import { Bone, BufferGeometry, Euler, Float32BufferAttribute, Group, Matrix4, Object3D, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3, type Mesh } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { QBONE, QUADRUPED_BONES, QUAD_BONE_COUNT, QUAD_BONE_PARENT, computeQuadrupedWeights, quadrupedJoints, type QuadrupedLandmarks } from "./quadruped";
import { createQuadrupedPose, quadrupedStand, type QuadrupedPose } from "./quadrupedPoses";

export interface QuadrupedTemplate {
   root: Object3D;
   landmarks: QuadrupedLandmarks;
}

export interface QuadrupedRig {
   root: Object3D;
   /** QUADRUPED_BONES order */
   bones: Bone[];
   landmarks: QuadrupedLandmarks;
   /** the hips bone's bind height; pose.lift is added to it */
   hipsY: number;
}

const BONE_PREFIX = "quadruped:";
const V = new Vector3();
/** a stash bone this small swallows the stray parts it carries */
const STASH_SCALE = 1e-4;

/** Builds the skinned version of a static animal GLB scene; null when it has no plain mesh (or a real skeleton). */
export function buildQuadrupedTemplate(source: Object3D, landmarks: QuadrupedLandmarks): QuadrupedTemplate | null {
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

   const root = new Object3D();
   root.name = source.name;
   const joints = quadrupedJoints(landmarks);
   const bones = QUADRUPED_BONES.map((name) => {
      const bone = new Bone();
      bone.name = BONE_PREFIX + name;
      return bone;
   });
   for (let b = 0; b < QUAD_BONE_COUNT; b++) {
      const parent = QUAD_BONE_PARENT[b];
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
      for (const name of Object.keys(from.attributes)) geometry.setAttribute(name, from.attributes[name]);
      geometry.setIndex(from.index);
      for (const group of from.groups) geometry.addGroup(group.start, group.count, group.materialIndex);
      geometry.setDrawRange(from.drawRange.start, from.drawRange.count);
      const { skinIndex, skinWeight } = computeQuadrupedWeights(positions, landmarks);
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
   root.updateMatrixWorld(true);
   const skeleton = new Skeleton(bones);
   for (const skin of skins) skin.bind(skeleton, skin.matrixWorld);
   return { root, landmarks };
}

const templates = new WeakMap<Object3D, Map<QuadrupedLandmarks, QuadrupedTemplate | null>>();

/** buildQuadrupedTemplate, once per loaded scene and landmarks object. */
export function quadrupedTemplate(source: Object3D, landmarks: QuadrupedLandmarks): QuadrupedTemplate | null {
   let byLm = templates.get(source);
   if (!byLm) {
      byLm = new Map();
      templates.set(source, byLm);
   }
   if (!byLm.has(landmarks)) byLm.set(landmarks, buildQuadrupedTemplate(source, landmarks));
   return byLm.get(landmarks) ?? null;
}

/** A private copy of the template (its own bones, the shared geometry), standing. */
export function cloneQuadruped(template: QuadrupedTemplate): QuadrupedRig {
   const root = cloneSkinned(template.root);
   const bones: Bone[] = new Array(QUAD_BONE_COUNT);
   root.traverse((object) => {
      if (!(object as Bone).isBone || !object.name.startsWith(BONE_PREFIX)) return;
      const index = QUADRUPED_BONES.indexOf(object.name.slice(BONE_PREFIX.length) as (typeof QUADRUPED_BONES)[number]);
      if (index >= 0) bones[index] = object as Bone;
   });
   bones[QBONE.stash].scale.setScalar(STASH_SCALE);
   const rig: QuadrupedRig = { root, bones, landmarks: template.landmarks, hipsY: bones[QBONE.hips].position.y };
   applyQuadrupedPose(rig, quadrupedStand(template.landmarks, createQuadrupedPose()));
   return rig;
}

/** Frees the clone's bone textures (geometry and materials belong to the template and the loader cache). */
export function disposeQuadruped(rig: QuadrupedRig): void {
   rig.root.traverse((object) => {
      const skin = object as SkinnedMesh;
      if (skin.isSkinnedMesh) skin.skeleton.dispose();
   });
}

const E = new Euler();

/** Writes a pose into the rig's bones (no allocation). */
export function applyQuadrupedPose(rig: QuadrupedRig, pose: QuadrupedPose): void {
   const r = pose.rot;
   for (let b = 0; b < QUAD_BONE_COUNT; b++) {
      if (b === QBONE.stash) continue;
      rig.bones[b].quaternion.setFromEuler(E.set(r[b * 3], r[b * 3 + 1], r[b * 3 + 2], "XYZ"));
   }
   rig.bones[QBONE.hips].position.y = rig.hipsY + pose.lift;
}

/**
 * A new empty group at the mouth, on the head bone (add it with rig.bones[QBONE.head].add(group)).
 * `scale` is the asset's scale per axis; the group undoes it so its children are in the model
 * group's units.
 */
export function createMouthGroup(rig: QuadrupedRig, scale: readonly [number, number, number] = [1, 1, 1]): Group {
   const lm = rig.landmarks;
   const group = new Group();
   group.name = "anchor:mouth";
   group.position.set(lm.mouth[0], lm.mouth[1] - lm.head[1], lm.mouth[2] - lm.head[0]);
   group.scale.set(1 / (scale[0] || 1), 1 / (scale[1] || 1), 1 / (scale[2] || 1));
   return group;
}
