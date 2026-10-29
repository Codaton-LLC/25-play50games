// The collapsing temple (pure data, no three.js): three lanes along -z, and each level's static course
// from a hand-written script: the coin lines and arcs, the stone blocks (jump), the low beams (roll),
// Kiro's fire-jet pillars, the spike tiles (level 2+), the broken tiles (level 3+), the side-ramp
// boulders (level 4), Zuno's hidden coin veins in the walls, and the toll gates. A toll gate splits
// the path for a section: each lane behind it is its own channel (stone dividers, no lane changes),
// a toll lane (pay its price: a clean, coin-rich fast lane) or a slow lane (free: longer, with traps,
// and the boulder gains on you), with Nami's ledge coins over the slow lanes, Riko's cracked side
// walls (a free toll), Vexa's ghost gate (a hidden toll-free passage to a shard), and level 3's
// jackpot gate. Everything here is fixed per level; only the run (rules.ts) moves.
import type { LevelId } from "@/arcade3d/types";
import type { TempleLevel } from "./levels";

export const NONE = -1;
export const LANES = 3;
/** lane width (m): the lanes are centred on x = 0 */
export const LANE_W = 2.4;
/** the side walls stand this far outside the outer lanes' edges (m) */
export const HALL_MARGIN = 0.6;
export const HALF = (LANES * LANE_W) / 2 + HALL_MARGIN;

export function laneX(lane: number): number {
   return (lane - (LANES - 1) / 2) * LANE_W;
}

/** Coins: the line height, the spacing along a line, the jump arc's top, Nami's ledge coins. */
export const COIN = { y: 0.8, spacing: 1.6, arcTop: 1.9, ledgeY: 3.2, rollY: 0.45, veinInset: 0.35 } as const;

/** A lane behind a gate: 0 slow (free), 1 cheap toll, 2 dear toll, 3 the jackpot. */
export const TIER = { slow: 0, cheap: 1, dear: 2, jackpot: 3 } as const;

export interface LaneRoute {
   tier: number;
   /** the toll's price (coins; 0 for a slow lane) */
   price: number;
   /** a toll lane's run boost (m/s) while in its section */
   boost: number;
}

export interface GateDef {
   index: number;
   /** the gate's plane */
   z: number;
   /** its section ends here (z < gate z): the lanes rejoin */
   z1: number;
   lanes: LaneRoute[];
   /** Riko's cracked side wall in this (slow) lane: a dash through it is a free toll into `freeTo` */
   cracked: number;
   freeTo: number;
   /** Vexa's ghost gate in this (slow) lane: a phase through it opens the ghost passage */
   ghost: number;
   /** level 4: the price rises by 1 every 2 s of the approach spent outside a toll lane */
   surge: boolean;
}

export interface CoinDef {
   x: number;
   y: number;
   z: number;
   /** points-wise each coin counts this many coins (the jackpot room's coins count 2) */
   value: number;
   /** 0 anyone, 1 Zuno's hidden vein (the magnet), 2 the ghost passage (a phase through that gate) */
   need: number;
   /** the gate whose section holds it (NONE: the common stretch), and its lane there */
   gate: number;
   lane: number;
}

/** A relic orb (the "all orbs" star): three per level, each behind a toll lane or a hero gate. */
export interface OrbDef {
   x: number;
   y: number;
   z: number;
   gate: number;
}

/** The hazards: 0 a stone block (jump), 1 a low beam across the hall (roll), 2 a fire-jet pillar (leave the lane, or Kiro's shield), 3 a spike tile (on a 1.5 s rhythm), 4 a broken tile (falls after the rumble). */
export const HAZ = { block: 0, beam: 1, jet: 2, spike: 3, broken: 4 } as const;

export interface HazardDef {
   kind: number;
   /** NONE: across the hall (beams) */
   lane: number;
   z: number;
   /** spike tiles: the rhythm's offset (ms) */
   phase: number;
   /** the gate whose section holds it (a slow lane's trap; the ghost passage skips it), else NONE */
   gate: number;
}

/** Level 4's side-ramp boulder: it rolls out across the hall at z once the hero is `lead` m away. */
export interface CrossDef {
   z: number;
   /** the side it comes from: -1 left, +1 right */
   side: number;
}

export interface SecretSpot {
   x: number;
   y: number;
   z: number;
   /** "ghost": in the ghost passage; "jackpot": in the jackpot room; "pauper": the finish without a toll */
   need: "ghost" | "jackpot" | "pauper";
   gate: number;
}

export interface TempleDraft {
   gates: GateDef[];
   coins: CoinDef[];
   orbs: OrbDef[];
   hazards: HazardDef[];
   crosses: CrossDef[];
   secrets: Record<string, SecretSpot>;
   startZ: number;
   finishZ: number;
   /** level 5: Coilstone bursts in once the hero passes this z (NaN without a boss) */
   bossStartZ: number;
}

// ---------- the scripts ----------

/** A gate's lanes: "s" slow, "c<price>" cheap toll, "d<price>" dear toll, "j<price>" the jackpot. */
type LaneSpec = string;

interface GateSpec {
   lanes: [LaneSpec, LaneSpec, LaneSpec];
   /** the section's length (m) */
   split: number;
   /** a relic orb in this toll lane */
   relic?: number;
   cracked?: number;
   ghost?: number;
   surge?: boolean;
}

type Unit =
   | { u: "line"; lane: number; n: number; y?: number }
   | { u: "block"; lane: number; arc?: boolean }
   | { u: "wall"; open: number; arc?: boolean }
   | { u: "beam"; coins: number }
   | { u: "jet"; lane: number; n: number }
   | { u: "spike"; lane: number; n: number }
   | { u: "broken"; lanes: number[]; n: number; coinLane: number }
   | { u: "cross"; side: number }
   | { u: "vein"; side: number; n: number }
   | { u: "relic"; lane: number }
   | { u: "run"; m: number }
   | { u: "gate"; g: GateSpec };

const line = (lane: number, n: number): Unit => ({ u: "line", lane, n });
const block = (lane: number, arc = false): Unit => ({ u: "block", lane, arc });
const wall = (open: number, arc = true): Unit => ({ u: "wall", open, arc });
const beam = (coins: number): Unit => ({ u: "beam", coins });
const jet = (lane: number, n: number): Unit => ({ u: "jet", lane, n });
const spike = (lane: number, n: number): Unit => ({ u: "spike", lane, n });
const broken = (lanes: number[], coinLane: number, n: number): Unit => ({ u: "broken", lanes, n, coinLane });
const cross = (side: number): Unit => ({ u: "cross", side });
const vein = (side: number, n: number): Unit => ({ u: "vein", side, n });
const run = (m: number): Unit => ({ u: "run", m });
const gate = (g: GateSpec): Unit => ({ u: "gate", g });

/**
 * Each level's script. Level 1 teaches in the card's three beats: a coin line then a 5-coin gate you
 * can easily afford; a 15-coin gate you cannot yet afford (the slow lane, the boulder closing); a
 * rich stretch, then a gate where paying or banking is your choice.
 */
const SCRIPTS: Record<LevelId, Unit[]> = {
   1: [
      run(14),
      line(1, 8),
      { u: "relic", lane: 1 },
      block(1),
      line(0, 2),
      gate({ lanes: ["s", "c5", "s"], split: 34, relic: 1 }),
      run(6),
      jet(2, 2),
      vein(-1, 8),
      block(0),
      block(2),
      gate({ lanes: ["s", "c15", "s"], split: 34, cracked: 0, ghost: 2 }),
      run(6),
      line(1, 6),
      beam(4),
      line(0, 6),
      wall(1),
      line(2, 6),
      jet(1, 5),
      gate({ lanes: ["s", "c12", "s"], split: 36, relic: 1 }),
      run(14),
   ],
   2: [
      run(14),
      line(1, 8),
      spike(1, 5),
      line(0, 4),
      gate({ lanes: ["c6", "s", "d14"], split: 36, relic: 0 }),
      run(6),
      line(2, 6),
      jet(2, 6),
      wall(1),
      vein(1, 10),
      spike(0, 4),
      beam(4),
      gate({ lanes: ["s", "c10", "d22"], split: 38, relic: 2, ghost: 0 }),
      run(6),
      line(0, 6),
      spike(0, 4),
      block(1, true),
      line(1, 6),
      jet(1, 6),
      gate({ lanes: ["d18", "s", "c8"], split: 38, cracked: 1, relic: 2 }),
      run(6),
      line(2, 6),
      wall(2),
      vein(-1, 10),
      spike(2, 5),
      beam(3),
      gate({ lanes: ["c10", "d24", "s"], split: 38 }),
      run(14),
   ],
   3: [
      run(14),
      line(1, 8),
      broken([0, 2], 1, 5),
      line(2, 5),
      gate({ lanes: ["s", "c8", "d16"], split: 36, relic: 2 }),
      run(6),
      line(0, 6),
      broken([1], 0, 5),
      jet(0, 6),
      vein(-1, 10),
      wall(1),
      spike(1, 5),
      gate({ lanes: ["c10", "s", "j50"], split: 40, ghost: 1 }),
      run(6),
      line(1, 6),
      broken([0, 1], 2, 5),
      beam(4),
      line(2, 6),
      jet(2, 5),
      gate({ lanes: ["d20", "c10", "s"], split: 38, cracked: 2, relic: 1 }),
      run(6),
      line(0, 6),
      broken([1, 2], 0, 5),
      vein(1, 10),
      wall(0),
      spike(0, 4),
      gate({ lanes: ["s", "d24", "c12"], split: 38, relic: 1 }),
      run(14),
   ],
   4: [
      run(14),
      line(1, 8),
      cross(1),
      line(1, 5),
      gate({ lanes: ["s", "c8", "d16"], split: 38, relic: 1, surge: true }),
      run(6),
      line(0, 6),
      jet(0, 6),
      cross(-1),
      vein(1, 10),
      broken([1, 2], 0, 4),
      gate({ lanes: ["d22", "s", "c10"], split: 38, ghost: 1, surge: true }),
      run(6),
      line(2, 6),
      spike(2, 5),
      cross(1),
      beam(4),
      wall(1),
      gate({ lanes: ["c12", "d20", "s"], split: 40, cracked: 2, relic: 0, surge: true }),
      run(6),
      line(1, 6),
      cross(-1),
      vein(-1, 10),
      jet(1, 6),
      broken([0, 1], 2, 5),
      gate({ lanes: ["s", "c10", "d24"], split: 40, relic: 2, surge: true }),
      run(6),
      line(0, 6),
      cross(1),
      spike(0, 4),
      wall(2),
      gate({ lanes: ["d26", "c12", "s"], split: 40, surge: true }),
      run(14),
   ],
   5: [
      run(14),
      line(1, 8),
      jet(1, 4),
      line(0, 6),
      gate({ lanes: ["s", "c10", "d18"], split: 38, relic: 1 }),
      run(6),
      line(2, 6),
      vein(1, 10),
      beam(4),
      broken([0, 1], 2, 4),
      gate({ lanes: ["d20", "s", "c10"], split: 38, relic: 2, ghost: 1 }),
      run(6),
      line(1, 6),
      wall(1),
      line(0, 6),
      { u: "relic", lane: 0 },
      run(20),
   ],
};

// ---------- the builder ----------

/** A slow lane's content per section: blocks to jump, a few coins, Nami's ledge coins over it. */
const SLOW = { blocks: 2, coins: 2, ledge: 5 } as const;
/** A toll lane's coins per tier, and its boost (m/s). */
const TOLL_COINS = [0, 7, 12, 10] as const;
const TOLL_BOOST = [0, 1.5, 2.5, 1.5] as const;
const GHOST_COINS = 6;

function parseLane(spec: LaneSpec): LaneRoute {
   if (spec === "s") return { tier: TIER.slow, price: 0, boost: 0 };
   const tier = spec[0] === "c" ? TIER.cheap : spec[0] === "d" ? TIER.dear : TIER.jackpot;
   return { tier, price: Number(spec.slice(1)), boost: TOLL_BOOST[tier] };
}

export function buildTemple(level: TempleLevel): TempleDraft {
   const gates: GateDef[] = [];
   const coins: CoinDef[] = [];
   const orbs: OrbDef[] = [];
   const hazards: HazardDef[] = [];
   const crosses: CrossDef[] = [];
   const secrets: Record<string, SecretSpot> = {};
   const startZ = 0;
   let z = startZ;
   let spikeN = 0;
   const coin = (x: number, y: number, cz: number, g = NONE, lane = NONE, need = 0, value = 1) => coins.push({ x, y, z: cz, value, need, gate: g, lane });
   const coinLine = (lane: number, z0: number, n: number, y: number = COIN.y, g = NONE, need = 0, value = 1) => {
      for (let k = 0; k < n; k++) coin(laneX(lane), y, z0 - k * COIN.spacing, g, lane, need, value);
   };
   /** five coins arcing over a jump at zc (feet clear the block at the arc's middle) */
   const coinArc = (lane: number, zc: number, g = NONE) => {
      for (let k = -2; k <= 2; k++) coin(laneX(lane), COIN.y + (COIN.arcTop - COIN.y) * (1 - (k * k) / 6), zc - k * 1.3, g, lane);
   };
   for (const unit of SCRIPTS[level.id]) {
      switch (unit.u) {
         case "run":
            z -= unit.m;
            break;
         case "line":
            coinLine(unit.lane, z - 2, unit.n, unit.y);
            z -= unit.n * COIN.spacing + 4;
            break;
         case "relic":
            orbs.push({ x: laneX(unit.lane), y: 1.0, z: z - 2, gate: NONE });
            z -= 6;
            break;
         case "block":
            hazards.push({ kind: HAZ.block, lane: unit.lane, z: z - 5, phase: 0, gate: NONE });
            if (unit.arc) coinArc(unit.lane, z - 5);
            z -= 11;
            break;
         case "wall":
            // a row of blocks with one open lane; the coin arc over a block beside it
            for (let l = 0; l < LANES; l++) if (l !== unit.open) hazards.push({ kind: HAZ.block, lane: l, z: z - 5, phase: 0, gate: NONE });
            coinLine(unit.open, z - 2, 4);
            if (unit.arc) coinArc(unit.open === 1 ? 0 : 1, z - 5);
            z -= 12;
            break;
         case "beam":
            hazards.push({ kind: HAZ.beam, lane: NONE, z: z - 6, phase: 0, gate: NONE });
            // coins under the beam: only a roll (or a low run) picks them, in the middle lane
            for (let k = 0; k < unit.coins; k++) coin(laneX(1), COIN.rollY, z - 6 + ((unit.coins - 1) / 2 - k) * 0.9, NONE, 1);
            z -= 12;
            break;
         case "jet":
            // the pillar stands in the middle of a coin line: Kiro's shield keeps the line, the rest step out
            coinLine(unit.lane, z - 2, unit.n);
            hazards.push({ kind: HAZ.jet, lane: unit.lane, z: z - 2 - ((unit.n - 1) * COIN.spacing) / 2, phase: 0, gate: NONE });
            z -= Math.max(10, unit.n * COIN.spacing + 5);
            break;
         case "spike":
            if (level.id >= 2) {
               hazards.push({ kind: HAZ.spike, lane: unit.lane, z: z - 4, phase: (spikeN++ * 500) % 1500, gate: NONE });
               hazards.push({ kind: HAZ.spike, lane: unit.lane, z: z - 8, phase: (spikeN++ * 500) % 1500, gate: NONE });
            }
            coinLine(unit.lane, z - 2, unit.n);
            z -= Math.max(12, unit.n * COIN.spacing + 5);
            break;
         case "broken":
            for (const l of unit.lanes) {
               hazards.push({ kind: HAZ.broken, lane: l, z: z - 4, phase: 0, gate: NONE });
               hazards.push({ kind: HAZ.broken, lane: l, z: z - 8, phase: 0, gate: NONE });
            }
            coinLine(unit.coinLane, z - 2, unit.n);
            z -= Math.max(13, unit.n * COIN.spacing + 5);
            break;
         case "cross":
            if (level.id >= 4) crosses.push({ z: z - 8, side: unit.side });
            z -= 16;
            break;
         case "vein": {
            // Zuno's vein: coins inside the side wall beside the next stretch (the magnet pulls them out)
            const x = unit.side * (HALF - COIN.veinInset);
            for (let k = 0; k < unit.n; k++) coin(x, 1.3, z - 2 - k * 1.2, NONE, NONE, 1);
            break;
         }
         case "gate": {
            const spec = unit.g;
            const gz = z - 16;
            const index = gates.length;
            const lanes = spec.lanes.map(parseLane);
            const z1 = gz - spec.split;
            const cracked = spec.cracked ?? NONE;
            const ghost = spec.ghost ?? NONE;
            // Riko's free toll leads into the nearest toll lane
            let freeTo = NONE;
            if (cracked !== NONE) {
               let best = Infinity;
               for (let l = 0; l < LANES; l++) if (lanes[l].tier !== TIER.slow && Math.abs(l - cracked) < best) {
                  best = Math.abs(l - cracked);
                  freeTo = l;
               }
            }
            gates.push({ index, z: gz, z1, lanes, cracked, freeTo, ghost, surge: !!spec.surge });
            // the lead-in: a short coin line into the gate's first toll lane
            for (let l = 0; l < LANES; l++) {
               const r = lanes[l];
               const s0 = gz - 4;
               if (r.tier === TIER.slow) {
                  // slow: blocks, a few coins between them, Nami's ledge coins high over the lane
                  for (let b = 0; b < SLOW.blocks; b++) hazards.push({ kind: HAZ.block, lane: l, z: s0 - 6 - b * 12, phase: 0, gate: index });
                  if (level.id >= 2) hazards.push({ kind: HAZ.spike, lane: l, z: s0 - 12, phase: (spikeN++ * 500) % 1500, gate: index });
                  if (level.id >= 3) hazards.push({ kind: HAZ.broken, lane: l, z: s0 - 24, phase: 0, gate: index });
                  coinLine(l, s0 - 9, SLOW.coins, COIN.y, index, 0);
                  coinLine(l, s0 - 14, SLOW.ledge, COIN.ledgeY, index, 0);
                  if (l === ghost) {
                     // the ghost passage: a phase through the shimmer finds coins and a shard
                     coinLine(l, s0 - 2, GHOST_COINS, 1.2, index, 2);
                     secrets.ghost = { x: laneX(l), y: 1.4, z: s0 - 2 - GHOST_COINS * COIN.spacing - 1.5, need: "ghost", gate: index };
                  }
               } else {
                  const n = TOLL_COINS[r.tier];
                  const value = r.tier === TIER.jackpot ? 2 : 1;
                  coinLine(l, s0 - 1, n, COIN.y, index, 0, value);
                  if (r.tier === TIER.jackpot) {
                     coinLine(l, s0 - 1 - n * COIN.spacing - 1, n, 1.3, index, 0, value);
                     secrets.jackpot = { x: laneX(l), y: 1.4, z: z1 + 4, need: "jackpot", gate: index };
                  }
                  if (spec.relic === l) orbs.push({ x: laneX(l), y: 1.0, z: gz - spec.split / 2 - 2, gate: index });
               }
            }
            z = z1;
            break;
         }
      }
   }
   const finishZ = z;
   secrets.pauper = { x: 0, y: 1.2, z: finishZ, need: "pauper", gate: NONE };
   return {
      gates,
      coins,
      orbs,
      hazards,
      crosses,
      secrets,
      startZ,
      finishZ,
      bossStartZ: level.boss ? finishZ + 10 : Number.NaN,
   };
}
