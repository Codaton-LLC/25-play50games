// The storm tunnel: the course data and the five level layouts (pure data, no React, no three.js).
// A level is a chain of rooms along -z (forward), each a little puzzle of fans you turn (four compass
// directions, a tap = 90° clockwise seen from above), vents you switch (an up-current), lift platforms
// that ride their vent, rails and auto-rotating fans, and the five heroes' side routes (kits). Every
// room template also writes the honest bot's plan for its main route (bot.ts), so a layout change
// keeps its bot. README "Levels" lists each room.
//
// Units: 1 = 1 m; forward is -z, up is +y. A box is min/max on each axis.
import type { LevelId } from "@/arcade3d/types";
import type { HeroId } from "./heroes";
import { LEVELS, type WindLevel } from "./levels";
import { SECRETS } from "./progression";

// ---------- shapes ----------

export type Dir = "n" | "e" | "s" | "w";
/** a tap turns a fan 90° clockwise seen from above: n -> e -> s -> w -> n */
export const DIRS: readonly Dir[] = ["n", "e", "s", "w"];
export const DIR_X: readonly number[] = [0, 1, 0, -1];
export const DIR_Z: readonly number[] = [-1, 0, 1, 0];
export const dirIndex = (d: Dir): number => DIRS.indexOf(d);

export interface Box {
   x0: number;
   x1: number;
   y0: number;
   y1: number;
   z0: number;
   z1: number;
}

/** solid: always; cover: Riko breaks it; ghost: Vexa phases through it; gate: the Gale Engine's, open once it is down; shutter: closes behind you as the Gale Engine wakes */
export type BlockKind = "solid" | "cover" | "ghost" | "gate" | "shutter";
export type BlockLook = "floor" | "wall" | "ledge" | "pillar" | "duct" | "cover" | "ghost" | "gate" | "housing" | "shelf";

export interface BlockDef extends Box {
   kind: BlockKind;
   look: BlockLook;
   room: number;
}

/** A fan (turnable, a horizontal current along its direction) or a vent (an up-current), or a lift's vent. */
export type FanKind = "fan" | "vent";
/** level 5: the Gale Engine's side fans (phase 1), the crate vents and the crate fans (phase 2) */
export type BossRole = "side" | "crateVent" | "crateFan";

export interface FanDef {
   kind: FanKind;
   /** the base (floor) point: x, y = the floor it stands on, z */
   x: number;
   y: number;
   z: number;
   /** fans: the start direction (index into DIRS); vents: unused */
   dir: number;
   on: boolean;
   /** the current's length before walls cut it */
   length: number;
   /** a tap turns it (fans) / switches it (vents) */
   turnable: boolean;
   /** fans: a held Action switches it on / off */
   toggle: boolean;
   /** L4: slides along x between x0 and x1 (dwells at each end); the current moves with it */
   rail?: { x0: number; x1: number; dwellMs: number; moveMs: number; phaseMs: number };
   /** L4: turns itself one step every autoMs (not turnable) */
   autoMs?: number;
   /** a cracked cover (block index): the vent blows only once Riko breaks it */
   cover?: number;
   /** a hidden vent (anemometer index): it blows only once that anemometer spins */
   hidden?: number;
   /** the vent of a lift platform (lift index): it moves the platform, not the hero */
   lift?: number;
   boss?: BossRole;
   room: number;
}

export interface LiftDef {
   x: number;
   z: number;
   hw: number;
   hd: number;
   /** the platform's top at rest and fully up */
   y0: number;
   y1: number;
   /** its vent (fan index) */
   vent: number;
   room: number;
}

/** bonus orbs sit on a hero's side route ("any" = a creative fan setup); main orbs (null) count for the star */
export type OrbGate = HeroId | "any" | null;

export interface OrbDef {
   x: number;
   y: number;
   z: number;
   bonus: OrbGate;
}

export interface ShockDef extends Box {
   room: number;
}

export interface DroneDef {
   /** patrol centre; it swings along x by ax with this period, bobbing a little */
   x: number;
   y: number;
   z: number;
   ax: number;
   periodMs: number;
   phaseMs: number;
   room: number;
}

export interface CrateDef {
   /** rests on this crate vent (fan index) */
   vent: number;
}

export interface AnemoDef {
   x: number;
   y: number;
   z: number;
   /** this fan pointing this way spins it, which opens `opens` (a hidden vent) */
   fan: number;
   dir: number;
   opens: number;
   room: number;
}

export interface SolutionPart {
   fan: number;
   dir?: number;
   on?: boolean;
   /** "anything but": a crosswind that must not point this way (or be off) */
   notDir?: number;
}

export interface RoomDef {
   /** the entry (the larger z) and the exit z */
   z0: number;
   z1: number;
   /** the entry floor and the highest floor in the room */
   floor: number;
   top: number;
   /** the respawn spot (the checkpoint beacon) */
   checkpoint: { x: number; y: number; z: number };
   /** a fan setup room: the storm waits while it is unsolved (the card's risk fix) */
   setup: boolean;
   solution: SolutionPart[];
   name: string;
}

export interface SecretDef {
   x: number;
   y: number;
   z: number;
}

/** The Gale Engine's arena (level 5). */
export interface ArenaDef {
   /** entry z (the boss wakes once you pass it) and the engine's face z */
   z0: number;
   z1: number;
   floor: number;
   gate: number;
   intake: Box;
   /** the blast / suction lane |x| < lane */
   lane: number;
   sideFans: number[];
   crateVents: number[];
   crateFans: number[];
   /** the engine's model spot */
   engine: { x: number; y: number; z: number };
}

/** The honest bot's plan (bot.ts), one step at a time. */
export type BotStep =
   | { t: "go"; x: number; z: number; r?: number; jump?: boolean; ride?: boolean }
   | { t: "waitY"; y: number }
   | { t: "turn"; fan: number; dir: number; from: { x: number; z: number } }
   | { t: "switch"; fan: number; on: boolean; from: { x: number; z: number } }
   /** stand still until the room's moving fan is where the plan wants it (rail dwell / auto direction) */
   | { t: "timing"; fan: number; want: "railEnd" | "dirNow"; dir?: number; minLeftMs?: number }
   /** stand still until a drone's swing leaves the current's line clear for the ride */
   | { t: "clear"; drone: number; x: number; z: number }
   | { t: "boss" };

export interface Course {
   level: LevelId;
   config: WindLevel;
   blocks: BlockDef[];
   fans: FanDef[];
   lifts: LiftDef[];
   orbs: OrbDef[];
   /** main orbs (the all-orbs star counts these) */
   mainOrbs: number;
   shocks: ShockDef[];
   drones: DroneDef[];
   crates: CrateDef[];
   anemos: AnemoDef[];
   rooms: RoomDef[];
   /** aligned with progression SECRETS[level] */
   secrets: SecretDef[];
   start: { x: number; y: number; z: number };
   startZ: number;
   /** the exit (level 5: the Tide Bell's platform): standing in it wins */
   goal: Box;
   goalNearZ: number;
   bell: { x: number; y: number; z: number };
   arena: ArenaDef | null;
   bot: BotStep[];
   /** where each room's steps start in `bot` (a respawn replays its room) */
   botStart: number[];
   /** decor: tube rings along the tunnel (z centres), fan towers outside */
   rings: number[];
}

// ---------- geometry constants (rules.ts reads them) ----------

/** a fan's current runs along this height over its base (the hub), this far in front of it, this wide (radius) */
export const HUB = 1.4;
export const FAN_FACE = 0.55;
export const FAN_R = 1.5;
/** a vent's current starts this far over its base, this wide (radius) */
export const VENT_TOP = 0.5;
export const VENT_R = 1.3;
/** the tunnel's inner half-width (the side walls stand outside it) */
export const HALF_W = 7;
const WALL_T = 1;
/** side walls stand this far over the room's highest floor */
const WALL_UP = 4.5;

// ---------- the builder ----------

interface Builder {
   level: LevelId;
   z: number;
   F: number;
   blocks: BlockDef[];
   fans: FanDef[];
   lifts: LiftDef[];
   orbs: OrbDef[];
   shocks: ShockDef[];
   drones: DroneDef[];
   crates: CrateDef[];
   anemos: AnemoDef[];
   rooms: RoomDef[];
   secrets: Record<string, SecretDef>;
   bot: BotStep[];
   botStart: number[];
   /** left-wall cut-outs of the current room: ghost panels (Vexa) and openings above a height */
   leftCuts: { z0: number; z1: number; ghostTop?: number; above?: number }[];
   arena: ArenaDef | null;
   rings: number[];
}

function newBuilder(level: LevelId): Builder {
   return {
      level,
      z: 0,
      F: 0,
      blocks: [],
      fans: [],
      lifts: [],
      orbs: [],
      shocks: [],
      drones: [],
      crates: [],
      anemos: [],
      rooms: [],
      secrets: {},
      bot: [],
      botStart: [],
      leftCuts: [],
      arena: null,
      rings: [],
   };
}

const room = (b: Builder) => b.rooms.length;

/** a block from two z values in any order */
function block(b: Builder, x0: number, x1: number, y0: number, y1: number, za: number, zb: number, look: BlockLook, kind: BlockKind = "solid", r = room(b)): number {
   b.blocks.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: Math.min(y0, y1), y1: Math.max(y0, y1), z0: Math.min(za, zb), z1: Math.max(za, zb), kind, look, room: r });
   return b.blocks.length - 1;
}

/** a floor slab across the tunnel, top at y, from za to zb */
function floor(b: Builder, za: number, zb: number, y: number, x0 = -HALF_W, x1 = HALF_W, look: BlockLook = "floor"): number {
   return block(b, x0, x1, y - 1, y, za, zb, look);
}

/** a step: solid from y0 up to the top y (a ledge face you cannot jump) */
function ledge(b: Builder, za: number, zb: number, y0: number, top: number, x0 = -HALF_W, x1 = HALF_W): number {
   return block(b, x0, x1, y0 - 1, top, za, zb, "ledge");
}

function fan(b: Builder, x: number, y: number, z: number, dir: Dir, opts: Partial<FanDef> = {}): number {
   b.fans.push({ kind: "fan", x, y, z, dir: dirIndex(dir), on: true, length: 14, turnable: true, toggle: true, room: room(b), ...opts });
   const i = b.fans.length - 1;
   // the housing is solid (a fan on a rail rides its carriage, not a block)
   if (!opts.rail) block(b, x - 0.55, x + 0.55, y, y + 2.3, z - 0.5, z + 0.5, "housing");
   return i;
}

function vent(b: Builder, x: number, y: number, z: number, length: number, opts: Partial<FanDef> = {}): number {
   b.fans.push({ kind: "vent", x, y, z, dir: 0, on: true, length, turnable: false, toggle: false, room: room(b), ...opts });
   return b.fans.length - 1;
}

function orb(b: Builder, x: number, y: number, z: number, bonus: OrbGate = null): void {
   b.orbs.push({ x, y, z, bonus });
}

function secret(b: Builder, id: string, x: number, y: number, z: number): void {
   b.secrets[id] = { x, y, z };
}

/** Opens a room: its entry floor height and z, a fan-setup flag and its solution (filled in by the template). */
function openRoom(b: Builder, name: string, setup: boolean): RoomDef {
   const r: RoomDef = { z0: b.z, z1: b.z, floor: b.F, top: b.F, checkpoint: { x: 0, y: b.F, z: b.z - 2.2 }, setup, solution: [], name };
   b.leftCuts = [];
   b.botStart[b.rooms.length] = b.bot.length;
   return r;
}

/** Closes a room: the side walls (with the left wall's cut-outs) and the room record. */
function closeRoom(b: Builder, r: RoomDef, z1: number, top: number): void {
   r.z1 = z1;
   r.top = top;
   const yLow = r.floor - 9;
   const yTop = top + WALL_UP;
   const ri = b.rooms.length;
   block(b, HALF_W, HALF_W + WALL_T, yLow, yTop, r.z0, z1, "wall", "solid", ri);
   // the left wall, split round the cut-outs (sorted from the entry forwards)
   const cuts = b.leftCuts.slice().sort((p, q) => q.z1 - p.z1);
   let zc = r.z0;
   for (const c of cuts) {
      if (c.z0 < zc) block(b, -HALF_W - WALL_T, -HALF_W, yLow, yTop, zc, c.z0, "wall", "solid", ri);
      if (c.ghostTop !== undefined) {
         // a ghost fan housing (Vexa phases through it), the wall above it solid
         block(b, -HALF_W - WALL_T, -HALF_W, yLow, c.ghostTop, c.z1, c.z0, "ghost", "ghost", ri);
         block(b, -HALF_W - WALL_T, -HALF_W, c.ghostTop, yTop, c.z1, c.z0, "wall", "solid", ri);
      } else if (c.above !== undefined) {
         block(b, -HALF_W - WALL_T, -HALF_W, yLow, c.above, c.z1, c.z0, "wall", "solid", ri);
      }
      zc = c.z1;
   }
   if (zc > z1) block(b, -HALF_W - WALL_T, -HALF_W, yLow, yTop, zc, z1, "wall", "solid", ri);
   b.rooms.push(r);
   b.rings.push((r.z0 + z1) / 2);
}

// ---------- the heroes' side routes (kits): bonus orbs, never needed for the exit ----------

/** Nami: a shelf 3.5 m up (a plain jump reaches 2 m, her double jump 4 m) with two orbs. */
function namiShelf(b: Builder, side: 1 | -1, zc: number, F: number): void {
   const x0 = side * 4.7;
   const x1 = side * HALF_W;
   block(b, x0, x1, F - 1, F + 3.5, zc - 1.6, zc + 1.6, "shelf");
   orb(b, side * 5.85, F + 4.3, zc - 0.7, "nami");
   orb(b, side * 5.85, F + 4.3, zc + 0.7, "nami");
}

/** Kiro: a static-shock vent with two orbs inside it (a touch zaps and throws you back; his shield rides through). */
function kiroShock(b: Builder, side: 1 | -1, zc: number, F: number): void {
   const x0 = side * 4.0;
   const x1 = side * 6.9;
   b.shocks.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), y0: F, y1: F + 2.4, z0: zc - 2, z1: zc + 2, room: room(b) });
   orb(b, side * 5.45, F + 0.9, zc - 0.8, "kiro");
   orb(b, side * 5.45, F + 0.9, zc + 0.8, "kiro");
}

/** Zuno: two orbs hanging where no current goes, within his 7 m magnet of the route. */
function zunoOrbs(b: Builder, x: number, y: number, z: number): void {
   orb(b, x, y, z - 0.8, "zuno");
   orb(b, x, y, z + 0.8, "zuno");
}

/** Riko: a cracked vent cover; his dash breaks it and the vent under it blows (two orbs up its current). */
function rikoVent(b: Builder, side: 1 | -1, zc: number, F: number, length: number): void {
   const x = side * 5.5;
   const cover = block(b, x - 1.15, x + 1.15, F, F + 1.6, zc - 1.15, zc + 1.15, "cover", "cover");
   vent(b, x, F, zc, length, { cover });
   // out of a jump's reach from the cover's top (1.6 + 2 m), inside the current's hover
   orb(b, x, F + length * 0.78, zc, "riko");
   orb(b, x, F + length * 0.96, zc, "riko");
}

/**
 * Vexa: a ghost fan housing in the left wall at zIn, a maintenance duct outside the wall to zOut, and a
 * vent at its end that lifts her back over the wall's cut-out onto the room's upper floor (rise over F).
 * Two orbs (and on some levels the sticker) in the duct: a quiet shortcut.
 */
function vexaDuct(b: Builder, zIn: number, zOut: number, F: number, rise: number, sticker: boolean): void {
   const dx0 = -HALF_W - WALL_T - 2.6;
   const dx1 = -HALF_W - WALL_T;
   b.leftCuts.push({ z0: zIn + 1.4, z1: zIn - 1.4, ghostTop: F + 3.6 });
   // the duct floor runs in under the ghost housing (no gap to fall through)
   block(b, dx0, -HALF_W, F - 1, F, zIn + 1.4, zOut - 1.4, "duct");
   block(b, dx0 - WALL_T, dx0, F - 1, F + rise + 4.5, zIn + 1.4, zOut - 1.4, "duct");
   block(b, dx0, dx1, F - 1, F + rise + 4.5, zOut - 1.4, zOut - 2.4, "duct");
   const vx = (dx0 + dx1) / 2;
   vent(b, vx, F, zOut, rise + 2.8);
   // the cut-out over the room's upper floor where the duct's vent lifts her back in
   b.leftCuts.push({ z0: zOut + 1.6, z1: zOut - 1.4, above: F + rise });
   orb(b, vx, F + 0.9, (zIn + zOut) / 2 + 1.5, "vexa");
   orb(b, vx, F + 0.9, (zIn + zOut) / 2 - 1.5, "vexa");
   if (sticker) secret(b, "duct", vx, F + 1.0, zOut + 2.6);
}

/** An anemometer post spun by `fan` pointing `dir`; it opens a hidden vent whose current carries the shard. */
function anemometer(b: Builder, x: number, z: number, F: number, fanIndex: number, dir: Dir, vx: number, vz: number, length: number): void {
   const opens = vent(b, vx, F, vz, length, { on: false, hidden: b.anemos.length });
   b.anemos.push({ x, y: F, z, fan: fanIndex, dir: dirIndex(dir), opens, room: room(b) });
   block(b, x - 0.35, x + 0.35, F, F + 2.4, z - 0.35, z + 0.35, "housing");
   secret(b, "anemo", vx, F + VENT_TOP + length - 0.7, vz);
}

// ---------- the room templates ----------

/** The start pad behind z = 0 (the hero starts at z = 3). */
function startPad(b: Builder): void {
   floor(b, 8, 0, b.F);
   block(b, -HALF_W - WALL_T, -HALF_W, b.F - 9, b.F + 6, 8, 0, "wall", "solid", 0);
   block(b, HALF_W, HALF_W + WALL_T, b.F - 9, b.F + 6, 8, 0, "wall", "solid", 0);
   block(b, -HALF_W - WALL_T, HALF_W + WALL_T, b.F - 9, b.F + 6, 8, 9, "wall", "solid", 0);
}

/**
 * VENT: a vent's up-current lifts you onto a ledge `rise` high (the ledge face cannot be jumped).
 * on = already blowing (level 1 beat 1); off = tap it to switch it on (a setup room).
 */
function roomVent(b: Builder, o: { rise: number; on: boolean; vx?: number; len?: number; name?: string }, kits?: (r: RoomDef, zs: number, F: number) => void): void {
   const zs = b.z;
   const F = b.F;
   const len = o.len ?? 24;
   const vx = o.vx ?? 0;
   const r = openRoom(b, o.name ?? "Updraft", !o.on);
   floor(b, zs, zs - 12, F);
   ledge(b, zs - 12, zs - len, F, F + o.rise);
   const v = vent(b, vx, F, zs - 10.2, o.rise + 2.6, { on: o.on, turnable: !o.on });
   if (!o.on) r.solution.push({ fan: v, on: true });
   orb(b, vx, F + o.rise * 0.5, zs - 10.2);
   orb(b, vx * 0.7, F + o.rise + 0.9, zs - 16.5);
   orb(b, 0, F + o.rise + 0.9, zs - 20);
   if (!o.on) b.bot.push({ t: "switch", fan: v, on: true, from: { x: vx + 2.1, z: zs - 9.4 } });
   b.bot.push({ t: "go", x: vx, z: zs - 10.2, r: 0.35, ride: true }, { t: "waitY", y: F + o.rise + 1.2 }, { t: "go", x: vx, z: zs - 14.2 }, { t: "go", x: 0, z: zs - len + 1.6 });
   kits?.(r, zs, F);
   b.F = F + o.rise;
   b.z = zs - len;
   closeRoom(b, r, b.z, b.F);
}

/**
 * BRIDGE: a fan at the gap's edge; turn it to face forward (n) and its current carries you over an 11 m
 * gap (a jump makes 5 m, Nami's double 8). `crosswind`: a side fan on a bracket over the gap whose
 * current (pointing w) crosses the bridge and blows you into the left wall: switch it off (hold) or turn it.
 */
function roomBridge(
   b: Builder,
   o: { fx?: number; start: Dir; crosswind?: Dir; auto?: number; rail?: boolean; name?: string },
   kits?: (r: RoomDef, zs: number, F: number) => void,
): void {
   const zs = b.z;
   const F = b.F;
   const fx = o.fx ?? 2.5;
   const r = openRoom(b, o.name ?? (o.crosswind ? "Crosswind" : o.auto ? "Turning fan" : o.rail ? "Rail fan" : "Bridge current"), !o.auto);
   floor(b, zs, zs - 8, F);
   floor(b, zs - 19, zs - 30, F);
   let f: number;
   if (o.rail) {
      // a carriage rail along the gap's edge: the fan dwells 3 s at each end; only the far end lines up
      // with the doorway in the window wall over the landing
      f = fan(b, -4, F, zs - 7.0, o.start, { rail: { x0: -4, x1: 3, dwellMs: 3000, moveMs: 1800, phaseMs: 0 } });
      block(b, -HALF_W, -0.6, F - 1, F + 5, zs - 18.8, zs - 19.6, "wall");
      block(b, 6.6, HALF_W, F - 1, F + 5, zs - 18.8, zs - 19.6, "wall");
      block(b, -0.6, 6.6, F + 3.6, F + 5, zs - 18.8, zs - 19.6, "wall");
   } else if (o.auto) {
      f = fan(b, fx, F, zs - 6.4, o.start, { autoMs: o.auto, turnable: false, toggle: false });
   } else {
      f = fan(b, fx, F, zs - 6.4, o.start);
   }
   const fxRide = o.rail ? 3 : fx;
   r.solution.push({ fan: f, dir: 0, on: true });
   orb(b, fxRide, F + HUB, zs - 11);
   orb(b, fxRide, F + HUB, zs - 14.5);
   orb(b, fxRide, F + HUB, zs - 18);
   let cross = -1;
   if (o.crosswind) {
      // the bracket on the right wall holding the crosswind fan, reachable from the floor's edge
      block(b, 5.2, HALF_W, F - 1, F, zs - 8, zs - 10.4, "pillar");
      cross = fan(b, 6.1, F, zs - 9.4, o.crosswind);
      r.solution.push({ fan: cross, notDir: dirIndex("w") });
   }
   if (o.auto) {
      b.bot.push({ t: "go", x: fx - 2.4, z: zs - 3.4 }, { t: "timing", fan: f, want: "dirNow", dir: 0, minLeftMs: 2800 }, { t: "go", x: fx, z: zs - 7.5, r: 0.3, ride: true });
   } else if (o.rail) {
      b.bot.push({ t: "turn", fan: f, dir: 0, from: { x: -5.6, z: zs - 5.4 } }, { t: "go", x: 3, z: zs - 5.6 }, { t: "timing", fan: f, want: "railEnd", minLeftMs: 2400 }, { t: "go", x: 3, z: zs - 7.6, r: 0.3, ride: true });
   } else {
      if (o.start !== "n") b.bot.push({ t: "turn", fan: f, dir: 0, from: { x: fx - 1.6, z: zs - 4.8 } });
      if (o.crosswind === "w") b.bot.push({ t: "switch", fan: cross, on: false, from: { x: 5.6, z: zs - 7.2 } });
      b.bot.push({ t: "go", x: fx - 1.9, z: zs - 7.4 }, { t: "go", x: fx, z: zs - 7.5, r: 0.3, ride: true });
   }
   b.bot.push({ t: "go", x: fxRide, z: zs - 23.5 }, { t: "go", x: 0, z: zs - 28 });
   kits?.(r, zs, F);
   b.z = zs - 30;
   closeRoom(b, r, b.z, F);
}

/**
 * CHAIN: up then across. Switch on the vent (its current lifts you onto the upper floor `rise` high),
 * then turn the upper fan forward to cross the 11 m gap to the exit floor.
 */
function roomChain(
   b: Builder,
   o: { rise: number; ventOn?: boolean; vx?: number; fx?: number; start: Dir; drone?: boolean; name?: string; gust?: boolean },
   kits?: (r: RoomDef, zs: number, F: number) => void,
): void {
   const zs = b.z;
   const F = b.F;
   const vx = o.vx ?? -2;
   const fx = o.fx ?? 2.5;
   const U = F + o.rise;
   const r = openRoom(b, o.name ?? "Up and across", !(o.ventOn && o.start === "n"));
   floor(b, zs, zs - 10, F);
   ledge(b, zs - 10, zs - 18, F, U);
   floor(b, zs - 29, zs - 40, U);
   const v = vent(b, vx, F, zs - 8.4, o.rise + 2.6, { on: !!o.ventOn, turnable: true });
   const f = fan(b, fx, U, zs - 16.4, o.start);
   r.solution.push({ fan: v, on: true }, { fan: f, dir: 0, on: true });
   orb(b, vx, F + o.rise * 0.5, zs - 8.4);
   orb(b, fx, U + HUB, zs - 21.5);
   orb(b, fx, U + HUB, zs - 25.5);
   if (o.gust) {
      // the "creative setup": turned backwards (s), the upper fan carries you back over the start floor
      // through the gust shard, 7 m up where nothing else goes; no exit needs it
      secret(b, "gust", fx, U + HUB, zs - 4.5);
   }
   if (o.drone) b.drones.push({ x: fx, y: U + HUB, z: zs - 23.5, ax: 4.4, periodMs: 5200, phaseMs: 0, room: room(b) });
   if (!o.ventOn) b.bot.push({ t: "switch", fan: v, on: true, from: { x: vx + 2.1, z: zs - 7.4 } });
   b.bot.push({ t: "go", x: vx, z: zs - 8.4, r: 0.35, ride: true }, { t: "waitY", y: U + 1.2 }, { t: "go", x: vx, z: zs - 12.6 });
   if (o.start !== "n") b.bot.push({ t: "turn", fan: f, dir: 0, from: { x: fx - 1.6, z: zs - 14.8 } });
   b.bot.push({ t: "go", x: fx - 1.9, z: zs - 17.5 });
   if (o.drone) b.bot.push({ t: "clear", drone: b.drones.length - 1, x: fx, z: zs - 23.5 });
   b.bot.push({ t: "go", x: fx, z: zs - 17.6, r: 0.3, ride: true }, { t: "go", x: fx, z: zs - 32.5 }, { t: "go", x: 0, z: zs - 38 });
   kits?.(r, zs, F);
   b.F = U;
   b.z = zs - 40;
   closeRoom(b, r, b.z, U);
}

/**
 * CORNER (level 2's crosswind): the bridge fan carries you forward over a long gap that has no far side
 * in its line; a side fan on a catwalk crosses the gap, and where the two currents meet they add as
 * vectors: you curve left onto the island by the left wall, and the island's fan takes you on.
 */
function roomCorner(b: Builder, o: { aStart: Dir; bStart: Dir; bOn?: boolean; cStart: Dir; name?: string }, kits?: (r: RoomDef, zs: number, F: number) => void): void {
   const zs = b.z;
   const F = b.F;
   const r = openRoom(b, o.name ?? "Crossing currents", true);
   floor(b, zs, zs - 8, F);
   // the catwalk along the right wall out to the side fan
   floor(b, zs - 8, zs - 16.2, F, 4.6, HALF_W, "pillar");
   // the island by the left wall, and the exit floor
   floor(b, zs - 13, zs - 25, F, -HALF_W, -4.2, "pillar");
   floor(b, zs - 36, zs - 46, F);
   const a = fan(b, -2.2, F, zs - 6.4, o.aStart);
   const s = fan(b, 5.8, F, zs - 15.2, o.bStart, { on: o.bOn ?? true });
   const c = fan(b, -5.95, F, zs - 23.6, o.cStart);
   r.solution.push({ fan: a, dir: 0, on: true }, { fan: s, dir: dirIndex("w"), on: true }, { fan: c, dir: 0, on: true });
   orb(b, -2.2, F + HUB, zs - 11);
   orb(b, -4.4, F + HUB, zs - 15.2);
   orb(b, -5.0, F + HUB, zs - 29);
   orb(b, -5.5, F + HUB, zs - 33);
   b.bot.push({ t: "go", x: 5.8, z: zs - 6.5 });
   if (o.bStart !== "w") b.bot.push({ t: "turn", fan: s, dir: dirIndex("w"), from: { x: 5.8, z: zs - 12.8 } });
   if (o.bOn === false) b.bot.push({ t: "switch", fan: s, on: true, from: { x: 5.8, z: zs - 12.8 } });
   b.bot.push({ t: "go", x: 5.8, z: zs - 6.5 });
   if (o.aStart !== "n") b.bot.push({ t: "turn", fan: a, dir: 0, from: { x: -0.6, z: zs - 4.8 } });
   b.bot.push({ t: "go", x: -0.2, z: zs - 7.4 }, { t: "go", x: -2.2, z: zs - 7.5, r: 0.3, ride: true }, { t: "go", x: -2.2, z: zs - 14 });
   // curved onto the island by the two currents (they add where they cross), dropped at the side current's end
   b.bot.push({ t: "go", x: -6.2, z: zs - 15.2, r: 0.6 }, { t: "go", x: -4.6, z: zs - 21.6 });
   if (o.cStart !== "n") b.bot.push({ t: "turn", fan: c, dir: 0, from: { x: -4.6, z: zs - 21.6 } });
   b.bot.push({ t: "go", x: -4.6, z: zs - 24.7, r: 0.3, ride: true }, { t: "go", x: -5.95, z: zs - 39 }, { t: "go", x: 0, z: zs - 44 });
   kits?.(r, zs, F);
   b.z = zs - 46;
   closeRoom(b, r, b.z, F);
}

/** LIFT: a fan-lift platform rides its vent: stand on it, switch the vent on, and it lifts you `rise` up the face. */
function roomLift(b: Builder, o: { rise: number; name?: string; bridge?: Dir }, kits?: (r: RoomDef, zs: number, F: number) => void): void {
   const zs = b.z;
   const F = b.F;
   const U = F + o.rise;
   const r = openRoom(b, o.name ?? "Fan lift", true);
   floor(b, zs, zs - 11.6, F);
   ledge(b, zs - 16.4, zs - 26, F, U);
   const li = b.lifts.length;
   const v = vent(b, 0, F - 0.6, zs - 14, 0, { on: false, turnable: true, lift: li });
   b.lifts.push({ x: 0, z: zs - 14, hw: 2.3, hd: 2.3, y0: F, y1: U, vent: v, room: room(b) });
   r.solution.push({ fan: v, on: true });
   orb(b, 0, F + o.rise * 0.4 + 1, zs - 14);
   orb(b, 0, F + o.rise * 0.8 + 1, zs - 14);
   orb(b, 0, U + 0.9, zs - 21);
   b.bot.push({ t: "go", x: 0, z: zs - 13.6, r: 0.4 }, { t: "switch", fan: v, on: true, from: { x: 0, z: zs - 13.6 } }, { t: "waitY", y: U - 0.05 }, { t: "go", x: 0, z: zs - 20 });
   let end = zs - 26;
   if (o.bridge) {
      // the shaft's top: a gap with a bridge fan on the upper floor's edge
      floor(b, zs - 37, zs - 48, U);
      const f = fan(b, 2.5, U, zs - 24.4, o.bridge);
      r.solution.push({ fan: f, dir: 0, on: true });
      orb(b, 2.5, U + HUB, zs - 30);
      if (o.bridge !== "n") b.bot.push({ t: "turn", fan: f, dir: 0, from: { x: 0.9, z: zs - 22.8 } });
      b.bot.push({ t: "go", x: 0.6, z: zs - 25.5 }, { t: "go", x: 2.5, z: zs - 25.6, r: 0.3, ride: true }, { t: "go", x: 2.5, z: zs - 41 }, { t: "go", x: 0, z: zs - 46 });
      end = zs - 48;
   } else {
      b.bot.push({ t: "go", x: 0, z: zs - 24.4 });
   }
   kits?.(r, zs, F);
   b.F = U;
   b.z = end;
   closeRoom(b, r, b.z, U);
}

/** The exit: the storm door out of the tunnel (levels 1-4). */
function roomExit(b: Builder): void {
   const zs = b.z;
   const F = b.F;
   const r = openRoom(b, "Exit", false);
   floor(b, zs, zs - 12, F);
   // the door frame round the goal
   block(b, -HALF_W, -3.2, F, F + 6, zs - 10.6, zs - 11.6, "wall");
   block(b, 3.2, HALF_W, F, F + 6, zs - 10.6, zs - 11.6, "wall");
   block(b, -3.2, 3.2, F + 4.4, F + 6, zs - 10.6, zs - 11.6, "wall");
   orb(b, 0, F + 1, zs - 4);
   b.bot.push({ t: "go", x: 0, z: zs - 9.4 });
   b.z = zs - 12;
   closeRoom(b, r, b.z, F);
}

/** Level 5: the Gale Engine's arena (34 m), its gate the engine itself. */
function roomArena(b: Builder, kits?: (r: RoomDef, zs: number, F: number) => void): void {
   const zs = b.z;
   const F = b.F;
   const r = openRoom(b, "Gale Engine", true);
   floor(b, zs, zs - 34, F);
   const z1 = zs - 29.5;
   const gate = block(b, -HALF_W, HALF_W, F, F + 12, z1, zs - 34, "gate", "gate");
   block(b, -HALF_W, HALF_W, F - 1, F + 12, zs, zs + 1, "gate", "shutter");
   const sideFans = [fan(b, -5.6, F, zs - 7, "w", { boss: "side", length: 26 }), fan(b, 5.6, F, zs - 7, "w", { boss: "side", length: 26 }), fan(b, 0, F, zs - 3, "s", { boss: "side", length: 26 })];
   const crateVents: number[] = [];
   const crateFans: number[] = [];
   for (const x of [-4, 0, 4]) {
      const cv = vent(b, x, F, zs - 18, 5, { on: false, turnable: true, boss: "crateVent" });
      crateVents.push(cv);
      b.crates.push({ vent: cv });
      block(b, x - 0.95, x + 0.95, F - 1, F + 3.2, zs - 13.6, zs - 15.4, "pillar");
      crateFans.push(fan(b, x, F + 3.2, zs - 14.5, x < 0 ? "e" : x > 0 ? "w" : "s", { boss: "crateFan", length: 20, on: true }));
   }
   b.arena = {
      z0: zs - 1,
      z1,
      floor: F,
      gate,
      intake: { x0: -6.5, x1: 6.5, y0: F, y1: F + 8, z0: z1, z1: z1 + 2.5 },
      lane: 4.2,
      sideFans,
      crateVents,
      crateFans,
      engine: { x: 0, y: F, z: z1 - 2.2 },
   };
   orb(b, -5.6, F + 0.9, zs - 5.0);
   orb(b, 5.6, F + 0.9, zs - 5.0);
   orb(b, 0, F + 0.9, zs - 12.2);
   b.bot.push({ t: "boss" });
   kits?.(r, zs, F);
   b.z = zs - 34;
   closeRoom(b, r, b.z, F + 8);
}

/** Level 5's open sky beyond the tunnel: the Tide Bell on a platform past the last room. */
function roomSky(b: Builder): void {
   const zs = b.z;
   const F = b.F;
   const r = openRoom(b, "Open sky", false);
   floor(b, zs, zs - 14, F);
   orb(b, 0, F + 1, zs - 5);
   b.bot.push({ t: "go", x: 0, z: zs - 11.2 });
   b.z = zs - 14;
   closeRoom(b, r, b.z, F);
}

// ---------- the five levels ----------

type Script = (b: Builder) => void;

const SCRIPTS: Record<LevelId, Script> = {
   // Gentle Wind: the card's three beats: ride one up-current, turn one fan across a gap, chain up then across
   1: (b) => {
      startPad(b);
      roomVent(b, { rise: 6, on: true, name: "Beat 1: ride the updraft" }, (_r, zs, F) => {
         namiShelf(b, 1, zs - 5, F);
      });
      roomBridge(b, { start: "w", name: "Beat 2: turn the fan" }, (_r, zs, F) => {
         kiroShock(b, -1, zs - 3.6, F);
         zunoOrbs(b, -2.6, F + 5.2, zs - 14);
         rikoVent(b, 1, zs - 2.4, F, 7);
      });
      roomChain(b, { rise: 7, start: "e", name: "Beat 3: up, then across", gust: true }, (_r, zs, F) => {
         vexaDuct(b, zs - 3, zs - 13.4, F, 7, true);
      });
      roomExit(b);
   },
   // Cross Wind: crosswinds add to your current as vectors
   2: (b) => {
      startPad(b);
      roomBridge(b, { start: "e", crosswind: "w", name: "Crosswind" }, (_r, zs, F) => {
         namiShelf(b, -1, zs - 4, F);
      });
      roomVent(b, { rise: 5, on: false, vx: 1.5 }, (_r, zs, F) => {
         kiroShock(b, -1, zs - 4, F);
         rikoVent(b, 1, zs - 3, F, 8);
      });
      roomCorner(b, { aStart: "w", bStart: "w", bOn: false, cStart: "w" }, (_r, zs, F) => {
         zunoOrbs(b, 2.6, F + 4.6, zs - 30);
         // the anemometer by the start: point the bridge fan west (into it) and a hidden vent opens
         anemometer(b, -6.2, zs - 6.4, F, b.fans.length - 3, "w", -5.4, zs - 2.4, 7.5);
      });
      roomChain(b, { rise: 6, start: "s" }, (_r, zs, F) => {
         vexaDuct(b, zs - 3, zs - 13.4, F, 6, true);
      });
      roomExit(b);
   },
   // Vertical Lift: a tall shaft of fan lifts; setting the vents moves the platforms as well as you
   3: (b) => {
      startPad(b);
      roomVent(b, { rise: 6, on: false }, (_r, zs, F) => {
         namiShelf(b, 1, zs - 5, F);
         rikoVent(b, -1, zs - 3.6, F, 8.6);
      });
      roomLift(b, { rise: 9 }, (_r, zs, F) => {
         kiroShock(b, 1, zs - 4.4, F);
         // the anemometer beside the lift: the hidden vent's shard
         zunoOrbs(b, -3.6, F + 6.2, zs - 14);
      });
      roomLift(b, { rise: 8, bridge: "s", name: "Shaft top" }, (_r, zs, F) => {
         // the anemometer on the shaft's top by the bridge fan: point the fan west into it
         anemometer(b, -5.6, zs - 24.4, F + 8, b.fans.length - 1, "w", -4.6, zs - 20.6, 7.5);
      });
      roomChain(b, { rise: 7, start: "e", gust: true }, (_r, zs, F) => {
         vexaDuct(b, zs - 3, zs - 13.4, F, 7, false);
      });
      roomExit(b);
   },
   // Moving Fans: fans on rails, fans that turn themselves every 3 s, patrol drones in the currents
   4: (b) => {
      startPad(b);
      roomBridge(b, { start: "s", rail: true }, (_r, zs, F) => {
         namiShelf(b, 1, zs - 2.4, F);
      });
      roomBridge(b, { start: "n", auto: 3000, fx: 0 }, (_r, zs, F) => {
         kiroShock(b, -1, zs - 3.6, F);
         rikoVent(b, 1, zs - 3.2, F, 7.5);
      });
      roomChain(b, { rise: 6, start: "w", drone: true, gust: true }, (_r, zs, F) => {
         zunoOrbs(b, -3, F + 6 + 5.4, zs - 24);
      });
      roomBridge(b, { start: "e", fx: 2.5 }, (_r, zs, F) => {
         b.drones.push({ x: 2.5, y: F + HUB, z: zs - 13.5, ax: 4.6, periodMs: 4600, phaseMs: 1200, room: room(b) });
      });
      roomChain(b, { rise: 5, start: "n", ventOn: false }, (_r, zs, F) => {
         vexaDuct(b, zs - 3, zs - 13.4, F, 5, true);
      });
      roomExit(b);
   },
   // Storm Tunnel: the Gale Engine, then the escape: four fan rooms before the storm surge, the Tide Bell
   5: (b) => {
      startPad(b);
      roomVent(b, { rise: 5, on: false }, (_r, zs, F) => {
         namiShelf(b, 1, zs - 5, F);
         kiroShock(b, -1, zs - 4.6, F);
      });
      roomArena(b);
      roomBridge(b, { start: "n", name: "Escape 1" }, (_r, zs, F) => {
         rikoVent(b, -1, zs - 3, F, 7.5);
      });
      roomVent(b, { rise: 5, on: true, name: "Escape 2" }, (_r, zs, F) => {
         zunoOrbs(b, 3.4, F + 7.4, zs - 10.2);
      });
      roomBridge(b, { start: "n", crosswind: "n", name: "Escape 3" }, (_r, zs, F) => {
         anemometer(b, -6.2, zs - 6.4, F, b.fans.length - 2, "w", -5.4, zs - 2.4, 7.5);
      });
      roomChain(b, { rise: 5, ventOn: true, start: "n", name: "Escape 4", gust: true }, (_r, zs, F) => {
         vexaDuct(b, zs - 3, zs - 13.4, F, 5, true);
      });
      roomSky(b);
   },
};

/** Builds a level's course from its script (deterministic: no randomness). */
export function buildCourse(level: LevelId, config: WindLevel = LEVELS[level]): Course {
   const b = newBuilder(level);
   SCRIPTS[level](b);
   const last = b.rooms[b.rooms.length - 1];
   const goalZ1 = last.z1 + 0.6;
   const goal: Box = { x0: -3, x1: 3, y0: last.floor - 0.5, y1: last.floor + 4, z0: goalZ1, z1: goalZ1 + 3.6 };
   const secrets = SECRETS[level].map((s) => {
      const p = b.secrets[s.id];
      if (!p) throw new Error(`wind-tunnel-escape L${level}: secret ${s.id} has no spot`);
      return p;
   });
   return {
      level,
      config,
      blocks: b.blocks,
      fans: b.fans,
      lifts: b.lifts,
      orbs: b.orbs,
      mainOrbs: b.orbs.filter((o) => o.bonus === null).length,
      shocks: b.shocks,
      drones: b.drones,
      crates: b.crates,
      anemos: b.anemos,
      rooms: b.rooms,
      secrets,
      start: { x: 0, y: 0, z: 3 },
      startZ: 3,
      goal,
      goalNearZ: goal.z1,
      bell: { x: 0, y: last.floor, z: goal.z0 + 1.2 },
      arena: b.arena,
      bot: b.bot,
      botStart: b.botStart,
      rings: b.rings,
   };
}
