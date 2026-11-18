// Crystal Tower's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts). The
// card's own set (ready/menu2/crystal-tower, optimized with tools/hyper3d, no credits): the tier
// crystals are m2Crystal tinted per colour, the beacons m2SequenceBeacon. The rest are Hyper3D GLBs
// already under public/models/3d (reused by url): the pads spin-pole-climb's circular platform (the
// card's m2CrystalHexPlatform has a crystal spire on its top), Riko's walls dragon-cave-rush's crystal cluster,
// the gems color-city-sprint's energy gem, the drones its factory drone, the summit crystal
// ice-peak-jumper's ice crystal, the spire's hanging crystals and the storm shards dragon-cave-rush's
// hanging crystal, the far stars cloud-hopper's sky star, and Prism Shade the menu2 shadow
// armadillo. Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the measured raw
// bounds; each fit below turns it into the rules' metres.
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const GLB_SIZE = {
   /** m2CircularPlatform: a flat disc (its top is its y). The card's m2CrystalHexPlatform has a crystal spire on its top (it would stand through the hero), so it stays out */
   pad: { x: 1.85, y: 0.243, z: 1.902 },
   /** m2Crystal: a single faceted crystal, neutral (tinted per colour) */
   crystal: { x: 1.712, y: 1.902, z: 1.805 },
   /** m2CrystalCluster: a cluster of shards, wide at the base (Riko's dark crystal walls) */
   wall: { x: 1.9119, y: 1.4206, z: 1.8569 },
   /** m2SequenceBeacon: a stone pillar with three crystal sockets and a glowing top */
   beacon: { x: 0.962, y: 1.904, z: 0.972 },
   gem: { x: 1.8655, y: 1.8676, z: 1.8884 },
   /** m2FactoryDrone: rotors along x, front towards +z */
   drone: { x: 1.9001, y: 1.8199, z: 0.8567 },
   /** m2IceCrystal: a tall single crystal */
   summit: { x: 1.3438, y: 1.912, z: 1.2105 },
   /** m2HangingCrystal: wide at the top, the tip pointing down */
   hanging: { x: 1.4138, y: 1.887, z: 0.9562 },
   star: { x: 1.9023, y: 1.7246, z: 0.7376 },
   /** Prism Shade (m2ShadowArmadillo): feet on 0, long along z, head towards +z */
   boss: { x: 1.2982, y: 1.5347, z: 1.8945 },
} as const;

const reused = (id: string, url: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget,
});

/** A crystal is drawn this wide (m), its centre on the rules' CRYSTAL_LIFT point. */
export const CRYSTAL_W = 1.15;
/** A pad disc is this thick (m); its top is the rules' pad y. */
export const PAD_T = 0.45;
/** The beacon post's height (m). */
export const BEACON_H = 2.2;
/** A gem across (m). */
export const GEM_W = 0.6;
/** A drone across (m). */
export const DRONE_W = 1.4;
/** The summit crystal's height (m). */
export const SUMMIT_H = 3.6;
/** Prism Shade's length (m, along z). */
export const BOSS_L = 3.4;

/**
 * The pads and the crystals carry no asset scale: Tower.tsx places each copy through its own matrix
 * (a pad to its radius and PAD_T, a crystal to CRYSTAL_W). The rest are fitted here.
 */
export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("vexa"),
   pad: reused("m2CircularPlatform", "/models/3d/spin-pole-climb/m2CircularPlatform.glb", "#4c1d95"),
   crystal: reused("m2Crystal", "/models/3d/crystal-tower/m2Crystal.glb", "#c084fc"),
   wall: reused("m2CrystalCluster", "/models/3d/dragon-cave-rush/m2CrystalCluster.glb", "#3b0764"),
   beacon: { ...reused("m2SequenceBeacon", "/models/3d/crystal-tower/m2SequenceBeacon.glb", "#a78bfa"), scale: BEACON_H / GLB_SIZE.beacon.y },
   gem: { ...reused("m2EnergyGem", "/models/3d/color-city-sprint/m2EnergyGem.glb", "#fde68a"), scale: GEM_W / GLB_SIZE.gem.x },
   drone: { ...reused("m2FactoryDrone", "/models/3d/color-city-sprint/m2FactoryDrone.glb", "#f472b6", CHARACTER_BUDGET), scale: DRONE_W / GLB_SIZE.drone.x },
   summit: { ...reused("m2IceCrystal", "/models/3d/ice-peak-jumper/m2IceCrystal.glb", "#e9d5ff"), scale: SUMMIT_H / GLB_SIZE.summit.y },
   hanging: reused("m2HangingCrystal", "/models/3d/dragon-cave-rush/m2HangingCrystal.glb", "#a78bfa"),
   star: reused("m2SkyStar", "/models/3d/cloud-hopper/m2SkyStar.glb", "#fde68a"),
   boss: { ...reused("m2ShadowArmadillo", "/models/3d/menu2/m2ShadowArmadillo.glb", "#2b2540", CHARACTER_BUDGET), scale: BOSS_L / GLB_SIZE.boss.z },
};
