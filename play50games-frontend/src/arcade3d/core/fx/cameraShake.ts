// Camera shake: a decaying "trauma" impulse turned into a small, smooth camera offset. Pure (no
// three.js); FxLayer applies the offset along the camera's own right / up axes right after the
// camera rigs ran, and takes it off again at the start of the next frame, so CameraRig (static or
// follow) always works from the unshaken camera.

/** offset (m) at full trauma; the offset grows with trauma² so small hits stay subtle */
export const SHAKE_MAX_OFFSET = 0.35;
/** trauma lost per second (1 = a full shake fades in 1 / SHAKE_DECAY s) */
export const SHAKE_DECAY = 1.8;

export interface ShakeState {
   /** 0..1 */
   trauma: number;
   /** seconds of shaking, drives the wobble */
   t: number;
   /** this frame's offset in camera space (m): right, up */
   x: number;
   y: number;
}

export function createShake(): ShakeState {
   return { trauma: 0, t: 0, x: 0, y: 0 };
}

/** Adds an impulse (0..1; 0.3 = a bump, 1 = an explosion). Ignored when the player prefers reduced motion. */
export function addShake(state: ShakeState, amount: number, reducedMotion: boolean): void {
   if (reducedMotion || !(amount > 0)) return;
   state.trauma = Math.min(1, state.trauma + amount);
}

/** Advances by `dt` s (0 = frozen: the offset stays) and writes this frame's offset into x / y. */
export function stepShake(state: ShakeState, dt: number): void {
   if (dt > 0) {
      state.t += dt;
      state.trauma = Math.max(0, state.trauma - SHAKE_DECAY * dt);
   }
   if (state.trauma <= 0) {
      state.x = 0;
      state.y = 0;
      return;
   }
   const amp = state.trauma * state.trauma * SHAKE_MAX_OFFSET;
   const t = state.t;
   // two incommensurate sines per axis: a smooth, non-repeating wobble without noise tables
   state.x = amp * (0.6 * Math.sin(t * 37.1) + 0.4 * Math.sin(t * 59.3 + 1.7));
   state.y = amp * (0.6 * Math.sin(t * 43.7 + 0.5) + 0.4 * Math.sin(t * 71.9 + 2.9));
}

export function clearShake(state: ShakeState): void {
   state.trauma = 0;
   state.t = 0;
   state.x = 0;
   state.y = 0;
}
