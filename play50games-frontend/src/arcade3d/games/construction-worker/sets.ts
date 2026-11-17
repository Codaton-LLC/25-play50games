// Each level's surroundings (README "Levels"): the reused Hyper3D GLBs and the code-built landmark
// that make the five sites look like their names. Pure data. Every spot stands outside the fence
// (x -8..8, z -2..12) behind or beside the yard, so nothing is in the crane's wedge, the camera's
// work area or between the camera and the work (sets.test.ts).
import type { ModelAsset } from "@/arcade3d/core/types";
import { PROP_BUDGET } from "@/arcade3d/core/sharedAssets";
import type { CraneSite } from "./levels";

/** Raw GLB bounds (width x, height y, depth z), measured 2026-10-29 (sets.test.ts re-measures them). */
export const SET_GLB = {
   leafyTree: { url: "/models/3d/shared/leafyTree.glb", width: 1.804, height: 1.9133, depth: 1.247 },
   parkBush: { url: "/models/3d/dog-park-fetch/parkBush.glb", width: 1.8705, height: 0.6774, depth: 1.8817 },
   lawnMower: { url: "/models/3d/dog-park-fetch/lawnMower.glb", width: 1.5209, height: 1.4492, depth: 1.8953 },
   picketFence: { url: "/models/3d/postman-3d/picketFence.glb", width: 1.8986, height: 1.0494, depth: 0.2345 },
   houseA: { url: "/models/3d/postman-3d/houseA.glb", width: 1.891, height: 1.895, depth: 1.8932 },
   houseB: { url: "/models/3d/postman-3d/houseB.glb", width: 1.89, height: 1.4928, depth: 1.8061 },
   houseC: { url: "/models/3d/postman-3d/houseC.glb", width: 1.7829, height: 1.6602, depth: 1.8966 },
   mailbox: { url: "/models/3d/postman-3d/mailbox.glb", width: 0.8895, height: 1.8983, depth: 0.6805 },
   streetLamp: { url: "/models/3d/postman-3d/streetLampVictorian.glb", width: 0.4007, height: 1.9024, depth: 0.6856 },
   trafficCar: { url: "/models/3d/taxi-rush-3d/trafficCar.glb", width: 0.9074, height: 0.712, depth: 1.9, minY: 0.102 },
   taxiCab: { url: "/models/3d/taxi-rush-3d/taxiCab.glb", width: 0.8166, height: 0.5952, depth: 1.885, minY: 0.072 },
   cornerShop: { url: "/models/3d/taxi-rush-3d/cornerShop.glb", width: 1.9053, height: 1.2808, depth: 1.8899 },
   townhouseBlock: { url: "/models/3d/taxi-rush-3d/townhouseBlock.glb", width: 1.5529, height: 1.8983, depth: 1.6696 },
   busStop: { url: "/models/3d/taxi-rush-3d/busStop.glb", width: 1.8964, height: 1.239, depth: 1.0217 },
   burgerShop: { url: "/models/3d/burger-delivery-scooter/burgerShopI.glb", width: 1.8534, height: 1.9047, depth: 1.4728 },
   barrel: { url: "/models/3d/robot-collector/barrel.glb", width: 1.7352, height: 1.8977, depth: 1.7368 },
   trafficCone: { url: "/models/3d/shared/trafficCone.glb", width: 1.3655, height: 1.8767, depth: 1.3907 },
   fireHydrant: { url: "/models/3d/firefighter-rescue/fireHydrant.glb", width: 1.0909, height: 1.8836, depth: 0.7933 },
   trafficLight: { url: "/models/3d/shared/trafficLight.glb", width: 0.547, height: 1.8964, depth: 0.5693 },
   glassOffice: { url: "/models/3d/delivery-drone/cityGlassOffice.glb", width: 1.2354, height: 1.8964, depth: 1.2622 },
   buildingTall: { url: "/models/3d/delivery-drone/cityBuildingTall.glb", width: 1.2613, height: 1.8934, depth: 1.1503 },
   buildingV2: { url: "/models/3d/delivery-drone/cityBuildingV2.glb", width: 1.8881, height: 1.6542, depth: 1.8758 },
   brickApartment: { url: "/models/3d/delivery-drone/cityBrickApartment.glb", width: 1.3362, height: 1.8988, depth: 1.3209 },
   beaconLight: { url: "/models/3d/mars-rover-mission/beaconLight.glb", width: 1.038, height: 1.9055, depth: 0.9518 },
} as const;

export type SetKind = keyof typeof SET_GLB;

/** How far a spot's model is lowered so its lowest point (wheels) touches the ground (m). */
export function setDrop(spot: SetSpot): number {
   const glb = SET_GLB[spot.kind] as { height: number; minY?: number };
   return ((glb.minY ?? 0) / glb.height) * spot.h;
}

/** One GLB at unit height: a spot's `scale` is its drawn height in metres. */
export const SET_ASSETS = Object.fromEntries(
   (Object.keys(SET_GLB) as SetKind[]).map((kind) => [
      kind,
      { id: `set-${kind}`, url: SET_GLB[kind].url, scale: 1 / SET_GLB[kind].height, fallback: "box", fallbackColor: "#a8a29e", budget: { tris: 12000, bytes: PROP_BUDGET.bytes * 4 } } satisfies ModelAsset,
   ]),
) as Record<SetKind, ModelAsset>;

export interface SetSpot {
   kind: SetKind;
   x: number;
   z: number;
   /** drawn height (m) */
   h: number;
   rotY?: number;
}

/** A code-built landmark: what the site is named after, standing behind the yard. */
export type Landmark = "gardenShed" | "garage" | "neonSign" | "towerCrane" | null;

export interface SiteSet {
   spots: readonly SetSpot[];
   landmark: Landmark;
   /** where the landmark stands (its footprint centre) and its turn */
   landmarkAt: { x: number; z: number; rotY: number };
   /** the far city skyline (looks.ts DECOR) is drawn on this site */
   skyline: boolean;
}

const fenceRow = (z: number, from: number, to: number, h: number): SetSpot[] => {
   const out: SetSpot[] = [];
   const w = (SET_GLB.picketFence.width / SET_GLB.picketFence.height) * h;
   for (let x = from; x <= to + 1e-9; x += w) out.push({ kind: "picketFence", x, z, h });
   return out;
};

export const SETS: Record<CraneSite, SiteSet> = {
   // a back garden: trees, hedges, a picket fence, a mower and the finished garden shed next door
   shed: {
      spots: [
         { kind: "leafyTree", x: -10.5, z: -4, h: 4.2 },
         { kind: "leafyTree", x: -6.8, z: -7.5, h: 3.6, rotY: 1.2 },
         { kind: "leafyTree", x: 10.4, z: -4.2, h: 4.4, rotY: 0.5 },
         { kind: "leafyTree", x: 11.5, z: 3.5, h: 3.8, rotY: 2.1 },
         { kind: "leafyTree", x: -11.5, z: 5, h: 3.9, rotY: 2.6 },
         { kind: "parkBush", x: -2.8, z: -4.6, h: 0.7 },
         { kind: "parkBush", x: 3.6, z: -4.8, h: 0.75, rotY: 0.7 },
         { kind: "parkBush", x: 10.2, z: 8, h: 0.7 },
         { kind: "parkBush", x: -10.4, z: 9, h: 0.8, rotY: 1.4 },
         { kind: "lawnMower", x: 6.4, z: -4, h: 0.9, rotY: -0.6 },
         ...fenceRow(-3.4, -7.2, 7.2, 0.9),
      ],
      landmark: "gardenShed",
      landmarkAt: { x: -2.2, z: -7.2, rotY: 0.15 },
      skyline: false,
   },
   // a street of small houses: three neighbours, a mailbox, Victorian lamps, a white picket fence
   tinyHouse: {
      spots: [
         { kind: "houseA", x: -9.5, z: -8, h: 5.2, rotY: 0.2 },
         { kind: "houseB", x: 0.5, z: -10, h: 4.4 },
         { kind: "houseC", x: 9.8, z: -8, h: 4.8, rotY: -0.25 },
         { kind: "mailbox", x: -5.6, z: -3.8, h: 1.25, rotY: 0.2 },
         { kind: "streetLamp", x: -3.4, z: -3.8, h: 3.6 },
         { kind: "streetLamp", x: 4.6, z: -3.8, h: 3.6 },
         { kind: "streetLamp", x: 11, z: 4.5, h: 3.6, rotY: -Math.PI / 2 },
         { kind: "leafyTree", x: -12, z: 2, h: 4 },
         { kind: "leafyTree", x: 12.5, z: -1.5, h: 4.3, rotY: 1.1 },
         { kind: "parkBush", x: -10.2, z: 7, h: 0.7 },
         ...fenceRow(-5.2, -12, 12, 0.85),
      ],
      landmark: null,
      landmarkAt: { x: 0, z: 0, rotY: 0 },
      skyline: false,
   },
   // a garage yard: the big garage with its roll-up door, parked cars, oil drums, cones and a hydrant
   garage: {
      spots: [
         { kind: "trafficCar", x: -7.2, z: -5.2, h: 1.55, rotY: 0.35 },
         { kind: "trafficCar", x: 7.8, z: -4.6, h: 1.55, rotY: -0.2 },
         { kind: "barrel", x: 9.8, z: 1, h: 1 },
         { kind: "barrel", x: 10.6, z: 2, h: 1 },
         { kind: "barrel", x: 9.7, z: 2.4, h: 1 },
         { kind: "barrel", x: -10.2, z: 6.5, h: 1 },
         { kind: "trafficCone", x: 3.6, z: -3.6, h: 0.7 },
         { kind: "trafficCone", x: 4.6, z: -3.6, h: 0.7 },
         { kind: "trafficCone", x: -3.8, z: -3.6, h: 0.7 },
         { kind: "fireHydrant", x: -9.6, z: -2.2, h: 0.9 },
      ],
      landmark: "garage",
      landmarkAt: { x: 0, z: -8.2, rotY: 0 },
      skyline: false,
   },
   // a shop street at dusk: a corner shop, a burger bar, townhouses, a bus stop, lamps, a light, a taxi
   shopFront: {
      spots: [
         { kind: "cornerShop", x: -9.6, z: -9, h: 4.4, rotY: 0.25 },
         { kind: "burgerShop", x: 0.5, z: -10.5, h: 5.2 },
         { kind: "townhouseBlock", x: 10, z: -9, h: 7, rotY: -0.25 },
         { kind: "busStop", x: -4.6, z: -4.8, h: 2.6 },
         { kind: "streetLamp", x: -11, z: 0.5, h: 3.8, rotY: Math.PI / 2 },
         { kind: "streetLamp", x: 11, z: 0.5, h: 3.8, rotY: -Math.PI / 2 },
         { kind: "streetLamp", x: 5.2, z: -4.2, h: 3.8 },
         { kind: "trafficLight", x: -7.8, z: -3.8, h: 3.2 },
         { kind: "taxiCab", x: 8.4, z: -4.6, h: 1.3, rotY: Math.PI / 2 },
      ],
      landmark: "neonSign",
      landmarkAt: { x: 0.5, z: -8.8, rotY: 0 },
      skyline: true,
   },
   // downtown at night: glass and brick towers, red aircraft beacons and a second tower crane
   tower: {
      spots: [
         { kind: "glassOffice", x: -14, z: -18, h: 14 },
         { kind: "buildingTall", x: 3, z: -22, h: 17, rotY: 0.3 },
         { kind: "brickApartment", x: 15, z: -16, h: 12, rotY: -0.3 },
         { kind: "buildingV2", x: -5, z: -15, h: 8 },
         { kind: "beaconLight", x: -7.6, z: -3.1, h: 1.4 },
         { kind: "beaconLight", x: 7.6, z: -3.1, h: 1.4 },
         { kind: "trafficCone", x: 3.6, z: -3.6, h: 0.7 },
         { kind: "trafficCone", x: -3.6, z: -3.6, h: 0.7 },
      ],
      landmark: "towerCrane",
      landmarkAt: { x: 10.5, z: -6.5, rotY: -2.2 },
      skyline: true,
   },
};
