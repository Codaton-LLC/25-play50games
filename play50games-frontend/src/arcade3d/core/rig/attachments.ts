// Attachment anchors of an auto-rigged character: where a hat, a backpack or a held tool sits, on
// which bone. Owned by Claude. Pure (no three.js, no React): skinning.ts measures the anchors once
// per template, <HumanoidModel attach> mounts the children on them.
//
//    <HumanoidModel asset={RUNNER} pose={pose}
//       attach={{ head: <ExplorerHat />, chest: <VacuumPack />, handR: <Wrench /> }} />
//
// - head: the top of the head (the highest vertex's height, centred on x = 0 and on the crown's
//   depth), on the head bone. A hat's origin = where it sits on the crown.
// - chest: the back halfway between the chest joint and the shoulders, at the back surface (the
//   lowest z of the spine strip at that height; the character faces +z), on the chest bone. A
//   backpack's front = +z.
// - handL / handR: the centre of the hand (the vertices beyond the wrist), on the lower arm bone
//   (the hand rides the forearm).
// Children are in the bone's T-pose frame, in the HumanoidModel's units (the asset's scale is
// undone on the anchor): +y up, +z forward as the character stands in its T-pose. For a hand, the
// arm runs along +x (handL) / -x (handR) towards the fingers, so a tool held "up" in the T-pose
// points forward once the arm hangs and swings.
import { BONE, BONE_COUNT, humanoidJoints, type HumanoidLandmarks } from "./humanoid";

export const ANCHOR_NAMES = ["head", "chest", "handL", "handR"] as const;
export type AnchorName = (typeof ANCHOR_NAMES)[number];

export interface HumanoidAnchor {
   /** the bone it rides (HUMANOID_BONES index) */
   bone: number;
   /** the anchor in the bind (T-pose) model space, GLB units */
   x: number;
   y: number;
   z: number;
}

export type HumanoidAnchors = Record<AnchorName, HumanoidAnchor>;

/** The crown: vertices within this fraction of the skull's height (headY .. top) below the top. */
const CROWN = 0.25;
/** A hand vertex lies within this many arm radii of the arm's height. */
const HAND_BAND = 2.5;
/** The back: the strip of the trunk within this fraction of the clavicle joints' |x| (the spine line). */
const BACK_STRIP = 0.3;
/** ...and within this fraction of the chest-to-shoulder height of the anchor's height. */
const BACK_SLAB = 0.2;

/**
 * Measures the anchors from the character's vertex cloud (xyz triples in GLB root space, like
 * estimateHumanoidLandmarks) and its landmarks. Deterministic, no allocation beyond the result.
 */
export function measureAnchors(cloud: ArrayLike<number>, l: HumanoidLandmarks): HumanoidAnchors {
   const n = Math.floor(cloud.length / 3);
   let top = -Infinity;
   for (let i = 0; i < n; i++) {
      const y = cloud[i * 3 + 1];
      // the arms are below the head; only the trunk column counts for the top
      if (Math.abs(cloud[i * 3]) <= l.shoulderX && y > top) top = y;
   }
   if (!Number.isFinite(top)) top = l.headY;
   const crownFrom = top - CROWN * Math.max(0, top - l.headY);
   let crownMinZ = Infinity;
   let crownMaxZ = -Infinity;
   let backZ = Infinity;
   // the back at the anchor's own height (a hood or a collar further up bulges out behind it)
   const backY = (l.chestY + l.shoulderY) / 2;
   const backHalf = BACK_SLAB * (l.shoulderY - l.chestY);
   const hands = [
      { x: 0, y: 0, z: 0, count: 0 },
      { x: 0, y: 0, z: 0, count: 0 },
   ];
   for (let i = 0; i < n; i++) {
      const x = cloud[i * 3];
      const y = cloud[i * 3 + 1];
      const z = cloud[i * 3 + 2];
      const ax = Math.abs(x);
      if (ax <= l.shoulderX && y >= crownFrom) {
         if (z < crownMinZ) crownMinZ = z;
         if (z > crownMaxZ) crownMaxZ = z;
      }
      if (ax <= BACK_STRIP * l.clavicleX && Math.abs(y - backY) <= backHalf && z < backZ) backZ = z;
      if (ax > l.wristX && Math.abs(y - l.shoulderY) <= HAND_BAND * l.armRadius) {
         const h = hands[x > 0 ? 0 : 1];
         h.x += x;
         h.y += y;
         h.z += z;
         h.count += 1;
      }
   }
   const crownZ = Number.isFinite(crownMinZ) ? (crownMinZ + crownMaxZ) / 2 : l.spineZ;
   const hand = (side: 0 | 1): HumanoidAnchor => {
      const h = hands[side];
      const sign = side === 0 ? 1 : -1;
      return h.count > 0
         ? { bone: side === 0 ? BONE.lowerArmL : BONE.lowerArmR, x: h.x / h.count, y: h.y / h.count, z: h.z / h.count }
         : { bone: side === 0 ? BONE.lowerArmL : BONE.lowerArmR, x: sign * l.wristX, y: l.shoulderY, z: l.shoulderZ };
   };
   return {
      head: { bone: BONE.head, x: 0, y: top, z: crownZ },
      chest: { bone: BONE.chest, x: 0, y: backY, z: Number.isFinite(backZ) ? backZ : l.spineZ },
      handL: hand(0),
      handR: hand(1),
   };
}

/**
 * The anchor relative to its bone's joint (bind pose, GLB units): the local position of an anchor
 * object added to the bone (bones start unrotated, so bind offsets are local offsets).
 */
export function anchorOffset(
   anchor: HumanoidAnchor,
   landmarks: HumanoidLandmarks,
   out: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 },
   joints: Float64Array = humanoidJoints(landmarks, new Float64Array(BONE_COUNT * 3))
): { x: number; y: number; z: number } {
   const b = anchor.bone * 3;
   out.x = anchor.x - joints[b];
   out.y = anchor.y - joints[b + 1];
   out.z = anchor.z - joints[b + 2];
   return out;
}
