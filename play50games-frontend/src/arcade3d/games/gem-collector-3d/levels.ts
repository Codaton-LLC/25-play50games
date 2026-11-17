// Gem Collector 3D's five levels (docs/menu2-super/world-4-frost-and-sweets.md "23 Gem Collector 3D").
// Plain data: arena.ts turns a spec into the arena the rules run on. One base room (the Ornament Vault:
// a round gem-tiled floor inside a brass-capped rim wall, score beacons near the rim) and five
// configurations of it. The vault is centred on the origin; the hero starts near the south rim and
// faces +z. Coordinates are metres.
import type { LevelId } from "../../types";

/** The design card's signature. layouts.test.ts pins it. */
export const SIGNATURE = "the gem train";

export interface XZ {
   x: number;
   z: number;
}

export interface XYZ extends XZ {
   y: number;
}

export type GemKind = "clear" | "frost" | "gold";

export interface GemSpec extends XZ {
   kind: GemKind;
   /** on a high pedestal (its top), else on the floor */
   pedestal?: number;
   /** a magnet trail gem: only Zuno's magnet pulls it out of the rim */
   hidden?: boolean;
}

/** A high pedestal: a solid column; its top (y = h) holds a gold gem. Only Nami's double jump gets up. */
export interface PedestalSpec extends XZ {
   h: number;
}

/** An axis-aligned box on the floor (walls, zones). */
export interface Box {
   x0: number;
   x1: number;
   z0: number;
   z1: number;
}

/**
 * A frost-sweeper zone: a 1.6 m band of frost breath sweeps across the zone along x every `periodMs`
 * (it crosses in `sweepMs`, then rests). Links it touches are cut (Kiro's shield keeps the tail).
 */
export interface SweeperSpec extends Box {
   periodMs: number;
   sweepMs: number;
   offsetMs: number;
}

/** L2: floor cells that sink in turn: cell group g is down while floor(t / everyMs) % groups === g. */
export interface TileSpec {
   cells: (Box & { group: number })[];
   groups: number;
   everyMs: number;
}

export interface ArenaSpec {
   id: LevelId;
   name: string;
   /** the round (a score attack: the run ends when it runs out; level 5 ends on the boss's defeat) */
   durationMs: number;
   /** the clear: this score (the first star and the level unlock); level 5: the boss down */
   targetScore: number;
   /** the third star: the target reached before this */
   starTargetMs: number;
   radius: number;
   start: XZ;
   /** the score beacons (fixed), or the spots a moving beacon visits (`beaconEveryMs`) */
   beacons: XZ[];
   beaconEveryMs?: number;
   gems: GemSpec[];
   pedestals: PedestalSpec[];
   /** Riko: cracked crystal walls; a dash breaks one and opens the sealed pocket behind it */
   crackedWalls: Box[];
   /** Vexa: the ghost wall in front of the back vault (solid for everyone else) */
   ghostWall: Box;
   /** the back vault's own walls (solid; its only door is the ghost wall) */
   vault: Box;
   sweepers: SweeperSpec[];
   tiles: TileSpec | null;
   /** L3: ice slimes that chase the tail and bite links off; lasso one to freeze it into a gold gem */
   slimes: XZ[];
   /** L4: treasure chests: touch one and it bursts into 6 gems */
   chests: XZ[];
   /** the vault refills: wave k appears at (k + 1) * waveEveryMs (a fixed, finite schedule) */
   waves: GemSpec[][];
   waveEveryMs: number;
   /** 5 hidden colour orbs (the second star) */
   orbs: XYZ[];
   /** in SECRETS order: the vault sticker (Vexa), the pocket shard (Riko), the pedestal shard (Nami) */
   secrets: XYZ[];
   night: boolean;
   boss: boolean;
}

const ring = (n: number, r: number, kind: GemKind, a0 = 0, cx = 0, cz = 0): GemSpec[] =>
   Array.from({ length: n }, (_, i) => {
      const a = a0 + (i / n) * Math.PI * 2;
      return { x: +(cx + Math.sin(a) * r).toFixed(2), z: +(cz + Math.cos(a) * r).toFixed(2), kind };
   });

const row = (x0: number, z0: number, x1: number, z1: number, n: number, kind: GemKind): GemSpec[] =>
   Array.from({ length: n }, (_, i) => {
      const k = n === 1 ? 0 : i / (n - 1);
      return { x: +(x0 + (x1 - x0) * k).toFixed(2), z: +(z0 + (z1 - z0) * k).toFixed(2), kind };
   });

/** A rim magnet trail: hidden gems along an arc just inside the rim. */
const trail = (r: number, a0: number, a1: number, n: number): GemSpec[] =>
   Array.from({ length: n }, (_, i) => {
      const a = a0 + ((a1 - a0) * i) / Math.max(1, n - 1);
      return { x: +(Math.sin(a) * r).toFixed(2), z: +(Math.cos(a) * r).toFixed(2), kind: "clear" as const, hidden: true };
   });

const DEG = Math.PI / 180;

/** The back vault at the north rim (shared by every level): its ghost wall faces the arena. */
function vaultAt(radius: number): { vault: Box; ghostWall: Box } {
   const z1 = radius - 0.6;
   return { vault: { x0: -2.6, x1: 2.6, z0: z1 - 3.4, z1 }, ghostWall: { x0: -1.2, x1: 1.2, z0: z1 - 3.6, z1: z1 - 3.2 } };
}

function base(radius: number) {
   const v = vaultAt(radius);
   return {
      radius,
      start: { x: 0, z: -radius + 2.5 },
      crackedWalls: [{ x0: radius - 4.6, x1: radius - 4.1, z0: -1.6, z1: 1.6 }],
      ghostWall: v.ghostWall,
      vault: v.vault,
   };
}

/** The pocket gems behind the cracked wall and the vault's gems (every level has both). */
function hideaways(radius: number): GemSpec[] {
   const px = radius - 2.6;
   const vz = radius - 2.4;
   return [
      { x: px, z: -0.8, kind: "gold" },
      { x: px, z: 0.8, kind: "gold" },
      { x: -1.2, z: vz, kind: "gold" },
      { x: 0, z: vz, kind: "gold" },
      { x: 1.2, z: vz, kind: "gold" },
   ];
}

export const LEVELS: Record<LevelId, ArenaSpec> = {
   // L1 teaches in three beats: three gems beside the first beacon (bank them); a curved line of
   // eight (an 8-link train, the bank shows the jump: 9 -> 64); a lone gold gem inside a small
   // ring, placed so a careless loop crosses your own tail (the cut gems scatter slowly; regrab them).
   1: {
      id: 1,
      name: "Vault Floor",
      durationMs: 90_000,
      targetScore: 300,
      starTargetMs: 60_000,
      ...base(13),
      beacons: [
         { x: -5.5, z: -8.5 },
         { x: 8.5, z: 5.5 },
      ],
      gems: [
         ...row(-2.5, -8.2, -2.5, -6.2, 3, "clear"),
         ...row(-7.5, -3, 3.5, 1, 8, "clear"),
         ...ring(6, 2.2, "clear", 0, -4, 6),
         { x: -4, z: 6, kind: "gold" },
         ...ring(8, 4.2, "clear", 20 * DEG, 3, 4),
         ...row(4, -6, 9, -3, 4, "frost"),
         { x: -8, z: 2, kind: "gold", pedestal: 0 },
         ...trail(11.6, -140 * DEG, -100 * DEG, 5),
         ...hideaways(13),
      ],
      pedestals: [{ x: -8, z: 2, h: 2.2 }],
      sweepers: [{ x0: -10, x1: 1, z0: 9, z1: 11, periodMs: 6000, sweepMs: 2500, offsetMs: 0 }],
      tiles: null,
      slimes: [],
      chests: [],
      waveEveryMs: 25_000,
      waves: [ring(10, 3, "clear", 0, 4, -3), [...ring(10, 3.2, "clear", 0, -4, 3), { x: -4, z: 3, kind: "gold" }], ring(12, 4.5, "clear", 10 * DEG, 0, 0)],
      orbs: [
         { x: -10.5, y: 1, z: -4 },
         { x: 6, y: 1, z: 10 },
         { x: 0, y: 1, z: 10.2 },
         { x: 10.4, y: 1, z: 0 },
         { x: -8, y: 3.1, z: 2 },
      ],
      secrets: [
         { x: 0, y: 1, z: 11.4 },
         { x: 11, y: 1, z: 0 },
         { x: -8, y: 3.4, z: 2 },
      ],
      night: false,
      boss: false,
   },
   // L2: shifting tiles. The floor is a 4 x 4 grid of slabs; one diagonal group sinks every 5 s (a
   // pit: roll in and the train is lost), so the space a long train can turn in keeps moving.
   2: {
      id: 2,
      name: "Shifting Tiles",
      durationMs: 100_000,
      targetScore: 600,
      starTargetMs: 75_000,
      ...base(15),
      beacons: [
         { x: -10, z: -8 },
         { x: 10, z: -8 },
         { x: -10, z: 8 },
      ],
      gems: [
         ...row(-6, -9, 6, -9, 6, "clear"),
         ...ring(10, 3.4, "clear", 0, -5.5, 0),
         ...ring(10, 3.4, "clear", 18 * DEG, 5.5, 0),
         ...row(-6, 9, 6, 9, 6, "clear"),
         ...row(-2, -3.5, -2, 3.5, 4, "frost"),
         { x: 0, z: 0, kind: "gold" },
         { x: 9, z: 6, kind: "gold", pedestal: 0 },
         ...trail(13.6, 140 * DEG, 175 * DEG, 6),
         ...hideaways(15),
      ],
      pedestals: [{ x: 9, z: 6, h: 2.2 }],
      sweepers: [{ x0: -12, x1: -2, z0: -12.5, z1: -11, periodMs: 7000, sweepMs: 3000, offsetMs: 1500 }],
      tiles: {
         groups: 4,
         everyMs: 5000,
         cells: [
            { x0: -7.2, x1: -3.6, z0: -7.2, z1: -3.6, group: 0 },
            { x0: -3.6, x1: 0, z0: -3.6, z1: 0, group: 0 },
            { x0: 0, x1: 3.6, z0: 0, z1: 3.6, group: 0 },
            { x0: 3.6, x1: 7.2, z0: 3.6, z1: 7.2, group: 0 },
            { x0: -3.6, x1: 0, z0: -7.2, z1: -3.6, group: 1 },
            { x0: 0, x1: 3.6, z0: -3.6, z1: 0, group: 1 },
            { x0: 3.6, x1: 7.2, z0: 0, z1: 3.6, group: 1 },
            { x0: -7.2, x1: -3.6, z0: 3.6, z1: 7.2, group: 1 },
            { x0: 0, x1: 3.6, z0: -7.2, z1: -3.6, group: 2 },
            { x0: 3.6, x1: 7.2, z0: -3.6, z1: 0, group: 2 },
            { x0: -7.2, x1: -3.6, z0: 0, z1: 3.6, group: 2 },
            { x0: -3.6, x1: 0, z0: 3.6, z1: 7.2, group: 2 },
            { x0: 3.6, x1: 7.2, z0: -7.2, z1: -3.6, group: 3 },
            { x0: -7.2, x1: -3.6, z0: -3.6, z1: 0, group: 3 },
            { x0: -3.6, x1: 0, z0: 0, z1: 3.6, group: 3 },
            { x0: 0, x1: 3.6, z0: 3.6, z1: 7.2, group: 3 },
         ],
      },
      slimes: [],
      chests: [],
      waveEveryMs: 20_000,
      waves: [
         ring(12, 4, "clear", 0, 0, 9.5),
         [...ring(10, 3.4, "clear", 0, -9, 0), { x: -9, z: 0, kind: "gold" }],
         [...ring(10, 3.4, "clear", 0, 9, 0), { x: 9, z: 0, kind: "gold" }],
         ring(14, 5, "clear", 12 * DEG, 0, -6),
      ],
      orbs: [
         { x: -12.4, y: 1, z: 0 },
         { x: 12.4, y: 1, z: 0 },
         { x: -4.5, y: 1, z: -12 },
         { x: -6, y: 1, z: 11.5 },
         { x: 9, y: 3.1, z: 6 },
      ],
      secrets: [
         { x: 0, y: 1, z: 13.4 },
         { x: 13, y: 1, z: 0 },
         { x: 9, y: 3.4, z: 6 },
      ],
      night: false,
      boss: false,
   },
   // L3: the slime pen. Three ice slimes chase your tail and bite links off; close a loop round one
   // (a lasso) and it freezes into a gold gem.
   3: {
      id: 3,
      name: "Slime Pen",
      durationMs: 110_000,
      targetScore: 900,
      starTargetMs: 90_000,
      ...base(15),
      beacons: [
         { x: 0, z: -10.5 },
         { x: -10.5, z: 5 },
         { x: 10.5, z: 5 },
      ],
      gems: [
         ...ring(12, 7.5, "clear", 15 * DEG),
         ...ring(6, 3, "clear", 0, 0, 1),
         ...row(-9, -6, -4, -9, 5, "clear"),
         ...row(4, -9, 9, -6, 5, "clear"),
         ...ring(4, 1.2, "frost", 45 * DEG, 0, 1),
         { x: -5, z: 10, kind: "gold", pedestal: 0 },
         ...trail(13.6, -175 * DEG, -140 * DEG, 6),
         ...hideaways(15),
      ],
      pedestals: [{ x: -5, z: 10, h: 2.2 }],
      sweepers: [{ x0: 2, x1: 12, z0: 9.5, z1: 11, periodMs: 6500, sweepMs: 2800, offsetMs: 3000 }],
      tiles: null,
      slimes: [
         { x: -6, z: 3 },
         { x: 6, z: 3 },
         { x: 0, z: 7 },
      ],
      chests: [],
      waveEveryMs: 20_000,
      waves: [
         ring(12, 4.5, "clear", 0, 0, -5),
         [...ring(10, 3.5, "clear", 0, -7, 6), ...ring(2, 1, "gold", 0, -7, 6)],
         [...ring(10, 3.5, "clear", 0, 7, 6), ...ring(2, 1, "gold", 0, 7, 6)],
         ring(14, 9, "clear", 7 * DEG),
         ring(12, 5, "clear", 15 * DEG, 0, 2),
      ],
      orbs: [
         { x: -12.6, y: 1, z: -3 },
         { x: 12.6, y: 1, z: -3 },
         { x: 0, y: 1, z: 6.2 },
         { x: -7, y: 1, z: -11.4 },
         { x: -5, y: 3.1, z: 10 },
      ],
      secrets: [
         { x: 0, y: 1, z: 13.4 },
         { x: 13, y: 1, z: 0 },
         { x: -5, y: 3.4, z: 10 },
      ],
      night: false,
      boss: false,
   },
   // L4: the chest rush, at night (only the gems, the beacon and the chests glow). Four chests burst
   // into six gems each, and the one beacon moves between three pedestal spots every 15 s.
   4: {
      id: 4,
      name: "Chest Rush",
      durationMs: 120_000,
      targetScore: 1200,
      starTargetMs: 90_000,
      ...base(15),
      beacons: [
         { x: -9, z: -6 },
         { x: 9, z: -6 },
         { x: 0, z: 8.5 },
      ],
      beaconEveryMs: 15_000,
      gems: [
         ...ring(8, 4, "clear", 0, 0, -1),
         ...row(-11, 0, -11, 7, 5, "clear"),
         ...row(9, 2.5, 9, 8, 5, "clear"),
         ...row(-4, -11.5, 4, -11.5, 5, "frost"),
         { x: 6.5, z: 9.5, kind: "gold", pedestal: 0 },
         ...trail(13.6, -60 * DEG, -20 * DEG, 6),
         ...hideaways(15),
      ],
      pedestals: [{ x: 6.5, z: 9.5, h: 2.2 }],
      sweepers: [
         { x0: -12, x1: -2, z0: 4, z1: 5.5, periodMs: 6000, sweepMs: 2500, offsetMs: 0 },
         { x0: 2, x1: 12, z0: -9.5, z1: -8, periodMs: 6000, sweepMs: 2500, offsetMs: 3000 },
      ],
      tiles: null,
      slimes: [],
      chests: [
         { x: -6, z: -9 },
         { x: 6, z: -2 },
         { x: -6, z: 9.5 },
         { x: 3, z: 5 },
      ],
      waveEveryMs: 20_000,
      waves: [
         ring(12, 4.5, "clear", 0, -6, 0),
         ring(12, 4.5, "clear", 0, 5, 0),
         [...ring(12, 9.5, "clear", 0), ...ring(3, 1.2, "gold", 0, 0, -1)],
         ring(12, 4.5, "clear", 15 * DEG, 0, 6),
         ring(14, 5, "clear", 0, 0, -6),
      ],
      orbs: [
         { x: -12.6, y: 1, z: -5 },
         { x: 12.6, y: 1, z: -6 },
         { x: -2.5, y: 1, z: 12.4 },
         { x: 0, y: 1, z: -4 },
         { x: 6.5, y: 3.1, z: 9.5 },
      ],
      secrets: [
         { x: 0, y: 1, z: 13.4 },
         { x: 13, y: 1, z: 0 },
         { x: 6.5, y: 3.4, z: 9.5 },
      ],
      night: true,
      boss: false,
   },
   // L5: the Gumdrop Glutton, the vault's frozen keeper. P1: he chases you and eats your tail: after
   // each lunge he waddles back to his pedestal and squats, full: lasso him there, then bank while he
   // is stunned. P2: he splits into three
   // mini-gummies: lasso each. P3: he swallows the last beacon: bank a 10+ train into his mouth while
   // he yawns. Gems keep coming: a fountain rings the floor at each phase.
   5: {
      id: 5,
      name: "Gumdrop Glutton",
      durationMs: 240_000,
      targetScore: 0,
      starTargetMs: 150_000,
      ...base(15),
      beacons: [
         { x: -7, z: -5 },
         { x: 7, z: -5 },
      ],
      gems: [
         ...ring(14, 6, "clear", 0),
         ...ring(10, 9.5, "clear", 9 * DEG),
         ...ring(6, 2.6, "frost", 30 * DEG),
         { x: -9, z: 6, kind: "gold", pedestal: 0 },
         ...trail(13.6, 100 * DEG, 140 * DEG, 6),
         ...hideaways(15),
      ],
      pedestals: [{ x: -9, z: 6, h: 2.2 }],
      sweepers: [],
      tiles: null,
      slimes: [],
      chests: [],
      waveEveryMs: 12_000,
      // fourteen refills (through 168 s): rings of ten at 9 - 9.8 m (clear of the cracked wall), each turned a little
      waves: Array.from({ length: 14 }, (_, k) => ring(10, 9 + (k % 3) * 0.4, "clear", ((k * 13) % 36) * DEG)),
      orbs: [
         { x: -12.6, y: 1, z: 0 },
         { x: 12.6, y: 1, z: 2 },
         { x: 5, y: 1, z: -12 },
         { x: 5, y: 1, z: 11.6 },
         { x: -9, y: 3.1, z: 6 },
      ],
      secrets: [
         { x: 0, y: 1, z: 13.4 },
         { x: 13, y: 1, z: 0 },
         { x: -9, y: 3.4, z: 6 },
      ],
      night: false,
      boss: true,
   },
};

/** The boss fight's gem fountains: at each phase start these rings refill the floor (the boss level only). */
export const FOUNTAINS: GemSpec[][] = [ring(16, 8, "clear", 11 * DEG), [...ring(12, 8.5, "clear", 4 * DEG), ...ring(4, 4, "gold", 45 * DEG)]];

/** Where the Glutton waits; his mouth is BOSS_MOUTH m in front of his centre (toward the hero). */
export const BOSS_HOME: XZ = { x: 0, z: 4 };
