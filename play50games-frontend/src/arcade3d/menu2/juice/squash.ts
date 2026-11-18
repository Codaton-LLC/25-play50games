// Squash and stretch: small, pure helpers for the bouncy feel (a landing squash, a take-off stretch,
// a pickup pop). No three.js, no allocation: each writes into what it is given.
//
//    const s = createSpring();                     // once
//    kickSpring(s, -0.25);                         // on a landing
//    stepSpring(s, target, 7, 0.45, dt);           // every frame (visual dt)
//    volumeScale(1 + s.x, scale);                  // keep the volume: x = z = 1 / sqrt(y)
//    group.scale.set(scale.x, scale.y, scale.z);

/** A damped spring on one number: `x` the value, `v` its speed. */
export interface Spring {
   x: number;
   v: number;
}

export function createSpring(x = 0): Spring {
   return { x, v: 0 };
}

/** The longest sub-step (s): the spring stays stable at any frame rate. */
const SPRING_STEP = 1 / 240;

/**
 * Moves the spring towards `target` for `dt` s: `frequency` (Hz) how fast it swings, `damping` the
 * ratio (1 = no overshoot, 0.3 = a wobbly bounce). Sub-stepped (semi-implicit Euler), so a long
 * frame never blows it up. dt <= 0 changes nothing (a paused game).
 */
export function stepSpring(s: Spring, target: number, frequency: number, damping: number, dt: number): Spring {
   if (!(dt > 0)) return s;
   const w = 2 * Math.PI * frequency;
   const k = w * w;
   const c = 2 * damping * w;
   let left = Math.min(dt, 0.25);
   while (left > 1e-9) {
      const h = Math.min(SPRING_STEP, left);
      s.v += (k * (target - s.x) - c * s.v) * h;
      s.x += s.v * h;
      left -= h;
   }
   return s;
}

/** An impulse: adds `speed` to the spring's speed (a landing kicks it down, a take-off up). */
export function kickSpring(s: Spring, speed: number): Spring {
   s.v += speed;
   return s;
}

export interface Scale3 {
   x: number;
   y: number;
   z: number;
}

/** The volume-keeping scale for a vertical factor `sy`: x = z = 1 / sqrt(sy) (clamped to 0.5..1.6). */
export function volumeScale(sy: number, out: Scale3): Scale3 {
   const y = sy < 0.5 ? 0.5 : sy > 1.6 ? 1.6 : sy;
   const side = 1 / Math.sqrt(y);
   out.x = side;
   out.y = y;
   out.z = side;
   return out;
}

/** The volume-keeping scale for a stretch `sz` along the facing (a dash): x = y = 1 / sqrt(sz). */
export function forwardStretch(sz: number, out: Scale3): Scale3 {
   const z = sz < 0.5 ? 0.5 : sz > 1.6 ? 1.6 : sz;
   const side = 1 / Math.sqrt(z);
   out.x = side;
   out.y = side;
   out.z = z;
   return out;
}

/** The vertical stretch of a body in the air at `vy` m/s: 1 + |vy| x `perSpeed`, at most 1 + `max`. */
export function airStretch(vy: number, perSpeed = 0.01, max = 0.14): number {
   return 1 + Math.min(max, Math.abs(vy) * perSpeed);
}

/**
 * A landing's squash over time, without a spring: the vertical factor `t` s after landing with
 * `impact` 0..1 (a hard fall = 1): down by up to 28 %, then a small rebound, settled by about 0.4 s.
 */
export function landSquash(t: number, impact: number): number {
   if (!(t >= 0)) return 1;
   const a = 0.28 * (impact < 0 ? 0 : impact > 1 ? 1 : impact);
   return 1 - a * Math.exp(-t * 9) * Math.cos(t * 22);
}

/**
 * A pop (a pickup, a popup, a button): the scale `t` s into a pop of `duration` s: 0 -> 1.18 -> 1,
 * 1 from the end on.
 */
export function popScale(t: number, duration = 0.25): number {
   if (!(t > 0)) return 0;
   const u = t / duration;
   if (u >= 1) return 1;
   if (u < 0.6) {
      const k = u / 0.6;
      return 1.18 * (1 - (1 - k) * (1 - k));
   }
   const k = (u - 0.6) / 0.4;
   return 1.18 - 0.18 * k * k * (3 - 2 * k);
}
