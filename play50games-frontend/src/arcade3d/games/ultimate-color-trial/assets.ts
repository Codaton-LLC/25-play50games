// Ultimate Color Trial's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts).
// This game's own pieces are in public/models/3d/ultimate-color-trial (from p50-assets hyper3d-new and
// hyper3d-recovered, optimised with tools/hyper3d): the Chroma Sentinel, his beacon, the colour
// switch, the trial ring, the spawn pad (the jump pads and the checkpoints), the runway slab, the
// laser emitter, the energy core capsule, the hazard orb and the crystal pedestal (the receptor).
// Two models are reused by url: color-city-sprint's m2ColorGateV2 (the doors and exit gates, tinted)
// and its m2EnergyGem (gems). Every GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is
// the measured raw bounds; each fit below turns it into the rules' metres.
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";

export const GLB_SIZE = {
   /** the Chroma Sentinel: a tall prism guardian, front towards +z */
   boss: { x: 1.7509, y: 1.8889, z: 1.285 },
   /** a slim beacon post */
   beacon: { x: 0.4153, y: 1.8995, z: 0.4244 },
   /** a round floor button on a low housing */
   switch: { x: 1.8978, y: 1.4173, z: 1.8821 },
   /** an upright hoop in the x-y plane (its axis along z) */
   ring: { x: 1.903, y: 1.8911, z: 0.4083 },
   /** a flat round pad */
   pad: { x: 1.8771, y: 0.1766, z: 1.8967 },
   /** a long flat slab along z */
   runway: { x: 1.0019, y: 0.1354, z: 1.9001 },
   /** a low emitter block, lens towards +z */
   emitter: { x: 1.332, y: 1.0536, z: 1.9036 },
   /** a capsule lying along z */
   core: { x: 1.2614, y: 1.3149, z: 1.893 },
   orb: { x: 1.8133, y: 1.8983, z: 1.8694 },
   pedestal: { x: 1.7332, y: 1.8975, z: 1.7406 },
   /** m2ColorGateV2: a gate frame facing z */
   gate: { x: 1.8944, y: 1.8354, z: 0.4198 },
   gem: { x: 1.8655, y: 1.8676, z: 1.8884 },
} as const;

const own = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({
   id,
   url: `/models/3d/ultimate-color-trial/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget,
});

/** The Sentinel's height (m). */
export const BOSS_H = 4.6;
/** The boss beacon's height (m). */
export const BEACON_H = 3.2;
/** A colour switch across (m). */
export const SWITCH_W = 1.7;
/** A hazard orb across (m): the rules' ORB_R x 2. */
export const ORB_W = 2.3;
/** The energy core's length (m). */
export const CORE_L = 1.1;
/** The receptor pedestal's height (m). */
export const PEDESTAL_H = 2.4;
/** A laser emitter's length (m). */
export const EMITTER_L = 1.6;
/** A gem across (m). */
export const GEM_W = 0.6;

/**
 * The rings, pads, runway slabs and gates carry no asset scale: TrialView.tsx places each copy
 * through its own matrix (a ring to its radius, a pad to its radius, a slab to its strip, a door to
 * its width). The rest are fitted here.
 */
export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   boss: { ...own("m2ChromaSentinelBoss", "#3b2a6b", CHARACTER_BUDGET), scale: BOSS_H / GLB_SIZE.boss.y },
   beacon: { ...own("m2BossBeacon", "#f0abfc"), scale: BEACON_H / GLB_SIZE.beacon.y },
   switch: { ...own("m2ColorSwitch", "#e2e8f0"), scale: SWITCH_W / GLB_SIZE.switch.x },
   ring: own("m2TrialRing", "#fde68a"),
   pad: own("m2SpawnPad", "#2a2152"),
   runway: own("m2RunwayPlatform", "#2e2a5a"),
   emitter: { ...own("m2LaserEmitter", "#fca5a5"), scale: EMITTER_L / GLB_SIZE.emitter.z },
   core: { ...own("m2CoreCapsule", "#67e8f9"), scale: CORE_L / GLB_SIZE.core.z },
   orb: { ...own("m2OrbBlob", "#c084fc"), scale: ORB_W / GLB_SIZE.orb.x },
   pedestal: { ...own("m2FloatCrystalPedestal", "#a5f3fc"), scale: PEDESTAL_H / GLB_SIZE.pedestal.y },
   gate: { id: "m2ColorGateV2", url: "/models/3d/color-city-sprint/m2ColorGateV2.glb", fallback: "box", fallbackColor: "#e2e8f0", budget: PROP_BUDGET },
   gem: { id: "m2EnergyGem", url: "/models/3d/color-city-sprint/m2EnergyGem.glb", fallback: "box", fallbackColor: "#fde68a", budget: PROP_BUDGET, scale: GEM_W / GLB_SIZE.gem.x },
};
