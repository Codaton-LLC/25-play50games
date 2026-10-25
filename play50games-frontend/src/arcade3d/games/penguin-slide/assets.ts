import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const PENGUIN_SCALE = 1 / EXPANSION_GLB_SIZE.penguin.height;
export const BELLY_ROTATION_Y = Math.PI;
export const BELLY_LIFT = EXPANSION_GLB_SIZE.penguin.depth * PENGUIN_SCALE / 2 + 0.01;
export function bellyClearance(grade: number, roll: number, fallback = false): number {
   const slope = Math.atan(grade), cos = Math.cos(roll);
   const width = fallback ? 0.5125 : EXPANSION_GLB_SIZE.penguin.width * PENGUIN_SCALE / 2;
   const depth = fallback ? 0.3375 : BELLY_LIFT - 0.01;
   const support = width * Math.abs(Math.sin(roll)) + 0.5 * Math.abs(Math.sin(slope) * (1 - cos)) + depth * (cos * Math.cos(slope) + grade * Math.sin(slope));
   return support - (depth + 0.01) * cos + 0.01;
}
// The current reused GLB is floor-normalized; shared aliases supply no fit.
export const FLAG_BOUNDS = { minY: 0, height: 1.896885395050049 };
const FLAG_SCALE = 1.5 / FLAG_BOUNDS.height;

/**
 * The snowman obstacle GLB measured on the real mesh (assets.test.ts decodes it): floor pivot at
 * y = 0, height 1.9034, base ball radius 0.6828 (GLB units); the carrot nose points +z, the same
 * way the old primitive faced, so no rotationY. Scale 0.72 keeps the drawn height within 3 % of
 * the old 1.35-1.4 m stand-in and the base ball on the rules' 0.5 m collision circle.
 */
export const SNOWMAN_GLB = { height: 1.9034, baseRadius: 0.6828 };
export const SNOWMAN_SCALE = 0.72;

/**
 * iceArch.glb (Group D, QA "OK"). 2.2 m across, placed ICE_ARCH_LATERAL metres off the
 * corridor centre so the span stays outside the widest half-width (COURSE.width = 3.5).
 */
export const ICE_ARCH_GLB = { width: 1.9039, height: 1.1863, depth: 0.9293 } as const;
export const ICE_ARCH_WIDTH = 2.2;
export const ICE_ARCH_LATERAL = 8;
const ICE_ARCH_SCALE = ICE_ARCH_WIDTH / ICE_ARCH_GLB.width;

export const ASSETS = {
   penguin: { ...EXPANSION_ASSETS.penguin, scale: PENGUIN_SCALE },
   fish: { ...EXPANSION_ASSETS.fish, scale: 0.6 / EXPANSION_GLB_SIZE.fish.depth },
   pine: { ...EXPANSION_ASSETS.pineTree, scale: 4 / EXPANSION_GLB_SIZE.pineTree.height },
   flag: { ...REUSED_ASSETS.checkpointFlag, scale: FLAG_SCALE, yOffset: -FLAG_BOUNDS.minY * FLAG_SCALE, material: { color: "#38bdf8", roughness: 0.8 } },
   snowman: {
      id: "snowman",
      url: "/models/3d/shared/snowman.glb",
      scale: SNOWMAN_SCALE,
      fallback: "sphere",
      fallbackColor: "#fff5ed",
      budget: { ...PROP_BUDGET },
   },
   iceArch: {
      id: "iceArch",
      url: "/models/3d/penguin-slide/iceArch.glb",
      scale: ICE_ARCH_SCALE,
      fallback: "box",
      fallbackColor: "#e0f2fe",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
