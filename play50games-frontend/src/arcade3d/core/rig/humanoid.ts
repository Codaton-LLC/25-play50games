// Code auto-rig for static T-pose humanoid GLBs. Owned by Claude. Pure: no three.js, no React.
//
// Hyper3D Rodin characters arrive as static meshes in T-pose (arms straight out along ±x, facing
// +z, feet on y = 0, centred on x and z) with no skeleton. This module turns the vertex cloud into
// a rig:
//    estimateHumanoidLandmarks(positions, explicit?)  where the joints are (T-pose heuristics);
//    computeSkinWeights(positions, landmarks)         4 bone weights per vertex, smooth at joints;
//    humanoidJoints(landmarks)                        the bone origins.
// core/rig/skinning.ts builds the three.js SkinnedMesh from it, core/rig/poses.ts the poses and
// core/rig/gait.ts the ground contact and the stride.
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
   "clavicleL",
   "upperArmL",
   "lowerArmL",
   "clavicleR",
   "upperArmR",
   "lowerArmR",
   "upperLegL",
   "lowerLegL",
   "footL",
   "upperLegR",
   "lowerLegR",
   "footR",
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
   clavicleL: 5,
   upperArmL: 6,
   lowerArmL: 7,
   clavicleR: 8,
   upperArmR: 9,
   lowerArmR: 10,
   upperLegL: 11,
   lowerLegL: 12,
   footL: 13,
   upperLegR: 14,
   lowerLegR: 15,
   footR: 16,
} as const satisfies Record<HumanoidBone, number>;

/**
 * Parent of each bone (-1 = the root), always before its children. The clavicles hang from the
 * chest and carry the arms, the legs hang from the hips and carry the feet.
 */
export const BONE_PARENT: readonly number[] = [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15];

/** The same bone on the other side (L <-> R); the trunk maps to itself. */
export const BONE_MIRROR: readonly number[] = [0, 1, 2, 3, 4, 8, 9, 10, 5, 6, 7, 14, 15, 16, 11, 12, 13];

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
   /** |x| of the clavicle joints (at shoulderY): the shoulder between it and shoulderX shrugs with a raised arm */
   clavicleX: number;
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
   /** height of the ankles: everything below ankleY - ankleBlend is the rigid foot */
   ankleY: number;
   /** z of the sole's front end (the toes; the soles lie on y = 0) */
   toeZ: number;
   /** z of the sole's back end (the heels) */
   heelZ: number;
   /** the bare lower legs' half depth about hipZ: cloth further out (an apron) is skirt-weighted */
   legDepth: number;
   /** the bare lower legs' outer |x|: cloth further out (a skirt's sides) is skirt-weighted */
   legOuterX: number;
   /** the lowest height where cloth bridges the legs (an apron's or a skirt's hem); crotchY = none */
   hemY: number;
   /** height of the spine joint (lower back) */
   spineY: number;
   /** height of the chest joint (upper back) */
   chestY: number;
   /** height of the neck joint */
   neckY: number;
   /** height of the head joint: the top of the neck, so the skull (a helmet, a face) stays rigid */
   headY: number;
   /** z of the trunk bones (hips, spine, chest, neck, head) */
   spineZ: number;
   /** weights blend across shoulderX ± shoulderBlend (clavicle <-> upper arm) */
   shoulderBlend: number;
   /** elbowX ± elbowBlend (upper <-> lower arm) */
   elbowBlend: number;
   /** from crotchY - hipBlend to hipY + hipBlend (legs <-> hips) */
   hipBlend: number;
   /** kneeY ± kneeBlend (upper <-> lower leg) */
   kneeBlend: number;
   /** ankleY ± ankleBlend (lower leg <-> foot) */
   ankleBlend: number;
   /** x = ±crotchBlend (left leg <-> right leg) at the crotch; skirt-weighted cloth spreads it further down */
   crotchBlend: number;
   /** spineY and chestY ± spineBlend */
   spineBlend: number;
   /** neckY and headY ± neckBlend */
   neckBlend: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

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

/** Bands of the height profile (the hand tips, the neck, the arm spread, the feet, the hem). */
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
/** The neck: the bands next to the narrowest one that are at most this much wider. */
const NECK_RUN = 1.25;
/** Skirt-weighted cloth: its L/R blend widens by this x the distance below the crotch. */
const SKIRT_SPREAD = 0.6;
/** Cloth starts this fraction of legDepth beyond the bare legs (smoothly). */
const CLOTH_GAP = 0.3;

/**
 * Finds the joints of a T-pose humanoid from its vertex cloud (xyz triples, GLB model units;
 * the character faces +z, centred on x = 0). Deterministic. Each field of `explicit` replaces the
 * estimate (and later estimates build on it, e.g. an explicit hipY moves the estimated knee).
 *
 * - Arms: the heights of the forearms (55-80 % of the hand reach out in |x|, near the height of
 *   the hand tips); shoulderY is their middle, armRadius half their height.
 * - Shoulders: from x = 0 outwards, the first |x| columns whose vertical extent (from one arm
 *   thickness below the arms to their top) collapses to the arm's own end the torso; the joint
 *   is half an arm radius further out. Clavicles halfway in.
 * - Wrists at 70 % of the way from the shoulder to the hand tip, elbows halfway to the wrist.
 * - Crotch: going up from the shins, the last height where the middle-depth strip of the cloud is
 *   empty around x = 0 (two legs). Only the strip counts, so an apron in front of the legs or a
 *   short skirt around them does not hide the gap. Hips a little above the crotch, knees halfway
 *   between the hips and the floor, the leg centre lines from the strip's inner and outer edges.
 * - Feet: going up from the floor, the bands deeper (z) than halfway between the shins and the
 *   soles; the ankle sits a blend width above them, so the whole foot is rigid. Toes and heels
 *   from the foot's z extent.
 * - Cloth: the lower legs' depth and width (between the ankle and the knee), and the hem = the
 *   lowest height below the crotch where something bridges the gap between the legs.
 * - Neck: the narrowest height in the lower half of what is above the arms, and the bands around
 *   it nearly as narrow; the head joint sits at the top of that neck (everything above is rigid
 *   on the head), the neck joint two blend widths lower.
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

   // ---- height profile: how far out each band reaches ----
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
   const clavicleX = explicit.clavicleX ?? 0.5 * shoulderX;

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

   // ---- neck: the narrowest bands in the lower half of what is above the arms ----
   const neckFrom = bandOf(armTop) + 1;
   const neckTo = bandOf(armTop + 0.5 * (maxY - armTop));
   let narrow = -1;
   for (let b = neckFrom; b <= neckTo; b++) if (bandReach[b] > 0 && (narrow < 0 || bandReach[b] < bandReach[narrow])) narrow = b;
   let neckLo = armTop;
   let neckHi = armTop;
   if (narrow >= 0) {
      // out from the narrowest band while the bands stay narrow (an empty band says nothing: a sparse mesh)
      let lo = narrow;
      let hi = narrow;
      const limit = NECK_RUN * bandReach[narrow];
      for (let b = narrow - 1; b >= neckFrom; b--) {
         if (bandReach[b] === 0) continue;
         if (bandReach[b] > limit) break;
         lo = b;
      }
      for (let b = narrow + 1; b <= neckTo; b++) {
         if (bandReach[b] === 0) continue;
         if (bandReach[b] > limit) break;
         hi = b;
      }
      neckLo = minY + lo * bandH;
      neckHi = minY + (hi + 1) * bandH;
   }
   const neckBlend = explicit.neckBlend ?? Math.max(0.5 * bandH, 0.25 * (neckHi - neckLo));
   // the head joint at the top of the neck: from headY + neckBlend up, all head (a helmet, a face)
   const headY = explicit.headY ?? neckHi - neckBlend;
   const neckY = explicit.neckY ?? headY - 2 * neckBlend;

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
   const stripZ = legDepths.length ? median(legDepths) : 0;
   const legGap = legGaps.length ? median(legGaps) : 0.3 * hipX;
   const crotchBlend = explicit.crotchBlend ?? clamp(legGap, 0.15 * hipX, 0.6 * hipX);
   const hipBlend = explicit.hipBlend ?? 0.2 * (hipY - kneeY);
   const kneeBlend = explicit.kneeBlend ?? 0.15 * (hipY - kneeY);

   // ---- feet: the bands from the floor up that are deeper than halfway from the shins to the soles ----
   const kneeBand = bandOf(kneeY);
   const bandZLo = new Float64Array(kneeBand + 1).fill(Infinity);
   const bandZHi = new Float64Array(kneeBand + 1).fill(-Infinity);
   for (let i = 0; i < n; i++) {
      const y = positions[i * 3 + 1];
      if (y > kneeY) continue;
      const b = bandOf(y);
      const z = positions[i * 3 + 2];
      if (z < bandZLo[b]) bandZLo[b] = z;
      if (z > bandZHi[b]) bandZHi[b] = z;
   }
   const depthOf = (b: number) => (bandZHi[b] >= bandZLo[b] ? bandZHi[b] - bandZLo[b] : 0);
   let soleDepth = 0;
   for (let b = 0; b <= bandOf(minY + 0.05 * height) && b <= kneeBand; b++) soleDepth = Math.max(soleDepth, depthOf(b));
   let shinDepth = Infinity;
   for (let b = bandOf(minY + 0.35 * (kneeY - minY)); b <= bandOf(minY + 0.6 * (kneeY - minY)); b++) {
      const d = depthOf(b);
      if (d > 0) shinDepth = Math.min(shinDepth, d);
   }
   let footTop = minY + 0.2 * (kneeY - minY);
   if (shinDepth < Infinity && soleDepth > 1.15 * shinDepth) {
      const deep = (shinDepth + soleDepth) / 2;
      let top = -1;
      for (let b = 0, misses = 0; b <= kneeBand && misses < 2; b++) {
         const d = depthOf(b);
         if (d === 0) continue; // an empty band says nothing (a sparse mesh)
         if (d > deep) {
            top = b;
            misses = 0;
         } else {
            misses++;
         }
      }
      if (top >= 0) footTop = minY + (top + 1) * bandH;
   }
   const ankleBlend = explicit.ankleBlend ?? 0.15 * (kneeY - footTop);
   const ankleY = explicit.ankleY ?? footTop + ankleBlend;

   // ---- the bare lower legs (ankle to knee): the legs' depth (z) and width, no apron down there ----
   let shinLo = Infinity;
   let shinHi = -Infinity;
   let shinWide = 0;
   for (let i = 0; i < n; i++) {
      const y = positions[i * 3 + 1];
      if (y < ankleY + ankleBlend || y > kneeY - kneeBlend) continue;
      const z = positions[i * 3 + 2];
      if (z < shinLo) shinLo = z;
      if (z > shinHi) shinHi = z;
      shinWide = Math.max(shinWide, Math.abs(positions[i * 3]));
   }
   const hasShins = shinLo <= shinHi;
   // the leg bones' depth: the middle of the shins (an apron or a skirt in front of the thighs would
   // pull the strips' middle forward), else the strips'
   const hipZ = explicit.hipZ ?? (hasShins ? (shinLo + shinHi) / 2 : stripZ);
   const legDepth = explicit.legDepth ?? (hasShins ? Math.max(shinHi - hipZ, hipZ - shinLo) : 0.5 * hipX);
   const legOuterX = explicit.legOuterX ?? (hasShins ? shinWide : 1.6 * hipX);

   let toeZ = explicit.toeZ;
   let heelZ = explicit.heelZ;
   if (toeZ === undefined || heelZ === undefined) {
      let zLo = Infinity;
      let zHi = -Infinity;
      for (let i = 0; i < n; i++) {
         if (positions[i * 3 + 1] > ankleY - ankleBlend) continue;
         const z = positions[i * 3 + 2];
         if (z < zLo) zLo = z;
         if (z > zHi) zHi = z;
      }
      toeZ ??= zHi >= zLo ? zHi : hipZ + 0.1 * height;
      heelZ ??= zHi >= zLo ? zLo : hipZ - 0.03 * height;
   }

   // ---- cloth: the hem of what bridges the legs ----
   let hemY = explicit.hemY;
   if (hemY === undefined) {
      // below the crotch, a band is bridged when 3+ of its vertices lie within half the leg gap of x = 0
      const bridgeX = 0.5 * legGap;
      const bridged = new Uint32Array(BANDS);
      for (let i = 0; i < n; i++) {
         const y = positions[i * 3 + 1];
         if (y >= crotchY || Math.abs(positions[i * 3]) >= bridgeX) continue;
         bridged[bandOf(y)]++;
      }
      hemY = crotchY;
      for (let b = bandOf(crotchY) - 1, misses = 0; b >= 0 && minY + b * bandH > kneeY - kneeBlend && misses < 2; b--) {
         if (bridged[b] >= KTH) {
            hemY = minY + b * bandH;
            misses = 0;
         } else {
            misses++;
         }
      }
      // the crotch's own curve is no cloth: cloth hangs below the hips' blend
      if (hemY > crotchY - hipBlend) hemY = crotchY;
   }

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
      clavicleX,
      elbowX,
      wristX,
      armSpread,
      crotchY,
      hipY,
      hipX,
      hipZ,
      kneeY,
      ankleY,
      toeZ,
      heelZ,
      legDepth,
      legOuterX,
      hemY,
      spineY,
      chestY,
      neckY,
      headY,
      spineZ,
      shoulderBlend: explicit.shoulderBlend ?? 0.6 * armRadius,
      elbowBlend: explicit.elbowBlend ?? Math.min(0.5 * armRadius, 0.25 * (wristX - shoulderX)),
      hipBlend,
      kneeBlend,
      ankleBlend,
      crotchBlend,
      spineBlend: explicit.spineBlend ?? 0.3 * (chestY - spineY),
      neckBlend,
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
   for (let side = 1; side >= -1; side -= 2) {
      const left = side > 0;
      set(left ? BONE.clavicleL : BONE.clavicleR, side * l.clavicleX, l.shoulderY, l.shoulderZ);
      set(left ? BONE.upperArmL : BONE.upperArmR, side * l.shoulderX, l.shoulderY, l.shoulderZ);
      set(left ? BONE.lowerArmL : BONE.lowerArmR, side * l.elbowX, l.shoulderY, l.shoulderZ);
      set(left ? BONE.upperLegL : BONE.upperLegR, side * l.hipX, l.hipY, l.hipZ);
      set(left ? BONE.lowerLegL : BONE.lowerLegR, side * l.hipX, l.kneeY, l.hipZ);
      set(left ? BONE.footL : BONE.footR, side * l.hipX, l.ankleY, l.hipZ);
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
 * Bone weights for every vertex (xyz triples, the same model space as `l`). Deterministic.
 *
 * - Arms: the vertices beyond the shoulder inside the arm band; between the clavicle joint and the
 *   shoulder the clavicle (it shrugs with a raised arm), inside it the chest.
 * - Legs: the vertices below the hips, split at x = 0 and blended over ±crotchBlend; feet below
 *   the ankle. Cloth that bridges the legs (an apron, a short skirt: between the hem and the
 *   crotch, beyond the bare legs' depth or width) is skirt-weighted: its L/R blend widens with the
 *   distance below the crotch and it keeps a share of the hips that fades out down to the hem, so
 *   it hangs between the legs instead of stretching into a sheet.
 * - The rest: the trunk chain by height.
 *
 * Every joint blends smoothly over its blend width; at most 4 influences (the 4 largest,
 * renormalised), each row sums to 1.
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
   const clothGap = CLOTH_GAP * l.legDepth;
   const hasCloth = l.hemY < l.crotchY;

   for (let i = 0; i < n; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const ax = Math.abs(x);
      const left = x >= 0;
      w.fill(0);

      // ---- arms and clavicles ----
      const gate = 1 - smoothstep(l.armRadius, gateEnd, Math.abs(y - l.shoulderY));
      const beyond = smoothstep(l.shoulderX - l.shoulderBlend, l.shoulderX + l.shoulderBlend, ax);
      const arm = beyond * gate;
      const forearm = smoothstep(l.elbowX - l.elbowBlend, l.elbowX + l.elbowBlend, ax);
      w[left ? BONE.upperArmL : BONE.upperArmR] = arm * (1 - forearm);
      w[left ? BONE.lowerArmL : BONE.lowerArmR] = arm * forearm;
      // the clavicle: from its joint out to where the arm starts (it is 1 wherever `beyond` > 0)
      const clavicle = gate * smoothstep(l.clavicleX, l.shoulderX - l.shoulderBlend, ax) * (1 - beyond);
      w[left ? BONE.clavicleL : BONE.clavicleR] = clavicle;
      const body = 1 - arm - clavicle;

      // ---- legs (and the cloth that bridges them) ----
      const legZone = 1 - smoothstep(l.crotchY - l.hipBlend, l.hipY + l.hipBlend, y);
      let leg = legZone;
      let toL = smoothstep(-l.crotchBlend, l.crotchBlend, x);
      if (hasCloth && legZone > 0) {
         const zone = smoothstep(l.hemY - 0.5 * l.kneeBlend, l.hemY, y);
         const out = Math.max(smoothstep(l.legDepth, l.legDepth + clothGap, Math.abs(z - l.hipZ)), smoothstep(l.legOuterX, l.legOuterX + clothGap, ax));
         const cloth = zone * out;
         if (cloth > 0) {
            const spread = l.crotchBlend + SKIRT_SPREAD * Math.max(0, l.crotchY - y);
            toL = lerp(toL, smoothstep(-spread, spread, x), cloth);
            leg = lerp(legZone, Math.min(legZone, 1 - smoothstep(l.hemY, l.hipY + l.hipBlend, y)), cloth);
         }
      }
      leg *= body;
      const shin = 1 - smoothstep(l.kneeY - l.kneeBlend, l.kneeY + l.kneeBlend, y);
      const foot = Math.min(shin, 1 - smoothstep(l.ankleY - l.ankleBlend, l.ankleY + l.ankleBlend, y));
      w[BONE.upperLegL] = leg * toL * (1 - shin);
      w[BONE.lowerLegL] = leg * toL * (shin - foot);
      w[BONE.footL] = leg * toL * foot;
      w[BONE.upperLegR] = leg * (1 - toL) * (1 - shin);
      w[BONE.lowerLegR] = leg * (1 - toL) * (shin - foot);
      w[BONE.footR] = leg * (1 - toL) * foot;

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
