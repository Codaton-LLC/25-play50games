// Models for Haunted Mansion Keys. GLBs are not in the manifest yet, so every url under
// /models/3d/haunted-mansion-keys/ draws its code fallback.
// Claude's assets PR copies the GLBs, lists them, and replaces these placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/haunted-mansion-keys/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const DETECTIVE_HEIGHT = 1.8;

export const ASSETS = {
   detective: {
      ...local("charDetective", "capsule", "#475569", CHARACTER_BUDGET),
      humanoid: {},
   },
   key: local("skeletonKey", "cylinder", "#f59e0b"),
   door: local("mansionDoor", "box", "#451a03"),
   lever: local("wallLeverV2", "box", "#78716c"),
   clock: local("grandfatherClock", "box", "#78350f"),
   painting: local("paintingFrame", "box", "#d97706"),
   armour: local("armourStand", "cylinder", "#94a3b8"),
   chair: local("woodenChair", "box", "#92400e"),
   table: local("table", "box", "#78350f"),
   bookshelf: local("bookshelf", "box", "#57534e"),
   chest: EXPANSION_ASSETS.chest,
} satisfies Record<string, ModelAsset>;
