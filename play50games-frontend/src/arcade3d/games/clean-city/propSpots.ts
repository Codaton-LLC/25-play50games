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

// ---------- bases under the palms and the umbrella poles ----------

/**
 * One part of a base drawn under a GLB prop (Primitives.tsx: one <Instanced> per part, a regular
 * prism from three's cylinderGeometry): `sides`-sided, its corners `radiusBottom` / `radiusTop` from
 * the centre, from `y` up by `height`, turned by `turn` (on top of the spot's own turn).
 */
export interface BasePart {
   sides: number;
   radiusBottom: number;
   radiusTop: number;
   height: number;
   y: number;
   turn: number;
   color: string;
}

/** An octagon's corner radius for the face distance `apothem`. */
const octagon = (apothem: number) => apothem / Math.cos(Math.PI / 8);

/**
 * The bases (README "Obstacle props"). At the runner's height the palm trunk (about 0.3 across) and
 * the umbrella pole (0.07) fill little of their squares (1.2 and 0.5), so the runner, pushed into
 * one, stopped 0.33-0.57 short of the trunk and 0.20-0.23 short of the pole. A base fills each square
 * near the ground, so the runner's ring meets something drawn, as at a bench or a bin:
 * - palm: an octagonal wooden planter, its faces on the square's edges (turned an eighth), 0.24
 *   high, the soil a 0.1 rim in; it covers 83 % of the square (the corners stay sand);
 * - umbrella: a round slate stand filling the 0.5 square at the ground (its 24 corners touch the
 *   edges along the axes; 78 % of the square), 0.1 high, and a white sleeve 0.16 across round the
 *   pole up to 0.65, where a beach umbrella's stand holds its pole.
 * Rules never see them (collision is the squares); props.test.ts checks them with the GLBs.
 */
export const PROP_BASE: Partial<Record<GlbKind, readonly BasePart[]>> = {
   palm: [
      { sides: 8, radiusBottom: octagon(0.6), radiusTop: octagon(0.6), height: 0.24, y: 0, turn: Math.PI / 8, color: "#9b6a3e" },
      { sides: 8, radiusBottom: octagon(0.5), radiusTop: octagon(0.5), height: 0.012, y: 0.24, turn: Math.PI / 8, color: "#6f5232" },
   ],
   pole: [
      { sides: 24, radiusBottom: 0.25, radiusTop: 0.19, height: 0.1, y: 0, turn: 0, color: "#475569" },
      { sides: 12, radiusBottom: 0.08, radiusTop: 0.065, height: 0.55, y: 0.1, turn: 0, color: "#e5e7eb" },
   ],
};

export interface BaseSet {
   map: number;
   kind: GlbKind;
   part: BasePart;
   /** one per copy of the prop: the part's centre (cylinderGeometry is centred), the spot's turn plus the part's */
   spots: readonly InstanceSpot[];
}

/** Every base part of every GLB_PROPS entry that has one (module level: <Instanced> must never see a new array). */
export const BASE_SETS: readonly BaseSet[] = GLB_PROPS.flatMap((set) =>
   (PROP_BASE[set.kind] ?? []).map((part) => ({
      map: set.map,
      kind: set.kind,
      part,
      spots: set.spots.map((s) => ({ x: s.x, y: part.y + part.height / 2, z: s.z, rotY: (s.rotY ?? 0) + part.turn })),
   }))
);
