// Tightrope Path's courses (pure data and geometry, no three.js): each level is one walk across a
// misty jungle gorge, a chain of links the hero walks along. A link is a rock-pillar top (a safe
// checkpoint), a wide plank bridge, a narrow balance beam, a rope (sagging 0.4 m), a rotating beam, a
// cracked "dash rope" (Riko's) or a ghost plank (Vexa's invisible route, which holds the shard). Links
// join end to start, or across a short gap that needs a jump. The hero stands ON the path: rules.ts keeps
// it 1D (the link and the distance along it); the world position comes from linkPoint().
//
// Heading convention: a link runs along (sin h, cos h) on the ground plane; h = pi is north (-z), the way
// the orbit camera looks at yaw 0. The river is at y = 0, the walk 14 m above it.
import type { LevelId } from "../../types";
import { LEVELS, type TightLevel } from "./levels";

export const TOP = 14;
/** the rope's sag at its middle (m, the card) */
export const ROPE_SAG = 0.4;
/** a pillar top's walk length and radius (m) */
export const PILLAR_LEN = 2.6;
export const PILLAR_R = 1.5;

export type LinkKind = "pillar" | "plank" | "beam" | "rope" | "spin" | "dash" | "ghost";

export interface Link {
   id: number;
   kind: LinkKind;
   ax: number;
   ay: number;
   az: number;
   bx: number;
   by: number;
   bz: number;
   len: number;
   /** unit direction on the ground plane */
   dx: number;
   dz: number;
   sag: number;
   /** a jump gap (m) from this link's end to the next link's start; 0 = joined */
   gap: number;
   /** a rotating beam's spin (+1 / -1; 20 deg/s about its long axis): it pushes the needle that way */
   spin: number;
   /** a swaying rope's amplitude (0..1, L3) */
   sway: number;
   /** the next / previous link on the walk (-1: none) */
   next: number;
   prev: number;
   /** a pillar whose next link has a ghost alternative (Vexa, phasing): that link's index, else -1 */
   alt: number;
   /** a lookout tower stands beside this link (the bird secret on a rope; torches at night) */
   tower: boolean;
   /** level 5: the joust's links (1 the rope, 2 the beam, 3 the rotating beam), else 0 */
   arena: number;
   /** the finish pillar */
   goal: boolean;
}

export interface Gust {
   link: number;
   s0: number;
   s1: number;
   sign: number;
   /** the cycle: 1 s of telegraph (leaves, mist streaks), 1.5 s of push, then calm */
   periodMs: number;
   offsetMs: number;
   /** the push (needle per s): 0.4 pushes 60 % over the 1.5 s (the card) */
   force: number;
}

export interface Sandbag {
   link: number;
   s: number;
   periodMs: number;
   offsetMs: number;
}

export interface Orb {
   id: number;
   link: number;
   /** along the link (a high orb hangs over the start of the link after a gap) */
   s: number;
   /** a high orb hangs 1.8 m up: only a double jump (Nami) reaches it */
   high: boolean;
}

export interface Coin {
   id: number;
   link: number;
   s: number;
}

export interface Course {
   level: LevelId;
   cfg: TightLevel;
   links: Link[];
   /** the first and the finish links */
   start: number;
   goal: number;
   gusts: Gust[];
   sandbags: Sandbag[];
   orbs: Orb[];
   /** Zuno's coin arcs rising from the mist under the path (his magnet pulls them up) */
   coins: Coin[];
   mainOrbs: number;
   highOrbs: number;
   /** the shard on the ghost route (the end of its first link) */
   shard: { link: number; s: number } | null;
   /** the rope by the hidden lookout tower (the bird secret), -1 none */
   birdLink: number;
   /** level 5: the joust's first link, else -1 */
   arenaStart: number;
   durationMs: number;
   targetMs: number;
}

const DEG = Math.PI / 180;

interface AddOpts {
   gap?: number;
   dy?: number;
   spin?: number;
   sway?: number;
   tower?: boolean;
   arena?: number;
   goal?: boolean;
}

/** Lays links one after the other from a cursor (position, heading). */
class Builder {
   x = 0;
   y = TOP;
   z = 0;
   h = Math.PI;
   links: Link[] = [];

   add(kind: LinkKind, len: number, o: AddOpts = {}): number {
      const dx = Math.sin(this.h);
      const dz = Math.cos(this.h);
      const gap = o.gap ?? 0;
      const id = this.links.length;
      const by = this.y + (o.dy ?? 0);
      this.links.push({
         id,
         kind,
         ax: this.x,
         ay: this.y,
         az: this.z,
         bx: this.x + dx * len,
         by,
         bz: this.z + dz * len,
         len,
         dx,
         dz,
         sag: kind === "rope" || kind === "dash" ? ROPE_SAG : 0,
         gap,
         spin: o.spin ?? 0,
         sway: o.sway ?? 0,
         next: -1,
         prev: id - 1,
         alt: -1,
         tower: o.tower ?? false,
         arena: o.arena ?? 0,
         goal: o.goal ?? false,
      });
      if (id > 0) this.links[id - 1].next = id;
      this.x += dx * (len + gap);
      this.z += dz * (len + gap);
      this.y = by;
      return id;
   }

   pillar(o: AddOpts = {}): number {
      return this.add("pillar", PILLAR_LEN, o);
   }

   turn(deg: number): void {
      this.h += deg * DEG;
   }

   /**
    * Vexa's ghost route from pillar `from` to pillar `from + 2` (replacing the one element between
    * them): two ghost planks bowed `side` m out to the side, the shard where they meet.
    */
   ghost(from: number, side: number): { link: number; s: number } {
      const p = this.links[from];
      const q = this.links[from + 2];
      const mx = (p.bx + q.ax) / 2;
      const mz = (p.bz + q.az) / 2;
      const ux = q.ax - p.bx;
      const uz = q.az - p.bz;
      const ul = Math.hypot(ux, uz) || 1;
      // right of the walk: (-dz, dx)
      const ox = mx + (-uz / ul) * side;
      const oz = mz + (ux / ul) * side;
      const make = (ax: number, az: number, bx: number, bz: number, ay: number, by: number): Link => {
         const len = Math.hypot(bx - ax, bz - az);
         return { id: this.links.length, kind: "ghost", ax, ay, az, bx, by, bz, len, dx: (bx - ax) / len, dz: (bz - az) / len, sag: 0, gap: 0, spin: 0, sway: 0, next: -1, prev: -1, alt: -1, tower: false, arena: 0, goal: false };
      };
      const midY = (p.by + q.ay) / 2;
      const g1 = make(p.bx, p.bz, ox, oz, p.by, midY);
      this.links.push(g1);
      const g2 = make(ox, oz, q.ax, q.az, midY, q.ay);
      this.links.push(g2);
      g1.prev = from;
      g1.next = g2.id;
      g2.prev = g1.id;
      g2.next = q.id;
      p.alt = g1.id;
      return { link: g1.id, s: g1.len };
   }
}

interface Extras {
   gusts?: Omit<Gust, "periodMs" | "offsetMs" | "force">[];
   gustForce?: number;
   sandbags?: { link: number; s: number }[];
   orbs: { link: number; s: number; high?: boolean }[];
   coins: { link: number; s: number }[];
   ghost: { from: number; side: number };
   bird: number;
}

function finish(level: LevelId, b: Builder, x: Extras): Course {
   const shard = b.ghost(x.ghost.from, x.ghost.side);
   const cfg = LEVELS[level];
   const links = b.links;
   const orbs: Orb[] = x.orbs.map((o, id) => ({ id, link: o.link, s: o.s, high: !!o.high }));
   const gusts: Gust[] = (x.gusts ?? []).map((g, i) => ({ ...g, periodMs: 5200 + (i % 3) * 700, offsetMs: (i * 1700) % 5000, force: x.gustForce ?? 0.4 }));
   const sandbags: Sandbag[] = (x.sandbags ?? []).map((s, i) => ({ ...s, periodMs: 2500, offsetMs: (i * 830) % 2500 }));
   let goal = links.length - 1;
   for (let i = links.length - 1; i >= 0; i--) if (links[i].goal) goal = i;
   return {
      level,
      cfg,
      links,
      start: 0,
      goal,
      gusts,
      sandbags,
      orbs,
      coins: x.coins.map((c, id) => ({ id, link: c.link, s: c.s })),
      mainOrbs: orbs.filter((o) => !o.high).length,
      highOrbs: orbs.filter((o) => o.high).length,
      shard,
      birdLink: x.bird,
      arenaStart: links.findIndex((l) => l.arena === 1),
      durationMs: cfg.durationMs,
      targetMs: cfg.targetMs,
   };
}

/** L1 Wide Beams: six elements in three beats: a wide plank, a narrow beam to correct on, a short rope with a gentle gust. */
function level1(): Course {
   const b = new Builder();
   b.pillar(); // 0
   const plank = b.add("plank", 8); // 1
   b.pillar(); // 2
   b.turn(-12);
   const beam = b.add("beam", 7); // 3
   b.pillar(); // 4
   b.turn(15);
   const rope = b.add("rope", 8, { tower: true }); // 5
   b.pillar(); // 6
   b.turn(-8);
   const beamA = b.add("beam", 5, { gap: 1.0 }); // 7
   const beamB = b.add("beam", 4); // 8
   b.pillar(); // 9
   b.turn(10);
   const plank2 = b.add("plank", 6); // 10
   b.pillar({ goal: true }); // 11
   return finish(1, b, {
      gusts: [{ link: rope, s0: 2, s1: 6.5, sign: 1 }],
      gustForce: 0.22,
      orbs: [
         { link: plank, s: 4 },
         { link: beam, s: 3.5 },
         { link: rope, s: 4 },
         { link: beamB, s: 2 },
         { link: plank2, s: 3 },
         { link: beamB, s: 0.25, high: true },
      ],
      coins: [2, 3.5, 5, 6.5].map((s) => ({ link: rope, s })),
      ghost: { from: 4, side: -3 },
      bird: rope,
   });
}

/** L2 Narrow Beams: gusts telegraphed by leaves and mist; the first dash rope. */
function level2(): Course {
   const b = new Builder();
   b.pillar(); // 0
   const beam1 = b.add("beam", 7); // 1
   b.pillar(); // 2
   b.turn(14);
   const rope1 = b.add("rope", 9, { dy: 0.4 }); // 3
   b.pillar({ tower: true }); // 4
   b.turn(-10);
   const dash = b.add("dash", 10); // 5
   b.pillar(); // 6
   b.turn(-12);
   const beamA = b.add("beam", 6, { gap: 1.1 }); // 7
   const beamB = b.add("beam", 5); // 8
   b.pillar(); // 9
   b.turn(16);
   const rope2 = b.add("rope", 8, { dy: -0.4, tower: true }); // 10
   b.pillar(); // 11
   b.turn(-6);
   const beam3 = b.add("beam", 7); // 12
   b.pillar({ goal: true }); // 13
   return finish(2, b, {
      gusts: [
         { link: rope1, s0: 2, s1: 7.5, sign: 1 },
         { link: beamB, s0: 0.5, s1: 4.5, sign: -1 },
         { link: rope2, s0: 1.5, s1: 6.5, sign: -1 },
         { link: beam3, s0: 2, s1: 6, sign: 1 },
      ],
      orbs: [
         { link: beam1, s: 3.5 },
         { link: rope1, s: 5 },
         { link: dash, s: 6 },
         { link: beamB, s: 2.5 },
         { link: rope2, s: 4 },
         { link: beamB, s: 0.25, high: true },
      ],
      coins: [2, 4, 6, 8].map((s) => ({ link: rope1, s })).concat([2, 4, 6].map((s) => ({ link: rope2, s }))),
      ghost: { from: 11, side: 3 },
      bird: rope2,
   });
}

/** L3 Moving Beams: swinging sandbags (duck them) and swaying ropes. */
function level3(): Course {
   const b = new Builder();
   b.pillar(); // 0
   const beam1 = b.add("beam", 7); // 1
   b.pillar(); // 2
   b.turn(-14);
   const rope1 = b.add("rope", 9, { sway: 1 }); // 3
   b.pillar(); // 4
   b.turn(10);
   const beamA = b.add("beam", 6, { gap: 1.0 }); // 5
   const beamB = b.add("beam", 6); // 6
   b.pillar(); // 7
   b.turn(12);
   const dash = b.add("dash", 9); // 8
   b.pillar({ tower: true }); // 9
   b.turn(-16);
   const rope2 = b.add("rope", 10, { sway: 1, dy: 0.5, tower: true }); // 10
   b.pillar(); // 11
   b.turn(8);
   const beam3 = b.add("beam", 8); // 12
   b.pillar(); // 13
   const plank = b.add("plank", 5); // 14
   b.pillar({ goal: true }); // 15
   return finish(3, b, {
      gusts: [
         { link: rope2, s0: 2, s1: 8, sign: 1 },
         { link: beam3, s0: 1, s1: 5, sign: -1 },
      ],
      sandbags: [
         { link: beam1, s: 4 },
         { link: beamB, s: 2 },
         { link: beamB, s: 4.5 },
         { link: beam3, s: 6 },
      ],
      orbs: [
         { link: beam1, s: 2 },
         { link: rope1, s: 4.5 },
         { link: beamA, s: 3 },
         { link: rope2, s: 6 },
         { link: plank, s: 2.5 },
         { link: beamB, s: 0.25, high: true },
      ],
      coins: [2, 4, 6].map((s) => ({ link: rope1, s })).concat([2, 4, 6, 8].map((s) => ({ link: rope2, s }))),
      ghost: { from: 13, side: -2.5 },
      bird: rope2,
   });
}

/** L4 Rotating Path: rotating beams and night fog; lookout-tower torches light the way. */
function level4(): Course {
   const b = new Builder();
   b.pillar({ tower: true }); // 0
   const beam1 = b.add("beam", 7); // 1
   b.pillar(); // 2
   b.turn(12);
   const spin1 = b.add("spin", 8, { spin: 1 }); // 3
   b.pillar({ tower: true }); // 4
   b.turn(-14);
   const rope1 = b.add("rope", 9, { tower: true }); // 5
   b.pillar(); // 6
   b.turn(-8);
   const spinA = b.add("spin", 7, { spin: -1, gap: 1.0 }); // 7
   const beamB = b.add("beam", 5); // 8
   b.pillar({ tower: true }); // 9
   b.turn(15);
   const dash = b.add("dash", 10); // 10
   b.pillar(); // 11
   b.turn(-10);
   const spin2 = b.add("spin", 9, { spin: 1 }); // 12
   b.pillar({ tower: true }); // 13
   b.turn(6);
   const rope2 = b.add("rope", 8, { dy: -0.4 }); // 14
   b.pillar({ goal: true }); // 15
   return finish(4, b, {
      gusts: [
         { link: rope1, s0: 2, s1: 7, sign: -1 },
         { link: rope2, s0: 1.5, s1: 6.5, sign: 1 },
      ],
      sandbags: [{ link: beamB, s: 2.5 }],
      orbs: [
         { link: beam1, s: 3.5 },
         { link: spin1, s: 4 },
         { link: rope1, s: 5 },
         { link: dash, s: 5 },
         { link: spin2, s: 4.5 },
         { link: beamB, s: 0.25, high: true },
      ],
      coins: [2, 4, 6, 8].map((s) => ({ link: rope1, s })).concat([2, 4, 6].map((s) => ({ link: rope2, s }))),
      ghost: { from: 11, side: 3 },
      bird: rope1,
   });
}

/** L5 Balance Master: a short approach, then Umbra's joust on a rope, a beam and a rotating beam. */
function level5(): Course {
   const b = new Builder();
   b.pillar(); // 0
   const beam1 = b.add("beam", 7); // 1
   b.pillar(); // 2
   b.turn(10);
   const rope1 = b.add("rope", 9, { tower: true }); // 3
   b.pillar(); // 4
   b.turn(-12);
   const spin1 = b.add("spin", 7, { spin: 1 }); // 5
   b.pillar(); // 6 (the arena checkpoint)
   b.turn(6);
   const ropeA = b.add("rope", 14, { arena: 1 }); // 7
   b.pillar(); // 8
   b.turn(-8);
   const beamB = b.add("beam", 10, { arena: 2 }); // 9
   b.pillar(); // 10
   b.turn(8);
   b.add("spin", 10, { spin: -1, arena: 3 }); // 11
   b.pillar({ goal: true }); // 12
   return finish(5, b, {
      gusts: [{ link: rope1, s0: 2, s1: 7, sign: 1 }],
      orbs: [
         { link: beam1, s: 3.5 },
         { link: rope1, s: 4.5 },
         { link: spin1, s: 3.5 },
         { link: ropeA, s: 3 },
         { link: beamB, s: 2.5 },
      ],
      coins: [2, 4, 6, 8].map((s) => ({ link: rope1, s })),
      ghost: { from: 2, side: -3 },
      bird: rope1,
   });
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };
const CACHE: Partial<Record<LevelId, Course>> = {};

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}

export function courseFor(level: LevelId): Course {
   return (CACHE[level] ??= buildCourse(level));
}

/** The walk surface's point at distance s along link l (a rope sags; s may run past the end over its gap). */
export function linkPoint(l: Link, s: number, out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
   const k = l.len > 0 ? Math.max(0, Math.min(1, s / l.len)) : 0;
   out.x = l.ax + l.dx * s;
   out.z = l.az + l.dz * s;
   out.y = l.ay + (l.by - l.ay) * k - l.sag * 4 * k * (1 - k);
   return out;
}

/** Is link l a balance element (the needle drifts on it)? */
export const isBalance = (l: Link): boolean => l.kind !== "pillar";

/** The main route's links in walk order (start to goal, no ghost links). */
export function mainRoute(c: Course): number[] {
   const out: number[] = [];
   for (let i = c.start; i >= 0; i = c.links[i].next) {
      out.push(i);
      if (i === c.goal) break;
   }
   return out;
}
