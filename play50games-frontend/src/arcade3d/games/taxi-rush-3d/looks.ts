// One palette and the chase camera. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type TaxiLevel } from "./levels";
import { citySize } from "./rules";

export const COLORS = {
   road: "#334155",
   roadLine: "#cbd5e1",
   sidewalk: "#94a3b8",
   sidewalkTrim: "#64748b",
   building: "#e7e5e4",
   buildingTrim: "#cbd5e1",
   shop: "#f8fafc",
   shopAwning: "#0f172a",
   taxi: "#facc15",
   taxiDark: "#a16207",
   window: "#0f172a",
   wheel: "#1e293b",
   sign: "#f8fafc",
   pad: "#facc15",
   bulbRed: "#ef4444",
   bulbGreen: "#22c55e",
   cone: "#f97316",
   coneBand: "#f8fafc",
   pole: "#334155",
   bench: "#92400e",
   benchSlat: "#d6d3d1",
   lamp: "#e2e8f0",
   lampHead: "#fef9c3",
   bus: "#1d4ed8",
   busTrim: "#dbeafe",
   rider: "#e7e5e4",
   riderTrim: "#44403c",
   skin: "#f1d0b4",
   carA: "#e2e8f0",
   carB: "#38bdf8",
   carC: "#fb7185",
} as const;

export const PITCH = (48 * Math.PI) / 180;
export const YAWS = [0.35, Math.PI / 2 + 0.2] as const;
export const FOV = 46;
export const FOLLOW = 0.42;
export const LOOK_AHEAD = 3;
export const DAMPING = 4.5;

export function cityBox(level: TaxiLevel): AABB {
   const size = citySize(level);
   return {
      min: { x: -0.6, y: 0, z: -0.6 },
      max: { x: size.x + 0.6, y: 6, z: size.z + 0.6 },
   };
}

export function lookAtFor(level: TaxiLevel): [number, number, number] {
   const size = citySize(level);
   return [size.x / 2, 0.6, size.z / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** The whole grid stays in frame. Portrait picks the other yaw. The rig chases the cab inside it. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = cityBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.04, right: 0.03, bottom: 0.08, left: 0.03 },
         padding: 10,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}

export function skyFor(level: TaxiLevel): { top: string; bottom: string } {
   if (level.lighting === "night") return { top: "#020617", bottom: "#1e293b" };
   if (level.lighting === "sunset") return { top: "#fb923c", bottom: "#fed7aa" };
   return { top: "#38bdf8", bottom: "#e0f2fe" };
}

export function fogFor(level: TaxiLevel): [string, number, number] {
   const far = 36 + Math.max(level.blocksX, level.blocksZ) * 14;
   return [level.background, far * 0.38, far];
}
