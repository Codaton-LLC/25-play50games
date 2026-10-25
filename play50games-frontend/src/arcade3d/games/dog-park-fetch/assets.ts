// Models for Dog Park Fetch. The GLBs are not in the manifest yet, so every url under
// /models/3d/dog-park-fetch/ draws its fallback. Claude's assets PR copies the GLBs, lists them,
// and replaces the placeholder scales. The bench and the leafy tree are shared core assets.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/dog-park-fetch/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const ASSETS = {
   dog: local("dog", "capsule", "#d6a15b", CHARACTER_BUDGET),
   owner: local("civilianNpc", "capsule", "#e7e5e4", CHARACTER_BUDGET),
   ball: local("tennisBall", "sphere", "#d9f99d"),
   stick: local("fetchStick", "cylinder", "#a16207"),
   frisbee: local("frisbee", "cylinder", "#f97316"),
   mower: local("lawnMower", "box", "#dc2626"),
   fountain: local("parkFountain", "cylinder", "#cbd5e1"),
   fence: local("picketFence", "box", "#f5f5f4"),
   bench: REUSED_ASSETS.bench,
   tree: EXPANSION_ASSETS.leafyTree,
} satisfies Record<string, ModelAsset>;
