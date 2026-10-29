// Zuno's Tinker Lab: five levels of small puzzle rooms, each an ASCII side view (row 0 at the top,
// one char = 1 m). A room is cleared when `need` coins are in its bank; then its door (the E cell on
// the right wall, and the cell above it) opens to the next room. Pure data plus a parser.
//
//   #  lab wall / floor        .  air           S  start          E  exit door (right wall)
//   B  the bank (piggy bank)   C  coin pile (6) Q  coin pile (10)  o  orb (3 per room)
//   +  magnet pad, + sign      -  magnet pad, - sign (a pad on a floor launches; any pad pulls / pushes)
//   G  polarity gate: only + passes      g  polarity gate: only - passes
//   M  metal block (slides along its row; pulled or pushed by the hero's sign; a bridge, a dam)
//   =  rail (holds a block over a gap; the hero and the coins fall through)
//   x  static-spark floor (scatters a swarm, stings; Kiro's shield crosses)
//   c  cracked lab glass (Riko's dash breaks it)   h  ghost wall (Vexa phases)
//   w  glass (solid; Zuno's overcharge pulls coins through it)
//   K  storage-room shard (secret 1)   k  prototype-magnet sticker (secret 2)   V  vault shard (secret 3)
//   v  vent (a block pushed into it opens every H)   H  hidden wall (gone once the vent is plugged)
//   d  lab drone (steals coins; repel it up close)   R  Scrap Magnus (L5's arena)
import type { LevelId } from "../../types";

export const T = { AIR: 0, WALL: 1, GATE_P: 2, GATE_N: 3, RAIL: 4, SPARK: 5, CRACKED: 6, GHOST: 7, GLASS: 8, HIDDEN: 9, DOOR: 10 } as const;

export interface RoomDef {
   map: readonly string[];
   /** coins to bank to open the door */
   need: number;
   /** a one-line hint shown on entering */
   hint: string;
}

export interface LabLevel {
   id: LevelId;
   name: string;
   durationMs: number;
   targetMs: number;
   rooms: readonly RoomDef[];
}

const R = (need: number, hint: string, ...map: string[]): RoomDef => ({ need, hint, map });

const L1: RoomDef[] = [
   R(5, "Walk past the coins: they follow you. Lead them into the piggy bank.",
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#......................#",
      "#.......o.....o......o..",
      "#S.......C...........B.E",
      "########################"),
   R(4, "Flip (Action) to the opposite sign: the pad pulls you over the gap.",
      "########################",
      "#......................#",
      "#......................#",
      "#..o...................#",
      "#..........o...........#",
      "#..........+...........#",
      "#......................#",
      "#..................o....",
      "#S.C................B.E.",
      "######....##############"),
   R(4, "Same sign on a pad launches you: up to the high door, coins in tow.",
      "########################",
      "#......................#",
      "#.......................",
      "#..o...........o......BE",
      "#.............##########",
      "#......................#",
      "#......................#",
      "#.........o............#",
      "#S..C.....+............#",
      "########################"),
   R(5, "Flip to - for the pull across, land, then + on the floor pad launches you up.",
      "########################",
      "#......................#",
      "#.......................",
      "#..o..........o.......BE",
      "#..............#########",
      "#..........+...........#",
      "#.................o....#",
      "#......................#",
      "#S.C.........+.........#",
      "######....##############"),
   R(8, "A hop with a swarm in tow. Nami: a double jump reaches the spare coins on the shelf.",
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#.....C................#",
      "#...#####..............#",
      "#..o...................#",
      "#.........o........o....",
      "#S..Q...............B.E.",
      "##########..############"),
];

const L2: RoomDef[] = [
   R(5, "Gates let one sign through. Pass as +, then flip to - for the pad.",
      "########################",
      "#......................#",
      "#......................#",
      "#..............o.......#",
      "#.......G......+.......#",
      "#.......G..............#",
      "#..o....G..............#",
      "#.......G..........o....",
      "#S..C...G...........B.E.",
      "###########....#########"),
   R(6, "Two gates, two signs: flip between them.",
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#.....o....G.....g.....#",
      "#..........G.....g.....#",
      "#..........G.....g..o...",
      "#..........G.....g......",
      "#S..Q......G..o..g..B.E.",
      "########################"),
   R(5, "A minus gate, then a minus pad: stay minus and launch. Vexa: the storage room is behind the ghost wall.",
      "########################",
      "#......................#",
      "#.......................",
      "#...o..........o......BE",
      "#............###########",
      "#......................#",
      "###....g...............#",
      "#.h....g..o............#",
      "#KhS.C.g..-............#",
      "########################"),
   R(5, "Spark floor: it scatters your coins. Hop it, or shield across with Kiro.",
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..o...........o.......#",
      "#......................#",
      "#......................#",
      "#..................o....",
      "#S..C...............B.E.",
      "##########xxxx##########"),
   R(6, "Through the - gate, ride the pull, then flip to + before the + gate.",
      "########################",
      "#......................#",
      "#......................#",
      "#..o...................#",
      "#......g.........G.....#",
      "#......g.....+...G.....#",
      "#......g.........G.....#",
      "#......g...o.....G..o...",
      "#S.Q...g.........G..B.E.",
      "#########....###########"),
];

const L3: RoomDef[] = [
   R(4, "Push the block out on its rail (same sign), then flip: opposite sign holds it under your feet.",
      "########################",
      "#......................#",
      "#......................#",
      "#..o...................#",
      "#..........o...........#",
      "#......................#",
      "#......................#",
      "#..................o....",
      "#S.C.M..............B.E.",
      "######=======###########"),
   R(5, "Push the block (same sign) against the ledge: a step up.",
      "########################",
      "#......................#",
      "#......................#",
      "#..............o.......#",
      "#.......................",
      "#.....................BE",
      "#............###########",
      "#..o.........#.........#",
      "#S..C....o..M#.........#",
      "########################"),
   R(5, "Push the block into the vent: a hidden route opens.",
      "########################",
      "#......................#",
      "#......................#",
      "#..o...........o.......#",
      "#.................HHH..#",
      "#.................HVH..#",
      "#.................H.H..#",
      "#.........o.............",
      "#S..C..M.........v..B.E.",
      "########################"),
   R(6, "A long rail gap: stand on the block as - and it carries you across.",
      "########################",
      "#......................#",
      "#......................#",
      "#....o.............o...#",
      "#......................#",
      "#.........o............#",
      "#.......................",
      "#.......................",
      "#S.Q.M..............B.E.",
      "######==========########"),
   R(6, "Ride the block across as -, and on into the vent: the hidden wall opens.",
      "########################",
      "#......................#",
      "#......................#",
      "#....o.............o...#",
      "#......................#",
      "#.........o............#",
      "#..................HH..#",
      "#..................HH...",
      "#S.Q.M...........v.HHBE.",
      "######=========#########"),
];

const L4: RoomDef[] = [
   R(5, "A lab drone steals coins. Same sign up close repels it: the coins fall loose.",
      "########################",
      "#......................#",
      "#..........d...........#",
      "#..o...................#",
      "#..............o.......#",
      "#......................#",
      "#......................#",
      "#..................o....",
      "#S..Q...............B.E.",
      "########################"),
   R(6, "Two drones over the gap. Keep your swarm close.",
      "########################",
      "#......................#",
      "#.....d.........d......#",
      "#..o...................#",
      "#..........o...........#",
      "#.............+........#",
      "#......................#",
      "#..................o....",
      "#S.Q................B.E.",
      "#######....#############"),
   R(6, "Behind the glass: only Zuno's overcharge pulls those coins (and the sticker) through.",
      "########################",
      "#......................#",
      "#.......................",
      "#..o..........o.......BE",
      "#.............##########",
      "#...........d..........#",
      "#......................#",
      "#.......o.....wwwww....#",
      "#S..Q.....+...wQ.kw....#",
      "########################"),
   R(8, "The drone hangar: three drones and a launch pad. Stay + near them, then ride the pad up.",
      "########################",
      "#......................#",
      "#....d..................",
      "#..o..........o.....d.BE",
      "#.............##########",
      "#..........d...........#",
      "#......................#",
      "#.........o............#",
      "#S.Q......+............#",
      "########################"),
   R(8, "Drones over the gap again. Riko: dash the cracked glass for spare coins.",
      "########################",
      "#......................#",
      "#....d........d........#",
      "#..o...................#",
      "#..........o...........#",
      "#.............+........#",
      "###....................#",
      "#.c...............o.....",
      "#Cc.SQ..............B.E.",
      "#######....#############"),
];

const L5: RoomDef[] = [
   R(6, "The forge corridor: launch, catch the pull node, leap to the door. Scrap Magnus waits beyond.",
      "########################",
      "#......................#",
      "#......................#",
      "#..o....................",
      "#........-............BE",
      "#.............##########",
      "#......................#",
      "#..............o.......#",
      "#SQ......+.............#",
      "########################"),
   R(6, "The slag line: stay - through the gate, the - pad launches you to the exit.",
      "########################",
      "#......................#",
      "#.......................",
      "#..o...........o......BE",
      "#..............#########",
      "#......................#",
      "#.....g................#",
      "#.....g....o...........#",
      "#SQ...g......-.........#",
      "########################"),
   R(0, "Scrap Magnus: match his sign to ride out the slam, then flip to be yanked into his core. Later: catch his blocks as -, flip to + to throw; at the end launch from a pad into his risen core.",
      "########################",
      "#......................#",
      "#......................#",
      "#......................#",
      "#..o.................o.#",
      "#..........R...........#",
      "#......................#",
      "#......................#",
      "#S......+.....+.......E#",
      "########################"),
];

export const LEVELS: Record<LevelId, LabLevel> = {
   1: { id: 1, name: "Basic Magnet", durationMs: 180_000, targetMs: 90_000, rooms: L1 },
   2: { id: 2, name: "Two Poles", durationMs: 240_000, targetMs: 120_000, rooms: L2 },
   3: { id: 3, name: "Moving Metal", durationMs: 300_000, targetMs: 150_000, rooms: L3 },
   4: { id: 4, name: "Drone Lab", durationMs: 320_000, targetMs: 170_000, rooms: L4 },
   5: { id: 5, name: "Scrap Magnus", durationMs: 360_000, targetMs: 180_000, rooms: L5 },
};

export interface PadDef {
   x: number;
   y: number;
   sign: 1 | -1;
   /** a pad sitting on a floor launches a same-sign hero standing on it */
   floor: boolean;
}

export interface ParsedRoom {
   w: number;
   h: number;
   /** tiles[r * w + c], r counted from the top */
   tiles: Uint8Array;
   start: { x: number; y: number };
   door: { x: number; y: number };
   bank: { x: number; y: number };
   piles: { x: number; y: number; count: number }[];
   pads: PadDef[];
   orbs: { x: number; y: number }[];
   blocks: { x: number; y: number }[];
   drones: { x: number; y: number }[];
   secrets: { x: number; y: number; id: number }[];
   vents: { x: number; y: number }[];
   boss: { x: number; y: number } | null;
   need: number;
   hint: string;
}

const cache = new Map<RoomDef, ParsedRoom>();

/** Cell (c, r) -> world: x = c (left edge), y = h - 1 - r (bottom edge). Centres are +0.5. */
export function parseRoom(def: RoomDef): ParsedRoom {
   const hit = cache.get(def);
   if (hit) return hit;
   const h = def.map.length;
   const w = def.map[0].length;
   const p: ParsedRoom = {
      w, h, tiles: new Uint8Array(w * h), start: { x: 0, y: 0 }, door: { x: 0, y: 0 }, bank: { x: 0, y: 0 },
      piles: [], pads: [], orbs: [], blocks: [], drones: [], secrets: [], vents: [], boss: null, need: def.need, hint: def.hint,
   };
   let door = false;
   let start = false;
   def.map.forEach((line, r) => {
      if (line.length !== w) throw new Error(`room row ${r}: ${line.length} cells, want ${w}`);
      for (let c = 0; c < w; c++) {
         const ch = line[c];
         const x = c + 0.5;
         const y = h - 1 - r;
         let t: number = T.AIR;
         switch (ch) {
            case ".": break;
            case "#": t = T.WALL; break;
            case "S": p.start = { x, y }; start = true; break;
            case "E": p.door = { x, y }; t = T.DOOR; door = true; break;
            case "B": p.bank = { x, y }; break;
            case "C": p.piles.push({ x, y, count: 6 }); break;
            case "Q": p.piles.push({ x, y, count: 10 }); break;
            case "o": p.orbs.push({ x, y: y + 0.5 }); break;
            case "+": case "-": break;
            case "G": t = T.GATE_P; break;
            case "g": t = T.GATE_N; break;
            case "M": p.blocks.push({ x, y }); break;
            case "=": t = T.RAIL; break;
            case "x": t = T.SPARK; break;
            case "c": t = T.CRACKED; break;
            case "h": t = T.GHOST; break;
            case "w": t = T.GLASS; break;
            case "H": t = T.HIDDEN; break;
            case "K": p.secrets.push({ x, y: y + 0.5, id: 0 }); break;
            case "k": p.secrets.push({ x, y: y + 0.5, id: 1 }); break;
            case "V": p.secrets.push({ x, y: y + 0.5, id: 2 }); break;
            case "v": p.vents.push({ x, y }); break;
            case "d": p.drones.push({ x, y: y + 0.5 }); break;
            case "R": p.boss = { x, y }; break;
            default: throw new Error(`room row ${r}: unknown cell "${ch}"`);
         }
         p.tiles[r * w + c] = t;
      }
   });
   // pads: solid below = a floor pad (sits on the floor, launches); else a hanging pull / push node
   def.map.forEach((line, r) => {
      for (let c = 0; c < w; c++) {
         const ch = line[c];
         if (ch !== "+" && ch !== "-") continue;
         const below = r + 1 < h ? p.tiles[(r + 1) * w + c] : T.WALL;
         const floor = below === T.WALL || below === T.SPARK;
         p.pads.push({ x: c + 0.5, y: h - 1 - r + (floor ? 0.05 : 0.5), sign: ch === "+" ? 1 : -1, floor });
      }
   });
   if (!door || !start) throw new Error("a room needs S and E");
   // the door is two cells tall: the E cell and the one above it
   {
      const dc = Math.floor(p.door.x);
      const dr = h - 1 - p.door.y - 1;
      if (dr >= 0 && p.tiles[dr * w + dc] === T.AIR) p.tiles[dr * w + dc] = T.DOOR;
   }
   cache.set(def, p);
   return p;
}
