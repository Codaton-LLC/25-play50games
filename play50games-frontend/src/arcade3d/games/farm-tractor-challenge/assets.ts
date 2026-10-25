// Models for Farm Tractor Challenge. URLs under /models/3d/farm-tractor-challenge/ are not in the
// manifest yet, so each one draws its fallback. Claude's assets PR copies the GLBs and sets scale.
// Leave farm-tractor-challenge/hero.glb. The shared crate is a prop by the barn, not the hitch.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/farm-tractor-challenge/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

/** Standing height the seated farmer is built to. Claude fits charFarmer.glb to this. */
export const FARMER_HEIGHT = 1.78;

export const ASSETS = {
   farmer: {
      ...local("charFarmer", "capsule", "#f1d0b4", CHARACTER_BUDGET),
      humanoid: {},
   },
   tractor: local("tractor", "box", "#eab308"),
   trailer: local("farmTrailer", "box", "#78716c"),
   hay: local("hayBale", "cylinder", "#eab308"),
   appleCrate: local("appleCrate", "box", "#c2410c"),
   barn: local("barn", "box", "#b45309"),
   fence: local("farmFence", "box", "#a16207"),
   gate: local("farmGate", "box", "#78716c"),
   scarecrow: local("scarecrow", "box", "#a16207"),
   silo: local("grainSilo", "cylinder", "#e7e5e4"),
   trough: local("waterTrough", "box", "#64748b"),
   tree: EXPANSION_ASSETS.leafyTree,
   barnCrate: SHARED_ASSETS.crate,
} satisfies Record<string, ModelAsset>;
