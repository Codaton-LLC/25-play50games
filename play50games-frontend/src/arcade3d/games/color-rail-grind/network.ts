// The toy train line (pure data, no three.js): the workshop's rail network along -z. Four parallel rails
// (lanes 0-3; lane 4 is level 2's golden-caboose spur beyond lane 3), each a list of rail pieces with
// their ends (an open end, a gap to jump, a buffer stop, a merge back into a neighbour), the junctions
// (a switch that sends a hero, or a toy train, from its rail onto a branch), the branches (they curve
// away from the grid, so a hop cannot reach them: only a switch can), Nami's high rails, Zuno's loop,
// Riko's long broken gap and the cracked barrier of a side spur, Vexa's ghost door, Kiro's icicle
// tunnels, the grind rings, the orbs, the downhill stretches (crouch) and level 4's toy trains, built
// from each level's hand-written script. Fixed per level; only the run (rules.ts) moves.
import type { LevelId } from "@/arcade3d/types";
import type { RailLevel } from "./levels";

export const NONE = -1;
/** the grid's rails (lane 4 is the caboose spur's) */
export const LANES = 5;
export const GRID = 4;
/** rail spacing (m): the grid is centred on x = 0 */
export const LANE_W = 2.8;
/** a branch curves this far out of its lane, over BEND m */
export const BRANCH_OUT = 3.2;
export const BEND = 9;
/** Nami's high rails: their top over the low rails (m) */
export const HIGH_Y = 2.6;
/** the grid's half width with the margin (the camera's and the decor's) */
export const HALF = (GRID * LANE_W) / 2 + 1.2;

export function laneX(lane: number): number {
   return (lane - 1.5) * LANE_W;
}

/** A rail piece's end: open (the course goes on), a gap to jump, a buffer stop, a merge into `mergeTo`. */
export const END = { open: 0, gap: 1, buffer: 2, merge: 3 } as const;

/** What a branch is for: 0 an orb branch (merges back), 1 a dead end (buffer stop), 2 a shortcut (faster), 3 Riko's barrier spur, 4 Vexa's ghost spur, 5 the caboose spur. */
export const BRANCH = { orb: 0, dead: 1, fast: 2, barrier: 3, ghost: 4, caboose: 5 } as const;

export interface Piece {
   index: number;
   lane: number;
   /** from z0 down to z1 (z0 > z1) */
   z0: number;
   z1: number;
   /** 1: Nami's high rail (HIGH_Y up) */
   tier: number;
   /** a branch curves out to this side (-1 / +1; 0 a grid rail) and cannot be hopped onto or off */
   side: number;
   branch: number;
   end: number;
   mergeTo: number;
   /** level 3: frozen rails (20 % faster, no crouch) */
   frozen: boolean;
   /** a run boost on this piece (m/s): a shortcut branch, the high rails */
   boost: number;
}

export interface Junction {
   index: number;
   z: number;
   /** from this rail onto `to` when thrown */
   lane: number;
   to: number;
   /** level 3: a frozen switch: only a jump-stomp throws it */
   frozen: boolean;
   /** the branch piece it opens */
   piece: number;
}

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   lane: number;
   /** the piece it sits over (NONE: the grid rail at that z) */
   piece: number;
   /** "main" counts for the "all orbs" star; "bonus" orbs sit behind a hero gate or a dead end */
   kind: "main" | "bonus";
   /** Zuno's coin trail in a snowbank: only under the magnet */
   hidden: boolean;
}

/** A grind ring standing on a rail (grind or jump through it). */
export interface RingDef {
   lane: number;
   z: number;
}

/** Hazards on a lane: 0 Kiro's icicle tunnel (z0..z1), 1 Riko's cracked barrier, 2 Vexa's ghost door (at z0). */
export const HAZ = { icicles: 0, barrier: 1, ghost: 2 } as const;

export interface HazardDef {
   kind: number;
   lane: number;
   z0: number;
   z1: number;
   piece: number;
}

/** Zuno's loop: the magnet grips him round it (a boost and a shard). */
export interface LoopDef {
   lane: number;
   z0: number;
   z1: number;
}

/** A downhill stretch: crouch for +3 m/s (not on frozen rails). */
export interface SlopeDef {
   z0: number;
   z1: number;
}

/** Level 4: a toy train on a rail, starting at z and driving down the line at `speed`. */
export interface TrainDef {
   lane: number;
   z: number;
   speed: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
   /** what opens it: a piece reached (the hidden spur, the caboose spur) or Zuno's loop */
   need: "piece" | "loop";
   piece: number;
}

export interface NetDraft {
   pieces: Piece[];
   junctions: Junction[];
   orbs: OrbDef[];
   rings: RingDef[];
   hazards: HazardDef[];
   loops: LoopDef[];
   slopes: SlopeDef[];
   trains: TrainDef[];
   secrets: Record<string, SecretSpot>;
   startZ: number;
   finishZ: number;
   /** level 5: the Clockwork Express shows up once the hero passes this z (NaN without a boss) */
   bossStartZ: number;
}

// ---------- the scripts ----------

type Unit =
   | { u: "run"; m: number }
   | { u: "grid"; lanes: number[] }
   | { u: "orbs"; lane: number; n: number; y?: number }
   | { u: "rings"; lanes: number[]; n: number }
   | { u: "gap"; lanes: number[]; len: number }
   | { u: "branch"; from: number; kind: number; len: number; orbs: number; frozen?: boolean }
   | { u: "caboose" }
   | { u: "high"; lane: number; len: number; orbs: number }
   | { u: "loop"; lane: number }
   | { u: "longgap"; lane: number }
   | { u: "icicles"; lane: number; len: number; orbs: number }
   | { u: "slope"; len: number }
   | { u: "train"; lane: number; ahead: number; speed: number }
   | { u: "trail"; side: number; n: number };

const run = (m: number): Unit => ({ u: "run", m });
const grid = (...lanes: number[]): Unit => ({ u: "grid", lanes });
const orbs = (lane: number, n: number, y?: number): Unit => ({ u: "orbs", lane, n, y });
const rings = (lanes: number[], n: number): Unit => ({ u: "rings", lanes, n });
const gap = (len: number, lanes = [1, 2]): Unit => ({ u: "gap", lanes, len });
const branch = (from: number, kind: number, len: number, n = 0, frozen = false): Unit => ({ u: "branch", from, kind, len, orbs: n, frozen });
const high = (lane: number, len: number, n: number): Unit => ({ u: "high", lane, len, orbs: n });
const loop = (lane: number): Unit => ({ u: "loop", lane });
const longgap = (lane: number): Unit => ({ u: "longgap", lane });
const icicles = (lane: number, len: number, n: number): Unit => ({ u: "icicles", lane, len, orbs: n });
const slope = (len: number): Unit => ({ u: "slope", len });
const train = (lane: number, ahead: number, speed: number): Unit => ({ u: "train", lane, ahead, speed });
const trail = (side: number, n: number): Unit => ({ u: "trail", side, n });

/**
 * Each level's script. Level 1 teaches in the card's three beats: grind and hop between two parallel
 * rails for the rings; a first switch (one tap: the orb branch; no tap: the plain line, both safe); a
 * grind-ring jump over a gap.
 */
const SCRIPTS: Record<LevelId, Unit[]> = {
   1: [
      grid(1, 2),
      run(20),
      orbs(1, 5),
      rings([2], 4),
      orbs(1, 4),
      run(20),
      branch(1, BRANCH.orb, 70, 8),
      run(20),
      trail(1, 8),
      rings([1, 2], 2),
      gap(4.5),
      orbs(2, 4),
      run(15),
      slope(60),
      orbs(1, 4),
      high(2, 60, 5),
      run(10),
      icicles(1, 40, 4),
      run(15),
      branch(2, BRANCH.ghost, 60, 4),
      run(15),
      loop(1),
      run(20),
   ],
   2: [
      grid(1, 2),
      run(20),
      orbs(1, 5),
      branch(1, BRANCH.dead, 50, 3),
      orbs(2, 5),
      run(15),
      branch(2, BRANCH.orb, 70, 8),
      run(10),
      rings([1, 2], 3),
      gap(5),
      trail(-1, 10),
      orbs(1, 4),
      run(10),
      caboose(),
      run(10),
      slope(70),
      orbs(2, 2),
      branch(1, BRANCH.barrier, 60, 4),
      run(10),
      icicles(2, 45, 4),
      branch(1, BRANCH.dead, 50, 3),
      run(10),
      high(1, 70, 5),
      run(10),
      branch(2, BRANCH.ghost, 60, 4),
      run(10),
      loop(2),
      run(20),
   ],
   3: [
      grid(1, 2),
      run(20),
      orbs(1, 5),
      branch(2, BRANCH.orb, 70, 8, true),
      run(10),
      rings([1, 2], 3),
      gap(5.5),
      orbs(2, 5),
      grid(0, 1, 2),
      longgap(0),
      grid(1, 2),
      run(10),
      branch(1, BRANCH.dead, 50, 3, true),
      orbs(2, 4),
      trail(1, 10),
      run(10),
      branch(1, BRANCH.fast, 80, 6, true),
      run(10),
      icicles(2, 50, 4),
      orbs(1, 3),
      high(2, 70, 5),
      run(10),
      branch(2, BRANCH.ghost, 60, 4, true),
      run(10),
      orbs(1, 4),
      rings([1, 2], 3),
      gap(5.5),
      loop(1),
      run(20),
   ],
   4: [
      grid(1, 2),
      run(20),
      orbs(1, 5),
      train(1, 70, 9),
      run(10),
      branch(1, BRANCH.dead, 60, 3),
      orbs(2, 6),
      run(20),
      train(2, 70, 9),
      branch(2, BRANCH.orb, 70, 8),
      run(10),
      rings([1, 2], 3),
      gap(5.5),
      orbs(1, 6),
      trail(-1, 10),
      run(10),
      train(1, 80, 8),
      branch(1, BRANCH.dead, 60, 3),
      orbs(2, 5),
      slope(60),
      run(10),
      grid(0, 1, 2),
      longgap(0),
      grid(1, 2),
      branch(1, BRANCH.barrier, 60, 4),
      run(10),
      high(2, 70, 5),
      icicles(1, 50, 5),
      run(10),
      train(2, 70, 9),
      branch(2, BRANCH.fast, 80, 5),
      run(50),
      branch(2, BRANCH.ghost, 60, 4),
      run(10),
      orbs(1, 5),
      loop(1),
      run(20),
   ],
   5: [
      grid(1, 2),
      run(20),
      orbs(1, 5),
      branch(1, BRANCH.orb, 70, 8),
      run(10),
      rings([1, 2], 3),
      gap(6),
      orbs(2, 6),
      trail(1, 10),
      run(10),
      branch(2, BRANCH.ghost, 60, 4),
      high(1, 60, 5),
      run(10),
      icicles(2, 40, 4),
      orbs(1, 6),
      grid(0, 1, 2),
      longgap(0),
      grid(1, 2),
      loop(2),
      orbs(2, 5),
      orbs(1, 5),
      run(20),
   ],
};

function caboose(): Unit {
   return { u: "caboose" };
}

// ---------- the builder ----------

const ORB_STEP = 2.2;
const RING_STEP = 6;

export function buildNetwork(level: RailLevel): NetDraft {
   const pieces: Piece[] = [];
   const junctions: Junction[] = [];
   const orbsOut: OrbDef[] = [];
   const ringsOut: RingDef[] = [];
   const hazards: HazardDef[] = [];
   const loops: LoopDef[] = [];
   const slopes: SlopeDef[] = [];
   const trains: TrainDef[] = [];
   const secrets: Record<string, SecretSpot> = {};
   const frozenLevel = level.id === 3;
   const startZ = 0;
   let z = startZ;
   // the grid rails open right now: their piece's start z (NaN: closed)
   const open: number[] = new Array(GRID).fill(Number.NaN);
   const openPiece = (lane: number, from: number) => {
      open[lane] = from;
   };
   const closePiece = (lane: number, at: number, end: number, mergeTo = NONE) => {
      if (Number.isNaN(open[lane])) return NONE;
      const index = pieces.length;
      pieces.push({ index, lane, z0: open[lane], z1: at, tier: 0, side: 0, branch: NONE, end, mergeTo, frozen: frozenLevel, boost: 0 });
      open[lane] = Number.NaN;
      return index;
   };
   const addPiece = (p: Omit<Piece, "index">) => {
      const index = pieces.length;
      pieces.push({ ...p, index });
      return index;
   };
   const orbLine = (lane: number, from: number, n: number, y = 1.0, kind: "main" | "bonus" = "main", piece = NONE, x = laneX(lane), hidden = false) => {
      for (let k = 0; k < n; k++) orbsOut.push({ x, y, z: from - k * ORB_STEP, lane, piece, kind, hidden });
   };
   let mainOrbs = 0;
   for (const unit of SCRIPTS[level.id]) {
      switch (unit.u) {
         case "run":
            z -= unit.m;
            break;
         case "grid":
            for (let l = 0; l < GRID; l++) {
               const want = unit.lanes.includes(l);
               if (want && Number.isNaN(open[l])) openPiece(l, z);
               // a side rail that stops curves into its neighbour (a merge), never a bare end
               if (!want && !Number.isNaN(open[l])) closePiece(l, z, END.merge, l <= 1 ? 1 : 2);
            }
            break;
         case "orbs":
            orbLine(unit.lane, z - 2, unit.n, unit.y ?? 1.0);
            mainOrbs += unit.n;
            z -= unit.n * ORB_STEP + 9;
            break;
         case "rings":
            for (let k = 0; k < unit.n; k++) for (const l of unit.lanes) ringsOut.push({ lane: l, z: z - 4 - k * RING_STEP });
            z -= unit.n * RING_STEP + 4;
            break;
         case "gap": {
            // a ring over the gap's middle on each lane: jump through it
            for (const l of unit.lanes) closePiece(l, z, END.gap);
            for (const l of unit.lanes) ringsOut.push({ lane: l, z: z - unit.len / 2 });
            z -= unit.len;
            for (const l of unit.lanes) openPiece(l, z);
            z -= 4;
            break;
         }
         case "branch": {
            // a switch on lane `from` sends the hero out onto a branch curving away to the side
            const side = unit.from <= 1 ? -1 : 1;
            const to = unit.from <= 1 ? 0 : 3;
            z -= 12;
            const kind = unit.kind;
            const dead = kind === BRANCH.dead;
            const piece = addPiece({
               lane: to,
               z0: z,
               z1: z - unit.len,
               tier: 0,
               side,
               branch: kind,
               end: dead ? END.buffer : END.merge,
               mergeTo: dead ? NONE : unit.from,
               frozen: frozenLevel,
               boost: kind === BRANCH.fast ? 3 : 0,
            });
            junctions.push({ index: junctions.length, z, lane: unit.from, to, frozen: !!unit.frozen, piece });
            const bx = laneX(to) + side * BRANCH_OUT;
            const main = kind === BRANCH.orb || kind === BRANCH.fast;
            if (unit.orbs > 0) orbLine(to, z - BEND - 4, unit.orbs, 1.0, main ? "main" : "bonus", piece, bx);
            if (main) mainOrbs += unit.orbs;
            if (kind === BRANCH.barrier) hazards.push({ kind: HAZ.barrier, lane: to, z0: z - 3, z1: z - 3, piece });
            if (kind === BRANCH.ghost) {
               hazards.push({ kind: HAZ.ghost, lane: to, z0: z - 3, z1: z - 3, piece });
               secrets.hidden = { x: bx, y: 1.4, z: z - unit.len + BEND + 4, need: "piece", piece };
            }
            if (kind === BRANCH.barrier && !secrets.spur) secrets.spur = { x: bx, y: 1.4, z: z - unit.len + BEND + 4, need: "piece", piece };
            // a branch with main orbs: the script goes on after it (no main orb ever sits beside a branch
            // that has main orbs too: "all orbs" stays one route); a bonus branch: the grid goes on beside it
            z -= main ? unit.len + 6 : unit.len * 0.35;
            break;
         }
         case "caboose": {
            // two switches in a 1 s window: lane 2 onto branch 3, then at once onto the caboose spur (lane 4)
            z -= 12;
            const len = 70;
            const p3 = addPiece({ lane: 3, z0: z, z1: z - len, tier: 0, side: 1, branch: BRANCH.orb, end: END.merge, mergeTo: 2, frozen: false, boost: 0 });
            junctions.push({ index: junctions.length, z, lane: 2, to: 3, frozen: false, piece: p3 });
            orbLine(3, z - BEND - 4, 6, 1.0, "main", p3, laneX(3) + BRANCH_OUT);
            mainOrbs += 6;
            const z2 = z - 1.0 * level.speed;
            const p4 = addPiece({ lane: 4, z0: z2, z1: z2 - 40, tier: 0, side: 1, branch: BRANCH.caboose, end: END.merge, mergeTo: 3, frozen: false, boost: 0 });
            junctions.push({ index: junctions.length, z: z2, lane: 3, to: 4, frozen: false, piece: p4 });
            secrets.caboose = { x: laneX(4) + BRANCH_OUT, y: 1.4, z: z2 - 24, need: "piece", piece: p4 };
            orbLine(4, z2 - 12, 4, 1.0, "bonus", p4, laneX(4) + BRANCH_OUT);
            z -= len + 6;
            break;
         }
         case "high": {
            // Nami's high rail over a grid lane: double jump up onto it (faster, with orbs)
            const piece = addPiece({ lane: unit.lane, z0: z - 4, z1: z - 4 - unit.len, tier: 1, side: 0, branch: NONE, end: END.open, mergeTo: NONE, frozen: frozenLevel, boost: 3 });
            orbLine(unit.lane, z - 10, unit.orbs, HIGH_Y + 1.0, "bonus", piece);
            z -= unit.len + 8;
            break;
         }
         case "loop": {
            // Zuno's loop over a grid lane: his magnet grips him round it (a boost and a shard)
            loops.push({ lane: unit.lane, z0: z - 6, z1: z - 36 });
            if (!secrets.loop) secrets.loop = { x: laneX(unit.lane), y: 6, z: z - 21, need: "loop", piece: NONE };
            z -= 40;
            break;
         }
         case "longgap": {
            // Riko's broken rail: an 11 m gap on a side lane, too long for a jump; a dash in the air clears it
            const lane = unit.lane;
            z -= 6;
            const piece = closePiece(lane, z, END.gap);
            ringsOut.push({ lane, z: z - 5.5 });
            z -= 11;
            openPiece(lane, z);
            orbLine(lane, z - 3, 5, 1.0, "bonus", NONE);
            z -= 18;
            void piece;
            break;
         }
         case "icicles": {
            // Kiro's icicle tunnel on a grid lane, with an orb line through it
            hazards.push({ kind: HAZ.icicles, lane: unit.lane, z0: z - 2, z1: z - 2 - unit.len, piece: NONE });
            orbLine(unit.lane, z - 6, unit.orbs, 1.0, "bonus");
            z -= unit.len + 6;
            break;
         }
         case "slope":
            if (!frozenLevel) slopes.push({ z0: z, z1: z - unit.len });
            z -= unit.len;
            break;
         case "train":
            trains.push({ lane: unit.lane, z: z - unit.ahead, speed: unit.speed });
            break;
         case "trail": {
            // Zuno's coin trail in the snowbank beside the rails
            const x = unit.side * (HALF + 0.6);
            for (let k = 0; k < unit.n; k++) orbsOut.push({ x, y: 0.8, z: z - 2 - k * 1.8, lane: NONE, piece: NONE, kind: "bonus", hidden: true });
            break;
         }
      }
   }
   z -= 10;
   const finishZ = z;
   // level 5: the arena's rails run on past the static finish, as long as the Express is up
   const tail = level.boss ? finishZ - 20_000 : finishZ - 40;
   for (let l = 0; l < GRID; l++) {
      if (level.boss && Number.isNaN(open[l])) openPiece(l, finishZ + 30);
      closePiece(l, tail, END.open);
   }
   if (mainOrbs !== level.orbs) throw new Error(`color-rail-grind L${level.id}: ${mainOrbs} main orbs, the card says ${level.orbs}`);
   return {
      pieces,
      junctions: junctions.sort((a, b) => b.z - a.z).map((j, i) => ({ ...j, index: i })),
      orbs: orbsOut,
      rings: ringsOut,
      hazards,
      loops,
      slopes,
      trains,
      secrets,
      startZ,
      finishZ,
      bossStartZ: level.boss ? finishZ + 30 : Number.NaN,
   };
}

/** A branch piece's sideways bend at z (0 on the grid; out to BRANCH_OUT over BEND m, and back before a merge). */
export function bendOf(p: Piece, z: number): number {
   if (p.side === 0) return 0;
   const s = (k: number) => {
      const t = Math.max(0, Math.min(1, k));
      return t * t * (3 - 2 * t);
   };
   let out = s((p.z0 - z) / BEND);
   if (p.end === END.merge) out = Math.min(out, s((z - p.z1) / BEND));
   return p.side * BRANCH_OUT * out;
}

/** A rail's x at z on its piece. */
export function railX(p: Piece, z: number): number {
   return laneX(p.lane) + bendOf(p, z);
}
