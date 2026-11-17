// Mirror Dash: two 3-lane runways side by side, split by a mirror wall. The hero runs the left one, the
// glass reflection the right one; one input drives both. Each level is a list of rows, one every ROW_M
// metres from START_M, written "HHH|RRR flags": the hero runway's three lanes left to right, then the
// reflection's, in world order (x grows to the right). Pure data plus a parser.
//
//   .  open          B  block (dodge it)        C  cracked block (Riko's dash breaks it, else a block)
//   L  low hurdle (jump)   H  high bar (slide)   Z  laser (dodge it; Kiro's shield or Vexa's phase pass)
//   G  ghost glass (only Vexa's phase passes)    o  orb on the floor   O  orb in the air (jump for it)
//   s  a secret (which one: the level's `secrets` list, in order)
// flags (after a space): K checkpoint at this row · M merge (one wide road, the inner lanes touch)
//                        F frosted mirror (the reflection copies instead of mirroring)
//                        E echo (the reflection repeats your input 0.5 s later)
import type { LevelId } from "../../types";

export const ROW_M = 8;
export const START_M = 30;
export const LANE_W = 1.4;

export type Zone = "mirror" | "merge" | "frost" | "echo";

export interface MirrorLevel {
   id: LevelId;
   name: string;
   durationMs: number;
   targetMs: number;
   /** speed (m/s) at the start and at the end of the course (linear in distance) */
   speed: [number, number];
   rows: readonly string[];
   /** secret ids (SECRETS index) for the level's `s` cells, in reading order */
   secrets: readonly number[];
   /** L5: the Glass Sentinel's arena follows the course */
   boss: boolean;
}

const L1 = [
   // beat 1: only your side
   "...|...", "B..|...", "...|...", ".B.|...", "...|...", "..B|...", "...|...", "BB.|...", "...|...", ".L.|...", "o..|...", "LLL|...", "...|...",
   // beat 2: only the reflection's side
   "...|... K", "...|B..", "...|...", "...|.B.", "...|...", "...|..B", "...|...", "...|.BB", "...|...", "...|o..", "...|LLL", "...|...", "...|HHH", "...|...",
   // beat 3: both, one safe input
   "...|... K", "B..|..B", "...|...", ".B.|.B.", "...|...", "B.B|B.B", "o..|..o", "..B|B..", "...|...", "LL.|.LL", "...|...", "BB.|.BB", ".o.|.o.", "H.H|H.H", "...|...", "ZZ.|.ZZ", "...|...", ".O.|.O.", "BLB|BLB", "...|...",
];

const L2 = [
   "...|...", "B..|..B", "...|...", ".B.|.B.", "o..|..o",
   // the runways merge: never both in the inner lanes
   "...|... M", "...|... M", "B..|..B M", "...|... M", "o..|..o M", ".L.|.L. M", "...|... M", "...|...",
   "...|... K", "BB.|.BB", "...|...", ".C.|.C.", ".s.|...", "...|...", "LLB|BLL", "...|...", ".o.|.o.",
   "...|... M", "B.B|B.B M", "...|... M", "H..|..H M", "...|... M", "o..|..o M", "...|...",
   "...|... K", "ZZ.|.ZZ", "...|...", "B.L|L.B", "...|...", ".O.|.O.", "BB.|.BB", "...|...",
   "...|... M", ".B.|.B. M", "...|... M", "L.L|L.L M", "...|... M", "...|...", "BHB|BHB", "...|...",
];

const L3 = [
   "...|...", "B..|..B", "...|...", ".o.|.o.",
   // frosted glass: the reflection copies
   "...|... F", "...|... F", "B..|B.. F", "...|... F", ".B.|.B. F", "...|... F", "..B|..B F", "...|...",
   "...|... K", "...|...", "B..|..B", "...|...", "o..|..o", "LL.|.LL", "...|...",
   "...|... F", ".BB|.BB F", "...|... F", "BB.|BB. F", "...|... F", "..s|... F", "...|... F", "...|...",
   "...|... K", "...|...", "B.B|B.B", "...|...", ".O.|.O.", "ZZ.|.ZZ", "...|...",
   "...|... F", "H..|H.. F", "...|... F", ".L.|.L. F", "...|... F", "o..|o.. F", "...|...",
   "...|... K", ".B.|.B.", "...|...", "BB.|.BB", "...|...", "LHL|LHL", "...|...",
];

const L4 = [
   "...|...", "B..|..B", "...|...", ".o.|.o.",
   // echo: the reflection repeats you half a second later, so read its row one beat later
   "...|... E", "...|... E", "B..|... E", "...|..B E", "...|... E", "..B|... E", "...|B.. E", "...|... E", "...|...",
   "...|... K", "...|...", "BB.|.BB", "...|...", "o..|..o", ".L.|.L.", "...|...",
   "...|... E", "...|... E", ".L.|... E", "...|.L. E", "...|... E", "...|... E", "B.B|... E", "...|B.B E", "...|... E", "...|...",
   "...|... K", "G..|...", "s..|...", "...|...", "ZZ.|.ZZ", "...|...", ".O.|.O.",
   "...|... E", "...|... E", "..B|... E", "...|B.. E", "...|... E", "H..|... E", "...|..H E", "...|... E", "...|...",
   "...|... K", "B.B|B.B", "...|...", "LBL|LBL", "...|...", ".o.|.o.", "BB.|.BB", "...|...",
];

const L5 = [
   "...|...", "B..|..B", "...|...", ".o.|.o.",
   "...|... M", "B..|..B M", "...|... M", "...|...",
   "...|... F", "..B|..B F", "...|... F", "...|...",
   "...|... K", "...|... E", "B..|... E", "...|..B E", "...|... E", "...|...",
   "o..|..o", "LL.|.LL", "...|...", "ZZ.|.ZZ", "...|...", ".O.|.O.", "...|... K",
];

export const LEVELS: Record<LevelId, MirrorLevel> = {
   1: { id: 1, name: "Mirror Lane", durationMs: 150_000, targetMs: 50_000, speed: [9, 10.5], rows: L1, secrets: [], boss: false },
   2: { id: 2, name: "Converge", durationMs: 170_000, targetMs: 55_000, speed: [10, 11.5], rows: L2, secrets: [1], boss: false },
   3: { id: 3, name: "Frosted Glass", durationMs: 180_000, targetMs: 55_000, speed: [11, 12.5], rows: L3, secrets: [2], boss: false },
   4: { id: 4, name: "Echo", durationMs: 190_000, targetMs: 55_000, speed: [11.5, 13], rows: L4, secrets: [0], boss: false },
   5: { id: 5, name: "Glass Hall", durationMs: 240_000, targetMs: 80_000, speed: [12.5, 13.5], rows: L5, secrets: [], boss: true },
};

export type ObstacleKind = "B" | "C" | "L" | "H" | "Z" | "G";

export interface Obstacle {
   s: number;
   body: 0 | 1;
   lane: -1 | 0 | 1;
   kind: ObstacleKind;
}

export interface Pickup {
   s: number;
   body: 0 | 1;
   lane: -1 | 0 | 1;
   /** orb height (m): 0.6 on the floor, 1.5 in the air */
   y: number;
   /** a secret id, or -1 for an orb */
   secret: number;
}

export interface Course {
   level: LevelId;
   obstacles: Obstacle[];
   orbs: Pickup[];
   secrets: Pickup[];
   /** zone per row (index = row) */
   zones: Zone[];
   checkpoints: number[];
   /** where the course ends (the finish line, or the arena's start on L5) */
   endS: number;
}

const cache = new Map<LevelId, Course>();

export const rowS = (i: number) => START_M + i * ROW_M;

export function parseCourse(level: LevelId): Course {
   const hit = cache.get(level);
   if (hit) return hit;
   const def = LEVELS[level];
   const c: Course = { level, obstacles: [], orbs: [], secrets: [], zones: [], checkpoints: [0], endS: 0 };
   let secretIndex = 0;
   def.rows.forEach((row, i) => {
      const m = /^([.BCLHZGoOs]{3})\|([.BCLHZGoOs]{3})(?: ([KMFE]+))?$/.exec(row);
      if (!m) throw new Error(`L${level} row ${i}: "${row}"`);
      const s = rowS(i);
      const flags = m[3] ?? "";
      c.zones.push(flags.includes("M") ? "merge" : flags.includes("F") ? "frost" : flags.includes("E") ? "echo" : "mirror");
      if (flags.includes("K")) c.checkpoints.push(s);
      [m[1], m[2]].forEach((cells, body) => {
         for (let k = 0; k < 3; k++) {
            const ch = cells[k];
            const lane = (k - 1) as -1 | 0 | 1;
            const b = body as 0 | 1;
            if (ch === ".") continue;
            if (ch === "o" || ch === "O") c.orbs.push({ s, body: b, lane, y: ch === "o" ? 0.6 : 1.5, secret: -1 });
            else if (ch === "s") {
               const id = def.secrets[secretIndex++];
               if (id === undefined) throw new Error(`L${level} row ${i}: a secret with no id`);
               c.secrets.push({ s, body: b, lane, y: 0.8, secret: id });
            } else c.obstacles.push({ s, body: b, lane, kind: ch as ObstacleKind });
         }
      });
   });
   if (secretIndex !== def.secrets.length) throw new Error(`L${level}: ${def.secrets.length} secret ids, ${secretIndex} cells`);
   c.endS = rowS(def.rows.length) + ROW_M;
   cache.set(level, c);
   return c;
}

/** The zone at distance s (before the first row and past the last: mirror). */
export function zoneAt(c: Course, s: number): Zone {
   const i = Math.floor((s - START_M + ROW_M / 2) / ROW_M);
   return i >= 0 && i < c.zones.length ? c.zones[i] : "mirror";
}
