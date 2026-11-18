// Office Escape level decoration: the corridor dimensions and the per-level decor layouts, as pure
// data (no three.js, no React), so looks.test.ts can check that every prop stays out of the play
// area. Each level is its own department (README "Level looks"): the shared pillars and lane
// stripes stay; the plants, cabinets and the level's set pieces change with the variant. Level 1
// ("openOffice") is the live layout and must never change. Everything here rides the 12 m corridor
// treadmill: spots repeat every CORRIDOR.period metres and never re-spawn.
import type { InstanceSpot } from "@/arcade3d/core/render";
import { LANES } from "./rules";

/** The corridor (m): half-width at the walls, height, the length it covers and its repeat. */
export const CORRIDOR = {
   halfWidth: 4.6,
   height: 9.5,
   /** local z range the treadmill's meshes cover (the group slides up to `period` towards +z) */
   near: 24,
   far: -96,
   period: 12,
} as const;
export const LENGTH = CORRIDOR.near - CORRIDOR.far;
export const MID_Z = (CORRIDOR.near + CORRIDOR.far) / 2;
/** The lane edges (m): the outer lane centres +/- 1 m. The play area is |x| < LANE_EDGE. */
export const LANE_EDGE = LANES[LANES.length - 1] / 1000 + 1;
/** Floor texture tile along the track (m); the treadmill period is a multiple of it. */
export const FLOOR_TILE = 2;
/** Decor stands outside the lanes, between the lane edge and the wall. */
const SIDE = { pillar: CORRIDOR.halfWidth - 0.25, plant: 3.95, cabinet: CORRIDOR.halfWidth - 0.32 } as const;

/** Copies `count` of something every `step` m along the treadmill's local z range. */
export function along(step: number, offset: number, make: (z: number) => InstanceSpot[]): InstanceSpot[] {
   const spots: InstanceSpot[] = [];
   for (let z = CORRIDOR.near - (((CORRIDOR.near - offset) % step) + step) % step; z >= CORRIDOR.far; z -= step) spots.push(...make(z));
   return spots;
}

/** Which department a level's corridor is dressed as (looks.ts LEVEL_VARIANTS). */
export type CorridorVariant = "openOffice" | "meeting" | "copyRoom" | "executive" | "afterHours";

/** One instanced set-piece prop kind: a unit geometry, a colour and where its copies stand. */
export interface SetPiece {
   name: string;
   kind: "box" | "cylinder" | "sphere";
   color: string;
   /** unlit (meshBasicMaterial): reads as self-lit in the night and sunset levels */
   glow?: boolean;
   spots: InstanceSpot[];
}

/** The per-level corridor decor: shared structural spots plus the level's set pieces. */
export interface CorridorDecor {
   pillars: InstanceSpot[];
   pillarBands: InstanceSpot[];
   pots: InstanceSpot[];
   leaves: InstanceSpot[];
   cabinets: InstanceSpot[];
   setPieces: SetPiece[];
}

const PILLAR_SPOTS = along(CORRIDOR.period, 0, (z) =>
   [-SIDE.pillar, SIDE.pillar].map((x) => ({ x, y: CORRIDOR.height / 2, z, sx: 0.5, sy: CORRIDOR.height, sz: 0.62 }))
);
const BAND_SPOTS = along(CORRIDOR.period, 0, (z) =>
   [-SIDE.pillar, SIDE.pillar].flatMap((x) => [
      { x, y: 1.0, z, sx: 0.54, sy: 0.14, sz: 0.66 },
      { x, y: 4.07, z, sx: 0.54, sy: 0.14, sz: 0.66 },
   ])
);
const POT_SPOTS = along(CORRIDOR.period, -6, (z) => [-SIDE.plant, SIDE.plant].map((x) => ({ x, y: 0.24, z, sx: 0.46, sy: 0.48, sz: 0.46 })));
const LEAF_SPOTS = along(CORRIDOR.period, -6, (z) =>
   [-SIDE.plant, SIDE.plant].flatMap((x, i) => [
      { x, y: 0.82, z, scale: 0.78, rotY: i },
      { x: x + 0.08, y: 1.2, z: z - 0.05, scale: 0.5, rotY: i + 1 },
   ])
);
const CABINET_SPOTS = [
   ...along(CORRIDOR.period, -3, (z) => [{ x: -SIDE.cabinet, y: 0.55, z, sx: 0.5, sy: 1.1, sz: 0.62 }]),
   ...along(CORRIDOR.period, -9, (z) => [{ x: SIDE.cabinet, y: 0.55, z, sx: 0.5, sy: 1.1, sz: 0.62 }]),
];

export const CORRIDOR_DECOR: Record<CorridorVariant, CorridorDecor> = {
   // Level 1, the live Open Office: pillars, plants and filing cabinets only (unchanged).
   openOffice: { pillars: PILLAR_SPOTS, pillarBands: BAND_SPOTS, pots: POT_SPOTS, leaves: LEAF_SPOTS, cabinets: CABINET_SPOTS, setPieces: [] },
   // Level 2, Meeting Floor: the corridor opens into a meeting wing with glass-walled pods:
   // round tables with chairs between the lanes and the walls, and standing whiteboards.
   meeting: {
      pillars: PILLAR_SPOTS,
      pillarBands: BAND_SPOTS,
      pots: POT_SPOTS,
      leaves: LEAF_SPOTS,
      cabinets: CABINET_SPOTS,
      setPieces: [
         {
            name: "pod-table-top",
            kind: "cylinder",
            color: "#f8fafc",
            spots: along(CORRIDOR.period, -3, (z) => [-4.02, 4.02].map((x) => ({ x, y: 0.72, z, sx: 0.95, sy: 0.06, sz: 0.95 }))),
         },
         {
            name: "pod-table-base",
            kind: "cylinder",
            color: "#64748b",
            spots: along(CORRIDOR.period, -3, (z) => [-4.02, 4.02].map((x) => ({ x, y: 0.36, z, sx: 0.12, sy: 0.72, sz: 0.12 }))),
         },
         {
            name: "pod-chair",
            kind: "box",
            color: "#475569",
            spots: along(CORRIDOR.period, -3, (z) =>
               [-1, 1].flatMap((s) => [
                  { x: s * 3.52, y: 0.42, z: z - 0.7, sx: 0.42, sy: 0.5, sz: 0.42, rotY: s * 0.3 },
                  { x: s * 3.52, y: 0.42, z: z + 0.7, sx: 0.42, sy: 0.5, sz: 0.42, rotY: -s * 0.3 },
               ])
            ),
         },
         {
            name: "whiteboard",
            kind: "box",
            color: "#ffffff",
            spots: along(CORRIDOR.period, -9, (z) => [-4.18, 4.18].map((x) => ({ x, y: 1.55, z, sx: 1.1, sy: 1.0, sz: 0.06 }))),
         },
         {
            name: "whiteboard-leg",
            kind: "cylinder",
            color: "#94a3b8",
            spots: along(CORRIDOR.period, -9, (z) =>
               [-4.18, 4.18].flatMap((x) => [
                  { x: x - 0.42, y: 0.5, z, sx: 0.05, sy: 1.0, sz: 0.05 },
                  { x: x + 0.42, y: 0.5, z, sx: 0.05, sy: 1.0, sz: 0.05 },
               ])
            ),
         },
      ],
   },
   // Level 3, Copy Room: no plants; copiers and stocked paper shelves crowd the walls, with a
   // yellow safety line along the floor (drawn in the floor texture) and banded pillars.
   copyRoom: {
      pillars: PILLAR_SPOTS,
      pillarBands: BAND_SPOTS,
      pots: [],
      leaves: [],
      cabinets: [],
      setPieces: [
         {
            name: "copier-body",
            kind: "box",
            color: "#cbd5e1",
            spots: along(CORRIDOR.period, -3, (z) => [-3.98, 3.98].map((x) => ({ x, y: 0.55, z, sx: 1.0, sy: 1.1, sz: 0.7 }))),
         },
         {
            name: "copier-lid",
            kind: "box",
            color: "#64748b",
            spots: along(CORRIDOR.period, -3, (z) => [-3.98, 3.98].map((x) => ({ x, y: 1.13, z, sx: 0.9, sy: 0.08, sz: 0.6 }))),
         },
         {
            name: "paper-shelf",
            kind: "box",
            color: "#94a3b8",
            spots: along(CORRIDOR.period, -9, (z) => [-4.15, 4.15].map((x) => ({ x, y: 0.9, z, sx: 0.6, sy: 1.8, sz: 1.6 }))),
         },
         {
            name: "paper-ream",
            kind: "box",
            color: "#f8fafc",
            spots: along(CORRIDOR.period, -9, (z) =>
               [-3.95, 3.95].flatMap((x) => [
                  { x, y: 1.92, z: z - 0.8, sx: 0.45, sy: 0.35, sz: 0.6 },
                  { x, y: 1.92, z: z + 0.8, sx: 0.45, sy: 0.35, sz: 0.6 },
               ])
            ),
         },
      ],
   },
   // Level 4, Executive Floor: night, dark wood and brass; pedestals with trophies and warm
   // uplights between the lanes and the walls, no plants or filing cabinets.
   executive: {
      pillars: PILLAR_SPOTS,
      pillarBands: BAND_SPOTS,
      pots: [],
      leaves: [],
      cabinets: [],
      setPieces: [
         {
            name: "pedestal",
            kind: "box",
            color: "#292019",
            spots: along(CORRIDOR.period, -3, (z) => [-4.05, 4.05].map((x) => ({ x, y: 0.5, z, sx: 0.5, sy: 1.0, sz: 0.5 }))),
         },
         {
            name: "trophy-stem",
            kind: "cylinder",
            color: "#d4a53f",
            spots: along(CORRIDOR.period, -3, (z) => [-4.05, 4.05].map((x) => ({ x, y: 1.15, z, sx: 0.14, sy: 0.3, sz: 0.14 }))),
         },
         {
            name: "trophy-cup",
            kind: "sphere",
            color: "#e3b84f",
            spots: along(CORRIDOR.period, -3, (z) => [-4.05, 4.05].map((x) => ({ x, y: 1.4, z, scale: 0.18 }))),
         },
         {
            name: "lamp-pole",
            kind: "cylinder",
            color: "#1c1917",
            spots: along(CORRIDOR.period, -9, (z) => [-4.15, 4.15].map((x) => ({ x, y: 0.8, z, sx: 0.05, sy: 1.6, sz: 0.05 }))),
         },
         {
            name: "lamp-glow",
            kind: "sphere",
            color: "#ffd98a",
            glow: true,
            spots: along(CORRIDOR.period, -9, (z) => [-4.15, 4.15].map((x) => ({ x, y: 1.75, z, scale: 0.3 }))),
         },
      ],
   },
   // Level 5, After-Hours Office: sunset gloom; dark desks along the walls with glowing monitors
   // and sparse warm floor lamps. The monitors read as the last people left working.
   afterHours: {
      pillars: PILLAR_SPOTS,
      pillarBands: BAND_SPOTS,
      pots: [],
      leaves: [],
      cabinets: [],
      setPieces: [
         // the desks themselves are the bundle's executive-desk GLBs (assets.ts EXEC_DESK_PATTERNS[5])
         {
            name: "monitor-glow",
            kind: "box",
            color: "#5eead4",
            glow: true,
            spots: along(CORRIDOR.period, -3, (z) =>
               [-3.9, 3.9].flatMap((x) => [
                  // standing on the executive desk's top (0.99 m)
                  { x, y: 1.17, z: z - 0.5, sx: 0.5, sy: 0.35, sz: 0.06 },
                  { x, y: 1.17, z: z + 0.5, sx: 0.5, sy: 0.35, sz: 0.06 },
               ])
            ),
         },
         {
            name: "lamp-pole",
            kind: "cylinder",
            color: "#1f2937",
            spots: along(CORRIDOR.period, -9, (z) => [-4.2, 4.2].map((x) => ({ x, y: 0.8, z, sx: 0.05, sy: 1.6, sz: 0.05 }))),
         },
         {
            name: "lamp-glow",
            kind: "sphere",
            color: "#fbbf24",
            glow: true,
            spots: along(CORRIDOR.period, -9, (z) => [-4.2, 4.2].map((x) => ({ x, y: 1.7, z, scale: 0.3 }))),
         },
      ],
   },
};

/** The instanced decor's material colours per variant (lane stripes and panels stay shared). */
export interface DecorColors {
   pillar: string;
   band: string;
   pot: string;
   leaf: string;
   cabinet: string;
   ceiling: string;
   panel: string;
}

export const DECOR_COLORS: Record<CorridorVariant, DecorColors> = {
   openOffice: { pillar: "#f8fafc", band: "#fbbf24", pot: "#f8fafc", leaf: "#22c55e", cabinet: "#94a3b8", ceiling: "#dfe6ef", panel: "#ffffff" },
   meeting: { pillar: "#f8fafc", band: "#0d9488", pot: "#f8fafc", leaf: "#34d399", cabinet: "#94a3b8", ceiling: "#e8e4db", panel: "#fffdf5" },
   copyRoom: { pillar: "#cbd5e1", band: "#facc15", pot: "#f8fafc", leaf: "#22c55e", cabinet: "#94a3b8", ceiling: "#cfd8e3", panel: "#ffffff" },
   executive: { pillar: "#3f2f23", band: "#d4a53f", pot: "#f8fafc", leaf: "#22c55e", cabinet: "#94a3b8", ceiling: "#241b14", panel: "#f5e3b3" },
   afterHours: { pillar: "#39424f", band: "#b45309", pot: "#f8fafc", leaf: "#22c55e", cabinet: "#94a3b8", ceiling: "#1c222c", panel: "#8fa3bd" },
};
