// Toy Room Run's five levels (docs/menu2-super/world-4-frost-and-sweets.md "18 Toy Room Run").
// Plain data: course.ts turns a spec into the course the rules run on. One base room (desks and
// shelves of a giant playroom, the carpet a long fall below) and five configurations of it. The
// course runs along +z; desks are separated by gaps you cannot jump (10 m or more): a toppling
// chain of dominoes lies down as a bridge over each one. Coordinates are metres.
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "ride the domino wave";

export interface XZ {
   x: number;
   z: number;
}

export interface XYZ extends XZ {
   y: number;
}

/** A walkable top: a desk (y 0), a shelf or a high ledge. Walls are its edges: off them you fall. */
export interface PlatSpec {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
   y: number;
   kind: "desk" | "shelf" | "ledge";
}

export type PieceKind = "domino" | "book" | "key";

/** A chain: pieces stand every PIECE_SPACING metres along the polyline, from its first point. */
export interface ChainSpec {
   pts: [number, number][];
   /** the wave's speed (m/s) */
   speed: number;
   kind: PieceKind;
   /** the bridge stays down for good (L1 beat 1); else each fallen piece over a gap lasts BRIDGE_MS */
   untimed?: boolean;
   /** piece slots left empty: the wave stalls there until a spare is pushed in */
   missing?: number[];
   /** spare pieces lying beside a stalled slot (walk into one and it slides into its slot) */
   spares?: { x: number; z: number; slot: number }[];
   /** a fork: this chain starts when chain `chain`'s piece `index` falls (no starter of its own) */
   from?: { chain: number; index: number };
   /** level 5: the chain stands back up this long after its last piece fell */
   rearmMs?: number;
}

export interface DrumSpec extends XZ {
   /** fires when this chain's piece falls */
   chain: number;
   index: number;
}

export interface CarSpec {
   /** the car waits at the first point, fires when the chain's piece falls, drives the track once */
   track: [number, number][];
   speed: number;
   chain: number;
   index: number;
}

export interface TopSpec extends XZ {
   /** circles (cx, cz) at radius r, one lap per periodMs */
   r: number;
   periodMs: number;
}

export interface ZoneSpec {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
}

export interface OrbSpec extends XYZ {
   main: boolean;
   /** only Zuno's magnet pulls it out (under the rug, in a drawer) */
   hidden?: boolean;
}

export interface ToySpec {
   id: LevelId;
   name: string;
   timerMs: number;
   starTargetMs: number;
   start: XZ;
   finish: XZ;
   plats: PlatSpec[];
   chains: ChainSpec[];
   drums: DrumSpec[];
   cars: CarSpec[];
   tops: TopSpec[];
   /** Kiro: a toy-block tower topples across this zone every CASCADE_PERIOD */
   cascades: ZoneSpec[];
   /** Riko: a cracked block wall (solid until a dash breaks it) */
   walls: ZoneSpec[];
   /** Vexa: the ghost doorway of the toy castle (solid unless phasing) */
   ghosts: ZoneSpec[];
   /** the castle body (solid) */
   castles: ZoneSpec[];
   /** Nami: a pencil ramp (lip, rising toward dir) */
   pencils: { x: number; z: number; dir: "+x" | "-x" | "+z" | "-z" }[];
   checkpoints: XZ[];
   orbs: OrbSpec[];
   /** in progression.ts SECRETS order */
   secrets: XYZ[];
   night: boolean;
   boss: boolean;
}

const D = (z0: number, z1: number, x0 = -6, x1 = 6): PlatSpec => ({ x0, x1, z0, z1, y: 0, kind: "desk" });
const Y = 0.8;
/** a line of n main orbs from (x, z0) to (x, z1) */
const line = (x: number, z0: number, z1: number, n: number, y = Y, main = true): OrbSpec[] =>
   Array.from({ length: n }, (_v, i) => ({ x, y, z: z0 + ((z1 - z0) * i) / Math.max(1, n - 1), main }));
const hidden = (x: number, z0: number, z1: number, n: number): OrbSpec[] => line(x, z0, z1, n, 0.6, false).map((o) => ({ ...o, hidden: true }));

/** the ledge height: a plain jump (3.27 m) never reaches it; Nami's second jump off a pencil ramp does */
export const LEDGE_Y = 5.4;
/** a shelf: only the drum's launch (or Nami's double jump) gets you up */
export const SHELF_Y = 4;

export const LEVELS: Record<LevelId, ToySpec> = {
   // L1 teaches in three beats: push one domino and six pieces bridge a gap between two book stacks
   // (untimed); a 20-piece line at 4 m/s you follow across the desk and over the next gap; the wave
   // hits a toy drum: stand on it as it hits and it throws you up to the shelf over the last gap.
   1: {
      id: 1,
      name: "Desk Start",
      timerMs: 120_000,
      starTargetMs: 55_000,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: 126 },
      plats: [
         D(0, 22),
         D(32, 64),
         D(74, 96),
         { x0: -0.5, x1: 4.5, z0: 90, z1: 116, y: SHELF_Y, kind: "shelf" },
         D(110, 132),
         { x0: -6, x1: -3, z0: 54, z1: 62, y: LEDGE_Y, kind: "ledge" },
      ],
      chains: [
         { pts: [[0, 12], [0, 33]], speed: 5, kind: "domino", untimed: true },
         { pts: [[-2.5, 36], [-2.5, 75]], speed: 4, kind: "domino" },
         { pts: [[-3, 78], [-3, 86], [2, 92]], speed: 4.5, kind: "key" },
      ],
      drums: [{ x: 2, z: 93.4, chain: 2, index: 11 }],
      cars: [],
      tops: [],
      cascades: [{ x0: -6, x1: -1, z0: 80, z1: 84 }],
      walls: [{ x0: 3.5, x1: 6, z0: 44, z1: 46 }],
      ghosts: [{ x0: -3, x1: -2.4, z0: 120, z1: 124 }],
      castles: [{ x0: -6, x1: -2.4, z0: 118, z1: 130 }],
      pencils: [{ x: -4.5, z: 51, dir: "+z" }],
      checkpoints: [{ x: 0, z: 2 }, { x: 0, z: 34 }, { x: 0, z: 76 }, { x: 0, z: 112 }],
      orbs: [
         ...line(-2, 4, 16, 4),
         ...line(0, 24, 30, 3, 0.9),
         ...line(1.5, 40, 60, 4),
         ...line(-2.5, 66, 72, 2, 0.9),
         ...line(2, 98, 112, 3, SHELF_Y + 0.8),
         ...line(4.8, 45, 45.5, 2, Y, false),
         ...line(-4.5, 56, 60, 2, LEDGE_Y + 0.8, false),
         ...hidden(3.5, 4, 16, 4),
      ],
      secrets: [
         { x: -4.2, y: 1, z: 125 },
         { x: 5, y: 1, z: 44.8 },
         { x: -4.5, y: LEDGE_Y + 1, z: 61 },
      ],
      night: false,
      boss: false,
   },
   // L2: stalled chains. Three empty slots stop the wave until you push a spare piece in (Zuno's
   // magnet pulls one from 5 m), and the first fork: a short branch to the right (it stalls) or a
   // longer one to the left. The bookshelf hides a fork with a shard.
   2: {
      id: 2,
      name: "Book Bridge",
      timerMs: 150_000,
      starTargetMs: 75_000,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: 142 },
      plats: [
         D(0, 24),
         D(34, 66),
         D(76, 104),
         D(114, 148),
         { x0: 3, x1: 6, z0: 92, z1: 100, y: LEDGE_Y, kind: "ledge" },
      ],
      chains: [
         { pts: [[0, 8], [0, 35]], speed: 5, kind: "book", missing: [6], spares: [{ x: 2.6, z: 16.4, slot: 6 }] },
         { pts: [[0, 38], [0, 50]], speed: 5.5, kind: "domino" },
         { pts: [[0, 50.5], [4, 54], [4, 77]], speed: 5.5, kind: "domino", from: { chain: 1, index: 8 }, missing: [8], spares: [{ x: 1.6, z: 61.6, slot: 8 }] },
         { pts: [[0, 50.5], [-4, 54], [-4, 60], [-4.5, 66], [-4.5, 77]], speed: 5.5, kind: "domino", from: { chain: 1, index: 8 } },
         { pts: [[0, 80], [0, 115]], speed: 6, kind: "key", missing: [14], spares: [{ x: -2.6, z: 99.6, slot: 14 }] },
      ],
      drums: [],
      cars: [],
      tops: [],
      cascades: [{ x0: -6, x1: -2, z0: 40, z1: 44 }],
      walls: [{ x0: -6, x1: -4, z0: 84, z1: 86 }],
      ghosts: [{ x0: -3, x1: -2.4, z0: 136, z1: 140 }],
      castles: [{ x0: -6, x1: -2.4, z0: 134, z1: 146 }],
      pencils: [{ x: 4.5, z: 89, dir: "+z" }],
      checkpoints: [{ x: 0, z: 2 }, { x: 0, z: 36 }, { x: 0, z: 78 }, { x: 0, z: 116 }],
      orbs: [
         ...line(-1.8, 4, 20, 4),
         ...line(0, 26, 32, 3, 0.9),
         ...line(2, 40, 48, 3),
         ...line(4, 66, 74, 3, 0.9),
         ...line(-4.5, 66, 74, 3, 0.9),
         ...line(1.8, 82, 100, 4),
         ...line(0, 106, 112, 3, 0.9),
         ...line(1.5, 120, 136, 3),
         ...line(-5, 85, 85.5, 2, Y, false),
         ...line(4.5, 94, 98, 2, LEDGE_Y + 0.8, false),
         ...hidden(-3.5, 120, 132, 4),
      ],
      secrets: [
         { x: -4.2, y: 1, z: 141 },
         { x: -5, y: 1, z: 84.8 },
         { x: 4.5, y: LEDGE_Y + 1, z: 99 },
      ],
      night: false,
      boss: false,
   },
   // L3: the wave starts toy race cars. Two cross the desk in front of you (dodge them); one waits on
   // a long floor track: land on its roof for a 3 s ride.
   3: {
      id: 3,
      name: "Race Track",
      timerMs: 160_000,
      starTargetMs: 90_000,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: 160 },
      plats: [
         D(0, 30),
         D(40, 80),
         D(90, 126),
         D(136, 166),
         { x0: -6, x1: -3, z0: 110, z1: 118, y: LEDGE_Y, kind: "ledge" },
      ],
      chains: [
         { pts: [[-3, 6], [-3, 18], [2, 22], [2, 41]], speed: 6, kind: "domino" },
         { pts: [[2, 44], [2, 91]], speed: 6.5, kind: "key" },
         { pts: [[-2, 94], [-2, 137]], speed: 6.5, kind: "domino", missing: [10], spares: [{ x: 0.6, z: 108, slot: 10 }] },
      ],
      drums: [],
      cars: [
         { track: [[-6.5, 56], [6.5, 56]], speed: 8, chain: 1, index: 4 },
         { track: [[6.5, 68], [-6.5, 68]], speed: 8, chain: 1, index: 12 },
         { track: [[4.5, 92], [4.5, 122]], speed: 8.5, chain: 2, index: 0 },
      ],
      tops: [],
      cascades: [{ x0: -6, x1: -1, z0: 10, z1: 14 }],
      walls: [{ x0: 4, x1: 6, z0: 140, z1: 142 }],
      ghosts: [{ x0: -3, x1: -2.4, z0: 152, z1: 156 }],
      castles: [{ x0: -6, x1: -2.4, z0: 150, z1: 162 }],
      pencils: [{ x: -4.5, z: 107, dir: "+z" }],
      checkpoints: [{ x: 0, z: 2 }, { x: 0, z: 42 }, { x: 0, z: 92 }, { x: 0, z: 138 }],
      orbs: [
         ...line(0, 4, 26, 4),
         ...line(2, 32, 38, 3, 0.9),
         ...line(-2, 46, 76, 5),
         ...line(2, 82, 88, 3, 0.9),
         ...line(4.5, 96, 120, 4, 1.8),
         ...line(-2, 128, 134, 3, 0.9),
         ...line(0, 140, 154, 3),
         ...line(5, 141, 141.5, 2, Y, false),
         ...line(-4.5, 112, 116, 2, LEDGE_Y + 0.8, false),
         ...hidden(3.5, 6, 24, 4),
      ],
      secrets: [
         { x: -4.2, y: 1, z: 157 },
         { x: 5, y: 1, z: 140.8 },
         { x: -4.5, y: LEDGE_Y + 1, z: 117 },
      ],
      night: false,
      boss: false,
   },
   // L4: lights out. Only fallen pieces glow, so you see the bridge but not the gap ahead; spinning
   // tops wander and bump you; the wave runs at 9 m/s, faster than you: stay close behind it.
   4: {
      id: 4,
      name: "Lights Out",
      timerMs: 170_000,
      starTargetMs: 105_000,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: 168 },
      plats: [
         D(0, 34),
         D(44, 84),
         D(94, 130),
         D(140, 174),
         { x0: 3, x1: 6, z0: 112, z1: 120, y: LEDGE_Y, kind: "ledge" },
      ],
      chains: [
         { pts: [[0, 24], [0, 45]], speed: 9, kind: "domino" },
         { pts: [[-3, 60], [-3, 95]], speed: 9, kind: "domino" },
         { pts: [[2, 110], [2, 141]], speed: 9, kind: "key" },
      ],
      drums: [],
      cars: [],
      tops: [
         { x: 0, z: 14, r: 4, periodMs: 5200 },
         { x: 1, z: 56, r: 3.5, periodMs: 4600 },
         { x: -1, z: 74, r: 3.5, periodMs: 5600 },
         { x: -1, z: 102, r: 4, periodMs: 5000 },
      ],
      cascades: [{ x0: 1, x1: 6, z0: 64, z1: 68 }],
      walls: [{ x0: -6, x1: -4, z0: 150, z1: 152 }],
      ghosts: [{ x0: 2.4, x1: 3, z0: 160, z1: 164 }],
      castles: [{ x0: 2.4, x1: 6, z0: 158, z1: 172 }],
      pencils: [{ x: 4.5, z: 109, dir: "+z" }],
      checkpoints: [{ x: 0, z: 2 }, { x: 0, z: 46 }, { x: 0, z: 96 }, { x: 0, z: 142 }],
      orbs: [
         ...line(-2, 4, 30, 5),
         ...line(0, 36, 42, 3, 0.9),
         ...line(1.5, 48, 80, 5),
         ...line(-3, 86, 92, 3, 0.9),
         ...line(-1.5, 98, 126, 5),
         ...line(2, 132, 138, 3, 0.9),
         ...line(-1, 146, 162, 4),
         ...line(-5, 151, 151.5, 2, Y, false),
         ...line(4.5, 114, 118, 2, LEDGE_Y + 0.8, false),
         ...hidden(-3.5, 48, 66, 4),
      ],
      secrets: [
         { x: 4.2, y: 1, z: 165 },
         { x: -5, y: 1, z: 150.8 },
         { x: 4.5, y: LEDGE_Y + 1, z: 119 },
      ],
      night: true,
      boss: false,
   },
   // L5: Jack Wobble, a frozen jack-in-the-box, in the toybox corner. Three toyboxes along the back;
   // a book chain from the middle to each box. P1: his lid rattles, he springs out: drop the book on
   // him. P2: he spits blocks that land as a new chain; push it back at him. P3: he bounces round the
   // room and crouches in front: topple the giant book-stack line onto him.
   5: {
      id: 5,
      name: "Toybox Finale",
      timerMs: 200_000,
      starTargetMs: 140_000,
      start: { x: 0, z: 2 },
      finish: { x: 0, z: 20 },
      plats: [D(0, 34, -17, 17), { x0: -17, x1: -13, z0: 6, z1: 14, y: LEDGE_Y, kind: "ledge" }],
      chains: [
         { pts: [[-4, 13], [-10, 18], [-10, 26]], speed: 6, kind: "book", rearmMs: 2500 },
         { pts: [[0, 13], [0, 27]], speed: 6, kind: "book", rearmMs: 2500 },
         { pts: [[4, 13], [10, 18], [10, 26]], speed: 6, kind: "book", rearmMs: 2500 },
         { pts: [[-14, 2], [-14, 8], [-6, 12], [0, 15.6]], speed: 7, kind: "book", rearmMs: 2500 },
      ],
      drums: [],
      cars: [],
      tops: [],
      cascades: [{ x0: 12, x1: 17, z0: 2, z1: 6 }],
      walls: [{ x0: 13, x1: 17, z0: 10, z1: 12 }],
      ghosts: [{ x0: -17, x1: -16.4, z0: 26, z1: 30 }],
      castles: [{ x0: -17, x1: -16.4, z0: 24, z1: 32 }],
      pencils: [{ x: -15, z: 3, dir: "+z" }],
      checkpoints: [{ x: 0, z: 2 }],
      orbs: [
         ...line(-6, 4, 10, 3),
         ...line(6, 4, 10, 3),
         ...line(0, 6, 9, 2),
         ...line(15, 11, 11.5, 2, Y, false),
         ...line(-15, 8, 12, 2, LEDGE_Y + 0.8, false),
         ...hidden(14, 14, 24, 3),
      ],
      secrets: [
         { x: -16.7, y: 1, z: 28 },
         { x: 15, y: 1, z: 10.8 },
         { x: -15, y: LEDGE_Y + 1, z: 13 },
      ],
      night: false,
      boss: true,
   },
};

/** Level 5: the three toyboxes (Jack springs out of one), and where he lands to crouch in phase 3. */
export const BOXES: XZ[] = [
   { x: -10, z: 28 },
   { x: 0, z: 29 },
   { x: 10, z: 28 },
];
export const LANDING: XZ = { x: 0, z: 17.6 };
