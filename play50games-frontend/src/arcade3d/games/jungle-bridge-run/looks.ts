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

/** The window kept on screen around the aim point: the three lanes, the runner 8 m back, 9.5 m ahead. */
export const VIEW_CONFIG: FittedViewOptions = {
   area: { min: { x: -3.2, y: -0.2, z: -9.2 }, max: { x: 3.2, y: 2.2, z: 9.2 } },
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
const TILE = 2.4;

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
               if (o.plankLane === lane) tiles(rope, LANE_X[lane], o.z, o.z + o.length, 2.0);
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
   return { deck, rope };
}

/** Section gates: one ruin gate per lane at every gate, plus the start line. */
export function gateSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   const at = [RUN_IN_Z, ...run.sections.map((s) => s.gateZ)];
   for (const z of at) for (const x of LANE_X) out.push({ x, y: 0, z });
   return out;
}

export function pillarSpots(run: Run): InstanceSpot[] {
   const out: InstanceSpot[] = [];
   for (const s of run.sections) for (const o of s.obstacles) if (o.kind === "pillar") out.push({ x: LANE_X[o.lane], y: 0, z: o.z, rotY: (o.z * 1.7) % Math.PI });
   return out;
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
   /** river rocks in the water and the canyon walls (jungleRock, 1 m tall: scale = height) */
   rocks: InstanceSpot[];
   /** trees on the canyon rims (1 m tall: scale = height) */
   trees: InstanceSpot[];
   ferns: InstanceSpot[];
   /** hanging vines on the canyon walls (background only) */
   vines: InstanceSpot[];
   /** wooden stilts under the deck (a unit box: sx/sy/sz) */
   stilts: InstanceSpot[];
}

export function decorSpots(id: LevelId, level: JungleLevel): DecorSpots {
   const rng = createRng(7000 + id);
   const out: DecorSpots = { rocks: [], trees: [], ferns: [], vines: [], stilts: [] };
   const z0 = -TRACK_BEFORE - 20;
   const z1 = finishZ(level) + TRACK_AFTER + 40;
   for (const side of [-1, 1]) {
      for (let z = z0; z < z1; z += 9 + rng() * 4) {
         // the canyon wall: a rock rising from the water to just under the deck's level (top <= -0.5),
         // narrowed by its spot (sx / sz) so its inner face stays beyond DECOR_CLEAR_X
         const h = 9 + rng() * 2.5;
         const cx = 13 + rng() * 3;
         out.rocks.push({ x: side * cx, y: WATER_Y, z, rotY: 0, sx: 0.55 * h, sy: h, sz: 0.8 * h });
         const rim = WATER_Y + h * 0.9;
         out.trees.push({ x: side * (cx + 1 + rng() * 3), y: rim - 0.4, z: z + rng() * 6, rotY: rng() * Math.PI * 2, scale: 6 + rng() * 4 });
         out.ferns.push({ x: side * (cx - 1 + rng() * 2), y: rim, z: z + 3 + rng() * 4, rotY: rng() * Math.PI * 2, scale: 1.2 + rng() * 0.8 });
         if (rng() < 0.5) out.vines.push({ x: side * (11 + rng() * 2), y: rim - 4, z: z + rng() * 5, rotY: rng() * Math.PI * 2, scale: 4 + rng() * 2 });
         // river rocks
         if (rng() < 0.6) out.rocks.push({ x: side * (4 + rng() * 6), y: WATER_Y - 0.4, z: z + rng() * 8, rotY: rng() * Math.PI * 2, scale: 1.2 + rng() * 1.5 });
      }
   }
   // stilts under the outer lanes every 6 m, from the deck down into the water
   for (let z = -TRACK_BEFORE + 1; z < finishZ(level) + TRACK_AFTER; z += 6) {
      for (const x of [LANE_X[0] + 0.85, LANE_X[2] - 0.85]) out.stilts.push({ x, y: WATER_Y / 2 - 0.2, z, sx: 0.22, sy: -WATER_Y - 0.3, sz: 0.22 });
   }
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
