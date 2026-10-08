// Clean the City obstacle props (README "Obstacle props"): where each prop stands. Plain data from
// rules.ts MAPS, the same squares the runner collides with. GLB_PROPS is the one list of what the
// GLBs draw: Primitives.tsx renders exactly its entries (asset and spots as listed, nothing picked by
// hand) and props.test.ts checks them as drawn, against those squares, the litter spots and the
// fitted cameras. Spots are module-level: <InstancedModel> must never see a new array.
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

/** Trees and buildings have no GLB: Primitives.tsx draws them as primitives on these spots. */
export const PARK_TREE = obstacleCentres(0, "tree");
export const CITY_BUILDING = obstacleCentres(1, "building");

/** The obstacle kinds a GLB draws. */
export type GlbKind = "bench" | "bin" | "lamp" | "palm" | "pole";

export interface PropSet {
   map: number;
   kind: GlbKind;
   asset: ModelAsset;
   spots: readonly InstanceSpot[];
}

/**
 * Every obstacle a GLB draws, one <InstancedModel> per entry (Primitives.tsx GlbProps renders these
 * and nothing else). The turns, in MAPS order:
 * - palms (-8, -8), (8, -8), (-9, 3), (9, 3): the trunk stands off the crown's centre, so at the
 *   runner's height its widest gap to the square (0.57) is on the GLB's -z side. Unturned, that side
 *   faces away from the camera, behind the crown; a quarter turn puts it towards the nearer side
 *   wall (+x for x > 0), never towards the floor's middle. Never a half turn: that shows it to the
 *   camera (README "Obstacle props").
 * - umbrella poles (-4, -2), (4, -2), (0, 5): never a half turn either. The canopy tilts down towards
 *   +z, so it shows its top to the camera or tilts sideways.
 */
export const GLB_PROPS: readonly PropSet[] = [
   { map: 0, kind: "bench", asset: ASSETS.bench, spots: obstacleCentres(0, "bench") },
   { map: 0, kind: "bin", asset: ASSETS.bin, spots: obstacleCentres(0, "bin") },
   { map: 1, kind: "lamp", asset: ASSETS.lamp, spots: obstacleCentres(1, "lamp") },
   { map: 1, kind: "bin", asset: ASSETS.bin, spots: obstacleCentres(1, "bin") },
   { map: 2, kind: "palm", asset: ASSETS.palm, spots: turned(obstacleCentres(2, "palm"), [QUARTER, 0, 0, -QUARTER]) },
   { map: 2, kind: "pole", asset: ASSETS.umbrella, spots: turned(obstacleCentres(2, "pole"), [0, QUARTER, -QUARTER]) },
   { map: 2, kind: "bin", asset: ASSETS.bin, spots: obstacleCentres(2, "bin") },
];
