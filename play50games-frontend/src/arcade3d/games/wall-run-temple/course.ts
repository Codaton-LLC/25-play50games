// Wall Run Temple's course: a cliff temple with no floor. Gap platforms (rests and checkpoints),
// glyph-marked walls in facing pairs (the wall-run and the wall-kick), stone columns at the corners
// (the column whip), and per level: sliding wall panels, spike panels, crumbling walls, swinging stone
// rams, and the five hero pockets. Pure data plus the time functions the rules and the scene share.
//
// Geometry: every corridor runs along a heading, +x or +z: the course climbs a staircase that never doubles
// back, so its length is the Manhattan distance from the start (the proof's distance). A wall is a vertical slab along one
// axis; its runnable face is the plane `c` and `n` points from the face into the corridor.
import type { LevelId } from "@/arcade3d/types";

export type Axis = "x" | "z";
export type WallKind = "run" | "moving" | "crumble" | "shaft" | "upper" | "low" | "ghost";
export type PadKind = "start" | "rest" | "deck" | "pad" | "floor" | "cave";
export type OrbKind = "main" | "bonus" | "magnet";

export interface Vec3 {
   x: number;
   y: number;
   z: number;
}

export interface Wall {
   axis: Axis;
   /** the face plane's coordinate on the other axis (z for an "x" wall, x for a "z" wall) */
   c: number;
   /** +1 / -1: the face normal along the other axis, pointing into the corridor */
   n: 1 | -1;
   /** extent along the axis */
   a0: number;
   a1: number;
   y0: number;
   y1: number;
   kind: WallKind;
   /** moving panels: the cycle (ms) and the phase (0..1) of the "out" half */
   period: number;
   phase: number;
}

export interface Pad {
   x: number;
   y: number;
   z: number;
   /** half the side (pads are squares along the axes) */
   r: number;
   kind: PadKind;
   cp: boolean;
}

export interface Column {
   x: number;
   z: number;
   r: number;
   y0: number;
   y1: number;
}

export interface Orb {
   x: number;
   y: number;
   z: number;
   kind: OrbKind;
}

export interface Box {
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   z0: number;
   z1: number;
}

/** a cracked wall panel (Riko's dash breaks it), or a boss gate (open from that boss phase on) */
export interface Block extends Box {
   kind: "cracked" | "gate";
   gatePhase: number;
}

/** spike panels on a wall face: lethal unless the hero is rolled up (Action on the wall) */
export interface Spikes extends Box {
   wall: number;
}

/** a dart-vent line (thorn darts puff along it): lethal unless shielded. Kiro's pocket. */
export interface Darts {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** a swinging stone ram: a pendulum hung at `pivot`, swinging across the corridor (along `swingAxis`) */
export interface Ram {
   x: number;
   y: number;
   z: number;
   length: number;
   amp: number;
   period: number;
   phase: number;
   swing: Axis;
   r: number;
}

export interface Spot {
   x: number;
   y: number;
   z: number;
   r: number;
}

/** One leg of the bot's route: get from the pad `from` to the pad `to` this way. */
export interface Leg {
   kind: "walls" | "whip" | "jump" | "shaft";
   from: number;
   to: number;
   heading: Vec3;
   /** whip legs: the columns in order and the heading after each */
   columns: number[];
   turns: Vec3[];
   /** walls legs: the side of the first wall (+1 / -1 along the right-hand perpendicular) */
   side: 1 | -1;
}

export interface Course {
   level: LevelId;
   pads: Pad[];
   walls: Wall[];
   columns: Column[];
   orbs: Orb[];
   blocks: Block[];
   spikes: Spikes[];
   darts: Darts[];
   rams: Ram[];
   hulls: Box[];
   /** the ghost wall boxes of every Vexa room (solid unless phased or inside a hull) */
   ghosts: Box[];
   /** the temple corner blocks inside each column whip's turn (solid, never runnable) */
   corners: Box[];
   secrets: Spot[];
   legs: Leg[];
   finish: number;
   mainOrbs: number;
   boss: boolean;
   /** level 5: the arena pieces */
   arena: Arena | null;
   /** the least Manhattan distance (xz) from the start to the finish: the proof's distance */
   span: number;
   /** the safety floor's top (level 1's first beat), or -Infinity */
   floorY: number;
}

export interface Arena {
   /** the corridor where Umbra mirrors you (phase 1): its walls */
   mirror: number[];
   /** the column hall (phase 2): its columns in route order */
   hall: number[];
   /** the shaft (phase 3): its two walls and the top glyph */
   shaft: number[];
   glyph: Spot;
   /** the checkpoint each phase moves the respawn up to */
   phaseCp: number[];
}

export const WALL_T = 0.6;
/** half the corridor's width: the faces stand this far either side of the centre line */
export const HALF_W = 2.6;

const DIRS: Record<string, Vec3> = {
   px: { x: 1, y: 0, z: 0 },
   pz: { x: 0, y: 0, z: 1 },
   nz: { x: 0, y: 0, z: -1 },
};

/** Is a moving panel out (runnable) at rules time `ms`? Fixed walls always are. */
export function wallOut(w: Wall, ms: number): boolean {
   if (w.kind !== "moving") return true;
   const f = ((ms / w.period + w.phase) % 1 + 1) % 1;
   return f < 0.5;
}

/** A ram's bob position at rules time `ms`. */
export function ramAt(r: Ram, ms: number, out: Vec3): Vec3 {
   const ang = r.amp * Math.sin((Math.PI * 2 * ms) / r.period + r.phase);
   const s = Math.sin(ang) * r.length;
   out.y = r.y - Math.cos(ang) * r.length;
   out.x = r.x + (r.swing === "x" ? s : 0);
   out.z = r.z + (r.swing === "z" ? s : 0);
   return out;
}

/** The right-hand perpendicular of a heading in the xz plane (y up). */
export function right(h: Vec3): Vec3 {
   return { x: -h.z, y: 0, z: h.x };
}

// ---------------- the builder ----------------

class Build {
   pads: Pad[] = [];
   walls: Wall[] = [];
   columns: Column[] = [];
   orbs: Orb[] = [];
   blocks: Block[] = [];
   spikes: Spikes[] = [];
   darts: Darts[] = [];
   rams: Ram[] = [];
   hulls: Box[] = [];
   secrets: Spot[] = [];
   legs: Leg[] = [];
   /** the current pad and heading */
   at = 0;
   h: Vec3 = DIRS.px;
   floorY = -Infinity;

   constructor(public level: LevelId, public y = 4) {
      this.pad(0, y, 0, 3.4, "start", true);
   }

   pad(x: number, y: number, z: number, r: number, kind: PadKind, cp = false): number {
      this.pads.push({ x, y, z, r, kind, cp: cp || kind === "start" || kind === "pad" });
      return this.pads.length - 1;
   }

   orb(x: number, y: number, z: number, kind: OrbKind = "main"): void {
      this.orbs.push({ x, y, z, kind });
   }

   /** a point `s` m along the heading and `p` m to its right from the current pad's centre */
   pt(s: number, p: number, h = this.h): { x: number; z: number } {
      const a = this.pads[this.at];
      const r = right(h);
      return { x: a.x + h.x * s + r.x * p, z: a.z + h.z * s + r.z * p };
   }

   /**
    * A wall along the heading on one side: from `s0` to `s1` m ahead of the current pad's centre,
    * its face `off` m to the right (negative = left). Returns its index.
    */
   wall(s0: number, s1: number, off: number, y0: number, y1: number, kind: WallKind = "run", period = 3000, phase = 0): number {
      const h = this.h;
      const a = this.pt(s0, off);
      const b = this.pt(s1, off);
      const axis: Axis = Math.abs(h.x) > 0.5 ? "x" : "z";
      const c = axis === "x" ? a.z : a.x;
      const r = right(h);
      // the face normal points back toward the centre line
      const nr = off > 0 ? -1 : 1;
      const n = (axis === "x" ? Math.sign(r.z) * nr : Math.sign(r.x) * nr) as 1 | -1;
      const along0 = axis === "x" ? Math.min(a.x, b.x) : Math.min(a.z, b.z);
      const along1 = axis === "x" ? Math.max(a.x, b.x) : Math.max(a.z, b.z);
      this.walls.push({ axis, c, n, a0: along0, a1: along1, y0, y1, kind, period, phase });
      return this.walls.length - 1;
   }

   /** the next pad, `gap` m ahead along the heading (centre to centre), `dy` m up */
   next(gap: number, r = 3.2, dy = 0, kind: PadKind = "rest"): number {
      const p = this.pt(gap, 0);
      this.y += dy;
      const i = this.pad(p.x, this.y, p.z, r, kind, kind === "rest" || kind === "pad");
      this.orb(this.pads[i].x - this.h.x * 1.4, this.y + 1.1, this.pads[i].z - this.h.z * 1.4);
      return i;
   }

   leg(kind: Leg["kind"], from: number, to: number, side: 1 | -1 = 1, columns: number[] = [], turns: Vec3[] = []): void {
      this.legs.push({ kind, from, to, heading: this.h, side, columns, turns });
   }

   /**
    * A corridor of facing walls over the chasm, `len` m of wall between this pad and the next.
    * The walls start 1 m before this pad's edge and end over the next pad's near edge.
    */
   corridor(len: number, opts: { kind?: WallKind; side?: 1 | -1; period?: number; rOut?: number; orbs?: boolean } = {}): { a: number; b: number; from: number; to: number; s0: number; s1: number } {
      const from = this.at;
      const r0 = this.pads[from].r;
      const s0 = r0 - 1;
      const s1 = s0 + len;
      const yb = this.y;
      const kind = opts.kind ?? "run";
      const period = opts.period ?? 3000;
      let a: number;
      let b: number;
      if (kind === "crumble") {
         // crumbling walls are 6 m panels: each one cracks 0.8 s after its first run
         const n = Math.max(1, Math.round(len / 6));
         const seg = len / n;
         a = this.walls.length;
         for (let k = 0; k < n; k++) this.wall(s0 + k * seg, s0 + (k + 1) * seg, HALF_W, yb - 2.5, yb + 5.5, kind);
         b = this.walls.length;
         for (let k = 0; k < n; k++) this.wall(s0 + k * seg, s0 + (k + 1) * seg, -HALF_W, yb - 2.5, yb + 5.5, kind);
      } else {
         a = this.wall(s0, s1, HALF_W, yb - 2.5, yb + 5.5, kind, period, 0);
         b = this.wall(s0, s1, -HALF_W, yb - 2.5, yb + 5.5, kind, period, 0.5);
      }
      const rOut = opts.rOut ?? 3.4;
      const to = this.next(s1 + rOut - 0.6, rOut, -0.4);
      if (opts.orbs !== false) {
         // orbs along the kick line, crossing the corridor
         for (let k = 1; k <= 3; k++) {
            const s = s0 + (len * k) / 4;
            const p = this.pt(s, k % 2 ? 1.2 : -1.2, this.h);
            this.orb(p.x, yb + 1.9, p.z);
         }
      }
      this.leg("walls", from, to, opts.side ?? 1);
      this.at = to;
      return { a, b, from, to, s0, s1 };
   }

   /**
    * One long wall on one side over a shallow pit with a floor (level 1's first beat): run it, drop
    * onto the next pad. The floor catches a fall (a safe reset, no lost life).
    */
   singleWall(len: number): void {
      const from = this.at;
      const s0 = this.pads[from].r - 1;
      const s1 = s0 + len;
      this.wall(s0, s1, HALF_W, this.y - 2.5, this.y + 5.5, "run");
      const mid = this.pt((s0 + s1) / 2, 0);
      this.floorY = this.y - 4.5;
      this.pad(mid.x, this.floorY, mid.z, len / 2 + 1, "floor");
      for (let k = 1; k <= 3; k++) {
         const p = this.pt(s0 + (len * k) / 4, HALF_W - 0.9);
         this.orb(p.x, this.y + 1.7, p.z);
      }
      const to = this.next(s1 + 3.4 - 0.6, 3.4, -0.4);
      this.leg("walls", from, to, 1);
      this.at = to;
   }

   /**
    * A column whip round a corner: from this pad, jump; a column at the corner turns the heading to
    * `turn`; the next pad lies along the new heading. Several turns chain whip to whip. A temple corner
    * block fills each turn's inside, so a straight jump cannot cut the corner: the whip is the way.
    */
   whips(turns: Vec3[], spacing = 5.2): void {
      const from = this.at;
      const R = 1.2;
      const a = this.pads[from];
      const h0 = this.h;
      let h = this.h;
      let entry = { x: a.x + h.x * (a.r + 3), z: a.z + h.z * (a.r + 3) };
      let last = { x: a.x + h.x * a.r, z: a.z + h.z * a.r };
      const yb = this.y;
      const cols: number[] = [];
      for (let k = 0; k < turns.length; k++) {
         const t = turns[k];
         const cx = entry.x + t.x * R;
         const cz = entry.z + t.z * R;
         this.columns.push({ x: cx, z: cz, r: 0.55, y0: yb - 12, y1: yb + 6 });
         cols.push(this.columns.length - 1);
         // the corner block: from the last exit (or the pad's edge) up to the column, on the turn's inside
         const along0 = (last.x - cx) * h.x + (last.z - cz) * h.z + 0.3;
         const along1 = -0.4;
         const in0 = 0.45;
         // inside the turn up to the next leg's line (a chain's later path must stay clear of it)
         const in1 = k === turns.length - 1 ? 8.5 : spacing;
         const xs = [along0, along1].flatMap((al) => [in0, in1].map((it) => cx + h.x * al + t.x * it));
         const zs = [along0, along1].flatMap((al) => [in0, in1].map((it) => cz + h.z * al + t.z * it));
         this.corners.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: yb - 12, y1: yb + 6, z0: Math.min(...zs), z1: Math.max(...zs) });
         const ex = cx + h.x * R;
         const ez = cz + h.z * R;
         this.orb(ex + t.x * 1.6, yb + 2.2, ez + t.z * 1.6);
         last = { x: ex, z: ez };
         h = t;
         entry = { x: ex + h.x * spacing, z: ez + h.z * spacing };
      }
      this.h = h;
      this.y -= 0.6;
      const r = 3.4;
      const to = this.pad(last.x + h.x * (r + 2.4), this.y, last.z + h.z * (r + 2.4), r, "rest", true);
      this.orb(this.pads[to].x - h.x * 1.4, this.y + 1.1, this.pads[to].z - h.z * 1.4);
      this.leg("whip", from, to, 1, cols, turns);
      this.legs[this.legs.length - 1].heading = h0;
      this.at = to;
   }
   /** the temple corner blocks (solid, never runnable) */
   corners: Box[] = [];

   /**
    * A vertical shaft: two facing walls `height` m tall around a short gap; climb by kicks to the
    * pad on top (the shaft walls hold you in place: no run along them).
    */
   shaft(height: number, len = 4): { a: number; b: number; top: number } {
      const from = this.at;
      const s0 = this.pads[from].r - 0.4;
      const s1 = s0 + len;
      const yb = this.y;
      const a = this.wall(s0, s1, 1.7, yb - 2, yb + height + 2, "shaft");
      const b = this.wall(s0, s1, -1.7, yb - 2, yb + height + 2, "shaft");
      for (let k = 1; k <= 3; k++) {
         const p = this.pt((s0 + s1) / 2, 0);
         this.orb(p.x, yb + (height * k) / 4 + 1, p.z);
      }
      const p = this.pt(s1 + 2.6, 0);
      this.y = yb + height;
      const top = this.pad(p.x, this.y, p.z, 2.8, "rest", true);
      this.leg("shaft", from, top, 1);
      this.at = top;
      return { a, b, top };
   }

   // ---------------- the five hero pockets (bonus orbs; the all-orbs star counts main orbs only) ----------------

   /** Riko: a cracked stone panel on the current pad's side, orbs packed inside: only a dash breaks in */
   cracked(side: 1 | -1): void {
      const a = this.pads[this.at];
      const c = this.pt(0, side * (a.r - 1.25));
      const w = 1.2;
      this.blocks.push({ x0: c.x - w, x1: c.x + w, y0: a.y, y1: a.y + 2.8, z0: c.z - w, z1: c.z + w, kind: "cracked", gatePhase: 0 });
      this.orb(c.x, a.y + 0.8, c.z, "bonus");
      this.orb(c.x, a.y + 1.9, c.z, "bonus");
   }

   /** Nami: an upper wall tier over the current pad: out of a kick's reach, in reach of a kick plus a double jump */
   upper(side: 1 | -1): void {
      const a = this.pads[this.at];
      this.wall(-2.5, 3.5, side * HALF_W, a.y + 3.4, a.y + 6.4, "upper");
      for (let k = 0; k < 4; k++) {
         const p = this.pt(-1.8 + k * 1.4, side * (HALF_W - 0.6));
         this.orb(p.x, a.y + 4.6, p.z, "bonus");
      }
   }

   /** Kiro: a dart-vent line high on one wall of the corridor behind the current pad, orbs threaded through it */
   dartLine(s: number, side: 1 | -1): void {
      const y = this.pads[this.at].y + 5.2;
      for (let k = 0; k < 3; k++) {
         const p = this.pt(s + k * 1.8, side * (HALF_W - 0.7));
         this.darts.push({ x: p.x, y, z: p.z, r: 0.95 });
         this.orb(p.x, y, p.z, "bonus");
      }
   }

   /** Zuno: gold ring orbs set in the cliff face behind a wall of the corridor behind the pad, past any hand */
   cliffOrbs(s: number, side: 1 | -1): void {
      const y = this.pads[this.at].y + 1.9;
      for (let k = 0; k < 4; k++) {
         const p = this.pt(s + k * 1.6, side * (HALF_W + WALL_T + 1.8));
         this.orb(p.x, y, p.z, "magnet");
      }
   }

   /** Vexa: a ghost-walled room beside the current pad: orbs and the shard inside */
   ghostRoom(side: 1 | -1, shard: boolean): void {
      const a = this.pads[this.at];
      const w = 1.8;
      const c = this.pt(0, side * (a.r + w + 0.5));
      const yb = a.y;
      this.pad(c.x, yb, c.z, w + 0.3, "deck");
      this.hulls.push({ x0: c.x - w, x1: c.x + w, y0: yb - 0.4, y1: yb + 3, z0: c.z - w, z1: c.z + w });
      const t = 0.3;
      this.ghost.push(
         { x0: c.x - w - t, x1: c.x - w, y0: yb, y1: yb + 3, z0: c.z - w - t, z1: c.z + w + t },
         { x0: c.x + w, x1: c.x + w + t, y0: yb, y1: yb + 3, z0: c.z - w - t, z1: c.z + w + t },
         { x0: c.x - w, x1: c.x + w, y0: yb, y1: yb + 3, z0: c.z - w - t, z1: c.z - w },
         { x0: c.x - w, x1: c.x + w, y0: yb, y1: yb + 3, z0: c.z + w, z1: c.z + w + t },
         { x0: c.x - w - t, x1: c.x + w + t, y0: yb + 3, y1: yb + 3 + t, z0: c.z - w - t, z1: c.z + w + t },
      );
      this.orb(c.x - 0.7, yb + 0.9, c.z - 0.5, "bonus");
      this.orb(c.x + 0.7, yb + 0.9, c.z + 0.5, "bonus");
      if (shard) this.shard = { x: c.x, y: yb + 1.2, z: c.z, r: 1.1 };
   }

   ghost: Box[] = [];
   shard: Spot = { x: 0, y: -999, z: 0, r: 0 };
   cave: Spot = { x: 0, y: -999, z: 0, r: 0 };

   /** the hidden lower wall tier: a low wall under the corridor's start with the cave secret on it */
   lowTier(s0: number, s1: number, side: 1 | -1): void {
      const yb = this.y - 5.2;
      this.wall(s0, s1, side * HALF_W, yb - 2, yb + 2.2, "low");
      const p = this.pt((s0 + s1) / 2, side * (HALF_W - 0.5));
      this.cave = { x: p.x, y: yb + 1.2, z: p.z, r: 1.4 };
      this.orb(p.x, yb + 1.2, p.z, "bonus");
   }

   pack(extras: Partial<Course> & Pick<Course, "finish">): Course {
      const start = this.pads[0];
      const fin = this.pads[extras.finish];
      const span = Math.max(1, Math.abs(fin.x - start.x) + Math.abs(fin.z - start.z) - fin.r - 1);
      return {
         level: this.level,
         pads: this.pads,
         walls: this.walls,
         columns: this.columns,
         orbs: this.orbs,
         blocks: this.blocks,
         spikes: this.spikes,
         darts: this.darts,
         rams: this.rams,
         hulls: this.hulls,
         // progression.ts SECRETS order: the floor-free run (no place), the ghost room shard, the cave
         secrets: [{ x: 0, y: -999, z: 0, r: 0 }, this.shard, this.cave],
         legs: this.legs,
         mainOrbs: this.orbs.filter((o) => o.kind === "main").length,
         boss: this.level === 5,
         arena: null,
         span,
         floorY: this.floorY,
         ghosts: this.ghost,
         corners: this.corners,
         ...extras,
      };
   }
}

// ---------------- the five levels ----------------

/**
 * Level 1 Training Wall: (1) one long wall over a shallow pit with a floor, (2) two facing walls (the
 * kick), (3) a column whip round a corner over the real chasm; then the same three again, longer.
 * Secrets: the floor-free run (sticker), the shard in Vexa's room, the low tier's cave.
 */
function level1(): Course {
   const b = new Build(1);
   b.singleWall(14);
   b.cracked(-1);
   b.corridor(18);
   b.upper(1);
   b.ghostRoom(-1, true);
   b.whips([DIRS.pz]);
   b.corridor(22);
   b.dartLine(-16, 1);
   b.cliffOrbs(-17, -1);
   b.lowTier(-19, -11, 1);
   b.whips([DIRS.px]);
   b.corridor(24);
   b.whips([DIRS.pz]);
   b.corridor(24);
   b.whips([DIRS.px]);
   b.corridor(20);
   b.pads[b.at].kind = "pad";
   return b.pack({ finish: b.at });
}

/** Level 2 Double Wall: moving wall panels that slide in and out on a 3 s cycle (run while out). */
function level2(): Course {
   const b = new Build(2);
   b.corridor(18);
   b.cracked(1);
   b.corridor(22, { kind: "moving" });
   b.upper(-1);
   b.whips([DIRS.pz]);
   b.corridor(24, { kind: "moving" });
   b.ghostRoom(1, true);
   b.dartLine(-19, -1);
   b.corridor(20);
   b.cliffOrbs(-16, 1);
   b.lowTier(-18, -10, -1);
   b.whips([DIRS.px]);
   b.corridor(26, { kind: "moving" });
   b.corridor(18);
   b.whips([DIRS.pz]);
   b.corridor(24, { kind: "moving" });
   b.pads[b.at].kind = "pad";
   return b.pack({ finish: b.at });
}

/** Level 3 Column Hall: whip-to-whip chains, and spike panels you roll under (Action, 0.3 s windows). */
function level3(): Course {
   const b = new Build(3);
   b.corridor(16);
   b.whips([DIRS.pz, DIRS.px]);
   const c1 = b.corridor(22);
   spikesOn(b, c1, 0.5);
   b.cracked(-1);
   b.upper(1);
   b.whips([DIRS.pz, DIRS.px, DIRS.pz]);
   const c2 = b.corridor(24);
   spikesOn(b, c2, 0.35);
   spikesOn(b, c2, 0.7);
   b.ghostRoom(-1, true);
   b.dartLine(-20, 1);
   b.cliffOrbs(-18, -1);
   b.lowTier(-20, -12, 1);
   b.whips([DIRS.px]);
   const c3 = b.corridor(20);
   spikesOn(b, c3, 0.55);
   b.whips([DIRS.pz, DIRS.px]);
   const c4 = b.corridor(22);
   spikesOn(b, c4, 0.4);
   b.pads[b.at].kind = "pad";
   return b.pack({ finish: b.at });
}

/** spike panels on both walls of a corridor at `f` of its length (a roll passes under them) */
function spikesOn(b: Build, c: { a: number; b: number }, f: number): void {
   for (const wi of [c.a, c.b]) {
      const w = b.walls[wi];
      const at = w.a0 + (w.a1 - w.a0) * f;
      const yb = b.pads[b.at].y + 0.4;
      const half = 0.95;
      const depth = 0.5;
      if (w.axis === "x") {
         const z0 = w.n > 0 ? w.c : w.c - depth;
         b.spikes.push({ x0: at - half, x1: at + half, y0: yb - 3, y1: yb + 4.5, z0, z1: z0 + depth, wall: wi });
      } else {
         const x0 = w.n > 0 ? w.c : w.c - depth;
         b.spikes.push({ x0, x1: x0 + depth, y0: yb - 3, y1: yb + 4.5, z0: at - half, z1: at + half, wall: wi });
      }
   }
}

/** Level 4 Broken Temple: walls crumble 0.8 s after you start running on them; stone rams sweep the gaps. */
function level4(): Course {
   const b = new Build(4);
   b.corridor(18);
   b.cracked(-1);
   const c1 = b.corridor(24, { kind: "crumble" });
   ram(b, c1, 0.5, 0);
   b.upper(1);
   b.whips([DIRS.pz]);
   const c2 = b.corridor(22, { kind: "crumble" });
   ram(b, c2, 0.45, 1.3);
   b.ghostRoom(1, true);
   b.dartLine(-18, -1);
   b.cliffOrbs(-17, 1);
   b.lowTier(-19, -11, -1);
   b.whips([DIRS.px]);
   const c3 = b.corridor(26, { kind: "crumble" });
   ram(b, c3, 0.35, 2.2);
   ram(b, c3, 0.7, 0.6);
   b.whips([DIRS.pz]);
   const c4 = b.corridor(24, { kind: "crumble" });
   ram(b, c4, 0.5, 1.7);
   b.whips([DIRS.px]);
   b.corridor(18);
   b.pads[b.at].kind = "pad";
   return b.pack({ finish: b.at });
}

function ram(b: Build, c: { from: number; s0: number; s1: number }, f: number, phase: number): void {
   const save = b.at;
   b.at = c.from;
   const s = c.s0 + (c.s1 - c.s0) * f;
   const p = b.pt(s, 0);
   b.at = save;
   const y = b.pads[c.from].y;
   // it swings along the corridor down its middle: wall-runners pass beside it, a kick across meets it
   const swing: Axis = Math.abs(b.h.x) > 0.5 ? "x" : "z";
   b.rams.push({ x: p.x, y: y + 9.5, z: p.z, length: 7.6, amp: 0.62, period: 2400, phase, swing, r: 1.0 });
}

/**
 * Level 5 Master Wall Run, boss Umbra: a long mirror corridor (phase 1: he runs the opposite wall,
 * kick into him when you meet at his height), a gate, the column hall (phase 2: catch him at a
 * column), a gate, and the shaft (phase 3: out-climb him to the top glyph and slam it).
 */
function level5(): Course {
   const b = new Build(5);
   b.corridor(14);
   b.cracked(1);
   const m1 = b.corridor(30);
   const m2 = b.corridor(26);
   const mirrorEnd = b.at;
   b.dartLine(-14, -1);
   b.cliffOrbs(-12, 1);
   b.upper(-1);
   b.lowTier(-22, -14, 1);
   // the gate into the hall: open from phase 2 on
   const g1 = b.pt(b.pads[b.at].r + 1.2, 0);
   b.blocks.push({ x0: g1.x - 0.4, x1: g1.x + 0.4, y0: b.y - 4, y1: b.y + 9, z0: g1.z - HALF_W - 1, z1: g1.z + HALF_W + 1, kind: "gate", gatePhase: 1 });
   const hallFirst = b.columns.length;
   b.whips([DIRS.pz, DIRS.px, DIRS.pz, DIRS.px], 5.6);
   const hall = b.columns.slice(hallFirst).map((_, k) => hallFirst + k);
   const hallEnd = b.at;
   b.ghostRoom(1, true);
   const g2 = b.pt(b.pads[b.at].r + 0.6, 0);
   b.blocks.push({ x0: g2.x - 0.4, x1: g2.x + 0.4, y0: b.y - 4, y1: b.y + 16, z0: g2.z - 3, z1: g2.z + 3, kind: "gate", gatePhase: 2 });
   const sh = b.shaft(13);
   const top = b.pads[sh.top];
   b.pads[sh.top].kind = "pad";
   const glyph = { x: top.x, y: top.y + 1.4, z: top.z, r: 1.8 };
   return b.pack({
      finish: sh.top,
      arena: {
         mirror: [m1.a, m1.b, m2.a, m2.b],
         hall,
         shaft: [sh.a, sh.b],
         glyph,
         phaseCp: [-1, mirrorEnd, hallEnd],
      },
   });
}

const BUILDERS: Record<LevelId, () => Course> = { 1: level1, 2: level2, 3: level3, 4: level4, 5: level5 };

export function buildCourse(level: LevelId): Course {
   return BUILDERS[level]();
}
