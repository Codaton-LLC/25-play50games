export interface BodyOffset { y: number; roll: number; yaw: number; squash: number }
function reset(out: BodyOffset): BodyOffset {
   out.y = 0; out.roll = 0; out.yaw = 0; out.squash = 1;
   return out;
}
/** Phase is radians; squash is a vertical scale, 1 at rest. */
export function hop(phase: number, height: number, out: BodyOffset): BodyOffset {
   reset(out);
   const lift = Math.max(0, Math.sin(phase));
   out.y = lift * height; out.squash = 1 - 0.15 * Math.max(0, -Math.sin(phase));
   return out;
}
export function waddle(phase: number, amount: number, out: BodyOffset): BodyOffset {
   reset(out);
   out.roll = Math.sin(phase) * amount;
   out.y = Math.abs(Math.sin(phase)) * amount * 0.25;
   out.yaw = Math.sin(phase * 2) * amount * 0.3;
   return out;
}
export function hover(t: number, amount: number, out: BodyOffset): BodyOffset {
   reset(out);
   out.y = Math.sin(t * 2) * amount; out.roll = Math.sin(t * 1.3) * amount * 0.1;
   return out;
}
export function bank(lateralAccel: number, maxRoll: number): number {
   return -Math.max(-Math.abs(maxRoll), Math.min(Math.abs(maxRoll), Math.atan(lateralAccel / 9.81)));
}
export interface SpringState { x: number; v: number }
/** Exact damped oscillator for a constant target. damping < 0 selects critical damping. */
export function spring(state: SpringState, target: number, stiffness: number, damping: number, dt: number): number {
   if (!(dt > 0) || !Number.isFinite(dt)) return state.x;
   const k = Math.max(0, stiffness), c = damping < 0 ? 2 * Math.sqrt(k) : damping;
   const q = state.x - target, v = state.v, a = c / 2, disc = a * a - k;
   let x: number, velocity: number;
   if (Math.abs(disc) < 1e-10) {
      const e = Math.exp(-a * dt), b = v + a * q;
      x = (q + b * dt) * e; velocity = (v - a * b * dt) * e;
   } else if (disc < 0) {
      const w = Math.sqrt(-disc), e = Math.exp(-a * dt), s = Math.sin(w * dt), co = Math.cos(w * dt);
      x = e * (q * co + (v + a * q) * s / w);
      velocity = e * (v * co - (a * v + k * q) * s / w);
   } else {
      const root = Math.sqrt(disc), r1 = -a + root, r2 = -a - root;
      const b1 = (v - r2 * q) / (r1 - r2), b2 = q - b1;
      const e1 = Math.exp(r1 * dt), e2 = Math.exp(r2 * dt);
      x = b1 * e1 + b2 * e2; velocity = r1 * b1 * e1 + r2 * b2 * e2;
   }
   state.x = target + x; state.v = velocity;
   return state.x;
}
/** Volume-preserving scale. amount is vertical scale (> 0); output can be reused. */
export function squashStretch(amount: number, out: { x: number; y: number; z: number }): typeof out {
   if (!(amount > 0)) throw new RangeError("scale must be positive");
   out.y = amount; out.x = out.z = 1 / Math.sqrt(amount);
   return out;
}
