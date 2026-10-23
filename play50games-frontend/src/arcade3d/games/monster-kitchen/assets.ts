// Monster Kitchen's models: the two GLBs this slug generated (monster, cauldron), the shared fish,
// food-catcher's apple/burger/sock/chef and the shared banana/tinCan, plus the shared mushroom for
// decor. Every fit derives from the measured GLB bounds below (readCharacterGlb, 2026-10-09; checked
// on the real meshes in assets.test.ts). Plain data, no three.js: index.tsx hands ASSETS to GameShell,
// the Scene and its components draw them.
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   CAULDRON_INNER_RADIUS_GLB,
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   REUSED_ASSETS,
   SHARED_ASSETS,
   expansionPoint,
} from "@/arcade3d/core/sharedAssets";

// measured GLB longest sides / heights (GLB units; Rodin normalises a prop's longest side to ~1.9)
export const APPLE_GLB_LONGEST = 1.902;
export const BURGER_GLB_LONGEST = 1.8982;
export const SOCK_GLB_LONGEST = 1.8985;
export const BANANA_GLB_LONGEST = 1.896;
export const TIN_CAN_GLB_LONGEST = 1.8993;
export const CHEF_GLB_HEIGHT = 1.8693;

/** The longest side of an ingredient on the wheel (m); the readability budget reads 0.35 m ≈ 28-34 px. */
export const INGREDIENT_LONGEST = 0.32;
/** The chef's drawn height (m), the food-catcher measurement (README "Decisions"). */
export const CHEF_HEIGHT = 1.82;
/** The stove drum's top (m): the cauldron stands on it, its rolled rim lands at ≈ 1.48 m. */
export const STOVE_TOP = 0.9;

export const CAULDRON_SCALE = EXPANSION_ASSETS.cauldron.scale ?? 1;
/** The rim's inner edge over the stove (m): the stove top + the measured GLB point x the fit. */
export const CAULDRON_RIM_Y = STOVE_TOP + expansionPoint(EXPANSION_ASSETS.cauldron, EXPANSION_GLB_POINTS.cauldronInnerRim).y;
/** The liquid disc: the committed inner radius x the fit (≈ 0.331), just under the rim. */
export const LIQUID_R = CAULDRON_INNER_RADIUS_GLB * CAULDRON_SCALE;
export const LIQUID_Y = CAULDRON_RIM_Y - 0.03;

/** The monster's head anchor (GLB units, before the fit): the cap right above the eyes (profile y 1.6-1.7). */
export const MONSTER_HEAD_ANCHOR_GLB = { x: 0, y: 1.66, z: 0.02 };

export const ASSETS = {
   // 1.4 m tall, faces +z; tinted per type in the Scene
   monster: EXPANSION_ASSETS.monster,
   // 0.9 m wide; the feet (GLB y 0) stand on the stove drum at STOVE_TOP
   cauldron: { ...EXPANSION_ASSETS.cauldron, yOffset: STOVE_TOP },
   // the measured 1.82 m (T-pose v2 chef; CHEF_LANDMARKS live on the core asset)
   chef: { ...REUSED_ASSETS.chef, scale: CHEF_HEIGHT / CHEF_GLB_HEIGHT },
   apple: { ...REUSED_ASSETS.apple, scale: INGREDIENT_LONGEST / APPLE_GLB_LONGEST },
   burger: { ...REUSED_ASSETS.burger, scale: INGREDIENT_LONGEST / BURGER_GLB_LONGEST },
   sock: { ...REUSED_ASSETS.sock, scale: INGREDIENT_LONGEST / SOCK_GLB_LONGEST },
   banana: { ...SHARED_ASSETS.banana, scale: INGREDIENT_LONGEST / BANANA_GLB_LONGEST },
   tinCan: { ...SHARED_ASSETS.tinCan, scale: INGREDIENT_LONGEST / TIN_CAN_GLB_LONGEST },
   // 0.35 m long, head +z
   fish: EXPANSION_ASSETS.fish,
   // 0.5 m shelf/floor decor, instanced
   mushroom: EXPANSION_ASSETS.mushroom,
} satisfies Record<string, ModelAsset>;
