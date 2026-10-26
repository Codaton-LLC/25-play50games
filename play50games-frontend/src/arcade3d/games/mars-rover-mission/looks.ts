// Mars Rover Mission: one palette, the follow view, fog per level and the decor spots. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { GLB_SIZE } from "./assets";
import { LEVELS, type MarsLevel } from "./levels";

export const COLORS = {
   /** rust / ochre regolith, not a saturated red */
   ground: "#b4532a",
   groundDark: "#8a3b1e",
   groundLight: "#c2703d",
   groundDust: "#d08a55",
   tracks: "#7c2d12",
   accent: "#f97316",
   skyTop: "#7c2d12",
   skyBottom: "#fdba74",
   spaceTop: "#020617",
   spaceBottom: "#1e1b4b",
   basePad: "#38bdf8",
   basePadActive: "#22d3ee",
   siteRing: "#f97316",
   siteRingActive: "#fde047",
   siteRingScanned: "#22c55e",
   chargerPad: "#22c55e",
   chargerPadActive: "#86efac",
   lane: "#8a3b1e",
   rock: "#b45309",
   boulder: "#7c2d12",
   mesa: "#9a3412",
   rover: "#ea580c",
   roverWheel: "#1c1917",
   roverMetal: "#cbd5e1",
   sampleGlow: "#fbbf24",
} as const;

export const PITCH = (46 * Math.PI) / 180;
export const FOV = 48;
export const LOOK_AHEAD = 3.5;
export const DAMPING = 4;

export function plainBounds(level: MarsLevel): AABB {
   return { min: { x: -level.width / 2, y: 0, z: -level.depth / 2 }, max: { x: level.width / 2, y: 2, z: level.depth / 2 } };
}

/** Half size of the window the follow camera keeps on screen around its aim (a phone in portrait fits its width). */
export const VIEW_WINDOW = { x: 6.5, z: 6 } as const;

const VIEWS = new Map<LevelId, FittedViewOptions>();

export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: { min: { x: -VIEW_WINDOW.x, y: 0, z: -VIEW_WINDOW.z }, max: { x: VIEW_WINDOW.x, y: 2, z: VIEW_WINDOW.z } },
         pitch: PITCH,
         yaws: [0],
         fov: FOV,
         margin: { top: 0.04, right: 0.02, bottom: 0.04, left: 0.02 },
         padding: 6,
         shift: true,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Where the camera may aim: the plain shrunk by most of the window, so the walls frame the view. */
export function aimBounds(level: MarsLevel): AABB {
   const hx = Math.max(0, level.width / 2 - VIEW_WINDOW.x + 2);
   const hz = Math.max(0, level.depth / 2 - VIEW_WINDOW.z + 2);
   return { min: { x: -hx, y: 0, z: -hz }, max: { x: hx, y: 2, z: hz } };
}

/** Dust-coloured fog per level (the level's spec background stays behind the sky dome). */
export const FOG_COLOR: Record<LevelId, string> = { 1: "#e0a173", 2: "#d68f5c", 3: "#b8693a", 4: "#b8693a", 5: "#1e1b4b" };
/** Where the fog may start at the nearest (m) and how deep it is: L4's dust storm is the shortest. */
export const FOG_NEAR_MIN: Record<LevelId, number> = { 1: 26, 2: 26, 3: 24, 4: 12, 5: 30 };
export const FOG_SPAN: Record<LevelId, number> = { 1: 54, 2: 54, 3: 40, 4: 18, 5: 60 };

/**
 * Fog from the fitted camera: it starts past the aim (camera distance + half the window), so the rover and
 * the near half of the view are never fogged on any screen (a portrait phone fits from farther back), and
 * keeps the level's depth: L4's dust storm thickens quickest.
 */
export function fogRange(id: LevelId, distance: number): { near: number; far: number } {
   const near = Math.max(FOG_NEAR_MIN[id], distance + VIEW_WINDOW.z * 0.5);
   return { near, far: near + FOG_SPAN[id] };
}

/** The environment's fog (before the camera is fitted; the Scene moves it with fogRange). */
export function fogFor(_level: MarsLevel, id: LevelId): [string, number, number] {
   return [FOG_COLOR[id], FOG_NEAR_MIN[id], FOG_NEAR_MIN[id] + FOG_SPAN[id]];
}

export const SKY: Record<LevelId, { top: string; bottom: string }> = {
   1: { top: "#9a3412", bottom: "#fdba74" },
   2: { top: "#9a3412", bottom: "#fb923c" },
   3: { top: "#431407", bottom: "#f97316" },
   4: { top: "#7c2d12", bottom: "#c2410c" },
   5: { top: COLORS.spaceTop, bottom: COLORS.spaceBottom },
};

// ---------- decor (outside the plain; nothing stands between the camera and the rover) ----------

/** The south wall is on the camera's side: it stays this low. */
export const SOUTH_WALL_H = 0.5;
const WALL_PIECE = 4;
const WALL_H = (GLB_SIZE.marsMesaRock.height / GLB_SIZE.marsMesaRock.depth) * WALL_PIECE;
const WALL_W = (GLB_SIZE.marsMesaRock.width / GLB_SIZE.marsMesaRock.depth) * WALL_PIECE;

/** Boundary wall pieces (marsMesaRock fitted to 1 m along its length), their inner faces on the boundary. */
export function wallSpots(level: MarsLevel): InstanceSpot[] {
   const hx = level.width / 2;
   const hz = level.depth / 2;
   const spots: InstanceSpot[] = [];
   const nx = Math.ceil(level.width / WALL_PIECE) + 2;
   for (let i = 0; i < nx; i++) {
      const x = -hx - WALL_PIECE + (i + 0.5) * ((level.width + 2 * WALL_PIECE) / nx);
      spots.push({ x, y: 0, z: -hz - WALL_W / 2, rotY: Math.PI / 2, scale: WALL_PIECE });
      spots.push({ x, y: 0, z: hz + WALL_W / 2, rotY: Math.PI / 2, sx: WALL_PIECE, sy: (SOUTH_WALL_H / WALL_H) * WALL_PIECE, sz: WALL_PIECE });
   }
   const nz = Math.ceil(level.depth / WALL_PIECE);
   for (let i = 0; i < nz; i++) {
      const z = -hz + (i + 0.5) * (level.depth / nz);
      spots.push({ x: -hx - WALL_W / 2, y: 0, z, rotY: 0, scale: WALL_PIECE });
      spots.push({ x: hx + WALL_W / 2, y: 0, z, rotY: 0, scale: WALL_PIECE });
   }
   return spots;
}

/** Distant mesas (marsMesaTall fitted to 1 m) beyond the north, east and west walls. Seeded per level. */
export function mesaSpots(level: MarsLevel, id: LevelId): InstanceSpot[] {
   const rng = createRng(9100 + id);
   const hx = level.width / 2;
   const hz = level.depth / 2;
   const spots: InstanceSpot[] = [];
   for (let i = 0; i < 14; i++) {
      const side = i % 3;
      const d = WALL_W + 6 + rng() * 16;
      const t = rng() * 2 - 1;
      const x = side === 0 ? t * (hx + 10) : side === 1 ? -hx - d : hx + d;
      const z = side === 0 ? -hz - d : t * hz - 4;
      spots.push({ x, y: 0, z, rotY: rng() * Math.PI * 2, scale: 10 + rng() * 10 });
   }
   return spots;
}

/** The base camp south of the south wall (outside the plain, on the camera's side but below every sightline). */
export function campSpots(level: MarsLevel) {
   const hz = level.depth / 2;
   const back = hz + WALL_W + 1.5;
   return {
      base: { x: 9, z: back + 2.5, rotY: Math.PI / 2, scale: 6 },
      antenna: { x: -7, z: back + 1.5, rotY: 0.4, scale: 3.6 },
      crates: [
         { x: 4.5, y: 0, z: back + 0.6, rotY: 0.3, scale: 1.0 },
         { x: 5.8, y: 0, z: back + 1.1, rotY: -0.5, scale: 0.8 },
         { x: -3.5, y: 0, z: back + 0.8, rotY: 1.1, scale: 0.9 },
      ] as InstanceSpot[],
      capsule: { x: -13, z: back + 3, rotY: 0, scale: 2.6 },
      astronaut: { x: 1.5, z: back + 0.6 },
   };
}

/** A faint, narrow dust trail down each boulder lane (16 % opacity), so the danger reads before a boulder comes. */
export function laneSpots(level: MarsLevel, lanes: readonly { x: number }[]): InstanceSpot[] {
   // a faint, narrow dust trail (the boulder's own width is 1.7 m)
   return lanes.map((l) => ({ x: l.x, y: 0.012, z: 0, sx: 1.1, sy: 1, sz: level.depth - 1 }));
}
