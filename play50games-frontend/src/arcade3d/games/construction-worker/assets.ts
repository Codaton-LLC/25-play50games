// The reused clean-city cleaner (orange hi-vis vest) as the worker, reused pallet and van, shared crate,
// and one GLB of its own: the cement mixer (batch 5, already in the manifest), site decor.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { CLEANER_LANDMARKS, PROP_BUDGET, REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/**
 * The worker is clean-city's cleaner (REUSED_ASSETS.cleaner: the street cleaner in an orange hi-vis
 * vest, measured CLEANER_LANDMARKS, both in core so no game imports another's folder) until a
 * construction-worker GLB is generated; the procedural yellow hard hat makes him a builder.
 * cleaner.glb is 1.9022 tall (its top of the head, assets.test.ts); the scale keeps the 1.556 m the
 * runner was drawn at here (office-escape's runner at 0.825).
 */
export const WORKER_LANDMARKS = CLEANER_LANDMARKS;
export const WORKER_GLB_HEIGHT = 1.9022;
export const WORKER_HEIGHT = 1.556;
export const WORKER_SCALE = WORKER_HEIGHT / WORKER_GLB_HEIGHT;
/**
 * The hard hat on the head anchor (the top of the head; metres, the anchor undoes the scale): 1.15x
 * Primitives' hat (dome radius 0.138 m, brim 0.178 m) over the cleaner's big head (0.128 m half-wide),
 * the brim 9.6 cm below the crown and the dome 5 cm over it, so it covers the hair (assets.test.ts checks it on the mesh).
 */
export const WORKER_HAT = { scale: 1.15, y: -0.11, z: 0 } as const;

/**
 * cementMixer.glb (batch 5, Hyper3D, 1500 tris) 1.660 x 1.854 x 1.896, floor pivot, centred on x / z.
 * Drawn 1.25 m tall (1.12 x 1.28 m on the ground), turned by MIXER.yaw.
 */
export const MIXER_GLB = { width: 1.6604, height: 1.8541, depth: 1.8964 } as const;
export const MIXER_HEIGHT = 1.25;
const MIXER_SCALE = MIXER_HEIGHT / MIXER_GLB.height;
/** Where it stands on the site (m): beside the work zone on the -x side, outside the crane's wedge. */
export const MIXER = { x: -6.6, z: 6.05, yaw: 0.9 } as const;

/**
 * Decor spots for cement mixers outside the play area on levels 4 & 5 (Shop Front & Mini Tower).
 * 2-4 copies placed beside the site perimeter where other decor already sits.
 */
export const MIXER_SPOTS: readonly InstanceSpot[] = [
   // Beside the work zone on the -x side (matches MIXER from mixer.test.ts)
   { x: MIXER.x, y: 0, z: MIXER.z, rotY: MIXER.yaw },
   // Northwest perimeter near the corner fence and barriers
   { x: -6.6, y: 0, z: 9.8, rotY: 0.3 },
   // East perimeter outside the worker and building area
   { x: 6.6, y: 0, z: 5.8, rotY: -1.2 },
   // Northeast perimeter near the corner fence
   { x: 6.6, y: 0, z: 9.8, rotY: -0.5 },
];

export const ASSETS = {
   worker: { ...REUSED_ASSETS.cleaner, scale: WORKER_SCALE },
   // warehouse pallet is 1.90 x 0.52 x 1.90; this site wants 1.2 x 0.15 x 0.8
   pallet: { ...REUSED_ASSETS.pallet, scale: 0.632, stretch: [1, 0.456, 0.667] as const },
   crate: { ...SHARED_ASSETS.crate, scale: 0.8 / 1.88 },
   // pigeon van is 1.17 x 1.04 x 1.89; ~4.5 m along its long axis
   van: { ...REUSED_ASSETS.van, scale: 4.5 / 1.89 },
   cementMixer: {
      id: "cementMixer",
      url: "/models/3d/construction-worker/cementMixer.glb",
      scale: MIXER_SCALE,
      rotationY: 0,
      yOffset: 0,
      fallback: "cylinder",
      fallbackColor: "#f97316",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
