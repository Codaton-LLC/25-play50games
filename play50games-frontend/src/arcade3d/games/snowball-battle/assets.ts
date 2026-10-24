// Model fits for snowball-battle. The snow kid and the pine are shared assets; the snowman is the
// shared GLB fitted to this yard's collision box (height 1.60, footprint ±0.70).
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_CHARACTERS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Accessor bounds of /models/3d/shared/snowman.glb. The nose makes the horizontal reach wider than the body. */
export const SNOWMAN_GLB = { height: 1.9034, halfWidth: 0.7904 };
export const SNOWMAN_HEIGHT = 1.6;
export const SNOWMAN_RADIUS = 0.7;
export const SNOWMAN_SCALE = SNOWMAN_HEIGHT / SNOWMAN_GLB.height;
/** Height from the uniform scale; XZ stretch brings the nose inside the ±0.70 collision box. */
export const SNOWMAN_STRETCH_XZ = SNOWMAN_RADIUS / (SNOWMAN_GLB.halfWidth * SNOWMAN_SCALE);

const snowman: ModelAsset = {
   id: "snowman",
   url: "/models/3d/shared/snowman.glb",
   scale: SNOWMAN_SCALE,
   stretch: [SNOWMAN_STRETCH_XZ, 1, SNOWMAN_STRETCH_XZ],
   fallback: "sphere",
   fallbackColor: "#f8fafc",
   budget: { ...PROP_BUDGET },
};

export const ASSETS = {
   kid: EXPANSION_CHARACTERS.snowKid,
   pine: EXPANSION_ASSETS.pineTree,
   snowman,
} as const;

export const KID_SCALE = ASSETS.kid.scale ?? 1;
export const PINE_HEIGHT = EXPANSION_GLB_SIZE.pineTree.height * (ASSETS.pine.scale ?? 1);

export const TEAM = ["#38bdf8", "#f87171", "#4ade80", "#fb923c"] as const;
