// Models for Jungle Bridge Run. GLBs are generated in menu1-jungle-bridge-run/,
// referenced at /models/3d/jungle-bridge-run/<id>.glb. Unlisted in modelManifest,
// so fallbacks draw until Claude adds them at the gate.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/jungle-bridge-run/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

export const EXPLORER_HEIGHT = 1.76;

export const ASSETS = {
   explorer: {
      ...local("charExplorer", "capsule", "#eab308", CHARACTER_BUDGET),
      humanoid: {},
   },
   woodenBridge: local("woodenBridge", "box", "#a16207"),
   ropeBridge: local("ropeBridge", "box", "#78350f"),
   jungleRock: local("jungleRock", "sphere", "#57534e"),
   templePillar: local("templePillarV2", "cylinder", "#78716c"),
   waterfallCliff: local("waterfallCliff", "box", "#0e7490"),
   ruinGate: local("ruinGateR", "box", "#713f12"),
   jungleLogSingle: local("jungleLogSingle", "cylinder", "#854d0e"),
   jungleLog: local("jungleLog", "cylinder", "#854d0e"),
   hangingVine: local("hangingVine", "cylinder", "#15803d"),
   jungleFern: local("jungleFern", "cylinder", "#16a34a"),
   volcanoBackdrop: local("volcanoBackdrop", "cylinder", "#7f1d1d"),
   leafyTree: EXPANSION_ASSETS.leafyTree,
   rock: EXPANSION_ASSETS.rock,
} satisfies Record<string, ModelAsset>;
