// Crystal Tower's five levels (docs/master-plan/PLAY50_MENU_2_50_COLOR_ROLL_HEROES_FULL.md "GAME 28",
// World 5 Neon Cosmos). Plain data: tower.ts turns a spec into the course the rules run on. One
// tower (a dark crystal spire, pads spiralling up round it over the void of the cosmos) and five
// configurations of it. The route is the ordered `pads` list (the bot climbs them in order); a tier
// is a sequence beacon on one pad and the tier's crystals floating at the outer or inner edge of
// the pads above it, one crystal per colour in play. Coordinates are metres, y up, the axis at 0,0.
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "remember the colours, then climb and touch them in order";

export interface XZ {
   x: number;
   z: number;
}

export interface XYZ extends XZ {
   y: number;
}

/** The five crystal colours, the heroes' own (the card's palette). A level plays the first `colors`. */
export const PALETTE = [
   { id: "red", name: "Red", hex: "#ef4444" },
   { id: "blue", name: "Blue", hex: "#3b82f6" },
   { id: "green", name: "Green", hex: "#22c55e" },
   { id: "yellow", name: "Yellow", hex: "#facc15" },
   { id: "purple", name: "Purple", hex: "#a855f7" },
] as const;

export type PadKind = "pad" | "nook" | "ledge" | "arena";

/** A round landing surface: the hero stands on it when its centre is within `r` of the pad's. */
export interface PadSpec extends XYZ {
   r: number;
   kind: PadKind;
   /** slides from its base point: base + (dx, dz) x sin(2 pi t / periodMs) */
   move?: { dx: number; dz: number; periodMs: number };
   /** gives way CRUMBLE_MS after the hero lands on it, back GONE_MS later */
   crumble?: boolean;
   /** glass: a third of the grip */
   slick?: boolean;
   /** Kiro: crystal shards rain on it every STORM_PERIOD for STORM_ON (ms offset into the cycle) */
   storm?: number;
}

export interface CrystalSpec {
   /** the pad surface it floats over (its centre is CRYSTAL_LIFT higher) */
   x: number;
   z: number;
   y: number;
   color: number;
   /** L4+: bobs up out of reach and back, this far (m) above its rest height, once per periodMs */
   bob?: { amp: number; periodMs: number; phase: number };
}

export interface TierSpec {
   /** the beacon stands at this pad's centre */
   beacon: XYZ;
   seqLen: number;
   crystals: CrystalSpec[];
}

/** A solid disc from y0 to y1 (the hero is pushed out of it): Riko's crystal wall, Vexa's void gate. */
export interface DiscSpec extends XZ {
   r: number;
   y0: number;
   y1: number;
}

/**
 * A spark drone patrolling a stretch of the climb: to and fro along the spiral from route pad `from`
 * to route pad `to`, DRONE_LIFT over the pads (head height: it hits whoever jumps into it), one
 * round trip per periodMs.
 */
export interface DroneSpec {
   from: number;
   to: number;
   periodMs: number;
   /** start phase (rad) */
   phase: number;
}

export const DRONE_LIFT = 2.6;

export interface OrbSpec extends XYZ {
   main: boolean;
   /** only Zuno's magnet pulls it out of the crystal dust */
   hidden?: boolean;
}

export interface TowerSpec {
   id: LevelId;
   name: string;
   timerMs: number;
   starTargetMs: number;
   /** colours in play (the first `colors` of PALETTE) */
   colors: number;
   start: XYZ;
   /** the route, in climb order (beacons, crystal pads and plain climbing pads) */
   pads: PadSpec[];
   /** off the route: Riko's and Vexa's nooks, Nyla's ledges */
   side: PadSpec[];
   tiers: TierSpec[];
   /** the summit crystal (the finish; level 5: the arena's centre, unused) */
   summit: XYZ;
   walls: DiscSpec[];
   gates: DiscSpec[];
   drones: DroneSpec[];
   orbs: OrbSpec[];
   /** in progression.ts SECRETS order: the gate sticker (Vexa), the wall shard (Riko), the ledge shard (Nyla) */
   secrets: XYZ[];
   boss: boolean;
   /** level 5: the summit arena (a wide pad) where Prism Shade waits; its beacon is the last tier's */
   arena?: { x: number; z: number; y: number; r: number };
   /** level 5: the sequence length of each boss phase */
   bossSeqLen?: [number, number, number];
}

const DEG = Math.PI / 180;
const polar = (deg: number, radius: number): XZ => ({ x: Math.sin(deg * DEG) * radius, z: Math.cos(deg * DEG) * radius });

/** A route pad on the spiral. */
function pad(deg: number, radius: number, y: number, r: number, extra: Partial<PadSpec> = {}): PadSpec {
   return { ...polar(deg, radius), y, r, kind: "pad", ...extra };
}

/** How far a crystal floats from its pad's centre, radially: out (+) or in (-). */
export const CRYSTAL_OUT = 1.7;

/** A crystal at the outer (side 1) or inner (side -1) edge of the pad at (deg, radius, y). */
function crystal(deg: number, radius: number, y: number, color: number, side: 1 | -1, bob?: CrystalSpec["bob"]): CrystalSpec {
   return { ...polar(deg, radius + side * CRYSTAL_OUT), y, color, bob };
}

/** Nyla's ledge: this far above its pad (a plain jump reaches 3.27 m; the double jump 4.9 m). */
export const LEDGE_LIFT = 4.4;
/** A nook (Riko's, Vexa's): a small pad touching the outer edge of a route pad, the barrier between. */
export const NOOK_R = 1.3;

/** The nook outside the pad at (deg, radius, y) and the solid disc that blocks the way to it. */
function nook(deg: number, radius: number, y: number, padR: number): { pad: PadSpec; disc: DiscSpec; spot: XYZ } {
   const nr = radius + padR + NOOK_R - 0.25;
   const p = { ...polar(deg, nr), y, r: NOOK_R, kind: "nook" as const };
   // as wide as the nook: a round barrier pushes sideways, so a narrower one could be slid round
   const d = { ...polar(deg, radius + padR - 0.05), r: NOOK_R, y0: y - 0.2, y1: y + 3.6 };
   return { pad: p, disc: d, spot: { ...polar(deg, nr + 0.3), y: y + 1 } };
}

/** Nyla's ledge hangs this far outside its pad's centre (a jump between pads never lands on it). */
export const LEDGE_OUT = 2.6;

function ledge(deg: number, radius: number, y: number): { pad: PadSpec; spot: XYZ } {
   const p = { ...polar(deg, radius + LEDGE_OUT), y: y + LEDGE_LIFT, r: 1.4, kind: "ledge" as const };
   return { pad: p, spot: { ...polar(deg, radius + LEDGE_OUT + 0.3), y: y + LEDGE_LIFT + 1 } };
}

const Y_ORB = 0.9;
/** a main gem over the pad at (deg, radius, y), and n more in a short arc after it */
function gems(deg: number, radius: number, y: number, n = 1, main = true, hidden = false): OrbSpec[] {
   const out: OrbSpec[] = [];
   for (let i = 0; i < n; i++) out.push({ ...polar(deg + i * 9, radius), y: y + Y_ORB, main, hidden: hidden || undefined });
   return out;
}

/** two bonus gems on a side pad (a nook or a ledge) */
function sideGems(p: PadSpec): OrbSpec[] {
   const r = Math.hypot(p.x, p.z);
   const ux = p.x / r;
   const uz = p.z / r;
   return [
      { x: p.x + ux * 0.45 - uz * 0.4, y: p.y + Y_ORB, z: p.z + uz * 0.45 + ux * 0.4, main: false },
      { x: p.x + ux * 0.45 + uz * 0.4, y: p.y + Y_ORB, z: p.z + uz * 0.45 - ux * 0.4, main: false },
   ];
}

// ---------------------------------------------------------------------------------------------
// Level 1: 3-Color Sequence. A wide, slow spiral (R 7.5, 34 deg a pad, 1.9 m a step). Three tiers
// of three colours: the beacon pad, a pad with two crystals (out and in), a pad with one.

function level1(): TowerSpec {
   const R = 7.5;
   const D = 34;
   const H = 1.9;
   const r = 2.1;
   const at = (k: number) => ({ deg: k * D, y: k * H });
   // the start pad, then per tier: the beacon pad, a pad with two crystals, a pad with one, a plain
   // climbing pad (the shard storm of the last tier rains on it)
   const pads: PadSpec[] = [];
   for (let k = 0; k <= 13; k++) pads.push(pad(at(k).deg, R, at(k).y, r, k === 12 ? { storm: 0 } : {}));
   const tier = (b: number, colours: [number, number, number]): TierSpec => ({
      beacon: { ...polar(at(b).deg, R), y: at(b).y },
      seqLen: 3,
      crystals: [crystal(at(b + 1).deg, R, at(b + 1).y, colours[0], 1), crystal(at(b + 1).deg, R, at(b + 1).y, colours[1], -1), crystal(at(b + 2).deg, R, at(b + 2).y, colours[2], 1)],
   });
   const wall = nook(at(5).deg, R, at(5).y, r);
   const gate = nook(at(9).deg, R, at(9).y, r);
   const sky = ledge(at(1).deg, R, at(1).y);
   return {
      id: 1,
      name: "3-Color Sequence",
      timerMs: 90_000,
      starTargetMs: 50_000,
      colors: 3,
      start: { ...polar(0, R), y: 0 },
      pads,
      side: [wall.pad, gate.pad, sky.pad],
      tiers: [tier(1, [0, 1, 2]), tier(5, [1, 2, 0]), tier(9, [2, 0, 1])],
      summit: { ...polar(at(13).deg, R), y: at(13).y },
      walls: [wall.disc],
      gates: [gate.disc],
      drones: [],
      orbs: [
         ...gems(at(2).deg, R, at(2).y),
         ...gems(at(3).deg, R, at(3).y),
         ...gems(at(4).deg, R, at(4).y),
         ...gems(at(6).deg, R, at(6).y),
         ...gems(at(7).deg, R, at(7).y),
         ...gems(at(8).deg, R, at(8).y),
         ...gems(at(10).deg, R, at(10).y),
         ...gems(at(11).deg, R, at(11).y),
         ...gems(at(12).deg, R, at(12).y),
         ...sideGems(wall.pad),
         ...sideGems(sky.pad),
         ...gems(at(2).deg - 10, R - 0.6, at(2).y, 3, false, true),
      ],
      secrets: [gate.spot, wall.spot, sky.spot],
      boss: false,
   };
}

// ---------------------------------------------------------------------------------------------
// Level 2: 4 Colors. A tighter spiral (R 7.8, 32 deg, 1.85 m) with sliding bridge pads between the
// tiers; four tiers of four colours (two pads of two crystals each).

function level2(): TowerSpec {
   const R = 7.8;
   const D = 32;
   const H = 1.85;
   const r = 1.9;
   const at = (k: number) => ({ deg: k * D, y: k * H });
   const pads: PadSpec[] = [];
   for (let k = 0; k <= 13; k++) {
      const mover = k === 4 || k === 8 || k === 12;
      const p = polar(at(k).deg, R);
      const t = polar(at(k).deg + 90, 1);
      // the sliding bridges between the tiers; the middle one carries the shard storm too
      pads.push(pad(at(k).deg, R, at(k).y, mover ? 2.2 : r, mover ? { move: { dx: t.x * 1.8, dz: t.z * 1.8, periodMs: 5200 + k * 200 }, storm: k === 8 ? 1200 : undefined } : {}));
      void p;
   }
   const tier = (b: number, c: [number, number, number, number], len: number): TierSpec => ({
      beacon: { ...polar(at(b).deg, R), y: at(b).y },
      seqLen: len,
      crystals: [
         crystal(at(b + 1).deg, R, at(b + 1).y, c[0], 1),
         crystal(at(b + 1).deg, R, at(b + 1).y, c[1], -1),
         crystal(at(b + 2).deg, R, at(b + 2).y, c[2], 1),
         crystal(at(b + 2).deg, R, at(b + 2).y, c[3], -1),
      ],
   });
   const wall = nook(at(5).deg, R, at(5).y, r);
   const gate = nook(at(9).deg, R, at(9).y, r);
   const sky = ledge(at(1).deg, R, at(1).y);
   return {
      id: 2,
      name: "4 Colors",
      timerMs: 120_000,
      starTargetMs: 70_000,
      colors: 4,
      start: { ...polar(0, R), y: 0 },
      pads,
      side: [wall.pad, gate.pad, sky.pad],
      tiers: [tier(1, [0, 1, 2, 3], 3), tier(5, [3, 2, 1, 0], 3), tier(9, [1, 3, 0, 2], 4)],
      summit: { ...polar(at(13).deg, R), y: at(13).y },
      walls: [wall.disc],
      gates: [gate.disc],
      drones: [],
      orbs: [
         ...gems(at(2).deg, R, at(2).y),
         ...gems(at(3).deg, R, at(3).y),
         ...gems(at(4).deg, R, at(4).y, 2),
         ...gems(at(6).deg, R, at(6).y),
         ...gems(at(7).deg, R, at(7).y),
         ...gems(at(8).deg, R, at(8).y, 2),
         ...gems(at(10).deg, R, at(10).y),
         ...gems(at(11).deg, R, at(11).y),
         ...gems(at(12).deg, R, at(12).y, 2),
         ...sideGems(wall.pad),
         ...sideGems(sky.pad),
         ...gems(at(3).deg - 10, R - 0.6, at(3).y, 3, false, true),
      ],
      secrets: [gate.spot, wall.spot, sky.spot],
      boss: false,
   };
}

// ---------------------------------------------------------------------------------------------
// Level 3: 5 Colors. Five colours over five tiers: the beacon pad, two pads of two crystals and a
// pad of one; the climbing pads crumble under you and the glass pads are slick (R 7.6, 36 deg, 2 m).

function level3(): TowerSpec {
   const R = 7.6;
   const D = 36;
   const H = 2;
   const r = 1.9;
   const at = (k: number) => ({ deg: k * D, y: k * H });
   const pads: PadSpec[] = [];
   const tiers: TierSpec[] = [];
   const colours: [number, number, number, number, number][] = [
      [0, 1, 2, 3, 4],
      [4, 3, 2, 1, 0],
      [2, 0, 4, 1, 3],
      [1, 4, 0, 3, 2],
      [3, 2, 1, 4, 0],
   ];
   // start pad, then per tier: the beacon pad (its fifth crystal at the inner edge), A and B (two
   // crystals each, B is glass), and a plain crumbling climbing pad (the middle tier's storm rains on it)
   pads.push(pad(0, R, 0, r));
   let k = 1;
   for (let t = 0; t < 5; t++) {
      const b = k;
      pads.push(pad(at(b).deg, R, at(b).y, r));
      pads.push(pad(at(b + 1).deg, R, at(b + 1).y, r));
      pads.push(pad(at(b + 2).deg, R, at(b + 2).y, r, { slick: true }));
      pads.push(pad(at(b + 3).deg, R, at(b + 3).y, r, t === 2 ? { crumble: true, storm: 600 } : { crumble: true }));
      const c = colours[t];
      tiers.push({
         beacon: { ...polar(at(b).deg, R), y: at(b).y },
         seqLen: 4,
         crystals: [
            crystal(at(b + 1).deg, R, at(b + 1).y, c[0], 1),
            crystal(at(b + 1).deg, R, at(b + 1).y, c[1], -1),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[2], 1),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[3], -1),
            crystal(at(b).deg, R, at(b).y, c[4], -1),
         ],
      });
      k += 4;
   }
   pads.push(pad(at(k).deg, R, at(k).y, 2.2));
   const wall = nook(at(5).deg, R, at(5).y, r);
   const gate = nook(at(13).deg, R, at(13).y, r);
   const sky = ledge(at(9).deg, R, at(9).y);
   const orbs: OrbSpec[] = [];
   for (let i = 2; i < k; i++) if (i % 4 !== 1) orbs.push(...gems(at(i).deg, R, at(i).y));
   orbs.push(...sideGems(wall.pad), ...sideGems(sky.pad), ...gems(at(3).deg - 10, R - 0.6, at(3).y, 3, false, true));
   return {
      id: 3,
      name: "5 Colors",
      timerMs: 150_000,
      starTargetMs: 95_000,
      colors: 5,
      start: { ...polar(0, R), y: 0 },
      pads,
      side: [wall.pad, gate.pad, sky.pad],
      tiers,
      summit: { ...polar(at(k).deg, R), y: at(k).y },
      walls: [wall.disc],
      gates: [gate.disc],
      drones: [],
      orbs,
      secrets: [gate.spot, wall.spot, sky.spot],
      boss: false,
   };
}

// ---------------------------------------------------------------------------------------------
// Level 4: Moving Crystals. Six tiers (R 7.4, 36 deg, 2.2 m: tighter gaps); every crystal slides
// to and fro over the void beside its pad, so you step out when the right one swings in; spark
// drones circle the tower at head height (jump into one and it knocks you); faster storms.

function level4(): TowerSpec {
   const R = 7.4;
   const D = 36;
   const H = 2.2;
   const r = 2;
   const at = (k: number) => ({ deg: k * D, y: k * H });
   const pads: PadSpec[] = [];
   const tiers: TierSpec[] = [];
   const colours: [number, number, number, number, number][] = [
      [0, 1, 2, 3, 4],
      [2, 4, 1, 0, 3],
      [4, 0, 3, 2, 1],
      [1, 3, 0, 4, 2],
      [3, 2, 4, 1, 0],
      [0, 4, 1, 2, 3],
   ];
   pads.push(pad(0, R, 0, r));
   let k = 1;
   for (let t = 0; t < 6; t++) {
      const b = k;
      pads.push(pad(at(b).deg, R, at(b).y, r));
      pads.push(pad(at(b + 1).deg, R, at(b + 1).y, r));
      pads.push(pad(at(b + 2).deg, R, at(b + 2).y, r));
      // a plain climbing pad: the shard storms and the crumbling live here (never on a crystal pad)
      pads.push(pad(at(b + 3).deg, R, at(b + 3).y, r, { storm: t % 2 === 1 ? 400 * t : undefined, crumble: t >= 3 || undefined }));
      const c = colours[t];
      const bob = (phase: number) => ({ amp: 1.9, periodMs: 3400 + t * 150, phase });
      tiers.push({
         beacon: { ...polar(at(b).deg, R), y: at(b).y },
         seqLen: t < 2 ? 4 : 5,
         crystals: [
            crystal(at(b + 1).deg, R, at(b + 1).y, c[0], 1, bob(0)),
            crystal(at(b + 1).deg, R, at(b + 1).y, c[1], -1, bob(Math.PI)),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[2], 1, bob(Math.PI / 2)),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[3], -1, bob(-Math.PI / 2)),
            crystal(at(b).deg, R, at(b).y, c[4], -1, bob(Math.PI / 4)),
         ],
      });
      k += 4;
   }
   pads.push(pad(at(k).deg, R, at(k).y, 2.2));
   const wall = nook(at(5).deg, R, at(5).y, r);
   const gate = nook(at(13).deg, R, at(13).y, r);
   const sky = ledge(at(9).deg, R, at(9).y);
   const orbs: OrbSpec[] = [];
   for (let i = 2; i < k; i++) if (i % 4 !== 1) orbs.push(...gems(at(i).deg, R, at(i).y));
   orbs.push(...sideGems(wall.pad), ...sideGems(sky.pad), ...gems(at(2).deg - 10, R - 0.6, at(2).y, 3, false, true));
   return {
      id: 4,
      name: "Moving Crystals",
      timerMs: 180_000,
      starTargetMs: 120_000,
      colors: 5,
      start: { ...polar(0, R), y: 0 },
      pads,
      side: [wall.pad, gate.pad, sky.pad],
      tiers,
      summit: { ...polar(at(k).deg, R), y: at(k).y },
      walls: [wall.disc],
      gates: [gate.disc],
      drones: [
         { from: 6, to: 9, periodMs: 7000, phase: 0 },
         { from: 14, to: 17, periodMs: 6400, phase: 2 },
         { from: 22, to: 25, periodMs: 5800, phase: 4 },
      ],
      orbs,
      secrets: [gate.spot, wall.spot, sky.spot],
      boss: false,
   };
}

// ---------------------------------------------------------------------------------------------
// Level 5: Memory Tower. Four tiers with every hazard (sliding bridges, glass, crumbling pads,
// sliding crystals, storms, drones), then the summit arena: Prism Shade's five crystals round its
// rim, his colour sequences as his attacks (progression.ts PRISM).

/** The arena's radius and how far in from its rim the boss's crystals float. */
export const ARENA_R = 7.5;
export const ARENA_SLOT_R = 5.8;

function level5(): TowerSpec {
   const R = 7.6;
   const D = 36;
   const H = 2.1;
   const r = 2;
   const at = (k: number) => ({ deg: k * D, y: k * H });
   const pads: PadSpec[] = [];
   const tiers: TierSpec[] = [];
   const colours: [number, number, number, number, number][] = [
      [0, 1, 2, 3, 4],
      [3, 0, 4, 2, 1],
      [1, 4, 0, 3, 2],
      [4, 2, 3, 1, 0],
   ];
   pads.push(pad(0, R, 0, r));
   let k = 1;
   for (let t = 0; t < 4; t++) {
      const b = k;
      pads.push(pad(at(b).deg, R, at(b).y, r));
      const tan = polar(at(b + 1).deg + 90, 1);
      pads.push(pad(at(b + 1).deg, R, at(b + 1).y, t === 1 ? 2.2 : r, t === 1 ? { move: { dx: tan.x * 1.6, dz: tan.z * 1.6, periodMs: 5600 } } : {}));
      pads.push(pad(at(b + 2).deg, R, at(b + 2).y, r, t === 2 ? { slick: true } : {}));
      // two plain climbing pads: one crumbles (from the third tier), the other carries the shard storm
      pads.push(pad(at(b + 3).deg, R, at(b + 3).y, r, t >= 2 ? { crumble: true } : {}));
      pads.push(pad(at(b + 4).deg, R, at(b + 4).y, r, t === 3 || t === 1 ? { storm: 800 * t } : {}));
      const c = colours[t];
      const bob = t >= 2 ? (phase: number) => ({ amp: 1.9, periodMs: 3600, phase }) : () => undefined;
      tiers.push({
         beacon: { ...polar(at(b).deg, R), y: at(b).y },
         seqLen: t < 2 ? 4 : 5,
         crystals: [
            crystal(at(b + 1).deg, R, at(b + 1).y, c[0], 1, bob(0)),
            crystal(at(b + 1).deg, R, at(b + 1).y, c[1], -1, bob(Math.PI)),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[2], 1, bob(Math.PI / 2)),
            crystal(at(b + 2).deg, R, at(b + 2).y, c[3], -1, bob(-Math.PI / 2)),
            crystal(at(b).deg, R, at(b).y, c[4], -1, bob(Math.PI / 4)),
         ],
      });
      k += 5;
   }
   // two more climbing pads up to the arena rim, then the arena itself (its beacon on the rim)
   pads.push(pad(at(k).deg, R, at(k).y, r));
   pads.push(pad(at(k + 1).deg, R, at(k + 1).y, r));
   const arenaY = at(k + 2).y;
   const arena = { x: 0, z: 0, y: arenaY, r: ARENA_R };
   pads.push({ x: 0, z: 0, y: arenaY, r: ARENA_R, kind: "arena" });
   const rimBeacon = polar(at(k + 2).deg, ARENA_R - 2.2);
   tiers.push({ beacon: { ...rimBeacon, y: arenaY }, seqLen: 0, crystals: [] });
   const wall = nook(at(6).deg, R, at(6).y, r);
   const gate = nook(at(16).deg, R, at(16).y, r);
   const sky = ledge(at(11).deg, R, at(11).y);
   const orbs: OrbSpec[] = [];
   for (let i = 2; i < k + 2; i++) if (i % 5 !== 1) orbs.push(...gems(at(i).deg, R, at(i).y));
   orbs.push(...sideGems(wall.pad), ...sideGems(sky.pad), ...gems(at(3).deg - 10, R - 0.6, at(3).y, 3, false, true));
   return {
      id: 5,
      name: "Memory Tower",
      timerMs: 240_000,
      starTargetMs: 150_000,
      colors: 5,
      start: { ...polar(0, R), y: 0 },
      pads,
      side: [wall.pad, gate.pad, sky.pad],
      tiers,
      summit: { x: 0, z: 0, y: arenaY },
      walls: [wall.disc],
      gates: [gate.disc],
      drones: [
         { from: 7, to: 10, periodMs: 7000, phase: 1 },
         { from: 17, to: 20, periodMs: 6400, phase: 3 },
      ],
      orbs,
      secrets: [gate.spot, wall.spot, sky.spot],
      boss: true,
      arena,
      bossSeqLen: [5, 5, 6],
   };
}

export const LEVELS: Record<LevelId, TowerSpec> = { 1: level1(), 2: level2(), 3: level3(), 4: level4(), 5: level5() };

/** Level 5: the arena rim slots the boss's five crystals stand in (one per colour, before any shuffle). */
export function arenaSlots(arena: { x: number; z: number; y: number }): XYZ[] {
   const out: XYZ[] = [];
   for (let i = 0; i < 5; i++) {
      const p = polar(i * 72 + 36, ARENA_SLOT_R);
      out.push({ x: arena.x + p.x, z: arena.z + p.z, y: arena.y });
   }
   return out;
}
