// Where the explorer's shovel sits on the runner's anchors (core/rig attachments): in the right hand
// while digging (handR), on the back while walking (chest). Pure maths on three's Matrix4 /
// Quaternion, built once at module load; the Scene only reads the results. Checked on the real
// runner and shovel meshes in shovel.test.ts.
//
// Frames: a hand anchor is in the lower arm's T-pose frame (the right arm runs along -x to the
// fingertips, +y up, +z forward as it stands in the T-pose); the dig pose turns it so that
//    hand +x = up, hand +y = forward, hand +z = the character's left
// (measured in shovel.test.ts). The chest anchor is on the back surface: +x the character's left,
// +y up, +z forward, so -z is out behind the explorer. The shovel's own frame (assets.ts) has its
// origin at the blade's edge, +y up the shaft to the grip, x across the blade, z the dish.
import { Matrix4, Quaternion, Vector3 } from "three";
import { SHOVEL_GLB, SHOVEL_GRASP, SHOVEL_LENGTH } from "./assets";

/** A shovel placement: the position and turn of the shovel's origin in its anchor's frame. */
export interface ShovelPlacement {
   position: Vector3;
   quaternion: Quaternion;
   /** the shovel's shaft direction, blade towards grip, in the anchor's frame */
   shaft: Vector3;
}

/** The turn that takes the shovel's x / y / z to these three anchor-frame axes. */
function basis(x: Vector3, y: Vector3, z: Vector3): Quaternion {
   return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
}

/** The shaft's lean from the vertical in the dig, the grip back towards the digger, the blade ahead. */
export const DIG_TILT = (36 * Math.PI) / 180;

function digHold(): ShovelPlacement {
   // shaft (blade -> grip) in hand axes: up (hand x) and back (-hand y), so the blade is down and ahead
   const shaft = new Vector3(Math.cos(DIG_TILT), -Math.sin(DIG_TILT), 0);
   // the width runs across the body (hand z), the dish faces back and down, to the digger
   const across = new Vector3(0, 0, -1);
   const dish = new Vector3().crossVectors(across, shaft);
   const quaternion = basis(across, shaft, dish);
   // the hand's centre lies on the shaft SHOVEL_GRASP from the blade's edge
   const position = new Vector3(0, SHOVEL_GRASP, 0).applyQuaternion(quaternion).negate();
   return { position, quaternion, shaft };
}

/** The back carry: the grip low on the character's left, the blade up over the right shoulder. */
export const BACK_LEAN = (30 * Math.PI) / 180;
/** The gap between the back anchor and the shovel's dish (m): the shoulder blades bulge 9 cm behind it. */
export const BACK_GAP = 0.1;
/** The shovel's middle sits this far below the back anchor (m), so the blade stays under the hat. */
export const BACK_DROP = 0.06;

function backHold(): ShovelPlacement {
   const shaft = new Vector3(Math.sin(BACK_LEAN), -Math.cos(BACK_LEAN), 0);
   const dish = new Vector3(0, 0, -1);
   const across = new Vector3().crossVectors(shaft, dish);
   const quaternion = basis(across, shaft, dish);
   // the middle of the shovel on the anchor, its thickest part (the dish) clear of the back
   const half = (SHOVEL_GLB.depth / 2) * (SHOVEL_LENGTH / SHOVEL_GLB.height);
   const position = new Vector3(0, SHOVEL_LENGTH / 2, 0).applyQuaternion(quaternion).negate().add(new Vector3(0, -BACK_DROP, -(half + BACK_GAP)));
   return { position, quaternion, shaft };
}

export const DIG_HOLD = digHold();
export const BACK_HOLD = backHold();

/**
 * The scoop tilts the hand about the body's side-to-side axis (hand z) by about +-17 degrees with
 * k = sin(t x DIG_RATE x 2 pi) (measured in shovel.test.ts: +17 at k = 1): the shovel turns back by
 * the same, so its lean stays and only the hand's travel moves the blade.
 */
export const WRIST = 0.3;

/** How far the shovel slides along its shaft (m): `scoop` either side of the stroke, `bite` over the dig. */
export const THRUST = { scoop: 0.1, bite: 0.1 } as const;

/**
 * The slide of the shovel along its shaft, towards the blade (m): the scoop's in / out (`k` = the
 * arms' sin(t x DIG_RATE x 2 pi): the hands go back at +1 and forward at -1; the blade is pulled
 * out of the sand at +1 and driven in at -1), and the bite deepening as the dig progresses
 * (`progress` 0..1), all faded by `dig` (0..1).
 */
export function thrustOf(k: number, progress: number, dig: number): number {
   return dig * (-THRUST.scoop * k + THRUST.bite * (Math.min(1, Math.max(0, progress)) - 0.5));
}

const HAND_Z = new Vector3(0, 0, 1);
const COUNTER = new Quaternion();
const SHAFT = new Vector3();

/**
 * The shovel's placement in the hand's frame for this frame of the dig, written into `position` and
 * `quaternion` (no allocation): DIG_HOLD turned back against the wrist's scoop tilt, then slid
 * along its shaft by thrustOf.
 */
export function digPlacement(k: number, progress: number, dig: number, position: Vector3, quaternion: Quaternion): void {
   COUNTER.setFromAxisAngle(HAND_Z, -WRIST * k * dig);
   quaternion.copy(DIG_HOLD.quaternion).premultiply(COUNTER);
   position.copy(DIG_HOLD.position).applyQuaternion(COUNTER);
   SHAFT.copy(DIG_HOLD.shaft).applyQuaternion(COUNTER);
   position.addScaledVector(SHAFT, -thrustOf(k, progress, dig));
}
