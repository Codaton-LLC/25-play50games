// A short visible hand-off: an item flies on an arc from where it was to where it goes (a key into
// the hand, a bale onto the trailer, a product into the cart) instead of vanishing. Pure and
// allocation-free; <Toss> (Toss.tsx) draws it, and a game can drive its own copies with it.

export interface TossPoint {
   x: number;
   y: number;
   z: number;
}

export interface TossState {
   active: boolean;
   /** 0..1 of the flight */
   t: number;
   duration: number;
   height: number;
   from: TossPoint;
   /** read every step: a live point (the hero, the cart) */
   to: TossPoint;
   scaleFrom: number;
   scaleTo: number;
}

export interface TossOptions {
   /** flight time, s (default 0.45) */
   duration?: number;
   /** arc height over the straight line, m (default 0.9) */
   height?: number;
   /** scale at the start and the end (default 1 -> 0.45: it shrinks into the hand / cart) */
   scaleFrom?: number;
   scaleTo?: number;
}

export const TOSS_DURATION = 0.45;
export const TOSS_HEIGHT = 0.9;

export function createToss(): TossState {
   return { active: false, t: 0, duration: TOSS_DURATION, height: TOSS_HEIGHT, from: { x: 0, y: 0, z: 0 }, to: { x: 0, y: 0, z: 0 }, scaleFrom: 1, scaleTo: 0.45 };
}

/** Starts a flight from a copy of `from` to the live point `to`. */
export function startToss(state: TossState, from: TossPoint, to: TossPoint, options?: TossOptions): void {
   state.active = true;
   state.t = 0;
   state.duration = Math.max(0.05, options?.duration ?? TOSS_DURATION);
   state.height = options?.height ?? TOSS_HEIGHT;
   state.from.x = from.x;
   state.from.y = from.y;
   state.from.z = from.z;
   state.to = to;
   state.scaleFrom = options?.scaleFrom ?? 1;
   state.scaleTo = options?.scaleTo ?? 0.45;
}

export interface TossFrame extends TossPoint {
   scale: number;
}

/**
 * Where the item is at flight fraction `t` (0..1): an ease-out along the line plus a parabola
 * (4·h·t·(1−t)) on top, the scale eased between the two ends.
 */
export function tossAt(from: TossPoint, to: TossPoint, t: number, height: number, scaleFrom: number, scaleTo: number, out: TossFrame): TossFrame {
   const k = Math.min(1, Math.max(0, t));
   const e = 1 - (1 - k) * (1 - k);
   out.x = from.x + (to.x - from.x) * e;
   out.z = from.z + (to.z - from.z) * e;
   out.y = from.y + (to.y - from.y) * e + 4 * height * k * (1 - k);
   out.scale = scaleFrom + (scaleTo - scaleFrom) * e;
   return out;
}

/** Advances by `dt` s; writes the pose into `out` and returns whether the flight is still on. */
export function stepToss(state: TossState, dt: number, out: TossFrame): boolean {
   if (!state.active) return false;
   if (dt > 0) state.t = Math.min(1, state.t + dt / state.duration);
   tossAt(state.from, state.to, state.t, state.height, state.scaleFrom, state.scaleTo, out);
   if (state.t >= 1) state.active = false;
   return true;
}
