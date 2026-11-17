// Models used by Mini Golf. Plain data, no three.js: index.tsx hands them to GameShell, the scene
// files draw them. The windmill is this game's own GLB (assets.spec.json, default expansion fit:
// 2.2 m tall, hub and tunnel +z); trees and rocks are expansion decor, the flag is tower-climb's
// checkpoint flag painted red. Blades, felt, rails, cups, pipes and the ball are procedural.
// assets.test.ts checks every fit on the real meshes.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_POINTS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, WINDMILL_TUNNEL_GLB, expansionPoint } from "@/arcade3d/core/sharedAssets";
import type { Hole } from "./course";
import { COLORS, DECOR_TREE_HALF, DECOR_TREE_OUT, holeZ } from "./looks";
import { CUP } from "./physics";

/** checkpoint-flag.glb is about 1.9 units tall: drawn CUP.flagHeight (0.8 m). */
export const FLAG_GLB_HEIGHT = 1.9;
/** The tree's height range (m) and the rock's (its 1 m unit scaled 0.4-1.0). */
export const TREE_HEIGHT = 2.3;

/**
 * golfCastle.glb (Group D, QA "OK: ruined gate, tunnel open"). 1.2 m tall.
 * Spots stand in the sea just outside the island skirt (rail box + 0.6 m), never on the felt.
 */
export const CASTLE_GLB = { width: 1.8977, height: 1.2454, depth: 1.8835 } as const;
export const CASTLE_HEIGHT = 1.2;
const CASTLE_SCALE = CASTLE_HEIGHT / CASTLE_GLB.height;
export const CASTLE_DRAWN = {
   width: CASTLE_GLB.width * CASTLE_SCALE,
   height: CASTLE_HEIGHT,
   depth: CASTLE_GLB.depth * CASTLE_SCALE,
} as const;
/** IslandBase lathe extends this far past the rail box. */
export const ISLAND_SKIRT = 0.6;
/** Feet in the sea (surface y = -1.3) so the top sits level with the island rim. */
export const CASTLE_Y = -1.45;
const CASTLE_HOLES = [0, 3, 5] as const;

/** One castle (two on the windmill hole) outside each mounted hole's island. */
export function castleSpots(holes: readonly Hole[]): { x: number; y: number; z: number; rotY: number }[] {
   const half = CASTLE_DRAWN.width / 2;
   const out = ISLAND_SKIRT + half + DECOR_TREE_OUT + DECOR_TREE_HALF;
   const spots: { x: number; y: number; z: number; rotY: number }[] = [];
   for (const hole of holes) {
      if (!CASTLE_HOLES.includes(hole.index as 0 | 3 | 5)) continue;
      const z = holeZ(hole.index) + (hole.box.z0 + hole.box.z1) / 2;
      spots.push({ x: hole.box.x0 - out, y: CASTLE_Y, z, rotY: 0.4 });
      if (hole.index === 3) spots.push({ x: hole.box.x1 + out, y: CASTLE_Y, z: z - 0.5, rotY: 2.1 });
   }
   return spots;
}

export const ASSETS = {
   windmill: EXPANSION_ASSETS.windmill,
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: TREE_HEIGHT / EXPANSION_GLB_SIZE.leafyTree.height },
   rock: EXPANSION_ASSETS.rock,
   flag: { ...REUSED_ASSETS.checkpointFlag, id: "golfFlag", scale: CUP.flagHeight / FLAG_GLB_HEIGHT, material: { color: COLORS.flag, roughness: 0.6 } },
   castle: {
      id: "castle",
      url: "/models/3d/mini-golf/golfCastle.glb",
      scale: CASTLE_SCALE,
      fallback: "box",
      fallbackColor: "#d6d3d1",
      budget: { ...PROP_BUDGET },
   },
} satisfies Record<string, ModelAsset>;

/** The windmill's scale (m per GLB unit). */
export const WINDMILL_SCALE = ASSETS.windmill.scale ?? 1;
/** The hub as drawn (m, windmill origin): the blades' axle starts here. */
export const WINDMILL_HUB = expansionPoint(ASSETS.windmill, EXPANSION_GLB_POINTS.windmillHub);
/** The tunnel's clear width as drawn (m). */
export const WINDMILL_CLEAR = WINDMILL_TUNNEL_GLB.clearWidth * WINDMILL_SCALE;
