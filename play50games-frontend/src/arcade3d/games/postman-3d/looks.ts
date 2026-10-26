// Postman 3D: one palette, the follow view, fog from the fitted camera distance, decor spots. Pure.
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import type { PostLevel } from "./levels";
import { LEVELS } from "./levels";
import { OFFICE, STREET_GAP, boundsFor } from "./rules";

export const COLORS = {
   road: "#64748b", roadLine: "#e2e8f0", pavement: "#cbd5e1", kerb: "#94a3b8", lawn: "#86efac", lawnFar: "#4ade80", accent: "#ef4444",
   navy: "#1e293b", ink: "#0f172a", cream: "#fff7ed", white: "#f8fafc",
   roof: "#475569", glass: "#bae6fd", skin: "#e8b893", bag: "#92400e",
   red: "#ef4444", blue: "#3b82f6", yellow: "#facc15", glow: "#fde68a",
   dog: "#b45309", tree: "#15803d", trim: "#94a3b8", path: "#e7e5e4", door: "#7c2d12",
} as const;
export const HOUSE_COLORS = [COLORS.red, COLORS.blue, COLORS.yellow];
export const FOV = 48;
/** steeper than the spec's 52°, so the camera sees over the south-row bungalows to their doors (rules.test "sightline"); the plates lean back to face it */
export const PITCH = (66 * Math.PI) / 180;
export const LOOK_AHEAD = 2;
export const CAMERA = { position: [OFFICE.x, 18, 10] as [number, number, number], lookAt: [OFFICE.x, 0, OFFICE.z] as [number, number, number], fov: FOV };

/** Half the window the follow camera keeps on screen around its aim: wide screens see a street block, a phone the postman's surroundings. */
export const WINDOW = { x: 6, z: 6 } as const;

/** A window around the aim (the camera follows the postman with it), clear of the HUD and the controls. */
export const VIEW: FittedViewOptions = {
   area: { min: { x: -WINDOW.x, y: 0, z: -WINDOW.z }, max: { x: WINDOW.x, y: 1.8, z: WINDOW.z } },
   pitch: PITCH,
   yaws: [0],
   shift: true,
   fov: FOV,
   margin: { top: 0.03, right: 0.02, bottom: 0.03, left: 0.02 },
   padding: 8,
};

/** Desk fog (near, far); the scene moves it out with the fitted distance (fogFor). */
export const FOG_NEAR = 32;
export const FOG_DEPTH = 60;

/** Fog that starts past the aim at whatever distance the camera was fitted to: the window is never fogged. */
export function fogFor(level: PostLevel, distance: number): { near: number; far: number } {
   const near = Math.max(FOG_NEAR, distance + WINDOW.z);
   return { near, far: near + (level.lighting === "night" ? FOG_DEPTH * 0.8 : FOG_DEPTH) };
}

export function environmentFor(level: PostLevel) {
   return { background: level.background, fog: [level.background, FOG_NEAR, FOG_NEAR + FOG_DEPTH] as [string, number, number], lighting: level.lighting };
}

// ---------- decor: outside the streets and never between the camera and the play area ----------
// The camera looks north (-z) from the south: south of the last street's houses only low decor stands;
// the bench, bicycle and holiday trees stand west of the office or north of the first street's houses.

export const SOUTH_DECOR_MAX_H = 0.7;

/** Victorian lamps: one pair of pavement lamps every 24 m along each street (decor: the scene keeps useQuality().decor of them). */
export function lampSpots(level: PostLevel): InstanceSpot[] {
   const b = boundsFor(level);
   const out: InstanceSpot[] = [];
   for (let street = 0; street < level.streets; street++) {
      const z = street * STREET_GAP;
      for (let x = -2; x <= b.max.x; x += 24) for (const side of [-1, 1]) out.push({ x: x + 4, y: 0, z: z + side * 3.1, rotY: side > 0 ? Math.PI : 0 });
   }
   return out;
}

export interface DecorSpots {
   benches: InstanceSpot[];
   bicycles: InstanceSpot[];
   trees: InstanceSpot[];
}

/** Decor fitted to 1 m (assets.ts): a spot's scale is its height in metres. */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const b = boundsFor(level);
   const out: DecorSpots = { benches: [], bicycles: [], trees: [] };
   // by the post office, north-west of the start
   out.benches.push({ x: b.min.x - 1.2, y: 0, z: -8.5, rotY: Math.PI / 2, scale: 0.84 });
   out.bicycles.push({ x: -2.2, y: 0, z: -10.3, rotY: 0.3, scale: 1.0 });
   if (level.lighting === "night") {
      // L5 holiday rush: a few decorated trees by the route (north of the first street's houses, west of the cross road)
      for (let i = 0; i < 4; i++) out.trees.push({ x: -2 + i * 9, y: 0, z: b.min.z - 1.6, rotY: i * 1.3, scale: 2.4 + (i % 3) * 0.3 });
      for (let s = 1; s < level.streets; s++) out.trees.push({ x: -10.5, y: 0, z: s * STREET_GAP - 6, rotY: s, scale: 2.6 });
   }
   return out;
}
