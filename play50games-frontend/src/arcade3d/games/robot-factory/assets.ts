// Models for Robot Factory Sorter. Plain data: index.tsx hands them to GameShell (which frees the
// GLBs when the game closes), the scene draws them. Every fit comes from the core's measured GLB
// sizes (SHARED_GLB_SIZE, REUSED_GLB_SIZE), never from copied numbers; assets.test.ts checks them
// on the real meshes. Head and arm parts are procedural (partShapes.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { REUSED_ASSETS, REUSED_GLB_SIZE, ROBOT_LANDMARKS, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** The finished robot stands 1.20 m tall. */
export const ROBOT_HEIGHT = 1.2;
export const ROBOT_SCALE = ROBOT_HEIGHT / SHARED_GLB_SIZE.robot.height;
/** Torso parts: 0.50 m on their longest side; the battery cell 0.45 m tall. */
export const TORSO_SIZE = 0.5;
export const CELL_SIZE = 0.45;
/** The exit door: 1.00 x 1.85 x 0.20 m. */
export const DOOR = { width: 1, height: 1.85, depth: 0.2 } as const;

const doorScale = DOOR.height / REUSED_GLB_SIZE.door.height;

/** A near-white satin shell: the part colour (per-copy tint) multiplies it, so sky, amber, coral and lime read true. */
const PART_SHELL = { color: "#f1f5f9", roughness: 0.42, metalness: 0.12 } as const;

export const ASSETS = {
   robot: { ...SHARED_ASSETS.robot, scale: ROBOT_SCALE, humanoid: { landmarks: ROBOT_LANDMARKS } },
   barrel: { ...REUSED_ASSETS.barrel, scale: TORSO_SIZE / REUSED_GLB_SIZE.barrel.height, material: PART_SHELL },
   crate: { ...SHARED_ASSETS.crate, scale: TORSO_SIZE / SHARED_GLB_SIZE.crate.width, material: PART_SHELL },
   battery: { ...SHARED_ASSETS.battery, scale: CELL_SIZE / SHARED_GLB_SIZE.battery.height, material: PART_SHELL },
   door: {
      ...REUSED_ASSETS.door,
      scale: doorScale,
      stretch: [DOOR.width / (REUSED_GLB_SIZE.door.width * doorScale), 1, DOOR.depth / (REUSED_GLB_SIZE.door.depth * doorScale)],
   },
} satisfies Record<string, ModelAsset>;
