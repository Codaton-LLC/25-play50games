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

/**
 * Menu 1 adoptions (measured on the meshes; floor pivot, centred on x / z). The four building pieces are drawn at exactly
 * the stand-in boxes' sizes (Primitives KIND_SCALE, checked in assets.test.ts) by per-axis stretch, so every drop guide,
 * shadow and stack height is unchanged: buildSlab 1.894 x 0.568 x 1.887, buildColumn 1.322 x 1.901 x 1.224, buildWall
 * 1.893 x 1.635 x 0.555, buildWindow 1.771 x 1.902 x 0.406 (1500 tris each). The roof piece (kind 4) stays code: buildRoof
 * and buildRoofV2 came out as whole houses. craneHook 0.377 x 1.895 x 0.729 is the 1.2 m hook block; craneJibI 0.308 x
 * 1.082 x 1.904 (3000 tris) is the lattice jib with its counterweight, stretched to the code jib's 13.7 m reach
 * (z -3.2..10.5), 0.9 m wide and 1.4 m deep.
 */
export const PIECE_GLB = [
   { width: 1.894, height: 0.568, depth: 1.887 },
   { width: 1.322, height: 1.901, depth: 1.224 },
   { width: 1.893, height: 1.635, depth: 0.555 },
   { width: 1.771, height: 1.902, depth: 0.406 },
] as const;
/** Drawn size of piece kinds 0-3 (slab, pillar, wall, window): the KIND_SCALE boxes. */
export const PIECE_DRAWN = [
   [1.1, 0.28, 1.1],
   [0.34, 0.75, 0.34],
   [1.15, 0.75, 0.22],
   [1.0, 0.75, 0.18],
] as const;
const pieceAsset = (kind: 0 | 1 | 2 | 3, file: string): ModelAsset => ({
   id: file,
   url: `/models/3d/construction-worker/${file}.glb`,
   scale: 1,
   stretch: [PIECE_DRAWN[kind][0] / PIECE_GLB[kind].width, PIECE_DRAWN[kind][1] / PIECE_GLB[kind].height, PIECE_DRAWN[kind][2] / PIECE_GLB[kind].depth],
   fallback: "box",
   fallbackColor: ["#9ca3af", "#d6d3d1", "#fca5a5", "#93c5fd"][kind],
   budget: { ...PROP_BUDGET },
});
export const PIECE_ASSETS = [
   pieceAsset(0, "buildSlab"),
   pieceAsset(1, "buildColumn"),
   pieceAsset(2, "buildWall"),
   pieceAsset(3, "buildWindow"),
] as const;

export const HOOK_GLB = { width: 0.377, height: 1.895, depth: 0.729 } as const;
export const HOOK_HEIGHT = 1.2;
export const JIB_GLB = { width: 0.308, height: 1.082, depth: 1.904 } as const;
export const JIB_DRAWN = { width: 0.9, height: 1.4, length: 13.7, zMin: -3.2, yMin: -0.25 } as const;

export const ASSETS = {
   worker: { ...REUSED_ASSETS.cleaner, scale: WORKER_SCALE },
   // warehouse pallet is 1.90 x 0.52 x 1.90; this site wants 1.2 x 0.15 x 0.8
   pallet: { ...REUSED_ASSETS.pallet, scale: 0.632, stretch: [1, 0.456, 0.667] as const },
   crate: { ...SHARED_ASSETS.crate, scale: 0.8 / 1.88 },
   // pigeon van is 1.17 x 1.04 x 1.89; ~4.5 m along its long axis
   van: { ...REUSED_ASSETS.van, scale: 4.5 / 1.89 },
   craneHook: {
      id: "craneHook",
      url: "/models/3d/construction-worker/craneHook.glb",
      scale: HOOK_HEIGHT / HOOK_GLB.height,
      fallback: "box",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
   craneJib: {
      id: "craneJibI",
      url: "/models/3d/construction-worker/craneJibI.glb",
      scale: 1,
      stretch: [JIB_DRAWN.width / JIB_GLB.width, JIB_DRAWN.height / JIB_GLB.height, JIB_DRAWN.length / JIB_GLB.depth] as const,
      fallback: "box",
      fallbackColor: "#facc15",
      budget: { ...PROP_BUDGET },
   },
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
