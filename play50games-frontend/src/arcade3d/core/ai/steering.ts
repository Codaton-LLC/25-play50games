import type { Vec3Like as Vec3 } from "../collision";
export interface Agent extends Vec3 { vx: number; vy: number; vz: number; yaw: number }
/** Steering acceleration = desired velocity minus current velocity, unit response time. */
export function seek(agent: Agent, target: Vec3, maxSpeed: number, out: Vec3): Vec3 {
   const x = target.x - agent.x, y = target.y - agent.y, z = target.z - agent.z;
   const d = Math.hypot(x, y, z), scale = d ? maxSpeed / d : 0;
   out.x = x * scale - agent.vx; out.y = y * scale - agent.vy; out.z = z * scale - agent.vz;
   return out;
}
export function arrive(agent: Agent, target: Vec3, maxSpeed: number, slowRadius: number, out: Vec3): Vec3 {
   const distance = Math.hypot(target.x - agent.x, target.y - agent.y, target.z - agent.z);
   return seek(agent, target, maxSpeed * (slowRadius > 0 ? Math.min(1, distance / slowRadius) : 1), out);
}
export function flee(agent: Agent, target: Vec3, maxSpeed: number, out: Vec3): Vec3 {
   const x = agent.x - target.x, y = agent.y - target.y, z = agent.z - target.z;
   const d = Math.hypot(x, y, z), scale = d ? maxSpeed / d : 0;
   out.x = x * scale - agent.vx; out.y = y * scale - agent.vy; out.z = z * scale - agent.vz;
   return out;
}
export interface WanderState { angle: number }
/** Stateful yaw jitter, radians/sec; yaw 0 faces +Z. rng supplies [0,1). */
export function wander(agent: Agent, state: WanderState, rng: () => number, maxSpeed: number, jitter: number, dt: number, out: Vec3): Vec3 {
   state.angle += (rng() * 2 - 1) * jitter * dt;
   out.x = Math.sin(agent.yaw + state.angle) * maxSpeed - agent.vx;
   out.y = -agent.vy; out.z = Math.cos(agent.yaw + state.angle) * maxSpeed - agent.vz;
   return out;
}
/** Inverse-distance repulsion, capped at maxSpeed. Coincident neighbors use a deterministic +X direction. */
export function separate(agent: Agent, neighbors: readonly Vec3[], radius: number, maxSpeed: number, out: Vec3): Vec3 {
   let x = 0, y = 0, z = 0;
   for (let i = 0; i < neighbors.length; i++) {
      const n = neighbors[i];
      if (n === agent) continue;
      const dx = agent.x - n.x, dy = agent.y - n.y, dz = agent.z - n.z, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < radius * radius) {
         if (d2 === 0) x += 1; else { x += dx / d2; y += dy / d2; z += dz / d2; }
      }
   }
   const d = Math.hypot(x, y, z), scale = d > maxSpeed && d > 0 ? maxSpeed / d : 1;
   out.x = x * scale; out.y = y * scale; out.z = z * scale;
   return out;
}
