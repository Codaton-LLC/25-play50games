// Color Boss Tower's models (public/models/3d/color-boss-tower, from ready/menu2/color-boss-tower and
// the hyper3d-new batch: the Grand Color Guardian, the ledge and the hazard orb, optimised with
// tools/hyper3d). The heroes are the shared Menu 2 heroes (menu2/heroModels.ts); the orb and the
// checkpoint beacon are menu2's. Every GLB is one mesh, base on y = 0, centred on x and z, facing +z.
// GLB_SIZE is the measured raw bounds; each fit below turns it into the rules' metres.
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import { LEDGE_LEN, R_PATH, R_WALL } from "./levels";
import { HORB_R } from "./rules";

export const GLB_SIZE = {
   ledge: { x: 1.8915, y: 0.842, z: 1.8938 },
   claw: { x: 1.7652, y: 1.8913, z: 1.7648 },
   cannon: { x: 0.7853, y: 1.19, z: 1.8878 },
   horb: { x: 1.8974, y: 1.8021, z: 1.8682 },
   stone: { x: 1.4775, y: 1.9013, z: 0.6929 },
   grand: { x: 1.8879, y: 1.8409, z: 0.8125 },
   disc: { x: 1.6435, y: 0.3484, z: 1.9028 },
   spire: { x: 1.0934, y: 1.9034, z: 0.8896 },
   heart: { x: 1.8651, y: 1.6767, z: 1.9009 },
} as const;

/** A ledge as drawn: along the arc LEDGE_LEN, out from the wall LEDGE_DEPTH, LEDGE_THICK under its top. */
export const LEDGE_DEPTH = 2.8;
export const LEDGE_THICK = 0.6;
/** The skip ledges: small stone shelves straight up the wall. */
export const SKIP_W = 2.4;
export const SKIP_DEPTH = 1.6;
/** The ledge's centre radius (from the wall in by half its depth); the cannons on the ledge's inner
 *  edge, the claws against the wall (both off the walking ring at R_PATH). */
export const LEDGE_R = R_WALL - LEDGE_DEPTH / 2;
export const CANNON_R = R_PATH - 1.1;
export const CLAW_R = R_WALL - 0.55;
/** Heights as drawn (m). */
export const CLAW_H = 1.0;
export const CANNON_LEN = 1.7;
export const STONE_H = 7;
export const GRAND_H = 8.5;
export const HEART_H = 1.8;
export const DISC_W = 7;
export const SPIRE_H = 11;

const own = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/color-boss-tower/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

export const ASSETS: Record<string, ModelAsset> = {
   riko: heroModelAsset("riko"),
   nami: heroModelAsset("nami"),
   kiro: heroModelAsset("kiro"),
   zuno: heroModelAsset("zuno"),
   vexa: heroModelAsset("vexa"),
   /** the ledge carries no asset scale: Tower.tsx places each one through its own matrix */
   ledge: own("m2TowerLedgePlatform", "#9b93a6"),
   claw: { ...own("m2CoreClawHolder", "#a5a9bb"), scale: CLAW_H / GLB_SIZE.claw.y },
   cannon: { ...own("m2PrismCannon", "#e5e7eb"), scale: CANNON_LEN / GLB_SIZE.cannon.z },
   horb: { ...own("m2HazardOrb", "#64748b"), scale: (HORB_R * 2) / GLB_SIZE.horb.y },
   stone: { ...own("m2StoneGuardianBoss", "#6b7280", CHARACTER_BUDGET), scale: STONE_H / GLB_SIZE.stone.y },
   grand: { ...own("m2ColorGuardianBoss", "#a1a1aa", CHARACTER_BUDGET), scale: GRAND_H / GLB_SIZE.grand.y },
   disc: { ...own("m2BossArenaDisc", "#57534e"), scale: DISC_W / GLB_SIZE.disc.z },
   spire: { ...own("m2DarkTowerBg", "#3f3f46"), scale: SPIRE_H / GLB_SIZE.spire.y },
   heart: { ...own("m2PrismHeart", "#e5e7eb"), scale: HEART_H / GLB_SIZE.heart.y },
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", fallback: "box", fallbackColor: "#fde68a", budget: PROP_BUDGET, scale: 0.7 / 1.9012 },
   beacon: { id: "checkpointBeacon", url: "/models/3d/menu2/checkpointBeacon.glb", fallback: "box", fallbackColor: "#38bdf8", budget: PROP_BUDGET, scale: 2.2 / 1.9023 },
};

/** The ledge's per-axis scale (GLB x along the arc, y down from the top, z out from the wall). */
export const LEDGE_SCALE = { x: LEDGE_LEN / GLB_SIZE.ledge.x, y: LEDGE_THICK / GLB_SIZE.ledge.y, z: LEDGE_DEPTH / GLB_SIZE.ledge.z };
export const SKIP_SCALE = { x: SKIP_W / GLB_SIZE.ledge.x, y: 0.4 / GLB_SIZE.ledge.y, z: SKIP_DEPTH / GLB_SIZE.ledge.z };
