// Models for Robot Factory Sorter. Plain data: index.tsx hands them to GameShell (which frees the
// GLBs when the game closes), the scene draws them. Every fit comes from the core's measured GLB
// sizes (SHARED_GLB_SIZE, REUSED_GLB_SIZE), never from copied numbers; assets.test.ts checks them
// on the real meshes. Head and arm parts are procedural (partShapes.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE, ROBOT_LANDMARKS, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** The finished robot stands 1.20 m tall. */
export const ROBOT_HEIGHT = 1.2;
export const ROBOT_SCALE = ROBOT_HEIGHT / SHARED_GLB_SIZE.robot.height;
/** Torso parts: 0.50 m on their longest side; the battery cell 0.45 m tall. */
export const TORSO_SIZE = 0.5;
export const CELL_SIZE = 0.45;
/** The exit door: 1.00 x 1.85 x 0.20 m. */
export const DOOR = { width: 1, height: 1.85, depth: 0.2 } as const;

const doorScale = DOOR.height / REUSED_GLB_SIZE.door.height;

/** powerCore.glb (robot-factory, Hyper3D) raw bounds, measured on the mesh (assets.test.ts). */
export const POWER_CORE_GLB = { width: 1.2613, height: 1.9005, depth: 1.2167 } as const;
/** Drawn 1.80 m tall in the industrial factory bay (levels 4 and 5: Fast Factory and Overdrive). */
export const POWER_CORE_HEIGHT = 1.8;
export const POWER_CORE_SCALE = POWER_CORE_HEIGHT / POWER_CORE_GLB.height;
export const POWER_CORE_DRAWN = {
   width: POWER_CORE_GLB.width * POWER_CORE_SCALE,
   height: POWER_CORE_HEIGHT,
   depth: POWER_CORE_GLB.depth * POWER_CORE_SCALE,
} as const;

/** Four power core spots outside the play area flanking the bay for high-energy shifts (levels 4-5). */
export const POWER_CORE_SPOTS = [
   { x: -5.5, y: 0, z: -1.0, rotY: 0.4 },
   { x: -5.6, y: 0, z: 1.8, rotY: -0.3 },
   { x: 5.5, y: 0, z: -1.0, rotY: -0.4 },
   { x: 5.6, y: 0, z: 1.8, rotY: 0.3 },
] as const;

export const POWER_CORE_FALLBACK = POWER_CORE_SPOTS.map((s) => ({ ...s, y: POWER_CORE_DRAWN.height / 2 }));

/** A near-white satin shell: the part colour (per-copy tint) multiplies it, so sky, amber, coral and lime read true. */
const PART_SHELL = { color: "#f1f5f9", roughness: 0.42, metalness: 0.12 } as const;

/**
 * Menu 1 adoptions: the six head and arm parts on the belt and in the cradle (1500 tris each, floor pivot, centred;
 * measured on the meshes, GLB units w x h x d): robotHeadDome 1.906 x 1.904 x 1.636, robotHeadBox 1.828 x 1.902 x 1.361,
 * robotHeadAntenna 1.579 x 1.890 x 1.422, robotArmClaw 0.859 x 1.005 x 1.881, robotArmWrench 0.753 x 0.694 x 1.896,
 * robotArmDrill 1.331 x 1.698 x 1.901 (the arms lie along z). Drawn at the stand-ins' sizes: the heads 0.44 / 0.46 / 0.50 m
 * tall, the arms 0.50 m on their longest side. Like the torso parts they wear the near-white PART_SHELL, so the per-copy
 * tint (palette colour, faulty red) reads. The clawHead GLB is not adopted: a uniform 1.05 m column with no readable
 * gripper, nothing like the 0.4 m code gripper it would replace.
 */
export const PART_GLB = {
   headDome: { width: 1.906, height: 1.904, depth: 1.636 },
   headBox: { width: 1.828, height: 1.902, depth: 1.361 },
   headAntenna: { width: 1.579, height: 1.89, depth: 1.422 },
   armClaw: { width: 0.859, height: 1.005, depth: 1.881 },
   armWrench: { width: 0.753, height: 0.694, depth: 1.896 },
   armDrill: { width: 1.331, height: 1.698, depth: 1.901 },
} as const;
/** Drawn size of each: the measured dimension that is pinned, in metres. */
export const PART_DRAWN = {
   headDome: { dim: "width", size: 0.44 },
   headBox: { dim: "height", size: 0.46 },
   headAntenna: { dim: "height", size: 0.5 },
   armClaw: { dim: "depth", size: 0.5 },
   armWrench: { dim: "depth", size: 0.5 },
   armDrill: { dim: "depth", size: 0.5 },
} as const;
type PartKey = keyof typeof PART_GLB;
const partScale = (k: PartKey) => PART_DRAWN[k].size / PART_GLB[k][PART_DRAWN[k].dim];
const partAsset = (k: PartKey, file: string, fallback: "sphere" | "box" | "cylinder"): ModelAsset => ({
   id: file,
   url: `/models/3d/robot-factory/${file}.glb`,
   scale: partScale(k),
   material: PART_SHELL,
   fallback,
   fallbackColor: "#cbd5e1",
   budget: { ...PROP_BUDGET },
});

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
   headDome: partAsset("headDome", "robotHeadDome", "sphere"),
   headBox: partAsset("headBox", "robotHeadBox", "box"),
   headAntenna: partAsset("headAntenna", "robotHeadAntenna", "cylinder"),
   armClaw: partAsset("armClaw", "robotArmClaw", "box"),
   armWrench: partAsset("armWrench", "robotArmWrench", "box"),
   armDrill: partAsset("armDrill", "robotArmDrill", "cylinder"),
   powerCore: {
      id: "powerCore",
      url: "/models/3d/robot-factory/powerCore.glb",
      scale: POWER_CORE_SCALE,
      rotationY: 0,
      yOffset: 0,
      fallback: "cylinder",
      fallbackColor: "#38bdf8",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
