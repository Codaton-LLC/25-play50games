// Crystal Cave Switch's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's props live in public/models/3d/crystal-cave-switch (Hyper3D, ~/.play50/hyper3d/ready/menu2):
// the crystal switch (tinted per colour), the cave gate, the crystal beacon pillar, the cave slab
// platform (floors, ledges, the moving slab), the crystal slab bridge, the cave boulder (the walls'
// rocks and the steps), the grotto wall background and the Hollow Prism (the boss). Shared from menu2:
// the orb. Every GLB is one mesh, feet on y = 0, centred on x and z; GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   crystal: { x: 1.616, y: 1.899, z: 1.615 },
   gate: { x: 1.906, y: 1.649, z: 1.84 },
   beacon: { x: 0.88, y: 1.892, z: 0.888 },
   slab: { x: 1.892, y: 0.842, z: 1.832 },
   bridge: { x: 1.9, y: 0.333, z: 0.952 },
   boulder: { x: 1.754, y: 1.828, z: 1.895 },
   grotto: { x: 1.887, y: 1.882, z: 0.152 },
   prism: { x: 1.905, y: 1.824, z: 0.667 },
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A crystal switch stands 1.4 m tall; the beacon pillar 3 m; the gate fills its 4 x 4 m opening. */
export const CRYSTAL_SCALE = 1.4 / GLB_SIZE.crystal.y;
export const BEACON_SCALE = 3 / GLB_SIZE.beacon.y;
export const GATE_STRETCH: [number, number, number] = [4 / GLB_SIZE.gate.x, 4 / GLB_SIZE.gate.y, 0.8 / GLB_SIZE.gate.z];
/** The Hollow Prism is drawn 7 m across. */
export const PRISM_SCALE = 7 / GLB_SIZE.prism.x;
export const ORB_SIZE = 0.5;

const prop = (id: string, color: string, dir = "crystal-cave-switch", budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/${dir}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   crystal: prop("m2CrystalSwitch", "#c4b5fd"),
   gate: prop("m2CaveGate", "#57534e"),
   beacon: prop("m2CrystalBeaconPillar", "#a78bfa"),
   slab: prop("m2CaveSlabPlatform", "#78716c"),
   bridge: prop("m2CrystalSlabBridge", "#a5b4fc"),
   boulder: prop("m2CaveBoulder", "#57534e"),
   grotto: prop("m2GrottoWallBg", "#44403c"),
   prism: prop("m2HollowPrismBoss", "#1e1b4b", "crystal-cave-switch", CHARACTER_BUDGET),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
