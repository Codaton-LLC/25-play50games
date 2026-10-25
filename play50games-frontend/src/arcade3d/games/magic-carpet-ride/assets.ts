// Models for Magic Carpet Ride. GLBs are not in the manifest yet, so every url under
// /models/3d/magic-carpet-ride/ draws its fallback. Claude's assets PR copies the ready
// GLBs, lists them, and replaces these placeholder scales.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

const local = (
   id: string,
   fallback: ModelAsset["fallback"],
   fallbackColor: string,
   budget: ModelAsset["budget"] = PROP_BUDGET,
): ModelAsset => ({
   id,
   url: `/models/3d/magic-carpet-ride/${id}.glb`,
   fallback,
   fallbackColor,
   budget,
});

/** Seated rider, metres. The stand-in draws this height; the GLB scale is Claude's gate. */
export const RIDER_HEIGHT = 1.72;

export const ASSETS = {
   rider: {
      ...local("charCarpetRider", "capsule", "#4c1d95", CHARACTER_BUDGET),
      humanoid: {},
   },
   carpet: local("magicCarpet", "box", "#7c3aed"),
   ring: local("flyingRing", "cylinder", "#fbbf24"),
   tower: local("palaceTower", "box", "#c4b5fd"),
   roof: local("desertRooftopV2", "box", "#c2410c"),
   cloud: local("cloud", "sphere", "#f8fafc"),
   lantern: local("hangingLantern", "box", "#fbbf24"),
   mesa: local("canyonMesa", "box", "#9a3412"),
   palace: local("floatingPalaceR", "box", "#f5f3ff"),
   rock: local("floatingRockV3", "box", "#78716c"),
   star: local("star", "sphere", "#fde68a"),
} satisfies Record<string, ModelAsset>;
