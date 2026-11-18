// Jungle Vine Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts, each
// its own GLB); the Howler King is the shared m2JungleMonkey at 3x with an ash tint. This game's props
// live in public/models/3d/jungle-vine-jump (the colour orb is the shared menu2 scoreOrb).
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   /** m2BranchPlatformV2: a flat mossy branch slab, the branch platforms and stairs */
   branch: { x: 1.8756, y: 0.4966, z: 1.9016 },
   /** m2LeafPlatformV2: a broad flat leaf, the leaf pads, the net, the canopy and the hollow */
   leaf: { x: 1.313, y: 0.3251, z: 1.9044 },
   /** m2BranchPlatform: a leafy branch stub, decor under the platforms */
   stub: { x: 1.8974, y: 1.5648, z: 1.8446 },
   /** m2JungleVine: the live vine's leafy top (the rope itself is drawn in segments) */
   vine: { x: 1.647, y: 1.7791, z: 1.6792 },
   /** m2JungleVineV2: the dry vine's top */
   dryVine: { x: 1.0926, y: 1.6658, z: 0.5526 },
   /** m2MossyRuinArch: the stone arch an arch vine hangs from (L4) */
   arch: { x: 1.9018, y: 1.4274, z: 1.3056 },
   /** m2RuinStone: ruin blocks round the L4 climb */
   stone: { x: 1.8982, y: 1.2566, z: 1.8762 },
   /** m2SnapperPlant: the biting plant (L3, L5) */
   snapper: { x: 1.208, y: 1.8958, z: 1.38 },
   /** m2JungleEmerald: the emerald glints */
   emerald: { x: 1.8996, y: 1.3539, z: 1.8566 },
   /** m2JungleFruitPod: the thrown fruit pod */
   pod: { x: 1.4816, y: 1.9017, z: 1.5924 },
   /** m2JungleMonkey: the fruit-throwing monkey and, at 3x, the Howler King */
   monkey: { x: 1.1192, y: 1.9014, z: 1.8674 },
   /** m2GiantJungleTreeBg: the jungle trees round the giant */
   bgTree: { x: 1.8968, y: 1.6576, z: 1.8644 },
   /** the shared menu2 colour orb */
   orb: { x: 1.767, y: 1.901, z: 1.77 },
} as const;

/** A branch slab is drawn 2 r across; its top on the pad. */
export const branchScale = (r: number): number => (2 * r) / GLB_SIZE.branch.z;
/** A leaf pad is drawn 2 r long. */
export const leafScale = (r: number): number => (2 * r) / GLB_SIZE.leaf.z;
/** The vine tops: 1.3 m tall at the anchor. */
export const VINE_TOP = 1.3;
/** The arch is drawn 3.6 m wide. */
export const ARCH_W = 3.6;
/** A snapper is drawn 1.4 m tall. */
export const SNAPPER_H = 1.4;
/** An emerald is drawn 0.42 m across; a pod 0.5 m tall; a colour orb 0.62 m tall. */
export const EMERALD_W = 0.42;
export const POD_H = 0.5;
export const ORB_SIZE = 0.62;
/** A monkey is drawn 1.1 m tall; the Howler King 3x. */
export const MONKEY_H = 1.1;
export const KING_H = MONKEY_H * 3;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/jungle-vine-jump/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("kiro"),
   branch: prop("m2BranchPlatformV2", "#6b4a2b"),
   leaf: prop("m2LeafPlatformV2", "#4f8a3c"),
   stub: prop("m2BranchPlatform", "#6b4a2b"),
   vine: prop("m2JungleVine", "#3f9a3a"),
   dryVine: prop("m2JungleVineV2", "#9a7a46"),
   arch: prop("m2MossyRuinArch", "#7d8a6a"),
   stone: prop("m2RuinStone", "#7d8a6a"),
   snapper: prop("m2SnapperPlant", "#3f9a3a"),
   emerald: prop("m2JungleEmerald", "#34d399"),
   pod: prop("m2JungleFruitPod", "#f59e0b"),
   monkey: { id: "m2JungleMonkey", url: "/models/3d/jungle-vine-jump/m2JungleMonkey.glb", fallback: "sphere", fallbackColor: "#7a5a3a", budget: { ...CHARACTER_BUDGET } },
   bgTree: prop("m2GiantJungleTreeBg", "#3f6e3a"),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "sphere", fallbackColor: "#4ade80", budget: PROP_BUDGET },
};
