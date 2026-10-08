import type { Vec3Like as Vec3 } from "../collision";
import { nearestS, pointAt, type Path } from "../path";
import type { Agent } from "./steering";
export interface PatrolState {
   index: number;
   wait: number;
   mode: "patrol" | "investigate" | "return";
   target: Vec3;
   lookPhase?: number;
   lookYaw?: number;
}
export interface PatrolOptions { speed: number; wait?: number; investigateWait?: number; lookAngle?: number; lookSpeed?: number }
export function investigate(state: PatrolState, point: Vec3): void {
   state.target.x = point.x; state.target.y = point.y; state.target.z = point.z;
   state.mode = "investigate"; state.wait = 0; state.lookPhase = 0;
}
/** Moves directly between sampled waypoints. Investigation returns to nearest route point, then resumes index. */
export function stepPatrol(agent: Agent, state: PatrolState, route: Path, dt: number, opts: PatrolOptions): void {
   if (!(dt > 0) || !(opts.speed > 0)) return;
   let remaining = dt;
   // Only cap zero-time transitions; positive-duration travel consumes the entire frame.
   let stalled = 0;
   while (remaining > 0) {
      const before = remaining;
      if (state.wait > 0) {
         const elapsed = Math.min(state.wait, remaining);
         state.wait = Math.max(0, state.wait - elapsed); remaining -= elapsed;
         state.lookYaw ??= agent.yaw;
         state.lookPhase = (state.lookPhase ?? 0) + elapsed * (opts.lookSpeed ?? 2);
         agent.yaw = (state.lookYaw ?? agent.yaw) + Math.sin(state.lookPhase) * (opts.lookAngle ?? 0.4);
         agent.vx = 0; agent.vy = 0; agent.vz = 0;
         if (state.wait > 0) return;
         if (state.mode === "investigate") {
            state.mode = "return";
            pointAt(route, nearestS(route, agent), state.target);
         }
      }
      state.index = ((state.index % route.points.length) + route.points.length) % route.points.length;
      const target = state.mode === "patrol" ? route.points[state.index] : state.target;
      const dx = target.x - agent.x, dy = target.y - agent.y, dz = target.z - agent.z, distance = Math.hypot(dx, dy, dz);
      const time = distance / opts.speed, travel = Math.min(time, remaining);
      const scale = distance > 0 ? opts.speed / distance : 0;
      agent.vx = dx * scale; agent.vy = dy * scale; agent.vz = dz * scale;
      if (dx !== 0 || dz !== 0) agent.yaw = Math.atan2(dx, dz);
      agent.x += agent.vx * travel; agent.y += agent.vy * travel; agent.z += agent.vz * travel;
      remaining = Math.max(0, remaining - travel);
      if (travel < time) return;
      agent.x = target.x; agent.y = target.y; agent.z = target.z;
      agent.vx = 0; agent.vy = 0; agent.vz = 0;
      state.lookYaw = agent.yaw; state.lookPhase = 0;
      if (state.mode === "investigate") {
         state.wait = Math.max(0, opts.investigateWait ?? opts.wait ?? 0);
         if (state.wait === 0) { state.mode = "return"; pointAt(route, nearestS(route, agent), state.target); }
      } else if (state.mode === "return") state.mode = "patrol";
      else { state.index = (state.index + 1) % route.points.length; state.wait = Math.max(0, opts.wait ?? 0); }
      stalled = remaining === before ? stalled + 1 : 0;
      if (stalled > route.points.length + 2) return;
   }
}
