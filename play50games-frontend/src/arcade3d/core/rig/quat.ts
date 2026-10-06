// Quaternion helpers for the rig's pure modules (poses.ts, gait.ts). Owned by Claude. No three.js,
// no allocation: quaternions are 4 numbers (x, y, z, w) at an offset in a typed array.

type Quats = Float32Array | Float64Array;

/** out = a * b (out may alias a or b). */
export function mulQuat(a: ArrayLike<number>, ao: number, b: ArrayLike<number>, bo: number, out: Quats, oo: number): void {
   const ax = a[ao];
   const ay = a[ao + 1];
   const az = a[ao + 2];
   const aw = a[ao + 3];
   const bx = b[bo];
   const by = b[bo + 1];
   const bz = b[bo + 2];
   const bw = b[bo + 3];
   out[oo] = aw * bx + ax * bw + ay * bz - az * by;
   out[oo + 1] = aw * by - ax * bz + ay * bw + az * bx;
   out[oo + 2] = aw * bz + ax * by - ay * bx + az * bw;
   out[oo + 3] = aw * bw - ax * bx - ay * by - az * bz;
}

/** out[oo..oo+2] = (x, y, z) rotated by the unit quaternion q at qo. */
export function rotateVec(q: ArrayLike<number>, qo: number, x: number, y: number, z: number, out: Quats, oo: number): void {
   const qx = q[qo];
   const qy = q[qo + 1];
   const qz = q[qo + 2];
   const qw = q[qo + 3];
   // t = 2 (q x v); v' = v + w t + q x t
   const tx = 2 * (qy * z - qz * y);
   const ty = 2 * (qz * x - qx * z);
   const tz = 2 * (qx * y - qy * x);
   out[oo] = x + qw * tx + (qy * tz - qz * ty);
   out[oo + 1] = y + qw * ty + (qz * tx - qx * tz);
   out[oo + 2] = z + qw * tz + (qx * ty - qy * tx);
}
