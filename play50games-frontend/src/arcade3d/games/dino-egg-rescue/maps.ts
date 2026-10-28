// Dino Egg Rescue's five valleys (pure data, no React). Every level keeps the 30 x 22 m valley box
// (so the camera windows, the clamp and the ridges fit every level) and changes everything inside it:
// where the nest sits, where the four boulder gullies run, the mud, the trunks and rocks, and one twist
// per level:
//   1 Green Valley   today's valley (rules.ts NEST / MUD / TREES / BOULDER_LANES, unchanged)
//   2 Fern Forest    a dense forest: fallen logs block the short way; dash to hop a log
//   3 Riverbank      a river splits the valley: wading is slow and the current drags you east;
//                    two log bridges cross it dry
//   4 Volcanic Pass  basalt spires and lava vents that glow, then erupt (a hit, like a boulder)
//   5 Dino Sanctuary a fenced nest pen with one gate, a hot-spring pond, two geysers and logs
// fairness.test.ts proves each map: lanes clear of the nest, mud, water and vents; every free spot
// reachable from the start; eggs never spawn on a hazard.

export interface MudSpot {
   id: number;
   x: number;
   z: number;
}

/** A gully: boulders roll from start to end (rules.ts adds the level's speed and unlock time). */
export interface LaneLine {
   id: number;
   startX: number;
   startZ: number;
   endX: number;
   endZ: number;
}

export type ObstacleKind = "tree" | "pine" | "fern" | "rock" | "spire" | "log" | "fence" | "reeds";

/**
 * A solid as a capsule on the ground: the segment a..b swept by radius r (a point when a = b). The dino
 * (r 0.55) is pushed out of it. A `low` one (a fallen log) can be hopped by a dash.
 */
export interface Obstacle {
   kind: ObstacleKind;
   ax: number;
   az: number;
   bx: number;
   bz: number;
   r: number;
   low?: boolean;
   /** visual only: height / scale hint for the scene */
   size?: number;
}

/** River or pond water: an axis-aligned box. Wading multiplies speed by WATER.speedMultiplier and drifts the dino. */
export interface WaterBox {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
   /** current, m/s, added to the dino's motion while it wades */
   flowX: number;
   flowZ: number;
}

/** A dry crossing over water (a log bridge): inside it the water neither slows nor drifts. */
export interface Bridge {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
}

/** A lava vent / geyser: glows `warnS` before it erupts for `eruptS`, every `periodS`, offset by `offsetS`. */
export interface Vent {
   x: number;
   z: number;
   r: number;
   periodS: number;
   offsetS: number;
}

export type ValleyTheme = "valley" | "forest" | "river" | "volcano" | "sanctuary";

export interface ValleyMap {
   id: number;
   theme: ValleyTheme;
   nest: { x: number; z: number };
   /** the dino starts on the nest facing this heading (atan2(vx, vz): -π/2 = -x, π/2 = +x) */
   startFacing: number;
   lanes: readonly [LaneLine, LaneLine, LaneLine, LaneLine];
   mud: readonly MudSpot[];
   obstacles: readonly Obstacle[];
   water: readonly WaterBox[];
   bridges: readonly Bridge[];
   vents: readonly Vent[];
   /**
    * Regular eggs spawn at r(t) from the nest at an angle π·a0 + rng·π·span (rules.ts sampleEggSpot;
    * level 1 is 0.65 / 0.9, the valley quadrant), the fallback spot at nest + baseR · (fx, fz).
    */
   eggArc: { a0: number; span: number; fx: number; fz: number };
}

export const WATER = { speedMultiplier: 0.55 } as const;
export const VENT = { warnS: 1.6, eruptS: 1.0 } as const;

const pt = (kind: ObstacleKind, x: number, z: number, r: number, size?: number): Obstacle => ({ kind, ax: x, az: z, bx: x, bz: z, r, size });
const tree = (x: number, z: number) => pt("tree", x, z, 0.256);
const pine = (x: number, z: number, size = 1) => pt("pine", x, z, 0.3, size);
const rock = (x: number, z: number, r = 0.6) => pt("rock", x, z, r);
const spire = (x: number, z: number, r = 0.7) => pt("spire", x, z, r);
const reeds = (x: number, z: number) => pt("reeds", x, z, 0.35);
const log = (ax: number, az: number, bx: number, bz: number): Obstacle => ({ kind: "log", ax, az, bx, bz, r: 0.32, low: true });
const fence = (ax: number, az: number, bx: number, bz: number): Obstacle => ({ kind: "fence", ax, az, bx, bz, r: 0.12 });
const lane = (id: number, startX: number, startZ: number, endX: number, endZ: number): LaneLine => ({ id, startX, startZ, endX, endZ });

// ---------- level 1: Green Valley (today's valley; equal to rules.ts constants, pinned in fairness.test.ts) ----------

export const MAP_1: ValleyMap = {
   id: 1,
   theme: "valley",
   nest: { x: 11.0, z: 7.5 },
   startFacing: -Math.PI / 2,
   lanes: [lane(1, 14, -11, -2, 11), lane(2, 9, -11, -8, 11), lane(3, 4, -11, -14, 11), lane(4, -1, -11, -15, 5)],
   mud: [
      { id: 1, x: -11.5, z: -7.5 },
      { id: 2, x: 11.5, z: 1.0 },
      { id: 3, x: 6.5, z: 9.3 },
   ],
   obstacles: [tree(-13.5, -10.0), tree(-7.5, -9.8), tree(-13.8, -4.6), tree(14.0, -2.5), tree(14.2, 4.5), tree(8.0, 4.5), tree(14.0, 10.0), tree(3.5, 10.2)],
   water: [],
   bridges: [],
   vents: [],
   eggArc: { a0: 0.65, span: 0.9, fx: -1, fz: -0.5 },
};

// ---------- level 2: Fern Forest ----------
// The nest moves to the south-west clearing; four short gullies run down from the northern ridge
// (two of them end in ravines halfway), and the forest between them is thick with trunks and fallen
// logs: walk round a log, or dash to hop it.

export const MAP_2: ValleyMap = {
   id: 2,
   theme: "forest",
   nest: { x: -11.5, z: 7.5 },
   startFacing: Math.PI / 2,
   lanes: [lane(1, -5.5, -11, -3.5, 11), lane(2, 1, -11, 2.5, 2), lane(3, 6.5, -11, 8, 11), lane(4, 12.5, -11, 13.5, -1)],
   mud: [
      { id: 1, x: -11, z: -4 },
      { id: 2, x: 2.5, z: 7.5 },
      { id: 3, x: 13, z: 6 },
   ],
   obstacles: [
      // west of the first gully: the nest clearing's edge
      tree(-13.5, -10), pine(-9.2, -8.6, 1.1), tree(-14, -0.6), pine(-8.6, -1.2), tree(-13.6, 3.6), pine(-7.6, 10.2, 0.9),
      log(-9.6, 2.6, -7.2, 3.8),
      // between gullies 1 and 2
      pine(-1.6, -8.4, 1.2), tree(-0.8, 5.6), pine(0.4, 9.6),
      log(-2.5, -1.4, -0.3, -1.4),
      // between gullies 2 and 3
      tree(4.0, -9.0), pine(4.6, 0.4, 1.1), tree(5.0, 10.0),
      log(3.4, -5.0, 5.2, -5.0),
      // east of gully 3
      pine(10.0, -8.4, 1.2), tree(14.3, 3.0), pine(10.4, 9.8), tree(10.4, 1.4),
      log(9.6, 4.4, 11.4, 4.4),
      // ferns on the forest floor (solid little clumps)
      pt("fern", -6.2, 8.6, 0.4), pt("fern", 10.2, -3.6, 0.4), pt("fern", -12.4, -6.8, 0.4),
   ],
   water: [],
   bridges: [],
   vents: [],
   // from the south-west nest: north to east
   eggArc: { a0: -0.5, span: 0.55, fx: 1, fz: -0.6 },
};

// ---------- level 3: Riverbank ----------
// A river crosses the valley west to east. Two gullies roll down the north bank into the water, two
// roll up from the south hills into it; the nest sits on the south-west bank. Wading is slow and the
// current drags the dino downstream (east); the two log bridges cross dry.

export const RIVER_3: WaterBox = { x0: -15, x1: 15, z0: -2.4, z1: 0.4, flowX: 1.2, flowZ: 0 };

export const MAP_3: ValleyMap = {
   id: 3,
   theme: "river",
   nest: { x: -11, z: 7 },
   startFacing: Math.PI / 2,
   lanes: [lane(1, -9, -11, -6.5, -4), lane(2, 4, -11, 6.5, -4), lane(3, 11.5, 11, 9.5, 1.9), lane(4, 1, 11, -1.5, 1.9)],
   mud: [
      { id: 1, x: -13, z: -8 },
      { id: 2, x: 0, z: -8 },
      { id: 3, x: 12, z: -7 },
      { id: 4, x: 5, z: 6.5 },
      { id: 5, x: -6, z: 4.5 },
   ],
   obstacles: [
      // north bank
      tree(-13.6, -4.2), rock(-3.2, -10.2), reeds(-1.6, -3.4), reeds(9.6, -3.5), tree(13.8, -10.2), rock(9.4, -9.4, 0.5),
      // south bank
      reeds(-8.6, 1.4), reeds(13.4, 1.5), tree(-13.6, 10.2), tree(4.4, 10.2), rock(-4.4, 9.8), tree(14.2, 9.6), rock(6.6, 2.6, 0.5),
   ],
   water: [RIVER_3],
   bridges: [
      { x0: -13.4, x1: -11.0, z0: -2.4, z1: 0.4 },
      { x0: 2.4, x1: 4.8, z0: -2.4, z1: 0.4 },
   ],
   vents: [],
   // from the south-west nest: north round to east
   eggArc: { a0: -0.5, span: 0.6, fx: 1, fz: -0.6 },
};

// ---------- level 4: Volcanic Pass ----------
// The nest sits in a hollow on the west wall. Four lava gullies run down from the volcano's ridge in
// the north; basalt spires stand between them and four lava vents glow, then erupt in turn.

export const MAP_4: ValleyMap = {
   id: 4,
   theme: "volcano",
   nest: { x: -12, z: -1 },
   startFacing: Math.PI / 2,
   lanes: [lane(1, 13, -11, 9, 11), lane(2, 7.5, -11, 3.5, 11), lane(3, 2, -11, -2, 11), lane(4, -3.5, -11, -6.5, 11)],
   mud: [
      { id: 1, x: -12, z: -8 },
      { id: 2, x: -13, z: 4 },
      { id: 3, x: -12, z: 9 },
   ],
   obstacles: [
      spire(-8.6, -9.6), spire(-14, -4.6, 0.6), spire(-8.4, 4.2, 0.6), spire(-8.8, 10.2),
      spire(-1.6, -9.2, 0.55), spire(0.9, 9.6, 0.6),
      spire(8.0, 1.4, 0.55), spire(6.3, 9.8, 0.55),
      rock(14.2, -6.4, 0.6), rock(14.0, 7.2, 0.7),
   ],
   water: [],
   bridges: [],
   vents: [
      { x: 8.8, z: -3, r: 1.0, periodS: 7, offsetS: 0 },
      { x: 4.0, z: -7, r: 1.0, periodS: 7, offsetS: 2.4 },
      { x: -3.3, z: 5, r: 0.7, periodS: 7, offsetS: 4.8 },
      { x: -9.2, z: -4.6, r: 1.0, periodS: 7, offsetS: 1.2 },
   ],
   // from the west nest: north-east round to south-east
   eggArc: { a0: -0.42, span: 0.84, fx: 1, fz: 0 },
};

// ---------- level 5: Dino Sanctuary ----------
// The nest sits in a fenced pen on the south edge with one gate on its north side. Two gullies run
// down the flanks to the edges, two stop at the hot-spring terrace; a warm pond (slow, drifting) lies
// in the north, two geysers erupt beside the pen's approach, and logs lie across the meadow.

export const POND_5: WaterBox = { x0: -4.2, x1: 4.2, z0: -6.6, z1: -4.4, flowX: -1.0, flowZ: 0 };

export const MAP_5: ValleyMap = {
   id: 5,
   theme: "sanctuary",
   nest: { x: 0, z: 8.6 },
   startFacing: Math.PI,
   lanes: [lane(1, -10, -11, -14.5, 4), lane(2, -6, -11, -5.5, 4), lane(3, 6, -11, 5.5, 4), lane(4, 10, -11, 14.5, 4)],
   mud: [
      { id: 1, x: -11, z: 8 },
      { id: 2, x: 11, z: 8 },
      { id: 3, x: 0, z: -9 },
      { id: 4, x: 0, z: 3.6 },
   ],
   obstacles: [
      // the pen: west and east walls to the south edge, the north wall with a 2.4 m gate in the middle
      fence(-3.2, 6.0, -3.2, 11.0), fence(3.2, 6.0, 3.2, 11.0), fence(-3.2, 6.0, -1.2, 6.0), fence(1.2, 6.0, 3.2, 6.0),
      // meadow logs and trees
      log(-9.8, -2.6, -8.0, -1.2), log(8.0, -1.2, 9.8, -2.6), log(-2.4, -1.6, -0.6, -1.0),
      tree(-8.2, 10.4), tree(8.2, 10.4), tree(-13.6, 10.2), tree(13.6, 10.2), pine(-2.0, -9.8), pine(2.4, -10.0),
      rock(-8.6, -8.6, 0.5), rock(8.6, -8.6, 0.5),
   ],
   water: [POND_5],
   bridges: [],
   vents: [
      { x: -2.6, z: 0.4, r: 0.9, periodS: 6, offsetS: 0 },
      { x: 2.6, z: 0.4, r: 0.9, periodS: 6, offsetS: 3 },
   ],
   // from the south nest: west round to east
   eggArc: { a0: -1, span: 1, fx: 0, fz: -1 },
};
