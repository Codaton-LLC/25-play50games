// Zoo Escape maps (pure data, hand-authored): three connected stages the panda crosses north (-z),
// their fences and gates, solids (block movement), sight blockers, bushes (hiding boxes), keeper
// routes and zones, snack candidates, searchlights, jeeps and birds. Units m; x east, z south, y up.
// This file is level 1's map (the module constants, today's game) and the ZooMap type every level's
// map has (maps.ts holds levels 2-5); buildMap derives the solids, blockers and routes.
// Only the seed varies a run: keeper phases and which snack candidates are used (rules.ts).
import type { AABB } from "@/arcade3d/core/collision";
import { createPath, type Path } from "@/arcade3d/core/path";

export type StageIndex = 0 | 1 | 2;

export interface Rect {
   x0: number;
   z0: number;
   x1: number;
   z1: number;
}

/** An XZ box (y 0..h) from its corners. */
export function box(x0: number, z0: number, x1: number, z1: number, h = 2): AABB {
   return { min: { x: Math.min(x0, x1), y: 0, z: Math.min(z0, z1) }, max: { x: Math.max(x0, x1), y: h, z: Math.max(z0, z1) } };
}
/** An XZ box from its centre and full size. */
export function boxAt(x: number, z: number, w: number, d: number, h = 2): AABB {
   return box(x - w / 2, z - d / 2, x + w / 2, z + d / 2, h);
}

/** The keepers' shared cycle per stage (s): multiples of 1.5 s, so every seeded offset C·k/6 is whole 0.25 s steps. */
export const CYCLES = [27, 24, 18] as const;
/** Keeper walking speed on routes (m/s) and the wait at every corner (s); the routes are built from them. */
export const ROUTE_SPEED = 1.3;
export const CORNER_WAIT = 1.2;

/** The map box: the outer box of the three stages (the clamp); fences and gate posts do the rest. */
export const MAP: Rect = { x0: -10, z0: -44, x1: 10, z1: 18 };

export interface Gate {
   /** the gate line's z (the panda crosses it going north, z decreasing) */
   z: number;
   /** the opening */
   x0: number;
   x1: number;
}

export interface Stage {
   bounds: Rect;
   /** the respawn / entry point (stages 2-3: 1.5 m past the previous gate) */
   start: { x: number; z: number };
   /** the gate out of this stage (north edge) */
   gate: Gate;
}

export const STAGES: readonly Stage[] = [
   { bounds: { x0: -7, z0: 0, x1: 7, z1: 18 }, start: { x: -4.5, z: 16.5 }, gate: { z: 0, x0: 3, x1: 5 } },
   { bounds: { x0: -9, z0: -20, x1: 9, z1: 0 }, start: { x: 4, z: -1.5 }, gate: { z: -20, x0: -6, x1: -4 } },
   { bounds: { x0: -10, z0: -42, x1: 10, z1: -20 }, start: { x: -5, z: -21.5 }, gate: { z: -42, x0: 5, x1: 8 } },
];

/** The stage whose box holds a centre at z (the gates are the only links). */
export const stageAt = (z: number): StageIndex => (z > STAGES[0].gate.z ? 0 : z > STAGES[1].gate.z ? 1 : 2);

// ---------- fences (thin solids; the kit fence draws them) ----------

export const FENCE_HALF = 0.1;
/** Fence lines [x0, z0, x1, z1]: stage walls and the gate walls beside each opening. */
export const FENCES: readonly (readonly [number, number, number, number])[] = [
   [-7, 18, 7, 18],
   [-7, 0, -7, 18],
   [7, 0, 7, 18],
   [-9, 0, 3, 0],
   [5, 0, 9, 0],
   [-9, -20, -9, 0],
   [9, -20, 9, 0],
   [-10, -20, -6, -20],
   [-4, -20, 10, -20],
   [-10, -42, -10, -20],
   [10, -42, 10, -20],
   [-10, -42, 5, -42],
   [8, -42, 10, -42],
];
const fenceBox = ([x0, z0, x1, z1]: readonly [number, number, number, number]) =>
   box(Math.min(x0, x1) - FENCE_HALF, Math.min(z0, z1) - FENCE_HALF, Math.max(x0, x1) + FENCE_HALF, Math.max(z0, z1) + FENCE_HALF, 1.1);

/** The drop bar of each gate (solid once it falls), on the gate line across the opening. */
export const BARS: readonly AABB[] = STAGES.map((s) => box(s.gate.x0, s.gate.z - FENCE_HALF, s.gate.x1, s.gate.z + FENCE_HALF, 1.1));
/** The bar falls when the centre is this far past its gate line (bar 0.1 + gap 0.1 + radius 0.5 + margin 0.5). */
export const BAR_DROP = 1.2;

// ---------- props ----------

export type SolidKind =
   | "fence" | "moat" | "rock" | "bamboo" | "kiosk" | "trunk" | "palm" | "bench" | "bin" | "lamp" | "car" | "tower"
   | "pond" | "acacia" | "hut" | "jeep" | "fountain" | "perch" | "wall" | "crate";
/**
 * Tall solids also block sight; benches, bins, lamps, palm bases, fences, water (moat, ponds) and
 * perches do not. Acacias block with their trunk box, huts / walls / crates / parked jeeps with their body.
 */
export const BLOCKS_SIGHT: Record<SolidKind, boolean> = {
   fence: false, moat: false, rock: true, bamboo: true, kiosk: true, trunk: true, palm: false, bench: false, bin: false, lamp: false, car: true, tower: true,
   pond: false, acacia: true, hut: true, jeep: true, fountain: true, perch: false, wall: true, crate: true,
};

export interface Prop {
   kind: SolidKind;
   box: AABB;
   /** drawing: yaw and a size factor */
   yaw: number;
   size: number;
}
export const prop = (kind: SolidKind, b: AABB, yaw = 0, size = 1): Prop => ({ kind, box: b, yaw, size });

/** Rock cluster footprint per rock: the drawn rock is `size` m long, the box 80 % of it. */
const rock = (x: number, z: number, size: number, yaw = 0) => prop("rock", boxAt(x, z, size * 0.8, size * 0.75, 1.4), yaw, size);
const bamboo = (x: number, z: number, yaw = 0) => prop("bamboo", boxAt(x, z, 1.2, 1.2, 2.6), yaw, 1);
const bench = (x: number, z: number, yaw = 0) => prop("bench", yaw === 0 ? boxAt(x, z, 2.0, 0.8, 0.9) : boxAt(x, z, 0.8, 2.0, 0.9), yaw, 1);
const bin = (x: number, z: number) => prop("bin", boxAt(x, z, 0.6, 0.6, 0.9));
const lamp = (x: number, z: number) => prop("lamp", boxAt(x, z, 0.4, 0.4, 3));
const palm = (x: number, z: number, yaw = 0) => prop("palm", boxAt(x, z, 0.6, 0.6, 3), yaw);
const trunk = (x: number, z: number, yaw = 0) => prop("trunk", boxAt(x, z, 0.6, 0.6, 3.5), yaw);
const kiosk = (x: number, z: number, yaw = 0) => prop("kiosk", Math.abs(Math.sin(yaw)) > 0.5 ? boxAt(x, z, 1.6, 2.0, 2.6) : boxAt(x, z, 2.0, 1.6, 2.6), yaw);
/** Parked cars: 4.2 long along z, 2.0 wide, nose to the aisle. */
const car = (x: number, z: number, yaw = 0) => prop("car", boxAt(x, z, 2.0, 4.2, 1.8), yaw);

export const MOAT: readonly AABB[] = [box(-7, 3, -1, 5, 0.3), box(1, 3, 7, 5, 0.3)];
export const BRIDGE = { x0: -1, z0: 3, x1: 1, z1: 5 } as const;
export const TOWER = { x: 10.8, z: -31 } as const;

export const PROPS: readonly Prop[] = [
   // stage 1: the enclosure
   ...MOAT.map((b) => prop("moat", b)),
   rock(-3.1, 12.2, 1.6, 0.4),
   rock(-3.0, 13.6, 1.9, 2.1),
   rock(-3.2, 15.1, 1.6, 4.0),
   bamboo(5.2, 2.1),
   bamboo(-6.0, 9.4),
   bamboo(5.6, 16.6),
   rock(-5.6, 1.4, 1.7, 1.2),
   // stage 2: the visitor plaza
   kiosk(2.0, -2.2, Math.PI / 2),
   kiosk(-3.5, -13.6, Math.PI),
   trunk(6.8, -8.6, 0.6),
   trunk(-7.4, -16.2, 2.2),
   bench(-3.0, -1.4),
   bench(1.0, -18.9),
   bin(-0.5, -1.2),
   bin(-8.2, -12.6),
   lamp(6.6, -3.0),
   lamp(7.9, -18.6),
   lamp(-8.2, -3.0),
   palm(6.2, -10.6, 1),
   palm(-6.6, -11.4, 2.5),
   // stage 3: the parking lot
   car(-7.2, -27.4, 0),
   car(-3.6, -27.4, Math.PI),
   car(3.4, -27.4, 0),
   car(6.9, -27.4, Math.PI),
   car(-6.6, -35.6, Math.PI),
   car(-3.0, -35.6, 0),
   car(2.9, -35.6, Math.PI),
   car(6.4, -35.6, 0),
   prop("kiosk", boxAt(-0.6, -22.75, 1.8, 4.5, 2.6), Math.PI / 2),
   lamp(0.5, -29.8),
   lamp(9.3, -24.0),
   lamp(-5.0, -39.0),
   prop("tower", boxAt(TOWER.x, TOWER.z, 1.2, 1.2, 6)),
];

export const SOLIDS: readonly AABB[] = [...FENCES.map(fenceBox), ...PROPS.map((p) => p.box)];
export const FENCE_BOXES: readonly AABB[] = FENCES.map(fenceBox);

// ---------- bushes (walkable hiding boxes; also sight blockers) ----------

export interface Bush {
   box: AABB;
   stage: StageIndex;
   /** drawing only: a leafy bush (default; stage 1 of level 1 draws bamboo), tall savanna grass, a flower hedge, a crowd of visitors */
   look?: "bush" | "grass" | "flowers" | "crowd";
}
const bush = (stage: StageIndex, x: number, z: number, w = 1.8, d = 1.8): Bush => ({ box: boxAt(x, z, w, d, 0.9), stage });

export const BUSHES: readonly Bush[] = [
   bush(0, -5.3, 11.6),
   bush(0, -4.6, 6.4),
   bush(0, 1.0, 1.4),
   bush(0, 3.0, 15.6),
   bush(1, 7.85, -6.2, 1.7, 1.8),
   bush(1, 7.85, -13.6, 1.7, 1.8),
   bush(1, -7.7, -6.6, 1.8, 1.8),
   bush(1, -2.4, -18.4),
   bush(1, 4.4, -18.5),
   bush(2, -8.6, -24.2, 1.8, 1.8),
   bush(2, -9.0, -31.5, 1.6, 1.8),
   bush(2, -8.6, -39.4, 1.8, 1.8),
   bush(2, 8.6, -39.6, 1.8, 1.8),
];

/** Sight blockers: the tall solids and every bush. */
export const BLOCKERS: readonly AABB[] = [...PROPS.filter((p) => BLOCKS_SIGHT[p.kind]).map((p) => p.box), ...BUSHES.map((b) => b.box)];

// ---------- keepers ----------

export interface KeeperDef {
   stage: StageIndex;
   /** closed route, corner by corner (every corner is a waypoint with a wait) */
   route: readonly { x: number; y: number; z: number }[];
   /** convex, solid-free box holding the route; every investigation target is clamped into it */
   zone: AABB;
}

/**
 * A closed rectangle walked in the given corner order whose walk takes exactly the stage cycle:
 * (cycle - 4 waits) · speed = perimeter, so its `free` side (along z) is derived from the fixed one.
 * Corners from (x, z) with width w towards +x and the derived depth towards `dz` (±1).
 */
export function rectRoute(stage: StageIndex, x: number, z: number, w: number, dz: 1 | -1, clockwise: boolean, cycles: readonly number[] = CYCLES) {
   const half = ((cycles[stage] - 4 * CORNER_WAIT) * ROUTE_SPEED) / 2;
   const d = half - w;
   const a = { x, y: 0, z };
   const b = { x: x + w, y: 0, z };
   const c = { x: x + w, y: 0, z: z + dz * d };
   const e = { x, y: 0, z: z + dz * d };
   return clockwise ? [a, b, c, e] : [a, e, c, b];
}
/** A there-and-back line (2 waypoints, 2 waits) walked in exactly the stage cycle, from (x, z) along `dir` (rad, 0 = +z). */
export function lineRoute(stage: StageIndex, x: number, z: number, dir: number, cycles: readonly number[] = CYCLES) {
   const len = ((cycles[stage] - 2 * CORNER_WAIT) * ROUTE_SPEED) / 2;
   return [{ x, y: 0, z }, { x: x + Math.sin(dir) * len, y: 0, z: z + Math.cos(dir) * len }];
}
function zoneOf(route: readonly { x: number; z: number }[], pad: number): AABB {
   let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
   for (const p of route) {
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z);
   }
   return box(x0 - pad, z0 - pad, x1 + pad, z1 + pad, 2);
}
export function keeper(stage: StageIndex, route: { x: number; y: number; z: number }[], pad = 0.6): KeeperDef {
   return { stage, route, zone: zoneOf(route, pad) };
}

export const KEEPERS: readonly KeeperDef[] = [
   keeper(0, rectRoute(0, -1.5, 6.5, 7.5, 1, false)),
   keeper(1, rectRoute(1, -7.5, -4, 7.5, -1, true)),
   keeper(1, rectRoute(1, -1.5, -10.5, 6.5, -1, false)),
   keeper(2, lineRoute(2, -4.6, -31.5, Math.PI / 2)),
   keeper(2, rectRoute(2, 2, -21.8, 5.8, -1, true)),
   keeper(2, rectRoute(2, -2, -41.2, 6, 1, false)),
];
/** The keepers of each stage (indices into KEEPERS). */
export const STAGE_KEEPERS: readonly (readonly number[])[] = [0, 1, 2].map((s) => KEEPERS.map((k, i) => (k.stage === s ? i : -1)).filter((i) => i >= 0));

// ---------- snacks ----------

/** 7 hand-placed candidates per stage; the seed picks 4 (>= 3 m apart). */
export const SNACK_CANDIDATES: readonly (readonly { x: number; z: number }[])[] = [
   [{ x: -1.6, z: 14.6 }, { x: -1.2, z: 11.4 }, { x: -0.8, z: 8.4 }, { x: -1.6, z: 6.2 }, { x: 1.2, z: 13.2 }, { x: -2.6, z: 8.8 }, { x: 3.0, z: 7.4 }],
   [{ x: 3.0, z: -5.2 }, { x: 1.4, z: -6.6 }, { x: -0.2, z: -9.0 }, { x: -1.6, z: -11.8 }, { x: -2.0, z: -15.6 }, { x: -2.8, z: -17.2 }, { x: -5.0, z: -11.6 }],
   [{ x: -6.8, z: -30.6 }, { x: -5.4, z: -29.8 }, { x: -3.6, z: -31.2 }, { x: -1.4, z: -33.8 }, { x: 0.0, z: -37.0 }, { x: 4.2, z: -31.4 }, { x: 3.4, z: -39.6 }],
];

// ---------- decor (drawing only; never in the rules) ----------

/** Lamp posts by stage index (from PROPS), for the dusk glow. */
export const LAMPS = PROPS.filter((p) => p.kind === "lamp");

// ---------- the map type every level has (level 1 = the constants above) ----------

/** A searchlight on a tower outside its stage: yaw = baseYaw + sweep · sin(2π (t + φ) / period), φ = its stage's first keeper's offset. */
export interface Searchlight {
   x: number;
   z: number;
   baseYaw: number;
   sweep: number;
   period: number;
   halfAngle: number;
   range: number;
   /** a lost sighting radios the nearest keeper of the stage within this */
   radioRange: number;
}

/**
 * A safari jeep driving a closed, axis-aligned loop at a constant speed: once round per stage cycle,
 * phased by its stage's first keeper's offset (rules.jeepPose). Touching it is a catch.
 */
export interface Jeep {
   stage: StageIndex;
   route: readonly { x: number; z: number }[];
   /** body length along the way it drives and width across, m */
   length: number;
   width: number;
}

/** A bird on its perch: a panda walking (not sneaking) past squawks it, and a keeper comes to look. */
export interface Bird {
   stage: StageIndex;
   x: number;
   z: number;
}

/** Drawing-only decor inside a map (never in the rules). */
export interface MapDecor {
   kind: "flowers" | "net" | "tallGrass" | "visitor" | "lightPool" | "track" | "plaza" | "lily";
   x: number;
   z: number;
   w: number;
   d: number;
   yaw?: number;
}

export type ThemeId = "enclosure" | "safari" | "garden" | "central" | "night";

export interface MapSpec {
   id: number;
   theme: ThemeId;
   stages: readonly Stage[];
   cycles: readonly number[];
   /** keeper vision range per stage, m (at most two different values: the keeper slots draw two cones) */
   vision: readonly number[];
   fences: readonly (readonly [number, number, number, number])[];
   props: readonly Prop[];
   bushes: readonly Bush[];
   keepers: readonly KeeperDef[];
   snacks: readonly (readonly { x: number; z: number }[])[];
   /** at most one searchlight per stage (null = none) */
   lights: readonly (Searchlight | null)[];
   jeeps?: readonly Jeep[];
   birds?: readonly Bird[];
   decor?: readonly MapDecor[];
}

export interface ZooMap extends Required<MapSpec> {
   solids: readonly AABB[];
   fenceBoxes: readonly AABB[];
   bars: readonly AABB[];
   blockers: readonly AABB[];
   stageKeepers: readonly (readonly number[])[];
   routes: readonly Path[];
   lamps: readonly Prop[];
   /** the clamp box (level 1: MAP) */
   box: Rect;
}

/** The stage whose box holds a centre at z (the gates are the only links). */
export const stageOf = (map: ZooMap, z: number): StageIndex => (z > map.stages[0].gate.z ? 0 : z > map.stages[1].gate.z ? 1 : 2);

/** A map from its hand-authored parts: solids, blockers, bars, routes and the per-stage keeper lists derived. */
export function buildMap(spec: MapSpec): ZooMap {
   const fenceBoxes = spec.fences.map(fenceBox);
   return {
      jeeps: [],
      birds: [],
      decor: [],
      ...spec,
      solids: [...fenceBoxes, ...spec.props.map((p) => p.box)],
      fenceBoxes,
      bars: spec.stages.map((st) => box(st.gate.x0, st.gate.z - FENCE_HALF, st.gate.x1, st.gate.z + FENCE_HALF, 1.1)),
      blockers: [...spec.props.filter((p) => BLOCKS_SIGHT[p.kind]).map((p) => p.box), ...spec.bushes.map((b) => b.box)],
      stageKeepers: [0, 1, 2].map((st) => spec.keepers.map((k, i) => (k.stage === st ? i : -1)).filter((i) => i >= 0)),
      routes: spec.keepers.map((k) => createPath(k.route, { closed: true })),
      lamps: spec.props.filter((p) => p.kind === "lamp"),
      box: MAP,
   };
}

const DEG = Math.PI / 180;
/** Level 1's searchlight: on the tower east of the parking lot, sweeping the lot. */
export const LIGHT_1: Searchlight = { x: TOWER.x, z: TOWER.z, baseYaw: -Math.PI / 2, sweep: 0.95, period: 9, halfAngle: 12 * DEG, range: 14, radioRange: 12 };

/** Level 1, Small Enclosure: today's map exactly (the constants above). */
export const MAP_1: ZooMap = buildMap({
   id: 1,
   theme: "enclosure",
   stages: STAGES,
   cycles: CYCLES,
   vision: [7, 7, 9],
   fences: FENCES,
   props: PROPS,
   bushes: BUSHES,
   keepers: KEEPERS,
   snacks: SNACK_CANDIDATES,
   lights: [null, null, LIGHT_1],
});
