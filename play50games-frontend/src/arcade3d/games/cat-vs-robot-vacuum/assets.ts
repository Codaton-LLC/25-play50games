// Models for Cat vs Robot Vacuum. The GLBs are not in the manifest yet, so every url under
// /models/3d/cat-vs-robot-vacuum/ draws its fallback. Claude's assets PR copies the GLBs, lists
// them, and replaces the placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/cat-vs-robot-vacuum/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const ASSETS = {
   cat: local("cat", "capsule", "#fb923c", CHARACTER_BUDGET),
   vacuum: local("robotVacuum", "cylinder", "#94a3b8"),
   treat: local("catTreat", "sphere", "#f97316"),
   toy: local("catToy", "sphere", "#fde68a"),
   clutter: local("catBox", "box", "#a16207"),
   sofa: local("sofa", "box", "#78716c"),
   bed: local("bed", "box", "#a8a29e"),
   table: local("table", "box", "#92400e"),
   bookshelf: local("bookshelf", "box", "#57534e"),
} satisfies Record<string, ModelAsset>;
