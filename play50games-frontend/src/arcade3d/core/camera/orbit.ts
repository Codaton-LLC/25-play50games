// The free orbit camera's state (ported from the Menu 2 orbit camera, menu2/camera; README.md): yaw (free, all 360°), pitch (clamped from just
// under the horizon to almost top-down), distance (zoom, clamped per game), the smoothing, the
// "recenter behind the hero" action and the optional auto-follow that swings slowly behind the
// hero's travel after a few seconds without manual input. Pure: no three.js, React or DOM, no
// allocation per step, the same result for the same calls.
//
// Two layers: the TARGET (yaw, pitch, distance) is what input sets; the VIEW (viewYaw, viewPitch,
// viewDistance) eases towards it every step and is what the camera draws. Games read `viewYaw` for
// camera-relative movement (core inputToWorld), so "up" is always away from the camera on screen.
//
// Yaw is fitView's camera yaw (core view.ts): the camera sits at pivot + (sin yaw, ·, cos yaw), so
// yaw 0 looks along -z, and inputToWorld(moveX, moveY, yaw) maps the stick for it.

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

/** The default pitch range: 5° under the horizon to 80° (almost top-down). */
export const ORBIT_MIN_PITCH = -5 * DEG;
export const ORBIT_MAX_PITCH = 80 * DEG;

export interface OrbitSettings {
   /** the start (and recenter) pose */
   yaw: number;
   pitch: number;
   distance: number;
   /** clamps (rad, m) */
   minPitch: number;
   maxPitch: number;
   minDistance: number;
   maxDistance: number;
   /** easing rate of the view towards the target (1/s); higher = snappier */
   damping: number;
   /** the recenter's easing rate (1/s) while it swings round */
   recenterDamping: number;
   /** auto-follow: swing behind the travel direction after `autoFollowDelay` s without manual input */
   autoFollow: boolean;
   autoFollowDelay: number;
   /** auto-follow turn rate (1/s, an easing rate on the yaw error) at full speed */
   autoFollowRate: number;
   /** travel speeds (m/s): no follow under `autoFollowMinSpeed`, full rate from `autoFollowFullSpeed` */
   autoFollowMinSpeed: number;
   autoFollowFullSpeed: number;
   /** auto-follow never swings round when the hero runs towards the camera: only errors under this (rad) */
   autoFollowMaxAngle: number;
   /** manual rates: drag (rad per px), keys (rad/s), wheel / pinch (zoom factor per px of wheel) */
   dragYawPerPx: number;
   dragPitchPerPx: number;
   keyYawRate: number;
   keyPitchRate: number;
   wheelZoomPerPx: number;
}

export const DEFAULT_ORBIT: OrbitSettings = {
   yaw: 0,
   pitch: 24 * DEG,
   distance: 7.5,
   minPitch: ORBIT_MIN_PITCH,
   maxPitch: ORBIT_MAX_PITCH,
   minDistance: 3.5,
   maxDistance: 16,
   damping: 12,
   recenterDamping: 6,
   autoFollow: true,
   autoFollowDelay: 2.5,
   autoFollowRate: 1.1,
   autoFollowMinSpeed: 1.5,
   autoFollowFullSpeed: 5,
   autoFollowMaxAngle: 110 * DEG,
   dragYawPerPx: 0.009,
   dragPitchPerPx: 0.006,
   keyYawRate: 2.2,
   keyPitchRate: 1.2,
   wheelZoomPerPx: 0.0015,
};

export interface OrbitState {
   readonly settings: OrbitSettings;
   /** the target (what input set) */
   yaw: number;
   pitch: number;
   distance: number;
   /** the view (eased; what the camera draws and what movement reads) */
   viewYaw: number;
   viewPitch: number;
   viewDistance: number;
   /** seconds since the last manual input (rotate, zoom, recenter) */
   idle: number;
   /** a recenter is swinging the view round (eases with recenterDamping until it arrives) */
   recentering: boolean;
   /** how many manual rotations so far (the first-time hint hides on the first) */
   manualTurns: number;
}

/** (-PI, PI] */
export function wrapAngle(a: number): number {
   if (!Number.isFinite(a)) return 0;
   let r = a % TAU;
   if (r <= -Math.PI) r += TAU;
   else if (r > Math.PI) r -= TAU;
   return r;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function createOrbit(settings: Partial<OrbitSettings> = {}): OrbitState {
   const s: OrbitSettings = { ...DEFAULT_ORBIT, ...settings };
   s.maxPitch = Math.max(s.minPitch, s.maxPitch);
   s.maxDistance = Math.max(s.minDistance, s.maxDistance);
   const yaw = wrapAngle(s.yaw);
   const pitch = clamp(s.pitch, s.minPitch, s.maxPitch);
   const distance = clamp(s.distance, s.minDistance, s.maxDistance);
   return { settings: s, yaw, pitch, distance, viewYaw: yaw, viewPitch: pitch, viewDistance: distance, idle: Number.POSITIVE_INFINITY, recentering: false, manualTurns: 0 };
}

/** Manual rotation by (dYaw, dPitch) rad. Manual input always wins: it cancels a recenter and restarts the auto-follow delay. */
export function orbitRotate(o: OrbitState, dYaw: number, dPitch: number): void {
   if (!Number.isFinite(dYaw) || !Number.isFinite(dPitch) || (dYaw === 0 && dPitch === 0)) return;
   o.yaw = wrapAngle(o.yaw + dYaw);
   o.pitch = clamp(o.pitch + dPitch, o.settings.minPitch, o.settings.maxPitch);
   o.idle = 0;
   o.recentering = false;
   o.manualTurns++;
}

/** Manual zoom: the distance times `factor` (> 1 = farther), clamped. */
export function orbitZoom(o: OrbitState, factor: number): void {
   if (!(factor > 0) || !Number.isFinite(factor) || factor === 1) return;
   o.distance = clamp(o.distance * factor, o.settings.minDistance, o.settings.maxDistance);
   o.idle = 0;
}

/**
 * Recenter behind the hero: the target swings to `yaw` (the camera yaw behind the hero; default the
 * settings' start yaw) at the start pitch, the short way round. The distance stays the player's zoom.
 */
export function orbitRecenter(o: OrbitState, yaw = o.settings.yaw): void {
   o.yaw = wrapAngle(Number.isFinite(yaw) ? yaw : o.settings.yaw);
   o.pitch = clamp(o.settings.pitch, o.settings.minPitch, o.settings.maxPitch);
   o.recentering = true;
   // a recenter is manual input, but auto-follow may carry on at once after it
   o.idle = o.settings.autoFollowDelay;
}

/** Puts target and view on a pose at once (no easing): a handover from another camera. */
export function orbitSnap(o: OrbitState, yaw: number, pitch: number, distance: number): void {
   o.yaw = o.viewYaw = wrapAngle(yaw);
   o.pitch = o.viewPitch = clamp(pitch, o.settings.minPitch, o.settings.maxPitch);
   o.distance = o.viewDistance = clamp(distance, o.settings.minDistance, o.settings.maxDistance);
   o.recentering = false;
}

/** The camera yaw that looks along a travel direction (x, z): the camera sits behind it. */
export function yawBehind(x: number, z: number): number {
   return Math.atan2(-x, -z);
}

/**
 * One step of `dt` s. `travelX/Z` (m/s, world) is the hero's horizontal velocity for the auto-follow
 * (pass 0, 0 when there is none). Eases the view towards the target.
 */
export function stepOrbit(o: OrbitState, dt: number, travelX = 0, travelZ = 0, autoFollow = o.settings.autoFollow): void {
   if (!(dt > 0)) return;
   const s = o.settings;
   o.idle += dt;
   if (autoFollow && !o.recentering && o.idle >= s.autoFollowDelay) {
      const speed = Math.hypot(travelX, travelZ);
      if (speed > s.autoFollowMinSpeed) {
         const err = wrapAngle(yawBehind(travelX, travelZ) - o.yaw);
         if (Math.abs(err) < s.autoFollowMaxAngle) {
            const span = Math.max(1e-6, s.autoFollowFullSpeed - s.autoFollowMinSpeed);
            const strength = Math.min(1, (speed - s.autoFollowMinSpeed) / span);
            o.yaw = wrapAngle(o.yaw + err * (1 - Math.exp(-s.autoFollowRate * strength * dt)));
         }
      }
   }
   const rate = o.recentering ? s.recenterDamping : s.damping;
   const k = 1 - Math.exp(-rate * dt);
   const dy = wrapAngle(o.yaw - o.viewYaw);
   o.viewYaw = wrapAngle(o.viewYaw + dy * k);
   o.viewPitch += (o.pitch - o.viewPitch) * k;
   o.viewDistance += (o.distance - o.viewDistance) * (1 - Math.exp(-s.damping * dt));
   if (o.recentering && Math.abs(wrapAngle(o.yaw - o.viewYaw)) < 0.01 && Math.abs(o.pitch - o.viewPitch) < 0.01) o.recentering = false;
}

/** The unit direction from the pivot to the camera for a yaw and pitch (into `out`). */
export function orbitDirection(yaw: number, pitch: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const flat = Math.cos(pitch);
   out.x = Math.sin(yaw) * flat;
   out.y = Math.sin(pitch);
   out.z = Math.cos(yaw) * flat;
   return out;
}

/** The camera position for a pivot and a view pose (into `out`). */
export function orbitPosition(
   px: number,
   py: number,
   pz: number,
   yaw: number,
   pitch: number,
   distance: number,
   out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
   orbitDirection(yaw, pitch, out);
   out.x = px + out.x * distance;
   out.y = py + out.y * distance;
   out.z = pz + out.z * distance;
   return out;
}

/** yaw, pitch and distance of a camera position seen from a pivot (the inverse of orbitPosition). */
export function orbitPoseOf(px: number, py: number, pz: number, cx: number, cy: number, cz: number): { yaw: number; pitch: number; distance: number } {
   const dx = cx - px;
   const dy = cy - py;
   const dz = cz - pz;
   const distance = Math.hypot(dx, dy, dz);
   if (!(distance > 1e-9)) return { yaw: 0, pitch: 0, distance: 0 };
   return { yaw: Math.atan2(dx, dz), pitch: Math.asin(clamp(dy / distance, -1, 1)), distance };
}
