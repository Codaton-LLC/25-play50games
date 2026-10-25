// One palette, camera fit, and arena layout helpers.
// Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type MarsLevel } from "./levels";

export const COLORS = {
   ground: "#c2410c",
   tracks: "#9a3412",
   accent: "#f97316",
   skyTop: "#fdba74",
   skyBottom: "#7c2d12",
   spaceSky: "#0c0a09",
   basePad: "#38bdf8",
   basePadActive: "#0284c7",
   siteRing: "#f97316",
   siteRingActive: "#fde047",
   siteRingScanned: "#22c55e",
   chargerPad: "#22c55e",
   chargerPadActive: "#4ade80",
   rock: "#b45309",
   boulder: "#7c2d12",
   mesa: "#9a3412",
   mesaTrim: "#7c2d12",
   ruin: "#78716c",
   rover: "#ea580c",
   roverWheel: "#1c1917",
   roverMetal: "#94a3b8",
   sampleGlow: "#fbbf24",
   capsule: "#f1f5f9",
   capsuleDark: "#64748b",
   solarBlue: "#0284c7",
} as const;

export const PITCH = (46 * Math.PI) / 180;
export const FOV = 48;
export const FOLLOW = 0.55;
export const LOOK_AHEAD = 3.5;
export const DAMPING = 5;

export function plainBounds(level: MarsLevel): AABB {
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   return {
      min: { x: -halfW, y: 0, z: -halfD },
      max: { x: halfW, y: 3.5, z: halfD },
   };
}

export function lookAtFor(level: MarsLevel): [number, number, number] {
   return [0, 0.5, 0];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = plainBounds(level);
      view = {
         area,
         pitch: PITCH,
         yaws: [0, Math.PI / 2],
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.05, right: 0.03, bottom: 0.06, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** Perimeter mesa boundary wall spots (unit geometry scaled by spot). */
export function perimeterWallSpots(level: MarsLevel): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   const halfW = level.width / 2;
   const halfD = level.depth / 2;
   const h = 2.4;
   const thickness = 2.0;

   // North and South walls
   const numX = Math.ceil(level.width / 4);
   const stepX = level.width / numX;
   for (let i = 0; i < numX; i++) {
      const x = -halfW + (i + 0.5) * stepX;
      spots.push({ x, y: h / 2, z: -halfD - thickness / 2, sx: stepX * 1.05, sy: h, sz: thickness });
      spots.push({ x, y: h / 2, z: halfD + thickness / 2, sx: stepX * 1.05, sy: h, sz: thickness });
   }

   // East and West walls
   const numZ = Math.ceil(level.depth / 4);
   const stepZ = level.depth / numZ;
   for (let i = 0; i < numZ; i++) {
      const z = -halfD + (i + 0.5) * stepZ;
      spots.push({ x: -halfW - thickness / 2, y: h / 2, z, sx: thickness, sy: h, sz: stepZ * 1.05 });
      spots.push({ x: halfW + thickness / 2, y: h / 2, z, sx: thickness, sy: h, sz: stepZ * 1.05 });
   }

   return spots;
}
