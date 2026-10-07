// Ground contact and stride for the humanoid auto-rig. Owned by Claude. Pure: no three.js, no React,
// no allocation.
//
//    const bob = bodyLift(pose, landmarks) * asset.scale;          // the body's height over the floor
//    gait.phase += (v * dt) / (walkStride(amount, landmarks) * asset.scale) * 2π;
//    // the same with a shortest stride and a cadence cap (a fast character's legs):
//    gait.phase = wrapPhase(gait.phase + gaitPhaseStep(amount, landmarks, asset.scale, v, dt, 4));
//
// The rig has no feet IK: walkPose keeps the soles flat (levelFoot) and the body is lifted by
// whatever puts the lower sole on the floor (groundLift: the legs' forward kinematics with the
// character's own landmarks). <HumanoidModel> applies bodyLift to the hips by default; a game that
// bobs the model's group itself (applyLift={false}) adds bodyLift x scale to that group.
import { BONE, BONE_COUNT, humanoidJoints, type HumanoidLandmarks } from "./humanoid";
import { createPose, walkPose, type HumanoidPose } from "./poses";
import { mulQuat, rotateVec } from "./quat";

const JOINTS = new Float64Array(BONE_COUNT * 3);
let jointsOf: HumanoidLandmarks | null = null;
const CHAIN = new Float64Array(12);
const V = new Float64Array(3);
/** [ankle x, y, z, the lower sole point's y] of the last footOf call */
const FOOT = new Float64Array(4);

function joints(l: HumanoidLandmarks): Float64Array {
   if (jointsOf !== l) {
      humanoidJoints(l, JOINTS);
      jointsOf = l;
   }
   return JOINTS;
}

/** One leg's forward kinematics in `pose` (body unlifted, GLB units) into FOOT. `side` 1 = L. */
function footOf(pose: HumanoidPose, l: HumanoidLandmarks, side: number): Float64Array {
   const j = joints(l);
   const q = pose.q;
   const hips = BONE.hips * 4;
   const thigh = side > 0 ? BONE.upperLegL : BONE.upperLegR;
   const shin = side > 0 ? BONE.lowerLegL : BONE.lowerLegR;
   const foot = side > 0 ? BONE.footL : BONE.footR;
   const p = BONE.hips * 3;
   const h = thigh * 3;
   const k = shin * 3;
   const a = foot * 3;
   // the hip joint turns with the hips about their pivot
   rotateVec(q, hips, j[h] - j[p], j[h + 1] - j[p + 1], j[h + 2] - j[p + 2], V, 0);
   let x = j[p] + V[0];
   let y = j[p + 1] + V[1];
   let z = j[p + 2] + V[2];
   // knee, ankle: each segment turns with everything above it
   mulQuat(q, hips, q, thigh * 4, CHAIN, 0);
   rotateVec(CHAIN, 0, j[k] - j[h], j[k + 1] - j[h + 1], j[k + 2] - j[h + 2], V, 0);
   x += V[0];
   y += V[1];
   z += V[2];
   mulQuat(CHAIN, 0, q, shin * 4, CHAIN, 4);
   rotateVec(CHAIN, 4, j[a] - j[k], j[a + 1] - j[k + 1], j[a + 2] - j[k + 2], V, 0);
   x += V[0];
   y += V[1];
   z += V[2];
   // the sole's heel and toe (on y = 0 in the T-pose, on the leg's centre line)
   mulQuat(CHAIN, 4, q, foot * 4, CHAIN, 8);
   rotateVec(CHAIN, 8, 0, -j[a + 1], l.heelZ - j[a + 2], V, 0);
   const heel = y + V[1];
   rotateVec(CHAIN, 8, 0, -j[a + 1], l.toeZ - j[a + 2], V, 0);
   const toe = y + V[1];
   FOOT[0] = x;
   FOOT[1] = y;
   FOOT[2] = z;
   FOOT[3] = Math.min(heel, toe);
   return FOOT;
}

/**
 * How far (GLB units) to raise the body so the lower of the four sole points (heel and toe of each
 * foot) is on the floor (y = 0) in `pose`. 0 for straight legs; negative when bent or swung legs
 * would leave both feet in the air (a walk's long stride lowers the body).
 */
export function groundLift(pose: HumanoidPose, l: HumanoidLandmarks): number {
   const left = footOf(pose, l, 1)[3];
   const right = footOf(pose, l, -1)[3];
   return -Math.min(left, right);
}

/**
 * The body's height offset (GLB units) for `pose`: its ground contact (groundLift x pose.ground)
 * plus its own lift (pose.lift x the hip height: a run's flight). What <HumanoidModel> adds to the
 * hips (applyLift); a game that bobs the model's group itself adds bodyLift x scale to it.
 */
export function bodyLift(pose: HumanoidPose, l: HumanoidLandmarks): number {
   return pose.ground * groundLift(pose, l) + pose.lift * l.hipY;
}

/** Height of a foot's sole over the floor in `pose` once the body is lifted by bodyLift (GLB units). */
export function soleHeight(pose: HumanoidPose, l: HumanoidLandmarks, side: 1 | -1): number {
   const lift = bodyLift(pose, l);
   return footOf(pose, l, side)[3] + lift;
}

/**
 * Where a foot is in `pose`, the body unlifted (GLB units, the character's own frame): into `out`
 * [ankle x, ankle y, ankle z, the lower sole point's y]. For tests and games that plant a foot
 * (add bodyLift to the y values for the drawn height). Allocation-free with a reused `out`.
 */
export function footPoint(pose: HumanoidPose, l: HumanoidLandmarks, side: 1 | -1, out: Float64Array = new Float64Array(4)): Float64Array {
   out.set(footOf(pose, l, side));
   return out;
}

// ---------- the stride ----------

const SCRATCH = createPose();

/**
 * The stride length (GLB units, two steps = one cycle of walkPose's phase) at which the planted
 * foot does not slide: a foot is planted from its leg's forward reach (phase π/2 for the left) to
 * its backward reach (3π/2), and goes back under the body by the distance between the two, so the
 * body must walk twice that per stride. Multiply by the asset's scale for metres and advance the
 * phase with `distance / stride * 2π`. 0 at amount 0 (standing): clamp it (a minimum stride)
 * before dividing. Pure and allocation-free (two forward-kinematics passes of walkPose).
 */
export function walkStride(amount: number, l: HumanoidLandmarks): number {
   walkPose(Math.PI / 2, amount, SCRATCH);
   const front = footOf(SCRATCH, l, 1)[2];
   walkPose((3 * Math.PI) / 2, amount, SCRATCH);
   const back = footOf(SCRATCH, l, 1)[2];
   return 2 * (front - back);
}

/** gaitPhaseStep's shortest stride (m) by default: standing still, walkStride is 0. */
export const MIN_GAIT_STRIDE = 0.1;

/**
 * How far (rad) walkPose's phase advances this frame for a character drawn at `scale` moving at
 * `speed` (m/s) for `dt` (s), with walkPose's `amount`: the distance over the stride x 2π. The stride
 * is the walk's own (walkStride x scale, so the planted foot stays put), but never shorter than
 * `minStride` (m) and never so short that the legs beat more than `maxCadence` strides a second
 * (faster, the stride stretches and the feet slide a little). 0 at speed 0. Pure and allocation-free.
 *
 *    gait.phase = wrapPhase(gait.phase + gaitPhaseStep(gait.amount, LANDMARKS, scale, v, dt, 4));
 */
export function gaitPhaseStep(
   amount: number,
   l: HumanoidLandmarks,
   scale: number,
   speed: number,
   dt: number,
   maxCadence = Infinity,
   minStride = MIN_GAIT_STRIDE
): number {
   if (!(speed > 0) || !(dt > 0)) return 0;
   const stride = Math.max(minStride, walkStride(amount, l) * scale, speed / maxCadence);
   return ((speed * dt) / stride) * Math.PI * 2;
}
