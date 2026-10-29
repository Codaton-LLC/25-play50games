// Treasure Island's level maps (levels 2-5): pure data, no React, no three.js. Level 1 is today's
// seeded island in rules.ts (no map). Each map is its own island: the props with their rules
// footprints, the water cut into the ground (a stream, tide pools, a ravine), the bridges over it,
// the gates that open after a number of finds, a hill, painted ground and the find order's types.
// rules.ts turns a map into footprints and places the treasures on it (generateIsland), looks.ts
// draws its ground, MapScene.tsx its props. Units: metres; x east, z south (+z = the dock), y up.
//
// The dock and the start (0, 9.2) are the same on every map: the camera, the clamp and the limit
// proof (README "Server limits") rest on them. Every footprint keeps 3 m clear of the start.

/** What a prop is drawn with (MapScene.tsx PROP_ASSETS). Every kind is a GLB in core/modelManifest.ts. */
export type PropKind =
   | "hut"
   | "bush"
   | "fern"
   | "plant"
   | "boulder"
   | "rock"
   | "cliff"
   | "pillar"
   | "column"
   | "block"
   | "ruinGate"
   | "arch"
   | "wreck"
   | "cannon"
   | "barrel"
   | "crate"
   | "anchor"
   | "flag"
   | "totem"
   | "log"
   | "vine"
   | "shell";

export interface MapProp {
   kind: PropKind;
   x: number;
   z: number;
   /** turn about +y (rad; looks only: footprints are axis-aligned boxes or circles) */
   yaw: number;
   /** drawn size (m) along the model's x, y and z before the turn */
   w: number;
   h: number;
   d: number;
   /** rules footprint: a circle of radius r, or a box of half extents hx / hz, or none (decor) */
   r?: number;
   hx?: number;
   hz?: number;
   /** extra footprint circles (e.g. an arch's two legs); the prop's own r / hx are then unused */
   legs?: ReadonlyArray<{ x: number; z: number; r: number }>;
}

/** Water and chasms cut into the ground: a polyline (or one point) of half-width `half`, carved `depth` m deep (looks). */
export interface Carve {
   kind: "stream" | "pool" | "ravine";
   points: ReadonlyArray<readonly [number, number]>;
   half: number;
   depth: number;
}

/** A bridge over a carve: the gap in its footprint, a deck the explorer is drawn on. */
export interface Bridge {
   kind: "plank" | "rope";
   x: number;
   z: number;
   /** the bridge's long axis: "z" runs north-south, "x" east-west */
   axis: "x" | "z";
   length: number;
   /** half the walkable width (m) */
   half: number;
   /** deck height at its ends (m, looks) and how far the middle sags (rope bridge) */
   deck: number;
   sag: number;
}

/** A blocked path: a box footprint until `opensAfter` treasures are found. */
export interface GateSpec {
   kind: "log" | "vines" | "rockfall";
   x: number;
   z: number;
   hx: number;
   hz: number;
   opensAfter: number;
   /** the line the hint shows while it is shut */
   label: string;
}

/** A smooth hill (looks only: the rules are flat): h * (1 + cos(pi d / r)) / 2 inside radius r. */
export interface Hill {
   x: number;
   z: number;
   h: number;
   r: number;
}

/** A painted patch of ground (looks): a polyline or a point of half-width `half`. */
export interface Paint {
   kind: "path" | "rock" | "mud" | "moss" | "sand" | "ash";
   points: ReadonlyArray<readonly [number, number]>;
   half: number;
}

export type ChainType = "coins" | "gem" | "chest" | "clue" | "map";

export interface IslandMap {
   id: 2 | 3 | 4 | 5;
   /** the theme in looks.ts THEMES (ground, sky, fog and accent colours) */
   theme: "grove" | "cove" | "jungle" | "peak";
   props: readonly MapProp[];
   carves: readonly Carve[];
   bridges: readonly Bridge[];
   gates: readonly GateSpec[];
   paints: readonly Paint[];
   hill?: Hill;
   /** seeded palms: how many, where (rho) and how far apart */
   palms: { min: number; max: number; minRho: number; maxRho: number; apart: number };
   /**
    * The find order's types. Omitted: today's seeded order (coins, gems, the chest 4th or 5th).
    * Given: this order, the last a locked chest the detector cannot sense until every other spot is dug.
    */
   chain?: readonly ChainType[];
   /** the final chest's fixed spot (Pirate Peak's summit); otherwise the generator picks it */
   chestAt?: { x: number; z: number };
}

// ---------- prop makers (the drawn size and the footprint together) ----------

const circleProp = (kind: PropKind, x: number, z: number, w: number, h: number, d: number, r: number, yaw = 0): MapProp => ({ kind, x, z, yaw, w, h, d, r });
const boxProp = (kind: PropKind, x: number, z: number, w: number, h: number, d: number, hx: number, hz: number, yaw = 0): MapProp => ({ kind, x, z, yaw, w, h, d, hx, hz });
const decor = (kind: PropKind, x: number, z: number, w: number, h: number, d: number, yaw = 0): MapProp => ({ kind, x, z, yaw, w, h, d });

/** beachHut.glb, 1.35 x 1.9 x 1.78: drawn 1.9 x 2.6 x 2.4 on a 1.9 x 2.4 box. */
const hut = (x: number, z: number, yaw = 0) => boxProp("hut", x, z, 1.9, 2.6, 2.4, 0.95, 1.2, yaw);
const bush = (x: number, z: number, s = 1, yaw = 0) => circleProp("bush", x, z, 1.6 * s, 1.2 * s, 1.6 * s, 0.7 * s, yaw);
const fern = (x: number, z: number, s = 1, yaw = 0) => circleProp("fern", x, z, 1.3 * s, 0.95 * s, 1.25 * s, 0.45 * s, yaw);
const plant = (x: number, z: number, s = 1, yaw = 0) => circleProp("plant", x, z, 1.4 * s, 1.6 * s, 1.15 * s, 0.52 * s, yaw);
const boulder = (x: number, z: number, s: number, yaw = 0) => circleProp("boulder", x, z, s, 0.52 * s, 0.97 * s, 0.44 * s, yaw);
const rock = (x: number, z: number, s: number, yaw = 0) => circleProp("rock", x, z, s, 0.47 * s, 0.98 * s, 0.42 * s, yaw);
/** waterfallCliff.glb 1.89 x 1.31 x 1.86: a cliff block s across. */
const cliff = (x: number, z: number, s: number, yaw = 0) => circleProp("cliff", x, z, s, 0.75 * s, 0.98 * s, 0.44 * s, yaw);
const pillar = (x: number, z: number, h = 2.4, yaw = 0) => circleProp("pillar", x, z, 0.42 * h, h, 0.42 * h, 0.22 * h, yaw);
const column = (x: number, z: number, h = 2.2, yaw = 0) => circleProp("column", x, z, 0.44 * h, h, 0.44 * h, 0.22 * h, yaw);
/** stoneWall.glb 1.9 x 1.0 x 1.76: a ruin block w x 1.2 x d on its box. */
const block = (x: number, z: number, w: number, d: number, h = 1.2, yaw = 0) => boxProp("block", x, z, w, h, d, w / 2, d / 2, yaw);
const cannon = (x: number, z: number, yaw: number) => circleProp("cannon", x, z, 1.15, 1.2, 1.6, 0.62, yaw);
const barrel = (x: number, z: number, yaw = 0) => circleProp("barrel", x, z, 0.62, 0.8, 0.62, 0.32, yaw);
const crate = (x: number, z: number, yaw = 0) => boxProp("crate", x, z, 0.8, 0.57, 0.8, 0.42, 0.42, yaw);
const fernDecor = (x: number, z: number, s = 0.6, yaw = 0) => decor("fern", x, z, 1.3 * s, 0.95 * s, 1.25 * s, yaw);
const shell = (x: number, z: number, yaw = 0) => decor("shell", x, z, 0.32, 0.22, 0.3, yaw);

/** A wall of foliage along a polyline, one plant every `step` m, skipping the given x (or z) windows. */
function hedge(points: ReadonlyArray<readonly [number, number]>, step: number, skip: ReadonlyArray<readonly [number, number]>, along: "x" | "z", seed: number): MapProp[] {
   const out: MapProp[] = [];
   let k = seed;
   for (let i = 1; i < points.length; i++) {
      const [x0, z0] = points[i - 1];
      const [x1, z1] = points[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / step));
      for (let j = i === 1 ? 0 : 1; j <= n; j++) {
         const x = x0 + ((x1 - x0) * j) / n;
         const z = z0 + ((z1 - z0) * j) / n;
         const c = along === "x" ? x : z;
         if (skip.some(([a, b]) => c > a && c < b)) continue;
         k += 1;
         const s = 0.95 + ((k * 37) % 10) / 40;
         const yaw = (k * 1.7) % 6.28;
         out.push(k % 3 === 0 ? bush(x, z, s, yaw) : plant(x, z, s, yaw));
      }
   }
   return out;
}

// ---------- level 2: Palm Grove (noon) ----------

/** The grove's stream, west to east across the island; the bridges cross it at x -6 and x 6. */
const STREAM: ReadonlyArray<readonly [number, number]> = [
   [-16, -3.6], [-9, -2.0], [-5, -2.8], [-1, -1.2], [3, -1.8], [7, -0.6], [11, -1.5], [16.5, -0.4],
];

export const MAP_2: IslandMap = {
   id: 2,
   theme: "grove",
   carves: [{ kind: "stream", points: STREAM, half: 0.8, depth: 0.75 }],
   bridges: [
      { kind: "plank", x: -6, z: -2.6, axis: "z", length: 3.6, half: 1.0, deck: 0.16, sag: 0 },
      { kind: "plank", x: 6, z: -0.9, axis: "z", length: 3.6, half: 1.0, deck: 0.16, sag: 0 },
   ],
   gates: [{ kind: "log", x: 6, z: -0.9, hx: 1.25, hz: 0.45, opensAfter: 2, label: "A fallen palm blocks the east bridge" }],
   props: [
      // the village: three huts in a clearing north of the stream, one by the west beach
      hut(4.5, -6.8, 0.25),
      hut(8.8, -4.9, -0.45),
      hut(-1.2, -7.4, 0.1),
      hut(-9.2, 4.6, 1.2),
      crate(6.6, -6.3, 0.3),
      crate(2.9, -5.2, 0.8),
      barrel(7.2, -3.4),
      barrel(-7.7, 5.9),
      // the waterfall where the stream leaves the hills (west), mossy boulders along it
      cliff(-11.8, -4.4, 3.0, 0.4),
      boulder(-9.6, -0.4, 1.3, 0.3),
      boulder(-2.8, -0.2, 1.0, 2.1),
      boulder(9.6, 0.6, 1.2, 1.2),
      boulder(1.2, -3.6, 0.9, 0.7),
      // grove undergrowth
      fern(-4.2, 2.6, 1.1, 0.5),
      fern(3.6, 2.4, 1.0, 1.6),
      fern(-10.8, 1.6, 1.2, 2.2),
      fern(11.4, -3.6, 1.0, 0.2),
      fern(-6.5, -6.4, 1.1, 1.0),
      fern(10.2, 3.8, 1.0, 2.8),
      bush(-3.6, 5.4, 0.9, 0.4),
      bush(4.8, 5.8, 0.9, 1.9),
      fernDecor(-1.6, 6.6, 0.55),
      fernDecor(2.1, 6.9, 0.5, 1.1),
      shell(1.6, 10.2),
      shell(-2.4, 10.4, 1.4),
   ],
   paints: [
      { kind: "path", points: [[0, 9.6], [-1.5, 6.0], [-4.5, 2.0], [-6, -0.8]], half: 0.75 },
      { kind: "path", points: [[-6, -4.4], [-3.5, -6.0], [2, -5.8], [5.5, -4.6], [6, -2.8]], half: 0.7 },
      { kind: "path", points: [[0.3, 6.5], [4, 3.6], [6, 1.0]], half: 0.65 },
      { kind: "moss", points: [[-11.5, -2.6], [-9.5, -1.0]], half: 1.5 },
   ],
   palms: { min: 15, max: 19, minRho: 0.12, maxRho: 0.86, apart: 2.0 },
};

// ---------- level 3: Rocky Cove (golden hour) ----------

/** The ravine splits the east headland off; the rope bridge at z -2 is the only way across. */
const RAVINE: ReadonlyArray<readonly [number, number]> = [
   [4.6, -13.5], [4.1, -7.5], [4.8, -2.0], [4.3, 3.5], [4.9, 8.0], [5.8, 13.5],
];

/**
 * Rocks along both rims of a carve (the ravine reads as a cleft, not a river), one every `step` m
 * on alternating sides, `off` m beyond its half-width, none within `clear` m of a bridge's axis.
 */
function rims(points: ReadonlyArray<readonly [number, number]>, half: number, step: number, clear: { x: number; z: number; r: number }, maxAbsZ: number): MapProp[] {
   const out: MapProp[] = [];
   let k = 0;
   for (let i = 1; i < points.length; i++) {
      const [x0, z0] = points[i - 1];
      const [x1, z1] = points[i];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const nx = -(z1 - z0) / len;
      const nz = (x1 - x0) / len;
      for (let t = i === 1 ? 0 : step; t < len; t += step) {
         k += 1;
         const side = k % 2 ? 1 : -1;
         const x = x0 + ((x1 - x0) * t) / len + nx * side * (half + 0.15);
         const z = z0 + ((z1 - z0) * t) / len + nz * side * (half + 0.15);
         if (Math.abs(z) > maxAbsZ || Math.hypot(x - clear.x, z - clear.z) < clear.r) continue;
         const s = 1.0 + ((k * 7) % 5) * 0.12;
         out.push(boulder(x, z, s, k * 1.3));
      }
   }
   return out;
}

export const MAP_3: IslandMap = {
   id: 3,
   theme: "cove",
   carves: [
      { kind: "ravine", points: RAVINE, half: 1.25, depth: 3.2 },
      { kind: "pool", points: [[-6.8, 2.6]], half: 1.2, depth: 0.55 },
      { kind: "pool", points: [[-3.4, 5.0]], half: 0.9, depth: 0.5 },
      { kind: "pool", points: [[9.0, 3.6]], half: 1.2, depth: 0.55 },
      { kind: "pool", points: [[10.2, -3.4]], half: 1.0, depth: 0.5 },
      { kind: "pool", points: [[-2.2, -4.2]], half: 1.05, depth: 0.55 },
   ],
   bridges: [{ kind: "rope", x: 4.8, z: -2.0, axis: "x", length: 4.6, half: 0.85, deck: 0.18, sag: 0.32 }],
   gates: [],
   props: [
      ...rims(RAVINE, 1.25, 1.6, { x: 4.8, z: -2.0, r: 3.0 }, 9.6),
      // the north cliffs, the sea cave arch on the west shore
      cliff(-8.2, -7.9, 4.2, 0.3),
      cliff(-3.6, -9.6, 4.0, 1.4),
      cliff(1.0, -10.4, 3.6, 2.6),
      cliff(9.0, -7.4, 3.8, 0.9),
      cliff(12.4, -3.6, 3.0, 2.0),
      {
         kind: "arch", x: -10.4, z: -2.2, yaw: 0.15, w: 4.6, h: 3.3, d: 3.0,
         legs: [{ x: -12.3, z: -2.4, r: 0.75 }, { x: -8.5, z: -1.95, r: 0.75 }],
      },
      // rock flats and boulders
      rock(-5.0, -1.0, 1.6, 0.4),
      rock(-0.4, 2.4, 1.3, 1.8),
      rock(2.2, -6.2, 1.8, 2.7),
      rock(-7.8, 6.0, 1.4, 0.9),
      rock(7.6, 7.0, 1.5, 2.2),
      rock(11.6, 1.4, 1.3, 0.2),
      rock(7.2, -4.8, 1.2, 1.1),
      boulder(-11.0, 3.6, 1.6, 1.4),
      boulder(-4.2, -6.6, 1.3, 0.6),
      boulder(2.4, 6.2, 1.1, 2.5),
      boulder(8.2, -1.0, 1.0, 0.4),
      // a beached anchor and shells
      decor("anchor", -5.8, 8.6, 1.0, 1.5, 0.28, 0.9),
      shell(-1.6, 10.3),
      shell(2.3, 10.0, 1.2),
      shell(-9.4, 6.9, 0.4),
   ],
   paints: [
      { kind: "rock", points: [[-9, -5.5], [-5, -6.8], [0, -7.6], [4, -8]], half: 1.8 },
      { kind: "rock", points: [[8, -5.5], [11.5, -2]], half: 1.6 },
      { kind: "rock", points: [[-7.5, 1.2], [-5.5, 3.6], [-3.4, 5.0]], half: 1.3 },
      { kind: "rock", points: [[8.2, 2.6], [10.2, 4.4]], half: 1.3 },
      { kind: "path", points: [[0, 9.6], [1.4, 5.0], [2.6, 0.5], [2.6, -2.0]], half: 0.7 },
      { kind: "path", points: [[7.1, -2.0], [9, 0.5], [9.5, 2]], half: 0.6 },
   ],
   palms: { min: 4, max: 7, minRho: 0.2, maxRho: 0.82, apart: 3.0 },
   chain: ["clue", "map", "coins", "map", "gem", "chest"],
};

// ---------- level 4: Jungle Interior (jungle shade) ----------

/** The jungle wall across the island (south room / north), open at x -6, a vine curtain at x 6. */
const WALL_SOUTH: ReadonlyArray<readonly [number, number]> = [
   [-16, 1.4], [-10, 0.8], [-5, 1.5], [0, 1.0], [5, 1.6], [10, 1.0], [16, 1.6],
];
/** The wall between the north-west ruins and the north-east grove, from the south wall to the north shore. */
const WALL_MIDDLE: ReadonlyArray<readonly [number, number]> = [[2.8, 0.0], [2.4, -4], [3.0, -8], [2.6, -13]];

export const MAP_4: IslandMap = {
   id: 4,
   theme: "jungle",
   carves: [{ kind: "pool", points: [[9.4, -4.4]], half: 1.0, depth: 0.5 }],
   bridges: [],
   gates: [
      { kind: "vines", x: 6.0, z: 1.5, hx: 1.6, hz: 0.55, opensAfter: 1, label: "Vines block the east path" },
      { kind: "vines", x: -6.4, z: -4.6, hx: 1.2, hz: 0.45, opensAfter: 3, label: "Vines seal the temple gate" },
   ],
   props: [
      ...hedge(WALL_SOUTH, 1.2, [[-7.3, -4.7], [4.3, 7.7]], "x", 3),
      ...hedge(WALL_MIDDLE, 1.2, [], "z", 11),
      // the temple courtyard (north-west): a crumbled low wall on the south with the gate at x -6.4,
      // high walls on the other sides; inside x -10.4..-1.6, z -9.6..-4.6
      block(-9.1, -4.6, 2.6, 0.9, 0.8),
      block(-3.6, -4.6, 3.6, 0.9, 0.8),
      block(-10.9, -7.1, 1.0, 5.0),
      block(-1.1, -7.1, 1.0, 5.0),
      block(-6.0, -9.9, 10.8, 1.0),
      {
         kind: "ruinGate", x: -6.4, z: -4.6, yaw: 0, w: 3.0, h: 2.3, d: 0.8,
         legs: [{ x: -7.75, z: -4.6, r: 0.36 }, { x: -5.05, z: -4.6, r: 0.36 }],
      },
      pillar(-10.9, -4.6, 2.2),
      pillar(-1.1, -4.6, 2.2),
      // the middle ruins between the wall and the temple
      column(-9.6, -1.8, 1.6, 0.4),
      decor("column", -1.6, -1.4, 0.6, 0.7, 0.6, 1.2),
      circleProp("totem", -12.2, -2.4, 0.75, 2.0, 0.75, 0.4, 0.5),
      // the north-east grove: a totem, rocks, ferns
      circleProp("totem", 7.4, -7.6, 0.8, 2.2, 0.8, 0.42, -0.3),
      boulder(11.2, -1.4, 1.4, 0.8),
      boulder(5.0, -3.4, 1.1, 2.0),
      fern(8.4, -0.6, 1.0, 0.4),
      // the south room: thick undergrowth round the clearing
      fern(-9.4, 4.4, 1.2, 0.3),
      fern(9.2, 4.6, 1.2, 1.9),
      plant(-4.8, 5.8, 1.0, 0.8),
      plant(5.0, 6.2, 1.0, 2.4),
      bush(-12.0, 3.4, 1.0),
      bush(11.8, 3.2, 1.0, 1.1),
      boulder(-2.6, 3.4, 1.0, 1.0),
      fernDecor(-1.4, 7.0, 0.55),
      fernDecor(1.9, 7.3, 0.5, 2.0),
   ],
   paints: [
      { kind: "mud", points: [[0, 9.6], [-1.5, 6.2], [-6, 3.2], [-6, 1.0], [-6.4, -1.5], [-6.4, -4.0]], half: 0.8 },
      { kind: "mud", points: [[0.5, 6.4], [4.5, 3.6], [6, 2.0], [6.4, -1], [8, -3.5]], half: 0.75 },
      { kind: "rock", points: [[-9.8, -6.0], [-2.2, -6.0], [-2.2, -8.6], [-9.8, -8.6], [-9.8, -6.0]], half: 1.0 },
      { kind: "moss", points: [[-11, -1], [-8, 0]], half: 1.6 },
   ],
   palms: { min: 4, max: 6, minRho: 0.3, maxRho: 0.84, apart: 2.6 },
   chain: ["clue", "map", "clue", "map", "map", "chest"],
};

// ---------- level 5: Pirate Peak (storm at sunset) ----------

/** The summit: the hill's top, ringed by rocks, the rockfall on the south-west path opens with the map. */
const PEAK = { x: 2.0, z: -3.6 } as const;
const RING_R = 2.7;
/** The ring stones (angles in rad from +x, measured the rules' way: z south). The gap is at 2.36 (south-west). */
const RING = [0.0, 0.55, 1.1, 1.75, 2.95, 3.55, 4.15, 4.7, 5.25, 5.75];
const ringStones = RING.map((a, i) => boulder(PEAK.x + Math.cos(a) * RING_R, PEAK.z + Math.sin(a) * RING_R, 1.55 + (i % 3) * 0.12, a + 1.2));

export const MAP_5: IslandMap = {
   id: 5,
   theme: "peak",
   hill: { x: PEAK.x, z: PEAK.z, h: 3.4, r: 7.0 },
   carves: [{ kind: "pool", points: [[-10.4, -3.6]], half: 1.0, depth: 0.5 }],
   bridges: [],
   gates: [
      {
         kind: "rockfall",
         x: PEAK.x + Math.cos(2.36) * RING_R,
         z: PEAK.z + Math.sin(2.36) * RING_R,
         hx: 0.85,
         hz: 0.85,
         opensAfter: 5,
         label: "A rockfall blocks the summit path",
      },
   ],
   props: [
      ...ringStones,
      // the pirate flag on the summit ring
      decor("flag", PEAK.x + Math.cos(4.4) * (RING_R + 0.2), PEAK.z + Math.sin(4.4) * (RING_R + 0.2), 0.7, 2.0, 0.5, 0.2),
      // the wrecked ship beached on the west shore, its camp
      boxProp("wreck", -12.6, 3.0, 2.9, 4.2, 6.6, 1.45, 3.1, 0.12),
      barrel(-10.0, 5.8),
      barrel(-9.4, 6.5, 1.0),
      barrel(-10.6, 6.8, 2.0),
      crate(-8.8, 5.2, 0.4),
      crate(-11.4, -0.6, 1.2),
      decor("anchor", -8.6, 8.0, 1.0, 1.5, 0.28, 1.2),
      // the cannons on the slopes, facing the sea
      cannon(-3.6, -4.6, -Math.PI / 2 - 0.2),
      cannon(7.8, -2.6, Math.PI / 2 + 0.3),
      cannon(-1.0, -8.6, Math.PI + 0.3),
      cannon(6.4, -8.0, Math.PI - 0.4),
      // rocks round the island
      rock(-6.0, 2.0, 1.5, 0.5),
      rock(10.8, 2.6, 1.6, 1.9),
      rock(13.0, -2.6, 1.3, 0.3),
      rock(-14.0, -1.6, 1.2, 2.6),
      boulder(5.8, 5.0, 1.2, 0.9),
      boulder(-4.0, 5.6, 1.0, 1.7),
      fern(9.6, -5.6, 1.0, 0.6),
      fern(-7.6, -6.2, 1.0, 2.2),
      shell(1.8, 10.2),
      shell(-2.0, 10.4, 2.1),
   ],
   paints: [
      { kind: "path", points: [[0, 9.6], [-1.6, 5.6], [-2.4, 1.6], [-1.0, -0.8], [PEAK.x + Math.cos(2.36) * 3.6, PEAK.z + Math.sin(2.36) * 3.6]], half: 0.8 },
      { kind: "ash", points: [[PEAK.x, PEAK.z]], half: 4.4 },
      { kind: "rock", points: [[PEAK.x, PEAK.z]], half: 2.0 },
      { kind: "sand", points: [[-12.6, 3.0], [-10, 6]], half: 2.4 },
   ],
   palms: { min: 5, max: 8, minRho: 0.35, maxRho: 0.86, apart: 2.8 },
   chain: ["clue", "map", "clue", "map", "map", "chest"],
   chestAt: { x: PEAK.x, z: PEAK.z },
};

export const MAPS = { 2: MAP_2, 3: MAP_3, 4: MAP_4, 5: MAP_5 } as const;
