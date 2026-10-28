// Sky Hook Swing's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// Props live in public/models/3d/sky-hook-swing. GLB_SIZE is the real mesh (assets.test.ts): feet
// on y = 0, centred on x and z. The rope, the claw and the cannon turrets stay in code.
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
} as const;

/** A ring or post is drawn this tall (m), its top on the rules' hook point. */
export const ANCHOR_HEIGHT = 2.4;
/** The background airship's width (m). */
export const AIRSHIP_WIDTH = 16;
/** A drone's width (m). The file is over the prop byte budget, so it uses the character budget. */
export const DRONE_WIDTH = 1.7;
export const DRONE_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/sky-hook-swing/${id}.glb`,
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
   airship: prop("m2AirshipBg", "#bfdbfe"),
   drone: { ...prop("m2FactoryDrone", "#334155"), budget: DRONE_BUDGET },
   bank: {
      id: "m2CloudBank",
      url: "/models/3d/cloud-hopper/m2CloudBank.glb",
      fallback: "box",
      fallbackColor: "#e8f0fb",
      budget: PROP_BUDGET,
   },
};

/** Scale that makes a GLB axis `size` draw as `metres`. */
export function fit(size: number, metres: number): number {
   return metres / size;
}
