// Palette, the follow view and the decor spots for Beach Lifeguard. Pure: no React, no three.js.
import type { AABB } from "@/arcade3d/core/collision";
import { createRng } from "@/arcade3d/core/math";
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type BeachLevel } from "./levels";
import { SAND_DEPTH } from "./rules";

export const COLORS = {
   sand: "#f2d7a6",
   sandFar: "#e9cc95",
   wetSand: "#e7c98a",
   waterShallow: "#38bdf8",
   waterDeep: "#0369a1",
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
   guardShorts: "#dc2626",
   guardShirt: "#facc15",
   skin: "#fed7aa",
   hair: "#451a03",
   swimmerSuit: "#3b82f6",
   safeLine: "#ffffff",
} as const;

export const PITCH = (50 * Math.PI) / 180;
export const FOV = 48;
export const LOOK_AHEAD = 1.6;
export const DAMPING = 4;

/** The walkable beach: sand and the swim zone. */
export function beachBox(level: BeachLevel): AABB {
   return { min: { x: -level.width / 2, y: 0, z: -level.water }, max: { x: level.width / 2, y: 2, z: SAND_DEPTH } };
}

/** Half size of the window the follow camera keeps on screen around its aim. */
export function viewWindow(level: BeachLevel): { x: number; z: number } {
   return { x: Math.min(level.width / 2, 9), z: 7.5 };
}

/** Where the camera may aim: the beach shrunk so the window stays over it, with a little sea and sand to spare. */
export function aimBounds(level: BeachLevel): AABB {
   const w = viewWindow(level);
   const box = beachBox(level);
   const hx = Math.max(0, level.width / 2 - w.x + 2);
   const zMin = Math.min(box.min.z + w.z - 2, 0);
   const zMax = Math.max(box.max.z - w.z + 1, zMin);
   return { min: { x: -hx, y: 0, z: zMin }, max: { x: hx, y: 2, z: zMax } };
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A window round the aim (the camera follows the lifeguard with it), clear of the HUD and the controls. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const w = viewWindow(LEVELS[id]);
      view = {
         area: { min: { x: -w.x, y: 0, z: -w.z }, max: { x: w.x, y: 1.8, z: w.z } },
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

// ---------- decor: behind the sand (towards the camera, z > 17) or past the beach's ends ----------

/** No decor stands nearer the play area than this behind the sand: a 3 m palm then never hides the lifeguard. */
export const DECOR_BACK_Z = SAND_DEPTH + 3.5;

export interface DecorSpots {
   palms: InstanceSpot[];
   huts: InstanceSpot[];
}

/** Seeded per level. Palm and hut GLBs are fitted to 1 m tall (assets.ts): the spot's scale is the height. */
export function decorSpots(id: LevelId): DecorSpots {
   const level = LEVELS[id];
   const rng = createRng(3400 + id);
   const halfW = level.width / 2;
   const palms: InstanceSpot[] = [];
   const huts: InstanceSpot[] = [];
   const span = halfW + 10;
   for (let x = -span; x <= span; x += 4.5 + rng() * 2) {
      palms.push({ x, y: 0, z: DECOR_BACK_Z + 1 + rng() * 4, rotY: rng() * Math.PI * 2, scale: 3.2 + rng() * 1.4 });
   }
   // palms past both ends of the beach, on the sand
   for (const side of [-1, 1]) {
      for (let z = 1; z < SAND_DEPTH; z += 3.5 + rng() * 1.5) palms.push({ x: side * (halfW + 3.5 + rng() * 3), y: 0, z, rotY: rng() * Math.PI * 2, scale: 3 + rng() * 1.2 });
   }
   const hutCount = 2 + Math.floor(level.width / 16);
   for (let i = 0; i < hutCount; i++) {
      const x = -halfW + ((i + 0.5) * level.width) / hutCount;
      huts.push({ x, y: 0, z: DECOR_BACK_Z + 0.5, rotY: Math.PI, scale: 2.4 });
   }
   return { palms, huts };
}
