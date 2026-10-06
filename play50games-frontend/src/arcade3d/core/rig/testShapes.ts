// Synthetic T-pose characters for the rig tests (vitest only; the app never imports this file).
// Every part is a box whose surface is sampled on a grid (like the vertices of a dense mesh, and
// unlike an 8-corner box, which has no vertex in the middle of a face). Parts on the left (+x) are
// mirrored to the right, central parts are symmetric, so every vertex has a mirror partner.

type Vec = readonly [number, number, number];

export interface Part {
   min: Vec;
   max: Vec;
   /** mirror it to -x as well (a limb); central parts are already symmetric */
   pair?: boolean;
}

const STEP = 0.02;

function face(out: number[], fixed: number, axis: number, a0: number, a1: number, b0: number, b1: number, step: number): void {
   const u = (axis + 1) % 3;
   const v = (axis + 2) % 3;
   const nu = Math.max(1, Math.round((a1 - a0) / step));
   const nv = Math.max(1, Math.round((b1 - b0) / step));
   for (let i = 0; i <= nu; i++) {
      for (let j = 0; j <= nv; j++) {
         const p = [0, 0, 0];
         p[axis] = fixed;
         p[u] = a0 + ((a1 - a0) * i) / nu;
         p[v] = b0 + ((b1 - b0) * j) / nv;
         out.push(p[0], p[1], p[2]);
      }
   }
}

/** The surface of a box, sampled every `step` (xyz triples appended to `out`). */
export function boxSurface(out: number[], min: Vec, max: Vec, step = STEP): void {
   for (let axis = 0; axis < 3; axis++) {
      const u = (axis + 1) % 3;
      const v = (axis + 2) % 3;
      for (const fixed of [min[axis], max[axis]]) face(out, fixed, axis, min[u], max[u], min[v], max[v], step);
   }
}

export function buildShape(parts: readonly Part[], step = STEP): Float32Array {
   const out: number[] = [];
   for (const part of parts) {
      boxSurface(out, part.min, part.max, step);
      if (part.pair) boxSurface(out, [-part.max[0], part.min[1], part.min[2]], [-part.min[0], part.max[1], part.max[2]], step);
   }
   return Float32Array.from(out);
}

/** For every vertex, the index of a vertex at its mirror image (x -> -x). */
export function mirrorPartners(positions: ArrayLike<number>): Int32Array {
   const key = (x: number, y: number, z: number) => `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
   const n = positions.length / 3;
   const at = new Map<string, number>();
   for (let i = 0; i < n; i++) at.set(key(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]), i);
   const partners = new Int32Array(n);
   for (let i = 0; i < n; i++) {
      const j = at.get(key(-positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]));
      if (j === undefined) throw new Error(`vertex ${i} has no mirror partner`);
      partners[i] = j;
   }
   return partners;
}

/**
 * A 1.8 m human-like T-pose: legs 0.05..0.19 out from the middle and 0.85 high, torso ±0.2 up to
 * 1.45, arms 0.2..0.85 out at 1.33..1.43 (axis 1.38, radius 0.05), neck to 1.52, head to 1.8.
 */
export const HUMAN = {
   height: 1.8,
   crotchY: 0.85,
   torsoHalf: 0.2,
   shoulderY: 1.38,
   armRadius: 0.05,
   reach: 0.85,
   legX: 0.12,
   neck: [1.45, 1.52] as const,
};

export const HUMAN_PARTS: readonly Part[] = [
   { min: [0.05, 0, -0.08], max: [0.19, 0.85, 0.08], pair: true },
   { min: [-0.2, 0.85, -0.11], max: [0.2, 1.45, 0.11] },
   { min: [-0.05, 1.45, -0.05], max: [0.05, 1.52, 0.05] },
   { min: [-0.11, 1.52, -0.11], max: [0.11, 1.8, 0.11] },
   { min: [0.2, 1.33, -0.05], max: [0.85, 1.43, 0.05], pair: true },
];

/** Long flat feet (shoes) for HUMAN_PARTS: 0.32 deep (z -0.1..0.22), 0.07 high; the leg is 0.16 deep. */
export const HUMAN_FEET: Part = { min: [0.05, 0, -0.1], max: [0.19, 0.07, 0.22], pair: true };

/** A short apron in front of the legs, from the waist to above the knees: it hides the leg gap from the front. */
export const APRON: Part = { min: [-0.22, 0.5, 0.1], max: [0.22, 0.9, 0.11] };

/**
 * A flat grid in the plane z = `z` (x0..x1, y0..y1, every `step`) with its triangles: positions are
 * appended after `before` vertices (pass the cloud it joins), triangle indices refer to the whole.
 */
export function gridFace(before: number, x0: number, x1: number, y0: number, y1: number, z: number, step = STEP): { positions: number[]; triangles: number[] } {
   const nx = Math.round((x1 - x0) / step);
   const ny = Math.round((y1 - y0) / step);
   const positions: number[] = [];
   const triangles: number[] = [];
   for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) positions.push(x0 + ((x1 - x0) * i) / nx, y0 + ((y1 - y0) * j) / ny, z);
   const at = (i: number, j: number) => before + j * (nx + 1) + i;
   for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
         triangles.push(at(i, j), at(i + 1, j), at(i + 1, j + 1));
         triangles.push(at(i, j), at(i + 1, j + 1), at(i, j + 1));
      }
   }
   return { positions, triangles };
}

/** A short skirt all round the legs (a ring of four thin walls), from the waist to above the knees. */
export const SKIRT: readonly Part[] = [
   { min: [-0.24, 0.55, 0.11], max: [0.24, 0.9, 0.12] },
   { min: [-0.24, 0.55, -0.12], max: [0.24, 0.9, -0.11] },
   { min: [0.23, 0.55, -0.12], max: [0.24, 0.9, 0.12], pair: true },
];

/**
 * Like the shared robot (1.90 x 1.72 x 0.60): boots, legs to 0.62, a torso ±0.26 to 1.16, shoulder
 * caps, chunky arms at 0.99..1.16 with flat hands out to 0.95, a thin neck and a head WIDER than
 * the shoulders (±0.35), so a head vertex can lie beyond the shoulder joint.
 */
export const ROBOT_LIKE = {
   shoulderY: 1.075,
   crotchY: 0.62,
   torsoHalf: 0.26,
   reach: 0.95,
   headHalf: 0.35,
   head: [1.2, 1.72] as const,
};

export const ROBOT_LIKE_PARTS: readonly Part[] = [
   { min: [0.04, 0, -0.2], max: [0.34, 0.18, 0.3], pair: true },
   { min: [0.06, 0.18, -0.08], max: [0.3, 0.62, 0.14], pair: true },
   { min: [-0.26, 0.62, -0.16], max: [0.26, 1.16, 0.28] },
   { min: [0.17, 1.0, -0.08], max: [0.33, 1.16, 0.14], pair: true },
   { min: [0.33, 0.99, -0.05], max: [0.7, 1.16, 0.15], pair: true },
   { min: [0.7, 1.05, 0], max: [0.95, 1.11, 0.2], pair: true },
   { min: [-0.12, 1.16, -0.1], max: [0.12, 1.2, 0.1] },
   { min: [-0.35, 1.2, -0.3], max: [0.35, 1.72, 0.3] },
];
