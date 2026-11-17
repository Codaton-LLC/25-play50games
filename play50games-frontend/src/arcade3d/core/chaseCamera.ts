// A chase camera for vehicles (a rover, a kart, a boat): it sits behind the target's heading and above
// it, swings round after the heading with a lag, looks a little ahead, never dips under the ground and
// widens its lens on a portrait screen. Pure math (no three.js, no React), unit-tested in
// chaseCamera.test.ts; <ChaseRig> (ChaseRig.tsx) drives the canvas camera with it.
//
// Because the camera turns with the vehicle, "left" on the stick or the keys always turns the picture
// left: a vehicle steered by its own left/right is camera-relative under a chase camera.
// Heading convention: yaw 0 faces +z, the forward vector is (sin yaw, cos yaw) in (x, z).

export interface ChaseTarget {
   x: number;
   y: number;
   z: number;
   /** the heading to sit behind (radians, 0 = facing +z) */
   yaw: number;
}

export interface ChaseOptions {
   /** metres behind the target */
   distance: number;
   /** metres above the target */
   height: number;
   /** the camera looks this far ahead of the target along its own heading (m) */
   lookAhead: number;
   /** ... and this high above it (m) */
   lookHeight: number;
   /** how fast the camera's heading follows the target's (1/s); lower = lazier swing */
   yawRate: number;
   /** how fast the position follows (1/s) */
   followRate: number;
   /** keep the camera at least this far above the ground under it (m). Default 1.5 */
   clearance?: number;
}

export interface ChaseState {
   placed: boolean;
   yaw: number;
   x: number;
   y: number;
   z: number;
   lookX: number;
   lookY: number;
   lookZ: number;
}

export function createChaseState(): ChaseState {
   return { placed: false, yaw: 0, x: 0, y: 0, z: 0, lookX: 0, lookY: 0, lookZ: 0 };
}

/** a - b wrapped into (-PI, PI]. */
export function angleDelta(a: number, b: number): number {
   let d = (a - b) % (2 * Math.PI);
   if (d > Math.PI) d -= 2 * Math.PI;
   else if (d <= -Math.PI) d += 2 * Math.PI;
   return d;
}

/**
 * One frame: the heading eases towards target.yaw + yawOffset (the shortest way round), the camera
 * towards its spot behind and above, then rises over the ground if needed. The first call places it
 * at once. `ground(x, z)` is the terrain height (omit for a flat floor at y 0).
 */
export function stepChase(
   state: ChaseState,
   target: ChaseTarget,
   opts: ChaseOptions,
   dt: number,
   ground?: (x: number, z: number) => number,
   yawOffset = 0
): ChaseState {
   const wantYaw = target.yaw + yawOffset;
   const first = !state.placed;
   if (first) state.yaw = wantYaw;
   else state.yaw += angleDelta(wantYaw, state.yaw) * (1 - Math.exp(-opts.yawRate * Math.max(0, dt)));
   const fx = Math.sin(state.yaw);
   const fz = Math.cos(state.yaw);
   const wx = target.x - fx * opts.distance;
   const wz = target.z - fz * opts.distance;
   let wy = target.y + opts.height;
   const clearance = opts.clearance ?? 1.5;
   if (ground) wy = Math.max(wy, ground(wx, wz) + clearance);
   const k = first ? 1 : 1 - Math.exp(-opts.followRate * Math.max(0, dt));
   state.x += (wx - state.x) * k;
   state.y += (wy - state.y) * k;
   state.z += (wz - state.z) * k;
   if (ground) state.y = Math.max(state.y, ground(state.x, state.z) + clearance);
   state.lookX = target.x + fx * opts.lookAhead;
   state.lookY = target.y + opts.lookHeight;
   state.lookZ = target.z + fz * opts.lookAhead;
   state.placed = true;
   return state;
}

/**
 * The vertical fov (degrees) that keeps at least `minHorizontal` degrees across on this aspect
 * (width / height), never under `base` nor over `max`. A landscape screen keeps `base`.
 */
export function chaseFov(aspect: number, base: number, minHorizontal: number, max: number): number {
   const a = aspect > 0 ? aspect : 1;
   const needed = (2 * Math.atan(Math.tan((minHorizontal * Math.PI) / 360) / a) * 180) / Math.PI;
   return Math.min(max, Math.max(base, needed));
}

/**
 * How much farther back and higher a portrait screen sits (1 on landscape, up to `most` on a tall
 * phone), so the vehicle and the road ahead keep their share of a narrow picture.
 */
export function portraitPullback(aspect: number, most = 1.4): number {
   if (!(aspect > 0) || aspect >= 1) return 1;
   // 1 at a square screen, `most` at 9:19.5 (0.46) and narrower
   const t = Math.min(1, (1 - aspect) / (1 - 0.46));
   return 1 + (most - 1) * t;
}
