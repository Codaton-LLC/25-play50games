import type { ModelAsset } from "@/arcade3d/core/types";
import { Box3, Vector3, type Object3D } from "three";
import { modelParts } from "@/arcade3d/core/assets";
import { EXPANSION_CHARACTERS, EXPANSION_CHARACTER_GLB_HEIGHT, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

export const SUIT_HEIGHT = 1.75;
export const SUIT_SCALE = SUIT_HEIGHT / EXPANSION_CHARACTER_GLB_HEIGHT.astronaut;
export const ASSETS: Record<"astronaut" | "battery" | "station", ModelAsset> = {
   astronaut: { ...EXPANSION_CHARACTERS.astronaut, scale: SUIT_SCALE },
   battery: { ...SHARED_ASSETS.battery, scale: 1 / SHARED_GLB_SIZE.battery.height },
   station: { id: "stationModule", url: "/models/3d/space-repair/stationModule.glb", fallback: "cylinder", fallbackColor: "#e2e8f0", budget: { tris: 3000, bytes: 1500000 } },
};
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
