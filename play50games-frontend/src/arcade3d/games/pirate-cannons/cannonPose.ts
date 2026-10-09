// Where the cannon model is drawn for an aim (and its recoil): the axle on the platform, turned by
// the yaw, the whole model tipped about its axle by the elevation minus the GLB's own barrel angle.
// The same transform as rules.ts muzzleAt, so the drawn muzzle is the rules' (assets.test.ts).
import { Matrix4 } from "three";
import { CANNON, PIVOT_Y } from "./rules";

const R = new Matrix4();
const T = new Matrix4();

/**
 * The cannon model's matrix (the model's own origin, its feet) for an aim: T(axle on the platform,
 * moved back by `recoil` m along the barrel's heading) x Ry(PI - yaw) x Rx(barrel angle - elevation) x
 * T(-the axle in the model). Writes `out`.
 */
export function cannonMatrix(yaw: number, elevation: number, recoil: number, out: Matrix4): Matrix4 {
   const s = CANNON.scale;
   out.makeTranslation(CANNON.x - recoil * Math.sin(yaw), PIVOT_Y, CANNON.z + recoil * Math.cos(yaw));
   out.multiply(R.makeRotationY(Math.PI - yaw));
   out.multiply(R.makeRotationX(CANNON.barrelAngle - elevation));
   out.multiply(T.makeTranslation(0, -CANNON.axleGlb.y * s, -CANNON.axleGlb.z * s));
   return out;
}
