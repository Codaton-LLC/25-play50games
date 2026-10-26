// Mars Rover Mission models: the ready Hyper3D GLBs (menu1-mars-rover-mission), fitted from their measured
// bounds (assets.test.ts checks every fit on the real meshes). Gameplay props are fitted to their size in
// metres; decor (walls, mesas, base camp) is fitted to 1 m so a spot's scale is its size, never scaled twice.
// Skipped: marsRoverV2 (thin mast parts), groundSolarPanel (flat slab; V2 used), ancientMarsRuin (ledger:
// nine free-standing pillars with no base).
import type { HumanoidLandmarks } from "@/arcade3d/core/rig";
import { CHARACTER_BUDGET, PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { ModelAsset } from "@/arcade3d/core/types";
import { BOULDER_RADIUS, ROCK_RADIUS, ROVER } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   marsRover: { width: 1.5467, height: 1.5055, depth: 1.8857 },
   marsBase: { width: 1.4362, height: 0.813, depth: 1.8862 },
   commsAntenna: { width: 1.1487, height: 1.8992, depth: 0.7972 },
   groundSolarPanelV2: { width: 1.8904, height: 1.122, depth: 1.3924 },
   chargingStation: { width: 1.0886, height: 1.9001, depth: 1.1515 },
   sampleRock: { width: 1.9003, height: 1.3454, depth: 1.8925 },
   beaconLight: { width: 1.038, height: 1.9055, depth: 0.9518 },
   researchCrate: { width: 1.9048, height: 1.3231, depth: 1.7744 },
   landingCapsule: { width: 1.2929, height: 1.888, depth: 1.2784 },
   charAstronaut: { width: 1.897, height: 1.7794, depth: 0.7127 },
   marsMesaRock: { width: 1.8002, height: 0.7524, depth: 1.904 },
   marsBoulder: { width: 1.7783, height: 1.5568, depth: 1.8862 },
   marsMesaTall: { width: 1.7937, height: 0.5978, depth: 1.8927 },
} as const;

/** Drawn sizes (m). */
export const FIT = {
   /** nose to tail: the rover's 1.1 m collision circle is 2.2 across */
   roverLength: 2.4,
   /** solid rocks: their width is the collision circle's diameter */
   rockWidth: 2 * ROCK_RADIUS,
   /** the boulder's width is its collision diameter */
   boulderWidth: 2 * BOULDER_RADIUS,
   /** the sample lifted into the rover's tray, and the one waiting in each ring */
   sampleSize: 0.45,
   /** tall enough to read from across the plain */
   beaconHeight: 3.0,
   stationHeight: 1.7,
   astronautHeight: 1.7,
} as const;

const k = (want: number, have: number) => want / have;
const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/mars-rover-mission/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...fit,
});

export const ROVER_SCALE = k(FIT.roverLength, GLB_SIZE.marsRover.depth);
export const BOULDER_SCALE = k(FIT.boulderWidth, GLB_SIZE.marsBoulder.depth);
/** half the boulder's drawn height: its centre's height when it rolls on the ground */
export const BOULDER_HALF_H = (GLB_SIZE.marsBoulder.height * BOULDER_SCALE) / 2;
export const ASTRONAUT_SCALE = k(FIT.astronautHeight, GLB_SIZE.charAstronaut.height);

/**
 * The astronaut's joints (GLB units: a 1.897 x 1.779 x 0.713 T-pose facing +z, a bulky suit, an open
 * helmet, a backpack), from the core estimate on charAstronaut.glb (2026-10-25; astronaut.test.ts), set by
 * eye from the height profile:
 * - hemY = crotchY (estimate 0.6525): the suit's thighs touch, nothing is cloth;
 * - neckY 1.34 / headY 1.38 (estimate 1.3865 / 1.4903): the helmet starts at the neck ring (1.38), so the
 *   whole helmet with the face in it turns as one.
 * She is decor at the base camp: idle and a cheer on a win, never a walk.
 */
export const ASTRONAUT_LANDMARKS: HumanoidLandmarks = {
   shoulderY: 1.2116,
   shoulderX: 0.3283,
   shoulderZ: 0.0711,
   armRadius: 0.0876,
   clavicleX: 0.1642,
   elbowX: 0.5454,
   wristX: 0.7625,
   armSpread: 0.1765,
   crotchY: 1.0009,
   hipY: 1.0736,
   hipX: 0.1663,
   hipZ: 0.0373,
   kneeY: 0.5368,
   ankleY: 0.194,
   toeZ: 0.3564,
   heelZ: -0.1293,
   legDepth: 0.1456,
   legOuterX: 0.2883,
   hemY: 1.0009,
   spineY: 1.115,
   chestY: 1.1564,
   neckY: 1.34,
   headY: 1.38,
   spineZ: -0.0002,
   shoulderBlend: 0.0525,
   elbowBlend: 0.0438,
   hipBlend: 0.1074,
   kneeBlend: 0.0805,
   ankleBlend: 0.0605,
   crotchBlend: 0.0747,
   spineBlend: 0.0124,
   neckBlend: 0.0519,
};

export const ASSETS = {
   /**
    * the player: 2.4 m long along its GLB z (the axis it drives along: yaw 0 = +z, no rotationY), its nose (the
    * dense instrument end) at +z and the mast aft of centre (assets.test.ts); four wheels in the mesh (the body
    * bobs on a spring; the wheels are not split)
    */
   rover: local("marsRover", { scale: ROVER_SCALE, budget: { tris: 5000, bytes: 300_000 } }, "box", "#ea580c"),
   /** solid rocks, as wide as their collision circle */
   rock: local("sampleRock", { scale: k(FIT.rockWidth, GLB_SIZE.sampleRock.width) }, "sphere", "#b45309"),
   /** the sample: in each ring until scanned, then in the tray */
   sample: local("sampleRock", { scale: k(FIT.sampleSize, GLB_SIZE.sampleRock.width) }, "sphere", "#fbbf24"),
   /** rolling boulders: centred on their middle (yOffset) so the pool can spin them about their centre */
   boulder: local(
      "marsBoulder",
      { scale: BOULDER_SCALE, yOffset: -BOULDER_HALF_H },
      "sphere",
      "#7c2d12"
   ),
   beacon: local("beaconLight", { scale: k(FIT.beaconHeight, GLB_SIZE.beaconLight.height) }, "cylinder", "#f97316"),
   charger: local("chargingStation", { scale: k(FIT.stationHeight, GLB_SIZE.chargingStation.height) }, "cylinder", "#22c55e"),
   // decor, fitted to 1 m: the spot's scale is the size
   solarPanel: local("groundSolarPanelV2", { scale: k(1, GLB_SIZE.groundSolarPanelV2.width) }, "box", "#0284c7"),
   base: local("marsBase", { scale: k(1, GLB_SIZE.marsBase.depth) }, "box", "#cbd5e1"),
   antenna: local("commsAntenna", { scale: k(1, GLB_SIZE.commsAntenna.height) }, "cylinder", "#e2e8f0"),
   crate: local("researchCrate", { scale: k(1, GLB_SIZE.researchCrate.width) }, "box", "#d97706"),
   capsule: local("landingCapsule", { scale: k(1, GLB_SIZE.landingCapsule.height) }, "capsule", "#f1f5f9"),
   /** the boundary: low layered slabs (the ledger reads it as a wall, not a mesa), 1 m wide */
   wall: local("marsMesaRock", { scale: k(1, GLB_SIZE.marsMesaRock.depth) }, "box", "#9a3412"),
   /** the skyline: layered mesas beyond the walls, 1 m wide */
   mesa: local("marsMesaTall", { scale: k(1, GLB_SIZE.marsMesaTall.depth) }, "box", "#9a3412"),
   astronaut: {
      ...local("charAstronaut", { scale: ASTRONAUT_SCALE }, "capsule", "#f8fafc"),
      budget: CHARACTER_BUDGET,
      humanoid: { landmarks: ASTRONAUT_LANDMARKS },
   },
} satisfies Record<string, ModelAsset>;

/** The rover's collision radius for the fit test (re-exported so the test reads one place). */
export const ROVER_RADIUS = ROVER.radius;
