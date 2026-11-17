import type { LevelId } from "@/arcade3d/types";

/** Visual workstations beyond the collision walls. No new obstacle can invalidate a scored route. */
export interface WarehouseLook {
   floor: string;
   wall: string;
   accent: string;
   kind: "rack" | "motor" | "cabinet" | "freight";
   stations: ReadonlyArray<{ x: number; z: number }>;
}

export const SCENERY_AREA = {
   min: { x: -12.4, y: 0, z: -9.5 },
   max: { x: 12.4, y: 2.2, z: 9.5 },
};

export const SCENERY: Partial<Record<LevelId, WarehouseLook>> = {
   2: {
      floor: "#718379", wall: "#b6c8bd", accent: "#f5ce79", kind: "rack",
      stations: [{ x: -8, z: -8.9 }, { x: 0, z: -8.9 }, { x: 8, z: -8.9 }],
   },
   3: {
      floor: "#615b70", wall: "#a094af", accent: "#ffb45e", kind: "motor",
      stations: [{ x: -8, z: -8.9 }, { x: 4, z: -8.9 }, { x: -4, z: 8.9 }, { x: 8, z: 8.9 }],
   },
   4: {
      floor: "#34485b", wall: "#647e94", accent: "#74d9ef", kind: "cabinet",
      stations: [{ x: -9, z: -8.9 }, { x: -3, z: -8.9 }, { x: 3, z: -8.9 }, { x: 9, z: -8.9 }, { x: 6, z: 8.9 }],
   },
   5: {
      floor: "#71594e", wall: "#b58b74", accent: "#ffd27c", kind: "freight",
      stations: [{ x: -9, z: -8.9 }, { x: 0, z: -8.9 }, { x: 9, z: -8.9 }, { x: -9, z: 8.9 }, { x: 0, z: 8.9 }, { x: 9, z: 8.9 }],
   },
};
