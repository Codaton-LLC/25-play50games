// Ground-ring size. The marker lies on the floor, so a camera-facing sprite length is the wrong
// world diameter: the ring's smaller screen extent is what has to be MARKER_PX.
import { Vector3, type PerspectiveCamera } from "three";

/** Outer radius of the runner ring in Primitives / Scene (ringGeometry args). */
export const MARKER_RADIUS = 0.5;

const EPS = 0.5;
const A = new Vector3();
const B = new Vector3();
const C = new Vector3();

function screen(camera: PerspectiveCamera, v: Vector3, x: number, y: number, z: number, width: number, height: number): void {
   v.set(x, y, z).project(camera);
   v.x = (v.x * 0.5 + 0.5) * width;
   v.y = (v.y * -0.5 + 0.5) * height;
}

/**
 * Group scale for a ring of radius MARKER_RADIUS on the ground at (x, y, z), so the foreshortened
 * diameter is `cssPx`. Width and height are the canvas CSS size the camera was fitted to.
 */
export function groundRingScale(
   camera: PerspectiveCamera,
   x: number,
   y: number,
   z: number,
   cssPx: number,
   width: number,
   height: number,
): number {
   if (!(cssPx > 0) || !(width > 0) || !(height > 0)) return 0.001;
   screen(camera, A, x, y, z, width, height);
   screen(camera, B, x + EPS, y, z, width, height);
   screen(camera, C, x, y, z + EPS, width, height);
   const sx = (B.x - A.x) / EPS;
   const sy = (B.y - A.y) / EPS;
   const zx = (C.x - A.x) / EPS;
   const zy = (C.y - A.y) / EPS;
   const aa = sx * sx + sy * sy;
   const bb = sx * zx + sy * zy;
   const cc = zx * zx + zy * zy;
   const trace = aa + cc;
   const det = aa * cc - bb * bb;
   const disc = Math.sqrt(Math.max(0, trace * trace * 0.25 - det));
   const pxPerMeter = Math.sqrt(Math.max(0, trace * 0.5 - disc));
   if (!(pxPerMeter > 1e-4)) return 0.001;
   return cssPx / (2 * MARKER_RADIUS * pxPerMeter);
}
