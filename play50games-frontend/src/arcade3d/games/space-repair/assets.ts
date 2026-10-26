import type { ModelAsset } from "@/arcade3d/core/types";
import { Box3, Vector3, type Object3D } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { EXPANSION_CHARACTERS, EXPANSION_CHARACTER_GLB_HEIGHT, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

export const SUIT_HEIGHT = 1.75;
export const SUIT_SCALE = SUIT_HEIGHT / EXPANSION_CHARACTER_GLB_HEIGHT.astronaut;

/** satelliteDish.glb raw bounds, measured on the mesh (assets.test.ts): the feet already sit on y = 0. */
export const DISH_GLB = { width: 1.9046, height: 1.9002, depth: 1.5778 } as const;
/** Drawn 2.2 m tall, a real comms dish on the external platform deck; footprint follows the GLB proportions. */
export const DISH_HEIGHT = 2.2;
export const DISH_SCALE = DISH_HEIGHT / DISH_GLB.height;
export const DISH_DRAWN = {
   width: DISH_GLB.width * DISH_SCALE,
   height: DISH_HEIGHT,
   depth: DISH_GLB.depth * DISH_SCALE,
} as const;

export const ASSETS: Record<"astronaut" | "battery" | "station" | "dish", ModelAsset> = {
   astronaut: { ...EXPANSION_CHARACTERS.astronaut, scale: SUIT_SCALE },
   battery: { ...SHARED_ASSETS.battery, scale: 1 / SHARED_GLB_SIZE.battery.height },
   station: { id: "stationModule", url: "/models/3d/space-repair/stationModule.glb", fallback: "cylinder", fallbackColor: "#e2e8f0", budget: { tris: 3000, bytes: 1500000 } },
   dish: { id: "satelliteDish", url: "/models/3d/space-repair/satelliteDish.glb", scale: DISH_SCALE, fallback: "cylinder", fallbackColor: "#e2e8f0", budget: { tris: 3000, bytes: 1500000 } },
};

/** The dish decor appears only on levels 4 (External Platform) and 5 (Station Emergency). */
export const DISH_LEVELS = [4, 5] as const;
/**
 * Grounded comms dishes in the outer deck ring, where the distant module pods and solar wings
 * already sit (radius 19-25, well outside the ±10 m arena). Faces are turned outward-ish so the
 * bowls never stare into the arena.
 */
export const DISH_SPOTS = [
   { x: 19, y: 0, z: -20, rotY: 0.4 },
   { x: -19, y: 0, z: -21, rotY: -0.5 },
   { x: 25, y: 0, z: 6, rotY: 1.2 },
   { x: -25, y: 0, z: -6, rotY: -1.1 },
] as const;
// The new prop has no shared measured constant yet. Fit its loaded bounds once, never in a frame.
export function stationFit(width: number, height: number, depth: number, minY: number, radius = Math.hypot(width, depth) / 2): ModelAsset {
   const scale = Math.min(0.65 / radius, 1.2 / height);
   return { ...ASSETS.station, scale, yOffset: -minY * scale };
}
export function fitStationScene(scene: Object3D): ModelAsset {
   const box = new Box3(), point = new Vector3();
   let radius = 0;
   for (const part of modelParts(scene, {})) {
      const positions = part.geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
         point.fromBufferAttribute(positions, i).applyMatrix4(part.matrix); box.expandByPoint(point);
         radius = Math.max(radius, Math.hypot(point.x, point.z));
      }
   }
   return stationFit(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z, box.min.y, radius);
}
