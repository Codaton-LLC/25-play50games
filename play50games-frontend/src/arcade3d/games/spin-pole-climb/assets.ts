// Spin Pole Climb's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each
// its own GLB). This game's props live in public/models/3d/spin-pole-climb (copied from
// ~/.play50/hyper3d/ready/menu2/spin-pole-climb), and so does its copy of World 3's shared guardian
// pair m2CoilstoneHead / m2CoilstoneSegment (ready/menu2/shared). The colour orb is menu2's scoreOrb.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts
// measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2RotatingPole: a carved stone pole section (stacked up a pole's height) */
   pole: { x: 0.851, y: 1.898, z: 0.717 },
   /** m2RotatingPoleV2: the wide variant (the L4 tower, the L5 central pole) */
   poleWide: { x: 1.207, y: 1.9, z: 1.145 },
   /** m2GripLedge: one step of a spiral stair (instanced along it) */
   ledge: { x: 1.893, y: 0.996, z: 1.568 },
   /** m2CircularPlatform: a pole's top cap (the goal caps) */
   platform: { x: 1.85, y: 0.243, z: 1.902 },
   /** m2MushroomCapTop: a rest cap on a pole's top */
   mushroom: { x: 1.898, y: 1.696, z: 1.899 },
   /** m2SweeperBar: a sweeper arm on its own ring */
   sweeper: { x: 1.891, y: 0.284, z: 1.433 },
   /** m2CheckpointDisc: the hidden spin disc on a mushroom cap */
   disc: { x: 1.898, y: 0.168, z: 1.898 },
   /** m2SpiralTowerBg: background towers in the canopy */
   tower: { x: 1.055, y: 1.904, z: 1.068 },
   /** m2CoilstoneHead / m2CoilstoneSegment: World 3's guardian (level 5) */
   coilHead: { x: 1.372, y: 1.549, z: 1.909 },
   coilSegment: { x: 1.917, y: 1.795, z: 1.619 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A pole section is drawn this tall (m); a pole stacks them. */
export const POLE_SECTION_H = 2;
/** A step is drawn 0.9 m along the stair and 0.32 m thick, reaching from the core to the stair's outside. */
export const STEP_LEN = 0.9;
export const STEP_H = 0.32;
/** The colour orb is drawn 0.55 m tall, its centre on the rules' pickup point. */
export const ORB_SIZE = 0.55;
/** Coilstone's head is drawn 2.6 m long, a plated segment 1.3 m across. */
export const COIL_HEAD_LEN = 2.6;
export const COIL_SEG_W = 1.3;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/spin-pole-climb/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   pole: prop("m2RotatingPole", "#b7a98a"),
   poleWide: prop("m2RotatingPoleV2", "#b7a98a"),
   ledge: prop("m2GripLedge", "#c9b88f"),
   platform: prop("m2CircularPlatform", "#b7a98a"),
   mushroom: prop("m2MushroomCapTop", "#c2410c"),
   sweeper: prop("m2SweeperBar", "#8a6a3a"),
   disc: prop("m2CheckpointDisc", "#34d399"),
   tower: prop("m2SpiralTowerBg", "#8f8b80"),
   coilHead: { id: "m2CoilstoneHead", url: "/models/3d/spin-pole-climb/m2CoilstoneHead.glb", fallback: "box", fallbackColor: "#2f6f55", budget: CHARACTER_BUDGET },
   coilSegment: { id: "m2CoilstoneSegment", url: "/models/3d/spin-pole-climb/m2CoilstoneSegment.glb", fallback: "sphere", fallbackColor: "#2f6f55", budget: CHARACTER_BUDGET },
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
