// Color Match Jump's models: the ready color-match-jump GLBs (copied from the Hyper3D ready folder, no
// new generation), the shared Menu 2 orb, ice-peak-jumper's Frost Golem (drawn as a grey glass "Echo")
// and the five heroes. Sizes are the GLBs' POSITION bounds (y from 0); every fit is derived from them.
import type { ModelAsset } from "../../core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "../../core/sharedAssets";
import { heroModelAsset, M2_HERO_IDS } from "../../menu2/heroModels";

export const GLB_SIZE = {
   hex: [1.7617, 0.7686, 1.8897],
   hexThin: [1.7707, 0.1784, 1.9036],
   cracked: [1.9009, 0.4139, 1.875],
   pillar: [0.2671, 1.8957, 0.2689],
   beacon: [0.9598, 1.9021, 0.9218],
   lamp: [1.2161, 1.8918, 0.9229],
   arena: [1.8527, 0.6005, 1.9048],
   orb: [1.767, 1.901, 1.77],
   golem: [1.575, 1.9032, 0.7314],
} as const;

/** A hex: 2.0 m flat to flat (x), 2.25 m point to point (z), 0.6 m thick; drawn by its top. */
export const HEX = { w: 2.0, d: 2.25, t: 0.6 } as const;
export const PILLAR = { w: 1.0, h: 14 } as const;
export const BEACON_H = 4.5;
export const LAMP_H = 1.3;
export const ORB_D = 0.55;
export const GOLEM_H = 9;

const BASE = "/models/3d/color-match-jump";
const prop = (id: string, extra: Partial<ModelAsset> = {}, folder = BASE): ModelAsset => ({ id, url: `${folder}/${id}.glb`, fallback: "box", fallbackColor: "#cbd5e1", budget: PROP_BUDGET, ...extra });
/** One white material per look, so the per-instance tint is the hero colour itself. */
const WHITE = { color: "#ffffff", roughness: 0.45, metalness: 0.05 } as const;
/** Hexes glow a little so the darker colours (blue, purple) stay readable at night. */
const HEX_LOOK = { color: "#ffffff", roughness: 0.45, metalness: 0.05, emissive: "#262626" } as const;

export const ASSETS: Record<string, ModelAsset> = {
   ...Object.fromEntries(M2_HERO_IDS.map((id) => [`hero-${id}`, heroModelAsset(id)])),
   hex: prop("m2HexPlatform", { stretch: [HEX.w / GLB_SIZE.hex[0], HEX.t / GLB_SIZE.hex[1], HEX.d / GLB_SIZE.hex[2]], yOffset: -HEX.t, material: HEX_LOOK }),
   cracked: prop("m2CrackedHexPlatform", { stretch: [HEX.w / GLB_SIZE.cracked[0], HEX.t / GLB_SIZE.cracked[1], HEX.d / GLB_SIZE.cracked[2]], yOffset: -HEX.t, material: WHITE }),
   crown: prop("m2HexPlatformV2", { stretch: [(HEX.w * 1.3) / GLB_SIZE.hexThin[0], 0.35 / GLB_SIZE.hexThin[1], (HEX.d * 1.3) / GLB_SIZE.hexThin[2]], yOffset: -0.35, material: { color: "#fde68a", emissive: "#a16207", roughness: 0.3, metalness: 0.4 } }),
   pillar: prop("m2HexPillar", { stretch: [PILLAR.w / GLB_SIZE.pillar[0], PILLAR.h / GLB_SIZE.pillar[1], PILLAR.w / GLB_SIZE.pillar[2]], yOffset: -PILLAR.h, material: { color: "#ffffff", roughness: 0.6, metalness: 0.2 } }),
   beacon: prop("m2CountdownBeacon", { scale: BEACON_H / GLB_SIZE.beacon[1] }),
   lamp: prop("m2SignalOrbLamp", { scale: LAMP_H / GLB_SIZE.lamp[1], material: WHITE }),
   arena: prop("m2FloatingArenaBg", { scale: 1 / GLB_SIZE.arena[0] }),
   orb: { id: "scoreOrb", url: "/models/3d/menu2/scoreOrb.glb", scale: ORB_D / GLB_SIZE.orb[1], fallback: "sphere", fallbackColor: "#fde68a", budget: PROP_BUDGET, material: { color: "#fff7cc", emissive: "#b45309", roughness: 0.3, metalness: 0.2 } },
   golem: prop("m2FrostGolemBoss", { scale: GOLEM_H / GLB_SIZE.golem[1], budget: CHARACTER_BUDGET, material: { color: "#f1f5f9", emissive: "#334155", roughness: 0.2, metalness: 0.3 } }, "/models/3d/ice-peak-jumper"),
};
