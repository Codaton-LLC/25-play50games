// Base palette, per-level station looks (theme → floor / wall / fog + apron scenery), the platform
// looks (colour + shape + number), the follow camera, the station's static spots, the trains'
// timeline and the label atlas layout. Pure: no React, no three.js. Decor boxes are unit cubes
// scaled by their spot (sx / sy / sz), never sized and scaled again.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import type { StationLevel, StationTheme } from "./levels";
import { CONCOURSE_DEPTH, PAD_Z, STATION_END, TRACK_W, concourseHalf, islandX, trackX, type Run } from "./rules";

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
   // apron set pieces (Decor.tsx)
   building: "#64748b",
   buildingDark: "#334155",
   buildingWarm: "#78716c",
   glass: "#7dd3fc",
   tree: "#166534",
   treeTrunk: "#78350f",
   signal: "#ef4444",
   neon: "#38bdf8",
} as const;

/** Floor / wall tones and apron scenery for one station theme. Gameplay accents stay on COLORS. */
export interface StationLook {
   concourse: string;
   concourseTile: string;
   concourseLine: string;
   platform: string;
   platformSide: string;
   edge: string;
   trackBed: string;
   ballast: string;
   wall: string;
   doorGlow: string;
   fogNear: number;
   fogFar: number;
   /** apron set pieces outside the walkable station (Decor.tsx) */
   scenery: "sparse" | "yards" | "hall" | "sunset" | "city";
}

export const LOOKS: Record<StationTheme, StationLook> = {
   // 2 Platforms: today's bright terrazzo branch station.
   local: {
      concourse: COLORS.concourse, concourseTile: COLORS.concourseTile, concourseLine: COLORS.concourseLine,
      platform: COLORS.platform, platformSide: COLORS.platformSide, edge: COLORS.edge,
      trackBed: COLORS.trackBed, ballast: COLORS.ballast, wall: COLORS.wall, doorGlow: COLORS.doorGlow,
      fogNear: 26, fogFar: 60, scenery: "sparse",
   },
   // 4 Platforms: cooler day wash, greyer platforms, yard apron.
   quad: {
      concourse: "#dbeafe", concourseTile: "#bfdbfe", concourseLine: "#93c5fd",
      platform: "#94a3b8", platformSide: "#475569", edge: "#fde047",
      trackBed: "#44403c", ballast: "#292524", wall: "#1e3a5f", doorGlow: "#e0f2fe",
      fogNear: 28, fogFar: 64, scenery: "yards",
   },
   // Central Station: warm indoor marble hall, slate walls, ticket-hall apron.
   central: {
      concourse: "#e7e5e4", concourseTile: "#d6d3d1", concourseLine: "#a8a29e",
      platform: "#a8a29e", platformSide: "#57534e", edge: "#fbbf24",
      trackBed: "#3f3f46", ballast: "#27272a", wall: "#1c1917", doorGlow: "#fef3c7",
      fogNear: 18, fogFar: 48, scenery: "hall",
   },
   // Rush Hour: warm sunset platforms, amber edge strips.
   rush: {
      concourse: "#fed7aa", concourseTile: "#fdba74", concourseLine: "#fb923c",
      platform: "#d6d3d1", platformSide: "#78716c", edge: "#f97316",
      trackBed: "#44403c", ballast: "#1c1917", wall: "#7c2d12", doorGlow: "#ffedd5",
      fogNear: 22, fogFar: 55, scenery: "sunset",
   },
   // Mega Station: cool night slate, bright edge glow, city apron.
   mega: {
      concourse: "#334155", concourseTile: "#1e293b", concourseLine: "#475569",
      platform: "#64748b", platformSide: "#334155", edge: "#facc15",
      trackBed: "#1c1917", ballast: "#0a0a0a", wall: "#020617", doorGlow: "#38bdf8",
      fogNear: 16, fogFar: 42, scenery: "city",
   },
};

export const lookFor = (level: StationLevel): StationLook => LOOKS[level.theme];

/** Shell fog: level background colour with the theme's near / far. */
export const fogOf = (level: StationLevel): [string, number, number] => {
   const look = LOOKS[level.theme];
   return [level.background, look.fogNear, look.fogFar];
};

/** Apron decor stands at least this far past the walkable station edge. */
export const APRON_GAP = 2.2;

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
   const look = LOOKS[level.theme];
   // Central Station: taller hall walls; Mega: taller night facade.
   const backH = look.scenery === "hall" ? 5.6 : look.scenery === "city" ? 5.2 : 4.4;
   const sideH = look.scenery === "hall" || look.scenery === "city" ? 1.4 : 1;
   return [
      { x: 0, y: backH / 2, z: -0.25, sx: half * 2 + 0.6, sy: backH, sz: 0.5 },
      { x: -half - 0.15, y: sideH / 2, z: CONCOURSE_DEPTH / 2, sx: 0.3, sy: sideH, sz: CONCOURSE_DEPTH + 0.4 },
      { x: half + 0.15, y: sideH / 2, z: CONCOURSE_DEPTH / 2, sx: 0.3, sy: sideH, sz: CONCOURSE_DEPTH + 0.4 },
   ];
}

// ---------- apron scenery (visual only; never inside the walkable station) ----------

export interface StationDecor {
   buildings: InstanceSpot[];
   trees: InstanceSpot[];
   signals: InstanceSpot[];
   pillars: InstanceSpot[];
   boards: InstanceSpot[];
   neon: InstanceSpot[];
}

/**
 * Visual-only set pieces that make each station read differently (ticket-hall roof, sunset lanterns,
 * night gantries). Never solids: roofs / beams / lanterns hang above walk height; gantries sit over
 * track beds or past the platforms.
 */
export interface StationSetPieces {
   roofs: InstanceSpot[];
   beams: InstanceSpot[];
   lanterns: InstanceSpot[];
   gantries: InstanceSpot[];
}

/** Over walk height so the worker never clips a set piece. */
export const SET_PIECE_CLEAR_Y = 2.85;

/** Per-theme overhead / platform accents (looks only). Level 1 (`sparse`) has none. */
export function setPieceSpots(level: StationLevel): StationSetPieces {
   const look = LOOKS[level.theme];
   const out: StationSetPieces = { roofs: [], beams: [], lanterns: [], gantries: [] };
   const half = concourseHalf(level);

   if (look.scenery === "hall") {
      // Central Station: indoor ticket-hall vault over the whole concourse + cross beams + hanging lamps.
      out.roofs.push({ x: 0, y: 5.05, z: CONCOURSE_DEPTH / 2, sx: half * 2 + 0.8, sy: 0.18, sz: CONCOURSE_DEPTH + 0.6 });
      for (let i = -2; i <= 2; i++) {
         out.beams.push({ x: i * (half / 2.2), y: 4.7, z: CONCOURSE_DEPTH / 2, sx: 0.22, sy: 0.35, sz: CONCOURSE_DEPTH + 0.2 });
      }
      for (const z of [1.6, 4.0, 6.4]) {
         out.beams.push({ x: 0, y: 4.7, z, sx: half * 2 + 0.4, sy: 0.28, sz: 0.22 });
      }
      // hanging hall lamps under the vault (clear of walk height)
      for (const z of [2.0, 4.2, 6.2]) {
         out.lanterns.push({ x: -half * 0.45, y: 4.15, z, sx: 0.32, sy: 0.4, sz: 0.32 });
         out.lanterns.push({ x: half * 0.45, y: 4.15, z, sx: 0.32, sy: 0.4, sz: 0.32 });
      }
      out.lanterns.push({ x: 0, y: 4.25, z: CONCOURSE_DEPTH / 2, sx: 0.55, sy: 0.5, sz: 0.55 });
      return out;
   }

   if (look.scenery === "sunset") {
      // Rush Hour: warm lanterns along every island lip so the platforms read as a sunset bay.
      for (let k = 0; k < level.platforms / 2; k++) {
         const [x0, x1] = islandX(level, k);
         const cx = (x0 + x1) / 2;
         for (const z of [CONCOURSE_DEPTH + 2.2, CONCOURSE_DEPTH + 5.5, PAD_Z, STATION_END - 1.2]) {
            out.lanterns.push({ x: cx - 1.15, y: 2.95, z, sx: 0.26, sy: 0.34, sz: 0.26 });
            out.lanterns.push({ x: cx + 1.15, y: 2.95, z, sx: 0.26, sy: 0.34, sz: 0.26 });
         }
         // warm lintel over the far canopy (above walk height) so the bay silhouette reads from the camera
         out.beams.push({ x: cx, y: 3.25, z: STATION_END - 0.55, sx: x1 - x0 - 0.4, sy: 0.2, sz: 0.22 });
         out.lanterns.push({ x: cx, y: 3.05, z: STATION_END - 0.55, sx: 0.34, sy: 0.28, sz: 0.34 });
      }
      for (const side of [-1, 1] as const) {
         out.lanterns.push({ x: side * (half - 0.7), y: 3.1, z: 2.2, sx: 0.24, sy: 0.3, sz: 0.24 });
         out.lanterns.push({ x: side * (half - 0.7), y: 3.1, z: 5.5, sx: 0.24, sy: 0.3, sz: 0.24 });
      }
      return out;
   }

   if (look.scenery === "city") {
      // Mega Station: night gantries spanning the track beds past the platforms.
      for (let p = 0; p < level.platforms; p++) {
         const x = trackX(level, p);
         out.gantries.push({ x, y: 3.6, z: STATION_END + 1.4, sx: TRACK_W + 0.4, sy: 0.2, sz: 0.25 });
         out.gantries.push({ x: x - TRACK_W / 2 - 0.1, y: 2.4, z: STATION_END + 1.4, sx: 0.16, sy: 2.4, sz: 0.16 });
         out.gantries.push({ x: x + TRACK_W / 2 + 0.1, y: 2.4, z: STATION_END + 1.4, sx: 0.16, sy: 2.4, sz: 0.16 });
      }
      out.roofs.push({ x: 0, y: 5.4, z: CONCOURSE_DEPTH / 2, sx: half * 2 + 1.0, sy: 0.14, sz: CONCOURSE_DEPTH + 0.4 });
      return out;
   }

   if (look.scenery === "yards") {
      // 4 Platforms: a light yard canopy over the entrance strip only (not the whole hall).
      out.roofs.push({ x: 0, y: 3.6, z: 1.2, sx: half * 1.2, sy: 0.12, sz: 2.4 });
      out.beams.push({ x: -half * 0.55, y: 3.2, z: 1.2, sx: 0.18, sy: 0.8, sz: 0.18 });
      out.beams.push({ x: half * 0.55, y: 3.2, z: 1.2, sx: 0.18, sy: 0.8, sz: 0.18 });
      return out;
   }

   // sparse (L1): no overhead set pieces — today's open branch station.
   return out;
}

/** True when a point sits on the walkable station (concourse or an island), plus margin. */
export function inPlayStation(level: StationLevel, x: number, z: number, margin = 0): boolean {
   const half = concourseHalf(level) + margin;
   if (z >= -margin && z <= CONCOURSE_DEPTH + margin && Math.abs(x) <= half) return true;
   for (let k = 0; k < level.platforms / 2; k++) {
      const [x0, x1] = islandX(level, k);
      if (x >= x0 - margin && x <= x1 + margin && z >= CONCOURSE_DEPTH - margin && z <= STATION_END + margin) return true;
   }
   return false;
}

/** Seeded apron props for one level. Every spot is outside the walkable station by APRON_GAP. */
export function decorSpots(level: StationLevel): StationDecor {
   const look = LOOKS[level.theme];
   const out: StationDecor = { buildings: [], trees: [], signals: [], pillars: [], boards: [], neon: [] };
   const gap = APRON_GAP;
   const half = concourseHalf(level);
   const farZ = STATION_END + gap;

   if (look.scenery === "sparse") {
      // a couple of trees past the platforms so L1 is not a void, still the open branch station
      out.trees.push({ x: -half - gap - 1.2, y: 0, z: CONCOURSE_DEPTH + 4, rotY: 0.3, scale: 1.4 });
      out.trees.push({ x: half + gap + 1.2, y: 0, z: CONCOURSE_DEPTH + 6, rotY: -0.4, scale: 1.5 });
      out.signals.push({ x: 0, y: 0, z: farZ + 1.5, rotY: 0, sx: 0.35, sy: 3.2, sz: 0.35 });
      return out;
   }

   if (look.scenery === "yards") {
      // signal boxes and trees framing the four-platform yard
      for (const side of [-1, 1] as const) {
         out.buildings.push({ x: side * (half + gap + 2.2), y: 0, z: CONCOURSE_DEPTH + 3, rotY: side > 0 ? -0.2 : 0.2, sx: 3.2, sy: 2.4, sz: 2.4 });
         out.buildings.push({ x: side * (half + gap + 2.0), y: 0, z: CONCOURSE_DEPTH + 9, rotY: 0, sx: 2.6, sy: 2.0, sz: 2.2 });
         out.trees.push({ x: side * (half + gap + 0.9), y: 0, z: 3.5, rotY: side * 0.5, scale: 1.3 });
         out.signals.push({ x: side * (half + gap + 0.6), y: 0, z: farZ + 0.8, rotY: 0, sx: 0.3, sy: 3.4, sz: 0.3 });
      }
      out.trees.push({ x: -3, y: 0, z: farZ + 2.2, rotY: 0.7, scale: 1.6 });
      out.trees.push({ x: 4, y: 0, z: farZ + 1.8, rotY: -0.3, scale: 1.4 });
      return out;
   }

   if (look.scenery === "hall") {
      // ticket-hall pillars flanking the entrance wall, big departure board, city blocks behind
      out.pillars.push({ x: -2.6, y: 0, z: -gap - 0.4, rotY: 0, sx: 0.55, sy: 4.2, sz: 0.55 });
      out.pillars.push({ x: 2.6, y: 0, z: -gap - 0.4, rotY: 0, sx: 0.55, sy: 4.2, sz: 0.55 });
      out.pillars.push({ x: -half - gap - 0.3, y: 0, z: 3.5, rotY: 0, sx: 0.5, sy: 3.8, sz: 0.5 });
      out.pillars.push({ x: half + gap + 0.3, y: 0, z: 3.5, rotY: 0, sx: 0.5, sy: 3.8, sz: 0.5 });
      out.pillars.push({ x: -half - gap - 0.3, y: 0, z: 6.5, rotY: 0, sx: 0.5, sy: 3.8, sz: 0.5 });
      out.pillars.push({ x: half + gap + 0.3, y: 0, z: 6.5, rotY: 0, sx: 0.5, sy: 3.8, sz: 0.5 });
      out.boards.push({ x: 0, y: 3.4, z: -gap - 0.55, rotY: 0, sx: 4.8, sy: 1.4, sz: 0.18 });
      out.boards.push({ x: -5.2, y: 2.6, z: -gap - 0.5, rotY: 0, sx: 2.2, sy: 1.0, sz: 0.14 });
      out.boards.push({ x: 5.2, y: 2.6, z: -gap - 0.5, rotY: 0, sx: 2.2, sy: 1.0, sz: 0.14 });
      for (const side of [-1, 1] as const) {
         out.buildings.push({ x: side * (half + gap + 3.0), y: 0, z: 2, rotY: 0, sx: 4.0, sy: 5.5, sz: 3.2 });
         out.buildings.push({ x: side * (half + gap + 2.6), y: 0, z: 10, rotY: 0.1 * side, sx: 3.4, sy: 4.2, sz: 2.8 });
      }
      out.buildings.push({ x: -4, y: 0, z: -gap - 3.5, rotY: 0, sx: 5.0, sy: 6.0, sz: 2.5 });
      out.buildings.push({ x: 5, y: 0, z: -gap - 3.2, rotY: 0, sx: 4.2, sy: 5.2, sz: 2.4 });
      return out;
   }

   if (look.scenery === "sunset") {
      // warm low buildings, platform signals and a sunset notice board for Rush Hour
      for (const side of [-1, 1] as const) {
         out.buildings.push({ x: side * (half + gap + 2.4), y: 0, z: 4, rotY: 0, sx: 3.6, sy: 2.2, sz: 2.8 });
         out.buildings.push({ x: side * (half + gap + 2.8), y: 0, z: 12, rotY: 0.15 * side, sx: 4.0, sy: 1.8, sz: 3.0 });
         out.buildings.push({ x: side * (half + gap + 3.4), y: 0, z: 8, rotY: 0.08 * side, sx: 2.8, sy: 1.5, sz: 2.2 });
         out.signals.push({ x: side * (half * 0.35), y: 0, z: farZ + 1.2, rotY: 0, sx: 0.28, sy: 3.6, sz: 0.28 });
         out.signals.push({ x: side * (half * 0.7), y: 0, z: farZ + 0.6, rotY: 0, sx: 0.26, sy: 3.2, sz: 0.26 });
         out.trees.push({ x: side * (half + gap + 1.0), y: 0, z: CONCOURSE_DEPTH + 1.5, rotY: side * 0.4, scale: 1.2 });
      }
      out.boards.push({ x: 0, y: 2.8, z: -gap - 0.4, rotY: 0, sx: 3.6, sy: 0.9, sz: 0.14 });
      out.boards.push({ x: 0, y: 2.2, z: farZ + 0.5, rotY: 0, sx: 2.8, sy: 0.7, sz: 0.12 });
      return out;
   }

   // city: dense night skyline behind and beside the mega terminal, neon strips
   for (let i = -3; i <= 3; i++) {
      const h = 4.5 + (Math.abs(i) % 3) * 1.4 + (i === 0 ? 2.2 : 0);
      out.buildings.push({ x: i * 3.4, y: 0, z: -gap - 3.8, rotY: 0, sx: 2.8, sy: h, sz: 2.6 });
   }
   for (const side of [-1, 1] as const) {
      for (let k = 0; k < 4; k++) {
         out.buildings.push({
            x: side * (half + gap + 2.5 + (k % 2) * 1.2),
            y: 0,
            z: 2 + k * 4.2,
            rotY: 0,
            sx: 3.0 + (k % 2),
            sy: 3.8 + k * 0.7,
            sz: 2.4,
         });
      }
      out.neon.push({ x: side * (half + gap + 0.5), y: 2.4, z: CONCOURSE_DEPTH / 2, rotY: 0, sx: 0.12, sy: 0.18, sz: CONCOURSE_DEPTH * 0.7 });
      out.signals.push({ x: side * (half * 0.55), y: 0, z: farZ + 1.0, rotY: 0, sx: 0.32, sy: 4.0, sz: 0.32 });
   }
   out.boards.push({ x: 0, y: 3.6, z: -gap - 0.5, rotY: 0, sx: 5.6, sy: 1.6, sz: 0.2 });
   out.neon.push({ x: 0, y: 4.6, z: -gap - 0.35, rotY: 0, sx: 5.0, sy: 0.12, sz: 0.12 });
   return out;
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
