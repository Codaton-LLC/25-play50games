// The arena a level spec builds (pure): the gems with their link weights, the solid boxes (the
// cracked crystal wall, the ghost wall, the vault and pocket walls), pedestals, frost sweepers,
// sinking tiles, slimes, chests and their burst gems, and the beacons. The rules (rules.ts) and the
// scene read the same arena.
import { FOUNTAINS, LEVELS, type ArenaSpec, type Box, type GemKind, type GemSpec, type PedestalSpec, type SweeperSpec, type TileSpec, type XYZ, type XZ } from "./levels";
import type { LevelId } from "../../types";

export const HERO_R = 0.4;
/** the train: links trail the hero's exact path this far apart, at most MAX_LINKS of them */
export const LINK_SPACING = 0.8;
export const MAX_LINKS = 20;
/** a gem is taken when the hero's centre comes this close (Zuno's magnet adds MAGNET_EXTRA) */
export const PICKUP_R = 0.9;
export const MAGNET_EXTRA = 1.5;
/** a beacon banks the train when the hero comes this close */
export const BANK_R = 1.6;
/** a bank of n links (gold counts 2) scores min(BANK_CAP, n^2) */
export const BANK_CAP = 400;
/** the head this close to a link (from CUT_SKIP back) cuts the train there */
export const CUT_R = 0.5;
export const CUT_SKIP = 3;
/** the head back within LASSO_R of a link (from LASSO_MIN back) without cutting closes a loop */
export const LASSO_R = 1.1;
export const LASSO_MIN = 4;
/** cut links scatter as loose gems for this long */
export const SCATTER_MS = 3000;
/** a recorded path sample every PATH_STEP m (the links sit on this polyline) */
export const PATH_STEP = 0.1;
export const PATH_CAP = Math.ceil(((MAX_LINKS + 2) * LINK_SPACING) / PATH_STEP) + 8;
export const PED_R = 0.8;
export const CHEST_R = 1.0;
export const SLIME_R = 0.55;
export const ORB_R = 1.0;
export const SECRET_R = 1.1;
/** the frost sweeper's band width (m) */
export const SWEEP_BAND = 1.6;
export const WALL_T = 0.4;

export const LINK_WEIGHT: Record<GemKind, number> = { clear: 1, frost: 1, gold: 2 };

/** The six gems a chest bursts into (offsets from the chest), in order. */
export const CHEST_BURST: readonly { dx: number; dz: number; kind: GemKind }[] = [
   { dx: 1.6, dz: 0, kind: "gold" },
   { dx: -1.6, dz: 0, kind: "gold" },
   { dx: 0.8, dz: 1.4, kind: "clear" },
   { dx: -0.8, dz: 1.4, kind: "clear" },
   { dx: 0.8, dz: -1.4, kind: "clear" },
   { dx: -0.8, dz: -1.4, kind: "clear" },
];

export interface Gem extends XZ {
   kind: GemKind;
   /** its height (a pedestal top, else the floor) */
   y: number;
   hidden: boolean;
   /** where it comes from: the level, a chest (index), a lassoed slime (index), a fountain (index) */
   from: "level" | "chest" | "slime" | "fountain" | "wave";
   source: number;
}

export interface Solid extends Box {
   kind: "cracked" | "ghost" | "wall";
   /** a cracked wall's index in crackedWalls (a dash breaks it) */
   index: number;
}

export interface Arena {
   spec: ArenaSpec;
   level: LevelId;
   radius: number;
   startX: number;
   startZ: number;
   startYaw: number;
   durationMs: number;
   /** every gem that can ever exist: the level's, then each chest's burst, then each slime's gold */
   gems: Gem[];
   /** gems[0 .. levelGems) are on the floor from the start */
   levelGems: number;
   chestGem0: number;
   slimeGem0: number;
   /** the refill waves' gems (wave k at (k + 1) * waveEveryMs) */
   waveGem0: number;
   waveEveryMs: number;
   fountainGem0: number;
   pedestals: PedestalSpec[];
   solids: Solid[];
   sweepers: SweeperSpec[];
   tiles: TileSpec | null;
   beacons: XZ[];
   beaconEveryMs: number;
   orbs: XYZ[];
   secrets: XYZ[];
   /** the pocket behind the cracked wall and the vault behind the ghost wall (secrets, tests) */
   pocket: Box;
   vault: Box;
}

function wallsAround(b: Box, open: "north" | "south" | "west" | "east", t = WALL_T): Box[] {
   const out: Box[] = [];
   if (open !== "south") out.push({ x0: b.x0, x1: b.x1, z0: b.z0 - t / 2, z1: b.z0 + t / 2 });
   if (open !== "north") out.push({ x0: b.x0, x1: b.x1, z0: b.z1 - t / 2, z1: b.z1 + t / 2 });
   if (open !== "west") out.push({ x0: b.x0 - t / 2, x1: b.x0 + t / 2, z0: b.z0, z1: b.z1 });
   if (open !== "east") out.push({ x0: b.x1 - t / 2, x1: b.x1 + t / 2, z0: b.z0, z1: b.z1 });
   return out;
}

export function buildArena(spec: ArenaSpec): Arena {
   const gems: Gem[] = [];
   const add = (g: GemSpec, y: number, from: Gem["from"], source: number) =>
      gems.push({ x: g.x, z: g.z, kind: g.kind, y, hidden: !!g.hidden, from, source });
   for (const g of spec.gems) add(g, g.pedestal !== undefined ? spec.pedestals[g.pedestal].h : 0, "level", -1);
   const levelGems = gems.length;
   const chestGem0 = gems.length;
   spec.chests.forEach((c, ci) => {
      for (const b of CHEST_BURST) add({ x: c.x + b.dx, z: c.z + b.dz, kind: b.kind }, 0, "chest", ci);
   });
   const slimeGem0 = gems.length;
   spec.slimes.forEach((s, si) => add({ x: s.x, z: s.z, kind: "gold" }, 0, "slime", si));
   const waveGem0 = gems.length;
   spec.waves.forEach((w, k) => w.forEach((g) => add(g, 0, "wave", k)));
   const fountainGem0 = gems.length;
   // the boss level's fountains refill the floor at the start of P2 and P3
   if (spec.boss) FOUNTAINS.forEach((ring, f) => ring.forEach((g) => add(g, 0, "fountain", f)));
   // the cracked wall closes a pocket against the east rim; the vault's south side is the ghost wall
   const cw = spec.crackedWalls[0];
   const pocket: Box = { x0: cw.x1, x1: spec.radius - 0.3, z0: cw.z0, z1: cw.z1 };
   const solids: Solid[] = [];
   spec.crackedWalls.forEach((w, i) => solids.push({ ...w, kind: "cracked", index: i }));
   solids.push({ ...spec.ghostWall, kind: "ghost", index: -1 });
   // the pocket's north and south walls (its west side is the cracked wall, its east side the rim)
   for (const w of wallsAround(pocket, "west")) if (w.x1 - w.x0 > 1) solids.push({ ...w, kind: "wall", index: -1 });
   const v = spec.vault;
   const g = spec.ghostWall;
   solids.push({ x0: v.x0, x1: g.x0, z0: v.z0 - WALL_T / 2, z1: v.z0 + WALL_T / 2, kind: "wall", index: -1 });
   solids.push({ x0: g.x1, x1: v.x1, z0: v.z0 - WALL_T / 2, z1: v.z0 + WALL_T / 2, kind: "wall", index: -1 });
   solids.push({ x0: v.x0 - WALL_T / 2, x1: v.x0 + WALL_T / 2, z0: v.z0, z1: v.z1 + 0.6, kind: "wall", index: -1 });
   solids.push({ x0: v.x1 - WALL_T / 2, x1: v.x1 + WALL_T / 2, z0: v.z0, z1: v.z1 + 0.6, kind: "wall", index: -1 });
   return {
      spec,
      level: spec.id,
      radius: spec.radius,
      startX: spec.start.x,
      startZ: spec.start.z,
      startYaw: Math.PI,
      durationMs: spec.durationMs,
      gems,
      levelGems,
      chestGem0,
      slimeGem0,
      waveGem0,
      waveEveryMs: spec.waveEveryMs,
      fountainGem0,
      pedestals: spec.pedestals,
      solids,
      sweepers: spec.sweepers,
      tiles: spec.tiles,
      beacons: spec.beacons,
      beaconEveryMs: spec.beaconEveryMs ?? 0,
      orbs: spec.orbs,
      secrets: spec.secrets,
      pocket,
      vault: spec.vault,
   };
}

const CACHE = new Map<LevelId, Arena>();
export function arenaFor(level: LevelId): Arena {
   let a = CACHE.get(level);
   if (!a) {
      a = buildArena(LEVELS[level]);
      CACHE.set(level, a);
   }
   return a;
}

export function inBox(b: Box, x: number, z: number, grow = 0): boolean {
   return x > b.x0 - grow && x < b.x1 + grow && z > b.z0 - grow && z < b.z1 + grow;
}

/** Pushes a point out of a box (grown by HERO_R) along the shortest axis. */
export function pushOutOf(b: Box, x: number, z: number, out: { x: number; z: number }, grow = HERO_R): boolean {
   if (!(x > b.x0 - grow && x < b.x1 + grow && z > b.z0 - grow && z < b.z1 + grow)) return false;
   const dl = x - (b.x0 - grow);
   const dr = b.x1 + grow - x;
   const db = z - (b.z0 - grow);
   const dt = b.z1 + grow - z;
   const m = Math.min(dl, dr, db, dt);
   out.x = x;
   out.z = z;
   if (m === dl) out.x = b.x0 - grow;
   else if (m === dr) out.x = b.x1 + grow;
   else if (m === db) out.z = b.z0 - grow;
   else out.z = b.z1 + grow;
   return true;
}

/** The sweeper's frost band now: its x range, or null while it rests. */
export function sweepBand(sw: SweeperSpec, ms: number, out: { x0: number; x1: number }): boolean {
   const t = (((ms + sw.offsetMs) % sw.periodMs) + sw.periodMs) % sw.periodMs;
   if (t >= sw.sweepMs) return false;
   const k = t / sw.sweepMs;
   const cx = sw.x0 - SWEEP_BAND / 2 + (sw.x1 - sw.x0 + SWEEP_BAND) * k;
   out.x0 = Math.max(sw.x0, cx - SWEEP_BAND / 2);
   out.x1 = Math.min(sw.x1, cx + SWEEP_BAND / 2);
   return out.x1 > out.x0;
}

/** Which tile group is sunk now (-1: none / no tiles). */
export function sunkGroup(tiles: TileSpec | null, ms: number): number {
   if (!tiles) return -1;
   return Math.floor(ms / tiles.everyMs) % tiles.groups;
}

/** Is (x, z) over a sunk tile now? */
export function overPit(arena: Arena, x: number, z: number, ms: number): boolean {
   const g = sunkGroup(arena.tiles, ms);
   if (g < 0 || !arena.tiles) return false;
   for (const c of arena.tiles.cells) if (c.group === g && inBox(c, x, z)) return true;
   return false;
}

/** Is beacon i taking banks now? (Level 4: one at a time, moving every beaconEveryMs.) */
export function beaconActive(arena: Arena, i: number, ms: number): boolean {
   if (!arena.beaconEveryMs) return true;
   return Math.floor(ms / arena.beaconEveryMs) % arena.beacons.length === i;
}

/** The link weight of everything that can ever be collected on a level (the proof's supply). */
export function linkSupply(arena: Arena): number {
   let w = 0;
   for (const g of arena.gems) w += LINK_WEIGHT[g.kind];
   return w;
}
