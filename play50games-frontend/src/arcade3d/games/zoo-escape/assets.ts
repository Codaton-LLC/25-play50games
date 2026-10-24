// Models used by Zoo Escape (plain data). Every GLB is already in core/modelManifest.ts: the panda,
// the keeper and the bamboo are this game's (Hyper3D, imported), the rest is shared or reused. Every
// fit is derived from the measured GLB bounds (GLB units, feet on y = 0, centred on x / z) and
// checked on the real meshes in assets.test.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_CHARACTERS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";

/** The panda is drawn 1.15 m long on all fours (Decision Q1), so it reads at 24 px on a landscape phone. */
export const PANDA_LENGTH = 1.15;
/** The keeper's default fit: 1.75 m (Decision Q6). */
export const KEEPER_SCALE = EXPANSION_CHARACTERS.keeper.scale ?? 1;

/** bamboo.glb (zoo-escape, Hyper3D 2026-10-24) raw bounds, measured on the mesh (assets.test.ts). */
export const BAMBOO_GLB = { width: 1.3526, height: 1.746, depth: 1.2268 } as const;
/** The bamboo asset is a 1 m wide unit; each spot scales it (solid clumps tall, hiding thickets squat). */
export const BAMBOO_UNIT = 1 / BAMBOO_GLB.width;
/** Drawn sizes (m): a solid clump 1.4 wide x 2.4 tall on its 1.2 m box; a stage-1 hiding thicket 2.0 wide x 1.35 tall on its 1.8 m box. */
export const BAMBOO_CLUMP = { width: 1.4, height: 2.4 } as const;
export const BAMBOO_THICKET = { width: 2.0, height: 1.35 } as const;

/** Reused props: drawn sizes (m) from REUSED_GLB_SIZE. */
export const PROP_SIZE = { benchLength: 2.0, binHeight: 0.9, lampHeight: 3.0, palmHeight: 3.0, carLength: 4.2 } as const;

const R = REUSED_GLB_SIZE;

export const ASSETS = {
   panda: { ...EXPANSION_ASSETS.panda, scale: PANDA_LENGTH / EXPANSION_GLB_SIZE.panda.depth },
   keeper: EXPANSION_CHARACTERS.keeper,
   rock: EXPANSION_ASSETS.rock,
   leafyTree: EXPANSION_ASSETS.leafyTree,
   bamboo: { id: "bamboo", url: "/models/3d/zoo-escape/bamboo.glb", scale: BAMBOO_UNIT, fallback: "cylinder", fallbackColor: "#65a30d", budget: { ...PROP_BUDGET } },
   bench: { ...REUSED_ASSETS.bench, scale: PROP_SIZE.benchLength / R.bench.width },
   bin: { ...REUSED_ASSETS.bin, scale: PROP_SIZE.binHeight / R.bin.height },
   lamp: { ...REUSED_ASSETS.lamp, scale: PROP_SIZE.lampHeight / R.lamp.height },
   palm: { ...REUSED_ASSETS.palm, scale: PROP_SIZE.palmHeight / R.palm.height },
   car: { ...REUSED_ASSETS.car, scale: PROP_SIZE.carLength / R.car.depth },
} satisfies Record<string, ModelAsset>;
