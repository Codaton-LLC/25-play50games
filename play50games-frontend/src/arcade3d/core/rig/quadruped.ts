// Code auto-rig for static four-legged animal GLBs (a cat, a dog). Owned by Claude. Pure: no
// three.js, no React. The humanoid twin is humanoid.ts.
//
// Hyper3D Rodin animals arrive as one static mesh standing on all four paws (facing +z, paws on
// y = 0, centred on x) with no skeleton. This module turns the vertex cloud into a rig:
//    quadrupedJoints(landmarks)                   the bone origins (bind pose = the mesh as modelled);
//    computeQuadrupedWeights(positions, lm)       4 bone weights per vertex, smooth at every joint.
// core/rig/quadrupedSkinning.ts builds the three.js SkinnedMesh, core/rig/quadrupedPoses.ts the
// gaits (walk, trot, gallop with planted paws), idle, sit and leap.
//
// Landmarks are measured once per GLB and committed on the asset (`ModelAsset.quadruped`); there is
// no runtime estimate (animal meshes vary too much). Sides: L is the animal's own left = +x.
// Units: GLB model units (the GLB root's space, mesh node transforms applied, before asset.scale).

export const QUADRUPED_BONES = [
   "hips",
   "spine",
   "chest",
   "neck",
   "head",
   "tail1",
   "tail2",
   "tail3",
   "upperFL",
   "lowerFL",
   "pawFL",
   "upperFR",
   "lowerFR",
   "pawFR",
   "upperHL",
   "lowerHL",
   "pawHL",
   "upperHR",
   "lowerHR",
   "pawHR",
   "stash",
] as const;

export type QuadrupedBone = (typeof QUADRUPED_BONES)[number];
export const QUAD_BONE_COUNT = QUADRUPED_BONES.length;

export const QBONE = {
   hips: 0,
   spine: 1,
   chest: 2,
   neck: 3,
   head: 4,
   tail1: 5,
   tail2: 6,
   tail3: 7,
   upperFL: 8,
   lowerFL: 9,
   pawFL: 10,
   upperFR: 11,
   lowerFR: 12,
   pawFR: 13,
   upperHL: 14,
   lowerHL: 15,
   pawHL: 16,
   upperHR: 17,
   lowerHR: 18,
   pawHR: 19,
   stash: 20,
} as const satisfies Record<QuadrupedBone, number>;

/**
 * Parent of each bone (-1 = the root), always before its children. The front legs hang from the
 * chest, the hind legs and the tail from the hips. `stash` (child of the hips, always scaled to
 * nothing) swallows stray parts of the mesh (rig: `stray`).
 */
export const QUAD_BONE_PARENT: readonly number[] = [-1, 0, 1, 2, 3, 0, 5, 6, 2, 8, 9, 2, 11, 12, 0, 14, 15, 0, 17, 18, 0];

/** The four legs: [upper, lower, paw] bone indices, and whether the leg is a front one and its side (+1 = L = +x). */
export const QUAD_LEGS = [
   { name: "FL", upper: QBONE.upperFL, lower: QBONE.lowerFL, paw: QBONE.pawFL, front: true, side: 1 },
   { name: "FR", upper: QBONE.upperFR, lower: QBONE.lowerFR, paw: QBONE.pawFR, front: true, side: -1 },
   { name: "HL", upper: QBONE.upperHL, lower: QBONE.lowerHL, paw: QBONE.pawHL, front: false, side: 1 },
   { name: "HR", upper: QBONE.upperHR, lower: QBONE.lowerHR, paw: QBONE.pawHR, front: false, side: -1 },
] as const;

/** A point [x, y, z] in GLB units. */
export type Vec3 = readonly [number, number, number];
/** A point [z, y] on the centre plane (x = 0). */
export type Vec2 = readonly [number, number];

/** One pair of legs, measured on the left one (+x); the right one is its mirror. */
export interface QuadrupedLeg {
   /** the top joint (shoulder / hip) inside the trunk: the leg swings about it */
   top: Vec3;
   /** the middle joint (the front wrist / the hind hock, whichever bends the visible leg) */
   knee: Vec3;
   /** the ankle: everything below it is the rigid paw (its sole on y = 0) */
   ankle: Vec3;
   /** z of the toes' front */
   toeZ: number;
   /** the leg's thickness about its centre line: vertices within it belong to the leg */
   radius: number;
   /**
    * Which way the middle joint bends: +1 forward (a front wrist: the paw folds back in the swing),
    * -1 backward (a hind hock). Default: inferred from the rest leg, else front +1, hind -1.
    */
   bend?: 1 | -1;
}

export interface QuadrupedLandmarks {
   front: QuadrupedLeg;
   hind: QuadrupedLeg;
   /** underside of the trunk: below it a vertex near a leg is all leg; above it the leg fades into the trunk */
   bellyY: number;
   /** the leg fades into the trunk from bellyY to bellyY + thighBlend (thighs and shoulders move a little) */
   thighBlend: number;
   /** base of the neck (x = 0): the neck bends here */
   neck: Vec2;
   /** the head joint (x = 0), at the top of the neck: above / ahead of it the skull is rigid */
   head: Vec2;
   /** the mouth, where a carried toy sits (rig anchor `mouth`) */
   mouth: Vec3;
   /** the tail's centre line, base -> tip (4 points: three bones) */
   tail: readonly [Vec3, Vec3, Vec3, Vec3];
   /** the tail's thickness about its line */
   tailRadius: number;
   /**
    * Stray parts of the mesh to fold away (a Rodin animal sometimes gets a second tail): centre
    * lines base -> tip and thickness. Their vertices shrink into the hips (bone `stash`).
    */
   stray?: ReadonlyArray<{ line: readonly Vec3[]; radius: number }>;
}

/** Bone origins in GLB units (x, y, z per bone, QUADRUPED_BONES order). */
export function quadrupedJoints(lm: QuadrupedLandmarks): Float32Array {
   const j = new Float32Array(QUAD_BONE_COUNT * 3);
   const set = (b: number, x: number, y: number, z: number) => {
      j[b * 3] = x;
      j[b * 3 + 1] = y;
      j[b * 3 + 2] = z;
   };
   const h = lm.hind.top;
   const f = lm.front.top;
   set(QBONE.hips, 0, h[1], h[2]);
   set(QBONE.spine, 0, (h[1] + f[1]) / 2, (h[2] + f[2]) / 2);
   set(QBONE.chest, 0, f[1], f[2]);
   set(QBONE.neck, 0, lm.neck[1], lm.neck[0]);
   set(QBONE.head, 0, lm.head[1], lm.head[0]);
   for (let k = 0; k < 3; k++) set(QBONE.tail1 + k, lm.tail[k][0], lm.tail[k][1], lm.tail[k][2]);
   for (const leg of QUAD_LEGS) {
      const m = leg.front ? lm.front : lm.hind;
      set(leg.upper, m.top[0] * leg.side, m.top[1], m.top[2]);
      set(leg.lower, m.knee[0] * leg.side, m.knee[1], m.knee[2]);
      set(leg.paw, m.ankle[0] * leg.side, m.ankle[1], m.ankle[2]);
   }
   // the stash bone sits a little inside the body behind the first stray part's base: its vertices
   // shrink to that point, the ones near the base into a short dimple
   const base = lm.stray?.[0]?.line[0];
   if (base) set(QBONE.stash, base[0] * 0.6, base[1] + (h[1] - base[1]) * 0.35, base[2] + (h[2] - base[2]) * 0.35);
   else set(QBONE.stash, 0, h[1], h[2]);
   return j;
}

export interface QuadrupedWeights {
   skinIndex: Uint16Array;
   skinWeight: Float32Array;
}

const smooth = (a: number, b: number, x: number) => {
   const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
   return t * t * (3 - 2 * t);
};

/** Distance from p to a 3D polyline and the index + fraction of the closest segment. */
function nearestOnLeg(px: number, py: number, pz: number, pts: ReadonlyArray<readonly number[]>, out: { d: number; seg: number; t: number; along: number; total: number; before: boolean }): void {
   let best = Infinity;
   let along = 0;
   out.before = false;
   for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const dz = b[2] - a[2];
      const len2 = dx * dx + dy * dy + dz * dz || 1e-9;
      const len = Math.sqrt(len2);
      const raw = ((px - a[0]) * dx + (py - a[1]) * dy + (pz - a[2]) * dz) / len2;
      const t = Math.min(1, Math.max(0, raw));
      const d = Math.hypot(px - (a[0] + dx * t), py - (a[1] + dy * t), pz - (a[2] + dz * t));
      if (d < best) {
         best = d;
         out.before = i === 0 && raw * len < -0.02;
         out.seg = i;
         out.t = t;
         out.along = along + t * len;
      }
      along += len;
   }
   out.d = best;
   out.total = along;
}

/**
 * Four bone weights per vertex (skinIndex / skinWeight, 4 per vertex, weights sum to 1).
 * Priority: stray parts (folded away), the tail, the legs (fading into the trunk above bellyY), the
 * neck and head (ahead of the neck), the trunk (hips -> spine -> chest along z).
 */
export function computeQuadrupedWeights(positions: ArrayLike<number>, lm: QuadrupedLandmarks): QuadrupedWeights {
   const count = Math.floor(positions.length / 3);
   const skinIndex = new Uint16Array(count * 4);
   const skinWeight = new Float32Array(count * 4);
   const w = new Float32Array(QUAD_BONE_COUNT);
   const hipZ = lm.hind.top[2];
   const chestZ = lm.front.top[2];
   const neckZ = lm.neck[0];
   const nz = lm.head[0] - lm.neck[0];
   const ny = lm.head[1] - lm.neck[1];
   const nlen2 = nz * nz + ny * ny || 1e-9;
   const near = { d: 0, seg: 0, t: 0, along: 0, total: 0, before: false };
   const legNear = { d: 0, seg: 0, t: 0, along: 0, total: 0, before: false };
   const legs = QUAD_LEGS.map((leg) => {
      const m = leg.front ? lm.front : lm.hind;
      const s = leg.side;
      const toe: number[] = [m.ankle[0] * s, 0, m.toeZ];
      const pts = [
         [m.top[0] * s, m.top[1], m.top[2]],
         [m.knee[0] * s, m.knee[1], m.knee[2]],
         [m.ankle[0] * s, m.ankle[1], m.ankle[2]],
         toe,
      ];
      const upperLen = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]);
      const lowerLen = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1], pts[2][2] - pts[1][2]);
      return { leg, m, pts, upperLen, lowerLen };
   });

   for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      w.fill(0);
      let rest = 1; // weight still to hand out (to the trunk at the end)

      // the nearest leg (its centre line from the top joint to the toes)
      let bestD = Infinity;
      let best = -1;
      let seg = 0;
      let along = 0;
      for (let l = 0; l < 4; l++) {
         const L = legs[l];
         if (Math.sign(x) !== L.leg.side && Math.abs(x) > L.m.radius * 0.5) continue;
         nearestOnLeg(x, y, z, L.pts, legNear);
         if (legNear.d < bestD) {
            bestD = legNear.d;
            best = l;
            seg = legNear.seg;
            along = legNear.along;
         }
      }

      // stray parts: shrink into the body (never a vertex nearer a leg's centre line)
      let strayD = bestD;
      let strayW = 0;
      if (lm.stray) {
         for (const s of lm.stray) {
            nearestOnLeg(x, y, z, s.line, near);
            if (near.before || near.d > s.radius * 1.4 || near.d >= strayD) continue;
            strayD = near.d;
            // all or nothing across the part (a partly folded vertex would draw a spike), eased in along it
            strayW = smooth(0, 0.18, near.along / near.total);
         }
      }
      // the tail
      nearestOnLeg(x, y, z, lm.tail, near);
      const tailD = near.d;
      const tailU = near.along / near.total;
      const isTail = !near.before && tailD <= lm.tailRadius * 1.4 && (strayW === 0 || tailD < strayD);
      if (!isTail && strayW > 0) {
         w[QBONE.stash] = strayW;
         rest -= strayW;
      } else if (isTail) {
         const member = 1 - smooth(lm.tailRadius, lm.tailRadius * 1.4, tailD);
         const into = smooth(0, 0.12, tailU) * member; // the base stays with the hips
         const k = tailU * 3; // 0..3 along the three bones
         const t1 = 1 - smooth(0.75, 1.25, k);
         const t3 = smooth(1.75, 2.25, k);
         const t2 = 1 - t1 - t3;
         w[QBONE.tail1] = into * t1;
         w[QBONE.tail2] = into * t2;
         w[QBONE.tail3] = into * t3;
         rest -= into;
      }

      // the legs (the nearest one)
      if (rest > 0) {
         if (best >= 0) {
            const L = legs[best];
            const r = L.m.radius;
            const below = y < lm.bellyY ? 1 : 1 - smooth(lm.bellyY, lm.bellyY + lm.thighBlend, y);
            // low down the leg is the only thing there (paws, fur): all of it goes to the nearest leg
            const low = y < lm.bellyY * 0.6;
            const member = low ? 1 : below * (1 - smooth(r, r * 1.5, bestD));
            if (member > 0) {
               const blend = Math.min(L.upperLen, L.lowerLen) * 0.25;
               // upper -> lower across the knee, lower -> paw across the ankle (the paw is rigid)
               const toLower = smooth(L.upperLen - blend, L.upperLen + blend, along);
               const toPaw = seg >= 2 || y < L.m.ankle[1] ? smooth(L.m.ankle[1] + blend * 0.6, L.m.ankle[1] - blend * 0.6, y) : 0;
               const share = member * rest;
               w[L.leg.upper] += share * (1 - toLower);
               w[L.leg.lower] += share * toLower * (1 - toPaw);
               w[L.leg.paw] += share * toLower * toPaw;
               rest -= share;
            }
         }
      }

      // neck and head: ahead of the neck joint
      if (rest > 0) {
         const ahead = smooth(neckZ - 0.12 * Math.sqrt(nlen2) - 0.04, neckZ + 0.02, z);
         if (ahead > 0) {
            const t = ((z - lm.neck[0]) * nz + (y - lm.neck[1]) * ny) / nlen2;
            const head = smooth(0.65, 1.1, t);
            const neck = Math.max(0, smooth(-0.4, 0.2, t) - head);
            const share = rest * ahead;
            w[QBONE.head] += share * head;
            w[QBONE.neck] += share * neck;
            rest -= share * (head + neck);
         }
      }

      // the trunk: hips -> spine -> chest along z
      if (rest > 0) {
         const s = (z - hipZ) / (chestZ - hipZ || 1e-9);
         const hips = 1 - smooth(0.05, 0.5, s);
         const chest = smooth(0.5, 0.95, s);
         w[QBONE.hips] += rest * hips;
         w[QBONE.chest] += rest * chest;
         w[QBONE.spine] += rest * (1 - hips - chest);
      }

      // the four biggest, normalised
      for (let k = 0; k < 4; k++) {
         let bi = 0;
         let bw = -1;
         for (let b = 0; b < QUAD_BONE_COUNT; b++)
            if (w[b] > bw) {
               bw = w[b];
               bi = b;
            }
         skinIndex[i * 4 + k] = bi;
         skinWeight[i * 4 + k] = Math.max(0, bw);
         w[bi] = -1;
      }
      const sum = skinWeight[i * 4] + skinWeight[i * 4 + 1] + skinWeight[i * 4 + 2] + skinWeight[i * 4 + 3];
      if (sum > 0) for (let k = 0; k < 4; k++) skinWeight[i * 4 + k] /= sum;
      else {
         skinIndex[i * 4] = QBONE.hips;
         skinWeight[i * 4] = 1;
      }
   }
   return { skinIndex, skinWeight };
}
