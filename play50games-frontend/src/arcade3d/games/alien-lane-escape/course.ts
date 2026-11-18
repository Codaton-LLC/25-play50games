// The alien valley: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a straight three-lane track (s = metres from the start, running towards -z). Its rhythm is
// a chain of SCANS: as you pass a scan's trigger the mothership behind you sends a violet line sweeping
// forward along the track at 22 m/s (or, on level 4, a lateral line across the lanes 1.5 s later); it
// catches you where you will be by then (its meeting point), so the course puts a cover there: a crystal
// leaning over a lane, a rock, a hovering pod drifting into its lane (level 2), a meteor crater that only
// forms once the meteor lands (level 3). Each cover's shadow is a 3 m strip on its lane; low covers only
// hide a hero who slides. Around the scans: rocks to jump, low arches to slide under, goo, glow plants
// that wash the shadows out for 3 s when brushed (level 4), and the hero routes (Nyla's high mesa, Vexa's
// ghost-crystal cave, Zuno's goo trails, Kiro's goo crossings, Riko's open-ground orbs). Level 5's launch
// road repeats until the Mothership is down. README "Levels" lists each layout.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type AlienLevel } from "./levels";
import { SECRETS } from "./progression";

/** the lane spacing (m): lanes 0 1 2 at x = -2.6, 0, 2.6; the cave lane 3 at 5.2 */
export const LANE_W = 2.6;
/** a scan line sweeps forward at this speed (m/s), starting this far behind you (m) */
export const SCAN_SPEED = 22;
export const SCAN_LEAD = 40;
/** a lateral line (level 4) lands this long after its trigger (ms) */
export const LATERAL_MS = 1500;
/** every scan is telegraphed this long before it reaches you (ms) */
export const TELEGRAPH_MS = 1500;
/** a cover's shadow: this strip of its lane behind it (m from the cover) */
export const STRIP = { from: 0.5, to: 3.5 } as const;
/** the high mesa lane (Nyla) runs this high over the middle lane */
export const MESA_Y = 2.4;
export const ORB_Y = 1.0;

export function laneX(lane: number): number {
   return (lane - 1) * LANE_W;
}

export type CoverKind = "crystal" | "rock" | "pod" | "crater";

export interface Cover {
   s: number;
   lane: number;
   kind: CoverKind;
   /** a low cover only hides a hero who slides */
   low: boolean;
   /** a pod drifts in from this lane during its scan (level 2); a crater forms when this meteor lands */
   from: number;
   meteor: number;
   /** its scan (covers and scans pair up by index) */
   scan: number;
   phase: number;
}

export type ScanKind = "sweep" | "lateral";

export interface Scan {
   trigger: number;
   kind: ScanKind;
   /** where it meets a runner running at the level's speed (the course puts the cover there) */
   meet: number;
   phase: number;
}

export type ObstacleKind = "rock" | "arch" | "blob";

export interface Obstacle {
   s: number;
   lane: number;
   /** rock and blob: jump; arch: slide */
   kind: ObstacleKind;
   phase: number;
}

export interface OrbDef {
   s: number;
   lane: number;
   h: number;
   /** the hero whose route carries it (a bonus orb), "open" for an orb in open ground at a scan, null on the main track */
   bonus: HeroId | "open" | null;
   /** pulled out of the goo: only Zuno's magnet takes it */
   magnet: boolean;
}

export interface LaneSpan {
   lane: number;
   s0: number;
   s1: number;
}

export interface Meteor {
   s: number;
   lane: number;
   /** it falls as you pass this; lands 1 s later */
   trigger: number;
}

export interface SecretDef {
   id: string;
   s: number;
   lane: number;
   h: number;
}

export type BossEventKind = "lure" | "underside" | "crash";

export interface BossEvent {
   s: number;
   lane: number;
   kind: BossEventKind;
   phase: number;
}

/** The bot's plan: where to be at each scan, and whether to slide (the course's own answer key). */
export interface Beat {
   s: number;
   lane: number;
   low: boolean;
   phase: number;
}

export interface Course {
   level: LevelId;
   config: AlienLevel;
   covers: Cover[];
   scans: Scan[];
   obstacles: Obstacle[];
   orbs: OrbDef[];
   mainOrbs: number;
   goo: LaneSpan[];
   meteors: Meteor[];
   /** level 4's glow plants (brushed: they wash out the shadows near them for 3 s) */
   plants: { s: number; lane: number }[];
   /** Nyla's high mesa over the middle lane */
   mesas: { s0: number; s1: number }[];
   /** Vexa's caves (lane 3) behind a ghost-crystal wall at s0 (two per level; the first holds the shard) */
   caves: { s0: number; s1: number }[];
   /** level 3: the abduction zone (a catch inside it lifts you to the shard's floating rock) */
   abduction: { s0: number; s1: number } | null;
   /** aligned with progression SECRETS[level] */
   secrets: SecretDef[];
   bossEvents: BossEvent[];
   beats: Beat[];
   finishS: number;
   /** level 5: the launch road that repeats until the Mothership is down */
   loop: { s0: number; s1: number } | null;
}

/** Where a sweep meets a runner at speed v that passes its trigger at s. */
export function sweepMeet(trigger: number, v: number): number {
   return trigger + (v * SCAN_LEAD) / (SCAN_SPEED - v);
}

// ---------- the builder ----------

class Builder {
   s = 0;
   v: number;
   phase = -1;
   covers: Cover[] = [];
   scans: Scan[] = [];
   obstacles: Obstacle[] = [];
   orbs: OrbDef[] = [];
   goo: LaneSpan[] = [];
   meteors: Meteor[] = [];
   plants: { s: number; lane: number }[] = [];
   mesas: { s0: number; s1: number }[] = [];
   caves: { s0: number; s1: number }[] = [];
   abduction: { s0: number; s1: number } | null = null;
   secrets: SecretDef[] = [];
   bossEvents: BossEvent[] = [];
   beats: Beat[] = [];

   constructor(v: number) {
      this.v = v;
   }

   orb(s: number, lane: number, h = ORB_Y, bonus: OrbDef["bonus"] = null, magnet = false): void {
      this.orbs.push({ s, lane, h, bonus, magnet });
   }

   /**
    * A scan `gap` m on: it meets you at its meeting point, where a cover leans over `lane` (its strip
    * centred on the meeting point). Two orbs reward the cover; `open` puts three risky orbs in open ground
    * at the meeting point in another lane (Riko's dash takes them unseen).
    */
   scan(gap: number, lane: number, kind: CoverKind = "crystal", o: { low?: boolean; lateral?: boolean; from?: number; open?: number; plant?: boolean } = {}): number {
      const trigger = this.s + gap;
      const meet = o.lateral ? trigger + (this.v * LATERAL_MS) / 1000 : sweepMeet(trigger, this.v);
      this.scans.push({ trigger, kind: o.lateral ? "lateral" : "sweep", meet, phase: this.phase });
      let meteor = -1;
      if (kind === "crater") {
         // the meteor lands as you pass the trigger (1 s later), far ahead: its crater is the cover
         this.meteors.push({ s: meet - 2, lane, trigger });
         meteor = this.meteors.length - 1;
      }
      this.covers.push({ s: meet - 2, lane, kind, low: !!o.low, from: o.from ?? lane, meteor, scan: this.scans.length - 1, phase: this.phase });
      // level 4: a glow plant in the cover's lane just before it: steer in after it, or it washes the shadow out
      if (o.plant) this.plants.push({ s: meet - 10, lane });
      this.beats.push({ s: meet, lane, low: !!o.low, phase: this.phase });
      if (this.phase < 0) {
         this.orb(meet - 1, lane);
         this.orb(meet + 1, lane);
         if (o.open !== undefined) for (const k of [-1, 0, 1]) this.orb(meet + k, o.open, ORB_Y, "open");
      }
      this.s = meet;
      return meet;
   }

   obstacle(at: number, lane: number, kind: ObstacleKind): void {
      this.obstacles.push({ s: this.s + at, lane, kind, phase: this.phase });
   }

   orbRow(lane: number, from: number, n: number, spacing = 2.5, bonus: OrbDef["bonus"] = null, h = ORB_Y): void {
      for (let i = 0; i < n; i++) this.orb(this.s + from + i * spacing, lane, h, bonus);
   }

   /** Nyla's high mesa over the middle lane, its orbs (and the sticker on levels 1 and 4). */
   mesa(from: number, len: number, sticker: boolean): void {
      const s0 = this.s + from;
      this.mesas.push({ s0, s1: s0 + len });
      for (let i = 0; i < 3; i++) this.orb(s0 + 4 + i * 4, 1, MESA_Y + ORB_Y, "nami");
      if (sticker) this.secrets.push({ id: "mesa", s: s0 + len - 3, lane: 1, h: MESA_Y + ORB_Y });
   }

   /** Vexa's cave (lane 3) behind a ghost-crystal wall: its orbs and the shard. */
   cave(from: number, len: number, shard = true): void {
      const s0 = this.s + from;
      this.caves.push({ s0, s1: s0 + len });
      for (let i = 0; i < 2; i++) this.orb(s0 + 5 + i * 4, 3, ORB_Y, "vexa");
      if (shard) this.secrets.push({ id: "cave", s: s0 + len - 5, lane: 3, h: ORB_Y });
   }

   /** The run out: Vexa's second ghost wall (World 5: two per level), then the last orbs. */
   end(lane: number): void {
      this.cave(6, 18, false);
      this.s += 26;
      this.orbRow(lane, 8, 3);
   }

   /** A goo puddle in a lane: Kiro's orbs in it, Zuno's coin trail pulled out of it. */
   goop(lane: number, from: number, len: number): void {
      const s0 = this.s + from;
      this.goo.push({ lane, s0, s1: s0 + len });
      this.orb(s0 + len / 2, lane, ORB_Y, "kiro");
      for (let i = 0; i < 3; i++) this.orb(s0 + 2 + i * 3, lane, 0.3, "zuno", true);
   }
}

// ---------- the levels ----------

function level1(b: Builder): void {
   // Alien Meadow: (1) a big crystal right in your lane: stay put; (2) the cover in the next lane;
   // (3) two quick scans with two covers in a row
   b.s = 10;
   b.orbRow(1, 0, 3);
   b.scan(8, 1, "crystal");
   b.obstacle(12, 1, "rock");
   b.scan(20, 2, "crystal", { open: 0 });
   b.mesa(8, 20, true);
   b.scan(30, 1, "rock");
   b.scan(8, 0, "crystal");
   b.obstacle(10, 0, "arch");
   b.goop(2, 8, 12);
   b.scan(24, 0, "crystal", { open: 1 });
   b.cave(8, 30);
   b.scan(14, 2, "rock");
   b.obstacle(10, 2, "rock");
   b.scan(22, 1, "crystal", { low: true });
   b.scan(8, 2, "crystal");
   b.end(2);
}

function level2(b: Builder): void {
   // Crystal Route: moving cover: hovering pods drift across the lanes, their shadow with them
   b.s = 10;
   b.orbRow(1, 0, 3);
   b.scan(8, 1, "pod", { from: 0 });
   b.obstacle(12, 1, "arch");
   b.scan(20, 2, "pod", { from: 0, open: 0 });
   b.goop(0, 8, 12);
   b.scan(28, 0, "crystal");
   b.cave(8, 30);
   b.scan(14, 2, "pod", { from: 1 });
   b.obstacle(10, 2, "rock");
   b.scan(22, 1, "pod", { from: 2, open: 0 });
   b.mesa(8, 20, false);
   b.scan(30, 0, "pod", { from: 2 });
   b.obstacle(10, 0, "arch");
   b.scan(22, 2, "crystal", { low: true });
   b.scan(8, 1, "pod", { from: 0 });
   b.end(1);
}

function level3(b: Builder): void {
   // Meteor Zone: meteors land ahead (a ring 1 s before) and leave craters that become new shadows
   b.s = 10;
   b.orbRow(1, 0, 3);
   b.scan(8, 1, "crater");
   b.obstacle(12, 1, "rock");
   b.scan(20, 0, "crater", { open: 2 });
   b.goop(2, 8, 12);
   b.scan(28, 2, "crystal");
   // the abduction zone: a catch here lifts you to the shard's floating rock
   b.abduction = { s0: b.s + 10, s1: b.s + 70 };
   b.cave(8, 30);
   b.scan(14, 1, "crater");
   b.obstacle(10, 1, "arch");
   b.scan(22, 0, "crater", { open: 1 });
   b.mesa(8, 20, false);
   b.scan(30, 2, "crater");
   b.obstacle(10, 2, "rock");
   b.scan(22, 1, "rock", { low: true });
   b.scan(8, 0, "crater");
   b.secrets.push({ id: "abducted", s: (b.abduction.s0 + b.abduction.s1) / 2, lane: 1, h: 6 });
   b.end(0);
}

function level4(b: Builder): void {
   // Glow Plants: a plant just before a cover lights up if you brush it and washes that shadow out for
   // 3 s (steer in after it); lateral scans land across the lanes 1.5 s after their trigger
   b.s = 10;
   b.orbRow(1, 0, 3);
   b.scan(8, 1, "crystal");
   b.scan(20, 2, "crystal", { lateral: true, open: 0, plant: true });
   b.obstacle(14, 2, "rock");
   b.scan(26, 0, "rock", { plant: true });
   b.goop(2, 8, 12);
   b.scan(26, 1, "crystal", { lateral: true });
   b.cave(10, 30);
   b.scan(14, 2, "crystal", { low: true, plant: true });
   b.obstacle(10, 2, "arch");
   b.scan(22, 0, "crystal", { lateral: true, open: 2 });
   b.mesa(8, 20, true);
   b.scan(30, 1, "rock", { plant: true });
   b.obstacle(10, 1, "rock");
   b.scan(22, 2, "crystal", { lateral: true, plant: true });
   b.scan(8, 0, "crystal");
   b.end(0);
}

/** Level 5: the run in, then the launch road (it repeats until the Mothership is down), then the pad. */
function level5(b: Builder): { s0: number; s1: number } {
   b.s = 10;
   b.orbRow(1, 0, 3);
   b.scan(8, 1, "crystal");
   b.goop(0, 8, 12);
   b.scan(24, 2, "pod", { from: 0, open: 0 });
   b.cave(8, 30);
   b.scan(14, 0, "crater");
   b.mesa(8, 20, false);
   b.scan(30, 1, "crystal", { low: true });
   b.cave(6, 12, false);
   const s0 = b.s + 22;
   const lap = 200;
   const phase = (p: number, plan: (q: Builder) => void) => {
      b.s = s0;
      b.phase = p;
      plan(b);
   };
   // phase 1: blobs to jump, abduction beams to lure onto the decoy pods (stand in its lane as the beam
   // locks 8 m before, leave it before it lands)
   phase(0, (q) => {
      q.bossEvents.push({ s: s0 + 40, lane: 0, kind: "lure", phase: 0 });
      q.obstacles.push({ s: s0 + 60, lane: 1, kind: "blob", phase: 0 });
      q.bossEvents.push({ s: s0 + 110, lane: 2, kind: "lure", phase: 0 });
      q.obstacles.push({ s: s0 + 140, lane: 0, kind: "blob", phase: 0 });
      q.bossEvents.push({ s: s0 + 170, lane: 1, kind: "lure", phase: 0 });
   });
   // phase 2: the saucer drones: jump into its glowing underside from their lane
   phase(1, (q) => {
      q.bossEvents.push({ s: s0 + 45, lane: 1, kind: "underside", phase: 1 });
      q.obstacles.push({ s: s0 + 80, lane: 1, kind: "rock", phase: 1 });
      q.bossEvents.push({ s: s0 + 115, lane: 2, kind: "underside", phase: 1 });
      q.bossEvents.push({ s: s0 + 175, lane: 0, kind: "underside", phase: 1 });
   });
   // phase 3: constant scan as you sprint cover to cover; the last jump crashes the meteor into it
   phase(2, (q) => {
      q.s = s0;
      q.scan(4, 1, "crystal");
      q.scan(6, 0, "rock");
      q.bossEvents.push({ s: q.s + 12, lane: 0, kind: "crash", phase: 2 });
   });
   b.phase = -1;
   b.s = s0 + lap;
   b.orbRow(1, 8, 3);
   return { s0, s1: s0 + lap };
}

export function buildCourse(level: LevelId, config: AlienLevel = LEVELS[level]): Course {
   const b = new Builder(config.speed);
   let loop: { s0: number; s1: number } | null = null;
   if (level === 1) level1(b);
   else if (level === 2) level2(b);
   else if (level === 3) level3(b);
   else if (level === 4) level4(b);
   else loop = level5(b);
   const finishS = b.s + 25;
   const orbs = b.orbs.slice().sort((x, y) => x.s - y.s);
   // the secrets in SECRETS order (the progress screen's)
   const secrets = SECRETS[level].map((spec) => {
      const d = b.secrets.find((x) => x.id === spec.id);
      if (!d) throw new Error(`alien-lane-escape: level ${level} has no ${spec.id} secret`);
      return d;
   });
   return {
      level,
      config,
      covers: b.covers,
      scans: b.scans,
      obstacles: b.obstacles.sort((x, y) => x.s - y.s),
      orbs,
      mainOrbs: orbs.filter((o) => o.bonus === null).length,
      goo: b.goo,
      meteors: b.meteors,
      plants: b.plants,
      mesas: b.mesas,
      caves: b.caves,
      abduction: b.abduction,
      secrets,
      bossEvents: b.bossEvents.sort((x, y) => x.s - y.s),
      beats: b.beats.sort((x, y) => x.s - y.s),
      finishS,
      loop,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}
