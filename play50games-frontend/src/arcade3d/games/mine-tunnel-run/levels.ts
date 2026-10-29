// The five mines, as ASCII cross-sections (row 0 = the surface; one char per cell; the parser adds a
// bedrock border left and right). Pure data plus a parser.
//
//   .  open (tunnel / cave / air)      s  soft soil (0.2 s)       p  packed soil (0.5 s)
//   #  rock (undiggable)               o  red ore: holds an orb   c  cracked rock (Riko's dash, a boulder)
//   g  ghost rock (Vexa phases)        G  gas pocket (Kiro digs it safely)
//   B  boulder (falls when its floor is dug)    w  sealed water pocket (floods when breached)
//   L  lantern (checkpoint)            E  the lift                S  start
//   b  beetle    t  tunnelling beetle  =  rail (an open line you ride at 10 m/s)
//   *  free orb (air bubble)           z  orb sealed in rock (Zuno's magnet)
//   K  ghost-shaft shard (secret 1)    k  air-pocket sticker (secret 2, Nami)
//   V  vault shard (secret 3, behind cracked rock)   Q  flooded-room shard (secret 3, L3, under Kiro's shield)
//   P  arena plug (soft soil under a boulder)        R  Rockjaw's spawn on the arena floor (L5)
import type { LevelId } from "../../types";

export const T = {
   EMPTY: 0,
   SOFT: 1,
   PACKED: 2,
   ROCK: 3,
   ORE: 4,
   CRACKED: 5,
   GHOST: 6,
   BOULDER: 7,
   WATER: 8,
   GAS: 9,
   RUBBLE: 10,
   BEDROCK: 11,
} as const;

export interface MineLevel {
   id: LevelId;
   name: string;
   /** run cap (ms): the timer the time score counts down from */
   durationMs: number;
   /** the third star */
   targetMs: number;
   rockfall?: { startMs: number; rowMs: number };
   map: readonly string[];
}

const L1: readonly string[] = [
   "........S.........",
   "ssssssssssssssssss",
   "sssssssossssssssss",
   "ssssssssssss###sss",
   "sss##sssss##.k#sss",
   "ss####ssss##.##sss",
   "ssssssssss##.#ssss",
   "sss##........##sss",
   "sss#....*.L...#sss",
   "sss#####ss#####sss",
   "ssssssssssssssssss",
   "ssssssssssssssssss",
   "sssssssssBssssssss",
   "sssssss#ssssssssss",
   "ssssss###sssssssss",
   "ssssssssssssssssss",
   "sssssssssssossssss",
   "pppppppppppspppppp",
   "pppppppppppspppppp",
   "ppp#####pppsppp###",
   "ppp#....*..L...gK#",
   "ppp##########s####",
   "pppppppppppppspppp",
   "ppppppppoppppspppp",
   "pppppppppppppspppp",
   "ssssssssssssssssss",
   "sss*ssssssssssssss",
   "ssssssssssssssssss",
   "#######s##########",
   "#V.cccc.##########",
   "#######s##########",
   "#######s##B#######",
   "#######ssss#######",
   "##########.#######",
   "###.............##",
   "###..b.........E##",
   "##################",
   "##################",
   "##################",
   "##################",
];

const L2: readonly string[] = [
   "..................S...",
   "ssssssssssssssssssssss",
   "sssssssssssssssssossss",
   "ssssssssssssssssssssss",
   "sss##sssssssssss#sssss",
   "ssssssssssssssssssssss",
   "pppppppppppppppppspppp",
   "pppppppppppppppppspppp",
   "pp#####ppppppppppspppp",
   "#zz##zz##zz##zz##s####",
   "#====================#",
   "#s####################",
   "sppppppppppppppppppppp",
   "sppppppppppopppppppppp",
   "spppp##pppppppp##ppppp",
   "sppppppp###ppppppppppp",
   "......L.gK#ppppppppppp",
   "###s##G####ppppppppppp",
   "ppppppGppppppppppppppp",
   "pppppoGppppppppppppppp",
   "ppppppGp###ppp###ppppp",
   "ppppppGppppppppppppppp",
   "pppppppppppppppppppppp",
   "###p##G###############",
   "#====================#",
   "####################s#",
   "ppppppppppppppppppppsp",
   "pppppppppppp####ppposp",
   "pppppppppppp#k.#ppppsp",
   "pppppppppppp##.#ppppsp",
   "ppppppppppppp#.#ppppsp",
   "ppppppp######........p",
   "pppppppV.cccc......L.p",
   "ppppppp########p######",
   "pppppppppppppppppppppp",
   "pppppppppppppopppppppp",
   "pppppppppppppppppppppp",
   "###############p######",
   "#===================##",
   "#s####################",
   "#sppppppppppppppppppp#",
   "#sppppppppppppppppppp#",
   "#s#######B############",
   "#sssssssss############",
   "#########.############",
   "#....................#",
   "#..b................E#",
   "######################",
];

const L3: readonly string[] = [
   "...S..................",
   "ssssssssssssssssssssss",
   "sssssssssssssossssssss",
   "ssssssssssssssssssssss",
   "sssppppppppppppppppppp",
   "ssspp#####pppppppppppp",
   "sssp#wwwww#ppppppppppp",
   "sssp#wwwww#ppppppppppp",
   "sssp#ppppp#ppppppppppp",
   "sssppppppppppppppppppp",
   "sssppppppppppppppppppp",
   "ssppp###pppppppppppppp",
   "sspppppppppppppppppppp",
   "#......L.#pppppppppppp",
   "########s#pppppppppppp",
   "ppppppppsppppppppppppp",
   "ppppppppp#####pppppppp",
   "pppppppppwwwww#ppppppp",
   "pppppppppwwwww#ppppppp",
   "pppppppppwwwww#ppppppp",
   "pppppppppwwwww#ppppppp",
   "ppppppppp#####pppppppp",
   "pppppppppppppppppppppp",
   "pppppppppp#ppppppppppp",
   "ppppppppp#.k#ppppppppp",
   "ppppppppp#.#pppppppppp",
   "########pp.ppppppppppp",
   "##wwwwwp............pp",
   "##Qwwwwp...........Lpp",
   "##################p#pp",
   "pppppppppppppppppppppp",
   "pppppppppppppppppppppp",
   "pppppppppppp#####ppppp",
   "ppppppppppppwwwwwppppp",
   "ppppppppppppwwwwwppppp",
   "ppppppppppppwwwwwppppp",
   "pppppppppppp#####ppppp",
   "pppppppppppppppppppp##",
   "ppppppppppppppppppppgK",
   "pppppppppppppppppppp##",
   "pppppppppppppppppppppp",
   "ppppppppppoppppppppppp",
   "pppppppppppppppppppppp",
   "ssssssssssssssssssssss",
   "ssssssssssssssssssssss",
   "##########s###########",
   "#....................#",
   "#.b..*..............E#",
   "######################",
   "######################",
   "######################",
   "######################",
];

const L4: readonly string[] = [
   "..........S...........",
   "ssssssssssssssssssssss",
   "sssssssssossssssssssss",
   "ssssssssssssssssssssss",
   "##########.###########",
   "#ppppppp##.##ppppppp##",
   "#ppppppp#z.z#ppppppp##",
   "#ppppppp##.##ppppppp##",
   "#ppppppp##.##ppppppp##",
   "#....................#",
   "Vc..t.........L......#",
   "###ssssss#####ssssss##",
   "#ssssssssssssssssssss#",
   "#ssssssssossssssssssss",
   "ssssssssssssssssssssss",
   "#########.############",
   "#.#pppp##.##pppppppppp",
   "k.#pppp##.##pppppppppp",
   "#.#pppp##.##pppppppppp",
   "#.#pppp##.##pppppppppp",
   "......................",
   "..t.......L.......t...",
   "######sss######sss####",
   "ssssssssssssssssssssss",
   "ssssssssssssssssssssss",
   "sssssssssssBssssssssss",
   "ssssssssssssssssssssss",
   "pppppppppppppppppppppp",
   "pppppppppppppppppppppp",
   "#############.########",
   "#pppppppppp##.##pppppp",
   "#pppppppppp##.##pppppp",
   "#pppppppppp##.##pppppp",
   "#pppppppppp##.##pppppp",
   "....................##",
   ".t.........L.......tgK",
   "####ssss######ssss####",
   "ssssssssssssssssssssss",
   "ssssssosssssssssssssss",
   "ssssssssssssssssssssss",
   "ssssssssssssssssssssss",
   "#######.##############",
   "#pppp##.##pppppppppppp",
   "#pppp##.##pppppppppppp",
   "#pppp##.##pppppppppppp",
   "#pppp##.##pppppppppppp",
   "......................",
   "......L...............",
   "###ssssssssssssssss###",
   "ssssssssssssssssssssss",
   "##########s###########",
   "#....................#",
   "#..b................E#",
   "######################",
   "######################",
   "######################",
];

const L5: readonly string[] = [
   ".......S................",
   "ssssssssssssssssssssssss",
   "ssssssssosssssssssssssss",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssssssss",
   "#######.################",
   "#pppp##.##pppppppppppppp",
   "#pppp#z.z#pppppppppppppp",
   "#pppp##.##pppppppppppppp",
   "#pppp##.##pppppppppppppp",
   "#......................#",
   "#...B.....L.......b....#",
   "###sssss##########sssss#",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssosssss",
   "pppppppppppppppppppppppp",
   "pppppppppppppppppppppppp",
   "#ssss#####cccc##########",
   "pppp#k.#pppppppppppppppp",
   "ppppp#.#pppppppppppppppp",
   "pppp................####",
   "pppp......L....b....gKpp",
   "########ssss####ssss####",
   "pppppppppppppppppppppppp",
   "pppppppppppopppppppppppp",
   "pppppppppppppppppppppppp",
   "pppppppppppppppppppppppp",
   "##################.#####",
   "#ppppppppppppppp##.##ppp",
   "#ppppppppppppppp##.##ppp",
   "#ppppppppppppppp##.##ppp",
   "#ppppppppppppppp##.##ppp",
   "p###................pppp",
   "p#Vc..b.........L...pppp",
   "######ssss######ssss####",
   "ssssssssssssssssssssssss",
   "sssssssssssBssssssssssss",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssssssss",
   "pppppppppppppppppppppppp",
   "pppppppppppppppppppppppp",
   "pppppppppppppppppppppppp",
   "ppppppppppppppppppppoppp",
   "pppppppppppppppppppppppp",
   "pppppppppppppppppppppppp",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssssssss",
   "ssssssssssssssssssssssss",
   "#####################s##",
   "#####################s##",
   "#####B###B###B###B###.##",
   "#....P...P...P...P...L##",
   "#.###.###.###.###.######",
   "#.....................##",
   "##....................##",
   "##.........R..........E#",
   "########################",
   "########################",
   "########################",
   "########################",
   "########################",
   "########################",
   "########################",
];

export const LEVELS: Record<LevelId, MineLevel> = {
   1: { id: 1, name: "Dry Tunnel", durationMs: 90_000, targetMs: 32_000, map: L1 },
   2: { id: 2, name: "Pipe Zone", durationMs: 120_000, targetMs: 55_000, map: L2 },
   3: { id: 3, name: "Water Gaps", durationMs: 150_000, targetMs: 55_000, map: L3 },
   4: { id: 4, name: "Fast Tunnel", durationMs: 120_000, targetMs: 32_000, rockfall: { startMs: 15_000, rowMs: 600 }, map: L4 },
   5: { id: 5, name: "Deep Mine Sprint", durationMs: 240_000, targetMs: 120_000, map: L5 },
};

export interface ParsedLevel {
   w: number;
   h: number;
   tiles: Uint8Array;
   orb: Uint8Array;
   rail: Uint8Array;
   lantern: Uint8Array;
   secret: Uint8Array;
   start: { col: number; row: number };
   lift: { col: number; row: number };
   boulders: { col: number; row: number }[];
   beetles: { col: number; row: number; dir: 1 | -1; tunneller: boolean }[];
   rails: { row: number; c0: number; c1: number }[];
   pockets: { cells: number[]; volume: number }[];
   pocketOf: Int16Array;
   /** the cell whose secret needs Kiro's shield (-1 none) */
   shieldSecret: number;
   arena: { gallery: number; floor: number; x0: number; x1: number; plugs: number[]; bossStart: number } | null;
}

const cache = new Map<MineLevel, ParsedLevel>();

/** Parses a level map (cached per level object). Throws on a malformed map. */
export function parseLevel(level: MineLevel): ParsedLevel {
   const hit = cache.get(level);
   if (hit) return hit;
   const inner = level.map[0].length;
   const w = inner + 2;
   const h = level.map.length;
   const n = w * h;
   const p: ParsedLevel = {
      w, h, tiles: new Uint8Array(n), orb: new Uint8Array(n), rail: new Uint8Array(n), lantern: new Uint8Array(n), secret: new Uint8Array(n),
      start: { col: -1, row: -1 }, lift: { col: -1, row: -1 }, boulders: [], beetles: [], rails: [], pockets: [], pocketOf: new Int16Array(n).fill(-1),
      shieldSecret: -1, arena: null,
   };
   const plugs: number[] = [];
   let plugRow = -1;
   let spawn: { col: number; row: number } | null = null;
   level.map.forEach((line, r) => {
      if (line.length !== inner) throw new Error(`level ${level.id} row ${r}: ${line.length} cells, want ${inner}`);
      for (let x = 0; x < w; x++) {
         const i = r * w + x;
         if (x === 0 || x === w - 1) {
            p.tiles[i] = T.BEDROCK;
            continue;
         }
         const ch = line[x - 1];
         let t: number = T.EMPTY;
         switch (ch) {
            case ".": break;
            case "s": t = T.SOFT; break;
            case "p": t = T.PACKED; break;
            case "#": t = T.ROCK; break;
            case "o": t = T.ORE; p.orb[i] = 1; break;
            case "c": t = T.CRACKED; break;
            case "g": t = T.GHOST; break;
            case "G": t = T.GAS; break;
            case "B": t = T.EMPTY; p.boulders.push({ col: x, row: r }); break;
            case "w": t = T.WATER; break;
            case "Q": t = T.WATER; p.secret[i] = 3; p.shieldSecret = i; break;
            case "L": p.lantern[i] = 1; break;
            case "E": p.lift = { col: x, row: r }; break;
            case "S": p.start = { col: x, row: r }; break;
            case "b": p.beetles.push({ col: x, row: r, dir: 1, tunneller: false }); break;
            case "t": p.beetles.push({ col: x, row: r, dir: -1, tunneller: true }); break;
            case "=": p.rail[i] = 1; break;
            case "*": p.orb[i] = 1; break;
            case "z": t = T.ROCK; p.orb[i] = 1; break;
            case "K": p.secret[i] = 1; break;
            case "k": p.secret[i] = 2; break;
            case "V": p.secret[i] = 3; break;
            case "P": t = T.SOFT; plugs.push(x); plugRow = r; break;
            case "R": spawn = { col: x, row: r }; break;
            default: throw new Error(`level ${level.id} row ${r}: unknown cell "${ch}"`);
         }
         p.tiles[i] = t;
      }
   });
   if (p.start.col < 0 || p.lift.col < 0) throw new Error(`level ${level.id}: needs S and E`);
   // rails: horizontal runs of rail cells
   for (let r = 0; r < h; r++) {
      let c0 = -1;
      for (let x = 0; x <= w; x++) {
         const on = x < w && p.rail[r * w + x] === 1;
         if (on && c0 < 0) c0 = x;
         if (!on && c0 >= 0) {
            p.rails.push({ row: r, c0, c1: x - 1 });
            c0 = -1;
         }
      }
   }
   // water pockets: 4-connected water regions; each floods twice its own volume
   for (let i = 0; i < n; i++) {
      if (p.tiles[i] !== T.WATER || p.pocketOf[i] >= 0) continue;
      const id = p.pockets.length;
      const cells: number[] = [];
      const q = [i];
      p.pocketOf[i] = id;
      while (q.length) {
         const j = q.pop()!;
         cells.push(j);
         const c = j % w;
         const r = Math.floor(j / w);
         for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const cc = c + dc;
            const rr = r + dr;
            if (cc < 0 || rr < 0 || cc >= w || rr >= h) continue;
            const k = rr * w + cc;
            if (p.tiles[k] === T.WATER && p.pocketOf[k] < 0) {
               p.pocketOf[k] = id;
               q.push(k);
            }
         }
      }
      p.pockets.push({ cells, volume: cells.length * 2 });
   }
   if (spawn) {
      const s = spawn as { col: number; row: number };
      let x0 = s.col;
      let x1 = s.col;
      while (p.tiles[s.row * w + x0 - 1] === T.EMPTY && x0 - 1 !== p.lift.col) x0--;
      while (p.tiles[s.row * w + x1 + 1] === T.EMPTY && x1 + 1 !== p.lift.col) x1++;
      p.arena = { gallery: plugRow, floor: s.row, x0, x1, plugs, bossStart: s.col };
   }
   cache.set(level, p);
   return p;
}
