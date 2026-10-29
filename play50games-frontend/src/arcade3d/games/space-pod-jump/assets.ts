// Space Pod Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/space-pod-jump, copied from ready/menu2/space-pod-jump: the
// walkable planetoid, the Orbit Warden, the pod cradle, the station deck and its docking arm, the
// satellite panel, the space crate (level 4's push-off crates and the debris), the energy orb, the
// asteroid (the moons), the ringed planet (background) and the gravity buoy (the Warden's mines). The
// dock's beacon is the shared menu2 checkpointBeacon. Every GLB is one mesh, its feet on y = 0, centred on
// x and z. GLB_SIZE is the real bounds (assets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), measured on the meshopt-decoded meshes. */
export const GLB_SIZE = {
   planetoid: { x: 1.8515, y: 1.8631, z: 1.9048 },
   warden: { x: 1.8989, y: 1.8505, z: 1.6075 },
   pod: { x: 1.8801, y: 1.0637, z: 1.8935 },
   deck: { x: 1.8481, y: 0.2658, z: 1.903 },
   arm: { x: 1.1979, y: 1.9013, z: 1.4835 },
   panel: { x: 1.8949, y: 0.4414, z: 1.8952 },
   crate: { x: 1.6788, y: 1.4422, z: 1.8892 },
   orb: { x: 1.8615, y: 1.9016, z: 1.5122 },
   asteroid: { x: 1.8978, y: 1.7401, z: 1.546 },
   ringed: { x: 1.8518, y: 1.8432, z: 1.8965 },
   buoy: { x: 1.5886, y: 1.914, z: 1.6132 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
} as const;

/** A body's GLB is drawn this much wider than its radius x 2 so its rock surface sits on the walkable sphere. */
export const BODY_FIT = 1.0;
/** A pod cradle 1.6 m across; an orb 0.7 m tall; a crate 1.2 m; a debris rock 1.1 m; a panel 2.4 m. */
export const POD_W = 1.6;
export const ORB_H = 0.7;
export const CRATE_W = 1.2;
export const DEBRIS_W = 1.1;
export const PANEL_W = 2.4;

const prop = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET, folder = "space-pod-jump"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   planetoid: { ...prop("m2MiniPlanetoid", "#8a84a0"), fallback: "sphere" },
   // the Warden is a 15k-triangle character-class model: the character budget
   warden: { ...prop("m2OrbitWardenBoss", "#7a7890", CHARACTER_BUDGET), fallback: "sphere" },
   pod: prop("m2SpacePod", "#c8c4d8"),
   deck: prop("m2StationDeck", "#b8b4c8"),
   arm: prop("m2DockingArm", "#a8a4b8"),
   panel: prop("m2SatellitePanel", "#5c6ad8"),
   crate: prop("m2SpaceCrate", "#9a8f78"),
   orb: { ...prop("m2EnergyOrbBlue", "#38bdf8"), fallback: "sphere" },
   asteroid: { ...prop("m2Asteroid", "#7a7480"), fallback: "sphere" },
   ringed: { ...prop("m2RingedPlanetBg", "#7c5cc8"), fallback: "sphere" },
   buoy: prop("m2GravityBuoy", "#b26bff"),
   beacon: prop("checkpointBeacon", "#38e8ff", PROP_BUDGET, "menu2"),
};
