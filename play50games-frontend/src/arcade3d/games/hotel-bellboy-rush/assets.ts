// Models for Hotel Bellboy Rush: the Hyper3D ready set (menu1-hotel-bellboy-rush/ and the shared
// sofa / traveller), copied into public/models/3d and listed in core/modelManifest.ts. Each fit comes
// from the GLB's measured bounds (GLB units, root space; assets.test.ts re-measures them): the
// drawn size in metres over the raw size. The suitcase on the trolley is the core luggage-rush mesh.
import type { ModelAsset } from "@/arcade3d/core/types";
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import { CHARACTER_BUDGET, EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import { PLANTER_SIZE, SOFA_SIZE } from "./rules";

const local = (id: string, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/hotel-bellboy-rush/${id}.glb`,
   fallback,
   fallbackColor,
   budget: PROP_BUDGET,
});

/** Raw GLB bounds (width x, height y, depth z), measured 2026-10-25. */
export const GLB_SIZE = {
   charBellboy: { width: 1.8786, height: 1.8977, depth: 0.3678 },
   bellboyTrolleyV3T: { width: 1.12, height: 1.902, depth: 1.702 },
   elevatorDoorsSliding: { width: 1.584, height: 1.895, depth: 0.201 },
   hotelRoomDoor: { width: 0.9785, height: 1.8875, depth: 0.1412 },
   keyCard: { width: 1.3167, height: 0.0744, depth: 1.9016 },
   receptionDesk: { width: 1.9022, height: 0.8731, depth: 0.7338 },
   serviceBellV2: { width: 1.8875, height: 1.4288, depth: 1.8236 },
   lobbyPlanterR: { width: 1.8497, height: 1.123, depth: 0.8654 },
   sofa: { width: 1.8916, height: 0.9388, depth: 0.9125 },
   travellerNpc: { width: 0.7422, height: 1.9041, depth: 0.4017 },
} as const;

/** Drawn sizes (m). The blockers' sizes are the rules' (SOFA_SIZE, PLANTER_SIZE, DESK). */
export const BELLBOY_HEIGHT = 1.74;
export const TROLLEY_HEIGHT = 1.3;
/** The V3T red base top (m): where the suitcase stands. */
export const TROLLEY_DECK = 0.52;
export const ELEVATOR_HEIGHT = 2.3;
/** The sliding pair fills the 1.5 m door frame (looks.ts frame half 0.78). */
export const ELEVATOR_WIDTH = 1.5;
export const ROOM_DOOR_HEIGHT = 2.1;
export const DESK_WIDTH = 2.2;
export const DESK_DEPTH = 0.9;
export const BELL_WIDTH = 0.17;
export const CARD_LENGTH = 0.5;
export const GUEST_HEIGHT = 1.7;
export const SUITCASE_HEIGHT = 0.8;

export const BELLBOY_SCALE = BELLBOY_HEIGHT / GLB_SIZE.charBellboy.height;
const deskScale = DESK_WIDTH / GLB_SIZE.receptionDesk.width;
/** The desk top (m): where the bell sits. */
export const DESK_TOP = GLB_SIZE.receptionDesk.height * deskScale;
const trolleyScale = TROLLEY_HEIGHT / GLB_SIZE.bellboyTrolleyV3T.height;
/** The trolley's footprint (m): its long side (GLB z) already runs along the pull. */
export const TROLLEY_LENGTH = GLB_SIZE.bellboyTrolleyV3T.depth * trolleyScale;

/**
 * The bellboy's joints (GLB units: a 1.879 x 1.898 x 0.368 T-pose facing +z; a pillbox hat, a short
 * fitted jacket with brass buttons, trousers, shoes), measured on charBellboy.glb (2026-10-25, the core
 * recipe; bellboy.test.ts). The estimate finds them; set by eye:
 * - hemY = crotchY (estimate 0.633): nothing bridges the legs, the estimate's hem is the close inner
 *   thighs (the band's inner |x| shrinks smoothly from 0.05 at 0.52 to 0.008 at 0.68, no cloth);
 * - armRadius 0.075 (estimate 0.068): the jacket's shoulder seam is 1.28-1.41 high, so the whole sleeve
 *   hangs with the arm.
 */
export const BELLBOY_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.3543,
   shoulderX: 0.2454,
   shoulderZ: -0.0516,
   armRadius: 0.075,
   clavicleX: 0.1227,
   elbowX: 0.4883,
   wristX: 0.7311,
   armSpread: 0.1095,
   crotchY: 0.7907,
   hipY: 0.872,
   hipX: 0.1443,
   hipZ: -0.0939,
   kneeY: 0.436,
   ankleY: 0.1461,
   toeZ: 0.1839,
   heelZ: -0.175,
   legDepth: 0.0816,
   legOuterX: 0.2615,
   hemY: 0.7907,
   spineY: 1.0167,
   chestY: 1.1614,
   neckY: 1.5261,
   headY: 1.5735,
   spineZ: -0.0105,
   shoulderBlend: 0.0409,
   elbowBlend: 0.0341,
   hipBlend: 0.0872,
   kneeBlend: 0.0654,
   ankleBlend: 0.0512,
   crotchBlend: 0.0701,
   spineBlend: 0.0434,
   neckBlend: 0.0237,
};

export const ASSETS = {
   /** Hyper3D image-to-3D from the concept (18k tris, 431 KB): a static T-pose, auto-rigged with BELLBOY_LANDMARKS. Untinted (a face). */
   bellboy: {
      ...local("charBellboy", "capsule", "#991b1b"),
      budget: CHARACTER_BUDGET,
      scale: BELLBOY_SCALE,
      humanoid: { landmarks: BELLBOY_LANDMARKS },
   },
   /** Brass luggage cart, 1.55 m tall, its long side along the pull (rotationY a quarter turn). */
   trolley: { ...local("bellboyTrolleyV3T", "box", "#d4a574"), scale: trolleyScale },
   /** Single door GLB (the ledger: not a sliding pair), 2.30 m tall on the door wall, facing the corridor. */
   elevator: {
      ...local("elevatorDoorsSliding", "box", "#d4a574"),
      scale: ELEVATOR_WIDTH / GLB_SIZE.elevatorDoorsSliding.width,
      stretch: [1, ELEVATOR_HEIGHT / (GLB_SIZE.elevatorDoorsSliding.height * (ELEVATOR_WIDTH / GLB_SIZE.elevatorDoorsSliding.width)), 1] as const,
      rotationY: -Math.PI / 2,
   },
   /** Room door, 2.10 m tall, one InstancedModel for every door, facing the corridor. */
   door: { ...local("hotelRoomDoor", "box", "#7c2d12"), scale: ROOM_DOOR_HEIGHT / GLB_SIZE.hotelRoomDoor.height, rotationY: -Math.PI / 2 },
   /** The key card beacon over the desk, 0.50 m long (its face is tipped up to the camera in the scene). */
   keyCard: { ...local("keyCard", "box", "#fbbf24"), scale: CARD_LENGTH / GLB_SIZE.keyCard.depth },
   desk: {
      ...local("receptionDesk", "box", "#57534e"),
      scale: deskScale,
      stretch: [1, 1, DESK_DEPTH / (GLB_SIZE.receptionDesk.depth * deskScale)] as const,
   },
   bell: { ...local("serviceBellV2", "sphere", "#d4a574"), scale: BELL_WIDTH / GLB_SIZE.serviceBellV2.width },
   /** Dark-wood planter box with a leafy plant (lobbyPlanterR), its long side along the wall. */
   planter: {
      ...local("lobbyPlanterR", "box", "#3f6212"),
      scale: PLANTER_SIZE.z / GLB_SIZE.lobbyPlanterR.width,
      stretch: [1, 1, PLANTER_SIZE.x / (GLB_SIZE.lobbyPlanterR.depth * (PLANTER_SIZE.z / GLB_SIZE.lobbyPlanterR.width))] as const,
   },
   sofa: {
      id: "sofa",
      url: "/models/3d/shared/sofa.glb",
      fallback: "box",
      fallbackColor: "#78716c",
      budget: PROP_BUDGET,
      scale: SOFA_SIZE.z / GLB_SIZE.sofa.width,
      stretch: [1, 1, SOFA_SIZE.x / (GLB_SIZE.sofa.depth * (SOFA_SIZE.z / GLB_SIZE.sofa.width))] as const,
   },
   /** Standing hotel guest (not a T-pose, hands in pockets): unrigged decor, untinted. */
   guest: {
      id: "travellerNpc",
      url: "/models/3d/shared/travellerNpc.glb",
      fallback: "capsule",
      fallbackColor: "#e7e5e4",
      budget: CHARACTER_BUDGET,
      scale: GUEST_HEIGHT / GLB_SIZE.travellerNpc.height,
   },
   /** The core suitcase (luggage-rush v2) on the trolley's deck while a bag is loaded, 0.80 m with its handle. */
   suitcase: { ...EXPANSION_ASSETS.suitcase, scale: SUITCASE_HEIGHT / EXPANSION_GLB_SIZE.suitcase.height },
} satisfies Record<string, ModelAsset>;
