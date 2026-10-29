// Plate Bounce Arena's five toy tables: pure data in table coordinates (metres). x runs across the
// table (left -, right +), z runs up the table toward the top arc (z = 0 is the drain edge, the top is
// z = -29); h is the height above the playfield. The table is tilted TILT toward the player when drawn;
// the rules work in the plane (gravity's slope component pulls toward +z).
//
// Every table shares one frame: the side walls, the plunger lane on the right, the top arc, two
// flippers over the drain, the slingshots, the left inlane, Vexa's attic behind the ghost gate on the
// left wall, Riko's cracked block in front of the skill lane, Nami's raised deck and Zuno's magnet pads
// over the coin trail under glass. Each level adds its own bumpers, mushrooms, ramps, lanterns,
// penguin drop targets, the exit hole and its objectives (the card's sections, in order).
import type { LevelId } from "@/arcade3d/types";

export const TILT = (7 * Math.PI) / 180;
export const TABLE_W = 14;
export const TABLE_L = 29;
export const LEFT_X = -7;
export const RIGHT_X = 7;
/** the plunger lane: between the lane wall and the right wall */
export const LANE_X = 5.6;
/** the ball's centre past this z (outside the lane) is a drain */
export const DRAIN_Z = -0.25;
export const BALL_R = 0.5;
/** where every ball starts: resting on the plunger */
export const PLUNGER = { x: 6.3, z: -0.85 } as const;
/** the top arc's centre and radius */
export const ARC = { x: 0, z: -22, r: 7 } as const;
/** Nami's raised deck: a play deck on posts, DECK_H over the field; its lower edge is open */
export const DECK = { x0: 1.2, x1: 4.6, z0: -26.2, z1: -22.6, h: 1.6 } as const;
/** the zone under the deck a double hop lifts the ball from */
export const DECK_ZONE = { x0: 0.6, x1: 5.2, z0: -22.6, z1: -18.6 } as const;
/** Vexa's attic: a room behind the ghost gate in the left wall */
export const ATTIC = { x0: -9.6, x1: -7, z0: -17, z1: -12 } as const;

export type SegKind = "wall" | "kick" | "oneway" | "ghost" | "crack" | "gate" | "rim";

export interface Seg {
   ax: number;
   az: number;
   bx: number;
   bz: number;
   /** half thickness */
   r: number;
   kind: SegKind;
   /** "kick": the outgoing speed (m/s) along the face normal toward `side` */
   kick: number;
   /** 0 the playfield, 1 Nami's deck */
   layer: 0 | 1;
   /** "gate": solid while the objective stage is below this */
   until: number;
   /** draw it (false for invisible guides) */
   drawn: boolean;
}

export interface Circle {
   x: number;
   z: number;
   r: number;
   layer: 0 | 1;
}

export interface Ramp {
   id: number;
   /** the mouth: the ball must reach it moving along `dir` at RAMP_MIN or faster */
   ex: number;
   ez: number;
   dx: number;
   dz: number;
   /** the path from the mouth to the exit (x, z, h) */
   path: { x: number; z: number; h: number }[];
   /** cumulative length at each path point */
   lens: number[];
   length: number;
   /** "ramp" (a shot) or "orbit" (fed by the mushrooms) */
   kind: "ramp" | "orbit";
}

export type OrbKind = "field" | "ramp" | "deck" | "attic" | "lane" | "coin";

export interface Orb {
   x: number;
   z: number;
   h: number;
   kind: OrbKind;
   /** "ramp": the ramp it sits on */
   ramp: number;
   /** counts toward the "all orbs" star (pocket orbs and coins are bonus) */
   main: boolean;
}

export interface Target extends Circle {
   /** the bank it belongs to (-1: the lone sticker penguin) */
   bank: number;
   /** an ice block (level 3) */
   ice: boolean;
}

export type Objective =
   | { kind: "bumpers"; n: number; label: string }
   | { kind: "ramp"; n: number; label: string }
   | { kind: "orbits"; n: number; label: string }
   | { kind: "lanterns"; label: string }
   | { kind: "bank"; bank: number; label: string }
   | { kind: "boss"; label: string };

export interface Flipper {
   px: number;
   pz: number;
   /** +1 the left flipper (points toward +x), -1 the right */
   side: 1 | -1;
}

export interface Table {
   level: LevelId;
   segs: Seg[];
   bumpers: Circle[];
   posts: Circle[];
   mushrooms: Circle[];
   targets: Target[];
   lanterns: Circle[];
   ramps: Ramp[];
   orbs: Orb[];
   mainOrbs: number;
   magnets: Circle[];
   flippers: Flipper[];
   hole: Circle;
   /** the sticker behind the lone penguin */
   sticker: Circle;
   /** Vexa's shard in the attic */
   shard: Circle;
   /** the skill lane Riko's cracked block guards (its mouth's centre) */
   laneMouth: Circle;
   objectives: Objective[];
   /** the orbit (level 2): the mushrooms feed it */
   orbit: number;
   /** level 5: Rollo's roll band (centre, half extents) */
   boss: { x: number; z: number; ax: number; az: number; r: number } | null;
   /** level 3: the ice table (less friction, a faster slope) */
   ice: boolean;
   /** level 4: the multiball marbles join at this objective stage */
   multiballAt: number;
}

export const FLIPPER_LEN = 2.9;
export const FLIPPER_R = 0.27;
export const BUMPER_R = 0.75;
export const MUSHROOM_R = 0.8;
export const TARGET_R = 0.55;
export const LANTERN_R = 0.55;
export const HOLE_R = 0.75;
export const MAGNET_R = 0.85;

const W = 0.12;

function seg(ax: number, az: number, bx: number, bz: number, kind: SegKind = "wall", extra: Partial<Seg> = {}): Seg {
   return { ax, az, bx, bz, r: W, kind, kick: 0, layer: 0, until: 0, drawn: true, ...extra };
}

/** Points along a circle from angle a0 to a1 (radians, 0 = +x, positive toward -z). */
function arcPoints(cx: number, cz: number, r: number, a0: number, a1: number, n: number): [number, number][] {
   const out: [number, number][] = [];
   for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      out.push([cx + r * Math.cos(a), cz - r * Math.sin(a)]);
   }
   return out;
}

function chain(pts: [number, number][], kind: SegKind = "wall", extra: Partial<Seg> = {}): Seg[] {
   const out: Seg[] = [];
   for (let i = 0; i + 1 < pts.length; i++) out.push(seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], kind, extra));
   return out;
}

function makeRamp(id: number, kind: "ramp" | "orbit", pts: [number, number][], peak = 1.7): Ramp {
   const lens = [0];
   for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
   const length = lens[lens.length - 1];
   const path = pts.map(([x, z], i) => {
      const u = lens[i] / length;
      // up the ramp, along the top, back down to the field
      const h = peak * Math.min(1, u / 0.25, (1 - u) / 0.2);
      return { x, z, h: Math.max(0, h) };
   });
   const dx = pts[1][0] - pts[0][0];
   const dz = pts[1][1] - pts[0][1];
   const d = Math.hypot(dx, dz);
   return { id, ex: pts[0][0], ez: pts[0][1], dx: dx / d, dz: dz / d, path, lens, length, kind };
}

/** A point at fraction u of a ramp's length. */
export function rampPoint(r: Ramp, u: number, out: { x: number; z: number; h: number }): { x: number; z: number; h: number } {
   const s = Math.max(0, Math.min(1, u)) * r.length;
   let i = 1;
   while (i < r.lens.length - 1 && r.lens[i] < s) i++;
   const a = r.path[i - 1];
   const b = r.path[i];
   const span = r.lens[i] - r.lens[i - 1] || 1;
   const k = Math.max(0, Math.min(1, (s - r.lens[i - 1]) / span));
   out.x = a.x + (b.x - a.x) * k;
   out.z = a.z + (b.z - a.z) * k;
   out.h = a.h + (b.h - a.h) * k;
   return out;
}

const RP = { x: 0, z: 0, h: 0 };
function rampOrb(r: Ramp, u: number): Orb {
   rampPoint(r, u, RP);
   return { x: RP.x, z: RP.z, h: RP.h, kind: "ramp", ramp: r.id, main: true };
}

const field = (x: number, z: number): Orb => ({ x, z, h: 0, kind: "field", ramp: -1, main: true });
const bonus = (x: number, z: number, kind: OrbKind, h = 0): Orb => ({ x, z, h, kind, ramp: -1, main: false });
const circle = (x: number, z: number, r: number, layer: 0 | 1 = 0): Circle => ({ x, z, r, layer });

/** The left ramp (levels 1, 3, 4, 5): a shot up the left side that loops back down the left inlane. */
const LEFT_RAMP: [number, number][] = [
   [-4.3, -14.2],
   [-4.8, -18.5],
   [-5.2, -22.5],
   [-4.6, -25.6],
   [-5.9, -26.3],
   [-6.35, -23.5],
   [-6.35, -10.4],
];

/** The orbit (level 2): the mushrooms throw the ball onto it; round the top and down the left side. */
const ORBIT: [number, number][] = [
   [3.4, -23.2],
   [1.6, -27.2],
   [-1.6, -27.6],
   [-4.6, -26.2],
   [-6.35, -23.2],
   [-6.35, -10.4],
];

function frame(): { segs: Seg[]; posts: Circle[] } {
   const segs: Seg[] = [];
   // the left wall, broken by the ghost gate into the attic
   segs.push(seg(LEFT_X, -6.5, LEFT_X, -12.9));
   segs.push(seg(LEFT_X, -12.9, LEFT_X, -16.1, "ghost"));
   segs.push(seg(LEFT_X, -16.1, LEFT_X, ARC.z));
   // the attic: a small room whose floor and back wall kick the ball back out
   segs.push(seg(LEFT_X, ATTIC.z1, ATTIC.x0, ATTIC.z1, "kick", { kick: 9 }));
   segs.push(seg(ATTIC.x0, ATTIC.z1, ATTIC.x0, ATTIC.z0, "kick", { kick: 9 }));
   segs.push(seg(ATTIC.x0, ATTIC.z0, LEFT_X, ATTIC.z0));
   // the left inlane guide down to the flipper
   segs.push(seg(LEFT_X, -6.5, -3.9, -2.85));
   // the right side: the lane wall is the playfield's edge; the guide runs off it
   segs.push(seg(LANE_X, -0.15, LANE_X, -21.0));
   segs.push(seg(LANE_X, -6.4, 3.9, -2.85));
   segs.push(seg(RIGHT_X, -0.15, RIGHT_X, ARC.z));
   segs.push(seg(LANE_X, -0.15, RIGHT_X, -0.15));
   // the one-way gate at the lane's top (the ball goes up through it, never back down)
   segs.push(seg(LANE_X, -21.05, RIGHT_X, -21.05, "oneway"));
   // the top arc
   segs.push(...chain(arcPoints(ARC.x, ARC.z, ARC.r, 0, Math.PI, 14)));
   // slingshots: a kicking face toward the field, closed behind
   segs.push(seg(-5.5, -8.2, -4.0, -5.0, "kick", { kick: 9 }));
   segs.push(seg(-4.0, -5.0, -5.5, -5.7));
   segs.push(seg(-5.5, -5.7, -5.5, -8.2));
   segs.push(seg(5.45, -8.2, 4.0, -5.0, "kick", { kick: 9 }));
   segs.push(seg(4.0, -5.0, 5.45, -6.3));
   // Riko's skill lane under the arc, its mouth closed by the cracked block
   segs.push(seg(-3.85, -22.0, -3.85, -27.6));
   segs.push(seg(-2.15, -22.0, -2.15, -28.3));
   segs.push(seg(-3.85, -22.0, -2.15, -22.0, "crack", { r: 0.2 }));
   // Nami's deck: its rim on the deck layer (the lower edge open)
   segs.push(seg(DECK.x0, DECK.z1, DECK.x0, DECK.z0, "rim", { layer: 1 }));
   segs.push(seg(DECK.x0, DECK.z0, DECK.x1, DECK.z0, "rim", { layer: 1 }));
   segs.push(seg(DECK.x1, DECK.z0, DECK.x1, DECK.z1, "rim", { layer: 1 }));
   const posts: Circle[] = [];
   return { segs, posts };
}

function rampPosts(r: Ramp, posts: Circle[]): void {
   // two posts frame each ramp mouth
   const px = -r.dz;
   const pz = r.dx;
   posts.push(circle(r.ex + px * 1.0, r.ez + pz * 1.0, 0.22));
   posts.push(circle(r.ex - px * 1.0, r.ez - pz * 1.0, 0.22));
}

const FLIPPERS: Flipper[] = [
   { px: -3.6, pz: -2.5, side: 1 },
   { px: 3.6, pz: -2.5, side: -1 },
];

/** Pocket orbs every table shares: the skill lane (Riko), the deck (Nami), the attic (Vexa), the coins (Zuno). */
function pocketOrbs(): Orb[] {
   return [
      bonus(-3.0, -24.2, "lane"),
      bonus(-3.0, -26.4, "lane"),
      bonus(2.2, -24.6, "deck", DECK.h),
      bonus(3.6, -24.6, "deck", DECK.h),
      bonus(-8.3, -13.3, "attic"),
      bonus(-8.3, -15.7, "attic"),
      // the coin trail under the glass (only Zuno's magnet pulls them out)
      bonus(-2.4, -10.6, "coin"),
      bonus(-1.2, -11.2, "coin"),
      bonus(0, -11.5, "coin"),
      bonus(1.2, -11.2, "coin"),
      bonus(2.4, -10.6, "coin"),
   ];
}

function build(level: LevelId): Table {
   const { segs, posts } = frame();
   const t: Table = {
      level,
      segs,
      bumpers: [],
      posts,
      mushrooms: [],
      targets: [],
      lanterns: [],
      ramps: [],
      orbs: [],
      mainOrbs: 0,
      magnets: [circle(-4.4, -9.6, MAGNET_R), circle(3.5, -9.6, MAGNET_R)],
      flippers: FLIPPERS,
      hole: circle(0, -16, HOLE_R),
      sticker: circle(0, 0, 0.6),
      shard: circle(-8.6, -14.5, 0.6),
      laneMouth: circle(-3.0, -22.0, 0.85),
      objectives: [],
      orbit: -1,
      boss: null,
      ice: level === 3,
      multiballAt: -1,
   };
   // the deck's own two little bumpers
   t.bumpers.push(circle(2.0, -25.4, 0.45, 1), circle(3.8, -23.6, 0.45, 1));
   const lone = (x: number, z: number) => {
      t.targets.push({ ...circle(x, z, TARGET_R), bank: -1, ice: level === 3 });
      // the sticker sits right behind the penguin (up-table)
      t.sticker = circle(x, z - 1.15, 0.5);
   };
   if (level === 1) {
      t.bumpers.push(circle(-1.4, -18.6, BUMPER_R), circle(1.4, -18.6, BUMPER_R), circle(0, -20.9, BUMPER_R));
      const r = makeRamp(0, "ramp", LEFT_RAMP);
      t.ramps.push(r);
      t.lanterns.push(circle(-3.2, -11.6, LANTERN_R), circle(0, -13.1, LANTERN_R), circle(3.2, -11.6, LANTERN_R));
      t.hole = circle(0, -15.9, HOLE_R);
      // the drain gate: a kicking bar under the flippers until the first section is done
      segs.push(seg(-1.7, -0.7, 1.7, -0.7, "gate", { until: 1, kick: 10 }));
      lone(4.3, -14.5);
      t.orbs.push(rampOrb(r, 0.38), rampOrb(r, 0.62), field(-5.3, -17.2), field(4.6, -18.2), field(-2.4, -8.6), field(2.4, -8.6), field(0.0, -25.6), field(-1.5, -14.6));
      t.objectives = [
         { kind: "bumpers", n: 3, label: "Flip the ball into the bumpers" },
         { kind: "ramp", n: 1, label: "Shoot the ramp through the gold ring" },
         { kind: "lanterns", label: "Light the 3 lanterns" },
      ];
   } else if (level === 2) {
      t.mushrooms.push(circle(-2.6, -17.6, MUSHROOM_R), circle(2.6, -17.6, MUSHROOM_R), circle(0, -20.6, MUSHROOM_R));
      t.bumpers.push(circle(-4.5, -19.8, BUMPER_R), circle(4.3, -15.6, BUMPER_R));
      const o = makeRamp(0, "orbit", ORBIT, 1.9);
      t.ramps.push(o);
      t.orbit = 0;
      t.targets.push({ ...circle(-1.6, -12.6, TARGET_R), bank: 0, ice: false }, { ...circle(0, -12.6, TARGET_R), bank: 0, ice: false }, { ...circle(1.6, -12.6, TARGET_R), bank: 0, ice: false });
      t.hole = circle(0, -15.1, HOLE_R);
      lone(-4.9, -14.4);
      t.orbs.push(rampOrb(o, 0.25), rampOrb(o, 0.5), rampOrb(o, 0.75), field(-5.6, -11.4), field(4.6, -11.2), field(-2.4, -8.4), field(2.4, -8.4), field(0, -23.4), field(-3.3, -21.4), field(3.2, -20.3));
      t.objectives = [
         { kind: "orbits", n: 3, label: "Mushrooms: 3 orbits in a row" },
         { kind: "bank", bank: 0, label: "Knock down the 3 penguins" },
      ];
   } else if (level === 3) {
      t.bumpers.push(circle(-1.3, -20.2, BUMPER_R), circle(1.5, -21.2, BUMPER_R));
      const r = makeRamp(0, "ramp", LEFT_RAMP);
      t.ramps.push(r);
      for (const z of [-16.6, -18.1, -19.6]) t.targets.push({ ...circle(-5.95, z, TARGET_R), bank: 0, ice: true });
      for (const z of [-12.6, -14.1, -15.6]) t.targets.push({ ...circle(4.85, z, TARGET_R), bank: 1, ice: true });
      t.hole = circle(0, -15.4, HOLE_R);
      lone(0, -11.2);
      t.orbs.push(
         rampOrb(r, 0.38), rampOrb(r, 0.62), field(-2.4, -8.6), field(2.4, -8.6), field(-3.6, -17.8), field(3.4, -17.6), field(0, -18.4),
         field(-1.2, -25.4), field(0.6, -23.6), field(-4.2, -21.0), field(2.3, -13.6), field(-2.3, -13.6),
      );
      t.objectives = [
         { kind: "bank", bank: 0, label: "Shatter the left ice blocks" },
         { kind: "ramp", n: 1, label: "Shoot the ramp" },
         { kind: "bank", bank: 1, label: "Shatter the right ice blocks" },
      ];
   } else if (level === 4) {
      t.bumpers.push(circle(-1.4, -19.4, BUMPER_R), circle(1.4, -19.4, BUMPER_R), circle(0, -21.7, BUMPER_R));
      const r = makeRamp(0, "ramp", LEFT_RAMP);
      t.ramps.push(r);
      t.lanterns.push(circle(-3.4, -11.2, LANTERN_R), circle(0, -12.8, LANTERN_R), circle(3.4, -11.2, LANTERN_R));
      t.hole = circle(0, -16.2, HOLE_R);
      t.multiballAt = 1;
      lone(4.4, -15.2);
      t.orbs.push(
         rampOrb(r, 0.3), rampOrb(r, 0.5), rampOrb(r, 0.7), field(-2.4, -8.6), field(2.4, -8.6), field(-5.4, -17.4), field(4.7, -18.6),
         field(0, -24.8), field(-2.8, -15.2), field(2.6, -15.0), field(-1.0, -26.6), field(-4.6, -12.8), field(3.6, -12.6), field(0, -9.6),
      );
      t.objectives = [
         { kind: "lanterns", label: "Light the 3 lanterns: multiball!" },
         { kind: "ramp", n: 2, label: "Jackpot ramp: 2 shots" },
      ];
   } else {
      t.bumpers.push(circle(-4.4, -21.4, BUMPER_R), circle(4.3, -14.6, BUMPER_R));
      const r = makeRamp(0, "ramp", LEFT_RAMP);
      t.ramps.push(r);
      t.boss = { x: 0.6, z: -18.6, ax: 3.0, az: 1.6, r: 1.15 };
      t.hole = circle(0, -9999, HOLE_R);
      lone(-1.8, -11.6);
      t.orbs.push(rampOrb(r, 0.38), rampOrb(r, 0.62), field(-2.4, -8.6), field(2.4, -8.6), field(-5.4, -15.2), field(4.6, -19.6), field(0, -24.6), field(-2.8, -22.6), field(2.0, -11.2), field(-1.0, -14.4));
      t.objectives = [{ kind: "boss", label: "Beat Rollo" }];
   }
   for (const r of t.ramps) if (r.kind === "ramp") rampPosts(r, t.posts);
   t.orbs.push(...pocketOrbs());
   t.mainOrbs = t.orbs.filter((o) => o.main).length;
   return t;
}

const TABLES: Partial<Record<LevelId, Table>> = {};

export function buildTable(level: LevelId): Table {
   return (TABLES[level] ??= build(level));
}

/** The card's orb counts per level ("all orbs" star): 8 / 10 / 12 / 14 / 10. */
export const MAIN_ORBS: Record<LevelId, number> = { 1: 8, 2: 10, 3: 12, 4: 14, 5: 10 };

/** Table point (x, h, z) to world (the table tilts up toward -z about the drain edge). */
export function tableToWorld(x: number, h: number, z: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const c = Math.cos(TILT);
   const s = Math.sin(TILT);
   out.x = x;
   out.y = h * c - z * s;
   out.z = h * s + z * c;
   return out;
}
