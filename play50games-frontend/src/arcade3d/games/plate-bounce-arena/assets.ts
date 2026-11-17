// Plate Bounce Arena's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts); Rollo
// is the shared m2ShadowArmadillo; the score orbs are the shared Menu 2 scoreOrb, the coins the shared
// coin, the slingshot pads the shared bouncePad. Table props live in public/models/3d/plate-bounce-arena.
// Every GLB has its feet on y = 0, centred on x and z. GLB_SIZE is the real mesh (assets.test.ts).
// Riko's cracked block is m2ArenaBlock and the exit hole's lid m2BouncePadRound (ready/menu2, optimized
// locally; the card's m2AngledRamp has no wedge ramp to replace: the ramps are plastic tubes).
// Code stays for: the playfield, rails, ramps (clear plastic tubes), lanterns and rings, the exit hole,
// posts, the deck, the glass and the flippers (menu2/props Flipper, a code-built prop).
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET, SHARED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";

/** Raw GLB bounds (x, y, z), metres in the file. */
export const GLB_SIZE = {
   mushroom: { x: 1.9, y: 1.774, z: 1.856 },
   cabinet: { x: 1.234, y: 1.896, z: 1.422 },
   bumper: { x: 1.082, y: 1.894, z: 1.086 },
   penguin: { x: 1.724, y: 1.888, z: 1.25 },
   plunger: { x: 1.264, y: 1.906, z: 1.262 },
   ring: { x: 1.9, y: 0.407, z: 1.902 },
   stand: { x: 1.9, y: 1.109, z: 0.928 },
   toyTable: { x: 0.924, y: 1.184, z: 1.898 },
   magnet: { x: 1.888, y: 1.353, z: 1.888 },
   pad: { x: 1.812, y: 0.5, z: 1.892 },
   orb: { x: 1.766, y: 1.901, z: 1.77 },
   rollo: { x: 1.298, y: 1.535, z: 1.894 },
   /** m2ArenaBlock: a chunky stone block with metal corner caps (Riko's cracked block, fitted to its wall segment) */
   block: { x: 1.898, y: 1.644, z: 1.865 },
   /** m2BouncePadRound: a flat round pad with a bevelled rim (the exit hole's lid) */
   lid: { x: 1.901, y: 0.096, z: 1.9 },
} as const;

/** The exit hole's lid is drawn this thick (m). */
export const LID_H = 0.2;

const prop = (id: string, color: string, url = `/models/3d/plate-bounce-arena/${id}.glb`): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("zuno"),
   mushroom: { ...prop("m2BounceMushroom", "#ef4444"), fallback: "cylinder" },
   cabinet: prop("m2BumperPost", "#334155"),
   bumper: { ...prop("m2BumperPostV2", "#38bdf8"), fallback: "cylinder" },
   penguin: prop("m2PenguinDropTarget", "#1f2937"),
   plunger: { ...prop("m2PinballPlunger", "#f59e0b"), fallback: "cylinder" },
   ring: { ...prop("m2ScoreRingGold", "#fbbf24"), fallback: "cylinder" },
   stand: prop("m2StadiumStandBgV2I", "#94a3b8"),
   toyTable: prop("m2ToyFlipper", "#d4a24c"),
   magnet: prop("m2HorseshoeMagnet", "#ef4444"),
   pad: prop("bouncePad", "#38bdf8", "/models/3d/menu2/bouncePad.glb"),
   orb: { ...prop("scoreOrb", "#fbbf24", "/models/3d/menu2/scoreOrb.glb"), fallback: "sphere" },
   coin: SHARED_ASSETS.coin,
   rollo: { ...prop("m2ShadowArmadillo", "#6d28d9", "/models/3d/menu2/m2ShadowArmadillo.glb"), budget: CHARACTER_BUDGET },
   block: prop("m2ArenaBlock", "#a8a29e"),
   lid: { ...prop("m2BouncePadRound", "#f472b6"), fallback: "cylinder" },
};

/** Scale that makes a GLB axis `size` draw as `metres`. */
export function fit(size: number, metres: number): number {
   return metres / size;
}
