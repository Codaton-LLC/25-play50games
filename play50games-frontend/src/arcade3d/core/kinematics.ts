import type { Vec3Like as Vec3 } from "./collision";
import { spring, type SpringState } from "./motion";

export interface CircleBodyXZ { x: number; z: number; vx: number; vz: number; radius: number }
export interface SegmentXZ {
   a: { x: number; z: number };
   b: { x: number; z: number };
   pivot?: { x: number; z: number };
   /** Radians/sec about +Y: vx = omega * relativeZ, vz = -omega * relativeX. */
   omega?: number;
   vx?: number;
   vz?: number;
}
export interface SegmentContact { x: number; z: number; nx: number; nz: number; depth: number; vx: number; vz: number }

/** Discrete contact, including endpoints. Pass scratch output to avoid allocation. */
export function circleSegmentXZ(body: CircleBodyXZ, segment: SegmentXZ, out?: SegmentContact): SegmentContact | null {
   const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z, l2 = dx * dx + dz * dz;
   const t = l2 ? Math.max(0, Math.min(1, ((body.x - segment.a.x) * dx + (body.z - segment.a.z) * dz) / l2)) : 0;
   const x = segment.a.x + dx * t, z = segment.a.z + dz * t;
   const rx = body.x - x, rz = body.z - z, distance = Math.hypot(rx, rz);
   if (distance > body.radius) return null;
   let nx = distance ? rx / distance : l2 ? -dz / Math.sqrt(l2) : 1;
   let nz = distance ? rz / distance : l2 ? dx / Math.sqrt(l2) : 0;
   const vx = (segment.vx ?? 0) + (segment.omega ?? 0) * (z - (segment.pivot?.z ?? segment.a.z));
   const vz = (segment.vz ?? 0) - (segment.omega ?? 0) * (x - (segment.pivot?.x ?? segment.a.x));
   if (distance === 0 && (body.vx - vx) * nx + (body.vz - vz) * nz > 0) { nx = -nx; nz = -nz; }
   const o = out ?? { x: 0, z: 0, nx: 0, nz: 0, depth: 0, vx: 0, vz: 0 };
   o.x = x; o.z = z; o.nx = nx; o.nz = nz; o.depth = body.radius - distance; o.vx = vx; o.vz = vz;
   return o;
}

/** Resolves an existing contact, no allocation. friction is the fraction of tangential velocity removed. */
export function resolveCircleSegmentXZ(body: CircleBodyXZ, contact: SegmentContact, restitution = 0, friction = 0): void {
   body.x += contact.nx * contact.depth; body.z += contact.nz * contact.depth;
   const rx = body.vx - contact.vx, rz = body.vz - contact.vz;
   const normal = rx * contact.nx + rz * contact.nz;
   if (normal >= 0) return;
   const e = Math.max(0, Math.min(1, restitution)), f = Math.max(0, Math.min(1, friction));
   const tx = rx - normal * contact.nx, tz = rz - normal * contact.nz;
   body.vx = contact.vx - e * normal * contact.nx + tx * (1 - f);
   body.vz = contact.vz - e * normal * contact.nz + tz * (1 - f);
}

/** Rotates endpoints around the pivot by deltaAngle, in place. */
export function rotateSegmentXZ(segment: SegmentXZ, deltaAngle: number): void {
   if (!segment.pivot) throw new RangeError("A rotating segment needs a pivot");
   const px = segment.pivot.x, pz = segment.pivot.z, c = Math.cos(deltaAngle), s = Math.sin(deltaAngle);
   const ax = segment.a.x - px, az = segment.a.z - pz, bx = segment.b.x - px, bz = segment.b.z - pz;
   segment.a.x = px + c * ax + s * az; segment.a.z = pz - s * ax + c * az;
   segment.b.x = px + c * bx + s * bz; segment.b.z = pz - s * bx + c * bz;
}

/** Equal substeps <= maxStep, consumes all dt; reuse fn rather than creating it per frame. */
export function substep(dt: number, maxStep: number, fn: (dt: number) => void): number {
   if (!Number.isFinite(dt) || dt < 0 || !Number.isFinite(maxStep) || maxStep <= 0) throw new RangeError("Invalid timestep");
   const n = Math.ceil(dt / maxStep);
   for (let i = 0; i < n; i++) fn(dt / n);
   return n;
}
export interface RigidBody2D { x: number; y: number; angle: number; vx: number; vy: number; omega: number }
export interface RigidBodyForces { thrust: number; torque: number; gravity: number; mass?: number; inertia?: number }
/** Angle 0 thrusts along +Y, positive angles rotate towards -X. Semi-implicit Euler. */
export function stepRigidBody2D(body: RigidBody2D, dt: number, forces: RigidBodyForces): void {
   const mass = forces.mass ?? 1, inertia = forces.inertia ?? 1;
   if (!(mass > 0) || !(inertia > 0)) throw new RangeError("mass and inertia must be positive");
   body.vx -= Math.sin(body.angle) * forces.thrust / mass * dt;
   body.vy += (Math.cos(body.angle) * forces.thrust / mass - forces.gravity) * dt;
   body.omega += forces.torque / inertia * dt;
   body.x += body.vx * dt; body.y += body.vy * dt; body.angle += body.omega * dt;
}
export interface PendulumParams { length: number; gravity: number; damping: number }
/** Linear small-angle pendulum: state.x = angle (radians), state.v = angular speed. */
export function stepPendulum(state: SpringState, dt: number, params: PendulumParams, pivotAcceleration = 0): void {
   if (!(params.length > 0) || !(params.gravity > 0)) throw new RangeError("length and gravity must be positive");
   spring(state, -pivotAcceleration / params.gravity, params.gravity / params.length, params.damping, dt);
}
export interface Pendulum2D { x: SpringState; z: SpringState }
export function stepPendulum2D(state: Pendulum2D, dt: number, params: PendulumParams, pivotAcceleration: Pick<Vec3, "x" | "z">): void {
   stepPendulum(state.x, dt, params, pivotAcceleration.x);
   stepPendulum(state.z, dt, params, pivotAcceleration.z);
}
