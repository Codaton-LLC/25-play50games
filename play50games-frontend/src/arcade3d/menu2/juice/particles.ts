// Menu 2 particles: the pooled simulation behind useJuice().burst / trail / aura (JuiceLayer.tsx).
// Pure (no three.js, React or DOM) and allocation-free after createJuicePool(): every particle lives
// in preallocated typed arrays, alive ones packed at the front. Unlike core/fx (one pool and one
// draw call per kind), every kind of one look shares a pool and an InstancedMesh with a colour per
// particle, so all Menu 2 particles cost two draw calls: "glow" (additive) and "soft" (dust).
import { rngNext, type RngState } from "@/arcade3d/core/math";

export const JUICE_KINDS = ["pickup", "dust", "trail", "checkpoint", "hit", "aura"] as const;
export type JuiceKind = (typeof JUICE_KINDS)[number];

/** glow = unlit additive sparks (one mesh), soft = lit see-through puffs (the other) */
export type JuiceLook = "glow" | "soft";

export interface JuiceStyle {
   look: JuiceLook;
   /** seconds, random in [min, max] */
   life: readonly [number, number];
   /** start speed m/s, random in [min, max] */
   speed: readonly [number, number];
   /** start directions: "sphere" = all round, "ring" = flat round the vertical, a number = cone half-angle (rad) round +y */
   spread: "sphere" | "ring" | number;
   /** m/s² along y */
   gravity: number;
   /** velocity damping, 1/s */
   drag: number;
   /** size (m) at birth and at death, shrunk to 0 at the very end */
   size: readonly [number, number];
   /** start positions scattered within this radius (m) */
   jitter: number;
   /** tumbling, rad/s at most */
   spin: number;
   /** colours when the caller gives none (one picked per particle) */
   colors: readonly string[];
}

export const JUICE_STYLES: Readonly<Record<JuiceKind, Readonly<JuiceStyle>>> = {
   // an orb / coin picked up: a quick star-like pop of glints
   pickup: {
      look: "glow", life: [0.35, 0.6], speed: [2, 4.2], spread: "sphere", gravity: -3, drag: 3,
      size: [0.16, 0.08], jitter: 0.08, spin: 8, colors: ["#fff3b0", "#ffd257", "#ffffff"],
   },
   // a landing: dust rolling out flat along the floor
   dust: {
      look: "soft", life: [0.4, 0.7], speed: [1.2, 2.6], spread: "ring", gravity: 0.5, drag: 4,
      size: [0.18, 0.42], jitter: 0.15, spin: 1.5, colors: ["#f1ede4", "#ddd6c8", "#c9c0ae"],
   },
   // the dash streak: glints left in place behind the hero, fading fast
   trail: {
      look: "glow", life: [0.18, 0.3], speed: [0, 0.4], spread: "sphere", gravity: 0, drag: 6,
      size: [0.24, 0.06], jitter: 0.18, spin: 3, colors: ["#ffffff"],
   },
   // a checkpoint: a fountain of colour, up and out
   checkpoint: {
      look: "glow", life: [0.8, 1.3], speed: [4, 7.5], spread: 0.7, gravity: -7, drag: 1.2,
      size: [0.2, 0.1], jitter: 0.2, spin: 10, colors: ["#ffd257", "#7dd3fc", "#f472b6", "#a3e635", "#ffffff"],
   },
   // a hit: dizzy glints flung round the head in a flat ring
   hit: {
      look: "glow", life: [0.35, 0.55], speed: [3, 5], spread: "ring", gravity: 0, drag: 5,
      size: [0.2, 0.1], jitter: 0.05, spin: 12, colors: ["#fff7ae", "#ffffff", "#ffd257"],
   },
   // a power that is up: motes rising round the body in the hero's colour
   aura: {
      look: "glow", life: [0.5, 0.9], speed: [0.3, 0.9], spread: 0.5, gravity: 1.6, drag: 1.5,
      size: [0.12, 0.04], jitter: 0.45, spin: 2, colors: ["#ffffff"],
   },
};

const KIND_INDEX: Record<JuiceKind, number> = { pickup: 0, dust: 1, trail: 2, checkpoint: 3, hit: 4, aura: 5 };
export const juiceKindIndex = (kind: JuiceKind) => KIND_INDEX[kind];

export interface JuicePool {
   readonly capacity: number;
   count: number;
   /** the next slot to overwrite once full (the oldest in turn) */
   cursor: number;
   readonly px: Float32Array;
   readonly py: Float32Array;
   readonly pz: Float32Array;
   readonly vx: Float32Array;
   readonly vy: Float32Array;
   readonly vz: Float32Array;
   readonly age: Float32Array;
   readonly life: Float32Array;
   readonly angle: Float32Array;
   readonly spin: Float32Array;
   /** the emitter's size factor */
   readonly scale: Float32Array;
   /** colour, linear-ish 0..1 (the sRGB value / 255; the renderer converts) */
   readonly r: Float32Array;
   readonly g: Float32Array;
   readonly b: Float32Array;
   readonly kind: Uint8Array;
   readonly rng: RngState;
}

export function createJuicePool(capacity: number, seed = 0x51ced): JuicePool {
   const n = Math.max(1, Math.floor(capacity));
   const f = () => new Float32Array(n);
   return {
      capacity: n,
      count: 0,
      cursor: 0,
      px: f(), py: f(), pz: f(),
      vx: f(), vy: f(), vz: f(),
      age: f(), life: f(), angle: f(), spin: f(), scale: f(),
      r: f(), g: f(), b: f(),
      kind: new Uint8Array(n),
      rng: { s: seed },
   };
}

const COLOR_CACHE = new Map<string, number>();

/** "#rrggbb" (or "#rgb") -> 0xrrggbb, cached (no allocation after a colour's first use). */
export function parseColor(hex: string): number {
   let c = COLOR_CACHE.get(hex);
   if (c === undefined) {
      let h = hex.startsWith("#") ? hex.slice(1) : hex;
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      c = parseInt(h, 16);
      if (!Number.isFinite(c)) c = 0xffffff;
      COLOR_CACHE.set(hex, c);
   }
   return c;
}

const between = (rng: RngState, range: readonly [number, number]) => range[0] + (range[1] - range[0]) * rngNext(rng);

export interface EmitOptions {
   /** one colour for every particle ("#rrggbb"); default the style's palette */
   color?: string;
   /** added to every particle's start velocity (m/s): a trail inherits a little of the hero's speed */
   vx?: number;
   vy?: number;
   vz?: number;
   /** scales the size (1 = the style's) */
   size?: number;
}

/**
 * Emits `count` particles of `kind` at (x, y, z) into `pool` (the look's pool). When full the
 * oldest slots are reused in turn. Returns how many were emitted (at most the capacity).
 */
export function emitJuice(pool: JuicePool, kind: JuiceKind, x: number, y: number, z: number, count: number, options?: EmitOptions): number {
   const style = JUICE_STYLES[kind];
   const n = Math.min(pool.capacity, Math.max(0, Math.floor(count)));
   const rng = pool.rng;
   const fixed = options?.color !== undefined ? parseColor(options.color) : -1;
   const ix = KIND_INDEX[kind];
   const bx = options?.vx ?? 0;
   const by = options?.vy ?? 0;
   const bz = options?.vz ?? 0;
   const sizeK = options?.size ?? 1;
   for (let k = 0; k < n; k++) {
      let i: number;
      if (pool.count < pool.capacity) {
         i = pool.count;
         pool.count += 1;
      } else {
         i = pool.cursor;
         pool.cursor = (pool.cursor + 1) % pool.capacity;
      }
      let dx: number;
      let dy: number;
      let dz: number;
      const phi = 2 * Math.PI * rngNext(rng);
      if (style.spread === "sphere") {
         dy = 2 * rngNext(rng) - 1;
         const r = Math.sqrt(Math.max(0, 1 - dy * dy));
         dx = r * Math.cos(phi);
         dz = r * Math.sin(phi);
      } else if (style.spread === "ring") {
         dy = 0.15 * rngNext(rng);
         dx = Math.cos(phi);
         dz = Math.sin(phi);
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
      pool.py[i] = y + (style.spread === "ring" ? 0 : dy * j);
      pool.pz[i] = z + dz * j;
      pool.vx[i] = dx * speed + bx;
      pool.vy[i] = dy * speed + by;
      pool.vz[i] = dz * speed + bz;
      pool.age[i] = 0;
      pool.life[i] = Math.max(0.05, between(rng, style.life));
      pool.angle[i] = 2 * Math.PI * rngNext(rng);
      pool.spin[i] = style.spin * (2 * rngNext(rng) - 1);
      pool.scale[i] = sizeK > 0 ? sizeK : 1;
      const c = fixed >= 0 ? fixed : parseColor(style.colors[Math.floor(rngNext(rng) * style.colors.length) % style.colors.length]);
      pool.r[i] = ((c >> 16) & 255) / 255;
      pool.g[i] = ((c >> 8) & 255) / 255;
      pool.b[i] = (c & 255) / 255;
      pool.kind[i] = ix;
   }
   return n;
}

function moveParticle(pool: JuicePool, from: number, to: number): void {
   pool.px[to] = pool.px[from];
   pool.py[to] = pool.py[from];
   pool.pz[to] = pool.pz[from];
   pool.vx[to] = pool.vx[from];
   pool.vy[to] = pool.vy[from];
   pool.vz[to] = pool.vz[from];
   pool.age[to] = pool.age[from];
   pool.life[to] = pool.life[from];
   pool.angle[to] = pool.angle[from];
   pool.spin[to] = pool.spin[from];
   pool.scale[to] = pool.scale[from];
   pool.r[to] = pool.r[from];
   pool.g[to] = pool.g[from];
   pool.b[to] = pool.b[from];
   pool.kind[to] = pool.kind[from];
}

const STYLE_BY_INDEX: ReadonlyArray<Readonly<JuiceStyle>> = JUICE_KINDS.map((k) => JUICE_STYLES[k]);

/** Advances every particle by `dt` s (0 = frozen) and drops the dead ones (each kind its own gravity and drag). */
export function stepJuice(pool: JuicePool, dt: number): void {
   if (!(dt > 0) || pool.count === 0) return;
   let i = 0;
   while (i < pool.count) {
      const age = pool.age[i] + dt;
      if (age >= pool.life[i]) {
         const last = pool.count - 1;
         if (i !== last) moveParticle(pool, last, i);
         pool.count = last;
         if (pool.cursor >= pool.count) pool.cursor = 0;
         continue;
      }
      const style = STYLE_BY_INDEX[pool.kind[i]];
      const damp = Math.exp(-style.drag * dt);
      pool.age[i] = age;
      pool.vx[i] *= damp;
      pool.vy[i] = pool.vy[i] * damp + style.gravity * dt;
      pool.vz[i] *= damp;
      pool.px[i] += pool.vx[i] * dt;
      pool.py[i] += pool.vy[i] * dt;
      pool.pz[i] += pool.vz[i] * dt;
      pool.angle[i] += pool.spin[i] * dt;
      i += 1;
   }
}

/** A particle's size (m) at `t` = age / life: from size[0] to size[1], shrinking to 0 at the end. */
export function juiceSize(kind: number, t: number): number {
   const style = STYLE_BY_INDEX[kind];
   const u = t <= 0 ? 0 : t >= 1 ? 1 : t;
   const s = style.size[0] + (style.size[1] - style.size[0]) * u;
   return s * (1 - u * u * u);
}

export function clearJuice(pool: JuicePool): void {
   pool.count = 0;
   pool.cursor = 0;
}

/**
 * A steady emitter (the aura, the dash trail): how many particles to emit this frame for `rate` per
 * second, carrying the fraction in `carry.left` so a low rate still emits evenly.
 */
export function emitCount(carry: { left: number }, rate: number, dt: number): number {
   if (!(dt > 0) || !(rate > 0)) return 0;
   carry.left += rate * dt;
   const n = Math.floor(carry.left);
   carry.left -= n;
   return n;
}
