// Models for Submarine Treasure Dive. URLs under /models/3d/submarine-treasure-dive/ are not in
// the manifest yet, so each one draws its fallback. Chest, coin, rock and the second fish school
// are shared meshes that already load. Claude copies the GLBs and fits the scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { COIN_GLB_SIZE, EXPANSION_ASSETS, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
): ModelAsset => ({
   id,
   url: `/models/3d/submarine-treasure-dive/${id}.glb`,
   fallback,
   fallbackColor,
   budget: PROP_BUDGET,
});

export const ASSETS = {
   miniSubmarine: local("miniSubmarine", "capsule", "#e2e8f0"),
   amphora: local("amphora", "cylinder", "#d6b48a"),
   anchor: local("anchor", "box", "#1e293b"),
   pearlShell: local("pearlShellV2", "sphere", "#f8fafc"),
   rockArch: local("rockArch", "box", "#57534e"),
   ruinColumn: local("ruinColumn", "cylinder", "#e7e5e4"),
   wreck: local("shipwreckSidewaysT", "box", "#44403c"),
   jellyfish: local("jellyfish", "sphere", "#e879f9"),
   subDock: local("subDock", "cylinder", "#0f766e"),
   coral: local("coralBranch", "sphere", "#fb7185"),
   seaweed: local("seaweedKelp", "cylinder", "#15803d"),
   tropicalFish: local("tropicalFish", "capsule", "#fb923c"),
   aquariumRock: local("aquariumRock", "sphere", "#78716c"),
   chest: EXPANSION_ASSETS.chest,
   coin: { ...SHARED_ASSETS.coin, scale: 0.34 / COIN_GLB_SIZE.width, stretch: [1, 1, 0.55] as const },
   rock: EXPANSION_ASSETS.rock,
   fish: EXPANSION_ASSETS.fish,
} satisfies Record<string, ModelAsset>;
