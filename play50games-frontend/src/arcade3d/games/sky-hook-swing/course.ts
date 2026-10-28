// The docks: islands, grapple points, orbs, walls and the level 5 galleon. Pure data. Anchor motion
// (airships, windmill blades, falling rings, drones) is a function of the rules clock, so a replay
// with the same inputs swings the same way.
import type { LevelId } from "@/arcade3d/types";

export type IslandKind = "start" | "rest" | "net" | "pad" | "deck";
export type AnchorKind = "ring" | "post" | "blade" | "ship" | "cracked" | "drone" | "fall" | "heavy";
export type BlockKind = "wall" | "crate" | "ghost";
export type OrbKind = "main" | "bonus" | "magnet";

export interface Island {
   x: number;
   y: number;
   z: number;
   /** half the deck's side: decks are squares along the axes (the sky platform's slab) */
   r: number;
   kind: IslandKind;
   /** a checkpoint. Landing anywhere else between checkpoints breaks the sky chain. */
   cp: boolean;
}

export interface Anchor {
   x: number;
   y: number;
   z: number;
   kind: AnchorKind;
   /** ship: metres of sway along x. 0 = still. */
   amp: number;
   period: number;
   phase: number;
   /** blade / drone: orbit radius around the hub (m). */
   radius: number;
   hubX: number;
   hubY: number;
   hubZ: number;
   /** cracked rings snap the rope after this many ms hooked. 0 = solid. */
   crackMs: number;
   /** fall rings: m/s downward once the galleon breaks up. */
   fallSpeed: number;
   /** hull rings the drones cut at the start of phase 2. */
   cut: boolean;
}

export interface Orb {
   x: number;
   y: number;
   z: number;
   kind: OrbKind;
}

export interface Block {
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   z0: number;
   z1: number;
   kind: BlockKind;
}

export interface Hazard {
   x: number;
   y: number;
   z: number;
   r: number;
   /** spark: cable lines. smoke: cannon smoke. */
   kind: "spark" | "smoke";
}

export interface Box {
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   z0: number;
   z1: number;
}

export interface Spot {
   x: number;
   y: number;
   z: number;
   r: number;
}

export interface Course {
   level: LevelId;
   islands: Island[];
   anchors: Anchor[];
   orbs: Orb[];
   blocks: Block[];
   hazards: Hazard[];
   /** same order as progression.ts SECRETS[level] */
   secrets: Spot[];
   turrets: Spot[];
   mast: Spot | null;
   bell: Spot | null;
   /** inside a ghost hull the ghost panels let the hero out (Vexa phased in) */
   hulls: Box[];
   /** level 5: where the Gust Galleon's hull runs (visual only) */
   galleon: { x0: number; x1: number } | null;
   /** level 5: the checkpoint each boss phase moves the respawn up to (islands index per phase, -1 none) */
   phaseCp: number[];
   /** anchors in travel order (+x). The bot and the camera follow this. */
   route: number[];
   /** gust acceleration along +x (m/s^2). 0 = still air. */
   gust: number;
   gustPeriod: number;
   mainOrbs: number;
   boss: boolean;
   /** index into islands */
   finish: number;
   /** the least x a finish must reach, minus where the hero starts (m). The proof's distance. */
   span: number;
}

export interface Vec3 {
   x: number;
   y: number;
   z: number;
}

const ZERO: Anchor = {
   x: 0, y: 0, z: 0, kind: "ring", amp: 0, period: 1, phase: 0, radius: 0,
   hubX: 0, hubY: 0, hubZ: 0, crackMs: 0, fallSpeed: 0, cut: false,
};

function A(p: Partial<Anchor> & Pick<Anchor, "x" | "y" | "z" | "kind">): Anchor {
   return { ...ZERO, hubX: p.x, hubY: p.y, hubZ: p.z, ...p };
}

function I(x: number, y: number, z: number, r: number, kind: IslandKind, cp = false): Island {
   return { x, y, z, r, kind, cp: cp || kind === "start" || kind === "pad" };
}

function O(x: number, y: number, z: number, kind: OrbKind = "main"): Orb {
   return { x, y, z, kind };
}

/** How far a falling hull ring sinks before it hangs (m). */
export const FALL_DROP = 4;

/** Where an anchor is at rules time `ms`. `fallMs` is when the galleon started falling (-1 before). */
export function anchorAt(a: Anchor, ms: number, fallMs: number, out: Vec3): Vec3 {
   out.x = a.x;
   out.y = a.y;
   out.z = a.z;
   const t = ms / 1000;
   if (a.kind === "ship" && a.amp !== 0) {
      out.x = a.x + Math.sin((Math.PI * 2 * t) / a.period + a.phase) * a.amp;
   } else if ((a.kind === "blade" || a.kind === "drone") && a.radius > 0) {
      const ang = a.phase + (Math.PI * 2 * t) / a.period;
      out.x = a.hubX + Math.cos(ang) * a.radius;
      out.y = a.hubY + Math.sin(ang) * a.radius;
      out.z = a.hubZ;
   } else if (a.kind === "fall" && fallMs >= 0 && a.fallSpeed > 0) {
      // the hull sinks a few metres, then hangs in the storm (never out of reach: no soft-lock)
      out.y = a.y - Math.min(FALL_DROP, (a.fallSpeed * Math.max(0, ms - fallMs)) / 1000);
   }
   return out;
}

/** Gust acceleration along +x (m/s^2) at rules time. */
export function gustAt(course: Course, ms: number): number {
   if (course.gust === 0) return 0;
   return course.gust * Math.sin((Math.PI * 2 * ms) / 1000 / course.gustPeriod);
}

function finishSpan(islands: Island[], finish: number): number {
   const a = islands[0];
   const b = islands[finish];
   return Math.max(1, b.x - b.r - a.x);
}

function pack(level: LevelId, islands: Island[], anchors: Anchor[], orbs: Orb[], extras: Partial<Course> & Pick<Course, "route" | "finish">): Course {
   const mainOrbs = orbs.reduce((n, o) => n + (o.kind === "main" ? 1 : 0), 0);
   return {
      level,
      islands,
      anchors,
      orbs,
      blocks: extras.blocks ?? [],
      hazards: extras.hazards ?? [],
      secrets: extras.secrets ?? [],
      turrets: extras.turrets ?? [],
      mast: extras.mast ?? null,
      bell: extras.bell ?? null,
      hulls: extras.hulls ?? [],
      galleon: extras.galleon ?? null,
      phaseCp: extras.phaseCp ?? [],
      route: extras.route,
      gust: extras.gust ?? 0,
      gustPeriod: extras.gustPeriod ?? 3,
      mainOrbs,
      boss: level === 5,
      finish: extras.finish,
      span: finishSpan(islands, extras.finish),
   };
}

// ---------- the builder ----------
// Every level is a chain of beats laid along +x from one rest deck to the next. Each beat keeps the
// spacing the swing was tuned on (a rest deck, a ring 9 m on and 9.5 m up, the next deck 23-28 m on),
// so the rhythm is the same and only the twist changes. Hero pockets sit off the line (z != 0).

class Build {
   islands: Island[] = [];
   anchors: Anchor[] = [];
   orbs: Orb[] = [];
   blocks: Block[] = [];
   hazards: Hazard[] = [];
   secrets: Spot[] = [];
   hulls: Box[] = [];
   route: number[] = [];
   /** the rest deck the next beat starts from */
   x = 0;
   y = 2;

   island(x: number, y: number, z: number, r: number, kind: IslandKind, cp = false): number {
      this.islands.push(I(x, y, z, r, kind, cp));
      return this.islands.length - 1;
   }

   ring(p: Partial<Anchor> & Pick<Anchor, "x" | "y" | "z" | "kind">, onRoute = true): number {
      this.anchors.push(A(p));
      const i = this.anchors.length - 1;
      if (onRoute) this.route.push(i);
      return i;
   }

   orb(x: number, y: number, z: number, kind: OrbKind = "main"): void {
      this.orbs.push(O(x, y, z, kind));
   }

   /** the next rest deck, `gap` m on, a main orb over it */
   rest(gap: number, r = 5, dy = 0): number {
      this.x += gap;
      this.y = this.base + dy;
      const i = this.island(this.x, this.y, 0, r, "rest", true);
      this.orb(this.x, this.y + 1.2, 0);
      return i;
   }

   base = 2;

   /** one ring between two decks: hook, swing, release */
   gap(kind: AnchorKind = "ring", extra: Partial<Anchor> = {}, gap = 23, r = 5): void {
      const x = this.x;
      this.ring({ x: x + 9, y: this.y + 9.5, z: 0, kind, ...extra });
      this.orb(x + 9.5, this.y + 3.4, 0);
      this.rest(gap, r);
   }

   /** a tall wall in the gap: reel in over it */
   wall(): void {
      const x = this.x;
      this.ring({ x: x + 9, y: this.y + 10.2, z: 0, kind: "post" });
      this.blocks.push({ x0: x + 16, x1: x + 19.2, y0: this.y - 2, y1: this.y + 5.4, z0: -2.4, z1: 2.4, kind: "wall" });
      this.orb(x + 17.6, this.y + 7.1, 0);
      this.rest(26, 4.4);
   }

   /** three rings in a row, no deck between: only a chain of releases crosses */
   chain3(lastKind: AnchorKind = "post"): void {
      const x = this.x;
      this.ring({ x: x + 8, y: this.y + 9, z: 0, kind: "ring" });
      this.ring({ x: x + 16, y: this.y + 9, z: 0, kind: "ring" });
      this.ring({ x: x + 23, y: this.y + 8.6, z: 0, kind: lastKind });
      this.orb(x + 12, this.y + 4.4, 0);
      this.orb(x + 19.5, this.y + 4.6, 0);
      this.rest(28, 4.4);
   }

   // ----- hero pockets (bonus orbs; the all-orbs star counts the main orbs only) -----

   /** Riko: a cracked crate stack on a side deck with orbs packed inside. Only a dash breaks in. */
   crates(at: number, side: number): void {
      const x = at;
      const z = side * 7.6;
      this.island(x, this.y + 0.2, z, 2.6, "deck");
      const top = this.y + 0.2;
      this.blocks.push({ x0: x - 1.4, x1: x + 1.4, y0: top, y1: top + 2.8, z0: z - 1.4, z1: z + 1.4, kind: "crate" });
      this.orb(x, top + 0.8, z, "bonus");
      this.orb(x, top + 2.0, z, "bonus");
   }

   /** Kiro: a spark line along an airship cable, orbs strung on the cable */
   sparks(at: number, side: number, kind: Hazard["kind"] = "spark"): void {
      const z = side * 5.2;
      for (let k = 0; k < 3; k++) {
         const x = at + k * 2.2;
         this.hazards.push({ x, y: this.y + 4.2, z, r: 1.25, kind });
         this.orb(x, this.y + 4.2, z, "bonus");
      }
   }

   /** Zuno: an orb string in the clouds under a swing's lowest point, past any hand */
   magnets(at: number): void {
      for (let k = 0; k < 4; k++) this.orb(at - 1.8 + k * 1.2, this.y - 4.4, 0, "magnet");
   }

   /** Nami: a high ledge beside a rest deck, out of one jump's reach, an orb loop over it */
   ledge(deck: number, side: number): void {
      const d = this.islands[deck];
      const z = side * (d.r + 1.4);
      const y = d.y + 3.3;
      this.island(d.x, y, z, 2.1, "deck");
      for (let k = 0; k < 5; k++) {
         const a = (k / 5) * Math.PI * 2;
         this.orb(d.x + Math.cos(a) * 1.1, y + 1.4 + Math.sin(a) * 0.9, z, "bonus");
      }
   }

   /** Vexa: a ghost hull section round a hidden inner deck (the sticker and orbs inside) */
   hull(at: number, side: number, sticker: boolean): void {
      const x = at;
      const z = side * 8.4;
      const y = this.y + 0.6;
      const w = 2.8;
      const h = 3.2;
      const t = 0.3;
      this.island(x, y, z, 2.3, "deck");
      const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
         this.blocks.push({ x0, x1, y0, y1, z0, z1, kind: "ghost" });
      box(x - w - t, x - w, y - 0.6, y + h, z - w - t, z + w + t);
      box(x + w, x + w + t, y - 0.6, y + h, z - w - t, z + w + t);
      box(x - w, x + w, y - 0.6, y + h, z - w - t, z - w);
      box(x - w, x + w, y - 0.6, y + h, z + w, z + w + t);
      box(x - w - t, x + w + t, y + h, y + h + t, z - w - t, z + w + t);
      this.hulls.push({ x0: x - w, x1: x + w, y0: y - 1, y1: y + h, z0: z - w, z1: z + w });
      this.orb(x - 0.9, y + 0.9, z, "bonus");
      this.orb(x + 0.9, y + 0.9, z, "bonus");
      if (sticker) this.secrets.push({ x, y: y + 1.1, z, r: 1.2 });
   }

   /** a co-op heavy ring beside the line (it swings for one hero; in co-op it needs two ropes) */
   heavy(at: number, side: number): void {
      this.ring({ x: at, y: this.y + 10.4, z: side * 3.4, kind: "heavy" }, false);
   }

   /** the card's compass shard: by a ring beyond the normal hook range (a peak release plus a reel-in) */
   compass(at: number, side: number): void {
      this.secrets.push({ x: at, y: this.y + 14.2, z: side * 9, r: 1.3 });
      this.ring({ x: at, y: this.y + 16.4, z: side * 9, kind: "ring" }, false);
   }

   pack(level: LevelId, extras: Partial<Course> & Pick<Course, "finish">): Course {
      return pack(level, this.islands, this.anchors, this.orbs, {
         blocks: this.blocks,
         hazards: this.hazards,
         secrets: this.secrets,
         hulls: this.hulls,
         route: this.route,
         ...extras,
      });
   }
}

function finishOnPad(b: Build): number {
   const i = b.islands.length - 1;
   b.islands[i].kind = "pad";
   return i;
}

/** Level 1: one ring over a net, a tall wall you reel over, three rings to a deck, then all three again to the pad. */
function level1(): Course {
   const b = new Build();
   b.island(0, 2, 0, 4.2, "start");
   b.orb(3.2, 3.2, 0);
   b.island(13, -1.6, 0, 9, "net");
   b.gap("ring", {}, 24, 4.4);
   b.ledge(b.islands.length - 1, 1);
   b.wall();
   b.hull(b.x - 2, -1, true);
   b.heavy(b.x + 9, 1);
   b.chain3();
   b.magnets(b.x - 20);
   b.gap();
   b.crates(b.x - 12, 1);
   b.compass(b.x - 8, -1);
   b.wall();
   b.sparks(b.x - 14, 1);
   b.chain3();
   return b.pack(1, { finish: finishOnPad(b) });
}

/** Level 2: chaining. Rings spaced so only peak releases connect; swing islands are the rest stops. */
function level2(): Course {
   const b = new Build();
   b.island(0, 2, 0, 5, "start");
   b.gap();
   b.ledge(b.islands.length - 1, -1);
   b.chain3("ring");
   b.compass(b.x - 14, -1);
   b.gap("post");
   b.crates(b.x - 10, 1);
   b.chain3();
   b.hull(b.x - 3, 1, true);
   b.heavy(b.x + 9, 1);
   b.magnets(b.x - 12);
   b.gap();
   b.sparks(b.x - 15, -1);
   b.chain3("ring");
   b.gap("post");
   b.chain3();
   b.gap();
   b.chain3("ring");
   b.gap("post", {}, 26, 6.5);
   return b.pack(2, { finish: finishOnPad(b) });
}

/** a windmill blade ring: it turns round the hub, so the hook point rises and falls */
function blade(b: Build, phase: number): void {
   const x = b.x;
   b.ring({ x: 0, y: 0, z: 0, kind: "blade", radius: 2.6, period: 9, phase, hubX: x + 10, hubY: b.y + 10.2, hubZ: 0 });
   b.orb(x + 10, b.y + 3.6, 0);
   b.rest(26, 5.4);
}

/** Level 3: moving anchors. Rings hung under swaying airships and on spinning windmill blades. */
function level3(): Course {
   const b = new Build();
   b.island(0, 2, 0, 5, "start");
   b.gap();
   b.gap("ship", { amp: 2.4, period: 6, phase: 0.3 }, 24, 5.2);
   b.ledge(b.islands.length - 1, 1);
   blade(b, 1.2);
   b.hull(b.x - 2, -1, true);
   b.heavy(b.x + 9, 1);
   b.gap("ship", { amp: 3, period: 7, phase: 2.1 }, 24, 5.2);
   b.magnets(b.x - 15);
   b.crates(b.x - 9, 1);
   blade(b, 3.4);
   b.sparks(b.x - 15, 1);
   const loopX = b.x + 9;
   b.gap("ship", { amp: 2.6, period: 5.5, phase: 4.2 }, 24, 5.2);
   // the loop shard: just past the far end of the last airship's sway, reached only as it swings back
   b.secrets.splice(0, 0, { x: loopX + 4.4, y: b.y + 6.4, z: -2.6, r: 1.3 });
   b.chain3();
   return b.pack(3, { finish: finishOnPad(b) });
}

/** Level 4: long gaps. A crosswind, longer arcs, and cracked rings that break 3 s after the hook. */
function level4(): Course {
   const b = new Build();
   b.island(0, 2, 0, 5.2, "start");
   b.gap("cracked", { crackMs: 3000 }, 26, 5.6);
   b.ledge(b.islands.length - 1, -1);
   b.gap("cracked", { crackMs: 3000 }, 28, 5.6);
   b.sparks(b.x - 18, 1);
   b.magnets(b.x - 19);
   b.wall();
   b.hull(b.x - 2, 1, false);
   b.heavy(b.x + 9, 1);
   b.gap("cracked", { crackMs: 3000 }, 28, 5.6);
   b.compass(b.x - 16, -1);
   b.crates(b.x - 9, -1);
   b.chain3("cracked");
   b.gap("cracked", { crackMs: 3000 }, 28, 5.6);
   b.sparks(b.x - 17, -1);
   b.wall();
   b.gap("cracked", { crackMs: 3000 }, 28, 5.6);
   b.gap("cracked", { crackMs: 3000 }, 28, 5.6);
   // the Kiro shard sits inside the last spark line's middle
   const mid = b.hazards[b.hazards.length - 2];
   b.secrets.push({ x: mid.x, y: mid.y + 0.3, z: mid.z, r: 1.1 });
   b.gap("post", {}, 28, 6);
   for (const a of b.anchors) if (a.kind === "cracked" && a.crackMs === 0) a.crackMs = 3000;
   return b.pack(4, { finish: finishOnPad(b), gust: 3.5, gustPeriod: 4.2 });
}

/** Level 5: an approach, then the Gust Galleon: three turrets, a drone into the mast, the falling rings and the bell. */
function level5(): Course {
   const b = new Build();
   b.base = 2.4;
   b.y = 2.4;
   b.island(0, 2.4, 0, 6, "start");
   b.gap();
   b.ledge(b.islands.length - 1, 1);
   b.chain3("ring");
   b.crates(b.x - 12, -1);
   // the galleon starts here: three hull rings (the drones cut them in phase 2), a turret past each
   const g0 = b.x;
   const turrets: Spot[] = [];
   for (let k = 0; k < 3; k++) {
      const x = b.x;
      b.ring({ x: x + 9, y: b.y + 9.2, z: 0, kind: "ring", cut: true });
      turrets.push({ x: x + 16, y: b.y + 4.6, z: 0, r: 5.2 });
      b.orb(x + 9.5, b.y + 3.6, 0);
      b.rest(23, 5.2);
   }
   b.sparks(g0 + 30, 1, "smoke");
   b.hull(g0 + 44, -1, true);
   b.magnets(g0 + 9);
   const x = b.x;
   const droneRest = b.islands.length - 1;
   b.ring({ x: 0, y: 0, z: 0, kind: "drone", radius: 3.4, period: 5.5, phase: 0.4, hubX: x + 8, hubY: b.y + 8.6, hubZ: 0 });
   const mast = { x: x + 8, y: b.y + 4.1, z: 0, r: 5.5 };
   // the mast stands on the galleon's foredeck (a checkpoint: the escape starts from here)
   const foredeck = b.island(x + 9, b.y, 0, 4, "rest", true);
   b.ring({ x: x + 20, y: b.y + 10.6, z: 0, kind: "fall", fallSpeed: 0.55 });
   b.ring({ x: x + 34, y: b.y + 11.8, z: 0, kind: "fall", fallSpeed: 0.55 });
   b.orb(x + 22, b.y + 2.6, 0);
   b.orb(x + 36, b.y + 2.8, 0);
   b.x = x + 44;
   b.y = 3.2;
   const pad = b.island(b.x, b.y, 0, 5, "pad");
   // the compass up by the crow's nest (first), the loop shard behind the drone's circle (last)
   b.secrets.splice(0, 0, { x: b.x - 6, y: b.y + 11, z: -6, r: 1.3 });
   b.ring({ x: b.x - 6, y: b.y + 13.4, z: -6, kind: "ring" }, false);
   b.secrets.push({ x: x + 12, y: b.y + 7.4, z: 5.2, r: 1.2 });
   return b.pack(5, {
      finish: pad,
      turrets,
      mast,
      bell: { x: b.x, y: b.y + 2.2, z: 0, r: 3.2 },
      galleon: { x0: g0 - 2, x1: b.x + 6 },
      // the drones cut the hull rings behind: phase 2 respawns by the mast, phase 3 on the foredeck
      phaseCp: [-1, droneRest, foredeck],
   });
}

const BUILDERS: Record<LevelId, () => Course> = {
   1: level1,
   2: level2,
   3: level3,
   4: level4,
   5: level5,
};

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}
