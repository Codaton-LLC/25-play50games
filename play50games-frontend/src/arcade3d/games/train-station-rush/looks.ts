// One palette, the platform looks (colour + shape + number, never colour alone), the follow camera,
// the station's static spots, the trains' timeline and the label atlas layout. Pure: no React, no
// three.js. Decor boxes are unit cubes scaled by their spot (sx / sy / sz), never sized and scaled again.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import type { StationLevel } from "./levels";
import { CONCOURSE_DEPTH, STATION_END, TRACK_W, concourseHalf, islandX, trackX, type Run } from "./rules";

export const COLORS = {
   concourse: "#e2e8f0",
   concourseTile: "#cbd5e1",
   concourseLine: "#94a3b8",
   platform: "#cbd5e1",
   platformSide: "#64748b",
   edge: "#facc15",
   trackBed: "#57534e",
   ballast: "#44403c",
   rail: "#a8a29e",
   sleeper: "#3f3f46",
   wall: "#334155",
   wallTrim: "#1e293b",
   accent: "#38bdf8",
   glow: "#fef9c3",
   loco: "#0ea5e9",
   locoDark: "#0c4a6e",
   locoWindow: "#0f172a",
   locoStripe: "#facc15",
   buffer: "#dc2626",
   label: "#f8fafc",
   ring: "#38bdf8",
   ok: "#4ade80",
   dim: "#94a3b8",
   vest: "#f97316",
   trousers: "#1e293b",
   skin: "#f1d0b4",
   suitcase: "#0f766e",
   backpack: "#0e7490",
   doorGlow: "#bae6fd",
} as const;

export type PlatformShape = "circle" | "square" | "triangle" | "diamond" | "star" | "drop";

/** Platform p's look (spec): blue circle, green square, orange triangle, purple diamond, red star, teal drop. */
export const PLATFORM_LOOKS: readonly { color: string; shape: PlatformShape; name: string }[] = [
   { color: "#3b82f6", shape: "circle", name: "blue circle" },
   { color: "#22c55e", shape: "square", name: "green square" },
   { color: "#f97316", shape: "triangle", name: "orange triangle" },
   { color: "#a855f7", shape: "diamond", name: "purple diamond" },
   { color: "#ef4444", shape: "star", name: "red star" },
   { color: "#14b8a6", shape: "drop", name: "teal drop" },
];
export const platformLook = (p: number) => PLATFORM_LOOKS[p % PLATFORM_LOOKS.length];

/** Track beds are this far below the floor (looks only: the rules are flat). */
export const BED_DEPTH = 0.55;

// ---------- camera ----------

export const PITCH = (58 * Math.PI) / 180;
/** Yaw 0: the camera stands past the platforms' far ends and looks up them at the concourse. */
export const YAW = 0;
export const FOV = 45;
export const LOOK_Y = 0;
export const DAMPING = 4;

/** The part of the station kept on screen around the worker: landscape the whole depth, about two islands wide; portrait narrower and shorter. */
export const windowHalf = (portrait: boolean) => (portrait ? { x: 4.8, z: 6.6 } : { x: 8.8, z: (STATION_END + 1) / 2 });

export function windowBox(portrait: boolean): AABB {
   const w = windowHalf(portrait);
   return { min: { x: -w.x, y: 0, z: -0.6 }, max: { x: w.x, y: 2.6, z: -0.6 + w.z * 2 } };
}

export function restLook(portrait: boolean): [number, number, number] {
   const w = windowHalf(portrait);
   return [0, LOOK_Y, -0.6 + w.z];
}

/** Where the look point may go: it never shows past the concourse's ends or the platforms' ends. */
export function lookBounds(level: StationLevel, portrait: boolean): AABB {
   const w = windowHalf(portrait);
   const half = concourseHalf(level);
   const x = Math.max(0, half + 0.6 - w.x);
   const z0 = -0.6 + w.z;
   const z1 = Math.max(z0, STATION_END + 0.6 - w.z);
   return { min: { x: -x, y: LOOK_Y, z: z0 }, max: { x, y: LOOK_Y, z: z1 } };
}

const VIEWS = new Map<string, FittedViewOptions>();

export function viewFor(id: LevelId, portrait: boolean): FittedViewOptions {
   const key = `${id}:${portrait}`;
   let view = VIEWS.get(key);
   if (!view) {
      const [x, y, z] = restLook(portrait);
      view = {
         area: windowBox(portrait),
         pitch: PITCH,
         yaws: [YAW],
         focus: [{ x, y, z }],
         margin: { top: 0.06, right: 0.02, bottom: 0.03, left: 0.02 },
         padding: 6,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(key, view);
   }
   return view;
}

// ---------- static spots ----------

/** The island tops and their vertical sides down to the track beds (unit cubes). */
export function islandSpots(level: StationLevel): { tops: InstanceSpot[]; sides: InstanceSpot[]; edges: InstanceSpot[] } {
   const tops: InstanceSpot[] = [];
   const sides: InstanceSpot[] = [];
   const edges: InstanceSpot[] = [];
   const len = STATION_END - CONCOURSE_DEPTH;
   const zc = (CONCOURSE_DEPTH + STATION_END) / 2;
   for (let k = 0; k < level.platforms / 2; k++) {
      const [x0, x1] = islandX(level, k);
      tops.push({ x: (x0 + x1) / 2, y: -0.01, z: zc, sx: x1 - x0, sy: 0.02, sz: len });
      sides.push({ x: (x0 + x1) / 2, y: -BED_DEPTH / 2 - 0.01, z: zc, sx: x1 - x0, sy: BED_DEPTH, sz: len });
      for (const x of [x0 + 0.12, x1 - 0.12]) edges.push({ x, y: 0.004, z: zc, sx: 0.24, sy: 0.01, sz: len });
   }
   return { tops, sides, edges };
}

/** Rails and sleepers in every track bed (unit cubes). */
export function trackSpots(level: StationLevel): { rails: InstanceSpot[]; sleepers: InstanceSpot[]; buffers: InstanceSpot[] } {
   const rails: InstanceSpot[] = [];
   const sleepers: InstanceSpot[] = [];
   const buffers: InstanceSpot[] = [];
   const z0 = CONCOURSE_DEPTH;
   const z1 = STATION_END + 30;
   for (let p = 0; p < level.platforms; p++) {
      const x = trackX(level, p);
      for (const dx of [-0.72, 0.72]) rails.push({ x: x + dx, y: -BED_DEPTH + 0.08, z: (z0 + z1) / 2, sx: 0.08, sy: 0.12, sz: z1 - z0 });
      for (let z = z0 + 0.6; z < z1; z += 0.9) sleepers.push({ x, y: -BED_DEPTH + 0.02, z, sx: TRACK_W - 0.5, sy: 0.06, sz: 0.24 });
      buffers.push({ x, y: -BED_DEPTH + 0.45, z: z0 + 0.15, sx: TRACK_W - 0.6, sy: 0.9, sz: 0.3 });
   }
   return { rails, sleepers, buffers };
}

/** Walls: the tall entrance wall behind the concourse, low side walls (unit cubes). */
export function wallSpots(level: StationLevel): InstanceSpot[] {
   const half = concourseHalf(level);
   return [
      { x: 0, y: 2.2, z: -0.25, sx: half * 2 + 0.6, sy: 4.4, sz: 0.5 },
      { x: -half - 0.15, y: 0.5, z: CONCOURSE_DEPTH / 2, sx: 0.3, sy: 1, sz: CONCOURSE_DEPTH + 0.4 },
      { x: half + 0.15, y: 0.5, z: CONCOURSE_DEPTH / 2, sx: 0.3, sy: 1, sz: CONCOURSE_DEPTH + 0.4 },
   ];
}

// ---------- trains ----------

/** Where a train's nose stops (z) and how far out an arriving one starts. */
export const NOSE_Z = CONCOURSE_DEPTH + 0.45;
export const ARRIVE_DIST = 46;
export const DEPART_ACCEL = 5;
export const LOCO_LEN = 4.6;
export const CAR_GAP = 0.3;

/**
 * Platform p's train at time t: the nose's distance past NOSE_Z (0 = stopped), or -1 when no train is
 * there. An open task's train slides in over arriveS (ease-out) and waits; a resolved one pulls out
 * from its doneAt, accelerating. Looks only.
 */
export function trainOffset(run: Run, p: number, t: number): number {
   let last = -1;
   for (let i = 0; i < run.tasks.length; i++) {
      const task = run.tasks[i];
      if (task.platform !== p) continue;
      if (task.state === "open" || task.state === "taken") {
         if (t >= task.arriveAt) return 0;
         const k = Math.max(0, Math.min(1, (t - task.openAt) / Math.max(1e-6, task.arriveAt - task.openAt)));
         return ARRIVE_DIST * (1 - k) ** 3;
      }
      if (task.doneAt >= 0 && (last < 0 || task.doneAt > run.tasks[last].doneAt)) last = i;
   }
   if (last < 0) return -1;
   const dt = t - run.tasks[last].doneAt;
   const off = 0.5 * DEPART_ACCEL * dt * dt;
   return off > ARRIVE_DIST ? -1 : off;
}

// ---------- the label atlas ----------

/** One canvas: cells 0..5 the platforms' plates (colour + shape + number). */
export const ATLAS = { width: 1024, height: 256, cols: 4, rows: 2 } as const;

export function cellUv(cell: number): [number, number, number, number] {
   const col = cell % ATLAS.cols;
   const row = Math.floor(cell / ATLAS.cols);
   return [col / ATLAS.cols, 1 - (row + 1) / ATLAS.rows, (col + 1) / ATLAS.cols, 1 - row / ATLAS.rows];
}

export function cellPx(cell: number): { x: number; y: number; w: number; h: number } {
   const w = ATLAS.width / ATLAS.cols;
   const h = ATLAS.height / ATLAS.rows;
   return { x: (cell % ATLAS.cols) * w, y: Math.floor(cell / ATLAS.cols) * h, w, h };
}

export interface LabelQuad {
   c: [number, number, number];
   right: [number, number, number];
   up: [number, number, number];
   w: number;
   h: number;
   cell: number;
}
