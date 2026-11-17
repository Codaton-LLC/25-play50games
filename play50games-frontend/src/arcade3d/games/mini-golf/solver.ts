// Test support (imported by the tests only, never by the game): one putt played on its own, the
// robustness check (the same outcome for every start tick in a window, so any frame rate reaches
// it) and the committed lines the bots play (README "Solvable within par"). Pure.
import { WINDMILL, type Hole, type P2 } from "./course";
import { BALL, clearBallEvents, createBall, createBallEvents, inTunnel, launchBall, placeBall, stepBall } from "./physics";

const DEG = Math.PI / 180;

export interface PuttResult {
   captured: boolean;
   water: boolean;
   x: number;
   z: number;
   upper: boolean;
   /** ticks from the start to the stroke's end; -1 = still moving after the guard */
   ticks: number;
}

const ev = createBallEvents();

/** One putt (heading psi rad, power 0-1) from `from`, starting on hole tick `startTick`: exactly what rules.ts does. */
export function playPutt(hole: Hole, from: P2, upper: boolean, psi: number, power: number, startTick: number): PuttResult {
   const b = createBall(from, upper);
   placeBall(hole, b, from, upper);
   launchBall(b, psi, (hole.vMax ?? BALL.vMax) * Math.max(0.1, Math.min(1, power)));
   for (let n = 1; n <= 2400 * 4; n++) {
      clearBallEvents(ev);
      let live = true;
      const tick = startTick + n - 1;
      for (let k = 0; k < 2 && live; k++) live = stepBall(hole, b, (tick * 2 + k) / 240, 1 / 240, ev);
      if (!live) {
         const tunnel = !ev.water && !ev.captured && inTunnel(hole, b);
         return { captured: ev.captured, water: ev.water, x: tunnel ? WINDMILL.entrance.x * hole.sx : b.x, z: tunnel ? WINDMILL.entrance.z : b.z, upper: b.upper, ticks: n };
      }
   }
   return { captured: false, water: false, x: b.x, z: b.z, upper: b.upper, ticks: -1 };
}

/** Start ticks a line must survive: a 50 ms frame spans 6 ticks, so a putt released once the hole reaches tick w starts on w..w+6. */
export const ROBUST_WINDOW = 9;

/** The putt's outcome if it is the same (to the bit) for every start tick w..w+ROBUST_WINDOW-1, else null. */
export function robustPutt(hole: Hole, from: P2, upper: boolean, psi: number, power: number, w: number): PuttResult | null {
   const r0 = playPutt(hole, from, upper, psi, power, w);
   if (r0.ticks < 0) return null;
   if (!hole.windmill && !hole.turntable) return r0;
   for (let k = 1; k < ROBUST_WINDOW; k++) {
      const r = playPutt(hole, from, upper, psi, power, w + k);
      if (r.captured !== r0.captured || r.water !== r0.water || r.x !== r0.x || r.z !== r0.z || r.ticks !== r0.ticks) return null;
   }
   return r0;
}

/** A putt of a line: heading (deg, original orientation; mirrored holes negate it), power, the hole tick to wait for. */
export interface LinePutt {
   a: number;
   p: number;
   w: number;
}

/** Hole-in-one lines (found by a grid search over 0.25 deg / 0.005 power / 5-tick waits; checked in course.test.ts). */
export const ACE_LINES: LinePutt[][] = [
   [{ a: -20.25, p: 0.845, w: 0 }],
   [{ a: -13.5, p: 0.94, w: 0 }],
   [{ a: 2, p: 0.83, w: 0 }],
   [{ a: 2, p: 0.87, w: 0 }],
   [{ a: -26.5, p: 0.915, w: 0 }],
   [{ a: 4.25, p: 0.77, w: 0 }],
];

/** Two-putt lines (a lag, then a robust sink from where it rests): within par on every hole. */
export const PAR_LINES: LinePutt[][] = [
   [{ a: 5, p: 0.85, w: 0 }, { a: -102.61, p: 0.1, w: 511 }],
   [{ a: -3, p: 0.9, w: 0 }, { a: 114.845, p: 0.1, w: 512 }],
   [{ a: 6, p: 0.85, w: 0 }, { a: -145.852, p: 0.13, w: 453 }],
   [{ a: 1, p: 0.8, w: 0 }, { a: 58.033, p: 0.1, w: 481 }],
   [{ a: -2, p: 0.6, w: 0 }, { a: 80.033, p: 0.22, w: 883 }],
   [{ a: 4, p: 0.7, w: 0 }, { a: 85.909, p: 0.1, w: 615 }],
];

/** The world heading of a line putt on this (maybe mirrored) hole. */
export const linePsi = (hole: Hole, putt: LinePutt): number => putt.a * DEG * hole.sx;

/** Beam search at the original solver resolution: 0.5 degrees, 0.01 power, 0.1 s waits.
 * A robust committed candidate is tried first; otherwise retain the six closest safe rests.
 * Tests only: never imported by the frame loop.
 */
export function solveHole(hole: Hole): LinePutt[] | null {
   const scale = BALL.vMax / (hole.vMax ?? BALL.vMax);
   const original = PAR_LINES[hole.index];
   if (original) {
      // Reuse the proven lag as a beam seed; a faster obstacle can require a different wait.
      for (let wait = 0; wait <= 600; wait += 12) {
         const q = { ...original[0], p: original[0].p * scale, w: wait };
         const r = robustPutt(hole, hole.tee, hole.terrain === "tiers", linePsi(hole, q), q.p, q.w);
         if (!r || r.water || r.ticks < 0) continue;
         if (r.captured) return [q];
         const base = Math.atan2(hole.cup.x - r.x, -(hole.cup.z - r.z)) / DEG / hole.sx;
         const w = q.w + r.ticks + ROBUST_WINDOW - 1 + 120;
         for (let da = 0; da <= 6; da += 0.5) for (const sign of [1, -1]) {
            for (let pi = 10; pi <= 100; pi++) {
               const finish = { a: base + sign * da, p: pi / 100, w };
               if (robustPutt(hole, r, r.upper, linePsi(hole, finish), finish.p, finish.w)?.captured) return [q, finish];
            }
         }
      }
   }
   type Node = { x: number; z: number; upper: boolean; next: number; line: LinePutt[]; d: number };
   let beam: Node[] = [{ ...hole.tee, upper: hole.terrain === "tiers", next: 0, line: [], d: 0 }];
   for (let depth = 0; depth < hole.par; depth++) {
      const rests: Node[] = [];
      for (const node of beam) {
         const base = Math.atan2(hole.cup.x - node.x, -(hole.cup.z - node.z)) / DEG / hole.sx;
         // Tee sweep includes bank shots; later shots sweep around the cup heading.
         const angles = depth === 0 ? Array.from({ length: 121 }, (_, i) => -30 + i * 0.5) : Array.from({ length: 25 }, (_, i) => base - 6 + i * 0.5);
         for (const a of angles) for (let pi = 10; pi <= 100; pi++) {
            for (let wait = 0; wait <= (hole.windmill || hole.turntable ? 360 : 0); wait += 12) {
               const q = { a, p: pi / 100, w: node.next + wait };
               const r = robustPutt(hole, node, node.upper, linePsi(hole, q), q.p, q.w);
               if (!r || r.water || r.ticks < 0) continue;
               const line = [...node.line, q];
               if (r.captured) return line;
               if (wait === 0) rests.push({ ...r, next: q.w + ROBUST_WINDOW - 1 + r.ticks + 60, line, d: Math.hypot(r.x - hole.cup.x, r.z - hole.cup.z) });
            }
         }
      }
      rests.sort((a, b) => a.d - b.d);
      beam = rests.slice(0, 6);
   }
   return null;
}

/** Find an ace near the original ace at the same (or finer) resolution as its discovery grid. */
export function solveAce(hole: Hole): LinePutt[] | null {
   const ace = ACE_LINES[hole.index]?.[0];
   if (!ace) return null;
   const power = ace.p * BALL.vMax / (hole.vMax ?? BALL.vMax);
   const waits = hole.windmill || hole.turntable ? Array.from({ length: 51 }, (_, i) => i * 12) : [0];
   const offsets = [0, ...Array.from({ length: 12 }, (_, i) => (i + 1) * 0.25).flatMap(a => [a, -a])];
   const powers = [0, ...Array.from({ length: 12 }, (_, i) => (i + 1) * 0.005).flatMap(a => [a, -a])];
   for (const da of offsets) for (const dp of powers) for (const w of waits) {
      const q = { a: ace.a + da, p: power + dp, w };
      if (robustPutt(hole, hole.tee, hole.terrain === "tiers", linePsi(hole, q), q.p, q.w)?.captured) return [q];
   }
   return null;
}
