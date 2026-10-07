// Clean the City obstacle props (README "Obstacle props"): where each prop stands. Plain data from
// rules.ts MAPS, the same squares the runner collides with, shared by Primitives.tsx (the GLBs and
// their primitive fallbacks) and props.test.ts (the GLBs as drawn, against those squares, the litter
// spots and the fitted cameras). Spots are module-level: <InstancedModel> must never see a new array.
import type { InstanceSpot } from "@/arcade3d/core/render";
import type { ModelAsset } from "@/arcade3d/core/types";
import { ASSETS } from "./assets";
import { MAPS, type ObstacleKind } from "./rules";

/** The centres of map `map`'s obstacles of `kind`, feet on y = 0, in MAPS order. */
export function obstacleCentres(map: number, kind: ObstacleKind): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (const o of MAPS[map].obstacles) if (o.kind === kind) spots.push({ x: o.x, y: 0, z: o.z });
   return spots;
}

const QUARTER = Math.PI / 2;

/**
 * Copy i turned by turns[i]: the palms lean and the umbrella canopies tilt each their own way. Only
 * quarter turns, on square obstacles, so the drawn footprint stays inside the same square.
 */
const turned = (spots: readonly InstanceSpot[], turns: readonly number[]): InstanceSpot[] =>
   spots.map((spot, i) => ({ ...spot, rotY: turns[i % turns.length] }));

export const PARK_BENCH = obstacleCentres(0, "bench");
export const PARK_TREE = obstacleCentres(0, "tree");
export const PARK_BIN = obstacleCentres(0, "bin");
export const CITY_BUILDING = obstacleCentres(1, "building");
export const CITY_LAMP = obstacleCentres(1, "lamp");
export const CITY_BIN = obstacleCentres(1, "bin");
export const BEACH_PALM = turned(obstacleCentres(2, "palm"), [0, QUARTER, 2 * QUARTER, -QUARTER]);
/** Never a half turn: the canopy tilts down towards +z, so it shows its top to the camera or tilts sideways. */
export const BEACH_POLE = turned(obstacleCentres(2, "pole"), [0, QUARTER, -QUARTER]);
export const BEACH_BIN = obstacleCentres(2, "bin");

export interface PropSet {
   map: number;
   kind: ObstacleKind;
   asset: ModelAsset;
   spots: readonly InstanceSpot[];
}

/** Every obstacle a GLB draws (one <InstancedModel> each). Trees and buildings stay primitives. */
export const GLB_PROPS: readonly PropSet[] = [
   { map: 0, kind: "bench", asset: ASSETS.bench, spots: PARK_BENCH },
   { map: 0, kind: "bin", asset: ASSETS.bin, spots: PARK_BIN },
   { map: 1, kind: "lamp", asset: ASSETS.lamp, spots: CITY_LAMP },
   { map: 1, kind: "bin", asset: ASSETS.bin, spots: CITY_BIN },
   { map: 2, kind: "palm", asset: ASSETS.palm, spots: BEACH_PALM },
   { map: 2, kind: "pole", asset: ASSETS.umbrella, spots: BEACH_POLE },
   { map: 2, kind: "bin", asset: ASSETS.bin, spots: BEACH_BIN },
];
