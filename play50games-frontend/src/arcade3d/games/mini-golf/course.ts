// Mini Golf's six holes (README "The six holes"): the felt's height function, the rails, the cup,
// the ponds, the pipes, the windmill and the turntable of each hole, and the seeded mirror.
// Pure data and math: no three.js, React or DOM. Each hole has its own frame: x right, +z towards
// the tee (the cup lies towards -z), y up, the main felt at y 0. The world places hole k at
// z = -HOLE_SPACING * k (looks only; the rules work in the hole's frame).
import { createRng } from "@/arcade3d/core/math";

export const HOLE_COUNT = 6;
/** World spacing of the floating islands along -z (m). */
export const HOLE_SPACING = 16;

export interface P2 {
   x: number;
   z: number;
}

/** A wall the ball bounces off (both faces), at ball height. `zone` limits it to one level of a two-level hole. */
export interface Rail {
   a: P2;
   b: P2;
   /** restitution and Coulomb mu (core resolveCircleSegmentXZ) */
   e: number;
   mu: number;
   /** 0 = everywhere; 1 = only for a ball on the upper tier; 2 = only on the lower green (hole 5) */
   zone: 0 | 1 | 2;
   /** drawn (a wooden board) or part of a model (the windmill's walls) */
   drawn: boolean;
}

export interface Pond {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
}

/** A pipe (hole 5): entered across the tier wall's mouth line, it puts the ball out at `exit` heading `dir`. */
export interface Pipe {
   /** mouth centre on the tier wall (z = TIER_WALL_Z) */
   mouth: P2;
   exit: P2;
   dir: P2;
   /** drawn length (m): the time inside is length / max(speed, PIPE_MIN_SPEED) */
   length: number;
}

export interface WindmillSpec {
   /** the blade plane (z) and the hub height over the felt */
   bladeZ: number;
   hubY: number;
   /** blade length from the hub and half its width (m) */
   length: number;
   halfWidth: number;
   /** rad/s (sign = turn direction; mirrored holes turn the other way) and the start angle from straight down */
   omega: number;
   phase: number;
}

export interface TurntableSpec {
   centre: P2;
   plateRadius: number;
   /** half the bar's length */
   half: number;
   omega: number;
   phase: number;
}

export type TerrainKind = "tilt" | "flat" | "ramp" | "tiers" | "hill";

export interface Hole {
   index: number;
   name: string;
   par: number;
   mirrored: boolean;
   /** -1 when mirrored: x of every original point is multiplied by it */
   sx: number;
   tee: P2;
   cup: P2;
   rails: Rail[];
   ponds: Pond[];
   pipes: Pipe[];
   windmill: WindmillSpec | null;
   turntable: TurntableSpec | null;
   terrain: TerrainKind;
   /** the rails' box (x / z) and the tallest thing to keep on screen */
   box: { x0: number; x1: number; z0: number; z1: number; top: number };
}

// ---------- shared numbers ----------

/** Rails: restitution, Coulomb mu; the windmill's funnel and tunnel walls are softer (README "Rails"). */
export const RAIL = { e: 0.75, mu: 0.1, softE: 0.3 } as const;
/** Hole 1's gentle break: a 2 % tilt towards -x from z BREAK_Z0 to BREAK_Z1 (blended in over 0.5 m). */
export const BREAK = { grade: 0.02, z0: -1.0, z1: -1.5 } as const;
/** Hole 3's ramp: flat to z 1.0, 12 deg up to the lip at z 0, the water gap to z -0.6, the landing green at y 0. */
export const RAMP = { start: 1.0, lip: 0, gapEnd: -0.6, grade: Math.tan((12 * Math.PI) / 180), waterY: -0.15 } as const;
/** Height of the lip over the felt. */
export const LIP_Y = RAMP.grade * (RAMP.start - RAMP.lip);
/** Hole 5: the upper tier (y TIER_Y) ends at the tier wall z = TIER_WALL_Z. */
export const TIER_Y = 0.4;
export const TIER_WALL_Z = 1.5;
/** A pipe mouth's half width in the tier wall and its guide rails (0.3 m, splayed 20 deg towards the tee). */
export const MOUTH = { half: 0.18, guide: 0.3, splay: (20 * Math.PI) / 180 } as const;
export const PIPE_MIN_SPEED = 0.6;
/** Hole 6: the terrace (y HILL.top) to z HILL.top0, the 9 deg slope down to z HILL.bottom, the lower green at y 0. */
export const HILL = { top: 0.6, z0: 3.5, z1: -0.3 } as const;
export const HILL_GRADE = HILL.top / (HILL.z0 - HILL.z1);

/** The windmill (hole 4) at the origin: GLB fit 2.2 m tall (assets.ts checks these against the mesh). */
export const WINDMILL = {
   /** the body's rules box half extents (1.57 x 1.51) */
   halfX: 0.785,
   halfZ: 0.753,
   /** the tunnel walls' inner faces (0.232 clear) */
   tunnelHalf: 0.116,
   /** the funnel from the lane rails to the tunnel mouth */
   funnelTop: 1.6,
   bladeZ: 0.8,
   hubY: 1.148,
   length: 1.1,
   halfWidth: 0.15,
   /** one turn per 6 s; the start angle (from straight down) leaves the mouth open */
   omega: (2 * Math.PI) / 6,
   phase: Math.PI / 4,
   /** a ball that comes to rest inside the tunnel is put back here (in front of the blades) */
   entrance: { x: 0, z: 0.95 },
} as const;

/** Hole 6's turntable: a fixed plate with a spinning bar (README "Turntable"). */
export const TURNTABLE = { x: 0, z: 1.6, plateRadius: 0.9, half: 0.85, omega: 1.2, phase: 0.6 } as const;

// ---------- the holes (original orientation) ----------

const p = (x: number, z: number): P2 => ({ x, z });
/** A closed loop of rails through the points (the last joins the first). */
function loop(points: P2[], e: number = RAIL.e, mu: number = RAIL.mu): Rail[] {
   return points.map((a, i) => ({ a, b: points[(i + 1) % points.length], e, mu, zone: 0, drawn: true }));
}
const rail = (a: P2, b: P2, o: Partial<Rail> = {}): Rail => ({ a, b, e: RAIL.e, mu: RAIL.mu, zone: 0, drawn: true, ...o });

interface HoleSpec {
   name: string;
   par: number;
   tee: P2;
   cup: P2;
   rails: Rail[];
   ponds?: Pond[];
   pipes?: Pipe[];
   windmill?: boolean;
   turntable?: boolean;
   terrain: TerrainKind;
   top: number;
}

function windmillRails(): Rail[] {
   const w = WINDMILL;
   const soft = { e: RAIL.softE, drawn: false };
   const out: Rail[] = [];
   for (const s of [-1, 1]) {
      // the funnel from the lane rail to the tunnel mouth, the tunnel wall, the body's back face and side
      out.push(rail(p(0.8 * s, w.funnelTop), p(w.tunnelHalf * s, 0.75), { e: RAIL.softE }));
      out.push(rail(p(w.tunnelHalf * s, 0.75), p(w.tunnelHalf * s, -0.75), soft));
      out.push(rail(p(w.tunnelHalf * s, -w.halfZ), p(w.halfX * s, -w.halfZ), { drawn: false }));
      out.push(rail(p(w.halfX * s, -w.halfZ), p(w.halfX * s, 0), { drawn: false }));
      out.push(rail(p(w.halfX * s, 0), p(0.8 * s, 0)));
   }
   return out;
}

function pipeRails(): Rail[] {
   const out: Rail[] = [];
   const z = TIER_WALL_Z;
   const dx = MOUTH.guide * Math.sin(MOUTH.splay);
   const dz = MOUTH.guide * Math.cos(MOUTH.splay);
   // the tier wall seen from above: open at the three mouths
   const edges = [-1.5, -1 - MOUTH.half, -1 + MOUTH.half, -MOUTH.half, MOUTH.half, 1 - MOUTH.half, 1 + MOUTH.half, 1.5];
   for (let i = 0; i < edges.length; i += 2) out.push(rail(p(edges[i], z), p(edges[i + 1], z), { zone: 1 }));
   for (const xc of [-1, 0, 1]) {
      out.push(rail(p(xc - MOUTH.half, z), p(xc - MOUTH.half - dx, z + dz), { zone: 1 }));
      out.push(rail(p(xc + MOUTH.half, z), p(xc + MOUTH.half + dx, z + dz), { zone: 1 }));
   }
   // seen from the lower green the wall is whole
   out.push(rail(p(-1.5, z), p(1.5, z), { zone: 2, drawn: false }));
   // the upper tier's and the lower green's side and end rails
   out.push(rail(p(-1.5, 4.5), p(1.5, 4.5), { zone: 1 }), rail(p(-1.5, 4.5), p(-1.5, z), { zone: 1 }), rail(p(1.5, 4.5), p(1.5, z), { zone: 1 }));
   out.push(rail(p(-1.5, z), p(-1.5, -4.5), { zone: 2 }), rail(p(1.5, z), p(1.5, -4.5), { zone: 2 }), rail(p(-1.5, -4.5), p(1.5, -4.5), { zone: 2 }));
   return out;
}

const SPECS: HoleSpec[] = [
   {
      name: "First Putt",
      par: 2,
      tee: p(0, 3.0),
      cup: p(0.15, -2.6),
      rails: loop([p(-0.5, 3.5), p(-0.5, -3.5), p(0.5, -3.5), p(0.5, 3.5)]),
      terrain: "tilt",
      top: 0.8,
   },
   {
      name: "Dogleg",
      par: 2,
      tee: p(0, 3.0),
      cup: p(2.9, -1.0),
      // the 45 deg bank board cuts the outer corner, (-0.5, -0.9) to (0.1, -1.5)
      rails: loop([p(-0.5, 3.5), p(-0.5, -0.9), p(0.1, -1.5), p(3.5, -1.5), p(3.5, -0.5), p(0.5, -0.5), p(0.5, 3.5)]),
      terrain: "flat",
      top: 0.8,
   },
   {
      name: "Ramp Jump",
      par: 3,
      tee: p(0, 2.5),
      cup: p(0.3, -2.8),
      rails: loop([p(-0.6, 3.0), p(-0.6, -4.0), p(0.6, -4.0), p(0.6, 3.0)]),
      terrain: "ramp",
      top: 0.8,
   },
   {
      name: "Windmill",
      par: 3,
      tee: p(0, 2.4),
      cup: p(0.25, -2.0),
      rails: [...loop([p(-0.8, 3.0), p(-0.8, -3.0), p(0.8, -3.0), p(0.8, 3.0)]), ...windmillRails()],
      windmill: true,
      terrain: "flat",
      top: WINDMILL.hubY + WINDMILL.length,
   },
   {
      name: "Pipe Maze",
      par: 3,
      tee: p(0, 4.0),
      cup: p(0.6, -3.0),
      rails: pipeRails(),
      ponds: [{ x0: 0.2, x1: 1.0, z0: -1.6, z1: -1.0 }],
      pipes: [
         { mouth: p(-1, TIER_WALL_Z), exit: p(-1.5, -3.0), dir: p(1, 0), length: 5.0 },
         { mouth: p(0, TIER_WALL_Z), exit: p(0, -4.5), dir: p(0, 1), length: 6.4 },
         { mouth: p(1, TIER_WALL_Z), exit: p(1.5, 0.8), dir: p(-1, 0), length: 1.4 },
      ],
      terrain: "tiers",
      top: 0.8 + TIER_Y,
   },
   {
      name: "Turntable Hill",
      par: 4,
      tee: p(0, 4.5),
      cup: p(0.6, -3.3),
      rails: loop([p(-0.8, 5.0), p(-0.8, 3.5), p(-1.0, 3.5), p(-1.0, -0.3), p(-1.5, -0.3), p(-1.5, -4.2), p(1.5, -4.2), p(1.5, -0.3), p(1.0, -0.3), p(1.0, 3.5), p(0.8, 3.5), p(0.8, 5.0)]),
      ponds: [{ x0: -1.0, x1: 0.0, z0: -3.8, z1: -2.8 }],
      turntable: true,
      terrain: "hill",
      top: 0.8 + HILL.top,
   },
];

export const PARS = SPECS.map((s) => s.par);
export const NAMES = SPECS.map((s) => s.name);
export const PAR_TOTAL = PARS.reduce((a, b) => a + b, 0);

// ---------- build and mirror ----------

const mp = (q: P2, sx: number): P2 => ({ x: q.x * sx, z: q.z });

/** Hole `index` (0-5), mirrored in x when `mirrored`. */
export function buildHole(index: number, mirrored: boolean): Hole {
   const s = SPECS[index];
   const sx = mirrored ? -1 : 1;
   let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
   const rails = s.rails.map((r) => {
      const a = mp(r.a, sx), b = mp(r.b, sx);
      for (const q of [a, b]) {
         x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z);
      }
      return { ...r, a, b };
   });
   return {
      index,
      name: s.name,
      par: s.par,
      mirrored,
      sx,
      tee: mp(s.tee, sx),
      cup: mp(s.cup, sx),
      rails,
      ponds: (s.ponds ?? []).map((q) => (mirrored ? { x0: -q.x1, x1: -q.x0, z0: q.z0, z1: q.z1 } : { ...q })),
      pipes: (s.pipes ?? []).map((q) => ({ mouth: mp(q.mouth, sx), exit: mp(q.exit, sx), dir: mp(q.dir, sx), length: q.length })),
      windmill: s.windmill
         ? { bladeZ: WINDMILL.bladeZ, hubY: WINDMILL.hubY, length: WINDMILL.length, halfWidth: WINDMILL.halfWidth, omega: WINDMILL.omega * sx, phase: WINDMILL.phase * sx }
         : null,
      turntable: s.turntable
         ? { centre: p(TURNTABLE.x * sx, TURNTABLE.z), plateRadius: TURNTABLE.plateRadius, half: TURNTABLE.half, omega: TURNTABLE.omega * sx, phase: TURNTABLE.phase * sx }
         : null,
      terrain: s.terrain,
      box: { x0, x1, z0, z1, top: s.top },
   };
}

/** The run's course: the six holes in order, each mirrored on a seeded bit (64 variants). */
export function generateCourse(seed: number): Hole[] {
   const rng = createRng(seed);
   return SPECS.map((_s, i) => buildHole(i, rng() < 0.5));
}

// ---------- the felt ----------

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * The felt's height under (x, z), or null over hole 3's water gap. Hole 5 answers for the level the
 * ball is on (`upper`); elsewhere the level follows from z.
 */
export function heightAt(hole: Hole, x: number, z: number, upper = false): number | null {
   switch (hole.terrain) {
      case "tilt": {
         const k = clamp01((BREAK.z0 - z) / (BREAK.z0 - BREAK.z1));
         return BREAK.grade * k * (hole.sx * x + 0.5);
      }
      case "ramp":
         if (z >= RAMP.start) return 0;
         if (z >= RAMP.lip) return RAMP.grade * (RAMP.start - z);
         if (z > RAMP.gapEnd) return null;
         return 0;
      case "tiers":
         return upper ? TIER_Y : 0;
      case "hill":
         if (z >= HILL.z0) return HILL.top;
         if (z > HILL.z1) return HILL_GRADE * (z - HILL.z1);
         return 0;
      default:
         return 0;
   }
}

/** The felt's gradient (dh/dx, dh/dz) under (x, z), written to `out`. Zero over the gap. */
export function gradientAt(hole: Hole, x: number, z: number, out: P2): P2 {
   out.x = 0;
   out.z = 0;
   switch (hole.terrain) {
      case "tilt": {
         if (z < BREAK.z0) {
            const span = BREAK.z0 - BREAK.z1;
            const k = clamp01((BREAK.z0 - z) / span);
            out.x = BREAK.grade * k * hole.sx;
            if (k < 1) out.z = -(BREAK.grade / span) * (hole.sx * x + 0.5);
         }
         break;
      }
      case "ramp":
         if (z < RAMP.start && z >= RAMP.lip) out.z = -RAMP.grade;
         break;
      case "hill":
         if (z < HILL.z0 && z > HILL.z1) out.z = HILL_GRADE;
         break;
   }
   return out;
}
