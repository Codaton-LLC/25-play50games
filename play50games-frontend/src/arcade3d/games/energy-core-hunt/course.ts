// The reactor arena: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a square arena (x right, z towards the camera; the hero starts at the south edge, the core
// gate stands at the north edge). The ORDER asks for a mix of colours (so many red, so many blue, ...).
// Cores drop in WAVES: each wave's needed cores, and extra cores of colours the order does not want yet
// (taking one is a wrong pick: a jolt and a hit). The next wave drops as soon as the mix asked of this
// one is complete. Then the gate opens. The twists: cores that fade and drop again elsewhere (level 2
// on), cores orbiting a pylon and cores sealed in capsules (Action opens one; level 3 on), flickering
// decoy cores and tesla coils (level 4 on), and on level 5 the Core Sprite holding the last cores.
// Around them the hero routes: orbs high over the crate stacks (Nyla), orbs and the shard inside a ring of
// crates (Vexa phases in; Zuno's magnet pulls the orbs), orbs by the tesla coils (Kiro's shield).
// README "Levels" lists each layout.
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type CoreLevel } from "./levels";
import { SECRETS } from "./progression";

/** red, blue, green, yellow, purple (the heroes' own colours) */
export const COLOR_NAMES = ["red", "blue", "green", "yellow", "purple"] as const;
export const ORB_Y = 1.0;
export const HIGH_Y = 3.1;
/** a crate's footprint (half size) and height */
export const CRATE_R = 0.75;
export const CRATE_H = 1.5;

export type CoreKind = "still" | "orbit" | "capsule";

export interface CoreDef {
   x: number;
   z: number;
   color: number;
   kind: CoreKind;
   /** needed by the order (else an extra: a wrong pick while its colour is full) */
   needed: boolean;
   /** a fading core drops again here (and back) */
   altX: number;
   altZ: number;
}

export interface Decoy {
   x: number;
   z: number;
   /** it flickers between these colours every FLICKER_MS */
   colors: [number, number];
}

export interface Wave {
   cores: CoreDef[];
   /** what this wave asks for, per colour */
   quota: number[];
   decoys: Decoy[];
}

export interface Crate {
   x: number;
   z: number;
   /** 1 or 2 high */
   stack: number;
}

export interface Tesla {
   x: number;
   z: number;
   period: number;
   onMs: number;
   offset: number;
   radius: number;
}

export type Bonus = "high" | "ring" | "tesla";

export interface OrbDef {
   x: number;
   z: number;
   h: number;
   bonus: Bonus | null;
   /** the wave it belongs to (it appears with it; -1 from the start) */
   wave: number;
}

export interface SecretDef {
   id: string;
   x: number;
   z: number;
   h: number;
}

export interface Course {
   level: LevelId;
   config: CoreLevel;
   half: number;
   start: { x: number; z: number };
   gate: { x: number; z: number };
   /** the colours in play */
   colors: number[];
   waves: Wave[];
   /** the order: per colour, all waves (and the Core Sprite) together */
   order: number[];
   crates: Crate[];
   teslas: Tesla[];
   orbs: OrbDef[];
   mainOrbs: number;
   secrets: SecretDef[];
   /** level 5: the Core Sprite holds these last cores (one per hit), in this colour order */
   boss: { x: number; z: number; colors: number[] } | null;
}

class Builder {
   waves: Wave[] = [];
   crates: Crate[] = [];
   teslas: Tesla[] = [];
   orbs: OrbDef[] = [];
   secrets: SecretDef[] = [];

   wave(needed: [number, number, number, CoreKind?][], extras: [number, number, number][] = [], decoys: Decoy[] = [], relocate = 0): void {
      const quota = [0, 0, 0, 0, 0];
      const cores: CoreDef[] = [];
      for (const [x, z, color, kind] of needed) {
         quota[color] += 1;
         const a = Math.atan2(z, x) + relocate;
         const r = Math.hypot(x, z);
         cores.push({ x, z, color, kind: kind ?? "still", needed: true, altX: relocate ? r * Math.cos(a) : x, altZ: relocate ? r * Math.sin(a) : z });
      }
      for (const [x, z, color] of extras) cores.push({ x, z, color, kind: "still", needed: false, altX: x, altZ: z });
      this.waves.push({ cores, quota, decoys });
      // a golden orb on the way to each needed core
      const w = this.waves.length - 1;
      for (const c of cores.filter((q) => q.needed)) this.orbs.push({ x: c.x * 0.75, z: c.z * 0.75, h: ORB_Y, bonus: null, wave: w });
   }

   crate(x: number, z: number, stack = 1): void {
      this.crates.push({ x, z, stack });
   }

   /** A stack of crates with Nyla's high orbs hanging beside its top (and the sticker): only a second jump reaches them. */
   stack(x: number, z: number, sticker: boolean): void {
      this.crate(x, z, 2);
      this.crate(x + 1.5, z, 1);
      const ox = x + (x < 0 ? 3.3 : -1.8);
      for (let k = 0; k < 2; k++) this.orbs.push({ x: ox, z: z + 0.6 - k * 1.2, h: HIGH_Y, bonus: "high", wave: -1 });
      if (sticker) this.secrets.push({ id: "high", x: ox, z: z - 1.6, h: HIGH_Y });
   }

   /** A closed ring of crates round a pocket: its orbs (Vexa phases in, Zuno pulls them) and the shard. */
   ring(cx: number, cz: number, shard: boolean): void {
      for (const [dx, dz] of [[-1.5, -1.5], [0, -1.5], [1.5, -1.5], [-1.5, 0], [1.5, 0], [-1.5, 1.5], [0, 1.5], [1.5, 1.5]]) this.crate(cx + dx, cz + dz, 1);
      this.orbs.push({ x: cx - 0.35, z: cz, h: ORB_Y, bonus: "ring", wave: -1 }, { x: cx + 0.35, z: cz, h: ORB_Y, bonus: "ring", wave: -1 });
      if (shard) this.secrets.push({ id: "ring", x: cx, z: cz + 0.4, h: 0.6 });
   }

   tesla(x: number, z: number, period: number, onMs: number, offset = 0): void {
      this.teslas.push({ x, z, period, onMs, offset, radius: 2.2 });
      this.orbs.push({ x: x + 1.1, z, h: ORB_Y, bonus: "tesla", wave: -1 }, { x: x - 1.1, z, h: ORB_Y, bonus: "tesla", wave: -1 });
   }
}

const R = 0, B = 1, Gr = 2, Y = 3, P = 4;

function level1(b: Builder): void {
   // Simple Hunt: 4 red + 2 blue. Wave 1 asks red only (the blue core is not wanted yet)
   b.wave([[-3, 3, R], [3, 3, R]], [[0, 0.5, B]]);
   b.wave([[-4, -2, B], [4, -2, R]], [[0, -4, R]]);
   b.wave([[-4.5, -5.5, R], [4.5, -5.5, B]], [[0, -2.5, R]]);
   b.stack(-6.5, 5.5, true);
   b.ring(6, 6, true);
}

function level2(b: Builder): void {
   // Mixed Colors: 3 colours; a core left too long fades and drops again across the arena
   const t = Math.PI / 3;
   b.wave([[-4, 4, R], [4, 4, B], [0, 1, Gr]], [[-6.5, 0, B]], [], t);
   b.wave([[-5, -1, Gr], [5, -1, R], [0, -3, B]], [[0, 4.5, Gr]], [], t);
   b.wave([[-4, -6.5, B], [4, -6.5, Gr], [0, -8, R]], [[-6, -3.5, B]], [], t);
   b.ring(-8, 8, true);
   b.stack(6.5, 7.5, false);
}

function level3(b: Builder): void {
   // Larger Arena: 4 colours; cores orbiting pylons, cores sealed in capsules (Action opens them)
   const t = Math.PI / 4;
   b.wave([[-5, 5, R], [5, 5, B, "orbit"], [0, 2, Gr]], [[-8, 0, Y]], [], t);
   b.wave([[-6, -1, Y, "capsule"], [6, -1, Gr], [0, -2, R, "orbit"]], [[0, 6, B]], [], t);
   b.wave([[-5, -6, B, "orbit"], [5, -6, Y], [0, -9, Gr, "capsule"]], [[8, -3, R]], [], t);
   b.wave([[-8, -9, R], [8, -9, B], [0, -6, Y, "capsule"]], [[-3, -3, Gr]], [], t);
   b.ring(10, 10, true);
   b.stack(-10, 9, false);
   b.crate(-10.5, -4);
   b.crate(10.5, 3);
}

function level4(b: Builder): void {
   // Moving Cores: 5 colours, shorter windows; flickering decoy cores; tesla coils
   const t = Math.PI / 5;
   const fl = (x: number, z: number, a: number, c: number): Decoy => ({ x, z, colors: [a, c] });
   b.wave([[-5, 6, R], [5, 6, B, "orbit"], [0, 3, Gr]], [], [fl(-2.5, 8, R, P)], t);
   b.wave([[-7, 0, Y, "capsule"], [7, 0, P], [0, -1, R, "orbit"]], [[0, 7, Gr]], [fl(3.5, 2, Y, B)], t);
   b.wave([[-6, -6, B, "orbit"], [6, -6, Gr], [0, -4, P]], [[-9, -1, R]], [fl(2.5, -8, B, Y)], t);
   b.wave([[-9, -10, Y], [9, -10, R], [0, -8, B, "capsule"]], [[4, -5, P]], [fl(-4, -9, Y, Gr)], t);
   b.wave([[-3, -11.5, P], [3, -11.5, Gr], [0, -13, Y, "orbit"]], [[-6, -8, B]], [fl(6, -12, P, R)], t);
   b.ring(-12, 11, true);
   b.stack(11, 10.5, true);
   b.tesla(-11.5, -2, 2400, 900);
   b.tesla(11.5, -4, 2000, 800, 600);
}

function level5(b: Builder): { x: number; z: number; colors: number[] } {
   // Core Master: 5 colours, four dense waves, then the Core Sprite holds the last four cores
   const t = Math.PI / 4;
   const fl = (x: number, z: number, a: number, c: number): Decoy => ({ x, z, colors: [a, c] });
   b.wave([[-5, 7, R], [5, 7, B], [-2, 3.5, Gr, "orbit"], [2.5, 3.5, Y]], [[0, 9.5, P]], [fl(-8, 4, R, Y)], t);
   b.wave([[-8, 0, P, "capsule"], [8, 0, R], [-3, -1, B, "orbit"], [3, -1, Gr]], [[0, 5.5, Y]], [fl(6, 4, B, P)], t);
   b.wave([[-6, -6, Y], [6, -6, P, "orbit"], [-1.5, -4, R], [2, -8, B, "capsule"]], [[-10, -3, Gr]], [fl(9, -3, Y, R)], t);
   b.wave([[-10, -11, Gr], [10, -11, Y], [-3, -12, B], [3, -9, P, "orbit"]], [[0, -5.5, R]], [fl(-6, -13, Gr, B), fl(6, -13, P, Gr)], t);
   b.ring(12.5, 12.5, true);
   b.stack(-12.5, 11.5, false);
   b.tesla(-13, 0, 2200, 800);
   b.tesla(13, -5, 2000, 800, 700);
   return { x: 0, z: -2, colors: [R, B, Gr, P] };
}

export function buildCourse(level: LevelId, config: CoreLevel = LEVELS[level]): Course {
   const b = new Builder();
   let boss: Course["boss"] = null;
   if (level === 1) level1(b);
   else if (level === 2) level2(b);
   else if (level === 3) level3(b);
   else if (level === 4) level4(b);
   else boss = level5(b);
   const H = config.half;
   const order = [0, 0, 0, 0, 0];
   for (const w of b.waves) for (let c = 0; c < 5; c++) order[c] += w.quota[c];
   if (boss) for (const c of boss.colors) order[c] += 1;
   const colors = [0, 1, 2, 3, 4].slice(0, config.colors);
   const orbs = b.orbs.slice();
   const secrets = SECRETS[level].map((spec) => {
      const d = b.secrets.find((x) => x.id === spec.id);
      if (!d) throw new Error(`energy-core-hunt: level ${level} has no ${spec.id} secret`);
      return d;
   });
   return {
      level,
      config,
      half: H,
      start: { x: 0, z: H - 1.5 },
      gate: { x: 0, z: -H + 0.8 },
      colors,
      waves: b.waves,
      order,
      crates: b.crates,
      teslas: b.teslas,
      orbs,
      mainOrbs: orbs.filter((o) => o.bonus === null).length,
      secrets,
      boss,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}
