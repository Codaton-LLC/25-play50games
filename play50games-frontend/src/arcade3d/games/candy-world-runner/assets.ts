// Candy World Runner's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/candy-world-runner (the ready set from
// ~/.play50/hyper3d/ready/menu2/candy-world-runner, incl. m2FrostedCupcakeTower, plus m2CandyKingBoss and
// m2GummyMonster from ready/menu2/shared); the orb and the checkpoint beacon are the shared Menu 2 ones.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   caneArch: { x: 1.4421, y: 1.8973, z: 0.3177 },
   castle: { x: 1.2724, y: 1.9148, z: 1.1964 },
   // the candy coin lies flat (a disc in x-z)
   coin: { x: 1.8761, y: 0.3007, z: 1.8876 },
   king: { x: 1.3712, y: 1.8994, z: 0.9414 },
   choco: { x: 1.8973, y: 0.2194, z: 1.0121 },
   cookieArch: { x: 1.7298, y: 1.8987, z: 1.3684 },
   donut: { x: 1.8952, y: 0.681, z: 1.8827 },
   cupcake: { x: 1.0293, y: 1.9073, z: 1.0772 },
   gummy: { x: 1.7009, y: 1.9027, z: 1.0326 },
   jelly: { x: 1.8931, y: 1.7547, z: 1.8187 },
   lollipop: { x: 1.2567, y: 1.9004, z: 0.2477 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** King Bonbon stands 6 m tall; a gummy monster 1.6 m; the obstacles fill a lane (2.2 m wide). */
export const KING_H = 6;
export const GUMMY_H = 1.6;
export const OBSTACLE_W = 2.2;
export const ORB_SIZE = 0.55;
export const COIN_SIZE = 0.8;

const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "candy-world-runner"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   caneArch: prop("m2CandyCaneArch", "#f43f5e"),
   castle: prop("m2CandyCastleBg", "#f9a8d4"),
   coin: prop("m2CandyCoin", "#facc15"),
   king: { ...prop("m2CandyKingBoss", "#f472b6"), budget: BIG },
   choco: prop("m2ChocoBarPlatform", "#78350f"),
   cookieArch: prop("m2CookieArch", "#d97706"),
   donut: prop("m2DonutPlatform", "#f9a8d4"),
   cupcake: prop("m2FrostedCupcakeTower", "#bae6fd"),
   gummy: { ...prop("m2GummyMonster", "#4ade80"), budget: BIG },
   jelly: prop("m2JellyCube", "#f472b6"),
   lollipop: prop("m2Lollipop", "#f43f5e"),
   beacon: prop("checkpointBeacon", "#fbbf24", "menu2"),
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
