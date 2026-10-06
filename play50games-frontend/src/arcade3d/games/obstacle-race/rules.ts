// Obstacle Race rules: the fixed course as data, the integer-ms clock and its 300 s cap, kinematic
// movement with closed-form jumps, collisions, the moving obstacles as functions of rules time, the
// bar knock, checkpoints, falls and respawns, the finish, and the constants of the minimum-time
// proof. Pure and deterministic: no three.js, React, DOM, Rapier, Math.random or Date.now, and no
// seed (one fixed course, README "Fixed course"). Scene.tsx maps the stick with
// inputToWorld(moveX, moveY, 0) and calls step() once per useRunFrame; rules.test.ts drives it
// directly. The same frames and inputs give the same run, bit for bit.
//
// Clock: whole ms, the fraction carried to the next step (as warehouse-rush), stepped 1 ms at a time,
// so a jump arc depends only on the ms since take-off and is the same at 30, 60 or 144 fps.
// No allocation after createRun(): the runner and the events object are rewritten in place, step()
// returns the same events object every time, and the collision scratch is module-level.
// README.md is the design and holds the proof; rules.test.ts checks every step of it.
import { resolveSphereAabb, type AABB, type Vec3Like } from "@/arcade3d/core/collision";
import type { RunState } from "@/arcade3d/core/types";

// ---------- tuning (README "Constants"; 1 unit = 1 m, forward is -z, progress p = -z) ----------

/** "Nothing": no support, no coyote, no buffered press. */
export const NONE = -1;

/** The run limit (= scoring.timeBaseMs), owned by the rules: the ms that reaches it moves nothing. */
export const DURATION_MS = 300_000;
/** Largest frame (ms): useRunFrame's dt is at most 1/20 s. Longer steps are clamped. */
export const MAX_STEP_MS = 50;

/** The runner: a circle of this radius in x/z, this tall from the feet. */
export const RUNNER = { radius: 0.35, height: 1.5 } as const;
/** Top run speed (m/s) at full stick; the stick is analog. */
export const V_RUN = 6;
/** Easing of the input velocity (m/s²): on the ground (also braking) and in the air. */
export const ACCEL = { ground: 40, air: 20 } as const;
/** Gravity (m/s²) and take-off speed (m/s): y = y0 + 8.5·t − 12.5·t². */
export const G = 25;
export const V_JUMP = 8.5;
/** A jump up to this many ms after walking off an edge still works (inclusive). */
export const COYOTE_MS = 100;
/** A press is kept this many ms and jumps on the first ms that can (inclusive). */
export const BUFFER_MS = 120;
/** Support grace: the runner stands on a top while its centre is within this far outside the edge. */
export const FOOT = 0.2;
/** Feet below this: lost. The water is drawn lower. */
export const KILL_Y = -1.5;
export const WATER_Y = -2;
/** In the water, then frozen on the checkpoint line (ms). The clock keeps running. */
export const LOST_MS = 600;
export const SPAWN_MS = 300;

/** The sweeper disc: radius 6 around (x 0, p 18), top 0. */
export const DISC = { x: 0, p: 18, radius: 6, top: 0 } as const;
/** The hub in the disc's middle: solid, not a support, taller than the jump apex. */
export const HUB = { radius: 0.7, height: 1.6 } as const;
/**
 * One bar through the hub: arms out to `reach` each way, `thickness` across, from `bottom` to `top`
 * above the disc. Angle omega · ms / 1000 (rad), along ±x at 0; the Scene sets rotation.y to it, so
 * the bar's axis is (cos a, −sin a) in (x, z).
 */
export const BAR = { reach: 5.9, thickness: 0.35, bottom: 0.25, top: 0.7, omega: 1.1 } as const;
/** A bar hit flings the runner off the disc: vx away from x = 0, vy up, no z, no collisions. */
export const KNOCK = { vx: 12, vy: 8 } as const;

/** Moving blocks: slabs 2.4 (x) × 2.2 (z) × 0.6, top 0, sliding ±2.4 with a 4 s smooth triangle wave. */
export const BLOCK = { width: 2.4, depth: 2.2, height: 0.6, travel: 2.4, periodMs: 4000 } as const;
/** Phase of each block's wave (fraction of a period), B1 … B5. */
export const BLOCK_PHASES: readonly number[] = [0, 0.5, 0.25, 0.75, 0.5];
/** The balance beam: 20 × 1.0, top 0; slides a standing runner along x at up to 1.8 m/s (3.2 s wave). */
export const BEAM = { length: 20, width: 1, thickness: 0.4, slide: 1.8, periodMs: 3200, tiltDeg: 10 } as const;
/** Jump platforms: 2.4 × 2.4 tops, this thick, on square pillars down to the water. */
export const PLATFORM = { size: 2.4, thickness: 0.3, pillar: 0.8 } as const;
/** The finish arch: its two posts are solid circles; the rest is looks. */
export const ARCH = { width: 8, height: 4.2, depth: 0.8, postRadius: 0.4, postX: 3.6 } as const;

/** Checkpoint lines and the finish line, in p (checkpoint 0 is the start line, the first spawn). */
export const LINES = { start: 0, cp1: 29, cp2: 62, cp3: 88.6, finish: 116 } as const;

/** Float slack for the edge graces only (0.20 past an edge is 0.2000000000000028 in floats). */
const EDGE_EPS = 1e-9;

// ---------- the proof (README "Server limits and why they hold") ----------

/** The most a runner's non-carry step can move in one ms (m): V_RUN · 1 ms = 6 mm. Carry has no z. */
export const MAX_MOVE = V_RUN / 1000;

/** Proof step 4: the earliest ms at which the runner can stand at p >= line (6 mm per ms from p 0). */
export function earliestMs(line: number): number {
   return Math.ceil((line * 1000) / V_RUN);
}

/** The bound: no run finishes before this ms (19334). */
export const MIN_FINISH_MS = earliestMs(LINES.finish);

// ---------- derived numbers (README "Constants" and "The course"; pinned by rules.test.ts) ----------

/** Height gained `k` whole ms after an arc started at speed `v` (m/s). Exact for v·1000 whole. */
export function arcHeight(v: number, k: number): number {
   return (v * 1000 * k - (G / 2) * k * k) / 1_000_000;
}

/** Jump apex above the take-off (m) and when it is reached (ms). */
export const APEX_HEIGHT = (V_JUMP * V_JUMP) / (2 * G);
export const APEX_MS = (1000 * V_JUMP) / G;
/** Time in the air of a jump that lands at its take-off height (ms). */
export const AIR_MS = 2 * APEX_MS;
/** How far the feet have fallen at the last coyote ms (m): a coyote jump starts this much lower. */
export const COYOTE_DROP = (G / 2) * (COYOTE_MS / 1000) ** 2;

/**
 * Seconds until an arc that starts at height y0 with speed v comes down through height dy (the
 * later root of y0 + v·t − G/2·t² = dy); NaN if it never gets that high.
 */
export function landingTime(dy: number, y0 = 0, v = V_JUMP): number {
   const disc = v * v - 2 * G * (dy - y0);
   if (disc < 0) return NaN;
   return (v + Math.sqrt(disc)) / G;
}

/** A plain jump at full speed from a top to one dy higher: the reach a player can count on (m). */
export function jumpReach(dy: number): number {
   return V_RUN * landingTime(dy);
}

/**
 * The longest forward reach of any jump to a top dy higher, edge to edge (README "No section can be
 * skipped"): the take-off grace, a full coyote run-on, the flight from the coyote fall's height and
 * the landing grace. Carry is x only, so nothing adds to it.
 */
export function skipReach(dy: number): number {
   return FOOT + (V_RUN * COYOTE_MS) / 1000 + V_RUN * landingTime(dy, -COYOTE_DROP) + FOOT;
}

/** The ms of a jump in which the feet are above the bar's top (from take-off on the disc). */
export const BAR_WINDOW_MS = {
   from: (1000 * (V_JUMP - Math.sqrt(V_JUMP * V_JUMP - 2 * G * BAR.top))) / G,
   to: (1000 * (V_JUMP + Math.sqrt(V_JUMP * V_JUMP - 2 * G * BAR.top))) / G,
} as const;
export const BAR_CLEAR_MS = BAR_WINDOW_MS.to - BAR_WINDOW_MS.from;
/** Inside this radius the bar takes longer to pass a runner than a jump stays above it (m). */
export const BAR_MIN_RADIUS = (BAR.thickness + 2 * RUNNER.radius) / ((BAR.omega * BAR_CLEAR_MS) / 1000);

/** The knock's sideways part never goes further from x = 0 than this (m): clear of the disc everywhere. */
export const KNOCK_STOP_X = DISC.radius + RUNNER.radius;
/** ms the fling needs, at most, to get there; and ms until the feet are back at the take-off height. */
export const KNOCK_STOP_MS = (1000 * KNOCK_STOP_X) / KNOCK.vx;
export const KNOCK_RETURN_MS = (2000 * KNOCK.vy) / G;

/** Top block speed (m/s): travel · 2 (from −1 to 1) · 1.5 (smoothstep slope) · 2 (triangle) per period. */
export const BLOCK_TOP_SPEED = (BLOCK.travel * 2 * 1.5 * 2 * 1000) / BLOCK.periodMs;

/** From rest at full stick on the ground: ms to top speed and the distance covered (1 ms steps, ease then move). */
export const RAMP_MS = (1000 * V_RUN) / ACCEL.ground;
export const RAMP_M = ((ACCEL.ground / 1_000_000) * RAMP_MS * (RAMP_MS + 1)) / 2;

// ---------- the course ----------

export type SupportKind = "pad" | "bridge" | "disc" | "platform" | "block" | "beam";

/** A top the runner can stand on. It is also solid from `bottom` to `top` (side collisions). */
export interface Support {
   readonly name: string;
   readonly kind: SupportKind;
   /** footprint box: x range (a block's at rest, centred on 0) and p range; the disc's bounding box */
   readonly minX: number;
   readonly maxX: number;
   readonly minP: number;
   readonly maxP: number;
   /** disc only: the circle (centre x, p and radius); 0 otherwise */
   readonly cx: number;
   readonly cp: number;
   readonly radius: number;
   readonly top: number;
   readonly bottom: number;
   /** block only: index into BLOCK_PHASES; NONE otherwise */
   readonly block: number;
   /** the footprint as a world box (z = −p, y ±1000) for resolveSphereAabb; a block's at rest */
   readonly box: AABB;
}

/** A solid that is never stood on: the pillars (boxes), the hub and the arch posts (circles). */
export interface Solid {
   readonly name: string;
   readonly shape: "box" | "circle";
   readonly minX: number;
   readonly maxX: number;
   readonly minP: number;
   readonly maxP: number;
   readonly cx: number;
   readonly cp: number;
   readonly radius: number;
   readonly bottom: number;
   readonly top: number;
   readonly box: AABB;
}

/** A line across a pad: crossing it grounded on that pad activates it (or finishes). */
export interface Line {
   readonly line: number;
   /** index into Course.supports */
   readonly support: number;
}

export interface Course {
   readonly name: string;
   /** every top, in p order along the path */
   readonly supports: readonly Support[];
   readonly solids: readonly Solid[];
   /** the disc support whose bar sweeps, NONE without one */
   readonly sweeper: number;
   /** checkpoint 0 is the start line (the first spawn), then 1, 2, 3, in order */
   readonly checkpoints: readonly Line[];
   readonly finish: Line;
}

// Course builders: COURSE and FLAT below, and the tests' own small courses. Ranges are in p.
const worldBox = (minX: number, maxX: number, minP: number, maxP: number): AABB => ({
   min: { x: minX, y: -1000, z: -maxP },
   max: { x: maxX, y: 1000, z: -minP },
});

export function boxSupport(
   name: string,
   kind: SupportKind,
   minP: number,
   maxP: number,
   minX: number,
   maxX: number,
   top: number,
   bottom: number,
   block = NONE
): Support {
   return { name, kind, minX, maxX, minP, maxP, cx: 0, cp: 0, radius: 0, top, bottom, block, box: worldBox(minX, maxX, minP, maxP) };
}

export function discSupport(name: string, cx: number, cp: number, radius: number, top: number, bottom: number): Support {
   const minX = cx - radius;
   const maxX = cx + radius;
   return { name, kind: "disc", minX, maxX, minP: cp - radius, maxP: cp + radius, cx, cp, radius, top, bottom, block: NONE, box: worldBox(minX, maxX, cp - radius, cp + radius) };
}

export function boxSolid(name: string, minP: number, maxP: number, minX: number, maxX: number, bottom: number, top: number): Solid {
   return { name, shape: "box", minX, maxX, minP, maxP, cx: 0, cp: 0, radius: 0, bottom, top, box: worldBox(minX, maxX, minP, maxP) };
}

export function circleSolid(name: string, cx: number, cp: number, radius: number, bottom: number, top: number): Solid {
   const minX = cx - radius;
   const maxX = cx + radius;
   return { name, shape: "circle", minX, maxX, minP: cp - radius, maxP: cp + radius, cx, cp, radius, bottom, top, box: worldBox(minX, maxX, cp - radius, cp + radius) };
}

const HALF_PLATFORM = PLATFORM.size / 2;
const HALF_PILLAR = PLATFORM.pillar / 2;

function platform(name: string, minP: number, maxP: number, cx: number, top: number): Support {
   return boxSupport(name, "platform", minP, maxP, cx - HALF_PLATFORM, cx + HALF_PLATFORM, top, top - PLATFORM.thickness);
}

function pillar(of: Support): Solid {
   const cp = (of.minP + of.maxP) / 2;
   const cx = (of.minX + of.maxX) / 2;
   return boxSolid(`${of.name} pillar`, cp - HALF_PILLAR, cp + HALF_PILLAR, cx - HALF_PILLAR, cx + HALF_PILLAR, WATER_Y, of.bottom);
}

function block(k: number, minP: number, maxP: number): Support {
   return boxSupport(`B${k + 1}`, "block", minP, maxP, -BLOCK.width / 2, BLOCK.width / 2, 0, -BLOCK.height, k);
}

const PLATFORMS: readonly Support[] = [
   platform("J1", 36.4, 38.8, 0, 0.5),
   platform("J2", 41.2, 43.6, -1.3, 1.0),
   platform("J3", 46.2, 48.6, 0.5, 1.5),
   platform("J4", 51.2, 53.6, 1.5, 1.0),
   platform("J5", 56.2, 58.6, 0, 0.5),
];

/** The course (README "The course"): the same geometry and obstacle timeline in every run. */
export const COURSE: Course = {
   name: "course",
   supports: [
      boxSupport("start", "pad", -4, 8, -4, 4, 0, WATER_Y),
      boxSupport("bridge A", "bridge", 8, 13, -1.5, 1.5, 0, WATER_Y),
      discSupport("disc", DISC.x, DISC.p, DISC.radius, DISC.top, WATER_Y),
      boxSupport("bridge B", "bridge", 23, 28, -1.5, 1.5, 0, WATER_Y),
      boxSupport("CP1", "pad", 28, 34, -3, 3, 0, WATER_Y),
      ...PLATFORMS,
      boxSupport("CP2", "pad", 61, 67, -3, 3, 0, WATER_Y),
      block(0, 68.6, 70.8),
      block(1, 72.4, 74.6),
      block(2, 76.2, 78.4),
      block(3, 80.0, 82.2),
      block(4, 83.8, 86.0),
      boxSupport("CP3", "pad", 87.6, 93.6, -3, 3, 0, WATER_Y),
      boxSupport("beam", "beam", 93.6, 113.6, -BEAM.width / 2, BEAM.width / 2, 0, -BEAM.thickness),
      boxSupport("finish", "pad", 113.6, 122, -4, 4, 0, WATER_Y),
   ],
   solids: [
      ...PLATFORMS.map(pillar),
      circleSolid("hub", DISC.x, DISC.p, HUB.radius, DISC.top, DISC.top + HUB.height),
      circleSolid("post L", -ARCH.postX, LINES.finish, ARCH.postRadius, 0, ARCH.height),
      circleSolid("post R", ARCH.postX, LINES.finish, ARCH.postRadius, 0, ARCH.height),
   ],
   sweeper: 2,
   checkpoints: [
      { line: LINES.start, support: 0 },
      { line: LINES.cp1, support: 4 },
      { line: LINES.cp2, support: 10 },
      { line: LINES.cp3, support: 16 },
   ],
   finish: { line: LINES.finish, support: 18 },
};

/**
 * Tests only (README "Test plan"): one 126 m pad, no obstacles, the same lines. A straight line at
 * full stick from the first ms is the fastest any run can be.
 */
export const FLAT: Course = {
   name: "flat",
   supports: [boxSupport("flat", "pad", -4, 122, -4, 4, 0, WATER_Y)],
   solids: [],
   sweeper: NONE,
   checkpoints: [
      { line: LINES.start, support: 0 },
      { line: LINES.cp1, support: 0 },
      { line: LINES.cp2, support: 0 },
      { line: LINES.cp3, support: 0 },
   ],
   finish: { line: LINES.finish, support: 0 },
};

// ---------- obstacles: pure functions of rules ms ----------

/**
 * A smooth triangle wave in [−1, 1]: u = frac(ms / period + phase), w = 1 − |2u − 1|,
 * s = w²(3 − 2w), returns 2s − 1. Polynomials only (no trig), defined for negative ms too.
 */
export function wave(ms: number, periodMs: number, phase: number): number {
   const t = ms / periodMs + phase;
   const u = t - Math.floor(t);
   const w = 1 - Math.abs(2 * u - 1);
   const s = w * w * (3 - 2 * w);
   return 2 * s - 1;
}

/** The bar's angle (rad) at rules ms `ms` (the Scene feeds −countdownMs during the countdown). */
export function barAngle(ms: number): number {
   return (BAR.omega * ms) / 1000;
}

/** Block k's centre x at rules ms `ms`. */
export function blockX(k: number, ms: number): number {
   return BLOCK.travel * wave(ms, BLOCK.periodMs, BLOCK_PHASES[k]);
}

/** The beam's slide (m/s along x) at rules ms `ms`; the Scene tilts the beam in phase with it. */
export function beamSlide(ms: number): number {
   return BEAM.slide * wave(ms, BEAM.periodMs, 0);
}

// ---------- geometry ----------

/** Horizontal distance from (x, z) to the support's footprint at rules ms `ms` (0 over it). */
export function supportDistance(s: Support, x: number, z: number, ms: number): number {
   const p = -z;
   if (s.kind === "disc") {
      const dx = x - s.cx;
      const dp = p - s.cp;
      return Math.max(0, Math.sqrt(dx * dx + dp * dp) - s.radius);
   }
   const ox = s.block === NONE ? 0 : blockX(s.block, ms);
   const dx = Math.max(s.minX + ox - x, 0, x - (s.maxX + ox));
   const dp = Math.max(s.minP - p, 0, p - s.maxP);
   return dx === 0 ? dp : dp === 0 ? dx : Math.sqrt(dx * dx + dp * dp);
}

/** Horizontal distance from (x, z) to a solid's footprint (0 inside). */
export function solidDistance(o: Solid, x: number, z: number): number {
   const p = -z;
   if (o.shape === "circle") {
      const dx = x - o.cx;
      const dp = p - o.cp;
      return Math.max(0, Math.sqrt(dx * dx + dp * dp) - o.radius);
   }
   const dx = Math.max(o.minX - x, 0, x - o.maxX);
   const dp = Math.max(o.minP - p, 0, p - o.maxP);
   return dx === 0 ? dp : dp === 0 ? dx : Math.sqrt(dx * dx + dp * dp);
}

/** Is the centre (x, z) over the support, edge grace included? */
export function onSupport(s: Support, x: number, z: number, ms: number): boolean {
   return supportDistance(s, x, z, ms) <= FOOT + EDGE_EPS;
}

/**
 * The support a grounded runner at height `top` stands on: `prefer` (its current one) while the
 * centre is still over it, else the first one at the same height in course order (a join), else NONE.
 */
export function supportUnder(course: Course, x: number, z: number, top: number, ms: number, prefer = NONE): number {
   const supports = course.supports;
   if (prefer !== NONE && supports[prefer].top === top && onSupport(supports[prefer], x, z, ms)) return prefer;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (i !== prefer && s.top === top && onSupport(s, x, z, ms)) return i;
   }
   return NONE;
}

/**
 * The top a shadow sits on: the highest support at or below the feet whose footprint (grace
 * included) holds the centre, the blocks at their x for `ms`; the water when there is none.
 */
export function groundBelow(course: Course, x: number, z: number, feetY: number, ms: number): number {
   let best = WATER_Y;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (s.top > best && s.top <= feetY + EDGE_EPS && onSupport(s, x, z, ms)) best = s.top;
   }
   return best;
}

/**
 * Is the runner "inside" a static solid at (x, z) with feet at feetY? The vertical spans overlap and
 * its core, the FOOT circle, overlaps the footprint: a push-out of more than RUNNER.radius − FOOT
 * (0.15 m) would be needed. The ledge band (a circle overlapping a top's edge by at most 0.15, as
 * after walking off) is not inside: the edge grace puts every walk-off there. Blocks are not static.
 */
export function insideStatic(course: Course, x: number, z: number, feetY: number): boolean {
   const head = feetY + RUNNER.height;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (s.block !== NONE || !(feetY < s.top && head > s.bottom)) continue;
      if (supportDistance(s, x, z, 0) < FOOT) return true;
   }
   const solids = course.solids;
   for (let i = 0; i < solids.length; i++) {
      const o = solids[i];
      if (!(feetY < o.top && head > o.bottom)) continue;
      if (solidDistance(o, x, z) < FOOT) return true;
   }
   return false;
}

/**
 * Does the runner's circle overlap any top's footprint? The knock's stop test. Touching does not
 * count, with the edge slack: at KNOCK_STOP_X the circle touches the disc, though 6.35 − 6 is
 * 0.34999999999999964 in floats.
 */
export function overlapsTop(course: Course, x: number, z: number, ms: number): boolean {
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      if (supportDistance(supports[i], x, z, ms) < RUNNER.radius - EDGE_EPS) return true;
   }
   return false;
}

/**
 * Does the bar hit a runner at (x, z) with feet at feetY, at rules ms `ms`? The vertical spans overlap
 * (feet below the bar's top, strictly; head above its bottom) and the circle overlaps the bar's
 * rectangle in the bar's rotating frame (tangency counts). False on a course without a sweeper.
 */
export function barHits(course: Course, x: number, z: number, feetY: number, ms: number): boolean {
   if (course.sweeper === NONE) return false;
   const disc = course.supports[course.sweeper];
   if (!(feetY < disc.top + BAR.top && feetY + RUNNER.height > disc.top + BAR.bottom)) return false;
   const a = barAngle(ms);
   const c = Math.cos(a);
   const s = Math.sin(a);
   const dx = x - disc.cx;
   const dz = z + disc.cp;
   // the bar's axis is (cos a, −sin a): u along it, w across it
   const u = dx * c - dz * s;
   const w = dx * s + dz * c;
   const half = BAR.thickness / 2;
   const du = u - Math.min(Math.max(u, -BAR.reach), BAR.reach);
   const dw = w - Math.min(Math.max(w, -half), half);
   return du * du + dw * dw <= RUNNER.radius * RUNNER.radius;
}

// ---------- the run ----------

export type RunnerState = "run" | "knocked" | "lost" | "spawn";

export interface Runner extends Vec3Like {
   /** feet centre in world units: x right, y up (feet), z = −p */
   x: number;
   y: number;
   z: number;
   /** the input velocity (m/s), eased towards the stick; collisions never change it */
   vx: number;
   vz: number;
   state: RunnerState;
   grounded: boolean;
   /** the support under a grounded runner (index into course.supports), NONE in the air */
   support: number;
   /** the current arc (in the air or knocked): y = arcY0 + arcHeight(arcV, ms − arcStart) */
   arcStart: number;
   arcY0: number;
   arcV: number;
   /** the ms of the walk-off (coyote time runs from it), NONE otherwise */
   coyoteFrom: number;
   /** x carry in m per ms: this ms's when grounded, the take-off's (launch carry) in the air */
   carryX: number;
   /** ±1 while the knock's fling still slides sideways, 0 otherwise */
   knockDir: number;
   /** ms left in the lost or spawn state */
   timerMs: number;
}

/** One frame of input. Scene fills one object per run (createStepInput) and passes it every step. */
export interface StepInput {
   /**
    * The stick on the ground in world space: inputToWorld(moveX, moveY, 0), so up is −z (forward).
    * Length <= 1 (longer is normalised); not finite counts as 0.
    */
   moveX: number;
   moveZ: number;
   /** Jump this frame: the core's jumpPressed (a one-frame event). Latched at the frame's first ms. */
   jumpPressed: boolean;
}

export function createStepInput(): StepInput {
   return { moveX: 0, moveZ: 0, jumpPressed: false };
}

/** What happened in one step. The same object every step, reset at its start. */
export interface StepEvents {
   jumped: boolean;
   landed: boolean;
   /** the checkpoint (1..3) activated in this step, NONE otherwise */
   checkpoint: number;
   knocked: boolean;
   /** the feet went below KILL_Y (a fall or the end of a knock) */
   lost: boolean;
   respawned: boolean;
   /** the finish: run.finishMs holds the ms; the Scene publishes it, then calls end("win") */
   finished: boolean;
   /** simMs reached DURATION_MS: the Scene calls end("timeup") */
   timeup: boolean;
}

export interface ObstacleRun {
   course: Course;
   /** rules time: whole ms of play since "Go" */
   simMs: number;
   /** fraction of a ms carried to the next step, [0, 1) */
   remainder: number;
   /** whole ms the latest step advanced */
   stepMs: number;
   runner: Runner;
   /** the first ms of the frame with the latest jump press (the buffer runs from it), NONE */
   pressMs: number;
   /** the active checkpoint: 0 (the start) … 3; respawns go to its line */
   checkpoint: number;
   /** the ms in which the active checkpoint was activated (0 for the start) */
   checkpointMs: number;
   respawns: number;
   /** the ms of the finish (0 before it) */
   finishMs: number;
   /** the furthest p the runner reached (tests) */
   maxP: number;
   /** the top of the last support stood on (the camera's height) */
   groundY: number;
   ended: "win" | "timeup" | null;
   /** tests only: false turns the progress guard off (README "Test plan": the guard is needed) */
   guard: boolean;
   events: StepEvents;
}

function createEvents(): StepEvents {
   return { jumped: false, landed: false, checkpoint: NONE, knocked: false, lost: false, respawned: false, finished: false, timeup: false };
}

function resetEvents(ev: StepEvents): void {
   ev.jumped = false;
   ev.landed = false;
   ev.checkpoint = NONE;
   ev.knocked = false;
   ev.lost = false;
   ev.respawned = false;
   ev.finished = false;
   ev.timeup = false;
}

export interface RunOptions {
   /** tests only: false runs without the progress guard */
   guard?: boolean;
}

/**
 * A new run on the start line: at rest, grounded, in state "run" (the countdown is the start
 * freeze). Allocates everything the run will ever use.
 */
export function createRun(course: Course = COURSE, options: RunOptions = {}): ObstacleRun {
   const start = course.checkpoints[0];
   const top = course.supports[start.support].top;
   return {
      course,
      simMs: 0,
      remainder: 0,
      stepMs: 0,
      runner: {
         x: 0,
         y: top,
         z: -start.line,
         vx: 0,
         vz: 0,
         state: "run",
         grounded: true,
         support: start.support,
         arcStart: 0,
         arcY0: top,
         arcV: 0,
         coyoteFrom: NONE,
         carryX: 0,
         knockDir: 0,
         timerMs: 0,
      },
      pressMs: NONE,
      checkpoint: 0,
      checkpointMs: 0,
      respawns: 0,
      finishMs: 0,
      maxP: start.line,
      groundY: top,
      ended: null,
      guard: options.guard ?? true,
      events: createEvents(),
   };
}

/** The runner's progress p (= −z). */
export const progressOf = (run: ObstacleRun): number => -run.runner.z;

/** The feet height of the runner's current arc at rules ms `ms`. */
export function arcY(r: Runner, ms: number): number {
   return r.arcY0 + arcHeight(r.arcV, ms - r.arcStart);
}

function startArc(r: Runner, ms: number, y0: number, v: number): void {
   r.arcStart = ms;
   r.arcY0 = y0;
   r.arcV = v;
   r.y = y0;
   r.grounded = false;
   r.support = NONE;
}

/**
 * Advances the integer clock's remainder by `dtMs` (clamped to MAX_STEP_MS) and returns the whole
 * ms to simulate. The sum of the whole ms never runs ahead of the sum of the dts and lags it by
 * less than 1 ms.
 */
export function advanceClock(run: ObstacleRun, dtMs: number): number {
   if (!(dtMs > 0)) return 0;
   run.remainder += Math.min(dtMs, MAX_STEP_MS);
   const whole = Math.floor(run.remainder);
   run.remainder -= whole;
   return whole;
}

const finite = (v: number): number => (Number.isFinite(v) ? v : 0);

/**
 * One frame: `dtMs` is useRunFrame's dt · 1000 (dt <= 0 or NaN does nothing). README "One step":
 * 1. the clock (whole ms, remainder carried, at most 50); a jump press is latched at the frame's
 *    first ms;
 * 2. each ms: simMs += 1; the ms that reaches DURATION_MS moves nothing and reports timeup; else the
 *    obstacles are at simMs and the runner's state acts. A finish or a time-up ends the step, and
 *    every later step does nothing.
 * Returns run.events, the same object every step. Allocates nothing.
 */
export function step(run: ObstacleRun, dtMs: number, input: StepInput): StepEvents {
   const ev = run.events;
   resetEvents(ev);
   run.stepMs = 0;
   if (run.ended !== null || !(dtMs > 0)) return ev;

   const whole = advanceClock(run, dtMs);
   if (input.jumpPressed) run.pressMs = run.simMs + 1;

   let mx = finite(input.moveX);
   let mz = finite(input.moveZ);
   const len = Math.sqrt(mx * mx + mz * mz);
   if (len > 1) {
      mx /= len;
      mz /= len;
   }

   for (let i = 0; i < whole; i++) {
      run.simMs += 1;
      run.stepMs += 1;
      if (run.simMs >= DURATION_MS) {
         run.ended = "timeup";
         ev.timeup = true;
         return ev;
      }
      tick(run, mx, mz);
      if (run.ended !== null) return ev;
   }
   return ev;
}

/** One ms of the runner's state machine (README "One step", 2). */
function tick(run: ObstacleRun, mx: number, mz: number): void {
   const r = run.runner;
   switch (r.state) {
      case "lost":
         run.pressMs = NONE;
         r.timerMs -= 1;
         if (r.timerMs <= 0) respawn(run);
         return;
      case "spawn":
         run.pressMs = NONE;
         r.timerMs -= 1;
         if (r.timerMs <= 0) r.state = "run";
         return;
      case "knocked":
         run.pressMs = NONE;
         knockedMs(run);
         return;
      default:
         runMs(run, mx, mz);
   }
}

// collision scratch (one per module: step() never yields, so it is never shared mid-use)
const SCRATCH_P: Vec3Like = { x: 0, y: 0, z: 0 };
const SCRATCH_BOX: AABB = { min: { x: 0, y: -1000, z: 0 }, max: { x: 0, y: 1000, z: 0 } };

function pushOutOfBox(r: Runner, box: AABB): void {
   SCRATCH_P.x = r.x;
   SCRATCH_P.y = 0;
   SCRATCH_P.z = r.z;
   resolveSphereAabb(SCRATCH_P, RUNNER.radius, box, SCRATCH_P);
   r.x = SCRATCH_P.x;
   r.z = SCRATCH_P.z;
}

function pushOutOfCircle(r: Runner, cx: number, cz: number, radius: number): void {
   const min = radius + RUNNER.radius;
   const dx = r.x - cx;
   const dz = r.z - cz;
   const d2 = dx * dx + dz * dz;
   if (d2 >= min * min) return;
   if (d2 < 1e-18) {
      // on the centre: out along +x (never happens in play; deterministic anyway)
      r.x = cx + min;
      return;
   }
   const k = min / Math.sqrt(d2);
   r.x = cx + dx * k;
   r.z = cz + dz * k;
}

function blockBox(s: Support, ms: number): AABB {
   const ox = blockX(s.block, ms);
   SCRATCH_BOX.min.x = s.minX + ox;
   SCRATCH_BOX.max.x = s.maxX + ox;
   SCRATCH_BOX.min.z = -s.maxP;
   SCRATCH_BOX.max.z = -s.minP;
   return SCRATCH_BOX;
}

/** Step 6: push the circle out of every solid whose span overlaps the runner's (feet below its top, head above its bottom). */
function sideCollisions(course: Course, r: Runner, ms: number): void {
   const feet = r.y;
   const head = r.y + RUNNER.height;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(feet < s.top && head > s.bottom)) continue;
      if (s.kind === "disc") pushOutOfCircle(r, s.cx, -s.cp, s.radius);
      else pushOutOfBox(r, s.block === NONE ? s.box : blockBox(s, ms));
   }
   const solids = course.solids;
   for (let i = 0; i < solids.length; i++) {
      const o = solids[i];
      if (!(feet < o.top && head > o.bottom)) continue;
      if (o.shape === "circle") pushOutOfCircle(r, o.cx, -o.cp, o.radius);
      else pushOutOfBox(r, o.box);
   }
}

/**
 * The highest support whose top the feet crossed downwards this ms (yOld >= top > yNew) with the
 * centre over it. The feet must end below the top, so a jump on the flat lands at take-off + 681:
 * at + 680 (AIR_MS) they are exactly at the top.
 */
function landingSupport(course: Course, x: number, z: number, yOld: number, yNew: number, ms: number): number {
   let best = NONE;
   const supports = course.supports;
   for (let i = 0; i < supports.length; i++) {
      const s = supports[i];
      if (!(yOld >= s.top && s.top > yNew)) continue;
      if (best !== NONE && supports[best].top >= s.top) continue;
      if (onSupport(s, x, z, ms)) best = i;
   }
   return best;
}

/** One ms in state "run" (README "One step", 2, run: 1–11). */
function runMs(run: ObstacleRun, mx: number, mz: number): void {
   const course = run.course;
   const r = run.runner;
   const ev = run.events;
   const ms = run.simMs;
   const x0 = r.x;
   const z0 = r.z;

   // 1. carry: a block's own Δx this ms, the beam's slide; in the air the take-off's (launch carry)
   let carry = r.carryX;
   if (r.grounded) {
      const s = course.supports[r.support];
      carry = s.kind === "block" ? blockX(s.block, ms) - blockX(s.block, ms - 1) : s.kind === "beam" ? beamSlide(ms) / 1000 : 0;
      r.carryX = carry;
   }

   // 2. jump: a buffered press, grounded or within coyote time
   if (run.pressMs !== NONE) {
      if (ms - run.pressMs > BUFFER_MS) {
         run.pressMs = NONE;
      } else if (r.grounded || (r.coyoteFrom !== NONE && ms - r.coyoteFrom <= COYOTE_MS)) {
         // a coyote jump starts from the fall's height at this ms
         const y0 = r.grounded ? r.y : arcY(r, ms);
         startArc(r, ms, y0, V_JUMP);
         r.coyoteFrom = NONE;
         r.carryX = carry;
         run.pressMs = NONE;
         ev.jumped = true;
      }
   }

   // 3. ease the input velocity towards V_RUN · stick (40 or 20 m/s²), capped at V_RUN
   const rate = (r.grounded ? ACCEL.ground : ACCEL.air) / 1000;
   let dvx = V_RUN * mx - r.vx;
   let dvz = V_RUN * mz - r.vz;
   const dv = Math.sqrt(dvx * dvx + dvz * dvz);
   if (dv > rate) {
      dvx *= rate / dv;
      dvz *= rate / dv;
   }
   r.vx += dvx;
   r.vz += dvz;
   const speed = Math.sqrt(r.vx * r.vx + r.vz * r.vz);
   if (speed > V_RUN) {
      r.vx *= V_RUN / speed;
      r.vz *= V_RUN / speed;
   }

   // 4. move by the input velocity plus the carry (x only)
   r.x += r.vx / 1000 + carry;
   r.z += r.vz / 1000;

   // 5. vertical: the arc, a landing, or a walk-off
   if (r.grounded) {
      const s = supportUnder(course, r.x, r.z, r.y, ms, r.support);
      if (s === NONE) {
         // walked off: gravity runs from this ms, coyote time starts
         startArc(r, ms, r.y, 0);
         r.coyoteFrom = ms;
         r.carryX = carry;
      } else {
         r.support = s;
      }
   } else {
      const yOld = r.y;
      const yNew = arcY(r, ms);
      r.y = yNew;
      if (yNew < yOld) {
         const s = landingSupport(course, r.x, r.z, yOld, yNew, ms);
         if (s !== NONE) {
            const top = course.supports[s].top;
            r.y = top;
            r.grounded = true;
            r.support = s;
            r.coyoteFrom = NONE;
            r.carryX = 0;
            run.groundY = top;
            ev.landed = true;
         }
      }
   }

   // 6. side collisions
   sideCollisions(course, r, ms);

   // 7. progress guard: the non-carry step (input + push-outs) is at most MAX_MOVE
   if (run.guard) {
      const dx = r.x - x0 - carry;
      const dz = r.z - z0;
      const moved = Math.sqrt(dx * dx + dz * dz);
      if (moved > MAX_MOVE) {
         const k = MAX_MOVE / moved;
         r.x = x0 + carry + dx * k;
         r.z = z0 + dz * k;
         if (insideStatic(course, r.x, r.z, r.y)) {
            r.x = x0;
            r.z = z0;
         }
      }
   }

   const p = -r.z;
   if (p > run.maxP) run.maxP = p;

   // 8. the bar
   if (barHits(course, r.x, r.z, r.y, ms)) {
      knock(run, ms);
      return;
   }

   // 9. the pool
   if (r.y < KILL_Y) {
      lose(run);
      return;
   }

   if (!r.grounded) return;

   // 10. the next checkpoint, in order only
   const next = run.checkpoint + 1;
   if (next < course.checkpoints.length) {
      const cp = course.checkpoints[next];
      const pad = course.supports[cp.support];
      if (p >= cp.line && r.y === pad.top && onSupport(pad, r.x, r.z, ms)) {
         run.checkpoint = next;
         run.checkpointMs = ms;
         ev.checkpoint = next;
      }
   }

   // 11. the finish, after the last checkpoint
   if (run.checkpoint === course.checkpoints.length - 1) {
      const fin = course.finish;
      const pad = course.supports[fin.support];
      if (p >= fin.line && r.y === pad.top && onSupport(pad, r.x, r.z, ms)) {
         run.finishMs = ms;
         run.ended = "win";
         ev.finished = true;
      }
   }
}

function knock(run: ObstacleRun, ms: number): void {
   const r = run.runner;
   r.state = "knocked";
   r.knockDir = r.x < 0 ? -1 : 1;
   startArc(r, ms, r.y, KNOCK.vy);
   r.coyoteFrom = NONE;
   r.vx = 0;
   r.vz = 0;
   r.carryX = 0;
   run.pressMs = NONE;
   run.events.knocked = true;
}

/**
 * One ms knocked: the fling (x and y only, a ghost: no collisions, no input). The sideways part stops
 * in the first ms in which the circle overlaps no top any more, and never goes past KNOCK_STOP_X.
 */
function knockedMs(run: ObstacleRun): void {
   const r = run.runner;
   const ms = run.simMs;
   if (r.knockDir !== 0) {
      let x = r.x + (r.knockDir * KNOCK.vx) / 1000;
      if (r.knockDir * x >= KNOCK_STOP_X) x = r.knockDir * KNOCK_STOP_X;
      r.x = x;
      if (r.knockDir * x >= KNOCK_STOP_X || !overlapsTop(run.course, r.x, r.z, ms)) r.knockDir = 0;
   }
   r.y = arcY(r, ms);
   if (r.y < KILL_Y) lose(run);
}

function lose(run: ObstacleRun): void {
   const r = run.runner;
   r.state = "lost";
   r.timerMs = LOST_MS;
   r.knockDir = 0;
   r.grounded = false;
   r.support = NONE;
   r.vx = 0;
   r.vz = 0;
   r.carryX = 0;
   r.coyoteFrom = NONE;
   run.events.lost = true;
}

/** Back on the active checkpoint's line (x 0), at rest, grounded, frozen for SPAWN_MS. */
function respawn(run: ObstacleRun): void {
   const r = run.runner;
   const cp = run.course.checkpoints[run.checkpoint];
   const top = run.course.supports[cp.support].top;
   r.x = 0;
   r.y = top;
   r.z = -cp.line;
   r.vx = 0;
   r.vz = 0;
   r.grounded = true;
   r.support = cp.support;
   r.arcStart = run.simMs;
   r.arcY0 = top;
   r.arcV = 0;
   r.coyoteFrom = NONE;
   r.carryX = 0;
   r.knockDir = 0;
   r.state = "spawn";
   r.timerMs = SPAWN_MS;
   run.groundY = top;
   run.respawns += 1;
   run.events.respawned = true;
}

// ---------- the store hand-off (README "Scoring") ----------

/** HUD and hand-off stats: "Checkpoint k/3", and the exact finish ms for finalScore. */
export const STAT = { checkpoint: "checkpoint", finishMs: "finishMs" } as const;

/**
 * GameDefinition.finalScore: a win submits the finish ms the Scene published with
 * setStat(STAT.finishMs) before end("win"), so the frame rate never costs a player time; any other
 * end keeps the store's elapsedMs (unranked for a time game anyway).
 */
export function finalScore(s: Pick<RunState, "score" | "endReason" | "stats" | "elapsedMs">): { score: number; durationMs: number } {
   const finishMs = s.stats[STAT.finishMs] ?? 0;
   return { score: s.score, durationMs: s.endReason === "win" && finishMs > 0 ? finishMs : s.elapsedMs };
}
