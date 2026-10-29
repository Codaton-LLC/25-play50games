// Ice Peak Jumper's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/ice-peak-jumper (the ready set from
// ~/.play50/hyper3d/ready/menu2/ice-peak-jumper, plus m2FrostGolemBoss and m2IceSlime from
// ready/menu2/shared); the orb and the checkpoint beacon are the shared Menu 2 ones in public/models/3d/menu2.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   // a flat ice slab (the ice sheets)
   ice: { x: 1.9061, y: 0.7316, z: 1.7955 },
   // a tall ice block (the boulder steps, the cairn climb)
   block: { x: 1.8989, y: 1.4446, z: 1.8597 },
   snow: { x: 1.8974, y: 1.1182, z: 1.5775 },
   snow2: { x: 1.9002, y: 1.0124, z: 1.2892 },
   cracked: { x: 1.902, y: 0.1872, z: 1.3719 },
   crystal: { x: 1.3438, y: 1.912, z: 1.2105 },
   peak: { x: 1.8977, y: 1.2, z: 1.8948 },
   icicle: { x: 1.8697, y: 1.9069, z: 1.0013 },
   snowball: { x: 1.8361, y: 1.9066, z: 1.8723 },
   yeti: { x: 1.5497, y: 1.9034, z: 1.01 },
   cairn: { x: 1.8884, y: 1.1936, z: 1.7097 },
   golem: { x: 1.575, y: 1.9032, z: 0.7314 },
   slime: { x: 1.8999, y: 1.5242, z: 1.1559 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** The Frost Golem stands 9 m tall; the yeti 2.6 m; a slime 0.9 m. */
export const GOLEM_H = 9;
export const YETI_H = 2.6;
export const SLIME_H = 0.9;
export const ORB_SIZE = 0.55;

const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "ice-peak-jumper"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   ice: prop("m2IcePlatformV2", "#bfe9ff"),
   block: prop("m2IcePlatform", "#a5d8ff"),
   snow: prop("m2SnowLedge", "#f1f5f9"),
   snow2: prop("m2SnowLedgeV2", "#f8fafc"),
   cracked: prop("m2CrackedIcePlatform", "#93c5fd"),
   crystal: prop("m2IceCrystal", "#7dd3fc"),
   peak: prop("m2IcePeakBg", "#e0f2fe"),
   icicle: prop("m2Icicle", "#bae6fd"),
   snowball: prop("m2Snowball", "#f8fafc"),
   yeti: prop("m2SnowYeti", "#e2e8f0"),
   cairn: prop("m2SummitCairn", "#94a3b8"),
   golem: { ...prop("m2FrostGolemBoss", "#7dd3fc"), budget: BIG },
   slime: { ...prop("m2IceSlime", "#67e8f9"), budget: BIG },
   beacon: prop("checkpointBeacon", "#fbbf24", "menu2"),
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
