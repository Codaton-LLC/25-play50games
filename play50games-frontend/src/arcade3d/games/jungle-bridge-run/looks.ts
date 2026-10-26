// Jungle Bridge Run: palette, camera and the pure spot builders (no React, no three.js).
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import type { JungleLevel } from "./levels";
import { GAP_LEN, LANE_X, RUN_IN_Z, SECTION_LEN, finishZ, type Run } from "./rules";

export const COLORS = {
   planks: "#a16207",
   planksDark: "#78350f",
   moss: "#4d7c0f",
   foliage: "#15803d",
   foliageDark: "#166534",
   water: "#0e7490",
   waterDeep: "#155e75",
   accent: "#22c55e",
   stone: "#78716c",
   stoneDark: "#57534e",
   gem: "#22d3ee",
   gemGlow: "#06b6d4",
   lava: "#ef4444",
   lavaGlow: "#f97316",
   lavaRock: "#1c1917",
   logBark: "#854d0e",
   rope: "#b45309",
   vine: "#3f6212",
   vineLeaf: "#65a30d",
   cliff: "#44403c",
} as const;

// ---------- camera: behind and above, pitch 28°, 8 m look-ahead, x fixed on the track centre ----------

export const PITCH = (28 * Math.PI) / 180;
export const LOOK_AHEAD_Z = 8;
export const FOV = 50;
/** yaw π: the camera sits on -z of its aim and looks along +z, the way the runner runs */
export const CAMERA_YAW = Math.PI;
/** Placeholder pose until the fit runs (behind, above). */
export const CAMERA_OFFSET: [number, number, number] = [0, 5.6, -10.5];

/**
 * The window kept on screen around the aim point (the runner is LOOK_AHEAD_Z = 8 m behind the aim):
 * the three lanes from 3 m behind the runner (so the runner stands well above the bottom edge, the
 * cookie banner and the home indicator) to 10 m past the aim.
 */
export const VIEW_CONFIG: FittedViewOptions = {
   area: { min: { x: -3.2, y: -0.2, z: -11 }, max: { x: 3.2, y: 2.2, z: 10 } },
   // the camera looks at the aim itself (CameraRig follow = aim), the origin of this window
   focus: [{ x: 0, y: 0, z: 0 }],
   pitch: PITCH,
   yaws: [CAMERA_YAW],
   fov: FOV,
   padding: 6,
   shift: true,
   margin: { top: 0.03, right: 0.02, bottom: 0.03, left: 0.02 },
};

export function fogConfigFor(level: JungleLevel): [string, number, number] {
   return [level.background, Math.max(12, level.fogFar - 30), level.fogFar];
}

// ---------- track spots ----------

/** Track from behind the start to past the finish (m). */
export const TRACK_BEFORE = 14;
export const TRACK_AFTER = 16;
/** Deck pieces are at most this long (a woodenBridge GLB is 1.9 units: a piece stretches it at most ~2.5x). */
export const TILE = 4.8;

function tiles(out: InstanceSpot[], x: number, z0: number, z1: number, max = TILE): void {
   const len = z1 - z0;
   if (len <= 0.05) return;
   const n = Math.max(1, Math.ceil(len / max - 1e-9));
   const l = len / n;
   for (let i = 0; i < n; i++) out.push({ x, y: 0, z: z0 + (i + 0.5) * l, sz: l });
}

/**
 * Plank lanes (`deck`) and rope bridges (`rope`), as 1 m pieces stretched by `sz`: every lane from
 * behind the start to past the finish, except a gap's hole and the lanes a bridge leaves open.
 */
export function trackSpots(run: Run): { deck: InstanceSpot[]; rope: InstanceSpot[] } {
   const deck: InstanceSpot[] = [];
   const rope: InstanceSpot[] = [];
   const end = finishZ(run.level) + TRACK_AFTER;
   for (let lane = 0; lane < 3; lane++) {
      const holes: [number, number][] = [];
      for (const sec of run.sections) {
         for (const o of sec.obstacles) {
            if (o.kind === "gap" && o.lanes.includes(lane)) holes.push([o.z, o.z + o.length]);
            if (o.kind === "bridge") {
               holes.push([o.z, o.z + o.length]);
               if (o.plankLane === lane) tiles(rope, LANE_X[lane], o.z, o.z + o.length, 2.7);
            }
         }
      }
      holes.sort((a, b) => a[0] - b[0]);
      let z = -TRACK_BEFORE;
      for (const [a, b] of holes) {
         tiles(deck, LANE_X[lane], z, a);
         z = Math.max(z, b);
      }
      tiles(deck, LANE_X[lane], z, end);
   }
   deck.sort(byZ);
   rope.sort(byZ);
   return { deck, rope };
}

const byZ = (a: InstanceSpot, b: InstanceSpot) => a.z - b.z;

// ---------- what is drawn: only the stretch the camera can see ----------

/** Drawn behind the runner (the camera's bottom edge is ~3 m back) */
export const VISIBLE_BACK = 6;
/** Drawn ahead of the runner: the fog's far end seen from the chase camera, 12+ m behind it (view.test.ts) */
export const visibleAhead = (level: JungleLevel): number => level.fogFar - 12;

/** First index of a z-sorted list at or after z (binary search). */
export function firstAtOrAfter(sorted: readonly InstanceSpot[], z: number): number {
   let lo = 0;
   let hi = sorted.length;
   while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid].z < z) lo = mid + 1;
      else hi = mid;
   }
   return lo;
}

/**
 * The most spots of a z-sorted list that ever lie in a window [z - back - reach, z + ahead + reach]
 * (reach = a spot's half length or half depth): the pool size that draws the visible stretch.
 */
export function poolSize(sorted: readonly InstanceSpot[], back: number, ahead: number, reach = 0): number {
   let best = 0;
   let j = 0;
   const span = back + ahead + 2 * reach;
   for (let i = 0; i < sorted.length; i++) {
      while (sorted[i].z - sorted[j].z > span) j++;
      best = Math.max(best, i - j + 1);
   }
   return best;
}

/** Section gates: one ruin gate per lane at every gate, plus the start line. */
export function gateSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const at = [RUN_IN_Z, ...run.sections.map((s) => s.gateZ)];
   for (const z of at) for (const x of LANE_X) out.push({ x, y: 0, z });
   return out;
}

/**
 * The gate row the runner is passing fades to 25 %: from 4 m before it (the lintel over the head) until
 * 4 m past it (the chase camera behind and above looks through the row at the runner's back; view.test.ts
 * checks that 4 m covers every screen's camera).
 */
export const GATE_FADE_BEFORE = 4;
export const GATE_FADE_AFTER = 4;
export const GATE_FADE_MIN = 0.25;
const GATE_FADE_EASE = 0.8;
/** Opacity of a gate row at gateZ for a runner at runnerZ (1 = solid). */
export function gateOpacity(gateZ: number, runnerZ: number): number {
   const d = gateZ - runnerZ; // > 0: the gate is still ahead
   const out = d > 0 ? d - GATE_FADE_BEFORE : -d - GATE_FADE_AFTER; // metres outside the faded stretch
   if (out <= 0) return GATE_FADE_MIN;
   return GATE_FADE_MIN + (1 - GATE_FADE_MIN) * Math.min(1, out / GATE_FADE_EASE);
}

export function pillarSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const s of run.sections) for (const o of s.obstacles) if (o.kind === "pillar") out.push({ x: LANE_X[o.lane], y: 0, z: o.z, rotY: (o.z * 1.7) % Math.PI });
   return out.sort(byZ);
}

/** Vine bars: one per covered lane, a 2 m rope (unit cylinder along x scaled by sx) 1.05 m up. */
export function vineSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const s of run.sections) for (const o of s.obstacles) if (o.kind === "vine") for (const l of o.lanes) out.push({ x: LANE_X[l], y: 1.05, z: o.z });
   return out;
}

export function lavaSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const s of run.sections) for (const o of s.obstacles) if (o.kind === "lava") out.push({ x: LANE_X[o.lane], y: 0.02, z: o.z });
   return out;
}

// ---------- canyon decor: below the deck or well to the side, never between the camera and the runner ----------

/** Water level, 12 m under the deck (spec). */
export const WATER_Y = -12;
/** Nothing decorative stands inside |x| < DECOR_CLEAR_X above the deck. */
export const DECOR_CLEAR_X = 7;

export interface DecorSpots {
   /** river rocks in the water and the canyon walls (jungleRock, 1 m tall: sx / sy / sz or scale = size) */
   rocks: InstanceSpot[];
   /** trees on the canyon rims (1 m tall: scale = height) */
   trees: InstanceSpot[];
   ferns: InstanceSpot[];
   /** hanging vines on the canyon walls (background only) */
   vines: InstanceSpot[];
   /** wooden stilts under the deck (a unit box: sx/sy/sz) */
   stilts: InstanceSpot[];
}

/**
 * The canyon is one seeded band DECOR_PERIOD long (z in [0, DECOR_PERIOD)); the scene wraps every copy
 * into the visible stretch (decorZ), so the drawn count is the band's, not the course's.
 */
export const DECOR_PERIOD = 72;

/** Where a band copy at base z is drawn for a runner at runnerZ: in [runnerZ - VISIBLE_BACK - 6, + DECOR_PERIOD). */
export function decorZ(baseZ: number, runnerZ: number): number {
   const start = runnerZ - VISIBLE_BACK - 6;
   return start + ((((baseZ - start) % DECOR_PERIOD) + DECOR_PERIOD) % DECOR_PERIOD);
}

export function decorSpots(id: LevelId, level: JungleLevel): DecorSpots {
   void level;
   const rng = createRng(7000 + id);
   const out: DecorSpots = { rocks: [], trees: [], ferns: [], vines: [], stilts: [] };
   for (const side of [-1, 1]) {
      for (let z = side < 0 ? 0 : 6; z < DECOR_PERIOD; z += 12) {
         // the canyon wall: a rock rising from the water to just under the deck's level (top <= -0.5),
         // narrowed by its spot (sx / sz) so its inner face stays beyond DECOR_CLEAR_X
         const h = 9 + rng() * 2.5;
         const cx = 13 + rng() * 3;
         out.rocks.push({ x: side * cx, y: WATER_Y, z, rotY: 0, sx: 0.55 * h, sy: h, sz: 0.8 * h });
         const rim = WATER_Y + h * 0.9;
         out.trees.push({ x: side * (cx + 1 + rng() * 3), y: rim - 0.4, z: z + rng() * 6, rotY: rng() * Math.PI * 2, scale: 6 + rng() * 4 });
         if (rng() < 0.6) out.ferns.push({ x: side * (cx - 1 + rng() * 2), y: rim, z: z + 3 + rng() * 4, rotY: rng() * Math.PI * 2, scale: 1.2 + rng() * 0.8 });
         if (rng() < 0.45) out.vines.push({ x: side * (11 + rng() * 2), y: rim - 4, z: z + rng() * 5, rotY: rng() * Math.PI * 2, scale: 4 + rng() * 2 });
         // river rocks
         if (rng() < 0.5) out.rocks.push({ x: side * (4 + rng() * 6), y: WATER_Y - 0.4, z: z + rng() * 8, rotY: rng() * Math.PI * 2, scale: 1.2 + rng() * 1.5 });
      }
   }
   // stilts under the outer lanes every 6 m, from the deck down into the water
   for (let z = 1; z < DECOR_PERIOD; z += 6) {
      for (const x of [LANE_X[0] + 0.85, LANE_X[2] - 0.85]) out.stilts.push({ x, y: WATER_Y / 2 - 0.2, z, sx: 0.22, sy: -WATER_Y - 0.3, sz: 0.22 });
   }
   for (const list of Object.values(out)) for (const spot of list) spot.z = ((spot.z % DECOR_PERIOD) + DECOR_PERIOD) % DECOR_PERIOD;
   return out;
}

/** The backdrop that rides ahead of the camera (L3 waterfall to the right, L5 volcano ahead): no fog wall at the end. */
export interface Backdrop {
   kind: "waterfall" | "volcano";
   x: number;
   y: number;
   dz: number;
   scale: number;
   rotY: number;
}

export function backdropFor(level: JungleLevel): Backdrop | null {
   // beside the track (never over it), far enough to be hazy, near enough to read through the fog
   if (level.patterns.includes("lava")) return { kind: "volcano", x: 26, y: WATER_Y, dz: level.fogFar * 0.8, scale: 24, rotY: 0 };
   if (level.patterns.includes("log") && level.lighting === "day") return { kind: "waterfall", x: -22, y: WATER_Y, dz: level.fogFar * 0.55, scale: 20, rotY: Math.PI / 2 };
   return null;
}

/** Sections of 24 m; exported for tests of the gap/deck consistency. */
export const TRACK = { SECTION_LEN, GAP_LEN };
