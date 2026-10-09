// Mini Golf's ball (README "Rules"): one sub-step of rolling on the felt (friction, slopes), rails
// and moving walls (core kinematics), the hole 3 jump (closed-form flight), pipes, ponds, the cup
// and the rest rule. Pure and allocation-free: no three.js, React or DOM. rules.ts calls stepBall
// at 240 Hz (two sub-steps per 120 Hz tick); the windmill and the bar turn with `t`, the hole's
// play time in sub-steps, so a putt's outcome depends only on the tick it starts on.
import { circleSegmentXZ, resolveCircleSegmentXZ, type SegmentContact, type SegmentXZ } from "@/arcade3d/core/kinematics";
import { HILL_GRADE, MOUTH, PIPE_MIN_SPEED, RAMP, TIER_WALL_Z, WINDMILL, gradientAt, heightAt, type Hole, type P2 } from "./course";

/** The ball (README "Ball"). */
export const BALL = {
   radius: 0.06,
   /** drawn 1.5x so it reads on a phone */
   drawnRadius: 0.09,
   /** rolling friction (m/s^2) against the velocity */
   friction: 0.9,
   /** slope acceleration per unit gradient: (5/7) g, a rolling solid sphere */
   slope: (5 / 7) * 9.8,
   /** speed clamp (m/s): the limit proof's bound */
   vCap: 6,
   /** a full putt (m/s) */
   vMax: 4.5,
   /** at rest under this speed where the slope pull is at most the friction */
   restSpeed: 0.05,
   gravity: 9.8,
   /** landing after the jump: vertical x -0.3 (rolls under 0.3 m/s), horizontal x 0.85 */
   bounce: 0.3,
   landKeep: 0.85,
   rollBelow: 0.3,
} as const;

/** The cup (README "Cup"). */
export const CUP = {
   radius: 0.1,
   drawnRadius: 0.13,
   /** captured under this speed (m/s) */
   captureSpeed: 1.2,
   /** a lip-out turns the ball away from the cup by up to this (rad) and keeps this share of its speed */
   lipTurn: (25 * Math.PI) / 180,
   lipKeep: 0.85,
   /** the flag stands this far behind the cup (-z) */
   flagBack: 0.25,
   flagHeight: 0.8,
} as const;

/** Restitution of the windmill's blades (face only, no friction) and of the turntable bar. */
export const MOVING = { bladeE: 0.75, barE: 0.75, barMu: 0.1 } as const;

export type BallMode = "rest" | "roll" | "air" | "pipe" | "cup";

export interface Ball {
   x: number;
   z: number;
   /** the centre's height (air), else the felt under it + radius */
   y: number;
   vx: number;
   vz: number;
   radius: number;
   mode: BallMode;
   /** hole 5: on the upper tier */
   upper: boolean;
   /** inside the cup circle this pass (judged once per pass) */
   inCup: boolean;
   /** flight: vertical speed and height at its start, time since */
   vy0: number;
   y0: number;
   airT: number;
   /** pipe: which, time left inside (s), the speed it comes out at */
   pipe: number;
   pipeLeft: number;
   pipeSpeed: number;
}

/** What one or more sub-steps did (rules.ts resets it per frame; the Scene plays feedback from it). */
export interface BallEvents {
   /** the hardest static-rail impact (normal speed, m/s) and where */
   railHit: number;
   railX: number;
   /** a blade or the bar hit the ball */
   movingHit: boolean;
   lipOut: boolean;
   captured: boolean;
   water: boolean;
   pipeIn: boolean;
   pipeOut: boolean;
   landed: boolean;
   rested: boolean;
}

export function createBall(at: P2, upper: boolean): Ball {
   return { x: at.x, z: at.z, y: BALL.radius, vx: 0, vz: 0, radius: BALL.radius, mode: "rest", upper, inCup: false, vy0: 0, y0: 0, airT: 0, pipe: -1, pipeLeft: 0, pipeSpeed: 0 };
}

export function clearBallEvents(ev: BallEvents): BallEvents {
   ev.railHit = 0;
   ev.railX = 0;
   ev.movingHit = false;
   ev.lipOut = false;
   ev.captured = false;
   ev.water = false;
   ev.pipeIn = false;
   ev.pipeOut = false;
   ev.landed = false;
   ev.rested = false;
   return ev;
}

export const createBallEvents = (): BallEvents => clearBallEvents({} as BallEvents);

/** Put the ball at rest on `at` (the tee, a rest point, a placement). */
export function placeBall(hole: Hole, ball: Ball, at: P2, upper: boolean): void {
   ball.x = at.x;
   ball.z = at.z;
   ball.vx = 0;
   ball.vz = 0;
   ball.mode = "rest";
   ball.upper = upper;
   ball.inCup = false;
   ball.pipe = -1;
   ball.y = (heightAt(hole, at.x, at.z, upper) ?? 0) + BALL.radius;
}

/** Start a putt: speed v0 (m/s) along the world heading psi (0 = -z, + = towards +x). */
export function launchBall(ball: Ball, psi: number, v0: number): void {
   ball.vx = Math.sin(psi) * v0;
   ball.vz = -Math.cos(psi) * v0;
   ball.mode = "roll";
   ball.inCup = false;
}

/** Is the felt here steep enough that the ball can never rest (pull > friction)? */
export function slopePull(hole: Hole, x: number, z: number): number {
   gradientAt(hole, x, z, G);
   return BALL.slope * Math.hypot(G.x, G.z);
}

// ---------- moving walls ----------

/** The windmill blade chord at ball height for blade angle phi (from straight down): [c0, c1] in x, or false. */
export function bladeChord(hubY: number, length: number, halfWidth: number, phi: number, out: { c0: number; c1: number }): boolean {
   const d = hubY - BALL.radius;
   const s = Math.sin(phi);
   const c = Math.cos(phi);
   let lo = -Infinity;
   let hi = Infinity;
   // along the blade: 0 <= x sin + d cos <= length; across it: |x cos - d sin| <= halfWidth
   const limit = (a: number, b: number, from: number, to: number): boolean => {
      if (Math.abs(a) < 1e-12) return b >= from && b <= to;
      const x0 = (from - b) / a;
      const x1 = (to - b) / a;
      lo = Math.max(lo, Math.min(x0, x1));
      hi = Math.min(hi, Math.max(x0, x1));
      return true;
   };
   if (!limit(s, d * c, 0, length) || !limit(c, -d * s, -halfWidth, halfWidth) || lo > hi) return false;
   out.c0 = lo;
   out.c1 = hi;
   return true;
}

/** The turntable bar at hole time t (a rotating segment: pivot + omega give core its contact velocity). */
export function barAt(hole: Hole, t: number, out: SegmentXZ): SegmentXZ {
   const tt = hole.turntable!;
   const a = tt.phase + tt.omega * t;
   const dx = Math.cos(a) * tt.half;
   const dz = -Math.sin(a) * tt.half;
   out.a.x = tt.centre.x - dx;
   out.a.z = tt.centre.z - dz;
   out.b.x = tt.centre.x + dx;
   out.b.z = tt.centre.z + dz;
   out.pivot!.x = tt.centre.x;
   out.pivot!.z = tt.centre.z;
   out.omega = tt.omega;
   return out;
}

// ---------- scratch ----------

const G: P2 = { x: 0, z: 0 };
const HIT: SegmentContact = { x: 0, z: 0, nx: 0, nz: 0, depth: 0, vx: 0, vz: 0 };
const BAR: SegmentXZ = { a: { x: 0, z: 0 }, b: { x: 0, z: 0 }, pivot: { x: 0, z: 0 }, omega: 0 };
const CHORD = { c0: 0, c1: 0 };

function clampSpeed(ball: Ball): void {
   const sp = Math.hypot(ball.vx, ball.vz);
   if (sp > BALL.vCap) {
      ball.vx *= BALL.vCap / sp;
      ball.vz *= BALL.vCap / sp;
   }
}

/** Rails, blades and the bar against the ball (xz), one pass. `prevZ` = the centre's z before this move. */
function collide(hole: Hole, ball: Ball, t: number, prevZ: number, ev: BallEvents): void {
   const zone = hole.terrain === "tiers" ? (ball.upper ? 1 : 2) : 0;
   for (let i = 0; i < hole.rails.length; i++) {
      const r = hole.rails[i];
      if (r.zone !== 0 && r.zone !== zone) continue;
      if (!circleSegmentXZ(ball, r, HIT)) continue;
      const vn = ball.vx * HIT.nx + ball.vz * HIT.nz;
      if (-vn > ev.railHit) {
         ev.railHit = -vn;
         ev.railX = ball.x;
      }
      resolveCircleSegmentXZ(ball, HIT, r.e, r.mu);
   }
   const w = hole.windmill;
   if (w) {
      // blades collide by their face only (normal +-z): a blade moves along its own line, never pushing sideways
      if (Math.abs(ball.z - w.bladeZ) < ball.radius) {
         for (let k = 0; k < 4; k++) {
            if (!bladeChord(w.hubY, w.length, w.halfWidth, w.phase + w.omega * t + (k * Math.PI) / 2, CHORD)) continue;
            if (ball.x < CHORD.c0 || ball.x > CHORD.c1) continue;
            const side = prevZ >= w.bladeZ ? 1 : -1;
            ball.z = w.bladeZ + side * ball.radius;
            if (ball.vz * side < 0) ball.vz = -MOVING.bladeE * ball.vz;
            ev.movingHit = true;
            break;
         }
      }
   }
   if (hole.turntable && circleSegmentXZ(ball, barAt(hole, t, BAR), HIT)) {
      resolveCircleSegmentXZ(ball, HIT, MOVING.barE, MOVING.barMu);
      ev.movingHit = true;
   }
   clampSpeed(ball);
}

/** The cup: capture under captureSpeed, else a lip-out, judged once per pass. True when captured. */
function judgeCup(hole: Hole, ball: Ball, ev: BallEvents): boolean {
   const cx = hole.cup.x - ball.x;
   const cz = hole.cup.z - ball.z;
   const d = Math.hypot(cx, cz);
   if (d > CUP.radius) {
      ball.inCup = false;
      return false;
   }
   if (ball.inCup) return false;
   ball.inCup = true;
   const sp = Math.hypot(ball.vx, ball.vz);
   if (sp < CUP.captureSpeed) {
      capture(hole, ball, ev);
      return true;
   }
   // turned away from the cup's centre, the more the closer the line passes it (dead centre: right, mirrored left)
   const cross = (ball.vx * cz - ball.vz * cx) / sp;
   const miss = Math.min(Math.abs(cross), CUP.radius);
   const turn = CUP.lipTurn * (1 - miss / CUP.radius);
   const a = cross > 0 ? -turn : cross < 0 ? turn : turn * hole.sx;
   const c = Math.cos(a) * CUP.lipKeep;
   const s = Math.sin(a) * CUP.lipKeep;
   const vx = ball.vx;
   ball.vx = vx * c - ball.vz * s;
   ball.vz = vx * s + ball.vz * c;
   ev.lipOut = true;
   return false;
}

function capture(hole: Hole, ball: Ball, ev: BallEvents): void {
   ball.mode = "cup";
   ball.vx = 0;
   ball.vz = 0;
   ball.x = hole.cup.x;
   ball.z = hole.cup.z;
   ev.captured = true;
}

function inPond(hole: Hole, x: number, z: number): boolean {
   for (const p of hole.ponds) if (x >= p.x0 && x <= p.x1 && z >= p.z0 && z <= p.z1) return true;
   return false;
}

function startFlight(ball: Ball, y0: number, vy: number): void {
   ball.mode = "air";
   ball.y0 = y0;
   ball.y = y0;
   ball.vy0 = vy;
   ball.airT = 0;
}

/**
 * One sub-step of `dt` seconds at hole time `t` (seconds since the hole opened, the moving walls'
 * clock). Writes what happened into `ev`; returns false when the stroke is over (rest, cup, water).
 * A water ball is left where it splashed (rules.ts puts it back).
 */
export function stepBall(hole: Hole, ball: Ball, t: number, dt: number, ev: BallEvents): boolean {
   switch (ball.mode) {
      case "pipe": {
         ball.pipeLeft -= dt;
         if (ball.pipeLeft > 0) return true;
         const p = hole.pipes[ball.pipe];
         ball.x = p.exit.x + p.dir.x * (ball.radius + 0.01);
         ball.z = p.exit.z + p.dir.z * (ball.radius + 0.01);
         ball.vx = p.dir.x * ball.pipeSpeed;
         ball.vz = p.dir.z * ball.pipeSpeed;
         ball.mode = "roll";
         ball.upper = false;
         ball.inCup = false;
         ball.y = BALL.radius;
         ev.pipeOut = true;
         return true;
      }
      case "air":
         return stepAir(hole, ball, t, dt, ev);
      case "roll":
         return stepRoll(hole, ball, t, dt, ev);
      default:
         return false;
   }
}

function stepRoll(hole: Hole, ball: Ball, t: number, dt: number, ev: BallEvents): boolean {
   gradientAt(hole, ball.x, ball.z, G);
   ball.vx -= BALL.slope * G.x * dt;
   ball.vz -= BALL.slope * G.z * dt;
   // friction against the velocity, never reversing it
   const sp = Math.hypot(ball.vx, ball.vz);
   const dec = BALL.friction * dt;
   if (sp <= dec) {
      ball.vx = 0;
      ball.vz = 0;
   } else {
      ball.vx *= (sp - dec) / sp;
      ball.vz *= (sp - dec) / sp;
   }
   clampSpeed(ball);
   const prevZ = ball.z;
   ball.x += ball.vx * dt;
   ball.z += ball.vz * dt;
   collide(hole, ball, t, prevZ, ev);

   // level changes: off hole 3's lip or the landing green's edge, into a pipe
   if (hole.terrain === "ramp" && ball.z < RAMP.lip && ball.z > RAMP.gapEnd) {
      if (prevZ >= RAMP.lip) startFlight(ball, (heightAt(hole, ball.x, RAMP.lip) ?? 0) + BALL.radius, -ball.vz * RAMP.grade);
      else startFlight(ball, BALL.radius, 0);
      return stepAir(hole, ball, t, 0, ev);
   }
   if (hole.terrain === "tiers" && ball.upper && ball.z < TIER_WALL_Z) {
      for (let i = 0; i < hole.pipes.length; i++) {
         if (Math.abs(ball.x - hole.pipes[i].mouth.x) > MOUTH.half) continue;
         const v = Math.hypot(ball.vx, ball.vz);
         ball.mode = "pipe";
         ball.pipe = i;
         ball.pipeSpeed = v;
         ball.pipeLeft = hole.pipes[i].length / Math.max(v, PIPE_MIN_SPEED);
         ev.pipeIn = true;
         return true;
      }
      // never past the wall elsewhere (the guides' end caps stop it first)
      ball.z = TIER_WALL_Z + ball.radius;
      if (ball.vz < 0) ball.vz = -0.75 * ball.vz;
   }
   ball.y = (heightAt(hole, ball.x, ball.z, ball.upper) ?? 0) + BALL.radius;
   if (inPond(hole, ball.x, ball.z)) {
      ev.water = true;
      return false;
   }
   if (judgeCup(hole, ball, ev)) return false;
   const v = Math.hypot(ball.vx, ball.vz);
   if (v < BALL.restSpeed && slopePull(hole, ball.x, ball.z) <= BALL.friction) {
      ball.vx = 0;
      ball.vz = 0;
      ball.mode = "rest";
      if (Math.hypot(hole.cup.x - ball.x, hole.cup.z - ball.z) <= CUP.radius) {
         capture(hole, ball, ev);
         return false;
      }
      ev.rested = true;
      return false;
   }
   return true;
}

function stepAir(hole: Hole, ball: Ball, t: number, dt: number, ev: BallEvents): boolean {
   const prevZ = ball.z;
   ball.airT += dt;
   ball.x += ball.vx * dt;
   ball.z += ball.vz * dt;
   // closed form: no drift whatever the step
   ball.y = ball.y0 + ball.vy0 * ball.airT - 0.5 * BALL.gravity * ball.airT * ball.airT;
   if (dt > 0) collide(hole, ball, t, prevZ, ev);
   const ground = heightAt(hole, ball.x, ball.z);
   if (ground === null) {
      if (ball.y < RAMP.waterY) {
         ev.water = true;
         return false;
      }
      return true;
   }
   if (ball.y > ground + BALL.radius) return true;
   if (ball.y < ground + BALL.radius - 0.03) {
      // under the felt's edge: it hits the gap's side wall and drops back into the gap
      ball.z = prevZ;
      ball.vz = -BALL.bounce * ball.vz;
      return true;
   }
   const vy = ball.vy0 - BALL.gravity * ball.airT;
   const up = -BALL.bounce * vy;
   ball.vx *= BALL.landKeep;
   ball.vz *= BALL.landKeep;
   ev.landed = true;
   if (up < BALL.rollBelow) {
      ball.mode = "roll";
      ball.y = ground + BALL.radius;
      ball.inCup = false;
      return true;
   }
   startFlight(ball, ground + BALL.radius, up);
   return true;
}

/** Is a resting ball inside the windmill's tunnel (it is put back at the entrance)? */
export function inTunnel(hole: Hole, ball: Ball): boolean {
   return !!hole.windmill && Math.abs(ball.x) < WINDMILL.tunnelHalf && Math.abs(ball.z) <= WINDMILL.halfZ;
}

// ---------- the aim preview ----------

const PROBE = { x: 0, z: 0, vx: 0, vz: 0, radius: BALL.radius };
/** The preview's longest line (m): long putts are read, not computed. */
export const PREVIEW_MAX = 2.5;
const PREVIEW_STEP = 0.005;

/**
 * How far the preview dots reach: the first static-rail contact along (dx, dz) from the ball, the
 * flat roll v0^2 / (2 friction), or PREVIEW_MAX, whichever is shortest (slopes and bounces not shown).
 */
export function previewLength(hole: Hole, ball: Ball, dx: number, dz: number, v0: number): number {
   const flat = (v0 * v0) / (2 * BALL.friction);
   const max = Math.min(flat, PREVIEW_MAX);
   const zone = hole.terrain === "tiers" ? (ball.upper ? 1 : 2) : 0;
   for (let s = PREVIEW_STEP; s < max; s += PREVIEW_STEP) {
      PROBE.x = ball.x + dx * s;
      PROBE.z = ball.z + dz * s;
      for (let i = 0; i < hole.rails.length; i++) {
         const r = hole.rails[i];
         if ((r.zone === 0 || r.zone === zone) && circleSegmentXZ(PROBE, r, HIT)) return s;
      }
   }
   return max;
}

/** The hill's grade (exported for the never-rests test). */
export const HILL_PULL = BALL.slope * HILL_GRADE;
