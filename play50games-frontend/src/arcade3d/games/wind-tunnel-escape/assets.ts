// Wind Tunnel Escape's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB). This game's props live in public/models/3d/wind-tunnel-escape (the ready set from
// ~/.play50/hyper3d/ready/menu2/wind-tunnel-escape, plus m2FactoryDrone from ready/menu2/shared and
// m2WindFanTower from ready/menu2/sky-tower-jump); the orb, the checkpoint beacon and the rail carriage
// are the shared Menu 2 ones in public/models/3d/menu2.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   // a pedestal fan, its round grille facing +z, the hub about 1.1 up
   fan: { x: 1.7036, y: 1.9013, z: 0.9627 },
   // a flat floor vent
   vent: { x: 1.8869, y: 0.401, z: 1.8753 },
   // a platform with a fan built in (the lifts)
   lift: { x: 1.8962, y: 0.4247, z: 1.8274 },
   crate: { x: 1.8854, y: 1.159, z: 1.8937 },
   post: { x: 1.4099, y: 1.891, z: 1.4297 },
   // a ring of the wind tube, its axis along x
   tube: { x: 1.8995, y: 1.473, z: 1.4633 },
   tower: { x: 0.9636, y: 1.9013, z: 1.0919 },
   drone: { x: 1.9001, y: 1.8199, z: 0.8567 },
   // the Gale Engine (m2GaleEngineBoss, Hyper3D): a turbine monster, its intake facing +z
   boss: { x: 1.8962, y: 1.5795, z: 1.2027 },
   orb: { x: 1.7664, y: 1.9013, z: 1.7701 },
   beacon: { x: 1.168, y: 1.902, z: 0.989 },
} as const;

/** The fan model's hub (grille centre) height in GLB units: the rules' current runs at HUB over the base. */
export const FAN_HUB_GLB = 1.12;
/** The fan is drawn so its hub sits on the rules' current axis (tunnel.ts HUB = 1.4 m). */
export const FAN_SCALE = 1.4 / FAN_HUB_GLB;
/** Vents are drawn 2.6 m across (the current is 2.6 m wide). */
export const VENT_SCALE = 2.6 / GLB_SIZE.vent.x;
/** A colour orb (the shared scoreOrb) is drawn 0.55 m across. */
export const ORB_SIZE = 0.55;
/** The Gale Engine is drawn this wide (m), filling the arena's end. */
export const BOSS_WIDTH = 13;
export const BOSS_SCALE = BOSS_WIDTH / GLB_SIZE.boss.x;
/** The boss model is a character-sized GLB (15k tris, about 0.8 MB): the character budget. */
export const BOSS_BUDGET = { ...CHARACTER_BUDGET } as const;
/** The drone (an 18k-tri shared creature) is a character-sized GLB too. */
export const DRONE_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "wind-tunnel-escape"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("nami"),
   fan: prop("m2WindFan", "#94a3b8"),
   vent: prop("m2AirVent", "#64748b"),
   lift: prop("m2FanLiftPlatform", "#64748b"),
   crate: prop("m2FlyingCrate", "#b45309"),
   post: prop("m2AnemometerPost", "#cbd5e1"),
   tube: prop("m2WindTubeBg", "#334155"),
   tower: prop("m2WindFanTower", "#475569"),
   drone: { ...prop("m2FactoryDrone", "#7c3aed"), budget: DRONE_BUDGET },
   boss: { ...prop("m2GaleEngineBoss", "#a16207"), budget: BOSS_BUDGET },
   orb: prop("scoreOrb", "#38bdf8", "menu2"),
   beacon: prop("checkpointBeacon", "#38bdf8", "menu2"),
};
