// Cloud Hopper's courses (the design card, docs/menu2-super/world-2-sky-and-sea.md "5 Cloud Hopper"):
// a horizontal run along -z across a drifting cloud sea, built from a short script per level. Pure,
// no Math.random: the same level is the same race for every seed (a time leaderboard).
//
// Script tokens (read left to right; the cursor is the last main-route cloud):
//   h  a hop: the next cloud 2.5-3.5 m away (an orb on every other one)
//   g  a glide gap: a feather on this cloud, the next cloud 10 m away and a little lower
//   G  a long glide gap (11.5 m)
//   r  a ring gap: a feather here, a wind ring half way, the next cloud 17 m away (only a glide with the ring's refill reaches it)
//   a  a solid anchor cloud (a checkpoint, it never sinks); one comes by itself after 55 m without
//   d  the next hop cloud drifts sideways (level 2)
//   p  the next hop cloud pulses on the 0.75 s beat (level 4)
//   m  an orb in mid-air on the next glide gap's line (the downwind sprints of level 3)
//   + - > <   a wind band from here: tail (40 m), head (30 m, hops only: a glide into it is half as fast), cross to +x, cross to -x (30 m)
//   N  Nami's sun shelf beside the next glide gap (a double jump out of the glide reaches it)
//   R  Riko's storm shelf beside this cloud, behind a storm-cloud wall an air dash breaks
//   V  Vexa's night path beside this cloud, behind a one-way ghost-cloud wall
//   Z  Zuno's rain column beside this cloud (orbs only the magnet draws out)
//   K  a thunderhead beside the next glide gap's line (an orb inside it: Kiro's shield)
//   S  the dawn shard: a hidden cloud under the next glide gap, with a lift ring back up
//   L  the secret lift ring of level 3: a high ring that refills the whole glide (a shortcut ahead)
//   T  thunder strikes this cloud's rim from the nearest thunderhead (level 4)
//   X  a lightning rod for Gloom Nimbus 6 m ahead (level 5)
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type CloudLevel } from "./levels";

export type CloudKind = "start" | "cloud" | "anchor" | "goal" | "side" | "shelf" | "hidden";

/** A sideways drift: offset x = travel · (2 · smoothstep(triangle(ms / period + phase)) − 1). */
export interface Drift {
   travel: number;
   periodMs: number;
   phase: number;
}

/** A pulse cloud is solid while frac(ms / periodMs + phase) < on. */
export interface Pulse {
   periodMs: number;
   on: number;
   phase: number;
}

export interface CloudDef {
   kind: CloudKind;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   /** the crown at rest (m) */
   top: number;
   /** sinks after a landing and bursts (anchors, the start, the goal and hidden clouds hold) */
   sinks: boolean;
   drift: Drift | null;
   pulse: Pulse | null;
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   /** "main" counts for the all-orbs star; "bonus" orbs sit on a hero-gated route */
   kind: "main" | "bonus";
   /** only Zuno's magnet draws it out (the rain column trails) */
   hidden: boolean;
   /** the hero whose route it is on (bonus orbs) */
   hero: HeroId | null;
}

export interface FeatherDef {
   x: number;
   y: number;
   z: number;
}

/** A ring to fly through. A wind ring adds glide; a lift ring throws you up and fills the glide. */
export interface RingDef {
   x: number;
   y: number;
   z: number;
   radius: number;
   kind: "wind" | "lift";
   /** glide ms added (wind) or the glide the lift tops the meter up to */
   glideMs: number;
   /** upward launch (m/s), lift rings only (0 = none) */
   liftV: number;
}

/** A wall box. Storm walls break under Riko's air dash; ghost walls stop you only from the main side (Vexa phases through). */
export interface WallDef {
   kind: "storm" | "ghost";
   x0: number;
   x1: number;
   z0: number;
   z1: number;
   y0: number;
   y1: number;
   /** ghost walls: the main route lies on this side of the wall (sign of x - wall centre) */
   side: number;
}

/** A thunderhead: a sphere that drops a hero who touches it (shield and phase pass). */
export interface ThunderDef {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** Thunder strikes a cloud's rim on a cycle (level 4). The centre stays outside `radius`. */
export interface StrikeDef {
   cloud: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   duty: number;
   phase: number;
}

/** A wind band: a slab of z (z0 near > z1 far) with a wind velocity felt in the air (m/s). */
export interface BandDef {
   z0: number;
   z1: number;
   wx: number;
   wz: number;
}

/** Gloom Nimbus's lightning rods (level 5): gliding past one charges a shock. */
export interface RodDef {
   x: number;
   y: number;
   z: number;
}

export interface CourseDraft {
   clouds: CloudDef[];
   /** the main route, start to goal, in order (cloud indices) */
   route: number[];
   orbs: OrbDef[];
   feathers: FeatherDef[];
   rings: RingDef[];
   walls: WallDef[];
   thunder: ThunderDef[];
   strikes: StrikeDef[];
   bands: BandDef[];
   rods: RodDef[];
   /** where each secret floats, by id (progression.ts SECRETS) */
   secrets: Record<string, { x: number; y: number; z: number }>;
   /** the script tokens played before the length was covered (tests: every level plays its whole script) */
   played: string;
}

/** The level scripts (README "Levels"). Each teaches its twist in its first tokens. */
export const SCRIPTS: Record<LevelId, string> = {
   // L1: beat 1 big clouds two metres apart, beat 2 a feather and a 10 m gap, beat 3 a wind ring only a glide reaches
   1: "hhh g hh a r hh Z h g h R h a h N g h V h S g h K g h a hh g h",
   // L2: the clouds drift on lanes, so landings are planned
   2: "h dh dh g hh a dh dh R h g dh h S g dh a h dh N g dh Z h dh a h V dh g dh h K g dh a dh h g hh",
   // L3: crosswind bands, a head wind that halves a glide, tail winds that double it (some orbs need the downwind sprint)
   3: "hh g hh a >h h g h < hh a -h hh h hh +h m g h m g h a h Z h V h R h +h L m g h m g hh N g h a K g h >h h a +h m g hh",
   // L4: pulse clouds solid on the beat, thunderheads that zap the clouds beside them
   4: "hh g ph ph a h K g Th ph h S g ph a ph h T h g ph ph a Z h N g ph h R h a ph T h g h ph V h a h K g Th ph g ph a ph h g hh",
   // L5: everything, with Gloom Nimbus chasing; three lightning rods, then its eyes
   5: "hh g X hh a dh h X g ph h a X h dh g h a +h m g h S g h a >h ph T h K g h a -h hh dh h R h a V h dh N g h Z h a +h m g ph h a h g h a h dh g hh a hh g h",
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** What follows a script that ends before the level's length is covered. */
const FILLER = "hhgha";

/** Gap sizes (m, edge to edge). */
export const GAP = { hop: [2.5, 3.0, 3.5], glide: 10, longGlide: 11.5, ring: 17 } as const;

/** The mid-air glide line's height over a launch top (m): about where a glide from a jump's apex is half way. */
export const GLIDE_LINE_Y = 2.2;

class Builder {
   d: CourseDraft = { clouds: [], route: [], orbs: [], feathers: [], rings: [], walls: [], thunder: [], strikes: [], bands: [], rods: [], secrets: {}, played: "" };
   n = 0;
   sinceAnchor = 0;
   driftNext = false;
   pulseNext = false;
   midOrbNext = false;
   sunNext = false;
   stormGapNext = false;
   dawnNext = false;
   side = 1;
   constructor(readonly level: CloudLevel) {}

   get last(): CloudDef {
      return this.d.clouds[this.d.route[this.d.route.length - 1]];
   }

   add(c: CloudDef, route: boolean): number {
      this.d.clouds.push(c);
      const i = this.d.clouds.length - 1;
      if (route) this.d.route.push(i);
      return i;
   }

   start(): void {
      this.add({ kind: "start", cx: 0, cz: 0, hw: 4, hd: 4, top: 0, sinks: false, drift: null, pulse: null }, true);
   }

   /** the lateral sway of the n-th cloud */
   swayX(): number {
      return round2(2.2 * Math.sin(this.n * 0.55));
   }

   /** the next cloud's height: a gentle walk between -2.5 and 2.5 */
   nextTop(drop: number): number {
      const t = this.last.top;
      if (drop !== 0) return round2(t + drop);
      const k = this.n % 4;
      let dy = k === 0 ? 0.4 : k === 1 ? -0.2 : k === 2 ? 0.3 : -0.4;
      if (t > 2) dy = -0.5;
      if (t < -2) dy = 0.6;
      return round2(t + dy);
   }

   next(gap: number, opts: { kind?: CloudKind; w?: number; d?: number; drop?: number; orb?: boolean } = {}): number {
      const prev = this.last;
      this.n += 1;
      const kind = opts.kind ?? "cloud";
      const w = opts.w ?? (kind === "anchor" ? 7 : 4.2);
      const dd = opts.d ?? (kind === "anchor" ? 7 : 4);
      const cz = round2(prev.cz - prev.hd - gap - dd / 2);
      const drift: Drift | null = this.driftNext && kind === "cloud" ? { travel: 1.6, periodMs: 6000, phase: round2((this.n % 4) * 0.25) } : null;
      const pulse: Pulse | null = this.pulseNext && kind === "cloud" ? { periodMs: 750, on: 0.6, phase: round2((this.n % 3) * 0.33) } : null;
      this.driftNext = false;
      this.pulseNext = false;
      const c: CloudDef = {
         kind,
         cx: kind === "anchor" ? round2(this.swayX() * 0.5) : this.swayX(),
         cz,
         hw: w / 2,
         hd: dd / 2,
         top: this.nextTop(opts.drop ?? 0),
         sinks: kind === "cloud" && !pulse,
         drift,
         pulse,
      };
      const i = this.add(c, true);
      this.sinceAnchor += prev.cz - cz;
      // orbs sit still in the air, so a drifting cloud carries none
      if (!drift && (opts.orb ?? (kind === "cloud" && (this.n % 3 !== 1 || this.level.id === 2)))) this.orb(c.cx, c.top + 0.9, c.cz, "main");
      return i;
   }

   orb(x: number, y: number, z: number, kind: "main" | "bonus", hero: HeroId | null = null, hidden = false): void {
      this.d.orbs.push({ x: round2(x), y: round2(y), z: round2(z), kind, hidden, hero });
   }

   feather(c: CloudDef): void {
      this.d.feathers.push({ x: c.cx, y: round2(c.top + 0.8), z: round2(c.cz - c.hd * 0.35) });
   }

   hop(): void {
      // level 1's first beat: big clouds two metres apart
      if (this.level.id === 1 && this.n < 3) this.next(2, { w: 5, d: 5, orb: true });
      else this.next(GAP.hop[this.n % 3]);
   }

   anchor(): void {
      this.next(3, { kind: "anchor" });
      this.sinceAnchor = 0;
   }

   /** A glide gap: a feather on the launch cloud, the next cloud `gap` away and `drop` lower; the side features hang on it. */
   glide(gap: number, drop: number, ring: boolean): void {
      const a = this.last;
      this.feather(a);
      const ia = this.d.route[this.d.route.length - 1];
      const ib = this.next(gap, { drop, orb: true });
      const b = this.d.clouds[ib];
      const midZ = round2((a.cz - a.hd + b.cz + b.hd) / 2);
      const midX = round2((a.cx + b.cx) / 2);
      const lineY = round2(a.top + GLIDE_LINE_Y);
      if (ring) this.d.rings.push({ x: midX, y: lineY, z: midZ, radius: 1.6, kind: "wind", glideMs: 1000, liftV: 0 });
      if (this.midOrbNext) {
         this.orb(midX, lineY, midZ, "main");
         this.midOrbNext = false;
      }
      if (this.sunNext) {
         // Nami's sun shelf: beside the glide line, 4.2 m over the launch (a jump's apex is 2.8 m)
         this.sunNext = false;
         const side = this.flip();
         const top = round2(a.top + 4.2);
         const x = round2(midX + side * 3.6);
         this.add({ kind: "shelf", cx: x, cz: midZ, hw: 1.6, hd: 1.8, top, sinks: false, drift: null, pulse: null }, false);
         for (const dz of [-0.8, 0.8]) this.orb(x, top + 0.9, midZ + dz, "bonus", "nami");
      }
      if (this.stormGapNext) {
         // a thunderhead beside the glide line, an orb in its heart (Kiro's shield goes through)
         this.stormGapNext = false;
         const side = this.flip();
         const t: ThunderDef = { x: round2(midX + side * 3.2), y: round2(lineY + 0.4), z: midZ, r: 1.7 };
         this.d.thunder.push(t);
         this.orb(t.x, t.y, t.z, "bonus", "kiro");
         if (this.level.id === 4) this.d.secrets.thunder = { x: t.x, y: round2(t.y + 0.6), z: round2(t.z - 0.6) };
      }
      if (this.dawnNext) {
         // the dawn shard: a hidden cloud 6.5 m under the gap, a lift ring over it throws you back up
         this.dawnNext = false;
         const top = round2(a.top - 6.5);
         this.add({ kind: "hidden", cx: midX, cz: midZ, hw: 1.6, hd: 1.6, top, sinks: false, drift: null, pulse: null }, false);
         this.d.secrets.dawn = { x: midX, y: round2(top + 1.0), z: midZ };
         this.d.rings.push({ x: midX, y: round2(top + 2.6), z: round2(midZ - 1.2), radius: 1.3, kind: "lift", glideMs: 3000, liftV: 22 });
      }
      void ia;
   }

   flip(): number {
      this.side = -this.side;
      return this.side;
   }

   /** Riko's storm shelf: a side cloud level with this one, a storm-cloud wall between them. */
   stormShelf(): void {
      const c = this.last;
      const side = this.flip();
      const x = round2(c.cx + side * (c.hw + 3 + 2));
      this.add({ kind: "side", cx: x, cz: c.cz, hw: 2, hd: 2, top: c.top, sinks: false, drift: null, pulse: null }, false);
      const wx = c.cx + side * (c.hw + 1.2);
      this.d.walls.push({ kind: "storm", x0: round2(Math.min(wx, wx + side * 1.2)), x1: round2(Math.max(wx, wx + side * 1.2)), z0: round2(c.cz - 5), z1: round2(c.cz + 5), y0: round2(c.top - 3), y1: round2(c.top + 7), side });
      for (const dz of [-0.8, 0.8]) this.orb(x, c.top + 0.9, c.cz + dz, "bonus", "riko");
      if (this.level.id === 2 || this.level.id === 5) this.d.secrets.storm = { x, y: round2(c.top + 1.6), z: round2(c.cz - 1.2) };
   }

   /** Vexa's night path: two night clouds beside this one, behind a ghost wall that stops you from the main side only. */
   nightPath(): void {
      const c = this.last;
      const side = this.flip();
      const x = round2(c.cx + side * (c.hw + 5));
      this.add({ kind: "side", cx: x, cz: c.cz, hw: 2, hd: 2, top: round2(c.top + 0.4), sinks: false, drift: null, pulse: null }, false);
      this.add({ kind: "side", cx: x, cz: round2(c.cz - 6), hw: 2, hd: 2, top: round2(c.top + 0.8), sinks: false, drift: null, pulse: null }, false);
      const wx = c.cx + side * (c.hw + 1.3);
      // the veil runs alongside the main route: the main side is -side
      this.d.walls.push({ kind: "ghost", x0: round2(Math.min(wx, wx + side * 0.8)), x1: round2(Math.max(wx, wx + side * 0.8)), z0: round2(c.cz - 10), z1: round2(c.cz + 4), y0: round2(c.top - 3), y1: round2(c.top + 7), side: -side });
      this.orb(x, c.top + 1.3, c.cz, "bonus", "vexa");
      this.orb(x, c.top + 1.7, c.cz - 6, "bonus", "vexa");
      this.d.secrets.night = { x, y: round2(c.top + 2.0), z: round2(c.cz - 3) };
   }

   /** Zuno's rain column: four hidden orbs over the side of this cloud (only the magnet draws them out). */
   rainColumn(): void {
      const c = this.last;
      const side = this.flip();
      for (let k = 0; k < 3; k++) this.orb(c.cx + side * 4, c.top + 1.2 + k * 1.2, c.cz, "bonus", "zuno", true);
   }

   /** Level 3's secret lift ring: high over this cloud's far edge; it fills the whole glide (a shortcut on the tail wind). */
   secretLift(): void {
      const c = this.last;
      const side = this.flip();
      const r: RingDef = { x: round2(c.cx + side * 2.8), y: round2(c.top + 3.1), z: round2(c.cz - c.hd), radius: 1.2, kind: "lift", glideMs: 4500, liftV: 16 };
      this.d.rings.push(r);
      this.d.secrets.lift = { x: r.x, y: round2(r.y + 1.6), z: r.z };
   }

   /** Level 4: a strike on this cloud's rim, from the thunderhead nearest it (or one placed beside it). */
   strike(): void {
      const i = this.d.route[this.d.route.length - 1];
      const c = this.d.clouds[i];
      const side = this.flip();
      this.d.thunder.push({ x: round2(c.cx + side * (c.hw + 2.6)), y: round2(c.top + 3.2), z: c.cz, r: 1.4 });
      this.d.strikes.push({ cloud: i, ox: round2(side * (c.hw - 0.5)), oz: 0, radius: 1.0, periodMs: 3000, duty: 0.22, phase: round2((i % 4) * 0.25) });
   }

   band(len: number, wx: number, wz: number): void {
      const z0 = round2(this.last.cz - this.last.hd);
      this.d.bands.push({ z0, z1: round2(z0 - len), wx, wz });
   }

   rod(): void {
      const c = this.last;
      this.d.rods.push({ x: c.cx, y: round2(c.top + 2), z: round2(c.cz - c.hd - 3) });
   }

   goal(): void {
      const prev = this.last;
      this.n += 1;
      const cz = round2(prev.cz - prev.hd - 3 - 6);
      this.add({ kind: "goal", cx: 0, cz, hw: 3.5, hd: 6, top: round2(prev.top + 0.2), sinks: false, drift: null, pulse: null }, true);
   }
}

/** Builds a level's course from its script; the script repeats until the length is covered, then the rainbow bridge. */
export function buildDraft(level: CloudLevel = LEVELS[1], script: string = SCRIPTS[level.id]): CourseDraft {
   const b = new Builder(level);
   b.start();
   const tokens = script.replace(/\s+/g, "");
   let guard = 0;
   for (let k = 0; guard < 4000; k++, guard++) {
      if (-b.last.cz >= level.length - 14) break;
      // past the script's end: plain filler (hops, a glide, an anchor) until the length is covered
      const t = k < tokens.length ? tokens[k] : FILLER[(k - tokens.length) % FILLER.length];
      if (k < tokens.length) b.d.played += t;
      // the card's risk fix: a solid anchor cloud at least every 60 m
      if (b.sinceAnchor >= 55 && (t === "h" || t === "g" || t === "G" || t === "r")) b.anchor();
      switch (t) {
         case "h":
            b.hop();
            break;
         case "g":
            b.glide(GAP.glide, -0.8, false);
            break;
         case "G":
            b.glide(GAP.longGlide, -1.0, false);
            break;
         case "r":
            b.glide(GAP.ring, -1.4, true);
            break;
         case "a":
            if (b.sinceAnchor >= 40) b.anchor();
            break;
         case "d":
            b.driftNext = true;
            break;
         case "p":
            b.pulseNext = true;
            break;
         case "m":
            b.midOrbNext = true;
            break;
         case "+":
            b.band(40, 0, -7);
            break;
         case "-":
            b.band(30, 0, 3.5);
            break;
         case ">":
            b.band(30, 3, 0);
            break;
         case "<":
            b.band(30, -3, 0);
            break;
         case "N":
            b.sunNext = true;
            break;
         case "R":
            b.stormShelf();
            break;
         case "V":
            b.nightPath();
            break;
         case "Z":
            b.rainColumn();
            break;
         case "K":
            b.stormGapNext = true;
            break;
         case "S":
            b.dawnNext = true;
            break;
         case "L":
            b.secretLift();
            break;
         case "T":
            b.strike();
            break;
         case "X":
            b.rod();
            break;
      }
   }
   b.goal();
   // bands never overlap: a later band starts where an earlier one ends
   const bands = b.d.bands;
   for (let i = 1; i < bands.length; i++) if (bands[i].z0 > bands[i - 1].z1) bands[i - 1].z1 = bands[i].z0;
   return b.d;
}
