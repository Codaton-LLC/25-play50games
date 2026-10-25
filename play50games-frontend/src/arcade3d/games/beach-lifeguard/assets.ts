// Models for Beach Lifeguard. GLBs are not in the manifest yet, so every url under
// /models/3d/beach-lifeguard/ draws its fallback.
// Claude's assets PR copies the GLBs, lists them, and replaces placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/beach-lifeguard/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const LIFEGUARD_HEIGHT = 1.82;

export const ASSETS = {
   lifeguard: {
      ...local("charLifeguard", "capsule", "#dc2626", CHARACTER_BUDGET),
      humanoid: {},
   },
   swimmer: local("beachgoerNpc", "capsule", "#38bdf8", CHARACTER_BUDGET),
   tower: local("lifeguardTower", "box", "#ef4444"),
   rescueFloat: local("rescueFloat", "cylinder", "#ef4444"),
   jetSki: local("rescueJetSki", "box", "#0284c7"),
   chair: local("beachChair", "box", "#0ea5e9"),
   cooler: local("beachCooler", "box", "#0284c7"),
   hut: local("beachHut", "box", "#78350f"),
   sandcastle: local("sandcastle", "cylinder", "#eab308"),
   surfboard: local("surfboardV2", "box", "#06b6d4"),
   umbrella: REUSED_ASSETS.umbrella,
   palm: REUSED_ASSETS.palm,
} satisfies Record<string, ModelAsset>;
