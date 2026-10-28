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

/**
 * auroraCrystal.glb (Group D, QA "OK"), decor for levels 4-5 (Aurora Run, Glacier Sprint) only.
 * Measured on the real mesh in assets.test.ts: floor pivot at y = 0, 1.62 m across, 1.9114 m tall.
 * Fitted to a 2.4 m crystal spire and placed AURORA_CRYSTAL_LATERAL metres off the corridor centre.
 */
export const AURORA_CRYSTAL_GLB = { width: 1.62, height: 1.9114, depth: 1.6161 } as const;
export const AURORA_CRYSTAL_HEIGHT = 2.4;
export const AURORA_CRYSTAL_LATERAL = 10.5;
const AURORA_CRYSTAL_SCALE = AURORA_CRYSTAL_HEIGHT / AURORA_CRYSTAL_GLB.height;

/**
 * glacierChunk.glb (Group D, QA "OK"), decor for levels 4-5 only. Measured below: floor pivot at
 * y = 0, 1.8965 m across, 1.3888 m tall. Fitted 2.8 m across (a 2.05 m tall beached ice boulder)
 * and placed GLACIER_CHUNK_LATERAL metres off the corridor centre, past the ice arches at 8 m.
 */
export const GLACIER_CHUNK_GLB = { width: 1.8965, height: 1.3888, depth: 1.4132 } as const;
export const GLACIER_CHUNK_WIDTH = 2.8;
export const GLACIER_CHUNK_LATERAL = 11.5;
const GLACIER_CHUNK_SCALE = GLACIER_CHUNK_WIDTH / GLACIER_CHUNK_GLB.width;

/** Track-local distance (m into a 60 m chunk) of the levels 4-5 crystal and glacier decor. */
export const AURORA_CRYSTAL_LOCAL = 26;
export const GLACIER_CHUNK_LOCAL = 44;

/**
 * iceBlock.glb (Menu 1 adoption, 1500 tris) 1.894 x 1.903 x 1.887, floor pivot, centred: the ice-block obstacle. Drawn a
 * 1.1 m cube, covering the rules' 0.6 m collision circle (ice radius 0.6) the way the code block did.
 */
export const ICE_BLOCK_GLB = { width: 1.894, height: 1.903, depth: 1.887 } as const;
export const ICE_BLOCK_SIZE = 1.1;
const ICE_BLOCK_SCALE = ICE_BLOCK_SIZE / ICE_BLOCK_GLB.width;

/**
 * snowRamp.glb (Menu 1 adoption, 3000 tris) 1.899 x 0.533 x 1.825, floor pivot, centred. It rises toward its -z, so it is
 * turned half a turn (the track runs +z): the high lip is the launch edge. Drawn 1.7 m wide x 3.0 m long x 0.9 m tall at
 * the lip, the code runway's 1.6 x 3 footprint.
 */
export const SNOW_RAMP_GLB = { width: 1.899, height: 0.533, depth: 1.825 } as const;
export const SNOW_RAMP_DRAWN = { width: 1.7, length: 3, height: 0.9 } as const;
const SNOW_RAMP_SCALE = SNOW_RAMP_DRAWN.width / SNOW_RAMP_GLB.width;

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
   iceBlock: {
      id: "iceBlock",
      url: "/models/3d/penguin-slide/iceBlock.glb",
      scale: ICE_BLOCK_SCALE,
      stretch: [1, ICE_BLOCK_SIZE / (ICE_BLOCK_GLB.height * ICE_BLOCK_SCALE), 1] as const,
      fallback: "box",
      fallbackColor: "#bae6fd",
      budget: { ...PROP_BUDGET },
   },
   snowRamp: {
      id: "snowRamp",
      url: "/models/3d/penguin-slide/snowRamp.glb",
      scale: SNOW_RAMP_SCALE,
      stretch: [1, SNOW_RAMP_DRAWN.height / (SNOW_RAMP_GLB.height * SNOW_RAMP_SCALE), SNOW_RAMP_DRAWN.length / (SNOW_RAMP_GLB.depth * SNOW_RAMP_SCALE)] as const,
      rotationY: Math.PI,
      fallback: "box",
      fallbackColor: "#e0f2fe",
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
   auroraCrystal: {
      id: "auroraCrystal",
      url: "/models/3d/penguin-slide/auroraCrystal.glb",
      scale: AURORA_CRYSTAL_SCALE,
      fallback: "cylinder",
      fallbackColor: "#a5f3fc",
      budget: { ...PROP_BUDGET },
   },
   glacierChunk: {
      id: "glacierChunk",
      url: "/models/3d/penguin-slide/glacierChunk.glb",
      scale: GLACIER_CHUNK_SCALE,
      fallback: "box",
      fallbackColor: "#7dd3fc",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
