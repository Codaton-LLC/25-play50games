// Color City Sprint's models. The five heroes are the shared Menu 2 armadillos (menu2/heroModels.ts).
// This game's props live in public/models/3d/color-city-sprint. Buildings and the beacon are reused
// from rooftop-roll-climb and menu2 (already in the manifest; not copied again).
// Every city GLB is one mesh, feet on y = 0, centred on x and z. GLB_SIZE is the real bounds.
import type { HumanoidLandmarks } from "@/arcade3d/core/rig/humanoid";
import { HERO_GLB, HERO_LANDMARKS, HERO_SCALE, HERO_SOLE_Z, heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { BUS_ROOF } from "./city";

export const RIKO_GLB_HEIGHT = HERO_GLB.riko.height;
export const RIKO_SCALE = HERO_SCALE.riko;
export const RIKO_LANDMARKS: HumanoidLandmarks = HERO_LANDMARKS.riko;
export const RIKO_SOLE_Z = HERO_SOLE_Z.riko;

/** Raw GLB bounds (x, y, z), measured on the optimized meshes. */
export const GLB_SIZE = {
   barrier: { x: 1.319319248199463, y: 0.8755743503570557, z: 1.8988052606582642 },
   bus: { x: 0.5828783512115479, y: 0.564145028591156, z: 1.9056332111358643 },
   gate: { x: 1.8743035793304443, y: 1.9029557704925537, z: 0.6245694756507874 },
   gateV2: { x: 1.894370675086975, y: 1.835438847541809, z: 0.4198150336742401 },
   gem: { x: 1.8654865026474, y: 1.8676260709762573, z: 1.8884379863739014 },
   drone: { x: 1.9001233577728271, y: 1.8199268579483032, z: 0.8567056059837341 },
   boss: { x: 1.3425548076629639, y: 1.3215230703353882, z: 1.8952655792236328 },
   city: { x: 1.8973264694213867, y: 1.445502519607544, z: 1.0225571393966675 },
   ramp: { x: 1.5811760425567627, y: 0.460247665643692, z: 1.8921147584915161 },
   cone: { x: 1.78209388256073, y: 1.894371747970581, z: 1.7753082513809204 },
} as const;

/** The bus is 8 m long, its roof at BUS_ROOF. The GLB's long axis is z. */
export const BUS_LENGTH = 8;
export const BUS_SCALE = BUS_LENGTH / GLB_SIZE.bus.z;
/** Greyout is 9 m long (the GLB's long axis is z) and about 3.4 m tall. A character-sized mesh. */
export const BOSS_LENGTH = 9;
export const BOSS_SCALE = BOSS_LENGTH / GLB_SIZE.boss.z;
export const BOSS_BUDGET = { ...CHARACTER_BUDGET } as const;
/** A gem is 0.55 m across, its centre on the rules' pickup point. */
export const GEM_SIZE = 0.55;
/** A cone is 0.72 m tall. */
export const CONE_HEIGHT = 0.72;

const city = (id: string, color: string): ModelAsset => ({
   id,
   url: `/models/3d/color-city-sprint/${id}.glb`,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

const reused = (url: string, id: string, color: string): ModelAsset => ({
   id,
   url,
   fallback: "box",
   fallbackColor: color,
   budget: PROP_BUDGET,
});

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   barrier: city("m2CityBarrier", "#94a3b8"),
   bus: {
      ...city("m2CityBus", "#f59e0b"),
      scale: BUS_SCALE,
      stretch: [2.3 / (GLB_SIZE.bus.x * BUS_SCALE), BUS_ROOF / (GLB_SIZE.bus.y * BUS_SCALE), 1],
   },
   gate: {
      ...city("m2ColorGate", "#fb7185"),
      stretch: [2.6 / GLB_SIZE.gate.x, 1.7 / GLB_SIZE.gate.y, 0.55 / GLB_SIZE.gate.z],
   },
   gateV2: {
      ...city("m2ColorGateV2", "#ef4444"),
      stretch: [4.6 / GLB_SIZE.gateV2.x, 3.2 / GLB_SIZE.gateV2.y, 0.7 / GLB_SIZE.gateV2.z],
   },
   gem: { ...city("m2EnergyGem", "#fde68a"), scale: GEM_SIZE / GLB_SIZE.gem.x },
   drone: {
      ...city("m2FactoryDrone", "#64748b"),
      scale: 1.5 / GLB_SIZE.drone.x,
      budget: BOSS_BUDGET,
   },
   boss: {
      ...city("m2GreySweeperBoss", "#334155"),
      scale: BOSS_SCALE,
      stretch: [2.8 / (GLB_SIZE.boss.x * BOSS_SCALE), 3.4 / (GLB_SIZE.boss.y * BOSS_SCALE), 1],
      budget: BOSS_BUDGET,
   },
   city: {
      ...city("m2PastelCityBg", "#fda4af"),
      scale: 36 / GLB_SIZE.city.x,
   },
   ramp: {
      ...city("m2StreetJumpRamp", "#e2e8f0"),
      scale: 6 / GLB_SIZE.ramp.z,
      stretch: [2.2 / (GLB_SIZE.ramp.x * (6 / GLB_SIZE.ramp.z)), BUS_ROOF / (GLB_SIZE.ramp.y * (6 / GLB_SIZE.ramp.z)), 1],
   },
   cone: { ...city("m2TrafficCone", "#f97316"), scale: CONE_HEIGHT / GLB_SIZE.cone.y },
   block: reused("/models/3d/rooftop-roll-climb/m2RooftopBlock.glb", "m2RooftopBlock", "#64748b"),
   tower: reused("/models/3d/rooftop-roll-climb/m2SkylineTower.glb", "m2SkylineTower", "#94a3b8"),
   beacon: reused("/models/3d/menu2/checkpointBeacon.glb", "checkpointBeacon", "#ef4444"),
};
