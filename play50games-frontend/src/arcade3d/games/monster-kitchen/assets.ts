// Monster Kitchen's models: the two GLBs this slug generated (monster, cauldron), the slimeCake
// decor GLB (levels 4 and 5 only), the shared fish,
// food-catcher's apple/burger/sock/chef and the shared banana/tinCan, plus the shared mushroom for
// decor. Every fit derives from the measured GLB bounds below (readCharacterGlb, 2026-10-09; checked
// on the real meshes in assets.test.ts). Plain data, no three.js: index.tsx hands ASSETS to GameShell,
// the Scene and its components draw them.
import type { ModelAsset } from "@/arcade3d/core/types";
import {
   CAULDRON_INNER_RADIUS_GLB,
   EXPANSION_ASSETS,
   EXPANSION_GLB_POINTS,
   PROP_BUDGET,
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

/** slimeCake.glb raw bounds, measured on the mesh (assets.test.ts): a round cake, feet at y = 0. */
export const SLIME_CAKE_GLB = { width: 1.9061, height: 1.7924, depth: 1.9079 };
/** Drawn diameter (m): a 0.6 m display cake on the floor, drawn only on levels 4 and 5. */
export const SLIME_CAKE_DIAMETER = 0.6;
export const SLIME_CAKE_SCALE = SLIME_CAKE_DIAMETER / SLIME_CAKE_GLB.depth;

/** The longest side of a GLB ingredient on the wheel (m): with the fish's 0.35 m, the 0.36 m eyeball and
 *  the 0.34 m slime cube, nothing on the wheel reads under ~24 CSS px on a 390x844 phone. */
export const INGREDIENT_LONGEST = 0.36;
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

/**
 * Menu 1 adoptions (measured on the meshes, floor pivot, centred on x / z; Rodin's longest side ~1.9):
 * monsterEyeball 1.903 x 1.676 x 0.442 and slimeCube 1.894 x 1.726 x 1.899 (1500 tris): the wheel's eyeball and slime-cube
 * ingredients, drawn INGREDIENT_LONGEST / 0.34 m. lazySusan 1.902 x 0.144 x 1.899 (3000 tris): the turntable, drawn the
 * rules' disc diameter (2 x WHEEL.discR = 1.9 m) and flattened to a 0.05 m slab. monsterTopHat 1.525 x 1.14 x 1.901:
 * the greedy monster's hat, 0.36 m across its brim. potionJar 1.08 x 1.889 x 1.207: the shelf and wall jars, 0.26 m tall.
 * stoveHearth 1.815 x 1.453 x 1.902 (3000 tris): a dome oven, 1.1 m tall, floor decor on levels 4-5 beside the cave wall.
 */
export const EYEBALL_GLB = { width: 1.903, height: 1.676, depth: 0.442 } as const;
export const SLIME_CUBE_GLB = { width: 1.894, height: 1.726, depth: 1.899 } as const;
export const LAZY_SUSAN_GLB = { width: 1.902, height: 0.144, depth: 1.899 } as const;
export const LAZY_SUSAN_DIAMETER = 1.9;
export const LAZY_SUSAN_THICKNESS = 0.05;
const LAZY_SUSAN_SCALE = LAZY_SUSAN_DIAMETER / LAZY_SUSAN_GLB.width;
export const TOP_HAT_GLB = { width: 1.525, height: 1.14, depth: 1.901 } as const;
export const TOP_HAT_BRIM = 0.36;
export const POTION_JAR_GLB = { width: 1.08, height: 1.889, depth: 1.207 } as const;
export const POTION_JAR_HEIGHT = 0.26;
export const STOVE_HEARTH_GLB = { width: 1.815, height: 1.453, depth: 1.902 } as const;
export const STOVE_HEARTH_HEIGHT = 1.1;
const STOVE_HEARTH_SCALE = STOVE_HEARTH_HEIGHT / STOVE_HEARTH_GLB.height;
export const STOVE_HEARTH_DRAWN = { width: STOVE_HEARTH_GLB.width * STOVE_HEARTH_SCALE, depth: STOVE_HEARTH_GLB.depth * STOVE_HEARTH_SCALE } as const;
/** Dome ovens on the cave floor, levels 4-5 only, outside PLAY_BOUNDS (x <= -3.2 or x >= 1.8). */
export const STOVE_HEARTH_SPOTS = [
   { x: -5.1, z: 2.7, rotY: 0.5 },
   { x: 5.0, z: 1.2, rotY: -0.6 },
] as const;

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
   eyeball: { id: "monsterEyeball", url: "/models/3d/monster-kitchen/monsterEyeball.glb", scale: INGREDIENT_LONGEST / EYEBALL_GLB.width, fallback: "sphere", fallbackColor: "#f8fafc", budget: { ...PROP_BUDGET } },
   slime: { id: "slimeCube", url: "/models/3d/monster-kitchen/slimeCube.glb", scale: 0.34 / SLIME_CUBE_GLB.width, fallback: "box", fallbackColor: "#4ade80", budget: { ...PROP_BUDGET } },
   lazySusan: {
      id: "lazySusan",
      url: "/models/3d/monster-kitchen/lazySusan.glb",
      scale: LAZY_SUSAN_SCALE,
      stretch: [1, LAZY_SUSAN_THICKNESS / (LAZY_SUSAN_GLB.height * LAZY_SUSAN_SCALE), 1] as const,
      yOffset: -LAZY_SUSAN_THICKNESS / 2,
      fallback: "cylinder",
      fallbackColor: "#92400e",
      budget: { ...PROP_BUDGET },
   },
   topHat: { id: "monsterTopHat", url: "/models/3d/monster-kitchen/monsterTopHat.glb", scale: TOP_HAT_BRIM / TOP_HAT_GLB.depth, fallback: "cylinder", fallbackColor: "#1f2937", budget: { ...PROP_BUDGET } },
   potionJar: { id: "potionJar", url: "/models/3d/monster-kitchen/potionJar.glb", scale: POTION_JAR_HEIGHT / POTION_JAR_GLB.height, fallback: "cylinder", fallbackColor: "#67e8f9", budget: { ...PROP_BUDGET } },
   stoveHearth: { id: "stoveHearth", url: "/models/3d/monster-kitchen/stoveHearth.glb", scale: STOVE_HEARTH_SCALE, fallback: "sphere", fallbackColor: "#78716c", budget: { ...PROP_BUDGET } },
   // 0.5 m shelf/floor decor, instanced
   mushroom: EXPANSION_ASSETS.mushroom,
   // 0.6 m display cake on the floor (levels 4 and 5 only, Decor reads the level); feet (GLB y 0) on the ground
   slimeCake: {
      id: "slimeCake",
      url: "/models/3d/monster-kitchen/slimeCake.glb",
      scale: SLIME_CAKE_SCALE,
      rotationY: 0,
      yOffset: 0,
      fallback: "cylinder",
      fallbackColor: "#4ade80",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;
