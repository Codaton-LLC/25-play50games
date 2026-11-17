// Taxi Rush 3D models: the ready Hyper3D GLBs (menu1-taxi-rush-3d + the shared traffic light, cone and
// traveller), fitted from their measured bounds (assets.test.ts checks every fit on the real mesh).
// Everything is in real metres (rules.ts U): the cab is a 4.55 m car next to a 1.75 m rider. The city
// (houses, shops, bus stops, lights, cones, lamps, trees) is fitted to 1 m tall, so a city spot's `scale`
// is its height in metres and nothing is scaled twice.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { U } from "./rules";

/**
 * Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25 / 2026-10-28. `height` is
 * the top above the floor pivot; `minY` is the lowest vertex where the baked wheels were cut out (the
 * code wheels stand on the floor).
 */
export const GLB_SIZE = {
   taxiCab: { width: 0.8166, height: 0.6671, depth: 1.885, minY: 0.0719 },
   trafficCar: { width: 0.9074, height: 0.8145, depth: 1.9, minY: 0.1024 },
   townhouseBlock: { width: 1.5529, height: 1.8983, depth: 1.6696, minY: 0 },
   cornerShop: { width: 1.9053, height: 1.2808, depth: 1.8899, minY: 0 },
   busStop: { width: 1.8964, height: 1.239, depth: 1.0217, minY: 0 },
   trafficLight: { width: 0.547, height: 1.8964, depth: 0.5693, minY: 0 },
   trafficCone: { width: 1.3655, height: 1.8767, depth: 1.3907, minY: 0 },
   travellerNpc: { width: 0.7422, height: 1.9041, depth: 0.4017, minY: 0 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   /** the cab: 2.8 design units = 4.55 m long (its collision circle is 3.74 m across; nose and tail overhang 0.41 m) */
   cabLength: 2.8 * U,
   /** the cab's body: 1.83 m wide, 1.52 m tall (the GLB is a little wide and tall for a sedan) */
   cabStretch: [0.93, 0.94, 1] as const,
   /** traffic: a 4.3 m hatchback, 1.85 m wide, 1.6 m tall, inside the rules' 5.04 x 2.28 m body box */
   carLength: 4.3,
   carStretch: [0.9, 0.86, 1] as const,
   riderHeight: 1.75,
   /** heights of the city pieces (spot scales) */
   houseHeight: 3.2 * U,
   shopHeight: 2.4 * U,
   busStopHeight: 2.6,
   lightHeight: 2.8 * U,
   coneHeight: 0.7,
   lampHeight: 3.2 * U,
   treeHeight: 3.4 * U,
} as const;

const CAB_SCALE = FIT.cabLength / GLB_SIZE.taxiCab.depth;
const CAR_SCALE = FIT.carLength / GLB_SIZE.trafficCar.depth;

/**
 * Where the code wheels go (GLB units of the fitted model, floor pivot; measured on side renders of the
 * mesh with a ring overlay): the centres' |x|, front / rear z (the model's front is +z after its
 * rotationY), the radius (the centre height) and the tyre width.
 */
export const WHEELS_GLB = {
   taxiCab: { x: 0.32, front: 0.585, rear: -0.509, radius: 0.14, width: 0.11 },
   // the car GLB faces -z (rotationY PI turns it): its front wheels sit at z -0.563, the rear at +0.578
   trafficCar: { x: 0.375, front: 0.563, rear: -0.578, radius: 0.152, width: 0.1 },
} as const;

export interface WheelSet {
   /** the wheels' centre |x|, front and rear z, radius (= centre height) and tyre width, in metres */
   x: number;
   front: number;
   rear: number;
   radius: number;
   width: number;
}

function wheelsOf(id: keyof typeof WHEELS_GLB, scale: number, stretch: readonly [number, number, number]): WheelSet {
   const w = WHEELS_GLB[id];
   return { x: w.x * scale * stretch[0], front: w.front * scale, rear: w.rear * scale, radius: w.radius * scale * stretch[1], width: w.width * scale * stretch[0] };
}

/** The wheels in metres. */
export const CAB_WHEELS = wheelsOf("taxiCab", CAB_SCALE, FIT.cabStretch);
export const CAR_WHEELS = wheelsOf("trafficCar", CAR_SCALE, FIT.carStretch);

/** The cab is the hero: a bigger budget than a prop (the raw Rodin mesh is 3000 triangles; textures 1024 px). */
export const HERO_VEHICLE_BUDGET = { tris: 18000, bytes: 1_200_000 } as const;

const local = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   id,
   url: `/models/3d/taxi-rush-3d/${id}.glb`,
   fallback,
   fallbackColor,
   budget: { ...PROP_BUDGET },
   ...fit,
});
const shared = (id: keyof typeof GLB_SIZE, fit: Partial<ModelAsset>, fallback: ModelAsset["fallback"], fallbackColor: string): ModelAsset => ({
   ...local(id, fit, fallback, fallbackColor),
   url: `/models/3d/shared/${id}.glb`,
});
const unit = (h: number) => 1 / h;

export const ASSETS = {
   taxiCab: local("taxiCab", { scale: CAB_SCALE, stretch: FIT.cabStretch, budget: { ...HERO_VEHICLE_BUDGET } }, "box", "#facc15"),
   // the city, 1 m tall
   townhouseBlock: local("townhouseBlock", { scale: unit(GLB_SIZE.townhouseBlock.height) }, "box", "#e7e5e4"),
   cornerShop: local("cornerShop", { scale: unit(GLB_SIZE.cornerShop.height) }, "box", "#f8fafc"),
   busStop: local("busStop", { scale: unit(GLB_SIZE.busStop.height) }, "box", "#1d4ed8"),
   trafficLight: shared("trafficLight", { scale: unit(GLB_SIZE.trafficLight.height) }, "box", "#334155"),
   trafficCone: shared("trafficCone", { scale: unit(GLB_SIZE.trafficCone.height) }, "cylinder", "#f97316"),
   lamp: { ...REUSED_ASSETS.lamp, scale: unit(REUSED_GLB_SIZE.lamp.height) },
   tree: { ...EXPANSION_ASSETS.leafyTree, scale: unit(EXPANSION_GLB_SIZE.leafyTree.height) },
   // the waiting rider: an unrigged NPC (spec: no landmarks in this batch), untinted
   travellerNpc: shared("travellerNpc", { scale: FIT.riderHeight / GLB_SIZE.travellerNpc.height }, "capsule", "#e7e5e4"),
   // traffic: the pigeon-crossing car without its wheels, grey paint (tinted per copy), turned to face +z
   trafficCar: local("trafficCar", { scale: CAR_SCALE, stretch: FIT.carStretch, rotationY: Math.PI }, "box", "#e2e8f0"),
} satisfies Record<string, ModelAsset>;
