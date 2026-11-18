// Color Bridge Builder: a canyon of rock isles seen from above, one char = one 2 m cell, row 0 the far
// (north) side. Energy nodes shoot colour beams; a beam that ends on a bridge anchor turns every chasm
// cell it crosses into a light bridge of its colour; where beams cross, the light after the crossing
// carries both colours (red + blue = purple, blue + yellow = green, red + yellow = orange (flickers),
// all three = white). Only the hero of a bridge's colour can walk it. Pure data plus a parser.
//
//   #  rock         .  chasm        S  start        E  exit gate (L5: opens when the Keeper falls)
//   A  anchor (a beam ends here; walkable)          N  energy node (walkable pad; its beam: `nodes`)
//   1 2 3  colour switches for node 0, 1, 2 (stepping on one cycles its node: off, red, blue, yellow)
//   /  \  prisms (turn a beam 90°; bump one to rotate it; Zuno's magnet slides one)
//   x  cracked rock (blocks; Riko's dash breaks it)     o  orb over the chasm (on a bridge)   O  orb on rock
//   k  a secret over the chasm   K  a secret on rock     P  the Keeper's plate (L5: a beam target)
import type { LevelId } from "../../types";

export const CELL = 2;
export const T = { CHASM: 0, ROCK: 1, ANCHOR: 2, NODE: 3, SWITCH: 4, PRISM: 5, CRACKED: 6, EXIT: 7, PLATE: 8 } as const;
export type Dir = 0 | 1 | 2 | 3; // N E S W
export const DR = [-1, 0, 1, 0] as const;
export const DC = [0, 1, 0, -1] as const;

/** colour masks: red 1, blue 2, yellow 4 */
export const RED = 1;
export const BLUE = 2;
export const YELLOW = 4;

export interface NodeDef {
   dir: Dir;
   /** the starting colour mask (0 = off) */
   color: number;
   /** what its switch cycles through (none: a fixed node) */
   cycle?: number[];
   /** L4: after its switch is pressed the node shines this long, then goes dark */
   timedMs?: number;
}

export interface DroneDef {
   /** cells it patrols, back and forth, at `speed` cells/s; it swallows any beam through its cell */
   path: [number, number][];
   speed: number;
}

export interface BridgeLevel {
   id: LevelId;
   name: string;
   durationMs: number;
   targetMs: number;
   map: readonly string[];
   nodes: readonly NodeDef[];
   drones: readonly DroneDef[];
   /** SECRETS index of the `k` cell, if any */
   secret: number;
   boss: boolean;
}

const L1: BridgeLevel = {
   id: 1,
   name: "Two Switches",
   durationMs: 150_000,
   targetMs: 75_000,
   // beat 1 (bottom): a red bridge, walk it as Riko; beat 2: switch the dark node to blue, walk it as Nami;
   // beat 3: switch the red node on: it crosses the blue beam, red turns purple mid-bridge: tag Vexa
   map: [
      "#####E######",
      "###A########",
      "...o........",
      "A..........N",
      "............",
      "###N########",
      "#2###A###O##",
      "............",
      "............",
      ".....o......",
      "#####N#3####",
      "##A#########",
      "............",
      "..o.........",
      "............",
      "##N#####O###",
      "##S#########",
   ],
   nodes: [
      { dir: 3, color: BLUE },
      { dir: 0, color: 0, cycle: [0, RED] },
      { dir: 0, color: 0, cycle: [0, BLUE, RED] },
      { dir: 0, color: RED },
   ],
   drones: [],
   secret: -1,
   boss: false,
};

const L2: BridgeLevel = {
   id: 2,
   name: "Prisms",
   durationMs: 180_000,
   targetMs: 100_000,
   // bump the prism to aim the yellow beam (Zuno); a blue beam crosses yellow into green (Nami, then Kiro);
   // the green ledge holds the sticker; a dark node you colour yourself for the last crossing
   map: [
      "######E#####",
      "###A########",
      "............",
      "...o........",
      "............",
      "###N########",
      "#1######A##O",
      "............",
      "N.........kA",
      "........o...",
      "############",
      "###3#A##N###",
      "............",
      ".....o......",
      "............",
      "############",
      "N####\\##S#O#",
   ],
   nodes: [
      { dir: 0, color: 0, cycle: [0, RED, BLUE, YELLOW] },
      { dir: 1, color: YELLOW },
      { dir: 0, color: 0, cycle: [0, BLUE] },
      { dir: 1, color: YELLOW },
   ],
   drones: [],
   secret: 1,
   boss: false,
};

const L3: BridgeLevel = {
   id: 3,
   name: "Split Bridge",
   durationMs: 200_000,
   targetMs: 120_000,
   // red crosses yellow into a flickering orange bridge; two half-bridges side by side (red or blue);
   // at the top, yellow makes orange, blue makes purple: pick; Vexa's phase crosses a flicker gap to the shard
   map: [
      "#####E######",
      "####A#######",
      "............",
      "N.......k..A",
      "............",
      "####N#######",
      "##2##AA##O##",
      "......o.....",
      "............",
      "............",
      "#####NN#####",
      "####A#######",
      "............",
      "N..........A",
      "....o.......",
      "####N###O###",
      "####S#######",
   ],
   nodes: [
      { dir: 1, color: RED },
      { dir: 0, color: YELLOW, cycle: [YELLOW, BLUE] },
      { dir: 0, color: RED },
      { dir: 0, color: BLUE },
      { dir: 1, color: YELLOW },
      { dir: 0, color: RED },
   ],
   drones: [],
   secret: 0,
   boss: false,
};

const L4: BridgeLevel = {
   id: 4,
   name: "Timed Bridge",
   durationMs: 220_000,
   targetMs: 140_000,
   // drones swallow the beams they fly through (the bridge behind them goes dark); a timed node shines
   // 10 s after its far switch; a cracked rock hides the shard (Riko's dash)
   map: [
      "######E#####",
      "######A#####",
      "............",
      "............",
      "......o.....",
      "######N#####",
      "###A####O#xK",
      "............",
      "...o........",
      "............",
      "###N########",
      "##A#######2#",
      "............",
      "............",
      "............",
      "##N#####O###",
      "##S#########",
   ],
   nodes: [
      { dir: 0, color: BLUE },
      { dir: 0, color: 0, cycle: [0, RED], timedMs: 10_000 },
      { dir: 0, color: RED },
   ],
   drones: [
      { path: [[3, 1], [3, 10]], speed: 2.2 },
      { path: [[13, 0], [13, 6]], speed: 2 },
   ],
   secret: 2,
   boss: false,
};

const L5: BridgeLevel = {
   id: 5,
   name: "Canyon Gate",
   durationMs: 300_000,
   targetMs: 150_000,
   // the approach (red into purple), then the Bridge Keeper's arena: its plate takes the beam of the
   // middle node, which crosses the blue and the yellow beams on the way: set the three switches to
   // make the colour the plate shows; dodge its stomps; white opens the gate
   map: [
      "##########E#",
      "######P#####",
      "############",
      "############",
      "N##########A",
      "############",
      "A##########N",
      "############",
      "######N#####",
      "##1###3###2#",
      "#####O######",
      "##A#########",
      "............",
      "N..........A",
      "..o.........",
      "##N#########",
      "##S#########",
   ],
   nodes: [
      { dir: 1, color: 0, cycle: [0, BLUE] },
      { dir: 3, color: 0, cycle: [0, YELLOW] },
      { dir: 0, color: RED, cycle: [0, RED, BLUE, YELLOW] },
      { dir: 1, color: BLUE },
      { dir: 0, color: RED },
   ],
   drones: [],
   secret: -1,
   boss: true,
};

export const LEVELS: Record<LevelId, BridgeLevel> = { 1: L1, 2: L2, 3: L3, 4: L4, 5: L5 };

export interface ParsedLevel {
   w: number;
   h: number;
   tiles: Uint8Array;
   start: [number, number];
   exit: [number, number];
   /** node cells in reading order (index = node id) */
   nodes: [number, number][];
   /** switch cells: [row, col, node] */
   switches: [number, number, number][];
   /** prisms: [row, col, 0 = "/", 1 = "\"] */
   prisms: [number, number, number][];
   orbs: [number, number][];
   secret: [number, number] | null;
   plate: [number, number] | null;
}

const cache = new Map<BridgeLevel, ParsedLevel>();

export function parseLevel(def: BridgeLevel): ParsedLevel {
   const hit = cache.get(def);
   if (hit) return hit;
   const h = def.map.length;
   const w = def.map[0].length;
   const p: ParsedLevel = { w, h, tiles: new Uint8Array(w * h), start: [0, 0], exit: [0, 0], nodes: [], switches: [], prisms: [], orbs: [], secret: null, plate: null };
   def.map.forEach((line, r) => {
      if (line.length !== w) throw new Error(`L${def.id} row ${r}: ${line.length} cells, want ${w}`);
      for (let c = 0; c < w; c++) {
         const ch = line[c];
         let t: number = T.ROCK;
         switch (ch) {
            case ".": t = T.CHASM; break;
            case "#": break;
            case "S": p.start = [r, c]; break;
            case "E": p.exit = [r, c]; t = T.EXIT; break;
            case "A": t = T.ANCHOR; break;
            case "N": p.nodes.push([r, c]); t = T.NODE; break;
            case "1": case "2": case "3": p.switches.push([r, c, Number(ch) - 1]); t = T.SWITCH; break;
            case "/": p.prisms.push([r, c, 0]); t = T.PRISM; break;
            case "\\": p.prisms.push([r, c, 1]); t = T.PRISM; break;
            case "x": t = T.CRACKED; break;
            case "o": p.orbs.push([r, c]); t = T.CHASM; break;
            case "O": p.orbs.push([r, c]); break;
            case "k": p.secret = [r, c]; t = T.CHASM; break;
            case "K": p.secret = [r, c]; break;
            case "P": p.plate = [r, c]; t = T.PLATE; break;
            default: throw new Error(`L${def.id} row ${r}: unknown cell "${ch}"`);
         }
         p.tiles[r * w + c] = t;
      }
   });
   if (p.nodes.length !== def.nodes.length) throw new Error(`L${def.id}: ${p.nodes.length} N cells, ${def.nodes.length} node defs`);
   cache.set(def, p);
   return p;
}
