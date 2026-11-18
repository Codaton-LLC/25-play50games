// Robot Factory Run's floors: a 2 m tile grid per level, written as ASCII maps plus the wiring
// (which switch plate turns which turntable, toggles which laser or reverses which belt), the
// presses, the klaxon belts, the robot arms, the tread bots, the orbs and the secrets.
// Pure data and a parser; no Math.random: a level is the same shift for every seed.
//
// Map legend (one character per 2 m tile):
//   #  machinery (solid)            .  floor               > < ^ v  conveyor belt
//   T  turntable (turns 90 deg)     D  cell dispenser     C  exit charger   Q  secret charger
//   E  exit door                    S  switch plate       L  laser gate     b  step box (1.1 m)
//   K  catwalk (2.2 m)              c  cracked crate      g  ghost crate    M  boss (L5)
//   A  robot-arm pad (cells wait on it; the arm lifts them, or you, to its drop tile)
// Tile (c, r) is the world square centred on x = (c - 5) * 2, z = (r - 5) * 2: row 0 is the far
// wall (-z), the camera starts behind the last rows (+z). Directions: 0 N (-z), 1 E, 2 S, 3 W;
// a turntable turns clockwise (N -> E -> S -> W).
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";

export const TILE = 2;
export const W = 11;
export const H = 10;

export type Dir = 0 | 1 | 2 | 3;
export const DC = [0, 1, 0, -1] as const;
export const DR = [-1, 0, 1, 0] as const;

export const enum K {
   Wall = 0,
   Floor = 1,
   Belt = 2,
   Turn = 3,
   Disp = 4,
   Charger = 5,
   Secret = 6,
   Exit = 7,
   Plate = 8,
   Laser = 9,
   Box = 10,
   Catwalk = 11,
   Cracked = 12,
   Ghost = 13,
   Boss = 14,
   Pad = 15,
}

export interface PlateSpec {
   /** turntables it turns one step each time it is stepped on */
   turns: number[];
   /** lasers it toggles */
   lasers?: number[];
   /** level 5: it reverses the boss lane */
   bossLane?: boolean;
}

export interface ArmSpec {
   pad: [number, number];
   drop: [number, number];
   /** the drop's height (a catwalk drop puts the hero up there) */
   periodMs: number;
   phaseMs: number;
}

export interface BotSpec {
   /** a tread bot rolling between two tile centres */
   a: [number, number];
   b: [number, number];
   periodMs: number;
}

export interface OrbSpec {
   x: number;
   y: number;
   z: number;
   hero: HeroId | null;
}

export interface BossSpec {
   /** where M-8 stands (its chest socket is the charger in front of it) */
   at: [number, number];
   /** P2: the lane it walks (a row of belts from the press at its west end) */
   lane: [number, number][];
   /** P3: the vent spots on its back (reached from the catwalk) */
   vents: [number, number, number][];
}

export interface ShowSpec {
   map: string[];
   dispenserDir: Dir;
   turns: Dir[];
   plates: PlateSpec[];
   lasersOn: boolean[];
   presses: [number, number, number][];
   klaxon: [number, number][];
   arms: ArmSpec[];
   bots: BotSpec[];
   cells: number;
   cadenceMs: number;
   firstMs: number;
   maxLive: number;
   start: [number, number];
   orbs: OrbSpec[];
   secrets: [number, number, number][];
   /** the honest bot's wiring: the direction each turntable should point */
   route: Dir[];
   /** the honest bot's plate order (default: each table's plate, as often as its turns need) */
   botPlates?: number[];
   boss: BossSpec | null;
}

export interface Tile {
   k: K;
   /** belts and dispensers: the direction they carry */
   dir: Dir;
   /** turntables, plates, lasers: their index among their kind */
   idx: number;
   /** the floor top under a hero (0, a box 1.1, a catwalk 2.2) or solid */
   top: number;
   solid: boolean;
}

export interface Floor {
   level: LevelId;
   spec: ShowSpec;
   tiles: Tile[];
   turnAt: [number, number][];
   plateAt: [number, number][];
   laserAt: [number, number][];
   dispenser: [number, number];
   charger: [number, number];
   secretCharger: [number, number] | null;
   exit: [number, number];
   klaxonMask: Uint8Array;
   pressMask: Int16Array;
}

export const tileX = (c: number): number => (c - 5) * TILE;
export const tileZ = (r: number): number => (r - 5) * TILE;
export const colOf = (x: number): number => Math.round(x / TILE + 5);
export const rowOf = (z: number): number => Math.round(z / TILE + 5);
export const at = (c: number, r: number): number => r * W + c;
export const inside = (c: number, r: number): boolean => c >= 0 && c < W && r >= 0 && r < H;

const BELTS: Record<string, Dir> = { "^": 0, ">": 1, v: 2, "<": 3 };

export function parseFloor(level: LevelId, spec: ShowSpec): Floor {
   if (spec.map.length !== H || spec.map.some((row) => row.length !== W)) throw new Error(`robot-factory-run L${level}: map must be ${W}x${H}`);
   const tiles: Tile[] = [];
   const turnAt: [number, number][] = [];
   const plateAt: [number, number][] = [];
   const laserAt: [number, number][] = [];
   let dispenser: [number, number] = [0, 0];
   let charger: [number, number] = [0, 0];
   let exit: [number, number] = [0, 0];
   let secretCharger: [number, number] | null = null;
   for (let r = 0; r < H; r++) {
      for (let c = 0; c < W; c++) {
         const ch = spec.map[r][c];
         const t: Tile = { k: K.Floor, dir: 0, idx: -1, top: 0, solid: false };
         if (ch in BELTS) {
            t.k = K.Belt;
            t.dir = BELTS[ch];
         } else if (ch === "#") {
            t.k = K.Wall;
            t.top = 1.6;
            t.solid = true;
         } else if (ch === "T") {
            t.k = K.Turn;
            t.idx = turnAt.length;
            turnAt.push([c, r]);
         } else if (ch === "D") {
            t.k = K.Disp;
            t.dir = spec.dispenserDir;
            dispenser = [c, r];
         } else if (ch === "C") {
            t.k = K.Charger;
            t.top = 1.4;
            t.solid = true;
            charger = [c, r];
         } else if (ch === "Q") {
            t.k = K.Secret;
            t.top = 1.2;
            t.solid = true;
            secretCharger = [c, r];
         } else if (ch === "E") {
            t.k = K.Exit;
            exit = [c, r];
         } else if (ch === "S") {
            t.k = K.Plate;
            t.idx = plateAt.length;
            plateAt.push([c, r]);
         } else if (ch === "L") {
            t.k = K.Laser;
            t.idx = laserAt.length;
            laserAt.push([c, r]);
         } else if (ch === "b") {
            t.k = K.Box;
            t.top = 1.1;
         } else if (ch === "K") {
            t.k = K.Catwalk;
            t.top = 2.2;
         } else if (ch === "c") {
            t.k = K.Cracked;
            t.top = 1.2;
            t.solid = true;
         } else if (ch === "g") {
            t.k = K.Ghost;
            t.top = 1.2;
            t.solid = true;
         } else if (ch === "A") {
            t.k = K.Pad;
         } else if (ch === "M") {
            t.k = K.Boss;
            t.top = 4;
            t.solid = true;
         } else if (ch !== ".") throw new Error(`robot-factory-run L${level}: unknown tile '${ch}'`);
         tiles.push(t);
      }
   }
   if (turnAt.length !== spec.turns.length || turnAt.length !== spec.route.length) throw new Error(`robot-factory-run L${level}: ${turnAt.length} turntables, ${spec.turns.length} dirs, ${spec.route.length} route`);
   if (plateAt.length !== spec.plates.length) throw new Error(`robot-factory-run L${level}: ${plateAt.length} plates, ${spec.plates.length} specs`);
   if (laserAt.length !== spec.lasersOn.length) throw new Error(`robot-factory-run L${level}: ${laserAt.length} lasers, ${spec.lasersOn.length} states`);
   const klaxonMask = new Uint8Array(W * H);
   for (const [c, r] of spec.klaxon) klaxonMask[at(c, r)] = 1;
   const pressMask = new Int16Array(W * H).fill(-1);
   spec.presses.forEach(([c, r], i) => (pressMask[at(c, r)] = i));
   return { level, spec, tiles, turnAt, plateAt, laserAt, dispenser, charger, secretCharger, exit, klaxonMask, pressMask };
}

/** Does a cell ride this tile? */
export function carries(k: K): boolean {
   return k === K.Belt || k === K.Turn || k === K.Disp;
}

// ---------- the shifts ----------

const o = (c: number, r: number, y = 0.6, hero: HeroId | null = null): OrbSpec => ({ x: tileX(c), y, z: tileZ(r), hero });

const L1: ShowSpec = {
   map: [
      "###########",
      "#.c..KK.E.#",
      "##.....#..#",
      "#g.....#C.#",
      "#.##...L^.#",
      "##.....L^.#",
      "#D>>T>>>TQ#",
      "#..S...S..#",
      "#.>>>>>>..#",
      "###########",
   ],
   dispenserDir: 1,
   // T0 points at the floor (the first cell is lost: the lesson), T1 bounces cells back until turned
   turns: [0, 3],
   plates: [{ turns: [0] }, { turns: [1] }],
   lasersOn: [true, true],
   presses: [[6, 6, 0]],
   klaxon: [],
   arms: [],
   bots: [],
   cells: 2,
   cadenceMs: 3200,
   firstMs: 1500,
   maxLive: 2,
   start: [1, 8],
   orbs: [o(3, 8), o(5, 8), o(5, 7), o(4, 4), o(6, 2), o(7, 1), o(9, 4), o(9, 2), o(1, 1, 0.6, "riko"), o(5, 1, 2.8, "nami"), o(6, 1, 2.8, "nami"), o(7, 4, 0.6, "kiro"), o(7, 5, 0.6, "kiro"), o(7, 2, 0.7, "zuno"), o(1, 4, 0.6, "vexa")],
   secrets: [
      [tileX(9), 1.6, tileZ(6)],
      [tileX(1), 0.8, tileZ(4)],
   ],
   route: [1, 0],
   boss: null,
};

const L2: ShowSpec = {
   map: [
      "###########",
      "#E...#g#..#",
      "#...C<<<TS#",
      "#...^LL.^.#",
      "#.S.T<<<T.#",
      "#.....#.^.#",
      "#c.....S^.#",
      "#.D>>>>>T.#",
      "#KK...S...#",
      "###########",
   ],
   dispenserDir: 1,
   // T0 (8,2) S, T1 (4,4) W, T2 (8,4) S, T3 (8,7) W: cells bounce or fall until they are turned
   turns: [2, 3, 2, 3],
   plates: [{ turns: [0] }, { turns: [1] }, { turns: [2] }, { turns: [3] }],
   lasersOn: [true, true],
   presses: [],
   // the klaxon line: these three belts run backwards every other 6 s (the short way, if timed)
   klaxon: [
      [5, 4],
      [6, 4],
      [7, 4],
   ],
   arms: [],
   bots: [{ a: [1, 5], b: [5, 5], periodMs: 4800 }],
   cells: 3,
   cadenceMs: 3200,
   firstMs: 1500,
   maxLive: 2,
   start: [9, 8],
   orbs: [o(7, 8), o(4, 8), o(3, 6), o(2, 3), o(5, 5), o(2, 1), o(9, 3), o(9, 5), o(5, 3, 0.6, "kiro"), o(6, 3, 0.6, "kiro"), o(1, 8, 2.8, "nami"), o(2, 8, 2.8, "nami"), o(6, 5, 0.7, "zuno"), o(6, 1, 0.6, "vexa"), o(1, 6, 0.6, "riko")],
   secrets: [
      [tileX(9), 0.8, tileZ(1)],
      [tileX(6), 0.8, tileZ(1)],
   ],
   // the long dry way round (T2 north, T0 west); the klaxon line is the timed short cut
   route: [3, 3, 0, 0],
   boss: null,
};

const L3: ShowSpec = {
   map: [
      "###########",
      "#..KKK.E..#",
      "#.C<<<<<T.#",
      "#...^...^.#",
      "#A..#.L.^.#",
      "#...A.L.^S#",
      "#..g^...^.#",
      "#.D>T>>>^.#",
      "#..b.S..c.#",
      "###########",
   ],
   dispenserDir: 1,
   // T0 (8,2) bounces cells back down until turned west; T1 (4,7) bounces them back west until
   // turned north onto the arm line (or east, the long dry way round)
   turns: [2, 3],
   plates: [{ turns: [0] }, { turns: [1] }],
   lasersOn: [true, true],
   presses: [[8, 5, 800]],
   klaxon: [],
   // the line arm lifts a waiting cell over the wall, two belts on; the roof arm lifts you onto the catwalk
   arms: [
      { pad: [4, 5], drop: [4, 3], periodMs: 4000, phaseMs: 0 },
      { pad: [1, 4], drop: [3, 1], periodMs: 5000, phaseMs: 2500 },
   ],
   bots: [{ a: [5, 8], b: [7, 8], periodMs: 5200 }],
   cells: 3,
   cadenceMs: 3200,
   firstMs: 1500,
   maxLive: 2,
   start: [1, 8],
   orbs: [o(2, 8), o(3, 5), o(2, 3), o(1, 2), o(6, 1), o(9, 3), o(7, 6), o(6, 3), o(6, 4, 0.6, "kiro"), o(6, 5, 0.6, "kiro"), o(4, 1, 2.8, "nami"), o(5, 1, 2.8, "nami"), o(4, 4, 0.7, "zuno"), o(3, 6, 0.6, "vexa"), o(8, 8, 0.6, "riko")],
   secrets: [
      [tileX(5), 3.0, tileZ(1)],
      [tileX(3), 0.8, tileZ(6)],
   ],
   route: [3, 0],
   boss: null,
};

const L4: ShowSpec = {
   map: [
      "###########",
      "#E..L.....#",
      "#...L.T>C.#",
      "#...L.^.#.#",
      "####..^.S.#",
      "#.T>>>T...#",
      "#.^.....L.#",
      "#.D.S.g.L.#",
      "#c...KK..S#",
      "###########",
   ],
   dispenserDir: 0,
   // T0 (6,2) W, T1 (2,5) N, T2 (6,5) W
   turns: [3, 0, 3],
   // the plates turn a table AND swap the exit lasers: two turns of T0 leave them as they were
   plates: [
      { turns: [0], lasers: [0, 1, 2] },
      { turns: [1, 2], lasers: [0, 1, 2] },
      { turns: [], lasers: [0, 1, 2] },
   ],
   lasersOn: [true, true, true, true, true],
   presses: [[6, 3, 400]],
   klaxon: [],
   arms: [],
   bots: [{ a: [7, 6], b: [7, 4], periodMs: 4400 }, { a: [3, 6], b: [5, 6], periodMs: 3600 }],
   cells: 3,
   cadenceMs: 3200,
   firstMs: 1500,
   maxLive: 2,
   start: [9, 6],
   orbs: [o(7, 7), o(5, 7), o(4, 4), o(5, 3), o(2, 2), o(3, 1), o(7, 4), o(9, 2), o(8, 6, 0.6, "kiro"), o(8, 7, 0.6, "kiro"), o(5, 8, 2.8, "nami"), o(6, 8, 2.8, "nami"), o(8, 3, 0.7, "zuno"), o(6, 7, 0.6, "vexa"), o(1, 8, 0.6, "riko")],
   secrets: [
      [tileX(9), 0.8, tileZ(1)],
      [tileX(6), 3.0, tileZ(8)],
   ],
   route: [1, 1, 0],
   botPlates: [0, 0, 1],
   boss: null,
};

const L5: ShowSpec = {
   map: [
      "###########",
      "#KKKKMKKKK#",
      "#b...C...b#",
      "#....^....#",
      "#.S..T>>>.#",
      "#....^....#",
      "#<<<<^...L#",
      "#..S.^..S.#",
      "#gD>>T...c#",
      "###########",
   ],
   dispenserDir: 1,
   turns: [3, 3],
   plates: [{ turns: [0] }, { turns: [], bossLane: true }, { turns: [1] }],
   lasersOn: [true],
   presses: [[1, 6, 0]],
   klaxon: [],
   arms: [],
   bots: [],
   cells: 3,
   // the overdrive line: a cell every 2.4 s, three on the belts at once
   cadenceMs: 2400,
   firstMs: 2500,
   maxLive: 3,
   start: [8, 8],
   orbs: [o(7, 8), o(4, 7), o(2, 5), o(8, 5), o(1, 3), o(9, 3), o(3, 2), o(7, 2), o(2, 1, 2.8), o(8, 1, 2.8), o(3, 1, 4.4, "nami"), o(7, 1, 4.4, "nami"), o(9, 6, 0.6, "kiro"), o(0, 5, 0.7, "zuno"), o(1, 8, 0.6, "vexa"), o(9, 8, 0.6, "riko")],
   secrets: [
      [tileX(9), 3.0, tileZ(1)],
      [tileX(1), 0.8, tileZ(8)],
   ],
   route: [0, 0],
   boss: {
      at: [5, 1],
      lane: [
         [1, 6],
         [2, 6],
         [3, 6],
         [4, 6],
      ],
      vents: [
         [tileX(4), 2.6, tileZ(1)],
         [tileX(6), 2.6, tileZ(1)],
      ],
   },
};

export const SHOWS: Record<LevelId, ShowSpec> = { 1: L1, 2: L2, 3: L3, 4: L4, 5: L5 };

const CACHE: Partial<Record<LevelId, Floor>> = {};

export function floorFor(level: LevelId): Floor {
   return (CACHE[level] ??= parseFloor(level, SHOWS[level]));
}
