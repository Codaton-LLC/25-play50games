// The crystal cave's rails: the course data and the five level layouts (pure data, no React, no three.js).
// A level is one rail line through the cave, built from straights and curves (each a lean), with side
// tracks that exist for stretches: forks (swap lanes), the upper scaffold track (Nami's double hop), the
// purple ghost rails (Vexa's phase) and the shortcut behind a cracked barricade (Riko's boost). Hazards
// sit on the track by distance: gaps and rocks to hop, beams to duck, falling crystals and lavafalls to
// swap round, and the dragon's breaths, triggered as you pass. Level 5 adds a loop round Cindermaw that
// repeats until she is free. README "Levels" lists each layout.
//
// Units: 1 = 1 m. s = distance along the rails from the start. Heading 0 runs towards -z; a left curve
// turns the heading up (towards -x).
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type CaveLevel } from "./levels";
import { SECRETS } from "./progression";

/** the lateral offset of a side lane (m) */
export const LANE_W = 3.2;
/** the upper scaffold track runs this far over the rails */
export const SCAFFOLD_Y = 2.6;
/** the sample spacing of the centre line (m) */
export const STEP = 0.5;

export type LaneKind = "main" | "fork" | "scaffold" | "ghost" | "shortcut";

export interface LaneDef {
   kind: LaneKind;
   /** lateral offset (right +) and height over the centre line */
   d: number;
   y: number;
   /** where it exists along s */
   s0: number;
   s1: number;
}

export interface Segment {
   s0: number;
   len: number;
   /** total turn (rad, left +) and rise (m) */
   turn: number;
   rise: number;
   /** a sharp curve: a wrong lean tips the cart, a second derails it */
   sharp: boolean;
}

export type HazardKind = "gap" | "rock" | "beam" | "crystal" | "lavafall";

export interface Hazard {
   kind: HazardKind;
   s: number;
   /** its length along the track (gaps, lavafalls), 0 for a point */
   len: number;
   /** the lane it sits on */
   lane: number;
   /** lavafalls: on for onMs of every periodMs (phase offset) */
   periodMs: number;
   onMs: number;
   phaseMs: number;
}

export interface BreathDef {
   /** the breath triggers as the cart passes this s; it fires BREATH.telegraphMs later at the lane the cart was on */
   s: number;
}

export type OrbGate = HeroId | null;

export interface OrbDef {
   s: number;
   lane: number;
   /** height over the lane's rail */
   h: number;
   /** lateral offset over the lane (Zuno's wall trails sit far out) */
   dx: number;
   bonus: OrbGate;
}

export interface SecretDef {
   s: number;
   lane: number;
   h: number;
}

/** Level 5's track events: a trigger plate to hop (phase 1), a boost ramp on a side lane (phase 2), a collar lock to hop (phase 3). */
export interface BossEventDef {
   kind: "plate" | "ramp" | "lock";
   phase: number;
   s: number;
   lane: number;
}

export interface LoopDef {
   /** the loop round Cindermaw: s0..s1 is one lap; it repeats until she is free */
   s0: number;
   s1: number;
   centre: { x: number; z: number };
   radius: number;
}

/** The honest bot's lane plan: which lane to hold from s on (bot.ts). */
export interface BotLane {
   s: number;
   lane: number;
}

export interface Course {
   level: LevelId;
   config: CaveLevel;
   segments: Segment[];
   /** the centre line sampled every STEP m: x, y, z, heading */
   samples: Float32Array;
   length: number;
   lanes: LaneDef[];
   hazards: Hazard[];
   breaths: BreathDef[];
   orbs: OrbDef[];
   mainOrbs: number;
   /** checkpoints (lantern posts): s of each */
   lanterns: number[];
   /** aligned with progression SECRETS[level] */
   secrets: SecretDef[];
   /** Riko's cracked barricades: the shortcut lane each one opens and its s */
   barricades: { s: number; lane: number }[];
   /** the scaffold ramps: a second hop near one lifts the cart onto that scaffold lane */
   ramps: { s: number; lane: number }[];
   /** the dragon wakes here (0 = from the start) */
   wake: number;
   /** the hoard and the egg (level 1's beat 3), the skull gate (the exit) */
   hoardS: number;
   finishS: number;
   loop: LoopDef | null;
   bossEvents: BossEventDef[];
   bot: BotLane[];
}

// ---------- the builder ----------

interface Builder {
   s: number;
   segments: Segment[];
   lanes: LaneDef[];
   hazards: Hazard[];
   breaths: BreathDef[];
   orbs: OrbDef[];
   lanterns: number[];
   secrets: Record<string, SecretDef>;
   barricades: { s: number; lane: number }[];
   ramps: { s: number; lane: number }[];
   wake: number;
   hoardS: number;
   loop: LoopDef | null;
   bossEvents: BossEventDef[];
   bot: BotLane[];
   finishS: number;
}

const DEG = Math.PI / 180;

function newBuilder(): Builder {
   return {
      s: 0,
      segments: [],
      lanes: [{ kind: "main", d: 0, y: 0, s0: -100, s1: 1e9 }],
      hazards: [],
      breaths: [],
      orbs: [],
      lanterns: [0],
      secrets: {},
      barricades: [],
      ramps: [],
      wake: 0,
      hoardS: -1,
      loop: null,
      bossEvents: [],
      bot: [{ s: 0, lane: 0 }],
      finishS: -1,
   };
}

function seg(b: Builder, len: number, turnDeg = 0, sharp = false, rise = 0): void {
   b.segments.push({ s0: b.s, len, turn: turnDeg * DEG, rise, sharp });
   b.s += len;
}

const straight = (b: Builder, len: number, rise = 0) => seg(b, len, 0, false, rise);
const curve = (b: Builder, len: number, deg: number, sharp = false) => seg(b, len, deg, sharp);

function lane(b: Builder, kind: LaneKind, d: number, y: number, s0: number, s1: number): number {
   b.lanes.push({ kind, d, y, s0, s1 });
   return b.lanes.length - 1;
}

function hazard(b: Builder, kind: HazardKind, s: number, laneId = 0, len = 0, periodMs = 0, onMs = 0, phaseMs = 0): void {
   b.hazards.push({ kind, s, len, lane: laneId, periodMs, onMs, phaseMs });
}

function orb(b: Builder, s: number, laneId = 0, h = 1.1, bonus: OrbGate = null, dx = 0): void {
   b.orbs.push({ s, lane: laneId, h, dx, bonus });
}

/** A line of n main orbs from s every `step` m (on the lane's rail height). */
function orbLine(b: Builder, s: number, n: number, step = 6, laneId = 0, h = 1.1): void {
   for (let i = 0; i < n; i++) orb(b, s + i * step, laneId, h);
}

function lantern(b: Builder, s: number): void {
   b.lanterns.push(s);
}

function secret(b: Builder, id: string, s: number, laneId: number, h = 1.2): void {
   b.secrets[id] = { s, lane: laneId, h };
}

/** Nami: the upper scaffold track from s for len m, a ramp just before it; three orbs on it and the shard at its end. */
function scaffold(b: Builder, s: number, len: number, shard: boolean): void {
   const l = lane(b, "scaffold", 0, SCAFFOLD_Y, s, s + len);
   b.ramps.push({ s: s - 4, lane: l });
   for (let i = 0; i < 3; i++) orb(b, s + 6 + i * (len - 12) / 2, l, 1.1, "nami");
   if (shard) secret(b, "scaffold", s + len - 3, l);
}

/** Vexa: a purple ghost rail beside the main line through a rockfall (solid only while she phases). */
function ghost(b: Builder, s: number, len: number, side: 1 | -1, sticker: boolean): void {
   const l = lane(b, "ghost", side * LANE_W, 0, s, s + len);
   orb(b, s + len * 0.3, l, 1.1, "vexa");
   orb(b, s + len * 0.6, l, 1.1, "vexa");
   if (sticker) secret(b, "ghost", s + len * 0.85, l);
}

/** Riko: a cracked barricade at s opening a short shortcut lane (two orbs on it, and on L4 the hoard shard). */
function shortcut(b: Builder, s: number, len: number, side: 1 | -1, hoard = false): void {
   const l = lane(b, "shortcut", side * LANE_W, 0, s, s + len);
   b.barricades.push({ s, lane: l });
   orb(b, s + len * 0.35, l, 1.1, "riko");
   orb(b, s + len * 0.7, l, 1.1, "riko");
   if (hoard) secret(b, "hoard", s + len * 0.5, l);
}

/** Kiro: a lavafall or breath-heavy side stretch is his; here two orbs inside a lavafall on a fork. */
function kiroLava(b: Builder, s: number, side: 1 | -1): void {
   const l = lane(b, "fork", side * LANE_W, 0, s - 12, s + 14);
   hazard(b, "lavafall", s, l, 6, 2400, 2400, 0);
   orb(b, s + 1, l, 1.1, "kiro");
   orb(b, s + 4, l, 1.1, "kiro");
}

/** Zuno: a crystal trail on the cave wall, 6 m out from the rails. */
function zunoTrail(b: Builder, s: number, side: 1 | -1): void {
   for (let i = 0; i < 3; i++) orb(b, s + i * 4, 0, 1.8, "zuno", side * 6);
}

/** A fork: a parallel lane on `side` from s for len m. */
function fork(b: Builder, s: number, len: number, side: 1 | -1): number {
   return lane(b, "fork", side * LANE_W, 0, s, s + len);
}

function botLane(b: Builder, s: number, laneId: number): void {
   b.bot.push({ s, lane: laneId });
}

// ---------- the five levels ----------

type Script = (b: Builder) => void;

const SCRIPTS: Record<LevelId, Script> = {
   // Crystal Entry: the card's three beats: lean into gentle curves; a gap and a low beam; the hoard, the
   // dragon wakes, a 20 s escape with two telegraphed breaths to the exit
   1: (b) => {
      b.wake = 1e9;
      straight(b, 40);
      orbLine(b, 14, 3);
      curve(b, 50, 35);
      orbLine(b, 46, 4, 9);
      straight(b, 20);
      curve(b, 50, -60, true);
      orbLine(b, 116, 3, 12);
      straight(b, 20);
      curve(b, 50, 70, true);
      orbLine(b, 186, 3, 12);
      lantern(b, 238);
      straight(b, 60);
      hazard(b, "gap", 262, 0, 5);
      orb(b, 264.5, 0, 2.3);
      hazard(b, "beam", 284);
      straight(b, 30);
      hazard(b, "rock", 306);
      orb(b, 306, 0, 2.3);
      curve(b, 60, -40);
      scaffold(b, 330, 46, true);
      orbLine(b, 334, 3, 10);
      zunoTrail(b, 352, 1);
      straight(b, 40);
      ghost(b, 392, 30, 1, true);
      hazard(b, "rock", 410);
      shortcut(b, 382, 22, -1);
      kiroLava(b, 404, -1);
      lantern(b, 430);
      straight(b, 40);
      // beat 3: the hoard, the egg; Cindermaw wakes
      b.hoardS = 450;
      b.wake = 456;
      curve(b, 60, 50);
      orbLine(b, 470, 3, 12);
      b.breaths.push({ s: 520 });
      straight(b, 40);
      hazard(b, "beam", 580);
      curve(b, 60, -70, true);
      lantern(b, 600);
      straight(b, 30);
      b.breaths.push({ s: 640 });
      orbLine(b, 650, 3, 8);
      curve(b, 50, 40);
      straight(b, 50);
      b.finishS = b.s - 14;
   },
   // Rockfall: falling crystals with a shadow telegraph, forks with two routes (one through a rockfall)
   2: (b) => {
      straight(b, 40);
      orbLine(b, 12, 3);
      curve(b, 60, 45);
      const f1 = fork(b, 70, 70, 1);
      hazard(b, "crystal", 110, 0);
      orbLine(b, 120, 3, 8, f1);
      botLane(b, 74, f1);
      botLane(b, 141, 0);
      straight(b, 40);
      hazard(b, "rock", 150);
      lantern(b, 160);
      curve(b, 60, -60, true);
      orbLine(b, 166, 4, 12);
      straight(b, 60);
      const f2 = fork(b, 230, 80, -1);
      hazard(b, "crystal", 262, f2);
      hazard(b, "crystal", 290, 0);
      botLane(b, 268, f2);
      botLane(b, 300, 0);
      orbLine(b, 272, 3, 6, f2);
      orbLine(b, 306, 2, 6, 0);
      ghost(b, 300, 32, 1, true);
      curve(b, 70, 80, true);
      lantern(b, 320);
      scaffold(b, 340, 44, true);
      straight(b, 60);
      hazard(b, "gap", 360, 0, 5);
      hazard(b, "beam", 395);
      orbLine(b, 400, 3, 7);
      shortcut(b, 412, 24, -1);
      zunoTrail(b, 420, 1);
      curve(b, 60, -50);
      b.breaths.push({ s: 450 });
      straight(b, 50);
      kiroLava(b, 470, 1);
      lantern(b, 500);
      curve(b, 60, 70, true);
      orbLine(b, 520, 4, 10);
      straight(b, 40);
      const f3 = fork(b, 580, 60, 1);
      hazard(b, "crystal", 610, 0);
      botLane(b, 584, f3);
      botLane(b, 641, 0);
      orbLine(b, 596, 3, 8, f3);
      hazard(b, "rock", 655);
      curve(b, 50, -40);
      b.breaths.push({ s: 690 });
      straight(b, 60);
      hazard(b, "beam", 712);
      orbLine(b, 720, 3, 8);
      curve(b, 60, 50);
      straight(b, 50);
      b.finishS = b.s - 14;
   },
   // Glow Tunnel: a dark cave lit by glow mushrooms; every breath lights the track ahead for 1.2 s
   3: (b) => {
      straight(b, 40);
      orbLine(b, 14, 3);
      curve(b, 60, -50, true);
      orbLine(b, 50, 3, 12);
      b.breaths.push({ s: 70 });
      straight(b, 50);
      hazard(b, "rock", 120);
      hazard(b, "beam", 140);
      lantern(b, 150);
      curve(b, 60, 60, true);
      orbLine(b, 156, 4, 12);
      b.breaths.push({ s: 175 });
      straight(b, 60);
      hazard(b, "gap", 222, 0, 6);
      scaffold(b, 240, 50, true);
      hazard(b, "rock", 258);
      orbLine(b, 268, 2, 10);
      zunoTrail(b, 236, -1);
      curve(b, 70, -70, true);
      lantern(b, 300);
      b.breaths.push({ s: 320 });
      straight(b, 50);
      const f1 = fork(b, 330, 70, -1);
      hazard(b, "crystal", 362, 0);
      botLane(b, 334, f1);
      botLane(b, 401, 0);
      orbLine(b, 344, 3, 9, f1);
      ghost(b, 410, 30, 1, true);
      curve(b, 60, 40);
      hazard(b, "beam", 430);
      b.breaths.push({ s: 450 });
      straight(b, 50);
      shortcut(b, 470, 24, -1);
      kiroLava(b, 482, 1);
      lantern(b, 500);
      curve(b, 70, 80, true);
      orbLine(b, 506, 4, 12);
      straight(b, 60);
      hazard(b, "rock", 590);
      b.breaths.push({ s: 540 });
      hazard(b, "gap", 620, 0, 6);
      curve(b, 60, -60, true);
      orbLine(b, 640, 3, 12);
      lantern(b, 700);
      straight(b, 50);
      b.breaths.push({ s: 720 });
      hazard(b, "beam", 742);
      curve(b, 50, 40);
      orbLine(b, 756, 3, 10);
      straight(b, 60);
      b.finishS = b.s - 14;
   },
   // Deep Cave: lavafalls on timers, long parallel tracks with lane swaps under fire, breaths in pairs
   4: (b) => {
      straight(b, 40);
      orbLine(b, 14, 3);
      curve(b, 60, 50, true);
      const f1 = fork(b, 100, 140, 1);
      hazard(b, "lavafall", 130, 0, 6, 3000, 1500, 0);
      hazard(b, "lavafall", 170, f1, 6, 3000, 1500, 1500);
      hazard(b, "lavafall", 210, 0, 6, 3000, 1500, 600);
      straight(b, 70);
      orbLine(b, 112, 3, 8, f1);
      b.breaths.push({ s: 150 }, { s: 182 });
      lantern(b, 160);
      curve(b, 70, -60, true);
      orbLine(b, 244, 3, 12);
      straight(b, 50);
      shortcut(b, 280, 36, -1, true);
      hazard(b, "rock", 300);
      hazard(b, "beam", 318);
      lantern(b, 330);
      curve(b, 60, 70, true);
      scaffold(b, 350, 44, true);
      orbLine(b, 352, 2, 30);
      zunoTrail(b, 360, -1);
      straight(b, 60);
      const f2 = fork(b, 410, 140, -1);
      hazard(b, "lavafall", 440, f2, 6, 2800, 1400, 0);
      hazard(b, "lavafall", 470, 0, 6, 2800, 1400, 1400);
      hazard(b, "crystal", 505, f2);
      hazard(b, "lavafall", 530, 0, 6, 2800, 1400, 700);
      b.breaths.push({ s: 450 }, { s: 480 });
      orbLine(b, 412, 3, 6, 0);
      void f2;
      curve(b, 60, -40);
      lantern(b, 470);
      ghost(b, 560, 32, 1, true);
      straight(b, 60);
      kiroLava(b, 600, -1);
      hazard(b, "gap", 620, 0, 6);
      curve(b, 70, 80, true);
      orbLine(b, 640, 4, 12);
      lantern(b, 700);
      straight(b, 60);
      b.breaths.push({ s: 680 }, { s: 705 });
      hazard(b, "rock", 760);
      hazard(b, "beam", 780);
      curve(b, 60, -50, true);
      orbLine(b, 790, 3, 12);
      straight(b, 60);
      hazard(b, "gap", 860, 0, 6);
      curve(b, 50, 40);
      orbLine(b, 828, 3, 8);
      straight(b, 50);
      b.finishS = b.s - 14;
   },
   // Dragon Hoard: Cindermaw. The run in, then the loop round her (it repeats until she is free), then out
   5: (b) => {
      straight(b, 40);
      orbLine(b, 14, 3);
      curve(b, 60, -50, true);
      b.breaths.push({ s: 80 });
      straight(b, 50);
      hazard(b, "rock", 130);
      scaffold(b, 140, 44, true);
      lantern(b, 150);
      curve(b, 60, 60, true);
      orbLine(b, 170, 3, 12);
      straight(b, 40);
      ghost(b, 220, 30, 1, true);
      hazard(b, "beam", 236);
      shortcut(b, 214, 22, -1);
      zunoTrail(b, 250, 1);
      kiroLava(b, 266, -1);
      straight(b, 50);
      lantern(b, 300);
      // the loop round Cindermaw: a full circle (radius 32), one lap = 2π·32 ≈ 201 m
      const r = 32;
      const lapLen = 2 * Math.PI * r;
      const s0 = b.s;
      curve(b, lapLen, 360);
      const s1 = b.s;
      b.loop = { s0, s1, centre: { x: 0, z: 0 }, radius: r };
      const out = fork(b, s0, lapLen, 1);
      void out;
      for (const k of [0.15, 0.48, 0.81]) b.bossEvents.push({ kind: "plate", phase: 0, s: s0 + lapLen * k, lane: 0 });
      for (const k of [0.3, 0.75]) b.bossEvents.push({ kind: "ramp", phase: 1, s: s0 + lapLen * k, lane: out });
      for (const k of [0.2, 0.53, 0.86]) b.bossEvents.push({ kind: "lock", phase: 2, s: s0 + lapLen * k, lane: 0 });
      orbLine(b, s0 + 10, 3, 60);
      lantern(b, s0 + 2);
      b.wake = s0;
      straight(b, 50);
      orbLine(b, s1 + 10, 3, 10);
      curve(b, 60, 40);
      straight(b, 60);
      b.finishS = b.s - 14;
   },
};

/** Integrates the segments into centre-line samples (x, y, z, heading every STEP m). */
function sampleSegments(segments: Segment[], length: number): Float32Array {
   const n = Math.ceil(length / STEP) + 2;
   const out = new Float32Array(n * 4);
   let x = 0;
   let y = 0;
   let z = 0;
   let h = 0;
   let k = 0;
   for (let i = 0; i < n; i++) {
      const s = i * STEP;
      while (k < segments.length - 1 && s >= segments[k].s0 + segments[k].len) k++;
      out[i * 4] = x;
      out[i * 4 + 1] = y;
      out[i * 4 + 2] = z;
      out[i * 4 + 3] = h;
      const g = segments[k];
      const turnRate = g ? g.turn / g.len : 0;
      const riseRate = g ? g.rise / g.len : 0;
      const hm = h + (turnRate * STEP) / 2;
      x += -Math.sin(hm) * STEP;
      z += -Math.cos(hm) * STEP;
      y += riseRate * STEP;
      h += turnRate * STEP;
   }
   return out;
}

/** Builds a level's course (deterministic: no randomness). */
export function buildCourse(level: LevelId, config: CaveLevel = LEVELS[level]): Course {
   const b = newBuilder();
   SCRIPTS[level](b);
   const length = b.s;
   const samples = sampleSegments(b.segments, length + 20);
   if (b.loop) {
      // the loop's centre: the circle starts where the lap begins, heading h0, turning left
      const i = Math.round(b.loop.s0 / STEP);
      const x = samples[i * 4];
      const z = samples[i * 4 + 2];
      const h0 = samples[i * 4 + 3];
      b.loop.centre = { x: x - Math.cos(h0) * b.loop.radius, z: z + Math.sin(h0) * b.loop.radius };
   }
   const secrets = SECRETS[level].map((s) => {
      const p = b.secrets[s.id];
      if (!p) throw new Error(`dragon-cave-rush L${level}: secret ${s.id} has no spot`);
      return p;
   });
   b.lanterns.sort((p, q) => p - q);
   b.bot.sort((p, q) => p.s - q.s);
   return {
      level,
      config,
      segments: b.segments,
      samples,
      length,
      lanes: b.lanes,
      hazards: b.hazards,
      breaths: b.breaths.sort((p, q) => p.s - q.s),
      orbs: b.orbs,
      mainOrbs: b.orbs.filter((o) => o.bonus === null).length,
      lanterns: b.lanterns,
      secrets,
      barricades: b.barricades,
      ramps: b.ramps,
      wake: b.wake,
      hoardS: b.hoardS,
      finishS: b.finishS > 0 ? b.finishS : length - 14,
      loop: b.loop,
      bossEvents: b.bossEvents,
      bot: b.bot,
   };
}

/** The segment at s (clamped). */
export function segmentAt(c: Course, s: number): Segment {
   const segs = c.segments;
   let lo = 0;
   let hi = segs.length - 1;
   while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (segs[mid].s0 <= s) lo = mid;
      else hi = mid - 1;
   }
   return segs[lo];
}

/** The centre line at s (interpolated): position and heading, written into out. */
export function centreAt(c: Course, s: number, out: { x: number; y: number; z: number; h: number }): { x: number; y: number; z: number; h: number } {
   const n = c.samples.length / 4 - 1;
   const f = Math.max(0, Math.min(n - 1e-6, s / STEP));
   const i = Math.floor(f);
   const t = f - i;
   const a = i * 4;
   const b2 = (i + 1) * 4;
   out.x = c.samples[a] + (c.samples[b2] - c.samples[a]) * t;
   out.y = c.samples[a + 1] + (c.samples[b2 + 1] - c.samples[a + 1]) * t;
   out.z = c.samples[a + 2] + (c.samples[b2 + 2] - c.samples[a + 2]) * t;
   out.h = c.samples[a + 3] + (c.samples[b2 + 3] - c.samples[a + 3]) * t;
   return out;
}

/** The world point of a lane at s with a lateral offset and height. */
export function lanePoint(c: Course, s: number, d: number, h: number, out: { x: number; y: number; z: number; h: number }): { x: number; y: number; z: number; h: number } {
   centreAt(c, s, out);
   out.x += Math.cos(out.h) * d;
   out.z += -Math.sin(out.h) * d;
   out.y += h;
   return out;
}
