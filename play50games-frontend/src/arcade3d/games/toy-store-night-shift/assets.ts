// Models for Toy Store Night Shift (public/models/3d/toy-store-night-shift/*.glb, all in the manifest).
// Every fit comes from the measured GLB bounds below (Rodin makes the longest side about 1.9);
// assets.test.ts checks the drawn size on the real meshes. Props stand on y = 0, centred on x / z.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS, SHARED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import type { Category } from "./levels";
import { SHELF_DEPTH, SHELF_H, SHELF_LEN } from "./rules";

/** Measured GLB bounds (width x height x depth, GLB units). */
export const GLB_SIZE = {
   guard: { x: 1.884, y: 1.898, z: 0.53 },
   teddy: { x: 1.74, y: 1.9, z: 1.388 },
   car: { x: 1.071, y: 0.725, z: 1.897 },
   airplane: { x: 1.89, y: 0.773, z: 1.477 },
   ball: { x: 1.9, y: 1.85, z: 1.864 },
   blocks: { x: 1.899, y: 1.807, z: 1.218 },
   train: { x: 0.85, y: 1.425, z: 1.9 },
   robot: { x: 1.312, y: 1.908, z: 0.592 },
   windupRobot: { x: 1.636, y: 1.894, z: 0.71 },
   windupCar: { x: 1.071, y: 0.725, z: 1.897 },
   shelf: { x: 1.897, y: 1.896, z: 0.611 },
   bin: { x: 1.92, y: 1.16, z: 1.466 },
   binPlush: { x: 1.605, y: 1.9, z: 1.659 },
} as const;

export const GUARD_HEIGHT = 1.8;
export const GUARD_SCALE = GUARD_HEIGHT / GLB_SIZE.guard.y;

/** What each toy kind draws at: its biggest side in metres. */
export const TOY_SIZE = { teddy: 0.55, car: 0.6, airplane: 0.7, ball: 0.4, blocks: 0.5, train: 0.65, robot: 0.55 } as const;
export const WINDUP_SIZE = 0.95;
export const BIN_WIDTH = 1.0;
export const BIN_PLUSH_WIDTH = 0.95;
export const CRATE_WIDTH = 1.1;

/**
 * The guard's joints (GLB units: 1.884 x 1.898 x 0.53 T-pose, faces +z; a uniform with a belt and
 * a cap). The estimate from the mesh, except hemY = crotchY: nothing bridges the legs (the wide
 * trousers read as a hem otherwise).
 */
export const GUARD_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2845,
   shoulderX: 0.3094,
   shoulderZ: -0.0494,
   armRadius: 0.0771,
   clavicleX: 0.1547,
   elbowX: 0.5308,
   wristX: 0.7523,
   armSpread: 0.2135,
   crotchY: 0.7513,
   hipY: 0.8284,
   hipX: 0.1872,
   hipZ: -0.1045,
   kneeY: 0.4142,
   ankleY: 0.1697,
   toeZ: 0.1929,
   heelZ: -0.2335,
   legDepth: 0.1239,
   legOuterX: 0.3196,
   hemY: 0.7513,
   spineY: 0.9652,
   chestY: 1.1021,
   neckY: 1.4512,
   headY: 1.5066,
   spineZ: -0.0363,
   shoulderBlend: 0.0463,
   elbowBlend: 0.0385,
   hipBlend: 0.0828,
   kneeBlend: 0.0621,
   ankleBlend: 0.0431,
   crotchBlend: 0.0879,
   spineBlend: 0.0411,
   neckBlend: 0.0277,
};

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   extra: Partial<ModelAsset> = {},
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({ id, url: `/models/3d/toy-store-night-shift/${id}.glb`, fallback, fallbackColor, budget, ...extra });

/** A toy kind's longest side to scale. */
const fit = (size: number, glb: { x: number; y: number; z: number }) => size / Math.max(glb.x, glb.y, glb.z);

export const SHELF_SCALE = SHELF_LEN / GLB_SIZE.shelf.x;
export const SHELF_STRETCH_Y = SHELF_H / (GLB_SIZE.shelf.y * SHELF_SCALE);
export const SHELF_STRETCH_Z = SHELF_DEPTH / (GLB_SIZE.shelf.z * SHELF_SCALE);

export const ASSETS = {
   guard: local("charNightGuard", "capsule", "#1e3a8a", { scale: GUARD_SCALE, humanoid: { landmarks: GUARD_LANDMARKS } }, CHARACTER_BUDGET),
   shelf: local("toyShelfSolidT", "box", "#facc15", { scale: SHELF_SCALE, stretch: [1, SHELF_STRETCH_Y, SHELF_STRETCH_Z] }),
   teddy: local("teddyBear", "sphere", "#f59e0b", { scale: fit(TOY_SIZE.teddy, GLB_SIZE.teddy) }),
   car: local("toyCar", "box", "#ef4444", { scale: fit(TOY_SIZE.car, GLB_SIZE.car) }),
   airplane: local("toyAirplane", "box", "#38bdf8", { scale: fit(TOY_SIZE.airplane, GLB_SIZE.airplane) }),
   ball: local("toyBall", "sphere", "#22c55e", { scale: fit(TOY_SIZE.ball, GLB_SIZE.ball) }),
   blocks: local("toyBlocksPlainT", "box", "#a855f7", { scale: fit(TOY_SIZE.blocks, GLB_SIZE.blocks) }),
   train: local("toyTrain", "box", "#14b8a6", { scale: fit(TOY_SIZE.train, GLB_SIZE.train) }),
   robot: local("toyRobotProp", "capsule", "#eab308", { scale: fit(TOY_SIZE.robot, GLB_SIZE.robot) }),
   windupRobot: local("toyRobot", "capsule", "#f472b6", { scale: WINDUP_SIZE / GLB_SIZE.windupRobot.y }),
   windupCar: local("toyCar", "box", "#f472b6", { id: "toyCarWindup", scale: WINDUP_SIZE / GLB_SIZE.windupCar.z }),
   bin: local("toyBin", "cylinder", "#60a5fa", { scale: BIN_WIDTH / GLB_SIZE.bin.x }),
   binPlush: local("toyBinPlush", "cylinder", "#ef4444", { scale: BIN_PLUSH_WIDTH / GLB_SIZE.binPlush.x }),
   crate: { ...SHARED_ASSETS.crate, scale: CRATE_WIDTH / SHARED_GLB_SIZE.crate.width },
} satisfies Record<string, ModelAsset>;

/** The asset that draws a toy of this kind. */
export const TOY_ASSETS: Record<Category, ModelAsset> = {
   teddy: ASSETS.teddy,
   car: ASSETS.car,
   airplane: ASSETS.airplane,
   ball: ASSETS.ball,
   blocks: ASSETS.blocks,
   train: ASSETS.train,
   robot: ASSETS.robot,
};
