// Models used by Mini Golf. Plain data, no three.js: index.tsx hands them to GameShell, the scene
// files draw them. The windmill is this game's own GLB (assets.spec.json, default expansion fit:
// 2.2 m tall, hub and tunnel +z); trees and rocks are expansion decor, the flag is tower-climb's
// checkpoint flag painted red. Blades, felt, rails, cups, pipes and the ball are procedural.
// assets.test.ts checks every fit on the real meshes.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, REUSED_ASSETS, WINDMILL_TUNNEL_GLB, expansionPoint } from "@/arcade3d/core/sharedAssets";
import { CUP } from "./physics";
import { COLORS } from "./looks";

/** checkpoint-flag.glb is about 1.9 units tall: drawn CUP.flagHeight (0.8 m). */
export const FLAG_GLB_HEIGHT = 1.9;
/** The tree's height range (m) and the rock's (its 1 m unit scaled 0.4-1.0). */
export const TREE_HEIGHT = 2.3;

export const ASSETS = {
   windmill: EXPANSION_ASSETS.windmill,
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: TREE_HEIGHT / EXPANSION_GLB_SIZE.leafyTree.height },
   rock: EXPANSION_ASSETS.rock,
   flag: { ...REUSED_ASSETS.checkpointFlag, id: "golfFlag", scale: CUP.flagHeight / FLAG_GLB_HEIGHT, material: { color: COLORS.flag, roughness: 0.6 } },
} satisfies Record<string, ModelAsset>;

/** The windmill's scale (m per GLB unit). */
export const WINDMILL_SCALE = ASSETS.windmill.scale ?? 1;
/** The hub as drawn (m, windmill origin): the blades' axle starts here. */
export const WINDMILL_HUB = expansionPoint(ASSETS.windmill, EXPANSION_GLB_POINTS.windmillHub);
/** The tunnel's clear width as drawn (m). */
export const WINDMILL_CLEAR = WINDMILL_TUNNEL_GLB.clearWidth * WINDMILL_SCALE;
