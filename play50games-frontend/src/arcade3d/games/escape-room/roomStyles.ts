import type { AABB } from "@/arcade3d/core/collision";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS, SHIP_CONSOLE_SPOTS, STOVE_SPOTS } from "./assets";

export const ROOM_STYLES = {
   1: { floor: "#d6d3d1", wall: "#a8a29e", accent: "#eab308", fog: "#c5d4e8" },
   2: { floor: "#9b927e", wall: "#66756c", accent: "#ffc46b", fog: "#b8c4bb" },
   3: { floor: "#c1d5d5", wall: "#486a7b", accent: "#61f5df", fog: "#779da8" },
   4: { floor: "#72503c", wall: "#4b342e", accent: "#ffb66b", fog: "#263044" },
   5: { floor: "#26374d", wall: "#526783", accent: "#68dfff", fog: "#101827" },
} as const;

export interface RoomProp {
   asset: ModelAsset;
   x: number;
   z: number;
   rotY: number;
   /** Conservative world half extents, after rotation; also used by camera collision. */
   halfX: number;
   halfZ: number;
   height: number;
}

// Entire decorative footprints stay beyond the walls. These are scenery, never hidden obstacles.
export const ROOM_PROPS: Record<number, RoomProp[]> = {
   1: [],
   2: [-3, 3].map((x) => ({ asset: ASSETS.desk, x, z: -6.2, rotY: 0, halfX: 0.65, halfZ: 0.75, height: 1.4 })),
   3: [-4, -2.5, 2.5, 4].map((x) => ({ asset: ASSETS.battery, x, z: -5.8, rotY: 0, halfX: 0.12, halfZ: 0.12, height: 0.35 })),
   4: STOVE_SPOTS.map((s) => ({ asset: ASSETS.stoveT, ...s, halfX: 0.4, halfZ: 0.35, height: 1.25 })),
   5: SHIP_CONSOLE_SPOTS.map((s) => ({ asset: ASSETS.shipConsole, ...s, halfX: 0.6, halfZ: 0.9, height: 1 })),
};

export function scenerySolids(id: number): AABB[] {
   return ROOM_PROPS[id].map((p) => ({
      min: { x: p.x - p.halfX, y: 0, z: p.z - p.halfZ },
      max: { x: p.x + p.halfX, y: p.height, z: p.z + p.halfZ },
   }));
}
