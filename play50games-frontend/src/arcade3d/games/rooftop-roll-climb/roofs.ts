// The generated zigzag skylines for all five levels (levels.ts specs). Pure, no Math.random: a level
// is the same race for every seed (a time leaderboard).
//
// A block is: a landing deck, a fire-escape climb towards -z (steps that each rise stepRise, well under
// the jump apex), a top deck, and a slanted tin roof that falls away along x (dir) to a lip over the
// street. The next block's deck sits across the street, a little above the lip, and faces back the
// other way: the switchback. A plain run-and-jump does not clear the street; a ball that rolled down
// the slope does (rules.ts "slope momentum").
//
// Supports come in route order (the bot follows it); extras that are not on the route (the L1 catch
// roof, water-tower ledges) come after the goal and the arena.
import type { RoofLevel, RoofSpec } from "./levels";
import { SECRETS, type SecretSpot } from "./progression";

export interface RoofMover {
   axis: "x" | "z";
   travel: number;
   periodMs: number;
   phase: number;
}

/** The roof is absent while the cycle fraction is below `gone`. Checkpoints and the goal never vanish. */
export interface RoofVanish {
   periodMs: number;
   gone: number;
   phase: number;
}

/** A slanted roof: the surface falls along x towards `dir`, `grade` metres per metre, from `top` at its high edge. */
export interface RoofSlope {
   dir: 1 | -1;
   grade: number;
   /** a curled ball's downhill acceleration (m/s²); rain-wet tin already includes its 1.5x */
   accel: number;
   /** rain-wet tin: you cannot uncurl and brake on it */
   wet: boolean;
}

export type RoofKind = "start" | "roof" | "moving" | "checkpoint" | "goal";

/** What a support is in the city (drawing and the bot; the rules only read the geometry). */
export type RoofRole = "deck" | "step" | "top" | "slope" | "street" | "chimney" | "helipad" | "ramp" | "arenaDeck" | "catch" | "ledge";

export interface RoofSupport {
   kind: RoofKind;
   role: RoofRole;
   /** the block it belongs to (-1 for the finale) */
   block: number;
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   /** the highest point of the top (a slope's high edge) */
   top: number;
   mover: RoofMover | null;
   /** a vertical launch (m/s) when stood on (a chimney updraft); 0 = none */
   launch: number;
   vanish: RoofVanish | null;
   slippery: boolean;
   slope: RoofSlope | null;
   /** part of the L5 boss arena (the boss wakes on the first stand on any of these) */
   arena: boolean;
   /** a slope you may land on and keep your roll (the L1 chained slope, the arena ramps); elsewhere a landing thumps to running speed */
   keep: boolean;
}

export interface RoofOrb {
   x: number;
   y: number;
   z: number;
}

/** A spark arc. On a slope it crosses the roll line; `air` arcs (the Kiro secret) also zap a hero in flight. */
export interface RoofStrike {
   support: number;
   ox: number;
   oz: number;
   radius: number;
   periodMs: number;
   /** live while the cycle fraction is below this (1 = always) */
   duty: number;
   phase: number;
   /** zaps inside its column (2.6 m tall) in the air too */
   air: boolean;
}

/** A box on a deck you cannot stand on: a cracked skylight (Riko's dash smashes it) or a ghost billboard (Vexa phases through). */
export interface RoofBlock {
   kind: "crack" | "ghost";
   cx: number;
   cz: number;
   hw: number;
   hd: number;
   y0: number;
   y1: number;
}

/** A secret's spot and its gate (the rules collect a gated one only when its gate is open). */
export interface RoofSecret {
   x: number;
   y: number;
   z: number;
   gate: "none" | "crack" | "ghost" | "arc";
   /** the block (index into blocks) for crack and ghost gates, -1 otherwise */
   box: number;
}

/** The boss arena (L5): the ramps' feet on the pad, where Ashback stands when he is open. */
export interface RoofArena {
   /** support indices: entry deck, ramp A, pad, ramp B, far deck */
   entry: number;
   rampA: number;
   pad: number;
   rampB: number;
   far: number;
   /** the x of the pad's two feet spots (A side, B side), their z and height */
   footA: number;
   footB: number;
   z: number;
   y: number;
   /** the direction from the A side to the B side along x */
   dir: 1 | -1;
}

export interface RoofDraft {
   supports: RoofSupport[];
   orbs: RoofOrb[];
   strikes: RoofStrike[];
   blocks: RoofBlock[];
   secrets: RoofSecret[];
   arena: RoofArena | null;
   goalTop: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Clearance between climb steps along z (m). */
const STEP_GAP = 2.6;
/** The top deck (the slope's run-up) and the slope are this deep (z). */
const SLOPE_D = 4;
/** A street with a mid-street mover: the mover's centre past the lip, and the jump on to the next deck. */
const MOVER_AT = 6.8;
const MOVER_TO_DECK = 3.4;
/** The water-tower ledge: this far past its deck's edge (a plain run-and-jump reaches about 6.4 m). */
export const LEDGE_GAP = 8;

function flat(kind: RoofKind, role: RoofRole, block: number, cx: number, cz: number, hw: number, hd: number, top: number): RoofSupport {
   return { kind, role, block, cx: round2(cx), cz: round2(cz), hw, hd, top: round2(top), mover: null, launch: 0, vanish: null, slippery: false, slope: null, arena: false, keep: false };
}

/** The height of a slope's surface at x (clamped to its rectangle); a flat support's top. */
export function draftSurfaceY(s: Pick<RoofSupport, "cx" | "hw" | "top" | "slope">, x: number): number {
   const sl = s.slope;
   if (!sl) return s.top;
   const high = s.cx - sl.dir * s.hw;
   const d = Math.max(0, Math.min(2 * s.hw, (x - high) * sl.dir));
   return s.top - sl.grade * d;
}

/** A slope's lip (its low edge) x and height. */
export function lipOf(s: RoofSupport): { x: number; y: number } {
   const sl = s.slope!;
   return { x: s.cx + sl.dir * s.hw, y: s.top - sl.grade * 2 * s.hw };
}

/** Is street j (after block j) one with a mid-street mover? */
export function moverStreet(spec: RoofSpec, j: number): boolean {
   return spec.streetEvery > 0 && (j + 1) % spec.streetEvery === 0;
}

export function buildRoofs(level: RoofLevel): RoofDraft {
   const spec = level.spec;
   const supports: RoofSupport[] = [];
   const extras: RoofSupport[] = [];
   const orbs: RoofOrb[] = [];
   const strikes: RoofStrike[] = [];
   const blocks: RoofBlock[] = [];
   const secretIds = SECRETS[level.id].map((s) => s.id as SecretSpot);
   const secretAt = new Map<SecretSpot, RoofSecret>();
   const deckOf: number[] = [];
   const slopeOf: number[] = [];

   // block 0's deck is the start
   let xD = 0;
   let zD = 0;
   let Y = 0;
   let deck = flat("start", "deck", 0, xD, zD, spec.deckW / 2 + 0.6, spec.deckD / 2 + 0.4, 0);
   let lastLip = { x: 0, y: 0 };
   let lastDir: 1 | -1 = 1;
   for (let i = 0; i < spec.blocks; i++) {
      const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
      deckOf.push(supports.length);
      supports.push(deck);
      // a chimney updraft beside the climb (route order: right after the deck): from the deck onto its cap, then the hot air lifts you to the top deck
      if (spec.chimneyEvery > 0 && i > 0 && i % spec.chimneyEvery === 0) {
         const cz = zD - deck.hd - 1.6 - 0.8;
         const ch = flat("roof", "chimney", i, xD - dir * (spec.stepW / 2 + 0.3 + 0.8), cz, 0.8, 0.8, Y + 1.0);
         ch.launch = V_UPDRAFT;
         supports.push(ch);
      }
      // the climb: steps towards -z, each stepRise up; the last is the top deck (the slope's run-up)
      let z = zD;
      let prevHd = deck.hd;
      for (let k = 1; k <= spec.steps; k++) {
         const last = k === spec.steps;
         const hd = last ? SLOPE_D / 2 : spec.stepD / 2;
         const hw = spec.stepW / 2;
         z -= prevHd + STEP_GAP + hd;
         supports.push(flat("roof", last ? "top" : "step", i, xD, z, hw, hd, Y + k * spec.stepRise));
         prevHd = hd;
      }
      const top = supports[supports.length - 1];
      // the slanted roof, falling along x towards dir from the top deck's edge
      const hw = spec.slopeLen / 2;
      const wet = spec.wetEvery > 0 && i > 0 && i % spec.wetEvery === 0;
      const slope = flat("roof", "slope", i, top.cx + dir * (top.hw + hw), top.cz, hw, SLOPE_D / 2, top.top);
      slope.slope = { dir, grade: spec.grade, accel: round2(spec.accel * (wet ? 1.5 : 1)), wet };
      slopeOf.push(supports.length);
      supports.push(slope);
      const lip = lipOf(slope);
      lastLip = lip;
      lastDir = dir;
      // a coin on the roll line, halfway down
      orbs.push({ x: slope.cx, y: round2(draftSurfaceY(slope, slope.cx) + 0.65), z: slope.cz });
      // a spark arc across the roll line
      if (spec.sparkEvery > 0 && i % spec.sparkEvery === spec.sparkEvery - 1) {
         strikes.push({ support: supports.length - 1, ox: round2(dir * hw * 0.25), oz: 0, radius: 0.8, periodMs: 2800, duty: 0.3, phase: round2((i % 4) * 0.21), air: false });
      }
      if (i === spec.blocks - 1) break;
      // the street, and the next block's deck across it
      const deckW = spec.deckW / 2;
      const deckD = spec.deckD / 2;
      let nextX: number;
      if (moverStreet(spec, i)) {
         const crane = spec.street === "crane";
         const mhw = crane ? 1.7 : 1.3;
         const mhd = crane ? 1.5 : 1.2;
         const m = flat("moving", "street", i, lip.x + dir * MOVER_AT, slope.cz, mhw, mhd, lip.y - 0.4);
         m.mover = { axis: "z", travel: crane ? 2.8 : 2.2, periodMs: crane ? 3200 : 2400, phase: round2((i % 3) * 0.29) };
         supports.push(m);
         nextX = m.cx + dir * (mhw + MOVER_TO_DECK + deckW);
      } else {
         nextX = lip.x + dir * (spec.gap + deckW);
         // a coin over every other street, on a rolled leap's line
         if (i % 2 === 1) orbs.push({ x: round2(lip.x + dir * 2.6), y: round2(lip.y + 3.1), z: slope.cz });
         if (spec.catchRoof && i === 0) {
            // L1: a low roof under the first street catches a short leap; you jump back up onto the slope's foot
            const c = flat("roof", "catch", i, lip.x + dir * 2.9, slope.cz, 2.5, 2.6, lip.y - 2.6);
            extras.push(c);
         }
      }
      const nextIndex = i + 1;
      const checkpoint = spec.checkpointEvery > 0 && nextIndex % spec.checkpointEvery === 0;
      Y = round2(lip.y + spec.leapRise);
      xD = round2(nextX);
      zD = slope.cz;
      deck = flat(checkpoint ? "checkpoint" : "roof", "deck", nextIndex, xD, zD, deckW, deckD, Y);
      if (!checkpoint && spec.blinkEvery > 0 && nextIndex % spec.blinkEvery === 0) deck.vanish = { periodMs: 2800, gone: 0.28, phase: (nextIndex % 2) * 0.5 };
      else if (!checkpoint && spec.slipEvery > 0 && nextIndex % spec.slipEvery === 0) deck.slippery = true;
   }

   // the finale: a chained slope then the helipad (L1), the arena (L5), or a straight leap to the helipad
   const dir = lastDir;
   let arena: RoofArena | null = null;
   let goalTop: number;
   if (spec.chain) {
      // just past the lip and 0.7 m under it: rolling off the lip, even at running speed, drops onto it
      // curled; long enough that a jump off the lip (slow or at full speed) lands on it too
      const hw = 5;
      const c = flat("roof", "slope", -1, lastLip.x + dir * (1.2 + hw), supports[slopeOf[slopeOf.length - 1]].cz, hw, SLOPE_D / 2, lastLip.y - 0.7);
      c.slope = { dir, grade: spec.grade, accel: spec.accel, wet: false };
      c.keep = true;
      slopeOf.push(supports.length);
      supports.push(c);
      const cl = lipOf(c);
      orbs.push({ x: c.cx, y: round2(draftSurfaceY(c, c.cx) + 0.65), z: c.cz });
      goalTop = round2(cl.y + 0.8);
      supports.push(flat("goal", "helipad", -1, cl.x + dir * (5 + 4), c.cz, 4, 3.5, goalTop));
   } else if (spec.arena) {
      const z = supports[slopeOf[slopeOf.length - 1]].cz;
      const H = round2(lastLip.y + spec.leapRise);
      const e = flat("checkpoint", "arenaDeck", -1, lastLip.x + dir * (spec.gap + 2.5), z, 2.5, 3.5, H);
      const rampHw = 4;
      const grade = 0.36;
      const a = flat("roof", "ramp", -1, e.cx + dir * (e.hw + rampHw), z, rampHw, 3.5, H);
      a.slope = { dir, grade, accel: 8, wet: false };
      const padY = round2(H - grade * 2 * rampHw);
      const pad = flat("goal", "helipad", -1, a.cx + dir * (rampHw + 4.5), z, 4.5, 3.5, padY);
      const b = flat("roof", "ramp", -1, pad.cx + dir * (4.5 + rampHw), z, rampHw, 3.5, H);
      b.slope = { dir: (dir === 1 ? -1 : 1) as 1 | -1, grade, accel: 8, wet: false };
      const f = flat("roof", "arenaDeck", -1, b.cx + dir * (rampHw + 2.5), z, 2.5, 3.5, H);
      const list = [e, a, pad, b, f];
      for (const s of list) s.arena = true;
      a.keep = true;
      b.keep = true;
      const base = supports.length;
      supports.push(...list);
      arena = {
         entry: base,
         rampA: base + 1,
         pad: base + 2,
         rampB: base + 3,
         far: base + 4,
         footA: round2(pad.cx - dir * (pad.hw - 1.0)),
         footB: round2(pad.cx + dir * (pad.hw - 1.0)),
         z,
         y: padY,
         dir,
      };
      orbs.push({ x: a.cx, y: round2(draftSurfaceY(a, a.cx) + 0.65), z: z + 1.6 });
      orbs.push({ x: b.cx, y: round2(draftSurfaceY(b, b.cx) + 0.65), z: z - 1.6 });
      goalTop = padY;
   } else {
      goalTop = round2(lastLip.y + spec.leapRise);
      supports.push(flat("goal", "helipad", -1, lastLip.x + dir * (spec.gap + 4), supports[slopeOf[slopeOf.length - 1]].cz, 4, 3.5, goalTop));
   }

   // secrets, each off the main line on its own block
   const deckFor = (b: number) => supports[deckOf[Math.min(deckOf.length - 1, Math.max(1, b))]];
   const slopeFor = (b: number) => supports[slopeOf[Math.min(slopeOf.length - 1, Math.max(0, b))]];
   const blockDir = (s: RoofSupport): 1 | -1 => (s.block % 2 === 0 ? 1 : -1);
   for (const id of secretIds) {
      if (id === "tower") {
         // past the deck's far side (the direction you arrived in), at deck height
         const d = deckFor(1);
         const away = -blockDir(d);
         const ledge = flat("roof", "ledge", d.block, d.cx + away * (d.hw + LEDGE_GAP + 1.3), d.cz, 1.3, 1.3, d.top);
         extras.push(ledge);
         secretAt.set(id, { x: ledge.cx, y: round2(ledge.top + 0.9), z: ledge.cz, gate: "none", box: -1 });
      } else if (id === "gutter") {
         const s = slopeFor(level.id === 4 ? 3 : 2);
         secretAt.set(id, { x: s.cx, y: round2(draftSurfaceY(s, s.cx) + 0.6), z: round2(s.cz + s.hd + 2.6), gate: "none", box: -1 });
      } else if (id === "skylight" || id === "billboard") {
         const crack = id === "skylight";
         const d = deckFor(crack ? (level.id === 5 ? 2 : 3) : 2);
         // the deck's front corner on the side away from the street you land from
         const side = -blockDir(d);
         const bx = round2(d.cx + side * (d.hw - (crack ? 0.9 : 1.3)));
         const bz = round2(d.cz + d.hd - (crack ? 0.9 : 0.8));
         blocks.push(
            crack
               ? { kind: "crack", cx: bx, cz: bz, hw: 0.8, hd: 0.8, y0: d.top, y1: round2(d.top + 0.9) }
               : { kind: "ghost", cx: bx, cz: bz, hw: 1.2, hd: 0.75, y0: d.top, y1: round2(d.top + 2.2) },
         );
         secretAt.set(id, { x: bx, y: round2(d.top + (crack ? 0.5 : 0.9)), z: bz, gate: crack ? "crack" : "ghost", box: blocks.length - 1 });
      } else if (id === "arc") {
         const d = deckFor(3);
         const side = -blockDir(d);
         const ox = round2(side * (d.hw - 1.1));
         const oz = round2(d.hd - 1.1);
         strikes.push({ support: supports.indexOf(d), ox, oz, radius: 1.0, periodMs: 1000, duty: 1, phase: 0, air: true });
         secretAt.set(id, { x: round2(d.cx + ox), y: round2(d.top + 0.9), z: round2(d.cz + oz), gate: "arc", box: -1 });
      } else {
         // crane: off a hook high over street 1, at the top of a full-speed rolled leap
         const s = slopeFor(1);
         const lip = lipOf(s);
         secretAt.set(id, { x: round2(lip.x + s.slope!.dir * 5.6), y: round2(lip.y + 3.6), z: s.cz, gate: "none", box: -1 });
      }
   }
   const secrets = secretIds.map((id) => secretAt.get(id)!);
   supports.push(...extras);
   return { supports, orbs, strikes, blocks, secrets, arena, goalTop };
}

/** A chimney updraft's launch (m/s): its apex is 5.2 m over the cap. */
export const V_UPDRAFT = Math.sqrt(2 * 30 * 5.2);
