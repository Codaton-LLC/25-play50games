// Tightrope Path's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). This
// game's props live in public/models/3d/tightrope-path (Hyper3D, ~/.play50/hyper3d/ready/menu2): the
// balance beam (the core element), the held balance pole, the lookout tower, the raft, the rock
// pillars and the swinging sandbag. Shared from menu2: the plank bridge, the checkpoint beacon, Umbra
// (m2ShadowArmadillo) and the orb. Every GLB is one mesh, feet on y = 0, centred on x and z; GLB_SIZE is
// the real bounds (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2BalanceBeam: a squared log with sandstone end blocks, long along x, its flat top at y 0.34 */
   beam: { x: 1.907, y: 0.34, z: 0.493 },
   /** m2BalancePole: the held pole, standing along y */
   pole: { x: 0.224, y: 1.898, z: 0.231 },
   /** m2LookoutTower: a jungle watchtower */
   tower: { x: 0.795, y: 1.882, z: 1.115 },
   /** m2RaftPlatform: a raft drifting on the river far below */
   raft: { x: 1.903, y: 0.52, z: 1.892 },
   /** m2RockPillarBg: a rock pillar (the walk's supports and the gorge's background) */
   pillar: { x: 0.786, y: 1.896, z: 0.658 },
   /** m2SwingSandbag: a sandbag on its rope, the rope's top at y 1.84 */
   sandbag: { x: 1.357, y: 1.842, z: 1.148 },
   /** menu2 plankBridge: the wide plank bridge, long along x */
   plank: { x: 1.896, y: 0.548, z: 0.891 },
   /** menu2 checkpointBeacon */
   beacon: { x: 1.168, y: 1.902, z: 0.989 },
   /** menu2 m2ShadowArmadillo: Umbra, facing +z */
   umbra: { x: 1.298, y: 1.535, z: 1.895 },
   /** the shared menu2 orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A beam is drawn 0.42 m wide and 0.3 m thick; a plank bridge 1.5 m wide. */
export const BEAM_W = 0.42;
export const BEAM_T = 0.3;
export const PLANK_W = 1.5;
/** The pole is drawn 2.6 m long, laid across the hero's hands. */
export const POLE_LEN = 2.6;
export const POLE_SCALE = POLE_LEN / GLB_SIZE.pole.y;
/** A lookout tower is drawn 9 m tall; a checkpoint beacon 1.6 m; Umbra 1.7 m (the heroes' height). */
export const TOWER_SCALE = 9 / GLB_SIZE.tower.y;
export const BEACON_SCALE = 1.6 / GLB_SIZE.beacon.y;
export const UMBRA_SCALE = 1.7 / GLB_SIZE.umbra.y;
/** A sandbag hangs 2.4 m (rope top to bag bottom). */
export const SANDBAG_SCALE = 2.4 / GLB_SIZE.sandbag.y;
/** A raft is drawn 5 m across. */
export const RAFT_SCALE = 5 / GLB_SIZE.raft.x;
/** An orb is drawn 0.5 m tall. */
export const ORB_SIZE = 0.5;

const prop = (id: string, color: string, dir = "tightrope-path", budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/${dir}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   beam: prop("m2BalanceBeam", "#8a6a42"),
   pole: prop("m2BalancePole", "#c49a50"),
   tower: prop("m2LookoutTower", "#7a5532"),
   raft: prop("m2RaftPlatform", "#8a6a42"),
   pillar: prop("m2RockPillarBg", "#8d8a7a"),
   sandbag: prop("m2SwingSandbag", "#b89a6a"),
   plank: prop("plankBridge", "#9a7448", "menu2"),
   beacon: prop("checkpointBeacon", "#4ade80", "menu2"),
   umbra: { ...prop("m2ShadowArmadillo", "#3b3355", "menu2", CHARACTER_BUDGET), fallback: "capsule" },
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
