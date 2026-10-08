import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const PENGUIN_SCALE = 0.8 / EXPANSION_GLB_SIZE.penguin.height;
export const BELLY_LIFT = EXPANSION_GLB_SIZE.penguin.depth * PENGUIN_SCALE / 2 + 0.01;
export function bellyClearance(grade: number, roll: number, fallback = false): number {
   const slope = Math.atan(grade), cos = Math.cos(roll);
   const width = fallback ? 0.41 : EXPANSION_GLB_SIZE.penguin.width * PENGUIN_SCALE / 2;
   const depth = fallback ? 0.27 : BELLY_LIFT - 0.01;
   const support = width * Math.abs(Math.sin(roll)) + 0.4 * Math.abs(Math.sin(slope) * (1 - cos)) + depth * (cos * Math.cos(slope) + grade * Math.sin(slope));
   return support - (depth + 0.01) * cos + 0.01;
}
// The current reused GLB is floor-normalized; shared aliases supply no fit.
export const FLAG_BOUNDS = { minY: 0, height: 1.896885395050049 };
const FLAG_SCALE = 1.5 / FLAG_BOUNDS.height;
export const ASSETS = {
   penguin: { ...EXPANSION_ASSETS.penguin, scale: PENGUIN_SCALE },
   fish: { ...EXPANSION_ASSETS.fish, scale: 0.35 / EXPANSION_GLB_SIZE.fish.depth },
   pine: { ...EXPANSION_ASSETS.pineTree, scale: 4 / EXPANSION_GLB_SIZE.pineTree.height },
   flag: { ...REUSED_ASSETS.checkpointFlag, scale: FLAG_SCALE, yOffset: -FLAG_BOUNDS.minY * FLAG_SCALE, material: { color: "#38bdf8", roughness: 0.8 } },
} satisfies Record<string, ModelAsset>;
