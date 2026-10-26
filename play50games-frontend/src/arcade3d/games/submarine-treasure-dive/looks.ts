// One palette and the chase camera. Pure: no React. Fog colour is the water; the level sets how far it reaches.
import type { AABB } from "@/arcade3d/core/collision";
import type { FittedViewOptions } from "@/arcade3d/core/useFittedView";
import type { LevelId } from "@/arcade3d/types";
import { LEVELS, type SubLevel } from "./levels";

export const COLORS = {
   sand: "#e7c98a",
   sandDeep: "#c4a15a",
   fog: "#0e7490",
   accent: "#22d3ee",
   accentDeep: "#0891b2",
   hull: "#e2e8f0",
   hullDark: "#334155",
   glass: "#67e8f9",
   prop: "#0f172a",
   coral: "#fb7185",
   coralDeep: "#9f1239",
   kelp: "#15803d",
   kelpDark: "#14532d",
   rock: "#78716c",
   rockDark: "#44403c",
   arch: "#57534e",
   wreck: "#44403c",
   wreckTrim: "#b45309",
   dock: "#0f766e",
   dockTrim: "#99f6e4",
   shell: "#f8fafc",
   pearl: "#fde68a",
   amphora: "#d6b48a",
   amphoraDark: "#92400e",
   chest: "#b45309",
   chestTrim: "#fbbf24",
   coin: "#fbbf24",
   jelly: "#e879f9",
   jellyCore: "#fbcfe8",
   anchor: "#1e293b",
   column: "#e7e5e4",
   columnBand: "#a8a29e",
   fish: "#fb923c",
   fishFin: "#0ea5e9",
   current: "#a5f3fc",
} as const;

export const PITCH = (55 * Math.PI) / 180;
export const FOV = 46;
export const LOOK_AHEAD = 2.5;
export const FOLLOW = 1;
export const DAMPING = 5.5;
/** Floor extends past the playable reef so the chase view never shows a void. */
export const FLOOR_PAD = 48;

export function seaBounds(level: SubLevel): AABB {
   return {
      min: { x: -level.width / 2, y: 0, z: -level.depth / 2 },
      max: { x: level.width / 2, y: 3.2, z: level.depth / 2 },
   };
}

/** The floor is centered on the origin, so the look-at is the same on every level. */
export function lookAtFor(level: SubLevel): [number, number, number] {
   void level;
   return [0, 0.6, 0];
}

/**
 * The water: the level's background colour (so the floor's far edge melts into it, no horizon line),
 * clear for the camera's reach (about 14 m on a desktop, 25 m on a phone) and murky beyond it.
 */
export function fogOf(level: SubLevel): [string, number, number] {
   return [level.background, 14, level.fogFar * 1.15];
}

const VIEWS = new Map<LevelId, FittedViewOptions>();

/** A window around the sub, not the whole reef. Portrait uses the same yaw; shift clears the HUD. */
export function viewFor(id: LevelId): FittedViewOptions {
   let view = VIEWS.get(id);
   if (!view) {
      const level = LEVELS[id];
      const area = { min: { x: -5, y: 0, z: -5.2 }, max: { x: 5, y: 3.4, z: 5.2 } };
      view = {
         area,
         pitch: PITCH,
         yaws: [0],
         // the area is the window round the camera aim, which follows the sub: one focus, the rest position
         focus: [{ x: 0, y: 0.6, z: 0 }],
         margin: { top: 0.08, right: 0.03, bottom: 0.1, left: 0.03 },
         padding: 6,
         shift: true,
         fov: FOV,
      };
      VIEWS.set(id, view);
   }
   return view;
}
