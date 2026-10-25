import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET, CHARACTER_BUDGET, REUSED_ASSETS } from "@/arcade3d/core/sharedAssets";
import { COLORS } from "./looks";

const local = (id: string, color: string, scale = 1): ModelAsset => ({ id, url: `/models/3d/postman-3d/${id}.glb`, fallback: "box", fallbackColor: color, budget: PROP_BUDGET, scale });
// Claude measures/imports the ready meshes at the gate. Unlisted urls draw fallbacks.
export const ASSETS = {
   postman: { ...local("charPostman", COLORS.navy), budget: CHARACTER_BUDGET, humanoid: {} },
   letter: local("letter", COLORS.white, 0.2), mailbag: local("mailbag", COLORS.bag, 0.35),
   mailbox: local("mailbox", COLORS.accent, 0.65),
   houseA: local("houseA", COLORS.cream, 2.8), houseB: local("houseB", COLORS.cream, 2.8), houseC: local("houseC", COLORS.cream, 2.8),
   office: local("postOffice", COLORS.accent, 2), van: local("postVan", COLORS.accent, 1.6),
   lamp: local("streetLampVictorian", COLORS.navy, 1.6), bicycle: local("bicycle", COLORS.navy, 0.7),
   holidayTree: local("holidayTree", COLORS.tree, 1.5), fence: local("picketFence", COLORS.white),
   trafficLight: local("trafficLight", COLORS.navy),
   dog: { ...local("dog", COLORS.dog, 0.45), budget: CHARACTER_BUDGET },
   door: { ...REUSED_ASSETS.door, scale: 0.85 }, bench: REUSED_ASSETS.bench,
   car: { ...REUSED_ASSETS.car, scale: 1.4, rotationY: Math.PI / 2 },
} satisfies Record<string, ModelAsset>;
