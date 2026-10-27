// Cloud Hopper's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB). This game's props live in public/models/3d/cloud-hopper.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z). cloud.top is the puff at the origin, the walkable crown. */
export const GLB_SIZE = {
   cloud: { x: 1.8418844938278198, y: 1.6637135744094849, z: 1.900559425354004, top: 1.6637135744094849 },
   feather: { x: 1.001891851425171, y: 1.895516276359558, z: 0.26062870025634766 },
   star: { x: 1.902271032333374, y: 1.7245855331420898, z: 0.737642228603363 },
   windRing: { x: 1.8852708339691162, y: 1.9020168781280518, z: 0.8593805432319641 },
   rainbow: { x: 1.9011526107788086, y: 0.7578415274620056, z: 0.5023049712181091 },
   storm: { x: 1.8936362266540527, y: 1.3123397827148438, z: 1.4208033084869385 },
   castle: { x: 1.7162638902664185, y: 1.714633822441101, z: 1.8908324241638184 },
   bank: { x: 0.801439106464386, y: 1.7607693672180176, z: 1.9095768928527832 },
   // Gloom Nimbus (m2GloomNimbusBoss, Hyper3D High): a storm-cloud face, front towards +z
   boss: { x: 1.9041727781295776, y: 1.8485896587371826, z: 1.6619154214859009 },
} as const;

/** A star (the colour orb, m2SkyStar) is drawn 0.62 m across, its centre on the rules' pickup point. */
export const ORB_SIZE = 0.62;

/** Gloom Nimbus is drawn this wide (m): m2GloomNimbusBoss scaled by BOSS_WIDTH / GLB_SIZE.boss.x (m2StormCloud the same width as its fallback). */
export const BOSS_WIDTH = 11;
/** The boss GLB's scale (raw units to m). */
export const BOSS_SCALE = BOSS_WIDTH / GLB_SIZE.boss.x;
/** The boss model is a character-sized GLB (15k tris, about 0.6 MB): the character budget, not a prop's. */
export const BOSS_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/cloud-hopper/${id}.glb`,
   fallback: "sphere",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   cloud: prop("m2CloudPlatformV2", "#f4f8ff"),
   feather: prop("m2Feather", "#fde68a"),
   star: prop("m2SkyStar", "#fbbf24"),
   windRing: prop("m2WindRing", "#7dd3fc"),
   rainbow: prop("m2RainbowBridge", "#f9a8d4"),
   storm: prop("m2StormCloud", "#94a3b8"),
   castle: prop("m2CloudCastleBg", "#c4b5fd"),
   // a low cloud bank from sky-tower-jump's set (decor under the run)
   bank: prop("m2CloudBank", "#e8f0fb"),
   // the level 5 boss (its own Hyper3D model; m2StormCloud is drawn in its place if it fails)
   boss: { ...prop("m2GloomNimbusBoss", "#6d28d9"), budget: BOSS_BUDGET },
};
