// Code auto-rig for static T-pose humanoid GLBs. Owned by Claude. Pure: no three.js, no React.
//
// Hyper3D Rodin characters arrive as static meshes in T-pose (arms straight out along ±x, facing
// +z, feet on y = 0, centred on x and z) with no skeleton. This module turns the vertex cloud into
// a rig:
//    estimateHumanoidLandmarks(positions, explicit?)  where the joints are (T-pose heuristics);
//    computeSkinWeights(positions, landmarks)         4 bone weights per vertex, smooth at joints;
//    humanoidJoints(landmarks)                        the bone origins.
// core/rig/skinning.ts builds the three.js SkinnedMesh from it, core/rig/poses.ts the poses.
//
// Sides: L is the character's own left. It faces +z, so its left hand is on +x (R on -x).
// Units: GLB model units (the GLB root's space, mesh node transforms applied, before asset.scale).
// Bind pose = the T-pose as modelled: every bone starts unrotated, axes = model axes.

export const HUMANOID_BONES = [
   "hips",
   "spine",
   "chest",
   "neck",
   "head",
   "upperArmL",
   "lowerArmL",
   "upperArmR",
   "lowerArmR",
   "upperLegL",
   "lowerLegL",
   "upperLegR",
   "lowerLegR",
] as const;

export type HumanoidBone = (typeof HUMANOID_BONES)[number];

export const BONE_COUNT = HUMANOID_BONES.length;

/** Index of each bone in HUMANOID_BONES (and in every per-bone array of the rig). */
export const BONE = {
   hips: 0,
   spine: 1,
   chest: 2,
   neck: 3,
   head: 4,
   upperArmL: 5,
   lowerArmL: 6,
   upperArmR: 7,
   lowerArmR: 8,
   upperLegL: 9,
   lowerLegL: 10,
   upperLegR: 11,
   lowerLegR: 12,
} as const satisfies Record<HumanoidBone, number>;

/** Parent of each bone (-1 = the root). Arms hang from the chest, legs from the hips. */
export const BONE_PARENT: readonly number[] = [-1, 0, 1, 2, 3, 2, 5, 2, 7, 0, 9, 0, 11];

/** The same bone on the other side (L <-> R); the trunk maps to itself. */
export const BONE_MIRROR: readonly number[] = [0, 1, 2, 3, 4, 7, 8, 5, 6, 11, 12, 9, 10];

/**
 * Where the joints of a T-pose character are, in GLB model units. Heights are y, half-widths are
 * |x| (both sides alike), depths are z. `estimateHumanoidLandmarks` measures them; an asset's
 * `humanoid.landmarks` overrides any of them field by field.
 */
export interface HumanoidLandmarks {
   /** height of the shoulder joints = the middle of the arms' band */
   shoulderY: number;
   /** |x| of the shoulder joints: where the arm leaves the torso */
   shoulderX: number;
   /** z of the arm bones */
   shoulderZ: number;
   /** half the arms' thickness (y). Only vertices within it of shoulderY can belong to an arm */
   armRadius: number;
   /** |x| of the elbows */
   elbowX: number;
   /** |x| of the wrists (the hand beyond it rides the lower arm) */
   wristX: number;
   /** angle (rad) between a hanging arm and straight down, so the arm clears the body */
   armSpread: number;
   /** height where the legs part */
   crotchY: number;
   /** height of the hip joints (the legs swing about it) */
   hipY: number;
   /** |x| of the hip joints: the legs' centre lines */
   hipX: number;
   /** z of the leg bones */
   hipZ: number;
   /** height of the knees */
   kneeY: number;
   /** height of the spine joint (lower back) */
   spineY: number;
   /** height of the chest joint (upper back) */
   chestY: number;
   /** height of the neck joint (the narrowest point above the arms) */
   neckY: number;
   /** height of the head joint */
   headY: number;
   /** z of the trunk bones (hips, spine, chest, neck, head) */
   spineZ: number;
   /** weights blend across shoulderX ± shoulderBlend (chest <-> upper arm) */
   shoulderBlend: number;
   /** elbowX ± elbowBlend (upper <-> lower arm) */
   elbowBlend: number;
   /** from crotchY - hipBlend to hipY + hipBlend (legs <-> hips) */
   hipBlend: number;
   /** kneeY ± kneeBlend (upper <-> lower leg) */
   kneeBlend: number;
   /** x = ±crotchBlend (left leg <-> right leg), so the crotch and an apron share both legs */
   crotchBlend: number;
   /** spineY and chestY ± spineBlend */
   spineBlend: number;
   /** neckY and headY ± neckBlend */
   neckBlend: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** 0 at or below `a`, 1 at or above `b`, smooth in between (a step when b <= a). */
export function smoothstep(a: number, b: number, v: number): number {
   if (b <= a) return v < a ? 0 : 1;
   const t = clamp((v - a) / (b - a), 0, 1);
   return t * t * (3 - 2 * t);
}

function median(values: number[]): number {
   const s = values.slice().sort((a, b) => a - b);
   const m = s.length >> 1;
   return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Bands of the height profile (the hand tips, the neck, the arm spread). */
const BANDS = 120;
/** The forearms: from this to this fraction of the hand reach out from x = 0. */
const FOREARM = [0.55, 0.8] as const;
/** Coarser bands for the leg split (a leg's inner side is sparse in a decimated mesh). */
const LEG_BANDS = 48;
/** Columns of |x| for the torso width at arm height... */
const COLUMNS = 80;
/** ...which ends after this many arm-only columns in a row (empty ones, a sparse mesh, do not count). */
const COLLAPSE_RUN = 3;
/** The middle-depth strip of a band: |z - centre| <= this fraction of its half depth. */
const STRIP = 0.4;
/** A band is split into two legs where its strip is empty this far out from x = 0 (fraction of its half-width). */
const SPLIT_GAP = 0.5;
/** The 3 smallest |x| per band side are kept: the 3rd ignores a stray vertex or two in the gap. */
const KTH = 3;

/**
 * Finds the joints of a T-pose humanoid from its vertex cloud (xyz triples, GLB model units;
 * the character faces +z, centred on x = 0). Deterministic. Each field of `explicit` replaces the
 * estimate (and later estimates build on it, e.g. an explicit hipY moves the estimated knee).
 *
 * - Arms: the heights of the forearms (55-80 % of the hand reach out in |x|, near the height of
 *   the hand tips); shoulderY is their middle, armRadius half their height.
 * - Shoulders: from x = 0 outwards, the first |x| columns whose vertical extent (from one arm
 *   thickness below the arms to their top) collapses to the arm's own end the torso; the joint
 *   is half an arm radius further out.
 * - Wrists at 70 % of the way from the shoulder to the hand tip, elbows halfway to the wrist.
 * - Crotch: going up from the shins, the last height where the middle-depth strip of the cloud is
 *   empty around x = 0 (two legs). Only the strip counts, so an apron in front of the legs or a
 *   short skirt around them does not hide the gap. Hips a little above the crotch, knees halfway
 *   between the hips and the floor, the leg centre lines from the strip's inner and outer edges.
 * - Neck: the narrowest height in the lower half of what is above the arms.
 * - Arm spread: the smallest outward angle at which a hanging arm clears the body below it.
 */
export function estimateHumanoidLandmarks(positions: ArrayLike<number>, explicit: Partial<HumanoidLandmarks> = {}): HumanoidLandmarks {
   const n = Math.floor(positions.length / 3);
   if (n < 4) throw new RangeError("estimateHumanoidLandmarks needs a vertex cloud (at least 4 vertices).");

   let minY = Infinity;
   let maxY = -Infinity;
   let reach = 0;
   for (let i = 0; i < n; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      const ax = Math.abs(x);
      if (ax > reach) reach = ax;
   }
   const height = maxY - minY;
   if (!(height > 0) || !(reach > 0)) throw new RangeError("estimateHumanoidLandmarks: the cloud is flat.");

   // ---- height profile: how far out each band reaches, and its depth ----
   const bandH = height / BANDS;
   const bandOf = (y: number) => clamp(Math.floor((y - minY) / bandH), 0, BANDS - 1);
   const bandReach = new Float64Array(BANDS);
   for (let i = 0; i < n; i++) {
      const b = bandOf(positions[i * 3 + 1]);
      const ax = Math.abs(positions[i * 3]);
      if (ax > bandReach[b]) bandReach[b] = ax;
   }

   // ---- arms: the height range of the forearms, near the height of the hand tips ----
   let peak = 0;
   for (let b = 1; b < BANDS; b++) if (bandReach[b] > bandReach[peak]) peak = b;
   const tipY = minY + (peak + 0.5) * bandH;
   let foreLo = Infinity;
   let foreHi = -Infinity;
   for (let i = 0; i < n; i++) {
      const ax = Math.abs(positions[i * 3]);
      const y = positions[i * 3 + 1];
      if (ax < FOREARM[0] * reach || ax > FOREARM[1] * reach || Math.abs(y - tipY) > 0.15 * height) continue;
      if (y < foreLo) foreLo = y;
      if (y > foreHi) foreHi = y;
   }
   if (!(foreLo <= foreHi)) {
      foreLo = tipY - bandH;
      foreHi = tipY + bandH;
   }
   const shoulderY = explicit.shoulderY ?? (foreLo + foreHi) / 2;
   const armRadius = explicit.armRadius ?? Math.max(bandH, (foreHi - foreLo) / 2);
   const armBottom = shoulderY - armRadius;
   const armTop = shoulderY + armRadius;

   // ---- shoulders: where the vertical extent of the |x| columns collapses to the arm's ----
   let shoulderX = explicit.shoulderX;
   if (shoulderX === undefined) {
      const colW = reach / COLUMNS;
      const lo = new Float64Array(COLUMNS).fill(Infinity);
      const hi = new Float64Array(COLUMNS).fill(-Infinity);
      const yLo = armBottom - 2 * armRadius;
      for (let i = 0; i < n; i++) {
         const y = positions[i * 3 + 1];
         if (y < yLo || y > armTop) continue;
         const c = clamp(Math.floor(Math.abs(positions[i * 3]) / colW), 0, COLUMNS - 1);
         if (y < lo[c]) lo[c] = y;
         if (y > hi[c]) hi[c] = y;
      }
      // torso columns span far more than an arm is thick; the torso ends at the last of them
      // before a few arm-only columns in a row (an empty column says nothing: a sparse mesh)
      let last = 0;
      for (let c = 0, thin = 0; c < COLUMNS && thin < COLLAPSE_RUN; c++) {
         if (!(hi[c] >= lo[c])) continue;
         if (hi[c] - lo[c] >= 3 * armRadius) {
            last = c;
            thin = 0;
         } else {
            thin++;
         }
      }
      // the joint sits half an arm radius outside the torso, so a hanging arm clears the chest
      shoulderX = clamp((last + 1) * colW + 0.5 * armRadius, 0.05 * reach, 0.6 * reach);
   }
   const wristX = explicit.wristX ?? shoulderX + 0.7 * (reach - shoulderX);
   const elbowX = explicit.elbowX ?? (shoulderX + wristX) / 2;

   // ---- the depth of the upper arms ----
   let shoulderZ = explicit.shoulderZ;
   if (shoulderZ === undefined) {
      let zLo = Infinity;
      let zHi = -Infinity;
      for (let i = 0; i < n; i++) {
         const ax = Math.abs(positions[i * 3]);
         if (ax < shoulderX || ax > elbowX || Math.abs(positions[i * 3 + 1] - shoulderY) > armRadius) continue;
         const z = positions[i * 3 + 2];
         if (z < zLo) zLo = z;
         if (z > zHi) zHi = z;
      }
      shoulderZ = zLo <= zHi ? (zLo + zHi) / 2 : 0;
   }

   // ---- neck: the narrowest band in the lower half of what is above the arms ----
   let neckY = explicit.neckY;
   if (neckY === undefined) {
      const from = bandOf(armTop) + 1;
      const to = bandOf(armTop + 0.5 * (maxY - armTop));
      let best = -1;
      for (let b = from; b <= to; b++) if (bandReach[b] > 0 && (best < 0 || bandReach[b] < bandReach[best])) best = b;
      neckY = best < 0 ? armTop : minY + (best + 0.5) * bandH;
   }
   const headY = explicit.headY ?? neckY + 0.25 * (maxY - neckY);

   // ---- legs: the middle-depth strip of each band, split around x = 0 ----
   const legH = height / LEG_BANDS;
   const legOf = (y: number) => clamp(Math.floor((y - minY) / legH), 0, LEG_BANDS - 1);
   const zMin = new Float64Array(LEG_BANDS).fill(Infinity);
   const zMax = new Float64Array(LEG_BANDS).fill(-Infinity);
   for (let i = 0; i < n; i++) {
      const b = legOf(positions[i * 3 + 1]);
      const z = positions[i * 3 + 2];
      if (z < zMin[b]) zMin[b] = z;
      if (z > zMax[b]) zMax[b] = z;
   }
   // per band and side (0 = +x, 1 = -x): the KTH smallest |x| in the strip, the largest, the count
   const inner = new Float64Array(LEG_BANDS * 2 * KTH).fill(Infinity);
   const outer = new Float64Array(LEG_BANDS * 2);
   const count = new Uint32Array(LEG_BANDS * 2);
   for (let i = 0; i < n; i++) {
      const b = legOf(positions[i * 3 + 1]);
      const zc = (zMin[b] + zMax[b]) / 2;
      const dz = (zMax[b] - zMin[b]) / 2;
      if (Math.abs(positions[i * 3 + 2] - zc) > STRIP * dz) continue;
      const x = positions[i * 3];
      const side = x >= 0 ? 0 : 1;
      const ax = Math.abs(x);
      const s = b * 2 + side;
      count[s]++;
      if (ax > outer[s]) outer[s] = ax;
      const k = s * KTH;
      if (ax < inner[k + KTH - 1]) {
         let j = KTH - 1;
         while (j > 0 && inner[k + j - 1] > ax) {
            inner[k + j] = inner[k + j - 1];
            j--;
         }
         inner[k + j] = ax;
      }
   }
   const gapOf = (b: number, side: number) => inner[(b * 2 + side) * KTH + KTH - 1];
   const isSplit = (b: number) => {
      for (let side = 0; side < 2; side++) {
         const s = b * 2 + side;
         if (count[s] < KTH || !(gapOf(b, side) < SPLIT_GAP * outer[s])) return false;
      }
      return true;
   };
   // the first split band above the feet, then up while the legs stay apart (one odd band forgiven)
   const shins = legOf(minY + 0.12 * height);
   let first = -1;
   for (let b = shins; b <= legOf(minY + 0.6 * height); b++) {
      if (isSplit(b)) {
         first = b;
         break;
      }
   }
   const splitBands: number[] = [];
   let crotchY = explicit.crotchY;
   if (first >= 0) {
      // never into the arms (in T-pose the arm band is split around x = 0 too)
      const top = Math.min(LEG_BANDS - 1, legOf(armBottom) - 1);
      let b = first;
      while (b + 1 <= top && (isSplit(b + 1) || (b + 2 <= top && isSplit(b + 2)))) b++;
      for (let k = first; k <= b; k++) if (isSplit(k)) splitBands.push(k);
      crotchY ??= minY + (b + 1) * legH;
   }
   crotchY ??= minY + 0.45 * height;
   const hipY = explicit.hipY ?? crotchY + 0.06 * (shoulderY - minY);
   const kneeY = explicit.kneeY ?? minY + 0.5 * (hipY - minY);

   const legCentres: number[] = [];
   const legGaps: number[] = [];
   const legDepths: number[] = [];
   for (const b of splitBands) {
      if (minY + (b + 1) * legH > crotchY) continue;
      legCentres.push((gapOf(b, 0) + outer[b * 2] + gapOf(b, 1) + outer[b * 2 + 1]) / 4);
      legGaps.push((gapOf(b, 0) + gapOf(b, 1)) / 2);
      legDepths.push((zMin[b] + zMax[b]) / 2);
   }
   const hipX = explicit.hipX ?? (legCentres.length ? median(legCentres) : 0.55 * shoulderX);
   const hipZ = explicit.hipZ ?? (legDepths.length ? median(legDepths) : 0);
   const crotchBlend = explicit.crotchBlend ?? clamp(legGaps.length ? median(legGaps) : 0.3 * hipX, 0.15 * hipX, 0.6 * hipX);

   // ---- trunk ----
   const spineY = explicit.spineY ?? hipY + 0.3 * (shoulderY - hipY);
   const chestY = explicit.chestY ?? hipY + 0.6 * (shoulderY - hipY);
   let spineZ = explicit.spineZ;
   if (spineZ === undefined) {
      let zLo = Infinity;
      let zHi = -Infinity;
      for (let i = 0; i < n; i++) {
         if (Math.abs(positions[i * 3 + 1] - chestY) > 2 * bandH || Math.abs(positions[i * 3]) > shoulderX) continue;
         const z = positions[i * 3 + 2];
         if (z < zLo) zLo = z;
         if (z > zHi) zHi = z;
      }
      spineZ = zLo <= zHi ? (zLo + zHi) / 2 : 0;
   }

   // ---- arm spread: the hanging arm's axis stays this far out from the body below the shoulder ----
   let armSpread = explicit.armSpread;
   if (armSpread === undefined) {
      // from 3 arm radii below the shoulder (closer in, the armpit blends anyway) down to the hand tip
      armSpread = 0;
      const length = reach - shoulderX;
      for (let d = 3 * armRadius; d <= length; d += bandH) {
         const y = shoulderY - d;
         if (y < minY) break;
         const need = bandReach[bandOf(y)] + 1.15 * armRadius - shoulderX;
         armSpread = Math.max(armSpread, Math.atan2(need, d));
      }
      armSpread = clamp(armSpread, 0.1, 0.6);
   }

   return {
      shoulderY,
      shoulderX,
      shoulderZ,
      armRadius,
      elbowX,
      wristX,
      armSpread,
      crotchY,
      hipY,
      hipX,
      hipZ,
      kneeY,
      spineY,
      chestY,
      neckY,
      headY,
      spineZ,
      shoulderBlend: explicit.shoulderBlend ?? 0.6 * armRadius,
      elbowBlend: explicit.elbowBlend ?? Math.min(0.5 * armRadius, 0.25 * (wristX - shoulderX)),
      hipBlend: explicit.hipBlend ?? 0.2 * (hipY - kneeY),
      kneeBlend: explicit.kneeBlend ?? 0.15 * (hipY - kneeY),
      crotchBlend,
      spineBlend: explicit.spineBlend ?? 0.3 * (chestY - spineY),
      neckBlend: explicit.neckBlend ?? 0.35 * (headY - neckY),
   };
}

/**
 * The bone origins (x, y, z per bone, HUMANOID_BONES order, model units). R mirrors L in x.
 * Every bone starts unrotated (the T-pose is the bind pose).
 */
export function humanoidJoints(l: HumanoidLandmarks, out: Float64Array = new Float64Array(BONE_COUNT * 3)): Float64Array {
   const set = (bone: number, x: number, y: number, z: number) => {
      out[bone * 3] = x;
      out[bone * 3 + 1] = y;
      out[bone * 3 + 2] = z;
   };
   set(BONE.hips, 0, l.hipY, l.spineZ);
   set(BONE.spine, 0, l.spineY, l.spineZ);
   set(BONE.chest, 0, l.chestY, l.spineZ);
   set(BONE.neck, 0, l.neckY, l.spineZ);
   set(BONE.head, 0, l.headY, l.spineZ);
   for (const side of [1, -1]) {
      const left = side > 0;
      set(left ? BONE.upperArmL : BONE.upperArmR, side * l.shoulderX, l.shoulderY, l.shoulderZ);
      set(left ? BONE.lowerArmL : BONE.lowerArmR, side * l.elbowX, l.shoulderY, l.shoulderZ);
      set(left ? BONE.upperLegL : BONE.upperLegR, side * l.hipX, l.hipY, l.hipZ);
      set(left ? BONE.lowerLegL : BONE.lowerLegR, side * l.hipX, l.kneeY, l.hipZ);
   }
   return out;
}

/** Influences per vertex (three.js skinning reads 4). */
export const SKIN_INFLUENCES = 4;

export interface SkinWeights {
   /** 4 bone indices per vertex (HUMANOID_BONES order), the heaviest first */
   skinIndex: Uint16Array;
   /** 4 weights per vertex, each row summing to 1 */
   skinWeight: Float32Array;
}

/**
 * Bone weights for every vertex (xyz triples, the same model space as `l`). Arms are the vertices
 * beyond the shoulder inside the arm band, legs those below the hips, split at x = 0 (blended over
 * ±crotchBlend, so the crotch and an apron or skirt share both legs instead of tearing), the rest
 * the trunk chain by height. Every joint blends smoothly over its blend width; at most 4
 * influences (the 4 largest, renormalised), each row sums to 1. Deterministic.
 */
export function computeSkinWeights(positions: ArrayLike<number>, l: HumanoidLandmarks, out?: SkinWeights): SkinWeights {
   const n = Math.floor(positions.length / 3);
   const skinIndex = out?.skinIndex ?? new Uint16Array(n * SKIN_INFLUENCES);
   const skinWeight = out?.skinWeight ?? new Float32Array(n * SKIN_INFLUENCES);
   const w = new Float64Array(BONE_COUNT);
   const top = new Int32Array(SKIN_INFLUENCES);
   // the arm band fades out over a quarter of the arm radius: a head or a hip just above or below
   // the arms at the same |x| stays on the trunk
   const gateEnd = l.armRadius * 1.25;

   for (let i = 0; i < n; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const ax = Math.abs(x);
      const left = x >= 0;
      w.fill(0);

      const arm =
         smoothstep(l.shoulderX - l.shoulderBlend, l.shoulderX + l.shoulderBlend, ax) *
         (1 - smoothstep(l.armRadius, gateEnd, Math.abs(y - l.shoulderY)));
      const forearm = smoothstep(l.elbowX - l.elbowBlend, l.elbowX + l.elbowBlend, ax);
      w[left ? BONE.upperArmL : BONE.upperArmR] = arm * (1 - forearm);
      w[left ? BONE.lowerArmL : BONE.lowerArmR] = arm * forearm;
      const body = 1 - arm;

      const leg = body * (1 - smoothstep(l.crotchY - l.hipBlend, l.hipY + l.hipBlend, y));
      const toL = smoothstep(-l.crotchBlend, l.crotchBlend, x);
      const shin = 1 - smoothstep(l.kneeY - l.kneeBlend, l.kneeY + l.kneeBlend, y);
      w[BONE.upperLegL] = leg * toL * (1 - shin);
      w[BONE.lowerLegL] = leg * toL * shin;
      w[BONE.upperLegR] = leg * (1 - toL) * (1 - shin);
      w[BONE.lowerLegR] = leg * (1 - toL) * shin;

      // the trunk chain by height: c1..c4 never increase, so every weight is >= 0 and they add up
      const trunk = body - leg;
      const c1 = smoothstep(l.spineY - l.spineBlend, l.spineY + l.spineBlend, y);
      const c2 = Math.min(c1, smoothstep(l.chestY - l.spineBlend, l.chestY + l.spineBlend, y));
      const c3 = Math.min(c2, smoothstep(l.neckY - l.neckBlend, l.neckY + l.neckBlend, y));
      const c4 = Math.min(c3, smoothstep(l.headY - l.neckBlend, l.headY + l.neckBlend, y));
      w[BONE.hips] = trunk * (1 - c1);
      w[BONE.spine] = trunk * (c1 - c2);
      w[BONE.chest] = trunk * (c2 - c3);
      w[BONE.neck] = trunk * (c3 - c4);
      w[BONE.head] = trunk * c4;

      // the 4 heaviest (ties: the lower bone index), renormalised
      let sum = 0;
      for (let k = 0; k < SKIN_INFLUENCES; k++) {
         let best = -1;
         for (let b = 0; b < BONE_COUNT; b++) {
            if (w[b] < 0) continue; // taken
            if (best < 0 || w[b] > w[best]) best = b;
         }
         top[k] = best;
         sum += w[best];
         w[best] = -1 - w[best]; // mark taken, keep the value recoverable
      }
      const o = i * SKIN_INFLUENCES;
      for (let k = 0; k < SKIN_INFLUENCES; k++) {
         const value = -1 - w[top[k]];
         skinIndex[o + k] = top[k];
         skinWeight[o + k] = sum > 0 ? value / sum : k === 0 ? 1 : 0;
      }
   }
   return { skinIndex, skinWeight };
}
