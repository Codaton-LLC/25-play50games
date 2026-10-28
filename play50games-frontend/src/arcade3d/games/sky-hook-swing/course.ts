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
      out.y = a.y - (a.fallSpeed * Math.max(0, ms - fallMs)) / 1000;
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
      route: extras.route,
      gust: extras.gust ?? 0,
      gustPeriod: extras.gustPeriod ?? 3,
      mainOrbs,
      boss: level === 5,
      finish: extras.finish,
      span: finishSpan(islands, extras.finish),
   };
}

/** Level 1: one ring over a net, a tall wall you reel over, three rings to the pad. */
function level1(): Course {
   const islands = [
      I(0, 2, 0, 4.2, "start"),
      I(13, -1.6, 0, 9, "net"),
      I(24, 1.7, 0, 4, "rest", true),
      I(50, 2, 0, 4, "rest", true),
      I(78, 2.4, 0, 4, "pad"),
      I(18, 2.4, 8.5, 2.2, "deck"),
      I(52, 2.2, -7, 2.4, "deck"),
   ];
   const anchors = [
      A({ x: 9, y: 11.5, z: 0, kind: "ring" }),
      A({ x: 33, y: 12.2, z: 0, kind: "post" }),
      A({ x: 58, y: 11, z: 0, kind: "ring" }),
      A({ x: 66, y: 11, z: 0, kind: "ring" }),
      A({ x: 73, y: 10.6, z: 0, kind: "post" }),
      A({ x: 14, y: 13.5, z: 7.2, kind: "ring" }),
      A({ x: 30, y: 9, z: 12, kind: "heavy" }),
   ];
   const orbs = [
      O(4, 3.1, 0),
      O(18, 3.4, 0),
      O(24, 2.9, 0),
      O(44, 6.5, 0),
      O(62, 4.2, 0),
      O(76, 3.6, 0),
      O(12, 1.3, 0, "magnet"),
      O(15, 1.3, 0, "magnet"),
      O(60, 8.2, 0, "bonus"),
      O(26, 3, 6.5, "bonus"),
   ];
   return pack(1, islands, anchors, orbs, {
      route: [0, 1, 2, 3, 4],
      finish: 4,
      blocks: [
         { x0: 40, x1: 43.2, y0: 0, y1: 7.4, z0: -2.4, z1: 2.4, kind: "wall" },
         { x0: 22, x1: 24.4, y0: 1.7, y1: 4.2, z0: 5.2, z1: 7.4, kind: "crate" },
         { x0: 48, x1: 50.2, y0: 0, y1: 4.6, z0: -4.2, z1: -2.2, kind: "ghost" },
      ],
      hazards: [{ x: 62, y: 3.4, z: 4.6, r: 1.35, kind: "spark" }],
      secrets: [
         { x: 18, y: 3.6, z: 8.5, r: 1.2 },
         { x: 52, y: 3.4, z: -7, r: 1.2 },
      ],
   });
}

/** Level 2: the same swing, chained. Each peak release lands on the next rest. */
function level2(): Course {
   const islands = [
      I(0, 2, 0, 5, "start"),
      I(23, 2, 0, 5, "rest", true),
      I(46, 2, 0, 5, "rest", true),
      I(62, 2.1, 0, 7, "rest", true),
      I(94, 2.2, 0, 6.5, "pad"),
      I(24, 2.3, -8, 2.2, "deck"),
   ];
   const anchors = [
      A({ x: 9, y: 11.5, z: 0, kind: "ring" }),
      A({ x: 32, y: 11.6, z: 0, kind: "post" }),
      A({ x: 55, y: 11.5, z: 0, kind: "ring" }),
      A({ x: 78, y: 11.4, z: 0, kind: "post" }),
      A({ x: 26, y: 14, z: -6.5, kind: "ring" }),
   ];
   const orbs = [
      O(8, 3.4, 0), O(23, 3.2, 0), O(46, 3.2, 0), O(62, 3.3, 0), O(88, 3.4, 0), O(36, 4.2, 0),
      O(40, 1.2, 0, "magnet"), O(62, 1.2, 0, "magnet"),
      O(50, 8.2, 0, "bonus"),
   ];
   return pack(2, islands, anchors, orbs, {
      route: [0, 1, 2, 3],
      finish: 4,
      blocks: [{ x0: 44, x1: 46.2, y0: 2, y1: 4.8, z0: -5.4, z1: -3.4, kind: "ghost" }],
      secrets: [
         { x: 20, y: 4.2, z: -6.2, r: 1.2 },
         { x: 24, y: 3.5, z: -8, r: 1.2 },
      ],
   });
}

/** Level 3: one swaying airship, then a windmill blade, then a static finish. */
function level3(): Course {
   const islands = [
      I(0, 2, 0, 5, "start"),
      I(23, 2, 0, 5, "rest", true),
      I(48, 2.1, 0, 5.2, "rest", true),
      I(74, 2.2, 0, 5.4, "rest", true),
      I(100, 2.4, 0, 5.5, "pad"),
      I(50, 2.4, 8, 2.2, "deck"),
   ];
   const anchors = [
      A({ x: 9, y: 11.5, z: 0, kind: "ring" }),
      A({ x: 32, y: 11.6, z: 0, kind: "post" }),
      A({ x: 56, y: 12, z: 0, kind: "ship", amp: 2.4, period: 6, phase: 0.3 }),
      A({ x: 0, y: 0, z: 0, kind: "blade", radius: 3.2, period: 8, phase: 1.2, hubX: 78, hubY: 12.2, hubZ: 0 }),
      A({ x: 94, y: 11.2, z: 0, kind: "post" }),
      A({ x: 48, y: 14.5, z: 6.2, kind: "ring" }),
   ];
   const orbs = [
      O(8, 3.4, 0), O(23, 3.2, 0), O(48, 3.4, 0), O(74, 3.5, 0), O(96, 3.4, 0), O(36, 4.2, 0),
      O(40, 1.3, 0, "magnet"),
      O(70, 8, 0, "bonus"),
   ];
   return pack(3, islands, anchors, orbs, {
      route: [0, 1, 2, 3, 4],
      finish: 4,
      blocks: [{ x0: 48, x1: 50.2, y0: 2, y1: 5, z0: 3.6, z1: 5.6, kind: "ghost" }],
      secrets: [
         { x: 50, y: 3.6, z: 8, r: 1.2 },
         { x: 49, y: 3.4, z: 5.2, r: 1.2 },
      ],
   });
}

/** Level 4: longer arcs, a crosswind, rings that snap if you hold them for 3 s. */
function level4(): Course {
   const islands = [
      I(0, 2, 0, 5.2, "start"),
      I(26, 2, 0, 5.6, "rest", true),
      I(54, 2.1, 0, 5.6, "rest", true),
      I(82, 2.2, 0, 5.6, "rest", true),
      I(110, 2.4, 0, 6, "pad"),
      I(28, 2.2, 7.2, 2.1, "deck"),
   ];
   const anchors = [
      A({ x: 10, y: 12, z: 0, kind: "cracked", crackMs: 3000 }),
      A({ x: 38, y: 12.2, z: 0, kind: "cracked", crackMs: 3000 }),
      A({ x: 66, y: 12.2, z: 0, kind: "cracked", crackMs: 3000 }),
      A({ x: 94, y: 12, z: 0, kind: "post" }),
      A({ x: 24, y: 15, z: 6.2, kind: "ring" }),
   ];
   const orbs = [
      O(10, 3.5, 0), O(26, 3.2, 0), O(54, 3.3, 0), O(82, 3.3, 0), O(104, 3.4, 0), O(42, 4.4, 0), O(70, 4.2, 0),
      O(48, 1.3, 0, "magnet"), O(76, 1.3, 0, "magnet"),
   ];
   return pack(4, islands, anchors, orbs, {
      route: [0, 1, 2, 3],
      finish: 4,
      gust: 3.5,
      gustPeriod: 4.2,
      hazards: [{ x: 28, y: 3.2, z: 4.4, r: 1.4, kind: "spark" }],
      secrets: [
         { x: 24, y: 4.4, z: 6.6, r: 1.2 },
         { x: 28, y: 3.6, z: 7.2, r: 1.2 },
      ],
   });
}

/** Level 5: three turrets on the way, a drone into the mast, then two falling rings and the bell. */
function level5(): Course {
   const islands = [
      I(0, 2.4, 0, 6, "start"),
      I(23, 2.4, 0, 5.2, "rest", true),
      I(46, 2.4, 0, 5.2, "rest", true),
      I(70, 2.6, 0, 5.6, "rest", true),
      I(118, 3.2, 0, 5, "pad"),
   ];
   const anchors = [
      A({ x: 9, y: 11.6, z: 0, kind: "ring", cut: true }),
      A({ x: 32, y: 11.6, z: 0, kind: "ring", cut: true }),
      A({ x: 55, y: 11.6, z: 0, kind: "ring", cut: true }),
      A({ x: 0, y: 0, z: 0, kind: "drone", radius: 3.4, period: 5.5, phase: 0.4, hubX: 78, hubY: 11, hubZ: 0 }),
      A({ x: 96, y: 13, z: 0, kind: "fall", fallSpeed: 0.55 }),
      A({ x: 112, y: 14.5, z: 0, kind: "fall", fallSpeed: 0.55 }),
   ];
   const orbs = [
      O(8, 3.6, 0), O(23, 3.6, 0), O(46, 3.6, 0), O(70, 3.8, 0), O(100, 5, 0), O(114, 5.2, 0),
      O(28, 1.4, 0, "magnet"),
      O(40, 8.2, 0, "bonus"),
   ];
   return pack(5, islands, anchors, orbs, {
      route: [0, 1, 2, 3, 4, 5],
      finish: 4,
      turrets: [
         { x: 16, y: 7, z: 0, r: 5.2 },
         { x: 39, y: 7, z: 0, r: 5.2 },
         { x: 62, y: 7, z: 0, r: 5.2 },
      ],
      mast: { x: 78, y: 6.5, z: 0, r: 5.5 },
      bell: { x: 118, y: 5.4, z: 0, r: 3.2 },
      blocks: [{ x0: 68, x1: 70.2, y0: 2.6, y1: 6, z0: -6, z1: -3.6, kind: "ghost" }],
      hazards: [{ x: 16, y: 3.2, z: 4.2, r: 1.3, kind: "smoke" }],
      secrets: [
         { x: 20, y: 4.2, z: 6, r: 1.2 },
         { x: 68, y: 4, z: -5, r: 1.2 },
         { x: 82, y: 5, z: 5.2, r: 1.2 },
      ],
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
