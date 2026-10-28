// Dragon Cave Rush's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/dragon-cave-rush (the ready set from
// ~/.play50/hyper3d/ready/menu2/dragon-cave-rush, plus m2PatrolBot from ready/menu2/shared); the orb,
// the bat and the checkpoint beacon are the shared Menu 2 ones in public/models/3d/menu2.
// Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds (assets.test.ts).
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

/** Raw GLB bounds (x, y, z). */
export const GLB_SIZE = {
   // the cart runs along its z; its bed is 0.45 up
   cart: { x: 1.1734, y: 1.4982, z: 1.9003 },
   // a rail piece runs along its x
   track: { x: 1.8959, y: 0.4562, z: 0.7982 },
   scaffold: { x: 1.8993, y: 1.5042, z: 1.8119 },
   // Cindermaw (m2CinderDragon, Hyper3D): four-legged, wings folded, head towards +z
   dragon: { x: 1.7205, y: 1.5084, z: 1.8966 },
   egg: { x: 1.8653, y: 1.376, z: 1.9033 },
   hoard: { x: 1.9022, y: 1.128, z: 1.8416 },
   gate: { x: 1.3701, y: 1.9011, z: 1.8883 },
   // wide at the top, the tip pointing down
   crystal: { x: 1.4138, y: 1.887, z: 0.9562 },
   lavafall: { x: 1.8942, y: 1.5144, z: 1.8945 },
   lantern: { x: 1.2, y: 1.9062, z: 1.5049 },
   stalagmites: { x: 1.9078, y: 1.6612, z: 1.1687 },
   rock: { x: 1.8311, y: 0.9604, z: 1.9072 },
   cluster: { x: 1.9119, y: 1.4206, z: 1.8569 },
   mushrooms: { x: 1.9003, y: 1.2653, z: 1.518 },
   arch: { x: 1.9011, y: 0.819, z: 0.7065 },
   wall: { x: 1.8941, y: 1.8818, z: 1.4468 },
   bot: { x: 1.5672, y: 1.8972, z: 0.8016 },
   bat: { x: 1.9004, y: 1.3533, z: 0.567 },
   orb: { x: 1.7668, y: 1.9012, z: 1.7699 },
} as const;

/** The cart: 1.5 m wide, 1.35 m tall, 2.25 m long; the hero stands on its bed. */
export const CART_SCALE = { x: 1.5 / GLB_SIZE.cart.x, y: 1.35 / GLB_SIZE.cart.y, z: 2.25 / GLB_SIZE.cart.z } as const;
export const CART_BED = 0.45 * CART_SCALE.y;
/** A rail piece: 2.4 m long. */
export const TRACK_LEN = 2.4;
export const TRACK_SCALE = TRACK_LEN / GLB_SIZE.track.x;
/** Cindermaw chasing: 8 m long; on the loop (level 5) 13 m. */
export const DRAGON_CHASE = 8 / GLB_SIZE.dragon.z;
export const DRAGON_BOSS = 13 / GLB_SIZE.dragon.z;
export const ORB_SIZE = 0.55;

/** The dragon and the patrol bot are character-sized GLBs (15k / 18k tris): the character budget. */
const BIG = { ...CHARACTER_BUDGET } as const;

const prop = (id: string, color: string, folder = "dragon-cave-rush"): ModelAsset => ({
   id,
   url: `/models/3d/${folder}/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   cart: prop("m2MineCart", "#78350f"),
   track: prop("m2MineTrack", "#57534e"),
   scaffold: prop("m2MineScaffold", "#92400e"),
   dragon: { ...prop("m2CinderDragon", "#9ca3af"), budget: BIG },
   egg: prop("m2DragonEgg", "#dc2626"),
   hoard: prop("m2DragonHoard", "#ca8a04"),
   gate: prop("m2DragonSkullGate", "#a8a29e"),
   crystal: prop("m2HangingCrystal", "#a78bfa"),
   lavafall: prop("m2LavafallRock", "#ea580c"),
   lantern: prop("m2CaveLanternPost", "#f59e0b"),
   stalagmites: prop("m2Stalagmites", "#57534e"),
   rock: prop("m2CaveRock", "#78716c"),
   cluster: prop("m2CrystalCluster", "#c084fc"),
   mushrooms: prop("m2GlowMushrooms", "#22d3ee"),
   arch: prop("m2CaveArchBridge", "#78716c"),
   wall: prop("m2CaveWallChunk", "#57534e"),
   bot: { ...prop("m2PatrolBot", "#64748b"), budget: BIG },
   // the shared bat is a 15k-tri creature (flooded-ruins-escape budgets it the same way)
   bat: { ...prop("m2CaveBat", "#4c1d95", "menu2"), budget: BIG },
   orb: prop("scoreOrb", "#f59e0b", "menu2"),
};
