// Laser Maze Run's models. The five heroes are the shared Menu 2 GLBs (menu2/heroModels.ts). This
// game's props live in public/models/3d/laser-maze-run: the ready set from
// ~/.play50/hyper3d/ready/menu2/laser-maze-run (emitter, floor tile, prism, security cam, the Vault Core
// boss, the vault wall), the card's own objects from ready/menu2/laser-maze-ninja (checkpoint pad, laser
// frame, moving barrier); the orb and the beacon are the shared Menu 2 ones. Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds
// (misc.test.ts). No new Hyper3D generation (no credits spent).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   emitter: { x: 1.5026, y: 1.3407, z: 1.8925 },
   tile: { x: 1.8887, y: 0.0714, z: 1.8946 },
   prism: { x: 1.113, y: 1.8915, z: 1.1837 },
   cam: { x: 1.1329, y: 1.614, z: 1.8923 },
   core: { x: 1.8884, y: 1.7443, z: 1.7493 },
   wall: { x: 1.9016, y: 1.7658, z: 0.6924 },
   pad: { x: 1.8874, y: 0.2088, z: 1.898 },
   frame: { x: 1.8984, y: 1.7457, z: 1.8765 },
   barrier: { x: 1.8962, y: 0.8225, z: 0.3195 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** The Vault Core spans 6 m; an orb 0.55 m. */
export const CORE_W = 6;
export const ORB_SIZE = 0.55;

const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "laser-maze-run"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   emitter: prop("m2LaserEmitter", "#334155"),
   tile: prop("m2LaserFloorTile", "#1e293b"),
   prism: prop("m2LaserPrism", "#22d3ee"),
   cam: prop("m2SecurityCam", "#475569"),
   core: { ...prop("m2VaultCoreBoss", "#7c3aed"), budget: BIG },
   wall: prop("m2VaultWallBg", "#1e1b4b"),
   pad: prop("m2CheckpointPad", "#22c55e"),
   frame: prop("m2LaserFrame", "#334155"),
   barrier: prop("m2MovingBarrier", "#f59e0b"),
   beacon: prop("checkpointBeacon", "#fbbf24", "menu2"),
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
