// Palette, camera views, and decor spots for Beach Lifeguard. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import { followFocus } from "@/arcade3d/core/view";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type BeachLevel } from "./levels";

export const COLORS = {
   sand: "#f2d7a6",
   wetSand: "#e7c98a",
   waterShallow: "#38bdf8",
   waterDeep: "#0284c7",
   waterFoam: "#f0fdf4",
   accent: "#fb7185",
   torusPink: "#fb7185",
   torusWhite: "#f8fafc",
   towerRed: "#e11d48",
   towerWhite: "#ffffff",
   towerWood: "#a16207",
   floatRed: "#ef4444",
   floatStrap: "#ffffff",
   jetSkiBlue: "#0284c7",
   jetSkiWhite: "#f8fafc",
   jetSkiSeat: "#1e293b",
   chairBlue: "#0ea5e9",
   chairWhite: "#f8fafc",
   coolerBlue: "#0284c7",
   coolerWhite: "#ffffff",
   hutWood: "#78350f",
   hutRoof: "#fef08a",
   sandcastle: "#eab308",
   surfboardCyan: "#06b6d4",
   surfboardRed: "#f43f5e",
   guardShorts: "#dc2626",
   guardShirt: "#facc15",
   skin: "#fed7aa",
   hair: "#451a03",
   swimmerSuit: "#3b82f6",
} as const;

export const PITCH = (50 * Math.PI) / 180;
export const YAWS = [0, Math.PI / 2] as const;
export const FOV = 48;
export const FOLLOW = 0.45;
export const LOOK_AHEAD = 1.2;
export const DAMPING = 4;

export function beachBox(level: BeachLevel): AABB {
   return {
      min: { x: -level.width / 2 - 1, y: 0, z: -level.water - 1 },
      max: { x: level.width / 2 + 1, y: 3.5, z: 15 },
   };
}

export function lookAtFor(level: BeachLevel): [number, number, number] {
   return [0, 0.5, (14 - level.water) / 2];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** Bounds the whole beach (sand + swim zone), biased toward the lifeguard. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = beachBox(level);
      view = {
         area,
         pitch: PITCH,
         yaws: YAWS,
         focus: followFocus({ lookAt: lookAtFor(level), reach: area, fraction: FOLLOW, bounds: area }),
         margin: { top: 0.04, right: 0.03, bottom: 0.05, left: 0.03 },
         padding: 8,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}
