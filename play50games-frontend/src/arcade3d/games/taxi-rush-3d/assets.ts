// Taxi Rush 3D models: the ready Hyper3D GLBs (menu1-taxi-rush-3d + the shared traffic light, cone and
// traveller), fitted from their measured bounds (assets.test.ts checks every fit on the real mesh).
// The cab and the rider are fitted to their size in metres. The city (houses, shops, bus stops, lights,
// cones, lamps, trees) is fitted to 1 m tall, so a city spot's `scale` is its height in metres and
// nothing is scaled twice.
import type { ModelAsset } from "@/arcade3d/core/types";
import { EXPANSION_ASSETS, EXPANSION_GLB_SIZE, PROP_BUDGET, REUSED_ASSETS, REUSED_GLB_SIZE } from "@/arcade3d/core/sharedAssets";
import { CAR_L, CAR_W } from "./rules";

/** Raw GLB bounds (Rodin units, pivot on the floor centre), measured 2026-10-25. */
export const GLB_SIZE = {
   taxiCab: { width: 0.8166, height: 0.6671, depth: 1.885 },
   townhouseBlock: { width: 1.5529, height: 1.8983, depth: 1.6696 },
   cornerShop: { width: 1.9053, height: 1.2808, depth: 1.8899 },
   busStop: { width: 1.8964, height: 1.239, depth: 1.0217 },
   trafficLight: { width: 0.547, height: 1.8964, depth: 0.5693 },
   trafficCone: { width: 1.3655, height: 1.8767, depth: 1.3907 },
   travellerNpc: { width: 0.7422, height: 1.9041, depth: 0.4017 },
} as const;

/** Drawn sizes in metres. */
export const FIT = {
   /** the cab: 2.8 m long (its collision circle is 2.3 m across; the nose and tail overhang 0.25 m) */
   cabLength: 2.8,
   riderHeight: 1.75,
   /** heights of the city pieces (spot scales) */
   houseHeight: 3.2,
   shopHeight: 2.4,
   busStopHeight: 2.0,
   lightHeight: 2.8,
   coneHeight: 0.55,
   lampHeight: 3.2,
   treeHeight: 3.4,
} as const;

const CAB_SCALE = FIT.cabLength / GLB_SIZE.taxiCab.depth;
const CAR_SCALE = (2 * CAR_L) / REUSED_GLB_SIZE.car.depth;

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
   taxiCab: local("taxiCab", { scale: CAB_SCALE }, "box", "#facc15"),
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
   // traffic: the pigeon-crossing car stretched to the rules' 3.10 x 1.40 m body
   car: {
      ...REUSED_ASSETS.car,
      scale: CAR_SCALE,
      stretch: [(2 * CAR_W) / (REUSED_GLB_SIZE.car.width * CAR_SCALE), 1, 1] as const,
   },
} satisfies Record<string, ModelAsset>;
