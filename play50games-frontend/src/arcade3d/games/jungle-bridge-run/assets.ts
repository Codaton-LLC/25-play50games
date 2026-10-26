// Jungle Bridge Run models: the ready Hyper3D GLBs (menu1-jungle-bridge-run, 2026-10-25), fitted from
// their measured bounds (assets.test.ts checks every fit on the real mesh). Track pieces are fitted to a
// 1 m length so a spot's `sz` is the piece's length; decor is fitted to 1 m (height) so a spot's
// `scale` is its size in metres: nothing is scaled twice.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { LANE_X, LOG_HALF_Z, PILLAR_HALF, STAND_HEIGHT } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   charExplorer: { width: 1.9001, height: 1.8993, depth: 0.8071 },
   woodenBridge: { width: 1.2978, height: 0.7263, depth: 1.8963 },
   ropeBridge: { width: 1.0195, height: 1.0023, depth: 1.9002 },
   jungleRock: { width: 1.9104, height: 0.9934, depth: 1.8538 },
   templePillarV2: { width: 0.8234, height: 1.9005, depth: 0.8336 },
   waterfallCliff: { width: 1.8929, height: 1.3128, depth: 1.8549 },
   ruinGateR: { width: 1.9039, height: 1.6608, depth: 0.6253 },
   jungleLogSingle: { width: 1.8959, height: 0.5887, depth: 0.6231 },
   jungleFern: { width: 1.6552, height: 1.1821, depth: 1.5669 },
   volcanoBackdrop: { width: 1.8728, height: 1.2738, depth: 1.8621 },
   hangingVine: { width: 1.1929, height: 1.731, depth: 1.1326 },
} as const;

/** Drawn sizes (m). */
export const FIT = {
   /** one lane of planks: 1.9 wide (lanes 2 m apart), low side rails that read as kerbs between lanes */
   deckWidth: 1.9,
   deckHeight: 0.36,
   /** the woodenBridge deck surface sits about 0.25 GLB units up: it is lowered onto y = 0 */
   deckTop: 0.25,
   ropeWidth: 1.6,
   ropeHeight: 0.95,
   ropeDeckTop: 0.2,
   /** one ruin gate per lane: 2 m wide, its lintel 2.0 m up, so the 1.76 m explorer runs under it */
   gateWidth: 2,
   gateLintel: 2,
   /** the gate opening's lintel underside in the GLB (measured profile: the inner x closes at 1.2) */
   gateLintelGlb: 1.2,
   pillarWidth: 2 * PILLAR_HALF,
   logLength: 2 * LOG_HALF_Z,
   logDiameter: 0.6,
} as const;

/**
 * The explorer's joints (GLB units: a 1.900 x 1.899 x 0.807 T-pose facing +z; a safari hat, a shirt,
 * shorts, boots and a backpack), measured on charExplorer.glb with the core recipe (explorer.test.ts).
 * Set by hand: crotchY 0.70 and hemY = crotchY (the estimate puts the crotch at 0.99, inside the hollow
 * torso shell; the inner-leg profile parts below 0.70: |x| 0.004 at 0.70, 0.019 at 0.66, 0.04 by 0.54).
 * The rest follows the estimate seeded with them.
 */
export const EXPLORER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2548,
   shoulderX: 0.3104,
   shoulderZ: 0.0724,
   armRadius: 0.0745,
   clavicleX: 0.1552,
   elbowX: 0.5343,
   wristX: 0.7582,
   armSpread: 0.2353,
   crotchY: 0.7,
   hipY: 0.7753,
   hipX: 0.1809,
   hipZ: 0.0706,
   kneeY: 0.3876,
   ankleY: 0.1792,
   toeZ: 0.4035,
   heelZ: -0.0853,
   legDepth: 0.1198,
   legOuterX: 0.3197,
   hemY: 0.7,
   spineY: 0.9191,
   chestY: 1.063,
   neckY: 1.464,
   headY: 1.4798,
   spineZ: -0.0392,
   shoulderBlend: 0.0447,
   elbowBlend: 0.0373,
   hipBlend: 0.0775,
   kneeBlend: 0.0581,
   ankleBlend: 0.0368,
   crotchBlend: 0.1024,
   spineBlend: 0.0432,
   neckBlend: 0.0079,
};

export const EXPLORER_SCALE = STAND_HEIGHT / GLB_SIZE.charExplorer.height;

const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string, budget: ModelAsset["budget"] = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/jungle-bridge-run/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...budget },
   ...fit,
});

const unitZ = (id: keyof typeof GLB_SIZE) => 1 / GLB_SIZE[id].depth;
const unitH = (id: keyof typeof GLB_SIZE) => 1 / GLB_SIZE[id].height;
const deckK = unitZ("woodenBridge");
const ropeK = unitZ("ropeBridge");
const gateK = FIT.gateWidth / GLB_SIZE.ruinGateR.width;
const logK = FIT.logLength / GLB_SIZE.jungleLogSingle.width;

export const ASSETS = {
   /** image-to-3D T-pose, auto-rigged with EXPLORER_LANDMARKS, 1.76 m; untinted (a face) */
   explorer: { ...local("charExplorer", { scale: EXPLORER_SCALE }, "capsule", "#eab308", CHARACTER_BUDGET), humanoid: { landmarks: EXPLORER_LANDMARKS } },
   /** a 1 m long, 1.9 m wide plank lane; spot sz = the piece's length */
   deck: local(
      "woodenBridge",
      {
         scale: deckK,
         stretch: [FIT.deckWidth / (GLB_SIZE.woodenBridge.width * deckK), FIT.deckHeight / (GLB_SIZE.woodenBridge.height * deckK), 1],
         yOffset: -FIT.deckTop * (FIT.deckHeight / GLB_SIZE.woodenBridge.height),
      },
      "box",
      "#a16207"
   ),
   /** the plank lane over a bridge: a 1 m long rope bridge, 1.6 m wide with rope rails */
   ropeBridge: local(
      "ropeBridge",
      {
         scale: ropeK,
         stretch: [FIT.ropeWidth / (GLB_SIZE.ropeBridge.width * ropeK), FIT.ropeHeight / (GLB_SIZE.ropeBridge.height * ropeK), 1],
         yOffset: -FIT.ropeDeckTop * (FIT.ropeHeight / GLB_SIZE.ropeBridge.height),
      },
      "box",
      "#78350f"
   ),
   /** one section gate per lane (2 m wide, the lintel 2 m up) */
   gate: local("ruinGateR", { scale: gateK, stretch: [1, FIT.gateLintel / (FIT.gateLintelGlb * gateK), 1] }, "box", "#713f12"),
   /** the pillar obstacle, 1.1 m wide (its hit box) */
   pillar: local("templePillarV2", { scale: FIT.pillarWidth / GLB_SIZE.templePillarV2.width }, "cylinder", "#78716c"),
   /** the rolling log: its axis along z (rotationY), 1.2 m long (its hit depth), 0.6 m thick */
   log: local(
      "jungleLogSingle",
      {
         scale: logK,
         rotationY: Math.PI / 2,
         stretch: [1, FIT.logDiameter / (GLB_SIZE.jungleLogSingle.height * logK), FIT.logDiameter / (GLB_SIZE.jungleLogSingle.depth * logK)],
      },
      "cylinder",
      "#854d0e"
   ),
   // decor, fitted to 1 m tall: the spot's scale is the size in metres
   rock: local("jungleRock", { scale: unitH("jungleRock") }, "sphere", "#57534e"),
   fern: local("jungleFern", { scale: unitH("jungleFern") }, "cylinder", "#16a34a"),
   hangingVine: local("hangingVine", { scale: unitH("hangingVine") }, "cylinder", "#15803d"),
   waterfall: local("waterfallCliff", { scale: unitH("waterfallCliff") }, "box", "#0e7490"),
   volcano: local("volcanoBackdrop", { scale: unitH("volcanoBackdrop") }, "cylinder", "#7f1d1d"),
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: 1 / EXPANSION_GLB_SIZE.leafyTree.height },
} satisfies Record<string, ModelAsset>;

/** Lane centres, re-exported for the scene's spot builders. */
export const LANES = LANE_X;
