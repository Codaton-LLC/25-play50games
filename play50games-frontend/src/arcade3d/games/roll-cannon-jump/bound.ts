// The score proof (README "Server limits and why they hold"): the least finish ms any run of a level
// can reach, over every hero, every shot and every route, including skipping cannons. Pure; the
// tests and the limits table use it, the page never runs it (rules.ts pins the limits).
//
// The run is a chain of rests: in a cannon, on a platform, on a balloon, off a trampoline. Between
// two rests the hero flies, and every flight obeys three bounds that hold for every input:
// - Horizontal: the launch's horizontal speed Vh, plus at most the air nudge (1.5 m/s^2), plus Riko's
//   one dash (exactly 4 m). Nothing else pushes forward (walls and poles only end a flight).
// - Vertical: the height is at most the launch's free arc (Vy t - G t^2 / 2); a dive only pulls
//   down; Nami's second arc resets vy to 12 at the best moment (computed exactly).
// - The rests themselves: a cannon catch costs its 0.4 s hit-stop and the power ring starts at
//   60 %, so a shot of power P waits at least (P - 0.6) / 0.4 * 600 ms; a balloon hangs 350 ms;
//   a trampoline throws at most 4 m/s across and 24 m/s up; a platform walk is 4 m/s with a 7 m/s hop.
// Every rest is a node (a moving cannon is the whole box its rail sweeps); an edge costs the least
// wait plus flight over a fine grid of (power, pitch) cells, each cell bounded by its fastest corner,
// with the target's catch reach taken off both the horizontal gap and the climb. Dijkstra from cannon
// 0 gives the least arrival at the finish ring. Level 5 adds Ashbag's least defeat time from the
// moment the stage is reached (the boss starts then; its windows are time-driven).
// Then the least submitted time takes off every orb (400 ms each) and the most flow bonus.
import { comboMaxBonus } from "@/arcade3d/menu2/combo/combo";
import { createBoss, createBossEvents, hitBoss, stepBoss } from "@/arcade3d/menu2/boss/boss";
import type { LevelId } from "@/arcade3d/types";
import { DASH_EXTRA_M, NAMI_VY } from "./heroes";
import { ASHBAG } from "./progression";
import {
   BALLOON_MS,
   CATCH_MS,
   CATCH_R,
   FOOT,
   G,
   HERO_R,
   NUDGE_A,
   ORB,
   PITCH_MAX,
   PITCH_MIN,
   PULSE_MIN,
   TRAMP_H_MAX,
   TRAMP_VY_MAX,
   V_PJUMP,
   V_WALK,
   comboSpecOf,
   launchSpeed,
   pulseWaitMs,
   type LevelLimits,
} from "./rules";
import type { CannonDef, Course } from "./show";

interface Box {
   minX: number;
   maxX: number;
   minY: number;
   maxY: number;
   minZ: number;
   maxZ: number;
}

/** A launch: a list of cells, each (least wait ms, top horizontal speed, top vertical speed). */
type Cells = Float64Array;

interface Node {
   label: string;
   kind: "cannon" | "platform" | "tramp" | "balloon" | "finish";
   index: number;
   /** where the hero's middle is while resting / where it must get to */
   box: Box;
   /** the target's reach: off the horizontal gap and off the climb */
   reachH: number;
   reachV: number;
   /** ms paid on arrival (a catch's hit-stop, a balloon's hang) */
   arrive: number;
   cells: Cells | null;
   /** level 5: reaching it starts Ashbag */
   arena: boolean;
}

export type Variant = "plain" | "riko" | "nami";

/** Grid resolution: power cells (0.6..1) and pitch cells (20..70 deg). */
export const GRID = { power: 40, pitch: 50 } as const;

function pointBox(x: number, y: number, z: number): Box {
   return { minX: x, maxX: x, minY: y, maxY: y, minZ: z, maxZ: z };
}

function cannonBox(c: CannonDef): Box {
   const b = pointBox(c.x, c.y, c.z);
   const r = c.rail;
   if (r) {
      for (const s of [-r.travel, r.travel]) {
         b.minX = Math.min(b.minX, c.x + r.ax * s);
         b.maxX = Math.max(b.maxX, c.x + r.ax * s);
         b.minY = Math.min(b.minY, c.y + r.ay * s);
         b.maxY = Math.max(b.maxY, c.y + r.ay * s);
         b.minZ = Math.min(b.minZ, c.z + r.az * s);
         b.maxZ = Math.max(b.maxZ, c.z + r.az * s);
      }
   }
   return b;
}

/** The pulse cells of an aiming cannon (or a balloon re-aim): every (power, pitch) cell at its fastest corner. */
function pulseCells(): Cells {
   const out = new Float64Array(GRID.power * GRID.pitch * 3);
   let k = 0;
   for (let i = 0; i < GRID.power; i++) {
      const p0 = PULSE_MIN + ((1 - PULSE_MIN) * i) / GRID.power;
      const p1 = PULSE_MIN + ((1 - PULSE_MIN) * (i + 1)) / GRID.power;
      const wait = pulseWaitMs(p0);
      const v = launchSpeed(p1);
      for (let j = 0; j < GRID.pitch; j++) {
         const a0 = PITCH_MIN + ((PITCH_MAX - PITCH_MIN) * j) / GRID.pitch;
         const a1 = PITCH_MIN + ((PITCH_MAX - PITCH_MIN) * (j + 1)) / GRID.pitch;
         out[k++] = wait;
         out[k++] = v * Math.cos(a0);
         out[k++] = v * Math.sin(a1);
      }
   }
   return out;
}

const PULSE_CELLS = pulseCells();

function fixedCells(power: number, pitch: number): Cells {
   const v = launchSpeed(power);
   return Float64Array.from([0, v * Math.cos(pitch), v * Math.sin(pitch)]);
}

/** Every rest of the course as a node. Node 0 is cannon 0 (the start). */
export function buildNodes(course: Course): Node[] {
   const nodes: Node[] = [];
   const stageCannons = new Set(course.arena?.cannons ?? []);
   course.cannons.forEach((c, i) => {
      nodes.push({
         label: `c${i}`,
         kind: "cannon",
         index: i,
         box: cannonBox(c),
         reachH: CATCH_R,
         reachV: CATCH_R,
         arrive: CATCH_MS,
         // an aiming cannon pulses; a fixed, wheel (any yaw: the bound ignores yaw) or auto cannon fires its locked shot at once
         cells: c.kind === "aim" ? PULSE_CELLS : fixedCells(c.power, c.pitch),
         arena: c.stage || stageCannons.has(i),
      });
   });
   course.platforms.forEach((p, i) => {
      nodes.push({
         label: `p${i}`,
         kind: "platform",
         index: i,
         box: { minX: p.x - p.hw, maxX: p.x + p.hw, minY: p.y + HERO_R, maxY: p.y + HERO_R, minZ: p.z - p.hd, maxZ: p.z + p.hd },
         reachH: FOOT,
         reachV: 0,
         arrive: 0,
         // walking off the edge (4 m/s across, 0 up) or a hop (7 m/s up)
         cells: Float64Array.from([0, V_WALK, V_PJUMP]),
         arena: !!course.arena && course.arena.platform === i,
      });
   });
   course.tramps.forEach((t, i) => {
      nodes.push({
         label: `t${i}`,
         kind: "tramp",
         index: i,
         box: { minX: t.x - t.r, maxX: t.x + t.r, minY: t.y + HERO_R, maxY: t.y + HERO_R, minZ: t.z - t.r, maxZ: t.z + t.r },
         reachH: FOOT,
         reachV: 0,
         arrive: 0,
         cells: Float64Array.from([0, TRAMP_H_MAX, TRAMP_VY_MAX]),
         arena: false,
      });
   });
   course.balloons.forEach((b, i) => {
      nodes.push({
         label: `b${i}`,
         kind: "balloon",
         index: i,
         box: { minX: b.x, maxX: b.x, minY: b.y - b.r * 0.4, maxY: b.y - b.r * 0.4, minZ: b.z, maxZ: b.z },
         reachH: b.r + HERO_R,
         reachV: b.r + HERO_R,
         arrive: BALLOON_MS,
         cells: PULSE_CELLS,
         arena: false,
      });
   });
   if (course.finish) {
      const f = course.finish;
      nodes.push({ label: "finish", kind: "finish", index: 0, box: pointBox(f.x, f.y, f.z), reachH: f.r, reachV: f.r, arrive: 0, cells: null, arena: false });
   }
   return nodes;
}

function gapH(a: Box, b: Box): number {
   const dx = Math.max(0, a.minX - b.maxX, b.minX - a.maxX);
   const dz = Math.max(0, a.minZ - b.maxZ, b.minZ - a.maxZ);
   return Math.hypot(dx, dz);
}

/** The highest the hero's middle can be `t` s into a flight launched at vy (Nami: with her one reset to NAMI_VY). */
export function heightEnvelope(vy: number, t: number, nami: boolean): number {
   const plain = vy * t - (G / 2) * t * t;
   if (!nami) return plain;
   // reset at s: vy s - G s^2/2 + Vn (t - s) - G (t - s)^2 / 2, concave in s
   const vn = NAMI_VY;
   let s = (vy - vn + G * t) / (2 * G);
   if (s < 0) s = 0;
   if (s > t) s = t;
   const reset = vy * s - (G / 2) * s * s + vn * (t - s) - (G / 2) * (t - s) * (t - s);
   return Math.max(plain, reset);
}

/**
 * The least flight time (s) to cover `d` m across and reach a climb of `climb` m (negative = a drop)
 * from a launch of horizontal speed vh and vertical speed vy; Infinity if it cannot.
 */
export function flightLowerBound(d: number, climb: number, vh: number, vy: number, variant: Variant): number {
   const dh = Math.max(0, d - (variant === "riko" ? DASH_EXTRA_M : 0));
   const a = NUDGE_A;
   const th = dh <= 0 ? 0 : (-vh + Math.sqrt(vh * vh + 2 * a * dh)) / a;
   const nami = variant === "nami";
   if (climb <= 0) return heightEnvelope(vy, th, nami) >= climb ? th : Infinity;
   if (!nami) {
      const disc = vy * vy - 2 * G * climb;
      if (disc < 0) return Infinity;
      const up = (vy - Math.sqrt(disc)) / G;
      const down = (vy + Math.sqrt(disc)) / G;
      const t = Math.max(th, up);
      return t <= down ? t : Infinity;
   }
   // Nami: the envelope is concave in t; find its peak, then the rising crossing
   let lo = 0;
   let hi = (2 * (vy + NAMI_VY)) / G + 0.5;
   for (let k = 0; k < 80; k++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (heightEnvelope(vy, m1, true) < heightEnvelope(vy, m2, true)) lo = m1;
      else hi = m2;
   }
   const peak = (lo + hi) / 2;
   if (heightEnvelope(vy, peak, true) < climb) return Infinity;
   let a0 = 0;
   let a1 = peak;
   for (let k = 0; k < 80; k++) {
      const m = (a0 + a1) / 2;
      if (heightEnvelope(vy, m, true) >= climb) a1 = m;
      else a0 = m;
   }
   const up = a0;
   if (th <= up) return up;
   if (th <= peak) return th;
   return heightEnvelope(vy, th, true) >= climb ? th : Infinity;
}

/** The least ms from resting at `u` (its aim just open) to arriving at `v` (before v's own arrival cost). */
export function edgeMs(u: Node, v: Node, variant: Variant): number {
   if (!u.cells) return Infinity;
   const d = Math.max(0, gapH(u.box, v.box) - v.reachH - 0.02);
   const climb = v.box.minY - v.reachV - u.box.maxY;
   let best = Infinity;
   const c = u.cells;
   for (let k = 0; k < c.length; k += 3) {
      const wait = c[k];
      if (wait >= best) continue;
      const t = flightLowerBound(d, climb, c[k + 1], c[k + 2], variant);
      if (!Number.isFinite(t)) continue;
      const ms = wait + t * 1000;
      if (ms < best) best = ms;
   }
   return best;
}

/** Walking on a platform into a cannon it carries: the gap at 4 m/s. */
function walkMs(p: Node, c: Node): number {
   const dy = Math.max(0, c.box.minY - p.box.maxY, p.box.minY - c.box.maxY);
   if (dy > CATCH_R) return Infinity;
   const d = Math.max(0, gapH(p.box, c.box) - CATCH_R);
   return (d * 1000) / V_WALK;
}

export interface BoundResult {
   /** least ms to the finish ring (levels 1-4) or to the stage (level 5) */
   ms: number;
   /** each node's least arrival (before its own arrival cost) */
   arrival: number[];
   labels: string[];
}

/** Dijkstra from cannon 0 over every rest (one hero variant). */
export function dijkstra(course: Course, variant: Variant, nodes = buildNodes(course)): BoundResult {
   const n = nodes.length;
   // dist = least ms at which the node's rest begins (its aim opens): arrival + its arrival cost
   const dist = new Array<number>(n).fill(Infinity);
   const arrival = new Array<number>(n).fill(Infinity);
   const done = new Array<boolean>(n).fill(false);
   dist[0] = 0;
   arrival[0] = 0;
   for (;;) {
      let u = -1;
      for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
      if (u < 0) break;
      done[u] = true;
      const nu = nodes[u];
      for (let v = 0; v < n; v++) {
         if (v === u || done[v]) continue;
         const nv = nodes[v];
         let e = edgeMs(nu, nv, variant);
         if (nu.kind === "platform" && nv.kind === "cannon") e = Math.min(e, walkMs(nu, nv));
         if (!Number.isFinite(e)) continue;
         const at = dist[u] + e;
         if (at < arrival[v]) arrival[v] = at;
         const rest = at + nv.arrive;
         if (rest < dist[v]) dist[v] = rest;
      }
   }
   let ms = Infinity;
   if (course.arena) {
      for (let i = 0; i < n; i++) if (nodes[i].arena) ms = Math.min(ms, arrival[i]);
   } else {
      const f = nodes.findIndex((x) => x.kind === "finish");
      ms = f >= 0 ? arrival[f] : Infinity;
   }
   return { ms, arrival, labels: nodes.map((x) => x.label) };
}

/** The earliest rules ms after the stage is reached that Ashbag can be down: every window hit at its first ms. */
export function bossMinMs(): number {
   const s = createBoss(ASHBAG);
   const ev = createBossEvents();
   for (let ms = 1; ms < 600_000; ms++) {
      stepBoss(s, ASHBAG, 1, ev);
      if (s.step === "vulnerable") hitBoss(s, ASHBAG, 1, ev);
      if (s.step === "defeat" || s.step === "done") return ms;
   }
   return Infinity;
}

/** The least progress ms over the three motion variants (plain heroes, Riko's dash, Nami's second arc). */
export function progressFloorMs(course: Course): number {
   const nodes = buildNodes(course);
   let best = Infinity;
   for (const v of ["plain", "riko", "nami"] as const) best = Math.min(best, dijkstra(course, v, nodes).ms);
   // 2 ms of slack per rest on the way for the whole-ms steps (the bound is continuous)
   return Math.floor(best) - 2 * Math.min(40, nodes.length);
}

/** The proven least finish ms. */
export function minFinishMs(course: Course): number {
   const p = progressFloorMs(course);
   return course.arena ? p + bossMinMs() : p;
}

/** The least submitted duration: the least finish minus every orb's bonus and the most flow bonus. */
export function minDurationMsOf(course: Course): number {
   return minFinishMs(course) - course.orbs.length * ORB.bonusMs - comboMaxBonus(comboSpecOf(course));
}

/** minDurationMs = the bound less about 4.5 %, rounded down to 100 ms (94-100 % of it). */
export function proposeLimits(_id: LevelId, course: Course): LevelLimits {
   const lb = minDurationMsOf(course);
   let minDurationMs = Math.floor((lb * 0.955) / 100) * 100;
   if (minDurationMs < lb * 0.94) minDurationMs = Math.ceil((lb * 0.94) / 100) * 100;
   if (minDurationMs > lb) minDurationMs = Math.floor(lb / 100) * 100;
   const timeBaseMs = course.durationMs;
   return { kind: "time", maxScore: Math.floor((timeBaseMs - minDurationMs) / 10), minDurationMs, maxDurationMs: course.durationMs, timeBaseMs };
}
