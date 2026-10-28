// Roll Cannon Jump's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts,
// each its own GLB). This game's props live in public/models/3d/roll-cannon-jump; the trampoline and
// the floating stands reuse the shared menu2 bouncePad / islandA / islandB GLBs (already on disk).
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds
// (assets.test.ts measures each mesh with the repo's own GLB reader).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z), measured with core/rig/robotGlb.ts readCharacterGlb. */
export const GLB_SIZE = {
   /** m2RollCannon: the circus cannon, barrel level towards -z (L1's MUST) */
   cannon: { x: 0.9168, y: 1.38, z: 1.8987, top: 1.319 },
   /** m2CannonIsle: the round platform isle */
   isle: { x: 1.9022, y: 0.2332, z: 1.9026, top: 0.1887 },
   /** m2Trampoline */
   trampoline: { x: 1.9016, y: 1.1843, z: 1.8844, top: 0.3361 },
   /** m2BalloonBunch */
   balloon: { x: 1.2739, y: 1.9047, z: 1.3582 },
   /** m2BigTopTentBg: the drained circus tent backdrop */
   tent: { x: 1.887, y: 1.5361, z: 1.8779 },
   /** m2SmokeBlimpBoss: Ashbag (front towards +z) */
   boss: { x: 1.8958, y: 1.5166, z: 1.1721 },
   /** the shared menu2 props this game reuses */
   bouncePad: { x: 1.8124, y: 0.4998, z: 1.8924, top: 0.3225 },
   islandA: { x: 1.8922, y: 0.5103, z: 1.9002, top: 0.4647 },
   islandB: { x: 1.9177, y: 1.439, z: 1.8163, top: 1.4281 },
} as const;

/** A colour orb (the menu2 scoreOrb trail) is drawn 0.62 m across, its centre on the rules' pickup point. */
export const ORB_SIZE = 0.62;

/** Ashbag is drawn this wide (m): m2SmokeBlimpBoss scaled by BOSS_WIDTH / GLB_SIZE.boss.x. */
export const BOSS_WIDTH = 10;
/** The boss GLB's scale (raw units to m). */
export const BOSS_SCALE = BOSS_WIDTH / GLB_SIZE.boss.x;
/** The boss model is a character-sized GLB (27k tris, about 0.8 MB): the character budget, not a prop's. */
export const BOSS_BUDGET = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/roll-cannon-jump/${id}.glb`,
   fallback: "sphere",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

const shared = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/menu2/${id}.glb`,
   fallback: "cylinder",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   cannon: prop("m2RollCannon", "#9ca3af"),
   isle: prop("m2CannonIsle", "#6b7280"),
   trampoline: prop("m2Trampoline", "#f59e0b"),
   balloon: prop("m2BalloonBunch", "#fbbf24"),
   tent: prop("m2BigTopTentBg", "#4b5563"),
   // the level 5 boss (m2CannonIsle is drawn in its place if it fails)
   boss: { ...prop("m2SmokeBlimpBoss", "#6b7280"), budget: BOSS_BUDGET },
   // the shared menu2 props: the trampoline pad and the floating stands
   bouncePad: shared("bouncePad", "#f59e0b"),
   islandA: shared("islandA", "#6b7280"),
   islandB: shared("islandB", "#9ca3af"),
};
