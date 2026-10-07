// The traffic pools' asset per vehicle kind and their facing. three only (no React), so
// assets.test.ts checks what Scene.tsx draws: a vehicle's local +z is its front (the stand-ins'
// frame, and each GLB's once assets.ts has turned it), and the facing turns that +z to the
// direction it drives.
import { Quaternion, Vector3 } from "three";
import { ASSETS } from "./assets";

/** One <DynamicInstancedModel> pool per VEHICLE_TYPES kind (rules.ts order: car, taxi, van). */
export const VEHICLE_ASSETS = [ASSETS.car, ASSETS.taxi, ASSETS.van];

const UP = new Vector3(0, 1, 0);
/** local +z to world +x */
export const FACE_RIGHT = new Quaternion().setFromAxisAngle(UP, Math.PI / 2);
/** local +z to world -x */
export const FACE_LEFT = new Quaternion().setFromAxisAngle(UP, -Math.PI / 2);

/** The facing of a vehicle driving along `direction` (rules: +1 = +x, -1 = -x). Shared, never mutate. */
export function vehicleFacing(direction: number): Quaternion {
   return direction > 0 ? FACE_RIGHT : FACE_LEFT;
}
