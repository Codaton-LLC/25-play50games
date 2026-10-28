// Models used by Treasure Island. Plain data, no three.js: index.tsx hands them to GameShell (which
// frees the GLBs when the game closes), Scene.tsx / Island.tsx draw them. No GLB of its own but the
// crab (assets.spec.json, already generated) and the shovel (batch 5, already in the manifest): the rest is shared (SHARED_ASSETS), reused from the
// original games (REUSED_ASSETS) or from the expansion batch (EXPANSION_ASSETS). Every fit is derived
// from measured GLB bounds (GLB units, w x h x d, the optimize step centres x and z, feet on y = 0)
// and checked on the real meshes in assets.test.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { InstanceSpot } from "@/arcade3d/core/render";
import { COIN_GLB_SIZE, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, RUNNER_LANDMARKS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

/** The runner is 1.886 tall (T-pose): 0.825 draws it 1.556 m, office-escape's explorer height. */
export const EXPLORER_SCALE = 0.825;

/** palm.glb 1.775 x 1.903 x 1.782; its trunk leans: the base (y < 0.1) is centred at GLB (0, 0.19). */
export const PALM_GLB = { width: 1.775, height: 1.903, depth: 1.782, baseX: 0, baseZ: 0.19 } as const;
/** Drawn 3.0 m tall with a 2.4 m crown; the trunk base is about 0.54 m across (footprint r 0.3). */
export const PALM_SIZE = { height: 3, crown: 2.4 } as const;
const PALM_XZ = PALM_SIZE.crown / PALM_GLB.width;

/**
 * umbrella.glb 1.780 x 1.902 x 1.737, the pole about 0.09 across at the origin, the canopy's lowest
 * edge at GLB y 1.175. Drawn uniformly 2.8 m tall (canopy 2.62 across, its edge 1.73 m up), so the
 * hatted 1.56 m explorer walks under it; the design's 2.2 m put the canopy edge at its eyes.
 */
export const UMBRELLA_GLB = { height: 1.902, canopyEdge: 1.175 } as const;
export const UMBRELLA_HEIGHT = 2.8;

/** pigeon.glb 0.99 x 1.903 x 1.744, head at +z: a 0.8 m long seagull (0.6 m read as a speck from 4.5 m up). */
export const PIGEON_GLB_LENGTH = 1.744;
export const GULL_LENGTH = 0.8;

/** crate.glb 1.880 x 1.335 x 1.810: 0.8 m across (0.57 m tall). */
export const CRATE_GLB_WIDTH = 1.88;
export const CRATE_SIZE = 0.8;

/** The coin: 0.3 m across, its origin at its centre (it is laid flat in the piles). */
export const COIN_SIZE = 0.3;
const COIN_SCALE = COIN_SIZE / COIN_GLB_SIZE.width;

/** The crab: 0.5 m across its claws (the default fit's 0.35 is 9 px on a phone). */
export const CRAB_WIDTH = 0.5;

/**
 * shovel.glb (batch 5, Hyper3D, 1500 tris) 0.817 x 1.904 x 0.255, optimized with its floor pivot at the
 * blade's edge (y 0) and centred on x / z. It stands UPRIGHT (not lying flat), the blade up to y 0.85
 * (0.82 wide, dished: the cup faces +z), the shaft at x 0 from y 0.85 to 1.55, the D-grip above it
 * (x -0.23..0.17, y 1.6..1.9). Drawn 0.95 m long: blade 0.41 wide, the hand's grasp on the shaft 0.77 m up.
 */
export const SHOVEL_GLB = { width: 0.8171, height: 1.9039, depth: 0.2548, bladeTop: 0.85, grasp: 1.55 } as const;
export const SHOVEL_LENGTH = 0.95;
const SHOVEL_SCALE = SHOVEL_LENGTH / SHOVEL_GLB.height;
/** Where the hand closes on the shaft, up from the blade's edge (m): just under the D-grip. */
export const SHOVEL_GRASP = SHOVEL_GLB.grasp * SHOVEL_SCALE;

/**
 * beachRocks.glb (Group D, QA "OK"): a low cluster. The unit is 1.4 m across, the same diameter
 * as the outer-reef icosahedron, so each OUTER_ROCKS spot scale keeps its old footprint.
 */
export const BEACH_ROCKS_GLB = { width: 1.8817, height: 0.4562, depth: 1.7992 } as const;
export const BEACH_ROCKS_WIDTH = 1.4;
const BEACH_ROCKS_SCALE = BEACH_ROCKS_WIDTH / BEACH_ROCKS_GLB.width;

/**
 * jungleTotem.glb (batch 5 / extra decor, Hyper3D) 0.688 x 1.888 x 0.706, floor pivot at y 0,
 * centred on x / z. Drawn 2.2 m tall (footprint ~0.8 x 0.8 m) on distant atolls in levels 4 & 5.
 */
export const JUNGLE_TOTEM_GLB = { width: 0.6879, height: 1.8884, depth: 0.7061 } as const;
export const JUNGLE_TOTEM_HEIGHT = 2.2;
const JUNGLE_TOTEM_SCALE = JUNGLE_TOTEM_HEIGHT / JUNGLE_TOTEM_GLB.height;

/** Decor spots for jungle totems outside the play area on levels 4 & 5 (Jungle Interior & Pirate Peak). */
export const TOTEM_SPOTS: readonly InstanceSpot[] = [
   // Northwest atoll (near outer palms, facing towards the island)
   { x: -23, y: 0.05, z: -17, rotY: 0.5 },
   // Northeast atoll (near outer palms, facing towards the island)
   { x: 23, y: 0.05, z: -17, rotY: -0.5 },
   // Far North islet twin totems (flanking the islet, facing south towards the camera)
   { x: -2.5, y: 0.05, z: -28, rotY: 0.2 },
   { x: 2.5, y: 0.05, z: -28, rotY: -0.2 },
];

/**
 * palmTreeI.glb (Menu 1 adoption, 3000 tris) 1.606 x 1.896 x 1.712, floor pivot at y 0, centred on x / z:
 * a curved ringed trunk, frond crown, coconuts, rock base. Drawn 3.4 m tall (the old code palm was ~3.3 m)
 * on the distant atolls only; the playable palms keep palm.glb and their footprints.
 */
export const PALM_I_GLB = { width: 1.606, height: 1.896, depth: 1.712 } as const;
export const PALM_I_HEIGHT = 3.4;
const PALM_I_SCALE = PALM_I_HEIGHT / PALM_I_GLB.height;

/** rowboat.glb 0.904 x 0.589 x 1.896 (bow along z), floor pivot. Drawn 2.4 m long, pulled up on distant beaches. */
export const ROWBOAT_GLB = { width: 0.904, height: 0.589, depth: 1.896 } as const;
export const ROWBOAT_LENGTH = 2.4;
const ROWBOAT_SCALE = ROWBOAT_LENGTH / ROWBOAT_GLB.depth;

/** treasureGem.glb 1.9 x 1.832 x 1.891, floor pivot. Drawn 0.55 m tall: gems glinting on the distant atolls. */
export const TREASURE_GEM_GLB = { width: 1.9, height: 1.832, depth: 1.891 } as const;
export const TREASURE_GEM_HEIGHT = 0.55;
const TREASURE_GEM_SCALE = TREASURE_GEM_HEIGHT / TREASURE_GEM_GLB.height;

/** Rowboats beached on the distant atolls (every level), clear of the palms and the play area. */
export const ROWBOAT_SPOTS: readonly InstanceSpot[] = [
   { x: -21, y: 0.05, z: -14.5, rotY: 0.9 },
   { x: 23.5, y: 0.05, z: -14, rotY: -0.7 },
   { x: 24.5, y: 0.05, z: 1.5, rotY: 1.9 },
   { x: -25, y: 0.05, z: 2.5, rotY: 2.6 },
];

/** Gems lying on the atolls beside the boats. */
export const GEM_SPOTS: readonly InstanceSpot[] = [
   { x: -22.4, y: 0.05, z: -14.2, rotY: 0.4 },
   { x: 24.9, y: 0.05, z: -13.2, rotY: 1.6 },
   { x: 25.6, y: 0.05, z: 2.6, rotY: 2.2, scale: 0.8 },
];

export const ASSETS = {
   explorer: { ...SHARED_ASSETS.runner, scale: EXPLORER_SCALE, humanoid: { landmarks: RUNNER_LANDMARKS } },
   chest: EXPANSION_ASSETS.chest,
   rock: EXPANSION_ASSETS.rock,
   palm: { ...REUSED_ASSETS.palm, scale: PALM_XZ, stretch: [1, PALM_SIZE.height / PALM_GLB.height / PALM_XZ, PALM_SIZE.crown / PALM_GLB.depth / PALM_XZ] as const },
   umbrella: { ...REUSED_ASSETS.umbrella, scale: UMBRELLA_HEIGHT / UMBRELLA_GLB.height },
   crate: { ...SHARED_ASSETS.crate, scale: CRATE_SIZE / CRATE_GLB_WIDTH },
   coin: { ...SHARED_ASSETS.coin, scale: COIN_SCALE, yOffset: (-COIN_SCALE * COIN_GLB_SIZE.height) / 2 },
   gull: { ...REUSED_ASSETS.pigeon, id: "gull", scale: GULL_LENGTH / PIGEON_GLB_LENGTH, material: { color: "#f8fafc", roughness: 0.7 } },
   crab: { ...EXPANSION_ASSETS.crab, scale: CRAB_WIDTH / EXPANSION_GLB_SIZE.crab.width },
   shovel: {
      id: "shovel",
      url: "/models/3d/treasure-island/shovel.glb",
      scale: SHOVEL_SCALE,
      fallback: "cylinder",
      fallbackColor: "#94a3b8",
      budget: { ...PROP_BUDGET },
   },
   beachRocks: {
      id: "beachRocks",
      url: "/models/3d/treasure-island/beachRocks.glb",
      scale: BEACH_ROCKS_SCALE,
      fallback: "sphere",
      fallbackColor: "#78716c",
      budget: { ...PROP_BUDGET },
   },
   palmTreeI: {
      id: "palmTreeI",
      url: "/models/3d/treasure-island/palmTreeI.glb",
      scale: PALM_I_SCALE,
      fallback: "cylinder",
      fallbackColor: "#15803d",
      budget: { ...PROP_BUDGET },
   },
   rowboat: {
      id: "rowboat",
      url: "/models/3d/treasure-island/rowboat.glb",
      scale: ROWBOAT_SCALE,
      fallback: "box",
      fallbackColor: "#92400e",
      budget: { ...PROP_BUDGET },
   },
   treasureGem: {
      id: "treasureGem",
      url: "/models/3d/treasure-island/treasureGem.glb",
      scale: TREASURE_GEM_SCALE,
      fallback: "sphere",
      fallbackColor: "#22d3ee",
      budget: { ...PROP_BUDGET },
   },
   jungleTotem: {
      id: "jungleTotem",
      url: "/models/3d/treasure-island/jungleTotem.glb",
      scale: JUNGLE_TOTEM_SCALE,
      rotationY: 0,
      yOffset: 0,
      fallback: "cylinder",
      fallbackColor: "#78350f",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** Where a palm's footprint centre (its trunk base) is drawn from the model's origin, rotated by `yaw`. */
export function palmBaseOffset(yaw: number, size: number): { x: number; z: number } {
   const bx = PALM_GLB.baseX * PALM_XZ * size;
   const bz = PALM_GLB.baseZ * PALM_SIZE.crown / PALM_GLB.depth * size;
   const c = Math.cos(yaw);
   const s = Math.sin(yaw);
   return { x: bx * c + bz * s, z: -bx * s + bz * c };
}
