// Ground contact and stride for the humanoid auto-rig. Owned by Claude. Pure: no three.js, no React,
// no allocation.
//
//    const bob = bodyLift(pose, landmarks) * asset.scale;          // the body's height over the floor
//    gait.phase += (v * dt) / (contactStride(amount, landmarks) * asset.scale) * 2π;
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

/** A sole this close to the floor (GLB units, after bodyLift) touches it: contactStride's contact. */
export const CONTACT_EPS = 0.002;
/** contactStride's coarse sweep over the stance half (phases), before each end is bisected. */
const CONTACT_STEPS = 20;
const CONTACT_BISECT = 9;
/** [the left ankle's z, its lifted sole's height] of the last leftContact call */
const LEFT = new Float64Array(2);

/**
 * walkPose's left foot at `phase`: its ankle z (body unlifted) into LEFT[0], and whether it touches
 * the floor and carries the body (its sole, lifted by bodyLift, within CONTACT_EPS of the floor
 * and not above the right one).
 */
function leftContact(phase: number, amount: number, l: HumanoidLandmarks): boolean {
   walkPose(phase, amount, SCRATCH);
   const right = footOf(SCRATCH, l, -1)[3];
   const left = footOf(SCRATCH, l, 1);
   const lift = SCRATCH.ground * -Math.min(left[3], right) + SCRATCH.lift * l.hipY;
   LEFT[0] = left[2];
   LEFT[1] = left[3] + lift;
   return LEFT[1] < CONTACT_EPS && left[3] <= right + 1e-9;
}

/** The phase (stance half) between `inside` (in contact) and `outside` (not) where the contact ends. */
function contactEdge(inside: number, outside: number, amount: number, l: HumanoidLandmarks): number {
   for (let i = 0; i < CONTACT_BISECT; i++) {
      const mid = (inside + outside) / 2;
      if (leftContact(mid, amount, l)) inside = mid;
      else outside = mid;
   }
   return inside;
}

/**
 * The stride length (GLB units, one cycle of walkPose's phase) at which the planted foot does not
 * slide while it actually touches the floor, at every amount. walkStride assumes the foot is
 * planted for the whole stance half (from its forward reach to its backward reach): true at a walk
 * (amount up to about 0.54), where the two agree. A run (0.55 and up) flies with its legs apart and
 * its foot touches the floor only around mid-stance (about 37 % of the cycle at 0.55, 9 % at 1),
 * where the ankle sweeps back faster than the half's average, so the stride that keeps it still
 * there is longer (about 1.15 x walkStride at 0.55, 1.42 x at 1, on the human characters).
 *
 * The value is measureContactStride's at amounts k / CONTACT_TABLE_STEPS (measured once per
 * landmarks object, lazily, and kept), interpolated linearly: within 1 % of the measurement except
 * in the narrow walk-to-run handover (amount 0.53-0.56), where the contact shrinks from half the
 * cycle to about 37 % over 0.01 of amount. Multiply by the asset's scale for metres; advance the
 * phase by `distance / stride x 2π` (gaitPhaseStep does). 0 at amount 0 (standing): clamp it
 * before dividing. Pure; allocation-free after its first call per character (one small table).
 */
export function contactStride(amount: number, l: HumanoidLandmarks): number {
   if (!(amount > 0)) return 0;
   let table = CONTACT_TABLES.get(l);
   if (!table) {
      table = new Float64Array(CONTACT_TABLE_STEPS + 1).fill(NaN);
      table[0] = 0;
      CONTACT_TABLES.set(l, table);
   }
   const x = Math.min(1, amount) * CONTACT_TABLE_STEPS;
   const i = Math.min(CONTACT_TABLE_STEPS - 1, Math.floor(x));
   if (Number.isNaN(table[i])) table[i] = measureContactStride(i / CONTACT_TABLE_STEPS, l);
   if (Number.isNaN(table[i + 1])) table[i + 1] = measureContactStride((i + 1) / CONTACT_TABLE_STEPS, l);
   return table[i] + (table[i + 1] - table[i]) * (x - i);
}

/** contactStride's table: measured at amounts k / this (k = 0..this). */
export const CONTACT_TABLE_STEPS = 128;
const CONTACT_TABLES = new WeakMap<HumanoidLandmarks, Float64Array>();

/**
 * contactStride measured exactly at `amount` (GLB units; what its table holds): from walkPose, the
 * legs' forward kinematics and bodyLift, within the left foot's stance half (phase π/2..3π/2) the
 * longest run of phases where its sole is within CONTACT_EPS of the floor and not above the other
 * one (a coarse sweep, then each end bisected), and the ankle's sweep over it: 2π x the ankle's
 * travel / the phase it took. Pure and allocation-free, but about 50 forward-kinematics passes of
 * walkPose (a few hundred microseconds): per frame, call contactStride.
 */
export function measureContactStride(amount: number, l: HumanoidLandmarks): number {
   if (!(amount > 0)) return 0;
   const a = Math.min(1, amount);
   const from = Math.PI / 2;
   const step = Math.PI / CONTACT_STEPS;
   // the longest run of sampled phases in contact
   let bestStart = -1;
   let bestLen = 0;
   let start = -1;
   for (let i = 0; i <= CONTACT_STEPS + 1; i++) {
      const on = i <= CONTACT_STEPS && leftContact(from + i * step, a, l);
      if (on && start < 0) start = i;
      if (!on && start >= 0) {
         if (i - start > bestLen) {
            bestLen = i - start;
            bestStart = start;
         }
         start = -1;
      }
   }
   if (bestStart < 0) return walkStride(a, l);
   const last = bestStart + bestLen - 1;
   // each end of the run: between the last sample in contact and the first one out (or the half's end)
   const p0 = bestStart === 0 ? from : contactEdge(from + bestStart * step, from + (bestStart - 1) * step, a, l);
   const p1 = last === CONTACT_STEPS ? from + Math.PI : contactEdge(from + last * step, from + (last + 1) * step, a, l);
   if (!(p1 - p0 > 1e-6)) return walkStride(a, l);
   leftContact(p0, a, l);
   const z0 = LEFT[0];
   leftContact(p1, a, l);
   const z1 = LEFT[0];
   return (Math.PI * 2 * (z0 - z1)) / (p1 - p0);
}

/** gaitPhaseStep's shortest stride (m) by default: standing still, the contact stride is 0. */
export const MIN_GAIT_STRIDE = 0.1;

/**
 * How far (rad) walkPose's phase advances this frame for a character drawn at `scale` moving at
 * `speed` (m/s) for `dt` (s), with walkPose's `amount`: the distance over the stride x 2π. The stride
 * is the one the planted foot needs while it touches the floor (contactStride x scale: the walk's
 * own stride at a walk, longer at a run), but never shorter than `minStride` (m) and never so short
 * that the legs beat more than `maxCadence` strides a second (faster, the stride stretches and the
 * feet slide). 0 at speed 0. Pure; allocation-free after the first call per character.
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
   const stride = Math.max(minStride, contactStride(amount, l) * scale, speed / maxCadence);
   return ((speed * dt) / stride) * Math.PI * 2;
}
