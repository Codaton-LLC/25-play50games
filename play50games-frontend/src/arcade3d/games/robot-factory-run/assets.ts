// Robot Factory Run's models (public/models/3d/robot-factory-run, from ready/menu2/robot-factory-run
// and the shared Menu 2 set). The heroes are menu2/heroModels. Every GLB is one mesh, feet on y = 0,
// centred on x and z; GLB_SIZE is the measured bounds (assets.test.ts re-measures them).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const GLB_SIZE = {
   conveyor: { x: 1.9, y: 0.568, z: 0.802 },
   turntable: { x: 1.857, y: 0.614, z: 1.901 },
   crate: { x: 1.885, y: 1.229, z: 1.832 },
   hall: { x: 1.92, y: 1.265, z: 0.288 },
   press: { x: 1.198, y: 1.903, z: 1.142 },
   laser: { x: 1.903, y: 1.551, z: 0.844 },
   arm: { x: 0.738, y: 1.897, z: 1.775 },
   catwalk: { x: 0.741, y: 0.342, z: 1.898 },
   tread: { x: 1.748, y: 1.906, z: 1.004 },
   patrol: { x: 1.567, y: 1.897, z: 0.802 },
   drone: { x: 1.9, y: 1.82, z: 0.857 },
   boss: { x: 1.689, y: 1.9, z: 0.936 },
   cell: { x: 0.992, y: 1.895, z: 0.997 },
   gem: { x: 1.865, y: 1.868, z: 1.888 },
} as const;

/** M-8 stands this tall (m). */
export const BOSS_HEIGHT = 6.2;
/** a power cell is drawn this tall; an orb (the energy gem) this wide */
export const CELL_HEIGHT = 0.75;
export const ORB_SIZE = 0.55;

const prop = (id: string, color: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/robot-factory-run/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   conveyor: prop("m2Conveyor", "#6b7280"),
   turntable: prop("m2ConveyorTurntable", "#9ca3af"),
   crate: prop("m2FactoryCrate", "#78716c"),
   hall: prop("m2FactoryHallBg", "#44403c"),
   press: prop("m2HydraulicPress", "#a8a29e"),
   laser: prop("m2LaserGate", "#ef4444"),
   arm: prop("m2RobotArm", "#f97316"),
   catwalk: prop("m2SteelCatwalk", "#9ca3af"),
   tread: prop("m2TreadBot", "#57534e", CHARACTER_BUDGET),
   patrol: prop("m2PatrolBot", "#57534e", CHARACTER_BUDGET),
   drone: prop("m2FactoryDrone", "#57534e", CHARACTER_BUDGET),
   boss: prop("m2MegaRobotBoss", "#57534e", CHARACTER_BUDGET),
   cell: prop("m2PowerCell", "#ef4444"),
   gem: prop("m2EnergyGem", "#f87171"),
};
