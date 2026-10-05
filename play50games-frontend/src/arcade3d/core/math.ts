// Small pure helpers for rules.ts files. Owned by Claude. No three.js, React or DOM.
// rules.ts must be deterministic: take randomness only from createRng(seed), and let the Scene
// draw the seed (randomSeed()) once per run.

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
