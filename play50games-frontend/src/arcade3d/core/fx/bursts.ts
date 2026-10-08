// Particle bursts: the simulation behind useFx().burst (core/fx/FxLayer.tsx). Pure (no three.js,
// React or DOM) and allocation-free after createParticlePool(): every particle lives in
// preallocated typed arrays, alive ones packed at the front (0..count-1).
import { rngNext, type RngState } from "../math";

export const BURST_KINDS = ["sparkle", "puff", "splash", "debris", "confetti", "smoke", "sparks", "snow"] as const;
export type BurstKind = (typeof BURST_KINDS)[number];

export type BurstShape = "ico" | "octa" | "box" | "plane";
/** glow: unlit, additive (sparkles, sparks); soft: lit, see-through (puffs, smoke); solid: lit, opaque */
export type BurstLook = "glow" | "soft" | "solid";

export interface BurstStyle {
   /** the most particles of this kind alive at once (the pool size) */
   capacity: number;
   /** seconds, random in [min, max] */
   life: readonly [number, number];
   /** start speed m/s, random in [min, max] */
   speed: readonly [number, number];
   /** start directions: "sphere" = all round, a number = cone half-angle (rad) around +y */
   spread: "sphere" | number;
   /** m/s² along y (negative falls, positive rises) */
   gravity: number;
   /** velocity damping, 1/s */
   drag: number;
   /** scale at birth and at death (× the shape), shrunk to 0 at the very end */
   size: readonly [number, number];
   /** the most tumbling speed, rad/s */
   spin: number;
   /** start positions scattered within this radius (m) */
   jitter: number;
   colors: readonly string[];
   shape: BurstShape;
   /** the shape's size (m) at scale 1: x, y, z */
   dims: readonly [number, number, number];
   look: BurstLook;
   /** opacity of the "soft" and "glow" looks */
   opacity: number;
}

export const BURST_STYLES: Readonly<Record<BurstKind, Readonly<BurstStyle>>> = {
   sparkle: {
      capacity: 96, life: [0.45, 0.8], speed: [1.5, 3.5], spread: "sphere", gravity: -2, drag: 2.5,
      size: [1, 0.6], spin: 6, jitter: 0.1, colors: ["#fde68a", "#fbbf24", "#ffffff"],
      shape: "octa", dims: [0.18, 0.18, 0.18], look: "glow", opacity: 1,
   },
   puff: {
      capacity: 64, life: [0.45, 0.75], speed: [0.6, 1.6], spread: 1.4, gravity: 0.6, drag: 3.5,
      size: [0.7, 1.4], spin: 1.5, jitter: 0.15, colors: ["#f8fafc", "#e2e8f0", "#cbd5e1"],
      shape: "ico", dims: [0.28, 0.28, 0.28], look: "soft", opacity: 0.75,
   },
   splash: {
      capacity: 96, life: [0.5, 0.85], speed: [2, 4.2], spread: 0.6, gravity: -9.8, drag: 0.6,
      size: [1, 0.7], spin: 2, jitter: 0.15, colors: ["#e0f2fe", "#7dd3fc", "#38bdf8"],
      shape: "ico", dims: [0.14, 0.14, 0.14], look: "soft", opacity: 0.85,
   },
   debris: {
      capacity: 96, life: [0.8, 1.2], speed: [2, 5], spread: 0.9, gravity: -9.8, drag: 0.4,
      size: [1, 0.8], spin: 10, jitter: 0.12, colors: ["#78716c", "#a8a29e", "#57534e", "#92400e"],
      shape: "box", dims: [0.14, 0.1, 0.12], look: "solid", opacity: 1,
   },
   confetti: {
      capacity: 128, life: [1.4, 2], speed: [3, 6], spread: 0.55, gravity: -3, drag: 1.6,
      size: [1, 1], spin: 12, jitter: 0.1, colors: ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#facc15"],
      shape: "plane", dims: [0.18, 0.1, 1], look: "solid", opacity: 1,
   },
   smoke: {
      capacity: 64, life: [1.2, 2], speed: [0.3, 0.8], spread: 0.8, gravity: 0.8, drag: 1.2,
      size: [0.6, 1.8], spin: 0.8, jitter: 0.2, colors: ["#475569", "#64748b", "#334155"],
      shape: "ico", dims: [0.35, 0.35, 0.35], look: "soft", opacity: 0.55,
   },
   sparks: {
      capacity: 96, life: [0.25, 0.5], speed: [4, 7], spread: "sphere", gravity: -9.8, drag: 1,
      size: [1, 0.5], spin: 4, jitter: 0.05, colors: ["#fb923c", "#fde047", "#fff7ed"],
      shape: "octa", dims: [0.08, 0.08, 0.08], look: "glow", opacity: 1,
   },
   snow: {
      capacity: 96, life: [1, 1.6], speed: [0.5, 1.5], spread: 1.2, gravity: -1.5, drag: 2,
      size: [1, 0.8], spin: 2, jitter: 0.2, colors: ["#ffffff", "#f1f5f9", "#e0f2fe"],
      shape: "ico", dims: [0.1, 0.1, 0.1], look: "glow", opacity: 0.95,
   },
};

export interface ParticlePool {
   readonly capacity: number;
   /** alive particles, packed at the front */
   count: number;
   /** where the next particle goes once the pool is full (the oldest are overwritten in turn) */
   cursor: number;
   readonly px: Float32Array;
   readonly py: Float32Array;
   readonly pz: Float32Array;
   readonly vx: Float32Array;
   readonly vy: Float32Array;
   readonly vz: Float32Array;
   readonly age: Float32Array;
   readonly life: Float32Array;
   /** tumbling axis (unit) and angle */
   readonly ax: Float32Array;
   readonly ay: Float32Array;
   readonly az: Float32Array;
   readonly angle: Float32Array;
   readonly spin: Float32Array;
   readonly color: Uint8Array;
   readonly rng: RngState;
}

export function createParticlePool(capacity: number, seed = 0x5eed): ParticlePool {
   const n = Math.max(1, Math.floor(capacity));
   const f = () => new Float32Array(n);
   return {
      capacity: n,
      count: 0,
      cursor: 0,
      px: f(), py: f(), pz: f(),
      vx: f(), vy: f(), vz: f(),
      age: f(), life: f(),
      ax: f(), ay: f(), az: f(), angle: f(), spin: f(),
      color: new Uint8Array(n),
      rng: { s: seed },
   };
}

const between = (rng: RngState, range: readonly [number, number]) => range[0] + (range[1] - range[0]) * rngNext(rng);

/**
 * Emits `count` particles of `style` at (x, y, z). When the pool is full the oldest-placed slots
 * are reused in turn. Returns how many were emitted (at most the pool's capacity).
 */
export function emitBurst(pool: ParticlePool, style: Readonly<BurstStyle>, x: number, y: number, z: number, count: number): number {
   const n = Math.min(pool.capacity, Math.max(0, Math.floor(count)));
   const rng = pool.rng;
   const colors = Math.max(1, style.colors.length);
   for (let k = 0; k < n; k++) {
      let i: number;
      if (pool.count < pool.capacity) {
         i = pool.count;
         pool.count += 1;
      } else {
         i = pool.cursor;
         pool.cursor = (pool.cursor + 1) % pool.capacity;
      }
      // direction: uniform on the sphere, or within a cone around +y
      let dx: number;
      let dy: number;
      let dz: number;
      const phi = 2 * Math.PI * rngNext(rng);
      if (style.spread === "sphere") {
         dy = 2 * rngNext(rng) - 1;
         const r = Math.sqrt(Math.max(0, 1 - dy * dy));
         dx = r * Math.cos(phi);
         dz = r * Math.sin(phi);
      } else {
         const theta = style.spread * Math.sqrt(rngNext(rng));
         const s = Math.sin(theta);
         dx = s * Math.cos(phi);
         dy = Math.cos(theta);
         dz = s * Math.sin(phi);
      }
      const speed = between(rng, style.speed);
      const j = style.jitter * rngNext(rng);
      pool.px[i] = x + dx * j;
      pool.py[i] = y + dy * j;
      pool.pz[i] = z + dz * j;
      pool.vx[i] = dx * speed;
      pool.vy[i] = dy * speed;
      pool.vz[i] = dz * speed;
      pool.age[i] = 0;
      pool.life[i] = Math.max(0.05, between(rng, style.life));
      // a random tumbling axis
      const ay = 2 * rngNext(rng) - 1;
      const ar = Math.sqrt(Math.max(0, 1 - ay * ay));
      const aphi = 2 * Math.PI * rngNext(rng);
      pool.ax[i] = ar * Math.cos(aphi);
      pool.ay[i] = ay;
      pool.az[i] = ar * Math.sin(aphi);
      pool.angle[i] = 2 * Math.PI * rngNext(rng);
      pool.spin[i] = style.spin * (2 * rngNext(rng) - 1);
      pool.color[i] = Math.floor(rngNext(rng) * colors) % colors;
   }
   return n;
}

function copyParticle(pool: ParticlePool, from: number, to: number): void {
   pool.px[to] = pool.px[from];
   pool.py[to] = pool.py[from];
   pool.pz[to] = pool.pz[from];
   pool.vx[to] = pool.vx[from];
   pool.vy[to] = pool.vy[from];
   pool.vz[to] = pool.vz[from];
   pool.age[to] = pool.age[from];
   pool.life[to] = pool.life[from];
   pool.ax[to] = pool.ax[from];
   pool.ay[to] = pool.ay[from];
   pool.az[to] = pool.az[from];
   pool.angle[to] = pool.angle[from];
   pool.spin[to] = pool.spin[from];
   pool.color[to] = pool.color[from];
}

/** Advances every particle by `dt` seconds (0 = frozen) and drops the dead ones. */
export function stepParticles(pool: ParticlePool, style: Readonly<BurstStyle>, dt: number): void {
   if (!(dt > 0) || pool.count === 0) return;
   const damp = Math.exp(-style.drag * dt);
   const g = style.gravity * dt;
   let i = 0;
   while (i < pool.count) {
      const age = pool.age[i] + dt;
      if (age >= pool.life[i]) {
         const last = pool.count - 1;
         if (i !== last) copyParticle(pool, last, i);
         pool.count = last;
         if (pool.cursor >= pool.count) pool.cursor = 0;
         continue; // the moved particle is stepped at index i
      }
      pool.age[i] = age;
      pool.vx[i] *= damp;
      pool.vy[i] = pool.vy[i] * damp + g;
      pool.vz[i] *= damp;
      pool.px[i] += pool.vx[i] * dt;
      pool.py[i] += pool.vy[i] * dt;
      pool.pz[i] += pool.vz[i] * dt;
      pool.angle[i] += pool.spin[i] * dt;
      i += 1;
   }
}

/** The scale of a particle at `t` = age / life (0..1): from size[0] to size[1], shrinking to 0 at the end. */
export function particleScale(style: Readonly<BurstStyle>, t: number): number {
   const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
   const s = style.size[0] + (style.size[1] - style.size[0]) * u;
   return s * (1 - u * u * u);
}

export function clearParticles(pool: ParticlePool): void {
   pool.count = 0;
   pool.cursor = 0;
}
