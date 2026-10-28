// Color City Sprint's models. The five heroes are the shared Menu 2 heroes (menu2/heroModels.ts).
// This game's props are in public/models/3d/color-city-sprint (from ready/menu2/color-city-sprint,
// plus m2FactoryDrone from ready/menu2/shared). The tower and the low brick block are reused from
// rooftop-roll-climb, the beacon from menu2/ and the traffic light from shared/ (all already in the
// manifest; not copied). Every GLB is one mesh, feet on y = 0, centred on x and z, facing +z.
// GLB_SIZE is the measured raw bounds; each fit below turns it into the rules' metres.
import { heroModelAsset } from "@/arcade3d/menu2/heroModels";
import type { ModelAsset } from "@/arcade3d/core/types";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { BUS_HALF_L, BUS_HALF_W, BUS_ROOF, RAMP_H, RAMP_HALF_W, RAMP_LEN, STREET_HALF, TRUCK_HALF_L, TRUCK_HALF_W, TRUCK_ROOF } from "./city";

/** Raw GLB bounds (x, y, z), measured on the optimized meshes. */
export const GLB_SIZE = {
   barrier: { x: 1.3193, y: 0.8756, z: 1.8988 },
   bus: { x: 0.5829, y: 0.5641, z: 1.9056 },
   gate: { x: 1.8944, y: 1.8354, z: 0.4198 },
   gem: { x: 1.8655, y: 1.8676, z: 1.8884 },
   drone: { x: 1.9001, y: 1.8199, z: 0.8567 },
   boss: { x: 1.3426, y: 1.3215, z: 1.8953 },
   pastel: { x: 1.8973, y: 1.4455, z: 1.0226 },
   ramp: { x: 1.5812, y: 0.4602, z: 1.8921 },
   cone: { x: 1.7821, y: 1.8944, z: 1.7753 },
   brick: { x: 1.8951, y: 0.6732, z: 1.899 },
   tower: { x: 0.9052, y: 1.8971, z: 0.8364 },
   beacon: { x: 1.1678, y: 1.9023, z: 0.9893 },
   light: { x: 0.547, y: 1.8964, z: 0.5693 },
} as const;

/** A block's building footprint (m): CELL - 2 * STREET_HALF. */
export const BLOCK_W = 12 - 2 * STREET_HALF;

const own = (id: string, color: string, budget: { tris: number; bytes: number } = PROP_BUDGET): ModelAsset => ({ id, url: `/models/3d/color-city-sprint/${id}.glb`, fallback: "box", fallbackColor: color, budget });
const reused = (url: string, id: string, color: string): ModelAsset => ({ id, url, fallback: "box", fallbackColor: color, budget: PROP_BUDGET });

/** The bus: 8.5 m long (its +z nose), 2.6 m wide, its roof at BUS_ROOF (a little taller than the GLB). */
const BUS_SCALE = (BUS_HALF_L * 2) / GLB_SIZE.bus.z;
/** Greyout: 6.4 m long, 3.4 m wide, 3.8 m tall (its brushes on the +z front). */
const BOSS_SCALE = (TRUCK_HALF_L * 2) / GLB_SIZE.boss.z;
/** The ramp GLB rises toward its -z end; 5 m long, 2.6 m wide, RAMP_H at the lip. */
const RAMP_SCALE = RAMP_LEN / GLB_SIZE.ramp.z;
/** A colour gate spans the street (6 m) and stands 3.4 m. */
const GATE_SCALE = (STREET_HALF * 2) / GLB_SIZE.gate.x;
/** A hoarding barrier panel is 3 m long (its z), 2.2 m tall, 0.5 m thick. */
const BARRIER_SCALE = 3 / GLB_SIZE.barrier.z;
/** A pastel row fills half a block (6 m wide, 3 m deep); its height is stretched per block. */
export const PASTEL_SCALE = BLOCK_W / GLB_SIZE.pastel.x;
/** The tower fills a block (6 x 6) and is about 13 m tall at stretch 1. */
export const TOWER_SCALE = BLOCK_W / GLB_SIZE.tower.x;
/** The low brick block fills a block. */
export const BRICK_SCALE = BLOCK_W / GLB_SIZE.brick.x;

export const ASSETS: Record<string, ModelAsset> = {
   hero: heroModelAsset("riko"),
   bus: { ...own("m2CityBus", "#38bdf8"), scale: BUS_SCALE, stretch: [(BUS_HALF_W * 2) / (GLB_SIZE.bus.x * BUS_SCALE), BUS_ROOF / (GLB_SIZE.bus.y * BUS_SCALE), 1] },
   boss: {
      ...own("m2GreySweeperBoss", "#475569", CHARACTER_BUDGET),
      scale: BOSS_SCALE,
      stretch: [(TRUCK_HALF_W * 2) / (GLB_SIZE.boss.x * BOSS_SCALE), TRUCK_ROOF / (GLB_SIZE.boss.y * BOSS_SCALE), 1],
   },
   drone: { ...own("m2FactoryDrone", "#f97316", CHARACTER_BUDGET), scale: 1.3 / GLB_SIZE.drone.x },
   gem: { ...own("m2EnergyGem", "#fde68a"), scale: 0.62 / GLB_SIZE.gem.x },
   cone: { ...own("m2TrafficCone", "#f97316"), scale: 0.8 / GLB_SIZE.cone.y },
   ramp: {
      ...own("m2StreetJumpRamp", "#f59e0b"),
      scale: RAMP_SCALE,
      stretch: [(RAMP_HALF_W * 2) / (GLB_SIZE.ramp.x * RAMP_SCALE), RAMP_H / (GLB_SIZE.ramp.y * RAMP_SCALE), 1],
   },
   gate: { ...own("m2ColorGateV2", "#ef4444"), scale: GATE_SCALE, stretch: [1, 3.4 / (GLB_SIZE.gate.y * GATE_SCALE), 0.6 / (GLB_SIZE.gate.z * GATE_SCALE)] },
   barrier: { ...own("m2CityBarrier", "#f59e0b"), scale: BARRIER_SCALE, stretch: [0.5 / (GLB_SIZE.barrier.x * BARRIER_SCALE), 2.2 / (GLB_SIZE.barrier.y * BARRIER_SCALE), 1] },
   // no asset scale: every placement (skyline.ts, World.tsx) scales it per spot
   pastel: own("m2PastelCityBg", "#f9a8d4"),
   tower: reused("/models/3d/rooftop-roll-climb/m2SkylineTower.glb", "m2SkylineTower", "#7dd3fc"),
   brick: reused("/models/3d/rooftop-roll-climb/m2RooftopBlock.glb", "m2RooftopBlock", "#b45309"),
   beacon: reused("/models/3d/menu2/checkpointBeacon.glb", "checkpointBeacon", "#38bdf8"),
   light: { ...reused("/models/3d/shared/trafficLight.glb", "trafficLight", "#1f2937"), scale: 3.4 / GLB_SIZE.light.y },
};
