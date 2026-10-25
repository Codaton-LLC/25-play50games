// Models for Wizard Potion Lab. Game urls are not in the manifest yet, so each
// /models/3d/wizard-potion-lab/ file draws its fallback. The cauldron and the mushroom
// are expansion meshes already listed. Claude's assets PR copies the GLBs and sets scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   scale: number,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/wizard-potion-lab/${id}.glb`,
   scale,
   fallback,
   fallbackColor,
   budget,
});

export const WIZARD_HEIGHT = 1.7;

/** Rodin's longest side is ~1.9. These scales are placeholders until the GLBs are measured. */
const PROP = 0.42 / 1.9;

export const ASSETS = {
   wizard: {
      ...local("charWizard", "capsule", "#5b21b6", 1, CHARACTER_BUDGET),
      humanoid: {},
   },
   cauldron: EXPANSION_ASSETS.cauldron,
   mushroom: EXPANSION_ASSETS.mushroom,
   crystal: local("magicCrystal", "box", "#67e8f9", PROP),
   berry: local("berryBunch", "sphere", "#fb7185", PROP),
   flower: local("magicFlower", "sphere", "#f0abfc", PROP),
   herb: local("herbBundle", "sphere", "#86efac", PROP),
   bottle: local("potionBottle", "cylinder", "#c4b5fd", PROP),
   shelf: local("bookshelf", "box", "#44403c", 1.2 / 1.9),
   table: local("alchemyTable", "box", "#44403c", 1.5 / 1.9),
   book: local("spellBook", "box", "#7c3aed", 0.36 / 1.9),
   ball: local("crystalBall", "sphere", "#67e8f9", 0.32 / 1.9),
   candle: local("candle", "cylinder", "#f5f5f4", 0.34 / 1.9),
} satisfies Record<string, ModelAsset>;
