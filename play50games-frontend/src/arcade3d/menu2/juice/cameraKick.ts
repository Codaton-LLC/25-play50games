// Camera kick and shake: an additive camera offset (world metres) made of a directional kick (a
// damped spring: an impact shoves the camera along a direction and it springs back) and a decaying
// trauma shake. Pure (no three.js) and allocation-free; JuiceLayer applies `offset` after the camera
// rigs ran (CameraRig or a game's own follow camera) and takes it off before the next frame's rigs,
// so a rig always works from the clean camera. A game with its own camera may instead add `offset`
// to its camera position itself (createCameraKick + stepCameraKick).

/** The shake's offset (m) at full trauma; it grows with trauma², so small hits stay subtle. */
export const KICK_SHAKE_MAX = 0.3;
/** Trauma lost per second. */
export const KICK_SHAKE_DECAY = 2.2;
/** The kick's spring: frequency (Hz) and damping ratio (it overshoots a little, then settles). */
export const KICK_FREQUENCY = 5;
export const KICK_DAMPING = 0.55;
/** The kick's offset never goes past this (m). */
export const KICK_MAX = 0.6;

export interface CameraKick {
   /** the kick's spring per axis: offset (m) and speed (m/s) */
   kx: number;
   ky: number;
   kz: number;
   vx: number;
   vy: number;
   vz: number;
   trauma: number;
   t: number;
   /** this frame's total offset (m, world) */
   readonly offset: { x: number; y: number; z: number };
   /** the shake's part along the camera's right and up (m): JuiceLayer turns it into world space */
   shakeRight: number;
   shakeUp: number;
}

export function createCameraKick(): CameraKick {
   return { kx: 0, ky: 0, kz: 0, vx: 0, vy: 0, vz: 0, trauma: 0, t: 0, offset: { x: 0, y: 0, z: 0 }, shakeRight: 0, shakeUp: 0 };
}

/**
 * A kick: shoves the camera along (dx, dy, dz) (any length; (0, -1, 0) = a landing thump) with
 * `amount` m/s of spring speed (2 = a bump, 6 = a heavy hit). Off with reduced motion.
 */
export function kickCamera(k: CameraKick, dx: number, dy: number, dz: number, amount: number, reducedMotion = false): void {
   if (reducedMotion || !(amount > 0)) return;
   const len = Math.hypot(dx, dy, dz);
   if (!(len > 1e-9)) return;
   k.vx += (dx / len) * amount;
   k.vy += (dy / len) * amount;
   k.vz += (dz / len) * amount;
}

/** A shake impulse 0..1 (0.2 = a bump, 1 = an explosion). Off with reduced motion. */
export function shakeCamera(k: CameraKick, amount: number, reducedMotion = false): void {
   if (reducedMotion || !(amount > 0)) return;
   k.trauma = Math.min(1, k.trauma + amount);
}

const STEP = 1 / 240;
const clampKick = (v: number) => (v > KICK_MAX ? KICK_MAX : v < -KICK_MAX ? -KICK_MAX : v);

/**
 * Advances by `dt` s (0 = frozen: the offset stays) and writes this frame's offset: the kick in
 * world axes into `offset`, the shake along the camera's right / up into shakeRight / shakeUp.
 */
export function stepCameraKick(k: CameraKick, dt: number): CameraKick {
   if (dt > 0) {
      const w = 2 * Math.PI * KICK_FREQUENCY;
      const stiff = w * w;
      const damp = 2 * KICK_DAMPING * w;
      let left = Math.min(dt, 0.25);
      while (left > 1e-9) {
         const h = Math.min(STEP, left);
         k.vx += (-stiff * k.kx - damp * k.vx) * h;
         k.vy += (-stiff * k.ky - damp * k.vy) * h;
         k.vz += (-stiff * k.kz - damp * k.vz) * h;
         k.kx = clampKick(k.kx + k.vx * h);
         k.ky = clampKick(k.ky + k.vy * h);
         k.kz = clampKick(k.kz + k.vz * h);
         left -= h;
      }
      k.t += dt;
      k.trauma = Math.max(0, k.trauma - KICK_SHAKE_DECAY * dt);
   }
   k.offset.x = k.kx;
   k.offset.y = k.ky;
   k.offset.z = k.kz;
   if (k.trauma <= 0) {
      k.shakeRight = 0;
      k.shakeUp = 0;
   } else {
      const amp = k.trauma * k.trauma * KICK_SHAKE_MAX;
      const t = k.t;
      k.shakeRight = amp * (0.6 * Math.sin(t * 37.1) + 0.4 * Math.sin(t * 59.3 + 1.7));
      k.shakeUp = amp * (0.6 * Math.sin(t * 43.7 + 0.5) + 0.4 * Math.sin(t * 71.9 + 2.9));
   }
   return k;
}

/** True while the kick or the shake still moves the camera. */
export function cameraKickActive(k: CameraKick): boolean {
   return k.trauma > 0 || Math.abs(k.kx) + Math.abs(k.ky) + Math.abs(k.kz) + Math.abs(k.vx) + Math.abs(k.vy) + Math.abs(k.vz) > 1e-5;
}

export function clearCameraKick(k: CameraKick): void {
   k.kx = k.ky = k.kz = 0;
   k.vx = k.vy = k.vz = 0;
   k.trauma = 0;
   k.t = 0;
   k.offset.x = k.offset.y = k.offset.z = 0;
   k.shakeRight = k.shakeUp = 0;
}
