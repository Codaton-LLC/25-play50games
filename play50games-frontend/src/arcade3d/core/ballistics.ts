import type { Vec3Like as Vec3 } from "./collision";
export type { Vec3Like as Vec3 } from "./collision";

export interface BallisticParams { gravity: number; wind?: { x: number; z: number } }
export interface Projectile { x: number; y: number; z: number; vx: number; vy: number; vz: number }

/** Constant-acceleration intercept. Gravity is a nonnegative downward magnitude. */
export function solveLaunch(from: Vec3, to: Vec3, speed: number, p: BallisticParams, highArc = false, out?: Vec3): Vec3 | null {
   const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
   const ax = p.wind?.x ?? 0, ay = -p.gravity, az = p.wind?.z ?? 0;
   const d2 = dx * dx + dy * dy + dz * dz;
   const a2 = ax * ax + ay * ay + az * az;
   const b = speed * speed + dx * ax + dy * ay + dz * az;
   if (!(speed > 0) || !Number.isFinite(speed) || !Number.isFinite(p.gravity) || p.gravity < 0 || !Number.isFinite(d2) || !Number.isFinite(a2) || d2 === 0) return null;
   let t2: number;
   if (a2 === 0) t2 = d2 / (speed * speed);
   else {
      const disc = b * b - a2 * d2;
      if (disc < 0 || b <= 0) return null;
      const root = Math.sqrt(disc);
      t2 = highArc ? 2 * (b + root) / a2 : 2 * d2 / (b + root);
   }
   return launchForTime(from, to, Math.sqrt(t2), p, out);
}

export function launchForTime(from: Vec3, to: Vec3, flightTime: number, p: BallisticParams, out?: Vec3): Vec3 {
   if (!(flightTime > 0) || !Number.isFinite(flightTime)) throw new RangeError("flightTime must be finite and positive");
   const x = (to.x - from.x) / flightTime - (p.wind?.x ?? 0) * flightTime / 2;
   const y = (to.y - from.y) / flightTime + p.gravity * flightTime / 2;
   const z = (to.z - from.z) / flightTime - (p.wind?.z ?? 0) * flightTime / 2;
   const o = out ?? { x: 0, y: 0, z: 0 };
   o.x = x; o.y = y; o.z = z;
   return o;
}

export function stepProjectile(proj: Projectile, dt: number, p: BallisticParams): void {
   proj.vx += (p.wind?.x ?? 0) * dt;
   proj.vy -= p.gravity * dt;
   proj.vz += (p.wind?.z ?? 0) * dt;
   proj.x += proj.vx * dt; proj.y += proj.vy * dt; proj.z += proj.vz * dt;
}

/** Exact samples, including the initial point and interpolated ground contact. No scratch allocation. */
export function trajectoryPoints(proj: Readonly<Projectile>, p: BallisticParams, count: number, step: number, out: Float32Array, groundY = 0): number {
   if (!(step > 0)) throw new RangeError("step must be positive");
   const limit = Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), Math.floor(out.length / 3))) : 0;
   if (limit === 0) return 0;
   const end = groundTime(proj, p.gravity, groundY);
   for (let i = 0; i < limit; i++) {
      const t = end === null ? i * step : Math.min(i * step, end);
      out[i * 3] = proj.x + proj.vx * t + (p.wind?.x ?? 0) * t * t / 2;
      out[i * 3 + 1] = proj.y + proj.vy * t - p.gravity * t * t / 2;
      out[i * 3 + 2] = proj.z + proj.vz * t + (p.wind?.z ?? 0) * t * t / 2;
      if (end !== null && t >= end) { out[i * 3 + 1] = groundY; return i + 1; }
   }
   return limit;
}

function groundTime(p: Readonly<Projectile>, gravity: number, groundY: number): number | null {
   if (p.y < groundY || (p.y === groundY && p.vy <= 0)) return 0;
   if (gravity === 0) return p.vy < 0 ? (groundY - p.y) / p.vy : null;
   if (!(gravity > 0)) throw new RangeError("gravity must be nonnegative");
   const height = p.y - groundY;
   const root = Math.sqrt(p.vy * p.vy + 2 * gravity * height);
   return p.vy < 0 ? 2 * height / (root - p.vy) : (p.vy + root) / gravity;
}

/** Closed-form ground impact under constant acceleration, including wind. */
export function landingPoint(proj: Readonly<Projectile>, p: BallisticParams, groundY = 0, out?: Vec3): Vec3 | null {
   const t = groundTime(proj, p.gravity, groundY);
   if (t === null || !Number.isFinite(t)) return null;
   const o = out ?? { x: 0, y: 0, z: 0 };
   o.x = proj.x + proj.vx * t + (p.wind?.x ?? 0) * t * t / 2;
   o.y = groundY;
   o.z = proj.z + proj.vz * t + (p.wind?.z ?? 0) * t * t / 2;
   return o;
}
