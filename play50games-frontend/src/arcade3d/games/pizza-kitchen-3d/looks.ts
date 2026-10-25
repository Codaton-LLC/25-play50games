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

/** The kitchen: the counter line and the cook's working strip in front of it. */
export function kitchenBox(l: PizzaLevel): AABB {
   const half = kitchenHalf(l);
   return { min: { x: -half, y: 0, z: TUNING.counterZ - 0.9 }, max: { x: half, y: 1.7, z: TUNING.maxZ + 0.3 } };
}

/** Half width of the window the camera keeps on screen: about 6.5 stations wide, 4 on a portrait screen. */
export const windowHalf = (l: PizzaLevel, portrait: boolean) => Math.min(kitchenHalf(l), portrait ? 3.4 : 5.4);

/** The camera aims at (x, 0, AIM_Z): the window's floor centre, so the fitted offset holds while it pans. */
export const AIM_Z = (TUNING.counterZ - 0.9 + TUNING.maxZ + 0.3) / 2;

/** How far the aim may pan along the row (0 when the whole row fits the window). */
export function panHalf(l: PizzaLevel, portrait: boolean): number {
   return Math.max(0, kitchenHalf(l) - windowHalf(l, portrait));
}

const VIEWS = new Map<string, FittedViewOptions>();

/** A window of the kitchen around the cook (the whole row on L1-L2 and on wide screens where it fits). */
export function viewFor(id: LevelId, portrait: boolean): FittedViewOptions {
   const key = `${id}:${portrait}`;
   let view = VIEWS.get(key);
   if (!view) {
      const box = kitchenBox(LEVELS[id]);
      const w = windowHalf(LEVELS[id], portrait);
      view = {
         area: { min: { ...box.min, x: -w }, max: { ...box.max, x: w } },
         pitch: PITCH,
         yaws: [0],
         fov: FOV,
         margin: { top: 0.02, right: 0.01, bottom: 0.02, left: 0.01 },
         padding: 6,
         shift: true,
      };
      VIEWS.set(key, view);
   }
   return view;
}

/** L1-L2 indoor, L3 indoor and warmer, L4 sunset through the window, L5 night with the oven glow as the key. */
export function environment(l: PizzaLevel) {
   // fog only far past the kitchen: a phone's fitted camera stands 20-40 m back and must stay clear of it
   return { background: l.background, lighting: l.lighting, fog: [l.background, 90, 220] as [string, number, number] };
}
