// Models for Train Station Rush: the Hyper3D ready set (menu1-train-station-rush/ and the shared
// traveller), copied into public/models/3d and listed in core/modelManifest.ts. Each fit comes from
// the GLB's measured bounds (GLB units, root space; assets.test.ts re-measures them). The suitcase is
// the core luggage-rush mesh, the island lamps the core clean-city lamp.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { LOCO_LEN } from "./looks";

const local = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/train-station-rush/${id}.glb`,
   fallback,
   fallbackColor,
   budget: PROP_BUDGET,
});

/** Raw GLB bounds (width x, height y, depth z), measured 2026-10-25. */
export const GLB_SIZE = {
   charStationWorker: { width: 1.8929, height: 1.8214, depth: 0.4527 },
   trainCarV2: { width: 0.2651, height: 0.3254, depth: 1.8957 },
   locomotiveFront: { width: 0.289, height: 0.394, depth: 1.898 },
   platformCanopy: { width: 1.0027, height: 0.9254, depth: 1.8985 },
   platformSign: { width: 1.8988, height: 1.4142, depth: 0.7072 },
   stationBench: { width: 1.9012, height: 0.7888, depth: 0.7359 },
   stationClock: { width: 1.4068, height: 1.8961, depth: 0.3906 },
   stationTrolley: { width: 1.098, height: 1.7394, depth: 1.898 },
   backpack: { width: 1.4772, height: 1.8966, depth: 1.2178 },
   ticketMachine: { width: 1.0192, height: 1.9026, depth: 0.9822 },
   travellerNpc: { width: 0.7422, height: 1.9041, depth: 0.4017 },
} as const;

/** Drawn sizes (m). */
export const WORKER_HEIGHT = 1.78;
export const CAR_WIDTH = 2;
export const CANOPY_WIDTH = 4;
export const CANOPY_HEIGHT = 2;
export const SIGN_WIDTH = 1.2;
export const BENCH_WIDTH = 1.9;
/** The clock hangs on the entrance wall over the doors. */
export const CLOCK_HEIGHT = 1.35;
export const TROLLEY_LENGTH = 1.04;
export const BACKPACK_HEIGHT = 0.55;
export const SUITCASE_HEIGHT = 0.8;
/** The bag in the worker's arms: smaller copies so the carry reads at play size without a second scale. */
export const HELD_SUITCASE_HEIGHT = 0.56;
export const HELD_BACKPACK_HEIGHT = 0.47;
export const TICKET_HEIGHT = 1.7;
export const TRAVELLER_HEIGHT = 1.7;
export const LAMP_HEIGHT = 2.8;

export const WORKER_SCALE = WORKER_HEIGHT / GLB_SIZE.charStationWorker.height;
const carScale = CAR_WIDTH / GLB_SIZE.trainCarV2.width;
/** One carriage's length (m) along the track. */
export const CAR_LENGTH = GLB_SIZE.trainCarV2.depth * carScale;
export const CAR_HEIGHT = GLB_SIZE.trainCarV2.height * carScale;
/** The engine: as tall as a carriage, squeezed along the track to the LOCO_LEN the carriages are placed after. */
const locoScale = CAR_HEIGHT / GLB_SIZE.locomotiveFront.height;
export const LOCO_WIDTH = GLB_SIZE.locomotiveFront.width * locoScale;
/** The canopy turned a quarter so its long side spans the island; 2.0 m tall. */
const canopyScale = CANOPY_WIDTH / GLB_SIZE.platformCanopy.depth;
export const CANOPY_DEPTH = GLB_SIZE.platformCanopy.width * canopyScale;

/**
 * The station worker's joints (GLB units: a 1.893 x 1.821 x 0.453 T-pose facing +z; a peaked cap, a
 * hi-vis vest over a shirt, trousers, boots), measured on charStationWorker.glb (2026-10-25, the core
 * recipe; worker.test.ts). The estimate finds them; set by eye:
 * - hemY = crotchY (estimate 0.592): nothing bridges the legs, the estimate's hem is the close inner
 *   thighs (the band's inner |x| shrinks smoothly from 0.045 at 0.56 to 0 at 0.68);
 * - armRadius 0.085 (estimate 0.078): the shirt's shoulder seam reaches 1.12-1.33, so the whole sleeve
 *   hangs with the arm.
 */
export const WORKER_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2557,
   shoulderX: 0.2755,
   shoulderZ: -0.0582,
   armRadius: 0.085,
   clavicleX: 0.1377,
   elbowX: 0.5103,
   wristX: 0.7451,
   armSpread: 0.1774,
   crotchY: 0.721,
   hipY: 0.7963,
   hipX: 0.1706,
   hipZ: -0.0599,
   kneeY: 0.3982,
   ankleY: 0.1629,
   toeZ: 0.2264,
   heelZ: -0.154,
   legDepth: 0.0974,
   legOuterX: 0.3105,
   hemY: 0.721,
   spineY: 0.9341,
   chestY: 1.0719,
   neckY: 1.4078,
   headY: 1.4609,
   spineZ: -0.0052,
   shoulderBlend: 0.0466,
   elbowBlend: 0.0389,
   hipBlend: 0.0796,
   kneeBlend: 0.0597,
   ankleBlend: 0.0415,
   crotchBlend: 0.0865,
   spineBlend: 0.0413,
   neckBlend: 0.0266,
};

export const ASSETS = {
   /** Hyper3D image-to-3D from the concept (18k tris, 462 KB): a static T-pose, auto-rigged with WORKER_LANDMARKS. Untinted (a face). */
   worker: {
      ...local("charStationWorker", "capsule", "#f97316"),
      budget: CHARACTER_BUDGET,
      scale: WORKER_SCALE,
      humanoid: { landmarks: WORKER_LANDMARKS },
   },
   /** A long low carriage, 2.0 m wide, along the track (+z); one dynamic pool for every train. */
   car: { ...local("trainCarV2", "box", "#38bdf8"), scale: carScale },
   /** The white and blue engine (locomotiveFront), CAR_HEIGHT tall, its z squeezed to LOCO_LEN. */
   loco: {
      ...local("locomotiveFront", "box", "#0ea5e9"),
      scale: locoScale,
      stretch: [1, 1, LOCO_LEN / (GLB_SIZE.locomotiveFront.depth * locoScale)] as const,
   },
   /**
    * A pitched shelter with benches, its long side across the island, 2.0 m tall. Drawn in one slate
    * material: its own texture reads as green shag at play size (README Known issues).
    */
   canopy: {
      ...local("platformCanopy", "box", "#94a3b8"),
      material: { color: "#64748b", roughness: 0.55, metalness: 0.15 },
      scale: canopyScale,
      rotationY: Math.PI / 2,
      stretch: [1, CANOPY_HEIGHT / (GLB_SIZE.platformCanopy.height * canopyScale), 1] as const,
   },
   /** One sign per platform behind its pad, facing the camera; its plate is the canvas atlas. */
   sign: { ...local("platformSign", "box", "#1e293b"), scale: SIGN_WIDTH / GLB_SIZE.platformSign.width },
   bench: { ...local("stationBench", "box", "#78350f"), scale: BENCH_WIDTH / GLB_SIZE.stationBench.width },
   /** The station clock on the entrance wall (the timetable's face), 1.35 m. */
   clock: { ...local("stationClock", "box", "#e2e8f0"), scale: CLOCK_HEIGHT / GLB_SIZE.stationClock.height },
   /** A luggage trolley parked on the concourse (decor), turned a quarter. */
   trolley: { ...local("stationTrolley", "box", "#64748b"), scale: TROLLEY_LENGTH / GLB_SIZE.stationTrolley.depth },
   /** A bag task's other look (0.55 m). */
   backpack: { ...local("backpack", "box", "#0f766e"), scale: BACKPACK_HEIGHT / GLB_SIZE.backpack.height },
   /** Ticket machines by the entrance (decor; their text-like marks stay in the background). */
   ticket: { ...local("ticketMachine", "box", "#334155"), scale: TICKET_HEIGHT / GLB_SIZE.ticketMachine.height },
   /** Passengers and the crowd (not a T-pose, hands in pockets): unrigged, untinted, one pool. */
   traveller: {
      id: "travellerNpc",
      url: "/models/3d/shared/travellerNpc.glb",
      fallback: "capsule",
      fallbackColor: "#e7e5e4",
      budget: CHARACTER_BUDGET,
      scale: TRAVELLER_HEIGHT / GLB_SIZE.travellerNpc.height,
   },
   /** A bag task's suitcase (core luggage-rush v2), 0.80 m with its handle. */
   suitcase: { ...EXPANSION_ASSETS.suitcase, scale: SUITCASE_HEIGHT / EXPANSION_GLB_SIZE.suitcase.height },
   heldSuitcase: { ...EXPANSION_ASSETS.suitcase, scale: HELD_SUITCASE_HEIGHT / EXPANSION_GLB_SIZE.suitcase.height },
   heldBackpack: { ...local("backpack", "box", "#0f766e"), scale: HELD_BACKPACK_HEIGHT / GLB_SIZE.backpack.height },
   /** Island lamps (core clean-city lamp), 2.8 m. */
   lamp: { ...REUSED_ASSETS.lamp, scale: LAMP_HEIGHT / REUSED_GLB_SIZE.lamp.height },
} satisfies Record<string, ModelAsset>;
