// Small pure helpers for rules.ts files. Owned by Claude. No three.js, React or DOM.
// rules.ts must be deterministic: take randomness only from createRng(seed) (or its closure-free
// twin rngNext({ s: seed })), and let the Scene draw the seed (randomSeed()) once per run.
// Yaw convention (as in core/view.ts): radians around +y, 0 = camera on the +z side looking towards -z.

/** mulberry32: a tiny, fast seeded generator, good enough for level layouts. Floats in [0, 1). */
export function createRng(seed: number): () => number {
   let a = seed >>> 0;
   return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
}

/** The state of a scalar generator (rngNext): one number, kept in your own run or scratch object. */
export interface RngState {
   s: number;
}

/**
 * The same mulberry32 as createRng, without a closure: advances `state` in place and returns the
 * next float in [0, 1). `{ s: seed }` gives exactly createRng(seed)'s sequence (any seed works,
 * it is taken as uint32 like createRng does), so a fill loop can keep its generator in
 * preallocated scratch and reset it with `state.s = seed` instead of creating one per row.
 */
export function rngNext(state: RngState): number {
   const a = ((state.s >>> 0) + 0x6d2b79f5) >>> 0;
   state.s = a;
   let t = a;
   t = Math.imul(t ^ (t >>> 15), t | 1);
   t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
   return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A random 32-bit seed for a new run (Scene only: rules.ts never calls Math.random). */
export function randomSeed(): number {
   return Math.floor(Math.random() * 2 ** 32);
}

/** Turns angle `from` towards `to` (radians) the short way round, eased by `amount` (0..1). */
export function turnTowards(from: number, to: number, amount: number): number {
   let diff = (to - from) % (2 * Math.PI);
   if (diff > Math.PI) diff -= 2 * Math.PI;
   if (diff < -Math.PI) diff += 2 * Math.PI;
   return from + diff * amount;
}

/**
 * Screen-relative move input (useInput: moveX right = 1, moveY up = -1) -> a world direction on
 * the ground for a camera at `cameraYaw`. Up always means "away from the camera" and right means
 * screen-right, also when a portrait layout turns the camera. Pass `out` to avoid allocating.
 * Pure, so rules.ts can map input itself (core/view.ts and core/input.tsx re-export it).
 */
export function inputToWorld(
   moveX: number,
   moveY: number,
   cameraYaw: number,
   out: { x: number; z: number } = { x: 0, z: 0 }
): { x: number; z: number } {
   const c = Math.cos(cameraYaw);
   const s = Math.sin(cameraYaw);
   out.x = c * moveX + s * moveY;
   out.z = -s * moveX + c * moveY;
   return out;
}
