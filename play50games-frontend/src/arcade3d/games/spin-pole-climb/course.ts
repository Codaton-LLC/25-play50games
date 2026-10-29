// Spin Pole Climb's courses: pure data and geometry (no React, no three.js, no randomness).
//
// A level is a field of stone POLES. Each pole carries one or more spiral STAIRS (helices). The stair
// is fixed in the world; the pole's stone core turns and drags whoever stands on its stair round with
// it (the card's escalator / treadmill). A point on a stair is its unwrapped world angle `a`: the hero
// stands at (pole.x + W sin a, stairY(a), pole.z + W cos a), and one lap (2 pi) rises `pitch` metres.
// So the hero's height only ever comes from running round: rules.ts and the score proof rest on that.
// Hazards sit on stairs by angle (spikes, gaps, spore vents, the cracked urn) or ride their own rings
// round a pole (sweeper bars). The bot follows the course's `route` of hops.
import type { LevelId } from "../../types";
import { LEVELS, type SpinLevel } from "./levels";

export const TAU = Math.PI * 2;
/** the stone core radius and the stair radius (where the hero runs) of a normal pole (m) */
export const CORE_R = 0.75;
export const WALK_R = 1.65;
/** one lap of a normal stair rises this far (m) */
export const PITCH = 3;
/** two poles closer than this are neighbours (a hop can join them) */
export const HOP_REACH = 7;

/** A pole's spin (rad/s, + = the way its stairs climb). `flipMs`: it reverses every flipMs (L3). */
export interface Spin {
   omega: number;
   flipMs: number;
   phaseMs: number;
}

export interface Pole {
   id: number;
   x: number;
   z: number;
   core: number;
   walk: number;
   spin: Spin;
   /** Vexa's ghost pole: only a phased hero can hop onto it */
   ghost: boolean;
   /** the big central pole (L4 tower, L5 boss): drawn wider */
   wide: boolean;
   /** the pole's top is a mushroom cap (a rest point) rather than a stone disc */
   mushroom: boolean;
}

export interface Helix {
   id: number;
   pole: number;
   y0: number;
   /** the stair's start angle (unwrapped world angle) */
   a0: number;
   laps: number;
   pitch: number;
   /** reaching its top wins the level (the goal cap) */
   goal: boolean;
}

export interface Sweeper {
   pole: number;
   y: number;
   omega: number;
   phase: number;
}

/** A stretch of stair by unwrapped angle. `move` slides it up and down the stair (L4 spike collars). */
export interface Stretch {
   helix: number;
   from: number;
   to: number;
   move: number;
   periodMs: number;
}

export interface Spore extends Stretch {
   onMs: number;
   offMs: number;
   phaseMs: number;
}

export type OrbGate = "" | "riko" | "nami" | "kiro" | "zuno";

/** A colour orb: on a stair at angle `at`, `air` m over the steps. Zuno's orb sits inside a hollow pole. */
export interface Orb {
   helix: number;
   at: number;
   air: number;
   gate: OrbGate;
   x: number;
   y: number;
   z: number;
}

/** The bot's plan on a stair: climb it, and once at or over `minY` hop to `to` (-1: climb to the top). */
export interface RouteStep {
   helix: number;
   to: number;
   minY: number;
}

export interface Course {
   level: LevelId;
   cfg: SpinLevel;
   poles: Pole[];
   helices: Helix[];
   sweepers: Sweeper[];
   gaps: Stretch[];
   spikes: Stretch[];
   spores: Spore[];
   orbs: Orb[];
   /** how many of `orbs` are main orbs (any hero; the second star) */
   mainOrbs: number;
   /** Riko's cracked urn on a stair (a dash breaks it; its orb is the Riko orb) */
   urns: { helix: number; at: number }[];
   /** the hidden checkpoint disc (a cap and its angle): standing on it spins every pole your way for 10 s */
   disc: { helix: number; at: number } | null;
   start: { helix: number; at: number };
   route: RouteStep[];
   top: number;
}

// ---------- geometry ----------

export const wrapPi = (a: number): number => a - TAU * Math.floor((a + Math.PI) / TAU);
/** The direction (world angle) from pole p to the point (x, z). */
export const dirTo = (p: { x: number; z: number }, x: number, z: number): number => Math.atan2(x - p.x, z - p.z);
export const helixTop = (h: Helix): number => h.y0 + h.pitch * h.laps;
export const helixEnd = (h: Helix): number => h.a0 + TAU * h.laps;
/** The stair's height at unwrapped angle a (clamped to the stair). */
export function stairY(h: Helix, a: number): number {
   const t = Math.max(0, Math.min(TAU * h.laps, a - h.a0));
   return h.y0 + (h.pitch * t) / TAU;
}

/** The pole's spin now (rad/s), for any pole whose spin is not overridden. */
export function spinOmega(s: Spin, ms: number): number {
   if (s.flipMs <= 0) return s.omega;
   const k = Math.floor((ms + s.phaseMs) / s.flipMs);
   return k % 2 === 0 ? s.omega : -s.omega;
}

/** How long until the pole flips (ms), Infinity for a steady pole: the 1 s glyph flash warns of it. */
export function msToFlip(s: Spin, ms: number): number {
   if (s.flipMs <= 0) return Number.POSITIVE_INFINITY;
   const t = (ms + s.phaseMs) % s.flipMs;
   return s.flipMs - t;
}

/** A stretch's range now (a spike collar slides along its stair). */
export function stretchAt(s: Stretch, ms: number, out: { from: number; to: number }): { from: number; to: number } {
   const off = s.move > 0 ? s.move * Math.sin((TAU * ms) / s.periodMs) : 0;
   out.from = s.from + off;
   out.to = s.to + off;
   return out;
}

/**
 * A spore stretch with offMs 0 is a VEIL: a still cloud that hurts nobody but hides the orb in it from
 * everyone except a shielded Kiro. A timed vent (offMs > 0) puffs for onMs and hurts an unshielded hero.
 */
export const isVeil = (s: Spore): boolean => s.offMs <= 0;

export function sporeOn(s: Spore, ms: number): boolean {
   if (s.offMs <= 0) return true;
   const t = (ms + s.phaseMs) % (s.onMs + s.offMs);
   return t < s.onMs;
}

/** A sweeper's arm angle now (world). */
export const sweeperAngle = (s: Sweeper, ms: number): number => s.phase + (s.omega * ms) / 1000;

/** The unwrapped angle on stair h whose world direction is `dir` and whose height is the highest at or under y (NaN if none). */
export function turnUnder(h: Helix, dir: number, y: number): number {
   const first = h.a0 + (((dir - h.a0) % TAU) + TAU) % TAU;
   let best = Number.NaN;
   for (let a = first; a <= helixEnd(h) + 1e-9; a += TAU) if (stairY(h, a) <= y + 1e-6) best = a;
   return best;
}

// ---------- the five levels ----------

const pole = (id: number, x: number, z: number, omega: number, extra: Partial<Pole> = {}): Pole => ({
   id, x, z, core: CORE_R, walk: WALK_R, spin: { omega, flipMs: 0, phaseMs: 0 }, ghost: false, wide: false, mushroom: false, ...extra,
});
const helix = (id: number, p: Pole, y0: number, a0: number, laps: number, goal = false, pitch = PITCH): Helix => ({ id, pole: p.id, y0, a0, laps, pitch, goal });
const stretch = (helix: number, from: number, to: number, move = 0, periodMs = 0): Stretch => ({ helix, from, to, move, periodMs });
const spore = (helix: number, from: number, to: number, onMs: number, offMs: number, phaseMs = 0): Spore => ({ helix, from, to, move: 0, periodMs: 0, onMs, offMs, phaseMs });

/** The orb's world point (a hollow-pole orb sits on the axis at its height). */
function placeOrb(o: Omit<Orb, "x" | "y" | "z">, poles: Pole[], helices: Helix[]): Orb {
   const h = helices[o.helix];
   const p = poles[h.pole];
   if (o.gate === "zuno") return { ...o, x: p.x, y: stairY(h, o.at) + 1, z: p.z };
   return { ...o, x: p.x + p.walk * Math.sin(o.at), y: stairY(h, o.at) + o.air + 0.6, z: p.z + p.walk * Math.cos(o.at) };
}

const back = (from: Pole, to: Pole) => dirTo(from, to.x, to.z);

function level1(): Omit<Course, "level" | "cfg" | "top"> {
   // Three beats, then a choice: A still, B spins with you, C against you (D beside it spins with you)
   const A = pole(0, -6, 0, 0);
   const B = pole(1, -1, 0, 0.35, { mushroom: true });
   const C = pole(2, 4, 0, -0.45);
   const D = pole(3, 4, -5, 0.35);
   const G = pole(4, -6, -5, 0, { ghost: true, mushroom: true });
   const poles = [A, B, C, D, G];
   const helices = [
      helix(0, A, 0, 0, 2),
      helix(1, B, 6, back(B, A), 2),
      helix(2, C, 12, back(C, B), 2, true),
      helix(3, D, 12, back(D, C) - Math.PI, 2, true),
      helix(4, G, 3, back(G, A), 1.5),
   ];
   const orbs = [
      { helix: 0, at: Math.PI, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 3.2 * Math.PI, air: 0.4, gate: "" as OrbGate },
      { helix: 1, at: back(B, A) + 2.2, air: 0, gate: "" as OrbGate },
      { helix: 1, at: back(B, A) + 8, air: 0.4, gate: "" as OrbGate },
      { helix: 3, at: back(D, C) + 1.6, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 2.4, air: 0, gate: "riko" as OrbGate },
      { helix: 1, at: back(B, A) + 5.2, air: 2.3, gate: "nami" as OrbGate },
      { helix: 1, at: back(B, A) + 10.6, air: 0, gate: "kiro" as OrbGate },
      { helix: 2, at: back(C, B) + 7, air: 0, gate: "zuno" as OrbGate },
   ].map((o) => placeOrb(o, poles, helices));
   return {
      poles, helices, sweepers: [], gaps: [stretch(1, back(B, A) + 6.6, back(B, A) + 7.1)], spikes: [],
      spores: [spore(1, back(B, A) + 10.3, back(B, A) + 10.9, 1, 0)],
      orbs, mainOrbs: 5, urns: [{ helix: 0, at: 2.4 }], disc: { helix: 1, at: 0 },
      start: { helix: 0, at: 0 },
      route: [
         { helix: 0, to: 1, minY: 6 },
         { helix: 1, to: 2, minY: 12 },
         { helix: 2, to: 3, minY: 13.5 },
         { helix: 3, to: -1, minY: 0 },
      ],
   };
}

function level2(): Omit<Course, "level" | "cfg" | "top"> {
   // Twin poles turning opposite ways, sweeper bars on their own spin; hop to whichever suits you
   const A = pole(0, -2.6, 0, 0.4);
   const B = pole(1, 2.6, 0, -0.4);
   const G = pole(2, 0, -4.6, 0, { ghost: true, mushroom: true });
   const poles = [A, B, G];
   const helices = [helix(0, A, 0, 0, 8, true), helix(1, B, 0, Math.PI, 8, true), helix(2, G, 9, back(G, A), 1.5)];
   const sweepers: Sweeper[] = [];
   for (const [k, y] of [4.5, 9, 13.5, 18, 21].entries()) {
      sweepers.push({ pole: 0, y, omega: -1.25, phase: k * 1.3 });
      sweepers.push({ pole: 1, y: y + 1.5, omega: 1.25, phase: k * 1.7 + 0.5 });
   }
   const orbs = [
      { helix: 0, at: 2.2, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 9.4, air: 0.4, gate: "" as OrbGate },
      { helix: 1, at: Math.PI + 18, air: 0, gate: "" as OrbGate },
      { helix: 1, at: Math.PI + 27, air: 0, gate: "" as OrbGate },
      { helix: 1, at: Math.PI + 40, air: 0.4, gate: "" as OrbGate },
      { helix: 0, at: 5, air: 0, gate: "riko" as OrbGate },
      { helix: 0, at: 13, air: 2.3, gate: "nami" as OrbGate },
      { helix: 1, at: Math.PI + 20.3, air: 0, gate: "kiro" as OrbGate },
      { helix: 1, at: Math.PI + 33, air: 0, gate: "zuno" as OrbGate },
   ].map((o) => placeOrb(o, poles, helices));
   return {
      poles, helices, sweepers, gaps: [stretch(0, 16.2, 16.7), stretch(1, Math.PI + 30.4, Math.PI + 30.9)], spikes: [],
      spores: [spore(1, Math.PI + 20, Math.PI + 20.6, 1, 0), spore(1, Math.PI + 8, Math.PI + 8.7, 1000, 1800)],
      orbs, mainOrbs: 5, urns: [{ helix: 0, at: 5 }], disc: null,
      start: { helix: 0, at: 0 },
      route: [
         { helix: 0, to: 1, minY: 6 },
         { helix: 1, to: -1, minY: 0 },
      ],
   };
}

function level3(): Omit<Course, "level" | "cfg" | "top"> {
   // Three poles that flip every 6 s, a second apart: read the glyph flash, hop to the one turning your way
   const flip = (omega: number, phaseMs: number): Spin => ({ omega, flipMs: 6000, phaseMs });
   const A = pole(0, -5, 0, 0, { spin: flip(0.6, 0), mushroom: true });
   const B = pole(1, 0, -1.5, 0, { spin: flip(0.6, 2000) });
   const C = pole(2, 5, 0, 0, { spin: flip(0.6, 4000) });
   const G = pole(3, -5, -5.5, 0, { ghost: true, mushroom: true });
   const poles = [A, B, C, G];
   const helices = [
      helix(0, A, 0, 0, 4),
      helix(1, B, 6, back(B, A), 6),
      helix(2, C, 18, back(C, B), 4, true),
      helix(3, G, 6, back(G, A), 1.5),
   ];
   const sweepers: Sweeper[] = [
      { pole: 0, y: 4.5, omega: -1.1, phase: 0 },
      { pole: 1, y: 12, omega: 1.2, phase: 1 },
      { pole: 1, y: 19.5, omega: -1.2, phase: 2 },
      { pole: 2, y: 25.5, omega: 1.1, phase: 0.5 },
   ];
   const b0 = back(B, A);
   const c0 = back(C, B);
   const orbs = [
      { helix: 0, at: 3, air: 0, gate: "" as OrbGate },
      { helix: 1, at: b0 + 4, air: 0.4, gate: "" as OrbGate },
      { helix: 1, at: b0 + 16, air: 0, gate: "" as OrbGate },
      { helix: 2, at: c0 + 4, air: 0, gate: "" as OrbGate },
      { helix: 2, at: c0 + 17, air: 0.4, gate: "" as OrbGate },
      { helix: 0, at: 9, air: 0, gate: "riko" as OrbGate },
      { helix: 1, at: b0 + 10, air: 2.3, gate: "nami" as OrbGate },
      { helix: 2, at: c0 + 10.3, air: 0, gate: "kiro" as OrbGate },
      { helix: 1, at: b0 + 22, air: 0, gate: "zuno" as OrbGate },
   ].map((o) => placeOrb(o, poles, helices));
   return {
      poles, helices, sweepers, gaps: [stretch(1, b0 + 13, b0 + 13.5), stretch(2, c0 + 13, c0 + 13.5)], spikes: [stretch(0, 6.2, 6.6)],
      spores: [spore(2, c0 + 10, c0 + 10.6, 1, 0), spore(1, b0 + 30, b0 + 30.6, 900, 2000)],
      orbs, mainOrbs: 5, urns: [{ helix: 0, at: 9 }], disc: { helix: 0, at: Math.PI },
      start: { helix: 0, at: 0 },
      route: [
         { helix: 0, to: 1, minY: 6 },
         { helix: 1, to: 2, minY: 18 },
         { helix: 2, to: -1, minY: 0 },
      ],
   };
}

function level4(): Omit<Course, "level" | "cfg" | "top"> {
   // One wide tower, four stairs at different pitches; hop sideways (inward + Jump) onto a steeper one.
   // Spike collars ride up and down the steep stairs.
   const T = pole(0, 0, 0, 0.15, { core: 2.4, walk: 3.2, wide: true });
   const G = pole(1, 6.2, 0, 0, { ghost: true, mushroom: true });
   const poles = [T, G];
   const helices = [
      helix(0, T, 0, 0, 12, true, 3),
      helix(1, T, 0, Math.PI / 2, 10, true, 3.6),
      helix(2, T, 0, Math.PI, 36 / 4.2, true, 4.2),
      helix(3, T, 0, (3 * Math.PI) / 2, 7.5, true, 4.8),
      helix(4, G, 9, back(G, T), 1.5),
   ];
   const spikes = [
      stretch(1, Math.PI / 2 + 14, Math.PI / 2 + 14.5, 1.2, 4000),
      stretch(2, Math.PI + 12, Math.PI + 12.5, 1.5, 3600),
      stretch(2, Math.PI + 30, Math.PI + 30.5, 1.5, 4400),
      stretch(3, 1.5 * Math.PI + 10, 1.5 * Math.PI + 10.5, 1.8, 3200),
      stretch(3, 1.5 * Math.PI + 26, 1.5 * Math.PI + 26.5, 1.8, 3800),
      stretch(3, 1.5 * Math.PI + 40, 1.5 * Math.PI + 40.5, 1.8, 3400),
   ];
   const h1 = Math.PI / 2;
   const h3 = 1.5 * Math.PI;
   const orbs = [
      { helix: 0, at: 4, air: 0, gate: "" as OrbGate },
      { helix: 1, at: h1 + 8, air: 0.4, gate: "" as OrbGate },
      { helix: 2, at: Math.PI + 10, air: 0, gate: "" as OrbGate },
      { helix: 3, at: h3 + 20, air: 0, gate: "" as OrbGate },
      { helix: 3, at: h3 + 34, air: 0.4, gate: "" as OrbGate },
      { helix: 0, at: 9, air: 0, gate: "riko" as OrbGate },
      { helix: 3, at: h3 + 16, air: 2.3, gate: "nami" as OrbGate },
      { helix: 3, at: h3 + 30.3, air: 0, gate: "kiro" as OrbGate },
      { helix: 3, at: h3 + 24, air: 0, gate: "zuno" as OrbGate },
   ].map((o) => placeOrb(o, poles, helices));
   return {
      poles, helices, sweepers: [], gaps: [stretch(1, h1 + 20, h1 + 20.5), stretch(3, h3 + 36, h3 + 36.5)], spikes,
      spores: [spore(3, h3 + 30, h3 + 30.6, 1, 0), spore(0, 20, 20.7, 1000, 2000)],
      orbs, mainOrbs: 5, urns: [{ helix: 0, at: 9 }], disc: null,
      start: { helix: 0, at: 0 },
      route: [
         { helix: 0, to: 1, minY: 2.5 },
         { helix: 1, to: 2, minY: 6 },
         { helix: 2, to: 3, minY: 10 },
         { helix: 3, to: -1, minY: 0 },
      ],
   };
}

function level5(): Omit<Course, "level" | "cfg" | "top"> {
   // Coilstone round the central pole; two short side poles hold its crown in phase 2; the gong on top
   const C = pole(0, 0, 0, 0, { core: 1.25, walk: 2.1, wide: true });
   const S1 = pole(1, 6, 0, 0, { mushroom: true });
   const S2 = pole(2, -6, 0, 0, { mushroom: true });
   const G = pole(3, 0, -6.2, 0, { ghost: true, mushroom: true });
   const poles = [C, S1, S2, G];
   const helices = [
      helix(0, C, 0, 0, 6, true),
      helix(1, S1, 0, back(S1, C), 2.5),
      helix(2, S2, 0, back(S2, C), 2.5),
      helix(3, G, 6, back(G, C), 1.5),
   ];
   const orbs = [
      { helix: 0, at: 2.5, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 9, air: 0.4, gate: "" as OrbGate },
      { helix: 0, at: 15, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 22, air: 0.4, gate: "" as OrbGate },
      { helix: 0, at: 30, air: 0, gate: "" as OrbGate },
      { helix: 0, at: 5.5, air: 0, gate: "riko" as OrbGate },
      { helix: 0, at: 18, air: 2.3, gate: "nami" as OrbGate },
      { helix: 0, at: 26.3, air: 0, gate: "kiro" as OrbGate },
      { helix: 0, at: 33, air: 0, gate: "zuno" as OrbGate },
   ].map((o) => placeOrb(o, poles, helices));
   return {
      poles, helices, sweepers: [], gaps: [], spikes: [],
      spores: [spore(0, 26, 26.6, 1, 0)],
      orbs, mainOrbs: 5, urns: [{ helix: 0, at: 5.5 }], disc: null,
      start: { helix: 0, at: 0 },
      route: [{ helix: 0, to: -1, minY: 0 }],
   };
}

const BUILD: Record<LevelId, () => Omit<Course, "level" | "cfg" | "top">> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE = new Map<LevelId, Course>();

/** The level's course (built once, shared read-only). */
export function courseFor(level: LevelId): Course {
   const hit = CACHE.get(level);
   if (hit) return hit;
   const c = BUILD[level]();
   const course: Course = { ...c, level, cfg: LEVELS[level], top: Math.max(...c.helices.filter((h) => h.goal).map(helixTop)) };
   CACHE.set(level, course);
   return course;
}

/** The neighbours a hop from pole `p` can reach (poles within HOP_REACH). */
export function neighbours(course: Course, p: number): number[] {
   const a = course.poles[p];
   return course.poles.filter((q) => q.id !== p && Math.hypot(q.x - a.x, q.z - a.z) <= HOP_REACH).map((q) => q.id);
}

/** The world point of a stair angle (feet), into out. */
export function stairPoint(course: Course, h: Helix, a: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const p = course.poles[h.pole];
   out.x = p.x + p.walk * Math.sin(a);
   out.y = stairY(h, a);
   out.z = p.z + p.walk * Math.cos(a);
   return out;
}
