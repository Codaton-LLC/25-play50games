// The striker's and the keeper's poses on the core auto-rig (core/rig): the kick, the keeper's
// ready stance and its dive. Pure, no three.js, no allocation (each builder writes into `out`),
// so Scene.tsx rebuilds them every frame; poses.test.ts checks their shapes. Conventions are the
// core's: the character faces +z, L = its left = +x; the striker is turned round by its asset
// (rotationY π), so its own right (-x) is the world's +x, where the ball sits.
import {
   BONE,
   POSE_MASK,
   aimArm,
   armsDownPose,
   blendPoses,
   carryPose,
   createPose,
   idlePose,
   jumpPose,
   levelFoot,
   reachPose,
   setBoneEuler,
   turnBone,
   type HumanoidLandmarks,
   type HumanoidPose,
} from "@/arcade3d/core/rig";
import { KEEPER_LANDMARKS } from "./assets";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (v: number) => {
   const t = clamp01(v);
   return t * t * (3 - 2 * t);
};

const upperArm = (side: number) => (side > 0 ? BONE.upperArmL : BONE.upperArmR);
const lowerArm = (side: number) => (side > 0 ? BONE.lowerArmL : BONE.lowerArmR);
const upperLeg = (side: number) => (side > 0 ? BONE.upperLegL : BONE.upperLegR);
const lowerLeg = (side: number) => (side > 0 ? BONE.lowerLegL : BONE.lowerLegR);

/** A hanging arm swung `forward` (rad, +z) and `outward`; the elbow bent by `bend` (core conventions). */
function swingArm(out: HumanoidPose, side: number, forward: number, outward: number, bend: number): void {
   setBoneEuler(out.q, upperArm(side), -forward, 0, side * outward);
   setBoneEuler(out.q, lowerArm(side), 0, -side * bend, 0);
}

/** A leg swung `forward` (rad, +z) and `outward`, its knee folded by `bend`. */
function swingLeg(out: HumanoidPose, side: number, forward: number, outward: number, bend: number): void {
   setBoneEuler(out.q, upperLeg(side), -forward, 0, side * outward);
   setBoneEuler(out.q, lowerLeg(side), bend, 0, 0);
}

/** The kicking leg: the striker's own right (-x). The ball sits at its right foot (layout.ts; poses.test.ts checks it). */
export const KICK_SIDE = -1;
/** kickPose's contact with the ball: the flight starts here (Scene.tsx; poses.test.ts puts the boot at the ball). */
export const KICK_CONTACT = 0.55;

/**
 * The kick, from the backswing (`u` 0) through contact (about 0.55) to the follow-through (1):
 * the kicking leg swings from behind with the knee folded to straight out in front, the planted
 * leg a little bent with its sole flat, the opposite arm forward for balance, the body leaning
 * back off the ball and twisted into the kick. The planted foot keeps the ground (`ground` 1:
 * the body's height comes from it).
 */
export function kickPose(u: number, out: HumanoidPose): HumanoidPose {
   armsDownPose(out);
   const s = smooth(u);
   const side = KICK_SIDE;
   // 0.55 rad back, knee folded -> 1.05 rad forward, knee nearly straight (straightest at contact);
   // the knee stays folded while the leg passes under the body and the foot is kept part level
   // with the toes a little down (the laces meet the ball), so the swinging sole never dips under
   // the planted one (the body's height comes from the lower sole: poses.test.ts)
   swingLeg(out, side, lerp(-0.55, 1.05, s), 0.08, 1.25 * (1 - s) * (1 - s) + 0.15 * s + 1.3 * Math.sin(Math.PI * s) * (1 - s));
   setBoneEuler(out.q, side > 0 ? BONE.footL : BONE.footR, 0.4, 0, 0);
   levelFoot(out, side, 0.7);
   swingLeg(out, -side, -0.12, 0.05, 0.3);
   levelFoot(out, -side);
   // the opposite arm swings forward and out, the kicking side's arm back
   swingArm(out, -side, 0.9 * s, 0.35, 0.6);
   swingArm(out, side, -0.5 * s, 0.4, 0.3);
   // leaning back off the ball, twisted into the kick, the eyes on the ball
   setBoneEuler(out.q, BONE.spine, -0.1 * s, -side * 0.2 * s, side * 0.08 * s);
   setBoneEuler(out.q, BONE.chest, 0, -side * 0.1 * s, 0);
   setBoneEuler(out.q, BONE.head, 0.05 * s, side * 0.15 * s, 0);
   return out;
}

/**
 * Turns a leg (the hips unturned) so its ankle is at (tx, ty, tz) from its hip joint (GLB units, the
 * character's frame; the joints are in line as core/rig humanoidJoints places them): two-bone IK,
 * the knee's bend from the reach (the thigh `lt` and the shin `ls` long), then the thigh's outward
 * and forward swings to point the leg there. Allocation-free.
 */
function plantLeg(out: HumanoidPose, side: number, tx: number, ty: number, tz: number, lt: number, ls: number): void {
   const cb = Math.max(-1, Math.min(1, (tx * tx + ty * ty + tz * tz - lt * lt - ls * ls) / (2 * lt * ls)));
   const bend = Math.acos(cb);
   // the bent leg in the thigh's frame is (0, -p, -q); outward first, then forward
   const p = lt + ls * cb;
   const q = ls * Math.sin(bend);
   const outward = Math.asin(Math.max(-1, Math.min(1, (side * tx) / p)));
   const m = p * Math.cos(outward);
   // (ty, tz) is (-m, -q) turned by -forward about x
   const forward = -Math.atan2(q * ty - m * tz, -m * ty - q * tz);
   swingLeg(out, side, forward, outward, bend);
}

/** The ready stance's legs (rad): the thighs forward and out, the knees bent. */
const READY_LEG = { forward: 0.4, outward: 0.12, bend: 0.75 } as const;

/**
 * The keeper's ready stance: knees bent, leaning forward, both gloves out in front at hip height
 * with the palms forward, the head up, a breath from the idle (`t` in seconds). Standing
 * (`ground` 1): the crouch lowers the body onto its flat soles.
 *
 * Its weight shift (layout.ts keeperSway): the game moves the keeper's group `shift` (GLB units:
 * metres / the asset's scale) to its left (+x) and the legs reach back to where the feet stood, so
 * the soles stay planted on the grass; `dip` (GLB units) bends both knees further, lowering the body
 * over the same feet (its bounce). Both 0 = the stance as designed. `l` = the keeper's landmarks
 * (the legs' lengths).
 */
export function keeperReadyPose(t: number, out: HumanoidPose, shift = 0, dip = 0, l: HumanoidLandmarks = KEEPER_LANDMARKS): HumanoidPose {
   idlePose(t, out);
   // the stance's ankle from its hip joint: outward (ox), down (oy), forward (oz)
   const lt = l.hipY - l.kneeY;
   const ls = l.kneeY - l.ankleY;
   const p0 = lt + ls * Math.cos(READY_LEG.bend);
   const q0 = ls * Math.sin(READY_LEG.bend);
   const ox = p0 * Math.sin(READY_LEG.outward);
   const m0 = p0 * Math.cos(READY_LEG.outward);
   const oy = -m0 * Math.cos(READY_LEG.forward) - q0 * Math.sin(READY_LEG.forward);
   const oz = m0 * Math.sin(READY_LEG.forward) - q0 * Math.cos(READY_LEG.forward);
   for (let side = 1; side >= -1; side -= 2) {
      plantLeg(out, side, side * ox - shift, oy + dip, oz, lt, ls);
      levelFoot(out, side);
      // upper arm down, out and forward; forearm forward and a little up, the glove's palm forward
      aimArm(out, side as 1 | -1, 0.6, -0.65, 0.45, 0.25, 0.3, 0.92);
   }
   turnBone(out, BONE.spine, 0.25, 0, 0);
   turnBone(out, BONE.head, -0.22, 0, 0);
   return out;
}

const SCRATCH = createPose();

/**
 * The dive towards a zone, in the air (`ground` 0; the game's group carries the leap and the roll
 * about the hips): `side` is the zone's column in the keeper's own frame (+1 = its left = the
 * world's +x, 0 = the middle), `row` 1 high / 0 low. To a side, the near arm reaches out and up
 * (`reachPose`), the far arm goes up past the head, the legs trail bent (a jump's tuck) and the
 * spine bends towards the ball. In the middle, both arms go up (high) or forward in a crouch (low).
 */
export function keeperDivePose(side: -1 | 0 | 1, row: 0 | 1, out: HumanoidPose): HumanoidPose {
   if (side === 0) {
      carryPose(row === 1 ? 0.85 : 0, out);
      if (row === 1) {
         blendPoses(out, jumpPose(0.3, SCRATCH), 1, out, POSE_MASK.legs);
      } else {
         // a crouch onto the low ball
         for (let s = 1; s >= -1; s -= 2) swingLeg(out, s, 0.9, 0.15, 1.4);
         turnBone(out, BONE.spine, 0.35, 0, 0);
      }
      out.ground = 0;
      return out;
   }
   reachPose(side, row === 1 ? 1 : 0.35, out);
   // the far arm up past the head, a little towards the ball
   aimArm(out, -side as 1 | -1, -0.25, 0.95, 0.15, -0.3, 0.92, 0.2);
   blendPoses(out, jumpPose(0.35, SCRATCH), 1, out, POSE_MASK.legs);
   // the trailing leg straighter and apart
   swingLeg(out, -side, 0.1, 0.3, 0.35);
   // the body bends towards the ball (tilt > 0 tips the top to its right = -x)
   turnBone(out, BONE.spine, 0.1, 0, -side * 0.25);
   turnBone(out, BONE.head, -0.1, side * 0.2, 0);
   out.ground = 0;
   return out;
}
