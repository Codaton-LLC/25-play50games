// Sky Hook Swing's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts).
// Every GLB has its feet on y = 0, centred on x and z (the optimizer's pivot). GLB_SIZE is the real
// mesh (assets.test.ts); `top` is the walkable top (the most common cell top, measured once).
// The rings, cables, rope, claw, net, windmill rotor, galleon hull, mast, sail and bell stay in code
// (markers, ropes and moving parts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), metres in the file. */
export const GLB_SIZE = {
   airship: { x: 1.8314, y: 1.8278, z: 1.8901 },
   drone: { x: 1.9001, y: 1.8199, z: 0.8567 },
   post: { x: 1.8725, y: 1.8934, z: 1.8776 },
   postV2: { x: 1.2771, y: 1.8897, z: 1.2484 },
   pad: { x: 1.8608, y: 0.2158, z: 1.8932 },
   anchor: { x: 1.8313, y: 1.9013, z: 1.8255 },
   anchorV2: { x: 1.4369, y: 1.8886, z: 1.4997 },
   island: { x: 1.8758, y: 1.3988, z: 1.9046 },
   windmill: { x: 1.9043, y: 1.5666, z: 1.8071 },
   turret: { x: 1.7013, y: 1.9162, z: 1.7464 },
   crate: { x: 1.8854, y: 1.159, z: 1.8937 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   platform: { x: 1.8908, y: 0.5899, z: 1.8919 },
   bank: { x: 0.8014, y: 1.7608, z: 1.9096 },
} as const;

/** The walkable top of a deck GLB (file metres over its feet): the platform's grass, the pad's wood. */
export const GLB_TOP = { platform: 0.575, pad: 0.205 } as const;

/** A hanging balloon over a ring is this tall (m); a level 3 airship, this tall. */
export const BALLOON_HEIGHT = 3.4;
export const SHIP_HEIGHT = 7.2;
/** The ring hangs this far under the balloon's basket (m). */
export const RING_DROP = 2.2;
/** The background airship's width (m). */
export const AIRSHIP_WIDTH = 16;
/** A drone's width (m). The file is over the prop byte budget, so it uses the character budget. */
export const DRONE_WIDTH = 2.2;
export const DRONE_BUDGET = { ...CHARACTER_BUDGET } as const;
/** A galleon turret is drawn this tall (m), its floating rock under the rules' turret point. */
export const TURRET_HEIGHT = 4.2;
/** A deck's floating slab is this thick under its grass (m) at the platform's own proportions. */
export const deckScale = (r: number): number => (2 * r) / GLB_SIZE.platform.x;

const prop = (id: string, color: string, url = `/models/3d/sky-hook-swing/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("nami"),
   island: prop("m2SwingIsland", "#e2e8f0"),
   windmill: prop("m2WindmillIsland", "#cbd5e1"),
   anchor: prop("m2SwingAnchorV2", "#f8fafc"),
   anchorOld: prop("m2SwingAnchor", "#94a3b8"),
   post: prop("m2GrappleRingPostV2", "#e2e8f0"),
   postOld: prop("m2GrappleRingPost", "#64748b"),
   pad: prop("m2LandingTargetPad", "#fde68a"),
   airship: { ...prop("m2AirshipBg", "#bfdbfe"), fallback: "sphere" },
   drone: { ...prop("m2FactoryDrone", "#334155"), budget: DRONE_BUDGET },
   turret: prop("m2SkyCannonTurret", "#475569"),
   crate: prop("m2FlyingCrate", "#9a7448", "/models/3d/flooded-ruins-escape/m2FlyingCrate.glb"),
   beacon: { ...prop("checkpointBeacon", "#38bdf8", "/models/3d/menu2/checkpointBeacon.glb"), fallback: "cylinder" },
   platform: prop("skyPlatform", "#86efac", "/models/3d/sky-tower-jump/skyPlatform.glb"),
   bank: {
      id: "m2CloudBank",
      url: "/models/3d/cloud-hopper/m2CloudBank.glb",
      fallback: "sphere",
      fallbackColor: "#e8f0fb",
      budget: PROP_BUDGET,
   },
};

/** Scale that makes a GLB axis `size` draw as `metres`. */
export function fit(size: number, metres: number): number {
   return metres / size;
}
