// Models used by Zoo Escape (plain data). Every GLB is already in core/modelManifest.ts: the panda,
// the keeper and the bamboo are this game's (Hyper3D, imported), the rest is shared or reused. Every
// fit is derived from the measured GLB bounds (GLB units, feet on y = 0, centred on x / z) and
// checked on the real meshes in assets.test.ts.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_CHARACTERS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { COLORS } from "./looks";

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

/** zooKiosk.glb raw bounds, measured on the mesh (assets.test.ts): the whole booth, canopy baked in. */
export const KIOSK_GLB = { width: 1.52019, height: 1.89732, depth: 1.19289 } as const;
/** Drawn as a 1 m tall unit; each kiosk spot scales it to 2.6 m high and to its collision footprint. */
export const KIOSK_UNIT = 1 / KIOSK_GLB.height;

/** leafyBush.glb raw bounds, measured on the mesh. */
export const BUSH_GLB = { width: 1.7575, height: 1.40103, depth: 1.80491 } as const;
/** Refit to the bush stand-in's 1 x 0.9 x 1 unit; spots scale it to box width + 0.5 on x/z. */
export const BUSH_UNIT = 0.9 / BUSH_GLB.height;
export const BUSH_STRETCH = [BUSH_GLB.height / (BUSH_GLB.width * 0.9), 1, BUSH_GLB.height / (BUSH_GLB.depth * 0.9)] as const;

/** woodenFootbridge.glb raw bounds, measured on the mesh; `deck` is the walk-slab top. */
export const BRIDGE_GLB = { width: 1.34601, height: 0.90177, depth: 1.89462, deck: 0.38 } as const;
/** Drawn 2.6 m long (the moat span); sunk so the deck top lands on the stand-in's 0.165 and the rails top out at ~0.88. */
export const BRIDGE_SCALE = 2.6 / BRIDGE_GLB.depth;
export const BRIDGE_DECK_TOP = 0.165;
export const BRIDGE_Y_OFFSET = BRIDGE_DECK_TOP - BRIDGE_GLB.deck * BRIDGE_SCALE;

/** searchlightTower.glb raw bounds, measured on the mesh: legs, braced platform and railing wall (no lamp head). */
export const TOWER_GLB = { width: 1.02597, height: 1.9021, depth: 1.04968 } as const;
/** Drawn 4.4 m so the beam apex (LIGHT_HEIGHT = 4.5) starts just above the railing; footprint kept at 1.6 m (tower stands outside the stage fence). */
export const TOWER_SCALE = 4.4 / TOWER_GLB.height;
export const TOWER_STRETCH = [1.6 / (TOWER_GLB.width * TOWER_SCALE), 1, 1.6 / (TOWER_GLB.depth * TOWER_SCALE)] as const;

/** bambooSnack.glb raw bounds, measured on the mesh: a flat spread pile, not an upright bundle. */
export const SNACK_GLB = { width: 1.84126, height: 0.54056, depth: 1.7951 } as const;
/**
 * The pile is wide and flat, so it is fitted by its width: the snack pool draws it x1.6, 1.0 m across
 * (about the 0.8 m eating reach plus a little) and 0.29 m tall. Fitted by the stand-in's 0.42 m height
 * it drew 2.3 m across and covered the keepers' feet and the snack glow (review 2026-10-25).
 */
export const SNACK_DRAWN_WIDTH = 1.0;
export const SNACK_UNIT = SNACK_DRAWN_WIDTH / 1.6 / SNACK_GLB.width;

/** zooRocks.glb (Group D, QA "OK"): five boulders. 2.2 m across, outside the three stages. */
export const ZOO_ROCKS_GLB = { width: 1.9048, height: 0.9073, depth: 1.8028 } as const;
export const ZOO_ROCKS_WIDTH = 2.2;
const ZOO_ROCKS_SCALE = ZOO_ROCKS_WIDTH / ZOO_ROCKS_GLB.width;
export const ZOO_ROCKS_DRAWN = {
   width: ZOO_ROCKS_WIDTH,
   height: ZOO_ROCKS_GLB.height * ZOO_ROCKS_SCALE,
   depth: ZOO_ROCKS_GLB.depth * ZOO_ROCKS_SCALE,
} as const;
/** East of the tree row (x ~14-18) and west of it, in the z gaps so the clusters don't sit on a tree. */
export const ZOO_ROCK_SPOTS = [
   { x: 19.5, y: 0, z: 4, rotY: 0.4 },
   { x: 19.5, y: 0, z: -21, rotY: 1.3 },
   { x: 19.5, y: 0, z: -27, rotY: 2.2 },
   { x: -18.5, y: 0, z: 12, rotY: 0.8 },
] as const;
export const ZOO_ROCK_FALLBACK = ZOO_ROCK_SPOTS.map((s) => ({ ...s, y: ZOO_ROCKS_DRAWN.height / 2 }));

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
   kiosk: { id: "kiosk", url: "/models/3d/zoo-escape/zooKiosk.glb", scale: KIOSK_UNIT, fallback: "box", fallbackColor: COLORS.kiosk, budget: { ...PROP_BUDGET } },
   bush: { id: "bush", url: "/models/3d/zoo-escape/leafyBush.glb", scale: BUSH_UNIT, stretch: BUSH_STRETCH, fallback: "sphere", fallbackColor: COLORS.leaf, budget: { ...PROP_BUDGET } },
   bridge: { id: "bridge", url: "/models/3d/zoo-escape/woodenFootbridge.glb", scale: BRIDGE_SCALE, yOffset: BRIDGE_Y_OFFSET, fallback: "box", fallbackColor: COLORS.wood, budget: { ...PROP_BUDGET } },
   tower: { id: "tower", url: "/models/3d/zoo-escape/searchlightTower.glb", scale: TOWER_SCALE, stretch: TOWER_STRETCH, fallback: "cylinder", fallbackColor: COLORS.metalDark, budget: { ...PROP_BUDGET } },
   snack: { id: "snack", url: "/models/3d/zoo-escape/bambooSnack.glb", scale: SNACK_UNIT, fallback: "cylinder", fallbackColor: COLORS.bamboo, budget: { ...PROP_BUDGET } },
   zooRocks: { id: "zooRocks", url: "/models/3d/zoo-escape/zooRocks.glb", scale: ZOO_ROCKS_SCALE, fallback: "sphere", fallbackColor: COLORS.rock, budget: { ...PROP_BUDGET } },
} satisfies Record<string, ModelAsset>;
