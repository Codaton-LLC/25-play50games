// The laser vault: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a corridor of rooms (s = metres from the start, running towards -z; x across, the walls at
// +-HALF). Each room is one LASER ZONE (the card: 3 zones on level 1 up to 8 on level 5), entered over a
// checkpoint pad (a hit sends you back to it):
// - a low beam to jump; a wall of beams with one gap to find;
// - a pulsing wall (on / off) to time; a low beam sliding along the room to jump as it passes;
// - a laser gate a switch turns off for a few seconds (level 3 on: one switch turns the next gate ON, so
//   the switches depend on each other; level 4: decoy switches that wake a sweep);
// - a moving barrier (a solid block sliding across the room) to slip past.
// Around them the hero routes: high orbs over the beams (Nyla's second jump), live floor tiles (Kiro's
// shield; Riko's dash jump clears the short ones), laser cages (Vexa's phase walks in, Zuno's magnet pulls
// their orbs out). Level 5 ends in the Vault Core's arena. README "Levels" lists each layout.
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type LaserLevel } from "./levels";
import { SECRETS } from "./progression";

/** The corridor's half width (m): x in [-HALF, HALF]. */
export const HALF = 4.5;
/** A room's length (m). */
export const ZONE = 14;
/** Beam heights: a low beam (jump it), a full wall (time it, switch it, phase it; Nyla's double jump clears it). */
export const LOW: [number, number] = [0.05, 0.45];
export const FULL: [number, number] = [0.05, 1.7];
export const ORB_Y = 1.0;
/** Nyla's high orbs and sticker: only a second jump reaches them. */
export const HIGH_Y = 3.1;

export type LaserKind = "beam" | "pulse" | "sweep" | "gate" | "cage";

/** One laser: a beam across x from x0 to x1 at s (a sweep slides its s between s and s1), y0..y1 high. */
export interface Laser {
   kind: LaserKind;
   s: number;
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   /** pulse: its period, how long it is on, its offset (ms); sweep: the far end and the speed (m/s) */
   period: number;
   onMs: number;
   offset: number;
   s1: number;
   speed: number;
   /** gate: on until a switch turns it off (or on from the start, `startsOn`) */
   startsOn: boolean;
   /** a cage beam runs along s (x0 = x1, s .. s1): it bounds a cage */
   along: boolean;
   phase: number;
}

export interface Switch {
   x: number;
   s: number;
   /** gates it turns off (for `ms`), gates it turns on, a sweep it wakes (a decoy) */
   off: number[];
   on: number[];
   ms: number;
   decoy: boolean;
   phase: number;
}

/** A solid block sliding across the room: centre x = amp sin(2 pi t / period + offset), `width` wide. */
export interface Barrier {
   s: number;
   width: number;
   amp: number;
   period: number;
   offset: number;
}

/** Live floor tiles (x0..x1, s0..s1): a touch on the ground is a hit (Kiro's shield crosses them). */
export interface Floor {
   x0: number;
   x1: number;
   s0: number;
   s1: number;
}

export type Bonus = "high" | "floor" | "cage" | "dash";

export interface OrbDef {
   x: number;
   s: number;
   h: number;
   /** the route that carries it, null on the main path */
   bonus: Bonus | null;
   /** inside a cage: Zuno's magnet pulls it out */
   magnet: boolean;
}

export interface SecretDef {
   id: string;
   x: number;
   s: number;
   h: number;
}

/** The bot's plan, one step after another (the course's own answer key). */
export type Step =
   | { t: "go"; x: number; s: number }
   | { t: "jump"; x: number; s: number }
   | { t: "pulse"; laser: number; x: number }
   | { t: "sweep"; laser: number; x: number; s: number }
   | { t: "press"; sw: number }
   | { t: "barrier"; b: number }
   | { t: "boss" };

export interface Zone {
   s0: number;
   s1: number;
   /** the checkpoint pad (a hit respawns you here) */
   cp: number;
}

export interface Arena {
   s0: number;
   s1: number;
   /** the pylons (switch indices): a press while the core is open is a hit */
   pylons: number[];
   /** the core hovers here */
   coreS: number;
   /** the exit beam (on until the core is down) */
   exit: number;
}

export interface Course {
   level: LevelId;
   config: LaserLevel;
   zones: Zone[];
   lasers: Laser[];
   switches: Switch[];
   barriers: Barrier[];
   floors: Floor[];
   orbs: OrbDef[];
   mainOrbs: number;
   secrets: SecretDef[];
   plan: Step[];
   arena: Arena | null;
   finishS: number;
}

const ANY = -1;

class Builder {
   lasers: Laser[] = [];
   switches: Switch[] = [];
   barriers: Barrier[] = [];
   floors: Floor[] = [];
   orbs: OrbDef[] = [];
   secrets: SecretDef[] = [];
   plan: Step[] = [];
   zones: Zone[] = [];
   /** the current room's start */
   s0 = 4;

   laser(l: Partial<Laser> & Pick<Laser, "kind" | "s">): number {
      this.lasers.push({ x0: -HALF, x1: HALF, y0: FULL[0], y1: FULL[1], period: 0, onMs: 0, offset: 0, s1: l.s, speed: 0, startsOn: true, along: false, phase: ANY, ...l });
      return this.lasers.length - 1;
   }

   orb(x: number, s: number, h = ORB_Y, bonus: Bonus | null = null, magnet = false): void {
      this.orbs.push({ x, s, h, bonus, magnet });
   }

   /** A new room: its checkpoint pad, the walk onto it (and its first orb). */
   room(): number {
      if (this.zones.length > 0) this.s0 += ZONE;
      const z = { s0: this.s0, s1: this.s0 + ZONE, cp: this.s0 + 1.5 };
      this.zones.push(z);
      this.orb(0, z.s0 + 3);
      this.plan.push({ t: "go", x: 0, s: z.s0 + 3 });
      return z.s0;
   }

   /** A low beam across the room: jump it. */
   low(at: number, x = 0): void {
      const s = this.s0 + at;
      this.laser({ kind: "beam", s, y0: LOW[0], y1: LOW[1] });
      this.plan.push({ t: "jump", x, s });
      this.orb(x, s + 2);
   }

   /** A wall of beams with one gap (1.8 m) at gx. */
   gap(at: number, gx: number): void {
      const s = this.s0 + at;
      if (gx - 0.9 > -HALF) this.laser({ kind: "beam", s, x0: -HALF, x1: gx - 0.9 });
      if (gx + 0.9 < HALF) this.laser({ kind: "beam", s, x0: gx + 0.9, x1: HALF });
      this.plan.push({ t: "go", x: gx, s: s - 1.2 }, { t: "go", x: gx, s: s + 1.5 });
      this.orb(gx, s + 1.5);
   }

   /** A pulsing wall: on `on` ms of every `period`. */
   pulse(at: number, period: number, on: number, offset = 0, x = 0): number {
      const i = this.laser({ kind: "pulse", s: this.s0 + at, period, onMs: on, offset });
      this.plan.push({ t: "go", x, s: this.s0 + at - 1.4 }, { t: "pulse", laser: i, x });
      this.orb(x, this.s0 + at + 1.6);
      return i;
   }

   /** A low beam sliding along the room between a and b at `speed`: jump it as it passes. */
   sweep(a: number, b: number, speed: number, x = 0): number {
      const i = this.laser({ kind: "sweep", s: this.s0 + a, s1: this.s0 + b, speed, y0: LOW[0], y1: LOW[1] });
      this.plan.push({ t: "sweep", laser: i, x, s: this.s0 + b + 1.2 });
      this.orb(x, this.s0 + (a + b) / 2);
      return i;
   }

   /** A laser gate and the switch that turns it off for `ms`; `alsoOn` gates it turns on. */
   gate(at: number, swx: number, swAt: number, ms = 6000, alsoOn: number[] = [], startsOn = true): { gate: number; sw: number } {
      const gate = this.laser({ kind: "gate", s: this.s0 + at, startsOn });
      this.switches.push({ x: swx, s: this.s0 + swAt, off: [gate], on: alsoOn, ms, decoy: false, phase: ANY });
      const sw = this.switches.length - 1;
      return { gate, sw };
   }

   /** A decoy switch: pressed, it wakes a sweep across the next room part (level 4). */
   decoy(x: number, at: number, sweep: number): void {
      this.switches.push({ x, s: this.s0 + at, off: [], on: [sweep], ms: 4000, decoy: true, phase: ANY });
   }

   /** A solid barrier sliding across the room. */
   barrier(at: number, amp: number, period: number, offset = 0, width = 4.6): void {
      this.barriers.push({ s: this.s0 + at, width, amp, period, offset });
      this.plan.push({ t: "barrier", b: this.barriers.length - 1 }, { t: "go", x: 0, s: this.s0 + at + 2 });
      this.orb(0, this.s0 + at + 2);
   }

   /** Nyla's high orbs over a beam (and the sticker). */
   high(at: number, x: number, sticker = false): void {
      for (let k = 0; k < 2; k++) this.orb(x, this.s0 + at - 0.6 + k * 1.2, HIGH_Y, "high");
      if (sticker) this.secrets.push({ id: "high", x, s: this.s0 + at + 2.2, h: HIGH_Y });
   }

   /** Live floor tiles on one side with orbs on them: Kiro's shield (a long patch) or a dash jump (short). */
   floor(at: number, x0: number, x1: number, len: number, bonus: "floor" | "dash"): void {
      const s0 = this.s0 + at;
      this.floors.push({ x0, x1, s0, s1: s0 + len });
      for (let k = 0; k < 2; k++) this.orb((x0 + x1) / 2, s0 + len * (0.33 + k * 0.34), ORB_Y, bonus);
   }

   /** A laser cage at the side (x0..x1, a..a+len): Vexa phases in, Zuno's magnet pulls its orbs out. */
   cage(at: number, x0: number, x1: number, len: number, shard: boolean): void {
      const s0 = this.s0 + at;
      const s1 = s0 + len;
      this.laser({ kind: "cage", s: s0, x0, x1 });
      this.laser({ kind: "cage", s: s1, x0, x1 });
      this.laser({ kind: "cage", s: s0, s1, x0, x1: x0, along: true });
      this.laser({ kind: "cage", s: s0, s1, x0: x1, x1, along: true });
      for (let k = 0; k < 2; k++) this.orb((x0 + x1) / 2, s0 + len * (0.33 + k * 0.34), ORB_Y, "cage", true);
      if (shard) this.secrets.push({ id: "cage", x: (x0 + x1) / 2, s: s0 + len / 2, h: ORB_Y });
   }
}

// ---------- the levels ----------

function level1(b: Builder): void {
   // Static Lasers: (1) a low beam to jump; (2) a wall with one gap; (3) a gate and its switch
   b.room();
   b.low(8);
   b.high(8, -3, true);
   b.room();
   b.gap(8, 2.5);
   b.cage(3, -4.3, -2.3, 6, true);
   b.room();
   const g = b.gate(10, -3, 5);
   b.plan.push({ t: "press", sw: g.sw }, { t: "go", x: 0, s: b.s0 + 8.8 }, { t: "go", x: 0, s: b.s0 + 11.5 });
   b.floor(3, 2.4, 4.3, 5, "floor");
}

function level2(b: Builder): void {
   // Moving Lasers: a pulsing wall, a sliding low beam, a moving barrier
   b.room();
   b.pulse(8, 2400, 1200);
   b.high(4, 3, false);
   b.floor(2, -4.3, -2.4, 4, "dash");
   b.room();
   b.sweep(5, 11, 3);
   b.cage(2, 2.3, 4.3, 6, true);
   b.room();
   b.barrier(8, 2.2, 4000);
   b.room();
   b.gap(5, -2.5);
   b.pulse(10, 2000, 1000, 500, -2.5);
   b.floor(3, 2.4, 4.3, 5, "floor");
}

function level3(b: Builder): void {
   // Cross Grid: linked switches (the first opens gate A but closes gate B; the second opens B)
   b.room();
   b.low(6);
   b.pulse(11, 2200, 1100);
   b.room();
   const gb = b.laser({ kind: "gate", s: b.s0 + 11, startsOn: false });
   const a = b.gate(6, 3.2, 3, 6000, [gb]);
   b.switches.push({ x: -3.2, s: b.s0 + 9, off: [gb], on: [], ms: 6000, decoy: false, phase: ANY });
   const swB = b.switches.length - 1;
   b.plan.push({ t: "press", sw: a.sw }, { t: "go", x: 0, s: b.s0 + 4.8 }, { t: "go", x: 0, s: b.s0 + 7.5 }, { t: "press", sw: swB }, { t: "go", x: 0, s: b.s0 + 9.8 }, { t: "go", x: 0, s: b.s0 + 12.5 });
   b.cage(1, -4.3, -2.3, 4, true);
   b.room();
   b.sweep(4, 10, 3.5);
   b.high(7, -3, false);
   b.floor(1, 2.4, 4.3, 4, "dash");
   b.room();
   b.barrier(5, 2.4, 3600);
   b.pulse(10, 2000, 1000, 300);
   b.room();
   b.gap(5, 3);
   b.low(10, 3);
   b.floor(2, -4.3, -2.4, 5, "floor");
}

function level4(b: Builder): void {
   // Fast Maze: shorter windows, decoy switches that wake sweeps
   b.room();
   b.pulse(7, 1800, 1000);
   b.low(11);
   b.cage(1, -4.3, -2.3, 4, true);
   b.room();
   const sw1 = b.sweep(8, 12, 4);
   b.lasers[sw1].startsOn = false;
   b.decoy(3.5, 4, sw1);
   const g = b.gate(6, -3.5, 3, 4000);
   // the sweep sleeps unless the decoy wakes it: the plan's sweep step just walks through
   b.plan.splice(b.plan.length - 1, 0, { t: "press", sw: g.sw }, { t: "go", x: 0, s: b.s0 + 4.8 }, { t: "go", x: 0, s: b.s0 + 7.2 });
   b.high(6, 3, true);
   b.room();
   b.barrier(5, 2.4, 3000);
   b.barrier(10, 2.4, 3000, Math.PI);
   b.room();
   b.gap(4, -3);
   b.pulse(9, 1600, 800, 200, -3);
   b.floor(2, 2.4, 4.3, 5, "floor");
   b.room();
   b.sweep(3, 9, 4.5);
   b.low(12);
   b.floor(1, -4.3, -2.4, 4, "dash");
   b.room();
   const g2 = b.gate(9, 3.5, 4, 4000);
   b.plan.push({ t: "press", sw: g2.sw }, { t: "go", x: 0, s: b.s0 + 7.8 }, { t: "go", x: 0, s: b.s0 + 10.5 });
   b.pulse(12, 1800, 900, 600);
}

/** Level 5: seven zones of everything, then the Vault Core's arena. */
function level5(b: Builder): Arena {
   b.room();
   b.low(6);
   b.gap(11, -2.5);
   b.cage(1, 2.3, 4.3, 4, true);
   b.room();
   b.pulse(6, 2000, 1000);
   b.high(6, 3, false);
   b.sweep(8, 12, 3.5);
   b.room();
   b.barrier(6, 2.4, 3200);
   b.room();
   const gb = b.laser({ kind: "gate", s: b.s0 + 11, startsOn: false });
   const a = b.gate(6, 3.2, 3, 6000, [gb]);
   b.switches.push({ x: -3.2, s: b.s0 + 9, off: [gb], on: [], ms: 6000, decoy: false, phase: ANY });
   const swB = b.switches.length - 1;
   b.plan.push({ t: "press", sw: a.sw }, { t: "go", x: 0, s: b.s0 + 4.8 }, { t: "go", x: 0, s: b.s0 + 7.5 }, { t: "press", sw: swB }, { t: "go", x: 0, s: b.s0 + 9.8 }, { t: "go", x: 0, s: b.s0 + 12.5 });
   b.room();
   b.gap(4, 3);
   b.pulse(9, 1700, 850, 400, 3);
   b.floor(2, -4.3, -2.4, 5, "floor");
   b.room();
   b.sweep(3, 8, 4);
   b.barrier(11, 2.4, 3000);
   b.floor(1, 2.4, 4.3, 4, "dash");
   b.room();
   b.low(5, -2);
   b.pulse(10, 1600, 800, 0, -2);
   // the arena (zone 8): the core at its far end, three pylons, the exit beam
   b.room();
   const s0 = b.s0;
   b.s0 = s0;
   const pylons: number[] = [];
   for (const x of [-3, 0, 3]) {
      b.switches.push({ x, s: s0 + 12, off: [], on: [], ms: 0, decoy: false, phase: ANY });
      pylons.push(b.switches.length - 1);
   }
   for (const x of [-3, 3]) b.orb(x, s0 + 8);
   const exit = b.laser({ kind: "gate", s: s0 + 22, startsOn: true });
   b.plan.push({ t: "go", x: -3, s: s0 + 8 }, { t: "go", x: 3, s: s0 + 8 }, { t: "go", x: 0, s: s0 + 11 }, { t: "boss" }, { t: "go", x: 0, s: s0 + 24 });
   // the arena is a long room: the next "room" would start past it
   b.s0 = s0 + 12;
   return { s0, s1: s0 + 26, pylons, coreS: s0 + 24, exit };
}

export function buildCourse(level: LevelId, config: LaserLevel = LEVELS[level]): Course {
   const b = new Builder();
   let arena: Arena | null = null;
   if (level === 1) level1(b);
   else if (level === 2) level2(b);
   else if (level === 3) level3(b);
   else if (level === 4) level4(b);
   else arena = level5(b);
   const last = b.zones[b.zones.length - 1];
   const finishS = arena ? arena.s1 : last.s1;
   if (!arena) b.plan.push({ t: "go", x: 0, s: finishS + 0.5 });
   else {
      last.s1 = arena.s1;
      b.plan.push({ t: "go", x: 0, s: finishS + 0.5 });
   }
   const orbs = b.orbs.slice().sort((p, q) => p.s - q.s);
   const secrets = SECRETS[level].map((spec) => {
      const d = b.secrets.find((x) => x.id === spec.id);
      if (!d) throw new Error(`laser-maze-run: level ${level} has no ${spec.id} secret`);
      return d;
   });
   return {
      level,
      config,
      zones: b.zones,
      lasers: b.lasers,
      switches: b.switches,
      barriers: b.barriers,
      floors: b.floors,
      orbs,
      mainOrbs: orbs.filter((o) => o.bonus === null).length,
      secrets,
      plan: b.plan,
      arena,
      finishS,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}
