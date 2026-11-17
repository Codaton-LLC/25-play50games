// The candy road: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a straight three-lane road (s = metres from the start, running towards -z). Its
// rhythm is a chain of BEATS: an obstacle in a lane that needs one size (Big smashes jelly cubes,
// chocolate walls and frozen blocks; Small slips under cookie, candy-cane and frozen arches). Before a
// Big beat its lane carries the candy coins that grow you there (3 per size); before a Small beat it
// carries none (sugar-burn roll down). On levels 1-2 another lane at each beat is always free, so a
// beat never forces a guess. Around the beats: decoy coins, orbs as rewards, and the hero routes
// (Riko's bonus lane behind a gingerbread wall, Nami's candy-cane rail, Kiro's popping fields, Zuno's
// frosting trails, Vexa's hidden fourth lane). Level 5's palace section repeats until King Bonbon is
// free (his drum, throne and crown are beats too). README "Levels" lists each layout.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type CandyLevel } from "./levels";

/** the lane spacing (m): lanes 0 1 2 sit at x = -2.6, 0, 2.6; the side lanes -1 and 3 at -5.2 and 5.2 */
export const LANE_W = 2.6;
/** sizes: 0 Small, 1 Normal, 2 Big */
export type Size = 0 | 1 | 2;
export const SMALL: Size = 0;
export const NORMAL: Size = 1;
export const BIG: Size = 2;
/** candy coins eaten per size step */
export const COINS_PER_SIZE = 3;
/** the candy-cane rail runs this high over the middle lane (Nami) */
export const RAIL_Y = 2.4;
/** the orbs float this high */
export const ORB_Y = 1.0;

export function laneX(lane: number): number {
   return (lane - 1) * LANE_W;
}

export type ObstacleKind = "jelly" | "choco" | "frozenBlock" | "cookieArch" | "caneArch" | "frozenArch" | "wheel" | "drum" | "throne" | "crown";

/** The size an obstacle needs: Big smashes, Small slips under. */
export function needOf(kind: ObstacleKind): Size {
   return kind === "cookieArch" || kind === "caneArch" || kind === "frozenArch" || kind === "wheel" ? SMALL : BIG;
}

/** The boss's hit targets (a Big touch charges a hit for his next open window). */
export function isBossTarget(kind: ObstacleKind): boolean {
   return kind === "drum" || kind === "throne" || kind === "crown";
}

export interface Obstacle {
   s: number;
   lane: number;
   kind: ObstacleKind;
   /** level 5: only there in this boss phase (-1 always) */
   phase: number;
}

export interface Coin {
   s: number;
   lane: number;
   phase: number;
}

export interface OrbDef {
   s: number;
   lane: number;
   h: number;
   /** the hero whose route carries it (a bonus orb), null on the main road */
   bonus: HeroId | "donut" | null;
   /** inside a frosting wall: only Zuno's magnet pulls it out */
   magnet: boolean;
}

/** A side lane (the bonus lane -1 behind Riko's gingerbread wall, the hidden fourth lane 3 behind Vexa's ghost wall). */
export interface SideLane {
   lane: -1 | 3;
   s0: number;
   s1: number;
   gate: "cracked" | "ghost";
}

export interface Span {
   s0: number;
   s1: number;
}

export interface LaneSpan extends Span {
   lane: number;
}

/** The bot's plan: where each beat is, its lane and the size it needs (the course's own answer key). */
export interface Beat {
   s: number;
   lane: number;
   need: Size;
   phase: number;
}

export interface Course {
   level: LevelId;
   config: CandyLevel;
   obstacles: Obstacle[];
   coins: Coin[];
   orbs: OrbDef[];
   mainOrbs: number;
   sideLanes: SideLane[];
   /** level 2: chocolate-bar bridges (Big cracks them: a size miss) */
   bridges: LaneSpan[];
   /** level 2: donut platforms (Small bounces high over the next stretch) */
   donuts: { s: number; lane: number }[];
   /** level 3: frosted ice (a lane change drifts: slower) */
   ice: Span[];
   /** level 4: gummy monsters (a bite: down a size; a jump onto the head: up a size) */
   gummies: { s: number; lane: number }[];
   /** popping-candy fields (knock you down a size unless Kiro's shield is up); `kiro`: the one with his orbs */
   fields: (LaneSpan & { kiro: boolean })[];
   /** Nami's candy-cane rail over the middle lane */
   rails: Span[];
   /** Zuno's frosting walls (outside lane 0) with coin trails frozen in them */
   trails: Span[];
   /** aligned with progression SECRETS[level] */
   secrets: { s: number; lane: number; h: number }[];
   /** level 3: the secret exit's arch (a Small pass in this lane at this s) */
   exitArch: { s: number; lane: number } | null;
   beats: Beat[];
   finishS: number;
   /** level 5: the palace section that repeats until the king is free */
   loop: Span | null;
}

// ---------- the builder ----------

class Builder {
   s = 0;
   size: Size = SMALL;
   lane = 1;
   phase = -1;
   obstacles: Obstacle[] = [];
   coins: Coin[] = [];
   orbs: OrbDef[] = [];
   sideLanes: SideLane[] = [];
   bridges: LaneSpan[] = [];
   donuts: { s: number; lane: number }[] = [];
   ice: Span[] = [];
   gummies: { s: number; lane: number }[] = [];
   fields: (LaneSpan & { kiro: boolean })[] = [];
   rails: Span[] = [];
   trails: Span[] = [];
   secrets: { s: number; lane: number; h: number }[] = [];
   exitArch: { s: number; lane: number } | null = null;
   beats: Beat[] = [];
   free = true;

   constructor(free: boolean) {
      this.free = free;
   }

   orb(s: number, lane: number, h = ORB_Y, bonus: OrbDef["bonus"] = null, magnet = false): void {
      this.orbs.push({ s, lane, h, bonus, magnet });
   }

   /**
    * A beat `gap` m on: `kind` in `lane`. The coins that grow you to Big sit in that lane before it (none
    * before a Small beat: you burn down). The other lanes: on levels 1-2 one stays free and one holds
    * the opposite kind; later both hold obstacles (`others`). Two orbs reward the right size after it.
    */
   beat(gap: number, lane: number, kind: ObstacleKind, others: (ObstacleKind | null)[] = []): void {
      this.s += gap;
      const s = this.s;
      const need = needOf(kind);
      if (need === BIG && this.size < BIG) {
         const n = (BIG - this.size) * COINS_PER_SIZE;
         for (let i = 0; i < n; i++) this.coins.push({ s: s - 8 - (n - 1 - i) * 2.2, lane, phase: this.phase });
      }
      this.obstacles.push({ s, lane, kind, phase: this.phase });
      this.beats.push({ s, lane, need, phase: this.phase });
      const rest = [0, 1, 2].filter((l) => l !== lane);
      rest.forEach((l, i) => {
         const k = others[i];
         if (k) this.obstacles.push({ s, lane: l, kind: k, phase: this.phase });
      });
      // (the palace's beats repeat each lap: no orbs there)
      if (this.phase < 0) {
         this.orb(s + 4, lane);
         this.orb(s + 7, lane);
      }
      this.size = need;
      this.lane = lane;
   }

   /** Decoy coins in a lane after the last beat (they grow you if you take them). */
   decoy(lane: number, from: number, n = 3): void {
      for (let i = 0; i < n; i++) this.coins.push({ s: this.s + from + i * 2.4, lane, phase: this.phase });
   }

   /** A row of orbs along a lane after the last beat. */
   orbRow(lane: number, from: number, n: number, spacing = 2.4, bonus: OrbDef["bonus"] = null, h = ORB_Y): void {
      for (let i = 0; i < n; i++) this.orb(this.s + from + i * spacing, lane, h, bonus);
   }

   /** Riko's bonus lane (-1) behind a gingerbread wall from `from` m on, `len` long, with its orbs. */
   rikoLane(from: number, len: number): void {
      const s0 = this.s + from;
      this.sideLanes.push({ lane: -1, s0, s1: s0 + len, gate: "cracked" });
      for (let i = 0; i < 3; i++) this.orb(s0 + 6 + i * 4, -1, ORB_Y, "riko");
   }

   /** Vexa's hidden fourth lane (3) behind a ghost wall, its orbs and (optionally) the shard. */
   vexaLane(from: number, len: number, shard: boolean): void {
      const s0 = this.s + from;
      this.sideLanes.push({ lane: 3, s0, s1: s0 + len, gate: "ghost" });
      for (let i = 0; i < 2; i++) this.orb(s0 + 5 + i * 4, 3, ORB_Y, "vexa");
      if (shard) this.secrets.push({ s: s0 + len - 6, lane: 3, h: ORB_Y });
   }

   /** Nami's candy-cane rail over the middle lane, its orbs. */
   rail(from: number, len: number): void {
      const s0 = this.s + from;
      this.rails.push({ s0, s1: s0 + len });
      for (let i = 0; i < 3; i++) this.orb(s0 + 4 + i * 4, 1, RAIL_Y + ORB_Y, "nami");
   }

   /** Zuno's frosting wall outside lane 0, three coins frozen in it (his magnet pulls them). */
   trail(from: number, len: number): void {
      const s0 = this.s + from;
      this.trails.push({ s0, s1: s0 + len });
      for (let i = 0; i < 3; i++) this.orbs.push({ s: s0 + 3 + i * 3, lane: -1, h: ORB_Y, bonus: "zuno", magnet: true });
   }

   /** A popping-candy field in a lane (Kiro's: with his orbs in it). */
   field(lane: number, from: number, len: number, kiro: boolean): void {
      const s0 = this.s + from;
      this.fields.push({ s0, s1: s0 + len, lane, kiro });
      if (kiro) for (let i = 0; i < 2; i++) this.orb(s0 + 4 + i * 5, lane, ORB_Y, "kiro");
   }
}

// ---------- the levels ----------

function level1(b: Builder): void {
   // Candy Lane: (1) eat 3+3 coins, grow, smash a jelly cube; (2) roll to shrink, slip under a cookie
   // arch; (3) both in a row (the sign 3 s ahead)
   b.s = 20;
   b.orbRow(1, 0, 3);
   b.beat(40, 1, "jelly", ["cookieArch", null]);
   b.decoy(2, 12);
   b.beat(40, 0, "cookieArch", [null, "jelly"]);
   b.orbRow(0, 12, 2);
   b.trail(10, 16);
   b.beat(38, 2, "jelly", [null, "cookieArch"]);
   b.vexaLane(8, 30, true);
   b.beat(40, 2, "caneArch", [null, "jelly"]);
   b.decoy(0, 12);
   b.beat(36, 1, "choco", ["caneArch", null]);
   b.rail(8, 22);
   b.beat(40, 1, "cookieArch", [null, "choco"]);
   b.rikoLane(10, 26);
   b.beat(40, 0, "jelly", [null, "cookieArch"]);
   b.field(2, 10, 18, true);
   b.beat(40, 0, "cookieArch", ["jelly", null]);
   b.beat(34, 2, "jelly", [null, "caneArch"]);
   b.beat(36, 1, "caneArch", ["jelly", null]);
   b.orbRow(1, 12, 3);
}

function level2(b: Builder): void {
   // Cookie Road: weight. Chocolate-bar bridges crack under Big; donuts bounce a Small hero over a stretch
   b.s = 20;
   b.orbRow(1, 0, 3);
   b.beat(40, 0, "jelly", [null, "cookieArch"]);
   b.bridges.push({ lane: 2, s0: b.s + 8, s1: b.s + 30 });
   b.beat(40, 0, "cookieArch", [null, "jelly"]);
   b.donuts.push({ lane: 0, s: b.s + 10 });
   b.orbRow(0, 14, 3, 2.4, "donut", 3.0);
   b.beat(40, 1, "jelly", ["cookieArch", null]);
   b.vexaLane(8, 30, true);
   b.beat(40, 2, "choco", [null, "caneArch"]);
   b.trail(8, 16);
   b.beat(36, 2, "caneArch", ["jelly", null]);
   b.bridges.push({ lane: 1, s0: b.s + 8, s1: b.s + 30 });
   b.beat(40, 2, "jelly", [null, "cookieArch"]);
   b.rikoLane(10, 26);
   b.beat(40, 1, "cookieArch", [null, "choco"]);
   b.rail(8, 22);
   b.beat(40, 1, "choco", ["caneArch", null]);
   b.field(0, 10, 18, true);
   b.beat(40, 2, "caneArch", [null, "jelly"]);
   b.donuts.push({ lane: 2, s: b.s + 10 });
   b.orbRow(2, 14, 3, 2.4, "donut", 3.0);
   b.beat(40, 0, "jelly", ["cookieArch", null]);
   b.beat(36, 0, "cookieArch", [null, "jelly"]);
   b.orbRow(0, 12, 3);
   // the sugar giant is a feat, not a place (rules.ts: Big for 20 s without a bridge broken)
   b.secrets.push({ s: -1, lane: -9, h: 0 });
}

function level3(b: Builder): void {
   // Sorbet Slopes: frosted ice (a lane change drifts), frozen blocks need Big and frozen arches Small, close together
   b.s = 20;
   b.orbRow(1, 0, 3);
   b.ice.push({ s0: 40, s1: 200 });
   b.beat(40, 1, "frozenBlock", ["frozenArch", null]);
   b.beat(36, 0, "frozenArch", [null, "frozenBlock"]);
   b.trail(8, 16);
   b.beat(36, 0, "frozenBlock", ["frozenArch", "frozenArch"]);
   b.vexaLane(8, 30, true);
   b.beat(36, 2, "frozenArch", ["frozenBlock", null]);
   b.rail(8, 22);
   b.beat(36, 1, "frozenBlock", ["frozenArch", "frozenArch"]);
   b.ice.push({ s0: b.s + 4, s1: b.s + 140 });
   b.rikoLane(10, 24);
   b.beat(36, 1, "frozenArch", ["frozenBlock", "frozenBlock"]);
   b.field(2, 8, 18, true);
   b.beat(36, 0, "frozenBlock", ["frozenArch", "frozenArch"]);
   b.beat(34, 2, "frozenArch", ["frozenBlock", "frozenBlock"]);
   b.beat(34, 2, "frozenBlock", ["frozenArch", "frozenArch"]);
   b.beat(34, 1, "frozenArch", ["frozenBlock", "frozenBlock"]);
   // the secret exit: a candy-cane arch at the end of lane 0, only a Small hero fits
   b.exitArch = { s: b.s + 18, lane: 0 };
   b.secrets.push({ s: b.s + 20, lane: 0, h: ORB_Y });
   b.orbRow(1, 10, 3);
}

function level4(b: Builder): void {
   // Gummy Grove: gummy monsters bite you down a size; a jump onto a gummy's head grows you a size
   b.s = 20;
   b.orbRow(1, 0, 3);
   b.beat(40, 1, "jelly", ["cookieArch", "cookieArch"]);
   b.gummies.push({ s: b.s + 14, lane: 0 });
   b.beat(38, 2, "cookieArch", ["jelly", "jelly"]);
   b.gummies.push({ s: b.s + 14, lane: 1 });
   b.trail(8, 16);
   b.beat(38, 0, "choco", ["caneArch", "caneArch"]);
   b.vexaLane(8, 30, true);
   b.beat(38, 0, "caneArch", ["jelly", "jelly"]);
   b.gummies.push({ s: b.s + 14, lane: 2 });
   b.rail(8, 22);
   b.beat(38, 1, "jelly", ["cookieArch", "cookieArch"]);
   b.rikoLane(10, 24);
   b.beat(38, 1, "cookieArch", ["choco", "choco"]);
   b.gummies.push({ s: b.s + 14, lane: 0 });
   b.field(2, 8, 18, true);
   b.beat(38, 1, "choco", ["caneArch", "caneArch"]);
   b.gummies.push({ s: b.s + 14, lane: 2 });
   b.beat(38, 0, "caneArch", ["jelly", "jelly"]);
   b.beat(36, 2, "jelly", ["cookieArch", "cookieArch"]);
   b.gummies.push({ s: b.s + 14, lane: 0 });
   b.beat(36, 2, "cookieArch", ["choco", "choco"]);
   b.orbRow(2, 12, 3);
}

/** Level 5: the run in, then the palace section (it repeats until the king is free), then the way out. */
function level5(b: Builder): { loop: Span } {
   b.s = 20;
   b.orbRow(1, 0, 3);
   b.beat(44, 1, "jelly", ["cookieArch", "cookieArch"]);
   b.trail(8, 16);
   b.beat(44, 0, "cookieArch", ["jelly", "jelly"]);
   b.vexaLane(8, 30, true);
   b.beat(44, 2, "choco", ["caneArch", "caneArch"]);
   b.rail(8, 22);
   b.beat(44, 2, "caneArch", ["jelly", "jelly"]);
   b.rikoLane(10, 24);
   b.beat(44, 1, "jelly", ["cookieArch", "cookieArch"]);
   b.field(2, 8, 18, true);
   b.beat(44, 1, "caneArch", ["choco", "choco"]);
   // the palace: each phase's beats, all in one lap (the lap starts and ends Small, in the middle lane)
   const s0 = b.s + 30;
   const lap = 180;
   const start = { s: b.s, size: b.size, lane: b.lane };
   const phase = (p: number, plan: (q: Builder) => void) => {
      b.s = s0;
      b.size = SMALL;
      b.lane = 1;
      b.phase = p;
      plan(b);
   };
   // phase 1, lollipop wheels down two lanes (go Small under a wheel's gap), the jelly drum (Big)
   phase(0, (q) => {
      q.beat(25, 0, "wheel", ["choco", "wheel"]);
      q.beat(40, 1, "drum", ["wheel", "wheel"]);
      q.beat(40, 2, "wheel", ["wheel", "choco"]);
      q.beat(40, 1, "drum", ["wheel", "wheel"]);
   });
   // phase 2, sour sprinkles: golden coins in one lane only, the throne (Big)
   phase(1, (q) => {
      q.beat(25, 1, "caneArch", ["jelly", "jelly"]);
      q.beat(40, 2, "throne", ["caneArch", "caneArch"]);
      q.beat(40, 1, "caneArch", ["jelly", "jelly"]);
      q.beat(40, 0, "throne", ["caneArch", "caneArch"]);
   });
   // phase 3, the palace collapses: arches alternate Small, Big, Small fast, then the crown (Big)
   phase(2, (q) => {
      q.beat(25, 1, "cookieArch", ["choco", "choco"]);
      q.beat(35, 1, "choco", ["cookieArch", "cookieArch"]);
      q.beat(35, 1, "cookieArch", ["choco", "choco"]);
      q.beat(40, 1, "crown", ["cookieArch", "cookieArch"]);
   });
   b.phase = -1;
   b.s = s0 + lap;
   b.size = SMALL;
   b.lane = 1;
   void start;
   b.orbRow(1, 12, 3);
   return { loop: { s0, s1: s0 + lap } };
}

export function buildCourse(level: LevelId, config: CandyLevel = LEVELS[level]): Course {
   const b = new Builder(level <= 2);
   let loop: Span | null = null;
   if (level === 1) level1(b);
   else if (level === 2) level2(b);
   else if (level === 3) level3(b);
   else if (level === 4) level4(b);
   else loop = level5(b).loop;
   const finishS = b.s + 30;
   b.obstacles.sort((x, y) => x.s - y.s);
   b.coins.sort((x, y) => x.s - y.s);
   const orbs = b.orbs.slice().sort((x, y) => x.s - y.s);
   return {
      level,
      config,
      obstacles: b.obstacles,
      coins: b.coins,
      orbs,
      mainOrbs: orbs.filter((o) => o.bonus === null).length,
      sideLanes: b.sideLanes,
      bridges: b.bridges,
      donuts: b.donuts,
      ice: b.ice,
      gummies: b.gummies,
      fields: b.fields,
      rails: b.rails,
      trails: b.trails,
      secrets: b.secrets,
      exitArch: b.exitArch,
      beats: b.beats.sort((x, y) => x.s - y.s),
      finishS,
      loop,
   };
}

const COURSES: Partial<Record<LevelId, Course>> = {};

export function courseFor(level: LevelId): Course {
   return (COURSES[level] ??= buildCourse(level));
}
