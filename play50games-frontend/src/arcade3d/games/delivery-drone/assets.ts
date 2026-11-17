import type { ModelAsset } from "@/arcade3d/core/types";
import { DRONE_ROTORS_GLB, EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

export const DRONE_SCALE = 0.9 / EXPANSION_GLB_SIZE.drone.width;
export const DRONE_HOOK = EXPANSION_GLB_POINTS.droneHook;
export const BODY_OFFSET = [-DRONE_HOOK.x * DRONE_SCALE, 0, -DRONE_HOOK.z * DRONE_SCALE] as const;
export const ROTORS = DRONE_ROTORS_GLB.map((p) => ({ x: (p.x - DRONE_HOOK.x) * DRONE_SCALE, y: (p.y - DRONE_HOOK.y) * DRONE_SCALE, z: (p.z - DRONE_HOOK.z) * DRONE_SCALE }));
/**
 * Group D skyline variety (QA "OK"), in the gap between the procedural rows at z -37 and z -48.
 * Footprint 4.2 m keeps them clear of both rows. Brick mid-rises and glass towers alternate.
 */
export const BRICK_GLB = { width: 1.3362, height: 1.8988, depth: 1.3209 } as const;
export const GLASS_GLB = { width: 1.2354, height: 1.8964, depth: 1.2622 } as const;
export const SKYLINE_FOOTPRINT = 4.2;
export const BRICK_HEIGHT = 10;
export const GLASS_HEIGHT = 16;
export const SKYLINE_Z = -42.25;
const brickScale = BRICK_HEIGHT / BRICK_GLB.height;
const glassScale = GLASS_HEIGHT / GLASS_GLB.height;
export const BRICK_STRETCH = [
   SKYLINE_FOOTPRINT / (BRICK_GLB.width * brickScale),
   1,
   SKYLINE_FOOTPRINT / (BRICK_GLB.depth * brickScale),
] as const;
export const GLASS_STRETCH = [
   SKYLINE_FOOTPRINT / (GLASS_GLB.width * glassScale),
   1,
   SKYLINE_FOOTPRINT / (GLASS_GLB.depth * glassScale),
] as const;
const SKYLINE_X = [-24, -16, -8, 0, 8, 16, 24] as const;
export const BRICK_SPOTS = SKYLINE_X.filter((_, i) => i % 2 === 0).map((x, i) => ({ x, y: 0, z: SKYLINE_Z, rotY: i % 2 ? Math.PI / 2 : 0 }));
export const GLASS_SPOTS = SKYLINE_X.filter((_, i) => i % 2 === 1).map((x, i) => ({ x, y: 0, z: SKYLINE_Z, rotY: i % 2 ? 0 : Math.PI / 2 }));
export const BRICK_FALLBACK = BRICK_SPOTS.map((s) => ({ ...s, y: BRICK_HEIGHT / 2 }));
export const GLASS_FALLBACK = GLASS_SPOTS.map((s) => ({ ...s, y: GLASS_HEIGHT / 2 }));

/**
 * Menu 1 adoptions (measured, floor pivot, centred on x / z):
 * cityBuildingTall.glb 1.261 x 1.893 x 1.150 (3000 tris), cityBuildingV2.glb 1.888 x 1.654 x 1.876 (3000 tris),
 * cardboardParcel.glb 1.896 x 1.036 x 1.869 (1500 tris). The two towers stand in a back row at z -55, between the
 * z -48 and z -62 procedural rows (their footprints are 6.5 / 8 m wide and cannot reach it): the Tall tower drawn
 * 4.6 m across and stretched up to ~11.7 m, the V2 block 6.0 m across and 8 m tall. The parcel is the 0.4 m
 * cube's size (0.4 x 0.3 x 0.4 drawn, the box hit box is unchanged).
 */
export const TALL_GLB = { width: 1.261, height: 1.893, depth: 1.15 } as const;
export const BLOCK_GLB = { width: 1.888, height: 1.654, depth: 1.876 } as const;
export const PARCEL_GLB = { width: 1.896, height: 1.036, depth: 1.869 } as const;
export const BACK_ROW_Z = -55;
export const TALL_WIDTH = 4.6;
export const TALL_HEIGHT = 11.7;
export const BLOCK_WIDTH = 6;
export const BLOCK_HEIGHT = 8;
export const PARCEL_DRAWN = { width: 0.4, height: 0.3 } as const;
const tallScale = TALL_WIDTH / TALL_GLB.width;
const blockScale = BLOCK_WIDTH / BLOCK_GLB.width;
const parcelScale = PARCEL_DRAWN.width / PARCEL_GLB.width;
const BACK_X = [-78, -65, -52, -39, -26, -13, 0, 13, 26, 39, 52, 65, 78] as const;
export const TALL_SPOTS = BACK_X.filter((_, i) => i % 2 === 0).map((x, i) => ({ x, y: 0, z: BACK_ROW_Z, rotY: i % 2 ? Math.PI : 0 }));
export const BLOCK_SPOTS = BACK_X.filter((_, i) => i % 2 === 1).map((x, i) => ({ x, y: 0, z: BACK_ROW_Z, rotY: i % 2 ? Math.PI / 2 : 0 }));
export const TALL_FALLBACK = TALL_SPOTS.map((s) => ({ ...s, y: TALL_HEIGHT / 2 }));
export const BLOCK_FALLBACK = BLOCK_SPOTS.map((s) => ({ ...s, y: BLOCK_HEIGHT / 2 }));

export const ASSETS = {
   drone: { ...EXPANSION_ASSETS.drone, scale: DRONE_SCALE, yOffset: -DRONE_HOOK.y * DRONE_SCALE },
   car: { ...REUSED_ASSETS.car, scale: 1.6 / 1.9 },
   taxi: { ...REUSED_ASSETS.taxi, scale: 1.6 / 1.9 },
   van: { ...REUSED_ASSETS.van, scale: 2 / 1.9 },
   pigeon: { ...REUSED_ASSETS.pigeon, scale: 0.6 / 0.99 },
   crate: { ...SHARED_ASSETS.crate, scale: 0.8 / 1.88 },
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: 3 / EXPANSION_GLB_SIZE.leafyTree.height },
   cityTall: {
      id: "cityTall",
      url: "/models/3d/delivery-drone/cityBuildingTall.glb",
      scale: tallScale,
      stretch: [1, TALL_HEIGHT / (TALL_GLB.height * tallScale), 1] as const,
      fallback: "box",
      fallbackColor: "#94a3b8",
      budget: { ...PROP_BUDGET },
   },
   cityBlock: {
      id: "cityBlock",
      url: "/models/3d/delivery-drone/cityBuildingV2.glb",
      scale: blockScale,
      stretch: [1, BLOCK_HEIGHT / (BLOCK_GLB.height * blockScale), 1] as const,
      fallback: "box",
      fallbackColor: "#cbd5e1",
      budget: { ...PROP_BUDGET },
   },
   parcel: {
      id: "parcel",
      url: "/models/3d/delivery-drone/cardboardParcel.glb",
      scale: parcelScale,
      stretch: [1, PARCEL_DRAWN.height / (PARCEL_GLB.height * parcelScale), 1] as const,
      fallback: "box",
      fallbackColor: "#b98955",
      budget: { ...PROP_BUDGET },
   },
   brick: {
      id: "brick",
      url: "/models/3d/delivery-drone/cityBrickApartment.glb",
      scale: brickScale,
      stretch: BRICK_STRETCH,
      fallback: "box",
      fallbackColor: "#9a3412",
      budget: { ...PROP_BUDGET },
   },
   glass: {
      id: "glass",
      url: "/models/3d/delivery-drone/cityGlassOffice.glb",
      scale: glassScale,
      stretch: GLASS_STRETCH,
      fallback: "box",
      fallbackColor: "#7dd3fc",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
