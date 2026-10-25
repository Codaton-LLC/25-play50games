// Models for Mars Rover Mission.
// GLBs are unlisted in the manifest until Claude imports them at the gate,
// so every url under /models/3d/mars-rover-mission/ draws its fallback.
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/mars-rover-mission/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const ASSETS = {
   rover: local("marsRover", "box", "#ea580c"),
   base: local("marsBase", "box", "#78716c"),
   antenna: local("commsAntenna", "cylinder", "#e2e8f0"),
   solarPanel: local("groundSolarPanelV2", "box", "#0284c7"),
   charger: local("chargingStation", "cylinder", "#22c55e"),
   sampleRock: local("sampleRock", "sphere", "#b45309"),
   beacon: local("beaconLight", "cylinder", "#f97316"),
   crate: local("researchCrate", "box", "#d97706"),
   capsule: local("landingCapsule", "capsule", "#f1f5f9"),
   astronaut: {
      ...local("charAstronaut", "capsule", "#ffffff", CHARACTER_BUDGET),
      humanoid: {},
   },
   mesaWall: local("marsMesaRock", "box", "#9a3412"),
   boulder: local("marsBoulder", "sphere", "#7c2d12"),
   ruin: local("ancientMarsRuin", "cylinder", "#78716c"),
   mesaTall: local("marsMesaTall", "box", "#9a3412"),
} satisfies Record<string, ModelAsset>;
