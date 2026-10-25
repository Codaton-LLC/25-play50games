// Pizza Kitchen 3D: one palette, the fixed fitted view, the per-level environment. Pure.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type PizzaLevel } from "./levels";
import { TUNING, kitchenHalf } from "./rules";

export const COLORS = {
   tile: "#f5f5f4",
   tileAlt: "#e7e5e4",
   grout: "#d6d3d1",
   wall: "#fafaf9",
   wallTile: "#e7e5e4",
   skirting: "#78350f",
   wood: "#a16207",
   darkWood: "#713f12",
   oven: "#292524",
   steel: "#a8a29e",
   steelDark: "#78716c",
   glow: "#f97316",
   accent: "#ef4444",
   dough: "#e7b76f",
   sauce: "#dc2626",
   cheese: "#facc15",
   pepperoni: "#b91c1c",
   mushroom: "#d6c3a6",
   olive: "#3f6212",
   tomato: "#f43f5e",
   onion: "#c084fc",
   hatch: "#16a34a",
   hatchTop: "#86efac",
   skin: "#d6a277",
} as const;

export const FOV = 42;
export const PITCH = (60 * Math.PI) / 180;

/** The kitchen floor in front of the counter plus the counter line (the fixed camera keeps it all on screen). */
export function kitchenBox(l: PizzaLevel): AABB {
   const half = kitchenHalf(l);
   return { min: { x: -half, y: 0, z: TUNING.counterZ - 0.9 }, max: { x: half, y: 1.7, z: TUNING.maxZ + 0.4 } };
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      view = {
         area: kitchenBox(LEVELS[id]),
         pitch: PITCH,
         yaws: [0],
         fov: FOV,
         margin: { top: 0.03, right: 0.02, bottom: 0.03, left: 0.02 },
         padding: 6,
         shift: true,
      };
      VIEWS.set(id, view);
   }
   return view;
}

/** L1-L2 indoor, L3 indoor and warmer, L4 sunset through the window, L5 night with the oven glow as the key. */
export function environment(l: PizzaLevel) {
   return { background: l.background, lighting: l.lighting, fog: [l.background, 26, 70] as [string, number, number] };
}
